/**
 * Message List Components
 * 
 * Reusable components for displaying message lists and skeletons.
 * 
 * HIPAA Compliance:
 * - PHI preview is truncated
 * - No sensitive data in loading states
 */

'use client';

import * as React from 'react';
import { Skeleton } from '@/components/ui/Skeleton';

/**
 * Skeleton loader for message list items
 */
export function MessageListSkeleton(): React.ReactElement {
  return (
    <div className="divide-y divide-gray-100">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 px-4 py-3">
          <Skeleton className="h-10 w-10 rounded-full shrink-0" />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-12" />
            </div>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Empty state for message list
 */
interface MessageListEmptyProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function MessageListEmpty({
  icon,
  title,
  description,
  action,
}: MessageListEmptyProps): React.ReactElement {
  return (
    <div className="flex flex-col items-center justify-center h-64 px-4 text-center">
      {icon && (
        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
          {icon}
        </div>
      )}
      <p className="text-sm font-medium text-gray-900">{title}</p>
      {description && (
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/**
 * Thread list item component
 * Used in both inbox and sidebar
 */
interface ThreadListItemProps {
  name: string;
  avatar?: string;
  preview: string;
  timestamp: Date;
  unreadCount?: number;
  isSelected?: boolean;
  isActive?: boolean;
  onClick: () => void;
}

export function ThreadListItem({
  name,
  avatar,
  preview,
  timestamp,
  unreadCount = 0,
  isSelected = false,
  isActive = false,
  onClick,
}: ThreadListItemProps): React.ReactElement {
  const getInitials = (fullName: string): string => {
    return fullName
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatTime = (date: Date): string => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (messageDate.getTime() === today.getTime()) {
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      });
    }

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (messageDate.getTime() === yesterday.getTime()) {
      return 'Yesterday';
    }

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const truncateMessage = (message: string, maxLength = 50): string => {
    if (message.length <= maxLength) return message;
    return message.slice(0, maxLength) + '...';
  };

  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center gap-3 px-4 py-3 text-left transition-colors
        ${isSelected ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-gray-50'}
        ${unreadCount > 0 && !isSelected ? 'bg-primary/[0.02]' : ''}
        ${isActive ? 'border-l-2 border-l-primary' : ''}
      `}
    >
      {/* Avatar placeholder - would use Avatar component in real implementation */}
      <div className={`
        h-10 w-10 rounded-full flex items-center justify-center shrink-0 text-sm font-medium
        ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary'}
      `}>
        {avatar ? (
          <img src={avatar} alt="" className="h-full w-full rounded-full object-cover" />
        ) : (
          getInitials(name)
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={`font-medium truncate ${unreadCount > 0 ? 'text-foreground' : ''}`}>
            {name}
          </span>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {formatTime(timestamp)}
          </span>
        </div>

        <p className={`text-sm truncate ${unreadCount > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
          {truncateMessage(preview)}
        </p>
      </div>

      {unreadCount > 0 && (
        <div className="h-5 min-w-5 px-1.5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
          {unreadCount}
        </div>
      )}
    </button>
  );
}
