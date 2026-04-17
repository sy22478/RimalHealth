import type { Metadata } from "next";

export const experimental_ppr = true;

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Rimal Health Terms of Service — the agreement governing your use of our telehealth platform.",
};

const lastUpdated = "February 1, 2026";

export default function TermsOfServicePage() {
  return (
    <article className="py-20 px-4">
      <div className="max-w-3xl mx-auto">
        <header className="mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            Terms of Service
          </h1>
          <p className="text-sm text-gray-500">Last updated: {lastUpdated}</p>
        </header>

        <div className="space-y-10 text-base text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              1. Acceptance of Terms
            </h2>
            <p>
              By accessing or using the Rimal Health platform, you agree to be
              bound by these Terms of Service and all applicable laws and
              regulations. If you do not agree, please do not use our services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              2. Service Description
            </h2>
            <p>
              Rimal Health provides an asynchronous telehealth platform
              connecting California residents with California-licensed physicians
              for medication-assisted treatment of alcohol use disorder. Our services include intake review,
              prescription management, and ongoing physician messaging.
            </p>
            <p className="mt-3">
              <strong>Important limitation:</strong> Rimal Health is not an
              emergency medical service. In a medical emergency, call 911
              immediately.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              3. Eligibility
            </h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>You must be 18 years of age or older</li>
              <li>You must be a current California resident</li>
              <li>
                You must not require immediate medical detoxification or
                inpatient care
              </li>
              <li>
                You must provide accurate and complete medical information during
                intake
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              4. Not a Substitute for Emergency Care
            </h2>
            <p>
              Our services are not appropriate for medical emergencies, active
              suicidal ideation, severe alcohol withdrawal (including seizures or
              delirium tremens), or any condition requiring immediate in-person
              medical attention. If you are experiencing a medical emergency,
              call 911 or go to the nearest emergency room.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              5. Subscription and Billing
            </h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                Services are billed monthly at the rate disclosed at sign-up
              </li>
              <li>
                You may cancel your subscription at any time; access continues
                through the end of your paid period
              </li>
              <li>
                Medication costs are separate and billed by your pharmacy
              </li>
              <li>
                If our physician determines you are not an appropriate candidate
                after intake review, you will receive a full refund
              </li>
              <li>
                30-day money-back guarantee: if our service isn&apos;t the right fit
                for you within your first 30 days, contact support for a full refund
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              6. User Responsibilities
            </h2>
            <p className="mb-3">You agree to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Provide truthful and complete medical information</li>
              <li>Notify your physician of any changes in your health status</li>
              <li>Use medications only as prescribed</li>
              <li>Not share your account or medications with others</li>
              <li>
                Contact us immediately if you experience adverse effects
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              7. Medical Disclaimer
            </h2>
            <p>
              The content on this site is for informational purposes only and
              does not constitute medical advice. A physician-patient
              relationship is only established upon acceptance of your intake by
              one of our licensed physicians. Treatment outcomes vary and are not
              guaranteed.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              8. Intellectual Property
            </h2>
            <p>
              All content, trademarks, and materials on this platform are the
              property of Rimal Health and may not be reproduced without express
              written permission.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              9. Limitation of Liability
            </h2>
            <p>
              To the maximum extent permitted by law, Rimal Health shall not be
              liable for indirect, incidental, special, or consequential damages
              arising from use of our services. Our total liability shall not
              exceed the amount paid by you in the three months prior to the
              claim.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              10. Governing Law
            </h2>
            <p>
              These Terms are governed by the laws of the State of California.
              Any disputes shall be resolved in the courts of California.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              11. Contact
            </h2>
            <p>
              Questions about these Terms?{" "}
              <a
                href="mailto:support@rimalhealth.com"
                className="text-ocean-500 hover:underline"
              >
                support@rimalhealth.com
              </a>
            </p>
          </section>
        </div>
      </div>
    </article>
  );
}
