import React from 'react';
import {
  X,
  Star,
  Calendar,
  Clock,
  MapPin,
  Music,
  Lock,
  CheckCircle2,
  ArrowRight,
  Bell,
} from 'lucide-react';
import type { UserRole } from '../../types/index.ts';
import type { PendingReviewItem } from '../../utils/reviewEligibility.ts';
import { formatDateBA } from '../../utils/bookingLogic.ts';

interface PendingReviewsReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  role: UserRole;
  userDisplayName: string;
  availableNow: PendingReviewItem[];
  waitingWindow: PendingReviewItem[];
  onRateItem: (item: PendingReviewItem) => void;
  onGoToPendingTab?: () => void;
}

export const PendingReviewsReminderModal: React.FC<PendingReviewsReminderModalProps> = ({
  isOpen,
  onClose,
  role,
  userDisplayName,
  availableNow,
  waitingWindow,
  onRateItem,
  onGoToPendingTab,
}) => {
  if (!isOpen || (availableNow.length === 0 && waitingWindow.length === 0)) {
    return null;
  }

  const roleLabel =
    role === 'bar' ? 'Anfitrión de Bar' : role === 'musico' ? 'Músico / Banda' : 'Público General';

  const totalPending = availableNow.length + waitingWindow.length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pending-reviews-reminder-title"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
    >
      <div className="w-full max-w-lg bg-slate-900 border border-amber-500/40 rounded-3xl shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {roleLabel}
                </span>
                <span className="text-[11px] text-slate-400 font-semibold">
                  {userDisplayName}
                </span>
              </div>
              <h3
                id="pending-reviews-reminder-title"
                className="text-base sm:text-lg font-extrabold text-slate-100 mt-1 font-display"
              >
                Tenés {totalPending} {totalPending === 1 ? 'calificación pendiente' : 'calificaciones pendientes'}
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                Las calificaciones solo se habilitan <strong className="text-amber-400">2 horas después</strong> de finalizado cada evento.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar recordatorio de calificaciones"
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-100 shrink-0 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body: Detailed Pending Items */}
        <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto">
          {availableNow.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Disponibles para calificar ahora ({availableNow.length})</span>
                </span>
              </div>

              {availableNow.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-2xl bg-slate-950/90 border border-amber-500/40 space-y-3 shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                          <CheckCircle2 className="w-3 h-3" />
                          Habilitada (+2 hs post-evento)
                        </span>
                        {item.eventCode && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                            {item.eventCode}
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm sm:text-base font-bold text-slate-100">
                        {item.title}
                      </h4>
                    </div>
                  </div>

                  {/* Detailed metadata */}
                  <div className="grid grid-cols-1 gap-1.5 text-xs text-slate-300 bg-slate-900/70 p-3 rounded-xl border border-slate-800">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>
                        <strong>{item.venueName}</strong> • {item.venueNeighborhood} ({item.venueAddress})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>
                        Fecha: <strong>{formatDateBA(item.date)}</strong>
                      </span>
                      <span className="text-slate-600">•</span>
                      <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>
                        {item.startTime} a {item.endTime} hs
                      </span>
                    </div>
                    {item.musicianNames.length > 0 && (
                      <div className="flex items-center gap-2">
                        <Music className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>
                          Artistas: <strong>{item.musicianNames.join(', ')}</strong>
                        </span>
                      </div>
                    )}
                    <div className="pt-1 border-t border-slate-800/80 text-[11px] text-amber-300 font-semibold">
                      A calificar: {item.targetSummary}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onRateItem(item)}
                    className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
                  >
                    <Star className="w-4 h-4 fill-slate-950" />
                    <span>Calificar ahora</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {waitingWindow.length > 0 && (
            <div className="space-y-3">
              <div className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                <span>Esperando ventana de 2 horas post-evento ({waitingWindow.length})</span>
              </div>

              {waitingWindow.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2.5 opacity-95"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold">
                        <Lock className="w-3 h-3" />
                        {item.availability.waitLabel}
                      </span>
                      <h4 className="text-sm font-bold text-slate-100 mt-1">{item.title}</h4>
                    </div>
                  </div>

                  <div className="text-xs text-slate-400 space-y-1 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                    <div>
                      Lugar: <strong className="text-slate-200">{item.venueName}</strong> ({item.venueNeighborhood})
                    </div>
                    <div>
                      Horario: <strong className="text-slate-200">{formatDateBA(item.date)} • {item.startTime} a {item.endTime} hs</strong>
                    </div>
                    {item.musicianNames.length > 0 && (
                      <div>
                        Artistas: <strong className="text-slate-200">{item.musicianNames.join(', ')}</strong>
                      </div>
                    )}
                    <div className="text-[11px] text-slate-300">
                      A calificar: {item.targetSummary}
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled
                    className="w-full py-2 px-3 rounded-xl bg-slate-800 text-slate-400 border border-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 cursor-not-allowed"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Habilitada 2 hs tras finalizar ({item.availability.unlockTimeText})</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex flex-wrap items-center justify-between gap-2">
          {onGoToPendingTab && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onGoToPendingTab();
              }}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs transition-colors"
            >
              Ir a Por Calificar
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="ml-auto px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-colors"
          >
            Recordarme más tarde
          </button>
        </div>
      </div>
    </div>
  );
};
