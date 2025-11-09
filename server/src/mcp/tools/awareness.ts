/**
 * MCP tools for awareness management
 */

import { YjsDocManager } from '../../yjs/doc.js';
import { AuthValidator } from '../../core/auth.js';
import { AwarenessState } from '../../types.js';

export interface SetLocalStateArgs {
  agent_id: string;
  session_id: string;
  state: AwarenessState;
}

export interface SetLocalStateResult {
  ok: boolean;
  error?: string;
}

export class AwarenessTools {
  constructor(
    private yjsDoc: YjsDocManager,
    private auth: AuthValidator
  ) {}

  /**
   * Set local awareness state for an agent
   */
  async setLocalState(args: SetLocalStateArgs): Promise<SetLocalStateResult> {
    // Validate session
    if (!this.auth.validateSession(args.agent_id, args.session_id)) {
      return {
        ok: false,
        error: 'Invalid agent_id or session_id. Session not registered.',
      };
    }

    // Validate state
    if (!this.validateAwarenessState(args.state)) {
      return {
        ok: false,
        error: 'Invalid awareness state format.',
      };
    }

    // Ensure state matches the agent_id and session_id
    if (args.state.agent_id !== args.agent_id || args.state.session_id !== args.session_id) {
      return {
        ok: false,
        error: 'State agent_id/session_id must match the request parameters.',
      };
    }

    // Set timestamp if not provided
    if (!args.state.ts) {
      args.state.ts = new Date().toISOString();
    }

    // Use a deterministic client ID based on agent_id and session_id
    const clientId = this.getClientId(args.agent_id, args.session_id);

    // Set the awareness state
    this.yjsDoc.setAwarenessState(clientId, args.state);

    return { ok: true };
  }

  /**
   * Validate awareness state structure
   */
  private validateAwarenessState(state: AwarenessState): boolean {
    if (!state.agent_id || !state.session_id) {
      return false;
    }

    if (!['planning', 'editing', 'testing', 'idle'].includes(state.activity)) {
      return false;
    }

    // Validate selection if present
    if (state.selection) {
      const hasRange = 'startLine' in state.selection && 'endLine' in state.selection;
      const hasSymbol = 'symbol' in state.selection;

      if (!hasRange && !hasSymbol) {
        return false;
      }

      if (hasRange) {
        const range = state.selection as { startLine: number; endLine: number };
        if (typeof range.startLine !== 'number' || typeof range.endLine !== 'number') {
          return false;
        }
        if (range.startLine < 0 || range.endLine < range.startLine) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Generate a deterministic client ID from agent_id and session_id
   */
  private getClientId(agent_id: string, session_id: string): number {
    const str = `${agent_id}:${session_id}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Get all current awareness states
   */
  getAwarenessStates(): Record<string, AwarenessState> {
    const states: Record<string, AwarenessState> = {};
    this.yjsDoc.getAwarenessStates().forEach((state, clientId) => {
      states[clientId.toString()] = state;
    });
    return states;
  }
}
