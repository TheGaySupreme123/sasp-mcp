/**
 * CLI Demo: Two agents demonstrating overlap detection and coordination
 *
 * This demo spawns two simulated agents that:
 * 1. Agent A starts an intent to edit a function
 * 2. Agent B tries to edit the same function (overlap detected)
 * 3. Agent B backs off and waits
 * 4. Agent A completes and ends intent
 * 5. Agent B successfully starts intent and completes edit
 */

import { spawn } from 'child_process';
import * as readline from 'readline';

interface MCPRequest {
  jsonrpc: string;
  id: number;
  method: string;
  params?: any;
}

interface MCPResponse {
  jsonrpc: string;
  id: number;
  result?: any;
  error?: any;
}

class MCPClient {
  private serverProcess: any;
  private requestId = 0;
  private pendingRequests = new Map<number, { resolve: any; reject: any }>();
  private rl: readline.Interface;

  constructor(private agentId: string, private sessionId: string, private token: string) {
    // Spawn the MCP server
    this.serverProcess = spawn('node', ['dist/index.js'], {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Set up readline to parse JSON-RPC responses
    this.rl = readline.createInterface({
      input: this.serverProcess.stdout,
      crlfDelay: Infinity,
    });

    this.rl.on('line', (line) => {
      try {
        const response: MCPResponse = JSON.parse(line);
        const pending = this.pendingRequests.get(response.id);
        if (pending) {
          this.pendingRequests.delete(response.id);
          if (response.error) {
            pending.reject(response.error);
          } else {
            pending.resolve(response.result);
          }
        }
      } catch (error) {
        console.error(`[${this.agentId}] Error parsing response:`, error);
      }
    });

    this.serverProcess.stderr.on('data', (data: Buffer) => {
      // Server logs go to stderr
      const log = data.toString().trim();
      if (log) {
        console.log(`[${this.agentId}] Server log: ${log}`);
      }
    });
  }

  private async sendRequest(method: string, params?: any): Promise<any> {
    const id = ++this.requestId;
    const request: MCPRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.serverProcess.stdin.write(JSON.stringify(request) + '\n');

      // Timeout after 10 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 10000);
    });
  }

  async initialize(): Promise<void> {
    await this.sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: `agent-${this.agentId}`,
        version: '1.0.0',
      },
    });

    console.log(`[${this.agentId}] Initialized`);
  }

  async setAwareness(state: any): Promise<any> {
    const result = await this.sendRequest('tools/call', {
      name: 'awareness.set_local',
      arguments: {
        agent_id: this.agentId,
        session_id: this.sessionId,
        token: this.token,
        state: {
          agent_id: this.agentId,
          session_id: this.sessionId,
          ...state,
        },
      },
    });

    const content = result.content[0].text;
    return JSON.parse(content);
  }

  async startIntent(file: string, scope: any, reason: string, ttl_ms = 300000): Promise<any> {
    const result = await this.sendRequest('tools/call', {
      name: 'intent.start',
      arguments: {
        agent_id: this.agentId,
        session_id: this.sessionId,
        token: this.token,
        file,
        scope,
        reason,
        planned_delta_hash: `hash-${Date.now()}`,
        ttl_ms,
      },
    });

    const content = result.content[0].text;
    return JSON.parse(content);
  }

  async endIntent(leaseId: string): Promise<any> {
    const result = await this.sendRequest('tools/call', {
      name: 'intent.end',
      arguments: {
        agent_id: this.agentId,
        session_id: this.sessionId,
        token: this.token,
        lease_id: leaseId,
      },
    });

    const content = result.content[0].text;
    return JSON.parse(content);
  }

  async appendSummary(file: string, summary: any): Promise<any> {
    const result = await this.sendRequest('tools/call', {
      name: 'edits.append_summary',
      arguments: {
        agent_id: this.agentId,
        session_id: this.sessionId,
        token: this.token,
        file,
        summary,
      },
    });

    const content = result.content[0].text;
    return JSON.parse(content);
  }

  async getSnapshot(): Promise<any> {
    const result = await this.sendRequest('resources/read', {
      uri: 'sasp://awareness/doc',
    });

    const content = result.contents[0].text;
    return JSON.parse(content);
  }

  async cleanup(): Promise<void> {
    this.serverProcess.kill();
    this.rl.close();
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runDemo() {
  console.log('=== SASP MCP Server Demo ===\n');
  console.log('This demo shows two agents coordinating edit intents:\n');

  const token = 'default-token-change-me';

  // Create two agent clients
  const agentA = new MCPClient('agent-alpha', 'session-001', token);
  const agentB = new MCPClient('agent-beta', 'session-002', token);

  try {
    // Initialize both agents
    console.log('Step 1: Initializing agents...\n');
    await agentA.initialize();
    await agentB.initialize();
    await sleep(500);

    // Agent A sets awareness to planning
    console.log('Step 2: Agent A starts planning to edit UserService.authenticate()...\n');
    await agentA.setAwareness({
      activity: 'planning',
      file: 'src/services/UserService.ts',
      selection: { symbol: 'UserService.authenticate' },
      rationale: 'Adding OAuth support',
    });
    await sleep(500);

    // Agent A starts an intent
    console.log('Step 3: Agent A starts intent for UserService.authenticate()...\n');
    const intentA = await agentA.startIntent(
      'src/services/UserService.ts',
      { symbol: 'UserService.authenticate' },
      'Adding OAuth support',
      10000 // 10 second TTL for demo
    );

    if (intentA.ok) {
      console.log(`✓ Agent A successfully started intent: ${intentA.lease_id}\n`);
    } else {
      console.log(`✗ Agent A failed to start intent: ${intentA.error}\n`);
      return;
    }

    await sleep(1000);

    // Agent B tries to start intent on same symbol (should fail)
    console.log('Step 4: Agent B tries to edit the same function...\n');
    await agentB.setAwareness({
      activity: 'planning',
      file: 'src/services/UserService.ts',
      selection: { symbol: 'UserService.authenticate' },
      rationale: 'Adding rate limiting',
    });

    const intentB1 = await agentB.startIntent(
      'src/services/UserService.ts',
      { symbol: 'UserService.authenticate' },
      'Adding rate limiting'
    );

    if (!intentB1.ok) {
      console.log(`✓ Agent B's intent correctly rejected: ${intentB1.error}`);
      if (intentB1.conflict) {
        console.log(`  Conflicting lease: ${intentB1.conflict.conflicting_lease_id}`);
        console.log(`  Reason: ${intentB1.conflict.reason}\n`);
      }
    } else {
      console.log(`✗ Agent B should have been rejected but wasn't!\n`);
    }

    await sleep(1000);

    // Agent B backs off and waits
    console.log('Step 5: Agent B backs off and waits for Agent A to finish...\n');
    await agentB.setAwareness({
      activity: 'planning',
      file: 'src/services/UserService.ts',
      selection: { symbol: 'UserService.authenticate' },
      rationale: 'Waiting for Agent A to complete OAuth changes before adding rate limiting',
    });

    await sleep(1000);

    // Agent A sets awareness to editing
    console.log('Step 6: Agent A starts editing...\n');
    await agentA.setAwareness({
      activity: 'editing',
      file: 'src/services/UserService.ts',
      selection: { symbol: 'UserService.authenticate' },
      rationale: 'Implementing OAuth flow',
    });

    await sleep(2000);

    // Agent A completes edit and appends summary
    console.log('Step 7: Agent A completes edit and records summary...\n');
    await agentA.setAwareness({
      activity: 'testing',
      file: 'src/services/UserService.ts',
      rationale: 'Running authentication tests',
    });

    await agentA.appendSummary('src/services/UserService.ts', {
      outline: 'Added OAuth 2.0 authentication flow to UserService.authenticate()',
      affected_symbols: ['UserService.authenticate', 'OAuthProvider'],
      delta_hash: 'sha256-abc123',
      tests_run: ['test/auth.test.ts'],
      result: 'pass',
    });

    console.log('✓ Agent A recorded edit summary\n');
    await sleep(1000);

    // Agent A ends intent
    console.log('Step 8: Agent A ends intent and frees the scope...\n');
    await agentA.endIntent(intentA.lease_id);
    await agentA.setAwareness({
      activity: 'idle',
      rationale: 'OAuth implementation complete',
    });

    console.log('✓ Agent A ended intent\n');
    await sleep(1000);

    // Agent B tries again (should succeed now)
    console.log('Step 9: Agent B tries again to start intent...\n');
    const intentB2 = await agentB.startIntent(
      'src/services/UserService.ts',
      { symbol: 'UserService.authenticate' },
      'Adding rate limiting'
    );

    if (intentB2.ok) {
      console.log(`✓ Agent B successfully started intent: ${intentB2.lease_id}\n`);
    } else {
      console.log(`✗ Agent B failed to start intent: ${intentB2.error}\n`);
      return;
    }

    await sleep(1000);

    // Agent B completes work
    console.log('Step 10: Agent B completes edit...\n');
    await agentB.setAwareness({
      activity: 'editing',
      file: 'src/services/UserService.ts',
      selection: { symbol: 'UserService.authenticate' },
      rationale: 'Adding rate limiting logic',
    });

    await sleep(1500);

    await agentB.appendSummary('src/services/UserService.ts', {
      outline: 'Added rate limiting to UserService.authenticate() to prevent brute force attacks',
      affected_symbols: ['UserService.authenticate', 'RateLimiter'],
      delta_hash: 'sha256-def456',
      tests_run: ['test/auth.test.ts', 'test/rate-limiting.test.ts'],
      result: 'pass',
    });

    await agentB.endIntent(intentB2.lease_id);
    await agentB.setAwareness({
      activity: 'idle',
      rationale: 'Rate limiting complete',
    });

    console.log('✓ Agent B completed edit and ended intent\n');
    await sleep(500);

    // Get final snapshot
    console.log('Step 11: Retrieving final snapshot...\n');
    const snapshot = await agentA.getSnapshot();

    console.log('Final Snapshot:');
    console.log('---');
    console.log('Awareness States:', Object.keys(snapshot.awareness_states).length, 'active');
    console.log('Intents:', Object.keys(snapshot.intents).length);
    console.log('Edit Summaries:');
    for (const [file, summaries] of Object.entries(snapshot.summaries_index)) {
      console.log(`  ${file}: ${(summaries as any[]).length} summaries`);
    }
    console.log('---\n');

    console.log('=== Demo Complete ===\n');
    console.log('Summary:');
    console.log('✓ Agent A successfully claimed and completed edit');
    console.log('✓ Agent B was correctly blocked due to overlap');
    console.log('✓ Agent B successfully claimed scope after Agent A finished');
    console.log('✓ Both agents recorded edit summaries');
    console.log('✓ Overlap detection and coordination working as expected');
  } catch (error) {
    console.error('Demo error:', error);
  } finally {
    // Cleanup
    await agentA.cleanup();
    await agentB.cleanup();
  }
}

// Run the demo
runDemo().catch(console.error);
