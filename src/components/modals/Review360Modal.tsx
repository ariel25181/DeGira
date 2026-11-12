import React, { useState } from 'react';
import {
  X,
  Star,
  CheckCircle,
  Wine,
  Music,
  Sparkles,
  Calendar,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import { EventProposal, UserRole } from '../../types/index.ts';

interface Review360ModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: EventProposal | null;
}

export const Review360Modal: React.FC<Review360ModalProps> = ({
  isOpen,
  onClose,
  event,
}) => {
  const { role, userDisplayName, submitReview360 } = useApp();

  const [ratingEvent, setRatingEvent] = useState(5);
  const [commentEvent, setCommentEvent] = useState('');

  const [ratingVenue, setRatingVenue] = useState(5);
  const [commentVenue, setCommentVenue] = useState('');

  const [ratingMusicians, setRatingMusicians] = useState(5);
  const [commentMusicians, setCommentMusicians] = useState('');

  const [submitted, setSubmitted] = useState(false);

  if (!isOpen || !event) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (role === 'espectador') {
      // 1. Review the Event
      submitReview360({
        eventId: event.id,
        eventTitle: event.title,
        fromRole: 'espectador',
        fromUserId: 'user-pub-1',
        fromUserName: userDisplayName,
        toType: 'event',
        toId: event.id,
        toName: event.title,
        rating: ratingEvent,
        categoryRatings: { ambiente: ratingEvent, sonido: ratingEvent },
        comment: commentEvent || 'Excelente evento y noche porteña.',
      });

      // 2. Review the Bar
      submitReview360({
        eventId: event.id,
        eventTitle: event.title,
        fromRole: 'espectador',
        fromUserId: 'user-pub-1',
        fromUserName: userDisplayName,
        toType: 'venue',
        toId: event.venueId,
        toName: event.venueName,
        rating: ratingVenue,
        categoryRatings: { atencion: ratingVenue, hospitalidad: ratingVenue },
        comment: commentVenue || 'Muy buena atención y lugar.',
      });

      // 3. Review the Musicians
      event.slots.forEach((slot) => {
        if (slot.assignedMusicianId) {
          submitReview360({
            eventId: event.id,
            eventTitle: event.title,
            fromRole: 'espectador',
            fromUserId: 'user-pub-1',
            fromUserName: userDisplayName,
            toType: 'musician',
            toId: slot.assignedMusicianId,
            toName: slot.assignedMusicianName || 'Músico',
            rating: ratingMusicians,
            categoryRatings: { show: ratingMusicians, sonido: ratingMusicians },
            comment: commentMusicians || 'Gran show y repertorio en vivo.',
          });
        }
      });
    } else if (role === 'musico') {
      // Musician rates Bar on Event Coordination & Sound
      submitReview360({
        eventId: event.id,
        eventTitle: event.title,
        fromRole: 'musico',
        fromUserId: 'mus-1',
        fromUserName: userDisplayName,
        toType: 'venue',
        toId: event.venueId,
        toName: event.venueName,
        rating: ratingVenue,
        categoryRatings: { coordinacion: ratingVenue, sonido: ratingVenue, puntualidad: ratingVenue },
        comment: commentVenue || 'Excelente coordinación de horarios y sonido por parte del anfitrión.',
      });
    } else if (role === 'bar') {
      // Bar rates Musicians
      event.slots.forEach((slot) => {
        if (slot.assignedMusicianId) {
          submitReview360({
            eventId: event.id,
            eventTitle: event.title,
            fromRole: 'bar',
            fromUserId: event.venueId,
            fromUserName: event.venueName,
            toType: 'musician',
            toId: slot.assignedMusicianId,
            toName: slot.assignedMusicianName || 'Músico',
            rating: ratingMusicians,
            categoryRatings: { puntualidad: ratingMusicians, cuidadoEquipos: ratingMusicians },
            comment: commentMusicians || 'Músicos muy profesionales y puntuales. Excelente show.',
          });
        }
      });
    }

    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      onClose();
    }, 1800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Star className="w-4 h-4 fill-amber-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">
                Calificación 360° Post-Evento
              </h3>
              <p className="text-xs text-slate-400">
                {event.title} • {event.venueName}
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
        <form onSubmit={handleSubmit} className="p-5 space-y-5 text-xs text-slate-300 max-h-[75vh] overflow-y-auto">
          {submitted ? (
            <div className="text-center py-8 space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto">
                <CheckCircle className="w-6 h-6 stroke-[2.5]" />
              </div>
              <h4 className="text-base font-black text-slate-100">
                ¡Calificación 360° Registrada!
              </h4>
              <p className="text-xs text-slate-400">
                Tu evaluación bilateral construye la reputación verificada de la escena musical porteña en DeGira.
              </p>
            </div>
          ) : (
            <>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Horario del Evento:</span>
                  <span className="font-semibold text-slate-200">{event.startTime} a {event.endTime} hs</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Tu Rol:</span>
                  <span className="font-bold text-amber-400 uppercase">
                    {role === 'bar' ? 'Bar Anfitrión' : role === 'musico' ? 'Músico' : 'Público General'}
                  </span>
                </div>
              </div>

              {/* SECTION FOR ESPECTADOR */}
              {role === 'espectador' && (
                <>
                  {/* Rating 1: Evento General */}
                  <div className="p-3.5 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-2">
                    <label className="font-bold text-slate-200 block text-xs">
                      1. Calificación al Evento en General ({event.title})
                    </label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <button
                          type="button"
                          key={s}
                          onClick={() => setRatingEvent(s)}
                          className="p-1.5"
                        >
                          <Star
                            className={`w-6 h-6 ${
                              s <= ratingEvent
                                ? 'text-amber-400 fill-amber-400'
                                : 'text-slate-700 hover:text-slate-500'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      placeholder="Opinión general sobre el recital..."
                      value={commentEvent}
                      onChange={(e) => setCommentEvent(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 focus:border-amber-500 outline-none"
                    />
                  </div>

                  {/* Rating 2: Bar */}
                  <div className="p-3.5 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-2">
                    <label className="font-bold text-slate-200 block text-xs">
                      2. Calificación al Bar ({event.venueName})
                    </label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <button
                          type="button"
                          key={s}
                          onClick={() => setRatingVenue(s)}
                          className="p-1.5"
                        >
                          <Star
                            className={`w-6 h-6 ${
                              s <= ratingVenue
                                ? 'text-amber-400 fill-amber-400'
                                : 'text-slate-700 hover:text-slate-500'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      placeholder="Atención, acústica de sala, carta del bar..."
                      value={commentVenue}
                      onChange={(e) => setCommentVenue(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 focus:border-amber-500 outline-none"
                    />
                  </div>

                  {/* Rating 3: Músicos */}
                  <div className="p-3.5 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-2">
                    <label className="font-bold text-slate-200 block text-xs">
                      3. Calificación a los Músicos
                    </label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <button
                          type="button"
                          key={s}
                          onClick={() => setRatingMusicians(s)}
                          className="p-1.5"
                        >
                          <Star
                            className={`w-6 h-6 ${
                              s <= ratingMusicians
                                ? 'text-amber-400 fill-amber-400'
                                : 'text-slate-700 hover:text-slate-500'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      placeholder="Sonido de la banda, calidad del show..."
                      value={commentMusicians}
                      onChange={(e) => setCommentMusicians(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 focus:border-amber-500 outline-none"
                    />
                  </div>
                </>
              )}

              {/* SECTION FOR MUSICO */}
              {role === 'musico' && (
                <div className="p-3.5 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-2">
                  <label className="font-bold text-slate-200 block text-xs">
                    Calificación de Coordinación y Sonido a {event.venueName}
                  </label>
                  <p className="text-[11px] text-slate-400">
                    Evaluá la coordinación previa, puntualidad del soundcheck, hospitalidad y pago de caché.
                  </p>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button
                        type="button"
                        key={s}
                        onClick={() => setRatingVenue(s)}
                        className="p-1.5"
                      >
                        <Star
                          className={`w-6 h-6 ${
                            s <= ratingVenue
                              ? 'text-amber-400 fill-amber-400'
                              : 'text-slate-700 hover:text-slate-500'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                  <textarea
                    rows={3}
                    placeholder="Comentario sobre la coordinación y trato del bar..."
                    value={commentVenue}
                    onChange={(e) => setCommentVenue(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 focus:border-amber-500 outline-none"
                  />
                </div>
              )}

              {/* SECTION FOR BAR */}
              {role === 'bar' && (
                <div className="p-3.5 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-2">
                  <label className="font-bold text-slate-200 block text-xs">
                    Calificación a los Músicos que Tocaron en la Fecha
                  </label>
                  <p className="text-[11px] text-slate-400">
                    Evaluá la puntualidad de llegada, cuidado de los equipos del bar y performance en vivo.
                  </p>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button
                        type="button"
                        key={s}
                        onClick={() => setRatingMusicians(s)}
                        className="p-1.5"
                      >
                        <Star
                          className={`w-6 h-6 ${
                            s <= ratingMusicians
                              ? 'text-amber-400 fill-amber-400'
                              : 'text-slate-700 hover:text-slate-500'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                  <textarea
                    rows={3}
                    placeholder="Comentario sobre la puntualidad, sonido y cuidado del escenario..."
                    value={commentMusicians}
                    onChange={(e) => setCommentMusicians(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 focus:border-amber-500 outline-none"
                  />
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
              >
                <span>Enviar Calificación Bilateral 360°</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </>
          )}
        </form>

      </div>
    </div>
  );
};
