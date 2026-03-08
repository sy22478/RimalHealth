'use client';

/**
 * Queue Item Component
 * Individual row for patient queue table
 * 
 * @module components/physician/QueueItem
 */

import * as React from 'react';
import Link from 'next/link';
import { AlertCircle, Clock, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Avatar,
  AvatarFallback,
} from '@/components/ui/avatar';
import {
  QueueItem as QueueItemType,
  getPatientInitials,
  formatWaitTime,
  getRiskScoreConfig,
  CONCERN_TYPE_LABELS,
  QUEUE_STATUS_LABELS,
} from '@/types/physician-queue';

interface QueueItemProps {
  /** Queue item data */
  item: QueueItemType;
  /** Whether this item is currently loading */
  isLoading?: boolean;
  /** Class name for styling */
  className?: string;
}

/**
 * QueueItem Component
 * Displays a single patient intake in the queue
 */
export function QueueItem({
  item,
  isLoading = false,
  className,
}: QueueItemProps): React.ReactElement {
  const riskConfig = getRiskScoreConfig(item.riskScore);
  const initials = getPatientInitials(item.patientName);

  // Determine row styling based on overdue status
  const rowClassName = cn(
    'group transition-colors hover:bg-muted/50',
    item.isOverdue && 'bg-destructive/5 hover:bg-destructive/10',
    isLoading && 'pointer-events-none opacity-60',
    className
  );

  return (
    <tr className={rowClassName}>
      {/* Patient Info */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar size="sm">
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-foreground">{item.patientName}</p>
            <p className="text-sm text-muted-foreground">{item.patientAge} years</p>
          </div>
        </div>
      </td>

      {/* Concern Type */}
      <td className="px-4 py-3">
        <Badge variant="outline" className="font-normal">
          {CONCERN_TYPE_LABELS[item.concernType]}
        </Badge>
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <StatusBadge status={item.status} />
      </td>

      {/* Wait Time */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {item.isOverdue ? (
            <>
              <AlertCircle className="size-4 text-destructive" aria-hidden="true" />
              <span className="font-medium text-destructive">
                {formatWaitTime(item.waitTimeHours)}
              </span>
              <Badge variant="destructive" className="text-xs">
                Overdue
              </Badge>
            </>
          ) : (
            <>
              <Clock className="size-4 text-muted-foreground" aria-hidden="true" />
              <span className="text-muted-foreground">
                {formatWaitTime(item.waitTimeHours)}
              </span>
            </>
          )}
        </div>
      </td>

      {/* Risk Score */}
      <td className="px-4 py-3">
        <RiskBadge score={item.riskScore} />
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            asChild
            className="gap-1"
          >
            <Link href={`/physician/intake/${item.intakeId}`}>
              <FileText className="size-4" />
              Review
            </Link>
          </Button>
        </div>
      </td>
    </tr>
  );
}

/**
 * Status Badge Component
 * Displays the intake status
 */
interface StatusBadgeProps {
  status: QueueItemType['status'];
}

function StatusBadge({ status }: StatusBadgeProps): React.ReactElement {
  const config = {
    SUBMITTED: {
      variant: 'default' as const,
      className: 'bg-primary/10 text-primary border-primary/20',
    },
    UNDER_REVIEW: {
      variant: 'secondary' as const,
      className: 'bg-ocean-100 text-ocean-700 border-ocean-200',
    },
  };

  const { variant, className } = config[status];

  return (
    <Badge variant={variant} className={cn('font-normal', className)}>
      {QUEUE_STATUS_LABELS[status]}
    </Badge>
  );
}

/**
 * Risk Badge Component
 * Displays the risk score with appropriate styling
 */
interface RiskBadgeProps {
  score?: number;
}

function RiskBadge({ score }: RiskBadgeProps): React.ReactElement {
  const config = getRiskScoreConfig(score);

  return (
    <Badge
      variant={config.variant}
      className={cn('font-normal', config.colorClass)}
    >
      {score !== undefined ? `${score} - ${config.label}` : config.label}
    </Badge>
  );
}

/**
 * Queue Item Skeleton
 * Loading state for queue item
 */
export function QueueItemSkeleton(): React.ReactElement {
  return (
    <tr className="animate-pulse">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-full bg-muted" />
          <div className="space-y-1">
            <div className="h-4 w-32 rounded bg-muted" />
            <div className="h-3 w-20 rounded bg-muted" />
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="h-6 w-24 rounded bg-muted" />
      </td>
      <td className="px-4 py-3">
        <div className="h-6 w-28 rounded bg-muted" />
      </td>
      <td className="px-4 py-3">
        <div className="h-6 w-20 rounded bg-muted" />
      </td>
      <td className="px-4 py-3">
        <div className="h-6 w-24 rounded bg-muted" />
      </td>
      <td className="px-4 py-3">
        <div className="ml-auto h-8 w-20 rounded bg-muted" />
      </td>
    </tr>
  );
}
