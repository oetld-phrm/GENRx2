import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

/**
 * Base skeleton primitive.
 * A pulsing placeholder block that mimics content shape during loading.
 * Compose multiple Skeleton elements to build page-specific loading layouts.
 */
function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-gray-200',
        className
      )}
    />
  );
}

export default Skeleton;
