/**
 * Yjs document layer with Awareness channel
 * Manages shared state for intents, summaries, and awareness
 */

import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import { WebsocketProvider } from 'y-websocket';
import { IntentRecord, EditSummary, AwarenessState, AwarenessSnapshot } from '../types.js';
import { ServerConfig } from '../config.js';

export class YjsDocManager {
  public doc: Y.Doc;
  public awareness: Awareness;
  private wsProvider?: WebsocketProvider;

  // Y.js data structures
  private intentsMap: Y.Map<IntentRecord>;
  private summariesIndex: Y.Map<EditSummary[]>;

  constructor(private config: ServerConfig) {
    this.doc = new Y.Doc();
    this.awareness = new Awareness(this.doc);

    // Initialize shared data structures
    this.intentsMap = this.doc.getMap('intents');
    this.summariesIndex = this.doc.getMap('summaries_index');
  }

  /**
   * Initialize WebSocket provider for distributed awareness
   * This allows multiple server instances to sync state
   */
  initWebSocketProvider(wsUrl: string): void {
    this.wsProvider = new WebsocketProvider(wsUrl, this.config.roomId, this.doc, {
      awareness: this.awareness,
    });

    this.wsProvider.on('status', ({ status }: { status: string }) => {
      console.log(`WebSocket status: ${status}`);
    });

    this.wsProvider.on('sync', (isSynced: boolean) => {
      console.log(`Yjs doc ${isSynced ? 'synced' : 'unsynced'}`);
    });
  }

  /**
   * Set local awareness state
   */
  setAwarenessState(clientId: number, state: AwarenessState): void {
    this.awareness.setLocalState(state);
  }

  /**
   * Get all awareness states
   */
  getAwarenessStates(): Map<number, AwarenessState> {
    return this.awareness.getStates() as Map<number, AwarenessState>;
  }

  /**
   * Subscribe to awareness updates
   */
  onAwarenessUpdate(callback: (changes: { added: number[]; updated: number[]; removed: number[] }, origin: string) => void): void {
    this.awareness.on('update', callback);
  }

  /**
   * Subscribe to awareness changes (more detailed than update)
   */
  onAwarenessChange(callback: (changes: { added: number[]; updated: number[]; removed: number[] }, origin: string) => void): void {
    this.awareness.on('change', callback);
  }

  /**
   * Add or update an intent
   */
  setIntent(lease_id: string, intent: IntentRecord): void {
    this.intentsMap.set(lease_id, intent);
  }

  /**
   * Get an intent by lease_id
   */
  getIntent(lease_id: string): IntentRecord | undefined {
    return this.intentsMap.get(lease_id);
  }

  /**
   * Get all intents
   */
  getAllIntents(): IntentRecord[] {
    const intents: IntentRecord[] = [];
    this.intentsMap.forEach((intent) => {
      intents.push(intent);
    });
    return intents;
  }

  /**
   * Get active intents (status = 'active')
   */
  getActiveIntents(): IntentRecord[] {
    return this.getAllIntents().filter((intent) => intent.status === 'active');
  }

  /**
   * Delete an intent
   */
  deleteIntent(lease_id: string): void {
    this.intentsMap.delete(lease_id);
  }

  /**
   * Subscribe to intent changes
   */
  onIntentChange(callback: (event: Y.YMapEvent<IntentRecord>, transaction: Y.Transaction) => void): void {
    this.intentsMap.observe(callback);
  }

  /**
   * Append an edit summary to a file's summary list
   */
  appendSummary(file: string, summary: EditSummary): void {
    const summaries = this.summariesIndex.get(file) || [];
    summaries.push(summary);
    this.summariesIndex.set(file, summaries);
  }

  /**
   * Get all summaries for a file
   */
  getSummaries(file: string): EditSummary[] {
    return this.summariesIndex.get(file) || [];
  }

  /**
   * Get all summaries (all files)
   */
  getAllSummaries(): Record<string, EditSummary[]> {
    const result: Record<string, EditSummary[]> = {};
    this.summariesIndex.forEach((summaries, file) => {
      result[file] = summaries;
    });
    return result;
  }

  /**
   * Get a complete snapshot of the current state
   */
  getSnapshot(): AwarenessSnapshot {
    const awarenessStates: Record<string, AwarenessState> = {};
    this.awareness.getStates().forEach((state, clientId) => {
      awarenessStates[clientId.toString()] = state as AwarenessState;
    });

    const intents: Record<string, IntentRecord> = {};
    this.intentsMap.forEach((intent, lease_id) => {
      intents[lease_id] = intent;
    });

    return {
      awareness_states: awarenessStates,
      intents,
      summaries_index: this.getAllSummaries(),
    };
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.wsProvider) {
      this.wsProvider.destroy();
    }
    this.awareness.destroy();
    this.doc.destroy();
  }
}
