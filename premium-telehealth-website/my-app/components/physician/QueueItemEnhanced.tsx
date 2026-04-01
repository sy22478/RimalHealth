'use client';

/**
 * Enhanced Queue Item Component
 * Card-based display for patient queue with priority indicators
 * 
 * @module components/physician/QueueItemEnhanced
 */

import * as React from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  Clock,
  FileText,
  Wine,
  Activity,
  TrendingUp,
  Calendar,
  User,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  getPatientInitials,
  formatWaitTime,
  getRiskScoreConfig,
  QueueItem,
} from '@/types/physician-queue';
import { getRiskLevelFromScore, RiskLevel } from '@/types/physician-dashboard';

// ============================================================================
// Types
// ============================================================================

interface QueueItemEnhancedProps {
  /** Queue item data */
  item: QueueItem;
  /** Whether this item is currently loading */
  isLoading?: boolean;
  /** Class name for styling */
  className?: string;
}

/**
 * Concern type — only ALCOHOL is actively used. SMOKING and BOTH remain for backward compatibility.
 */
type ExtendedConcernType = 'ALCOHOL' | 'SMOKING' | 'BOTH';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get priority level from risk score
 */
function getPriorityLevel(riskScore?: number): {
  level: 'HIGH' | 'MEDIUM' | 'LOW';
  label: string;
  variant: 'destructive' | 'default' | 'secondary';
  colorClass: string;
  icon: React.ReactNode;
} {
  if (riskScore === undefined || riskScore === null) {
    return {
      level: 'LOW',
      label: 'Not Assessed',
      variant: 'secondary',
      colorClass: 'bg-success-100 text-success-600 border-success-200',
      icon: <Activity className="size-3" />,
    };
  }

  if (riskScore >= 70) {
    return {
      level: 'HIGH',
      label: 'High Priority',
      variant: 'destructive',
      colorClass: 'bg-red-100 text-red-700 border-red-200',
      icon: <AlertCircle className="size-3" />,
    };
  }

  if (riskScore >= 30) {
    return {
      level: 'MEDIUM',
      label: 'Medium Priority',
      variant: 'secondary',
      colorClass: 'bg-warning-100 text-warning-600 border-warning-200',
      icon: <TrendingUp className="size-3" />,
    };
  }

  return {
    level: 'LOW',
    label: 'Low Priority',
    variant: 'default',
    colorClass: 'bg-success-100 text-success-600 border-success-200',
    icon: <Activity className="size-3" />,
  };
}

/**
 * Get concern type configuration
 */
function getConcernConfig(concernType: string): {
  label: string;
  icon: React.ReactNode;
  colorClass: string;
  bgClass: string;
} {
  const upperType = concernType.toUpperCase();
  
  // SMOKING and BOTH are discontinued; fall through to ALCOHOL default
  // Default to ALCOHOL
  return {
    label: 'Alcohol Treatment',
    icon: <Wine className="size-3.5" />,
    colorClass: 'text-ocean-600',
    bgClass: 'bg-ocean-50 border-ocean-200',
  };
}

/**
 * Calculate age from date of birth string
 */
function calculateAge(dateOfBirth: string | Date): number {
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  
  return age;
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) {
    return 'Just now';
  }
  if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
  }
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  }
  if (diffDays === 1) {
    return 'Yesterday';
  }
  return `${diffDays} days ago`;
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * QueueItemEnhanced Component
 * Enhanced card-based display for queue items with priority indicators
 */
export function QueueItemEnhanced({
  item,
  isLoading = false,
  className,
}: QueueItemEnhancedProps): React.ReactElement {
  const initials = getPatientInitials(item.patientName);
  const priority = getPriorityLevel(item.riskScore);
  const concern = getConcernConfig(item.concernType);
  const riskConfig = getRiskScoreConfig(item.riskScore);
  const waitTimeFormatted = formatWaitTime(item.waitTimeHours);
  const relativeTime = formatRelativeTime(item.submittedAt);
  
  // Calculate complexity score (mock for now - can be extended)
  const complexityScore = Math.min(
    Math.round((item.riskScore || 0) * 0.7 + (item.waitTimeHours > 24 ? 20 : 0)),
    100
  );

  // Card styling based on priority
  const cardStyles = cn(
    'group transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5',
    'border-l-4',
    priority.level === 'HIGH' && 'border-l-red-500 bg-red-50/30',
    priority.level === 'MEDIUM' && 'border-l-warning-500 bg-warning-50/30',
    priority.level === 'LOW' && 'border-l-success-500',
    item.isOverdue && 'border-l-destructive bg-destructive/5',
    isLoading && 'pointer-events-none opacity-60',
    className
  );

  return (
    <Card className={cardStyles}>
      {/* Header: Priority Badge & Wait Time */}
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-start justify-between gap-2">
          {/* Priority Badge */}
          <Badge 
            variant={priority.variant}
            className={cn(
              'gap-1.5 px-2.5 py-1 font-medium',
              priority.colorClass
            )}
          >
            {priority.icon}
            {priority.label}
          </Badge>

          {/* Wait Time */}
          <div className="flex items-center gap-1.5 text-sm">
            {item.isOverdue ? (
              <>
                <AlertCircle className="size-4 text-destructive" />
                <span className="font-medium text-destructive">
                  {waitTimeFormatted}
                </span>
                <Badge variant="destructive" className="text-xs h-5">
                  Overdue
                </Badge>
              </>
            ) : (
              <>
                <Clock className="size-4 text-muted-foreground" />
                <span className="text-muted-foreground">{relativeTime}</span>
              </>
            )}
          </div>
        </div>
      </CardHeader>

      {/* Deactivated Patient Warning */}
      {item.isDeactivated && (
        <div className="mx-4 mt-1 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm text-amber-800">
          This patient&apos;s account has been deactivated.
        </div>
      )}

      {/* Content: Patient Info & Scores */}
      <CardContent className="pb-3 px-4 space-y-4">
        {/* Patient Info */}
        <div className="flex items-center gap-3">
          <Avatar className={cn('size-12 border-2 shadow-sm', item.isDeactivated ? 'border-gray-300' : 'border-background')}>
            <AvatarFallback className={cn('text-sm font-semibold', item.isDeactivated ? 'bg-gray-100 text-gray-400' : 'bg-navy-100 text-navy-700')}>
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className={cn('font-semibold truncate', item.isDeactivated ? 'text-muted-foreground' : 'text-foreground')}>
                {item.patientName}
              </h3>
              {item.isDeactivated && (
                <Badge variant="secondary" className="bg-gray-100 text-gray-600 text-xs shrink-0">
                  Deactivated
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="size-3.5" />
              <span>{item.patientAge} years old</span>
              <span className="text-border">|</span>
              <Calendar className="size-3.5" />
              <span>Submitted {relativeTime}</span>
            </div>
          </div>
        </div>

        {/* Concern Type */}
        <div className="flex items-center gap-2">
          <Badge 
            variant="outline" 
            className={cn(
              'gap-1.5 font-normal',
              concern.bgClass,
              concern.colorClass
            )}
          >
            {concern.icon}
            {concern.label}
          </Badge>
          
          <Badge 
            variant="outline" 
            className={cn('font-normal', riskConfig.colorClass)}
          >
            Risk: {item.riskScore !== undefined ? item.riskScore : 'N/A'}/100
          </Badge>
        </div>

        {/* Complexity Score */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground flex items-center gap-1">
              <TrendingUp className="size-3" />
              Complexity Score
            </span>
            <span className="font-medium text-foreground">{complexityScore}%</span>
          </div>
          <Progress 
            value={complexityScore} 
            className="h-2"
          />
        </div>

        {/* Risk Score Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Risk Assessment</span>
            <span className={cn('font-medium', riskConfig.colorClass.split(' ')[0])}>
              {riskConfig.label}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
            <div
              className={cn(
                'h-full transition-all duration-300',
                item.riskScore === undefined && 'bg-muted-foreground/30',
                item.riskScore !== undefined && item.riskScore < 30 && 'bg-success-500',
                item.riskScore !== undefined && item.riskScore >= 30 && item.riskScore < 70 && 'bg-warning-500',
                item.riskScore !== undefined && item.riskScore >= 70 && 'bg-destructive'
              )}
              style={{ 
                width: `${item.riskScore !== undefined ? Math.min(item.riskScore, 100) : 0}%` 
              }}
            />
          </div>
        </div>
      </CardContent>

      {/* Footer: Action Button */}
      <CardFooter className="pt-2 pb-4 px-4">
        <Button
          asChild
          className="w-full gap-2 group/btn"
          variant={priority.level === 'HIGH' ? 'default' : 'outline'}
        >
          <Link href={`/physician/intake/${item.intakeId}`}>
            <FileText className="size-4" />
            Review Now
            <ArrowRight className="size-4 transition-transform group-hover/btn:translate-x-0.5" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

// ============================================================================
// Skeleton Component
// ============================================================================

/**
 * QueueItemEnhancedSkeleton
 * Loading state for enhanced queue item
 */
export function QueueItemEnhancedSkeleton(): React.ReactElement {
  return (
    <Card className="border-l-4 border-l-muted">
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-start justify-between gap-2">
          <Skeleton className="h-6 w-28 rounded-full" />
          <Skeleton className="h-5 w-20" />
        </div>
      </CardHeader>
      <CardContent className="pb-3 px-4 space-y-4">
        {/* Patient Info Skeleton */}
        <div className="flex items-center gap-3">
          <Skeleton className="size-12 rounded-full" />
          <div className="space-y-1.5 flex-1">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>

        {/* Badges Skeleton */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-28 rounded-full" />
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>

        {/* Progress Bars Skeleton */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-8" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
        </div>
      </CardContent>
      <CardFooter className="pt-2 pb-4 px-4">
        <Skeleton className="h-10 w-full rounded-md" />
      </CardFooter>
    </Card>
  );
}

// ============================================================================
// Export Types
// ============================================================================

export type { QueueItemEnhancedProps, ExtendedConcernType };
