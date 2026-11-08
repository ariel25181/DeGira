import React, { useState } from 'react';
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
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { formatARS, formatDateBA } from '../utils/bookingLogic.ts';
import { MusicGenre, NeighborhoodBA } from '../types/index.ts';

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
    payReservation,
    cancelReservation,
    setActiveMusicianId,
    setActiveVenueId,
    resetAllData,
  } = useApp();

  // Spectator tabs
  const [spectatorTab, setSpectatorTab] = useState<'reservas' | 'preferencias' | 'cuentas'>('reservas');
  const [visibleQrResId, setVisibleQrResId] = useState<string | null>(null);
  const [customNameInput, setCustomNameInput] = useState<string>(userDisplayName);

  // Musician / Venue tabs
  const [activeTab, setActiveTab] = useState<'reviews' | 'backline' | 'switch_demo'>('reviews');

  // Selected genres & hoods for spectator
  const [selectedGenres, setSelectedGenres] = useState<MusicGenre[]>(
    currentPublicUser?.favoriteGenres || ['Jazz', 'Blues & Soul']
  );
  const [selectedHoods, setSelectedHoods] = useState<NeighborhoodBA[]>(
    currentPublicUser?.preferredNeighborhoods || ['Palermo Soho', 'Palermo Hollywood']
  );
  const [prefsSaved, setPrefsSaved] = useState<boolean>(false);

  // 1. PUBLIC GENERAL (ESPECTADOR) PROFILE VIEW
  if (!viewingTarget && role === 'espectador') {
    const userReservations = reservations;

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
                Panel de Público General • Reservas de shows, pagos con Mercado Pago y preferencias
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
                    Cuenta Verificada
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1 text-[#009EE3] font-semibold">
                    <CreditCard className="w-3.5 h-3.5" />
                    Mercado Pago Activo
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
          <div className="grid grid-cols-3 p-1 bg-slate-950 rounded-2xl border border-slate-800 text-xs font-bold">
            <button
              onClick={() => setSpectatorTab('reservas')}
              className={`py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                spectatorTab === 'reservas'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Ticket className="w-3.5 h-3.5" />
              <span>Mis Reservas ({userReservations.length})</span>
            </button>

            <button
              onClick={() => setSpectatorTab('preferencias')}
              className={`py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                spectatorTab === 'preferencias'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Music className="w-3.5 h-3.5" />
              <span>Preferencias</span>
            </button>

            <button
              onClick={() => setSpectatorTab('cuentas')}
              className={`py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                spectatorTab === 'cuentas'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Cuentas Test</span>
            </button>
          </div>
        </div>

        {/* TAB 1: MIS RESERVAS DE SHOWS (CONECTADAS A MERCADO PAGO) */}
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

            {userReservations.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-3">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-3xl">
                  🎫
                </div>
                <h4 className="text-base font-bold text-slate-100">
                  Todavía no tenés reservas activas
                </h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Entrá a la Cartelera de Buenos Aires para descubrir los recitales en vivo en Bar Test 1 y pagar tu consumición o ticket con Mercado Pago.
                </p>
                {onSelectTab && (
                  <button
                    onClick={() => onSelectTab('cartelera')}
                    className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs inline-flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all"
                  >
                    <Calendar className="w-4 h-4" />
                    <span>Ver Cartelera de Recitales</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {userReservations.map((res) => (
                  <div
                    key={res.id}
                    className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3 shadow-lg"
                  >
                    {/* Header of reservation */}
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

                      {/* Mercado Pago Status Badge */}
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

                    {/* Venue & Details */}
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

                    {/* Mercado Pago info & QR button */}
                    <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        {res.mpPaymentId && (
                          <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                            <CreditCard className="w-3 h-3 text-[#009EE3]" />
                            <span>Comprobante MP: <strong>{res.mpPaymentId}</strong></span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 ml-auto">
                        {res.paymentStatus === 'pendiente_mp' && (
                          <button
                            onClick={() => payReservation(res.id)}
                            className="px-3 py-1.5 rounded-lg bg-[#009EE3] hover:bg-[#0082b9] text-white font-bold text-xs flex items-center gap-1.5 shadow-md"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>Pagar con Mercado Pago</span>
                          </button>
                        )}

                        <button
                          onClick={() => setVisibleQrResId(visibleQrResId === res.id ? null : res.id)}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center gap-1.5 transition-colors"
                        >
                          <QrCode className="w-3.5 h-3.5 text-amber-400" />
                          <span>{visibleQrResId === res.id ? 'Ocultar Pase' : 'Ver Pase QR'}</span>
                        </button>

                        <button
                          onClick={() => cancelReservation(res.id)}
                          title="Cancelar reserva"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* QR Code expansion */}
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

        {/* TAB 2: MIS PREFERENCIAS (GÉNEROS Y BARRIOS) */}
        {spectatorTab === 'preferencias' && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-5 shadow-xl">
            <div>
              <h3 className="text-base font-bold text-slate-100">
                Personalizá tu Experiencia Musical
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Seleccioná tus géneros favoritos y barrios porteños para filtrar automáticamente la cartelera.
              </p>
            </div>

            {/* Géneros */}
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

            {/* Barrios */}
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

        {/* TAB 3: CUENTAS TEST (USUARIO PÚBLICO 1 Y USUARIO PÚBLICO 2) */}
        {spectatorTab === 'cuentas' && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-5 shadow-xl">
            <div>
              <h3 className="text-base font-bold text-slate-100">
                Usuarios de Prueba de Público General
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Alterná instantáneamente entre los 2 perfiles de prueba de espectadores:
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {publicUsers.map((u) => {
                const isCurrent = currentPublicUser?.id === u.id;
                return (
                  <button
                    key={u.id}
                    onClick={() => {
                      setActivePublicUserId(u.id);
                      setUserDisplayName(u.name);
                    }}
                    className={`p-3.5 rounded-2xl border flex items-center justify-between text-left transition-all ${
                      isCurrent
                        ? 'bg-amber-500/15 border-amber-500/80 text-amber-300 shadow-md shadow-amber-500/10'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={u.avatarUrl}
                        alt={u.name}
                        className="w-10 h-10 rounded-xl object-cover"
                      />
                      <div>
                        <div className="font-extrabold text-sm text-slate-100">{u.name}</div>
                        <div className="text-[11px] text-slate-400">{u.email}</div>
                      </div>
                    </div>

                    <div className="text-right">
                      {isCurrent ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-400">
                          <Check className="w-4 h-4 stroke-[2.5]" />
                          <span>Activo</span>
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-slate-500">Seleccionar</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Custom Name Edit */}
            <form onSubmit={handleUpdateName} className="pt-3 border-t border-slate-800 space-y-2">
              <label className="text-xs font-bold text-slate-300 block">
                Cambiar nombre para reservas:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customNameInput}
                  onChange={(e) => setCustomNameInput(e.target.value)}
                  placeholder="Tu nombre completo"
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-slate-100 focus:border-amber-500 outline-none"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200"
                >
                  Guardar
                </button>
              </div>
            </form>

            {/* Reset Data */}
            <div className="pt-3 border-t border-slate-800 text-center">
              <button
                onClick={resetAllData}
                className="text-xs text-rose-400 hover:text-rose-300 font-semibold flex items-center justify-center space-x-1.5 mx-auto"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restablecer Datos de Prueba</span>
              </button>
            </div>
          </div>
        )}

        {/* Cerrar sesión card */}
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
                  Podés cerrar sesión para entrar con otra cuenta o cambiar de rol.
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
      </div>
    );
  }

  // 2. VENUE OR MUSICIAN PROFILE VIEW (for Bar Test 1, Músico Test 1, Músico Test 2)
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

  return (
    <div className="space-y-5 pb-24 animate-in fade-in duration-200">
      {/* If viewing external profile, show back button */}
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
        {/* Cover Photo */}
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

          {/* Type Tag */}
          <div className="absolute top-4 left-4">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-950/80 text-amber-400 border border-amber-500/30 backdrop-blur-md">
              {isVenue ? `🍸 ${venueProfile?.type}` : `🎸 ${musicianProfile?.format}`}
            </span>
          </div>

          {/* Verified Badge */}
          <div className="absolute top-4 right-4 flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 backdrop-blur-md">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Perfil Verificado</span>
          </div>
        </div>

        {/* Profile Info & Bio */}
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

            {/* Overall Rating Badge */}
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

          {/* Social & Demos */}
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
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-2 text-xs font-bold">
        <button
          onClick={() => setActiveTab('reviews')}
          className={`px-4 py-2 rounded-xl transition-colors ${
            activeTab === 'reviews'
              ? 'bg-amber-500 text-slate-950 font-black'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Reseñas & Métricas ({isVenue ? venueProfile?.reviews.length : musicianProfile?.reviews.length})
        </button>

        <button
          onClick={() => setActiveTab('backline')}
          className={`px-4 py-2 rounded-xl transition-colors ${
            activeTab === 'backline'
              ? 'bg-amber-500 text-slate-950 font-black'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {isVenue ? 'Backline & Sala' : 'Rider Técnico'}
        </button>

        {!viewingTarget && (
          <button
            onClick={() => setActiveTab('switch_demo')}
            className={`px-4 py-2 rounded-xl transition-colors ${
              activeTab === 'switch_demo'
                ? 'bg-amber-500 text-slate-950 font-black'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Cambiar Entidad Test
          </button>
        )}
      </div>

      {/* TAB 1: REVIEWS & BREAKDOWN */}
      {activeTab === 'reviews' && (
        <div className="space-y-4">
          {/* Breakdown criteria */}
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

      {/* TAB 3: SWITCH TEST ENTITIES (Bar Test 1, Músico Test 1, Músico Test 2) */}
      {activeTab === 'switch_demo' && !viewingTarget && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-5">
          <div>
            <h3 className="text-base font-bold text-slate-100">
              Alternar Entidad de Prueba
            </h3>
            <p className="text-xs text-slate-400">
              Elegí entre Bar Test 1, Músico Test 1 o Músico Test 2:
            </p>
          </div>

          {/* Bar Selector */}
          <div className="space-y-2">
            <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] block">
              Bar de Prueba
            </span>
            <div className="grid grid-cols-1 gap-2">
              {venues.map((v) => (
                <button
                  key={v.id}
                  onClick={() => {
                    setActiveVenueId(v.id);
                    setRole('bar');
                    setUserDisplayName(v.name);
                    setActiveTab('reviews');
                  }}
                  className={`p-3 rounded-xl border flex items-center justify-between text-left transition-all ${
                    currentVenue?.id === v.id && role === 'bar'
                      ? 'bg-amber-500/20 border-amber-500/80 text-amber-300'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <img
                      src={v.photos[0]}
                      alt={v.name}
                      className="w-10 h-10 rounded-lg object-cover"
                    />
                    <div>
                      <div className="font-bold text-slate-100">{v.name}</div>
                      <div className="text-[11px] text-slate-400">
                        {v.neighborhood} • {v.type}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-amber-400">⭐ {v.rating.toFixed(2)}</span>
                    <span className="block text-[10px] text-slate-500">{v.reviewCount} reseñas</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Musicians Selector */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] block">
              Músicos de Prueba
            </span>
            <div className="grid grid-cols-1 gap-2">
              {musicians.map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    setActiveMusicianId(m.id);
                    setRole('musico');
                    setUserDisplayName(m.stageName);
                    setActiveTab('reviews');
                  }}
                  className={`p-3 rounded-xl border flex items-center justify-between text-left transition-all ${
                    currentMusician?.id === m.id && role === 'musico'
                      ? 'bg-amber-500/20 border-amber-500/80 text-amber-300'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <img
                      src={m.avatarUrl}
                      alt={m.stageName}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <div>
                      <div className="font-bold text-slate-100">{m.stageName}</div>
                      <div className="text-[11px] text-slate-400">
                        {m.format} • {m.genres.join(', ')}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-amber-400">⭐ {m.rating.toFixed(2)}</span>
                    <span className="block text-[10px] text-slate-500">{m.reviewCount} reseñas</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Reset button */}
          <div className="pt-3 border-t border-slate-800 text-center">
            <button
              onClick={resetAllData}
              className="text-xs text-rose-400 hover:text-rose-300 font-semibold flex items-center justify-center space-x-1.5 mx-auto"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restablecer Datos Iniciales de Prueba</span>
            </button>
          </div>
        </div>
      )}

      {/* Cerrar sesión card for Musician / Venue */}
      {!viewingTarget && onSignOut && (
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
                Podés cerrar sesión para ingresar con otra cuenta o cambiar de rol.
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
    </div>
  );
};
