/**
 * Unit tests for overlap detection logic
 */

import { OverlapDetector } from '../server/src/core/overlap.js';
import { IntentRecord } from '../server/src/types.js';

describe('OverlapDetector', () => {
  let detector: OverlapDetector;

  beforeEach(() => {
    detector = new OverlapDetector();
  });

  describe('Symbol overlap detection', () => {
    it('should detect overlap when two intents target the same symbol', () => {
      const activeIntents: IntentRecord[] = [
        {
          lease_id: 'lease-1',
          agent_id: 'agent-a',
          file: 'test.ts',
          scope: { symbol: 'MyFunction' },
          reason: 'Testing',
          planned_delta_hash: 'hash1',
          started_at: new Date().toISOString(),
          ttl_ms: 300000,
          status: 'active',
        },
      ];

      const newIntent = {
        agent_id: 'agent-b',
        file: 'test.ts',
        scope: { symbol: 'MyFunction' },
      };

      const result = detector.detectOverlap(newIntent, activeIntents);

      expect(result.overlaps).toBe(true);
      expect(result.conflicting_lease_id).toBe('lease-1');
      expect(result.reason).toContain('MyFunction');
    });

    it('should not detect overlap for different symbols in same file', () => {
      const activeIntents: IntentRecord[] = [
        {
          lease_id: 'lease-1',
          agent_id: 'agent-a',
          file: 'test.ts',
          scope: { symbol: 'FunctionA' },
          reason: 'Testing',
          planned_delta_hash: 'hash1',
          started_at: new Date().toISOString(),
          ttl_ms: 300000,
          status: 'active',
        },
      ];

      const newIntent = {
        agent_id: 'agent-b',
        file: 'test.ts',
        scope: { symbol: 'FunctionB' },
      };

      const result = detector.detectOverlap(newIntent, activeIntents);

      expect(result.overlaps).toBe(false);
    });

    it('should allow same agent to have multiple intents on different symbols', () => {
      const activeIntents: IntentRecord[] = [
        {
          lease_id: 'lease-1',
          agent_id: 'agent-a',
          file: 'test.ts',
          scope: { symbol: 'FunctionA' },
          reason: 'Testing',
          planned_delta_hash: 'hash1',
          started_at: new Date().toISOString(),
          ttl_ms: 300000,
          status: 'active',
        },
      ];

      const newIntent = {
        agent_id: 'agent-a',
        file: 'test.ts',
        scope: { symbol: 'FunctionB' },
      };

      const result = detector.detectOverlap(newIntent, activeIntents);

      expect(result.overlaps).toBe(false);
    });
  });

  describe('Range overlap detection', () => {
    it('should detect overlap when ranges intersect', () => {
      const activeIntents: IntentRecord[] = [
        {
          lease_id: 'lease-1',
          agent_id: 'agent-a',
          file: 'test.ts',
          scope: { range: { startLine: 10, endLine: 20 } },
          reason: 'Testing',
          planned_delta_hash: 'hash1',
          started_at: new Date().toISOString(),
          ttl_ms: 300000,
          status: 'active',
        },
      ];

      const newIntent = {
        agent_id: 'agent-b',
        file: 'test.ts',
        scope: { range: { startLine: 15, endLine: 25 } },
      };

      const result = detector.detectOverlap(newIntent, activeIntents);

      expect(result.overlaps).toBe(true);
      expect(result.conflicting_lease_id).toBe('lease-1');
    });

    it('should not detect overlap when ranges do not intersect', () => {
      const activeIntents: IntentRecord[] = [
        {
          lease_id: 'lease-1',
          agent_id: 'agent-a',
          file: 'test.ts',
          scope: { range: { startLine: 10, endLine: 20 } },
          reason: 'Testing',
          planned_delta_hash: 'hash1',
          started_at: new Date().toISOString(),
          ttl_ms: 300000,
          status: 'active',
        },
      ];

      const newIntent = {
        agent_id: 'agent-b',
        file: 'test.ts',
        scope: { range: { startLine: 21, endLine: 30 } },
      };

      const result = detector.detectOverlap(newIntent, activeIntents);

      expect(result.overlaps).toBe(false);
    });

    it('should detect overlap for adjacent lines when ranges touch', () => {
      const activeIntents: IntentRecord[] = [
        {
          lease_id: 'lease-1',
          agent_id: 'agent-a',
          file: 'test.ts',
          scope: { range: { startLine: 10, endLine: 20 } },
          reason: 'Testing',
          planned_delta_hash: 'hash1',
          started_at: new Date().toISOString(),
          ttl_ms: 300000,
          status: 'active',
        },
      ];

      const newIntent = {
        agent_id: 'agent-b',
        file: 'test.ts',
        scope: { range: { startLine: 20, endLine: 30 } },
      };

      const result = detector.detectOverlap(newIntent, activeIntents);

      expect(result.overlaps).toBe(true);
    });
  });

  describe('Symbol supersedes range', () => {
    it('should detect overlap when new intent has symbol and existing has overlapping range', () => {
      const activeIntents: IntentRecord[] = [
        {
          lease_id: 'lease-1',
          agent_id: 'agent-a',
          file: 'test.ts',
          scope: { range: { startLine: 10, endLine: 20 } },
          reason: 'Testing',
          planned_delta_hash: 'hash1',
          started_at: new Date().toISOString(),
          ttl_ms: 300000,
          status: 'active',
        },
      ];

      const newIntent = {
        agent_id: 'agent-b',
        file: 'test.ts',
        scope: { symbol: 'MyFunction' },
      };

      const result = detector.detectOverlap(newIntent, activeIntents);

      expect(result.overlaps).toBe(true);
      expect(result.reason).toContain('symbol');
    });

    it('should detect overlap when new intent has range and existing has symbol', () => {
      const activeIntents: IntentRecord[] = [
        {
          lease_id: 'lease-1',
          agent_id: 'agent-a',
          file: 'test.ts',
          scope: { symbol: 'MyFunction' },
          reason: 'Testing',
          planned_delta_hash: 'hash1',
          started_at: new Date().toISOString(),
          ttl_ms: 300000,
          status: 'active',
        },
      ];

      const newIntent = {
        agent_id: 'agent-b',
        file: 'test.ts',
        scope: { range: { startLine: 10, endLine: 20 } },
      };

      const result = detector.detectOverlap(newIntent, activeIntents);

      expect(result.overlaps).toBe(true);
      expect(result.reason).toContain('symbol');
    });
  });

  describe('Different files', () => {
    it('should not detect overlap for different files', () => {
      const activeIntents: IntentRecord[] = [
        {
          lease_id: 'lease-1',
          agent_id: 'agent-a',
          file: 'fileA.ts',
          scope: { symbol: 'MyFunction' },
          reason: 'Testing',
          planned_delta_hash: 'hash1',
          started_at: new Date().toISOString(),
          ttl_ms: 300000,
          status: 'active',
        },
      ];

      const newIntent = {
        agent_id: 'agent-b',
        file: 'fileB.ts',
        scope: { symbol: 'MyFunction' },
      };

      const result = detector.detectOverlap(newIntent, activeIntents);

      expect(result.overlaps).toBe(false);
    });
  });

  describe('Status filtering', () => {
    it('should only check active intents, not ended ones', () => {
      const activeIntents: IntentRecord[] = [
        {
          lease_id: 'lease-1',
          agent_id: 'agent-a',
          file: 'test.ts',
          scope: { symbol: 'MyFunction' },
          reason: 'Testing',
          planned_delta_hash: 'hash1',
          started_at: new Date().toISOString(),
          ttl_ms: 300000,
          status: 'ended',
        },
      ];

      const newIntent = {
        agent_id: 'agent-b',
        file: 'test.ts',
        scope: { symbol: 'MyFunction' },
      };

      const result = detector.detectOverlap(newIntent, activeIntents);

      expect(result.overlaps).toBe(false);
    });

    it('should only check active intents, not expired ones', () => {
      const activeIntents: IntentRecord[] = [
        {
          lease_id: 'lease-1',
          agent_id: 'agent-a',
          file: 'test.ts',
          scope: { symbol: 'MyFunction' },
          reason: 'Testing',
          planned_delta_hash: 'hash1',
          started_at: new Date().toISOString(),
          ttl_ms: 300000,
          status: 'expired',
        },
      ];

      const newIntent = {
        agent_id: 'agent-b',
        file: 'test.ts',
        scope: { symbol: 'MyFunction' },
      };

      const result = detector.detectOverlap(newIntent, activeIntents);

      expect(result.overlaps).toBe(false);
    });
  });
});
