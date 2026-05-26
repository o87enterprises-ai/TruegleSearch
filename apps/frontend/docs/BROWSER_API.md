# Browser Settings API Integration

## Overview
The `browserSettings.js` module provides a unified interface for setting browser defaults (search engine, homepage, and AI assistant) across different browsers.

## API Reference

### `setSearchEngine()`
Sets Truegle as the default search engine.

**Returns:** `Promise<{ success: boolean, message?: string, error?: string }>`

**Example:**
```javascript
import BROWSER_API from '../api/browserSettings';

const result = await BROWSER_API.setSearchEngine();
if (result.success) {
  console.log(result.message);
}
```

### `setHomepage()`
Sets Truegle as the browser homepage.

**Returns:** `Promise<{ success: boolean, message?: string, error?: string }>`

**Example:**
```javascript
const result = await BROWSER_API.setHomepage();
if (result.success) {
  console.log('Homepage set successfully');
}
```

### `setAIAssistant()`
Sets Truegle AI as the default AI assistant.

**Returns:** `Promise<{ success: boolean, message?: string, error?: string }>`

**Example:**
```javascript
const result = await BROWSER_API.setAIAssistant();
if (result.success) {
  console.log('AI assistant set successfully');
}
```

### `setAll(settings)`
Sets multiple permissions at once.

**Parameters:**
- `settings` - Object with boolean properties: `{ searchEngine, homepage, aiAssistant }`

**Returns:** `Promise<{ success: boolean, results: Array }>`

**Example:**
```javascript
const result = await BROWSER_API.setAll({
  searchEngine: true,
  homepage: true,
  aiAssistant: false
});
```

### `getBrowserInfo()`
Detects the user's browser and API support.

**Returns:** `{ name: string, supportsAPI: boolean }`

**Example:**
```javascript
const browser = BROWSER_API.getBrowserInfo();
console.log(`Using ${browser.name}, API: ${browser.supportsAPI}`);
```

### `getInstructions(browserName)`
Returns browser-specific manual setup instructions.

**Parameters:**
- `browserName` - String: 'Chrome', 'Safari', 'Firefox', or 'Edge'

**Returns:** `{ title: string, steps: Array<string> }`

**Example:**
```javascript
const instructions = BROWSER_API.getInstructions('Safari');
console.log(instructions.title);
instructions.steps.forEach((step, index) => {
  console.log(`${index + 1}. ${step}`);
});
```

## Browser Compatibility

| Browser | API Support | Notes |
|---------|--------------|-------|
| Chrome | ✓ Full | Uses chrome.settings API |
| Edge | ✓ Full | Uses chrome.settings API (Chromium) |
| Firefox | ✗ None | Requires manual setup |
| Safari | ✗ None | Requires manual setup |

## Error Handling

All API methods catch errors and return a consistent error object:

```javascript
{
  success: false,
  error: 'Error message describing what went wrong'
}
```

Common errors:
- `Chrome API not available` - Browser doesn't support the API
- `Permission denied` - User denied the permission request
- `API error` - Generic browser API error

## Usage in Components

```javascript
import BROWSER_API from '../api/browserSettings';

const MyComponent = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleSetDefaults = async () => {
    setLoading(true);
    const apiResult = await BROWSER_API.setAll({
      searchEngine: true,
      homepage: true,
      aiAssistant: true
    });
    setResult(apiResult);
    setLoading(false);
  };

  return (
    <button onClick={handleSetDefaults} disabled={loading}>
      {loading ? 'Setting defaults...' : 'Set as Default'}
    </button>
  );
};
```

## Security Considerations

- The API only sets browser defaults when explicitly requested by the user
- No automatic or silent changes to browser settings
- All user interactions require explicit user consent
- Browser permissions are requested only when needed
- Fallback to manual instructions ensures transparency

## Testing

To test the API without a real Chrome browser:

```javascript
// Mock the Chrome API
global.chrome = {
  settings: {
    setDefaultSearch: vi.fn()
  },
  browserSettings: {
    homepage: {
      update: vi.fn()
    }
  }
};

// Your test code...
```