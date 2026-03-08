/**
 * Message Sidebar Component
 * 
 * Patient list sidebar showing all patients with message threads.
 * Provides quick access to patient conversations.
 * 
 * HIPAA Compliance:
 * - Patient list only shows names (minimal PHI)
 * - Access requires PHYSICIAN role
 */

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { 
  Search, 
  Users, 
  Loader2,
  AlertCircle,
  MessageSquare
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/Skeleton';

/**
 * Patient summary for sidebar
 */
interface PatientSummary {
  id: string;
  patientId: string;
  patientName: string;
  patientAvatar?: string;
  lastMessageAt?: string;
  unreadCount: number;
  isActive: boolean;
}

interface MessageSidebarProps {
  selectedThreadId: string | null;
  onSelectThread: (threadId: string) => void;
}

/**
 * Message Sidebar Component
 * 
 * Shows list of all patients with messaging capability.
 * Highlights patients with unread messages.
 */
export function MessageSidebar({
  selectedThreadId,
  onSelectThread,
}: MessageSidebarProps): React.ReactElement {
  const router = useRouter();
  const [patients, setPatients] = React.useState<PatientSummary[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState('');

  /**
   * Fetch patient list
   */
  const fetchPatients = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // In a real implementation, this would fetch from an API endpoint
      // For now, we'll get patients from the threads API
      const response = await fetch('/api/physician/messages?includeAllPatients=true', {
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch patients');
      }

      const data = await response.json() as { patients: PatientSummary[] };
      setPatients(data.patients);
    } catch (err) {
      // For development, use mock data
      setPatients([
        { id: '1', patientId: 'p1', patientName: 'John Smith', unreadCount: 2, isActive: true },
        { id: '2', patientId: 'p2', patientName: 'Sarah Johnson', unreadCount: 0, isActive: true },
        { id: '3', patientId: 'p3', patientName: 'Michael Brown', unreadCount: 1, isActive: false },
      ]);
      // setError(err instanceof Error ? err.message : 'Failed to load patients');
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  React.useEffect(() => {
    void fetchPatients();
  }, [fetchPatients]);

  /**
   * Filter patients by search query
   */
  const filteredPatients = React.useMemo(() => {
    if (!searchQuery.trim()) return patients;
    
    const query = searchQuery.toLowerCase();
    return patients.filter(p => 
      p.patientName.toLowerCase().includes(query)
    );
  }, [patients, searchQuery]);

  /**
   * Get initials from patient name
   */
  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const totalUnread = patients.reduce((sum, p) => sum + p.unreadCount, 0);

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200">
        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Users className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1">
          <h2 className="font-semibold text-gray-900">Patients</h2>
          <p className="text-xs text-muted-foreground">
            {patients.length} total{totalUnread > 0 && ` · ${totalUnread} unread`}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Find patient..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            aria-label="Search patients"
          />
        </div>
      </div>

      {/* Patient List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="divide-y divide-gray-100">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-48 px-4 text-center">
            <AlertCircle className="h-8 w-8 text-destructive mb-2" />
            <p className="text-xs text-muted-foreground">{error}</p>
            <Button 
              variant="ghost" 
              size="sm" 
              className="mt-2"
              onClick={() => void fetchPatients()}
            >
              Retry
            </Button>
          </div>
        ) : filteredPatients.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 px-4 text-center">
            <Users className="h-10 w-10 text-muted-foreground mb-2" />
            <p className="text-sm font-medium">No patients found</p>
            <p className="text-xs text-muted-foreground mt-1">
              {searchQuery ? 'Try a different search term' : 'No patients with messages'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100" role="list">
            {filteredPatients.map((patient) => (
              <li key={patient.id}>
                <button
                  onClick={() => onSelectThread(patient.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50",
                    selectedThreadId === patient.id && "bg-primary/5"
                  )}
                  aria-current={selectedThreadId === patient.id ? 'true' : undefined}
                >
                  {/* Avatar */}
                  <div className={cn(
                    "h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium",
                    patient.isActive 
                      ? "bg-primary/10 text-primary" 
                      : "bg-gray-200 text-gray-500"
                  )}>
                    {getInitials(patient.patientName)}
                  </div>

                  {/* Patient Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={cn(
                        "font-medium text-sm truncate",
                        patient.unreadCount > 0 && "text-foreground"
                      )}>
                        {patient.patientName}
                      </span>
                      {patient.unreadCount > 0 && (
                        <Badge 
                          variant="default" 
                          className="h-5 min-w-5 px-1 text-[10px]"
                        >
                          {patient.unreadCount}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      {patient.isActive ? (
                        <>
                          <span className="h-1.5 w-1.5 rounded-full bg-success" />
                          Active
                        </>
                      ) : (
                        <>
                          <span className="h-1.5 w-1.5 rounded-full bg-gray-300" />
                          Inactive
                        </>
                      )}
                    </p>
                  </div>

                  {/* Message Icon */}
                  {patient.lastMessageAt && (
                    <MessageSquare className="h-4 w-4 text-muted-foreground opacity-50" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Footer Info */}
      <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
        <p className="text-xs text-muted-foreground text-center">
          Showing patients with active messaging
        </p>
      </div>
    </div>
  );
}

export type { PatientSummary };
