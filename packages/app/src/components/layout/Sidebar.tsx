import {
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { navItems } from '@/lib/navigation';
import { useAppStore } from '@/stores/useAppStore';
import { SidebarNav } from './SidebarNav';
import { SidebarAgent } from './SidebarAgent';
import { SidebarStatus } from './SidebarStatus';
import { Button } from '@/elements/actions/Button';

export function Sidebar() {
  const sidebarOpen = useAppStore((state) => state.sidebarOpen);
  const setSidebarOpen = useAppStore((state) => state.setSidebarOpen);
  const theme = useAppStore((state) => state.theme);
  const toggleTheme = useAppStore((state) => state.toggleTheme);

  return (
    <>
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 z-[100] bg-primary text-primary-foreground px-4 py-2 rounded">
        Skip to main content
      </a>
      <aside
        className={cn(
          'h-full flex flex-col',
          'transition-all duration-200 ease-out',
          'bg-background text-foreground border-r border-border/50',
          sidebarOpen ? 'w-56' : 'w-14'
        )}
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="h-11 flex items-center justify-between px-4 border-b border-border/30 flex-shrink-0">
          <div className="flex items-center gap-2">
            {sidebarOpen && (
              <span className="text-sm font-medium whitespace-nowrap text-foreground/90">
                OpenSkynet
              </span>
            )}
          </div>
          <div className={cn('flex items-center gap-1.5', !sidebarOpen && 'mx-auto')}>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleTheme}
              className={cn(
                'h-8 w-8 shrink-0 p-0 rounded-xl',
                'hover:bg-muted/50',
                'transition-all duration-250 ease-out',
                'hover:scale-105'
              )}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-foreground/70" />
              ) : (
                <Moon className="w-4 h-4 text-foreground/70" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className={cn(
                'h-8 w-8 shrink-0 p-0 rounded-xl',
                'hover:bg-muted/50',
                'transition-all duration-250 ease-out',
                'hover:scale-105'
              )}
              aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            >
              {sidebarOpen ? (
                <ChevronLeft className="w-4 h-4 text-foreground/70" />
              ) : (
                <ChevronRight className="w-4 h-4 text-foreground/70" />
              )}
            </Button>
          </div>
        </div>

        {sidebarOpen && (
          <>
            <nav className="flex-1 overflow-y-auto py-2 scrollbar-thin" aria-label="Page navigation">
              <div className="px-2">
                <SidebarNav />
              </div>

              <div className="mx-4 my-2 h-px bg-border/50" />

              <div className="px-2">
                <SidebarAgent />
              </div>
            </nav>

            <div className="flex items-center p-2 border-t border-border/50 min-h-[38px] flex-shrink-0">
              <SidebarStatus />
            </div>
          </>
        )}

        {!sidebarOpen && (
          <nav className="flex-1 flex flex-col items-center py-6 gap-2" aria-label="Page navigation (collapsed)">
            {navItems.map((item) => (
              <CollapsedNavItem
                key={item.id}
                icon={item.icon}
                label={item.label}
                page={item.id}
              />
            ))}
          </nav>
        )}
      </aside>
    </>
  );
}

interface CollapsedNavItemProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  page: string;
}

function CollapsedNavItem({ icon: Icon, label, page }: CollapsedNavItemProps) {
  const currentPage = useAppStore((state) => state.currentPage);
  const setCurrentPage = useAppStore((state) => state.setCurrentPage);
  const isActive = currentPage === page;

  return (
    <div className="group relative">
      <button
        onClick={() => setCurrentPage(page as any)}
        className={cn(
          'sidebar-icon-btn',
          isActive && 'active'
        )}
        title={label}
        aria-label={label}
        aria-current={isActive ? 'page' : undefined}
      >
        <Icon className="w-5 h-5" />
      </button>

      {/* Elegant tooltip - no keyboard shortcuts */}
      <div className="sidebar-tooltip">
        <span className="tooltip-label">{label}</span>
      </div>
    </div>
  );
}
