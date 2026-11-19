import test from 'node:test';
import assert from 'node:assert/strict';
import { EventProposal, MusicianSlotBid } from '../types/index.ts';
import {
  applySlotAcceptToProposal,
  applySlotReleaseToProposal,
  canSubmitBidForSlot,
  getSlotDisplayState,
  isBidVisibleToViewer,
  isEventVisibleInConvocatorias,
} from './slotBidding.ts';

function makeFourSlotProposal(overrides: Partial<EventProposal> = {}): EventProposal {
  return {
    id: 'ev-ronda',
    venueId: 'venue-1',
    venueName: 'El templo de Palermo',
    venueAddress: 'Nicaragua 5549',
    venueNeighborhood: 'Palermo Hollywood',
    venuePhoto: 'https://example.com/photo.jpg',
    title: 'Ronda de canciones',
    date: '2026-11-22',
    startTime: '20:30',
    endTime: '01:00',
    totalCapacity: 80,
    remainingCapacity: 80,
    baseCachetARS: 50000,
    ticketPriceARS: 5000,
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

function makeBid(overrides: Partial<MusicianSlotBid> = {}): MusicianSlotBid {
  return {
    id: 'bid-1',
    eventId: 'ev-ronda',
    slotId: 'slot-1',
    musicianId: 'mus-1',
    musicianName: 'Músico Test 1',
    musicianAvatar: '',
    proposedCachetARS: 50000,
    musiciansCount: 2,
    equipmentProvided: 'Guitarras',
    equipmentNeeded: 'Micrófono',
    status: 'pendiente_bar',
    history: [],
    createdAt: '2026-11-18T13:00:00.000Z',
    ...overrides,
  };
}

test('locks a slot once musician1 submits a proposal and blocks duplicate bids on that same slot', () => {
  const proposal = makeFourSlotProposal({
    slots: [
      { id: 'slot-1', startTime: '20:30', endTime: '21:30', requiredMusicians: 2, status: 'negociando' },
      { id: 'slot-2', startTime: '21:30', endTime: '22:30', requiredMusicians: 2, status: 'libre' },
      { id: 'slot-3', startTime: '22:30', endTime: '23:30', requiredMusicians: 2, status: 'libre' },
      { id: 'slot-4', startTime: '23:30', endTime: '00:30', requiredMusicians: 2, status: 'libre' },
    ],
  });
  const activeBid = makeBid({ slotId: 'slot-1', musicianId: 'mus-1', status: 'pendiente_bar' });

  // Slot 1 is blocked for mus-1 and mus-2
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

  // Slots 2, 3, 4 remain free for mus-1 and mus-2
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

test('reopens slot as libre for bar, musician1, and other musicians when proposal is rejected', () => {
  const proposal = makeFourSlotProposal({
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

test('keeps event visible to other musicians with remaining open slots even after one slot is accepted (para_publicar)', () => {
  const initialProposal = makeFourSlotProposal();
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

  // Other musician (mus-2) MUST still see the event because slots 2, 3, 4 are open!
  assert.equal(
    isEventVisibleInConvocatorias({
      proposal: updated,
      role: 'musico',
      slotBids: [acceptedBid],
      musicianId: 'mus-2',
    }),
    true
  );

  // Slot 1 is confirmed/locked, Slots 2-4 are open to bid for mus-2
  const slot1State = getSlotDisplayState({
    proposal: updated,
    slot: updated.slots[0],
    slotBids: [acceptedBid],
    viewerRole: 'musico',
    viewerMusicianId: 'mus-2',
  });
  assert.equal(slot1State.availability, 'confirmado');
  assert.equal(slot1State.canBid, false);

  const slot2State = getSlotDisplayState({
    proposal: updated,
    slot: updated.slots[1],
    slotBids: [acceptedBid],
    viewerRole: 'musico',
    viewerMusicianId: 'mus-2',
  });
  assert.equal(slot2State.availability, 'libre');
  assert.equal(slot2State.canBid, true);

  // Once all 4 slots are confirmed, event hides from open calls for unrelated musicians
  let allConfirmed = updated;
  for (const sId of ['slot-2', 'slot-3', 'slot-4']) {
    allConfirmed = applySlotAcceptToProposal(allConfirmed, {
      slotId: sId,
      musicianId: 'mus-2',
      musicianName: 'Músico Test 2',
      proposedCachetARS: 50000,
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

test('scopes negotiation bid cards so musicians only see their own bids while bars see all bids', () => {
  const bidMus1 = makeBid({ id: 'bid-1', musicianId: 'mus-1' });
  const bidMus2 = makeBid({ id: 'bid-2', musicianId: 'mus-2', slotId: 'slot-2' });

  assert.equal(isBidVisibleToViewer({ bid: bidMus1, viewerRole: 'musico', viewerMusicianId: 'mus-1' }), true);
  assert.equal(isBidVisibleToViewer({ bid: bidMus2, viewerRole: 'musico', viewerMusicianId: 'mus-1' }), false);
  assert.equal(isBidVisibleToViewer({ bid: bidMus1, viewerRole: 'bar' }), true);
  assert.equal(isBidVisibleToViewer({ bid: bidMus2, viewerRole: 'bar' }), true);
});
