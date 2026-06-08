import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  X, Maximize2, Minimize2, RefreshCw, Globe, Loader2, Monitor, Wifi
} from 'lucide-react';
import { Button } from '@/elements/actions/Button';
import { useSandboxStore } from '@/stores/useSandboxStore';
import { cn } from '@/lib/utils';

const API_BASE = import.meta.env?.VITE_API_BASE || 'http://localhost:3001';

export function SandboxPanel() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [panelWidth, setPanelWidth] = useState(600);
  const [isResizing, setIsResizing] = useState(false);
  const [browserUrl, setBrowserUrl] = useState('');
  const [inputUrl, setInputUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [cdpConnected, setCdpConnected] = useState(false);

  const isOpen = useSandboxStore(state => state.isOpen);
  const isActive = useSandboxStore(state => state.isActive);
  const togglePanel = useSandboxStore(state => state.togglePanel);

  const webviewRef = useRef<any>(null);

  // When webview mounts, set up event listeners
  const webviewCallbackRef = useCallback((node: any) => {
    if (!node) return;
    webviewRef.current = node;

    node.addEventListener('did-navigate', (e: any) => {
      setBrowserUrl(e.url);
      setInputUrl(e.url);
      setIsLoading(false);
    });
    node.addEventListener('did-navigate-in-page', (e: any) => {
      if (e.url) {
        setBrowserUrl(e.url);
        setInputUrl(e.url);
      }
    });
    node.addEventListener('did-start-loading', () => setIsLoading(true));
    node.addEventListener('did-stop-loading', () => setIsLoading(false));
    node.addEventListener('did-fail-load', (e: any) => {
      if (e.errorCode === -3) {
        setIsLoading(false);
        return;
      }
      setIsLoading(false);
    });
  }, []);

  // When agent becomes active, discover webview CDP target and connect Playwright to it
  // This makes agent and user share the SAME browser
  useEffect(() => {
    if (!isActive || !isOpen || cdpConnected) return;

    const connectSharedBrowser = async () => {
      try {
        // 1. Navigate webview to a real page so CDP target is discoverable
        if (webviewRef.current) {
          const currentUrl = webviewRef.current.getURL();
          if (!currentUrl || currentUrl === 'about:blank' || currentUrl.startsWith('file://')) {
            webviewRef.current.loadURL('about:blank');
            await new Promise(r => setTimeout(r, 500));
          }
        }

        // 2. Get CDP target from Electron main process
        const electronAPI = (window as any).electronAPI;
        if (!electronAPI?.browser?.getCdpTarget) return;

        const cdpResult = await electronAPI.browser.getCdpTarget();
        if (!cdpResult?.success || !cdpResult.webSocketDebuggerUrl) {
          console.warn('[SandboxPanel] CDP target not available:', cdpResult?.error);
          return;
        }

        console.log('[SandboxPanel] CDP endpoint:', cdpResult.webSocketDebuggerUrl.substring(0, 60) + '...');

        // 3. Tell server to connect Playwright to this webview
        const resp = await fetch(`${API_BASE}/api/browser/connect-cdp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ webSocketDebuggerUrl: cdpResult.webSocketDebuggerUrl }),
        });

        const data = await resp.json();
        if (data.success) {
          console.log('[SandboxPanel] Shared browser connected! Agent and user share the same browser.');
          setCdpConnected(true);
        } else {
          console.warn('[SandboxPanel] CDP connect failed:', data.error);
        }
      } catch (err) {
        console.warn('[SandboxPanel] Shared browser setup failed:', err);
      }
    };

    // Small delay to let webview mount
    const timer = setTimeout(connectSharedBrowser, 1000);
    return () => clearTimeout(timer);
  }, [isActive, isOpen, cdpConnected]);

  const navigateTo = useCallback((url: string) => {
    let target = url.trim();
    if (!target) return;
    if (!/^https?:\/\//i.test(target)) {
      target = 'https://' + target;
    }
    setInputUrl(target);
    if (webviewRef.current) {
      webviewRef.current.loadURL(target);
    }
  }, []);

  const handleUrlKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      navigateTo((e.target as HTMLInputElement).value);
    }
  }, [navigateTo]);

  const handleRefresh = useCallback(() => {
    if (webviewRef.current) {
      webviewRef.current.reload();
    }
  }, []);

  const handleBack = useCallback(() => {
    if (webviewRef.current) {
      webviewRef.current.goBack();
    }
  }, []);

  const handleForward = useCallback(() => {
    if (webviewRef.current) {
      webviewRef.current.goForward();
    }
  }, []);

  const handleClose = useCallback(() => togglePanel(), [togglePanel]);

  const resizeHandlers = useMemo(() => ({
    down: (e: React.MouseEvent) => { if (isFullscreen) return; setIsResizing(true); e.preventDefault(); },
    move: (e: MouseEvent) => { if (!isResizing) return; const w = window.innerWidth - e.clientX; if (w >= 400 && w <= window.innerWidth - 100) setPanelWidth(w); },
    up: () => setIsResizing(false),
  }), [isFullscreen, isResizing]);

  useEffect(() => {
    if (!isResizing) return;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', resizeHandlers.move);
    window.addEventListener('mouseup', resizeHandlers.up);
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', resizeHandlers.move);
      window.removeEventListener('mouseup', resizeHandlers.up);
    };
  }, [isResizing, resizeHandlers.move, resizeHandlers.up]);

  if (!isOpen) return null;

  return (
    <>
      {!isFullscreen && (
        <div
          className={cn("fixed top-0 h-full z-[100] w-3 cursor-col-resize flex items-center justify-center", "hover:bg-primary/20 transition-colors", isResizing && "bg-primary/40")}
          style={{ left: `calc(100% - ${panelWidth}px - 1.5px)` }}
          onMouseDown={resizeHandlers.down}
          aria-hidden="true"
        >
          <div className="w-0.5 h-8 rounded-full bg-muted-foreground/30" />
        </div>
      )}

      <div
        className={cn("flex flex-col shadow-2xl transition-all duration-200 border-l border-border", isFullscreen ? "fixed inset-0 z-50" : "fixed right-0 top-0 bottom-0 z-50", "bg-background")}
        style={{ width: isFullscreen ? '100%' : panelWidth }}
        role="complementary"
        aria-label="Browser"
      >
        {/* Header */}
        <div className="bg-muted/30 border-b border-border backdrop-blur-md">
          <div className="flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-2">
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-yellow-500" />
              ) : cdpConnected ? (
                <Wifi className="w-4 h-4 text-green-500" />
              ) : (
                <Globe className="w-4 h-4 text-muted-foreground" />
              )}
              <span className="text-sm font-medium">Browser</span>
              {cdpConnected && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-600">Shared</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" onClick={handleBack} className="h-7 w-7 p-0" title="Back">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </Button>
              <Button size="sm" variant="ghost" onClick={handleForward} className="h-7 w-7 p-0" title="Forward">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </Button>
              <Button size="sm" variant="ghost" onClick={handleRefresh} className="h-7 w-7 p-0" title="Refresh">
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
              <button onClick={() => setIsFullscreen(!isFullscreen)} className="p-1.5 hover:bg-muted-foreground/20 rounded transition-all" title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <button onClick={handleClose} className="p-1.5 hover:bg-destructive/20 hover:text-destructive rounded transition-all" title="Close">
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
                onKeyDown={handleUrlKeyDown}
                placeholder="Search or enter URL..."
                className="flex-1 bg-transparent text-sm outline-none text-foreground min-w-0"
                spellCheck={false}
              />
            </div>
          </div>
        </div>

        {/* Real Chromium Browser — Electron <webview> shared with agent via CDP */}
        <div className="flex-1 relative overflow-hidden bg-white">
          <webview
            ref={webviewCallbackRef}
            src="about:blank"
            className="absolute inset-0 w-full h-full"
            allowpopups
            useragent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
          />

          {!isActive && (
            <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
              <div className="text-center p-8">
                <Monitor className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-sm font-medium mb-2">Browser Inactive</h3>
                <p className="text-muted-foreground text-sm">Start an agent task to begin browsing</p>
              </div>
            </div>
          )}
        </div>

        {/* Status Bar */}
        <div className="flex items-center justify-between px-3 py-1.5 border-t border-border text-xs bg-muted/30 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            {isLoading ? (
              <><Loader2 className="w-3 h-3 animate-spin text-yellow-500" /><span className="text-yellow-600">Loading...</span></>
            ) : cdpConnected ? (
              <><Wifi className="w-3 h-3 text-green-500" /><span className="text-green-600">Shared</span></>
            ) : (
              <span className="text-muted-foreground">Ready</span>
            )}
          </div>
          <span className="text-muted-foreground truncate max-w-[300px]">{browserUrl || 'about:blank'}</span>
        </div>
      </div>
    </>
  );
}
