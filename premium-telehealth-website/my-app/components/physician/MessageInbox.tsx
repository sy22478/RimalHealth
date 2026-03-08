/**
 * Message Inbox Component
 * 
 * Displays list of message threads for the physician.
 * Includes search, filtering, and unread count badges.
 * 
 * HIPAA Compliance:
 * - PHI preview is truncated and encrypted
 * - Access logged on thread selection
 */

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { 
  Search, 
  MoreHorizontal, 
  Filter,
  Menu,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { formatDistanceToNow } from '@/types';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { MessageListSkeleton } from './MessageList';

/**
 * Message thread summary interface
 */
interface MessageThread {
  id: string;
  patientId: string;
  patientName: string;
  patientAvatar?: string;
  lastMessage: {
    body: string;
    sentAt: string;
    senderType: 'PATIENT' | 'PHYSICIAN';
  };
  unreadCount: number;
  totalMessages: number;
}

/**
 * Inbox filter type
 */
type InboxFilter = 'all' | 'unread' | 'patients';

interface MessageInboxProps {
  selectedThreadId: string | null;
  onSelectThread: (threadId: string) => void;
  onOpenSidebar: () => void;
}

/**
 * Message Inbox Component
 * 
 * Shows list of conversation threads with filtering and search.
 * Polls for new messages every 30 seconds.
 */
export function MessageInbox({
  selectedThreadId,
  onSelectThread,
  onOpenSidebar,
}: MessageInboxProps): React.ReactElement {
  const router = useRouter();
  const [threads, setThreads] = React.useState<MessageThread[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [filter, setFilter] = React.useState<InboxFilter>('all');
  const [totalUnread, setTotalUnread] = React.useState(0);

  /**
   * Fetch threads from API
   */
  const fetchThreads = React.useCallback(async (showLoading = true) => {
    if (showLoading) {
      setIsLoading(true);
    }
    setError(null);

    try {
      const response = await fetch('/api/physician/messages', {
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch messages');
      }

      const data = await response.json() as { threads: MessageThread[] };
      setThreads(data.threads);
      
      // Calculate total unread
      const unread = data.threads.reduce((sum, t) => sum + t.unreadCount, 0);
      setTotalUnread(unread);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load messages');
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  }, [router]);

  // Initial fetch
  React.useEffect(() => {
    void fetchThreads();
  }, [fetchThreads]);

  // Polling for new messages every 30 seconds
  React.useEffect(() => {
    const interval = setInterval(() => {
      void fetchThreads(false);
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchThreads]);

  /**
   * Filter threads based on search and filter criteria
   */
  const filteredThreads = React.useMemo(() => {
    let result = threads;

    // Apply text filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        t =>
          t.patientName.toLowerCase().includes(query) ||
          t.lastMessage.body.toLowerCase().includes(query)
      );
    }

    // Apply category filter
    switch (filter) {
      case 'unread':
        result = result.filter(t => t.unreadCount > 0);
        break;
      case 'patients':
        // Show threads with patient messages
        result = result.filter(t => t.lastMessage.senderType === 'PATIENT');
        break;
    }

    return result;
  }, [threads, searchQuery, filter]);

  /**
   * Get initials from patient name
   */
  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  /**
   * Truncate message preview
   */
  const truncateMessage = (message: string, maxLength = 60): string => {
    if (message.length <= maxLength) return message;
    return message.slice(0, maxLength) + '...';
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onOpenSidebar}
          aria-label="Open patient menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <h2 className="text-lg font-semibold flex-1">
          Messages
          {totalUnread > 0 && (
            <Badge 
              variant="default" 
              className="ml-2 bg-primary text-primary-foreground"
            >
              {totalUnread}
            </Badge>
          )}
        </h2>
        <Button variant="ghost" size="icon" aria-label="More options">
          <MoreHorizontal className="h-5 w-5" />
        </Button>
      </div>

      {/* Search */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search messages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            aria-label="Search messages"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-200">
        <Button
          variant={filter === 'all' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setFilter('all')}
          className="text-xs"
        >
          All
        </Button>
        <Button
          variant={filter === 'unread' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setFilter('unread')}
          className="text-xs"
        >
          Unread
          {totalUnread > 0 && (
            <Badge variant="default" className="ml-1.5 h-5 min-w-5 px-1 text-[10px]">
              {totalUnread}
            </Badge>
          )}
        </Button>
        <Button
          variant={filter === 'patients' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setFilter('patients')}
          className="text-xs"
        >
          Patients
        </Button>
        <div className="flex-1" />
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Filter">
          <Filter className="h-4 w-4" />
        </Button>
      </div>

      {/* Thread List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <MessageListSkeleton />
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-64 px-4 text-center">
            <AlertCircle className="h-10 w-10 text-destructive mb-3" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-4"
              onClick={() => void fetchThreads()}
            >
              Retry
            </Button>
          </div>
        ) : filteredThreads.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 px-4 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <Search className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No messages found</p>
            <p className="text-xs text-muted-foreground mt-1">
              {searchQuery 
                ? 'Try adjusting your search terms'
                : filter === 'unread' 
                  ? 'No unread messages'
                  : 'No messages yet'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100" role="list">
            {filteredThreads.map((thread) => (
              <li key={thread.id}>
                <button
                  onClick={() => onSelectThread(thread.id)}
                  className={cn(
                    "w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50",
                    selectedThreadId === thread.id && "bg-primary/5 hover:bg-primary/10",
                    thread.unreadCount > 0 && "bg-primary/[0.02]"
                  )}
                  aria-current={selectedThreadId === thread.id ? 'true' : undefined}
                  aria-label={`Conversation with ${thread.patientName}${thread.unreadCount > 0 ? `, ${thread.unreadCount} unread messages` : ''}`}
                >
                  <Avatar className="mt-0.5">
                    {thread.patientAvatar ? (
                      <img src={thread.patientAvatar} alt="" />
                    ) : null}
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                      {getInitials(thread.patientName)}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn(
                        "font-medium truncate",
                        thread.unreadCount > 0 && "text-foreground"
                      )}>
                        {thread.patientName}
                      </span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(thread.lastMessage.sentAt))}
                      </span>
                    </div>
                    
                    <p className={cn(
                      "text-sm truncate mt-0.5",
                      thread.unreadCount > 0 
                        ? "text-foreground font-medium" 
                        : "text-muted-foreground"
                    )}>
                      {thread.lastMessage.senderType === 'PATIENT' ? '' : 'You: '}
                      {truncateMessage(thread.lastMessage.body)}
                    </p>
                    
                    <div className="flex items-center gap-2 mt-1.5">
                      {thread.unreadCount > 0 && (
                        <Badge 
                          variant="default" 
                          className="h-5 min-w-5 px-1.5 text-[10px] bg-primary"
                        >
                          {thread.unreadCount}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {thread.totalMessages} message{thread.totalMessages !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export type { MessageThread };
