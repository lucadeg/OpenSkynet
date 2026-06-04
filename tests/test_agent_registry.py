"""Tests for Phase 1: Plug-and-play agent abstraction.

Covers:
- AgentContext: construction, defaults, post_init
- AgentTemplate: new fields (label, runner, capabilities, runner_class, is_top_level)
- Template parsing: new YAML frontmatter fields
- Template rendering: roundtrip with new fields
- AgentRunner: routing by runner field (coding, browser, orchestrator, custom, default)
- RPC handlers: agents.list, agent.dispatch
- HANDLERS registration
"""
from __future__ import annotations

import tempfile
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from sediman.agent.interrupt import InterruptSignal, AgentInterruptedError


@pytest.fixture(autouse=True)
def _reset_interrupt():
    InterruptSignal.reset_instance()
    yield
    InterruptSignal.reset_instance()


# ── AgentContext tests ───────────────────────────────────────────────


class TestAgentContext:
    def test_basic_construction(self):
        from sediman.agent.base import AgentContext

        mock_llm = MagicMock()
        ctx = AgentContext(llm=mock_llm)
        assert ctx.llm is mock_llm
        assert ctx.browser is None
        assert ctx.tool_registry is None
        assert ctx.on_step is None
        assert ctx.on_streaming_text is None
        assert ctx.memory is None
        assert ctx.conversation == []

    def test_default_interrupt(self):
        from sediman.agent.base import AgentContext

        ctx = AgentContext(llm=MagicMock())
        assert ctx.interrupt is not None
        assert isinstance(ctx.interrupt, InterruptSignal)

    def test_custom_interrupt(self):
        from sediman.agent.base import AgentContext

        sig = InterruptSignal()
        ctx = AgentContext(llm=MagicMock(), interrupt=sig)
        assert ctx.interrupt is sig

    def test_all_fields(self):
        from sediman.agent.base import AgentContext

        llm = MagicMock()
        browser = MagicMock()
        tools = MagicMock()
        step_fn = lambda e: None
        stream_fn = lambda t, p: None
        memory = MagicMock()

        ctx = AgentContext(
            llm=llm,
            browser=browser,
            tool_registry=tools,
            on_step=step_fn,
            on_streaming_text=stream_fn,
            interrupt=InterruptSignal(),
            memory=memory,
            conversation=[{"role": "user", "content": "hi"}],
        )

        assert ctx.browser is browser
        assert ctx.tool_registry is tools
        assert ctx.on_step is step_fn
        assert ctx.on_streaming_text is stream_fn
        assert ctx.memory is memory
        assert len(ctx.conversation) == 1


# ── AgentTemplate new fields tests ──────────────────────────────────


class TestAgentTemplateNewFields:
    def test_label_default_empty(self):
        from sediman.agent.subagents.template import AgentTemplate

        t = AgentTemplate(name="test")
        assert t.label == ""

    def test_runner_default_empty(self):
        from sediman.agent.subagents.template import AgentTemplate

        t = AgentTemplate(name="test")
        assert t.runner == ""

    def test_capabilities_default_empty(self):
        from sediman.agent.subagents.template import AgentTemplate

        t = AgentTemplate(name="test")
        assert t.capabilities == []

    def test_runner_class_default_none(self):
        from sediman.agent.subagents.template import AgentTemplate

        t = AgentTemplate(name="test")
        assert t.runner_class is None

    def test_is_top_level_true(self):
        from sediman.agent.subagents.template import AgentTemplate

        t = AgentTemplate(name="fe", mode="top-level")
        assert t.is_top_level is True

    def test_is_top_level_false_subagent(self):
        from sediman.agent.subagents.template import AgentTemplate

        t = AgentTemplate(name="code", mode="subagent")
        assert t.is_top_level is False

    def test_is_top_level_false_default(self):
        from sediman.agent.subagents.template import AgentTemplate

        t = AgentTemplate(name="test")
        assert t.is_top_level is False

    def test_to_dict_includes_new_fields(self):
        from sediman.agent.subagents.template import AgentTemplate

        t = AgentTemplate(
            name="frontend",
            label="FE",
            runner="coding",
            capabilities=["fileops", "terminal", "browser"],
            runner_class="my_module.MyRunner",
        )
        d = t.to_dict()
        assert d["label"] == "FE"
        assert d["runner"] == "coding"
        assert d["capabilities"] == ["fileops", "terminal", "browser"]
        assert d["runner_class"] == "my_module.MyRunner"

    def test_to_dict_omits_empty_new_fields(self):
        from sediman.agent.subagents.template import AgentTemplate

        t = AgentTemplate(name="basic")
        d = t.to_dict()
        assert "label" not in d
        assert "runner" not in d
        assert "capabilities" not in d
        assert "runner_class" not in d


# ── Template parsing with new fields ────────────────────────────────


class TestTemplateParsingNewFields:
    def test_parse_top_level_template(self):
        from sediman.agent.subagents.template import parse_agent_file

        content = """---
name: frontend
description: "Frontend specialist"
mode: top-level
label: "FE"
runner: coding
capabilities: [fileops, terminal, browser]
permissions:
  terminal: allow
  browser: allow
max_iterations: 30
---

You are a frontend engineer.
"""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".md", delete=False) as f:
            f.write(content)
            f.flush()
            template = parse_agent_file(Path(f.name))

        assert template is not None
        assert template.name == "frontend"
        assert template.mode == "top-level"
        assert template.label == "FE"
        assert template.runner == "coding"
        assert template.capabilities == ["fileops", "terminal", "browser"]
        assert template.is_top_level is True
        assert "frontend engineer" in template.system_prompt

    def test_parse_subagent_unchanged(self):
        from sediman.agent.subagents.template import parse_agent_file

        content = """---
name: code
description: "Code agent"
mode: subagent
permissions:
  terminal: allow
max_iterations: 20
---

You write code.
"""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".md", delete=False) as f:
            f.write(content)
            f.flush()
            template = parse_agent_file(Path(f.name))

        assert template is not None
        assert template.mode == "subagent"
        assert template.label == ""
        assert template.runner == ""
        assert template.is_top_level is False

    def test_render_roundtrip_with_new_fields(self):
        from sediman.agent.subagents.template import AgentTemplate, render_agent_file, parse_agent_file

        original = AgentTemplate(
            name="devops",
            description="DevOps specialist",
            mode="top-level",
            label="DevOps",
            runner="coding",
            capabilities=["terminal", "git"],
            permissions={"terminal": "allow"},
            system_prompt="You manage infrastructure.",
            max_iterations=25,
        )
        rendered = render_agent_file(original)

        with tempfile.NamedTemporaryFile(mode="w", suffix=".md", delete=False) as f:
            f.write(rendered)
            f.flush()
            parsed = parse_agent_file(Path(f.name))

        assert parsed is not None
        assert parsed.name == "devops"
        assert parsed.label == "DevOps"
        assert parsed.runner == "coding"
        assert parsed.capabilities == ["terminal", "git"]
        assert parsed.mode == "top-level"

    def test_parse_custom_runner_class(self):
        from sediman.agent.subagents.template import parse_agent_file

        content = """---
name: custom_agent
mode: top-level
runner: custom
runner_class: "my_package.MyAgent"
---

Custom agent.
"""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".md", delete=False) as f:
            f.write(content)
            f.flush()
            template = parse_agent_file(Path(f.name))

        assert template is not None
        assert template.runner == "custom"
        assert template.runner_class == "my_package.MyAgent"


# ── AgentRegistry (SubagentRegistry extended) ──────────────────────


class TestSubagentRegistryTopLevel:
    def test_get_top_level_filters(self):
        from sediman.agent.subagents.registry import SubagentRegistry
        from sediman.agent.subagents.template import AgentTemplate

        with tempfile.TemporaryDirectory() as builtin_dir, tempfile.TemporaryDirectory() as user_dir, tempfile.TemporaryDirectory() as top_level_dir:
            (Path(builtin_dir) / "sub.md").write_text(
                '---\nname: sub\nmode: subagent\n---\n\nsub agent'
            )
            (Path(top_level_dir) / "top.md").write_text(
                '---\nname: top\nmode: top-level\nrunner: coding\nlabel: "Top"\n---\n\ntop agent'
            )

            registry = SubagentRegistry(
                builtin_dir=Path(builtin_dir),
                user_dir=Path(user_dir),
                top_level_dir=Path(top_level_dir),
            )
            top_level = [t for t in registry.list() if t.is_top_level]
            subagents = [t for t in registry.list() if not t.is_top_level]

            assert len(top_level) == 1
            assert top_level[0].name == "top"
            assert len(subagents) == 1
            assert subagents[0].name == "sub"


# ── AgentRunner tests ───────────────────────────────────────────────


class TestAgentRunnerRouting:
    def _make_registry(self, templates):
        from sediman.agent.subagents.registry import SubagentRegistry
        from sediman.agent.subagents.template import AgentTemplate

        registry = MagicMock(spec=SubagentRegistry)
        by_name = {t.name: t for t in templates}
        registry.get = lambda name: by_name.get(name)
        registry.list = lambda: list(templates)
        return registry

    def _make_context(self):
        from sediman.agent.base import AgentContext

        return AgentContext(
            llm=MagicMock(),
            browser=MagicMock(),
            tool_registry=MagicMock(),
            interrupt=InterruptSignal(),
        )

    @pytest.mark.asyncio
    async def test_unknown_mode_returns_error(self):
        from sediman.agent.runner import AgentRunner
        from sediman.agent.subagents.template import AgentTemplate

        registry = self._make_registry([])
        ctx = self._make_context()
        runner = AgentRunner(registry=registry, context=ctx)

        result = await runner.run("hello", mode="nonexistent")
        assert result.success is False
        assert "nonexistent" in result.result

    @pytest.mark.asyncio
    async def test_coding_runner_routes_to_coding_agent(self):
        from sediman.agent.runner import AgentRunner
        from sediman.agent.subagents.template import AgentTemplate

        template = AgentTemplate(
            name="coder", mode="top-level", runner="coding", system_prompt="code!",
            max_iterations=10,
        )
        registry = self._make_registry([template])
        ctx = self._make_context()
        runner = AgentRunner(registry=registry, context=ctx)

        mock_result = MagicMock()
        mock_result.text = "done"
        mock_result.success = True
        mock_result.tool_calls = ["read_file", "write_file"]
        mock_result.files_edited = ["main.py"]

        with patch("sediman.agent.coding_agent.CodingAgent") as MockAgent:
            instance = MockAgent.return_value
            instance.run = AsyncMock(return_value=mock_result)
            result = await runner.run("write a function", mode="coder")

        assert result.success is True
        assert result.strategy_used == "coding"

    @pytest.mark.asyncio
    async def test_browser_runner_routes_to_browser_agent(self):
        from sediman.agent.runner import AgentRunner
        from sediman.agent.subagents.template import AgentTemplate

        template = AgentTemplate(
            name="browser_mode", mode="top-level", runner="browser", max_iterations=15,
        )
        registry = self._make_registry([template])
        ctx = self._make_context()
        runner = AgentRunner(registry=registry, context=ctx)

        mock_result = MagicMock()
        mock_result.text = "page loaded"
        mock_result.actions = [{"action": "navigate"}]

        with patch("sediman.agent.browser_agent.BrowserSubagent") as MockAgent:
            instance = MockAgent.return_value
            instance.run = AsyncMock(return_value=mock_result)
            result = await runner.run("go to https://example.com", mode="browser_mode")

        assert result.success is True
        assert result.result == "page loaded"
        assert result.strategy_used == "browser"

    @pytest.mark.asyncio
    async def test_browser_runner_without_browser_returns_error(self):
        from sediman.agent.runner import AgentRunner
        from sediman.agent.base import AgentContext
        from sediman.agent.subagents.template import AgentTemplate

        template = AgentTemplate(name="brow", mode="top-level", runner="browser")
        registry = self._make_registry([template])
        ctx = AgentContext(llm=MagicMock(), browser=None)
        runner = AgentRunner(registry=registry, context=ctx)

        result = await runner.run("browse", mode="brow")
        assert result.success is False
        assert "Browser not available" in result.result

    @pytest.mark.asyncio
    async def test_custom_runner_without_class_returns_error(self):
        from sediman.agent.runner import AgentRunner
        from sediman.agent.subagents.template import AgentTemplate

        template = AgentTemplate(name="custom", mode="top-level", runner="custom")
        registry = self._make_registry([template])
        ctx = self._make_context()
        runner = AgentRunner(registry=registry, context=ctx)

        result = await runner.run("task", mode="custom")
        assert result.success is False
        assert "runner_class" in result.result

    @pytest.mark.asyncio
    async def test_custom_runner_bad_import_returns_error(self):
        from sediman.agent.runner import AgentRunner
        from sediman.agent.subagents.template import AgentTemplate

        template = AgentTemplate(
            name="bad", mode="top-level", runner="custom", runner_class="nonexistent.Module"
        )
        registry = self._make_registry([template])
        ctx = self._make_context()
        runner = AgentRunner(registry=registry, context=ctx)

        result = await runner.run("task", mode="bad")
        assert result.success is False
        assert "Failed to load" in result.result

    @pytest.mark.asyncio
    async def test_default_runner_routes_to_factory_spawn(self):
        from sediman.agent.runner import AgentRunner
        from sediman.agent.subagents.template import AgentTemplate
        from sediman.agent.subagents.result import SubagentResult

        template = AgentTemplate(name="general", mode="top-level", runner="default")
        registry = self._make_registry([template])
        ctx = self._make_context()
        runner = AgentRunner(registry=registry, context=ctx)

        sub_result = SubagentResult(success=True, summary="done", iterations=3)

        with patch("sediman.agent.subagents.factory.SubagentFactory") as MockFactory:
            instance = MockFactory.return_value
            instance.spawn = AsyncMock(return_value=sub_result)
            result = await runner.run("general task", mode="general")

        assert result.success is True
        assert result.strategy_used == "direct"

    @pytest.mark.asyncio
    async def test_interrupt_clears_before_run(self):
        from sediman.agent.runner import AgentRunner
        from sediman.agent.subagents.template import AgentTemplate

        template = AgentTemplate(name="test", mode="top-level", runner="coding", system_prompt="go")
        registry = self._make_registry([template])
        sig = InterruptSignal()
        sig.trigger("test")
        ctx = self._make_context()
        ctx.interrupt = sig
        runner = AgentRunner(registry=registry, context=ctx)

        mock_result = MagicMock()
        mock_result.text = "ok"
        mock_result.success = True
        mock_result.tool_calls = []
        mock_result.files_edited = []

        with patch("sediman.agent.coding_agent.CodingAgent") as MockAgent:
            instance = MockAgent.return_value
            instance.run = AsyncMock(return_value=mock_result)
            await runner.run("task", mode="test")

        assert not sig.is_set()


# ── RPC Handler tests ───────────────────────────────────────────────


class TestAgentsListHandler:
    @pytest.mark.asyncio
    async def test_returns_top_level_agents(self):
        from sediman.rpc_server import handle_agents_list

        mock_template = MagicMock()
        mock_template.is_top_level = True
        mock_template.name = "frontend"
        mock_template.label = "FE"
        mock_template.description = "Frontend specialist"
        mock_template.runner = "coding"
        mock_template.capabilities = ["fileops", "terminal"]

        mock_subagent = MagicMock()
        mock_subagent.is_top_level = False
        mock_subagent.name = "code"

        with patch("sediman.agent.subagents.registry.SubagentRegistry") as MockReg:
            instance = MockReg.return_value
            instance.list.return_value = [mock_template, mock_subagent]
            result = await handle_agents_list({})

        assert len(result["agents"]) == 1
        assert result["agents"][0]["mode"] == "frontend"
        assert result["agents"][0]["label"] == "FE"

    @pytest.mark.asyncio
    async def test_empty_when_no_top_level(self):
        from sediman.rpc_server import handle_agents_list

        mock_sub = MagicMock()
        mock_sub.is_top_level = False
        mock_sub.name = "code"

        with patch("sediman.agent.subagents.registry.SubagentRegistry") as MockReg:
            instance = MockReg.return_value
            instance.list.return_value = [mock_sub]
            result = await handle_agents_list({})

        assert result["agents"] == []

    @pytest.mark.asyncio
    async def test_label_fallback_to_name_prefix(self):
        from sediman.rpc_server import handle_agents_list

        mock_t = MagicMock()
        mock_t.is_top_level = True
        mock_t.name = "devops"
        mock_t.label = ""
        mock_t.description = "DevOps"
        mock_t.runner = "coding"
        mock_t.capabilities = []

        with patch("sediman.agent.subagents.registry.SubagentRegistry") as MockReg:
            instance = MockReg.return_value
            instance.list.return_value = [mock_t]
            result = await handle_agents_list({})

        assert result["agents"][0]["label"] == "Dev"


class TestAgentDispatchHandler:
    @pytest.mark.asyncio
    async def test_missing_task_raises(self):
        from sediman.rpc_server import handle_agent_dispatch

        with pytest.raises(ValueError, match="task is required"):
            await handle_agent_dispatch({})

    @pytest.mark.asyncio
    async def test_empty_task_raises(self):
        from sediman.rpc_server import handle_agent_dispatch

        with pytest.raises(ValueError, match="task is required"):
            await handle_agent_dispatch({"task": "  "})

    @pytest.mark.asyncio
    async def test_dispatch_calls_runner(self):
        from sediman.rpc_server import handle_agent_dispatch
        from sediman.agent.types import AgentResult

        mock_agent = MagicMock()
        mock_agent.on_step = None
        mock_agent.on_streaming_text = None
        mock_agent._tool_registry = None
        mock_agent._conversation = []
        mock_agent._memory = None

        mock_result = AgentResult(task="hi", result="done", success=True)

        with patch("sediman.rpc_server._get_agent_loop", new_callable=AsyncMock, return_value=mock_agent):
            with patch("sediman.rpc_server._get_llm", return_value=MagicMock()):
                with patch("sediman.rpc_server._browser", None):
                    with patch("sediman.agent.subagents.registry.SubagentRegistry"):
                        with patch("sediman.agent.runner.AgentRunner") as MockRunner:
                            MockRunner.return_value.run = AsyncMock(return_value=mock_result)
                            result = await handle_agent_dispatch({"task": "hi", "mode": "coder"})

        assert result["success"] is True
        assert result["result"] == "done"


class TestHandlersRegistrationNew:
    def test_agents_list_registered(self):
        from sediman.rpc_server import HANDLERS
        assert "agents.list" in HANDLERS

    def test_agent_dispatch_registered(self):
        from sediman.rpc_server import HANDLERS
        assert "agent.dispatch" in HANDLERS
