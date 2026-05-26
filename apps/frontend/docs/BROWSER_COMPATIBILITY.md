# Browser Compatibility Guide

## Overview
The Permissions Suite component provides automatic default setting for browsers that support the Chrome API, with graceful fallbacks to manual instructions for unsupported browsers.

## Supported Browsers

### Full Support (Automatic)
Users with these browsers can set permissions with one click:
- **Google Chrome** (version 88+) - chrome.settings API
- **Microsoft Edge** (version 88+, Chromium-based) - chrome.settings API
- **Brave** (Chromium-based) - chrome.settings API
- **Opera** (Chromium-based) - chrome.settings API

### Manual Setup Required
Users with these browsers will see step-by-step instructions:
- **Safari** - No API support
- **Firefox** - No API support
- **Vivaldi** - Limited API support (manual setup recommended)

## User Experience by Browser

### Chrome/Edge (Automatic)
1. User completes first search
2. Permissions modal appears
3. User toggles desired permissions
4. Clicks "Accept Selected"
5. ✅ Permissions set automatically in 1-2 seconds
6. Modal shows success message and closes

### Safari/Firefox (Manual)
1. User completes first search
2. Permissions modal appears
3. User toggles desired permissions
4. Clicks "Accept Selected"
5. ⚠️ System detects browser doesn't support automatic setup
6. Manual instructions panel slides in
7. User follows 4-5 step instructions
8. ✅ User can close modal or visit Truegle

## Detection Logic

The system detects browser using `navigator.userAgent`:

```javascript
// Chrome detection
if (ua.includes('Chrome/') && !ua.includes('Edg/')) 
  return 'Chrome'

// Edge detection
if (ua.includes('Edg/')) 
  return 'Edge'

// Firefox detection
if (ua.includes('Firefox/')) 
  return 'Firefox'

// Safari detection
if (ua.includes('Safari/') && !ua.includes('Chrome/')) 
  return 'Safari'
```

## API Support Detection

Browsers are checked for API support:

```javascript
const supportsAPI = !!(window.chrome && 
  chrome.settings && 
  chrome.settings.setDefaultSearch &&
  chrome.browserSettings &&
  chrome.browserSettings.homepage
);
```

## Manual Setup Instructions

### Chrome (fallback)
1. Open Chrome settings
2. Click "Search engine" in left sidebar
3. Click dropdown next to "Search engine used in address bar"
4. Select "Truegle"
5. For homepage: Click "On startup", select "Open a specific page", add truegle.com

### Safari
1. Open Safari
2. Click "Safari" in menu bar, then "Preferences"
3. Click "General" tab
4. Set Homepage to: truegle.com
5. Click "Search" dropdown and select "Truegle"

### Firefox
1. Open Firefox
2. Click menu button (three lines) in top-right
3. Click "Settings"
4. Set "Home Page" to: truegle.com
5. Click "Search" dropdown in search bar
6. Select "Truegle"

### Edge
1. Open Edge
2. Click menu button (three dots) in top-right
3. Click "Settings"
4. Click "Privacy, search, and services"
5. Click "Address bar and search"
6. Select "Truegle" from search engine dropdown

## Known Limitations

### Safari
- No programmatic API access
- Manual setup required every time
- Instructions vary slightly between macOS and iOS

### Firefox
- No programmatic API access
- Extension ecosystem may interfere
- Manual setup required

### Legacy Browsers
- Internet Explorer: Not supported
- Old Edge (EdgeHTML): Not supported
- Chrome <88: Limited API support

## Fallback Strategy

When automatic setup fails:

1. **Detect failure** - API call returns error
2. **Show fallback UI** - Slide in manual instructions panel
3. **Provide clear steps** - Numbered, browser-specific instructions
4. **Offer direct link** - "Visit Truegle" button for easy navigation
5. **Remember choice** - Store dismissal in localStorage for 30 days

## Testing Recommendations

To test on different browsers:

```bash
# Chrome
npm run dev
# Open http://localhost:3000 in Chrome

# Safari (Mac)
open -a Safari http://localhost:3000

# Firefox
npm run dev
# Open http://localhost:3000 in Firefox
```

**Test Checklist:**
- [ ] Modal appears after first search
- [ ] Toggles work correctly
- [ ] API integration works on Chrome
- [ ] Manual instructions display on Safari
- [ ] Permission state persists across sessions
- [ ] Modal doesn't reappear after dismissal
- [ ] Success/error messages display correctly
- [ ] Modal closes on Escape key
- [ ] Modal closes on overlay click
- [ ] Keyboard navigation works (Tab, Enter)

## Future Enhancements

Potential improvements for future versions:

1. **Firefox WebExtension** - Create extension for Firefox API access
2. **Safari App Extension** - iOS/macOS Safari extension support
3. **One-click installation** - Download extension and setup in one click
4. **Browser-specific onboarding** - Tailored instructions per browser
5. **Analytics** - Track conversion rates by browser type

## Support Matrix

| Feature | Chrome | Edge | Firefox | Safari | Brave | Opera |
|---------|--------|------|---------|--------|-------|--------|
| Automatic Setup | ✓ | ✓ | ✗ | ✗ | ✓ | ✓ |
| Manual Instructions | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Permission Persistence | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 30-day Cooldown | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| First Search Detection | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

## Troubleshooting

### Chrome API not working
**Symptoms:** "Unable to set permissions automatically" error

**Solutions:**
1. Check Chrome version (must be 88+)
2. Ensure Truegle is installed/accessible
3. Clear Chrome extensions that might interfere
4. Try Incognito mode to test

### Modal doesn't appear
**Symptoms:** No modal after first search

**Solutions:**
1. Check localStorage for `truegle_permissions_dismissed`
2. Clear localStorage and refresh
3. Check browser console for errors
4. Verify first search completed successfully

### Permission not set
**Symptoms:** Click "Accept" but nothing changes

**Solutions:**
1. Check browser permissions (blocked?)
2. Try manual setup instructions
3. Refresh browser
4. Check Truegle is accessible (network issue?)

## Developer Notes

When adding new browsers:

1. Update `getBrowserInfo()` in `browserSettings.js`
2. Add instructions in `getInstructions()`
3. Add browser to compatibility matrix
4. Update this documentation
5. Test on target browser

When modifying API:

1. Check Chrome API docs for changes
2. Test on multiple Chrome versions
3. Test on Edge (Chromium)
4. Ensure graceful degradation on failure
5. Update error handling