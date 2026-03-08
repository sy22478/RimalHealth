/**
 * MessageThreadList Component
 * 
 * Displays a list of conversation threads for doctor-to-doctor communication.
 * Includes search/filter functionality and unread indicators.
 * 
 * @module components/physician/messaging/MessageThreadList
 */

'use client';

import * as React from 'react';
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  Search,
  MessageSquare,
  Stethoscope,
  Inbox,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface ThreadParticipant {
  id: string;
  firstName: string;
  lastName: string;
  specialty?: string;
}

export interface LastMessage {
  subject: string;
  preview: string;
  timestamp: Date;
}

export interface MessageThread {
  id: string;
  participant: ThreadParticipant;
  lastMessage: LastMessage;
  unreadCount: number;
}

export interface MessageThreadListProps {
  threads: MessageThread[];
  selectedThreadId?: string;
  onSelectThread: (threadId: string) => void;
  className?: string;
  isLoading?: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format timestamp to relative time
 */
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const messageDate = new Date(date);
  const diffInSeconds = Math.floor((now.getTime() - messageDate.getTime()) / 1000);
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInSeconds < 60) {
    return 'Just now';
  }
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  }
  if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  }
  if (diffInDays === 1) {
    return 'Yesterday';
  }
  if (diffInDays < 7) {
    return messageDate.toLocaleDateString('en-US', { weekday: 'short' });
  }
  return messageDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Get initials from name
 */
function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

/**
 * Truncate text with ellipsis
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
}

// ============================================================================
// Components
// ============================================================================

/**
 * Empty state when no threads exist
 */
function EmptyThreadState({ hasSearchQuery }: { hasSearchQuery: boolean }): React.ReactElement {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-ocean-50 flex items-center justify-center mb-4">
        <Inbox className="w-8 h-8 text-ocean-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-1">
        {hasSearchQuery ? 'No matches found' : 'No messages yet'}
      </h3>
      <p className="text-sm text-muted-foreground max-w-xs">
        {hasSearchQuery
          ? 'Try adjusting your search terms to find what you\'re looking for.'
          : 'Your conversations with other physicians will appear here.'}
      </p>
    </div>
  );
}

/**
 * Loading skeleton for thread list
 */
function ThreadListSkeleton(): React.ReactElement {
  return (
    <div className="p-4 space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 p-3 rounded-lg border border-transparent"
        >
          <div className="w-10 h-10 rounded-full bg-muted animate-pulse shrink-0" />
          <div className="flex-1 space-y-2 min-w-0">
            <div className="flex items-center justify-between">
              <div className="h-4 bg-muted rounded animate-pulse w-1/3" />
              <div className="h-3 bg-muted rounded animate-pulse w-12" />
            </div>
            <div className="h-3 bg-muted rounded animate-pulse w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Individual thread card component
 */
interface ThreadCardProps {
  thread: MessageThread;
  isSelected: boolean;
  onClick: () => void;
}

function ThreadCard({ thread, isSelected, onClick }: ThreadCardProps): React.ReactElement {
  const initials = getInitials(thread.participant.firstName, thread.participant.lastName);
  const fullName = `Dr. ${thread.participant.firstName} ${thread.participant.lastName}`;
  const hasUnread = thread.unreadCount > 0;

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-start gap-3 p-4 text-left transition-all duration-200 rounded-lg',
        'hover:bg-ocean-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-500',
        isSelected && 'bg-ocean-50 border-ocean-200',
        !isSelected && 'border border-transparent',
        hasUnread && !isSelected && 'bg-ocean-50/30'
      )}
      aria-selected={isSelected}
      role="option"
    >
      {/* Avatar */}
      <Avatar className="h-10 w-10 shrink-0" size="default">
        <AvatarFallback
          className={cn(
            'text-sm font-medium',
            isSelected
              ? 'bg-ocean-200 text-ocean-800'
              : 'bg-ocean-100 text-ocean-700'
          )}
        >
          {initials}
        </AvatarFallback>
      </Avatar>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Header row */}
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <h4
            className={cn(
              'font-medium truncate',
              hasUnread ? 'text-gray-900' : 'text-gray-700'
            )}
          >
            {fullName}
          </h4>
          <span className="text-xs text-muted-foreground shrink-0">
            {formatRelativeTime(thread.lastMessage.timestamp)}
          </span>
        </div>

        {/* Specialty */}
        {thread.participant.specialty && (
          <p className="text-xs text-ocean-600 mb-1 flex items-center gap-1">
            <Stethoscope className="w-3 h-3" />
            {thread.participant.specialty}
          </p>
        )}

        {/* Preview */}
        <p
          className={cn(
            'text-sm truncate',
            hasUnread ? 'text-gray-700 font-medium' : 'text-muted-foreground'
          )}
        >
          {thread.lastMessage.subject && (
            <span className="text-gray-900">{truncateText(thread.lastMessage.subject, 25)}: </span>
          )}
          {truncateText(thread.lastMessage.preview, 40)}
        </p>
      </div>

      {/* Unread badge */}
      {hasUnread && (
        <div className="flex flex-col items-end gap-1 shrink-0 mt-1">
          <Badge
            variant="default"
            className="h-5 min-w-5 px-1.5 flex items-center justify-center bg-ocean-500 text-white text-xs"
          >
            {thread.unreadCount > 9 ? '9+' : thread.unreadCount}
          </Badge>
          <span className="w-2 h-2 rounded-full bg-ocean-500" aria-hidden="true" />
        </div>
      )}
    </button>
  );
}

/**
 * MessageThreadList displays a list of conversation threads
 */
export function MessageThreadList({
  threads,
  selectedThreadId,
  onSelectThread,
  className,
  isLoading = false,
}: MessageThreadListProps): React.ReactElement {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter threads based on search query
  const filteredThreads = useMemo(() => {
    if (!searchQuery.trim()) return threads;
    
    const query = searchQuery.toLowerCase();
    return threads.filter((thread) => {
      const fullName = `${thread.participant.firstName} ${thread.participant.lastName}`.toLowerCase();
      const specialty = thread.participant.specialty?.toLowerCase() || '';
      const subject = thread.lastMessage.subject.toLowerCase();
      const preview = thread.lastMessage.preview.toLowerCase();
      
      return (
        fullName.includes(query) ||
        specialty.includes(query) ||
        subject.includes(query) ||
        preview.includes(query)
      );
    });
  }, [threads, searchQuery]);

  // Calculate total unread count
  const totalUnread = useMemo(
    () => threads.reduce((sum, t) => sum + t.unreadCount, 0),
    [threads]
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const clearSearch = () => {
    setSearchQuery('');
  };

  return (
    <Card className={cn('flex flex-col h-full border-0 shadow-none', className)}>
      {/* Header */}
      <CardHeader className="p-4 pb-3 space-y-3">
        <CardTitle className="text-xl font-semibold flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-ocean-500" />
          Messages
          {totalUnread > 0 && (
            <Badge variant="secondary" className="ml-1 bg-ocean-100 text-ocean-700">
              {totalUnread}
            </Badge>
          )}
        </CardTitle>

        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search physicians or messages..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="pl-9 pr-8 h-10"
            aria-label="Search message threads"
          />
          {searchQuery && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-gray-700"
              aria-label="Clear search"
            >
              <span className="sr-only">Clear search</span>
              <span aria-hidden="true">&times;</span>
            </button>
          )}
        </div>
      </CardHeader>

      {/* Thread List */}
      <CardContent className="flex-1 overflow-y-auto p-2 pt-0">
        {isLoading ? (
          <ThreadListSkeleton />
        ) : filteredThreads.length === 0 ? (
          <EmptyThreadState hasSearchQuery={!!searchQuery.trim()} />
        ) : (
          <div className="space-y-1" role="listbox" aria-label="Message threads">
            {filteredThreads.map((thread) => (
              <ThreadCard
                key={thread.id}
                thread={thread}
                isSelected={selectedThreadId === thread.id}
                onClick={() => onSelectThread(thread.id)}
              />
            ))}
          </div>
        )}
      </CardContent>

      {/* Footer with thread count */}
      {!isLoading && filteredThreads.length > 0 && (
        <div className="px-4 py-3 border-t text-xs text-muted-foreground text-center">
          {filteredThreads.length} conversation{filteredThreads.length !== 1 ? 's' : ''}
          {searchQuery && ` matching "${searchQuery}"`}
        </div>
      )}
    </Card>
  );
}

export default MessageThreadList;
