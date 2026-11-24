import React, { useState, useEffect } from 'react';
import {
  Radio,
  Plus,
  MapPin,
  Calendar,
  Clock,
  DollarSign,
  Speaker,
  Users,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Music,
  Star,
  Check,
  Send,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Eye,
  AlertCircle,
  Headphones,
  Sliders,
  ExternalLink,
  Lock,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { CachetMode, EventProposal, EventSlot, MusicianSlotBid } from '../types/index.ts';
import { formatARS, formatCachet, formatDateBA, sanitizeNumericInput } from '../utils/bookingLogic.ts';
import {
  getSlotDisplayState,
  isEventVisibleInConvocatorias,
  isBidVisibleToViewer,
} from '../utils/slotBidding.ts';
import { CreateEventProposalModal } from './modals/CreateEventProposalModal.tsx';
import { MusicianBidModal } from './modals/MusicianBidModal.tsx';

interface OpenCallsViewProps {
  onOpenPublishModal?: () => void;
  onOpenApplyModal?: (call: any) => void;
  onViewVenue: (venueId: string) => void;
  onViewMusician: (musicianId: string) => void;
}

export const OpenCallsView: React.FC<OpenCallsViewProps> = ({
  onViewVenue,
  onViewMusician,
}) => {
  const {
    role,
    setRole,
    venues,
    currentVenue,
    setActiveVenueId,
    currentMusician,
    eventProposals,
    slotBids,
    publishEventProposal,
    updateEventProposal,
    respondToSlotBid,
  } = useApp();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [biddingEvent, setBiddingEvent] = useState<EventProposal | null>(null);
  const [biddingSlot, setBiddingSlot] = useState<EventSlot | null>(null);

  // Counter offer state inline for bar / musician
  const [counterInputId, setCounterInputId] = useState<string | null>(null);
  const [counterAmountText, setCounterAmountText] = useState<string>('75000');
  const [counterCachetType, setCounterCachetType] = useState<CachetMode>('fijo');
  const [counterMusiciansCount, setCounterMusiciansCount] = useState<number>(2);
  const [counterNote, setCounterNote] = useState<string>('');
  const [negError, setNegError] = useState<string | null>(null);

  // Expandable proposal details
  const [expandedProposalId, setExpandedProposalId] = useState<string | null>(null);

  // Status filter for bar
  const [barStatusFilter, setBarStatusFilter] = useState<'todos' | 'propuesta' | 'para_publicar' | 'publicada' | 'agotada'>('todos');

  useEffect(() => {
    setCounterInputId(null);
    setCounterNote('');
    setCounterCachetType('fijo');
    setNegError(null);
    setBiddingEvent(null);
    setBiddingSlot(null);
  }, [role, currentVenue?.id, currentMusician?.id]);

  // Visibilidad estricta por rol y bar activo:
  // - Bar: únicamente sus propias fechas (currentVenue.id) según filtro
  // - Músico: propuestas y fechas 'para_publicar' que aún tienen horarios libres o donde tiene propuesta activa
  const visibleProposals = eventProposals.filter((p) =>
    isEventVisibleInConvocatorias({
      proposal: p,
      role,
      barStatusFilter,
      slotBids,
      musicianId: currentMusician?.id,
      viewerVenueId: role === 'bar' ? currentVenue?.id : undefined,
    })
  );

  const barScopedEvents =
    role === 'bar'
      ? eventProposals.filter((p) => !currentVenue?.id || p.venueId === currentVenue.id)
      : eventProposals;

  const barStatusCounts = {
    todos: barScopedEvents.length,
    propuesta: barScopedEvents.filter((p) => p.status === 'propuesta').length,
    para_publicar: barScopedEvents.filter((p) => p.status === 'para_publicar').length,
    publicada: barScopedEvents.filter((p) => p.status === 'publicada').length,
    agotada: barScopedEvents.filter((p) => p.status === 'agotada').length,
  };

  const venueEventCounts = new Map<string, number>();
  eventProposals.forEach((ev) => {
    venueEventCounts.set(ev.venueId, (venueEventCounts.get(ev.venueId) || 0) + 1);
  });
  const otherVenuesWithEvents = venues.filter(
    (v) => v.id !== currentVenue?.id && (venueEventCounts.get(v.id) || 0) > 0
  );
  const otherVenuesEventsCount = otherVenuesWithEvents.reduce(
    (sum, v) => sum + (venueEventCounts.get(v.id) || 0),
    0
  );

  const toggleExpand = (id: string) => {
    setExpandedProposalId((prev) => (prev === id ? null : id));
  };

  const handleOpenBidding = (event: EventProposal, slot: EventSlot) => {
    setBiddingEvent(event);
    setBiddingSlot(slot);
  };

  const handleBarPublish = (eventId: string) => {
    publishEventProposal(eventId);
  };

  const handleMoveToParaPublicar = (eventId: string) => {
    updateEventProposal(eventId, { status: 'para_publicar' });
  };

  return (
    <div className="space-y-5 pb-24">
      {/* Banner */}
      <div className="bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden">
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <Radio className="w-3.5 h-3.5 mr-1 animate-pulse" />
            Convocatorias & Acuerdos • DeGira
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-100 font-display">
            {role === 'bar'
              ? 'Gestión de Fechas y Convocatorias del Bar'
              : role === 'musico'
              ? 'Propuestas de Bares Disponibles para Tocar'
              : 'Cartelera de Fechas'}
          </h1>
          <p className="text-xs text-slate-400 max-w-md leading-relaxed">
            {role === 'bar'
              ? 'Proponé fechas con caché, slots de horarios, capacidad y rider técnico. Negociá con músicos y publicá cuando esté acordado.'
              : role === 'musico'
              ? 'Explorá propuestas en negociación abiertas por bares. Postulá a un horario, aceptá el caché o envía tu contraoferta con equipamiento.'
              : 'Los recitales confirmados están publicados en la Cartelera general.'}
          </p>

          {/* Action button & Venue Switcher for Bar */}
          <div className="pt-2 space-y-2.5">
            {role === 'bar' ? (
              <>
                {venues.length > 1 && (
                  <div className="space-y-1">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2">
                      <label
                        htmlFor="bar-venue-switcher"
                        className="text-[11px] font-bold uppercase tracking-wider text-slate-400 shrink-0"
                      >
                        Local / Sala activa:
                      </label>
                      <select
                        id="bar-venue-switcher"
                        data-testid="bar-venue-switcher"
                        value={currentVenue?.id || ''}
                        onChange={(e) => setActiveVenueId(e.target.value)}
                        className="w-full sm:w-auto px-3 py-2 rounded-xl bg-slate-950/90 border border-slate-700 text-xs font-bold text-slate-100 focus:border-amber-500 outline-none"
                      >
                        {venues.map((v) => {
                          const count = venueEventCounts.get(v.id) || 0;
                          return (
                            <option key={v.id} value={v.id}>
                              {v.name} • {v.neighborhood} ({count} {count === 1 ? 'evento' : 'eventos'})
                            </option>
                          );
                        })}
                      </select>
                    </div>
                    {otherVenuesEventsCount > 0 && (
                      <p
                        data-testid="other-venues-events-hint"
                        className="text-[11px] text-amber-300/90"
                      >
                        También hay {otherVenuesEventsCount}{' '}
                        {otherVenuesEventsCount === 1 ? 'evento' : 'eventos'} en{' '}
                        {otherVenuesWithEvents.length === 1
                          ? 'otro local sincronizado'
                          : 'otros locales sincronizados'}
                        . Elegí el local arriba para verlo.
                      </p>
                    )}
                  </div>
                )}
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="py-2.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-xl text-xs shadow-lg shadow-amber-500/20 transition-all flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Proponer Nueva Fecha ({currentVenue?.name || 'Bar Test 1'})</span>
                </button>
              </>
            ) : role === 'musico' ? (
              <span className="text-xs text-amber-400 font-semibold flex items-center gap-1.5">
                <Music className="w-4 h-4" />
                <span>Mostrando convocatorias abiertas para {currentMusician?.stageName || 'Músico Test 1'}</span>
              </span>
            ) : (
              <button
                onClick={() => setRole('musico')}
                className="text-xs text-amber-400 underline font-semibold"
              >
                ¿Querés postularte como músico? Cambiá al perfil de Músico
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Bar Status Tabs */}
      {role === 'bar' && (
        <div className="space-y-1.5">
          <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold block">
            Filtrar propuestas por estado:
          </span>
          <div className="flex flex-wrap gap-2 pb-1 text-xs font-bold">
            {(['todos', 'propuesta', 'para_publicar', 'publicada', 'agotada'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setBarStatusFilter(st)}
                className={`px-3 py-1.5 rounded-xl border whitespace-nowrap transition-all ${
                  barStatusFilter === st
                    ? 'bg-amber-500 text-slate-950 border-amber-500 font-black'
                    : 'bg-slate-900 text-slate-300 border-slate-800'
                }`}
              >
                {st === 'todos'
                  ? `Todas (${barStatusCounts.todos})`
                  : st === 'propuesta'
                  ? `Propuestas (${barStatusCounts.propuesta})`
                  : st === 'para_publicar'
                  ? `Para Publicar (${barStatusCounts.para_publicar})`
                  : st === 'publicada'
                  ? `Publicadas (${barStatusCounts.publicada})`
                  : `Agotadas (${barStatusCounts.agotada})`}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Proposals List */}
      <div className="space-y-4">
        {visibleProposals.length === 0 ? (
          <div className="text-center py-12 bg-slate-900/40 rounded-2xl border border-slate-800 p-6 space-y-3">
            <p className="text-slate-300 font-medium">No hay propuestas en este estado.</p>
            <p className="text-xs text-slate-500">
              {role === 'musico'
                ? 'Las propuestas acordadas pasan a estado publicado y van a la Cartelera.'
                : barStatusCounts.todos > 0 && barStatusFilter !== 'todos'
                ? `Este local tiene ${barStatusCounts.todos} ${barStatusCounts.todos === 1 ? 'evento activo' : 'eventos activos'} en otros estados (Para Publicar / Publicadas).`
                : 'Creá una nueva propuesta con el botón superior.'}
            </p>
            {role === 'bar' && barStatusCounts.todos > 0 && barStatusFilter !== 'todos' && (
              <button
                type="button"
                onClick={() => setBarStatusFilter('todos')}
                className="px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-bold transition-colors"
              >
                Ver Todas ({barStatusCounts.todos})
              </button>
            )}
          </div>
        ) : (
          visibleProposals.map((proposal) => {
            const isExpanded = expandedProposalId === proposal.id;
            const proposalBids = slotBids.filter(
              (b) =>
                b.eventId === proposal.id &&
                isBidVisibleToViewer({
                  bid: b,
                  viewerRole: role,
                  viewerMusicianId: currentMusician?.id,
                  viewerVenueId: role === 'bar' ? currentVenue?.id : undefined,
                  parentEvent: proposal,
                })
            );
            const hasAtLeastOneSlotCovered = proposal.slots.some(
              (s) =>
                s.status === 'confirmado' ||
                (s.status !== 'libre' && s.status !== 'negociando' && Boolean(s.assignedMusicianId))
            );

            return (
              <div
                key={proposal.id}
                className="bg-slate-900/90 border border-slate-800 hover:border-amber-500/40 rounded-2xl overflow-hidden shadow-md transition-all space-y-0"
              >
                {/* Header */}
                <div className="p-4 sm:p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2 sm:gap-3">
                    <div className="flex items-center space-x-3 min-w-0 flex-1">
                      <img
                        src={proposal.venuePhoto}
                        alt={proposal.venueName}
                        onClick={() => onViewVenue(proposal.venueId)}
                        className="w-12 h-12 rounded-xl object-cover border border-slate-700 cursor-pointer hover:border-amber-500 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <h3
                          onClick={() => onViewVenue(proposal.venueId)}
                          className="font-bold text-slate-100 text-base font-display hover:text-amber-400 cursor-pointer break-words"
                        >
                          {proposal.title}
                        </h3>
                        <div className="flex flex-wrap items-center text-xs text-slate-400 gap-x-2 gap-y-0.5 mt-0.5 min-w-0">
                          <span className="inline-flex items-center space-x-1 min-w-0">
                            <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span className="truncate">
                              {proposal.venueName} • {proposal.venueNeighborhood}
                              {proposal.venueAddress ? ` (${proposal.venueAddress})` : ''}
                            </span>
                          </span>
                          {proposal.venueAddress && (
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                                `${proposal.venueName}, ${proposal.venueAddress}, ${proposal.venueNeighborhood}, Buenos Aires`
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-amber-300 text-[10px] font-semibold transition-colors shrink-0"
                            >
                              <ExternalLink className="w-2.5 h-2.5" />
                              <span>Ver en Google Maps</span>
                            </a>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="shrink-0">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-black uppercase border ${
                          proposal.status === 'publicada'
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                            : proposal.status === 'para_publicar'
                            ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40'
                            : proposal.status === 'agotada'
                            ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                            : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                        }`}
                      >
                        {proposal.status === 'propuesta'
                          ? 'Propuesta de Evento'
                          : proposal.status === 'para_publicar'
                          ? 'Lista para Publicar'
                          : proposal.status === 'publicada'
                          ? 'Publicada en Cartelera'
                          : proposal.status === 'agotada'
                          ? 'Agotada'
                          : 'Cancelada'}
                      </span>
                    </div>
                  </div>

                  {/* Date, Capacity & Global Cachet */}
                  <div className="grid grid-cols-3 gap-2 p-3 bg-slate-950/70 rounded-xl border border-slate-800/80 text-xs">
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-semibold block">Fecha</span>
                      <strong className="text-slate-200">{formatDateBA(proposal.date)}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-semibold block">Cupo Disponible</span>
                      {proposal.remainingCapacity <= 0 ? (
                        <strong className="text-rose-400 font-black">0 / {proposal.totalCapacity} pers. (Agotada)</strong>
                      ) : (
                        <strong className="text-slate-200">
                          <span className={proposal.remainingCapacity < proposal.totalCapacity ? 'text-amber-400 font-black' : ''}>
                            {proposal.remainingCapacity}
                          </span>
                          <span className="text-slate-400 font-semibold"> / {proposal.totalCapacity} pers.</span>
                        </strong>
                      )}
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-semibold block">Caché Base</span>
                      <strong className="text-emerald-400 font-extrabold">
                        {formatCachet(proposal.baseCachetARS, proposal.cachetType)}
                      </strong>
                    </div>
                  </div>

                  {/* Rider Summary */}
                  <div className="p-3 bg-slate-950/50 rounded-xl border border-slate-800 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 text-slate-300 font-bold">
                      <Speaker className="w-3.5 h-3.5 text-amber-400" />
                      <span>Equipamiento provisto por el Bar:</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Escenario {proposal.rider.stageSize} • Sonido: {proposal.rider.soundSystem} • Luces: {proposal.rider.lighting}
                    </p>
                  </div>

                  {/* Slots List */}
                  <div className="space-y-2">
                    <span className="text-slate-300 text-xs font-bold block">
                      Horarios y Músicos Solicitados ({proposal.slots.length}):
                    </span>

                    <div className="space-y-1.5">
                      {proposal.slots.map((slot) => {
                        const slotState = getSlotDisplayState({
                          proposal,
                          slot,
                          slotBids,
                          viewerRole: role,
                          viewerMusicianId: role === 'musico' ? currentMusician?.id : undefined,
                        });

                        return (
                          <div
                            key={slot.id}
                            className={`p-3 rounded-xl bg-slate-950 border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${
                              slotState.availability === 'confirmado'
                                ? 'border-emerald-500/30'
                                : slotState.availability === 'bloqueado'
                                ? 'border-amber-500/30'
                                : 'border-slate-800'
                            }`}
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-amber-400">
                                  Horario {slot.startTime} a {slot.endTime} hs
                                </span>
                                <span className="text-slate-400">
                                  ({slot.requiredMusicians} {slot.requiredMusicians === 1 ? 'músico' : 'músicos'})
                                </span>
                              </div>

                              {slotState.availability === 'confirmado' ? (
                                <div className="text-emerald-400 font-bold flex items-center gap-1 mt-0.5">
                                  <Check className="w-3.5 h-3.5 stroke-[3] shrink-0" />
                                  <span>
                                    {role === 'bar'
                                      ? `Acordado con: ${slotState.assignedMusicianName || 'Músico confirmado'} (${formatCachet(
                                          slotState.agreedCachetARS ?? proposal.baseCachetARS,
                                          slotState.agreedCachetType ?? proposal.cachetType
                                        )}) • Músico y bar ya acordaron este horario`
                                      : slotState.isLockedByViewer
                                      ? `Acordado con: ${slotState.assignedMusicianName || 'Tu banda'} (${formatCachet(
                                          slotState.agreedCachetARS ?? proposal.baseCachetARS,
                                          slotState.agreedCachetType ?? proposal.cachetType
                                        )}) • Ya acordaste este horario con el bar`
                                      : `Horario reservado • El bar y ${slotState.assignedMusicianName || 'un músico'} ya acordaron este horario`}
                                  </span>
                                </div>
                              ) : slotState.availability === 'bloqueado' ? (
                                <div className="text-amber-300 font-semibold flex items-center gap-1.5 mt-0.5 text-[11px]">
                                  <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                  <span>
                                    {role === 'bar'
                                      ? slotState.activeBid?.status === 'contraoferta_bar'
                                        ? `Contraoferta enviada a ${slotState.activeBid.musicianName} • Esperando respuesta del músico (ver abajo)`
                                        : slotState.activeBid?.status === 'contraoferta_musico'
                                        ? `Contraoferta de ${slotState.activeBid.musicianName} pendiente de tu revisión (ver abajo)`
                                        : `Propuesta de ${slotState.activeBid?.musicianName || 'músico'} pendiente de tu revisión (ver abajo)`
                                      : slotState.isLockedByViewer
                                      ? slotState.activeBid?.status === 'contraoferta_bar'
                                        ? 'Contraoferta del bar recibida • Respondé abajo o en Mis Postulaciones'
                                        : 'Ya te postulaste • Horario bloqueado mientras se revisa tu propuesta'
                                      : 'Horario bloqueado • Propuesta de otro músico en revisión'}
                                  </span>
                                </div>
                              ) : (
                                <div className="text-slate-400 text-[11px] mt-0.5">
                                  {role === 'bar'
                                    ? proposal.status === 'publicada' || proposal.status === 'agotada' || proposal.status === 'cancelada'
                                      ? 'Horario sin músico asignado (evento cerrado en cartelera)'
                                      : 'Horario libre • Esperando postulaciones de músicos'
                                    : slotState.wasPreviouslyRejectedForViewer
                                    ? 'Disponible para postular • Horario liberado tras propuesta anterior rechazada'
                                    : 'Disponible para postular'}
                                </div>
                              )}
                            </div>

                            {/* Musician action to bid — solo si el horario está libre */}
                            {slotState.canBid ? (
                              <button
                                onClick={() => handleOpenBidding(proposal, slot)}
                                className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1 shadow-md shrink-0"
                              >
                                <Music className="w-3 h-3" />
                                <span>Cubrir este Horario</span>
                              </button>
                            ) : role === 'musico' && slotState.availability === 'bloqueado' ? (
                              <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold text-[11px] inline-flex items-center gap-1 shrink-0">
                                <Lock className="w-3 h-3" />
                                <span>{slotState.isLockedByViewer ? 'Ya te postulaste' : 'Bloqueado'}</span>
                              </span>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Bar actions to Move to 'para_publicar' and 'publicada' */}
                  {role === 'bar' && (
                    <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs text-slate-400">
                        Código de referencia: <span className="font-mono text-amber-400 font-bold">{proposal.eventCode}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        {proposal.status === 'propuesta' && hasAtLeastOneSlotCovered && (
                          <button
                            onClick={() => handleMoveToParaPublicar(proposal.id)}
                            className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition-colors shadow-sm"
                          >
                            Pasar a Lista para Publicar
                          </button>
                        )}

                        {(proposal.status === 'para_publicar' || (proposal.status === 'propuesta' && hasAtLeastOneSlotCovered)) && (
                          <button
                            onClick={() => handleBarPublish(proposal.id)}
                            className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 text-slate-950 font-black text-xs shadow-md transition-all flex items-center gap-1.5"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Publicar en Cartelera (Manual)</span>
                          </button>
                        )}

                        {proposal.status === 'publicada' && (
                          <button
                            onClick={() => updateEventProposal(proposal.id, { status: 'propuesta' })}
                            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 text-xs font-semibold transition-colors"
                          >
                            Pausar / Volver a Propuesta
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Toggle expand to see bids & negotiation */}
                  {proposalBids.length > 0 && (
                    <div className="pt-2">
                      <button
                        onClick={() => toggleExpand(proposal.id)}
                        className="text-xs text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1"
                      >
                        <Users className="w-3.5 h-3.5" />
                        <span>Ver Negociaciones de Músicos ({proposalBids.length})</span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  )}
                </div>

                {/* Expanded Section: Slot Bids & Negotiation Loop */}
                {isExpanded && proposalBids.length > 0 && (
                  <div className="p-4 sm:p-5 bg-slate-950 border-t border-slate-800 space-y-3">
                    <h4 className="text-xs font-bold uppercase text-slate-300">
                      Propuestas y Contraofertas de Músicos:
                    </h4>

                    <div className="space-y-3">
                      {proposalBids.map((bid) => {
                        const isCounteringThis = counterInputId === bid.id;
                        const bidSlot = proposal.slots.find((s) => s.id === bid.slotId);
                        const hasAcceptedOtherInSlot = proposalBids.some(
                          (b) =>
                            b.id !== bid.id &&
                            b.slotId === bid.slotId &&
                            !b.retracted &&
                            b.status === 'aceptada'
                        );
                        const isEventClosedForNeg =
                          proposal.status === 'publicada' ||
                          proposal.status === 'agotada' ||
                          proposal.status === 'cancelada';

                        return (
                          <div
                            key={bid.id}
                            className={`p-3.5 rounded-xl border text-xs space-y-2.5 ${
                              bid.status === 'aceptada' && !bid.retracted
                                ? 'bg-emerald-950/20 border-emerald-500/40'
                                : bid.status === 'rechazada' || bid.retracted
                                ? 'bg-slate-900 border-slate-800 opacity-60'
                                : 'bg-slate-900 border-slate-800'
                            }`}
                          >
                            {/* Top Header: Musician + Slot + Count left, Cachet + Status Badge right (zero overflow on 390px) */}
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1 space-y-1">
                                <div className="font-extrabold text-sm text-slate-100 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                                  <span className="break-words">{bid.musicianName}</span>
                                  <span className="text-[11px] text-slate-400 font-normal whitespace-nowrap">
                                    ({bid.musiciansCount} {bid.musiciansCount === 1 ? 'músico' : 'músicos'} en escenario)
                                  </span>
                                </div>
                                {bidSlot && (
                                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-[10px] font-bold text-amber-300">
                                    <Clock className="w-3 h-3 shrink-0" />
                                    <span>Horario {bidSlot.startTime} a {bidSlot.endTime} hs</span>
                                  </div>
                                )}
                              </div>

                              <div className="text-right shrink-0 max-w-[46%]">
                                <span className="font-extrabold text-emerald-400 text-sm block whitespace-nowrap">
                                  {formatCachet(bid.proposedCachetARS, bid.cachetType)}
                                </span>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full inline-block bg-slate-800 text-slate-300 leading-tight mt-0.5">
                                  {bid.retracted
                                    ? 'Retractada'
                                    : bid.status === 'aceptada'
                                    ? 'Aceptada • Acordada'
                                    : bid.status === 'rechazada'
                                    ? 'Rechazada'
                                    : isEventClosedForNeg
                                    ? 'Cerrada (Evento publicado)'
                                    : hasAcceptedOtherInSlot || bidSlot?.status === 'confirmado'
                                    ? 'Cerrada (Horario acordado)'
                                    : bid.status === 'contraoferta_bar'
                                    ? 'Contraoferta del Bar'
                                    : bid.status === 'contraoferta_musico'
                                    ? 'Contraoferta del Músico'
                                    : 'Pendiente de Revisión'}
                                </span>
                              </div>
                            </div>

                            {/* Equipment & Audio Links & Input List: Full Width below header */}
                            <div className="space-y-1">
                              <div className="text-[11px] text-slate-400 break-words">
                                Lleva: <strong className="text-slate-300">{bid.equipmentProvided}</strong>
                              </div>
                              <div className="text-[11px] text-slate-400 break-words">
                                Pide al bar: <strong className="text-slate-300">{bid.equipmentNeeded}</strong>
                              </div>

                              {/* Music Streaming Links (Listen in 1 click) */}
                              {(bid.musicLinks?.spotifyUrl || bid.musicLinks?.youtubeUrl || bid.musicLinks?.bandcampUrl) && (
                                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                  <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                                    <Headphones className="w-3 h-3 text-emerald-400" />
                                    Escuchar:
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

                              {/* Input List Preview */}
                              {bid.inputList && bid.inputList.length > 0 && (
                                <div className="pt-1">
                                  <div className="text-[10px] text-slate-400 flex items-center gap-1">
                                    <Sliders className="w-3 h-3 text-amber-400" />
                                    <span>Input List ({bid.inputList.length} canales):</span>
                                  </div>
                                  <div className="flex flex-wrap gap-1 mt-0.5">
                                    {bid.inputList.map((ch, idx) => (
                                      <span
                                        key={idx}
                                        className="px-1.5 py-0.5 bg-slate-950 border border-slate-800 text-[9px] text-slate-300 rounded font-mono break-words"
                                      >
                                        Ch{ch.channel}: {ch.instrument} ({ch.micOrDI})
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Bid history */}
                            <div className="space-y-1 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800 text-[11px]">
                              {bid.history.map((h) => (
                                <div key={h.id} className="text-slate-300 break-words">
                                  <strong className="text-amber-400">{h.actorName}:</strong> {h.note} ({formatCachet(h.cachetARS, h.cachetType)})
                                </div>
                              ))}
                            </div>

                            {/* Negotiation Actions for Bar */}
                            {(() => {
                              const slotForBid = proposal.slots.find((s) => s.id === bid.slotId);
                              const hasAcceptedBidInSlot = proposalBids.some(
                                (b) =>
                                  b.id !== bid.id &&
                                  b.slotId === bid.slotId &&
                                  !b.retracted &&
                                  b.status === 'aceptada'
                              );
                              const canBarNegotiate =
                                role === 'bar' &&
                                bid.status !== 'aceptada' &&
                                bid.status !== 'rechazada' &&
                                !bid.retracted &&
                                !hasAcceptedBidInSlot &&
                                slotForBid?.status !== 'confirmado' &&
                                proposal.status !== 'publicada' &&
                                proposal.status !== 'agotada' &&
                                proposal.status !== 'cancelada';

                              if (!canBarNegotiate) return null;

                              return (
                                <div className="space-y-2 pt-1 border-t border-slate-800">
                                  <div className="flex flex-wrap items-center gap-2">
                                    {(bid.status === 'pendiente_bar' || bid.status === 'contraoferta_musico') ? (
                                      <button
                                        onClick={() => {
                                          const res = respondToSlotBid(
                                            bid.id,
                                            'accept',
                                            bid.proposedCachetARS,
                                            'Propuesta aceptada por el bar.'
                                          );
                                          if (!res.ok) {
                                            setNegError(res.message || 'No se pudo aceptar la propuesta.');
                                          } else {
                                            setNegError(null);
                                            setCounterInputId(null);
                                          }
                                        }}
                                        className="flex-1 py-1.5 px-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs flex items-center justify-center gap-1"
                                      >
                                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                                        <span>Aceptar Propuesta</span>
                                      </button>
                                    ) : (
                                      <span className="flex-1 py-1.5 px-3 bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-semibold rounded-lg text-[11px] flex items-center justify-center gap-1">
                                        <Clock className="w-3.5 h-3.5" />
                                        <span>Esperando respuesta del músico</span>
                                      </span>
                                    )}

                                    <button
                                      onClick={() => {
                                        setCounterCachetType(bid.cachetType === 'a_la_gorra' ? 'a_la_gorra' : 'fijo');
                                        setCounterAmountText(
                                          bid.proposedCachetARS > 0
                                            ? String(bid.proposedCachetARS)
                                            : String(proposal.baseCachetARS || 70000)
                                        );
                                        setCounterNote('');
                                        setNegError(null);
                                        setCounterInputId(isCounteringThis ? null : bid.id);
                                      }}
                                      className="py-1.5 px-3 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-semibold rounded-lg text-xs"
                                    >
                                      {bid.status === 'contraoferta_bar' ? 'Ajustar Contraoferta' : 'Contraproponer'}
                                    </button>

                                    <button
                                      onClick={() => {
                                        const res = respondToSlotBid(
                                          bid.id,
                                          'reject',
                                          undefined,
                                          'Rechazada por el anfitrión.'
                                        );
                                        if (!res.ok) {
                                          setNegError(res.message || 'No se pudo rechazar la propuesta.');
                                        } else {
                                          setNegError(null);
                                          setCounterInputId(null);
                                        }
                                      }}
                                      className="py-1.5 px-2.5 bg-slate-800 hover:bg-slate-700 text-rose-400 rounded-lg text-xs"
                                    >
                                      Rechazar
                                    </button>
                                  </div>

                                  {negError && !isCounteringThis && (
                                    <p className="text-[11px] text-rose-400 font-semibold">{negError}</p>
                                  )}

                                  {isCounteringThis && (
                                    <div className="p-3 bg-slate-950 rounded-xl border border-amber-500/40 space-y-2 animate-in fade-in">
                                      <div className="flex items-center gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => setCounterCachetType('fijo')}
                                          className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold ${
                                            counterCachetType === 'fijo'
                                              ? 'bg-amber-500 text-slate-950 border-amber-500'
                                              : 'bg-slate-900 text-slate-300 border-slate-700'
                                          }`}
                                        >
                                          Monto Fijo
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setCounterCachetType('a_la_gorra')}
                                          className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold ${
                                            counterCachetType === 'a_la_gorra'
                                              ? 'bg-cyan-500 text-slate-950 border-cyan-500'
                                              : 'bg-slate-900 text-slate-300 border-slate-700'
                                          }`}
                                        >
                                          🎩 A la gorra
                                        </button>
                                      </div>

                                      {counterCachetType === 'fijo' && (
                                        <div className="flex flex-wrap items-center gap-2">
                                          <label className="text-[11px] text-slate-400">Nuevo monto caché:</label>
                                          <input
                                            type="number"
                                            inputMode="numeric"
                                            min={1}
                                            placeholder="Ej: 75000"
                                            value={counterAmountText}
                                            onChange={(e) => setCounterAmountText(sanitizeNumericInput(e.target.value))}
                                            className="px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs text-amber-400 font-bold w-32"
                                          />
                                        </div>
                                      )}

                                      <input
                                        type="text"
                                        placeholder="Nota de contrapropuesta..."
                                        value={counterNote}
                                        onChange={(e) => setCounterNote(e.target.value)}
                                        className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100"
                                      />
                                      <button
                                        onClick={() => {
                                          const numericAmount =
                                            counterCachetType === 'a_la_gorra'
                                              ? 0
                                              : counterAmountText === ''
                                              ? 0
                                              : Number(counterAmountText);
                                          const res = respondToSlotBid(
                                            bid.id,
                                            'counter',
                                            numericAmount,
                                            counterNote || (counterCachetType === 'a_la_gorra' ? 'Contraoferta a la gorra.' : 'Contraoferta enviada.'),
                                            { cachetType: counterCachetType }
                                          );
                                          if (!res.ok) {
                                            setNegError(res.message || 'No se pudo enviar la contraoferta.');
                                            return;
                                          }
                                          setNegError(null);
                                          setCounterInputId(null);
                                        }}
                                        className="px-3 py-1 bg-amber-500 text-slate-950 font-bold rounded-lg text-xs"
                                      >
                                        Enviar Contraoferta al Músico
                                      </button>
                                      {negError && (
                                        <p className="text-[11px] text-rose-400 font-semibold">{negError}</p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}

                            {/* Musician Turn Indicator & Negotiation Actions */}
                            {role === 'musico' &&
                              (bid.status === 'pendiente_bar' || bid.status === 'contraoferta_musico') &&
                              !bid.retracted &&
                              !isEventClosedForNeg && (
                                <div className="pt-1 border-t border-slate-800">
                                  <span className="w-full py-1.5 px-3 bg-amber-500/10 border border-amber-500/30 text-amber-300 font-semibold rounded-lg text-[11px] flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5 shrink-0" />
                                    <span>
                                      Esperando respuesta del bar • Podés enviar recordatorio o retractarte en Mis Postulaciones
                                    </span>
                                  </span>
                                </div>
                              )}

                            {role === 'musico' &&
                              bid.status === 'contraoferta_bar' &&
                              !bid.retracted &&
                              !hasAcceptedOtherInSlot &&
                              bidSlot?.status !== 'confirmado' &&
                              !isEventClosedForNeg && (
                              <div className="space-y-2 pt-1 border-t border-slate-800">
                                <div className="flex flex-wrap items-center gap-2">
                                  <button
                                    onClick={() => {
                                      const res = respondToSlotBid(
                                        bid.id,
                                        'accept',
                                        bid.proposedCachetARS,
                                        'Músico acepta contraoferta.'
                                      );
                                      if (!res.ok) {
                                        setNegError(res.message || 'No se pudo aceptar la contraoferta.');
                                      } else {
                                        setNegError(null);
                                        setCounterInputId(null);
                                      }
                                    }}
                                    className="flex-1 py-1.5 px-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs flex items-center justify-center gap-1"
                                  >
                                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                                    <span>Aceptar Contraoferta del Bar ({formatCachet(bid.proposedCachetARS, bid.cachetType)})</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      setCounterCachetType(bid.cachetType === 'a_la_gorra' ? 'a_la_gorra' : 'fijo');
                                      setCounterAmountText(
                                        bid.proposedCachetARS > 0
                                          ? String(bid.proposedCachetARS)
                                          : String(proposal.baseCachetARS || 70000)
                                      );
                                      setCounterMusiciansCount(bid.musiciansCount || 1);
                                      setCounterNote('');
                                      setNegError(null);
                                      setCounterInputId(isCounteringThis ? null : bid.id);
                                    }}
                                    className="py-1.5 px-3 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-semibold rounded-lg text-xs"
                                  >
                                    Contraproponer
                                  </button>
                                  <button
                                    onClick={() => {
                                      const res = respondToSlotBid(
                                        bid.id,
                                        'reject',
                                        undefined,
                                        'Músico no acepta contraoferta.'
                                      );
                                      if (!res.ok) {
                                        setNegError(res.message || 'No se pudo rechazar la contraoferta.');
                                      } else {
                                        setNegError(null);
                                        setCounterInputId(null);
                                      }
                                    }}
                                    className="py-1.5 px-2.5 bg-slate-800 text-rose-400 rounded-lg text-xs"
                                  >
                                    Rechazar
                                  </button>
                                </div>

                                {negError && !isCounteringThis && (
                                  <p className="text-[11px] text-rose-400 font-semibold">{negError}</p>
                                )}

                                {isCounteringThis && (
                                  <div className="p-3 bg-slate-950 rounded-xl border border-amber-500/40 space-y-2.5 animate-in fade-in">
                                    <div className="space-y-1">
                                      <span className="text-[11px] text-slate-400 block">Cantidad de músicos en escenario:</span>
                                      <div className="grid grid-cols-4 gap-1.5">
                                        {[1, 2, 3, 4].map((cnt) => (
                                          <button
                                            key={cnt}
                                            type="button"
                                            onClick={() => setCounterMusiciansCount(cnt)}
                                            className={`py-1 rounded-lg border text-[11px] font-bold ${
                                              counterMusiciansCount === cnt
                                                ? 'bg-amber-500 text-slate-950 border-amber-500'
                                                : 'bg-slate-900 text-slate-300 border-slate-700'
                                            }`}
                                          >
                                            {cnt} {cnt === 1 ? 'músico' : 'músicos'}
                                          </button>
                                        ))}
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => setCounterCachetType('fijo')}
                                        className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold ${
                                          counterCachetType === 'fijo'
                                            ? 'bg-amber-500 text-slate-950 border-amber-500'
                                            : 'bg-slate-900 text-slate-300 border-slate-700'
                                        }`}
                                      >
                                        Monto Fijo
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setCounterCachetType('a_la_gorra')}
                                        className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold ${
                                          counterCachetType === 'a_la_gorra'
                                            ? 'bg-cyan-500 text-slate-950 border-cyan-500'
                                            : 'bg-slate-900 text-slate-300 border-slate-700'
                                        }`}
                                      >
                                        🎩 Proponer A la gorra
                                      </button>
                                    </div>

                                    {counterCachetType === 'fijo' && (
                                      <div className="flex flex-wrap items-center gap-2">
                                        <label className="text-[11px] text-slate-400">Nuevo monto caché:</label>
                                        <input
                                          type="number"
                                          inputMode="numeric"
                                          min={1}
                                          placeholder="Ej: 80000"
                                          value={counterAmountText}
                                          onChange={(e) => setCounterAmountText(sanitizeNumericInput(e.target.value))}
                                          className="px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs text-amber-400 font-bold w-32"
                                        />
                                      </div>
                                    )}

                                    <input
                                      type="text"
                                      placeholder="Nota de contrapropuesta para el bar..."
                                      value={counterNote}
                                      onChange={(e) => setCounterNote(e.target.value)}
                                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100"
                                    />
                                    <button
                                      onClick={() => {
                                        const numericAmount =
                                          counterCachetType === 'a_la_gorra'
                                            ? 0
                                            : counterAmountText === ''
                                            ? 0
                                            : Number(counterAmountText);
                                        const res = respondToSlotBid(
                                          bid.id,
                                          'counter',
                                          numericAmount,
                                          counterNote || (counterCachetType === 'a_la_gorra' ? 'Contraoferta a la gorra enviada por el músico.' : 'Contraoferta enviada por el músico.'),
                                          { cachetType: counterCachetType, musiciansCount: counterMusiciansCount }
                                        );
                                        if (!res.ok) {
                                          setNegError(res.message || 'No se pudo enviar la contraoferta.');
                                          return;
                                        }
                                        setNegError(null);
                                        setCounterInputId(null);
                                      }}
                                      className="px-3 py-1 bg-amber-500 text-slate-950 font-bold rounded-lg text-xs"
                                    >
                                      Enviar Contraoferta al Bar
                                    </button>
                                    {negError && (
                                      <p className="text-[11px] text-rose-400 font-semibold">{negError}</p>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modals */}
      <CreateEventProposalModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />

      <MusicianBidModal
        isOpen={!!biddingEvent && !!biddingSlot}
        onClose={() => {
          setBiddingEvent(null);
          setBiddingSlot(null);
        }}
        event={biddingEvent}
        slot={biddingSlot}
      />
    </div>
  );
};
