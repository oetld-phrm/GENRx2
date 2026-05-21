import PageContainer from '@/components/PageContainer';
import DashboardHeaderSkeleton from './DashboardHeaderSkeleton';
import SimulationGroupCardSkeleton from './SimulationGroupCardSkeleton';

interface DashboardSkeletonProps {
  /** Number of card placeholders to show */
  cardCount?: number;
}

/**
 * Full-page skeleton for dashboard pages (student, instructor).
 * Shows header skeleton + section title + grid of card skeletons.
 */
function DashboardSkeleton({ cardCount = 3 }: DashboardSkeletonProps) {
  return (
    <PageContainer>
      <DashboardHeaderSkeleton />
      <main className="flex-1 overflow-y-auto px-8 py-6">
        <div className="w-full px-4 py-8">
          {/* Section header skeleton */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
            <div className="flex-1 flex flex-col gap-2">
              <div className="h-7 w-48 rounded-md bg-gray-200 animate-pulse" />
              <div className="h-4 w-80 rounded-md bg-gray-200 animate-pulse" />
            </div>
            <div className="h-9 w-32 rounded-md bg-gray-200 animate-pulse" />
          </div>

          {/* Cards grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: cardCount }).map((_, i) => (
              <SimulationGroupCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </main>
    </PageContainer>
  );
}

export default DashboardSkeleton;
