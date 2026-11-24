export const PWA_UPDATE_EVENT = 'degira:pwa-update-available';
export const RELOAD_GUARD_KEY = 'degira:pwa-last-reload-ms';
export const DEFAULT_RELOAD_COOLDOWN_MS = 10_000;
export const DEFAULT_UPDATE_POLL_INTERVAL_MS = 60_000;
export const DEFAULT_CHECK_THROTTLE_MS = 5_000;

export interface CanAutoReloadParams {
  lastReloadMs: number | null;
  nowMs: number;
  hasFocusedFormField: boolean;
  cooldownMs?: number;
}

export function isFormFieldFocused(doc?: Pick<Document, 'activeElement'> | null): boolean {
  const el = doc?.activeElement as
    | { tagName?: string; isContentEditable?: boolean }
    | null
    | undefined;
  if (!el) return false;
  const tag = (el.tagName || '').toUpperCase();
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
    return true;
  }
  return Boolean(el.isContentEditable);
}

export function parseStoredReloadMs(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function canAutoReload({
  lastReloadMs,
  nowMs,
  hasFocusedFormField,
  cooldownMs = DEFAULT_RELOAD_COOLDOWN_MS,
}: CanAutoReloadParams): boolean {
  if (hasFocusedFormField) return false;
  if (lastReloadMs !== null && nowMs - lastReloadMs < cooldownMs) {
    return false;
  }
  return true;
}

export interface PWAUpdateEventDetail {
  applyUpdate?: () => Promise<void> | void;
}

export function dispatchPWAUpdateAvailable(
  win: (Pick<Window, 'dispatchEvent'> & { CustomEvent?: typeof CustomEvent }) | null | undefined =
    typeof window !== 'undefined' ? window : null,
  detail: PWAUpdateEventDetail = {}
): void {
  if (!win) return;
  const EventCtor =
    win.CustomEvent ?? (typeof CustomEvent !== 'undefined' ? CustomEvent : undefined);
  if (!EventCtor) return;
  win.dispatchEvent(new EventCtor(PWA_UPDATE_EVENT, { detail }));
}

export async function clearOutdatedRuntimeCaches(
  cachesObj: CacheStorage | undefined = typeof caches !== 'undefined' ? caches : undefined
): Promise<number> {
  if (!cachesObj || typeof cachesObj.keys !== 'function') return 0;
  try {
    const keys = await cachesObj.keys();
    await Promise.all(keys.map((key) => cachesObj.delete(key)));
    return keys.length;
  } catch {
    return 0;
  }
}

export async function forceRefreshAppCachesAndReload(
  options: {
    cachesObj?: CacheStorage;
    serviceWorker?: ServiceWorkerContainer;
    sessionStorageObj?: Pick<Storage, 'setItem'>;
    reloadFn?: () => void;
    nowMs?: number;
  } = {}
): Promise<void> {
  const cachesObj = options.cachesObj ?? (typeof caches !== 'undefined' ? caches : undefined);
  const serviceWorker =
    options.serviceWorker ??
    (typeof navigator !== 'undefined' && 'serviceWorker' in navigator
      ? navigator.serviceWorker
      : undefined);
  const storage =
    options.sessionStorageObj ??
    (typeof sessionStorage !== 'undefined' ? sessionStorage : undefined);
  const reloadFn =
    options.reloadFn ??
    (typeof window !== 'undefined' ? () => window.location.reload() : () => {});
  const nowMs = options.nowMs ?? Date.now();

  await clearOutdatedRuntimeCaches(cachesObj);

  if (serviceWorker && typeof serviceWorker.getRegistrations === 'function') {
    try {
      const registrations = await serviceWorker.getRegistrations();
      await Promise.all(
        registrations.map(async (reg) => {
          try {
            if (reg.waiting) {
              reg.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
            await reg.update();
          } catch {
            // Ignored on offline or ephemeral containers
          }
        })
      );
    } catch {
      // Ignored
    }
  }

  try {
    storage?.setItem(RELOAD_GUARD_KEY, String(nowMs));
  } catch {
    // Ignore private mode quota errors
  }

  reloadFn();
}

export interface SetupAutoUpdateParams {
  registerFn: (options: {
    immediate?: boolean;
    onNeedRefresh?: () => void;
    onRegisteredSW?: (swUrl: string, registration: ServiceWorkerRegistration | undefined) => void;
  }) => (reloadPage?: boolean) => Promise<void>;
  windowObj?: Window;
  documentObj?: Document;
  navigatorObj?: Navigator;
  sessionStorageObj?: Storage;
  nowFn?: () => number;
  reloadFn?: () => void;
  pollIntervalMs?: number;
  checkThrottleMs?: number;
}

export function setupServiceWorkerAutoUpdate(params: SetupAutoUpdateParams): () => void {
  const {
    registerFn,
    windowObj = typeof window !== 'undefined' ? window : undefined,
    documentObj = typeof document !== 'undefined' ? document : undefined,
    navigatorObj = typeof navigator !== 'undefined' ? navigator : undefined,
    sessionStorageObj = typeof sessionStorage !== 'undefined' ? sessionStorage : undefined,
    nowFn = () => Date.now(),
    reloadFn = () => windowObj?.location.reload(),
    pollIntervalMs = DEFAULT_UPDATE_POLL_INTERVAL_MS,
    checkThrottleMs = DEFAULT_CHECK_THROTTLE_MS,
  } = params;

  if (!windowObj || !navigatorObj || !('serviceWorker' in navigatorObj)) {
    return () => {};
  }

  const sw = navigatorObj.serviceWorker;
  let hadController = Boolean(sw.controller);
  let activeRegistration: ServiceWorkerRegistration | undefined;
  let lastUpdateCheckMs = 0;
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let updateSW: ((reloadPage?: boolean) => Promise<void>) | undefined;

  const triggerUpdateCheck = () => {
    if (!activeRegistration || typeof activeRegistration.update !== 'function') return;
    const nowMs = nowFn();
    if (nowMs - lastUpdateCheckMs < checkThrottleMs) return;
    lastUpdateCheckMs = nowMs;
    Promise.resolve(activeRegistration.update()).catch(() => {});
  };

  const applyPendingOrReload = () => {
    const nowMs = nowFn();
    let lastReloadMs: number | null = null;
    try {
      lastReloadMs = parseStoredReloadMs(sessionStorageObj?.getItem(RELOAD_GUARD_KEY));
    } catch {
      lastReloadMs = null;
    }

    if (
      canAutoReload({
        lastReloadMs,
        nowMs,
        hasFocusedFormField: isFormFieldFocused(documentObj),
      })
    ) {
      try {
        sessionStorageObj?.setItem(RELOAD_GUARD_KEY, String(nowMs));
      } catch {
        // Ignored
      }
      reloadFn();
      return;
    }

    dispatchPWAUpdateAvailable(windowObj, {
      applyUpdate: async () => {
        if (updateSW) {
          await updateSW(true);
        }
        await forceRefreshAppCachesAndReload({
          sessionStorageObj,
          reloadFn,
          nowMs: nowFn(),
        });
      },
    });
  };

  const handleControllerChange = () => {
    if (!hadController) {
      hadController = true;
      return;
    }
    applyPendingOrReload();
  };

  const handleVisibilityChange = () => {
    if (documentObj?.visibilityState === 'visible') {
      triggerUpdateCheck();
    }
  };

  const handleFocus = () => {
    triggerUpdateCheck();
  };

  const handleOnline = () => {
    triggerUpdateCheck();
  };

  sw.addEventListener?.('controllerchange', handleControllerChange);
  documentObj?.addEventListener?.('visibilitychange', handleVisibilityChange);
  windowObj.addEventListener?.('focus', handleFocus);
  windowObj.addEventListener?.('online', handleOnline);

  updateSW = registerFn({
    immediate: true,
    onNeedRefresh() {
      dispatchPWAUpdateAvailable(windowObj, {
        applyUpdate: async () => {
          if (updateSW) {
            await updateSW(true);
          }
          await forceRefreshAppCachesAndReload({
            sessionStorageObj,
            reloadFn,
            nowMs: nowFn(),
          });
        },
      });
    },
    onRegisteredSW(_swUrl, registration) {
      activeRegistration = registration;
      if (registration) {
        triggerUpdateCheck();
        if (pollIntervalMs > 0) {
          intervalId = setInterval(triggerUpdateCheck, pollIntervalMs);
        }
      }
    },
  });

  return () => {
    sw.removeEventListener?.('controllerchange', handleControllerChange);
    documentObj?.removeEventListener?.('visibilitychange', handleVisibilityChange);
    windowObj.removeEventListener?.('focus', handleFocus);
    windowObj.removeEventListener?.('online', handleOnline);
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
}
