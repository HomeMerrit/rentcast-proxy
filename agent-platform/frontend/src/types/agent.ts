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
  created_at: string;
  read: boolean;
}

export interface Agent {
  id: string;
  name: string;
  title: string;
  department: string;
  bio?: string;
  avatar_seed: string;
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

export interface Memory {
  id: string;
  content: string;
  task_type: string;
  created_at: string;
  score?: number; // present in search results
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
