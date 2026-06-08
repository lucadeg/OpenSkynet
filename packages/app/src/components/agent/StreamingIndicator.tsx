import { useState, useEffect } from 'react';
import { Brain, ClipboardList, Zap, Search, RefreshCw, Globe, Settings, Clock, Loader2, Check, X, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

type StreamingPhase = 'thinking' | 'planning' | 'executing' | 'reflecting' | 'retrying';

interface ToolCallItem {
  action: string;
  detail: string;
  status: 'pending' | 'success' | 'error';
  timestamp: number;
}

interface StreamingIndicatorProps {
  phase: StreamingPhase;
  retryProgress?: { attempt: number; max: number; countdown: number } | null;
  action?: string;
  detail?: string;
  toolCallHistory?: ToolCallItem[];
}

const phaseConfig: Record<StreamingPhase, { text: string; color: string; icon: any }> = {
  thinking: { text: 'Thinking', color: 'text-yellow-500', icon: Brain },
  planning: { text: 'Planning', color: 'text-purple-500', icon: ClipboardList },
  executing: { text: 'Executing', color: 'text-blue-500', icon: Zap },
  reflecting: { text: 'Reflecting', color: 'text-orange-500', icon: Search },
  retrying: { text: 'Retrying', color: 'text-green-500', icon: RefreshCw },
};

function ElapsedTimer({ startTime }: { startTime: number }) {
  const [elapsed, setElapsed] = useState(Date.now() - startTime);
  useEffect(() => {
    const timer = setInterval(() => setElapsed(Date.now() - startTime), 100);
    return () => clearInterval(timer);
  }, [startTime]);
  const secs = (elapsed / 1000).toFixed(0);
  return <span className="tabular-nums">{secs}s</span>;
}

function formatDetail(text: string, maxLen: number): string {
  if (!text) return '';
  try {
    const parsed = JSON.parse(text);
    const short = Object.entries(parsed)
      .slice(0, 2)
      .map(([k, v]) => `${k}: ${typeof v === 'string' ? v.slice(0, 30) : String(v).slice(0, 30)}`)
      .join(', ');
    return short.length > maxLen ? short.slice(0, maxLen) + '...' : short;
  } catch {
    return text.length > maxLen ? text.slice(0, maxLen) + '...' : text;
  }
}

export function StreamingIndicator({ phase, retryProgress, action, detail, toolCallHistory = [] }: StreamingIndicatorProps) {
  const [expanded, setExpanded] = useState(true);
  const [startTime] = useState(Date.now());
  const config = phaseConfig[phase];
  const PhaseIcon = config.icon;

  const isBrowserAction = action?.toLowerCase().startsWith('browser_') ||
    action?.toLowerCase().includes('navigate') ||
    action?.toLowerCase().includes('click') ||
    action?.toLowerCase().includes('screenshot');

  const completed = toolCallHistory.filter(tc => tc.status !== 'pending').length;
  const failed = toolCallHistory.filter(tc => tc.status === 'error').length;

  return (
    <div className="border-t border-border/50 bg-card/50 backdrop-blur-sm">
      <button
        className="w-full px-4 py-2.5 flex items-center gap-2.5 text-left hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className={cn('w-2 h-2 rounded-full animate-pulse', {
          'bg-yellow-500': phase === 'thinking',
          'bg-purple-500': phase === 'planning',
          'bg-blue-500': phase === 'executing',
          'bg-orange-500': phase === 'reflecting',
          'bg-green-500': phase === 'retrying',
        })} />
        <PhaseIcon size={14} className={cn(config.color)} />
        <span className="text-xs font-medium">{config.text}</span>
        {toolCallHistory.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {completed}/{toolCallHistory.length} steps
            {failed > 0 && <span className="text-red-500 ml-1">({failed} failed)</span>}
          </span>
        )}
        {isBrowserAction && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded text-[10px] font-medium">
            <Globe size={9} />
            Browser
          </span>
        )}
        <div className="flex-1" />
        <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
          <Clock size={10} />
          <ElapsedTimer startTime={startTime} />
        </span>
        {expanded ? <ChevronDown size={14} className="text-muted-foreground" /> : <ChevronRight size={14} className="text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="px-4 pb-3 space-y-1.5">
          {action && (
            <div className={cn(
              'p-2.5 rounded-lg border text-xs',
              isBrowserAction
                ? 'border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-900/20'
                : 'border-border bg-muted/30'
            )}>
              <div className="flex items-center gap-2 mb-1">
                {isBrowserAction ? <Globe size={12} className="text-blue-500" /> : <Settings size={12} className="text-muted-foreground" />}
                <span className="font-mono font-medium text-foreground">{action}</span>
              </div>
              {detail && action !== detail && (
                <div className="text-muted-foreground ml-5">{formatDetail(detail, 100)}</div>
              )}
            </div>
          )}

          {toolCallHistory.length > 0 && (
            <div className="space-y-0.5">
              {toolCallHistory.slice(-8).map((tc, i) => (
                <div
                  key={`${tc.timestamp}-${i}`}
                  className={cn(
                    'flex items-center gap-2 px-2 py-1.5 rounded text-xs',
                    tc.status === 'success' && 'text-green-700 dark:text-green-400',
                    tc.status === 'error' && 'text-red-700 dark:text-red-400',
                    tc.status === 'pending' && 'text-yellow-700 dark:text-yellow-400'
                  )}
                >
                  {tc.status === 'success' ? <Check size={11} /> : tc.status === 'error' ? <X size={11} /> : <Loader2 size={11} className="animate-spin" />}
                  <span className="font-mono font-medium">{tc.action}</span>
                  <span className="text-muted-foreground truncate flex-1">{formatDetail(tc.detail, 50)}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">{new Date(tc.timestamp).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          )}

          {retryProgress && retryProgress.countdown > 0 && (
            <div className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
              <Loader2 size={10} className="animate-spin" />
              Retry {retryProgress.attempt}/{retryProgress.max} in {retryProgress.countdown.toFixed(1)}s
            </div>
          )}
        </div>
      )}
    </div>
  );
}
