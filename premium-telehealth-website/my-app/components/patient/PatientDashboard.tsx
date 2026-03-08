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
  formatCurrency
} from '@/types/dashboard';
import { 
  IntakeStatus, 
  SubscriptionStatus, 
  PrescriptionStatus 
} from '@prisma/client';
import { AlertCircle, ChevronRight, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface PatientDashboardProps {
  data: DashboardData;
  userId: string;
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
// Main Dashboard Component
// ============================================================================

export function PatientDashboard({ data, userId, className }: PatientDashboardProps) {
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
    p => p.status !== PrescriptionStatus.CANCELLED && p.status !== PrescriptionStatus.EXPIRED
  ) || null;

  return (
    <div className={cn('max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8', className)}>
      {/* Welcome Header */}
      <WelcomeHeader 
        firstName={firstName} 
        subscriptionStatus={data.subscription?.status ?? SubscriptionStatus.EXPIRED}
      />

      {/* Intake CTA - Only show if intake incomplete */}
      <IntakeCTA status={dashboardStatus} />

      {/* Subscription Alert - Show if expiring soon */}
      {data.subscription && (
        <SubscriptionAlert subscription={data.subscription} />
      )}

      {/* Status & Next Steps Row */}
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
                <p className="text-sm text-muted-foreground mt-1">
                  Renews {new Date(data.subscription.currentPeriodEnd).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric'
                  })}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default PatientDashboard;
