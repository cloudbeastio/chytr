# Knowledge loop

chytr maintains a vector knowledge base that grows with every agent run. Future agents automatically receive relevant context from past runs.

## How it works

```
Agent completes work order
  → agent-complete Edge Function fires
  → Extracts learnings from session logs
  → Calls embed Edge Function (gte-small, 384d)
  → upsert_knowledge RPC: similarity check (0.92 threshold)
    → Near-duplicate found: increment frequency, update last_seen_at
    → No match: insert new knowledge entry
  
Next agent session starts
  → chytr-session.sh fires SessionStart hook
  → Calls query-knowledge with work order objective
  → match_knowledge RPC returns top-5 similar entries
  → Injected as additional_context into agent session
```

## Deduplication

Before inserting a new learning, `upsert_knowledge` does a cosine similarity search with a 0.92 threshold. If a near-duplicate exists, the existing entry's frequency is incremented rather than creating a duplicate. This keeps the knowledge base clean and ranks frequently-reinforced learnings higher.

## Knowledge entry format

Each entry stores:
- `learning` — the raw learning text
- `embedding` — 384-dim vector from gte-small
- `frequency` — how many times this learning has been reinforced
- `last_seen_at` — when it was last reinforced
- `agent_type` — which type of agent generated it (for scoped queries)
- `work_order_id` — source work order link

## Tier limits

| Tier | Max entries |
|---|---|
| Free | 500 |
| Pro | 5,000 |
| Team | 25,000 |

The `embed` Edge Function checks the entry count against your license limit before inserting. If the limit is reached, the insert is rejected and the dashboard shows an upgrade CTA.

## Searching knowledge

**Dashboard**: The Knowledge page has a semantic search bar.

**API**:
```bash
curl -X POST https://your-supabase.supabase.co/functions/v1/query-knowledge \
  -H "Authorization: Bearer your-service-role-key" \
  -H "Content-Type: application/json" \
  -d '{"query": "how do we handle Supabase auth in middleware", "match_count": 5}'
```

Returns an array of matching entries with similarity scores, plus a `formatted` string for direct injection into prompts.
