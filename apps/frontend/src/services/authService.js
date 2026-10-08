// Real Auth Service - Connects to backend API
import api from './api';

const API_BASE_URL = (import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001') + '/api';

class AuthService {
  constructor() {
    this.mockMode = false; // Real API mode enabled
  }

  // Email a one-time sign-in code. Creates a free account for this address
  // on first use — no password, no OAuth.
  async requestCode(email) {
    try {
      const response = await api.post('/auth/request-code', {
        email: email.toLowerCase().trim(),
      });

      if (response.data.success) {
        return { success: true, message: response.data.message };
      }

      return { success: false, error: response.data.error || 'Could not send code' };
    } catch (error) {
      console.error('[Auth] Request code error:', error);

      if (error.response?.status === 429) {
        return { success: false, error: error.response.data?.error || 'Please wait before requesting another code' };
      }

      return {
        success: false,
        error: error.response?.data?.error || 'Could not send code. Please try again.',
      };
    }
  }

  // Exchange an emailed (or SMS/phone, once wired) code for a session.
  async verifyCode({ email, phone, code, remember = true }) {
    try {
      const body = email
        ? { email: email.toLowerCase().trim(), code: code.trim(), remember, adult: true }
        : { phone: phone.trim(), code: code.trim(), remember, adult: true };

      const response = await api.post('/auth/verify-access-code', body);

      if (response.data.success) {
        return {
          success: true,
          user: response.data.user,
          token: response.data.token,
          accountCode: response.data.accountCode || null, // revealed once, first sign-in
        };
      }

      return { success: false, error: response.data.error || 'Invalid or expired code' };
    } catch (error) {
      console.error('[Auth] Verify code error:', error);

      return {
        success: false,
        error: error.response?.data?.error || 'Invalid or expired code',
      };
    }
  }

  // Rotate the signed-in user's durable account code; returns the new one once.
  async regenerateAccountCode(token) {
    try {
      const response = await api.post('/auth/account-code/regenerate', {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.success) {
        return { success: true, accountCode: response.data.accountCode };
      }
      return { success: false, error: response.data.error || 'Could not regenerate code' };
    } catch (error) {
      console.error('[Auth] Regenerate account code error:', error);
      return { success: false, error: error.response?.data?.error || 'Could not regenerate code' };
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
          // A remembered sign-in comes back renewed (another 90 days).
          token: response.data.token || null,
        };
      }

      return { valid: false, error: 'Invalid token' };
    } catch (error) {
      console.error('[Auth] Validate error:', error);

      // Token is invalid or expired — the ONLY answer that signs someone out.
      if (error.response?.status === 401) {
        return { valid: false, expired: true, error: 'Session expired' };
      }

      // Anything else — offline, a timeout, the server starting up or briefly
      // failing (5xx, 429) — says nothing about the sign-in itself. Keep it.
      // (Owner, 2026-10-08: having to sign in every time. A hiccup here used
      // to delete a perfectly good 30-day sign-in.)
      console.warn('[Auth] Could not check the session right now, keeping it');
      const cachedUser = localStorage.getItem('truegle_user');
      if (cachedUser) {
        try {
          return { valid: true, user: JSON.parse(cachedUser) };
        } catch { /* fall through */ }
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
