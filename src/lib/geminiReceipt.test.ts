import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzePaymentReceipt } from './geminiReceipt.ts';
import {
  analyzePaymentReceiptOnServer,
  createGeminiClient,
  GeminiHttpError,
  normalizeReceiptOcrResult,
  parseDataUrlImage,
} from '../../server/gemini.ts';

test('parseDataUrlImage extracts mimeType and base64 payload', () => {
  const parsed = parseDataUrlImage('data:image/png;base64,AAAA1234');
  assert.equal(parsed.mimeType, 'image/png');
  assert.equal(parsed.data, 'AAAA1234');

  assert.throws(
    () => parseDataUrlImage(''),
    (err: any) => err instanceof GeminiHttpError && err.statusCode === 400
  );
});

test('normalizeReceiptOcrResult parses JSON and strips markdown fences', () => {
  const raw = '```json\n{"detectedCode":"DG-99","detectedAmountARS":16000,"status":"valido","notes":"OK"}\n```';
  const result = normalizeReceiptOcrResult(raw, 'DG-99', 16000);
  assert.equal(result.detectedCode, 'DG-99');
  assert.equal(result.detectedAmountARS, 16000);
  assert.equal(result.status, 'valido');
  assert.equal(result.notes, 'OK');
});

test('createGeminiClient throws 503 when GEMINI_API_KEY is missing', () => {
  const prev = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    assert.throws(
      () => createGeminiClient(''),
      (err: any) => err instanceof GeminiHttpError && err.statusCode === 503
    );
  } finally {
    if (prev !== undefined) process.env.GEMINI_API_KEY = prev;
  }
});

test('analyzePaymentReceiptOnServer calls @google/genai with gemini-4-hydrogen and returns structured OCR', async () => {
  let capturedParams: any = null;
  const fakeClient = {
    models: {
      generateContent: async (params: any) => {
        capturedParams = params;
        return {
          text: JSON.stringify({
            detectedCode: 'DG-BAR1-2026',
            detectedAmountARS: 16000,
            detectedDate: '2026-11-15',
            senderName: 'Lucia Perez',
            status: 'valido',
            notes: 'Transferencia verificada con codigo DG-BAR1-2026.',
          }),
        };
      },
    },
  };

  const result = await analyzePaymentReceiptOnServer(
    {
      imageDataUrl: 'data:image/png;base64,ZmFrZQ==',
      expectedEventCode: 'DG-BAR1-2026',
      expectedAmountARS: 16000,
    },
    fakeClient
  );

  assert.equal(capturedParams.model, 'gemini-4-hydrogen');
  assert.equal(capturedParams.contents.parts[0].inlineData.mimeType, 'image/png');
  assert.equal(capturedParams.contents.parts[0].inlineData.data, 'ZmFrZQ==');
  assert.equal(result.detectedCode, 'DG-BAR1-2026');
  assert.equal(result.detectedAmountARS, 16000);
  assert.equal(result.senderName, 'Lucia Perez');
  assert.equal(result.status, 'valido');
});

test('analyzePaymentReceiptOnServer propagates SDK error status and message', async () => {
  const failingClient = {
    models: {
      generateContent: async () => {
        const err: any = new Error('RESOURCE_EXHAUSTED');
        err.status = 429;
        throw err;
      },
    },
  };

  await assert.rejects(
    () =>
      analyzePaymentReceiptOnServer(
        {
          imageDataUrl: 'data:image/jpeg;base64,ZmFrZQ==',
          expectedEventCode: 'DG-BAR1-2026',
        },
        failingClient
      ),
    (err: any) => err instanceof GeminiHttpError && err.statusCode === 429 && err.message === 'RESOURCE_EXHAUSTED'
  );
});

test('client analyzePaymentReceipt calls /api/gemini/analyze-receipt and handles errors', async () => {
  const originalFetch = globalThis.fetch;
  let capturedUrl = '';
  let capturedInit: RequestInit | undefined;

  try {
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = String(url);
      capturedInit = init;
      return new Response(
        JSON.stringify({
          detectedCode: 'DG-TEST',
          detectedAmountARS: 8000,
          detectedDate: '2026-11-15',
          senderName: 'Usuario Test',
          status: 'valido',
          notes: 'OK desde servidor',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }) as typeof fetch;

    const okResult = await analyzePaymentReceipt('data:image/png;base64,abc', 'DG-TEST', 8000);
    assert.equal(capturedUrl, '/api/gemini/analyze-receipt');
    assert.equal(capturedInit?.method, 'POST');
    assert.equal(okResult.detectedCode, 'DG-TEST');
    assert.equal(okResult.notes, 'OK desde servidor');

    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ error: 'API key inválida' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })) as typeof fetch;

    await assert.rejects(
      () => analyzePaymentReceipt('data:image/png;base64,abc', 'DG-TEST', 8000),
      (err: any) => err instanceof Error && err.message === 'API key inválida'
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
