import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PWA_UPDATE_EVENT,
  RELOAD_GUARD_KEY,
  canAutoReload,
  clearOutdatedRuntimeCaches,
  forceRefreshAppCachesAndReload,
  isFormFieldFocused,
  setupServiceWorkerAutoUpdate,
} from './pwaUpdate.ts';

test('canAutoReload allows reload when idle and enforces form focus & cooldown loop guard', () => {
  assert.equal(canAutoReload({ lastReloadMs: null, nowMs: 50_000, hasFocusedFormField: false }), true);
  assert.equal(canAutoReload({ lastReloadMs: null, nowMs: 50_000, hasFocusedFormField: true }), false);
  assert.equal(canAutoReload({ lastReloadMs: 45_000, nowMs: 50_000, hasFocusedFormField: false }), false);
  assert.equal(canAutoReload({ lastReloadMs: 39_000, nowMs: 50_000, hasFocusedFormField: false }), true);
});

test('isFormFieldFocused detects INPUT, TEXTAREA, SELECT, and contentEditable elements cleanly', () => {
  assert.equal(isFormFieldFocused(null), false);
  assert.equal(isFormFieldFocused({ activeElement: { tagName: 'BUTTON' } as Element }), false);
  assert.equal(isFormFieldFocused({ activeElement: { tagName: 'input' } as Element }), true);
  assert.equal(isFormFieldFocused({ activeElement: { tagName: 'TEXTAREA' } as Element }), true);
  assert.equal(isFormFieldFocused({ activeElement: { tagName: 'SELECT' } as Element }), true);
  assert.equal(
    isFormFieldFocused({ activeElement: { tagName: 'DIV', isContentEditable: true } as unknown as Element }),
    true
  );
});

test('setupServiceWorkerAutoUpdate skips initial install reload, reloads on controllerchange when idle, and defers to banner while typing', () => {
  const swListeners: Record<string, Array<() => void>> = {};
  const winListeners: Record<string, Array<() => void>> = {};
  const docListeners: Record<string, Array<() => void>> = {};
  const dispatched: Array<string> = [];
  const storageMap = new Map<string, string>();
  let nowMs = 100_000;
  let reloadCount = 0;
  let updateCallCount = 0;

  const mockDoc = {
    visibilityState: 'visible',
    activeElement: { tagName: 'BODY' },
    addEventListener: (ev: string, fn: () => void) => {
      docListeners[ev] = docListeners[ev] || [];
      docListeners[ev].push(fn);
    },
    removeEventListener: () => {},
  } as unknown as Document;

  const mockWin = {
    location: { reload: () => { reloadCount += 1; } },
    addEventListener: (ev: string, fn: () => void) => {
      winListeners[ev] = winListeners[ev] || [];
      winListeners[ev].push(fn);
    },
    removeEventListener: () => {},
    dispatchEvent: (ev: Event) => {
      dispatched.push(ev.type);
      return true;
    },
  } as unknown as Window;

  const mockNav = {
    serviceWorker: {
      controller: null,
      addEventListener: (ev: string, fn: () => void) => {
        swListeners[ev] = swListeners[ev] || [];
        swListeners[ev].push(fn);
      },
      removeEventListener: () => {},
    },
  } as unknown as Navigator;

  const mockStorage = {
    getItem: (k: string) => storageMap.get(k) ?? null,
    setItem: (k: string, v: string) => storageMap.set(k, v),
  } as unknown as Storage;

  const mockReg = {
    update: async () => {
      updateCallCount += 1;
    },
  } as unknown as ServiceWorkerRegistration;

  const cleanup = setupServiceWorkerAutoUpdate({
    registerFn: (opts) => {
      opts.onRegisteredSW?.('/sw.js', mockReg);
      return async () => {};
    },
    windowObj: mockWin,
    documentObj: mockDoc,
    navigatorObj: mockNav,
    sessionStorageObj: mockStorage,
    nowFn: () => nowMs,
    reloadFn: () => { reloadCount += 1; },
    pollIntervalMs: 0,
    checkThrottleMs: 5_000,
  });

  // Initial registration checked update once
  assert.equal(updateCallCount, 1);

  // First controllerchange after fresh install (hadController was false) should NOT reload
  swListeners.controllerchange.forEach((fn) => fn());
  assert.equal(reloadCount, 0);

  // Subsequent controllerchange while idle triggers immediate reload & sets cooldown guard
  swListeners.controllerchange.forEach((fn) => fn());
  assert.equal(reloadCount, 1);
  assert.equal(storageMap.get(RELOAD_GUARD_KEY), '100000');

  // Controllerchange within cooldown does NOT loop-reload; instead notifies banner
  nowMs = 102_000;
  swListeners.controllerchange.forEach((fn) => fn());
  assert.equal(reloadCount, 1);
  assert.equal(dispatched.includes(PWA_UPDATE_EVENT), true);

  // After cooldown, if user is typing in INPUT, defers to banner instead of interrupting
  nowMs = 120_000;
  (mockDoc as unknown as { activeElement: { tagName: string } }).activeElement = { tagName: 'INPUT' };
  dispatched.length = 0;
  swListeners.controllerchange.forEach((fn) => fn());
  assert.equal(reloadCount, 1);
  assert.deepEqual(dispatched, [PWA_UPDATE_EVENT]);

  // Visibility/focus re-checks respect 5s throttle
  winListeners.focus.forEach((fn) => fn());
  assert.equal(updateCallCount, 2);
  winListeners.online.forEach((fn) => fn());
  assert.equal(updateCallCount, 2); // throttled within 5s
  nowMs = 126_000;
  docListeners.visibilitychange.forEach((fn) => fn());
  assert.equal(updateCallCount, 3);

  cleanup();
});

test('forceRefreshAppCachesAndReload clears caches, wakes waiting worker, updates SW, and reloads', async () => {
  const deletedKeys: string[] = [];
  const postedMessages: unknown[] = [];
  let updated = false;
  let reloaded = false;
  const storageMap = new Map<string, string>();

  const mockCaches = {
    keys: async () => ['workbox-precache-v1', 'degira-runtime-v1'],
    delete: async (k: string) => {
      deletedKeys.push(k);
      return true;
    },
  } as unknown as CacheStorage;

  const mockSW = {
    getRegistrations: async () => [
      {
        waiting: { postMessage: (msg: unknown) => postedMessages.push(msg) },
        update: async () => {
          updated = true;
        },
      },
    ],
  } as unknown as ServiceWorkerContainer;

  const countCleared = await clearOutdatedRuntimeCaches(mockCaches);
  assert.equal(countCleared, 2);
  assert.deepEqual(deletedKeys, ['workbox-precache-v1', 'degira-runtime-v1']);

  await forceRefreshAppCachesAndReload({
    cachesObj: mockCaches,
    serviceWorker: mockSW,
    sessionStorageObj: { setItem: (k, v) => storageMap.set(k, v) },
    reloadFn: () => {
      reloaded = true;
    },
    nowMs: 250_000,
  });

  assert.deepEqual(postedMessages, [{ type: 'SKIP_WAITING' }]);
  assert.equal(updated, true);
  assert.equal(reloaded, true);
  assert.equal(storageMap.get(RELOAD_GUARD_KEY), '250000');
});
