import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Bell,
  CheckCircle2,
  Circle,
  Copy,
  Database,
  FlaskConical,
  Layers,
  Mail,
  Play,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Square,
  Trash2,
  Users,
  X,
  AlertTriangle,
} from 'lucide-react';
import { getSentEmails, SentEmailRecord } from '../lib/emailService.ts';
import {
  isEmailVisibleToProfile,
  isNotificationVisibleToProfile,
} from '../utils/notificationScoping.ts';
import {
  clampCohortConfig,
  runCohortSimulation,
} from './cohortSimulator.ts';
import {
  executeGeneratedCaseBatch,
  replayFlowInLiveDom,
} from './replayRunner.ts';
import type {
  CohortConfig,
  CohortSimulationReport,
  GeneratedTestCase,
  QaAppBridge,
  QaNotificationRecord,
  QaStateSnapshot,
  RecordedFlow,
  RecordedStep,
  TestCaseExecutionResult,
} from './types.ts';
import {
  QA_OVERLAY_ATTR,
  buildPresetRecordedFlow,
  buildSemanticSelectors,
  computeNotificationAndEmailDelta,
  createRecordedStep,
  finalizeRecordedFlow,
  loadSavedRecordedFlows,
  resolveClickableTarget,
  saveRecordedFlows,
} from './uiRecorder.ts';
import {
  exportVariationsAsTestCode,
  generateSimilarTestCases,
  variationBadgeLabel,
} from './variationGenerator.ts';

interface QaToolOverlayProps {
  bridge: QaAppBridge;
  activeTab: string;
  isDrawerOpen: boolean;
  onOpenDrawer: () => void;
  onCloseDrawer: () => void;
  onDisableQaTool: () => void;
}

type QaDrawerTab = 'recorder' | 'simulator' | 'variations' | 'inbox';

export const QaToolOverlay: React.FC<QaToolOverlayProps> = ({
  bridge,
  activeTab,
  isDrawerOpen,
  onOpenDrawer,
  onCloseDrawer,
  onDisableQaTool,
}) => {
  const [qaTab, setQaTab] = useState<QaDrawerTab>('recorder');

  // Recorder state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSteps, setRecordingSteps] = useState<RecordedStep[]>([]);
  const [savedFlows, setSavedFlows] = useState<RecordedFlow[]>(() => {
    const existing = loadSavedRecordedFlows();
    return existing.length > 0 ? existing : [buildPresetRecordedFlow()];
  });
  const [selectedFlowId, setSelectedFlowId] = useState<string>(() => {
    const existing = loadSavedRecordedFlows();
    return existing[0]?.id || '';
  });

  // Configurable multi-role simulator state
  const [cohortConfig, setCohortConfig] = useState<CohortConfig>(() =>
    clampCohortConfig({
      barsCount: 3,
      musiciansCount: 4,
      spectatorsCount: 6,
      includeNotificationsAndEmails: true,
      includeScheduleClashes: true,
      includePaymentsAndQr: true,
      baseDate: '2026-12-05',
    })
  );
  const [simReport, setSimReport] = useState<CohortSimulationReport | null>(null);
  const [liveSnapshotBeforeQa, setLiveSnapshotBeforeQa] = useState<QaStateSnapshot | null>(null);

  // Variations & Runner state
  const [batchResults, setBatchResults] = useState<TestCaseExecutionResult[]>([]);
  const [isReplayingLive, setIsReplayingLive] = useState(false);
  const [liveReplayStatus, setLiveReplayStatus] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState(false);

  // Inbox audit filter state
  const [inboxKind, setInboxKind] = useState<'all' | 'notifications' | 'emails'>('all');
  const [inboxActorId, setInboxActorId] = useState<string>('ALL');

  const seenNotifIdsRef = useRef<Set<string>>(new Set());
  const seenEmailIdsRef = useRef<Set<string>>(new Set());
  const recordStartActorRef = useRef({
    role: bridge.role,
    actorId:
      bridge.role === 'bar'
        ? bridge.activeVenueId
        : bridge.role === 'musico'
        ? bridge.activeMusicianId
        : bridge.activePublicUserId,
    actorName: bridge.userDisplayName || 'Usuario',
  });
  const bridgeRef = useRef(bridge);
  bridgeRef.current = bridge;
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  const recordingStepsRef = useRef<RecordedStep[]>([]);
  const replayAbortRef = useRef<AbortController | null>(null);

  const activeActorId =
    bridge.role === 'bar'
      ? bridge.activeVenueId
      : bridge.role === 'musico'
      ? bridge.activeMusicianId
      : bridge.activePublicUserId;

  const selectedFlow: RecordedFlow = useMemo(() => {
    return (
      savedFlows.find((f) => f.id === selectedFlowId) ||
      savedFlows[0] ||
      buildPresetRecordedFlow({
        actorId: bridge.activeMusicianId,
        actorName: bridge.musicians.find((m) => m.id === bridge.activeMusicianId)?.stageName,
      })
    );
  }, [savedFlows, selectedFlowId, bridge.activeMusicianId, bridge.musicians]);

  const generatedCases: GeneratedTestCase[] = useMemo(() => {
    return generateSimilarTestCases({
      flow: selectedFlow,
      config: cohortConfig,
      venues: simReport?.artifacts.venues,
      musicians: simReport?.artifacts.musicians,
      publicUsers: simReport?.artifacts.publicUsers,
    });
  }, [selectedFlow, cohortConfig, simReport]);

  // Global DOM capture listeners while recording
  useEffect(() => {
    if (!isRecording) return;

    const recordEvent = (
      kind: RecordedStep['kind'],
      el: Element,
      extra?: { value?: string; checked?: boolean }
    ) => {
      const b = bridgeRef.current;
      const actorId =
        b.role === 'bar'
          ? b.activeVenueId
          : b.role === 'musico'
          ? b.activeMusicianId
          : b.activePublicUserId;
      const { primary, fallbacks, label } = buildSemanticSelectors(el);
      const { notificationsDelta, emailsDelta } = computeNotificationAndEmailDelta({
        seenNotificationIds: seenNotifIdsRef.current,
        seenEmailIds: seenEmailIdsRef.current,
        currentNotifications: b.rawNotifications,
        currentEmails: getSentEmails(),
      });

      const step = createRecordedStep({
        index: recordingStepsRef.current.length + 1,
        kind,
        label,
        selector: primary,
        fallbackSelectors: fallbacks,
        tagName: el.tagName.toLowerCase(),
        inputType: el instanceof HTMLInputElement ? el.type : undefined,
        value: extra?.value,
        checked: extra?.checked,
        role: b.role,
        actorId,
        actorName: b.userDisplayName || actorId,
        activeTab: activeTabRef.current,
        notificationsDelta,
        emailsDelta,
      });

      recordingStepsRef.current = [...recordingStepsRef.current, step];
      setRecordingSteps(recordingStepsRef.current);

      // Enrich with async Notification/Email deltas fired after React event handlers settle
      setTimeout(() => {
        const latestB = bridgeRef.current;
        const asyncDelta = computeNotificationAndEmailDelta({
          seenNotificationIds: seenNotifIdsRef.current,
          seenEmailIds: seenEmailIdsRef.current,
          currentNotifications: latestB.rawNotifications,
          currentEmails: getSentEmails(),
        });
        if (asyncDelta.notificationsDelta.length === 0 && asyncDelta.emailsDelta.length === 0) {
          return;
        }
        recordingStepsRef.current = recordingStepsRef.current.map((item) =>
          item.id === step.id
            ? {
                ...item,
                notificationsDelta: [...item.notificationsDelta, ...asyncDelta.notificationsDelta],
                emailsDelta: [...item.emailsDelta, ...asyncDelta.emailsDelta],
              }
            : item
        );
        setRecordingSteps(recordingStepsRef.current);
      }, 60);
    };

    const handleClick = (ev: MouseEvent) => {
      const target = resolveClickableTarget(ev.target);
      if (!target) return;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        if (target instanceof HTMLInputElement && (target.type === 'checkbox' || target.type === 'radio')) {
          recordEvent('click', target, { checked: target.checked });
        }
        return;
      }
      recordEvent('click', target);
    };

    const handleChange = (ev: Event) => {
      const raw = ev.target;
      if (!(raw instanceof Element)) return;
      if (!resolveClickableTarget(raw)) return;
      if (raw instanceof HTMLSelectElement) {
        recordEvent('select', raw, { value: raw.value });
      } else if (raw instanceof HTMLInputElement || raw instanceof HTMLTextAreaElement) {
        if (raw instanceof HTMLInputElement && raw.type === 'checkbox') {
          recordEvent('input', raw, { checked: raw.checked });
        } else {
          recordEvent('input', raw, { value: raw.value });
        }
      }
    };

    const handleSubmit = (ev: SubmitEvent) => {
      const raw = ev.target;
      if (!(raw instanceof Element)) return;
      if (!resolveClickableTarget(raw)) return;
      recordEvent('submit', raw);
    };

    document.addEventListener('click', handleClick, true);
    document.addEventListener('change', handleChange, true);
    document.addEventListener('submit', handleSubmit, true);

    return () => {
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('change', handleChange, true);
      document.removeEventListener('submit', handleSubmit, true);
    };
  }, [isRecording]);

  const handleStartRecording = () => {
    seenNotifIdsRef.current = new Set(bridge.rawNotifications.map((n) => n.id));
    seenEmailIdsRef.current = new Set(getSentEmails().map((e) => e.id));
    recordStartActorRef.current = {
      role: bridge.role,
      actorId: activeActorId,
      actorName: bridge.userDisplayName || activeActorId,
    };
    recordingStepsRef.current = [];
    setRecordingSteps([]);
    setIsRecording(true);
  };

  const handleStopRecording = () => {
    setIsRecording(false);
    let stepsToSave = recordingStepsRef.current;
    if (stepsToSave.length > 0) {
      const trailingDelta = computeNotificationAndEmailDelta({
        seenNotificationIds: seenNotifIdsRef.current,
        seenEmailIds: seenEmailIdsRef.current,
        currentNotifications: bridge.rawNotifications,
        currentEmails: getSentEmails(),
      });
      if (trailingDelta.notificationsDelta.length > 0 || trailingDelta.emailsDelta.length > 0) {
        const lastIdx = stepsToSave.length - 1;
        stepsToSave = stepsToSave.map((item, idx) =>
          idx === lastIdx
            ? {
                ...item,
                notificationsDelta: [
                  ...item.notificationsDelta,
                  ...trailingDelta.notificationsDelta,
                ],
                emailsDelta: [...item.emailsDelta, ...trailingDelta.emailsDelta],
              }
            : item
        );
      }
      const flow = finalizeRecordedFlow({
        startRole: recordStartActorRef.current.role,
        startActorId: recordStartActorRef.current.actorId,
        startActorName: recordStartActorRef.current.actorName,
        steps: stepsToSave,
      });
      const next = [flow, ...savedFlows].slice(0, 20);
      setSavedFlows(next);
      setSelectedFlowId(flow.id);
      saveRecordedFlows(next);
      setQaTab('variations');
    } else {
      setQaTab('recorder');
    }
    onOpenDrawer();
  };

  const handleRunSimulation = (loadIntoLiveApp = false) => {
    const report = runCohortSimulation(cohortConfig);
    setSimReport(report);

    if (loadIntoLiveApp) {
      if (!liveSnapshotBeforeQa) {
        setLiveSnapshotBeforeQa(bridge.captureSnapshot());
      }
      bridge.setQaSandboxActive(true);
      bridge.loadQaCohortIntoState(report.artifacts);
    }

    const batch = executeGeneratedCaseBatch({
      cases: generateSimilarTestCases({
        flow: selectedFlow,
        config: cohortConfig,
        venues: report.artifacts.venues,
        musicians: report.artifacts.musicians,
        publicUsers: report.artifacts.publicUsers,
      }),
      config: cohortConfig,
      report,
    });
    setBatchResults(batch.results);
  };

  const handleRestoreLiveSnapshot = () => {
    if (liveSnapshotBeforeQa) {
      bridge.restoreSnapshot(liveSnapshotBeforeQa);
      setLiveSnapshotBeforeQa(null);
    }
    bridge.setQaSandboxActive(false);
  };

  const handleRunBatch = () => {
    const batch = executeGeneratedCaseBatch({
      cases: generatedCases,
      config: cohortConfig,
      report: simReport || undefined,
    });
    setSimReport(batch.report);
    setBatchResults(batch.results);
  };

  const handleLiveReplayCase = async (tc: GeneratedTestCase) => {
    if (isReplayingLive) {
      replayAbortRef.current?.abort();
      setIsReplayingLive(false);
      return;
    }

    const controller = new AbortController();
    replayAbortRef.current = controller;
    setIsReplayingLive(true);
    setLiveReplayStatus(`Iniciando replay de "${tc.title}"...`);
    onCloseDrawer();

    try {
      const summary = await replayFlowInLiveDom({
        steps: tc.steps,
        bridge,
        signal: controller.signal,
        onStepUpdate: (info) => {
          setLiveReplayStatus(
            `Paso ${info.stepIndex + 1}/${info.totalSteps}: ${info.label} (${info.status})`
          );
        },
      });
      setLiveReplayStatus(
        `Finalizado: ${summary.completedSteps} pasos ok, ${summary.skippedSteps} omitidos • ${summary.notificationsEmitted.length} notifs, ${summary.emailsEmitted.length} emails`
      );
    } finally {
      setIsReplayingLive(false);
      onOpenDrawer();
    }
  };

  const handleCopyTestCode = async () => {
    const code = exportVariationsAsTestCode({
      flow: selectedFlow,
      config: cohortConfig,
      cases: generatedCases,
    });
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // Fallback ignored
    }
  };

  // Audit Inbox source (either simulated cohort report or live app notifications + emails)
  const auditNotifications: QaNotificationRecord[] = useMemo(() => {
    const source = simReport ? simReport.notifications : bridge.rawNotifications;
    if (inboxActorId === 'ALL') return source;
    const summary = simReport?.actorSummaries.find((a) => a.id === inboxActorId);
    if (!summary) return source.filter((n) => n.targetEntityId === inboxActorId);
    return source.filter((n) =>
      isNotificationVisibleToProfile(n, {
        role: summary.role,
        entityId: summary.id,
        email: summary.email,
        displayName: summary.displayName,
      })
    );
  }, [simReport, bridge.rawNotifications, inboxActorId]);

  const auditEmails: SentEmailRecord[] = useMemo(() => {
    const source = simReport ? simReport.emails : getSentEmails();
    if (inboxActorId === 'ALL') return source;
    const summary = simReport?.actorSummaries.find((a) => a.id === inboxActorId);
    if (!summary) {
      return source.filter(
        (e) => e.targetEntityId === inboxActorId || e.senderEntityId === inboxActorId
      );
    }
    return source.filter((e) =>
      isEmailVisibleToProfile(e, {
        role: summary.role,
        entityId: summary.id,
        email: summary.email,
        displayName: summary.displayName,
      })
    );
  }, [simReport, inboxActorId]);

  const recordingNotifCount = recordingSteps.reduce((acc, s) => acc + s.notificationsDelta.length, 0);
  const recordingEmailCount = recordingSteps.reduce((acc, s) => acc + s.emailsDelta.length, 0);

  return (
    <div {...{ [QA_OVERLAY_ATTR]: 'true' }}>
      {/* Floating compact QA bar (bottom-right above bottom nav) */}
      <div
        data-testid="qa-floating-bar"
        className="fixed bottom-20 right-3 z-[60] flex items-center gap-1.5 px-2.5 py-1.5 rounded-2xl bg-slate-950/95 border border-amber-500/50 shadow-2xl backdrop-blur-md"
      >
        <button
          type="button"
          data-testid="qa-rec-toggle-btn"
          onClick={isRecording ? handleStopRecording : handleStartRecording}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-black transition-colors ${
            isRecording
              ? 'bg-rose-500 text-white animate-pulse'
              : 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/40'
          }`}
        >
          {isRecording ? <Square className="w-3 h-3 fill-current" /> : <Circle className="w-3 h-3 fill-current" />}
          <span>{isRecording ? `Detener (${recordingSteps.length})` : 'Grabar'}</span>
        </button>

        <button
          type="button"
          data-testid="qa-open-drawer-btn"
          onClick={isDrawerOpen ? onCloseDrawer : onOpenDrawer}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-black transition-colors"
        >
          <FlaskConical className="w-3.5 h-3.5" />
          <span>QA Lab</span>
        </button>

        {bridge.isQaSandboxActive && (
          <button
            type="button"
            data-testid="qa-restore-pill-btn"
            onClick={handleRestoreLiveSnapshot}
            title="Restaurar estado original previo al Sandbox QA"
            className="px-2 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold"
          >
            Restaurar
          </button>
        )}

        <button
          type="button"
          onClick={onDisableQaTool}
          aria-label="Ocultar herramienta QA"
          title="Cerrar QA Lab"
          className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Live recording / replay status pill */}
      {(isRecording || liveReplayStatus) && !isDrawerOpen && (
        <div className="fixed bottom-32 right-3 z-[60] max-w-[260px] px-3 py-2 rounded-xl bg-slate-900/95 border border-slate-700 text-[10px] text-slate-200 shadow-xl">
          {isRecording ? (
            <div className="space-y-0.5">
              <div className="font-bold text-rose-300">
                Grabando UI • {recordingSteps.length} pasos
              </div>
              <div className="text-slate-400">
                {recordingNotifCount} notifs • {recordingEmailCount} emails capturados
              </div>
            </div>
          ) : (
            <div className="font-medium text-amber-300">{liveReplayStatus}</div>
          )}
        </div>
      )}

      {/* Main QA Lab Modal / Bottom Drawer */}
      {isDrawerOpen && (
        <div
          data-testid="qa-lab-drawer"
          className="fixed inset-0 z-[70] bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <div className="w-full max-w-3xl max-h-[92vh] bg-slate-950 border border-slate-800 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden">
            {/* Drawer Header */}
            <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                  <FlaskConical className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-sm font-black text-slate-100 truncate">
                      DeGira Live QA Lab
                    </h2>
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-bold text-amber-300 border border-slate-700">
                      {cohortConfig.barsCount}B • {cohortConfig.musiciansCount}M • {cohortConfig.spectatorsCount}P
                    </span>
                    {bridge.isQaSandboxActive && (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-[10px] font-bold text-emerald-300 border border-emerald-500/30">
                        Sandbox Activo (sin tocar nube)
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 truncate">
                    Grabador UI, generador de variaciones, simulador N-usuarios y auditoría de Notifs/Emails
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onCloseDrawer}
                aria-label="Cerrar QA Lab"
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tabs */}
            <div className="px-3 py-2 border-b border-slate-800 bg-slate-900/50 grid grid-cols-4 gap-1.5">
              {(
                [
                  { id: 'recorder', mobileLabel: 'Grabar', label: '1. Grabar UI', icon: Activity },
                  { id: 'simulator', mobileLabel: 'Simular', label: '2. Simulador N', icon: Users },
                  {
                    id: 'variations',
                    mobileLabel: `Casos (${generatedCases.length})`,
                    label: `3. Casos (${generatedCases.length})`,
                    icon: Layers,
                  },
                  {
                    id: 'inbox',
                    mobileLabel: 'Notif/Mail',
                    label: `4. Notifs/Mail (${
                      (simReport ? simReport.notifications.length : bridge.rawNotifications.length) +
                      (simReport ? simReport.emails.length : getSentEmails().length)
                    })`,
                    icon: Mail,
                  },
                ] as const
              ).map((t) => {
                const Icon = t.icon;
                const active = qaTab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    data-testid={`qa-tab-${t.id}`}
                    onClick={() => setQaTab(t.id)}
                    className={`flex items-center justify-center gap-1 px-1.5 sm:px-2 py-2 rounded-xl text-[10px] sm:text-[11px] font-bold transition-colors ${
                      active
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-slate-900 text-slate-300 border border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="sm:hidden whitespace-nowrap">{t.mobileLabel}</span>
                    <span className="hidden sm:inline truncate">{t.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Body */}
            <div className="p-4 overflow-y-auto space-y-4 flex-1 text-slate-200">
              {/* TAB 1: RECORDER */}
              {qaTab === 'recorder' && (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-xs font-black text-slate-100">
                        Grabador de Acciones en la UI
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Grabá clicks, inputs y envíos reales mientras usás DeGira. Captura automáticamente las notificaciones y emails generados en cada paso.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        data-testid="qa-drawer-rec-btn"
                        onClick={() => {
                          if (isRecording) {
                            handleStopRecording();
                          } else {
                            handleStartRecording();
                            onCloseDrawer();
                          }
                        }}
                        className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 ${
                          isRecording
                            ? 'bg-rose-500 text-white'
                            : 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40'
                        }`}
                      >
                        {isRecording ? <Square className="w-3.5 h-3.5 fill-current" /> : <Circle className="w-3.5 h-3.5 fill-current" />}
                        <span>{isRecording ? 'Detener y Guardar' : 'Grabar en App'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Active/Saved recordings list */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Grabaciones guardadas ({savedFlows.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const preset = buildPresetRecordedFlow();
                          const next = [preset, ...savedFlows].slice(0, 20);
                          setSavedFlows(next);
                          setSelectedFlowId(preset.id);
                          saveRecordedFlows(next);
                        }}
                        className="text-[11px] font-bold text-amber-400 hover:underline whitespace-nowrap"
                      >
                        + Cargar plantilla de Clash
                      </button>
                    </div>

                    <div className="space-y-2">
                      {savedFlows.map((flow) => {
                        const isSelected = flow.id === selectedFlow.id;
                        return (
                          <div
                            key={flow.id}
                            className={`p-3 rounded-2xl border transition-colors ${
                              isSelected
                                ? 'bg-amber-500/10 border-amber-500/50'
                                : 'bg-slate-900/70 border-slate-800'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => setSelectedFlowId(flow.id)}
                                className="text-left flex-1 min-w-0"
                              >
                                <div className="text-xs font-bold text-slate-100 leading-snug">
                                  {flow.name}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  Inicio: {flow.startActorName} ({flow.startRole}) • {flow.steps.length} pasos •{' '}
                                  {flow.allNotificationsDelta.length} notifs • {flow.allEmailsDelta.length} emails
                                </div>
                              </button>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedFlowId(flow.id);
                                    setQaTab('variations');
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 text-[10px] font-black"
                                >
                                  Generar Casos →
                                </button>
                                {savedFlows.length > 1 && (
                                  <button
                                    type="button"
                                    aria-label="Eliminar grabación"
                                    onClick={() => {
                                      const next = savedFlows.filter((f) => f.id !== flow.id);
                                      setSavedFlows(next);
                                      saveRecordedFlows(next);
                                    }}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>

                            {isSelected && (
                              <div className="mt-2.5 pt-2 border-t border-slate-800/80 space-y-1.5">
                                {flow.steps.map((s) => (
                                  <div
                                    key={s.id}
                                    className="flex flex-wrap items-center justify-between gap-1 text-[11px] bg-slate-950/70 px-2.5 py-1.5 rounded-lg border border-slate-800/60"
                                  >
                                    <div className="min-w-0">
                                      <span className="font-mono text-amber-400 mr-1.5">#{s.index}</span>
                                      <span className="font-semibold text-slate-200">{s.label}</span>
                                      {s.value && (
                                        <span className="ml-1.5 text-emerald-300 font-mono text-[10px]">
                                          = "{s.value}"
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[10px]">
                                      {s.notificationsDelta.length > 0 && (
                                        <span className="px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300">
                                          +{s.notificationsDelta.length} notif
                                        </span>
                                      )}
                                      {s.emailsDelta.length > 0 && (
                                        <span className="px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-300">
                                          +{s.emailsDelta.length} email
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: MULTI-USER SIMULATOR */}
              {qaTab === 'simulator' && (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-xs font-black text-slate-100">
                        Configurar Cantidad de Usuarios por Rol
                      </h3>
                      <span className="text-[11px] font-bold text-amber-400">
                        Total: {cohortConfig.barsCount + cohortConfig.musiciansCount + cohortConfig.spectatorsCount} usuarios
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                        <label
                          htmlFor="qa-bars-count"
                          className="flex items-center justify-between text-xs font-bold text-slate-200"
                        >
                          <span>Bares</span>
                          <span className="text-amber-400">{cohortConfig.barsCount}</span>
                        </label>
                        <input
                          id="qa-bars-count"
                          data-testid="qa-bars-count-input"
                          type="number"
                          min={1}
                          max={15}
                          value={cohortConfig.barsCount}
                          onChange={(e) =>
                            setCohortConfig((c) =>
                              clampCohortConfig({ ...c, barsCount: Number(e.target.value) })
                            )
                          }
                          className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-100"
                        />
                      </div>

                      <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                        <label
                          htmlFor="qa-musicians-count"
                          className="flex items-center justify-between text-xs font-bold text-slate-200"
                        >
                          <span>Músicos</span>
                          <span className="text-amber-400">{cohortConfig.musiciansCount}</span>
                        </label>
                        <input
                          id="qa-musicians-count"
                          data-testid="qa-musicians-count-input"
                          type="number"
                          min={1}
                          max={25}
                          value={cohortConfig.musiciansCount}
                          onChange={(e) =>
                            setCohortConfig((c) =>
                              clampCohortConfig({ ...c, musiciansCount: Number(e.target.value) })
                            )
                          }
                          className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-100"
                        />
                      </div>

                      <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                        <label
                          htmlFor="qa-spectators-count"
                          className="flex items-center justify-between text-xs font-bold text-slate-200"
                        >
                          <span>Público General</span>
                          <span className="text-amber-400">{cohortConfig.spectatorsCount}</span>
                        </label>
                        <input
                          id="qa-spectators-count"
                          data-testid="qa-spectators-count-input"
                          type="number"
                          min={1}
                          max={40}
                          value={cohortConfig.spectatorsCount}
                          onChange={(e) =>
                            setCohortConfig((c) =>
                              clampCohortConfig({ ...c, spectatorsCount: Number(e.target.value) })
                            )
                          }
                          className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-100"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
                      <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={cohortConfig.includeNotificationsAndEmails}
                          onChange={(e) =>
                            setCohortConfig((c) => ({
                              ...c,
                              includeNotificationsAndEmails: e.target.checked,
                            }))
                          }
                        />
                        <span>Notificaciones y Emails</span>
                      </label>
                      <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={cohortConfig.includeScheduleClashes}
                          onChange={(e) =>
                            setCohortConfig((c) => ({
                              ...c,
                              includeScheduleClashes: e.target.checked,
                            }))
                          }
                        />
                        <span>Forzar Clashes de Horario</span>
                      </label>
                      <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={cohortConfig.includePaymentsAndQr}
                          onChange={(e) =>
                            setCohortConfig((c) => ({
                              ...c,
                              includePaymentsAndQr: e.target.checked,
                            }))
                          }
                        />
                        <span>Pagos, Pases QR y Expiración</span>
                      </label>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        data-testid="qa-run-sim-btn"
                        onClick={() => handleRunSimulation(false)}
                        className="flex-1 min-w-[170px] px-3.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center justify-center gap-1.5"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Simular Cohorte</span>
                      </button>

                      <button
                        type="button"
                        data-testid="qa-load-sandbox-btn"
                        onClick={() => handleRunSimulation(true)}
                        className="flex-1 min-w-[170px] px-3.5 py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-black flex items-center justify-center gap-1.5"
                      >
                        <Database className="w-3.5 h-3.5" />
                        <span>Cargar en App (Sandbox)</span>
                      </button>

                      {bridge.isQaSandboxActive && (
                        <button
                          type="button"
                          onClick={handleRestoreLiveSnapshot}
                          className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Restaurar Original</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Simulation Results */}
                  {simReport && (
                    <div data-testid="qa-sim-report" className="space-y-3">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                          <div className="text-[10px] text-slate-400">Eventos / Slots</div>
                          <div className="text-sm font-black text-slate-100">
                            {simReport.publishedEvents}/{simReport.eventsCreated} ({simReport.slotsTotal} slots)
                          </div>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                          <div className="text-[10px] text-slate-400">Reservas QR / Exp.</div>
                          <div className="text-sm font-black text-emerald-300">
                            {simReport.reservationsConfirmed} QR • {simReport.reservationsExpired} exp
                          </div>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                          <div className="text-[10px] text-slate-400">Notifs / Emails</div>
                          <div className="text-sm font-black text-sky-300">
                            {simReport.notifications.length} N • {simReport.emails.length} E
                          </div>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                          <div className="text-[10px] text-slate-400">Fugas Totales</div>
                          <div
                            className={`text-sm font-black ${
                              simReport.venueIsolationLeaks +
                                simReport.notificationLeaks +
                                simReport.emailLeaks ===
                              0
                                ? 'text-emerald-400'
                                : 'text-rose-400'
                            }`}
                          >
                            {simReport.venueIsolationLeaks +
                              simReport.notificationLeaks +
                              simReport.emailLeaks}{' '}
                            fugas
                          </div>
                        </div>
                      </div>

                      {/* Assertions */}
                      <div className="space-y-1.5">
                        {simReport.assertions.map((a, idx) => (
                          <div
                            key={idx}
                            className={`p-2.5 rounded-xl border flex items-start gap-2 text-xs ${
                              a.passed
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                                : 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                            }`}
                          >
                            {a.passed ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                            ) : (
                              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                            )}
                            <div>
                              <div className="font-bold">{a.label}</div>
                              <div className="text-[11px] opacity-85">{a.detail}</div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Quick Actor Switcher when Sandbox is loaded */}
                      {bridge.isQaSandboxActive && (
                        <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                          <div className="text-[11px] font-bold text-slate-300">
                            Probar App en Vivo como cualquiera de los {simReport.actorSummaries.length} usuarios simulados:
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {simReport.actorSummaries.slice(0, 15).map((actor) => (
                              <button
                                key={actor.id}
                                type="button"
                                onClick={() => {
                                  bridge.switchActor({
                                    role: actor.role,
                                    entityId: actor.id,
                                    displayName: actor.displayName,
                                    email: actor.email,
                                  });
                                  onCloseDrawer();
                                }}
                                className="px-2 py-1 rounded-lg bg-slate-950 hover:bg-amber-500/20 border border-slate-700 hover:border-amber-500/50 text-[10px] font-bold text-slate-200"
                              >
                                {actor.displayName} ({actor.notificationsCount}N/{actor.emailsCount}E)
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: SIMILAR TEST CASE VARIATIONS */}
              {qaTab === 'variations' && (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-xs font-black text-slate-100">
                        Casos Similares Generados desde "{selectedFlow.name}"
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Adaptados a {cohortConfig.barsCount} Bares × {cohortConfig.musiciansCount} Músicos × {cohortConfig.spectatorsCount} Público, incluyendo clashes y notificaciones/emails.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        data-testid="qa-run-batch-btn"
                        onClick={handleRunBatch}
                        className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center gap-1.5"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Ejecutar Lote ({generatedCases.length})</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleCopyTestCode}
                        className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>{copiedCode ? '¡Copiado!' : 'Exportar Test'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    {generatedCases.map((tc) => {
                      const res = batchResults.find((r) => r.testCaseId === tc.id);
                      return (
                        <div
                          key={tc.id}
                          data-testid={`qa-case-card-${tc.id}`}
                          className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="space-y-1 min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                                  {variationBadgeLabel(tc.variationKind)}
                                </span>
                                {res && (
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-black ${
                                      res.status === 'passed'
                                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                    }`}
                                  >
                                    {res.status === 'passed' ? 'PASS' : 'FAIL'} ({res.durationMs}ms)
                                  </span>
                                )}
                              </div>
                              <div className="text-xs font-black text-slate-100">{tc.title}</div>
                              <div className="text-[11px] text-slate-400">{tc.description}</div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleLiveReplayCase(tc)}
                              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] font-bold text-slate-200 flex items-center gap-1 shrink-0"
                            >
                              <Play className="w-3 h-3 text-amber-400" />
                              <span>Reproducir UI</span>
                            </button>
                          </div>

                          <div className="flex flex-wrap gap-1.5 text-[10px] text-slate-300">
                            {tc.expectedOutcomes.map((o, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-800"
                              >
                                • {o}
                              </span>
                            ))}
                          </div>

                          {res && (
                            <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                              {res.checks.map((c, i) => (
                                <div key={i} className="flex items-start gap-1.5 text-[11px]">
                                  {c.passed ? (
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                                  ) : (
                                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                                  )}
                                  <div className="min-w-0">
                                    <span className="font-semibold text-slate-200">{c.label}: </span>
                                    <span className="text-slate-400">{c.detail}</span>
                                  </div>
                                </div>
                              ))}
                              {(res.notificationsEmitted.length > 0 || res.emailsEmitted.length > 0) && (
                                <div className="text-[10px] text-sky-300 pt-0.5">
                                  Notificaciones ({res.notificationsEmitted.length}) • Emails ({res.emailsEmitted.length}) • Fugas: {res.leakCount}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 4: GLOBAL NOTIFICATIONS & EMAILS AUDIT */}
              {qaTab === 'inbox' && (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-xs font-black text-slate-100">
                          Auditoría Global de Notificaciones y Emails
                        </h3>
                        <p className="text-[11px] text-slate-400">
                          Inspeccioná qué recibió cada usuario simulado o real y confirmá cero cruces indebidos.
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        <span className="text-[11px] font-bold text-emerald-300">
                          {simReport
                            ? `${simReport.notificationLeaks + simReport.emailLeaks} fugas`
                            : 'Modo en Vivo'}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        aria-label="Filtrar buzón por usuario"
                        value={inboxActorId}
                        onChange={(e) => setInboxActorId(e.target.value)}
                        className="flex-1 min-w-[180px] px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-100"
                      >
                        <option value="ALL">Todos los usuarios</option>
                        {simReport
                          ? simReport.actorSummaries.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.displayName} ({a.role}) — {a.notificationsCount} notifs / {a.emailsCount} emails
                              </option>
                            ))
                          : [
                              ...bridge.venues.map((v) => ({ id: v.id, label: `${v.name} (bar)` })),
                              ...bridge.musicians.map((m) => ({ id: m.id, label: `${m.stageName} (musico)` })),
                              ...bridge.publicUsers.map((p) => ({ id: p.id, label: `${p.name} (espectador)` })),
                            ].map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.label}
                              </option>
                            ))}
                      </select>

                      <div className="flex gap-1">
                        {(
                          [
                            { id: 'all', label: 'Todo' },
                            { id: 'notifications', label: `Notifs (${auditNotifications.length})` },
                            { id: 'emails', label: `Emails (${auditEmails.length})` },
                          ] as const
                        ).map((k) => (
                          <button
                            key={k.id}
                            type="button"
                            onClick={() => setInboxKind(k.id)}
                            className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold ${
                              inboxKind === k.id
                                ? 'bg-amber-500 text-slate-950'
                                : 'bg-slate-950 border border-slate-800 text-slate-300'
                            }`}
                          >
                            {k.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Notifications List */}
                  {(inboxKind === 'all' || inboxKind === 'notifications') && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-sky-300">
                        <Bell className="w-3.5 h-3.5" />
                        <span>Notificaciones In-App ({auditNotifications.length})</span>
                      </div>
                      {auditNotifications.length === 0 ? (
                        <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800 text-xs text-slate-400">
                          Sin notificaciones para este filtro. Ejecutá "Simular Cohorte" o grabá una acción en la app.
                        </div>
                      ) : (
                        auditNotifications.slice(0, 30).map((n) => (
                          <div
                            key={n.id}
                            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-0.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-slate-100">{n.title}</span>
                              <span className="px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 text-[10px] font-bold">
                                {n.targetRole || 'sin-rol'} • {n.targetEntityId || n.targetEmail || 'global'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400">{n.message}</p>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* Emails List */}
                  {(inboxKind === 'all' || inboxKind === 'emails') && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-violet-300">
                        <Mail className="w-3.5 h-3.5" />
                        <span>Emails Despachados ({auditEmails.length})</span>
                      </div>
                      {auditEmails.length === 0 ? (
                        <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800 text-xs text-slate-400">
                          Sin emails para este filtro.
                        </div>
                      ) : (
                        auditEmails.slice(0, 30).map((e) => (
                          <div
                            key={e.id}
                            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-1"
                          >
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="font-bold text-slate-100">{e.subject}</span>
                              <span className="px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-300 text-[10px] font-bold">
                                {e.type}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400">
                              Para: <strong className="text-slate-200">{e.to}</strong>
                              {e.fromEmail && (
                                <>
                                  {' '}
                                  • De: <span className="text-slate-300">{e.fromEmail}</span>
                                </>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-300 whitespace-pre-line">{e.bodyText}</p>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
