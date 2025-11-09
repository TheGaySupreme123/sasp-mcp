/**
 * TTL (Time To Live) management for intent leases
 * Handles expiration of stale intents
 */

import { IntentRecord } from '../types.js';

export type ExpirationCallback = (lease_id: string, intent: IntentRecord) => void;

export class TTLManager {
  private timers: Map<string, NodeJS.Timeout>;
  private expirationCallbacks: ExpirationCallback[];

  constructor() {
    this.timers = new Map();
    this.expirationCallbacks = [];
  }

  /**
   * Register a callback to be called when an intent expires
   */
  onExpiration(callback: ExpirationCallback): void {
    this.expirationCallbacks.push(callback);
  }

  /**
   * Start a TTL timer for an intent
   */
  startTimer(lease_id: string, intent: IntentRecord): void {
    // Clear existing timer if present
    this.clearTimer(lease_id);

    const timer = setTimeout(() => {
      this.handleExpiration(lease_id, intent);
    }, intent.ttl_ms);

    this.timers.set(lease_id, timer);
  }

  /**
   * Update the TTL for an existing intent
   * Restarts the timer with the new TTL
   */
  updateTimer(lease_id: string, intent: IntentRecord): void {
    this.startTimer(lease_id, intent);
  }

  /**
   * Clear a TTL timer (when intent is ended manually)
   */
  clearTimer(lease_id: string): void {
    const timer = this.timers.get(lease_id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(lease_id);
    }
  }

  /**
   * Handle intent expiration
   */
  private handleExpiration(lease_id: string, intent: IntentRecord): void {
    this.timers.delete(lease_id);

    // Notify all callbacks
    for (const callback of this.expirationCallbacks) {
      try {
        callback(lease_id, intent);
      } catch (error) {
        console.error(`Error in expiration callback for ${lease_id}:`, error);
      }
    }
  }

  /**
   * Check if an intent has expired based on timestamp
   */
  isExpired(intent: IntentRecord): boolean {
    const startedAt = new Date(intent.started_at).getTime();
    const now = Date.now();
    return now - startedAt >= intent.ttl_ms;
  }

  /**
   * Get remaining time in milliseconds
   */
  getRemainingTime(intent: IntentRecord): number {
    const startedAt = new Date(intent.started_at).getTime();
    const now = Date.now();
    const elapsed = now - startedAt;
    return Math.max(0, intent.ttl_ms - elapsed);
  }

  /**
   * Clear all timers (cleanup)
   */
  clearAll(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }
}
