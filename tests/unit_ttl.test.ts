/**
 * Unit tests for TTL (Time To Live) management
 */

import { TTLManager } from '../server/src/core/ttl.js';
import { IntentRecord } from '../server/src/types.js';

describe('TTLManager', () => {
  let ttlManager: TTLManager;

  beforeEach(() => {
    ttlManager = new TTLManager();
  });

  afterEach(() => {
    ttlManager.clearAll();
  });

  describe('Timer lifecycle', () => {
    it('should start a timer and call expiration callback', (done) => {
      const intent: IntentRecord = {
        lease_id: 'lease-1',
        agent_id: 'agent-a',
        file: 'test.ts',
        scope: { symbol: 'MyFunction' },
        reason: 'Testing',
        planned_delta_hash: 'hash1',
        started_at: new Date().toISOString(),
        ttl_ms: 100, // 100ms for fast test
        status: 'active',
      };

      ttlManager.onExpiration((lease_id, expiredIntent) => {
        expect(lease_id).toBe('lease-1');
        expect(expiredIntent).toEqual(intent);
        done();
      });

      ttlManager.startTimer('lease-1', intent);
    });

    it('should clear a timer before expiration', (done) => {
      const intent: IntentRecord = {
        lease_id: 'lease-1',
        agent_id: 'agent-a',
        file: 'test.ts',
        scope: { symbol: 'MyFunction' },
        reason: 'Testing',
        planned_delta_hash: 'hash1',
        started_at: new Date().toISOString(),
        ttl_ms: 100,
        status: 'active',
      };

      let callbackCalled = false;

      ttlManager.onExpiration(() => {
        callbackCalled = true;
      });

      ttlManager.startTimer('lease-1', intent);

      // Clear the timer before it expires
      setTimeout(() => {
        ttlManager.clearTimer('lease-1');
      }, 50);

      // Check after expiration time that callback was not called
      setTimeout(() => {
        expect(callbackCalled).toBe(false);
        done();
      }, 200);
    });

    it('should update a timer with new TTL', (done) => {
      const intent: IntentRecord = {
        lease_id: 'lease-1',
        agent_id: 'agent-a',
        file: 'test.ts',
        scope: { symbol: 'MyFunction' },
        reason: 'Testing',
        planned_delta_hash: 'hash1',
        started_at: new Date().toISOString(),
        ttl_ms: 100,
        status: 'active',
      };

      let expirationTime = 0;
      const startTime = Date.now();

      ttlManager.onExpiration(() => {
        expirationTime = Date.now() - startTime;
      });

      ttlManager.startTimer('lease-1', intent);

      // Update the timer to extend TTL
      setTimeout(() => {
        const updatedIntent = { ...intent, ttl_ms: 200 };
        ttlManager.updateTimer('lease-1', updatedIntent);
      }, 50);

      // Check that expiration happens around 200ms, not 100ms
      setTimeout(() => {
        // Should be close to 200ms (give or take some tolerance)
        expect(expirationTime).toBeGreaterThan(150);
        expect(expirationTime).toBeLessThan(300);
        done();
      }, 300);
    });
  });

  describe('Expiration checking', () => {
    it('should correctly identify expired intents', () => {
      const pastTime = new Date(Date.now() - 10000).toISOString(); // 10 seconds ago

      const expiredIntent: IntentRecord = {
        lease_id: 'lease-1',
        agent_id: 'agent-a',
        file: 'test.ts',
        scope: { symbol: 'MyFunction' },
        reason: 'Testing',
        planned_delta_hash: 'hash1',
        started_at: pastTime,
        ttl_ms: 5000, // 5 second TTL
        status: 'active',
      };

      expect(ttlManager.isExpired(expiredIntent)).toBe(true);
    });

    it('should correctly identify non-expired intents', () => {
      const intent: IntentRecord = {
        lease_id: 'lease-1',
        agent_id: 'agent-a',
        file: 'test.ts',
        scope: { symbol: 'MyFunction' },
        reason: 'Testing',
        planned_delta_hash: 'hash1',
        started_at: new Date().toISOString(),
        ttl_ms: 300000, // 5 minutes
        status: 'active',
      };

      expect(ttlManager.isExpired(intent)).toBe(false);
    });
  });

  describe('Remaining time calculation', () => {
    it('should calculate correct remaining time', () => {
      const intent: IntentRecord = {
        lease_id: 'lease-1',
        agent_id: 'agent-a',
        file: 'test.ts',
        scope: { symbol: 'MyFunction' },
        reason: 'Testing',
        planned_delta_hash: 'hash1',
        started_at: new Date().toISOString(),
        ttl_ms: 10000, // 10 seconds
        status: 'active',
      };

      const remaining = ttlManager.getRemainingTime(intent);

      // Should be close to 10000ms (allow some tolerance for execution time)
      expect(remaining).toBeGreaterThan(9900);
      expect(remaining).toBeLessThanOrEqual(10000);
    });

    it('should return 0 for expired intents', () => {
      const pastTime = new Date(Date.now() - 10000).toISOString();

      const expiredIntent: IntentRecord = {
        lease_id: 'lease-1',
        agent_id: 'agent-a',
        file: 'test.ts',
        scope: { symbol: 'MyFunction' },
        reason: 'Testing',
        planned_delta_hash: 'hash1',
        started_at: pastTime,
        ttl_ms: 5000,
        status: 'active',
      };

      expect(ttlManager.getRemainingTime(expiredIntent)).toBe(0);
    });
  });

  describe('Multiple callbacks', () => {
    it('should call all registered callbacks on expiration', (done) => {
      const intent: IntentRecord = {
        lease_id: 'lease-1',
        agent_id: 'agent-a',
        file: 'test.ts',
        scope: { symbol: 'MyFunction' },
        reason: 'Testing',
        planned_delta_hash: 'hash1',
        started_at: new Date().toISOString(),
        ttl_ms: 100,
        status: 'active',
      };

      let callback1Called = false;
      let callback2Called = false;

      ttlManager.onExpiration(() => {
        callback1Called = true;
      });

      ttlManager.onExpiration(() => {
        callback2Called = true;
      });

      ttlManager.startTimer('lease-1', intent);

      setTimeout(() => {
        expect(callback1Called).toBe(true);
        expect(callback2Called).toBe(true);
        done();
      }, 200);
    });
  });

  describe('Clear all timers', () => {
    it('should clear all active timers', (done) => {
      const intent1: IntentRecord = {
        lease_id: 'lease-1',
        agent_id: 'agent-a',
        file: 'test.ts',
        scope: { symbol: 'FunctionA' },
        reason: 'Testing',
        planned_delta_hash: 'hash1',
        started_at: new Date().toISOString(),
        ttl_ms: 100,
        status: 'active',
      };

      const intent2: IntentRecord = {
        lease_id: 'lease-2',
        agent_id: 'agent-b',
        file: 'test.ts',
        scope: { symbol: 'FunctionB' },
        reason: 'Testing',
        planned_delta_hash: 'hash2',
        started_at: new Date().toISOString(),
        ttl_ms: 100,
        status: 'active',
      };

      let callbackCount = 0;

      ttlManager.onExpiration(() => {
        callbackCount++;
      });

      ttlManager.startTimer('lease-1', intent1);
      ttlManager.startTimer('lease-2', intent2);

      // Clear all timers
      setTimeout(() => {
        ttlManager.clearAll();
      }, 50);

      // Verify no callbacks were called
      setTimeout(() => {
        expect(callbackCount).toBe(0);
        done();
      }, 200);
    });
  });
});
