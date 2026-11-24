import React, { useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import {
  PWA_UPDATE_EVENT,
  forceRefreshAppCachesAndReload,
  type PWAUpdateEventDetail,
} from '../utils/pwaUpdate.ts';

export const PWAUpdateBanner: React.FC = () => {
  const [pendingAction, setPendingAction] = useState<(() => Promise<void> | void) | null>(null);
  const [visible, setVisible] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const handleUpdateAvailable = (ev: Event) => {
      const customEv = ev as CustomEvent<PWAUpdateEventDetail>;
      setPendingAction(() => customEv.detail?.applyUpdate ?? null);
      setVisible(true);
    };

    window.addEventListener(PWA_UPDATE_EVENT, handleUpdateAvailable);
    return () => {
      window.removeEventListener(PWA_UPDATE_EVENT, handleUpdateAvailable);
    };
  }, []);

  if (!visible) return null;

  const handleApplyUpdate = async () => {
    setIsUpdating(true);
    try {
      if (pendingAction) {
        await pendingAction();
      } else {
        await forceRefreshAppCachesAndReload();
      }
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div
      data-testid="pwa-update-banner"
      role="status"
      aria-live="polite"
      className="fixed top-14 left-1/2 -translate-x-1/2 z-[95] w-[calc(100%-1rem)] max-w-lg rounded-xl bg-gradient-to-r from-emerald-950/95 via-slate-900/95 to-amber-950/90 backdrop-blur-md border border-emerald-500/60 shadow-2xl px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs text-slate-100"
    >
      <div className="flex items-center gap-2 min-w-0">
        <RefreshCw className={`w-4 h-4 text-emerald-400 shrink-0 ${isUpdating ? 'animate-spin' : ''}`} />
        <span className="truncate font-semibold">
          Nueva versión disponible
        </span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          data-testid="pwa-update-reload-btn"
          disabled={isUpdating}
          onClick={handleApplyUpdate}
          className="px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[11px] transition-colors disabled:opacity-60"
        >
          {isUpdating ? 'Actualizando...' : 'Actualizar ahora'}
        </button>
        <button
          type="button"
          aria-label="Ocultar aviso de actualización"
          onClick={() => setVisible(false)}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/70 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
