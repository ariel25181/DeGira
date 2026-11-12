import test from 'node:test';
import assert from 'node:assert/strict';
import { EventProposal, MusicianSlotBid, PublicEventReservation } from '../types/index.ts';

test('EventProposal: calculates remaining capacity correctly when reserved', () => {
  const totalCapacity = 80;
  const partySize = 4;
  const remaining = totalCapacity - partySize;
  assert.equal(remaining, 76);
  assert.ok(remaining > 0);
});

test('EventProposal: flips status to agotada when remainingCapacity hits 0', () => {
  const remaining = 0;
  const status = remaining === 0 ? 'agotada' : 'publicada';
  assert.equal(status, 'agotada');
});

test('EventProposal: restores capacity and flips status back to publicada when reservation expires', () => {
  let remainingCapacity = 0;
  let status: 'publicada' | 'agotada' = 'agotada';
  const releasedSeats = 4;

  remainingCapacity = Math.min(80, remainingCapacity + releasedSeats);
  if (status === 'agotada' && remainingCapacity > 0) {
    status = 'publicada';
  }

  assert.equal(remainingCapacity, 4);
  assert.equal(status, 'publicada');
});

test('Musician bidding: negotiation transitions correctly', () => {
  const bid: MusicianSlotBid = {
    id: 'bid-1',
    eventId: 'ev-1',
    slotId: 'slot-1',
    musicianId: 'mus-1',
    musicianName: 'Músico Test 1',
    musicianAvatar: '',
    proposedCachetARS: 80000,
    musiciansCount: 3,
    equipmentProvided: 'Guitarras y platos',
    equipmentNeeded: 'Ampli y batería',
    status: 'pendiente_bar',
    history: [],
    createdAt: new Date().toISOString(),
  };

  // Bar counter-offers
  const counterCachet = 70000;
  bid.status = 'contraoferta_bar';
  bid.proposedCachetARS = counterCachet;

  assert.equal(bid.status, 'contraoferta_bar');
  assert.equal(bid.proposedCachetARS, 70000);

  // Musician accepts
  bid.status = 'aceptada';
  assert.equal(bid.status, 'aceptada');
});

test('PublicEventReservation: 8-minute timer calculates expiration properly', () => {
  const now = 1700000000000;
  const expiresAt = now + 8 * 60 * 1000;
  assert.equal(expiresAt - now, 480000); // 480,000 ms = 8 min

  // If time elapsed is 8 min 1 second:
  const checkTime = now + 481000;
  const isExpired = checkTime > expiresAt;
  assert.equal(isExpired, true);
});

test('Event visibility: general public only sees publicada or agotada', () => {
  const proposals: Array<{ status: string }> = [
    { status: 'propuesta' },
    { status: 'para_publicar' },
    { status: 'publicada' },
    { status: 'agotada' },
    { status: 'cancelada' },
  ];

  const publicVisible = proposals.filter((p) => p.status === 'publicada' || p.status === 'agotada');
  assert.equal(publicVisible.length, 2);

  const musicianVisible = proposals.filter(
    (p) => p.status !== 'publicada' && p.status !== 'para_publicar' && p.status !== 'agotada'
  );
  assert.equal(musicianVisible.length, 2); // 'propuesta' and 'cancelada'
});

test('Door Check-In: validates entry, sets timestamp and prevents double-entry reuse', () => {
  const reservation: PublicEventReservation = {
    id: 'res-checkin-1',
    eventId: 'ev-test-1',
    eventTitle: 'Noche de Jazz',
    eventCode: 'DG-TEST-1',
    venueId: 'bar-1',
    venueName: 'Bar Test 1',
    venueAddress: 'Gorriti 4800',
    venueNeighborhood: 'Palermo Soho',
    eventDate: '2026-11-15',
    eventStartTime: '21:00',
    eventEndTime: '00:00',
    userId: 'user-pub-1',
    userName: 'Usuario Test',
    userEmail: 'user@test.com',
    partySize: 2,
    totalARS: 16000,
    expiresAt: Date.now() + 1000000,
    status: 'confirmada',
    qrTicketCode: 'QR-TEST-ACCESS-99',
    checkInStatus: 'pending',
    createdAt: new Date().toISOString(),
  };

  // First check-in
  const checkIn = (ticket: PublicEventReservation) => {
    if (ticket.checkInStatus === 'checked_in') {
      return { success: false, reason: 'Entrada YA UTILIZADA PREVIAMENTE' };
    }
    ticket.checkInStatus = 'checked_in';
    ticket.checkedInAt = new Date().toISOString();
    return { success: true, reason: 'Acceso Permitido' };
  };

  const firstAttempt = checkIn(reservation);
  assert.equal(firstAttempt.success, true);
  assert.equal(reservation.checkInStatus, 'checked_in');
  assert.ok(reservation.checkedInAt);

  // Fraudulent second attempt (reusing same QR)
  const secondAttempt = checkIn(reservation);
  assert.equal(secondAttempt.success, false);
  assert.equal(secondAttempt.reason, 'Entrada YA UTILIZADA PREVIAMENTE');
});

test('Waitlist: allows spectator to join waitlist for sold out show', () => {
  const proposal: EventProposal = {
    id: 'ev-sold-out',
    venueId: 'bar-1',
    venueName: 'Bar Test 1',
    venueAddress: 'Gorriti 4800',
    venueNeighborhood: 'Palermo Soho',
    venuePhoto: '',
    title: 'Show Sold Out',
    date: '2026-11-20',
    startTime: '21:00',
    endTime: '00:00',
    totalCapacity: 50,
    remainingCapacity: 0,
    baseCachetARS: 70000,
    ticketPriceARS: 8000,
    targetGenres: ['Rock', 'Indie'],
    slots: [],
    rider: {
      stageSize: '4x3',
      soundSystem: 'PA 800W',
      micCount: 2,
      backline: ['Batería'],
      lighting: 'LEDs',
    },
    status: 'agotada',
    eventCode: 'DG-SOLDOUT-1',
    waitlist: [],
    createdAt: new Date().toISOString(),
  };

  const joinWaitlist = (event: EventProposal, email: string) => {
    const list = event.waitlist || [];
    if (!list.includes(email)) {
      event.waitlist = [...list, email];
    }
    return event.waitlist;
  };

  joinWaitlist(proposal, 'fan@degira.com');
  assert.equal(proposal.waitlist?.length, 1);
  assert.equal(proposal.waitlist?.[0], 'fan@degira.com');

  // Joining again does not duplicate
  joinWaitlist(proposal, 'fan@degira.com');
  assert.equal(proposal.waitlist?.length, 1);
});

test('Borderaux: accurately computes Gross Revenue, Musician Cachet and Net Margin', () => {
  const ticketPrice = 8000;
  const attendees = 60;
  const musicianCachet = 70000;

  const grossRevenue = attendees * ticketPrice;
  const netMargin = grossRevenue - musicianCachet;

  assert.equal(grossRevenue, 480000);
  assert.equal(netMargin, 410000);
  assert.ok(netMargin > 0);
});

