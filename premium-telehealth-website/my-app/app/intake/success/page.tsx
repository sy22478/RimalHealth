'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { 
  CheckCircle, 
  Clock, 
  MessageSquare, 
  Pill, 
  FileText, 
  ArrowRight,
  Calendar,
  Shield
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// ============================================================================
// Timeline Steps
// ============================================================================

interface TimelineStep {
  icon: React.ElementType;
  title: string;
  description: string;
  status: 'complete' | 'current' | 'upcoming';
}

const timelineSteps: TimelineStep[] = [
  {
    icon: CheckCircle,
    title: 'Intake Submitted',
    description: 'Your information has been received',
    status: 'complete',
  },
  {
    icon: Clock,
    title: 'Physician Review',
    description: 'A California-licensed physician will review within 24 hours',
    status: 'current',
  },
  {
    icon: MessageSquare,
    title: 'Treatment Plan',
    description: 'You\'ll receive a message with your personalized plan',
    status: 'upcoming',
  },
  {
    icon: Pill,
    title: 'Prescription Sent',
    description: 'If prescribed, medication goes to your pharmacy',
    status: 'upcoming',
  },
];

// ============================================================================
// Next Steps Data
// ============================================================================

const nextSteps = [
  {
    icon: MessageSquare,
    title: 'Check Your Messages',
    description: 'We\'ll send updates here as your intake is reviewed',
    action: 'View Messages',
    href: '/patient/messages',
  },
  {
    icon: Calendar,
    title: 'Review Timeline',
    description: 'Most intakes are reviewed within 24 hours',
    action: 'View Dashboard',
    href: '/patient/dashboard',
  },
  {
    icon: Shield,
    title: 'Your Information is Secure',
    description: 'All data is encrypted and HIPAA-compliant',
    action: 'Learn More',
    href: '/hipaa',
  },
];

// ============================================================================
// Main Success Page
// ============================================================================

export default function IntakeSuccessPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Success Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100 mb-6">
            <CheckCircle className="h-10 w-10 text-green-600" />
          </div>
          
          <h1 className="text-3xl font-bold text-gray-900 mb-3">
            Intake Form Submitted!
          </h1>
          
          <p className="text-lg text-gray-600 max-w-xl mx-auto">
            Thank you for completing your intake form. A California-licensed physician 
            will review your information within 24 hours.
          </p>
        </motion.div>

        {/* Timeline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mb-10"
        >
          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">
                What Happens Next
              </h2>

              <div className="relative">
                {/* Timeline Line */}
                <div className="absolute left-5 top-8 bottom-8 w-0.5 bg-gray-200" />

                <div className="space-y-6">
                  {timelineSteps.map((step, index) => (
                    <motion.div
                      key={step.title}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: 0.2 + index * 0.1 }}
                      className="relative flex items-start gap-4"
                    >
                      {/* Icon */}
                      <div
                        className={cn(
                          'relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 shrink-0',
                          step.status === 'complete' && 'bg-green-500 border-green-500',
                          step.status === 'current' && 'bg-ocean-500 border-ocean-500',
                          step.status === 'upcoming' && 'bg-white border-gray-300'
                        )}
                      >
                        <step.icon
                          className={cn(
                            'h-5 w-5',
                            step.status === 'complete' && 'text-white',
                            step.status === 'current' && 'text-white',
                            step.status === 'upcoming' && 'text-gray-400'
                          )}
                        />
                      </div>

                      {/* Content */}
                      <div className="flex-1 pt-1">
                        <h3
                          className={cn(
                            'font-medium',
                            step.status === 'upcoming' ? 'text-gray-500' : 'text-gray-900'
                          )}
                        >
                          {step.title}
                        </h3>
                        <p
                          className={cn(
                            'text-sm mt-0.5',
                            step.status === 'upcoming' ? 'text-gray-400' : 'text-gray-600'
                          )}
                        >
                          {step.description}
                        </p>
                      </div>

                      {/* Status Indicator */}
                      {step.status === 'complete' && (
                        <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded">
                          Done
                        </span>
                      )}
                      {step.status === 'current' && (
                        <span className="text-xs font-medium text-ocean-600 bg-ocean-50 px-2 py-1 rounded">
                          Now
                        </span>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Next Steps Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mb-10"
        >
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            What You Can Do Now
          </h2>
          
          <div className="grid gap-4 sm:grid-cols-3">
            {nextSteps.map((step) => (
              <Card
                key={step.title}
                className="hover:shadow-md transition-shadow"
              >
                <CardContent className="p-4">
                  <step.icon className="h-8 w-8 text-ocean-500 mb-3" />
                  <h3 className="font-medium text-gray-900 mb-1">
                    {step.title}
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    {step.description}
                  </p>
                  <Link
                    href={step.href}
                    className="text-sm font-medium text-ocean-600 hover:text-ocean-700 inline-flex items-center gap-1"
                  >
                    {step.action}
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </motion.div>

        {/* Important Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-blue-100 rounded-lg shrink-0">
                  <Shield className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-medium text-blue-900 mb-2">
                    Important Information
                  </h3>
                  <ul className="text-sm text-blue-800 space-y-2 list-disc list-inside">
                    <li>Keep your phone available in case the physician needs to contact you</li>
                    <li>Check your email (including spam folder) for updates</li>
                    <li>If you have urgent questions, you can message your physician</li>
                    <li>Do not stop or change any current medications without consulting your doctor</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Primary CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="mt-10 text-center"
        >
          <Link href="/patient/dashboard">
            <Button
              size="lg"
              className="bg-gradient-to-r from-blue-500 to-ocean-500 hover:from-blue-600 hover:to-ocean-600 text-white"
            >
              Go to My Dashboard
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
