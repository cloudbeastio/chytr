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

**Via dashboard**: Create from Work Orders → New Work Order (saved as **draft**). Edit as needed, then **Approve** to submit to the launch agent API.

**Via API**: See [Work Orders API](api-work-orders.md) for full reference. Use `POST /api/v1/work-orders` with `Authorization: Bearer <CHYTR_API_KEY>`. Send `status: "draft"` to create without launching; omit or use `pending` to create and launch.

**Via n8n / Zapier**: Use the Supabase node to INSERT into the `work_orders` table, or call `POST /api/v1/work-orders` with your API key.

## Work order sources

- `cloud` — created via dashboard, API, or job. Agent launched via Cursor API when approved/non-draft.
- `local` — auto-created when hooks skill detects a local session. No agent launch, just log capture.
- `job` — created from a scheduled job template.

## Status lifecycle

- **draft** — Created from UI or API with `status: "draft"`. Not launched. Approve to move to pending and launch.
- **pending** → **running** → **completed** | **failed** | **cancelled**

## Work order lines

Lines are individual work items within the work order. Each line can have:
- `title` — what to do
- `definition_of_done` — how to know it's complete

The stop hook validates lines completion and can return a `followup_message` to the agent if work remains.
