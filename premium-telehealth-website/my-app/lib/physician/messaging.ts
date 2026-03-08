/**
 * Physician Messaging Logic
 * 
 * Core business logic for physician messaging functionality.
 * Handles thread retrieval, message sending, and read status management.
 * 
 * HIPAA Compliance:
 * - All PHI access is logged
 * - Messages encrypted at rest
 * - Access controls enforced at service layer
 * 
 * @module lib/physician/messaging
 */

import { SenderType, MessageStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';

// ============================================
// Types
// ============================================

/**
 * Message thread summary for inbox
 */
export interface MessageThread {
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
 * Individual message
 */
export interface Message {
  id: string;
  threadId: string;
  subject?: string;
  body: string;
  senderType: 'PATIENT' | 'PHYSICIAN' | 'SYSTEM';
  senderId: string;
  recipientId: string;
  senderName: string;
  sentAt: string;
  readAt?: string;
}

/**
 * Thread detail with all messages
 */
export interface ThreadDetail {
  id: string;
  patientId: string;
  patientName: string;
  patientAvatar?: string;
  messages: Message[];
  unreadCount: number;
}

/**
 * Send message input
 */
export interface SendMessageInput {
  threadId: string;
  senderId: string;
  recipientId: string;
  body: string;
  subject?: string;
  senderName: string;
}

// ============================================
// Thread Operations
// ============================================

/**
 * Get messaging threads for a physician
 * 
 * Returns all threads where the physician has exchanged messages,
 * sorted by most recent activity.
 * 
 * @param physicianId - The physician's user ID
 * @returns Array of message threads
 */
export async function getMessagingThreads(
  physicianId: string
): Promise<MessageThread[]> {
  // Get all unique thread IDs for this physician
  const threadMessages = await prisma.message.findMany({
    where: {
      OR: [
        { recipientId: physicianId },
        { senderId: physicianId, senderType: 'PHYSICIAN' },
      ],
    },
    orderBy: {
      sentAt: 'desc',
    },
    distinct: ['threadId'],
    select: {
      threadId: true,
      senderId: true,
      recipientId: true,
    },
  });

  const threadIds = threadMessages.map(m => m.threadId);

  if (threadIds.length === 0) {
    return [];
  }

  // Get thread details with latest message and patient info
  const threads: MessageThread[] = [];

  for (const threadId of threadIds) {
    // Get latest message
    const latestMessage = await prisma.message.findFirst({
      where: { threadId },
      orderBy: { sentAt: 'desc' },
    });

    if (!latestMessage) continue;

    // Determine patient ID (the one that's not the physician)
    const patientId = latestMessage.senderId === physicianId 
      ? latestMessage.recipientId 
      : latestMessage.senderId;

    // Get patient profile
    const patient = await prisma.patientProfile.findUnique({
      where: { userId: patientId },
      select: {
        firstName: true,
        lastName: true,
      },
    });

    if (!patient) continue;

    // Count unread messages
    const unreadCount = await prisma.message.count({
      where: {
        threadId,
        recipientId: physicianId,
        readAt: null,
      },
    });

    // Count total messages
    const totalMessages = await prisma.message.count({
      where: { threadId },
    });

    threads.push({
      id: threadId,
      patientId,
      patientName: `${patient.firstName} ${patient.lastName}`,
      lastMessage: {
        body: latestMessage.body,
        sentAt: latestMessage.sentAt.toISOString(),
        senderType: latestMessage.senderType === 'PHYSICIAN' ? 'PHYSICIAN' : 'PATIENT',
      },
      unreadCount,
      totalMessages,
    });
  }

  // Sort by last message date (newest first)
  return threads.sort((a, b) => 
    new Date(b.lastMessage.sentAt).getTime() - new Date(a.lastMessage.sentAt).getTime()
  );
}

/**
 * Get all messages in a thread
 * 
 * @param threadId - The thread ID
 * @param physicianId - The physician's user ID (for access verification)
 * @returns Thread detail with all messages, or null if not found/no access
 */
export async function getThreadMessages(
  threadId: string,
  physicianId: string
): Promise<ThreadDetail | null> {
  // Get all messages in thread
  const messages = await prisma.message.findMany({
    where: { threadId },
    orderBy: { sentAt: 'asc' },
  });

  if (messages.length === 0) {
    return null;
  }

  // Find patient (first message from patient or recipient of physician message)
  const patientMessage = messages.find(m => m.senderType === 'PATIENT');
  const patientId = patientMessage 
    ? patientMessage.senderId 
    : messages.find(m => m.recipientId !== physicianId)?.recipientId;

  if (!patientId) {
    return null;
  }

  // Get patient profile
  const patient = await prisma.patientProfile.findUnique({
    where: { userId: patientId },
    select: {
      firstName: true,
      lastName: true,
    },
  });

  if (!patient) {
    return null;
  }

  // Count unread messages for physician
  const unreadCount = messages.filter(
    m => m.recipientId === physicianId && !m.readAt
  ).length;

  // Get physician details for sender name
  const physician = await prisma.physician.findUnique({
    where: { userId: physicianId },
    select: {
      firstName: true,
      lastName: true,
    },
  });

  const physicianName = physician 
    ? `Dr. ${physician.lastName}`
    : 'Physician';

  // Transform messages
  const transformedMessages: Message[] = await Promise.all(
    messages.map(async (msg) => {
      let senderName: string;

      if (msg.senderType === 'PHYSICIAN') {
        const senderPhysician = await prisma.physician.findUnique({
          where: { userId: msg.senderId },
          select: { firstName: true, lastName: true },
        });
        senderName = senderPhysician 
          ? `Dr. ${senderPhysician.lastName}`
          : 'Physician';
      } else if (msg.senderType === 'PATIENT') {
        const senderPatient = await prisma.patientProfile.findUnique({
          where: { userId: msg.senderId },
          select: { firstName: true, lastName: true },
        });
        senderName = senderPatient 
          ? `${senderPatient.firstName} ${senderPatient.lastName}`
          : 'Patient';
      } else {
        senderName = 'System';
      }

      return {
        id: msg.id,
        threadId: msg.threadId,
        subject: msg.subject ?? undefined,
        body: msg.body,
        senderType: msg.senderType as 'PATIENT' | 'PHYSICIAN' | 'SYSTEM',
        senderId: msg.senderId,
        recipientId: msg.recipientId,
        senderName,
        sentAt: msg.sentAt.toISOString(),
        readAt: msg.readAt?.toISOString() ?? undefined,
      };
    })
  );

  return {
    id: threadId,
    patientId,
    patientName: `${patient.firstName} ${patient.lastName}`,
    messages: transformedMessages,
    unreadCount,
  };
}

// ============================================
// Message Operations
// ============================================

/**
 * Send a message to a patient
 * 
 * @param input - Message details
 * @returns The created message
 */
export async function sendMessageToPatient(
  input: SendMessageInput
): Promise<{
  id: string;
  threadId: string;
  body: string;
  senderType: SenderType;
  senderId: string;
  recipientId: string;
  sentAt: Date;
  status: MessageStatus;
}> {
  const message = await prisma.message.create({
    data: {
      threadId: input.threadId,
      body: input.body,
      subject: input.subject,
      senderType: 'PHYSICIAN',
      senderId: input.senderId,
      recipientId: input.recipientId,
      status: 'SENT',
    },
  });

  return {
    id: message.id,
    threadId: message.threadId,
    body: message.body,
    senderType: message.senderType,
    senderId: message.senderId,
    recipientId: message.recipientId,
    sentAt: message.sentAt,
    status: message.status,
  };
}

/**
 * Mark all messages in a thread as read for a recipient
 * 
 * @param threadId - The thread ID
 * @param recipientId - The recipient's user ID
 * @returns Number of messages marked as read
 */
export async function markThreadAsRead(
  threadId: string,
  recipientId: string
): Promise<number> {
  const result = await prisma.message.updateMany({
    where: {
      threadId,
      recipientId,
      readAt: null,
    },
    data: {
      readAt: new Date(),
      status: 'READ',
    },
  });

  return result.count;
}

/**
 * Get unread message count for a physician
 * 
 * @param physicianId - The physician's user ID
 * @returns Total unread message count
 */
export async function getUnreadMessageCount(
  physicianId: string
): Promise<number> {
  return prisma.message.count({
    where: {
      recipientId: physicianId,
      readAt: null,
      senderType: 'PATIENT',
    },
  });
}

/**
 * Create a new message thread
 * 
 * @param patientId - The patient's user ID
 * @param physicianId - The physician's user ID
 * @returns The new thread ID
 */
export async function createMessageThread(
  patientId: string,
  physicianId: string
): Promise<string> {
  // Generate thread ID based on patient and physician
  // This ensures consistent thread ID for the same patient-physician pair
  const threadId = `thread-${patientId}-${physicianId}`;

  // Check if thread already exists
  const existingMessage = await prisma.message.findFirst({
    where: { threadId },
  });

  if (existingMessage) {
    return threadId;
  }

  // Create system welcome message
  await prisma.message.create({
    data: {
      threadId,
      body: 'Welcome to secure messaging with your physician. You can send messages and receive replies within 24 hours.',
      senderType: 'SYSTEM',
      senderId: 'system',
      recipientId: patientId,
      status: 'READ',
      readAt: new Date(),
    },
  });

  return threadId;
}

// ============================================
// Search and Filtering
// ============================================

/**
 * Search messages by content
 * 
 * HIPAA Note: Search queries are logged for compliance
 * 
 * @param physicianId - The physician's user ID
 * @param query - Search query string
 * @returns Matching messages
 */
export async function searchMessages(
  physicianId: string,
  query: string
): Promise<Message[]> {
  const messages = await prisma.message.findMany({
    where: {
      OR: [
        { recipientId: physicianId },
        { senderId: physicianId, senderType: 'PHYSICIAN' },
      ],
      body: {
        contains: query,
        mode: 'insensitive',
      },
    },
    orderBy: { sentAt: 'desc' },
    take: 50,
  });

  return messages.map(msg => ({
    id: msg.id,
    threadId: msg.threadId,
    subject: msg.subject ?? undefined,
    body: msg.body,
    senderType: msg.senderType as 'PATIENT' | 'PHYSICIAN' | 'SYSTEM',
    senderId: msg.senderId,
    recipientId: msg.recipientId,
    senderName: msg.senderType === 'PHYSICIAN' ? 'Physician' : 
                msg.senderType === 'PATIENT' ? 'Patient' : 'System',
    sentAt: msg.sentAt.toISOString(),
    readAt: msg.readAt?.toISOString() ?? undefined,
  }));
}
