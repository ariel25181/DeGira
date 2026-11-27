import type {
  EventProposal,
  EventReview360,
  MusicianProfile,
  MusicianSlotBid,
  PublicEventReservation,
  PublicUserProfile,
  UserRole,
  VenueProfile,
} from '../types/index.ts';
import type { SentEmailRecord } from '../lib/emailService.ts';

export interface QaNotificationRecord {
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

export interface CohortConfig {
  barsCount: number;
  musiciansCount: number;
  spectatorsCount: number;
  includeNotificationsAndEmails: boolean;
  includeScheduleClashes: boolean;
  includePaymentsAndQr: boolean;
  baseDate: string; // YYYY-MM-DD
}

export type RecordedActionKind =
  | 'click'
  | 'input'
  | 'select'
  | 'submit'
  | 'role_switch'
  | 'tab_switch';

export interface CapturedNotificationSummary {
  id: string;
  title: string;
  message: string;
  type: QaNotificationRecord['type'];
  targetRole?: UserRole;
  targetEntityId?: string;
  targetEmail?: string;
}

export interface CapturedEmailSummary {
  id: string;
  to: string;
  fromEmail?: string;
  targetRole?: UserRole;
  targetEntityId?: string;
  senderRole?: UserRole;
  senderEntityId?: string;
  type: SentEmailRecord['type'];
  subject: string;
  bodyText: string;
  qrCodeUrl?: string;
}

export interface RecordedStep {
  id: string;
  index: number;
  timestamp: string;
  kind: RecordedActionKind;
  label: string;
  selector: string;
  fallbackSelectors: string[];
  tagName: string;
  inputType?: string;
  value?: string;
  checked?: boolean;
  role: UserRole;
  actorId: string;
  actorName: string;
  activeTab?: string;
  notificationsDelta: CapturedNotificationSummary[];
  emailsDelta: CapturedEmailSummary[];
}

export interface RecordedFlow {
  id: string;
  name: string;
  createdAt: string;
  startRole: UserRole;
  startActorId: string;
  startActorName: string;
  steps: RecordedStep[];
  allNotificationsDelta: CapturedNotificationSummary[];
  allEmailsDelta: CapturedEmailSummary[];
}

export type VariationKind =
  | 'actor_swap'
  | 'time_overlap_clash'
  | 'time_adjacent_clear'
  | 'cancelled_event_no_clash'
  | 'bar_isolation_guard'
  | 'notification_email_scoping';

export interface GeneratedTestCase {
  id: string;
  title: string;
  description: string;
  variationKind: VariationKind;
  actorRole: UserRole;
  actorId: string;
  actorName: string;
  targetDate?: string;
  targetTimeWindow?: string;
  targetCachetARS?: number;
  expectedOutcomes: string[];
  expectedNotificationsCount: number;
  expectedEmailsCount: number;
  steps: RecordedStep[];
}

export interface TestCheckItem {
  label: string;
  passed: boolean;
  detail: string;
}

export interface TestCaseExecutionResult {
  testCaseId: string;
  title: string;
  variationKind: VariationKind;
  actorName: string;
  status: 'passed' | 'failed';
  durationMs: number;
  checks: TestCheckItem[];
  notificationsEmitted: CapturedNotificationSummary[];
  emailsEmitted: CapturedEmailSummary[];
  leakCount: number;
  errorMessage?: string;
}

export interface SimulatedActorInboxSummary {
  role: UserRole;
  id: string;
  displayName: string;
  email: string;
  notificationsCount: number;
  unreadNotificationsCount: number;
  emailsCount: number;
  leakedNotificationsCount: number;
  leakedEmailsCount: number;
}

export interface CohortSimulationArtifacts {
  venues: VenueProfile[];
  musicians: MusicianProfile[];
  publicUsers: PublicUserProfile[];
  eventProposals: EventProposal[];
  slotBids: MusicianSlotBid[];
  publicEventReservations: PublicEventReservation[];
  reviews360: EventReview360[];
  notifications: QaNotificationRecord[];
  emails: SentEmailRecord[];
}

export interface CohortSimulationReport {
  id: string;
  createdAt: string;
  config: CohortConfig;
  totalActors: number;
  venuesCount: number;
  eventsCreated: number;
  publishedEvents: number;
  slotsTotal: number;
  bidsSubmitted: number;
  clashesDetected: number;
  reservationsCreated: number;
  reservationsConfirmed: number;
  reservationsExpired: number;
  reviewsSubmitted: number;
  notifications: QaNotificationRecord[];
  emails: SentEmailRecord[];
  actorSummaries: SimulatedActorInboxSummary[];
  venueIsolationLeaks: number;
  notificationLeaks: number;
  emailLeaks: number;
  assertions: TestCheckItem[];
  artifacts: CohortSimulationArtifacts;
}

export interface QaStateSnapshot {
  capturedAt: string;
  role: UserRole;
  activeBarAccountId: string;
  activeVenueId: string;
  activeMusicianId: string;
  activePublicUserId: string;
  userDisplayName: string;
  venues: VenueProfile[];
  musicians: MusicianProfile[];
  publicUsers: PublicUserProfile[];
  eventProposals: EventProposal[];
  slotBids: MusicianSlotBid[];
  publicEventReservations: PublicEventReservation[];
  reviews360: EventReview360[];
  notifications: QaNotificationRecord[];
  emails: SentEmailRecord[];
}

export interface QaAppBridge {
  role: UserRole;
  activeBarAccountId: string;
  activeVenueId: string;
  activeMusicianId: string;
  activePublicUserId: string;
  userDisplayName: string;
  venues: VenueProfile[];
  musicians: MusicianProfile[];
  publicUsers: PublicUserProfile[];
  eventProposals: EventProposal[];
  slotBids: MusicianSlotBid[];
  publicEventReservations: PublicEventReservation[];
  reviews360: EventReview360[];
  rawNotifications: QaNotificationRecord[];
  switchActor: (params: {
    role: UserRole;
    entityId: string;
    displayName: string;
    email?: string;
  }) => void;
  setQaSandboxActive: (active: boolean) => void;
  isQaSandboxActive: boolean;
  loadQaCohortIntoState: (artifacts: CohortSimulationArtifacts) => void;
  captureSnapshot: () => QaStateSnapshot;
  restoreSnapshot: (snapshot: QaStateSnapshot) => void;
}
