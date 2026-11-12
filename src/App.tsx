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
import { NotificationsDrawer } from './components/modals/NotificationsDrawer.tsx';
import { ShareModal } from './components/modals/ShareModal.tsx';
import { FeedbackModal } from './components/modals/FeedbackModal.tsx';
import { PWAInstallBanner } from './components/PWAInstallBanner.tsx';
import { SessionProvider, useSession } from './context/SessionContext.tsx';

import { VenueOpenCall, MusicianAvailability, LiveShowConfirmed, UserRole, EventProposal } from './types/index.ts';
import { Wifi, Battery, Signal, Sparkles, LayoutGrid, HelpCircle, RefreshCw, Share2, Wrench, LogOut, Star } from 'lucide-react';
import { OnboardingFlow } from './components/flow/OnboardingFlow.tsx';
import { RoleIconMenuModal, ROLE_ACTIVITIES } from './components/flow/RoleActivityNav.tsx';
import { getActiveSession } from './lib/degiraSession.ts';

function MainApp() {
  const {
    role,
    setRole,
    currentMusician,
    currentVenue,
    userDisplayName,
    setUserDisplayName,
    logout,
    eventProposals,
    reviews360,
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

  // Share and Feedback modal states
  const [isShareOpen, setIsShareOpen] = useState<boolean>(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState<boolean>(false);

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
  }>({
    targetType: 'venue',
    targetId: '',
    targetName: '',
    showDate: '',
    showVenueName: '',
  });

  // Review 360 Post-Event State (Req 7: rating bilateral post evento)
  const [isReview360Open, setIsReview360Open] = useState(false);
  const [review360Event, setReview360Event] = useState<EventProposal | null>(null);

  // Check if there is an ended event proposal needing review from this user
  const endedEventNeedingReview = eventProposals.find((ev) => {
    // If not reviewed yet by this user
    const alreadyReviewed = reviews360.some(
      (r) => r.eventId === ev.id && r.fromRole === role
    );
    return !alreadyReviewed;
  }) || eventProposals[0] || null;

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
    setReviewModalParams(params);
    setIsReviewModalOpen(true);
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
    setRole(chosenRole);
    setIsOnboardingOpen(false);
    setIsTourOnly(false);
    const defaultTab = chosenRole === 'espectador' ? 'cartelera' : 'convocatorias';
    setActiveTab(defaultTab);
    // Open the icon menu after the tour so the user sees the role options!
    setIsIconMenuOpen(true);
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
          onSignOut={handleSignOut}
        />

        {/* PWA In-App Install Prompt Banner */}
        <PWAInstallBanner />

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

        {/* Post-Event 360 Rating Banner (Req 7 & clarification) */}
        {endedEventNeedingReview && (
          <div className="bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-slate-900 border-b border-amber-500/40 px-3.5 py-2 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <Star className="w-4 h-4 text-amber-400 fill-amber-400 shrink-0" />
              <span className="text-slate-200 truncate text-[11px]">
                Show finalizado: <strong className="text-amber-400">{endedEventNeedingReview.title}</strong>. ¡Dejá tu calificación bilateral 360°!
              </span>
            </div>
            <button
              onClick={() => {
                setReview360Event(endedEventNeedingReview);
                setIsReview360Open(true);
              }}
              className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px] shrink-0 shadow-sm transition-all"
            >
              Calificar
            </button>
          </div>
        )}

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
              onViewVenue={handleViewVenueProfile}
              onViewMusician={handleViewMusicianProfile}
            />
          )}

          {activeTab === 'perfil' && (
            <ProfileView
              viewingTarget={viewingTarget}
              onClearTarget={handleClearViewingTarget}
              onOpenReviewModal={handleOpenReviewModal}
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
      />

      <Review360Modal
        isOpen={isReview360Open}
        onClose={() => setIsReview360Open(false)}
        event={review360Event || endedEventNeedingReview || eventProposals[0] || null}
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
          onClose={() => setIsOnboardingOpen(false)}
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
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <SessionProvider>
        <MainApp />
      </SessionProvider>
    </AppProvider>
  );
}
