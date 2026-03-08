/**
 * Messages Client Component
 *
 * Patient messaging interface for physicians.
 * Shows conversation threads and allows sending messages.
 * Fetches data from /api/physician/messages on mount.
 *
 * @module app/physician/messages/MessagesClient
 */

'use client';

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessagesView } from '@/components/physician/MessageThread';
import {
  MessageSquare,
  Users,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import type {
  PhysicianMessageThread,
  PhysicianMessage,
  MessageFormValues,
} from '@/types/physician-dashboard';
import { SenderType } from '@prisma/client';
import { useToast } from '@/hooks/use-toast';

// ============================================================================
// Main Page
// ============================================================================

export default function MessagesPage() {
  const { toast } = useToast();

  const [threads, setThreads] = useState<PhysicianMessageThread[]>([]);
  const [messages, setMessages] = useState<Record<string, PhysicianMessage[]>>({});
  const [selectedThreadId, setSelectedThreadId] = useState<string | undefined>();
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [repliedToday, setRepliedToday] = useState(0);

  // Physician identity comes from the API response; start with a safe default.
  const [physician, setPhysician] = useState<{
    id: string;
    name: string;
    initials: string;
  }>({ id: '', name: 'Physician', initials: 'DR' });

  // -----------------------------------------------------------------------
  // Fetch thread list from API
  // -----------------------------------------------------------------------
  const fetchThreads = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/physician/messages', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.threads)) {
          // Map API thread shape to PhysicianMessageThread
          const mapped: PhysicianMessageThread[] = data.threads.map(
            (t: {
              threadId: string;
              patientId: string;
              patientName: string;
              lastMessage: { body: string; sentAt: string };
              unreadCount: number;
            }) => ({
              patientId: t.patientId,
              patientName: t.patientName,
              patientInitials: t.patientName
                .split(' ')
                .map((n: string) => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2),
              lastMessagePreview: t.lastMessage.body,
              lastMessageAt: new Date(t.lastMessage.sentAt),
              unreadCount: t.unreadCount,
              threadId: t.threadId,
            })
          );
          setThreads(mapped);
        }
        if (data.physician) {
          setPhysician(data.physician);
        }
        if (typeof data.repliedToday === 'number') {
          setRepliedToday(data.repliedToday);
        }
      }
    } catch {
      // silently keep empty state
    } finally {
      setIsLoading(false);
    }
  }, []);

  // -----------------------------------------------------------------------
  // Fetch messages for a specific thread
  // -----------------------------------------------------------------------
  const fetchMessages = useCallback(async (threadId: string, patientId: string) => {
    try {
      const res = await fetch(
        `/api/physician/messages?threadId=${encodeURIComponent(threadId)}&patientId=${encodeURIComponent(patientId)}`,
        { cache: 'no-store' }
      );
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.messages)) {
          const mapped: PhysicianMessage[] = data.messages.map(
            (m: {
              id: string;
              patientId?: string;
              senderType: SenderType;
              senderName: string;
              subject?: string;
              body: string;
              sentAt: string;
              readAt?: string | null;
            }) => ({
              id: m.id,
              patientId: m.patientId || patientId,
              senderType: m.senderType,
              senderName: m.senderName,
              subject: m.subject,
              body: m.body,
              sentAt: new Date(m.sentAt),
              read: !!m.readAt,
            })
          );
          setMessages((prev) => ({ ...prev, [patientId]: mapped }));
        }
      }
    } catch {
      // silently keep existing state
    }
  }, []);

  // -----------------------------------------------------------------------
  // Send message
  // -----------------------------------------------------------------------
  const handleSendMessage = useCallback(
    async (data: MessageFormValues) => {
      if (!selectedThreadId) return;

      const thread = threads.find((t) => t.patientId === selectedThreadId);
      if (!thread) return;

      try {
        const res = await fetch('/api/physician/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            patientId: selectedThreadId,
            threadId: (thread as PhysicianMessageThread & { threadId?: string }).threadId,
            body: data.body,
            subject: data.subject,
          }),
        });

        if (res.ok) {
          const responseData = await res.json();
          const newMsg: PhysicianMessage = {
            id: responseData.message?.id || `msg-${Date.now()}`,
            patientId: selectedThreadId,
            senderType: SenderType.PHYSICIAN,
            senderName: physician.name,
            subject: data.subject,
            body: data.body,
            sentAt: new Date(responseData.message?.sentAt || Date.now()),
            read: true,
          };

          setMessages((prev) => ({
            ...prev,
            [selectedThreadId]: [...(prev[selectedThreadId] || []), newMsg],
          }));

          // Update thread preview
          setThreads((prev) =>
            prev.map((t) =>
              t.patientId === selectedThreadId
                ? {
                    ...t,
                    lastMessagePreview: data.body.slice(0, 80) + (data.body.length > 80 ? '...' : ''),
                    lastMessageAt: new Date(),
                  }
                : t
            )
          );
        } else {
          toast({
            title: 'Failed to send message',
            description: 'Please try again.',
            variant: 'destructive',
          });
        }
      } catch {
        toast({
          title: 'Failed to send message',
          description: 'Please try again.',
          variant: 'destructive',
        });
      }
    },
    [selectedThreadId, threads, physician.name, toast]
  );

  // -----------------------------------------------------------------------
  // Select thread
  // -----------------------------------------------------------------------
  const handleSelectThread = useCallback(
    async (thread: PhysicianMessageThread) => {
      setSelectedThreadId(thread.patientId);
      const threadId = (thread as PhysicianMessageThread & { threadId?: string }).threadId;
      if (threadId && !messages[thread.patientId]) {
        await fetchMessages(threadId, thread.patientId);
      }
    },
    [fetchMessages, messages]
  );

  // -----------------------------------------------------------------------
  // Initial load
  // -----------------------------------------------------------------------
  useEffect(() => {
    void fetchThreads();
  }, [fetchThreads]);

  // -----------------------------------------------------------------------
  // Derived values
  // -----------------------------------------------------------------------
  const selectedThread = selectedThreadId
    ? {
        thread: threads.find((t) => t.patientId === selectedThreadId)!,
        messages: messages[selectedThreadId] || [],
      }
    : undefined;

  const totalUnread = threads.reduce((sum, t) => sum + t.unreadCount, 0);

  const filteredThreads = searchQuery
    ? threads.filter(
        (t) =>
          t.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.lastMessagePreview.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : threads;

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
              <AlertCircle className="w-4 h-4 mr-1" />
              {totalUnread} unread
            </Badge>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Threads</p>
              <p className="text-2xl font-bold">{threads.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Unread</p>
              <p className="text-2xl font-bold text-red-600">{totalUnread}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Replied Today</p>
              <p className="text-2xl font-bold text-green-600">{repliedToday}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Messages View */}
      <Card className="h-[calc(100vh-350px)] min-h-[500px]">
        <MessagesView
          threads={filteredThreads}
          selectedThread={selectedThread}
          physician={physician}
          onSelectThread={handleSelectThread}
          onSendMessage={handleSendMessage}
          onSearch={setSearchQuery}
          isLoading={isLoading}
        />
      </Card>
    </div>
  );
}
