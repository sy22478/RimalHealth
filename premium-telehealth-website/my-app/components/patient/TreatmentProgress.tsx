'use client';

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Activity, 
  Target, 
  TrendingUp,
  Calendar
} from 'lucide-react';
import { 
  formatConcernType, 
  formatTreatmentGoal,
  DashboardPatientProfile 
} from '@/types/dashboard';
import { ConcernType, TreatmentGoal } from '@prisma/client';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface TreatmentProgressProps {
  profile: DashboardPatientProfile | null;
  daysInTreatment?: number;
  className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get progress percentage based on days in treatment
 * Assumes typical treatment duration of 90 days for full progress
 */
function calculateProgress(daysInTreatment: number): number {
  const maxDays = 90; // 3 months typical initial treatment
  return Math.min(Math.round((daysInTreatment / maxDays) * 100), 100);
}

/**
 * Get milestone message based on progress
 */
function getMilestoneMessage(progress: number): string {
  if (progress < 10) return 'Just getting started - you\'ve got this!';
  if (progress < 25) return 'Building momentum - keep going!';
  if (progress < 50) return 'Making great progress!';
  if (progress < 75) return 'Over halfway there - stay strong!';
  if (progress < 90) return 'Almost there - finishing strong!';
  return 'Treatment complete - amazing work!';
}

/**
 * Get milestone badge based on progress
 */
function getMilestoneBadge(progress: number): { label: string; color: string } {
  if (progress < 25) return { label: 'Starting Out', color: 'bg-blue-100 text-blue-700' };
  if (progress < 50) return { label: 'Building Habits', color: 'bg-ocean-100 text-ocean-700' };
  if (progress < 75) return { label: 'Making Progress', color: 'bg-purple-100 text-purple-700' };
  if (progress < 100) return { label: 'Almost There', color: 'bg-amber-100 text-amber-700' };
  return { label: 'Complete', color: 'bg-success-100 text-success-700' };
}

/**
 * Get goal-specific tips
 */
function getGoalTips(goal: TreatmentGoal | null, concern: ConcernType | null): string[] {
  if (concern === 'ALCOHOL' || concern === 'BOTH') {
    if (goal === 'QUIT') {
      return [
        'Avoid triggers and high-risk situations',
        'Practice saying "no" confidently',
        'Celebrate alcohol-free milestones'
      ];
    }
    if (goal === 'REDUCE') {
      return [
        'Set specific drinking limits',
        'Track your drinks daily',
        'Plan alcohol-free days each week'
      ];
    }
  }
  
  return [
    'Take your medication as prescribed',
    'Stay in touch with your doctor',
    'Track your progress daily'
  ];
}

// ============================================================================
// Main Component
// ============================================================================

export function TreatmentProgress({ 
  profile, 
  daysInTreatment = 0,
  className 
}: TreatmentProgressProps) {
  const progress = calculateProgress(daysInTreatment);
  const milestone = getMilestoneBadge(progress);
  const tips = getGoalTips(profile?.treatmentGoal ?? null, profile?.primaryConcern ?? null);

  return (
    <Card className={cn('h-full', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5 text-ocean-600" />
            Treatment Progress
          </CardTitle>
          <Badge className={milestone.color}>
            {milestone.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{daysInTreatment} days in treatment</span>
            <span className="font-medium text-ocean-700">{progress}%</span>
          </div>
          <Progress 
            value={progress} 
            className="h-2"
          />
          <p className="text-xs text-muted-foreground">
            {getMilestoneMessage(progress)}
          </p>
        </div>

        {/* Treatment Info */}
        {profile && (
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Target className="h-4 w-4" />
                <span className="text-xs uppercase tracking-wide">Concern</span>
              </div>
              <p className="font-medium text-sm text-gray-900">
                {formatConcernType(profile.primaryConcern)}
              </p>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <TrendingUp className="h-4 w-4" />
                <span className="text-xs uppercase tracking-wide">Goal</span>
              </div>
              <p className="font-medium text-sm text-gray-900">
                {formatTreatmentGoal(profile.treatmentGoal)}
              </p>
            </div>
          </div>
        )}

        {/* Tips */}
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-ocean-600" />
            Helpful Tips
          </h4>
          <ul className="space-y-1.5">
            {tips.map((tip, index) => (
              <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                <span className="text-ocean-500 mt-1">•</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

export default TreatmentProgress;
