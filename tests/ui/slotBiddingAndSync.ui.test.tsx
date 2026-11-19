import './setup.ts';
import React from 'react';
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { AppProvider, useApp } from '../../src/context/AppContext.tsx';
import { SessionProvider } from '../../src/context/SessionContext.tsx';
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

const TestHarness: React.FC = () => {
  const { setRole, setActiveMusicianId, role, currentMusician } = useApp();
  return (
    <div>
      <div data-testid="active-actor">
        {role}:{currentMusician?.id}
      </div>
      <button
        type="button"
        onClick={() => {
          setRole('musico');
          setActiveMusicianId('mus-1');
        }}
      >
        SwitchToMusico1
      </button>
      <button
        type="button"
        onClick={() => {
          setRole('musico');
          setActiveMusicianId('mus-2');
        }}
      >
        SwitchToMusico2
      </button>
      <button
        type="button"
        onClick={() => {
          setRole('bar');
        }}
      >
        SwitchToBar
      </button>
      <OpenCallsView onViewVenue={() => {}} onViewMusician={() => {}} />
      <AgreementsAndReviewsView
        onOpenReviewModal={() => {}}
        onViewVenue={() => {}}
        onViewMusician={() => {}}
      />
    </div>
  );
};

function seedFourSlotEvent() {
  localStorage.clear();
  localStorage.setItem('suena_ba_v3_role', 'musico');
  localStorage.setItem('suena_ba_v3_activeMusicianId', 'mus-1');
  localStorage.setItem(
    'suena_ba_v3_eventProposals',
    JSON.stringify([
      {
        id: 'ev-4slots-ronda',
        eventCode: 'DG-RONDA-01',
        venueId: 'venue-1',
        venueName: 'El templo de Palermo',
        venueNeighborhood: 'Palermo Hollywood',
        venueAddress: 'Honduras 4800',
        title: 'Ronda de canciones (4 Slots)',
        date: '2026-11-22',
        startTime: '20:00',
        endTime: '00:00',
        totalCapacity: 80,
        remainingCapacity: 80,
        ticketPriceARS: 5000,
        baseCachetARS: 50000,
        musicianPaymentMode: 'cachet_fijo',
        status: 'propuesta',
        rider: {
          stageSize: '6x4 metros',
          soundSystem: 'Consola digital 16 canales',
          lighting: 'Tachos LED RGB',
          dressingRoom: true,
        },
        slots: [
          { id: 'slot-r1', startTime: '20:00', endTime: '21:00', requiredMusicians: 1, status: 'libre' },
          { id: 'slot-r2', startTime: '21:00', endTime: '22:00', requiredMusicians: 1, status: 'libre' },
          { id: 'slot-r3', startTime: '22:00', endTime: '23:00', requiredMusicians: 1, status: 'libre' },
          { id: 'slot-r4', startTime: '23:00', endTime: '00:00', requiredMusicians: 1, status: 'libre' },
        ],
        createdAt: '2026-11-18 20:00',
      },
    ])
  );
  localStorage.setItem('suena_ba_v3_slotBids', JSON.stringify([]));
}

describe('4-Slot Locking, Rejection Reopen & Partial Event Visibility', () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('locks proposed slot for musico1 and musico2, leaves remaining 3 open, reopens on rejection, and stays visible when one slot is accepted', async () => {
    seedFourSlotEvent();

    await act(async () => {
      render(
        <AppProvider>
          <SessionProvider client={mockClient}>
            <TestHarness />
          </SessionProvider>
        </AppProvider>
      );
    });

    // 1. musico1 initially sees all 4 open slots for Ronda de canciones
    screen.getByText('Ronda de canciones (4 Slots)');
    let applyButtons = screen.getAllByRole('button', { name: /Cubrir este Horario/i });
    assert.strictEqual(applyButtons.length, 4);

    // 2. musico1 bids on Slot 1 (20:00 - 21:00)
    await act(async () => {
      fireEvent.click(applyButtons[0]);
    });
    const sendBtn = screen.getByRole('button', { name: /Enviar Propuesta al Bar/i });
    await act(async () => {
      fireEvent.click(sendBtn);
    });
    // Wait for modal auto-close timeout or check immediately after close
    await act(async () => {
      await new Promise((r) => setTimeout(r, 1700));
    });

    // Slot 1 is now locked for musico1; only 3 "Cubrir este Horario" buttons remain
    screen.getByText(/Ya te postulaste • Horario bloqueado mientras se revisa tu propuesta/i);
    applyButtons = screen.getAllByRole('button', { name: /Cubrir este Horario/i });
    assert.strictEqual(applyButtons.length, 3);

    // 3. Switch to musico2: Slot 1 is locked, Slots 2-4 stay open
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'SwitchToMusico2' }));
    });
    screen.getByText(/Horario bloqueado • Propuesta de otro músico en revisión/i);
    applyButtons = screen.getAllByRole('button', { name: /Cubrir este Horario/i });
    assert.strictEqual(applyButtons.length, 3);

    // 4. Switch to Bar and reject musico1's bid -> Slot 1 reopens free for everyone
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'SwitchToBar' }));
    });
    const rejectBtn = screen.getAllByRole('button', { name: /Rechazar/i })[0];
    await act(async () => {
      fireEvent.click(rejectBtn);
    });

    // Switch back to musico1: all 4 slots are open again and Slot 1 can be bid again
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'SwitchToMusico1' }));
    });
    applyButtons = screen.getAllByRole('button', { name: /Cubrir este Horario/i });
    assert.strictEqual(applyButtons.length, 4);

    // 5. musico1 bids Slot 1 again and Bar accepts it -> event moves to para_publicar
    await act(async () => {
      fireEvent.click(applyButtons[0]);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Enviar Propuesta al Bar/i }));
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 1700));
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'SwitchToBar' }));
    });
    const acceptBtn = screen.getAllByRole('button', { name: /Aceptar Propuesta/i })[0];
    await act(async () => {
      fireEvent.click(acceptBtn);
    });
    screen.getByText(/LISTA PARA PUBLICAR/i);

    // 6. Switch to musico2: MUST STILL SEE the event in Convocatorias with 3 available slots!
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'SwitchToMusico2' }));
    });
    screen.getByText('Ronda de canciones (4 Slots)');
    screen.getByText(/Horario reservado/i);
    applyButtons = screen.getAllByRole('button', { name: /Cubrir este Horario/i });
    assert.strictEqual(applyButtons.length, 3);
  });
});
