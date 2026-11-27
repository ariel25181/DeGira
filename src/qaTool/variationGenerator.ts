import type { MusicianProfile, PublicUserProfile, UserRole, VenueProfile } from '../types/index.ts';
import type {
  CohortConfig,
  GeneratedTestCase,
  RecordedFlow,
  RecordedStep,
  VariationKind,
} from './types.ts';

interface ExtractedFlowParameters {
  hasScheduleOrBid: boolean;
  hasReservationOrPayment: boolean;
  hasVenueCreationOrSelect: boolean;
  detectedTimeWindow: string;
  detectedDate: string;
  detectedCachetARS: number;
}

export function extractFlowParameters(flow: RecordedFlow): ExtractedFlowParameters {
  const joined = flow.steps
    .map((s) => `${s.label} ${s.value || ''} ${s.selector}`)
    .join(' ')
    .toLowerCase();

  const timeMatch = joined.match(/(\d{2}:\d{2})\s*(?:-|a)\s*(\d{2}:\d{2})/);
  const dateMatch = joined.match(/\d{4}-\d{2}-\d{2}/);
  const cachetMatch = joined.match(/\$?\s?(\d{4,6})/);

  const hasScheduleOrBid =
    flow.startRole === 'musico' ||
    /postular|horario|cach[eé]|bid|slot|propuesta/.test(joined) ||
    flow.allEmailsDelta.some(
      (e) => e.type === 'proposal_to_bar' || e.type === 'negotiation_update_musician'
    );

  const hasReservationOrPayment =
    flow.startRole === 'espectador' ||
    /reserv|comprobante|pago|qr|cartelera/.test(joined) ||
    flow.allEmailsDelta.some(
      (e) =>
        e.type === 'reservation_created' ||
        e.type === 'payment_alert_bar' ||
        e.type === 'qr_ticket'
    );

  const hasVenueCreationOrSelect =
    flow.startRole === 'bar' ||
    /bar|local|evento|convocatoria|publicar/.test(joined);

  return {
    hasScheduleOrBid,
    hasReservationOrPayment,
    hasVenueCreationOrSelect,
    detectedTimeWindow: timeMatch ? `${timeMatch[1]} a ${timeMatch[2]}` : '22:45 a 00:15',
    detectedDate: dateMatch ? dateMatch[0] : '2026-12-05',
    detectedCachetARS: cachetMatch ? Number(cachetMatch[1]) : 70000,
  };
}

function cloneStepsForActor(
  steps: RecordedStep[],
  actor: { role: UserRole; id: string; name: string },
  valueMutator?: (step: RecordedStep) => RecordedStep
): RecordedStep[] {
  return steps.map((step, idx) => {
    const mutated = valueMutator ? valueMutator(step) : step;
    return {
      ...mutated,
      id: `${step.id}-var-${actor.id}-${idx}`,
      role: actor.role,
      actorId: actor.id,
      actorName: actor.name,
    };
  });
}

export function generateSimilarTestCases(params: {
  flow: RecordedFlow;
  config: CohortConfig;
  venues?: VenueProfile[];
  musicians?: MusicianProfile[];
  publicUsers?: PublicUserProfile[];
}): GeneratedTestCase[] {
  const { flow, config } = params;
  const extracted = extractFlowParameters(flow);
  const cases: GeneratedTestCase[] = [];

  const targetDate = config.baseDate || extracted.detectedDate;

  // Build representative target actors up to configured counts
  const musActors =
    params.musicians && params.musicians.length > 0
      ? params.musicians.map((m) => ({ role: 'musico' as const, id: m.id, name: m.stageName }))
      : Array.from({ length: config.musiciansCount }, (_, idx) => ({
          role: 'musico' as const,
          id: `qa-mus-${idx + 1}`,
          name: `Músico QA ${idx + 1}`,
        }));

  const barActors =
    params.venues && params.venues.length > 0
      ? params.venues.map((v) => ({ role: 'bar' as const, id: v.id, name: v.name }))
      : Array.from({ length: config.barsCount }, (_, idx) => ({
          role: 'bar' as const,
          id: `qa-venue-${idx + 1}`,
          name: `Bar QA ${idx + 1}`,
        }));

  const specActors =
    params.publicUsers && params.publicUsers.length > 0
      ? params.publicUsers.map((p) => ({ role: 'espectador' as const, id: p.id, name: p.name }))
      : Array.from({ length: config.spectatorsCount }, (_, idx) => ({
          role: 'espectador' as const,
          id: `qa-pub-${idx + 1}`,
          name: `Público QA ${idx + 1}`,
        }));

  const baseNotifCount = Math.max(1, flow.allNotificationsDelta.length);
  const baseEmailCount = Math.max(1, flow.allEmailsDelta.length);

  // 1. Actor-swap variations across configured cohort size (bounded smartly while covering every configured count)
  const primaryPool =
    flow.startRole === 'bar'
      ? barActors
      : flow.startRole === 'espectador'
      ? specActors
      : musActors;

  primaryPool.slice(0, Math.max(2, Math.min(primaryPool.length, 6))).forEach((actor, idx) => {
    cases.push({
      id: `qa-case-swap-${idx + 1}`,
      title: `Réplica por Actor #${idx + 1}: ${actor.name}`,
      description: `Ejecuta la secuencia grabada cambiando el actor activo a ${actor.name} y valida notificaciones/emails aislados.`,
      variationKind: 'actor_swap',
      actorRole: actor.role,
      actorId: actor.id,
      actorName: actor.name,
      targetDate,
      targetTimeWindow: extracted.detectedTimeWindow,
      targetCachetARS: extracted.detectedCachetARS,
      expectedOutcomes: [
        `Completar los ${flow.steps.length} pasos como ${actor.name}`,
        config.includeNotificationsAndEmails
          ? `Emitir notificación + email scoped sin fuga a los otros ${
              config.barsCount + config.musiciansCount + config.spectatorsCount - 1
            } usuarios`
          : 'Estado actualizado sin errores',
      ],
      expectedNotificationsCount: baseNotifCount,
      expectedEmailsCount: baseEmailCount,
      steps: cloneStepsForActor(flow.steps, actor),
    });
  });

  // 2. Schedule overlap & boundary variations (when flow relates to musicians/slots or clash testing enabled)
  if (extracted.hasScheduleOrBid || config.includeScheduleClashes) {
    const musClash = musActors[Math.min(1, musActors.length - 1)];
    const musFree = musActors[0];

    cases.push({
      id: 'qa-case-overlap-clash',
      title: `Clash Parcial de Horario (23:30 a 01:00) • ${musClash.name}`,
      description:
        'Varía el horario grabado a una franja parcialmente superpuesta en la misma fecha y verifica que el aviso muestre el nombre del evento conflictivo.',
      variationKind: 'time_overlap_clash',
      actorRole: 'musico',
      actorId: musClash.id,
      actorName: musClash.name,
      targetDate,
      targetTimeWindow: '23:30 a 01:00',
      targetCachetARS: extracted.detectedCachetARS + 5000,
      expectedOutcomes: [
        'Detectar superposición contra el show confirmado en el otro bar',
        'Mostrar el nombre exacto del evento conflictivo en la alerta',
      ],
      expectedNotificationsCount: baseNotifCount,
      expectedEmailsCount: baseEmailCount,
      steps: cloneStepsForActor(flow.steps, musClash, (s) =>
        s.kind === 'input' && s.inputType === 'number'
          ? { ...s, value: String(extracted.detectedCachetARS + 5000) }
          : s
      ),
    });

    cases.push({
      id: 'qa-case-adjacent-clear',
      title: `Horario Contiguo Libre (18:30 a 20:30) • ${musClash.name}`,
      description:
        'Varía la franja a un horario contiguo que termina justo antes del show confirmado (sin superposición).',
      variationKind: 'time_adjacent_clear',
      actorRole: 'musico',
      actorId: musClash.id,
      actorName: musClash.name,
      targetDate,
      targetTimeWindow: '18:30 a 20:30',
      targetCachetARS: extracted.detectedCachetARS,
      expectedOutcomes: [
        'NO disparar falso clash en horario contiguo',
        'Notificar al Bar receptor y registrar email proposal_to_bar',
      ],
      expectedNotificationsCount: baseNotifCount,
      expectedEmailsCount: baseEmailCount,
      steps: cloneStepsForActor(flow.steps, musClash),
    });

    cases.push({
      id: 'qa-case-cancelled-no-clash',
      title: `Evento Previo Cancelado (Sin Falso Clash) • ${musFree.name}`,
      description:
        'Simula que el evento previo en el mismo horario fue cancelado y confirma que no bloquea ni alerta al músico.',
      variationKind: 'cancelled_event_no_clash',
      actorRole: 'musico',
      actorId: musFree.id,
      actorName: musFree.name,
      targetDate,
      targetTimeWindow: extracted.detectedTimeWindow,
      targetCachetARS: extracted.detectedCachetARS,
      expectedOutcomes: [
        'Ignorar eventos cancelados y postulaciones viejas no aceptadas',
        'Permitir postulación limpia sin falsos positivos',
      ],
      expectedNotificationsCount: baseNotifCount,
      expectedEmailsCount: baseEmailCount,
      steps: cloneStepsForActor(flow.steps, musFree),
    });
  }

  // 3. Bar venue isolation across configured Bars
  if (extracted.hasVenueCreationOrSelect || barActors.length >= 2) {
    const barB = barActors[barActors.length - 1];
    cases.push({
      id: 'qa-case-bar-isolation',
      title: `Aislamiento de Locales entre ${barActors.length} Bares (${barB.name})`,
      description: `Comprueba que ${barB.name} solo vea sus propios locales y no los de Bar QA 1..${Math.max(
        1,
        barActors.length - 1
      )}.`,
      variationKind: 'bar_isolation_guard',
      actorRole: 'bar',
      actorId: barB.id,
      actorName: barB.name,
      targetDate,
      expectedOutcomes: [
        `${barB.name} ve exclusivamente sus locales propios`,
        '0 fugas de locales o propuestas privadas entre bares',
      ],
      expectedNotificationsCount: 0,
      expectedEmailsCount: 0,
      steps: cloneStepsForActor(flow.steps, barB),
    });
  }

  // 4. Dedicated Notifications & Emails scoping check across the full N+M+K cohort
  if (config.includeNotificationsAndEmails) {
    const checkActor =
      extracted.hasReservationOrPayment && specActors.length > 0
        ? specActors[0]
        : primaryPool[0];
    cases.push({
      id: 'qa-case-notif-email-scoping',
      title: `Auditoría de Notificaciones y Emails (${
        config.barsCount + config.musiciansCount + config.spectatorsCount
      } usuarios)`,
      description:
        'Verifica que cada notificación in-app y cada email (propuesta, publicación, comprobante, pase QR) llegue solo al destinatario correcto sin filtrarse a los demás usuarios.',
      variationKind: 'notification_email_scoping',
      actorRole: checkActor.role,
      actorId: checkActor.id,
      actorName: checkActor.name,
      targetDate,
      expectedOutcomes: [
        'Notificaciones visibles únicamente para su targetRole / targetEntityId / targetEmail',
        'Emails visibles únicamente para remitente y destinatario exactos',
        'Pase QR y alertas de pago despachados sin fugas',
      ],
      expectedNotificationsCount: baseNotifCount,
      expectedEmailsCount: baseEmailCount,
      steps: cloneStepsForActor(flow.steps, checkActor),
    });
  }

  return cases;
}

export function exportVariationsAsTestCode(params: {
  flow: RecordedFlow;
  config: CohortConfig;
  cases: GeneratedTestCase[];
}): string {
  const { flow, config, cases } = params;
  const serializedConfig = JSON.stringify(config);
  const serializedCases = JSON.stringify(
    cases.map((c) => ({
      id: c.id,
      title: c.title,
      variationKind: c.variationKind,
      actorRole: c.actorRole,
      actorName: c.actorName,
      expectedOutcomes: c.expectedOutcomes,
    })),
    null,
    2
  );

  return `// Archivo autogenerado por DeGira Live QA Tool
// Grabación base: ${flow.name} (${flow.steps.length} pasos)
// Cohorte configurada: ${config.barsCount} Bares, ${config.musiciansCount} Músicos, ${config.spectatorsCount} Público
import test from 'node:test';
import assert from 'node:assert/strict';
import { runCohortSimulation } from '../src/qaTool/cohortSimulator.ts';

const CONFIG = ${serializedConfig};
const GENERATED_CASES = ${serializedCases};

test('DeGira Cohorte (${config.barsCount}B x ${config.musiciansCount}M x ${config.spectatorsCount}P) + Variaciones de "${flow.name.replace(/'/g, '')}"', () => {
  const report = runCohortSimulation(CONFIG);
  assert.equal(report.venueIsolationLeaks, 0, 'Sin fugas de locales entre bares');
  assert.equal(report.notificationLeaks, 0, 'Sin fugas de notificaciones entre usuarios');
  assert.equal(report.emailLeaks, 0, 'Sin fugas de emails entre usuarios');
  assert.ok(GENERATED_CASES.length > 0, 'Debe haber variaciones generadas');
});
`;
}

export function variationBadgeLabel(kind: VariationKind): string {
  switch (kind) {
    case 'actor_swap':
      return 'Mismo flujo • Otro usuario';
    case 'time_overlap_clash':
      return 'Mutación • Superposición';
    case 'time_adjacent_clear':
      return 'Mutación • Horario libre';
    case 'cancelled_event_no_clash':
      return 'Mutación • Show cancelado';
    case 'bar_isolation_guard':
      return 'Aislamiento entre bares';
    case 'notification_email_scoping':
      return 'Notificaciones y Emails';
  }
}
