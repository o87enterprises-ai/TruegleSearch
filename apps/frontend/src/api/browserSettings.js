/* global chrome */
const BROWSER_API = {
  searchEngine: 'https://www.google.com/search',
  homepage: 'https://truegle.com',
  aiAssistant: 'https://truegle.com/ai',

  async setSearchEngine() {
    try {
      if (window.chrome && chrome.settings && chrome.settings.setDefaultSearch) {
        await chrome.settings.setDefaultSearch({ url: BROWSER_API.searchEngine });
        return { success: true, message: 'Search engine set successfully' };
      }
      throw new Error('Chrome API not available');
    } catch (error) {
      console.error('Failed to set search engine:', error);
      return { success: false, error: error.message };
    }
  },

  async setHomepage() {
    try {
      if (window.chrome && chrome.browserSettings && chrome.browserSettings.homepage) {
        await chrome.browserSettings.homepage.update({
          value: BROWSER_API.homepage
        });
        return { success: true, message: 'Homepage set successfully' };
      }
      throw new Error('Chrome API not available');
    } catch (error) {
      console.error('Failed to set homepage:', error);
      return { success: false, error: error.message };
    }
  },

  async setAIAssistant() {
    try {
      if (window.chrome && chrome.search && chrome.search.default) {
        await chrome.search.default.setSearchEngine(BROWSER_API.aiAssistant);
        return { success: true, message: 'AI assistant set successfully' };
      }
      throw new Error('Chrome API not available');
    } catch (error) {
      console.error('Failed to set AI assistant:', error);
      return { success: false, error: error.message };
    }
  },

  async setAll(settings) {
    const results = [];
    
    if (settings.searchEngine) {
      results.push(this.setSearchEngine());
    }
    
    if (settings.homepage) {
      results.push(this.setHomepage());
    }
    
    if (settings.aiAssistant) {
      results.push(this.setAIAssistant());
    }
    
    const outcomes = await Promise.all(results);
    const allSuccess = outcomes.every(o => o.success);
    
    return {
      success: allSuccess,
      results: outcomes
    };
  },

  getBrowserInfo() {
    const ua = navigator.userAgent;
    
    if (ua.includes('Edg/')) return { name: 'Edge', supportsAPI: true };
    if (ua.includes('Chrome/') && !ua.includes('Edg/')) return { name: 'Chrome', supportsAPI: true };
    if (ua.includes('Firefox/')) return { name: 'Firefox', supportsAPI: false };
    if (ua.includes('Safari/') && !ua.includes('Chrome/')) return { name: 'Safari', supportsAPI: false };
    
    return { name: 'Unknown', supportsAPI: false };
  },

  getInstructions(browserName) {
    const instructions = {
      Chrome: {
        title: 'Manual Setup for Chrome',
        steps: [
          'Open Chrome settings',
          'Click "Search engine" in the left sidebar',
          'Click the dropdown next to "Search engine used in the address bar"',
          'Select "Truegle"',
          'For homepage: Click "On startup", select "Open a specific page", add truegle.com'
        ]
      },
      Safari: {
        title: 'Manual Setup for Safari',
        steps: [
          'Open Safari',
          'Click "Safari" in the menu bar, then "Preferences"',
          'Click "General" tab',
          'Set Homepage to: truegle.com',
          'Click "Search" dropdown and select "Truegle"'
        ]
      },
      Firefox: {
        title: 'Manual Setup for Firefox',
        steps: [
          'Open Firefox',
          'Click the menu button (three lines) in the top-right',
          'Click "Settings"',
          'Set "Home Page" to: truegle.com',
          'Click "Search" dropdown in the search bar',
          'Select "Truegle"'
        ]
      },
      Edge: {
        title: 'Manual Setup for Edge',
        steps: [
          'Open Edge',
          'Click the menu button (three dots) in the top-right',
          'Click "Settings"',
          'Click "Privacy, search, and services"',
          'Click "Address bar and search"',
          'Select "Truegle" from the search engine dropdown'
        ]
      }
    };
    
    return instructions[browserName] || instructions.Chrome;
  }
};

export default BROWSER_API;