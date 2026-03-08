import * as React from 'react';
import { redirect } from 'next/navigation';
import { PatientDashboard } from '@/components/patient/PatientDashboard';
import { DashboardData } from '@/types/dashboard';
import { prisma } from '@/lib/db/prisma';
import { SenderType, Role } from '@prisma/client';
import { requireRole } from '@/lib/auth/session-helpers';

async function getDashboardData(userId: string): Promise<DashboardData> {
  const [profile, intake, subscription, prescriptions, messages, unreadCount] = await Promise.all([
    prisma.patientProfile.findUnique({
      where: { userId },
      select: {
        id: true, userId: true, firstName: true, lastName: true,
        primaryConcern: true, treatmentGoal: true, createdAt: true, updatedAt: true,
      },
    }),
    prisma.intake.findFirst({
      where: { patientId: userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, status: true, submittedAt: true, riskScore: true, paymentStatus: true },
    }),
    prisma.subscription.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, status: true, currentPeriodEnd: true, planType: true, amount: true },
    }),
    prisma.prescription.findMany({
      where: { patientId: userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true, medicationName: true, genericName: true, dosage: true,
        quantity: true, refills: true, refillsRemaining: true, status: true,
        nextRefillAvailable: true, pharmacyName: true, sentAt: true,
      },
    }),
    prisma.message.findMany({
      where: { recipientId: userId },
      orderBy: { sentAt: 'desc' },
      take: 3,
      select: { id: true, subject: true, body: true, senderType: true, senderId: true, sentAt: true, readAt: true },
    }),
    prisma.message.count({ where: { recipientId: userId, readAt: null } }),
  ]);

  const dashboardMessages = messages.map(msg => ({
    id: msg.id,
    subject: msg.subject,
    body: msg.body,
    senderType: msg.senderType,
    senderId: msg.senderId,
    senderName: msg.senderType === SenderType.PHYSICIAN ? 'Your Doctor' : 'System',
    sentAt: msg.sentAt,
    read: msg.readAt !== null,
    preview: msg.body.slice(0, 150) + (msg.body.length > 150 ? '...' : ''),
  }));

  return { profile, intake, subscription, prescriptions, messages: dashboardMessages, unreadCount };
}

export default async function PatientDashboardPage() {
  const user = await requireRole([Role.PATIENT]);

  const data = await getDashboardData(user.id);
  if (!data.profile) {
    redirect('/profile/setup');
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PatientDashboard data={data} userId={user.id} />
    </div>
  );
}

export const revalidate = 60;
export const dynamic = 'force-dynamic';
