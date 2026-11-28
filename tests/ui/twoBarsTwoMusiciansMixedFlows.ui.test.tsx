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

const TwoBarTwoMusicianHarness: React.FC = () => {
  const {
    role,
    setRole,
    currentVenue,
    currentMusician,
    setActiveVenueId,
    setActiveMusicianId,
    venues,
    musicians,
    eventProposals,
    slotBids,
  } = useApp();

  return (
    <div>
      <div data-testid="actor-banner">
        {role}|{currentVenue?.id}:{currentVenue?.name}|{currentMusician?.id}:{currentMusician?.stageName}
      </div>
      <div data-testid="entity-names">
        {venues.map((v) => v.name).join(',')}::{musicians.map((m) => m.stageName).join(',')}
      </div>
      <div data-testid="events-json">
        {JSON.stringify(
          eventProposals.map((e) => ({
            id: e.id,
            venueId: e.venueId,
            status: e.status,
            slots: e.slots.map((s) => ({
              id: s.id,
              status: s.status,
              assignedMusicianId: s.assignedMusicianId,
              agreedCachetARS: s.agreedCachetARS,
            })),
          }))
        )}
      </div>
      <div data-testid="bids-json">
        {JSON.stringify(
          slotBids.map((b) => ({
            id: b.id,
            eventId: b.eventId,
            slotId: b.slotId,
            musicianId: b.musicianId,
            status: b.status,
            retracted: b.retracted,
            proposedCachetARS: b.proposedCachetARS,
          }))
        )}
      </div>

      <button
        type="button"
        onClick={() => {
          setRole('bar');
          setActiveVenueId('venue-1');
        }}
      >
        ActAsBar1
      </button>
      <button
        type="button"
        onClick={() => {
          setRole('bar');
          setActiveVenueId('venue-2');
        }}
      >
        ActAsBar2
      </button>
      <button
        type="button"
        onClick={() => {
          setRole('musico');
          setActiveMusicianId('mus-1');
        }}
      >
        ActAsMus1
      </button>
      <button
        type="button"
        onClick={() => {
          setRole('musico');
          setActiveMusicianId('mus-2');
        }}
      >
        ActAsMus2
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

function makeTwoBarState(opts?: { futureDate?: string; slot1Start?: string; slot2Start?: string }) {
  const dateStr = opts?.futureDate || '2028-12-20';
  const s1Start = opts?.slot1Start || '20:30';
  const s2Start = opts?.slot2Start || '22:00';

  localStorage.clear();
  localStorage.setItem('suena_ba_v3_role', 'bar');
  localStorage.setItem('suena_ba_v3_activeVenueId', 'venue-1');
  localStorage.setItem('suena_ba_v3_activeMusicianId', 'mus-1');
  localStorage.setItem(
    'suena_ba_v3_eventProposals',
    JSON.stringify([
      {
        id: 'ev-b1',
        eventCode: 'DG-BAR1-1001',
        venueId: 'venue-1',
        venueName: 'Bar Test 1',
        venueNeighborhood: 'Palermo Soho',
        venueAddress: 'Honduras 4800',
        venuePhoto: 'https://example.com/b1.jpg',
        title: 'Ciclo Bar Uno',
        date: dateStr,
        startTime: s1Start,
        endTime: '00:30',
        totalCapacity: 80,
        remainingCapacity: 80,
        ticketPriceARS: 5000,
        baseCachetARS: 60000,
        targetGenres: ['Jazz'],
        status: 'propuesta',
        rider: {
          stageSize: '6x4m',
          soundSystem: '16ch',
          micCount: 4,
          backline: ['Batería'],
          lighting: 'LED',
        },
        slots: [
          { id: 'b1-s1', startTime: s1Start, endTime: '21:30', requiredMusicians: 2, status: 'libre' },
          { id: 'b1-s2', startTime: s2Start, endTime: '23:15', requiredMusicians: 2, status: 'libre' },
        ],
        createdAt: '2026-11-18T10:00:00Z',
      },
      {
        id: 'ev-b2',
        eventCode: 'DG-BAR2-2002',
        venueId: 'venue-2',
        venueName: 'Bar Test 2',
        venueNeighborhood: 'Palermo Hollywood',
        venueAddress: 'Gorriti 5200',
        venuePhoto: 'https://example.com/b2.jpg',
        title: 'Noche Bar Dos',
        date: dateStr,
        startTime: s1Start,
        endTime: '00:00',
        totalCapacity: 90,
        remainingCapacity: 90,
        ticketPriceARS: 6000,
        baseCachetARS: 75000,
        targetGenres: ['Rock'],
        status: 'propuesta',
        rider: {
          stageSize: '7x4m',
          soundSystem: '24ch',
          micCount: 5,
          backline: ['Ampli'],
          lighting: 'Pro',
        },
        slots: [
          { id: 'b2-s1', startTime: s1Start, endTime: '21:45', requiredMusicians: 2, status: 'libre' },
          { id: 'b2-s2', startTime: '23:00', endTime: '00:15', requiredMusicians: 3, status: 'libre' },
        ],
        createdAt: '2026-11-18T11:00:00Z',
      },
    ])
  );
  localStorage.setItem('suena_ba_v3_slotBids', JSON.stringify([]));
  localStorage.setItem('suena_ba_v3_liveShows', JSON.stringify([]));
  localStorage.setItem('suena_ba_v3_openCalls', JSON.stringify([]));
}

async function renderHarness() {
  await act(async () => {
    render(
      <AppProvider>
        <SessionProvider client={mockClient}>
          <TwoBarTwoMusicianHarness />
        </SessionProvider>
      </AppProvider>
    );
  });
}

async function switchActor(label: 'ActAsBar1' | 'ActAsBar2' | 'ActAsMus1' | 'ActAsMus2') {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: label }));
  });
}

describe('2 Bars × 2 Musicians Full Mixed E2E Edge Cases', () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('47. Bar 2 creates new event via modal and Bar 1 & Bar 2 events stay strictly isolated in Convocatorias', async () => {
    makeTwoBarState();
    await renderHarness();

    // Bar 1 sees Ciclo Bar Uno, NOT Noche Bar Dos
    screen.getByText('Ciclo Bar Uno');
    assert.strictEqual(screen.queryAllByText('Noche Bar Dos').length, 0);

    // Switch to Bar 2 -> sees Noche Bar Dos, NOT Ciclo Bar Uno
    await switchActor('ActAsBar2');
    screen.getByText('Noche Bar Dos');
    assert.strictEqual(screen.queryAllByText('Ciclo Bar Uno').length, 0);

    // Bar 2 creates a brand-new event via CreateEventProposalModal
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Proponer Nueva Fecha/i }));
    });
    const titleInput = screen.getByPlaceholderText(/Noche de Jazz & Blues en Palermo/i);
    await act(async () => {
      fireEvent.change(titleInput, { target: { value: 'Festival Independiente Bar2' } });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Crear Propuesta de Evento/i }));
    });
    screen.getByText('Festival Independiente Bar2');

    // Bar 1 MUST NOT see Bar 2's new event
    await switchActor('ActAsBar1');
    assert.strictEqual(screen.queryAllByText('Festival Independiente Bar2').length, 0);

    // Musicians see events from BOTH Bar 1 and Bar 2
    await switchActor('ActAsMus1');
    screen.getByText('Ciclo Bar Uno');
    screen.getByText('Noche Bar Dos');
    screen.getByText('Festival Independiente Bar2');
  });

  it('48. Cross-bar concurrent slot reserving: Mus 1 bids Bar 1 Slot 1 and Mus 2 bids Bar 2 Slot 1 simultaneously', async () => {
    makeTwoBarState({ slot1Start: '20:00', slot2Start: '22:30' });
    await renderHarness();

    await switchActor('ActAsMus1');
    // Bid first slot of Bar 1 (Ciclo Bar Uno b1-s1)
    const bidBtnsM1 = screen.getAllByRole('button', { name: /Cubrir este Horario/i });
    await act(async () => {
      fireEvent.click(bidBtnsM1[0]);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Enviar Propuesta al Bar/i }));
    });
    screen.getByText(/¡Propuesta enviada al bar!/i);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Cerrar modal/i }));
    });

    // Switch to Mus 2: sees Ciclo Bar Uno slot 1 locked by another musician, can bid Noche Bar Dos slot 1!
    await switchActor('ActAsMus2');
    screen.getByText(/Horario bloqueado • Propuesta de otro músico en revisión/i);
    const bidBtnsM2 = screen.getAllByRole('button', { name: /Cubrir este Horario/i });
    assert.strictEqual(bidBtnsM2.length, 3); // b1-s2 + b2-s1 + b2-s2
    await act(async () => {
      fireEvent.click(bidBtnsM2[1]); // b2-s1 (on Bar 2)
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Enviar Propuesta al Bar/i }));
    });
    screen.getByText(/¡Propuesta enviada al bar!/i);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Cerrar modal/i }));
    });

    // Bar 1 sees ONLY Mus 1's bid; Bar 2 sees ONLY Mus 2's bid!
    await switchActor('ActAsBar1');
    assert.ok(screen.getAllByText('Músico Test 1').length >= 1);
    assert.strictEqual(screen.queryAllByText('Músico Test 2').length, 0);

    await switchActor('ActAsBar2');
    assert.ok(screen.getAllByText('Músico Test 2').length >= 1);
    assert.strictEqual(screen.queryAllByText('Músico Test 1').length, 0);
  });

  it('49. Counter-offer ping-pong UI & self-accept guard: Bar 1 cannot accept own contraoferta_bar; Mus 1 counters back and Bar 1 accepts', async () => {
    makeTwoBarState();
    await renderHarness();

    // Mus 1 submits bid on Bar 1 slot 1
    await switchActor('ActAsMus1');
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: /Cubrir este Horario/i })[0]);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Enviar Propuesta al Bar/i }));
    });
    screen.getByText(/¡Propuesta enviada al bar!/i);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Cerrar modal/i }));
    });

    // Bar 1 opens counteroffer inline form in AgreementsAndReviewsView & sends 50,000
    await switchActor('ActAsBar1');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Contraproponer/i }));
    });
    const amountInputBar = document.querySelector('input[type="number"]') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(amountInputBar, { target: { value: '50000' } });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Enviar Contraoferta al Músico/i }));
    });

    // Self-accept guard: Bar 1 MUST NOT see "Aceptar Propuesta" while status is contraoferta_bar
    assert.strictEqual(screen.queryByRole('button', { name: /Aceptar Propuesta/i }), null);
    assert.ok(screen.getAllByText(/Esperando respuesta del músico/i).length >= 1);

    // Mus 1 opens Mis Postulaciones, sees contraoferta_bar, and counters back 55,000
    await switchActor('ActAsMus1');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Mis Postulaciones/i }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Contraproponer$/i }));
    });
    const amountInputMus = document.querySelector('input[type="number"]') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(amountInputMus, { target: { value: '55000' } });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Enviar Contraoferta al Bar/i }));
    });
    screen.getByText(/Contraoferta Enviada/i);

    // Bar 1 now sees Aceptar Propuesta and accepts 55,000!
    await switchActor('ActAsBar1');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Aceptar Propuesta/i }));
    });
    screen.getByText(/Acordado con: Músico Test 1 \(\$ 55\.000\)/i);
  });

  it('50. Musician 2 rejects Bar 2 counteroffer in UI -> slot frees to libre -> Musician 1 bids and wins it', async () => {
    makeTwoBarState();
    localStorage.setItem(
      'suena_ba_v3_slotBids',
      JSON.stringify([
        {
          id: 'bid-b2-co',
          eventId: 'ev-b2',
          slotId: 'b2-s1',
          musicianId: 'mus-2',
          musicianName: 'Músico Test 2',
          musicianAvatar: '',
          proposedCachetARS: 62000,
          musiciansCount: 2,
          equipmentProvided: 'Guitarras',
          equipmentNeeded: 'Mic',
          status: 'contraoferta_bar',
          history: [
            { id: 'h1', actor: 'musico', actorName: 'Músico Test 2', cachetARS: 75000, note: 'Init', createdAt: '2026-11-18T12:00:00Z' },
            { id: 'h2', actor: 'bar', actorName: 'Bar Test 2', cachetARS: 62000, note: 'Counter', createdAt: '2026-11-18T13:00:00Z' },
          ],
          createdAt: '2026-11-18T12:00:00Z',
        },
      ])
    );

    await renderHarness();
    await switchActor('ActAsMus2');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Mis Postulaciones/i }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Rechazar$/i }));
    });

    // Switch to Mus 1 -> Bar 2's b2-s1 is open (4 open slots total across Bar 1 & Bar 2)
    await switchActor('ActAsMus1');
    const bidBtns = screen.getAllByRole('button', { name: /Cubrir este Horario/i });
    assert.strictEqual(bidBtns.length, 4);
    await act(async () => {
      fireEvent.click(bidBtns[2]); // b2-s1
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Enviar Propuesta al Bar/i }));
    });
    screen.getByText(/¡Propuesta enviada al bar!/i);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Cerrar modal/i }));
    });

    await switchActor('ActAsBar2');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Aceptar Propuesta/i }));
    });
    screen.getByText(/Acordado con: Músico Test 1/i);
  });

  it('51. 2-click inline retraction on a BLOCKED (pendiente_bar) bid works without window.confirm and frees slot for Musician 2', async () => {
    makeTwoBarState();
    localStorage.setItem(
      'suena_ba_v3_slotBids',
      JSON.stringify([
        {
          id: 'bid-pending-retract',
          eventId: 'ev-b1',
          slotId: 'b1-s1',
          musicianId: 'mus-1',
          musicianName: 'Músico Test 1',
          musicianAvatar: '',
          proposedCachetARS: 60000,
          musiciansCount: 2,
          equipmentProvided: 'Guitarras',
          equipmentNeeded: 'Mic',
          status: 'pendiente_bar',
          cancelDaysBefore: 1,
          history: [],
          createdAt: '2026-11-18T12:00:00Z',
        },
      ])
    );

    const originalConfirm = window.confirm;
    let confirmCalled = false;
    window.confirm = () => {
      confirmCalled = true;
      return true;
    };

    try {
      await renderHarness();
      await switchActor('ActAsMus1');
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Mis Postulaciones/i }));
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Retractarme/i }));
      });
      screen.getByText(/¿Liberar horario\?/i);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Confirmar Retracción/i }));
      });

      assert.strictEqual(confirmCalled, false);
      screen.getByText(/Te has retractado de la propuesta exitosamente/i);

      // Musician 2 now sees all 4 slots open to bid!
      await switchActor('ActAsMus2');
      assert.strictEqual(screen.getAllByRole('button', { name: /Cubrir este Horario/i }).length, 4);
    } finally {
      window.confirm = originalConfirm;
    }
  });

  it('52. 2-click inline Cancelar aborts retraction and preserves blocked slot', async () => {
    makeTwoBarState();
    localStorage.setItem(
      'suena_ba_v3_slotBids',
      JSON.stringify([
        {
          id: 'bid-abort-retract',
          eventId: 'ev-b1',
          slotId: 'b1-s1',
          musicianId: 'mus-1',
          musicianName: 'Músico Test 1',
          musicianAvatar: '',
          proposedCachetARS: 60000,
          musiciansCount: 2,
          equipmentProvided: 'Guitarras',
          equipmentNeeded: 'Mic',
          status: 'pendiente_bar',
          cancelDaysBefore: 1,
          history: [],
          createdAt: '2026-11-18T12:00:00Z',
        },
      ])
    );

    await renderHarness();
    await switchActor('ActAsMus1');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Mis Postulaciones/i }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Retractarme/i }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Cancelar$/i }));
    });

    // Still locked for Mus 2!
    await switchActor('ActAsMus2');
    screen.getByText(/Horario bloqueado • Propuesta de otro músico en revisión/i);
  });

  it('53. 2-click inline retraction of ACCEPTED bid (>=24h) reverts para_publicar -> propuesta and unlocks slot in UI', async () => {
    makeTwoBarState();
    localStorage.setItem(
      'suena_ba_v3_slotBids',
      JSON.stringify([
        {
          id: 'bid-acc-1',
          eventId: 'ev-b1',
          slotId: 'b1-s1',
          musicianId: 'mus-1',
          musicianName: 'Músico Test 1',
          musicianAvatar: '',
          proposedCachetARS: 60000,
          musiciansCount: 2,
          equipmentProvided: 'Guitarras',
          equipmentNeeded: 'Mic',
          status: 'pendiente_bar',
          cancelDaysBefore: 1,
          history: [],
          createdAt: '2026-11-18T12:00:00Z',
        },
      ])
    );

    await renderHarness();
    // Bar 1 accepts -> para_publicar
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Aceptar Propuesta/i }));
    });
    screen.getByText(/Lista para Publicar/i);
    screen.getByRole('button', { name: /Publicar en Cartelera \(Manual\)/i });

    // Mus 1 retracts the accepted slot
    await switchActor('ActAsMus1');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Mis Postulaciones/i }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Retractarme/i }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Confirmar Retracción/i }));
    });

    // Bar 1 sees event back in Propuesta de Evento without Publish button and slot libre!
    await switchActor('ActAsBar1');
    assert.strictEqual(screen.queryByText(/Lista para Publicar/i), null);
    assert.strictEqual(screen.queryByRole('button', { name: /Publicar en Cartelera \(Manual\)/i }), null);

    // Mus 2 can bid b1-s1 now
    await switchActor('ActAsMus2');
    assert.strictEqual(screen.getAllByRole('button', { name: /Cubrir este Horario/i }).length, 4);
  });

  it('54. Retracting accepted Slot 1 when Mus 2 holds confirmed Slot 2 keeps para_publicar and Slot 2 intact', async () => {
    makeTwoBarState();
    localStorage.setItem(
      'suena_ba_v3_slotBids',
      JSON.stringify([
        {
          id: 'bid-acc-m1',
          eventId: 'ev-b1',
          slotId: 'b1-s1',
          musicianId: 'mus-1',
          musicianName: 'Músico Test 1',
          musicianAvatar: '',
          proposedCachetARS: 60000,
          musiciansCount: 2,
          equipmentProvided: 'Guitarras',
          equipmentNeeded: 'Mic',
          status: 'pendiente_bar',
          cancelDaysBefore: 1,
          history: [],
          createdAt: '2026-11-18T12:00:00Z',
        },
        {
          id: 'bid-acc-m2',
          eventId: 'ev-b1',
          slotId: 'b1-s2',
          musicianId: 'mus-2',
          musicianName: 'Músico Test 2',
          musicianAvatar: '',
          proposedCachetARS: 65000,
          musiciansCount: 2,
          equipmentProvided: 'Bajo',
          equipmentNeeded: 'Ampli',
          status: 'pendiente_bar',
          cancelDaysBefore: 1,
          history: [],
          createdAt: '2026-11-18T12:05:00Z',
        },
      ])
    );

    await renderHarness();
    // Bar 1 accepts both slots
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: /Aceptar Propuesta/i })[0]);
    });
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: /Aceptar Propuesta/i })[0]);
    });

    // Mus 1 retracts Slot 1
    await switchActor('ActAsMus1');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Mis Postulaciones/i }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Retractarme/i }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Confirmar Retracción/i }));
    });

    const evs = JSON.parse(screen.getByTestId('events-json').textContent || '[]');
    const b1 = evs.find((e: any) => e.id === 'ev-b1');
    assert.strictEqual(b1.status, 'para_publicar');
    assert.strictEqual(b1.slots[0].status, 'libre');
    assert.strictEqual(b1.slots[1].status, 'confirmado');
    assert.strictEqual(b1.slots[1].assignedMusicianId, 'mus-2');
  });

  it('55. UI disables retraction when show starts in <24 hours', async () => {
    const soon = new Date(Date.now() + 6 * 60 * 60 * 1000);
    const yyyy = soon.getFullYear();
    const mm = String(soon.getMonth() + 1).padStart(2, '0');
    const dd = String(soon.getDate()).padStart(2, '0');
    const hh = String(soon.getHours()).padStart(2, '0');
    const min = String(soon.getMinutes()).padStart(2, '0');

    makeTwoBarState({ futureDate: `${yyyy}-${mm}-${dd}`, slot1Start: `${hh}:${min}` });
    localStorage.setItem(
      'suena_ba_v3_slotBids',
      JSON.stringify([
        {
          id: 'bid-soon',
          eventId: 'ev-b1',
          slotId: 'b1-s1',
          musicianId: 'mus-1',
          musicianName: 'Músico Test 1',
          musicianAvatar: '',
          proposedCachetARS: 60000,
          musiciansCount: 2,
          equipmentProvided: 'Guitarras',
          equipmentNeeded: 'Mic',
          status: 'aceptada',
          cancelDaysBefore: 1,
          history: [],
          createdAt: '2026-11-18T12:00:00Z',
        },
      ])
    );

    await renderHarness();
    await switchActor('ActAsMus1');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Mis Postulaciones/i }));
    });

    assert.strictEqual(screen.queryByRole('button', { name: /Retractarme/i }), null);
    screen.getByText(/Venció el plazo para cancelar/i);
    screen.getByTestId('musician-urgency-btn-bid-soon');
  });

  it('56. UI shows inline validation error if counteroffer amount is <= 0 instead of closing form', async () => {
    makeTwoBarState();
    localStorage.setItem(
      'suena_ba_v3_slotBids',
      JSON.stringify([
        {
          id: 'bid-bad-co',
          eventId: 'ev-b1',
          slotId: 'b1-s1',
          musicianId: 'mus-1',
          musicianName: 'Músico Test 1',
          musicianAvatar: '',
          proposedCachetARS: 60000,
          musiciansCount: 2,
          equipmentProvided: 'Guitarras',
          equipmentNeeded: 'Mic',
          status: 'pendiente_bar',
          history: [],
          createdAt: '2026-11-18T12:00:00Z',
        },
      ])
    );

    await renderHarness();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Contraproponer/i }));
    });
    const input = document.querySelector('input[type="number"]') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: '0' } });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Enviar Contraoferta al Músico/i }));
    });

    screen.getByText(/El monto de la contraoferta debe ser mayor a \$ 0/i);
    // Counter form remains open
    screen.getByRole('button', { name: /Enviar Contraoferta al Músico/i });
  });

  it('57. MusicianBidModal shows time-clash warning on overlapping Bar 2 slot and allows user override, while non-overlapping slot shows no clash', async () => {
    makeTwoBarState({ slot1Start: '20:30', slot2Start: '22:00' });
    // Mus 1 already holds active bid on Bar 1 slot 1 (20:30-21:30)
    localStorage.setItem(
      'suena_ba_v3_slotBids',
      JSON.stringify([
        {
          id: 'bid-existing-b1',
          eventId: 'ev-b1',
          slotId: 'b1-s1',
          musicianId: 'mus-1',
          musicianName: 'Músico Test 1',
          musicianAvatar: '',
          proposedCachetARS: 60000,
          musiciansCount: 2,
          equipmentProvided: 'Guitarras',
          equipmentNeeded: 'Mic',
          status: 'pendiente_bar',
          history: [],
          createdAt: '2026-11-18T12:00:00Z',
        },
      ])
    );

    await renderHarness();
    await switchActor('ActAsMus1');

    // Remaining open buttons: [0]=b1-s2 (22:00-23:15), [1]=b2-s1 (20:30-21:45 overlaps!), [2]=b2-s2 (23:00-00:15)
    const bidBtns = screen.getAllByRole('button', { name: /Cubrir este Horario/i });
    // First test non-overlapping b2-s2 -> NO clash warning
    await act(async () => {
      fireEvent.click(bidBtns[2]);
    });
    assert.strictEqual(screen.queryByText(/Advertencia de Superposición/i), null);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Cerrar modal/i }));
    });

    // Now test overlapping b2-s1 -> clash warning shown, first submit checks checkbox, second submits!
    await act(async () => {
      fireEvent.click(bidBtns[1]);
    });
    screen.getByText(/Advertencia de Superposición de Horario/i);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Confirmar y Enviar a Pesar del Clash/i }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Enviar Propuesta al Bar/i }));
    });
    screen.getByText(/¡Propuesta enviada al bar!/i);
  });

  it('58. Guards against stale legacy localStorage (Thelonious / Julieta) and preserves Bar Test 1/2 and Músico Test 1/2', async () => {
    localStorage.clear();
    localStorage.setItem('suena_ba_v3_venues', JSON.stringify([{ id: 'venue-1', name: 'Thelonious Jazz Club' }]));
    localStorage.setItem('suena_ba_v3_musicians', JSON.stringify([{ id: 'mus-1', stageName: 'Julieta Díaz Quartet' }]));

    await renderHarness();
    const names = screen.getByTestId('entity-names').textContent || '';
    assert.ok(names.includes('Bar Test 1'));
    assert.ok(names.includes('Bar Test 2'));
    assert.ok(names.includes('Músico Test 1'));
    assert.ok(names.includes('Músico Test 2'));
    assert.strictEqual(names.includes('Thelonious'), false);
    assert.strictEqual(names.includes('Julieta'), false);
  });

  it('59. Musician bid without cancelDaysBefore shows only Admin Urgency (to ariel.najlis@gmail.com) and bid with cancelDaysBefore shows Retractarme', async () => {
    makeTwoBarState();
    localStorage.setItem('suena_ba_v3_slotBids', JSON.stringify([]));
    await renderHarness();
    await switchActor('ActAsMus1');

    // Submit Bid 1 WITHOUT cancelDaysBefore
    const applyBtns = screen.getAllByRole('button', { name: /Cubrir este Horario/i });
    await act(async () => {
      fireEvent.click(applyBtns[0]);
    });
    const daysInput1 = screen.getByTestId('musician-bid-cancel-days-input') as HTMLInputElement;
    assert.strictEqual(daysInput1.value, '');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Enviar Propuesta al Bar/i }));
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 1700));
    });

    // Submit Bid 2 WITH cancelDaysBefore = 5
    const applyBtns2 = screen.getAllByRole('button', { name: /Cubrir este Horario/i });
    await act(async () => {
      fireEvent.click(applyBtns2[0]);
    });
    const daysInput2 = screen.getByTestId('musician-bid-cancel-days-input') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(daysInput2, { target: { value: '5' } });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Enviar Propuesta al Bar/i }));
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 1700));
    });

    const bids = JSON.parse(localStorage.getItem('suena_ba_v3_slotBids') || '[]');
    assert.strictEqual(bids.length, 2);
    const noDaysBid = bids.find((b: any) => b.cancelDaysBefore === undefined);
    const withDaysBid = bids.find((b: any) => b.cancelDaysBefore === 5);
    assert.ok(noDaysBid);
    assert.ok(withDaysBid);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Mis Postulaciones/i }));
    });

    // With days -> Retractarme visible
    screen.getByTestId(`musician-retract-btn-${withDaysBid.id}`);
    // Without days -> Admin Urgency button only, no Retractarme
    assert.strictEqual(screen.queryByTestId(`musician-retract-btn-${noDaysBid.id}`), null);
    await act(async () => {
      fireEvent.click(screen.getByTestId(`musician-urgency-btn-${noDaysBid.id}`));
    });
    await act(async () => {
      fireEvent.change(screen.getByTestId(`musician-urgency-input-${noDaysBid.id}`), {
        target: { value: 'Emergencia médica de baterista' },
      });
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId(`musician-send-urgency-${noDaysBid.id}`));
    });

    const emails = JSON.parse(localStorage.getItem('degira:sent_emails:v1') || '[]');
    assert.ok(
      emails.some(
        (e: any) =>
          e.to === 'ariel.najlis@gmail.com' &&
          e.type === 'admin_urgency' &&
          e.subject.includes('Urgencia') &&
          e.bodyText.includes('Emergencia médica de baterista')
      )
    );
  });
});
