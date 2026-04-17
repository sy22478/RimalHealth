/**
 * PatientDetailView Component
 * 
 * Comprehensive patient detail view with tabbed interface.
 * Includes Overview, Intakes, Prescriptions, Notes, and Documents tabs.
 * 
 * @module components/physician/PatientDetailView
 */

'use client';

import * as React from 'react';
import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { PatientNotes } from './PatientNotes';
import { cn } from '@/lib/utils';
import {
  Mail,
  Phone,
  Calendar,
  MapPin,
  FileText,
  Pill,
  MessageSquare,
  Activity,
  User,
  StickyNote,
  FolderOpen,
  ClipboardList,
  ChevronRight,
} from 'lucide-react';
import type { PhysicianPatientDetail } from '@/types/physician-dashboard';
import { IntakeStatus, PrescriptionStatus, SenderType } from '@prisma/client';
import { PatientStatusBadge, RiskBadge } from '@/components/shared/StatusBadge';
import { TREATMENT_TYPE_LABELS } from '@/types/physician-dashboard';

// ============================================================================
// Types
// ============================================================================

interface PatientDetailViewProps {
  patient: PhysicianPatientDetail;
  physicianName?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format date for display
 */
function formatDate(date: Date | string | undefined): string {
  if (!date) return 'N/A';
  // Parse YYYY-MM-DD as local date to avoid timezone shift (e.g. DOB)
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [year, month, day] = date.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }
  return new Date(date).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format file size
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Get initials from name
 */
function getInitials(name: string | undefined | null): string {
  if (!name || !name.trim()) return '?';
  return name
    .trim()
    .split(' ')
    .filter((n) => n.length > 0)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';
}

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * Patient Header Component
 */
function PatientHeader({
  patient,
  onAddNote,
}: {
  patient: PhysicianPatientDetail;
  onAddNote: () => void;
}) {
  const displayName = patient.name || 'Unknown Patient';
  const initials = getInitials(displayName);
  const isHighRisk = patient.riskLevel === 'HIGH' || patient.riskLevel === 'SEVERE';

  return (
    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
      <div className="flex items-start gap-4">
        <Avatar className="h-16 w-16">
          <AvatarFallback
            className={cn(
              'text-lg',
              isHighRisk ? 'bg-red-100 text-red-700' : 'bg-ocean-100 text-ocean-700'
            )}
          >
            {initials}
          </AvatarFallback>
        </Avatar>
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold">{displayName}</h1>
            <PatientStatusBadge status={patient.status} />
            {isHighRisk && (
              <Badge variant="destructive" className="text-xs">
                High Risk
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">
            {patient.age ? `${patient.age} years` : 'Age unknown'} • {patient.gender || 'Not specified'} • ID: {patient.id}
          </p>
          <div className="flex items-center gap-4 mt-2 text-sm flex-wrap">
            <span className="flex items-center gap-1 text-muted-foreground">
              <Mail className="w-4 h-4" />
              {patient.emailMasked || 'No email'}
            </span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <Phone className="w-4 h-4" />
              {patient.phoneMasked || 'No phone'}
            </span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/physician/messages?patient=${patient.id}`}>
            <MessageSquare className="w-4 h-4 mr-2" />
            Message Patient
          </Link>
        </Button>
        <Button variant="outline" size="sm" onClick={onAddNote}>
          <StickyNote className="w-4 h-4 mr-2" />
          Add Note
        </Button>
      </div>
    </div>
  );
}

/**
 * Info Cards Row
 */
function InfoCards({ patient }: { patient: PhysicianPatientDetail }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">Treatment Type</p>
          <p className="font-semibold">{TREATMENT_TYPE_LABELS[patient.treatmentType]}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">Risk Level</p>
          <RiskBadge level={patient.riskLevel} />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">Enrolled</p>
          <p className="font-semibold">{formatDate(patient.enrolledAt)}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">Last Visit</p>
          <p className="font-semibold">
            {patient.lastVisitAt ? formatDate(patient.lastVisitAt) : 'Never'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Demographics Card
 */
function DemographicsCard({ patient }: { patient: PhysicianPatientDetail }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <User className="w-5 h-5" />
          Demographics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Date of Birth</p>
            <p className="font-medium">{formatDate(patient.dateOfBirth)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Gender</p>
            <p className="font-medium">{patient.gender || 'Not specified'}</p>
          </div>
        </div>
        <Separator />
        <div>
          <p className="text-sm text-muted-foreground mb-2">Address</p>
          {patient.address ? (
            <div className="text-sm">
              <p>{patient.address.street}</p>
              <p>
                {patient.address.city}, {patient.address.state} {patient.address.zipCode}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No address on file</p>
          )}
        </div>
        <Separator />
        <div>
          <p className="text-sm text-muted-foreground mb-2">Emergency Contact</p>
          {patient.emergencyContact ? (
            <div className="text-sm">
              <p className="font-medium">
                {patient.emergencyContact.name} ({patient.emergencyContact.relationship})
              </p>
              <p className="text-muted-foreground">{patient.emergencyContact.phone}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No emergency contact</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Medical History Card
 */
function MedicalHistoryCard({ patient }: { patient: PhysicianPatientDetail }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Medical History
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Conditions</h4>
          <div className="flex flex-wrap gap-2">
            {patient.medicalHistory?.conditions?.length ? (
              patient.medicalHistory.conditions.map((condition) => (
                <Badge key={condition} variant="secondary">
                  {condition}
                </Badge>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No conditions reported</p>
            )}
          </div>
        </div>
        <Separator />
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Current Medications</h4>
          <ul className="space-y-1">
            {patient.medicalHistory?.medications?.length ? (
              patient.medicalHistory.medications.map((med) => (
                <li key={med} className="text-sm">
                  {med}
                </li>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No medications reported</p>
            )}
          </ul>
        </div>
        <Separator />
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Allergies</h4>
          <div className="flex flex-wrap gap-2">
            {patient.medicalHistory?.allergies?.length ? (
              patient.medicalHistory.allergies.map((allergy) => (
                <Badge key={allergy} variant="destructive">
                  {allergy}
                </Badge>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No allergies reported</p>
            )}
          </div>
        </div>
        {patient.medicalHistory?.surgeries && (
          <>
            <Separator />
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Surgeries</h4>
              <ul className="space-y-1">
                {patient.medicalHistory.surgeries.map((surgery) => (
                  <li key={surgery} className="text-sm">
                    {surgery}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Treatment Preferences Card
 */
function TreatmentPreferencesCard({ patient }: { patient: PhysicianPatientDetail }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <ClipboardList className="w-5 h-5" />
          Treatment Preferences
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground">Preferred Pharmacy</p>
          <p className="font-medium">
            {patient.treatmentPreferences?.preferredPharmacy || 'Not specified'}
          </p>
        </div>
        <Separator />
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Communication</p>
            <p className="font-medium">
              {patient.treatmentPreferences?.communicationPreference || 'Not specified'}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Language</p>
            <p className="font-medium">
              {patient.treatmentPreferences?.languagePreference || 'Not specified'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Intakes Tab Content
 */
function IntakesTab({ intakes }: { intakes: PhysicianPatientDetail['intakes'] }) {
  const statusConfig: Record<string, { label: string; className: string }> = {
    [IntakeStatus.DRAFT]: { label: 'Draft', className: 'bg-gray-100 text-gray-800' },
    [IntakeStatus.SUBMITTED]: { label: 'Submitted', className: 'bg-blue-100 text-blue-800' },
    [IntakeStatus.UNDER_REVIEW]: { label: 'Under Review', className: 'bg-amber-100 text-amber-800' },
    [IntakeStatus.APPROVED]: { label: 'Approved', className: 'bg-green-100 text-green-800' },
    [IntakeStatus.REJECTED]: { label: 'Rejected', className: 'bg-red-100 text-red-800' },
    [IntakeStatus.NEEDS_INFO]: { label: 'Needs Info', className: 'bg-orange-100 text-orange-800' },
    [IntakeStatus.EXPIRED]: { label: 'Expired', className: 'bg-gray-100 text-gray-800' },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5" />
          Intake History
        </CardTitle>
        <CardDescription>All intake submissions and review outcomes</CardDescription>
      </CardHeader>
      <CardContent>
        {intakes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No intakes found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {intakes.map((intake) => (
              <Link
                key={intake.id}
                href={`/physician/intake/${intake.id}`}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/30 transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-muted rounded-full">
                    <FileText className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">Intake #{intake.id.slice(-6)}</p>
                    <p className="text-sm text-muted-foreground">
                      Submitted {formatDate(intake.submittedAt)}
                    </p>
                    {intake.reviewedAt && (
                      <p className="text-sm text-muted-foreground">
                        Reviewed {formatDate(intake.reviewedAt)} by {intake.reviewedBy}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <Badge
                      variant="outline"
                      className={statusConfig[intake.status]?.className || ''}
                    >
                      {statusConfig[intake.status]?.label || intake.status}
                    </Badge>
                    {intake.riskScore !== undefined && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Risk Score: {intake.riskScore}
                      </p>
                    )}
                    {intake.outcome && (
                      <p className="text-sm font-medium mt-1">{intake.outcome}</p>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Prescriptions Tab Content
 */
function PrescriptionsTab({
  prescriptions,
}: {
  prescriptions: PhysicianPatientDetail['prescriptions'];
}) {
  const statusConfig: Record<string, { label: string; className: string }> = {
    [PrescriptionStatus.PENDING]: { label: 'Pending', className: 'bg-amber-100 text-amber-800' },
    [PrescriptionStatus.SENT]: { label: 'Sent to Pharmacy', className: 'bg-blue-100 text-blue-800' },
    [PrescriptionStatus.RECEIVED_BY_PHARMACY]: {
      label: 'At Pharmacy',
      className: 'bg-blue-100 text-blue-800',
    },
    [PrescriptionStatus.FILLED]: { label: 'Being Filled', className: 'bg-amber-100 text-amber-800' },
    [PrescriptionStatus.READY_FOR_PICKUP]: {
      label: 'Ready for Pickup',
      className: 'bg-green-100 text-green-800',
    },
    [PrescriptionStatus.PICKED_UP]: { label: 'Picked Up', className: 'bg-green-100 text-green-800' },
    [PrescriptionStatus.CANCELLED]: { label: 'Cancelled', className: 'bg-red-100 text-red-800' },
    [PrescriptionStatus.EXPIRED]: { label: 'Expired', className: 'bg-gray-100 text-gray-800' },
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Pill className="w-5 h-5" />
              Prescriptions
            </CardTitle>
            <CardDescription>Current and past prescriptions</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {prescriptions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Pill className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No prescriptions found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {prescriptions.map((rx) => (
              <div
                key={rx.id}
                className="p-4 border rounded-lg hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-muted rounded-full">
                      <Pill className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {rx.medicationName} {rx.dosage}
                      </p>
                      <p className="text-sm text-muted-foreground">{rx.genericName}</p>
                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        <span>{rx.frequency}</span>
                        <span>•</span>
                        <span>Qty: {rx.quantity}</span>
                        <span>•</span>
                        <span>{rx.refillsRemaining} refills left</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {rx.pharmacyName}
                      </p>
                      {rx.instructions && (
                        <p className="text-sm text-muted-foreground mt-2 italic">
                          &ldquo;{rx.instructions}&rdquo;
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge
                      variant="outline"
                      className={statusConfig[rx.status]?.className || ''}
                    >
                      {statusConfig[rx.status]?.label || rx.status}
                    </Badge>
                    <p className="text-sm text-muted-foreground mt-2">
                      Prescribed {formatDate(rx.prescribedAt)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Documents Tab Content
 */
function DocumentsTab({ documents: docsProp }: { documents: PhysicianPatientDetail['documents'] }) {
  const documents = docsProp ?? [];
  
  const categoryLabels: Record<string, string> = {
    INSURANCE: 'Insurance',
    IDENTIFICATION: 'ID',
    MEDICAL_RECORD: 'Medical Record',
    LAB_RESULT: 'Lab Result',
    OTHER: 'Other',
  };

  const categoryColors: Record<string, string> = {
    INSURANCE: 'bg-blue-100 text-blue-800',
    IDENTIFICATION: 'bg-green-100 text-green-800',
    MEDICAL_RECORD: 'bg-purple-100 text-purple-800',
    LAB_RESULT: 'bg-amber-100 text-amber-800',
    OTHER: 'bg-gray-100 text-gray-800',
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="w-5 h-5" />
              Documents
            </CardTitle>
            <CardDescription>Uploaded documents and records</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {documents.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No documents found</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="p-4 border rounded-lg hover:bg-muted/30 transition-colors group"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-muted rounded-lg">
                    <FileText className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{doc.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-xs',
                          categoryColors[doc.category] || categoryColors.OTHER
                        )}
                      >
                        {categoryLabels[doc.category] || doc.category}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatFileSize(doc.size)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Uploaded {formatDate(doc.uploadedAt)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Messages Tab Content
 */
function MessagesTab({ messages }: { messages: PhysicianPatientDetail['recentMessages'] }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Recent Messages
            </CardTitle>
            <CardDescription>Latest communications with patient</CardDescription>
          </div>
          <Button size="sm">View All Messages</Button>
        </div>
      </CardHeader>
      <CardContent>
        {messages.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No messages found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  'p-4 border rounded-lg hover:bg-muted/30 transition-colors',
                  !msg.read && msg.senderType === SenderType.PATIENT && 'border-l-4 border-l-ocean-500'
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        'p-2 rounded-full',
                        msg.senderType === SenderType.PATIENT
                          ? 'bg-blue-100 text-blue-600'
                          : 'bg-green-100 text-green-600'
                      )}
                    >
                      <MessageSquare className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">
                          {msg.senderType === SenderType.PATIENT ? 'Patient' : 'Physician'}
                        </p>
                        {!msg.read && msg.senderType === SenderType.PATIENT && (
                          <Badge variant="secondary" className="text-xs">
                            Unread
                          </Badge>
                        )}
                      </div>
                      {msg.subject && (
                        <p className="text-sm font-medium mt-1">{msg.subject}</p>
                      )}
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {msg.body}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {formatDate(msg.sentAt)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * PatientDetailView - Comprehensive patient detail with tabbed interface
 * 
 * Tabs:
 * - Overview: Demographics, medical history, treatment preferences
 * - Intakes: All intake submissions with review outcomes
 * - Prescriptions: Current and past prescriptions
 * - Notes: Physician notes with add functionality
 * - Documents: Uploaded documents
 */
export function PatientDetailView({ patient, physicianName }: PatientDetailViewProps): React.ReactElement {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="space-y-6">
      {/* Patient Header */}
      <PatientHeader patient={patient} onAddNote={() => setActiveTab('notes')} />

      {/* Info Cards */}
      <InfoCards patient={patient} />

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="w-full justify-start flex-wrap h-auto gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="intakes">Intakes</TabsTrigger>
          <TabsTrigger value="prescriptions">Prescriptions</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <DemographicsCard patient={patient} />
            <MedicalHistoryCard patient={patient} />
          </div>
          <TreatmentPreferencesCard patient={patient} />
        </TabsContent>

        {/* Intakes Tab */}
        <TabsContent value="intakes">
          <IntakesTab intakes={patient.intakes} />
        </TabsContent>

        {/* Prescriptions Tab */}
        <TabsContent value="prescriptions">
          <PrescriptionsTab prescriptions={patient.prescriptions} />
        </TabsContent>

        {/* Notes Tab */}
        <TabsContent value="notes">
          <PatientNotes
            patientId={patient.id}
            initialNotes={patient.notes || []}
            currentPhysicianName={physicianName || 'Current Physician'}
          />
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents">
          <DocumentsTab documents={patient.documents ?? []} />
        </TabsContent>

        {/* Messages Tab */}
        <TabsContent value="messages">
          <MessagesTab messages={patient.recentMessages} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default PatientDetailView;
