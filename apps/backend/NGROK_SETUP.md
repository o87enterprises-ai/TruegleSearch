# Ngrok Setup Guide

This guide explains how to set up ngrok to access your Truegle backend from external devices (phones, tablets, other computers).

## What is Ngrok?

Ngrok creates a secure tunnel from a public URL to your localhost, allowing you to test your app on external devices without deploying.

## Quick Start

### 1. Install Ngrok

```bash
# macOS (with Homebrew)
brew install ngrok/ngrok/ngrok

# Or download from https://ngrok.com/download
```

### 2. Create Free Account (Optional but Recommended)

Visit [ngrok.com](https://ngrok.com) and sign up for a free account.

### 3. Authenticate (if you have an account)

```bash
ngrok config add-authtoken YOUR_AUTH_TOKEN
```

### 4. Start Your Backend Server

```bash
cd apps/backend
npm start
```

The backend should start on port 3001.

### 5. Start Ngrok Tunnel

In a new terminal:

```bash
ngrok http 3001
```

You'll see output like:

```
Session Status                online
Account                       your-account (Plan: Free)
Version                       3.x.x
Region                        United States (us)
Latency                       -
Web Interface                 http://127.0.0.1:4040
Forwarding                    https://abc123.ngrok-free.app -> http://localhost:3001
```

### 6. Use Your Ngrok URL

Copy the HTTPS forwarding URL (e.g., `https://abc123.ngrok-free.app`) and use it as your backend URL.

**Important:** Always use the HTTPS URL, not the HTTP one.

## Testing Your Setup

Run the test script:

```bash
node scripts/test-ngrok.js https://your-ngrok-url.ngrok-free.app
```

This will test:
- Health endpoint
- Search functionality
- AI service connectivity
- CORS configuration

## Using with Frontend

### Option 1: Environment Variable

Update your frontend `.env` file:

```bash
VITE_BACKEND_URL=https://your-ngrok-url.ngrok-free.app
```

Then restart your frontend:

```bash
cd apps/frontend
npm run dev
```

### Option 2: Dynamic Configuration

The frontend automatically detects if it's running on ngrok and uses the same domain for the backend.

## Troubleshooting

### Issue: "Tunnel not found" or 404 errors

**Solution:** Make sure your backend is running on port 3001 before starting ngrok.

### Issue: CORS errors

**Solution:** This should be fixed with the latest CORS configuration. If you still see errors:

1. Check the browser console for the exact error
2. Verify the ngrok URL is correct
3. Make sure you're using HTTPS, not HTTP

### Issue: Ngrok browser warning page

**Solution:** The backend now automatically bypasses this with the `ngrok-skip-browser-warning` header.

### Issue: "Failed to fetch" errors

**Solution:**
1. Verify ngrok tunnel is active: check `http://127.0.0.1:4040` for tunnel status
2. Ensure backend server is running
3. Check firewall settings

### Issue: Slow response times

**Solution:** This is normal with the free ngrok tier. Consider:
- Using a paid ngrok plan for better performance
- Testing on local network instead (use IP address)
- Deploying to a real server for production use

## Advanced Configuration

### Custom Domain (Paid Plans)

```bash
ngrok http 3001 --domain=your-custom-domain.ngrok.app
```

### Fixed URL (Paid Plans)

With a paid plan, you can get a fixed URL that doesn't change:

```bash
ngrok http 3001 --domain=truegle-backend.ngrok.app
```

### Local Network Testing (Alternative)

If all devices are on the same WiFi:

1. Find your computer's local IP:
   ```bash
   # macOS/Linux
   ifconfig | grep "inet "

   # Windows
   ipconfig
   ```

2. Use `http://YOUR_LOCAL_IP:3001` as the backend URL

## CORS Configuration

The backend is configured to accept requests from:
- ✅ Localhost (all ports)
- ✅ Local network IPs (192.168.x.x, 10.x.x.x)
- ✅ All ngrok domains (*.ngrok.io, *.ngrok-free.app, *.ngrok.app)
- ✅ Vercel deployments
- ✅ Custom domains

This configuration is in `server.js` under the `corsOptions` object.

## Security Notes

⚠️ **Important Security Considerations:**

1. **Ngrok URLs are public** - Anyone with the URL can access your backend
2. **Don't share sensitive data** through ngrok tunnels
3. **Use authentication** - The backend has JWT auth enabled
4. **Free tier limitations** - Free ngrok URLs expire and change
5. **Rate limiting** - The backend has rate limiting enabled

For production use, deploy to a real server (Vercel, Heroku, AWS, etc.).

## Useful Ngrok Commands

```bash
# Start tunnel
ngrok http 3001

# Start with custom subdomain (requires paid plan)
ngrok http 3001 --subdomain=truegle-backend

# View web interface (tunnel status, requests)
open http://127.0.0.1:4040

# Stop tunnel
Ctrl+C

# View tunnel status
ngrok status
```

## Next Steps

Once ngrok is working:

1. Update frontend `VITE_BACKEND_URL` environment variable
2. Test search functionality from external device
3. Test AI chat from external device
4. Monitor requests in ngrok web interface (http://127.0.0.1:4040)

## Support

If you encounter issues:

1. Check ngrok web interface: http://127.0.0.1:4040
2. Run test script: `node scripts/test-ngrok.js YOUR_NGROK_URL`
3. Check backend logs for errors
4. Verify CORS configuration in `server.js`

Happy testing! 🚀
