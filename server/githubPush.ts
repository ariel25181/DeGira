import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const execFileAsync = promisify(execFile);

export const DEFAULT_GITHUB_REPO_URL = 'https://github.com/ariel25181/DeGira.git';
export const DEFAULT_GITHUB_WEB_URL = 'https://github.com/ariel25181/DeGira';
export const DEFAULT_GITHUB_PAGES_URL = 'https://ariel25181.github.io/DeGira/';
export const DEFAULT_GITHUB_BRANCH = 'main';

export class GitHubPushHttpError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.name = 'GitHubPushHttpError';
    this.statusCode = statusCode;
  }
}

export interface GitHubPushInput {
  token?: unknown;
  commitMessage?: unknown;
  skipChecks?: unknown;
  deployPages?: unknown;
}

export interface GitHubPushResult {
  success: true;
  commitSha: string;
  hadChanges: boolean;
  pushed: true;
  deployedPages: boolean;
  repoUrl: string;
  actionsUrl: string;
  pagesUrl: string;
  summary: string;
}

export function validateGithubToken(
  tokenInput: unknown,
  envToken: string | undefined = process.env.GITHUB_TOKEN || process.env.GH_TOKEN
): string {
  const candidate =
    typeof tokenInput === 'string' && tokenInput.trim().length > 0
      ? tokenInput.trim()
      : typeof envToken === 'string' && envToken.trim().length > 0
      ? envToken.trim()
      : '';

  if (!candidate) {
    throw new GitHubPushHttpError(
      'Ingresá tu Personal Access Token de GitHub para continuar.',
      400
    );
  }

  if (!/^[^\s\x00-\x1f\x7f]{10,256}$/.test(candidate)) {
    throw new GitHubPushHttpError(
      'El formato del token de GitHub no es válido (no debe contener espacios ni saltos de línea).',
      400
    );
  }

  return candidate;
}

export function sanitizeCommitMessage(raw: unknown): string {
  if (typeof raw === 'string') {
    const cleaned = raw
      .replace(/[\x00-\x1f\x7f]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 160);
    if (cleaned.length > 0) {
      return cleaned;
    }
  }
  const now = new Date();
  const stamp = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(
    now.getUTCDate()
  ).padStart(2, '0')} ${String(now.getUTCHours()).padStart(2, '0')}:${String(
    now.getUTCMinutes()
  ).padStart(2, '0')} UTC`;
  return `fix: mejoras y correcciones en la app [${stamp}]`;
}

export function redactSensitiveOutput(text: string, token?: string): string {
  let sanitized = text || '';
  if (token && token.length >= 4) {
    sanitized = sanitized.split(token).join('[REDACTED]');
  }
  sanitized = sanitized.replace(
    /\b(?:ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{6,}\b/g,
    '[REDACTED]'
  );
  sanitized = sanitized.replace(
    /https:\/\/[^:@/\s]+@github\.com/gi,
    'https://[REDACTED]@github.com'
  );
  return sanitized;
}

function normalizeHostHeader(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return (raw || '').split(',')[0].trim().toLowerCase();
}

export function isSameOriginDevRequest(
  headers: Record<string, string | string[] | undefined>
): boolean {
  const requestedWith = normalizeHostHeader(headers['x-requested-with']);
  if (requestedWith !== 'degira-github-push') {
    return false;
  }

  const forwardedHost = normalizeHostHeader(headers['x-forwarded-host']);
  const hostHeader = normalizeHostHeader(headers.host);
  const originRaw = normalizeHostHeader(headers.origin) || normalizeHostHeader(headers.referer);

  if (!originRaw) {
    return true;
  }

  try {
    const parsedOrigin = new URL(originRaw);
    const originHost = parsedOrigin.host.toLowerCase();
    if (forwardedHost && originHost === forwardedHost) {
      return true;
    }
    if (hostHeader && originHost === hostHeader) {
      return true;
    }
    const isLoopbackTarget =
      !hostHeader ||
      hostHeader.startsWith('localhost') ||
      hostHeader.startsWith('127.0.0.1') ||
      hostHeader.startsWith('0.0.0.0');
    if (isLoopbackTarget && parsedOrigin.protocol === 'https:' && parsedOrigin.hostname.endsWith('.run.app')) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

let pushInProgress = false;

async function runCmd(
  command: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
  token: string,
  timeoutMs: number = 180_000
): Promise<{ stdout: string; stderr: string }> {
  try {
    const res = await execFileAsync(command, args, {
      cwd,
      env,
      shell: false,
      timeout: timeoutMs,
      maxBuffer: 4 * 1024 * 1024,
    });
    return {
      stdout: redactSensitiveOutput(String(res.stdout || ''), token),
      stderr: redactSensitiveOutput(String(res.stderr || ''), token),
    };
  } catch (err: any) {
    const combined = redactSensitiveOutput(
      `${err?.stderr || ''}\n${err?.stdout || ''}\n${err?.message || ''}`.trim(),
      token
    );
    const error = new Error(combined || `Falló el comando ${command}`);
    throw error;
  }
}

async function createAskPassScript(): Promise<{ dir: string; scriptPath: string }> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'degira-git-auth-'));
  const scriptPath = path.join(dir, 'askpass.sh');
  const scriptContent = [
    '#!/usr/bin/env sh',
    'case "$1" in',
    '  *Username*|*username*) printf "%s\\n" "x-access-token" ;;',
    '  *) printf "%s\\n" "$DEGIRA_GIT_PASS" ;;',
    'esac',
    '',
  ].join('\n');
  await fs.writeFile(scriptPath, scriptContent, { mode: 0o700 });
  return { dir, scriptPath };
}

export async function runGitHubPushOnServer(
  input: GitHubPushInput,
  cwd: string = process.cwd(),
  remoteUrlOverride?: string
): Promise<GitHubPushResult> {
  if (pushInProgress) {
    throw new GitHubPushHttpError(
      'Ya hay un push a GitHub en curso. Esperá a que finalice.',
      409
    );
  }

  const token = validateGithubToken(input.token);
  const commitMessage = sanitizeCommitMessage(input.commitMessage);
  const skipChecks = Boolean(input.skipChecks);
  const deployPages = Boolean(input.deployPages);
  const repoDir = path.resolve(cwd);
  const targetRemoteUrl = remoteUrlOverride || DEFAULT_GITHUB_REPO_URL;

  pushInProgress = true;
  let askPassDir: string | null = null;
  const stepsSummary: string[] = [];

  try {
    const askPass = await createAskPassScript();
    askPassDir = askPass.dir;

    const gitEnv: NodeJS.ProcessEnv = {
      ...process.env,
      GIT_TERMINAL_PROMPT: '0',
      GIT_ASKPASS: askPass.scriptPath,
      DEGIRA_GIT_PASS: token,
      GCM_INTERACTIVE: 'never',
      GIT_CONFIG_COUNT: '1',
      GIT_CONFIG_KEY_0: 'safe.directory',
      GIT_CONFIG_VALUE_0: repoDir,
    };

    const runGit = (args: string[], timeoutMs: number = 30_000) =>
      runCmd('git', ['-c', `safe.directory=${repoDir}`, ...args], repoDir, gitEnv, token, timeoutMs);

    // Ensure safe.directory is also registered globally so child scripts (e.g. publicar-gh-pages.sh) succeed
    try {
      await runCmd(
        'git',
        ['config', '--global', '--add', 'safe.directory', repoDir],
        repoDir,
        gitEnv,
        token,
        5_000
      );
    } catch {
      // GIT_CONFIG_COUNT still covers direct git invocations
    }

    // 1. Optional TypeScript + Vite verification
    if (!skipChecks) {
      await runCmd('npm', ['run', 'lint'], repoDir, gitEnv, token, 120_000);
      await runCmd('npm', ['run', 'build'], repoDir, gitEnv, token, 180_000);
      stepsSummary.push('TypeScript y build de producción verificados.');
    }

    // 2. Ensure git repository and clean remote URL (never embed token in .git/config)
    let isGitRepo = true;
    try {
      await runGit(['rev-parse', '--is-inside-work-tree'], 10_000);
    } catch {
      isGitRepo = false;
    }

    if (!isGitRepo) {
      await runGit(['init', '-q', '-b', DEFAULT_GITHUB_BRANCH], 15_000);
      stepsSummary.push(`Repositorio git inicializado en rama ${DEFAULT_GITHUB_BRANCH}.`);
    }

    try {
      await runGit(['config', 'user.name'], 5_000);
    } catch {
      await runGit(
        ['config', 'user.name', process.env.GIT_AUTHOR_NAME || 'ariel25181'],
        5_000
      );
    }

    try {
      await runGit(['config', 'user.email'], 5_000);
    } catch {
      await runGit(
        ['config', 'user.email', process.env.GIT_AUTHOR_EMAIL || 'ariel.najlis@gmail.com'],
        5_000
      );
    }

    let currentRemote = '';
    try {
      const remoteRes = await runGit(['remote', 'get-url', 'origin'], 5_000);
      currentRemote = remoteRes.stdout.trim();
    } catch {
      currentRemote = '';
    }

    if (!currentRemote) {
      await runGit(['remote', 'add', 'origin', targetRemoteUrl], 5_000);
    } else if (currentRemote !== targetRemoteUrl) {
      await runGit(['remote', 'set-url', 'origin', targetRemoteUrl], 5_000);
    }

    // 3. Anchor HEAD to origin/main if repo was newly initialized
    let hasHead = true;
    try {
      await runGit(['rev-parse', 'HEAD'], 5_000);
    } catch {
      hasHead = false;
    }

    if (!hasHead) {
      try {
        await runGit(['fetch', 'origin', DEFAULT_GITHUB_BRANCH, '--depth=1'], 60_000);
        await runGit(['reset', `origin/${DEFAULT_GITHUB_BRANCH}`], 15_000);
        stepsSummary.push(`Historial sincronizado con origin/${DEFAULT_GITHUB_BRANCH}.`);
      } catch (fetchErr: any) {
        const fetchMsg = String(fetchErr?.message || '');
        if (
          /Authentication failed|403|Permission .* denied|could not read Username|Invalid username or token/i.test(
            fetchMsg
          )
        ) {
          throw new GitHubPushHttpError(
            'GitHub rechazó el token o no tiene permiso de acceso en ariel25181/DeGira.',
            401
          );
        }
        // Empty remote will fall through cleanly
      }
    }

    // 4. Stage & commit
    await runGit(['add', '-A'], 30_000);

    let hasChanges = false;
    try {
      await runGit(['diff', '--cached', '--quiet'], 10_000);
    } catch {
      hasChanges = true;
    }

    if (hasChanges) {
      await runGit(['commit', '-m', commitMessage], 30_000);
      stepsSummary.push(`Commit creado: "${commitMessage}".`);
    } else {
      stepsSummary.push('No había cambios nuevos sin commitear; se verificó el estado remoto.');
    }

    // 5. Push to origin/main (with rebase fallback if needed)
    try {
      await runGit(['push', '-u', 'origin', DEFAULT_GITHUB_BRANCH], 90_000);
    } catch (pushErr: any) {
      const msg = String(pushErr?.message || '');
      if (
        /Authentication failed|403|Permission .* denied|could not read Username|Invalid username or token/i.test(
          msg
        )
      ) {
        throw new GitHubPushHttpError(
          'GitHub rechazó el token o no tiene permiso de escritura (repo) en ariel25181/DeGira.',
          401
        );
      }

      // Attempt fast fetch + rebase in case remote advanced
      try {
        await runGit(['fetch', 'origin', DEFAULT_GITHUB_BRANCH], 60_000);
        await runGit(['rebase', `origin/${DEFAULT_GITHUB_BRANCH}`], 30_000);
        await runGit(['push', '-u', 'origin', DEFAULT_GITHUB_BRANCH], 90_000);
      } catch (rebaseErr: any) {
        try {
          await runGit(['rebase', '--abort'], 10_000);
        } catch {
          // ignore
        }
        const safeErr = redactSensitiveOutput(String(rebaseErr?.message || msg), token);
        throw new GitHubPushHttpError(
          `No se pudo completar el push a GitHub: ${safeErr.slice(0, 280)}`,
          502
        );
      }
    }
    stepsSummary.push(`Push completado en rama ${DEFAULT_GITHUB_BRANCH}.`);

    const shaRes = await runGit(['rev-parse', '--short', 'HEAD'], 5_000);
    const commitSha = shaRes.stdout.trim() || 'local';

    // 6. Optional direct GitHub Pages publish
    if (deployPages) {
      if (skipChecks) {
        await runCmd('npm', ['run', 'build'], repoDir, gitEnv, token, 180_000);
      }
      await runCmd('bash', ['scripts/publicar-gh-pages.sh'], repoDir, gitEnv, token, 120_000);
      stepsSummary.push('Rama gh-pages publicada.');
    }

    return {
      success: true,
      commitSha,
      hadChanges: hasChanges,
      pushed: true,
      deployedPages: deployPages,
      repoUrl: DEFAULT_GITHUB_WEB_URL,
      actionsUrl: `${DEFAULT_GITHUB_WEB_URL}/actions`,
      pagesUrl: DEFAULT_GITHUB_PAGES_URL,
      summary: stepsSummary.join(' '),
    };
  } catch (err: any) {
    if (err instanceof GitHubPushHttpError) {
      throw err;
    }
    const safeMsg = redactSensitiveOutput(String(err?.message || 'Error al hacer push.'), token);
    if (
      /Authentication failed|403|Permission .* denied|could not read Username|Invalid username or token/i.test(
        safeMsg
      )
    ) {
      throw new GitHubPushHttpError(
        'GitHub rechazó el token o no tiene permiso de escritura (repo) en ariel25181/DeGira.',
        401
      );
    }
    throw new GitHubPushHttpError(safeMsg.slice(0, 320), 500);
  } finally {
    pushInProgress = false;
    if (askPassDir) {
      try {
        await fs.rm(askPassDir, { recursive: true, force: true });
      } catch {
        // ignore cleanup errors
      }
    }
  }
}
