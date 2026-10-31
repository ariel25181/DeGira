import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const sh = (cwd: string, ...a: string[]) => execFileSync('git', a, { cwd, encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' } }).trim();
const SCRIPT = path.resolve('scripts/publicar-gh-pages.sh');

/** Arma un "origin" local con una rama gh-pages vieja y un clon de trabajo con un dist/ nuevo. */
function setup(distFiles: Record<string, string>) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pages-'));
  const origin = path.join(root, 'origin.git'), work = path.join(root, 'work'), seed = path.join(root, 'seed');
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', origin]);
  fs.mkdirSync(seed); sh(seed, 'init', '-q', '-b', 'gh-pages');
  fs.writeFileSync(path.join(seed, 'index.html'), 'VIEJO'); fs.writeFileSync(path.join(seed, 'viejo.js'), 'x'); fs.mkdirSync(path.join(seed, 'assets')); fs.writeFileSync(path.join(seed, 'assets/old.js'), 'x');
  sh(seed, 'add', '-A'); sh(seed, 'commit', '-q', '-m', 'sitio viejo'); sh(seed, 'remote', 'add', 'origin', origin); sh(seed, 'push', '-q', 'origin', 'gh-pages');
  execFileSync('git', ['clone', '-q', origin, work]);
  fs.mkdirSync(path.join(work, 'dist/assets'), { recursive: true });
  for (const [f, c] of Object.entries(distFiles)) { fs.mkdirSync(path.dirname(path.join(work, 'dist', f)), { recursive: true }); fs.writeFileSync(path.join(work, 'dist', f), c); }
  return { origin, work, root };
}
const run = (work: string, env: Record<string, string> = {}) => spawnSync('bash', [SCRIPT], { cwd: work, encoding: 'utf8', env: { ...process.env, ORIGIN: 'origin', GITHUB_SHA: 'abc1234def', GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t', ...env } });
const tree = (origin: string) => sh(origin, 'ls-tree', '-r', '--name-only', 'gh-pages').split('\n').sort();

test('reemplaza por completo el sitio viejo con el nuevo y agrega .nojekyll', () => {
  const { origin, work } = setup({ 'index.html': 'NUEVO', 'sw.js': 'sw', 'push-sw.js': 'push', 'assets/index-abc.js': 'js' });
  const r = run(work); assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(tree(origin), ['.nojekyll', 'assets/index-abc.js', 'index.html', 'push-sw.js', 'sw.js']);            // nada del sitio viejo quedó
  assert.equal(sh(origin, 'show', 'gh-pages:index.html'), 'NUEVO');
  assert.match(sh(origin, 'log', '-1', '--format=%s', 'gh-pages'), /^deploy: abc1234$/);
  assert.match(r.stdout, /Publicado en gh-pages/);
});

test('si no hay cambios no crea un commit vacío (idempotente)', () => {
  const { origin, work } = setup({ 'index.html': 'IGUAL' });
  assert.equal(run(work).status, 0);
  const before = sh(origin, 'rev-parse', 'gh-pages');
  const again = run(work); assert.equal(again.status, 0, again.stderr);
  assert.equal(sh(origin, 'rev-parse', 'gh-pages'), before); assert.match(again.stdout, /ya está al día/);
});

test('sin build previo falla con un mensaje claro y no toca gh-pages', () => {
  const { origin, work } = setup({ 'index.html': 'X' });
  fs.rmSync(path.join(work, 'dist'), { recursive: true });
  const before = sh(origin, 'rev-parse', 'gh-pages');
  const r = run(work); assert.notEqual(r.status, 0); assert.match(r.stderr, /build/);
  assert.equal(sh(origin, 'rev-parse', 'gh-pages'), before);
});
