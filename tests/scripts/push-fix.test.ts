import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const SCRIPT = path.resolve('scripts/push-fix.sh');

test('push-fix.sh shows help output', () => {
  const r = spawnSync('bash', [SCRIPT, '--help'], { encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /Uso: npm run push/);
  assert.match(r.stdout, /--no-verify/);
  assert.match(r.stdout, /--pages/);
});

test('push-fix.sh commits and pushes changes to origin repository', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'push-test-'));
  const originDir = path.join(tmpDir, 'origin.git');
  const workDir = path.join(tmpDir, 'work');

  // Create bare origin repository with main branch
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', originDir]);

  // Clone work directory
  execFileSync('git', ['clone', '-q', originDir, workDir]);

  // Create a sample fix file
  fs.writeFileSync(path.join(workDir, 'fix.txt'), 'fixed issue 123');

  // Run push-fix.sh in workDir with --no-verify against our test origin
  const r = spawnSync('bash', [SCRIPT, 'fix: resolver bug de prueba', '--no-verify'], {
    cwd: workDir,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'Ariel Test',
      GIT_AUTHOR_EMAIL: 'ariel@test.com',
      GIT_COMMITTER_NAME: 'Ariel Test',
      GIT_COMMITTER_EMAIL: 'ariel@test.com',
    },
  });

  assert.equal(r.status, 0, r.stderr || r.stdout);
  assert.match(r.stdout, /Push a GitHub completado con éxito/);
  assert.match(r.stdout, /Fixes publicados exitosamente/);

  // Verify the commit in bare origin
  const commitMsg = execFileSync('git', ['log', '-1', '--format=%s', 'main'], { cwd: originDir, encoding: 'utf8' }).trim();
  assert.equal(commitMsg, 'fix: resolver bug de prueba');
});
