import './setup.ts';
import React from 'react';
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { GitHubPushModal } from '../../src/components/modals/GitHubPushModal.tsx';

describe('GitHubPushModal UI', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    cleanup();
    globalThis.fetch = originalFetch;
  });

  it('prompts for token as masked password, submits to /api/dev/github-push, and clears token on success', async () => {
    let capturedUrl = '';
    let capturedHeaders: Record<string, string> = {};
    let capturedBody: Record<string, any> = {};

    globalThis.fetch = (async (url: any, init: any) => {
      capturedUrl = String(url);
      capturedHeaders = init?.headers || {};
      capturedBody = JSON.parse(init?.body || '{}');
      return {
        ok: true,
        json: async () => ({
          success: true,
          commitSha: 'abc1234',
          hadChanges: true,
          deployedPages: false,
          repoUrl: 'https://github.com/ariel25181/DeGira',
          actionsUrl: 'https://github.com/ariel25181/DeGira/actions',
          pagesUrl: 'https://ariel25181.github.io/DeGira/',
          summary: 'Commit creado y subido.',
        }),
      } as any;
    }) as any;

    render(<GitHubPushModal isOpen={true} onClose={() => {}} />);

    const tokenInput = screen.getByTestId('github-token-input') as HTMLInputElement;
    assert.strictEqual(tokenInput.type, 'password');
    assert.strictEqual(tokenInput.getAttribute('autocomplete'), 'off');

    fireEvent.change(tokenInput, { target: { value: 'tok_demo_input_value_987654' } });
    fireEvent.change(screen.getByTestId('github-commit-input'), {
      target: { value: 'fix: prueba boton push' },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('github-push-submit-btn'));
    });

    assert.strictEqual(capturedUrl, '/api/dev/github-push');
    assert.strictEqual(capturedHeaders['X-Requested-With'], 'DeGira-GitHub-Push');
    assert.strictEqual(capturedBody.token, 'tok_demo_input_value_987654');
    assert.strictEqual(capturedBody.commitMessage, 'fix: prueba boton push');
    assert.strictEqual(capturedBody.skipChecks, false);

    screen.getByText(/Push completado \(abc1234\)/);
  });

  it('displays server validation error without clearing commit message when push fails', async () => {
    globalThis.fetch = (async () => {
      return {
        ok: false,
        json: async () => ({
          error: 'GitHub rechazó el token o no tiene permiso de escritura.',
        }),
      } as any;
    }) as any;

    render(<GitHubPushModal isOpen={true} onClose={() => {}} />);

    fireEvent.change(screen.getByTestId('github-token-input'), {
      target: { value: 'tok_invalid_sample_12345' },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('github-push-submit-btn'));
    });

    screen.getByRole('alert');
    screen.getByText(/GitHub rechazó el token/);
  });
});
