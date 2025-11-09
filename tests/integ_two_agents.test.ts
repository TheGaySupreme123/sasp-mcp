/**
 * Integration test: Two agents coordinating via SASP
 */

import { YjsDocManager } from '../server/src/yjs/doc.js';
import { AuthValidator } from '../server/src/core/auth.js';
import { OverlapDetector } from '../server/src/core/overlap.js';
import { TTLManager } from '../server/src/core/ttl.js';
import { AwarenessTools } from '../server/src/mcp/tools/awareness.js';
import { IntentTools } from '../server/src/mcp/tools/intent.js';
import { EditsTools } from '../server/src/mcp/tools/edits.js';
import { loadConfig } from '../server/src/config.js';

describe('Integration: Two Agents Coordination', () => {
  let yjsDoc: YjsDocManager;
  let auth: AuthValidator;
  let overlapDetector: OverlapDetector;
  let ttlManager: TTLManager;
  let awarenessTools: AwarenessTools;
  let intentTools: IntentTools;
  let editsTools: EditsTools;

  const config = loadConfig();
  const token = config.token;

  beforeEach(() => {
    yjsDoc = new YjsDocManager(config);
    auth = new AuthValidator(config);
    overlapDetector = new OverlapDetector();
    ttlManager = new TTLManager();

    awarenessTools = new AwarenessTools(yjsDoc, auth);
    intentTools = new IntentTools(yjsDoc, auth, overlapDetector, ttlManager);
    editsTools = new EditsTools(yjsDoc, auth);

    // Register sessions
    auth.registerSession('agent-a', 'session-1', token);
    auth.registerSession('agent-b', 'session-2', token);
  });

  afterEach(() => {
    ttlManager.clearAll();
    yjsDoc.destroy();
  });

  it('should coordinate two agents editing the same symbol', async () => {
    // Agent A sets awareness
    const awarenessA = await awarenessTools.setLocalState({
      agent_id: 'agent-a',
      session_id: 'session-1',
      state: {
        agent_id: 'agent-a',
        session_id: 'session-1',
        activity: 'planning',
        file: 'test.ts',
        selection: { symbol: 'MyFunction' },
        rationale: 'Adding feature X',
        ts: new Date().toISOString(),
      },
    });

    expect(awarenessA.ok).toBe(true);

    // Agent A starts intent
    const intentA = await intentTools.startIntent({
      agent_id: 'agent-a',
      session_id: 'session-1',
      file: 'test.ts',
      scope: { symbol: 'MyFunction' },
      reason: 'Adding feature X',
      planned_delta_hash: 'hash-a',
      ttl_ms: 10000,
    });

    expect(intentA.ok).toBe(true);
    expect(intentA.lease_id).toBeDefined();

    // Agent B tries to start overlapping intent (should fail)
    const intentB1 = await intentTools.startIntent({
      agent_id: 'agent-b',
      session_id: 'session-2',
      file: 'test.ts',
      scope: { symbol: 'MyFunction' },
      reason: 'Adding feature Y',
      planned_delta_hash: 'hash-b',
    });

    expect(intentB1.ok).toBe(false);
    expect(intentB1.conflict).toBeDefined();
    expect(intentB1.conflict?.conflicting_lease_id).toBe(intentA.lease_id);

    // Agent A completes and appends summary
    const summaryA = await editsTools.appendSummary({
      agent_id: 'agent-a',
      session_id: 'session-1',
      file: 'test.ts',
      summary: {
        outline: 'Added feature X to MyFunction',
        affected_symbols: ['MyFunction'],
        delta_hash: 'hash-a',
        tests_run: ['test.ts'],
        result: 'pass',
      },
    });

    expect(summaryA.ok).toBe(true);

    // Agent A ends intent
    const endA = await intentTools.endIntent({
      agent_id: 'agent-a',
      session_id: 'session-1',
      lease_id: intentA.lease_id!,
    });

    expect(endA.ok).toBe(true);

    // Agent B tries again (should succeed now)
    const intentB2 = await intentTools.startIntent({
      agent_id: 'agent-b',
      session_id: 'session-2',
      file: 'test.ts',
      scope: { symbol: 'MyFunction' },
      reason: 'Adding feature Y',
      planned_delta_hash: 'hash-b',
    });

    expect(intentB2.ok).toBe(true);
    expect(intentB2.lease_id).toBeDefined();

    // Agent B completes
    const summaryB = await editsTools.appendSummary({
      agent_id: 'agent-b',
      session_id: 'session-2',
      file: 'test.ts',
      summary: {
        outline: 'Added feature Y to MyFunction',
        affected_symbols: ['MyFunction'],
        delta_hash: 'hash-b',
        tests_run: ['test.ts'],
        result: 'pass',
      },
    });

    expect(summaryB.ok).toBe(true);

    const endB = await intentTools.endIntent({
      agent_id: 'agent-b',
      session_id: 'session-2',
      lease_id: intentB2.lease_id!,
    });

    expect(endB.ok).toBe(true);

    // Verify summaries
    const summaries = yjsDoc.getSummaries('test.ts');
    expect(summaries).toHaveLength(2);
    expect(summaries[0].agent_id).toBe('agent-a');
    expect(summaries[1].agent_id).toBe('agent-b');
  });

  it('should handle TTL expiration', async () => {
    let expirationCalled = false;
    let observedLease: string | undefined;

    intentTools.setEventEmitter((event, data) => {
      if (event === 'intent.expired') {
        expirationCalled = true;
        observedLease = data.lease_id;
      }
    });

    const intentA = await intentTools.startIntent({
      agent_id: 'agent-a',
      session_id: 'session-1',
      file: 'test.ts',
      scope: { symbol: 'MyFunction' },
      reason: 'Testing TTL',
      planned_delta_hash: 'hash-a',
      ttl_ms: 200, // 200ms
    });

    expect(intentA.ok).toBe(true);

    await new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(expirationCalled).toBe(true);
        expect(observedLease).toBe(intentA.lease_id);

        const intent = yjsDoc.getIntent(intentA.lease_id!);
        expect(intent?.status).toBe('expired');

        resolve();
      }, 400);
    });
  });

  it('should propagate awareness updates', async () => {
    // Agent A sets awareness
    await awarenessTools.setLocalState({
      agent_id: 'agent-a',
      session_id: 'session-1',
      state: {
        agent_id: 'agent-a',
        session_id: 'session-1',
        activity: 'editing',
        file: 'test.ts',
        selection: { startLine: 10, endLine: 20 },
        rationale: 'Refactoring',
        ts: new Date().toISOString(),
      },
    });

    // Get awareness states
    const states = awarenessTools.getAwarenessStates();

    // Should have at least one state
    expect(Object.keys(states).length).toBeGreaterThan(0);

    // Find agent A's state
    const agentAState = Object.values(states).find((s) => s.agent_id === 'agent-a');
    expect(agentAState).toBeDefined();
    expect(agentAState?.activity).toBe('editing');
    expect(agentAState?.file).toBe('test.ts');
  });

  it('should allow agents to update their intents', async () => {
    // Agent A starts intent
    const intentA = await intentTools.startIntent({
      agent_id: 'agent-a',
      session_id: 'session-1',
      file: 'test.ts',
      scope: { range: { startLine: 10, endLine: 20 } },
      reason: 'Initial reason',
      planned_delta_hash: 'hash-a',
      ttl_ms: 10000,
    });

    expect(intentA.ok).toBe(true);

    // Agent A updates intent (expand scope to non-overlapping range)
    const updateA = await intentTools.updateIntent({
      agent_id: 'agent-a',
      session_id: 'session-1',
      lease_id: intentA.lease_id!,
      fields: {
        scope: { range: { startLine: 10, endLine: 30 } },
        reason: 'Updated reason: expanding scope',
      },
    });

    expect(updateA.ok).toBe(true);

    // Verify update
    const intent = yjsDoc.getIntent(intentA.lease_id!);
    expect(intent?.scope.range?.endLine).toBe(30);
    expect(intent?.reason).toBe('Updated reason: expanding scope');
  });

  it('should reject intent updates that would cause overlaps', async () => {
    // Agent A starts intent on lines 10-20
    const intentA = await intentTools.startIntent({
      agent_id: 'agent-a',
      session_id: 'session-1',
      file: 'test.ts',
      scope: { range: { startLine: 10, endLine: 20 } },
      reason: 'Agent A edit',
      planned_delta_hash: 'hash-a',
    });

    expect(intentA.ok).toBe(true);

    // Agent B starts intent on lines 30-40
    const intentB = await intentTools.startIntent({
      agent_id: 'agent-b',
      session_id: 'session-2',
      file: 'test.ts',
      scope: { range: { startLine: 30, endLine: 40 } },
      reason: 'Agent B edit',
      planned_delta_hash: 'hash-b',
    });

    expect(intentB.ok).toBe(true);

    // Agent B tries to update scope to overlap with Agent A (should fail)
    const updateB = await intentTools.updateIntent({
      agent_id: 'agent-b',
      session_id: 'session-2',
      lease_id: intentB.lease_id!,
      fields: {
        scope: { range: { startLine: 15, endLine: 35 } },
      },
    });

    expect(updateB.ok).toBe(false);
    expect(updateB.error).toContain('overlap');
  });
});
