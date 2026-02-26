create table agent_repos (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references agents(id) on delete set null,
  repo_url text not null,
  default_branch text default 'main',
  hooks_installed boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(repo_url)
);
create index idx_agent_repos_agent on agent_repos(agent_id);
create trigger update_agent_repos_updated_at
  before update on agent_repos
  for each row execute function update_updated_at_column();
