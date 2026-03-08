/**
 * Document Upload Component
 * 
 * Provides file upload functionality with drag-and-drop support,
 * document type selection, progress tracking, and validation.
 * 
 * @module components/patient/DocumentUpload
 */

'use client';

import * as React from 'react';
import { Upload, File, X, CheckCircle, AlertCircle, FileText, Image as ImageIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import {
  DocumentType,
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_TYPE_DESCRIPTIONS,
  UploadProgress,
  validateFile,
  uploadDocument,
} from '@/lib/patient/documents';

// ============================================================================
// Types
// ============================================================================

interface DocumentUploadProps {
  onUploadComplete: () => void;
  className?: string;
}

interface FileWithPreview {
  file: File;
  id: string;
  documentType: DocumentType;
  progress: UploadProgress;
  error?: string;
}

// ============================================================================
// Constants
// ============================================================================

const ALLOWED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/heic', 'image/heif'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// ============================================================================
// Helper Functions
// ============================================================================

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function getFileIcon(file: File): React.ReactElement {
  if (file.type === 'application/pdf') {
    return <FileText className="h-5 w-5 text-red-500" />;
  }
  if (file.type.startsWith('image/')) {
    return <ImageIcon className="h-5 w-5 text-ocean-500" />;
  }
  return <File className="h-5 w-5 text-gray-500" />;
}

// ============================================================================
// Document Type Selector
// ============================================================================

interface DocumentTypeSelectorProps {
  value: DocumentType;
  onChange: (type: DocumentType) => void;
  disabled?: boolean;
}

function DocumentTypeSelector({ value, onChange, disabled }: DocumentTypeSelectorProps): React.ReactElement {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {Object.values(DocumentType).map((type) => (
        <button
          key={type}
          type="button"
          onClick={() => onChange(type)}
          disabled={disabled}
          className={cn(
            'flex flex-col items-start p-3 rounded-lg border text-left transition-all',
            'hover:border-ocean-300 hover:bg-ocean-50/50',
            value === type 
              ? 'border-ocean-500 bg-ocean-50 ring-1 ring-ocean-500' 
              : 'border-gray-200 bg-white',
            disabled && 'opacity-50 cursor-not-allowed hover:border-gray-200 hover:bg-white'
          )}
        >
          <span className="font-medium text-sm text-gray-900">
            {DOCUMENT_TYPE_LABELS[type]}
          </span>
          <span className="text-xs text-muted-foreground mt-0.5">
            {DOCUMENT_TYPE_DESCRIPTIONS[type]}
          </span>
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// Upload Progress Component
// ============================================================================

interface UploadProgressProps {
  progress: UploadProgress;
  fileName: string;
  onCancel?: () => void;
}

function UploadProgressCard({ progress, fileName, onCancel }: UploadProgressProps): React.ReactElement {
  const getStatusText = (): string => {
    switch (progress.status) {
      case 'validating':
        return 'Validating...';
      case 'requesting_url':
        return 'Preparing upload...';
      case 'uploading':
        return `Uploading... ${progress.progress}%`;
      case 'confirming':
        return 'Finalizing...';
      case 'success':
        return 'Upload complete!';
      case 'error':
        return 'Upload failed';
      default:
        return 'Ready to upload';
    }
  };

  const getStatusIcon = (): React.ReactElement | null => {
    switch (progress.status) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-4">
      <div className="flex items-center gap-3 mb-3">
        <File className="h-5 w-5 text-gray-500" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{fileName}</p>
          <p className="text-xs text-muted-foreground">{getStatusText()}</p>
        </div>
        {getStatusIcon()}
        {progress.status !== 'success' && progress.status !== 'error' && onCancel && (
          <button
            onClick={onCancel}
            className="p-1 hover:bg-gray-200 rounded-full transition-colors"
            aria-label="Cancel upload"
          >
            <X className="h-4 w-4 text-gray-500" />
          </button>
        )}
      </div>

      {progress.status !== 'success' && progress.status !== 'error' && (
        <Progress value={progress.progress} className="h-2" />
      )}

      {progress.error && (
        <Alert variant="destructive" className="mt-3 py-2">
          <AlertDescription className="text-xs">{progress.error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function DocumentUpload({ onUploadComplete, className }: DocumentUploadProps): React.ReactElement {
  const [files, setFiles] = React.useState<FileWithPreview[]>([]);
  const [isDragging, setIsDragging] = React.useState(false);
  const [globalError, setGlobalError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Handle file selection
  const handleFileSelect = React.useCallback((selectedFiles: FileList | null) => {
    if (!selectedFiles) return;

    const newFiles: FileWithPreview[] = [];

    Array.from(selectedFiles).forEach((file) => {
      // Validate file
      const validation = validateFile(file);
      if (!validation.valid) {
        setGlobalError(validation.error || 'Invalid file');
        return;
      }

      newFiles.push({
        file,
        id: generateId(),
        documentType: DocumentType.OTHER,
        progress: { status: 'idle', progress: 0 },
      });
    });

    if (newFiles.length > 0) {
      setFiles(prev => [...prev, ...newFiles]);
      setGlobalError(null);
    }
  }, []);

  // Handle file input change
  const handleInputChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files);
    // Reset input so same file can be selected again
    e.target.value = '';
  }, [handleFileSelect]);

  // Handle drag and drop
  const handleDragEnter = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);

  // Update document type for a file
  const handleDocumentTypeChange = React.useCallback((fileId: string, documentType: DocumentType) => {
    setFiles(prev =>
      prev.map(f => (f.id === fileId ? { ...f, documentType } : f))
    );
  }, []);

  // Remove file from list
  const handleRemoveFile = React.useCallback((fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  }, []);

  // Upload all files
  const handleUpload = React.useCallback(async () => {
    if (files.length === 0) return;

    setGlobalError(null);

    // Upload files sequentially to avoid overwhelming the server
    for (const fileWithPreview of files) {
      if (fileWithPreview.progress.status === 'success') continue;

      try {
        await uploadDocument(
          fileWithPreview.file,
          fileWithPreview.documentType,
          (progress) => {
            setFiles(prev =>
              prev.map(f =>
                f.id === fileWithPreview.id ? { ...f, progress } : f
              )
            );
          }
        );
      } catch (error) {
        setFiles(prev =>
          prev.map(f =>
            f.id === fileWithPreview.id
              ? {
                  ...f,
                  progress: {
                    status: 'error',
                    progress: 0,
                    error: error instanceof Error ? error.message : 'Upload failed',
                  },
                }
              : f
          )
        );
      }
    }

    // Check if all uploads succeeded
    const allSuccessful = files.every(
      f => f.progress.status === 'success' || f.progress.status === 'error'
    );
    const anySuccessful = files.some(f => f.progress.status === 'success');

    if (anySuccessful) {
      onUploadComplete();
    }
  }, [files, onUploadComplete]);

  // Check if any files are ready to upload
  const hasFiles = files.length > 0;
  const hasUnuploadedFiles = files.some(f => f.progress.status !== 'success');
  const isUploading = files.some(
    f => f.progress.status === 'uploading' || f.progress.status === 'requesting_url' || f.progress.status === 'confirming'
  );

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <CardTitle>Upload Documents</CardTitle>
        <CardDescription>
          Upload your ID, insurance card, or medical records. 
          Accepted formats: PDF, JPEG, PNG, HEIC (max 10MB).
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Global Error */}
        {globalError && (
          <Alert variant="destructive">
            <AlertDescription>{globalError}</AlertDescription>
          </Alert>
        )}

        {/* Drag and Drop Zone */}
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className={cn(
            'relative rounded-xl border-2 border-dashed p-8 transition-all cursor-pointer',
            'flex flex-col items-center justify-center text-center',
            isDragging
              ? 'border-ocean-500 bg-ocean-50'
              : 'border-gray-300 hover:border-ocean-400 hover:bg-gray-50',
            isUploading && 'pointer-events-none opacity-50'
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ALLOWED_FILE_TYPES.join(',')}
            onChange={handleInputChange}
            className="hidden"
            disabled={isUploading}
          />
          
          <div className={cn(
            'w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-colors',
            isDragging ? 'bg-ocean-100' : 'bg-gray-100'
          )}>
            <Upload className={cn(
              'h-8 w-8 transition-colors',
              isDragging ? 'text-ocean-600' : 'text-gray-500'
            )} />
          </div>
          
          <p className="text-sm font-medium text-gray-900 mb-1">
            {isDragging ? 'Drop files here' : 'Drag and drop files here'}
          </p>
          <p className="text-xs text-muted-foreground">
            or click to browse (PDF, JPEG, PNG, HEIC up to 10MB)
          </p>
        </div>

        {/* Selected Files List */}
        {hasFiles && (
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-gray-900">
              Selected Files ({files.length})
            </h4>

            <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
              {files.map((fileWithPreview) => (
                <div
                  key={fileWithPreview.id}
                  className="rounded-lg border border-gray-200 p-4 space-y-3"
                >
                  {/* File Header */}
                  <div className="flex items-center gap-3">
                    {getFileIcon(fileWithPreview.file)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {fileWithPreview.file.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(fileWithPreview.file.size)}
                      </p>
                    </div>
                    {fileWithPreview.progress.status !== 'success' && (
                      <button
                        onClick={() => handleRemoveFile(fileWithPreview.id)}
                        disabled={isUploading}
                        className="p-1 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50"
                        aria-label="Remove file"
                      >
                        <X className="h-4 w-4 text-gray-500" />
                      </button>
                    )}
                  </div>

                  {/* Document Type Selector */}
                  {fileWithPreview.progress.status === 'idle' && (
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-gray-700">
                        Document Type
                      </label>
                      <DocumentTypeSelector
                        value={fileWithPreview.documentType}
                        onChange={(type) => handleDocumentTypeChange(fileWithPreview.id, type)}
                        disabled={isUploading}
                      />
                    </div>
                  )}

                  {/* Upload Progress */}
                  {fileWithPreview.progress.status !== 'idle' && (
                    <UploadProgressCard
                      progress={fileWithPreview.progress}
                      fileName={fileWithPreview.file.name}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Upload Button */}
            {hasUnuploadedFiles && (
              <Button
                onClick={handleUpload}
                disabled={isUploading}
                className="w-full"
              >
                {isUploading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Uploading...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    Upload {files.length} {files.length === 1 ? 'File' : 'Files'}
                  </span>
                )}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
