import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearActiveSession,
  getHideTourPreference,
  saveActiveSession,
  setHideTourPreference,
  shouldShowTourOnOnboarding,
} from '../lib/degiraSession.ts';

function withMockStorage(fn: () => void) {
  const store = new Map<string, string>();
  const orig = (globalThis as any).localStorage;
  (globalThis as any).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => store.set(k, String(v)),
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
  };
  try {
    fn();
  } finally {
    (globalThis as any).localStorage = orig;
  }
}

test('tour "no volver a mostrar" preference persists across sign-out and allows explicit restart', () => {
  withMockStorage(() => {
    assert.equal(getHideTourPreference(), false);
    assert.equal(shouldShowTourOnOnboarding(false), true);

    setHideTourPreference(true);
    assert.equal(getHideTourPreference(), true);
    assert.equal(shouldShowTourOnOnboarding(false), false);

    // Explicit Tour button from menu still opens tour even if hidden on onboarding
    assert.equal(shouldShowTourOnOnboarding(true), true);

    // Signing out clears active session but preserves tour preference
    saveActiveSession({
      role: 'bar',
      userName: 'Bar Test 1',
      userEmail: 'bar1@degira.com.ar',
      remember24h: true,
    });
    clearActiveSession();
    assert.equal(getHideTourPreference(), true);
    assert.equal(shouldShowTourOnOnboarding(false), false);

    setHideTourPreference(false);
    assert.equal(shouldShowTourOnOnboarding(false), true);
  });
});
