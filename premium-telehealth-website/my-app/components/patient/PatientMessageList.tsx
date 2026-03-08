/**
 * Patient Message List Component
 * 
 * Displays the message thread preview for the patient.
 * Shows the assigned physician and last message.
 * 
 * HIPAA Compliance:
 * - PHI preview is truncated
 * - No sensitive data in loading states
 */

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { 
  Stethoscope,
  Loader2,
  AlertCircle,
  MessageSquare,
  ChevronRight
} from 'lucide-react';
import { formatDistanceToNow } from '@/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/Skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Message thread summary interface
 */
interface MessageThread {
  id: string;
  physicianId: string;
  physicianName: string;
  lastMessage: {
    body: string;
    sentAt: string;
    senderType: 'PATIENT' | 'PHYSICIAN';
  };
  unreadCount: number;
  totalMessages: number;
}

interface PatientMessageListProps {
  selectedThreadId: string | null;
  onSelectThread: (threadId: string) => void;
  compact?: boolean;
}

/**
 * Patient Message List Component
 * 
 * Shows the conversation thread with the assigned physician.
 * Polls for new messages every 30 seconds.
 */
export function PatientMessageList({
  selectedThreadId,
  onSelectThread,
  compact = false,
}: PatientMessageListProps): React.ReactElement {
  const router = useRouter();
  const [threads, setThreads] = React.useState<MessageThread[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
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
      const response = await fetch('/api/patient/messages', {
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
   * Truncate message preview
   */
  const truncateMessage = (message: string, maxLength = 60): string => {
    if (message.length <= maxLength) return message;
    return message.slice(0, maxLength) + '...';
  };

  // Loading state
  if (isLoading) {
    return (
      <div className={cn("space-y-4", compact ? "p-4" : "p-6")}>
        <div className="flex items-center gap-3">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={cn("flex flex-col items-center justify-center", compact ? "p-4" : "p-6")}>
        <AlertCircle className="h-10 w-10 text-destructive mb-3" />
        <p className="text-sm text-muted-foreground text-center">{error}</p>
        <Button 
          variant="outline" 
          size="sm" 
          className="mt-4"
          onClick={() => void fetchThreads()}
        >
          Retry
        </Button>
      </div>
    );
  }

  // No threads (no physician assigned)
  if (threads.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center text-center", compact ? "p-4" : "p-6")}>
        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
          <Stethoscope className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium">No physician assigned</p>
        <p className="text-xs text-muted-foreground mt-1">
          Messaging will be available once a physician is assigned to your care
        </p>
      </div>
    );
  }

  const thread = threads[0]; // Patient has only one thread

  // Compact view (sidebar style)
  if (compact) {
    return (
      <div className="divide-y divide-gray-100">
        {threads.map((t) => (
          <button
            key={t.id}
            onClick={() => onSelectThread(t.id)}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50",
              selectedThreadId === t.id && "bg-primary/5 hover:bg-primary/10",
              t.unreadCount > 0 && "bg-primary/[0.02]"
            )}
            aria-current={selectedThreadId === t.id ? 'true' : undefined}
            aria-label={`Conversation with ${t.physicianName}${t.unreadCount > 0 ? `, ${t.unreadCount} unread messages` : ''}`}
          >
            <Avatar className="h-10 w-10 shrink-0">
              <AvatarFallback className={cn(
                "text-sm",
                selectedThreadId === t.id 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-primary/10 text-primary"
              )}>
                <Stethoscope className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className={cn(
                  "font-medium truncate",
                  t.unreadCount > 0 && "text-foreground"
                )}>
                  {t.physicianName}
                </span>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatDistanceToNow(new Date(t.lastMessage.sentAt))}
                </span>
              </div>
              
              <p className={cn(
                "text-sm truncate mt-0.5",
                t.unreadCount > 0 
                  ? "text-foreground font-medium" 
                  : "text-muted-foreground"
              )}>
                {t.lastMessage.senderType === 'PATIENT' ? 'You: ' : ''}
                {truncateMessage(t.lastMessage.body)}
              </p>
              
              {t.unreadCount > 0 && (
                <div className="flex items-center gap-2 mt-1.5">
                  <Badge 
                    variant="default" 
                    className="h-5 min-w-5 px-1.5 text-[10px] bg-primary"
                  >
                    {t.unreadCount}
                  </Badge>
                  <span className="text-xs text-muted-foreground">new</span>
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
    );
  }

  // Full card view
  return (
    <Card className={cn(
      "transition-all cursor-pointer hover:shadow-md",
      selectedThreadId === thread.id && "ring-2 ring-primary ring-offset-2"
    )}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-primary" />
            Your Physician
          </span>
          {totalUnread > 0 && (
            <Badge variant="default" className="bg-primary">
              {totalUnread} new
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <button
          onClick={() => onSelectThread(thread.id)}
          className="w-full text-left"
        >
          <div className="flex items-start gap-4">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="bg-primary/10 text-primary text-lg">
                {thread.physicianName.split(' ').map(n => n[0]).join('')}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-gray-900">
                {thread.physicianName}
              </h4>
              
              <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                <p className={cn(
                  "text-sm",
                  thread.unreadCount > 0 ? "text-foreground font-medium" : "text-muted-foreground"
                )}>
                  {thread.lastMessage.senderType === 'PATIENT' ? (
                    <span className="text-muted-foreground">You: </span>
                  ) : (
                    <span className="text-primary font-medium">New reply: </span>
                  )}
                  {truncateMessage(thread.lastMessage.body, 100)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDistanceToNow(new Date(thread.lastMessage.sentAt))}
                </p>
              </div>

              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-muted-foreground">
                  {thread.totalMessages} message{thread.totalMessages !== 1 ? 's' : ''}
                </span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-primary hover:text-primary"
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  {thread.unreadCount > 0 ? 'View New Messages' : 'View Conversation'}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          </div>
        </button>
      </CardContent>
    </Card>
  );
}

export type { MessageThread };
