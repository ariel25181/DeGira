import { UserRole } from '../types/index.ts';

/**
 * Manejador de Sesión y Expiración a 24 horas para DeGira.
 * Requisito: Siempre pedir perfil primero y luego login, con opción
 * de permanecer conectado con expiración estricta de 24 horas.
 */

export interface StoredSession {
  role: UserRole;
  userName: string;
  userEmail: string;
  remember24h: boolean;
  expiresAt: number | null; // Timestamp ms (24hs exactas)
  loginTimestamp: number;
}

const SESSION_KEY = 'degira:active_session:v2';
const DURATION_24H_MS = 24 * 60 * 60 * 1000;

export function getActiveSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session: StoredSession = JSON.parse(raw);

    // Si no eligió recordar 24hs, la sesión no persiste entre aperturas
    if (!session.remember24h || !session.expiresAt) {
      clearActiveSession();
      return null;
    }

    // Si ya pasaron las 24 horas, expirar sesión
    if (Date.now() > session.expiresAt) {
      clearActiveSession();
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

export function saveActiveSession(params: {
  role: UserRole;
  userName: string;
  userEmail: string;
  remember24h: boolean;
}): StoredSession {
  const now = Date.now();
  const session: StoredSession = {
    role: params.role,
    userName: params.userName,
    userEmail: params.userEmail,
    remember24h: params.remember24h,
    expiresAt: params.remember24h ? now + DURATION_24H_MS : null,
    loginTimestamp: now,
  };

  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    localStorage.setItem('degira:logged_user_name', session.userName);
    localStorage.setItem('degira:user_role', session.role);
    localStorage.setItem('degira:onboarding_completed:v1', 'true');
  } catch {
    // Storage deshabilitado o restringido
  }

  return session;
}

export function clearActiveSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem('degira:logged_user_name');
    localStorage.removeItem('degira:user_role');
    localStorage.removeItem('degira:onboarding_completed:v1');
    // Limpieza de compatibilidad previa
    localStorage.removeItem('suenaba:logged_user_name');
    localStorage.removeItem('suenaba:user_role');
    localStorage.removeItem('suenaba:onboarding_completed:v1');
  } catch {}
}
