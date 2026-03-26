/**
 * Loading state for auth pages (login, signup, etc.).
 * Displayed by Next.js during server component data fetching.
 */
export default function AuthLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-ocean-500" />
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    </div>
  );
}
