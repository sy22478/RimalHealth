'use client';

import * as React from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Mail } from 'lucide-react';
import { DashboardMessage, formatDistanceToNow } from '@/types/dashboard';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface RecentMessagesProps {
  messages: DashboardMessage[];
  className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get initials from sender name
 */
function getInitials(name: string): string {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Truncate text to a specific length
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
}

// ============================================================================
// Main Component
// ============================================================================

export function RecentMessages({ messages, className }: RecentMessagesProps) {
  const hasMessages = messages.length > 0;

  return (
    <Card className={cn('h-full', className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          Recent Messages
          {hasMessages && (
            <Badge variant="secondary" className="text-xs">
              {messages.length}
            </Badge>
          )}
        </CardTitle>
        <Link href="/patient/messages">
          <Button variant="ghost" size="sm" className="text-ocean-600 hover:text-ocean-700">
            View All
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {!hasMessages ? (
          <div className="text-center py-8">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 mb-3">
              <Mail className="h-6 w-6 text-gray-400" />
            </div>
            <p className="text-muted-foreground text-sm">No messages yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Messages from your doctor will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => (
              <Link
                key={msg.id}
                href="/patient/messages"
                className="flex items-start gap-3 group p-2 -mx-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Avatar className="h-10 w-10 flex-shrink-0">
                  <AvatarFallback className={cn(
                    'text-sm font-medium',
                    msg.senderType === 'PHYSICIAN' 
                      ? 'bg-ocean-100 text-ocean-700' 
                      : 'bg-gray-100 text-gray-700'
                  )}>
                    {getInitials(msg.senderName)}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-sm text-gray-900 truncate">
                      {msg.senderType === 'PHYSICIAN' ? `Dr. ${msg.senderName}` : msg.senderName}
                    </p>
                    <span className="text-xs text-muted-foreground flex-shrink-0" suppressHydrationWarning>
                      {formatDistanceToNow(msg.sentAt)}
                    </span>
                  </div>
                  
                  {msg.subject && (
                    <p className="text-sm font-medium text-gray-700 truncate">
                      {msg.subject}
                    </p>
                  )}
                  
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                    {truncateText(msg.preview, 100)}
                  </p>
                </div>
                
                {!msg.read && (
                  <Badge 
                    variant="default" 
                    className="flex-shrink-0 bg-ocean-500 hover:bg-ocean-600"
                  >
                    New
                  </Badge>
                )}
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default RecentMessages;
