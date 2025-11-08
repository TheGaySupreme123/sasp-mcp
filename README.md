# SASP - Shared Agent State Protocol

**v0.1.0** - _A vibe-coded MCP server for AI agents who need to learn to share_

> "Too many coders, one codebase" - The eternal struggle, now with 100% more AI

An MCP (Model Context Protocol) server that provides edit-awareness and intent coordination for coding agents using Yjs. Built with vibes, for vibes, by vibes.

## What's This About?

Look, we get it. You've got Claude over here trying to refactor `UserService.authenticate()`, and Claude's cousin is simultaneously adding OAuth to the same function. Chaos ensues. Merge conflicts rain from the sky. Your git history looks like a crime scene.

**SASP** is here to teach these AI agents some manners. Think of it as a really passive-aggressive "OCCUPIED" sign for your code, but with more CRDTs and less bathroom humor.

## Overview

SASP enables multiple AI coding agents to coordinate their edits in real-time by:
- 📢 **Broadcasting awareness states** - "Hey everyone, I'm editing UserService.authenticate, don't @ me"
- 🎫 **Declaring edit intents** - Reserve your scope like a beach towel on a hotel chair
- 🚨 **Detecting overlaps** - "Excuse me, I called dibs on that function"
- 📝 **Recording summaries** - Document your chaos for posterity
- 🎸 **Keeping Git real** - Because at the end of the day, Git is still the source of truth

## Features

- **Real-time Awareness**: Agents broadcast their current activity, file, selection, and rationale
- **Intent Management**: Reserve edit scopes with TTL-based leases
- **Overlap Detection**: Automatic detection of conflicting edits (symbol > range precedence)
- **Edit Summaries**: Track what changed, which tests ran, and outcomes
- **MCP Integration**: Full support for MCP tools, resources, and prompts
- **Yjs-backed**: Leverages Yjs for CRDT-based state synchronization

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    MCP Server (stdio)                    │
├─────────────────────────────────────────────────────────┤
│  Tools:                                                  │
│   - awareness.set_local                                  │
│   - intent.start / update / end                          │
│   - edits.append_summary                                 │
│   - git.commit (stub)                                    │
├─────────────────────────────────────────────────────────┤
│  Resources:                                              │
│   - resources.awareness.doc (snapshot)                   │
├─────────────────────────────────────────────────────────┤
│  Prompts:                                                │
│   - plan-change                                          │
│   - apply-diff                                           │
│   - negotiate-overlap                                    │
├─────────────────────────────────────────────────────────┤
│  Core Components:                                        │
│   - Yjs Document (intents, summaries, awareness)        │
│   - Overlap Detector (symbol > range precedence)        │
│   - TTL Manager (intent expiration)                     │
│   - Auth Validator (bearer token + session)             │
└─────────────────────────────────────────────────────────┘
```

## Installation

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Run demo
npm run demo
```

## Quick Start

### 1. Start the MCP Server

```bash
# Via npm
npm start

# Or directly with node
node dist/index.js
```

The server runs on stdio and can be integrated with any MCP-compatible host.

### 2. Configuration

Set environment variables to configure the server:

```bash
# Authentication token (required)
export SASP_AUTH_TOKEN="your-secret-token"

# Room ID for Yjs sync (optional)
export SASP_ROOM_ID="my-team-room"

# Log level (optional)
export SASP_LOG_LEVEL="info"  # debug | info | warn | error
```

### 3. Register with MCP Hosts

#### VS Code

Add to your VS Code settings:

```json
{
  "mcp.servers": {
    "sasp": {
      "command": "node",
      "args": ["/path/to/sasp/dist/index.js"],
      "env": {
        "SASP_AUTH_TOKEN": "your-secret-token"
      }
    }
  }
}
```

#### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "sasp": {
      "command": "node",
      "args": ["/path/to/sasp/dist/index.js"],
      "env": {
        "SASP_AUTH_TOKEN": "your-secret-token"
      }
    }
  }
}
```

## Usage

### Awareness Management

Set your agent's awareness state to broadcast what you're doing:

```typescript
// Tool: awareness.set_local
{
  "agent_id": "agent-alpha",
  "session_id": "session-001",
  "token": "your-secret-token",
  "state": {
    "agent_id": "agent-alpha",
    "session_id": "session-001",
    "activity": "editing",  // planning | editing | testing | idle
    "file": "src/UserService.ts",
    "selection": { "symbol": "UserService.authenticate" },
    "rationale": "Adding OAuth support",
    "task_id": "TASK-123"
  }
}
```

### Intent Management

#### Start an Intent

Reserve a scope before editing:

```typescript
// Tool: intent.start
{
  "agent_id": "agent-alpha",
  "session_id": "session-001",
  "token": "your-secret-token",
  "file": "src/UserService.ts",
  "scope": {
    "symbol": "UserService.authenticate"  // or "range": { startLine: 10, endLine: 20 }
  },
  "reason": "Adding OAuth support",
  "planned_delta_hash": "sha256-abc123",
  "ttl_ms": 300000  // 5 minutes (optional)
}

// Response:
{
  "ok": true,
  "lease_id": "uuid-lease-id"
}

// Or if overlap detected:
{
  "ok": false,
  "error": "Intent overlaps with existing active intent",
  "conflict": {
    "conflicting_lease_id": "other-lease-id",
    "reason": "Symbol 'UserService.authenticate' is already being edited by agent-beta"
  }
}
```

#### Update an Intent

Modify scope, reason, or extend TTL:

```typescript
// Tool: intent.update
{
  "agent_id": "agent-alpha",
  "session_id": "session-001",
  "token": "your-secret-token",
  "lease_id": "uuid-lease-id",
  "fields": {
    "scope": { "symbol": "UserService.authenticateWithOAuth" },
    "reason": "Expanded to include new OAuth method",
    "ttl_ms": 600000  // Extend to 10 minutes
  }
}
```

#### End an Intent

Release the scope when done:

```typescript
// Tool: intent.end
{
  "agent_id": "agent-alpha",
  "session_id": "session-001",
  "token": "your-secret-token",
  "lease_id": "uuid-lease-id",
  "status": "ended"  // or "expired"
}
```

### Edit Summaries

Record what you changed:

```typescript
// Tool: edits.append_summary
{
  "agent_id": "agent-alpha",
  "session_id": "session-001",
  "token": "your-secret-token",
  "file": "src/UserService.ts",
  "summary": {
    "outline": "Added OAuth 2.0 authentication flow",
    "affected_symbols": ["UserService.authenticate", "OAuthProvider"],
    "delta_hash": "sha256-abc123",
    "tests_run": ["test/auth.test.ts"],
    "result": "pass"  // or "fail"
  }
}
```

### Get Snapshot

Read the current state:

```typescript
// Resource: resources.awareness.doc
{
  "uri": "sasp://awareness/doc"
}

// Response:
{
  "awareness_states": {
    "12345": {
      "agent_id": "agent-alpha",
      "activity": "editing",
      "file": "src/UserService.ts",
      // ...
    }
  },
  "intents": {
    "lease-uuid": {
      "lease_id": "lease-uuid",
      "agent_id": "agent-alpha",
      "file": "src/UserService.ts",
      "status": "active",
      // ...
    }
  },
  "summaries_index": {
    "src/UserService.ts": [
      {
        "agent_id": "agent-alpha",
        "outline": "Added OAuth support",
        // ...
      }
    ]
  }
}
```

## Prompts

SASP includes three prompts to guide agents:

### 1. plan-change

Guides agents to:
1. Subscribe to awareness
2. Read current snapshot
3. Detect overlaps
4. Declare intent or negotiate

```bash
# List prompts
curl -X POST http://localhost:3000/prompts/list

# Get prompt
curl -X POST http://localhost:3000/prompts/get -d '{"name": "plan-change"}'
```

### 2. apply-diff

Guides agents through:
1. Monitoring awareness while editing
2. Updating awareness to "editing"
3. Running tests
4. Recording summary
5. Ending intent

### 3. negotiate-overlap

Strategies for resolving conflicts:
1. Defer and wait
2. Re-scope the change
3. Coordinate via awareness
4. Split the work

## Overlap Rules

SASP enforces these overlap detection rules:

1. **Same symbol**: Always conflicts
2. **Symbol vs Range**: Symbol claims supersede range claims
3. **Range vs Range**: Conflicts if ranges intersect (including adjacent lines)
4. **Different files**: Never conflict
5. **Status**: Only "active" intents block; "ended" and "expired" don't

### Examples

```typescript
// CONFLICT: Same symbol
Agent A: { symbol: "MyFunction" }
Agent B: { symbol: "MyFunction" }  ❌

// CONFLICT: Symbol supersedes range
Agent A: { range: { startLine: 10, endLine: 20 } }
Agent B: { symbol: "MyFunction" }  ❌ (if MyFunction is in that range)

// CONFLICT: Overlapping ranges
Agent A: { range: { startLine: 10, endLine: 20 } }
Agent B: { range: { startLine: 15, endLine: 25 } }  ❌

// OK: Different symbols
Agent A: { symbol: "FunctionA" }
Agent B: { symbol: "FunctionB" }  ✓

// OK: Non-overlapping ranges
Agent A: { range: { startLine: 10, endLine: 20 } }
Agent B: { range: { startLine: 21, endLine: 30 } }  ✓

// OK: Different files
Agent A: { file: "A.ts", symbol: "MyFunction" }
Agent B: { file: "B.ts", symbol: "MyFunction" }  ✓
```

## Demo

Run the included demo to see two agents coordinating:

```bash
# Build first
npm run build

# Run demo
npm run demo
```

The demo shows:
1. Agent A starts intent for `UserService.authenticate()`
2. Agent B tries same symbol → rejected (overlap)
3. Agent B waits via awareness
4. Agent A completes and ends intent
5. Agent B successfully starts intent
6. Agent B completes edit

## Testing

```bash
# Run all tests
npm test

# Run specific test suite
npm test unit_overlap
npm test unit_ttl
npm test integ_two_agents

# Watch mode
npm run test:watch
```

Tests cover:
- ✅ Overlap detection (symbol, range, precedence)
- ✅ TTL expiration and timer management
- ✅ Two-agent coordination flows
- ✅ Awareness propagation
- ✅ Intent updates and validation

## Project Structure

```
sasp/
├── server/
│   └── src/
│       ├── index.ts              # MCP server entrypoint
│       ├── config.ts             # Configuration
│       ├── types.ts              # TypeScript types
│       ├── core/
│       │   ├── auth.ts           # Authentication
│       │   ├── overlap.ts        # Overlap detection
│       │   └── ttl.ts            # TTL management
│       ├── yjs/
│       │   └── doc.ts            # Yjs document layer
│       ├── mcp/
│       │   └── tools/
│       │       ├── awareness.ts  # Awareness tools
│       │       ├── intent.ts     # Intent tools
│       │       └── edits.ts      # Edit & git tools
│       ├── resources/
│       │   └── awareness_doc.ts  # Snapshot resource
│       └── prompts/
│           ├── catalog.json
│           ├── plan-change.md
│           ├── apply-diff.md
│           └── negotiate-overlap.md
├── client-demo/
│   └── cli.ts                    # Demo client
├── tests/
│   ├── unit_overlap.test.ts
│   ├── unit_ttl.test.ts
│   └── integ_two_agents.test.ts
├── package.json
├── tsconfig.json
└── README.md
```

## Security

- **Bearer Token**: All tools require a valid authentication token
- **Session Validation**: agent_id and session_id must be registered
- **Ownership**: Agents can only update/end their own intents
- **TTL Enforcement**: Stale intents automatically expire

## Performance

- **Awareness Latency**: ~50-200ms end-to-end for updates
- **Intent Validation**: Overlap checks are O(n) where n = active intents
- **Yjs Sync**: In-memory CRDT with optional WebSocket replication

## Vibe Check

This is **v0.1.0** - a vibe-coded MVP built by AI agents, for AI agents. It's tongue-in-cheek, it's experimental, and it's probably got bugs. But it works, and it solves a real problem: coordinating multiple AI coding agents without turning your codebase into a dumpster fire.

**For vibe coders everywhere**: This is proof that you can ship something useful even when you're just vibing. No fancy planning, no enterprise architecture diagrams, just pure "let's solve this problem right now" energy. If you're building with AI agents and need them to stop stepping on each other's toes, give it a try.

## Limitations (MVP - We're Honest About It)

- `git.commit` is a stub (no actual git integration yet - we're saving that for 0.2)
- No LSP integration for symbol indexing (you have to know your symbol names)
- No WebSocket provider enabled by default (single instance only)
- No persistent storage (state lost on restart - it's all vibes, no commitments)

## Roadmap

- [ ] Real git integration with commit hooks
- [ ] LSP-based symbol resolution
- [ ] Multi-server sync via y-websocket
- [ ] Persistent storage with Yjs snapshots
- [ ] Per-branch room isolation
- [ ] Signed intents and audit logs
- [ ] GitHub integration (PR comments, checks)

## Contributing

Vibe coders welcome! This project was built in the spirit of "ship it and see what happens," so don't be shy:

1. Fork the repository (or don't, just send vibes)
2. Create a feature branch (or work directly on main if you're feeling spicy)
3. Add tests for new functionality (we actually do believe in tests, surprisingly)
4. Ensure all tests pass (`npm test`)
5. Submit a pull request with good vibes only

**House rules**: Keep it real, keep it fun, and remember that merge conflicts are solved with communication, not combat.

## License

MIT License - see LICENSE file for details

## Support

- Issues: https://github.com/yourusername/sasp/issues
- Documentation: https://github.com/yourusername/sasp/wiki

## Acknowledgments

- Built with [MCP SDK](https://github.com/modelcontextprotocol/sdk)
- State sync via [Yjs](https://github.com/yjs/yjs)
- Inspired by operational transformation and CRDT research
