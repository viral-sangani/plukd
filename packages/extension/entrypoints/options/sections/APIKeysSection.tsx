import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, ExternalLink, Sparkles, Zap, Bot } from 'lucide-react';
import { settingsManager } from '@/utils/storage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Provider {
  value: 'gemini' | 'openai' | 'claude';
  label: string;
  icon: React.ReactNode;
  link: string;
}

const providers: Provider[] = [
  {
    value: 'gemini',
    label: 'Google Gemini',
    icon: <Sparkles className="tw-w-5 tw-h-5" />,
    link: 'https://makersuite.google.com/app/apikey'
  },
  {
    value: 'openai',
    label: 'OpenAI',
    icon: <Zap className="tw-w-5 tw-h-5" />,
    link: 'https://platform.openai.com/api-keys'
  },
  {
    value: 'claude',
    label: 'Anthropic Claude',
    icon: <Bot className="tw-w-5 tw-h-5" />,
    link: 'https://console.anthropic.com/'
  }
];

export default function APIKeysSection() {
  const [selectedProvider, setSelectedProvider] = useState<'gemini' | 'openai' | 'claude'>('gemini');
  const [apiKeys, setApiKeys] = useState({
    gemini: '',
    openai: '',
    claude: ''
  });
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const settings = await settingsManager.load();
      setSelectedProvider(settings.provider || 'gemini');

      // Load API keys
      const geminiKey = await settingsManager.getApiKey('gemini');
      const openaiKey = await settingsManager.getApiKey('openai');
      const claudeKey = await settingsManager.getApiKey('claude');

      setApiKeys({
        gemini: geminiKey || '',
        openai: openaiKey || '',
        claude: claudeKey || ''
      });
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);

    try {
      const settings = await settingsManager.load();

      // Update provider
      settings.provider = selectedProvider;

      // Update API keys
      settings.geminiKey = apiKeys.gemini;
      settings.openaiKey = apiKeys.openai;
      settings.claudeKey = apiKeys.claude;

      await settingsManager.save(settings);

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const currentProvider = providers.find(p => p.value === selectedProvider);
  const currentApiKey = apiKeys[selectedProvider];

  return (
    <div className="tw-space-y-6">
      {/* Provider Selection */}
      <div className="tw-space-y-4">
        <label className="tw-block tw-text-xs tw-font-semibold tw-text-muted-foreground tw-uppercase tw-tracking-wide">
          AI Provider
        </label>
        <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-3 tw-gap-3">
          {providers.map((provider) => (
            <button
              key={provider.value}
              onClick={() => setSelectedProvider(provider.value)}
              className={`
                tw-p-4 tw-rounded-xl tw-border tw-transition-all tw-duration-200
                tw-flex tw-items-center tw-gap-3 tw-bg-card hover:tw-bg-accent/50
                ${selectedProvider === provider.value
                  ? 'tw-border-primary tw-ring-1 tw-ring-primary tw-text-primary'
                  : 'tw-border-border tw-text-muted-foreground hover:tw-border-muted-foreground/50'
                }
              `}
            >
              {provider.icon}
              <span className="tw-font-medium">{provider.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* API Key Input */}
      <div className="tw-space-y-4">
        <div className="tw-flex tw-items-center tw-justify-between">
          <label className="tw-block tw-text-xs tw-font-semibold tw-text-muted-foreground tw-uppercase tw-tracking-wide">
            API Key
          </label>
          {currentProvider && (
            <a
              href={currentProvider.link}
              target="_blank"
              rel="noopener noreferrer"
              className="tw-flex tw-items-center tw-gap-1 tw-text-xs tw-text-primary hover:tw-text-primary/80 tw-transition-colors"
            >
              Get API Key
              <ExternalLink className="tw-w-3 tw-h-3" />
            </a>
          )}
        </div>

        <div className="tw-relative">
          <Input
            type={showKey ? 'text' : 'password'}
            value={currentApiKey}
            onChange={(e) => setApiKeys({ ...apiKeys, [selectedProvider]: e.target.value })}
            placeholder={`Enter your ${currentProvider?.label} API key`}
            className="tw-pr-12"
          />
          <button
            onClick={() => setShowKey(!showKey)}
            className="tw-absolute tw-right-3 tw-top-1/2 -tw-translate-y-1/2 tw-text-muted-foreground hover:tw-text-foreground tw-transition-colors"
          >
            {showKey ? <EyeOff className="tw-w-4 tw-h-4" /> : <Eye className="tw-w-4 tw-h-4" />}
          </button>
        </div>

        {currentApiKey && (
          <p className="tw-text-xs tw-text-muted-foreground">
            ✓ API key configured for {currentProvider?.label}
          </p>
        )}
      </div>

      {/* Save Button */}
      <div className="tw-flex tw-items-center tw-gap-3 tw-pt-4">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="tw-px-8"
        >
          {saving ? 'Saving...' : 'Save API Keys'}
        </Button>
        {saveSuccess && (
          <span className="tw-text-sm tw-text-green-500 tw-font-medium">
            ✓ Settings saved successfully
          </span>
        )}
      </div>
    </div>
  );
}
