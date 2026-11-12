import React, { useState } from 'react';
import {
  Handshake,
  Star,
  CheckCircle,
  Calendar,
  Clock,
  MapPin,
  Music,
  Wine,
  MessageSquare,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Bell,
  RotateCcw,
  AlertTriangle,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { LiveShowConfirmed } from '../types/index.ts';
import { formatARS, formatDateBA } from '../utils/bookingLogic.ts';

interface AgreementsAndReviewsViewProps {
  onOpenReviewModal: (params: {
    targetType: 'musician' | 'venue';
    targetId: string;
    targetName: string;
    showDate: string;
    showVenueName: string;
    showIdToComplete?: string;
  }) => void;
  onViewVenue: (venueId: string) => void;
  onViewMusician: (musicianId: string) => void;
}

export const AgreementsAndReviewsView: React.FC<AgreementsAndReviewsViewProps> = ({
  onOpenReviewModal,
  onViewVenue,
  onViewMusician,
}) => {
  const {
    role,
    currentMusician,
    currentVenue,
    liveShows,
    openCalls,
    musicianAvailabilities,
    eventProposals,
    slotBids,
    sendMusicianProposalReminder,
    retractMusicianSlotBid,
    respondToSlotBid,
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'pending_reviews' | 'upcoming' | 'applications'>('pending_reviews');
  const [retractionFeedback, setRetractionFeedback] = useState<{ id: string; msg: string; success: boolean } | null>(null);

  // Past shows that require review (either musician reviewing venue or venue reviewing musician)
  const pastShowsNeedingReview = liveShows.filter((show) => {
    if (role === 'musico') {
      return show.isCompleted && !show.venueReviewed;
    } else if (role === 'bar') {
      return show.isCompleted && !show.musicianReviewed;
    }
    return show.isCompleted && (!show.venueReviewed || !show.musicianReviewed);
  });

  // Upcoming confirmed shows
  const upcomingShows = liveShows.filter((show) => !show.isCompleted);

  // DeGira: Propuestas enviadas por el músico a bares
  const mySlotBids = slotBids.filter((b) => b.musicianId === currentMusician?.id);

  // Musician's submitted applications across all calls
  const myApplications = openCalls.flatMap((call) =>
    call.applications
      .filter((app) => app.musicianId === currentMusician?.id)
      .map((app) => ({ ...app, callVenue: call.venueName, callDate: call.date, callNeighborhood: call.venueNeighborhood }))
  );

  return (
    <div className="space-y-5 pb-24">
      {/* Banner */}
      <div className="bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden">
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <Handshake className="w-3.5 h-3.5 mr-1" />
            Gestión de Acuerdos & Feedback Bilateral
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-100 font-display">
            Mis Fechas & Reputación Bilateral
          </h1>
          <p className="text-xs text-slate-400 max-w-md leading-relaxed">
            Al estilo Airbnb, tras finalizar cada show, bares y músicos dejan calificaciones y comentarios honestos para nutrir la reputación mutua.
          </p>
        </div>
      </div>

      {/* Sub tabs switcher */}
      <div className="flex bg-slate-900 p-1 rounded-2xl border border-slate-800 text-xs">
        <button
          onClick={() => setActiveSubTab('pending_reviews')}
          className={`flex-1 py-2 px-1 sm:px-2 rounded-xl font-bold flex items-center justify-center space-x-1 transition-all ${
            activeSubTab === 'pending_reviews'
              ? 'bg-amber-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Star className="w-3.5 h-3.5 shrink-0" />
          <span>Por Calificar</span>
          {pastShowsNeedingReview.length > 0 && (
            <span
              className={`w-4 h-4 rounded-full text-[10px] font-black flex items-center justify-center shrink-0 ${
                activeSubTab === 'pending_reviews' ? 'bg-slate-950 text-amber-400' : 'bg-amber-500 text-slate-950'
              }`}
            >
              {pastShowsNeedingReview.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab('upcoming')}
          className={`flex-1 py-2 px-1 sm:px-2 rounded-xl font-bold flex items-center justify-center space-x-1 transition-all ${
            activeSubTab === 'upcoming'
              ? 'bg-amber-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Calendar className="w-3.5 h-3.5 shrink-0" />
          <span>Confirmadas</span>
          <span className="text-[10px] text-slate-400">({upcomingShows.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('applications')}
          className={`flex-1 py-2 px-1 sm:px-2 rounded-xl font-bold flex items-center justify-center space-x-1 transition-all ${
            activeSubTab === 'applications'
              ? 'bg-amber-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5 shrink-0" />
          <span>Postulaciones</span>
        </button>
      </div>

      {/* SubTab 1: Calificaciones Pendientes Post-Show (Airbnb-style) */}
      {activeSubTab === 'pending_reviews' && (
        <div className="space-y-4">
          <div className="bg-amber-950/20 border border-amber-900/40 rounded-2xl p-4 flex items-start space-x-3 text-xs text-amber-200/90 leading-relaxed">
            <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-300 mb-0.5">
                Sistema de Reputación Bilateral Cerrado
              </p>
              <p className="text-slate-300">
                Solo quienes hayan acordado y finalizado una fecha en DeGira pueden calificarse mutuamente (puntualidad en el pago, sonido, camarín, trato y convocatoria).
              </p>
            </div>
          </div>

          {pastShowsNeedingReview.length === 0 ? (
            <div className="text-center py-12 bg-slate-900/40 rounded-2xl border border-slate-800 p-6 space-y-2">
              <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-1" />
              <p className="text-slate-200 font-bold">¡Estás al día con todas las calificaciones!</p>
              <p className="text-xs text-slate-400">
                Cuando finalice tu próximo show, aparecerá aquí para que puedas darle feedback a la contraparte.
              </p>
            </div>
          ) : (
            pastShowsNeedingReview.map((show) => {
              const targetIsVenue = role === 'musico';
              const targetName = targetIsVenue ? show.venueName : show.musicianName;
              const targetId = targetIsVenue ? show.venueId : show.musicianId;

              return (
                <div
                  key={show.id}
                  className="bg-slate-900 border-2 border-amber-500/40 rounded-2xl p-5 shadow-lg space-y-4 relative overflow-hidden"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40">
                        ⭐ Show Finalizado • Calificación Pendiente
                      </div>
                      <h3 className="text-lg font-bold text-slate-100 font-display">
                        Fecha del {formatDateBA(show.date)} en {show.venueName}
                      </h3>
                      <p className="text-xs text-slate-400">
                        Artista: <strong>{show.musicianName}</strong> ({show.musicianFormat})
                      </p>
                    </div>

                    <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-slate-700">
                      <img
                        src={show.venuePhoto}
                        alt={show.venueName}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 text-xs space-y-1 text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Bar Anfitrión:</span>
                      <span className="font-semibold text-slate-200">
                        {show.venueName} ({show.venueNeighborhood})
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Banda / Músico:</span>
                      <span className="font-semibold text-slate-200">{show.musicianName}</span>
                    </div>
                  </div>

                  <div className="pt-1 flex items-center gap-2">
                    <button
                      onClick={() =>
                        onOpenReviewModal({
                          targetType: targetIsVenue ? 'venue' : 'musician',
                          targetId,
                          targetName,
                          showDate: show.date,
                          showVenueName: show.venueName,
                          showIdToComplete: show.id,
                        })
                      }
                      className="flex-1 py-3 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl text-xs shadow-md transition-all flex items-center justify-center space-x-2"
                    >
                      <Star className="w-4 h-4 fill-slate-950" />
                      <span>Calificar a {targetName} estilo Airbnb</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* SubTab 2: Próximas Fechas Confirmadas */}
      {activeSubTab === 'upcoming' && (
        <div className="space-y-4">
          {upcomingShows.length === 0 ? (
            <div className="text-center py-12 bg-slate-900/40 rounded-2xl border border-slate-800 p-6 space-y-2">
              <p className="text-slate-300 font-medium">No tenés fechas próximas acordadas.</p>
              <p className="text-xs text-slate-500">
                Revisá las convocatorias abiertas de bares o publicá tu disponibilidad.
              </p>
            </div>
          ) : (
            upcomingShows.map((show) => (
              <div
                key={show.id}
                className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-md space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center space-x-3">
                    <img
                      src={show.venuePhoto}
                      alt={show.venueName}
                      className="w-12 h-12 rounded-xl object-cover border border-slate-700"
                    />
                    <div>
                      <h3 className="font-bold text-slate-100 text-base font-display">
                        {show.musicianName} en {show.venueName}
                      </h3>
                      <div className="text-xs text-slate-400 flex items-center space-x-1 mt-0.5">
                        <MapPin className="w-3.5 h-3.5 text-amber-400" />
                        <span>{show.venueAddress}, {show.venueNeighborhood}</span>
                      </div>
                    </div>
                  </div>

                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                    Confirmado en Cartelera
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-950/70 rounded-xl border border-slate-800 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Fecha del Show</span>
                    <span className="font-bold text-slate-200">{formatDateBA(show.date)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Horario</span>
                    <span className="font-bold text-amber-400">{show.time}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                  <span>Géneros: {show.musicianGenres.join(', ')}</span>
                  <button
                    onClick={() => onViewVenue(show.venueId)}
                    className="text-amber-400 hover:text-amber-300 font-semibold underline"
                  >
                    Ver info del Bar
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* SubTab 3: Propuestas y Postulaciones Enviadas a Bares */}
      {activeSubTab === 'applications' && (
        <div className="space-y-4">
          <div className="text-xs text-slate-400">
            Seguimiento de las propuestas de fecha que enviaste a bares de Buenos Aires (recordatorios, retracciones y contraofertas):
          </div>

          {/* Feedback toast for retraction */}
          {retractionFeedback && (
            <div
              className={`p-3 rounded-xl text-xs font-semibold flex items-center justify-between animate-in fade-in ${
                retractionFeedback.success
                  ? 'bg-emerald-950/80 border border-emerald-500/40 text-emerald-200'
                  : 'bg-rose-950/80 border border-rose-500/40 text-rose-200'
              }`}
            >
              <span>{retractionFeedback.msg}</span>
              <button
                onClick={() => setRetractionFeedback(null)}
                className="text-[10px] uppercase font-bold underline ml-2"
              >
                Cerrar
              </button>
            </div>
          )}

          {mySlotBids.length === 0 && myApplications.length === 0 ? (
            <div className="text-center py-12 bg-slate-900/40 rounded-2xl border border-slate-800 p-6 space-y-2">
              <p className="text-slate-300 font-medium">No enviaste propuestas todavía.</p>
              <p className="text-xs text-slate-500">
                Mirá la pestaña de "Convocatorias" y postulate a los horarios de show que te interesen.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* DeGira Slot Bids */}
              {mySlotBids.map((bid) => {
                const event = eventProposals.find((e) => e.id === bid.eventId);
                const slot = event?.slots.find((s) => s.id === bid.slotId);
                const eventStartTime = slot?.startTime || event?.startTime || '21:00';
                const eventDateStr = event?.date || '2026-11-28';
                const eventDateTime = new Date(`${eventDateStr}T${eventStartTime}`).getTime();
                const now = Date.now();
                const hoursRemaining = (eventDateTime - now) / (1000 * 60 * 60);
                const canRetract = hoursRemaining >= 24 && !bid.retracted && bid.status !== 'rechazada';

                // Check clash with another active bid of this musician
                const hasClash = mySlotBids.some(
                  (other) =>
                    other.id !== bid.id &&
                    !other.retracted &&
                    other.status !== 'rechazada' &&
                    eventProposals.find((ev) => ev.id === other.eventId)?.date === eventDateStr
                );

                return (
                  <div
                    key={bid.id}
                    className={`bg-slate-900/90 border rounded-2xl p-4 sm:p-5 space-y-3 shadow-md ${
                      bid.status === 'aceptada'
                        ? 'border-emerald-500/40'
                        : bid.retracted
                        ? 'border-slate-800 opacity-60'
                        : hasClash
                        ? 'border-amber-500/40'
                        : 'border-slate-800'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-slate-100 text-sm font-display">
                            {event?.title || 'Propuesta de Evento Musical'}
                          </h4>
                          {hasClash && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 border border-amber-500/40 text-amber-300">
                              <AlertTriangle className="w-3 h-3 text-amber-400" />
                              <span>Clash detectado en fecha</span>
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 flex items-center space-x-1.5 mt-0.5">
                          <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>
                            {event?.venueName} • {event?.venueNeighborhood}
                          </span>
                        </div>
                      </div>

                      {/* Status badge */}
                      <div>
                        <span
                          className={`px-2.5 py-1 rounded-full font-bold text-[10px] inline-block uppercase border ${
                            bid.status === 'aceptada'
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                              : bid.retracted
                              ? 'bg-slate-800 text-slate-400 border-slate-700'
                              : bid.status === 'contraoferta_bar'
                              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 animate-pulse'
                              : bid.status === 'rechazada'
                              ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                              : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                          }`}
                        >
                          {bid.retracted
                            ? 'Retractada por vos'
                            : bid.status === 'aceptada'
                            ? 'Aceptada por el Bar'
                            : bid.status === 'contraoferta_bar'
                            ? 'Contraoferta del Bar'
                            : bid.status === 'rechazada'
                            ? 'Rechazada'
                            : 'Pendiente de Respuesta'}
                        </span>
                      </div>
                    </div>

                    {/* Schedule & Cachet info */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 bg-slate-950/70 rounded-xl border border-slate-800 text-xs">
                      <div>
                        <span className="text-slate-400 text-[10px] uppercase font-semibold block">Fecha</span>
                        <strong className="text-slate-200">{formatDateBA(eventDateStr)}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] uppercase font-semibold block">Horario Slot</span>
                        <strong className="text-amber-400 font-bold">
                          {slot ? `${slot.startTime} a ${slot.endTime} hs` : eventStartTime}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] uppercase font-semibold block">Caché Propuesto</span>
                        <strong className="text-emerald-400 font-black">{formatARS(bid.proposedCachetARS)}</strong>
                      </div>
                    </div>

                    {/* Equipment Details */}
                    <div className="text-[11px] text-slate-400 space-y-0.5">
                      <div>Llevás: <strong className="text-slate-300">{bid.equipmentProvided}</strong></div>
                      <div>Pedís al bar: <strong className="text-slate-300">{bid.equipmentNeeded}</strong></div>
                    </div>

                    {/* Reminder & Retract Actions */}
                    {!bid.retracted && bid.status !== 'rechazada' && (
                      <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
                        {/* Reminder Button */}
                        {bid.status === 'pendiente_bar' && (
                          <button
                            onClick={() => {
                              const res = sendMusicianProposalReminder(bid.id);
                              setRetractionFeedback({ id: bid.id, msg: res.message, success: res.success });
                            }}
                            className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5 transition-colors"
                          >
                            <Bell className="w-3.5 h-3.5" />
                            <span>
                              {bid.reminderCount
                                ? `Recordatorio enviado (${bid.reminderCount})`
                                : 'Enviar Recordatorio al Bar'}
                            </span>
                          </button>
                        )}

                        {/* Counteroffer responses */}
                        {bid.status === 'contraoferta_bar' && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-cyan-300 font-bold">
                              Contraoferta: {formatARS(bid.proposedCachetARS)}
                            </span>
                            <button
                              onClick={() => respondToSlotBid(bid.id, 'accept', bid.proposedCachetARS, 'Contraoferta aceptada por el músico.')}
                              className="px-3 py-1 bg-emerald-500 text-slate-950 font-bold rounded-lg text-xs"
                            >
                              Aceptar
                            </button>
                            <button
                              onClick={() => respondToSlotBid(bid.id, 'reject', undefined, 'Rechazada por el músico.')}
                              className="px-2.5 py-1 bg-slate-800 text-rose-400 rounded-lg text-xs"
                            >
                              Rechazar
                            </button>
                          </div>
                        )}

                        {/* Retraction button enforcing 24h rule */}
                        <div>
                          {canRetract ? (
                            <button
                              onClick={() => {
                                if (window.confirm('¿Seguro que querés retractarte de esta propuesta? El slot quedará libre para otros músicos.')) {
                                  const res = retractMusicianSlotBid(bid.id);
                                  setRetractionFeedback({ id: bid.id, msg: res.message, success: res.success });
                                }
                              }}
                              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-900/30 text-rose-300 border border-slate-700 hover:border-rose-500/40 text-xs font-semibold flex items-center gap-1 transition-all"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Retractarme (hasta 24hs antes)</span>
                            </button>
                          ) : (
                            <span
                              className="text-[11px] text-slate-500 italic flex items-center gap-1 cursor-not-allowed"
                              title="La app prohíbe retractarse con menos de 24 horas de antelación al inicio del show"
                            >
                              <Clock className="w-3.5 h-3.5 text-slate-600" />
                              <span>Retracción no disponible (faltan &lt; 24hs para el show)</span>
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Legacy applications */}
              {myApplications.map((app) => (
                <div
                  key={app.id}
                  className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-2.5 text-xs"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-bold text-slate-100 text-sm">{app.callVenue}</div>
                      <div className="text-slate-400">
                        Fecha: {formatDateBA(app.callDate)} ({app.callNeighborhood})
                      </div>
                    </div>

                    <span
                      className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                        app.status === 'aceptada'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : app.status === 'rechazada'
                          ? 'bg-rose-500/20 text-rose-400'
                          : 'bg-amber-500/20 text-amber-400'
                      }`}
                    >
                      {app.status === 'aceptada'
                        ? 'Aceptada & Confirmada'
                        : app.status === 'rechazada'
                        ? 'No seleccionada'
                        : 'En evaluación por el bar'}
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-950/60 rounded-xl border border-slate-800/80 text-slate-300 italic">
                    "{app.note}"
                  </div>

                  <div className="flex justify-between items-center text-[11px] text-slate-400 pt-1 border-t border-slate-800">
                    <span>Caché propuesto: <strong className="text-emerald-400">{formatARS(app.proposedCachetARS)}</strong></span>
                    <span>Demo: {app.demoTrackTitle}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
