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
  Pill, 
  MapPin,
  RotateCcw,
  CheckCircle,
  Clock,
  AlertCircle,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getStatusVariant, formatDate } from '@/lib/physician/patient-utils';

interface Prescription {
  id: string;
  medicationName: string;
  dosage: string;
  status: string;
  createdAt: Date;
  pharmacyName: string | null;
  refillsRemaining: number;
}

interface PatientPrescriptionsProps {
  prescriptions: Prescription[];
  isLoading?: boolean;
  className?: string;
  onViewPrescription?: (prescriptionId: string) => void;
  onRequestRefill?: (prescriptionId: string) => void;
}

export function PatientPrescriptions({
  prescriptions,
  isLoading = false,
  className,
  onViewPrescription,
  onRequestRefill,
}: PatientPrescriptionsProps): React.ReactElement {
  // Get status icon
  const getStatusIcon = (status: string): React.ReactNode => {
    switch (status.toLowerCase()) {
      case 'active':
      case 'sent':
        return <CheckCircle className="h-4 w-4 text-success" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-warning" />;
      case 'expired':
      case 'cancelled':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Pill className="h-4 w-4 text-muted-foreground" />;
    }
  };

  // Get refill status
  const getRefillStatus = (refillsRemaining: number): React.ReactNode => {
    if (refillsRemaining === 0) {
      return (
        <Badge variant="destructive" className="text-xs">
          No Refills
        </Badge>
      );
    }
    if (refillsRemaining <= 2) {
      return (
        <Badge variant="secondary" className="text-xs bg-warning/20 text-warning-700">
          {refillsRemaining} Left
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-xs">
        {refillsRemaining} Refills
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (prescriptions.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Pill className="h-5 w-5" />
            Prescriptions
          </CardTitle>
          <CardDescription>Active and historical prescriptions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Pill className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No prescriptions found</p>
            <p className="text-sm">No prescriptions have been sent for this patient.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const activePrescriptions = prescriptions.filter(p => 
    ['ACTIVE', 'SENT'].includes(p.status.toUpperCase())
  );

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Pill className="h-5 w-5" />
              Prescriptions
            </CardTitle>
            <CardDescription>
              {activePrescriptions.length} active, {prescriptions.length - activePrescriptions.length} historical
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Medication</TableHead>
                <TableHead>Dosage</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Pharmacy</TableHead>
                <TableHead>Refills</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {prescriptions.map((prescription) => (
                <TableRow key={prescription.id}>
                  <TableCell className="font-medium">
                    {prescription.medicationName}
                  </TableCell>
                  <TableCell>
                    {prescription.dosage}
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={getStatusVariant(prescription.status)}
                      className="flex items-center gap-1 w-fit"
                    >
                      {getStatusIcon(prescription.status)}
                      {prescription.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <MapPin className="h-3 w-3 text-muted-foreground" />
                      {prescription.pharmacyName || 'Not specified'}
                    </div>
                  </TableCell>
                  <TableCell>
                    {getRefillStatus(prescription.refillsRemaining)}
                  </TableCell>
                  <TableCell>
                    {formatDate(prescription.createdAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onViewPrescription?.(prescription.id)}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      {prescription.refillsRemaining > 0 && 
                       prescription.status.toUpperCase() === 'ACTIVE' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onRequestRefill?.(prescription.id)}
                          title="Request refill"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
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
