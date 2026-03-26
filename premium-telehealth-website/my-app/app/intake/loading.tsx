/**
 * Loading state for the intake form.
 * Displayed by Next.js during server component data fetching.
 */
export default function IntakeLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-ocean-500" />
        <p className="text-sm text-gray-500">Loading intake form...</p>
      </div>
    </div>
  );
}
