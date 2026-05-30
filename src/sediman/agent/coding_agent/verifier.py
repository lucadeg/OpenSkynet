from __future__ import annotations

import asyncio
import subprocess
from pathlib import Path
from typing import Any, Callable

import structlog

from sediman.agent.coding_agent.types import ProjectInfo, VerifyResult

logger = structlog.get_logger()

_VERIFY_TIMEOUT = 60


class VerifyLoop:
    def __init__(
        self,
        project_info: ProjectInfo,
        on_progress: Callable[[str, str], None] | None = None,
    ):
        self.project = project_info
        self._on_progress = on_progress
        self._edited_files: set[str] = set()
        self._results: list[VerifyResult] = []

    def track_edit(self, file_path: str) -> None:
        self._edited_files.add(str(Path(file_path).resolve()))

    async def verify(self, aggressive: bool = False) -> list[VerifyResult]:
        self._results = []

        await self._run_format_check()
        await self._run_lint()

        if aggressive or len(self._edited_files) > 3:
            await self._run_tests()

        return self._results

    async def _run_format_check(self) -> None:
        for cmd in self.project.format_commands:
            result = await self._run_command(cmd, "format")
            self._results.append(result)
            if result.success:
                self._emit("verify", f"Format check passed: {cmd}")
            else:
                self._emit("verify", f"Format check failed — fix and try again")
                if self.project.format_commands:
                    fix_cmd = cmd.replace("--check", "").replace(" --check", "")
                    if fix_cmd != cmd:
                        self._emit("verify", f"Run '{fix_cmd}' to auto-fix formatting")

    async def _run_lint(self) -> None:
        ran = False
        for cmd in self.project.lint_commands:
            result = await self._run_command(cmd, "lint")
            self._results.append(result)
            ran = True
            if result.success:
                self._emit("verify", f"Lint passed: {cmd}")
            else:
                self._emit("verify", f"Lint found issues — review and fix")

        if not ran:
            self._emit("verify", "No lint commands configured. Consider running tests instead.")

    async def _run_tests(self) -> None:
        ran = False
        for cmd in self.project.test_commands:
            result = await self._run_command(cmd, "test", timeout=120)
            self._results.append(result)
            ran = True
            if result.success:
                self._emit("verify", f"Tests passed: {cmd}")
            else:
                self._emit("verify", f"Tests failed — review failures and fix")

        if not ran:
            self._emit("verify", "No test commands configured.")

    async def _run_command(
        self, cmd: str, tool: str = "", timeout: int = _VERIFY_TIMEOUT
    ) -> VerifyResult:
        try:
            proc = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: subprocess.run(
                    cmd, shell=True, capture_output=True, text=True, timeout=timeout,
                    cwd=self.project.root_dir or None,
                ),
            )
            output = (proc.stdout + proc.stderr).strip()
            if len(output) > 5000:
                output = output[:5000] + "\n... (truncated)"
            return VerifyResult(
                command=cmd,
                success=proc.returncode == 0,
                output=output,
                exit_code=proc.returncode,
                tool=tool,
            )
        except subprocess.TimeoutExpired:
            return VerifyResult(
                command=cmd,
                success=False,
                output=f"Command timed out after {timeout}s",
                exit_code=-1,
                tool=tool,
            )
        except Exception as e:
            return VerifyResult(
                command=cmd,
                success=False,
                output=str(e),
                exit_code=-1,
                tool=tool,
            )

    def _emit(self, action: str, detail: str = "") -> None:
        if self._on_progress:
            try:
                self._on_progress(action, detail)
            except Exception:
                pass

    @property
    def all_passed(self) -> bool:
        return all(r.success for r in self._results) if self._results else True

    @property
    def summary(self) -> str:
        if not self._results:
            return "No verification commands run."
        passed = sum(1 for r in self._results if r.success)
        failed = len(self._results) - passed
        lines = [f"Verification: {passed} passed, {failed} failed"]
        for r in self._results:
            status = "PASS" if r.success else "FAIL"
            lines.append(f"  [{status}] {r.command}")
            if not r.success and r.output:
                lines.append(f"    {r.output[:200]}")
        return "\n".join(lines)
