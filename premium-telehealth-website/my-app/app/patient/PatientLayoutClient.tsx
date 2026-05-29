'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  MessageSquare,
  Pill,
  FileText,
  User,
  LogOut,
  Menu,
  X,
  CreditCard,
  ShieldCheck,
  ClipboardCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { usePatientUnreadCount } from '@/hooks/usePatientUnreadCount';
import { useTokenRefresh } from '@/hooks/useTokenRefresh';
import { Card, CardContent } from '@/components/ui/card';

// ============================================================================
// Navigation Configuration
// ============================================================================

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  badge?: number;
  /** Only shown for weight-management (GLP-1) patients (e.g. Check-ins). */
  glp1Only?: boolean;
}

// Note: a single "Profile" entry → /patient/profile/settings (the comprehensive
// Profile Settings hub covering personal info, password, notifications, privacy).
// The old separate "Settings" → /patient/settings entry was removed as a dup;
// that page remains reachable by URL and links back to Profile Settings.
const navItems: NavItem[] = [
  { href: '/patient/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/patient/messages', label: 'Messages', icon: MessageSquare },
  { href: '/patient/prescriptions', label: 'Prescriptions', icon: Pill },
  { href: '/patient/check-ins', label: 'Check-ins', icon: ClipboardCheck, glp1Only: true },
  { href: '/patient/documents', label: 'Documents', icon: FileText },
  { href: '/patient/billing', label: 'Billing', icon: CreditCard },
  { href: '/patient/profile/settings', label: 'Profile', icon: User },
];

// ============================================================================
// Sidebar Component
// ============================================================================

interface SidebarProps {
  currentPath: string;
  unreadCount?: number;
  items: NavItem[];
}

function Sidebar({ currentPath, unreadCount = 0, items }: SidebarProps) {
  return (
    <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-gray-200 min-h-screen sticky top-0">
      {/* Logo */}
      <div className="p-6 border-b border-gray-100">
        <Link href="/patient/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-navy-600 to-ocean-500 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">R</span>
          </div>
          <span className="font-semibold text-gray-900">Rimal Health</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {items.map((item) => {
          const isActive = currentPath === item.href || currentPath.startsWith(`${item.href}/`);
          const showBadge = item.href === '/patient/messages' && unreadCount > 0;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-ocean-50 text-ocean-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <item.icon className={cn('h-5 w-5', isActive ? 'text-ocean-600' : 'text-gray-400')} />
              <span className="flex-1">{item.label}</span>
              {showBadge && (
                <span className="bg-red-500 text-white text-xs font-medium px-2 py-0.5 rounded-full">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-gray-100">
        <Button
          variant="ghost"
          className="w-full justify-start text-gray-600 hover:text-gray-900"
          type="button"
          onClick={async () => {
            try {
              await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
            } catch (err) {
              console.error('Logout request failed:', err instanceof Error ? err.message : 'Unknown error');
            }
            window.location.assign('/login');
          }}
        >
          <LogOut className="h-5 w-5 mr-3 text-gray-400" />
          Sign Out
        </Button>
      </div>
    </aside>
  );
}

// ============================================================================
// Mobile Navigation Component
// ============================================================================

interface MobileNavProps {
  currentPath: string;
  unreadCount?: number;
  items: NavItem[];
}

function MobileNav({ currentPath, unreadCount = 0, items }: MobileNavProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <>
      {/* Mobile Header */}
      <header className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-40">
        <div className="flex items-center justify-between">
          <Link href="/patient/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-navy-600 to-ocean-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">R</span>
            </div>
            <span className="font-semibold text-gray-900">Rimal Health</span>
          </Link>
          
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64 p-0">
              <div className="flex flex-col h-full">
                {/* Close button */}
                <div className="p-4 border-b border-gray-100 flex justify-end">
                  <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
                    <X className="h-5 w-5" />
                  </Button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-4 space-y-1">
                  {items.map((item) => {
                    const isActive = currentPath === item.href || currentPath.startsWith(`${item.href}/`);
                    const showBadge = item.href === '/patient/messages' && unreadCount > 0;
                    
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setIsOpen(false)}
                        className={cn(
                          'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-ocean-50 text-ocean-700'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        )}
                      >
                        <item.icon className={cn('h-5 w-5', isActive ? 'text-ocean-600' : 'text-gray-400')} />
                        <span className="flex-1">{item.label}</span>
                        {showBadge && (
                          <span className="bg-red-500 text-white text-xs font-medium px-2 py-0.5 rounded-full">
                            {unreadCount > 99 ? '99+' : unreadCount}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </nav>

                {/* Logout */}
                <div className="p-4 border-t border-gray-100">
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-gray-600 hover:text-gray-900"
                    type="button"
                    onClick={async () => {
                      try {
                        await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
                      } catch (err) {
                        console.error('Logout request failed:', err instanceof Error ? err.message : 'Unknown error');
                      }
                      window.location.assign('/login');
                    }}
                  >
                    <LogOut className="h-5 w-5 mr-3 text-gray-400" />
                    Sign Out
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Mobile Bottom Navigation — 5 most-used items; others in hamburger */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 safe-area-pb">
        <div className="flex items-center justify-around">
          {items.slice(0, 5).map((item) => {
            const isActive = currentPath === item.href || currentPath.startsWith(`${item.href}/`);
            const showBadge = item.href === '/patient/messages' && unreadCount > 0;
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors flex-1',
                  isActive
                    ? 'text-ocean-600'
                    : 'text-gray-500 hover:text-gray-700'
                )}
              >
                <div className="relative">
                  <item.icon className={cn('h-5 w-5', isActive ? 'text-ocean-600' : 'text-gray-400')} />
                  {showBadge && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-medium w-4 h-4 flex items-center justify-center rounded-full">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </div>
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

// ============================================================================
// Main Patient Layout
// ============================================================================

interface PatientLayoutProps {
  children: React.ReactNode;
  /** Whether MFA is not yet set up for this patient */
  mfaRequired?: boolean;
  /** Whether the 7-day grace period has expired */
  mfaGracePeriodExpired?: boolean;
  /** True when the patient's product is weight-management (GLP-1). */
  isWeightManagement?: boolean;
}

export default function PatientLayoutClient({
  children,
  mfaRequired = false,
  mfaGracePeriodExpired = false,
  isWeightManagement = false,
}: PatientLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();

  const { unreadCount } = usePatientUnreadCount();

  // Hide GLP-1-only items (Check-ins) for AUD patients, mirroring the
  // self-hiding dashboard monitoring widget.
  const visibleNavItems = navItems.filter((item) => !item.glp1Only || isWeightManagement);

  // Proactively refresh the access token before it expires
  useTokenRefresh({ enabled: true, loginPath: '/login' });

  // If MFA is required and grace period expired, redirect to MFA setup
  // (unless already on the MFA setup page to avoid redirect loop)
  const isMFASetupPage = pathname === '/patient/mfa-setup';

  React.useEffect(() => {
    if (mfaRequired && mfaGracePeriodExpired && !isMFASetupPage) {
      router.replace('/patient/mfa-setup');
    }
  }, [mfaRequired, mfaGracePeriodExpired, isMFASetupPage, router]);

  // If grace period expired and not on MFA setup page, show a blocking overlay
  // while the redirect is in progress (prevents flash of portal content)
  if (mfaRequired && mfaGracePeriodExpired && !isMFASetupPage) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="p-8 text-center">
            <div className="p-3 bg-ocean-50 rounded-full inline-flex mb-4">
              <ShieldCheck className="h-8 w-8 text-ocean-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Two-Factor Authentication Recommended
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              For the security of your health information, we recommend setting up
              two-factor authentication for added security.
            </p>
            <p className="text-xs text-muted-foreground">
              Redirecting to setup...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <MobileNav currentPath={pathname} unreadCount={unreadCount} items={visibleNavItems} />

      <div className="flex">
        {/* Sidebar - Desktop */}
        <Sidebar currentPath={pathname} unreadCount={unreadCount} items={visibleNavItems} />

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {/* Page Content */}
          <div className="pb-20 lg:pb-0">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
