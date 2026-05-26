// Real Auth Service - Connects to backend API
import api from './api';

const API_BASE_URL = (import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001') + '/api';

class AuthService {
  constructor() {
    this.mockMode = false; // Real API mode enabled
  }

  // Register a new user
  async register(email, password, name = '') {
    try {
      const response = await api.post('/auth/register', {
        email: email.toLowerCase().trim(),
        password,
        name: name || email.split('@')[0],
      });

      if (response.data.success) {
        return {
          success: true,
          user: response.data.user,
          token: response.data.token,
          newUser: true,
        };
      }

      return {
        success: false,
        error: response.data.message || 'Registration failed',
      };
    } catch (error) {
      console.error('[Auth] Register error:', error);

      // Handle specific error responses
      if (error.response?.status === 409) {
        return { success: false, error: 'Email already registered' };
      }
      if (error.response?.status === 400) {
        return { success: false, error: error.response.data?.message || 'Invalid input' };
      }

      return {
        success: false,
        error: error.response?.data?.message || 'Registration failed. Please try again.',
      };
    }
  }

  // Login existing user
  async login(email, password) {
    try {
      const response = await api.post('/auth/login', {
        email: email.toLowerCase().trim(),
        password,
      });

      if (response.data.success) {
        return {
          success: true,
          user: response.data.user,
          token: response.data.token,
          newUser: false,
        };
      }

      return {
        success: false,
        error: response.data.message || 'Login failed',
      };
    } catch (error) {
      console.error('[Auth] Login error:', error);

      if (error.response?.status === 401) {
        return { success: false, error: 'Invalid email or password' };
      }

      return {
        success: false,
        error: error.response?.data?.message || 'Login failed. Please try again.',
      };
    }
  }

  // Validate session token
  async validateSession(token) {
    if (!token) {
      return { valid: false, error: 'No token provided' };
    }

    try {
      const response = await api.get('/auth/validate', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.data.valid) {
        return {
          valid: true,
          user: response.data.user,
        };
      }

      return { valid: false, error: 'Invalid token' };
    } catch (error) {
      console.error('[Auth] Validate error:', error);

      // Token is invalid or expired
      if (error.response?.status === 401) {
        return { valid: false, error: 'Session expired' };
      }

      // Network error - don't invalidate the session, let user retry
      if (!error.response) {
        console.warn('[Auth] Network error during validation, keeping session');
        // Return valid with cached user data if available
        const cachedUser = localStorage.getItem('truegle_user');
        if (cachedUser) {
          try {
            return { valid: true, user: JSON.parse(cachedUser) };
          } catch {
            return { valid: false, error: 'Network error' };
          }
        }
      }

      return { valid: false, error: 'Validation failed' };
    }
  }

  // Logout user
  async logout(token) {
    try {
      await api.post('/auth/logout', {}, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      return { success: true };
    } catch (error) {
      console.error('[Auth] Logout error:', error);
      // Even if server logout fails, we should still clear local state
      return { success: true };
    }
  }

  // Update user profile
  async updateProfile(userId, profileData, token) {
    try {
      const response = await api.put(`/auth/profile`, profileData, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.data.success) {
        return {
          success: true,
          user: response.data.user,
        };
      }

      return {
        success: false,
        error: response.data.message || 'Update failed',
      };
    } catch (error) {
      console.error('[Auth] Update profile error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Profile update failed',
      };
    }
  }

  // Complete onboarding
  async completeOnboarding(userId, onboardingData, token) {
    try {
      const response = await api.post('/auth/onboarding', onboardingData, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.data.success) {
        return {
          success: true,
          user: response.data.user,
        };
      }

      return {
        success: false,
        error: response.data.message || 'Onboarding failed',
      };
    } catch (error) {
      console.error('[Auth] Onboarding error:', error);
      // For onboarding, if backend doesn't have the endpoint yet, succeed locally
      if (error.response?.status === 404) {
        return {
          success: true,
          user: { id: userId, onboardingCompleted: true },
        };
      }
      return {
        success: false,
        error: error.response?.data?.message || 'Onboarding failed',
      };
    }
  }

  // Guest login (anonymous session)
  async guestLogin() {
    // Guest sessions are local-only for privacy
    const guestUser = {
      id: 'guest_' + Date.now(),
      email: 'guest@truegle.com',
      name: 'Guest',
      role: 'guest',
      isGuest: true,
    };

    return {
      success: true,
      user: guestUser,
      token: 'guest_' + Date.now(),
      newUser: false,
    };
  }
}

// Create singleton instance
const authService = new AuthService();
export default authService;
