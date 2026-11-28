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
import { Header } from '../../src/components/Header.tsx';
import { NotificationsDrawer } from '../../src/components/modals/NotificationsDrawer.tsx';
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

  it('allows Bar user to see hint and switch active venue to inspect synced events created in another local (e.g. La Subasta)', async () => {
    localStorage.clear();
    localStorage.setItem('suena_ba_v3_role', 'bar');
    localStorage.setItem('suena_ba_v3_activeVenueId', 'venue-1');
    localStorage.setItem(
      'suena_ba_v3_venues',
      JSON.stringify([
        {
          id: 'venue-1',
          name: 'Bar Test 1',
          type: 'Club de Jazz',
          address: 'Honduras 4800',
          neighborhood: 'Palermo Soho',
          coverPhoto: 'https://example.com/v1.jpg',
          photos: ['https://example.com/v1.jpg'],
          bio: 'Bar principal',
          capacity: 90,
          backline: ['Batería'],
          acousticCharacteristics: 'Acústica',
          hospitality: 'Cena',
          rating: 4.9,
          reviewCount: 5,
          ratingBreakdown: { soundQuality: 5, paymentReliability: 5, hospitality: 5, respect: 5 },
          reviews: [],
        },
        {
          id: 'venue-la-subasta',
          name: 'La Subasta',
          type: 'Cervecería',
          address: 'Av. Rivadavia 5200',
          neighborhood: 'Caballito',
          coverPhoto: 'https://example.com/subasta.jpg',
          photos: ['https://example.com/subasta.jpg'],
          bio: 'Bar sincronizado en Caballito',
          capacity: 80,
          backline: ['Escenario'],
          acousticCharacteristics: 'Buena',
          hospitality: 'Consumición',
          rating: 5,
          reviewCount: 0,
          ratingBreakdown: { soundQuality: 5, paymentReliability: 5, hospitality: 5, respect: 5 },
          reviews: [],
        },
      ])
    );
    localStorage.setItem(
      'suena_ba_v3_eventProposals',
      JSON.stringify([
        {
          id: 'ev-cantautores',
          venueId: 'venue-la-subasta',
          venueName: 'La Subasta',
          venueAddress: 'Av. Rivadavia 5200',
          venueNeighborhood: 'Caballito',
          venuePhoto: 'https://example.com/subasta.jpg',
          title: 'Noche de cantautores',
          date: offsetIsoDate(5),
          startTime: '20:30',
          endTime: '01:00',
          totalCapacity: 80,
          remainingCapacity: 80,
          baseCachetARS: 70000,
          ticketPriceARS: 8000,
          targetGenres: ['Acústico'],
          slots: [
            { id: 'slot-sub-1', startTime: '21:00', endTime: '22:15', requiredMusicians: 2, status: 'libre' },
          ],
          rider: {
            stageSize: '5x3m',
            soundSystem: 'Consola 16ch',
            micCount: 3,
            backline: ['Escenario'],
            lighting: 'LED',
          },
          status: 'propuesta',
          eventCode: 'DG-BAR-2026',
          waitlist: [],
          createdAt: '2026-11-21T15:30:00.000Z',
        },
      ])
    );

    await act(async () => {
      render(
        <AppProvider>
          <SessionProvider client={mockClient}>
            <OpenCallsView onViewVenue={() => {}} onViewMusician={() => {}} />
            <ProfileView />
          </SessionProvider>
        </AppProvider>
      );
    });

    // While activeVenueId is venue-1, Noche de cantautores is hidden behind the active-venue filter,
    // AND the switcher + hint immediately alert the user and let them switch to La Subasta.
    assert.strictEqual(screen.queryByText('Noche de cantautores'), null);
    screen.getByTestId('other-venues-events-hint');

    const switcher = screen.getByTestId('bar-venue-switcher') as HTMLSelectElement;
    assert.strictEqual(switcher.value, 'venue-1');

    await act(async () => {
      fireEvent.change(switcher, { target: { value: 'venue-la-subasta' } });
    });

    screen.getByText('Noche de cantautores');
    const profileSwitcher = screen.getByTestId('profile-venue-switcher') as HTMLSelectElement;
    assert.strictEqual(profileSwitcher.value, 'venue-la-subasta');
  });

  it('Bar slot view hides musician-only "Ya te postulaste", removes Aceptar Propuesta upon acceptance, exposes Wrench icon, and scopes notifications/emails', async () => {
    localStorage.clear();
    localStorage.setItem('suena_ba_v3_role', 'bar');
    localStorage.setItem('suena_ba_v3_activeVenueId', 'venue-1');
    localStorage.setItem(
      'suena_ba_v3_notifications',
      JSON.stringify([
        {
          id: 'n-bar-own',
          title: 'Propuesta para Bar Test 1',
          message: 'Solo visible para Bar Test 1',
          date: 'Hoy',
          read: false,
          type: 'info',
          targetRole: 'bar',
          targetEntityId: 'venue-1',
        },
        {
          id: 'n-mus-other',
          title: 'Propuesta secreta de Músico',
          message: 'No debe verse en Bar Test 1',
          date: 'Hoy',
          read: false,
          type: 'info',
          targetRole: 'musico',
          targetEntityId: 'mus-1',
        },
      ])
    );
    localStorage.setItem(
      'degira:sent_emails:v1',
      JSON.stringify([
        {
          id: 'em-bar',
          to: 'bar1@degira.com.ar',
          subject: 'Correo para Bar Test 1',
          body: 'Contenido Bar',
          sentAt: new Date().toISOString(),
          type: 'negotiation',
          targetRole: 'bar',
          targetEntityId: 'venue-1',
        },
        {
          id: 'em-mus',
          to: 'musico1@degira.com.ar',
          subject: 'Correo privado Músico Test 1',
          body: 'No visible para bar',
          sentAt: new Date().toISOString(),
          type: 'negotiation',
          targetRole: 'musico',
          targetEntityId: 'mus-1',
        },
      ])
    );

    let feedbackClicked = false;

    await act(async () => {
      render(
        <AppProvider>
          <SessionProvider client={mockClient}>
            <Header
              isMobileFrame={false}
              setIsMobileFrame={() => {}}
              onOpenNotifications={() => {}}
              onSelectTab={() => {}}
              onOpenFeedback={() => { feedbackClicked = true; }}
            />
            <OpenCallsView onViewVenue={() => {}} onViewMusician={() => {}} />
            <NotificationsDrawer isOpen={true} onClose={() => {}} />
          </SessionProvider>
        </AppProvider>
      );
    });

    // Wrench icon exists and triggers callback
    const wrenchBtn = screen.getByTestId('header-feedback-btn');
    await act(async () => {
      fireEvent.click(wrenchBtn);
    });
    assert.strictEqual(feedbackClicked, true);

    // Bar never sees musician copy "Ya te postulaste"
    assert.strictEqual(screen.queryByText(/Ya te postulaste/i), null);

    // Scoped notifications: only bar notification shows, musician one is hidden
    screen.getByText('Propuesta para Bar Test 1');
    assert.strictEqual(screen.queryByText('Propuesta secreta de Músico'), null);

    // Scoped emails: switch to Mis Emails tab
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Mis Emails/i }));
    });
    screen.getByText('Correo para Bar Test 1');
    assert.strictEqual(screen.queryByText('Correo privado Músico Test 1'), null);

    // Expand negotiations in OpenCallsView and accept pending bid
    const expandBtn = screen.getByRole('button', { name: /Ver Negociaciones de Músicos/i });
    await act(async () => {
      fireEvent.click(expandBtn);
    });

    const acceptBtn = screen.getByRole('button', { name: /Aceptar Propuesta/i });
    await act(async () => {
      fireEvent.click(acceptBtn);
    });

    // Green Aceptar Propuesta button disappears immediately after confirmation
    assert.strictEqual(screen.queryByRole('button', { name: /Aceptar Propuesta/i }), null);
    assert.ok(screen.getAllByText(/Acordado con: Músico Test 2/i).length >= 1);
  });

  it('shows filter counts, slot time on bid cards, and closes pending bids & clears pending-bar-bids-badge on publish', async () => {
    localStorage.clear();
    localStorage.setItem('suena_ba_v3_role', 'bar');
    localStorage.setItem('suena_ba_v3_activeVenueId', 'venue-1');
    localStorage.setItem(
      'suena_ba_v3_eventProposals',
      JSON.stringify([
        {
          id: 'ev-pub-test',
          venueId: 'venue-1',
          venueName: 'Bar Test 1',
          venueAddress: 'Honduras 4800',
          venueNeighborhood: 'Palermo Soho',
          venuePhoto: '',
          title: 'Ciclo Two-Slot Publish',
          date: offsetIsoDate(15),
          startTime: '21:00',
          endTime: '23:30',
          totalCapacity: 80,
          remainingCapacity: 80,
          baseCachetARS: 60000,
          ticketPriceARS: 5000,
          targetGenres: ['Jazz'],
          slots: [
            {
              id: 'slot-conf',
              startTime: '21:00',
              endTime: '22:00',
              requiredMusicians: 2,
              status: 'confirmado',
              assignedMusicianId: 'mus-1',
              assignedMusicianName: 'Músico Test 1',
              agreedCachetARS: 60000,
            },
            {
              id: 'slot-pend',
              startTime: '22:15',
              endTime: '23:30',
              requiredMusicians: 2,
              status: 'negociando',
            },
          ],
          rider: { stageSize: '5x4', soundSystem: 'Consola', micCount: 4, backline: [], lighting: 'LED' },
          status: 'para_publicar',
          eventCode: 'DG-TEST-22',
          createdAt: '2026-11-22T12:00:00.000Z',
        },
      ])
    );
    localStorage.setItem(
      'suena_ba_v3_slotBids',
      JSON.stringify([
        {
          id: 'bid-conf',
          eventId: 'ev-pub-test',
          slotId: 'slot-conf',
          musicianId: 'mus-1',
          musicianName: 'Músico Test 1',
          musicianAvatar: '',
          proposedCachetARS: 60000,
          musiciansCount: 2,
          equipmentProvided: 'Guitarras',
          equipmentNeeded: 'Micrófonos',
          status: 'aceptada',
          history: [{ id: 'h1', actor: 'musico', actorName: 'Músico Test 1', cachetARS: 60000, note: 'OK', createdAt: '2026-11-22T13:00:00.000Z' }],
          createdAt: '2026-11-22T13:00:00.000Z',
        },
        {
          id: 'bid-pend',
          eventId: 'ev-pub-test',
          slotId: 'slot-pend',
          musicianId: 'mus-2',
          musicianName: 'Músico Test 2',
          musicianAvatar: '',
          proposedCachetARS: 75000,
          musiciansCount: 2,
          equipmentProvided: 'Bajo',
          equipmentNeeded: 'Ampli',
          status: 'pendiente_bar',
          history: [{ id: 'h2', actor: 'musico', actorName: 'Músico Test 2', cachetARS: 75000, note: 'Propuesta slot 2', createdAt: '2026-11-22T14:00:00.000Z' }],
          createdAt: '2026-11-22T14:00:00.000Z',
        },
      ])
    );

    await act(async () => {
      render(
        <AppProvider>
          <SessionProvider client={mockClient}>
            <OpenCallsView onViewVenue={() => {}} onViewMusician={() => {}} />
            <AgreementsAndReviewsView onOpenReviewModal={() => {}} onViewVenue={() => {}} onViewMusician={() => {}} />
          </SessionProvider>
        </AppProvider>
      );
    });

    // Bar filter chips include exact counts
    screen.getByRole('button', { name: /Todas \(1\)/i });
    screen.getByRole('button', { name: /Para Publicar \(1\)/i });
    screen.getByRole('button', { name: /Propuestas \(0\)/i });

    // Confirmed slot explicitly says Bar & Musician agreed
    screen.getByText(/Músico y bar ya acordaron este horario/i);

    // Pending badge shows 1 before publishing
    assert.strictEqual(screen.getByTestId('pending-bar-bids-badge').textContent, '1');

    // Expand negotiations inside OpenCallsView -> verify bid cards include target slot times
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Ver Negociaciones de Músicos \(2\)/i }));
    });
    assert.ok(screen.getAllByText(/Horario 21:00 a 22:00 hs/i).length >= 2);
    assert.ok(screen.getAllByText(/Horario 22:15 a 23:30 hs/i).length >= 2);

    // Publish event manually -> closes leftover pending bid & clears badge + green Aceptar Propuesta button
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Publicar en Cartelera \(Manual\)/i }));
    });

    assert.strictEqual(screen.queryByTestId('pending-bar-bids-badge'), null);
    assert.strictEqual(screen.queryByRole('button', { name: /Aceptar Propuesta/i }), null);
    screen.getByRole('button', { name: /Publicadas \(1\)/i });
  });

  it('supports status filters, last-action timestamps, archived read-only mode, inline 2-click Bar cancellation, and zero QA Lab UI', async () => {
    localStorage.clear();
    localStorage.setItem('suena_ba_v3_role', 'bar');
    localStorage.setItem('suena_ba_v3_activeVenueId', 'venue-1');
    localStorage.setItem(
      'suena_ba_v3_eventProposals',
      JSON.stringify([
        {
          id: 'ev-fut-cancel',
          venueId: 'venue-1',
          venueName: 'Bar Test 1',
          venueAddress: 'Honduras 4800',
          venueNeighborhood: 'Palermo Soho',
          venuePhoto: '',
          title: 'Ciclo Futuro Cancelable',
          date: offsetIsoDate(8),
          startTime: '21:00',
          endTime: '23:30',
          totalCapacity: 80,
          remainingCapacity: 80,
          baseCachetARS: 60000,
          ticketPriceARS: 5000,
          targetGenres: ['Jazz'],
          slots: [
            { id: 'slot-fc-1', startTime: '21:00', endTime: '22:15', requiredMusicians: 2, status: 'negociando' },
          ],
          rider: { stageSize: '5x4', soundSystem: 'Consola', micCount: 4, backline: [], lighting: 'LED' },
          status: 'propuesta',
          eventCode: 'DG-FUT-1',
          createdAt: offsetIsoDate(-2),
        },
        {
          id: 'ev-past-ro',
          venueId: 'venue-1',
          venueName: 'Bar Test 1',
          venueAddress: 'Honduras 4800',
          venueNeighborhood: 'Palermo Soho',
          venuePhoto: '',
          title: 'Ciclo Pasado Archivado',
          date: offsetIsoDate(-10),
          startTime: '21:00',
          endTime: '23:30',
          totalCapacity: 80,
          remainingCapacity: 80,
          baseCachetARS: 60000,
          ticketPriceARS: 5000,
          targetGenres: ['Jazz'],
          slots: [
            { id: 'slot-pa-1', startTime: '21:00', endTime: '22:15', requiredMusicians: 2, status: 'libre' },
          ],
          rider: { stageSize: '5x4', soundSystem: 'Consola', micCount: 4, backline: [], lighting: 'LED' },
          status: 'propuesta',
          eventCode: 'DG-PAST-1',
          createdAt: offsetIsoDate(-15),
        },
      ])
    );
    localStorage.setItem(
      'suena_ba_v3_slotBids',
      JSON.stringify([
        {
          id: 'bid-fut-1',
          eventId: 'ev-fut-cancel',
          slotId: 'slot-fc-1',
          musicianId: 'mus-1',
          musicianName: 'Músico Test 1',
          musicianAvatar: '',
          proposedCachetARS: 65000,
          musiciansCount: 2,
          equipmentProvided: 'Guitarras',
          equipmentNeeded: 'Micrófonos',
          status: 'pendiente_bar',
          history: [
            { id: 'h-f1', actor: 'musico', actorName: 'Músico Test 1', cachetARS: 65000, note: 'Postulación inicial enviada', createdAt: new Date().toISOString() },
          ],
          createdAt: new Date().toISOString(),
        },
      ])
    );

    await act(async () => {
      render(
        <AppProvider>
          <SessionProvider client={mockClient}>
            <Header
              isMobileFrame={false}
              setIsMobileFrame={() => {}}
              onOpenNotifications={() => {}}
              onSelectTab={() => {}}
              onOpenFeedback={() => {}}
            />
            <OpenCallsView onViewVenue={() => {}} onViewMusician={() => {}} />
            <AgreementsAndReviewsView onOpenReviewModal={() => {}} onViewVenue={() => {}} onViewMusician={() => {}} />
          </SessionProvider>
        </AppProvider>
      );
    });

    // Zero QA Lab UI
    assert.strictEqual(screen.queryByText(/QA Lab/i), null);
    assert.strictEqual(screen.queryByTestId('qa-lab-btn'), null);

    // Past event auto-archived & strictly read-only
    screen.getByTestId('event-readonly-banner-ev-past-ro');
    assert.strictEqual(screen.queryByTestId('bar-cancel-event-ev-past-ro'), null);
    assert.ok(screen.getByTestId('event-last-action-ev-fut-cancel'));
    assert.ok(screen.getByTestId('bar-bid-last-action-bid-fut-1'));

    // Bar bid status filters work
    await act(async () => {
      fireEvent.click(screen.getByTestId('bar-bids-filter-acordadas'));
    });
    assert.strictEqual(screen.queryByTestId('bar-bid-last-action-bid-fut-1'), null);
    await act(async () => {
      fireEvent.click(screen.getByTestId('bar-bids-filter-pendientes'));
    });
    screen.getByTestId('bar-bid-last-action-bid-fut-1');

    // Inline 2-click Bar cancellation
    await act(async () => {
      fireEvent.click(screen.getByTestId('bar-cancel-event-ev-fut-cancel'));
    });
    screen.getByTestId('bar-cancel-confirm-panel-ev-fut-cancel');
    await act(async () => {
      fireEvent.click(screen.getByTestId('bar-confirm-cancel-event-ev-fut-cancel'));
    });
    screen.getByTestId('event-readonly-banner-ev-fut-cancel');

    // Verify Bar bids filter moved the bid to archivadas and no Accept button remains
    await act(async () => {
      fireEvent.click(screen.getByTestId('bar-bids-filter-archivadas'));
    });
    screen.getByTestId('bar-bid-last-action-bid-fut-1');
    assert.strictEqual(screen.queryByRole('button', { name: /Aceptar Propuesta/i }), null);
  });
});

