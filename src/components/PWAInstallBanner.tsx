import React, { useState } from 'react';
import { Download, Smartphone, X, Share, PlusSquare } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall.ts';

interface PWAInstallGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PWAInstallGuideModal: React.FC<PWAInstallGuideModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { isInstallable, isIOS, isAndroid, install } = usePWAInstall();

  if (!isOpen) return null;

  const iosSection = (
    <div
      key="ios"
      className={`bg-slate-950/80 border rounded-2xl p-4 space-y-2.5 text-xs text-slate-200 ${
        isIOS ? 'border-amber-500/50 ring-1 ring-amber-500/20' : 'border-slate-800'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-amber-400 font-bold text-sm">
          En iPhone (Safari):
        </span>
        {isIOS && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
            Tu dispositivo
          </span>
        )}
      </div>
      <ol className="space-y-2 text-slate-300 leading-relaxed">
        <li className="flex items-start space-x-2">
          <span className="font-bold text-amber-400">1.</span>
          <span>
            Abrí esta página en <strong>Safari</strong> y tocá el botón{' '}
            <strong>Compartir</strong> (cuadrado con flecha hacia arriba{' '}
            <Share className="inline w-3.5 h-3.5 text-amber-400 mx-0.5" /> en la barra inferior).
          </span>
        </li>
        <li className="flex items-start space-x-2">
          <span className="font-bold text-amber-400">2.</span>
          <span>
            Deslizá hacia abajo y seleccioná{' '}
            <strong>&quot;Agregar a pantalla de inicio&quot;</strong> (
            <PlusSquare className="inline w-3.5 h-3.5 text-amber-400 mx-0.5" />).
          </span>
        </li>
        <li className="flex items-start space-x-2">
          <span className="font-bold text-amber-400">3.</span>
          <span>
            Tocá <strong>&quot;Agregar&quot;</strong> arriba a la derecha. ¡Listo! Ya tenés el ícono de DeGira en tu pantalla de inicio.
          </span>
        </li>
      </ol>
    </div>
  );

  const androidSection = (
    <div
      key="android"
      className={`bg-slate-950/80 border rounded-2xl p-4 space-y-2.5 text-xs text-slate-200 ${
        isAndroid || !isIOS
          ? 'border-emerald-500/40 ring-1 ring-emerald-500/15'
          : 'border-slate-800'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-emerald-400 font-bold text-sm">
          En Android (Chrome / Edge / Brave):
        </span>
        {isAndroid && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
            Tu dispositivo
          </span>
        )}
      </div>
      {isInstallable ? (
        <button
          type="button"
          onClick={async () => {
            await install();
            onClose();
          }}
          className="w-full py-2.5 px-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5 shadow-md transition-colors"
        >
          <Download className="w-4 h-4" />
          <span>Instalar ahora con 1 clic</span>
        </button>
      ) : (
        <ol className="space-y-2 text-slate-300 leading-relaxed">
          <li className="flex items-start space-x-2">
            <span className="font-bold text-emerald-400">1.</span>
            <span>
              En Chrome, tocá el menú de los <strong>tres puntos verticales (⋮)</strong> arriba a la derecha.
            </span>
          </li>
          <li className="flex items-start space-x-2">
            <span className="font-bold text-emerald-400">2.</span>
            <span>
              Seleccioná <strong>&quot;Instalar aplicación&quot;</strong> o{' '}
              <strong>&quot;Agregar a la pantalla principal&quot;</strong>.
            </span>
          </li>
          <li className="flex items-start space-x-2">
            <span className="font-bold text-emerald-400">3.</span>
            <span>
              Confirmá la instalación. Se agregará el acceso directo con el ícono de DeGira en tu celular.
            </span>
          </li>
        </ol>
      )}
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwa-install-modal-title"
    >
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-2xl shadow-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-xl overflow-hidden border border-amber-500/40 shrink-0">
              <img
                src="./icons/degira-van.jpg"
                alt="DeGira Camioneta VW Icon"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <h3
                id="pwa-install-modal-title"
                className="font-bold text-slate-100 font-display text-base"
              >
                Instalar DeGira en tu Celular
              </h3>
              <p className="text-xs text-slate-400">
                Acceso directo en pantalla de inicio como app nativa
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar guía de instalación"
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isIOS ? [iosSection, androidSection] : [androidSection, iosSection]}

        {/* Button Close */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs transition-colors"
        >
          Entendido
        </button>
      </div>
    </div>
  );
};

interface PWAInstallBannerProps {
  onOpenGuide?: () => void;
}

export const PWAInstallBanner: React.FC<PWAInstallBannerProps> = ({
  onOpenGuide,
}) => {
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // If already running in standalone PWA mode, hide
  if (isInstalled || dismissed) {
    return null;
  }

  const handleOpenGuide = () => {
    if (onOpenGuide) {
      onOpenGuide();
    } else {
      setShowGuide(true);
    }
  };

  return (
    <>
      {/* Top Banner / In-app Install notification */}
      <div className="bg-gradient-to-r from-amber-500/15 via-slate-900 to-amber-500/10 border-b border-amber-500/30 px-3.5 py-2 flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center space-x-2 truncate">
          <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <Smartphone className="w-3.5 h-3.5" />
          </div>
          <span className="text-slate-200 truncate">
            <strong>Instalá DeGira en tu celular</strong> (Android o iPhone)
          </span>
        </div>

        <div className="flex items-center space-x-1.5 shrink-0">
          {isInstallable ? (
            <button
              type="button"
              onClick={install}
              className="py-1 px-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] flex items-center space-x-1 shadow-sm transition-all"
            >
              <Download className="w-3 h-3" />
              <span>Instalar</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleOpenGuide}
              className="py-1 px-2.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 font-bold text-[11px] flex items-center space-x-1 transition-all"
            >
              <Download className="w-3 h-3" />
              <span>Instalar App</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Cerrar banner de instalación"
            className="p-1 text-slate-400 hover:text-slate-200"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {!onOpenGuide && (
        <PWAInstallGuideModal
          isOpen={showGuide}
          onClose={() => setShowGuide(false)}
        />
      )}
    </>
  );
};
