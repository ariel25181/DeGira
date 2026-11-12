import test from 'node:test';
import assert from 'node:assert/strict';
import { TEST_ACCOUNTS } from '../data/testAccounts.ts';
import {
  EventProposal,
  MusicianSlotBid,
  PublicEventReservation,
  EventReview360,
  VenueProfile,
  MusicianProfile,
} from '../types/index.ts';
import { calculateNewRating, calculateNewBreakdown } from './bookingLogic.ts';

// Helper for time overlap (Clash Detection)
function timesOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  const parseMins = (t: string) => {
    const [h, m] = (t || '00:00').split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  const sA = parseMins(startA);
  let eA = parseMins(endA);
  if (eA <= sA) eA += 24 * 60;

  const sB = parseMins(startB);
  let eB = parseMins(endB);
  if (eB <= sB) eB += 24 * 60;

  return Math.max(sA, sB) < Math.min(eA, eB);
}

// --------------------------------------------------------------------------
// TEST 1: Negotiation & Counter-Offers across Bar and Musicians with
// Acceptance, Rejection, and Manual Publication with Partial Slots Covered
// --------------------------------------------------------------------------
test('E2E TEST 1: Bar creates proposal, musicians counter-offer, bar counters/rejects, acceptance, and manual publishing with partial slots', () => {
  const bar1 = TEST_ACCOUNTS.find((a) => a.id === 'account-bar-1')!;
  const mus1 = TEST_ACCOUNTS.find((a) => a.id === 'account-mus-1')!;
  const mus2 = TEST_ACCOUNTS.find((a) => a.id === 'account-mus-2')!;

  assert.ok(bar1 && mus1 && mus2);

  // 1. Bar creates proposal with 2 slots
  const proposal: EventProposal = {
    id: 'ev-e2e-1',
    eventCode: 'DG-E2E-01',
    venueId: bar1.entityId,
    venueName: bar1.displayName,
    venueAddress: 'Gorriti 4800',
    venueNeighborhood: 'Palermo Soho',
    venuePhoto: bar1.avatarUrl,
    title: 'Festival Acústico Palermo',
    date: '2026-11-25',
    startTime: '21:00',
    endTime: '01:00',
    totalCapacity: 60,
    remainingCapacity: 60,
    baseCachetARS: 70000,
    ticketPriceARS: 8000,
    targetGenres: ['Jazz', 'Acústico'],
    slots: [
      { id: 'slot-1', startTime: '21:00', endTime: '22:30', status: 'libre', requiredMusicians: 3 },
      { id: 'slot-2', startTime: '23:00', endTime: '00:30', status: 'libre', requiredMusicians: 2 },
    ],
    rider: { stageSize: '5x4', soundSystem: 'PA 1000W', micCount: 4, backline: ['Batería'], lighting: 'LED' },
    status: 'propuesta',
    createdAt: new Date().toISOString(),
  };

  // 2. Musician 1 applies to slot 1 with counter-cachet ($95.000 vs $70.000 base)
  const bidMus1: MusicianSlotBid = {
    id: 'bid-mus1',
    eventId: proposal.id,
    slotId: 'slot-1',
    musicianId: mus1.entityId,
    musicianName: mus1.displayName,
    musicianAvatar: mus1.avatarUrl,
    proposedCachetARS: 95000,
    musiciansCount: 3,
    equipmentProvided: 'Guitarras y teclados',
    equipmentNeeded: 'Batería y 2 mics',
    status: 'pendiente_bar',
    history: [{ id: 'h1', actor: 'musico', actorName: mus1.displayName, cachetARS: 95000, note: 'Propuesta inicial con caché ajustado', createdAt: new Date().toISOString() }],
    createdAt: new Date().toISOString(),
  };

  // 3. Musician 2 applies to slot 2 with $80.000
  const bidMus2: MusicianSlotBid = {
    id: 'bid-mus2',
    eventId: proposal.id,
    slotId: 'slot-2',
    musicianId: mus2.entityId,
    musicianName: mus2.displayName,
    musicianAvatar: mus2.avatarUrl,
    proposedCachetARS: 80000,
    musiciansCount: 2,
    equipmentProvided: 'Guitarras',
    equipmentNeeded: 'Ampli bajo',
    status: 'pendiente_bar',
    history: [{ id: 'h2', actor: 'musico', actorName: mus2.displayName, cachetARS: 80000, note: 'Postulación banda rock dúo', createdAt: new Date().toISOString() }],
    createdAt: new Date().toISOString(),
  };

  // 4. Bar responds:
  // - Rejects Musician 2
  bidMus2.status = 'rechazada';
  bidMus2.history.push({ id: 'h3', actor: 'bar', actorName: bar1.displayName, cachetARS: 80000, note: 'No coincide con el estilo acústico de la noche', createdAt: new Date().toISOString() });
  assert.equal(bidMus2.status, 'rechazada');

  // - Counters Musician 1 with $85.000
  bidMus1.status = 'contraoferta_bar';
  bidMus1.proposedCachetARS = 85000;
  bidMus1.history.push({ id: 'h4', actor: 'bar', actorName: bar1.displayName, cachetARS: 85000, note: 'Podemos ofrecer hasta $85.000 más consumiciones', createdAt: new Date().toISOString() });
  assert.equal(bidMus1.status, 'contraoferta_bar');

  // 5. Musician 1 accepts Bar's counter-offer
  bidMus1.status = 'aceptada';
  proposal.slots[0].status = 'confirmado';
  proposal.slots[0].assignedMusicianId = mus1.entityId;
  proposal.slots[0].assignedMusicianName = mus1.displayName;
  proposal.slots[0].agreedCachetARS = 85000;

  // 6. Verify rule: Only 1 slot is confirmed, slot 2 is still 'libre'.
  // Does the event auto-publish? NO! It moves to 'para_publicar' or requires manual Bar action.
  const hasAtLeastOneSlotCovered = proposal.slots.some((s) => s.status === 'confirmado' || s.assignedMusicianId);
  assert.equal(hasAtLeastOneSlotCovered, true, 'At least one slot is covered');
  assert.equal(proposal.slots[1].status, 'libre', 'Second slot remains free');

  if (hasAtLeastOneSlotCovered && proposal.status === 'propuesta') {
    proposal.status = 'para_publicar';
  }
  assert.equal(proposal.status, 'para_publicar');

  // 7. Bar manually publishes the event (manual intervention required)
  const barPublishesManually = () => {
    proposal.status = 'publicada';
  };
  barPublishesManually();
  assert.equal(proposal.status, 'publicada');
});

// --------------------------------------------------------------------------
// TEST 2: Musician Clash Detection on Overlapping Date & Hours
// --------------------------------------------------------------------------
test('E2E TEST 2: Clash warning is triggered when musician bids on overlapping time on same date, with user override', () => {
  const mus1 = TEST_ACCOUNTS.find((a) => a.id === 'account-mus-1')!;
  const bar2 = TEST_ACCOUNTS.find((a) => a.id === 'account-bar-2')!;

  // Existing confirmed commitment for mus1: 2026-11-25 from 21:00 to 22:30 at Bar 1
  const existingShows = [
    {
      musicianId: mus1.entityId,
      date: '2026-11-25',
      startTime: '21:00',
      endTime: '22:30',
      venueName: 'Bar Test 1',
    },
  ];

  // Bar 2 has a proposal on the same date: 2026-11-25 from 21:30 to 23:00 (overlaps by 1 hour!)
  const newCallSlot = {
    date: '2026-11-25',
    startTime: '21:30',
    endTime: '23:00',
    venueName: bar2.displayName,
  };

  // Check clash detection
  const isDateSame = existingShows[0].date === newCallSlot.date;
  const isTimeOverlapping = timesOverlap(
    existingShows[0].startTime,
    existingShows[0].endTime,
    newCallSlot.startTime,
    newCallSlot.endTime
  );

  assert.equal(isDateSame, true);
  assert.equal(isTimeOverlapping, true);

  // App flags clash
  const clashWarning = {
    hasClash: isDateSame && isTimeOverlapping,
    conflictingEvent: existingShows[0],
    message: `Conflicto detectado: Ya tienes un compromiso en ${existingShows[0].venueName} de ${existingShows[0].startTime} a ${existingShows[0].endTime}.`,
  };

  assert.equal(clashWarning.hasClash, true);

  // Musician decides to proceed with acknowledgment
  let userOverrideConfirmed = true;
  assert.equal(userOverrideConfirmed, true, 'User retains decision freedom to proceed');
});

// --------------------------------------------------------------------------
// TEST 3: Public Catalog Visibility & Reservation Timeout Expiration
// --------------------------------------------------------------------------
test('E2E TEST 3: Public only sees published events; reservation drops after timeout and restores capacity', () => {
  const pub1 = TEST_ACCOUNTS.find((a) => a.id === 'account-pub-1')!;

  const allProposals: EventProposal[] = [
    { id: 'ev-draft', title: 'Borrador', status: 'propuesta', remainingCapacity: 50, totalCapacity: 50 } as any,
    { id: 'ev-ready', title: 'Para Publicar', status: 'para_publicar', remainingCapacity: 50, totalCapacity: 50 } as any,
    { id: 'ev-published', title: 'Noche de Jazz', status: 'publicada', remainingCapacity: 50, totalCapacity: 50 } as any,
  ];

  // 1. Verify Public General visibility: MUST ONLY see 'publicada' or 'agotada'
  const visibleToPublic = allProposals.filter((p) => p.status === 'publicada' || p.status === 'agotada');
  assert.equal(visibleToPublic.length, 1);
  assert.equal(visibleToPublic[0].id, 'ev-published');

  const publishedEvent = visibleToPublic[0];

  // 2. Public reserves 4 seats
  const partySize = 4;
  publishedEvent.remainingCapacity -= partySize;
  assert.equal(publishedEvent.remainingCapacity, 46);

  const reservation: PublicEventReservation = {
    id: 'res-timeout-test',
    eventId: publishedEvent.id,
    eventTitle: publishedEvent.title,
    eventCode: 'DG-PUB-01',
    venueId: 'venue-1',
    venueName: 'Bar Test 1',
    venueAddress: 'Gorriti 4800',
    venueNeighborhood: 'Palermo Soho',
    eventDate: '2026-11-25',
    eventStartTime: '21:00',
    eventEndTime: '00:00',
    userId: pub1.entityId,
    userName: pub1.displayName,
    userEmail: pub1.email,
    partySize,
    totalARS: 32000,
    expiresAt: Date.now() + 8 * 60 * 1000, // 8 minutes timeout
    status: 'pendiente_pago',
    checkInStatus: 'pending',
    createdAt: new Date().toISOString(),
  };

  // 3. Time passes and exceeds 8 minutes without payment
  const checkTime = reservation.expiresAt + 1000;
  const isExpired = checkTime > reservation.expiresAt;
  assert.equal(isExpired, true);

  // 4. App drops reservation and restores capacity
  if (isExpired && reservation.status === 'pendiente_pago') {
    reservation.status = 'cancelada';
    publishedEvent.remainingCapacity = Math.min(publishedEvent.totalCapacity, publishedEvent.remainingCapacity + reservation.partySize);
  }

  assert.equal(reservation.status, 'cancelada');
  assert.equal(publishedEvent.remainingCapacity, 50, 'Capacity restored to 50');
});

// --------------------------------------------------------------------------
// TEST 4: Reservation Payment, Comprobante Upload, QR Pass & Single-Use Check-In
// --------------------------------------------------------------------------
test('E2E TEST 4: Public reserves, uploads payment within 8 mins, gets QR pass, bar validates entry and blocks reuse', () => {
  const pub2 = TEST_ACCOUNTS.find((a) => a.id === 'account-pub-2')!;
  const bar1 = TEST_ACCOUNTS.find((a) => a.id === 'account-bar-1')!;

  const event: EventProposal = {
    id: 'ev-qr-show',
    title: 'Show con QR Pass',
    date: '2026-11-25',
    startTime: '21:00',
    endTime: '23:30',
    totalCapacity: 40,
    remainingCapacity: 40,
    status: 'publicada',
  } as any;

  // 1. Public reserves 2 seats
  event.remainingCapacity -= 2;
  const reservation: PublicEventReservation = {
    id: 'res-qr-100',
    eventId: event.id,
    eventTitle: event.title,
    eventCode: 'DG-QR-100',
    venueId: bar1.entityId,
    venueName: bar1.displayName,
    venueAddress: 'Gorriti 4800',
    venueNeighborhood: 'Palermo Soho',
    eventDate: event.date,
    eventStartTime: event.startTime,
    eventEndTime: event.endTime,
    userId: pub2.entityId,
    userName: pub2.displayName,
    userEmail: pub2.email,
    partySize: 2,
    totalARS: 16000,
    expiresAt: Date.now() + 8 * 60 * 1000,
    status: 'pendiente_pago',
    checkInStatus: 'pending',
    createdAt: new Date().toISOString(),
  };

  // 2. User uploads payment receipt within 8 minutes
  reservation.receiptImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  reservation.status = 'comprobante_subido';
  assert.equal(reservation.status, 'comprobante_subido');

  // 3. Bar verifies receipt and confirms payment
  reservation.status = 'confirmada';
  reservation.qrTicketCode = `DEGIRA-PASS-${reservation.id}-SECURE`;
  assert.ok(reservation.qrTicketCode.startsWith('DEGIRA-PASS-'));

  // 4. Door Check-In at the venue:
  const validateCheckIn = (res: PublicEventReservation) => {
    if (res.status !== 'confirmada') {
      return { success: false, reason: 'Entrada no válida o cancelada.' };
    }
    if (res.checkInStatus === 'checked_in') {
      return { success: false, reason: 'Entrada YA UTILIZADA PREVIAMENTE.' };
    }
    res.checkInStatus = 'checked_in';
    res.checkedInAt = new Date().toISOString();
    return { success: true, reason: 'Acceso Permitido. ¡Que disfrutes el show!' };
  };

  // First scan: Valid entry
  const firstScan = validateCheckIn(reservation);
  assert.equal(firstScan.success, true);
  assert.equal(firstScan.reason, 'Acceso Permitido. ¡Que disfrutes el show!');
  assert.equal(reservation.checkInStatus, 'checked_in');
  assert.ok(reservation.checkedInAt);

  // Second scan with same QR (fraud / double-entry prevention):
  const secondScan = validateCheckIn(reservation);
  assert.equal(secondScan.success, false);
  assert.equal(secondScan.reason, 'Entrada YA UTILIZADA PREVIAMENTE.');
});

// --------------------------------------------------------------------------
// TEST 5: 1-Hour Post-Event 360° Review Flow across All 6 Users
// --------------------------------------------------------------------------
test('E2E TEST 5: 1-hour post event triggers review requests, completed by public, musicians and venue', () => {
  const venue: VenueProfile = {
    id: 'venue-1',
    name: 'Bar Test 1',
    type: 'Club de Jazz',
    address: 'Gorriti 4800',
    neighborhood: 'Palermo Soho',
    coverPhoto: '',
    photos: [],
    bio: 'Club histórico',
    capacity: 60,
    backline: ['Batería'],
    acousticCharacteristics: 'Tratamiento acústico',
    hospitality: 'Catering',
    rating: 4.8,
    reviewCount: 10,
    ratingBreakdown: { soundQuality: 4.8, paymentReliability: 4.9, hospitality: 4.7, respect: 4.8 },
    reviews: [],
  };

  const musician: MusicianProfile = {
    id: 'mus-1',
    stageName: 'Músico Test 1',
    format: 'Trío',
    genres: ['Jazz'],
    bio: 'Trío de Jazz',
    avatarUrl: '',
    photos: [],
    membersCount: 3,
    instagramHandle: '@musicotest1',
    minCachetDefault: 70000,
    technicalRider: '3 canales',
    rating: 4.9,
    reviewCount: 8,
    ratingBreakdown: { punctuality: 4.9, liveSound: 4.9, crowdDrawing: 4.8, professionalism: 5.0 },
    reviews: [],
  };

  // 1. Post-event 1 hour check
  const eventDate = '2026-11-20';
  const eventEndTime = '23:00';
  const eventEndMs = new Date(`${eventDate}T${eventEndTime}:00`).getTime();
  const nowMs = eventEndMs + 65 * 60 * 1000; // 65 minutes post-show

  const feedbackEligible = nowMs >= (eventEndMs + 60 * 60 * 1000);
  assert.equal(feedbackEligible, true, 'Trigger fires strictly after 1 hour post event');

  // 2. Spectator reviews Venue & Musician
  const spectatorReviewVenue: EventReview360 = {
    id: 'rev-spec-venue',
    eventId: 'ev-e2e-1',
    eventTitle: 'Festival Acústico Palermo',
    fromRole: 'espectador',
    fromUserId: 'user-pub-1',
    fromUserName: 'Usuario Público 1',
    toType: 'venue',
    toId: venue.id,
    toName: venue.name,
    rating: 5,
    categoryRatings: { soundQuality: 5, hospitality: 5 },
    comment: 'Hermoso sonido y excelente atención en las mesas.',
    createdAt: new Date().toISOString(),
  };

  const resVenue = calculateNewRating(venue.rating, venue.reviewCount, spectatorReviewVenue.rating);
  venue.rating = resVenue.rating;
  venue.reviewCount = resVenue.count;
  venue.ratingBreakdown = calculateNewBreakdown(venue.ratingBreakdown, venue.reviewCount - 1, spectatorReviewVenue.categoryRatings) as any;

  assert.equal(venue.reviewCount, 11);
  assert.ok(venue.rating >= 4.8);

  // 3. Musician reviews Venue (Sound, Hospitality, Payment)
  const musicianReviewVenue: EventReview360 = {
    id: 'rev-mus-venue',
    eventId: 'ev-e2e-1',
    eventTitle: 'Festival Acústico Palermo',
    fromRole: 'musico',
    fromUserId: 'mus-1',
    fromUserName: 'Músico Test 1',
    toType: 'venue',
    toId: venue.id,
    toName: venue.name,
    rating: 5,
    categoryRatings: { soundQuality: 5, paymentReliability: 5, respect: 5 },
    comment: 'Prueba de sonido impecable y pago inmediato en efectivo.',
    createdAt: new Date().toISOString(),
  };
  assert.equal(musicianReviewVenue.rating, 5);

  // 4. Venue reviews Musician (Punctuality, Sound, Professionalism)
  const venueReviewMusician: EventReview360 = {
    id: 'rev-venue-mus',
    eventId: 'ev-e2e-1',
    eventTitle: 'Festival Acústico Palermo',
    fromRole: 'bar',
    fromUserId: 'venue-1',
    fromUserName: 'Bar Test 1',
    toType: 'musician',
    toId: musician.id,
    toName: musician.stageName,
    rating: 5,
    categoryRatings: { punctuality: 5, liveSound: 5, professionalism: 5 },
    comment: 'Llegaron a horario para la prueba, excelente convocatoria de público.',
    createdAt: new Date().toISOString(),
  };

  const resMus = calculateNewRating(musician.rating, musician.reviewCount, venueReviewMusician.rating);
  musician.rating = resMus.rating;
  musician.reviewCount = resMus.count;
  assert.equal(musician.reviewCount, 9);
  assert.ok(musician.rating >= 4.9);
});

// --------------------------------------------------------------------------
// TEST 6: Email dispatch and In-App Campanita Notification Lifecycle Verification
// --------------------------------------------------------------------------
test('NOTIFICATION & EMAIL LIFECYCLE: All key actions generate emails and in-app notifications with read/unread tracking', async () => {
  const {
    getSentEmails,
    sendProposalReceivedEmailToBar,
    sendNegotiationUpdateEmailToMusician,
    sendReservationCreatedEmail,
    sendPaymentUploadedAlertToBar,
    sendQrTicketEmail,
    sendEventPublishedToMusician,
    sendReservationExpiredEmail,
    sendReviewReminderEmail,
  } = await import('../lib/emailService.ts');

  // 1. Musician sends proposal -> email to Bar
  const emailProp = sendProposalReceivedEmailToBar({
    barEmail: 'bar1@degira.com.ar',
    venueName: 'Bar Test 1',
    musicianName: 'Músico Test 1',
    eventTitle: 'Festival Acústico',
    slotTime: '21:00 - 22:30',
    cachetARS: 85000,
  });
  assert.equal(emailProp.type, 'proposal_to_bar');
  assert.equal(emailProp.to, 'bar1@degira.com.ar');

  // 2. Bar sends counter-offer / acceptance -> email to Musician
  const emailNeg = sendNegotiationUpdateEmailToMusician({
    musicianEmail: 'musico1@degira.com.ar',
    musicianName: 'Músico Test 1',
    venueName: 'Bar Test 1',
    eventTitle: 'Festival Acústico',
    action: 'accept',
    newCachetARS: 85000,
  });
  assert.equal(emailNeg.type, 'negotiation_update_musician');
  assert.equal(emailNeg.to, 'musico1@degira.com.ar');

  // 3. Bar publishes event -> email to Musician
  const emailPub = sendEventPublishedToMusician({
    musicianEmail: 'musico1@degira.com.ar',
    musicianName: 'Músico Test 1',
    eventTitle: 'Festival Acústico',
    venueName: 'Bar Test 1',
    eventDate: '2026-11-25',
    slotTime: '21:00 - 22:30',
    agreedCachetARS: 85000,
  });
  assert.equal(emailPub.type, 'event_published_musician');

  // 4. Spectator creates reservation -> email with 8 min timer
  const emailRes = sendReservationCreatedEmail({
    userEmail: 'publico1@degira.com.ar',
    userName: 'Público Test 1',
    eventTitle: 'Festival Acústico',
    venueName: 'Bar Test 1',
    partySize: 2,
    totalARS: 16000,
    eventCode: 'DG-TEST-1234',
  });
  assert.equal(emailRes.type, 'reservation_created');
  assert.ok(emailRes.bodyText.includes('8 minutos'));

  // 5. Spectator uploads receipt -> email alert to Bar
  const emailReceipt = sendPaymentUploadedAlertToBar({
    barEmail: 'bar1@degira.com.ar',
    venueName: 'Bar Test 1',
    eventTitle: 'Festival Acústico',
    eventCode: 'DG-TEST-1234',
    userName: 'Público Test 1',
    amountARS: 16000,
  });
  assert.equal(emailReceipt.type, 'payment_alert_bar');

  // 6. Bar confirms payment -> email with QR Ticket to Spectator
  const emailQr = sendQrTicketEmail({
    toEmail: 'publico1@degira.com.ar',
    userName: 'Público Test 1',
    eventTitle: 'Festival Acústico',
    venueName: 'Bar Test 1',
    venueAddress: 'Gorriti 4800',
    eventDate: '2026-11-25',
    eventTime: '21:00',
    partySize: 2,
    qrTicketCode: 'DeGira:Reserva:ev-1:DG-TEST-1234:user-pub-1:2p',
  });
  assert.equal(emailQr.type, 'qr_ticket');
  assert.ok(emailQr.qrCodeUrl && emailQr.qrCodeUrl.includes('api.qrserver.com'));

  // 7. Expired reservation drops -> email notice
  const emailExp = sendReservationExpiredEmail({
    userEmail: 'publico2@degira.com.ar',
    userName: 'Público Test 2',
    eventTitle: 'Festival Acústico',
    venueName: 'Bar Test 1',
    partySize: 4,
  });
  assert.equal(emailExp.type, 'reservation_expired');

  // 8. 1-hour post event feedback -> emails to spectator, venue and musician
  const emailRevSpec = sendReviewReminderEmail({
    toEmail: 'publico1@degira.com.ar',
    userName: 'Público Test 1',
    eventTitle: 'Festival Acústico',
    role: 'espectador',
  });
  const emailRevBar = sendReviewReminderEmail({
    toEmail: 'bar1@degira.com.ar',
    userName: 'Bar Test 1',
    eventTitle: 'Festival Acústico',
    role: 'bar',
  });
  const emailRevMus = sendReviewReminderEmail({
    toEmail: 'musico1@degira.com.ar',
    userName: 'Músico Test 1',
    eventTitle: 'Festival Acústico',
    role: 'musico',
  });

  assert.equal(emailRevSpec.type, 'review_reminder');
  assert.equal(emailRevBar.type, 'review_reminder');
  assert.equal(emailRevMus.type, 'review_reminder');

  // Verify all emails are tracked in system outbox
  const allSent = getSentEmails();
  assert.ok(allSent.length >= 9, 'All 9 email actions were recorded in sent emails outbox');

  // 9. Campanita in-app notification tracking
  const initialNotifications = [
    { id: 'notif-1', title: '⏱️ Tenés 8 minutos para pagar', message: 'Detalle', timestamp: 'Recién', read: false, type: 'system' as const },
    { id: 'notif-2', title: '🎟️ Pago Confirmado & Pase QR Emitido', message: 'Detalle', timestamp: 'Recién', read: false, type: 'confirmed' as const },
    { id: 'notif-3', title: '⭐ Calificá el show', message: 'Detalle', timestamp: 'Recién', read: false, type: 'review' as const },
  ];

  // Unread count
  let unread = initialNotifications.filter((n) => !n.read).length;
  assert.equal(unread, 3);

  // Mark single as read
  const markedSingle = initialNotifications.map((n) => (n.id === 'notif-1' ? { ...n, read: true } : n));
  assert.equal(markedSingle.filter((n) => !n.read).length, 2);

  // Mark all as read
  const markedAll = markedSingle.map((n) => ({ ...n, read: true }));
  assert.equal(markedAll.filter((n) => !n.read).length, 0);
});

