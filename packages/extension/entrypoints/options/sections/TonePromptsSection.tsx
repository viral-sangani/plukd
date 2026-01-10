import React, { useState, useEffect } from 'react';
import { settingsManager } from '@/utils/storage';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ToneType, DEFAULT_TONE_PROMPTS, TONE_LABELS } from '@/utils/prompts';
import { Loader2, RotateCcw, Save, X } from 'lucide-react';

export default function TonePromptsSection() {
  const [customPrompts, setCustomPrompts] = useState<Record<ToneType, string>>(DEFAULT_TONE_PROMPTS);
  const [originalPrompts, setOriginalPrompts] = useState<Record<ToneType, string>>(DEFAULT_TONE_PROMPTS);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [statusType, setStatusType] = useState<'success' | 'error'>('success');
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadPrompts();
  }, []);

  useEffect(() => {
    // Check if there are any changes
    const changed = Object.keys(customPrompts).some(
      key => customPrompts[key as ToneType] !== originalPrompts[key as ToneType]
    );
    setHasChanges(changed);
  }, [customPrompts, originalPrompts]);

  const loadPrompts = async () => {
    try {
      const settings = await settingsManager.load();
      const prompts = settings.customTonePrompts || DEFAULT_TONE_PROMPTS;
      setCustomPrompts(prompts);
      setOriginalPrompts(prompts);
    } catch (error) {
      console.error('Failed to load prompts:', error);
      showStatus('Failed to load prompts', 'error');
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const settings = await settingsManager.load();
      const updatedSettings = {
        ...settings,
        customTonePrompts: customPrompts
      };
      await settingsManager.save(updatedSettings);
      setOriginalPrompts(customPrompts);
      showStatus('✓ Prompts saved successfully!', 'success');
    } catch (error) {
      console.error('Failed to save prompts:', error);
      showStatus('✗ Failed to save prompts', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = (tone: ToneType) => {
    setCustomPrompts(prev => ({
      ...prev,
      [tone]: DEFAULT_TONE_PROMPTS[tone]
    }));
    showStatus(`Reset ${TONE_LABELS[tone]} to default`, 'success');
  };

  const handleResetAll = () => {
    if (confirm('Reset ALL prompts to defaults? This cannot be undone.')) {
      setCustomPrompts(DEFAULT_TONE_PROMPTS);
      showStatus('All prompts reset to defaults', 'success');
    }
  };

  const handleCancel = () => {
    if (hasChanges && confirm('Discard unsaved changes?')) {
      setCustomPrompts(originalPrompts);
      showStatus('Changes discarded', 'success');
    }
  };

  const showStatus = (message: string, type: 'success' | 'error') => {
    setStatusMsg(message);
    setStatusType(type);
    setTimeout(() => setStatusMsg(''), 3000);
  };

  const tones: ToneType[] = ['casual', 'professional', 'humorous', 'troll', 'bully', 'roasting'];

  return (
    <div className="tw-space-y-6">
      {/* Action Buttons */}
      <div className="tw-flex tw-items-center tw-justify-between tw-flex-wrap tw-gap-3">
        <div className="tw-flex tw-items-center tw-gap-2">
          {hasChanges && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              className="tw-h-9"
            >
              <X className="tw-w-4 tw-h-4 tw-mr-2" />
              Discard
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetAll}
            className="tw-h-9"
          >
            <RotateCcw className="text-white tw-w-4 tw-h-4 tw-mr-2" />
            Reset All
          </Button>
        </div>

        <div className="tw-flex tw-items-center tw-gap-3">
          {statusMsg && (
            <span className={`tw-text-sm tw-font-medium ${statusType === 'success' ? 'tw-text-green-500' : 'tw-text-red-500'
              }`}>
              {statusMsg}
            </span>
          )}
          <Button
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
            className="tw-min-w-[140px]"
          >
            {isSaving ? (
              <>
                <Loader2 className="tw-w-4 tw-h-4 tw-mr-2 tw-animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="tw-w-4 tw-h-4 tw-mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Prompts Grid */}
      <div className="tw-grid tw-grid-cols-1 lg:tw-grid-cols-2 tw-gap-4">
        {tones.map((tone) => (
          <div
            key={tone}
            className="tw-p-5 tw-rounded-xl tw-border tw-border-border tw-bg-card tw-space-y-3"
          >
            <div className="tw-flex tw-items-center tw-justify-between">
              <div className="tw-flex tw-items-center tw-gap-2">
                <h3 className="tw-text-sm tw-font-bold tw-text-foreground">
                  {TONE_LABELS[tone]}
                </h3>
                {customPrompts[tone] !== DEFAULT_TONE_PROMPTS[tone] && (
                  <span className="tw-text-xs tw-text-primary tw-font-medium">
                    ✏️ Modified
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleReset(tone)}
                className="tw-h-8 tw-text-xs tw-text-muted-foreground hover:tw-text-foreground"
              >
                <RotateCcw className="tw-w-3 tw-h-3 tw-mr-1" />
                Reset
              </Button>
            </div>
            <Textarea
              value={customPrompts[tone]}
              onChange={(e) => setCustomPrompts(prev => ({
                ...prev,
                [tone]: e.target.value
              }))}
              rows={5}
              className="
                tw-resize-none tw-text-xs tw-font-mono tw-leading-relaxed
                tw-bg-background tw-text-foreground
              "
              placeholder={`Enter ${TONE_LABELS[tone].toLowerCase()} tone prompt...`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
