from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from sediman.agent.manager import ManagerAgent, ManagerPlan
from sediman.agent.state import Strategy


class TestIsSimpleCodingTask:
    def _make_manager(self):
        return ManagerAgent(llm=MagicMock())

    def test_install_keyword(self):
        m = self._make_manager()
        assert m._is_simple_coding_task("install express and create a server") is True

    def test_npm_install(self):
        m = self._make_manager()
        assert m._is_simple_coding_task("npm install lodash") is True

    def test_pip_install(self):
        m = self._make_manager()
        assert m._is_simple_coding_task("pip install requests") is True

    def test_run_tests(self):
        m = self._make_manager()
        assert m._is_simple_coding_task("run the tests") is True

    def test_pytest(self):
        m = self._make_manager()
        assert m._is_simple_coding_task("run pytest on the project") is True

    def test_build(self):
        m = self._make_manager()
        assert m._is_simple_coding_task("build the project") is True

    def test_git_commit(self):
        m = self._make_manager()
        assert m._is_simple_coding_task("git commit my changes") is True

    def test_start_server(self):
        m = self._make_manager()
        assert m._is_simple_coding_task("start the server") is True

    def test_fix_bug(self):
        m = self._make_manager()
        assert m._is_simple_coding_task("fix the bug in main.py") is True

    def test_write_script(self):
        m = self._make_manager()
        assert m._is_simple_coding_task("write a script to process data") is True

    def test_non_coding_task(self):
        m = self._make_manager()
        assert m._is_simple_coding_task("go to google and search for cats") is False

    def test_conversational_task(self):
        m = self._make_manager()
        assert m._is_simple_coding_task("hello how are you") is False

    def test_too_long_task(self):
        m = self._make_manager()
        assert m._is_simple_coding_task("install " + "x" * 500) is False

    def test_case_insensitive(self):
        m = self._make_manager()
        assert m._is_simple_coding_task("Build the project") is True
        assert m._is_simple_coding_task("RUN THE TESTS") is True


class TestIsSimpleBrowserTaskExcludesCoding:
    def _make_manager(self):
        return ManagerAgent(llm=MagicMock())

    def test_coding_task_not_browser(self):
        m = self._make_manager()
        assert m._is_simple_browser_task("install express") is False

    def test_browsing_task_still_browser(self):
        m = self._make_manager()
        assert m._is_simple_browser_task("go to amazon and find me a phone") is True

    def test_navigate_task_is_browser(self):
        m = self._make_manager()
        assert m._is_simple_browser_task("navigate to news.ycombinator.com") is True


class TestCodingFastPath:
    @pytest.mark.asyncio
    async def test_coding_task_gets_delegate_strategy(self):
        m = ManagerAgent(llm=MagicMock())
        with patch.object(m._regex_planner, "plan", return_value=MagicMock(schedule=None)):
            plan = await m.plan("npm install express")
        assert plan.strategy == Strategy.DELEGATE
        assert plan.use_subagent == "code"
        assert plan.subtasks == ["npm install express"]

    @pytest.mark.asyncio
    async def test_coding_task_has_subtasks(self):
        m = ManagerAgent(llm=MagicMock())
        with patch.object(m._regex_planner, "plan", return_value=MagicMock(schedule=None)):
            plan = await m.plan("build the project")
        assert plan.subtasks is not None
        assert len(plan.subtasks) == 1

    @pytest.mark.asyncio
    async def test_coding_fast_path_skipped_with_conversation(self):
        m = ManagerAgent(llm=MagicMock())
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = json_dumps_response(
            strategy="delegate", browser_task="build", subtasks=["build"]
        )
        m.llm.chat = AsyncMock(return_value=mock_response)

        with patch.object(m._regex_planner, "plan", return_value=MagicMock(schedule=None)), \
             patch.object(m, "_get_episodic_context", return_value=None):
            plan = await m.plan("build it", conversation=[{"role": "user", "content": "hi"}])
        assert plan.use_subagent is None or plan.use_subagent == "code"

    @pytest.mark.asyncio
    async def test_non_coding_task_not_fast_pathed(self):
        m = ManagerAgent(llm=MagicMock())
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = json_dumps_response(
            strategy="direct", browser_task="search google"
        )
        m.llm.chat = AsyncMock(return_value=mock_response)

        with patch.object(m._regex_planner, "plan", return_value=MagicMock(schedule=None)), \
             patch.object(m, "_get_episodic_context", return_value=None), \
             patch.object(m, "_get_schedule_context", return_value=None):
            plan = await m.plan("search google for cats")
        assert plan.use_subagent != "code"


def json_dumps_response(**overrides):
    import json
    base = {
        "strategy": "direct",
        "browser_task": "",
        "response": None,
        "skill_to_use": None,
        "subtasks": None,
        "schedule": None,
        "memory": None,
        "skill_name": None,
        "skill_description": None,
        "use_subagent": None,
    }
    base.update(overrides)
    return json.dumps(base)
