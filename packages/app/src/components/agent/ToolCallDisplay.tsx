import { useState } from 'react';
import { ChevronDown, ChevronRight, Check, X, Loader2, Clock, Globe, Terminal, FileText, Zap } from 'lucide-react';
import type { ToolCallRecord } from '@/types';
import { cn } from '@/lib/utils';

function getToolIcon(action: string) {
  if (action.startsWith('browser_')) return Globe;
  if (action.includes('file') || action.includes('read') || action.includes('write')) return FileText;
  if (action.includes('shell') || action.includes('exec')) return Terminal;
  return Zap;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatDetail(text: string, maxLen: number): string {
  if (!text) return '';
  try {
    const parsed = JSON.parse(text);
    const short = Object.entries(parsed)
      .slice(0, 3)
      .map(([k, v]) => `${k}=${typeof v === 'string' ? v.slice(0, 40) : JSON.stringify(v)?.slice(0, 40)}`)
      .join(', ');
    return short.length > maxLen ? short.slice(0, maxLen) + '...' : short;
  } catch {
    return text.length > maxLen ? text.slice(0, maxLen) + '...' : text;
  }
}

export function ToolCallBlock({ toolCall }: { toolCall: ToolCallRecord }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = getToolIcon(toolCall.action);
  const duration = toolCall.completedAt ? toolCall.completedAt - toolCall.startedAt : null;

  const statusStyles = {
    pending: 'border-yellow-300 dark:border-yellow-700 bg-yellow-50/50 dark:bg-yellow-900/10',
    success: 'border-green-300 dark:border-green-700 bg-green-50/50 dark:bg-green-900/10',
    error: 'border-red-300 dark:border-red-700 bg-red-50/50 dark:bg-red-900/10',
  };

  const StatusIcon = {
    pending: <Loader2 size={12} className="animate-spin text-yellow-600 dark:text-yellow-400" />,
    success: <Check size={12} className="text-green-600 dark:text-green-400" />,
    error: <X size={12} className="text-red-600 dark:text-red-400" />,
  };

  return (
    <div className={cn('rounded-md border text-xs overflow-hidden', statusStyles[toolCall.status])}>
      <button
        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown size={12} className="shrink-0 text-muted-foreground" /> : <ChevronRight size={12} className="shrink-0 text-muted-foreground" />}
        <Icon size={12} className={cn('shrink-0', toolCall.action.startsWith('browser_') ? 'text-blue-500' : 'text-muted-foreground')} />
        <span className="font-mono font-medium text-foreground">{toolCall.action}</span>
        <span className="text-muted-foreground truncate flex-1">{formatDetail(toolCall.detail, 60)}</span>
        {StatusIcon[toolCall.status]}
        {duration !== null && (
          <span className="text-muted-foreground shrink-0 inline-flex items-center gap-0.5">
            <Clock size={9} />
            {formatDuration(duration)}
          </span>
        )}
      </button>
      {expanded && (
        <div className="px-3 pb-2 pt-1 space-y-1.5 border-t border-border/50">
          <div>
            <div className="text-muted-foreground font-medium mb-0.5">Input</div>
            <pre className="text-[11px] bg-background/80 rounded px-2 py-1 overflow-x-auto max-h-32 whitespace-pre-wrap break-all">{toolCall.detail}</pre>
          </div>
          {toolCall.observation && (
            <div>
              <div className="text-muted-foreground font-medium mb-0.5">Output</div>
              <pre className={cn(
                'text-[11px] rounded px-2 py-1 overflow-x-auto max-h-40 whitespace-pre-wrap break-all',
                toolCall.status === 'error' ? 'bg-red-100/50 dark:bg-red-900/20' : 'bg-background/80'
              )}>{toolCall.observation.length > 500 ? toolCall.observation.slice(0, 500) + '...' : toolCall.observation}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ToolCallList({ toolCalls }: { toolCalls: ToolCallRecord[] }) {
  if (!toolCalls || toolCalls.length === 0) return null;

  const completed = toolCalls.filter(tc => tc.status !== 'pending').length;
  const failed = toolCalls.filter(tc => tc.status === 'error').length;
  const totalDuration = toolCalls.reduce((sum, tc) => tc.completedAt ? sum + (tc.completedAt - tc.startedAt) : sum, 0);

  return (
    <div className="my-2 space-y-1">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-medium">{completed}/{toolCalls.length} steps</span>
        {failed > 0 && <span className="text-red-500">({failed} failed)</span>}
        {totalDuration > 0 && (
          <span className="inline-flex items-center gap-0.5">
            <Clock size={9} />
            {formatDuration(totalDuration)}
          </span>
        )}
      </div>
      {toolCalls.map((tc) => (
        <ToolCallBlock key={tc.id} toolCall={tc} />
      ))}
    </div>
  );
}
