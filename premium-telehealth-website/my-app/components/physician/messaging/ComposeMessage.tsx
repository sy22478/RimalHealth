/**
 * ComposeMessage Component
 * 
 * Form for composing new messages to other physicians.
 * Includes recipient selection, subject, body, and optional patient linking.
 * 
 * @module components/physician/messaging/ComposeMessage
 */

'use client';

import * as React from 'react';
import { useState, useCallback, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  Send,
  Search,
  X,
  User,
  Stethoscope,
  UserRound,
  Loader2,
  Check,
} from 'lucide-react';

// ============================================================================
// Validation Schema
// ============================================================================

const composeSchema = z.object({
  recipientId: z.string().min(1, 'Please select a recipient'),
  subject: z.string().min(1, 'Subject is required').max(150, 'Subject too long'),
  body: z.string().min(1, 'Message body is required').max(2000, 'Message too long'),
  patientId: z.string().optional(),
});

type ComposeFormValues = z.infer<typeof composeSchema>;

// ============================================================================
// Types
// ============================================================================

export interface Physician {
  id: string;
  firstName: string;
  lastName: string;
  specialty?: string;
}

export interface PatientOption {
  id: string;
  name: string;
}

export interface ComposeMessageProps {
  physicians: Physician[];
  onSend: (data: {
    recipientId: string;
    subject: string;
    body: string;
    patientId?: string;
  }) => Promise<void>;
  patientOptions?: PatientOption[];
  className?: string;
  onCancel?: () => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get initials from name
 */
function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

// ============================================================================
// Components
// ============================================================================

/**
 * Searchable physician selector
 */
interface PhysicianSelectorProps {
  physicians: Physician[];
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

function PhysicianSelector({
  physicians,
  value,
  onChange,
  error,
}: PhysicianSelectorProps): React.ReactElement {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const filteredPhysicians = useMemo(() => {
    if (!searchQuery.trim()) return physicians;
    
    const query = searchQuery.toLowerCase();
    return physicians.filter((p) => {
      const fullName = `${p.firstName} ${p.lastName}`.toLowerCase();
      const specialty = p.specialty?.toLowerCase() || '';
      return fullName.includes(query) || specialty.includes(query);
    });
  }, [physicians, searchQuery]);

  const selectedPhysician = physicians.find((p) => p.id === value);

  // Clear selection
  const clearSelection = () => {
    onChange('');
    setSearchQuery('');
  };

  // If a physician is selected, show the selected state
  if (selectedPhysician) {
    const initials = getInitials(selectedPhysician.firstName, selectedPhysician.lastName);
    
    return (
      <div className="border rounded-lg p-3 bg-ocean-50/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-ocean-100 text-ocean-700">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium text-gray-900">
                Dr. {selectedPhysician.firstName} {selectedPhysician.lastName}
              </p>
              {selectedPhysician.specialty && (
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Stethoscope className="w-3 h-3" />
                  {selectedPhysician.specialty}
                </p>
              )}
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearSelection}
            className="text-muted-foreground hover:text-gray-700"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search physicians by name or specialty..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className={cn(
            'pl-9',
            error && 'border-destructive focus-visible:ring-destructive'
          )}
          aria-invalid={!!error}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Dropdown results */}
      {isOpen && (
        <div className="border rounded-lg overflow-hidden max-h-60 overflow-y-auto">
          {filteredPhysicians.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              No physicians found
            </div>
          ) : (
            <div className="divide-y">
              {filteredPhysicians.map((physician) => {
                const initials = getInitials(physician.firstName, physician.lastName);
                
                return (
                  <button
                    key={physician.id}
                    type="button"
                    onClick={() => {
                      onChange(physician.id);
                      setIsOpen(false);
                      setSearchQuery('');
                    }}
                    className="w-full flex items-center gap-3 p-3 text-left hover:bg-ocean-50 transition-colors"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-ocean-100 text-ocean-700 text-xs">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-gray-900">
                        Dr. {physician.firstName} {physician.lastName}
                      </p>
                      {physician.specialty && (
                        <p className="text-xs text-muted-foreground">
                          {physician.specialty}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Click outside to close */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[-1]"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}

/**
 * Patient selector for linking messages to patients
 */
interface PatientSelectorProps {
  patients: PatientOption[];
  value?: string;
  onChange: (value: string | undefined) => void;
}

function PatientSelector({
  patients,
  value,
  onChange,
}: PatientSelectorProps): React.ReactElement {
  const selectedPatient = patients.find((p) => p.id === value);

  if (selectedPatient) {
    return (
      <div className="flex items-center gap-2 p-2 bg-ocean-50 rounded-lg border border-ocean-200">
        <UserRound className="w-4 h-4 text-ocean-500" />
        <span className="text-sm flex-1">{selectedPatient.name}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => onChange(undefined)}
          className="h-6 w-6"
        >
          <X className="w-3 h-3" />
        </Button>
      </div>
    );
  }

  return (
    <Select value={value || ''} onValueChange={(v) => onChange(v || undefined)}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Link to a patient (optional)" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="">None</SelectItem>
        {patients.map((patient) => (
          <SelectItem key={patient.id} value={patient.id}>
            {patient.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * ComposeMessage form for creating new messages
 */
export function ComposeMessage({
  physicians,
  onSend,
  patientOptions = [],
  className,
  onCancel,
}: ComposeMessageProps): React.ReactElement {
  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);

  const {
    control,
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors, isValid },
  } = useForm<ComposeFormValues>({
    resolver: zodResolver(composeSchema),
    mode: 'onChange',
    defaultValues: {
      recipientId: '',
      subject: '',
      body: '',
      patientId: undefined,
    },
  });

  const bodyValue = watch('body') || '';
  const subjectValue = watch('subject') || '';

  const onSubmit = useCallback(async (values: ComposeFormValues) => {
    setIsSending(true);
    try {
      await onSend({
        recipientId: values.recipientId,
        subject: values.subject,
        body: values.body,
        patientId: values.patientId,
      });
      
      setSendSuccess(true);
      reset();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSendSuccess(false), 3000);
    } finally {
      setIsSending(false);
    }
  }, [onSend, reset]);

  // Auto-resize textarea
  const handleTextareaInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;
    target.style.height = 'auto';
    target.style.height = `${Math.min(target.scrollHeight, 300)}px`;
  };

  if (sendSuccess) {
    return (
      <Card className={cn('border-green-200 bg-green-50/50', className)}>
        <CardContent className="pt-6 pb-6">
          <div className="flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-3">
              <Check className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-green-800 mb-1">
              Message Sent!
            </h3>
            <p className="text-sm text-green-700 mb-4">
              Your message has been sent successfully.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSendSuccess(false)}
            >
              Send Another Message
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="w-5 h-5 text-ocean-500" />
          New Message
        </CardTitle>
        <CardDescription>
          Send a secure message to another physician
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-5">
          {/* Recipient */}
          <div className="space-y-2">
            <Label htmlFor="recipient">
              To <span className="text-destructive">*</span>
            </Label>
            <Controller
              name="recipientId"
              control={control}
              render={({ field }) => (
                <PhysicianSelector
                  physicians={physicians}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.recipientId?.message}
                />
              )}
            />
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <Label htmlFor="subject">
              Subject <span className="text-destructive">*</span>
            </Label>
            <Input
              id="subject"
              placeholder="Enter message subject..."
              {...register('subject')}
              className={cn(
                errors.subject && 'border-destructive focus-visible:ring-destructive'
              )}
              aria-invalid={!!errors.subject}
              aria-describedby={errors.subject ? 'subject-error' : undefined}
            />
            <div className="flex justify-between">
              {errors.subject ? (
                <p id="subject-error" className="text-sm text-destructive">
                  {errors.subject.message}
                </p>
              ) : (
                <span />
              )}
              <span className={cn(
                'text-xs',
                subjectValue.length > 150 ? 'text-destructive' : 'text-muted-foreground'
              )}>
                {subjectValue.length}/150
              </span>
            </div>
          </div>

          {/* Patient Link (optional) */}
          {patientOptions.length > 0 && (
            <div className="space-y-2">
              <Label>Linked Patient</Label>
              <Controller
                name="patientId"
                control={control}
                render={({ field }) => (
                  <PatientSelector
                    patients={patientOptions}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              <p className="text-xs text-muted-foreground">
                Link this message to a patient record for context
              </p>
            </div>
          )}

          {/* Body */}
          <div className="space-y-2">
            <Label htmlFor="body">
              Message <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="body"
              placeholder="Type your message here..."
              {...register('body')}
              onInput={handleTextareaInput}
              className={cn(
                'min-h-[150px] resize-none',
                errors.body && 'border-destructive focus-visible:ring-destructive'
              )}
              aria-invalid={!!errors.body}
              aria-describedby={errors.body ? 'body-error' : undefined}
            />
            <div className="flex justify-between">
              {errors.body ? (
                <p id="body-error" className="text-sm text-destructive">
                  {errors.body.message}
                </p>
              ) : (
                <span />
              )}
              <span className={cn(
                'text-xs',
                bodyValue.length > 2000 ? 'text-destructive' : 'text-muted-foreground'
              )}>
                {bodyValue.length}/2000
              </span>
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex justify-between border-t pt-6">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSending || !isValid}
            className="min-w-[100px]"
          >
            {isSending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Sending...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Send
              </>
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

export default ComposeMessage;
