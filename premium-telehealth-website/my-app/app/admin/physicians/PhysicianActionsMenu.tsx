'use client';

/**
 * Physician Actions Menu (All Physicians list)
 *
 * Client island for the per-row dropdown on the All Physicians table. Wires the
 * Authorize / Reject / Suspend / Reactivate / Reset Key actions to the real
 * `POST /api/admin/physicians/{id}/{action}` endpoints (ADMIN-only). Reject and
 * Suspend collect a required reason; the others confirm before posting.
 *
 * @module app/admin/physicians/PhysicianActionsMenu
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  MoreHorizontal,
  Eye,
  CheckCircle,
  XCircle,
  RefreshCw,
  Key,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { PhysicianStatus } from '@prisma/client';

type ActionKey = 'authorize' | 'reject' | 'suspend' | 'reactivate' | 'reset-key';

interface ActionConfig {
  title: string;
  description: string;
  confirmLabel: string;
  needsReason: boolean;
  destructive: boolean;
}

const ACTION_CONFIG: Record<ActionKey, ActionConfig> = {
  authorize: {
    title: 'Authorize physician',
    description:
      'They will be activated and receive an email with a secret key to access the physician portal.',
    confirmLabel: 'Confirm authorization',
    needsReason: false,
    destructive: false,
  },
  reject: {
    title: 'Reject physician',
    description: 'This rejects the pending application. Provide a reason for the record.',
    confirmLabel: 'Confirm rejection',
    needsReason: true,
    destructive: true,
  },
  suspend: {
    title: 'Suspend physician',
    description:
      'This deactivates the physician and revokes portal access. Provide a reason for the record.',
    confirmLabel: 'Confirm suspension',
    needsReason: true,
    destructive: true,
  },
  reactivate: {
    title: 'Reactivate physician',
    description: 'This restores the physician to active status.',
    confirmLabel: 'Confirm reactivation',
    needsReason: false,
    destructive: false,
  },
  'reset-key': {
    title: 'Reset secret key',
    description:
      'This revokes the current secret key and issues a new one, sent to the physician via email.',
    confirmLabel: 'Reset key',
    needsReason: false,
    destructive: false,
  },
};

interface PhysicianActionsMenuProps {
  physicianId: string;
  status: PhysicianStatus;
  name: string;
}

export function PhysicianActionsMenu({
  physicianId,
  status,
  name,
}: PhysicianActionsMenuProps): React.ReactElement {
  const router = useRouter();
  const [action, setAction] = React.useState<ActionKey | null>(null);
  const [reason, setReason] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);

  const openAction = (key: ActionKey): void => {
    setAction(key);
    setReason('');
    setError(null);
    setSuccessMsg(null);
  };

  const closeDialog = (): void => {
    if (loading) return;
    setAction(null);
  };

  const config = action ? ACTION_CONFIG[action] : null;

  const submit = async (): Promise<void> => {
    if (!action || !config) return;
    if (config.needsReason && reason.trim().length === 0) {
      setError('A reason is required.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/physicians/${physicianId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: config.needsReason ? JSON.stringify({ reason: reason.trim() }) : JSON.stringify({}),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to ${action.replace('-', ' ')} physician`);
      }
      // Reset-key emails the new key — show a non-sensitive confirmation only.
      if (action === 'reset-key') {
        setSuccessMsg('Secret key reset. A new key has been sent to the physician via email.');
        router.refresh();
        return;
      }
      setAction(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Open actions menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem asChild>
            <Link href={`/admin/physicians/${physicianId}`} className="cursor-pointer">
              <Eye className="mr-2 h-4 w-4" />
              View Details
            </Link>
          </DropdownMenuItem>

          {status === PhysicianStatus.PENDING && (
            <>
              <DropdownMenuItem className="text-green-600 cursor-pointer" onSelect={() => openAction('authorize')}>
                <CheckCircle className="mr-2 h-4 w-4" />
                Authorize
              </DropdownMenuItem>
              <DropdownMenuItem className="text-red-600 cursor-pointer" onSelect={() => openAction('reject')}>
                <XCircle className="mr-2 h-4 w-4" />
                Reject
              </DropdownMenuItem>
            </>
          )}

          {status === PhysicianStatus.ACTIVE && (
            <DropdownMenuItem className="text-amber-600 cursor-pointer" onSelect={() => openAction('suspend')}>
              <XCircle className="mr-2 h-4 w-4" />
              Suspend
            </DropdownMenuItem>
          )}

          {status === PhysicianStatus.INACTIVE && (
            <DropdownMenuItem className="text-green-600 cursor-pointer" onSelect={() => openAction('reactivate')}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Reactivate
            </DropdownMenuItem>
          )}

          {(status === PhysicianStatus.ACTIVE || status === PhysicianStatus.INACTIVE) && (
            <DropdownMenuItem className="cursor-pointer" onSelect={() => openAction('reset-key')}>
              <Key className="mr-2 h-4 w-4" />
              Reset Secret Key
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={action !== null} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{config?.title}</DialogTitle>
            <DialogDescription>
              {name ? <strong>{name}</strong> : 'This physician'} — {config?.description}
            </DialogDescription>
          </DialogHeader>

          {successMsg ? (
            <div className="flex items-start gap-2 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800">
              <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{successMsg}</span>
            </div>
          ) : (
            <>
              {config?.needsReason && (
                <div className="space-y-1.5">
                  <Label htmlFor="action-reason">Reason</Label>
                  <Textarea
                    id="action-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Enter a reason for the record…"
                    className="min-h-[80px]"
                    disabled={loading}
                  />
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </>
          )}

          <DialogFooter>
            {successMsg ? (
              <Button onClick={() => setAction(null)}>Close</Button>
            ) : (
              <>
                <Button variant="outline" onClick={closeDialog} disabled={loading}>
                  Cancel
                </Button>
                <Button
                  variant={config?.destructive ? 'destructive' : 'default'}
                  onClick={submit}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Working…
                    </>
                  ) : (
                    config?.confirmLabel
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
