import test from 'node:test';
import assert from 'node:assert/strict';
import type { SentEmailRecord } from '../lib/emailService.ts';
import {
  buildPresetRecordedFlow,
  clampCohortConfig,
  computeNotificationAndEmailDelta,
  createRecordedStep,
  executeGeneratedCaseBatch,
  exportVariationsAsTestCode,
  finalizeRecordedFlow,
  generateSimilarTestCases,
  runCohortSimulation,
} from './index.ts';
import type { QaNotificationRecord } from './types.ts';

test('Configurable cohort simulator scales across custom counts of Bars, Musicians, and Spectators with 0 leaks', () => {
  const small = runCohortSimulation({
    barsCount: 1,
    musiciansCount: 1,
    spectatorsCount: 1,
    includeNotificationsAndEmails: true,
    includeScheduleClashes: true,
    includePaymentsAndQr: true,
  });
  assert.equal(small.venuesCount, 1);
  assert.equal(small.totalActors, 3);
  assert.equal(small.venueIsolationLeaks, 0);
  assert.equal(small.notificationLeaks, 0);
  assert.equal(small.emailLeaks, 0);
  assert.ok(small.notifications.length > 0);
  assert.ok(small.emails.length > 0);

  const large = runCohortSimulation({
    barsCount: 6,
    musiciansCount: 10,
    spectatorsCount: 18,
    includeNotificationsAndEmails: true,
    includeScheduleClashes: true,
    includePaymentsAndQr: true,
    baseDate: '2026-12-12',
  });
  assert.equal(large.venuesCount, 6);
  assert.equal(large.totalActors, 34);
  assert.equal(large.publishedEvents, 6);
  assert.equal(large.reservationsCreated, 18);
  assert.equal(large.reservationsExpired, 1);
  assert.equal(large.reservationsConfirmed, 17);
  assert.equal(large.venueIsolationLeaks, 0);
  assert.equal(large.notificationLeaks, 0);
  assert.equal(large.emailLeaks, 0);
  assert.ok(large.clashesDetected > 0, 'Debe detectar clashes configurados');
  assert.ok(
    large.emails.some((e) => e.type === 'qr_ticket' && Boolean(e.qrCodeUrl)),
    'Debe emitir emails con Pase QR'
  );
  assert.ok(
    large.emails.some((e) => e.type === 'proposal_to_bar'),
    'Debe emitir emails de postulación al bar'
  );
  assert.ok(
    large.emails.some((e) => e.type === 'event_published_musician'),
    'Debe emitir emails de evento publicado a músicos'
  );
  assert.ok(
    large.assertions.every((a) => a.passed),
    'Todas las aserciones de cohorte deben aprobar'
  );
});

test('Cohort config clamps out-of-range counts cleanly', () => {
  const clamped = clampCohortConfig({
    barsCount: 99,
    musiciansCount: 0,
    spectatorsCount: -5,
  });
  assert.equal(clamped.barsCount, 15);
  assert.equal(clamped.musiciansCount, 1);
  assert.equal(clamped.spectatorsCount, 1);
});

test('UI Recorder tracks notification and email deltas per recorded step without duplicating previously seen records', () => {
  const seenNotifIds = new Set<string>(['old-n-1']);
  const seenEmailIds = new Set<string>(['old-e-1']);

  const allNotifs: QaNotificationRecord[] = [
    {
      id: 'old-n-1',
      title: 'Vieja',
      message: 'Vieja',
      timestamp: 'Hace 1d',
      read: true,
      type: 'system',
      targetRole: 'bar',
      targetEntityId: 'venue-1',
    },
    {
      id: 'new-n-1',
      title: 'Nueva postulación',
      message: 'Músico Test 2 ofertó $70.000',
      timestamp: 'Recién',
      read: false,
      type: 'application',
      targetRole: 'bar',
      targetEntityId: 'venue-1',
      targetEmail: 'bar1@degira.com.ar',
    },
  ];

  const allEmails: SentEmailRecord[] = [
    {
      id: 'old-e-1',
      to: 'bar1@degira.com.ar',
      subject: 'Viejo',
      bodyText: 'Viejo',
      type: 'proposal_to_bar',
      sentAt: '2026-11-20T00:00:00.000Z',
    },
    {
      id: 'new-e-1',
      to: 'bar1@degira.com.ar',
      fromEmail: 'musico2@degira.com.ar',
      targetRole: 'bar',
      targetEntityId: 'venue-1',
      senderRole: 'musico',
      senderEntityId: 'mus-2',
      subject: '🎸 Nueva propuesta musical de Músico Test 2',
      bodyText: 'Horario: 22:45 a 00:15 hs',
      type: 'proposal_to_bar',
      sentAt: '2026-11-27T00:00:00.000Z',
    },
  ];

  const delta1 = computeNotificationAndEmailDelta({
    seenNotificationIds: seenNotifIds,
    seenEmailIds: seenEmailIds,
    currentNotifications: allNotifs,
    currentEmails: allEmails,
  });

  assert.equal(delta1.notificationsDelta.length, 1);
  assert.equal(delta1.notificationsDelta[0].id, 'new-n-1');
  assert.equal(delta1.emailsDelta.length, 1);
  assert.equal(delta1.emailsDelta[0].id, 'new-e-1');

  // Calling again without new events yields empty delta
  const delta2 = computeNotificationAndEmailDelta({
    seenNotificationIds: seenNotifIds,
    seenEmailIds: seenEmailIds,
    currentNotifications: allNotifs,
    currentEmails: allEmails,
  });
  assert.equal(delta2.notificationsDelta.length, 0);
  assert.equal(delta2.emailsDelta.length, 0);

  const step = createRecordedStep({
    index: 1,
    kind: 'submit',
    label: 'Enviar Propuesta',
    selector: 'text=button:Enviar Propuesta',
    fallbackSelectors: [],
    tagName: 'button',
    role: 'musico',
    actorId: 'mus-2',
    actorName: 'Músico Test 2',
    notificationsDelta: delta1.notificationsDelta,
    emailsDelta: delta1.emailsDelta,
  });
  const flow = finalizeRecordedFlow({
    startRole: 'musico',
    startActorId: 'mus-2',
    startActorName: 'Músico Test 2',
    steps: [step],
  });
  assert.equal(flow.allNotificationsDelta.length, 1);
  assert.equal(flow.allEmailsDelta.length, 1);
});

test('Variation Generator builds similar test cases from recording and Batch Runner passes all checks with 0 leaks', () => {
  const flow = buildPresetRecordedFlow();
  const config = clampCohortConfig({
    barsCount: 3,
    musiciansCount: 4,
    spectatorsCount: 5,
    includeNotificationsAndEmails: true,
    includeScheduleClashes: true,
    includePaymentsAndQr: true,
  });

  const cases = generateSimilarTestCases({ flow, config });
  assert.ok(cases.length >= 6);
  assert.ok(cases.some((c) => c.variationKind === 'actor_swap'));
  assert.ok(cases.some((c) => c.variationKind === 'time_overlap_clash'));
  assert.ok(cases.some((c) => c.variationKind === 'time_adjacent_clear'));
  assert.ok(cases.some((c) => c.variationKind === 'cancelled_event_no_clash'));
  assert.ok(cases.some((c) => c.variationKind === 'bar_isolation_guard'));
  assert.ok(cases.some((c) => c.variationKind === 'notification_email_scoping'));

  const batch = executeGeneratedCaseBatch({ cases, config });
  assert.equal(batch.results.length, cases.length);
  for (const res of batch.results) {
    assert.equal(res.status, 'passed', `Case failed: ${res.title} (${JSON.stringify(res.checks)})`);
    assert.equal(res.leakCount, 0, `Unexpected leak in ${res.title}`);
  }

  const exportedCode = exportVariationsAsTestCode({ flow, config, cases });
  assert.match(exportedCode, /runCohortSimulation/);
  assert.match(exportedCode, /notificationLeaks/);
});
