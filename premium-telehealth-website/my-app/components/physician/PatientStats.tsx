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
import { Users, UserCheck, Clock, AlertTriangle } from 'lucide-react';
import type { PhysicianPatientListItem } from '@/types/physician-dashboard';

interface PatientStatsProps {
  patients: PhysicianPatientListItem[];
}

/**
 * PatientStats displays key metrics for the patient population
 */
export function PatientStats({ patients }: PatientStatsProps): React.ReactElement {
  const stats = React.useMemo(() => {
    const total = patients.length;
    const active = patients.filter((p) => p.status === 'ACTIVE').length;
    const pending = patients.filter((p) => p.status === 'PENDING').length;
    const completed = patients.filter((p) => p.status === 'COMPLETED').length;
    const highRisk = patients.filter((p) => p.riskLevel === 'HIGH' || p.riskLevel === 'SEVERE').length;

    return {
      total,
      active,
      pending,
      completed,
      highRisk,
    };
  }, [patients]);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {/* Total Patients */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Users className="w-4 h-4" />
            <span className="text-sm">Total Patients</span>
          </div>
          <p className="text-2xl font-bold">{stats.total}</p>
        </CardContent>
      </Card>

      {/* Active */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <UserCheck className="w-4 h-4" />
            <span className="text-sm">Active</span>
          </div>
          <p className="text-2xl font-bold text-green-600">{stats.active}</p>
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

      {/* High Risk */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm">High Risk</span>
          </div>
          <p className="text-2xl font-bold text-red-600">{stats.highRisk}</p>
        </CardContent>
      </Card>
    </div>
  );
}

export default PatientStats;
