'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { 
  FileText, 
  Pill, 
  MessageSquare, 
  StickyNote, 
  CheckCircle,
  RotateCcw,
  Calendar,
  Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate, formatDateTime } from '@/lib/physician/patient-utils';

interface TimelineEvent {
  type: 'intake' | 'prescription' | 'message' | 'note' | 'review' | 'refill';
  date: Date | string;
  title: string;
  description: string;
  metadata?: Record<string, unknown>;
}

interface PatientTimelineProps {
  events: TimelineEvent[];
  isLoading?: boolean;
  className?: string;
}

export function PatientTimeline({
  events,
  isLoading = false,
  className,
}: PatientTimelineProps): React.ReactElement {
  const [today, setToday] = React.useState<string>('');
  const [yesterday, setYesterday] = React.useState<string>('');
  
  React.useEffect(() => {
    setToday(new Date().toDateString());
    setYesterday(new Date(Date.now() - 86400000).toDateString());
  }, []);

  // Get event icon and color
  const getEventStyle = (type: string): { icon: React.ReactNode; color: string; bgColor: string } => {
    switch (type) {
      case 'intake':
        return {
          icon: <FileText className="h-4 w-4" />,
          color: 'text-blue-600',
          bgColor: 'bg-blue-100',
        };
      case 'review':
        return {
          icon: <CheckCircle className="h-4 w-4" />,
          color: 'text-green-600',
          bgColor: 'bg-green-100',
        };
      case 'prescription':
        return {
          icon: <Pill className="h-4 w-4" />,
          color: 'text-purple-600',
          bgColor: 'bg-purple-100',
        };
      case 'message':
        return {
          icon: <MessageSquare className="h-4 w-4" />,
          color: 'text-orange-600',
          bgColor: 'bg-orange-100',
        };
      case 'note':
        return {
          icon: <StickyNote className="h-4 w-4" />,
          color: 'text-navy-600',
          bgColor: 'bg-navy-100',
        };
      case 'refill':
        return {
          icon: <RotateCcw className="h-4 w-4" />,
          color: 'text-teal-600',
          bgColor: 'bg-teal-100',
        };
      default:
        return {
          icon: <Calendar className="h-4 w-4" />,
          color: 'text-gray-600',
          bgColor: 'bg-gray-100',
        };
    }
  };

  // Group events by date
  const groupedEvents = React.useMemo(() => {
    const groups: Record<string, TimelineEvent[]> = {};
    
    for (const event of events) {
      const date = typeof event.date === 'string' 
        ? new Date(event.date) 
        : event.date;
      const dateKey = date.toDateString();
      
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(event);
    }
    
    return groups;
  }, [events]);

  // Sort dates descending
  const sortedDates = React.useMemo(() => {
    return Object.keys(groupedEvents).sort(
      (a, b) => new Date(b).getTime() - new Date(a).getTime()
    );
  }, [groupedEvents]);

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (events.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Patient Timeline
          </CardTitle>
          <CardDescription>Chronological view of patient activity</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No timeline events</p>
            <p className="text-sm">Patient activity will appear here.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Get event counts by type
  const eventCounts = events.reduce((acc, event) => {
    acc[event.type] = (acc[event.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Patient Timeline
            </CardTitle>
            <CardDescription>
              {events.length} events across {sortedDates.length} day{sortedDates.length !== 1 ? 's' : ''}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-1">
            {Object.entries(eventCounts).map(([type, count]) => (
              <Badge key={type} variant="outline" className="text-xs capitalize">
                {type}: {count}
              </Badge>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {sortedDates.map((dateKey) => {
            const dateEvents = groupedEvents[dateKey];
            const date = new Date(dateKey);
            const isToday = today === dateKey;
            const isYesterday = yesterday === dateKey;

            return (
              <div key={dateKey} className="relative">
                {/* Date Header */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className={cn(
                    "text-sm font-medium px-3 py-1 rounded-full",
                    isToday ? "bg-navy text-white" : "bg-muted"
                  )}>
                    {isToday ? 'Today' : isYesterday ? 'Yesterday' : formatDate(date)}
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                {/* Events for this date */}
                <div className="space-y-3">
                  {dateEvents.map((event, index) => {
                    const style = getEventStyle(event.type);
                    const eventDate = typeof event.date === 'string' 
                      ? new Date(event.date) 
                      : event.date;

                    return (
                      <div
                        key={`${dateKey}-${index}`}
                        className="flex gap-4 group"
                      >
                        {/* Timeline line */}
                        <div className="flex flex-col items-center">
                          <div className={cn(
                            "h-10 w-10 rounded-full flex items-center justify-center",
                            style.bgColor,
                            style.color
                          )}>
                            {style.icon}
                          </div>
                          {index < dateEvents.length - 1 && (
                            <div className="w-px h-full bg-border mt-2 group-last:hidden" />
                          )}
                        </div>

                        {/* Event content */}
                        <div className="flex-1 pb-4">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="font-medium text-sm">{event.title}</h4>
                              <p className="text-sm text-muted-foreground mt-0.5">
                                {event.description}
                              </p>
                              
                              {/* Metadata badges */}
                              {event.metadata && Object.keys(event.metadata).length > 0 && (() => {
                                const status = event.metadata.status ? String(event.metadata.status) : null;
                                const treatmentType = event.metadata.treatmentType ? String(event.metadata.treatmentType) : null;
                                const medication = event.metadata.medication ? String(event.metadata.medication) : null;
                                return (
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {status && (
                                      <Badge variant="outline" className="text-xs capitalize">
                                        {status}
                                      </Badge>
                                    )}
                                    {treatmentType && (
                                      <Badge variant="secondary" className="text-xs">
                                        {treatmentType}
                                      </Badge>
                                    )}
                                    {medication && (
                                      <Badge variant="outline" className="text-xs">
                                        {medication}
                                      </Badge>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {eventDate.toLocaleTimeString('en-US', {
                                hour: 'numeric',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
