import test from 'node:test';
import assert from 'node:assert/strict';
import {
  doesBarOwnVenue,
  getVenuesOwnedByBar,
  normalizeCloudVenue,
  normalizeCloudEventProposal,
  resolveBarOwnerId,
} from './venueOwnership.ts';
import type { EventProposal, VenueProfile } from '../types/index.ts';

function makeVenue(partial: Partial<VenueProfile> & { id: string; name: string }): VenueProfile {
  return {
    type: 'Bar de Copas',
    address: 'Calle 123',
    neighborhood: 'Palermo Soho',
    coverPhoto: '',
    photos: [],
    bio: '',
    capacity: 80,
    backline: [],
    acousticCharacteristics: '',
    hospitality: '',
    rating: 5,
    reviewCount: 0,
    ratingBreakdown: { soundQuality: 5, paymentReliability: 5, hospitality: 5, respect: 5 },
    reviews: [],
    ...partial,
  };
}

test('Bar Test 2 only sees Bar Test 2 and its own newly registered venues, never Bar Test 1 or La Subasta', () => {
  const venues: VenueProfile[] = [
    makeVenue({ id: 'venue-1', ownerBarId: 'venue-1', name: 'Bar Test 1' }),
    makeVenue({ id: 'venue-2', ownerBarId: 'venue-2', name: 'Bar Test 2' }),
    makeVenue({ id: 'venue-legacy-subasta', name: 'La Subasta' }),
    makeVenue({ id: 'venue-b1-extra', ownerBarId: 'venue-1', name: 'Bar ariel' }),
    makeVenue({ id: 'venue-b2-extra', ownerBarId: 'venue-2', name: 'Sala Sur Bar 2' }),
  ];

  const bar2Venues = getVenuesOwnedByBar({ venues, barOwnerId: 'venue-2' });
  assert.deepEqual(
    bar2Venues.map((v) => v.id),
    ['venue-2', 'venue-b2-extra']
  );

  const bar1Venues = getVenuesOwnedByBar({ venues, barOwnerId: 'venue-1' });
  assert.deepEqual(
    bar1Venues.map((v) => v.id),
    ['venue-1', 'venue-legacy-subasta', 'venue-b1-extra']
  );

  assert.equal(doesBarOwnVenue({ venue: venues[0], barOwnerId: 'venue-2' }), false);
  assert.equal(doesBarOwnVenue({ venue: venues[2], barOwnerId: 'venue-2' }), false);
});

test('normalizeCloudVenue prevents legacy Firestore Thelonious Jazz Club from overwriting Bar Test 1', () => {
  const staleCloudVenue1 = makeVenue({
    id: 'venue-1',
    name: 'Thelonious Jazz Club',
    address: 'Nicaragua 5549',
    neighborhood: 'Palermo Hollywood',
  });
  const normalized = normalizeCloudVenue(staleCloudVenue1);
  assert.equal(normalized.name, 'Bar Test 1');
  assert.equal(normalized.neighborhood, 'Palermo Soho');
  assert.equal(normalized.ownerBarId, 'venue-1');

  const customSubasta = normalizeCloudVenue(
    makeVenue({ id: 'venue-custom-1', name: 'La Subasta', neighborhood: 'Colegiales' })
  );
  assert.equal(customSubasta.name, 'La Subasta');
});

test('normalizeCloudEventProposal normalizes legacy Thelonious venueName on venue-1 events', () => {
  const ev: EventProposal = {
    id: 'ev-cloud-1',
    venueId: 'venue-1',
    venueName: 'Thelonious Jazz Club',
    venueAddress: 'Nicaragua 5549',
    venueNeighborhood: 'Palermo Hollywood',
    venuePhoto: '',
    title: 'Noche de cantautores',
    date: '2026-11-29',
    startTime: '21:00',
    endTime: '23:30',
    totalCapacity: 80,
    remainingCapacity: 80,
    baseCachetARS: 60000,
    targetGenres: ['Acústico'],
    slots: [],
    rider: { stageSize: '', soundSystem: '', micCount: 2, backline: [], lighting: '' },
    status: 'propuesta',
    eventCode: 'DG-BAR1-1111',
    waitlist: [],
    createdAt: '2026-11-24',
  };

  const normalized = normalizeCloudEventProposal(ev);
  assert.equal(normalized.venueName, 'Bar Test 1');
  assert.equal(normalized.title, 'Noche de cantautores');
});

test('resolveBarOwnerId preserves owner bar when switching between multiple venues owned by same bar', () => {
  const venues: VenueProfile[] = [
    makeVenue({ id: 'venue-1', ownerBarId: 'venue-1', name: 'Bar Test 1' }),
    makeVenue({ id: 'venue-subasta', ownerBarId: 'venue-1', name: 'La Subasta' }),
    makeVenue({ id: 'venue-2', ownerBarId: 'venue-2', name: 'Bar Test 2' }),
  ];

  assert.equal(
    resolveBarOwnerId({ activeBarAccountId: 'venue-1', activeVenueId: 'venue-subasta', venues }),
    'venue-1'
  );
  assert.equal(
    resolveBarOwnerId({ activeVenueId: 'venue-2', venues }),
    'venue-2'
  );
});
