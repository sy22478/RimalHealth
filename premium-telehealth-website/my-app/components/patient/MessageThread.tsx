/**
 * Patient Message Thread Component
 * 
 * Displays full conversation thread with the physician.
 * Includes message history, timestamps, and reply functionality.
 * 
 * HIPAA Compliance:
 * - PHI is decrypted only for authorized patient
 * - All access is audit logged
 * - Messages marked as read on view
 */

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Stethoscope,
  AlertCircle,
  Loader2,
  Check,
  CheckCheck,
  User
} from 'lucide-react';
import { formatDistanceToNow } from '@/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/badge';
import { MessageComposer } from './MessageComposer';

/**
 * Message interface
 */
interface Message {
  id: string;
  threadId: string;
  subject?: string;
  body: string;
  senderType: 'PATIENT' | 'PHYSICIAN' | 'SYSTEM';
  senderId: string;
  senderName: string;
  recipientId: string;
  sentAt: string;
  readAt?: string;
}

/**
 * Thread detail interface
 */
interface ThreadDetail {
  id: string;
  physicianId: string;
  physicianName: string;
  messages: Message[];
  unreadCount: number;
}

interface MessageThreadProps {
  threadId: string | null;
  onBack?: () => void;
}

/**
 * Format timestamp for display
 * Shows "Today", "Yesterday", or date
 */
function formatMessageDate(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (messageDate.getTime() === today.getTime()) {
    return 'Today';
  } else if (messageDate.getTime() === yesterday.getTime()) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
  }
}

/**
 * Format time for display
 */
function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Patient Message Thread Component
 * 
 * Shows conversation with the assigned physician.
 * Auto-refreshes and marks messages as read.
 * Patient messages are right-aligned (blue), MD messages left-aligned (gray).
 */
export function MessageThread({
  threadId,
  onBack,
}: MessageThreadProps): React.ReactElement {
  const router = useRouter();
  const [thread, setThread] = React.useState<ThreadDetail | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [newMessageNotification, setNewMessageNotification] = React.useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const messagesContainerRef = React.useRef<HTMLDivElement>(null);

  /**
   * Fetch thread details
   */
  const fetchThread = React.useCallback(async (showLoading = true) => {
    if (!threadId) return;

    if (showLoading) {
      setIsLoading(true);
    }
    setError(null);

    try {
      const response = await fetch(`/api/patient/messages/${threadId}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login');
          return;
        }
        if (response.status === 404) {
          throw new Error('Conversation not found');
        }
        throw new Error('Failed to load conversation');
      }

      const data = await response.json() as { thread: ThreadDetail };
      
      // Check for new messages
      if (thread && data.thread.messages.length > thread.messages.length) {
        setNewMessageNotification(true);
      }
      
      setThread(data.thread);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load conversation');
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  }, [threadId, router, thread]);

  // Initial fetch when thread changes
  React.useEffect(() => {
    void fetchThread();
    setNewMessageNotification(false);
  }, [fetchThread, threadId]);

  // Polling for new messages every 30 seconds
  React.useEffect(() => {
    if (!threadId) return;

    const interval = setInterval(() => {
      void fetchThread(false);
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchThread, threadId]);

  // Scroll to bottom on new messages (if already near bottom)
  React.useEffect(() => {
    if (messagesEndRef.current && messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
      
      if (isNearBottom) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [thread?.messages.length]);

  /**
   * Handle sending a new message
   */
  const handleSendMessage = async (subject: string, body: string): Promise<void> => {
    if (!threadId || !thread) return;

    try {
      const response = await fetch('/api/patient/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          threadId,
          subject: subject || undefined,
          body,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json() as { error?: string };
        throw new Error(errorData.error ?? 'Failed to send message');
      }

      const data = await response.json() as { message: Message };
      
      // Add the new message to the thread
      setThread(prev => {
        if (!prev) return null;
        return {
          ...prev,
          messages: [...prev.messages, data.message],
        };
      });

      // Scroll to bottom
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  };

  /**
   * Group messages by date
   */
  const groupedMessages = React.useMemo(() => {
    if (!thread) return [];

    const groups: { date: string; messages: Message[] }[] = [];
    let currentGroup: { date: string; messages: Message[] } | null = null;

    thread.messages.forEach((message) => {
      const date = formatMessageDate(new Date(message.sentAt));
      
      if (!currentGroup || currentGroup.date !== date) {
        currentGroup = { date, messages: [] };
        groups.push(currentGroup);
      }
      
      currentGroup.messages.push(message);
    });

    return groups;
  }, [thread]);

  // Empty state - no thread selected
  if (!threadId) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gray-50/50 p-4">
        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <Stethoscope className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-lg font-medium text-gray-900">Message Your Doctor</h3>
        <p className="text-sm text-muted-foreground mt-1 text-center max-w-sm">
          Send secure messages to your physician and receive replies within 24 hours
        </p>
      </div>
    );
  }

  // Loading state
  if (isLoading && !thread) {
    return (
      <div className="flex flex-col h-full">
        {/* Header Skeleton */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white">
          {onBack && (
            <Button variant="ghost" size="icon" className="md:hidden" onClick={onBack}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-24 mt-1" />
          </div>
        </div>
        
        {/* Messages Skeleton */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={`flex gap-3 ${i % 2 === 0 ? 'flex-row' : 'flex-row-reverse'}`}>
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-20 w-2/3 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error && !thread) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gray-50/50 p-4">
        <AlertCircle className="h-12 w-12 text-destructive mb-3" />
        <h3 className="text-lg font-medium text-gray-900">Failed to load conversation</h3>
        <p className="text-sm text-muted-foreground mt-1 text-center">{error}</p>
        <Button 
          variant="outline" 
          className="mt-4"
          onClick={() => void fetchThread()}
        >
          Try Again
        </Button>
      </div>
    );
  }

  // Thread not found
  if (!thread) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gray-50/50 p-4">
        <Stethoscope className="h-12 w-12 text-muted-foreground mb-3" />
        <h3 className="text-lg font-medium text-gray-900">Conversation not found</h3>
        <p className="text-sm text-muted-foreground mt-1 text-center">
          The conversation you&apos;re looking for doesn&apos;t exist or you don&apos;t have access.
        </p>
        {onBack && (
          <Button variant="outline" className="mt-4" onClick={onBack}>
            Back
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white">
        {onBack && (
          <Button 
            variant="ghost" 
            size="icon" 
            className="md:hidden"
            onClick={onBack}
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        
        <Avatar className="h-10 w-10">
          <AvatarFallback className="bg-primary/10 text-primary">
            <Stethoscope className="h-5 w-5" />
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">
            {thread.physicianName}
          </h3>
          <p className="text-xs text-muted-foreground">
            {thread.messages.length > 0 && (
              <>Last active {formatDistanceToNow(new Date(thread.messages[thread.messages.length - 1].sentAt))}</>
            )}
          </p>
        </div>

        {/* Response time indicator */}
        <Badge variant="secondary" className="hidden sm:inline-flex">
          24h Response
        </Badge>
      </header>

      {/* Messages */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-6"
      >
        {groupedMessages.map((group) => (
          <div key={group.date} className="space-y-4">
            {/* Date Divider */}
            <div className="flex items-center justify-center">
              <span className="text-xs text-muted-foreground bg-gray-100 px-3 py-1 rounded-full">
                {group.date}
              </span>
            </div>
            
            {/* Messages for this date */}
            {group.messages.map((message, index) => {
              const isPatient = message.senderType === 'PATIENT';
              const isSystem = message.senderType === 'SYSTEM';
              const isRead = !!message.readAt;

              if (isSystem) {
                return (
                  <div 
                    key={message.id}
                    className="flex justify-center my-4"
                  >
                    <span className="text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-full max-w-[80%] text-center">
                      {message.body}
                    </span>
                  </div>
                );
              }

              return (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-3",
                    isPatient ? "flex-row-reverse" : "flex-row"
                  )}
                >
                  {/* Avatar */}
                  <Avatar className="h-8 w-8 mt-1 shrink-0">
                    {isPatient ? (
                      <AvatarFallback className="bg-ocean text-white text-xs">
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    ) : (
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                        <Stethoscope className="h-4 w-4" />
                      </AvatarFallback>
                    )}
                  </Avatar>

                  {/* Message Bubble */}
                  <div className={cn(
                    "max-w-[75%] lg:max-w-[65%]",
                    isPatient ? "items-end" : "items-start"
                  )}>
                    {/* Sender name */}
                    <span className="text-xs text-muted-foreground mb-1 block px-1">
                      {message.senderName}
                    </span>
                    
                    <div
                      className={cn(
                        "px-4 py-2.5 rounded-2xl text-sm shadow-sm",
                        isPatient
                          ? "bg-ocean text-white rounded-tr-sm"
                          : "bg-gray-100 text-gray-900 rounded-tl-sm"
                      )}
                    >
                      {message.subject && (
                        <p className={cn(
                          "font-medium mb-1 text-sm",
                          isPatient ? "text-white/90" : "text-gray-700"
                        )}>
                          {message.subject}
                        </p>
                      )}
                      <p className="whitespace-pre-wrap">{message.body}</p>
                    </div>
                    
                    {/* Timestamp and read status */}
                    <div className={cn(
                      "flex items-center gap-1 mt-1 text-xs",
                      isPatient ? "justify-end" : "justify-start"
                    )}>
                      <span className="text-muted-foreground">
                        {formatTime(new Date(message.sentAt))}
                      </span>
                      {isPatient && (
                        <span className={cn(
                          "flex items-center gap-0.5",
                          isRead ? "text-primary" : "text-muted-foreground"
                        )}>
                          {isRead ? (
                            <>
                              <CheckCheck className="h-3 w-3" />
                              <span className="sr-only">Read</span>
                            </>
                          ) : (
                            <>
                              <Check className="h-3 w-3" />
                              <span className="sr-only">Sent</span>
                            </>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        
        {/* New Message Notification */}
        {newMessageNotification && (
          <div className="flex justify-center sticky bottom-4">
            <button
              onClick={() => {
                setNewMessageNotification(false);
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="text-xs bg-primary text-primary-foreground px-4 py-2 rounded-full shadow-lg animate-in fade-in slide-in-from-bottom-2"
            >
              New message received
            </button>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      <MessageComposer 
        onSend={handleSendMessage}
        disabled={!thread}
      />
    </div>
  );
}

export type { Message, ThreadDetail };
