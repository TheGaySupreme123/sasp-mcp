# Plan Change Prompt

You are about to make a code change. Follow these steps to ensure coordination with other agents:

## Step 1: Subscribe to Awareness
Use the `awareness.subscribe` tool to start receiving real-time updates about other agents' activities.

## Step 2: Read Current State
Use the `resources.awareness.doc` resource to get a snapshot of:
- Current awareness states of all active agents
- Active intents (what files/symbols are being edited)
- Recent edit summaries

## Step 3: Analyze for Overlaps
Check if your planned change overlaps with any active intents:
- **File overlap**: Are you targeting the same file?
- **Symbol overlap**: Are you targeting the same function/class/variable?
- **Range overlap**: Do your line ranges intersect?

## Step 4: Declare Your Intent
If no overlaps are detected:
- Use `intent.start` to declare your edit intent
- Specify the file, scope (range or symbol), reason, and planned hash
- This reserves the scope for your edit

If overlaps are detected:
- Use the `negotiate-overlap` prompt to handle the conflict
- Consider re-scoping your change to avoid the overlap
- Or defer your change and set your awareness to "planning" with a rationale

## Step 5: Set Your Awareness
Use `awareness.set_local` to broadcast your current activity:
```json
{
  "activity": "planning",
  "file": "path/to/file.ts",
  "selection": { "symbol": "functionName" },
  "rationale": "Adding error handling to improve robustness",
  "task_id": "your-task-id"
}
```

## Important Rules
- **Symbol claims supersede range claims**: If another agent has a symbol intent, your range-based intent that includes that symbol will be rejected
- **Always check for overlaps before starting**: Use the snapshot to avoid conflicts
- **Update your awareness frequently**: Let other agents know what you're doing
- **Respect TTL**: Your intent has a time-to-live (default 5 minutes). Complete your edit within this window or extend the TTL

## Next Steps
Once you have successfully started an intent, proceed with the `apply-diff` prompt to make your changes.
