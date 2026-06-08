/**
 * Shared Browser Panel - Using VSCode's <webview> approach
 * The <webview> tag is an HTML element that doesn't block UI interaction
 *
 * Refactored to use custom hooks and modular components
 */

import { useRef, useCallback, useEffect } from 'react';
import { useSandboxStore } from '@/stores/useSandboxStore';
import { browserService } from '@/services/BrowserService';
import { BrowserHeader } from './BrowserHeader';
import { BrowserStatusBar } from './BrowserStatusBar';
import { ResizeHandle } from './ResizeHandle';
import { useBrowserState } from '@/hooks/browser/useBrowserState';
import { usePanelResize } from '@/hooks/browser/usePanelResize';
import { useBrowserCommands } from '@/hooks/browser/useBrowserCommands';
import { useWebviewControl } from '@/hooks/browser/useWebviewControl';

export function SandboxPanel() {
  const webviewRef = useRef<HTMLWebViewElement | null>(null);

  // Store state
  const isOpen = useSandboxStore(state => state.isOpen);
  const togglePanel = useSandboxStore(state => state.togglePanel);

  // Custom hooks
  const {
    browserStatus,
    browserUrl,
    inputUrl,
    webviewSrc,
    setLatestSnapshot,
    setInputUrl,
    navigateTo,
    handleRefresh,
    handleBack,
    handleForward,
    handleUrlKeyDown
  } = useBrowserState(isOpen);

  const {
    panelWidth,
    isResizing,
    isFullscreen,
    toggleFullscreen,
    resizeHandlers
  } = usePanelResize(600);

  // Set up command polling when panel opens
  useBrowserCommands(isOpen, webviewRef, setLatestSnapshot);

  // Set up webview control
  useWebviewControl(isOpen, webviewRef, navigateTo);

  // Callback ref to set src when webview mounts
  const setWebviewRef = useCallback((node: HTMLWebViewElement | null) => {
    if (node) {
      webviewRef.current = node;
      node.src = webviewSrc;
    }
  }, [webviewSrc]);

  // Set webview src directly when webviewSrc state changes
  useEffect(() => {
    if (webviewRef.current && webviewSrc && webviewSrc !== 'about:blank') {
      webviewRef.current.src = webviewSrc;
    }
  }, [webviewSrc]);

  // Register webview with BrowserService when mounted
  useEffect(() => {
    if (webviewRef.current && isOpen) {
      browserService.registerWebview(webviewRef.current);
      browserService.activate();
    }
  }, [isOpen]);

  const handleClose = useCallback(() => togglePanel(), [togglePanel]);

  if (!isOpen) return null;

  return (
    <>
      {!isFullscreen && (
        <ResizeHandle
          panelWidth={panelWidth}
          isResizing={isResizing}
          onMouseDown={resizeHandlers.down}
        />
      )}

      <div
        className={`flex flex-col shadow-2xl transition-all duration-200 border-l border-border bg-background ${
          isFullscreen ? 'fixed inset-0 z-40' : 'fixed right-0 top-0 bottom-0 z-40'
        }`}
        style={{ width: isFullscreen ? '100%' : panelWidth }}
        role="complementary"
        aria-label="Browser Panel"
      >
        <BrowserHeader
          browserStatus={browserStatus}
          inputUrl={inputUrl}
          setInputUrl={setInputUrl}
          onUrlKeyDown={handleUrlKeyDown}
          onBack={handleBack}
          onForward={handleForward}
          onRefresh={handleRefresh}
          onToggleFullscreen={toggleFullscreen}
          onClose={handleClose}
        />

        {/* Browser Content Area */}
        <div className="flex-1 relative overflow-hidden bg-white">
          <webview
            ref={setWebviewRef}
            id="embedded-browser"
            style={{
              width: '100%',
              height: '100%',
              border: 'none'
            }}
            allowpopups={true}
            nodeintegration={false}
            plugins={true}
          />
        </div>

        <BrowserStatusBar
          browserStatus={browserStatus}
          browserUrl={browserUrl}
        />
      </div>
    </>
  );
}
