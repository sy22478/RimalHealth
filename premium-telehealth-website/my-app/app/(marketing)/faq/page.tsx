"use client";

import { useState } from "react";
import { ChevronDown, MessageCircle } from "lucide-react";

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQSection {
  id: string;
  title: string;
  questions: FAQItem[];
}

const faqData: FAQSection[] = [
  {
    id: "how-it-works",
    title: "How It Works",
    questions: [
      {
        question: "Do I need to schedule a video call?",
        answer:
          "No. Our model is completely asynchronous. Fill out your intake when convenient — physician reviews within 24 hours. No scheduling needed.",
      },
      {
        question: "How quickly do I get my prescription?",
        answer:
          "Most patients receive their prescription within 24 hours of submitting their intake form. Sometimes even faster.",
      },
      {
        question: "How long does the intake form take?",
        answer:
          "10–15 minutes. It's thorough but straightforward. We need detailed information to prescribe safely.",
      },
      {
        question: "What if I have questions after I submit my intake?",
        answer:
          "Message your physician anytime through your dashboard. Responses within 24 hours, usually faster.",
      },
      {
        question: "How do refills work?",
        answer:
          "Automatic reminders sent 7 days before you run out. One-click request, physician approves, prescription sent to pharmacy.",
      },
    ],
  },
  {
    id: "medications",
    title: "Medications",
    questions: [
      {
        question: "What medications do you prescribe for alcohol addiction?",
        answer:
          "We prescribe Naltrexone, an FDA-approved medication that blocks the rewarding effects of alcohol and reduces cravings.",
      },
      {
        question: "Are these medications safe?",
        answer:
          "Yes. All are FDA-approved with well-established safety profiles. Your physician reviews your medical history for contraindications.",
      },
      {
        question: "Will I have side effects?",
        answer:
          "Some people experience mild side effects that usually resolve within a week. Your physician monitors you and can adjust if needed.",
      },
      {
        question: "How do I pick up my medication?",
        answer:
          "We send an e-prescription to your local pharmacy (CVS, Walgreens, etc.). Pick it up like any prescription.",
      },
      {
        question: "Do I use my insurance for medication?",
        answer:
          "Yes. Use your insurance card at the pharmacy. Usually $10–50/month.",
      },
      {
        question: "What if I don't have insurance for medications?",
        answer:
          "Use GoodRx coupons (free). Most medications $30–100/month without insurance.",
      },
      {
        question: "How long do I need to take medication?",
        answer:
          "Typically 6-12 months for best results. Can extend if helpful. Many patients continue treatment as long as it's beneficial.",
      },
    ],
  },
  {
    id: "pricing",
    title: "Pricing & Billing",
    questions: [
      {
        question: "How much does it cost?",
        answer:
          "$50/month for treatment.",
      },
      {
        question: "What does the $50/month include?",
        answer:
          "Physician review, prescription management, unlimited messaging, refills, adjustments — everything except the medication itself.",
      },
      {
        question: "Do you accept insurance?",
        answer:
          "No, we don't bill insurance for our $50/month service. But you use your insurance for medications at the pharmacy.",
      },
      {
        question: "Why don't you bill insurance?",
        answer:
          "Insurance billing is expensive and complicated, which would raise our price to $200–400/month. We keep it simple at $50/month.",
      },
      {
        question: "Are there any other fees?",
        answer:
          "No. $50/month is the total. No setup fees, appointment fees, or hidden costs.",
      },
      {
        question: "Can I use my HSA/FSA card?",
        answer:
          "Yes. Addiction treatment is a qualified medical expense.",
      },
      {
        question: "Can I cancel anytime?",
        answer:
          "Yes. Cancel from your dashboard with no penalty. Access continues through your paid period.",
      },
    ],
  },
  {
    id: "treatment",
    title: "Treatment Goals",
    questions: [
      {
        question: "Do I have to quit drinking completely?",
        answer:
          "No. We support both complete abstinence and harm reduction (cutting back). You choose your goal.",
      },
      {
        question: "Can I just cut back on drinking instead of quitting?",
        answer:
          "Absolutely. Many patients' goal is moderation, not abstinence.",
      },
      {
        question: "What if I relapse?",
        answer:
          "Relapse is common and not a failure. Message your physician and we'll adjust your treatment. No judgment.",
      },
      {
        question: "How long does treatment last?",
        answer:
          "Typically 6-12 months for best results. Many patients continue treatment as long as it supports their goals.",
      },
    ],
  },
  {
    id: "privacy",
    title: "Privacy & Security",
    questions: [
      {
        question: "Is my information confidential?",
        answer:
          "Yes. We're HIPAA-compliant and never share your information without permission.",
      },
      {
        question: "Will my employer find out?",
        answer:
          "No. Unless you use employer-sponsored insurance for medications at pharmacy, there's no way they would know.",
      },
      {
        question: "What shows up on my credit card statement?",
        answer:
          '"Rimal Health" or discrete merchant name — not "addiction treatment."',
      },
      {
        question: "Is messaging with the physician secure?",
        answer:
          "Yes. All messages encrypted and HIPAA-compliant.",
      },
      {
        question: "What shows up on my prescription at pharmacy?",
        answer:
          'Just medication name and physician\'s name. Nothing about "addiction treatment."',
      },
    ],
  },
  {
    id: "eligibility",
    title: "Eligibility",
    questions: [
      {
        question: "Who is a good fit for this program?",
        answer:
          "Adults in California with mild to moderate alcohol use disorder who want to quit or cut back on drinking. You should be able to safely reduce from home without medical detox.",
      },
      {
        question: "Who is NOT a good fit?",
        answer:
          "Severe alcohol dependence requiring medical detox, unstable housing, active suicidal ideation, or complex medical conditions requiring in-person care.",
      },
      {
        question: "How do I know if I'm a good fit?",
        answer:
          "Fill out the intake form. Physician will review and let you know if our program is appropriate or recommend alternatives.",
      },
      {
        question: "Do you treat other addictions?",
        answer:
          "Currently we only treat alcohol use disorder. We're focused on providing the best possible care for this specific condition.",
      },
      {
        question: "Do you treat people under 18?",
        answer: "No, adults only (18+).",
      },
      {
        question: "Can I use this if I'm pregnant?",
        answer:
          "Some medications aren't safe during pregnancy. Fill out intake — physician will advise.",
      },
      {
        question: "Do I need to live in California?",
        answer:
          "Yes. Our physician is licensed in California, so you must be a California resident.",
      },
    ],
  },
];

const categories = [
  { id: "all", label: "All" },
  { id: "how-it-works", label: "How It Works" },
  { id: "medications", label: "Medications" },
  { id: "pricing", label: "Pricing" },
  { id: "treatment", label: "Treatment" },
  { id: "privacy", label: "Privacy" },
  { id: "eligibility", label: "Eligibility" },
];

export default function FAQPage() {
  const [activeCategory, setActiveCategory] = useState("all");
  const [openQuestions, setOpenQuestions] = useState<Set<string>>(new Set());

  const handleCategoryClick = (categoryId: string) => {
    setActiveCategory(categoryId);
    if (categoryId !== "all") {
      const element = document.getElementById(categoryId);
      if (element) {
        const offset = 120; // Account for sticky header
        const elementPosition = element.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - offset;
        window.scrollTo({
          top: offsetPosition,
          behavior: "smooth",
        });
      }
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const toggleQuestion = (sectionId: string, questionIndex: number) => {
    const key = `${sectionId}-${questionIndex}`;
    const newOpenQuestions = new Set(openQuestions);
    if (newOpenQuestions.has(key)) {
      newOpenQuestions.delete(key);
    } else {
      newOpenQuestions.add(key);
    }
    setOpenQuestions(newOpenQuestions);
  };

  const isQuestionOpen = (sectionId: string, questionIndex: number) => {
    return openQuestions.has(`${sectionId}-${questionIndex}`);
  };

  const filteredSections =
    activeCategory === "all"
      ? faqData
      : faqData.filter((section) => section.id === activeCategory);

  return (
    <div className="min-h-screen bg-white">
        {/* Hero Section */}
        <section className="pt-28 pb-12 text-center px-6">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Frequently asked questions
            </h1>
            <p className="text-lg text-gray-600">
              Can&apos;t find what you&apos;re looking for? Email{" "}
              <a
                href="mailto:support@rimalhealth.com"
                className="text-ocean-500 hover:underline"
              >
                support@rimalhealth.com
              </a>
            </p>
          </div>
        </section>

        {/* Category Navigation */}
        <div className="sticky top-20 z-30 bg-white border-b border-gray-200 py-4 px-6">
          <div className="max-w-5xl mx-auto">
            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => handleCategoryClick(category.id)}
                  className={`px-4 py-2 text-sm font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                    activeCategory === category.id
                      ? "text-ocean-500 border-b-2 border-ocean-500"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {category.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* FAQ Sections */}
        <section className="py-12 px-6">
          <div className="max-w-3xl mx-auto">
            {filteredSections.map((section, sectionIndex) => (
              <div
                key={section.id}
                id={section.id}
                className={sectionIndex > 0 ? "mt-16" : ""}
              >
                <h2 className="text-2xl font-semibold text-gray-900 mb-6">
                  {section.title}
                </h2>
                <div>
                  {section.questions.map((item, questionIndex) => {
                    const isOpen = isQuestionOpen(section.id, questionIndex);
                    return (
                      <div
                        key={questionIndex}
                        className="border-b border-gray-200 py-5"
                      >
                        <button
                          type="button"
                          className="flex justify-between items-center cursor-pointer w-full text-left"
                          onClick={() =>
                            toggleQuestion(section.id, questionIndex)
                          }
                          aria-expanded={isOpen}
                          aria-controls={`faq-${section.id}-${questionIndex}`}
                        >
                          <h3 className="text-lg font-semibold text-gray-900 pr-4">
                            {item.question}
                          </h3>
                          <ChevronDown
                            className={`w-5 h-5 text-gray-600 flex-shrink-0 transition-transform ${
                              isOpen ? "rotate-180" : ""
                            }`}
                          />
                        </button>
                        {isOpen && (
                          <div id={`faq-${section.id}-${questionIndex}`} role="region">
                            <p className="text-base text-gray-600 leading-relaxed mt-3">
                              {item.answer}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Still Have Questions CTA */}
        <section className="py-12 px-6">
          <div className="max-w-xl mx-auto bg-ocean-500/10 rounded-xl p-10 md:p-14 text-center">
            <MessageCircle className="w-12 h-12 text-ocean-500 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">
              Still have questions?
            </h2>
            <p className="text-base text-gray-600 mb-6">
              Email us at support@rimalhealth.com. We respond within 24 hours.
            </p>
            <a
              href="mailto:support@rimalhealth.com"
              className="inline-flex items-center justify-center px-6 py-3 bg-white text-ocean-600 font-semibold rounded-lg border border-ocean-600 hover:bg-ocean-50 transition-colors"
            >
              Contact Support
            </a>
          </div>
        </section>
    </div>
  );
}
