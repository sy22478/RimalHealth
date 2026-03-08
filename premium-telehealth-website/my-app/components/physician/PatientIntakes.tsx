'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/Skeleton';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  FileText, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Clock,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getStatusVariant, formatDate } from '@/lib/physician/patient-utils';

interface Intake {
  id: string;
  status: string;
  submittedAt: Date;
  riskScore: number | null;
  complexityScore: number | null;
  treatmentType: string | null;
}

interface PatientIntakesProps {
  intakes: Intake[];
  isLoading?: boolean;
  className?: string;
  onViewIntake?: (intakeId: string) => void;
}

export function PatientIntakes({
  intakes,
  isLoading = false,
  className,
  onViewIntake,
}: PatientIntakesProps): React.ReactElement {
  // Get status icon
  const getStatusIcon = (status: string): React.ReactNode => {
    switch (status.toLowerCase()) {
      case 'approved':
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-success" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'pending':
      case 'submitted':
        return <Clock className="h-4 w-4 text-warning" />;
      default:
        return <FileText className="h-4 w-4 text-muted-foreground" />;
    }
  };

  // Get risk indicator
  const getRiskIndicator = (score: number | null): React.ReactNode => {
    if (score === null) return <span className="text-muted-foreground">-</span>;
    
    let color = 'bg-success';
    let label = 'Low';
    
    if (score >= 70) {
      color = 'bg-destructive';
      label = 'High';
    } else if (score >= 40) {
      color = 'bg-warning';
      label = 'Medium';
    }

    return (
      <div className="flex items-center gap-2">
        <div className={cn("h-2 w-2 rounded-full", color)} />
        <span className="text-sm">{label} ({score})</span>
      </div>
    );
  };

  // Get complexity indicator
  const getComplexityIndicator = (score: number | null): React.ReactNode => {
    if (score === null) return <span className="text-muted-foreground">-</span>;
    
    let color = 'bg-success';
    let label = 'Simple';
    
    if (score >= 7) {
      color = 'bg-destructive';
      label = 'Complex';
    } else if (score >= 4) {
      color = 'bg-warning';
      label = 'Moderate';
    }

    return (
      <div className="flex items-center gap-2">
        <div className={cn("h-2 w-2 rounded-full", color)} />
        <span className="text-sm">{label} ({score}/10)</span>
      </div>
    );
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (intakes.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Intake History
          </CardTitle>
          <CardDescription>Patient intake forms and assessments</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No intake forms found</p>
            <p className="text-sm">This patient has not submitted any intakes yet.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Intake History
            </CardTitle>
            <CardDescription>
              {intakes.length} intake{intakes.length !== 1 ? 's' : ''} submitted
            </CardDescription>
          </div>
          {intakes.some(i => i.status === 'PENDING') && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Pending Review
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date Submitted</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead>Complexity</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {intakes.map((intake) => (
                <TableRow key={intake.id}>
                  <TableCell className="font-medium">
                    {formatDate(intake.submittedAt)}
                  </TableCell>
                  <TableCell>
                    {intake.treatmentType || 'Unknown'}
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={getStatusVariant(intake.status)}
                      className="flex items-center gap-1 w-fit"
                    >
                      {getStatusIcon(intake.status)}
                      {intake.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {getRiskIndicator(intake.riskScore)}
                  </TableCell>
                  <TableCell>
                    {getComplexityIndicator(intake.complexityScore)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewIntake?.(intake.id)}
                      className="flex items-center gap-1"
                    >
                      View
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
