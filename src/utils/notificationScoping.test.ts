import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveVenueEmail,
  resolveMusicianEmail,
  resolvePublicUserEmail,
  resolveActiveProfileIdentity,
  isNotificationVisibleToProfile,
  isEmailVisibleToProfile,
} from './notificationScoping.ts';
import type { VenueProfile, MusicianProfile, PublicUserProfile } from '../types/index.ts';

const customVenue: VenueProfile = {
  id: 'venue-1760000',
  name: 'La Subasta',
  type: 'Espacio Cultural',
  address: 'Av. Rivadavia 4500',
  neighborhood: 'Almagro',
  coverPhoto: '',
  photos: [],
  bio: 'Sala de música',
  capacity: 80,
  backline: [],
  acousticCharacteristics: '',
  hospitality: '',
  rating: 5,
  reviewCount: 0,
  reviews: [],
  ratingBreakdown: { soundQuality: 5, paymentReliability: 5, hospitality: 5, respect: 5 },
};

const bar1Venue: VenueProfile = {
  ...customVenue,
  id: 'venue-1',
  name: 'Bar Test 1',
};

const mus1: MusicianProfile = {
  id: 'mus-1',
  stageName: 'Músico Test 1',
  genres: ['Jazz'],
  format: 'Dúo',
  bio: '',
  avatarUrl: '',
  photos: [],
  membersCount: 2,
  instagramHandle: '@mus1',
  minCachetDefault: 60000,
  technicalRider: 'Básico',
  rating: 5,
  reviewCount: 0,
  reviews: [],
  ratingBreakdown: { punctuality: 5, liveSound: 5, crowdDrawing: 5, professionalism: 5 },
};

const pub1: PublicUserProfile = {
  id: 'user-pub-1',
  name: 'Usuario Público 1',
  email: 'publico1@degira.com.ar',
  avatarUrl: '',
  favoriteGenres: ['Jazz'],
  preferredNeighborhoods: ['Palermo Soho'],
  createdAt: '2026-11-22T18:00:00.000Z',
};

test('resolves venue, musician, and public emails deterministically including custom venues', () => {
  assert.equal(resolveVenueEmail('venue-1', [bar1Venue]), 'bar1@degira.com.ar');
  assert.equal(resolveVenueEmail('venue-2', [bar1Venue]), 'bar2@degira.com.ar');
  assert.equal(resolveVenueEmail(customVenue.id, [customVenue]), 'la-subasta@degira.com.ar');
  assert.equal(resolveMusicianEmail('mus-1'), 'musico1@degira.com.ar');
  assert.equal(resolveMusicianEmail('mus-2'), 'musico2@degira.com.ar');
  assert.equal(resolvePublicUserEmail('user-pub-1', [pub1]), 'publico1@degira.com.ar');
});

test('isNotificationVisibleToProfile isolates roles, entities, emails, and hides untagged legacy alerts', () => {
  const bar1Identity = resolveActiveProfileIdentity({
    role: 'bar',
    currentVenue: bar1Venue,
    venues: [bar1Venue, customVenue],
  });
  const mus1Identity = resolveActiveProfileIdentity({
    role: 'musico',
    currentMusician: mus1,
  });
  const pub1Identity = resolveActiveProfileIdentity({
    role: 'espectador',
    currentPublicUser: pub1,
    publicUsers: [pub1],
  });

  // Untagged legacy notification must stay hidden
  assert.equal(isNotificationVisibleToProfile({}, bar1Identity), false);

  // Bar-1 targeted notification visible ONLY to Bar-1, NOT Bar-2, NOT Musician, NOT Public
  const notifBar1 = { targetRole: 'bar' as const, targetEntityId: 'venue-1' };
  assert.equal(isNotificationVisibleToProfile(notifBar1, bar1Identity), true);
  assert.equal(
    isNotificationVisibleToProfile(notifBar1, { role: 'bar', entityId: 'venue-2', email: 'bar2@degira.com.ar' }),
    false
  );
  assert.equal(isNotificationVisibleToProfile(notifBar1, mus1Identity), false);
  assert.equal(isNotificationVisibleToProfile(notifBar1, pub1Identity), false);

  // Musician-1 targeted notification visible ONLY to Musician-1
  const notifMus1 = { targetRole: 'musico' as const, targetEntityId: 'mus-1' };
  assert.equal(isNotificationVisibleToProfile(notifMus1, mus1Identity), true);
  assert.equal(
    isNotificationVisibleToProfile(notifMus1, { role: 'musico', entityId: 'mus-2', email: 'musico2@degira.com.ar' }),
    false
  );
  assert.equal(isNotificationVisibleToProfile(notifMus1, bar1Identity), false);

  // Email-scoped notification checks email strictly
  const notifByEmail = { targetRole: 'espectador' as const, targetEmail: 'otro@degira.com.ar' };
  assert.equal(isNotificationVisibleToProfile(notifByEmail, pub1Identity), false);
});

test('isEmailVisibleToProfile shows only emails sent by or addressed to the logged-in profile', () => {
  const bar1Identity = resolveActiveProfileIdentity({ role: 'bar', currentVenue: bar1Venue });
  const bar2Identity = { role: 'bar' as const, entityId: 'venue-2', email: 'bar2@degira.com.ar' };
  const mus1Identity = resolveActiveProfileIdentity({ role: 'musico', currentMusician: mus1 });
  const mus2Identity = { role: 'musico' as const, entityId: 'mus-2', email: 'musico2@degira.com.ar' };
  const pub1Identity = resolveActiveProfileIdentity({ role: 'espectador', currentPublicUser: pub1 });

  // Musician 1 -> Bar 1 proposal email
  const bidEmail = {
    to: 'bar1@degira.com.ar',
    targetRole: 'bar' as const,
    targetEntityId: 'venue-1',
    senderRole: 'musico' as const,
    senderEntityId: 'mus-1',
    fromEmail: 'musico1@degira.com.ar',
  };
  assert.equal(isEmailVisibleToProfile(bidEmail, bar1Identity), true);
  assert.equal(isEmailVisibleToProfile(bidEmail, mus1Identity), true);
  assert.equal(isEmailVisibleToProfile(bidEmail, bar2Identity), false);
  assert.equal(isEmailVisibleToProfile(bidEmail, mus2Identity), false);
  assert.equal(isEmailVisibleToProfile(bidEmail, pub1Identity), false);

  // QR Ticket sent from Bar 2 to Público 1
  const qrEmail = {
    to: 'publico1@degira.com.ar',
    targetRole: 'espectador' as const,
    targetEntityId: 'user-pub-1',
    senderRole: 'bar' as const,
    senderEntityId: 'venue-2',
    fromEmail: 'bar2@degira.com.ar',
  };
  assert.equal(isEmailVisibleToProfile(qrEmail, pub1Identity), true);
  assert.equal(isEmailVisibleToProfile(qrEmail, bar2Identity), true);
  assert.equal(isEmailVisibleToProfile(qrEmail, bar1Identity), false);
  assert.equal(isEmailVisibleToProfile(qrEmail, mus1Identity), false);
});
