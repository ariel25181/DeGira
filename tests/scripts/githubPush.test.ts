import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  validateGithubToken,
  sanitizeCommitMessage,
  redactSensitiveOutput,
  isSameOriginDevRequest,
  runGitHubPushOnServer,
  GitHubPushHttpError,
} from '../../server/githubPush.ts';

const execFileAsync = promisify(execFile);

describe('server/githubPush helpers', () => {
  it('validates GitHub token and rejects missing or whitespace-containing tokens', () => {
    assert.throws(
      () => validateGithubToken('', ''),
      (err: any) => err instanceof GitHubPushHttpError && err.statusCode === 400
    );

    assert.throws(
      () => validateGithubToken('token with spaces', ''),
      (err: any) => err instanceof GitHubPushHttpError && err.statusCode === 400
    );

    assert.throws(
      () => validateGithubToken('short', ''),
      (err: any) => err instanceof GitHubPushHttpError && err.statusCode === 400
    );

    assert.strictEqual(
      validateGithubToken('  tok_sample_valid_1234567890  ', ''),
      'tok_sample_valid_1234567890'
    );

    assert.strictEqual(
      validateGithubToken('', 'env_sample_token_1234567890'),
      'env_sample_token_1234567890'
    );
  });

  it('sanitizes commit messages to a single safe line and supplies a default', () => {
    const clean = sanitizeCommitMessage('  fix:   corregido\nbug\r\ten flujo  ');
    assert.strictEqual(clean, 'fix: corregido bug en flujo');

    const fallback = sanitizeCommitMessage('   ');
    assert.match(fallback, /^fix: mejoras y correcciones en la app \[\d{4}-\d{2}-\d{2}/);
  });

  it('redacts tokens and credential URLs from command output', () => {
    const fakeToken = 'tok_secret_value_abcdef12345';
    const raw = `fatal: unable to access https://${fakeToken}@github.com/ariel25181/DeGira.git with ${fakeToken}`;
    const cleaned = redactSensitiveOutput(raw, fakeToken);
    assert.ok(!cleaned.includes(fakeToken));
    assert.ok(cleaned.includes('[REDACTED]'));
  });

  it('enforces custom header and same-origin match on dev push requests', () => {
    assert.strictEqual(
      isSameOriginDevRequest({
        host: 'localhost:3000',
        origin: 'http://localhost:3000',
      }),
      false
    );

    assert.strictEqual(
      isSameOriginDevRequest({
        'x-requested-with': 'DeGira-GitHub-Push',
        host: 'localhost:3000',
        origin: 'https://evil.example.com',
      }),
      false
    );

    assert.strictEqual(
      isSameOriginDevRequest({
        'x-requested-with': 'DeGira-GitHub-Push',
        'x-forwarded-host': 'ais-dev-demo.us-east1.run.app',
        origin: 'https://ais-dev-demo.us-east1.run.app',
      }),
      true
    );

    assert.strictEqual(
      isSameOriginDevRequest({
        'x-requested-with': 'DeGira-GitHub-Push',
        host: 'localhost:3000',
        origin: 'https://ais-dev-demo.us-east1.run.app',
      }),
      true
    );
  });

  it('initializes git with safe.directory, syncs with bare origin/main, commits, and pushes', async () => {
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'degira-push-test-'));
    const bareRepo = path.join(tmpRoot, 'origin.git');
    const seedWork = path.join(tmpRoot, 'seed');
    const appDir = path.join(tmpRoot, 'app');

    try {
      await fs.mkdir(seedWork, { recursive: true });
      await fs.mkdir(appDir, { recursive: true });

      await execFileAsync('git', ['init', '--bare', '-b', 'main', bareRepo]);
      await execFileAsync('git', ['init', '-b', 'main', seedWork]);
      await execFileAsync('git', ['config', 'user.name', 'seed'], { cwd: seedWork });
      await execFileAsync('git', ['config', 'user.email', 'seed@example.com'], { cwd: seedWork });
      await fs.writeFile(path.join(seedWork, 'README.md'), 'initial\n');
      await execFileAsync('git', ['add', '-A'], { cwd: seedWork });
      await execFileAsync('git', ['commit', '-m', 'seed'], { cwd: seedWork });
      await execFileAsync('git', ['remote', 'add', 'origin', bareRepo], { cwd: seedWork });
      await execFileAsync('git', ['push', '-u', 'origin', 'main'], { cwd: seedWork });

      // Simulate uninitialized working directory containing updated file
      await fs.writeFile(path.join(appDir, 'README.md'), 'updated\n');
      await fs.writeFile(path.join(appDir, 'new-file.txt'), 'hello\n');

      const result = await runGitHubPushOnServer(
        {
          token: 'tok_local_test_1234567890',
          commitMessage: 'test: push from uninitialized dir',
          skipChecks: true,
          deployPages: false,
        },
        appDir,
        bareRepo
      );

      assert.strictEqual(result.pushed, true);
      assert.strictEqual(result.hadChanges, true);
      assert.ok(result.commitSha.length >= 7);

      const { stdout: logOut } = await execFileAsync('git', [
        `--git-dir=${bareRepo}`,
        'log',
        '-n',
        '1',
        '--pretty=%s',
        'main',
      ]);
      assert.strictEqual(logOut.trim(), 'test: push from uninitialized dir');
    } finally {
      await fs.rm(tmpRoot, { recursive: true, force: true });
    }
  });
});
