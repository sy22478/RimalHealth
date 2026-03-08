/**
 * Message Composer Component
 * 
 * Text input for composing replies to patient messages.
 * Includes send button and keyboard shortcuts.
 * 
 * HIPAA Compliance:
 * - Messages encrypted before transmission
 * - Audit logged on send
 * - No PHI in component state (only during input)
 */

'use client';

import * as React from 'react';
import { Send, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface MessageComposerProps {
  onSend: (body: string) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
  maxLength?: number;
}

/**
 * Message Composer Component
 * 
 * Textarea with send button for composing messages.
 * Supports Enter to send (Shift+Enter for new line).
 */
export function MessageComposer({
  onSend,
  disabled = false,
  placeholder = 'Type a message...',
  maxLength = 2000,
}: MessageComposerProps): React.ReactElement {
  const [message, setMessage] = React.useState('');
  const [isSending, setIsSending] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  /**
   * Handle sending the message
   */
  const handleSend = async (): Promise<void> => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || disabled || isSending) return;

    setIsSending(true);
    try {
      await onSend(trimmedMessage);
      setMessage('');
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } finally {
      setIsSending(false);
    }
  };

  /**
   * Handle keyboard shortcuts
   * Enter = Send (unless Shift is held)
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  /**
   * Auto-resize textarea as content grows
   */
  const handleInput = (e: React.FormEvent<HTMLTextAreaElement>): void => {
    const target = e.currentTarget;
    target.style.height = 'auto';
    target.style.height = `${Math.min(target.scrollHeight, 200)}px`;
  };

  const characterCount = message.length;
  const isOverLimit = characterCount > maxLength;
  const canSend = message.trim().length > 0 && !isOverLimit && !disabled && !isSending;

  return (
    <div className="border-t border-gray-200 bg-white p-4">
      <div className="flex items-end gap-2">
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            placeholder={placeholder}
            disabled={disabled || isSending}
            maxLength={maxLength}
            rows={1}
            className={cn(
              "min-h-[44px] max-h-[200px] resize-none py-3 pr-12",
              isOverLimit && "border-destructive focus-visible:ring-destructive"
            )}
            aria-label="Message text"
            aria-describedby="message-help"
          />
          
          {/* Character count */}
          <div 
            id="message-help"
            className={cn(
              "absolute bottom-2 right-3 text-xs",
              isOverLimit ? "text-destructive font-medium" : "text-muted-foreground"
            )}
          >
            {characterCount}/{maxLength}
          </div>
        </div>

        <Button
          onClick={() => void handleSend()}
          disabled={!canSend}
          size="icon"
          className={cn(
            "h-11 w-11 shrink-0 transition-all",
            canSend && "bg-primary hover:bg-primary/90"
          )}
          aria-label={isSending ? 'Sending message' : 'Send message'}
        >
          {isSending ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </Button>
      </div>

      {/* Helper text */}
      <p className="text-xs text-muted-foreground mt-2">
        Press Enter to send, Shift+Enter for new line
      </p>

      {/* Error message for over limit */}
      {isOverLimit && (
        <p className="text-xs text-destructive mt-1">
          Message exceeds maximum length of {maxLength} characters
        </p>
      )}
    </div>
  );
}

export type { MessageComposerProps };
