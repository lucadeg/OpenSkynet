from __future__ import annotations

from typing import Any

import structlog

from sediman.agent.base import AgentContext
from sediman.agent.interrupt import AgentInterruptedError
from sediman.agent.subagents.factory import SubagentFactory
from sediman.agent.subagents.permissions import PermissionRules
from sediman.agent.subagents.registry import SubagentRegistry
from sediman.agent.subagents.result import SubagentResult
from sediman.agent.subagents.template import AgentTemplate
from sediman.agent.types import AgentResult

logger = structlog.get_logger()


class AgentRunner:
    """Routes a top-level agent task to the correct execution engine.

    Uses the template's `runner` field to decide:
    - "coding" → CodingAgent with template's system_prompt and permissions
    - "browser" → BrowserSubagent with template's system_prompt
    - "orchestrator" → SystemOrchestrator pattern
    - "custom" → dynamically loaded runner_class
    - "default" → SubagentSession with LLM + tools (the general case)
    """

    def __init__(self, registry: SubagentRegistry, context: AgentContext):
        self.registry = registry
        self.ctx = context

    async def run(self, task: str, mode: str) -> AgentResult:
        template = self._resolve_template(mode)
        if template is None:
            return AgentResult(
                task=task,
                result=f"Unknown agent mode: '{mode}'",
                success=False,
            )

        if self.ctx.interrupt:
            self.ctx.interrupt.clear()

        runner = template.runner or "default"

        if runner == "coding":
            return await self._run_coding(template, task)
        elif runner == "browser":
            return await self._run_browser(template, task)
        elif runner == "orchestrator":
            return await self._run_orchestrator(template, task)
        elif runner == "custom":
            return await self._run_custom(template, task)
        else:
            return await self._run_default(template, task)

    async def _run_coding(self, template: AgentTemplate, task: str) -> AgentResult:
        from sediman.agent.coding_agent import CodingAgent

        agent = CodingAgent(
            llm_provider=self.ctx.llm,
            max_rounds=template.max_iterations,
            on_step=self.ctx.on_step,
            on_streaming_text=self.ctx.on_streaming_text,
            system_prompt_override=template.system_prompt or None,
        )
        try:
            result = await agent.run(task)
        except AgentInterruptedError:
            return AgentResult(task=task, result="Task cancelled.", success=False)
        return _coding_to_agent_result(task, result)

    async def _run_browser(self, template: AgentTemplate, task: str) -> AgentResult:
        from sediman.agent.browser_agent import BrowserSubagent

        if not self.ctx.browser:
            return AgentResult(
                task=task,
                result="Browser not available for this agent.",
                success=False,
            )

        agent = BrowserSubagent(
            browser_session=self.ctx.browser,
            llm_provider=self.ctx.llm,
            max_steps=template.max_iterations,
            on_browser_step=self.ctx.on_step,
        )
        try:
            result = await agent.run(task)
        except AgentInterruptedError:
            return AgentResult(task=task, result="Task cancelled.", success=False)
        return AgentResult(
            task=task,
            result=result.text,
            success=True,
            strategy_used="browser",
        )

    async def _run_orchestrator(self, template: AgentTemplate, task: str) -> AgentResult:
        from sediman.agent.system.orchestrator import SystemOrchestrator
        from sediman.agent.system.types import WorkflowConfig

        factory = SubagentFactory(
            registry=self.registry,
            llm_provider=self.ctx.llm,
            browser_session=self.ctx.browser,
            tool_registry=self.ctx.tool_registry,
            on_step=self.ctx.on_step,
            on_streaming_text=self.ctx.on_streaming_text,
        )
        orchestrator = SystemOrchestrator(
            llm_provider=self.ctx.llm,
            manager=None,
            factory=factory,
            config=WorkflowConfig(),
        )
        try:
            subtasks = await self._decompose(orchestrator, task)
            wf_result = await orchestrator.run(task, subtasks)
        except AgentInterruptedError:
            return AgentResult(task=task, result="Task cancelled.", success=False)

        steps = []
        for issue in wf_result.resolved:
            steps.append({"phase": "resolved", "action": issue.title})
        for issue in wf_result.failed:
            steps.append({"phase": "failed", "action": issue.title})

        return AgentResult(
            task=task,
            result=wf_result.summary,
            success=wf_result.success,
            actions_taken=wf_result.actions_taken or [],
            strategy_used="orchestrator",
        )

    async def _decompose(self, orchestrator: Any, task: str) -> list[str]:
        import json
        decompose_prompt = (
            f"Break down this task into small, independent subtasks:\n\n{task}\n\n"
            "Return a JSON array of objects with 'title' and optional 'description' fields."
        )
        resp = await self.ctx.llm.chat(
            messages=[{"role": "user", "content": decompose_prompt}],
            tools=[],
        )
        try:
            text = resp.text or "[]"
            start = text.index("[")
            end = text.rindex("]") + 1
            items = json.loads(text[start:end])
            return items if isinstance(items, list) else [task]
        except (json.JSONDecodeError, ValueError):
            return [task]

    async def _run_custom(self, template: AgentTemplate, task: str) -> AgentResult:
        if not template.runner_class:
            return AgentResult(
                task=task,
                result=f"Custom runner specified but no runner_class in template '{template.name}'.",
                success=False,
            )

        try:
            cls = _import_class(template.runner_class)
        except (ImportError, AttributeError) as e:
            return AgentResult(
                task=task,
                result=f"Failed to load runner_class '{template.runner_class}': {e}",
                success=False,
            )

        instance = cls(template=template, context=self.ctx)
        try:
            result = await instance.run(task)
        except AgentInterruptedError:
            return AgentResult(task=task, result="Task cancelled.", success=False)

        if isinstance(result, AgentResult):
            return result
        if isinstance(result, SubagentResult):
            return _subagent_to_agent_result(task, result)
        return AgentResult(task=task, result=str(result), success=True)

    def _resolve_template(self, mode: str) -> AgentTemplate | None:
        template = self.registry.get(mode)
        if template is not None and template.is_top_level:
            return template

        defaults = {
            "manager": AgentTemplate(
                name="manager", mode="top-level", runner="default",
                label="Mgr", max_iterations=50,
            ),
            "browser": AgentTemplate(
                name="browser", mode="top-level", runner="browser",
                label="Brow", max_iterations=25,
            ),
            "coder": AgentTemplate(
                name="coder", mode="top-level", runner="coding",
                label="Code", max_iterations=30,
            ),
            "terminator": AgentTemplate(
                name="terminator", mode="top-level", runner="orchestrator",
                label="Term", max_iterations=100,
            ),
        }
        return defaults.get(mode)
        return AgentResult(task=task, result=str(result), success=True)

    async def _run_default(self, template: AgentTemplate, task: str) -> AgentResult:
        factory = SubagentFactory(
            registry=self.registry,
            llm_provider=self.ctx.llm,
            browser_session=self.ctx.browser,
            tool_registry=self.ctx.tool_registry,
            on_step=self.ctx.on_step,
            on_streaming_text=self.ctx.on_streaming_text,
        )
        try:
            result = await factory.spawn(template.name, task)
        except AgentInterruptedError:
            return AgentResult(task=task, result="Task cancelled.", success=False)
        return _subagent_to_agent_result(task, result)


def _coding_to_agent_result(task: str, result: Any) -> AgentResult:
    return AgentResult(
        task=task,
        result=result.text,
        success=result.success,
        actions_taken=[
            {"tool": name, "args": {}} for name in (result.tool_calls or [])
        ],
        iterations=result.tool_calls and len(result.tool_calls) or 0,
        strategy_used="coding",
    )


def _subagent_to_agent_result(task: str, result: SubagentResult) -> AgentResult:
    return AgentResult(
        task=task,
        result=result.summary,
        success=result.success,
        actions_taken=result.actions_taken,
        iterations=result.iterations,
        strategy_used=result.strategy_used,
    )


def _import_class(dotted_path: str):
    module_path, class_name = dotted_path.rsplit(".", 1)
    import importlib
    module = importlib.import_module(module_path)
    return getattr(module, class_name)
