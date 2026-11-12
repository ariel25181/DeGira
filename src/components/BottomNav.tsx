import React from 'react';
import {
  CalendarDays,
  Radio,
  Clock,
  Handshake,
  User,
  Sparkles,
  Ticket,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';

interface BottomNavProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onSelectTab }) => {
  const { role, openCalls, musicianAvailabilities, liveShows } = useApp();

  const openCallsCount = openCalls.filter((c) => c.status === 'abierta').length;
  const availCount = musicianAvailabilities.filter((a) => a.status === 'disponible').length;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-lg border-t border-slate-800/80 px-2 py-1.5 safe-area-bottom">
      {/* 1. ROL: ESPECTADOR (Solo Cartelera y Mi Perfil) */}
      {role === 'espectador' && (
        <div className="max-w-xs mx-auto grid grid-cols-2 gap-2">
          <button
            onClick={() => onSelectTab('cartelera')}
            className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-2xl transition-all ${
              activeTab === 'cartelera'
                ? 'text-amber-400 font-bold bg-amber-500/15 border border-amber-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <CalendarDays className="w-5 h-5 mb-0.5" />
            <span className="text-xs font-bold tracking-tight">Cartelera de Shows</span>
          </button>

          <button
            onClick={() => onSelectTab('perfil')}
            className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-2xl transition-all ${
              activeTab === 'perfil'
                ? 'text-amber-400 font-bold bg-amber-500/15 border border-amber-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <User className="w-5 h-5 mb-0.5" />
            <span className="text-xs font-bold tracking-tight">Mi Perfil & Reservas</span>
          </button>
        </div>
      )}

      {/* 2. ROL: MÚSICO (Convocatorias, Mis Propuestas & Recordatorios, Mi Perfil Musical) */}
      {role === 'musico' && (
        <div className="max-w-sm mx-auto grid grid-cols-3 gap-1.5">
          <button
            onClick={() => onSelectTab('convocatorias')}
            className={`relative flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all ${
              activeTab === 'convocatorias'
                ? 'text-amber-400 font-bold bg-amber-500/15 border border-amber-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Radio className="w-5 h-5 mb-0.5" />
            <span className="text-[11px] font-bold tracking-tight">Convocatorias</span>
            {openCallsCount > 0 && (
              <span className="absolute top-1 right-2.5 w-2 h-2 rounded-full bg-amber-400" />
            )}
          </button>

          <button
            onClick={() => onSelectTab('acuerdos')}
            className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all ${
              activeTab === 'acuerdos'
                ? 'text-amber-400 font-bold bg-amber-500/15 border border-amber-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Handshake className="w-5 h-5 mb-0.5" />
            <span className="text-[11px] font-bold tracking-tight">Mis Propuestas</span>
          </button>

          <button
            onClick={() => onSelectTab('perfil')}
            className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all ${
              activeTab === 'perfil'
                ? 'text-amber-400 font-bold bg-amber-500/15 border border-amber-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <User className="w-5 h-5 mb-0.5" />
            <span className="text-[11px] font-bold tracking-tight">Mi Banda & Rider</span>
          </button>
        </div>
      )}

      {/* 3. ROL: BAR (Mis Eventos & Estados, Postulaciones de Músicos, Mi Bar & Puerta) */}
      {role === 'bar' && (
        <div className="max-w-sm mx-auto grid grid-cols-3 gap-1.5">
          <button
            onClick={() => onSelectTab('convocatorias')}
            className={`relative flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all ${
              activeTab === 'convocatorias'
                ? 'text-amber-400 font-bold bg-amber-500/15 border border-amber-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Radio className="w-5 h-5 mb-0.5" />
            <span className="text-[11px] font-bold tracking-tight">Mis Eventos</span>
          </button>

          <button
            onClick={() => onSelectTab('acuerdos')}
            className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all ${
              activeTab === 'acuerdos'
                ? 'text-amber-400 font-bold bg-amber-500/15 border border-amber-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Handshake className="w-5 h-5 mb-0.5" />
            <span className="text-[11px] font-bold tracking-tight">Postulaciones</span>
          </button>

          <button
            onClick={() => onSelectTab('perfil')}
            className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all ${
              activeTab === 'perfil'
                ? 'text-amber-400 font-bold bg-amber-500/15 border border-amber-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <User className="w-5 h-5 mb-0.5" />
            <span className="text-[11px] font-bold tracking-tight">Mi Bar & Sala</span>
          </button>
        </div>
      )}
    </nav>
  );
};
