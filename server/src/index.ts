#!/usr/bin/env node
/**
 * SASP MCP Server - Main entry point
 * Provides edit-awareness and intent coordination for coding agents using Yjs
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ReadResourceRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import { loadConfig } from './config.js';
import { YjsDocManager } from './yjs/doc.js';
import { AuthValidator } from './core/auth.js';
import { OverlapDetector } from './core/overlap.js';
import { TTLManager } from './core/ttl.js';
import { AwarenessTools } from './mcp/tools/awareness.js';
import { IntentTools } from './mcp/tools/intent.js';
import { EditsTools } from './mcp/tools/edits.js';
import { AwarenessDocResource } from './resources/awareness_doc.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class SASPServer {
  private server: Server;
  private config = loadConfig();
  private yjsDoc: YjsDocManager;
  private auth: AuthValidator;
  private overlapDetector: OverlapDetector;
  private ttlManager: TTLManager;
  private awarenessTools: AwarenessTools;
  private intentTools: IntentTools;
  private editsTools: EditsTools;
  private awarenessResource: AwarenessDocResource;

  constructor() {
    this.server = new Server(
      {
        name: 'sasp-mcp-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
      }
    );

    // Initialize components
    this.yjsDoc = new YjsDocManager(this.config);
    this.auth = new AuthValidator(this.config);
    this.overlapDetector = new OverlapDetector();
    this.ttlManager = new TTLManager();

    // Initialize tools
    this.awarenessTools = new AwarenessTools(this.yjsDoc, this.auth);
    this.intentTools = new IntentTools(this.yjsDoc, this.auth, this.overlapDetector, this.ttlManager);
    this.editsTools = new EditsTools(this.yjsDoc, this.auth);

    // Initialize resources
    this.awarenessResource = new AwarenessDocResource(this.yjsDoc);

    // Set up event emitter for intent tools
    this.intentTools.setEventEmitter((event, data) => {
      this.log('info', `Event: ${event}`, data);
    });

    this.setupHandlers();
    this.setupAwarenessUpdates();
  }

  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any) {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    if (levels[level] >= levels[this.config.logLevel]) {
      const timestamp = new Date().toISOString();
      console.error(`[${timestamp}] [${level.toUpperCase()}] ${message}`, data || '');
    }
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'awareness.set_local',
            description: 'Set local awareness state for an agent session',
            inputSchema: {
              type: 'object',
              properties: {
                agent_id: { type: 'string', description: 'Unique identifier for the agent' },
                session_id: { type: 'string', description: 'Session identifier' },
                token: { type: 'string', description: 'Bearer authentication token' },
                state: {
                  type: 'object',
                  properties: {
                    agent_id: { type: 'string' },
                    session_id: { type: 'string' },
                    file: { type: 'string' },
                    selection: {
                      oneOf: [
                        {
                          type: 'object',
                          properties: {
                            startLine: { type: 'number' },
                            endLine: { type: 'number' },
                          },
                          required: ['startLine', 'endLine'],
                        },
                        {
                          type: 'object',
                          properties: {
                            symbol: { type: 'string' },
                          },
                          required: ['symbol'],
                        },
                      ],
                    },
                    activity: {
                      type: 'string',
                      enum: ['planning', 'editing', 'testing', 'idle'],
                    },
                    rationale: { type: 'string' },
                    task_id: { type: 'string' },
                    ts: { type: 'string' },
                  },
                  required: ['agent_id', 'session_id', 'activity'],
                },
              },
              required: ['agent_id', 'session_id', 'token', 'state'],
            },
          },
          {
            name: 'intent.start',
            description: 'Start a new edit intent, reserving a file scope',
            inputSchema: {
              type: 'object',
              properties: {
                agent_id: { type: 'string' },
                session_id: { type: 'string' },
                token: { type: 'string' },
                file: { type: 'string' },
                scope: {
                  type: 'object',
                  properties: {
                    range: {
                      type: 'object',
                      properties: {
                        startLine: { type: 'number' },
                        endLine: { type: 'number' },
                      },
                    },
                    symbol: { type: 'string' },
                  },
                },
                reason: { type: 'string' },
                planned_delta_hash: { type: 'string' },
                ttl_ms: { type: 'number', default: 300000 },
              },
              required: ['agent_id', 'session_id', 'token', 'file', 'scope', 'reason', 'planned_delta_hash'],
            },
          },
          {
            name: 'intent.update',
            description: 'Update an existing intent (scope, reason, TTL)',
            inputSchema: {
              type: 'object',
              properties: {
                agent_id: { type: 'string' },
                session_id: { type: 'string' },
                token: { type: 'string' },
                lease_id: { type: 'string' },
                fields: {
                  type: 'object',
                  properties: {
                    scope: { type: 'object' },
                    reason: { type: 'string' },
                    planned_delta_hash: { type: 'string' },
                    ttl_ms: { type: 'number' },
                  },
                },
              },
              required: ['agent_id', 'session_id', 'token', 'lease_id', 'fields'],
            },
          },
          {
            name: 'intent.end',
            description: 'End an active intent, freeing the scope',
            inputSchema: {
              type: 'object',
              properties: {
                agent_id: { type: 'string' },
                session_id: { type: 'string' },
                token: { type: 'string' },
                lease_id: { type: 'string' },
                status: { type: 'string', enum: ['ended', 'expired'], default: 'ended' },
              },
              required: ['agent_id', 'session_id', 'token', 'lease_id'],
            },
          },
          {
            name: 'edits.append_summary',
            description: 'Append an edit summary for a file',
            inputSchema: {
              type: 'object',
              properties: {
                agent_id: { type: 'string' },
                session_id: { type: 'string' },
                token: { type: 'string' },
                file: { type: 'string' },
                summary: {
                  type: 'object',
                  properties: {
                    outline: { type: 'string' },
                    affected_symbols: { type: 'array', items: { type: 'string' } },
                    delta_hash: { type: 'string' },
                    tests_run: { type: 'array', items: { type: 'string' } },
                    result: { type: 'string', enum: ['pass', 'fail'] },
                  },
                  required: ['outline', 'delta_hash'],
                },
              },
              required: ['agent_id', 'session_id', 'token', 'file', 'summary'],
            },
          },
          {
            name: 'git.commit',
            description: 'Create a git commit (stub implementation)',
            inputSchema: {
              type: 'object',
              properties: {
                agent_id: { type: 'string' },
                session_id: { type: 'string' },
                token: { type: 'string' },
                diff: { type: 'string' },
                message: { type: 'string' },
              },
              required: ['agent_id', 'session_id', 'token', 'diff', 'message'],
            },
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      this.log('info', `Tool call: ${name}`, args);

      try {
        // Validate token first
        if (!args || typeof args !== 'object' || !('token' in args)) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ ok: false, error: 'Missing token' }) }],
          };
        }

        const token = (args as any).token as string;

        // Register session if not already registered
        if ('agent_id' in args && 'session_id' in args) {
          const agentId = (args as any).agent_id as string;
          const sessionId = (args as any).session_id as string;
          this.auth.registerSession(agentId, sessionId, token);
        }

        let result: any;

        switch (name) {
          case 'awareness.set_local':
            result = await this.awarenessTools.setLocalState(args as any);
            break;

          case 'intent.start':
            result = await this.intentTools.startIntent(args as any);
            break;

          case 'intent.update':
            result = await this.intentTools.updateIntent(args as any);
            break;

          case 'intent.end':
            result = await this.intentTools.endIntent(args as any);
            break;

          case 'edits.append_summary':
            result = await this.editsTools.appendSummary(args as any);
            break;

          case 'git.commit':
            result = await this.editsTools.gitCommit(args as any);
            break;

          default:
            result = { ok: false, error: `Unknown tool: ${name}` };
        }

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        this.log('error', `Error in tool ${name}:`, error);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ ok: false, error: String(error) }),
            },
          ],
        };
      }
    });

    // List resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: [AwarenessDocResource.getMetadata()],
      };
    });

    // Read resource
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;

      if (uri === AwarenessDocResource.getUri()) {
        const snapshot = this.awarenessResource.getSnapshot();
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(snapshot, null, 2),
            },
          ],
        };
      }

      throw new Error(`Unknown resource: ${uri}`);
    });

    // List prompts
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      const catalogPath = join(__dirname, 'prompts', 'catalog.json');
      const catalog = JSON.parse(readFileSync(catalogPath, 'utf-8'));

      return {
        prompts: catalog.prompts.map((p: any) => ({
          name: p.name,
          description: p.description,
        })),
      };
    });

    // Get prompt
    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const { name } = request.params;

      const catalogPath = join(__dirname, 'prompts', 'catalog.json');
      const catalog = JSON.parse(readFileSync(catalogPath, 'utf-8'));

      const prompt = catalog.prompts.find((p: any) => p.name === name);
      if (!prompt) {
        throw new Error(`Unknown prompt: ${name}`);
      }

      const promptPath = join(__dirname, 'prompts', prompt.file);
      const content = readFileSync(promptPath, 'utf-8');

      return {
        description: prompt.description,
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: content,
            },
          },
        ],
      };
    });
  }

  private setupAwarenessUpdates() {
    // Log awareness updates
    this.yjsDoc.onAwarenessUpdate((changes, origin) => {
      this.log('debug', 'Awareness update', { changes, origin });
    });

    this.yjsDoc.onAwarenessChange((changes, origin) => {
      this.log('debug', 'Awareness change', { changes, origin });
    });
  }

  async run() {
    this.log('info', 'Starting SASP MCP Server', {
      version: '1.0.0',
      config: {
        roomId: this.config.roomId,
        logLevel: this.config.logLevel,
      },
    });

    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    this.log('info', 'SASP MCP Server running on stdio');
  }

  async cleanup() {
    this.log('info', 'Cleaning up SASP MCP Server');
    this.ttlManager.clearAll();
    this.yjsDoc.destroy();
  }
}

// Main execution
const server = new SASPServer();

process.on('SIGINT', async () => {
  await server.cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await server.cleanup();
  process.exit(0);
});

server.run().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
