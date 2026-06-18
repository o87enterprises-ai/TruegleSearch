import { useState, useEffect } from 'react';
// Import order: React first, then third-party, then internal modules, then types/hooks last.
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TokenProvider } from './context/TokenContext';
import { SearchModeProvider } from './context/SearchModeContext';
import { TutorialProvider } from './context/TutorialContext';
import { MapProvider } from './components/map';
import { ToastProvider } from './components/ui/ToastProvider';
import { SettingsProvider } from './context/SettingsContext';
import Header from './components/Header';
import Footer from './components/Footer';
import ResultsPage from './components/ResultsPage';
import SettingsPage from './components/SettingsPage';
import OnboardingPage from './components/auth/OnboardingPage';
import LandingPage from './pages/LandingPage';
import SignInPage from './pages/SignInPage';
import SignUpPage from './pages/SignUpPage';
import AuthCallback from './pages/AuthCallback';
import UniversalSearch from './pages/UniversalSearch';
import FeelingBiasedPage from './pages/FeelingBiasedPage';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import About from './pages/About';
import Advertise from './pages/Advertise';
import NotFound from "./pages/NotFound";
import RootErrorBoundary from './components/ui/RootErrorBoundary';
import RouteBoundary from './components/ui/RouteBoundary';
import PreProductionBanner from './components/ui/PreProductionBanner';
import AdvertiseContactModal from './components/ui/AdvertiseContactModal';
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
          <SearchModeProvider>
            <SettingsProvider>
              <MapProvider>
                <TutorialProvider>
                  <ToastProvider position="top-right">
                    {/* Skip to content link for accessibility */}
                    <a href="#main-content" className="skip-to-content">
                      Skip to main content
                    </a>
                    <AppContent />
                  </ToastProvider>
                </TutorialProvider>
              </MapProvider>
            </SettingsProvider>
          </SearchModeProvider>
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
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
      <PreProductionBanner />
      <AdvertiseContactModal />
      <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* Public Routes */}
        <Route path="/auth/login" element={<RouteBoundary><SignInPage /></RouteBoundary>} />
        <Route path="/auth/signup" element={<RouteBoundary><SignUpPage /></RouteBoundary>} />
        <Route path="/auth/callback" element={<RouteBoundary><AuthCallback /></RouteBoundary>} />

        {/* Universal Search Route */}
        <Route path="/search" element={<RouteBoundary><UniversalSearch /></RouteBoundary>} />

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

        {/* Legal / Info Pages (required for OAuth publishing + AdSense) */}
        <Route path="/privacy" element={<RouteBoundary><PrivacyPolicy /></RouteBoundary>} />
        <Route path="/terms" element={<RouteBoundary><TermsOfService /></RouteBoundary>} />
        <Route path="/about" element={<RouteBoundary><About /></RouteBoundary>} />
        <Route path="/advertise" element={<RouteBoundary><Advertise /></RouteBoundary>} />
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
                <Header onSearch={handleSearch} searchQuery={searchQuery} />
                <SettingsPage />
                <Footer />
              </RouteBoundary>
            </ProtectedRoute>
          }
        />
        {/* Catch all */}
        <Route path="*" element={<RouteBoundary><NotFound /></RouteBoundary>} />
      </Routes>
      </AnimatePresence>
    </div>
  );
};

export default App;
