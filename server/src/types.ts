/**
 * Core type definitions for SASP
 */

export interface AwarenessState {
  agent_id: string;
  session_id: string;
  file?: string;
  selection?: { startLine: number; endLine: number } | { symbol: string };
  activity: 'planning' | 'editing' | 'testing' | 'idle';
  rationale?: string;
  task_id?: string;
  ts: string;
}

export interface IntentRecord {
  lease_id: string;
  agent_id: string;
  file: string;
  scope: {
    range?: { startLine: number; endLine: number };
    symbol?: string;
  };
  reason: string;
  planned_delta_hash: string;
  started_at: string;
  ttl_ms: number;
  status: 'active' | 'ended' | 'expired';
}

export interface EditSummary {
  agent_id: string;
  file: string;
  outline: string;
  affected_symbols?: string[];
  delta_hash: string;
  tests_run?: string[];
  result?: 'pass' | 'fail';
  ts: string;
}

export interface OverlapInfo {
  overlaps: boolean;
  conflicting_lease_id?: string;
  reason?: string;
}

export interface AwarenessSnapshot {
  awareness_states: Record<string, AwarenessState>;
  intents: Record<string, IntentRecord>;
  summaries_index: Record<string, EditSummary[]>;
}
