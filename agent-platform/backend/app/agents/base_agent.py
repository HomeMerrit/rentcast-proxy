from __future__ import annotations
import time
from typing import Annotated, Optional, TypedDict
from uuid import uuid4
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage, AIMessage
from langchain_anthropic import ChatAnthropic
from ..config import settings
from .publisher import AgentEventPublisher


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
    def __init__(
        self,
        agent_id: str,
        agent_name: str,
        task_type: str,
        model: str = "claude-sonnet-5-20251001",
        publisher: Optional[AgentEventPublisher] = None,
    ):
        self.agent_id = agent_id
        self.agent_name = agent_name
        self.task_type = task_type
        self._publisher = publisher
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
        if self._publisher:
            await self._publisher.publish("STATE_SNAPSHOT", {"status": "thinking"})

        task_desc = f"Task type: {state['task_type']}\nInput: {state['task_input']}"
        messages = [SystemMessage(content=SYSTEM_PROMPT), HumanMessage(content=task_desc)]

        message_id = str(uuid4())
        if self._publisher:
            await self._publisher.publish("TEXT_MESSAGE_START", {"message_id": message_id})

        full_content = ""
        last_chunk = None
        async for chunk in self.llm.astream(messages):
            last_chunk = chunk
            if isinstance(chunk.content, str):
                delta = chunk.content
            elif isinstance(chunk.content, list) and chunk.content:
                first = chunk.content[0]
                delta = first.get("text", "") if isinstance(first, dict) else ""
            else:
                delta = ""

            if delta and self._publisher:
                await self._publisher.publish("TEXT_MESSAGE_CONTENT", {"delta": delta})

            full_content += delta

        if self._publisher:
            await self._publisher.publish("TEXT_MESSAGE_END", {})

        tokens = 0
        if last_chunk and last_chunk.usage_metadata:
            tokens = last_chunk.usage_metadata.get("total_tokens", 0)

        return {
            "messages": [AIMessage(content=full_content)],
            "result": full_content,
            "tokens_used": tokens,
        }

    async def _reflect(self, state: AgentState) -> dict:
        reflect_messages = list(state["messages"]) + [HumanMessage(content=REFLECT_PROMPT)]
        response = await self.llm.ainvoke(reflect_messages)
        tokens = response.usage_metadata.get("total_tokens", 0) if response.usage_metadata else 0

        if self._publisher:
            await self._publisher.publish(
                "CUSTOM",
                {"subtype": "REFLECTION", "content": response.content},
            )

        return {
            "messages": [response],
            "reflection": response.content,
            "tokens_used": state["tokens_used"] + tokens,
        }

    async def _complete(self, state: AgentState) -> dict:
        if self._publisher:
            await self._publisher.publish("STATE_SNAPSHOT", {"status": "active"})
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
