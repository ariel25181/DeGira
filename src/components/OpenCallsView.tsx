import React, { useState } from 'react';
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
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { EventProposal, EventSlot, MusicianSlotBid } from '../types/index.ts';
import { formatARS, formatDateBA } from '../utils/bookingLogic.ts';
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
    currentVenue,
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
  const [counterAmount, setCounterAmount] = useState<number>(75000);
  const [counterNote, setCounterNote] = useState<string>('');

  // Expandable proposal details
  const [expandedProposalId, setExpandedProposalId] = useState<string | null>(null);

  // Status filter for bar
  const [barStatusFilter, setBarStatusFilter] = useState<'todos' | 'propuesta' | 'para_publicar' | 'publicada' | 'agotada'>('todos');

  // Filter proposals according to strict user rules:
  // - Musician ONLY sees proposals in states EXCEPT 'publicada', 'para_publicar', and 'agotada'
  // - Bar sees all its proposals
  const visibleProposals = eventProposals.filter((p) => {
    if (role === 'musico') {
      return p.status !== 'publicada' && p.status !== 'para_publicar' && p.status !== 'agotada';
    }
    if (role === 'bar') {
      if (barStatusFilter === 'todos') return true;
      return p.status === barStatusFilter;
    }
    // Espectador
    return p.status === 'publicada';
  });

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

          {/* Action button for Bar */}
          <div className="pt-2">
            {role === 'bar' ? (
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="py-2.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-xl text-xs shadow-lg shadow-amber-500/20 transition-all flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Proponer Nueva Fecha ({currentVenue?.name || 'Bar Test 1'})</span>
              </button>
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
          <div className="flex space-x-2 overflow-x-auto pb-1 scrollbar-none text-xs font-bold">
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
                  ? 'Todas'
                  : st === 'propuesta'
                  ? 'Propuestas'
                  : st === 'para_publicar'
                  ? 'Para Publicar'
                  : st === 'publicada'
                  ? 'Publicadas'
                  : 'Agotadas'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Proposals List */}
      <div className="space-y-4">
        {visibleProposals.length === 0 ? (
          <div className="text-center py-12 bg-slate-900/40 rounded-2xl border border-slate-800 p-6 space-y-2">
            <p className="text-slate-300 font-medium">No hay propuestas en este estado.</p>
            <p className="text-xs text-slate-500">
              {role === 'musico'
                ? 'Las propuestas acordadas pasan a estado publicado y van a la Cartelera.'
                : 'Creá una nueva propuesta con el botón superior.'}
            </p>
          </div>
        ) : (
          visibleProposals.map((proposal) => {
            const isExpanded = expandedProposalId === proposal.id;
            const proposalBids = slotBids.filter((b) => b.eventId === proposal.id);
            const allSlotsCovered = proposal.slots.every((s) => s.assignedMusicianId);
            const hasAtLeastOneSlotCovered = proposal.slots.some((s) => s.assignedMusicianId || s.status === 'confirmado');

            return (
              <div
                key={proposal.id}
                className="bg-slate-900/90 border border-slate-800 hover:border-amber-500/40 rounded-2xl overflow-hidden shadow-md transition-all space-y-0"
              >
                {/* Header */}
                <div className="p-4 sm:p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center space-x-3">
                      <img
                        src={proposal.venuePhoto}
                        alt={proposal.venueName}
                        onClick={() => onViewVenue(proposal.venueId)}
                        className="w-12 h-12 rounded-xl object-cover border border-slate-700 cursor-pointer hover:border-amber-500"
                      />
                      <div>
                        <h3
                          onClick={() => onViewVenue(proposal.venueId)}
                          className="font-bold text-slate-100 text-base font-display hover:text-amber-400 cursor-pointer"
                        >
                          {proposal.title}
                        </h3>
                        <div className="flex items-center text-xs text-slate-400 space-x-1 mt-0.5">
                          <MapPin className="w-3.5 h-3.5 text-amber-400" />
                          <span>{proposal.venueName} • {proposal.venueNeighborhood}</span>
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
                      <span className="text-slate-400 text-[10px] uppercase font-semibold block">Capacidad Sala</span>
                      <strong className="text-slate-200">{proposal.totalCapacity} personas</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-semibold block">Caché Base</span>
                      <strong className="text-emerald-400 font-extrabold">{formatARS(proposal.baseCachetARS)}</strong>
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
                      {proposal.slots.map((slot, sIdx) => {
                        const slotBid = slotBids.find((b) => b.eventId === proposal.id && b.slotId === slot.id);

                        return (
                          <div
                            key={slot.id}
                            className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
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

                              {slot.assignedMusicianName ? (
                                <div className="text-emerald-400 font-bold flex items-center gap-1 mt-0.5">
                                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                                  <span>Acordado con: {slot.assignedMusicianName} ({formatARS(slot.agreedCachetARS || proposal.baseCachetARS)})</span>
                                </div>
                              ) : (
                                <div className="text-slate-400 text-[11px] mt-0.5">
                                  {slotBid ? 'En negociación de propuesta' : 'Disponible para postular'}
                                </div>
                              )}
                            </div>

                            {/* Musician action to bid */}
                            {role === 'musico' && !slot.assignedMusicianId && (
                              <button
                                onClick={() => handleOpenBidding(proposal, slot)}
                                className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1 shadow-md shrink-0"
                              >
                                <Music className="w-3 h-3" />
                                <span>Cubrir este Horario</span>
                              </button>
                            )}
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

                        return (
                          <div
                            key={bid.id}
                            className={`p-3.5 rounded-xl border text-xs space-y-2.5 ${
                              bid.status === 'aceptada'
                                ? 'bg-emerald-950/20 border-emerald-500/40'
                                : bid.status === 'rechazada'
                                ? 'bg-slate-900 border-slate-800 opacity-60'
                                : 'bg-slate-900 border-slate-800'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="font-extrabold text-sm text-slate-100 flex items-center gap-1.5">
                                  <span>{bid.musicianName}</span>
                                  <span className="text-[11px] text-slate-400 font-normal">
                                    ({bid.musiciansCount} músicos en escenario)
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-400 mt-0.5">
                                  Lleva: <strong className="text-slate-300">{bid.equipmentProvided}</strong>
                                </div>
                                <div className="text-[11px] text-slate-400">
                                  Pide al bar: <strong className="text-slate-300">{bid.equipmentNeeded}</strong>
                                </div>

                                {/* Music Streaming Links (Listen in 1 click) */}
                                {(bid.musicLinks?.spotifyUrl || bid.musicLinks?.youtubeUrl || bid.musicLinks?.bandcampUrl) && (
                                  <div className="flex items-center gap-1.5 pt-1">
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
                                          className="px-1.5 py-0.5 bg-slate-950 border border-slate-800 text-[9px] text-slate-300 rounded font-mono"
                                        >
                                          Ch{ch.channel}: {ch.instrument} ({ch.micOrDI})
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>

                              <div className="text-right">
                                <span className="font-extrabold text-emerald-400 text-sm block">
                                  {formatARS(bid.proposedCachetARS)}
                                </span>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full inline-block bg-slate-800 text-slate-300">
                                  {bid.status === 'aceptada'
                                    ? 'Aceptada'
                                    : bid.status === 'contraoferta_bar'
                                    ? 'Contraoferta del Bar'
                                    : bid.status === 'contraoferta_musico'
                                    ? 'Contraoferta del Músico'
                                    : bid.status === 'rechazada'
                                    ? 'Rechazada'
                                    : 'Pendiente de Revisión'}
                                </span>
                              </div>
                            </div>

                            {/* Bid history */}
                            <div className="space-y-1 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800 text-[11px]">
                              {bid.history.map((h) => (
                                <div key={h.id} className="text-slate-300">
                                  <strong className="text-amber-400">{h.actorName}:</strong> {h.note} ({formatARS(h.cachetARS)})
                                </div>
                              ))}
                            </div>

                            {/* Negotiation Actions for Bar */}
                            {role === 'bar' && bid.status !== 'aceptada' && bid.status !== 'rechazada' && (
                              <div className="space-y-2 pt-1 border-t border-slate-800">
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => respondToSlotBid(bid.id, 'accept', bid.proposedCachetARS, 'Propuesta aceptada por el bar.')}
                                    className="flex-1 py-1.5 px-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs flex items-center justify-center gap-1"
                                  >
                                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                                    <span>Aceptar Propuesta</span>
                                  </button>

                                  <button
                                    onClick={() => setCounterInputId(isCounteringThis ? null : bid.id)}
                                    className="py-1.5 px-3 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-semibold rounded-lg text-xs"
                                  >
                                    Contraproponer
                                  </button>

                                  <button
                                    onClick={() => respondToSlotBid(bid.id, 'reject', undefined, 'Rechazada por el anfitrión.')}
                                    className="py-1.5 px-2.5 bg-slate-800 hover:bg-slate-700 text-rose-400 rounded-lg text-xs"
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
                                      placeholder="Nota de contrapropuesta..."
                                      value={counterNote}
                                      onChange={(e) => setCounterNote(e.target.value)}
                                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100"
                                    />
                                    <button
                                      onClick={() => {
                                        respondToSlotBid(bid.id, 'counter', counterAmount, counterNote || 'Contraoferta enviada.');
                                        setCounterInputId(null);
                                      }}
                                      className="px-3 py-1 bg-amber-500 text-slate-950 font-bold rounded-lg text-xs"
                                    >
                                      Enviar Contraoferta al Músico
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Negotiation Actions for Musician */}
                            {role === 'musico' && bid.status === 'contraoferta_bar' && (
                              <div className="flex items-center gap-2 pt-1 border-t border-slate-800">
                                <button
                                  onClick={() => respondToSlotBid(bid.id, 'accept', bid.proposedCachetARS, 'Músico acepta contraoferta.')}
                                  className="flex-1 py-1.5 px-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs flex items-center justify-center gap-1"
                                >
                                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                                  <span>Aceptar Contraoferta del Bar ({formatARS(bid.proposedCachetARS)})</span>
                                </button>
                                <button
                                  onClick={() => respondToSlotBid(bid.id, 'reject', undefined, 'Músico no acepta contraoferta.')}
                                  className="py-1.5 px-2.5 bg-slate-800 text-rose-400 rounded-lg text-xs"
                                >
                                  Rechazar
                                </button>
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
