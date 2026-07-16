"""LLM-as-Judge: scores agent task output using Claude Haiku."""
from __future__ import annotations
import json
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_anthropic import ChatAnthropic
from ..config import settings

JUDGE_SYSTEM = """You are an expert AI evaluator. Score agent task performance on a 0-100 scale.
Consider: task completion (40%), output quality/accuracy (30%), efficiency (20%), reflection quality (10%).

Return ONLY valid JSON with this exact structure — no other text:
{"score": <integer 0-100>, "reasoning": "<1-2 sentences>", "skill_updates": {"<skill_name>": <integer delta -10 to 10>}}

Include 1-3 relevant skill_updates. Skill names should match the agent's domain (e.g. "Research", "Analysis", "Writing", "Sales", "Operations")."""


async def evaluate_task(
    task_type: str,
    task_input: dict,
    result: str,
    reflection: str,
) -> dict:
    """Run LLM-as-Judge evaluation. Returns {score, reasoning, skill_updates}."""
    llm = ChatAnthropic(
        model="claude-haiku-4-5-20251001",
        api_key=settings.anthropic_api_key,
        max_tokens=256,
        temperature=0,
    )
    prompt = f"""Task Type: {task_type}
Task Input: {json.dumps(task_input)[:300]}
Agent Output: {result[:800]}
Agent Reflection: {reflection[:400]}

Evaluate this agent output and return the JSON score."""

    try:
        response = await llm.ainvoke([
            SystemMessage(content=JUDGE_SYSTEM),
            HumanMessage(content=prompt),
        ])
        content = response.content.strip()
        # Strip markdown code fences if present
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
        return json.loads(content)
    except Exception as e:
        return {"score": 50, "reasoning": f"Evaluation failed: {e}", "skill_updates": {}}
