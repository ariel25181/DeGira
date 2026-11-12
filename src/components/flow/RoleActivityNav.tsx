import React from 'react';
import {
  Radio,
  Clock,
  Ticket,
  Handshake,
  CalendarDays,
  User,
  Wine,
  Music,
  ArrowLeft,
  ArrowRight,
  LayoutGrid,
  Sparkles,
  ChevronRight,
  RotateCcw,
  RefreshCw,
  LucideIcon,
  Share2,
  Wrench,
  LogOut,
} from 'lucide-react';
import { UserRole } from '../../types/index.ts';

export interface RoleActivity {
  id: string; // matches activeTab: 'cartelera' | 'convocatorias' | 'disponibilidad' | 'acuerdos' | 'reservas' | 'perfil'
  title: string;
  shortLabel: string;
  description: string;
  emoji: string;
  icon: LucideIcon;
  badge?: string;
  gradient: string;
}

export const ROLE_ACTIVITIES: Record<UserRole, RoleActivity[]> = {
  bar: [
    {
      id: 'convocatorias',
      title: 'Mis Eventos & Estados',
      shortLabel: 'Mis Eventos',
      description: 'Gestión de fechas, estados, creación de propuestas en locales y publicación manual en cartelera.',
      emoji: '📢',
      icon: Radio,
      badge: 'Eventos del Bar',
      gradient: 'from-amber-500 to-orange-600',
    },
    {
      id: 'acuerdos',
      title: 'Postulaciones de Músicos',
      shortLabel: 'Postulaciones',
      description: 'Revisión de propuestas de músicos, contraofertas de caché, aceptación o rechazo.',
      emoji: '🤝',
      icon: Handshake,
      badge: 'Negociaciones',
      gradient: 'from-emerald-500 to-teal-600',
    },
    {
      id: 'perfil',
      title: 'Mi Bar & Control de Puerta',
      shortLabel: 'Mi Bar & Sala',
      description: 'Validación de pases QR de acceso (check-in único), reseñas bilaterales y configuración del local.',
      emoji: '🍸',
      icon: Wine,
      badge: 'Perfil del Bar',
      gradient: 'from-rose-500 to-pink-600',
    },
  ],
  musico: [
    {
      id: 'convocatorias',
      title: 'Convocatorias de Bares',
      shortLabel: 'Convocatorias',
      description: 'Explorá propuestas y llamados de bares porteños, postulá y recibí avisos automáticos de clash.',
      emoji: '🔎',
      icon: Radio,
      badge: 'Convocatorias',
      gradient: 'from-amber-500 to-orange-600',
    },
    {
      id: 'acuerdos',
      title: 'Mis Propuestas & Recordatorios',
      shortLabel: 'Mis Propuestas',
      description: 'Seguimiento de propuestas enviadas a bares, envío de recordatorios y retractación hasta 24hs antes.',
      emoji: '🤝',
      icon: Handshake,
      badge: 'Negociaciones',
      gradient: 'from-emerald-500 to-teal-600',
    },
    {
      id: 'perfil',
      title: 'Mi Perfil Musical & Rider',
      shortLabel: 'Mi Banda & Rider',
      description: 'Ficha de artista, enlaces streaming de música, input list de canales y cuentas test.',
      emoji: '⭐',
      icon: Music,
      badge: 'Perfil Artístico',
      gradient: 'from-yellow-500 to-amber-600',
    },
  ],
  espectador: [
    {
      id: 'cartelera',
      title: 'Cartelera de Shows en Vivo',
      shortLabel: 'Cartelera',
      description: 'Navegá recitales confirmados en CABA, consultá reseñas del bar, últimos 10 eventos y músicos, y reservá tu lugar.',
      emoji: '🎟️',
      icon: CalendarDays,
      badge: 'Cartelera Oficial',
      gradient: 'from-purple-500 to-indigo-600',
    },
    {
      id: 'perfil',
      title: 'Mi Perfil & Reservas',
      shortLabel: 'Mi Perfil & Reservas',
      description: 'Gestioná tus reservas, subí comprobantes de pago dentro de 8 min, recibí QR y calificá shows finalizados.',
      emoji: '👤',
      icon: User,
      badge: 'Mis Reservas & Datos',
      gradient: 'from-cyan-500 to-blue-600',
    },
  ],
};

interface RoleActivityNavProps {
  role: UserRole;
  activeTab: string;
  onSelectTab: (tabId: string) => void;
  onOpenIconMenu: () => void;
}

/**
 * Top Activity Navigation Bar that enables forward and backward navigation
 * sequentially between the activities of the current role.
 */
export const ActivityToolbar: React.FC<RoleActivityNavProps> = ({
  role,
  activeTab,
  onSelectTab,
  onOpenIconMenu,
}) => {
  const activities = ROLE_ACTIVITIES[role] || ROLE_ACTIVITIES.musico;
  const currentIndex = activities.findIndex((a) => a.id === activeTab);
  const currentActivity = activities[currentIndex] || activities[0];

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < activities.length - 1;

  const prevActivity = hasPrev ? activities[currentIndex - 1] : null;
  const nextActivity = hasNext ? activities[currentIndex + 1] : null;

  const handleGoPrev = () => {
    if (hasPrev) {
      onSelectTab(activities[currentIndex - 1].id);
    }
  };

  const handleGoNext = () => {
    if (hasNext) {
      onSelectTab(activities[currentIndex + 1].id);
    }
  };

  return (
    <div className="bg-slate-900/90 border-b border-slate-800/80 px-3 py-2 text-xs select-none">
      <div className="flex items-center justify-between gap-1.5">
        {/* Back / Previous Activity Button */}
        <button
          type="button"
          onClick={handleGoPrev}
          disabled={!hasPrev}
          title={prevActivity ? `Ir a: ${prevActivity.title}` : 'No hay actividad anterior'}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl font-bold transition-all ${
            hasPrev
              ? 'bg-slate-800 text-slate-200 hover:bg-slate-700 active:scale-95 border border-slate-700'
              : 'opacity-30 cursor-not-allowed text-slate-500'
          }`}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Atrás</span>
          {prevActivity && (
            <span className="hidden md:inline font-normal text-slate-400 max-w-[90px] truncate">
              ({prevActivity.shortLabel})
            </span>
          )}
        </button>

        {/* Center: Current Activity Indicator & Open Menu Trigger */}
        <button
          type="button"
          onClick={onOpenIconMenu}
          className="flex-1 max-w-[240px] flex items-center justify-center gap-1.5 px-2 py-1 rounded-xl bg-slate-950/80 hover:bg-slate-800/90 border border-slate-800 hover:border-amber-500/40 text-slate-200 transition-all group"
        >
          <span className="text-sm shrink-0">{currentActivity.emoji}</span>
          <div className="min-w-0 text-left">
            <div className="flex items-center gap-1">
              <span className="font-extrabold text-[11px] text-amber-400 truncate group-hover:text-amber-300">
                {currentActivity.shortLabel}
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                ({currentIndex + 1}/{activities.length})
              </span>
            </div>
          </div>
          <LayoutGrid className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-400 shrink-0 ml-auto" />
        </button>

        {/* Next / Forward Activity Button */}
        <button
          type="button"
          onClick={handleGoNext}
          disabled={!hasNext}
          title={nextActivity ? `Ir a: ${nextActivity.title}` : 'No hay más actividades'}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl font-bold transition-all ${
            hasNext
              ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 active:scale-95 border border-amber-500/40'
              : 'opacity-30 cursor-not-allowed text-slate-500'
          }`}
        >
          {nextActivity && (
            <span className="hidden md:inline font-normal text-slate-400 max-w-[90px] truncate">
              ({nextActivity.shortLabel})
            </span>
          )}
          <span>Adelante</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Progress dots indicating sequential location */}
      <div className="flex items-center justify-center gap-1 pt-1.5">
        {activities.map((act, idx) => (
          <button
            key={act.id}
            onClick={() => onSelectTab(act.id)}
            title={`Ir a ${act.title}`}
            className={`h-1 rounded-full transition-all duration-200 ${
              idx === currentIndex
                ? 'w-6 bg-amber-400'
                : 'w-2 bg-slate-800 hover:bg-slate-700'
            }`}
          />
        ))}
      </div>
    </div>
  );
};

interface RoleIconMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  role: UserRole;
  activeTab: string;
  onSelectTab: (tabId: string) => void;
  onRestartTour: () => void;
  onChangeRole: () => void;
  onOpenShare?: () => void;
  onOpenFeedback?: () => void;
  onSignOut?: () => void;
}

/**
 * Dedicated Icon Menu (Dashboard View) for the active role.
 * Displays large icon cards with clear descriptions and status badges,
 * allowing instant jump and showing the full breadth of the role's activities.
 */
export const RoleIconMenuModal: React.FC<RoleIconMenuModalProps> = ({
  isOpen,
  onClose,
  role,
  activeTab,
  onSelectTab,
  onRestartTour,
  onChangeRole,
  onOpenShare,
  onOpenFeedback,
  onSignOut,
}) => {
  if (!isOpen) return null;

  const activities = ROLE_ACTIVITIES[role] || ROLE_ACTIVITIES.musico;

  const handleSelectActivity = (tabId: string) => {
    onSelectTab(tabId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-xl shadow-inner">
              {role === 'bar' ? '🍸' : role === 'musico' ? '🎸' : '🎟️'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-slate-100">
                  Menú de Actividades
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  {role === 'bar' ? 'Modo Bar' : role === 'musico' ? 'Modo Músico' : 'Público'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Opciones disponibles para tu rol en DeGira
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-slate-100 flex items-center justify-center text-lg font-bold transition-colors"
          >
            ×
          </button>
        </div>

        {/* Activity Cards Grid */}
        <div className="p-4 sm:p-5 space-y-2.5 max-h-[60vh] overflow-y-auto">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1">
            Navegá hacia adelante o atrás en tus actividades:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {activities.map((activity, idx) => {
              const IconComp = activity.icon;
              const isCurrent = activity.id === activeTab;

              return (
                <button
                  key={activity.id}
                  onClick={() => handleSelectActivity(activity.id)}
                  className={`text-left p-3.5 rounded-2xl border transition-all duration-200 flex flex-col justify-between group ${
                    isCurrent
                      ? 'bg-amber-500/10 border-amber-500/60 shadow-lg shadow-amber-500/10'
                      : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-800/60 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div
                      className={`w-10 h-10 rounded-xl bg-gradient-to-br ${activity.gradient} flex items-center justify-center text-slate-950 font-bold shadow-md shrink-0 group-hover:scale-105 transition-transform`}
                    >
                      <IconComp className="w-5 h-5 text-slate-950 stroke-[2.5]" />
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono text-slate-500">
                        0{idx + 1}
                      </span>
                      {activity.badge && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                          {activity.badge}
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <h3
                        className={`text-xs font-black tracking-tight ${
                          isCurrent ? 'text-amber-400' : 'text-slate-200 group-hover:text-amber-300'
                        }`}
                      >
                        {activity.title}
                      </h3>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                      {activity.description}
                    </p>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] font-bold">
                    <span className={isCurrent ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}>
                      {isCurrent ? '● Activa ahora' : 'Abrir actividad'}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:translate-x-1 group-hover:text-amber-400 transition-all" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer actions: Repetir tour, Cambiar perfil, Compartir, Feedback */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/70 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose();
                onRestartTour();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
              <span>Tour</span>
            </button>

            <button
              onClick={() => {
                onClose();
                onChangeRole();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 font-semibold transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
              <span>Cambiar Rol</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {onOpenShare && (
              <button
                onClick={() => {
                  onClose();
                  onOpenShare();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 font-semibold transition-colors"
                title="Compartir DeGira"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Compartir</span>
              </button>
            )}

            {onOpenFeedback && (
              <button
                onClick={() => {
                  onClose();
                  onOpenFeedback();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition-colors"
                title="Reportar bug o sugerir mejoras"
              >
                <Wrench className="w-3.5 h-3.5 text-amber-400" />
                <span>Feedback</span>
              </button>
            )}

            {onSignOut && (
              <button
                onClick={() => {
                  onClose();
                  onSignOut();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-400 hover:text-red-300 font-semibold transition-colors"
                title="Cerrar sesión e ir a selección de cuenta"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Cerrar sesión</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
