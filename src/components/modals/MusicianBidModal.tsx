import React, { useState } from 'react';
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
import { EventProposal, EventSlot, MusicianInputChannel, MusicianMusicLinks } from '../../types/index.ts';
import { formatARS } from '../../utils/bookingLogic.ts';

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

  const [cachetAgreement, setCachetAgreement] = useState<'agree' | 'counter'>('agree');
  const [counterCachetARS, setCounterCachetARS] = useState<number>(
    event?.baseCachetARS || 70000
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

  if (!isOpen || !event || !slot) return null;

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

  const toMinutes = (timeStr: string) => {
    const [h, m] = (timeStr || '00:00').split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  const timesOverlap = (startA: string, endA: string, startB: string, endB: string) => {
    const a1 = toMinutes(startA);
    let a2 = toMinutes(endA);
    if (a2 <= a1) a2 += 24 * 60; // cruce de medianoche

    const b1 = toMinutes(startB);
    let b2 = toMinutes(endB);
    if (b2 <= b1) b2 += 24 * 60;

    return a1 < b2 && a2 > b1;
  };

  const detectedClashes: Array<{
    title: string;
    venueName: string;
    startTime: string;
    endTime: string;
    status: string;
  }> = [];

  slotBids.forEach((otherBid) => {
    if (
      otherBid.musicianId === currentMusician?.id &&
      !otherBid.retracted &&
      otherBid.status !== 'rechazada'
    ) {
      const otherEv = eventProposals.find((e) => e.id === otherBid.eventId);
      if (otherEv && otherEv.date === event.date) {
        const otherSlot = otherEv.slots.find((s) => s.id === otherBid.slotId);
        if (otherSlot && (otherEv.id !== event.id || otherSlot.id !== slot.id)) {
          if (timesOverlap(slot.startTime, slot.endTime, otherSlot.startTime, otherSlot.endTime)) {
            detectedClashes.push({
              title: otherEv.title,
              venueName: otherEv.venueName,
              startTime: otherSlot.startTime,
              endTime: otherSlot.endTime,
              status: otherBid.status === 'aceptada' ? 'Aceptada' : 'Propuesta pendiente',
            });
          }
        }
      }
    }
  });

  liveShows.forEach((show) => {
    if (show.musicianId === currentMusician?.id && show.date === event.date) {
      const showStart = show.time.split(' ')[0] || '21:00';
      if (timesOverlap(slot.startTime, slot.endTime, showStart, '23:59')) {
        detectedClashes.push({
          title: `${show.musicianName} en vivo`,
          venueName: show.venueName,
          startTime: showStart,
          endTime: '23:59',
          status: 'Fecha Confirmada',
        });
      }
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (detectedClashes.length > 0 && !clashConfirmedByUser) {
      setClashConfirmedByUser(true);
      return;
    }

    const finalProposedCachet =
      cachetAgreement === 'agree' ? (slot.agreedCachetARS || event.baseCachetARS) : counterCachetARS;

    const musicLinks: MusicianMusicLinks = {
      spotifyUrl: spotifyUrl.trim() || undefined,
      youtubeUrl: youtubeUrl.trim() || undefined,
      bandcampUrl: bandcampUrl.trim() || undefined,
    };

    submitSlotBid({
      eventId: event.id,
      slotId: slot.id,
      proposedCachetARS: finalProposedCachet,
      musiciansCount,
      equipmentProvided,
      equipmentNeeded,
      musicLinks,
      inputList,
      initialNote: note || (cachetAgreement === 'agree' ? 'De acuerdo con el caché propuesto por el bar.' : `Contrapropuesta de caché: ${formatARS(counterCachetARS)}`),
    });

    setSentSuccess(true);
    setTimeout(() => {
      setSentSuccess(false);
      onClose();
    }, 1600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Music className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">
                Postular Horario para Tocar
              </h3>
              <p className="text-xs text-slate-400">
                {event.venueName} • Horario {slot.startTime} a {slot.endTime} hs
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar modal"
            className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-100"
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
                El anfitrión de {event.venueName} recibirá tu propuesta para aceptar o contraproponer.
              </p>
            </div>
          ) : (
            <>
              {/* Event details card */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">Fecha del Evento:</span>
                  <strong className="text-slate-200">{event.date}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Horario del Slot:</span>
                  <span className="text-amber-400 font-bold">{slot.startTime} a {slot.endTime} hs</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Caché propuesto por el bar:</span>
                  <strong className="text-emerald-400 font-bold">{formatARS(event.baseCachetARS)}</strong>
                </div>
              </div>

              {/* Cachet Agreement / Counter-proposal */}
              <div className="space-y-2">
                <label className="font-bold text-slate-200 block">
                  Propuesta de Caché:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCachetAgreement('agree')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      cachetAgreement === 'agree'
                        ? 'bg-emerald-950/30 border-emerald-500 text-emerald-300 font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div>✓ Acepto Caché Base</div>
                    <div className="text-[11px] text-emerald-400 font-mono mt-0.5">
                      {formatARS(event.baseCachetARS)}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCachetAgreement('counter')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      cachetAgreement === 'counter'
                        ? 'bg-amber-950/30 border-amber-500 text-amber-300 font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div>Contraproponer Otra Oferta</div>
                    <div className="text-[11px] text-amber-400 mt-0.5">
                      Personalizar monto
                    </div>
                  </button>
                </div>

                {cachetAgreement === 'counter' && (
                  <div className="p-3 bg-slate-950 rounded-xl border border-amber-500/30 space-y-1 animate-in fade-in">
                    <label className="text-[11px] text-slate-400 block">
                      Monto de contraoferta propuesto (ARS):
                    </label>
                    <input
                      type="number"
                      step={5000}
                      min={10000}
                      value={counterCachetARS}
                      onChange={(e) => setCounterCachetARS(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm font-bold text-amber-400 focus:border-amber-500 outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Musicians Count */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-200 block">
                  Cantidad de Músicos en Escenario:
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map((count) => (
                    <button
                      type="button"
                      key={count}
                      onClick={() => setMusiciansCount(count)}
                      className={`py-2 rounded-xl border font-bold text-xs transition-all ${
                        musiciansCount === count
                          ? 'bg-amber-500 text-slate-950 border-amber-500'
                          : 'bg-slate-950 border-slate-800 text-slate-300'
                      }`}
                    >
                      {count} {count === 1 ? 'músico' : 'músicos'}
                    </button>
                  ))}
                </div>
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
                        className="px-2.5 py-1.5 rounded-lg bg-slate-950/80 border border-amber-500/30 text-[11px] text-slate-200 flex items-center justify-between"
                      >
                        <span>
                          <strong>{c.venueName}</strong> • {c.startTime} a {c.endTime} hs
                        </span>
                        <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
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
