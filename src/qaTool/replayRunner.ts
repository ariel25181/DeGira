import { getSentEmails } from '../lib/emailService.ts';
import {
  isEmailVisibleToProfile,
  isNotificationVisibleToProfile,
} from '../utils/notificationScoping.ts';
import { detectMusicianDateClashes } from '../utils/slotBidding.ts';
import { getVenuesOwnedByBar } from '../utils/venueOwnership.ts';
import { runCohortSimulation } from './cohortSimulator.ts';
import type {
  CapturedEmailSummary,
  CapturedNotificationSummary,
  CohortConfig,
  CohortSimulationReport,
  GeneratedTestCase,
  QaAppBridge,
  RecordedStep,
  TestCaseExecutionResult,
  TestCheckItem,
} from './types.ts';
import {
  QA_OVERLAY_ATTR,
  computeNotificationAndEmailDelta,
  toEmailSummary,
  toNotificationSummary,
} from './uiRecorder.ts';

function setNativeInputValue(
  el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  val: string
) {
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : el instanceof HTMLSelectElement
      ? HTMLSelectElement.prototype
      : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
  if (descriptor?.set) {
    descriptor.set.call(el, val);
  } else {
    el.value = val;
  }
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

export function findElementByQaSelector(selector: string): Element | null {
  if (typeof document === 'undefined') return null;

  if (selector.startsWith('text=')) {
    const rest = selector.slice(5);
    const colonIdx = rest.indexOf(':');
    const tag = colonIdx > 0 ? rest.slice(0, colonIdx) : '*';
    const targetText = (colonIdx > 0 ? rest.slice(colonIdx + 1) : rest).trim().toLowerCase();
    const candidates = Array.from(document.querySelectorAll(tag || '*'));
    return (
      candidates.find((el) => {
        if (el.closest(`[${QA_OVERLAY_ATTR}="true"]`)) return false;
        const txt = (el.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
        return txt === targetText || txt.includes(targetText);
      }) || null
    );
  }

  try {
    const matches = Array.from(document.querySelectorAll(selector));
    return matches.find((el) => !el.closest(`[${QA_OVERLAY_ATTR}="true"]`)) || null;
  } catch {
    return null;
  }
}

function findStepElement(step: RecordedStep): Element | null {
  const allSelectors = [step.selector, ...step.fallbackSelectors];
  for (const sel of allSelectors) {
    const found = findElementByQaSelector(sel);
    if (found) return found;
  }
  return null;
}

export async function replayFlowInLiveDom(params: {
  steps: RecordedStep[];
  bridge: QaAppBridge;
  stepDelayMs?: number;
  signal?: AbortSignal;
  onStepUpdate?: (info: {
    stepIndex: number;
    totalSteps: number;
    label: string;
    status: 'running' | 'ok' | 'skipped' | 'error';
    notificationsDelta: CapturedNotificationSummary[];
    emailsDelta: CapturedEmailSummary[];
  }) => void;
}): Promise<{
  completedSteps: number;
  skippedSteps: number;
  notificationsEmitted: CapturedNotificationSummary[];
  emailsEmitted: CapturedEmailSummary[];
}> {
  const { steps, bridge, stepDelayMs = 450, signal, onStepUpdate } = params;

  const seenNotifs = new Set(bridge.rawNotifications.map((n) => n.id));
  const seenEmails = new Set(getSentEmails().map((e) => e.id));
  const totalNotifs: CapturedNotificationSummary[] = [];
  const totalEmails: CapturedEmailSummary[] = [];

  let completedSteps = 0;
  let skippedSteps = 0;
  let lastActorKey = '';

  for (let i = 0; i < steps.length; i++) {
    if (signal?.aborted) break;
    const step = steps[i];

    const actorKey = `${step.role}:${step.actorId}`;
    if (actorKey !== lastActorKey) {
      bridge.switchActor({
        role: step.role,
        entityId: step.actorId,
        displayName: step.actorName,
      });
      lastActorKey = actorKey;
      await new Promise((r) => setTimeout(r, 200));
    }

    onStepUpdate?.({
      stepIndex: i,
      totalSteps: steps.length,
      label: step.label,
      status: 'running',
      notificationsDelta: [],
      emailsDelta: [],
    });

    const el = findStepElement(step);
    if (!el) {
      skippedSteps += 1;
      onStepUpdate?.({
        stepIndex: i,
        totalSteps: steps.length,
        label: step.label,
        status: 'skipped',
        notificationsDelta: [],
        emailsDelta: [],
      });
      await new Promise((r) => setTimeout(r, 150));
      continue;
    }

    const htmlEl = el as HTMLElement;
    const prevOutline = htmlEl.style.outline;
    htmlEl.style.outline = '2px solid #f59e0b';
    htmlEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

    try {
      if (
        (step.kind === 'input' || step.kind === 'select') &&
        (el instanceof HTMLInputElement ||
          el instanceof HTMLTextAreaElement ||
          el instanceof HTMLSelectElement)
      ) {
        if (el instanceof HTMLInputElement && el.type === 'checkbox') {
          const desired = Boolean(step.checked);
          if (el.checked !== desired) el.click();
        } else {
          setNativeInputValue(el, step.value || '');
        }
      } else if (step.kind === 'submit' && el instanceof HTMLFormElement) {
        el.requestSubmit();
      } else {
        htmlEl.click();
      }
      completedSteps += 1;
    } finally {
      setTimeout(() => {
        htmlEl.style.outline = prevOutline;
      }, 280);
    }

    await new Promise((r) => setTimeout(r, stepDelayMs));

    const { notificationsDelta, emailsDelta } = computeNotificationAndEmailDelta({
      seenNotificationIds: seenNotifs,
      seenEmailIds: seenEmails,
      currentNotifications: bridge.rawNotifications,
      currentEmails: getSentEmails(),
    });
    totalNotifs.push(...notificationsDelta);
    totalEmails.push(...emailsDelta);

    onStepUpdate?.({
      stepIndex: i,
      totalSteps: steps.length,
      label: step.label,
      status: 'ok',
      notificationsDelta,
      emailsDelta,
    });
  }

  return {
    completedSteps,
    skippedSteps,
    notificationsEmitted: totalNotifs,
    emailsEmitted: totalEmails,
  };
}

export function executeGeneratedCaseBatch(params: {
  cases: GeneratedTestCase[];
  config: CohortConfig;
  report?: CohortSimulationReport;
}): {
  report: CohortSimulationReport;
  results: TestCaseExecutionResult[];
} {
  const report = params.report || runCohortSimulation(params.config);
  const { venues, musicians, publicUsers, eventProposals, slotBids, notifications, emails } =
    report.artifacts;

  const results: TestCaseExecutionResult[] = params.cases.map((tc) => {
    const start = Date.now();
    const checks: TestCheckItem[] = [];
    let leakCount = 0;

    const actorNotifs = notifications.filter((n) =>
      isNotificationVisibleToProfile(n, {
        role: tc.actorRole,
        entityId: tc.actorId,
        displayName: tc.actorName,
      })
    );
    const actorEmails = emails.filter((e) =>
      isEmailVisibleToProfile(e, {
        role: tc.actorRole,
        entityId: tc.actorId,
        displayName: tc.actorName,
      })
    );

    if (tc.variationKind === 'bar_isolation_guard') {
      const targetBar = venues.find((v) => v.id === tc.actorId) || venues[0];
      const visible = getVenuesOwnedByBar({ venues, barOwnerId: targetBar.id });
      const foreign = visible.filter((v) => v.id !== targetBar.id && v.ownerBarId !== targetBar.id);
      leakCount = foreign.length;
      checks.push({
        label: 'Aislamiento por bar propietario',
        passed: foreign.length === 0 && visible.length >= 1,
        detail: `${targetBar.name} visualiza ${visible.length} local(es) propios y ${foreign.length} ajenos.`,
      });
    } else if (tc.variationKind === 'time_overlap_clash') {
      const targetEv = eventProposals[0];
      const slot2 = targetEv?.slots[1] || targetEv?.slots[0];
      const assignedMusId = slot2?.assignedMusicianId || musicians[0]?.id;
      const clashes =
        targetEv && slot2
          ? detectMusicianDateClashes({
              musicianId: assignedMusId,
              targetEvent: { ...targetEv, id: 'qa-probe-overlap', date: report.config.baseDate },
              targetSlot: {
                ...slot2,
                id: 'qa-probe-overlap-slot',
                startTime: '23:30',
                endTime: '01:00',
              },
              eventProposals,
              slotBids,
            })
          : [];
      checks.push({
        label: 'Detección de clash parcial con título de evento',
        passed: clashes.length > 0 && clashes.every((c) => Boolean(c.title)),
        detail:
          clashes.length > 0
            ? `Detectado: ${clashes[0].venueName} • ${clashes[0].title} (${clashes[0].startTime}–${clashes[0].endTime}).`
            : 'No se detectó la superposición esperada.',
      });
    } else if (tc.variationKind === 'time_adjacent_clear') {
      const targetEv = eventProposals[0];
      const slot1 = targetEv?.slots[0];
      const assignedMusId = slot1?.assignedMusicianId || musicians[0]?.id;
      const clashes =
        targetEv && slot1
          ? detectMusicianDateClashes({
              musicianId: assignedMusId,
              targetEvent: { ...targetEv, id: 'qa-probe-adjacent', date: report.config.baseDate },
              targetSlot: {
                ...slot1,
                id: 'qa-probe-adjacent-slot',
                startTime: '18:30',
                endTime: '20:30',
              },
              eventProposals,
              slotBids,
            })
          : [];
      checks.push({
        label: 'Horario contiguo sin falso positivo',
        passed: clashes.length === 0,
        detail:
          clashes.length === 0
            ? 'Franja 18:30–20:30 libre sin falsos clashes.'
            : `Falso positivo detectado: ${clashes[0].title}`,
      });
    } else if (tc.variationKind === 'cancelled_event_no_clash') {
      const targetEv = eventProposals[0];
      const slot2 = targetEv?.slots[1] || targetEv?.slots[0];
      const assignedMusId = slot2?.assignedMusicianId || musicians[0]?.id;
      const cancelledEvents = eventProposals.map((ev) => ({
        ...ev,
        status: 'cancelada' as const,
      }));
      const clashes =
        targetEv && slot2
          ? detectMusicianDateClashes({
              musicianId: assignedMusId,
              targetEvent: { ...targetEv, id: 'qa-probe-cancelled', date: report.config.baseDate },
              targetSlot: {
                ...slot2,
                id: 'qa-probe-cancelled-slot',
                startTime: '22:45',
                endTime: '00:15',
              },
              eventProposals: cancelledEvents,
              slotBids,
            })
          : [];
      checks.push({
        label: 'Eventos cancelados excluidos del clash',
        passed: clashes.length === 0,
        detail:
          clashes.length === 0
            ? 'Eventos cancelados ignorados correctamente.'
            : `Falso clash por evento cancelado: ${clashes[0].title}`,
      });
    } else if (tc.variationKind === 'notification_email_scoping') {
      leakCount = report.notificationLeaks + report.emailLeaks;
      checks.push({
        label: 'Aislamiento estricto de notificaciones',
        passed: report.notificationLeaks === 0,
        detail: `${report.notifications.length} notificaciones verificadas (${report.notificationLeaks} fugas).`,
      });
      checks.push({
        label: 'Aislamiento estricto de emails (incl. QR y alertas)',
        passed: report.emailLeaks === 0,
        detail: `${report.emails.length} emails verificados (${report.emailLeaks} fugas).`,
      });
    } else {
      // actor_swap
      const actorExists =
        venues.some((v) => v.id === tc.actorId) ||
        musicians.some((m) => m.id === tc.actorId) ||
        publicUsers.some((p) => p.id === tc.actorId);
      checks.push({
        label: `Ejecución parametrizada para ${tc.actorName}`,
        passed: actorExists && tc.steps.length > 0,
        detail: `${tc.steps.length} pasos adaptados para ${tc.actorName}.`,
      });
      if (report.config.includeNotificationsAndEmails) {
        const actorSummary = report.actorSummaries.find((a) => a.id === tc.actorId);
        const actorLeaks =
          (actorSummary?.leakedNotificationsCount || 0) +
          (actorSummary?.leakedEmailsCount || 0);
        leakCount = actorLeaks;
        checks.push({
          label: 'Entrega de notificaciones y emails al actor',
          passed: actorLeaks === 0,
          detail: `${actorNotifs.length} notificaciones y ${actorEmails.length} emails visibles (${actorLeaks} fugas).`,
        });
      }
    }

    const passed = checks.every((c) => c.passed) && leakCount === 0;
    return {
      testCaseId: tc.id,
      title: tc.title,
      variationKind: tc.variationKind,
      actorName: tc.actorName,
      status: passed ? 'passed' : 'failed',
      durationMs: Math.max(1, Date.now() - start),
      checks,
      notificationsEmitted: actorNotifs.slice(0, 6).map(toNotificationSummary),
      emailsEmitted: actorEmails.slice(0, 6).map(toEmailSummary),
      leakCount,
    };
  });

  return { report, results };
}
