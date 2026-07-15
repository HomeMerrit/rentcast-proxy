from __future__ import annotations
import time
from typing import Annotated, Optional, TypedDict
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from langchain_anthropic import ChatAnthropic
from ..config import settings

class AgentState(TypedDict):
    agent_id: str
    agent_name: str
    task_type: str
    task_input: dict
    messages: Annotated[list[BaseMessage], add_messages]
    result: Optional[str]
    reflection: Optional[str]
    success: bool
    tokens_used: int
    start_time: float

SYSTEM_PROMPT = """You are a specialized AI agent. Complete the given task thoroughly and accurately.
After completing the task, reflect on your performance: what went well, what could improve.
Be concise and direct."""

REFLECT_PROMPT = """Review your previous response and reflect:
1. Did you complete the task fully?
2. What could you do better next time?
3. Any skills you should improve?
Keep reflection to 2-3 sentences."""

class BaseAgent:
    def __init__(self, agent_id: str, agent_name: str, task_type: str, model: str = "claude-sonnet-5-20251001"):
        self.agent_id = agent_id
        self.agent_name = agent_name
        self.task_type = task_type
        self.llm = ChatAnthropic(
            model=model,
            api_key=settings.anthropic_api_key,
            max_tokens=4096,
        )
        self.graph = self._build_graph()

    def _build_graph(self):
        g = StateGraph(AgentState)
        g.add_node("think", self._think)
        g.add_node("reflect", self._reflect)
        g.add_node("complete", self._complete)
        g.set_entry_point("think")
        g.add_edge("think", "reflect")
        g.add_edge("reflect", "complete")
        g.add_edge("complete", END)
        return g.compile()

    async def _think(self, state: AgentState) -> dict:
        task_desc = f"Task type: {state['task_type']}\nInput: {state['task_input']}"
        messages = [SystemMessage(content=SYSTEM_PROMPT), HumanMessage(content=task_desc)]
        response = await self.llm.ainvoke(messages)
        return {
            "messages": [response],
            "result": response.content,
            "tokens_used": response.usage_metadata.get("total_tokens", 0) if response.usage_metadata else 0,
        }

    async def _reflect(self, state: AgentState) -> dict:
        reflect_messages = list(state["messages"]) + [HumanMessage(content=REFLECT_PROMPT)]
        response = await self.llm.ainvoke(reflect_messages)
        tokens = response.usage_metadata.get("total_tokens", 0) if response.usage_metadata else 0
        return {
            "messages": [response],
            "reflection": response.content,
            "tokens_used": state["tokens_used"] + tokens,
        }

    async def _complete(self, state: AgentState) -> dict:
        return {"success": bool(state.get("result"))}

    async def run(self, task_input: dict) -> dict:
        initial: AgentState = {
            "agent_id": self.agent_id,
            "agent_name": self.agent_name,
            "task_type": self.task_type,
            "task_input": task_input,
            "messages": [],
            "result": None,
            "reflection": None,
            "success": False,
            "tokens_used": 0,
            "start_time": time.time(),
        }
        final = await self.graph.ainvoke(initial)
        return {
            "result": final["result"],
            "reflection": final["reflection"],
            "success": final["success"],
            "tokens_used": final["tokens_used"],
            "duration_ms": int((time.time() - final["start_time"]) * 1000),
        }
