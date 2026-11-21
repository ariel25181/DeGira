import React from 'react';
import {
  Music,
  Wine,
  Ticket,
  Bell,
  Smartphone,
  Maximize2,
  ChevronDown,
  Sparkles,
  LayoutGrid,
  HelpCircle,
  Share2,
  Wrench,
  LogOut,
  Download,
  GitBranch,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { usePWAInstall } from '../hooks/usePWAInstall.ts';
import { UserRole } from '../types/index.ts';

interface HeaderProps {
  isMobileFrame: boolean;
  setIsMobileFrame: (val: boolean) => void;
  onOpenNotifications: () => void;
  onSelectTab: (tab: string) => void;
  onOpenIconMenu?: () => void;
  onRestartTour?: () => void;
  onChangeRole?: () => void;
  onOpenShare?: () => void;
  onOpenFeedback?: () => void;
  onOpenInstall?: () => void;
  onSignOut?: () => void;
  onOpenGithubPush?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  isMobileFrame,
  setIsMobileFrame,
  onOpenNotifications,
  onSelectTab,
  onOpenIconMenu,
  onRestartTour,
  onChangeRole,
  onOpenShare,
  onOpenFeedback,
  onOpenInstall,
  onSignOut,
  onOpenGithubPush,
}) => {
  const { role, setRole, currentMusician, currentVenue, notifications, userDisplayName } = useApp();
  const { isInstallable, isInstalled, install } = usePWAInstall();

  const handleInstallClick = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (accepted) return;
    }
    if (onOpenInstall) {
      onOpenInstall();
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 px-3 sm:px-4 py-2.5">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-1.5 sm:gap-2">
        {/* Logo */}
        <div
          onClick={() => onSelectTab(role === 'espectador' ? 'cartelera' : 'convocatorias')}
          className="flex items-center space-x-2 cursor-pointer group min-w-0"
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl overflow-hidden bg-slate-900 border-2 border-amber-500/60 shadow-lg shadow-amber-500/20 group-hover:scale-105 transition-transform shrink-0 relative">
            <img
              src="./icons/degira-van.jpg"
              alt="DeGira Camioneta VW Hippie Años 60"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 ring-1 ring-inset ring-amber-400/40 rounded-xl pointer-events-none" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-1">
              <span className="font-extrabold text-sm sm:text-base tracking-tight text-slate-100 font-display">
                De<span className="text-amber-400">Gira</span>
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-gradient-to-r from-amber-500/15 to-orange-500/15 text-amber-400 border border-amber-500/30">
                VIVO
              </span>
            </div>
            <p className="text-[10px] text-slate-300 font-medium leading-none truncate max-w-[105px] sm:max-w-none">
              Bienvenido, <span className="text-amber-400 font-bold">{userDisplayName || 'Usuario'}</span>
            </p>
          </div>
        </div>

        {/* Role Badge (Clear identification of current isolated profile) */}
        <div className="flex items-center space-x-1 px-2 sm:px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] sm:text-xs shadow-inner shrink-0">
          {role === 'musico' ? (
            <>
              <Music className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="font-bold text-slate-200 whitespace-nowrap">Músico</span>
            </>
          ) : role === 'bar' ? (
            <>
              <Wine className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="font-bold text-slate-200 whitespace-nowrap">Bar</span>
            </>
          ) : (
            <>
              <Ticket className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="font-bold text-slate-200 whitespace-nowrap">Público</span>
            </>
          )}
        </div>

        {/* Right tools: Install App, Notifications, Frame toggle & Account switch */}
        <div className="flex items-center space-x-1 sm:space-x-1.5 shrink-0">
          {/* PWA Install Icon Button */}
          {!isInstalled && (onOpenInstall || isInstallable) && (
            <button
              type="button"
              onClick={handleInstallClick}
              aria-label="Instalar aplicación"
              title="Instalar DeGira en tu celular o computadora"
              className="flex items-center justify-center gap-1 w-8 sm:w-auto sm:px-2 h-8 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 text-xs font-bold transition-colors"
            >
              <Download className="w-3.5 h-3.5 stroke-[2.3]" />
              <span className="hidden sm:inline">Instalar</span>
            </button>
          )}

          {/* AI Studio Dev GitHub Push Button */}
          {onOpenGithubPush && (
            <button
              type="button"
              data-testid="header-github-push-btn"
              onClick={onOpenGithubPush}
              aria-label="Push a GitHub"
              title="Subir cambios a GitHub (pedirá tu token)"
              className="flex items-center justify-center gap-1 w-8 sm:w-auto sm:px-2 h-8 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-xs font-bold transition-colors"
            >
              <GitBranch className="w-3.5 h-3.5 stroke-[2.3]" />
              <span className="hidden sm:inline">Push</span>
            </button>
          )}

          {/* Mobile frame toggle (desktop only) */}
          <button
            onClick={() => setIsMobileFrame(!isMobileFrame)}
            title={isMobileFrame ? 'Ver en ancho completo' : 'Simular celular (Android/iPhone)'}
            className="hidden md:flex items-center justify-center w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 transition-colors"
          >
            {isMobileFrame ? (
              <Maximize2 className="w-4 h-4" />
            ) : (
              <Smartphone className="w-4 h-4 text-amber-400" />
            )}
          </button>

          {/* Change account / Sign out */}
          {onSignOut && (
            <button
              onClick={onSignOut}
              title="Cambiar de cuenta o cerrar sesión"
              aria-label="Cambiar de cuenta"
              className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-semibold transition-colors"
            >
              <LogOut className="w-3.5 h-3.5 text-red-400" />
              <span>Cuentas</span>
            </button>
          )}

          {/* Notifications button */}
          <button
            onClick={onOpenNotifications}
            aria-label="Ver notificaciones"
            className="relative w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-200 hover:border-slate-700 transition-colors"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Cerrar sesión button */}
          {onSignOut && (
            <button
              onClick={onSignOut}
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
