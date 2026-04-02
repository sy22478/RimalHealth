'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import {
  MessageSquare,
  Send,
  Search,
  Check,
  CheckCheck,
  User,
  Stethoscope,
  ChevronLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/Skeleton';

import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

type SenderType = 'PATIENT' | 'PHYSICIAN' | 'SYSTEM';

interface Message {
  id: string;
  subject: string | null;
  body: string;
  senderType: SenderType;
  senderName: string;
  senderId: string;
  sentAt: Date;
  readAt: Date | null;
}

interface Conversation {
  id: string;
  participantName: string;
  participantType: 'PHYSICIAN' | 'SYSTEM';
  lastMessage: string;
  lastMessageAt: Date;
  unreadCount: number;
}

// ============================================================================
// Utility Functions
// ============================================================================

function formatMessageTime(date: Date): string {
  const now = new Date();
  const diffInMs = now.getTime() - new Date(date).getTime();
  const diffInMins = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInMins < 1) return 'Just now';
  if (diffInMins < 60) return `${diffInMins}m ago`;
  if (diffInHours < 24) return `${diffInHours}h ago`;
  if (diffInDays < 7) return `${diffInDays}d ago`;
  
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

// ============================================================================
// Components
// ============================================================================

function ConversationList({
  conversations,
  selectedId,
  onSelect,
  isLoading = false,
}: {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  isLoading?: boolean;
}) {
  const [searchQuery, setSearchQuery] = React.useState('');

  const filteredConversations = conversations.filter((conv) =>
    conv.participantName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 p-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search messages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredConversations.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No conversations found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredConversations.map((conversation) => (
              <button
                key={conversation.id}
                onClick={() => onSelect(conversation.id)}
                className={cn(
                  'w-full text-left p-4 hover:bg-gray-50 transition-colors',
                  selectedId === conversation.id && 'bg-ocean-50 hover:bg-ocean-50'
                )}
              >
                <div className="flex items-start gap-3">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarFallback
                      className={cn(
                        conversation.participantType === 'PHYSICIAN'
                          ? 'bg-ocean-100 text-ocean-700'
                          : 'bg-gray-100 text-gray-700'
                      )}
                    >
                      {conversation.participantType === 'PHYSICIAN' ? (
                        <Stethoscope className="h-4 w-4" />
                      ) : (
                        <User className="h-4 w-4" />
                      )}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3
                        className={cn(
                          'font-medium truncate',
                          conversation.unreadCount > 0 ? 'text-gray-900' : 'text-gray-700'
                        )}
                      >
                        {conversation.participantName}
                      </h3>
                      <span className="text-xs text-gray-500 shrink-0">
                        {formatMessageTime(conversation.lastMessageAt)}
                      </span>
                    </div>
                    <p
                      className={cn(
                        'text-sm truncate mt-0.5',
                        conversation.unreadCount > 0
                          ? 'text-gray-900 font-medium'
                          : 'text-gray-500'
                      )}
                    >
                      {conversation.lastMessage}
                    </p>
                  </div>

                  {conversation.unreadCount > 0 && (
                    <Badge
                      variant="default"
                      className="bg-ocean-500 text-white shrink-0"
                    >
                      {conversation.unreadCount}
                    </Badge>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MessageBubble({ message, isOwn }: { message: Message; isOwn: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex gap-3', isOwn && 'flex-row-reverse')}
    >
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback
          className={cn(
            message.senderType === 'PHYSICIAN'
              ? 'bg-ocean-100 text-ocean-700'
              : message.senderType === 'SYSTEM'
              ? 'bg-gray-100 text-gray-700'
              : 'bg-green-100 text-green-700'
          )}
        >
          {message.senderType === 'PHYSICIAN' ? (
            <Stethoscope className="h-3 w-3" />
          ) : message.senderType === 'SYSTEM' ? (
            <User className="h-3 w-3" />
          ) : (
            <User className="h-3 w-3" />
          )}
        </AvatarFallback>
      </Avatar>

      <div className={cn('flex-1 max-w-[80%]', isOwn && 'text-right')}>
        <div
          className={cn(
            'inline-block rounded-2xl px-4 py-2 text-left',
            isOwn
              ? 'bg-ocean-500 text-white'
              : 'bg-gray-100 text-gray-900'
          )}
        >
          {message.subject && !isOwn && (
            <p className="font-medium text-sm mb-1">{message.subject}</p>
          )}
          <p className="text-sm whitespace-pre-wrap">{message.body}</p>
        </div>

        <div
          className={cn(
            'flex items-center gap-1 mt-1 text-xs text-gray-500',
            isOwn && 'justify-end'
          )}
        >
          <span>{formatMessageTime(message.sentAt)}</span>
          {isOwn && (
            <>
              {message.readAt ? (
                <CheckCheck className="h-3 w-3 text-blue-500" />
              ) : (
                <Check className="h-3 w-3" />
              )}
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function MessageThread({
  messages,
  conversation,
  onSendMessage,
  onBack,
  isLoadingMessages = false,
  isSending = false,
}: {
  messages: Message[];
  conversation: Conversation | null;
  onSendMessage: (content: string) => void;
  onBack?: () => void;
  isLoadingMessages?: boolean;
  isSending?: boolean;
}) {
  const [newMessage, setNewMessage] = React.useState('');
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  React.useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim()) {
      onSendMessage(newMessage.trim());
      setNewMessage('');
    }
  };

  if (!conversation) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500">
        <MessageSquare className="h-12 w-12 mb-4 opacity-30" />
        <p className="text-lg font-medium">Select a conversation</p>
        <p className="text-sm">Choose a conversation from the list to view messages</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden shrink-0"
              onClick={onBack}
              aria-label="Back to conversations"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
          )}
          <Avatar className="h-10 w-10">
            <AvatarFallback
              className={cn(
                conversation.participantType === 'PHYSICIAN'
                  ? 'bg-ocean-100 text-ocean-700'
                  : 'bg-gray-100 text-gray-700'
              )}
            >
              {conversation.participantType === 'PHYSICIAN' ? (
                <Stethoscope className="h-4 w-4" />
              ) : (
                <User className="h-4 w-4" />
              )}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-medium text-gray-900">{conversation.participantName}</h3>
            <p className="text-xs text-gray-500">
              {conversation.participantType === 'PHYSICIAN'
                ? 'Your treating physician'
                : 'System notifications'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoadingMessages ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className={cn('flex gap-3', i % 2 === 0 && 'flex-row-reverse')}>
                <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                <div className="space-y-1 max-w-[60%]">
                  <Skeleton className="h-12 w-48 rounded-2xl" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No messages yet</p>
            <p className="text-sm">Send a message to start the conversation</p>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                isOwn={message.senderType === 'PATIENT'}
              />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      <form onSubmit={handleSend} className="p-4 border-t border-gray-200">
        <div className="flex items-end gap-2">
          <Textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your message..."
            className="min-h-[44px] max-h-32 resize-none"
            rows={1}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend(e);
              }
            }}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!newMessage.trim() || isSending}
            className="shrink-0 bg-ocean-500 hover:bg-ocean-600"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Press Enter to send, Shift + Enter for new line
        </p>
      </form>
    </div>
  );
}

// ============================================================================
// Main Messages Page
// ============================================================================

export default function MessagesPage() {
  const [selectedConversationId, setSelectedConversationId] = React.useState<string | null>(null);
  const [conversations, setConversations] = React.useState<Conversation[]>([]);
  const [messages, setMessages] = React.useState<Record<string, Message[]>>({});
  const [isLoadingConvs, setIsLoadingConvs] = React.useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = React.useState(false);
  const [isSending, setIsSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadThreads = React.useCallback(async () => {
    try {
      setError(null);
      const res = await fetch('/api/patient/messages', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const threads = data.threads || [];
        // Map API threads to local Conversation type
        // API shape: { id, physicianName, lastMessage: { body, sentAt, senderType }, unreadCount }
        const convs: Conversation[] = threads.map((t: { id?: string; physicianName?: string; lastMessage?: { body?: string; sentAt?: string; senderType?: string }; unreadCount?: number }) => ({
          id: t.id,
          participantName: t.physicianName || 'Your Doctor',
          participantType: 'PHYSICIAN' as const,
          lastMessage: t.lastMessage?.body || '',
          lastMessageAt: new Date(t.lastMessage?.sentAt || Date.now()),
          unreadCount: t.unreadCount || 0,
        }));
        setConversations(convs);
      } else if (res.status === 401) {
        // Session expired — redirect to login
        window.location.href = `/login?from=${encodeURIComponent('/patient/messages')}`;
        return;
      } else {
        // Non-auth errors should show feedback
        const errorData = await res.json().catch(() => null);
        setError(errorData?.error || 'Failed to load messages. Please try again.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(`Unable to load messages. Please try again. (${msg})`);
    } finally {
      setIsLoadingConvs(false);
    }
  }, []);

  React.useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  const selectedConversation = conversations.find(
    (c) => c.id === selectedConversationId
  ) || null;

  const selectedMessages = selectedConversationId
    ? messages[selectedConversationId] || []
    : [];

  const handleSendMessage = async (content: string) => {
    if (!selectedConversationId || isSending) return;

    setIsSending(true);
    setError(null);

    // Save current state for rollback on failure
    const previousMessages = messages[selectedConversationId] || [];
    const previousConversation = conversations.find(c => c.id === selectedConversationId);

    const optimistic: Message = {
      id: `msg-${Date.now()}`,
      subject: null,
      body: content,
      senderType: 'PATIENT',
      senderName: 'You',
      senderId: 'patient',
      sentAt: new Date(),
      readAt: null,
    };

    setMessages(prev => ({
      ...prev,
      [selectedConversationId]: [...(prev[selectedConversationId] || []), optimistic],
    }));
    setConversations(prev =>
      prev.map(c => c.id === selectedConversationId
        ? { ...c, lastMessage: content, lastMessageAt: new Date() }
        : c
      )
    );

    try {
      const res = await fetch('/api/patient/messages', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId: selectedConversationId, body: content }),
      });

      if (!res.ok) {
        // Server returned an error — rollback optimistic update
        setMessages(prev => ({
          ...prev,
          [selectedConversationId]: previousMessages,
        }));
        if (previousConversation) {
          setConversations(prev =>
            prev.map(c => c.id === selectedConversationId
              ? { ...c, lastMessage: previousConversation.lastMessage, lastMessageAt: previousConversation.lastMessageAt }
              : c
            )
          );
        }
        if (res.status === 401) {
          window.location.href = `/login?from=${encodeURIComponent('/patient/messages')}`;
          return;
        }
        const errorData = await res.json().catch(() => null);
        setError(errorData?.error || 'Failed to send message. Please try again.');
        return;
      }

      // Replace optimistic message with server-confirmed data
      const data = await res.json();
      if (data.message) {
        setMessages(prev => ({
          ...prev,
          [selectedConversationId]: (prev[selectedConversationId] || []).map(m =>
            m.id === optimistic.id
              ? {
                  ...m,
                  id: data.message.id,
                  sentAt: new Date(data.message.sentAt),
                }
              : m
          ),
        }));
      }

      // Refresh thread list to update last message and unread counts
      loadThreads();
    } catch (err) {
      // Network error — rollback optimistic update
      setMessages(prev => ({
        ...prev,
        [selectedConversationId]: previousMessages,
      }));
      if (previousConversation) {
        setConversations(prev =>
          prev.map(c => c.id === selectedConversationId
            ? { ...c, lastMessage: previousConversation.lastMessage, lastMessageAt: previousConversation.lastMessageAt }
            : c
          )
        );
      }
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to send message. Please try again. (${msg})`);
    } finally {
      setIsSending(false);
    }
  };

  const handleSelectConversation = async (id: string) => {
    setSelectedConversationId(id);
    setError(null);
    setConversations(prev => prev.map(c => c.id === id ? { ...c, unreadCount: 0 } : c));

    // Always fetch fresh messages from the server to ensure persistence.
    // Previously this was cached (skipped if messages[id] existed), which caused
    // sent messages to disappear on page refresh because the optimistic cache
    // was stale or empty after remount.
    setIsLoadingMessages(true);
    try {
      const res = await fetch(`/api/patient/messages?threadId=${encodeURIComponent(id)}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        // API returns { thread: { messages: [...] } } when threadId is provided
        const rawMessages = data.thread?.messages || data.messages || [];
        const msgs: Message[] = (rawMessages).map((m: { id: string; subject?: string; body?: string; senderType?: string; senderName?: string; senderId?: string; sentAt: string; readAt?: string | null }) => ({
          id: m.id,
          subject: m.subject || null,
          body: m.body || '',
          senderType: (m.senderType || 'SYSTEM') as SenderType,
          senderName: m.senderName || (m.senderType === 'PHYSICIAN' ? 'Your Doctor' : 'System'),
          senderId: m.senderId || '',
          sentAt: new Date(m.sentAt),
          readAt: m.readAt ? new Date(m.readAt) : null,
        }));
        setMessages(prev => ({ ...prev, [id]: msgs }));
      } else if (res.status === 401) {
        window.location.href = `/login?from=${encodeURIComponent('/patient/messages')}`;
        return;
      } else {
        const errorData = await res.json().catch(() => null);
        setError(errorData?.error || 'Failed to load conversation. Please try again.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to load conversation. Please try again. (${msg})`);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  return (
    <div className="h-[calc(100vh-64px)] lg:h-[calc(100vh-0px)] bg-white">
      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
          <p className="text-sm text-red-700">{error}</p>
          <button
            onClick={() => { setError(null); loadThreads(); }}
            className="text-sm font-medium text-red-700 hover:text-red-900 underline"
          >
            Retry
          </button>
        </div>
      )}
      <div className="h-full flex">
        <div
          className={cn(
            'w-full lg:w-80 border-r border-gray-200',
            selectedConversationId && 'hidden lg:block'
          )}
        >
          <div className="p-4 border-b border-gray-200">
            <h1 className="text-xl font-semibold text-gray-900">Messages</h1>
            <p className="text-sm text-gray-500">Communicate with your care team</p>
          </div>
          <ConversationList
            conversations={conversations}
            selectedId={selectedConversationId}
            onSelect={handleSelectConversation}
            isLoading={isLoadingConvs}
          />
        </div>

        <div className={cn('flex-1', !selectedConversationId && 'hidden lg:block')}>
          <MessageThread
            messages={selectedMessages}
            conversation={selectedConversation}
            onSendMessage={handleSendMessage}
            onBack={() => setSelectedConversationId(null)}
            isLoadingMessages={isLoadingMessages}
            isSending={isSending}
          />
        </div>
      </div>
    </div>
  );
}
