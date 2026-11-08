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
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
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
  onSignOut?: () => void;
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
  onSignOut,
}) => {
  const { role, setRole, currentMusician, currentVenue, notifications, userDisplayName } = useApp();

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 px-4 py-2.5">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
        {/* Logo */}
        <div
          onClick={() => onSelectTab('cartelera')}
          className="flex items-center space-x-2.5 cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-900 border-2 border-amber-500/60 shadow-lg shadow-amber-500/20 group-hover:scale-105 transition-transform shrink-0 relative">
            <img
              src="./icons/degira-van.jpg"
              alt="DeGira Camioneta VW Hippie Años 60"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 ring-1 ring-inset ring-amber-400/40 rounded-xl pointer-events-none" />
          </div>
          <div>
            <div className="flex items-center space-x-1">
              <span className="font-extrabold text-base tracking-tight text-slate-100 font-display">
                De<span className="text-amber-400">Gira</span>
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-gradient-to-r from-amber-500/15 to-orange-500/15 text-amber-400 border border-amber-500/30">
                VIVO
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium leading-none truncate max-w-[130px] sm:max-w-none">
              Hola, <span className="text-amber-400 font-semibold">{userDisplayName}</span>
            </p>
          </div>
        </div>

        {/* Role Switcher Pill - Airbnb Style */}
        <div className="bg-slate-900 border border-slate-800 p-0.5 rounded-full flex items-center text-xs">
          <button
            onClick={() => setRole('musico')}
            className={`flex items-center space-x-1 px-2.5 py-1 rounded-full font-semibold transition-all ${
              role === 'musico'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Music className="w-3.5 h-3.5" />
            <span><span className="hidden sm:inline">Modo </span>Músico</span>
          </button>

          <button
            onClick={() => setRole('bar')}
            className={`flex items-center space-x-1 px-2.5 py-1 rounded-full font-semibold transition-all ${
              role === 'bar'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Wine className="w-3.5 h-3.5" />
            <span><span className="hidden sm:inline">Modo </span>Bar</span>
          </button>

          <button
            onClick={() => setRole('espectador')}
            className={`flex items-center space-x-1 px-2.5 py-1 rounded-full font-semibold transition-all ${
              role === 'espectador'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Ticket className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Público</span>
          </button>
        </div>

        {/* Right tools: Icon Menu, Notifications & Frame toggle */}
        <div className="flex items-center space-x-1.5">
          {/* Menu of Options / Activities icon button */}
          {onOpenIconMenu && (
            <button
              onClick={onOpenIconMenu}
              title="Ver menú de iconos con opciones del rol"
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 hover:text-amber-300 transition-colors"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          )}

          {/* Guided Tour trigger */}
          {onRestartTour && (
            <button
              onClick={onRestartTour}
              title="Repetir tour guiado"
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 transition-colors"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          )}

          {/* Share app button */}
          {onOpenShare && (
            <button
              onClick={onOpenShare}
              title="Compartir DeGira con amigos o músicos"
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-amber-400 hover:border-amber-500/40 transition-colors"
              aria-label="Compartir app"
            >
              <Share2 className="w-4 h-4" />
            </button>
          )}

          {/* Feedback / Bug tool icon button (Wrench) */}
          {onOpenFeedback && (
            <button
              onClick={onOpenFeedback}
              title="Reportar bug, sugerir mejora o dar feedback"
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-amber-400 hover:border-amber-500/40 transition-colors"
              aria-label="Reportar bug o feedback"
            >
              <Wrench className="w-4 h-4" />
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
