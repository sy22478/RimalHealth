'use client';

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  ClipboardList, 
  Clock, 
  Search, 
  CheckCircle2, 
  Pill, 
  Activity, 
  AlertCircle 
} from 'lucide-react';
import { 
  DashboardStatus, 
  StatusConfig, 
  statusConfig,
  formatDistanceToNow 
} from '@/types/dashboard';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface StatusCardProps {
  status: DashboardStatus;
  intakeSubmittedAt?: Date | null;
  className?: string;
}

// ============================================================================
// Status Icon Component
// ============================================================================

interface StatusIconProps {
  type: StatusConfig['icon'];
  className?: string;
}

function StatusIcon({ type, className }: StatusIconProps) {
  const iconProps = {
    className: cn('h-6 w-6', className),
    'aria-hidden': true,
  };

  switch (type) {
    case 'clipboard':
      return <ClipboardList {...iconProps} />;
    case 'clock':
      return <Clock {...iconProps} />;
    case 'search':
      return <Search {...iconProps} />;
    case 'check':
      return <CheckCircle2 {...iconProps} />;
    case 'pill':
      return <Pill {...iconProps} />;
    case 'activity':
      return <Activity {...iconProps} />;
    case 'alert':
      return <AlertCircle {...iconProps} />;
    default:
      return <Activity {...iconProps} />;
  }
}

// ============================================================================
// Main Component
// ============================================================================

export function StatusCard({ status, intakeSubmittedAt, className }: StatusCardProps) {
  const config = statusConfig[status];
  
  // Get color for icon based on status
  const getIconColor = () => {
    switch (status) {
      case 'intake_incomplete':
        return 'text-amber-600';
      case 'intake_pending_review':
        return 'text-blue-600';
      case 'under_review':
        return 'text-ocean-600';
      case 'approved_awaiting_rx':
        return 'text-green-600';
      case 'rx_sent':
        return 'text-purple-600';
      case 'active_treatment':
        return 'text-success-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <Card className={cn('border-2', config.colorClass, className)}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              'p-2 rounded-lg bg-white/80 backdrop-blur-sm',
              getIconColor()
            )}>
              <StatusIcon type={config.icon} />
            </div>
            <div>
              <CardTitle className="text-lg">{config.title}</CardTitle>
              <Badge 
                variant={config.badgeVariant}
                className="mt-1 capitalize"
              >
                {status.replace(/_/g, ' ')}
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <CardDescription className="text-base text-gray-700">
          {config.description}
        </CardDescription>
        
        {intakeSubmittedAt && (status === 'under_review' || status === 'intake_pending_review') && (
          <p className="text-sm text-muted-foreground mt-3">
            Submitted {formatDistanceToNow(intakeSubmittedAt)}
          </p>
        )}
        
        {status === 'active_treatment' && (
          <p className="text-sm text-success-700 mt-3 flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-success-500 animate-pulse" />
            Your treatment is progressing well
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default StatusCard;
