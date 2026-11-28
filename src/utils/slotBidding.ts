import {
  CachetMode,
  EventProposal,
  EventSlot,
  LiveShowConfirmed,
  MusicianSlotBid,
  SlotBidHistoryEntry,
  UserRole,
} from '../types/index.ts';
import { getEventEndTimestampMs } from './reviewEligibility.ts';

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
  agreedCachetType?: CachetMode;
}

export interface DetectedClash {
  eventId: string;
  slotId?: string;
  title: string;
  venueName: string;
  startTime: string;
  endTime: string;
  status: string;
}

export function makeUniqueId(prefix: string, seedNow = Date.now()): string {
  return `${prefix}-${seedNow}-${Math.random().toString(36).slice(2, 7)}`;
}

export function isActiveSlotBid(bid: Pick<MusicianSlotBid, 'status' | 'retracted'>): boolean {
  return !bid.retracted && bid.status !== 'rechazada';
}

export function isEventArchived(
  ev: Pick<EventProposal, 'status' | 'date' | 'startTime' | 'endTime'>,
  nowMs: number = Date.now()
): boolean {
  if (ev.status === 'archivado') return true;
  if (ev.status === 'cancelada') return false;
  const endMs = getEventEndTimestampMs(ev.date, ev.startTime, ev.endTime);
  return Number.isFinite(endMs) && nowMs >= endMs;
}

export function getEffectiveEventStatus(
  ev: Pick<EventProposal, 'status' | 'date' | 'startTime' | 'endTime'>,
  nowMs: number = Date.now()
): EventProposal['status'] {
  return isEventArchived(ev, nowMs) ? 'archivado' : ev.status;
}

export function formatActionTimestamp(raw?: string): string {
  if (!raw) return 'Sin fecha registrada';
  const trimmed = raw.trim();
  if (!trimmed) return 'Sin fecha registrada';
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split('-');
    return `${d}/${m}/${y}`;
  }
  const normalized = /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(trimmed)
    ? trimmed.replace(/\s+/, 'T')
    : trimmed;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return trimmed;
  }
  const dd = String(parsed.getDate()).padStart(2, '0');
  const mm = String(parsed.getMonth() + 1).padStart(2, '0');
  const yyyy = parsed.getFullYear();
  const hh = String(parsed.getHours()).padStart(2, '0');
  const min = String(parsed.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min} hs`;
}

export interface LastActionInfo {
  timestamp: string;
  formattedTime: string;
  actorLabel: string;
  summary: string;
}

export function getBidLastActionInfo(bid: MusicianSlotBid, parentEvent?: EventProposal): LastActionInfo {
  const latestHistory =
    Array.isArray(bid.history) && bid.history.length > 0
      ? bid.history[bid.history.length - 1]
      : undefined;

  if (latestHistory) {
    const actorLabel =
      latestHistory.actorName ||
      (latestHistory.actor === 'bar' ? parentEvent?.venueName || 'Bar' : bid.musicianName);
    return {
      timestamp: latestHistory.createdAt || bid.createdAt,
      formattedTime: formatActionTimestamp(latestHistory.createdAt || bid.createdAt),
      actorLabel,
      summary: latestHistory.note || 'Actualización en la negociación',
    };
  }

  if (bid.retracted) {
    const ts = bid.retractedAt || bid.createdAt;
    return {
      timestamp: ts,
      formattedTime: formatActionTimestamp(ts),
      actorLabel: bid.musicianName,
      summary: 'Se retractó de la postulación',
    };
  }

  if (bid.reminderSentAt) {
    return {
      timestamp: bid.reminderSentAt,
      formattedTime: formatActionTimestamp(bid.reminderSentAt),
      actorLabel: bid.musicianName,
      summary: 'Envió recordatorio al bar',
    };
  }

  const defaultSummary =
    bid.status === 'aceptada'
      ? 'Acuerdo confirmado'
      : bid.status === 'rechazada'
      ? 'Propuesta cerrada'
      : bid.status === 'contraoferta_bar'
      ? 'Contrapropuesta enviada por el bar'
      : bid.status === 'contraoferta_musico'
      ? 'Contrapropuesta enviada por el músico'
      : 'Postulación enviada al bar';

  return {
    timestamp: bid.createdAt,
    formattedTime: formatActionTimestamp(bid.createdAt),
    actorLabel: bid.musicianName,
    summary: defaultSummary,
  };
}

export function getEventLastActionInfo(
  proposal: EventProposal,
  slotBids: MusicianSlotBid[] = []
): LastActionInfo {
  const eventTimestampMs = proposal.lastActionAt ? new Date(proposal.lastActionAt.replace(/\s+/, 'T')).getTime() : NaN;
  const relatedBids = slotBids.filter((b) => b.eventId === proposal.id);
  let newestBidInfo: LastActionInfo | null = null;
  let newestBidMs = -Infinity;

  for (const bid of relatedBids) {
    const info = getBidLastActionInfo(bid, proposal);
    const ms = new Date((info.timestamp || '').replace(/\s+/, 'T')).getTime();
    if (Number.isFinite(ms) && ms > newestBidMs) {
      newestBidMs = ms;
      newestBidInfo = info;
    }
  }

  if (
    newestBidInfo &&
    (!Number.isFinite(eventTimestampMs) || newestBidMs > eventTimestampMs)
  ) {
    return newestBidInfo;
  }

  if (proposal.lastActionSummary && proposal.lastActionAt) {
    return {
      timestamp: proposal.lastActionAt,
      formattedTime: formatActionTimestamp(proposal.lastActionAt),
      actorLabel: proposal.lastActionActor || proposal.venueName,
      summary: proposal.lastActionSummary,
    };
  }

  const effective = getEffectiveEventStatus(proposal);
  const fallbackTs =
    proposal.cancelledAt ||
    proposal.cachetPaidAt ||
    proposal.feedbackSentAt ||
    proposal.lastActionAt ||
    proposal.createdAt;
  const fallbackSummary =
    effective === 'archivado'
      ? 'Evento archivado tras finalizar su horario'
      : effective === 'cancelada'
      ? 'Evento cancelado por el bar'
      : effective === 'agotada'
      ? 'Entradas agotadas en cartelera'
      : effective === 'publicada'
      ? 'Evento publicado en cartelera'
      : effective === 'para_publicar'
      ? 'Horario acordado • Listo para publicar'
      : 'Convocatoria abierta para músicos';

  return {
    timestamp: fallbackTs,
    formattedTime: formatActionTimestamp(fallbackTs),
    actorLabel: proposal.lastActionActor || proposal.venueName,
    summary: fallbackSummary,
  };
}

export function archivePastEvents(
  events: EventProposal[],
  nowMs: number = Date.now(),
  nowIso: string = new Date(nowMs).toISOString()
): { events: EventProposal[]; archivedEvents: EventProposal[] } {
  const archivedEvents: EventProposal[] = [];
  let anyChanged = false;

  const nextEvents = events.map((ev) => {
    if (ev.status === 'archivado' || ev.status === 'cancelada') return ev;
    const endMs = getEventEndTimestampMs(ev.date, ev.startTime, ev.endTime);
    if (Number.isFinite(endMs) && nowMs >= endMs) {
      anyChanged = true;
      const updated: EventProposal = {
        ...ev,
        status: 'archivado',
        lastActionAt: ev.lastActionAt || nowIso,
        lastActionActor: ev.lastActionActor || 'Sistema DeGira',
        lastActionSummary:
          'Evento archivado automáticamente al finalizar su horario (solo lectura).',
      };
      archivedEvents.push(updated);
      return updated;
    }
    return ev;
  });

  return {
    events: anyChanged ? nextEvents : events,
    archivedEvents,
  };
}

function toMinutes(timeStr: string): number {
  const [h, m] = (timeStr || '00:00').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function doTimeRangesOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  const a1 = toMinutes(startA);
  let a2 = toMinutes(endA);
  if (a2 <= a1) a2 += 24 * 60;

  const b1 = toMinutes(startB);
  let b2 = toMinutes(endB);
  if (b2 <= b1) b2 += 24 * 60;

  return a1 < b2 && a2 > b1;
}

export function detectMusicianDateClashes(params: {
  musicianId: string;
  targetEvent: EventProposal;
  targetSlot: EventSlot;
  slotBids: MusicianSlotBid[];
  eventProposals: EventProposal[];
  liveShows?: LiveShowConfirmed[];
}): DetectedClash[] {
  const { musicianId, targetEvent, targetSlot, slotBids, eventProposals, liveShows = [] } = params;
  const clashes: DetectedClash[] = [];
  const seenEventSlots = new Set<string>();

  for (const otherBid of slotBids) {
    if (otherBid.musicianId !== musicianId || !isActiveSlotBid(otherBid)) continue;
    const otherEv = eventProposals.find((e) => e.id === otherBid.eventId);
    if (!otherEv || otherEv.status === 'cancelada' || otherEv.date !== targetEvent.date) continue;
    if ((otherEv.status === 'publicada' || otherEv.status === 'agotada') && otherBid.status !== 'aceptada') {
      continue;
    }
    const otherSlot = otherEv.slots.find((s) => s.id === otherBid.slotId);
    if (!otherSlot) continue;
    if (otherEv.id === targetEvent.id && otherSlot.id === targetSlot.id) continue;

    if (
      doTimeRangesOverlap(
        targetSlot.startTime,
        targetSlot.endTime,
        otherSlot.startTime,
        otherSlot.endTime
      )
    ) {
      seenEventSlots.add(`${otherEv.id}:${otherSlot.id}`);
      clashes.push({
        eventId: otherEv.id,
        slotId: otherSlot.id,
        title: otherEv.title,
        venueName: otherEv.venueName,
        startTime: otherSlot.startTime,
        endTime: otherSlot.endTime,
        status: otherBid.status === 'aceptada' ? 'Aceptada' : 'Propuesta pendiente',
      });
    }
  }

  for (const otherEv of eventProposals) {
    if (otherEv.status === 'cancelada' || otherEv.date !== targetEvent.date) continue;
    for (const otherSlot of otherEv.slots) {
      if (otherEv.id === targetEvent.id && otherSlot.id === targetSlot.id) continue;
      if (seenEventSlots.has(`${otherEv.id}:${otherSlot.id}`)) continue;
      const isConfirmedForMusician =
        otherSlot.assignedMusicianId === musicianId &&
        otherSlot.status !== 'libre' &&
        otherSlot.status !== 'negociando';
      if (!isConfirmedForMusician) continue;

      if (
        doTimeRangesOverlap(
          targetSlot.startTime,
          targetSlot.endTime,
          otherSlot.startTime,
          otherSlot.endTime
        )
      ) {
        seenEventSlots.add(`${otherEv.id}:${otherSlot.id}`);
        clashes.push({
          eventId: otherEv.id,
          slotId: otherSlot.id,
          title: otherEv.title,
          venueName: otherEv.venueName,
          startTime: otherSlot.startTime,
          endTime: otherSlot.endTime,
          status: 'Aceptada',
        });
      }
    }
  }

  for (const show of liveShows) {
    if (show.musicianId === musicianId && show.date === targetEvent.date) {
      const showStart = show.time.split(' ')[0] || '21:00';
      if (doTimeRangesOverlap(targetSlot.startTime, targetSlot.endTime, showStart, '23:59')) {
        clashes.push({
          eventId: show.id,
          title: `${show.musicianName} en vivo`,
          venueName: show.venueName,
          startTime: showStart,
          endTime: '23:59',
          status: 'Fecha Confirmada',
        });
      }
    }
  }

  return clashes;
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
    Boolean(acceptedBid) ||
    (slot.status !== 'libre' &&
      slot.status !== 'negociando' &&
      Boolean(slot.assignedMusicianId));

  const isMusicianViewer = viewerRole === 'musico' && Boolean(viewerMusicianId);

  if (isConfirmed) {
    return {
      availability: 'confirmado',
      isLocked: true,
      canBid: false,
      activeBid: acceptedBid || activeBid,
      acceptedBid,
      isLockedByViewer: Boolean(
        isMusicianViewer &&
          (slot.assignedMusicianId === viewerMusicianId ||
            acceptedBid?.musicianId === viewerMusicianId)
      ),
      wasPreviouslyRejectedForViewer: false,
      assignedMusicianId: slot.assignedMusicianId || acceptedBid?.musicianId,
      assignedMusicianName: slot.assignedMusicianName || acceptedBid?.musicianName,
      agreedCachetARS: slot.agreedCachetARS ?? acceptedBid?.proposedCachetARS,
      agreedCachetType: slot.agreedCachetType ?? acceptedBid?.cachetType ?? proposal.cachetType,
    };
  }

  if (activeBid) {
    return {
      availability: 'bloqueado',
      isLocked: true,
      canBid: false,
      activeBid,
      isLockedByViewer: Boolean(isMusicianViewer && activeBid.musicianId === viewerMusicianId),
      wasPreviouslyRejectedForViewer: false,
    };
  }

  const eventAllowsBidding =
    !isEventArchived(proposal) &&
    (proposal.status === 'propuesta' || proposal.status === 'para_publicar');

  const wasPreviouslyRejectedForViewer = Boolean(
    isMusicianViewer &&
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

  if (isEventArchived(proposal)) {
    return {
      allowed: false,
      reason: 'Este evento ya finalizó y se encuentra archivado en modo solo lectura.',
    };
  }

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

  if (!proposal.slots.some((s) => s.id === slot.id)) {
    return {
      allowed: false,
      reason: 'El horario seleccionado no pertenece a esta convocatoria.',
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
    return (
      slot.status !== 'confirmado' &&
      !hasAcceptedBid &&
      (slot.status === 'libre' || slot.status === 'negociando' || !slot.assignedMusicianId)
    );
  });
}

export function isEventVisibleInConvocatorias(params: {
  proposal: EventProposal;
  role: UserRole;
  barStatusFilter?: 'todos' | 'propuesta' | 'para_publicar' | 'publicada' | 'agotada' | 'cancelada' | 'archivado';
  slotBids?: MusicianSlotBid[];
  musicianId?: string;
  viewerVenueId?: string;
  nowMs?: number;
}): boolean {
  const {
    proposal,
    role,
    barStatusFilter = 'todos',
    slotBids = [],
    musicianId,
    viewerVenueId,
    nowMs = Date.now(),
  } = params;

  const effectiveStatus = getEffectiveEventStatus(proposal, nowMs);

  if (role === 'bar') {
    if (viewerVenueId && proposal.venueId !== viewerVenueId) {
      return false;
    }
    if (barStatusFilter === 'todos') return true;
    return effectiveStatus === barStatusFilter;
  }

  if (role === 'musico') {
    if (
      effectiveStatus === 'archivado' ||
      effectiveStatus === 'cancelada' ||
      effectiveStatus === 'agotada' ||
      effectiveStatus === 'publicada'
    ) {
      return false;
    }

    if (effectiveStatus === 'propuesta') {
      return true;
    }

    // En 'para_publicar', los demás músicos deben seguir viendo el evento
    // mientras queden horarios sin confirmar/reservar (o si tienen una propuesta activa).
    if (effectiveStatus === 'para_publicar') {
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
  return effectiveStatus === 'publicada';
}

export function applySlotAcceptToProposal(
  proposal: EventProposal,
  bid: Pick<MusicianSlotBid, 'slotId' | 'musicianId' | 'musicianName' | 'proposedCachetARS' | 'cachetType'>
): EventProposal {
  const effectiveCachetType: CachetMode =
    bid.cachetType === 'a_la_gorra'
      ? 'a_la_gorra'
      : bid.cachetType === 'fijo'
      ? 'fijo'
      : proposal.cachetType === 'a_la_gorra'
      ? 'a_la_gorra'
      : 'fijo';

  const updatedSlots = proposal.slots.map((s) =>
    s.id === bid.slotId
      ? {
          ...s,
          status: 'confirmado' as const,
          assignedMusicianId: bid.musicianId,
          assignedMusicianName: bid.musicianName,
          agreedCachetARS: effectiveCachetType === 'a_la_gorra' ? 0 : bid.proposedCachetARS,
          ...(bid.cachetType || proposal.cachetType ? { agreedCachetType: effectiveCachetType } : {}),
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
          agreedCachetType: undefined,
          status: nextSlotStatus,
        }
      : s
  );

  const stillHasConfirmed = updatedSlots.some(
    (s) => s.status === 'confirmado' || Boolean(s.assignedMusicianId)
  );
  const nextEventStatus =
    (proposal.status === 'para_publicar' || proposal.status === 'publicada') && !stillHasConfirmed
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
  viewerVenueId?: string;
  parentEvent?: EventProposal;
}): boolean {
  const { bid, viewerRole, viewerMusicianId, viewerVenueId, parentEvent } = params;
  if (viewerRole === 'bar') {
    if (viewerVenueId && parentEvent && parentEvent.venueId !== viewerVenueId) {
      return false;
    }
    return true;
  }
  if (viewerRole === 'musico') {
    return Boolean(viewerMusicianId && bid.musicianId === viewerMusicianId);
  }
  return false;
}

export function validateRespondToSlotBid(params: {
  bid: MusicianSlotBid;
  event: EventProposal;
  allSlotBids: MusicianSlotBid[];
  actorRole: UserRole;
  actorEntityId?: string;
  action: 'accept' | 'reject' | 'counter';
  counterCachet?: number;
  counterCachetType?: CachetMode;
  counterMusiciansCount?: number;
}): { allowed: boolean; reason?: string } {
  const {
    bid,
    event,
    allSlotBids,
    actorRole,
    actorEntityId,
    action,
    counterCachet,
    counterCachetType,
    counterMusiciansCount,
  } = params;

  if (actorRole !== 'bar' && actorRole !== 'musico') {
    return {
      allowed: false,
      reason: 'El perfil público no puede negociar horarios ni caché.',
    };
  }

  if (actorRole === 'bar' && actorEntityId && event.venueId !== actorEntityId) {
    return {
      allowed: false,
      reason: 'No podés operar sobre una propuesta que pertenece a otro bar.',
    };
  }

  if (actorRole === 'musico' && actorEntityId && bid.musicianId !== actorEntityId) {
    return {
      allowed: false,
      reason: 'Solo el músico titular de la postulación puede responder esta negociación.',
    };
  }

  if (isEventArchived(event)) {
    return {
      allowed: false,
      reason: 'Este evento ya finalizó y está archivado en modo solo lectura.',
    };
  }

  if (event.status === 'cancelada') {
    return {
      allowed: false,
      reason: 'Este evento fue cancelado y ya no admite negociación.',
    };
  }

  if (bid.retracted || bid.status === 'rechazada' || bid.status === 'aceptada') {
    return {
      allowed: false,
      reason: 'Esta propuesta ya fue cerrada y no admite nuevas acciones.',
    };
  }

  const slot = event.slots.find((s) => s.id === bid.slotId);
  if (!slot) {
    return {
      allowed: false,
      reason: 'El horario asociado a esta propuesta no existe en el evento.',
    };
  }

  if (action === 'accept' || action === 'counter') {
    if (event.status === 'publicada' || event.status === 'agotada') {
      return {
        allowed: false,
        reason: 'El evento ya fue publicado en cartelera y no admite cambios en este horario.',
      };
    }
  }

  if (action === 'accept') {
    const otherAccepted = allSlotBids.some(
      (b) =>
        b.id !== bid.id &&
        b.eventId === event.id &&
        b.slotId === bid.slotId &&
        !b.retracted &&
        b.status === 'aceptada'
    );
    const slotAlreadyConfirmed =
      slot.status === 'confirmado' ||
      otherAccepted ||
      (slot.status !== 'libre' &&
        slot.status !== 'negociando' &&
        Boolean(slot.assignedMusicianId));
    if (slotAlreadyConfirmed) {
      return {
        allowed: false,
        reason: 'Este horario ya está confirmado para otro músico.',
      };
    }

    if (actorRole === 'bar') {
      if (bid.status === 'contraoferta_bar') {
        return {
          allowed: false,
          reason: 'Ya enviaste una contraoferta; debés esperar a que el músico acepte, contraoferte o rechace.',
        };
      }
      if (bid.status !== 'pendiente_bar' && bid.status !== 'contraoferta_musico') {
        return {
          allowed: false,
          reason: 'El estado actual de la propuesta no permite aceptación directa del bar.',
        };
      }
    }

    if (actorRole === 'musico' && bid.status !== 'contraoferta_bar') {
      return {
        allowed: false,
        reason: 'Solo podés aceptar cuando el bar haya enviado una contraoferta.',
      };
    }
  }

  if (action === 'counter') {
    const effectiveCounterType: CachetMode =
      counterCachetType === 'a_la_gorra' ? 'a_la_gorra' : 'fijo';

    if (effectiveCounterType === 'fijo') {
      if (
        counterCachet === undefined ||
        typeof counterCachet !== 'number' ||
        !Number.isFinite(counterCachet) ||
        counterCachet <= 0
      ) {
        return {
          allowed: false,
          reason: 'El monto de la contraoferta debe ser mayor a $ 0.',
        };
      }
    }

    if (
      counterMusiciansCount !== undefined &&
      (typeof counterMusiciansCount !== 'number' ||
        !Number.isFinite(counterMusiciansCount) ||
        counterMusiciansCount < 1 ||
        counterMusiciansCount > 30)
    ) {
      return {
        allowed: false,
        reason: 'La cantidad de músicos en escenario debe estar entre 1 y 30.',
      };
    }

    if (actorRole === 'musico' && bid.status !== 'contraoferta_bar') {
      return {
        allowed: false,
        reason: 'Solo podés enviar una contraoferta luego de recibir una contraoferta del bar.',
      };
    }
  }

  if (action === 'reject') {
    if (actorRole === 'musico' && bid.status !== 'contraoferta_bar') {
      return {
        allowed: false,
        reason: 'Para retirar tu propia propuesta pendiente o aceptada debés usar la opción Retractarme.',
      };
    }
  }

  return { allowed: true };
}

export function validateRetractSlotBid(params: {
  bid: MusicianSlotBid;
  event: EventProposal;
  actorMusicianId?: string;
  nowMs?: number;
}): { allowed: boolean; reason?: string; hoursRemaining: number } {
  const { bid, event, actorMusicianId, nowMs = Date.now() } = params;

  if (actorMusicianId && bid.musicianId !== actorMusicianId) {
    return {
      allowed: false,
      reason: 'Solo el músico titular puede retractarse de esta propuesta.',
      hoursRemaining: 0,
    };
  }

  if (bid.retracted || bid.status === 'rechazada') {
    return {
      allowed: false,
      reason: 'Esta propuesta ya fue cerrada o retractada previamente.',
      hoursRemaining: 0,
    };
  }

  if (isEventArchived(event, nowMs)) {
    return {
      allowed: false,
      reason: 'El evento ya finalizó y está archivado en modo solo lectura.',
      hoursRemaining: 0,
    };
  }

  if (event.status === 'cancelada') {
    return {
      allowed: false,
      reason: 'El evento ya fue cancelado.',
      hoursRemaining: 0,
    };
  }

  const slot = event.slots.find((s) => s.id === bid.slotId);
  const effectiveStartTime = slot?.startTime || event.startTime || '21:00';
  const eventDateTime = new Date(`${event.date}T${effectiveStartTime}`).getTime();
  const hoursRemaining = (eventDateTime - nowMs) / (1000 * 60 * 60);

  if (!Number.isFinite(hoursRemaining) || hoursRemaining < 24) {
    const shownHours = Number.isFinite(hoursRemaining) ? Math.max(0, Math.floor(hoursRemaining)) : 0;
    return {
      allowed: false,
      reason: `No es posible retractarse: faltan ${shownHours} hs para el inicio del show (la app solo permite retractarse con un mínimo de 24 horas de antelación).`,
      hoursRemaining,
    };
  }

  return { allowed: true, hoursRemaining };
}

export function applyBidSubmissionTransition(params: {
  eventProposals: EventProposal[];
  slotBids: MusicianSlotBid[];
  bid: MusicianSlotBid;
}):
  | {
      ok: true;
      slotBids: MusicianSlotBid[];
      eventProposals: EventProposal[];
      updatedEvent: EventProposal;
      newBid: MusicianSlotBid;
    }
  | { ok: false; message: string } {
  const { eventProposals, slotBids, bid } = params;
  const targetEvent = eventProposals.find((e) => e.id === bid.eventId);
  if (!targetEvent) {
    return { ok: false, message: 'Evento no encontrado.' };
  }
  const targetSlot = targetEvent.slots.find((s) => s.id === bid.slotId);
  if (!targetSlot) {
    return { ok: false, message: 'Horario del evento no encontrado.' };
  }

  const bidCachetType: CachetMode = bid.cachetType === 'a_la_gorra' ? 'a_la_gorra' : 'fijo';
  if (bidCachetType === 'fijo') {
    if (!Number.isFinite(bid.proposedCachetARS) || bid.proposedCachetARS <= 0) {
      return { ok: false, message: 'El caché propuesto debe ser mayor a $ 0.' };
    }
  } else if (!Number.isFinite(bid.proposedCachetARS) || bid.proposedCachetARS < 0) {
    return { ok: false, message: 'Caché inválido para modalidad A la gorra.' };
  }

  const normalizedBid: MusicianSlotBid =
    bidCachetType === 'a_la_gorra'
      ? { ...bid, cachetType: 'a_la_gorra', proposedCachetARS: 0 }
      : bid;

  const check = canSubmitBidForSlot({
    proposal: targetEvent,
    slot: targetSlot,
    slotBids,
    musicianId: normalizedBid.musicianId,
  });
  if (!check.allowed) {
    return { ok: false, message: check.reason || 'No se puede postular a este horario.' };
  }

  const nowActionIso = new Date().toISOString();
  const nextBids = [normalizedBid, ...slotBids];
  const updatedEvent: EventProposal = {
    ...targetEvent,
    slots: targetEvent.slots.map((s) =>
      s.id === normalizedBid.slotId && s.status === 'libre'
        ? { ...s, status: 'negociando' as const }
        : s
    ),
    lastActionAt: normalizedBid.createdAt || nowActionIso,
    lastActionActor: normalizedBid.musicianName,
    lastActionSummary: `Nueva postulación para horario ${targetSlot.startTime}–${targetSlot.endTime} hs`,
  };
  const nextEvents = eventProposals.map((ev) => (ev.id === targetEvent.id ? updatedEvent : ev));

  return {
    ok: true,
    slotBids: nextBids,
    eventProposals: nextEvents,
    updatedEvent,
    newBid: normalizedBid,
  };
}

export function applyBidResponseTransition(params: {
  eventProposals: EventProposal[];
  slotBids: MusicianSlotBid[];
  bidId: string;
  actorRole: UserRole;
  actorEntityId?: string;
  action: 'accept' | 'reject' | 'counter';
  counterCachet?: number;
  counterCachetType?: CachetMode;
  counterMusiciansCount?: number;
  note?: string;
  nowIso?: string;
  historyId?: string;
}):
  | {
      ok: true;
      slotBids: MusicianSlotBid[];
      eventProposals: EventProposal[];
      updatedBid: MusicianSlotBid;
      autoRejectedBids: MusicianSlotBid[];
      updatedEvent?: EventProposal;
      event: EventProposal;
    }
  | { ok: false; message: string } {
  const {
    eventProposals,
    slotBids,
    bidId,
    actorRole,
    actorEntityId,
    action,
    counterCachet,
    counterCachetType,
    counterMusiciansCount,
    note,
    nowIso = new Date().toISOString(),
    historyId = makeUniqueId('h'),
  } = params;

  const bid = slotBids.find((b) => b.id === bidId);
  if (!bid) return { ok: false, message: 'Propuesta no encontrada.' };

  const event = eventProposals.find((e) => e.id === bid.eventId);
  if (!event) return { ok: false, message: 'Evento no encontrado.' };

  const check = validateRespondToSlotBid({
    bid,
    event,
    allSlotBids: slotBids,
    actorRole,
    actorEntityId,
    action,
    counterCachet,
    counterCachetType,
    counterMusiciansCount,
  });
  if (!check.allowed) {
    return { ok: false, message: check.reason || 'Acción no permitida.' };
  }

  let newStatus: MusicianSlotBid['status'] = bid.status;
  let newProposedCachet = bid.proposedCachetARS;
  let newCachetType: CachetMode | undefined = bid.cachetType;
  let newMusiciansCount = bid.musiciansCount;

  if (action === 'accept') {
    newStatus = 'aceptada';
  } else if (action === 'reject') {
    newStatus = 'rechazada';
  } else if (action === 'counter') {
    newStatus = actorRole === 'bar' ? 'contraoferta_bar' : 'contraoferta_musico';
    const effectiveCounterType: CachetMode =
      counterCachetType === 'a_la_gorra' ? 'a_la_gorra' : 'fijo';
    newCachetType = effectiveCounterType;
    if (effectiveCounterType === 'a_la_gorra') {
      newProposedCachet = 0;
    } else if (counterCachet !== undefined) {
      newProposedCachet = counterCachet;
    }
    if (counterMusiciansCount !== undefined && actorRole === 'musico') {
      newMusiciansCount = Math.max(1, Math.min(30, Math.round(counterMusiciansCount)));
    }
  }

  const historyEntry: SlotBidHistoryEntry = {
    id: historyId,
    actor: actorRole === 'bar' ? 'bar' : 'musico',
    actorName: actorRole === 'bar' ? event.venueName : bid.musicianName,
    cachetARS: newProposedCachet,
    ...(newCachetType ? { cachetType: newCachetType } : {}),
    note:
      note ||
      (action === 'accept'
        ? 'Aceptó la propuesta.'
        : action === 'reject'
        ? 'Rechazó la propuesta.'
        : newCachetType === 'a_la_gorra'
        ? 'Propuso caché a la gorra.'
        : 'Envió una contrapropuesta.'),
    createdAt: nowIso,
  };

  const updatedBid: MusicianSlotBid = {
    ...bid,
    status: newStatus,
    proposedCachetARS: newProposedCachet,
    ...(newCachetType ? { cachetType: newCachetType } : {}),
    musiciansCount: newMusiciansCount,
    history: [...bid.history, historyEntry],
  };

  const autoRejectedBids: MusicianSlotBid[] = [];
  const nextBids = slotBids.map((b) => {
    if (b.id === bidId) return updatedBid;
    if (
      action === 'accept' &&
      b.eventId === bid.eventId &&
      b.slotId === bid.slotId &&
      !b.retracted &&
      b.status !== 'rechazada'
    ) {
      const closedSibling: MusicianSlotBid = {
        ...b,
        status: 'rechazada',
        history: [
          ...b.history,
          {
            id: `${historyId}-auto-${b.id.slice(-4)}`,
            actor: 'bar',
            actorName: event.venueName,
            cachetARS: b.proposedCachetARS,
            ...(b.cachetType ? { cachetType: b.cachetType } : {}),
            note: 'Otro músico fue confirmado para este horario.',
            createdAt: nowIso,
          },
        ],
      };
      autoRejectedBids.push(closedSibling);
      return closedSibling;
    }
    return b;
  });

  const slotLabel = event.slots.find((s) => s.id === bid.slotId);
  const slotHours = slotLabel ? `${slotLabel.startTime}–${slotLabel.endTime} hs` : 'horario';
  const eventActionSummary =
    action === 'accept'
      ? `Acordado ${slotHours} con ${bid.musicianName}`
      : action === 'reject'
      ? actorRole === 'bar'
        ? `Rechazada postulación de ${bid.musicianName} (${slotHours})`
        : `${bid.musicianName} rechazó contraoferta (${slotHours})`
      : actorRole === 'bar'
      ? `Contraoferta del bar a ${bid.musicianName} (${slotHours})`
      : `Contraoferta de ${bid.musicianName} (${slotHours})`;

  let updatedEvent: EventProposal | undefined;

  if (action === 'accept') {
    updatedEvent = {
      ...applySlotAcceptToProposal(event, {
        slotId: bid.slotId,
        musicianId: bid.musicianId,
        musicianName: bid.musicianName,
        proposedCachetARS: newProposedCachet,
        cachetType: newCachetType,
      }),
      lastActionAt: nowIso,
      lastActionActor: historyEntry.actorName,
      lastActionSummary: eventActionSummary,
    };
  } else if (action === 'reject') {
    const remainingActiveForSlot = nextBids.filter(
      (b) => b.eventId === bid.eventId && b.slotId === bid.slotId && isActiveSlotBid(b)
    );
    updatedEvent = {
      ...applySlotReleaseToProposal(event, bid.slotId, remainingActiveForSlot),
      lastActionAt: nowIso,
      lastActionActor: historyEntry.actorName,
      lastActionSummary: eventActionSummary,
    };
  } else {
    updatedEvent = {
      ...event,
      lastActionAt: nowIso,
      lastActionActor: historyEntry.actorName,
      lastActionSummary: eventActionSummary,
    };
  }

  const nextEvents = updatedEvent
    ? eventProposals.map((ev) => (ev.id === bid.eventId ? updatedEvent! : ev))
    : eventProposals;

  return {
    ok: true,
    slotBids: nextBids,
    eventProposals: nextEvents,
    updatedBid,
    autoRejectedBids,
    updatedEvent,
    event,
  };
}

export function applyBidRetractionTransition(params: {
  eventProposals: EventProposal[];
  slotBids: MusicianSlotBid[];
  bidId: string;
  actorMusicianId?: string;
  nowMs?: number;
  nowIso?: string;
  historyId?: string;
}):
  | {
      ok: true;
      slotBids: MusicianSlotBid[];
      eventProposals: EventProposal[];
      updatedBid: MusicianSlotBid;
      updatedEvent: EventProposal;
      event: EventProposal;
    }
  | { ok: false; message: string } {
  const {
    eventProposals,
    slotBids,
    bidId,
    actorMusicianId,
    nowMs = Date.now(),
    nowIso = new Date(nowMs).toISOString(),
    historyId = makeUniqueId('h'),
  } = params;

  const bid = slotBids.find((b) => b.id === bidId);
  if (!bid) return { ok: false, message: 'Propuesta no encontrada.' };

  const event = eventProposals.find((e) => e.id === bid.eventId);
  if (!event) return { ok: false, message: 'Evento no encontrado.' };

  const check = validateRetractSlotBid({
    bid,
    event,
    actorMusicianId,
    nowMs,
  });
  if (!check.allowed) {
    return { ok: false, message: check.reason || 'No se pudo retractar la propuesta.' };
  }

  const updatedBid: MusicianSlotBid = {
    ...bid,
    retracted: true,
    retractedAt: nowIso,
    status: 'rechazada',
    history: [
      ...bid.history,
      {
        id: historyId,
        actor: 'musico',
        actorName: bid.musicianName,
        cachetARS: bid.proposedCachetARS,
        note: 'El músico se retractó de la propuesta (con más de 24hs de antelación al show).',
        createdAt: nowIso,
      },
    ],
  };

  const nextBids = slotBids.map((b) => (b.id === bidId ? updatedBid : b));
  const remainingActiveForSlot = nextBids.filter(
    (b) => b.eventId === bid.eventId && b.slotId === bid.slotId && isActiveSlotBid(b)
  );
  const releasedEvent = applySlotReleaseToProposal(event, bid.slotId, remainingActiveForSlot);
  const updatedEvent: EventProposal = {
    ...releasedEvent,
    lastActionAt: nowIso,
    lastActionActor: bid.musicianName,
    lastActionSummary: `${bid.musicianName} se retractó de su propuesta; el horario volvió a quedar libre`,
  };
  const nextEvents = eventProposals.map((ev) => (ev.id === bid.eventId ? updatedEvent : ev));

  return {
    ok: true,
    slotBids: nextBids,
    eventProposals: nextEvents,
    updatedBid,
    updatedEvent,
    event,
  };
}

export function applyPublishEventTransition(params: {
  eventProposals: EventProposal[];
  slotBids: MusicianSlotBid[];
  eventId: string;
  nowIso?: string;
  historyIdPrefix?: string;
}):
  | {
      ok: true;
      eventProposals: EventProposal[];
      slotBids: MusicianSlotBid[];
      updatedEvent: EventProposal;
      closedBids: MusicianSlotBid[];
    }
  | { ok: false; message: string } {
  const {
    eventProposals,
    slotBids,
    eventId,
    nowIso = new Date().toISOString(),
    historyIdPrefix = makeUniqueId('h-pub'),
  } = params;

  const target = eventProposals.find((e) => e.id === eventId);
  if (!target) {
    return { ok: false, message: 'Evento no encontrado.' };
  }
  if (isEventArchived(target)) {
    return { ok: false, message: 'Este evento ya finalizó y está archivado (solo lectura).' };
  }
  if (target.status === 'cancelada') {
    return { ok: false, message: 'Este evento está cancelado y no se puede publicar.' };
  }

  const hasConfirmedSlot = target.slots.some(
    (s) => s.status === 'confirmado' || Boolean(s.assignedMusicianId)
  );
  if (!hasConfirmedSlot) {
    return { ok: false, message: 'Se requiere al menos un horario confirmado para publicar.' };
  }

  const closedBids: MusicianSlotBid[] = [];
  const nextBids = slotBids.map((b) => {
    if (
      b.eventId === eventId &&
      !b.retracted &&
      b.status !== 'aceptada' &&
      b.status !== 'rechazada'
    ) {
      const closed: MusicianSlotBid = {
        ...b,
        status: 'rechazada',
        history: [
          ...b.history,
          {
            id: `${historyIdPrefix}-${b.id.slice(-4)}`,
            actor: 'bar',
            actorName: target.venueName,
            cachetARS: b.proposedCachetARS,
            ...(b.cachetType ? { cachetType: b.cachetType } : {}),
            note: 'El evento fue publicado en cartelera con la grilla confirmada; la negociación de este horario quedó cerrada.',
            createdAt: nowIso,
          },
        ],
      };
      closedBids.push(closed);
      return closed;
    }
    return b;
  });

  const updatedSlots = target.slots.map((s) => {
    const isSlotConfirmed = s.status === 'confirmado' || Boolean(s.assignedMusicianId);
    if (!isSlotConfirmed && s.status === 'negociando') {
      return {
        ...s,
        status: 'libre' as const,
      };
    }
    return s;
  });

  const updatedEvent: EventProposal = {
    ...target,
    slots: updatedSlots,
    status: 'publicada',
    lastActionAt: nowIso,
    lastActionActor: target.venueName,
    lastActionSummary: 'Evento publicado en cartelera para venta de entradas',
  };

  const nextEvents = eventProposals.map((ev) => (ev.id === eventId ? updatedEvent : ev));

  return {
    ok: true,
    eventProposals: nextEvents,
    slotBids: nextBids,
    updatedEvent,
    closedBids,
  };
}

export function applyCancelEventTransition(params: {
  eventProposals: EventProposal[];
  slotBids: MusicianSlotBid[];
  eventId: string;
  actorVenueId?: string;
  reason?: string;
  nowMs?: number;
  nowIso?: string;
  historyIdPrefix?: string;
}):
  | {
      ok: true;
      eventProposals: EventProposal[];
      slotBids: MusicianSlotBid[];
      updatedEvent: EventProposal;
      closedBids: MusicianSlotBid[];
    }
  | { ok: false; message: string } {
  const {
    eventProposals,
    slotBids,
    eventId,
    actorVenueId,
    reason,
    nowMs = Date.now(),
    nowIso = new Date(nowMs).toISOString(),
    historyIdPrefix = makeUniqueId('h-cancel'),
  } = params;

  const target = eventProposals.find((e) => e.id === eventId);
  if (!target) {
    return { ok: false, message: 'Evento no encontrado.' };
  }
  if (actorVenueId && target.venueId !== actorVenueId) {
    return { ok: false, message: 'No podés cancelar un evento de otro bar.' };
  }
  if (isEventArchived(target, nowMs)) {
    return { ok: false, message: 'Los eventos archivados no se pueden modificar ni cancelar.' };
  }
  if (target.status === 'cancelada') {
    return { ok: false, message: 'Este evento ya fue cancelado.' };
  }

  const closedBids: MusicianSlotBid[] = [];
  const nextBids = slotBids.map((b) => {
    if (b.eventId === eventId && !b.retracted && b.status !== 'rechazada') {
      const closed: MusicianSlotBid = {
        ...b,
        status: 'rechazada',
        history: [
          ...b.history,
          {
            id: `${historyIdPrefix}-${b.id.slice(-4)}`,
            actor: 'bar',
            actorName: target.venueName,
            cachetARS: b.proposedCachetARS,
            ...(b.cachetType ? { cachetType: b.cachetType } : {}),
            note: reason?.trim()
              ? `El bar canceló el evento: ${reason.trim()}`
              : 'El bar canceló este evento.',
            createdAt: nowIso,
          },
        ],
      };
      closedBids.push(closed);
      return closed;
    }
    return b;
  });

  const updatedEvent: EventProposal = {
    ...target,
    status: 'cancelada',
    cancelledAt: nowIso,
    lastActionAt: nowIso,
    lastActionActor: target.venueName,
    lastActionSummary: reason?.trim()
      ? `Evento cancelado: ${reason.trim()}`
      : 'El bar canceló el evento',
  };

  const nextEvents = eventProposals.map((ev) => (ev.id === eventId ? updatedEvent : ev));

  return {
    ok: true,
    eventProposals: nextEvents,
    slotBids: nextBids,
    updatedEvent,
    closedBids,
  };
}
