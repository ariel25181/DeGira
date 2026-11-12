import React, { useState, useEffect } from 'react';
import {
  X,
  Bell,
  CheckCheck,
  Mail,
  ExternalLink,
  QrCode,
  Clock,
  Sparkles,
  ChevronRight,
  Send,
  User,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import { getSentEmails, SentEmailRecord } from '../../lib/emailService.ts';

interface NotificationsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToTab?: (tab: string) => void;
}

export const NotificationsDrawer: React.FC<NotificationsDrawerProps> = ({
  isOpen,
  onClose,
  onNavigateToTab,
}) => {
  const {
    role,
    notifications,
    markNotificationsAsRead,
    markSingleNotificationAsRead,
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'app' | 'emails'>('app');
  const [sentEmails, setSentEmails] = useState<SentEmailRecord[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<SentEmailRecord | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSentEmails(getSentEmails());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleNotificationClick = (item: (typeof notifications)[0]) => {
    markSingleNotificationAsRead(item.id);
    if (!onNavigateToTab) return;

    if (role === 'espectador') {
      if (item.type === 'review' || item.title.includes('⭐')) {
        onNavigateToTab('perfil');
      } else if (item.title.includes('Pago') || item.title.includes('Reserva') || item.title.includes('8 minutos')) {
        onNavigateToTab('perfil');
      } else {
        onNavigateToTab('cartelera');
      }
    } else if (role === 'musico') {
      if (item.type === 'application' || item.type === 'confirmed') {
        onNavigateToTab('acuerdos');
      } else if (item.type === 'review') {
        onNavigateToTab('perfil');
      } else {
        onNavigateToTab('convocatorias');
      }
    } else if (role === 'bar') {
      if (item.type === 'application' || item.type === 'confirmed') {
        onNavigateToTab('acuerdos');
      } else if (item.type === 'review') {
        onNavigateToTab('perfil');
      } else {
        onNavigateToTab('convocatorias');
      }
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center space-x-2">
            <div className="relative">
              <Bell className="w-5 h-5 text-amber-400" />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-amber-500 text-slate-950 text-[9px] font-black flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </div>
            <div>
              <h3 className="font-bold text-slate-100 font-display text-sm">
                Centro de Novedades & Mensajes
              </h3>
              <p className="text-[11px] text-slate-400">
                Avisos en la app y despachos de correos electrónicos
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-1.5">
            {unreadCount > 0 && activeSubTab === 'app' && (
              <button
                onClick={markNotificationsAsRead}
                title="Marcar todas como leídas"
                className="text-xs text-amber-400 hover:text-amber-300 font-medium px-2 py-1 rounded bg-amber-500/10 border border-amber-500/20 transition-colors flex items-center gap-1"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Leer todas</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Segmented Selector: In-App Notifications vs Sent Emails */}
        <div className="p-2.5 bg-slate-950/50 border-b border-slate-800/80 grid grid-cols-2 gap-2">
          <button
            onClick={() => {
              setActiveSubTab('app');
              setSelectedEmail(null);
            }}
            className={`py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeSubTab === 'app'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 bg-slate-900/40 border border-transparent'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>En la App</span>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-400 text-slate-950 font-black">
                {unreadCount}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setActiveSubTab('emails');
              setSentEmails(getSentEmails());
            }}
            className={`py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeSubTab === 'emails'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 bg-slate-900/40 border border-transparent'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Emails Enviados</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300 font-bold">
              {sentEmails.length}
            </span>
          </button>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {activeSubTab === 'app' ? (
            notifications.length === 0 ? (
              <div className="text-center py-16 space-y-2">
                <Bell className="w-10 h-10 text-slate-700 mx-auto" />
                <p className="text-sm text-slate-400 font-medium">No tenés notificaciones pendientes</p>
                <p className="text-xs text-slate-600">
                  Las alertas de reservas, confirmaciones y avisos aparecerán aquí.
                </p>
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleNotificationClick(item)}
                  className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all relative ${
                    item.read
                      ? 'bg-slate-950/40 border-slate-800/60 text-slate-400 hover:border-slate-700'
                      : 'bg-slate-800/80 border-amber-500/40 text-slate-200 shadow-md ring-1 ring-amber-500/20 hover:border-amber-400'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1.5">
                    <span className="font-bold text-slate-100 flex items-center space-x-1.5">
                      {!item.read ? (
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block shrink-0 animate-pulse shadow-sm shadow-amber-400" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-slate-600 inline-block shrink-0" />
                      )}
                      <span className={item.read ? 'text-slate-300 font-semibold' : 'text-amber-300 font-bold'}>
                        {item.title}
                      </span>
                    </span>
                    <span className="text-[10px] text-slate-500 shrink-0 font-medium ml-2">
                      {item.timestamp}
                    </span>
                  </div>
                  <p className="text-slate-300 leading-relaxed text-xs">{item.message}</p>

                  <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
                    <span className="text-slate-500 text-[10px]">
                      {item.read ? 'Leída' : 'Tocar para ver y marcar leída'}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                  </div>
                </div>
              ))
            )
          ) : (
            /* Emails Sent Tab (Outbox Audit) */
            sentEmails.length === 0 ? (
              <div className="text-center py-16 space-y-2">
                <Mail className="w-10 h-10 text-slate-700 mx-auto" />
                <p className="text-sm text-slate-400 font-medium">No hay emails despachados aún</p>
                <p className="text-xs text-slate-600">
                  Cada acción clave genera un email (Pase QR, aviso al bar, feedback 360°, etc.).
                </p>
              </div>
            ) : selectedEmail ? (
              /* Single Email Detail View */
              <div className="space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
                <button
                  onClick={() => setSelectedEmail(null)}
                  className="text-xs text-amber-400 hover:underline flex items-center gap-1 font-semibold mb-2"
                >
                  ← Volver a la lista de emails
                </button>

                <div className="space-y-1 pb-3 border-b border-slate-800 text-xs">
                  <div className="flex justify-between items-center text-slate-400">
                    <span>Para: <strong className="text-amber-400">{selectedEmail.to}</strong></span>
                    <span className="text-[10px] text-slate-500">
                      {new Date(selectedEmail.sentAt).toLocaleTimeString('es-AR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div className="text-sm font-bold text-slate-100">{selectedEmail.subject}</div>
                </div>

                <div className="bg-slate-900 p-3 rounded-lg border border-slate-800/80 font-mono text-[11px] text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {selectedEmail.bodyText}
                </div>

                {selectedEmail.qrCodeUrl && (
                  <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 text-center space-y-2">
                    <span className="text-[11px] font-bold text-amber-400 block">
                      🎟️ Pase QR Adjunto en el Correo:
                    </span>
                    <img
                      src={selectedEmail.qrCodeUrl}
                      alt="Código QR de Acceso"
                      className="w-32 h-32 mx-auto rounded-lg bg-white p-2 shadow-md"
                    />
                  </div>
                )}
              </div>
            ) : (
              /* Emails List */
              sentEmails.map((email) => (
                <div
                  key={email.id}
                  onClick={() => setSelectedEmail(email)}
                  className="p-3 rounded-xl border border-slate-800/80 bg-slate-950/60 hover:bg-slate-800/60 hover:border-amber-500/40 text-xs cursor-pointer transition-all space-y-1.5"
                >
                  <div className="flex justify-between items-start">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                      {email.to}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {new Date(email.sentAt).toLocaleTimeString('es-AR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="font-bold text-slate-200 text-xs truncate">{email.subject}</p>
                  <p className="text-slate-400 text-[11px] line-clamp-2 leading-relaxed">
                    {email.bodyText}
                  </p>
                  <div className="pt-1 flex items-center justify-between text-[10px] text-slate-500">
                    <span>{email.qrCodeUrl ? '🎟️ Incluye Pase QR' : '✉️ Notificación'}</span>
                    <span className="text-amber-400 flex items-center gap-0.5 font-medium">
                      Ver correo completo →
                    </span>
                  </div>
                </div>
              ))
            )
          )}
        </div>
      </div>
    </div>
  );
};
