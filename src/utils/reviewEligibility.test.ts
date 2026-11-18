import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REVIEW_UNLOCK_DELAY_MS,
  getEventEndTimestampMs,
  getReviewAvailability,
  getPendingReviewsForRole,
} from './reviewEligibility.ts';
import type {
  EventProposal,
  EventReview360,
  LiveShowConfirmed,
  PublicEventReservation,
} from '../types/index.ts';

function makeEventProposal(overrides: Partial<EventProposal> = {}): EventProposal {
  return {
    id: 'ev-test-1',
    venueId: 'venue-1',
    venueName: 'Bar Test 1',
    venueAddress: 'Honduras 4800',
    venueNeighborhood: 'Palermo Soho',
    venuePhoto: 'https://example.com/venue.jpg',
    title: 'Noche de Jazz & Soul',
    date: '2026-11-17',
    startTime: '20:00',
    endTime: '22:30',
    totalCapacity: 50,
    remainingCapacity: 10,
    baseCachetARS: 95000,
    ticketPriceARS: 7500,
    targetGenres: ['Jazz'],
    slots: [
      {
        id: 'slot-1',
        startTime: '20:30',
        endTime: '22:30',
        requiredMusicians: 1,
        assignedMusicianId: 'mus-1',
        assignedMusicianName: 'Músico Test 1',
        agreedCachetARS: 95000,
        status: 'confirmado',
      },
    ],
    rider: {
      stageSize: '6x4m',
      soundSystem: 'PA 1000W',
      micCount: 4,
      backline: ['Batería'],
      lighting: 'LED',
    },
    status: 'publicada',
    eventCode: 'DG-BAR1-9999',
    createdAt: '2026-11-01',
    ...overrides,
  };
}

function makeConfirmedReservation(
  overrides: Partial<PublicEventReservation> = {}
): PublicEventReservation {
  return {
    id: 'res-test-1',
    eventId: 'ev-test-1',
    eventTitle: 'Noche de Jazz & Soul',
    eventCode: 'DG-BAR1-9999',
    venueId: 'venue-1',
    venueName: 'Bar Test 1',
    venueAddress: 'Honduras 4800',
    venueNeighborhood: 'Palermo Soho',
    eventDate: '2026-11-17',
    eventStartTime: '20:00',
    eventEndTime: '22:30',
    userId: 'user-pub-1',
    userName: 'Usuario Público 1',
    userEmail: 'publico1@degira.com.ar',
    partySize: 2,
    totalARS: 15000,
    expiresAt: Date.now() + 60000,
    status: 'confirmada',
    createdAt: '2026-11-10',
    ...overrides,
  };
}

test('getEventEndTimestampMs calculates same-day and midnight-crossing end times accurately', () => {
  const sameDayEnd = getEventEndTimestampMs('2026-11-17', '20:00', '22:30');
  assert.equal(sameDayEnd, new Date(2026, 10, 17, 22, 30, 0, 0).getTime());

  const overnightEnd = getEventEndTimestampMs('2026-11-17', '21:00', '01:00');
  assert.equal(overnightEnd, new Date(2026, 10, 18, 1, 0, 0, 0).getTime());

  const defaultDurationEnd = getEventEndTimestampMs('2026-11-17', '21:30 hs');
  assert.equal(defaultDurationEnd, new Date(2026, 10, 18, 0, 0, 0, 0).getTime());
});

test('getReviewAvailability enforces strict 2-hour delay after event ends', () => {
  const endMs = getEventEndTimestampMs('2026-11-17', '20:00', '22:30');

  // Ongoing (before end)
  const beforeEnd = getReviewAvailability(endMs, endMs - 30 * 60 * 1000);
  assert.equal(beforeEnd.hasEnded, false);
  assert.equal(beforeEnd.isAvailable, false);

  // Ended 1h 59m ago -> still locked
  const almostTwoHours = getReviewAvailability(endMs, endMs + REVIEW_UNLOCK_DELAY_MS - 60 * 1000);
  assert.equal(almostTwoHours.hasEnded, true);
  assert.equal(almostTwoHours.isAvailable, false);
  assert.match(almostTwoHours.waitLabel, /Disponible en 1m/);

  // Ended 90m ago -> locked with 30m remaining
  const ninetyMinutesAgo = getReviewAvailability(endMs, endMs + 90 * 60 * 1000);
  assert.equal(ninetyMinutesAgo.hasEnded, true);
  assert.equal(ninetyMinutesAgo.isAvailable, false);
  assert.match(ninetyMinutesAgo.waitLabel, /Disponible en 30m/);

  // Exactly 2 hours after ending -> unlocked
  const exactlyTwoHours = getReviewAvailability(endMs, endMs + REVIEW_UNLOCK_DELAY_MS);
  assert.equal(exactlyTwoHours.hasEnded, true);
  assert.equal(exactlyTwoHours.isAvailable, true);
  assert.equal(exactlyTwoHours.waitLabel, 'Disponible ahora');
});

test('getPendingReviewsForRole separates waitingWindow (<2h) vs availableNow (>=2h) and ignores future shows', () => {
  const pastUnlocked = makeEventProposal({
    id: 'ev-past-unlocked',
    date: '2026-11-17',
    startTime: '20:00',
    endTime: '22:30',
  });
  const recentlyEnded = makeEventProposal({
    id: 'ev-recently-ended',
    date: '2026-11-18',
    startTime: '11:00',
    endTime: '13:00',
    title: 'Matinée Jazz',
  });
  const futureEvent = makeEventProposal({
    id: 'ev-future',
    date: '2026-11-25',
    startTime: '21:00',
    endTime: '01:00',
    title: 'Show Futuro',
  });

  // nowMs = 2026-11-18 14:15 (1h15m after recentlyEnded, 15h45m after pastUnlocked)
  const nowMs = new Date(2026, 10, 18, 14, 15, 0, 0).getTime();

  const barSummary = getPendingReviewsForRole({
    role: 'bar',
    activeVenueId: 'venue-1',
    eventProposals: [pastUnlocked, recentlyEnded, futureEvent],
    liveShows: [],
    publicEventReservations: [],
    reviews360: [],
    nowMs,
  });

  assert.equal(barSummary.availableNow.length, 1);
  assert.equal(barSummary.availableNow[0].eventId, 'ev-past-unlocked');
  assert.equal(barSummary.waitingWindow.length, 1);
  assert.equal(barSummary.waitingWindow[0].eventId, 'ev-recently-ended');
  assert.match(barSummary.waitingWindow[0].availability.waitLabel, /Disponible en 45m/);
});

test('getPendingReviewsForRole scopes items per user/role and removes items once reviewed', () => {
  const ev = makeEventProposal({ id: 'ev-scope-1' });
  const nowMs = new Date(2026, 10, 18, 14, 0, 0, 0).getTime();

  // Another venue (venue-2) and another musician (mus-2) did not participate
  const otherBar = getPendingReviewsForRole({
    role: 'bar',
    activeVenueId: 'venue-2',
    eventProposals: [ev],
    liveShows: [],
    publicEventReservations: [],
    reviews360: [],
    nowMs,
  });
  assert.equal(otherBar.availableNow.length, 0);

  const otherMusician = getPendingReviewsForRole({
    role: 'musico',
    activeMusicianId: 'mus-2',
    eventProposals: [ev],
    liveShows: [],
    publicEventReservations: [],
    reviews360: [],
    nowMs,
  });
  assert.equal(otherMusician.availableNow.length, 0);

  // Participating spectator sees pending review until they submit it
  const res = makeConfirmedReservation({ eventId: 'ev-scope-1', userId: 'user-pub-1' });
  const spectatorBefore = getPendingReviewsForRole({
    role: 'espectador',
    activePublicUserId: 'user-pub-1',
    eventProposals: [ev],
    liveShows: [],
    publicEventReservations: [res],
    reviews360: [],
    nowMs,
  });
  assert.equal(spectatorBefore.availableNow.length, 1);

  const reviewSubmitted: EventReview360 = {
    id: 'rev-1',
    eventId: 'ev-scope-1',
    eventTitle: ev.title,
    fromRole: 'espectador',
    fromUserId: 'user-pub-1',
    fromUserName: 'Usuario Público 1',
    toType: 'venue',
    toId: 'venue-1',
    toName: 'Bar Test 1',
    rating: 5,
    categoryRatings: { atencion: 5 },
    comment: 'Excelente',
    createdAt: '2026-11-18',
  };

  const spectatorAfter = getPendingReviewsForRole({
    role: 'espectador',
    activePublicUserId: 'user-pub-1',
    eventProposals: [ev],
    liveShows: [],
    publicEventReservations: [res],
    reviews360: [reviewSubmitted],
    nowMs,
  });
  assert.equal(spectatorAfter.availableNow.length, 0);

  // Participating musician still sees their own pending review even after spectator reviewed
  const musicianBefore = getPendingReviewsForRole({
    role: 'musico',
    activeMusicianId: 'mus-1',
    eventProposals: [ev],
    liveShows: [],
    publicEventReservations: [res],
    reviews360: [reviewSubmitted],
    nowMs,
  });
  assert.equal(musicianBefore.availableNow.length, 1);
  assert.match(musicianBefore.availableNow[0].targetSummary, /Bar Test 1/);
});

test('getPendingReviewsForRole enforces 2h lock on completed LiveShows and deduplicates against EventProposals', () => {
  const show: LiveShowConfirmed = {
    id: 'show-overnight',
    date: '2026-11-18',
    time: '21:30 hs', // default 150m -> ends 2026-11-19 00:00, unlocks 02:00
    venueId: 'venue-1',
    venueName: 'Bar Test 1',
    venueAddress: 'Honduras 4800',
    venueNeighborhood: 'Palermo Soho',
    venuePhoto: '',
    musicianId: 'mus-1',
    musicianName: 'Músico Test 1',
    musicianGenres: ['Jazz'],
    musicianFormat: 'Trío',
    musicianAvatar: '',
    ticketType: 'consumicion_minima',
    ticketPriceARS: 8000,
    description: 'Show',
    isCompleted: true,
    venueReviewed: false,
    musicianReviewed: false,
  };

  // At 2026-11-19 01:00 -> ended 1h ago -> waitingWindow
  const atOneAm = getPendingReviewsForRole({
    role: 'bar',
    activeVenueId: 'venue-1',
    eventProposals: [],
    liveShows: [show],
    publicEventReservations: [],
    reviews360: [],
    nowMs: new Date(2026, 10, 19, 1, 0, 0, 0).getTime(),
  });
  assert.equal(atOneAm.availableNow.length, 0);
  assert.equal(atOneAm.waitingWindow.length, 1);

  // At 2026-11-19 02:00 -> exactly 2h later -> availableNow
  const atTwoAm = getPendingReviewsForRole({
    role: 'bar',
    activeVenueId: 'venue-1',
    eventProposals: [],
    liveShows: [show],
    publicEventReservations: [],
    reviews360: [],
    nowMs: new Date(2026, 10, 19, 2, 0, 0, 0).getTime(),
  });
  assert.equal(atTwoAm.availableNow.length, 1);
  assert.equal(atTwoAm.waitingWindow.length, 0);
});
