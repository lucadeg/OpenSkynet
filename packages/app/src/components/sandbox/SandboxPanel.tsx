import { useState, useCallback, useEffect, useRef } from 'react';
import { X, Maximize2, Minimize2, RefreshCw, ExternalLink, Globe, Upload, FileText, Square, Plus } from 'lucide-react';
import { Button } from '@/components/shared/Button';
import { useSandboxStore } from '@/stores/useSandboxStore';
import { cn } from '@/lib/utils';

interface UploadedFile {
  name: string;
  path: string;
  size: number;
}

interface SandboxSession {
  id: string;
  name: string;
  type: 'browser' | 'computer';
  status: 'starting' | 'running' | 'stopped' | 'error';
  createdAt: number;
  lastUsedAt: number;
  browserInstanceId?: string;
  metadata?: Record<string, unknown>;
}

interface BrowserTab {
  id: string;
  url: string;
  title: string;
  loading: boolean;
}

export function SandboxPanel() {
  const isOpen = useSandboxStore(state => state.isOpen);
  const isActive = useSandboxStore(state => state.isActive);
  const togglePanel = useSandboxStore(state => state.togglePanel);
  const setIsActive = useSandboxStore(state => state.setIsActive);
  const setConnectionStatus = useSandboxStore(state => state.setConnectionStatus);

  // Auto-activate browser when panel opens
  useEffect(() => {
    if (isOpen && !isActive) {
      setIsActive(true);
      setConnectionStatus('connected');
    }
  }, [isOpen, isActive, setIsActive, setConnectionStatus]);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [panelWidth, setPanelWidth] = useState(600);
  const [isResizing, setIsResizing] = useState(false);
  const [browserTabs, setBrowserTabs] = useState<BrowserTab[]>([
    { id: 'tab-1', url: 'https://www.wikipedia.org', title: 'Wikipedia', loading: false }
  ]);
  const [activeTabId, setActiveTabId] = useState('tab-1');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sandboxSessions, setSandboxSessions] = useState<SandboxSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const apiBaseUrl = 'http://localhost:3001';
  const webviewRef = useRef<any>(null);

  const activeTab = browserTabs.find(tab => tab.id === activeTabId) || browserTabs[0];

  useEffect(() => {
    // Force webview to load URL when active tab changes
    if (isActive && webviewRef.current && activeTab) {
      webviewRef.current.src = activeTab.url;
      setTimeout(() => {
        if (webviewRef.current && webviewRef.current.loadURL) {
          webviewRef.current.loadURL(activeTab.url);
        }
      }, 100);
    }
  }, [isActive, activeTab]);

  const handleAddTab = () => {
    const newTab: BrowserTab = {
      id: `tab-${Date.now()}`,
      url: 'https://www.wikipedia.org',
      title: 'New Tab',
      loading: false
    };
    setBrowserTabs([...browserTabs, newTab]);
    setActiveTabId(newTab.id);
  };

  const handleCloseTab = (tabId: string) => {
    if (browserTabs.length === 1) return; // Don't close the last tab
    const newTabs = browserTabs.filter(tab => tab.id !== tabId);
    setBrowserTabs(newTabs);
    if (activeTabId === tabId) {
      setActiveTabId(newTabs[0].id);
    }
  };

  const handleTabChange = (tabId: string) => {
    setActiveTabId(tabId);
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const tab = browserTabs.find(t => t.id === activeTabId);
    if (!tab) return;

    let url = (e.target as any).elements.url.value.trim();
    if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    // Update the active tab
    setBrowserTabs(browserTabs.map(t =>
      t.id === activeTabId ? { ...t, url, loading: true } : t
    ));

    if (url && window.electronAPI) {
      window.electronAPI.browserNavigate(url);
    }
  };

  const updateTabTitle = (tabId: string, title: string) => {
    setBrowserTabs(browserTabs.map(tab =>
      tab.id === tabId ? { ...tab, title, loading: false } : tab
    ));
  };

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isFullscreen) return;
    setIsResizing(true);
    e.preventDefault();
  }, [isFullscreen]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;
    const newWidth = window.innerWidth - e.clientX;
    if (newWidth >= 400 && newWidth <= window.innerWidth - 100) {
      setPanelWidth(newWidth);
    }
  }, [isResizing]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/files/upload`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.uploaded) {
          setUploadedFiles(prev => [...prev, ...result.uploaded]);
        }
      }
    } catch (error) {
      console.error('Failed to upload files:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveFile = (fileName: string) => {
    setUploadedFiles(prev => prev.filter(f => f.name !== fileName));
  };

  const handleOpenFilePicker = () => {
    fileInputRef.current?.click();
  };

  const loadSandboxSessions = async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/sandbox/list`);
      if (response.ok) {
        const data = await response.json();
        setSandboxSessions(data.sessions || []);
      }
    } catch (error) {
      console.error('Failed to load sandbox sessions:', error);
    }
  };

  useEffect(() => {
    loadSandboxSessions();
    const interval = setInterval(loadSandboxSessions, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleStopSandbox = async (sessionId: string) => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/sandbox/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });

      if (response.ok) {
        await loadSandboxSessions();
      }
    } catch (error) {
      console.error('Failed to stop sandbox:', error);
    }
  };

  const handleRefresh = async () => {
    if (window.electronAPI) {
      await window.electronAPI.browserRefresh();
      // Reload the active tab
      if (activeTab && webviewRef.current) {
        webviewRef.current.src = activeTab.url;
      }
    }
  };

  if (!isOpen) {
    return null;
  }

  const hasActiveSessions = sandboxSessions.some(s => s.status === 'running');

  return (
    <>
      {!isFullscreen && (
        <div
          className={cn(
            "fixed top-0 h-full z-[100] w-3 cursor-col-resize flex items-center justify-center",
            "hover:bg-primary/20 transition-colors",
            isResizing && "bg-primary/40"
          )}
          style={{ left: `calc(100% - ${panelWidth}px - 1.5px)` }}
          onMouseDown={handleMouseDown}
          aria-hidden="true"
        >
          <div className="w-0.5 h-8 rounded-full bg-muted-foreground/30" />
        </div>
      )}
      <div
        className={cn(
          "flex flex-col shadow-lg transition-all duration-300 border-l border-border pointer-events-auto",
          isFullscreen ? "fixed inset-0 z-50" : "fixed right-0 top-0 bottom-0 z-50"
        )}
        style={{
          width: isFullscreen ? '100%' : panelWidth,
          backgroundColor: 'transparent',
          background: 'transparent'
        }}
        role="complementary"
        aria-label="Browser panel"
      >
        {/* Header */}
        <div className="bg-muted/30 border-b border-border backdrop-blur-sm" style={{ backgroundColor: 'rgba(var(--muted-rgb), 0.3)' }}>
          <div className="flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Browser</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleRefresh}
                className="h-7 w-7 p-0"
                title="Refresh"
              >
                <RefreshCw className="w-3 h-3" />
              </Button>
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-1.5 hover:bg-muted-foreground/20 rounded transition-all duration-200"
                title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <button
                onClick={async () => {
                  if (window.electronAPI) {
                    await window.electronAPI.browserHide();
                  }
                  togglePanel();
                }}
                className="p-1.5 hover:bg-destructive/20 hover:text-destructive rounded transition-all duration-200"
                title="Close browser"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 px-2 pt-2 border-b border-border/50">
            {browserTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-t-md text-xs transition-all",
                  "hover:bg-muted-foreground/10",
                  activeTabId === tab.id
                    ? "bg-background border border-b-0 border-border"
                    : "text-muted-foreground"
                )}
              >
                <Globe className="w-3 h-3" />
                <span className="max-w-[120px] truncate">{tab.title}</span>
                {browserTabs.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCloseTab(tab.id);
                    }}
                    className="ml-1 p-0.5 hover:bg-destructive/20 rounded"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </button>
            ))}
            <button
              onClick={handleAddTab}
              className="p-1.5 hover:bg-muted-foreground/10 rounded transition-all"
              title="Add new tab"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          {/* URL Bar */}
          <form onSubmit={handleUrlSubmit} className="flex items-center gap-2 px-3 pb-2">
            <div className="flex-1 flex items-center bg-background border border-input rounded-md px-3 py-1.5 shadow-sm">
              <ExternalLink className="w-3 h-3 text-muted-foreground mr-2" />
              <input
                type="text"
                name="url"
                defaultValue={activeTab?.url}
                className="flex-1 bg-transparent text-sm outline-none text-foreground"
                placeholder="Enter URL..."
                aria-label="Browser URL"
              />
            </div>
          </form>
        </div>

        {/* Action Buttons */}
        <div className="border-b border-border bg-muted/20 px-3 py-3 space-y-2 relative z-10 backdrop-blur-sm" style={{ backgroundColor: 'rgba(var(--muted-rgb), 0.2)' }}>
          <Button
            variant="outline"
            onClick={handleOpenFilePicker}
            disabled={isLoading}
            className="w-full"
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload Files
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        {/* Uploaded Files */}
        {uploadedFiles.length > 0 && (
          <div className="border-b border-border px-3 py-2 max-h-32 overflow-y-auto relative z-10 backdrop-blur-sm" style={{ backgroundColor: 'rgba(var(--background-rgb), 0.8)' }}>
            <div className="text-xs font-medium text-muted-foreground mb-2">Uploaded Files</div>
            <div className="space-y-1">
              {uploadedFiles.map((file) => (
                <div
                  key={file.name}
                  className="flex items-center gap-2 text-xs bg-muted/50 rounded px-2 py-1"
                >
                  <FileText className="w-3 h-3 text-muted-foreground" />
                  <span className="flex-1 truncate">{file.name}</span>
                  <span className="text-muted-foreground">({(file.size / 1024).toFixed(1)} KB)</span>
                  <button
                    onClick={() => handleRemoveFile(file.name)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active Sessions */}
        {hasActiveSessions && (
          <div className="border-b border-border px-3 py-2 max-h-32 overflow-y-auto relative z-10 backdrop-blur-sm" style={{ backgroundColor: 'rgba(var(--background-rgb), 0.8)' }}>
            <div className="text-xs font-medium text-muted-foreground mb-2">Active Sessions</div>
            <div className="space-y-1">
              {sandboxSessions
                .filter(s => s.status === 'running')
                .map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center gap-2 text-xs bg-muted/50 rounded px-2 py-1"
                  >
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="flex-1">{session.name}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleStopSandbox(session.id)}
                      className="h-5 px-1"
                    >
                      <Square className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Browser View */}
        <div className="flex-1 relative overflow-hidden" style={{ height: '100%', minHeight: 0 }}>
          {!isActive && (
            <div className="flex items-center justify-center h-full bg-background">
              <div className="text-center p-8">
                <Globe className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground text-sm">Click "Start Browser" to begin</p>
              </div>
            </div>
          )}
          <div className="absolute inset-0 w-full h-full">
            <style>{`
              #browser-webview {
                width: 100% !important;
                height: 100% !important;
              }
              #browser-webview iframe {
                height: 100% !important;
                flex: none !important;
              }
            `}</style>
            <webview
              id="browser-webview"
              key={activeTabId}
              ref={(el) => {
                webviewRef.current = el;
                if (el) {
                  el.addEventListener('dom-ready', () => {
                    // Update tab title when page loads
                    const title = el.getTitle();
                    if (title) {
                      updateTabTitle(activeTabId, title);
                    }
                    // Fix iframe height manually
                    setTimeout(() => {
                      const iframe = el.shadowRoot?.querySelector('iframe');
                      if (iframe) {
                        iframe.style.height = '100%';
                        iframe.style.flex = 'none';
                        iframe.style.position = 'absolute';
                        iframe.style.top = '0';
                        iframe.style.left = '0';
                      }
                    }, 100);
                  });
                  el.addEventListener('page-title-updated', (e: any) => {
                    if (e.title) {
                      updateTabTitle(activeTabId, e.title);
                    }
                  });
                }
              }}
              src={activeTab?.url || 'https://www.wikipedia.org'}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                backgroundColor: 'white',
                display: 'block'
              }}
              className="w-full h-full"
              useragent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0"
              partition="persist:browser-panel"
              // @ts-ignore - webview attributes
              allowpopups={true}
            />
          </div>
        </div>

        {/* Status Bar */}
        <div className="flex items-center justify-between px-3 py-1 border-t border-border text-xs text-muted-foreground relative z-10 backdrop-blur-sm" style={{ backgroundColor: 'rgba(var(--muted-rgb), 0.3)' }}>
          <span>{isActive ? 'Connected' : 'Disconnected'}</span>
          <span>{isActive ? activeTab?.url : 'Electron Browser'}</span>
        </div>
      </div>
    </>
  );
}
