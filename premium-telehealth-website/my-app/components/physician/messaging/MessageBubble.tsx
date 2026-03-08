/**
 * MessageBubble Component
 * 
 * Individual message display for doctor-to-doctor messaging.
 * Different styling for self vs others messages.
 * 
 * @module components/physician/messaging/MessageBubble
 */

'use client';

import * as React from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { Check, CheckCheck, Clock } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface Message {
  id: string;
  senderName: string;
  body: string;
  timestamp: Date;
  isSelf: boolean;
}

export interface MessageBubbleProps {
  message: Message;
  showSender: boolean;
  subject?: string;
  isRead?: boolean;
  className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format timestamp for display
 */
function formatTimestamp(date: Date): string {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Get initials from sender name
 */
function getInitials(name: string): string {
  const parts = name.split(' ');
  if (parts.length >= 2) {
    return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

// ============================================================================
// Components
// ============================================================================

/**
 * Read receipt indicator
 */
interface ReadReceiptProps {
  isRead?: boolean;
  isSelf: boolean;
}

function ReadReceipt({ isRead, isSelf }: ReadReceiptProps): React.ReactElement | null {
  if (!isSelf) return null;

  return (
    <span className="flex items-center gap-0.5" aria-label={isRead ? 'Read' : 'Sent'}>
      {isRead ? (
        <CheckCheck className="w-3 h-3 text-blue-500" aria-hidden="true" />
      ) : (
        <Check className="w-3 h-3 text-muted-foreground" aria-hidden="true" />
      )}
    </span>
  );
}

/**
 * Message content with proper formatting
 */
interface MessageContentProps {
  body: string;
  subject?: string;
}

function MessageContent({ body, subject }: MessageContentProps): React.ReactElement {
  // Split body by newlines for paragraph rendering
  const paragraphs = body.split('\n').filter((p) => p.trim() !== '');

  return (
    <div className="space-y-2">
      {subject && (
        <p className="font-semibold text-sm border-b border-current/20 pb-1 mb-2">
          {subject}
        </p>
      )}
      <div className="space-y-2">
        {paragraphs.map((paragraph, index) => (
          <p key={index} className="text-sm leading-relaxed whitespace-pre-wrap">
            {paragraph}
          </p>
        ))}
      </div>
    </div>
  );
}

/**
 * MessageBubble displays an individual message
 */
export function MessageBubble({
  message,
  showSender,
  subject,
  isRead = false,
  className,
}: MessageBubbleProps): React.ReactElement {
  const { senderName, body, timestamp, isSelf } = message;
  const initials = getInitials(senderName);

  return (
    <div
      className={cn(
        'flex gap-3',
        isSelf ? 'flex-row-reverse' : 'flex-row',
        className
      )}
      role="listitem"
      aria-label={`Message from ${senderName}`}
    >
      {/* Avatar - only show for others or on first message in group */}
      <div className="shrink-0">
        {showSender || isSelf ? (
          <Avatar className="h-8 w-8" size="default">
            <AvatarFallback
              className={cn(
                'text-xs font-medium',
                isSelf
                  ? 'bg-ocean-500 text-white'
                  : 'bg-ocean-100 text-ocean-700'
              )}
            >
              {initials}
            </AvatarFallback>
          </Avatar>
        ) : (
          // Spacer for alignment when avatar is hidden
          <div className="w-8" aria-hidden="true" />
        )}
      </div>

      {/* Message content */}
      <div
        className={cn(
          'max-w-[75%] min-w-0',
          isSelf ? 'items-end' : 'items-start'
        )}
      >
        {/* Sender name */}
        {(showSender || isSelf) && (
          <p
            className={cn(
              'text-xs font-medium mb-1 px-1',
              isSelf ? 'text-right text-ocean-600' : 'text-left text-gray-600'
            )}
          >
            {isSelf ? 'You' : senderName}
          </p>
        )}

        {/* Message bubble */}
        <div
          className={cn(
            'px-4 py-3 rounded-2xl shadow-sm',
            isSelf
              ? 'bg-ocean-500 text-white rounded-br-md'
              : 'bg-gray-100 text-gray-900 rounded-bl-md'
          )}
        >
          <MessageContent body={body} subject={subject} />
        </div>

        {/* Timestamp and read receipt */}
        <div
          className={cn(
            'flex items-center gap-1.5 mt-1 px-1',
            isSelf ? 'flex-row-reverse' : 'flex-row'
          )}
        >
          <time
            dateTime={new Date(timestamp).toISOString()}
            className="text-xs text-muted-foreground"
          >
            {formatTimestamp(timestamp)}
          </time>
          <ReadReceipt isRead={isRead} isSelf={isSelf} />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Extended Variants
// ============================================================================

/**
 * Compact message bubble for list views
 */
export interface CompactMessageBubbleProps {
  senderName: string;
  preview: string;
  timestamp: Date;
  isSelf: boolean;
  isUnread?: boolean;
  className?: string;
}

export function CompactMessageBubble({
  senderName,
  preview,
  timestamp,
  isSelf,
  isUnread = false,
  className,
}: CompactMessageBubbleProps): React.ReactElement {
  const initials = getInitials(senderName);

  return (
    <div
      className={cn(
        'flex gap-3 p-3 rounded-lg transition-colors',
        isUnread && 'bg-ocean-50/50',
        className
      )}
    >
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback
          className={cn(
            'text-xs',
            isSelf
              ? 'bg-ocean-500 text-white'
              : 'bg-ocean-100 text-ocean-700'
          )}
        >
          {initials}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className={cn('text-sm font-medium', isUnread && 'text-gray-900')}>
            {isSelf ? 'You' : senderName}
          </p>
          <time className="text-xs text-muted-foreground shrink-0">
            {formatTimestamp(timestamp)}
          </time>
        </div>
        <p
          className={cn(
            'text-sm truncate',
            isUnread ? 'text-gray-700 font-medium' : 'text-muted-foreground'
          )}
        >
          {preview}
        </p>
      </div>

      {isUnread && (
        <div className="shrink-0 self-center">
          <span className="w-2 h-2 rounded-full bg-ocean-500 block" aria-hidden="true" />
        </div>
      )}
    </div>
  );
}

/**
 * System message bubble for notifications/alerts
 */
export interface SystemMessageBubbleProps {
  message: string;
  timestamp: Date;
  type?: 'info' | 'warning' | 'success';
  className?: string;
}

export function SystemMessageBubble({
  message,
  timestamp,
  type = 'info',
  className,
}: SystemMessageBubbleProps): React.ReactElement {
  const typeStyles = {
    info: 'bg-gray-100 text-gray-700 border-gray-200',
    warning: 'bg-amber-50 text-amber-800 border-amber-200',
    success: 'bg-green-50 text-green-800 border-green-200',
  };

  return (
    <div className={cn('flex justify-center my-4', className)}>
      <div
        className={cn(
          'px-4 py-2 rounded-full text-xs border max-w-[80%] text-center',
          typeStyles[type]
        )}
        role="status"
      >
        <p>{message}</p>
        <time
          dateTime={new Date(timestamp).toISOString()}
          className="opacity-75 mt-0.5 block"
        >
          {formatTimestamp(timestamp)}
        </time>
      </div>
    </div>
  );
}

export default MessageBubble;
