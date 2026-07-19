import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { rewardsAPI } from '../services/api';
import { useAuth } from './AuthContext';

const RewardsContext = createContext();

export const useRewards = () => {
  const context = useContext(RewardsContext);
  if (!context) {
    throw new Error('useRewards must be used within a RewardsProvider');
  }
  return context;
};

export const RewardsProvider = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const [optedIn, setOptedIn] = useState(false);
  const [balanceMicros, setBalanceMicros] = useState(0);
  const [lifetimeEarnedMicros, setLifetimeEarnedMicros] = useState(0);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  useEffect(() => {
    if (isAuthenticated && user) {
      fetchStatus();
    } else {
      setOptedIn(false);
      setBalanceMicros(0);
      setLifetimeEarnedMicros(0);
    }
  }, [isAuthenticated, user]);

  const fetchConfig = useCallback(async () => {
    try {
      const response = await rewardsAPI.getConfig();
      setConfig(response.data.data);
    } catch (error) {
      console.error('Failed to fetch rewards config:', error);
    }
  }, []);

  const fetchStatus = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const response = await rewardsAPI.getStatus();
      const data = response.data.data;
      setOptedIn(data.optedIn);
      setBalanceMicros(data.balanceMicros);
      setLifetimeEarnedMicros(data.lifetimeEarnedMicros);
    } catch (error) {
      console.error('Failed to fetch rewards status:', error);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const optIn = useCallback(async () => {
    if (!isAuthenticated) return { success: false, message: 'Not authenticated' };
    try {
      const response = await rewardsAPI.optIn();
      const data = response.data.data;
      setOptedIn(data.optedIn);
      setBalanceMicros(data.balanceMicros);
      return { success: true };
    } catch (error) {
      console.error('Failed to opt into rewards:', error);
      return { success: false, message: error.response?.data?.message || 'Failed to opt in' };
    }
  }, [isAuthenticated]);

  const optOut = useCallback(async () => {
    if (!isAuthenticated) return { success: false, message: 'Not authenticated' };
    try {
      const response = await rewardsAPI.optOut();
      const data = response.data.data;
      setOptedIn(data.optedIn);
      return { success: true };
    } catch (error) {
      console.error('Failed to opt out of rewards:', error);
      return { success: false, message: error.response?.data?.message || 'Failed to opt out' };
    }
  }, [isAuthenticated]);

  /**
   * Open a server-tracked session for a reward-eligible ad impression.
   * Must be called before earn().
   */
  const startImpressionSession = useCallback(async (adId, zone) => {
    if (!isAuthenticated || !optedIn) return { success: false };
    try {
      const response = await rewardsAPI.startImpressionSession(adId, zone);
      return { success: true, sessionId: response.data.sessionId };
    } catch (error) {
      return { success: false, message: error.response?.data?.message };
    }
  }, [isAuthenticated, optedIn]);

  /** Claim the reward once the ad has been visible long enough, or immediately on a detected click. */
  const earn = useCallback(async (sessionId, visibleMs, clicked = false) => {
    if (!isAuthenticated) return { success: false };
    try {
      const response = await rewardsAPI.earn(sessionId, visibleMs, clicked);
      const result = response.data.data;
      if (result.success) {
        setBalanceMicros(result.balanceMicros);
        setLifetimeEarnedMicros((prev) => prev + result.amountMicros);
      }
      return result;
    } catch (error) {
      return { success: false, message: error.response?.data?.message };
    }
  }, [isAuthenticated]);

  const value = {
    optedIn,
    balanceMicros,
    lifetimeEarnedMicros,
    config,
    loading,
    fetchStatus,
    optIn,
    optOut,
    startImpressionSession,
    earn,
  };

  return <RewardsContext.Provider value={value}>{children}</RewardsContext.Provider>;
};
