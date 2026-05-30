from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from sediman.agent.coding_agent import CodingSubagent, CodingResult, create_coding_tool_registry
from sediman.agent.tool_dispatch import ToolRegistry
from sediman.llm.provider import LLMResponse, ToolDefinition


class TestCodingResult:
    def test_defaults(self):
        r = CodingResult(text="done")
        assert r.text == "done"
        assert r.actions == []
        assert r.success is True
        assert r.iterations == 0
        assert r.tool_calls == []

    def test_with_tool_calls(self):
        r = CodingResult(text="ok", tool_calls=["terminal", "write_file"])
        assert len(r.tool_calls) == 2


class TestCreateCodingToolRegistry:
    def test_returns_registry_with_coding_tools(self):
        registry = create_coding_tool_registry()
        names = registry.list_tools()
        assert "terminal" in names
        assert "read_file" in names
        assert "write_file" in names

    def test_excludes_browser_tools(self):
        registry = create_coding_tool_registry()
        names = registry.list_tools()
        assert "browser_navigate" not in names
        assert "browser_click" not in names
        assert "browser_type" not in names

    def test_has_search_tools(self):
        registry = create_coding_tool_registry()
        names = registry.list_tools()
        assert "search_files" in names
        assert "list_files" in names


class TestCodingSubagent:
    def _make_subagent(self, **kwargs):
        llm = MagicMock()
        return CodingSubagent(llm_provider=llm, **kwargs)

    @pytest.mark.asyncio
    async def test_run_returns_coding_result(self):
        agent = self._make_subagent()
        response = LLMResponse(text="Installed express successfully.", tool_calls=[], done=True)

        with patch("sediman.agent.coding_agent.ToolLoop") as MockLoop:
            mock_loop = MockLoop.return_value
            mock_loop.run_streaming = AsyncMock(return_value=response)
            result = await agent.run("npm install express")

        assert isinstance(result, CodingResult)
        assert "express" in result.text
        assert result.success is True

    @pytest.mark.asyncio
    async def test_run_uses_streaming(self):
        agent = self._make_subagent()
        response = LLMResponse(text="Built project.", tool_calls=[], done=True)

        with patch("sediman.agent.coding_agent.ToolLoop") as MockLoop:
            mock_loop = MockLoop.return_value
            mock_loop.run_streaming = AsyncMock(return_value=response)
            result = await agent.run("build the project")

            mock_loop.run_streaming.assert_called_once()
            call_kwargs = mock_loop.run_streaming.call_args
            assert call_kwargs.kwargs.get("on_streaming_text") is not None or (
                len(call_kwargs.args) > 0
            )

    @pytest.mark.asyncio
    async def test_on_step_callback_called(self):
        steps = []
        agent = self._make_subagent(on_step=lambda action, detail="": steps.append(action))
        response = LLMResponse(text="Done.", tool_calls=[], done=True)

        with patch("sediman.agent.coding_agent.ToolLoop") as MockLoop:
            mock_loop = MockLoop.return_value
            mock_loop.run_streaming = AsyncMock(return_value=response)
            result = await agent.run("test task")

        assert len(steps) >= 2
        assert any("starting" in s for s in steps)
        assert any("done" in s for s in steps)

    @pytest.mark.asyncio
    async def test_on_tool_call_tracks_tools(self):
        agent = self._make_subagent()
        response = LLMResponse(text="Done.", tool_calls=[], done=True)

        with patch("sediman.agent.coding_agent.ToolLoop") as MockLoop:
            mock_loop = MockLoop.return_value
            mock_loop.run_streaming = AsyncMock(return_value=response)

            def invoke_on_tool_call(**kwargs):
                on_tc = kwargs.get("on_tool_call")
                if on_tc:
                    on_tc("terminal", {"command": "ls"})
                    on_tc("write_file", {"path": "/tmp/test.py"})

            mock_loop.run_streaming.side_effect = invoke_on_tool_call
            result = await agent.run("list and create file")

    @pytest.mark.asyncio
    async def test_on_streaming_text_callback(self):
        tokens = []
        agent = self._make_subagent(
            on_streaming_text=lambda token, phase="": tokens.append((token, phase))
        )
        response = LLMResponse(text="Result text.", tool_calls=[], done=True)

        with patch("sediman.agent.coding_agent.ToolLoop") as MockLoop:
            mock_loop = MockLoop.return_value
            mock_loop.run_streaming = AsyncMock(return_value=response)
            result = await agent.run("do something")

    @pytest.mark.asyncio
    async def test_exception_handling(self):
        agent = self._make_subagent()

        with patch("sediman.agent.coding_agent.ToolLoop") as MockLoop:
            mock_loop = MockLoop.return_value
            mock_loop.run_streaming = AsyncMock(side_effect=RuntimeError("LLM error"))
            result = await agent.run("bad task")

        assert "failed" in result.text.lower()
        assert result.success is False

    @pytest.mark.asyncio
    async def test_custom_tool_registry(self):
        custom_registry = ToolRegistry()
        custom_registry.register(
            ToolDefinition(name="custom_tool", description="custom", parameters={}),
            AsyncMock(return_value=MagicMock(success=True, output="ok")),
        )
        agent = CodingSubagent(
            llm_provider=MagicMock(),
            tool_registry=custom_registry,
        )
        assert agent.registry is custom_registry
        assert "custom_tool" in agent.registry.list_tools()

    @pytest.mark.asyncio
    async def test_system_prompt_used(self):
        agent = self._make_subagent()
        response = LLMResponse(text="ok", tool_calls=[], done=True)

        with patch("sediman.agent.coding_agent.ToolLoop") as MockLoop:
            mock_loop = MockLoop.return_value
            mock_loop.run_streaming = AsyncMock(return_value=response)
            await agent.run("test")

            call_kwargs = mock_loop.run_streaming.call_args
            assert call_kwargs.kwargs.get("system") is not None
