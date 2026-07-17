export type AgentStatus = "active" | "thinking" | "idle" | "error" | "offline";

export interface AgentSkill {
  id: string;
  skill: string;
  proficiency: number;
  times_used: number;
  last_used?: string;
}

export interface WorkLogEntry {
  id: string;
  task_type: string;
  task_input: Record<string, unknown>;
  result?: string;
  reflection?: string;
  success: boolean;
  tokens_used: number;
  duration_ms?: number;
  started_at: string;
  finished_at?: string;
}

export interface AgentComm {
  id: string;
  from_agent_id?: string;
  from_agent_name?: string;
  to_agent_id?: string;
  to_agent_name?: string;
  message: string;
  message_type: "message" | "task" | "result" | "human_message" | "human_reply";
  metadata_?: Record<string, unknown>;
  created_at: string;
  read: boolean;
}

export interface AgentCard {
  name: string;
  description: string;
  url: string;
  version: string;
  capabilities: { streaming: boolean; pushNotifications: boolean };
  skills: { id: string; name: string; description: string }[];
  metadata: { department: string; title: string; model: string; status: string };
}

export interface Agent {
  id: string;
  name: string;
  title: string;
  department: string;
  bio?: string;
  avatar_seed: string;
  avatar_url?: string | null;
  company_id?: string | null;
  model: string;
  status: AgentStatus;
  current_task?: string;
  task_count: number;
  success_count: number;
  created_at: string;
  updated_at: string;
  skills: AgentSkill[];
  recent_work?: WorkLogEntry[];
  recent_comms?: AgentComm[];
}

export interface Company {
  id: string;
  name: string;
  industry?: string | null;
  description?: string | null;
  website?: string | null;
  size?: string | null;
  logo_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompanyDocument {
  id: string;
  company_id?: string | null;
  agent_id?: string | null;
  filename: string;
  content_type?: string | null;
  size_bytes: number;
  status: string;
  chunk_count: number;
  created_at: string;
}

export interface SkillCatalog {
  departments: { department: string; skills: string[] }[];
}

export interface StatsOverview {
  agents: number;
  active: number;
  idle: number;
  error: number;
  tasks: number;
  success: number;
  success_rate: number;
  total_cost_usd: number;
  total_tokens: number;
  avg_eval: number | null;
  departments: { department: string; agents: number; tasks: number; success: number }[];
}

export interface AgentStat {
  id: string;
  name: string;
  title: string;
  department: string;
  status: AgentStatus;
  avatar_seed: string;
  avatar_url?: string | null;
  current_task?: string | null;
  task_count: number;
  success_count: number;
  success_rate: number;
  cost_usd: number;
  tokens: number;
  avg_eval: number | null;
  last_active: string | null;
}

export interface ActivityItem {
  id: string;
  agent_id: string;
  agent_name: string;
  avatar_seed: string;
  avatar_url?: string | null;
  department: string;
  task_type: string;
  success: boolean;
  cost_usd: number;
  tokens_used: number;
  duration_ms?: number | null;
  result_preview: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface TimePoint {
  date: string;
  tasks: number;
  cost: number;
  tokens: number;
  success: number;
}

export interface Memory {
  id: string;
  content: string;
  task_type: string;
  created_at: string;
  score?: number; // present in search results
}

export interface EvalResult {
  id: string;
  agent_id: string;
  work_log_id?: string;
  score: number;
  reasoning?: string;
  judge_model: string;
  skill_updates: Record<string, number>;
  created_at: string;
}

export interface EvalSummary {
  avg_score: number;
  total_evals: number;
  min_score: number;
  max_score: number;
  recent: { score: number; created_at: string }[];
}

export interface AgentConfigInfo {
  generation: number;
  active: boolean;
  value: string | null;
  id?: string;
  eval_score?: number;
  created_at?: string;
}

// AG-UI Protocol event types
export type AGUIEventType =
  | "CONNECTED"
  | "RUN_STARTED"
  | "RUN_FINISHED"
  | "RUN_ERROR"
  | "TEXT_MESSAGE_START"
  | "TEXT_MESSAGE_CONTENT"
  | "TEXT_MESSAGE_END"
  | "TOOL_CALL_START"
  | "TOOL_CALL_ARGS"
  | "TOOL_CALL_END"
  | "TOOL_CALL_RESULT"
  | "STATE_SNAPSHOT"
  | "STATE_DELTA"
  | "CUSTOM";

export interface AGUIEvent {
  type: AGUIEventType;
  agent_id: string;
  data: Record<string, unknown>;
  timestamp: string;
}
