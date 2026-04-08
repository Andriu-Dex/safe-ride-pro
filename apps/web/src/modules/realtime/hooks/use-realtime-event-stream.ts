'use client';

import { useEffect, useRef, useState } from 'react';
import type { RealtimeEvent } from '@saferidepro/shared-types';

import { API_BASE_URL } from '../../../lib/api-client';

export type RealtimeConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

type UseRealtimeEventStreamOptions = {
  accessToken?: string;
  enabled: boolean;
  onEvent: (event: RealtimeEvent) => void;
};

function getReconnectDelay(attempt: number): number {
  return Math.min(1_000 * 2 ** attempt, 10_000);
}

export function useRealtimeEventStream({
  accessToken,
  enabled,
  onEvent,
}: UseRealtimeEventStreamOptions): RealtimeConnectionStatus {
  const [status, setStatus] = useState<RealtimeConnectionStatus>('idle');
  const onEventRef = useRef(onEvent);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!enabled || !accessToken) {
      setStatus('idle');
      return undefined;
    }

    const abortController = new AbortController();
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let isCancelled = false;

    const scheduleReconnect = (attempt: number) => {
      if (isCancelled || abortController.signal.aborted) {
        return;
      }

      reconnectTimer = setTimeout(() => {
        void connect(attempt);
      }, getReconnectDelay(attempt));
    };

    const processChunk = (chunk: string, bufferState: { buffer: string }) => {
      bufferState.buffer += chunk.replace(/\r\n/g, '\n');

      while (bufferState.buffer.includes('\n\n')) {
        const separatorIndex = bufferState.buffer.indexOf('\n\n');
        const rawEventBlock = bufferState.buffer.slice(0, separatorIndex);
        bufferState.buffer = bufferState.buffer.slice(separatorIndex + 2);

        const lines = rawEventBlock.split('\n');
        let eventName = 'message';
        const dataLines: string[] = [];

        for (const line of lines) {
          if (!line || line.startsWith(':')) {
            continue;
          }

          if (line.startsWith('event:')) {
            eventName = line.slice('event:'.length).trim();
            continue;
          }

          if (line.startsWith('data:')) {
            dataLines.push(line.slice('data:'.length).trim());
          }
        }

        if (!dataLines.length) {
          continue;
        }

        try {
          const parsedEvent = JSON.parse(dataLines.join('\n')) as RealtimeEvent;

          if (parsedEvent.type === eventName || eventName === 'message') {
            onEventRef.current(parsedEvent);
          }
        } catch {
          // Ignore malformed frames and keep the stream alive.
        }
      }
    };

    const connect = async (attempt: number) => {
      setStatus(attempt === 0 ? 'connecting' : 'reconnecting');

      try {
        const response = await fetch(`${API_BASE_URL}/realtime/stream`, {
          method: 'GET',
          headers: {
            Accept: 'text/event-stream',
            Authorization: `Bearer ${accessToken}`,
          },
          cache: 'no-store',
          signal: abortController.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(`Stream request failed with status ${response.status}.`);
        }

        setStatus('connected');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        const bufferState = { buffer: '' };

        while (!abortController.signal.aborted) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          if (!value) {
            continue;
          }

          processChunk(decoder.decode(value, { stream: true }), bufferState);
        }

        if (!abortController.signal.aborted) {
          setStatus('reconnecting');
          scheduleReconnect(attempt + 1);
        }
      } catch {
        if (abortController.signal.aborted || isCancelled) {
          return;
        }

        setStatus('error');
        scheduleReconnect(attempt + 1);
      }
    };

    void connect(0);

    return () => {
      isCancelled = true;
      abortController.abort();

      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
    };
  }, [accessToken, enabled]);

  return status;
}
