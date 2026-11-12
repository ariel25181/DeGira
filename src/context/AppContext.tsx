import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  INITIAL_VENUES,
  INITIAL_MUSICIANS,
  INITIAL_OPEN_CALLS,
  INITIAL_MUSICIAN_AVAILABILITIES,
  INITIAL_LIVE_SHOWS,
  INITIAL_PUBLIC_USERS,
  INITIAL_SPECTATOR_RESERVATIONS,
  INITIAL_EVENT_PROPOSALS,
  INITIAL_SLOT_BIDS,
  INITIAL_EVENT_RESERVATIONS,
  INITIAL_REVIEWS_360,
} from '../data/seedData.ts';
import {
  UserRole,
  VenueProfile,
  MusicianProfile,
  VenueOpenCall,
  MusicianAvailability,
  LiveShowConfirmed,
  Review,
  Application,
  DirectOffer,
  MusicGenre,
  NeighborhoodBA,
  PublicUserProfile,
  SpectatorReservation,
  EventProposal,
  EventStatus,
  EventSlot,
  EventRider,
  MusicianSlotBid,
  SlotBidHistoryEntry,
  PublicEventReservation,
  ReservationStatus,
  EventReview360,
  MusicianMusicLinks,
  MusicianInputChannel,
  SpectatorBenefit,
} from '../types/index.ts';
import { calculateNewRating, calculateNewBreakdown } from '../utils/bookingLogic.ts';
import { supabase } from '../lib/supabaseClient.ts';
import { mapVenue, mapMusician, mapOpenCall, mapAvailability, mapLiveShow } from '../lib/supabaseMappers.ts';
import {
  sendQrTicketEmail,
  sendPaymentUploadedAlertToBar,
  sendEventPublishedToMusician,
  sendReviewReminderEmail,
  sendProposalReceivedEmailToBar,
  sendNegotiationUpdateEmailToMusician,
  sendReservationCreatedEmail,
  sendReservationExpiredEmail,
} from '../lib/emailService.ts';
import { sendPushNotification } from '../lib/push.ts';
import { clearActiveSession, saveActiveSession } from '../lib/degiraSession.ts';
import { TestAccount } from '../data/testAccounts.ts';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: 'application' | 'offer' | 'confirmed' | 'review' | 'system';
}

interface AppContextType {
  role: UserRole;
  setRole: (role: UserRole) => void;
  activeMusicianId: string;
  setActiveMusicianId: (id: string) => void;
  activeVenueId: string;
  setActiveVenueId: (id: string) => void;
  activePublicUserId: string;
  setActivePublicUserId: (id: string) => void;

  venues: VenueProfile[];
  musicians: MusicianProfile[];
  publicUsers: PublicUserProfile[];
  openCalls: VenueOpenCall[];
  musicianAvailabilities: MusicianAvailability[];
  liveShows: LiveShowConfirmed[];
  notifications: NotificationItem[];
  reservations: SpectatorReservation[];

  // Nuevas entidades DeGira
  eventProposals: EventProposal[];
  slotBids: MusicianSlotBid[];
  publicEventReservations: PublicEventReservation[];
  reviews360: EventReview360[];

  currentMusician: MusicianProfile | undefined;
  currentVenue: VenueProfile | undefined;
  currentPublicUser: PublicUserProfile | undefined;
  userDisplayName: string;
  setUserDisplayName: (name: string) => void;

  // Actions
  publishOpenCall: (callData: Omit<VenueOpenCall, 'id' | 'applications' | 'createdAt' | 'status'>) => void;
  applyToOpenCall: (callId: string, application: Omit<Application, 'id' | 'callId' | 'status' | 'createdAt'>) => void;
  acceptApplication: (callId: string, applicationId: string) => void;
  rejectApplication: (callId: string, applicationId: string) => void;

  publishAvailability: (availData: Omit<MusicianAvailability, 'id' | 'directOffers' | 'createdAt' | 'status'>) => void;
  sendDirectOffer: (availabilityId: string, offer: Omit<DirectOffer, 'id' | 'availabilityId' | 'status' | 'createdAt'>) => void;
  acceptDirectOffer: (availabilityId: string, offerId: string) => void;
  rejectDirectOffer: (availabilityId: string, offerId: string) => void;

  submitReview: (reviewData: Omit<Review, 'id' | 'createdAt'>, showIdToComplete?: string) => void;
  markNotificationsAsRead: () => void;
  markSingleNotificationAsRead: (id: string) => void;
  resetAllData: () => void;

  // Spectator & Mercado Pago Reservations
  createReservation: (data: Omit<SpectatorReservation, 'id' | 'createdAt'>) => SpectatorReservation;
  payReservation: (reservationId: string, mpPaymentId?: string) => void;
  cancelReservation: (reservationId: string) => void;

  // Acciones DeGira Eventos, Propuestas, Bids, Comprobantes y Calificaciones 360
  createEventProposal: (data: Omit<EventProposal, 'id' | 'createdAt' | 'eventCode' | 'remainingCapacity'>) => EventProposal;
  updateEventProposal: (id: string, updates: Partial<EventProposal>) => void;
  publishEventProposal: (id: string) => void;
  approveAndPublishEvent: (proposalId: string) => void;
  addNewVenue: (venueData: Omit<VenueProfile, 'id' | 'rating' | 'reviewCount' | 'reviews' | 'ratingBreakdown'>) => VenueProfile;
  saveVenueRiderTemplate: (venueId: string, template: EventRider) => void;
  liquidateMusicianCachet: (proposalId: string) => void;
  submitSlotBid: (data: {
    eventId: string;
    slotId: string;
    proposedCachetARS: number;
    musiciansCount: number;
    equipmentProvided: string;
    equipmentNeeded: string;
    musicLinks?: MusicianMusicLinks;
    inputList?: MusicianInputChannel[];
    initialNote?: string;
  }) => void;
  updateMusicianMusicLinks: (musicianId: string, links: MusicianMusicLinks, inputList?: MusicianInputChannel[]) => void;
  sendMusicianProposalReminder: (bidId: string) => { success: boolean; message: string };
  retractMusicianSlotBid: (bidId: string) => { success: boolean; message: string };
  respondToSlotBid: (
    bidId: string,
    action: 'accept' | 'reject' | 'counter',
    counterCachet?: number,
    note?: string
  ) => void;
  createPublicEventReservation: (
    eventId: string,
    partySize: number,
    userName?: string,
    userEmail?: string
  ) => PublicEventReservation;
  cancelPublicEventReservation: (reservationId: string) => void;
  updatePublicUserProfile: (updates: Partial<PublicUserProfile>) => void;
  uploadPaymentReceipt: (reservationId: string, imageDataUrl: string, ocrNotes?: string) => void;
  confirmReservationPayment: (reservationId: string) => void;
  rejectReservationPayment: (reservationId: string, reason: string) => void;
  expireReservation: (reservationId: string) => void;
  checkInReservation: (qrCodeOrReservationId: string) => { success: boolean; message: string; reservation?: PublicEventReservation };
  joinEventWaitlist: (proposalId: string, email: string) => { success: boolean; message: string };
  triggerOneHourPostEventFeedback: (eventId: string) => void;
  submitReview360: (reviewData: Omit<EventReview360, 'id' | 'createdAt'>) => void;
  spectatorBenefits: SpectatorBenefit[];
  addSpectatorBenefit: (benefit: SpectatorBenefit) => void;

  // Session & Authentication
  loginAsAccount: (account: TestAccount) => void;
  logout: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEY_PREFIX = 'suena_ba_v3_';

// Auto-clean stale legacy mock data from localStorage
try {
  const oldVenues = localStorage.getItem('suena_ba_v1_venues') || localStorage.getItem('suena_ba_v2_venues');
  if (oldVenues && (oldVenues.includes('Thelonious') || oldVenues.includes('Café Berlín') || oldVenues.includes('Julieta'))) {
    ['venues', 'musicians', 'openCalls', 'availabilities', 'liveShows', 'notifications'].forEach((key) => {
      localStorage.removeItem(`suena_ba_v1_${key}`);
      localStorage.removeItem(`suena_ba_v2_${key}`);
    });
  }
} catch {
  // ignore
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRole] = useState<UserRole>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}role`);
    return (saved as UserRole) || 'espectador';
  });

  const [activeMusicianId, setActiveMusicianId] = useState<string>(() => {
    return localStorage.getItem(`${STORAGE_KEY_PREFIX}activeMusicianId`) || 'mus-1';
  });

  const [activeVenueId, setActiveVenueId] = useState<string>(() => {
    return localStorage.getItem(`${STORAGE_KEY_PREFIX}activeVenueId`) || 'venue-1';
  });

  const [activePublicUserId, setActivePublicUserId] = useState<string>(() => {
    return localStorage.getItem(`${STORAGE_KEY_PREFIX}activePublicUserId`) || 'user-pub-1';
  });

  const [venues, setVenues] = useState<VenueProfile[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}venues`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.some((v: any) => v.name?.includes('Test'))) return parsed;
      } catch {}
    }
    return INITIAL_VENUES;
  });

  const [musicians, setMusicians] = useState<MusicianProfile[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}musicians`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.some((m: any) => m.stageName?.includes('Test'))) return parsed;
      } catch {}
    }
    return INITIAL_MUSICIANS;
  });

  const [publicUsers, setPublicUsers] = useState<PublicUserProfile[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}publicUsers`);
    return saved ? JSON.parse(saved) : INITIAL_PUBLIC_USERS;
  });

  const [openCalls, setOpenCalls] = useState<VenueOpenCall[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}openCalls`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.some((c: any) => c.venueName?.includes('Test'))) return parsed;
      } catch {}
    }
    return INITIAL_OPEN_CALLS;
  });

  const [musicianAvailabilities, setMusicianAvailabilities] = useState<MusicianAvailability[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}availabilities`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.some((a: any) => a.musicianName?.includes('Test'))) return parsed;
      } catch {}
    }
    return INITIAL_MUSICIAN_AVAILABILITIES;
  });

  const [liveShows, setLiveShows] = useState<LiveShowConfirmed[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}liveShows`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.some((s: any) => s.venueName?.includes('Test'))) return parsed;
      } catch {}
    }
    return INITIAL_LIVE_SHOWS;
  });

  const [reservations, setReservations] = useState<SpectatorReservation[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}reservations`);
    return saved ? JSON.parse(saved) : INITIAL_SPECTATOR_RESERVATIONS;
  });

  const [storedUserName, setStoredUserName] = useState<string>(() => {
    return localStorage.getItem('suenaba:logged_user_name') || '';
  });

  // Entidades principales de la nueva arquitectura DeGira
  const [eventProposals, setEventProposals] = useState<EventProposal[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}eventProposals`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
    return INITIAL_EVENT_PROPOSALS;
  });

  const [slotBids, setSlotBids] = useState<MusicianSlotBid[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}slotBids`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
    }
    return INITIAL_SLOT_BIDS;
  });

  const [publicEventReservations, setPublicEventReservations] = useState<PublicEventReservation[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}publicEventReservations`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
    }
    return INITIAL_EVENT_RESERVATIONS;
  });

  const [reviews360, setReviews360] = useState<EventReview360[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}reviews360`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
    }
    return INITIAL_REVIEWS_360;
  });

  const [spectatorBenefits, setSpectatorBenefits] = useState<SpectatorBenefit[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}spectatorBenefits`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
    }
    return [
      {
        badge: 'Espectador Frecuente',
        promoCode: 'DEGIRA-BIENVENIDA-10',
        discountPercent: 10,
        earnedAt: '2026-11-01',
      },
    ];
  });

  const [notifications, setNotifications] = useState<NotificationItem[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}notifications`);
    if (saved) return JSON.parse(saved);
    return [
      {
        id: 'notif-1',
        title: '¡Nueva postulación recibida!',
        message: 'Músico Test 1 se postuló para tu fecha del 20 de Noviembre en Bar Test 1.',
        timestamp: 'Hace 2 horas',
        read: false,
        type: 'application',
      },
      {
        id: 'notif-2',
        title: '¡Propuesta directa de fecha!',
        message: 'Bar Test 1 te envió una oferta para tocar el 21 de Noviembre.',
        timestamp: 'Hace 4 horas',
        read: false,
        type: 'offer',
      },
    ];
  });

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}eventProposals`, JSON.stringify(eventProposals));
  }, [eventProposals]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}slotBids`, JSON.stringify(slotBids));
  }, [slotBids]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}publicEventReservations`, JSON.stringify(publicEventReservations));
  }, [publicEventReservations]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}reviews360`, JSON.stringify(reviews360));
  }, [reviews360]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}spectatorBenefits`, JSON.stringify(spectatorBenefits));
  }, [spectatorBenefits]);

  // Cronómetro de expiración de reservas (8 minutos exactos)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setPublicEventReservations((prev) => {
        let hasChanges = false;
        const updated = prev.map((res) => {
          if (res.status === 'pendiente_pago' && now > res.expiresAt) {
            hasChanges = true;
            // Liberar cupo devolviendo disponibilidad
            setEventProposals((events) =>
              events.map((ev) => {
                if (ev.id === res.eventId) {
                  const restored = Math.min(ev.totalCapacity, ev.remainingCapacity + res.partySize);
                  return {
                    ...ev,
                    remainingCapacity: restored,
                    status: ev.status === 'agotada' && restored > 0 ? 'publicada' : ev.status,
                  };
                }
                return ev;
              })
            );
            return {
              ...res,
              status: 'expirada' as const,
            };
          }
          return res;
        });
        return hasChanges ? updated : prev;
      });
    }, 4000);

    return () => clearInterval(interval);
  }, []);
  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}role`, role);
  }, [role]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}activeMusicianId`, activeMusicianId);
  }, [activeMusicianId]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}activeVenueId`, activeVenueId);
  }, [activeVenueId]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}activePublicUserId`, activePublicUserId);
  }, [activePublicUserId]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}venues`, JSON.stringify(venues));
  }, [venues]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}musicians`, JSON.stringify(musicians));
  }, [musicians]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}publicUsers`, JSON.stringify(publicUsers));
  }, [publicUsers]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}openCalls`, JSON.stringify(openCalls));
  }, [openCalls]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}availabilities`, JSON.stringify(musicianAvailabilities));
  }, [musicianAvailabilities]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}liveShows`, JSON.stringify(liveShows));
  }, [liveShows]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}reservations`, JSON.stringify(reservations));
  }, [reservations]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}notifications`, JSON.stringify(notifications));
  }, [notifications]);

  // Synchronize with Supabase Cloud Database (keeping strictly test entities)
  useEffect(() => {
    async function syncWithSupabase() {
      if (!supabase) return;
      try {
        const { data: vData } = await supabase.from('venues').select('*');
        if (vData && vData.length > 0) {
          const testVenues = vData.map(mapVenue).filter((v) => v.name.includes('Test') || v.id === 'venue-1');
          if (testVenues.length > 0) setVenues(testVenues);
        }

        const { data: mData } = await supabase.from('musicians').select('*');
        if (mData && mData.length > 0) {
          const testMusicians = mData.map(mapMusician).filter((m) => m.stageName.includes('Test') || m.id === 'mus-1' || m.id === 'mus-2');
          if (testMusicians.length > 0) setMusicians(testMusicians);
        }

        const { data: cData } = await supabase.from('open_calls').select('*');
        if (cData && cData.length > 0) {
          const testCalls = cData.map(mapOpenCall).filter((c) => c.venueName.includes('Test') || c.venueId === 'venue-1');
          if (testCalls.length > 0) setOpenCalls(testCalls);
        }

        const { data: aData } = await supabase.from('musician_availabilities').select('*');
        if (aData && aData.length > 0) {
          const testAvails = aData.map(mapAvailability).filter((a) => a.musicianName.includes('Test') || a.musicianId === 'mus-1' || a.musicianId === 'mus-2');
          if (testAvails.length > 0) setMusicianAvailabilities(testAvails);
        }

        const { data: sData } = await supabase.from('live_shows').select('*');
        if (sData && sData.length > 0) {
          const testShows = sData.map(mapLiveShow).filter((s) => s.venueName.includes('Test') || s.venueId === 'venue-1');
          if (testShows.length > 0) setLiveShows(testShows);
        }
      } catch {
        // Fallback to initial seed if offline or tables not yet migrated
      }
    }
    syncWithSupabase();
  }, []);

  const currentMusician = musicians.find((m) => m.id === activeMusicianId) || musicians[0];
  const currentVenue = venues.find((v) => v.id === activeVenueId) || venues[0];
  const currentPublicUser = publicUsers.find((u) => u.id === activePublicUserId) || publicUsers[0];

  const userDisplayName = storedUserName || (
    role === 'espectador'
      ? (currentPublicUser?.name || 'Usuario Público 1')
      : role === 'musico'
      ? (currentMusician?.stageName || 'Músico Test 1')
      : (currentVenue?.name || 'Bar Test 1')
  );

  const setUserDisplayName = (name: string) => {
    setStoredUserName(name);
    try {
      localStorage.setItem('suenaba:logged_user_name', name);
    } catch {
      // ignore
    }
  };

  const publishOpenCall = (callData: Omit<VenueOpenCall, 'id' | 'applications' | 'createdAt' | 'status'>) => {
    const newCall: VenueOpenCall = {
      ...callData,
      id: `call-${Date.now()}`,
      status: 'abierta',
      applications: [],
      createdAt: new Date().toISOString().split('T')[0],
    };
    setOpenCalls((prev) => [newCall, ...prev]);

    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}`,
        title: 'Convocatoria publicada con éxito',
        message: `Tu fecha para el ${newCall.date} ya está visible para los músicos de Buenos Aires.`,
        timestamp: 'Recién',
        read: false,
        type: 'application',
      },
      ...prev,
    ]);
  };

  const applyToOpenCall = (callId: string, applicationData: Omit<Application, 'id' | 'callId' | 'status' | 'createdAt'>) => {
    const newApp: Application = {
      ...applicationData,
      id: `app-${Date.now()}`,
      callId,
      status: 'pendiente',
      createdAt: new Date().toISOString().split('T')[0],
    };

    setOpenCalls((prev) =>
      prev.map((c) => {
        if (c.id === callId) {
          return {
            ...c,
            applications: [newApp, ...c.applications],
          };
        }
        return c;
      })
    );

    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}`,
        title: '¡Postulación enviada!',
        message: `Te postulaste a la fecha en ${applicationData.musicianName}. El bar revisará tu propuesta.`,
        timestamp: 'Recién',
        read: false,
        type: 'application',
      },
      ...prev,
    ]);
  };

  const acceptApplication = (callId: string, applicationId: string) => {
    let acceptedMusicianId = '';
    let targetCall: VenueOpenCall | undefined;

    setOpenCalls((prev) =>
      prev.map((call) => {
        if (call.id === callId) {
          targetCall = call;
          const updatedApps = call.applications.map((app) => {
            if (app.id === applicationId) {
              acceptedMusicianId = app.musicianId;
              return { ...app, status: 'aceptada' as const };
            }
            return { ...app, status: 'rechazada' as const };
          });
          const acceptedApp = updatedApps.find((a) => a.id === applicationId);
          return {
            ...call,
            status: 'cerrada_confirmada' as const,
            confirmedMusicianId: acceptedMusicianId,
            confirmedMusicianName: acceptedApp?.musicianName,
            applications: updatedApps,
          };
        }
        return call;
      })
    );

    if (targetCall) {
      const musician = musicians.find((m) => m.id === acceptedMusicianId);
      const venue = venues.find((v) => v.id === targetCall?.venueId);

      if (musician && venue) {
        // Create confirmed live show on public catalog
        const newShow: LiveShowConfirmed = {
          id: `show-${Date.now()}`,
          date: targetCall.date,
          time: targetCall.showTime.split(' ')[0] + ' hs',
          venueId: venue.id,
          venueName: venue.name,
          venueAddress: venue.address,
          venueNeighborhood: venue.neighborhood,
          venuePhoto: venue.coverPhoto,
          musicianId: musician.id,
          musicianName: musician.stageName,
          musicianGenres: musician.genres,
          musicianFormat: musician.format,
          musicianAvatar: musician.avatarUrl,
          ticketType: 'consumicion_minima',
          ticketPriceARS: 7000,
          description: `Show en vivo confirmado a través de DeGira. ${targetCall.specialNotes}`,
          isCompleted: false,
          venueReviewed: false,
          musicianReviewed: false,
        };

        setLiveShows((prev) => [newShow, ...prev]);

        setNotifications((prev) => [
          {
            id: `notif-${Date.now()}`,
            title: '🎉 ¡Acuerdo Confirmado & Show Publicado!',
            message: `La fecha del ${targetCall?.date} en ${venue.name} con ${musician.stageName} ya está en la cartelera de Buenos Aires.`,
            timestamp: 'Recién',
            read: false,
            type: 'confirmed',
          },
          ...prev,
        ]);
      }
    }
  };

  const rejectApplication = (callId: string, applicationId: string) => {
    setOpenCalls((prev) =>
      prev.map((call) => {
        if (call.id === callId) {
          return {
            ...call,
            applications: call.applications.map((app) =>
              app.id === applicationId ? { ...app, status: 'rechazada' as const } : app
            ),
          };
        }
        return call;
      })
    );
  };

  const publishAvailability = (availData: Omit<MusicianAvailability, 'id' | 'directOffers' | 'createdAt' | 'status'>) => {
    const newAvail: MusicianAvailability = {
      ...availData,
      id: `avail-${Date.now()}`,
      status: 'disponible',
      directOffers: [],
      createdAt: new Date().toISOString().split('T')[0],
    };
    setMusicianAvailabilities((prev) => [newAvail, ...prev]);

    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}`,
        title: 'Disponibilidad publicada',
        message: `Bares y restaurantes de CABA ya pueden ver tu fecha libre del ${newAvail.date}.`,
        timestamp: 'Recién',
        read: false,
        type: 'offer',
      },
      ...prev,
    ]);
  };

  const sendDirectOffer = (availabilityId: string, offerData: Omit<DirectOffer, 'id' | 'availabilityId' | 'status' | 'createdAt'>) => {
    const newOffer: DirectOffer = {
      ...offerData,
      id: `offer-${Date.now()}`,
      availabilityId,
      status: 'pendiente',
      createdAt: new Date().toISOString().split('T')[0],
    };

    setMusicianAvailabilities((prev) =>
      prev.map((item) => {
        if (item.id === availabilityId) {
          return {
            ...item,
            directOffers: [newOffer, ...item.directOffers],
          };
        }
        return item;
      })
    );

    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}`,
        title: '¡Oferta enviada al músico!',
        message: `Enviaste una propuesta a ${offerData.venueName} para la fecha indicada.`,
        timestamp: 'Recién',
        read: false,
        type: 'offer',
      },
      ...prev,
    ]);
  };

  const acceptDirectOffer = (availabilityId: string, offerId: string) => {
    let acceptedOffer: DirectOffer | undefined;
    let targetAvail: MusicianAvailability | undefined;

    setMusicianAvailabilities((prev) =>
      prev.map((item) => {
        if (item.id === availabilityId) {
          targetAvail = item;
          const updatedOffers = item.directOffers.map((o) => {
            if (o.id === offerId) {
              acceptedOffer = o;
              return { ...o, status: 'aceptada' as const };
            }
            return { ...o, status: 'rechazada' as const };
          });
          return {
            ...item,
            status: 'reservado' as const,
            directOffers: updatedOffers,
          };
        }
        return item;
      })
    );

    if (acceptedOffer && targetAvail) {
      const musician = musicians.find((m) => m.id === targetAvail?.musicianId);
      const venue = venues.find((v) => v.id === acceptedOffer?.venueId);

      if (musician && venue) {
        const newShow: LiveShowConfirmed = {
          id: `show-${Date.now()}`,
          date: acceptedOffer.date,
          time: '21:30 hs',
          venueId: venue.id,
          venueName: venue.name,
          venueAddress: venue.address,
          venueNeighborhood: venue.neighborhood,
          venuePhoto: venue.coverPhoto,
          musicianId: musician.id,
          musicianName: musician.stageName,
          musicianGenres: musician.genres,
          musicianFormat: musician.format,
          musicianAvatar: musician.avatarUrl,
          ticketType: 'entrada_libre',
          ticketPriceARS: 0,
          description: `Acuerdo directo concretado en DeGira. ¡Música en vivo en ${venue.neighborhood}!`,
          isCompleted: false,
          venueReviewed: false,
          musicianReviewed: false,
        };

        setLiveShows((prev) => [newShow, ...prev]);

        setNotifications((prev) => [
          {
            id: `notif-${Date.now()}`,
            title: '🎉 ¡Oferta Aceptada!',
            message: `Acordaste fecha para el ${acceptedOffer?.date} en ${venue.name}. Se sumó a la cartelera.`,
            timestamp: 'Recién',
            read: false,
            type: 'confirmed',
          },
          ...prev,
        ]);
      }
    }
  };

  const rejectDirectOffer = (availabilityId: string, offerId: string) => {
    setMusicianAvailabilities((prev) =>
      prev.map((item) => {
        if (item.id === availabilityId) {
          return {
            ...item,
            directOffers: item.directOffers.map((o) =>
              o.id === offerId ? { ...o, status: 'rechazada' as const } : o
            ),
          };
        }
        return item;
      })
    );
  };

  const submitReview = (reviewData: Omit<Review, 'id' | 'createdAt'>, showIdToComplete?: string) => {
    const newReview: Review = {
      ...reviewData,
      id: `rev-${Date.now()}`,
      createdAt: new Date().toISOString().split('T')[0],
    };

    if (reviewData.targetType === 'venue') {
      setVenues((prev) =>
        prev.map((v) => {
          if (v.id === reviewData.targetId) {
            const { rating, count } = calculateNewRating(v.rating, v.reviewCount, reviewData.rating);
            const breakdown = calculateNewBreakdown(v.ratingBreakdown, v.reviewCount, reviewData.criteriaBreakdown);
            return {
              ...v,
              rating,
              reviewCount: count,
              ratingBreakdown: breakdown as any,
              reviews: [newReview, ...v.reviews],
            };
          }
          return v;
        })
      );
    } else {
      setMusicians((prev) =>
        prev.map((m) => {
          if (m.id === reviewData.targetId) {
            const { rating, count } = calculateNewRating(m.rating, m.reviewCount, reviewData.rating);
            const breakdown = calculateNewBreakdown(m.ratingBreakdown, m.reviewCount, reviewData.criteriaBreakdown);
            return {
              ...m,
              rating,
              reviewCount: count,
              ratingBreakdown: breakdown as any,
              reviews: [newReview, ...m.reviews],
            };
          }
          return m;
        })
      );
    }

    if (showIdToComplete) {
      setLiveShows((prev) =>
        prev.map((s) => {
          if (s.id === showIdToComplete) {
            if (reviewData.authorType === 'musician') {
              return { ...s, venueReviewed: true };
            } else {
              return { ...s, musicianReviewed: true };
            }
          }
          return s;
        })
      );
    }

    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}`,
        title: '⭐ ¡Reseña bilateral publicada!',
        message: `Calificaste a ${reviewData.targetType === 'venue' ? 'el bar' : 'el músico'} con ${reviewData.rating} estrellas. Su reputación fue actualizada.`,
        timestamp: 'Recién',
        read: false,
        type: 'review',
      },
      ...prev,
    ]);
  };

  const markNotificationsAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markSingleNotificationAsRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const createReservation = (data: Omit<SpectatorReservation, 'id' | 'createdAt'>): SpectatorReservation => {
    const newRes: SpectatorReservation = {
      ...data,
      id: `res-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      createdAt: new Date().toISOString().split('T')[0],
    };
    setReservations((prev) => [newRes, ...prev]);

    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}`,
        title: '🎫 ¡Nueva reserva registrada!',
        message: `Mesa reservada para ${data.partySize} personas en ${data.venueName}. Show: ${data.musicianName}.`,
        timestamp: 'Recién',
        read: false,
        type: 'confirmed',
      },
      ...prev,
    ]);

    return newRes;
  };

  const payReservation = (reservationId: string, mpPaymentId?: string) => {
    const paymentId = mpPaymentId || `MP-${Math.floor(10000000 + Math.random() * 90000000)}`;
    setReservations((prev) =>
      prev.map((r) =>
        r.id === reservationId
          ? {
              ...r,
              paymentStatus: 'pagado_mp' as const,
              mpPaymentId: paymentId,
            }
          : r
      )
    );

    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}`,
        title: '💳 ¡Pago recibido por Mercado Pago!',
        message: `Se confirmó el pago con Mercado Pago (ID: ${paymentId}). Mostrá tu código de reserva en el bar.`,
        timestamp: 'Recién',
        read: false,
        type: 'confirmed',
      },
      ...prev,
    ]);
  };

  const cancelReservation = (reservationId: string) => {
    setReservations((prev) => prev.filter((r) => r.id !== reservationId));
  };

  const createEventProposal = (
    data: Omit<EventProposal, 'id' | 'createdAt' | 'eventCode' | 'remainingCapacity'>
  ): EventProposal => {
    const codeNumber = Math.floor(1000 + Math.random() * 9000);
    const newProposal: EventProposal = {
      ...data,
      id: `ev-${Date.now()}`,
      eventCode: `DG-BAR1-${codeNumber}`,
      remainingCapacity: data.totalCapacity,
      status: data.status || 'propuesta',
      createdAt: new Date().toISOString(),
    };
    setEventProposals((prev) => [newProposal, ...prev]);
    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}`,
        title: '📋 Propuesta de Evento creada',
        message: `Has creado la propuesta "${newProposal.title}" con código ${newProposal.eventCode}.`,
        timestamp: 'Recién',
        read: false,
        type: 'system',
      },
      ...prev,
    ]);
    return newProposal;
  };

  const updateEventProposal = (id: string, updates: Partial<EventProposal>) => {
    setEventProposals((prev) =>
      prev.map((ev) => (ev.id === id ? { ...ev, ...updates } : ev))
    );
  };

  const publishEventProposal = (id: string) => {
    setEventProposals((prev) =>
      prev.map((ev) => {
        if (ev.id === id) {
          // Notificar por email a los músicos acordados
          ev.slots.forEach((slot) => {
            if (slot.assignedMusicianId) {
              const musician = musicians.find((m) => m.id === slot.assignedMusicianId);
              sendEventPublishedToMusician({
                musicianEmail: `${slot.assignedMusicianId}@degira.com.ar`,
                musicianName: slot.assignedMusicianName || musician?.stageName || 'Músico',
                eventTitle: ev.title,
                venueName: ev.venueName,
                eventDate: ev.date,
                slotTime: `${slot.startTime} - ${slot.endTime}`,
                agreedCachetARS: slot.agreedCachetARS || ev.baseCachetARS,
              });
            }
          });

          return { ...ev, status: 'publicada' as const };
        }
        return ev;
      })
    );

    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}`,
        title: '🎉 Evento Publicado en Cartelera',
        message: 'El evento ya está disponible para que el público general reserve entradas.',
        timestamp: 'Recién',
        read: false,
        type: 'confirmed',
      },
      ...prev,
    ]);
  };

  const saveVenueRiderTemplate = (venueId: string, template: EventRider) => {
    setVenues((prev) =>
      prev.map((v) => (v.id === venueId ? { ...v, defaultRiderTemplate: template } : v))
    );
    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}`,
        title: '📋 Ficha Técnica de Sala Guardada',
        message: 'Tu configuración de escenario, consola, micrófonos y luces quedó guardada para futuros eventos.',
        timestamp: 'Recién',
        read: false,
        type: 'system',
      },
      ...prev,
    ]);
  };

  const liquidateMusicianCachet = (proposalId: string) => {
    setEventProposals((prev) =>
      prev.map((ev) =>
        ev.id === proposalId
          ? {
              ...ev,
              cachetPaid: true,
              cachetPaidAt: new Date().toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }),
            }
          : ev
      )
    );
    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}`,
        title: '💰 Cachet Liquidado',
        message: 'Se registró el pago del cachet acordado a los músicos del show.',
        timestamp: 'Recién',
        read: false,
        type: 'confirmed',
      },
      ...prev,
    ]);
  };

  const updateMusicianMusicLinks = (
    musicianId: string,
    links: MusicianMusicLinks,
    inputList?: MusicianInputChannel[]
  ) => {
    setMusicians((prev) =>
      prev.map((m) =>
        m.id === musicianId
          ? {
              ...m,
              musicLinks: { ...m.musicLinks, ...links },
              defaultInputList: inputList || m.defaultInputList,
            }
          : m
      )
    );
    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}`,
        title: '🎸 Perfil Musical Actualizado',
        message: 'Se actualizaron tus enlaces musicales (Spotify/YouTube) y tu lista de canales (Input List).',
        timestamp: 'Recién',
        read: false,
        type: 'system',
      },
      ...prev,
    ]);
  };

  const submitSlotBid = (data: {
    eventId: string;
    slotId: string;
    proposedCachetARS: number;
    musiciansCount: number;
    equipmentProvided: string;
    equipmentNeeded: string;
    musicLinks?: MusicianMusicLinks;
    inputList?: MusicianInputChannel[];
    initialNote?: string;
  }) => {
    const mus = currentMusician || musicians[0];
    const newBid: MusicianSlotBid = {
      id: `bid-${Date.now()}`,
      eventId: data.eventId,
      slotId: data.slotId,
      musicianId: mus.id,
      musicianName: mus.stageName,
      musicianAvatar: mus.avatarUrl,
      proposedCachetARS: data.proposedCachetARS,
      musiciansCount: data.musiciansCount,
      equipmentProvided: data.equipmentProvided,
      equipmentNeeded: data.equipmentNeeded,
      musicLinks: data.musicLinks || mus.musicLinks,
      inputList: data.inputList || mus.defaultInputList,
      status: 'pendiente_bar',
      history: [
        {
          id: `h-${Date.now()}`,
          actor: 'musico',
          actorName: mus.stageName,
          cachetARS: data.proposedCachetARS,
          note: data.initialNote || 'Postulación enviada con propuesta de caché y equipamiento.',
          createdAt: new Date().toISOString(),
        },
      ],
      createdAt: new Date().toISOString(),
    };

    setSlotBids((prev) => [newBid, ...prev]);

    setEventProposals((prev) =>
      prev.map((ev) => {
        if (ev.id === data.eventId) {
          return {
            ...ev,
            slots: ev.slots.map((s) =>
              s.id === data.slotId && s.status === 'libre'
                ? { ...s, status: 'negociando' as const }
                : s
            ),
          };
        }
        return ev;
      })
    );

    const targetEvent = eventProposals.find((e) => e.id === data.eventId);
    const targetSlot = targetEvent?.slots.find((s) => s.id === data.slotId);
    const barEmail = targetEvent?.venueId === 'venue-2' ? 'bar2@degira.com.ar' : 'bar1@degira.com.ar';

    sendProposalReceivedEmailToBar({
      barEmail,
      venueName: targetEvent?.venueName || 'Bar DeGira',
      musicianName: mus.stageName,
      eventTitle: targetEvent?.title || 'Show en Vivo',
      slotTime: targetSlot ? `${targetSlot.startTime} - ${targetSlot.endTime}` : '21:00',
      cachetARS: data.proposedCachetARS,
    });

    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}-mus`,
        title: '🎵 Propuesta enviada al bar',
        message: `Tu propuesta para "${targetEvent?.title || 'el evento'}" fue enviada a ${targetEvent?.venueName || 'el bar'}.`,
        timestamp: 'Recién',
        read: false,
        type: 'application',
      },
      {
        id: `notif-${Date.now()}-bar`,
        title: '🎸 Nueva Postulación de Músico',
        message: `${mus.stageName} envió una propuesta con caché de $${data.proposedCachetARS.toLocaleString('es-AR')} para "${targetEvent?.title || 'tu fecha'}".`,
        timestamp: 'Recién',
        read: false,
        type: 'application',
      },
      ...prev,
    ]);
  };

  const sendMusicianProposalReminder = (bidId: string): { success: boolean; message: string } => {
    const bid = slotBids.find((b) => b.id === bidId);
    if (!bid) return { success: false, message: 'Propuesta no encontrada.' };

    const event = eventProposals.find((e) => e.id === bid.eventId);
    const updatedCount = (bid.reminderCount || 0) + 1;

    setSlotBids((prev) =>
      prev.map((b) =>
        b.id === bidId
          ? {
              ...b,
              reminderSentAt: new Date().toISOString(),
              reminderCount: updatedCount,
            }
          : b
      )
    );

    // Notificaciones en el panel
    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}-mus`,
        title: '🔔 Recordatorio enviado al Bar',
        message: `Le enviaste un recordatorio a ${event?.venueName || 'el bar'} para que revise tu propuesta para "${event?.title || 'el evento'}".`,
        timestamp: 'Recién',
        read: false,
        type: 'system',
      },
      {
        id: `notif-${Date.now()}-bar`,
        title: '🔔 Recordatorio de Propuesta Recibida',
        message: `${bid.musicianName} te envió un recordatorio sobre su propuesta pendiente para "${event?.title || 'tu fecha'}".`,
        timestamp: 'Recién',
        read: false,
        type: 'application',
      },
      ...prev,
    ]);

    // Push notification en tiempo real al bar
    sendPushNotification({
      title: '🔔 Recordatorio de propuesta musical',
      body: `${bid.musicianName} te recuerda responder a su propuesta para "${event?.title || 'tu fecha'}".`,
      targetRole: 'bar',
    });

    return { success: true, message: `Recordatorio enviado a ${event?.venueName || 'el bar'} con éxito.` };
  };

  const retractMusicianSlotBid = (bidId: string): { success: boolean; message: string } => {
    const bid = slotBids.find((b) => b.id === bidId);
    if (!bid) return { success: false, message: 'Propuesta no encontrada.' };

    const event = eventProposals.find((e) => e.id === bid.eventId);
    if (!event) return { success: false, message: 'Evento no encontrado.' };

    // Regla estricta: Solo puede retractarse hasta 24hs antes del evento
    const eventStartTime = event.startTime || '21:00';
    const eventDateTime = new Date(`${event.date}T${eventStartTime}`).getTime();
    const now = Date.now();
    const hoursRemaining = (eventDateTime - now) / (1000 * 60 * 60);

    if (hoursRemaining < 24) {
      return {
        success: false,
        message: `No es posible retractarse: faltan ${Math.max(0, Math.floor(hoursRemaining))} hs para el inicio del show (la app solo permite retractarse con un mínimo de 24 horas de antelación).`,
      };
    }

    // Actualizar estado del bid a retractado
    setSlotBids((prev) =>
      prev.map((b) =>
        b.id === bidId
          ? {
              ...b,
              retracted: true,
              retractedAt: new Date().toISOString(),
              status: 'rechazada' as const,
              history: [
                ...b.history,
                {
                  id: `h-${Date.now()}`,
                  actor: 'musico' as const,
                  actorName: b.musicianName,
                  cachetARS: b.proposedCachetARS,
                  note: 'El músico se retractó de la propuesta (con más de 24hs de antelación al show).',
                  createdAt: new Date().toISOString(),
                },
              ],
            }
          : b
      )
    );

    // Liberar slot en eventProposals si estaba asignado o en negociación
    setEventProposals((prev) =>
      prev.map((ev) => {
        if (ev.id === bid.eventId) {
          const updatedSlots = ev.slots.map((s) =>
            s.id === bid.slotId && s.assignedMusicianId === bid.musicianId
              ? {
                  ...s,
                  assignedMusicianId: undefined,
                  assignedMusicianName: undefined,
                  agreedCachetARS: undefined,
                  status: 'libre' as const,
                }
              : s
          );
          // Si el evento estaba en 'para_publicar' y ahora le falta un músico, vuelve a 'propuesta'
          const hasUnassigned = updatedSlots.some((s) => !s.assignedMusicianId);
          const nextStatus = ev.status === 'para_publicar' && hasUnassigned ? ('propuesta' as const) : ev.status;
          return {
            ...ev,
            slots: updatedSlots,
            status: nextStatus,
          };
        }
        return ev;
      })
    );

    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}-retract`,
        title: '↩️ Propuesta Retractada',
        message: `Te retractaste con éxito de la fecha en ${event.venueName} (${event.date}). El horario quedó disponible nuevamente.`,
        timestamp: 'Recién',
        read: false,
        type: 'system',
      },
      {
        id: `notif-${Date.now()}-bar-retract`,
        title: '↩️ Un músico se retractó del horario',
        message: `${bid.musicianName} se retractó de su horario para "${event.title}" (más de 24hs de anticipación). El slot quedó libre para recibir nuevas propuestas.`,
        timestamp: 'Recién',
        read: false,
        type: 'application',
      },
      ...prev,
    ]);

    sendPushNotification({
      title: '↩️ Músico se retractó de la fecha',
      body: `${bid.musicianName} se retractó del show "${event.title}". El horario quedó libre.`,
      targetRole: 'bar',
    });

    return { success: true, message: 'Te has retractado de la propuesta exitosamente. El horario ha quedado disponible.' };
  };

  const respondToSlotBid = (
    bidId: string,
    action: 'accept' | 'reject' | 'counter',
    counterCachet?: number,
    note?: string
  ) => {
    const bid = slotBids.find((b) => b.id === bidId);
    if (!bid) return;

    const event = eventProposals.find((e) => e.id === bid.eventId);
    if (!event) return;

    let newStatus: MusicianSlotBid['status'] = bid.status;
    let newProposedCachet = bid.proposedCachetARS;

    if (action === 'accept') {
      newStatus = 'aceptada';
      setEventProposals((prev) =>
        prev.map((ev) => {
          if (ev.id === bid.eventId) {
            const updatedSlots = ev.slots.map((s) =>
              s.id === bid.slotId
                ? {
                    ...s,
                    status: 'confirmado' as const,
                    assignedMusicianId: bid.musicianId,
                    assignedMusicianName: bid.musicianName,
                    agreedCachetARS: bid.proposedCachetARS,
                  }
                : s
            );
            // Con al menos un horario cubierto/confirmado ya se habilita a 'para_publicar' (intervención manual del bar requerida)
            const hasAtLeastOneConfirmed = updatedSlots.some((s) => s.status === 'confirmado' || !!s.assignedMusicianId);
            const nextEventStatus = (ev.status === 'propuesta' && hasAtLeastOneConfirmed) ? ('para_publicar' as const) : ev.status;

            return {
              ...ev,
              slots: updatedSlots,
              status: nextEventStatus,
            };
          }
          return ev;
        })
      );

      sendPushNotification({
        title: '🎸 ¡Propuesta de Fecha Aceptada!',
        body: `${event.venueName} aceptó tu propuesta para el show "${event.title}".`,
        targetRole: 'musico',
        url: '/#acuerdos',
      });
    } else if (action === 'reject') {
      newStatus = 'rechazada';
      sendPushNotification({
        title: 'Fecha no concertada',
        body: `${event.venueName} no pudo aceptar la propuesta para "${event.title}".`,
        targetRole: 'musico',
        url: '/#acuerdos',
      });
    } else if (action === 'counter') {
      newStatus = role === 'bar' ? 'contraoferta_bar' : 'contraoferta_musico';
      if (counterCachet) newProposedCachet = counterCachet;

      sendPushNotification({
        title: '💬 Nueva Contraoferta de Caché',
        body: `${role === 'bar' ? event.venueName : bid.musicianName} propuso $${newProposedCachet.toLocaleString('es-AR')}.`,
        targetRole: role === 'bar' ? 'musico' : 'bar',
        url: '/#acuerdos',
      });
    }

    const musEmail = bid.musicianId === 'mus-1' ? 'musico1@degira.com.ar' : 'musico2@degira.com.ar';
    sendNegotiationUpdateEmailToMusician({
      musicianEmail: musEmail,
      musicianName: bid.musicianName,
      venueName: event.venueName,
      eventTitle: event.title,
      action,
      newCachetARS: newProposedCachet,
      note,
    });

    setSlotBids((prev) =>
      prev.map((b) =>
        b.id === bidId
          ? {
              ...b,
              status: newStatus,
              proposedCachetARS: newProposedCachet,
              history: [
                ...b.history,
                {
                  id: `h-${Date.now()}`,
                  actor: role === 'bar' ? ('bar' as const) : ('musico' as const),
                  actorName: role === 'bar' ? event.venueName : b.musicianName,
                  cachetARS: newProposedCachet,
                  note: note || (action === 'accept' ? 'Aceptó la propuesta.' : action === 'reject' ? 'Rechazó la propuesta.' : 'Envió una contraoferta.'),
                  createdAt: new Date().toISOString(),
                },
              ],
            }
          : b
      )
    );

    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}-neg`,
        title:
          action === 'accept'
            ? '🎉 Propuesta de Fecha Aceptada'
            : action === 'counter'
            ? '💬 Contraoferta de Caché Registrada'
            : '⚠️ Propuesta de Fecha Rechazada',
        message:
          action === 'accept'
            ? `${bid.musicianName} y ${event.venueName} confirmaron su acuerdo para "${event.title}".`
            : action === 'counter'
            ? `Se propuso un nuevo caché de $${newProposedCachet.toLocaleString('es-AR')} para "${event.title}".`
            : `La propuesta de ${bid.musicianName} para "${event.title}" fue desestimada.`,
        timestamp: 'Recién',
        read: false,
        type: action === 'accept' ? 'confirmed' : 'application',
      },
      ...prev,
    ]);
  };

  const approveAndPublishEvent = (proposalId: string) => {
    const target = eventProposals.find((e) => e.id === proposalId);
    if (!target) return;

    setEventProposals((prev) =>
      prev.map((ev) => {
        if (ev.id === proposalId) {
          // Notificar por email a los músicos acordados
          ev.slots.forEach((slot) => {
            if (slot.assignedMusicianId) {
              const musician = musicians.find((m) => m.id === slot.assignedMusicianId);
              sendEventPublishedToMusician({
                musicianEmail: `${slot.assignedMusicianId}@degira.com.ar`,
                musicianName: slot.assignedMusicianName || musician?.stageName || 'Músico',
                eventTitle: ev.title,
                venueName: ev.venueName,
                eventDate: ev.date,
                slotTime: `${slot.startTime} - ${slot.endTime}`,
                agreedCachetARS: slot.agreedCachetARS || ev.baseCachetARS,
              });
            }
          });

          return { ...ev, status: 'publicada' as const };
        }
        return ev;
      })
    );

    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}`,
        title: '🎉 Evento Aprobado y Publicado en Cartelera',
        message: `Has publicado "${target.title}" en la Cartelera de Buenos Aires. El público ya puede reservar.`,
        timestamp: 'Recién',
        read: false,
        type: 'confirmed',
      },
      ...prev,
    ]);

    sendPushNotification({
      title: '🎉 ¡Show publicado en Cartelera DeGira!',
      body: `"${target.title}" en ${target.venueName} fue aprobado y ya está disponible para reservas.`,
    });
  };

  const addNewVenue = (
    venueData: Omit<VenueProfile, 'id' | 'rating' | 'reviewCount' | 'reviews' | 'ratingBreakdown'>
  ): VenueProfile => {
    const newVenue: VenueProfile = {
      ...venueData,
      id: `venue-${Date.now()}`,
      rating: 5.0,
      reviewCount: 0,
      reviews: [],
      ratingBreakdown: {
        soundQuality: 5,
        paymentReliability: 5,
        hospitality: 5,
        respect: 5,
      },
    };

    setVenues((prev) => [...prev, newVenue]);
    setActiveVenueId(newVenue.id);

    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}`,
        title: '🏢 Nuevo Local / Sala Registrado',
        message: `Has registrado "${newVenue.name}" en ${newVenue.neighborhood} como local anfitrión disponible.`,
        timestamp: 'Recién',
        read: false,
        type: 'system',
      },
      ...prev,
    ]);

    return newVenue;
  };

  const createPublicEventReservation = (
    eventId: string,
    partySize: number,
    userName?: string,
    userEmail?: string
  ): PublicEventReservation => {
    const event = eventProposals.find((e) => e.id === eventId);
    const resolvedName = userName || userDisplayName || currentPublicUser?.name || 'Usuario Público 1';
    const resolvedEmail = userEmail || currentPublicUser?.email || 'publico1@degira.com.ar';

    const newReservation: PublicEventReservation = {
      id: `res-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      eventId,
      eventTitle: event?.title || 'Show en Vivo',
      eventCode: event?.eventCode || `DG-BAR1-${Math.floor(1000 + Math.random() * 9000)}`,
      venueId: event?.venueId || 'venue-1',
      venueName: event?.venueName || 'Bar Test 1',
      venueAddress: event?.venueAddress || 'Honduras 4800',
      venueNeighborhood: event?.venueNeighborhood || 'Palermo Soho',
      eventDate: event?.date || '2026-11-20',
      eventStartTime: event?.startTime || '21:00',
      eventEndTime: event?.endTime || '01:00',
      userId: currentPublicUser?.id || 'user-pub-1',
      userName: resolvedName,
      userEmail: resolvedEmail,
      partySize,
      totalARS: 8000 * partySize,
      expiresAt: Date.now() + 8 * 60 * 1000, // 8 minutos
      status: 'pendiente_pago',
      createdAt: new Date().toISOString(),
    };

    setPublicEventReservations((prev) => [newReservation, ...prev]);

    // Enviar email al usuario confirmando la reserva pendiente con el plazo de 8 minutos
    sendReservationCreatedEmail({
      userEmail: resolvedEmail,
      userName: resolvedName,
      eventTitle: event?.title || 'Show en Vivo',
      venueName: event?.venueName || 'Bar DeGira',
      partySize,
      totalARS: 8000 * partySize,
      eventCode: newReservation.eventCode,
    });

    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}`,
        title: '⏱️ Tenés 8 minutos para pagar',
        message: `Realizá el pago con código ${newReservation.eventCode} y subí tu comprobante en Mi Perfil & Reservas. Te enviamos los detalles por correo.`,
        timestamp: 'Recién',
        read: false,
        type: 'system',
      },
      ...prev,
    ]);

    return newReservation;
  };

  const uploadPaymentReceipt = (reservationId: string, imageDataUrl: string, ocrNotes?: string) => {
    setPublicEventReservations((prev) =>
      prev.map((res) => {
        if (res.id === reservationId) {
          const updated: PublicEventReservation = {
            ...res,
            receiptImage: imageDataUrl,
            receiptUploadTime: new Date().toISOString(),
            receiptOcrNotes: ocrNotes || 'Comprobante recibido. Aguarda confirmación del bar.',
            status: 'comprobante_subido',
          };

          // Enviar alerta al bar
          sendPaymentUploadedAlertToBar({
            barEmail: 'bar1@degira.com.ar',
            venueName: res.venueName,
            eventTitle: res.eventTitle,
            eventCode: res.eventCode,
            userName: res.userName,
            amountARS: res.totalARS,
          });

          return updated;
        }
        return res;
      })
    );

    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}`,
        title: '📄 Comprobante enviado al bar',
        message: 'El anfitrión de Bar Test 1 recibió tu comprobante y confirmará el pago en breve.',
        timestamp: 'Recién',
        read: false,
        type: 'confirmed',
      },
      ...prev,
    ]);
  };

  const confirmReservationPayment = (reservationId: string) => {
    setPublicEventReservations((prev) =>
      prev.map((res) => {
        if (res.id === reservationId) {
          const qrCode = `DeGira:Reserva:${res.eventId}:${res.eventCode}:${res.userId}:${res.partySize}p`;
          const updated: PublicEventReservation = {
            ...res,
            status: 'confirmada',
            qrTicketCode: qrCode,
            qrEmailSent: true,
          };

          // Descontar aforo de sala
          setEventProposals((events) =>
            events.map((ev) => {
              if (ev.id === res.eventId) {
                const newRemaining = Math.max(0, ev.remainingCapacity - res.partySize);
                return {
                  ...ev,
                  remainingCapacity: newRemaining,
                  status: newRemaining === 0 ? 'agotada' : ev.status,
                };
              }
              return ev;
            })
          );

          // Enviar Pase QR por email al usuario público
          sendQrTicketEmail({
            toEmail: res.userEmail,
            userName: res.userName,
            eventTitle: res.eventTitle,
            venueName: res.venueName,
            venueAddress: res.venueAddress,
            eventDate: res.eventDate,
            eventTime: res.eventStartTime,
            partySize: res.partySize,
            qrTicketCode: qrCode,
          });

          return updated;
        }
        return res;
      })
    );

    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}`,
        title: '🎟️ Pago Confirmado & Pase QR Emitido',
        message: 'El bar confirmó tu pago. Tu código QR de acceso está listo y fue enviado a tu correo.',
        timestamp: 'Recién',
        read: false,
        type: 'confirmed',
      },
      ...prev,
    ]);
  };

  const expireReservation = (reservationId: string) => {
    const target = publicEventReservations.find((r) => r.id === reservationId);

    setPublicEventReservations((prev) =>
      prev.map((res) => {
        if (res.id === reservationId && res.status === 'pendiente_pago') {
          // Devolver disponibilidad
          setEventProposals((events) =>
            events.map((ev) => {
              if (ev.id === res.eventId) {
                const restored = Math.min(ev.totalCapacity, ev.remainingCapacity + res.partySize);
                return {
                  ...ev,
                  remainingCapacity: restored,
                  status: ev.status === 'agotada' && restored > 0 ? 'publicada' : ev.status,
                };
              }
              return ev;
            })
          );

          if (res.userEmail) {
            sendReservationExpiredEmail({
              userEmail: res.userEmail,
              userName: res.userName,
              eventTitle: res.eventTitle,
              venueName: res.venueName,
              partySize: res.partySize,
            });
          }

          return { ...res, status: 'expirada' as const };
        }
        return res;
      })
    );

    if (target && target.status === 'pendiente_pago') {
      setNotifications((prev) => [
        {
          id: `notif-${Date.now()}-exp`,
          title: '⌛ Reserva Expirada por Tiempo',
          message: `Se agotaron los 8 minutos de tolerancia para abonar tu reserva en "${target.venueName}". Los lugares volvieron a la cartelera.`,
          timestamp: 'Recién',
          read: false,
          type: 'system',
        },
        ...prev,
      ]);
    }
  };

  const rejectReservationPayment = (reservationId: string, reason: string) => {
    setPublicEventReservations((prev) =>
      prev.map((res) => {
        if (res.id === reservationId) {
          // Si el bar rechaza, se devuelve cupo si correspondía
          setEventProposals((events) =>
            events.map((ev) => {
              if (ev.id === res.eventId) {
                const restored = Math.min(ev.totalCapacity, ev.remainingCapacity + res.partySize);
                return {
                  ...ev,
                  remainingCapacity: restored,
                  status: ev.status === 'agotada' && restored > 0 ? 'publicada' : ev.status,
                };
              }
              return ev;
            })
          );
          return {
            ...res,
            status: 'cancelada' as const,
            rejectionReason: reason,
          };
        }
        return res;
      })
    );

    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}`,
        title: '⚠️ Comprobante de Pago Rechazado',
        message: `El bar no aceptó el comprobante: "${reason}". El cupo fue liberado.`,
        timestamp: 'Recién',
        read: false,
        type: 'system',
      },
      ...prev,
    ]);
  };

  const checkInReservation = (
    qrCodeOrReservationId: string
  ): { success: boolean; message: string; reservation?: PublicEventReservation } => {
    const clean = qrCodeOrReservationId.trim().toUpperCase();
    const res = publicEventReservations.find(
      (r) =>
        r.id === qrCodeOrReservationId ||
        r.qrTicketCode === qrCodeOrReservationId ||
        r.eventCode.toUpperCase() === clean ||
        (r.qrTicketCode && r.qrTicketCode.toUpperCase().includes(clean)) ||
        r.id.toUpperCase().endsWith(clean)
    );

    if (!res) {
      return {
        success: false,
        message: 'Código de entrada o QR no encontrado en DeGira.',
      };
    }

    if (res.status !== 'confirmada') {
      return {
        success: false,
        message: `La reserva está en estado "${res.status}" (pago no confirmado por el bar).`,
        reservation: res,
      };
    }

    if (res.checkInStatus === 'checked_in') {
      return {
        success: false,
        message: `⚠️ ENTRADA YA UTILIZADA. Ingreso previo registrado a las ${res.checkedInAt || 'horario anterior'}.`,
        reservation: res,
      };
    }

    const checkInTime = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    const updatedRes: PublicEventReservation = {
      ...res,
      checkInStatus: 'checked_in',
      checkedInAt: checkInTime,
    };

    setPublicEventReservations((prev) =>
      prev.map((r) => (r.id === res.id ? updatedRes : r))
    );

    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}`,
        title: '🚪 Check-in en Puerta Registrado',
        message: `Ingresó ${res.userName} (${res.partySize} ${res.partySize === 1 ? 'persona' : 'personas'}) a ${res.venueName}.`,
        timestamp: 'Recién',
        read: false,
        type: 'system',
      },
      ...prev,
    ]);

    return {
      success: true,
      message: `✅ Ingreso Autorizado: ${res.userName} (${res.partySize} ${res.partySize === 1 ? 'persona' : 'personas'}). ¡Bienvenidos a ${res.venueName}!`,
      reservation: updatedRes,
    };
  };

  const joinEventWaitlist = (proposalId: string, email: string): { success: boolean; message: string } => {
    const target = eventProposals.find((e) => e.id === proposalId);
    if (!target) return { success: false, message: 'Evento no encontrado' };

    setEventProposals((prev) =>
      prev.map((ev) => {
        if (ev.id === proposalId) {
          const list = ev.waitlist || [];
          if (!list.includes(email)) {
            return { ...ev, waitlist: [...list, email] };
          }
        }
        return ev;
      })
    );

    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}`,
        title: '🎟️ Anotado en Lista de Espera',
        message: `Te anotaste para "${target.title}". Te avisaremos si se libera un cupo por expiración.`,
        timestamp: 'Recién',
        read: false,
        type: 'system',
      },
      ...prev,
    ]);

    return { success: true, message: '¡Te anotaste con éxito en la lista de espera!' };
  };

  const addSpectatorBenefit = (benefit: SpectatorBenefit) => {
    setSpectatorBenefits((prev) => [benefit, ...prev]);
  };

  const submitReview360 = (reviewData: Omit<EventReview360, 'id' | 'createdAt'>) => {
    const newRev: EventReview360 = {
      ...reviewData,
      id: `rev360-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setReviews360((prev) => [newRev, ...prev]);

    // Recompensa para espectadores que califican
    if (reviewData.fromRole === 'espectador') {
      const reward: SpectatorBenefit = {
        badge: 'Espectador Frecuente Porteño',
        promoCode: `DEGIRA-NOCHE-${Math.floor(100 + Math.random() * 900)}`,
        discountPercent: 15,
        earnedAt: new Date().toLocaleDateString('es-AR'),
      };
      setSpectatorBenefits((prev) => [reward, ...prev]);
    }

    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}`,
        title: '⭐ Calificación 360° registrada',
        message: `Gracias por calificar a "${reviewData.toName}". ${reviewData.fromRole === 'espectador' ? '¡Desbloqueaste un cupón de 15% de descuento!' : ''}`,
        timestamp: 'Recién',
        read: false,
        type: 'review',
      },
      ...prev,
    ]);
  };

  const resetAllData = () => {
    localStorage.clear();
    setRole('espectador');
    setActiveMusicianId('mus-1');
    setActiveVenueId('venue-1');
    setActivePublicUserId('user-pub-1');
    setVenues(INITIAL_VENUES);
    setMusicians(INITIAL_MUSICIANS);
    setPublicUsers(INITIAL_PUBLIC_USERS);
    setOpenCalls(INITIAL_OPEN_CALLS);
    setMusicianAvailabilities(INITIAL_MUSICIAN_AVAILABILITIES);
    setLiveShows(INITIAL_LIVE_SHOWS);
    setReservations(INITIAL_SPECTATOR_RESERVATIONS);
    setEventProposals(INITIAL_EVENT_PROPOSALS);
    setSlotBids(INITIAL_SLOT_BIDS);
    setPublicEventReservations(INITIAL_EVENT_RESERVATIONS);
    setReviews360(INITIAL_REVIEWS_360);
    setStoredUserName('');
    setNotifications([
      {
        id: 'notif-1',
        title: '¡Nueva postulación recibida!',
        message: 'Músico Test 1 se postuló para tu fecha del 20 de Noviembre en Bar Test 1.',
        timestamp: 'Hace 2 horas',
        read: false,
        type: 'application',
      },
    ]);
  };

  const loginAsAccount = (account: TestAccount) => {
    setRole(account.role);
    setUserDisplayName(account.displayName);
    if (account.role === 'bar') {
      setActiveVenueId(account.entityId);
    } else if (account.role === 'musico') {
      setActiveMusicianId(account.entityId);
    } else {
      setActivePublicUserId(account.entityId);
    }
    saveActiveSession({
      role: account.role,
      userName: account.displayName,
      userEmail: account.email,
      remember24h: true,
    });
    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}`,
        title: `¡Bienvenido, ${account.displayName}!`,
        message: `Sesión iniciada con la cuenta de prueba (${account.email}).`,
        timestamp: 'Recién',
        read: false,
        type: 'confirmed',
      },
      ...prev,
    ]);
  };

  const cancelPublicEventReservation = (reservationId: string) => {
    setPublicEventReservations((prev) =>
      prev.map((res) => {
        if (res.id === reservationId) {
          // Devolver cupo al evento
          setEventProposals((events) =>
            events.map((ev) => {
              if (ev.id === res.eventId) {
                const restored = Math.min(ev.totalCapacity, ev.remainingCapacity + res.partySize);
                return {
                  ...ev,
                  remainingCapacity: restored,
                  status: ev.status === 'agotada' && restored > 0 ? ('publicada' as const) : ev.status,
                };
              }
              return ev;
            })
          );
          return { ...res, status: 'cancelada' as const };
        }
        return res;
      })
    );

    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}`,
        title: '❌ Reserva Cancelada',
        message: 'Has cancelado tu reserva de mesa. El cupo ha quedado libre para otros espectadores.',
        timestamp: 'Recién',
        read: false,
        type: 'system',
      },
      ...prev,
    ]);
  };

  const updatePublicUserProfile = (updates: Partial<PublicUserProfile>) => {
    setPublicUsers((prev) =>
      prev.map((u) => {
        if (u.id === activePublicUserId) {
          const updated = { ...u, ...updates };
          if (updates.name) setUserDisplayName(updates.name);
          return updated;
        }
        return u;
      })
    );

    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}`,
        title: '👤 Datos de Perfil Guardados',
        message: 'Tus datos de contacto y preferencias fueron actualizados correctamente.',
        timestamp: 'Recién',
        read: false,
        type: 'system',
      },
      ...prev,
    ]);
  };

  const triggerOneHourPostEventFeedback = (eventId: string) => {
    const ev = eventProposals.find((e) => e.id === eventId);
    if (!ev) return;

    setEventProposals((prev) =>
      prev.map((item) => (item.id === eventId ? { ...item, feedbackSentAt: new Date().toISOString() } : item))
    );

    const reviewRef = `#review360-${eventId}`;

    // Disparar email a asistentes confirmados
    const confirmedAttendees = publicEventReservations.filter((r) => r.eventId === eventId && r.status === 'confirmada');
    confirmedAttendees.forEach((att) => {
      sendReviewReminderEmail({
        toEmail: att.userEmail,
        userName: att.userName,
        eventTitle: ev.title,
        role: 'espectador',
      });
    });

    // Disparar email al Bar anfitrión
    const venueEmail = ev.venueId === 'venue-2' ? 'bar2@degira.com.ar' : 'bar1@degira.com.ar';
    sendReviewReminderEmail({
      toEmail: venueEmail,
      userName: ev.venueName,
      eventTitle: ev.title,
      role: 'bar',
    });

    // Disparar email a los Músicos que tocaron en el evento
    ev.slots.forEach((s) => {
      if (s.assignedMusicianId && s.assignedMusicianName) {
        const musicianEmail = s.assignedMusicianId === 'mus-2' ? 'musico2@degira.com.ar' : 'musico1@degira.com.ar';
        sendReviewReminderEmail({
          toEmail: musicianEmail,
          userName: s.assignedMusicianName,
          eventTitle: ev.title,
          role: 'musico',
        });
      }
    });

    // Notificaciones en el perfil de cada panel
    setNotifications((prev) => [
      {
        id: `notif-fb-${Date.now()}-pub`,
        title: `⭐ ¿Cómo estuvo la noche en ${ev.venueName}?`,
        message: `Ha pasado 1 hora desde que finalizó "${ev.title}". Calificá al bar y a los músicos (${reviewRef}).`,
        timestamp: 'Recién',
        read: false,
        type: 'review',
      },
      {
        id: `notif-fb-${Date.now()}-bar`,
        title: '⭐ Calificá la actuación de los músicos',
        message: `El show "${ev.title}" terminó hace 1 hora. Evaluá el cumplimiento técnico y feedback del recital.`,
        timestamp: 'Recién',
        read: false,
        type: 'review',
      },
      {
        id: `notif-fb-${Date.now()}-mus`,
        title: `⭐ Calificá la sala y hospitalidad en ${ev.venueName}`,
        message: `¿Cómo te trató el anfitrión en "${ev.title}"? Dejá tu reseña bilateral para la comunidad.`,
        timestamp: 'Recién',
        read: false,
        type: 'review',
      },
      ...prev,
    ]);

    sendPushNotification({
      title: `⭐ Calificá tu experiencia en ${ev.venueName}`,
      body: `El show finalizó hace 1 hora. Entrá para calificar al local y a los músicos con tu reseña 360°.`,
      url: reviewRef,
    });
  };

  // Chequeo periódico de feedback 1h post-evento
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      eventProposals.forEach((ev) => {
        if (ev.status === 'publicada' && !ev.feedbackSentAt) {
          const endDateTime = new Date(`${ev.date}T${ev.endTime || '01:00'}`).getTime();
          if (now >= endDateTime + 3600 * 1000) {
            triggerOneHourPostEventFeedback(ev.id);
          }
        }
      });
    }, 30000);
    return () => clearInterval(interval);
  }, [eventProposals]);

  const logout = () => {
    clearActiveSession();
    setStoredUserName('');
    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}`,
        title: 'Sesión cerrada',
        message: 'Has cerrado sesión exitosamente. Podés ingresar con otra cuenta o perfil cuando quieras.',
        timestamp: 'Recién',
        read: false,
        type: 'confirmed',
      },
      ...prev,
    ]);
  };

  return (
    <AppContext.Provider
      value={{
        role,
        setRole,
        activeMusicianId,
        setActiveMusicianId,
        activeVenueId,
        setActiveVenueId,
        activePublicUserId,
        setActivePublicUserId,
        venues,
        musicians,
        publicUsers,
        openCalls,
        musicianAvailabilities,
        liveShows,
        notifications,
        reservations,
        eventProposals,
        slotBids,
        publicEventReservations,
        reviews360,
        spectatorBenefits,
        addSpectatorBenefit,
        currentMusician,
        currentVenue,
        currentPublicUser,
        userDisplayName,
        setUserDisplayName,
        publishOpenCall,
        applyToOpenCall,
        acceptApplication,
        rejectApplication,
        publishAvailability,
        sendDirectOffer,
        acceptDirectOffer,
        rejectDirectOffer,
        submitReview,
        markNotificationsAsRead,
        markSingleNotificationAsRead,
        resetAllData,
        createReservation,
        payReservation,
        cancelReservation,
        createEventProposal,
        updateEventProposal,
        publishEventProposal,
        approveAndPublishEvent,
        addNewVenue,
        saveVenueRiderTemplate,
        liquidateMusicianCachet,
        submitSlotBid,
        updateMusicianMusicLinks,
        sendMusicianProposalReminder,
        retractMusicianSlotBid,
        respondToSlotBid,
        createPublicEventReservation,
        cancelPublicEventReservation,
        updatePublicUserProfile,
        uploadPaymentReceipt,
        confirmReservationPayment,
        rejectReservationPayment,
        expireReservation,
        checkInReservation,
        joinEventWaitlist,
        triggerOneHourPostEventFeedback,
        submitReview360,
        loginAsAccount,
        logout,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
