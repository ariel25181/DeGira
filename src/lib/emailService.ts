/**
 * DeGira - Servicio de Envío y Simulación de Notificaciones por Email
 * Maneja el despacho de correos automáticos para:
 * 1. Envío de entrada con Pase QR al Espectador tras confirmación del bar.
 * 2. Aviso al Bar de nuevo comprobante de pago subido para revisar.
 * 3. Aviso a los Músicos acordados cuando la fecha pasa a estado 'publicada'.
 * 4. Invitación a calificar (Rating 360°) una vez finalizado el show.
 */

export interface SentEmailRecord {
  id: string;
  to: string;
  subject: string;
  bodyText: string;
  qrCodeUrl?: string;
  type:
    | 'qr_ticket'
    | 'payment_alert_bar'
    | 'event_published_musician'
    | 'review_reminder'
    | 'proposal_to_bar'
    | 'negotiation_update_musician'
    | 'reservation_created'
    | 'reservation_expired';
  sentAt: string;
}

const STORAGE_KEY = 'degira:sent_emails:v1';
let memoryEmails: SentEmailRecord[] = [];

export function getSentEmails(): SentEmailRecord[] {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    }
    return memoryEmails;
  } catch {
    return memoryEmails;
  }
}

export function saveEmailRecord(record: Omit<SentEmailRecord, 'id' | 'sentAt'>): SentEmailRecord {
  const newEmail: SentEmailRecord = {
    ...record,
    id: `email-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    sentAt: new Date().toISOString(),
  };

  const existing = getSentEmails();
  const updated = [newEmail, ...existing].slice(0, 50);
  memoryEmails = updated;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    }
  } catch {
    // Ignorar si storage está restringido
  }

  // Notificación en consola para auditoría y desarrollo
  console.info(`[DeGira Email Service] ✉️ Correo enviado a ${newEmail.to}: "${newEmail.subject}"`);
  return newEmail;
}

/**
 * 1. Envía el email con el Pase QR al usuario público
 */
export function sendQrTicketEmail(params: {
  toEmail: string;
  userName: string;
  eventTitle: string;
  venueName: string;
  venueAddress: string;
  eventDate: string;
  eventTime: string;
  partySize: number;
  qrTicketCode: string;
}) {
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
    params.qrTicketCode
  )}`;

  return saveEmailRecord({
    to: params.toEmail,
    subject: `🎟️ Tu entrada y Pase QR para ${params.eventTitle} en ${params.venueName}`,
    bodyText: `¡Hola ${params.userName}!

Tu pago para ${params.eventTitle} fue confirmado por ${params.venueName}.

Detalles de tu reserva:
- Fecha: ${params.eventDate} a las ${params.eventTime}
- Lugar: ${params.venueName} (${params.venueAddress})
- Personas: ${params.partySize}
- Código de Acceso: ${params.qrTicketCode}

Presentá el código QR adjunto en la puerta del bar para ingresar.
¡Que disfrutes del show!

Equipo DeGira`,
    qrCodeUrl: qrImageUrl,
    type: 'qr_ticket',
  });
}

/**
 * 2. Avisa al bar que un espectador subió comprobante para su evento
 */
export function sendPaymentUploadedAlertToBar(params: {
  barEmail: string;
  venueName: string;
  eventTitle: string;
  eventCode: string;
  userName: string;
  amountARS: number;
}) {
  return saveEmailRecord({
    to: params.barEmail,
    subject: `🔔 Nuevo comprobante de pago recibido para ${params.eventTitle} (${params.eventCode})`,
    bodyText: `Hola ${params.venueName},

${params.userName} subió un comprobante de transferencia por $${params.amountARS.toLocaleString('es-AR')} con código de evento ${params.eventCode}.

Ingresá a DeGira en la sección "Reservas & Solicitudes" para verificar el comprobante y confirmar la reserva.

Equipo DeGira`,
    type: 'payment_alert_bar',
  });
}

/**
 * 3. Avisa a los músicos cuando el bar publica el evento
 */
export function sendEventPublishedToMusician(params: {
  musicianEmail: string;
  musicianName: string;
  eventTitle: string;
  venueName: string;
  eventDate: string;
  slotTime: string;
  agreedCachetARS: number;
}) {
  return saveEmailRecord({
    to: params.musicianEmail,
    subject: `🎉 ¡Fecha publicada en Cartelera! ${params.eventTitle} en ${params.venueName}`,
    bodyText: `¡Hola ${params.musicianName}!

${params.venueName} acaba de publicar el evento en la cartelera de DeGira para el público general.

Detalles acordados:
- Fecha: ${params.eventDate}
- Tu horario: ${params.slotTime}
- Caché acordado: $${params.agreedCachetARS.toLocaleString('es-AR')}

El público ya puede reservar sus entradas. ¡Muchos éxitos en la fecha!

Equipo DeGira`,
    type: 'event_published_musician',
  });
}

/**
 * 4. Envía invitación para calificar post-evento
 */
export function sendReviewReminderEmail(params: {
  toEmail: string;
  userName: string;
  eventTitle: string;
  role: 'espectador' | 'musico' | 'bar';
}) {
  const roleText =
    params.role === 'espectador'
      ? 'Contanos qué te pareció el recital, el bar y los artistas.'
      : params.role === 'musico'
      ? 'Calificá la atención, sonido y coordinación técnica del bar.'
      : 'Calificá el profesionalismo y puntualidad de los músicos.';

  return saveEmailRecord({
    to: params.toEmail,
    subject: `⭐ ¿Cómo estuvo ${params.eventTitle}? Dejanos tu calificación`,
    bodyText: `¡Hola ${params.userName}!

El evento ${params.eventTitle} acaba de finalizar.
Tu opinión ayuda a construir una comunidad de música en vivo transparente y confiable.

${roleText}

Abrí DeGira para calificar con estrellas y etiquetas.

Equipo DeGira`,
    type: 'review_reminder',
  });
}

/**
 * 5. Notificación al Bar de nueva postulación / propuesta de músico
 */
export function sendProposalReceivedEmailToBar(params: {
  barEmail: string;
  venueName: string;
  musicianName: string;
  eventTitle: string;
  slotTime: string;
  cachetARS: number;
}) {
  return saveEmailRecord({
    to: params.barEmail,
    subject: `🎸 Nueva propuesta musical de ${params.musicianName} para ${params.eventTitle}`,
    bodyText: `Hola ${params.venueName},

${params.musicianName} se postuló para tocar en tu evento "${params.eventTitle}".

Detalles:
- Horario solicitado: ${params.slotTime}
- Caché propuesto: $${params.cachetARS.toLocaleString('es-AR')}

Entrá al Panel del Bar en "Postulaciones de Músicos" para aceptar, enviar contraoferta o rechazar.

Equipo DeGira`,
    type: 'proposal_to_bar',
  });
}

/**
 * 6. Notificación al Músico sobre contraoferta o resolución del Bar
 */
export function sendNegotiationUpdateEmailToMusician(params: {
  musicianEmail: string;
  musicianName: string;
  venueName: string;
  eventTitle: string;
  action: 'counter' | 'accept' | 'reject';
  newCachetARS?: number;
  note?: string;
}) {
  const actionSubject =
    params.action === 'accept'
      ? `🎉 ¡Propuesta Aceptada por ${params.venueName}!`
      : params.action === 'counter'
      ? `💬 Contraoferta de Caché de ${params.venueName}`
      : `Actualización sobre tu propuesta en ${params.venueName}`;

  const actionText =
    params.action === 'accept'
      ? `¡Felicitaciones! ${params.venueName} aceptó tu propuesta para "${params.eventTitle}". La fecha está confirmada.`
      : params.action === 'counter'
      ? `${params.venueName} te envió una contraoferta de caché por $${params.newCachetARS?.toLocaleString('es-AR')}. Nota del bar: "${params.note || 'Sin nota'}".`
      : `${params.venueName} no pudo aceptar tu postulación en esta ocasión para "${params.eventTitle}".`;

  return saveEmailRecord({
    to: params.musicianEmail,
    subject: actionSubject,
    bodyText: `Hola ${params.musicianName},

${actionText}

Revisá los detalles en la pestaña "Mis Propuestas" en DeGira.

Equipo DeGira`,
    type: 'negotiation_update_musician',
  });
}

/**
 * 7. Envío de confirmación de reserva pendiente (tolerancia de 8 min)
 */
export function sendReservationCreatedEmail(params: {
  userEmail: string;
  userName: string;
  eventTitle: string;
  venueName: string;
  partySize: number;
  totalARS: number;
  eventCode: string;
}) {
  return saveEmailRecord({
    to: params.userEmail,
    subject: `⏱️ Reserva iniciada para ${params.eventTitle} (Código: ${params.eventCode})`,
    bodyText: `¡Hola ${params.userName}!

Iniciaste tu reserva para "${params.eventTitle}" en ${params.venueName}.
- Personas: ${params.partySize}
- Monto total: $${params.totalARS.toLocaleString('es-AR')}
- Código de transferencia / referencia: ${params.eventCode}

⚠️ Tenés 8 minutos para transferir y subir el comprobante en "Mi Perfil & Reservas". Si se agota el tiempo, los lugares vuelven a estar disponibles automáticamente.

Equipo DeGira`,
    type: 'reservation_created',
  });
}

/**
 * 8. Notificación de reserva caída por tiempo
 */
export function sendReservationExpiredEmail(params: {
  userEmail: string;
  userName: string;
  eventTitle: string;
  venueName: string;
  partySize: number;
}) {
  return saveEmailRecord({
    to: params.userEmail,
    subject: `⌛ Reserva expirada para ${params.eventTitle}`,
    bodyText: `Hola ${params.userName},

Se agotó el tiempo de tolerancia de 8 minutos para abonar tu reserva de ${params.partySize} lugares en ${params.venueName}.

Los lugares han sido devueltos a la cartelera pública. Si todavía deseás asistir, podés volver a reservar desde la Cartelera.

Equipo DeGira`,
    type: 'reservation_expired',
  });
}

