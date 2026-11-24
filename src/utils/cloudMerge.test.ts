import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeSlotBidsMonotonic, mergeEventProposalsMonotonic } from './cloudMerge.ts';
import type { EventProposal, MusicianSlotBid } from '../types/index.ts';

function makeProposal(overrides: Partial<EventProposal> = {}): EventProposal {
  return {
    id: 'ev-subasta',
    venueId: 'venue-subasta',
    venueName: 'La Subasta',
    venueAddress: 'Rivadavia 4500',
    venueNeighborhood: 'Almagro',
    venuePhoto: '',
    title: 'Noche de cantautores',
    date: '2026-11-29',
    startTime: '21:00',
    endTime: '23:15',
    totalCapacity: 80,
    remainingCapacity: 80,
    baseCachetARS: 70000,
    targetGenres: ['Folklore'],
    slots: [
      { id: 'slot-1', startTime: '21:00', endTime: '22:00', requiredMusicians: 2, status: 'libre' },
      { id: 'slot-2', startTime: '22:00', endTime: '23:15', requiredMusicians: 3, status: 'negociando' },
    ],
    rider: { stageSize: '5x4', soundSystem: 'Consola 12ch', micCount: 4, backline: [], lighting: 'LED' },
    status: 'propuesta',
    eventCode: 'DG-BAR-8398',
    createdAt: '2026-11-22T18:00:00.000Z',
    ...overrides,
  };
}

function makeBid(overrides: Partial<MusicianSlotBid> = {}): MusicianSlotBid {
  return {
    id: 'bid-subasta',
    eventId: 'ev-subasta',
    slotId: 'slot-2',
    musicianId: 'mus-1',
    musicianName: 'Músico Test 1',
    musicianAvatar: '',
    proposedCachetARS: 80000,
    musiciansCount: 1,
    equipmentProvided: 'Guitarra',
    equipmentNeeded: 'Batería',
    status: 'pendiente_bar',
    history: [
      { id: 'h1', actor: 'musico', actorName: 'Músico Test 1', cachetARS: 80000, note: 'Postulación', createdAt: '2026-11-22T18:10:00.000Z' },
    ],
    createdAt: '2026-11-22T18:10:00.000Z',
    ...overrides,
  };
}

test('mergeSlotBidsMonotonic prevents stale non-terminal cloud snapshot from reverting accepted or rejected bid', () => {
  const localAccepted = makeBid({
    status: 'aceptada',
    history: [
      { id: 'h1', actor: 'musico', actorName: 'Músico Test 1', cachetARS: 80000, note: 'Postulación', createdAt: '2026-11-22T18:10:00.000Z' },
      { id: 'h2', actor: 'bar', actorName: 'La Subasta', cachetARS: 80000, note: 'Aceptada', createdAt: '2026-11-22T19:32:00.000Z' },
    ],
  });
  const staleCloudPending = makeBid({ status: 'contraoferta_musico' });

  const merged = mergeSlotBidsMonotonic([localAccepted], [staleCloudPending]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].status, 'aceptada');
  assert.equal(merged[0].history.length, 2);

  // Conversely, when cloud has accepted and local was still contraoferta_musico, cloud wins
  const mergedFromCloud = mergeSlotBidsMonotonic([staleCloudPending], [localAccepted]);
  assert.equal(mergedFromCloud[0].status, 'aceptada');
});

test('mergeSlotBidsMonotonic picks newer active ping-pong round by history length', () => {
  const r1 = makeBid({ status: 'contraoferta_bar', proposedCachetARS: 75000 });
  const r2 = makeBid({
    status: 'contraoferta_musico',
    proposedCachetARS: 80000,
    history: [
      ...r1.history,
      { id: 'h2', actor: 'bar', actorName: 'La Subasta', cachetARS: 75000, note: 'Counter bar', createdAt: '2026-11-22T18:20:00.000Z' },
      { id: 'h3', actor: 'musico', actorName: 'Músico Test 1', cachetARS: 80000, note: 'Counter mus', createdAt: '2026-11-22T18:30:00.000Z' },
    ],
  });

  assert.equal(mergeSlotBidsMonotonic([r2], [r1])[0].status, 'contraoferta_musico');
  assert.equal(mergeSlotBidsMonotonic([r1], [r2])[0].status, 'contraoferta_musico');
});

test('mergeEventProposalsMonotonic keeps accepted slot confirmado and para_publicar against stale cloud propuesta', () => {
  const acceptedBid = makeBid({ status: 'aceptada', proposedCachetARS: 80000 });
  const localEv = makeProposal({
    status: 'para_publicar',
    slots: [
      { id: 'slot-1', startTime: '21:00', endTime: '22:00', requiredMusicians: 2, status: 'libre' },
      {
        id: 'slot-2',
        startTime: '22:00',
        endTime: '23:15',
        requiredMusicians: 3,
        status: 'confirmado',
        assignedMusicianId: 'mus-1',
        assignedMusicianName: 'Músico Test 1',
        agreedCachetARS: 80000,
      },
    ],
  });
  const staleCloudEv = makeProposal({ status: 'propuesta' });

  const merged = mergeEventProposalsMonotonic([localEv], [staleCloudEv], [acceptedBid]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].status, 'para_publicar');
  assert.equal(merged[0].slots[1].status, 'confirmado');
  assert.equal(merged[0].slots[1].assignedMusicianId, 'mus-1');
  assert.equal(merged[0].slots[1].agreedCachetARS, 80000);
});

test('mergeEventProposalsMonotonic preserves cloud or local confirmado even when slotBids snapshot still has stale active bid', () => {
  const staleActiveBid = makeBid({ status: 'contraoferta_bar', proposedCachetARS: 75000 });
  const confirmedCloudEv = makeProposal({
    status: 'para_publicar',
    slots: [
      { id: 'slot-1', startTime: '21:00', endTime: '22:00', requiredMusicians: 2, status: 'libre' },
      {
        id: 'slot-2',
        startTime: '22:00',
        endTime: '23:15',
        requiredMusicians: 3,
        status: 'confirmado',
        assignedMusicianId: 'mus-1',
        assignedMusicianName: 'Músico Test 1',
        agreedCachetARS: 80000,
      },
    ],
  });
  (confirmedCloudEv as EventProposal & { updatedAtTimestamp?: { seconds: number } }).updatedAtTimestamp = { seconds: 2000 };

  // Cloud event arrives before slotBids reflects 'aceptada' — MUST NOT revert confirmado to negociando
  const mergedCloudFirst = mergeEventProposalsMonotonic([], [confirmedCloudEv], [staleActiveBid]);
  assert.equal(mergedCloudFirst[0].slots[1].status, 'confirmado');
  assert.equal(mergedCloudFirst[0].slots[1].assignedMusicianId, 'mus-1');
  assert.equal(mergedCloudFirst[0].slots[1].agreedCachetARS, 80000);

  // Local optimistic confirmation with equal/newer timestamp also stays confirmado against stale cloud & stale bid
  const staleCloudPendingEv = makeProposal({
    status: 'propuesta',
  });
  (staleCloudPendingEv as EventProposal & { updatedAtTimestamp?: { seconds: number } }).updatedAtTimestamp = { seconds: 1000 };
  const localConfirmedEv = makeProposal({
    ...confirmedCloudEv,
  });
  (localConfirmedEv as EventProposal & { updatedAtTimestamp?: { seconds: number } }).updatedAtTimestamp = { seconds: 1500 };
  const mergedLocalFirst = mergeEventProposalsMonotonic([localConfirmedEv], [staleCloudPendingEv], [staleActiveBid]);
  assert.equal(mergedLocalFirst[0].slots[1].status, 'confirmado');
  assert.equal(mergedLocalFirst[0].slots[1].assignedMusicianName, 'Músico Test 1');
});

test('mergeEventProposalsMonotonic releases slot to libre when assigned musician retracted or was rejected', () => {
  const retractedBid = makeBid({ status: 'rechazada', retracted: true });
  const staleConfirmedCloudEv = makeProposal({
    status: 'para_publicar',
    slots: [
      { id: 'slot-1', startTime: '21:00', endTime: '22:00', requiredMusicians: 2, status: 'libre' },
      {
        id: 'slot-2',
        startTime: '22:00',
        endTime: '23:15',
        requiredMusicians: 3,
        status: 'confirmado',
        assignedMusicianId: 'mus-1',
        assignedMusicianName: 'Músico Test 1',
        agreedCachetARS: 80000,
      },
    ],
  });

  const merged = mergeEventProposalsMonotonic([], [staleConfirmedCloudEv], [retractedBid]);
  assert.equal(merged[0].slots[1].status, 'libre');
  assert.equal(merged[0].slots[1].assignedMusicianId, undefined);
});

