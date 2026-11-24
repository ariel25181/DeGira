import './setup.ts';
import React from 'react';
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { ShareModal } from '../../src/components/modals/ShareModal.tsx';
import { FeedbackModal } from '../../src/components/modals/FeedbackModal.tsx';

describe('ShareModal Component', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders correctly when open and displays sharing links', async () => {
    let closed = false;
    await act(async () => {
      render(
        <ShareModal
          isOpen={true}
          onClose={() => { closed = true; }}
          appUrl="https://ariel25181.github.io/DeGira/"
        />
      );
    });

    // Verify Title
    screen.getByText('Compartir DeGira');
    screen.getByText('Enlace directo a la app:');

    // Verify input contains app URL
    const input = screen.getByDisplayValue('https://ariel25181.github.io/DeGira/');
    assert.ok(input);

    // Verify Social links
    screen.getByText('WhatsApp');
    screen.getByText('Telegram');
    screen.getByText('X (Twitter)');

    // Toggle QR code
    const qrToggle = screen.getByText(/Mostrar código QR/);
    await act(async () => {
      fireEvent.click(qrToggle);
    });
    screen.getByAltText('Código QR de DeGira');

    // Click Close
    const closeBtn = screen.getByLabelText('Cerrar modal');
    await act(async () => {
      fireEvent.click(closeBtn);
    });
    assert.strictEqual(closed, true);
  });
});

describe('FeedbackModal Component (Wrench tool)', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders correctly and switches between bug, feature and feedback', async () => {
    await act(async () => {
      render(
        <FeedbackModal
          isOpen={true}
          onClose={() => {}}
          currentRole="musico"
          currentTab="convocatorias"
        />
      );
    });

    // Check title
    screen.getByText('Bugs, Mejoras & Feedback');

    // Categories
    screen.getByText('Bug / Error');
    screen.getByText('Idea o Mejora');
    screen.getByText('Feedback');

    // Toggle to Idea o Mejora
    const featureBtn = screen.getByText('Idea o Mejora');
    await act(async () => {
      fireEvent.click(featureBtn);
    });

    // Toggle technical details
    const techBtn = screen.getByText(/Información técnica del entorno/);
    await act(async () => {
      fireEvent.click(techBtn);
    });
    screen.getByText(/Rol Activo:/);
    screen.getByText(/Sección Activa:/);
  });

  it('submits a feedback report and displays confirmation', async () => {
    await act(async () => {
      render(
        <FeedbackModal
          isOpen={true}
          onClose={() => {}}
          currentRole="bar"
          currentTab="reservas"
        />
      );
    });

    // Fill title and description
    const titleInput = screen.getByPlaceholderText(/Ej: Error al filtrar shows/);
    const descInput = screen.getByPlaceholderText(/Describí qué estabas haciendo/);

    await act(async () => {
      fireEvent.change(titleInput, { target: { value: 'Problema al confirmar reserva' } });
      fireEvent.change(descInput, { target: { value: 'Al hacer clic en aceptar fecha no actualizó el estado' } });
    });

    // Submit form
    const submitBtn = screen.getByText('Enviar Reporte');
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    // Confirmation screen
    screen.getByText('¡Gracias por tu aporte!');
    screen.getByText('Crear Issue en GitHub');
    screen.getByText('Copiar Reporte');
  });

  it('displays automatic screenshot, supports retake/upload photos, and saves them to localStorage', async () => {
    localStorage.clear();
    let retakeCalls = 0;

    await act(async () => {
      render(
        <FeedbackModal
          isOpen={true}
          onClose={() => {}}
          currentRole="musico"
          currentTab="convocatorias"
          initialScreenshot="data:image/png;base64,INITIALSHOT"
          onRetakeScreenshot={() => {
            retakeCalls += 1;
            return 'data:image/png;base64,RETAKENSHOT';
          }}
        />
      );
    });

    // Automatic screenshot preview shown
    const previewImg = screen.getByAltText('Captura automática de pantalla') as HTMLImageElement;
    assert.ok(previewImg.src.includes('INITIALSHOT'));

    // Retake updates screenshot
    await act(async () => {
      fireEvent.click(screen.getByText('Recapturar'));
    });
    assert.strictEqual(retakeCalls, 1);
    assert.ok((screen.getByAltText('Captura automática de pantalla') as HTMLImageElement).src.includes('RETAKENSHOT'));

    // Upload extra photo file
    const fileInput = screen.getByTestId('feedback-photo-input') as HTMLInputElement;
    const fakeFile = new File(['hello'], 'bug.png', { type: 'image/png' });
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [fakeFile] } });
      await new Promise((r) => setTimeout(r, 30));
    });

    screen.getByAltText('Foto adjunta 1');

    // Fill and submit
    fireEvent.change(screen.getByPlaceholderText(/Ej: Error al filtrar shows/), {
      target: { value: 'Bug con captura' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Describí qué estabas haciendo/), {
      target: { value: 'Adjunto captura automática y foto extra' },
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Enviar Reporte'));
    });

    const saved = JSON.parse(localStorage.getItem('suenaba:feedback_reports:v1') || '[]');
    assert.strictEqual(saved.length, 1);
    assert.ok(saved[0].screenshot.includes('RETAKENSHOT'));
    assert.strictEqual(saved[0].attachments.length, 1);
  });
});

