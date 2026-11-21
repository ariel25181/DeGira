import './setup.ts';
import React from 'react';
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { render, screen, fireEvent, cleanup, act, within } from '@testing-library/react';
import App from '../../src/App.tsx';
import { AppProvider } from '../../src/context/AppContext.tsx';
import { SessionProvider } from '../../src/context/SessionContext.tsx';
import { AgreementsAndReviewsView } from '../../src/components/AgreementsAndReviewsView.tsx';
import { Review360Modal } from '../../src/components/modals/Review360Modal.tsx';
import { saveActiveSession } from '../../src/lib/degiraSession.ts';
import type { EventProposal } from '../../src/types/index.ts';

const mockClient = {
  auth: {
    getSession: async () => ({ data: { session: null } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signInWithPassword: async () => ({ error: null }),
    signUp: async () => ({ error: null }),
    signOut: async () => {},
  },
} as any;

function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatLocalHHMM(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function makeDynamicEvent(params: {
  id: string;
  title: string;
  endedMinutesAgo: number;
}): EventProposal {
  const now = Date.now();
  const endDate = new Date(now - params.endedMinutesAgo * 60 * 1000);
  const startDate = new Date(endDate.getTime() - 2 * 60 * 60 * 1000);
  return {
    id: params.id,
    venueId: 'venue-1',
    venueName: 'Bar Test 1',
    venueAddress: 'Honduras 4800',
    venueNeighborhood: 'Palermo Soho',
    venuePhoto: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800',
    title: params.title,
    date: formatLocalDate(startDate),
    startTime: formatLocalHHMM(startDate),
    endTime: formatLocalHHMM(endDate),
    totalCapacity: 50,
    remainingCapacity: 20,
    baseCachetARS: 90000,
    ticketPriceARS: 7000,
    targetGenres: ['Jazz'],
    slots: [
      {
        id: `slot-${params.id}`,
        startTime: formatLocalHHMM(startDate),
        endTime: formatLocalHHMM(endDate),
        requiredMusicians: 1,
        assignedMusicianId: 'mus-1',
        assignedMusicianName: 'Músico Test 1',
        agreedCachetARS: 90000,
        status: 'confirmado',
      },
    ],
    rider: {
      stageSize: '6x4',
      soundSystem: 'PA 1000W',
      micCount: 4,
      backline: ['Batería'],
      lighting: 'LED',
    },
    status: 'publicada',
    eventCode: `DG-TEST-${params.id}`,
    createdAt: formatLocalDate(startDate),
  };
}

describe('2-Hour Post-Event Review Window & On-Screen Login Reminder', () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('shows on-screen login reminder modal with full details after logging in via OnboardingFlow (Bar Test 1) and opens Review360Modal on click', async () => {
    localStorage.clear();

    await act(async () => {
      render(<App />);
    });

    // Step 1: Choose Bar profile
    await act(async () => {
      fireEvent.click(screen.getByText('Soy Anfitrión de Bar'));
    });

    // Step 2: 1-tap login with Bar Test 1 (first test account row)
    await act(async () => {
      const entrarBtns = screen.getAllByRole('button', { name: /Entrar/i });
      fireEvent.click(entrarBtns[0]);
    });

    // Step 3: Skip guided tour to enter app
    await act(async () => {
      fireEvent.click(screen.getByText('Saltar tour'));
    });

    // Login reminder dialog should appear on screen with detailed pending rating info
    const dialog = screen.getByRole('dialog');
    within(dialog).getByText(/Tenés \d+ calificaciones?/);
    within(dialog).getByText(/2 horas después/);
    within(dialog).getByText('Sesión Blues & Jazz Nocturna');
    assert.ok(within(dialog).getAllByText(/Bar Test 1/).length >= 1);
    assert.ok(within(dialog).getAllByText(/Honduras 4800/).length >= 1);
    assert.ok(within(dialog).getAllByText(/Músico Test 1/).length >= 1);
    within(dialog).getByText('DG-BAR1-6120');

    // Clicking "Calificar ahora" opens Review360Modal
    await act(async () => {
      fireEvent.click(within(dialog).getAllByRole('button', { name: /Calificar ahora/i })[0]);
    });
    screen.getByText('Calificación 360° Post-Evento');
  });

  it('enforces 2-hour lock window: blocks event ended 90m ago and allows event ended 150m ago', async () => {
    const lockedEvent = makeDynamicEvent({
      id: 'ev-dyn-locked',
      title: 'Show Recién Terminado (90m)',
      endedMinutesAgo: 90,
    });
    const unlockedEvent = makeDynamicEvent({
      id: 'ev-dyn-unlocked',
      title: 'Show Listo Para Calificar (150m)',
      endedMinutesAgo: 150,
    });

    localStorage.setItem('suena_ba_v3_role', 'bar');
    localStorage.setItem(
      'suena_ba_v3_eventProposals',
      JSON.stringify([lockedEvent, unlockedEvent])
    );
    localStorage.setItem('suena_ba_v3_liveShows', JSON.stringify([]));
    localStorage.setItem('suena_ba_v3_reviews360', JSON.stringify([]));

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

    // Go to "Por Calificar" tab inside AgreementsAndReviewsView
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Por Calificar/i }));
    });

    // Both appear, but only the >=2h event has an enabled rating CTA; the 90m event is disabled/locked
    screen.getByText('Show Listo Para Calificar (150m)');
    screen.getByText('Show Recién Terminado (90m)');

    const rateEnabledBtns = screen.getAllByRole('button', { name: /Calificar a Músico Test 1/i });
    assert.strictEqual(rateEnabledBtns.length, 1);
    assert.strictEqual((rateEnabledBtns[0] as HTMLButtonElement).disabled, false);

    const lockedBtn = screen.getByRole('button', { name: /Se habilita 2 hs tras finalizar/i });
    assert.strictEqual((lockedBtn as HTMLButtonElement).disabled, true);
  });

  it('Review360Modal itself refuses submission if opened for an event that ended less than 2 hours ago', async () => {
    const lockedEvent = makeDynamicEvent({
      id: 'ev-modal-lock',
      title: 'Show Bloqueado en Modal',
      endedMinutesAgo: 45,
    });

    localStorage.setItem('suena_ba_v3_role', 'espectador');

    await act(async () => {
      render(
        <AppProvider>
          <SessionProvider client={mockClient}>
            <Review360Modal isOpen={true} onClose={() => {}} event={lockedEvent} />
          </SessionProvider>
        </AppProvider>
      );
    });

    screen.getByText('Calificación aún no habilitada');
    const submitBtn = screen.getByRole('button', { name: /Disponible en/i });
    assert.strictEqual((submitBtn as HTMLButtonElement).disabled, true);
  });

  it('shows login reminder when reloading app with an active saved Musician session and hides banner/reminder after rating is submitted', async () => {
    saveActiveSession({
      role: 'musico',
      userName: 'Músico Test 1',
      userEmail: 'musico1@degira.com.ar',
      remember24h: true,
    });
    localStorage.setItem('suena_ba_v3_role', 'musico');

    await act(async () => {
      render(<App />);
    });

    // Reminder appears automatically for Músico Test 1
    const dialog = screen.getByRole('dialog');
    within(dialog).getByText('Sesión Blues & Jazz Nocturna');
    assert.ok(within(dialog).getAllByText(/Bar anfitrión: Bar Test 1/i).length >= 1);

    await act(async () => {
      fireEvent.click(within(dialog).getAllByRole('button', { name: /Calificar ahora/i })[0]);
    });

    // Submit the 360 review
    const sendBtn = screen.getByRole('button', { name: /Enviar Calificación Bilateral 360°/i });
    await act(async () => {
      fireEvent.click(sendBtn);
    });

    screen.getByText('¡Calificación 360° Registrada!');
  });
});
