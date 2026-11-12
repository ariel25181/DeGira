export type UserRole = 'musico' | 'bar' | 'espectador';

export type NeighborhoodBA =
  | 'Palermo Soho'
  | 'Palermo Hollywood'
  | 'San Telmo'
  | 'Colegiales'
  | 'Villa Crespo'
  | 'Almagro'
  | 'San Nicolás (Centro)'
  | 'Recoleta'
  | 'Chacarita'
  | 'Belgrano'
  | 'Barracas';

export type MusicGenre =
  | 'Jazz'
  | 'Rock'
  | 'Acústico'
  | 'Tango & Fusión'
  | 'Indie'
  | 'Bossa & MPB'
  | 'Blues & Soul'
  | 'Folklore'
  | 'Funk & Groove'
  | 'Pop';

export interface Review {
  id: string;
  targetType: 'musician' | 'venue';
  targetId: string;
  authorType: 'venue' | 'musician';
  authorId: string;
  authorName: string;
  authorAvatar: string;
  showDate: string;
  showVenueName: string;
  rating: number; // 1 to 5
  criteriaBreakdown: Record<string, number>;
  comment: string;
  tags: string[];
  createdAt: string;
}

export interface VenueProfile {
  id: string;
  name: string;
  type: 'Bar de Copas' | 'Restaurante Bistro' | 'Club de Jazz' | 'Cervecería' | 'Espacio Cultural';
  address: string;
  neighborhood: NeighborhoodBA;
  coverPhoto: string;
  photos: string[];
  bio: string;
  description?: string;
  capacity: number;
  backline: string[];
  acousticCharacteristics: string;
  hospitality: string;
  rating: number;
  reviewCount: number;
  ratingBreakdown: {
    soundQuality: number;
    paymentReliability: number;
    hospitality: number;
    respect: number;
  };
  venueCbuAlias?: string;
  defaultRiderTemplate?: EventRider;
  reviews: Review[];
}

export interface MusicianProfile {
  id: string;
  stageName: string;
  format: 'Solista' | 'Dúo' | 'Trío' | 'Cuarteto' | 'Banda Completa (5+)';
  genres: MusicGenre[];
  bio: string;
  avatarUrl: string;
  photos: string[];
  membersCount: number;
  instagramHandle: string;
  spotifyDemoTitle?: string;
  youtubeSampleUrl?: string;
  musicLinks?: MusicianMusicLinks;
  defaultInputList?: MusicianInputChannel[];
  minCachetDefault: number;
  technicalRider: string;
  rating: number;
  reviewCount: number;
  ratingBreakdown: {
    punctuality: number;
    liveSound: number;
    crowdDrawing: number;
    professionalism: number;
  };
  reviews: Review[];
}

export interface Application {
  id: string;
  callId: string;
  musicianId: string;
  musicianName: string;
  musicianAvatar: string;
  genres: MusicGenre[];
  format: string;
  proposedCachetARS: number;
  note: string;
  demoTrackTitle: string;
  status: 'pendiente' | 'aceptada' | 'rechazada';
  createdAt: string;
}

export interface DirectOffer {
  id: string;
  availabilityId: string;
  venueId: string;
  venueName: string;
  venueNeighborhood: NeighborhoodBA;
  venueAvatar: string;
  date: string;
  offeredCachetARS: number;
  note: string;
  status: 'pendiente' | 'aceptada' | 'rechazada';
  createdAt: string;
}

export interface VenueOpenCall {
  id: string;
  venueId: string;
  venueName: string;
  venueNeighborhood: NeighborhoodBA;
  venueAvatar: string;
  date: string; // YYYY-MM-DD
  soundcheckTime: string;
  showTime: string;
  targetGenres: MusicGenre[];
  targetFormats: string[];
  cachetType: 'fijo' | 'fijo_mas_consumo' | 'taquilla' | 'a_convenir';
  cachetAmountARS: number;
  cachetDetails: string;
  providedBackline: string[];
  specialNotes: string;
  status: 'abierta' | 'cerrada_confirmada';
  confirmedMusicianId?: string;
  confirmedMusicianName?: string;
  applications: Application[];
  createdAt: string;
}

export interface MusicianAvailability {
  id: string;
  musicianId: string;
  musicianName: string;
  musicianAvatar: string;
  musicianFormat: string;
  musicianGenres: MusicGenre[];
  date: string; // YYYY-MM-DD
  timeSlot: 'tarde' | 'noche' | 'trasnoche' | 'todo_el_dia';
  preferredNeighborhoods: NeighborhoodBA[];
  expectedCachetARS: number;
  message: string;
  status: 'disponible' | 'reservado';
  directOffers: DirectOffer[];
  createdAt: string;
}

export interface LiveShowConfirmed {
  id: string;
  date: string; // YYYY-MM-DD
  time: string;
  venueId: string;
  venueName: string;
  venueAddress: string;
  venueNeighborhood: NeighborhoodBA;
  venuePhoto: string;
  musicianId: string;
  musicianName: string;
  musicianGenres: MusicGenre[];
  musicianFormat: string;
  musicianAvatar: string;
  ticketType: 'entrada_libre' | 'consumicion_minima' | 'ticket_fijo';
  ticketPriceARS: number;
  description: string;
  isCompleted: boolean;
  venueReviewed: boolean;
  musicianReviewed: boolean;
}

export interface SpectatorReservation {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  showId: string;
  showTitle: string;
  musicianName: string;
  venueName: string;
  venueAddress: string;
  venueNeighborhood: NeighborhoodBA;
  showDate: string;
  showTime: string;
  partySize: number;
  totalARS: number;
  ticketType: 'entrada_libre' | 'consumicion_minima' | 'ticket_fijo';
  paymentStatus: 'pagado_mp' | 'pendiente_mp';
  mpPaymentId?: string;
  reservationCode: string;
  createdAt: string;
}

export interface PublicUserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatarUrl: string;
  favoriteGenres: MusicGenre[];
  preferredNeighborhoods: NeighborhoodBA[];
  createdAt: string;
}

// ==========================================
// NUEVOS TIPOS ARQUITECTURA INTEGRAL DEGIRA
// ==========================================

export type EventStatus = 'propuesta' | 'cancelada' | 'para_publicar' | 'publicada' | 'agotada';

export interface EventSlot {
  id: string;
  startTime: string; // ej: "21:00"
  endTime: string;   // ej: "22:15"
  requiredMusicians: number;
  genrePreference?: string;
  assignedMusicianId?: string;
  assignedMusicianName?: string;
  agreedCachetARS?: number;
  status: 'libre' | 'negociando' | 'confirmado';
}

export interface EventRider {
  stageSize: string;      // ej: "6x4 metros"
  soundSystem: string;    // ej: "Consola digital 16ch, potencias 1000W"
  micCount: number;       // ej: 4 micrófonos
  backline: string[];     // ej: ["Batería Pearl", "Ampli Fender", "Ampli Ampeg"]
  lighting: string;       // ej: "Luces LED RGB y frontales cálidas"
}

export interface EventProposal {
  id: string;
  venueId: string;
  venueName: string;
  venueAddress: string;
  venueNeighborhood: NeighborhoodBA;
  venuePhoto: string;
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string; // "20:30"
  endTime: string;   // "01:00"
  totalCapacity: number; // Capacidad de sala (personas)
  remainingCapacity: number; // Disponibilidad remanente
  baseCachetARS: number;
  ticketPriceARS?: number; // Precio de entrada/reserva (default 4500 o similar)
  targetGenres: MusicGenre[];
  slots: EventSlot[];
  rider: EventRider;
  status: EventStatus;
  eventCode: string; // ej: "DG-BAR1-7482"
  waitlist?: string[]; // emails de espectadores en lista de espera
  cachetPaid?: boolean; // liquidación de cachet a músicos
  cachetPaidAt?: string;
  feedbackSentAt?: string; // disparo automático 1h post evento
  createdAt: string;
}

export interface SlotBidHistoryEntry {
  id: string;
  actor: 'bar' | 'musico';
  actorName: string;
  cachetARS: number;
  note: string;
  createdAt: string;
}

export interface MusicianSlotBid {
  id: string;
  eventId: string;
  slotId: string;
  musicianId: string;
  musicianName: string;
  musicianAvatar: string;
  proposedCachetARS: number;
  musiciansCount: number;
  equipmentProvided: string; // lo que el músico lleva
  equipmentNeeded: string;   // lo que le pide al bar
  musicLinks?: MusicianMusicLinks;
  inputList?: MusicianInputChannel[];
  reminderSentAt?: string;   // Último recordatorio enviado al bar
  reminderCount?: number;    // Cantidad de recordatorios
  retracted?: boolean;       // Músico se retractó (permitido hasta 24hs antes)
  retractedAt?: string;
  status: 'pendiente_bar' | 'contraoferta_bar' | 'contraoferta_musico' | 'aceptada' | 'rechazada';
  history: SlotBidHistoryEntry[];
  createdAt: string;
}

export type ReservationStatus =
  | 'pendiente_pago'      // reloj de 8 minutos corriendo
  | 'comprobante_subido'  // comprobante cargado, esperando confirmación del bar
  | 'confirmada'          // bar confirmó el pago, cupo descontado, QR emitido y enviado por email
  | 'expirada'            // vencieron los 8 min sin comprobante, cupo liberado
  | 'cancelada';

export interface PublicEventReservation {
  id: string;
  eventId: string;
  eventTitle: string;
  eventCode: string;
  venueId: string;
  venueName: string;
  venueAddress: string;
  venueNeighborhood: NeighborhoodBA;
  eventDate: string;
  eventStartTime: string;
  eventEndTime: string;
  userId: string;
  userName: string;
  userEmail: string;
  partySize: number;
  totalARS: number;
  expiresAt: number; // timestamp ms (Date.now() + 8*60*1000)
  status: ReservationStatus;
  receiptImage?: string; // data URL o URL de comprobante
  receiptUploadTime?: string;
  receiptOcrNotes?: string;
  qrTicketCode?: string; // Código para renderizar el QR de acceso
  qrEmailSent?: boolean;
  checkInStatus?: 'pending' | 'checked_in';
  checkedInAt?: string;
  rejectionReason?: string;
  createdAt: string;
}

export interface EventReview360 {
  id: string;
  eventId: string;
  eventTitle: string;
  fromRole: UserRole;
  fromUserId: string;
  fromUserName: string;
  toType: 'event' | 'venue' | 'musician';
  toId: string;
  toName: string;
  rating: number; // 1-5
  categoryRatings: Record<string, number>;
  comment: string;
  createdAt: string;
}

export interface MusicianInputChannel {
  channel: number;
  instrument: string; // ej: "Voz principal", "Guitarra acústica", "Bajo eléctrico", "Teclado L/R"
  micOrDI: 'Micrófono' | 'Caja Directa (DI)' | 'Línea Estéreo' | 'Propio';
  notes?: string;
}

export interface MusicianMusicLinks {
  spotifyUrl?: string;
  youtubeUrl?: string;
  bandcampUrl?: string;
  soundcloudUrl?: string;
  appleMusicUrl?: string;
}

export interface SpectatorBenefit {
  badge: string; // ej: "Espectador Frecuente"
  promoCode: string; // ej: "DEGIRA-NOCHE-15"
  discountPercent: number; // 15
  earnedAt: string;
}

export interface DeGiraSession {
  user: {
    id: string;
    name: string;
    email: string;
  };
  role: UserRole;
  remember24h: boolean;
  expiresAt: number | null; // timestamp ms a 24 horas, o null si es de sesión
}

