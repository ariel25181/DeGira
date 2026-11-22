import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext.tsx';
import { Header } from './components/Header.tsx';
import { BottomNav } from './components/BottomNav.tsx';
import { CatalogView } from './components/CatalogView.tsx';
import { OpenCallsView } from './components/OpenCallsView.tsx';
import { MusicianAvailabilityView } from './components/MusicianAvailabilityView.tsx';
import { AgreementsAndReviewsView } from './components/AgreementsAndReviewsView.tsx';
import { ProfileView } from './components/ProfileView.tsx';

// Modals
import { ApplyModal } from './components/modals/ApplyModal.tsx';
import { PublishOpenCallModal } from './components/modals/PublishOpenCallModal.tsx';
import { PublishAvailabilityModal } from './components/modals/PublishAvailabilityModal.tsx';
import { DirectOfferModal } from './components/modals/DirectOfferModal.tsx';
import { ShowDetailModal } from './components/modals/ShowDetailModal.tsx';
import { ReviewModal } from './components/modals/ReviewModal.tsx';
import { Review360Modal } from './components/modals/Review360Modal.tsx';
import { PendingReviewsReminderModal } from './components/modals/PendingReviewsReminderModal.tsx';
import { NotificationsDrawer } from './components/modals/NotificationsDrawer.tsx';
import { ShareModal } from './components/modals/ShareModal.tsx';
import { FeedbackModal } from './components/modals/FeedbackModal.tsx';
import { GitHubPushModal } from './components/modals/GitHubPushModal.tsx';
import { PWAInstallBanner, PWAInstallGuideModal } from './components/PWAInstallBanner.tsx';
import { SessionProvider, useSession } from './context/SessionContext.tsx';

import { VenueOpenCall, MusicianAvailability, LiveShowConfirmed, UserRole, EventProposal } from './types/index.ts';
import { Wifi, Battery, Signal, Sparkles, LayoutGrid, HelpCircle, RefreshCw, Share2, Wrench, LogOut, Star, Clock, Cloud, CloudOff, Loader2 } from 'lucide-react';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { OnboardingFlow } from './components/flow/OnboardingFlow.tsx';
import { RoleIconMenuModal, ROLE_ACTIVITIES } from './components/flow/RoleActivityNav.tsx';
import { getActiveSession } from './lib/degiraSession.ts';
import { getPendingReviewsForRole, PendingReviewItem } from './utils/reviewEligibility.ts';

function MainApp() {
  const {
    role,
    setRole,
    activeMusicianId,
    activeVenueId,
    activePublicUserId,
    currentMusician,
    currentVenue,
    userDisplayName,
    setUserDisplayName,
    logout,
    eventProposals,
    liveShows,
    publicEventReservations,
    reservations,
    reviews360,
    loginTriggerCount,
    firebaseUser,
    cloudSyncStatus,
    cloudSyncError,
    connectCloudWithGoogle,
    disconnectCloud,
  } = useApp();
  const { signOut } = useSession();

  // Navigation tab
  const [activeTab, setActiveTab] = useState<string>(() => {
    return role === 'espectador' ? 'cartelera' : 'convocatorias';
  });

  // Strict role-tab isolation guard
  useEffect(() => {
    if (role === 'espectador') {
      if (activeTab !== 'cartelera' && activeTab !== 'perfil') {
        setActiveTab('cartelera');
      }
    } else if (role === 'musico') {
      if (activeTab !== 'convocatorias' && activeTab !== 'acuerdos' && activeTab !== 'perfil') {
        setActiveTab('convocatorias');
      }
    } else if (role === 'bar') {
      if (activeTab !== 'convocatorias' && activeTab !== 'acuerdos' && activeTab !== 'perfil') {
        setActiveTab('convocatorias');
      }
    }
  }, [role, activeTab]);

  // Onboarding flow state: siempre pide perfil primero si no hay sesión activa de 24hs
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(() => {
    try {
      const activeSession = getActiveSession();
      if (!activeSession) return true;
      return false;
    } catch {
      return true;
    }
  });
  const [isTourOnly, setIsTourOnly] = useState<boolean>(false);

  // Icon menu modal state
  const [isIconMenuOpen, setIsIconMenuOpen] = useState<boolean>(false);

  // Share, Feedback and PWA Install modal states
  const [isShareOpen, setIsShareOpen] = useState<boolean>(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState<boolean>(false);
  const [isInstallGuideOpen, setIsInstallGuideOpen] = useState<boolean>(false);
  const [isGithubPushOpen, setIsGithubPushOpen] = useState<boolean>(false);
  const [githubPushStatus, setGithubPushStatus] = useState<{
    enabled: boolean;
    hasEnvToken: boolean;
    repo: string;
    branch: string;
  }>({
    enabled: false,
    hasEnvToken: false,
    repo: 'ariel25181/DeGira',
    branch: 'main',
  });

  useEffect(() => {
    let active = true;
    const checkStatus = async () => {
      try {
        if (typeof window === 'undefined' || typeof fetch !== 'function') return;
        const res = await fetch('/api/dev/github-push/status');
        if (!res.ok) return;
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) return;
        const data = await res.json();
        if (active && data?.enabled === true) {
          setGithubPushStatus({
            enabled: true,
            hasEnvToken: Boolean(data.hasEnvToken),
            repo: typeof data.repo === 'string' ? data.repo : 'ariel25181/DeGira',
            branch: typeof data.branch === 'string' ? data.branch : 'main',
          });
        }
      } catch {
        // Static production builds (e.g. GitHub Pages) have no dev API endpoint
      }
    };
    void checkStatus();
    return () => {
      active = false;
    };
  }, []);

  // Mobile frame simulator toggle
  const [isMobileFrame, setIsMobileFrame] = useState<boolean>(false);

  // Modals state
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [selectedCallForApply, setSelectedCallForApply] = useState<VenueOpenCall | null>(null);

  const [isPublishCallModalOpen, setIsPublishCallModalOpen] = useState(false);
  const [isPublishAvailModalOpen, setIsPublishAvailModalOpen] = useState(false);

  const [isDirectOfferModalOpen, setIsDirectOfferModalOpen] = useState(false);
  const [selectedAvailForOffer, setSelectedAvailForOffer] = useState<MusicianAvailability | null>(null);

  const [isShowDetailModalOpen, setIsShowDetailModalOpen] = useState(false);
  const [selectedShow, setSelectedShow] = useState<LiveShowConfirmed | null>(null);

  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewModalParams, setReviewModalParams] = useState<{
    targetType: 'musician' | 'venue';
    targetId: string;
    targetName: string;
    showDate: string;
    showVenueName: string;
    showIdToComplete?: string;
    showStartTime?: string;
    showEndTime?: string;
  }>({
    targetType: 'venue',
    targetId: '',
    targetName: '',
    showDate: '',
    showVenueName: '',
  });

  // Review 360 Post-Event State (habilitado estrictamente 2hs post-evento)
  const [isReview360Open, setIsReview360Open] = useState(false);
  const [review360Event, setReview360Event] = useState<EventProposal | null>(null);

  const pendingReviewsSummary = getPendingReviewsForRole({
    role,
    activeVenueId,
    activeMusicianId,
    activePublicUserId,
    eventProposals,
    liveShows,
    publicEventReservations,
    reviews360,
    spectatorReservations: reservations,
  });

  const primaryAvailableReview = pendingReviewsSummary.availableNow[0] || null;
  const primaryWaitingReview = pendingReviewsSummary.waitingWindow[0] || null;

  // Recordatorio automático en pantalla al loguearse con calificaciones pendientes detalladas
  const [isPendingReviewsReminderOpen, setIsPendingReviewsReminderOpen] = useState(false);
  const [pendingLoginReminderCheck, setPendingLoginReminderCheck] = useState<boolean>(() => !isOnboardingOpen);

  useEffect(() => {
    if (!isOnboardingOpen && loginTriggerCount > 0) {
      setPendingLoginReminderCheck(true);
    }
  }, [loginTriggerCount, isOnboardingOpen]);

  useEffect(() => {
    if (!isOnboardingOpen && pendingLoginReminderCheck) {
      setPendingLoginReminderCheck(false);
      if (pendingReviewsSummary.allEndedPending.length > 0) {
        setIsPendingReviewsReminderOpen(true);
      }
    }
  }, [isOnboardingOpen, pendingLoginReminderCheck, pendingReviewsSummary.allEndedPending.length]);

  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  // Specific profile viewing target (when clicking from catalog/calls)
  const [viewingTarget, setViewingTarget] = useState<{
    type: 'musician' | 'venue';
    id: string;
  } | null>(null);

  const handleOpenApplyModal = (call: VenueOpenCall) => {
    setSelectedCallForApply(call);
    setIsApplyModalOpen(true);
  };

  const handleOpenDirectOfferModal = (avail: MusicianAvailability) => {
    setSelectedAvailForOffer(avail);
    setIsDirectOfferModalOpen(true);
  };

  const handleSelectShow = (show: LiveShowConfirmed) => {
    setSelectedShow(show);
    setIsShowDetailModalOpen(true);
  };

  const handleOpenReviewModal = (params: typeof reviewModalParams) => {
    setIsIconMenuOpen(false);
    setReviewModalParams(params);
    setIsReviewModalOpen(true);
  };

  const handleOpenReview360 = (event: EventProposal) => {
    setIsIconMenuOpen(false);
    setReview360Event(event);
    setIsReview360Open(true);
  };

  const handleRatePendingItem = (item: PendingReviewItem) => {
    if (!item.availability.isAvailable) return;
    setIsPendingReviewsReminderOpen(false);
    setIsIconMenuOpen(false);
    if (item.eventProposal) {
      setIsReviewModalOpen(false);
      setReview360Event(item.eventProposal);
      setIsReview360Open(true);
    } else if (item.reviewModalParams) {
      setIsReview360Open(false);
      setReviewModalParams(item.reviewModalParams);
      setIsReviewModalOpen(true);
    }
  };

  const remainingForReview360 = review360Event
    ? pendingReviewsSummary.availableNow.filter((item) => item.eventId !== review360Event.id)
    : pendingReviewsSummary.availableNow;

  const remainingForReviewModal = reviewModalParams.showIdToComplete
    ? pendingReviewsSummary.availableNow.filter((item) => item.eventId !== reviewModalParams.showIdToComplete)
    : pendingReviewsSummary.availableNow;

  const handleOpenAllPendingFromReview = () => {
    setIsReview360Open(false);
    setIsReviewModalOpen(false);
    setIsPendingReviewsReminderOpen(true);
  };

  const handleViewVenueProfile = (venueId: string) => {
    setViewingTarget({ type: 'venue', id: venueId });
    setActiveTab('perfil');
  };

  const handleViewMusicianProfile = (musicianId: string) => {
    setViewingTarget({ type: 'musician', id: musicianId });
    setActiveTab('perfil');
  };

  const handleClearViewingTarget = () => {
    setViewingTarget(null);
  };

  const handleOnboardingComplete = (chosenRole: UserRole) => {
    const wasTourOnly = isTourOnly;
    setRole(chosenRole);
    setIsOnboardingOpen(false);
    setIsTourOnly(false);
    const defaultTab = chosenRole === 'espectador' ? 'cartelera' : 'convocatorias';
    setActiveTab(defaultTab);
    // Open the icon menu after the tour so the user sees the role options!
    setIsIconMenuOpen(true);
    if (!wasTourOnly) {
      setPendingLoginReminderCheck(true);
    }
  };

  const handleRestartTour = () => {
    setIsTourOnly(true);
    setIsOnboardingOpen(true);
  };

  const handleRestartOnboarding = () => {
    setIsTourOnly(false);
    setIsOnboardingOpen(true);
  };

  const handleSignOut = async () => {
    setIsPendingReviewsReminderOpen(false);
    try {
      await signOut();
    } catch {}
    try {
      localStorage.removeItem('suenaba:logged_user_name');
      localStorage.removeItem('suenaba:onboarding_completed:v1');
    } catch {}
    setUserDisplayName('Usuario Público 1');
    setRole('espectador');
    setIsTourOnly(false);
    setIsOnboardingOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-start items-center p-0 md:p-4 selection:bg-amber-500 selection:text-slate-950 font-sans">
      {/* Device frame container or responsive container */}
      <div
        className={`w-full transition-all duration-300 flex flex-col min-h-screen ${
          isMobileFrame
            ? 'max-w-[420px] rounded-[44px] border-[10px] border-slate-800 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] overflow-hidden my-auto'
            : 'max-w-xl sm:border sm:border-slate-800/80 sm:rounded-3xl sm:my-3 sm:shadow-2xl'
        } bg-slate-950`}
      >
        {/* Simulated Mobile Status Bar (Visible in frame mode or at top) */}
        {isMobileFrame && (
          <div className="px-6 pt-3 pb-1 flex items-center justify-between text-xs text-slate-400 bg-slate-950 z-50 select-none">
            <span className="font-semibold text-slate-200">21:42</span>
            {/* Dynamic Island / Speaker notch */}
            <div className="w-24 h-4 bg-slate-900 rounded-full border border-slate-800" />
            <div className="flex items-center space-x-1.5">
              <Signal className="w-3.5 h-3.5" />
              <Wifi className="w-3.5 h-3.5" />
              <Battery className="w-4 h-4 text-emerald-400" />
            </div>
          </div>
        )}

        {/* Global Sticky Header with Role Switcher & Icon Menu trigger */}
        <Header
          isMobileFrame={isMobileFrame}
          setIsMobileFrame={setIsMobileFrame}
          onOpenNotifications={() => setIsNotificationsOpen(true)}
          onSelectTab={setActiveTab}
          onOpenIconMenu={() => setIsIconMenuOpen(true)}
          onRestartTour={handleRestartTour}
          onChangeRole={handleRestartOnboarding}
          onOpenShare={() => setIsShareOpen(true)}
          onOpenFeedback={() => setIsFeedbackOpen(true)}
          onOpenInstall={() => setIsInstallGuideOpen(true)}
          onSignOut={handleSignOut}
          onOpenGithubPush={githubPushStatus.enabled ? () => setIsGithubPushOpen(true) : undefined}
        />

        {/* PWA In-App Install Prompt Banner */}
        <PWAInstallBanner onOpenGuide={() => setIsInstallGuideOpen(true)} />

        {/* Current Active User Greeting & Account Status */}
        <div className="bg-slate-900/90 border-b border-slate-800/80 px-4 py-2 flex items-center justify-between text-xs text-slate-400 gap-2">
          <div className="flex items-center space-x-2 truncate">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="text-amber-400 font-bold shrink-0">Bienvenido,</span>
            <strong className="text-slate-100 font-black truncate max-w-[160px] sm:max-w-[280px]">
              {userDisplayName}
            </strong>
            <span className="text-slate-600 hidden xs:inline">•</span>
            <span className="hidden xs:inline text-slate-400 text-[11px] uppercase font-semibold">
              {role === 'musico'
                ? 'Perfil Músico'
                : role === 'bar'
                ? 'Perfil Bar'
                : 'Público General'}
            </span>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 hover:text-red-300 font-bold text-xs transition-colors"
              title="Cerrar sesión o cambiar de cuenta de prueba"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Cambiar Cuenta</span>
            </button>
          </div>
        </div>

        {/* Cloud Sync Banner (Sincronización compartida entre dispositivos) */}
        <div
          data-testid="cloud-sync-bar"
          className={`border-b px-3.5 py-1.5 flex items-center justify-between gap-2 text-[11px] ${
            cloudSyncStatus === 'connected' && firebaseUser
              ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200'
              : cloudSyncStatus === 'error'
              ? 'bg-rose-950/30 border-rose-500/35 text-rose-200'
              : 'bg-slate-900/80 border-slate-800/80 text-slate-300'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {cloudSyncStatus === 'syncing' ? (
              <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin shrink-0" />
            ) : cloudSyncStatus === 'connected' && firebaseUser ? (
              <Cloud className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            ) : (
              <CloudOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            )}
            <span className="truncate">
              {cloudSyncStatus === 'syncing'
                ? 'Sincronizando nube compartida…'
                : cloudSyncStatus === 'connected' && firebaseUser
                ? `Nube sincronizada • ${firebaseUser.email || 'Google'}`
                : cloudSyncStatus === 'error' && cloudSyncError
                ? cloudSyncError
                : 'Modo local • Conectá Google para ver eventos entre celulares'}
            </span>
          </div>

          <div className="shrink-0">
            {firebaseUser ? (
              <button
                type="button"
                onClick={() => void disconnectCloud()}
                className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-[10px] transition-colors"
              >
                Desconectar
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void connectCloudWithGoogle()}
                disabled={cloudSyncStatus === 'syncing'}
                className="px-2.5 py-0.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-[10px] transition-colors disabled:opacity-50"
              >
                Conectar Nube (Google)
              </button>
            )}
          </div>
        </div>

        {/* Post-Event 360 Rating Banner (habilitado estrictamente 2hs post-evento) */}
        {primaryAvailableReview ? (
          <div className="bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-slate-900 border-b border-amber-500/40 px-3.5 py-2 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <Star className="w-4 h-4 text-amber-400 fill-amber-400 shrink-0" />
              <span className="text-slate-200 truncate text-[11px]">
                Show finalizado (+2 hs): <strong className="text-amber-400">{primaryAvailableReview.title}</strong>. ¡Dejá tu calificación 360°!
              </span>
            </div>
            <button
              onClick={() => handleRatePendingItem(primaryAvailableReview)}
              className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px] shrink-0 shadow-sm transition-all"
            >
              Calificar
            </button>
          </div>
        ) : primaryWaitingReview ? (
          <div className="bg-slate-900/95 border-b border-cyan-500/30 px-3.5 py-2 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <Clock className="w-4 h-4 text-cyan-400 shrink-0" />
              <span className="text-slate-300 truncate text-[11px]">
                Show finalizado: <strong className="text-cyan-300">{primaryWaitingReview.title}</strong> • {primaryWaitingReview.availability.waitLabel}
              </span>
            </div>
            <span className="px-2 py-0.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-bold text-[10px] shrink-0">
              Espera 2 hs
            </span>
          </div>
        ) : null}

        {/* Main Tab Content View */}
        <main className="flex-1 p-4 pb-20 overflow-y-auto">
          {activeTab === 'cartelera' && (
            <CatalogView
              onSelectShow={handleSelectShow}
              onViewVenue={handleViewVenueProfile}
              onViewMusician={handleViewMusicianProfile}
            />
          )}

          {activeTab === 'convocatorias' && (
            <OpenCallsView
              onOpenPublishModal={() => setIsPublishCallModalOpen(true)}
              onOpenApplyModal={handleOpenApplyModal}
              onViewVenue={handleViewVenueProfile}
              onViewMusician={handleViewMusicianProfile}
            />
          )}

          {activeTab === 'disponibilidad' && (
            <MusicianAvailabilityView
              onOpenPublishModal={() => setIsPublishAvailModalOpen(true)}
              onOpenDirectOfferModal={handleOpenDirectOfferModal}
              onViewMusician={handleViewMusicianProfile}
              onViewVenue={handleViewVenueProfile}
            />
          )}

          {activeTab === 'acuerdos' && (
            <AgreementsAndReviewsView
              onOpenReviewModal={handleOpenReviewModal}
              onOpenReview360={handleOpenReview360}
              onViewVenue={handleViewVenueProfile}
              onViewMusician={handleViewMusicianProfile}
            />
          )}

          {activeTab === 'perfil' && (
            <ProfileView
              viewingTarget={viewingTarget}
              onClearTarget={handleClearViewingTarget}
              onOpenReviewModal={handleOpenReviewModal}
              onOpenReview360={handleOpenReview360}
              onSelectTab={setActiveTab}
              onSignOut={handleSignOut}
            />
          )}
        </main>

        {/* Fixed Mobile Bottom Navigation */}
        <BottomNav activeTab={activeTab} onSelectTab={(tab) => {
          setActiveTab(tab);
          if (tab !== 'perfil') {
            setViewingTarget(null);
          }
        }} />
      </div>

      {/* Modals */}
      <ApplyModal
        isOpen={isApplyModalOpen}
        onClose={() => setIsApplyModalOpen(false)}
        openCall={selectedCallForApply}
      />

      <PublishOpenCallModal
        isOpen={isPublishCallModalOpen}
        onClose={() => setIsPublishCallModalOpen(false)}
      />

      <PublishAvailabilityModal
        isOpen={isPublishAvailModalOpen}
        onClose={() => setIsPublishAvailModalOpen(false)}
      />

      <DirectOfferModal
        isOpen={isDirectOfferModalOpen}
        onClose={() => setIsDirectOfferModalOpen(false)}
        availability={selectedAvailForOffer}
      />

      <ShowDetailModal
        isOpen={isShowDetailModalOpen}
        onClose={() => setIsShowDetailModalOpen(false)}
        show={selectedShow}
        onViewVenueProfile={handleViewVenueProfile}
        onViewMusicianProfile={handleViewMusicianProfile}
        onNavigateToProfile={() => {
          setIsShowDetailModalOpen(false);
          setActiveTab('perfil');
          setViewingTarget(null);
        }}
      />

      <ReviewModal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        targetType={reviewModalParams.targetType}
        targetId={reviewModalParams.targetId}
        targetName={reviewModalParams.targetName}
        showDate={reviewModalParams.showDate}
        showVenueName={reviewModalParams.showVenueName}
        showIdToComplete={reviewModalParams.showIdToComplete}
        showStartTime={reviewModalParams.showStartTime}
        showEndTime={reviewModalParams.showEndTime}
        remainingPendingCount={remainingForReviewModal.length}
        nextPendingItem={remainingForReviewModal[0] || null}
        onContinueNext={handleRatePendingItem}
        onOpenAllPending={handleOpenAllPendingFromReview}
      />

      <Review360Modal
        isOpen={isReview360Open}
        onClose={() => setIsReview360Open(false)}
        event={review360Event}
        remainingPendingCount={remainingForReview360.length}
        nextPendingItem={remainingForReview360[0] || null}
        onContinueNext={handleRatePendingItem}
        onOpenAllPending={handleOpenAllPendingFromReview}
      />

      <PendingReviewsReminderModal
        isOpen={!isOnboardingOpen && isPendingReviewsReminderOpen}
        onClose={() => setIsPendingReviewsReminderOpen(false)}
        role={role}
        userDisplayName={userDisplayName}
        availableNow={pendingReviewsSummary.availableNow}
        waitingWindow={pendingReviewsSummary.waitingWindow}
        onRateItem={handleRatePendingItem}
        onGoToPendingTab={() => {
          setIsIconMenuOpen(false);
          setActiveTab(role === 'espectador' ? 'perfil' : 'acuerdos');
        }}
      />

      <NotificationsDrawer
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        onNavigateToTab={setActiveTab}
      />

      {/* Role Icon Menu Modal (Dashboard of options for the role) */}
      <RoleIconMenuModal
        isOpen={isIconMenuOpen}
        onClose={() => setIsIconMenuOpen(false)}
        role={role}
        activeTab={activeTab}
        onSelectTab={(tabId) => {
          setActiveTab(tabId);
          setViewingTarget(null);
        }}
        onRestartTour={handleRestartTour}
        onChangeRole={handleRestartOnboarding}
        onOpenShare={() => setIsShareOpen(true)}
        onOpenFeedback={() => setIsFeedbackOpen(true)}
        onSignOut={handleSignOut}
      />

      {/* Full Onboarding Flow: 1. Role Selection -> 2. Auth Gate -> 3. Guided Tour -> 4. Icon Menu */}
      {isOnboardingOpen && (
        <OnboardingFlow
          onComplete={handleOnboardingComplete}
          initialRole={role}
          startAtTour={isTourOnly}
          onOpenShare={() => setIsShareOpen(true)}
          onOpenFeedback={() => setIsFeedbackOpen(true)}
          onOpenInstall={() => setIsInstallGuideOpen(true)}
          onClose={() => setIsOnboardingOpen(false)}
          onOpenGithubPush={githubPushStatus.enabled ? () => setIsGithubPushOpen(true) : undefined}
        />
      )}

      {/* Share App Modal */}
      <ShareModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
      />

      {/* Feedback & Bug Reporting Modal (Wrench tool) */}
      <FeedbackModal
        isOpen={isFeedbackOpen}
        onClose={() => setIsFeedbackOpen(false)}
        currentRole={role}
        currentTab={activeTab}
      />

      {/* AI Studio Dev GitHub Push Modal */}
      <GitHubPushModal
        isOpen={isGithubPushOpen}
        onClose={() => setIsGithubPushOpen(false)}
        hasEnvToken={githubPushStatus.hasEnvToken}
        repoName={githubPushStatus.repo}
        branch={githubPushStatus.branch}
      />

      {/* PWA Install Guide Modal (above OnboardingFlow) */}
      <PWAInstallGuideModal
        isOpen={isInstallGuideOpen}
        onClose={() => setIsInstallGuideOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <SessionProvider>
          <MainApp />
        </SessionProvider>
      </AppProvider>
    </ErrorBoundary>
  );
}
