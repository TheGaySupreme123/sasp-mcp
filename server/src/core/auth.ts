/**
 * Authentication and authorization for agent sessions
 */

import { ServerConfig } from '../config.js';

export class AuthValidator {
  private validTokens: Set<string>;
  private activeSessions: Map<string, { agent_id: string; session_id: string; created_at: Date }>;

  constructor(private config: ServerConfig) {
    this.validTokens = new Set([config.token]);
    this.activeSessions = new Map();
  }

  /**
   * Validate a bearer token
   */
  validateToken(token: string): boolean {
    return this.validTokens.has(token);
  }

  /**
   * Register a new session
   */
  registerSession(agent_id: string, session_id: string, token: string): boolean {
    if (!this.validateToken(token)) {
      return false;
    }

    const key = `${agent_id}:${session_id}`;
    if (!this.activeSessions.has(key)) {
      this.activeSessions.set(key, {
        agent_id,
        session_id,
        created_at: new Date(),
      });
    }

    return true;
  }

  /**
   * Validate that a session is registered
   */
  validateSession(agent_id: string, session_id: string): boolean {
    const key = `${agent_id}:${session_id}`;
    return this.activeSessions.has(key);
  }

  /**
   * Remove a session
   */
  unregisterSession(agent_id: string, session_id: string): void {
    const key = `${agent_id}:${session_id}`;
    this.activeSessions.delete(key);
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): Array<{ agent_id: string; session_id: string; created_at: Date }> {
    return Array.from(this.activeSessions.values());
  }

  /**
   * Add a new valid token
   */
  addToken(token: string): void {
    this.validTokens.add(token);
  }
}
