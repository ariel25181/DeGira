import React, { useState } from 'react';
import {
  Wrench,
  Bug,
  Lightbulb,
  MessageSquare,
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  X,
  Send,
  AlertCircle,
  Monitor,
} from 'lucide-react';
import { UserRole } from '../../types/index.ts';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRole: UserRole;
  currentTab: string;
}

type FeedbackType = 'bug' | 'feature' | 'general';

interface StoredFeedback {
  id: string;
  type: FeedbackType;
  title: string;
  description: string;
  email?: string;
  role: UserRole;
  tab: string;
  timestamp: string;
  userAgent: string;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  isOpen,
  onClose,
  currentRole,
  currentTab,
}) => {
  const [type, setType] = useState<FeedbackType>('bug');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const technicalInfo = {
    appVersion: '1.0.0 (PWA)',
    activeRole: currentRole,
    activeTab: currentTab,
    currentUrl: typeof window !== 'undefined' ? window.location.href : '',
    screen: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : '',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    timestamp: new Date().toISOString(),
  };

  const generateMarkdownReport = () => {
    const typeLabel =
      type === 'bug' ? '🐛 Bug / Error' : type === 'feature' ? '💡 Sugerencia / Mejora' : '💬 Feedback General';

    return `### [${typeLabel}] ${title || 'Sin título'}

**Descripción:**
${description || 'Sin descripción provista.'}

${contactEmail ? `**Contacto:** ${contactEmail}\n` : ''}
---
**Información Técnica:**
- **Rol Activo:** ${technicalInfo.activeRole}
- **Pestaña Actual:** ${technicalInfo.activeTab}
- **Versión:** ${technicalInfo.appVersion}
- **Resolución:** ${technicalInfo.screen}
- **URL:** ${technicalInfo.currentUrl}
- **Fecha:** ${technicalInfo.timestamp}
- **Navegador:** ${technicalInfo.userAgent}
`;
  };

  const handleCopyMarkdown = async () => {
    const md = generateMarkdownReport();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(md);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleOpenGitHubIssue = () => {
    const typePrefix = type === 'bug' ? '[Bug] ' : type === 'feature' ? '[Mejora] ' : '[Feedback] ';
    const issueTitle = encodeURIComponent(`${typePrefix}${title || 'Nuevo reporte desde SuenaBA'}`);
    const issueBody = encodeURIComponent(generateMarkdownReport());
    const githubUrl = `https://github.com/ariel25181/SuenaBA/issues/new?title=${issueTitle}&body=${issueBody}`;

    if (typeof window !== 'undefined') {
      window.open(githubUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    // Save report to localStorage for offline resilience
    try {
      const existing: StoredFeedback[] = JSON.parse(
        localStorage.getItem('suenaba:feedback_reports:v1') || '[]'
      );
      const newReport: StoredFeedback = {
        id: `fb-${Date.now()}`,
        type,
        title: title.trim(),
        description: description.trim(),
        email: contactEmail.trim() || undefined,
        role: currentRole,
        tab: currentTab,
        timestamp: new Date().toISOString(),
        userAgent: technicalInfo.userAgent,
      };
      existing.unshift(newReport);
      localStorage.setItem('suenaba:feedback_reports:v1', JSON.stringify(existing.slice(0, 50)));
    } catch {
      // ignore
    }

    setSubmitted(true);
  };

  const handleResetAndClose = () => {
    setSubmitted(false);
    setTitle('');
    setDescription('');
    setContactEmail('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-title"
    >
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800/80 bg-slate-950/70 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h2 id="feedback-title" className="text-base font-black text-slate-100 flex items-center gap-1.5">
                Bugs, Mejoras & Feedback
              </h2>
              <p className="text-xs text-slate-400">
                Tu reporte ayuda a construir la mejor app musical de Buenos Aires
              </p>
            </div>
          </div>
          <button
            onClick={handleResetAndClose}
            className="w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-100 flex items-center justify-center transition-colors"
            aria-label="Cerrar modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {submitted ? (
            <div className="py-6 text-center space-y-4 animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 mx-auto rounded-3xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/10">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-lg font-black text-slate-100">
                  ¡Gracias por tu aporte!
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 max-w-sm mx-auto leading-relaxed">
                  Tu reporte fue guardado con éxito. También podés publicarlo directamente como Issue en nuestro repositorio de GitHub.
                </p>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
                <button
                  type="button"
                  onClick={handleOpenGitHubIssue}
                  className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-colors flex items-center justify-center gap-1.5"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Crear Issue en GitHub</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyMarkdown}
                  className="px-4 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-200 font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? '¡Copiado en Markdown!' : 'Copiar Reporte'}</span>
                </button>
              </div>

              <div className="pt-3">
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  className="text-xs text-amber-400 hover:underline font-semibold"
                >
                  Volver a la aplicación
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Category picker pills */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  ¿Qué querés reportar o compartir?
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setType('bug')}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      type === 'bug'
                        ? 'bg-rose-500/15 border-rose-500/60 text-rose-300 shadow-md shadow-rose-500/10'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <Bug className="w-4 h-4 mb-1" />
                    <div className="text-xs font-bold">Bug / Error</div>
                    <div className="text-[10px] text-slate-400">Algo no funciona</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setType('feature')}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      type === 'feature'
                        ? 'bg-amber-500/15 border-amber-500/60 text-amber-300 shadow-md shadow-amber-500/10'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <Lightbulb className="w-4 h-4 mb-1" />
                    <div className="text-xs font-bold">Idea o Mejora</div>
                    <div className="text-[10px] text-slate-400">Nueva función</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setType('general')}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      type === 'general'
                        ? 'bg-cyan-500/15 border-cyan-500/60 text-cyan-300 shadow-md shadow-cyan-500/10'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <MessageSquare className="w-4 h-4 mb-1" />
                    <div className="text-xs font-bold">Feedback</div>
                    <div className="text-[10px] text-slate-400">Opinión general</div>
                  </button>
                </div>
              </div>

              {/* Title Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Título o resumen breve <span className="text-amber-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder={
                    type === 'bug'
                      ? 'Ej: Error al filtrar shows por Palermo'
                      : type === 'feature'
                      ? 'Ej: Poder agregar videos de YouTube al perfil de la banda'
                      : 'Ej: Experiencia de reserva muy fluida'
                  }
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-slate-100 placeholder-slate-600 focus:border-amber-500 outline-none transition-colors"
                />
              </div>

              {/* Description Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Descripción detallada <span className="text-amber-400">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder={
                    type === 'bug'
                      ? 'Describí qué estabas haciendo, qué botón presionaste y qué error apareció...'
                      : type === 'feature'
                      ? 'Contanos cómo te imaginas esta nueva función y por qué sería útil para músicos o bares...'
                      : 'Dejanos tus comentarios sobre SuenaBA...'
                  }
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-slate-100 placeholder-slate-600 focus:border-amber-500 outline-none transition-colors resize-none"
                />
              </div>

              {/* Contact Email (optional) */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Tu correo electrónico (opcional, para avisarte cuando esté resuelto)
                </label>
                <input
                  type="email"
                  placeholder="tunombre@ejemplo.com"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-slate-100 placeholder-slate-600 focus:border-amber-500 outline-none transition-colors"
                />
              </div>

              {/* Technical context toggle */}
              <div className="pt-1 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                  className="w-full flex items-center justify-between py-1.5 text-xs text-slate-400 hover:text-slate-200"
                >
                  <div className="flex items-center gap-1.5">
                    <Monitor className="w-3.5 h-3.5 text-amber-400" />
                    <span>Información técnica del entorno ({technicalInfo.activeRole} / {technicalInfo.activeTab})</span>
                  </div>
                  <span>{showTechnicalDetails ? '▲' : '▼'}</span>
                </button>

                {showTechnicalDetails && (
                  <div className="mt-2 p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-400 space-y-1">
                    <div><strong>Rol Activo:</strong> {technicalInfo.activeRole}</div>
                    <div><strong>Sección Activa:</strong> {technicalInfo.activeTab}</div>
                    <div><strong>Resolución:</strong> {technicalInfo.screen}</div>
                    <div><strong>URL:</strong> {technicalInfo.currentUrl}</div>
                    <div className="truncate"><strong>Navegador:</strong> {technicalInfo.userAgent}</div>
                  </div>
                )}
              </div>

              {/* Submit & GitHub actions */}
              <div className="pt-2 flex flex-col sm:flex-row gap-2">
                <button
                  type="submit"
                  disabled={!title.trim() || !description.trim()}
                  className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs sm:text-sm tracking-wide shadow-lg shadow-amber-500/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  <span>Enviar Reporte</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenGitHubIssue}
                  className="px-4 py-3 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-200 font-bold text-xs transition-colors flex items-center justify-center gap-2"
                  title="Abrir directamente un nuevo issue en GitHub"
                >
                  <ExternalLink className="w-4 h-4 text-amber-400" />
                  <span>Abrir en GitHub Issues</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
