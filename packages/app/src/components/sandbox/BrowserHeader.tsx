/**
 * BrowserHeader Component
 * Header section with controls and URL bar
 */

import { X, Maximize2, Minimize2, RefreshCw, Globe } from 'lucide-react';
import { Button } from '@/elements/actions/Button';
import { BrowserStatus } from '@/hooks/browser/types';

interface BrowserHeaderProps {
  browserStatus: BrowserStatus;
  inputUrl: string;
  setInputUrl: (url: string) => void;
  onUrlKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onBack: () => void;
  onForward: () => void;
  onRefresh: () => void;
  onToggleFullscreen: () => void;
  onClose: () => void;
}

export function BrowserHeader({
  browserStatus,
  inputUrl,
  setInputUrl,
  onUrlKeyDown,
  onBack,
  onForward,
  onRefresh,
  onToggleFullscreen,
  onClose
}: BrowserHeaderProps) {
  return (
    <div className="bg-muted/30 border-b border-border backdrop-blur-md z-50">
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          {browserStatus === 'connecting' ? (
            <div className="w-4 h-4 animate-spin text-yellow-500 border-2 border-current border-t-transparent rounded-full" />
          ) : browserStatus === 'ready' ? (
            <div className="w-4 h-4 rounded-full bg-green-500" />
          ) : browserStatus === 'error' ? (
            <Globe className="w-4 h-4 text-red-500" />
          ) : (
            <div className="w-4 h-4 rounded-full bg-muted-foreground/50" />
          )}
          <span className="text-sm font-medium">Browser</span>
          {browserStatus === 'ready' && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-600">
              Ready
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={onBack} className="h-7 w-7 p-0" title="Back">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Button>
          <Button size="sm" variant="ghost" onClick={onForward} className="h-7 w-7 p-0" title="Forward">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Button>
          <Button size="sm" variant="ghost" onClick={onRefresh} className="h-7 w-7 p-0" title="Refresh">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
          <button
            onClick={onToggleFullscreen}
            className="p-1.5 hover:bg-muted-foreground/20 rounded transition-all"
            title="Toggle fullscreen"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-destructive/20 hover:text-destructive rounded transition-all"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* URL Bar */}
      <div className="flex items-center gap-2 px-3 pb-2">
        <div className="flex-1 flex items-center bg-background border border-input rounded-md px-3 py-1.5 shadow-sm">
          <Globe className="w-3 h-3 text-muted-foreground mr-2 shrink-0" />
          <input
            type="text"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            onKeyDown={onUrlKeyDown}
            placeholder="Search or enter URL..."
            className="flex-1 bg-transparent text-sm outline-none text-foreground min-w-0"
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  );
}
