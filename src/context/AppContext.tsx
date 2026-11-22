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
  applySlotAcceptToProposal,
  applySlotReleaseToProposal,
  isActiveSlotBid,
  applyBidSubmissionTransition,
  applyBidResponseTransition,
  applyBidRetractionTransition,
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
  }) => { ok: boolean; message?: string };
  updateMusicianMusicLinks: (musicianId: string, links: MusicianMusicLinks, inputList?: MusicianInputChannel[]) => void;
  sendMusicianProposalReminder: (bidId: string) => { success: boolean; message: string };
  retractMusicianSlotBid: (bidId: string) => { success: boolean; message: string };
  respondToSlotBid: (
    bidId: string,
    action: 'accept' | 'reject' | 'counter',
    counterCachet?: number,
    note?: string
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
    if (saved && !hasLegacyString(saved)) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
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
                setVenues((prev) => mergeByIdWithCloudPriority(prev, cloudVenues));
              },
              onEventProposals: (cloudEvents) => {
                setEventProposals((prev) => mergeByIdWithCloudPriority(prev, cloudEvents));
                setCloudSyncStatus('connected');
              },
              onSlotBids: (cloudBids) => {
                setSlotBids((prev) => mergeByIdWithCloudPriority(prev, cloudBids));
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
    const barTag = data.venueId === 'venue-2' ? 'BAR2' : data.venueId === 'venue-1' ? 'BAR1' : 'BAR';
    const newProposal: EventProposal = {
      ...data,
      id: makeUniqueId('ev'),
      eventCode: `DG-${barTag}-${codeNumber}`,
      remainingCapacity: data.totalCapacity,
      status: data.status || 'propuesta',
      createdAt: new Date().toISOString(),
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
    const nextEvents = eventProposalsRef.current.map((ev) =>
      ev.id === id ? { ...ev, ...updates } : ev
    );
    eventProposalsRef.current = nextEvents;
    setEventProposals(nextEvents);
    if (firebaseUser && target) {
      syncEventProposalBarUpdate(
        id,
        {
          ...(updates.slots ? { slots: updates.slots } : {}),
          ...(updates.status ? { status: updates.status } : {}),
          ...(updates.remainingCapacity !== undefined ? { remainingCapacity: updates.remainingCapacity } : {}),
          ...(updates.cachetPaid !== undefined ? { cachetPaid: updates.cachetPaid } : {}),
          ...(updates.cachetPaidAt !== undefined ? { cachetPaidAt: updates.cachetPaidAt } : {}),
          ...(updates.feedbackSentAt !== undefined ? { feedbackSentAt: updates.feedbackSentAt } : {}),
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
    const hasConfirmedSlot = target.slots.some(
      (s) => s.status === 'confirmado' || Boolean(s.assignedMusicianId)
    );
    if (!hasConfirmedSlot) return;
    const nextEvents = eventProposalsRef.current.map((ev) => {
        if (ev.id === id) {
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
      });
    eventProposalsRef.current = nextEvents;
    setEventProposals(nextEvents);

    if (firebaseUser && target) {
      syncEventProposalBarUpdate(
        id,
        { status: 'publicada' },
        target,
        firebaseUser.uid
      ).catch(() => setCloudSyncStatus('error'));
    }

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
      },
      ...prev,
    ]);
  };

  const liquidateMusicianCachet = (proposalId: string) => {
    const target = eventProposalsRef.current.find((ev) => ev.id === proposalId);
    const cachetPaidAt = new Date().toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
    setEventProposals((prev) =>
      prev.map((ev) =>
        ev.id === proposalId
          ? {
              ...ev,
              cachetPaid: true,
              cachetPaidAt,
            }
          : ev
      )
    );
    if (firebaseUser && target) {
      syncEventProposalBarUpdate(
        proposalId,
        { cachetPaid: true, cachetPaidAt },
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
  }): { ok: boolean; message?: string } => {
    const mus = currentMusician || musicians[0];
    const targetEvent = eventProposalsRef.current.find((e) => e.id === data.eventId);
    const targetSlot = targetEvent?.slots.find((s) => s.id === data.slotId);

    const newBid: MusicianSlotBid = {
      id: makeUniqueId('bid'),
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
          id: makeUniqueId('h'),
          actor: 'musico',
          actorName: mus.stageName,
          cachetARS: data.proposedCachetARS,
          note: data.initialNote || 'Postulación enviada con propuesta de caché y equipamiento.',
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
      syncSlotBidCreate(newBid, targetEvent, firebaseUser.uid)
        .then(() => {
          return syncEventProposalSlotsAndStatus(transition.updatedEvent, firebaseUser.uid);
        })
        .catch(() => setCloudSyncStatus('error'));
    }

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
        id: makeUniqueId('notif-mus'),
        title: '🎵 Propuesta enviada al bar',
        message: `Tu propuesta para "${targetEvent?.title || 'el evento'}" fue enviada a ${targetEvent?.venueName || 'el bar'}.`,
        timestamp: 'Recién',
        read: false,
        type: 'application',
      },
      {
        id: makeUniqueId('notif-bar'),
        title: '🎸 Nueva Postulación de Músico',
        message: `${mus.stageName} envió una propuesta con caché de $${data.proposedCachetARS.toLocaleString('es-AR')} para "${targetEvent?.title || 'tu fecha'}".`,
        timestamp: 'Recién',
        read: false,
        type: 'application',
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
      },
      {
        id: makeUniqueId('notif-bar'),
        title: '🔔 Recordatorio de Propuesta Recibida',
        message: `${bid.musicianName} te envió un recordatorio sobre su propuesta pendiente para "${event?.title || 'tu fecha'}".`,
        timestamp: 'Recién',
        read: false,
        type: 'application',
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
      },
      {
        id: makeUniqueId('notif-bar-retract'),
        title: '↩️ Un músico se retractó del horario',
        message: `${transition.updatedBid.musicianName} se retractó de su horario para "${transition.event.title}" (más de 24hs de anticipación). El slot quedó libre para recibir nuevas propuestas.`,
        timestamp: 'Recién',
        read: false,
        type: 'application',
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
    note?: string
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
      note,
    });

    if (!transition.ok) {
      return { ok: false, message: transition.message };
    }

    const { updatedBid, updatedEvent, event } = transition;
    const newProposedCachet = updatedBid.proposedCachetARS;

    slotBidsRef.current = transition.slotBids;
    setSlotBids(transition.slotBids);

    if (updatedEvent) {
      eventProposalsRef.current = transition.eventProposals;
      setEventProposals(transition.eventProposals);
    }

    if (action === 'accept') {
      sendPushNotification({
        title: '🎸 ¡Propuesta de Fecha Aceptada!',
        body: `${event.venueName} aceptó el acuerdo para el show "${event.title}".`,
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
        body: `${role === 'bar' ? event.venueName : updatedBid.musicianName} propuso $${newProposedCachet.toLocaleString('es-AR')}.`,
        targetRole: role === 'bar' ? 'musico' : 'bar',
        url: '/#acuerdos',
      });
    }

    if (firebaseUser) {
      const syncPromise =
        role === 'bar'
          ? syncSlotBidBarResponse(updatedBid, event, firebaseUser.uid)
          : syncSlotBidMusicianUpdate(updatedBid, event, firebaseUser.uid);

      syncPromise
        .then(() => {
          if (updatedEvent) {
            return role === 'bar'
              ? syncEventProposalBarUpdate(
                  updatedEvent.id,
                  { slots: updatedEvent.slots, status: updatedEvent.status },
                  updatedEvent,
                  firebaseUser.uid
                )
              : syncEventProposalSlotsAndStatus(updatedEvent, firebaseUser.uid);
          }
        })
        .catch(() => setCloudSyncStatus('error'));
    }

    const musEmail = updatedBid.musicianId === 'mus-1' ? 'musico1@degira.com.ar' : 'musico2@degira.com.ar';
    sendNegotiationUpdateEmailToMusician({
      musicianEmail: musEmail,
      musicianName: updatedBid.musicianName,
      venueName: event.venueName,
      eventTitle: event.title,
      action,
      newCachetARS: newProposedCachet,
      note,
    });

    setNotifications((prev) => [
      {
        id: makeUniqueId('notif-neg'),
        title:
          action === 'accept'
            ? '🎉 Propuesta de Fecha Aceptada'
            : action === 'counter'
            ? '💬 Contraoferta de Caché Registrada'
            : '🔓 Horario Liberado tras Rechazo',
        message:
          action === 'accept'
            ? `${updatedBid.musicianName} y ${event.venueName} confirmaron su acuerdo para "${event.title}".`
            : action === 'counter'
            ? `Se propuso un nuevo caché de $${newProposedCachet.toLocaleString('es-AR')} para "${event.title}".`
            : `La propuesta de ${updatedBid.musicianName} para "${event.title}" fue rechazada y el horario volvió a abrirse libre.`,
        timestamp: 'Recién',
        read: false,
        type: action === 'accept' ? 'confirmed' : 'application',
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
    const hasConfirmedSlot = target.slots.some(
      (s) => s.status === 'confirmado' || Boolean(s.assignedMusicianId)
    );
    if (!hasConfirmedSlot) return;

    const nextEvents = eventProposalsRef.current.map((ev) => {
        if (ev.id === proposalId) {
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
      });
    eventProposalsRef.current = nextEvents;
    setEventProposals(nextEvents);

    if (firebaseUser) {
      syncEventProposalBarUpdate(
        proposalId,
        { status: 'publicada' },
        target,
        firebaseUser.uid
      ).catch(() => setCloudSyncStatus('error'));
    }

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

    if (firebaseUser && updatedResForCloud) {
      syncReservationSpectatorUpdate(updatedResForCloud).catch(() =>
        setCloudSyncStatus('error')
      );
    }

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
    });

    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}`,
        title: '🎟️ Pago Confirmado & Pase QR Emitido',
        message: `El bar confirmó el pago de ${targetRes.userName} (${targetRes.partySize} ${targetRes.partySize === 1 ? 'persona' : 'personas'}) y se descontó el cupo del evento.`,
        timestamp: 'Recién',
        read: false,
        type: 'confirmed',
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
    setLoginTriggerCount((c) => c + 1);
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
        message: `Ya pasaron 2 horas desde que finalizó "${ev.title}". Calificá al bar y a los músicos (${reviewRef}).`,
        timestamp: 'Recién',
        read: false,
        type: 'review',
      },
      {
        id: `notif-fb-${Date.now()}-bar`,
        title: '⭐ Calificá la actuación de los músicos',
        message: `El show "${ev.title}" terminó hace más de 2 horas. Evaluá el cumplimiento técnico y feedback del recital.`,
        timestamp: 'Recién',
        read: false,
        type: 'review',
      },
      {
        id: `notif-fb-${Date.now()}-mus`,
        title: `⭐ Calificá la sala y hospitalidad en ${ev.venueName}`,
        message: `¿Cómo te trató el anfitrión en "${ev.title}"? Ya podés dejar tu reseña bilateral tras cumplirse las 2 horas post-show.`,
        timestamp: 'Recién',
        read: false,
        type: 'review',
      },
      ...prev,
    ]);

    sendPushNotification({
      title: `⭐ Calificá tu experiencia en ${ev.venueName}`,
      body: `El show finalizó hace 2 horas. Entrá para calificar al local y a los músicos con tu reseña 360°.`,
      url: reviewRef,
    });
  };

  // Chequeo periódico de feedback estrictamente 2hs post-evento
  useEffect(() => {
    const checkFeedbackEligibility = () => {
      const now = Date.now();
      eventProposals.forEach((ev) => {
        if ((ev.status === 'publicada' || ev.status === 'agotada') && !ev.feedbackSentAt) {
          const endDateTime = getEventEndTimestampMs(ev.date, ev.startTime, ev.endTime);
          if (Number.isFinite(endDateTime) && now >= endDateTime + REVIEW_UNLOCK_DELAY_MS) {
            triggerOneHourPostEventFeedback(ev.id);
          }
        }
      });
    };

    checkFeedbackEligibility();
    const interval = setInterval(checkFeedbackEligibility, 30000);
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
