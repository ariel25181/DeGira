import React, { useState } from 'react';
import {
  Search,
  MapPin,
  Calendar,
  Clock,
  Star,
  Ticket,
  Filter,
  Sparkles,
  ChevronRight,
  UtensilsCrossed,
  Users,
  AlertCircle,
  CheckCircle,
  X,
  ExternalLink,
  Music,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { LiveShowConfirmed, EventProposal, MusicGenre } from '../types/index.ts';
import { formatARS, formatDateBA, getConfirmedSlotLineup } from '../utils/bookingLogic.ts';
import { isEventArchived } from '../utils/slotBidding.ts';

interface CatalogViewProps {
  onSelectShow?: (show: LiveShowConfirmed) => void;
  onSelectEventProposal?: (event: EventProposal) => void;
  onViewVenue: (venueId: string) => void;
  onViewMusician: (musicianId: string) => void;
}

const NEIGHBORHOODS: string[] = [
  'Todos',
  'Palermo Hollywood',
  'Palermo Soho',
  'San Telmo',
  'Colegiales',
  'Recoleta',
  'Villa Crespo',
  'Almagro',
  'Chacarita',
];

const GENRES: string[] = [
  'Todos',
  'Jazz',
  'Rock',
  'Acústico',
  'Tango & Fusión',
  'Indie',
  'Bossa & MPB',
  'Blues & Soul',
  'Folklore',
];

export const CatalogView: React.FC<CatalogViewProps> = ({
  onSelectShow,
  onSelectEventProposal,
  onViewVenue,
  onViewMusician,
}) => {
  const {
    eventProposals,
    liveShows,
    venues,
    musicians,
    role,
    createPublicEventReservation,
    joinEventWaitlist,
    currentPublicUser,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNeighborhood, setSelectedNeighborhood] = useState('Todos');
  const [selectedGenre, setSelectedGenre] = useState('Todos');

  // Quick booking state modal
  const [reservingEvent, setReservingEvent] = useState<EventProposal | null>(null);
  const [selectedPartySize, setSelectedPartySize] = useState<number>(2);
  const [bookingSuccessInfo, setBookingSuccessInfo] = useState<{
    code: string;
    qrCode?: string;
    isFree: boolean;
  } | null>(null);

  // Modal para consultar reseñas del bar, últimos 10 eventos y músicos
  const [inspectingVenueEvent, setInspectingVenueEvent] = useState<EventProposal | null>(null);
  const [reviewModalTab, setReviewModalTab] = useState<'venue_reviews' | 'last_10_events' | 'musician_reviews'>('venue_reviews');

  // Cartelera del público general: SOLO eventos activos en estado 'publicada' o 'agotada' (nunca archivados ni cancelados)
  const publicEvents = eventProposals.filter((ev) => {
    const isPublicState = (ev.status === 'publicada' || ev.status === 'agotada') && !isEventArchived(ev);
    if (!isPublicState) return false;

    // Filters
    if (selectedNeighborhood !== 'Todos' && ev.venueNeighborhood !== selectedNeighborhood) {
      return false;
    }
    if (selectedGenre !== 'Todos' && !ev.targetGenres.includes(selectedGenre as MusicGenre)) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        ev.title.toLowerCase().includes(q) ||
        ev.venueName.toLowerCase().includes(q) ||
        ev.venueNeighborhood.toLowerCase().includes(q) ||
        ev.targetGenres.some((g) => g.toLowerCase().includes(q)) ||
        ev.slots.some((s) => s.assignedMusicianName?.toLowerCase().includes(q));
      if (!match) return false;
    }
    return true;
  });

  const handleStartReservation = (event: EventProposal) => {
    setReservingEvent(event);
    setSelectedPartySize(Math.min(2, Math.max(1, event.remainingCapacity)));
    setBookingSuccessInfo(null);
  };

  const handleConfirmReservation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reservingEvent) return;

    const res = createPublicEventReservation(reservingEvent.id, selectedPartySize);
    setBookingSuccessInfo({
      code: res.eventCode,
      qrCode: res.qrTicketCode,
      isFree: (reservingEvent.ticketPriceARS ?? 8000) === 0 || res.status === 'confirmada',
    });
  };

  return (
    <div className="space-y-5 pb-24">
      {/* Hero Banner */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-950 border border-slate-800 p-5 shadow-xl">
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <Sparkles className="w-3 h-3 mr-1" />
            Cartelera DeGira • Eventos Publicados
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-100 font-display tracking-tight">
            Música en Vivo en Bares de Buenos Aires
          </h1>
          <p className="text-xs text-slate-400 max-w-md leading-relaxed">
            Explorá eventos confirmados y publicados por los bares. Reservá tu lugar con el código oficial y confirmá en 8 minutos.
          </p>
        </div>

        {/* Ambient glow */}
        <div className="absolute -right-8 -bottom-8 w-44 h-44 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar por bar, banda, barrio o estilo..."
          className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 shadow-sm transition-colors"
        />
      </div>

      {/* Neighborhood Pills Slider */}
      <div>
        <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-2 flex items-center justify-between">
          <span>Barrios de CABA</span>
          <span className="text-amber-400">{selectedNeighborhood}</span>
        </div>
        <div className="flex space-x-2 overflow-x-auto pb-1 scrollbar-none">
          {NEIGHBORHOODS.map((hood) => {
            const isSelected = selectedNeighborhood === hood;
            return (
              <button
                key={hood}
                onClick={() => setSelectedNeighborhood(hood)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
                  isSelected
                    ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-md shadow-amber-500/20'
                    : 'bg-slate-900/80 text-slate-300 border-slate-800 hover:border-slate-700'
                }`}
              >
                {hood}
              </button>
            );
          })}
        </div>
      </div>

      {/* Genres Pills Slider */}
      <div>
        <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-2 flex items-center justify-between">
          <span>Géneros Musicales</span>
          <span className="text-amber-400">{selectedGenre}</span>
        </div>
        <div className="flex space-x-2 overflow-x-auto pb-1 scrollbar-none">
          {GENRES.map((genre) => {
            const isSelected = selectedGenre === genre;
            return (
              <button
                key={genre}
                onClick={() => setSelectedGenre(genre)}
                className={`px-3 py-1 rounded-xl text-xs font-medium whitespace-nowrap transition-all border ${
                  isSelected
                    ? 'bg-slate-800 text-amber-300 border-amber-500/60'
                    : 'bg-slate-900/50 text-slate-400 border-slate-800/80 hover:text-slate-300'
                }`}
              >
                {genre}
              </button>
            );
          })}
        </div>
      </div>

      {/* Events List Header */}
      <div className="flex items-center justify-between pt-2">
        <h2 className="text-base font-bold text-slate-100 font-display">
          Eventos Publicados en Cartelera ({publicEvents.length})
        </h2>
        <span className="text-xs text-slate-400">Buenos Aires</span>
      </div>

      {/* Events Grid */}
      <div className="space-y-4">
        {publicEvents.length === 0 ? (
          <div className="text-center py-12 bg-slate-900/40 rounded-2xl border border-slate-800 p-6 space-y-2">
            <p className="text-slate-300 font-medium">No hay eventos publicados con esos filtros.</p>
            <p className="text-xs text-slate-500">
              Probá seleccionando "Todos" los barrios o géneros.
            </p>
            <button
              onClick={() => {
                setSelectedNeighborhood('Todos');
                setSelectedGenre('Todos');
                setSearchQuery('');
              }}
              className="mt-3 text-xs text-amber-400 underline font-semibold"
            >
              Restablecer filtros
            </button>
          </div>
        ) : (
          publicEvents.map((event) => {
            const isAgotada = event.status === 'agotada' || event.remainingCapacity <= 0;
            const slotLineup = getConfirmedSlotLineup(event.slots);
            const ticketPrice = event.ticketPriceARS ?? 8000;
            const isFreeEvent = ticketPrice === 0;

            return (
              <div
                key={event.id}
                className="group bg-slate-900/90 border border-slate-800 hover:border-amber-500/40 rounded-2xl overflow-hidden shadow-md transition-all hover:shadow-xl hover:shadow-amber-500/5"
              >
                {/* Photo & Badges */}
                <div className="relative h-44 w-full bg-slate-950 overflow-hidden">
                  <img
                    src={event.venuePhoto}
                    alt={event.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent" />

                  {/* Date badge */}
                  <div className="absolute top-3 left-3 bg-slate-950/85 backdrop-blur-md border border-slate-700/60 rounded-xl px-2.5 py-1 text-center shadow-lg">
                    <div className="text-[10px] uppercase font-bold text-amber-400">
                      {formatDateBA(event.date).split(' ')[0]}
                    </div>
                    <div className="text-sm font-black text-slate-100">
                      {event.date.split('-')[2]}
                    </div>
                  </div>

                  {/* Status badge: Publicada vs Agotada */}
                  <div className="absolute top-3 right-3">
                    {isAgotada ? (
                      <span className="px-3 py-1 rounded-full text-xs font-black bg-rose-500 text-white shadow-lg animate-pulse">
                        AGOTADA
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/90 text-slate-950 shadow-lg">
                        PUBLICADA
                      </span>
                    )}
                  </div>

                  {/* Venue and Neighborhood bottom label */}
                  <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-xs text-slate-300">
                    <span className="font-bold flex items-center text-white drop-shadow">
                      <MapPin className="w-3.5 h-3.5 text-amber-400 mr-1 shrink-0" />
                      {event.venueName} • {event.venueNeighborhood}
                    </span>
                    <span className="text-amber-300 font-semibold drop-shadow">
                      {event.startTime} a {event.endTime} hs
                    </span>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4 space-y-3">
                  {/* Event Title & Musicians */}
                  <div>
                    <h3 className="text-lg font-bold text-slate-100 font-display group-hover:text-amber-400 transition-colors">
                      {event.title}
                    </h3>
                    <p className="text-xs text-amber-400 font-medium mt-0.5">
                      {event.targetGenres.join(', ')}
                    </p>
                    {slotLineup.length > 0 && (
                      <div
                        data-testid="catalog-event-lineup"
                        className="mt-2 space-y-1 rounded-xl bg-slate-950/60 border border-slate-800/80 px-2.5 py-2"
                      >
                        {slotLineup.map((item) => (
                          <div
                            key={item.slotId}
                            className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-xs"
                          >
                            <span className="inline-flex items-center gap-1.5 font-semibold text-slate-100">
                              <Music className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              <span>Toca: {item.musicianName}</span>
                            </span>
                            {item.timeRangeLabel && (
                              <span className="inline-flex items-center gap-1 text-amber-300 font-bold text-[11px]">
                                <Clock className="w-3 h-3 shrink-0" />
                                <span>{item.timeRangeLabel}</span>
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {event.venueAddress && (
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-1">
                        <span>{event.venueAddress}</span>
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                            `${event.venueName}, ${event.venueAddress}, ${event.venueNeighborhood}, Buenos Aires`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-amber-300 text-[11px] font-semibold transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Ver en Google Maps</span>
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Availability Counter (Req 7: Disponibilidad remanente y estado agotada) */}
                  <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-amber-400 shrink-0" />
                      <div>
                        <span className="text-slate-400 text-[11px] block">Disponibilidad de sala:</span>
                        {isAgotada ? (
                          <span className="font-black text-rose-400">Sin lugares disponibles (Agotada)</span>
                        ) : (
                          <span className="font-bold text-slate-200">
                            Quedan <strong className="text-emerald-400 text-sm font-black">{event.remainingCapacity}</strong> de {event.totalCapacity} lugares
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right space-y-0.5">
                      <span
                        data-testid={`catalog-price-${event.id}`}
                        className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-black border ${
                          isFreeEvent
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                            : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                        }`}
                      >
                        {isFreeEvent ? '🎫 Entrada Gratis ($ 0)' : `Entrada ${formatARS(ticketPrice)}`}
                      </span>
                      <span className="font-mono text-[11px] font-bold text-amber-400 block">
                        {event.eventCode}
                      </span>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center space-x-2 pt-1">
                    {isAgotada ? (
                      event.waitlist?.includes(currentPublicUser?.email || 'publico1@degira.com.ar') ? (
                        <div className="flex-1 py-2.5 px-3 bg-emerald-950/40 text-emerald-300 border border-emerald-500/40 font-bold rounded-xl text-xs text-center flex items-center justify-center gap-1.5">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                          <span>¡Anotado en Lista de Espera! (Prioridad ante cupos liberados)</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => joinEventWaitlist(event.id, currentPublicUser?.email || 'publico1@degira.com.ar')}
                          className="flex-1 py-2.5 px-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow"
                        >
                          <Ticket className="w-3.5 h-3.5" />
                          <span>Anotarme en Lista de Espera (Aviso de lugar)</span>
                        </button>
                      )
                    ) : (
                      <button
                        onClick={() => handleStartReservation(event)}
                        className="flex-1 py-2.5 px-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-xl text-xs shadow-md transition-all flex items-center justify-center space-x-1.5"
                      >
                        <Ticket className="w-3.5 h-3.5" />
                        <span>
                          {isFreeEvent
                            ? 'Reservar Lugar Gratis (QR al instante)'
                            : 'Reservar Lugar (8 Minutos para Pagar)'}
                        </span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setInspectingVenueEvent(event);
                        setReviewModalTab('venue_reviews');
                      }}
                      className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors flex items-center space-x-1"
                      title="Consultar reseñas del bar, últimos 10 eventos y músicos que participaron"
                    >
                      <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                      <span>Reseñas & Info</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* QUICK RESERVATION MODAL WITH 8-MINUTE TIMER */}
      {reservingEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Ticket className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">
                    Reservar Lugar en el Evento
                  </h3>
                  <p className="text-xs text-slate-400">
                    {reservingEvent.venueName} • Código: <span className="font-mono text-amber-400 font-bold">{reservingEvent.eventCode}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setReservingEvent(null)}
                aria-label="Cerrar modal"
                className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 text-xs text-slate-300">
              {bookingSuccessInfo ? (
                bookingSuccessInfo.isFree ? (
                  <div className="text-center py-5 space-y-3">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto">
                      <CheckCircle className="w-6 h-6 stroke-[2.5]" />
                    </div>
                    <h4 className="text-base font-black text-slate-100">
                      ¡Entrada Gratis Confirmada con Pase QR!
                    </h4>
                    <div className="p-4 bg-slate-950 rounded-2xl border border-emerald-500/40 space-y-2">
                      <div className="text-[11px] text-slate-400 uppercase font-semibold">
                        Pase QR Oficial (Confirmado al instante):
                      </div>
                      <div
                        data-testid="free-ticket-qr-code"
                        className="text-sm font-mono font-black text-emerald-300 break-all"
                      >
                        {bookingSuccessInfo.qrCode || bookingSuccessInfo.code}
                      </div>
                      <div className="text-xs font-bold text-emerald-300">
                        🎟️ Total: $ 0 (Gratis) • Ya podés mostrar tu QR en puerta.
                      </div>
                    </div>
                    <p className="text-xs text-slate-400">
                      También te enviamos el pase por correo y quedó guardado en <strong>"Mis Reservas"</strong>.
                    </p>
                    <button
                      onClick={() => setReservingEvent(null)}
                      className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-md transition-all"
                    >
                      Entendido, ver mi pase QR
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-5 space-y-3">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto">
                      <CheckCircle className="w-6 h-6 stroke-[2.5]" />
                    </div>
                    <h4 className="text-base font-black text-slate-100">
                      ¡Cupo Reservado con Éxito!
                    </h4>
                    <div className="p-4 bg-slate-950 rounded-2xl border border-amber-500/30 space-y-2">
                      <div className="text-[11px] text-slate-400 uppercase font-semibold">
                        Código del bar para transferir:
                      </div>
                      <div className="text-xl font-mono font-black text-amber-400">
                        {bookingSuccessInfo.code}
                      </div>
                      <div className="text-xs font-bold text-amber-300">
                        ⏱️ Tenés 8 minutos para realizar el pago y subir el comprobante.
                      </div>
                    </div>
                    <p className="text-xs text-slate-400">
                      Podés subir el comprobante ahora desde la sección <strong>"Mis Reservas"</strong> en tu perfil.
                    </p>
                    <button
                      onClick={() => setReservingEvent(null)}
                      className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md transition-all"
                    >
                      Entendido, ir a mis reservas
                    </button>
                  </div>
                )
              ) : (
                <form onSubmit={handleConfirmReservation} className="space-y-4">
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Evento:</span>
                      <strong className="text-slate-200">{reservingEvent.title}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Horario del Bar:</span>
                      <span className="text-slate-200">{formatDateBA(reservingEvent.date)} • {reservingEvent.startTime} a {reservingEvent.endTime} hs</span>
                    </div>
                    {getConfirmedSlotLineup(reservingEvent.slots).length > 0 && (
                      <div className="flex justify-between items-start gap-2 pt-0.5">
                        <span className="text-slate-400 shrink-0">Bandas y horarios:</span>
                        <div className="text-right space-y-0.5">
                          {getConfirmedSlotLineup(reservingEvent.slots).map((item) => (
                            <div key={item.slotId} className="text-amber-300 font-semibold">
                              {item.displayLabel}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-slate-400">Disponibilidad restante:</span>
                      <span className="text-emerald-400 font-bold">{reservingEvent.remainingCapacity} lugares</span>
                    </div>
                  </div>

                  {/* Party size selector */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-200 block">
                      Cantidad de personas (máx {reservingEvent.remainingCapacity}):
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {[1, 2, 4, 6]
                        .filter((num) => num <= reservingEvent.remainingCapacity)
                        .map((num) => (
                          <button
                            type="button"
                            key={num}
                            onClick={() => setSelectedPartySize(num)}
                            className={`py-2 rounded-xl border font-bold text-xs transition-all ${
                              selectedPartySize === num
                                ? 'bg-amber-500 text-slate-950 border-amber-500'
                                : 'bg-slate-950 border-slate-800 text-slate-300'
                            }`}
                          >
                            {num} {num === 1 ? 'persona' : 'personas'}
                          </button>
                        ))}
                    </div>
                  </div>

                  {/* Summary of Price */}
                  {(() => {
                    const modalUnitPrice = reservingEvent.ticketPriceARS ?? 8000;
                    const isFreeModal = modalUnitPrice === 0;
                    return (
                      <>
                        <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                          <div>
                            <span className="text-slate-400 text-[11px] block">Total estimado a pagar:</span>
                            <strong
                              data-testid="booking-modal-total"
                              className={`text-base font-black ${
                                isFreeModal ? 'text-emerald-400' : 'text-amber-400'
                              }`}
                            >
                              {isFreeModal
                                ? 'Gratis ($ 0)'
                                : formatARS(modalUnitPrice * selectedPartySize)}
                            </strong>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-amber-300 font-bold block">
                              {isFreeModal ? 'Confirmación' : 'Tiempo para pagar'}
                            </span>
                            <span className="text-xs font-bold text-slate-200">
                              {isFreeModal ? 'QR inmediato al confirmar' : '8 minutos al reservar'}
                            </span>
                          </div>
                        </div>

                        <button
                          type="submit"
                          className={`w-full py-3.5 rounded-xl font-black text-xs shadow-lg transition-all flex items-center justify-center gap-2 ${
                            isFreeModal
                              ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
                              : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                          }`}
                        >
                          <span>
                            {isFreeModal
                              ? `Confirmar Entrada Gratis (${selectedPartySize} personas)`
                              : `Confirmar Reserva y Obtener Código (${selectedPartySize} personas)`}
                          </span>
                        </button>
                      </>
                    );
                  })()}
                </form>
              )}
            </div>
          </div>
        </div>
      )}
      {/* MODAL: RESEÑAS DEL BAR, ÚLTIMOS 10 EVENTOS Y MÚSICOS QUE PARTICIPARON */}
      {inspectingVenueEvent && (() => {
        const targetVenue = venues.find((v) => v.id === inspectingVenueEvent.venueId);
        const last10Events = eventProposals
          .filter((e) => e.venueId === inspectingVenueEvent.venueId)
          .slice(0, 10);

        const musicianIds = new Set<string>();
        last10Events.forEach((e) => {
          e.slots.forEach((s) => {
            if (s.assignedMusicianId) musicianIds.add(s.assignedMusicianId);
          });
        });
        const participatingMusicians = musicians.filter((m) => musicianIds.has(m.id));

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
              {/* Header */}
              <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <Star className="w-5 h-5 fill-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-100 font-display">
                      {inspectingVenueEvent.venueName}
                    </h3>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
                      <span>
                        {inspectingVenueEvent.venueNeighborhood} • {inspectingVenueEvent.venueAddress}
                      </span>
                      {inspectingVenueEvent.venueAddress && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                            `${inspectingVenueEvent.venueName}, ${inspectingVenueEvent.venueAddress}, ${inspectingVenueEvent.venueNeighborhood}, Buenos Aires`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-amber-300 text-[11px] font-semibold transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Ver en Google Maps</span>
                        </a>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setInspectingVenueEvent(null)}
                  aria-label="Cerrar modal"
                  className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Subtabs switcher */}
              <div className="flex border-b border-slate-800 bg-slate-950 p-1.5 gap-1 text-xs">
                <button
                  onClick={() => setReviewModalTab('venue_reviews')}
                  className={`flex-1 py-2 px-2 rounded-xl font-bold transition-all ${
                    reviewModalTab === 'venue_reviews'
                      ? 'bg-amber-500 text-slate-950 shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  ⭐ Reseñas del Bar ({targetVenue?.reviews.length || 0})
                </button>
                <button
                  onClick={() => setReviewModalTab('last_10_events')}
                  className={`flex-1 py-2 px-2 rounded-xl font-bold transition-all ${
                    reviewModalTab === 'last_10_events'
                      ? 'bg-amber-500 text-slate-950 shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  📅 Últimos 10 Eventos ({last10Events.length})
                </button>
                <button
                  onClick={() => setReviewModalTab('musician_reviews')}
                  className={`flex-1 py-2 px-2 rounded-xl font-bold transition-all ${
                    reviewModalTab === 'musician_reviews'
                      ? 'bg-amber-500 text-slate-950 shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  🎸 Músicos ({participatingMusicians.length})
                </button>
              </div>

              {/* Body */}
              <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-300">
                {/* TAB 1: RESEÑAS DEL BAR */}
                {reviewModalTab === 'venue_reviews' && (
                  <div className="space-y-4">
                    {/* Score summary */}
                    <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between">
                      <div>
                        <div className="text-2xl font-black text-slate-100 flex items-center gap-1.5">
                          <Star className="w-6 h-6 fill-amber-400 text-amber-400" />
                          <span>{targetVenue?.rating.toFixed(2) || '4.95'}</span>
                          <span className="text-xs text-slate-400 font-normal">/ 5.0</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Basado en {targetVenue?.reviewCount || 12} reseñas de músicos y espectadores
                        </p>
                      </div>

                      {/* Criteria breakdown */}
                      {targetVenue?.ratingBreakdown && (
                        <div className="space-y-1 text-[11px] text-slate-400 text-right">
                          <div>Sonido: <strong className="text-amber-400">{(targetVenue.ratingBreakdown.soundQuality ?? 5).toFixed(1)}</strong></div>
                          <div>Pagos: <strong className="text-amber-400">{(targetVenue.ratingBreakdown.paymentReliability ?? 5).toFixed(1)}</strong></div>
                          <div>Hospitalidad: <strong className="text-amber-400">{(targetVenue.ratingBreakdown.hospitality ?? 5).toFixed(1)}</strong></div>
                        </div>
                      )}
                    </div>

                    {/* Reviews list */}
                    <div className="space-y-2.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                        Opiniones verificadas del bar:
                      </span>
                      {!targetVenue || targetVenue.reviews.length === 0 ? (
                        <p className="text-xs text-slate-500 italic p-4 bg-slate-950/60 rounded-xl">
                          Este bar no posee reseñas anteriores registradas.
                        </p>
                      ) : (
                        targetVenue.reviews.map((rev) => (
                          <div
                            key={rev.id}
                            className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-200">{rev.authorName}</span>
                              <div className="flex items-center text-amber-400 text-[11px] font-bold">
                                <Star className="w-3 h-3 fill-amber-400 mr-1" />
                                <span>{rev.rating.toFixed(1)}</span>
                              </div>
                            </div>
                            <p className="text-xs text-slate-300 italic">"{rev.comment}"</p>
                            <div className="text-[10px] text-slate-500">{rev.createdAt}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 2: ÚLTIMOS 10 EVENTOS DEL BAR */}
                {reviewModalTab === 'last_10_events' && (
                  <div className="space-y-3">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                      Cartelera histórica de los últimos 10 shows en {inspectingVenueEvent.venueName}:
                    </span>

                    {last10Events.length === 0 ? (
                      <p className="text-xs text-slate-500 italic p-4 bg-slate-950 rounded-xl">
                        No hay registros de eventos anteriores para este local.
                      </p>
                    ) : (
                      last10Events.map((ev, idx) => {
                        const musiciansInEv = getConfirmedSlotLineup(ev.slots)
                          .map((i) => i.displayLabel)
                          .join(' · ');

                        return (
                          <div
                            key={ev.id}
                            className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between gap-2"
                          >
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-100 text-xs">
                                  {idx + 1}. {ev.title}
                                </span>
                                <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-slate-800 text-slate-300">
                                  {ev.status}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-400">
                                Fecha: {formatDateBA(ev.date)} • Horario: {ev.startTime} a {ev.endTime} hs
                              </div>
                              {musiciansInEv && (
                                <div className="text-[11px] text-amber-400">
                                  🎸 Participaron: <strong>{musiciansInEv}</strong>
                                </div>
                              )}
                            </div>

                            <span className="text-[10px] text-slate-500 font-mono">
                              {ev.eventCode}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* TAB 3: RESEÑAS DE LOS MÚSICOS QUE PARTICIPARON */}
                {reviewModalTab === 'musician_reviews' && (
                  <div className="space-y-3">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                      Reputación y opiniones de las bandas que tocaron en el local:
                    </span>

                    {participatingMusicians.length === 0 ? (
                      <p className="text-xs text-slate-500 italic p-4 bg-slate-950 rounded-xl">
                        Aún no hay reseñas registradas para los músicos de estas fechas.
                      </p>
                    ) : (
                      participatingMusicians.map((m) => (
                        <div
                          key={m.id}
                          className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <img
                                src={m.avatarUrl}
                                alt={m.stageName}
                                className="w-10 h-10 rounded-xl object-cover border border-slate-700"
                              />
                              <div>
                                <h4 className="font-bold text-slate-100 text-xs">{m.stageName}</h4>
                                <div className="text-[11px] text-slate-400">{m.format} • {m.genres.join(', ')}</div>
                              </div>
                            </div>

                            <div className="text-right">
                              <div className="flex items-center text-amber-400 text-xs font-black">
                                <Star className="w-3.5 h-3.5 fill-amber-400 mr-1" />
                                <span>{m.rating.toFixed(2)}</span>
                              </div>
                              <span className="text-[10px] text-slate-500">{m.reviewCount} reseñas</span>
                            </div>
                          </div>

                          {m.reviews.length > 0 && (
                            <div className="space-y-1.5 pt-1.5 border-t border-slate-800">
                              <span className="text-[10px] uppercase font-bold text-slate-500 block">
                                Reseñas recientes de bares:
                              </span>
                              {m.reviews.slice(0, 2).map((r) => (
                                <div key={r.id} className="text-[11px] text-slate-300 italic bg-slate-900/60 p-2 rounded-lg">
                                  "{r.comment}" — <strong className="text-slate-400 not-italic">{r.authorName}</strong>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setInspectingVenueEvent(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl transition"
                >
                  Cerrar
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const ev = inspectingVenueEvent;
                    setInspectingVenueEvent(null);
                    handleStartReservation(ev);
                  }}
                  className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-md transition flex items-center gap-1.5"
                >
                  <Ticket className="w-4 h-4" />
                  <span>Reservar Mesa en este Bar</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
