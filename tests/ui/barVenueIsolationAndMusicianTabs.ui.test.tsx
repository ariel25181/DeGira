import './setup.ts';
import React, { useState } from 'react';
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { AppProvider, useApp } from '../../src/context/AppContext.tsx';
import { SessionProvider } from '../../src/context/SessionContext.tsx';
import { OpenCallsView } from '../../src/components/OpenCallsView.tsx';
import { ProfileView } from '../../src/components/ProfileView.tsx';
import { CreateEventProposalModal } from '../../src/components/modals/CreateEventProposalModal.tsx';
import { TEST_ACCOUNTS } from '../../src/data/testAccounts.ts';

const mockClient = {
  auth: {
    getSession: async () => ({ data: { session: null } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signInWithPassword: async () => ({ error: null }),
    signUp: async () => ({ error: null }),
    signOut: async () => {},
  },
} as any;

const IsolationHarness: React.FC = () => {
  const {
    role,
    currentVenue,
    ownedVenues,
    loginAsAccount,
    addNewVenue,
  } = useApp();
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div>
      <div data-testid="owned-venues-summary">
        {role}|{currentVenue?.id}:{currentVenue?.name}|{ownedVenues.map((v) => v.name).join(',')}
      </div>

      <button
        type="button"
        onClick={() => loginAsAccount(TEST_ACCOUNTS.find((a) => a.id === 'account-bar-1')!)}
      >
        LoginBar1
      </button>
      <button
        type="button"
        onClick={() => loginAsAccount(TEST_ACCOUNTS.find((a) => a.id === 'account-bar-2')!)}
      >
        LoginBar2
      </button>
      <button
        type="button"
        onClick={() => loginAsAccount(TEST_ACCOUNTS.find((a) => a.id === 'account-mus-2')!)}
      >
        LoginMus2
      </button>
      <button
        type="button"
        onClick={() =>
          addNewVenue({
            name: 'Sala Sur',
            address: 'Corrientes 5200',
            neighborhood: 'Villa Crespo',
            coverPhoto: 'https://example.com/sur.jpg',
            photos: ['https://example.com/sur.jpg'],
            capacity: 90,
            type: 'Cervecería',
            bio: 'Nueva sala propia',
            backline: ['Consola'],
            acousticCharacteristics: 'Buena acústica',
            hospitality: 'Camarín',
          })
        }
      >
        RegisterSalaSur
      </button>
      <button type="button" onClick={() => setModalOpen(true)}>
        OpenCreateModal
      </button>

      <OpenCallsView onViewVenue={() => {}} onViewMusician={() => {}} />
      <ProfileView onSelectTab={() => {}} />
      <CreateEventProposalModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
};

describe('Bar venue ownership isolation & Musician Convocatorias tabs (UI)', () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('isolates owned venues strictly per bar account across OpenCallsView, ProfileView, and CreateEventProposalModal', async () => {
    localStorage.clear();
    localStorage.setItem('suena_ba_v3_role', 'bar');
    localStorage.setItem('suena_ba_v3_activeBarAccountId', 'venue-1');
    localStorage.setItem('suena_ba_v3_activeVenueId', 'venue-1');
    localStorage.setItem(
      'suena_ba_v3_venues',
      JSON.stringify([
        {
          id: 'venue-1',
          ownerBarId: 'venue-1',
          name: 'Bar Test 1',
          address: 'Honduras 4800',
          neighborhood: 'Palermo Soho',
          coverPhoto: 'https://example.com/b1.jpg',
          photos: ['https://example.com/b1.jpg'],
          capacity: 85,
          type: 'Club de Jazz',
          bio: 'Bar 1',
          backline: ['Amplis'],
          acousticCharacteristics: 'Cálida',
          hospitality: 'Consumición',
          rating: 4.9,
          reviewCount: 10,
          reviews: [],
          ratingBreakdown: { soundQuality: 5, paymentReliability: 5, hospitality: 5, respect: 5 },
        },
        {
          id: 'venue-2',
          ownerBarId: 'venue-2',
          name: 'Bar Test 2',
          address: 'Defensa 850',
          neighborhood: 'San Telmo',
          coverPhoto: 'https://example.com/b2.jpg',
          photos: ['https://example.com/b2.jpg'],
          capacity: 110,
          type: 'Cervecería',
          bio: 'Bar 2',
          backline: ['Batería'],
          acousticCharacteristics: 'Vivos',
          hospitality: 'Camarín',
          rating: 4.8,
          reviewCount: 8,
          reviews: [],
          ratingBreakdown: { soundQuality: 5, paymentReliability: 5, hospitality: 5, respect: 5 },
        },
        {
          id: 'venue-la-subasta',
          name: 'La Subasta',
          address: 'Rivadavia 4900',
          neighborhood: 'Caballito',
          coverPhoto: 'https://example.com/sub.jpg',
          photos: ['https://example.com/sub.jpg'],
          capacity: 75,
          type: 'Bar Cultural',
          bio: 'Bar cultural propio de Bar 1',
          backline: ['Batería'],
          acousticCharacteristics: 'Controlada',
          hospitality: 'Consumición',
          rating: 4.7,
          reviewCount: 2,
          reviews: [],
          ratingBreakdown: { soundQuality: 5, paymentReliability: 5, hospitality: 5, respect: 5 },
        },
      ])
    );

    render(
      <SessionProvider client={mockClient}>
        <AppProvider>
          <IsolationHarness />
        </AppProvider>
      </SessionProvider>
    );

    // Bar Test 1 sees Bar Test 1 + La Subasta (and never Bar Test 2)
    const switcherBar1 = screen.getByTestId('bar-venue-switcher') as HTMLSelectElement;
    const bar1Options = Array.from(switcherBar1.options).map((o) => o.textContent || '');
    assert.ok(bar1Options.some((t) => t.includes('Bar Test 1')));
    assert.ok(bar1Options.some((t) => t.includes('La Subasta')));
    assert.equal(bar1Options.some((t) => t.includes('Bar Test 2')), false);

    const profileSwitcherBar1 = screen.getByTestId('profile-venue-switcher') as HTMLSelectElement;
    const profBar1Options = Array.from(profileSwitcherBar1.options).map((o) => o.textContent || '');
    assert.ok(profBar1Options.some((t) => t.includes('La Subasta')));
    assert.equal(profBar1Options.some((t) => t.includes('Bar Test 2')), false);

    // Switch account to Bar Test 2
    await act(async () => {
      fireEvent.click(screen.getByText('LoginBar2'));
    });

    assert.equal(
      screen.getByTestId('owned-venues-summary').textContent,
      'bar|venue-2:Bar Test 2|Bar Test 2'
    );
    assert.equal(screen.queryByTestId('bar-venue-switcher'), null);
    assert.equal(screen.queryByTestId('profile-venue-switcher'), null);

    // Even inside CreateEventProposalModal, Bar Test 2 only sees Bar Test 2
    await act(async () => {
      fireEvent.click(screen.getByText('OpenCreateModal'));
    });
    const modalSelect = document.querySelector('form select') as HTMLSelectElement;
    const modalOptions = Array.from(modalSelect.options).map((o) => o.textContent || '');
    assert.equal(modalOptions.length, 1);
    assert.ok(modalOptions[0].includes('Bar Test 2'));
    assert.equal(modalOptions.some((t) => t.includes('La Subasta') || t.includes('Bar Test 1')), false);

    // Register a new venue as Bar Test 2 ("Sala Sur")
    await act(async () => {
      fireEvent.click(screen.getByText('RegisterSalaSur'));
    });

    const switcherBar2 = screen.getByTestId('bar-venue-switcher') as HTMLSelectElement;
    const bar2Options = Array.from(switcherBar2.options).map((o) => o.textContent || '');
    assert.ok(bar2Options.some((t) => t.includes('Bar Test 2')));
    assert.ok(bar2Options.some((t) => t.includes('Sala Sur')));
    assert.equal(bar2Options.some((t) => t.includes('La Subasta') || t.includes('Bar Test 1')), false);

    // Switch back to Bar Test 1: Bar Test 1 still must NOT see Sala Sur or Bar Test 2
    await act(async () => {
      fireEvent.click(screen.getByText('LoginBar1'));
    });
    const switcherBar1After = screen.getByTestId('bar-venue-switcher') as HTMLSelectElement;
    const bar1AfterOptions = Array.from(switcherBar1After.options).map((o) => o.textContent || '');
    assert.ok(bar1AfterOptions.some((t) => t.includes('Bar Test 1')));
    assert.ok(bar1AfterOptions.some((t) => t.includes('La Subasta')));
    assert.equal(bar1AfterOptions.some((t) => t.includes('Sala Sur') || t.includes('Bar Test 2')), false);
  });

  it('shows published/completed events under Publicadas / Completas tab for Musico Test 2 and preserves custom events even with legacy venue name', async () => {
    localStorage.clear();
    localStorage.setItem('suena_ba_v3_role', 'musico');
    localStorage.setItem('suena_ba_v3_activeMusicianId', 'mus-2');
    localStorage.setItem(
      'suena_ba_v3_eventProposals',
      JSON.stringify([
        {
          id: 'ev-open',
          eventCode: 'DG-ARIEL-01',
          venueId: 'venue-1',
          venueName: 'Thelonious Jazz Club',
          venueNeighborhood: 'Palermo Soho',
          venueAddress: 'Honduras 4800',
          venuePhoto: 'https://example.com/a.jpg',
          title: 'NOCHE DE ARIEL',
          date: '2028-11-28',
          startTime: '20:30',
          endTime: '00:00',
          totalCapacity: 80,
          remainingCapacity: 80,
          baseCachetARS: 70000,
          ticketPriceARS: 8000,
          targetGenres: ['Jazz'],
          rider: { stageSize: '5x4m', soundSystem: 'Consola', micCount: 4, backline: [], lighting: 'LED' },
          status: 'propuesta',
          slots: [
            { id: 'slot-open-1', startTime: '21:00', endTime: '22:15', requiredMusicians: 2, status: 'libre' },
          ],
          createdAt: '2026-11-01',
        },
        {
          id: 'ev-cantautores',
          eventCode: 'DG-CANT-02',
          venueId: 'venue-la-subasta',
          venueName: 'La Subasta',
          venueNeighborhood: 'Caballito',
          venueAddress: 'Rivadavia 4900',
          venuePhoto: 'https://example.com/c.jpg',
          title: 'Noche de Cantautores',
          date: '2028-11-29',
          startTime: '21:00',
          endTime: '23:30',
          totalCapacity: 75,
          remainingCapacity: 60,
          baseCachetARS: 65000,
          ticketPriceARS: 7500,
          targetGenres: ['Acústico'],
          rider: { stageSize: '4x3m', soundSystem: 'Consola', micCount: 2, backline: [], lighting: 'Cálida' },
          status: 'publicada',
          slots: [
            {
              id: 'slot-cant-1',
              startTime: '21:30',
              endTime: '23:00',
              requiredMusicians: 1,
              status: 'acordado',
              assignedMusicianId: 'mus-1',
              assignedMusicianName: 'Músico Test 1',
              agreedCachetARS: 65000,
            },
          ],
          createdAt: '2026-11-01',
        },
      ])
    );

    render(
      <SessionProvider client={mockClient}>
        <AppProvider>
          <IsolationHarness />
        </AppProvider>
      </SessionProvider>
    );

    const openTab = screen.getByTestId('musician-calls-open-tab');
    const closedTab = screen.getByTestId('musician-calls-closed-tab');
    assert.ok(openTab.textContent?.includes('Abiertas (1)'));
    assert.ok(closedTab.textContent?.includes('Publicadas / Completas (1)'));

    // Open tab renders NOCHE DE ARIEL (and normalizes legacy Thelonious name to Bar Test 1)
    assert.ok(screen.getByText('NOCHE DE ARIEL'));
    assert.ok(screen.getAllByText(/Bar Test 1/).length >= 1);
    assert.equal(screen.queryByText(/Thelonious/i), null);
    assert.equal(screen.queryByText('Noche de Cantautores'), null);

    // Closed tab reveals Noche de Cantautores cleanly read-only
    await act(async () => {
      fireEvent.click(closedTab);
    });

    assert.ok(screen.getByText('Noche de Cantautores'));
    assert.equal(screen.queryByText('NOCHE DE ARIEL'), null);
    assert.equal(screen.queryByText(/Postularme/i), null);
  });
});
