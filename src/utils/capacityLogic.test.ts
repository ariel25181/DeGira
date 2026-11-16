import test from 'node:test';
import assert from 'node:assert/strict';
import type { EventProposal } from '../types/index.ts';
import {
  applyPaymentConfirmationToEvent,
  restoreCapacityOnReservationRelease,
} from './capacityLogic.ts';

function makeEvent(overrides: Partial<EventProposal> = {}): EventProposal {
  return {
    id: 'ev-cap-1',
    venueId: 'venue-1',
    venueName: 'Bar Test 1',
    venueAddress: 'Honduras 4800',
    venueNeighborhood: 'Palermo Soho',
    venuePhoto: '',
    title: 'Show Test',
    date: '2026-11-28',
    startTime: '21:00',
    endTime: '23:30',
    totalCapacity: 80,
    remainingCapacity: 80,
    baseCachetARS: 70000,
    ticketPriceARS: 8000,
    targetGenres: ['Jazz'],
    slots: [],
    rider: {
      stageSize: '6x4m',
      soundSystem: 'PA',
      micCount: 4,
      backline: [],
      lighting: 'LED',
    },
    status: 'publicada',
    eventCode: 'DG-TEST-80',
    createdAt: '2026-11-01',
    ...overrides,
  };
}

test('applyPaymentConfirmationToEvent decrements remainingCapacity when confirming comprobante_subido', () => {
  const ev = makeEvent({ totalCapacity: 80, remainingCapacity: 80 });
  const updated = applyPaymentConfirmationToEvent(ev, 4, 'comprobante_subido');
  assert.equal(updated.remainingCapacity, 76);
  assert.equal(updated.status, 'publicada');
});

test('applyPaymentConfirmationToEvent flips event status to agotada when remainingCapacity hits 0', () => {
  const ev = makeEvent({ totalCapacity: 80, remainingCapacity: 3 });
  const updated = applyPaymentConfirmationToEvent(ev, 5, 'comprobante_subido');
  assert.equal(updated.remainingCapacity, 0);
  assert.equal(updated.status, 'agotada');
});

test('applyPaymentConfirmationToEvent is idempotent if reservation is already confirmada', () => {
  const ev = makeEvent({ totalCapacity: 80, remainingCapacity: 76 });
  const updated = applyPaymentConfirmationToEvent(ev, 4, 'confirmada');
  assert.equal(updated.remainingCapacity, 76);
  assert.equal(updated.status, 'publicada');
});

test('restoreCapacityOnReservationRelease does NOT inflate capacity when unconfirmed reservation expires or is rejected', () => {
  const evAfterConfirmed = makeEvent({ totalCapacity: 80, remainingCapacity: 76 });
  const afterPendingExpired = restoreCapacityOnReservationRelease(evAfterConfirmed, 4, 'pendiente_pago');
  assert.equal(afterPendingExpired.remainingCapacity, 76);

  const afterReceiptRejected = restoreCapacityOnReservationRelease(evAfterConfirmed, 4, 'comprobante_subido');
  assert.equal(afterReceiptRejected.remainingCapacity, 76);
});

test('restoreCapacityOnReservationRelease restores seats and flips agotada back to publicada only when confirmed reservation releases', () => {
  const soldOut = makeEvent({ totalCapacity: 80, remainingCapacity: 0, status: 'agotada' });
  const restored = restoreCapacityOnReservationRelease(soldOut, 4, 'confirmada');
  assert.equal(restored.remainingCapacity, 4);
  assert.equal(restored.status, 'publicada');
});
