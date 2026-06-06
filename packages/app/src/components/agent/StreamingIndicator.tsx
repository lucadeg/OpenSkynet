type StreamingPhase = 'thinking' | 'planning' | 'executing' | 'reflecting' | 'retrying';

interface StreamingIndicatorProps {
  phase: StreamingPhase;
  retryProgress?: { attempt: number; max: number; countdown: number } | null;
}

const phaseConfig: Record<StreamingPhase, string> = {
  thinking: 'Thinking\u2026',
  planning: 'Planning\u2026',
  executing: 'Executing\u2026',
  reflecting: 'Reflecting\u2026',
  retrying: 'Retrying\u2026',
};

export function StreamingIndicator({ phase, retryProgress }: StreamingIndicatorProps) {
  return (
    <div className="px-4 pb-2">
      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-foreground rounded-full animate-pulse" />
          <span>
            {phase === 'retrying' && retryProgress
              ? `Retrying (${retryProgress.attempt}/${retryProgress.max})\u2026`
              : phaseConfig[phase]}
          </span>
        </div>
        {retryProgress && retryProgress.countdown > 0 && (
          <div className="text-[10px] pl-4 text-muted-foreground">
            Retrying in {retryProgress.countdown.toFixed(1)}s\u2026
          </div>
        )}
      </div>
    </div>
  );
}
