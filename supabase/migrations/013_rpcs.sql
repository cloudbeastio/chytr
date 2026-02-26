create or replace function get_work_order(p_work_order_id uuid)
returns jsonb as $$
declare
  v_result jsonb;
begin
  select row_to_json(t)::jsonb into v_result
  from (
    select
      wo.*,
      ar.repo_url,
      ar.default_branch,
      a.name as agent_name,
      a.system_prompt,
      a.default_config
    from work_orders wo
    left join agent_repos ar on ar.id = wo.repo_id
    left join agents a on a.id = wo.agent_id
    where wo.id = p_work_order_id
  ) t;
  return v_result;
end;
$$ language plpgsql security definer;

create or replace function match_knowledge(
  query_embedding vector(384),
  match_threshold float default 0.7,
  match_count int default 5,
  p_agent_type text default null
)
returns table (
  id uuid,
  learning text,
  frequency int,
  last_seen_at timestamptz,
  similarity float
) as $$
begin
  return query
  select
    k.id,
    k.learning,
    k.frequency,
    k.last_seen_at,
    1 - (k.embedding <=> query_embedding) as similarity
  from knowledge k
  where
    (p_agent_type is null or k.agent_type = p_agent_type)
    and k.embedding is not null
    and 1 - (k.embedding <=> query_embedding) > match_threshold
  order by k.embedding <=> query_embedding
  limit match_count;
end;
$$ language plpgsql;

create or replace function upsert_knowledge(
  p_learning text,
  p_embedding vector(384),
  p_work_order_id uuid default null,
  p_agent_type text default null,
  p_similarity_threshold float default 0.92
)
returns uuid as $$
declare
  v_existing_id uuid;
  v_result_id uuid;
begin
  -- Check for near-duplicate
  select id into v_existing_id
  from knowledge
  where embedding is not null
    and 1 - (embedding <=> p_embedding) > p_similarity_threshold
  order by embedding <=> p_embedding
  limit 1;

  if v_existing_id is not null then
    -- Update frequency and recency
    update knowledge
    set frequency = frequency + 1,
        last_seen_at = now()
    where id = v_existing_id;
    return v_existing_id;
  else
    -- Insert new
    insert into knowledge (learning, embedding, work_order_id, agent_type)
    values (p_learning, p_embedding, p_work_order_id, p_agent_type)
    returning id into v_result_id;
    return v_result_id;
  end if;
end;
$$ language plpgsql;
