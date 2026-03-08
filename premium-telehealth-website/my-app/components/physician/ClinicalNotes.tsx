'use client';

import * as React from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface ClinicalNotesProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
  minLength?: number;
  maxLength?: number;
  required?: boolean;
}

/**
 * Clinical Notes Input Component
 * 
 * A textarea for physicians to enter clinical notes during intake review.
 * Includes character count and validation feedback.
 * 
 * HIPAA: Notes are encrypted and stored securely
 */
export function ClinicalNotes({
  value,
  onChange,
  error,
  disabled = false,
  minLength = 10,
  maxLength = 5000,
  required = true,
}: ClinicalNotesProps) {
  const characterCount = value.length;
  const isUnderMin = characterCount > 0 && characterCount < minLength;
  const isOverMax = characterCount > maxLength;
  const hasError = !!error || isUnderMin || isOverMax;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor="clinical-notes" className="text-sm font-medium">
          Clinical Notes
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
        <span
          className={cn(
            'text-xs',
            isOverMax
              ? 'text-destructive font-medium'
              : isUnderMin
              ? 'text-amber-500'
              : 'text-muted-foreground'
          )}
        >
          {characterCount}/{maxLength} characters
          {isUnderMin && ` (min ${minLength})`}
        </span>
      </div>
      <Textarea
        id="clinical-notes"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter your clinical assessment, observations, and reasoning for this decision..."
        disabled={disabled}
        className={cn(
          'min-h-[200px] resize-y',
          hasError && 'border-destructive focus-visible:ring-destructive/20'
        )}
        aria-invalid={hasError}
        aria-describedby={hasError ? 'clinical-notes-error' : undefined}
        required={required}
      />
      {(error || isUnderMin || isOverMax) && (
        <p
          id="clinical-notes-error"
          className="text-sm text-destructive"
          role="alert"
        >
          {error ||
            (isUnderMin && `Clinical notes must be at least ${minLength} characters`) ||
            (isOverMax && `Clinical notes cannot exceed ${maxLength} characters`)}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        These notes will be part of the permanent medical record and may be reviewed for quality assurance.
      </p>
    </div>
  );
}
