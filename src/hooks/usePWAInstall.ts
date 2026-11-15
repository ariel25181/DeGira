import { useCallback, useEffect, useState } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

let cachedDeferredPrompt: BeforeInstallPromptEvent | null = null;
let cachedIsInstalled = false;
let globalListenersAttached = false;
const subscribers = new Set<() => void>();

function notifySubscribers() {
  subscribers.forEach((cb) => cb());
}

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const matchesStandalone =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches;
  const iosStandalone =
    (window.navigator as unknown as { standalone?: boolean })?.standalone === true;
  return Boolean(matchesStandalone || iosStandalone);
}

function ensureGlobalPWAListeners() {
  if (typeof window === 'undefined' || globalListenersAttached) return;
  globalListenersAttached = true;

  cachedIsInstalled = detectStandalone();

  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    cachedDeferredPrompt = e as BeforeInstallPromptEvent;
    notifySubscribers();
  });

  window.addEventListener('appinstalled', () => {
    cachedIsInstalled = true;
    cachedDeferredPrompt = null;
    notifySubscribers();
  });
}

// Attach immediately on module load in browser so early beforeinstallprompt events aren't missed
ensureGlobalPWAListeners();

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    () => cachedDeferredPrompt
  );
  const [isInstalled, setIsInstalled] = useState<boolean>(
    () => cachedIsInstalled || detectStandalone()
  );
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    ensureGlobalPWAListeners();

    const syncState = () => {
      setDeferredPrompt(cachedDeferredPrompt);
      setIsInstalled(cachedIsInstalled || detectStandalone());
    };

    syncState();
    subscribers.add(syncState);

    const userAgent = (window.navigator?.userAgent || '').toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));
    setIsAndroid(/android/.test(userAgent));

    // Also listen on display-mode media query changes if supported
    const mql =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(display-mode: standalone)')
        : null;
    const handleDisplayModeChange = () => {
      cachedIsInstalled = detectStandalone();
      notifySubscribers();
    };
    if (mql && typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', handleDisplayModeChange);
    }

    return () => {
      subscribers.delete(syncState);
      if (mql && typeof mql.removeEventListener === 'function') {
        mql.removeEventListener('change', handleDisplayModeChange);
      }
    };
  }, []);

  const install = useCallback(async () => {
    const promptEvent = cachedDeferredPrompt || deferredPrompt;
    if (!promptEvent) return false;
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === 'accepted') {
      cachedIsInstalled = true;
      cachedDeferredPrompt = null;
      notifySubscribers();
      return true;
    }
    return false;
  }, [deferredPrompt]);

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    isAndroid,
    install,
  };
}

export function __resetPWAInstallStateForTest() {
  cachedDeferredPrompt = null;
  cachedIsInstalled = detectStandalone();
  notifySubscribers();
}
