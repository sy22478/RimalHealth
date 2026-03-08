'use client';

import * as React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/Skeleton';
import { 
  User, 
  FileText, 
  Pill, 
  MessageSquare, 
  StickyNote,
  Clock,
  ArrowLeft,
  Printer,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PatientProfileCard } from './PatientProfileCard';
import { PatientIntakes } from './PatientIntakes';
import { PatientPrescriptions } from './PatientPrescriptions';
import { PatientMessages } from './PatientMessages';
import { PatientNotes } from './PatientNotes';
import { PatientTimeline } from './PatientTimeline';

// Types
interface PatientRecordData {
  id: string;
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
  intakes: Array<{
    id: string;
    status: string;
    submittedAt: Date;
    riskScore: number | null;
    complexityScore: number | null;
    treatmentType: string | null;
  }>;
  prescriptions: Array<{
    id: string;
    medicationName: string;
    dosage: string;
    status: string;
    createdAt: Date;
    pharmacyName: string | null;
    refillsRemaining: number;
  }>;
  messages: Array<{
    id: string;
    subject: string;
    body: string;
    sentAt: Date;
    senderType: string;
  }>;
  notes: Array<{
    id: string;
    content: string;
    createdAt: Date;
    updatedAt: Date;
    authorName: string;
    physicianId: string;
  }>;
  timeline: Array<{
    type: 'intake' | 'prescription' | 'message' | 'note' | 'review' | 'refill';
    date: Date | string;
    title: string;
    description: string;
    metadata?: Record<string, unknown>;
  }>;
}

interface PatientRecordProps {
  patientId: string;
  currentPhysicianId: string;
  data: PatientRecordData | null;
  isLoading?: boolean;
  error?: string | null;
  className?: string;
  onBack?: () => void;
  onViewIntake?: (intakeId: string) => void;
  onViewPrescription?: (prescriptionId: string) => void;
  onViewMessage?: (messageId: string) => void;
  onReplyToMessage?: (messageId: string) => void;
  onRequestRefill?: (prescriptionId: string) => void;
  onAddNote?: (content: string) => Promise<void>;
  onEditNote?: (noteId: string, content: string) => Promise<void>;
  onDeleteNote?: (noteId: string) => Promise<void>;
  onPrint?: () => void;
}

export function PatientRecord({
  patientId,
  currentPhysicianId,
  data,
  isLoading = false,
  error,
  className,
  onBack,
  onViewIntake,
  onViewPrescription,
  onViewMessage,
  onReplyToMessage,
  onRequestRefill,
  onAddNote,
  onEditNote,
  onDeleteNote,
  onPrint,
}: PatientRecordProps): React.ReactElement {
  const [activeTab, setActiveTab] = React.useState('overview');

  // Handle print
  const handlePrint = (): void => {
    if (onPrint) {
      onPrint();
    } else {
      window.print();
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className={cn("space-y-6", className)}>
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-24" />
        </div>
        <Skeleton className="h-64 w-full" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  // Error state
  if (error || !data) {
    return (
      <Card className={cn("p-8", className)}>
        <div className="text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
          <h3 className="text-lg font-semibold mb-2">Error Loading Patient Record</h3>
          <p className="text-muted-foreground mb-4">
            {error || 'Patient record could not be loaded.'}
          </p>
          <Button onClick={onBack} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between print:hidden">
        <Button variant="ghost" onClick={onBack} className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Patients
        </Button>
        <Button variant="outline" onClick={handlePrint} className="flex items-center gap-2">
          <Printer className="h-4 w-4" />
          Print Record
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-6 print:hidden">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="intakes" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Intakes</span>
            {data.intakes.length > 0 && (
              <span className="ml-1 text-xs bg-muted rounded-full px-1.5">
                {data.intakes.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="prescriptions" className="flex items-center gap-2">
            <Pill className="h-4 w-4" />
            <span className="hidden sm:inline">Prescriptions</span>
            {data.prescriptions.length > 0 && (
              <span className="ml-1 text-xs bg-muted rounded-full px-1.5">
                {data.prescriptions.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="messages" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Messages</span>
            {data.messages.length > 0 && (
              <span className="ml-1 text-xs bg-muted rounded-full px-1.5">
                {data.messages.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="notes" className="flex items-center gap-2">
            <StickyNote className="h-4 w-4" />
            <span className="hidden sm:inline">Notes</span>
            {data.notes.length > 0 && (
              <span className="ml-1 text-xs bg-muted rounded-full px-1.5">
                {data.notes.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="timeline" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">Timeline</span>
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6 mt-6">
          <PatientProfileCard
            patientId={patientId}
            profile={data.profile}
            onMessageClick={() => setActiveTab('messages')}
            onViewIntakesClick={() => setActiveTab('intakes')}
            onPrintClick={handlePrint}
          />
          
          <div className="grid gap-6 md:grid-cols-2">
            {/* Recent Intakes */}
            <PatientIntakes
              intakes={data.intakes.slice(0, 3)}
              onViewIntake={onViewIntake}
            />
            
            {/* Active Prescriptions */}
            <PatientPrescriptions
              prescriptions={data.prescriptions.filter(p => 
                ['ACTIVE', 'SENT'].includes(p.status.toUpperCase())
              ).slice(0, 3)}
              onViewPrescription={onViewPrescription}
              onRequestRefill={onRequestRefill}
            />
          </div>

          {/* Recent Activity */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-4">Recent Activity</h3>
              <PatientTimeline events={data.timeline.slice(0, 5)} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Intakes Tab */}
        <TabsContent value="intakes" className="mt-6">
          <PatientIntakes
            intakes={data.intakes}
            onViewIntake={onViewIntake}
          />
        </TabsContent>

        {/* Prescriptions Tab */}
        <TabsContent value="prescriptions" className="mt-6">
          <PatientPrescriptions
            prescriptions={data.prescriptions}
            onViewPrescription={onViewPrescription}
            onRequestRefill={onRequestRefill}
          />
        </TabsContent>

        {/* Messages Tab */}
        <TabsContent value="messages" className="mt-6">
          <PatientMessages
            messages={data.messages}
            onViewMessage={onViewMessage}
            onReply={onReplyToMessage}
          />
        </TabsContent>

        {/* Notes Tab */}
        <TabsContent value="notes" className="mt-6">
          <PatientNotes
            notes={data.notes}
            currentPhysicianId={currentPhysicianId}
            onAddNote={onAddNote}
            onEditNote={onEditNote}
            onDeleteNote={onDeleteNote}
          />
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline" className="mt-6">
          <PatientTimeline events={data.timeline} />
        </TabsContent>
      </Tabs>

      {/* Print Footer - only visible when printing */}
      <div className="hidden print:block print:mt-8 print:pt-4 print:border-t">
        <p className="text-sm text-muted-foreground">
          Printed from Rimal Health Patient Record System
        </p>
        <p className="text-sm text-muted-foreground">
          Patient: {data.profile.firstName} {data.profile.lastName} | 
          ID: {patientId} | 
          Date: {new Date().toLocaleDateString()}
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          CONFIDENTIAL - HIPAA PROTECTED INFORMATION
        </p>
      </div>
    </div>
  );
}

export type { PatientRecordData };
