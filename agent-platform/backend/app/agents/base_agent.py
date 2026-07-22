from __future__ import annotations
import asyncio
import time
from uuid import uuid4
from typing import Annotated, Optional, TypedDict
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage, AIMessage, ToolMessage
from langchain_anthropic import ChatAnthropic
from .publisher import AgentEventPublisher
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
    retrieved_memories: list[dict]
    tool_iterations: int
    system_prompt: str

SYSTEM_PROMPT = """You are a specialized AI agent. Complete the given task thoroughly and accurately.
You have access to tools — use them when they would help you do a better job.
After completing the task, reflect on your performance.
Be concise and direct."""

REFLECT_PROMPT = """Review your work and reflect:
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
        model: str = "claude-sonnet-5",
        publisher: Optional[AgentEventPublisher] = None,
        tools: list = None,
        memory_manager=None,
    ):
        self.agent_id = agent_id
        self.agent_name = agent_name
        self.task_type = task_type
        self._publisher = publisher
        self.memory_manager = memory_manager
        self._langfuse_handler = None
        if settings.langfuse_secret_key and settings.langfuse_public_key:
            try:
                from langfuse.callback import CallbackHandler
                self._langfuse_handler = CallbackHandler(
                    public_key=settings.langfuse_public_key,
                    secret_key=settings.langfuse_secret_key,
                    host=settings.langfuse_host,
                    trace_name=f"{agent_name}/{task_type}",
                    session_id=agent_id,
                    user_id=agent_name,
                    tags=[task_type, agent_name],
                )
            except ImportError:
                pass
        self.tools = tools or []
        self._tool_map = {t.name: t for t in self.tools}
        self.llm = ChatAnthropic(
            model=model,
            api_key=settings.anthropic_api_key,
            max_tokens=4096,
        )
        self.llm_with_tools = self.llm.bind_tools(self.tools) if self.tools else self.llm
        self.graph = self._build_graph()

    def _build_graph(self):
        g = StateGraph(AgentState)
        g.add_node("memory_retrieve", self._memory_retrieve)
        g.add_node("think", self._think)
        g.add_node("tools", self._execute_tools)
        g.add_node("reflect", self._reflect)
        g.add_node("memory_store", self._memory_store)
        g.add_node("complete", self._complete)

        g.set_entry_point("memory_retrieve")
        g.add_edge("memory_retrieve", "think")
        g.add_conditional_edges("think", self._should_use_tools, {
            "tools": "tools",
            "reflect": "reflect",
        })
        g.add_edge("tools", "think")
        g.add_edge("reflect", "memory_store")
        g.add_edge("memory_store", "complete")
        g.add_edge("complete", END)
        return g.compile()

    async def _load_evolved_prompt(self) -> str:
        try:
            from ..database import AsyncTaskSession
            from ..models_db import AgentConfig
            from sqlalchemy import select
            async with AsyncTaskSession() as db:
                result = await db.execute(
                    select(AgentConfig).where(
                        AgentConfig.agent_id == self.agent_id,
                        AgentConfig.config_type == "system_prompt",
                        AgentConfig.active == True,  # noqa: E712
                    ).order_by(AgentConfig.generation.desc()).limit(1)
                )
                config = result.scalar_one_or_none()
                if config:
                    return config.value
        except Exception:
            pass
        return SYSTEM_PROMPT

    async def _memory_retrieve(self, state: AgentState) -> dict:
        # Load evolved system prompt
        system_prompt = await self._load_evolved_prompt()

        if not self.memory_manager:
            return {"retrieved_memories": [], "tool_iterations": 0, "system_prompt": system_prompt}
        query = f"{state['task_type']}: {state['task_input']}"
        memories = await self.memory_manager.search(self.agent_id, query)
        if memories and self._publisher:
            await self._publisher.publish("CUSTOM", {
                "subtype": "MEMORY_RETRIEVED",
                "count": len(memories),
                "memories": [m["content"] for m in memories[:3]],
            })
        return {"retrieved_memories": memories, "tool_iterations": 0, "system_prompt": system_prompt}

    async def _think(self, state: AgentState) -> dict:
        # Build memory context
        memory_ctx = ""
        if state.get("retrieved_memories"):
            memory_ctx = "\n\nRelevant memories from past tasks:\n" + "\n".join(
                f"- {m['content']}" for m in state["retrieved_memories"]
            )

        task_desc = f"Task type: {state['task_type']}\nInput: {state['task_input']}{memory_ctx}"

        active_system_prompt = state.get("system_prompt") or SYSTEM_PROMPT

        # First think: seed the conversation and persist it into graph state so
        # later think iterations and the reflect step keep the original task.
        prior_ai = [m for m in state["messages"] if isinstance(m, AIMessage)]
        if not prior_ai:
            seed_messages = [SystemMessage(content=active_system_prompt), HumanMessage(content=task_desc)]
            messages = seed_messages
        else:
            seed_messages = []
            messages = list(state["messages"])

        # Stream response, merging chunks so tool_calls and usage survive
        full_content = ""
        acc = None
        msg_id = str(uuid4())
        text_started = False

        if self._publisher:
            await self._publisher.publish("STATE_SNAPSHOT", {"status": "thinking", "current_task": state["task_type"]})

        # Pass Langfuse callback if configured
        stream_config = {"callbacks": [self._langfuse_handler]} if self._langfuse_handler else {}

        async for chunk in self.llm_with_tools.astream(messages, config=stream_config):
            acc = chunk if acc is None else acc + chunk
            # Extract text delta
            delta = ""
            if isinstance(chunk.content, str):
                delta = chunk.content
            elif isinstance(chunk.content, list):
                for block in chunk.content:
                    if isinstance(block, dict) and block.get("type") == "text":
                        delta += block.get("text", "")

            if delta:
                if not text_started and self._publisher:
                    await self._publisher.publish("TEXT_MESSAGE_START", {"message_id": msg_id})
                    text_started = True
                full_content += delta
                if self._publisher:
                    await self._publisher.publish("TEXT_MESSAGE_CONTENT", {"delta": delta, "message_id": msg_id})

        if text_started and self._publisher:
            await self._publisher.publish("TEXT_MESSAGE_END", {"message_id": msg_id})

        tokens = 0
        if acc is not None and acc.usage_metadata:
            tokens = acc.usage_metadata.get("total_tokens", 0)

        if acc is not None:
            ai_msg = AIMessage(content=acc.content, tool_calls=acc.tool_calls)
        else:
            ai_msg = AIMessage(content=full_content)

        return {
            "messages": seed_messages + [ai_msg],
            "result": full_content if full_content else state.get("result"),
            "tokens_used": state.get("tokens_used", 0) + tokens,
        }

    def _should_use_tools(self, state: AgentState) -> str:
        last_msg = state["messages"][-1]
        has_tools = (
            hasattr(last_msg, "tool_calls")
            and last_msg.tool_calls
            and len(last_msg.tool_calls) > 0
        )
        if has_tools and state.get("tool_iterations", 0) < 5:
            return "tools"
        return "reflect"

    async def _execute_tools(self, state: AgentState) -> dict:
        last_msg = state["messages"][-1]
        tool_messages = []

        for tc in last_msg.tool_calls:
            tool_name = tc["name"]
            tool_args = tc["args"]
            tool_call_id = tc["id"]

            if self._publisher:
                await self._publisher.publish("TOOL_CALL_START", {
                    "tool_name": tool_name,
                    "tool_call_id": tool_call_id,
                })

            tool_fn = self._tool_map.get(tool_name)
            try:
                if tool_fn is None:
                    result_str = f"Unknown tool: {tool_name}"
                else:
                    result = await tool_fn.ainvoke(tool_args)
                    result_str = str(result)
            except Exception as e:
                result_str = f"Tool error: {e}"

            if self._publisher:
                await self._publisher.publish("TOOL_CALL_RESULT", {
                    "tool_name": tool_name,
                    "tool_call_id": tool_call_id,
                    "result": result_str[:500],
                })
                await self._publisher.publish("TOOL_CALL_END", {
                    "tool_call_id": tool_call_id,
                })

            tool_messages.append(ToolMessage(
                content=result_str,
                tool_call_id=tool_call_id,
            ))

        return {
            "messages": tool_messages,
            "tool_iterations": state.get("tool_iterations", 0) + 1,
        }

    @staticmethod
    def _content_text(content) -> str:
        """Flatten a LangChain message content (str or list of blocks) to plain text.
        Claude responses can be a list of content blocks (e.g. text + thinking), so the
        raw value must not be stored directly in a string DB column."""
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            parts = []
            for block in content:
                if isinstance(block, dict):
                    if block.get("type") == "text" or "text" in block:
                        parts.append(block.get("text", ""))
                elif isinstance(block, str):
                    parts.append(block)
            return "".join(parts)
        return str(content) if content is not None else ""

    async def _reflect(self, state: AgentState) -> dict:
        reflect_messages = list(state["messages"])
        # If the tool-iteration cap left unanswered tool calls, close them out —
        # the API rejects a tool_use block with no matching tool_result.
        last = reflect_messages[-1] if reflect_messages else None
        if isinstance(last, AIMessage) and last.tool_calls:
            reflect_messages += [
                ToolMessage(content="Tool execution skipped (iteration limit reached).", tool_call_id=tc["id"])
                for tc in last.tool_calls
            ]
        reflect_messages.append(HumanMessage(content=REFLECT_PROMPT))
        # History may contain tool blocks, which require the tools param to be present
        response = await self.llm_with_tools.ainvoke(reflect_messages)
        tokens = response.usage_metadata.get("total_tokens", 0) if response.usage_metadata else 0
        reflection_text = self._content_text(response.content)
        if self._publisher:
            await self._publisher.publish("CUSTOM", {
                "subtype": "REFLECTION",
                "content": reflection_text,
            })
        return {
            "messages": [response],
            "reflection": reflection_text,
            "tokens_used": state.get("tokens_used", 0) + tokens,
        }

    async def _memory_store(self, state: AgentState) -> dict:
        if self.memory_manager and state.get("result"):
            content = f"Task '{state['task_type']}': {state['result'][:400]}"
            await self.memory_manager.add(
                agent_id=self.agent_id,
                content=content,
                task_type=state["task_type"],
            )
        return {}

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
            "retrieved_memories": [],
            "tool_iterations": 0,
            "system_prompt": SYSTEM_PROMPT,  # will be overridden by _memory_retrieve
        }
        final = await self.graph.ainvoke(initial)
        return {
            "result": final["result"],
            "reflection": final["reflection"],
            "success": final["success"],
            "tokens_used": final["tokens_used"],
            "duration_ms": int((time.time() - final["start_time"]) * 1000),
        }
