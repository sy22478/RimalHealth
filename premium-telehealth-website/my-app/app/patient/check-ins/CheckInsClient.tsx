'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ClipboardCheck, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { LoadingButton } from '@/components/ui/LoadingButton';
import { cn } from '@/lib/utils';
import { fetchWithCSRF } from '@/lib/security/csrf';
import { CHECK_IN_QUESTIONS } from '@/lib/intake/glp1/clinical-config';
import {
  checkInResponsesSchema,
  type CheckInResponses,
} from '@/lib/validation/checkin-schemas';

interface CheckInSummary {
  id: string;
  status: 'SCHEDULED' | 'DUE' | 'SUBMITTED' | 'REVIEWED' | 'MISSED';
  scheduledFor: string;
  dueAt: string;
  submittedAt: string | null;
  reviewedAt: string | null;
}

const STATUS_BADGE: Record<CheckInSummary['status'], { label: string; className: string }> = {
  SCHEDULED: { label: 'Scheduled', className: 'bg-gray-100 text-gray-700' },
  DUE: { label: 'Due now', className: 'bg-amber-100 text-amber-800' },
  SUBMITTED: { label: 'Submitted', className: 'bg-blue-100 text-blue-800' },
  REVIEWED: { label: 'Reviewed', className: 'bg-emerald-100 text-emerald-800' },
  MISSED: { label: 'Missed', className: 'bg-red-100 text-red-800' },
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function CheckInsClient(): React.ReactElement {
  const [checkIns, setCheckIns] = React.useState<CheckInSummary[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [submitState, setSubmitState] = React.useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CheckInResponses>({
    resolver: zodResolver(checkInResponsesSchema),
  });

  const loadCheckIns = React.useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/patient/checkins', { credentials: 'include', cache: 'no-store' });
      if (!res.ok) {
        throw new Error('Request failed');
      }
      const data = await res.json();
      setCheckIns(Array.isArray(data.checkIns) ? data.checkIns : []);
    } catch (err) {
      console.error('Failed to load check-ins:', err instanceof Error ? err.message : 'Unknown error');
      // Distinct error state — without this, a failed load is indistinguishable
      // from "no check-in due".
      setLoadError("We couldn't load your check-ins. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Build an accessible summary of the current field errors (announced via aria-live).
  const errorMessages = React.useMemo(
    () =>
      CHECK_IN_QUESTIONS.map((q) => errors[q.id as keyof CheckInResponses]?.message)
        .filter((m): m is string => typeof m === 'string'),
    [errors]
  );

  React.useEffect(() => {
    void loadCheckIns();
  }, [loadCheckIns]);

  const openCheckIn = checkIns.find((c) => c.status === 'DUE' || c.status === 'SCHEDULED');

  const onSubmit = async (responses: CheckInResponses) => {
    if (!openCheckIn) return;
    setSubmitState('submitting');
    setSubmitError(null);
    try {
      const res = await fetchWithCSRF(`/api/patient/checkins/${openCheckIn.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responses }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to submit check-in');
      }
      setSubmitState('success');
      await loadCheckIns();
    } catch (err) {
      setSubmitState('error');
      setSubmitError(err instanceof Error ? err.message : 'An unexpected error occurred');
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-ocean-50 rounded-lg">
          <ClipboardCheck className="h-6 w-6 text-ocean-600" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Check-ins</h1>
          <p className="text-sm text-gray-500">
            Brief updates so your physician can monitor your treatment safely.
          </p>
        </div>
      </div>

      {loading ? (
        <Card>
          <CardContent className="p-6 text-sm text-gray-500">Loading…</CardContent>
        </Card>
      ) : loadError ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6 flex items-center justify-between gap-3" role="alert">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
              <p className="text-sm text-red-700">{loadError}</p>
            </div>
            <button
              type="button"
              onClick={() => void loadCheckIns()}
              className="text-sm font-medium text-red-700 underline hover:text-red-900"
            >
              Retry
            </button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Open check-in form */}
          {openCheckIn && submitState !== 'success' ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Your check-in is due</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                  {CHECK_IN_QUESTIONS.map((q) => (
                    <div key={q.id} className="space-y-1.5">
                      <Label htmlFor={q.id}>
                        {q.label}
                        {q.required && <span className="text-destructive ml-1">*</span>}
                        {q.hint && <span className="text-muted-foreground ml-2 text-xs">({q.hint})</span>}
                      </Label>

                      {q.type === 'number' && (
                        <Input
                          id={q.id}
                          type="number"
                          step="0.1"
                          {...register(q.id as keyof CheckInResponses, { valueAsNumber: true })}
                        />
                      )}

                      {q.type === 'select' && q.options && (
                        <select
                          id={q.id}
                          {...register(q.id as keyof CheckInResponses)}
                          className={cn(
                            'w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs',
                            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
                          )}
                          defaultValue=""
                        >
                          <option value="" disabled>
                            Select…
                          </option>
                          {q.options.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      )}

                      {q.type === 'boolean' && (
                        <select
                          id={q.id}
                          {...register(q.id as keyof CheckInResponses, {
                            setValueAs: (v) => v === 'true',
                          })}
                          className={cn(
                            'w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs',
                            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
                          )}
                          defaultValue="false"
                        >
                          <option value="false">No</option>
                          <option value="true">Yes</option>
                        </select>
                      )}

                      {q.type === 'textarea' && (
                        <Textarea id={q.id} {...register(q.id as keyof CheckInResponses)} className="min-h-[80px]" />
                      )}

                      {errors[q.id as keyof CheckInResponses] && (
                        <p className="text-sm text-destructive">
                          {errors[q.id as keyof CheckInResponses]?.message || 'This field is required.'}
                        </p>
                      )}
                    </div>
                  ))}

                  {/* Accessible error summary — announced to screen readers. */}
                  <div aria-live="assertive" className="sr-only" role="status">
                    {errorMessages.length > 0
                      ? `${errorMessages.length} ${errorMessages.length === 1 ? 'field needs' : 'fields need'} attention: ${errorMessages.join('. ')}`
                      : ''}
                  </div>

                  {submitState === 'error' && submitError && (
                    <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">
                      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                      <span>{submitError}</span>
                    </div>
                  )}

                  <LoadingButton type="submit" loading={submitState === 'submitting'} className="w-full">
                    Submit check-in
                  </LoadingButton>
                </form>
              </CardContent>
            </Card>
          ) : submitState === 'success' ? (
            <Card className="border-emerald-200 bg-emerald-50">
              <CardContent className="p-6 flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5" />
                <div>
                  <p className="font-medium text-emerald-900">Check-in submitted</p>
                  <p className="text-sm text-emerald-800">
                    Your physician will review it. You&apos;ll be notified when there&apos;s an update.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-6 flex items-center gap-3 text-sm text-gray-600">
                <Clock className="h-5 w-5 text-gray-400" />
                No check-in is due right now. We&apos;ll let you know when your next one is ready.
              </CardContent>
            </Card>
          )}

          {/* History */}
          {checkIns.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">History</CardTitle>
              </CardHeader>
              <CardContent className="divide-y divide-gray-100">
                {checkIns.map((c) => {
                  const badge = STATUS_BADGE[c.status];
                  return (
                    <div key={c.id} className="flex items-center justify-between py-3 text-sm">
                      <div>
                        <p className="font-medium text-gray-900">Check-in · {formatDate(c.dueAt)}</p>
                        {c.submittedAt && (
                          <p className="text-xs text-gray-500">Submitted {formatDate(c.submittedAt)}</p>
                        )}
                      </div>
                      <Badge className={cn('text-xs', badge.className)}>{badge.label}</Badge>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
