# Extension Debugging Guide

## Issues Fixed

### 1. Missing Backend Endpoint
**Problem**: Extension was calling `/api/extension/generate-reply` but backend only had `/api/ai/generate-reply`.

**Solution**: Created new `/api/extension/generate-reply` endpoint in `packages/backend/src/routes/extension.ts` that:
- Accepts the extension's request format
- Transforms it to work with the existing AI service
- Returns responses in the format the extension expects

### 2. Authentication Mock Token
**Problem**: Extension uses `MOCK_DEV_TOKEN_FOR_TESTING` in development mode, but backend auth middleware only accepted valid Supabase JWT tokens.

**Solution**: Updated `packages/backend/src/middleware/auth.ts` to accept the mock token in development mode.

### 3. CORS Configuration
**Problem**: Backend CORS only allowed `http://localhost` origins, not `chrome-extension://` origins.

**Solution**: Updated `packages/backend/src/middleware/cors.ts` to allow chrome extension origins in development mode.

## How to Test

### 1. Start the Backend
```bash
cd packages/backend
pnpm dev  # or npm run dev
```

The backend should start on `http://localhost:3000`.

### 2. Build the Extension
```bash
cd packages/extension
npm run build
# or for development with hot reload:
npm run dev
```

### 3. Load Extension in Chrome
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `.output/chrome-mv3` directory (or `.output/chrome-mv3-dev` for dev build)

### 4. Test the Generate Button

1. Go to Twitter/X (twitter.com or x.com)
2. Click on a tweet to reply
3. Look for the "Generate" button injected by the extension
4. Click the "Generate" button
5. Open Chrome DevTools Console (F12) to see detailed logs

## Console Logs to Look For

When you click "Generate", you should see logs in this order:

### Extension Logs (Chrome DevTools Console on Twitter/X page):
```
[Auth] 🔍 === GETTING AUTH TOKEN ===
[Auth] Environment MODE: development
[Auth] Is development mode: true
[Auth] ⚠️ No auth token found - using mock token for development

[API Client] 🚀 === STARTING generateReply ===
[API Client] Base URL: http://localhost:3000
[API Client] Environment PLUKD_API_URL: undefined
[API Client] 🔑 Fetching auth token...
[API Client] ✅ Auth token retrieved: MOCK_DEV_TOKEN_FO...
[API Client] 📡 Sending fetch request...
[API Client] 📥 Response received in XXXms
[API Client] Response status: 200 OK
[API Client] ✅ Reply generated successfully!
```

### Backend Logs (Terminal where backend is running):
```
[cors] Request from origin: chrome-extension://xxxxx
[cors] ✅ Allowing chrome extension origin

[auth] ⚠️ Using mock token for development - DO NOT USE IN PRODUCTION

[extension] 🚀 Generate reply request received
[extension] User ID: mock-user-id-dev-only
[extension] ✅ Request validated
[extension] 📋 Tweet context: { textLength: 123, author: 'Username', ... }
[extension] 🤖 Generating reply with tone: casual
[extension] ✅ Reply generated in XXXms
```

## Common Issues and Solutions

### Issue: "Network error: Unable to connect to Plukd API"
**Cause**: Backend is not running or extension can't reach it.

**Solutions**:
1. Make sure backend is running on `http://localhost:3000`
2. Check backend terminal for errors
3. Verify `PLUKD_API_URL` environment variable (should be undefined in dev, defaults to localhost:3000)

### Issue: "Authentication required"
**Cause**: Auth token not being retrieved or not accepted by backend.

**Solutions**:
1. Check extension console logs for auth token retrieval
2. Verify backend is in development mode (`NODE_ENV=development`)
3. Make sure `packages/backend/src/middleware/auth.ts` has the mock token check

### Issue: "API endpoint not found (404)"
**Cause**: Extension route not registered in backend.

**Solutions**:
1. Verify `packages/backend/src/routes/extension.ts` exists
2. Check `packages/backend/src/routes/index.ts` includes: `routes.route('/extension', extensionRoutes)`
3. Restart backend after changes

### Issue: CORS errors in console
**Cause**: Backend not allowing chrome-extension:// origins.

**Solutions**:
1. Verify backend is in development mode
2. Check CORS middleware logs in backend terminal
3. Make sure `packages/backend/src/middleware/cors.ts` has chrome-extension:// handling

### Issue: Button loads forever, no logs
**Cause**: JavaScript error preventing request from being sent.

**Solutions**:
1. Check Chrome DevTools Console for JavaScript errors
2. Look at the Network tab to see if request was sent
3. Check if background script is loaded (chrome://extensions → inspect views: service worker)

## Debug Mode

### Enable Verbose Logging

The code already has extensive logging. To see all logs:

1. **Extension**: Open Chrome DevTools Console on Twitter/X page
2. **Background Script**: Go to `chrome://extensions`, find extension, click "service worker" link
3. **Backend**: Logs appear in terminal where you ran `pnpm dev`

### Network Tab Analysis

1. Open Chrome DevTools Network tab
2. Filter by "Fetch/XHR"
3. Click Generate button
4. Look for request to `http://localhost:3000/api/extension/generate-reply`
5. Check:
   - Request headers (should have `Authorization: Bearer MOCK_DEV_TOKEN_FOR_TESTING`)
   - Request payload (should have `tweetContext`, `tone`, `prompt`, `media`)
   - Response status (should be 200)
   - Response body (should have `reply` field)

## Code Changes Summary

### Backend Changes:
1. **Created**: `packages/backend/src/routes/extension.ts` - Extension-specific API route
2. **Modified**: `packages/backend/src/routes/index.ts` - Added extension routes
3. **Modified**: `packages/backend/src/middleware/auth.ts` - Accept mock token in dev mode
4. **Modified**: `packages/backend/src/middleware/cors.ts` - Allow chrome-extension:// origins in dev mode

### Extension Changes:
1. **Modified**: `packages/extension/lib/api-client.ts` - Added extensive debug logging
2. **Modified**: `packages/extension/lib/auth.ts` - Added extensive debug logging

No structural changes were made to the extension - it should work with the endpoint it was already calling.

## Next Steps

1. **Test the integration end-to-end**
2. **If it works**: Consider implementing proper Supabase authentication for production
3. **If it doesn't work**: Follow the troubleshooting steps above and check all console logs
