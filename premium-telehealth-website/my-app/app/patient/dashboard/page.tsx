import * as React from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PatientDashboard } from "@/components/patient/PatientDashboard";
import { DashboardData } from "@/types/dashboard";
import { prisma } from "@/lib/db/prisma";
import { IntakeStatus, SenderType, Role } from "@prisma/client";
import { requireRole } from "@/lib/auth/session-helpers";

export const metadata: Metadata = {
  title: "Dashboard",
};

interface UserMFAInfo {
  mfaEnabled: boolean;
  accountAgeDays: number;
}

async function getDashboardData(userId: string): Promise<DashboardData & { hasGovernmentId: boolean; hasIntakePharmacy: boolean }> {
  const results = await Promise.allSettled([
    prisma.patientProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        userId: true,
        firstName: true,
        lastName: true,
        primaryConcern: true,
        treatmentGoal: true,
        createdAt: true,
        updatedAt: true,
        phone: true,
        addressStreet: true,
        addressCity: true,
        addressState: true,
        addressZip: true,
        preferredPharmacyId: true,
      },
    }),
    prisma.intake.findFirst({
      where: { patientId: userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        submittedAt: true,
        riskScore: true,
        paymentStatus: true,
        formData: true,
        review: {
          select: {
            decision: true,
            clinicalNotes: true,
            rejectionReason: true,
            alternativeRecommendation: true,
            completedAt: true,
          },
        },
      },
    }),
    prisma.subscription.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        currentPeriodEnd: true,
        planType: true,
        amount: true,
      },
    }),
    prisma.prescription.findMany({
      where: { patientId: userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        medicationName: true,
        genericName: true,
        dosage: true,
        quantity: true,
        refills: true,
        refillsRemaining: true,
        status: true,
        nextRefillAvailable: true,
        pharmacyName: true,
        sentAt: true,
      },
    }),
    prisma.message.findMany({
      where: { recipientId: userId },
      orderBy: { sentAt: "desc" },
      take: 3,
      select: {
        id: true,
        subject: true,
        body: true,
        senderType: true,
        senderId: true,
        sentAt: true,
        readAt: true,
      },
    }),
    prisma.message.count({ where: { recipientId: userId, readAt: null } }),
    prisma.document.findFirst({
      where: {
        patientId: userId,
        documentType: 'ID_VERIFICATION',
        status: { not: 'DELETED' },
      },
      select: { id: true },
    }),
  ]);

  // Extract each result with graceful fallback for failures
  const profile =
    results[0].status === "fulfilled" ? results[0].value : null;
  const intake =
    results[1].status === "fulfilled" ? results[1].value : null;
  const subscription =
    results[2].status === "fulfilled" ? results[2].value : null;
  const prescriptions =
    results[3].status === "fulfilled" ? results[3].value : [];
  const messages =
    results[4].status === "fulfilled" ? results[4].value : [];
  const unreadCount =
    results[5].status === "fulfilled" ? results[5].value : 0;
  const hasGovernmentId =
    results[6].status === "fulfilled" ? results[6].value !== null : false;

  // Log any failed queries for debugging (no PHI in error messages)
  const queryNames = [
    "profile",
    "intake",
    "subscription",
    "prescriptions",
    "messages",
    "unreadCount",
    "governmentId",
  ];
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error(
        `[Dashboard] Failed to fetch ${queryNames[index]}:`,
        result.reason instanceof Error
          ? result.reason.message
          : "Unknown error"
      );
    }
  });

  const dashboardMessages = messages.map((msg) => {
    const body = msg.body ?? '';
    return {
      id: msg.id,
      subject: msg.subject,
      body,
      senderType: msg.senderType,
      senderId: msg.senderId,
      senderName:
        msg.senderType === SenderType.PHYSICIAN ? "Your Doctor" : "System",
      sentAt: msg.sentAt,
      read: msg.readAt !== null,
      preview:
        body.slice(0, 150) + (body.length > 150 ? "..." : ""),
    };
  });

  // Check if the patient has pharmacy info from their intake formData.
  // Some patients entered pharmacy during intake but never set preferredPharmacyId on PatientProfile.
  let hasIntakePharmacy = false;
  if (intake?.formData && typeof intake.formData === 'object') {
    const fd = intake.formData as Record<string, unknown>;
    if (fd.pharmacyName && typeof fd.pharmacyName === 'string' && fd.pharmacyName.length > 0) {
      hasIntakePharmacy = true;
    }
  }

  // Strip formData from intake before returning (not needed by dashboard UI, and may contain PHI)
  const intakeForDashboard = intake ? {
    id: intake.id,
    status: intake.status,
    submittedAt: intake.submittedAt,
    riskScore: intake.riskScore,
    paymentStatus: intake.paymentStatus,
    review: intake.review ? {
      decision: intake.review.decision,
      clinicalNotes: intake.review.clinicalNotes,
      rejectionReason: intake.review.rejectionReason,
      alternativeRecommendation: intake.review.alternativeRecommendation,
      completedAt: intake.review.completedAt,
    } : null,
  } : null;

  return {
    profile,
    intake: intakeForDashboard,
    subscription,
    prescriptions,
    messages: dashboardMessages,
    unreadCount,
    hasGovernmentId,
    hasIntakePharmacy,
  };
}

async function getUserMFAInfo(userId: string): Promise<UserMFAInfo> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { mfaEnabled: true, createdAt: true },
  });

  if (!user) {
    return { mfaEnabled: false, accountAgeDays: 0 };
  }

  const accountAgeDays = Math.floor(
    (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24)
  );

  return { mfaEnabled: user.mfaEnabled, accountAgeDays };
}

export default async function PatientDashboardPage() {
  const user = await requireRole([Role.PATIENT]);

  const [data, mfaInfo] = await Promise.all([
    getDashboardData(user.id),
    getUserMFAInfo(user.id),
  ]);

  if (!data.profile) {
    redirect("/intake");
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PatientDashboard
        data={data}
        userId={user.id}
        mfaEnabled={mfaInfo.mfaEnabled}
        accountAgeDays={mfaInfo.accountAgeDays}
        hasIntakePharmacy={data.hasIntakePharmacy}
        hasGovernmentId={data.hasGovernmentId}
      />
    </div>
  );
}

export const dynamic = "force-dynamic";
