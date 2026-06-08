/**
 * ResizeHandle Component
 * Handle for resizing the browser panel
 */

import { cn } from '@/lib/utils';

interface ResizeHandleProps {
  panelWidth: number;
  isResizing: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
}

export function ResizeHandle({ panelWidth, isResizing, onMouseDown }: ResizeHandleProps) {
  return (
    <div
      className={cn(
        "fixed top-0 h-full w-3 cursor-col-resize flex items-center justify-center z-[50]",
        "hover:bg-primary/20 transition-colors",
        isResizing && "bg-primary/40"
      )}
      style={{ left: `calc(100% - ${panelWidth}px - 1.5px)` }}
      onMouseDown={onMouseDown}
      aria-hidden="true"
    >
      <div className="w-0.5 h-8 rounded-full bg-muted-foreground/30" />
    </div>
  );
}
