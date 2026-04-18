'use client';

/**
 * Admin Navigation Component
 * 
 * Client-side navigation component for the admin portal.
 * Contains sidebar navigation with mobile-responsive design.
 * 
 * @module components/admin/AdminNav
 */

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  Users,
  UserPlus,
  LogOut,
  Menu,
  X,
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

// ============================================================================
// Navigation Configuration
// ============================================================================

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  badge?: number;
}

const navItems: NavItem[] = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/physicians', label: 'All Physicians', icon: Users },
  { href: '/admin/physicians/pending', label: 'Pending Authorization', icon: UserPlus },
];

// ============================================================================
// Sidebar Component
// ============================================================================

interface SidebarProps {
  currentPath: string;
  pendingCount?: number;
}

function Sidebar({ currentPath, pendingCount = 0 }: SidebarProps) {
  return (
    <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-gray-200 min-h-screen sticky top-0">
      {/* Logo */}
      <div className="p-6 border-b border-gray-100">
        <Link href="/admin/dashboard" className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-navy-600 to-ocean-500 rounded-xl flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-semibold text-gray-900 block">Rimal Health</span>
            <span className="text-xs text-muted-foreground">Admin Portal</span>
          </div>
        </Link>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = currentPath === item.href || currentPath.startsWith(`${item.href}/`);
          const showBadge = item.href === '/admin/physicians/pending' && pendingCount > 0;
          
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
                <span className="bg-red-100 text-red-600 text-xs font-semibold px-2 py-0.5 rounded-full">
                  {pendingCount > 99 ? '99+' : pendingCount}
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
          className="w-full justify-start text-gray-600 hover:text-gray-900 hover:bg-gray-50"
          type="button"
          onClick={async () => {
            await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
            window.location.href = '/login';
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
  pendingCount?: number;
}

function MobileNav({ currentPath, pendingCount = 0 }: MobileNavProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <>
      {/* Mobile Header */}
      <header className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-40">
        <div className="flex items-center justify-between">
          <Link href="/admin/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-navy-600 to-ocean-500 rounded-lg flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-gray-900">Admin Portal</span>
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
                  {navItems.map((item) => {
                    const isActive = currentPath === item.href || currentPath.startsWith(`${item.href}/`);
                    const showBadge = item.href === '/admin/physicians/pending' && pendingCount > 0;

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
                          <span className="bg-red-100 text-red-600 text-xs font-semibold px-2 py-0.5 rounded-full">
                            {pendingCount > 99 ? '99+' : pendingCount}
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
                      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
                      window.location.href = '/login';
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

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
        <div className="flex items-center justify-around py-2">
          {navItems.slice(0, 3).map((item) => {
            const isActive = currentPath === item.href || currentPath.startsWith(`${item.href}/`);
            const showBadge = item.href === '/admin/physicians/pending' && pendingCount > 0;

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
                      {pendingCount > 9 ? '9+' : pendingCount}
                    </span>
                  )}
                </div>
                <span className="text-[10px]">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

// ============================================================================
// Main AdminNav Component
// ============================================================================

interface AdminNavProps {
  children: React.ReactNode;
  pendingCount?: number;
}

export function AdminNav({ children, pendingCount = 0 }: AdminNavProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-gray-50">
      <MobileNav currentPath={pathname} pendingCount={pendingCount} />

      <div className="flex">
        {/* Sidebar - Desktop */}
        <Sidebar currentPath={pathname} pendingCount={pendingCount} />

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          {/* Page Content */}
          <div className="p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
