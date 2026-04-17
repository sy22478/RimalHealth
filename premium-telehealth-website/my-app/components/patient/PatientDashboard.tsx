'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { StatusCard } from './StatusCard';
import { NextSteps } from './NextSteps';
import { QuickActions } from './QuickActions';
import { RecentMessages } from './RecentMessages';
import { PrescriptionCard } from './PrescriptionCard';
import { TreatmentProgress } from './TreatmentProgress';
import {
  DashboardData,
  DashboardStatus,
  getDashboardStatus,
  formatCurrency,
  getProfileCompletionStatus
} from '@/types/dashboard';
import { 
  IntakeStatus, 
  SubscriptionStatus, 
  PrescriptionStatus 
} from '@prisma/client';
import { AlertCircle, CheckCircle2, ChevronDown, ChevronRight, ChevronUp, ShieldCheck, Sparkles, User, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Banner Stack — caps visible banners at 3 with "Show more" for the rest
// ============================================================================

const MAX_VISIBLE_BANNERS = 3;

interface BannerItem {
  key: string;
  element: React.ReactNode;
}

function BannerStack({ banners }: { banners: BannerItem[] }) {
  const [expanded, setExpanded] = React.useState(false);
  if (banners.length === 0) return null;
  const visible = expanded ? banners : banners.slice(0, MAX_VISIBLE_BANNERS);
  const hiddenCount = banners.length - MAX_VISIBLE_BANNERS;
  return (
    <>
      {visible.map((b) => (
        <React.Fragment key={b.key}>{b.element}</React.Fragment>
      ))}
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-ocean-600 hover:text-ocean-700"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-4 w-4" />
              Show fewer notifications
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4" />
              {hiddenCount} more notification{hiddenCount === 1 ? '' : 's'}
            </>
          )}
        </button>
      )}
    </>
  );
}

// ============================================================================
// Profile Completion Prompt Component
// ============================================================================

interface ProfileCompletionPromptProps {
  profile: DashboardData['profile'];
  hasIntakePharmacy?: boolean;
}

function ProfileCompletionPrompt({ profile, hasIntakePharmacy = false }: ProfileCompletionPromptProps) {
  const [dismissed, setDismissed] = React.useState(false);
  const completionStatus = getProfileCompletionStatus(profile, hasIntakePharmacy);

  if (completionStatus.isComplete || dismissed) return null;

  return (
    <Card className="mb-6 border-ocean-200 bg-gradient-to-r from-ocean-50 to-blue-50">
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start gap-3 flex-1">
            <div className="p-2 bg-ocean-100 rounded-lg flex-shrink-0">
              <User className="h-5 w-5 text-ocean-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">Complete Your Profile</h3>
              <p className="text-sm text-gray-600 mt-1">
                Help us serve you better by completing your profile. This ensures your physician has
                the information needed for your care.
              </p>
              {completionStatus.missingFields.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-gray-500 mb-1">Missing information:</p>
                  <div className="flex flex-wrap gap-1">
                    {completionStatus.missingFields.map((field) => (
                      <span
                        key={field}
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-ocean-100 text-ocean-700"
                      >
                        {field}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {/* Progress bar */}
              <div className="mt-3 flex items-center gap-2">
                <div className="flex-1 bg-ocean-100 rounded-full h-2">
                  <div
                    className="bg-ocean-500 h-2 rounded-full transition-all"
                    style={{ width: `${completionStatus.completionPercentage}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500 font-medium">{completionStatus.completionPercentage}%</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/patient/profile">
              <Button className="bg-ocean-600 hover:bg-ocean-700 text-white flex-shrink-0">
                Complete Profile
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="flex-shrink-0 text-gray-400 hover:text-gray-600"
              onClick={() => setDismissed(true)}
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// MFA Setup Prompt Component
// ============================================================================

interface MFASetupPromptProps {
  /** Whether MFA is already enabled */
  mfaEnabled: boolean;
  /** Days since account creation */
  accountAgeDays: number;
}

function MFASetupPrompt({ mfaEnabled, accountAgeDays }: MFASetupPromptProps) {
  const [dismissed, setDismissed] = React.useState(false);

  // Don't show if MFA is already enabled
  if (mfaEnabled) return null;

  // After grace period (7 days), this shouldn't render because the layout gate
  // redirects to /patient/mfa-setup. But if it does render, show a non-dismissible prompt.
  const isGracePeriod = accountAgeDays <= 7;

  // If dismissed during grace period, hide
  if (isGracePeriod && dismissed) return null;

  return (
    <Card className={cn(
      'mb-6',
      isGracePeriod
        ? 'border-ocean-200 bg-gradient-to-r from-ocean-50 to-blue-50'
        : 'border-red-200 bg-gradient-to-r from-red-50 to-orange-50'
    )}>
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start gap-3 flex-1">
            <div className={cn(
              'p-2 rounded-lg flex-shrink-0',
              isGracePeriod ? 'bg-ocean-100' : 'bg-red-100'
            )}>
              <ShieldCheck className={cn(
                'h-5 w-5',
                isGracePeriod ? 'text-ocean-600' : 'text-red-600'
              )} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">
                {isGracePeriod
                  ? 'Set Up Two-Factor Authentication'
                  : 'Two-Factor Authentication Required'}
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {isGracePeriod
                  ? 'Add an extra layer of security to protect your health information. We recommend setting this up now.'
                  : 'For the security of your health information, two-factor authentication is required. Please set it up to continue.'}
              </p>
              {isGracePeriod && (
                <p className="text-xs text-gray-500 mt-2">
                  This will become mandatory in {7 - accountAgeDays} day{7 - accountAgeDays !== 1 ? 's' : ''}.
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/patient/mfa-setup">
              <Button className={cn(
                'flex-shrink-0 text-white',
                isGracePeriod
                  ? 'bg-ocean-600 hover:bg-ocean-700'
                  : 'bg-red-600 hover:bg-red-700'
              )}>
                Set Up MFA
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
            {isGracePeriod && (
              <Button
                variant="ghost"
                size="icon"
                className="flex-shrink-0 text-gray-400 hover:text-gray-600"
                onClick={() => setDismissed(true)}
                aria-label="Dismiss MFA prompt"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Types
// ============================================================================

interface PatientDashboardProps {
  data: DashboardData;
  userId: string;
  /** Whether MFA is enabled for this user */
  mfaEnabled?: boolean;
  /** Days since account creation */
  accountAgeDays?: number;
  /** Whether the patient has pharmacy info from their intake form (even if preferredPharmacyId is not set) */
  hasIntakePharmacy?: boolean;
  /** Whether the patient has uploaded a government-issued ID */
  hasGovernmentId?: boolean;
  className?: string;
}

// ============================================================================
// Welcome Header Component
// ============================================================================

interface WelcomeHeaderProps {
  firstName: string;
  subscriptionStatus: SubscriptionStatus;
}

function WelcomeHeader({ firstName, subscriptionStatus }: WelcomeHeaderProps) {
  const [greeting, setGreeting] = React.useState('Good day');
  
  React.useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 17) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, []);

  return (
    <div className="mb-6">
      <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
        {greeting}, {firstName}
      </h1>
      <p className="text-muted-foreground mt-1">
        Welcome back to your treatment dashboard
      </p>
      {subscriptionStatus === SubscriptionStatus.ACTIVE && (
        <div className="flex items-center gap-2 mt-2">
          <Sparkles className="h-4 w-4 text-success-500" />
          <span className="text-sm text-success-700">
            Your subscription is active
          </span>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Intake CTA Component
// ============================================================================

interface IntakeCTAProps {
  status: DashboardStatus;
}

function IntakeCTA({ status }: IntakeCTAProps) {
  if (status !== 'intake_incomplete') return null;

  return (
    <Card className="mb-6 border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50">
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-100 rounded-lg flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Complete Your Intake Form</h3>
              <p className="text-sm text-gray-600 mt-1">
                We need your medical information to proceed with your treatment. 
                This only takes 5-10 minutes.
              </p>
            </div>
          </div>
          <Link href="/intake">
            <Button 
              className="bg-amber-600 hover:bg-amber-700 text-white flex-shrink-0"
            >
              Complete Intake
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Subscription Alert Component
// ============================================================================

interface SubscriptionAlertProps {
  subscription: DashboardData['subscription'];
}

function SubscriptionAlert({ subscription }: SubscriptionAlertProps) {
  const [daysUntilExpiry, setDaysUntilExpiry] = React.useState<number | null>(null);
  
  React.useEffect(() => {
    if (!subscription) return;
    const days = Math.ceil(
      (new Date(subscription.currentPeriodEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    setDaysUntilExpiry(days);
  }, [subscription]);
  
  if (!subscription || daysUntilExpiry === null || daysUntilExpiry > 7) return null;

  return (
    <Card className={cn(
      'mb-6',
      daysUntilExpiry <= 3 
        ? 'border-red-200 bg-red-50' 
        : 'border-amber-200 bg-amber-50'
    )}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <AlertCircle className={cn(
            'h-5 w-5 flex-shrink-0',
            daysUntilExpiry <= 3 ? 'text-red-600' : 'text-amber-600'
          )} />
          <div>
            <p className={cn(
              'font-medium',
              daysUntilExpiry <= 3 ? 'text-red-900' : 'text-amber-900'
            )}>
              Subscription {daysUntilExpiry <= 0 ? 'expired' : `expires in ${daysUntilExpiry} days`}
            </p>
            <p className="text-sm text-gray-600">
              {daysUntilExpiry <= 0 
                ? 'Please renew to continue your treatment.' 
                : 'Make sure to renew to avoid interruption in your treatment.'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Dashboard Banners (priority-ordered, capped at 3 visible)
// ============================================================================

interface DashboardBannersProps {
  data: DashboardData;
  dashboardStatus: DashboardStatus;
  hasGovernmentId: boolean;
  hasIntakePharmacy: boolean;
  mfaEnabled: boolean;
  accountAgeDays: number;
}

function DashboardBanners({
  data,
  dashboardStatus,
  hasGovernmentId,
  hasIntakePharmacy,
  mfaEnabled,
  accountAgeDays,
}: DashboardBannersProps) {
  const [now] = React.useState(() => Date.now());

  const banners: BannerItem[] = [];

  if (data.subscription?.status === SubscriptionStatus.CANCELLED) {
    banners.push({
      key: 'rejected',
      element: (
        <Card className="mb-6 border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-red-900">
                  Your intake was not approved. No charges were applied.
                </p>
                {data.intake?.review?.rejectionReason && (
                  <p className="text-sm text-red-700 mt-1">
                    <span className="font-medium">Reason:</span> {data.intake.review.rejectionReason}
                  </p>
                )}
                {data.intake?.review?.alternativeRecommendation && (
                  <p className="text-sm text-red-700 mt-1">
                    <span className="font-medium">Recommendation:</span>{' '}
                    {data.intake.review.alternativeRecommendation}
                  </p>
                )}
                <p className="text-sm text-red-600 mt-2">
                  Your account will remain accessible for 30 days. Please check your messages for more details.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ),
    });
  }

  if (data.subscription) {
    const daysUntilExpiry = Math.ceil(
      (new Date(data.subscription.currentPeriodEnd).getTime() - now) / (1000 * 60 * 60 * 24)
    );
    if (daysUntilExpiry <= 7) {
      banners.push({
        key: 'subscription-alert',
        element: <SubscriptionAlert subscription={data.subscription} />,
      });
    }
  }

  if (dashboardStatus === 'intake_incomplete') {
    banners.push({ key: 'intake-cta', element: <IntakeCTA status={dashboardStatus} /> });
  }

  if (!hasGovernmentId) {
    banners.push({
      key: 'gov-id',
      element: (
        <Card className="mb-6 border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-amber-900">
                  Please upload your government-issued ID to complete your profile
                </p>
              </div>
              <Link href="/patient/documents">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-amber-300 text-amber-700 hover:bg-amber-100 flex-shrink-0"
                >
                  Upload ID
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ),
    });
  }

  if (data.intake?.review?.decision === 'APPROVED' && data.intake.review.clinicalNotes) {
    banners.push({
      key: 'physician-note',
      element: (
        <Card className="mb-6 border-green-200 bg-green-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-green-900">Your physician&apos;s note</p>
                <p className="text-sm text-green-700 mt-1">{data.intake.review.clinicalNotes}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ),
    });
  }

  if (
    data.subscription?.status === SubscriptionStatus.TRIALING &&
    data.intake?.status === IntakeStatus.SUBMITTED
  ) {
    banners.push({
      key: 'trialing',
      element: (
        <Card className="mb-6 border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0" />
              <div>
                <p className="font-medium text-blue-900">
                  Intake submitted — awaiting physician review
                </p>
                <p className="text-sm text-blue-700">
                  You will not be charged until your intake is approved.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ),
    });
  }

  const profileCompletion = getProfileCompletionStatus(data.profile, hasIntakePharmacy);
  if (!profileCompletion.isComplete) {
    banners.push({
      key: 'profile',
      element: <ProfileCompletionPrompt profile={data.profile} hasIntakePharmacy={hasIntakePharmacy} />,
    });
  }

  if (!mfaEnabled) {
    banners.push({
      key: 'mfa',
      element: <MFASetupPrompt mfaEnabled={mfaEnabled} accountAgeDays={accountAgeDays} />,
    });
  }

  return <BannerStack banners={banners} />;
}

// ============================================================================
// Main Dashboard Component
// ============================================================================

export function PatientDashboard({ data, userId, mfaEnabled = true, accountAgeDays = 0, hasIntakePharmacy = false, hasGovernmentId = false, className }: PatientDashboardProps) {
  // Determine dashboard status
  const dashboardStatus: DashboardStatus = getDashboardStatus(
    data.intake?.status ?? IntakeStatus.DRAFT,
    data.subscription?.status ?? SubscriptionStatus.EXPIRED,
    data.prescriptions[0]?.status
  );

  // Get first name from profile
  const firstName = data.profile?.firstName ?? 'Patient';

  // Calculate days in treatment (mock calculation based on profile creation)
  const [daysInTreatment, setDaysInTreatment] = React.useState(0);
  React.useEffect(() => {
    if (data.profile) {
      setDaysInTreatment(
        Math.floor((Date.now() - new Date(data.profile.createdAt).getTime()) / (1000 * 60 * 60 * 24))
      );
    }
  }, [data.profile]);

  // Get active prescription
  const activePrescription = data.prescriptions.find(
    p => !([PrescriptionStatus.CANCELLED, PrescriptionStatus.EXPIRED, PrescriptionStatus.COMPLETED, PrescriptionStatus.DENIED] as PrescriptionStatus[]).includes(p.status)
  ) || null;

  return (
    <div className={cn('max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8', className)}>
      {/* Welcome Header */}
      <WelcomeHeader
        firstName={firstName}
        subscriptionStatus={data.subscription?.status ?? SubscriptionStatus.EXPIRED}
      />

      {/* Priority-ordered banner stack (max 3 visible, rest collapsed).
          Priority: rejection > expiring sub > intake CTA > govID > approved note > trialing > profile > MFA. */}
      <DashboardBanners
        data={data}
        dashboardStatus={dashboardStatus}
        hasGovernmentId={hasGovernmentId}
        hasIntakePharmacy={hasIntakePharmacy}
        mfaEnabled={mfaEnabled}
        accountAgeDays={accountAgeDays}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <StatusCard 
          status={dashboardStatus}
          intakeSubmittedAt={data.intake?.submittedAt}
        />
        <NextSteps status={dashboardStatus} />
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <QuickActions />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Takes up 2/3 on large screens */}
        <div className="lg:col-span-2 space-y-6">
          {/* Messages */}
          <RecentMessages messages={data.messages} />
          
          {/* Treatment Progress - Only show if active treatment */}
          {(dashboardStatus === 'active_treatment' || dashboardStatus === 'rx_sent') && (
            <TreatmentProgress 
              profile={data.profile}
              daysInTreatment={daysInTreatment}
            />
          )}
        </div>

        {/* Right Column - Takes up 1/3 on large screens */}
        <div className="space-y-6">
          {/* Prescription Card */}
          <PrescriptionCard prescription={activePrescription as unknown as import('@/types/prescriptions').PrescriptionSummary} onRequestRefill={() => {}} />
          
          {/* Subscription Info */}
          {data.subscription && (
            <Card>
              <CardContent className="p-4">
                <h3 className="font-medium text-gray-900 mb-2">Subscription</h3>
                <p className="text-2xl font-bold text-ocean-600">
                  {formatCurrency(data.subscription.amount)}
                  <span className="text-sm font-normal text-gray-500">/month</span>
                </p>
                {data.subscription.status === SubscriptionStatus.TRIALING ? (
                  <p className="text-sm text-blue-600 mt-1">
                    Charged upon physician approval
                  </p>
                ) : data.subscription.status === SubscriptionStatus.CANCELLED ? (
                  <p className="text-sm text-red-600 mt-1">
                    No charges applied
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground mt-1">
                    Renews {new Date(data.subscription.currentPeriodEnd).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric'
                    })}
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default PatientDashboard;
