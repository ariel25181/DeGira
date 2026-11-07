import React, { useState } from 'react';
import {
  X,
  Calendar,
  Clock,
  MapPin,
  Star,
  Users,
  Ticket,
  UtensilsCrossed,
  Share2,
  Check,
  Music,
  CreditCard,
  ShieldCheck,
  QrCode,
  ArrowRight,
  ExternalLink,
  ChevronLeft,
  Loader2,
} from 'lucide-react';
import { LiveShowConfirmed, SpectatorReservation } from '../../types/index.ts';
import { useApp } from '../../context/AppContext.tsx';
import { formatARS, formatDateBA } from '../../utils/bookingLogic.ts';

interface ShowDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  show: LiveShowConfirmed | null;
  onViewVenueProfile?: (venueId: string) => void;
  onViewMusicianProfile?: (musicianId: string) => void;
  onNavigateToProfile?: () => void;
}

export const ShowDetailModal: React.FC<ShowDetailModalProps> = ({
  isOpen,
  onClose,
  show,
  onViewVenueProfile,
  onViewMusicianProfile,
  onNavigateToProfile,
}) => {
  const { venues, musicians, createReservation, currentPublicUser, userDisplayName } = useApp();

  const [partySize, setPartySize] = useState<number>(2);
  const [copied, setCopied] = useState<boolean>(false);
  const [step, setStep] = useState<'details' | 'mp_checkout' | 'confirmed'>('details');
  const [paymentMethod, setPaymentMethod] = useState<'mp_account' | 'card' | 'transfer'>('mp_account');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [confirmedReservation, setConfirmedReservation] = useState<SpectatorReservation | null>(null);

  if (!isOpen || !show) return null;

  const venue = venues.find((v) => v.id === show.venueId);
  const musician = musicians.find((m) => m.id === show.musicianId);

  const unitPrice = show.ticketPriceARS || 0;
  const totalPrice = unitPrice * partySize;

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(
        `¡Vamos a ver a ${show.musicianName} en ${show.venueName} el ${formatDateBA(show.date)}! Entradas y reservas en SuenaBA.`
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleStartBooking = (e: React.FormEvent) => {
    e.preventDefault();
    if (totalPrice > 0) {
      // Proceed directly to Mercado Pago checkout
      setStep('mp_checkout');
    } else {
      // Free show: confirm reservation directly
      executeBooking('libre');
    }
  };

  const executeBooking = (mode: 'mp' | 'libre') => {
    setIsProcessing(true);

    setTimeout(() => {
      const mpId = mode === 'mp' ? `MP-${Math.floor(10000000 + Math.random() * 90000000)}` : undefined;
      const resCode = `SBA-MP-${Math.floor(1000 + Math.random() * 9000)}`;

      const newRes = createReservation({
        userId: currentPublicUser?.id || 'user-pub-1',
        userName: userDisplayName || currentPublicUser?.name || 'Usuario Público 1',
        userEmail: currentPublicUser?.email || 'publico1@suenaba.com.ar',
        showId: show.id,
        showTitle: `${show.musicianName} en Vivo`,
        musicianName: show.musicianName,
        venueName: show.venueName,
        venueAddress: show.venueAddress,
        venueNeighborhood: show.venueNeighborhood,
        showDate: show.date,
        showTime: show.time,
        partySize,
        totalARS: totalPrice,
        ticketType: show.ticketType,
        paymentStatus: 'pagado_mp',
        mpPaymentId: mpId,
        reservationCode: resCode,
      });

      setConfirmedReservation(newRes);
      setIsProcessing(false);
      setStep('confirmed');
    }, 700);
  };

  const handleResetAndClose = () => {
    setStep('details');
    setConfirmedReservation(null);
    onClose();
  };

  const handleGoToMyReservations = () => {
    setStep('details');
    setConfirmedReservation(null);
    if (onNavigateToProfile) {
      onNavigateToProfile();
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        
        {/* Cover Photo */}
        <div className="relative h-48 sm:h-56 w-full overflow-hidden bg-slate-950 shrink-0">
          <img
            src={show.venuePhoto}
            alt={show.venueName}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent" />

          {/* Close button */}
          <button
            onClick={handleResetAndClose}
            aria-label="Cerrar detalle del show"
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-slate-950/70 border border-slate-700/80 flex items-center justify-center text-slate-200 hover:bg-slate-900 transition-colors z-10"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Share button */}
          <button
            onClick={handleShare}
            aria-label="Compartir show"
            className="absolute top-4 right-15 w-9 h-9 rounded-full bg-slate-950/70 border border-slate-700/80 flex items-center justify-center text-slate-200 hover:bg-slate-900 transition-colors z-10"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
          </button>

          {/* Date & Genre Tag */}
          <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500 text-slate-950 shadow-md">
              {formatDateBA(show.date)} • {show.time}
            </span>
            <div className="flex gap-1.5">
              {show.musicianGenres.slice(0, 2).map((g) => (
                <span
                  key={g}
                  className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-900/80 text-amber-300 border border-amber-500/30 backdrop-blur-md"
                >
                  {g}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1 text-slate-200">
          {/* STEP 1: SHOW DETAILS & BOOKING SELECTION */}
          {step === 'details' && (
            <>
              {/* Title & Artist */}
              <div>
                <div className="text-xs uppercase tracking-wider text-amber-400 font-semibold mb-1">
                  Cartelera en Vivo • Ciudad de Buenos Aires
                </div>
                <h2 className="text-2xl font-extrabold text-slate-100 font-display">
                  {show.musicianName}
                </h2>
                <div className="flex items-center space-x-2 text-sm text-slate-400 mt-1">
                  <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    <strong>{show.venueName}</strong> — {show.venueAddress}, {show.venueNeighborhood}
                  </span>
                </div>
              </div>

              {/* Counterpart Reputation Cards */}
              <div className="grid grid-cols-2 gap-3">
                {/* Musician Card */}
                <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center space-x-2 mb-2">
                    <img
                      src={show.musicianAvatar}
                      alt={show.musicianName}
                      className="w-8 h-8 rounded-full object-cover border border-amber-500/40"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold truncate text-slate-200">
                        {show.musicianName}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {show.musicianFormat}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800">
                    <span className="text-amber-400 font-bold flex items-center">
                      <Star className="w-3.5 h-3.5 fill-amber-400 mr-1" />
                      {musician ? musician.rating.toFixed(2) : '4.95'}
                    </span>
                    <span className="text-slate-500">
                      {musician?.reviewCount || 24} shows
                    </span>
                  </div>
                </div>

                {/* Venue Card */}
                <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-amber-400 font-bold text-xs">
                      🍸
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold truncate text-slate-200">
                        {show.venueName}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {show.venueNeighborhood}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800">
                    <span className="text-amber-400 font-bold flex items-center">
                      <Star className="w-3.5 h-3.5 fill-amber-400 mr-1" />
                      {venue ? venue.rating.toFixed(2) : '4.92'}
                    </span>
                    <span className="text-slate-500">
                      {venue?.reviewCount || 28} reseñas
                    </span>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="text-sm text-slate-300 leading-relaxed bg-slate-950/40 p-3.5 rounded-xl border border-slate-800/80">
                {show.description}
              </div>

              {/* Ticket / Cover Condition */}
              <div className="flex items-center justify-between p-3.5 bg-gradient-to-r from-amber-950/20 to-slate-900 rounded-xl border border-amber-900/30">
                <div className="flex items-center space-x-3">
                  <Ticket className="w-5 h-5 text-amber-400" />
                  <div>
                    <div className="text-xs text-slate-400 uppercase font-semibold">
                      Acceso al Show
                    </div>
                    <div className="text-sm font-bold text-slate-100">
                      {show.ticketType === 'entrada_libre'
                        ? 'Entrada Libre (Reserva de mesa sugerida)'
                        : show.ticketType === 'consumicion_minima'
                        ? `Consumición Mínima (${formatARS(show.ticketPriceARS)} por comensal)`
                        : `Ticket / Entrada (${formatARS(show.ticketPriceARS)} por persona)`}
                    </div>
                  </div>
                </div>
                {venue?.hospitality && (
                  <UtensilsCrossed className="w-4 h-4 text-slate-500" />
                )}
              </div>

              {/* Reservation & Mercado Pago Action Form */}
              <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs uppercase font-bold tracking-wider text-slate-300 flex items-center gap-1.5">
                    <UtensilsCrossed className="w-4 h-4 text-amber-400" />
                    <span>Reservar Mesa para el Show</span>
                  </h4>
                  <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                    Mesas Disponibles
                  </span>
                </div>

                <form onSubmit={handleStartBooking} className="space-y-4">
                  {/* Party Size Selector */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400 block font-medium">Cantidad de personas:</label>
                    <div className="grid grid-cols-4 gap-2">
                      {[1, 2, 4, 6].map((num) => (
                        <button
                          type="button"
                          key={num}
                          onClick={() => setPartySize(num)}
                          className={`py-2 text-xs rounded-xl border font-bold transition-all ${
                            partySize === num
                              ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-md shadow-amber-500/20'
                              : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          {num} {num === 1 ? 'persona' : 'personas'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Summary of Price */}
                  {totalPrice > 0 && (
                    <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-slate-400 block">
                          Total a pagar ({partySize} x {formatARS(unitPrice)}):
                        </span>
                        <strong className="text-base text-slate-100 font-black">
                          {formatARS(totalPrice)}
                        </strong>
                      </div>
                      <div className="text-right">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#009EE3]">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Mercado Pago</span>
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Submit Button */}
                  {totalPrice > 0 ? (
                    <button
                      type="submit"
                      className="w-full py-3.5 px-4 bg-[#009EE3] hover:bg-[#0082b9] active:scale-[0.99] text-white font-extrabold rounded-xl shadow-lg shadow-[#009EE3]/25 transition-all flex items-center justify-center space-x-2 text-sm"
                    >
                      <CreditCard className="w-4 h-4 stroke-[2.5]" />
                      <span>Proceder al Pago con Mercado Pago ({formatARS(totalPrice)})</span>
                    </button>
                  ) : (
                    <button
                      type="submit"
                      className="w-full py-3.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-xl shadow-md transition-all flex items-center justify-center space-x-2 text-sm"
                    >
                      <Check className="w-4 h-4 stroke-[2.5]" />
                      <span>Confirmar Reserva Gratuita ({partySize} personas)</span>
                    </button>
                  )}
                </form>
              </div>
            </>
          )}

          {/* STEP 2: MERCADO PAGO CHECKOUT INTERFACE */}
          {step === 'mp_checkout' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Back to details */}
              <button
                type="button"
                onClick={() => setStep('details')}
                className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 font-semibold"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Volver al detalle del show</span>
              </button>

              {/* Mercado Pago Header Card */}
              <div className="bg-[#009EE3] rounded-2xl p-4 text-white shadow-lg shadow-[#009EE3]/20 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5 font-black text-lg tracking-tight">
                    <CreditCard className="w-5 h-5" />
                    <span>mercado pago</span>
                  </div>
                  <p className="text-[11px] text-sky-100 font-medium">
                    Checkout Transparente Protegido • SuenaBA
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-sky-100">Total a Pagar</div>
                  <div className="text-xl font-black">{formatARS(totalPrice)}</div>
                </div>
              </div>

              {/* Order breakdown */}
              <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between text-slate-300">
                  <span>Show en Vivo:</span>
                  <strong className="text-slate-100">{show.musicianName}</strong>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Lugar:</span>
                  <strong className="text-slate-100">{show.venueName} ({show.venueNeighborhood})</strong>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Fecha y Hora:</span>
                  <strong className="text-slate-100">{formatDateBA(show.date)} a las {show.time}</strong>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Comensales:</span>
                  <strong className="text-slate-100">{partySize} personas ({formatARS(unitPrice)} c/u)</strong>
                </div>
                <div className="border-t border-slate-800 pt-2 flex justify-between text-sm">
                  <span className="font-bold text-slate-200">Importe Final:</span>
                  <span className="font-black text-amber-400">{formatARS(totalPrice)}</span>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 block">
                  Seleccioná tu método de pago de Mercado Pago:
                </label>

                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('mp_account')}
                    className={`w-full p-3.5 rounded-xl border flex items-center justify-between text-left transition-all ${
                      paymentMethod === 'mp_account'
                        ? 'bg-[#009EE3]/15 border-[#009EE3] text-white shadow-md'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-[#009EE3]/20 flex items-center justify-center text-[#009EE3] font-bold text-sm">
                        MP
                      </div>
                      <div>
                        <div className="text-xs font-bold">Dinero en Cuenta Mercado Pago</div>
                        <div className="text-[11px] text-slate-400">Débito instantáneo con tu saldo</div>
                      </div>
                    </div>
                    {paymentMethod === 'mp_account' && <Check className="w-4 h-4 text-[#009EE3]" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('card')}
                    className={`w-full p-3.5 rounded-xl border flex items-center justify-between text-left transition-all ${
                      paymentMethod === 'card'
                        ? 'bg-[#009EE3]/15 border-[#009EE3] text-white shadow-md'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-sm">
                        <CreditCard className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold">Tarjeta de Débito o Crédito</div>
                        <div className="text-[11px] text-slate-400">Visa, Mastercard, Cabal (hasta 3 cuotas)</div>
                      </div>
                    </div>
                    {paymentMethod === 'card' && <Check className="w-4 h-4 text-[#009EE3]" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('transfer')}
                    className={`w-full p-3.5 rounded-xl border flex items-center justify-between text-left transition-all ${
                      paymentMethod === 'transfer'
                        ? 'bg-[#009EE3]/15 border-[#009EE3] text-white shadow-md'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400 font-bold text-sm">
                        <QrCode className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold">Transferencia CVU / Alias o QR</div>
                        <div className="text-[11px] text-slate-400">Acreditación instantánea por Mercado Pago</div>
                      </div>
                    </div>
                    {paymentMethod === 'transfer' && <Check className="w-4 h-4 text-[#009EE3]" />}
                  </button>
                </div>
              </div>

              {/* Pay Button */}
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => executeBooking('mp')}
                className="w-full py-4 px-4 bg-[#009EE3] hover:bg-[#0082b9] disabled:opacity-60 text-white font-black text-sm rounded-xl shadow-xl shadow-[#009EE3]/30 transition-all flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Conectando con Mercado Pago...</span>
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4 stroke-[2.5]" />
                    <span>Pagar {formatARS(totalPrice)} con Mercado Pago</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* STEP 3: RESERVATION & MERCADO PAGO CONFIRMATION */}
          {step === 'confirmed' && confirmedReservation && (
            <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-2xl p-5 text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mx-auto mb-1">
                  <Check className="w-6 h-6 stroke-[3]" />
                </div>
                <h3 className="text-base font-black text-emerald-300">
                  ¡Reserva y Pago Confirmados con Mercado Pago!
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed max-w-sm mx-auto">
                  Tu mesa para <strong>{confirmedReservation.partySize} personas</strong> está asegurada en{' '}
                  <strong>{confirmedReservation.venueName}</strong> para el recital de{' '}
                  <strong>{confirmedReservation.musicianName}</strong>.
                </p>
              </div>

              {/* Proof Card with Voucher and QR */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-slate-400">Código de Reserva:</span>
                  <span className="font-mono font-black text-amber-400 text-sm tracking-wider">
                    {confirmedReservation.reservationCode}
                  </span>
                </div>

                {confirmedReservation.mpPaymentId && (
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="text-slate-400">Comprobante Mercado Pago:</span>
                    <span className="font-mono font-bold text-[#009EE3]">
                      {confirmedReservation.mpPaymentId}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-slate-400">Titular de la Reserva:</span>
                  <strong className="text-slate-200">{confirmedReservation.userName}</strong>
                </div>

                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-slate-400">Llegada al Bar:</span>
                  <span className="text-slate-200">
                    {formatDateBA(confirmedReservation.showDate)} a las {confirmedReservation.showTime}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Dirección:</span>
                  <span className="text-slate-200">{confirmedReservation.venueAddress}</span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={handleGoToMyReservations}
                  className="w-full py-3.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs sm:text-sm rounded-xl shadow-lg shadow-amber-500/25 transition-all flex items-center justify-center gap-2"
                >
                  <Ticket className="w-4 h-4" />
                  <span>Ver en Mis Reservas (Perfil de Público General)</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={handleResetAndClose}
                  className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold text-xs rounded-xl border border-slate-800 transition-colors"
                >
                  Continuar explorando cartelera
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
