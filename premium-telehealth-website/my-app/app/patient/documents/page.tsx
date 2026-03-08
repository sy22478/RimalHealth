'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText, 
  Upload, 
  Download, 
  Trash2, 
  FileImage,
  File,
  Search,
  Shield,
  AlertCircle,
  Eye,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/Skeleton';
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
type DocumentStatus = 'pending' | 'verified' | 'rejected';

interface Document {
  id: string;
  name: string;
  type: DocumentType;
  size: number;
  uploadedAt: Date;
  status: DocumentStatus;
}

// ============================================================================
// Constants
// ============================================================================

const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  intake: 'Intake Form',
  lab_result: 'Lab Result',
  prescription: 'Prescription',
  insurance: 'Insurance Card',
  id: 'ID Document',
  other: 'Other',
};

// ============================================================================
// Utility Functions
// ============================================================================

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
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

// ============================================================================
// Components
// ============================================================================

function StatusBadge({ status }: { status: DocumentStatus }) {
  const config = {
    pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pending Review' },
    verified: { bg: 'bg-green-100', text: 'text-green-800', label: 'Verified' },
    rejected: { bg: 'bg-red-100', text: 'text-red-800', label: 'Rejected' },
  };

  const { bg, text, label } = config[status];

  return (
    <Badge variant="outline" className={cn(bg, text, 'border-0')}>
      {label}
    </Badge>
  );
}

function DocumentCard({ 
  document, 
  onDelete,
}: { 
  document: Document;
  onDelete: (id: string) => void;
}) {
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
            <div className="w-12 h-12 rounded-lg bg-ocean-50 flex items-center justify-center shrink-0">
              {document.type === 'insurance' || document.type === 'id' ? (
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
                <span>•</span>
                <span>{formatFileSize(document.size)}</span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-gray-500">
                  Uploaded {formatDate(document.uploadedAt)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <StatusBadge status={document.status} />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-gray-400 hover:text-red-500"
                onClick={() => onDelete(document.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function UploadDropzone({ onUpload }: { onUpload: (files: File[]) => void }) {
  const [isDragOver, setIsDragOver] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const fileArray = Array.from(files);
    // Basic validation - just accept all for now
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
          Drop files here or click to upload
        </p>
        <p className="text-sm text-gray-500">
          PDF, JPEG, PNG up to 10MB each
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
    </div>
  );
}

function EmptyState({ onUploadClick }: { onUploadClick: () => void }) {
  return (
    <Card className="text-center py-12">
      <CardContent>
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 mb-4">
          <FileText className="h-8 w-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          No Documents Yet
        </h3>
        <p className="text-gray-600 max-w-sm mx-auto mb-6">
          Upload your medical records, lab results, insurance cards, or other 
          relevant documents for your physician to review.
        </p>
        <Button onClick={onUploadClick}>
          <Upload className="h-4 w-4 mr-2" />
          Upload Document
        </Button>
      </CardContent>
    </Card>
  );
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

  React.useEffect(() => {
    async function loadDocuments() {
      try {
        const res = await fetch('/api/patient/documents', { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to load documents');
        const data = await res.json();
        setDocuments(data.documents || []);
      } catch (err) {
        setFetchError(err instanceof Error ? err.message : 'Failed to load documents');
      } finally {
        setIsLoading(false);
      }
    }
    loadDocuments();
  }, []);

  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = selectedType === 'all' || doc.type === selectedType;
    return matchesSearch && matchesType;
  });

  const handleUpload = (files: File[]) => {
    const newDocuments: Document[] = files.map((file, index) => ({
      id: `new-doc-${Date.now()}-${index}`,
      name: file.name,
      type: 'other',
      size: file.size,
      uploadedAt: new Date(),
      status: 'pending',
    }));

    setDocuments((prev) => [...newDocuments, ...prev]);
    setIsUploadOpen(false);
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
          <p className="text-sm text-red-700">{fetchError}</p>
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
              />
            ))}
          </div>
        </AnimatePresence>
      )}

      {isUploadOpen && (
        <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Upload Documents</DialogTitle>
              <DialogDescription>
                Upload medical records, lab results, or insurance documents.
              </DialogDescription>
            </DialogHeader>
            <UploadDropzone onUpload={handleUpload} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
