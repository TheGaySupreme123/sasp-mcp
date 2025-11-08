/**
 * MCP tools for edit summaries and git operations
 */

import { YjsDocManager } from '../../yjs/doc.js';
import { AuthValidator } from '../../core/auth.js';
import { EditSummary } from '../../types.js';

export interface AppendSummaryArgs {
  agent_id: string;
  session_id: string;
  file: string;
  summary: {
    outline: string;
    affected_symbols?: string[];
    delta_hash: string;
    tests_run?: string[];
    result?: 'pass' | 'fail';
  };
}

export interface AppendSummaryResult {
  ok: boolean;
  error?: string;
}

export interface GitCommitArgs {
  agent_id: string;
  session_id: string;
  diff: string;
  message: string;
}

export interface GitCommitResult {
  ok: boolean;
  commit?: string;
  error?: string;
}

export class EditsTools {
  constructor(
    private yjsDoc: YjsDocManager,
    private auth: AuthValidator
  ) {}

  /**
   * Append an edit summary for a file
   */
  async appendSummary(args: AppendSummaryArgs): Promise<AppendSummaryResult> {
    // Validate session
    if (!this.auth.validateSession(args.agent_id, args.session_id)) {
      return {
        ok: false,
        error: 'Invalid agent_id or session_id. Session not registered.',
      };
    }

    // Create edit summary
    const summary: EditSummary = {
      agent_id: args.agent_id,
      file: args.file,
      outline: args.summary.outline,
      affected_symbols: args.summary.affected_symbols,
      delta_hash: args.summary.delta_hash,
      tests_run: args.summary.tests_run,
      result: args.summary.result,
      ts: new Date().toISOString(),
    };

    // Append to Yjs
    this.yjsDoc.appendSummary(args.file, summary);

    return { ok: true };
  }

  /**
   * Git commit stub (MVP implementation)
   * In a real implementation, this would interact with the git CLI
   */
  async gitCommit(args: GitCommitArgs): Promise<GitCommitResult> {
    // Validate session
    if (!this.auth.validateSession(args.agent_id, args.session_id)) {
      return {
        ok: false,
        error: 'Invalid agent_id or session_id. Session not registered.',
      };
    }

    // Stub implementation - in production this would:
    // 1. Validate the diff
    // 2. Apply the diff to the working tree
    // 3. Stage the changes
    // 4. Create a commit with the message
    // 5. Return the commit hash

    console.log(`[STUB] Git commit requested by ${args.agent_id}`);
    console.log(`[STUB] Message: ${args.message}`);
    console.log(`[STUB] Diff length: ${args.diff.length} bytes`);

    // Generate a fake commit hash for MVP
    const fakeCommitHash = `stub-${Date.now()}-${args.agent_id.substring(0, 8)}`;

    return {
      ok: true,
      commit: fakeCommitHash,
    };
  }
}
