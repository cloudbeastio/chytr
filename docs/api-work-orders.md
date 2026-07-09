# Work Orders API

Base URL for API: `https://<your-app>/api/v1`. All endpoints require API key auth.

**Auth:** `Authorization: Bearer <CHYTR_API_KEY>`

---

## Work order fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | uuid | Read-only. Set on create. |
| `user_id` | uuid \| null | Set by dashboard; null when created via API. |
| `agent_id` | uuid \| null | Agent to run. Required for launch. |
| `repo_id` | uuid \| null | Repo link (agent_repos). Required for launch. |
| `source` | enum | `cloud` \| `local` \| `job`. Default `cloud`. |
| `objective` | string \| null | High-level goal. |
| `status` | enum | `draft` \| `pending` \| `running` \| `completed` \| `failed` \| `cancelled`. |
| `branch_name` | string \| null | Git branch. Default from repo if null. |
| `cursor_agent_id` | string \| null | Set after launch. |
| `pr_url` | string \| null | Set by webhook on completion. |
| `summary` | string \| null | Set by webhook. |
| `error_message` | string \| null | Set on failure. |
| `parent_work_order_id` | uuid \| null | Optional parent. |
| `tokens_input`, `tokens_output`, `total_cost`, `model`, `duration_ms`, `finished_at` | — | Filled by ingest/webhook. |
| `lines` | jsonb | Array of `{ id?, title, definition_of_done? }`. |
| `constraints` | jsonb | e.g. `{ do_not_modify: [], must_use: [] }`. |
| `exploration_hints` | jsonb | e.g. `{ start_here: [], reference: [] }`. |
| `reference_patterns` | jsonb | Optional. |
| `tools` | jsonb | Optional. |
| `verification` | jsonb | e.g. `{ test_command, expected_files_changed }`. |
| `agent_config` | jsonb | Optional. |
| `environment` | jsonb | Optional. |
| `deliverables` | jsonb | Optional. |
| `metadata` | jsonb | Arbitrary. Default `{}`. |
| `created_at`, `updated_at` | timestamptz | Read-only. |

---

## POST /work-orders

Create a work order. Optionally create as **draft** (no agent launch) or **pending** (launch immediately).

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `objective` | string | one of objective/lines | High-level goal. |
| `lines` | array | one of objective/lines | Work order lines (see schema). |
| `agent_id` | uuid | no | Agent id. |
| `repo_id` | uuid | no | Repo id (agent_repos). |
| `source` | string | no | `cloud` (default) \| `local` \| `job`. |
| `status` | string | no | `draft` = create only, no launch. Omit or `pending` = create + launch. |
| `branch_name` | string | no | Git branch. |
| `lines` | jsonb | no | Same as top-level lines. |
| `constraints` | jsonb | no | Constraints object. |
| `exploration_hints` | jsonb | no | Hints object. |
| `verification` | jsonb | no | Verification object. |
| `metadata` | jsonb | no | Default `{}`. |

**Create draft (no launch):**

```json
POST /api/v1/work-orders
Authorization: Bearer <CHYTR_API_KEY>
Content-Type: application/json

{
  "objective": "Refactor auth module",
  "agent_id": "<uuid>",
  "repo_id": "<uuid>",
  "status": "draft",
  "lines": [
    { "title": "Replace JWT with Supabase Auth", "definition_of_done": "All auth uses Supabase" }
  ]
}
```

**Create and launch:**

```json
{
  "objective": "Refactor auth module",
  "agent_id": "<uuid>",
  "repo_id": "<uuid>",
  "lines": [...]
}
```

**Response (201):**

```json
{
  "ok": true,
  "chyt_id": "<uuid>",
  "status": "draft" | "pending" | "running",
  "cursor_agent_id": "<id>" | null,
  "launch_error": null | "<string>"
}
```

- If `status: "draft"`: no launch; `cursor_agent_id` and `launch_error` null.
- If not draft and `source !== "local"`: launch is attempted; `status` is `running` on success else `pending`; `launch_error` set on failure.

**Errors:** `400` (validation), `401` (invalid API key), `403` (no license), `500` (server).

---

## GET /work-orders

List work orders. Supports filters.

**Query:**

| Param | Type | Description |
|-------|------|-------------|
| `status` | string | Filter by status. |
| `source` | string | Filter by source. |
| `limit` | number | 1–200, default 50. |

**Response (200):**

```json
{
  "work_orders": [
    {
      "id": "<uuid>",
      "objective": "...",
      "status": "draft",
      "agents": { "name": "..." },
      "agent_repos": { "repo_url": "..." },
      ...
    }
  ]
}
```

---

## GET /work-orders/:id

Fetch one work order (full payload from `get_work_order` RPC: work order + repo_url, default_branch, agent name, system_prompt, default_config).

**Response (200):** Single work order object.

**Errors:** `404` (not found), `401`, `500`.

---

## PATCH /work-orders/:id

Update a work order, or approve a draft (set to pending and launch agent).

**Option A — Approve draft (launch agent):**

```json
{
  "action": "approve"
}
```

- Work order must be `status: "draft"` and `source !== "local"`.
- Sets `status` to `pending` and calls launch agent.
- **Response (200):** `{ "ok": true, "status": "running" | "pending", "cursor_agent_id": "...", "launch_error": null | "..." }`
- **Errors:** `400` (not draft / local), `404`, `401`, `500`.

**Option B — Update fields:**

Send any subset of updatable fields (no `action`):

- `objective`, `agent_id`, `repo_id`, `source`, `status`, `branch_name`
- `lines`, `constraints`, `exploration_hints`, `reference_patterns`, `tools`
- `verification`, `agent_config`, `environment`, `deliverables`, `metadata`

**Response (200):** Updated work order row.

**Errors:** `400` (no fields), `404`, `401`, `500`.

---

## Status lifecycle

- **draft** — Created, not launched. Editable. Use PATCH `action: "approve"` or set `status: "pending"` and call launch separately.
- **pending** — Approved / created non-draft; agent not yet started or launch failed.
- **running** — Agent launched and executing.
- **completed** | **failed** | **cancelled** — Terminal.

Approving a draft: PATCH with `action: "approve"` → status becomes `pending`, then launch runs → on success status becomes `running`.
