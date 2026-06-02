from __future__ import annotations

import asyncio
import json
import sys
import tempfile
from pathlib import Path
from typing import Any

import structlog

from sediman.agent.tool_dispatch import ToolResult

logger = structlog.get_logger()


async def _handle_execute_code(code: str, **kwargs: Any) -> ToolResult:
    with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False, prefix="sediman_exec_") as f:
        f.write(code)
        script_path = f.name

    try:
        proc = await asyncio.create_subprocess_exec(
            sys.executable, script_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=60)
        except asyncio.TimeoutError:
            proc.kill()
            await proc.communicate()
            return ToolResult(success=False, output="Code execution timed out after 60 seconds.")

        output_parts = []
        if stdout:
            output_parts.append(stdout.decode(errors="replace")[:8000])
        if stderr:
            err_text = stderr.decode(errors="replace")[:4000]
            if err_text.strip():
                output_parts.append(f"[stderr]\n{err_text}")

        output = "\n".join(output_parts) if output_parts else "(no output)"
        success = proc.returncode == 0

        if not success:
            output = f"Exit code: {proc.returncode}\n{output}"

        return ToolResult(success=success, output=output)
    finally:
        Path(script_path).unlink(missing_ok=True)
