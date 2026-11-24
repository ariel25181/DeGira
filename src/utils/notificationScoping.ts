import type { MusicianProfile, PublicUserProfile, UserRole, VenueProfile } from '../types/index.ts';

export interface ActiveProfileIdentity {
  role: UserRole;
  entityId?: string;
  email?: string;
  displayName?: string;
}

export interface ScopedNotificationFields {
  targetRole?: UserRole;
  targetEntityId?: string;
  targetEmail?: string;
}

export interface ScopedEmailFields {
  to: string;
  targetRole?: UserRole;
  targetEntityId?: string;
  senderRole?: UserRole;
  senderEntityId?: string;
  fromEmail?: string;
}

export function resolveVenueEmail(venueId: string | undefined, venues: VenueProfile[] = []): string {
  if (venueId === 'venue-1') return 'bar1@degira.com.ar';
  if (venueId === 'venue-2') return 'bar2@degira.com.ar';
  const found = venues.find((v) => v.id === venueId);
  if (found) {
    const slug = found.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    if (slug) return `${slug}@degira.com.ar`;
  }
  return venueId ? `${venueId}@degira.com.ar` : 'bar1@degira.com.ar';
}

export function resolveMusicianEmail(musicianId: string | undefined): string {
  if (musicianId === 'mus-1') return 'musico1@degira.com.ar';
  if (musicianId === 'mus-2') return 'musico2@degira.com.ar';
  return musicianId ? `${musicianId}@degira.com.ar` : 'musico1@degira.com.ar';
}

export function resolvePublicUserEmail(
  userId: string | undefined,
  publicUsers: PublicUserProfile[] = []
): string {
  const found = publicUsers.find((u) => u.id === userId);
  if (found?.email) return found.email;
  if (userId === 'user-pub-1') return 'publico1@degira.com.ar';
  if (userId === 'user-pub-2') return 'publico2@degira.com.ar';
  return userId ? `${userId}@degira.com.ar` : 'publico1@degira.com.ar';
}

export function resolveActiveProfileIdentity(params: {
  role: UserRole;
  currentVenue?: VenueProfile;
  currentMusician?: MusicianProfile;
  currentPublicUser?: PublicUserProfile;
  venues?: VenueProfile[];
  publicUsers?: PublicUserProfile[];
  sessionEmail?: string;
}): ActiveProfileIdentity {
  const {
    role,
    currentVenue,
    currentMusician,
    currentPublicUser,
    venues = [],
    publicUsers = [],
    sessionEmail,
  } = params;

  if (role === 'bar') {
    return {
      role,
      entityId: currentVenue?.id,
      email: resolveVenueEmail(currentVenue?.id, venues),
      displayName: currentVenue?.name,
    };
  }
  if (role === 'musico') {
    return {
      role,
      entityId: currentMusician?.id,
      email: resolveMusicianEmail(currentMusician?.id),
      displayName: currentMusician?.stageName,
    };
  }
  return {
    role: 'espectador',
    entityId: currentPublicUser?.id,
    email: currentPublicUser?.email || sessionEmail || resolvePublicUserEmail(currentPublicUser?.id, publicUsers),
    displayName: currentPublicUser?.name,
  };
}

export function isNotificationVisibleToProfile(
  notification: ScopedNotificationFields,
  identity: ActiveProfileIdentity
): boolean {
  // Strictly hide untagged legacy notifications so old cross-role items cannot leak
  if (!notification.targetRole && !notification.targetEntityId && !notification.targetEmail) {
    return false;
  }

  if (notification.targetRole && notification.targetRole !== identity.role) {
    return false;
  }

  if (
    notification.targetEntityId &&
    identity.entityId &&
    notification.targetEntityId !== identity.entityId
  ) {
    return false;
  }

  if (
    notification.targetEmail &&
    identity.email &&
    notification.targetEmail.trim().toLowerCase() !== identity.email.trim().toLowerCase()
  ) {
    return false;
  }

  return true;
}

export function isEmailVisibleToProfile(
  email: ScopedEmailFields,
  identity: ActiveProfileIdentity
): boolean {
  const identityEmail = identity.email?.trim().toLowerCase();
  const toNormalized = email.to?.trim().toLowerCase();
  const fromNormalized = email.fromEmail?.trim().toLowerCase();

  const matchesRecipient = Boolean(
    email.targetRole &&
      email.targetRole === identity.role &&
      (!email.targetEntityId || !identity.entityId || email.targetEntityId === identity.entityId)
  );

  const matchesSender = Boolean(
    email.senderRole &&
      email.senderRole === identity.role &&
      (!email.senderEntityId || !identity.entityId || email.senderEntityId === identity.entityId)
  );

  if (matchesRecipient || matchesSender) {
    return true;
  }

  // Fallback exact email match for legacy or direct email records
  if (identityEmail && (toNormalized === identityEmail || fromNormalized === identityEmail)) {
    return true;
  }

  return false;
}
