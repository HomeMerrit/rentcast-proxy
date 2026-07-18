"use client";
import { useEffect, useRef, useCallback, useState } from "react";
import type { AGUIEvent, AGUIEventType, AgentStatus } from "@/types/agent";
import { DEMO, agents as demoAgents, nextFleetEvent } from "./demo";

interface StreamState {
  events: AGUIEvent[];
  currentMessage: string;
  currentTool: string | null;
  lastToolResult: string | null;
  retrievedMemories: string[];
  status: AgentStatus;
  isConnected: boolean;
  lastActivity: string | null;
}

const STREAM_URL = process.env.NEXT_PUBLIC_STREAM_URL ?? "http://localhost:8000";

// EventSource can't set an Authorization header, so the backend authenticates SSE
// via a ?token= query param. Append the stored API key when present.
function streamUrl(path: string): string {
  const key = typeof window !== "undefined" ? localStorage.getItem("agentos_api_key") : null;
  return key ? `${STREAM_URL}${path}?token=${encodeURIComponent(key)}` : `${STREAM_URL}${path}`;
}

export function useAgentStream(agentId: string, initialStatus: AgentStatus = "idle") {
  const [state, setState] = useState<StreamState>({
    events: [],
    currentMessage: "",
    currentTool: null,
    lastToolResult: null,
    retrievedMemories: [],
    status: initialStatus,
    isConnected: false,
    lastActivity: null,
  });

  const esRef = useRef<EventSource | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const simRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryDelay = useRef(1000);

  const connect = useCallback(() => {
    if (DEMO) {
      setState((s) => ({ ...s, isConnected: true }));
      let i = 0;
      simRef.current = setInterval(() => {
        i++;
        const ts = new Date().toISOString();
        setState((s) => {
          const roll = i % 4;
          if (roll === 0) return { ...s, status: "active", currentTool: null, currentMessage: "", lastActivity: ts, events: [...s.events.slice(-99), { type: "RUN_STARTED", agent_id: agentId, data: {}, timestamp: ts }] };
          if (roll === 1) return { ...s, status: "thinking", currentTool: "web_search", lastActivity: ts };
          if (roll === 2) return { ...s, status: "active", currentTool: null, currentMessage: "Working through the task and checking the details…", lastActivity: ts };
          return { ...s, status: "idle", currentTool: null, currentMessage: "", lastActivity: ts, events: [...s.events.slice(-99), { type: "RUN_FINISHED", agent_id: agentId, data: {}, timestamp: ts }] };
        });
      }, 2200);
      return;
    }
    if (esRef.current) {
      esRef.current.close();
    }

    const es = new EventSource(streamUrl(`/stream/agents/${agentId}`));
    esRef.current = es;

    es.onopen = () => {
      setState((s) => ({ ...s, isConnected: true }));
      retryDelay.current = 1000;
    };

    es.onmessage = (e: MessageEvent) => {
      try {
        const event: AGUIEvent = JSON.parse(e.data);
        setState((s) => {
          const next = { ...s, events: [...s.events.slice(-99), event], lastActivity: event.timestamp };

          switch (event.type as AGUIEventType) {
            case "RUN_STARTED":
              return { ...next, status: "active", currentMessage: "", currentTool: null };
            case "RUN_FINISHED":
              return { ...next, status: "idle", currentTool: null };
            case "RUN_ERROR":
              return { ...next, status: "error" };
            case "TEXT_MESSAGE_CONTENT":
              return { ...next, currentMessage: s.currentMessage + ((event.data.delta as string) ?? "") };
            case "TEXT_MESSAGE_END":
              return { ...next, currentMessage: "" };
            case "TOOL_CALL_START":
              return { ...next, status: "thinking", currentTool: (event.data.tool_name as string) ?? null };
            case "TOOL_CALL_END":
              return { ...next, currentTool: null };
            case "TOOL_CALL_RESULT":
              return {
                ...next,
                lastToolResult: (event.data.result as string) ?? null,
                currentTool: null,
              };
            case "STATE_SNAPSHOT":
              return { ...next, status: (event.data.status as AgentStatus) ?? s.status };
            case "STATE_DELTA":
              if (event.data.status) return { ...next, status: event.data.status as AgentStatus };
              return next;
            case "CUSTOM":
              if (event.data.subtype === "MEMORY_RETRIEVED") {
                return {
                  ...next,
                  retrievedMemories: (event.data.memories as string[]) ?? [],
                };
              }
              return next;
            default:
              return next;
          }
        });
      } catch {
        // malformed event — ignore
      }
    };

    es.onerror = () => {
      es.close();
      setState((s) => ({ ...s, isConnected: false }));
      reconnectTimer.current = setTimeout(() => {
        retryDelay.current = Math.min(retryDelay.current * 2, 30000);
        connect();
      }, retryDelay.current);
    };
  }, [agentId]);

  useEffect(() => {
    connect();
    return () => {
      esRef.current?.close();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (simRef.current) clearInterval(simRef.current);
    };
  }, [connect]);

  return state;
}

// ── Fleet-wide live stream (all agents via /stream/fleet) ─────────────────────

export interface FleetAgentLive {
  status: AgentStatus;
  currentMessage: string;
  currentTool: string | null;
  lastActivity: string | null;
}

export interface FleetState {
  agents: Record<string, FleetAgentLive>;
  events: AGUIEvent[];
  isConnected: boolean;
}

function applyFleetEvent(agents: Record<string, FleetAgentLive>, event: AGUIEvent) {
  const aid = event.agent_id;
  const prev: FleetAgentLive = agents[aid] ?? { status: "idle", currentMessage: "", currentTool: null, lastActivity: null };
  const next: FleetAgentLive = { ...prev, lastActivity: event.timestamp };
  const d = event.data || {};
  switch (event.type as AGUIEventType) {
    case "RUN_STARTED": next.status = "active"; next.currentMessage = ""; next.currentTool = null; break;
    case "RUN_FINISHED": next.status = "idle"; next.currentTool = null; break;
    case "RUN_ERROR": next.status = "error"; break;
    case "TEXT_MESSAGE_START": next.status = "active"; next.currentMessage = ""; break;
    case "TEXT_MESSAGE_CONTENT": next.currentMessage = (prev.currentMessage + ((d.delta as string) || "")).slice(-280); break;
    case "TOOL_CALL_START": next.status = "active"; next.currentTool = (d.tool_name as string) || "tool"; break;
    case "TOOL_CALL_END": next.currentTool = null; break;
    case "STATE_SNAPSHOT": case "STATE_DELTA": if (d.status) next.status = d.status as AgentStatus; break;
  }
  return { ...agents, [aid]: next };
}

export function useFleetStream() {
  const [state, setState] = useState<FleetState>({ agents: {}, events: [], isConnected: false });
  const esRef = useRef<EventSource | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const simRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryDelay = useRef(1000);

  const connect = useCallback(() => {
    if (DEMO) {
      const seeded: Record<string, FleetAgentLive> = {};
      for (const a of demoAgents()) seeded[a.id] = { status: a.status, currentMessage: a.current_task ?? "", currentTool: null, lastActivity: new Date().toISOString() };
      setState({ agents: seeded, events: [], isConnected: true });
      simRef.current = setInterval(() => {
        const ev = nextFleetEvent();
        setState((s) => ({ ...s, isConnected: true, agents: applyFleetEvent(s.agents, ev), events: [...s.events.slice(-79), ev] }));
      }, 1300);
      return;
    }
    if (esRef.current) esRef.current.close();
    const es = new EventSource(streamUrl(`/stream/fleet`));
    esRef.current = es;

    es.onopen = () => {
      setState((s) => ({ ...s, isConnected: true }));
      retryDelay.current = 1000;
    };

    es.onmessage = (e: MessageEvent) => {
      try {
        const event: AGUIEvent = JSON.parse(e.data);
        const aid = event.agent_id;
        if (!aid) return;
        setState((s) => {
          const prev: FleetAgentLive = s.agents[aid] ?? {
            status: "idle", currentMessage: "", currentTool: null, lastActivity: null,
          };
          const next: FleetAgentLive = { ...prev, lastActivity: event.timestamp };
          const d = event.data || {};
          switch (event.type as AGUIEventType) {
            case "RUN_STARTED":
              next.status = "active"; next.currentMessage = ""; next.currentTool = null; break;
            case "RUN_FINISHED":
              next.status = "idle"; next.currentTool = null; break;
            case "RUN_ERROR":
              next.status = "error"; break;
            case "TEXT_MESSAGE_START":
              next.status = "active"; next.currentMessage = ""; break;
            case "TEXT_MESSAGE_CONTENT":
              next.currentMessage = (prev.currentMessage + ((d.delta as string) || "")).slice(-280); break;
            case "TOOL_CALL_START":
              next.status = "active"; next.currentTool = (d.tool_name as string) || "tool"; break;
            case "TOOL_CALL_END":
              next.currentTool = null; break;
            case "STATE_SNAPSHOT":
            case "STATE_DELTA":
              if (d.status) next.status = d.status as AgentStatus; break;
          }
          return {
            ...s,
            isConnected: true,
            agents: { ...s.agents, [aid]: next },
            events: [...s.events.slice(-79), event],
          };
        });
      } catch {
        /* ignore malformed */
      }
    };

    es.onerror = () => {
      es.close();
      setState((s) => ({ ...s, isConnected: false }));
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      reconnectTimer.current = setTimeout(connect, retryDelay.current);
      retryDelay.current = Math.min(retryDelay.current * 2, 30000);
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (esRef.current) esRef.current.close();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (simRef.current) clearInterval(simRef.current);
    };
  }, [connect]);

  return state;
}
