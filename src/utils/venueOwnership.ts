import type { EventProposal, VenueProfile } from '../types/index.ts';

const LEGACY_MOCK_VENUE_REGEX = /thelonious|caf[eé]\s*berl[ií]n|julieta/i;

export function isLegacyMockVenueName(name?: string): boolean {
  if (!name) return false;
  return LEGACY_MOCK_VENUE_REGEX.test(name);
}

export function normalizeCloudVenue(venue: VenueProfile): VenueProfile {
  if (venue.id === 'venue-1') {
    const isLegacy = isLegacyMockVenueName(venue.name);
    return {
      ...venue,
      ownerBarId: 'venue-1',
      name: isLegacy ? 'Bar Test 1' : venue.name,
      address: isLegacy ? 'Honduras 4800' : venue.address,
      neighborhood: isLegacy ? 'Palermo Soho' : venue.neighborhood,
    };
  }
  if (venue.id === 'venue-2') {
    const isLegacy = isLegacyMockVenueName(venue.name);
    return {
      ...venue,
      ownerBarId: 'venue-2',
      name: isLegacy ? 'Bar Test 2' : venue.name,
      address: isLegacy ? 'Defensa 850' : venue.address,
      neighborhood: isLegacy ? 'San Telmo' : venue.neighborhood,
    };
  }
  return venue;
}

export function normalizeCloudEventProposal(ev: EventProposal): EventProposal {
  if (ev.venueId === 'venue-1' && isLegacyMockVenueName(ev.venueName)) {
    return {
      ...ev,
      venueName: 'Bar Test 1',
      venueAddress: ev.venueAddress || 'Honduras 4800',
      venueNeighborhood: 'Palermo Soho',
    };
  }
  if (ev.venueId === 'venue-2' && isLegacyMockVenueName(ev.venueName)) {
    return {
      ...ev,
      venueName: 'Bar Test 2',
      venueAddress: ev.venueAddress || 'Defensa 850',
      venueNeighborhood: 'San Telmo',
    };
  }
  return ev;
}

export function resolveBarOwnerId(params: {
  activeBarAccountId?: string;
  activeVenueId: string;
  venues: VenueProfile[];
}): string {
  const { activeBarAccountId, activeVenueId, venues } = params;
  if (activeBarAccountId) return activeBarAccountId;
  const active = venues.find((v) => v.id === activeVenueId);
  if (active?.ownerBarId) return active.ownerBarId;
  if (activeVenueId === 'venue-2') return 'venue-2';
  return 'venue-1';
}

export function doesBarOwnVenue(params: {
  venue: Pick<VenueProfile, 'id' | 'ownerBarId'>;
  barOwnerId: string;
}): boolean {
  const { venue, barOwnerId } = params;
  if (venue.id === barOwnerId) return true;
  if (venue.ownerBarId) {
    return venue.ownerBarId === barOwnerId;
  }
  // Legacy custom venues created before ownerBarId was stamped belong only to venue-1 (never venue-2)
  if (venue.id !== 'venue-1' && venue.id !== 'venue-2') {
    return barOwnerId === 'venue-1';
  }
  return false;
}

export function getVenuesOwnedByBar(params: {
  venues: VenueProfile[];
  barOwnerId: string;
}): VenueProfile[] {
  const { venues, barOwnerId } = params;
  return venues.filter((venue) => doesBarOwnVenue({ venue, barOwnerId }));
}
