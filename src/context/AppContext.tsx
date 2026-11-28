import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
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
  EventSlot,
  EventRider,
  MusicianSlotBid,
  PublicEventReservation,
  ReservationStatus,
  EventReview360,
  MusicianMusicLinks,
  MusicianInputChannel,
  SpectatorBenefit,
  CachetMode,
} from '../types/index.ts';
import { calculateNewRating, calculateNewBreakdown, formatCachet, offsetIsoDate } from '../utils/bookingLogic.ts';
import {
  applyPaymentConfirmationToEvent,
  restoreCapacityOnReservationRelease,
} from '../utils/capacityLogic.ts';
import {
  REVIEW_UNLOCK_DELAY_MS,
  getEventEndTimestampMs,
} from '../utils/reviewEligibility.ts';
import {
  canSubmitBidForSlot,
  isActiveSlotBid,
  isEventArchived,
  archivePastEvents,
  applyBidSubmissionTransition,
  applyBidResponseTransition,
  applyBidRetractionTransition,
  applyPublishEventTransition,
  applyCancelEventTransition,
  makeUniqueId,
} from '../utils/slotBidding.ts';
import { supabase } from '../lib/supabaseClient.ts';
import { mapVenue, mapMusician, mapOpenCall, mapAvailability, mapLiveShow } from '../lib/supabaseMappers.ts';
import {
  auth,
  testFirestoreConnection,
  connectWithGoogle,
  disconnectFromGoogle,
} from '../lib/firebase.ts';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  subscribeToCloudState,
  mergeByIdWithCloudPriority,
  pushLocalCustomItemsToCloud,
  syncVenueCreate,
  syncVenueRiderUpdate,
  syncEventProposalCreate,
  syncEventProposalSlotsAndStatus,
  syncEventProposalBarUpdate,
  syncEventCapacityOrWaitlist,
  syncSlotBidCreate,
  syncSlotBidMusicianUpdate,
  syncSlotBidBarResponse,
  syncReservationCreate,
  syncReservationSpectatorUpdate,
  syncReservationBarUpdate,
  syncReview360Create,
} from '../services/firestoreSync.ts';
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
import { mergeSlotBidsMonotonic, mergeEventProposalsMonotonic } from '../utils/cloudMerge.ts';
import {
  resolveVenueEmail,
  resolveMusicianEmail,
  resolvePublicUserEmail,
  resolveActiveProfileIdentity,
  isNotificationVisibleToProfile,
} from '../utils/notificationScoping.ts';
import {
  getVenuesOwnedByBar,
  normalizeCloudVenue,
  normalizeCloudEventProposal,
  resolveBarOwnerId,
} from '../utils/venueOwnership.ts';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: 'application' | 'offer' | 'confirmed' | 'review' | 'system';
  targetRole?: UserRole;
  targetEntityId?: string;
  targetEmail?: string;
}

interface AppContextType {
  role: UserRole;
  setRole: (role: UserRole) => void;
  activeMusicianId: string;
  setActiveMusicianId: (id: string) => void;
  activeVenueId: string;
  setActiveVenueId: (id: string) => void;
  activeBarAccountId: string;
  activePublicUserId: string;
  setActivePublicUserId: (id: string) => void;

  venues: VenueProfile[];
  ownedVenues: VenueProfile[];
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
  cancelEventProposal: (eventId: string, reason?: string) => { ok: boolean; message?: string };
  addNewVenue: (venueData: Omit<VenueProfile, 'id' | 'rating' | 'reviewCount' | 'reviews' | 'ratingBreakdown'>) => VenueProfile;
  saveVenueRiderTemplate: (venueId: string, template: EventRider) => void;
  liquidateMusicianCachet: (proposalId: string) => void;
  submitSlotBid: (data: {
    eventId: string;
    slotId: string;
    proposedCachetARS: number;
    cachetType?: CachetMode;
    musiciansCount: number;
    equipmentProvided: string;
    equipmentNeeded: string;
    musicLinks?: MusicianMusicLinks;
    inputList?: MusicianInputChannel[];
    initialNote?: string;
  }) => { ok: boolean; message?: string };
  updateMusicianMusicLinks: (musicianId: string, links: MusicianMusicLinks, inputList?: MusicianInputChannel[]) => void;
  sendMusicianProposalReminder: (bidId: string) => { success: boolean; message: string };
  retractMusicianSlotBid: (bidId: string) => { success: boolean; message: string };
  respondToSlotBid: (
    bidId: string,
    action: 'accept' | 'reject' | 'counter',
    counterCachet?: number,
    note?: string,
    options?: { cachetType?: CachetMode; musiciansCount?: number }
  ) => { ok: boolean; message?: string };
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

  // Session & Authentication & Cloud Sync
  loginTriggerCount: number;
  markUserLoggedIn: () => void;
  loginAsAccount: (account: TestAccount) => void;
  logout: () => void;
  firebaseUser: User | null;
  cloudSyncStatus: 'local_only' | 'syncing' | 'connected' | 'error';
  cloudSyncError: string | null;
  connectCloudWithGoogle: () => Promise<boolean>;
  disconnectCloud: () => Promise<void>;
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

  const [activeBarAccountId, setActiveBarAccountId] = useState<string>(() => {
    const savedOwner = localStorage.getItem(`${STORAGE_KEY_PREFIX}activeBarAccountId`);
    if (savedOwner) return savedOwner;
    const savedVenue = localStorage.getItem(`${STORAGE_KEY_PREFIX}activeVenueId`);
    return savedVenue === 'venue-2' ? 'venue-2' : 'venue-1';
  });

  const [activePublicUserId, setActivePublicUserId] = useState<string>(() => {
    return localStorage.getItem(`${STORAGE_KEY_PREFIX}activePublicUserId`) || 'user-pub-1';
  });

  const hasLegacyString = (str: string) =>
    str.includes('Thelonious') || str.includes('Julieta') || str.includes('Café Berlín');

  const [venues, setVenues] = useState<VenueProfile[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}venues`);
    if (saved && !hasLegacyString(saved)) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
    return INITIAL_VENUES;
  });

  const [musicians, setMusicians] = useState<MusicianProfile[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}musicians`);
    if (saved && !hasLegacyString(saved)) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
    return INITIAL_MUSICIANS;
  });

  const [publicUsers, setPublicUsers] = useState<PublicUserProfile[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}publicUsers`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
    return INITIAL_PUBLIC_USERS;
  });

  const [openCalls, setOpenCalls] = useState<VenueOpenCall[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}openCalls`);
    if (saved && !hasLegacyString(saved)) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
    }
    return INITIAL_OPEN_CALLS;
  });

  const [musicianAvailabilities, setMusicianAvailabilities] = useState<MusicianAvailability[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}availabilities`);
    if (saved && !hasLegacyString(saved)) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
    }
    return INITIAL_MUSICIAN_AVAILABILITIES;
  });

  const [liveShows, setLiveShows] = useState<LiveShowConfirmed[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}liveShows`);
    if (saved && !hasLegacyString(saved)) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
    }
    return INITIAL_LIVE_SHOWS;
  });

  const [reservations, setReservations] = useState<SpectatorReservation[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}reservations`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
    }
    return INITIAL_SPECTATOR_RESERVATIONS;
  });

  const [storedUserName, setStoredUserName] = useState<string>(() => {
    return localStorage.getItem('suenaba:logged_user_name') || '';
  });
  const [loginTriggerCount, setLoginTriggerCount] = useState<number>(0);

  const markUserLoggedIn = () => {
    setLoginTriggerCount((c) => c + 1);
  };

  // Entidades principales de la nueva arquitectura DeGira
  const [eventProposals, setEventProposals] = useState<EventProposal[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}eventProposals`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const normalized = parsed.map((ev: EventProposal) => normalizeCloudEventProposal(ev));
          return archivePastEvents(normalized).events;
        }
      } catch {}
    }
    return archivePastEvents(INITIAL_EVENT_PROPOSALS).events;
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
        earnedAt: offsetIsoDate(-10),
      },
    ];
  });

  const [notifications, setNotifications] = useState<NotificationItem[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}notifications`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
    }
    return [
      {
        id: 'notif-1',
        title: '¡Nueva postulación recibida!',
        message: 'Músico Test 1 se postuló para tu próxima fecha en Bar Test 1.',
        timestamp: 'Hace 2 horas',
        read: false,
        type: 'application',
        targetRole: 'bar',
        targetEntityId: 'venue-1',
      },
      {
        id: 'notif-2',
        title: '¡Propuesta directa de fecha!',
        message: 'Bar Test 1 te envió una oferta para tocar próximamente.',
        timestamp: 'Hace 4 horas',
        read: false,
        type: 'offer',
        targetRole: 'musico',
        targetEntityId: 'mus-1',
      },
    ];
  });

  const [firebaseUser, setFirebaseUser] = useState<User | null>(() => auth.currentUser);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<'local_only' | 'syncing' | 'connected' | 'error'>('local_only');
  const [cloudSyncError, setCloudSyncError] = useState<string | null>(null);

  const venuesRef = useRef<VenueProfile[]>(venues);
  const eventProposalsRef = useRef<EventProposal[]>(eventProposals);
  const slotBidsRef = useRef<MusicianSlotBid[]>(slotBids);
  const publicEventReservationsRef = useRef<PublicEventReservation[]>(publicEventReservations);
  const reviews360Ref = useRef<EventReview360[]>(reviews360);

  // Sync to localStorage & refs
  useEffect(() => {
    venuesRef.current = venues;
  }, [venues]);

  useEffect(() => {
    eventProposalsRef.current = eventProposals;
    localStorage.setItem(`${STORAGE_KEY_PREFIX}eventProposals`, JSON.stringify(eventProposals));
  }, [eventProposals]);

  useEffect(() => {
    slotBidsRef.current = slotBids;
    localStorage.setItem(`${STORAGE_KEY_PREFIX}slotBids`, JSON.stringify(slotBids));
  }, [slotBids]);

  useEffect(() => {
    publicEventReservationsRef.current = publicEventReservations;
    localStorage.setItem(`${STORAGE_KEY_PREFIX}publicEventReservations`, JSON.stringify(publicEventReservations));
  }, [publicEventReservations]);

  useEffect(() => {
    reviews360Ref.current = reviews360;
    localStorage.setItem(`${STORAGE_KEY_PREFIX}reviews360`, JSON.stringify(reviews360));
  }, [reviews360]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}spectatorBenefits`, JSON.stringify(spectatorBenefits));
  }, [spectatorBenefits]);

  // Firestore startup connectivity check & Auth subscription
  useEffect(() => {
    testFirestoreConnection().catch(() => {});

    let unsubCloud: (() => void) | null = null;
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (unsubCloud) {
        unsubCloud();
        unsubCloud = null;
      }

      if (!user) {
        setFirebaseUser(null);
        setCloudSyncStatus('local_only');
        return;
      }

      setFirebaseUser(user);
      setCloudSyncStatus('syncing');
      setCloudSyncError(null);

      pushLocalCustomItemsToCloud({
        uid: user.uid,
        venues: venuesRef.current,
        eventProposals: eventProposalsRef.current,
        slotBids: slotBidsRef.current,
        reviews360: reviews360Ref.current,
      })
        .catch((err) => {
          console.error('Error subiendo borradores locales a la nube:', err);
        })
        .finally(() => {
          try {
            unsubCloud = subscribeToCloudState({
              uid: user.uid,
              onVenues: (cloudVenues) => {
                const normalizedCloud = cloudVenues.map(normalizeCloudVenue);
                setVenues((prev) => mergeByIdWithCloudPriority(prev, normalizedCloud));
              },
              onEventProposals: (cloudEvents) => {
                const normalizedCloud = cloudEvents.map(normalizeCloudEventProposal);
                const merged = mergeEventProposalsMonotonic(
                  eventProposalsRef.current,
                  normalizedCloud,
                  slotBidsRef.current
                );
                const { events: nextEvents, archivedEvents } = archivePastEvents(merged);
                eventProposalsRef.current = nextEvents;
                setEventProposals(nextEvents);
                if (archivedEvents.length > 0) {
                  archivedEvents.forEach((archivedEv) => {
                    syncEventProposalBarUpdate(
                      archivedEv.id,
                      {
                        status: 'archivado',
                        lastActionAt: archivedEv.lastActionAt,
                        lastActionActor: archivedEv.lastActionActor,
                        lastActionSummary: archivedEv.lastActionSummary,
                      },
                      archivedEv,
                      user.uid
                    ).catch(() => {});
                  });
                }
                setCloudSyncStatus('connected');
              },
              onSlotBids: (cloudBids) => {
                const nextBids = mergeSlotBidsMonotonic(slotBidsRef.current, cloudBids);
                slotBidsRef.current = nextBids;
                setSlotBids(nextBids);
                const reconciledEvents = mergeEventProposalsMonotonic(
                  eventProposalsRef.current,
                  eventProposalsRef.current,
                  nextBids
                );
                const { events: nextEvents } = archivePastEvents(reconciledEvents);
                eventProposalsRef.current = nextEvents;
                setEventProposals(nextEvents);
              },
              onReservations: (cloudRes) => {
                setPublicEventReservations((prev) => mergeByIdWithCloudPriority(prev, cloudRes));
              },
              onReviews360: (cloudRevs) => {
                setReviews360((prev) => mergeByIdWithCloudPriority(prev, cloudRevs));
              },
            });
            setCloudSyncStatus('connected');
          } catch (err) {
            setCloudSyncStatus('error');
            setCloudSyncError(err instanceof Error ? err.message : 'Error de sincronización');
          }
        });
    });

    return () => {
      unsubAuth();
      if (unsubCloud) unsubCloud();
    };
  }, []);

  const connectCloudWithGoogle = async (): Promise<boolean> => {
    try {
      setCloudSyncError(null);
      setCloudSyncStatus('syncing');
      await connectWithGoogle();
      return true;
    } catch (err: any) {
      setCloudSyncStatus(firebaseUser ? 'connected' : 'local_only');
      const code = typeof err?.code === 'string' ? err.code : '';
      let friendly = 'No se pudo completar el acceso con Google.';
      if (code === 'auth/unauthorized-domain') {
        const host = typeof window !== 'undefined' ? window.location.hostname : 'este dominio';
        friendly = `El dominio "${host}" no está autorizado en Firebase Authentication (Authorized domains).`;
      } else if (code === 'auth/popup-blocked') {
        friendly = 'El navegador bloqueó la ventana emergente de Google. Permití popups e intentá de nuevo.';
      } else if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        friendly = 'Cerraste el inicio de sesión con Google antes de completarlo.';
      } else if (code === 'auth/network-request-failed') {
        friendly = 'Sin conexión a internet para conectar con la nube.';
      } else if (err instanceof Error && err.message) {
        friendly = err.message;
      }
      setCloudSyncError(friendly);
      return false;
    }
  };

  const disconnectCloud = async (): Promise<void> => {
    try {
      await disconnectFromGoogle();
      setCloudSyncStatus('local_only');
    } catch (err) {
      console.error('Error al desconectar Google:', err);
    }
  };

  // Cronómetro de expiración de reservas (8 minutos exactos)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setPublicEventReservations((prev) => {
        let hasChanges = false;
        const updated = prev.map((res) => {
          if (res.status === 'pendiente_pago' && now > res.expiresAt) {
            hasChanges = true;
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
    localStorage.setItem(`${STORAGE_KEY_PREFIX}activeBarAccountId`, activeBarAccountId);
  }, [activeBarAccountId]);

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

  // Synchronize with Supabase Cloud Database (keeping strictly test entities, never legacy names)
  useEffect(() => {
    async function syncWithSupabase() {
      if (!supabase) return;
      try {
        const mergeById = <T extends { id: string }>(base: T[], incoming: T[]): T[] => {
          const map = new Map<string, T>();
          base.forEach((item) => map.set(item.id, item));
          incoming.forEach((item) => map.set(item.id, item));
          return Array.from(map.values());
        };

        const { data: vData } = await supabase.from('venues').select('*');
        if (vData && vData.length > 0) {
          const testVenues = vData.map(mapVenue).filter((v) => v.name.includes('Test'));
          if (testVenues.length > 0) setVenues((prev) => mergeById(INITIAL_VENUES, mergeById(prev, testVenues)));
        }

        const { data: mData } = await supabase.from('musicians').select('*');
        if (mData && mData.length > 0) {
          const testMusicians = mData.map(mapMusician).filter((m) => m.stageName.includes('Test'));
          if (testMusicians.length > 0) setMusicians((prev) => mergeById(INITIAL_MUSICIANS, mergeById(prev, testMusicians)));
        }

        const { data: cData } = await supabase.from('open_calls').select('*');
        if (cData && cData.length > 0) {
          const testCalls = cData.map(mapOpenCall).filter((c) => c.venueName.includes('Test'));
          if (testCalls.length > 0) setOpenCalls((prev) => mergeById(INITIAL_OPEN_CALLS, mergeById(prev, testCalls)));
        }

        const { data: aData } = await supabase.from('musician_availabilities').select('*');
        if (aData && aData.length > 0) {
          const testAvails = aData.map(mapAvailability).filter((a) => a.musicianName.includes('Test'));
          if (testAvails.length > 0) setMusicianAvailabilities((prev) => mergeById(INITIAL_MUSICIAN_AVAILABILITIES, mergeById(prev, testAvails)));
        }

        const { data: sData } = await supabase.from('live_shows').select('*');
        if (sData && sData.length > 0) {
          const testShows = sData.map(mapLiveShow).filter((s) => s.venueName.includes('Test'));
          if (testShows.length > 0) setLiveShows((prev) => mergeById(INITIAL_LIVE_SHOWS, mergeById(prev, testShows)));
        }
      } catch {
        // Fallback to initial seed if offline or tables not yet migrated
      }
    }
    syncWithSupabase();
  }, []);

  const resolvedBarOwnerId = resolveBarOwnerId({
    activeBarAccountId,
    activeVenueId,
    venues,
  });
  const ownedVenues = getVenuesOwnedByBar({
    venues,
    barOwnerId: resolvedBarOwnerId,
  });

  const currentMusician = musicians.find((m) => m.id === activeMusicianId) || musicians[0];
  const currentVenue =
    ownedVenues.find((v) => v.id === activeVenueId) ||
    ownedVenues[0] ||
    venues.find((v) => v.id === activeVenueId) ||
    venues[0];
  const currentPublicUser = publicUsers.find((u) => u.id === activePublicUserId) || publicUsers[0];

  const selectActiveVenueId = (id: string) => {
    setActiveVenueId(id);
    const targetVenue = venues.find((v) => v.id === id);
    const targetOwner =
      targetVenue?.ownerBarId || (id === 'venue-2' ? 'venue-2' : id === 'venue-1' ? 'venue-1' : undefined);
    if (targetOwner && targetOwner !== activeBarAccountId) {
      setActiveBarAccountId(targetOwner);
    }
  };

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
        targetRole: 'bar',
        targetEntityId: callData.venueId || currentVenue?.id,
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
        targetRole: 'musico',
        targetEntityId: applicationData.musicianId || currentMusician?.id,
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
            id: makeUniqueId('notif-bar'),
            title: '🎉 ¡Acuerdo Confirmado & Show Publicado!',
            message: `La fecha del ${targetCall?.date} en ${venue.name} con ${musician.stageName} ya está en la cartelera de Buenos Aires.`,
            timestamp: 'Recién',
            read: false,
            type: 'confirmed',
            targetRole: 'bar',
            targetEntityId: venue.id,
          },
          {
            id: makeUniqueId('notif-mus'),
            title: '🎉 ¡Acuerdo Confirmado & Show Publicado!',
            message: `Confirmaste fecha para el ${targetCall?.date} en ${venue.name}.`,
            timestamp: 'Recién',
            read: false,
            type: 'confirmed',
            targetRole: 'musico',
            targetEntityId: musician.id,
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
        targetRole: 'musico',
        targetEntityId: availData.musicianId || currentMusician?.id,
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

    let targetMusicianId: string | undefined;
    setMusicianAvailabilities((prev) =>
      prev.map((item) => {
        if (item.id === availabilityId) {
          targetMusicianId = item.musicianId;
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
        id: makeUniqueId('notif-bar'),
        title: '¡Oferta enviada al músico!',
        message: `Enviaste una propuesta de ${offerData.venueName} para la fecha indicada.`,
        timestamp: 'Recién',
        read: false,
        type: 'offer',
        targetRole: 'bar',
        targetEntityId: offerData.venueId || currentVenue?.id,
      },
      ...(targetMusicianId
        ? [
            {
              id: makeUniqueId('notif-mus'),
              title: '¡Propuesta directa recibida!',
              message: `${offerData.venueName} te envió una oferta directa para tocar el ${offerData.date}.`,
              timestamp: 'Recién',
              read: false,
              type: 'offer' as const,
              targetRole: 'musico' as const,
              targetEntityId: targetMusicianId,
            },
          ]
        : []),
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
            id: makeUniqueId('notif-mus'),
            title: '🎉 ¡Oferta Aceptada!',
            message: `Acordaste fecha para el ${acceptedOffer?.date} en ${venue.name}. Se sumó a la cartelera.`,
            timestamp: 'Recién',
            read: false,
            type: 'confirmed',
            targetRole: 'musico',
            targetEntityId: musician.id,
          },
          {
            id: makeUniqueId('notif-bar'),
            title: '🎉 ¡Oferta Aceptada!',
            message: `${musician.stageName} aceptó tocar el ${acceptedOffer?.date} en ${venue.name}.`,
            timestamp: 'Recién',
            read: false,
            type: 'confirmed',
            targetRole: 'bar',
            targetEntityId: venue.id,
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
        targetRole: reviewData.authorType === 'musician' ? 'musico' : 'bar',
        targetEntityId: reviewData.authorType === 'musician' ? currentMusician?.id : currentVenue?.id,
      },
      ...prev,
    ]);
  };

  const activeProfileIdentity = resolveActiveProfileIdentity({
    role,
    currentVenue,
    currentMusician,
    currentPublicUser,
    venues,
    publicUsers,
  });

  const scopedNotifications = notifications.filter((n) =>
    isNotificationVisibleToProfile(n, activeProfileIdentity)
  );

  const markNotificationsAsRead = () => {
    setNotifications((prev) =>
      prev.map((n) =>
        isNotificationVisibleToProfile(n, activeProfileIdentity) ? { ...n, read: true } : n
      )
    );
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
        targetRole: 'espectador',
        targetEntityId: activePublicUserId,
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
        targetRole: 'espectador',
        targetEntityId: activePublicUserId,
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
    const barTag = data.venueId === 'venue-2' ? 'BAR2' : data.venueId === 'venue-1' ? 'BAR1' : 'BAR';
    const nowIso = new Date().toISOString();
    const newProposal: EventProposal = {
      ...data,
      id: makeUniqueId('ev'),
      eventCode: `DG-${barTag}-${codeNumber}`,
      remainingCapacity: data.totalCapacity,
      status: data.status || 'propuesta',
      createdAt: nowIso,
      lastActionAt: nowIso,
      lastActionActor: data.venueName,
      lastActionSummary: 'Convocatoria abierta para músicos',
    };
    const nextEvents = [newProposal, ...eventProposalsRef.current];
    eventProposalsRef.current = nextEvents;
    setEventProposals(nextEvents);

    if (firebaseUser) {
      syncEventProposalCreate(newProposal, firebaseUser.uid).catch(() => setCloudSyncStatus('error'));
    }

    setNotifications((prev) => [
      {
        id: makeUniqueId('notif'),
        title: '📋 Propuesta de Evento creada',
        message: `Has creado la propuesta "${newProposal.title}" con código ${newProposal.eventCode}.`,
        timestamp: 'Recién',
        read: false,
        type: 'system',
        targetRole: 'bar',
        targetEntityId: newProposal.venueId,
      },
      ...prev,
    ]);
    return newProposal;
  };

  const updateEventProposal = (id: string, updates: Partial<EventProposal>) => {
    if (role !== 'bar') return;
    const target = eventProposalsRef.current.find((ev) => ev.id === id);
    if (!target) return;
    if (currentVenue && target.venueId !== currentVenue.id) return;

    const updateKeys = Object.keys(updates) as (keyof EventProposal)[];
    const allowedPostShowKeys = new Set<keyof EventProposal>(['cachetPaid', 'cachetPaidAt', 'feedbackSentAt']);
    const isStrictlyPostShowUpdate =
      updateKeys.length > 0 && updateKeys.every((k) => allowedPostShowKeys.has(k));
    if ((isEventArchived(target) || target.status === 'cancelada') && !isStrictlyPostShowUpdate) {
      return;
    }

    const nowIso = new Date().toISOString();
    const actorName = currentVenue?.name || target.venueName;
    const derivedSummary =
      updates.lastActionSummary ||
      (updates.status === 'para_publicar'
        ? 'Marcada como lista para publicar'
        : updates.status === 'propuesta'
        ? 'Pausada / devuelta a propuesta'
        : updates.cachetPaid
        ? 'Cachet liquidado a los músicos'
        : updates.feedbackSentAt
        ? 'Recordatorio post-show de calificación enviado'
        : 'Actualización del evento');

    const auditedUpdates: Partial<EventProposal> = {
      ...updates,
      lastActionAt: updates.lastActionAt || nowIso,
      lastActionActor: updates.lastActionActor || actorName,
      lastActionSummary: derivedSummary,
    };

    const nextEvents = eventProposalsRef.current.map((ev) =>
      ev.id === id ? { ...ev, ...auditedUpdates } : ev
    );
    eventProposalsRef.current = nextEvents;
    setEventProposals(nextEvents);
    if (firebaseUser && target) {
      syncEventProposalBarUpdate(
        id,
        {
          ...(auditedUpdates.slots ? { slots: auditedUpdates.slots } : {}),
          ...(auditedUpdates.status ? { status: auditedUpdates.status } : {}),
          ...(auditedUpdates.remainingCapacity !== undefined ? { remainingCapacity: auditedUpdates.remainingCapacity } : {}),
          ...(auditedUpdates.cachetPaid !== undefined ? { cachetPaid: auditedUpdates.cachetPaid } : {}),
          ...(auditedUpdates.cachetPaidAt !== undefined ? { cachetPaidAt: auditedUpdates.cachetPaidAt } : {}),
          ...(auditedUpdates.feedbackSentAt !== undefined ? { feedbackSentAt: auditedUpdates.feedbackSentAt } : {}),
          ...(auditedUpdates.lastActionAt ? { lastActionAt: auditedUpdates.lastActionAt } : {}),
          ...(auditedUpdates.lastActionActor ? { lastActionActor: auditedUpdates.lastActionActor } : {}),
          ...(auditedUpdates.lastActionSummary ? { lastActionSummary: auditedUpdates.lastActionSummary } : {}),
        },
        target,
        firebaseUser.uid
      ).catch(() => setCloudSyncStatus('error'));
    }
  };

  const publishEventProposal = (id: string) => {
    if (role !== 'bar') return;
    const target = eventProposalsRef.current.find((ev) => ev.id === id);
    if (!target) return;
    if (currentVenue && target.venueId !== currentVenue.id) return;
    const transition = applyPublishEventTransition({
      eventProposals: eventProposalsRef.current,
      slotBids: slotBidsRef.current,
      eventId: id,
    });
    if (!transition.ok) return;

    const venueEmail = resolveVenueEmail(target.venueId, venuesRef.current);
    transition.updatedEvent.slots.forEach((slot) => {
      if (slot.assignedMusicianId) {
        const musician = musicians.find((m) => m.id === slot.assignedMusicianId);
        sendEventPublishedToMusician({
          musicianEmail: resolveMusicianEmail(slot.assignedMusicianId),
          musicianName: slot.assignedMusicianName || musician?.stageName || 'Músico',
          eventTitle: transition.updatedEvent.title,
          venueName: transition.updatedEvent.venueName,
          eventDate: transition.updatedEvent.date,
          slotTime: `${slot.startTime} - ${slot.endTime}`,
          agreedCachetARS: slot.agreedCachetARS ?? transition.updatedEvent.baseCachetARS,
          agreedCachetType: slot.agreedCachetType ?? transition.updatedEvent.cachetType,
          targetEntityId: slot.assignedMusicianId,
          senderEntityId: transition.updatedEvent.venueId,
          fromEmail: venueEmail,
        });
      }
    });

    slotBidsRef.current = transition.slotBids;
    setSlotBids(transition.slotBids);
    eventProposalsRef.current = transition.eventProposals;
    setEventProposals(transition.eventProposals);

    if (firebaseUser) {
      Promise.all(
        transition.closedBids.map((closedBid) =>
          syncSlotBidBarResponse(closedBid, target, firebaseUser.uid)
        )
      )
        .then(() =>
          syncEventProposalBarUpdate(
            id,
            {
              status: 'publicada',
              slots: transition.updatedEvent.slots,
              lastActionAt: transition.updatedEvent.lastActionAt,
              lastActionActor: transition.updatedEvent.lastActionActor,
              lastActionSummary: transition.updatedEvent.lastActionSummary,
            },
            transition.updatedEvent,
            firebaseUser.uid
          )
        )
        .catch(() => setCloudSyncStatus('error'));
    }

    const confirmedMusicians = target.slots
      .map((s) => s.assignedMusicianId)
      .filter((mId): mId is string => Boolean(mId));

    setNotifications((prev) => [
      {
        id: makeUniqueId('notif-bar'),
        title: '🎉 Evento Publicado en Cartelera',
        message: `"${target.title}" ya está disponible para que el público general reserve entradas.`,
        timestamp: 'Recién',
        read: false,
        type: 'confirmed',
        targetRole: 'bar',
        targetEntityId: target.venueId,
      },
      ...confirmedMusicians.map((mId) => ({
        id: makeUniqueId('notif-mus'),
        title: '🎉 ¡Tu show ya está en Cartelera!',
        message: `${target.venueName} publicó "${target.title}" (${target.date}).`,
        timestamp: 'Recién',
        read: false,
        type: 'confirmed' as const,
        targetRole: 'musico' as const,
        targetEntityId: mId,
      })),
      ...prev,
    ]);
  };

  const saveVenueRiderTemplate = (venueId: string, template: EventRider) => {
    setVenues((prev) =>
      prev.map((v) => (v.id === venueId ? { ...v, defaultRiderTemplate: template } : v))
    );
    if (firebaseUser) {
      syncVenueRiderUpdate(venueId, template).catch(() => setCloudSyncStatus('error'));
    }
    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}`,
        title: '📋 Ficha Técnica de Sala Guardada',
        message: 'Tu configuración de escenario, consola, micrófonos y luces quedó guardada para futuros eventos.',
        timestamp: 'Recién',
        read: false,
        type: 'system',
        targetRole: 'bar',
        targetEntityId: venueId,
      },
      ...prev,
    ]);
  };

  const liquidateMusicianCachet = (proposalId: string) => {
    const target = eventProposalsRef.current.find((ev) => ev.id === proposalId);
    const cachetPaidAt = new Date().toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
    const nowIso = new Date().toISOString();
    const actorName = currentVenue?.name || target?.venueName || 'Bar';
    const lastActionSummary = 'Cachet liquidado a los músicos';
    const nextEvents = eventProposalsRef.current.map((ev) =>
      ev.id === proposalId
        ? {
            ...ev,
            cachetPaid: true,
            cachetPaidAt,
            lastActionAt: nowIso,
            lastActionActor: actorName,
            lastActionSummary,
          }
        : ev
    );
    eventProposalsRef.current = nextEvents;
    setEventProposals(nextEvents);
    if (firebaseUser && target) {
      syncEventProposalBarUpdate(
        proposalId,
        {
          cachetPaid: true,
          cachetPaidAt,
          lastActionAt: nowIso,
          lastActionActor: actorName,
          lastActionSummary,
        },
        target,
        firebaseUser.uid
      ).catch(() => setCloudSyncStatus('error'));
    }
    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}`,
        title: '💰 Cachet Liquidado',
        message: 'Se registró el pago del cachet acordado a los músicos del show.',
        timestamp: 'Recién',
        read: false,
        type: 'confirmed',
        targetRole: 'bar',
        targetEntityId: target?.venueId || currentVenue?.id,
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
        targetRole: 'musico',
        targetEntityId: musicianId,
      },
      ...prev,
    ]);
  };

  const submitSlotBid = (data: {
    eventId: string;
    slotId: string;
    proposedCachetARS: number;
    cachetType?: CachetMode;
    musiciansCount: number;
    equipmentProvided: string;
    equipmentNeeded: string;
    musicLinks?: MusicianMusicLinks;
    inputList?: MusicianInputChannel[];
    initialNote?: string;
  }): { ok: boolean; message?: string } => {
    const mus = currentMusician || musicians[0];
    const targetEvent = eventProposalsRef.current.find((e) => e.id === data.eventId);
    const targetSlot = targetEvent?.slots.find((s) => s.id === data.slotId);
    const effectiveCachetType: CachetMode =
      data.cachetType === 'a_la_gorra' ? 'a_la_gorra' : 'fijo';
    const effectiveCachetARS = effectiveCachetType === 'a_la_gorra' ? 0 : data.proposedCachetARS;

    const newBid: MusicianSlotBid = {
      id: makeUniqueId('bid'),
      eventId: data.eventId,
      slotId: data.slotId,
      musicianId: mus.id,
      musicianName: mus.stageName,
      musicianAvatar: mus.avatarUrl,
      proposedCachetARS: effectiveCachetARS,
      cachetType: effectiveCachetType,
      musiciansCount: data.musiciansCount,
      equipmentProvided: data.equipmentProvided,
      equipmentNeeded: data.equipmentNeeded,
      musicLinks: data.musicLinks || mus.musicLinks,
      inputList: data.inputList || mus.defaultInputList,
      status: 'pendiente_bar',
      history: [
        {
          id: makeUniqueId('h'),
          actor: 'musico',
          actorName: mus.stageName,
          cachetARS: effectiveCachetARS,
          cachetType: effectiveCachetType,
          note:
            data.initialNote ||
            (effectiveCachetType === 'a_la_gorra'
              ? 'Postulación enviada con propuesta de caché a la gorra y equipamiento.'
              : 'Postulación enviada con propuesta de caché y equipamiento.'),
          createdAt: new Date().toISOString(),
        },
      ],
      createdAt: new Date().toISOString(),
    };

    const transition = applyBidSubmissionTransition({
      eventProposals: eventProposalsRef.current,
      slotBids: slotBidsRef.current,
      bid: newBid,
    });
    if (!transition.ok) {
      return { ok: false, message: transition.message };
    }

    slotBidsRef.current = transition.slotBids;
    setSlotBids(transition.slotBids);
    eventProposalsRef.current = transition.eventProposals;
    setEventProposals(transition.eventProposals);

    if (firebaseUser) {
      syncSlotBidCreate(transition.newBid, targetEvent, firebaseUser.uid)
        .then(() => {
          return syncEventProposalSlotsAndStatus(transition.updatedEvent, firebaseUser.uid);
        })
        .catch(() => setCloudSyncStatus('error'));
    }

    const barEmail = resolveVenueEmail(targetEvent?.venueId, venuesRef.current);
    const musEmail = resolveMusicianEmail(mus.id);
    const cachetSummary = formatCachet(effectiveCachetARS, effectiveCachetType);

    sendProposalReceivedEmailToBar({
      barEmail,
      venueName: targetEvent?.venueName || 'Bar DeGira',
      musicianName: mus.stageName,
      eventTitle: targetEvent?.title || 'Show en Vivo',
      slotTime: targetSlot ? `${targetSlot.startTime} - ${targetSlot.endTime}` : '21:00',
      cachetARS: effectiveCachetARS,
      cachetType: effectiveCachetType,
      targetEntityId: targetEvent?.venueId,
      senderEntityId: mus.id,
      fromEmail: musEmail,
    });

    setNotifications((prev) => [
      {
        id: makeUniqueId('notif-mus'),
        title: '🎵 Propuesta enviada al bar',
        message: `Tu propuesta para "${targetEvent?.title || 'el evento'}" fue enviada a ${targetEvent?.venueName || 'el bar'}.`,
        timestamp: 'Recién',
        read: false,
        type: 'application',
        targetRole: 'musico',
        targetEntityId: mus.id,
      },
      {
        id: makeUniqueId('notif-bar'),
        title: '🎸 Nueva Postulación de Músico',
        message: `${mus.stageName} envió una propuesta (${cachetSummary}) para "${targetEvent?.title || 'tu fecha'}".`,
        timestamp: 'Recién',
        read: false,
        type: 'application',
        targetRole: 'bar',
        targetEntityId: targetEvent?.venueId,
      },
      ...prev,
    ]);

    return { ok: true };
  };

  const sendMusicianProposalReminder = (bidId: string): { success: boolean; message: string } => {
    const bid = slotBidsRef.current.find((b) => b.id === bidId);
    if (!bid) return { success: false, message: 'Propuesta no encontrada.' };

    const event = eventProposalsRef.current.find((e) => e.id === bid.eventId);
    const updatedCount = (bid.reminderCount || 0) + 1;
    const updatedBid: MusicianSlotBid = {
      ...bid,
      reminderSentAt: new Date().toISOString(),
      reminderCount: updatedCount,
    };

    const nextBids = slotBidsRef.current.map((b) => (b.id === bidId ? updatedBid : b));
    slotBidsRef.current = nextBids;
    setSlotBids(nextBids);

    if (firebaseUser) {
      syncSlotBidMusicianUpdate(updatedBid, event, firebaseUser.uid).catch(() =>
        setCloudSyncStatus('error')
      );
    }

    setNotifications((prev) => [
      {
        id: makeUniqueId('notif-mus'),
        title: '🔔 Recordatorio enviado al Bar',
        message: `Le enviaste un recordatorio a ${event?.venueName || 'el bar'} para que revise tu propuesta para "${event?.title || 'el evento'}".`,
        timestamp: 'Recién',
        read: false,
        type: 'system',
        targetRole: 'musico',
        targetEntityId: bid.musicianId,
      },
      {
        id: makeUniqueId('notif-bar'),
        title: '🔔 Recordatorio de Propuesta Recibida',
        message: `${bid.musicianName} te envió un recordatorio sobre su propuesta pendiente para "${event?.title || 'tu fecha'}".`,
        timestamp: 'Recién',
        read: false,
        type: 'application',
        targetRole: 'bar',
        targetEntityId: event?.venueId,
      },
      ...prev,
    ]);

    sendPushNotification({
      title: '🔔 Recordatorio de propuesta musical',
      body: `${bid.musicianName} te recuerda responder a su propuesta para "${event?.title || 'tu fecha'}".`,
      targetRole: 'bar',
    });

    return { success: true, message: `Recordatorio enviado a ${event?.venueName || 'el bar'} con éxito.` };
  };

  const retractMusicianSlotBid = (bidId: string): { success: boolean; message: string } => {
    const transition = applyBidRetractionTransition({
      eventProposals: eventProposalsRef.current,
      slotBids: slotBidsRef.current,
      bidId,
      actorMusicianId: currentMusician?.id,
    });

    if (!transition.ok) {
      return { success: false, message: transition.message };
    }

    slotBidsRef.current = transition.slotBids;
    setSlotBids(transition.slotBids);
    eventProposalsRef.current = transition.eventProposals;
    setEventProposals(transition.eventProposals);

    if (firebaseUser) {
      syncSlotBidMusicianUpdate(transition.updatedBid, transition.event, firebaseUser.uid)
        .then(() => syncEventProposalSlotsAndStatus(transition.updatedEvent, firebaseUser.uid))
        .catch(() => setCloudSyncStatus('error'));
    }

    setNotifications((prev) => [
      {
        id: makeUniqueId('notif-retract'),
        title: '↩️ Propuesta Retractada',
        message: `Te retractaste con éxito de la fecha en ${transition.event.venueName} (${transition.event.date}). El horario quedó disponible nuevamente.`,
        timestamp: 'Recién',
        read: false,
        type: 'system',
        targetRole: 'musico',
        targetEntityId: transition.updatedBid.musicianId,
      },
      {
        id: makeUniqueId('notif-bar-retract'),
        title: '↩️ Un músico se retractó del horario',
        message: `${transition.updatedBid.musicianName} se retractó de su horario para "${transition.event.title}" (más de 24hs de anticipación). El slot quedó libre para recibir nuevas propuestas.`,
        timestamp: 'Recién',
        read: false,
        type: 'application',
        targetRole: 'bar',
        targetEntityId: transition.event.venueId,
      },
      ...prev,
    ]);

    sendPushNotification({
      title: '↩️ Músico se retractó de la fecha',
      body: `${transition.updatedBid.musicianName} se retractó del show "${transition.event.title}". El horario quedó libre.`,
      targetRole: 'bar',
    });

    return { success: true, message: 'Te has retractado de la propuesta exitosamente. El horario ha quedado disponible.' };
  };

  const respondToSlotBid = (
    bidId: string,
    action: 'accept' | 'reject' | 'counter',
    counterCachet?: number,
    note?: string,
    options?: { cachetType?: CachetMode; musiciansCount?: number }
  ): { ok: boolean; message?: string } => {
    const actorEntityId = role === 'bar' ? currentVenue?.id : role === 'musico' ? currentMusician?.id : undefined;

    const transition = applyBidResponseTransition({
      eventProposals: eventProposalsRef.current,
      slotBids: slotBidsRef.current,
      bidId,
      actorRole: role,
      actorEntityId,
      action,
      counterCachet,
      counterCachetType: options?.cachetType,
      counterMusiciansCount: options?.musiciansCount,
      note,
    });

    if (!transition.ok) {
      return { ok: false, message: transition.message };
    }

    const { updatedBid, updatedEvent, event, autoRejectedBids } = transition;
    const newProposedCachet = updatedBid.proposedCachetARS;
    const newCachetLabel = formatCachet(newProposedCachet, updatedBid.cachetType);

    slotBidsRef.current = transition.slotBids;
    setSlotBids(transition.slotBids);

    if (updatedEvent) {
      eventProposalsRef.current = transition.eventProposals;
      setEventProposals(transition.eventProposals);
    }

    if (action === 'accept') {
      sendPushNotification({
        title: '🎸 ¡Propuesta de Fecha Aceptada!',
        body: `${role === 'bar' ? event.venueName : updatedBid.musicianName} aceptó el acuerdo para el show "${event.title}".`,
        targetRole: role === 'bar' ? 'musico' : 'bar',
        url: '/#acuerdos',
      });
    } else if (action === 'reject') {
      sendPushNotification({
        title: 'Fecha no concertada',
        body: `Propuesta rechazada para "${event.title}". El horario volvió a quedar disponible.`,
        targetRole: role === 'bar' ? 'musico' : 'bar',
        url: '/#acuerdos',
      });
    } else if (action === 'counter') {
      sendPushNotification({
        title: '💬 Nueva Contraoferta de Caché',
        body: `${role === 'bar' ? event.venueName : updatedBid.musicianName} propuso ${newCachetLabel}.`,
        targetRole: role === 'bar' ? 'musico' : 'bar',
        url: '/#acuerdos',
      });
    }

    if (firebaseUser) {
      const syncPromise =
        role === 'bar'
          ? Promise.all([
              syncSlotBidBarResponse(updatedBid, event, firebaseUser.uid),
              ...autoRejectedBids.map((rejBid) =>
                syncSlotBidBarResponse(rejBid, event, firebaseUser.uid)
              ),
            ])
          : Promise.all([
              syncSlotBidMusicianUpdate(updatedBid, event, firebaseUser.uid),
              ...autoRejectedBids.map((rejBid) =>
                syncSlotBidBarResponse(rejBid, event, firebaseUser.uid)
              ),
            ]);

      syncPromise
        .then(() => {
          if (updatedEvent) {
            return role === 'bar'
              ? syncEventProposalBarUpdate(
                  updatedEvent.id,
                  {
                    slots: updatedEvent.slots,
                    status: updatedEvent.status,
                    lastActionAt: updatedEvent.lastActionAt,
                    lastActionActor: updatedEvent.lastActionActor,
                    lastActionSummary: updatedEvent.lastActionSummary,
                  },
                  updatedEvent,
                  firebaseUser.uid
                )
              : syncEventProposalSlotsAndStatus(updatedEvent, firebaseUser.uid);
          }
        })
        .catch(() => setCloudSyncStatus('error'));
    }

    const musEmail = resolveMusicianEmail(updatedBid.musicianId);
    const barEmail = resolveVenueEmail(event.venueId, venuesRef.current);
    sendNegotiationUpdateEmailToMusician({
      musicianEmail: musEmail,
      musicianName: updatedBid.musicianName,
      venueName: event.venueName,
      eventTitle: event.title,
      action,
      newCachetARS: newProposedCachet,
      cachetType: updatedBid.cachetType,
      note,
      toEmail: role === 'bar' ? musEmail : barEmail,
      targetRole: role === 'bar' ? 'musico' : 'bar',
      targetEntityId: role === 'bar' ? updatedBid.musicianId : event.venueId,
      senderRole: role === 'bar' ? 'bar' : 'musico',
      senderEntityId: role === 'bar' ? event.venueId : updatedBid.musicianId,
      fromEmail: role === 'bar' ? barEmail : musEmail,
    });

    setNotifications((prev) => [
      {
        id: makeUniqueId('notif-neg-bar'),
        title:
          action === 'accept'
            ? '🎉 Acuerdo Confirmado'
            : action === 'counter'
            ? '💬 Contraoferta Registrada'
            : '🔓 Horario Liberado tras Rechazo',
        message:
          action === 'accept'
            ? `Se confirmó el acuerdo con ${updatedBid.musicianName} (${newCachetLabel}) para "${event.title}".`
            : action === 'counter'
            ? `${role === 'bar' ? 'Enviaste contraoferta' : `${updatedBid.musicianName} contrapropuso`} (${newCachetLabel}) para "${event.title}".`
            : `La propuesta de ${updatedBid.musicianName} para "${event.title}" fue rechazada y el horario volvió a quedar libre.`,
        timestamp: 'Recién',
        read: false,
        type: action === 'accept' ? 'confirmed' : 'application',
        targetRole: 'bar',
        targetEntityId: event.venueId,
      },
      {
        id: makeUniqueId('notif-neg-mus'),
        title:
          action === 'accept'
            ? '🎉 ¡Tu Fecha Quedó Confirmada!'
            : action === 'counter'
            ? '💬 Contraoferta en Negociación'
            : '🔓 Propuesta Cerrada • Horario Libre',
        message:
          action === 'accept'
            ? `Acuerdo confirmado con ${event.venueName} (${newCachetLabel}) para "${event.title}".`
            : action === 'counter'
            ? `${role === 'musico' ? 'Enviaste contraoferta' : `${event.venueName} contrapropuso`} (${newCachetLabel}) para "${event.title}".`
            : `La negociación en ${event.venueName} para "${event.title}" fue rechazada y el horario volvió a abrirse.`,
        timestamp: 'Recién',
        read: false,
        type: action === 'accept' ? 'confirmed' : 'application',
        targetRole: 'musico',
        targetEntityId: updatedBid.musicianId,
      },
      ...prev,
    ]);

    return { ok: true };
  };

  const approveAndPublishEvent = (proposalId: string) => {
    if (role !== 'bar') return;
    const target = eventProposalsRef.current.find((e) => e.id === proposalId);
    if (!target) return;
    if (currentVenue && target.venueId !== currentVenue.id) return;
    const transition = applyPublishEventTransition({
      eventProposals: eventProposalsRef.current,
      slotBids: slotBidsRef.current,
      eventId: proposalId,
    });
    if (!transition.ok) return;

    const venueEmail = resolveVenueEmail(target.venueId, venuesRef.current);
    transition.updatedEvent.slots.forEach((slot) => {
      if (slot.assignedMusicianId) {
        const musician = musicians.find((m) => m.id === slot.assignedMusicianId);
        sendEventPublishedToMusician({
          musicianEmail: resolveMusicianEmail(slot.assignedMusicianId),
          musicianName: slot.assignedMusicianName || musician?.stageName || 'Músico',
          eventTitle: transition.updatedEvent.title,
          venueName: transition.updatedEvent.venueName,
          eventDate: transition.updatedEvent.date,
          slotTime: `${slot.startTime} - ${slot.endTime}`,
          agreedCachetARS: slot.agreedCachetARS ?? transition.updatedEvent.baseCachetARS,
          agreedCachetType: slot.agreedCachetType ?? transition.updatedEvent.cachetType,
          targetEntityId: slot.assignedMusicianId,
          senderEntityId: transition.updatedEvent.venueId,
          fromEmail: venueEmail,
        });
      }
    });

    slotBidsRef.current = transition.slotBids;
    setSlotBids(transition.slotBids);
    eventProposalsRef.current = transition.eventProposals;
    setEventProposals(transition.eventProposals);

    if (firebaseUser) {
      Promise.all(
        transition.closedBids.map((closedBid) =>
          syncSlotBidBarResponse(closedBid, target, firebaseUser.uid)
        )
      )
        .then(() =>
          syncEventProposalBarUpdate(
            proposalId,
            {
              status: 'publicada',
              slots: transition.updatedEvent.slots,
              lastActionAt: transition.updatedEvent.lastActionAt,
              lastActionActor: transition.updatedEvent.lastActionActor,
              lastActionSummary: transition.updatedEvent.lastActionSummary,
            },
            transition.updatedEvent,
            firebaseUser.uid
          )
        )
        .catch(() => setCloudSyncStatus('error'));
    }

    const confirmedMusicians = target.slots
      .map((s) => s.assignedMusicianId)
      .filter((mId): mId is string => Boolean(mId));

    setNotifications((prev) => [
      {
        id: makeUniqueId('notif-bar'),
        title: '🎉 Evento Aprobado y Publicado en Cartelera',
        message: `Has publicado "${target.title}" en la Cartelera de Buenos Aires. El público ya puede reservar.`,
        timestamp: 'Recién',
        read: false,
        type: 'confirmed',
        targetRole: 'bar',
        targetEntityId: target.venueId,
      },
      ...confirmedMusicians.map((mId) => ({
        id: makeUniqueId('notif-mus'),
        title: '🎉 ¡Evento Publicado en Cartelera!',
        message: `${target.venueName} publicó "${target.title}" (${target.date}).`,
        timestamp: 'Recién',
        read: false,
        type: 'confirmed' as const,
        targetRole: 'musico' as const,
        targetEntityId: mId,
      })),
      ...prev,
    ]);

    sendPushNotification({
      title: '🎉 ¡Show publicado en Cartelera DeGira!',
      body: `"${target.title}" en ${target.venueName} fue aprobado y ya está disponible para reservas.`,
    });
  };

  const cancelEventProposal = (eventId: string, reason?: string): { ok: boolean; message?: string } => {
    if (role !== 'bar') {
      return { ok: false, message: 'Solo el bar anfitrión puede cancelar este evento.' };
    }
    const target = eventProposalsRef.current.find((e) => e.id === eventId);
    if (!target) {
      return { ok: false, message: 'Evento no encontrado.' };
    }
    if (currentVenue && target.venueId !== currentVenue.id) {
      return { ok: false, message: 'No podés cancelar un evento de otro bar.' };
    }

    const transition = applyCancelEventTransition({
      eventProposals: eventProposalsRef.current,
      slotBids: slotBidsRef.current,
      eventId,
      actorVenueId: currentVenue?.id,
      reason,
    });
    if (!transition.ok) {
      return { ok: false, message: transition.message };
    }

    slotBidsRef.current = transition.slotBids;
    setSlotBids(transition.slotBids);
    eventProposalsRef.current = transition.eventProposals;
    setEventProposals(transition.eventProposals);

    if (firebaseUser) {
      Promise.all(
        transition.closedBids.map((closedBid) =>
          syncSlotBidBarResponse(closedBid, target, firebaseUser.uid)
        )
      )
        .then(() =>
          syncEventProposalBarUpdate(
            eventId,
            {
              status: 'cancelada',
              cancelledAt: transition.updatedEvent.cancelledAt,
              lastActionAt: transition.updatedEvent.lastActionAt,
              lastActionActor: transition.updatedEvent.lastActionActor,
              lastActionSummary: transition.updatedEvent.lastActionSummary,
            },
            transition.updatedEvent,
            firebaseUser.uid
          )
        )
        .catch(() => setCloudSyncStatus('error'));
    }

    const affectedMusicianIds = Array.from(
      new Set([
        ...target.slots.map((s) => s.assignedMusicianId).filter((id): id is string => Boolean(id)),
        ...transition.closedBids.map((b) => b.musicianId),
      ])
    );

    setNotifications((prev) => [
      {
        id: makeUniqueId('notif-cancel-bar'),
        title: '🚫 Evento Cancelado',
        message: `Cancelaste "${target.title}". Pasó a modo lectura y ya no acepta postulaciones ni reservas.`,
        timestamp: 'Recién',
        read: false,
        type: 'system',
        targetRole: 'bar',
        targetEntityId: target.venueId,
      },
      ...affectedMusicianIds.map((mId) => ({
        id: makeUniqueId('notif-cancel-mus'),
        title: '🚫 Evento Cancelado por el Bar',
        message: `${target.venueName} canceló "${target.title}" (${target.date}).${reason?.trim() ? ` Motivo: ${reason.trim()}` : ''}`,
        timestamp: 'Recién',
        read: false,
        type: 'system' as const,
        targetRole: 'musico' as const,
        targetEntityId: mId,
      })),
      ...prev,
    ]);

    return { ok: true };
  };

  const addNewVenue = (
    venueData: Omit<VenueProfile, 'id' | 'rating' | 'reviewCount' | 'reviews' | 'ratingBreakdown'>
  ): VenueProfile => {
    const newVenue: VenueProfile = {
      ...venueData,
      id: `venue-${Date.now()}`,
      ownerBarId: venueData.ownerBarId || resolvedBarOwnerId,
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

    if (firebaseUser) {
      syncVenueCreate(newVenue, firebaseUser.uid).catch(() => setCloudSyncStatus('error'));
    }

    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}`,
        title: '🏢 Nuevo Local / Sala Registrado',
        message: `Has registrado "${newVenue.name}" en ${newVenue.neighborhood} como local anfitrión disponible.`,
        timestamp: 'Recién',
        read: false,
        type: 'system',
        targetRole: 'bar',
        targetEntityId: newVenue.id,
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
      eventDate: event?.date || offsetIsoDate(5),
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

    if (firebaseUser) {
      syncReservationCreate(newReservation, event, firebaseUser.uid).catch(() =>
        setCloudSyncStatus('error')
      );
    }

    sendReservationCreatedEmail({
      userEmail: resolvedEmail,
      userName: resolvedName,
      eventTitle: event?.title || 'Show en Vivo',
      venueName: event?.venueName || 'Bar DeGira',
      partySize,
      totalARS: 8000 * partySize,
      eventCode: newReservation.eventCode,
      targetEntityId: newReservation.userId,
    });

    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}`,
        title: '⏱️ Tenés 8 minutos para pagar',
        message: `Realizá el pago con código ${newReservation.eventCode} y subí tu comprobante en Mi Perfil & Reservas. Te enviamos los detalles por correo.`,
        timestamp: 'Recién',
        read: false,
        type: 'system',
        targetRole: 'espectador',
        targetEntityId: newReservation.userId,
        targetEmail: resolvedEmail,
      },
      ...prev,
    ]);

    return newReservation;
  };

  const uploadPaymentReceipt = (reservationId: string, imageDataUrl: string, ocrNotes?: string) => {
    let updatedResForCloud: PublicEventReservation | undefined;
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
          updatedResForCloud = updated;

          sendPaymentUploadedAlertToBar({
            barEmail: resolveVenueEmail(res.venueId, venuesRef.current),
            venueName: res.venueName,
            eventTitle: res.eventTitle,
            eventCode: res.eventCode,
            userName: res.userName,
            amountARS: res.totalARS,
            targetEntityId: res.venueId,
            senderEntityId: res.userId,
            fromEmail: res.userEmail,
          });

          return updated;
        }
        return res;
      })
    );

    if (firebaseUser && updatedResForCloud) {
      syncReservationSpectatorUpdate(updatedResForCloud).catch(() =>
        setCloudSyncStatus('error')
      );
    }

    if (updatedResForCloud) {
      const uploadedRes = updatedResForCloud;
      setNotifications((prev) => [
        {
          id: makeUniqueId('notif-pub'),
          title: '📄 Comprobante enviado al bar',
          message: `El anfitrión de ${uploadedRes.venueName} recibió tu comprobante y confirmará el pago en breve.`,
          timestamp: 'Recién',
          read: false,
          type: 'confirmed',
          targetRole: 'espectador',
          targetEntityId: uploadedRes.userId,
          targetEmail: uploadedRes.userEmail,
        },
        {
          id: makeUniqueId('notif-bar'),
          title: '🔔 Nuevo Comprobante Recibido',
          message: `${uploadedRes.userName} subió su comprobante ($${uploadedRes.totalARS.toLocaleString('es-AR')}) para ${uploadedRes.eventTitle}.`,
          timestamp: 'Recién',
          read: false,
          type: 'application',
          targetRole: 'bar',
          targetEntityId: uploadedRes.venueId,
        },
        ...prev,
      ]);
    }
  };

  const confirmReservationPayment = (reservationId: string) => {
    const targetRes = publicEventReservationsRef.current.find((r) => r.id === reservationId);
    if (!targetRes || targetRes.status === 'confirmada') {
      return;
    }

    const previousStatus = targetRes.status;
    const qrCode = `DeGira:Reserva:${targetRes.eventId}:${targetRes.eventCode}:${targetRes.userId}:${targetRes.partySize}p`;
    const updatedRes: PublicEventReservation = {
      ...targetRes,
      status: 'confirmada' as const,
      qrTicketCode: qrCode,
      qrEmailSent: true,
    };

    setPublicEventReservations((prev) =>
      prev.map((res) =>
        res.id === reservationId && res.status !== 'confirmada' ? updatedRes : res
      )
    );

    let updatedEventForCloud: EventProposal | undefined;
    setEventProposals((events) =>
      events.map((ev) => {
        if (ev.id === targetRes.eventId) {
          const updatedEv = applyPaymentConfirmationToEvent(ev, targetRes.partySize, previousStatus);
          updatedEventForCloud = updatedEv;
          return updatedEv;
        }
        return ev;
      })
    );

    if (firebaseUser) {
      syncReservationBarUpdate(updatedRes)
        .then(() => {
          if (updatedEventForCloud) {
            return syncEventCapacityOrWaitlist(updatedEventForCloud, firebaseUser.uid);
          }
        })
        .catch(() => setCloudSyncStatus('error'));
    }

    sendQrTicketEmail({
      toEmail: targetRes.userEmail,
      userName: targetRes.userName,
      eventTitle: targetRes.eventTitle,
      venueName: targetRes.venueName,
      venueAddress: targetRes.venueAddress,
      eventDate: targetRes.eventDate,
      eventTime: targetRes.eventStartTime,
      partySize: targetRes.partySize,
      qrTicketCode: qrCode,
      targetEntityId: targetRes.userId,
      senderEntityId: targetRes.venueId,
      fromEmail: resolveVenueEmail(targetRes.venueId, venuesRef.current),
    });

    setNotifications((prev) => [
      {
        id: makeUniqueId('notif-pub'),
        title: '🎟️ Pago Confirmado & Pase QR Emitido',
        message: `${targetRes.venueName} confirmó tu pago (${targetRes.partySize} ${targetRes.partySize === 1 ? 'persona' : 'personas'}). Ya tenés tu Pase QR disponible.`,
        timestamp: 'Recién',
        read: false,
        type: 'confirmed',
        targetRole: 'espectador',
        targetEntityId: targetRes.userId,
        targetEmail: targetRes.userEmail,
      },
      {
        id: makeUniqueId('notif-bar'),
        title: '🎟️ Reserva Confirmada & QR Emitido',
        message: `Confirmaste el pago de ${targetRes.userName} (${targetRes.partySize} ${targetRes.partySize === 1 ? 'persona' : 'personas'}) para ${targetRes.eventTitle}.`,
        timestamp: 'Recién',
        read: false,
        type: 'confirmed',
        targetRole: 'bar',
        targetEntityId: targetRes.venueId,
      },
      ...prev,
    ]);
  };

  const expireReservation = (reservationId: string) => {
    const target = publicEventReservationsRef.current.find((r) => r.id === reservationId);
    if (!target || target.status !== 'pendiente_pago') {
      return;
    }

    const updatedRes: PublicEventReservation = { ...target, status: 'expirada' as const };
    setPublicEventReservations((prev) =>
      prev.map((res) =>
        res.id === reservationId && res.status === 'pendiente_pago' ? updatedRes : res
      )
    );

    if (firebaseUser) {
      syncReservationSpectatorUpdate(updatedRes).catch(() =>
        setCloudSyncStatus('error')
      );
    }

    if (target.userEmail) {
      sendReservationExpiredEmail({
        userEmail: target.userEmail,
        userName: target.userName,
        eventTitle: target.eventTitle,
        venueName: target.venueName,
        partySize: target.partySize,
        targetEntityId: target.userId,
      });
    }

    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}-exp`,
        title: '⌛ Reserva Expirada por Tiempo',
        message: `Se agotaron los 8 minutos de tolerancia para abonar tu reserva en "${target.venueName}".`,
        timestamp: 'Recién',
        read: false,
        type: 'system',
        targetRole: 'espectador',
        targetEntityId: target.userId,
        targetEmail: target.userEmail,
      },
      ...prev,
    ]);
  };

  const rejectReservationPayment = (reservationId: string, reason: string) => {
    const target = publicEventReservationsRef.current.find((r) => r.id === reservationId);
    if (!target) return;

    const previousStatus = target.status;
    const updatedRes: PublicEventReservation = {
      ...target,
      status: 'cancelada' as const,
      rejectionReason: reason,
    };

    setPublicEventReservations((prev) =>
      prev.map((res) => (res.id === reservationId ? updatedRes : res))
    );

    let updatedEventForCloud: EventProposal | undefined;
    if (previousStatus === 'confirmada') {
      setEventProposals((events) =>
        events.map((ev) => {
          if (ev.id === target.eventId) {
            const updatedEv = restoreCapacityOnReservationRelease(ev, target.partySize, previousStatus);
            updatedEventForCloud = updatedEv;
            return updatedEv;
          }
          return ev;
        })
      );
    }

    if (firebaseUser) {
      syncReservationBarUpdate(updatedRes)
        .then(() => {
          if (updatedEventForCloud) {
            return syncEventCapacityOrWaitlist(updatedEventForCloud, firebaseUser.uid);
          }
        })
        .catch(() => setCloudSyncStatus('error'));
    }

    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}`,
        title: '⚠️ Comprobante de Pago Rechazado',
        message: `El bar no aceptó el comprobante: "${reason}".`,
        timestamp: 'Recién',
        read: false,
        type: 'system',
        targetRole: 'espectador',
        targetEntityId: target.userId,
        targetEmail: target.userEmail,
      },
      ...prev,
    ]);
  };

  const checkInReservation = (
    qrCodeOrReservationId: string
  ): { success: boolean; message: string; reservation?: PublicEventReservation } => {
    const clean = qrCodeOrReservationId.trim().toUpperCase();
    const res = publicEventReservationsRef.current.find(
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

    if (firebaseUser) {
      syncReservationBarUpdate(updatedRes).catch(() =>
        setCloudSyncStatus('error')
      );
    }

    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}`,
        title: '🚪 Check-in en Puerta Registrado',
        message: `Ingresó ${res.userName} (${res.partySize} ${res.partySize === 1 ? 'persona' : 'personas'}) a ${res.venueName}.`,
        timestamp: 'Recién',
        read: false,
        type: 'system',
        targetRole: 'bar',
        targetEntityId: res.venueId,
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
    const target = eventProposalsRef.current.find((e) => e.id === proposalId);
    if (!target) return { success: false, message: 'Evento no encontrado' };

    const tokenId = activePublicUserId || `wl-${Date.now()}`;
    let updatedEventForCloud: EventProposal | undefined;

    setEventProposals((prev) =>
      prev.map((ev) => {
        if (ev.id === proposalId) {
          const list = ev.waitlist || [];
          const entry = firebaseUser ? tokenId : email;
          if (!list.includes(entry)) {
            const updatedEv = { ...ev, waitlist: [...list, entry] };
            updatedEventForCloud = updatedEv;
            return updatedEv;
          }
        }
        return ev;
      })
    );

    if (firebaseUser && updatedEventForCloud) {
      syncEventCapacityOrWaitlist(updatedEventForCloud, firebaseUser.uid).catch(() =>
        setCloudSyncStatus('error')
      );
    }

    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}`,
        title: '🎟️ Anotado en Lista de Espera',
        message: `Te anotaste para "${target.title}". Te avisaremos si se libera un cupo por expiración.`,
        timestamp: 'Recién',
        read: false,
        type: 'system',
        targetRole: 'espectador',
        targetEntityId: activePublicUserId,
        targetEmail: resolvePublicUserEmail(activePublicUserId, publicUsers),
      },
      ...prev,
    ]);

    return { success: true, message: '¡Te anotaste con éxito en la lista de espera!' };
  };

  const addSpectatorBenefit = (benefit: SpectatorBenefit) => {
    setSpectatorBenefits((prev) => [benefit, ...prev]);
  };

  const submitReview360 = (reviewData: Omit<EventReview360, 'id' | 'createdAt'>) => {
    const isDuplicate = reviews360Ref.current.some(
      (r) =>
        r.eventId === reviewData.eventId &&
        r.fromRole === reviewData.fromRole &&
        r.fromUserId === reviewData.fromUserId &&
        r.toType === reviewData.toType &&
        r.toId === reviewData.toId
    );
    if (isDuplicate) return;

    const newRev: EventReview360 = {
      ...reviewData,
      id: `rev360-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      createdAt: new Date().toISOString(),
    };
    setReviews360((prev) => [newRev, ...prev]);

    if (firebaseUser) {
      const parentEvent = eventProposalsRef.current.find((e) => e.id === newRev.eventId);
      syncReview360Create(newRev, parentEvent, firebaseUser.uid).catch(() =>
        setCloudSyncStatus('error')
      );
    }

    if (reviewData.fromRole === 'espectador' && reviewData.toType === 'venue') {
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
        targetRole: reviewData.fromRole,
        targetEntityId: reviewData.fromUserId,
      },
      ...prev,
    ]);
  };

  const resetAllData = () => {
    localStorage.clear();
    setRole('espectador');
    setActiveMusicianId('mus-1');
    setActiveVenueId('venue-1');
    setActiveBarAccountId('venue-1');
    setActivePublicUserId('user-pub-1');
    setVenues(INITIAL_VENUES);
    setMusicians(INITIAL_MUSICIANS);
    setPublicUsers(INITIAL_PUBLIC_USERS);
    setOpenCalls(INITIAL_OPEN_CALLS);
    setMusicianAvailabilities(INITIAL_MUSICIAN_AVAILABILITIES);
    setLiveShows(INITIAL_LIVE_SHOWS);
    setReservations(INITIAL_SPECTATOR_RESERVATIONS);
    const initialArchived = archivePastEvents(INITIAL_EVENT_PROPOSALS).events;
    eventProposalsRef.current = initialArchived;
    setEventProposals(initialArchived);
    setSlotBids(INITIAL_SLOT_BIDS);
    setPublicEventReservations(INITIAL_EVENT_RESERVATIONS);
    setReviews360(INITIAL_REVIEWS_360);
    setStoredUserName('');
    setNotifications([
      {
        id: 'notif-1',
        title: '¡Nueva postulación recibida!',
        message: 'Músico Test 1 se postuló para tu próxima fecha en Bar Test 1.',
        timestamp: 'Hace 2 horas',
        read: false,
        type: 'application',
        targetRole: 'bar',
        targetEntityId: 'venue-1',
      },
    ]);
  };

  const loginAsAccount = (account: TestAccount) => {
    setRole(account.role);
    setUserDisplayName(account.displayName);
    if (account.role === 'bar') {
      setActiveBarAccountId(account.entityId);
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
    setLoginTriggerCount((c) => c + 1);
    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}`,
        title: `¡Bienvenido, ${account.displayName}!`,
        message: `Sesión iniciada con la cuenta de prueba (${account.email}).`,
        timestamp: 'Recién',
        read: false,
        type: 'confirmed',
        targetRole: account.role,
        targetEntityId: account.entityId,
        targetEmail: account.email,
      },
      ...prev,
    ]);
  };

  const cancelPublicEventReservation = (reservationId: string) => {
    const target = publicEventReservationsRef.current.find((r) => r.id === reservationId);
    if (!target) return;

    const previousStatus = target.status;
    const updatedRes: PublicEventReservation = { ...target, status: 'cancelada' as const };

    setPublicEventReservations((prev) =>
      prev.map((res) => (res.id === reservationId ? updatedRes : res))
    );

    let updatedEventForCloud: EventProposal | undefined;
    if (previousStatus === 'confirmada') {
      setEventProposals((events) =>
        events.map((ev) => {
          if (ev.id === target.eventId) {
            const updatedEv = restoreCapacityOnReservationRelease(ev, target.partySize, previousStatus);
            updatedEventForCloud = updatedEv;
            return updatedEv;
          }
          return ev;
        })
      );
    }

    if (firebaseUser) {
      syncReservationSpectatorUpdate(updatedRes)
        .then(() => {
          if (updatedEventForCloud) {
            return syncEventCapacityOrWaitlist(updatedEventForCloud, firebaseUser.uid);
          }
        })
        .catch(() => setCloudSyncStatus('error'));
    }

    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}`,
        title: '❌ Reserva Cancelada',
        message: 'Has cancelado tu reserva de mesa.',
        timestamp: 'Recién',
        read: false,
        type: 'system',
        targetRole: 'espectador',
        targetEntityId: target.userId,
        targetEmail: target.userEmail,
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
        targetRole: 'espectador',
        targetEntityId: activePublicUserId,
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
        targetEntityId: att.userId,
      });
    });

    // Disparar email al Bar anfitrión
    const venueEmail = resolveVenueEmail(ev.venueId, venuesRef.current);
    sendReviewReminderEmail({
      toEmail: venueEmail,
      userName: ev.venueName,
      eventTitle: ev.title,
      role: 'bar',
      targetEntityId: ev.venueId,
    });

    // Disparar email a los Músicos que tocaron en el evento
    const confirmedSlots = ev.slots.filter((s) => s.assignedMusicianId && s.assignedMusicianName);
    confirmedSlots.forEach((s) => {
      if (s.assignedMusicianId && s.assignedMusicianName) {
        const musicianEmail = resolveMusicianEmail(s.assignedMusicianId);
        sendReviewReminderEmail({
          toEmail: musicianEmail,
          userName: s.assignedMusicianName,
          eventTitle: ev.title,
          role: 'musico',
          targetEntityId: s.assignedMusicianId,
        });
      }
    });

    // Notificaciones estrictamente dirigidas a cada participante del evento
    const attendeeNotifications: NotificationItem[] = confirmedAttendees.map((att) => ({
      id: makeUniqueId('notif-fb-pub'),
      title: `⭐ ¿Cómo estuvo la noche en ${ev.venueName}?`,
      message: `Ya pasaron 2 horas desde que finalizó "${ev.title}". Calificá al bar y a los músicos (${reviewRef}).`,
      timestamp: 'Recién',
      read: false,
      type: 'review',
      targetRole: 'espectador',
      targetEntityId: att.userId,
      targetEmail: att.userEmail,
    }));

    const musicianNotifications: NotificationItem[] = confirmedSlots.map((s) => ({
      id: makeUniqueId('notif-fb-mus'),
      title: `⭐ Calificá la sala y hospitalidad en ${ev.venueName}`,
      message: `¿Cómo te trató el anfitrión en "${ev.title}"? Ya podés dejar tu reseña bilateral tras cumplirse las 2 horas post-show.`,
      timestamp: 'Recién',
      read: false,
      type: 'review',
      targetRole: 'musico',
      targetEntityId: s.assignedMusicianId,
    }));

    setNotifications((prev) => [
      ...attendeeNotifications,
      {
        id: makeUniqueId('notif-fb-bar'),
        title: '⭐ Calificá la actuación de los músicos',
        message: `El show "${ev.title}" terminó hace más de 2 horas. Evaluá el cumplimiento técnico y feedback del recital.`,
        timestamp: 'Recién',
        read: false,
        type: 'review',
        targetRole: 'bar',
        targetEntityId: ev.venueId,
      },
      ...musicianNotifications,
      ...prev,
    ]);

    sendPushNotification({
      title: `⭐ Calificá tu experiencia en ${ev.venueName}`,
      body: `El show finalizó hace 2 horas. Entrá para calificar al local y a los músicos con tu reseña 360°.`,
      url: reviewRef,
    });
  };

  // Auto-archivado de eventos pasados & chequeo periódico de feedback 2hs post-evento
  useEffect(() => {
    const runLifecycleMaintenance = () => {
      const now = Date.now();
      const { events: nextEvents, archivedEvents } = archivePastEvents(eventProposalsRef.current, now);
      if (archivedEvents.length > 0) {
        eventProposalsRef.current = nextEvents;
        setEventProposals(nextEvents);
        if (firebaseUser) {
          archivedEvents.forEach((archivedEv) => {
            syncEventProposalBarUpdate(
              archivedEv.id,
              {
                status: 'archivado',
                lastActionAt: archivedEv.lastActionAt,
                lastActionActor: archivedEv.lastActionActor,
                lastActionSummary: archivedEv.lastActionSummary,
              },
              archivedEv,
              firebaseUser.uid
            ).catch(() => {});
          });
        }
      }

      nextEvents.forEach((ev) => {
        const hasConfirmedMusician = ev.slots.some((s) => Boolean(s.assignedMusicianId));
        if (
          (ev.status === 'publicada' || ev.status === 'agotada' || ev.status === 'archivado') &&
          hasConfirmedMusician &&
          !ev.feedbackSentAt
        ) {
          const endDateTime = getEventEndTimestampMs(ev.date, ev.startTime, ev.endTime);
          if (Number.isFinite(endDateTime) && now >= endDateTime + REVIEW_UNLOCK_DELAY_MS) {
            triggerOneHourPostEventFeedback(ev.id);
          }
        }
      });
    };

    runLifecycleMaintenance();
    const interval = setInterval(runLifecycleMaintenance, 30000);
    return () => clearInterval(interval);
  }, [eventProposals, firebaseUser]);

  const logout = () => {
    clearActiveSession();
    setStoredUserName('');
  };

  return (
    <AppContext.Provider
      value={{
        role,
        setRole,
        activeMusicianId,
        setActiveMusicianId,
        activeVenueId,
        setActiveVenueId: selectActiveVenueId,
        activeBarAccountId: resolvedBarOwnerId,
        activePublicUserId,
        setActivePublicUserId,
        venues,
        ownedVenues,
        musicians,
        publicUsers,
        openCalls,
        musicianAvailabilities,
        liveShows,
        notifications: scopedNotifications,
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
        cancelEventProposal,
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
        loginTriggerCount,
        markUserLoggedIn,
        loginAsAccount,
        logout,
        firebaseUser,
        cloudSyncStatus,
        cloudSyncError,
        connectCloudWithGoogle,
        disconnectCloud,
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
