import type { SentEmailRecord } from '../lib/emailService.ts';
import type { UserRole } from '../types/index.ts';
import type {
  CapturedEmailSummary,
  CapturedNotificationSummary,
  QaNotificationRecord,
  RecordedActionKind,
  RecordedFlow,
  RecordedStep,
} from './types.ts';

export const QA_OVERLAY_ATTR = 'data-qa-overlay';
const STORAGE_FLOWS_KEY = 'degira:qa_recorded_flows:v1';

export function isElementInsideQaOverlay(el: Element | null): boolean {
  if (!el) return false;
  return Boolean(el.closest(`[${QA_OVERLAY_ATTR}="true"]`));
}

function escapeAttrValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function buildSemanticSelectors(el: Element): {
  primary: string;
  fallbacks: string[];
  label: string;
} {
  const tag = el.tagName.toLowerCase();
  const testId = el.getAttribute('data-testid');
  const ariaLabel = el.getAttribute('aria-label');
  const nameAttr = el.getAttribute('name');
  const placeholder = el.getAttribute('placeholder');
  const idAttr = el.getAttribute('id');
  const textContent = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60);

  const candidates: string[] = [];
  if (testId) candidates.push(`[data-testid="${escapeAttrValue(testId)}"]`);
  if (ariaLabel) candidates.push(`${tag}[aria-label="${escapeAttrValue(ariaLabel)}"]`);
  if (idAttr && !/^(radix-|headlessui-|react-)/.test(idAttr)) {
    candidates.push(`#${escapeAttrValue(idAttr)}`);
  }
  if (nameAttr) candidates.push(`${tag}[name="${escapeAttrValue(nameAttr)}"]`);
  if (placeholder) candidates.push(`${tag}[placeholder="${escapeAttrValue(placeholder)}"]`);
  if ((tag === 'button' || tag === 'a') && textContent) {
    candidates.push(`text=${tag}:${textContent}`);
  }
  if (candidates.length === 0) {
    candidates.push(tag);
  }

  const label =
    ariaLabel ||
    placeholder ||
    textContent ||
    nameAttr ||
    testId ||
    tag;

  return {
    primary: candidates[0],
    fallbacks: candidates.slice(1),
    label,
  };
}

export function resolveClickableTarget(rawTarget: EventTarget | null): Element | null {
  if (!(rawTarget instanceof Element)) return null;
  if (isElementInsideQaOverlay(rawTarget)) return null;
  const interactive = rawTarget.closest(
    'button, a, input, select, textarea, [role="button"], [role="tab"], label'
  );
  const el = interactive || rawTarget;
  if (isElementInsideQaOverlay(el)) return null;
  return el;
}

export function toNotificationSummary(n: QaNotificationRecord): CapturedNotificationSummary {
  return {
    id: n.id,
    title: n.title,
    message: n.message,
    type: n.type,
    targetRole: n.targetRole,
    targetEntityId: n.targetEntityId,
    targetEmail: n.targetEmail,
  };
}

export function toEmailSummary(e: SentEmailRecord): CapturedEmailSummary {
  return {
    id: e.id,
    to: e.to,
    fromEmail: e.fromEmail,
    targetRole: e.targetRole,
    targetEntityId: e.targetEntityId,
    senderRole: e.senderRole,
    senderEntityId: e.senderEntityId,
    type: e.type,
    subject: e.subject,
    bodyText: e.bodyText,
    qrCodeUrl: e.qrCodeUrl,
  };
}

export function computeNotificationAndEmailDelta(params: {
  seenNotificationIds: Set<string>;
  seenEmailIds: Set<string>;
  currentNotifications: QaNotificationRecord[];
  currentEmails: SentEmailRecord[];
}): {
  notificationsDelta: CapturedNotificationSummary[];
  emailsDelta: CapturedEmailSummary[];
} {
  const { seenNotificationIds, seenEmailIds, currentNotifications, currentEmails } = params;

  const notificationsDelta: CapturedNotificationSummary[] = [];
  for (const n of currentNotifications) {
    if (!seenNotificationIds.has(n.id)) {
      seenNotificationIds.add(n.id);
      notificationsDelta.push(toNotificationSummary(n));
    }
  }

  const emailsDelta: CapturedEmailSummary[] = [];
  for (const e of currentEmails) {
    if (!seenEmailIds.has(e.id)) {
      seenEmailIds.add(e.id);
      emailsDelta.push(toEmailSummary(e));
    }
  }

  return { notificationsDelta, emailsDelta };
}

export function createRecordedStep(params: {
  index: number;
  kind: RecordedActionKind;
  label: string;
  selector: string;
  fallbackSelectors: string[];
  tagName: string;
  inputType?: string;
  value?: string;
  checked?: boolean;
  role: UserRole;
  actorId: string;
  actorName: string;
  activeTab?: string;
  notificationsDelta?: CapturedNotificationSummary[];
  emailsDelta?: CapturedEmailSummary[];
}): RecordedStep {
  return {
    id: `qa-step-${Date.now()}-${params.index}-${Math.random().toString(36).slice(2, 6)}`,
    index: params.index,
    timestamp: new Date().toISOString(),
    kind: params.kind,
    label: params.label,
    selector: params.selector,
    fallbackSelectors: params.fallbackSelectors,
    tagName: params.tagName,
    inputType: params.inputType,
    value: params.value,
    checked: params.checked,
    role: params.role,
    actorId: params.actorId,
    actorName: params.actorName,
    activeTab: params.activeTab,
    notificationsDelta: params.notificationsDelta || [],
    emailsDelta: params.emailsDelta || [],
  };
}

export function finalizeRecordedFlow(params: {
  name?: string;
  startRole: UserRole;
  startActorId: string;
  startActorName: string;
  steps: RecordedStep[];
}): RecordedFlow {
  const allNotificationsDelta = params.steps.flatMap((s) => s.notificationsDelta);
  const allEmailsDelta = params.steps.flatMap((s) => s.emailsDelta);
  const autoName =
    params.name?.trim() ||
    `Grabación ${params.startActorName} (${params.steps.length} pasos)`;

  return {
    id: `qa-flow-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: autoName,
    createdAt: new Date().toISOString(),
    startRole: params.startRole,
    startActorId: params.startActorId,
    startActorName: params.startActorName,
    steps: params.steps,
    allNotificationsDelta,
    allEmailsDelta,
  };
}

export function loadSavedRecordedFlows(): RecordedFlow[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_FLOWS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveRecordedFlows(flows: RecordedFlow[]): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_FLOWS_KEY, JSON.stringify(flows.slice(0, 20)));
  } catch {
    // Ignore storage quota issues
  }
}

export function buildPresetRecordedFlow(params?: {
  actorId?: string;
  actorName?: string;
}): RecordedFlow {
  const actorId = params?.actorId || 'mus-2';
  const actorName = params?.actorName || 'Músico Test 2';
  const steps: RecordedStep[] = [
    createRecordedStep({
      index: 1,
      kind: 'click',
      label: 'Abrir Convocatorias',
      selector: 'text=button:Convocatorias',
      fallbackSelectors: ['[data-testid="nav-convocatorias"]'],
      tagName: 'button',
      role: 'musico',
      actorId,
      actorName,
      activeTab: 'convocatorias',
    }),
    createRecordedStep({
      index: 2,
      kind: 'click',
      label: 'Postular horario 22:45 a 00:15 hs (2026-11-28)',
      selector: 'text=button:Postularme al Horario',
      fallbackSelectors: ['button'],
      tagName: 'button',
      value: '2026-11-28|22:45-00:15',
      role: 'musico',
      actorId,
      actorName,
      activeTab: 'convocatorias',
    }),
    createRecordedStep({
      index: 3,
      kind: 'input',
      label: 'Caché propuesto ($)',
      selector: 'input[placeholder*="70000"]',
      fallbackSelectors: ['input[type="number"]'],
      tagName: 'input',
      inputType: 'number',
      value: '70000',
      role: 'musico',
      actorId,
      actorName,
      activeTab: 'convocatorias',
    }),
    createRecordedStep({
      index: 4,
      kind: 'submit',
      label: 'Enviar Propuesta',
      selector: 'text=button:Enviar Propuesta',
      fallbackSelectors: ['button[type="submit"]'],
      tagName: 'button',
      value: '2026-11-28|22:45-00:15|$70000',
      role: 'musico',
      actorId,
      actorName,
      activeTab: 'convocatorias',
      notificationsDelta: [
        {
          id: 'preset-notif-bar',
          title: 'Nueva postulación musical',
          message: `${actorName} se postuló en el horario 22:45 a 00:15 hs por $70.000.`,
          type: 'application',
          targetRole: 'bar',
          targetEntityId: 'venue-1',
          targetEmail: 'bar1@degira.com.ar',
        },
      ],
      emailsDelta: [
        {
          id: 'preset-email-bar',
          to: 'bar1@degira.com.ar',
          fromEmail: actorId === 'mus-1' ? 'musico1@degira.com.ar' : 'musico2@degira.com.ar',
          targetRole: 'bar',
          targetEntityId: 'venue-1',
          senderRole: 'musico',
          senderEntityId: actorId,
          type: 'proposal_to_bar',
          subject: `🎸 Nueva propuesta musical de ${actorName}`,
          bodyText: `Horario: 22:45 a 00:15 hs • Caché: $70.000`,
        },
      ],
    }),
  ];

  return finalizeRecordedFlow({
    name: `Plantilla: Postulación ${actorName} (22:45–00:15)`,
    startRole: 'musico',
    startActorId: actorId,
    startActorName: actorName,
    steps,
  });
}
