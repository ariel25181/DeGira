import React, { useState, useEffect } from 'react';
import {
  Star,
  MapPin,
  Music,
  Wine,
  ShieldCheck,
  CheckCircle,
  Speaker,
  UtensilsCrossed,
  DollarSign,
  RotateCcw,
  Users,
  Instagram,
  Disc3,
  Calendar,
  Ticket,
  CreditCard,
  QrCode,
  Check,
  Clock,
  Trash2,
  ExternalLink,
  ChevronRight,
  ArrowRight,
  UserCheck,
  LogOut,
  Upload,
  AlertCircle,
  Copy,
  Download,
  Headphones,
  Sliders,
  Gift,
  Bell,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { formatARS, formatDateBA } from '../utils/bookingLogic.ts';
import { MusicGenre, NeighborhoodBA, PublicEventReservation, MusicianInputChannel, MusicianMusicLinks } from '../types/index.ts';
import { UploadReceiptModal } from './modals/UploadReceiptModal.tsx';
import { BarDoorCheckInModal } from './modals/BarDoorCheckInModal.tsx';

interface ProfileViewProps {
  viewingTarget?: { type: 'musician' | 'venue'; id: string } | null;
  onClearTarget?: () => void;
  onOpenReviewModal?: (params: any) => void;
  onSelectTab?: (tab: string) => void;
  onSignOut?: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  viewingTarget,
  onClearTarget,
  onOpenReviewModal,
  onSelectTab,
  onSignOut,
}) => {
  const {
    role,
    setRole,
    venues,
    musicians,
    publicUsers,
    activePublicUserId,
    setActivePublicUserId,
    currentPublicUser,
    currentMusician,
    currentVenue,
    userDisplayName,
    setUserDisplayName,
    reservations,
    publicEventReservations,
    eventProposals,
    confirmReservationPayment,
    rejectReservationPayment,
    liquidateMusicianCachet,
    cancelPublicEventReservation,
    updatePublicUserProfile,
    spectatorBenefits,
    updateMusicianMusicLinks,
    reviews360,
    setActiveMusicianId,
    setActiveVenueId,
    resetAllData,
  } = useApp();

  // Spectator tabs (strictly isolated: Reservas, Por Calificar, Mis Datos)
  const [spectatorTab, setSpectatorTab] = useState<'reservas' | 'pendientes_calificar' | 'preferencias'>('reservas');
  const [visibleQrResId, setVisibleQrResId] = useState<string | null>(null);
  const [customNameInput, setCustomNameInput] = useState<string>(userDisplayName);
  const [customEmailInput, setCustomEmailInput] = useState<string>(currentPublicUser?.email || 'publico1@degira.com.ar');
  const [customPhoneInput, setCustomPhoneInput] = useState<string>(currentPublicUser?.phone || '+54 11 5566-7788');
  const [userDataSavedFeedback, setUserDataSavedFeedback] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Upload receipt modal state
  const [selectedResForUpload, setSelectedResForUpload] = useState<PublicEventReservation | null>(null);
  const [showDoorCheckInModal, setShowDoorCheckInModal] = useState(false);

  // Reject receipt prompt
  const [rejectingResId, setRejectingResId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');

  // Musician / Venue tabs
  const [activeTab, setActiveTab] = useState<'reviews' | 'backline' | 'comprobantes' | 'borderaux' | 'links_musica'>('reviews');

  // Selected genres & hoods for spectator
  const [selectedGenres, setSelectedGenres] = useState<MusicGenre[]>(
    currentPublicUser?.favoriteGenres || ['Jazz', 'Blues & Soul']
  );
  const [selectedHoods, setSelectedHoods] = useState<NeighborhoodBA[]>(
    currentPublicUser?.preferredNeighborhoods || ['Palermo Soho', 'Palermo Hollywood']
  );
  const [prefsSaved, setPrefsSaved] = useState<boolean>(false);

  // Musician music links & input list state
  const [musicianLinks, setMusicianLinks] = useState<MusicianMusicLinks>(
    currentMusician?.musicLinks || { spotifyUrl: '', youtubeUrl: '', bandcampUrl: '' }
  );
  const [musicianInputList, setMusicianInputList] = useState<MusicianInputChannel[]>(
    currentMusician?.defaultInputList || []
  );
  const [musicianSavedSuccess, setMusicianSavedSuccess] = useState(false);

  useEffect(() => {
    if (currentMusician) {
      setMusicianLinks(currentMusician.musicLinks || { spotifyUrl: '', youtubeUrl: '', bandcampUrl: '' });
      setMusicianInputList(currentMusician.defaultInputList || []);
    }
  }, [currentMusician]);

  // Current time state for 8-min countdown ticker
  const [currentTime, setCurrentTime] = useState<number>(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleCopyCode = (code: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    }
  };

  const downloadOfflineTicket = (res: PublicEventReservation) => {
    const canvas = document.createElement('canvas');
    canvas.width = 650;
    canvas.height = 850;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 650, 850);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(1, '#020617');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 650, 850);

    // Border & card
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 3;
    ctx.strokeRect(20, 20, 610, 810);

    // Header banner
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(20, 20, 610, 110);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText('DeGira • Pase Oficial de Acceso', 50, 75);
    ctx.font = '15px sans-serif';
    ctx.fillText('Circuito de Música en Vivo & Bares de Buenos Aires', 50, 105);

    // Body content
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(res.eventTitle, 50, 180);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '15px sans-serif';
    ctx.fillText('Lugar / Bar:', 50, 225);
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(`${res.venueName} — ${res.venueAddress}`, 50, 255);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '15px sans-serif';
    ctx.fillText('Fecha y Horario:', 50, 300);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(`${res.eventDate} • ${res.eventStartTime} a ${res.eventEndTime} hs`, 50, 325);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '15px sans-serif';
    ctx.fillText('Titular de la Entrada:', 50, 370);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(`${res.userName} (${res.partySize} ${res.partySize === 1 ? 'persona' : 'personas'})`, 50, 395);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '15px sans-serif';
    ctx.fillText('Código Oficial de Reserva:', 50, 440);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 22px monospace';
    ctx.fillText(res.eventCode, 50, 470);

    // QR Code Image
    const qrImg = new Image();
    qrImg.crossOrigin = 'anonymous';
    qrImg.onload = () => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(205, 505, 240, 240);
      ctx.drawImage(qrImg, 220, 520, 210, 210);

      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('✓ PASE AUTORIZADO - VÁLIDO PARA INGRESO DIRECTO', 325, 785);
      ctx.textAlign = 'left';

      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `degira-pase-${res.eventCode}.png`;
      a.click();
    };
    qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=210x210&data=${encodeURIComponent(
      res.qrTicketCode || `DeGira:Reserva:${res.eventCode}:${res.partySize}p`
    )}`;
  };

  // 1. PUBLIC GENERAL (ESPECTADOR) PROFILE VIEW
  if (!viewingTarget && role === 'espectador') {
    const allGenres: MusicGenre[] = [
      'Jazz',
      'Rock',
      'Acústico',
      'Tango & Fusión',
      'Indie',
      'Bossa & MPB',
      'Blues & Soul',
      'Funk & Groove',
    ];

    const allHoods: NeighborhoodBA[] = [
      'Palermo Soho',
      'Palermo Hollywood',
      'San Telmo',
      'Colegiales',
      'Villa Crespo',
      'Almagro',
      'Belgrano',
    ];

    const toggleGenre = (genre: MusicGenre) => {
      setSelectedGenres((prev) =>
        prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
      );
      setPrefsSaved(false);
    };

    const toggleHood = (hood: NeighborhoodBA) => {
      setSelectedHoods((prev) =>
        prev.includes(hood) ? prev.filter((h) => h !== hood) : [...prev, hood]
      );
      setPrefsSaved(false);
    };

    const handleSavePreferences = () => {
      setPrefsSaved(true);
      setTimeout(() => setPrefsSaved(false), 2500);
    };

    const handleUpdateName = (e: React.FormEvent) => {
      e.preventDefault();
      if (customNameInput.trim()) {
        setUserDisplayName(customNameInput.trim());
        setPrefsSaved(true);
        setTimeout(() => setPrefsSaved(false), 2500);
      }
    };

    return (
      <div className="space-y-5 pb-24 animate-in fade-in duration-200">
        {/* Welcome Greeting Banner */}
        <div className="bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-slate-900 border border-amber-500/30 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl overflow-hidden border-2 border-amber-500/50 shadow-md shrink-0">
              <img src="./icons/degira-van.jpg" alt="DeGira Camioneta VW" className="w-full h-full object-cover" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-slate-100">
                ¡Bienvenido a DeGira, <span className="text-amber-400">{userDisplayName}</span>!
              </h2>
              <p className="text-xs text-slate-400">
                Panel de Público General • Eventos reservados, comprobantes y pases QR
              </p>
            </div>
          </div>
        </div>

        {/* Spectator User Profile Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3.5 min-w-0">
              <img
                src={currentPublicUser?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80'}
                alt={userDisplayName}
                className="w-14 h-14 rounded-2xl object-cover border-2 border-amber-500/40 shadow-md shrink-0"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-black text-slate-100 truncate">
                    {userDisplayName}
                  </h1>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-purple-500/15 text-purple-400 border border-purple-500/30 shrink-0">
                    Público General
                  </span>
                </div>
                <p className="text-xs text-slate-400 truncate mt-0.5">
                  {currentPublicUser?.email || 'publico1@degira.com.ar'}
                </p>
                <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                  <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Cuenta Verificada (24hs)
                  </span>
                </div>
              </div>
            </div>

            {onSignOut && (
              <button
                onClick={onSignOut}
                title="Cerrar sesión"
                className="px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 hover:text-red-300 text-xs font-bold flex items-center gap-1.5 transition-colors shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Cerrar sesión</span>
              </button>
            )}
          </div>

          {/* Sub Navigation Tabs */}
          <div className="grid grid-cols-3 p-1 bg-slate-950 rounded-2xl border border-slate-800 text-xs font-bold gap-1">
            <button
              onClick={() => setSpectatorTab('reservas')}
              className={`py-2 rounded-xl transition-all flex items-center justify-center gap-1 ${
                spectatorTab === 'reservas'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Ticket className="w-3.5 h-3.5" />
              <span className="truncate">Mis Reservas ({publicEventReservations.length + reservations.length})</span>
            </button>

            <button
              onClick={() => setSpectatorTab('pendientes_calificar')}
              className={`py-2 rounded-xl transition-all flex items-center justify-center gap-1 ${
                spectatorTab === 'pendientes_calificar'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Star className="w-3.5 h-3.5" />
              <span className="truncate">Por Calificar</span>
            </button>

            <button
              onClick={() => setSpectatorTab('preferencias')}
              className={`py-2 rounded-xl transition-all flex items-center justify-center gap-1 ${
                spectatorTab === 'preferencias'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Music className="w-3.5 h-3.5" />
              <span className="truncate">Mis Datos</span>
            </button>
          </div>
        </div>

        {/* TAB 1: EVENTOS RESERVADOS (PAGO DE 8 MINUTOS, COMPROBANTES Y QR) */}
        {spectatorTab === 'reservas' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Ticket className="w-4 h-4 text-amber-400" />
                <span>Historial de Reservas y Comprobantes de Shows</span>
              </h3>
              {onSelectTab && (
                <button
                  onClick={() => onSelectTab('cartelera')}
                  className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1"
                >
                  <span>Explorar más shows</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>

            {publicEventReservations.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-3">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-3xl">
                  🎫
                </div>
                <h4 className="text-base font-bold text-slate-100">
                  Todavía no tenés eventos reservados
                </h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Entrá a la Cartelera de Buenos Aires para reservar tu lugar. Al reservar tenés 8 minutos para realizar el pago al código del bar y subir el comprobante.
                </p>
                {onSelectTab && (
                  <button
                    onClick={() => onSelectTab('cartelera')}
                    className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs inline-flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all"
                  >
                    <Calendar className="w-4 h-4" />
                    <span>Ver Cartelera de Eventos</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {publicEventReservations.map((res) => {
                  const msRemaining = Math.max(0, res.expiresAt - currentTime);
                  const min = Math.floor(msRemaining / 60000);
                  const sec = Math.floor((msRemaining % 60000) / 1000);
                  const isExpired = res.status === 'expirada' || (res.status === 'pendiente_pago' && msRemaining === 0);

                  return (
                    <div
                      key={res.id}
                      className={`bg-slate-900 border rounded-2xl p-4 sm:p-5 space-y-3 shadow-lg ${
                        res.status === 'confirmada'
                          ? 'border-emerald-500/40 bg-slate-900/90'
                          : res.status === 'comprobante_subido'
                          ? 'border-cyan-500/40 bg-slate-900/90'
                          : isExpired
                          ? 'border-slate-800 opacity-60'
                          : 'border-amber-500/40'
                      }`}
                    >
                      {/* Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-amber-400 uppercase tracking-wide">
                              {res.eventTitle}
                            </span>
                          </div>
                          <h4 className="text-base font-extrabold text-slate-100 mt-0.5">
                            {res.venueName}
                          </h4>
                        </div>

                        {/* Status Badges */}
                        <div>
                          {res.status === 'confirmada' && (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold">
                              <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3]" />
                              <span>Pago Confirmado por el Bar</span>
                            </div>
                          )}

                          {res.status === 'comprobante_subido' && (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 text-xs font-bold">
                              <Clock className="w-3.5 h-3.5 text-cyan-400" />
                              <span>Comprobante en Revisión por el Bar</span>
                            </div>
                          )}

                          {res.status === 'pendiente_pago' && !isExpired && (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/50 text-amber-300 text-xs font-bold animate-pulse">
                              <Clock className="w-3.5 h-3.5 text-amber-400" />
                              <span>
                                Quedan {min}:{sec < 10 ? `0${sec}` : sec} para pagar
                              </span>
                            </div>
                          )}

                          {isExpired && (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-bold">
                              <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                              <span>Reserva Expirada (Cupo liberado)</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Code Banner & Transfer Info */}
                      <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                        <div className="space-y-0.5">
                          <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                            Código que le da el bar para pagar:
                          </span>
                          <span className="font-mono text-base font-black text-amber-400 tracking-wider">
                            {res.eventCode}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyCode(res.eventCode)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-[11px] flex items-center gap-1 transition-colors"
                        >
                          <Copy className="w-3 h-3" />
                          <span>{copiedCode === res.eventCode ? 'Copiado' : 'Copiar'}</span>
                        </button>
                      </div>

                      {/* Details Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
                          <span>
                            <strong>{res.venueName}</strong> — {res.venueAddress} ({res.venueNeighborhood})
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-amber-400 shrink-0" />
                          <span>
                            {formatDateBA(res.eventDate)} • {res.eventStartTime} a {res.eventEndTime} hs
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-amber-400 shrink-0" />
                          <span>Lugares: {res.partySize} personas</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-amber-400 shrink-0" />
                          <span>Monto Total: <strong>{formatARS(res.totalARS)}</strong></span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                        {/* Status Note */}
                        <div>
                          {res.status === 'confirmada' && (
                            <span className="text-emerald-400 font-semibold text-[11px] flex items-center gap-1">
                              <CheckCircle className="w-3.5 h-3.5" />
                              <span>Entrada y QR enviados a tu correo ({res.userEmail})</span>
                            </span>
                          )}
                          {res.status === 'comprobante_subido' && (
                            <span className="text-cyan-300 text-[11px]">
                              El bar recibió tu alerta y está revisando la acreditación.
                            </span>
                          )}
                          {res.status === 'pendiente_pago' && !isExpired && (
                            <span className="text-amber-400 text-[11px]">
                              Transferí indicando el código y subí la captura antes de que venza.
                            </span>
                          )}
                        </div>

                        {/* Buttons */}
                        <div className="flex items-center gap-2 ml-auto">
                          {res.status === 'pendiente_pago' && !isExpired && (
                            <>
                              <button
                                onClick={() => {
                                  if (window.confirm('¿Querés cancelar esta reserva de mesa? Se liberará el cupo de inmediato.')) {
                                    cancelPublicEventReservation(res.id);
                                  }
                                }}
                                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-rose-950/40 text-rose-300 border border-slate-700 hover:border-rose-500/40 text-xs font-semibold flex items-center gap-1 transition-all"
                                title="Dejar caer la reserva de inmediato"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Cancelar Reserva</span>
                              </button>
                              <button
                                onClick={() => setSelectedResForUpload(res)}
                                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md"
                              >
                                <Upload className="w-3.5 h-3.5" />
                                <span>Subir Comprobante</span>
                              </button>
                            </>
                          )}

                          {res.status === 'confirmada' && (
                            <>
                              <button
                                onClick={() => downloadOfflineTicket(res)}
                                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1.5 transition border border-slate-700"
                                title="Descargar imagen del pase oficial para mostrar en el bar sin señal"
                              >
                                <Download className="w-3.5 h-3.5 text-amber-400" />
                                <span>Pase Offline</span>
                              </button>
                              <button
                                onClick={() => setVisibleQrResId(visibleQrResId === res.id ? null : res.id)}
                                className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md"
                              >
                                <QrCode className="w-3.5 h-3.5" />
                                <span>{visibleQrResId === res.id ? 'Ocultar QR' : 'Ver QR de Acceso'}</span>
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* QR Pass View */}
                      {visibleQrResId === res.id && res.status === 'confirmada' && (
                        <div className="p-4 bg-slate-950 rounded-2xl border border-emerald-500/40 text-center space-y-3 animate-in fade-in duration-200">
                          <div className="w-40 h-40 mx-auto bg-white p-2.5 rounded-2xl shadow-lg">
                            <img
                              src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(
                                res.qrTicketCode || `DeGira:Reserva:${res.eventCode}:${res.partySize}p`
                              )}`}
                              alt="Código QR de Acceso al Bar"
                              className="w-full h-full object-contain"
                            />
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs font-black text-emerald-400">
                              Pase de Entrada Verificado • {res.venueName}
                            </p>
                            <p className="text-[11px] text-slate-400">
                              Mostrá este código QR en el ingreso para {res.partySize} personas.
                            </p>
                            <button
                              onClick={() => downloadOfflineTicket(res)}
                              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-bold rounded-lg border border-amber-500/30 transition"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Guardar Pase en mi Celular (Uso Offline)</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Legacy / Direct Mercado Pago Confirmed Reservations */}
                {reservations.map((res) => (
                  <div
                    key={res.id}
                    className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3 shadow-lg"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-amber-400 uppercase tracking-wide">
                            {res.showTitle || res.musicianName}
                          </span>
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                            Cód: {res.reservationCode}
                          </span>
                        </div>
                        <h4 className="text-base font-extrabold text-slate-100 mt-0.5">
                          {res.musicianName}
                        </h4>
                      </div>

                      <div>
                        {res.paymentStatus === 'pagado_mp' ? (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold">
                            <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3]" />
                            <span>Pagado con Mercado Pago</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-bold">
                            <Clock className="w-3.5 h-3.5 text-amber-400" />
                            <span>Pago Pendiente</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>
                          <strong>{res.venueName}</strong> — {res.venueAddress} ({res.venueNeighborhood})
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>
                          {formatDateBA(res.showDate)} • {res.showTime}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>Mesa para {res.partySize} personas</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>Total abonado: <strong>{formatARS(res.totalARS)}</strong></span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                      {res.mpPaymentId && (
                        <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                          <CreditCard className="w-3 h-3 text-[#009EE3]" />
                          <span>Comprobante MP: <strong>{res.mpPaymentId}</strong></span>
                        </span>
                      )}

                      <div className="flex items-center gap-2 ml-auto">
                        <button
                          onClick={() => setVisibleQrResId(visibleQrResId === res.id ? null : res.id)}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center gap-1.5 transition-colors"
                        >
                          <QrCode className="w-3.5 h-3.5 text-amber-400" />
                          <span>{visibleQrResId === res.id ? 'Ocultar Pase' : 'Ver Pase QR'}</span>
                        </button>
                      </div>
                    </div>

                    {visibleQrResId === res.id && (
                      <div className="p-4 bg-slate-950 rounded-xl border border-amber-500/30 text-center space-y-2 animate-in fade-in duration-200">
                        <div className="w-36 h-36 mx-auto bg-white p-2 rounded-xl shadow-md">
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(
                              `DeGira:Reserva:${res.reservationCode}:Titular:${res.userName}:Show:${res.musicianName}:Bar:${res.venueName}`
                            )}`}
                            alt="Código QR de la reserva"
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <p className="text-xs font-bold text-slate-200">
                          Pase de Acceso para la puerta de {res.venueName}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Presentá este código QR o indicá el código <strong>{res.reservationCode}</strong> al llegar.
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB PENDIENTES DE CALIFICAR (RESEÑAS DEL PÚBLICO TRAS 1 HORA O SHOW) */}
        {spectatorTab === 'pendientes_calificar' && (
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-2 shadow-xl">
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                <h3 className="text-base font-bold text-slate-100 font-display">
                  Eventos y Bares Pendientes de Calificar
                </h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Una hora después de finalizado cada evento, se habilita la calificación 360°. Calificá la experiencia en el bar y la actuación de los músicos para desbloquear cupones de descuento.
              </p>
            </div>

            {publicEventReservations.filter((r) => r.status === 'confirmada').length === 0 && reservations.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-2">
                <div className="text-3xl">⭐</div>
                <h4 className="text-sm font-bold text-slate-200">No tenés eventos pendientes de calificación</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Aparecerán aquí los shows a los que asistas para dejar tu opinión transparente del local y de los artistas.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {publicEventReservations
                  .filter((r) => r.status === 'confirmada')
                  .map((res) => (
                    <div
                      key={res.id}
                      className="bg-slate-900/90 border border-amber-500/30 rounded-2xl p-4 sm:p-5 space-y-3 shadow-md"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-bold uppercase text-amber-400 tracking-wider">
                            Pase Confirmado • Listo para reseña
                          </span>
                          <h4 className="text-base font-bold text-slate-100 mt-0.5">{res.eventTitle}</h4>
                          <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                            <MapPin className="w-3.5 h-3.5 text-amber-400" />
                            <span>{res.venueName} • {res.venueNeighborhood} ({formatDateBA(res.eventDate)})</span>
                          </div>
                        </div>

                        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                          Pendiente
                        </span>
                      </div>

                      <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                        <span className="text-[11px] text-slate-400">
                          Tu reseña bilateral premia a los mejores bares de Buenos Aires.
                        </span>

                        <button
                          onClick={() => {
                            if (onOpenReviewModal) {
                              onOpenReviewModal({
                                targetType: 'venue',
                                targetId: res.venueId,
                                targetName: res.venueName,
                                showDate: res.eventDate,
                                showVenueName: res.venueName,
                                showIdToComplete: res.eventId,
                              });
                            }
                          }}
                          className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md"
                        >
                          <Star className="w-3.5 h-3.5 fill-slate-950" />
                          <span>Calificar Bar & Músicos</span>
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: MIS PREFERENCIAS & DATOS PERSONALES */}
        {spectatorTab === 'preferencias' && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-5 shadow-xl">
            <div>
              <h3 className="text-base font-bold text-slate-100">
                Mi Perfil y Preferencias Porteñas
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Validá tus datos personales de contacto, activá notificaciones push y personalizá tus barrios y géneros favoritos.
              </p>
            </div>

            {/* DATOS PERSONALES DEL ESPECTADOR (VALIDAR O CAMBIAR DATOS) */}
            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 block">
                👤 Mis Datos Personales (Validar o Cambiar)
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Nombre completo:</label>
                  <input
                    type="text"
                    value={customNameInput}
                    onChange={(e) => setCustomNameInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Correo electrónico:</label>
                  <input
                    type="email"
                    value={customEmailInput}
                    onChange={(e) => setCustomEmailInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Teléfono / WhatsApp:</label>
                  <input
                    type="tel"
                    value={customPhoneInput}
                    onChange={(e) => setCustomPhoneInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => {
                    updatePublicUserProfile({
                      name: customNameInput.trim() || userDisplayName,
                      email: customEmailInput.trim(),
                      phone: customPhoneInput.trim(),
                    });
                    setUserDataSavedFeedback(true);
                    setTimeout(() => setUserDataSavedFeedback(false), 2500);
                  }}
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow transition"
                >
                  Guardar Datos de Contacto
                </button>
                {userDataSavedFeedback && (
                  <span className="text-xs font-bold text-emerald-400 animate-in fade-in">
                    ✓ Datos personales validados y guardados
                  </span>
                )}
              </div>
            </div>

            {/* NOTIFICACIONES PUSH PWA */}
            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-slate-200">
                    Notificaciones Push en Tiempo Real (Service Worker PWA)
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  Activas
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Recibí alertas instantáneas en tu navegador sobre confirmaciones de reserva, recordatorios 1 hora post-show para calificar, y novedades de bares y músicos.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={async () => {
                    const { sendPushNotification } = await import('../lib/push.ts');
                    sendPushNotification({
                      title: '🔔 Notificación de Prueba DeGira',
                      body: 'Las notificaciones push en tiempo real están sincronizadas con tu Service Worker.',
                    });
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-bold border border-amber-500/30 transition flex items-center gap-1.5"
                >
                  <Bell className="w-3.5 h-3.5" />
                  <span>Probar Notificación Push</span>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 block">
                Géneros Musicales Favoritos
              </span>
              <div className="flex flex-wrap gap-2">
                {allGenres.map((g) => {
                  const isSelected = selectedGenres.includes(g);
                  return (
                    <button
                      key={g}
                      type="button"
                      onClick={() => toggleGenre(g)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                        isSelected
                          ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-md shadow-amber-500/20'
                          : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {isSelected ? `✓ ${g}` : g}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-800">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 block">
                Barrios Porteños de Interés (CABA)
              </span>
              <div className="flex flex-wrap gap-2">
                {allHoods.map((h) => {
                  const isSelected = selectedHoods.includes(h);
                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => toggleHood(h)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                        isSelected
                          ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-500/20'
                          : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {isSelected ? `✓ ${h}` : h}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={handleSavePreferences}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all"
              >
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>Guardar Preferencias</span>
              </button>
              {prefsSaved && (
                <span className="text-xs font-bold text-emerald-400 animate-in fade-in">
                  ¡Preferencias actualizadas con éxito!
                </span>
              )}
            </div>
          </div>
        )}




        {/* Modal para subir comprobante */}
        <UploadReceiptModal
          isOpen={!!selectedResForUpload}
          onClose={() => setSelectedResForUpload(null)}
          reservation={selectedResForUpload}
        />
      </div>
    );
  }

  // 2. VENUE OR MUSICIAN PROFILE VIEW
  let isVenue = false;
  let venueProfile = currentVenue;
  let musicianProfile = currentMusician;

  if (viewingTarget) {
    if (viewingTarget.type === 'venue') {
      isVenue = true;
      venueProfile = venues.find((v) => v.id === viewingTarget.id) || currentVenue;
    } else {
      isVenue = false;
      musicianProfile = musicians.find((m) => m.id === viewingTarget.id) || currentMusician;
    }
  } else {
    isVenue = role === 'bar';
  }

  // Pending payment receipts to confirm by the bar
  const pendingReceipts = publicEventReservations.filter((r) => r.status === 'comprobante_subido');

  return (
    <div className="space-y-5 pb-24 animate-in fade-in duration-200">
      {viewingTarget && onClearTarget && (
        <button
          onClick={onClearTarget}
          className="text-xs text-amber-400 hover:text-amber-300 flex items-center space-x-1 font-semibold"
        >
          <span>← Volver a mi perfil ({role === 'espectador' ? 'Público General' : isVenue ? 'Bar' : 'Músico'})</span>
        </button>
      )}

      {/* Main Profile Header Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="relative h-44 sm:h-52 w-full bg-slate-950">
          <img
            src={
              isVenue
                ? venueProfile?.coverPhoto || ''
                : musicianProfile?.photos[0] || musicianProfile?.avatarUrl || ''
            }
            alt={isVenue ? venueProfile?.name : musicianProfile?.stageName}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent" />

          <div className="absolute top-4 left-4">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-950/80 text-amber-400 border border-amber-500/30 backdrop-blur-md">
              {isVenue ? `🍸 ${venueProfile?.type}` : `🎸 ${musicianProfile?.format}`}
            </span>
          </div>

          <div className="absolute top-4 right-4 flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 backdrop-blur-md">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Perfil Verificado</span>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-100 font-display">
                {isVenue ? venueProfile?.name : musicianProfile?.stageName}
              </h1>
              <div className="flex items-center space-x-2 text-xs text-slate-400 mt-1">
                <MapPin className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  {isVenue
                    ? `${venueProfile?.address}, ${venueProfile?.neighborhood}`
                    : `Buenos Aires (${musicianProfile?.genres.join(', ')})`}
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-3 bg-slate-950/60 p-2.5 rounded-2xl border border-slate-800 self-start sm:self-auto">
              <div className="text-center px-2 border-r border-slate-800">
                <div className="text-xl font-black text-amber-400 flex items-center justify-center">
                  <Star className="w-5 h-5 fill-amber-400 mr-1" />
                  <span>
                    {(isVenue ? venueProfile?.rating : musicianProfile?.rating)?.toFixed(2)}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 font-medium">Reputación</div>
              </div>
              <div className="text-xs text-slate-400">
                <strong className="text-slate-200">
                  {isVenue ? venueProfile?.reviewCount : musicianProfile?.reviewCount}
                </strong>{' '}
                reseñas bilaterales
              </div>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            {isVenue ? venueProfile?.bio : musicianProfile?.bio}
          </p>

          {!isVenue && musicianProfile && (
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-800/80 text-slate-300">
                <Instagram className="w-3.5 h-3.5 mr-1.5 text-pink-400" />
                {musicianProfile.instagramHandle}
              </span>
              {musicianProfile.spotifyDemoTitle && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-800/80 text-emerald-400">
                  <Disc3 className="w-3.5 h-3.5 mr-1.5" />
                  {musicianProfile.spotifyDemoTitle}
                </span>
              )}
            </div>
          )}

          {isVenue && !viewingTarget && (
            <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <span className="font-semibold text-slate-400">Alias Transferencias Bar:</span>
                <span className="font-mono bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800 text-amber-400 font-bold">
                  {venueProfile?.venueCbuAlias || 'degira.bar1.mp'}
                </span>
              </div>
              <button
                onClick={() => setShowDoorCheckInModal(true)}
                className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md transition-all flex items-center gap-1.5"
              >
                <span>🚪 Control de Puerta & Check-in QR</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-2 text-xs font-bold overflow-x-auto">
        <button
          onClick={() => setActiveTab('reviews')}
          className={`px-4 py-2 rounded-xl transition-colors whitespace-nowrap ${
            activeTab === 'reviews'
              ? 'bg-amber-500 text-slate-950 font-black'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Reseñas & Calificaciones ({isVenue ? venueProfile?.reviews.length : musicianProfile?.reviews.length})
        </button>

        <button
          onClick={() => setActiveTab('backline')}
          className={`px-4 py-2 rounded-xl transition-colors whitespace-nowrap ${
            activeTab === 'backline'
              ? 'bg-amber-500 text-slate-950 font-black'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {isVenue ? 'Backline & Sala' : 'Rider Técnico'}
        </button>

        {isVenue && !viewingTarget && (
          <button
            onClick={() => setActiveTab('comprobantes')}
            className={`relative px-4 py-2 rounded-xl transition-colors whitespace-nowrap ${
              activeTab === 'comprobantes'
                ? 'bg-amber-500 text-slate-950 font-black'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Confirmar Pagos ({pendingReceipts.length})</span>
            {pendingReceipts.length > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </button>
        )}

        {isVenue && !viewingTarget && (
          <button
            onClick={() => setActiveTab('borderaux')}
            className={`px-4 py-2 rounded-xl transition-colors whitespace-nowrap ${
              activeTab === 'borderaux'
                ? 'bg-amber-500 text-slate-950 font-black'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Borderaux & Balance
          </button>
        )}

        {!isVenue && !viewingTarget && (
          <button
            onClick={() => setActiveTab('links_musica')}
            className={`px-4 py-2 rounded-xl transition-colors whitespace-nowrap ${
              activeTab === 'links_musica'
                ? 'bg-amber-500 text-slate-950 font-black'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Mis Enlaces & Input List
          </button>
        )}
      </div>

      {/* TAB: COMPROBANTES DE CLIENTES A CONFIRMAR POR EL BAR */}
      {activeTab === 'comprobantes' && isVenue && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Comprobantes de Pago Subidos por el Público ({pendingReceipts.length})
            </h3>
            <span className="text-xs text-amber-400 font-semibold">
              Al confirmar, se descuenta la capacidad y se emite el QR por email
            </span>
          </div>

          {pendingReceipts.length === 0 ? (
            <div className="p-8 bg-slate-900 border border-slate-800 rounded-3xl text-center space-y-2">
              <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto" />
              <h4 className="text-base font-bold text-slate-100">
                No hay pagos pendientes de confirmación
              </h4>
              <p className="text-xs text-slate-400">
                Cuando el público suba un comprobante con el código de tu evento, aparecerá aquí para verificar y aprobar.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingReceipts.map((res) => (
                <div
                  key={res.id}
                  className="p-4 sm:p-5 bg-slate-900 border border-amber-500/40 rounded-2xl space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800">
                    <div>
                      <h4 className="text-base font-bold text-slate-100">{res.eventTitle}</h4>
                      <p className="text-xs text-slate-400">
                        Cliente: <strong>{res.userName}</strong> ({res.userEmail}) • {res.partySize} personas
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block uppercase font-semibold">Código del Evento</span>
                      <span className="font-mono text-sm font-black text-amber-400">{res.eventCode}</span>
                    </div>
                  </div>

                  {res.receiptImage && (
                    <div className="p-2 bg-slate-950 rounded-xl border border-slate-800 flex flex-col sm:flex-row items-center gap-3">
                      <img
                        src={res.receiptImage}
                        alt="Comprobante subido"
                        className="w-36 h-36 object-contain rounded-lg border border-slate-700 bg-black/40"
                      />
                      <div className="text-xs space-y-1.5 flex-1 min-w-0">
                        <div className="font-bold text-slate-200">Lectura Automática Gemini OCR:</div>
                        <p className="text-[11px] text-slate-300 bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                          {res.receiptOcrNotes || 'Comprobante verificado con código correspondiente.'}
                        </p>
                        <div className="text-amber-300 font-bold">
                          Monto a acreditar: {formatARS(res.totalARS)}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-end gap-2">
                    {rejectingResId === res.id ? (
                      <div className="w-full bg-slate-950 p-3 rounded-xl border border-red-500/40 space-y-2 animate-in fade-in">
                        <label className="text-[11px] font-bold text-red-300 block">
                          Motivo del rechazo de transferencia:
                        </label>
                        <input
                          type="text"
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder="Ej: Comprobante ilegible, alias erróneo o importe incompleto"
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-red-400"
                        />
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setRejectingResId(null);
                              setRejectReason('');
                            }}
                            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={() => {
                              rejectReservationPayment(
                                res.id,
                                rejectReason.trim() || 'Comprobante no coincide con la transferencia esperada'
                              );
                              setRejectingResId(null);
                              setRejectReason('');
                            }}
                            className="px-3.5 py-1.5 rounded-lg bg-red-500 hover:bg-red-400 text-white font-bold text-xs"
                          >
                            Confirmar Rechazo
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setRejectingResId(res.id);
                            setRejectReason('');
                          }}
                          className="px-3.5 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold transition-all"
                        >
                          Rechazar Comprobante
                        </button>
                        <button
                          onClick={() => confirmReservationPayment(res.id)}
                          className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-md transition-all flex items-center gap-1.5"
                        >
                          <Check className="w-4 h-4 stroke-[3]" />
                          <span>Confirmar Pago & Enviar Entrada QR</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 1: REVIEWS & BREAKDOWN */}
      {activeTab === 'reviews' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              Desglose de Calificaciones Bilaterales Verificadas
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              {isVenue && venueProfile ? (
                <>
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block text-[11px]">Sonido & Acústica</span>
                    <strong className="text-base text-amber-400 font-extrabold">
                      ⭐ {venueProfile.ratingBreakdown.soundQuality.toFixed(1)}
                    </strong>
                  </div>
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block text-[11px]">Puntualidad de Pago</span>
                    <strong className="text-base text-amber-400 font-extrabold">
                      ⭐ {venueProfile.ratingBreakdown.paymentReliability.toFixed(1)}
                    </strong>
                  </div>
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block text-[11px]">Hospitalidad & Trato</span>
                    <strong className="text-base text-amber-400 font-extrabold">
                      ⭐ {venueProfile.ratingBreakdown.hospitality.toFixed(1)}
                    </strong>
                  </div>
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block text-[11px]">Respeto al Músico</span>
                    <strong className="text-base text-amber-400 font-extrabold">
                      ⭐ {venueProfile.ratingBreakdown.respect.toFixed(1)}
                    </strong>
                  </div>
                </>
              ) : musicianProfile ? (
                <>
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block text-[11px]">Puntualidad Prueba</span>
                    <strong className="text-base text-amber-400 font-extrabold">
                      ⭐ {musicianProfile.ratingBreakdown.punctuality.toFixed(1)}
                    </strong>
                  </div>
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block text-[11px]">Sonido en Vivo</span>
                    <strong className="text-base text-amber-400 font-extrabold">
                      ⭐ {musicianProfile.ratingBreakdown.liveSound.toFixed(1)}
                    </strong>
                  </div>
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block text-[11px]">Convocatoria Público</span>
                    <strong className="text-base text-amber-400 font-extrabold">
                      ⭐ {musicianProfile.ratingBreakdown.crowdDrawing.toFixed(1)}
                    </strong>
                  </div>
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block text-[11px]">Profesionalismo</span>
                    <strong className="text-base text-amber-400 font-extrabold">
                      ⭐ {musicianProfile.ratingBreakdown.professionalism.toFixed(1)}
                    </strong>
                  </div>
                </>
              ) : null}
            </div>
          </div>

          {/* Reviews List */}
          <div className="space-y-3">
            {(isVenue ? venueProfile?.reviews : musicianProfile?.reviews)?.map((rev) => (
              <div
                key={rev.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <img
                      src={rev.authorAvatar}
                      alt={rev.authorName}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-200">{rev.authorName}</div>
                      <div className="text-[10px] text-slate-500">
                        Show en {rev.showVenueName} • {formatDateBA(rev.showDate)}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-black text-amber-400">
                    {'⭐'.repeat(rev.rating)}
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">{rev.comment}</p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {rev.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-400"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: BACKLINE & TECHNICAL RIDER */}
      {activeTab === 'backline' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          {isVenue && venueProfile ? (
            <>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Speaker className="w-4 h-4 text-amber-400" />
                <span>Equipamiento y Backline Provisto por Bar Test 1</span>
              </h3>
              <ul className="space-y-2 text-xs text-slate-300">
                {venueProfile.backline.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-1">
                <strong>Acústica de Sala:</strong>
                <p>{venueProfile.acousticCharacteristics}</p>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-1">
                <strong>Hospitalidad Músicos:</strong>
                <p>{venueProfile.hospitality}</p>
              </div>
            </>
          ) : musicianProfile ? (
            <>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Music className="w-4 h-4 text-amber-400" />
                <span>Rider Técnico y Cachet de Referencia</span>
              </h3>
              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-2">
                <span className="text-[11px] font-bold text-amber-400 block">
                  Requerimientos Técnicos para el Bar:
                </span>
                <p className="leading-relaxed">{musicianProfile.technicalRider}</p>
              </div>
              <div className="flex items-center justify-between p-3.5 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                <span className="text-slate-400">Cachet sugerido / base:</span>
                <strong className="text-base text-amber-400 font-extrabold">
                  {formatARS(musicianProfile.minCachetDefault)}
                </strong>
              </div>
            </>
          ) : null}
        </div>
      )}


      {/* TAB 4: BORDERAUX & BALANCE EN VIVO (BAR) */}
      {activeTab === 'borderaux' && isVenue && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-400" />
                  <span>Borderaux del Evento & Liquidación de Sala</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Total recaudado por entradas vs. cachet pactado al músico = Margen neto de sala
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 self-start sm:self-auto">
                Borderaux en Vivo 100% Transparente
              </span>
            </div>

            {(() => {
              const venueEvents = eventProposals.filter((p) => p.venueId === (venueProfile?.id || 'bar-1'));
              const totalGross = venueEvents.reduce((acc, p) => {
                const confirmed = publicEventReservations.filter(
                  (r) => r.eventId === p.id && r.status === 'confirmada'
                );
                const attendees = confirmed.reduce((sum, r) => sum + r.partySize, 0);
                return acc + attendees * (p.ticketPriceARS || 8000);
              }, 0);

              const totalCachets = venueEvents.reduce((acc, p) => acc + (p.baseCachetARS || 0), 0);
              const totalNet = totalGross - totalCachets;

              return (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-[11px] text-slate-400 block font-medium">Recaudación Bruta Entradas</span>
                    <strong className="text-lg text-emerald-400 font-extrabold">{formatARS(totalGross)}</strong>
                  </div>
                  <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-[11px] text-slate-400 block font-medium">Cachet Pactado a Músicos</span>
                    <strong className="text-lg text-amber-400 font-extrabold">{formatARS(totalCachets)}</strong>
                  </div>
                  <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-[11px] text-slate-400 block font-medium">Margen Neto de Sala</span>
                    <strong className={`text-lg font-extrabold ${totalNet >= 0 ? 'text-cyan-400' : 'text-red-400'}`}>
                      {formatARS(totalNet)}
                    </strong>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* List of events */}
          <div className="space-y-3">
            {eventProposals
              .filter((p) => p.venueId === (venueProfile?.id || 'bar-1'))
              .map((p) => {
                const confirmed = publicEventReservations.filter(
                  (r) => r.eventId === p.id && r.status === 'confirmada'
                );
                const attendees = confirmed.reduce((sum, r) => sum + r.partySize, 0);
                const ticketPrice = p.ticketPriceARS || 8000;
                const grossRevenue = attendees * ticketPrice;
                const netMargin = grossRevenue - p.baseCachetARS;
                const musicianNames = p.slots.map((s) => s.assignedMusicianName).filter(Boolean).join(', ') || 'Artista Convocado';

                return (
                  <div
                    key={p.id}
                    className="p-4 sm:p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-3.5"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-bold text-slate-100">{p.title}</h4>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-amber-400 font-bold">
                            {formatDateBA(p.date)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Músico asignado: <strong className="text-slate-200">{musicianNames}</strong>
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block uppercase font-medium">Precio Entrada</span>
                        <span className="text-sm font-black text-amber-400">{formatARS(ticketPrice)} / pers</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">Público Confirmado</span>
                        <strong className="text-slate-100 font-bold">{attendees} personas</strong>
                      </div>
                      <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">Recaudación Bruta</span>
                        <strong className="text-emerald-400 font-bold">{formatARS(grossRevenue)}</strong>
                      </div>
                      <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">Cachet Músico</span>
                        <strong className="text-amber-400 font-bold">{formatARS(p.baseCachetARS)}</strong>
                      </div>
                      <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">Margen Neto Bar</span>
                        <strong className={`font-bold ${netMargin >= 0 ? 'text-cyan-400' : 'text-red-400'}`}>
                          {formatARS(netMargin)}
                        </strong>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                      <div className="text-xs text-slate-400">
                        {p.cachetPaid ? (
                          <span className="inline-flex items-center gap-1.5 text-emerald-400 font-semibold">
                            <CheckCircle className="w-4 h-4" />
                            <span>Cachet liquidado el {formatDateBA(p.cachetPaidAt || new Date().toISOString())}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-amber-400 font-semibold">
                            <Clock className="w-4 h-4" />
                            <span>Liquidación pendiente de pago al músico</span>
                          </span>
                        )}
                      </div>

                      {!p.cachetPaid && (
                        <button
                          onClick={() => liquidateMusicianCachet(p.id)}
                          className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-md transition-all flex items-center justify-center gap-1.5 self-start sm:self-auto"
                        >
                          <DollarSign className="w-4 h-4 stroke-[3]" />
                          <span>Liquidar Cachet al Músico ({formatARS(p.baseCachetARS)})</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* TAB 5: MIS ENLACES DE ESCUCHA RÁPIDA & INPUT LIST (MÚSICO) */}
      {activeTab === 'links_musica' && !isVenue && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Headphones className="w-5 h-5 text-amber-400" />
                <span>Enlaces de Escucha Rápida & Rider del Músico</span>
              </h3>
              <p className="text-xs text-slate-400">
                Compartí tu música directamente vía Spotify, YouTube o Bandcamp (sin archivos de video pesados) y configurá tu lista de canales (Input List).
              </p>
            </div>

            {musicianSavedSuccess && (
              <div className="p-3 bg-emerald-500/15 border border-emerald-500/40 rounded-xl text-emerald-400 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>¡Perfil musical y rider guardados exitosamente! Ya se aplicaron a tus postulaciones.</span>
              </div>
            )}

            {/* Streaming Links */}
            <div className="space-y-3 pt-2 border-t border-slate-800">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Enlaces a Plataformas de Música
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1.5">
                    <Disc3 className="w-3.5 h-3.5" />
                    <span>Link Spotify (Artista / Track)</span>
                  </label>
                  <input
                    type="url"
                    value={musicianLinks.spotifyUrl || ''}
                    onChange={(e) => setMusicianLinks({ ...musicianLinks, spotifyUrl: e.target.value })}
                    placeholder="https://open.spotify.com/artist/..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-red-400 flex items-center gap-1.5">
                    <Music className="w-3.5 h-3.5" />
                    <span>Link YouTube (Video / Canal)</span>
                  </label>
                  <input
                    type="url"
                    value={musicianLinks.youtubeUrl || ''}
                    onChange={(e) => setMusicianLinks({ ...musicianLinks, youtubeUrl: e.target.value })}
                    placeholder="https://youtube.com/watch?v=..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-cyan-400 flex items-center gap-1.5">
                    <Headphones className="w-3.5 h-3.5" />
                    <span>Link Bandcamp / Soundcloud</span>
                  </label>
                  <input
                    type="url"
                    value={musicianLinks.bandcampUrl || ''}
                    onChange={(e) => setMusicianLinks({ ...musicianLinks, bandcampUrl: e.target.value })}
                    placeholder="https://tu-banda.bandcamp.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>
            </div>

            {/* Input List / Stage Plot */}
            <div className="space-y-3 pt-3 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 text-amber-400" />
                    <span>Input List & Canales de Escenario (Rider de Sonido)</span>
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Especificá canales para que el sonidista del bar arme la consola antes de la prueba.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const nextCh = musicianInputList.length + 1;
                    setMusicianInputList([
                      ...musicianInputList,
                      { channel: nextCh, instrument: '', micOrDI: 'Micrófono', notes: '' },
                    ]);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-bold text-xs transition-colors"
                >
                  ＋ Agregar Canal
                </button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-950 text-slate-400 font-bold uppercase text-[10px] border-b border-slate-800">
                    <tr>
                      <th className="p-2.5 w-14 text-center">Ch</th>
                      <th className="p-2.5">Instrumento / Voz</th>
                      <th className="p-2.5 w-48">Conexión (Mic / DI)</th>
                      <th className="p-2.5">Notas / Efectos</th>
                      <th className="p-2.5 w-12 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 bg-slate-900/60">
                    {musicianInputList.map((ch, idx) => (
                      <tr key={idx} className="hover:bg-slate-900">
                        <td className="p-2.5 text-center font-bold text-amber-400">
                          {ch.channel}
                        </td>
                        <td className="p-2.5">
                          <input
                            type="text"
                            value={ch.instrument}
                            onChange={(e) => {
                              const updated = [...musicianInputList];
                              updated[idx].instrument = e.target.value;
                              setMusicianInputList(updated);
                            }}
                            placeholder="Ej: Voz Principal"
                            className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                          />
                        </td>
                        <td className="p-2.5">
                          <select
                            value={ch.micOrDI}
                            onChange={(e) => {
                              const updated = [...musicianInputList];
                              updated[idx].micOrDI = e.target.value as MusicianInputChannel['micOrDI'];
                              setMusicianInputList(updated);
                            }}
                            className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                          >
                            <option value="Micrófono">Micrófono</option>
                            <option value="Caja Directa (DI)">Caja Directa (DI)</option>
                            <option value="Línea Estéreo">Línea Estéreo</option>
                            <option value="Propio">Propio</option>
                          </select>
                        </td>
                        <td className="p-2.5">
                          <input
                            type="text"
                            value={ch.notes || ''}
                            onChange={(e) => {
                              const updated = [...musicianInputList];
                              updated[idx].notes = e.target.value;
                              setMusicianInputList(updated);
                            }}
                            placeholder="Ej: Reverb suave / Monitor piso"
                            className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                          />
                        </td>
                        <td className="p-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              const updated = musicianInputList
                                .filter((_, i) => i !== idx)
                                .map((item, i) => ({ ...item, channel: i + 1 }));
                              setMusicianInputList(updated);
                            }}
                            className="text-slate-500 hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    if (currentMusician) {
                      updateMusicianMusicLinks(currentMusician.id, musicianLinks, musicianInputList);
                      setMusicianSavedSuccess(true);
                      setTimeout(() => setMusicianSavedSuccess(false), 3000);
                    }
                  }}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md transition-all flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Guardar Enlaces & Rider de Canales</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cerrar sesión */}
      {onSignOut && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 flex items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0">
              <LogOut className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h4 className="text-xs font-bold text-slate-200 truncate">
                Sesión iniciada como {userDisplayName}
              </h4>
              <p className="text-[11px] text-slate-400 truncate">
                Cerrá sesión para cambiar de perfil o acceder con otra cuenta.
              </p>
            </div>
          </div>
          <button
            onClick={onSignOut}
            className="px-3.5 py-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/40 text-red-400 hover:text-red-300 font-bold text-xs flex items-center gap-1.5 transition-colors shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Cerrar sesión</span>
          </button>
        </div>
      )}

      {/* Modal de Control de Puerta y Check-in QR */}
      <BarDoorCheckInModal
        isOpen={showDoorCheckInModal}
        onClose={() => setShowDoorCheckInModal(false)}
      />
    </div>
  );
};
