import { UI_COLORS } from '@/lib/colors';

interface LoadingIndicatorProps {
  /** Optional message displayed below the bars */
  message?: string;
  /** Size variant: 'sm' for inline use, 'md' for sections, 'lg' for full-page */
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Animated pulsing bars loading indicator.
 * Inspired by the voice mode equalizer animation.
 */
function LoadingIndicator({ message, size = 'md' }: LoadingIndicatorProps) {
  const config = {
    sm: { bars: 3, barWidth: 'w-0.5', gap: 'gap-0.5', heights: [8, 14, 10], textSize: 'text-xs' },
    md: { bars: 4, barWidth: 'w-1', gap: 'gap-1', heights: [12, 20, 16, 22], textSize: 'text-sm' },
    lg: { bars: 5, barWidth: 'w-1.5', gap: 'gap-1.5', heights: [14, 26, 18, 28, 20], textSize: 'text-base' },
  }[size];

  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <div className={`flex items-end ${config.gap}`}>
        {config.heights.map((baseHeight, i) => (
          <div
            key={i}
            className={`${config.barWidth} rounded-full`}
            style={{
              backgroundColor: UI_COLORS.text.muted,
              height: `${baseHeight}px`,
              animation: `loadingPulse 1.2s ease-in-out ${i * 0.15}s infinite`,
            }}
          />
        ))}
      </div>
      {message && (
        <p className={config.textSize} style={{ color: UI_COLORS.text.muted }}>
          {message}
        </p>
      )}
      <style>{`
        @keyframes loadingPulse {
          0%, 100% { transform: scaleY(1); opacity: 0.5; }
          50% { transform: scaleY(1.8); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

export default LoadingIndicator;
