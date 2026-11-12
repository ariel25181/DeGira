import React, { useState } from 'react';
import {
  X,
  Calendar,
  Clock,
  Users,
  DollarSign,
  Plus,
  Trash2,
  Speaker,
  Music,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import { EventSlot, MusicGenre, NeighborhoodBA } from '../../types/index.ts';

interface CreateEventProposalModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AVAILABLE_GENRES: MusicGenre[] = [
  'Jazz',
  'Rock',
  'Acústico',
  'Tango & Fusión',
  'Indie',
  'Bossa & MPB',
  'Blues & Soul',
  'Folklore',
  'Funk & Groove',
];

export const CreateEventProposalModal: React.FC<CreateEventProposalModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { currentVenue, venues, createEventProposal, saveVenueRiderTemplate, addNewVenue } = useApp();

  const [selectedVenueId, setSelectedVenueId] = useState<string>(currentVenue?.id || 'venue-1');
  const [isCreatingNewVenue, setIsCreatingNewVenue] = useState(false);
  const [newVenueName, setNewVenueName] = useState('');
  const [newVenueAddress, setNewVenueAddress] = useState('');
  const [newVenueNeighborhood, setNewVenueNeighborhood] = useState<NeighborhoodBA>('San Telmo');

  const [title, setTitle] = useState('');
  const [date, setDate] = useState('2026-11-28');
  const [startTime, setStartTime] = useState('20:30');
  const [endTime, setEndTime] = useState('01:00');
  const [totalCapacity, setTotalCapacity] = useState(80);
  const [baseCachetARS, setBaseCachetARS] = useState(70000);
  const [ticketPriceARS, setTicketPriceARS] = useState(8000);
  const [selectedGenres, setSelectedGenres] = useState<MusicGenre[]>(['Jazz', 'Blues & Soul']);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);

  // Rider details
  const [stageSize, setStageSize] = useState('6x4 metros');
  const [soundSystem, setSoundSystem] = useState('Consola digital 16 canales, 2 cajas activas 1000W');
  const [micCount, setMicCount] = useState(4);
  const [lighting, setLighting] = useState('Tachos LED RGB dimeables y frontales cálidas');
  const [backline, setBackline] = useState('Batería armada, ampli Fender Twin Reverb, ampli bajo Ampeg');

  const loadVenueRiderTemplate = () => {
    if (currentVenue?.defaultRiderTemplate) {
      const t = currentVenue.defaultRiderTemplate;
      setStageSize(t.stageSize);
      setSoundSystem(t.soundSystem);
      setMicCount(t.micCount);
      setLighting(t.lighting);
      setBackline(t.backline.join(', '));
    }
  };

  // Slots (1 or more musicians for different times)
  const [slots, setSlots] = useState<Array<{ id: string; startTime: string; endTime: string; requiredMusicians: number }>>([
    { id: 'slot-1', startTime: '21:00', endTime: '22:15', requiredMusicians: 2 },
    { id: 'slot-2', startTime: '22:45', endTime: '00:15', requiredMusicians: 3 },
  ]);

  if (!isOpen) return null;

  const toggleGenre = (genre: MusicGenre) => {
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
  };

  const addSlot = () => {
    const newId = `slot-${Date.now()}`;
    setSlots((prev) => [
      ...prev,
      { id: newId, startTime: '00:30', endTime: '01:30', requiredMusicians: 1 },
    ]);
  };

  const removeSlot = (id: string) => {
    setSlots((prev) => prev.filter((s) => s.id !== id));
  };

  const updateSlot = (id: string, field: 'startTime' | 'endTime' | 'requiredMusicians', val: any) => {
    setSlots((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: val } : s))
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const formattedSlots: EventSlot[] = slots.map((s) => ({
      id: s.id,
      startTime: s.startTime,
      endTime: s.endTime,
      requiredMusicians: s.requiredMusicians,
      status: 'libre',
    }));

    const newRider = {
      stageSize,
      soundSystem,
      micCount,
      backline: backline.split(',').map((s) => s.trim()),
      lighting,
    };

    let activeVenue = venues.find((v) => v.id === selectedVenueId) || currentVenue || venues[0];

    if (isCreatingNewVenue && newVenueName.trim()) {
      activeVenue = addNewVenue({
        name: newVenueName.trim(),
        address: newVenueAddress.trim() || 'Av. Corrientes 1500',
        neighborhood: newVenueNeighborhood,
        coverPhoto: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=600&auto=format&fit=crop&q=80',
        photos: ['https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=600&auto=format&fit=crop&q=80'],
        capacity: totalCapacity,
        type: 'Cervecería',
        bio: `Nuevo local y sala de música en vivo en ${newVenueNeighborhood}.`,
        backline: ['Escenario', 'Consola de sonido', 'Barra'],
        acousticCharacteristics: 'Acústica cuidada para música en vivo',
        hospitality: 'Consumición y camarín para músicos',
        venueCbuAlias: 'degira.nuevo.bar.mp',
      });
    }

    if (saveAsTemplate && activeVenue) {
      saveVenueRiderTemplate(activeVenue.id, newRider);
    }

    createEventProposal({
      venueId: activeVenue?.id || 'venue-1',
      venueName: activeVenue?.name || 'Bar Test 1',
      venueAddress: activeVenue?.address || 'Honduras 4800',
      venueNeighborhood: (activeVenue?.neighborhood as NeighborhoodBA) || 'Palermo Soho',
      venuePhoto: activeVenue?.photos[0] || 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=600&auto=format&fit=crop&q=80',
      title: title.trim() || `Noche Musical en ${activeVenue?.name || 'Bar Test 1'}`,
      date,
      startTime,
      endTime,
      totalCapacity,
      baseCachetARS,
      ticketPriceARS,
      targetGenres: selectedGenres.length > 0 ? selectedGenres : ['Jazz'],
      slots: formattedSlots,
      rider: newRider,
      status: 'propuesta',
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">
                Proponer Nuevo Evento Musical
              </h3>
              <p className="text-xs text-slate-400">
                {isCreatingNewVenue ? (newVenueName || 'Nuevo Local') : (currentVenue?.name || 'Bar Test 1')} • Estado inicial: Propuesta
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

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs text-slate-300 max-h-[75vh] overflow-y-auto">
          {/* Venue Selector: Existing vs New Venue */}
          <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-2.5">
            <label className="block text-xs font-bold text-amber-400 uppercase tracking-wide">
              🏢 Local / Sala del Evento:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsCreatingNewVenue(false)}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                  !isCreatingNewVenue
                    ? 'bg-amber-500 text-slate-950 border-amber-500 shadow'
                    : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                }`}
              >
                Local Existente
              </button>
              <button
                type="button"
                onClick={() => setIsCreatingNewVenue(true)}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                  isCreatingNewVenue
                    ? 'bg-amber-500 text-slate-950 border-amber-500 shadow'
                    : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                }`}
              >
                + Registrar Nuevo Local
              </button>
            </div>

            {!isCreatingNewVenue ? (
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Seleccionar sala:</label>
                <select
                  value={selectedVenueId}
                  onChange={(e) => setSelectedVenueId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-xs focus:border-amber-500 outline-none"
                >
                  {venues.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.neighborhood} - Cap: {v.capacity})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="space-y-2 pt-1 border-t border-slate-800">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Nombre del nuevo local:</label>
                  <input
                    type="text"
                    required={isCreatingNewVenue}
                    placeholder="Ej: Cervecería San Telmo Bar & Jazz"
                    value={newVenueName}
                    onChange={(e) => setNewVenueName(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs outline-none focus:border-amber-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Barrio de Buenos Aires:</label>
                    <select
                      value={newVenueNeighborhood}
                      onChange={(e) => setNewVenueNeighborhood(e.target.value as NeighborhoodBA)}
                      className="w-full px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-xs outline-none"
                    >
                      {[
                        'Palermo Soho',
                        'Palermo Hollywood',
                        'San Telmo',
                        'Colegiales',
                        'Recoleta',
                        'Villa Crespo',
                        'Almagro',
                        'Chacarita',
                        'Boedo',
                        'Caballito',
                      ].map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Dirección:</label>
                    <input
                      type="text"
                      placeholder="Ej: Defensa 850"
                      value={newVenueAddress}
                      onChange={(e) => setNewVenueAddress(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Título del Evento
            </label>
            <input
              type="text"
              required
              placeholder="Ej: Noche de Jazz & Blues en Palermo"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-100 focus:border-amber-500 outline-none"
            />
          </div>

          {/* Date & Global Times */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Fecha
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-100 focus:border-amber-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Inicio Sala
              </label>
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-100 focus:border-amber-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Cierre Sala
              </label>
              <input
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-100 focus:border-amber-500 outline-none"
              />
            </div>
          </div>

          {/* Capacity, Cachet & Ticket Price */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 mb-1">
                Capacidad Sala
              </label>
              <input
                type="number"
                min={10}
                max={500}
                required
                value={totalCapacity}
                onChange={(e) => setTotalCapacity(Number(e.target.value))}
                className="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs font-bold text-slate-100 focus:border-amber-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 mb-1">
                Caché Músico
              </label>
              <input
                type="number"
                step={5000}
                min={20000}
                required
                value={baseCachetARS}
                onChange={(e) => setBaseCachetARS(Number(e.target.value))}
                className="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs font-bold text-amber-400 focus:border-amber-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 mb-1">
                Entrada Público
              </label>
              <input
                type="number"
                step={500}
                min={0}
                required
                value={ticketPriceARS}
                onChange={(e) => setTicketPriceARS(Number(e.target.value))}
                className="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs font-bold text-emerald-400 focus:border-amber-500 outline-none"
              />
            </div>
          </div>

          {/* Genres */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300">
              Tipo de Música o Músico que se Busca:
            </label>
            <div className="flex flex-wrap gap-1.5">
              {AVAILABLE_GENRES.map((g) => {
                const isSelected = selectedGenres.includes(g);
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => toggleGenre(g)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                      isSelected
                        ? 'bg-amber-500 text-slate-950 border-amber-500'
                        : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    {isSelected ? `✓ ${g}` : g}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Slots Configuration (1 or more musicians for different times) */}
          <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Horarios y Músicos Solicitados ({slots.length})</span>
              </span>
              <button
                type="button"
                onClick={addSlot}
                className="text-[11px] text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                <span>Agregar Horario</span>
              </button>
            </div>

            <div className="space-y-2">
              {slots.map((s, idx) => (
                <div
                  key={s.id}
                  className="p-2.5 bg-slate-900 rounded-xl border border-slate-800 flex items-center gap-2 text-xs"
                >
                  <span className="text-amber-400 font-bold text-[11px] shrink-0">#{idx + 1}</span>
                  <input
                    type="time"
                    value={s.startTime}
                    onChange={(e) => updateSlot(s.id, 'startTime', e.target.value)}
                    className="px-2 py-1 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 text-[11px]"
                  />
                  <span className="text-slate-500">a</span>
                  <input
                    type="time"
                    value={s.endTime}
                    onChange={(e) => updateSlot(s.id, 'endTime', e.target.value)}
                    className="px-2 py-1 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 text-[11px]"
                  />
                  <div className="flex items-center gap-1 ml-auto">
                    <span className="text-slate-400 text-[10px]">Músicos:</span>
                    <select
                      value={s.requiredMusicians}
                      onChange={(e) => updateSlot(s.id, 'requiredMusicians', Number(e.target.value))}
                      className="bg-slate-950 border border-slate-700 rounded-lg text-[11px] px-1 py-1 text-slate-200"
                    >
                      <option value={1}>1 (Solista)</option>
                      <option value={2}>2 (Dúo)</option>
                      <option value={3}>3 (Trío)</option>
                      <option value={4}>4 (Banda)</option>
                      <option value={5}>5+ (Completa)</option>
                    </select>
                  </div>
                  {slots.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeSlot(s.id)}
                      className="text-slate-500 hover:text-rose-400 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Rider and Venue Technical Setup */}
          <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                <Speaker className="w-3.5 h-3.5 text-amber-400" />
                <span>Rider Técnico y Equipos de la Sala</span>
              </span>
              {currentVenue?.defaultRiderTemplate && (
                <button
                  type="button"
                  onClick={loadVenueRiderTemplate}
                  className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-[10px] font-bold rounded-lg border border-amber-500/30 transition flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" />
                  Cargar mi Ficha Técnica de Sala
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-400 block">Tamaño del Escenario</label>
                <input
                  type="text"
                  value={stageSize}
                  onChange={(e) => setStageSize(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-100"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block">Cantidad de Micrófonos</label>
                <input
                  type="number"
                  min={1}
                  max={16}
                  value={micCount}
                  onChange={(e) => setMicCount(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-100"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] text-slate-400 block">Equipos de Sonido y Consola</label>
              <input
                type="text"
                value={soundSystem}
                onChange={(e) => setSoundSystem(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-100"
              />
            </div>

            <div>
              <label className="text-[10px] text-slate-400 block">Luces y Escenario</label>
              <input
                type="text"
                value={lighting}
                onChange={(e) => setLighting(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-100"
              />
            </div>

            <div>
              <label className="text-[10px] text-slate-400 block">Backline e Instrumentos Disponibles</label>
              <input
                type="text"
                value={backline}
                onChange={(e) => setBackline(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-100"
              />
            </div>

            <div className="pt-2 border-t border-slate-800/80 flex items-center gap-2">
              <input
                type="checkbox"
                id="saveAsTemplate"
                checked={saveAsTemplate}
                onChange={(e) => setSaveAsTemplate(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500/30"
              />
              <label htmlFor="saveAsTemplate" className="text-[11px] text-slate-300 cursor-pointer">
                Guardar este rider técnico como mi <strong className="text-amber-400">Ficha Técnica de Sala</strong> predeterminada
              </label>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
          >
            <span>Crear Propuesta de Evento</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

      </div>
    </div>
  );
};
