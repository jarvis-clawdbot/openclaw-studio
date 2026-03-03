/**
 * Hook to forward gateway events to backend for analytics/topology/self-healing.
 * 
 * Architecture:
 *   GatewayClient.onEvent() -> POST /api/gateway-events -> Backend EventBridge
 */

import { useCallback, useEffect, useRef } from "react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

type EventFrame = {
  type: "event";
  event: string;
  payload?: unknown;
  seq?: number;
};

type EventBridgeOptions = {
  enabled?: boolean;
  /** Debounce events in milliseconds (default: 100ms) */
  debounceMs?: number;
  /** Events to skip (default: heartbeat only) */
  skipEvents?: string[];
};

/**
 * Forward gateway events to backend.
 * 
 * Usage in HomeClient.tsx:
 *   const bridge = useEventBridge({ enabled: true });
 *   client.onEvent((event) => {
 *     bridge.forward(event);
 *   });
 */
export function useEventBridge(options: EventBridgeOptions = {}) {
  const {
    enabled = true,
    debounceMs = 100,
    skipEvents = ["heartbeat"],
  } = options;

  const pendingRef = useRef<EventFrame[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const statsRef = useRef({ sent: 0, skipped: 0, errors: 0 });

  const flush = useCallback(async () => {
    if (pendingRef.current.length === 0) return;

    const events = [...pendingRef.current];
    pendingRef.current = [];

    try {
      const response = await fetch(`${BACKEND_URL}/api/gateway-events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events }),
      });

      if (!response.ok) {
        console.warn("[EventBridge] Failed to send events:", response.status);
        statsRef.current.errors++;
      } else {
        statsRef.current.sent += events.length;
      }
    } catch (error) {
      console.error("[EventBridge] Error sending events:", error);
      statsRef.current.errors++;
    }
  }, []);

  const forward = useCallback(
    (event: EventFrame) => {
      if (!enabled) return;
      if (skipEvents.includes(event.event)) {
        statsRef.current.skipped++;
        return;
      }

      pendingRef.current.push(event);

      // Debounce: wait for more events before sending
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(flush, debounceMs);
    },
    [enabled, skipEvents, debounceMs, flush]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      // Flush remaining events
      if (pendingRef.current.length > 0) {
        fetch(`${BACKEND_URL}/api/gateway-events`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ events: pendingRef.current }),
        }).catch(() => {});
      }
    };
  }, []);

  const getStats = useCallback(() => ({ ...statsRef.current }), []);

  return { forward, getStats };
}

export default useEventBridge;
