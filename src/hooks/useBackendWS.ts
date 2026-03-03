"use client";

import { useEffect, useRef, useCallback } from "react";

type WSMessage = {
  type: string;
  payload: unknown;
};

type UseBackendWSOptions = {
  onMessage?: (msg: WSMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  reconnectMs?: number;
  enabled?: boolean;
};

export function useBackendWS({
  onMessage,
  onConnect,
  onDisconnect,
  reconnectMs = 3000,
  enabled = true,
}: UseBackendWSOptions = {}) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!enabled || !mountedRef.current) return;
    try {
      const ws = new WebSocket("ws://localhost:8000/ws");
      wsRef.current = ws;

      ws.onopen = () => { if (mountedRef.current) onConnect?.(); };
      ws.onmessage = (e) => {
        if (!mountedRef.current) return;
        try { onMessage?.(JSON.parse(e.data) as WSMessage); } catch { /* ignore */ }
      };
      ws.onclose = () => {
        if (!mountedRef.current) return;
        onDisconnect?.();
        reconnectTimer.current = setTimeout(connect, reconnectMs);
      };
      ws.onerror = () => ws.close();
    } catch {
      reconnectTimer.current = setTimeout(connect, reconnectMs);
    }
  }, [enabled, onConnect, onDisconnect, onMessage, reconnectMs]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      wsRef.current?.close();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [connect]);

  const send = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  return { send };
}
