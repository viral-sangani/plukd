import { DEFAULT_SETTINGS, DEBUG, LIMITS } from './constants';
import { Settings, UsageStats } from './types';
import { browser } from 'wxt/browser';
import { DEFAULT_TONE_PROMPTS, ToneType } from './prompts';

// Storage utilities with encryption support

// Encrypt sensitive data
async function encryptData(text: string, password = 'x-auto-reply-default') {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);

    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveBits', 'deriveKey']
    );

    const key = await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: encoder.encode('x-auto-reply-salt'),
            iterations: 100000,
            hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt']
    );

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        data
    );

    return {
        encrypted: Array.from(new Uint8Array(encrypted)),
        iv: Array.from(iv)
    };
}

// Decrypt sensitive data
async function decryptData(encryptedData: { iv: number[]; encrypted: number[] }, password = 'x-auto-reply-default') {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveBits', 'deriveKey']
    );

    const key = await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: encoder.encode('x-auto-reply-salt'),
            iterations: 100000,
            hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
    );

    const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: new Uint8Array(encryptedData.iv) },
        key,
        new Uint8Array(encryptedData.encrypted)
    );

    return decoder.decode(decrypted);
}

// Enhanced storage wrapper with encryption and validation
export const secureStorage = {
    async set(key: string, value: any, encrypt = false) {
        try {
            if (encrypt && typeof value === 'string' && value.trim()) {
                value = await encryptData(value);
            }
            await browser.storage.local.set({ [key]: value });
            return true;
        } catch (error) {
            console.error('Failed to store data:', error);
            return false;
        }
    },

    async get(key: string, decrypt = false) {
        try {
            const result = await browser.storage.local.get(key);
            let value = result[key];

            if (decrypt && value && value.encrypted && value.iv) {
                try {
                    value = await decryptData(value);
                } catch (decryptError) {
                    console.error('Failed to decrypt data:', decryptError);
                    return null;
                }
            }

            return value;
        } catch (error) {
            console.error('Failed to retrieve data:', error);
            return null;
        }
    },

    async remove(key: string) {
        try {
            await browser.storage.local.remove(key);
            return true;
        } catch (error) {
            console.error('Failed to remove data:', error);
            return false;
        }
    },

    async clear() {
        try {
            await browser.storage.local.clear();
            return true;
        } catch (error) {
            console.error('Failed to clear storage:', error);
            return false;
        }
    },

    // Test storage functionality
    async testStorage() {
        try {
            const testKey = 'storage_test';
            const testValue = 'test_data_' + Date.now();

            await this.set(testKey, testValue);
            const retrieved = await this.get(testKey);
            await this.remove(testKey);

            return retrieved === testValue;
        } catch (error) {
            console.error('Storage test failed:', error);
            return false;
        }
    }
};

// Enhanced settings management with secure API key storage
export const settingsManager = {
    // Supported AI providers
    PROVIDERS: {
        GEMINI: 'gemini',
        OPENROUTER: 'openrouter',
        OPENAI: 'openai',
        DEEPSEEK: 'deepseek',
        CLAUDE: 'claude'
    },

    async load(): Promise<Settings> {
        try {
            const result = await browser.storage.local.get(['settings']);
            const settings = { ...DEFAULT_SETTINGS, ...result.settings };

            // Load encrypted API keys
            await this.loadApiKeys(settings);

            // @ts-ignore
            return settings;
        } catch (error) {
            console.error('Failed to load settings:', error);
            // @ts-ignore
            return DEFAULT_SETTINGS;
        }
    },

    async loadApiKeys(settings: any) {
        try {
            // Load all encrypted API keys
            const providers = Object.values(this.PROVIDERS);
            for (const provider of providers) {
                const keyName = `${provider}Key`;
                const encryptedKey = await secureStorage.get(`api_key_${provider}`, true);
                if (encryptedKey) {
                    settings[keyName] = encryptedKey;
                }
            }
        } catch (error) {
            console.error('Failed to load API keys:', error);
        }
    },

    async save(settings: Settings) {
        try {
            // Validate settings before saving
            const validatedSettings = validateSettings(settings);

            // Save API keys securely
            await this.saveApiKeys(validatedSettings);

            // Remove API keys from main settings object before saving
            const settingsToStore = { ...validatedSettings };
            Object.values(this.PROVIDERS).forEach(provider => {
                // @ts-ignore
                delete settingsToStore[`${provider}Key`];
            });

            await browser.storage.local.set({ settings: settingsToStore });
            return validatedSettings;
        } catch (error) {
            console.error('Failed to save settings:', error);
            throw error;
        }
    },

    async saveApiKeys(settings: Settings) {
        try {
            const providers = Object.values(this.PROVIDERS);
            for (const provider of providers) {
                const keyName = `${provider}Key`;
                // @ts-ignore
                const apiKey = settings[keyName];

                if (apiKey && apiKey.trim()) {
                    await secureStorage.set(`api_key_${provider}`, apiKey.trim(), true);
                }
            }
        } catch (error) {
            console.error('Failed to save API keys:', error);
            throw error;
        }
    },

    async reset() {
        try {
            // Clear encrypted API keys
            const providers = Object.values(this.PROVIDERS);
            for (const provider of providers) {
                await secureStorage.remove(`api_key_${provider}`);
            }

            await browser.storage.local.set({ settings: DEFAULT_SETTINGS });
            return DEFAULT_SETTINGS;
        } catch (error) {
            console.error('Failed to reset settings:', error);
            throw error;
        }
    },

    async getApiKey(provider = 'gemini') {
        try {
            if (!Object.values(this.PROVIDERS).includes(provider)) {
                throw new Error(`Unsupported provider: ${provider}`);
            }

            const encryptedKey = await secureStorage.get(`api_key_${provider}`, true);
            return encryptedKey || '';
        } catch (error) {
            console.error('Failed to get API key:', error);
            return '';
        }
    },

    async setApiKey(apiKey: string, provider = 'gemini') {
        try {
            if (!Object.values(this.PROVIDERS).includes(provider)) {
                throw new Error(`Unsupported provider: ${provider}`);
            }

            if (apiKey && apiKey.trim()) {
                await secureStorage.set(`api_key_${provider}`, apiKey.trim(), true);
            } else {
                await secureStorage.remove(`api_key_${provider}`);
            }
        } catch (error) {
            console.error('Failed to set API key:', error);
            throw error;
        }
    },

    async validateApiKey(apiKey: string, provider: string) {
        if (!apiKey || !apiKey.trim()) return false;

        const key = apiKey.trim();

        switch (provider) {
            case this.PROVIDERS.GEMINI:
                return key.startsWith('AIza') && key.length > 30;
            case this.PROVIDERS.OPENROUTER:
                return key.startsWith('sk-or-') && key.length > 20;
            case this.PROVIDERS.OPENAI:
                return key.startsWith('sk-') && key.length > 40;
            case this.PROVIDERS.DEEPSEEK:
                return key.startsWith('sk-') && key.length > 30;
            case this.PROVIDERS.CLAUDE:
                return key.startsWith('sk-ant-') && key.length > 40;
            default:
                return false;
        }
    },

    async testStoragePersistence() {
        try {
            const testKey = 'test_persistence_' + Date.now();
            const testValue = 'persistence_test_value';

            await secureStorage.set(`api_key_test`, testValue, true);
            const retrieved = await secureStorage.get(`api_key_test`, true);
            await secureStorage.remove(`api_key_test`);

            return retrieved === testValue;
        } catch (error) {
            console.error('Storage persistence test failed:', error);
            return false;
        }
    }
};

// Validate settings object
function validateSettings(settings: Settings): Settings {
    // @ts-ignore
    const validated: Settings = { ...DEFAULT_SETTINGS };

    // Validate enabled
    if (typeof settings.enabled === 'boolean') {
        validated.enabled = settings.enabled;
    }

    // Validate provider
    if (typeof settings.provider === 'string' && ['gemini', 'openrouter', 'openai', 'deepseek', 'claude'].includes(settings.provider)) {
        validated.provider = settings.provider;
    }

    // Validate API keys
    if (typeof settings.geminiKey === 'string') {
        validated.geminiKey = settings.geminiKey.trim();
    }

    if (typeof settings.openRouterKey === 'string') {
        validated.openRouterKey = settings.openRouterKey.trim();
    }

    // Validate OpenRouter model
    if (typeof settings.openRouterModel === 'string') {
        validated.openRouterModel = settings.openRouterModel.trim();
    }

    // Validate tone
    if (typeof settings.tone === 'string') {
        validated.tone = settings.tone;
    }

    // Validate word counts
    if (typeof settings.minWords === 'number' &&
        settings.minWords >= LIMITS.MIN_WORD_COUNT &&
        settings.minWords <= LIMITS.MAX_WORD_COUNT) {
        validated.minWords = Math.floor(settings.minWords);
    }

    if (typeof settings.maxWords === 'number' &&
        settings.maxWords >= LIMITS.MIN_WORD_COUNT &&
        settings.maxWords <= LIMITS.MAX_WORD_COUNT &&
        settings.maxWords > validated.minWords) {
        validated.maxWords = Math.floor(settings.maxWords);
    }

    // Validate hashtag
    if (typeof settings.defaultHashtag === 'string') {
        let hashtag = settings.defaultHashtag.trim();
        if (hashtag && !hashtag.startsWith('#')) {
            hashtag = '#' + hashtag;
        }
        if (hashtag.length <= LIMITS.MAX_HASHTAG_LENGTH) {
            validated.defaultHashtag = hashtag;
        }
    }

    // Validate emoji setting
    if (typeof settings.includeEmoji === 'boolean') {
        validated.includeEmoji = settings.includeEmoji;
    }

    // Validate delay range
    if (typeof settings.delayRange === 'string' &&
        ['3-8', '5-15', '10-25'].includes(settings.delayRange)) {
        validated.delayRange = settings.delayRange;
    }

    // Validate typing speed
    if (typeof settings.typingSpeed === 'string' &&
        ['slow', 'normal', 'fast'].includes(settings.typingSpeed)) {
        // @ts-ignore
        validated.typingSpeed = settings.typingSpeed;
    }

    // Validate custom tone prompts
    if (settings.customTonePrompts && typeof settings.customTonePrompts === 'object') {
        validated.customTonePrompts = { ...DEFAULT_TONE_PROMPTS };
        // Merge user's custom prompts with defaults
        Object.keys(settings.customTonePrompts).forEach(key => {
            if (key in DEFAULT_TONE_PROMPTS) {
                validated.customTonePrompts![key as ToneType] = settings.customTonePrompts![key as ToneType];
            }
        });
    } else {
        validated.customTonePrompts = DEFAULT_TONE_PROMPTS;
    }

    return validated;
}

// Usage statistics
export const usageStats = {
    async record(action: string, data = {}) {
        try {
            const stats = await this.get();
            const today = new Date().toISOString().split('T')[0];

            if (!stats[today]) {
                stats[today] = {};
            }

            if (!stats[today][action]) {
                stats[today][action] = 0;
            }

            // @ts-ignore
            stats[today][action]++;

            // Store additional data if provided
            if (Object.keys(data).length > 0) {
                if (!stats[today].data) {
                    stats[today].data = [];
                }
                stats[today].data!.push({
                    action,
                    timestamp: new Date().toISOString(),
                    ...data
                });
            }

            await browser.storage.local.set({ usageStats: stats });
        } catch (error) {
            console.error('Failed to record usage stats:', error);
        }
    },

    async get(): Promise<UsageStats> {
        try {
            const result = await browser.storage.local.get(['usageStats']);
            return result.usageStats || {};
        } catch (error) {
            console.error('Failed to get usage stats:', error);
            return {};
        }
    },

    async getTodayStats() {
        try {
            const stats = await this.get();
            const today = new Date().toISOString().split('T')[0];
            return stats[today] || {};
        } catch (error) {
            console.error('Failed to get today stats:', error);
            return {};
        }
    },

    async clear() {
        try {
            await browser.storage.local.remove(['usageStats']);
        } catch (error) {
            console.error('Failed to clear usage stats:', error);
        }
    }
};

// Debug storage
export const debugStorage = {
    async log(level: string, message: string, data = {}) {
        try {
            const debugMode = await browser.storage.local.get(['debugMode']);
            if (!debugMode.debugMode) return;

            const logs = await this.getLogs();
            const logEntry = {
                timestamp: new Date().toISOString(),
                level,
                message,
                data
            };

            logs.push(logEntry);

            // Keep only last 100 logs
            if (logs.length > 100) {
                logs.splice(0, logs.length - 100);
            }

            await browser.storage.local.set({ debugLogs: logs });

            // Also console log
            console.log(`${DEBUG.prefix} [${level.toUpperCase()}]`, message, data);
        } catch (error) {
            console.error('Failed to store debug log:', error);
        }
    },

    async getLogs() {
        try {
            const result = await browser.storage.local.get(['debugLogs']);
            return result.debugLogs || [];
        } catch (error) {
            console.error('Failed to get debug logs:', error);
            return [];
        }
    },

    async clearLogs() {
        try {
            await browser.storage.local.remove(['debugLogs']);
        } catch (error) {
            console.error('Failed to clear debug logs:', error);
        }
    },

    async exportLogs() {
        try {
            const logs = await this.getLogs();
            const dataStr = JSON.stringify(logs, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);

            const link = document.createElement('a');
            link.href = url;
            link.download = `x-auto-reply-debug-logs-${Date.now()}.json`;
            link.click();

            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Failed to export debug logs:', error);
        }
    }
};

// Cache management for temporary data
export const cacheManager = {
    async set(key: string, value: any, ttlMinutes = 60) {
        try {
            const cacheData = {
                value,
                expires: Date.now() + (ttlMinutes * 60 * 1000)
            };
            // @ts-ignore
            await browser.storage.session.set({ [`cache_${key}`]: cacheData });
        } catch (error) {
            console.error('Failed to set cache:', error);
        }
    },

    async get(key: string) {
        try {
            // @ts-ignore
            const result = await browser.storage.session.get([`cache_${key}`]);
            const cacheData = result[`cache_${key}`];

            if (!cacheData) return null;

            if (Date.now() > cacheData.expires) {
                await this.remove(key);
                return null;
            }

            return cacheData.value;
        } catch (error) {
            console.error('Failed to get cache:', error);
            return null;
        }
    },

    async remove(key: string) {
        try {
            // @ts-ignore
            await browser.storage.session.remove([`cache_${key}`]);
        } catch (error) {
            console.error('Failed to remove cache:', error);
        }
    },

    async clear() {
        try {
            // @ts-ignore
            const all = await browser.storage.session.get();
            const cacheKeys = Object.keys(all).filter(key => key.startsWith('cache_'));
            // @ts-ignore
            await browser.storage.session.remove(cacheKeys);
        } catch (error) {
            console.error('Failed to clear cache:', error);
        }
    }
};
