import { getAuthToken } from './auth';
import { TweetContext, MediaItem } from '@/utils/types';
import { ToneType } from '@/utils/prompts';

interface GenerateReplyRequest {
    tweetContext: TweetContext;
    tone: ToneType;
    prompt: string;
    media?: MediaItem[];
}

interface GenerateReplyResponse {
    success: boolean;
    reply?: string;
    error?: string;
}

interface SettingsResponse {
    success: boolean;
    settings?: {
        tone: ToneType;
        defaultText?: string;
        includeEmoji?: boolean;
        customTonePrompts?: Record<ToneType, string>;
    };
    error?: string;
}

interface TonePromptsResponse {
    success: boolean;
    prompts?: Record<ToneType, string>;
    error?: string;
}

export class PlukdAPIClient {
    private baseURL: string;

    constructor() {
        // Use environment variable or default to localhost for development
        this.baseURL = process.env.PLUKD_API_URL || 'http://localhost:3000';
    }

    /**
     * Generate a reply to a tweet using Plukd's backend AI service
     */
    async generateReply(
        tweetContext: TweetContext,
        tone: ToneType,
        prompt: string,
        media?: MediaItem[]
    ): Promise<GenerateReplyResponse> {
        console.log('[API Client] 🚀 === STARTING generateReply ===');
        console.log('[API Client] Base URL:', this.baseURL);
        console.log('[API Client] Environment PLUKD_API_URL:', process.env.PLUKD_API_URL);
        console.log('[API Client] Prompt length:', prompt?.length);
        console.log('[API Client] Tone:', tone);
        console.log('[API Client] Media count:', media?.length || 0);

        try {
            console.log('[API Client] 🔑 Fetching auth token...');
            const token = await getAuthToken();

            if (!token) {
                const errorMsg = 'Authentication required. Please log in to use this feature.';
                console.error('[API Client] ❌ No auth token found!');
                throw new Error(errorMsg);
            }

            console.log('[API Client] ✅ Auth token retrieved:', token.substring(0, 20) + '...');
            console.log(`[API Client] 📤 Preparing request to: ${this.baseURL}/api/extension/generate-reply`);

            const requestBody = {
                tweetContext,
                tone,
                prompt,
                media
            } as GenerateReplyRequest;

            console.log('[API Client] Request body keys:', Object.keys(requestBody));
            console.log('[API Client] Tweet context keys:', Object.keys(tweetContext));

            console.log('[API Client] 📡 Sending fetch request...');
            const startTime = Date.now();

            const response = await fetch(`${this.baseURL}/api/extension/generate-reply`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(requestBody),
                signal: AbortSignal.timeout(30000) // 30 second timeout
            });

            const endTime = Date.now();
            console.log(`[API Client] 📥 Response received in ${endTime - startTime}ms`);
            console.log(`[API Client] Response status: ${response.status} ${response.statusText}`);
            console.log('[API Client] Response headers:', JSON.stringify(Object.fromEntries(response.headers.entries())));

            if (!response.ok) {
                console.error('[API Client] ❌ Response not OK');
                const responseText = await response.text();
                console.error('[API Client] Raw response text:', responseText);

                let errorData: any = {};
                try {
                    errorData = JSON.parse(responseText);
                } catch {
                    errorData = { rawError: responseText };
                }

                const errorMessage = this.getErrorMessage(response.status, errorData);
                console.error('[API Client] Parsed error:', errorData);
                console.error('[API Client] Error message:', errorMessage);
                throw new Error(errorMessage);
            }

            console.log('[API Client] ✅ Response OK, parsing JSON...');
            const responseText = await response.text();
            console.log('[API Client] Response text length:', responseText.length);
            console.log('[API Client] Response text preview:', responseText.substring(0, 200));

            const data = JSON.parse(responseText);
            console.log('[API Client] Parsed data keys:', Object.keys(data));

            if (!data.reply) {
                console.error('[API Client] ❌ No reply field in response!');
                console.error('[API Client] Full response data:', data);
                throw new Error('API returned empty reply');
            }

            console.log('[API Client] ✅ Reply generated successfully! Length:', data.reply.length);
            console.log('[API Client] Reply preview:', data.reply.substring(0, 100) + '...');
            console.log('[API Client] 🎉 === generateReply COMPLETE ===');

            return {
                success: true,
                reply: data.reply
            };

        } catch (error: any) {
            // Enhanced error logging with full details
            console.error('[API Client] 💥 === ERROR IN generateReply ===');
            console.error('[API Client] Error type:', error.constructor.name);
            console.error('[API Client] Error details:', {
                message: error.message,
                name: error.name,
                stack: error.stack,
                cause: error.cause
            });

            // Provide user-friendly error messages based on error type
            let userMessage = error.message || 'Failed to generate reply';

            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                userMessage = 'Network error: Unable to connect to Plukd API. Please check your internet connection.';
                console.error('[API Client] 🌐 Network/CORS error detected');
            } else if (error.name === 'AbortError' || error.message.includes('timeout')) {
                userMessage = 'Request timeout: The API took too long to respond. Please try again.';
                console.error('[API Client] ⏱️ Timeout error detected');
            } else if (error.message.includes('Authentication')) {
                userMessage = 'Authentication failed: Please log in to use this feature.';
                console.error('[API Client] 🔐 Authentication error detected');
            }

            console.error('[API Client] User-facing error message:', userMessage);
            console.error('[API Client] ❌ === generateReply FAILED ===');

            return {
                success: false,
                error: userMessage
            };
        }
    }

    /**
     * Get user-friendly error message based on HTTP status code
     */
    private getErrorMessage(status: number, errorData: any): string {
        const apiError = errorData.error || errorData.message;

        switch (status) {
            case 400:
                return `Bad request: ${apiError || 'Invalid request data'}`;
            case 401:
                return 'Authentication failed: Please log in again';
            case 403:
                return 'Access denied: You do not have permission to use this feature';
            case 404:
                return 'API endpoint not found: Please update the extension';
            case 429:
                return 'Rate limit exceeded: Please wait a moment and try again';
            case 500:
            case 502:
            case 503:
                return `Server error: ${apiError || 'The API is temporarily unavailable'}`;
            case 504:
                return 'Gateway timeout: The API took too long to respond';
            default:
                return apiError || `API request failed with status ${status}`;
        }
    }

    /**
     * Get user settings from backend
     */
    async getSettings(): Promise<SettingsResponse> {
        try {
            const token = await getAuthToken();

            if (!token) {
                throw new Error('Authentication required');
            }

            const response = await fetch(`${this.baseURL}/api/extension/settings`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(
                    errorData.error ||
                    `Failed to fetch settings: ${response.status}`
                );
            }

            const data = await response.json();
            return {
                success: true,
                settings: data.settings
            };

        } catch (error: any) {
            console.error('[API Client] Get settings error:', error);
            return {
                success: false,
                error: error.message || 'Failed to fetch settings'
            };
        }
    }

    /**
     * Update user settings on backend
     */
    async updateSettings(settings: Partial<SettingsResponse['settings']>): Promise<SettingsResponse> {
        try {
            const token = await getAuthToken();

            if (!token) {
                throw new Error('Authentication required');
            }

            const response = await fetch(`${this.baseURL}/api/extension/settings`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ settings })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(
                    errorData.error ||
                    `Failed to update settings: ${response.status}`
                );
            }

            const data = await response.json();
            return {
                success: true,
                settings: data.settings
            };

        } catch (error: any) {
            console.error('[API Client] Update settings error:', error);
            return {
                success: false,
                error: error.message || 'Failed to update settings'
            };
        }
    }

    /**
     * Get tone prompts from backend
     */
    async getTonePrompts(): Promise<TonePromptsResponse> {
        try {
            const token = await getAuthToken();

            if (!token) {
                throw new Error('Authentication required');
            }

            const response = await fetch(`${this.baseURL}/api/extension/tone-prompts`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(
                    errorData.error ||
                    `Failed to fetch tone prompts: ${response.status}`
                );
            }

            const data = await response.json();
            return {
                success: true,
                prompts: data.prompts
            };

        } catch (error: any) {
            console.error('[API Client] Get tone prompts error:', error);
            return {
                success: false,
                error: error.message || 'Failed to fetch tone prompts'
            };
        }
    }

    /**
     * Check API health and authentication status
     */
    async healthCheck(): Promise<{ success: boolean; authenticated: boolean; error?: string }> {
        try {
            const token = await getAuthToken();

            const response = await fetch(`${this.baseURL}/api/health`, {
                method: 'GET',
                headers: token ? {
                    'Authorization': `Bearer ${token}`
                } : {}
            });

            if (!response.ok) {
                throw new Error(`Health check failed: ${response.status}`);
            }

            const data = await response.json();
            return {
                success: true,
                authenticated: !!token && data.authenticated !== false
            };

        } catch (error: any) {
            console.error('[API Client] Health check error:', error);
            return {
                success: false,
                authenticated: false,
                error: error.message || 'Health check failed'
            };
        }
    }
}

// Export a singleton instance
export const apiClient = new PlukdAPIClient();
