import { UserRole } from '../types/index.ts';

export interface TestAccount {
  id: string;
  role: UserRole;
  displayName: string;
  email: string;
  password: string;
  acceptedPasswords: string[];
  entityId: string;
  badgeLabel: string;
  subtitle: string;
  neighborhood: string;
  avatarUrl: string;
}

export const TEST_ACCOUNTS: TestAccount[] = [
  // BARES DE PRUEBA
  {
    id: 'account-bar-1',
    role: 'bar',
    displayName: 'Bar Test 1',
    email: 'bar1@degira.com.ar',
    password: 'Bar1Pass#2026',
    acceptedPasswords: ['Bar1Pass#2026', 'degira2026', 'bar123456', 'Bar1#degira2026'],
    entityId: 'venue-1',
    badgeLabel: 'Bar / Club de Jazz',
    subtitle: 'Club de Jazz y Acústico en Palermo Soho',
    neighborhood: 'Palermo Soho',
    avatarUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=200&auto=format&fit=crop&q=80',
  },
  {
    id: 'account-bar-2',
    role: 'bar',
    displayName: 'Bar Test 2',
    email: 'bar2@degira.com.ar',
    password: 'Bar2Pass#2026',
    acceptedPasswords: ['Bar2Pass#2026', 'degira2026', 'bar2123456', 'Bar2#degira2026'],
    entityId: 'venue-2',
    badgeLabel: 'Bar / Escenario en Vivo',
    subtitle: 'Ciclos de Rock, Indie y Cervecería en San Telmo',
    neighborhood: 'San Telmo',
    avatarUrl: 'https://images.unsplash.com/photo-1572116469696-31de0f17cc34?w=200&auto=format&fit=crop&q=80',
  },

  // MÚSICOS DE PRUEBA
  {
    id: 'account-mus-1',
    role: 'musico',
    displayName: 'Músico Test 1',
    email: 'musico1@degira.com.ar',
    password: 'Musico1Pass#2026',
    acceptedPasswords: ['Musico1Pass#2026', 'degira2026', 'musico123456', 'Musico1#degira2026'],
    entityId: 'mus-1',
    badgeLabel: 'Músico / Trío Jazz & Soul',
    subtitle: 'Midnight Sessions • Jazz, Blues & Soul',
    neighborhood: 'Buenos Aires',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
  },
  {
    id: 'account-mus-2',
    role: 'musico',
    displayName: 'Músico Test 2',
    email: 'musico2@degira.com.ar',
    password: 'Musico2Pass#2026',
    acceptedPasswords: ['Musico2Pass#2026', 'degira2026', 'musico2123456', 'Musico2#degira2026'],
    entityId: 'mus-2',
    badgeLabel: 'Músico / Dúo Rock & Indie',
    subtitle: 'Distorsión y Viento • Rock alternativo',
    neighborhood: 'Buenos Aires',
    avatarUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200&auto=format&fit=crop&q=80',
  },

  // PÚBLICO GENERAL DE PRUEBA
  {
    id: 'account-pub-1',
    role: 'espectador',
    displayName: 'Usuario Público 1',
    email: 'publico1@degira.com.ar',
    password: 'Publico1Pass#2026',
    acceptedPasswords: ['Publico1Pass#2026', 'degira2026', 'publico123456', 'Publico1#degira2026'],
    entityId: 'user-pub-1',
    badgeLabel: 'Público General',
    subtitle: 'Espectador habitual de Palermo • Jazz & Soul',
    neighborhood: 'Palermo Soho',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
  },
  {
    id: 'account-pub-2',
    role: 'espectador',
    displayName: 'Usuario Público 2',
    email: 'publico2@degira.com.ar',
    password: 'Publico2Pass#2026',
    acceptedPasswords: ['Publico2Pass#2026', 'degira2026', 'publico2123456', 'Publico2#degira2026'],
    entityId: 'user-pub-2',
    badgeLabel: 'Público General',
    subtitle: 'Fan de Rock e Indie en San Telmo & Colegiales',
    neighborhood: 'San Telmo',
    avatarUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200&auto=format&fit=crop&q=80',
  },
];

export function findTestAccountByEmail(email: string): TestAccount | undefined {
  const normalized = email.trim().toLowerCase();
  return TEST_ACCOUNTS.find((a) => a.email.toLowerCase() === normalized);
}

export function validateTestAccountPassword(account: TestAccount, passwordInput: string): boolean {
  const trimmed = passwordInput.trim();
  if (account.acceptedPasswords.includes(trimmed)) return true;
  if (trimmed === 'degira2026') return true;
  return false;
}
