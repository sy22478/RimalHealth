'use client';

import * as React from 'react';
import { TrendingUp, AlertCircle, CheckCircle2, RefreshCw, ArrowRight, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
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

interface StepReady {
  stepId: string;
  scheduleId: string;
  patientName: string;
  fromDosage: string;
  toDosage: string;
}

export default function TitrationReviewClient(): React.ReactElement {
  const [steps, setSteps] = React.useState<StepReady[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [active, setActive] = React.useState<StepReady | null>(null);
  const [approving, setApproving] = React.useState(false);
  const [approveError, setApproveError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/physician/titration/steps', { credentials: 'include', cache: 'no-store' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to load titration steps');
      }
      const data = await res.json();
      setSteps(Array.isArray(data.steps) ? data.steps : []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load titration steps');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const handleApprove = async () => {
    if (!active) return;
    setApproving(true);
    setApproveError(null);
    try {
      const res = await fetchWithCSRF(`/api/physician/titration/steps/${active.stepId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to approve dose advance');
      }
      setSteps((prev) => prev.filter((s) => s.stepId !== active.stepId));
      setActive(null);
    } catch (err) {
      setApproveError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setApproving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-ocean-50 rounded-lg">
            <TrendingUp className="h-6 w-6 text-ocean-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Titration Review</h1>
            <p className="text-muted-foreground">
              GLP-1 dose advances ready for your approval.
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
                <div className="h-4 w-40 bg-gray-100 rounded animate-pulse mt-2" />
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
      ) : steps.length === 0 ? (
        /* Empty state */
        <Card className="text-center py-16">
          <CardContent>
            <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-7 h-7 text-emerald-600" />
            </div>
            <h3 className="text-lg font-semibold mb-1">No dose advances ready</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Titration steps become reviewable once a patient&apos;s current dose duration has elapsed.
            </p>
          </CardContent>
        </Card>
      ) : (
        /* List */
        <div className="space-y-3">
          {steps.map((s) => (
            <Card key={s.stepId} className="transition-shadow hover:shadow-md">
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{s.patientName}</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
                    <span className="font-medium text-foreground">{s.fromDosage}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                    <span className="font-medium text-foreground">{s.toDosage}</span>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setApproveError(null);
                    setActive(s);
                  }}
                >
                  Review advance
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Approve dialog — makes the dose-advance consequence explicit */}
      <AlertDialog
        open={active !== null}
        onOpenChange={(open) => {
          if (!open && !approving) setActive(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve dose advance?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  This <strong>advances {active?.patientName}&apos;s dose</strong> from{' '}
                  <strong>{active?.fromDosage}</strong> to <strong>{active?.toDosage}</strong>. It
                  marks the new step as current and rolls the prescription&apos;s supply window
                  forward. This action is logged and cannot be undone.
                </p>
                <div className="flex items-center justify-center gap-3 rounded-md border bg-gray-50 p-3 text-sm font-medium">
                  <span>{active?.fromDosage}</span>
                  <ArrowRight className="h-4 w-4 text-ocean-600" />
                  <span className="text-ocean-700">{active?.toDosage}</span>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          {approveError && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{approveError}</span>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={approving}>Cancel</AlertDialogCancel>
            <LoadingButton onClick={handleApprove} loading={approving}>
              {approving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Advancing dose…
                </>
              ) : (
                'Confirm & advance dose'
              )}
            </LoadingButton>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
