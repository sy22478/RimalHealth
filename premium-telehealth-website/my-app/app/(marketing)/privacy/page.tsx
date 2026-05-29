import type { Metadata } from "next";

export const experimental_ppr = true;

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Rimal Health Privacy Policy — how we collect, use, and protect your personal and health information.",
};

const lastUpdated = "May 27, 2026";

export default function PrivacyPolicyPage() {
  return (
    <article className="py-20 px-4">
      <div className="max-w-3xl mx-auto">
        <header className="mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            Privacy Policy
          </h1>
          <p className="text-sm text-gray-500">Last updated: {lastUpdated}</p>
        </header>

        <div className="prose prose-gray max-w-none space-y-10 text-base text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              1. Introduction
            </h2>
            <p>
              Rimal Health (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;)
              is committed to protecting your privacy. This Privacy Policy
              explains how we collect, use, disclose, and safeguard your
              information when you use our telehealth services. Please read this
              policy carefully. If you disagree with its terms, please
              discontinue use of our site.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              2. Information We Collect
            </h2>
            <p className="mb-3">We may collect the following information:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Personal identification information</strong> — name,
                email address, phone number, date of birth
              </li>
              <li>
                <strong>Health information</strong> — medical history, current
                medications, substance use history, treatment goals (protected
                health information / PHI under HIPAA)
              </li>
              <li>
                <strong>Height, weight, and body mass index (BMI)</strong> —
                collected during the weight-management (GLP-1) intake
              </li>
              <li>
                <strong>Biological sex</strong> — used for clinical assessment
                and weight-management dosing
              </li>
              <li>
                <strong>
                  Weight-management medication history and current GLP-1
                  treatment data
                </strong>{" "}
                — including prior weight-management medications and your current
                GLP-1 treatment status
              </li>
              <li>
                <strong>Titration schedule and dosing progress</strong> — your
                GLP-1 dose level and dose-adjustment history
              </li>
              <li>
                <strong>Check-in responses</strong> — self-reported weight
                changes, side effects, and medication adherence
              </li>
              <li>
                <strong>Lab results</strong> — laboratory results you upload for
                treatment monitoring
              </li>
              <li>
                <strong>
                  Eligibility and contraindication screening answers
                </strong>{" "}
                — responses used to determine your suitability for
                weight-management (GLP-1) treatment
              </li>
              <li>
                <strong>Payment information</strong> — processed securely
                through our third-party payment processor; we do not store full
                card numbers
              </li>
              <li>
                <strong>Usage data</strong> — IP address, browser type, pages
                visited, and time spent on pages
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              3. How We Use Your Information
            </h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>To provide and manage your telehealth care</li>
              <li>
                To facilitate physician review of your intake and prescription
                management
              </li>
              <li>To communicate with you about your treatment</li>
              <li>To process payments</li>
              <li>To improve our services</li>
              <li>
                To comply with legal obligations, including HIPAA requirements
              </li>
            </ul>
            <p className="mt-3">
              These uses apply to all treatment we provide, including both
              alcohol use disorder treatment and weight-management (GLP-1)
              treatment. Weight-management treatment data is not a substance use
              disorder record and is therefore not subject to 42 CFR Part 2;
              however, it remains protected health information under HIPAA and
              applicable state privacy law. See Section 5 for details on which
              records receive the additional protections of 42 CFR Part 2.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              4. HIPAA Compliance
            </h2>
            <p>
              Your protected health information (PHI) is handled in accordance
              with the Health Insurance Portability and Accountability Act
              (HIPAA). We implement appropriate administrative, physical, and
              technical safeguards to protect PHI. For details on your rights
              under HIPAA, please see our{" "}
              <a href="/hipaa" className="text-ocean-600 hover:underline">
                HIPAA Notice of Privacy Practices
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              5. Substance Use Disorder Record Protections (42 CFR Part 2)
            </h2>
            <p className="mb-3">
              Because Rimal Health provides treatment for substance use
              disorders, your treatment records receive additional federal
              protections under 42 CFR Part 2, the Confidentiality of
              Substance Use Disorder Patient Records regulation.
            </p>
            <p className="mb-3">
              Rimal Health also provides weight-management treatment using GLP-1
              medications. Weight-management treatment records are not substance
              use disorder records and are therefore not subject to 42 CFR
              Part 2. These records remain fully protected as PHI under the
              HIPAA Privacy Rule and applicable state privacy law. The
              heightened 42 CFR Part 2 protections described in this section
              apply only to your alcohol use disorder treatment records.
            </p>
            <p className="mb-3">These Part 2 protections mean:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                We will not disclose your SUD treatment records without your
                specific written consent, except in limited circumstances
                permitted by law (such as medical emergencies or qualified
                audits).
              </li>
              <li>
                Your SUD records cannot be used against you in any legal
                proceeding without your consent or a qualifying court order.
              </li>
              <li>
                When we share your records with your consent (for example,
                with your pharmacy or treating physician), we include a notice
                prohibiting unauthorized redisclosure.
              </li>
              <li>
                You have the right to an accounting of disclosures of your SUD
                records and the right to request restrictions on how your
                records are used or disclosed.
              </li>
            </ul>
            <p className="mt-3">
              For full details on these protections, please review our{" "}
              <a href="/hipaa" className="text-ocean-600 hover:underline">
                HIPAA Notice of Privacy Practices
              </a>
              , which includes our 42 CFR Part 2 Patient Notice.
            </p>
            <p className="mt-3">
              These protections apply in addition to, and not in place of, the
              general privacy protections described elsewhere in this Privacy
              Policy. Where 42 CFR Part 2 provides greater protection than
              HIPAA, the more protective standard applies to your SUD
              treatment records.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              6. Information Sharing
            </h2>
            <p className="mb-3">
              We do not sell your personal information. We may share your
              information with:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Healthcare providers</strong> — your treating physician
                and pharmacy, as needed for your care
              </li>
              <li>
                <strong>Service providers</strong> — third-party vendors who
                assist in operating our platform (all bound by confidentiality
                agreements)
              </li>
              <li>
                <strong>Legal requirements</strong> — when required by law,
                court order, or governmental authority
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              7. Data Security
            </h2>
            <p>
              We use industry-standard encryption (TLS/SSL) for all data in
              transit and AES-256 encryption for data at rest. Access to PHI is
              restricted to personnel who need it to provide your care. We
              conduct regular security audits and maintain HIPAA-compliant
              infrastructure.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              8. Cookies &amp; Tracking
            </h2>
            <p>
              We use cookies and similar tracking technologies to improve your
              experience, analyze site traffic, and understand where our
              visitors come from. You can control cookie settings through your
              browser preferences.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              9. Your Rights
            </h2>
            <p className="mb-3">You have the right to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Access the personal information we hold about you</li>
              <li>Request correction of inaccurate information</li>
              <li>Request deletion of your information (subject to legal requirements)</li>
              <li>Opt out of marketing communications at any time</li>
              <li>
                File a complaint with the U.S. Department of Health &amp; Human
                Services if you believe your HIPAA rights have been violated
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              10. Contact Us
            </h2>
            <p>
              For privacy-related questions or to exercise your rights, contact
              us at:{" "}
              <a
                href="mailto:support@rimalhealth.com"
                className="text-ocean-600 hover:underline"
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
