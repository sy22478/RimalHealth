'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, 
  X, 
  File, 
  FileImage, 
  FileText, 
  CheckCircle, 
  AlertCircle,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface FileWithPreview extends File {
  preview?: string;
  id: string;
  progress: number;
  status: 'uploading' | 'completed' | 'error';
  error?: string;
}

interface DocumentUploaderProps {
  onUpload: (files: File[]) => Promise<void>;
  onRemove?: (fileId: string) => void;
  maxFiles?: number;
  maxFileSize?: number; // in bytes
  acceptedTypes?: string[];
  className?: string;
  label?: string;
  description?: string;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const DEFAULT_ACCEPTED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/webp',
];

const FILE_TYPE_ICONS: Record<string, React.ElementType> = {
  'application/pdf': FileText,
  'image/jpeg': FileImage,
  'image/png': FileImage,
  'image/heic': FileImage,
  'image/webp': FileImage,
  default: File,
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

function getFileIcon(type: string): React.ElementType {
  return FILE_TYPE_ICONS[type] || FILE_TYPE_ICONS.default;
}

function generateFileId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// Components
// ============================================================================

// Render icon element directly to avoid creating components during render
function renderFileIcon(iconType: string, className?: string): React.ReactElement {
  const IconComponent = getFileIcon(iconType);
  return <IconComponent className={className} />;
}

function FilePreviewComponent({ 
  file, 
  onRemove 
}: { 
  file: FileWithPreview; 
  onRemove: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="bg-gray-50 rounded-lg p-3 border border-gray-200"
    >
      <div className="flex items-start gap-3">
        {/* Icon or Preview */}
        <div className="shrink-0">
          {file.preview ? (
            <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100">
              <img
                src={file.preview}
                alt={file.name}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-12 h-12 rounded-lg bg-ocean-50 flex items-center justify-center">
              {renderFileIcon(file.type, 'h-6 w-6 text-ocean-600')}
            </div>
          )}
        </div>

        {/* File Info */}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-gray-900 truncate" title={file.name}>
            {file.name}
          </p>
          <p className="text-xs text-gray-500">
            {formatFileSize(file.size)}
          </p>

          {/* Progress */}
          {file.status === 'uploading' && (
            <div className="mt-2">
              <Progress value={file.progress} className="h-1" />
              <p className="text-xs text-gray-500 mt-1">
                {file.progress}%
              </p>
            </div>
          )}

          {/* Status */}
          {file.status === 'completed' && (
            <div className="flex items-center gap-1 mt-1">
              <CheckCircle className="h-3 w-3 text-green-500" />
              <span className="text-xs text-green-600">Uploaded</span>
            </div>
          )}

          {file.status === 'error' && (
            <div className="flex items-center gap-1 mt-1">
              <AlertCircle className="h-3 w-3 text-red-500" />
              <span className="text-xs text-red-600">{file.error || 'Upload failed'}</span>
            </div>
          )}
        </div>

        {/* Remove Button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-gray-400 hover:text-red-500"
          onClick={onRemove}
          disabled={file.status === 'uploading'}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function DocumentUploader({
  onUpload,
  onRemove,
  maxFiles = 5,
  maxFileSize = DEFAULT_MAX_FILE_SIZE,
  acceptedTypes = DEFAULT_ACCEPTED_TYPES,
  className,
  label = 'Upload Documents',
  description = 'Drag and drop files here, or click to select files',
}: DocumentUploaderProps) {
  const [files, setFiles] = React.useState<FileWithPreview[]>([]);
  const [isDragOver, setIsDragOver] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    if (!acceptedTypes.includes(file.type)) {
      return `Invalid file type. Accepted: ${acceptedTypes.map(t => t.split('/')[1].toUpperCase()).join(', ')}`;
    }
    if (file.size > maxFileSize) {
      return `File too large. Maximum size is ${formatFileSize(maxFileSize)}.`;
    }
    return null;
  };

  const createFileWithPreview = (file: File): FileWithPreview => {
    const fileWithPreview: FileWithPreview = Object.assign(file, {
      id: generateFileId(),
      progress: 0,
      status: 'uploading' as const,
    });

    // Create preview for images
    if (file.type.startsWith('image/')) {
      fileWithPreview.preview = URL.createObjectURL(file);
    }

    return fileWithPreview;
  };

  const handleFiles = (newFiles: FileList | null) => {
    if (!newFiles) return;

    setError(null);

    const fileArray = Array.from(newFiles);

    // Check max files
    if (files.length + fileArray.length > maxFiles) {
      setError(`You can only upload up to ${maxFiles} files at a time.`);
      return;
    }

    // Validate files
    const validFiles: FileWithPreview[] = [];
    const errors: string[] = [];

    fileArray.forEach((file) => {
      const error = validateFile(file);
      if (error) {
        errors.push(`${file.name}: ${error}`);
      } else {
        validFiles.push(createFileWithPreview(file));
      }
    });

    if (errors.length > 0) {
      setError(errors.join('\n'));
    }

    if (validFiles.length > 0) {
      setFiles((prev) => [...prev, ...validFiles]);
      simulateUpload(validFiles);
    }
  };

  const simulateUpload = async (filesToUpload: FileWithPreview[]) => {
    // Simulate upload progress
    filesToUpload.forEach((file) => {
      const interval = setInterval(() => {
        setFiles((prev) =>
          prev.map((f) => {
            if (f.id === file.id) {
              const newProgress = Math.min(f.progress + 10, 100);
              return {
                ...f,
                progress: newProgress,
                status: newProgress === 100 ? 'completed' : 'uploading',
              };
            }
            return f;
          })
        );
      }, 200);

      setTimeout(() => {
        clearInterval(interval);
      }, 2200);
    });

    // Actually upload
    try {
      await onUpload(filesToUpload);
    } catch (err) {
      setFiles((prev) =>
        prev.map((f) =>
          filesToUpload.some((uf) => uf.id === f.id)
            ? { ...f, status: 'error', error: 'Upload failed. Please try again.' }
            : f
        )
      );
    }
  };

  const handleRemove = (fileId: string) => {
    setFiles((prev) => {
      const file = prev.find((f) => f.id === fileId);
      if (file?.preview) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter((f) => f.id !== fileId);
    });
    onRemove?.(fileId);
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

  // Cleanup previews on unmount
  React.useEffect(() => {
    return () => {
      files.forEach((file) => {
        if (file.preview) {
          URL.revokeObjectURL(file.preview);
        }
      });
    };
  }, []);

  const isAtLimit = files.length >= maxFiles;
  const hasUploadingFiles = files.some((f) => f.status === 'uploading');

  return (
    <div className={cn('space-y-4', className)}>
      {/* Dropzone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isAtLimit && fileInputRef.current?.click()}
        className={cn(
          'border-2 border-dashed rounded-xl p-8 text-center transition-colors',
          isDragOver && !isAtLimit
            ? 'border-ocean-500 bg-ocean-50'
            : isAtLimit
            ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
            : 'border-gray-300 hover:border-gray-400 bg-gray-50 cursor-pointer'
        )}
      >
        <div className={cn(
          'mx-auto flex h-12 w-12 items-center justify-center rounded-full mb-4',
          isAtLimit ? 'bg-gray-100' : 'bg-white'
        )}>
          {hasUploadingFiles ? (
            <Loader2 className="h-6 w-6 text-ocean-500 animate-spin" />
          ) : (
            <Upload className={cn(
              'h-6 w-6',
              isAtLimit ? 'text-gray-400' : 'text-ocean-500'
            )} />
          )}
        </div>
        <p className={cn(
          'font-medium mb-1',
          isAtLimit ? 'text-gray-400' : 'text-gray-900'
        )}>
          {isAtLimit ? 'Maximum files reached' : label}
        </p>
        <p className="text-sm text-gray-500">
          {description}
        </p>
        <p className="text-xs text-gray-400 mt-2">
          Max {maxFiles} files, up to {formatFileSize(maxFileSize)} each
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptedTypes.join(',')}
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
          disabled={isAtLimit}
        />
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2"
          >
            <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
            <p className="text-sm text-red-700 whitespace-pre-line">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* File List */}
      <AnimatePresence mode="popLayout">
        {files.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-2"
          >
            {files.map((file) => (
              <FilePreviewComponent
                key={file.id}
                file={file}
                onRemove={() => handleRemove(file.id)}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default DocumentUploader;
