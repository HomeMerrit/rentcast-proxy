"""EvoAgentX-style prompt evolution: synthesizes improved system prompts from task history."""
from __future__ import annotations
import json
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_anthropic import ChatAnthropic
from ..config import settings

EVOLUTION_SYSTEM = """You are a meta-AI that improves AI agent system prompts based on performance history.
Analyze the agent's recent task results, reflections, and performance scores.
Write an improved system prompt (2-3 short paragraphs) that addresses identified weaknesses.
Be specific and actionable. Do NOT include instructions to use tools — those are handled separately.
Return ONLY the new system prompt text, no JSON, no explanation."""


async def evolve_agent_prompt(
    agent_name: str,
    task_type: str,
    current_prompt: str,
    task_history: list[dict],
    avg_score: float,
) -> str:
    """Generate an evolved system prompt. Returns new prompt string."""
    llm = ChatAnthropic(
        model="claude-sonnet-5-20251001",
        api_key=settings.anthropic_api_key,
        max_tokens=512,
        temperature=0.3,
    )
    history_text = "\n".join([
        f"- Task: {t.get('task_type', '?')} | Score: {t.get('score', '?')} | "
        f"Reflection: {t.get('reflection', '')[:150]}"
        for t in task_history[:10]
    ])
    prompt = f"""Agent: {agent_name} (specializes in {task_type})
Average Performance Score: {avg_score:.1f}/100

Current System Prompt:
{current_prompt}

Recent Task History:
{history_text}

Based on this history, write an improved system prompt that addresses the agent's weaknesses."""

    try:
        response = await llm.ainvoke([
            SystemMessage(content=EVOLUTION_SYSTEM),
            HumanMessage(content=prompt),
        ])
        new_prompt = response.content.strip()
        if len(new_prompt) < 50:
            return current_prompt  # Reject too-short evolutions
        return new_prompt
    except Exception:
        return current_prompt
