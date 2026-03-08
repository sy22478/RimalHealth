/**
 * MessageThread Component
 * 
 * Displays and manages patient communication threads.
 * Includes message history, compose form, and read receipts.
 * 
 * @module components/physician/MessageThread
 */

'use client';

import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  Send,
  Paperclip,
  MoreVertical,
  Phone,
  Clock,
  Check,
  CheckCheck,
  ChevronLeft,
  Search,
  MessageSquare,
} from 'lucide-react';
import { PhysicianMessage, PhysicianMessageThread } from '@/types/physician-dashboard';
import { SenderType } from '@prisma/client';
import { EmptyState } from '@/components/shared/EmptyState';

// ============================================================================
// Validation Schema
// ============================================================================

const messageSchema = z.object({
  subject: z.string().optional(),
  body: z.string().min(1, 'Message cannot be empty'),
});

type MessageFormValues = z.infer<typeof messageSchema>;

// ============================================================================
// Props Interface
// ============================================================================

interface MessageThreadProps {
  /** Current thread messages */
  messages: PhysicianMessage[];
  /** Patient info */
  patient: {
    id: string;
    name: string;
    initials: string;
    avatar?: string;
    isOnline?: boolean;
  };
  /** Current physician info */
  physician: {
    id: string;
    name: string;
    initials: string;
  };
  /** Send message handler */
  onSendMessage: (data: MessageFormValues) => Promise<void>;
  /** Load more messages handler */
  onLoadMore?: () => Promise<void>;
  /** Has more messages to load */
  hasMoreMessages?: boolean;
  /** Loading state */
  isLoading?: boolean;
  /** Additional CSS classes */
  className?: string;
}

interface MessageThreadListProps {
  /** List of message threads */
  threads: PhysicianMessageThread[];
  /** Selected thread ID */
  selectedThreadId?: string;
  /** Thread selection handler */
  onSelectThread: (thread: PhysicianMessageThread) => void;
  /** Search query handler */
  onSearch?: (query: string) => void;
  /** Loading state */
  isLoading?: boolean;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format timestamp for display
 */
function formatMessageTime(date: Date): string {
  const now = new Date();
  const messageDate = new Date(date);
  const diffInDays = Math.floor((now.getTime() - messageDate.getTime()) / (1000 * 60 * 60 * 24));

  if (diffInDays === 0) {
    return messageDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
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
function groupMessagesByDate(messages: PhysicianMessage[]): Map<string, PhysicianMessage[]> {
  const groups = new Map<string, PhysicianMessage[]>();
  
  messages.forEach((message) => {
    const date = new Date(message.sentAt).toDateString();
    if (!groups.has(date)) {
      groups.set(date, []);
    }
    groups.get(date)!.push(message);
  });
  
  return groups;
}

// ============================================================================
// Components
// ============================================================================

/**
 * MessageThread displays a conversation with a patient
 */
export function MessageThread({
  messages,
  patient,
  physician,
  onSendMessage,
  onLoadMore,
  hasMoreMessages = false,
  isLoading = false,
  className,
}: MessageThreadProps) {
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { register, handleSubmit, reset, watch } = useForm<MessageFormValues>({
    resolver: zodResolver(messageSchema),
  });

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleFormSubmit = async (values: MessageFormValues) => {
    setIsSending(true);
    try {
      await onSendMessage(values);
      reset();
    } finally {
      setIsSending(false);
    }
  };

  const messageGroups = groupMessagesByDate(messages);
  const messageBody = watch('body');

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="flex items-center gap-4 p-4 border-b">
        <Avatar className="h-10 w-10">
          {patient.avatar ? (
            <img src={patient.avatar} alt={patient.name} />
          ) : (
            <AvatarFallback className="bg-ocean-100 text-ocean-700">
              {patient.initials}
            </AvatarFallback>
          )}
        </Avatar>
        <div className="flex-1">
          <h3 className="font-semibold">{patient.name}</h3>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {patient.isOnline ? (
              <>
                <span className="w-2 h-2 rounded-full bg-green-500" />
                Online
              </>
            ) : (
              <>
                <Clock className="w-3 h-3" />
                Offline
              </>
            )}
          </div>
        </div>
        <Button variant="ghost" size="icon">
          <Phone className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon">
          <MoreVertical className="w-4 h-4" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {hasMoreMessages && (
          <div className="text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={onLoadMore}
              disabled={isLoading}
            >
              {isLoading ? 'Loading...' : 'Load more messages'}
            </Button>
          </div>
        )}

        {messages.length === 0 ? (
          <EmptyState
            title="No messages yet"
            description="Start a conversation with this patient."
            icon="message"
            compact
          />
        ) : (
          Array.from(messageGroups.entries()).map(([date, dateMessages]) => (
            <div key={date} className="space-y-4">
              {/* Date Separator */}
              <div className="flex items-center justify-center">
                <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                  {formatMessageDate(new Date(date))}
                </span>
              </div>

              {/* Messages for this date */}
              {dateMessages.map((message) => {
                const isPhysician = message.senderType === SenderType.PHYSICIAN;
                
                return (
                  <div
                    key={message.id}
                    className={cn(
                      'flex gap-3',
                      isPhysician ? 'flex-row-reverse' : 'flex-row'
                    )}
                  >
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback
                        className={cn(
                          'text-xs',
                          isPhysician
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-ocean-100 text-ocean-700'
                        )}
                      >
                        {isPhysician ? physician.initials : patient.initials}
                      </AvatarFallback>
                    </Avatar>

                    <div
                      className={cn(
                        'max-w-[70%] space-y-1',
                        isPhysician ? 'items-end' : 'items-start'
                      )}
                    >
                      <div
                        className={cn(
                          'px-4 py-2 rounded-2xl',
                          isPhysician
                            ? 'bg-primary text-primary-foreground rounded-br-none'
                            : 'bg-muted rounded-bl-none'
                        )}
                      >
                        {message.subject && (
                          <p className="font-semibold text-sm mb-1">{message.subject}</p>
                        )}
                        <p className="text-sm whitespace-pre-wrap">{message.body}</p>
                      </div>
                      <div
                        className={cn(
                          'flex items-center gap-1 text-xs text-muted-foreground',
                          isPhysician && 'flex-row-reverse'
                        )}
                      >
                        <span>{formatMessageTime(message.sentAt)}</span>
                        {isPhysician && (
                          <>
                            {message.readAt ? (
                              <CheckCheck className="w-3 h-3 text-blue-500" />
                            ) : (
                              <Check className="w-3 h-3" />
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Compose */}
      <div className="p-4 border-t bg-muted/50">
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-3">
          <Textarea
            {...register('body')}
            placeholder="Type your message..."
            className="min-h-[80px] resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(handleFormSubmit)();
              }
            }}
          />
          <div className="flex items-center justify-between">
            <Button type="button" variant="ghost" size="sm">
              <Paperclip className="w-4 h-4 mr-1" />
              Attach
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSending || !messageBody?.trim()}
            >
              <Send className="w-4 h-4 mr-1" />
              {isSending ? 'Sending...' : 'Send'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * MessageThreadList displays a list of conversation threads
 */
export function MessageThreadList({
  threads,
  selectedThreadId,
  onSelectThread,
  onSearch,
  isLoading = false,
  className,
}: MessageThreadListProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    onSearch?.(value);
  };

  const totalUnread = threads.reduce((sum, t) => sum + t.unreadCount, 0);

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Messages
            {totalUnread > 0 && (
              <Badge variant="secondary">{totalUnread}</Badge>
            )}
          </h2>
        </div>

        {onSearch && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search messages..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        )}
      </div>

      {/* Thread List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3">
                <div className="w-10 h-10 rounded-full bg-muted animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded animate-pulse w-1/2" />
                  <div className="h-3 bg-muted rounded animate-pulse w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : threads.length === 0 ? (
          <EmptyState
            title="No messages"
            description="You have no active message threads."
            icon="message"
            compact
            className="py-8"
          />
        ) : (
          <div className="divide-y">
            {threads.map((thread) => (
              <button
                key={thread.patientId}
                onClick={() => onSelectThread(thread)}
                className={cn(
                  'w-full flex items-start gap-3 p-4 text-left transition-colors hover:bg-muted/50',
                  selectedThreadId === thread.patientId && 'bg-muted'
                )}
              >
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarFallback className="bg-ocean-100 text-ocean-700 text-sm">
                    {thread.patientInitials}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-medium truncate">{thread.patientName}</h4>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatMessageTime(thread.lastMessageAt)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {thread.lastMessagePreview}
                  </p>
                </div>

                {thread.unreadCount > 0 && (
                  <Badge variant="default" className="shrink-0">
                    {thread.unreadCount}
                  </Badge>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Full Messages View (List + Thread)
// ============================================================================

interface MessagesViewProps {
  threads: PhysicianMessageThread[];
  selectedThread?: {
    thread: PhysicianMessageThread;
    messages: PhysicianMessage[];
  };
  physician: {
    id: string;
    name: string;
    initials: string;
  };
  onSelectThread: (thread: PhysicianMessageThread) => void;
  onSendMessage: (data: MessageFormValues) => Promise<void>;
  onSearch?: (query: string) => void;
  isLoading?: boolean;
  className?: string;
}

/**
 * Full messages view with sidebar and conversation
 */
export function MessagesView({
  threads,
  selectedThread,
  physician,
  onSelectThread,
  onSendMessage,
  onSearch,
  isLoading,
  className,
}: MessagesViewProps) {
  return (
    <div className={cn('flex h-[calc(100vh-200px)] border rounded-lg overflow-hidden', className)}>
      {/* Thread List */}
      <MessageThreadList
        threads={threads}
        selectedThreadId={selectedThread?.thread.patientId}
        onSelectThread={onSelectThread}
        onSearch={onSearch}
        isLoading={isLoading}
        className="w-full md:w-80 border-r"
      />

      {/* Message Thread */}
      {selectedThread ? (
        <MessageThread
          messages={selectedThread.messages}
          patient={{
            id: selectedThread.thread.patientId,
            name: selectedThread.thread.patientName,
            initials: selectedThread.thread.patientInitials,
          }}
          physician={physician}
          onSendMessage={onSendMessage}
          className="hidden md:flex flex-1"
        />
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center bg-muted/30">
          <EmptyState
            title="Select a conversation"
            description="Choose a patient from the list to view messages."
            icon="message"
            compact
          />
        </div>
      )}
    </div>
  );
}
