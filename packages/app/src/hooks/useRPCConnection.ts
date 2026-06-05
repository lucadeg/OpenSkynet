import { useEffect, useRef } from 'react';
import { useAppStore } from '@/stores/useAppStore';

export function useRPCConnection() {
  const apiBaseUrl = useAppStore((state) => state.apiBaseUrl);
  const autoConnect = useAppStore((state) => state.autoConnect);
  const setAgentStatus = useAppStore((state) => state.setAgentStatus);
  const checked = useRef(false);

  useEffect(() => {
    if (!autoConnect || checked.current || !apiBaseUrl) return;
    checked.current = true;

    const check = async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/api/health`, { signal: AbortSignal.timeout(5000) });
        if (res.ok) {
          setAgentStatus({ rpcConnected: true });
        } else {
          setAgentStatus({ rpcConnected: false });
        }
      } catch {
        setAgentStatus({ rpcConnected: false });
      }
    };

    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, [apiBaseUrl, autoConnect, setAgentStatus]);
}
