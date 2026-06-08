/**
 * BrowserStatusBar Component
 * Status bar showing browser state and current URL
 */

import { Wifi } from 'lucide-react';
import { BrowserStatus } from '@/hooks/browser/types';

interface BrowserStatusBarProps {
  browserStatus: BrowserStatus;
  browserUrl: string;
}

export function BrowserStatusBar({ browserStatus, browserUrl }: BrowserStatusBarProps) {
  return (
    <div className="flex items-center justify-between px-3 py-1.5 border-t border-border text-xs bg-muted/30 backdrop-blur-sm">
      <div className="flex items-center gap-2">
        {browserStatus === 'ready' ? (
          <>
            <Wifi className="w-3 h-3 text-green-500" />
            <span className="text-green-600">Ready</span>
          </>
        ) : (
          <span className="text-muted-foreground">{browserStatus}</span>
        )}
      </div>
      <span className="text-muted-foreground truncate max-w-[300px]">{browserUrl || 'about:blank'}</span>
    </div>
  );
}
