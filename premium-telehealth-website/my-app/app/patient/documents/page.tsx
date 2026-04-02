'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Upload,
  Download,
  Trash2,
  FileImage,
  Search,
  Shield,
  AlertCircle,
  Eye,
  Loader2,
  ClipboardList,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

type DocumentType = 'intake' | 'lab_result' | 'prescription' | 'insurance' | 'id' | 'other';
type DocumentStatus = 'pending' | 'verified' | 'rejected' | 'active';

interface Document {
  id: string;
  name: string;
  type: DocumentType;
  size: number;
  uploadedAt: Date;
  status: DocumentStatus;
  intakeId?: string | null;
  documentType?: string;
}

interface IntakeFormData {
  [key: string]: unknown;
}

// ============================================================================
// Constants
// ============================================================================

const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  intake: 'Intake Form',
  lab_result: 'Lab Result',
  prescription: 'Prescription',
  insurance: 'Insurance Card',
  id: 'Government ID',
  other: 'Other',
};

/** Map Prisma DocumentType enum values to frontend display types */
const API_TYPE_MAP: Record<string, DocumentType> = {
  ID_VERIFICATION: 'id',
  INSURANCE_CARD: 'insurance',
  MEDICAL_RECORD: 'lab_result',
  CONSENT_FORM: 'other',
  INTAKE_FORM: 'intake',
  OTHER: 'other',
};

// ============================================================================
// Utility Functions
// ============================================================================

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '\u2014';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function mapApiDocument(doc: Record<string, unknown>): Document {
  const rawType = (doc.documentType as string) || 'OTHER';
  return {
    id: doc.id as string,
    name: (doc.fileName as string) || 'Untitled',
    type: API_TYPE_MAP[rawType] || 'other',
    size: (doc.fileSize as number) || 0,
    uploadedAt: new Date(doc.uploadedAt as string),
    status: ((doc.status as string) || 'active').toLowerCase() as DocumentStatus,
    intakeId: (doc.intakeId as string | null) || null,
    documentType: rawType,
  };
}

// ============================================================================
// DSM-5 field labels for readable intake display
// ============================================================================

const INTAKE_FIELD_LABELS: Record<string, string> = {
  firstName: 'First Name',
  lastName: 'Last Name',
  dateOfBirth: 'Date of Birth',
  phone: 'Phone',
  email: 'Email',
  addressStreet: 'Street Address',
  addressCity: 'City',
  addressState: 'State',
  addressZip: 'ZIP Code',
  gender: 'Gender',
  age: 'Age',
  treatmentType: 'Treatment Type',
  primaryConcern: 'Primary Concern',
  treatmentGoal: 'Treatment Goal',
  dsm5Q1: '1. Consumed larger amounts or over longer periods than intended',
  dsm5Q2: '2. Persistent desire or unsuccessful efforts to cut down',
  dsm5Q3: '3. Great deal of time spent obtaining, using, or recovering',
  dsm5Q4: '4. Craving or strong desire to use alcohol',
  dsm5Q5: '5. Recurrent use resulting in failure to fulfill obligations',
  dsm5Q6: '6. Continued use despite persistent social/interpersonal problems',
  dsm5Q7: '7. Important activities given up or reduced',
  dsm5Q8: '8. Recurrent use in physically hazardous situations',
  dsm5Q9: '9. Continued use despite knowledge of physical/psychological problems',
  dsm5Q10: '10. Tolerance (need for increased amounts)',
  dsm5Q11: '11. Withdrawal symptoms',
  drinkingFrequency: 'Drinking Frequency',
  drinksPerOccasion: 'Drinks Per Occasion',
  lastDrinkDate: 'Last Drink Date',
  previousTreatment: 'Previous Treatment',
  previousTreatmentDetails: 'Previous Treatment Details',
  withdrawalSeizure: 'History of Withdrawal Seizures',
  withdrawalDTs: 'History of Delirium Tremens',
  withdrawalHospitalized: 'Previously Hospitalized for Withdrawal',
  morningDrinking: 'Morning Drinking',
  medicalHistory: 'Medical History',
  liverCondition: 'Liver Condition',
  liverTests: 'Recent Liver Tests',
  pregnancyStatus: 'Pregnancy Status',
  currentMedications: 'Currently Taking Medications',
  medicationList: 'Medication List',
  medicationAllergies: 'Medication Allergies',
  drugAllergies: 'Drug Allergies',
  opioidUse: 'Current Opioid Use',
  opioidMaintenance: 'On Opioid Maintenance Therapy',
  mentalHealthConditions: 'Mental Health Conditions',
  suicidalIdeation: 'Suicidal Ideation',
  emergencyContactName: 'Emergency Contact Name',
  emergencyContactPhone: 'Emergency Contact Phone',
  emergencyContactRelation: 'Emergency Contact Relationship',
  preferredPharmacy: 'Preferred Pharmacy',
};

const HIDDEN_FIELDS = new Set([
  '_providerDecisionSummary',
  'treatmentType',
]);

// ============================================================================
// Components
// ============================================================================

function StatusBadge({ status }: { status: DocumentStatus }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pending Review' },
    verified: { bg: 'bg-green-100', text: 'text-green-800', label: 'Verified' },
    rejected: { bg: 'bg-red-100', text: 'text-red-800', label: 'Rejected' },
    active: { bg: 'bg-green-100', text: 'text-green-800', label: 'Active' },
  };

  const { bg, text, label } = config[status] || config.active;

  return (
    <Badge variant="outline" className={cn(bg, text, 'border-0')}>
      {label}
    </Badge>
  );
}

function DocumentCard({
  document,
  onDelete,
  onView,
  onDownload,
}: {
  document: Document;
  onDelete: (id: string) => void;
  onView?: (doc: Document) => void;
  onDownload?: (doc: Document) => void;
}) {
  const isIntakeForm = document.type === 'intake';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="group hover:shadow-md transition-all">
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <div className={cn(
              'w-12 h-12 rounded-lg flex items-center justify-center shrink-0',
              isIntakeForm ? 'bg-purple-50' : 'bg-ocean-50'
            )}>
              {isIntakeForm ? (
                <ClipboardList className="h-6 w-6 text-purple-600" />
              ) : document.type === 'insurance' || document.type === 'id' ? (
                <FileImage className="h-6 w-6 text-ocean-600" />
              ) : (
                <FileText className="h-6 w-6 text-ocean-600" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-gray-900 truncate" title={document.name}>
                {document.name}
              </h3>
              <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                <span>{DOCUMENT_TYPE_LABELS[document.type]}</span>
                {document.size > 0 && (
                  <>
                    <span>&bull;</span>
                    <span>{formatFileSize(document.size)}</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-gray-500">
                  {isIntakeForm ? 'Submitted' : 'Uploaded'} {formatDate(document.uploadedAt)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <StatusBadge status={document.status} />
              {isIntakeForm && onView ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-purple-500 hover:text-purple-700"
                  onClick={() => onView(document)}
                  title="View intake form"
                >
                  <Eye className="h-4 w-4" />
                </Button>
              ) : (
                <>
                  {onDownload && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-gray-400 hover:text-ocean-600"
                      onClick={() => onDownload(document)}
                      title="Download"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-gray-400 hover:text-red-500"
                    onClick={() => onDelete(document.id)}
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function UploadDropzone({
  onUpload,
  accept,
  label,
  description,
}: {
  onUpload: (files: File[]) => void;
  accept?: string;
  label?: string;
  description?: string;
}) {
  const [isDragOver, setIsDragOver] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const fileArray = Array.from(files);
    onUpload(fileArray);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
          isDragOver
            ? 'border-ocean-500 bg-ocean-50'
            : 'border-gray-300 hover:border-gray-400 bg-gray-50'
        )}
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white mb-4">
          <Upload className="h-6 w-6 text-ocean-500" />
        </div>
        <p className="font-medium text-gray-900 mb-1">
          {label || 'Drop files here or click to upload'}
        </p>
        <p className="text-sm text-gray-500">
          {description || 'PDF, JPEG, PNG up to 10MB each'}
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={accept}
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />
      </div>
    </div>
  );
}

function EmptyState({ onUploadClick }: { onUploadClick: () => void }) {
  return (
    <div className="border-dashed border-2 border-gray-200 rounded-xl text-center py-16 px-6">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-ocean-50 mb-6">
        <FileText className="h-10 w-10 text-ocean-400" />
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">
        No documents yet
      </h3>
      <p className="text-gray-500 max-w-md mx-auto mb-8">
        Upload your medical records, lab results, insurance cards, or other
        relevant documents for your physician to review.
      </p>
      <Button onClick={onUploadClick} className="bg-ocean-500 hover:bg-ocean-600 text-white">
        <Upload className="h-4 w-4 mr-2" />
        Upload Your First Document
      </Button>
    </div>
  );
}

/** Read-only viewer for intake form data */
function IntakeFormViewer({
  intakeId,
  open,
  onClose,
}: {
  intakeId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [formData, setFormData] = React.useState<IntakeFormData | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open || !intakeId) return;

    setLoading(true);
    setError(null);

    fetch(`/api/patient/intake/${intakeId}`, { credentials: 'include' })
      .then(res => {
        if (!res.ok) throw new Error('Failed to load intake data');
        return res.json();
      })
      .then(data => {
        setFormData((data.intake?.formData || {}) as IntakeFormData);
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : 'Failed to load intake data');
      })
      .finally(() => setLoading(false));
  }, [open, intakeId]);

  function renderValue(value: unknown): string {
    if (value === null || value === undefined || value === '') return '\u2014';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (Array.isArray(value)) return value.join(', ') || '\u2014';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-purple-600" />
            Submitted Intake Form
          </DialogTitle>
          <DialogDescription>
            Read-only view of your submitted intake form responses.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-ocean-500" />
            <span className="ml-2 text-gray-600">Loading intake data...</span>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {formData && !loading && (
          <div className="space-y-3 mt-2">
            {Object.entries(formData)
              .filter(([key]) => !HIDDEN_FIELDS.has(key))
              .map(([key, value]) => (
                <div key={key} className="flex flex-col sm:flex-row sm:gap-4 py-2 border-b border-gray-100 last:border-0">
                  <dt className="text-sm font-medium text-gray-700 sm:w-1/3 shrink-0">
                    {INTAKE_FIELD_LABELS[key] || key}
                  </dt>
                  <dd className="text-sm text-gray-900 sm:w-2/3 mt-1 sm:mt-0 whitespace-pre-wrap break-words">
                    {renderValue(value)}
                  </dd>
                </div>
              ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Upload Flow Helpers
// ============================================================================

async function uploadDocumentToS3(
  file: File,
  documentType: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    // Step 1: Get presigned upload URL
    const urlRes = await fetch('/api/patient/documents/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        fileName: file.name,
        contentType: file.type,
        documentType,
        fileSize: file.size,
      }),
    });

    if (!urlRes.ok) {
      const err = await urlRes.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to get upload URL');
    }

    const { uploadUrl, key } = await urlRes.json();

    // Step 2: Upload file directly to S3
    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type,
        'x-amz-server-side-encryption': 'AES256',
      },
      body: file,
    });

    if (!uploadRes.ok) {
      throw new Error('Failed to upload file to storage');
    }

    // Step 3: Confirm upload (create DB record)
    const confirmRes = await fetch('/api/patient/documents/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        key,
        documentType,
      }),
    });

    if (!confirmRes.ok) {
      const err = await confirmRes.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to confirm upload');
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Upload failed',
    };
  }
}

// ============================================================================
// Main Documents Page
// ============================================================================

export default function DocumentsPage() {
  const [documents, setDocuments] = React.useState<Document[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [fetchError, setFetchError] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedType, setSelectedType] = React.useState<DocumentType | 'all'>('all');
  const [isUploadOpen, setIsUploadOpen] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [selectedUploadType, setSelectedUploadType] = React.useState('OTHER');

  // Intake viewer state
  const [viewingIntakeId, setViewingIntakeId] = React.useState<string | null>(null);

  const loadDocuments = React.useCallback(async () => {
    try {
      const res = await fetch('/api/patient/documents', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load documents');
      const data = await res.json();
      const mapped = (data.documents || []).map((doc: Record<string, unknown>) => mapApiDocument(doc));
      setDocuments(mapped);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = selectedType === 'all' || doc.type === selectedType;
    return matchesSearch && matchesType;
  });

  const handleUpload = async (files: File[]) => {
    setIsUploading(true);
    setUploadError(null);

    const errors: string[] = [];

    for (const file of files) {
      const result = await uploadDocumentToS3(file, selectedUploadType);
      if (!result.success) {
        errors.push(`${file.name}: ${result.error}`);
      }
    }

    setIsUploading(false);

    if (errors.length > 0) {
      setUploadError(errors.join('\n'));
    } else {
      setIsUploadOpen(false);
      // Refresh document list
      await loadDocuments();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;
    try {
      const res = await fetch(`/api/patient/documents/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to delete document');
      setDocuments(prev => prev.filter(d => d.id !== id));
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to delete document');
    }
  };

  const handleDownload = async (doc: Document) => {
    try {
      const res = await fetch(`/api/patient/documents/${doc.id}/download`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to generate download link');
      const data = await res.json();
      // Open the presigned download URL in a new tab
      window.open(data.downloadUrl, '_blank');
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to download document');
    }
  };

  const handleViewIntake = (doc: Document) => {
    if (doc.intakeId) {
      setViewingIntakeId(doc.intakeId);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
          <p className="text-gray-600 mt-1">Manage your medical records and files</p>
        </div>
        <Button onClick={() => setIsUploadOpen(true)}>
          <Upload className="h-4 w-4 mr-2" />
          Upload Document
        </Button>
      </div>

      {fetchError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-red-700">{fetchError}</p>
            <button
              className="text-sm text-red-600 underline mt-1"
              onClick={() => setFetchError(null)}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <Card className="mb-6 bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
            <div>
              <h3 className="font-medium text-blue-900">Secure Document Storage</h3>
              <p className="text-sm text-blue-700 mt-0.5">
                All documents are encrypted and stored in compliance with HIPAA regulations.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value as DocumentType | 'all')}
          className="border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ocean-500"
        >
          <option value="all">All Types</option>
          {Object.entries(DOCUMENT_TYPE_LABELS).map(([type, label]) => (
            <option key={type} value={type}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {filteredDocuments.length === 0 ? (
        <EmptyState onUploadClick={() => setIsUploadOpen(true)} />
      ) : (
        <AnimatePresence mode="popLayout">
          <div className="space-y-3">
            {filteredDocuments.map((document) => (
              <DocumentCard
                key={document.id}
                document={document}
                onDelete={handleDelete}
                onView={document.type === 'intake' ? handleViewIntake : undefined}
                onDownload={document.type !== 'intake' ? handleDownload : undefined}
              />
            ))}
          </div>
        </AnimatePresence>
      )}

      {/* Upload Dialog */}
      <Dialog open={isUploadOpen} onOpenChange={(open) => { setIsUploadOpen(open); if (!open) setSelectedUploadType('OTHER'); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Documents</DialogTitle>
            <DialogDescription>
              Upload medical records, lab results, insurance documents, or a government ID.
            </DialogDescription>
          </DialogHeader>
          {isUploading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-ocean-500" />
              <span className="ml-2 text-gray-600">Uploading...</span>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label htmlFor="upload-doc-type" className="block text-sm font-medium text-gray-700 mb-1">
                  Document Type
                </label>
                <select
                  id="upload-doc-type"
                  value={selectedUploadType}
                  onChange={(e) => setSelectedUploadType(e.target.value)}
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ocean-500"
                >
                  <option value="ID_VERIFICATION">Government ID</option>
                  <option value="INSURANCE_CARD">Insurance Card</option>
                  <option value="MEDICAL_RECORD">Lab Result / Medical Record</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <UploadDropzone onUpload={handleUpload} />
            </div>
          )}
          {uploadError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
              <p className="text-sm text-red-700 whitespace-pre-wrap">{uploadError}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Intake Form Viewer */}
      {viewingIntakeId && (
        <IntakeFormViewer
          intakeId={viewingIntakeId}
          open={!!viewingIntakeId}
          onClose={() => setViewingIntakeId(null)}
        />
      )}
    </div>
  );
}
