import React, { useState, useEffect } from 'react';
import {
  Handshake,
  Star,
  CheckCircle,
  Calendar,
  Clock,
  MapPin,
  MessageSquare,
  ShieldCheck,
  Bell,
  RotateCcw,
  AlertTriangle,
  Check,
  Headphones,
  ExternalLink,
  Sliders,
  Users,
  Lock,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { formatARS, formatDateBA } from '../utils/bookingLogic.ts';
import { getPendingReviewsForRole } from '../utils/reviewEligibility.ts';
import type { EventProposal } from '../types/index.ts';

interface AgreementsAndReviewsViewProps {
  onOpenReviewModal: (params: {
    targetType: 'musician' | 'venue';
    targetId: string;
    targetName: string;
    showDate: string;
    showVenueName: string;
    showIdToComplete?: string;
    showStartTime?: string;
    showEndTime?: string;
  }) => void;
  onOpenReview360?: (event: EventProposal) => void;
  onViewVenue: (venueId: string) => void;
  onViewMusician: (musicianId: string) => void;
}

type AgreementsSubTab = 'bar_bids' | 'pending_reviews' | 'upcoming' | 'applications';

export const AgreementsAndReviewsView: React.FC<AgreementsAndReviewsViewProps> = ({
  onOpenReviewModal,
  onOpenReview360,
  onViewVenue,
  onViewMusician,
}) => {
  const {
    role,
    venues,
    currentMusician,
    currentVenue,
    activeMusicianId,
    activeVenueId,
    liveShows,
    openCalls,
    eventProposals,
    publicEventReservations,
    reviews360,
    slotBids,
    sendMusicianProposalReminder,
    retractMusicianSlotBid,
    respondToSlotBid,
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<AgreementsSubTab>(() =>
    role === 'bar' ? 'bar_bids' : 'pending_reviews'
  );
  const [retractionFeedback, setRetractionFeedback] = useState<{
    id: string;
    msg: string;
    success: boolean;
  } | null>(null);
  const [counterInputId, setCounterInputId] = useState<string | null>(null);
  const [counterAmount, setCounterAmount] = useState<number>(80000);
  const [counterNote, setCounterNote] = useState<string>('');

  // Keep sub-tabs strictly scoped to the active role (bar vs musico)
  useEffect(() => {
    setActiveSubTab(role === 'bar' ? 'bar_bids' : 'pending_reviews');
  }, [role]);

  const isBar = role === 'bar';

  // Pending ended shows & events needing review (strict 2-hour post-event lock)
  const pendingSummary = getPendingReviewsForRole({
    role,
    activeVenueId,
    activeMusicianId,
    eventProposals,
    liveShows,
    publicEventReservations,
    reviews360,
  });
  const pendingReviewItems = pendingSummary.allEndedPending;
  const availableReviewsCount = pendingSummary.availableNow.length;

  // Upcoming confirmed shows scoped by role
  const upcomingShows = liveShows.filter((show) => !show.isCompleted);

  // Bar-only: incoming slot bids for Bar's event proposals
  const barVenueIds = new Set([
    ...(currentVenue ? [currentVenue.id] : []),
    ...venues.map((v) => v.id),
  ]);
  const incomingBarBids = slotBids.filter((bid) => {
    if (bid.retracted) return false;
    const ev = eventProposals.find((e) => e.id === bid.eventId);
    if (!ev) return false;
    return barVenueIds.size === 0 || barVenueIds.has(ev.venueId);
  });
  const pendingBarBidsCount = incomingBarBids.filter(
    (b) => b.status === 'pendiente_bar' || b.status === 'contraoferta_musico'
  ).length;

  // Bar-only: legacy open-call applications received by Bar venues
  const incomingOpenCallApps = openCalls
    .filter((call) => barVenueIds.size === 0 || barVenueIds.has(call.venueId))
    .flatMap((call) =>
      call.applications.map((app) => ({
        ...app,
        callVenue: call.venueName,
        callDate: call.date,
        callNeighborhood: call.venueNeighborhood,
      }))
    );

  // Musician-only: bids & applications sent to bars
  const mySlotBids = slotBids.filter((b) => b.musicianId === currentMusician?.id);
  const myApplications = openCalls.flatMap((call) =>
    call.applications
      .filter((app) => app.musicianId === currentMusician?.id)
      .map((app) => ({
        ...app,
        callVenue: call.venueName,
        callDate: call.date,
        callNeighborhood: call.venueNeighborhood,
      }))
  );

  return (
    <div className="space-y-5 pb-24">
      {/* Banner */}
      <div className="bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden">
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <Handshake className="w-3.5 h-3.5 mr-1" />
            {isBar
              ? 'Gestión de Postulaciones de Músicos & Sala'
              : 'Gestión de Acuerdos & Feedback Bilateral'}
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-100 font-display">
            {isBar
              ? 'Postulaciones Recibidas & Fechas del Bar'
              : 'Mis Fechas & Reputación Bilateral'}
          </h1>
          <p className="text-xs text-slate-400 max-w-md leading-relaxed">
            {isBar
              ? 'Revisá las propuestas de bandas y solistas que se postularon a tus eventos, negociá el caché o contraofertá, y calificá tus shows finalizados.'
              : 'Al estilo Airbnb, tras finalizar cada show, bares y músicos dejan calificaciones y comentarios honestos para nutrir la reputación mutua.'}
          </p>
        </div>
      </div>

      {/* Role-strict sub-tabs switcher */}
      {isBar ? (
        <div className="flex bg-slate-900 p-1 rounded-2xl border border-slate-800 text-xs">
          <button
            onClick={() => setActiveSubTab('bar_bids')}
            className={`flex-1 py-2 px-1 sm:px-2 rounded-xl font-bold flex items-center justify-center space-x-1 transition-all ${
              activeSubTab === 'bar_bids'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5 shrink-0" />
            <span>Postulaciones Recibidas</span>
            {(pendingBarBidsCount > 0 || incomingBarBids.length > 0) && (
              <span
                className={`w-4 h-4 rounded-full text-[10px] font-black flex items-center justify-center shrink-0 ${
                  activeSubTab === 'bar_bids'
                    ? 'bg-slate-950 text-amber-400'
                    : 'bg-amber-500 text-slate-950'
                }`}
              >
                {pendingBarBidsCount || incomingBarBids.length}
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
            <span className="text-[10px] opacity-80">({upcomingShows.length})</span>
          </button>

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
            {pendingReviewItems.length > 0 && (
              <span
                className={`w-4 h-4 rounded-full text-[10px] font-black flex items-center justify-center shrink-0 ${
                  activeSubTab === 'pending_reviews'
                    ? 'bg-slate-950 text-amber-400'
                    : 'bg-amber-500 text-slate-950'
                }`}
              >
                {availableReviewsCount || pendingReviewItems.length}
              </span>
            )}
          </button>
        </div>
      ) : (
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
            {pendingReviewItems.length > 0 && (
              <span
                className={`w-4 h-4 rounded-full text-[10px] font-black flex items-center justify-center shrink-0 ${
                  activeSubTab === 'pending_reviews'
                    ? 'bg-slate-950 text-amber-400'
                    : 'bg-amber-500 text-slate-950'
                }`}
              >
                {availableReviewsCount || pendingReviewItems.length}
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
            <span className="text-[10px] opacity-80">({upcomingShows.length})</span>
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
            <span>Mis Postulaciones</span>
          </button>
        </div>
      )}

      {/* BAR SUBTAB: Postulaciones Recibidas de Músicos */}
      {isBar && activeSubTab === 'bar_bids' && (
        <div className="space-y-4">
          <div className="text-xs text-slate-400">
            Propuestas recibidas de músicos y bandas para tocar en tus fechas creadas ({currentVenue?.name || 'Tu Bar'}):
          </div>

          {incomingBarBids.length === 0 && incomingOpenCallApps.length === 0 ? (
            <div className="text-center py-12 bg-slate-900/40 rounded-2xl border border-slate-800 p-6 space-y-2">
              <Users className="w-8 h-8 text-amber-400 mx-auto mb-1" />
              <p className="text-slate-200 font-bold">Todavía no recibiste postulaciones de músicos.</p>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Creá o abrí una fecha en la pestaña "Mis Eventos" para que bandas y solistas puedan postularse a tus horarios.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {incomingBarBids.map((bid) => {
                const event = eventProposals.find((e) => e.id === bid.eventId);
                const slot = event?.slots.find((s) => s.id === bid.slotId);
                const isCounteringThis = counterInputId === bid.id;

                return (
                  <div
                    key={bid.id}
                    className={`p-4 sm:p-5 rounded-2xl border text-xs space-y-3 shadow-md ${
                      bid.status === 'aceptada'
                        ? 'bg-emerald-950/20 border-emerald-500/40'
                        : bid.status === 'rechazada'
                        ? 'bg-slate-900/60 border-slate-800 opacity-70'
                        : 'bg-slate-900/90 border-slate-800'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div>
                        <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wide">
                          {event?.title || 'Evento del Bar'} • {event?.venueName}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <h4 className="font-extrabold text-sm text-slate-100">
                            {bid.musicianName}
                          </h4>
                          <span className="text-[11px] text-slate-400">
                            ({bid.musiciansCount} {bid.musiciansCount === 1 ? 'músico' : 'músicos'} en escenario)
                          </span>
                          <button
                            onClick={() => onViewMusician(bid.musicianId)}
                            className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold underline"
                          >
                            Ver perfil del Músico
                          </button>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2">
                          <span>Fecha: <strong className="text-slate-200">{formatDateBA(event?.date || '')}</strong></span>
                          {slot && (
                            <span>• Horario: <strong className="text-amber-300">{slot.startTime} a {slot.endTime} hs</strong></span>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-extrabold text-emerald-400 text-sm block">
                          {formatARS(bid.proposedCachetARS)}
                        </span>
                        <span
                          className={`mt-1 px-2.5 py-0.5 rounded-full font-bold text-[10px] inline-block uppercase border ${
                            bid.status === 'aceptada'
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                              : bid.status === 'contraoferta_bar'
                              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                              : bid.status === 'contraoferta_musico'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              : bid.status === 'rechazada'
                              ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                              : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                          }`}
                        >
                          {bid.status === 'aceptada'
                            ? 'Aceptada'
                            : bid.status === 'contraoferta_bar'
                            ? 'Esperando al Músico'
                            : bid.status === 'contraoferta_musico'
                            ? 'Contraoferta del Músico'
                            : bid.status === 'rechazada'
                            ? 'Rechazada'
                            : 'Pendiente de Revisión'}
                        </span>
                      </div>
                    </div>

                    <div className="p-2.5 bg-slate-950/70 rounded-xl border border-slate-800 space-y-1 text-[11px]">
                      <div className="text-slate-400">
                        Equipamiento del músico: <strong className="text-slate-200">{bid.equipmentProvided}</strong>
                      </div>
                      <div className="text-slate-400">
                        Requerimiento para la sala: <strong className="text-slate-200">{bid.equipmentNeeded}</strong>
                      </div>
                    </div>

                    {(bid.musicLinks?.spotifyUrl || bid.musicLinks?.youtubeUrl || bid.musicLinks?.bandcampUrl) && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                          <Headphones className="w-3 h-3 text-emerald-400" />
                          Escuchar demo:
                        </span>
                        {bid.musicLinks?.spotifyUrl && (
                          <a
                            href={bid.musicLinks.spotifyUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-0.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded text-[10px] font-bold flex items-center gap-0.5"
                          >
                            <span>Spotify</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                        {bid.musicLinks?.youtubeUrl && (
                          <a
                            href={bid.musicLinks.youtubeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-0.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded text-[10px] font-bold flex items-center gap-0.5"
                          >
                            <span>YouTube</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                        {bid.musicLinks?.bandcampUrl && (
                          <a
                            href={bid.musicLinks.bandcampUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-0.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 rounded text-[10px] font-bold flex items-center gap-0.5"
                          >
                            <span>Bandcamp</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                    )}

                    {bid.inputList && bid.inputList.length > 0 && (
                      <div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Sliders className="w-3 h-3 text-amber-400" />
                          <span>Input List ({bid.inputList.length} canales):</span>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {bid.inputList.map((ch, idx) => (
                            <span
                              key={idx}
                              className="px-1.5 py-0.5 bg-slate-950 border border-slate-800 text-[10px] text-slate-300 rounded font-mono"
                            >
                              Ch{ch.channel}: {ch.instrument} ({ch.micOrDI})
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {bid.history.length > 0 && (
                      <div className="space-y-1 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800 text-[11px]">
                        {bid.history.map((h) => (
                          <div key={h.id} className="text-slate-300">
                            <strong className="text-amber-400">{h.actorName}:</strong> {h.note} ({formatARS(h.cachetARS)})
                          </div>
                        ))}
                      </div>
                    )}

                    {bid.status !== 'aceptada' && bid.status !== 'rechazada' && (
                      <div className="space-y-2 pt-2 border-t border-slate-800">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={() =>
                              respondToSlotBid(bid.id, 'accept', bid.proposedCachetARS, 'Propuesta aceptada por el bar.')
                            }
                            className="flex-1 py-2 px-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs flex items-center justify-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                            <span>Aceptar Propuesta</span>
                          </button>

                          <button
                            onClick={() => {
                              setCounterAmount(bid.proposedCachetARS);
                              setCounterNote('');
                              setCounterInputId(isCounteringThis ? null : bid.id);
                            }}
                            className="py-2 px-3 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-semibold rounded-lg text-xs"
                          >
                            Contraproponer
                          </button>

                          <button
                            onClick={() =>
                              respondToSlotBid(bid.id, 'reject', undefined, 'Rechazada por el anfitrión.')
                            }
                            className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-rose-400 font-semibold rounded-lg text-xs"
                          >
                            Rechazar
                          </button>
                        </div>

                        {isCounteringThis && (
                          <div className="p-3 bg-slate-950 rounded-xl border border-amber-500/40 space-y-2 animate-in fade-in">
                            <div className="flex items-center gap-2">
                              <label className="text-[11px] text-slate-400">Nuevo monto caché:</label>
                              <input
                                type="number"
                                step={5000}
                                value={counterAmount}
                                onChange={(e) => setCounterAmount(Number(e.target.value))}
                                className="px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs text-amber-400 font-bold"
                              />
                            </div>
                            <input
                              type="text"
                              placeholder="Nota de contrapropuesta para el músico..."
                              value={counterNote}
                              onChange={(e) => setCounterNote(e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100"
                            />
                            <button
                              onClick={() => {
                                respondToSlotBid(
                                  bid.id,
                                  'counter',
                                  counterAmount,
                                  counterNote || 'Contraoferta enviada por el bar.'
                                );
                                setCounterInputId(null);
                              }}
                              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs"
                            >
                              Enviar Contraoferta al Músico
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {incomingOpenCallApps.map((app) => (
                <div
                  key={app.id}
                  className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-2.5 text-xs"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-bold text-slate-100 text-sm">{app.musicianName}</div>
                      <div className="text-slate-400">
                        Para {app.callVenue} • Fecha: {formatDateBA(app.callDate)} ({app.callNeighborhood})
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
                        ? 'Rechazada'
                        : 'Pendiente de Revisión'}
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-950/60 rounded-xl border border-slate-800/80 text-slate-300 italic">
                    "{app.note}"
                  </div>

                  <div className="flex justify-between items-center text-[11px] text-slate-400 pt-1 border-t border-slate-800">
                    <span>Caché solicitado: <strong className="text-emerald-400">{formatARS(app.proposedCachetARS)}</strong></span>
                    <button
                      onClick={() => onViewMusician(app.musicianId)}
                      className="text-amber-400 hover:text-amber-300 font-semibold underline"
                    >
                      Ver perfil del Músico
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SubTab: Calificaciones Pendientes Post-Show (habilitadas 2hs tras finalizar) */}
      {activeSubTab === 'pending_reviews' && (
        <div className="space-y-4">
          <div className="bg-amber-950/20 border border-amber-900/40 rounded-2xl p-4 flex items-start space-x-3 text-xs text-amber-200/90 leading-relaxed">
            <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-300 mb-0.5">
                Sistema de Reputación Bilateral Cerrado (Ventana 2 hs post-show)
              </p>
              <p className="text-slate-300">
                Solo quienes hayan acordado y finalizado un evento en DeGira pueden calificarse mutuamente, y las calificaciones se habilitan estrictamente <strong className="text-amber-300">2 horas después</strong> de finalizado el show.
              </p>
            </div>
          </div>

          {pendingReviewItems.length === 0 ? (
            <div className="text-center py-12 bg-slate-900/40 rounded-2xl border border-slate-800 p-6 space-y-2">
              <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-1" />
              <p className="text-slate-200 font-bold">¡Estás al día con todas las calificaciones!</p>
              <p className="text-xs text-slate-400">
                Cuando finalice tu próximo show y pasen 2 horas desde el cierre, aparecerá aquí para que puedas darle feedback a la contraparte.
              </p>
            </div>
          ) : (
            pendingReviewItems.map((item) => {
              const isUnlocked = item.availability.isAvailable;
              const targetIsVenue = role === 'musico';
              const targetName = targetIsVenue
                ? item.venueName
                : item.musicianNames.join(', ') || 'Músicos';

              return (
                <div
                  key={item.id}
                  className={`bg-slate-900 border-2 rounded-2xl p-5 shadow-lg space-y-4 relative overflow-hidden ${
                    isUnlocked ? 'border-amber-500/40' : 'border-slate-800 opacity-95'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div
                        className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          isUnlocked
                            ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                            : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                        }`}
                      >
                        {!isUnlocked && <Lock className="w-3 h-3 mr-0.5" />}
                        <span>
                          {isUnlocked
                            ? '⭐ Show Finalizado (+2 hs) • Calificación Pendiente'
                            : item.availability.waitLabel}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-slate-100 font-display">
                        {item.title}
                      </h3>
                      <p className="text-xs text-slate-400">
                        {formatDateBA(item.date)} • {item.startTime} a {item.endTime} hs • {item.venueName}
                      </p>
                    </div>

                    {item.venuePhoto && (
                      <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-slate-700">
                        <img
                          src={item.venuePhoto}
                          alt={item.venueName}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                  </div>

                  <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 text-xs space-y-1 text-slate-300">
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-400">Bar Anfitrión:</span>
                      <span className="font-semibold text-slate-200 text-right">
                        {item.venueName} ({item.venueNeighborhood})
                      </span>
                    </div>
                    {item.musicianNames.length > 0 && (
                      <div className="flex justify-between gap-2">
                        <span className="text-slate-400">Banda / Músico:</span>
                        <span className="font-semibold text-slate-200 text-right">
                          {item.musicianNames.join(', ')}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-400">A calificar:</span>
                      <span className="font-semibold text-amber-300 text-right">
                        {item.targetSummary}
                      </span>
                    </div>
                  </div>

                  <div className="pt-1 flex items-center gap-2">
                    {isUnlocked ? (
                      <button
                        onClick={() => {
                          if (item.eventProposal && onOpenReview360) {
                            onOpenReview360(item.eventProposal);
                          } else {
                            onOpenReviewModal(
                              item.reviewModalParams || {
                                targetType: targetIsVenue ? 'venue' : 'musician',
                                targetId: targetIsVenue
                                  ? item.venueId
                                  : item.musicianIds[0] || 'mus-1',
                                targetName,
                                showDate: item.date,
                                showVenueName: item.venueName,
                                showIdToComplete: item.eventId,
                                showStartTime: item.startTime,
                                showEndTime: item.endTime,
                              }
                            );
                          }
                        }}
                        className="flex-1 py-3 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl text-xs shadow-md transition-all flex items-center justify-center space-x-2"
                      >
                        <Star className="w-4 h-4 fill-slate-950" />
                        <span>Calificar a {targetName}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="flex-1 py-3 px-4 bg-slate-800 text-slate-400 border border-slate-700 font-bold rounded-xl text-xs flex items-center justify-center space-x-2 cursor-not-allowed"
                      >
                        <Lock className="w-4 h-4" />
                        <span>Se habilita 2 hs tras finalizar ({item.availability.unlockTimeText})</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* SubTab: Próximas Fechas Confirmadas */}
      {activeSubTab === 'upcoming' && (
        <div className="space-y-4">
          {upcomingShows.length === 0 ? (
            <div className="text-center py-12 bg-slate-900/40 rounded-2xl border border-slate-800 p-6 space-y-2">
              <p className="text-slate-300 font-medium">No tenés fechas próximas acordadas.</p>
              <p className="text-xs text-slate-500">
                {isBar
                  ? 'Aceptá una postulación en "Postulaciones Recibidas" o publicá una nueva fecha en "Mis Eventos".'
                  : 'Revisá las convocatorias abiertas de bares o publicá tu disponibilidad.'}
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
                  {isBar ? (
                    <button
                      onClick={() => onViewMusician(show.musicianId)}
                      className="text-amber-400 hover:text-amber-300 font-semibold underline"
                    >
                      Ver perfil del Músico
                    </button>
                  ) : (
                    <button
                      onClick={() => onViewVenue(show.venueId)}
                      className="text-amber-400 hover:text-amber-300 font-semibold underline"
                    >
                      Ver info del Bar
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* MUSICIAN-ONLY SUBTAB: Propuestas y Postulaciones Enviadas a Bares */}
      {!isBar && activeSubTab === 'applications' && (
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
