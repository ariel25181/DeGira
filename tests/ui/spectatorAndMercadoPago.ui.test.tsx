import './setup.ts';
import React from 'react';
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { AppProvider } from '../../src/context/AppContext.tsx';
import { SessionProvider } from '../../src/context/SessionContext.tsx';
import { ProfileView } from '../../src/components/ProfileView.tsx';
import { CatalogView } from '../../src/components/CatalogView.tsx';
import { ShowDetailModal } from '../../src/components/modals/ShowDetailModal.tsx';
import type { LiveShowConfirmed } from '../../src/types/index.ts';
import { offsetIsoDate } from '../../src/utils/bookingLogic.ts';

const mockClient = {
  auth: {
    getSession: async () => ({ data: { session: null } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signInWithPassword: async () => ({ error: null }),
    signUp: async () => ({ error: null }),
    signOut: async () => {},
  },
} as any;

const sampleShow: LiveShowConfirmed = {
  id: 'show-test-mp',
  date: '2026-11-20',
  time: '21:30 hs',
  venueId: 'venue-1',
  venueName: 'Bar Test 1',
  venueAddress: 'Honduras 4800',
  venueNeighborhood: 'Palermo Soho',
  venuePhoto: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800',
  musicianId: 'mus-1',
  musicianName: 'Músico Test 1',
  musicianGenres: ['Jazz'],
  musicianFormat: 'Trío',
  musicianAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
  ticketType: 'consumicion_minima',
  ticketPriceARS: 8000,
  description: 'Noche de jazz en Bar Test 1',
  isCompleted: false,
  venueReviewed: false,
  musicianReviewed: false,
};

describe('Spectator Profile & Mercado Pago Reservation Flow', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders dedicated Spectator Profile with reservations and Mercado Pago status', async () => {
    localStorage.setItem('suena_ba_v3_role', 'espectador');

    await act(async () => {
      render(
        <AppProvider>
          <SessionProvider client={mockClient}>
            <ProfileView />
          </SessionProvider>
        </AppProvider>
      );
    });

    // Check Welcome greeting & spectator profile
    screen.getByText(/¡Bienvenido a DeGira,/);
    screen.getByText('Público General');
    screen.getByText(/Mis Reservas/);
    screen.getByText(/Por Calificar/);
    screen.getByText(/Mis Datos/);

    // Verify existing test reservation
    screen.getByText('Músico Test 1');
    assert.ok(screen.getAllByText(/Bar Test 1/).length >= 1);
    screen.getByText(/Pagado con Mercado Pago/);

    // Verify QR pass toggle
    const qrBtn = screen.getByText('Ver Pase QR');
    await act(async () => {
      fireEvent.click(qrBtn);
    });
    screen.getByAltText('Código QR de la reserva');
  });

  it('ShowDetailModal: selects party size, opens Mercado Pago checkout and confirms payment', async () => {
    let navigatedToProfile = false;

    await act(async () => {
      render(
        <AppProvider>
          <SessionProvider client={mockClient}>
            <ShowDetailModal
              isOpen={true}
              onClose={() => {}}
              show={sampleShow}
              onNavigateToProfile={() => { navigatedToProfile = true; }}
            />
          </SessionProvider>
        </AppProvider>
      );
    });

    // Check title and details
    assert.ok(screen.getAllByText('Músico Test 1').length >= 1);
    screen.getByText(/Consumición Mínima/);

    // Click Proceed to Mercado Pago
    const mpCheckoutBtn = screen.getByRole('button', { name: /Proceder al Pago con Mercado Pago/i });
    await act(async () => {
      fireEvent.click(mpCheckoutBtn);
    });

    // Verify Mercado Pago Checkout Interface
    screen.getByText('mercado pago');
    screen.getByText(/Checkout Transparente Protegido/);
    screen.getByText('Dinero en Cuenta Mercado Pago');

    // Click Pay with Mercado Pago
    const payBtn = screen.getByRole('button', { name: /Pagar.*con Mercado Pago/i });
    await act(async () => {
      fireEvent.click(payBtn);
    });

    // Fast-forward processing timer
    await new Promise((resolve) => setTimeout(resolve, 800));

    // Verify confirmation
    screen.getByText(/¡Reserva y Pago Confirmados con Mercado Pago!/);
    screen.getByText(/Código de Reserva:/);
    screen.getByText(/Comprobante Mercado Pago:/);

    // Click go to my reservations in profile
    const goToProfileBtn = screen.getByRole('button', { name: /Ver en Mis Reservas/i });
    await act(async () => {
      fireEvent.click(goToProfileBtn);
    });
    assert.strictEqual(navigatedToProfile, true);
  });

  it('renders Cerrar sesión button and triggers onSignOut callback', async () => {
    let signedOut = false;
    localStorage.setItem('suena_ba_v3_role', 'espectador');

    await act(async () => {
      render(
        <AppProvider>
          <SessionProvider client={mockClient}>
            <ProfileView onSignOut={() => { signedOut = true; }} />
          </SessionProvider>
        </AppProvider>
      );
    });

    const logoutButtons = screen.getAllByRole('button', { name: /Cerrar sesión/i });
    assert.ok(logoutButtons.length >= 1);

    await act(async () => {
      fireEvent.click(logoutButtons[0]);
    });
    assert.strictEqual(signedOut, true);
  });

  it('CatalogView shows each confirmed musician exact set time on Cartelera card and reservation modal', async () => {
    localStorage.clear();
    localStorage.setItem('suena_ba_v3_role', 'espectador');
    localStorage.setItem(
      'suena_ba_v3_eventProposals',
      JSON.stringify([
        {
          id: 'ev-clappers',
          eventCode: 'DG-BAR2-4317',
          venueId: 'venue-2',
          venueName: 'Bar Test 2',
          venueAddress: 'Defensa 850',
          venueNeighborhood: 'San Telmo',
          venuePhoto: 'https://example.com/bar2.jpg',
          title: 'Clappers Party',
          date: offsetIsoDate(5),
          startTime: '20:30',
          endTime: '01:00',
          totalCapacity: 80,
          remainingCapacity: 80,
          baseCachetARS: 70000,
          targetGenres: ['Rock'],
          rider: { stageSize: '6x4', soundSystem: 'Consola', micCount: 4, backline: [], lighting: 'LED' },
          status: 'publicada',
          slots: [
            {
              id: 'slot-clappers-1',
              startTime: '21:00',
              endTime: '22:15',
              requiredMusicians: 2,
              status: 'confirmado',
              assignedMusicianId: 'mus-2',
              assignedMusicianName: 'Músico Test 2',
              agreedCachetARS: 70000,
            },
            {
              id: 'slot-clappers-2',
              startTime: '22:45',
              endTime: '00:15',
              requiredMusicians: 3,
              status: 'confirmado',
              assignedMusicianId: 'mus-1',
              assignedMusicianName: 'Músico Test 1',
              agreedCachetARS: 70000,
            },
          ],
          createdAt: '2026-11-01',
        },
      ])
    );

    await act(async () => {
      render(
        <SessionProvider client={mockClient}>
          <AppProvider>
            <CatalogView onViewVenue={() => {}} onViewMusician={() => {}} />
          </AppProvider>
        </SessionProvider>
      );
    });

    const lineup = screen.getByTestId('catalog-event-lineup');
    assert.ok(lineup.textContent?.includes('Toca: Músico Test 2'));
    assert.ok(lineup.textContent?.includes('21:00 a 22:15 hs'));
    assert.ok(lineup.textContent?.includes('Toca: Músico Test 1'));
    assert.ok(lineup.textContent?.includes('22:45 a 00:15 hs'));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Reservar Lugar/i }));
    });
    assert.ok(screen.getByText('Músico Test 2 (21:00 a 22:15 hs)'));
    assert.ok(screen.getByText('Músico Test 1 (22:45 a 00:15 hs)'));
  });
});
