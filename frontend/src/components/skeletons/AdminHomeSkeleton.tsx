import PageContainer from '@/components/PageContainer';
import DashboardHeaderSkeleton from './DashboardHeaderSkeleton';
import OrganizationCardSkeleton from './OrganizationCardSkeleton';

interface AdminHomeSkeletonProps {
  cardCount?: number;
}

/**
 * Full-page skeleton for the Admin Home page.
 * Shows header skeleton + organizations heading + card grid.
 */
function AdminHomeSkeleton({ cardCount = 3 }: AdminHomeSkeletonProps) {
  return (
    <PageContainer>
      <DashboardHeaderSkeleton />
      <main className="flex-1 overflow-y-auto px-8 py-6">
        {/* Header section */}
        <div className="flex items-center justify-between mb-6">
          <div className="h-7 w-40 rounded-md bg-gray-200 animate-pulse" />
          <div className="h-9 w-52 rounded-md bg-gray-200 animate-pulse" />
        </div>

        {/* Organization cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: cardCount }).map((_, i) => (
            <OrganizationCardSkeleton key={i} />
          ))}
        </div>
      </main>
    </PageContainer>
  );
}

export default AdminHomeSkeleton;
