import Skeleton from '@/components/Skeleton';
import { UI_COLORS } from '@/lib/colors';

/**
 * Skeleton for the DashboardHeader component.
 * Mimics the avatar + title + buttons layout.
 */
function DashboardHeaderSkeleton() {
  return (
    <header
      className="flex border-b border-border items-center justify-between py-6 px-8"
      style={{ backgroundColor: UI_COLORS.header.background }}
    >
      <div className="flex items-center gap-4">
        {/* Avatar */}
        <Skeleton className="w-10 h-10 rounded-full" />
        <div className="flex flex-col gap-1.5">
          {/* Title */}
          <Skeleton className="h-6 w-44" />
          {/* Subtitle */}
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-24 rounded-md" />
      </div>
    </header>
  );
}

export default DashboardHeaderSkeleton;
