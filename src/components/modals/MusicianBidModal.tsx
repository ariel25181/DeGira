import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Music,
  DollarSign,
  Clock,
  Speaker,
  Users,
  Check,
  ArrowRight,
  ShieldAlert,
  Headphones,
  Sliders,
  Plus,
  Trash2,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import { CachetMode, EventProposal, EventSlot, MusicianInputChannel, MusicianMusicLinks } from '../../types/index.ts';
import { formatARS, formatCachet, sanitizeNumericInput } from '../../utils/bookingLogic.ts';
import { canSubmitBidForSlot, detectMusicianDateClashes } from '../../utils/slotBidding.ts';

interface MusicianBidModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: EventProposal | null;
  slot: EventSlot | null;
}

export const MusicianBidModal: React.FC<MusicianBidModalProps> = ({
  isOpen,
  onClose,
  event,
  slot,
}) => {
  const { currentMusician, submitSlotBid, slotBids, eventProposals, liveShows } = useApp();

  const [cachetAgreement, setCachetAgreement] = useState<'agree' | 'counter' | 'a_la_gorra'>('agree');
  const [counterCachetText, setCounterCachetText] = useState<string>(
    String(event?.baseCachetARS || 70000)
  );
  const [musiciansCount, setMusiciansCount] = useState<number>(
    slot?.requiredMusicians || currentMusician?.membersCount || 2
  );
  const [equipmentProvided, setEquipmentProvided] = useState<string>(
    'Guitarras, bajo, platos de batería y pedalera'
  );
  const [equipmentNeeded, setEquipmentNeeded] = useState<string>(
    'Batería armada, ampli de bajo y 2 micrófonos Shure'
  );
  const [note, setNote] = useState<string>('');
  const [clashConfirmedByUser, setClashConfirmedByUser] = useState<boolean>(false);
  const [sentSuccess, setSentSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Music Streaming links (No video upload, only music app links)
  const [spotifyUrl, setSpotifyUrl] = useState<string>(
    currentMusician?.musicLinks?.spotifyUrl || 'https://open.spotify.com/artist/degira'
  );
  const [youtubeUrl, setYoutubeUrl] = useState<string>(
    currentMusician?.musicLinks?.youtubeUrl || currentMusician?.youtubeSampleUrl || 'https://youtube.com/@musica'
  );
  const [bandcampUrl, setBandcampUrl] = useState<string>(
    currentMusician?.musicLinks?.bandcampUrl || ''
  );

  // Structured Input List
  const [inputList, setInputList] = useState<MusicianInputChannel[]>(() => {
    return currentMusician?.defaultInputList && currentMusician.defaultInputList.length > 0
      ? currentMusician.defaultInputList
      : [
          { channel: 1, instrument: 'Voz Principal', micOrDI: 'Micrófono', notes: 'Shure Beta 58' },
          { channel: 2, instrument: 'Guitarra Acústica', micOrDI: 'Caja Directa (DI)', notes: 'XLR balanceado' },
          { channel: 3, instrument: 'Bajo', micOrDI: 'Caja Directa (DI)', notes: 'Línea directa' },
        ];
  });

  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initKeyRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isOpen || !event || !slot) {
      initKeyRef.current = null;
      return;
    }

    const nextKey = `${event.id}:${slot.id}:${currentMusician?.id || 'mus'}`;
    if (initKeyRef.current === nextKey) return;
    initKeyRef.current = nextKey;

    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setCachetAgreement('agree');
    setCounterCachetText(event.baseCachetARS > 0 ? String(event.baseCachetARS) : '70000');
    setMusiciansCount(slot.requiredMusicians || currentMusician?.membersCount || 2);
    setNote('');
    setClashConfirmedByUser(false);
    setSubmitError(null);
    setSentSuccess(false);
    setSpotifyUrl(
      currentMusician?.musicLinks?.spotifyUrl || 'https://open.spotify.com/artist/degira'
    );
    setYoutubeUrl(
      currentMusician?.musicLinks?.youtubeUrl ||
        currentMusician?.youtubeSampleUrl ||
        'https://youtube.com/@musica'
    );
    setBandcampUrl(currentMusician?.musicLinks?.bandcampUrl || '');
    setInputList(
      currentMusician?.defaultInputList && currentMusician.defaultInputList.length > 0
        ? currentMusician.defaultInputList
        : [
            { channel: 1, instrument: 'Voz Principal', micOrDI: 'Micrófono', notes: 'Shure Beta 58' },
            { channel: 2, instrument: 'Guitarra Acústica', micOrDI: 'Caja Directa (DI)', notes: 'XLR balanceado' },
            { channel: 3, instrument: 'Bajo', micOrDI: 'Caja Directa (DI)', notes: 'Línea directa' },
          ]
    );
  }, [isOpen, event, slot, currentMusician]);

  if (!isOpen || !event || !slot) return null;

  const isBarEventGorra = event.cachetType === 'a_la_gorra';
  const barOfferLabel = formatCachet(event.baseCachetARS, event.cachetType);

  const addInputChannel = () => {
    const nextCh = inputList.length + 1;
    setInputList((prev) => [
      ...prev,
      { channel: nextCh, instrument: 'Instrumento / Voz', micOrDI: 'Micrófono', notes: '' },
    ]);
  };

  const removeInputChannel = (index: number) => {
    setInputList((prev) => prev.filter((_, i) => i !== index));
  };

  const updateInputChannel = (index: number, field: keyof MusicianInputChannel, value: any) => {
    setInputList((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const detectedClashes = currentMusician
    ? detectMusicianDateClashes({
        musicianId: currentMusician.id,
        targetEvent: event,
        targetSlot: slot,
        slotBids,
        eventProposals,
        liveShows,
      })
    : [];

  const parsedCounterAmount = counterCachetText ? Number(counterCachetText) : 0;

  const selectedCachetLabel =
    cachetAgreement === 'a_la_gorra'
      ? 'A la gorra'
      : cachetAgreement === 'agree'
      ? barOfferLabel
      : parsedCounterAmount > 0
      ? formatARS(parsedCounterAmount)
      : 'Monto a definir';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const slotCheck = canSubmitBidForSlot({
      proposal: event,
      slot,
      slotBids,
      musicianId: currentMusician?.id || 'mus-1',
    });
    if (!slotCheck.allowed) {
      setSubmitError(slotCheck.reason || 'Este horario ya no está disponible para postular.');
      return;
    }

    if (cachetAgreement === 'counter' && (!Number.isFinite(parsedCounterAmount) || parsedCounterAmount <= 0)) {
      setSubmitError('Ingresá un monto de contraoferta mayor a $ 0 o elegí "A la gorra".');
      return;
    }

    if (detectedClashes.length > 0 && !clashConfirmedByUser) {
      setClashConfirmedByUser(true);
      return;
    }

    let finalCachetType: CachetMode = 'fijo';
    let finalProposedCachet = 0;

    if (cachetAgreement === 'a_la_gorra') {
      finalCachetType = 'a_la_gorra';
      finalProposedCachet = 0;
    } else if (cachetAgreement === 'agree') {
      if (isBarEventGorra) {
        finalCachetType = 'a_la_gorra';
        finalProposedCachet = 0;
      } else {
        finalCachetType = 'fijo';
        finalProposedCachet = slot.agreedCachetARS || event.baseCachetARS;
      }
    } else {
      finalCachetType = 'fijo';
      finalProposedCachet = parsedCounterAmount;
    }

    const musicLinks: MusicianMusicLinks = {
      spotifyUrl: spotifyUrl.trim() || undefined,
      youtubeUrl: youtubeUrl.trim() || undefined,
      bandcampUrl: bandcampUrl.trim() || undefined,
    };

    const defaultNote =
      finalCachetType === 'a_la_gorra'
        ? isBarEventGorra
          ? 'De acuerdo con modalidad a la gorra.'
          : 'Propongo realizar la fecha con modalidad a la gorra.'
        : cachetAgreement === 'agree'
        ? 'De acuerdo con el caché propuesto por el bar.'
        : `Contrapropuesta de caché: ${formatARS(finalProposedCachet)}`;

    const result = submitSlotBid({
      eventId: event.id,
      slotId: slot.id,
      proposedCachetARS: finalProposedCachet,
      cachetType: finalCachetType,
      musiciansCount,
      equipmentProvided,
      equipmentNeeded,
      musicLinks,
      inputList,
      initialNote: note.trim() || defaultNote,
    });

    if (!result.ok) {
      setSubmitError(result.message || 'No se pudo enviar la propuesta para este horario.');
      return;
    }

    setSentSuccess(true);
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null;
      setSentSuccess(false);
      onClose();
    }, 1600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Music className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-100 truncate">
                Postular Horario para Tocar
              </h3>
              <p className="text-xs text-slate-400 truncate">
                {event.venueName} • Horario {slot.startTime} a {slot.endTime} hs
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar modal"
            className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-100 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs text-slate-300 max-h-[75vh] overflow-y-auto">
          {sentSuccess ? (
            <div className="text-center py-8 space-y-2">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto">
                <Check className="w-6 h-6 stroke-[3]" />
              </div>
              <h4 className="text-base font-bold text-slate-100">
                ¡Propuesta enviada al bar!
              </h4>
              <p className="text-xs text-slate-400">
                El anfitrión de {event.venueName} recibirá tu propuesta ({musiciansCount}{' '}
                {musiciansCount === 1 ? 'músico' : 'músicos'} • {selectedCachetLabel}) para aceptar o contraproponer.
              </p>
            </div>
          ) : (
            <>
              {/* Event details card */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
                <div className="flex justify-between gap-2">
                  <span className="text-slate-400">Fecha del Evento:</span>
                  <strong className="text-slate-200">{event.date}</strong>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-400">Horario del Slot:</span>
                  <span className="text-amber-400 font-bold">{slot.startTime} a {slot.endTime} hs</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-400">Caché propuesto por el bar:</span>
                  <strong className="text-emerald-400 font-bold">{barOfferLabel}</strong>
                </div>
              </div>

              {/* Musicians Count (preserved cleanly across any cachet selection) */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-200 block">
                  Cantidad de Músicos en Escenario:
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map((count) => (
                    <button
                      type="button"
                      key={count}
                      aria-pressed={musiciansCount === count}
                      data-testid={`musician-count-btn-${count}`}
                      onClick={() => setMusiciansCount(count)}
                      className={`py-2 rounded-xl border font-bold text-xs transition-all ${
                        musiciansCount === count
                          ? 'bg-amber-500 text-slate-950 border-amber-500 shadow'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      {count} {count === 1 ? 'músico' : 'músicos'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cachet Agreement / Counter-proposal / A la gorra */}
              <div className="space-y-2">
                <label className="font-bold text-slate-200 block">
                  Propuesta de Caché:
                </label>
                <div className={`grid gap-2 ${isBarEventGorra ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-3'}`}>
                  <button
                    type="button"
                    data-testid="cachet-mode-agree"
                    onClick={() => setCachetAgreement('agree')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      cachetAgreement === 'agree'
                        ? 'bg-emerald-950/30 border-emerald-500 text-emerald-300 font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div>✓ Acepto Propuesta del Bar</div>
                    <div className="text-[11px] text-emerald-400 font-mono mt-0.5">
                      {barOfferLabel}
                    </div>
                  </button>

                  <button
                    type="button"
                    data-testid="cachet-mode-counter"
                    onClick={() => setCachetAgreement('counter')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      cachetAgreement === 'counter'
                        ? 'bg-amber-950/30 border-amber-500 text-amber-300 font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div>Contraproponer Monto Fijo</div>
                    <div className="text-[11px] text-amber-400 mt-0.5">
                      Personalizar monto ARS
                    </div>
                  </button>

                  {!isBarEventGorra && (
                    <button
                      type="button"
                      data-testid="cachet-mode-gorra"
                      onClick={() => setCachetAgreement('a_la_gorra')}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        cachetAgreement === 'a_la_gorra'
                          ? 'bg-cyan-950/30 border-cyan-500 text-cyan-300 font-bold'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      <div>🎩 Proponer A la Gorra</div>
                      <div className="text-[11px] text-cyan-400 mt-0.5">
                        Aporte libre del público
                      </div>
                    </button>
                  )}
                </div>

                {cachetAgreement === 'counter' && (
                  <div className="p-3 bg-slate-950 rounded-xl border border-amber-500/30 space-y-1 animate-in fade-in">
                    <label
                      htmlFor="musician-bid-counter-input"
                      className="text-[11px] text-slate-400 block"
                    >
                      Monto de contraoferta propuesto (ARS):
                    </label>
                    <input
                      id="musician-bid-counter-input"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      placeholder="Ej: 80000"
                      value={counterCachetText}
                      onChange={(e) => setCounterCachetText(sanitizeNumericInput(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm font-bold text-amber-400 focus:border-amber-500 outline-none"
                    />
                  </div>
                )}

                {cachetAgreement === 'a_la_gorra' && (
                  <div className="p-3 bg-cyan-950/20 rounded-xl border border-cyan-500/30 text-[11px] text-cyan-200 animate-in fade-in">
                    Tu propuesta se enviará como <strong>Caché A la gorra</strong> ($ 0 fijo del bar, recaudación por gorra del público).
                  </div>
                )}
              </div>

              {/* Equipment Provided by Musician */}
              <div className="space-y-1">
                <label className="font-bold text-slate-200 block">
                  Equipamiento que el músico lleva:
                </label>
                <input
                  type="text"
                  required
                  value={equipmentProvided}
                  onChange={(e) => setEquipmentProvided(e.target.value)}
                  placeholder="Ej: Guitarras, pedales, micrófono de voz..."
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-100 focus:border-amber-500 outline-none"
                />
              </div>

              {/* Equipment Needed from Bar */}
              <div className="space-y-1">
                <label className="font-bold text-slate-200 block">
                  Equipamiento que se pide al bar proveer:
                </label>
                <input
                  type="text"
                  required
                  value={equipmentNeeded}
                  onChange={(e) => setEquipmentNeeded(e.target.value)}
                  placeholder="Ej: Ampli de bajo, batería base con banqueta, pie de mic..."
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-100 focus:border-amber-500 outline-none"
                />
              </div>

              {/* Music Streaming Links (No video upload, only music app links) */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <span className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                  <Headphones className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Enlaces de Escucha Rápida (Spotify / YouTube / Bandcamp)</span>
                </span>
                <p className="text-[11px] text-slate-400">
                  Para que el anfitrión del bar escuche cómo suena tu proyecto en 1 clic antes de responder.
                </p>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400 block">Link a Spotify (Artista / Tema)</label>
                    <input
                      type="url"
                      value={spotifyUrl}
                      onChange={(e) => setSpotifyUrl(e.target.value)}
                      placeholder="https://open.spotify.com/artist/..."
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-100 placeholder-slate-600 focus:border-emerald-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block">Canal / Audio YouTube</label>
                    <input
                      type="url"
                      value={youtubeUrl}
                      onChange={(e) => setYoutubeUrl(e.target.value)}
                      placeholder="https://youtube.com/@..."
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-100 placeholder-slate-600 focus:border-red-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Stage Plot & Input List */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-amber-400" />
                    <span>Input List & Canales para el Operador de Sonido</span>
                  </span>
                  <button
                    type="button"
                    onClick={addInputChannel}
                    className="px-2 py-0.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-[10px] font-bold rounded border border-amber-500/30 transition flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    Canal
                  </button>
                </div>

                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {inputList.map((ch, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 p-1.5 bg-slate-900 rounded-lg border border-slate-800 text-[11px]">
                      <span className="w-6 text-center font-mono font-bold text-amber-400 shrink-0">
                        Ch{ch.channel}
                      </span>
                      <input
                        type="text"
                        value={ch.instrument}
                        onChange={(e) => updateInputChannel(idx, 'instrument', e.target.value)}
                        placeholder="Instrumento (ej. Voz Líder)"
                        className="flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-100 text-xs"
                      />
                      <select
                        value={ch.micOrDI}
                        onChange={(e) => updateInputChannel(idx, 'micOrDI', e.target.value)}
                        className="bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-slate-300 text-[10px]"
                      >
                        <option value="Micrófono">Micrófono</option>
                        <option value="Caja Directa (DI)">Caja DI</option>
                        <option value="Línea Estéreo">Estéreo</option>
                        <option value="Propio">Propio</option>
                      </select>
                      {inputList.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeInputChannel(idx)}
                          className="text-slate-500 hover:text-rose-400 p-1"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Note */}
              <div className="space-y-1">
                <label className="font-bold text-slate-200 block">
                  Mensaje o aclaraciones para el anfitrión:
                </label>
                <textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Comentario sobre el repertorio o prueba de sonido..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-100 focus:border-amber-500 outline-none"
                />
              </div>

              {/* Clash warning card */}
              {detectedClashes.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/40 space-y-2 animate-in fade-in">
                  <div className="flex items-center gap-2 text-amber-300 font-extrabold text-xs">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>⚠️ Advertencia de Superposición de Horario (Clash)</span>
                  </div>
                  <p className="text-[11px] text-amber-200/90 leading-relaxed">
                    Detectamos que ya tenés un compromiso o propuesta para la misma fecha (<strong>{event.date}</strong>) en horarios superpuestos:
                  </p>
                  <div className="space-y-1">
                    {detectedClashes.map((c, i) => (
                      <div
                        key={i}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-950/80 border border-amber-500/30 text-[11px] text-slate-200 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div>
                            <strong>{c.venueName}</strong> • {c.startTime} a {c.endTime} hs
                          </div>
                          {c.title && (
                            <div className="text-[10px] text-slate-400 truncate">
                              Evento: {c.title}
                            </div>
                          )}
                        </div>
                        <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded shrink-0">
                          {c.status}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400 leading-normal">
                    La app te avisa para evitar superposiciones accidentales, pero tenés la libertad de proponer en distintos bares u horarios y decidir cuál aceptar.
                  </p>
                  <label className="flex items-center gap-2 text-[11px] text-amber-300 font-bold cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={clashConfirmedByUser}
                      onChange={(e) => setClashConfirmedByUser(e.target.checked)}
                      className="rounded text-amber-500 focus:ring-amber-400 bg-slate-900 border-slate-700"
                    />
                    <span>Comprendo el aviso de superposición y deseo enviar mi propuesta de todas formas</span>
                  </label>
                </div>
              )}

              {submitError && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-200 flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{submitError}</span>
                </div>
              )}

              {/* Live Confirmation Summary before Submit */}
              <div
                data-testid="musician-bid-summary"
                className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px]"
              >
                <span className="text-slate-400">
                  Resumen: <strong className="text-slate-100">{musiciansCount} {musiciansCount === 1 ? 'músico' : 'músicos'}</strong>
                </span>
                <span className="text-emerald-400 font-bold">
                  Caché: {selectedCachetLabel}
                </span>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
              >
                <span>
                  {detectedClashes.length > 0 && !clashConfirmedByUser
                    ? 'Confirmar y Enviar a Pesar del Clash'
                    : 'Enviar Propuesta al Bar'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </>
          )}
        </form>

      </div>
    </div>
  );
};
