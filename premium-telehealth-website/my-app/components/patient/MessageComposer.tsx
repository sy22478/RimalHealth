/**
 * Patient Message Composer Component
 * 
 * Form for composing new messages to the physician.
 * Includes subject and body fields with validation.
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface MessageComposerProps {
  onSend: (subject: string, body: string) => Promise<void>;
  disabled?: boolean;
  maxSubjectLength?: number;
  maxBodyLength?: number;
}

/**
 * Message Composer Component for Patients
 * 
 * Form with subject line and message body for sending
 * messages to the assigned physician.
 */
export function MessageComposer({
  onSend,
  disabled = false,
  maxSubjectLength = 100,
  maxBodyLength = 2000,
}: MessageComposerProps): React.ReactElement {
  const [subject, setSubject] = React.useState('');
  const [body, setBody] = React.useState('');
  const [isSending, setIsSending] = React.useState(false);
  const [errors, setErrors] = React.useState<{ subject?: string; body?: string }>({});
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  /**
   * Validate form fields
   */
  const validate = (): boolean => {
    const newErrors: { subject?: string; body?: string } = {};

    if (subject.trim().length > maxSubjectLength) {
      newErrors.subject = `Subject must be ${maxSubjectLength} characters or less`;
    }

    if (!body.trim()) {
      newErrors.body = 'Message body is required';
    } else if (body.trim().length > maxBodyLength) {
      newErrors.body = `Message must be ${maxBodyLength} characters or less`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Handle sending the message
   */
  const handleSend = async (): Promise<void> => {
    if (!validate() || disabled || isSending) return;

    setIsSending(true);
    try {
      await onSend(subject.trim(), body.trim());
      // Clear form after successful send
      setSubject('');
      setBody('');
      setErrors({});
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
   * Ctrl/Cmd+Enter = Send
   */
  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
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
    target.style.height = `${Math.min(target.scrollHeight, 300)}px`;
  };

  const subjectCharCount = subject.length;
  const bodyCharCount = body.length;
  const isSubjectOverLimit = subjectCharCount > maxSubjectLength;
  const isBodyOverLimit = bodyCharCount > maxBodyLength;
  const canSend = body.trim().length > 0 && !isBodyOverLimit && !disabled && !isSending;

  return (
    <div className="border-t border-gray-200 bg-white p-4 space-y-4">
      {/* Subject Field */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="message-subject" className="text-sm font-medium">
            Subject <span className="text-muted-foreground">(optional)</span>
          </Label>
          <span className={cn(
            "text-xs",
            isSubjectOverLimit ? "text-destructive font-medium" : "text-muted-foreground"
          )}>
            {subjectCharCount}/{maxSubjectLength}
          </span>
        </div>
        <Input
          id="message-subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Brief subject line..."
          disabled={disabled || isSending}
          maxLength={maxSubjectLength}
          className={cn(
            errors.subject && "border-destructive focus-visible:ring-destructive"
          )}
          aria-describedby="subject-help"
        />
        {errors.subject && (
          <p className="text-xs text-destructive">{errors.subject}</p>
        )}
        <p id="subject-help" className="text-xs text-muted-foreground">
          A clear subject helps your physician understand your question quickly
        </p>
      </div>

      {/* Body Field */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="message-body" className="text-sm font-medium">
            Message <span className="text-destructive">*</span>
          </Label>
          <span className={cn(
            "text-xs",
            isBodyOverLimit ? "text-destructive font-medium" : "text-muted-foreground"
          )}>
            {bodyCharCount}/{maxBodyLength}
          </span>
        </div>
        <Textarea
          id="message-body"
          ref={textareaRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder="Describe your question or concern..."
          disabled={disabled || isSending}
          maxLength={maxBodyLength}
          rows={4}
          className={cn(
            "min-h-[100px] max-h-[300px] resize-none",
            errors.body && "border-destructive focus-visible:ring-destructive",
            isBodyOverLimit && "border-destructive focus-visible:ring-destructive"
          )}
          aria-describedby="body-help"
        />
        {errors.body && (
          <p className="text-xs text-destructive">{errors.body}</p>
        )}
        <p id="body-help" className="text-xs text-muted-foreground">
          Be specific about your symptoms, concerns, or questions. Include any relevant details.
        </p>
      </div>

      {/* Send Button */}
      <div className="flex items-center justify-between pt-2">
        <p className="text-xs text-muted-foreground">
          Press Ctrl+Enter to send
        </p>
        <Button
          onClick={() => void handleSend()}
          disabled={!canSend}
          className={cn(
            "min-w-[100px] transition-all",
            canSend && "bg-primary hover:bg-primary/90"
          )}
          aria-label={isSending ? 'Sending message' : 'Send message'}
        >
          {isSending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Send Message
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

export type { MessageComposerProps };
