/**
 * SuenaBA / DeGira - Auth Redirect Helper
 *
 * Evita el problema clásico donde los correos de confirmación de cuenta
 * o restablecimiento de contraseña de Supabase Auth son enviados con "http://localhost:3000".
 *
 * Si el usuario se registra o solicita confirmación desde localhost, loopback,
 * o entorno de desarrollo local, SIEMPRE se redirige a la URL pública de producción
 * en GitHub Pages: https://ariel25181.github.io/DeGira/
 */

export const PROD_AUTH_REDIRECT_URL = 'https://ariel25181.github.io/DeGira/';

export interface LocationLike {
  origin?: string;
  pathname?: string;
  hostname?: string;
}

/**
 * Determina la URL de redirección para Supabase Auth signUp / resetPasswordForEmail.
 * Garantiza que NUNCA se envíe localhost al correo del usuario.
 */
export function resolveAuthRedirectUrl(customLocation?: LocationLike): string {
  // Entorno SSR o sin window
  if (!customLocation && typeof window === 'undefined') {
    return PROD_AUTH_REDIRECT_URL;
  }

  const loc = customLocation || (typeof window !== 'undefined' ? window.location : {});
  const hostname = (loc.hostname || '').toLowerCase();
  const origin = loc.origin || '';
  const pathname = loc.pathname || '/';

  // Si estamos en localhost, 127.0.0.1, 0.0.0.0, o dominio local,
  // NUNCA incluir localhost en el correo enviado al usuario:
  if (
    !hostname ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname.endsWith('.local')
  ) {
    return PROD_AUTH_REDIRECT_URL;
  }

  // Si estamos en producción (GitHub Pages o dominio propio en https://),
  // asegurar formato canónico con barra al final:
  const cleanPath = pathname.endsWith('/') ? pathname : `${pathname}/`;
  return `${origin}${cleanPath}`;
}
