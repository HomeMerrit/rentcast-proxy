"""Code execution tool — E2B sandbox (if API key set) else subprocess fallback."""
from __future__ import annotations
import asyncio
import subprocess
from langchain_core.tools import tool
from ..config import settings


@tool
async def execute_python(code: str) -> str:
    """Execute Python code and return the output. Use for data analysis, calculations, etc."""
    if settings.e2b_api_key:
        return await _run_e2b(code)
    return await _run_subprocess(code)


async def _run_e2b(code: str) -> str:
    try:
        from e2b_code_interpreter import Sandbox
        sbx = Sandbox(api_key=settings.e2b_api_key)
        execution = sbx.run_code(code)
        output = "\n".join(str(r) for r in execution.results)
        logs = execution.logs.stdout + execution.logs.stderr
        sbx.kill()
        return (output or "\n".join(logs) or "No output").strip()
    except Exception as e:
        return f"E2B error: {e}"


async def _run_subprocess(code: str) -> str:
    try:
        proc = await asyncio.create_subprocess_exec(
            "python3", "-c", code,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=15)
        out = stdout.decode().strip()
        err = stderr.decode().strip()
        return out or err or "No output"
    except asyncio.TimeoutError:
        return "Execution timed out (15s limit)"
    except Exception as e:
        return f"Execution error: {e}"
