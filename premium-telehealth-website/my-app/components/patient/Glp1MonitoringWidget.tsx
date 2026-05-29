'use client';

import * as React from 'react';
import Link from 'next/link';
import { Syringe, ClipboardCheck, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface TitrationProgress {
  currentDosage: string | null;
  currentStepNumber: number;
  totalSteps: number;
  nextDosage: string | null;
  nextAdvanceEligibleAt: string | null;
}

interface OpenCheckIn {
  id: string;
  status: 'SCHEDULED' | 'DUE';
  dueAt: string;
}

/**
 * GLP-1-only dashboard widget: shows titration progress + a check-in CTA.
 * Self-hides for patients with no active titration schedule (e.g. AUD).
 */
export function Glp1MonitoringWidget(): React.ReactElement | null {
  const [titration, setTitration] = React.useState<TitrationProgress | null>(null);
  const [openCheckIn, setOpenCheckIn] = React.useState<OpenCheckIn | null>(null);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/patient/glp1-monitoring', {
          credentials: 'include',
          cache: 'no-store',
        });
        if (res.ok && active) {
          const data = await res.json();
          setTitration(data.titration ?? null);
          setOpenCheckIn(data.openCheckIn ?? null);
        }
      } catch (err) {
        console.error('Failed to load GLP-1 monitoring:', err instanceof Error ? err.message : 'Unknown error');
      } finally {
        if (active) setLoaded(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Non-GLP-1 patients have no titration schedule → render nothing.
  if (!loaded || !titration) return null;

  return (
    <Card className="border-ocean-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Syringe className="h-4 w-4 text-ocean-600" />
          Weight management
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Current dose</p>
            <p className="text-lg font-semibold text-gray-900">
              {titration.currentDosage ?? '—'}
            </p>
          </div>
          <Badge variant="secondary" className="text-xs">
            Step {titration.currentStepNumber} of {titration.totalSteps}
          </Badge>
        </div>

        {titration.nextDosage && (
          <p className="text-sm text-gray-600">
            Next dose (when your physician advances you): {titration.nextDosage}.
            Your physician guides every dose change.
          </p>
        )}

        {openCheckIn && (
          <Link
            href="/patient/check-ins"
            className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900 hover:bg-amber-100 transition-colors"
          >
            <span className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4" />
              {openCheckIn.status === 'DUE' ? 'A check-in is due' : 'Upcoming check-in'}
            </span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
