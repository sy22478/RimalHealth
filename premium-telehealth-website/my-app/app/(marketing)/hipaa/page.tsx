import type { Metadata } from "next";

export const experimental_ppr = true;

export const metadata: Metadata = {
  title: "HIPAA Notice of Privacy Practices",
  description:
    "Rimal Health HIPAA Notice of Privacy Practices — your rights regarding protected health information.",
};

const lastUpdated = "February 1, 2026";

export default function HIPAANoticePage() {
  return (
    <article className="py-20 px-4">
      <div className="max-w-3xl mx-auto">
        <header className="mb-12">
          <div className="inline-block bg-ocean-500/10 text-ocean-600 text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full mb-4">
            Required by Federal Law
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            HIPAA Notice of Privacy Practices
          </h1>
          <p className="text-sm text-gray-500">Last updated: {lastUpdated}</p>
          <p className="mt-4 text-base text-gray-600">
            This notice describes how medical information about you may be used
            and disclosed and how you can get access to this information. Please
            review it carefully.
          </p>
        </header>

        <div className="space-y-10 text-base text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              Our Duties
            </h2>
            <p>
              Rimal Health is required by law to maintain the privacy of
              protected health information (PHI), provide you with notice of our
              legal duties and privacy practices, and notify you in the event of
              a breach of your unsecured PHI. We are required to follow the
              terms of the notice currently in effect.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              How We May Use and Disclose Your PHI
            </h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-gray-900">Treatment</h3>
                <p>
                  We may use and disclose your PHI to provide, coordinate, or
                  manage your healthcare. For example, we may share your
                  information with your pharmacy to fill a prescription.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">
                  Payment
                </h3>
                <p>
                  We may use your PHI to bill and collect payment for services.
                  Note: We do not bill insurance for our $50/month service fee;
                  however, your pharmacy may bill insurance for medications.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">
                  Healthcare Operations
                </h3>
                <p>
                  We may use your PHI for internal operations such as quality
                  improvement, training, and business management, consistent with
                  HIPAA requirements.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">
                  Required by Law
                </h3>
                <p>
                  We will disclose your PHI when required to do so by federal,
                  state, or local law, such as mandatory reporting requirements.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              Uses and Disclosures Requiring Authorization
            </h2>
            <p>
              We will obtain your written authorization before using or
              disclosing your PHI for purposes not described above, including:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Marketing communications</li>
              <li>Sale of your PHI</li>
              <li>Most uses of psychotherapy notes</li>
              <li>Substance use disorder treatment records (42 CFR Part 2)</li>
            </ul>
            <p className="mt-3">
              You may revoke an authorization at any time in writing.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              Special Protections for Substance Use Disorder Records (42 CFR Part 2)
            </h2>
            <p className="mb-4">
              Rimal Health is a substance use disorder (SUD) treatment program.
              As such, your treatment records are protected by federal
              confidentiality regulations at 42 CFR Part 2, in addition to the
              HIPAA Privacy Rule. These regulations provide heightened
              protections for your SUD treatment records.
            </p>

            <h3 className="font-semibold text-gray-900 mt-6 mb-3">
              How 42 CFR Part 2 Protects Your Records
            </h3>
            <ul className="list-disc pl-6 space-y-3">
              <li>
                <strong>Consent Required for Most Disclosures:</strong>{" "}
                Generally, Rimal Health cannot disclose your SUD treatment
                records without your specific written consent, except in
                limited circumstances such as a medical emergency, to
                qualified personnel for audit or evaluation purposes, or as
                required by a court order that meets the requirements of 42
                CFR Part 2.
              </li>
              <li>
                <strong>Single Consent for Treatment, Payment, and Operations:</strong>{" "}
                With your written consent, Rimal Health may use and disclose
                your SUD treatment records for treatment, payment, and health
                care operations (TPO). This consent covers future disclosures
                for these purposes and remains in effect until you revoke it
                or your treatment relationship ends.
              </li>
              <li>
                <strong>Protection in Legal Proceedings:</strong>{" "}
                Your SUD treatment records cannot be used in any civil,
                criminal, administrative, or legislative proceeding against
                you unless you provide specific written consent or a court
                issues an order meeting the requirements of 42 CFR Part 2
                (Subpart E). This protection applies even if your records are
                subpoenaed.
              </li>
              <li>
                <strong>Redisclosure Limitations:</strong>{" "}
                When your records are disclosed with your consent, recipients
                are notified that the records are protected by 42 CFR Part 2
                and that unauthorized redisclosure is prohibited. However,
                once records are disclosed pursuant to your TPO consent,
                recipients who are HIPAA covered entities or business
                associates may further use and disclose the records in
                accordance with HIPAA regulations.
              </li>
            </ul>

            <h3 className="font-semibold text-gray-900 mt-6 mb-3">
              Your Rights Under 42 CFR Part 2
            </h3>
            <ul className="list-disc pl-6 space-y-3">
              <li>
                <strong>Right to Revoke Consent:</strong>{" "}
                You may revoke your consent to use and disclose your SUD
                treatment records at any time by submitting a written request
                to{" "}
                <a
                  href="mailto:support@rimalhealth.com"
                  className="text-ocean-600 hover:underline"
                >
                  support@rimalhealth.com
                </a>
                . Revocation is not effective for disclosures already made in
                reliance on your consent. Please note that revoking consent
                may affect our ability to continue providing treatment.
              </li>
              <li>
                <strong>Right to an Accounting of Disclosures:</strong>{" "}
                You have the right to receive a list of disclosures of your
                SUD treatment records made with your written consent for up
                to three (3) years prior to your request. To request an
                accounting, contact us at{" "}
                <a
                  href="mailto:support@rimalhealth.com"
                  className="text-ocean-600 hover:underline"
                >
                  support@rimalhealth.com
                </a>
                .
              </li>
              <li>
                <strong>Right to Request Restrictions:</strong>{" "}
                You may request that Rimal Health restrict certain uses or
                disclosures of your SUD treatment records. We are not required
                to agree to all restrictions, but we will consider your request
                and notify you of our decision. To request a restriction,
                contact us at{" "}
                <a
                  href="mailto:support@rimalhealth.com"
                  className="text-ocean-600 hover:underline"
                >
                  support@rimalhealth.com
                </a>
                .
              </li>
            </ul>

            <h3 className="font-semibold text-gray-900 mt-6 mb-3">
              Complaints
            </h3>
            <p>
              If you believe your rights under 42 CFR Part 2 have been
              violated, you may file a complaint with:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>
                Rimal Health at{" "}
                <a
                  href="mailto:support@rimalhealth.com"
                  className="text-ocean-600 hover:underline"
                >
                  support@rimalhealth.com
                </a>
              </li>
              <li>
                The U.S. Department of Health and Human Services, Office for
                Civil Rights, at{" "}
                <a
                  href="https://www.hhs.gov/hipaa/filing-a-complaint/index.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ocean-600 hover:underline"
                >
                  hhs.gov/hipaa/filing-a-complaint
                </a>
              </li>
            </ul>
            <p className="mt-3">
              We will not retaliate against you for filing a complaint.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              Your Rights
            </h2>
            <div className="space-y-4">
              {[
                {
                  title: "Right to Access",
                  body: "You have the right to inspect and obtain a copy of your PHI maintained in our records. Requests may be submitted in writing to support@rimalhealth.com.",
                },
                {
                  title: "Right to Amend",
                  body: "You may request that we amend PHI you believe is incorrect or incomplete. We may deny the request if the information was not created by us or is accurate and complete.",
                },
                {
                  title: "Right to an Accounting of Disclosures",
                  body: "You may request a list of disclosures of your PHI. For general health information, this covers disclosures made in the past six years for purposes other than treatment, payment, or operations. For substance use disorder treatment records protected by 42 CFR Part 2, you may request an accounting of disclosures made with your written consent for up to three years prior to your request, including disclosures for treatment, payment, and operations.",
                },
                {
                  title: "Right to Request Restrictions",
                  body: "You may request restrictions on how we use or disclose your PHI. We are not required to agree, but will notify you of our decision.",
                },
                {
                  title: "Right to Confidential Communications",
                  body: "You may request that we communicate with you about your PHI by alternative means or at alternative locations (e.g., contact you only by email).",
                },
                {
                  title: "Right to a Paper Copy of This Notice",
                  body: "You may request a paper copy at any time, even if you previously agreed to receive it electronically.",
                },
              ].map(({ title, body }) => (
                <div key={title}>
                  <h3 className="font-semibold text-gray-900">{title}</h3>
                  <p>{body}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              Complaints
            </h2>
            <p>
              If you believe your privacy rights have been violated, you may
              file a complaint with us at{" "}
              <a
                href="mailto:support@rimalhealth.com"
                className="text-ocean-600 hover:underline"
              >
                support@rimalhealth.com
              </a>{" "}
              or with the U.S. Department of Health and Human Services, Office
              for Civil Rights. We will not retaliate against you for filing a
              complaint.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              Contact Our Privacy Officer
            </h2>
            <address className="not-italic text-gray-700">
              Privacy Officer, Rimal Health
              <br />
              <a
                href="mailto:support@rimalhealth.com"
                className="text-ocean-600 hover:underline"
              >
                support@rimalhealth.com
              </a>
            </address>
          </section>
        </div>
      </div>
    </article>
  );
}
