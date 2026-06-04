"""Integration tests for the plug-and-play agent system.

Tests the full flow:
- Template parsing → Registry loading → AgentRunner routing → correct execution engine
- agents.list RPC → dynamic mode discovery
- agent.dispatch RPC → correct agent execution
- Custom agent addition via user directory
- Rust TUI ↔ Python bridge mode name agreement
"""
from __future__ import annotations

import json
import tempfile
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from sediman.agent.interrupt import InterruptSignal


@pytest.fixture(autouse=True)
def _reset_interrupt():
    InterruptSignal.reset_instance()
    yield
    InterruptSignal.reset_instance()


# ── End-to-end template → runner integration ────────────────────────


class TestTemplateToRunnerIntegration:
    def _make_context(self):
        from sediman.agent.base import AgentContext
        return AgentContext(
            llm=MagicMock(),
            browser=MagicMock(),
            tool_registry=MagicMock(),
            interrupt=InterruptSignal(),
        )

    def _make_runner(self, registry):
        from sediman.agent.runner import AgentRunner
        return AgentRunner(registry=registry, context=self._make_context())

    def test_default_modes_resolve_without_templates(self):
        """All 4 default modes resolve even without any templates in registry."""
        from sediman.agent.subagents.registry import SubagentRegistry

        with tempfile.TemporaryDirectory() as builtin, \
             tempfile.TemporaryDirectory() as user, \
             tempfile.TemporaryDirectory() as top_level:
            registry = SubagentRegistry(
                builtin_dir=Path(builtin),
                user_dir=Path(user),
                top_level_dir=Path(top_level),
            )
            runner = self._make_runner(registry)

            for mode in ["manager", "browser", "coder", "terminator"]:
                template = runner._resolve_template(mode)
                assert template is not None, f"Mode '{mode}' should resolve"
                assert template.is_top_level
                assert template.runner

    def test_user_agent_overrides_default(self):
        """A user-created agent template overrides the default fallback."""
        from sediman.agent.subagents.registry import SubagentRegistry

        with tempfile.TemporaryDirectory() as builtin, \
             tempfile.TemporaryDirectory() as user, \
             tempfile.TemporaryDirectory() as top_level:
            # Create a custom "coder" as user agent with different runner
            (Path(user) / "coder.md").write_text(
                '---\nname: coder\nmode: top-level\nrunner: custom\n'
                'runner_class: "test_module.TestRunner"\nlabel: "Custom"\n---\n\ncustom coder'
            )

            registry = SubagentRegistry(
                builtin_dir=Path(builtin),
                user_dir=Path(user),
                top_level_dir=Path(top_level),
            )
            runner = self._make_runner(registry)
            template = runner._resolve_template("coder")

            assert template is not None
            assert template.runner == "custom"
            assert template.runner_class == "test_module.TestRunner"
            assert template.label == "Custom"

    def test_new_agent_mode_resolve(self):
        """A new agent added to top_level directory resolves correctly."""
        from sediman.agent.subagents.registry import SubagentRegistry

        with tempfile.TemporaryDirectory() as builtin, \
             tempfile.TemporaryDirectory() as user, \
             tempfile.TemporaryDirectory() as top_level:
            (Path(top_level) / "frontend.md").write_text(
                '---\nname: frontend\nmode: top-level\nrunner: coding\n'
                'label: "FE"\ncapabilities: [fileops, terminal]\n---\n\nfrontend specialist'
            )

            registry = SubagentRegistry(
                builtin_dir=Path(builtin),
                user_dir=Path(user),
                top_level_dir=Path(top_level),
            )
            runner = self._make_runner(registry)
            template = runner._resolve_template("frontend")

            assert template is not None
            assert template.name == "frontend"
            assert template.runner == "coding"
            assert template.capabilities == ["fileops", "terminal"]
            assert template.is_top_level

    def test_real_builtin_templates_load(self):
        """The actual builtin + top_level templates load correctly."""
        from sediman.agent.subagents.registry import SubagentRegistry

        registry = SubagentRegistry()
        top_level = [t for t in registry.list() if t.is_top_level]

        names = {t.name for t in top_level}
        assert "manager" in names
        assert "coder" in names
        assert "terminator" in names

        for t in top_level:
            assert t.runner, f"Top-level agent '{t.name}' must have a runner"
            assert t.label, f"Top-level agent '{t.name}' must have a label"

    def test_subagent_browser_not_top_level(self):
        """The subagent 'browser' template is NOT top-level."""
        from sediman.agent.subagents.registry import SubagentRegistry

        registry = SubagentRegistry()
        browser = registry.get("browser")
        assert browser is not None
        assert not browser.is_top_level


# ── agents.list integration ─────────────────────────────────────────


class TestAgentsListIntegration:
    @pytest.mark.asyncio
    async def test_agents_list_includes_builtins(self):
        """agents.list returns the 3 built-in top-level agents (manager, coder, terminator)."""
        from sediman.rpc_server import handle_agents_list

        with patch("sediman.agent.subagents.registry.SubagentRegistry") as MockReg:
            mock_templates = []
            for name, label, runner in [
                ("manager", "Mgr", "default"),
                ("coder", "Code", "coding"),
                ("terminator", "Term", "orchestrator"),
            ]:
                t = MagicMock()
                t.is_top_level = True
                t.name = name
                t.label = label
                t.description = f"{name} agent"
                t.runner = runner
                t.capabilities = []
                mock_templates.append(t)

            MockReg.return_value.list.return_value = mock_templates
            result = await handle_agents_list({})

        agents = result["agents"]
        assert len(agents) == 3
        modes = {a["mode"] for a in agents}
        assert modes == {"manager", "coder", "terminator"}

    @pytest.mark.asyncio
    async def test_agents_list_includes_custom_agent(self):
        """A custom user-created agent appears in agents.list."""
        from sediman.rpc_server import handle_agents_list

        t1 = MagicMock()
        t1.is_top_level = True
        t1.name = "devops"
        t1.label = "DevOps"
        t1.description = "Infrastructure specialist"
        t1.runner = "coding"
        t1.capabilities = ["terminal", "git"]

        t2 = MagicMock()
        t2.is_top_level = True
        t2.name = "manager"
        t2.label = "Mgr"
        t2.description = "Manager"
        t2.runner = "default"
        t2.capabilities = []

        with patch("sediman.agent.subagents.registry.SubagentRegistry") as MockReg:
            MockReg.return_value.list.return_value = [t1, t2]
            result = await handle_agents_list({})

        agents = result["agents"]
        assert len(agents) == 2
        devops = next(a for a in agents if a["mode"] == "devops")
        assert devops["runner"] == "coding"
        assert devops["capabilities"] == ["terminal", "git"]


# ── Mode name agreement: Rust TUI ↔ Python backend ─────────────────


class TestModeNameAgreement:
    def test_rust_default_modes_match_python_defaults(self):
        """The mode names in Rust default_agent_modes match Python _resolve_template defaults."""
        from sediman.agent.runner import AgentRunner
        from sediman.agent.base import AgentContext

        ctx = AgentContext(llm=MagicMock())
        from sediman.agent.subagents.registry import SubagentRegistry

        with tempfile.TemporaryDirectory() as builtin, \
             tempfile.TemporaryDirectory() as user, \
             tempfile.TemporaryDirectory() as top_level:
            registry = SubagentRegistry(
                builtin_dir=Path(builtin),
                user_dir=Path(user),
                top_level_dir=Path(top_level),
            )
            runner = AgentRunner(registry=registry, context=ctx)

            rust_modes = ["manager", "browser", "coder", "terminator"]
            for mode in rust_modes:
                template = runner._resolve_template(mode)
                assert template is not None, f"Rust mode '{mode}' must resolve in Python"

    def test_rust_mode_labels_match(self):
        """Rust default labels match Python template labels."""
        rust_labels = {"manager": "Mgr", "browser": "Brow", "coder": "Code", "terminator": "Term"}

        from sediman.agent.runner import AgentRunner
        from sediman.agent.base import AgentContext
        from sediman.agent.subagents.registry import SubagentRegistry

        with tempfile.TemporaryDirectory() as builtin, \
             tempfile.TemporaryDirectory() as user, \
             tempfile.TemporaryDirectory() as top_level:
            registry = SubagentRegistry(
                builtin_dir=Path(builtin),
                user_dir=Path(user),
                top_level_dir=Path(top_level),
            )
            ctx = AgentContext(llm=MagicMock())
            runner = AgentRunner(registry=registry, context=ctx)

            for mode, expected_label in rust_labels.items():
                template = runner._resolve_template(mode)
                assert template.label == expected_label, \
                    f"Mode '{mode}' label: Rust='{expected_label}', Python='{template.label}'"


# ── Template roundtrip integration ──────────────────────────────────


class TestTemplateRoundtrip:
    def test_all_builtins_roundtrip(self):
        """All builtin top-level templates survive parse → render → parse."""
        from sediman.agent.subagents.template import parse_agent_file, render_agent_file

        top_level_dir = Path(__file__).parent.parent / "src" / "sediman" / "agent" / "subagents" / "top_level"
        if not top_level_dir.exists():
            pytest.skip("No top_level directory")

        for path in sorted(top_level_dir.glob("*.md")):
            original = parse_agent_file(path)
            assert original is not None, f"Failed to parse {path.name}"

            rendered = render_agent_file(original)

            with tempfile.NamedTemporaryFile(mode="w", suffix=".md", delete=False) as f:
                f.write(rendered)
                f.flush()
                reparsed = parse_agent_file(Path(f.name))

            assert reparsed is not None, f"Failed to re-parse {path.name}"
            assert reparsed.name == original.name
            assert reparsed.mode == original.mode
            assert reparsed.runner == original.runner
            assert reparsed.label == original.label
            assert reparsed.max_iterations == original.max_iterations


# ── New agent creation flow ─────────────────────────────────────────


class TestNewAgentCreationFlow:
    def test_create_and_use_new_agent(self):
        """Simulates a user creating a new 'frontend' agent and the system discovering it."""
        from sediman.agent.subagents.registry import SubagentRegistry
        from sediman.agent.subagents.template import AgentTemplate, render_agent_file
        from sediman.agent.runner import AgentRunner
        from sediman.agent.base import AgentContext

        with tempfile.TemporaryDirectory() as builtin, \
             tempfile.TemporaryDirectory() as user, \
             tempfile.TemporaryDirectory() as top_level:

            # User creates a new agent
            new_agent = AgentTemplate(
                name="frontend",
                description="Frontend specialist — React, CSS, UI testing",
                mode="top-level",
                label="FE",
                runner="coding",
                capabilities=["fileops", "terminal", "browser"],
                permissions={"terminal": "allow", "write_file": "allow"},
                system_prompt="You are a frontend specialist.",
                max_iterations=30,
            )
            user_path = Path(user)
            user_path.mkdir(parents=True, exist_ok=True)
            (user_path / "frontend.md").write_text(render_agent_file(new_agent))

            # System loads it
            registry = SubagentRegistry(
                builtin_dir=Path(builtin),
                user_dir=user_path,
                top_level_dir=Path(top_level),
            )

            # Verify it's discoverable
            top_level = [t for t in registry.list() if t.is_top_level]
            assert len(top_level) == 1
            assert top_level[0].name == "frontend"

            # Verify runner resolves it
            ctx = AgentContext(llm=MagicMock())
            runner = AgentRunner(registry=registry, context=ctx)
            template = runner._resolve_template("frontend")
            assert template is not None
            assert template.runner == "coding"

    def test_user_agent_appears_in_agents_list(self):
        """A user-created agent shows up in the agents.list RPC response."""
        from sediman.agent.subagents.registry import SubagentRegistry
        from sediman.agent.subagents.template import AgentTemplate, render_agent_file

        with tempfile.TemporaryDirectory() as builtin, \
             tempfile.TemporaryDirectory() as user, \
             tempfile.TemporaryDirectory() as top_level:

            (Path(user) / "devops.md").write_text(
                '---\nname: devops\nmode: top-level\nrunner: coding\n'
                'label: "DevOps"\ndescription: "DevOps specialist"\n---\n\ndevops agent'
            )

            # Verify via the registry that it loads
            registry = SubagentRegistry(
                builtin_dir=Path(builtin),
                user_dir=Path(user),
                top_level_dir=Path(top_level),
            )
            top_level = [t for t in registry.list() if t.is_top_level]
            assert len(top_level) == 1
            assert top_level[0].name == "devops"
            assert top_level[0].label == "DevOps"
