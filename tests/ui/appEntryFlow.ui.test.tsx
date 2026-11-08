import './setup.ts';
import React, { useState } from 'react';
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { render, screen, fireEvent, within, cleanup, act } from '@testing-library/react';
import { OnboardingFlow } from '../../src/components/flow/OnboardingFlow.tsx';
import { ActivityToolbar, RoleIconMenuModal, ROLE_ACTIVITIES } from '../../src/components/flow/RoleActivityNav.tsx';
import { SessionProvider } from '../../src/context/SessionContext.tsx';
import type { UserRole } from '../../src/types/index.ts';

// Mock minimal Supabase client for testing
const mockClient = {
  auth: {
    getSession: async () => ({ data: { session: null } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signInWithPassword: async () => ({ error: null }),
    signUp: async () => ({ error: null, data: { session: { user: { id: 'test-user' } } } }),
    signOut: async () => {},
  },
} as any;

describe('OnboardingFlow Step-by-Step Flow', () => {
  afterEach(() => {
    cleanup();
  });
  it('Paso 1: Asks profile first with Anfitrión, Músico, and Público options', async () => {
    let completedRole: UserRole | null = null;
    await act(async () => {
      render(
        <SessionProvider client={mockClient}>
          <OnboardingFlow onComplete={(r) => { completedRole = r; }} />
        </SessionProvider>
      );
    });

    // Verify Title
    screen.getByText('¿Cómo vas a ingresar a DeGira?');

    // Verify 3 options
    screen.getByText('Soy Anfitrión de Bar');
    screen.getByText('Soy Músico o Banda');
    screen.getByText('Soy Público General');
  });

  it('Paso 2: Selecting profile prompts for login/signup account creation', async () => {
    await act(async () => {
      render(
        <SessionProvider client={mockClient}>
          <OnboardingFlow onComplete={() => {}} />
        </SessionProvider>
      );
    });

    // Click "Soy Anfitrión de Bar"
    await act(async () => {
      fireEvent.click(screen.getByText('Soy Anfitrión de Bar'));
    });

    // Should now be on Auth screen
    screen.getByText('Iniciar Sesión en DeGira');
    screen.getByText('Anfitrión de Bar');
    screen.getByText('Ya tengo cuenta');
    screen.getByText('Crear nueva cuenta');

    // Test toggle to Signup
    await act(async () => {
      fireEvent.click(screen.getByText('Crear nueva cuenta'));
    });
    screen.getByText('Crear tu Cuenta en DeGira');
    screen.getByText('Nombre del Bar o Sala');

    // Test back button returns to Role Selection
    await act(async () => {
      fireEvent.click(screen.getByText('Cambiar perfil'));
    });
    screen.getByText('¿Cómo vas a ingresar a DeGira?');
  });

  it('Paso 3: Completing auth advances to role-tailored Guided Tour', async () => {
    let completedRole: UserRole | null = null;
    await act(async () => {
      render(
        <SessionProvider client={mockClient}>
          <OnboardingFlow onComplete={(r) => { completedRole = r; }} />
        </SessionProvider>
      );
    });

    // Select Músico
    await act(async () => {
      fireEvent.click(screen.getByText('Soy Músico o Banda'));
    });

    // Use fast demo access to proceed to Tour
    await act(async () => {
      fireEvent.click(screen.getByText(/Ingreso rápido de demostración/));
    });

    // Guided Tour is displayed
    screen.getByText(/Tour Guiado: Músico o Banda/);
    screen.getByText('Bienvenido, músico');

    // Step through the tour
    const nextBtn = screen.getByText('Siguiente paso');
    await act(async () => {
      fireEvent.click(nextBtn);
    });
    screen.getByText('Explorá y filtrá');

    // Test going backward in tour
    const prevBtn = screen.getByText('Anterior');
    await act(async () => {
      fireEvent.click(prevBtn);
    });
    screen.getByText('Bienvenido, músico');

    // Skip to finish or finish tour
    await act(async () => {
      fireEvent.click(screen.getByText('Saltar tour'));
    });
    assert.strictEqual(completedRole, 'musico');
  });
});

describe('ActivityToolbar & RoleIconMenuModal', () => {
  afterEach(() => {
    cleanup();
  });
  it('ActivityToolbar allows sequential forward and backward navigation', () => {
    function TestNavigator() {
      const [tab, setTab] = useState('convocatorias');
      const [menuOpen, setMenuOpen] = useState(false);
      return (
        <div>
          <ActivityToolbar
            role="bar"
            activeTab={tab}
            onSelectTab={setTab}
            onOpenIconMenu={() => setMenuOpen(true)}
          />
          <div data-testid="current-tab">{tab}</div>
          {menuOpen && <div data-testid="menu-is-open">Menu Abierto</div>}
        </div>
      );
    }

    render(<TestNavigator />);

    // Starts at convocatorias
    assert.strictEqual(screen.getByTestId('current-tab').textContent, 'convocatorias');

    // Backward should be disabled on first activity
    const prevBtn = screen.getByRole('button', { name: /Atrás/ });
    assert.strictEqual((prevBtn as HTMLButtonElement).disabled, true);

    // Click Adelante -> moves to reservas
    const nextBtn = screen.getByRole('button', { name: /Adelante/ });
    fireEvent.click(nextBtn);
    assert.strictEqual(screen.getByTestId('current-tab').textContent, 'reservas');

    // Now Backward is enabled -> click Atrás -> moves back to convocatorias
    assert.strictEqual((prevBtn as HTMLButtonElement).disabled, false);
    fireEvent.click(prevBtn);
    assert.strictEqual(screen.getByTestId('current-tab').textContent, 'convocatorias');
  });

  it('RoleIconMenuModal renders all activities for the role and allows selection', () => {
    let selected: string | null = null;
    let tourRestarted = false;
    let roleChanged = false;

    render(
      <RoleIconMenuModal
        isOpen={true}
        onClose={() => {}}
        role="bar"
        activeTab="convocatorias"
        onSelectTab={(id) => { selected = id; }}
        onRestartTour={() => { tourRestarted = true; }}
        onChangeRole={() => { roleChanged = true; }}
      />
    );

    // Check modal contents
    screen.getByText('Menú de Actividades');
    screen.getByText('Modo Bar');
    screen.getByText('Convocatorias de Bares');
    screen.getByText('Reservas & Solicitudes');
    screen.getByText('Acuerdos & Pagos Protegidos');

    // Click on an activity card
    fireEvent.click(screen.getByText('Reservas & Solicitudes'));
    assert.strictEqual(selected, 'reservas');

    // Test actions
    fireEvent.click(screen.getByText('Tour'));
    assert.strictEqual(tourRestarted, true);

    fireEvent.click(screen.getByText('Cambiar Rol'));
    assert.strictEqual(roleChanged, true);
  });

  it('renders Compartir and Feedback buttons in OnboardingFlow and triggers callbacks', async () => {
    let shareTriggered = false;
    let feedbackTriggered = false;

    await act(async () => {
      render(
        <SessionProvider client={mockClient}>
          <OnboardingFlow
            onComplete={() => {}}
            onOpenShare={() => { shareTriggered = true; }}
            onOpenFeedback={() => { feedbackTriggered = true; }}
          />
        </SessionProvider>
      );
    });

    // Verify share elements are visible on Step 1
    screen.getByText('¿Querés invitar a tu banda, colegas o un bar?');
    const shareBtns = screen.getAllByRole('button', { name: /Compartir/i });
    assert.ok(shareBtns.length >= 2, 'Should have header and card share buttons');

    // Click share button
    await act(async () => {
      fireEvent.click(shareBtns[0]);
    });
    assert.strictEqual(shareTriggered, true);

    // Click feedback button
    const feedbackBtn = screen.getByRole('button', { name: /Reportar bug o enviar feedback/i });
    await act(async () => {
      fireEvent.click(feedbackBtn);
    });
    assert.strictEqual(feedbackTriggered, true);
  });
});
