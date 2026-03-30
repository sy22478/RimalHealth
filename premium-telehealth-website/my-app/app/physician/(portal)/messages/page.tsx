/**
 * Physician Messaging Page
 *
 * Doctor-to-patient communication interface with split-pane design.
 * Includes thread list, message viewing, and compose functionality.
 * Fetches data from /api/physician/messages on mount.
 *
 * @module app/physician/messages/page
 */

'use client';

import * as React from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { EmptyState } from '@/components/shared/EmptyState';
import { cn } from '@/lib/utils';
import {
  MessageSquare,
  Search,
  Send,
  Users,
  Check,
  CheckCheck,
  Plus,
  ChevronLeft,
  MoreVertical,
  User,
  Loader2,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface Thread {
  id: string;
  participant: {
    id: string;
    firstName: string;
    lastName: string;
  };
  lastMessage: {
    subject: string;
    preview: string;
    timestamp: string;
  };
  unreadCount: number;
}

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  subject: string;
  body: string;
  timestamp: string;
  isRead: boolean;
}

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatMessageTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffInDays === 0) {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  }
  if (diffInDays === 1) {
    return 'Yesterday';
  }
  if (diffInDays < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatMessageDate(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffInDays === 0) return 'Today';
  if (diffInDays === 1) return 'Yesterday';
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase();
}

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

// ============================================================================
// Components
// ============================================================================

function ThreadListSkeleton() {
  return (
    <div className="p-4 space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3">
          <Skeleton className="w-10 h-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface ThreadListProps {
  threads: Thread[];
  selectedThreadId?: string;
  onSelectThread: (thread: Thread) => void;
  onSearch: (query: string) => void;
  onComposeClick: () => void;
  isLoading?: boolean;
  searchQuery: string;
}

function ThreadList({
  threads,
  selectedThreadId,
  onSelectThread,
  onSearch,
  onComposeClick,
  isLoading,
  searchQuery,
}: ThreadListProps) {
  const totalUnread = threads.reduce((sum, t) => sum + t.unreadCount, 0);

  return (
    <div className="flex flex-col h-full border-r bg-white">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Users className="w-5 h-5" />
            Patients
            {totalUnread > 0 && (
              <Badge variant="destructive">{totalUnread}</Badge>
            )}
          </h2>
          <Button size="sm" onClick={onComposeClick}>
            <Plus className="w-4 h-4 mr-1" />
            New
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search patients..."
            value={searchQuery}
            onChange={(e) => onSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <ThreadListSkeleton />
        ) : threads.length === 0 ? (
          <EmptyState
            title="No messages yet"
            description="Start a conversation with a patient."
            icon="message"
            compact
            className="py-8"
          />
        ) : (
          <div className="divide-y">
            {threads.map((thread) => (
              <button
                key={thread.id}
                onClick={() => onSelectThread(thread)}
                className={cn(
                  'w-full flex items-start gap-3 p-4 text-left transition-colors hover:bg-muted/50',
                  selectedThreadId === thread.id && 'bg-muted'
                )}
              >
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarFallback className="bg-green-100 text-green-700 text-sm">
                    {getInitials(thread.participant.firstName, thread.participant.lastName)}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-medium truncate">
                      {thread.participant.firstName} {thread.participant.lastName}
                    </h4>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatMessageTime(thread.lastMessage.timestamp)}
                    </span>
                  </div>
                  <p
                    className={cn(
                      'text-sm truncate mt-1',
                      thread.unreadCount > 0
                        ? 'font-medium text-foreground'
                        : 'text-muted-foreground'
                    )}
                  >
                    {thread.lastMessage.preview}
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

interface MessageThreadProps {
  thread: Thread;
  messages: Message[];
  onSendMessage: (body: string) => Promise<void>;
  isLoading?: boolean;
  currentUserId: string;
}

function MessageThread({
  thread,
  messages,
  onSendMessage,
  isLoading,
  currentUserId,
}: MessageThreadProps) {
  const [isSending, setIsSending] = useState(false);
  const [messageBody, setMessageBody] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!messageBody.trim()) return;

    setIsSending(true);
    try {
      await onSendMessage(messageBody);
      setMessageBody('');
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const messageGroups = groupMessagesByDate(messages);

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex items-center gap-4 p-4 border-b">
        <Avatar className="h-10 w-10">
          <AvatarFallback className="bg-green-100 text-green-700">
            {getInitials(thread.participant.firstName, thread.participant.lastName)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold">
            {thread.participant.firstName} {thread.participant.lastName}
          </h3>
          <p className="text-sm text-muted-foreground truncate">
            Patient
          </p>
        </div>
        <Button variant="ghost" size="icon">
          <MoreVertical className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {isLoading ? (
          <div className="space-y-4 p-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="w-8 h-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-16 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <EmptyState
            title="No messages yet"
            description="Start the conversation by sending a message."
            icon="message"
            compact
          />
        ) : (
          Array.from(messageGroups.entries()).map(([date, dateMessages]) => (
            <div key={date} className="space-y-4">
              <div className="flex items-center justify-center">
                <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                  {formatMessageDate(dateMessages[0].timestamp)}
                </span>
              </div>

              {dateMessages.map((message) => {
                const isCurrentUser = message.senderId === currentUserId;

                return (
                  <div
                    key={message.id}
                    className={cn(
                      'flex gap-3',
                      isCurrentUser ? 'flex-row-reverse' : 'flex-row'
                    )}
                  >
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback
                        className={cn(
                          'text-xs',
                          isCurrentUser
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-green-100 text-green-700'
                        )}
                      >
                        {isCurrentUser
                          ? 'ME'
                          : getInitials(
                              thread.participant.firstName,
                              thread.participant.lastName
                            )}
                      </AvatarFallback>
                    </Avatar>

                    <div
                      className={cn(
                        'max-w-[70%] space-y-1',
                        isCurrentUser ? 'items-end' : 'items-start'
                      )}
                    >
                      <div
                        className={cn(
                          'px-4 py-2 rounded-2xl',
                          isCurrentUser
                            ? 'bg-primary text-primary-foreground rounded-br-none'
                            : 'bg-muted rounded-bl-none'
                        )}
                      >
                        {message.subject && !isCurrentUser && (
                          <p className="font-semibold text-sm mb-1">{message.subject}</p>
                        )}
                        <p className="text-sm whitespace-pre-wrap">{message.body}</p>
                      </div>
                      <div
                        className={cn(
                          'flex items-center gap-1 text-xs text-muted-foreground',
                          isCurrentUser && 'flex-row-reverse'
                        )}
                      >
                        <span>{formatMessageTime(message.timestamp)}</span>
                        {isCurrentUser && (
                          <>
                            {message.isRead ? (
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

      <div className="p-4 border-t bg-muted/50">
        <div className="flex items-end gap-2">
          <Textarea
            value={messageBody}
            onChange={(e) => setMessageBody(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            className="min-h-[80px] resize-none"
            disabled={isSending}
          />
          <Button
            onClick={handleSend}
            disabled={isSending || !messageBody.trim()}
            className="h-11 w-11 shrink-0"
            size="icon"
          >
            {isSending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

interface ComposeDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  patients: Patient[];
  onSend: (patientId: string, subject: string, body: string) => Promise<void>;
  isLoading?: boolean;
}

function ComposeDialog({
  isOpen,
  onOpenChange,
  patients,
  onSend,
  isLoading,
}: ComposeDialogProps) {
  const [recipientId, setRecipientId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    if (!recipientId || !body.trim()) return;

    setIsSending(true);
    try {
      await onSend(recipientId, subject, body);
      setRecipientId('');
      setSubject('');
      setBody('');
      onOpenChange(false);
    } finally {
      setIsSending(false);
    }
  };

  const canSend = recipientId && body.trim() && !isSending;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>New Message</DialogTitle>
          <DialogDescription>Send a message to a patient</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">To</label>
            {isLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : patients.length === 0 ? (
              <p className="text-sm text-muted-foreground">No patients available.</p>
            ) : (
              <Select value={recipientId} onValueChange={setRecipientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a patient" />
                </SelectTrigger>
                <SelectContent>
                  {patients.map((patient) => (
                    <SelectItem key={patient.id} value={patient.id}>
                      <div className="flex flex-col">
                        <span>
                          {patient.firstName} {patient.lastName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {patient.email}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Subject</label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Enter subject (optional)"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Message</label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Type your message..."
              className="min-h-[150px]"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={!canSend}>
            {isSending ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-1" />
                Send
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NoThreadSelected({ onComposeClick }: { onComposeClick: () => void }) {
  return (
    <div className="flex-1 flex items-center justify-center bg-muted/30">
      <EmptyState
        title="Select a conversation"
        description="Choose a patient from the list or start a new conversation."
        icon="message"
        actionLabel="New Message"
        onAction={onComposeClick}
      />
    </div>
  );
}

function StatsCard({
  title,
  value,
  icon: Icon,
  colorClass,
}: {
  title: string;
  value: number;
  icon: React.ElementType;
  colorClass: string;
}) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={cn('p-2 rounded-lg', colorClass)}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function PhysicianMessagingPage() {
  const { toast } = useToast();

  const [threads, setThreads] = useState<Thread[]>([]);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [selectedThreadId, setSelectedThreadId] = useState<string | undefined>();
  const [searchQuery, setSearchQuery] = useState('');
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isLoadingPatients, setIsLoadingPatients] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [currentUserId, setCurrentUserId] = useState('');

  // -----------------------------------------------------------------------
  // Fetch thread list
  // -----------------------------------------------------------------------
  const fetchThreads = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/physician/messages', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.threads)) {
          const mapped: Thread[] = data.threads.map(
            (t: {
              threadId: string;
              patientId?: string;
              patientName?: string;
              participantFirstName?: string;
              participantLastName?: string;
              lastMessage: { body: string; sentAt: string; subject?: string };
              unreadCount: number;
            }) => {
              // The API returns patientName as "FirstName LastName"
              // Parse it into firstName/lastName for the participant
              let firstName = '';
              let lastName = '';
              if (t.patientName) {
                const parts = t.patientName.split(' ');
                firstName = parts[0] || '';
                lastName = parts.slice(1).join(' ') || '';
              } else if (t.participantFirstName || t.participantLastName) {
                firstName = t.participantFirstName || '';
                lastName = t.participantLastName || '';
              }

              return {
                id: t.threadId,
                participant: {
                  id: t.patientId || '',
                  firstName,
                  lastName,
                },
                lastMessage: {
                  subject: t.lastMessage.subject || '',
                  preview: t.lastMessage.body,
                  timestamp: t.lastMessage.sentAt,
                },
                unreadCount: t.unreadCount,
              };
            }
          );
          setThreads(mapped);
        }
        if (data.currentUserId) {
          setCurrentUserId(data.currentUserId);
        }
      }
    } catch {
      // silently keep empty
    } finally {
      setIsLoading(false);
    }
  }, []);

  // -----------------------------------------------------------------------
  // Fetch patients for compose dialog
  // -----------------------------------------------------------------------
  const fetchPatients = useCallback(async () => {
    setIsLoadingPatients(true);
    try {
      const res = await fetch('/api/physician/patients?limit=100', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.patients)) {
          setPatients(
            data.patients.map(
              (p: { id: string; firstName: string; lastName: string; email: string }) => ({
                id: p.id,
                firstName: p.firstName,
                lastName: p.lastName,
                email: p.email,
              })
            )
          );
        }
      }
    } catch {
      // silently keep empty
    } finally {
      setIsLoadingPatients(false);
    }
  }, []);

  // -----------------------------------------------------------------------
  // Fetch messages for a thread
  // -----------------------------------------------------------------------
  const fetchMessages = useCallback(async (threadId: string) => {
    setIsLoadingMessages(true);
    try {
      const res = await fetch(
        `/api/physician/messages?threadId=${encodeURIComponent(threadId)}`,
        { cache: 'no-store' }
      );
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.messages)) {
          const mapped: Message[] = data.messages.map(
            (m: {
              id: string;
              senderId: string;
              senderName?: string;
              subject?: string;
              body: string;
              sentAt: string;
              readAt?: string | null;
            }) => ({
              id: m.id,
              senderId: m.senderId,
              senderName: m.senderName || '',
              subject: m.subject || '',
              body: m.body,
              timestamp: m.sentAt,
              isRead: !!m.readAt,
            })
          );
          setMessages((prev) => ({ ...prev, [threadId]: mapped }));
        }
      }
    } catch {
      // silently keep existing
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  // -----------------------------------------------------------------------
  // Mark thread as read
  // -----------------------------------------------------------------------
  const markAsRead = useCallback(async (threadId: string) => {
    try {
      await fetch(`/api/physician/messages/${threadId}/read`, { method: 'PATCH' });
    } catch {
      // best-effort
    }
    setThreads((prev) =>
      prev.map((t) => (t.id === threadId ? { ...t, unreadCount: 0 } : t))
    );
    setMessages((prev) => ({
      ...prev,
      [threadId]: prev[threadId]?.map((m) => ({ ...m, isRead: true })) || [],
    }));
  }, []);

  // -----------------------------------------------------------------------
  // Handle thread selection
  // -----------------------------------------------------------------------
  const handleSelectThread = useCallback(
    async (thread: Thread) => {
      setSelectedThreadId(thread.id);

      if (!messages[thread.id]) {
        await fetchMessages(thread.id);
      }

      if (thread.unreadCount > 0) {
        await markAsRead(thread.id);
      }
    },
    [fetchMessages, markAsRead, messages]
  );

  // -----------------------------------------------------------------------
  // Send reply in thread
  // -----------------------------------------------------------------------
  const handleSendMessage = useCallback(
    async (body: string) => {
      if (!selectedThreadId) return;

      const thread = threads.find((t) => t.id === selectedThreadId);
      if (!thread) return;

      try {
        const res = await fetch('/api/physician/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            threadId: selectedThreadId,
            patientId: thread.participant.id,
            body,
          }),
        });

        if (!res.ok) {
          toast({
            title: 'Failed to send message',
            description: 'Please try again.',
            variant: 'destructive',
          });
          return;
        }

        const data = await res.json();

        const newMessage: Message = {
          id: data.message?.id || `msg-${Date.now()}`,
          senderId: currentUserId,
          senderName: 'You',
          subject: '',
          body,
          timestamp: data.message?.sentAt || new Date().toISOString(),
          isRead: true,
        };

        setMessages((prev) => ({
          ...prev,
          [selectedThreadId]: [...(prev[selectedThreadId] || []), newMessage],
        }));

        setThreads((prev) =>
          prev.map((t) =>
            t.id === selectedThreadId
              ? {
                  ...t,
                  lastMessage: {
                    subject: t.lastMessage.subject,
                    preview: body.slice(0, 50) + (body.length > 50 ? '...' : ''),
                    timestamp: new Date().toISOString(),
                  },
                }
              : t
          )
        );
      } catch {
        toast({
          title: 'Failed to send message',
          description: 'Please try again.',
          variant: 'destructive',
        });
      }
    },
    [selectedThreadId, threads, currentUserId, toast]
  );

  // -----------------------------------------------------------------------
  // Compose new message to a patient
  // -----------------------------------------------------------------------
  const handleComposeSend = useCallback(
    async (patientId: string, subject: string, body: string) => {
      // Generate thread ID in the expected format: thread-{patientId}-{physicianId}
      const threadId = `thread-${patientId}-${currentUserId}`;

      try {
        const res = await fetch('/api/physician/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ patientId, threadId, body, subject: subject || undefined }),
        });

        if (!res.ok) {
          toast({
            title: 'Failed to send message',
            description: 'Please try again.',
            variant: 'destructive',
          });
          return;
        }

        toast({
          title: 'Message sent',
          description: 'Your message has been sent successfully.',
        });

        // Refresh threads to include the new conversation
        await fetchThreads();
      } catch {
        toast({
          title: 'Failed to send message',
          description: 'Please try again.',
          variant: 'destructive',
        });
      }
    },
    [fetchThreads, toast, currentUserId]
  );

  // -----------------------------------------------------------------------
  // Open compose dialog -- fetch patients if not yet loaded
  // -----------------------------------------------------------------------
  const handleComposeClick = useCallback(() => {
    if (patients.length === 0 && !isLoadingPatients) {
      void fetchPatients();
    }
    setIsComposeOpen(true);
  }, [patients.length, isLoadingPatients, fetchPatients]);

  // -----------------------------------------------------------------------
  // Initial load
  // -----------------------------------------------------------------------
  useEffect(() => {
    void fetchThreads();
  }, [fetchThreads]);

  // -----------------------------------------------------------------------
  // Poll for new messages every 30 seconds
  // -----------------------------------------------------------------------
  useEffect(() => {
    const pollInterval = setInterval(() => {
      void fetchThreads();
    }, 30000);
    return () => clearInterval(pollInterval);
  }, [fetchThreads]);

  // -----------------------------------------------------------------------
  // Derived values
  // -----------------------------------------------------------------------
  const filteredThreads = searchQuery
    ? threads.filter(
        (t) =>
          `${t.participant.firstName} ${t.participant.lastName}`
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          t.lastMessage.preview.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : threads;

  const selectedThread = selectedThreadId
    ? {
        thread: threads.find((t) => t.id === selectedThreadId)!,
        messages: messages[selectedThreadId] || [],
      }
    : undefined;

  const totalThreads = threads.length;
  const totalUnread = threads.reduce((sum, t) => sum + t.unreadCount, 0);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="w-6 h-6" />
            Messages
          </h1>
          <p className="text-muted-foreground">Communicate with your patients</p>
        </div>
        <div className="flex items-center gap-2">
          {totalUnread > 0 && (
            <Badge variant="destructive" className="px-3 py-1">
              {totalUnread} unread
            </Badge>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatsCard
          title="Patient Conversations"
          value={totalThreads}
          icon={Users}
          colorClass="bg-blue-100 text-blue-600"
        />
        <StatsCard
          title="Unread Messages"
          value={totalUnread}
          icon={MessageSquare}
          colorClass="bg-red-100 text-red-600"
        />
      </div>

      {/* Messages Split Pane */}
      <Card className="h-[calc(100vh-380px)] min-h-[500px] overflow-hidden">
        <div className="flex h-full">
          {/* Thread List Sidebar - 30% */}
          <div className="w-full md:w-[35%] lg:w-[30%] h-full">
            <ThreadList
              threads={filteredThreads}
              selectedThreadId={selectedThreadId}
              onSelectThread={handleSelectThread}
              onSearch={setSearchQuery}
              onComposeClick={handleComposeClick}
              isLoading={isLoading}
              searchQuery={searchQuery}
            />
          </div>

          {/* Message Thread - 70% */}
          <div className="hidden md:block md:w-[65%] lg:w-[70%] h-full">
            {selectedThread ? (
              <MessageThread
                thread={selectedThread.thread}
                messages={selectedThread.messages}
                onSendMessage={handleSendMessage}
                isLoading={isLoadingMessages}
                currentUserId={currentUserId}
              />
            ) : (
              <NoThreadSelected onComposeClick={handleComposeClick} />
            )}
          </div>
        </div>
      </Card>

      {/* Mobile: Full screen thread view when selected */}
      {selectedThreadId && (
        <div className="md:hidden fixed inset-0 z-50 bg-white">
          <div className="flex items-center gap-2 p-4 border-b">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedThreadId(undefined)}
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <span className="font-semibold">Back to conversations</span>
          </div>
          {selectedThread && (
            <div className="h-[calc(100vh-65px)]">
              <MessageThread
                thread={selectedThread.thread}
                messages={selectedThread.messages}
                onSendMessage={handleSendMessage}
                isLoading={isLoadingMessages}
                currentUserId={currentUserId}
              />
            </div>
          )}
        </div>
      )}

      {/* Compose Dialog */}
      <ComposeDialog
        isOpen={isComposeOpen}
        onOpenChange={setIsComposeOpen}
        patients={patients}
        onSend={handleComposeSend}
        isLoading={isLoadingPatients}
      />
    </div>
  );
}
