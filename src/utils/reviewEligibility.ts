import type {
  EventProposal,
  EventReview360,
  LiveShowConfirmed,
  PublicEventReservation,
  SpectatorReservation,
  UserRole,
} from '../types/index.ts';

/**
 * Calificaciones habilitadas estrictamente 2 horas después de finalizar cada evento.
 */
export const REVIEW_UNLOCK_DELAY_MS = 2 * 60 * 60 * 1000;

/**
 * Duración estimada por defecto (2h 30m) cuando un show heredado solo informa horario de inicio.
 */
export const DEFAULT_SHOW_DURATION_MINUTES = 150;

export interface ReviewAvailability {
  hasEnded: boolean;
  isAvailable: boolean;
  eventEndMs: number;
  unlockAtMs: number;
  msRemaining: number;
  waitLabel: string;
  unlockTimeText: string;
}

export interface PendingReviewItem {
  id: string;
  sourceType: 'event_proposal' | 'live_show';
  eventId: string;
  title: string;
  eventCode?: string;
  venueId: string;
  venueName: string;
  venueAddress: string;
  venueNeighborhood: string;
  venuePhoto?: string;
  date: string;
  startTime: string;
  endTime: string;
  musicianNames: string[];
  musicianIds: string[];
  targetSummary: string;
  availability: ReviewAvailability;
  eventProposal?: EventProposal;
  liveShow?: LiveShowConfirmed;
  reviewModalParams?: {
    targetType: 'musician' | 'venue';
    targetId: string;
    targetName: string;
    showDate: string;
    showVenueName: string;
    showIdToComplete?: string;
    showStartTime?: string;
    showEndTime?: string;
  };
}

export interface PendingReviewsSummary {
  availableNow: PendingReviewItem[];
  waitingWindow: PendingReviewItem[];
  allEndedPending: PendingReviewItem[];
}

export function parseTimeMinutes(timeStr?: string): number | null {
  if (!timeStr) return null;
  const match = timeStr.match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }
  return hours * 60 + minutes;
}

/**
 * Calcula el timestamp exacto (hora local) de finalización del evento.
 * Maneja correctamente shows que cruzan la medianoche (ej: inicio 21:00, fin 01:00 -> termina al día siguiente).
 */
export function getEventEndTimestampMs(
  dateStr: string,
  startTimeStr?: string,
  endTimeStr?: string
): number {
  const parts = (dateStr || '').split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n) || n <= 0)) {
    return NaN;
  }
  const [year, month, day] = parts;
  const startMinutes = parseTimeMinutes(startTimeStr) ?? 21 * 60;
  const parsedEndMinutes = parseTimeMinutes(endTimeStr);

  let endMinutes: number;
  if (parsedEndMinutes !== null) {
    endMinutes =
      parsedEndMinutes <= startMinutes
        ? parsedEndMinutes + 24 * 60
        : parsedEndMinutes;
  } else {
    endMinutes = startMinutes + DEFAULT_SHOW_DURATION_MINUTES;
  }

  return new Date(year, month - 1, day, 0, endMinutes, 0, 0).getTime();
}

export function formatUnlockTimeLabel(unlockAtMs: number): string {
  if (!Number.isFinite(unlockAtMs)) return '';
  const d = new Date(unlockAtMs);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm} ${hh}:${min} hs`;
}

export function formatRemainingDuration(msRemaining: number): string {
  if (msRemaining <= 0) return '0m';
  const totalMinutes = Math.ceil(msRemaining / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h`;
  return `${mins}m`;
}

/**
 * Determina si ya transcurrieron exactamente 2 horas desde la finalización del evento.
 */
export function getReviewAvailability(
  eventEndMs: number,
  nowMs: number = Date.now()
): ReviewAvailability {
  if (!Number.isFinite(eventEndMs)) {
    return {
      hasEnded: false,
      isAvailable: false,
      eventEndMs: NaN,
      unlockAtMs: NaN,
      msRemaining: Infinity,
      waitLabel: 'Fecha del evento inválida',
      unlockTimeText: '',
    };
  }

  const unlockAtMs = eventEndMs + REVIEW_UNLOCK_DELAY_MS;
  const hasEnded = nowMs >= eventEndMs;
  const isAvailable = nowMs >= unlockAtMs;
  const msRemaining = Math.max(0, unlockAtMs - nowMs);
  const unlockTimeText = formatUnlockTimeLabel(unlockAtMs);

  let waitLabel = 'Disponible ahora';
  if (!isAvailable) {
    if (!hasEnded) {
      waitLabel = `Se habilita 2 hs después de finalizar (${unlockTimeText})`;
    } else {
      waitLabel = `Disponible en ${formatRemainingDuration(msRemaining)} (${unlockTimeText})`;
    }
  }

  return {
    hasEnded,
    isAvailable,
    eventEndMs,
    unlockAtMs,
    msRemaining,
    waitLabel,
    unlockTimeText,
  };
}

export function hasRoleReviewedEventProposal(params: {
  reviews360: EventReview360[];
  eventId: string;
  role: UserRole;
  actorId?: string;
}): boolean {
  const { reviews360, eventId, role, actorId } = params;
  return reviews360.some((r) => {
    if (r.eventId !== eventId || r.fromRole !== role) return false;
    if (!actorId) return true;
    return r.fromUserId === actorId;
  });
}

export function getPendingReviewsForRole(params: {
  role: UserRole;
  activeVenueId?: string;
  activeMusicianId?: string;
  activePublicUserId?: string;
  eventProposals: EventProposal[];
  liveShows: LiveShowConfirmed[];
  publicEventReservations: PublicEventReservation[];
  reviews360: EventReview360[];
  spectatorReservations?: SpectatorReservation[];
  nowMs?: number;
}): PendingReviewsSummary {
  const {
    role,
    activeVenueId,
    activeMusicianId,
    activePublicUserId,
    eventProposals,
    liveShows,
    publicEventReservations,
    reviews360,
    spectatorReservations = [],
    nowMs = Date.now(),
  } = params;

  const actorId =
    role === 'bar'
      ? activeVenueId
      : role === 'musico'
      ? activeMusicianId
      : activePublicUserId;

  const items: PendingReviewItem[] = [];

  for (const ev of eventProposals) {
    if (ev.status !== 'publicada' && ev.status !== 'agotada' && ev.status !== 'archivado') continue;

    const assignedSlots = ev.slots.filter((s) => Boolean(s.assignedMusicianId));
    const musicianIds = Array.from(
      new Set(assignedSlots.map((s) => s.assignedMusicianId!).filter(Boolean))
    );
    const musicianNames = Array.from(
      new Set(
        assignedSlots
          .map((s) => s.assignedMusicianName || 'Músico')
          .filter(Boolean)
      )
    );

    // Scoped participation filter
    if (role === 'bar') {
      if (activeVenueId && ev.venueId !== activeVenueId) continue;
      if (musicianIds.length === 0) continue;
    } else if (role === 'musico') {
      if (!activeMusicianId || !musicianIds.includes(activeMusicianId)) continue;
    } else {
      const attended = publicEventReservations.some(
        (res) =>
          res.eventId === ev.id &&
          res.status === 'confirmada' &&
          (!activePublicUserId || res.userId === activePublicUserId)
      );
      if (!attended) continue;
    }

    if (
      hasRoleReviewedEventProposal({
        reviews360,
        eventId: ev.id,
        role,
        actorId,
      })
    ) {
      continue;
    }

    const endMs = getEventEndTimestampMs(ev.date, ev.startTime, ev.endTime);
    const availability = getReviewAvailability(endMs, nowMs);
    if (!availability.hasEnded) continue;

    const targetSummary =
      role === 'bar'
        ? `${musicianNames.join(', ')} (Músicos del show)`
        : role === 'musico'
        ? `Bar anfitrión: ${ev.venueName}`
        : musicianNames.length > 0
        ? `Evento, Bar (${ev.venueName}) y ${musicianNames.join(', ')}`
        : `Evento y Bar (${ev.venueName})`;

    items.push({
      id: `pending-ev-${ev.id}-${role}`,
      sourceType: 'event_proposal',
      eventId: ev.id,
      title: ev.title,
      eventCode: ev.eventCode,
      venueId: ev.venueId,
      venueName: ev.venueName,
      venueAddress: ev.venueAddress,
      venueNeighborhood: ev.venueNeighborhood,
      venuePhoto: ev.venuePhoto,
      date: ev.date,
      startTime: ev.startTime,
      endTime: ev.endTime,
      musicianNames,
      musicianIds,
      targetSummary,
      availability,
      eventProposal: ev,
    });
  }

  // Legacy / confirmed shows not duplicated by an event proposal
  for (const show of liveShows) {
    const matchesEventProposal = eventProposals.some(
      (ev) =>
        ev.venueId === show.venueId &&
        ev.date === show.date &&
        ev.slots.some((s) => s.assignedMusicianId === show.musicianId)
    );
    if (matchesEventProposal) continue;

    if (role === 'bar') {
      if (activeVenueId && show.venueId !== activeVenueId) continue;
      if (show.musicianReviewed) continue;
    } else if (role === 'musico') {
      if (activeMusicianId && show.musicianId !== activeMusicianId) continue;
      if (show.venueReviewed) continue;
    } else {
      const hasTicket = spectatorReservations.some(
        (r) =>
          r.showId === show.id &&
          r.paymentStatus === 'pagado_mp' &&
          (!activePublicUserId || r.userId === activePublicUserId)
      );
      if (!hasTicket) continue;
      if (
        hasRoleReviewedEventProposal({
          reviews360,
          eventId: show.id,
          role: 'espectador',
          actorId: activePublicUserId,
        })
      ) {
        continue;
      }
    }

    const endMs = getEventEndTimestampMs(show.date, show.time);
    const availability = getReviewAvailability(endMs, nowMs);
    if (!availability.hasEnded) continue;

    const endDate = new Date(endMs);
    const computedEndTime = `${String(endDate.getHours()).padStart(2, '0')}:${String(
      endDate.getMinutes()
    ).padStart(2, '0')}`;

    const targetIsVenue = role !== 'bar';
    const targetSummary =
      role === 'bar'
        ? `Músico: ${show.musicianName}`
        : role === 'musico'
        ? `Bar anfitrión: ${show.venueName}`
        : `${show.venueName} y ${show.musicianName}`;

    items.push({
      id: `pending-show-${show.id}-${role}`,
      sourceType: 'live_show',
      eventId: show.id,
      title: `${show.musicianName} en ${show.venueName}`,
      venueId: show.venueId,
      venueName: show.venueName,
      venueAddress: show.venueAddress,
      venueNeighborhood: show.venueNeighborhood,
      venuePhoto: show.venuePhoto,
      date: show.date,
      startTime: show.time.replace(/\s*hs$/i, ''),
      endTime: computedEndTime,
      musicianNames: [show.musicianName],
      musicianIds: [show.musicianId],
      targetSummary,
      availability,
      liveShow: show,
      reviewModalParams: {
        targetType: targetIsVenue ? 'venue' : 'musician',
        targetId: targetIsVenue ? show.venueId : show.musicianId,
        targetName: targetIsVenue ? show.venueName : show.musicianName,
        showDate: show.date,
        showVenueName: show.venueName,
        showIdToComplete: show.id,
        showStartTime: show.time,
        showEndTime: computedEndTime,
      },
    });
  }

  const availableNow = items
    .filter((i) => i.availability.isAvailable)
    .sort((a, b) => b.availability.eventEndMs - a.availability.eventEndMs);

  const waitingWindow = items
    .filter((i) => !i.availability.isAvailable)
    .sort((a, b) => a.availability.msRemaining - b.availability.msRemaining);

  return {
    availableNow,
    waitingWindow,
    allEndedPending: [...availableNow, ...waitingWindow],
  };
}
