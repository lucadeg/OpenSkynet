import { cn } from '@/lib/utils';
import { Sidebar } from './Sidebar';
import { useAppStore } from '@/stores/useAppStore';
import { useSandboxStore } from '@/stores/useSandboxStore';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const sidebarOpen = useAppStore((state) => state.sidebarOpen);
  const sandboxOpen = useSandboxStore((state) => state.isOpen);

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar />

      <main
        id="main-content"
        className={cn(
          'flex-1 flex flex-col overflow-hidden',
          'border-l border-border',
          'transition-all duration-200 ease-out',
          'bg-background',
          sidebarOpen ? 'ml-56' : 'ml-12',
          sandboxOpen ? 'mr-[600px]' : ''
        )}
      >
        {children}
      </main>
    </div>
  );
}
