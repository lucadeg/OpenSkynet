/**
 * Apple-Level Execution Display
 * Premium tool call visualization with beautiful error states
 */

import { useState, useCallback } from 'react';
import { ChevronDown, ChevronRight, Brain, Zap, Clock, Check, X, Loader2, Globe, FileText, Terminal, Settings, Lightbulb, AlertTriangle, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ThinkBlock } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface ExecutionStep {
  id: string;
  type: 'thinking' | 'tool' | 'response';
  timestamp: number;
  duration?: number;
  status: 'pending' | 'running' | 'success' | 'error';
  thinking?: ThinkBlock;
  action?: string;
  detail?: string;
  observation?: string;
  error?: {
    message: string;
    code?: string;
    suggestion?: string;
    retryable?: boolean;
  };
}

export interface ExecutionDisplayProps {
  steps: ExecutionStep[];
  isStreaming?: boolean;
  showSummary?: boolean;
  className?: string;
  onRetry?: (stepId: string) => void;
  onDismiss?: (stepId: string) => void;
}

// ============================================================================
// Utilities
// ============================================================================

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatDetail(text: string, maxLen: number = 50): string {
  if (!text) return '';
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed === 'object' && parsed !== null) {
      const short = Object.entries(parsed)
        .slice(0, 3)
        .map(([k, v]) => `${k}=${typeof v === 'string' ? v.slice(0, 20) : JSON.stringify(v)?.slice(0, 20)}`)
        .join(', ');
      return short.length > maxLen ? short.slice(0, maxLen) + '...' : short;
    }
    return String(parsed).length > maxLen ? String(parsed).slice(0, maxLen) + '...' : String(parsed);
  } catch {
    return text.length > maxLen ? text.slice(0, maxLen) + '...' : text;
  }
}

// ============================================================================
// Components
// ============================================================================

function ExecutionSummary({ steps }: { steps: ExecutionStep[] }) {
  const completed = steps.filter(s => s.status !== 'pending' && s.status !== 'running').length;
  const failed = steps.filter(s => s.status === 'error').length;
  const totalDuration = steps.reduce((sum, s) => sum + (s.duration || 0), 0);
  const thinkingCount = steps.filter(s => s.type === 'thinking').length;

  return (
    <div className="flex items-center gap-4 text-[13px]">
      <div className="flex items-center gap-2">
        <div className={cn(
          "w-2 h-2 rounded-full transition-colors duration-300",
          failed > 0 ? "bg-orange-500" :
          completed === steps.length ? "bg-emerald-500" :
          "bg-blue-500"
        )} />
        <span className="font-medium text-white/90">
          {completed}/{steps.length} steps
        </span>
      </div>

      {thinkingCount > 0 && (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
          <Brain size={12} className="text-amber-400" />
          <span className="text-amber-300">{thinkingCount}</span>
        </div>
      )}

      {failed > 0 && (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-red-500/10 border border-red-500/20">
          <AlertTriangle size={12} className="text-red-400" />
          <span className="text-red-300">{failed} failed</span>
        </div>
      )}

      {totalDuration > 0 && (
        <div className="flex items-center gap-1.5 text-white/50">
          <Clock size={12} />
          <span>{formatDuration(totalDuration)}</span>
        </div>
      )}
    </div>
  );
}

function ErrorDisplay({ error, onRetry, onDismiss }: {
  error: NonNullable<ExecutionStep['error']>;
  onRetry?: () => void;
  onDismiss?: () => void;
}) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="mt-3 space-y-2">
      {/* Error Message */}
      <div className="flex items-start gap-3 p-3 rounded-xl bg-red-500/5 border border-red-500/10">
        <div className="mt-0.5">
          <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center">
            <AlertTriangle size={16} className="text-red-400" />
          </div>
        </div>
        <div className="flex-1 space-y-1">
          <div className="font-medium text-red-300 text-sm">Something went wrong</div>
          <div className="text-red-200/60 text-xs leading-relaxed">{error.message}</div>
          {error.code && (
            <div className="text-[11px] text-red-200/40 font-mono mt-1">Error: {error.code}</div>
          )}
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 rounded-lg hover:bg-red-500/10 transition-colors"
        >
          <EyeOff size={14} className="text-red-300/50" />
        </button>
      </div>

      {/* Suggestion */}
      {error.suggestion && (
        <div className="flex items-start gap-3 p-3 rounded-xl bg-blue-500/5 border border-blue-500/10">
          <Lightbulb size={16} className="text-blue-400 mt-0.5 shrink-0" />
          <div className="flex-1">
            <div className="text-blue-300 text-sm">Suggestion</div>
            <div className="text-blue-200/60 text-xs mt-0.5 leading-relaxed">{error.suggestion}</div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {error.retryable && onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-all duration-200 text-sm"
          >
            <RefreshCw size={14} className="text-white/60" />
            <span className="text-white/80">Retry</span>
          </button>
        )}
        {onDismiss && (
          <button
            onClick={() => { setDismissed(true); onDismiss(); }}
            className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-all duration-200 text-sm text-white/60 hover:text-white/80"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}

function ExecutionStepItem({
  step,
  onRetry,
  onDismiss
}: {
  step: ExecutionStep;
  onRetry?: (stepId: string) => void;
  onDismiss?: (stepId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [contentVisible, setContentVisible] = useState(false);

  const getStepIcon = () => {
    switch (step.type) {
      case 'thinking':
        return Lightbulb;
      case 'tool':
        if (step.action?.startsWith('browser_')) return Globe;
        if (step.action?.includes('file') || step.action?.includes('read') || step.action?.includes('write')) return FileText;
        if (step.action?.includes('shell') || step.action?.includes('exec')) return Terminal;
        return Settings;
      default:
        return Zap;
    }
  };

  const StepIcon = getStepIcon();
  const isThinking = step.type === 'thinking';
  const hasError = step.status === 'error';

  const statusStyles = {
    pending: {
      container: 'border-white/5 bg-white/[0.02]',
      icon: 'text-white/30',
      glow: ''
    },
    running: {
      container: 'border-blue-500/20 bg-blue-500/5',
      icon: 'text-blue-400',
      glow: 'shadow-[0_0_0_1px_rgba(59,130,246,0.3)]'
    },
    success: {
      container: isThinking
        ? 'border-amber-500/10 bg-amber-500/5'
        : 'border-emerald-500/10 bg-emerald-500/5',
      icon: isThinking ? 'text-amber-400' : 'text-emerald-400',
      glow: ''
    },
    error: {
      container: 'border-red-500/20 bg-red-500/5',
      icon: 'text-red-400',
      glow: 'shadow-[0_0_0_1px_rgba(239,68,68,0.2)]'
    }
  };

  const currentStyle = statusStyles[step.status];

  const handleExpand = useCallback(() => {
    setExpanded(true);
    // Delay content visibility for smooth animation
    setTimeout(() => setContentVisible(true), 50);
  }, []);

  const handleCollapse = useCallback(() => {
    setContentVisible(false);
    // Delay collapse for smooth animation
    setTimeout(() => setExpanded(false), 150);
  }, []);

  return (
    <div
      className={cn(
        'rounded-2xl border overflow-hidden transition-all duration-300',
        currentStyle.container,
        currentStyle.glow,
        hasError && 'animate-pulse-subtle'
      )}
    >
      {/* Header */}
      <button
        className={cn(
          'w-full flex items-center gap-3 px-4 py-3 text-left',
          'transition-all duration-200',
          'hover:bg-white/[0.03]',
          expanded && 'bg-white/[0.03]'
        )}
        onClick={expanded ? handleCollapse : handleExpand}
      >
        {/* Expand Icon */}
        <div className={cn(
          'transition-transform duration-200',
          expanded ? 'rotate-0' : '-rotate-90'
        )}>
          <ChevronDown size={16} className="text-white/40" />
        </div>

        {/* Step Icon */}
        <div className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center',
          'bg-white/5 border border-white/10',
          step.status === 'running' && 'animate-pulse'
        )}>
          {step.status === 'running' ? (
            <Loader2 size={16} className={currentStyle.icon} />
          ) : step.status === 'success' ? (
            <Check size={16} className={currentStyle.icon} />
          ) : step.status === 'error' ? (
            <X size={16} className={currentStyle.icon} />
          ) : (
            <StepIcon size={16} className={currentStyle.icon} />
          )}
        </div>

        {/* Title */}
        <div className="flex-1 min-w-0">
          <div className={cn(
            'font-medium text-sm truncate',
            isThinking ? 'text-amber-200' : 'text-white/90'
          )}>
            {isThinking ? (step.thinking?.label || 'Thinking') : step.action}
          </div>
          <div className="text-white/40 text-xs truncate mt-0.5">
            {isThinking ? formatDetail(step.thinking?.content || '', 50) : formatDetail(step.detail || '', 50)}
          </div>
        </div>

        {/* Duration */}
        {step.duration !== undefined && (
          <div className="flex items-center gap-1.5 text-white/40 text-xs">
            <Clock size={12} />
            <span>{formatDuration(step.duration)}</span>
          </div>
        )}
      </button>

      {/* Expanded Content */}
      <div
        className={cn(
          'overflow-hidden transition-all duration-300 ease-in-out',
          expanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        <div className="px-4 pb-3 space-y-3">
          {/* Error Display */}
          {hasError && step.error && (
            <ErrorDisplay
              error={step.error}
              onRetry={() => onRetry?.(step.id)}
              onDismiss={() => onDismiss?.(step.id)}
            />
          )}

          {/* Thinking Content */}
          {isThinking && step.thinking?.content && contentVisible && (
            <div className="space-y-2">
              <div className="text-[11px] font-medium text-white/30 uppercase tracking-wider">
                Reasoning
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-white/70 leading-relaxed whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
                {step.thinking.content}
              </div>
            </div>
          )}

          {/* Tool Input */}
          {!isThinking && step.detail && contentVisible && (
            <div className="space-y-2">
              <div className="text-[11px] font-medium text-white/30 uppercase tracking-wider">
                Input
              </div>
              <pre className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-white/70 overflow-x-auto max-h-32 whitespace-pre-wrap break-all">
                {step.detail}
              </pre>
            </div>
          )}

          {/* Tool Output */}
          {!isThinking && step.observation && contentVisible && (
            <div className="space-y-2">
              <div className="text-[11px] font-medium text-white/30 uppercase tracking-wider">
                Output
              </div>
              <pre className={cn(
                'p-3 rounded-xl border text-xs overflow-x-auto max-h-40 whitespace-pre-wrap break-all',
                hasError
                  ? 'bg-red-500/5 border-red-500/10 text-red-200/60'
                  : 'bg-white/5 border-white/10 text-white/70'
              )}>
                {step.observation.length > 1000 ? step.observation.slice(0, 1000) + '...' : step.observation}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ExecutionDisplay({
  steps,
  showSummary = true,
  className,
  onRetry,
  onDismiss
}: ExecutionDisplayProps) {
  if (!steps || steps.length === 0) return null;

  return (
    <div className={cn('space-y-3', className)}>
      {showSummary && <ExecutionSummary steps={steps} />}

      <div className="space-y-2">
        {steps.map((step, index) => (
          <ExecutionStepItem
            key={`${step.id}-${index}`}
            step={step}
            onRetry={onRetry}
            onDismiss={onDismiss}
          />
        ))}
      </div>
    </div>
  );
}

export default ExecutionDisplay;
