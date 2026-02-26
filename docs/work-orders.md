# Work orders

A work order is a structured task definition for a Cursor Cloud Agent.

## Schema

```json
{
  "objective": "Refactor the auth module to use Supabase Auth",
  "lines": [
    {
      "id": "1",
      "title": "Replace custom JWT logic with supabase.auth.getUser()",
      "definition_of_done": "All auth calls use Supabase Auth, old JWT utils deleted"
    },
    {
      "id": "2",
      "title": "Update middleware to use Supabase session",
      "definition_of_done": "middleware.ts uses createServerClient from @supabase/ssr"
    }
  ],
  "constraints": {
    "do_not_modify": ["app/api/public/"],
    "must_use": ["@supabase/ssr", "@supabase/supabase-js"]
  },
  "exploration_hints": {
    "start_here": ["lib/auth.ts", "middleware.ts"],
    "reference": ["https://supabase.com/docs/guides/auth/server-side/nextjs"]
  },
  "verification": {
    "test_command": "npm test",
    "expected_files_changed": ["lib/auth.ts", "middleware.ts"]
  }
}
```

## Creating a work order

**Via dashboard**: Click "+ New Work Order" on the Work Orders page.

**Via API**:
```bash
curl -X POST https://your-supabase.supabase.co/rest/v1/work_orders \
  -H "apikey: your-service-role-key" \
  -H "Content-Type: application/json" \
  -d '{
    "objective": "...",
    "agent_id": "uuid",
    "repo_id": "uuid",
    "source": "cloud"
  }'
```

**Via n8n / Zapier**: Use the Supabase node to INSERT into the `work_orders` table. The DB webhook triggers the agent automatically.

## Work order sources

- `cloud` — created via dashboard, API, or job. Agent launched via Cursor API.
- `local` — auto-created when hooks skill detects a local session. No agent launch, just log capture.
- `job` — created from a scheduled job template.

## Status lifecycle

`pending` → `running` → `completed` | `failed` | `cancelled`

## Work order lines

Lines are individual work items within the work order. Each line can have:
- `title` — what to do
- `definition_of_done` — how to know it's complete

The stop hook validates lines completion and can return a `followup_message` to the agent if work remains.
