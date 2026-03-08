'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Mail, 
  Phone, 
  MapPin, 
  Calendar, 
  MessageSquare, 
  FileText,
  Printer,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  calculateAge, 
  getPatientInitials, 
  getStatusVariant, 
  formatDate 
} from '@/lib/physician/patient-utils';

interface PatientProfileCardProps {
  patientId: string;
  profile: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    phone: string;
    email: string;
    address: {
      street: string;
      city: string;
      state: string;
      zip: string;
    };
    medicalHistory: Record<string, unknown> | null;
    currentMedications: Record<string, unknown> | null;
    allergies: Record<string, unknown> | null;
    primaryConcern: string | null;
  };
  className?: string;
  onMessageClick?: () => void;
  onViewIntakesClick?: () => void;
  onPrintClick?: () => void;
}

export function PatientProfileCard({
  patientId,
  profile,
  className,
  onMessageClick,
  onViewIntakesClick,
  onPrintClick,
}: PatientProfileCardProps): React.ReactElement {
  const age = calculateAge(profile.dateOfBirth);
  const initials = getPatientInitials(profile.firstName, profile.lastName);
  
  // Get concern label
  const getConcernLabel = (concern: string | null): string => {
    if (!concern) return 'Unknown';
    const labels: Record<string, string> = {
      'ALCOHOL': 'Alcohol Use',
      'SMOKING': 'Discontinued',
      'BOTH': 'Discontinued',
      'UNKNOWN': 'Unknown',
    };
    return labels[concern] || concern;
  };

  // Get concern severity color
  const getConcernColor = (concern: string | null): string => {
    if (!concern) return 'bg-gray-100 text-gray-800';
    const colors: Record<string, string> = {
      'ALCOHOL': 'bg-blue-100 text-blue-800',
      'SMOKING': 'bg-gray-100 text-gray-600',
      'BOTH': 'bg-purple-100 text-purple-800',
      'UNKNOWN': 'bg-gray-100 text-gray-800',
    };
    return colors[concern] || 'bg-gray-100 text-gray-800';
  };

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 bg-navy text-white">
              <AvatarFallback className="text-lg font-semibold bg-navy text-white">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-xl">
                {profile.firstName} {profile.lastName}
              </CardTitle>
              <CardDescription className="flex items-center gap-2 mt-1">
                <span>Age {age}</span>
                <span className="text-muted-foreground">•</span>
                <span>ID: {patientId.slice(0, 8)}...</span>
              </CardDescription>
            </div>
          </div>
          <Badge 
            className={cn("print:hidden", getConcernColor(profile.primaryConcern))}
            variant="secondary"
          >
            {getConcernLabel(profile.primaryConcern)}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Contact Information */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Contact Information
          </h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="truncate">{profile.email}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span>{profile.phone}</span>
            </div>
            <div className="flex items-center gap-2 text-sm sm:col-span-2">
              <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span>
                {profile.address.street}, {profile.address.city}, {profile.address.state} {profile.address.zip}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span>DOB: {formatDate(profile.dateOfBirth)}</span>
            </div>
          </div>
        </div>

        {/* Medical Information */}
        {(profile.allergies || profile.currentMedications) && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Medical Alerts
            </h4>
            {profile.allergies && Object.keys(profile.allergies).length > 0 && (
              <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg border border-red-100">
                <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <span className="font-medium text-red-800">Allergies:</span>
                  <span className="text-red-700 ml-1">
                    {Object.values(profile.allergies).join(', ')}
                  </span>
                </div>
              </div>
            )}
            {profile.currentMedications && Object.keys(profile.currentMedications).length > 0 && (
              <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <span className="font-medium text-blue-800">Current Medications:</span>
                  <span className="text-blue-700 ml-1">
                    {Object.values(profile.currentMedications).join(', ')}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2 pt-2 print:hidden">
          <Button 
            variant="outline" 
            size="sm"
            onClick={onMessageClick}
            className="flex items-center gap-2"
          >
            <MessageSquare className="h-4 w-4" />
            Message Patient
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={onViewIntakesClick}
            className="flex items-center gap-2"
          >
            <FileText className="h-4 w-4" />
            View Intakes
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={onPrintClick}
            className="flex items-center gap-2"
          >
            <Printer className="h-4 w-4" />
            Print Record
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
