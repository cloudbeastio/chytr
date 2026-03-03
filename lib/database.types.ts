export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type LogEventType =
  | 'session_start'
  | 'tool_call'
  | 'tool_result'
  | 'tool_failure'
  | 'shell_execution'
  | 'file_edit'
  | 'mcp_execution'
  | 'skill_load'
  | 'agent_thought'
  | 'agent_response'
  | 'subagent_start'
  | 'subagent_stop'
  | 'approval_requested'
  | 'error'
  | 'session_end'
  | 'pre_compact'
  | 'stop'

export type AgentStatus = 'active' | 'idle' | 'offline' | 'error'
export type ChytStatus = 'draft' | 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
export type ChytSource = 'cloud' | 'local' | 'job'
export type ApprovalStatus = 'pending' | 'resolved' | 'expired'
export type JobRunStatus = 'pending' | 'running' | 'completed' | 'failed'
export type ProjectStatus = 'draft' | 'active' | 'paused' | 'closed'
export type ProjectType = 'one_off' | 'master' | 'retainer'

export interface Profile {
  id: string
  email: string
  created_at: string
}

export interface Chyt {
  id: string
  user_id: string | null
  project_id: string | null
  agent_id: string | null
  repo_id: string | null
  source: ChytSource
  objective: string | null
  status: ChytStatus
  branch_name: string | null
  cursor_agent_id: string | null
  pr_url: string | null
  summary: string | null
  error_message: string | null
  tokens_input: number
  tokens_output: number
  total_cost: number
  model: string | null
  duration_ms: number | null
  lines: Json | null
  constraints: Json | null
  exploration_hints: Json | null
  reference_patterns: Json | null
  tools: Json | null
  verification: Json | null
  agent_config: Json | null
  environment: Json | null
  deliverables: Json | null
  metadata: Json | null
  created_at: string
  updated_at: string
  finished_at: string | null
}

export interface Project {
  id: string
  user_id: string | null
  name: string
  description: string | null
  type: ProjectType
  status: ProjectStatus
  account_name: string | null
  account_contact: string | null
  account_email: string | null
  account_phone: string | null
  schedule_config: Json | null
  budget_limit: number | null
  is_default: boolean
  metadata: Json | null
  created_at: string
  updated_at: string
}

export interface ChytTemplate {
  id: string
  user_id: string | null
  project_id: string | null
  name: string
  description: string | null
  template: Json
  metadata: Json | null
  created_at: string
  updated_at: string
}

export interface Agent {
  id: string
  user_id: string | null
  name: string
  description: string | null
  system_prompt: string | null
  type: string | null
  default_config: Json | null
  status: AgentStatus
  last_heartbeat: string | null
  notification_config: Json | null
  created_at: string
  updated_at: string
}

export interface AgentRepo {
  id: string
  agent_id: string | null
  repo_url: string
  default_branch: string
  hooks_installed: boolean
  created_at: string
  updated_at: string
}

export interface AgentLog {
  id: string
  chyt_id: string | null
  agent_id: string | null
  event_type: LogEventType
  payload: Json
  sequence_number: number | null
  source_repo: string | null
  source_repo_name: string | null
  model: string | null
  conversation_id: string | null
  created_at: string
}

export interface Knowledge {
  id: string
  chyt_id: string | null
  agent_type: string | null
  learning: string
  embedding: number[] | null
  frequency: number
  last_seen_at: string
  created_at: string
}

export interface ScheduledJob {
  id: string
  name: string
  description: string | null
  cron_expression: string
  agent_id: string | null
  repo_id: string | null
  project_id: string | null
  work_order_template: Json
  enabled: boolean
  last_run_at: string | null
  next_run_at: string | null
  created_at: string
  updated_at: string
}

export interface JobRun {
  id: string
  job_id: string
  chyt_id: string | null
  status: JobRunStatus
  error_message: string | null
  started_at: string
  finished_at: string | null
}

export interface Approval {
  id: string
  chyt_id: string
  agent_id: string | null
  question: string
  context: Json
  options: Json
  status: ApprovalStatus
  decision: string | null
  decided_by: string | null
  decided_at: string | null
  expires_at: string | null
  created_at: string
}

export interface InstanceConfig {
  key: string
  value: string
  updated_at: string
}

export interface LicenseKey {
  id: string
  user_id: string
  key_hash: string
  key_prefix: string
  name: string
  tier: string
  activated_instance_id: string | null
  created_at: string
  revoked_at: string | null
}

export interface AgentStatRow {
  agent_id: string
  name: string
  status: AgentStatus
  last_heartbeat: string | null
  total_runs: number
  completed: number
  failed: number
  running: number
  avg_duration_ms: number | null
  total_tokens_in: number | null
  total_tokens_out: number | null
  total_cost: number | null
}

export interface ToolStatRow {
  tool_name: string
  call_count: number
  success_count: number
  failure_count: number
  avg_duration_ms: number | null
  last_used_at: string | null
}

export interface SkillStatRow {
  skill_name: string
  agent_id: string | null
  load_count: number
  last_used_at: string | null
}

export interface ProjectStatRow {
  project_id: string
  user_id: string | null
  name: string
  type: ProjectType
  status: ProjectStatus
  budget_limit: number | null
  total_chyts: number
  completed: number
  failed: number
  running: number
  pending: number
  draft: number
  cancelled: number
  total_cost: number
  total_tokens_input: number
  total_tokens_output: number
}

export interface Database {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile>; Update: Partial<Profile> }
      chyts: { Row: Chyt; Insert: Partial<Chyt>; Update: Partial<Chyt> }
      agents: { Row: Agent; Insert: Partial<Agent>; Update: Partial<Agent> }
      agent_repos: { Row: AgentRepo; Insert: Partial<AgentRepo>; Update: Partial<AgentRepo> }
      agent_logs: { Row: AgentLog; Insert: Partial<AgentLog>; Update: Partial<AgentLog> }
      knowledge: { Row: Knowledge; Insert: Partial<Knowledge>; Update: Partial<Knowledge> }
      scheduled_jobs: { Row: ScheduledJob; Insert: Partial<ScheduledJob>; Update: Partial<ScheduledJob> }
      job_runs: { Row: JobRun; Insert: Partial<JobRun>; Update: Partial<JobRun> }
      approvals: { Row: Approval; Insert: Partial<Approval>; Update: Partial<Approval> }
      instance_config: { Row: InstanceConfig; Insert: Partial<InstanceConfig>; Update: Partial<InstanceConfig> }
      license_keys: { Row: LicenseKey; Insert: Partial<LicenseKey>; Update: Partial<LicenseKey> }
      projects: { Row: Project; Insert: Partial<Project>; Update: Partial<Project> }
      chyt_templates: { Row: ChytTemplate; Insert: Partial<ChytTemplate>; Update: Partial<ChytTemplate> }
    }
    Views: {
      agent_stats: { Row: AgentStatRow }
      tool_stats: { Row: ToolStatRow }
      skill_stats: { Row: SkillStatRow }
      project_stats: { Row: ProjectStatRow }
    }
    Functions: {
      get_chyt: {
        Args: { p_chyt_id: string }
        Returns: Chyt & {
          repo_url: string
          default_branch: string
          agent_name: string | null
          system_prompt: string | null
          default_config: Json | null
          project_id: string | null
          project_name: string | null
          project_type: ProjectType | null
          project_status: ProjectStatus | null
          project_account_name: string | null
        }
      }
      match_knowledge: {
        Args: { query_embedding: number[]; match_threshold: number; match_count: number; p_agent_type?: string }
        Returns: Array<{ id: string; learning: string; frequency: number; last_seen_at: string; similarity: number }>
      }
      upsert_knowledge: {
        Args: { p_learning: string; p_embedding: number[]; p_chyt_id?: string; p_agent_type?: string; p_similarity_threshold?: number; p_user_id?: string }
        Returns: string
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
