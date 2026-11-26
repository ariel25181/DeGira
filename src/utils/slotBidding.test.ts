import test from 'node:test';
import assert from 'node:assert/strict';
import { EventProposal, LiveShowConfirmed, MusicianSlotBid } from '../types/index.ts';
import {
  applyBidResponseTransition,
  applyBidRetractionTransition,
  applyBidSubmissionTransition,
  applyPublishEventTransition,
  applySlotAcceptToProposal,
  applySlotReleaseToProposal,
  canSubmitBidForSlot,
  detectMusicianDateClashes,
  doTimeRangesOverlap,
  getSlotDisplayState,
  isBidVisibleToViewer,
  isEventVisibleInConvocatorias,
  validateRespondToSlotBid,
  validateRetractSlotBid,
} from './slotBidding.ts';

function makeProposal(overrides: Partial<EventProposal> = {}): EventProposal {
  return {
    id: 'ev-bar1',
    venueId: 'venue-1',
    venueName: 'Bar Test 1',
    venueAddress: 'Honduras 4800',
    venueNeighborhood: 'Palermo Soho',
    venuePhoto: 'https://example.com/photo.jpg',
    title: 'Noche Bar 1',
    date: '2026-12-20',
    startTime: '20:30',
    endTime: '01:00',
    totalCapacity: 80,
    remainingCapacity: 80,
    baseCachetARS: 60000,
    ticketPriceARS: 6000,
    targetGenres: ['Jazz'],
    slots: [
      { id: 'slot-1', startTime: '20:30', endTime: '21:30', requiredMusicians: 2, status: 'libre' },
      { id: 'slot-2', startTime: '21:30', endTime: '22:30', requiredMusicians: 2, status: 'libre' },
      { id: 'slot-3', startTime: '22:30', endTime: '23:30', requiredMusicians: 2, status: 'libre' },
      { id: 'slot-4', startTime: '23:30', endTime: '00:30', requiredMusicians: 2, status: 'libre' },
    ],
    rider: {
      stageSize: '6x4',
      soundSystem: 'Consola 16ch',
      micCount: 4,
      backline: [],
      lighting: 'LED',
    },
    status: 'propuesta',
    eventCode: 'DG-BAR1-9999',
    createdAt: '2026-11-18T12:00:00.000Z',
    ...overrides,
  };
}

function makeBar2Proposal(overrides: Partial<EventProposal> = {}): EventProposal {
  return makeProposal({
    id: 'ev-bar2',
    venueId: 'venue-2',
    venueName: 'Bar Test 2',
    venueAddress: 'Gorriti 5200',
    venueNeighborhood: 'Palermo Hollywood',
    title: 'Noche Bar 2',
    eventCode: 'DG-BAR2-8888',
    slots: [
      { id: 'b2-slot-1', startTime: '21:00', endTime: '22:15', requiredMusicians: 2, status: 'libre' },
      { id: 'b2-slot-2', startTime: '22:30', endTime: '23:45', requiredMusicians: 3, status: 'libre' },
    ],
    ...overrides,
  });
}

function makeBid(overrides: Partial<MusicianSlotBid> = {}): MusicianSlotBid {
  return {
    id: 'bid-1',
    eventId: 'ev-bar1',
    slotId: 'slot-1',
    musicianId: 'mus-1',
    musicianName: 'Músico Test 1',
    musicianAvatar: '',
    proposedCachetARS: 60000,
    musiciansCount: 2,
    equipmentProvided: 'Guitarras',
    equipmentNeeded: 'Micrófono',
    status: 'pendiente_bar',
    history: [
      {
        id: 'h-init',
        actor: 'musico',
        actorName: 'Músico Test 1',
        cachetARS: 60000,
        note: 'Postulación inicial',
        createdAt: '2026-11-18T13:00:00.000Z',
      },
    ],
    createdAt: '2026-11-18T13:00:00.000Z',
    ...overrides,
  };
}

// =========================================================================
// 1-4: Core 4-Slot Locking, Rejection & Scoped Visibility
// =========================================================================

test('01. locks a slot once musician1 submits a proposal and blocks duplicate bids on that same slot', () => {
  const proposal = makeProposal({
    slots: [
      { id: 'slot-1', startTime: '20:30', endTime: '21:30', requiredMusicians: 2, status: 'negociando' },
      { id: 'slot-2', startTime: '21:30', endTime: '22:30', requiredMusicians: 2, status: 'libre' },
      { id: 'slot-3', startTime: '22:30', endTime: '23:30', requiredMusicians: 2, status: 'libre' },
      { id: 'slot-4', startTime: '23:30', endTime: '00:30', requiredMusicians: 2, status: 'libre' },
    ],
  });
  const activeBid = makeBid({ slotId: 'slot-1', musicianId: 'mus-1', status: 'pendiente_bar' });

  const slot1ForMus1 = getSlotDisplayState({
    proposal,
    slot: proposal.slots[0],
    slotBids: [activeBid],
    viewerRole: 'musico',
    viewerMusicianId: 'mus-1',
  });
  assert.equal(slot1ForMus1.availability, 'bloqueado');
  assert.equal(slot1ForMus1.canBid, false);
  assert.equal(slot1ForMus1.isLockedByViewer, true);

  const dupBidCheck = canSubmitBidForSlot({
    proposal,
    slot: proposal.slots[0],
    slotBids: [activeBid],
    musicianId: 'mus-1',
  });
  assert.equal(dupBidCheck.allowed, false);

  const slot1ForMus2 = getSlotDisplayState({
    proposal,
    slot: proposal.slots[0],
    slotBids: [activeBid],
    viewerRole: 'musico',
    viewerMusicianId: 'mus-2',
  });
  assert.equal(slot1ForMus2.availability, 'bloqueado');
  assert.equal(slot1ForMus2.canBid, false);
  assert.equal(slot1ForMus2.isLockedByViewer, false);

  const slot2ForMus2 = getSlotDisplayState({
    proposal,
    slot: proposal.slots[1],
    slotBids: [activeBid],
    viewerRole: 'musico',
    viewerMusicianId: 'mus-2',
  });
  assert.equal(slot2ForMus2.availability, 'libre');
  assert.equal(slot2ForMus2.canBid, true);
});

test('02. reopens slot as libre for bar, musician1, and other musicians when proposal is rejected', () => {
  const proposal = makeProposal({
    slots: [
      { id: 'slot-1', startTime: '20:30', endTime: '21:30', requiredMusicians: 2, status: 'negociando' },
      { id: 'slot-2', startTime: '21:30', endTime: '22:30', requiredMusicians: 2, status: 'libre' },
      { id: 'slot-3', startTime: '22:30', endTime: '23:30', requiredMusicians: 2, status: 'libre' },
      { id: 'slot-4', startTime: '23:30', endTime: '00:30', requiredMusicians: 2, status: 'libre' },
    ],
  });
  const rejectedBid = makeBid({ slotId: 'slot-1', musicianId: 'mus-1', status: 'rechazada' });

  const releasedProposal = applySlotReleaseToProposal(proposal, 'slot-1', []);
  assert.equal(releasedProposal.slots[0].status, 'libre');
  assert.equal(releasedProposal.slots[0].assignedMusicianId, undefined);
  assert.equal(releasedProposal.status, 'propuesta');

  const slot1ForMus1AfterReject = getSlotDisplayState({
    proposal: releasedProposal,
    slot: releasedProposal.slots[0],
    slotBids: [rejectedBid],
    viewerRole: 'musico',
    viewerMusicianId: 'mus-1',
  });
  assert.equal(slot1ForMus1AfterReject.availability, 'libre');
  assert.equal(slot1ForMus1AfterReject.canBid, true);
  assert.equal(slot1ForMus1AfterReject.wasPreviouslyRejectedForViewer, true);

  const slot1ForMus2AfterReject = getSlotDisplayState({
    proposal: releasedProposal,
    slot: releasedProposal.slots[0],
    slotBids: [rejectedBid],
    viewerRole: 'musico',
    viewerMusicianId: 'mus-2',
  });
  assert.equal(slot1ForMus2AfterReject.availability, 'libre');
  assert.equal(slot1ForMus2AfterReject.canBid, true);

  const slot1ForBarAfterReject = getSlotDisplayState({
    proposal: releasedProposal,
    slot: releasedProposal.slots[0],
    slotBids: [rejectedBid],
    viewerRole: 'bar',
  });
  assert.equal(slot1ForBarAfterReject.availability, 'libre');
});

test('03. keeps event visible to other musicians with remaining open slots even after one slot is accepted (para_publicar)', () => {
  const initialProposal = makeProposal();
  const acceptedBid = makeBid({
    id: 'bid-1',
    slotId: 'slot-1',
    musicianId: 'mus-1',
    musicianName: 'Músico Test 1',
    status: 'aceptada',
  });

  const updated = applySlotAcceptToProposal(initialProposal, acceptedBid);
  assert.equal(updated.status, 'para_publicar');
  assert.equal(updated.slots[0].status, 'confirmado');

  assert.equal(
    isEventVisibleInConvocatorias({
      proposal: updated,
      role: 'musico',
      slotBids: [acceptedBid],
      musicianId: 'mus-2',
    }),
    true
  );

  let allConfirmed = updated;
  for (const sId of ['slot-2', 'slot-3', 'slot-4']) {
    allConfirmed = applySlotAcceptToProposal(allConfirmed, {
      slotId: sId,
      musicianId: 'mus-2',
      musicianName: 'Músico Test 2',
      proposedCachetARS: 60000,
    });
  }
  assert.equal(
    isEventVisibleInConvocatorias({
      proposal: allConfirmed,
      role: 'musico',
      slotBids: [acceptedBid],
      musicianId: 'mus-3',
    }),
    false
  );
});

test('04. scopes negotiation bid cards so musicians only see their own bids while bars see their own event bids', () => {
  const bidMus1 = makeBid({ id: 'bid-1', musicianId: 'mus-1' });
  const bidMus2 = makeBid({ id: 'bid-2', musicianId: 'mus-2', slotId: 'slot-2' });

  assert.equal(isBidVisibleToViewer({ bid: bidMus1, viewerRole: 'musico', viewerMusicianId: 'mus-1' }), true);
  assert.equal(isBidVisibleToViewer({ bid: bidMus2, viewerRole: 'musico', viewerMusicianId: 'mus-1' }), false);
  assert.equal(isBidVisibleToViewer({ bid: bidMus1, viewerRole: 'bar' }), true);
  assert.equal(isBidVisibleToViewer({ bid: bidMus2, viewerRole: 'bar' }), true);
});

// =========================================================================
// 5-10: Bar 1 vs Bar 2 Isolation & Cross-Actor Authorization
// =========================================================================

test('05. isolates Bar 1 and Bar 2 events across all Convocatorias status filters', () => {
  const evBar1 = makeProposal({ status: 'propuesta' });
  const evBar2 = makeBar2Proposal({ status: 'propuesta' });
  const evBar1Pub = makeProposal({ id: 'ev-bar1-pub', status: 'publicada' });

  assert.equal(
    isEventVisibleInConvocatorias({ proposal: evBar1, role: 'bar', barStatusFilter: 'todos', viewerVenueId: 'venue-1' }),
    true
  );
  assert.equal(
    isEventVisibleInConvocatorias({ proposal: evBar2, role: 'bar', barStatusFilter: 'todos', viewerVenueId: 'venue-1' }),
    false
  );
  assert.equal(
    isEventVisibleInConvocatorias({ proposal: evBar2, role: 'bar', barStatusFilter: 'propuesta', viewerVenueId: 'venue-2' }),
    true
  );
  assert.equal(
    isEventVisibleInConvocatorias({ proposal: evBar1Pub, role: 'bar', barStatusFilter: 'publicada', viewerVenueId: 'venue-2' }),
    false
  );
});

test('06. isolates Bar 1 and Bar 2 bids strictly when viewerVenueId and parentEvent are supplied, and hides bids from spectator', () => {
  const evBar1 = makeProposal();
  const evBar2 = makeBar2Proposal();
  const bidBar1 = makeBid({ id: 'b-bar1', eventId: evBar1.id, musicianId: 'mus-1' });
  const bidBar2 = makeBid({ id: 'b-bar2', eventId: evBar2.id, slotId: 'b2-slot-1', musicianId: 'mus-2' });

  assert.equal(
    isBidVisibleToViewer({ bid: bidBar1, viewerRole: 'bar', viewerVenueId: 'venue-1', parentEvent: evBar1 }),
    true
  );
  assert.equal(
    isBidVisibleToViewer({ bid: bidBar1, viewerRole: 'bar', viewerVenueId: 'venue-2', parentEvent: evBar1 }),
    false
  );
  assert.equal(
    isBidVisibleToViewer({ bid: bidBar2, viewerRole: 'bar', viewerVenueId: 'venue-2', parentEvent: evBar2 }),
    true
  );
  assert.equal(
    isBidVisibleToViewer({ bid: bidBar2, viewerRole: 'espectador', viewerVenueId: 'venue-2', parentEvent: evBar2 }),
    false
  );
});

test('07. denies Bar 2 from accepting, countering, or rejecting Bar 1 bids and vice versa', () => {
  const evBar1 = makeProposal();
  const evBar2 = makeBar2Proposal();
  const bidOnBar1 = makeBid({ eventId: evBar1.id, slotId: 'slot-1', musicianId: 'mus-1' });
  const bidOnBar2 = makeBid({ id: 'bid-2', eventId: evBar2.id, slotId: 'b2-slot-1', musicianId: 'mus-2' });

  for (const action of ['accept', 'counter', 'reject'] as const) {
    const r1 = applyBidResponseTransition({
      eventProposals: [evBar1, evBar2],
      slotBids: [bidOnBar1, bidOnBar2],
      bidId: bidOnBar1.id,
      actorRole: 'bar',
      actorEntityId: 'venue-2',
      action,
      counterCachet: action === 'counter' ? 55000 : undefined,
    });
    assert.equal(r1.ok, false);

    const r2 = applyBidResponseTransition({
      eventProposals: [evBar1, evBar2],
      slotBids: [bidOnBar1, bidOnBar2],
      bidId: bidOnBar2.id,
      actorRole: 'bar',
      actorEntityId: 'venue-1',
      action,
      counterCachet: action === 'counter' ? 55000 : undefined,
    });
    assert.equal(r2.ok, false);
  }
});

test('08. denies spectator role from responding to any slot bid', () => {
  const evBar1 = makeProposal();
  const bid = makeBid();
  const res = applyBidResponseTransition({
    eventProposals: [evBar1],
    slotBids: [bid],
    bidId: bid.id,
    actorRole: 'espectador',
    actorEntityId: 'user-pub-1',
    action: 'accept',
  });
  assert.equal(res.ok, false);
});

test('09. denies Musician 2 from retracting Musician 1 bid and vice versa', () => {
  const evBar1 = makeProposal();
  const bidMus1 = makeBid({ musicianId: 'mus-1' });
  const nowFarBeforeShow = new Date('2026-12-01T12:00:00').getTime();

  const res = applyBidRetractionTransition({
    eventProposals: [evBar1],
    slotBids: [bidMus1],
    bidId: bidMus1.id,
    actorMusicianId: 'mus-2',
    nowMs: nowFarBeforeShow,
  });
  assert.equal(res.ok, false);
});

test('10. both musicians see open proposals across Bar 1 & Bar 2, and para_publicar hides once all slots are filled for unrelated musicians', () => {
  const evBar1 = makeProposal({
    slots: [
      { id: 'slot-1', startTime: '20:30', endTime: '21:30', requiredMusicians: 2, status: 'confirmado', assignedMusicianId: 'mus-1' },
    ],
    status: 'para_publicar',
  });
  const evBar2 = makeBar2Proposal({ status: 'propuesta' });
  const bidMus1 = makeBid({ id: 'b1', eventId: evBar1.id, slotId: 'slot-1', musicianId: 'mus-1', status: 'aceptada' });

  // mus-1 sees both (confirmed participant in evBar1 + open evBar2)
  assert.equal(isEventVisibleInConvocatorias({ proposal: evBar1, role: 'musico', slotBids: [bidMus1], musicianId: 'mus-1' }), true);
  assert.equal(isEventVisibleInConvocatorias({ proposal: evBar2, role: 'musico', slotBids: [bidMus1], musicianId: 'mus-1' }), true);

  // mus-2 sees evBar2, does NOT see full evBar1
  assert.equal(isEventVisibleInConvocatorias({ proposal: evBar1, role: 'musico', slotBids: [bidMus1], musicianId: 'mus-2' }), false);
  assert.equal(isEventVisibleInConvocatorias({ proposal: evBar2, role: 'musico', slotBids: [bidMus1], musicianId: 'mus-2' }), true);

  // Spectator only sees publicada
  assert.equal(isEventVisibleInConvocatorias({ proposal: evBar1, role: 'espectador' }), false);
  assert.equal(isEventVisibleInConvocatorias({ proposal: { ...evBar1, status: 'publicada' }, role: 'espectador' }), true);
});

// =========================================================================
// 11-18: Reserving, Blocking & Time Clash Combinations (2 Bars × 2 Musicians)
// =========================================================================

test('11. allows simultaneous non-colliding reservations across 2 bars and 2 musicians cleanly', () => {
  let events = [makeProposal(), makeBar2Proposal()];
  let bids: MusicianSlotBid[] = [];

  // mus-1 bids Bar 1 slot-1
  const t1 = applyBidSubmissionTransition({
    eventProposals: events,
    slotBids: bids,
    bid: makeBid({ id: 'b-m1-b1', eventId: 'ev-bar1', slotId: 'slot-1', musicianId: 'mus-1' }),
  });
  assert.equal(t1.ok, true);
  events = t1.eventProposals;
  bids = t1.slotBids;

  // mus-2 bids Bar 1 slot-2
  const t2 = applyBidSubmissionTransition({
    eventProposals: events,
    slotBids: bids,
    bid: makeBid({ id: 'b-m2-b1', eventId: 'ev-bar1', slotId: 'slot-2', musicianId: 'mus-2', musicianName: 'Músico Test 2' }),
  });
  assert.equal(t2.ok, true);
  events = t2.eventProposals;
  bids = t2.slotBids;

  // mus-2 bids Bar 2 b2-slot-1
  const t3 = applyBidSubmissionTransition({
    eventProposals: events,
    slotBids: bids,
    bid: makeBid({ id: 'b-m2-b2', eventId: 'ev-bar2', slotId: 'b2-slot-1', musicianId: 'mus-2', musicianName: 'Músico Test 2' }),
  });
  assert.equal(t3.ok, true);
  events = t3.eventProposals;
  bids = t3.slotBids;

  // mus-1 bids Bar 2 b2-slot-2
  const t4 = applyBidSubmissionTransition({
    eventProposals: events,
    slotBids: bids,
    bid: makeBid({ id: 'b-m1-b2', eventId: 'ev-bar2', slotId: 'b2-slot-2', musicianId: 'mus-1' }),
  });
  assert.equal(t4.ok, true);
  events = t4.eventProposals;
  bids = t4.slotBids;

  const ev1 = events.find((e) => e.id === 'ev-bar1')!;
  const ev2 = events.find((e) => e.id === 'ev-bar2')!;
  assert.equal(ev1.slots[0].status, 'negociando');
  assert.equal(ev1.slots[1].status, 'negociando');
  assert.equal(ev1.slots[2].status, 'libre');
  assert.equal(ev2.slots[0].status, 'negociando');
  assert.equal(ev2.slots[1].status, 'negociando');
});

test('12. blocks duplicate bids by same musician across pendiente_bar, contraoferta_bar, contraoferta_musico, and aceptada', () => {
  const ev = makeProposal();
  for (const st of ['pendiente_bar', 'contraoferta_bar', 'contraoferta_musico', 'aceptada'] as const) {
    const existing = makeBid({ id: `bid-${st}`, status: st });
    const res = applyBidSubmissionTransition({
      eventProposals: [{ ...ev, slots: ev.slots.map((s, i) => (i === 0 ? { ...s, status: st === 'aceptada' ? 'confirmado' : 'negociando' } : s)) }],
      slotBids: [existing],
      bid: makeBid({ id: 'bid-dup', musicianId: 'mus-1' }),
    });
    assert.equal(res.ok, false);
  }
});

test('13. blocks musician2 whenever musician1 holds ANY active or accepted bid on that slot', () => {
  const ev = makeProposal();
  for (const st of ['pendiente_bar', 'contraoferta_bar', 'contraoferta_musico', 'aceptada'] as const) {
    const existing = makeBid({ id: `bid-${st}`, musicianId: 'mus-1', status: st });
    const res = applyBidSubmissionTransition({
      eventProposals: [ev],
      slotBids: [existing],
      bid: makeBid({ id: 'bid-m2', musicianId: 'mus-2', musicianName: 'Músico Test 2' }),
    });
    assert.equal(res.ok, false);
  }
});

test('14. rejects bid submission on publicada, agotada, cancelada, unknown event/slot, or non-positive cachet', () => {
  const baseBid = makeBid();
  for (const closedStatus of ['publicada', 'agotada', 'cancelada'] as const) {
    const ev = makeProposal({ status: closedStatus });
    const res = applyBidSubmissionTransition({ eventProposals: [ev], slotBids: [], bid: baseBid });
    assert.equal(res.ok, false);
  }

  assert.equal(
    applyBidSubmissionTransition({ eventProposals: [makeProposal()], slotBids: [], bid: makeBid({ eventId: 'missing' }) }).ok,
    false
  );
  assert.equal(
    applyBidSubmissionTransition({ eventProposals: [makeProposal()], slotBids: [], bid: makeBid({ slotId: 'missing' }) }).ok,
    false
  );
  assert.equal(
    applyBidSubmissionTransition({ eventProposals: [makeProposal()], slotBids: [], bid: makeBid({ proposedCachetARS: 0 }) }).ok,
    false
  );
  assert.equal(
    applyBidSubmissionTransition({ eventProposals: [makeProposal()], slotBids: [], bid: makeBid({ proposedCachetARS: -100 }) }).ok,
    false
  );
});

test('15. detects same-date overlapping time clashes across Bar 1, Bar 2, and liveShows', () => {
  const ev1 = makeProposal({ date: '2026-12-20' }); // slot-1: 20:30 - 21:30
  const ev2 = makeBar2Proposal({ date: '2026-12-20' }); // b2-slot-1: 21:00 - 22:15 (overlaps!)
  const activeBidBar1 = makeBid({ eventId: ev1.id, slotId: 'slot-1', musicianId: 'mus-1', status: 'pendiente_bar' });

  const clashesWithBar2 = detectMusicianDateClashes({
    musicianId: 'mus-1',
    targetEvent: ev2,
    targetSlot: ev2.slots[0],
    slotBids: [activeBidBar1],
    eventProposals: [ev1, ev2],
  });
  assert.equal(clashesWithBar2.length, 1);
  assert.equal(clashesWithBar2[0].venueName, 'Bar Test 1');

  const confirmedShow: LiveShowConfirmed = {
    id: 'show-conf',
    date: '2026-12-20',
    time: '22:00 hs',
    venueId: 'venue-2',
    venueName: 'Bar Test 2',
    venueAddress: 'Gorriti 5200',
    venueNeighborhood: 'Palermo Hollywood',
    venuePhoto: '',
    musicianId: 'mus-1',
    musicianName: 'Músico Test 1',
    musicianGenres: ['Jazz'],
    musicianFormat: 'Dúo',
    musicianAvatar: '',
    ticketType: 'entrada_libre',
    ticketPriceARS: 0,
    description: '',
    isCompleted: false,
    venueReviewed: false,
    musicianReviewed: false,
  };
  const clashesWithShow = detectMusicianDateClashes({
    musicianId: 'mus-1',
    targetEvent: ev2,
    targetSlot: ev2.slots[0],
    slotBids: [],
    eventProposals: [ev1, ev2],
    liveShows: [confirmedShow],
  });
  assert.equal(clashesWithShow.length, 1);
  assert.equal(clashesWithShow[0].status, 'Fecha Confirmada');
});

test('16. allows consecutive non-overlapping same-date slots across bars without false clash alerts', () => {
  const ev1 = makeProposal({ date: '2026-12-20' }); // slot-1: 20:30 - 21:30
  const ev2 = makeBar2Proposal({
    date: '2026-12-20',
    slots: [{ id: 'b2-late', startTime: '21:30', endTime: '22:30', requiredMusicians: 2, status: 'libre' }],
  });
  const bidBar1 = makeBid({ eventId: ev1.id, slotId: 'slot-1', musicianId: 'mus-1' });

  const clashes = detectMusicianDateClashes({
    musicianId: 'mus-1',
    targetEvent: ev2,
    targetSlot: ev2.slots[0],
    slotBids: [bidBar1],
    eventProposals: [ev1, ev2],
  });
  assert.equal(clashes.length, 0);
});

test('17. handles midnight-crossing slot time ranges accurately in doTimeRangesOverlap', () => {
  assert.equal(doTimeRangesOverlap('23:30', '01:00', '23:45', '00:45'), true);
  assert.equal(doTimeRangesOverlap('23:30', '01:00', '22:00', '23:30'), false);
  assert.equal(doTimeRangesOverlap('21:00', '22:15', '22:15', '23:30'), false);
});

test('18. excludes rejected, retracted, and cancelled events from clash detection, while detecting confirmed assigned slots', () => {
  const ev1 = makeProposal({ date: '2026-12-20' });
  const evCancelled = makeProposal({ id: 'ev-cancelled', date: '2026-12-20', status: 'cancelada' });
  const ev2 = makeBar2Proposal({ date: '2026-12-20' });
  const rejectedBid = makeBid({ eventId: ev1.id, slotId: 'slot-1', musicianId: 'mus-1', status: 'rechazada' });
  const retractedBid = makeBid({ id: 'b-ret', eventId: ev1.id, slotId: 'slot-2', musicianId: 'mus-1', status: 'rechazada', retracted: true });
  const cancelledBid = makeBid({ id: 'b-canc', eventId: evCancelled.id, slotId: 'slot-1', musicianId: 'mus-1', status: 'aceptada' });

  const clashes = detectMusicianDateClashes({
    musicianId: 'mus-1',
    targetEvent: ev2,
    targetSlot: ev2.slots[0],
    slotBids: [rejectedBid, retractedBid, cancelledBid],
    eventProposals: [ev1, evCancelled, ev2],
  });
  assert.equal(clashes.length, 0);

  const evConfirmedWithoutBid = makeProposal({
    id: 'ev-conf-nobid',
    title: 'Clappers Party',
    date: '2026-12-20',
    status: 'publicada',
    slots: [
      {
        id: 'slot-conf',
        startTime: '21:00',
        endTime: '22:15',
        requiredMusicians: 2,
        status: 'confirmado',
        assignedMusicianId: 'mus-1',
        assignedMusicianName: 'Músico Test 1',
      },
    ],
  });
  const confirmedClashes = detectMusicianDateClashes({
    musicianId: 'mus-1',
    targetEvent: ev2,
    targetSlot: ev2.slots[0],
    slotBids: [],
    eventProposals: [evConfirmedWithoutBid, ev2],
  });
  assert.equal(confirmedClashes.length, 1);
  assert.equal(confirmedClashes[0].title, 'Clappers Party');
  assert.equal(confirmedClashes[0].status, 'Aceptada');
});

// =========================================================================
// 19-28: Proposal <-> Counter-offer Ping-Pong Loops & Turn-Taking Guards
// =========================================================================

test('19. completes multi-round Bar 1 <-> Musician 1 counter-offer ping-pong ending in Musician acceptance', () => {
  let events = [makeProposal()];
  let bids: MusicianSlotBid[] = [];

  // Mus 1 proposes 60k
  const s1 = applyBidSubmissionTransition({ eventProposals: events, slotBids: bids, bid: makeBid({ proposedCachetARS: 60000 }) });
  assert.equal(s1.ok, true);
  events = s1.eventProposals;
  bids = s1.slotBids;

  // Bar 1 counters 50k
  const r1 = applyBidResponseTransition({
    eventProposals: events,
    slotBids: bids,
    bidId: 'bid-1',
    actorRole: 'bar',
    actorEntityId: 'venue-1',
    action: 'counter',
    counterCachet: 50000,
  });
  assert.equal(r1.ok, true);
  assert.equal(r1.updatedBid.status, 'contraoferta_bar');
  bids = r1.slotBids;

  // Mus 1 counters 55k
  const r2 = applyBidResponseTransition({
    eventProposals: events,
    slotBids: bids,
    bidId: 'bid-1',
    actorRole: 'musico',
    actorEntityId: 'mus-1',
    action: 'counter',
    counterCachet: 55000,
  });
  assert.equal(r2.ok, true);
  assert.equal(r2.updatedBid.status, 'contraoferta_musico');
  bids = r2.slotBids;

  // Bar 1 counters 53k
  const r3 = applyBidResponseTransition({
    eventProposals: events,
    slotBids: bids,
    bidId: 'bid-1',
    actorRole: 'bar',
    actorEntityId: 'venue-1',
    action: 'counter',
    counterCachet: 53000,
  });
  assert.equal(r3.ok, true);
  bids = r3.slotBids;

  // Mus 1 accepts 53k
  const r4 = applyBidResponseTransition({
    eventProposals: events,
    slotBids: bids,
    bidId: 'bid-1',
    actorRole: 'musico',
    actorEntityId: 'mus-1',
    action: 'accept',
  });
  assert.equal(r4.ok, true);
  assert.equal(r4.updatedBid.status, 'aceptada');
  assert.equal(r4.updatedBid.proposedCachetARS, 53000);
  assert.equal(r4.updatedBid.history.length, 5);
  assert.equal(r4.updatedEvent?.status, 'para_publicar');
  assert.equal(r4.updatedEvent?.slots[0].agreedCachetARS, 53000);
  assert.equal(r4.updatedEvent?.slots[0].assignedMusicianId, 'mus-1');
});

test('20. completes Bar 2 <-> Musician 2 counter-offer ping-pong ending in Bar acceptance', () => {
  let events = [makeBar2Proposal()];
  let bids: MusicianSlotBid[] = [
    makeBid({
      id: 'bid-m2',
      eventId: 'ev-bar2',
      slotId: 'b2-slot-1',
      musicianId: 'mus-2',
      musicianName: 'Músico Test 2',
      proposedCachetARS: 80000,
    }),
  ];

  const r1 = applyBidResponseTransition({
    eventProposals: events,
    slotBids: bids,
    bidId: 'bid-m2',
    actorRole: 'bar',
    actorEntityId: 'venue-2',
    action: 'counter',
    counterCachet: 65000,
  });
  assert.equal(r1.ok, true);
  bids = r1.slotBids;

  const r2 = applyBidResponseTransition({
    eventProposals: events,
    slotBids: bids,
    bidId: 'bid-m2',
    actorRole: 'musico',
    actorEntityId: 'mus-2',
    action: 'counter',
    counterCachet: 72000,
  });
  assert.equal(r2.ok, true);
  bids = r2.slotBids;

  const r3 = applyBidResponseTransition({
    eventProposals: events,
    slotBids: bids,
    bidId: 'bid-m2',
    actorRole: 'bar',
    actorEntityId: 'venue-2',
    action: 'accept',
  });
  assert.equal(r3.ok, true);
  assert.equal(r3.updatedEvent?.slots[0].status, 'confirmado');
  assert.equal(r3.updatedEvent?.slots[0].assignedMusicianId, 'mus-2');
  assert.equal(r3.updatedEvent?.slots[0].agreedCachetARS, 72000);
});

test('21. preserves mixed ping-pong states independently across 2 bars × 2 musicians simultaneously', () => {
  let events = [makeProposal(), makeBar2Proposal()];
  let bids: MusicianSlotBid[] = [
    makeBid({ id: 'b1', eventId: 'ev-bar1', slotId: 'slot-1', musicianId: 'mus-1', proposedCachetARS: 60000 }),
    makeBid({ id: 'b2', eventId: 'ev-bar2', slotId: 'b2-slot-1', musicianId: 'mus-2', musicianName: 'Músico Test 2', proposedCachetARS: 70000 }),
  ];

  // Bar 1 counters Mus 1
  const rBar1 = applyBidResponseTransition({
    eventProposals: events,
    slotBids: bids,
    bidId: 'b1',
    actorRole: 'bar',
    actorEntityId: 'venue-1',
    action: 'counter',
    counterCachet: 52000,
  });
  assert.equal(rBar1.ok, true);
  bids = rBar1.slotBids;

  // Bar 2 accepts Mus 2 directly
  const rBar2 = applyBidResponseTransition({
    eventProposals: events,
    slotBids: bids,
    bidId: 'b2',
    actorRole: 'bar',
    actorEntityId: 'venue-2',
    action: 'accept',
  });
  assert.equal(rBar2.ok, true);
  events = rBar2.eventProposals;
  bids = rBar2.slotBids;

  assert.equal(bids.find((b) => b.id === 'b1')?.status, 'contraoferta_bar');
  assert.equal(bids.find((b) => b.id === 'b2')?.status, 'aceptada');
  assert.equal(events.find((e) => e.id === 'ev-bar1')?.status, 'propuesta');
  assert.equal(events.find((e) => e.id === 'ev-bar2')?.status, 'para_publicar');
});

test('22. allows Bar to adjust its own counteroffer before musician responds without self-accepting', () => {
  const ev = makeProposal();
  const bid = makeBid({ status: 'contraoferta_bar', proposedCachetARS: 50000 });

  const rAdjust = applyBidResponseTransition({
    eventProposals: [ev],
    slotBids: [bid],
    bidId: bid.id,
    actorRole: 'bar',
    actorEntityId: 'venue-1',
    action: 'counter',
    counterCachet: 54000,
  });
  assert.equal(rAdjust.ok, true);
  assert.equal(rAdjust.updatedBid.status, 'contraoferta_bar');
  assert.equal(rAdjust.updatedBid.proposedCachetARS, 54000);
});

test('23. prevents Bar from self-accepting its own contraoferta_bar', () => {
  const ev = makeProposal();
  const bid = makeBid({ status: 'contraoferta_bar', proposedCachetARS: 50000 });

  const res = applyBidResponseTransition({
    eventProposals: [ev],
    slotBids: [bid],
    bidId: bid.id,
    actorRole: 'bar',
    actorEntityId: 'venue-1',
    action: 'accept',
  });
  assert.equal(res.ok, false);
});

test('24. prevents Musician from accepting, countering, or rejecting when status is pendiente_bar or contraoferta_musico', () => {
  const ev = makeProposal();
  for (const st of ['pendiente_bar', 'contraoferta_musico'] as const) {
    const bid = makeBid({ status: st });
    for (const action of ['accept', 'counter', 'reject'] as const) {
      const res = applyBidResponseTransition({
        eventProposals: [ev],
        slotBids: [bid],
        bidId: bid.id,
        actorRole: 'musico',
        actorEntityId: 'mus-1',
        action,
        counterCachet: action === 'counter' ? 65000 : undefined,
      });
      assert.equal(res.ok, false);
    }
  }
});

test('25. prevents Musician 2 from accepting, countering, or rejecting Musician 1 contraoferta_bar', () => {
  const ev = makeProposal();
  const bid = makeBid({ musicianId: 'mus-1', status: 'contraoferta_bar' });
  for (const action of ['accept', 'counter', 'reject'] as const) {
    const res = applyBidResponseTransition({
      eventProposals: [ev],
      slotBids: [bid],
      bidId: bid.id,
      actorRole: 'musico',
      actorEntityId: 'mus-2',
      action,
      counterCachet: action === 'counter' ? 50000 : undefined,
    });
    assert.equal(res.ok, false);
  }
});

test('26. rejects invalid counteroffer amounts ($0, negative, NaN) from both Bar and Musician', () => {
  const ev = makeProposal();
  const bidBarTurn = makeBid({ status: 'pendiente_bar' });
  const bidMusTurn = makeBid({ status: 'contraoferta_bar' });

  for (const badAmount of [0, -1000, Number.NaN, Infinity]) {
    assert.equal(
      validateRespondToSlotBid({
        bid: bidBarTurn,
        event: ev,
        allSlotBids: [bidBarTurn],
        actorRole: 'bar',
        actorEntityId: 'venue-1',
        action: 'counter',
        counterCachet: badAmount,
      }).allowed,
      false
    );
    assert.equal(
      validateRespondToSlotBid({
        bid: bidMusTurn,
        event: ev,
        allSlotBids: [bidMusTurn],
        actorRole: 'musico',
        actorEntityId: 'mus-1',
        action: 'counter',
        counterCachet: badAmount,
      }).allowed,
      false
    );
  }
});

test('27. prevents double acceptance on same slot and rejects actions on already accepted bid', () => {
  const ev = makeProposal({
    slots: [
      {
        id: 'slot-1',
        startTime: '20:30',
        endTime: '21:30',
        requiredMusicians: 2,
        status: 'confirmado',
        assignedMusicianId: 'mus-1',
      },
    ],
  });
  const bid1 = makeBid({ id: 'b1', musicianId: 'mus-1', status: 'aceptada' });
  const bid2 = makeBid({ id: 'b2', musicianId: 'mus-2', status: 'pendiente_bar' });

  assert.equal(
    applyBidResponseTransition({
      eventProposals: [ev],
      slotBids: [bid1, bid2],
      bidId: 'b2',
      actorRole: 'bar',
      actorEntityId: 'venue-1',
      action: 'accept',
    }).ok,
    false
  );

  assert.equal(
    applyBidResponseTransition({
      eventProposals: [ev],
      slotBids: [bid1],
      bidId: 'b1',
      actorRole: 'bar',
      actorEntityId: 'venue-1',
      action: 'reject',
    }).ok,
    false
  );
});

test('28. enforces closed event guards: publicada/agotada reject accept/counter, cancelada rejects everything', () => {
  const bid = makeBid({ status: 'contraoferta_bar' });
  for (const st of ['publicada', 'agotada'] as const) {
    const ev = makeProposal({ status: st });
    assert.equal(
      validateRespondToSlotBid({
        bid,
        event: ev,
        allSlotBids: [bid],
        actorRole: 'musico',
        actorEntityId: 'mus-1',
        action: 'accept',
      }).allowed,
      false
    );
    assert.equal(
      validateRespondToSlotBid({
        bid,
        event: ev,
        allSlotBids: [bid],
        actorRole: 'bar',
        actorEntityId: 'venue-1',
        action: 'counter',
        counterCachet: 55000,
      }).allowed,
      false
    );
    // Rejecting a pending bid on published event IS allowed to clean up
    assert.equal(
      validateRespondToSlotBid({
        bid,
        event: ev,
        allSlotBids: [bid],
        actorRole: 'bar',
        actorEntityId: 'venue-1',
        action: 'reject',
      }).allowed,
      true
    );
  }

  const cancelled = makeProposal({ status: 'cancelada' });
  assert.equal(
    validateRespondToSlotBid({
      bid,
      event: cancelled,
      allSlotBids: [bid],
      actorRole: 'bar',
      actorEntityId: 'venue-1',
      action: 'reject',
    }).allowed,
    false
  );
});

// =========================================================================
// 29-35: Rejections Across Every Stage & Re-open Handover
// =========================================================================

test('29. Bar 1 rejects Musician 1 initial bid -> slot opens libre -> Musician 1 & Musician 2 can re-bid', () => {
  let events = [makeProposal({ slots: [{ id: 'slot-1', startTime: '20:30', endTime: '21:30', requiredMusicians: 2, status: 'negociando' }] })];
  let bids = [makeBid({ id: 'b-m1', musicianId: 'mus-1', status: 'pendiente_bar' })];

  const rej = applyBidResponseTransition({
    eventProposals: events,
    slotBids: bids,
    bidId: 'b-m1',
    actorRole: 'bar',
    actorEntityId: 'venue-1',
    action: 'reject',
  });
  assert.equal(rej.ok, true);
  events = rej.eventProposals;
  bids = rej.slotBids;
  assert.equal(events[0].slots[0].status, 'libre');

  // Musician 1 can re-bid after rejection
  const rebidMus1 = applyBidSubmissionTransition({
    eventProposals: events,
    slotBids: bids,
    bid: makeBid({ id: 'b-m1-2', musicianId: 'mus-1', proposedCachetARS: 52000 }),
  });
  assert.equal(rebidMus1.ok, true);
});

test('30. Bar 1 rejects Musician 1 contraoferta_musico -> Musician 2 bids same slot and Bar 1 accepts', () => {
  let events = [makeProposal({ slots: [{ id: 'slot-1', startTime: '20:30', endTime: '21:30', requiredMusicians: 2, status: 'negociando' }] })];
  let bids = [makeBid({ id: 'b-m1', musicianId: 'mus-1', status: 'contraoferta_musico', proposedCachetARS: 95000 })];

  const rej = applyBidResponseTransition({
    eventProposals: events,
    slotBids: bids,
    bidId: 'b-m1',
    actorRole: 'bar',
    actorEntityId: 'venue-1',
    action: 'reject',
  });
  assert.equal(rej.ok, true);
  events = rej.eventProposals;
  bids = rej.slotBids;

  const subMus2 = applyBidSubmissionTransition({
    eventProposals: events,
    slotBids: bids,
    bid: makeBid({ id: 'b-m2', musicianId: 'mus-2', musicianName: 'Músico Test 2', proposedCachetARS: 60000 }),
  });
  assert.equal(subMus2.ok, true);
  events = subMus2.eventProposals;
  bids = subMus2.slotBids;

  const accMus2 = applyBidResponseTransition({
    eventProposals: events,
    slotBids: bids,
    bidId: 'b-m2',
    actorRole: 'bar',
    actorEntityId: 'venue-1',
    action: 'accept',
  });
  assert.equal(accMus2.ok, true);
  assert.equal(accMus2.updatedEvent?.slots[0].assignedMusicianId, 'mus-2');
});

test('31. Bar 2 cancels/rejects while bid is in contraoferta_bar -> frees slot cleanly', () => {
  const ev = makeBar2Proposal({
    slots: [{ id: 'b2-slot-1', startTime: '21:00', endTime: '22:15', requiredMusicians: 2, status: 'negociando' }],
  });
  const bid = makeBid({ id: 'b-b2', eventId: ev.id, slotId: 'b2-slot-1', musicianId: 'mus-2', status: 'contraoferta_bar' });

  const rej = applyBidResponseTransition({
    eventProposals: [ev],
    slotBids: [bid],
    bidId: 'b-b2',
    actorRole: 'bar',
    actorEntityId: 'venue-2',
    action: 'reject',
  });
  assert.equal(rej.ok, true);
  assert.equal(rej.updatedBid.status, 'rechazada');
  assert.equal(rej.updatedEvent?.slots[0].status, 'libre');
});

test('32. Musician 2 rejects Bar 2 contraoferta_bar -> slot frees to libre and Musician 1 wins it', () => {
  let events = [makeBar2Proposal()];
  let bids = [
    makeBid({
      id: 'b-m2-b2',
      eventId: 'ev-bar2',
      slotId: 'b2-slot-1',
      musicianId: 'mus-2',
      musicianName: 'Músico Test 2',
      status: 'contraoferta_bar',
    }),
  ];

  const m2Rej = applyBidResponseTransition({
    eventProposals: events,
    slotBids: bids,
    bidId: 'b-m2-b2',
    actorRole: 'musico',
    actorEntityId: 'mus-2',
    action: 'reject',
  });
  assert.equal(m2Rej.ok, true);
  events = m2Rej.eventProposals;
  bids = m2Rej.slotBids;
  assert.equal(events[0].slots[0].status, 'libre');

  const m1Sub = applyBidSubmissionTransition({
    eventProposals: events,
    slotBids: bids,
    bid: makeBid({ id: 'b-m1-b2', eventId: 'ev-bar2', slotId: 'b2-slot-1', musicianId: 'mus-1' }),
  });
  assert.equal(m1Sub.ok, true);
  events = m1Sub.eventProposals;
  bids = m1Sub.slotBids;

  const bar2Accept = applyBidResponseTransition({
    eventProposals: events,
    slotBids: bids,
    bidId: 'b-m1-b2',
    actorRole: 'bar',
    actorEntityId: 'venue-2',
    action: 'accept',
  });
  assert.equal(bar2Accept.ok, true);
  assert.equal(bar2Accept.updatedEvent?.slots[0].assignedMusicianId, 'mus-1');
});

test('33. terminal rejected bid cannot be accepted, countered, rejected again, or retracted', () => {
  const ev = makeProposal();
  const bid = makeBid({ status: 'rechazada' });
  for (const action of ['accept', 'counter', 'reject'] as const) {
    assert.equal(
      applyBidResponseTransition({
        eventProposals: [ev],
        slotBids: [bid],
        bidId: bid.id,
        actorRole: 'bar',
        actorEntityId: 'venue-1',
        action,
        counterCachet: action === 'counter' ? 50000 : undefined,
      }).ok,
      false
    );
  }
  assert.equal(
    applyBidRetractionTransition({
      eventProposals: [ev],
      slotBids: [bid],
      bidId: bid.id,
      actorMusicianId: 'mus-1',
      nowMs: new Date('2026-12-01T12:00:00').getTime(),
    }).ok,
    false
  );
});

test('34. rejecting Slot 2 bid on para_publicar keeps Slot 1 confirmed and preserves para_publicar status', () => {
  const ev = makeProposal({
    status: 'para_publicar',
    slots: [
      { id: 'slot-1', startTime: '20:30', endTime: '21:30', requiredMusicians: 2, status: 'confirmado', assignedMusicianId: 'mus-1', assignedMusicianName: 'Músico Test 1', agreedCachetARS: 60000 },
      { id: 'slot-2', startTime: '21:30', endTime: '22:30', requiredMusicians: 2, status: 'negociando' },
    ],
  });
  const bid1 = makeBid({ id: 'b1', slotId: 'slot-1', musicianId: 'mus-1', status: 'aceptada' });
  const bid2 = makeBid({ id: 'b2', slotId: 'slot-2', musicianId: 'mus-2', status: 'pendiente_bar' });

  const res = applyBidResponseTransition({
    eventProposals: [ev],
    slotBids: [bid1, bid2],
    bidId: 'b2',
    actorRole: 'bar',
    actorEntityId: 'venue-1',
    action: 'reject',
  });
  assert.equal(res.ok, true);
  assert.equal(res.updatedEvent?.status, 'para_publicar');
  assert.equal(res.updatedEvent?.slots[0].status, 'confirmado');
  assert.equal(res.updatedEvent?.slots[1].status, 'libre');
});

test('35. rejecting a counteroffer when event is in propuesta keeps event in propuesta and slot in libre', () => {
  const ev = makeProposal({
    status: 'propuesta',
    slots: [{ id: 'slot-1', startTime: '20:30', endTime: '21:30', requiredMusicians: 2, status: 'negociando' }],
  });
  const bid = makeBid({ status: 'contraoferta_musico', proposedCachetARS: 80000 });
  const res = applyBidResponseTransition({
    eventProposals: [ev],
    slotBids: [bid],
    bidId: bid.id,
    actorRole: 'bar',
    actorEntityId: 'venue-1',
    action: 'reject',
  });
  assert.equal(res.ok, true);
  assert.equal(res.updatedEvent?.status, 'propuesta');
  assert.equal(res.updatedEvent?.slots[0].status, 'libre');
});

// =========================================================================
// 36-46: Retraction Rules (>=24h vs <24h, Blocked, Counteroffer, Accepted, Published)
// =========================================================================

test('36. enforces exact 24h cutoff using slot.startTime: allows 24h01m before slot, blocks 23h59m before slot', () => {
  // Event starts 20:30, but slot-3 starts 22:30 -> effective startTime MUST be 22:30!
  const ev = makeProposal({ date: '2026-12-20', startTime: '20:30' });
  const bid = makeBid({ slotId: 'slot-3', status: 'aceptada' });

  const msJustUnder24h = new Date('2026-12-19T22:31:00').getTime(); // 23h 59m remaining
  const failRes = validateRetractSlotBid({
    bid,
    event: ev,
    actorMusicianId: 'mus-1',
    nowMs: msJustUnder24h,
  });
  assert.equal(failRes.allowed, false);

  const msJustOver24h = new Date('2026-12-19T22:29:00').getTime(); // 24h 01m remaining
  const passRes = validateRetractSlotBid({
    bid,
    event: ev,
    actorMusicianId: 'mus-1',
    nowMs: msJustOver24h,
  });
  assert.equal(passRes.allowed, true);
});

test('37. retracts a blocked pendiente_bar bid (>=24h) -> sets retracted=true, frees slot, and allows Musician 2 to bid', () => {
  let events = [makeProposal({ slots: [{ id: 'slot-1', startTime: '20:30', endTime: '21:30', requiredMusicians: 2, status: 'negociando' }] })];
  let bids = [makeBid({ id: 'b1', status: 'pendiente_bar' })];
  const nowFar = new Date('2026-12-01T12:00:00').getTime();

  const ret = applyBidRetractionTransition({
    eventProposals: events,
    slotBids: bids,
    bidId: 'b1',
    actorMusicianId: 'mus-1',
    nowMs: nowFar,
  });
  assert.equal(ret.ok, true);
  assert.equal(ret.updatedBid.retracted, true);
  assert.equal(ret.updatedBid.status, 'rechazada');
  assert.equal(ret.updatedEvent.slots[0].status, 'libre');

  const m2Bid = applyBidSubmissionTransition({
    eventProposals: ret.eventProposals,
    slotBids: ret.slotBids,
    bid: makeBid({ id: 'b2', musicianId: 'mus-2', musicianName: 'Músico Test 2' }),
  });
  assert.equal(m2Bid.ok, true);
});

test('38. retracts a contraoferta_bar bid (>=24h) -> unlocks blocked slot to libre cleanly', () => {
  const ev = makeProposal({ slots: [{ id: 'slot-1', startTime: '20:30', endTime: '21:30', requiredMusicians: 2, status: 'negociando' }] });
  const bid = makeBid({ id: 'b1', status: 'contraoferta_bar', proposedCachetARS: 55000 });
  const ret = applyBidRetractionTransition({
    eventProposals: [ev],
    slotBids: [bid],
    bidId: 'b1',
    actorMusicianId: 'mus-1',
    nowMs: new Date('2026-12-01T12:00:00').getTime(),
  });
  assert.equal(ret.ok, true);
  assert.equal(ret.updatedEvent.slots[0].status, 'libre');
  assert.equal(getSlotDisplayState({ proposal: ret.updatedEvent, slot: ret.updatedEvent.slots[0], slotBids: ret.slotBids, viewerRole: 'musico', viewerMusicianId: 'mus-2' }).canBid, true);
});

test('39. retracts Musician 2 contraoferta_musico bid (>=24h) -> opens Bar 2 slot for Musician 1', () => {
  const ev = makeBar2Proposal({ slots: [{ id: 'b2-slot-1', startTime: '21:00', endTime: '22:15', requiredMusicians: 2, status: 'negociando' }] });
  const bid = makeBid({ id: 'b-m2', eventId: ev.id, slotId: 'b2-slot-1', musicianId: 'mus-2', musicianName: 'Músico Test 2', status: 'contraoferta_musico', proposedCachetARS: 75000 });
  const ret = applyBidRetractionTransition({
    eventProposals: [ev],
    slotBids: [bid],
    bidId: 'b-m2',
    actorMusicianId: 'mus-2',
    nowMs: new Date('2026-12-01T12:00:00').getTime(),
  });
  assert.equal(ret.ok, true);
  assert.equal(ret.updatedEvent.slots[0].status, 'libre');
});

test('40. retracts ONLY accepted slot on para_publicar -> clears assigned musician, frees slot, and reverts event to propuesta', () => {
  const ev = makeProposal({
    status: 'para_publicar',
    slots: [
      { id: 'slot-1', startTime: '20:30', endTime: '21:30', requiredMusicians: 2, status: 'confirmado', assignedMusicianId: 'mus-1', assignedMusicianName: 'Músico Test 1', agreedCachetARS: 60000 },
      { id: 'slot-2', startTime: '21:30', endTime: '22:30', requiredMusicians: 2, status: 'libre' },
    ],
  });
  const bid = makeBid({ id: 'b1', status: 'aceptada' });

  const ret = applyBidRetractionTransition({
    eventProposals: [ev],
    slotBids: [bid],
    bidId: 'b1',
    actorMusicianId: 'mus-1',
    nowMs: new Date('2026-12-01T12:00:00').getTime(),
  });
  assert.equal(ret.ok, true);
  assert.equal(ret.updatedBid.retracted, true);
  assert.equal(ret.updatedBid.status, 'rechazada');
  assert.equal(ret.updatedEvent.status, 'propuesta');
  assert.equal(ret.updatedEvent.slots[0].status, 'libre');
  assert.equal(ret.updatedEvent.slots[0].assignedMusicianId, undefined);
  assert.equal(ret.updatedEvent.slots[0].assignedMusicianName, undefined);
  assert.equal(ret.updatedEvent.slots[0].agreedCachetARS, undefined);
});

test('41. retracts one accepted slot on para_publicar while Musician 2 remains confirmed -> keeps para_publicar and Slot 2 intact', () => {
  const ev = makeProposal({
    status: 'para_publicar',
    slots: [
      { id: 'slot-1', startTime: '20:30', endTime: '21:30', requiredMusicians: 2, status: 'confirmado', assignedMusicianId: 'mus-1', assignedMusicianName: 'Músico Test 1', agreedCachetARS: 60000 },
      { id: 'slot-2', startTime: '21:30', endTime: '22:30', requiredMusicians: 2, status: 'confirmado', assignedMusicianId: 'mus-2', assignedMusicianName: 'Músico Test 2', agreedCachetARS: 65000 },
    ],
  });
  const bid1 = makeBid({ id: 'b1', slotId: 'slot-1', musicianId: 'mus-1', status: 'aceptada' });
  const bid2 = makeBid({ id: 'b2', slotId: 'slot-2', musicianId: 'mus-2', musicianName: 'Músico Test 2', status: 'aceptada', proposedCachetARS: 65000 });

  const ret = applyBidRetractionTransition({
    eventProposals: [ev],
    slotBids: [bid1, bid2],
    bidId: 'b1',
    actorMusicianId: 'mus-1',
    nowMs: new Date('2026-12-01T12:00:00').getTime(),
  });
  assert.equal(ret.ok, true);
  assert.equal(ret.updatedEvent.status, 'para_publicar');
  assert.equal(ret.updatedEvent.slots[0].status, 'libre');
  assert.equal(ret.updatedEvent.slots[0].assignedMusicianId, undefined);
  assert.equal(ret.updatedEvent.slots[1].status, 'confirmado');
  assert.equal(ret.updatedEvent.slots[1].assignedMusicianId, 'mus-2');
});

test('42. retracts ONLY accepted slot on publicada event -> reverts publicada back to propuesta and reopens event to Convocatorias', () => {
  const ev = makeProposal({
    status: 'publicada',
    slots: [
      { id: 'slot-1', startTime: '20:30', endTime: '21:30', requiredMusicians: 2, status: 'confirmado', assignedMusicianId: 'mus-1', assignedMusicianName: 'Músico Test 1', agreedCachetARS: 60000 },
    ],
  });
  const bid = makeBid({ id: 'b1', status: 'aceptada' });

  const ret = applyBidRetractionTransition({
    eventProposals: [ev],
    slotBids: [bid],
    bidId: 'b1',
    actorMusicianId: 'mus-1',
    nowMs: new Date('2026-12-01T12:00:00').getTime(),
  });
  assert.equal(ret.ok, true);
  assert.equal(ret.updatedEvent.status, 'propuesta');
  assert.equal(ret.updatedEvent.slots[0].status, 'libre');
  assert.equal(
    isEventVisibleInConvocatorias({
      proposal: ret.updatedEvent,
      role: 'musico',
      slotBids: ret.slotBids,
      musicianId: 'mus-2',
    }),
    true
  );
});

test('43. retracts Musician 2 accepted slot on publicada event when Musician 1 remains confirmed -> stays publicada with Slot 1 confirmed', () => {
  const ev = makeProposal({
    status: 'publicada',
    slots: [
      { id: 'slot-1', startTime: '20:30', endTime: '21:30', requiredMusicians: 2, status: 'confirmado', assignedMusicianId: 'mus-1', assignedMusicianName: 'Músico Test 1', agreedCachetARS: 60000 },
      { id: 'slot-2', startTime: '21:30', endTime: '22:30', requiredMusicians: 2, status: 'confirmado', assignedMusicianId: 'mus-2', assignedMusicianName: 'Músico Test 2', agreedCachetARS: 70000 },
    ],
  });
  const bid1 = makeBid({ id: 'b1', slotId: 'slot-1', musicianId: 'mus-1', status: 'aceptada' });
  const bid2 = makeBid({ id: 'b2', slotId: 'slot-2', musicianId: 'mus-2', musicianName: 'Músico Test 2', status: 'aceptada' });

  const ret = applyBidRetractionTransition({
    eventProposals: [ev],
    slotBids: [bid1, bid2],
    bidId: 'b2',
    actorMusicianId: 'mus-2',
    nowMs: new Date('2026-12-01T12:00:00').getTime(),
  });
  assert.equal(ret.ok, true);
  assert.equal(ret.updatedEvent.status, 'publicada');
  assert.equal(ret.updatedEvent.slots[0].status, 'confirmado');
  assert.equal(ret.updatedEvent.slots[0].assignedMusicianId, 'mus-1');
  assert.equal(ret.updatedEvent.slots[1].status, 'libre');
  assert.equal(ret.updatedEvent.slots[1].assignedMusicianId, undefined);
});

test('44. blocks retraction on accepted bid when <24h remain and keeps slot + event intact', () => {
  const ev = makeProposal({
    date: '2026-12-20',
    status: 'para_publicar',
    slots: [
      { id: 'slot-1', startTime: '20:30', endTime: '21:30', requiredMusicians: 2, status: 'confirmado', assignedMusicianId: 'mus-1', assignedMusicianName: 'Músico Test 1', agreedCachetARS: 60000 },
    ],
  });
  const bid = makeBid({ id: 'b1', status: 'aceptada' });
  const ret = applyBidRetractionTransition({
    eventProposals: [ev],
    slotBids: [bid],
    bidId: 'b1',
    actorMusicianId: 'mus-1',
    nowMs: new Date('2026-12-20T10:00:00').getTime(), // only 10.5h left
  });
  assert.equal(ret.ok, false);
});

test('45. rejects double retraction and retraction on a cancelled event', () => {
  const evActive = makeProposal();
  const evCancelled = makeProposal({ status: 'cancelada' });
  const retractedBid = makeBid({ status: 'rechazada', retracted: true });
  const activeBid = makeBid({ status: 'pendiente_bar' });
  const nowFar = new Date('2026-12-01T12:00:00').getTime();

  assert.equal(
    applyBidRetractionTransition({
      eventProposals: [evActive],
      slotBids: [retractedBid],
      bidId: retractedBid.id,
      actorMusicianId: 'mus-1',
      nowMs: nowFar,
    }).ok,
    false
  );
  assert.equal(
    applyBidRetractionTransition({
      eventProposals: [evCancelled],
      slotBids: [activeBid],
      bidId: activeBid.id,
      actorMusicianId: 'mus-1',
      nowMs: nowFar,
    }).ok,
    false
  );
});

test('46. end-to-end handover: Mus 1 wins Bar 1 slot -> retracts accepted -> Mus 2 bids, negotiates counteroffer, and wins Bar 1 slot', () => {
  let events = [makeProposal()];
  let bids: MusicianSlotBid[] = [];
  const nowFar = new Date('2026-12-01T12:00:00').getTime();

  // 1. Mus 1 submits
  const s1 = applyBidSubmissionTransition({
    eventProposals: events,
    slotBids: bids,
    bid: makeBid({ id: 'b-m1', slotId: 'slot-1', musicianId: 'mus-1', proposedCachetARS: 60000 }),
  });
  assert.equal(s1.ok, true);
  events = s1.eventProposals;
  bids = s1.slotBids;

  // 2. Bar 1 accepts
  const a1 = applyBidResponseTransition({
    eventProposals: events,
    slotBids: bids,
    bidId: 'b-m1',
    actorRole: 'bar',
    actorEntityId: 'venue-1',
    action: 'accept',
  });
  assert.equal(a1.ok, true);
  events = a1.eventProposals;
  bids = a1.slotBids;
  assert.equal(events[0].status, 'para_publicar');

  // 3. Mus 1 retracts accepted bid >= 24h before show
  const r1 = applyBidRetractionTransition({
    eventProposals: events,
    slotBids: bids,
    bidId: 'b-m1',
    actorMusicianId: 'mus-1',
    nowMs: nowFar,
  });
  assert.equal(r1.ok, true);
  events = r1.eventProposals;
  bids = r1.slotBids;
  assert.equal(events[0].status, 'propuesta');
  assert.equal(events[0].slots[0].status, 'libre');

  // 4. Mus 2 immediately bids on recovered Slot 1
  const s2 = applyBidSubmissionTransition({
    eventProposals: events,
    slotBids: bids,
    bid: makeBid({ id: 'b-m2', slotId: 'slot-1', musicianId: 'mus-2', musicianName: 'Músico Test 2', proposedCachetARS: 68000 }),
  });
  assert.equal(s2.ok, true);
  events = s2.eventProposals;
  bids = s2.slotBids;

  // 5. Bar 1 counters 62k -> Mus 2 accepts 62k
  const c2 = applyBidResponseTransition({
    eventProposals: events,
    slotBids: bids,
    bidId: 'b-m2',
    actorRole: 'bar',
    actorEntityId: 'venue-1',
    action: 'counter',
    counterCachet: 62000,
  });
  assert.equal(c2.ok, true);
  bids = c2.slotBids;

  const a2 = applyBidResponseTransition({
    eventProposals: events,
    slotBids: bids,
    bidId: 'b-m2',
    actorRole: 'musico',
    actorEntityId: 'mus-2',
    action: 'accept',
  });
  assert.equal(a2.ok, true);
  assert.equal(a2.updatedEvent?.status, 'para_publicar');
  assert.equal(a2.updatedEvent?.slots[0].status, 'confirmado');
  assert.equal(a2.updatedEvent?.slots[0].assignedMusicianId, 'mus-2');
  assert.equal(a2.updatedEvent?.slots[0].agreedCachetARS, 62000);
});

test('47. allows a_la_gorra bid submission with proposedCachetARS: 0 while rejecting fijo with 0', () => {
  const ev = makeProposal({ cachetType: 'fijo', baseCachetARS: 70000 });

  const failFijo = applyBidSubmissionTransition({
    eventProposals: [ev],
    slotBids: [],
    bid: makeBid({ id: 'b-fijo-0', cachetType: 'fijo', proposedCachetARS: 0 }),
  });
  assert.equal(failFijo.ok, false);

  const okGorra = applyBidSubmissionTransition({
    eventProposals: [ev],
    slotBids: [],
    bid: makeBid({ id: 'b-gorra', cachetType: 'a_la_gorra', proposedCachetARS: 99999, musiciansCount: 1 }),
  });
  assert.equal(okGorra.ok, true);
  assert.equal(okGorra.newBid.cachetType, 'a_la_gorra');
  assert.equal(okGorra.newBid.proposedCachetARS, 0);
  assert.equal(okGorra.newBid.musiciansCount, 1);
});

test('48. Bar and Musician can switch between fijo and a_la_gorra in counteroffers and accept preserves agreedCachetType', () => {
  const ev = makeProposal({ cachetType: 'fijo', baseCachetARS: 70000 });
  const initBid = makeBid({ id: 'b-switch', proposedCachetARS: 80000, cachetType: 'fijo', musiciansCount: 2 });

  const s = applyBidSubmissionTransition({ eventProposals: [ev], slotBids: [], bid: initBid });
  assert.equal(s.ok, true);

  // Bar counters with a_la_gorra
  const barCounter = applyBidResponseTransition({
    eventProposals: s.eventProposals,
    slotBids: s.slotBids,
    bidId: 'b-switch',
    actorRole: 'bar',
    actorEntityId: 'venue-1',
    action: 'counter',
    counterCachetType: 'a_la_gorra',
  });
  assert.equal(barCounter.ok, true);
  assert.equal(barCounter.updatedBid.cachetType, 'a_la_gorra');
  assert.equal(barCounter.updatedBid.proposedCachetARS, 0);
  assert.equal(barCounter.updatedBid.status, 'contraoferta_bar');

  // Musician counters back with fijo 75000 AND updates musiciansCount to 3
  const musCounter = applyBidResponseTransition({
    eventProposals: barCounter.eventProposals,
    slotBids: barCounter.slotBids,
    bidId: 'b-switch',
    actorRole: 'musico',
    actorEntityId: 'mus-1',
    action: 'counter',
    counterCachetType: 'fijo',
    counterCachet: 75000,
    counterMusiciansCount: 3,
  });
  assert.equal(musCounter.ok, true);
  assert.equal(musCounter.updatedBid.cachetType, 'fijo');
  assert.equal(musCounter.updatedBid.proposedCachetARS, 75000);
  assert.equal(musCounter.updatedBid.musiciansCount, 3);
  assert.equal(musCounter.updatedBid.status, 'contraoferta_musico');

  // Bar counters back with a_la_gorra and Musician accepts
  const barCounter2 = applyBidResponseTransition({
    eventProposals: musCounter.eventProposals,
    slotBids: musCounter.slotBids,
    bidId: 'b-switch',
    actorRole: 'bar',
    actorEntityId: 'venue-1',
    action: 'counter',
    counterCachetType: 'a_la_gorra',
  });
  assert.equal(barCounter2.ok, true);

  const musAccept = applyBidResponseTransition({
    eventProposals: barCounter2.eventProposals,
    slotBids: barCounter2.slotBids,
    bidId: 'b-switch',
    actorRole: 'musico',
    actorEntityId: 'mus-1',
    action: 'accept',
  });
  assert.equal(musAccept.ok, true);
  assert.equal(musAccept.updatedEvent?.slots[0].status, 'confirmado');
  assert.equal(musAccept.updatedEvent?.slots[0].agreedCachetARS, 0);
  assert.equal(musAccept.updatedEvent?.slots[0].agreedCachetType, 'a_la_gorra');
});

test('49. rejects invalid counterMusiciansCount (<1 or >30) during musician counteroffer', () => {
  const ev = makeProposal();
  const bid = makeBid({ id: 'b-count', status: 'contraoferta_bar' });
  const badLow = validateRespondToSlotBid({
    bid,
    event: ev,
    allSlotBids: [bid],
    actorRole: 'musico',
    actorEntityId: 'mus-1',
    action: 'counter',
    counterCachet: 70000,
    counterMusiciansCount: 0,
  });
  assert.equal(badLow.allowed, false);

  const badHigh = validateRespondToSlotBid({
    bid,
    event: ev,
    allSlotBids: [bid],
    actorRole: 'musico',
    actorEntityId: 'mus-1',
    action: 'counter',
    counterCachet: 70000,
    counterMusiciansCount: 31,
  });
  assert.equal(badHigh.allowed, false);
});

test('50. Bar viewerRole never sets isLockedByViewer or wasPreviouslyRejectedForViewer even if viewerMusicianId is provided', () => {
  const ev = makeProposal({
    slots: [
      { id: 'slot-1', startTime: '20:30', endTime: '21:30', requiredMusicians: 2, status: 'negociando' },
      { id: 'slot-2', startTime: '21:30', endTime: '22:30', requiredMusicians: 2, status: 'libre' },
    ],
  });
  const activeBid = makeBid({ id: 'b-active', slotId: 'slot-1', musicianId: 'mus-1', status: 'pendiente_bar' });
  const rejectedBid = makeBid({ id: 'b-rej', slotId: 'slot-2', musicianId: 'mus-1', status: 'rechazada' });

  const slot1ForBar = getSlotDisplayState({
    proposal: ev,
    slot: ev.slots[0],
    slotBids: [activeBid, rejectedBid],
    viewerRole: 'bar',
    viewerMusicianId: 'mus-1',
  });
  assert.equal(slot1ForBar.availability, 'bloqueado');
  assert.equal(slot1ForBar.isLockedByViewer, false);
  assert.equal(slot1ForBar.wasPreviouslyRejectedForViewer, false);

  const slot2ForBar = getSlotDisplayState({
    proposal: ev,
    slot: ev.slots[1],
    slotBids: [activeBid, rejectedBid],
    viewerRole: 'bar',
    viewerMusicianId: 'mus-1',
  });
  assert.equal(slot2ForBar.availability, 'libre');
  assert.equal(slot2ForBar.isLockedByViewer, false);
  assert.equal(slot2ForBar.wasPreviouslyRejectedForViewer, false);
});

test('51. accepting one bid on a slot auto-rejects any competing active sibling bids on the same slot', () => {
  const ev = makeProposal({
    slots: [{ id: 'slot-1', startTime: '20:30', endTime: '21:30', requiredMusicians: 2, status: 'negociando' }],
  });
  const bid1 = makeBid({ id: 'b-1', slotId: 'slot-1', musicianId: 'mus-1', status: 'contraoferta_musico', proposedCachetARS: 80000 });
  const bid2 = makeBid({ id: 'b-2', slotId: 'slot-1', musicianId: 'mus-2', musicianName: 'Músico Test 2', status: 'pendiente_bar', proposedCachetARS: 75000 });

  const res = applyBidResponseTransition({
    eventProposals: [ev],
    slotBids: [bid1, bid2],
    bidId: 'b-1',
    actorRole: 'bar',
    actorEntityId: 'venue-1',
    action: 'accept',
  });
  assert.equal(res.ok, true);
  assert.equal(res.updatedBid.status, 'aceptada');
  assert.equal(res.autoRejectedBids.length, 1);
  assert.equal(res.autoRejectedBids[0].id, 'b-2');
  assert.equal(res.autoRejectedBids[0].status, 'rechazada');
  assert.equal(res.slotBids.find((b) => b.id === 'b-2')?.status, 'rechazada');
  assert.equal(res.updatedEvent?.slots[0].status, 'confirmado');
});

test('52. applyPublishEventTransition closes unaccepted active bids on publish and resets unconfirmed negociando slots to libre', () => {
  const ev = makeProposal({
    id: 'ev-pub-cleanup',
    status: 'para_publicar',
    slots: [
      {
        id: 'slot-1',
        startTime: '20:30',
        endTime: '21:30',
        requiredMusicians: 2,
        status: 'confirmado',
        assignedMusicianId: 'mus-1',
        assignedMusicianName: 'Músico Test 1',
        agreedCachetARS: 60000,
      },
      { id: 'slot-2', startTime: '21:30', endTime: '22:30', requiredMusicians: 2, status: 'negociando' },
      { id: 'slot-3', startTime: '22:30', endTime: '23:30', requiredMusicians: 2, status: 'negociando' },
    ],
  });
  const otherEv = makeBar2Proposal({ id: 'ev-other' });

  const bids: MusicianSlotBid[] = [
    makeBid({ id: 'b-acc', eventId: 'ev-pub-cleanup', slotId: 'slot-1', musicianId: 'mus-1', status: 'aceptada' }),
    makeBid({ id: 'b-pend', eventId: 'ev-pub-cleanup', slotId: 'slot-2', musicianId: 'mus-2', status: 'pendiente_bar' }),
    makeBid({ id: 'b-ctr', eventId: 'ev-pub-cleanup', slotId: 'slot-3', musicianId: 'mus-3', status: 'contraoferta_bar' }),
    makeBid({ id: 'b-other', eventId: 'ev-other', slotId: 'b2-slot-1', musicianId: 'mus-2', status: 'pendiente_bar' }),
  ];

  const pubRes = applyPublishEventTransition({
    eventProposals: [ev, otherEv],
    slotBids: bids,
    eventId: 'ev-pub-cleanup',
    nowIso: '2026-12-01T12:00:00.000Z',
    historyIdPrefix: 'h-test',
  });

  assert.equal(pubRes.ok, true);
  assert.equal(pubRes.updatedEvent.status, 'publicada');
  assert.equal(pubRes.updatedEvent.slots[0].status, 'confirmado');
  assert.equal(pubRes.updatedEvent.slots[1].status, 'libre');
  assert.equal(pubRes.updatedEvent.slots[2].status, 'libre');
  assert.equal(pubRes.closedBids.length, 2);
  assert.equal(pubRes.slotBids.find((b) => b.id === 'b-acc')?.status, 'aceptada');
  assert.equal(pubRes.slotBids.find((b) => b.id === 'b-pend')?.status, 'rechazada');
  assert.equal(pubRes.slotBids.find((b) => b.id === 'b-ctr')?.status, 'rechazada');
  // Bids belonging to other events remain untouched
  assert.equal(pubRes.slotBids.find((b) => b.id === 'b-other')?.status, 'pendiente_bar');

  // Cannot publish without at least one confirmed slot
  const noConfRes = applyPublishEventTransition({
    eventProposals: [makeProposal({ id: 'ev-no-conf' })],
    slotBids: [],
    eventId: 'ev-no-conf',
  });
  assert.equal(noConfRes.ok, false);
});



