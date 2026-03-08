'use client';

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ChevronRight } from 'lucide-react';
import { DashboardStatus, getNextSteps } from '@/types/dashboard';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface NextStepsProps {
  status: DashboardStatus;
  className?: string;
}

// ============================================================================
// Main Component
// ============================================================================

export function NextSteps({ status, className }: NextStepsProps) {
  const steps = getNextSteps(status);
  
  return (
    <Card className={cn('h-full', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-ocean-100 text-ocean-600 text-sm font-bold">
            {steps.length}
          </span>
          Next Steps
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {steps.map((step, index) => (
            <li 
              key={index} 
              className="flex items-start gap-3 group"
            >
              <div className="mt-0.5 flex-shrink-0">
                <ChevronRight className="h-5 w-5 text-ocean-500 group-hover:translate-x-0.5 transition-transform" />
              </div>
              <span className="text-sm text-gray-700 leading-relaxed">
                {step}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export default NextSteps;
