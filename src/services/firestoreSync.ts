import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  Unsubscribe,
} from 'firebase/firestore';
import {
  db,
  OperationType,
  handleFirestoreError,
} from '../lib/firebase.ts';
import {
  VenueProfile,
  EventProposal,
  MusicianSlotBid,
  PublicEventReservation,
  EventReview360,
  EventSlot,
  EventRider,
  MusicianMusicLinks,
  MusicianInputChannel,
} from '../types/index.ts';

function stripUndefined<T extends Record<string, any>>(obj: T): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      result[k] = v;
    }
  }
  return result;
}

function clampString(val: unknown, maxLen: number, fallback = ''): string {
  const str = typeof val === 'string' ? val : fallback;
  return str.slice(0, maxLen);
}

function clampStringArray(arr: unknown, maxItems: number, maxLen = 200): string[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .slice(0, maxItems)
    .map((s) => s.slice(0, maxLen));
}

function sanitizeSlots(slots: EventSlot[]): Record<string, any>[] {
  return slots.slice(0, 20).map((s) =>
    stripUndefined({
      id: clampString(s.id, 128, `slot-${Date.now()}`),
      startTime: clampString(s.startTime, 10, '21:00'),
      endTime: clampString(s.endTime, 10, '23:00'),
      requiredMusicians: Math.max(1, Math.min(30, Number(s.requiredMusicians) || 1)),
      genrePreference: s.genrePreference ? clampString(s.genrePreference, 80) : undefined,
      assignedMusicianId: s.assignedMusicianId ? clampString(s.assignedMusicianId, 128) : undefined,
      assignedMusicianName: s.assignedMusicianName ? clampString(s.assignedMusicianName, 140) : undefined,
      agreedCachetARS: s.agreedCachetARS !== undefined ? Math.max(0, Number(s.agreedCachetARS) || 0) : undefined,
      status: s.status || 'libre',
    })
  );
}

function sanitizeMusicLinks(links?: MusicianMusicLinks): Record<string, string> | undefined {
  if (!links) return undefined;
  const cleaned = stripUndefined({
    spotifyUrl: links.spotifyUrl ? clampString(links.spotifyUrl, 400) : undefined,
    youtubeUrl: links.youtubeUrl ? clampString(links.youtubeUrl, 400) : undefined,
    bandcampUrl: links.bandcampUrl ? clampString(links.bandcampUrl, 400) : undefined,
    soundcloudUrl: links.soundcloudUrl ? clampString(links.soundcloudUrl, 400) : undefined,
    appleMusicUrl: links.appleMusicUrl ? clampString(links.appleMusicUrl, 400) : undefined,
  }) as Record<string, string>;
  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

function sanitizeInputList(inputList?: MusicianInputChannel[]): Record<string, any>[] | undefined {
  if (!Array.isArray(inputList) || inputList.length === 0) return undefined;
  return inputList.slice(0, 32).map((ch, idx) =>
    stripUndefined({
      channel: Number(ch.channel) || idx + 1,
      instrument: clampString(ch.instrument, 100, 'Instrumento'),
      micOrDI: ch.micOrDI || 'Micrófono',
      notes: ch.notes ? clampString(ch.notes, 200) : undefined,
    })
  );
}

function sanitizeVenuePayload(venue: VenueProfile, uid: string): Record<string, any> {
  return stripUndefined({
    id: clampString(venue.id, 128),
    name: clampString(venue.name, 140, 'Bar DeGira'),
    type: clampString(venue.type, 80, 'Bar de Copas'),
    address: clampString(venue.address, 200, 'Buenos Aires'),
    neighborhood: clampString(venue.neighborhood, 80, 'Palermo Soho'),
    coverPhoto: venue.coverPhoto ? clampString(venue.coverPhoto, 600) : undefined,
    photos: clampStringArray(venue.photos, 10, 600),
    bio: venue.bio ? clampString(venue.bio, 1200) : undefined,
    capacity: Math.max(1, Math.min(10000, Number(venue.capacity) || 60)),
    backline: clampStringArray(venue.backline, 30, 140),
    acousticCharacteristics: venue.acousticCharacteristics
      ? clampString(venue.acousticCharacteristics, 500)
      : undefined,
    hospitality: venue.hospitality ? clampString(venue.hospitality, 500) : undefined,
    rating: Number(venue.rating) || 5.0,
    reviewCount: Number(venue.reviewCount) || 0,
    ratingBreakdown: venue.ratingBreakdown || {
      soundQuality: 5,
      paymentReliability: 5,
      hospitality: 5,
      respect: 5,
    },
    venueCbuAlias: venue.venueCbuAlias ? clampString(venue.venueCbuAlias, 120) : undefined,
    defaultRiderTemplate: venue.defaultRiderTemplate,
    visibility: 'public',
    ownerUid: uid,
    createdAtTimestamp: serverTimestamp(),
    updatedAtTimestamp: serverTimestamp(),
  });
}

function sanitizeEventProposalPayload(ev: EventProposal, uid: string): Record<string, any> {
  const safeDate = /^\d{4}-\d{2}-\d{2}$/.test(ev.date) ? ev.date : '2026-11-28';
  return stripUndefined({
    id: clampString(ev.id, 128),
    venueId: clampString(ev.venueId, 128, 'venue-1'),
    venueName: clampString(ev.venueName, 140, 'Bar Test 1'),
    venueAddress: ev.venueAddress ? clampString(ev.venueAddress, 200) : undefined,
    venueNeighborhood: clampString(ev.venueNeighborhood, 80, 'Palermo Soho'),
    venuePhoto: ev.venuePhoto ? clampString(ev.venuePhoto, 600) : undefined,
    title: clampString(ev.title, 160, 'Show en Vivo'),
    date: safeDate,
    startTime: clampString(ev.startTime, 10, '21:00'),
    endTime: clampString(ev.endTime, 10, '23:30'),
    totalCapacity: Math.max(1, Math.min(10000, Number(ev.totalCapacity) || 80)),
    remainingCapacity: Math.max(0, Math.min(Number(ev.totalCapacity) || 80, Number(ev.remainingCapacity) ?? Number(ev.totalCapacity) ?? 80)),
    baseCachetARS: Math.max(0, Number(ev.baseCachetARS) || 0),
    ticketPriceARS: ev.ticketPriceARS !== undefined ? Math.max(0, Number(ev.ticketPriceARS) || 0) : undefined,
    targetGenres: clampStringArray(ev.targetGenres, 12, 60),
    slots: sanitizeSlots(ev.slots),
    rider: ev.rider || {
      stageSize: '5x4 metros',
      soundSystem: 'Consola digital',
      micCount: 4,
      backline: [],
      lighting: 'LED',
    },
    status: ev.status || 'propuesta',
    eventCode: clampString(ev.eventCode, 40, 'DG-BAR1-1000'),
    // Solo IDs opacos en lista de espera (nunca emails PII en documento compartido)
    waitlist: clampStringArray(ev.waitlist, 100, 80).map((item) =>
      item.includes('@') ? `wl-${Math.abs(item.split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7))}` : item
    ),
    cachetPaid: ev.cachetPaid,
    cachetPaidAt: ev.cachetPaidAt ? clampString(ev.cachetPaidAt, 60) : undefined,
    feedbackSentAt: ev.feedbackSentAt ? clampString(ev.feedbackSentAt, 60) : undefined,
    visibility: 'public',
    ownerUid: uid,
    createdAt: clampString(ev.createdAt, 60, new Date().toISOString()),
    createdAtTimestamp: serverTimestamp(),
    updatedAtTimestamp: serverTimestamp(),
  });
}

function sanitizeSlotBidPayload(bid: MusicianSlotBid, uid: string): Record<string, any> {
  return stripUndefined({
    id: clampString(bid.id, 128),
    eventId: clampString(bid.eventId, 128),
    slotId: clampString(bid.slotId, 128),
    musicianId: clampString(bid.musicianId, 128),
    musicianName: clampString(bid.musicianName, 140, 'Músico DeGira'),
    musicianAvatar: bid.musicianAvatar ? clampString(bid.musicianAvatar, 600) : undefined,
    proposedCachetARS: Math.max(0, Number(bid.proposedCachetARS) || 0),
    musiciansCount: Math.max(1, Math.min(30, Number(bid.musiciansCount) || 1)),
    equipmentProvided: clampString(bid.equipmentProvided, 400, 'Instrumentos propios'),
    equipmentNeeded: clampString(bid.equipmentNeeded, 400, 'Sonido de sala'),
    musicLinks: sanitizeMusicLinks(bid.musicLinks),
    inputList: sanitizeInputList(bid.inputList),
    reminderSentAt: bid.reminderSentAt ? clampString(bid.reminderSentAt, 60) : undefined,
    reminderCount: bid.reminderCount !== undefined ? Math.max(0, Number(bid.reminderCount)) : undefined,
    retracted: bid.retracted,
    retractedAt: bid.retractedAt ? clampString(bid.retractedAt, 60) : undefined,
    status: bid.status === 'contraoferta_musico' ? 'contraoferta_musico' : 'pendiente_bar',
    history: (bid.history || []).slice(0, 50).map((h) =>
      stripUndefined({
        id: clampString(h.id, 80, `h-${Date.now()}`),
        actor: h.actor,
        actorName: clampString(h.actorName, 140),
        cachetARS: Math.max(0, Number(h.cachetARS) || 0),
        note: clampString(h.note, 400),
        createdAt: clampString(h.createdAt, 60),
      })
    ),
    visibility: 'public',
    ownerUid: uid,
    createdAt: clampString(bid.createdAt, 60, new Date().toISOString()),
    createdAtTimestamp: serverTimestamp(),
    updatedAtTimestamp: serverTimestamp(),
  });
}

export async function syncVenueCreate(venue: VenueProfile, uid: string): Promise<void> {
  const path = `venues/${venue.id}`;
  try {
    const ref = doc(db, 'venues', venue.id);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, sanitizeVenuePayload(venue, uid));
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function syncVenueRiderUpdate(venueId: string, template: EventRider): Promise<void> {
  const path = `venues/${venueId}`;
  try {
    const ref = doc(db, 'venues', venueId);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(ref, {
        defaultRiderTemplate: template,
        updatedAtTimestamp: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function ensureEventProposalInCloud(ev: EventProposal, uid: string): Promise<void> {
  const path = `eventProposals/${ev.id}`;
  try {
    const ref = doc(db, 'eventProposals', ev.id);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, sanitizeEventProposalPayload(ev, uid));
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function syncEventProposalCreate(ev: EventProposal, uid: string): Promise<void> {
  const path = `eventProposals/${ev.id}`;
  try {
    await setDoc(doc(db, 'eventProposals', ev.id), sanitizeEventProposalPayload(ev, uid));
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function syncEventProposalSlotsAndStatus(
  ev: EventProposal,
  uid: string
): Promise<void> {
  const path = `eventProposals/${ev.id}`;
  try {
    const ref = doc(db, 'eventProposals', ev.id);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, sanitizeEventProposalPayload(ev, uid));
      return;
    }
    await updateDoc(ref, {
      slots: sanitizeSlots(ev.slots),
      status: ev.status,
      updatedAtTimestamp: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function syncEventProposalBarUpdate(
  eventId: string,
  updates: Partial<
    Pick<
      EventProposal,
      'slots' | 'status' | 'remainingCapacity' | 'cachetPaid' | 'cachetPaidAt' | 'feedbackSentAt'
    >
  >,
  fallbackProposal?: EventProposal,
  uid?: string
): Promise<void> {
  const path = `eventProposals/${eventId}`;
  try {
    const ref = doc(db, 'eventProposals', eventId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      if (fallbackProposal && uid) {
        await setDoc(ref, sanitizeEventProposalPayload({ ...fallbackProposal, ...updates }, uid));
      }
      return;
    }
    const patch: Record<string, any> = stripUndefined({
      ...updates,
      ...(updates.slots ? { slots: sanitizeSlots(updates.slots) } : {}),
      updatedAtTimestamp: serverTimestamp(),
    });
    await updateDoc(ref, patch);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function syncEventCapacityOrWaitlist(
  ev: EventProposal,
  uid?: string
): Promise<void> {
  const path = `eventProposals/${ev.id}`;
  try {
    const ref = doc(db, 'eventProposals', ev.id);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      if (uid) {
        await setDoc(ref, sanitizeEventProposalPayload(ev, uid));
      }
      return;
    }
    await updateDoc(ref, {
      remainingCapacity: Math.max(0, Number(ev.remainingCapacity) || 0),
      status: ev.status,
      waitlist: clampStringArray(ev.waitlist, 100, 80).map((item) =>
        item.includes('@') ? `wl-${Math.abs(item.split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7))}` : item
      ),
      updatedAtTimestamp: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function syncSlotBidCreate(
  bid: MusicianSlotBid,
  parentEvent: EventProposal | undefined,
  uid: string
): Promise<void> {
  const path = `slotBids/${bid.id}`;
  try {
    if (parentEvent) {
      await ensureEventProposalInCloud(parentEvent, uid);
    }
    await setDoc(doc(db, 'slotBids', bid.id), sanitizeSlotBidPayload(bid, uid));
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function syncSlotBidMusicianUpdate(
  bid: MusicianSlotBid,
  parentEvent: EventProposal | undefined,
  uid: string
): Promise<void> {
  const path = `slotBids/${bid.id}`;
  try {
    const ref = doc(db, 'slotBids', bid.id);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      if (parentEvent) {
        await ensureEventProposalInCloud(parentEvent, uid);
      }
      await setDoc(ref, sanitizeSlotBidPayload(bid, uid));
      return;
    }
    const patch = stripUndefined({
      status: bid.status,
      proposedCachetARS: Math.max(0, Number(bid.proposedCachetARS) || 0),
      history: bid.history,
      reminderSentAt: bid.reminderSentAt,
      reminderCount: bid.reminderCount,
      retracted: bid.retracted,
      retractedAt: bid.retractedAt,
      updatedAtTimestamp: serverTimestamp(),
    });
    await updateDoc(ref, patch);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function syncSlotBidBarResponse(
  bid: MusicianSlotBid,
  parentEvent: EventProposal | undefined,
  uid: string
): Promise<void> {
  const path = `slotBids/${bid.id}`;
  try {
    const ref = doc(db, 'slotBids', bid.id);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      if (parentEvent) {
        await ensureEventProposalInCloud(parentEvent, uid);
      }
      await setDoc(ref, sanitizeSlotBidPayload({ ...bid, status: 'pendiente_bar' }, uid));
      if (bid.status !== 'pendiente_bar') {
        await updateDoc(ref, {
          status: bid.status,
          proposedCachetARS: Math.max(0, Number(bid.proposedCachetARS) || 0),
          history: bid.history,
          updatedAtTimestamp: serverTimestamp(),
        });
      }
      return;
    }
    await updateDoc(ref, {
      status: bid.status,
      proposedCachetARS: Math.max(0, Number(bid.proposedCachetARS) || 0),
      history: bid.history,
      updatedAtTimestamp: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function syncReservationCreate(
  res: PublicEventReservation,
  parentEvent: EventProposal | undefined,
  uid: string
): Promise<void> {
  const path = `publicEventReservations/${res.id}`;
  try {
    if (parentEvent) {
      await ensureEventProposalInCloud(parentEvent, uid);
    }
    const eventSnap = await getDoc(doc(db, 'eventProposals', res.eventId));
    const venueOwnerUid = eventSnap.exists() ? (eventSnap.data()?.ownerUid as string | undefined) : undefined;

    await setDoc(
      doc(db, 'publicEventReservations', res.id),
      stripUndefined({
        id: clampString(res.id, 128),
        eventId: clampString(res.eventId, 128),
        eventTitle: clampString(res.eventTitle, 160, 'Show en Vivo'),
        eventCode: clampString(res.eventCode, 40, 'DG-BAR1-0000'),
        venueId: clampString(res.venueId, 128),
        venueOwnerUid: venueOwnerUid ? clampString(venueOwnerUid, 128) : undefined,
        venueName: clampString(res.venueName, 140),
        venueAddress: res.venueAddress ? clampString(res.venueAddress, 200) : undefined,
        venueNeighborhood: res.venueNeighborhood ? clampString(res.venueNeighborhood, 80) : undefined,
        eventDate: res.eventDate ? clampString(res.eventDate, 20) : undefined,
        eventStartTime: res.eventStartTime ? clampString(res.eventStartTime, 10) : undefined,
        eventEndTime: res.eventEndTime ? clampString(res.eventEndTime, 10) : undefined,
        userId: clampString(res.userId, 128, 'user-pub-1'),
        userName: clampString(res.userName, 120, 'Espectador'),
        // Sin userEmail en documento compartido (aislamiento PII)
        partySize: Math.max(1, Math.min(50, Number(res.partySize) || 1)),
        totalARS: Math.max(0, Number(res.totalARS) || 0),
        expiresAt: Number(res.expiresAt) || Date.now() + 8 * 60 * 1000,
        status: 'pendiente_pago',
        ownerUid: uid,
        createdAt: clampString(res.createdAt, 60, new Date().toISOString()),
        createdAtTimestamp: serverTimestamp(),
        updatedAtTimestamp: serverTimestamp(),
      })
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function syncReservationSpectatorUpdate(
  res: PublicEventReservation
): Promise<void> {
  const path = `publicEventReservations/${res.id}`;
  try {
    const ref = doc(db, 'publicEventReservations', res.id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    await updateDoc(
      ref,
      stripUndefined({
        status: res.status,
        receiptImage: res.receiptImage ? clampString(res.receiptImage, 450000) : undefined,
        receiptUploadTime: res.receiptUploadTime ? clampString(res.receiptUploadTime, 60) : undefined,
        receiptOcrNotes: res.receiptOcrNotes ? clampString(res.receiptOcrNotes, 500) : undefined,
        updatedAtTimestamp: serverTimestamp(),
      })
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function syncReservationBarUpdate(
  res: PublicEventReservation
): Promise<void> {
  const path = `publicEventReservations/${res.id}`;
  try {
    const ref = doc(db, 'publicEventReservations', res.id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    await updateDoc(
      ref,
      stripUndefined({
        status: res.status,
        qrTicketCode: res.qrTicketCode ? clampString(res.qrTicketCode, 160) : undefined,
        qrEmailSent: res.qrEmailSent,
        checkInStatus: res.checkInStatus,
        checkedInAt: res.checkedInAt ? clampString(res.checkedInAt, 60) : undefined,
        rejectionReason: res.rejectionReason ? clampString(res.rejectionReason, 300) : undefined,
        updatedAtTimestamp: serverTimestamp(),
      })
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function syncReview360Create(
  review: EventReview360,
  parentEvent: EventProposal | undefined,
  uid: string
): Promise<void> {
  const path = `reviews360/${review.id}`;
  try {
    if (parentEvent) {
      await ensureEventProposalInCloud(parentEvent, uid);
    }
    await setDoc(doc(db, 'reviews360', review.id), {
      id: clampString(review.id, 128),
      eventId: clampString(review.eventId, 128),
      eventTitle: clampString(review.eventTitle, 160),
      fromRole: review.fromRole,
      fromUserId: clampString(review.fromUserId, 128),
      fromUserName: clampString(review.fromUserName, 140),
      toType: review.toType,
      toId: clampString(review.toId, 128),
      toName: clampString(review.toName, 140),
      rating: Math.max(1, Math.min(5, Number(review.rating) || 5)),
      categoryRatings: review.categoryRatings || {},
      comment: clampString(review.comment, 1000),
      visibility: 'public',
      ownerUid: uid,
      createdAt: clampString(review.createdAt, 60, new Date().toISOString()),
      createdAtTimestamp: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export interface CloudSubscriptionsCallbacks {
  uid: string;
  onVenues: (venues: VenueProfile[]) => void;
  onEventProposals: (events: EventProposal[]) => void;
  onSlotBids: (bids: MusicianSlotBid[]) => void;
  onReservations: (reservations: PublicEventReservation[]) => void;
  onReviews360: (reviews: EventReview360[]) => void;
}

export function subscribeToCloudState(callbacks: CloudSubscriptionsCallbacks): () => void {
  const unsubs: Unsubscribe[] = [];

  // 1. Venues (visibility == 'public')
  unsubs.push(
    onSnapshot(
      query(collection(db, 'venues'), where('visibility', '==', 'public')),
      (snap) => {
        const items = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            ...data,
            reviews: Array.isArray(data.reviews) ? data.reviews : [],
          } as VenueProfile;
        });
        callbacks.onVenues(items);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'venues')
    )
  );

  // 2. Event Proposals (visibility == 'public')
  unsubs.push(
    onSnapshot(
      query(collection(db, 'eventProposals'), where('visibility', '==', 'public')),
      (snap) => {
        const items = snap.docs.map((d) => d.data() as EventProposal);
        callbacks.onEventProposals(items);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'eventProposals')
    )
  );

  // 3. Slot Bids (visibility == 'public')
  unsubs.push(
    onSnapshot(
      query(collection(db, 'slotBids'), where('visibility', '==', 'public')),
      (snap) => {
        const items = snap.docs.map((d) => d.data() as MusicianSlotBid);
        callbacks.onSlotBids(items);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'slotBids')
    )
  );

  // 4. Reservations (scoped to user/venue slices allowed by Query Enforcer)
  const reservationMap = new Map<string, PublicEventReservation>();
  const emitReservations = () => {
    callbacks.onReservations(Array.from(reservationMap.values()));
  };
  const reservationQueries = [
    query(collection(db, 'publicEventReservations'), where('ownerUid', '==', callbacks.uid)),
    query(collection(db, 'publicEventReservations'), where('venueOwnerUid', '==', callbacks.uid)),
    query(collection(db, 'publicEventReservations'), where('venueId', 'in', ['venue-1', 'venue-2'])),
    query(collection(db, 'publicEventReservations'), where('userId', 'in', ['user-pub-1', 'user-pub-2'])),
  ];
  reservationQueries.forEach((q) => {
    unsubs.push(
      onSnapshot(
        q,
        (snap) => {
          snap.docs.forEach((d) => {
            reservationMap.set(d.id, d.data() as PublicEventReservation);
          });
          emitReservations();
        },
        (error) => handleFirestoreError(error, OperationType.LIST, 'publicEventReservations')
      )
    );
  });

  // 5. Reviews 360 (visibility == 'public')
  unsubs.push(
    onSnapshot(
      query(collection(db, 'reviews360'), where('visibility', '==', 'public')),
      (snap) => {
        const items = snap.docs.map((d) => d.data() as EventReview360);
        callbacks.onReviews360(items);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'reviews360')
    )
  );

  return () => {
    unsubs.forEach((u) => u());
  };
}

export function mergeByIdWithCloudPriority<T extends { id: string; createdAt?: string }>(
  localItems: T[],
  cloudItems: T[]
): T[] {
  if (cloudItems.length === 0) return localItems;
  const byId = new Map<string, T>();
  localItems.forEach((item) => byId.set(item.id, item));
  cloudItems.forEach((item) => {
    const existing = byId.get(item.id);
    if (existing) {
      byId.set(item.id, { ...existing, ...item });
    } else {
      byId.set(item.id, item);
    }
  });
  return Array.from(byId.values()).sort((a, b) => {
    const da = a.createdAt || '';
    const dbStr = b.createdAt || '';
    if (da && dbStr && da !== dbStr) {
      return dbStr.localeCompare(da);
    }
    return b.id.localeCompare(a.id);
  });
}

export async function pushLocalCustomItemsToCloud(params: {
  uid: string;
  venues: VenueProfile[];
  eventProposals: EventProposal[];
  slotBids: MusicianSlotBid[];
  reviews360: EventReview360[];
}): Promise<void> {
  const { uid, venues, eventProposals, slotBids, reviews360 } = params;

  for (const venue of venues) {
    await syncVenueCreate(venue, uid);
  }

  for (const ev of eventProposals) {
    await ensureEventProposalInCloud(ev, uid);
  }

  for (const bid of slotBids) {
    const ref = doc(db, 'slotBids', bid.id);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      const parentEvent = eventProposals.find((e) => e.id === bid.eventId);
      await syncSlotBidCreate(bid, parentEvent, uid);
    }
  }

  for (const rev of reviews360) {
    const ref = doc(db, 'reviews360', rev.id);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      const parentEvent = eventProposals.find((e) => e.id === rev.eventId);
      await syncReview360Create(rev, parentEvent, uid);
    }
  }
}
