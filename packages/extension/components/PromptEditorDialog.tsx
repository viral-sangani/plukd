import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ToneType, TONE_LABELS } from '@/utils/prompts';

interface PromptEditorDialogProps {
    open: boolean;
    tone: ToneType;
    currentPrompt: string;
    onSave: (editedPrompt: string) => void;
    onCancel: () => void;
    onReset: () => void;
}

export const PromptEditorDialog: React.FC<PromptEditorDialogProps> = ({
    open,
    tone,
    currentPrompt,
    onSave,
    onCancel,
    onReset
}) => {
    const [editedPrompt, setEditedPrompt] = React.useState(currentPrompt);

    // Update editedPrompt when currentPrompt changes (e.g., when switching tones)
    React.useEffect(() => {
        setEditedPrompt(currentPrompt);
    }, [currentPrompt]);

    const handleSave = () => {
        onSave(editedPrompt);
    };

    const handleReset = () => {
        onReset();
        // Prompt will be reset by parent, and currentPrompt will update via useEffect
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
            <DialogContent className="tw-sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Edit {TONE_LABELS[tone]} Tone Prompt</DialogTitle>
                    <DialogDescription>
                        Customize how the AI responds when using the {TONE_LABELS[tone].toLowerCase()} tone.
                        This prompt guides the AI's writing style and personality.
                    </DialogDescription>
                </DialogHeader>

                <div className="tw-space-y-4 tw-py-4">
                    <Textarea
                        value={editedPrompt}
                        onChange={(e) => setEditedPrompt(e.target.value)}
                        rows={8}
                        className="tw-resize-none tw-text-foreground tw-font-mono tw-text-sm"
                        placeholder="Enter tone prompt..."
                    />
                    <p className="tw-text-xs tw-text-muted-foreground">
                        💡 Tip: Be specific about language style, emojis, punctuation, and formality level.
                    </p>
                </div>

                <DialogFooter className="tw-gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleReset}
                        className="tw-mr-auto tw-text-foreground"
                    >
                        Reset to Default
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onCancel}
                        className="tw-text-foreground"
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        onClick={handleSave}
                        className="tw-bg-primary tw-text-primary-foreground hover:tw-bg-primary/90"
                    >
                        Save Prompt
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
