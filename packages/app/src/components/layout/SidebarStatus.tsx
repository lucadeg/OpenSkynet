import { Circle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/useAppStore';

export function SidebarStatus() {
  const agentStatus = useAppStore((state) => state.agentStatus);

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <Circle
          className={cn(
            'h-2 w-2',
            agentStatus.rpcConnected
              ? 'fill-primary text-primary'
              : 'fill-destructive text-destructive'
          )}
          aria-hidden="true"
        />
        <span className={cn(
          'text-xs font-medium',
          agentStatus.rpcConnected ? 'text-foreground' : 'text-destructive'
        )}>
          {agentStatus.rpcConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {agentStatus.state === 'running' ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin text-foreground" aria-hidden="true" />
            <span className="text-xs font-medium">Running</span>
          </>
        ) : (
          <>
            <Circle
              className={cn(
                'h-2 w-2',
                agentStatus.state === 'idle'
                  ? 'fill-success text-success'
                  : 'fill-destructive text-destructive'
              )}
              aria-hidden="true"
            />
            <span className={cn(
              'text-xs font-medium capitalize',
              agentStatus.state === 'idle' ? 'text-foreground' : 'text-destructive'
            )}>
              {agentStatus.state}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
