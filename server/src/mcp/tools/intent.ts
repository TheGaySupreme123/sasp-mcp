/**
 * MCP tools for intent management (start, update, end)
 */

import { v4 as uuidv4 } from 'uuid';
import { YjsDocManager } from '../../yjs/doc.js';
import { AuthValidator } from '../../core/auth.js';
import { OverlapDetector } from '../../core/overlap.js';
import { TTLManager } from '../../core/ttl.js';
import { IntentRecord } from '../../types.js';

export interface StartIntentArgs {
  agent_id: string;
  session_id: string;
  file: string;
  scope: {
    range?: { startLine: number; endLine: number };
    symbol?: string;
  };
  reason: string;
  planned_delta_hash: string;
  ttl_ms?: number;
}

export interface StartIntentResult {
  ok: boolean;
  lease_id?: string;
  error?: string;
  conflict?: {
    conflicting_lease_id: string;
    reason: string;
  };
}

export interface UpdateIntentArgs {
  agent_id: string;
  session_id: string;
  lease_id: string;
  fields: {
    scope?: {
      range?: { startLine: number; endLine: number };
      symbol?: string;
    };
    reason?: string;
    planned_delta_hash?: string;
    ttl_ms?: number;
  };
}

export interface UpdateIntentResult {
  ok: boolean;
  error?: string;
}

export interface EndIntentArgs {
  agent_id: string;
  session_id: string;
  lease_id: string;
  status?: 'ended' | 'expired';
}

export interface EndIntentResult {
  ok: boolean;
  error?: string;
}

export class IntentTools {
  private eventEmitter: ((event: string, data: any) => void) | null = null;

  constructor(
    private yjsDoc: YjsDocManager,
    private auth: AuthValidator,
    private overlapDetector: OverlapDetector,
    private ttlManager: TTLManager
  ) {
    // Set up TTL expiration handler
    this.ttlManager.onExpiration((lease_id, intent) => {
      this.handleExpiration(lease_id, intent);
    });
  }

  /**
   * Set event emitter for broadcasting intent events
   */
  setEventEmitter(emitter: (event: string, data: any) => void): void {
    this.eventEmitter = emitter;
  }

  /**
   * Start a new intent
   */
  async startIntent(args: StartIntentArgs): Promise<StartIntentResult> {
    // Validate session
    if (!this.auth.validateSession(args.agent_id, args.session_id)) {
      return {
        ok: false,
        error: 'Invalid agent_id or session_id. Session not registered.',
      };
    }

    // Validate scope
    if (!args.scope.range && !args.scope.symbol) {
      return {
        ok: false,
        error: 'Scope must have either range or symbol.',
      };
    }

    // Check for overlaps
    const overlapInfo = this.overlapDetector.detectOverlap(
      {
        agent_id: args.agent_id,
        file: args.file,
        scope: args.scope,
      },
      this.yjsDoc.getActiveIntents()
    );

    if (overlapInfo.overlaps) {
      return {
        ok: false,
        error: 'Intent overlaps with existing active intent.',
        conflict: {
          conflicting_lease_id: overlapInfo.conflicting_lease_id!,
          reason: overlapInfo.reason!,
        },
      };
    }

    // Create the intent
    const lease_id = uuidv4();
    const ttl_ms = args.ttl_ms || 300000; // Default 5 minutes

    const intent: IntentRecord = {
      lease_id,
      agent_id: args.agent_id,
      file: args.file,
      scope: args.scope,
      reason: args.reason,
      planned_delta_hash: args.planned_delta_hash,
      started_at: new Date().toISOString(),
      ttl_ms,
      status: 'active',
    };

    // Store in Yjs
    this.yjsDoc.setIntent(lease_id, intent);

    // Start TTL timer
    this.ttlManager.startTimer(lease_id, intent);

    // Emit event
    this.emitEvent('intent.started', { lease_id, intent });

    return { ok: true, lease_id };
  }

  /**
   * Update an existing intent
   */
  async updateIntent(args: UpdateIntentArgs): Promise<UpdateIntentResult> {
    // Validate session
    if (!this.auth.validateSession(args.agent_id, args.session_id)) {
      return {
        ok: false,
        error: 'Invalid agent_id or session_id. Session not registered.',
      };
    }

    // Get the existing intent
    const intent = this.yjsDoc.getIntent(args.lease_id);
    if (!intent) {
      return {
        ok: false,
        error: 'Intent not found.',
      };
    }

    // Verify ownership
    if (intent.agent_id !== args.agent_id) {
      return {
        ok: false,
        error: 'Cannot update intent owned by another agent.',
      };
    }

    // Update fields
    const updatedIntent: IntentRecord = { ...intent };

    if (args.fields.scope) {
      updatedIntent.scope = args.fields.scope;

      // Check for overlaps with new scope
      const overlapInfo = this.overlapDetector.checkIntentOverlap(
        updatedIntent,
        this.yjsDoc.getActiveIntents()
      );

      if (overlapInfo.overlaps) {
        return {
          ok: false,
          error: `Updated scope would overlap: ${overlapInfo.reason}`,
        };
      }
    }

    if (args.fields.reason) {
      updatedIntent.reason = args.fields.reason;
    }

    if (args.fields.planned_delta_hash) {
      updatedIntent.planned_delta_hash = args.fields.planned_delta_hash;
    }

    if (args.fields.ttl_ms) {
      updatedIntent.ttl_ms = args.fields.ttl_ms;
      updatedIntent.started_at = new Date().toISOString();
    }

    // Update in Yjs
    this.yjsDoc.setIntent(args.lease_id, updatedIntent);

    // Update TTL timer if ttl_ms changed
    if (args.fields.ttl_ms) {
      this.ttlManager.updateTimer(args.lease_id, updatedIntent);
    }

    // Emit event
    this.emitEvent('intent.updated', { lease_id: args.lease_id, intent: updatedIntent });

    return { ok: true };
  }

  /**
   * End an intent
   */
  async endIntent(args: EndIntentArgs): Promise<EndIntentResult> {
    // Validate session
    if (!this.auth.validateSession(args.agent_id, args.session_id)) {
      return {
        ok: false,
        error: 'Invalid agent_id or session_id. Session not registered.',
      };
    }

    // Get the existing intent
    const intent = this.yjsDoc.getIntent(args.lease_id);
    if (!intent) {
      return {
        ok: false,
        error: 'Intent not found.',
      };
    }

    // Verify ownership
    if (intent.agent_id !== args.agent_id) {
      return {
        ok: false,
        error: 'Cannot end intent owned by another agent.',
      };
    }

    // Update status
    const updatedIntent: IntentRecord = {
      ...intent,
      status: args.status || 'ended',
    };

    this.yjsDoc.setIntent(args.lease_id, updatedIntent);

    // Clear TTL timer
    this.ttlManager.clearTimer(args.lease_id);

    // Emit event
    this.emitEvent('intent.ended', { lease_id: args.lease_id, intent: updatedIntent });

    return { ok: true };
  }

  /**
   * Handle intent expiration
   */
  private handleExpiration(lease_id: string, intent: IntentRecord): void {
    const latestIntent = this.yjsDoc.getIntent(lease_id) ?? intent;
    const updatedIntent: IntentRecord = {
      ...latestIntent,
      status: 'expired',
    };

    this.yjsDoc.setIntent(lease_id, updatedIntent);

    // Emit event
    this.emitEvent('intent.expired', { lease_id, intent: updatedIntent });
  }

  /**
   * Emit an event
   */
  private emitEvent(event: string, data: any): void {
    if (this.eventEmitter) {
      this.eventEmitter(event, data);
    }
  }
}
