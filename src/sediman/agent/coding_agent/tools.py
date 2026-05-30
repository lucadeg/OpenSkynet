from __future__ import annotations

from pathlib import Path
from typing import Any

from sediman.agent.tool_dispatch import ToolRegistry, ToolResult, ToolDefinition


async def _handle_glob(
    pattern: str | None = None,
    path: str | None = None,
    **kwargs: Any,
) -> ToolResult:
    if not pattern:
        return ToolResult(success=False, output="pattern is required.")
    try:
        base = Path(path or ".").expanduser().resolve()
        if not base.exists():
            return ToolResult(success=False, output=f"Directory not found: {base}")
        matches = sorted(base.glob(pattern))[:200]
        if not matches:
            return ToolResult(
                success=True,
                output=f"No files matching '{pattern}' in {base}",
                data={"files": [], "count": 0},
            )
        lines = []
        for m in matches:
            rel = m.relative_to(base) if m.is_relative_to(base) else m
            suffix = "/" if m.is_dir() else ""
            lines.append(str(rel) + suffix)
        output = "\n".join(lines)
        if len(output) > 15000:
            output = output[:15000] + "\n... (truncated)"
        return ToolResult(
            success=True,
            output=output,
            data={"files": [str(m) for m in matches], "count": len(matches)},
        )
    except Exception as e:
        return ToolResult(success=False, output=f"Glob failed: {e}")


async def _handle_git_status(
    path: str | None = None,
    **kwargs: Any,
) -> ToolResult:
    try:
        import subprocess

        cwd = str(Path(path).expanduser().resolve()) if path else None
        result = subprocess.run(
            ["git", "status", "--porcelain", "--branch"],
            capture_output=True, text=True, timeout=10, cwd=cwd,
        )
        output = result.stdout.strip() or "(clean working tree)"
        if result.returncode != 0:
            if "not a git repository" in result.stderr.lower():
                return ToolResult(
                    success=True,
                    output="Not a git repository (or any parent directory).",
                    data={"is_repo": False},
                )
            return ToolResult(
                success=False,
                output=f"git status failed: {result.stderr[:500]}",
            )

        branch_line = output.splitlines()[0] if output else ""
        status_lines = output.splitlines()[1:] if output else []

        staged = [l for l in status_lines if l[0] != " " and l[1] != "?"]
        unstaged = [l for l in status_lines if l[1] != " "]
        untracked = [l for l in status_lines if l.startswith("??")]

        summary_parts = [branch_line]
        if staged:
            summary_parts.append(f"Staged: {len(staged)} file(s)")
        if unstaged:
            summary_parts.append(f"Modified: {len(unstaged)} file(s)")
        if untracked:
            summary_parts.append(f"Untracked: {len(untracked)} file(s)")

        return ToolResult(
            success=True,
            output="\n".join(summary_parts + [""] + output.splitlines()),
            data={
                "is_repo": True,
                "branch": branch_line,
                "staged_count": len(staged),
                "modified_count": len(unstaged),
                "untracked_count": len(untracked),
            },
        )
    except FileNotFoundError:
        return ToolResult(
            success=False, output="git is not installed or not in PATH."
        )
    except subprocess.TimeoutExpired:
        return ToolResult(success=False, output="git status timed out.")
    except Exception as e:
        return ToolResult(success=False, output=f"git status failed: {e}")


async def _handle_git_diff(
    staged: bool = False,
    path: str | None = None,
    file_path: str | None = None,
    **kwargs: Any,
) -> ToolResult:
    try:
        import subprocess

        cwd = str(Path(path).expanduser().resolve()) if path else None
        cmd = ["git", "diff"]
        if staged:
            cmd.append("--staged")
        if file_path:
            cmd.extend(["--", file_path])

        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=15, cwd=cwd,
        )
        if result.returncode != 0:
            return ToolResult(
                success=False,
                output=f"git diff failed: {result.stderr[:500]}",
            )
        output = result.stdout.strip()
        if not output:
            return ToolResult(
                success=True,
                output="No changes (working tree clean).",
                data={"has_changes": False},
            )
        if len(output) > 15000:
            output = output[:15000] + "\n... (diff truncated)"
        return ToolResult(
            success=True,
            output=output,
            data={"has_changes": True},
        )
    except FileNotFoundError:
        return ToolResult(
            success=False, output="git is not installed or not in PATH."
        )
    except subprocess.TimeoutExpired:
        return ToolResult(success=False, output="git diff timed out.")
    except Exception as e:
        return ToolResult(success=False, output=f"git diff failed: {e}")


async def _handle_git_log(
    count: int = 10,
    path: str | None = None,
    file_path: str | None = None,
    **kwargs: Any,
) -> ToolResult:
    try:
        import subprocess

        cwd = str(Path(path).expanduser().resolve()) if path else None
        count = max(1, min(count, 50))
        cmd = [
            "git", "log",
            f"-{count}",
            "--oneline",
            "--decorate",
            "--no-merges",
        ]
        if file_path:
            cmd.extend(["--", file_path])

        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=10, cwd=cwd,
        )
        if result.returncode != 0:
            return ToolResult(
                success=False,
                output=f"git log failed: {result.stderr[:500]}",
            )
        output = result.stdout.strip()
        if not output:
            output = "(no commits)"
        return ToolResult(
            success=True,
            output=output,
            data={"commits": output.count("\n") + 1 if output != "(no commits)" else 0},
        )
    except FileNotFoundError:
        return ToolResult(
            success=False, output="git is not installed or not in PATH."
        )
    except subprocess.TimeoutExpired:
        return ToolResult(success=False, output="git log timed out.")
    except Exception as e:
        return ToolResult(success=False, output=f"git log failed: {e}")


def create_coding_tool_registry() -> ToolRegistry:
    from sediman.agent.tools import create_agent_tool_registry

    full = create_agent_tool_registry()
    coding = ToolRegistry()

    allowed = {
        "terminal", "read_file", "write_file", "patch",
        "list_files", "search_files", "web_search",
        "web_extract", "skill_search", "skill_manage",
        "delegate_task", "clarify", "todo",
    }

    for name in full.list_tools():
        if name in allowed:
            coding.register(full.get_definition(name), full._handlers[name])

    _register_coding_tools(coding)

    return coding


def _register_coding_tools(registry: ToolRegistry) -> None:
    registry.register(
        ToolDefinition(
            name="glob",
            description="Find files matching a glob pattern. Supports ** for recursive directory matching. Use to discover project structure, find files by type (e.g. '**/*.py'), or locate specific files. Returns sorted file paths. Faster than list_files when you know the pattern.",
            parameters={
                "type": "object",
                "properties": {
                    "pattern": {
                        "type": "string",
                        "description": "Glob pattern (e.g. '**/*.py', 'src/**/*.ts', '**/*.test.*'). Supports ** for recursive matching.",
                    },
                    "path": {
                        "type": "string",
                        "description": "Base directory to search from (default: current directory, supports ~)",
                    },
                },
                "required": ["pattern"],
            },
        ),
        _handle_glob,
    )

    registry.register(
        ToolDefinition(
            name="git_status",
            description="Show the working tree status including branch, staged changes, unstaged changes, and untracked files. Use before starting work to understand the current state, and after making changes to see what was modified.",
            parameters={
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "Path to the git repository (default: current directory)",
                    },
                },
            },
        ),
        _handle_git_status,
    )

    registry.register(
        ToolDefinition(
            name="git_diff",
            description="Show changes between the working tree and the index (unstaged and staged). Use to review your own changes before considering work complete. Set staged=true to show only staged changes. Set file_path to diff a specific file.",
            parameters={
                "type": "object",
                "properties": {
                    "staged": {
                        "type": "boolean",
                        "description": "If true, show only staged changes (default: false, shows unstaged)",
                    },
                    "path": {
                        "type": "string",
                        "description": "Path to the git repository (default: current directory)",
                    },
                    "file_path": {
                        "type": "string",
                        "description": "Show diff for a specific file only",
                    },
                },
            },
        ),
        _handle_git_diff,
    )

    registry.register(
        ToolDefinition(
            name="git_log",
            description="Show recent commit history. Use to understand the project's change history, find when a feature was added, or see the commit message style. Set file_path to see history for a specific file.",
            parameters={
                "type": "object",
                "properties": {
                    "count": {
                        "type": "integer",
                        "description": "Number of recent commits to show (default: 10, max: 50)",
                    },
                    "path": {
                        "type": "string",
                        "description": "Path to the git repository (default: current directory)",
                    },
                    "file_path": {
                        "type": "string",
                        "description": "Show history for a specific file only",
                    },
                },
            },
        ),
        _handle_git_log,
    )
