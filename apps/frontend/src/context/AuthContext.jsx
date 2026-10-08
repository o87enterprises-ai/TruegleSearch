import React, { createContext, useContext, useState, useEffect } from 'react';
import authService from '../services/authService';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      // Check if "Remember Me" was used - if not, clear session data
      const rememberMe = localStorage.getItem('truegle_remember_me');

      // If remember me was explicitly set to false, clear session on new browser session
      // We use sessionStorage to track if this is the same browser session
      const currentSession = sessionStorage.getItem('truegle_session_active');

      if (rememberMe === 'false' && !currentSession) {
        // New browser session and remember me was not checked - clear auth
        localStorage.removeItem('truegle_token');
        localStorage.removeItem('truegle_user');
        localStorage.removeItem('truegle_remember_me');
        setLoading(false);
        return;
      }

      // Mark this browser session as active
      sessionStorage.setItem('truegle_session_active', 'true');

      const token = localStorage.getItem('truegle_token');

      if (token) {
        const result = await authService.validateSession(token);

        if (result.valid) {
          if (result.token) localStorage.setItem('truegle_token', result.token);
          if (result.user) localStorage.setItem('truegle_user', JSON.stringify(result.user));
          setIsAuthenticated(true);
          setUser(result.user);
          console.log('Auth restored:', result.user);
        } else if (result.expired) {
          // Clear invalid token — only when the server SAID it is invalid
          localStorage.removeItem('truegle_token');
          localStorage.removeItem('truegle_user');
          localStorage.removeItem('truegle_remember_me');
          console.log('Invalid session cleared');
        }
      }
      // No token - user not logged in (expected state)
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = (userData, rememberMe = true, isNewSignup = false) => {
    console.log('Login called with:', userData, 'rememberMe:', rememberMe);
    localStorage.setItem('truegle_token', userData.token);
    localStorage.setItem('truegle_user', JSON.stringify(userData.user));
    localStorage.setItem('truegle_remember_me', rememberMe.toString());
    sessionStorage.setItem('truegle_session_active', 'true');
    if (isNewSignup) {
      // Flag picked up once by TutorialContext to auto-open onboarding, then cleared.
      localStorage.setItem('truegle_just_signed_up', 'true');
    }
    setUser(userData.user);
    setIsAuthenticated(true);
  };

  const logout = async () => {
    try {
      const token = localStorage.getItem('truegle_token');
      if (token) {
        await authService.logout(token);
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear authentication-related items but preserve user preferences
      localStorage.removeItem('truegle_token');
      localStorage.removeItem('truegle_user');
      localStorage.removeItem('truegle_remember_me');
      sessionStorage.removeItem('truegle_session_active');
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  const updateUser = (updatedUser) => {
    setUser(updatedUser);
    localStorage.setItem('truegle_user', JSON.stringify(updatedUser));
  };

  const value = {
    isAuthenticated,
    user,
    loading,
    login,
    logout,
    updateUser,
    // Helper functions
    isAdmin: user?.role === 'admin',
    isPremium: user?.isPremium || user?.role === 'admin',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
