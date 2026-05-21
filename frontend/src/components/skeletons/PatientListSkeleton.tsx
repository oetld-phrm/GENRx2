import PageContainer from '@/components/PageContainer';
import Skeleton from '@/components/Skeleton';
import { UI_COLORS } from '@/lib/colors';

interface PatientListSkeletonProps {
  cardCount?: number;
}

/**
 * Skeleton for a single patient card row.
 * Mimics the horizontal layout: avatar + name/status + stats + button.
 */
function PatientCardSkeleton() {
  return (
    <div
      className="rounded-xl p-8"
      style={{
        backgroundColor: UI_COLORS.background.white,
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: UI_COLORS.border.default,
      }}
    >
      <div className="flex items-center gap-8">
        {/* Left: Avatar + Name + Status */}
        <div className="flex items-center gap-5 min-w-[250px]">
          <Skeleton className="w-12 h-12 rounded-full" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-6 w-28 rounded-full" />
          </div>
        </div>

        {/* Middle: Stats */}
        <div className="flex items-center gap-10 flex-1">
          {/* Coverage */}
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-24" />
            <div className="flex items-center gap-3 min-w-[180px]">
              <Skeleton className="h-2 flex-1 rounded-full" />
              <Skeleton className="h-4 w-10" />
            </div>
          </div>
          {/* Attempts */}
          <div className="flex flex-col gap-1.5 items-center">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-5 w-6" />
          </div>
          {/* Last Practiced */}
          <div className="flex flex-col gap-1.5 items-center">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-14" />
          </div>
        </div>

        {/* Right: Button */}
        <Skeleton className="h-10 w-36 rounded-md flex-shrink-0" />
      </div>
    </div>
  );
}

/**
 * Full-page skeleton for the Patients list page.
 * Shows header skeleton + stacked patient card skeletons.
 */
function PatientListSkeleton({ cardCount = 3 }: PatientListSkeletonProps) {
  return (
    <PageContainer>
      {/* Header skeleton */}
      <header
        className="flex-shrink-0 flex border-b border-border items-center justify-between py-6 px-8"
        style={{ backgroundColor: UI_COLORS.header.background }}
      >
        <div className="flex items-center gap-4">
          <Skeleton className="w-10 h-10 rounded-full" />
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-4 w-36" />
          </div>
        </div>
        <Skeleton className="h-9 w-24 rounded-md" />
      </header>

      {/* Content skeleton */}
      <main className="flex-1 overflow-y-auto px-8 py-6">
        <div className="flex flex-col gap-6 max-w-5xl mx-auto">
          {Array.from({ length: cardCount }).map((_, i) => (
            <PatientCardSkeleton key={i} />
          ))}
        </div>
      </main>
    </PageContainer>
  );
}

export default PatientListSkeleton;
