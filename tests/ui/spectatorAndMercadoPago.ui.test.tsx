import './setup.ts';
import React from 'react';
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { AppProvider } from '../../src/context/AppContext.tsx';
import { SessionProvider } from '../../src/context/SessionContext.tsx';
import { ProfileView } from '../../src/components/ProfileView.tsx';
import { ShowDetailModal } from '../../src/components/modals/ShowDetailModal.tsx';
import type { LiveShowConfirmed } from '../../src/types/index.ts';

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
    screen.getByText(/¡Bienvenido a SuenaBA,/);
    screen.getByText('Público General');
    screen.getByText(/Mis Reservas/);
    screen.getByText(/Preferencias/);
    screen.getByText(/Cuentas Test/);

    // Verify existing test reservation
    screen.getByText('Músico Test 1');
    screen.getByText(/Bar Test 1/);
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
});
