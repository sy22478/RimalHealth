'use client';

/**
 * Checkout Cancel Page
 * 
 * Shown when user cancels the Stripe Checkout process.
 * Provides options to try again or contact support.
 * 
 * @module app/checkout/cancel/page
 */

import * as React from 'react';
import Link from 'next/link';
import { XCircle, ArrowLeft, MessageCircle, CreditCard } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

// ============================================
// FAQ Data
// ============================================

const faqs = [
  {
    question: 'Will I be charged?',
    answer: 'No, you were not charged. Payment only occurs after you complete the checkout process and enter your payment information.',
  },
  {
    question: 'Can I try again?',
    answer: 'Yes, you can restart the checkout process at any time. Your information will be saved if you\'ve already created an account.',
  },
  {
    question: 'What payment methods do you accept?',
    answer: 'We accept all major credit cards (Visa, Mastercard, American Express, Discover) as well as debit cards. All payments are securely processed through Stripe.',
  },
  {
    question: 'Is my payment information secure?',
    answer: 'Yes, we use Stripe for payment processing, which is PCI DSS compliant. We never store your credit card information on our servers.',
  },
];

// ============================================
// Main Page Component
// ============================================

export default function CheckoutCancelPage() {
  return (
    <div className="container mx-auto max-w-2xl py-12 px-4">
      <Card className="text-center">
        <CardHeader className="pb-4">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
            <XCircle className="h-10 w-10 text-muted-foreground" />
          </div>
          <CardTitle className="text-2xl font-bold">Checkout Cancelled</CardTitle>
          <CardDescription className="text-base">
            Your subscription was not completed. No charges were made.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <p className="text-muted-foreground">
            If you have any questions or encountered an issue during checkout, 
            we&apos;re here to help. Feel free to reach out to our support team.
          </p>

          {/* Quick Actions */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-3 rounded-lg border p-4 text-left">
              <CreditCard className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Try Again</p>
                <p className="text-sm text-muted-foreground">
                  Return to the checkout page and complete your subscription.
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 rounded-lg border p-4 text-left">
              <MessageCircle className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Get Help</p>
                <p className="text-sm text-muted-foreground">
                  Contact our team for assistance with your subscription.
                </p>
              </div>
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          <Button asChild className="w-full" size="lg">
            <Link href="/checkout/payment">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Return to Checkout
            </Link>
          </Button>
          
          <Button variant="outline" asChild className="w-full">
            <Link href="/contact">
              Contact Support
            </Link>
          </Button>
        </CardFooter>
      </Card>

      {/* FAQs */}
      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold">Frequently Asked Questions</h2>
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((faq, index) => (
            <AccordionItem key={index} value={`item-${index}`}>
              <AccordionTrigger className="text-left">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>

      {/* Help Links */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
        <Link href="/pricing" className="hover:text-primary hover:underline">
          View Pricing
        </Link>
        <span>•</span>
        <Link href="/faq" className="hover:text-primary hover:underline">
          FAQ
        </Link>
        <span>•</span>
        <Link href="/how-it-works" className="hover:text-primary hover:underline">
          How It Works
        </Link>
      </div>
    </div>
  );
}
