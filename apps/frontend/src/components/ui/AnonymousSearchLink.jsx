import { EyeOff } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function AnonymousSearchLink() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth(); // Get the login function from auth context

  const handleClick = async () => {
    try {
      // Use the guest login functionality to create an anonymous session
      const authService = (await import('../../services/authService')).default;
      const guestResult = await authService.guestLogin();

      if (guestResult.success) {
        // Log the guest user in by calling the login function from AuthContext
        // For guest sessions, we don't want to persist across browser restarts
        login({
          user: guestResult.user,
          token: guestResult.token
        }, false); // Don't remember guest sessions

        // Determine the current mode based on the location and any state
        const currentPath = location.pathname;

        // If we're in OSINT route, navigate to OSINT tools
        if (currentPath.includes('/osint')) {
          navigate('/osint/tools');
        }
        // If we're in biased route, navigate to biased page
        else if (currentPath.includes('/biased')) {
          navigate('/biased');
        }
        // For other routes, determine based on pill mode and OSINT mode
        else {
          // Check for OSINT mode first
          const isOSINTMode = localStorage.getItem('isOSINTMode') === 'true';
          if (isOSINTMode) {
            navigate('/osint/tools');
          } else {
            // Check for pill mode in localStorage
            const isRedPillMode = localStorage.getItem('isRedPillMode') === 'true';

            if (isRedPillMode) {
              // Red Pill Mode: Navigate to search results
              navigate('/search-results');
            } else {
              // Blue Pill Mode (default): Navigate to search portal
              navigate('/search-portal');
            }
          }
        }
      } else {
        console.error('Guest login failed:', guestResult.error);
        // Fallback: navigate to search portal
        navigate('/search-portal');
      }
    } catch (error) {
      console.error('Error during anonymous login:', error);
      // Fallback: navigate to search portal
      navigate('/search-portal');
    }
  };

  return (
    <button
      onClick={handleClick}
      className="flex items-center justify-center gap-2 text-red-400 hover:text-red-300
                 transition-colors text-sm font-medium group"
    >
      <EyeOff
        size={16}
        className="group-hover:scale-110 transition-transform"
      />
      <span>Search anonymously</span>
    </button>
  );
}
