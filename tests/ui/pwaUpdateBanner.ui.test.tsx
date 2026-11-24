import './setup.ts';
import React from 'react';
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { PWAUpdateBanner } from '../../src/components/PWAUpdateBanner.tsx';
import { dispatchPWAUpdateAvailable } from '../../src/utils/pwaUpdate.ts';

describe('PWAUpdateBanner', () => {
  afterEach(() => {
    cleanup();
  });

  it('stays hidden until a PWA update event fires, then triggers applyUpdate on click and dismisses cleanly', async () => {
    let applyCalled = false;

    render(<PWAUpdateBanner />);
    assert.strictEqual(screen.queryByTestId('pwa-update-banner'), null);

    await act(async () => {
      dispatchPWAUpdateAvailable(window, {
        applyUpdate: async () => {
          applyCalled = true;
        },
      });
    });

    screen.getByTestId('pwa-update-banner');
    const reloadBtn = screen.getByTestId('pwa-update-reload-btn');

    await act(async () => {
      fireEvent.click(reloadBtn);
    });
    assert.strictEqual(applyCalled, true);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Ocultar aviso de actualización/i }));
    });
    assert.strictEqual(screen.queryByTestId('pwa-update-banner'), null);
  });
});
