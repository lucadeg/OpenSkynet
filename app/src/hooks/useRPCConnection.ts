import { useEffect } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { getRPCClient } from '@/services/rpcClient';

export function useRPCConnection() {
  const rpcUrl = useAppStore((state) => state.rpcUrl);
  const autoConnect = useAppStore((state) => state.autoConnect);
  const setConnected = useAppStore((state) => state.setConnected);

  useEffect(() => {
    if (!autoConnect) {
      return;
    }

    const connect = async () => {
      try {
        const client = getRPCClient(rpcUrl);

        // Set up connection state callback
        client.setOnConnectionChange((connected) => {
          setConnected(connected);
        });

        await client.connect();
        console.log('[RPC] Connection initiated');
      } catch (error) {
        console.error('[RPC] Connection failed:', error);
        setConnected(false);
      }
    };

    connect();
  }, [rpcUrl, autoConnect, setConnected]);
}
