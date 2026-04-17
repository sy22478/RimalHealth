'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

const GLOSSARY: Record<string, string> = {
  naltrexone:
    'A prescription medication that helps reduce alcohol cravings and the reward from drinking. It is not a sedative and is not addictive.',
  vivitrol:
    'A once-monthly injectable form of naltrexone given in a clinic or by a nurse.',
  lft: 'Liver Function Test — a blood test that checks how well your liver is working.',
  lfts: 'Liver Function Tests — blood tests that check how well your liver is working.',
  buprenorphine:
    'A prescription medication used to treat opioid use disorder. It interacts with naltrexone, so your physician needs to know if you take it.',
  methadone:
    'A prescription medication used to treat opioid use disorder. It interacts with naltrexone, so your physician needs to know if you take it.',
  acamprosate:
    'A prescription medication (brand name Campral) that helps some people maintain abstinence from alcohol.',
  disulfiram:
    'A prescription medication (brand name Antabuse) that causes unpleasant reactions if you drink alcohol while taking it.',
};

export interface MedicalTermProps {
  /** The lookup key for the glossary entry (lowercase). */
  term: keyof typeof GLOSSARY | string;
  /** Optional custom description override. */
  description?: string;
  /** The visible text; defaults to the term itself. */
  children?: React.ReactNode;
  className?: string;
}

/**
 * Inline tooltip that explains a clinical term in plain English.
 * Uses native title + visible popover; no external dependency.
 */
export function MedicalTerm({
  term,
  description,
  children,
  className,
}: MedicalTermProps): React.ReactElement {
  const body =
    description ?? GLOSSARY[term.toLowerCase()] ?? `${term}: no definition available.`;
  const label = children ?? term;
  const [open, setOpen] = React.useState(false);
  const id = React.useId();

  return (
    <span
      className={cn('relative inline-block', className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-describedby={open ? id : undefined}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => {
          e.preventDefault();
          setOpen((v) => !v);
        }}
        className="underline decoration-dotted underline-offset-4 decoration-ocean-500 cursor-help focus:outline-none focus-visible:ring-2 focus-visible:ring-ocean-500 rounded"
      >
        {label}
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute z-40 bottom-full left-0 mb-2 w-64 p-3 rounded-md bg-gray-900 text-white text-xs leading-relaxed shadow-lg"
        >
          {body}
        </span>
      )}
    </span>
  );
}

export default MedicalTerm;
