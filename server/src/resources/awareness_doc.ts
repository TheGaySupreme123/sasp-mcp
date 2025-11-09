/**
 * MCP resource for awareness document snapshot
 */

import { YjsDocManager } from '../yjs/doc.js';
import { AwarenessSnapshot } from '../types.js';

export class AwarenessDocResource {
  constructor(private yjsDoc: YjsDocManager) {}

  /**
   * Get a complete snapshot of the awareness document
   */
  getSnapshot(): AwarenessSnapshot {
    return this.yjsDoc.getSnapshot();
  }

  /**
   * Get resource URI
   */
  static getUri(): string {
    return 'sasp://awareness/doc';
  }

  /**
   * Get resource metadata
   */
  static getMetadata() {
    return {
      uri: AwarenessDocResource.getUri(),
      name: 'Awareness Document Snapshot',
      description: 'Complete snapshot of awareness states, active intents, and edit summaries',
      mimeType: 'application/json',
    };
  }
}
