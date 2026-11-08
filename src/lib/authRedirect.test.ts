import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveAuthRedirectUrl, PROD_AUTH_REDIRECT_URL } from './authRedirect.ts';

test('resolveAuthRedirectUrl returns production URL when location is localhost with any port', () => {
  const local3000 = resolveAuthRedirectUrl({
    origin: 'http://localhost:3000',
    hostname: 'localhost',
    pathname: '/',
  });
  assert.strictEqual(local3000, PROD_AUTH_REDIRECT_URL);

  const local5173 = resolveAuthRedirectUrl({
    origin: 'http://localhost:5173',
    hostname: 'localhost',
    pathname: '/DeGira',
  });
  assert.strictEqual(local5173, PROD_AUTH_REDIRECT_URL);
});

test('resolveAuthRedirectUrl returns production URL for 127.0.0.1 and 0.0.0.0', () => {
  const loopback = resolveAuthRedirectUrl({
    origin: 'http://127.0.0.1:3000',
    hostname: '127.0.0.1',
    pathname: '/',
  });
  assert.strictEqual(loopback, PROD_AUTH_REDIRECT_URL);

  const zeros = resolveAuthRedirectUrl({
    origin: 'http://0.0.0.0:3000',
    hostname: '0.0.0.0',
    pathname: '/',
  });
  assert.strictEqual(zeros, PROD_AUTH_REDIRECT_URL);
});

test('resolveAuthRedirectUrl returns production URL for local networks (.local)', () => {
  const macLocal = resolveAuthRedirectUrl({
    origin: 'http://macbook.local:3000',
    hostname: 'macbook.local',
    pathname: '/',
  });
  assert.strictEqual(macLocal, PROD_AUTH_REDIRECT_URL);
});

test('resolveAuthRedirectUrl preserves canonical production origin when hosted publicly', () => {
  const ghPages = resolveAuthRedirectUrl({
    origin: 'https://ariel25181.github.io',
    hostname: 'ariel25181.github.io',
    pathname: '/DeGira/',
  });
  assert.strictEqual(ghPages, 'https://ariel25181.github.io/DeGira/');

  const customDomain = resolveAuthRedirectUrl({
    origin: 'https://degira.com.ar',
    hostname: 'degira.com.ar',
    pathname: '/',
  });
  assert.strictEqual(customDomain, 'https://degira.com.ar/');
});

test('resolveAuthRedirectUrl falls back to production URL in SSR environments without location', () => {
  const ssr = resolveAuthRedirectUrl(undefined);
  assert.strictEqual(ssr, PROD_AUTH_REDIRECT_URL);
});
