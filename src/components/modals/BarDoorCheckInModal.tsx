import React, { useState } from 'react';
import { useApp } from '../../context/AppContext.tsx';
import { X, QrCode, CheckCircle2, AlertTriangle, Search, Users, Clock, ShieldCheck, Ticket } from 'lucide-react';

interface BarDoorCheckInModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BarDoorCheckInModal: React.FC<BarDoorCheckInModalProps> = ({ isOpen, onClose }) => {
  const { currentVenue, publicEventReservations, checkInReservation } = useApp();
  const [inputCode, setInputCode] = useState('');
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    reservation?: any;
  } | null>(null);

  if (!isOpen) return null;

  // Filtrar reservas confirmadas del bar actual
  const venueReservations = publicEventReservations.filter(
    (r) => r.venueId === (currentVenue?.id || 'venue-1') && r.status === 'confirmada'
  );

  const checkedInCount = venueReservations.filter((r) => r.checkInStatus === 'checked_in').length;
  const totalTickets = venueReservations.length;
  const totalPeople = venueReservations.reduce(
    (sum, r) => sum + (r.checkInStatus === 'checked_in' ? r.partySize : 0),
    0
  );

  const handleValidate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputCode.trim()) return;

    const res = checkInReservation(inputCode.trim());
    setResult(res);
    if (res.success) {
      setInputCode('');
    }
  };

  const handleQuickCheckIn = (resCode: string) => {
    const res = checkInReservation(resCode);
    setResult(res);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-amber-500/30 rounded-2xl max-w-2xl w-full p-6 text-white shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
              <QrCode className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Control de Puerta & Check-in QR
                <span className="px-2 py-0.5 text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full">
                  En Vivo
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                {currentVenue?.name || 'Bar Test 1'} • Validación de entradas y pases de acceso
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Métricas rápidas de sala */}
        <div className="grid grid-cols-3 gap-3 my-4">
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3 text-center">
            <div className="text-xs text-slate-400 flex items-center justify-center gap-1">
              <Ticket className="w-3.5 h-3.5 text-amber-400" /> Reservas Pagadas
            </div>
            <div className="text-xl font-bold text-white mt-1">{totalTickets}</div>
          </div>
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3 text-center">
            <div className="text-xs text-slate-400 flex items-center justify-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Ingresados
            </div>
            <div className="text-xl font-bold text-emerald-400 mt-1">
              {checkedInCount} / {totalTickets}
            </div>
          </div>
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3 text-center">
            <div className="text-xs text-slate-400 flex items-center justify-center gap-1">
              <Users className="w-3.5 h-3.5 text-indigo-400" /> Público en Sala
            </div>
            <div className="text-xl font-bold text-indigo-400 mt-1">{totalPeople} pers.</div>
          </div>
        </div>

        {/* Formulario de escaneo / código */}
        <form onSubmit={handleValidate} className="mb-4">
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            Escanear QR o Ingresar Código Oficial de Entrada
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
                placeholder="Pegá el QR o escribí el código (ej. DG-BAR1-7482)"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono text-sm"
                autoFocus
              />
            </div>
            <button
              type="submit"
              className="px-5 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl transition flex items-center gap-2 shrink-0 shadow-lg shadow-amber-500/20"
            >
              <CheckCircle2 className="w-5 h-5" />
              Validar Entrada
            </button>
          </div>
        </form>

        {/* Mensaje de Resultado */}
        {result && (
          <div
            className={`p-4 rounded-xl border mb-4 flex items-start gap-3 transition animate-fadeIn ${
              result.success
                ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
                : 'bg-rose-950/40 border-rose-500/50 text-rose-200'
            }`}
          >
            {result.success ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <p className="font-bold text-sm">{result.message}</p>
              {result.reservation && (
                <div className="mt-2 text-xs grid grid-cols-2 gap-2 p-2.5 bg-black/40 rounded-lg border border-white/10 font-mono">
                  <div>
                    <span className="text-slate-400">Titular:</span> {result.reservation.userName}
                  </div>
                  <div>
                    <span className="text-slate-400">Lugares:</span> {result.reservation.partySize} personas
                  </div>
                  <div>
                    <span className="text-slate-400">Evento:</span> {result.reservation.eventTitle}
                  </div>
                  <div>
                    <span className="text-slate-400">Código:</span> {result.reservation.eventCode}
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={() => setResult(null)}
              className="text-slate-400 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Lista de entradas de la noche */}
        <div className="flex-1 overflow-y-auto pr-1">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>Listado de Entradas Confirmadas para Hoy</span>
            <span className="text-slate-500 font-normal">Click en "Validar" para check-in directo</span>
          </h3>

          <div className="space-y-2">
            {venueReservations.length === 0 ? (
              <div className="p-8 text-center text-slate-500 bg-slate-950/50 rounded-xl border border-slate-800">
                No hay reservas confirmadas pendientes para esta sala.
              </div>
            ) : (
              venueReservations.map((res) => {
                const isChecked = res.checkInStatus === 'checked_in';
                return (
                  <div
                    key={res.id}
                    className={`p-3 rounded-xl border flex items-center justify-between transition ${
                      isChecked
                        ? 'bg-emerald-950/20 border-emerald-500/30 text-slate-300'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm ${
                          isChecked
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                        }`}
                      >
                        {res.partySize}p
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white flex items-center gap-2">
                          {res.userName}
                          {isChecked && (
                            <span className="px-1.5 py-0.5 text-[10px] bg-emerald-500/20 text-emerald-300 rounded border border-emerald-500/30">
                              Ingresó {res.checkedInAt || ''}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                          <span className="font-mono text-amber-400">{res.eventCode}</span>
                          <span>•</span>
                          <span>{res.eventTitle}</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      {isChecked ? (
                        <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold px-3 py-1.5 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                          <CheckCircle2 className="w-4 h-4" />
                          Ingresado
                        </div>
                      ) : (
                        <button
                          onClick={() => handleQuickCheckIn(res.id)}
                          className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg transition shadow flex items-center gap-1.5"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Dar Ingreso
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 mt-2 border-t border-slate-800 flex justify-between items-center text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            Check-in sincronizado en tiempo real con DeGira
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition font-medium"
          >
            Cerrar Control de Puerta
          </button>
        </div>
      </div>
    </div>
  );
};
