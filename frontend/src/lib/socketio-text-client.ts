/**
 * Socket.IO Text Client
 *
 * Manages a Socket.IO connection to the `/text` namespace on the ECS socket
 * server for real-time chat streaming and debrief generation. Mirrors the
 * SocketIOAudioClient pattern: config-based initialization, state machine
 * with callbacks, and bound listeners for clean teardown.
 *
 * Replaces the AppSync subscription path (`subscribeToTextStream`) for text
 * generation events.
 */

import { io, type Socket } from 'socket.io-client';
import { fetchDebrief } from '@/services/studentService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TextSessionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error';

export interface SocketIOTextClientConfig {
  socketUrl: string;
  token: string;
  onStateChange: (state: TextSessionState) => void;
  onError: (error: Error) => void;
}

export interface SendMessageParams {
  session_id: string;
  simulation_group_id: string;
  patient_id: string;
  message: string;
}

export interface SendMessageCallbacks {
  onChunk: (text: string) => void;
  onDone: (fullText: string) => void;
  onError: (error: Error) => void;
  onSessionComplete?: () => void;
}

export interface RequestDebriefParams {
  session_id: string;
  simulation_group_id: string;
  patient_id: string;
}

export interface RequestDebriefCallbacks {
  onProgress: (stage: string) => void;
  onComplete: (data: unknown) => void;
  onError: (error: Error) => void;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class SocketIOTextClient {
  private config: SocketIOTextClientConfig;
  private socket: Socket | null = null;
  private state: TextSessionState = 'idle';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(config: SocketIOTextClientConfig) {
    this.config = config;
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Connect to the `/text` namespace with Cognito JWT auth.
   * Transitions: idle → connecting → connected (or error after retries).
   */
  connect(): void {
    if (this.state !== 'idle' && this.state !== 'error' && this.state !== 'disconnected') {
      return;
    }

    this.setState('connecting');
    this.reconnectAttempts = 0;
    this.createSocket();
  }

  /**
   * Disconnect and clean up. Resets state to idle.
   */
  disconnect(): void {
    this.clearReconnectTimer();
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.setState('idle');
  }

  /**
   * Send a chat message and receive streamed response chunks.
   *
   * Emits `send-message` and registers listeners for `text-chunk`,
   * `text-complete`, `text-error`, and `session-complete` scoped to the
   * given session_id. Listeners are cleaned up on completion or error.
   */
  sendMessage(params: SendMessageParams, callbacks: SendMessageCallbacks): void {
    if (!this.socket || this.state !== 'connected') {
      callbacks.onError(new Error('Not connected to text server'));
      return;
    }

    const { session_id } = params;
    let completed = false;

    const cleanup = () => {
      if (!this.socket) return;
      this.socket.off('text-chunk', onChunk);
      this.socket.off('text-complete', onComplete);
      this.socket.off('text-error', onError);
      this.socket.off('session-complete', onSessionComplete);
    };

    const onChunk = (data: { session_id: string; content: string }) => {
      if (data.session_id !== session_id || completed) return;
      callbacks.onChunk(data.content);
    };

    const onComplete = (data: { session_id: string; content: string }) => {
      if (data.session_id !== session_id || completed) return;
      completed = true;
      cleanup();
      callbacks.onDone(data.content);
    };

    const onError = (data: { session_id: string; message: string }) => {
      if (data.session_id !== session_id || completed) return;
      completed = true;
      cleanup();
      callbacks.onError(new Error(data.message));
    };

    const onSessionComplete = (data: { session_id: string }) => {
      if (data.session_id !== session_id) return;
      callbacks.onSessionComplete?.();
    };

    this.socket.on('text-chunk', onChunk);
    this.socket.on('text-complete', onComplete);
    this.socket.on('text-error', onError);
    this.socket.on('session-complete', onSessionComplete);

    this.socket.emit('send-message', params);
  }

  /**
   * Request debrief generation and receive progress updates + final result.
   *
   * Emits `request-debrief` and registers listeners for `debrief-progress`,
   * `debrief-complete`, and `debrief-error`. Falls back to REST polling via
   * `fetchDebrief()` if the connection drops mid-generation.
   */
  requestDebrief(params: RequestDebriefParams, callbacks: RequestDebriefCallbacks): void {
    if (!this.socket || this.state !== 'connected') {
      // Connection not available — fall back to REST polling immediately
      this.fallbackToRestDebrief(params.session_id, callbacks);
      return;
    }

    const { session_id } = params;
    let completed = false;

    const cleanup = () => {
      if (!this.socket) return;
      this.socket.off('debrief-progress', onProgress);
      this.socket.off('debrief-complete', onComplete);
      this.socket.off('debrief-error', onError);
      this.socket.off('disconnect', onDisconnect);
    };

    const onProgress = (data: { session_id: string; stage: string }) => {
      if (data.session_id !== session_id || completed) return;
      callbacks.onProgress(data.stage);
    };

    const onComplete = (data: { session_id: string; data: unknown }) => {
      if (data.session_id !== session_id || completed) return;
      completed = true;
      cleanup();
      callbacks.onComplete(data.data);
    };

    const onError = (data: { session_id: string; message: string }) => {
      if (data.session_id !== session_id || completed) return;
      completed = true;
      cleanup();
      callbacks.onError(new Error(data.message));
    };

    const onDisconnect = () => {
      if (completed) return;
      completed = true;
      cleanup();
      // Connection dropped mid-debrief — fall back to REST polling
      this.fallbackToRestDebrief(session_id, callbacks);
    };

    this.socket.on('debrief-progress', onProgress);
    this.socket.on('debrief-complete', onComplete);
    this.socket.on('debrief-error', onError);
    this.socket.on('disconnect', onDisconnect);

    this.socket.emit('request-debrief', params);
  }

  /**
   * Returns the current connection state.
   */
  getState(): TextSessionState {
    return this.state;
  }

  // -----------------------------------------------------------------------
  // Private — socket lifecycle
  // -----------------------------------------------------------------------

  private createSocket(): void {
    const { socketUrl, token } = this.config;

    this.socket = io(`${socketUrl}/text`, {
      transports: ['websocket'],
      auth: { token },
      reconnection: false, // we handle reconnection ourselves
    });

    this.socket.on('connect', () => {
      this.reconnectAttempts = 0;
      this.setState('connected');
    });

    this.socket.on('disconnect', (reason: string) => {
      // If we explicitly disconnected, don't attempt reconnection
      if (this.state === 'idle') return;

      this.setState('disconnected');

      // Only auto-reconnect for transport-level disconnects
      if (reason !== 'io client disconnect') {
        this.attemptReconnect();
      }
    });

    this.socket.on('connect_error', (err: Error) => {
      console.warn('[SocketIOTextClient] connect_error:', err.message);

      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.setState('disconnected');
        this.attemptReconnect();
      } else {
        this.setState('error');
        this.config.onError(
          new Error(`Failed to connect after ${this.maxReconnectAttempts} attempts: ${err.message}`),
        );
      }
    });
  }

  // -----------------------------------------------------------------------
  // Private — reconnection with exponential backoff
  // -----------------------------------------------------------------------

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.setState('error');
      this.config.onError(
        new Error(`Connection lost after ${this.maxReconnectAttempts} reconnection attempts`),
      );
      return;
    }

    this.reconnectAttempts++;

    // Exponential backoff: 1s, 2s, 4s (capped at 8s)
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 8000);

    this.clearReconnectTimer();
    this.reconnectTimer = setTimeout(() => {
      if (this.state === 'idle') return; // user disconnected while waiting
      this.setState('connecting');

      // Tear down old socket and create a fresh one
      if (this.socket) {
        this.socket.removeAllListeners();
        this.socket.disconnect();
        this.socket = null;
      }
      this.createSocket();
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  // -----------------------------------------------------------------------
  // Private — REST fallback for debrief
  // -----------------------------------------------------------------------

  private async fallbackToRestDebrief(
    sessionId: string,
    callbacks: RequestDebriefCallbacks,
  ): Promise<void> {
    callbacks.onProgress('Reconnecting — checking debrief status…');
    try {
      const result = await fetchDebrief(sessionId);
      if (result) {
        callbacks.onComplete(result);
      } else {
        callbacks.onError(new Error('Debrief not available. Please try again.'));
      }
    } catch (err) {
      callbacks.onError(
        err instanceof Error ? err : new Error('Failed to fetch debrief via REST fallback'),
      );
    }
  }

  // -----------------------------------------------------------------------
  // Private — state management
  // -----------------------------------------------------------------------

  private setState(next: TextSessionState): void {
    if (this.state === next) return;
    this.state = next;
    this.config.onStateChange(next);
  }
}
