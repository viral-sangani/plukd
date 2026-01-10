import { browser } from 'wxt/browser';

/**
 * Retrieve authentication token from chrome.storage.session
 *
 * This function gets the auth token that should be stored after
 * the user authenticates with Plukd via Supabase.
 *
 * In development mode (when no real token exists), returns a mock token
 * for testing purposes.
 *
 * @returns The auth token or a mock token for development
 */
export async function getAuthToken(): Promise<string | null> {
    console.log('[Auth] 🔍 === GETTING AUTH TOKEN ===');
    console.log('[Auth] Environment MODE:', import.meta.env.MODE);
    console.log('[Auth] Environment DEV:', import.meta.env.DEV);

    try {
        // Try to get token from session storage first (temporary, cleared on browser close)
        console.log('[Auth] Checking session storage...');
        const sessionData = await browser.storage.session.get('plukd_auth_token');
        console.log('[Auth] Session storage result:', sessionData ? 'Has data' : 'Empty');

        if (sessionData?.plukd_auth_token) {
            const token = sessionData.plukd_auth_token;
            console.log('[Auth] ✅ Found token in session storage:', token.substring(0, 15) + '...');
            console.log('[Auth] Token length:', token.length);
            console.log('[Auth] Token type:', typeof token);
            return token;
        }

        // Fallback to local storage for persistent auth (optional)
        console.log('[Auth] Session storage empty, checking local storage...');
        const localData = await browser.storage.local.get('plukd_auth_token');
        console.log('[Auth] Local storage result:', localData ? 'Has data' : 'Empty');

        if (localData?.plukd_auth_token) {
            const token = localData.plukd_auth_token;
            console.log('[Auth] ✅ Found token in local storage:', token.substring(0, 15) + '...');
            console.log('[Auth] Token length:', token.length);
            console.log('[Auth] Token type:', typeof token);
            return token;
        }

        // Development mode: Return a mock token if no real token exists
        // This allows testing the extension without full Supabase authentication
        const isDevelopment = import.meta.env.MODE === 'development' || import.meta.env.DEV;
        console.log('[Auth] Is development mode:', isDevelopment);

        if (isDevelopment) {
            console.warn('[Auth] ⚠️ No auth token found - using mock token for development');
            console.warn('[Auth] Mock token will be used for API calls');
            return 'MOCK_DEV_TOKEN_FOR_TESTING';
        }

        console.warn('[Auth] ❌ No authentication token found. Please log in to use this extension.');
        return null;

    } catch (error) {
        console.error('[Auth] 💥 Failed to get auth token:', error);

        // Fallback to mock token in case of storage errors during development
        const isDevelopment = import.meta.env.MODE === 'development' || import.meta.env.DEV;
        if (isDevelopment) {
            console.warn('[Auth] ⚠️ Error accessing storage - using mock token for development');
            return 'MOCK_DEV_TOKEN_FOR_TESTING';
        }

        return null;
    }
}

/**
 * Store authentication token in chrome.storage
 *
 * @param token - The JWT token from Supabase auth
 * @param persistent - If true, store in local storage (persists across browser sessions)
 */
export async function setAuthToken(token: string, persistent: boolean = false): Promise<void> {
    try {
        // Always store in session storage
        await browser.storage.session.set({ plukd_auth_token: token });

        // Optionally store in local storage for persistence
        if (persistent) {
            await browser.storage.local.set({ plukd_auth_token: token });
        }

        console.log('[Auth] Token stored successfully');

    } catch (error) {
        console.error('[Auth] Failed to store auth token:', error);
        throw error;
    }
}

/**
 * Clear authentication token from storage
 */
export async function clearAuthToken(): Promise<void> {
    try {
        await browser.storage.session.remove('plukd_auth_token');
        await browser.storage.local.remove('plukd_auth_token');

        console.log('[Auth] Token cleared successfully');

    } catch (error) {
        console.error('[Auth] Failed to clear auth token:', error);
        throw error;
    }
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
    const token = await getAuthToken();
    return token !== null;
}

/**
 * Placeholder for Supabase auth integration
 *
 * This function will be implemented to handle the OAuth flow with Supabase.
 * It will:
 * 1. Open Supabase auth page in a new tab/window
 * 2. Handle the OAuth callback
 * 3. Extract the JWT token from the callback
 * 4. Store the token using setAuthToken()
 *
 * @returns Promise that resolves when authentication is complete
 */
export async function initiateSupabaseAuth(): Promise<{ success: boolean; error?: string }> {
    try {
        // TODO: Implement Supabase OAuth flow
        // For now, return a placeholder response

        console.warn('[Auth] Supabase authentication not yet implemented');

        return {
            success: false,
            error: 'Supabase authentication integration pending'
        };

    } catch (error: any) {
        console.error('[Auth] Supabase auth error:', error);
        return {
            success: false,
            error: error.message || 'Authentication failed'
        };
    }
}

/**
 * Handle Supabase OAuth callback
 *
 * This function should be called when the extension receives the OAuth callback.
 * It extracts the token from the URL and stores it.
 *
 * @param callbackUrl - The full callback URL with token parameters
 */
export async function handleSupabaseCallback(callbackUrl: string): Promise<{ success: boolean; error?: string }> {
    try {
        // TODO: Implement callback handling
        // Parse the URL to extract the access token
        // Example: #access_token=xxx&refresh_token=yyy

        const url = new URL(callbackUrl);
        const hashParams = new URLSearchParams(url.hash.slice(1));
        const accessToken = hashParams.get('access_token');

        if (!accessToken) {
            throw new Error('No access token found in callback URL');
        }

        // Store the token
        await setAuthToken(accessToken, true);

        return {
            success: true
        };

    } catch (error: any) {
        console.error('[Auth] Callback handling error:', error);
        return {
            success: false,
            error: error.message || 'Failed to process authentication callback'
        };
    }
}
