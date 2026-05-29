/**
 * CrisisBanner — 988 Suicide & Crisis Lifeline notice.
 *
 * Shown inline in the GLP-1 intake when a patient reports suicidal ideation
 * (Q37) or screens positive for depression (PHQ-2, Q55–Q56). Presentational
 * only (no hooks), safe to render inside client or server components.
 */
import { AlertTriangle, Phone, MessageSquare } from 'lucide-react';

export interface CrisisBannerProps {
  /** Optional context line tailored to the trigger. */
  message?: string;
  className?: string;
}

const DEFAULT_MESSAGE =
  'Your responses suggest you may be going through a difficult time. You are not alone, and help is available right now — 24/7, free and confidential.';

export function CrisisBanner({ message, className }: CrisisBannerProps) {
  return (
    <div
      role="alert"
      className={`rounded-xl border-2 border-red-300 bg-red-50 p-5 ${className ?? ''}`}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-red-600" aria-hidden="true" />
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-red-800">
              988 Suicide &amp; Crisis Lifeline
            </p>
            <p className="mt-1 text-sm text-red-700">{message ?? DEFAULT_MESSAGE}</p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <a
              href="tel:988"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700"
            >
              <Phone className="size-4" aria-hidden="true" />
              Call 988
            </a>
            <a
              href="sms:988"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100"
            >
              <MessageSquare className="size-4" aria-hidden="true" />
              Text 988
            </a>
          </div>

          <p className="text-xs text-red-700">
            If you are in immediate danger, call <strong>911</strong> or go to your nearest
            emergency room. Rimal Health is not an emergency service.
          </p>
        </div>
      </div>
    </div>
  );
}

export default CrisisBanner;
