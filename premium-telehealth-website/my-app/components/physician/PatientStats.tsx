/**
 * PatientStats Component
 *
 * Displays statistics cards for the patient list page.
 *
 * @module components/physician/PatientStats
 */

'use client';

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Users, UserCheck, Clock, CheckCircle, XCircle } from 'lucide-react';
import type { PhysicianPatientListItem } from '@/types/physician-dashboard';

interface PatientCounts {
  total: number;
  pending: number;
  completed: number;
  approved: number;
  rejected: number;
}

interface PatientStatsProps {
  patients: PhysicianPatientListItem[];
  /** Server-side intake status counts (preferred over client-side derivation) */
  counts?: PatientCounts | null;
}

/**
 * PatientStats displays key metrics for the patient population
 */
export function PatientStats({ patients, counts }: PatientStatsProps): React.ReactElement {
  const stats = React.useMemo(() => {
    const total = counts?.total ?? patients.length;
    const pending = counts?.pending ?? patients.filter((p) => p.status === 'PENDING').length;
    const completed = counts?.completed ?? patients.filter((p) => p.status === 'COMPLETED').length;
    const approved = counts?.approved ?? 0;
    const rejected = counts?.rejected ?? 0;

    return {
      total,
      pending,
      completed,
      approved,
      rejected,
    };
  }, [patients, counts]);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {/* Total Patients */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Users className="w-4 h-4" />
            <span className="text-sm">Total</span>
          </div>
          <p className="text-2xl font-bold">{stats.total}</p>
        </CardContent>
      </Card>

      {/* Pending */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Clock className="w-4 h-4" />
            <span className="text-sm">Pending</span>
          </div>
          <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
        </CardContent>
      </Card>

      {/* Completed */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <UserCheck className="w-4 h-4" />
            <span className="text-sm">Completed</span>
          </div>
          <p className="text-2xl font-bold text-blue-600">{stats.completed}</p>
        </CardContent>
      </Card>

      {/* Approved */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm">Approved</span>
          </div>
          <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
        </CardContent>
      </Card>

      {/* Rejected */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <XCircle className="w-4 h-4" />
            <span className="text-sm">Rejected</span>
          </div>
          <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
        </CardContent>
      </Card>
    </div>
  );
}

export default PatientStats;
