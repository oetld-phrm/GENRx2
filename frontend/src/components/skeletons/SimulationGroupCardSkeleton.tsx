import Skeleton from '@/components/Skeleton';
import { UI_COLORS } from '@/lib/colors';

/**
 * Skeleton for a single SimulationGroupCard.
 * Mimics the avatar + title + subtitle + button layout.
 */
function SimulationGroupCardSkeleton() {
  return (
    <div
      className="flex flex-col gap-4 p-6 rounded-lg"
      style={{
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: UI_COLORS.border.default,
        backgroundColor: UI_COLORS.background.white,
      }}
    >
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          {/* Title */}
          <Skeleton className="h-5 w-3/4" />
          {/* Subtitle */}
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
      {/* Button */}
      <Skeleton className="h-9 w-full rounded-md" />
    </div>
  );
}

export default SimulationGroupCardSkeleton;
