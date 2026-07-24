import { useState, useEffect } from 'react';
// Import order: React first, then third-party, then internal modules, then types/hooks last.
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TokenProvider } from './context/TokenContext';
import { RewardsProvider } from './context/RewardsContext';
import { SearchModeProvider } from './context/SearchModeContext';
import { TutorialProvider } from './context/TutorialContext';
import { MapProvider } from './components/map';
import { ToastProvider } from './components/ui/ToastProvider';
import { SettingsProvider } from './context/SettingsContext';
import AdScriptLoader from './components/ads/AdScriptLoader';
import RefCapture from './components/RefCapture';
import FreemiumTokenBar from './components/ui/FreemiumTokenBar';
import CookieConsent from './components/ui/CookieConsent';
import TruegleLogo from './components/ui/TruegleLogo';
import Footer from './components/Footer';
import ResultsPage from './components/ResultsPage';
import SettingsPage from './components/SettingsPage';
import RewardsDashboard from './pages/RewardsDashboard';
import OnboardingPage from './components/auth/OnboardingPage';
import LandingPage from './pages/LandingPage';
import SignInPage from './pages/SignInPage';
import SignUpPage from './pages/SignUpPage';
import UniversalSearch from './pages/UniversalSearch';
import TruegleChat from './pages/TruegleChat';
import SharedThread from './pages/SharedThread';
import FeelingBiasedPage from './pages/FeelingBiasedPage';
import ExtractPage from './pages/ExtractPage';
import CreatorPage from './pages/CreatorPage';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import About from './pages/About';
import Advertise from './pages/Advertise';
import Blog from './pages/Blog';
import BlogPost from './pages/BlogPost';
import RevenueCalculator from './pages/RevenueCalculator';
import NotFound from "./pages/NotFound";
import RootErrorBoundary from './components/ui/RootErrorBoundary';
import RouteBoundary from './components/ui/RouteBoundary';
import PreProductionBanner from './components/ui/PreProductionBanner';
import BrandBar from './components/ui/BrandBar';
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
              <SettingsProvider>
                <MapProvider>
                  <TutorialProvider>
                    <ToastProvider position="top-right">
                      {/* Skip to content link for accessibility */}
                      <a href="#main-content" className="skip-to-content">
                        Skip to main content
                      </a>
                      {/* TODO(ads): re-enable when new Adsterra zones land
                      <AdScriptLoader />
                      */}
                      <RefCapture />
                      <FreemiumTokenBar />
                      {/* TODO(landing-flow): re-enable once the pill/chat mode
                          flow is finalized and we've decided where the ads
                          opt-in prompt should live (was auto-popping over the
                          landing controls mid-iteration). */}
                      {/* <CookieConsent /> */}
                      <AppContent />
                    </ToastProvider>
                  </TutorialProvider>
                </MapProvider>
              </SettingsProvider>
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

  const location = useLocation();

  // All pages should allow scrolling with min-h-screen
  const containerClassNames = "relative w-screen min-h-screen bg-black overflow-y-auto";

  return (
    <div id="main-content" className={containerClassNames}>
      <BrandBar />
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

        {/* Locked Green Mode - AI-free, no navigation out */}
        <Route path="/green" element={<RouteBoundary><UniversalSearch lockedGreen /></RouteBoundary>} />

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
        <Route path="/extract" element={<RouteBoundary><ExtractPage /></RouteBoundary>} />

        {/* Legal / Info Pages (required for OAuth publishing + AdSense) */}
        <Route path="/privacy" element={<RouteBoundary><PrivacyPolicy /></RouteBoundary>} />
        <Route path="/terms" element={<RouteBoundary><TermsOfService /></RouteBoundary>} />
        <Route path="/about" element={<RouteBoundary><About /></RouteBoundary>} />
        <Route path="/advertise" element={<RouteBoundary><Advertise /></RouteBoundary>} />

        {/* Blog / editorial content (crawlable publisher content for SEO + ads) */}
        <Route path="/blog" element={<RouteBoundary><Blog /></RouteBoundary>} />
        <Route path="/blog/:slug" element={<RouteBoundary><BlogPost /></RouteBoundary>} />
        <Route path="/creator/:slug" element={<RouteBoundary><CreatorPage /></RouteBoundary>} />
        <Route path="/revenue-calc" element={<RouteBoundary><RevenueCalculator /></RouteBoundary>} />
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
        {/* Rewards Program dashboard */}
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
        />
        {/* Catch all */}
        <Route path="*" element={<RouteBoundary><NotFound /></RouteBoundary>} />
      </Routes>
    </div>
  );
};

export default App;
