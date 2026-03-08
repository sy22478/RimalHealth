/**
 * Document Card Component
 * 
 * Displays an individual document with download and delete actions.
 * 
 * @module components/patient/DocumentCard
 */

'use client';

import * as React from 'react';
import { FileText, Image, File, Download, Trash2, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Document,
  DocumentType,
  formatFileSize,
  formatDocumentDate,
  DOCUMENT_TYPE_LABELS,
  getFileExtension,
} from '@/lib/patient/documents';

// ============================================================================
// Types
// ============================================================================

interface DocumentCardProps {
  document: Document;
  onDownload: (documentId: string) => void;
  onDelete: (documentId: string) => void;
  isDownloading?: boolean;
  isDeleting?: boolean;
  className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the appropriate icon based on MIME type
 */
function getDocumentIcon(mimeType: string): React.ReactElement {
  if (mimeType === 'application/pdf') {
    return <FileText className="h-6 w-6 text-red-500" aria-hidden="true" />;
  }
  if (mimeType.startsWith('image/')) {
    return <Image className="h-6 w-6 text-ocean-500" aria-hidden="true" />;
  }
  return <File className="h-6 w-6 text-gray-500" aria-hidden="true" />;
}

/**
 * Get badge color variant based on document type
 */
function getDocumentTypeBadgeColor(documentType: DocumentType): string {
  const colors: Record<DocumentType, string> = {
    [DocumentType.ID_VERIFICATION]: 'bg-purple-100 text-purple-800 border-purple-200',
    [DocumentType.INSURANCE_CARD]: 'bg-blue-100 text-blue-800 border-blue-200',
    [DocumentType.MEDICAL_RECORD]: 'bg-green-100 text-green-800 border-green-200',
    [DocumentType.CONSENT_FORM]: 'bg-amber-100 text-amber-800 border-amber-200',
    [DocumentType.OTHER]: 'bg-gray-100 text-gray-800 border-gray-200',
  };
  return colors[documentType] || colors[DocumentType.OTHER];
}

// ============================================================================
// Main Component
// ============================================================================

export function DocumentCard({
  document,
  onDownload,
  onDelete,
  isDownloading = false,
  isDeleting = false,
  className,
}: DocumentCardProps): React.ReactElement {
  const handleDownload = React.useCallback(() => {
    onDownload(document.id);
  }, [document.id, onDownload]);

  const handleDelete = React.useCallback(() => {
    onDelete(document.id);
  }, [document.id, onDelete]);

  const isProcessing = isDownloading || isDeleting;

  return (
    <Card
      className={cn(
        'w-full transition-all duration-200',
        'hover:shadow-md hover:border-ocean-200',
        isProcessing && 'opacity-70 pointer-events-none',
        className
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center">
            {getDocumentIcon(document.mimeType)}
          </div>

          {/* Document Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h3 
                  className="font-medium text-gray-900 truncate"
                  title={document.fileName}
                >
                  {document.fileName}
                </h3>
                
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  <Badge 
                    variant="outline"
                    className={cn(
                      'text-xs font-medium capitalize',
                      getDocumentTypeBadgeColor(document.documentType)
                    )}
                  >
                    {DOCUMENT_TYPE_LABELS[document.documentType]}
                  </Badge>
                  
                  <span className="text-xs text-muted-foreground">
                    {getFileExtension(document.mimeType)} • {formatFileSize(document.fileSize)}
                  </span>
                </div>

                <p className="text-xs text-muted-foreground mt-1.5">
                  Uploaded {formatDocumentDate(document.uploadedAt)}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button
                  onClick={handleDownload}
                  disabled={isProcessing}
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  aria-label={`Download ${document.fileName}`}
                  title="Download"
                >
                  {isDownloading ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-ocean-500 border-t-transparent" />
                  ) : (
                    <Download className="h-4 w-4 text-gray-600" />
                  )}
                </Button>

                <Button
                  onClick={handleDelete}
                  disabled={isProcessing}
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
                  aria-label={`Delete ${document.fileName}`}
                  title="Delete"
                >
                  {isDeleting ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
                  ) : (
                    <Trash2 className="h-4 w-4 text-gray-600" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Delete Confirmation Dialog
// ============================================================================

interface DeleteConfirmDialogProps {
  isOpen: boolean;
  documentName: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting?: boolean;
}

export function DeleteConfirmDialog({
  isOpen,
  documentName,
  onConfirm,
  onCancel,
  isDeleting = false,
}: DeleteConfirmDialogProps): React.ReactElement | null {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <AlertCircle className="h-5 w-5 text-red-600" />
          </div>
          
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900">
              Delete Document?
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Are you sure you want to delete <strong className="text-gray-900">{documentName}</strong>?
              This action cannot be undone.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button
            onClick={onCancel}
            variant="outline"
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            variant="destructive"
            disabled={isDeleting}
            className="bg-red-600 hover:bg-red-700"
          >
            {isDeleting ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Deleting...
              </span>
            ) : (
              'Delete'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
