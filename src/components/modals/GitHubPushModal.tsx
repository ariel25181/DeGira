import React, { useState } from 'react';
import {
  GitBranch,
  KeyRound,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  X,
  UploadCloud,
  ShieldCheck,
} from 'lucide-react';

export interface GitHubPushModalProps {
  isOpen: boolean;
  onClose: () => void;
  hasEnvToken?: boolean;
  repoName?: string;
  branch?: string;
}

interface PushSuccessState {
  commitSha: string;
  hadChanges: boolean;
  deployedPages: boolean;
  repoUrl: string;
  actionsUrl: string;
  pagesUrl: string;
  summary: string;
}

export const GitHubPushModal: React.FC<GitHubPushModalProps> = ({
  isOpen,
  onClose,
  hasEnvToken = false,
  repoName = 'ariel25181/DeGira',
  branch = 'main',
}) => {
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');
  const [runChecks, setRunChecks] = useState(true);
  const [deployPages, setDeployPages] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<PushSuccessState | null>(null);

  if (!isOpen) return null;

  const handleClose = () => {
    if (isPushing) return;
    setToken('');
    setShowToken(false);
    setErrorMsg(null);
    setResult(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPushing) return;

    const trimmedToken = token.trim();
    if (!trimmedToken && !hasEnvToken) {
      setErrorMsg('Ingresá tu Personal Access Token de GitHub para poder subir los cambios.');
      return;
    }

    setIsPushing(true);
    setErrorMsg(null);
    setResult(null);

    try {
      const response = await fetch('/api/dev/github-push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'DeGira-GitHub-Push',
        },
        body: JSON.stringify({
          token: trimmedToken || undefined,
          commitMessage: commitMessage.trim() || undefined,
          skipChecks: !runChecks,
          deployPages,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setErrorMsg(data?.error || 'No se pudo completar el push a GitHub.');
        return;
      }

      // Clear sensitive token from component memory immediately upon success
      setToken('');
      setShowToken(false);
      setResult({
        commitSha: data.commitSha || 'main',
        hadChanges: Boolean(data.hadChanges),
        deployedPages: Boolean(data.deployedPages),
        repoUrl: data.repoUrl || `https://github.com/${repoName}`,
        actionsUrl: data.actionsUrl || `https://github.com/${repoName}/actions`,
        pagesUrl: data.pagesUrl || 'https://ariel25181.github.io/DeGira/',
        summary: data.summary || 'Cambios enviados correctamente a GitHub.',
      });
    } catch {
      setErrorMsg('No se pudo conectar con el servidor local de AI Studio para ejecutar el push.');
    } finally {
      setIsPushing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="github-push-modal-title"
    >
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <GitBranch className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 id="github-push-modal-title" className="text-base font-black text-slate-100 truncate">
                Push a GitHub
              </h2>
              <p className="text-[11px] text-slate-400 truncate">
                {repoName} • rama <span className="text-amber-400 font-semibold">{branch}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={isPushing}
            aria-label="Cerrar modal de push a GitHub"
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-100 flex items-center justify-center transition-colors disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 space-y-4">
          {result ? (
            <div className="space-y-4 py-2">
              <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/35">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-1 min-w-0">
                  <p className="text-sm font-black text-emerald-300">
                    Push completado ({result.commitSha})
                  </p>
                  <p className="text-xs text-slate-300 leading-relaxed">{result.summary}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <a
                  href={result.actionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Ver CI / Actions</span>
                </a>
                <a
                  href={result.repoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
                  <span>Abrir Repositorio</span>
                </a>
              </div>

              <button
                type="button"
                onClick={handleClose}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-colors"
              >
                Cerrar
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-950/90 border border-slate-800 text-[11px] text-slate-300 leading-relaxed">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  Tu token se usa solo en memoria para autenticar este push en el servidor local y{' '}
                  <strong className="text-slate-100">no se guarda</strong> en el navegador ni en{' '}
                  <code className="text-amber-300">.git/config</code>.
                </span>
              </div>

              {/* Token field */}
              <div>
                <label
                  htmlFor="github-pat-input"
                  className="block text-xs font-bold text-slate-200 mb-1.5"
                >
                  GitHub Personal Access Token {!hasEnvToken && <span className="text-amber-400">*</span>}
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="github-pat-input"
                    data-testid="github-token-input"
                    type={showToken ? 'text' : 'password'}
                    autoComplete="off"
                    spellCheck={false}
                    required={!hasEnvToken}
                    placeholder={
                      hasEnvToken
                        ? 'Opcional (ya hay token en entorno)'
                        : 'Pegá tu token (permiso repo)'
                    }
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    disabled={isPushing}
                    className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-500 outline-none transition-colors font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken((prev) => !prev)}
                    aria-label={showToken ? 'Ocultar token' : 'Mostrar token'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1"
                  >
                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Commit message */}
              <div>
                <label
                  htmlFor="github-commit-msg-input"
                  className="block text-xs font-bold text-slate-200 mb-1.5"
                >
                  Mensaje del commit (opcional)
                </label>
                <input
                  id="github-commit-msg-input"
                  data-testid="github-commit-input"
                  type="text"
                  maxLength={160}
                  placeholder="Ej: fix: edge cases 2 bares x 2 músicos y reglas Firestore"
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  disabled={isPushing}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-500 outline-none transition-colors"
                />
              </div>

              {/* Options */}
              <div className="space-y-2 pt-1">
                <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={runChecks}
                    onChange={(e) => setRunChecks(e.target.checked)}
                    disabled={isPushing}
                    className="rounded border-slate-600 bg-slate-950 text-amber-500 focus:ring-amber-500"
                  />
                  <span>Verificar TypeScript y build antes de subir</span>
                </label>

                <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={deployPages}
                    onChange={(e) => setDeployPages(e.target.checked)}
                    disabled={isPushing}
                    className="rounded border-slate-600 bg-slate-950 text-amber-500 focus:ring-amber-500"
                  />
                  <span>Publicar también en rama gh-pages (GitHub Pages)</span>
                </label>
              </div>

              {errorMsg && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/40 text-xs text-rose-300"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isPushing}
                  className="px-4 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 font-bold text-xs transition-colors disabled:opacity-40"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  data-testid="github-push-submit-btn"
                  disabled={isPushing || (!token.trim() && !hasEnvToken)}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs sm:text-sm shadow-lg shadow-amber-500/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {isPushing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Subiendo a GitHub...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-4 h-4 stroke-[2.3]" />
                      <span>Hacer Push a GitHub</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
