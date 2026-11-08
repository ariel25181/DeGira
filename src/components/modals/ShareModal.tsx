import React, { useState } from 'react';
import {
  Share2,
  Copy,
  Check,
  X,
  MessageCircle,
  Twitter,
  Send,
  Sparkles,
  ExternalLink,
  QrCode,
} from 'lucide-react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  appUrl?: string;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  appUrl = 'https://ariel25181.github.io/DeGira/',
}) => {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  if (!isOpen) return null;

  const shareTitle = 'DeGira - Música en Vivo & Bares de Buenos Aires';
  const shareText =
    '¡Te comparto DeGira! La app para conectar bares, restaurantes y músicos en vivo en Buenos Aires, reservar fechas y ver la cartelera.';

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(appUrl);
      } else {
        const input = document.createElement('input');
        input.value = appUrl;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: appUrl,
        });
        onClose();
      } catch {
        // User cancelled share or error
      }
    } else {
      handleCopy();
    }
  };

  const encodedUrl = encodeURIComponent(appUrl);
  const encodedText = encodeURIComponent(`${shareText} ${appUrl}`);

  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodedText}`;
  const telegramUrl = `https://t.me/share/url?url=${encodedUrl}&text=${encodeURIComponent(shareText)}`;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodedText}`;

  // Generate QR code URL using public QR server API
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodedUrl}&bgcolor=0f172a&color=f59e0b`;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-title"
    >
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="p-5 border-b border-slate-800/80 bg-slate-950/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl overflow-hidden border border-amber-500/40 shrink-0">
              <img src="./icons/degira-van.jpg" alt="DeGira Camioneta VW" className="w-full h-full object-cover" />
            </div>
            <div>
              <h2 id="share-title" className="text-base font-black text-slate-100 flex items-center gap-1.5">
                Compartir DeGira
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  En vivo
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Invitá a músicos, dueños de bares y amantes de la música
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-100 flex items-center justify-center transition-colors"
            aria-label="Cerrar modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Link box with copy button */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Enlace directo a la app:
            </label>
            <div className="flex items-center gap-2 p-1.5 bg-slate-950 rounded-2xl border border-slate-800 focus-within:border-amber-500/60 transition-colors">
              <input
                type="text"
                readOnly
                value={appUrl}
                className="flex-1 bg-transparent px-3 py-1.5 text-xs text-amber-300 font-mono outline-none truncate select-all"
              />
              <button
                type="button"
                onClick={handleCopy}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                  copied
                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                    : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20'
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>¡Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar link</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Native mobile share button (if supported) */}
          {typeof navigator !== 'undefined' && 'share' in navigator && (
            <button
              type="button"
              onClick={handleNativeShare}
              className="w-full py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
            >
              <Share2 className="w-4 h-4 stroke-[2.5]" />
              <span>Compartir en mi celular (WhatsApp, Instagram, etc.)</span>
            </button>
          )}

          {/* Social share shortcuts */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Compartir rápido por:
            </span>
            <div className="grid grid-cols-3 gap-2">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center justify-center p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 hover:border-emerald-500/40 text-emerald-300 transition-all group"
              >
                <MessageCircle className="w-5 h-5 mb-1 group-hover:scale-110 transition-transform" />
                <span className="text-[11px] font-bold">WhatsApp</span>
              </a>

              <a
                href={telegramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center justify-center p-3 rounded-2xl bg-sky-500/10 border border-sky-500/20 hover:bg-sky-500/20 hover:border-sky-500/40 text-sky-300 transition-all group"
              >
                <Send className="w-5 h-5 mb-1 group-hover:scale-110 transition-transform" />
                <span className="text-[11px] font-bold">Telegram</span>
              </a>

              <a
                href={twitterUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center justify-center p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 hover:border-blue-500/40 text-blue-300 transition-all group"
              >
                <Twitter className="w-5 h-5 mb-1 group-hover:scale-110 transition-transform" />
                <span className="text-[11px] font-bold">X (Twitter)</span>
              </a>
            </div>
          </div>

          {/* QR Code toggle */}
          <div className="pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowQr(!showQr)}
              className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 text-xs text-slate-300 font-semibold transition-colors"
            >
              <div className="flex items-center gap-2">
                <QrCode className="w-4 h-4 text-amber-400" />
                <span>{showQr ? 'Ocultar código QR' : 'Mostrar código QR para escanear con el celular'}</span>
              </div>
              <span className="text-amber-400 text-xs">{showQr ? '▲' : '▼'}</span>
            </button>

            {showQr && (
              <div className="mt-3 p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col items-center justify-center text-center space-y-2 animate-in fade-in duration-200">
                <img
                  src={qrCodeUrl}
                  alt="Código QR de DeGira"
                  className="w-40 h-40 rounded-xl border border-amber-500/30 p-1 bg-slate-900 shadow-md"
                  loading="lazy"
                />
                <p className="text-[11px] text-slate-400 max-w-xs">
                  Escaneá con la cámara de cualquier teléfono para abrir e instalar DeGira.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
