'use client';

import * as React from 'react';
import { ClipboardCheck, AlertCircle, AlertTriangle, CheckCircle2, RefreshCw, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingButton } from '@/components/ui/LoadingButton';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { fetchWithCSRF } from '@/lib/security/csrf';
import { CHECK_IN_QUESTIONS } from '@/lib/intake/glp1/clinical-config';
import type { CheckInResponses } from '@/lib/validation/checkin-schemas';

interface SubmittedCheckIn {
  id: string;
  patientName: string;
  submittedAt: string | null;
  urgent: boolean;
  responses: CheckInResponses | null;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
}

/** Resolve a response value to its human label via CHECK_IN_QUESTIONS options. */
function responseLabel(questionId: string, value: unknown): string {
  if (value === undefined || value === null || value === '') return 'Not answered';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  const question = CHECK_IN_QUESTIONS.find((q) => q.id === questionId);
  if (question?.options) {
    const opt = question.options.find((o) => o.value === value);
    if (opt) return opt.label;
  }
  return String(value);
}

export default function CheckInReviewClient(): React.ReactElement {
  const [checkIns, setCheckIns] = React.useState<SubmittedCheckIn[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [active, setActive] = React.useState<SubmittedCheckIn | null>(null);
  const [reviewing, setReviewing] = React.useState(false);
  const [reviewError, setReviewError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/physician/checkins', { credentials: 'include', cache: 'no-store' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to load check-ins');
      }
      const data = await res.json();
      setCheckIns(Array.isArray(data.checkIns) ? data.checkIns : []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load check-ins');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const handleReview = async () => {
    if (!active) return;
    setReviewing(true);
    setReviewError(null);
    try {
      const res = await fetchWithCSRF(`/api/physician/checkins/${active.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to mark check-in reviewed');
      }
      // Remove the reviewed check-in from the list and close the dialog.
      setCheckIns((prev) => prev.filter((c) => c.id !== active.id));
      setActive(null);
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setReviewing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-ocean-50 rounded-lg">
            <ClipboardCheck className="h-6 w-6 text-ocean-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Check-in Review</h1>
            <p className="text-muted-foreground">
              Submitted weight-management check-ins awaiting your review.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Loading skeleton */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="h-5 w-48 bg-gray-100 rounded animate-pulse" />
                <div className="h-4 w-32 bg-gray-100 rounded animate-pulse mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : loadError ? (
        /* Error state */
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
              <p className="text-sm text-red-700">{loadError}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => void load()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : checkIns.length === 0 ? (
        /* Empty state */
        <Card className="text-center py-16">
          <CardContent>
            <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-7 h-7 text-emerald-600" />
            </div>
            <h3 className="text-lg font-semibold mb-1">No check-ins awaiting review</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Submitted patient check-ins will appear here for your review.
            </p>
          </CardContent>
        </Card>
      ) : (
        /* List */
        <div className="space-y-3">
          {checkIns.map((c) => (
            <Card key={c.id} className={cn('transition-shadow hover:shadow-md', c.urgent && 'border-red-300')}>
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold truncate">{c.patientName}</p>
                    {c.urgent && (
                      <Badge variant="destructive" className="text-xs">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Urgent
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Submitted {formatDateTime(c.submittedAt)}
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setReviewError(null);
                    setActive(c);
                  }}
                >
                  Review
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Review dialog */}
      <AlertDialog
        open={active !== null}
        onOpenChange={(open) => {
          if (!open && !reviewing) setActive(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              Check-in — {active?.patientName}
              {active?.urgent && (
                <Badge variant="destructive" className="text-xs">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Urgent
                </Badge>
              )}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Submitted {formatDateTime(active?.submittedAt ?? null)}. Review the patient&apos;s
              responses, then mark the check-in reviewed (the patient is notified).
            </AlertDialogDescription>
          </AlertDialogHeader>

          {active?.responses ? (
            <dl className="space-y-2 max-h-[50vh] overflow-y-auto">
              {CHECK_IN_QUESTIONS.map((q) => {
                const value = (active.responses as unknown as Record<string, unknown>)[q.id];
                const isUrgentField =
                  (q.id === 'abdominalPain' && value === true) ||
                  ((q.id === 'nauseaSeverity' || q.id === 'vomitingSeverity') && value === 'severe');
                return (
                  <div
                    key={q.id}
                    className={cn('rounded-md border p-3', isUrgentField && 'border-red-300 bg-red-50')}
                  >
                    <dt className="text-xs text-muted-foreground">{q.label}</dt>
                    <dd className={cn('text-sm font-medium mt-0.5', isUrgentField && 'text-red-700')}>
                      {responseLabel(q.id, value)}
                      {q.hint && typeof value === 'number' ? ` ${q.hint}` : ''}
                    </dd>
                  </div>
                );
              })}
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">No responses recorded for this check-in.</p>
          )}

          {reviewError && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{reviewError}</span>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={reviewing}>Cancel</AlertDialogCancel>
            <LoadingButton onClick={handleReview} loading={reviewing}>
              {reviewing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Marking reviewed…
                </>
              ) : (
                'Mark Reviewed'
              )}
            </LoadingButton>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
