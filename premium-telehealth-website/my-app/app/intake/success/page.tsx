'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  CheckCircle,
  Clock,
  MessageSquare,
  Pill,
  ArrowRight,
  Calendar,
  Shield,
  Upload,
  FileImage,
  AlertCircle,
  Loader2,
  X,
  Camera,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// ============================================================================
// Timeline Steps
// ============================================================================

interface TimelineStep {
  icon: React.ElementType;
  title: string;
  description: string;
  status: 'complete' | 'current' | 'upcoming';
}

const timelineSteps: TimelineStep[] = [
  {
    icon: CheckCircle,
    title: 'Intake Submitted',
    description: 'Your information has been received',
    status: 'complete',
  },
  {
    icon: Clock,
    title: 'Physician Review',
    description: 'A California-licensed physician will review within 24 hours',
    status: 'current',
  },
  {
    icon: MessageSquare,
    title: 'Treatment Plan',
    description: 'You\'ll receive a message with your personalized plan',
    status: 'upcoming',
  },
  {
    icon: Pill,
    title: 'Prescription Sent',
    description: 'If prescribed, medication goes to your pharmacy',
    status: 'upcoming',
  },
];

// ============================================================================
// Next Steps Data
// ============================================================================

const nextSteps = [
  {
    icon: MessageSquare,
    title: 'Check Your Messages',
    description: 'We\'ll send updates here as your intake is reviewed',
    action: 'View Messages',
    href: '/patient/messages',
  },
  {
    icon: Calendar,
    title: 'Review Timeline',
    description: 'Most intakes are reviewed within 24 hours',
    action: 'View Dashboard',
    href: '/patient/dashboard',
  },
  {
    icon: Shield,
    title: 'Your Information is Secure',
    description: 'All data is encrypted and HIPAA-compliant',
    action: 'Learn More',
    href: '/hipaa',
  },
];

// ============================================================================
// Government ID Upload Component
// ============================================================================

type UploadState = 'idle' | 'uploading' | 'success' | 'error';

const ACCEPTED_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/heic',
  'image/heif',
  'application/pdf',
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function GovernmentIdUpload() {
  const [uploadState, setUploadState] = React.useState<UploadState>('idle');
  const [error, setError] = React.useState<string | null>(null);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Check if user already has a government ID document on mount
  React.useEffect(() => {
    fetch('/api/patient/documents', { credentials: 'include' })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.documents) {
          const hasIdDoc = data.documents.some(
            (doc: { documentType?: string; status?: string }) =>
              doc.documentType === 'ID_VERIFICATION' && doc.status !== 'DELETED'
          );
          if (hasIdDoc) {
            setUploadState('success');
          }
        }
      })
      .catch(() => { /* non-critical check, ignore errors */ });
  }, []);

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    setError(null);

    // Validate file type
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Please upload a JPEG, PNG, HEIC, or PDF file.');
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setError('File size must be less than 10MB.');
      return;
    }

    setSelectedFile(file);

    // Generate preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewUrl(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setPreviewUrl(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploadState('uploading');
    setError(null);

    try {
      // Upload file directly to server (Netlify Blobs)
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('documentType', 'ID_VERIFICATION');

      const uploadRes = await fetch('/api/patient/documents/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to upload file');
      }

      setUploadState('success');
    } catch (err) {
      setUploadState('error');
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setError(null);
    setUploadState('idle');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (uploadState === 'success') {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-green-100 rounded-lg shrink-0">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h3 className="font-medium text-green-900 mb-1">
                Government ID Uploaded Successfully
              </h3>
              <p className="text-sm text-green-700">
                Your ID has been securely uploaded and will be reviewed by your physician.
                You can view it anytime in your{' '}
                <Link href="/patient/documents" className="underline font-medium">
                  Documents
                </Link>
                {' '}tab.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-amber-200 bg-amber-50/50">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="p-2 bg-amber-100 rounded-lg shrink-0">
            <Camera className="h-5 w-5 text-amber-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 mb-1">
              Upload Your Government-Issued ID
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              A photo of your government ID (driver&apos;s license, state ID, or passport) helps
              verify your identity for prescribing purposes. This is optional now but will be
              needed before a prescription can be issued.
            </p>

            {!selectedFile ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
                  'border-amber-300 hover:border-amber-400 bg-white'
                )}
              >
                <Upload className="h-8 w-8 text-amber-500 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-900 mb-1">
                  Click to select your ID photo
                </p>
                <p className="text-xs text-gray-500">
                  JPEG, PNG, HEIC, or PDF up to 10MB
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_TYPES.join(',')}
                  onChange={(e) => handleFileSelect(e.target.files)}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="space-y-3">
                {/* File preview */}
                <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="ID preview"
                      className="w-16 h-12 object-cover rounded border border-gray-200"
                    />
                  ) : (
                    <div className="w-16 h-12 bg-gray-100 rounded flex items-center justify-center">
                      <FileImage className="h-6 w-6 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{selectedFile.name}</p>
                    <p className="text-xs text-gray-500">
                      {(selectedFile.size / 1024).toFixed(0)} KB
                    </p>
                  </div>
                  {uploadState !== 'uploading' && (
                    <button
                      onClick={handleRemoveFile}
                      className="p-1 text-gray-400 hover:text-red-500"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Upload button */}
                <div className="flex gap-3">
                  <Button
                    onClick={handleUpload}
                    disabled={uploadState === 'uploading'}
                    className="bg-ocean-500 hover:bg-ocean-600 text-white"
                  >
                    {uploadState === 'uploading' ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading securely...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload ID
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {error && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <p className="text-xs text-gray-400 mt-3 flex items-center gap-1">
              <Shield className="h-3 w-3" />
              Your ID is encrypted and stored in HIPAA-compliant secure storage.
              You can also upload it later from the Documents tab.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Success Page
// ============================================================================

export default function IntakeSuccessPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Success Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100 mb-6">
            <CheckCircle className="h-10 w-10 text-green-600" />
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-3">
            Intake Form Submitted!
          </h1>

          <p className="text-lg text-gray-600 max-w-xl mx-auto">
            Thank you for completing your intake form. A California-licensed physician
            will review your information within 24 hours.
          </p>
        </motion.div>

        {/* Government ID Upload */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="mb-10"
        >
          <GovernmentIdUpload />
        </motion.div>

        {/* Timeline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mb-10"
        >
          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">
                What Happens Next
              </h2>

              <div className="relative">
                {/* Timeline Line */}
                <div className="absolute left-5 top-8 bottom-8 w-0.5 bg-gray-200" />

                <div className="space-y-6">
                  {timelineSteps.map((step, index) => (
                    <motion.div
                      key={step.title}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: 0.2 + index * 0.1 }}
                      className="relative flex items-start gap-4"
                    >
                      {/* Icon */}
                      <div
                        className={cn(
                          'relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 shrink-0',
                          step.status === 'complete' && 'bg-green-500 border-green-500',
                          step.status === 'current' && 'bg-ocean-500 border-ocean-500',
                          step.status === 'upcoming' && 'bg-white border-gray-300'
                        )}
                      >
                        <step.icon
                          className={cn(
                            'h-5 w-5',
                            step.status === 'complete' && 'text-white',
                            step.status === 'current' && 'text-white',
                            step.status === 'upcoming' && 'text-gray-400'
                          )}
                        />
                      </div>

                      {/* Content */}
                      <div className="flex-1 pt-1">
                        <h3
                          className={cn(
                            'font-medium',
                            step.status === 'upcoming' ? 'text-gray-500' : 'text-gray-900'
                          )}
                        >
                          {step.title}
                        </h3>
                        <p
                          className={cn(
                            'text-sm mt-0.5',
                            step.status === 'upcoming' ? 'text-gray-400' : 'text-gray-600'
                          )}
                        >
                          {step.description}
                        </p>
                      </div>

                      {/* Status Indicator */}
                      {step.status === 'complete' && (
                        <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded">
                          Done
                        </span>
                      )}
                      {step.status === 'current' && (
                        <span className="text-xs font-medium text-ocean-600 bg-ocean-50 px-2 py-1 rounded">
                          Now
                        </span>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Next Steps Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mb-10"
        >
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            What You Can Do Now
          </h2>

          <div className="grid gap-4 sm:grid-cols-3">
            {nextSteps.map((step) => (
              <Card
                key={step.title}
                className="hover:shadow-md transition-shadow"
              >
                <CardContent className="p-4">
                  <step.icon className="h-8 w-8 text-ocean-500 mb-3" />
                  <h3 className="font-medium text-gray-900 mb-1">
                    {step.title}
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    {step.description}
                  </p>
                  <Link
                    href={step.href}
                    className="text-sm font-medium text-ocean-600 hover:text-ocean-700 inline-flex items-center gap-1"
                  >
                    {step.action}
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </motion.div>

        {/* Important Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-blue-100 rounded-lg shrink-0">
                  <Shield className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-medium text-blue-900 mb-2">
                    Important Information
                  </h3>
                  <ul className="text-sm text-blue-800 space-y-2 list-disc list-inside">
                    <li>Keep your phone available in case the physician needs to contact you</li>
                    <li>Check your email (including spam folder) for updates</li>
                    <li>If you have urgent questions, you can message your physician</li>
                    <li>Do not stop or change any current medications without consulting your doctor</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Primary CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="mt-10 text-center"
        >
          <Link href="/patient/dashboard">
            <Button
              size="lg"
              className="bg-gradient-to-r from-navy-500 to-ocean-500 hover:from-navy-600 hover:to-ocean-500 text-white"
            >
              Go to My Dashboard
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
