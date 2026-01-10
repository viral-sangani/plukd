import React, { useState, useEffect } from 'react';
import { settingsManager } from '@/utils/storage';
import { Button } from '@/components/ui/button';
import { Toggle } from '@/components/ui/toggle';
import { ToneType, TONE_LABELS } from '@/utils/prompts';
import { Save, Loader2 } from 'lucide-react';

export default function GeneralSettingsSection() {
  const [defaultTone, setDefaultTone] = useState<ToneType>('casual');
  const [includeEmoji, setIncludeEmoji] = useState(true);
  const [includeThreadContext, setIncludeThreadContext] = useState(true);
  const [includeMediaContext, setIncludeMediaContext] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const toneOptions: ToneType[] = ['casual', 'professional', 'humorous', 'troll', 'bully', 'roasting'];

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const settings = await settingsManager.load();
      setDefaultTone(settings.tone || 'casual');
      setIncludeEmoji(settings.includeEmoji !== false); // Default true
      setIncludeThreadContext(settings.includeThreadContext !== false); // Default true
      setIncludeMediaContext(settings.includeMediaContext !== false); // Default true
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);

    try {
      const settings = await settingsManager.load();

      // Update settings
      settings.tone = defaultTone;
      settings.includeEmoji = includeEmoji;
      settings.includeThreadContext = includeThreadContext;
      settings.includeMediaContext = includeMediaContext;

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

  return (
    <div className="tw-space-y-6">
      {/* Settings Grid */}
      <div className="tw-space-y-6">
        {/* Default Tone */}
        <div className="tw-p-5 tw-rounded-xl tw-border tw-border-border tw-bg-card">
          <div className="tw-space-y-3">
            <div>
              <label className="tw-block tw-text-sm tw-font-bold tw-text-foreground tw-mb-1">
                Default Tone
              </label>
              <p className="tw-text-xs tw-text-muted-foreground">
                The tone style used by default for generating replies
              </p>
            </div>
            <select
              value={defaultTone}
              onChange={(e) => setDefaultTone(e.target.value as ToneType)}
              className="
                tw-w-full tw-px-4 tw-py-3
                tw-bg-background tw-border tw-border-input
                tw-rounded-lg tw-text-foreground tw-text-sm
                focus:tw-outline-none focus:tw-border-primary focus:tw-ring-1 focus:tw-ring-primary
                tw-transition-colors tw-cursor-pointer
              "
            >
              {toneOptions.map((tone) => (
                <option key={tone} value={tone}>
                  {TONE_LABELS[tone]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Include Emojis */}
        <div className="tw-p-5 tw-rounded-xl tw-border tw-border-border tw-bg-card">
          <div className="tw-flex tw-items-start tw-justify-between tw-gap-4">
            <div className="tw-flex-1">
              <label className="tw-block tw-text-sm tw-font-bold tw-text-foreground tw-mb-1">
                Include Emojis
              </label>
              <p className="tw-text-xs tw-text-muted-foreground">
                Add emojis to make responses more expressive and engaging
              </p>
            </div>
            <Toggle
              checked={includeEmoji}
              onChange={setIncludeEmoji}
            />
          </div>
        </div>

        {/* Include Thread Context */}
        <div className="tw-p-5 tw-rounded-xl tw-border tw-border-border tw-bg-card">
          <div className="tw-flex tw-items-start tw-justify-between tw-gap-4">
            <div className="tw-flex-1">
              <label className="tw-block tw-text-sm tw-font-bold tw-text-foreground tw-mb-1">
                Include Thread Context
              </label>
              <p className="tw-text-xs tw-text-muted-foreground">
                Include previous tweets in the thread for better context awareness
              </p>
            </div>
            <Toggle
              checked={includeThreadContext}
              onChange={setIncludeThreadContext}
            />
          </div>
        </div>

        {/* Include Media Context */}
        <div className="tw-p-5 tw-rounded-xl tw-border tw-border-border tw-bg-card">
          <div className="tw-flex tw-items-start tw-justify-between tw-gap-4">
            <div className="tw-flex-1">
              <label className="tw-block tw-text-sm tw-font-bold tw-text-foreground tw-mb-1">
                Include Media Context
              </label>
              <p className="tw-text-xs tw-text-muted-foreground">
                Send images and videos to AI for visual context analysis (Gemini only)
              </p>
            </div>
            <Toggle
              checked={includeMediaContext}
              onChange={setIncludeMediaContext}
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="tw-flex tw-items-center tw-gap-3 tw-pt-4">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="tw-px-8"
        >
          {saving ? (
            <>
              <Loader2 className="tw-w-4 tw-h-4 tw-mr-2 tw-animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="tw-w-4 tw-h-4 tw-mr-2" />
              Save Settings
            </>
          )}
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
