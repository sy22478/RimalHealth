'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/Skeleton';
import { 
  MessageSquare, 
  User, 
  Stethoscope,
  ChevronRight,
  Send,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDateTime } from '@/lib/physician/patient-utils';

interface Message {
  id: string;
  subject: string;
  body: string;
  sentAt: Date;
  senderType: string;
}

interface PatientMessagesProps {
  messages: Message[];
  isLoading?: boolean;
  className?: string;
  onViewMessage?: (messageId: string) => void;
  onReply?: (messageId: string) => void;
}

export function PatientMessages({
  messages,
  isLoading = false,
  className,
  onViewMessage,
  onReply,
}: PatientMessagesProps): React.ReactElement {
  const [expandedMessage, setExpandedMessage] = React.useState<string | null>(null);

  // Get sender icon
  const getSenderIcon = (senderType: string): React.ReactNode => {
    switch (senderType.toUpperCase()) {
      case 'PATIENT':
        return (
          <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
            <User className="h-4 w-4 text-blue-600" />
          </div>
        );
      case 'PHYSICIAN':
        return (
          <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
            <Stethoscope className="h-4 w-4 text-green-600" />
          </div>
        );
      default:
        return (
          <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center">
            <MessageSquare className="h-4 w-4 text-gray-600" />
          </div>
        );
    }
  };

  // Get sender label
  const getSenderLabel = (senderType: string): string => {
    switch (senderType.toUpperCase()) {
      case 'PATIENT':
        return 'Patient';
      case 'PHYSICIAN':
        return 'Physician';
      case 'SYSTEM':
        return 'System';
      default:
        return senderType;
    }
  };

  // Truncate body text
  const truncateBody = (body: string, maxLength: number = 150): string => {
    if (body.length <= maxLength) return body;
    return body.substring(0, maxLength) + '...';
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (messages.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Messages
          </CardTitle>
          <CardDescription>Patient communication history</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No messages found</p>
            <p className="text-sm">No communication history with this patient.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Group messages by sender for conversation view
  const unreadFromPatient = messages.filter(
    m => m.senderType.toUpperCase() === 'PATIENT'
  ).length;

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Messages
            </CardTitle>
            <CardDescription>
              {messages.length} message{messages.length !== 1 ? 's' : ''} total
            </CardDescription>
          </div>
          {unreadFromPatient > 0 && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {unreadFromPatient} from patient
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {messages.map((message) => {
            const isExpanded = expandedMessage === message.id;
            const isFromPatient = message.senderType.toUpperCase() === 'PATIENT';
            
            return (
              <div
                key={message.id}
                className={cn(
                  "p-4 rounded-lg border transition-all duration-200",
                  isFromPatient ? "bg-blue-50/50" : "bg-gray-50/50",
                  isExpanded && "ring-1 ring-ocean-200"
                )}
              >
                <div className="flex items-start gap-3">
                  {getSenderIcon(message.senderType)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {getSenderLabel(message.senderType)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(message.sentAt)}
                        </span>
                      </div>
                      {isFromPatient && (
                        <Badge variant="outline" className="text-xs">
                          Patient
                        </Badge>
                      )}
                    </div>
                    <h4 className="font-semibold text-sm mt-1">{message.subject}</h4>
                    <p className={cn(
                      "text-sm text-muted-foreground mt-1",
                      !isExpanded && "line-clamp-2"
                    )}>
                      {isExpanded ? message.body : truncateBody(message.body)}
                    </p>
                    
                    {/* Actions */}
                    <div className="flex items-center gap-2 mt-3">
                      {message.body.length > 150 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandedMessage(isExpanded ? null : message.id)}
                          className="h-7 text-xs"
                        >
                          {isExpanded ? 'Show less' : 'Read more'}
                          <ChevronRight className={cn(
                            "h-3 w-3 ml-1 transition-transform",
                            isExpanded && "rotate-90"
                          )} />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onViewMessage?.(message.id)}
                        className="h-7 text-xs"
                      >
                        View Full
                        <ChevronRight className="h-3 w-3 ml-1" />
                      </Button>
                      {isFromPatient && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onReply?.(message.id)}
                          className="h-7 text-xs"
                        >
                          <Send className="h-3 w-3 mr-1" />
                          Reply
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
