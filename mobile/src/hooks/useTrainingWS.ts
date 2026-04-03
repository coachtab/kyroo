import { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { API_BASE } from '../lib/api';

const WS_URL = API_BASE.replace('https://', 'wss://').replace('http://', 'ws://') + '/ws';

const MIN_DELAY = 1_000;
const MAX_DELAY = 30_000;

/**
 * Maintains a resilient WebSocket connection to the training-presence endpoint.
 * - Reconnects automatically with exponential backoff on drop
 * - Reconnects immediately when the app returns to foreground
 * - Sends a JSON ping every 25s to keep the connection alive through proxies
 * - Only active when `enabled` is true (i.e. isPremium)
 */
export function useTrainingWS(enabled: boolean) {
  const [count, setCount]         = useState(0);
  const [connected, setConnected] = useState(false);

  const wsRef        = useRef<WebSocket | null>(null);
  const retryTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingTimer    = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryDelay   = useRef(MIN_DELAY);
  const closing      = useRef(false); // true when we deliberately close
  const enabledRef   = useRef(enabled);

  useEffect(() => { enabledRef.current = enabled; }, [enabled]);

  function clearTimers() {
    if (retryTimer.current) { clearTimeout(retryTimer.current);   retryTimer.current = null; }
    if (pingTimer.current)  { clearInterval(pingTimer.current);   pingTimer.current  = null; }
  }

  function connect() {
    if (!enabledRef.current) return;
    // Already open or connecting — skip
    const state = wsRef.current?.readyState;
    if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) return;

    closing.current = false;
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      retryDelay.current = MIN_DELAY;

      // Keep-alive: send a ping every 25s so nginx / mobile NAT don't kill the socket
      pingTimer.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 25_000);
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'training-update') setCount(msg.data.count ?? 0);
      } catch {}
    };

    ws.onclose = () => {
      setConnected(false);
      clearTimers();
      if (!closing.current && enabledRef.current) {
        // Exponential backoff, capped at 30s
        retryTimer.current = setTimeout(() => {
          retryDelay.current = Math.min(retryDelay.current * 2, MAX_DELAY);
          connect();
        }, retryDelay.current);
      }
    };

    ws.onerror = () => {
      // onerror always fires before onclose — just let onclose handle the retry
      ws.close();
    };
  }

  function disconnect() {
    closing.current = true;
    clearTimers();
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnected(false);
  }

  useEffect(() => {
    if (!enabled) {
      disconnect();
      return;
    }

    connect();

    const onAppStateChange = (next: AppStateStatus) => {
      if (next === 'active') {
        // App foregrounded — reconnect immediately if socket is dead
        const s = wsRef.current?.readyState;
        if (s === undefined || s === WebSocket.CLOSED || s === WebSocket.CLOSING) {
          clearTimers();
          retryDelay.current = MIN_DELAY;
          connect();
        }
      } else {
        // App backgrounded — release the socket to save battery/data
        // Training presence heartbeat (HTTP) keeps the session alive separately
        disconnect();
      }
    };

    const sub = AppState.addEventListener('change', onAppStateChange);

    return () => {
      sub.remove();
      disconnect();
    };
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  return { count, connected };
}
