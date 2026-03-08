'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  StickyNote, 
  Loader2, 
  X,
  Save
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AddNoteFormProps {
  initialContent?: string;
  onSubmit?: (content: string) => Promise<void>;
  onCancel?: () => void;
  isSubmitting?: boolean;
  submitLabel?: string;
  cancelLabel?: string;
  isEditing?: boolean;
  className?: string;
}

export function AddNoteForm({
  initialContent = '',
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitLabel = 'Add Note',
  cancelLabel = 'Cancel',
  isEditing = false,
  className,
}: AddNoteFormProps): React.ReactElement {
  const [content, setContent] = React.useState(initialContent);
  const [error, setError] = React.useState<string | null>(null);

  // Reset content when initialContent changes (for edit mode)
  React.useEffect(() => {
    setContent(initialContent);
  }, [initialContent]);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!content.trim()) {
      setError('Note content is required');
      return;
    }

    if (content.length > 10000) {
      setError('Note is too long (max 10,000 characters)');
      return;
    }

    await onSubmit?.(content.trim());
    
    // Reset form if not editing
    if (!isEditing) {
      setContent('');
    }
  };

  const handleCancel = (): void => {
    setContent(initialContent);
    setError(null);
    onCancel?.();
  };

  const charCount = content.length;
  const maxChars = 10000;
  const isNearLimit = charCount > maxChars * 0.9;

  return (
    <form 
      onSubmit={handleSubmit}
      className={cn(
        "p-4 rounded-lg border bg-muted/30",
        isEditing && "bg-transparent border-ocean-200",
        className
      )}
    >
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center gap-2">
          <StickyNote className="h-4 w-4 text-muted-foreground" />
          <Label htmlFor="note-content" className="text-sm font-medium">
            {isEditing ? 'Edit Clinical Note' : 'Add Clinical Note'}
          </Label>
        </div>

        {/* Textarea */}
        <Textarea
          id="note-content"
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            if (error) setError(null);
          }}
          placeholder="Enter clinical notes, observations, or care instructions..."
          className={cn(
            "min-h-[120px] resize-y",
            error && "border-destructive focus-visible:ring-destructive"
          )}
          disabled={isSubmitting}
        />

        {/* Error Message */}
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between">
          {/* Character Count */}
          <span className={cn(
            "text-xs",
            isNearLimit ? "text-warning-600 font-medium" : "text-muted-foreground"
          )}>
            {charCount.toLocaleString()} / {maxChars.toLocaleString()} characters
          </span>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {(isEditing || content !== initialContent) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                disabled={isSubmitting}
                className="flex items-center gap-1"
              >
                <X className="h-4 w-4" />
                {cancelLabel}
              </Button>
            )}
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || !content.trim()}
              className="flex items-center gap-1"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {isEditing ? 'Saving...' : 'Adding...'}
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  {submitLabel}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
