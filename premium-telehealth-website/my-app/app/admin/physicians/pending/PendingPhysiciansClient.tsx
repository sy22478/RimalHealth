/**
 * Pending Physicians Client Component
 *
 * Handles interactive UI for the pending physicians queue:
 * search, selection, authorize/reject actions via real API calls.
 *
 * @module app/admin/physicians/pending/PendingPhysiciansClient
 */

'use client';

import * as React from 'react';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Clock,
  CheckCircle,
  XCircle,
  ArrowLeft,
  UserCheck,
  UserX,
  Search,
  Stethoscope,
  FileCheck,
  AlertCircle,
  Loader2,
  Calendar,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PendingPhysicianData } from './page';

// ============================================================================
// Components
// ============================================================================

function PendingStats({ physicians }: { physicians: PendingPhysicianData[] }): React.ReactElement {
  const [now] = React.useState(() => Date.now());

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">Total Pending</p>
          <p className="text-2xl font-bold text-amber-600">{physicians.length}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">Over 24h</p>
          <p className="text-2xl font-bold text-orange-600">
            {physicians.filter((p) => now - new Date(p.createdAt).getTime() > 24 * 60 * 60 * 1000).length}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">Over 48h</p>
          <p className="text-2xl font-bold text-red-600">
            {physicians.filter((p) => now - new Date(p.createdAt).getTime() > 48 * 60 * 60 * 1000).length}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">Avg Wait Time</p>
          <p className="text-2xl font-bold">
            {physicians.length > 0
              ? `${Math.round(
                  physicians.reduce((acc, p) => acc + now - new Date(p.createdAt).getTime(), 0) /
                    physicians.length /
                    (1000 * 60 * 60 * 24)
                )}d`
              : '0d'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function PhysicianCard({
  physician,
  isSelected,
  onSelect,
  onAuthorize,
  onReject,
}: {
  physician: PendingPhysicianData;
  isSelected: boolean;
  onSelect: (selected: boolean) => void;
  onAuthorize: () => void;
  onReject: () => void;
}): React.ReactElement {
  const initials = `${physician.firstName[0]}${physician.lastName[0]}`.toUpperCase();
  const [now] = React.useState(() => Date.now());
  const createdAt = new Date(physician.createdAt);
  const daysWaiting = Math.floor(
    (now - createdAt.getTime()) / (1000 * 60 * 60 * 24)
  );

  const getUrgencyColor = (days: number): string => {
    if (days >= 3) return 'text-red-600 bg-red-50';
    if (days >= 2) return 'text-orange-600 bg-orange-50';
    return 'text-amber-600 bg-amber-50';
  };

  return (
    <Card className={cn('relative transition-all', isSelected && 'ring-2 ring-ocean-500')}>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Checkbox
              checked={isSelected}
              onCheckedChange={onSelect}
              aria-label={`Select ${physician.firstName} ${physician.lastName}`}
            />
            <Avatar className="h-12 w-12">
              <AvatarFallback className="bg-ocean-100 text-ocean-700 text-lg">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-lg">
                {physician.firstName} {physician.lastName}
              </CardTitle>
              <CardDescription>{physician.specialty || 'General Practice'}</CardDescription>
            </div>
          </div>
          <Badge className={cn('font-medium', getUrgencyColor(daysWaiting))}>
            <Clock className="w-3 h-3 mr-1" />
            {daysWaiting}d waiting
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Credentials */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-muted rounded-lg p-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Email</p>
            <p className="text-sm font-medium truncate">{physician.email}</p>
          </div>
          <div className="bg-muted rounded-lg p-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">NPI Number</p>
            <p className="text-sm font-medium font-mono">{physician.npiNumber}</p>
          </div>
          <div className="bg-muted rounded-lg p-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">License</p>
            <p className="text-sm font-medium font-mono">{physician.licenseNumber}</p>
          </div>
        </div>

        {physician.deaNumber && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileCheck className="w-4 h-4" />
            <span>
              DEA Registration: <span className="font-mono">{physician.deaNumber}</span>
            </span>
          </div>
        )}

        {/* Applied Date */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="w-4 h-4" />
          <span>
            Applied:{' '}
            {createdAt.toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
      </CardContent>

      <CardFooter className="gap-2">
        <Button
          variant="default"
          className="flex-1 bg-green-600 hover:bg-green-700"
          onClick={onAuthorize}
        >
          <UserCheck className="w-4 h-4 mr-2" />
          Authorize
        </Button>
        <Button
          variant="outline"
          className="flex-1 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
          onClick={onReject}
        >
          <UserX className="w-4 h-4 mr-2" />
          Reject
        </Button>
        <Button variant="outline" asChild>
          <Link href={`/admin/physicians/${physician.id}`}>View</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

function EmptyState(): React.ReactElement {
  return (
    <Card className="text-center py-16">
      <CardContent>
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h3 className="text-xl font-semibold mb-2">No Pending Physicians</h3>
        <p className="text-muted-foreground max-w-md mx-auto mb-6">
          All physician applications have been reviewed. New applications will appear here when submitted.
        </p>
        <Button variant="outline" asChild>
          <Link href="/admin/physicians">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to All Physicians
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Client Component
// ============================================================================

interface PendingPhysiciansClientProps {
  initialPhysicians: PendingPhysicianData[];
}

export function PendingPhysiciansClient({ initialPhysicians }: PendingPhysiciansClientProps): React.ReactElement {
  const router = useRouter();
  const [physicians, setPhysicians] = useState(initialPhysicians);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [authorizeDialogOpen, setAuthorizeDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [singleActionPhysician, setSingleActionPhysician] = useState<PendingPhysicianData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter physicians based on search
  const filteredPhysicians = physicians.filter(
    (p) =>
      p.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.npiNumber.includes(searchQuery)
  );

  // Selection handlers
  const toggleSelection = (id: string): void => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleAll = (): void => {
    if (selectedIds.size === filteredPhysicians.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredPhysicians.map((p) => p.id)));
    }
  };

  // Action handlers - call real API endpoints
  const handleAuthorize = async (physician?: PendingPhysicianData): Promise<void> => {
    setIsLoading(true);
    setError(null);

    const idsToAuthorize = physician ? [physician.id] : Array.from(selectedIds);

    try {
      for (const physicianId of idsToAuthorize) {
        const response = await fetch(`/api/admin/physicians/${physicianId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'authorize' }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || `Failed to authorize physician ${physicianId}`);
        }
      }

      // Remove authorized physicians from local state
      setPhysicians((prev) => prev.filter((p) => !idsToAuthorize.includes(p.id)));
      setSelectedIds(new Set());
      setAuthorizeDialogOpen(false);
      setSingleActionPhysician(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to authorize physician');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = async (physician?: PendingPhysicianData): Promise<void> => {
    setIsLoading(true);
    setError(null);

    const idsToReject = physician ? [physician.id] : Array.from(selectedIds);

    try {
      for (const physicianId of idsToReject) {
        const response = await fetch(`/api/admin/physicians/${physicianId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'reject' }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || `Failed to reject physician ${physicianId}`);
        }
      }

      // Remove rejected physicians from local state
      setPhysicians((prev) => prev.filter((p) => !idsToReject.includes(p.id)));
      setSelectedIds(new Set());
      setRejectDialogOpen(false);
      setSingleActionPhysician(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject physician');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/admin/physicians">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Stethoscope className="w-6 h-6" />
              Pending Authorization
            </h1>
            <p className="text-muted-foreground">Review and authorize physician applications</p>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <PendingStats physicians={physicians} />

      {physicians.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* Search and Bulk Actions */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div className="relative w-full sm:w-96">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, email, or NPI..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {selectedIds.size > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">{selectedIds.size} selected</span>
                    <Button
                      variant="default"
                      size="sm"
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => setAuthorizeDialogOpen(true)}
                    >
                      <UserCheck className="w-4 h-4 mr-2" />
                      Authorize Selected
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-red-200 text-red-600 hover:bg-red-50"
                      onClick={() => setRejectDialogOpen(true)}
                    >
                      <UserX className="w-4 h-4 mr-2" />
                      Reject Selected
                    </Button>
                  </div>
                )}
              </div>

              {filteredPhysicians.length > 0 && (
                <div className="flex items-center gap-2 mt-4 pt-4 border-t">
                  <Checkbox
                    checked={selectedIds.size === filteredPhysicians.length && filteredPhysicians.length > 0}
                    onCheckedChange={toggleAll}
                    aria-label="Select all physicians"
                  />
                  <span className="text-sm text-muted-foreground">
                    Select all {filteredPhysicians.length} physicians
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Physician Cards */}
          <div className="space-y-4">
            {filteredPhysicians.length === 0 ? (
              <Card className="text-center py-12">
                <CardContent>
                  <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No matches found</h3>
                  <p className="text-muted-foreground">Try adjusting your search criteria</p>
                </CardContent>
              </Card>
            ) : (
              filteredPhysicians.map((physician) => (
                <PhysicianCard
                  key={physician.id}
                  physician={physician}
                  isSelected={selectedIds.has(physician.id)}
                  onSelect={() => toggleSelection(physician.id)}
                  onAuthorize={() => {
                    setSingleActionPhysician(physician);
                    setAuthorizeDialogOpen(true);
                  }}
                  onReject={() => {
                    setSingleActionPhysician(physician);
                    setRejectDialogOpen(true);
                  }}
                />
              ))
            )}
          </div>
        </>
      )}

      {/* Authorize Dialog */}
      <Dialog open={authorizeDialogOpen} onOpenChange={setAuthorizeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-green-600" />
              Authorize Physician{singleActionPhysician ? '' : 's'}
            </DialogTitle>
            <DialogDescription>
              {singleActionPhysician ? (
                <>
                  Are you sure you want to authorize{' '}
                  <strong>
                    {singleActionPhysician.firstName} {singleActionPhysician.lastName}
                  </strong>
                  ? They will receive an email with a secret key to access the physician portal.
                </>
              ) : (
                <>
                  Are you sure you want to authorize <strong>{selectedIds.size} physicians</strong>? They will all
                  receive emails with secret keys to access the physician portal.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAuthorizeDialogOpen(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={() => handleAuthorize(singleActionPhysician || undefined)}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Authorizing...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Confirm Authorization
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserX className="w-5 h-5 text-red-600" />
              Reject Physician{singleActionPhysician ? '' : 's'}
            </DialogTitle>
            <DialogDescription>
              {singleActionPhysician ? (
                <>
                  Are you sure you want to reject{' '}
                  <strong>
                    {singleActionPhysician.firstName} {singleActionPhysician.lastName}
                  </strong>
                  ? This action cannot be undone.
                </>
              ) : (
                <>
                  Are you sure you want to reject <strong>{selectedIds.size} physicians</strong>? This action cannot be
                  undone.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleReject(singleActionPhysician || undefined)}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Rejecting...
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 mr-2" />
                  Confirm Rejection
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
