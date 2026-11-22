import './setup.ts';
import React from 'react';
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { AppProvider, useApp } from '../../src/context/AppContext.tsx';
import { SessionProvider } from '../../src/context/SessionContext.tsx';
import { OpenCallsView } from '../../src/components/OpenCallsView.tsx';
import { AgreementsAndReviewsView } from '../../src/components/AgreementsAndReviewsView.tsx';
import { CreateEventProposalModal } from '../../src/components/modals/CreateEventProposalModal.tsx';

const mockClient = {
  auth: {
    getSession: async () => ({ data: { session: null } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signInWithPassword: async () => ({ error: null }),
    signUp: async () => ({ error: null }),
    signOut: async () => {},
  },
} as any;

const TestHarness: React.FC<{ initialCreateModal?: boolean; onCloseCreateModal?: () => void }> = ({
  initialCreateModal = false,
  onCloseCreateModal,
}) => {
  const { setRole, setActiveMusicianId, role, currentMusician } = useApp();
  const [createOpen, setCreateOpen] = React.useState(initialCreateModal);
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
      <CreateEventProposalModal
        isOpen={createOpen}
        onClose={() => {
          setCreateOpen(false);
          onCloseCreateModal?.();
        }}
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
          { id: 'slot-r1', startTime: '20:00', endTime: '21:00', requiredMusicians: 2, status: 'libre' },
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

  it('preserves musiciansCount selection when switching to counter-proposal, strips leading zero on cachet input, and renders singular 1 músico en escenario', async () => {
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

    const applyButtons = screen.getAllByRole('button', { name: /Cubrir este Horario/i });
    await act(async () => {
      fireEvent.click(applyButtons[0]);
    });

    // Select 1 músico BEFORE switching to counterproposal
    const btn1Musician = screen.getByTestId('musician-count-btn-1');
    await act(async () => {
      fireEvent.click(btn1Musician);
    });
    assert.strictEqual(btn1Musician.getAttribute('aria-pressed'), 'true');

    // Click Contraproponer Monto Fijo
    await act(async () => {
      fireEvent.click(screen.getByTestId('cachet-mode-counter'));
    });

    // 1 músico MUST still be selected after switching to counter-proposal!
    assert.strictEqual(screen.getByTestId('musician-count-btn-1').getAttribute('aria-pressed'), 'true');

    // Clear input completely -> value must become "" (no stuck "0")
    const cachetInput = document.getElementById('musician-bid-counter-input') as HTMLInputElement;
    assert.ok(cachetInput);
    await act(async () => {
      fireEvent.change(cachetInput, { target: { value: '' } });
    });
    assert.strictEqual(cachetInput.value, '');

    // Type '080000' -> leading zero stripped to '80000'
    await act(async () => {
      fireEvent.change(cachetInput, { target: { value: '080000' } });
    });
    assert.strictEqual(cachetInput.value, '80000');

    // Live summary reflects 1 músico & $ 80.000
    const summary = screen.getByTestId('musician-bid-summary');
    assert.match(summary.textContent || '', /1 músico/);
    assert.match(summary.textContent || '', /\$ 80\.000/);

    // Submit and wait auto-close
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Enviar Propuesta al Bar/i }));
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 1700));
    });

    // Verify stored bid kept musiciansCount === 1 and proposedCachetARS === 80000
    const storedBids = JSON.parse(localStorage.getItem('suena_ba_v3_slotBids') || '[]');
    assert.strictEqual(storedBids.length, 1);
    assert.strictEqual(storedBids[0].musiciansCount, 1);
    assert.strictEqual(storedBids[0].proposedCachetARS, 80000);

    // Expand Ver Negociaciones de Músicos -> verify singular "(1 músico en escenario)"
    const negotiationsToggle = screen.getByRole('button', { name: /Ver Negociaciones de Músicos/i });
    await act(async () => {
      fireEvent.click(negotiationsToggle);
    });
    screen.getByText(/\(1 músico en escenario\)/);
  });

  it('supports proposing A la gorra in MusicianBidModal, inline musician counteroffer with A la gorra + musiciansCount update, and Bar creating A la gorra events', async () => {
    seedFourSlotEvent();

    let closeTriggered = false;
    await act(async () => {
      render(
        <AppProvider>
          <SessionProvider client={mockClient}>
            <TestHarness initialCreateModal={true} onCloseCreateModal={() => { closeTriggered = true; }} />
          </SessionProvider>
        </AppProvider>
      );
    });

    // Switch to Bar and create an event with "🎩 A la gorra" mode
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'SwitchToBar' }));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('create-event-cachet-gorra'));
    });
    const titleInput = screen.getByPlaceholderText(/Noche de Jazz/i);
    await act(async () => {
      fireEvent.change(titleInput, { target: { value: 'Peña A La Gorra Test' } });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Crear Propuesta de Evento/i }));
    });
    assert.strictEqual(closeTriggered, true);

    const createdEvents = JSON.parse(localStorage.getItem('suena_ba_v3_eventProposals') || '[]');
    const gorraEv = createdEvents.find((e: any) => e.title === 'Peña A La Gorra Test');
    assert.ok(gorraEv);
    assert.strictEqual(gorraEv.cachetType, 'a_la_gorra');
    assert.strictEqual(gorraEv.baseCachetARS, 0);

    // Switch to Musico1 -> newly created event displays "A la gorra"
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'SwitchToMusico1' }));
    });
    assert.ok(screen.getAllByText(/A la gorra/i).length >= 1);

    // Open MusicianBidModal on the first fixed event (Ronda de canciones) and propose "🎩 Proponer A la Gorra"
    const applyButtons = screen.getAllByRole('button', { name: /Cubrir este Horario/i });
    const targetApply = applyButtons[applyButtons.length - 1];
    await act(async () => {
      fireEvent.click(targetApply);
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('musician-count-btn-2'));
      fireEvent.click(screen.getByTestId('cachet-mode-gorra'));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Enviar Propuesta al Bar/i }));
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 1700));
    });

    const bidsAfterSubmit = JSON.parse(localStorage.getItem('suena_ba_v3_slotBids') || '[]');
    assert.strictEqual(bidsAfterSubmit.length, 1);
    assert.strictEqual(bidsAfterSubmit[0].cachetType, 'a_la_gorra');
    assert.strictEqual(bidsAfterSubmit[0].proposedCachetARS, 0);

    // Bar sends fixed counteroffer -> Musico1 inline counters back switching to A la gorra & 3 musicians
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'SwitchToBar' }));
    });
    // Expand negotiations in Bar's Ronda de canciones card if collapsed, or use Bar's Contraproponer button
    const negBarToggle = screen.queryAllByRole('button', { name: /Ver Negociaciones de Músicos \(1\)/i })[0];
    if (negBarToggle && screen.queryAllByRole('button', { name: /Contraproponer/i }).length === 0) {
      await act(async () => {
        fireEvent.click(negBarToggle);
      });
    }
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: /Contraproponer/i })[0]);
    });
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: /Monto Fijo/i })[0]);
    });
    const barCounterInput = document.querySelector('input[type="number"]') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(barCounterInput, { target: { value: '65000' } });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Enviar Contraoferta/i }));
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'SwitchToMusico1' }));
    });
    const musNegToggles = screen.queryAllByRole('button', { name: /Ver Negociaciones de Músicos \(1\)/i });
    if (musNegToggles.length > 0 && screen.queryAllByRole('button', { name: /Contraproponer/i }).length === 0) {
      await act(async () => {
        fireEvent.click(musNegToggles[0]);
      });
    }
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: /Contraproponer/i })[0]);
    });
    // Switch inline counteroffer to A la gorra and 3 músicos
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: /Proponer A la gorra/i })[0]);
      fireEvent.click(screen.getAllByRole('button', { name: /^3 músicos$/i })[0]);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Enviar Contraoferta/i }));
    });

    const finalBids = JSON.parse(localStorage.getItem('suena_ba_v3_slotBids') || '[]');
    assert.strictEqual(finalBids[0].cachetType, 'a_la_gorra');
    assert.strictEqual(finalBids[0].musiciansCount, 3);
    assert.strictEqual(finalBids[0].status, 'contraoferta_musico');
  });
});

