'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Set Password page — redirects to /create-account for backward compatibility.
 * Existing users who received "Set Password" emails with /set-password?token=xxx
 * links will be redirected to the new /create-account page with the same token.
 */
function SetPasswordRedirect(): React.JSX.Element {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    // Preserve all query params (especially ?token=xxx)
    const params = searchParams.toString();
    const target = params ? `/create-account?${params}` : '/create-account';
    router.replace(target);
  }, [searchParams, router]);

  return (
    <div className="w-full text-center">
      <Loader2 className="w-8 h-8 animate-spin text-ocean-600 mx-auto mb-4" />
      <p className="text-muted-foreground">Redirecting...</p>
    </div>
  );
}

export default function SetPasswordPage(): React.JSX.Element {
  return (
    <Suspense fallback={
      <div className="w-full text-center">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48 mx-auto" />
          <div className="h-4 bg-gray-200 rounded w-64 mx-auto" />
        </div>
      </div>
    }>
      <SetPasswordRedirect />
    </Suspense>
  );
}
