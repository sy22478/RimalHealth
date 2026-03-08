/**
 * EmptyState Component
 * 
 * A reusable empty state component for when no data is available.
 * Includes icon, title, description, and optional action button.
 * 
 * @module components/shared/EmptyState
 */

'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { 
  Inbox, 
  Search, 
  FileX, 
  ClipboardList,
  MessageSquare,
  Pill,
  Users,
  type LucideIcon 
} from 'lucide-react';

// ============================================================================
// Icon Types
// ============================================================================

type EmptyStateIcon = 'inbox' | 'search' | 'file' | 'clipboard' | 'message' | 'pill' | 'users' | 'custom';

const iconMap: Record<EmptyStateIcon, LucideIcon> = {
  inbox: Inbox,
  search: Search,
  file: FileX,
  clipboard: ClipboardList,
  message: MessageSquare,
  pill: Pill,
  users: Users,
  custom: Inbox,
};

// ============================================================================
// Props Interface
// ============================================================================

interface EmptyStateProps {
  /** Title text */
  title: string;
  /** Description text */
  description?: string;
  /** Icon to display */
  icon?: EmptyStateIcon;
  /** Custom icon component */
  customIcon?: React.ReactNode;
  /** Primary action button text */
  actionLabel?: string;
  /** Primary action button handler */
  onAction?: () => void;
  /** Secondary action button text */
  secondaryActionLabel?: string;
  /** Secondary action button handler */
  onSecondaryAction?: () => void;
  /** Additional CSS classes */
  className?: string;
  /** Compact mode (smaller padding and text) */
  compact?: boolean;
}

// ============================================================================
// Component
// ============================================================================

/**
 * EmptyState displays a friendly message when no data is available
 * 
 * @example
 * ```tsx
 * <EmptyState
 *   title="No pending reviews"
 *   description="All intake reviews have been completed."
 *   icon="clipboard"
 * />
 * 
 * <EmptyState
 *   title="No patients found"
 *   description="Try adjusting your search filters."
 *   icon="search"
 *   actionLabel="Clear filters"
 *   onAction={() => clearFilters()}
 * />
 * ```
 */
export function EmptyState({
  title,
  description,
  icon = 'inbox',
  customIcon,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  className,
  compact = false,
}: EmptyStateProps) {
  const Icon = iconMap[icon];

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'py-8 px-4' : 'py-16 px-4',
        className
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          'rounded-full bg-muted flex items-center justify-center mb-4',
          compact ? 'w-12 h-12' : 'w-16 h-16'
        )}
      >
        {customIcon ? (
          customIcon
        ) : (
          <Icon
            className={cn(
              'text-muted-foreground',
              compact ? 'w-6 h-6' : 'w-8 h-8'
            )}
          />
        )}
      </div>

      {/* Title */}
      <h3
        className={cn(
          'font-semibold text-foreground',
          compact ? 'text-base' : 'text-lg'
        )}
      >
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p
          className={cn(
            'text-muted-foreground mt-1 max-w-sm',
            compact ? 'text-sm' : 'text-base'
          )}
        >
          {description}
        </p>
      )}

      {/* Actions */}
      {(actionLabel || secondaryActionLabel) && (
        <div className="flex flex-col sm:flex-row items-center gap-3 mt-6">
          {actionLabel && onAction && (
            <Button onClick={onAction} size={compact ? 'sm' : 'default'}>
              {actionLabel}
            </Button>
          )}
          {secondaryActionLabel && onSecondaryAction && (
            <Button
              variant="outline"
              onClick={onSecondaryAction}
              size={compact ? 'sm' : 'default'}
            >
              {secondaryActionLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Pre-configured Empty States
// ============================================================================

/**
 * Empty state for no search results
 */
interface NoSearchResultsProps {
  searchQuery: string;
  onClearSearch: () => void;
  className?: string;
}

export function NoSearchResults({
  searchQuery,
  onClearSearch,
  className,
}: NoSearchResultsProps) {
  return (
    <EmptyState
      title="No results found"
      description={`We couldn't find any matches for "${searchQuery}". Try a different search term.`}
      icon="search"
      actionLabel="Clear search"
      onAction={onClearSearch}
      className={className}
    />
  );
}

/**
 * Empty state for no pending reviews
 */
export function NoPendingReviews({ className }: { className?: string }) {
  return (
    <EmptyState
      title="No pending reviews"
      description="All intake reviews have been completed. Great job!"
      icon="clipboard"
      className={className}
    />
  );
}

/**
 * Empty state for no patients
 */
interface NoPatientsProps {
  onRefresh?: () => void;
  className?: string;
}

export function NoPatients({ onRefresh, className }: NoPatientsProps) {
  return (
    <EmptyState
      title="No patients found"
      description="There are no patients matching your current filters."
      icon="users"
      actionLabel={onRefresh ? "Refresh" : undefined}
      onAction={onRefresh}
      className={className}
    />
  );
}

/**
 * Empty state for no prescriptions
 */
export function NoPrescriptions({ className }: { className?: string }) {
  return (
    <EmptyState
      title="No prescriptions"
      description="There are no prescriptions to display."
      icon="pill"
      className={className}
    />
  );
}

/**
 * Empty state for no messages
 */
export function NoMessages({ className }: { className?: string }) {
  return (
    <EmptyState
      title="No messages"
      description="There are no messages in this conversation yet."
      icon="message"
      className={className}
    />
  );
}

/**
 * Empty state for patient with no history
 */
export function NoPatientHistory({ className }: { className?: string }) {
  return (
    <EmptyState
      title="No history yet"
      description="This patient doesn't have any treatment history."
      icon="file"
      compact
      className={className}
    />
  );
}
