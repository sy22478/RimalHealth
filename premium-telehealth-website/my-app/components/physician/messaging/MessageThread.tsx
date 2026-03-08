/**
 * MessageThread Component
 * 
 * Displays an individual message thread for doctor-to-doctor communication.
 * Includes message history, reply functionality, and read receipts.
 * 
 * @module components/physician/messaging/MessageThread
 */

'use client';

import * as React from 'react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Send,
  Paperclip,
  MoreVertical,
  Phone,
  Clock,
  Check,
  CheckCheck,
  Stethoscope,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import { MessageBubble } from './MessageBubble';

// ============================================================================
// Validation Schema
// ============================================================================

const replySchema = z.object({
  body: z.string().min(1, 'Message cannot be empty').max(2000, 'Message too long'),
});

type ReplyFormValues = z.infer<typeof replySchema>;

// ============================================================================
// Types
// ============================================================================

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  subject: string;
  body: string;
  timestamp: Date;
  isRead: boolean;
}

export interface Participant {
  id: string;
  firstName: string;
  lastName: string;
  specialty?: string;
  isOnline?: boolean;
}

export interface MessageThreadProps {
  threadId: string;
  messages: Message[];
  participant: Participant;
  currentUserId: string;
  onSendReply: (body: string) => Promise<void>;
  onMarkRead: () => void;
  onBack?: () => void;
  isLoading?: boolean;
  className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format timestamp for display
 */
function formatMessageTime(date: Date): string {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Format full date for message groups
 */
function formatMessageDate(date: Date): string {
  const now = new Date();
  const messageDate = new Date(date);
  const diffInDays = Math.floor((now.getTime() - messageDate.getTime()) / (1000 * 60 * 60 * 24));

  if (diffInDays === 0) return 'Today';
  if (diffInDays === 1) return 'Yesterday';
  return messageDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Group messages by date
 */
function groupMessagesByDate(messages: Message[]): Map<string, Message[]> {
  const groups = new Map<string, Message[]>();
  
  messages.forEach((message) => {
    const date = new Date(message.timestamp).toDateString();
    if (!groups.has(date)) {
      groups.set(date, []);
    }
    groups.get(date)!.push(message);
  });
  
  return groups;
}

/**
 * Get initials from name
 */
function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

// ============================================================================
// Components
// ============================================================================

/**
 * Empty state when no messages in thread
 */
function EmptyThreadState(): React.ReactElement {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <div className="w-16 h-16 rounded-full bg-ocean-50 flex items-center justify-center mb-4">
        <Send className="w-8 h-8 text-ocean-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-1">
        Start the conversation
      </h3>
      <p className="text-sm text-muted-foreground max-w-xs">
        Send a message to begin collaborating with your colleague.
      </p>
    </div>
  );
}

/**
 * Thread header with participant info
 */
interface ThreadHeaderProps {
  participant: Participant;
  onBack?: () => void;
}

function ThreadHeader({ participant, onBack }: ThreadHeaderProps): React.ReactElement {
  const initials = getInitials(participant.firstName, participant.lastName);
  const fullName = `Dr. ${participant.firstName} ${participant.lastName}`;

  return (
    <CardHeader className="p-4 border-b flex flex-row items-center gap-4 shrink-0">
      {/* Back button (mobile) */}
      {onBack && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="md:hidden shrink-0"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
      )}

      {/* Avatar */}
      <Avatar className="h-10 w-10 shrink-0" size="default">
        <AvatarFallback className="bg-ocean-100 text-ocean-700 font-medium">
          {initials}
        </AvatarFallback>
      </Avatar>

      {/* Participant info */}
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-gray-900 truncate">{fullName}</h3>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {participant.specialty ? (
            <>
              <Stethoscope className="w-3 h-3" />
              <span className="truncate">{participant.specialty}</span>
            </>
          ) : (
            <span>Physician</span>
          )}
          {participant.isOnline !== undefined && (
            <>
              <span className="mx-1">&middot;</span>
              {participant.isOnline ? (
                <span className="flex items-center gap-1 text-green-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  Online
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Offline
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" aria-label="Call physician">
          <Phone className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" aria-label="More options">
          <MoreVertical className="w-4 h-4" />
        </Button>
      </div>
    </CardHeader>
  );
}

/**
 * Message grouping with date separator
 */
interface MessageGroupProps {
  date: string;
  messages: Message[];
  currentUserId: string;
  participant: Participant;
}

function MessageGroup({
  date,
  messages,
  currentUserId,
  participant,
}: MessageGroupProps): React.ReactElement {
  return (
    <div className="space-y-4">
      {/* Date Separator */}
      <div className="flex items-center justify-center">
        <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
          {formatMessageDate(new Date(date))}
        </span>
      </div>

      {/* Messages */}
      {messages.map((message, index) => {
        const isSelf = message.senderId === currentUserId;
        const showSender = !isSelf && (index === 0 || messages[index - 1].senderId !== message.senderId);
        
        return (
          <MessageBubble
            key={message.id}
            message={{
              id: message.id,
              senderName: message.senderName,
              body: message.body,
              timestamp: message.timestamp,
              isSelf,
            }}
            showSender={showSender}
            subject={message.subject}
            isRead={message.isRead}
          />
        );
      })}
    </div>
  );
}

/**
 * Reply composer at bottom of thread
 */
interface ReplyComposerProps {
  onSend: (body: string) => Promise<void>;
  disabled?: boolean;
}

function ReplyComposer({ onSend, disabled = false }: ReplyComposerProps): React.ReactElement {
  const [isSending, setIsSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<ReplyFormValues>({
    resolver: zodResolver(replySchema),
  });

  const bodyValue = watch('body') || '';

  const onSubmit = useCallback(async (values: ReplyFormValues) => {
    setIsSending(true);
    try {
      await onSend(values.body);
      reset();
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } finally {
      setIsSending(false);
    }
  }, [onSend, reset]);

  // Auto-resize textarea
  const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;
    target.style.height = 'auto';
    target.style.height = `${Math.min(target.scrollHeight, 200)}px`;
  };

  // Enter to send, Shift+Enter for new line
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(onSubmit)();
    }
  };

  const { ref: registerRef, ...registerRest } = register('body');

  return (
    <div className="p-4 border-t bg-muted/30 shrink-0">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <div className="relative">
          <Textarea
            {...registerRest}
            ref={(e) => {
              registerRef(e);
              if (e) textareaRef.current = e;
            }}
            placeholder="Type your reply..."
            className={cn(
              'min-h-[80px] resize-none pr-12',
              errors.body && 'border-destructive focus-visible:ring-destructive'
            )}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            disabled={disabled || isSending}
            aria-invalid={!!errors.body}
            aria-describedby={errors.body ? 'reply-error' : undefined}
          />
          <div className="absolute bottom-2 right-3 text-xs text-muted-foreground">
            {bodyValue.length}/2000
          </div>
        </div>
        
        {errors.body && (
          <p id="reply-error" className="text-sm text-destructive">
            {errors.body.message}
          </p>
        )}

        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled || isSending}
            aria-label="Attach file"
          >
            <Paperclip className="w-4 h-4 mr-1" />
            Attach
          </Button>
          
          <Button
            type="submit"
            size="sm"
            disabled={isSending || !bodyValue.trim() || bodyValue.length > 2000}
            className="min-w-[80px]"
          >
            {isSending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-1" />
            ) : (
              <Send className="w-4 h-4 mr-1" />
            )}
            {isSending ? 'Sending...' : 'Send'}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Press Enter to send, Shift+Enter for new line
        </p>
      </form>
    </div>
  );
}

/**
 * MessageThread displays a conversation between physicians
 */
export function MessageThread({
  threadId,
  messages,
  participant,
  currentUserId,
  onSendReply,
  onMarkRead,
  onBack,
  isLoading = false,
  className,
}: MessageThreadProps): React.ReactElement {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasMarkedRead = useRef(false);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mark as read when viewed
  useEffect(() => {
    if (!hasMarkedRead.current && messages.some(m => !m.isRead && m.senderId !== currentUserId)) {
      onMarkRead();
      hasMarkedRead.current = true;
    }
  }, [messages, currentUserId, onMarkRead]);

  // Reset read flag when thread changes
  useEffect(() => {
    hasMarkedRead.current = false;
  }, [threadId]);

  const messageGroups = groupMessagesByDate(messages);

  return (
    <Card className={cn('flex flex-col h-full border-0 shadow-none', className)}>
      {/* Header */}
      <ThreadHeader participant={participant} onBack={onBack} />

      {/* Messages */}
      <CardContent className="flex-1 overflow-y-auto p-4 space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-ocean-500" />
          </div>
        ) : messages.length === 0 ? (
          <EmptyThreadState />
        ) : (
          Array.from(messageGroups.entries()).map(([date, dateMessages]) => (
            <MessageGroup
              key={date}
              date={date}
              messages={dateMessages}
              currentUserId={currentUserId}
              participant={participant}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </CardContent>

      {/* Reply composer */}
      {messages.length > 0 && (
        <ReplyComposer onSend={onSendReply} disabled={isLoading} />
      )}
    </Card>
  );
}

export default MessageThread;
