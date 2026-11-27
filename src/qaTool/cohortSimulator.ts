import type {
  EventProposal,
  EventReview360,
  MusicGenre,
  MusicianProfile,
  MusicianSlotBid,
  NeighborhoodBA,
  PublicEventReservation,
  PublicUserProfile,
  VenueProfile,
} from '../types/index.ts';
import type { SentEmailRecord } from '../lib/emailService.ts';
import {
  applyBidResponseTransition,
  applyBidSubmissionTransition,
  applyPublishEventTransition,
  detectMusicianDateClashes,
  makeUniqueId,
} from '../utils/slotBidding.ts';
import {
  applyPaymentConfirmationToEvent,
  restoreCapacityOnReservationRelease,
} from '../utils/capacityLogic.ts';
import { getVenuesOwnedByBar } from '../utils/venueOwnership.ts';
import {
  isEmailVisibleToProfile,
  isNotificationVisibleToProfile,
} from '../utils/notificationScoping.ts';
import type {
  CohortConfig,
  CohortSimulationReport,
  QaNotificationRecord,
  SimulatedActorInboxSummary,
  TestCheckItem,
} from './types.ts';

const NEIGHBORHOODS: NeighborhoodBA[] = [
  'Palermo Soho',
  'San Telmo',
  'Villa Crespo',
  'Colegiales',
  'Almagro',
  'Chacarita',
  'Recoleta',
  'Belgrano',
];

const GENRES: MusicGenre[] = [
  'Rock',
  'Jazz',
  'Acústico',
  'Indie',
  'Blues & Soul',
  'Funk & Groove',
];

const BAR_AVATARS = [
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1572116469696-31de0f17cc34?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=400&auto=format&fit=crop&q=80',
];

const MUSICIAN_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80',
];

export function clampCohortConfig(raw: Partial<CohortConfig>): CohortConfig {
  const clamp = (val: number | undefined, min: number, max: number, fallback: number) => {
    if (typeof val !== 'number' || Number.isNaN(val)) return fallback;
    return Math.min(max, Math.max(min, Math.round(val)));
  };

  return {
    barsCount: clamp(raw.barsCount, 1, 15, 2),
    musiciansCount: clamp(raw.musiciansCount, 1, 25, 3),
    spectatorsCount: clamp(raw.spectatorsCount, 1, 40, 4),
    includeNotificationsAndEmails: raw.includeNotificationsAndEmails ?? true,
    includeScheduleClashes: raw.includeScheduleClashes ?? true,
    includePaymentsAndQr: raw.includePaymentsAndQr ?? true,
    baseDate: raw.baseDate || '2026-12-05',
  };
}

export function qaVenueEmail(index: number): string {
  return `bar-qa-${index + 1}@degira-qa.test`;
}

export function qaMusicianEmail(index: number): string {
  return `musico-qa-${index + 1}@degira-qa.test`;
}

export function qaSpectatorEmail(index: number): string {
  return `publico-qa-${index + 1}@degira-qa.test`;
}

export function buildCohortProfiles(config: CohortConfig): {
  venues: VenueProfile[];
  musicians: MusicianProfile[];
  publicUsers: PublicUserProfile[];
  venueEmails: Record<string, string>;
  musicianEmails: Record<string, string>;
  spectatorEmails: Record<string, string>;
} {
  const venues: VenueProfile[] = [];
  const musicians: MusicianProfile[] = [];
  const publicUsers: PublicUserProfile[] = [];
  const venueEmails: Record<string, string> = {};
  const musicianEmails: Record<string, string> = {};
  const spectatorEmails: Record<string, string> = {};

  for (let i = 0; i < config.barsCount; i++) {
    const id = `qa-venue-${i + 1}`;
    const neighborhood = NEIGHBORHOODS[i % NEIGHBORHOODS.length];
    venueEmails[id] = qaVenueEmail(i);
    venues.push({
      id,
      ownerBarId: id,
      name: `Bar QA ${i + 1}`,
      type: i % 2 === 0 ? 'Club de Jazz' : 'Cervecería',
      address: `Av. Corrientes ${1200 + i * 150}`,
      neighborhood,
      coverPhoto: BAR_AVATARS[i % BAR_AVATARS.length],
      photos: [BAR_AVATARS[i % BAR_AVATARS.length]],
      bio: `Escenario simulado QA #${i + 1} en ${neighborhood} para pruebas multi-rol.`,
      capacity: 60 + (i % 4) * 15,
      backline: ['Batería acústica', 'Amplificador de bajo', 'Consola digital'],
      acousticCharacteristics: 'Sala tratada acústicamente (QA).',
      hospitality: 'Cena y consumiciones para músicos.',
      rating: 4.8,
      reviewCount: 5 + i,
      ratingBreakdown: {
        soundQuality: 4.8,
        paymentReliability: 5.0,
        hospitality: 4.8,
        respect: 4.9,
      },
      venueCbuAlias: `degira.qa.bar${i + 1}.mp`,
      defaultRiderTemplate: {
        stageSize: '5x3m',
        soundSystem: 'PA Estéreo + 2 monitores',
        micCount: 3,
        backline: ['Batería acústica', 'Bajo 200W'],
        lighting: 'LED DMX',
      },
      reviews: [],
    });
  }

  for (let i = 0; i < config.musiciansCount; i++) {
    const id = `qa-mus-${i + 1}`;
    const genre = GENRES[i % GENRES.length];
    musicianEmails[id] = qaMusicianEmail(i);
    musicians.push({
      id,
      stageName: `Músico QA ${i + 1}`,
      format: i % 3 === 0 ? 'Solista' : i % 3 === 1 ? 'Dúo' : 'Trío',
      genres: [genre],
      bio: `Proyecto musical simulado QA #${i + 1} (${genre}).`,
      avatarUrl: MUSICIAN_AVATARS[i % MUSICIAN_AVATARS.length],
      photos: [MUSICIAN_AVATARS[i % MUSICIAN_AVATARS.length]],
      membersCount: (i % 3) + 1,
      instagramHandle: `@musico.qa.${i + 1}`,
      minCachetDefault: 45000 + i * 5000,
      technicalRider: '2 voces, 1 guitarra, 1 bajo.',
      rating: 4.9,
      reviewCount: 4 + i,
      ratingBreakdown: {
        punctuality: 4.9,
        liveSound: 4.9,
        crowdDrawing: 4.8,
        professionalism: 5.0,
      },
      reviews: [],
    });
  }

  for (let i = 0; i < config.spectatorsCount; i++) {
    const id = `qa-pub-${i + 1}`;
    const email = qaSpectatorEmail(i);
    spectatorEmails[id] = email;
    publicUsers.push({
      id,
      name: `Público QA ${i + 1}`,
      email,
      phone: `+54 9 11 5550-${String(1000 + i).slice(-4)}`,
      avatarUrl: MUSICIAN_AVATARS[i % MUSICIAN_AVATARS.length],
      favoriteGenres: [GENRES[i % GENRES.length]],
      preferredNeighborhoods: [NEIGHBORHOODS[i % NEIGHBORHOODS.length]],
      createdAt: new Date().toISOString(),
    });
  }

  return {
    venues,
    musicians,
    publicUsers,
    venueEmails,
    musicianEmails,
    spectatorEmails,
  };
}

export function runCohortSimulation(rawConfig: Partial<CohortConfig>): CohortSimulationReport {
  const config = clampCohortConfig(rawConfig);
  const {
    venues,
    musicians,
    publicUsers,
    venueEmails,
    musicianEmails,
    spectatorEmails,
  } = buildCohortProfiles(config);

  const notifications: QaNotificationRecord[] = [];
  const emails: SentEmailRecord[] = [];

  const pushNotif = (item: Omit<QaNotificationRecord, 'id' | 'timestamp' | 'read'>) => {
    if (!config.includeNotificationsAndEmails) return;
    notifications.unshift({
      ...item,
      id: makeUniqueId(`qa-notif-${notifications.length + 1}`),
      timestamp: 'Recién (QA)',
      read: false,
    });
  };

  const pushEmail = (item: Omit<SentEmailRecord, 'id' | 'sentAt'>) => {
    if (!config.includeNotificationsAndEmails) return;
    emails.unshift({
      ...item,
      id: makeUniqueId(`qa-email-${emails.length + 1}`),
      sentAt: new Date().toISOString(),
    });
  };

  let eventProposals: EventProposal[] = [];
  let slotBids: MusicianSlotBid[] = [];
  let publicEventReservations: PublicEventReservation[] = [];
  const reviews360: EventReview360[] = [];

  let clashesDetected = 0;
  let reservationsConfirmed = 0;
  let reservationsExpired = 0;

  // 1. Each Bar creates a 2-slot EventProposal on baseDate
  eventProposals = venues.map((venue, idx) => {
    const evId = `qa-ev-${idx + 1}`;
    const eventCode = `QA-B${idx + 1}-${100 + idx}`;
    return {
      id: evId,
      venueId: venue.id,
      venueName: venue.name,
      venueAddress: venue.address,
      venueNeighborhood: venue.neighborhood,
      venuePhoto: venue.coverPhoto,
      title: `Ciclo Vivo QA #${idx + 1}`,
      date: config.baseDate,
      startTime: '20:30',
      endTime: '00:15',
      totalCapacity: venue.capacity,
      remainingCapacity: venue.capacity,
      baseCachetARS: 60000,
      cachetType: 'fijo',
      ticketPriceARS: 8000 + idx * 1000,
      targetGenres: [GENRES[idx % GENRES.length]],
      rider: venue.defaultRiderTemplate || {
        stageSize: '5x3m',
        soundSystem: 'PA',
        micCount: 3,
        backline: [],
        lighting: 'LED',
      },
      slots: [
        {
          id: `${evId}-slot-1`,
          startTime: '20:30',
          endTime: '22:00',
          requiredMusicians: 2,
          genrePreference: GENRES[idx % GENRES.length],
          status: 'libre',
        },
        {
          id: `${evId}-slot-2`,
          startTime: '22:45',
          endTime: '00:15',
          requiredMusicians: 3,
          genrePreference: GENRES[idx % GENRES.length],
          status: 'libre',
        },
      ],
      status: 'propuesta',
      eventCode,
      createdAt: new Date().toISOString(),
    };
  });

  // 2. Musicians bid across Bars, including counteroffers & schedule clash verification
  venues.forEach((venue, vIdx) => {
    const evTemplate = eventProposals[vIdx];
    const barEmail = venueEmails[venue.id];

    evTemplate.slots.forEach((slot, sIdx) => {
      const musician = musicians[(vIdx + sIdx) % musicians.length];
      const musEmail = musicianEmails[musician.id];
      const currentEv = eventProposals.find((item) => item.id === evTemplate.id)!;

      const clashes = detectMusicianDateClashes({
        musicianId: musician.id,
        targetEvent: currentEv,
        targetSlot: slot,
        eventProposals,
        slotBids,
      });
      if (clashes.length > 0) {
        clashesDetected += clashes.length;
      }

      const bidId = makeUniqueId(`qa-bid-${vIdx + 1}-${sIdx + 1}`);
      const proposedCachet = currentEv.baseCachetARS + (sIdx === 1 ? 10000 : 0);
      const newBid: MusicianSlotBid = {
        id: bidId,
        eventId: currentEv.id,
        slotId: slot.id,
        musicianId: musician.id,
        musicianName: musician.stageName,
        musicianAvatar: musician.avatarUrl,
        proposedCachetARS: proposedCachet,
        cachetType: 'fijo',
        musiciansCount: musician.membersCount,
        equipmentProvided: 'Instrumentos propios',
        equipmentNeeded: 'Monitoreo y consola',
        status: 'pendiente_bar',
        history: [
          {
            id: makeUniqueId('qa-hist'),
            actor: 'musico',
            actorName: musician.stageName,
            cachetARS: proposedCachet,
            cachetType: 'fijo',
            note: 'Postulación generada por Simulador QA.',
            createdAt: new Date().toISOString(),
          },
        ],
        createdAt: new Date().toISOString(),
      };

      const subRes = applyBidSubmissionTransition({
        eventProposals,
        slotBids,
        bid: newBid,
      });

      if (subRes.ok) {
        slotBids = subRes.slotBids;
        eventProposals = subRes.eventProposals;

        pushNotif({
          title: `🎸 Nueva propuesta de ${musician.stageName}`,
          message: `${musician.stageName} se postuló en ${venue.name} (${slot.startTime} a ${slot.endTime} hs).`,
          type: 'application',
          targetRole: 'bar',
          targetEntityId: venue.id,
          targetEmail: barEmail,
        });

        pushEmail({
          to: barEmail,
          fromEmail: musEmail,
          targetRole: 'bar',
          targetEntityId: venue.id,
          senderRole: 'musico',
          senderEntityId: musician.id,
          type: 'proposal_to_bar',
          subject: `🎸 Nueva propuesta musical de ${musician.stageName} para ${currentEv.title}`,
          bodyText: `Horario: ${slot.startTime} a ${slot.endTime} hs • Caché: $${proposedCachet.toLocaleString('es-AR')}`,
        });

        // Counteroffer on slot 2 before acceptance to exercise negotiation notifications/emails
        if (sIdx === 1) {
          const counterRes = applyBidResponseTransition({
            eventProposals,
            slotBids,
            bidId: newBid.id,
            actorRole: 'bar',
            actorEntityId: venue.id,
            action: 'counter',
            counterCachet: currentEv.baseCachetARS,
            note: 'Contraoferta QA al caché base.',
          });
          if (counterRes.ok) {
            slotBids = counterRes.slotBids;
            eventProposals = counterRes.eventProposals;
            pushNotif({
              title: `💬 Contraoferta de ${venue.name}`,
              message: `${venue.name} propuso $${currentEv.baseCachetARS.toLocaleString('es-AR')} para "${currentEv.title}".`,
              type: 'offer',
              targetRole: 'musico',
              targetEntityId: musician.id,
              targetEmail: musEmail,
            });
            pushEmail({
              to: musEmail,
              fromEmail: barEmail,
              targetRole: 'musico',
              targetEntityId: musician.id,
              senderRole: 'bar',
              senderEntityId: venue.id,
              type: 'negotiation_update_musician',
              subject: `💬 Contraoferta de Caché de ${venue.name}`,
              bodyText: `${venue.name} propuso $${currentEv.baseCachetARS.toLocaleString('es-AR')} para "${currentEv.title}".`,
            });

            // Musician accepts bar counteroffer OR bar directly accepts below
            const musAccept = applyBidResponseTransition({
              eventProposals,
              slotBids,
              bidId: newBid.id,
              actorRole: 'musico',
              actorEntityId: musician.id,
              action: 'accept',
              note: 'Músico aceptó contraoferta QA.',
            });
            if (musAccept.ok) {
              slotBids = musAccept.slotBids;
              eventProposals = musAccept.eventProposals;
            }
          }
        } else {
          // Bar directly accepts slot 1
          const accRes = applyBidResponseTransition({
            eventProposals,
            slotBids,
            bidId: newBid.id,
            actorRole: 'bar',
            actorEntityId: venue.id,
            action: 'accept',
            note: 'Acuerdo confirmado en Simulador QA.',
          });
          if (accRes.ok) {
            slotBids = accRes.slotBids;
            eventProposals = accRes.eventProposals;
          }
        }

        pushNotif({
          title: `🤝 ¡Acuerdo confirmado con ${venue.name}!`,
          message: `${venue.name} confirmó tu lugar en "${currentEv.title}" (${slot.startTime} a ${slot.endTime} hs).`,
          type: 'confirmed',
          targetRole: 'musico',
          targetEntityId: musician.id,
          targetEmail: musEmail,
        });
        pushEmail({
          to: musEmail,
          fromEmail: barEmail,
          targetRole: 'musico',
          targetEntityId: musician.id,
          senderRole: 'bar',
          senderEntityId: venue.id,
          type: 'negotiation_update_musician',
          subject: `🎉 ¡Propuesta Aceptada por ${venue.name}!`,
          bodyText: `${venue.name} aceptó tu horario ${slot.startTime} a ${slot.endTime} hs.`,
        });
      }
    });

    // Intentional extra overlap clash check across bars/slots to guarantee clash verification runs
    if (config.includeScheduleClashes && musicians.length > 0 && vIdx === 0) {
      const clashMusician = musicians[0];
      const probeEvent: EventProposal = {
        ...evTemplate,
        id: 'qa-clash-probe-event',
        venueId: venues[venues.length - 1].id,
        venueName: venues[venues.length - 1].name,
      };
      const probeSlot = {
        ...evTemplate.slots[0],
        id: 'qa-clash-probe-slot',
        startTime: '20:45',
        endTime: '23:15',
      };
      const overlap = detectMusicianDateClashes({
        musicianId: clashMusician.id,
        targetEvent: probeEvent,
        targetSlot: probeSlot,
        eventProposals,
        slotBids,
      });
      clashesDetected += overlap.length;
    }

    // 3. Bar publishes the event -> notifies assigned musicians
    const pubTransition = applyPublishEventTransition({
      eventProposals,
      slotBids,
      eventId: evTemplate.id,
    });
    if (pubTransition.ok) {
      eventProposals = pubTransition.eventProposals;
      slotBids = pubTransition.slotBids;

      pubTransition.updatedEvent.slots.forEach((slot) => {
        if (!slot.assignedMusicianId) return;
        const musIdx = musicians.findIndex((m) => m.id === slot.assignedMusicianId);
        const musEmail =
          musIdx >= 0 ? musicianEmails[slot.assignedMusicianId] : `${slot.assignedMusicianId}@degira-qa.test`;

        pushNotif({
          title: `🎉 ¡${pubTransition.updatedEvent.title} ya está en Cartelera!`,
          message: `Tu show en ${venue.name} (${slot.startTime} a ${slot.endTime} hs) ya está publicado para el público.`,
          type: 'confirmed',
          targetRole: 'musico',
          targetEntityId: slot.assignedMusicianId,
          targetEmail: musEmail,
        });

        pushEmail({
          to: musEmail,
          fromEmail: barEmail,
          targetRole: 'musico',
          targetEntityId: slot.assignedMusicianId,
          senderRole: 'bar',
          senderEntityId: venue.id,
          type: 'event_published_musician',
          subject: `🎉 ¡Fecha publicada en Cartelera! ${pubTransition.updatedEvent.title} en ${venue.name}`,
          bodyText: `Horario: ${slot.startTime} a ${slot.endTime} hs • Caché: $${(
            slot.agreedCachetARS || 0
          ).toLocaleString('es-AR')}`,
        });
      });
    }
  });

  // 4. Spectators reserve tickets across published events -> receipts -> QR or expiry
  const publishedEvents = eventProposals.filter(
    (e) => e.status === 'publicada' || e.status === 'agotada'
  );

  if (config.includePaymentsAndQr && publishedEvents.length > 0) {
    publicUsers.forEach((spectator, sIdx) => {
      const targetEvTemplate = publishedEvents[sIdx % publishedEvents.length];
      const targetEv =
        eventProposals.find((e) => e.id === targetEvTemplate.id) || targetEvTemplate;
      const targetVenue = venues.find((v) => v.id === targetEv.venueId) || venues[0];
      const barEmail = venueEmails[targetVenue.id];
      const specEmail = spectatorEmails[spectator.id];
      const partySize = (sIdx % 3) + 1;
      const ticketPrice = targetEv.ticketPriceARS || 8000;
      const totalAmountARS = ticketPrice * partySize;

      const resId = makeUniqueId(`qa-res-${sIdx + 1}`);
      const now = Date.now();
      const shouldExpire = config.spectatorsCount >= 3 && sIdx === config.spectatorsCount - 1;

      const reservation: PublicEventReservation = {
        id: resId,
        eventId: targetEv.id,
        eventTitle: targetEv.title,
        eventCode: targetEv.eventCode,
        venueId: targetEv.venueId,
        venueName: targetEv.venueName,
        venueAddress: targetEv.venueAddress,
        venueNeighborhood: targetEv.venueNeighborhood,
        eventDate: targetEv.date,
        eventStartTime: targetEv.startTime,
        eventEndTime: targetEv.endTime,
        userId: spectator.id,
        userName: spectator.name,
        userEmail: specEmail,
        partySize,
        totalARS: totalAmountARS,
        expiresAt: now + 8 * 60 * 1000,
        status: 'pendiente_pago',
        createdAt: new Date(now).toISOString(),
      };

      publicEventReservations = [...publicEventReservations, reservation];

      pushNotif({
        title: `⏱️ Reserva iniciada en ${targetEv.venueName}`,
        message: `Tenés 8 minutos para subir tu comprobante por $${totalAmountARS.toLocaleString('es-AR')}.`,
        type: 'system',
        targetRole: 'espectador',
        targetEntityId: spectator.id,
        targetEmail: specEmail,
      });

      pushEmail({
        to: specEmail,
        targetRole: 'espectador',
        targetEntityId: spectator.id,
        type: 'reservation_created',
        subject: `⏱️ Reserva iniciada para ${targetEv.title} (Código: ${targetEv.eventCode})`,
        bodyText: `Personas: ${partySize} • Total: $${totalAmountARS.toLocaleString('es-AR')}`,
      });

      if (shouldExpire) {
        const expReservation: PublicEventReservation = {
          ...reservation,
          status: 'expirada',
        };
        publicEventReservations = publicEventReservations.map((r) =>
          r.id === resId ? expReservation : r
        );
        const restored = restoreCapacityOnReservationRelease(targetEv, partySize, 'pendiente_pago');
        eventProposals = eventProposals.map((item) =>
          item.id === targetEv.id ? restored : item
        );
        reservationsExpired += 1;

        pushNotif({
          title: `⌛ Reserva expirada en ${targetEv.venueName}`,
          message: `Se agotó el tiempo de pago para ${targetEv.title}.`,
          type: 'system',
          targetRole: 'espectador',
          targetEntityId: spectator.id,
          targetEmail: specEmail,
        });

        pushEmail({
          to: specEmail,
          targetRole: 'espectador',
          targetEntityId: spectator.id,
          type: 'reservation_expired',
          subject: `⌛ Reserva expirada para ${targetEv.title}`,
          bodyText: `Se liberaron ${partySize} lugares en ${targetEv.venueName}.`,
        });
      } else {
        pushNotif({
          title: `💸 Nuevo comprobante recibido`,
          message: `${spectator.name} subió comprobante para "${targetEv.title}" ($${totalAmountARS.toLocaleString('es-AR')}).`,
          type: 'system',
          targetRole: 'bar',
          targetEntityId: targetVenue.id,
          targetEmail: barEmail,
        });

        pushEmail({
          to: barEmail,
          fromEmail: specEmail,
          targetRole: 'bar',
          targetEntityId: targetVenue.id,
          senderRole: 'espectador',
          senderEntityId: spectator.id,
          type: 'payment_alert_bar',
          subject: `🔔 Nuevo comprobante de pago recibido para ${targetEv.title} (${targetEv.eventCode})`,
          bodyText: `${spectator.name} transfirió $${totalAmountARS.toLocaleString('es-AR')}.`,
        });

        const qrTicketCode = `DG-QR-${targetEv.eventCode}-${sIdx + 101}`;
        const updatedEv = applyPaymentConfirmationToEvent(targetEv, partySize, 'comprobante_subido');
        eventProposals = eventProposals.map((item) =>
          item.id === targetEv.id ? updatedEv : item
        );
        publicEventReservations = publicEventReservations.map((r) =>
          r.id === resId
            ? {
                ...r,
                status: 'confirmada' as const,
                qrTicketCode,
                qrEmailSent: true,
              }
            : r
        );
        reservationsConfirmed += 1;

        pushNotif({
          title: `🎟️ ¡Tu Pase QR está listo!`,
          message: `Pago confirmado en ${targetEv.venueName}. Código: ${qrTicketCode}.`,
          type: 'confirmed',
          targetRole: 'espectador',
          targetEntityId: spectator.id,
          targetEmail: specEmail,
        });

        pushEmail({
          to: specEmail,
          fromEmail: barEmail,
          targetRole: 'espectador',
          targetEntityId: spectator.id,
          senderRole: 'bar',
          senderEntityId: targetVenue.id,
          type: 'qr_ticket',
          subject: `🎟️ Tu entrada y Pase QR para ${targetEv.title} en ${targetEv.venueName}`,
          bodyText: `Código de Acceso: ${qrTicketCode} • Personas: ${partySize}`,
          qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(qrTicketCode)}`,
        });
      }
    });
  }

  // 5. Post-show 360 review notifications & emails for first published event
  if (publishedEvents.length > 0) {
    const firstEv = publishedEvents[0];
    const firstVenue = venues[0];
    const barEmail = venueEmails[firstVenue.id];

    pushNotif({
      title: `⭐ Calificá tu experiencia en ${firstEv.title}`,
      message: `Contanos cómo resultó la fecha "${firstEv.title}".`,
      type: 'review',
      targetRole: 'bar',
      targetEntityId: firstVenue.id,
      targetEmail: barEmail,
    });
    pushEmail({
      to: barEmail,
      targetRole: 'bar',
      targetEntityId: firstVenue.id,
      type: 'review_reminder',
      subject: `⭐ ¿Cómo estuvo ${firstEv.title}? Dejanos tu calificación`,
      bodyText: `Calificá el desempeño de los músicos en ${firstEv.title}.`,
    });

    const firstSlotMusId = firstEv.slots[0]?.assignedMusicianId;
    if (firstSlotMusId) {
      reviews360.push({
        id: makeUniqueId('qa-rev-360'),
        eventId: firstEv.id,
        eventTitle: firstEv.title,
        fromRole: 'bar',
        fromUserId: firstVenue.id,
        fromUserName: firstVenue.name,
        toType: 'musician',
        toId: firstSlotMusId,
        toName: firstEv.slots[0].assignedMusicianName || 'Músico QA',
        rating: 5,
        categoryRatings: { Puntualidad: 5, Sonido: 5, Profesionalismo: 5 },
        comment: 'Excelente show en simulación QA.',
        createdAt: new Date().toISOString(),
      });
    }
  }

  // 6. Audit Venue Ownership Isolation + Notification & Email Scoping across ALL N+M+K actors
  let venueIsolationLeaks = 0;
  venues.forEach((bar) => {
    const visible = getVenuesOwnedByBar({ venues, barOwnerId: bar.id });
    const foreign = visible.filter((v) => v.id !== bar.id && v.ownerBarId !== bar.id);
    if (foreign.length > 0 || visible.length === 0) {
      venueIsolationLeaks += Math.max(1, foreign.length);
    }
  });

  const actorSummaries: SimulatedActorInboxSummary[] = [];
  let notificationLeaks = 0;
  let emailLeaks = 0;

  const auditActor = (
    role: 'bar' | 'musico' | 'espectador',
    id: string,
    displayName: string,
    email: string
  ) => {
    const identity = { role, entityId: id, email, displayName };

    const visibleNotifs = notifications.filter((n) => isNotificationVisibleToProfile(n, identity));
    const leakedNotifs = visibleNotifs.filter(
      (n) =>
        (n.targetEntityId && n.targetEntityId !== id) ||
        (n.targetRole && n.targetRole !== role) ||
        (n.targetEmail && n.targetEmail.toLowerCase() !== email.toLowerCase())
    );

    const visibleEmails = emails.filter((e) => isEmailVisibleToProfile(e, identity));
    const leakedEmails = visibleEmails.filter((e) => {
      const toOwn = e.targetEntityId === id || e.to.toLowerCase() === email.toLowerCase();
      const fromOwn =
        e.senderEntityId === id || (e.fromEmail && e.fromEmail.toLowerCase() === email.toLowerCase());
      return !toOwn && !fromOwn;
    });

    notificationLeaks += leakedNotifs.length;
    emailLeaks += leakedEmails.length;

    actorSummaries.push({
      role,
      id,
      displayName,
      email,
      notificationsCount: visibleNotifs.length,
      unreadNotificationsCount: visibleNotifs.filter((n) => !n.read).length,
      emailsCount: visibleEmails.length,
      leakedNotificationsCount: leakedNotifs.length,
      leakedEmailsCount: leakedEmails.length,
    });
  };

  venues.forEach((v) => auditActor('bar', v.id, v.name, venueEmails[v.id]));
  musicians.forEach((m) => auditActor('musico', m.id, m.stageName, musicianEmails[m.id]));
  publicUsers.forEach((p) => auditActor('espectador', p.id, p.name, spectatorEmails[p.id]));

  const finalPublishedCount = eventProposals.filter(
    (e) => e.status === 'publicada' || e.status === 'agotada'
  ).length;

  const assertions: TestCheckItem[] = [
    {
      label: `Aislamiento estricto de locales (${venues.length} bares)`,
      passed: venueIsolationLeaks === 0,
      detail:
        venueIsolationLeaks === 0
          ? `Ninguno de los ${venues.length} bares ve locales de otro bar.`
          : `Se detectaron ${venueIsolationLeaks} fugas de locales entre bares.`,
    },
    {
      label: `Aislamiento de notificaciones (${actorSummaries.length} usuarios)`,
      passed: notificationLeaks === 0,
      detail:
        notificationLeaks === 0
          ? `${notifications.length} notificaciones auditadas sin cruces entre roles/usuarios.`
          : `Se detectaron ${notificationLeaks} notificaciones filtradas incorrectamente.`,
    },
    {
      label: `Aislamiento de emails (${actorSummaries.length} usuarios)`,
      passed: emailLeaks === 0,
      detail:
        emailLeaks === 0
          ? `${emails.length} emails auditados sin exposición cruzada.`
          : `Se detectaron ${emailLeaks} emails expuestos a usuarios ajenos.`,
    },
    {
      label: 'Flujo multi-rol completo (Eventos, Slots, Reservas QR)',
      passed:
        finalPublishedCount === venues.length &&
        (!config.includePaymentsAndQr || reservationsConfirmed > 0),
      detail: `${finalPublishedCount}/${venues.length} eventos publicados • ${reservationsConfirmed} pases QR confirmados • ${clashesDetected} clashes detectados.`,
    },
  ];

  return {
    id: `qa-sim-${Date.now()}`,
    createdAt: new Date().toISOString(),
    config,
    totalActors: venues.length + musicians.length + publicUsers.length,
    venuesCount: venues.length,
    eventsCreated: eventProposals.length,
    publishedEvents: finalPublishedCount,
    slotsTotal: eventProposals.reduce((acc, ev) => acc + ev.slots.length, 0),
    bidsSubmitted: slotBids.length,
    clashesDetected,
    reservationsCreated: publicEventReservations.length,
    reservationsConfirmed,
    reservationsExpired,
    reviewsSubmitted: reviews360.length,
    notifications,
    emails,
    actorSummaries,
    venueIsolationLeaks,
    notificationLeaks,
    emailLeaks,
    assertions,
    artifacts: {
      venues,
      musicians,
      publicUsers,
      eventProposals,
      slotBids,
      publicEventReservations,
      reviews360,
      notifications,
      emails,
    },
  };
}
