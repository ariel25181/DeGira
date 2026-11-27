export { QaToolOverlay } from './QaToolOverlay.tsx';
export { runCohortSimulation, clampCohortConfig, buildCohortProfiles } from './cohortSimulator.ts';
export {
  generateSimilarTestCases,
  exportVariationsAsTestCode,
  extractFlowParameters,
  variationBadgeLabel,
} from './variationGenerator.ts';
export {
  buildPresetRecordedFlow,
  buildSemanticSelectors,
  computeNotificationAndEmailDelta,
  createRecordedStep,
  finalizeRecordedFlow,
  loadSavedRecordedFlows,
  saveRecordedFlows,
} from './uiRecorder.ts';
export { executeGeneratedCaseBatch, replayFlowInLiveDom } from './replayRunner.ts';
export type * from './types.ts';

const QA_ENABLED_STORAGE_KEY = 'degira:qa_tool_enabled:v1';

export function isQaToolActivated(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const params = new URLSearchParams(window.location.search);
    const paramVal = params.get('qa') ?? params.get('test');
    if (paramVal === '1' || paramVal === 'true') {
      localStorage.setItem(QA_ENABLED_STORAGE_KEY, '1');
      return true;
    }
    if (paramVal === '0' || paramVal === 'false') {
      localStorage.removeItem(QA_ENABLED_STORAGE_KEY);
      return false;
    }
    return localStorage.getItem(QA_ENABLED_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setQaToolActivated(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (enabled) {
      localStorage.setItem(QA_ENABLED_STORAGE_KEY, '1');
    } else {
      localStorage.removeItem(QA_ENABLED_STORAGE_KEY);
    }
  } catch {
    // ignore storage errors
  }
}
