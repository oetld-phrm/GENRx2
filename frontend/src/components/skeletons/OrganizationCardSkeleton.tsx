import Skeleton from '@/components/Skeleton';

/**
 * Skeleton for a single OrganizationCard.
 * Mimics the icon + title + details + button layout.
 */
function OrganizationCardSkeleton() {
  return (
    <div className="border border-gray-300 rounded-lg p-6 bg-white">
      {/* Header with icon + title */}
      <div className="flex items-center gap-3 mb-4">
        <Skeleton className="w-12 h-12 rounded-lg" />
        <Skeleton className="h-6 w-40" />
      </div>

      {/* Details */}
      <div className="space-y-2 mb-6">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-36" />
      </div>

      {/* Button */}
      <Skeleton className="h-9 w-full rounded-md" />
    </div>
  );
}

export default OrganizationCardSkeleton;
