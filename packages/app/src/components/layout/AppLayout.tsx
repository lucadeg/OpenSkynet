import { cn } from '@/lib/utils';
import { Sidebar } from './Sidebar';
import { SandboxPanel } from '@/components/sandbox';
import { useSandboxStore } from '@/stores/useSandboxStore';
import { useEffect } from 'react';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const sandboxOpen = useSandboxStore((state) => state.isOpen);

  // Show/hide browser view when sandbox state changes
  useEffect(() => {
    // BrowserView overlay disabled to prevent blocking clicks
    // The SandboxPanel manages its own browser view
  }, [sandboxOpen]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // BrowserView overlay disabled - no cleanup needed
    };
  }, []);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      {/* Sidebar */}
      <div className="flex-shrink-0 z-50">
        <Sidebar />
      </div>

      {/* Main content area */}
      <main
        id="main-content"
        className={cn(
          'flex-1 flex flex-col overflow-hidden min-w-0',
          'border-l border-border',
          'transition-all duration-200 ease-out',
          'bg-background'
        )}
      >
        {children}
      </main>

      {/* Sandbox panel (browser) - only shown when open */}
      {sandboxOpen && (
        <div className="flex-shrink-0 w-[600px] border-l border-border overflow-hidden bg-background">
          <SandboxPanel />
        </div>
      )}
    </div>
  );
}
