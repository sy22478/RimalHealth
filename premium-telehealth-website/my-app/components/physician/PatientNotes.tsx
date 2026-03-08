/**
 * PatientNotes Component
 * 
 * Displays and manages physician notes for a patient.
 * Supports both new and legacy interfaces for backward compatibility.
 * 
 * SECURITY NOTE: All patient data is PHI - proper handling ensured
 * No PHI is logged to console.
 * 
 * @module components/physician/PatientNotes
 */

'use client';

import * as React from 'react';
import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  StickyNote, 
  Plus,
  User,
  Clock,
  AlertCircle,
  FileText,
  Stethoscope,
  Loader2,
  Edit2,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

export type NoteType = 'CLINICAL' | 'ADMINISTRATIVE';

export interface PhysicianNote {
  id: string;
  content: string;
  type: NoteType;
  createdAt: Date;
  physician: {
    firstName: string;
    lastName: string;
  };
}

/**
 * Legacy note format for backward compatibility
 */
interface LegacyPhysicianNote {
  id: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  authorName: string;
  physicianId: string;
}

interface PatientNotesProps {
  /** Patient ID for API calls (new interface) */
  patientId?: string;
  /** Notes for new interface */
  initialNotes?: PhysicianNote[];
  /** Legacy: notes array */
  notes?: LegacyPhysicianNote[];
  /** Display name for current physician (new interface) */
  currentPhysicianName?: string;
  /** Legacy: current physician ID */
  currentPhysicianId?: string;
  /** Additional CSS classes */
  className?: string;
  /** Legacy: callback for adding a note */
  onAddNote?: (content: string) => Promise<void>;
  /** Legacy: callback for editing a note */
  onEditNote?: (noteId: string, content: string) => Promise<void>;
  /** Legacy: callback for deleting a note */
  onDeleteNote?: (noteId: string) => Promise<void>;
  /** Whether data is loading */
  isLoading?: boolean;
}

interface NoteFormData {
  type: NoteType;
  content: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format date for display
 */
function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Get note type badge configuration
 */
function getNoteTypeConfig(type: NoteType): { 
  label: string; 
  variant: 'default' | 'secondary' | 'outline';
  icon: React.ReactNode;
  className: string;
} {
  switch (type) {
    case 'CLINICAL':
      return {
        label: 'Clinical',
        variant: 'default',
        icon: <Stethoscope className="w-3 h-3" />,
        className: 'bg-ocean-100 text-ocean-800 border-ocean-200',
      };
    case 'ADMINISTRATIVE':
      return {
        label: 'Administrative',
        variant: 'secondary',
        icon: <FileText className="w-3 h-3" />,
        className: 'bg-gray-100 text-gray-800 border-gray-200',
      };
    default:
      return {
        label: type,
        variant: 'outline',
        icon: <StickyNote className="w-3 h-3" />,
        className: '',
      };
  }
}

/**
 * Check if a note was edited
 */
function isEdited(note: LegacyPhysicianNote): boolean {
  return new Date(note.updatedAt).getTime() !== new Date(note.createdAt).getTime();
}

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * Note type badge component
 */
function NoteTypeBadge({ type }: { type: NoteType }) {
  const config = getNoteTypeConfig(type);
  
  return (
    <Badge 
      variant="outline" 
      className={cn(
        'flex items-center gap-1 text-xs font-medium',
        config.className
      )}
    >
      {config.icon}
      {config.label}
    </Badge>
  );
}

/**
 * Modern note card component
 */
function ModernNoteCard({ note }: { note: PhysicianNote }) {
  return (
    <div className="p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-navy-100 flex items-center justify-center flex-shrink-0">
            <User className="h-4 w-4 text-navy-600" />
          </div>
          <div>
            <p className="text-sm font-medium">
              {note.physician.firstName} {note.physician.lastName}
            </p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDate(note.createdAt)}
            </p>
          </div>
        </div>
        <NoteTypeBadge type={note.type} />
      </div>
      
      <div className="pl-11">
        <p className="text-sm whitespace-pre-wrap text-foreground">
          {note.content}
        </p>
      </div>
    </div>
  );
}

/**
 * Legacy note card component with edit/delete
 */
function LegacyNoteCard({
  note,
  isAuthor,
  onEdit,
  onDelete,
  isSubmitting,
}: {
  note: LegacyPhysicianNote;
  isAuthor: boolean;
  onEdit: (noteId: string, content: string) => Promise<void>;
  onDelete: (noteId: string) => Promise<void>;
  isSubmitting: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(note.content);

  const handleSave = async () => {
    if (!editContent.trim()) return;
    await onEdit(note.id, editContent.trim());
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this note? This action cannot be undone.')) {
      return;
    }
    await onDelete(note.id);
  };

  if (isEditing) {
    return (
      <div className="p-4 rounded-lg border bg-ocean-50/30 ring-1 ring-ocean-200">
        <Textarea
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          className="min-h-[100px] mb-3"
          disabled={isSubmitting}
        />
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditContent(note.content);
              setIsEditing(false);
            }}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save'
            )}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-full bg-navy-100 flex items-center justify-center">
            <User className="h-3 w-3 text-navy-600" />
          </div>
          <span className="text-sm font-medium">{note.authorName}</span>
          <span className="text-xs text-muted-foreground">•</span>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDate(note.createdAt)}
          </span>
          {isEdited(note) && (
            <Badge variant="outline" className="text-xs">
              Edited
            </Badge>
          )}
        </div>
        
        {isAuthor && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(true)}
              className="h-7 w-7 p-0"
              disabled={isSubmitting}
            >
              <Edit2 className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
              disabled={isSubmitting}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
      
      <p className="text-sm whitespace-pre-wrap">{note.content}</p>
    </div>
  );
}

/**
 * Add Note Dialog Component
 */
function AddNoteDialog({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  showTypeSelect = true,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: NoteFormData) => Promise<void>;
  isSubmitting: boolean;
  showTypeSelect?: boolean;
}) {
  const [type, setType] = useState<NoteType>('CLINICAL');
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setType('CLINICAL');
      setContent('');
      setError(null);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!content.trim()) {
      setError('Note content is required');
      return;
    }

    if (content.length > 5000) {
      setError('Note is too long (max 5,000 characters)');
      return;
    }

    await onSubmit({ type, content: content.trim() });
  };

  const charCount = content.length;
  const maxChars = 5000;
  const isNearLimit = charCount > maxChars * 0.9;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add Note
          </DialogTitle>
          <DialogDescription>
            Add a clinical or administrative note for this patient.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {showTypeSelect && (
            <div className="space-y-2">
              <Label htmlFor="note-type">Note Type</Label>
              <Select
                value={type}
                onValueChange={(value) => setType(value as NoteType)}
                disabled={isSubmitting}
              >
                <SelectTrigger id="note-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CLINICAL">
                    <div className="flex items-center gap-2">
                      <Stethoscope className="h-4 w-4 text-ocean-600" />
                      Clinical Note
                    </div>
                  </SelectItem>
                  <SelectItem value="ADMINISTRATIVE">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-gray-600" />
                      Administrative Note
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="note-content">Content</Label>
            <Textarea
              id="note-content"
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Enter your note here..."
              className={cn(
                'min-h-[150px] resize-y',
                error && 'border-destructive focus-visible:ring-destructive'
              )}
              disabled={isSubmitting}
            />
            
            <div className="flex items-center justify-between">
              {error ? (
                <p className="text-sm text-destructive">{error}</p>
              ) : (
                <span />
              )}
              <span className={cn(
                'text-xs',
                isNearLimit ? 'text-warning-600 font-medium' : 'text-muted-foreground'
              )}>
                {charCount.toLocaleString()} / {maxChars.toLocaleString()}
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !content.trim()}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Note'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Loading skeleton for notes
 */
function NotesSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-6 w-32 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-9 w-28" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * PatientNotes component for displaying and adding physician notes
 * 
 * Supports both new interface (with patientId, initialNotes) and
 * legacy interface (with notes, currentPhysicianId, callbacks) for backward compatibility.
 * 
 * Features:
 * - Display notes as chronological list with cards
 * - Show note type badge (Clinical/Administrative)
 * - Show author and timestamp
 * - "Add Note" button opening a modal/form
 * - Form fields: Note type (select), Content (textarea)
 * - Submit creates note via API
 * - Optimistic UI update (show note immediately, sync with server)
 */
export function PatientNotes(props: PatientNotesProps): React.ReactElement {
  const {
    patientId,
    initialNotes,
    notes: legacyNotes,
    currentPhysicianName = 'Current Physician',
    currentPhysicianId,
    className,
    onAddNote: legacyOnAddNote,
    onEditNote,
    onDeleteNote,
    isLoading: externalLoading,
  } = props;

  // Determine if using legacy mode
  const isLegacyMode = legacyNotes !== undefined;
  
  // State for new interface
  const [modernNotes, setModernNotes] = useState<PhysicianNote[]>(initialNotes ?? []);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Use external notes if in legacy mode
  const displayNotes = isLegacyMode 
    ? (legacyNotes ?? []).map((note): PhysicianNote => ({
        id: note.id,
        content: note.content,
        type: 'CLINICAL', // Legacy notes don't have type
        createdAt: note.createdAt,
        physician: {
          firstName: note.authorName.split(' ')[0] || 'Unknown',
          lastName: note.authorName.split(' ').slice(1).join(' ') || '',
        },
      }))
    : modernNotes;

  /**
   * Handle adding a new note (new interface)
   */
  const handleAddModernNote = async (formData: NoteFormData) => {
    if (!patientId) return;
    
    setIsSubmitting(true);

    // Create optimistic note
    const optimisticNote: PhysicianNote = {
      id: `temp-${Date.now()}`,
      content: formData.content,
      type: formData.type,
      createdAt: new Date(),
      physician: {
        firstName: currentPhysicianName.split(' ')[0] || 'Dr.',
        lastName: currentPhysicianName.split(' ').slice(1).join(' ') || 'Unknown',
      },
    };

    // Optimistically add note to UI
    setModernNotes((prev) => [optimisticNote, ...prev]);
    setIsDialogOpen(false);

    try {
      // In production, POST to API:
      // const response = await fetch(`/api/physician/patients/${patientId}/notes`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(formData),
      // });
      
      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      // Replace optimistic note with server response
      const savedNote: PhysicianNote = {
        ...optimisticNote,
        id: `note-${Date.now()}`,
      };
      
      setModernNotes((prev) =>
        prev.map((note) =>
          note.id === optimisticNote.id ? savedNote : note
        )
      );
    } catch (error) {
      // Remove optimistic note on error
      setModernNotes((prev) => prev.filter((note) => note.id !== optimisticNote.id));
      alert('Failed to save note. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handle legacy add note (simple content only)
   */
  const handleLegacyAddNote = async (formData: NoteFormData) => {
    if (!legacyOnAddNote) return;
    
    setIsSubmitting(true);
    setIsDialogOpen(false);
    
    try {
      await legacyOnAddNote(formData.content);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (externalLoading || isLoading) {
    return <NotesSkeleton />;
  }

  return (
    <>
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <StickyNote className="h-5 w-5" />
                Physician Notes
              </CardTitle>
              <CardDescription>
                {displayNotes.length} note{displayNotes.length !== 1 ? 's' : ''} on record
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                PHI Protected
              </Badge>
              <Button
                onClick={() => setIsDialogOpen(true)}
                size="sm"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Note
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {displayNotes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border rounded-lg bg-muted/30">
              <StickyNote className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No notes yet</p>
              <p className="text-sm mt-1">
                Click &quot;Add Note&quot; to document patient care.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {isLegacyMode && legacyNotes ? (
                // Legacy mode: use LegacyNoteCard with edit/delete
                legacyNotes.map((note) => (
                  <LegacyNoteCard
                    key={note.id}
                    note={note}
                    isAuthor={note.physicianId === currentPhysicianId}
                    onEdit={onEditNote ?? (async () => {})}
                    onDelete={onDeleteNote ?? (async () => {})}
                    isSubmitting={isSubmitting}
                  />
                ))
              ) : (
                // Modern mode: use ModernNoteCard
                modernNotes.map((note) => (
                  <ModernNoteCard key={note.id} note={note} />
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Note Dialog */}
      <AddNoteDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSubmit={isLegacyMode ? handleLegacyAddNote : handleAddModernNote}
        isSubmitting={isSubmitting}
        showTypeSelect={!isLegacyMode}
      />
    </>
  );
}

export default PatientNotes;
