// X Auto Reply Assistant - Content Script

// import { defineContentScript } from 'wxt/sandbox'; // Relying on auto-imports
import '@/assets/tailwind.css';
import '@/assets/twitter.css';
import {
    SELECTORS,
    CSS_CLASSES,
    BUTTON_STATES,
    ERROR_MESSAGES
} from '@/utils/constants';
import {
    detectTweetLanguage,
    extractTweetContext
} from '@/utils/twitter-helpers';
import { buildAiPrompt } from '@/utils/ai-helpers';
import { TweetContext, MediaItem } from '@/utils/types';

// Define explicit types
interface Settings {
    enabled: boolean;
    provider: string;
    geminiKey: string;
    openRouterKey: string;
    openaiKey: string;
    deepseekKey: string;
    claudeKey: string;
    // Removed minWords/maxWords
    defaultText: string;
    includeEmoji: boolean;
    tone: string;
    [key: string]: any;
}

interface GeneratorPreferences {
    tone?: string;
    // Removed minWords/maxWords
    includeEmoji?: boolean;
    includeMedia?: boolean;
    includeThread?: boolean; // New
}

interface State {
    isGenerating: boolean;
    observers: MutationObserver[];
    injectedButtons: Set<HTMLElement>;
    timers: Set<number>;
    isCleanedUp: boolean;
}

export default defineContentScript({
    matches: ['https://twitter.com/*', 'https://x.com/*', 'https://pro.x.com/*'],
    runAt: 'document_idle',
    main() {
        console.log('🚀 [CONTENT] X Auto Reply Assistant content script loaded');

        const STATE: State = {
            isGenerating: false,
            observers: [],
            injectedButtons: new Set(),
            timers: new Set(),
            isCleanedUp: false
        };

        let settings: any = {
            enabled: true,
            provider: 'gemini',
            geminiKey: '',
            openRouterKey: '',
            openaiKey: '',
            deepseekKey: '',
            claudeKey: '',
            defaultText: '',
            includeEmoji: true,
            tone: 'casual'
        };

        const injectedComposerButtons = new WeakSet<HTMLElement>();

        const PREF_STORAGE_KEY = 'generator_preferences';

        // Initialize
        async function init() {
            try {
                // Inject Barlow Font
                if (!document.querySelector('#ai-barlow-font')) {
                    const link = document.createElement('link');
                    link.id = 'ai-barlow-font';
                    link.href = 'https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&display=swap';
                    link.rel = 'stylesheet';
                    document.head.appendChild(link);
                }

                await loadSettings();
                setupObserver();
                setupPoller(); // Add reliable backup poller
                setupKeyboardShortcuts(); // Setup keyboard shortcuts

                // Reset state to ensure clean injection on reload
                resetState();

                // Initial check
                checkForComposer();

                // Message listener
                browser.runtime.onMessage.addListener((request: any, sender, sendResponse) => {
                    try {
                        handleMessage(request);
                    } catch (error) {
                        console.error('[X Auto Reply] Error handling message:', error);
                    }
                });

                console.log('[X Auto Reply] Initialized successfully');
            } catch (error) {
                console.error('Failed to initialize:', error);
            }
        }

        // Setup keyboard shortcuts
        function setupKeyboardShortcuts() {
            document.addEventListener('keydown', (e: KeyboardEvent) => {
                const panel = document.querySelector('#ai-reply-inline-panel');
                const toggleBtn = document.querySelector('#ai-reply-toggle-btn') as HTMLElement;
                const generateBtn = document.querySelector('#ai-generate-btn') as HTMLButtonElement;

                // Cmd/Ctrl + Shift + A: Toggle inline panel
                if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'A') {
                    e.preventDefault();
                    if (toggleBtn) {
                        toggleBtn.click();
                    }
                    return;
                }

                // Only handle Enter/Esc if panel is visible
                const isPanelVisible = panel && !panel.classList.contains('tw-hidden');
                if (!isPanelVisible) return;

                // Enter: Generate reply (if not already generating)
                if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
                    if (generateBtn && !generateBtn.disabled) {
                        e.preventDefault();
                        generateBtn.click();
                    }
                    return;
                }

                // Esc: Close panel
                if (e.key === 'Escape') {
                    e.preventDefault();
                    panel?.classList.add('tw-hidden');
                    if (toggleBtn) {
                        toggleBtn.setAttribute('aria-expanded', 'false');
                    }
                    return;
                }
            });
        }

        async function loadSettings() {
            try {
                const result = await browser.storage.local.get(['settings']);
                if (result.settings) {
                    settings = result.settings;
                } else {
                    // Ensure defaults are set if storage is empty
                    settings = {
                        enabled: true,
                        provider: 'gemini',
                        geminiKey: '',
                        openRouterKey: '',
                        openaiKey: '',
                        deepseekKey: '',
                        claudeKey: '',
                        defaultText: '',
                        includeEmoji: true,
                        tone: 'casual'
                    };
                }
            } catch (error) {
                console.error('❌ [CONTENT] Failed to load settings:', error);
            }
        }

        function setupObserver() {
            if (STATE.isCleanedUp) return;

            // Throttle observer to prevent performance issues
            let timer: any;
            const observer = new MutationObserver((mutations) => {
                if (STATE.isCleanedUp) return;
                if (timer) clearTimeout(timer);
                timer = setTimeout(() => {
                    checkForComposer();
                }, 300); // Check every 300ms after mutations stop
            });

            try {
                observer.observe(document.body, {
                    childList: true,
                    subtree: true,
                    attributes: true, // Also watch for attribute changes (e.g. disabled state)
                    attributeFilter: ['disabled', 'class']
                });
                STATE.observers.push(observer);
            } catch (error) {
                console.error('Failed to setup observer:', error);
            }
        }

        function setupPoller() {
            // Backup check every 1.5s in case observer misses hydration
            const pollerId = setInterval(() => {
                if (STATE.isCleanedUp) {
                    clearInterval(pollerId);
                    return;
                }
                checkForComposer();
            }, 1500);
            STATE.timers.add(pollerId as unknown as number);
        }

        function addTrackedTimer(callback: Function, delay: number) {
            const timer = setTimeout(callback, delay) as unknown as number;
            STATE.timers.add(timer);
            return timer;
        }

        function handleMessage(request: any) {
            if (request.action === 'settingsUpdated') {
                settings = request.settings;
                console.log('Settings updated in content script');
            }
        }

        function sleep(ms: number) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        // Fetch an image URL and convert to base64
        async function fetchImageAsBase64(url: string): Promise<{ base64: string; mimeType: string }> {
            const response = await fetch(url);
            const blob = await response.blob();
            const mimeType = blob.type || 'image/jpeg';

            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const result = reader.result as string;
                    // Remove the data:image/...;base64, prefix
                    const base64 = result.split(',')[1];
                    resolve({ base64, mimeType });
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        }

        // --- UI Injection Logic ---

        function resetState() {
            console.log('[X Auto Reply] Resetting state and cleaning up old buttons...');

            // 1. Remove ALL injected buttons (both legacy and current version) to ensure fresh start
            const allButtons = document.querySelectorAll('.ai-tweet-btn, .auto-reply-btn');
            allButtons.forEach(btn => btn.remove());

            // 2. Clear data attributes from tweet buttons so we can re-inject
            const tweetButtons = document.querySelectorAll('[data-wxt-ai-injected="true"]');
            tweetButtons.forEach(btn => btn.removeAttribute('data-wxt-ai-injected'));

            // 3. Reset internal sets
            injectedComposerButtons.delete(document.body); // Just to access specific method if needed, but WeakSet doesn't support clear. 
            // We just rely on the DOM attribute since WeakSet is per-instance anyway.
        }

        function cleanupLegacyElements() {
            // Aggressively remove any old "Auto Reply" buttons or wrappers
            const legacySelectors = [
                '.auto-reply-wrapper',
                // '.auto-reply-btn' // Handled by resetState
            ];

            legacySelectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                elements.forEach(el => {
                    // console.log('[X Auto Reply] Removing legacy element:', el);
                    el.remove();
                });
            });

            // Manual text check for buttons that might strictly match "Auto Reply" text
            document.querySelectorAll('button').forEach(btn => {
                if (btn.textContent?.includes('Auto Reply') || btn.textContent?.includes('✨ Auto Reply')) {
                    // console.log('[X Auto Reply] Removing legacy text button:', btn);
                    btn.remove();
                }
            });
        }

        // Reference implementation: Aggressive Global Check
        function checkForComposer() {
            if (!settings || !settings.enabled) return;

            // Target the specific IDs used by Twitter for "Post" buttons
            // [data-testid="tweetButtonInline"] -> Main composer, reply composer
            // [data-testid="tweetButton"] -> Modal composer
            const selector = '[data-testid="tweetButtonInline"], [data-testid="tweetButton"]';
            const potentialButtons = document.querySelectorAll(selector);

            potentialButtons.forEach((btn) => {
                const button = btn as HTMLElement;

                // Skip if already handled
                if (button.dataset.wxtAiInjected === 'true') return;

                // Ensure it's visible/rendered
                if (button.offsetParent === null) return;

                // STRICT CHECK (Option 2):
                // If it's an inline button (not modal), it MUST be inside a proper toolbar.
                // This filters out "sticky header" buttons which are usually standalone or in a different container.
                const isInline = button.getAttribute('data-testid') === 'tweetButtonInline';
                const hasToolbarParent = button.closest('[data-testid="toolBar"]');

                if (isInline && !hasToolbarParent) return;

                // Basic check to ensure it's a button-like element
                if (button.closest('[role="button"]') || button.tagName === 'BUTTON' || button.getAttribute('role') === 'button') {
                    injectTweetGeneratorButton(button);
                }
            });
        }

        function injectTweetGeneratorButton(submitButton: HTMLElement) {
            // Re-check injection flag
            if (submitButton.dataset.wxtAiInjected === 'true') return;

            const parent = submitButton.parentElement;
            if (!parent) return;

            // Avoid duplicates physically
            if (parent.querySelector('.tw-ai-reply-button')) {
                submitButton.dataset.wxtAiInjected = 'true';
                return;
            }

            console.log('✨ [Twitter] Injecting AI Button for:', submitButton);

            const aiBtn = document.createElement('button');
            // Styling: Minimal monochromatic button
            aiBtn.id = 'ai-reply-toggle-btn';
            aiBtn.className = 'tw-ai-reply-toggle tw-mr-2 tw-inline-flex tw-items-center tw-gap-1.5 tw-rounded-md tw-px-2.5 tw-py-1.5 tw-text-xs tw-font-medium tw-text-gray-400 tw-bg-transparent tw-border tw-border-gray-800 tw-transition-all hover:tw-bg-gray-900 hover:tw-text-gray-300 hover:tw-border-gray-700 focus:tw-outline-none';
            aiBtn.setAttribute('aria-label', 'Toggle AI reply generator');
            aiBtn.setAttribute('aria-expanded', 'false');
            aiBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" class="tw-w-3.5 tw-h-3.5">
                    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <span>AI</span>
            `;

            aiBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();

                // Toggle inline panel
                await toggleInlinePanel(aiBtn, submitButton);
            });

            // Insert BEFORE the submit button
            parent.insertBefore(aiBtn, submitButton);

            // Mark as injected
            submitButton.dataset.wxtAiInjected = 'true';
            STATE.injectedButtons.add(aiBtn);
        }

        // Toggle inline panel visibility
        async function toggleInlinePanel(button: HTMLElement, submitButton: HTMLElement) {
            const existingPanel = document.querySelector('#ai-reply-inline-panel');
            const isExpanded = button.getAttribute('aria-expanded') === 'true';

            if (isExpanded && existingPanel) {
                // Close panel
                existingPanel.classList.add('tw-hidden');
                button.setAttribute('aria-expanded', 'false');
            } else {
                // Open panel
                if (!existingPanel) {
                    // Create panel if it doesn't exist
                    const composerContainer = submitButton.closest('[data-testid="toolBar"]')?.parentElement;
                    if (!composerContainer) {
                        console.error('Could not find composer container');
                        return;
                    }

                    const newPanel = await createInlinePanel(composerContainer);
                    composerContainer.appendChild(newPanel);
                    attachPanelEventListeners(newPanel, submitButton);
                }

                const panel = document.querySelector('#ai-reply-inline-panel');
                panel?.classList.remove('tw-hidden');
                button.setAttribute('aria-expanded', 'true');
            }
        }

        // Attach event listeners to panel elements
        function attachPanelEventListeners(panel: HTMLElement, submitButton: HTMLElement) {
            // Tone button clicks
            panel.querySelectorAll('.tw-tone-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    panel.querySelectorAll('.tw-tone-btn').forEach(b => b.classList.remove('tw-selected'));
                    btn.classList.add('tw-selected');

                    const tone = (btn as HTMLElement).dataset.tone;
                    // Save preference
                    if (tone) {
                        browser.storage.local.set({
                            [PREF_STORAGE_KEY]: { ...{}, tone }
                        }).catch(console.error);
                    }
                });
            });

            // Generate button
            const generateBtn = panel.querySelector('#ai-generate-btn');
            generateBtn?.addEventListener('click', async () => {
                const selectedTone = (panel.querySelector('.tw-tone-btn.tw-selected') as HTMLElement)?.dataset.tone || 'casual';
                await handleInlinePanelGeneration(selectedTone, panel, submitButton);
            });

            // Settings button - opens extension popup
            const settingsBtn = panel.querySelector('#ai-panel-settings-btn');
            settingsBtn?.addEventListener('click', () => {
                browser.runtime.sendMessage({ action: 'openPopup' }).catch(console.error);
            });

            // Close button
            const closeBtn = panel.querySelector('#ai-panel-close-btn');
            closeBtn?.addEventListener('click', () => {
                panel.classList.add('tw-hidden');
                const toggleBtn = document.querySelector('#ai-reply-toggle-btn');
                toggleBtn?.setAttribute('aria-expanded', 'false');
            });
        }

        // Handle generation from inline panel
        async function handleInlinePanelGeneration(tone: string, panel: HTMLElement, submitButton: HTMLElement) {
            const generateBtn = panel.querySelector('#ai-generate-btn') as HTMLButtonElement;
            const loadingState = panel.querySelector('#ai-loading-state');
            const errorState = panel.querySelector('#ai-error-state');

            try {
                console.log('[CONTENT] Starting generation with tone:', tone);

                // Show loading
                if (generateBtn) generateBtn.disabled = true;
                loadingState?.classList.remove('tw-hidden');
                errorState?.classList.add('tw-hidden');

                // Extract context using existing strategies
                console.log('[CONTENT] Extracting tweet context...');
                let context = extractTweetContext(submitButton);

                if (!context) {
                    const composerCell = submitButton.closest('[data-testid="cellInnerDiv"]');
                    if (composerCell) {
                        const focalTweetInSameCell = composerCell.querySelector('article[data-testid="tweet"]');
                        if (focalTweetInSameCell) {
                            context = extractTweetContext(focalTweetInSameCell);
                        }
                    }
                }

                if (!context) {
                    const modalLayer = submitButton.closest('[role="dialog"]') || document.querySelector('[role="dialog"]');
                    if (modalLayer) {
                        const tweetsInModal = Array.from(modalLayer.querySelectorAll('article[data-testid="tweet"]'));
                        if (tweetsInModal.length > 0) {
                            context = extractTweetContext(tweetsInModal[tweetsInModal.length - 1]);
                        }
                    }
                }

                if (!context && window.location.pathname.includes('/status/')) {
                    const mainTweetArticle = document.querySelector('article[data-testid="tweet"]');
                    if (mainTweetArticle) {
                        context = extractTweetContext(mainTweetArticle);
                    }
                }

                console.log('[CONTENT] Context extracted:', !!context);

                // Build prompt
                console.log('[CONTENT] Building AI prompt...');
                const { prompt, labeledMedia } = buildAiPrompt(context || null, {
                    tone: tone as any,
                    includeEmoji: settings.includeEmoji ?? true,
                });

                console.log('[CONTENT] Prompt built:', prompt.substring(0, 100) + '...');
                console.log('[CONTENT] Media items:', labeledMedia.length);

                // Fetch media if needed
                let mediaToSend: any[] = [];
                if (labeledMedia.length > 0 && settings.provider === 'gemini') {
                    console.log('[CONTENT] Fetching media as base64...');
                    for (const item of labeledMedia) {
                        if (item.type === 'image') {
                            const result = await fetchImageAsBase64(item.url);
                            mediaToSend.push({
                                type: 'image',
                                url: item.url,
                                base64: result.base64,
                                mimeType: result.mimeType,
                                label: item.label
                            });
                        }
                    }
                    console.log('[CONTENT] Media fetched:', mediaToSend.length, 'items');
                }

                // Generate
                console.log('[CONTENT] Sending message to background script...');
                const response = await browser.runtime.sendMessage({
                    action: 'generateReply',
                    prompt: prompt,
                    media: mediaToSend
                });

                console.log('[CONTENT] Response received:', {
                    success: response?.success,
                    hasReply: !!(response?.reply || response?.tweet),
                    hasError: !!response?.error
                });

                if (response.success) {
                    console.log('[CONTENT] Generation successful!');

                    // Find the active composer textarea
                    const textarea = document.querySelector('[data-testid="tweetTextarea_0"]') as HTMLElement;
                    if (textarea) {
                        console.log('[CONTENT] Pasting into textarea...');
                        // Insert into composer
                        await pasteInTwitterInput(response.reply || response.tweet, textarea);

                        // Auto-close panel after brief delay
                        setTimeout(() => {
                            panel.classList.add('tw-hidden');
                            const toggleBtn = document.querySelector('#ai-reply-toggle-btn');
                            toggleBtn?.setAttribute('aria-expanded', 'false');
                        }, 300);
                    } else {
                        console.warn('[CONTENT] Composer not found, copying to clipboard');
                        // Fallback to clipboard
                        navigator.clipboard.writeText(response.reply || response.tweet);
                        if (errorState) {
                            errorState.textContent = 'Reply copied to clipboard (composer not found)';
                            errorState.classList.remove('tw-hidden');
                        }
                    }
                } else {
                    const errorMsg = response.error || 'Generation failed';
                    console.error('[CONTENT] Generation failed:', errorMsg);
                    throw new Error(errorMsg);
                }

            } catch (error: any) {
                console.error('[CONTENT] Generation error:', {
                    message: error.message,
                    name: error.name,
                    stack: error.stack
                });

                // Show error in panel with retry button
                if (errorState) {
                    errorState.innerHTML = `
                        <div class="tw-flex tw-items-start tw-gap-2">
                            <svg class="tw-w-4 tw-h-4 tw-flex-shrink-0 tw-mt-0.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"/>
                                <line x1="12" y1="8" x2="12" y2="12"/>
                                <line x1="12" y1="16" x2="12.01" y2="16"/>
                            </svg>
                            <div class="tw-flex-1">
                                <p class="tw-text-xs tw-text-red-400">${error.message || 'Failed to generate reply'}</p>
                                <button id="ai-retry-btn" class="tw-mt-1.5 tw-text-xs tw-text-red-300 hover:tw-text-red-200 tw-underline">
                                    Try again
                                </button>
                            </div>
                        </div>
                    `;
                    errorState.classList.remove('tw-hidden');

                    // Add retry button listener
                    const retryBtn = errorState.querySelector('#ai-retry-btn');
                    if (retryBtn) {
                        retryBtn.addEventListener('click', () => {
                            console.log('[CONTENT] Retrying generation...');
                            handleInlinePanelGeneration(tone, panel, submitButton);
                        });
                    }
                }
            } finally {
                if (generateBtn) generateBtn.disabled = false;
                loadingState?.classList.add('tw-hidden');
            }
        }

        // Create inline panel component (minimal version)
        async function createInlinePanel(composerContainer: HTMLElement): Promise<HTMLElement> {
            // Load persisted preferences
            let prefs: GeneratorPreferences = {};
            try {
                const stored = await browser.storage.local.get([PREF_STORAGE_KEY]);
                if (stored[PREF_STORAGE_KEY]) {
                    prefs = stored[PREF_STORAGE_KEY];
                }
            } catch (e) {
                console.error('Failed to load generator preferences', e);
            }

            const defaultTone = prefs.tone || settings.tone || 'casual';

            const panel = document.createElement('div');
            panel.id = 'ai-reply-inline-panel';
            panel.className = 'tw-ai-inline-panel tw-hidden tw-mt-2 tw-rounded-lg tw-border tw-border-plukd-border tw-bg-plukd-bg tw-p-3 tw-shadow-2xl tw-animate-in tw-fade-in tw-slide-in-from-top-1';
            panel.setAttribute('role', 'region');
            panel.setAttribute('aria-label', 'AI Reply Generator');

            const tones = ['casual', 'professional', 'humorous', 'concise', 'detailed', 'friendly'];
            const toneButtons = tones.map(tone =>
                `<button class="tw-tone-btn ${tone === defaultTone ? 'tw-selected' : ''}" data-tone="${tone}">${tone.charAt(0).toUpperCase() + tone.slice(1)}</button>`
            ).join('');

            panel.innerHTML = `
                <!-- Tone Selector -->
                <div class="tw-mb-2.5">
                    <label class="tw-text-[11px] tw-font-medium tw-mb-1.5 tw-block tw-text-gray-500 tw-uppercase tw-tracking-wide">Tone</label>
                    <div class="tw-flex tw-gap-1.5 tw-flex-wrap">
                        ${toneButtons}
                    </div>
                </div>

                <!-- Action Buttons -->
                <div class="tw-flex tw-gap-1.5">
                    <button id="ai-generate-btn" class="tw-btn-generate tw-flex-1">
                        <svg class="tw-w-3.5 tw-h-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
                        </svg>
                        <span>Generate</span>
                    </button>
                    <button id="ai-panel-settings-btn" class="tw-btn-secondary" aria-label="Open settings">
                        <svg class="tw-w-3.5 tw-h-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="3"/>
                            <path d="M12 1v6m0 6v6M5.64 5.64l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6M5.64 18.36l4.24-4.24m4.24-4.24l4.24-4.24"/>
                        </svg>
                    </button>
                    <button id="ai-panel-close-btn" class="tw-btn-secondary" aria-label="Close panel">
                        <svg class="tw-w-3.5 tw-h-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                    </button>
                </div>

                <!-- Loading State -->
                <div id="ai-loading-state" class="tw-hidden tw-mt-2.5 tw-text-xs tw-text-gray-500 tw-flex tw-items-center tw-gap-1.5">
                    <svg class="tw-animate-spin tw-w-3 tw-h-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="tw-opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="tw-opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Generating...</span>
                </div>

                <!-- Error State -->
                <div id="ai-error-state" class="tw-hidden tw-mt-2.5 tw-text-xs tw-text-red-400 tw-p-2 tw-bg-red-950/30 tw-rounded tw-border tw-border-red-900/50"></div>
            `;

            return panel;
        }

        // NOTE: Old modal code removed - replaced with inline panel (createInlinePanel, toggleInlinePanel, etc.)

        async function pasteInTwitterInput(text: string, textarea: HTMLElement): Promise<boolean> {
            try {
                console.log(`📝 [Paste] Attempting to paste text (${text.length} chars):`, text);

                textarea.focus();
                textarea.click();
                await new Promise(r => setTimeout(r, 50));

                // Method 1: execCommand (Best for standard contenteditable, usually blocked by modern sites but good first try)
                const execSuccess = document.execCommand('insertText', false, text);
                if (execSuccess) {
                    console.log('✅ [Paste] execCommand success');
                    // Verify if text was actually inserted (rudimentary check)
                    if (textarea.textContent?.includes(text)) return true;
                }

                // Method 2: InputEvent (Simulates user typing, very robust for React/DraftJS)
                console.log('⚠️ [Paste] execCommand failed/unverified, trying InputEvent');
                const pText = text;
                const inputEvent = new InputEvent('textInput', {
                    bubbles: true,
                    cancelable: true,
                    data: pText,
                    view: window
                });
                textarea.dispatchEvent(inputEvent);

                // Also dispatch a regular 'input' event for safety
                const simpleInputEvent = new Event('input', { bubbles: true, cancelable: true });
                textarea.dispatchEvent(simpleInputEvent);

                // Method 3: Clipboard Event (Last resort for complex editors)
                await new Promise(r => setTimeout(r, 50));
                console.log('⚠️ [Paste] Trying ClipboardEvent as backup');
                const dataTransfer = new DataTransfer();
                dataTransfer.setData('text/plain', text);
                const pasteEvent = new ClipboardEvent('paste', {
                    bubbles: true,
                    cancelable: true,
                    clipboardData: dataTransfer
                });
                textarea.dispatchEvent(pasteEvent);

                return true;

            } catch (e) {
                console.error('❌ [Paste] All methods failed:', e);
                return false;
            }
        }

        function showToast(message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') {
            const container = document.querySelector('.toast-container') || document.createElement('div');
            if (!document.body.contains(container)) {
                container.className = 'toast-container tw-fixed tw-bottom-4 tw-right-4 tw-z-[10001] tw-flex tw-flex-col tw-gap-2';
                document.body.appendChild(container);
            }
            const toast = document.createElement('div');
            toast.className = `tw-px-4 tw-py-2 tw-rounded-lg tw-shadow-lg tw-text-white tw-text-sm tw-font-medium ${type === 'error' ? 'tw-bg-red-500' : 'tw-bg-gray-800'}`;
            toast.textContent = message;
            container.appendChild(toast);
            setTimeout(() => toast.remove(), 3000);
        }

        // Start
        init();
    },
});
