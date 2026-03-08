'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { 
  MessageSquare, 
  Pill, 
  FileText, 
  User,
  LucideIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface QuickAction {
  icon: LucideIcon;
  label: string;
  href: string;
  primary: boolean;
  description: string;
}

interface QuickActionsProps {
  className?: string;
}

// ============================================================================
// Quick Actions Configuration
// ============================================================================

const quickActions: QuickAction[] = [
  { 
    icon: MessageSquare, 
    label: 'Message Doctor', 
    href: '/patient/messages', 
    primary: true,
    description: 'Ask questions or report side effects'
  },
  { 
    icon: Pill, 
    label: 'Prescriptions', 
    href: '/patient/prescriptions', 
    primary: false,
    description: 'View current medications and refills'
  },
  { 
    icon: FileText, 
    label: 'Documents', 
    href: '/patient/documents', 
    primary: false,
    description: 'Access medical records and forms'
  },
  { 
    icon: User, 
    label: 'Profile', 
    href: '/patient/profile', 
    primary: false,
    description: 'Update your information'
  },
];

// ============================================================================
// Main Component
// ============================================================================

export function QuickActions({ className }: QuickActionsProps) {
  return (
    <div className={cn('grid grid-cols-2 md:grid-cols-4 gap-4', className)}>
      {quickActions.map((action) => (
        <Link 
          key={action.label} 
          href={action.href}
          className="group"
        >
          <Button 
            variant={action.primary ? 'default' : 'outline'} 
            className={cn(
              'w-full h-auto py-4 px-4 flex flex-col items-center gap-2 text-center',
              'transition-all duration-200 hover:-translate-y-0.5',
              action.primary 
                ? 'bg-gradient-to-r from-navy-600 to-ocean-600 hover:from-navy-700 hover:to-ocean-700' 
                : 'hover:border-ocean-300 hover:bg-ocean-50'
            )}
          >
            <action.icon className={cn(
              'h-5 w-5',
              action.primary ? 'text-white' : 'text-ocean-600 group-hover:text-ocean-700'
            )} />
            <span className="font-medium text-sm">{action.label}</span>
            <span className={cn(
              'text-xs font-normal',
              action.primary ? 'text-white/80' : 'text-muted-foreground'
            )}>
              {action.description}
            </span>
          </Button>
        </Link>
      ))}
    </div>
  );
}

export default QuickActions;
