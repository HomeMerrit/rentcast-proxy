"use client";
import { useEffect, useRef, useCallback, useState } from "react";
import type { AGUIEvent, AGUIEventType, AgentStatus } from "@/types/agent";

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
  const retryDelay = useRef(1000);

  const connect = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
    }

    const es = new EventSource(`${STREAM_URL}/stream/agents/${agentId}`);
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
    };
  }, [connect]);

  return state;
}
