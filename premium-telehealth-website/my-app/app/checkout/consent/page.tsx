'use client';

/**
 * Consent Page
 *
 * Standalone page displayed before checkout payment.
 * Product-aware: the default (AUD / Naltrexone) flow requires 8 consent items
 * including 42 CFR Part 2 SUD consent. The weight-management (GLP-1) flow,
 * selected via `?product=weight-management`, requires its own 9-item consent
 * set and OMITS the 42 CFR Part 2 item (Part 2 applies to SUD records only).
 * Users must agree to all consent items for the active product before proceeding.
 * Consent record is POSTed to /api/checkout/consent before redirect.
 *
 * @module app/checkout/consent/page
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import {
  Shield,
  FileCheck,
  Lock,
  ArrowLeft,
  ArrowRight,
  Loader2,
  Stethoscope,
  CheckCircle2,
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

// ============================================
// Product types
// ============================================

type ProductType = 'ALCOHOL' | 'WEIGHT_MANAGEMENT';

/**
 * Resolve the product type from the `?product=` query param.
 * Anything other than the explicit weight-management value falls back to the
 * default AUD (alcohol) behavior — keeping the existing flow unchanged.
 */
function resolveProductType(product: string | null): ProductType {
  return product === 'weight-management' ? 'WEIGHT_MANAGEMENT' : 'ALCOHOL';
}

// ============================================
// Consent Items
// ============================================

type ConsentItem = {
  id: string;
  label: React.ReactNode;
  icon: React.ReactNode;
  description?: string;
  ariaLabel: string;
};

// AUD / Naltrexone consent set (8 required agreements) — DEFAULT, UNCHANGED.
const CONSENT_ITEMS: ConsentItem[] = [
  {
    id: 'age',
    label: 'I confirm that I am at least 18 years of age.',
    icon: <CheckCircle2 className="h-4 w-4 text-ocean" />,
    description: 'Age confirmation required for treatment eligibility',
    ariaLabel: 'I confirm that I am at least 18 years of age',
  },
  {
    id: 'california',
    label: 'I confirm that I am a current resident of California.',
    icon: <CheckCircle2 className="h-4 w-4 text-ocean" />,
    description: 'Residency confirmation required for treatment eligibility',
    ariaLabel: 'I confirm that I am a current resident of California',
  },
  {
    id: 'terms',
    label: (
      <>
        I have read and agree to the{' '}
        <a
          href="/terms"
          target="_blank"
          rel="noopener noreferrer"
          className="text-ocean-600 font-medium underline underline-offset-2 hover:text-ocean-700 transition-colors"
        >
          Terms of Service
        </a>
        .
      </>
    ),
    icon: <FileCheck className="h-4 w-4 text-ocean" />,
    description: 'Agreement to Rimal Health Terms of Service',
    ariaLabel: 'I consent to the Terms of Service',
  },
  {
    id: 'privacy',
    label: (
      <>
        I have read and agree to the{' '}
        <a
          href="/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="text-ocean-600 font-medium underline underline-offset-2 hover:text-ocean-700 transition-colors"
        >
          Privacy Policy
        </a>
        .
      </>
    ),
    icon: <Lock className="h-4 w-4 text-ocean" />,
    description: 'Agreement to Rimal Health Privacy Policy',
    ariaLabel: 'I consent to the Privacy Policy',
  },
  {
    id: 'hipaa',
    label: (
      <>
        I have read and agree to the{' '}
        <a
          href="/hipaa"
          target="_blank"
          rel="noopener noreferrer"
          className="text-ocean-600 font-medium underline underline-offset-2 hover:text-ocean-700 transition-colors"
        >
          HIPAA Notice of Privacy Practices
        </a>
        .
      </>
    ),
    icon: <Shield className="h-4 w-4 text-ocean" />,
    description: 'Agreement to HIPAA Notice of Privacy Practices',
    ariaLabel: 'I consent to HIPAA privacy practices',
  },
  {
    id: 'part2_sud_consent',
    label: (
      <div className="space-y-2">
        <p>
          I consent to the use and disclosure of my substance use disorder (SUD)
          treatment records by Rimal Health for the purposes of treatment, payment,
          and health care operations (TPO), as described below.
        </p>
        <p className="font-medium text-gray-800">I understand that:</p>
        <ul className="list-disc pl-5 space-y-1 text-gray-600">
          <li>
            My records are protected by federal confidentiality rules under
            42 CFR Part 2, which provide special protections for substance use
            disorder treatment records beyond standard HIPAA protections.
          </li>
          <li>
            By signing this consent, I authorize Rimal Health and its treating
            physicians to use and disclose my SUD treatment records to: my treating
            providers within Rimal Health, pharmacies designated for my prescriptions,
            payment processors for billing purposes, and other entities as necessary
            for treatment, payment, and health care operations.
          </li>
          <li>
            Records disclosed pursuant to this consent may be redisclosed by the
            recipient and may no longer be protected by 42 CFR Part 2.
          </li>
          <li>
            I may revoke this consent at any time by submitting a written request to{' '}
            <a
              href="mailto:support@rimalhealth.com"
              className="text-ocean-600 underline"
            >
              support@rimalhealth.com
            </a>
            , except to the extent that Rimal Health has already acted in reliance on
            my consent. Revocation of this consent may result in Rimal Health being
            unable to continue providing treatment services to me.
          </li>
          <li>
            This consent remains in effect until I revoke it in writing or until my
            treatment relationship with Rimal Health ends, whichever occurs first.
          </li>
          <li>
            My SUD treatment records cannot be used in legal proceedings against me
            without my specific consent or a court order meeting the requirements of
            42 CFR Part 2.
          </li>
          <li>
            I am not required to sign this consent. However, if I choose not to sign,
            Rimal Health may be unable to provide treatment services, as the program
            cannot share necessary treatment information with my care team and pharmacy
            without my authorization.
          </li>
        </ul>
      </div>
    ),
    icon: <Shield className="h-4 w-4 text-ocean" />,
    description: '42 CFR Part 2 consent for use and disclosure of substance use disorder treatment records',
    ariaLabel: 'I consent to 42 CFR Part 2 protections for substance use disorder records',
  },
  {
    id: 'telehealth',
    label:
      'I consent to receive telehealth services, including asynchronous physician communication and medication-assisted treatment for alcohol use disorder.',
    icon: <Stethoscope className="h-4 w-4 text-ocean" />,
    description: 'Consent to receive telehealth services',
    ariaLabel: 'I consent to receive telehealth services',
  },
  {
    id: 'informed',
    label:
      'I understand that Rimal Health provides telemedicine services and that my provider may prescribe Naltrexone 50mg as part of my treatment plan. I understand this is not an emergency service.',
    icon: <FileCheck className="h-4 w-4 text-ocean" />,
    description: 'Informed consent for Naltrexone treatment',
    ariaLabel: 'I consent to informed treatment with Naltrexone',
  },
];

// GLP-1 weight-management consent set (9 required agreements).
// Intentionally OMITS the 42 CFR Part 2 SUD consent — Part 2 protections apply
// to substance use disorder records only, not to weight-management care.
const GLP1_CONSENT_ITEMS: ConsentItem[] = [
  {
    id: 'telehealth',
    label:
      'I consent to receive weight-management care through telehealth, including asynchronous communication with my provider and remote evaluation, prescribing, and follow-up. I understand I will not be physically examined in person and that care is delivered online.',
    icon: <Stethoscope className="h-4 w-4 text-ocean" />,
    description: 'Consent to the telehealth nature of weight-management care',
    ariaLabel: 'I consent to receive weight-management care through telehealth',
  },
  {
    id: 'glp1_side_effects',
    label:
      'I have been informed of the common and serious side effects of GLP-1 medications (such as semaglutide and tirzepatide), including nausea, vomiting, diarrhea, constipation, injection-site reactions, gallbladder problems, pancreatitis, kidney injury from dehydration, and a boxed warning for risk of thyroid C-cell tumors. I understand these medications are contraindicated in people with a personal or family history of medullary thyroid carcinoma or Multiple Endocrine Neoplasia syndrome type 2 (MEN 2).',
    icon: <FileCheck className="h-4 w-4 text-ocean" />,
    description: 'Disclosure of GLP-1 medication side effects and contraindications',
    ariaLabel: 'I acknowledge the disclosed side effects and risks of GLP-1 medications',
  },
  {
    id: 'retinopathy_monitoring',
    label:
      'I understand that rapid improvement in blood sugar with GLP-1 therapy can be associated with worsening of diabetic retinopathy. I agree to disclose any history of eye disease and to obtain ongoing eye monitoring as recommended by my provider, and to report any changes in my vision promptly.',
    icon: <CheckCircle2 className="h-4 w-4 text-ocean" />,
    description: 'Commitment to retinopathy and vision monitoring during GLP-1 therapy',
    ariaLabel: 'I commit to retinopathy and vision monitoring during GLP-1 therapy',
  },
  {
    id: 'emergency_situations',
    label:
      'I understand that Rimal Health is not an emergency service and does not provide urgent or crisis care. If I experience a medical emergency I will call 911, and if I experience a mental-health crisis or thoughts of self-harm I will call or text 988 (the Suicide and Crisis Lifeline) or go to the nearest emergency room.',
    icon: <Shield className="h-4 w-4 text-ocean" />,
    description: 'Acknowledgement of emergency and crisis instructions (911 / 988)',
    ariaLabel: 'I understand emergency situations require 911 or 988, not Rimal Health',
  },
  {
    id: 'mental_health_warning',
    label:
      'I have been advised that GLP-1 medications may be associated with changes in mood, including depression and thoughts of self-harm. I agree to monitor my mental health and to promptly report any new or worsening depression, anxiety, or suicidal thoughts to my provider or to seek emergency help by calling or texting 988.',
    icon: <Stethoscope className="h-4 w-4 text-ocean" />,
    description: 'Mental-health warning and reporting commitment for GLP-1 therapy',
    ariaLabel: 'I acknowledge the mental-health warning for GLP-1 therapy',
  },
  {
    id: 'surgery_notification',
    label:
      'I agree to notify my provider and any surgeon or anesthesiologist before any scheduled surgery, procedure, or sedation that I am taking a GLP-1 medication. I understand that because these medications delay stomach emptying, my care team may instruct me to pause my medication beforehand to reduce the risk of complications under anesthesia.',
    icon: <FileCheck className="h-4 w-4 text-ocean" />,
    description: 'Obligation to notify providers before surgery or procedures (anesthesia hold)',
    ariaLabel: 'I agree to notify providers about GLP-1 use before surgery or procedures',
  },
  {
    id: 'long_term_therapy',
    label:
      'I understand that weight management with GLP-1 medications is generally a long-term therapy, that weight regain is common if treatment is stopped, and that achieving and maintaining results depends on ongoing medication, lifestyle changes, and follow-up care rather than a short-term course of treatment.',
    icon: <CheckCircle2 className="h-4 w-4 text-ocean" />,
    description: 'Acknowledgement that GLP-1 weight management is a long-term therapy',
    ariaLabel: 'I understand GLP-1 weight management is a long-term therapy',
  },
  {
    id: 'pharmacy_prescribing',
    label:
      'I authorize Rimal Health providers to evaluate me and, when clinically appropriate, to issue prescriptions for GLP-1 medications and to transmit those prescriptions to a licensed pharmacy on my behalf. I understand the prescribing decision is at my provider’s clinical discretion, that no specific medication or dose is guaranteed, and that pharmacy pricing and availability may vary.',
    icon: <FileCheck className="h-4 w-4 text-ocean" />,
    description: 'Consent to GLP-1 prescribing and transmission of prescriptions to a pharmacy',
    ariaLabel: 'I consent to GLP-1 prescribing and pharmacy transmission',
  },
  {
    id: 'california',
    label:
      'I confirm that I am a current resident of California and that I am physically located in California at the time I receive care, as Rimal Health is only able to provide treatment to California residents.',
    icon: <CheckCircle2 className="h-4 w-4 text-ocean" />,
    description: 'California residency and location confirmation required for treatment eligibility',
    ariaLabel: 'I confirm I am a California resident located in California',
  },
];

/** Return the consent item set for the active product type. */
function getConsentItems(productType: ProductType): ConsentItem[] {
  return productType === 'WEIGHT_MANAGEMENT' ? GLP1_CONSENT_ITEMS : CONSENT_ITEMS;
}

// ============================================
// Animated Checkbox Component
// ============================================

function ConsentCheckbox({
  id,
  checked,
  onCheckedChange,
  describedBy,
  'aria-label': ariaLabel,
}: {
  id: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  describedBy?: string;
  'aria-label'?: string;
}): React.ReactElement {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-describedby={describedBy}
      aria-label={ariaLabel}
      aria-required="true"
      id={id}
      onClick={() => onCheckedChange(!checked)}
      className={`
        relative mt-0.5 h-6 w-6 min-h-[44px] min-w-[44px] shrink-0 rounded-md border-2 transition-all duration-200
        flex items-center justify-center
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean focus-visible:ring-offset-2
        ${checked
          ? 'border-ocean bg-ocean'
          : 'border-gray-300 bg-white hover:border-ocean-300'
        }
      `}
    >
      <svg
        className={`
          h-5 w-5 text-white p-0.5
          transition-all duration-200
          ${checked ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}
        `}
        style={{
          transitionTimingFunction: checked ? 'cubic-bezier(0.175, 0.885, 0.32, 1.275)' : 'ease-out',
        }}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={3}
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    </button>
  );
}

// ============================================
// Progress Step Indicator
// ============================================

function ProgressSteps({ currentStep }: { currentStep: number }): React.ReactElement {
  const steps = [
    { number: 1, label: 'Consent' },
    { number: 2, label: 'Payment' },
    { number: 3, label: 'Account' },
  ];

  return (
    <nav aria-label="Checkout progress">
      <div className="flex items-center justify-center gap-0" role="list">
        {steps.map((step, index) => (
          <React.Fragment key={step.number}>
            <div className="flex items-center gap-2" role="listitem">
              <span
                className={`
                  flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all duration-300
                  ${step.number < currentStep
                    ? 'bg-success-500 text-white'
                    : step.number === currentStep
                      ? 'bg-ocean text-white shadow-md shadow-ocean/30'
                      : 'bg-gray-100 text-gray-400 border border-gray-200'
                  }
                `}
                aria-hidden="true"
              >
                {step.number < currentStep ? (
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  step.number
                )}
              </span>
              <span
                className={`text-sm font-medium hidden sm:inline ${
                  step.number === currentStep ? 'text-ocean-600' : step.number < currentStep ? 'text-success-600' : 'text-gray-400'
                }`}
              >
                {step.label}
                {step.number === currentStep && <span className="sr-only"> (current step)</span>}
                {step.number < currentStep && <span className="sr-only"> (completed)</span>}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`mx-3 h-px w-8 sm:w-12 transition-colors duration-300 ${
                  step.number < currentStep ? 'bg-success-500' : 'bg-gray-200'
                }`}
                aria-hidden="true"
              />
            )}
          </React.Fragment>
        ))}
      </div>
      <div aria-live="polite" className="sr-only">
        Step {currentStep} of {steps.length}: {steps[currentStep - 1]?.label}
      </div>
    </nav>
  );
}

// ============================================
// Inner Content Component (uses useSearchParams)
// ============================================

function ConsentContent(): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();

  const productType = resolveProductType(searchParams.get('product'));
  const consentItems = getConsentItems(productType);

  const [consents, setConsents] = React.useState<Record<string, boolean>>({});
  const [patientName, setPatientName] = React.useState<string>('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const checkedCount = consentItems.filter((item) => consents[item.id]).length;
  const allConsentsChecked = checkedCount === consentItems.length;
  const trimmedName = patientName.trim();
  const nameValid = trimmedName.length >= 2;
  const canSubmit = allConsentsChecked && nameValid;

  const handleConsentToggle = (id: string, checked: boolean): void => {
    setConsents((prev) => ({ ...prev, [id]: checked }));
    setError(null);
  };

  const handleContinue = async (): Promise<void> => {
    if (!canSubmit || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Build the consents payload from the active product's item set. For the
      // default AUD flow this yields exactly the same 8 keys as before; for the
      // GLP-1 flow it yields the weight-management key set (no 42 CFR Part 2).
      const consentPayload = consentItems.reduce<Record<string, boolean>>(
        (acc, item) => {
          acc[item.id] = consents[item.id] ?? false;
          return acc;
        },
        {}
      );

      // POST consent record to backend before redirecting.
      // `productType` is only sent for GLP-1; the AUD flow omits it so the
      // request body and behavior remain unchanged.
      const requestBody: {
        consents: Record<string, boolean>;
        patientName: string;
        timestamp: string;
        productType?: 'WEIGHT_MANAGEMENT';
      } = {
        consents: consentPayload,
        patientName: trimmedName,
        timestamp: new Date().toISOString(),
      };
      if (productType === 'WEIGHT_MANAGEMENT') {
        requestBody.productType = 'WEIGHT_MANAGEMENT';
      }

      const response = await fetch('/api/checkout/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(data.error ?? 'Unable to record your consent. Please try again.');
        setIsSubmitting(false);
        return;
      }

      const data = (await response.json()) as { consentRecordId?: string };
      if (data.consentRecordId) {
        try {
          sessionStorage.setItem('consentRecordId', data.consentRecordId);
        } catch {
          // sessionStorage may be unavailable; proceed anyway
        }
      }
    } catch {
      setError('Network error. Please check your connection and try again.');
      setIsSubmitting(false);
      return;
    }

    // Preserve any query params (e.g., ?plan=active-treatment, ?product=...) and pass consentId
    const plan = searchParams.get('plan');
    const product = searchParams.get('product');
    const params = new URLSearchParams();
    if (plan) {
      params.set('plan', plan);
    }
    if (product) {
      params.set('product', product);
    }
    // Retrieve consentRecordId to pass through the checkout flow
    let consentId: string | null = null;
    try {
      consentId = sessionStorage.getItem('consentRecordId');
    } catch {
      // sessionStorage may be unavailable
    }
    if (consentId) {
      params.set('consentId', consentId);
    }
    const qs = params.toString();
    const paymentUrl = qs ? `/checkout/payment?${qs}` : '/checkout/payment';

    router.push(paymentUrl);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-ocean-50/40 via-white to-white">
      <div className="container mx-auto max-w-2xl py-10 px-4 sm:py-14 sm:px-6">
        {/* Progress indicator */}
        <div className="mb-8">
          <ProgressSteps currentStep={1} />
        </div>

        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-ocean-50 border border-ocean-100">
            <Shield className="h-7 w-7 text-ocean" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-navy sm:text-4xl">
            Your Privacy & Rights
          </h1>
          <p className="mt-3 text-base text-muted-foreground sm:text-lg max-w-md mx-auto">
            We take your privacy seriously. Please review and agree to the following before proceeding.
          </p>
        </div>

        {/* Consent Card */}
        <Card className="shadow-lg border-gray-200/80 overflow-hidden">
          <CardHeader className="pb-3 bg-gradient-to-r from-ocean-50/50 to-transparent">
            <CardTitle className="flex items-center gap-2 text-lg text-navy">
              <FileCheck className="h-5 w-5 text-ocean" />
              Consent & Agreements
            </CardTitle>
            <CardDescription>
              All {consentItems.length} items are required to continue.
              <span className="ml-2 inline-flex items-center text-xs font-medium text-ocean">
                {checkedCount}/{consentItems.length} completed
              </span>
            </CardDescription>
          </CardHeader>

          <Separator />

          <CardContent className="pt-6 space-y-4" role="group" aria-label="Required consent agreements">
            {consentItems.map((item) => {
              const isChecked = !!consents[item.id];
              const labelId = `consent-label-${item.id}`;
              const descId = item.description ? `consent-desc-${item.id}` : undefined;
              return (
                <div
                  key={item.id}
                  className={`
                    flex items-start gap-3 rounded-lg p-3 min-h-[44px] transition-all duration-200 cursor-pointer
                    ${isChecked
                      ? 'bg-ocean-50/50 border border-ocean-100'
                      : 'bg-transparent border border-transparent hover:bg-gray-50'
                    }
                  `}
                  onClick={() => handleConsentToggle(item.id, !isChecked)}
                >
                  <ConsentCheckbox
                    id={`consent-${item.id}`}
                    checked={isChecked}
                    onCheckedChange={(checked) => handleConsentToggle(item.id, checked)}
                    describedBy={[labelId, descId].filter(Boolean).join(' ')}
                    aria-label={item.ariaLabel}
                  />
                  <div className="flex-1">
                    <Label
                      id={labelId}
                      htmlFor={`consent-${item.id}`}
                      className="text-sm leading-relaxed cursor-pointer text-gray-700 select-none"
                    >
                      {item.label}
                    </Label>
                    {item.description && (
                      <span id={descId} className="sr-only">
                        {item.description}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>

          {/* Progress bar */}
          <div className="px-6 pb-2">
            <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-ocean to-ocean-400 transition-all duration-500 ease-out"
                style={{ width: `${(checkedCount / consentItems.length) * 100}%` }}
              />
            </div>
          </div>

          <Separator className="mt-4" />

          {/* Electronic signature — typed full name (42 CFR §2.31(a)(8)) */}
          <div className="px-6 pt-6 pb-2">
            <Label
              htmlFor="patient-signature"
              className="text-sm font-semibold text-navy mb-1 block"
            >
              Electronic signature
            </Label>
            <p className="text-xs text-muted-foreground mb-3">
              Type your full legal name below. This serves as your electronic
              signature for the agreements above and is required by 42 CFR Part 2
              for substance use disorder treatment consent.
            </p>
            <input
              id="patient-signature"
              type="text"
              value={patientName}
              onChange={(e) => {
                setPatientName(e.target.value);
                setError(null);
              }}
              placeholder="Your full legal name"
              autoComplete="name"
              required
              aria-required="true"
              aria-invalid={patientName.length > 0 && !nameValid}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 shadow-sm transition-colors focus:border-ocean focus:outline-none focus:ring-2 focus:ring-ocean/30"
            />
          </div>

          <CardFooter className="flex flex-col gap-4 pt-6">
            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}
            <Button
              className="w-full rounded-full h-12 text-base font-semibold bg-gradient-to-r from-navy-500 to-ocean-500 hover:from-navy-600 hover:to-ocean-500 shadow-lg shadow-ocean/20 transition-all duration-200 hover:shadow-xl hover:shadow-ocean/30"
              size="lg"
              onClick={handleContinue}
              disabled={!canSubmit || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  Continue to Payment
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>

            <Link
              href="/"
              className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-navy transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Link>
          </CardFooter>
        </Card>

        {/* Trust Indicators */}
        <div className="mt-10">
          <div className="rounded-xl bg-gray-50/80 border border-gray-100 px-6 py-5">
            <div className="flex flex-wrap items-center justify-center gap-8 text-sm text-muted-foreground">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white border border-gray-200 shadow-sm">
                  <Shield className="h-4 w-4 text-navy" />
                </div>
                <span className="font-medium text-gray-600">HIPAA Compliant</span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white border border-gray-200 shadow-sm">
                  <Lock className="h-4 w-4 text-navy" />
                </div>
                <span className="font-medium text-gray-600">AES-256 Encrypted</span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white border border-gray-200 shadow-sm">
                  <Stethoscope className="h-4 w-4 text-navy" />
                </div>
                <span className="font-medium text-gray-600">Licensed Physicians</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Main Export with Suspense Wrapper
// ============================================

export default function CheckoutConsentPage(): React.ReactElement {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-ocean-50/40 via-white to-white">
          <div className="animate-pulse text-center">
            <div className="h-8 w-48 bg-gray-200 rounded mx-auto mb-4" />
            <div className="h-4 w-64 bg-gray-200 rounded mx-auto" />
          </div>
        </div>
      }
    >
      <ConsentContent />
    </Suspense>
  );
}
