import { useState, useEffect } from 'react';
// Import order: React first, then third-party, then internal modules, then types/hooks last.
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from 'react-router-dom';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TokenProvider } from './context/TokenContext';
import { RewardsProvider } from './context/RewardsContext';
import { SearchModeProvider } from './context/SearchModeContext';
import { PlayerProvider } from './context/PlayerContext';
import { SearchStashProvider } from './context/SearchStashContext';
import { TutorialProvider } from './context/TutorialContext';
import { MapProvider } from './components/map';
import { ToastProvider } from './components/ui/ToastProvider';
import { SettingsProvider } from './context/SettingsContext';
import RefCapture from './components/RefCapture';
import TruegleLogo from './components/ui/TruegleLogo';
import Footer from './components/Footer';
import ResultsPage from './components/ResultsPage';
import SettingsPage from './components/SettingsPage';
// REWARDS FEATURE: Temporarily disabled (no S2S postback support) — see the
// commented-out /rewards route below and the manual-verification workflow.
// import RewardsDashboard from './pages/RewardsDashboard';
import OnboardingPage from './components/auth/OnboardingPage';
import LandingPage from './pages/LandingPage';
import SignInPage from './pages/SignInPage';
import SignUpPage from './pages/SignUpPage';
import UniversalSearch from './pages/UniversalSearch';
import TruegleChat from './pages/TruegleChat';
import SharedThread from './pages/SharedThread';
import WatchPage from './pages/WatchPage';
import LinkPage from './pages/LinkPage';
import FeelingBiasedPage from './pages/FeelingBiasedPage';
import ExtractPage from './pages/ExtractPage';
import FeedPage from './pages/FeedPage';
import FeedCallback from './pages/FeedCallback';
import FeedTubePage from './pages/FeedTubePage';
import CreatorPage from './pages/CreatorPage';
import CreatorsPage from './pages/CreatorsPage';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import About from './pages/About';
import PrivacyResourceHub from './pages/PrivacyResourceHub';
import Advertise from './pages/Advertise';
import Developers from './pages/Developers';
import Blog from './pages/Blog';
import BlogPost from './pages/BlogPost';
import NotFound from "./pages/NotFound";
import RootErrorBoundary from './components/ui/RootErrorBoundary';
import RouteBoundary from './components/ui/RouteBoundary';
import PreProductionBanner from './components/ui/PreProductionBanner';
import BrandBar from './components/ui/BrandBar';
import PageClock from './components/ui/PageClock';
import MiniPlayer from './components/ui/MiniPlayer';
import SafeSearchLockModal from './components/ui/SafeSearchLockModal';
import TutorialModal from './components/ui/TutorialModal';
import { useTutorials } from './context/TutorialContext';
import { FREE_ACCESS_MODE } from './config/access';
// Info Wizard Prompt
const InfoWizardPrompt = ({
  webStack,
  shell,
  qwenIntegration,
  executionMode,
  security,
  onProceed,
}) => (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 via-black to-gray-900">
    <div className="max-w-lg w-full mx-auto bg-white/95 rounded-lg shadow-lg p-8 flex flex-col gap-6 items-center border border-blue-400/20">
      <h2 className="text-xl font-bold mb-2 text-blue-800 flex items-center gap-2">
        Environment Details
        <span aria-label="wizard-magic" className="ml-1">
          🧙‍♂️
        </span>
      </h2>
      <ul className="text-base text-gray-900 w-full space-y-2">
        <li>
          <span className="font-semibold text-gray-700">Web Stack:</span>{' '}
          <span className="ml-1">
            {webStack ? (
              webStack
            ) : (
              <em className="text-gray-500">Not provided</em>
            )}
          </span>
        </li>
        <li>
          <span className="font-semibold text-gray-700">Shell:</span>{' '}
          <span className="ml-1">
            {shell ? shell : <em className="text-gray-500">Not provided</em>}
          </span>
        </li>
        <li>
          <span className="font-semibold text-gray-700">Qwen Integration:</span>{' '}
          <span className="ml-1">
            {qwenIntegration ? (
              qwenIntegration
            ) : (
              <em className="text-gray-500">Not provided</em>
            )}
          </span>
        </li>
        <li>
          <span className="font-semibold text-gray-700">Execution Mode:</span>{' '}
          <span className="ml-1">
            {executionMode ? (
              executionMode
            ) : (
              <em className="text-gray-500">Not provided</em>
            )}
          </span>
        </li>
        <li>
          <span className="font-semibold text-gray-700">Security:</span>{' '}
          <span className="ml-1">
            {security ? (
              security
            ) : (
              <em className="text-gray-500">Not provided</em>
            )}
          </span>
        </li>
      </ul>
      <button
        className="mt-2 px-5 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded font-semibold hover:shadow-lg transition-shadow"
        onClick={onProceed}
      >
        Proceed
      </button>
    </div>
  </div>
);

/**
 * Main App Component
 * This is the top-level component that manages the initial info wizard prompt
 * and renders the main application content based on authentication state.
 * It wraps the application with Router and AuthProvider for navigation and
 * authentication context management.
 */
const App = () => {
  return (
    <RootErrorBoundary>
    <Router basename="/" future={{
      v7_startTransition: true,
      v7_relativeSplatPath: true
    }}>
      <AuthProvider>
        <TokenProvider>
          <RewardsProvider>
          <SearchModeProvider>
            <PlayerProvider>
            {/* Inside PlayerProvider: the stash exists so the PLAYER can put a
                search list down and hand it back (SearchStashContext). */}
            <SearchStashProvider>
            <SettingsProvider>
              <MapProvider>
                <TutorialProvider>
                  <ToastProvider position="top-right">
                    {/* Skip to content link for accessibility */}
                    <a href="#main-content" className="skip-to-content">
                      Skip to main content
                    </a>
                    <RefCapture />
                    {/* TODO(landing-flow): re-enable once the pill/chat mode
                        flow is finalized and we've decided where the ads
                        opt-in prompt should live (was auto-popping over the
                        landing controls mid-iteration). */}
                    <AppContent />
                  </ToastProvider>
                </TutorialProvider>
              </MapProvider>
            </SettingsProvider>
            </SearchStashProvider>
            </PlayerProvider>
          </SearchModeProvider>
          </RewardsProvider>
        </TokenProvider>
      </AuthProvider>
    </Router>
    </RootErrorBoundary>
  );
};

// Protected route pattern following project conventions.
// Onboarding is now optional - users go directly to search results after auth.
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation(); // Get current location to preserve redirect info

  // Pre-production: auth is bypassed so every page is reachable without login.
  if (FREE_ACCESS_MODE) return children;

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center relative overflow-hidden">
        {/* Star-speckled background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 80 }).map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full bg-white animate-pulse"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                width: `${Math.random() * 2 + 1}px`,
                height: `${Math.random() * 2 + 1}px`,
                opacity: Math.random() * 0.6 + 0.1,
                animationDelay: `${Math.random() * 3}s`,
                animationDuration: `${Math.random() * 2 + 2}s`,
              }}
            />
          ))}
        </div>
        <div className="relative z-10 flex flex-col items-center gap-6">
          <TruegleLogo size="large" />
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Preserve the attempted location for redirect after login
    // Use 'redirectTo' key to match what auth pages expect
    return <Navigate to="/auth/login" state={{ redirectTo: location.pathname + location.search }} replace />;
  }

  return children;
};

// Single global onboarding tutorial — auto-opens once after signup,
// otherwise only reachable via the "Tutorial" link in the footer.
const TutorialModalRoot = () => {
  const { activeTutorial, closeTutorial, dismissTutorialPermanently } = useTutorials();
  return (
    <TutorialModal
      isOpen={activeTutorial === 'main'}
      onClose={closeTutorial}
      onDontShowAgain={() => dismissTutorialPermanently('main')}
    />
  );
};

// Main application routes/content
const AppContent = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    sortBy: 'relevance',
    order: 'desc',
    category: 'all',
    dateRange: 'any',
    bias: 'all',
  });
  const handleSearch = (query, newFilters = {}) => {
    setSearchQuery(query);
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  const routerLocation = useLocation();
  const isOnline = useOnlineStatus();
  // WITH NO NETWORK AT ALL, every route past the app shell needs a live
  // backend to be anything but a blank/loading state — search, chat, maps,
  // creators, all of it. Rather than let each one render its own half-broken
  // "stuck loading" separately, route straight to the one page built to be
  // worth landing on with nothing behind it: the 404 page and its offline
  // easter egg (see NotFound.jsx, and the service worker that now makes it
  // reachable with zero network — public/sw.js).
  //
  // Only the MATCH changes, via a synthetic pathname `<Routes>` cannot
  // otherwise resolve to any real route — the actual address bar is never
  // touched, so reconnecting resumes exactly the page it already said. This
  // is client-side routing standing in for a redirect on purpose: a real
  // navigation would itself need the network that just went away.
  const location = isOnline
    ? routerLocation
    : { ...routerLocation, pathname: '/__truegle_offline__', key: 'offline' };

  // All pages should allow scrolling with min-h-screen
  const containerClassNames = "relative w-screen min-h-screen bg-black overflow-y-auto";

  return (
    <div id="main-content" className={containerClassNames}>
      <BrandBar />
      <PageClock />
      <MiniPlayer />
      <PreProductionBanner />
      <SafeSearchLockModal />
      <TutorialModalRoot />
      {/* NOTE: Do NOT wrap <Routes> in <AnimatePresence mode="wait">. The route
          elements have no motion exit variants, and the landing page runs several
          infinite framer-motion animations; mode="wait" then holds the new route
          until an exit that never completes, so navigating (e.g. landing search →
          /search) changed the URL but left the old page mounted. Plain Routes with
          a pathname key remounts reliably on every navigation. */}
      <Routes location={location} key={location.pathname}>
        {/* Public Routes */}
        <Route path="/auth/login" element={<RouteBoundary><SignInPage /></RouteBoundary>} />
        <Route path="/auth/signup" element={<RouteBoundary><SignUpPage /></RouteBoundary>} />

        {/* Universal Search Route */}
        <Route path="/search" element={<RouteBoundary><UniversalSearch /></RouteBoundary>} />
        <Route path="/chat" element={<RouteBoundary><TruegleChat /></RouteBoundary>} />
        <Route path="/s/:id" element={<RouteBoundary><SharedThread /></RouteBoundary>} />
        {/* Shared Truegle player link — opens straight into the sandboxed player */}
        <Route path="/w" element={<RouteBoundary><WatchPage /></RouteBoundary>} />
        {/* /shorts folded into the player 2026-08-09. It was a second copy of
            a vertical swipe feed the player already had, with its own layout,
            its own search bar and its own drift. The route still resolves —
            people have shared it — and lands on Tube with the Shorts scope
            selected, which reaches the same submitted-reels pool the page did. */}
        <Route path="/shorts" element={<Navigate to="/tube?scope=shorts" replace />} />
        {/* Shared Truegle link to a non-media page — lands on Truegle first */}
        <Route path="/l" element={<RouteBoundary><LinkPage /></RouteBoundary>} />

        {/* Locked Green Mode - AI-free, no navigation out */}
        <Route path="/green" element={<RouteBoundary><UniversalSearch lockedGreen /></RouteBoundary>} />

        {/* True Tube — a real route, not an alias, so truegle.info/tube is what
            people actually share and what they land back on. Same page and
            layout as every other search mode; only the pill is pinned. */}
        <Route path="/tube" element={<RouteBoundary><UniversalSearch lockedTube /></RouteBoundary>} />

        {/* Legacy Routes - Redirect to Universal Search */}
        <Route path="/search-portal" element={<Navigate to="/search" replace />} />
        <Route path="/search-results" element={<Navigate to="/search" replace />} />
        <Route path="/results" element={<Navigate to="/search" replace />} />
        <Route path="/biased" element={<Navigate to="/search?mode=purple" replace />} />
        <Route path="/osint" element={<Navigate to="/search?mode=ocean" replace />} />
        <Route path="/osint/search" element={<Navigate to="/search?mode=ocean" replace />} />
        <Route path="/osint/tools" element={<Navigate to="/search?mode=ocean" replace />} />

        {/* Feeling Biased Page - Keep as entry point */}
        <Route path="/feeling-biased" element={<RouteBoundary><FeelingBiasedPage /></RouteBoundary>} />
        {/* The feed. /feed/callback is where a provider (or, in demo, our own
            start route) returns to.

            SEPARATE COMPONENTS, deliberately. <Routes> above is keyed on
            location.pathname, so every navigation remounts the tree. When one
            component served both paths, cleaning the spent code out of the URL
            remounted the page it had just filled — the feed was discarded and
            page one refetched on every connect. FeedCallback owns the
            handshake; FeedPage mounts once, on /feed, already connected. */}
        <Route path="/feed" element={<RouteBoundary><FeedPage /></RouteBoundary>} />
        <Route path="/feed/callback" element={<RouteBoundary><FeedCallback /></RouteBoundary>} />
        {/* Tube on the new feed layout. A sibling route, not a flag on
            /tube: the player-over-grid shape is not a variant of the
            search results list, and /tube keeps working untouched. */}
        <Route path="/feed/tube" element={<RouteBoundary><FeedTubePage /></RouteBoundary>} />
        {/* PARKED, not deleted. The yellow pill and the hamburger point at
            /feed now, so nothing links here, but a direct link should still
            work rather than 404 — the extraction tool is waiting to be folded
            into Tube (docs/PRE-PRODUCTION-BACKLOG.md). */}
        <Route path="/extract" element={<RouteBoundary><ExtractPage /></RouteBoundary>} />

        {/* Legal / Info Pages (required for OAuth publishing + AdSense) */}
        <Route path="/privacy" element={<RouteBoundary><PrivacyPolicy /></RouteBoundary>} />
        <Route path="/terms" element={<RouteBoundary><TermsOfService /></RouteBoundary>} />
        <Route path="/about" element={<RouteBoundary><About /></RouteBoundary>} />
        {/* Content-hub pillar page (privacy + OSINT) */}
        <Route path="/privacy-resource-hub" element={<RouteBoundary><PrivacyResourceHub /></RouteBoundary>} />
        <Route path="/advertise" element={<RouteBoundary><Advertise /></RouteBoundary>} />
        {/* Public documentation for the search API. Prerendered — it has to be
            readable without running JavaScript, because the people who most
            need to read it are reviewers and crawlers. */}
        <Route path="/developers" element={<RouteBoundary><Developers /></RouteBoundary>} />

        {/* Blog / editorial content (crawlable publisher content for SEO + ads) */}
        <Route path="/blog" element={<RouteBoundary><Blog /></RouteBoundary>} />
        <Route path="/blog/:slug" element={<RouteBoundary><BlogPost /></RouteBoundary>} />
        {/* The roster, and where the Creators pill lands. /creator/:slug
            below is one creator; this is the set of them. */}
        <Route path="/creators" element={<RouteBoundary><CreatorsPage /></RouteBoundary>} />
        <Route path="/creator/:slug" element={<RouteBoundary><CreatorPage /></RouteBoundary>} />
        {/* Onboarding Route */}
        <Route
          path="/onboarding"
          element={
            <ProtectedRoute>
              <RouteBoundary><OnboardingPage /></RouteBoundary>
            </ProtectedRoute>
          }
        />
        {/* Landing Page */}
        <Route path="/" element={<RouteBoundary><LandingPage /></RouteBoundary>} />
        {/* Localized landing routes (de/es/fr). The build prerenders a
            translated, hreflang-tagged SEO snapshot at each of these paths for
            crawlers; the live SPA renders the standard landing over it so the
            route is never a 404. */}
        <Route path="/de" element={<RouteBoundary><LandingPage /></RouteBoundary>} />
        <Route path="/es" element={<RouteBoundary><LandingPage /></RouteBoundary>} />
        <Route path="/fr" element={<RouteBoundary><LandingPage /></RouteBoundary>} />
        <Route path="/nl" element={<RouteBoundary><LandingPage /></RouteBoundary>} />
        <Route path="/pt" element={<RouteBoundary><LandingPage /></RouteBoundary>} />
        {/* Settings */}
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <RouteBoundary>
                <SettingsPage />
                <Footer />
              </RouteBoundary>
            </ProtectedRoute>
          }
        />
        {/* REWARDS FEATURE: disabled. The program was funded by ad revenue, and
            advertising was removed from Truegle on 2026-08-24 — so there is no
            funding source and nothing to credit. The scaffolding is kept (a
            manual admin-credit path exists at /api/admin/rewards/credit) in case
            a non-ad funding model appears. Route hidden so the dashboard is
            neither visible nor reachable.
        <Route
          path="/rewards"
          element={
            <ProtectedRoute>
              <RouteBoundary>
                <RewardsDashboard />
                <Footer />
              </RouteBoundary>
            </ProtectedRoute>
          }
        /> */}
        {/* Catch all */}
        <Route path="*" element={<RouteBoundary><NotFound /></RouteBoundary>} />
      </Routes>
    </div>
  );
};

export default App;
