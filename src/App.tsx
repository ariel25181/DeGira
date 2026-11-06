import React, { useState } from 'react';
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
import { NotificationsDrawer } from './components/modals/NotificationsDrawer.tsx';
import { ShareModal } from './components/modals/ShareModal.tsx';
import { FeedbackModal } from './components/modals/FeedbackModal.tsx';
import { PWAInstallBanner } from './components/PWAInstallBanner.tsx';
import { SessionProvider } from './context/SessionContext.tsx';
import { ReservasApp } from './components/reservas/ReservasApp.tsx';

import { VenueOpenCall, MusicianAvailability, LiveShowConfirmed, UserRole } from './types/index.ts';
import { Wifi, Battery, Signal, Sparkles, LayoutGrid, HelpCircle, RefreshCw, Share2, Wrench } from 'lucide-react';
import { OnboardingFlow } from './components/flow/OnboardingFlow.tsx';
import { ActivityToolbar, RoleIconMenuModal, ROLE_ACTIVITIES } from './components/flow/RoleActivityNav.tsx';

function MainApp() {
  const { role, setRole, currentMusician, currentVenue } = useApp();

  // Navigation tab
  const [activeTab, setActiveTab] = useState<string>('cartelera');

  // Onboarding flow state: first-time visitors or role switchers
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(() => {
    try {
      return !localStorage.getItem('suenaba:onboarding_completed:v1');
    } catch {
      return false;
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
        />

        {/* PWA In-App Install Prompt Banner */}
        <PWAInstallBanner />

        {/* Current Active Role Badge bar */}
        <div className="bg-slate-900/80 border-b border-slate-800/80 px-3 py-1.5 flex items-center justify-between text-[11px] text-slate-400 gap-2">
          <div className="flex items-center space-x-1.5 truncate">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
            <span className="hidden xs:inline">Operando como:</span>
            <strong className="text-slate-200 truncate">
              {role === 'musico'
                ? currentMusician?.stageName
                : role === 'bar'
                ? currentVenue?.name
                : 'Público General'}
            </strong>
          </div>

          <div className="flex items-center space-x-1.5 shrink-0">
            {/* Icon menu trigger button */}
            <button
              onClick={() => setIsIconMenuOpen(true)}
              className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 font-bold transition-colors"
              title="Abrir menú de opciones del rol"
            >
              <LayoutGrid className="w-3 h-3" />
              <span>Opciones</span>
            </button>

            {/* Profile switch / Change role trigger */}
            <button
              onClick={handleRestartOnboarding}
              className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition-colors"
              title="Cambiar de perfil"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Role Activity Toolbar: Forward and Backward navigation across available activities */}
        <ActivityToolbar
          role={role}
          activeTab={activeTab}
          onSelectTab={(tabId) => {
            setActiveTab(tabId);
            setViewingTarget(null);
          }}
          onOpenIconMenu={() => setIsIconMenuOpen(true)}
        />

        {/* Main Tab Content View */}
        <main className="flex-1 p-4 overflow-y-auto">
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

          {activeTab === 'reservas' && <ReservasApp />}

          {activeTab === 'perfil' && (
            <ProfileView
              viewingTarget={viewingTarget}
              onClearTarget={handleClearViewingTarget}
              onOpenReviewModal={handleOpenReviewModal}
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
      />

      {/* Full Onboarding Flow: 1. Role Selection -> 2. Auth Gate -> 3. Guided Tour -> 4. Icon Menu */}
      {isOnboardingOpen && (
        <OnboardingFlow
          onComplete={handleOnboardingComplete}
          initialRole={role}
          startAtTour={isTourOnly}
          onOpenShare={() => setIsShareOpen(true)}
          onOpenFeedback={() => setIsFeedbackOpen(true)}
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
