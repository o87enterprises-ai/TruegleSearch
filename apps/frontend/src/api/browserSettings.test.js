import { describe, it, expect, vi, beforeEach } from 'vitest';
import BROWSER_API from '../api/browserSettings';

describe('Browser Settings API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.chrome = {
      settings: {
        setDefaultSearch: vi.fn(),
      },
      browserSettings: {
        homepage: {
          update: vi.fn(),
        },
      },
      search: {
        default: {
          setSearchEngine: vi.fn(),
        },
      },
    };
  });

  it('should set search engine successfully', async () => {
    const result = await BROWSER_API.setSearchEngine();
    expect(result.success).toBe(true);
    expect(global.chrome.settings.setDefaultSearch).toHaveBeenCalledWith({
      url: 'https://www.google.com/search'
    });
  });

  it('should handle set search engine failure', async () => {
    global.chrome.settings.setDefaultSearch.mockRejectedValue(new Error('API error'));
    const result = await BROWSER_API.setSearchEngine();
    expect(result.success).toBe(false);
    expect(result.error).toBe('API error');
  });

  it('should set homepage successfully', async () => {
    const result = await BROWSER_API.setHomepage();
    expect(result.success).toBe(true);
    expect(global.chrome.browserSettings.homepage.update).toHaveBeenCalledWith({
      value: 'https://truegle.com'
    });
  });

  it('should handle set homepage failure', async () => {
    global.chrome.browserSettings.homepage.update.mockRejectedValue(new Error('API error'));
    const result = await BROWSER_API.setHomepage();
    expect(result.success).toBe(false);
    expect(result.error).toBe('API error');
  });

  it('should set AI assistant successfully', async () => {
    const result = await BROWSER_API.setAIAssistant();
    expect(result.success).toBe(true);
    expect(global.chrome.search.default.setSearchEngine).toHaveBeenCalledWith(
      'https://truegle.com/ai'
    );
  });

  it('should handle set AI assistant failure', async () => {
    global.chrome.search.default.setSearchEngine.mockRejectedValue(new Error('API error'));
    const result = await BROWSER_API.setAIAssistant();
    expect(result.success).toBe(false);
    expect(result.error).toBe('API error');
  });

  it('should set all permissions successfully', async () => {
    const settings = {
      searchEngine: true,
      homepage: true,
      aiAssistant: true
    };
    
    const result = await BROWSER_API.setAll(settings);
    
    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(3);
    expect(global.chrome.settings.setDefaultSearch).toHaveBeenCalled();
    expect(global.chrome.browserSettings.homepage.update).toHaveBeenCalled();
    expect(global.chrome.search.default.setSearchEngine).toHaveBeenCalled();
  });

  it('should set only enabled permissions', async () => {
    const settings = {
      searchEngine: true,
      homepage: false,
      aiAssistant: true
    };
    
    const result = await BROWSER_API.setAll(settings);
    
    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(2);
    expect(global.chrome.settings.setDefaultSearch).toHaveBeenCalled();
    expect(global.chrome.browserSettings.homepage.update).not.toHaveBeenCalled();
    expect(global.chrome.search.default.setSearchEngine).toHaveBeenCalled();
  });

  it('should identify Chrome browser', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      writable: true
    });
    
    const result = BROWSER_API.getBrowserInfo();
    expect(result.name).toBe('Chrome');
    expect(result.supportsAPI).toBe(true);
  });

  it('should identify Firefox browser', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
      writable: true
    });
    
    const result = BROWSER_API.getBrowserInfo();
    expect(result.name).toBe('Firefox');
    expect(result.supportsAPI).toBe(false);
  });

  it('should identify Safari browser', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
      writable: true
    });
    
    const result = BROWSER_API.getBrowserInfo();
    expect(result.name).toBe('Safari');
    expect(result.supportsAPI).toBe(false);
  });

  it('should identify Edge browser', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
      writable: true
    });
    
    const result = BROWSER_API.getBrowserInfo();
    expect(result.name).toBe('Edge');
    expect(result.supportsAPI).toBe(true);
  });

  it('should provide Chrome instructions', () => {
    const instructions = BROWSER_API.getInstructions('Chrome');
    expect(instructions.title).toBe('Manual Setup for Chrome');
    expect(instructions.steps).toHaveLength(4);
    expect(instructions.steps[0]).toContain('Chrome settings');
  });

  it('should provide Safari instructions', () => {
    const instructions = BROWSER_API.getInstructions('Safari');
    expect(instructions.title).toBe('Manual Setup for Safari');
    expect(instructions.steps).toHaveLength(4);
    expect(instructions.steps[0]).toContain('Safari');
  });

  it('should provide Firefox instructions', () => {
    const instructions = BROWSER_API.getInstructions('Firefox');
    expect(instructions.title).toBe('Manual Setup for Firefox');
    expect(instructions.steps).toHaveLength(4);
    expect(instructions.steps[2]).toContain('truegle.com');
  });

  it('should provide Edge instructions', () => {
    const instructions = BROWSER_API.getInstructions('Edge');
    expect(instructions.title).toBe('Manual Setup for Edge');
    expect(instructions.steps).toHaveLength(4);
  });

  it('should fall back to Chrome instructions for unknown browsers', () => {
    const instructions = BROWSER_API.getInstructions('Opera');
    expect(instructions.title).toBe('Manual Setup for Chrome');
  });

  it('should handle missing chrome API gracefully', async () => {
    global.chrome = undefined;
    
    const result = await BROWSER_API.setSearchEngine();
    expect(result.success).toBe(false);
    expect(result.error).toBe('Chrome API not available');
  });

  it('should handle missing chrome.settings API', async () => {
    global.chrome.settings = undefined;
    
    const result = await BROWSER_API.setSearchEngine();
    expect(result.success).toBe(false);
    expect(result.error).toBe('Chrome API not available');
  });
});