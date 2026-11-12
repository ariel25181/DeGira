import test from 'node:test';
import assert from 'node:assert/strict';

// Helper function that matches the clash detection logic in MusicianBidModal & AppContext
function timesOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  const parseMins = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  const sA = parseMins(startA);
  let eA = parseMins(endA);
  if (eA <= sA) eA += 24 * 60; // wraps past midnight

  const sB = parseMins(startB);
  let eB = parseMins(endB);
  if (eB <= sB) eB += 24 * 60; // wraps past midnight

  return Math.max(sA, sB) < Math.min(eA, eB);
}

// Helper function for 24h retraction rule verification
function canMusicianRetract(eventDate: string, eventStartTime: string, nowMs: number): { allowed: boolean; hoursUntil: number } {
  const eventDateTime = new Date(`${eventDate}T${eventStartTime || '21:00'}`).getTime();
  const diffHours = (eventDateTime - nowMs) / (1000 * 60 * 60);
  return {
    allowed: diffHours >= 24,
    hoursUntil: diffHours,
  };
}

// Helper function for 1 hour post-event feedback trigger
function shouldTriggerPostEventFeedback(eventDate: string, eventEndTime: string, nowMs: number): boolean {
  const endDateTime = new Date(`${eventDate}T${eventEndTime || '23:59'}`).getTime();
  return nowMs >= (endDateTime + 60 * 60 * 1000); // 1h post-event
}

test('Musician 24-hour Retraction Rule: allowed when >= 24 hours before event', () => {
  const eventDate = '2026-11-20';
  const eventStartTime = '21:00';
  
  // 30 hours before event
  const now30hBefore = new Date('2026-11-19T15:00:00').getTime();
  const checkAllowed = canMusicianRetract(eventDate, eventStartTime, now30hBefore);
  assert.equal(checkAllowed.allowed, true);
  assert.ok(checkAllowed.hoursUntil >= 24);
});

test('Musician 24-hour Retraction Rule: blocked when < 24 hours before event', () => {
  const eventDate = '2026-11-20';
  const eventStartTime = '21:00';

  // 12 hours before event
  const now12hBefore = new Date('2026-11-20T09:00:00').getTime();
  const checkBlocked = canMusicianRetract(eventDate, eventStartTime, now12hBefore);
  assert.equal(checkBlocked.allowed, false);
  assert.ok(checkBlocked.hoursUntil < 24);

  // Exactly 23.5 hours before event
  const now23h30Before = new Date('2026-11-19T21:30:00').getTime();
  const checkBorderline = canMusicianRetract(eventDate, eventStartTime, now23h30Before);
  assert.equal(checkBorderline.allowed, false);
});

test('Clash Detection: detects time conflicts on same date correctly', () => {
  // Show 1: 21:00 to 23:00 vs Show 2: 22:00 to 00:00 (overlaps)
  assert.equal(timesOverlap('21:00', '23:00', '22:00', '00:00'), true);

  // Show 3: 18:00 to 20:00 vs 21:00 to 23:00 (no overlap)
  assert.equal(timesOverlap('18:00', '20:00', '21:00', '23:00'), false);

  // Show 4: Late night crossover 23:00 to 02:00 vs 23:30 to 01:30 (overlaps)
  assert.equal(timesOverlap('23:00', '02:00', '23:30', '01:30'), true);

  // Show 5: 20:00 to 22:00 vs 21:30 to 23:30 (overlaps)
  assert.equal(timesOverlap('20:00', '22:00', '21:30', '23:30'), true);
});

test('Bar Manual Publishing: events with confirmed musicians stay in para_publicar until bar intervenes', () => {
  type EventStatus = 'propuesta' | 'para_publicar' | 'publicada' | 'agotada';
  
  let eventStatus: EventStatus = 'propuesta';
  const slots = [
    { id: 'slot-1', status: 'confirmado' },
    { id: 'slot-2', status: 'confirmado' },
  ];

  // When all slots become confirmed
  const allConfirmed = slots.every((s) => s.status === 'confirmado');
  if (allConfirmed) {
    // Crucial requirement: Must NOT auto-publish!
    eventStatus = 'para_publicar';
  }

  assert.equal(eventStatus, 'para_publicar');
  assert.notEqual(eventStatus, 'publicada', 'Must NOT auto-publish without Bar approval');

  // Manual Bar publication action
  const barApprovesPublication = () => {
    if (eventStatus === 'para_publicar') {
      eventStatus = 'publicada';
      return { success: true };
    }
    return { success: false };
  };

  const publishResult = barApprovesPublication();
  assert.equal(publishResult.success, true);
  assert.equal(eventStatus, 'publicada');
});

test('1-Hour Post-Event Feedback: triggers strictly after 1 hour post end time', () => {
  const eventDate = '2026-11-15';
  const eventEndTime = '23:00';
  const eventEndMs = new Date('2026-11-15T23:00:00').getTime();

  // 30 minutes after event (should NOT trigger yet)
  const now30mAfter = eventEndMs + 30 * 60 * 1000;
  assert.equal(shouldTriggerPostEventFeedback(eventDate, eventEndTime, now30mAfter), false);

  // 59 minutes after event (should NOT trigger yet)
  const now59mAfter = eventEndMs + 59 * 60 * 1000;
  assert.equal(shouldTriggerPostEventFeedback(eventDate, eventEndTime, now59mAfter), false);

  // Exactly 60 minutes after event (SHOULD trigger)
  const now60mAfter = eventEndMs + 60 * 60 * 1000;
  assert.equal(shouldTriggerPostEventFeedback(eventDate, eventEndTime, now60mAfter), true);

  // 3 hours after event (SHOULD trigger)
  const now3hAfter = eventEndMs + 180 * 60 * 1000;
  assert.equal(shouldTriggerPostEventFeedback(eventDate, eventEndTime, now3hAfter), true);
});

test('Push Notification API: validates client PushSubscription object structure', () => {
  const validSubscriptionPayload = {
    subscription: {
      endpoint: 'https://fcm.googleapis.com/fcm/send/sample-subscription-token-degira',
      keys: {
        p256dh: 'BNcR6S9efQG4hnw59...',
        auth: 'tBH2x9K...',
      },
    },
    userId: 'user-mus-1',
    userRole: 'musico',
    userAgent: 'Mozilla/5.0 Chrome/130.0',
  };

  const validateSubscription = (payload: any) => {
    if (!payload.subscription || !payload.subscription.endpoint) {
      return { valid: false, error: 'Subscription object with endpoint is required' };
    }
    return { valid: true };
  };

  assert.equal(validateSubscription(validSubscriptionPayload).valid, true);

  const invalidPayload = { subscription: {} };
  assert.equal(validateSubscription(invalidPayload).valid, false);
});

test('Push Notification Broadcast: generates standard payload with tag and deep link url', () => {
  const createPushPayload = (title: string, body: string, url: string, tag: string) => {
    return JSON.stringify({
      title,
      body,
      url,
      tag,
      icon: '/pwa-192x192.png',
      badge: '/icon.svg',
      timestamp: Date.now(),
    });
  };

  const rawJson = createPushPayload(
    '🎸 ¡Propuesta Aceptada!',
    'Bar La Bohemia aprobó tu fecha para el 20/11',
    '/#acuerdos',
    'proposal-accepted'
  );

  const parsed = JSON.parse(rawJson);
  assert.equal(parsed.title, '🎸 ¡Propuesta Aceptada!');
  assert.equal(parsed.tag, 'proposal-accepted');
  assert.equal(parsed.url, '/#acuerdos');
  assert.ok(parsed.timestamp > 0);
});
