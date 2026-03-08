/**
 * DashboardStats Component
 * 
 * Displays key metrics and statistics on the physician dashboard.
 * Shows pending reviews, patients today, unread messages, and prescriptions.
 * 
 * @module components/physician/DashboardStats
 */

'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  ClipboardList,
  Users,
  MessageSquare,
  Pill,
  AlertCircle,
  Clock,
  TrendingUp,
  Activity,
} from 'lucide-react';
import type { PhysicianDashboardStats } from '@/types/physician-dashboard';

// ============================================================================
// Props Interface
// ============================================================================

interface DashboardStatsProps {
  /** Dashboard statistics data */
  stats: PhysicianDashboardStats;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// Stat Card Component
// ============================================================================

interface StatCardProps {
  /** Card title */
  title: string;
  /** Current value */
  value: number;
  /** Icon component */
  icon: React.ElementType;
  /** Icon background color class */
  iconBgColor: string;
  /** Icon text color class */
  iconColor: string;
  /** Optional secondary stat */
  secondaryValue?: string;
  /** Whether to show an alert indicator */
  alert?: boolean;
  /** Click handler for the card */
  onClick?: () => void;
}

function StatCard({
  title,
  value,
  icon: Icon,
  iconBgColor,
  iconColor,
  secondaryValue,
  alert,
  onClick,
}: StatCardProps) {
  return (
    <Card
      className={cn(
        'transition-all duration-200',
        onClick && 'cursor-pointer hover:shadow-md hover:-translate-y-0.5'
      )}
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <div className="flex items-baseline gap-2 mt-2">
              <h3 className="text-3xl font-bold tracking-tight">{value}</h3>
              {alert && value > 0 && (
                <AlertCircle className="w-5 h-5 text-destructive animate-pulse" />
              )}
            </div>
            {secondaryValue && (
              <p className="text-sm text-muted-foreground mt-1">{secondaryValue}</p>
            )}
          </div>
          <div
            className={cn(
              'p-3 rounded-lg',
              iconBgColor
            )}
          >
            <Icon className={cn('w-5 h-5', iconColor)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * DashboardStats displays key metrics for the physician dashboard
 * 
 * @example
 * ```tsx
 * <DashboardStats 
 *   stats={{
 *     pendingReviews: 5,
 *     patientsToday: 12,
 *     unreadMessages: 3,
 *     prescriptionsThisMonth: 28,
 *     overdueReviews: 1,
 *     averageReviewTime: 4.5
 *   }}
 * />
 * ```
 */
export function DashboardStats({ stats, className }: DashboardStatsProps) {
  const hasOverdue = stats.overdueReviews > 0;

  return (
    <div className={cn('grid gap-4 md:grid-cols-2 lg:grid-cols-4', className)}>
      {/* Pending Reviews */}
      <StatCard
        title="Pending Reviews"
        value={stats.pendingReviews}
        icon={ClipboardList}
        iconBgColor={hasOverdue ? 'bg-red-100' : 'bg-blue-100'}
        iconColor={hasOverdue ? 'text-red-600' : 'text-blue-600'}
        secondaryValue={
          hasOverdue
            ? `${stats.overdueReviews} overdue`
            : stats.pendingReviews > 0
            ? 'All within SLA'
            : 'All caught up!'
        }
        alert={hasOverdue}
      />

      {/* Patients Today */}
      <StatCard
        title="Patients Today"
        value={stats.patientsToday}
        icon={Users}
        iconBgColor="bg-green-100"
        iconColor="text-green-600"
        secondaryValue="Active today"
      />

      {/* Unread Messages */}
      <StatCard
        title="Unread Messages"
        value={stats.unreadMessages}
        icon={MessageSquare}
        iconBgColor={stats.unreadMessages > 0 ? 'bg-amber-100' : 'bg-purple-100'}
        iconColor={stats.unreadMessages > 0 ? 'text-amber-600' : 'text-purple-600'}
        secondaryValue={stats.unreadMessages > 0 ? 'Needs attention' : 'All read'}
        alert={stats.unreadMessages > 5}
      />

      {/* Prescriptions This Month */}
      <StatCard
        title="Prescriptions (Month)"
        value={stats.prescriptionsThisMonth}
        icon={Pill}
        iconBgColor="bg-teal-100"
        iconColor="text-teal-600"
        secondaryValue={`Avg ${stats.averageReviewTime.toFixed(1)}h review time`}
      />
    </div>
  );
}

// ============================================================================
// Quick Stats Bar (Compact Version)
// ============================================================================

interface QuickStatsBarProps {
  stats: PhysicianDashboardStats;
  className?: string;
}

/**
 * Compact stats bar for mobile or header display
 */
export function QuickStatsBar({ stats, className }: QuickStatsBarProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-6 py-3 px-4 bg-muted/50 rounded-lg',
        className
      )}
    >
      <div className="flex items-center gap-2">
        <ClipboardList className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm">
          <span className="font-semibold">{stats.pendingReviews}</span>{' '}
          <span className="text-muted-foreground">pending</span>
        </span>
      </div>
      
      <div className="flex items-center gap-2">
        <MessageSquare className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm">
          <span className="font-semibold">{stats.unreadMessages}</span>{' '}
          <span className="text-muted-foreground">messages</span>
        </span>
      </div>
      
      <div className="flex items-center gap-2">
        <Users className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm">
          <span className="font-semibold">{stats.patientsToday}</span>{' '}
          <span className="text-muted-foreground">today</span>
        </span>
      </div>

      {stats.overdueReviews > 0 && (
        <div className="flex items-center gap-2 ml-auto">
          <AlertCircle className="w-4 h-4 text-destructive" />
          <span className="text-sm text-destructive font-medium">
            {stats.overdueReviews} overdue
          </span>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Stats Trend (For Analytics)
// ============================================================================

interface StatsTrendProps {
  /** Trend data for the week */
  weeklyData: {
    day: string;
    reviews: number;
    messages: number;
  }[];
  className?: string;
}

/**
 * Weekly trend visualization
 */
export function StatsTrend({ weeklyData, className }: StatsTrendProps) {
  const maxValue = Math.max(
    ...weeklyData.map((d) => Math.max(d.reviews, d.messages))
  );

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Weekly Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-2 h-32">
          {weeklyData.map((day, index) => (
            <div
              key={day.day}
              className="flex-1 flex flex-col items-center gap-1"
            >
              <div className="w-full flex gap-0.5 items-end h-24">
                {/* Reviews bar */}
                <div
                  className="flex-1 bg-blue-500 rounded-t transition-all duration-300"
                  style={{
                    height: `${(day.reviews / maxValue) * 100}%`,
                    minHeight: day.reviews > 0 ? 4 : 0,
                  }}
                  title={`${day.reviews} reviews`}
                />
                {/* Messages bar */}
                <div
                  className="flex-1 bg-purple-500 rounded-t transition-all duration-300"
                  style={{
                    height: `${(day.messages / maxValue) * 100}%`,
                    minHeight: day.messages > 0 ? 4 : 0,
                  }}
                  title={`${day.messages} messages`}
                />
              </div>
              <span className="text-xs text-muted-foreground">
                {day.day.slice(0, 3)}
              </span>
            </div>
          ))}
        </div>
        
        <div className="flex items-center justify-center gap-6 mt-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded" />
            <span className="text-sm text-muted-foreground">Reviews</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-purple-500 rounded" />
            <span className="text-sm text-muted-foreground">Messages</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
