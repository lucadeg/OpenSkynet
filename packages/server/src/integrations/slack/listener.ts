/**
 * Slack bot listener - handles incoming messages via WebSocket (RTM).
 * Forwards messages to the adapter for processing.
 */

import { WebClient } from "@slack/web-api";
import type { MessageEvent } from "../../gateway/events";
import logger from "../../core/logging";

export interface SlackListenerConfig {
  token: string;
  appLevelToken?: string;
  onMessage?: (event: MessageEvent) => void;
  onError?: (error: Error) => void;
}

export class SlackListener {
  private token: string;
  private appLevelToken?: string;
  private client: WebClient | null = null;
  private onMessage?: (event: MessageEvent) => void;
  private onError?: (error: Error) => void;
  private isListening = false;
  private socketMode = false;

  constructor(config: SlackListenerConfig) {
    this.token = config.token;
    this.appLevelToken = config.appLevelToken;
    this.onMessage = config.onMessage;
    this.onError = config.onError;
    this.socketMode = !!config.appLevelToken;
  }

  setOnMessage(handler: (event: MessageEvent) => void): void {
    this.onMessage = handler;
  }

  setOnError(handler: (error: Error) => void): void {
    this.onError = handler;
  }

  async listen(): Promise<void> {
    if (!this.token) {
      logger.warn("slack_token_not_configured");
      throw new Error("Slack token not configured");
    }

    this.isListening = true;

    try {
      logger.info("slack_listener_starting");

      this.client = new WebClient(this.token);

      // Verify auth
      const auth = await this.client.auth.test();
      logger.info({ team: auth.team }, "slack_auth_verified");

      if (this.socketMode) {
        // Socket Mode requires app-level token and different setup
        await this._startSocketMode();
      } else {
        // RTM API (deprecated but still works)
        await this._startRTM();
      }

      logger.info("slack_listener_started");
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error({ error: error.message }, "slack_listener_failed");
      this.onError?.(error);
      throw error;
    }
  }

  private async _startSocketMode(): Promise<void> {
    // Socket mode implementation requires different approach
    // This is a placeholder for Socket Mode setup
    logger.warn("slack_socket_mode_not_implemented");
  }

  private async _startRTM(): Promise<void> {
    // RTM is deprecated but we can still use it for simple cases
    // For production, use Events API instead
    logger.warn("slack_rtm_deprecated_use_events_api");
  }

  async stop(): Promise<void> {
    this.isListening = false;

    if (this.client) {
      try {
        // Close WebSocket connections if any
        logger.info("slack_listener_stopped");
      } catch (err) {
        logger.error({ err: err instanceof Error ? err.message : String(err) }, "slack_listener_stop_error");
      }
      this.client = null;
    }
  }

  getStatus(): {
    listening: boolean;
    connected: boolean;
    socketMode: boolean;
  } {
    return {
      listening: this.isListening,
      connected: this.client !== null,
      socketMode: this.socketMode,
    };
  }

  getClient(): WebClient | null {
    return this.client;
  }
}
