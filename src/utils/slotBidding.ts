import { EventProposal, EventSlot, MusicianSlotBid, UserRole } from '../types/index.ts';

export type SlotAvailability = 'libre' | 'bloqueado' | 'confirmado';

export interface SlotDisplayState {
  availability: SlotAvailability;
  isLocked: boolean;
  canBid: boolean;
  activeBid?: MusicianSlotBid;
  acceptedBid?: MusicianSlotBid;
  isLockedByViewer: boolean;
  wasPreviouslyRejectedForViewer: boolean;
  assignedMusicianId?: string;
  assignedMusicianName?: string;
  agreedCachetARS?: number;
}

export function isActiveSlotBid(bid: Pick<MusicianSlotBid, 'status' | 'retracted'>): boolean {
  return !bid.retracted && bid.status !== 'rechazada';
}

export function getSlotDisplayState(params: {
  proposal: EventProposal;
  slot: EventSlot;
  slotBids: MusicianSlotBid[];
  viewerRole: UserRole;
  viewerMusicianId?: string;
}): SlotDisplayState {
  const { proposal, slot, slotBids, viewerRole, viewerMusicianId } = params;
  const bidsForSlot = slotBids.filter(
    (b) => b.eventId === proposal.id && b.slotId === slot.id
  );

  const acceptedBid = bidsForSlot.find(
    (b) => !b.retracted && b.status === 'aceptada'
  );
  const activeBid = bidsForSlot.find(isActiveSlotBid);

  const isConfirmed =
    slot.status === 'confirmado' ||
    Boolean(slot.assignedMusicianId) ||
    Boolean(acceptedBid);

  if (isConfirmed) {
    return {
      availability: 'confirmado',
      isLocked: true,
      canBid: false,
      activeBid: acceptedBid || activeBid,
      acceptedBid,
      isLockedByViewer: Boolean(
        viewerMusicianId &&
          (slot.assignedMusicianId === viewerMusicianId ||
            acceptedBid?.musicianId === viewerMusicianId)
      ),
      wasPreviouslyRejectedForViewer: false,
      assignedMusicianId: slot.assignedMusicianId || acceptedBid?.musicianId,
      assignedMusicianName: slot.assignedMusicianName || acceptedBid?.musicianName,
      agreedCachetARS: slot.agreedCachetARS ?? acceptedBid?.proposedCachetARS,
    };
  }

  if (activeBid) {
    return {
      availability: 'bloqueado',
      isLocked: true,
      canBid: false,
      activeBid,
      isLockedByViewer: Boolean(
        viewerMusicianId && activeBid.musicianId === viewerMusicianId
      ),
      wasPreviouslyRejectedForViewer: false,
    };
  }

  const eventAllowsBidding =
    proposal.status === 'propuesta' || proposal.status === 'para_publicar';

  const wasPreviouslyRejectedForViewer = Boolean(
    viewerMusicianId &&
      bidsForSlot.some(
        (b) =>
          b.musicianId === viewerMusicianId &&
          (b.status === 'rechazada' || b.retracted)
      )
  );

  return {
    availability: 'libre',
    isLocked: false,
    canBid: viewerRole === 'musico' && eventAllowsBidding,
    isLockedByViewer: false,
    wasPreviouslyRejectedForViewer,
  };
}

export function canSubmitBidForSlot(params: {
  proposal: EventProposal;
  slot: EventSlot;
  slotBids: MusicianSlotBid[];
  musicianId: string;
}): { allowed: boolean; reason?: string } {
  const { proposal, slot, slotBids, musicianId } = params;

  if (
    proposal.status === 'publicada' ||
    proposal.status === 'agotada' ||
    proposal.status === 'cancelada'
  ) {
    return {
      allowed: false,
      reason: 'Esta convocatoria ya está cerrada y no admite nuevas postulaciones.',
    };
  }

  const display = getSlotDisplayState({
    proposal,
    slot,
    slotBids,
    viewerRole: 'musico',
    viewerMusicianId: musicianId,
  });

  if (display.availability === 'confirmado') {
    return {
      allowed: false,
      reason: 'Este horario ya fue reservado y confirmado para otro músico.',
    };
  }

  if (display.availability === 'bloqueado') {
    if (display.isLockedByViewer) {
      return {
        allowed: false,
        reason:
          'Ya enviaste una propuesta para este horario. Mientras esté en revisión no podés volver a postularte al mismo horario.',
      };
    }
    return {
      allowed: false,
      reason:
        'Este horario está bloqueado temporalmente porque otro músico ya envió una propuesta en curso.',
    };
  }

  return { allowed: true };
}

export function hasOpenSlotsInProposal(
  proposal: EventProposal,
  slotBids: MusicianSlotBid[] = []
): boolean {
  return proposal.slots.some((slot) => {
    const bidsForSlot = slotBids.filter(
      (b) => b.eventId === proposal.id && b.slotId === slot.id
    );
    const hasAcceptedBid = bidsForSlot.some(
      (b) => !b.retracted && b.status === 'aceptada'
    );
    return slot.status !== 'confirmado' && !slot.assignedMusicianId && !hasAcceptedBid;
  });
}

export function isEventVisibleInConvocatorias(params: {
  proposal: EventProposal;
  role: UserRole;
  barStatusFilter?: 'todos' | 'propuesta' | 'para_publicar' | 'publicada' | 'agotada';
  slotBids?: MusicianSlotBid[];
  musicianId?: string;
}): boolean {
  const { proposal, role, barStatusFilter = 'todos', slotBids = [], musicianId } = params;

  if (role === 'bar') {
    if (barStatusFilter === 'todos') return true;
    return proposal.status === barStatusFilter;
  }

  if (role === 'musico') {
    if (
      proposal.status === 'cancelada' ||
      proposal.status === 'agotada' ||
      proposal.status === 'publicada'
    ) {
      return false;
    }

    if (proposal.status === 'propuesta') {
      return true;
    }

    // En 'para_publicar', los demás músicos deben seguir viendo el evento
    // mientras queden horarios sin confirmar/reservar (o si tienen una propuesta activa).
    if (proposal.status === 'para_publicar') {
      if (hasOpenSlotsInProposal(proposal, slotBids)) return true;
      if (
        musicianId &&
        slotBids.some(
          (b) =>
            b.eventId === proposal.id &&
            b.musicianId === musicianId &&
            isActiveSlotBid(b)
        )
      ) {
        return true;
      }
      return false;
    }

    return false;
  }

  // Espectador
  return proposal.status === 'publicada';
}

export function applySlotAcceptToProposal(
  proposal: EventProposal,
  bid: Pick<MusicianSlotBid, 'slotId' | 'musicianId' | 'musicianName' | 'proposedCachetARS'>
): EventProposal {
  const updatedSlots = proposal.slots.map((s) =>
    s.id === bid.slotId
      ? {
          ...s,
          status: 'confirmado' as const,
          assignedMusicianId: bid.musicianId,
          assignedMusicianName: bid.musicianName,
          agreedCachetARS: bid.proposedCachetARS,
        }
      : s
  );

  const hasConfirmed = updatedSlots.some(
    (s) => s.status === 'confirmado' || Boolean(s.assignedMusicianId)
  );
  const nextStatus =
    proposal.status === 'propuesta' && hasConfirmed
      ? ('para_publicar' as const)
      : proposal.status;

  return {
    ...proposal,
    slots: updatedSlots,
    status: nextStatus,
  };
}

export function applySlotReleaseToProposal(
  proposal: EventProposal,
  slotId: string,
  remainingActiveBidsForSlot: MusicianSlotBid[] = []
): EventProposal {
  const nextSlotStatus =
    remainingActiveBidsForSlot.length > 0 ? ('negociando' as const) : ('libre' as const);

  const updatedSlots = proposal.slots.map((s) =>
    s.id === slotId
      ? {
          ...s,
          assignedMusicianId: undefined,
          assignedMusicianName: undefined,
          agreedCachetARS: undefined,
          status: nextSlotStatus,
        }
      : s
  );

  const stillHasConfirmed = updatedSlots.some(
    (s) => s.status === 'confirmado' || Boolean(s.assignedMusicianId)
  );
  const nextEventStatus =
    proposal.status === 'para_publicar' && !stillHasConfirmed
      ? ('propuesta' as const)
      : proposal.status;

  return {
    ...proposal,
    slots: updatedSlots,
    status: nextEventStatus,
  };
}

export function isBidVisibleToViewer(params: {
  bid: MusicianSlotBid;
  viewerRole: UserRole;
  viewerMusicianId?: string;
}): boolean {
  const { bid, viewerRole, viewerMusicianId } = params;
  if (viewerRole === 'bar') return true;
  if (viewerRole === 'musico') {
    return Boolean(viewerMusicianId && bid.musicianId === viewerMusicianId);
  }
  return false;
}
