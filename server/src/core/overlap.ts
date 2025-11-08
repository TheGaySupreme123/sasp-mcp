/**
 * Overlap detection logic for edit intents
 * Symbol claims supersede range-only claims
 */

import { IntentRecord, OverlapInfo } from '../types.js';

export class OverlapDetector {
  /**
   * Check if two line ranges overlap
   */
  private rangesOverlap(
    range1: { startLine: number; endLine: number },
    range2: { startLine: number; endLine: number }
  ): boolean {
    return range1.startLine <= range2.endLine && range1.endLine >= range2.startLine;
  }

  /**
   * Detect if a new intent overlaps with any existing active intents
   * Returns overlap info with the conflicting lease_id if found
   */
  detectOverlap(
    newIntent: {
      agent_id: string;
      file: string;
      scope: { range?: { startLine: number; endLine: number }; symbol?: string };
    },
    activeIntents: IntentRecord[]
  ): OverlapInfo {
    // Filter for active intents in the same file from different agents
    const relevantIntents = activeIntents.filter(
      (intent) =>
        intent.file === newIntent.file &&
        intent.agent_id !== newIntent.agent_id &&
        intent.status === 'active'
    );

    for (const existing of relevantIntents) {
      // Case 1: Both targeting the same symbol
      if (newIntent.scope.symbol && existing.scope.symbol) {
        if (newIntent.scope.symbol === existing.scope.symbol) {
          return {
            overlaps: true,
            conflicting_lease_id: existing.lease_id,
            reason: `Symbol '${newIntent.scope.symbol}' is already being edited by agent ${existing.agent_id}`,
          };
        }
      }

      // Case 2: New intent targets symbol, existing has range
      // Symbol claims supersede range claims - new claim should override
      if (newIntent.scope.symbol && existing.scope.range) {
        // We consider this an overlap that requires negotiation
        return {
          overlaps: true,
          conflicting_lease_id: existing.lease_id,
          reason: `Symbol '${newIntent.scope.symbol}' conflicts with range-based edit by agent ${existing.agent_id}`,
        };
      }

      // Case 3: New intent has range, existing targets symbol
      // Existing symbol claim supersedes - reject new range claim
      if (newIntent.scope.range && existing.scope.symbol) {
        return {
          overlaps: true,
          conflicting_lease_id: existing.lease_id,
          reason: `Range overlaps with symbol '${existing.scope.symbol}' being edited by agent ${existing.agent_id}`,
        };
      }

      // Case 4: Both have ranges
      if (newIntent.scope.range && existing.scope.range) {
        if (this.rangesOverlap(newIntent.scope.range, existing.scope.range)) {
          return {
            overlaps: true,
            conflicting_lease_id: existing.lease_id,
            reason: `Line range ${newIntent.scope.range.startLine}-${newIntent.scope.range.endLine} overlaps with agent ${existing.agent_id}'s edit`,
          };
        }
      }
    }

    return { overlaps: false };
  }

  /**
   * Check if a specific intent overlaps with any other active intents
   * (used for validation when updating an intent)
   */
  checkIntentOverlap(intent: IntentRecord, allActiveIntents: IntentRecord[]): OverlapInfo {
    // Exclude the intent itself from the check
    const otherIntents = allActiveIntents.filter((i) => i.lease_id !== intent.lease_id);

    return this.detectOverlap(
      {
        agent_id: intent.agent_id,
        file: intent.file,
        scope: intent.scope,
      },
      otherIntents
    );
  }
}
