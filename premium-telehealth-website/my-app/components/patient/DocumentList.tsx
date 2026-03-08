/**
 * Document List Component
 * 
 * Displays a list of patient documents with loading and empty states.
 * 
 * @module components/patient/DocumentList
 */

'use client';

import * as React from 'react';
import { FileText, RefreshCw, AlertCircle } from 'lucide-react';
import { DocumentCard, DeleteConfirmDialog } from './DocumentCard';
import { Skeleton } from '@/components/ui/Skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Document } from '@/lib/patient/documents';

// ============================================================================
// Types
// ============================================================================

interface DocumentListProps {
  documents: Document[];
  isLoading?: boolean;
  error?: string | null;
  onDownload: (documentId: string) => void;
  onDelete: (documentId: string) => void;
  downloadingId?: string | null;
  deletingId?: string | null;
  onRetry?: () => void;
}

// ============================================================================
// Loading Skeleton Component
// ============================================================================

function DocumentCardSkeleton(): React.ReactElement {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-start gap-4">
        <Skeleton className="h-12 w-12 rounded-xl flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-3 w-32" />
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <Skeleton className="h-8 w-8 rounded-md" />
              <Skeleton className="h-8 w-8 rounded-md" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Empty State Component
// ============================================================================

function EmptyState(): React.ReactElement {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 mb-4">
        <FileText className="h-8 w-8 text-gray-400" aria-hidden="true" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-1">
        No Documents Yet
      </h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        You haven&apos;t uploaded any documents. Upload your ID, insurance card, 
        or medical records to get started.
      </p>
    </div>
  );
}

// ============================================================================
// Error State Component
// ============================================================================

function ErrorState({ 
  message, 
  onRetry 
}: { 
  message: string; 
  onRetry?: () => void;
}): React.ReactElement {
  return (
    <Alert variant="destructive" className="my-4">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Error loading documents</AlertTitle>
      <AlertDescription className="flex items-center justify-between">
        <span>{message}</span>
        {onRetry && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onRetry}
            className="ml-4"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function DocumentList({
  documents,
  isLoading = false,
  error = null,
  onDownload,
  onDelete,
  downloadingId = null,
  deletingId = null,
  onRetry,
}: DocumentListProps): React.ReactElement {
  const [deleteConfirm, setDeleteConfirm] = React.useState<{
    isOpen: boolean;
    document: Document | null;
  }>({
    isOpen: false,
    document: null,
  });

  const handleDeleteClick = React.useCallback((documentId: string) => {
    const document = documents.find(d => d.id === documentId);
    if (document) {
      setDeleteConfirm({ isOpen: true, document });
    }
  }, [documents]);

  const handleConfirmDelete = React.useCallback(() => {
    if (deleteConfirm.document) {
      onDelete(deleteConfirm.document.id);
      setDeleteConfirm({ isOpen: false, document: null });
    }
  }, [deleteConfirm.document, onDelete]);

  const handleCancelDelete = React.useCallback(() => {
    setDeleteConfirm({ isOpen: false, document: null });
  }, []);

  // Show loading skeleton
  if (isLoading) {
    return (
      <div className="space-y-4">
        <DocumentCardSkeleton />
        <DocumentCardSkeleton />
        <DocumentCardSkeleton />
      </div>
    );
  }

  // Show error state
  if (error) {
    return <ErrorState message={error} onRetry={onRetry} />;
  }

  // Show empty state
  if (documents.length === 0) {
    return <EmptyState />;
  }

  // Show document list
  return (
    <>
      <div 
        className="space-y-4"
        role="list"
        aria-label="Your documents"
      >
        {documents.map((document) => (
          <div key={document.id} role="listitem">
            <DocumentCard
              document={document}
              onDownload={onDownload}
              onDelete={handleDeleteClick}
              isDownloading={downloadingId === document.id}
              isDeleting={deletingId === document.id}
            />
          </div>
        ))}
      </div>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        isOpen={deleteConfirm.isOpen}
        documentName={deleteConfirm.document?.fileName || ''}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        isDeleting={deletingId === deleteConfirm.document?.id}
      />
    </>
  );
}
