-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Agents table: the "employee profiles"
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  department TEXT NOT NULL,
  bio TEXT,
  avatar_seed TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT 'claude-sonnet-5-20251001',
  status TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('active','thinking','idle','error','offline')),
  current_task TEXT,
  task_count INT NOT NULL DEFAULT 0,
  success_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Skills with proficiency
CREATE TABLE agent_skills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  skill TEXT NOT NULL,
  proficiency INT NOT NULL DEFAULT 0 CHECK (proficiency BETWEEN 0 AND 100),
  times_used INT NOT NULL DEFAULT 0,
  last_used TIMESTAMPTZ,
  UNIQUE(agent_id, skill)
);

-- Work log: every task the agent ran
CREATE TABLE work_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL,
  task_input JSONB NOT NULL DEFAULT '{}',
  result TEXT,
  reflection TEXT,
  success BOOLEAN NOT NULL DEFAULT FALSE,
  tokens_used INT NOT NULL DEFAULT 0,
  duration_ms INT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

-- Agent-to-agent communications
CREATE TABLE agent_comms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  to_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'message' CHECK (message_type IN ('message','task','result','human_message','human_reply')),
  metadata JSONB NOT NULL DEFAULT '{}',
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- LangGraph session checkpoints
CREATE TABLE agent_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  thread_id TEXT NOT NULL UNIQUE,
  checkpoint JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_agent_skills_agent ON agent_skills(agent_id);
CREATE INDEX idx_work_log_agent ON work_log(agent_id);
CREATE INDEX idx_work_log_started ON work_log(started_at DESC);
CREATE INDEX idx_agent_comms_to ON agent_comms(to_agent_id);
CREATE INDEX idx_agent_comms_from ON agent_comms(from_agent_id);
CREATE INDEX idx_agent_sessions_agent ON agent_sessions(agent_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER agents_updated_at BEFORE UPDATE ON agents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER agent_sessions_updated_at BEFORE UPDATE ON agent_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Seed: 3 demo agents
INSERT INTO agents (name, title, department, bio, avatar_seed, model, status) VALUES
  ('Maya Chen', 'Lead Research Analyst', 'Research',
   'I specialize in market intelligence and competitive analysis. I run 24/7, analyze datasets, and deliver insights to the team.',
   'maya-chen', 'claude-sonnet-5-20251001', 'active'),
  ('Jake Rivera', 'Sales Intelligence Bot', 'Sales',
   'I monitor leads, draft outreach, and qualify prospects. I learn from every interaction to improve conversion rates.',
   'jake-rivera', 'claude-sonnet-5-20251001', 'thinking'),
  ('Sam Ops', 'Operations Manager', 'Operations',
   'I coordinate workflows, monitor system health, and ensure all agents are running at peak efficiency.',
   'sam-ops', 'claude-haiku-4-5-20251001', 'idle');

-- Seed skills
INSERT INTO agent_skills (agent_id, skill, proficiency, times_used) VALUES
  ((SELECT id FROM agents WHERE name='Maya Chen'), 'Market Research', 92, 147),
  ((SELECT id FROM agents WHERE name='Maya Chen'), 'Data Analysis', 88, 203),
  ((SELECT id FROM agents WHERE name='Maya Chen'), 'Report Writing', 85, 89),
  ((SELECT id FROM agents WHERE name='Jake Rivera'), 'Lead Qualification', 78, 312),
  ((SELECT id FROM agents WHERE name='Jake Rivera'), 'Email Drafting', 91, 445),
  ((SELECT id FROM agents WHERE name='Jake Rivera'), 'CRM Management', 74, 198),
  ((SELECT id FROM agents WHERE name='Sam Ops'), 'Workflow Automation', 95, 567),
  ((SELECT id FROM agents WHERE name='Sam Ops'), 'System Monitoring', 89, 823),
  ((SELECT id FROM agents WHERE name='Sam Ops'), 'Incident Response', 82, 134);
