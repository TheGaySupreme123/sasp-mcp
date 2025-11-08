# Apply Diff Prompt

You have an active intent and are ready to apply your code changes. Follow these steps:

## Step 1: Monitor Awareness While Editing
Keep the `awareness.subscribe` connection active to detect if other agents:
- Declare overlapping intents (should be rejected by the server, but be aware)
- Complete related edits that might affect your work
- Update their awareness with relevant information

## Step 2: Update Your Awareness
Set your awareness to "editing" status:
```json
{
  "activity": "editing",
  "file": "path/to/file.ts",
  "selection": { "symbol": "functionName" },
  "rationale": "Implementing error handling",
  "task_id": "your-task-id"
}
```

## Step 3: Apply Your Changes
Make the code changes you planned:
- Edit the file(s) according to your intent
- Stay within the scope you declared (file, symbol, or line range)
- If you need to expand the scope, use `intent.update` first

## Step 4: Run Tests
After applying changes:
- Run relevant tests to verify your changes
- Update your awareness to "testing" status
- Note which tests you ran

## Step 5: Record Edit Summary
Use `edits.append_summary` to record what you did:
```json
{
  "file": "path/to/file.ts",
  "summary": {
    "outline": "Added error handling to functionName with try-catch",
    "affected_symbols": ["functionName", "ErrorHandler"],
    "delta_hash": "sha256-hash-of-changes",
    "tests_run": ["test/functionName.test.ts"],
    "result": "pass"
  }
}
```

## Step 6: Commit Changes (Optional)
If your changes are ready to commit:
- Use `git.commit` with your diff and commit message
- The server will return a commit hash (stub in MVP)

## Step 7: End Your Intent
Use `intent.end` to release your scope reservation:
```json
{
  "lease_id": "your-lease-id",
  "status": "ended"
}
```

## Step 8: Update Awareness to Idle
Set your awareness back to "idle" or start planning the next task:
```json
{
  "activity": "idle",
  "rationale": "Completed error handling implementation"
}
```

## Error Handling
If you encounter issues:
- **Tests fail**: Record the summary with `result: "fail"`, fix the issues, run tests again
- **Need to expand scope**: Use `intent.update` to modify your scope (will check for overlaps)
- **Taking too long**: Use `intent.update` to extend your TTL if needed
- **Must abandon**: Use `intent.end` and update awareness with rationale

## Important Notes
- Your intent has a TTL (default 5 minutes). Complete your edit within this window.
- If your intent expires, the server will automatically mark it as "expired".
- Other agents can see your edit summary immediately after you post it.
- Always end your intent when done to free the scope for others.
