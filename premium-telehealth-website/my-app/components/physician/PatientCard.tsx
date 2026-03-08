/**
 * PatientCard Component
 * 
 * Card component displaying patient information with status indicators
 * and quick actions for the physician portal.
 * 
 * @module components/physician/PatientCard
 */

'use client';

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import {
  Mail,
  Pill,
  FileText,
  ChevronRight,
  Calendar,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { PhysicianPatientListItem, TREATMENT_TYPE_LABELS } from '@/types/physician-dashboard';
import { PatientStatusBadge, RiskBadge } from '@/components/shared/StatusBadge';

// ============================================================================
// Props Interface
// ============================================================================

interface PatientCardProps {
  /** Patient data to display */
  patient: PhysicianPatientListItem;
  /** Click handler for the card */
  onClick: () => void;
  /** Additional CSS classes */
  className?: string;
  /** Whether to show quick actions */
  showActions?: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get initials from patient name
 */
function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Format date relative to now
 */
function formatRelativeDate(date: Date | undefined): string {
  if (!date) return 'Never';
  const now = new Date();
  const diffInDays = Math.floor((now.getTime() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffInDays === 0) return 'Today';
  if (diffInDays === 1) return 'Yesterday';
  if (diffInDays < 7) return `${diffInDays} days ago`;
  if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ============================================================================
// Component
// ============================================================================

/**
 * PatientCard displays patient information in a card format
 * 
 * @example
 * ```tsx
 * <PatientCard
 *   patient={patient}
 *   onClick={() => router.push(`/physician/patients/${patient.id}`)}
 *   showActions
 * />
 * ```
 */
export function PatientCard({
  patient,
  onClick,
  className,
  showActions = true,
}: PatientCardProps) {
  const hasUnreadMessages = patient.unreadMessages > 0;
  const hasActivePrescriptions = patient.activePrescriptions > 0;
  const isHighRisk = patient.riskLevel === 'HIGH' || patient.riskLevel === 'SEVERE';

  return (
    <Card
      className={cn(
        'group cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5',
        isHighRisk && 'border-l-4 border-l-red-500',
        className
      )}
      onClick={onClick}
    >
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarFallback
                className={cn(
                  'text-sm font-semibold',
                  isHighRisk
                    ? 'bg-red-100 text-red-700'
                    : 'bg-ocean-100 text-ocean-700'
                )}
              >
                {getInitials(patient.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold text-foreground group-hover:text-ocean-600 transition-colors">
                {patient.name}
              </h3>
              <p className="text-sm text-muted-foreground">
                {patient.age} years • {patient.gender || 'Unknown'}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <PatientStatusBadge status={patient.status} size="sm" />
            {isHighRisk && (
              <Badge variant="destructive" className="text-[10px]">
                <AlertCircle className="w-3 h-3 mr-1" />
                High Risk
              </Badge>
            )}
          </div>
        </div>

        {/* Treatment Info */}
        <div className="flex items-center gap-2 mb-4">
          <Badge variant="outline" className="text-xs">
            {TREATMENT_TYPE_LABELS[patient.treatmentType]}
          </Badge>
          <RiskBadge level={patient.riskLevel} size="sm" />
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="w-4 h-4" />
            <span>Enrolled {formatRelativeDate(patient.enrolledAt)}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>Last visit {formatRelativeDate(patient.lastVisitAt)}</span>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="flex items-center gap-4 pt-4 border-t">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'p-1.5 rounded',
                hasUnreadMessages ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-500'
              )}
            >
              <Mail className="w-4 h-4" />
            </div>
            <span className={cn('text-sm', hasUnreadMessages && 'font-medium text-amber-600')}>
              {patient.unreadMessages > 0 ? `${patient.unreadMessages} new` : 'No new'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div
              className={cn(
                'p-1.5 rounded',
                hasActivePrescriptions
                  ? 'bg-green-100 text-green-600'
                  : 'bg-gray-100 text-gray-500'
              )}
            >
              <Pill className="w-4 h-4" />
            </div>
            <span className="text-sm">
              {patient.activePrescriptions} active
            </span>
          </div>
        </div>

        {/* Actions */}
        {showActions && (
          <div className="flex items-center gap-2 mt-4 pt-4 border-t">
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 h-8"
              onClick={(e) => {
                e.stopPropagation();
                // Navigate to messages
              }}
            >
              <Mail className="w-4 h-4 mr-1" />
              Message
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 h-8"
              onClick={(e) => {
                e.stopPropagation();
                // Navigate to prescriptions
              }}
            >
              <Pill className="w-4 h-4 mr-1" />
              Rx
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 h-8"
              onClick={(e) => {
                e.stopPropagation();
                // Navigate to records
              }}
            >
              <FileText className="w-4 h-4 mr-1" />
              Records
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Compact Version for Lists
// ============================================================================

interface CompactPatientCardProps {
  patient: PhysicianPatientListItem;
  onClick: () => void;
  className?: string;
}

/**
 * Compact patient card for list views
 */
export function CompactPatientCard({
  patient,
  onClick,
  className,
}: CompactPatientCardProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-4 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors',
        className
      )}
      onClick={onClick}
    >
      <Avatar className="h-10 w-10">
        <AvatarFallback className="text-xs font-semibold bg-ocean-100 text-ocean-700">
          {getInitials(patient.name)}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-medium truncate">{patient.name}</h4>
          {patient.unreadMessages > 0 && (
            <Badge variant="secondary" className="text-[10px] h-5">
              {patient.unreadMessages}
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground truncate">
          {patient.age}y • {TREATMENT_TYPE_LABELS[patient.treatmentType]}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <RiskBadge level={patient.riskLevel} size="sm" />
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </div>
    </div>
  );
}
