'use client';

/**
 * Physician Navigation Client Components
 * 
 * Client-side components for the physician portal navigation.
 * Contains interactive components that use React state.
 * 
 * @module app/physician/PhysicianNavClient
 */

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  ListChecks,
  Pill,
  MessageSquare,
  Settings,
  LogOut,
  Menu,
  Stethoscope,
  Bell,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUnreadMessageCount } from '@/hooks/useUnreadMessageCount';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  badge?: number;
}

const navItems: NavItem[] = [
  { href: '/physician/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/physician/queue', label: 'Patient Queue', icon: ListChecks },
  { href: '/physician/patients', label: 'Patients', icon: Users },
  { href: '/physician/reviews', label: 'Reviews', icon: ClipboardList },
  { href: '/physician/prescriptions', label: 'Prescriptions', icon: Pill },
];

const bottomNavItems: NavItem[] = [
  { href: '/physician/settings', label: 'Settings', icon: Settings },
];

/**
 * Messages Nav Link with Unread Badge
 * 
 * Separate component to use the useUnreadMessageCount hook
 */
function MessagesNavLink({ currentPath }: { currentPath: string }) {
  const { unreadCount } = useUnreadMessageCount();
  const href = '/physician/messages';
  const isActive = currentPath === href || currentPath.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors',
        isActive
          ? 'bg-ocean-50 text-ocean-700'
          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
      )}
    >
      <MessageSquare className={cn('h-5 w-5', isActive ? 'text-ocean-600' : 'text-gray-400')} />
      Messages
      {unreadCount > 0 && (
        <span className="ml-auto bg-red-100 text-red-600 text-xs font-semibold px-2 py-0.5 rounded-full">
          {unreadCount}
        </span>
      )}
    </Link>
  );
}

/**
 * Mobile Messages Nav Link with Badge
 */
function MobileMessagesNavLink({ currentPath, onClick }: { currentPath: string; onClick?: () => void }) {
  const { unreadCount } = useUnreadMessageCount();
  const href = '/physician/messages';
  const isActive = currentPath === href || currentPath.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors',
        isActive
          ? 'bg-ocean-50 text-ocean-700'
          : 'text-gray-600 hover:bg-gray-50'
      )}
    >
      <MessageSquare className={cn('h-5 w-5', isActive ? 'text-ocean-600' : 'text-gray-400')} />
      Messages
      {unreadCount > 0 && (
        <span className="ml-auto bg-red-100 text-red-600 text-xs font-semibold px-2 py-0.5 rounded-full">
          {unreadCount}
        </span>
      )}
    </Link>
  );
}

/**
 * Mobile Bell Icon with Badge
 */
function MobileNotificationBell() {
  const { unreadCount } = useUnreadMessageCount();

  return (
    <Button variant="ghost" size="icon" className="relative" asChild>
      <Link href="/physician/messages">
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
        )}
      </Link>
    </Button>
  );
}

export function Sidebar() {
  const currentPath = usePathname();
  return (
    <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-gray-200 min-h-screen sticky top-0">
      {/* Logo */}
      <div className="p-6 border-b border-gray-100">
        <Link href="/physician/dashboard" className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-navy-600 to-ocean-500 rounded-xl flex items-center justify-center">
            <Stethoscope className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-semibold text-gray-900 block">Rimal Health</span>
            <span className="text-xs text-muted-foreground">Physician Portal</span>
          </div>
        </Link>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = currentPath === item.href || currentPath.startsWith(`${item.href}/`);
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
              {item.label}
              {item.badge && item.badge > 0 && (
                <span className="ml-auto bg-red-100 text-red-600 text-xs font-semibold px-2 py-0.5 rounded-full">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
        
        {/* Messages with live badge */}
        <MessagesNavLink currentPath={currentPath} />
      </nav>

      {/* Bottom Navigation */}
      <div className="p-4 border-t border-gray-100 space-y-1">
        {bottomNavItems.map((item) => {
          const isActive = currentPath === item.href;
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
              {item.label}
            </Link>
          );
        })}

        {/* Logout */}
        <form action="/api/auth/logout" method="POST">
          <Button
            variant="ghost"
            className="w-full justify-start text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            type="submit"
          >
            <LogOut className="h-5 w-5 mr-3 text-gray-400" />
            Sign Out
          </Button>
        </form>
      </div>
    </aside>
  );
}

export function MobileHeader() {
  const currentPath = usePathname();
  const [menuOpen, setMenuOpen] = React.useState(false);

  return (
    <header className="lg:hidden bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="flex items-center justify-between px-4 py-3">
        <Link href="/physician/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-navy-600 to-ocean-500 rounded-lg flex items-center justify-center">
            <Stethoscope className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-gray-900">Physician Portal</span>
        </Link>

        <div className="flex items-center gap-2">
          <MobileNotificationBell />
          <Button variant="ghost" size="icon" onClick={() => setMenuOpen(!menuOpen)}>
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <nav className="border-t border-gray-100 px-4 py-3 space-y-1">
          {navItems.map((item) => {
            const isActive = currentPath === item.href || currentPath.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-ocean-50 text-ocean-700'
                    : 'text-gray-600 hover:bg-gray-50'
                )}
              >
                <item.icon className={cn('h-5 w-5', isActive ? 'text-ocean-600' : 'text-gray-400')} />
                {item.label}
                {item.badge && item.badge > 0 && (
                  <span className="ml-auto bg-red-100 text-red-600 text-xs font-semibold px-2 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
          
          {/* Messages with live badge */}
          <MobileMessagesNavLink 
            currentPath={currentPath} 
            onClick={() => setMenuOpen(false)} 
          />
          
          <div className="border-t border-gray-100 pt-2 mt-2">
            <form action="/api/auth/logout" method="POST">
              <Button
                variant="ghost"
                className="w-full justify-start text-gray-600"
                type="submit"
              >
                <LogOut className="h-5 w-5 mr-3 text-gray-400" />
                Sign Out
              </Button>
            </form>
          </div>
        </nav>
      )}
    </header>
  );
}

/**
 * Mobile Messages Nav Item with Badge
 */
function MobileMessagesNavItem({ currentPath }: { currentPath: string }) {
  const { unreadCount } = useUnreadMessageCount();
  const href = '/physician/messages';
  const isActive = currentPath === href || currentPath.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={cn(
        'flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors relative',
        isActive
          ? 'text-ocean-600'
          : 'text-gray-500 hover:text-gray-700'
      )}
    >
      <div className="relative">
        <MessageSquare className={cn('h-5 w-5', isActive ? 'text-ocean-600' : 'text-gray-400')} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-[10px] text-white font-medium">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </div>
      Messages
    </Link>
  );
}

export function MobileNav() {
  const currentPath = usePathname();
  const mainItems = navItems.slice(0, 3); // Dashboard, Queue, Patients on mobile bottom bar

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
      <div className="flex items-center justify-around py-2">
        {mainItems.map((item) => {
          const isActive = currentPath === item.href || currentPath.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors',
                isActive
                  ? 'text-ocean-600'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              <item.icon className={cn('h-5 w-5', isActive ? 'text-ocean-600' : 'text-gray-400')} />
              {item.label}
            </Link>
          );
        })}
        
        {/* Messages with badge */}
        <MobileMessagesNavItem currentPath={currentPath} />
      </div>
    </nav>
  );
}
