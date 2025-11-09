# Negotiate Overlap Prompt

You've detected an overlap with another agent's active intent. Follow these strategies to resolve the conflict:

## Understanding the Overlap
First, understand what type of overlap you have:

### 1. Symbol Overlap (Highest Priority)
Both you and another agent want to edit the same function/class/variable.
- **Symbol claims supersede range claims**
- The agent who claimed the symbol first has priority

### 2. Range Overlap
Your line ranges intersect with another agent's claimed range.
- Check if the other agent has a symbol claim within that range (they have priority)
- Check if you can narrow your range to avoid the overlap

### 3. File-Level Conflict
You're both editing the same file but different parts.
- This is usually fine unless the ranges/symbols overlap
- Use awareness to coordinate timing

## Resolution Strategies

### Strategy 1: Defer and Wait
The simplest approach - let the other agent finish first:

1. **Check the other agent's TTL**: Look at their intent's `started_at` and `ttl_ms`
   - If they're almost done (< 1 minute remaining), wait

2. **Set your awareness** to indicate you're waiting:
```json
{
  "activity": "planning",
  "file": "path/to/file.ts",
  "selection": { "symbol": "functionName" },
  "rationale": "Waiting for agent_xyz to complete their edit of functionName",
  "task_id": "your-task-id"
}
```

3. **Poll the awareness snapshot**: Regularly check `resources.awareness.doc` for changes to their intent status (e.g., watch for their lease_id to end or expire)

4. **Start your intent** once theirs ends

### Strategy 2: Re-scope Your Change
Modify your plan to avoid the overlap:

1. **Analyze dependencies**: Can you edit a different but related area?
   - Tests instead of implementation
   - Documentation instead of code
   - Helper functions instead of main function
   - Different file in the same module

2. **Update your intent scope** (if you already started one):
```json
{
  "lease_id": "your-lease-id",
  "fields": {
    "scope": { "symbol": "helperFunction" },
    "reason": "Re-scoped to avoid overlap with agent_xyz"
  }
}
```

3. **Set awareness** to indicate the change:
```json
{
  "activity": "planning",
  "rationale": "Re-scoped to edit tests while agent_xyz edits implementation"
}
```

### Strategy 3: Coordinate via Awareness
Communicate your intent through awareness and negotiate:

1. **Set detailed awareness** explaining your needs:
```json
{
  "activity": "planning",
  "file": "path/to/file.ts",
  "selection": { "symbol": "functionName" },
  "rationale": "Need to refactor functionName for performance - can wait 5 min or work on related helpers first",
  "task_id": "your-task-id"
}
```

2. **Monitor the other agent's awareness**: They might see your message and:
   - Finish faster
   - Update their rationale with timing info
   - Coordinate with you on splitting the work

### Strategy 4: Split the Work
For large changes, coordinate to split the work:

1. **Identify independent sub-tasks**:
   - You: Refactor internal logic
   - Them: Update API interface

2. **Each agent takes a non-overlapping scope**:
   - You: Start intent for internal helper functions
   - Them: Keep intent for main function signature

3. **Update awareness** with the coordination plan:
```json
{
  "activity": "editing",
  "rationale": "Working on internal helpers while agent_xyz updates API interface"
}
```

## Overlap Rules Reminder

1. **Symbol > Range**: Symbol-based intents have priority over range-based intents
2. **First Come, First Served**: The agent who started their intent first has priority
3. **Active Status**: Only "active" intents block new intents; "ended" and "expired" don't

## Escalation
If you cannot resolve the overlap:
- Set your awareness with a clear rationale explaining the blocker
- Consider working on a completely different task
- The TTL will eventually expire the blocking intent (default 5 minutes)

## Example Workflow

```
1. You try to start intent for "UserService.authenticate()"
2. Server rejects: agent_abc has active intent on same symbol
3. You check their intent: started 3 minutes ago, TTL 5 minutes
4. You check their awareness: activity="editing", rationale="Adding OAuth support"
5. Decision: Wait 2 minutes for them to finish
6. You set awareness: activity="planning", rationale="Waiting for OAuth changes to complete before adding rate limiting"
7. You periodically poll the awareness snapshot
8. 1 minute later: you observe their intent marked as ended
9. You start your intent successfully
10. You proceed with your changes
```

## Best Practices
- **Be specific in rationales**: Help other agents understand your plans
- **Update awareness frequently**: Keep others informed of your progress
- **Respect TTLs**: Don't start long-running changes without sufficient TTL
- **Prefer coordination over conflict**: Work together when possible
