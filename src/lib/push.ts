import type { createBookingsApi } from './bookingsApi.ts';

type Api = ReturnType<typeof createBookingsApi>;

/** Lo que usamos del navegador (se puede reemplazar en los tests). */
export interface PushEnv {
  vapidKey: string;
  userAgent?: string;
  permission(): 'default' | 'granted' | 'denied' | 'unsupported';
  requestPermission(): Promise<'default' | 'granted' | 'denied'>;
  registration(): Promise<{ pushManager: { getSubscription(): Promise<PushSub | null>; subscribe(o: { userVisibleOnly: boolean; applicationServerKey: Uint8Array }): Promise<PushSub> } } | null>;
}
export interface PushSub { endpoint: string; toJSON(): { endpoint?: string; keys?: { p256dh?: string; auth?: string } }; unsubscribe(): Promise<boolean> }

export function urlBase64ToUint8Array(b64: string): Uint8Array {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function browserPushEnv(): PushEnv {
  const g: any = globalThis;
  const env = (import.meta as any).env ?? {};
  return {
    vapidKey: env.VITE_VAPID_PUBLIC_KEY ?? '',
    userAgent: g.navigator?.userAgent,
    permission: () => (g.Notification && g.navigator?.serviceWorker && 'PushManager' in g ? g.Notification.permission : 'unsupported'),
    requestPermission: () => g.Notification.requestPermission(),
    registration: async () => { try { return (await g.navigator.serviceWorker.ready) ?? null; } catch { return null; } },
  };
}
let current: PushEnv | null = null;
export const getPushEnv = () => (current ??= browserPushEnv());
export const setPushEnv = (e: PushEnv | null) => { current = e; };

export type PushState = 'unsupported' | 'no_key' | 'denied' | 'off' | 'on';

/** Estado de las notificaciones en ESTE dispositivo. */
export async function pushState(env: PushEnv = getPushEnv()): Promise<PushState> {
  if (env.permission() === 'unsupported') return 'unsupported';
  if (!env.vapidKey) return 'no_key';
  if (env.permission() === 'denied') return 'denied';
  const reg = await env.registration();
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  return sub && env.permission() === 'granted' ? 'on' : 'off';
}

export async function enablePush(api: Api, env: PushEnv = getPushEnv()): Promise<PushState> {
  const st = await pushState(env);
  if (st === 'unsupported' || st === 'no_key' || st === 'denied') return st;
  const perm = env.permission() === 'granted' ? 'granted' : await env.requestPermission();
  if (perm !== 'granted') return perm === 'denied' ? 'denied' : 'off';
  const reg = await env.registration();
  if (!reg) return 'unsupported';
  const existing = await reg.pushManager.getSubscription();
  const sub = existing ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(env.vapidKey) });
  const j = sub.toJSON();
  try {
    await api.registerPush({ endpoint: j.endpoint ?? sub.endpoint, p256dh: j.keys?.p256dh ?? '', auth: j.keys?.auth ?? '', userAgent: env.userAgent });
  } catch (e) {
    if (!existing) await sub.unsubscribe().catch(() => {});          // no dejamos una suscripción huérfana que el servidor no conoce
    throw e;
  }
  return 'on';
}

export async function disablePush(api: Api, env: PushEnv = getPushEnv()): Promise<PushState> {
  const reg = await env.registration();
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  if (sub) { const endpoint = sub.endpoint; await api.removePush(endpoint).catch(() => {}); await sub.unsubscribe().catch(() => {}); }
  return pushState(env);
}

/** Registra el Subscription Object directamente en el endpoint backend (/api/push/subscribe) */
export async function registerPushWithBackend(
  subscription: { endpoint: string; keys?: { p256dh?: string; auth?: string } },
  userRole?: string,
  userId?: string
): Promise<{ success: boolean; id?: string }> {
  try {
    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription,
        userRole: userRole || 'espectador',
        userId: userId || 'anon',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      }),
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[Push Backend] Registro opcional local/dev:', err);
    return { success: false };
  }
}

/** Dispara una notificación push a través del backend (/api/push/send) */
export async function sendPushNotification(payload: {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  targetRole?: string;
  userId?: string;
}): Promise<{ success: boolean; sentCount?: number }> {
  try {
    // 1. Enviar al endpoint backend para suscripciones remotas
    const res = await fetch('/api/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({ success: false }));

    // 2. Si el navegador actual tiene permisos concedidos y ServiceWorker activo, mostrar notificación local inmediata
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then((reg) => {
          reg.showNotification(payload.title, {
            body: payload.body,
            icon: '/pwa-192x192.png',
            badge: '/pwa-192x192.png',
            tag: payload.tag || 'degira-alert',
            data: { url: payload.url || '/' },
          });
        });
      } else {
        new Notification(payload.title, {
          body: payload.body,
          icon: '/pwa-192x192.png',
        });
      }
    }

    return { success: true, sentCount: data.sentCount || 1 };
  } catch (err) {
    console.warn('[Push Dispatch] Error enviando push:', err);
    return { success: false };
  }
}

