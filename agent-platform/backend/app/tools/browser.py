"""Browser automation tool using browser-use."""
from __future__ import annotations
from langchain_core.tools import tool
from langchain_anthropic import ChatAnthropic
from ..config import settings


@tool
async def browse_web(task: str) -> str:
    """Browse the web to complete a task. Describe what you need to find or do in the browser."""
    try:
        from browser_use import Agent as BrowserAgent, Browser, BrowserConfig
        browser = Browser(config=BrowserConfig(headless=True, disable_security=True))
        llm = ChatAnthropic(
            model="claude-haiku-4-5-20251001",
            api_key=settings.anthropic_api_key,
            max_tokens=2048,
        )
        agent = BrowserAgent(task=task, llm=llm, browser=browser, max_actions_per_step=5)
        result = await agent.run(max_steps=10)
        await browser.close()
        # browser-use returns an AgentHistoryList; get the final result
        final = result.final_result() if hasattr(result, "final_result") else str(result)
        return str(final) if final else "Browser task completed with no text output."
    except ImportError:
        return "Browser tool not available — install browser-use and playwright."
    except Exception as e:
        return f"Browser error: {e}"
