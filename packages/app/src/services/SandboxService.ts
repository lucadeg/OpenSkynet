import type {
  SandboxSession,
  SandboxStatus,
  InputEvent,
  StreamCallback,
} from '@/types/sandbox';
import type { SandboxType } from '@/stores/useSandboxStore';
import { apiPost, apiGet, apiStream } from './apiClient';

export interface SandboxService {
  start: (type: SandboxType) => Promise<SandboxSession>;
  stop: () => Promise<void>;
  getStatus: () => Promise<SandboxStatus>;
  sendInput: (event: InputEvent) => Promise<void>;
  setControlMode: (mode: 'agent' | 'user' | 'shared') => Promise<void>;
  testBrowser: () => Promise<any>;
  subscribeToStream: (callbacks: StreamCallback) => () => void;
  unsubscribe: () => void;
}

export class HttpSandboxService implements SandboxService {
  private unsubscribeFn: (() => void) | null = null;

  async start(type: 'browser' | 'computer'): Promise<SandboxSession> {
    try {
      const result = await apiPost<{ session: SandboxSession; error?: string }>('/api/sandbox/start', { type });

      if (result.error) {
        throw new Error(result.error);
      }

      if (!result.session) {
        throw new Error('Failed to start sandbox session');
      }

      return result.session;
    } catch (error) {
      console.error('Failed to start sandbox:', error);
      if (error instanceof Error) {
        if (error.message.includes('timeout')) {
          throw new Error('Browser startup timed out. This may happen on first launch. Please try again.');
        }
        if (error.message.includes('Not connected') || error.message.includes('Failed to fetch')) {
          throw new Error('Backend server not running. Please start the Python backend.');
        }
        if (error.message.includes('Computer sandbox not yet implemented')) {
          throw new Error('Computer sandbox is not yet implemented. Please use Browser sandbox for now.');
        }
        throw error;
      }
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      await apiPost('/api/sandbox/stop');
      this.unsubscribe();
    } catch (error) {
      console.error('Failed to stop sandbox:', error);
      throw error;
    }
  }

  async getStatus(): Promise<SandboxStatus> {
    try {
      return await apiGet<SandboxStatus>('/api/sandbox/status');
    } catch (error) {
      console.error('Failed to get sandbox status:', error);
      throw error;
    }
  }

  async sendInput(event: InputEvent): Promise<void> {
    try {
      await apiPost('/api/sandbox/control', { event });
    } catch (error) {
      console.error('Failed to send input:', error);
      throw error;
    }
  }

  async setControlMode(mode: 'agent' | 'user' | 'shared'): Promise<void> {
    try {
      await apiPost('/api/sandbox/set-mode', { mode });
    } catch (error) {
      console.error('Failed to set control mode:', error);
      throw error;
    }
  }

  async testBrowser(): Promise<any> {
    try {
      return await apiPost('/api/sandbox/test-browser');
    } catch (error) {
      console.error('Failed to test browser:', error);
      throw error;
    }
  }

  subscribeToStream(callbacks: StreamCallback): () => void {
    this.unsubscribeFn = apiStream(
      '/api/sandbox/stream',
      {},
      (type, data) => {
        switch (type) {
          case 'screenshot':
            callbacks.onScreenshot?.(data);
            break;
          case 'status':
            callbacks.onStatusChange?.(data.status);
            break;
          case 'error':
            callbacks.onError?.(data.error || data);
            break;
        }
      },
      undefined,
      (err) => {
        callbacks.onError?.(err.message);
        callbacks.onStatusChange?.('error');
      }
    );

    return this.unsubscribeFn;
  }

  unsubscribe(): void {
    if (this.unsubscribeFn) {
      this.unsubscribeFn();
      this.unsubscribeFn = null;
    }
  }
}

export function createSandboxService(): SandboxService {
  return new HttpSandboxService();
}

if (typeof window !== 'undefined') {
  (window as any).sandboxDiagnostics = async () => {
    try {
      const service = createSandboxService();

      console.log('=== Sandbox Diagnostics ===');

      console.log('Testing browser startup...');
      const result = await service.testBrowser();
      console.log('Browser Test Result:', result);

      return result;
    } catch (error) {
      console.error('Diagnostic failed:', error);
      throw error;
    }
  };

  (window as any).testScreenshot = async () => {
    try {
      console.log('Testing screenshot...');
      const result = await apiPost<{ screenshot: string | null; error?: string }>('/api/sandbox/stream');
      console.log('Screenshot result:', result);
      console.log('Has screenshot:', !!result.screenshot);
      console.log('Screenshot length:', result.screenshot?.length);
      console.log('Error:', result.error);
      return result;
    } catch (error) {
      console.error('Test screenshot failed:', error);
      throw error;
    }
  };

  (window as any).testStart = async () => {
    try {
      console.log('Testing sandbox.start...');
      const result = await apiPost('/api/sandbox/start', { type: 'browser' });
      console.log('Start result:', result);
      return result;
    } catch (error) {
      console.error('Test start failed:', error);
      throw error;
    }
  };

  (window as any).checkStore = () => {
    const store = require('@/stores/useSandboxStore').useSandboxStore.getState();
    console.log('Sandbox Store State:', {
      isActive: store.isActive,
      isStarting: store.isStarting,
      lastScreenshot: store.lastScreenshot?.substring(0, 100),
      screenshotLength: store.lastScreenshot?.length,
      isStreaming: store.isStreaming,
      connectionStatus: store.connectionStatus,
      error: store.error
    });
    return store;
  };

  (window as any).downloadScreenshot = () => {
    const store = require('@/stores/useSandboxStore').useSandboxStore.getState();
    if (store.lastScreenshot) {
      const link = document.createElement('a');
      link.href = `data:image/png;base64,${store.lastScreenshot}`;
      link.download = 'browser-screenshot.png';
      link.click();
      console.log('Screenshot downloaded from store!');
    } else {
      console.log('No screenshot in store');
    }
  };
}
