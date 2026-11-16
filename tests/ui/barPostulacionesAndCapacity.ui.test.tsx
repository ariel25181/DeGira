import './setup.ts';
import React from 'react';
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { AppProvider } from '../../src/context/AppContext.tsx';
import { SessionProvider } from '../../src/context/SessionContext.tsx';
import { ProfileView } from '../../src/components/ProfileView.tsx';
import { OpenCallsView } from '../../src/components/OpenCallsView.tsx';
import { AgreementsAndReviewsView } from '../../src/components/AgreementsAndReviewsView.tsx';

const mockClient = {
  auth: {
    getSession: async () => ({ data: { session: null } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signInWithPassword: async () => ({ error: null }),
    signUp: async () => ({ error: null }),
    signOut: async () => {},
  },
} as any;

describe('Bar Payment Capacity Reduction & Role-Scoped Postulaciones', () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('reduces event remainingCapacity on Bar payment confirmation and reflects it in Confirmar Pagos, Borderaux, and Mis Eventos', async () => {
    localStorage.clear();
    localStorage.setItem('suena_ba_v3_role', 'bar');
    localStorage.setItem(
      'suena_ba_v3_publicEventReservations',
      JSON.stringify([
        {
          id: 'res-test-bar-cap',
          eventId: 'ev-1',
          eventTitle: 'Noche de Jazz & Soul en Vivo',
          eventCode: 'DG-BAR1-7482',
          venueId: 'venue-1',
          venueName: 'Bar Test 1',
          venueAddress: 'Honduras 4800',
          venueNeighborhood: 'Palermo Soho',
          eventDate: '2026-11-20',
          eventStartTime: '21:00',
          eventEndTime: '01:00',
          userId: 'user-pub-1',
          userName: 'Espectador Prueba',
          userEmail: 'publico@degira.com.ar',
          partySize: 5,
          totalARS: 40000,
          expiresAt: Date.now() + 8 * 60 * 1000,
          status: 'comprobante_subido',
          receiptImage: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
          receiptOcrNotes: 'Comprobante OK DG-BAR1-7482',
          createdAt: '2026-11-05 18:00',
        },
      ])
    );

    await act(async () => {
      render(
        <AppProvider>
          <SessionProvider client={mockClient}>
            <ProfileView />
            <OpenCallsView onViewVenue={() => {}} onViewMusician={() => {}} />
          </SessionProvider>
        </AppProvider>
      );
    });

    // Open Confirmar Pagos tab inside Mi Bar & Sala
    const confirmTabBtn = screen.getByRole('button', { name: /Confirmar Pagos \(1\)/i });
    await act(async () => {
      fireEvent.click(confirmTabBtn);
    });

    // Verify before state: ev-1 starts at remainingCapacity 50 (out of 80 in seedData)
    screen.getByText(/Cupo actual:/i);
    screen.getByText(/Luego de confirmar:/i);

    // Click Confirmar Pago & Enviar Entrada QR
    const approveBtn = screen.getByRole('button', { name: /Confirmar Pago & Enviar Entrada QR/i });
    await act(async () => {
      fireEvent.click(approveBtn);
    });

    // Persistent feedback banner confirms reduction (50 - 5 = 45)
    screen.getByText(/Pago confirmado de Espectador Prueba \(-5 lugares\)/i);
    screen.getByText(/quedan 45 de 80 lugares/i);

    // Mis Eventos (OpenCallsView) also shows updated remainingCapacity / totalCapacity
    assert.ok(screen.getAllByText(/\/ 80 pers\./i).length >= 1);
    assert.ok(screen.getAllByText('45').length >= 1);

    // Borderaux & Balance tab shows Cupo Disponible: 45 / 80 pers.
    const borderauxTab = screen.getByRole('button', { name: /Borderaux & Balance/i });
    await act(async () => {
      fireEvent.click(borderauxTab);
    });
    screen.getByText(/45 \/ 80 pers\./i);
  });

  it('AgreementsAndReviewsView shows only Bar tabs and incoming musician bids when role is bar, hiding musician-only tabs', async () => {
    localStorage.clear();
    localStorage.setItem('suena_ba_v3_role', 'bar');

    await act(async () => {
      render(
        <AppProvider>
          <SessionProvider client={mockClient}>
            <AgreementsAndReviewsView
              onOpenReviewModal={() => {}}
              onViewVenue={() => {}}
              onViewMusician={() => {}}
            />
          </SessionProvider>
        </AppProvider>
      );
    });

    // Bar-only sub-tabs must appear
    screen.getByRole('button', { name: /Postulaciones Recibidas/i });
    screen.getByRole('button', { name: /Confirmadas/i });
    screen.getByRole('button', { name: /Por Calificar/i });

    // Musician-only tab and strings must NOT appear
    assert.strictEqual(screen.queryByRole('button', { name: /Mis Postulaciones/i }), null);
    assert.strictEqual(screen.queryByText(/Seguimiento de las propuestas de fecha que enviaste a bares/i), null);
    assert.strictEqual(screen.queryByText(/Retractarme/i), null);
    assert.strictEqual(screen.queryByText(/Enviar Recordatorio al Bar/i), null);

    // Incoming musician bid (Músico Test 2) & Bar negotiation actions are shown directly
    assert.ok(screen.getAllByText(/Músico Test 2/i).length >= 1);
    screen.getByRole('button', { name: /Aceptar Propuesta/i });
    screen.getByRole('button', { name: /Contraproponer/i });
    assert.ok(screen.getAllByRole('button', { name: /Ver perfil del Músico/i }).length >= 1);

    // Confirmadas tab for Bar uses Ver perfil del Músico instead of Ver info del Bar
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Confirmadas/i }));
    });
    assert.strictEqual(screen.queryByText('Ver info del Bar'), null);
    assert.ok(screen.getAllByRole('button', { name: /Ver perfil del Músico/i }).length >= 1);
  });
});
