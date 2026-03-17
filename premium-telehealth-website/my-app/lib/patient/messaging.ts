/**
 * Patient Messaging Logic
 * 
 * Core business logic for patient messaging functionality.
 * Handles thread retrieval, message sending, and read status management.
 * 
 * HIPAA Compliance:
 * - All PHI access is logged
 * - Messages encrypted at rest
 * - Access controls enforced at service layer
 * - Patients can only access their own messages
 * 
 * @module lib/patient/messaging
 */

import { SenderType, MessageStatus } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';

// ============================================
// Types
// ============================================

/**
 * Message thread summary for patient inbox
 */
export interface PatientMessageThread {
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

/**
 * Individual message
 */
export interface PatientMessage {
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
 * Thread detail with all messages
 */
export interface PatientThreadDetail {
  id: string;
  physicianId: string;
  physicianName: string;
  messages: PatientMessage[];
  unreadCount: number;
}

/**
 * Send message input
 */
export interface SendPatientMessageInput {
  threadId: string;
  patientId: string;
  recipientId: string;
  body: string;
  subject?: string;
  patientName: string;
}

// ============================================
// Thread Operations
// ============================================

/**
 * Get messaging threads for a patient
 * 
 * Returns the thread with the assigned physician,
 * including message history and unread counts.
 * 
 * @param patientId - The patient's user ID
 * @returns Array of message threads (typically just one)
 */
export async function getPatientMessagingThreads(
  patientId: string
): Promise<PatientMessageThread[]> {
  // Find the physician who has communicated with this patient
  // In a multi-physician system, this would get the assigned physician
  const existingMessage = await prisma.message.findFirst({
    where: {
      OR: [
        { senderId: patientId },
        { recipientId: patientId },
      ],
    },
    orderBy: { sentAt: 'desc' },
  });

  // Determine physician ID from existing messages
  let physicianId: string | null = null;
  
  if (existingMessage) {
    physicianId = existingMessage.senderId === patientId 
      ? existingMessage.recipientId 
      : existingMessage.senderId;
  } else {
    // No existing messages yet - get the first available physician
    // In production, this would be the assigned physician
    const firstPhysician = await prisma.physician.findFirst({
      select: { userId: true },
    });
    physicianId = firstPhysician?.userId ?? null;
  }

  // If still no physician found, return empty (no messaging available yet)
  if (!physicianId) {
    return [];
  }

  const threadId = `thread-${patientId}-${physicianId}`;

  // Get physician details
  const physician = await prisma.physician.findUnique({
    where: { userId: physicianId },
    select: {
      firstName: true,
      lastName: true,
    },
  });

  if (!physician) {
    return [];
  }

  // Get latest message in thread
  const latestMessage = await prisma.message.findFirst({
    where: { threadId },
    orderBy: { sentAt: 'desc' },
  });

  // If no messages exist yet, return thread with welcome state
  if (!latestMessage) {
    return [{
      id: threadId,
      physicianId,
      physicianName: `Dr. ${physician.lastName}`,
      lastMessage: {
        body: 'Send a message to start the conversation',
        sentAt: new Date().toISOString(),
        senderType: 'PATIENT' as const,
      },
      unreadCount: 0,
      totalMessages: 0,
    }];
  }

  // Count unread messages for patient
  const unreadCount = await prisma.message.count({
    where: {
      threadId,
      recipientId: patientId,
      readAt: null,
    },
  });

  // Count total messages
  const totalMessages = await prisma.message.count({
    where: { threadId },
  });

  return [{
    id: threadId,
    physicianId,
    physicianName: `Dr. ${physician.lastName}`,
    lastMessage: {
      body: latestMessage.body,
      sentAt: latestMessage.sentAt.toISOString(),
      senderType: latestMessage.senderType === 'PHYSICIAN' ? 'PHYSICIAN' : 'PATIENT',
    },
    unreadCount,
    totalMessages,
  }];
}

/**
 * Get all messages in a thread for a patient
 * 
 * @param threadId - The thread ID
 * @param patientId - The patient's user ID (for access verification)
 * @returns Thread detail with all messages, or null if not found/no access
 */
export async function getPatientThreadMessages(
  threadId: string,
  patientId: string
): Promise<PatientThreadDetail | null> {
  // Verify thread belongs to this patient
  if (!threadId.includes(patientId)) {
    return null;
  }

  // Get all messages in thread
  const messages = await prisma.message.findMany({
    where: { threadId },
    orderBy: { sentAt: 'asc' },
  });

  // Get physician ID from thread ID (format: thread-{patientUUID}-{physicianUUID})
  // Can't use split('-') since UUIDs contain hyphens — strip the known prefix instead
  const physicianId = threadId.replace(`thread-${patientId}-`, '');

  if (!physicianId || physicianId === threadId) {
    return null;
  }

  // Get physician details
  const physician = await prisma.physician.findUnique({
    where: { userId: physicianId },
    select: {
      firstName: true,
      lastName: true,
    },
  });

  if (!physician) {
    return null;
  }

  // Count unread messages
  const unreadCount = messages.filter(
    m => m.recipientId === patientId && !m.readAt
  ).length;

  // Get patient details for their messages
  const patientProfile = await prisma.patientProfile.findUnique({
    where: { userId: patientId },
    select: {
      firstName: true,
      lastName: true,
    },
  });

  const patientName = patientProfile 
    ? `${patientProfile.firstName} ${patientProfile.lastName}`
    : 'You';

  // Transform messages
  const transformedMessages: PatientMessage[] = messages.map((msg) => {
    let senderName: string;

    if (msg.senderType === 'PHYSICIAN') {
      senderName = `Dr. ${physician.lastName}`;
    } else if (msg.senderType === 'PATIENT') {
      senderName = patientName;
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
      senderName,
      recipientId: msg.recipientId,
      sentAt: msg.sentAt.toISOString(),
      readAt: msg.readAt?.toISOString() ?? undefined,
    };
  });

  return {
    id: threadId,
    physicianId,
    physicianName: `Dr. ${physician.lastName}`,
    messages: transformedMessages,
    unreadCount,
  };
}

// ============================================
// Message Operations
// ============================================

/**
 * Send a message from a patient to their physician
 * 
 * @param input - Message details
 * @returns The created message
 */
export async function sendMessageToPhysician(
  input: SendPatientMessageInput
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
      senderType: 'PATIENT',
      senderId: input.patientId,
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
 * Mark all messages in a thread as read for a patient
 * 
 * @param threadId - The thread ID
 * @param patientId - The patient's user ID
 * @returns Number of messages marked as read
 */
export async function markThreadAsReadForPatient(
  threadId: string,
  patientId: string
): Promise<number> {
  const result = await prisma.message.updateMany({
    where: {
      threadId,
      recipientId: patientId,
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
 * Get unread message count for a patient
 * 
 * @param patientId - The patient's user ID
 * @returns Total unread message count
 */
export async function getPatientUnreadMessageCount(
  patientId: string
): Promise<number> {
  return prisma.message.count({
    where: {
      recipientId: patientId,
      readAt: null,
      senderType: 'PHYSICIAN',
    },
  });
}

/**
 * Create a new message thread for a patient
 * 
 * This is typically called when a patient is first assigned to a physician
 * 
 * @param patientId - The patient's user ID
 * @param physicianId - The physician's user ID
 * @returns The new thread ID
 */
export async function createPatientMessageThread(
  patientId: string,
  physicianId: string
): Promise<string> {
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
      body: 'Welcome to secure messaging with your physician. You can send messages and expect a reply within 24 hours.',
      senderType: 'SYSTEM',
      senderId: 'system',
      recipientId: patientId,
      status: 'READ',
      readAt: new Date(),
    },
  });

  return threadId;
}

/**
 * Verify patient has access to a thread
 * 
 * @param threadId - The thread ID
 * @param patientId - The patient's user ID
 * @returns Whether the patient has access
 */
export async function verifyThreadAccess(
  threadId: string,
  patientId: string
): Promise<boolean> {
  // Thread ID format: thread-{patientId}-{physicianId}
  return threadId.includes(patientId);
}
