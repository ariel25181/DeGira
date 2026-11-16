import type { EventProposal, PublicEventReservation } from '../types/index.ts';

/**
 * Pure capacity & status transition when a Bar confirms payment for a reservation.
 * Guarded for idempotency: if reservation is already 'confirmada', returns event unchanged.
 */
export function applyPaymentConfirmationToEvent(
  event: EventProposal,
  partySize: number,
  previousStatus: PublicEventReservation['status']
): EventProposal {
  if (previousStatus === 'confirmada' || partySize <= 0) {
    return event;
  }

  const newRemaining = Math.max(0, event.remainingCapacity - partySize);
  const nextStatus =
    newRemaining === 0 && event.status !== 'cancelada'
      ? ('agotada' as const)
      : event.status;

  return {
    ...event,
    remainingCapacity: newRemaining,
    status: nextStatus,
  };
}

/**
 * Pure capacity & status transition when a reservation is cancelled, rejected, or expires.
 * Only restores seats if they had actually been deducted previously (i.e. previousStatus === 'confirmada'),
 * preventing unconfirmed reservations from inflating remainingCapacity above actual free seats.
 */
export function restoreCapacityOnReservationRelease(
  event: EventProposal,
  partySize: number,
  previousStatus: PublicEventReservation['status']
): EventProposal {
  if (previousStatus !== 'confirmada' || partySize <= 0) {
    return event;
  }

  const restored = Math.min(event.totalCapacity, event.remainingCapacity + partySize);
  const nextStatus =
    event.status === 'agotada' && restored > 0
      ? ('publicada' as const)
      : event.status;

  return {
    ...event,
    remainingCapacity: restored,
    status: nextStatus,
  };
}
