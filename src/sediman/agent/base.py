from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable

from sediman.agent.interrupt import InterruptSignal
from sediman.agent.tool_dispatch import ToolRegistry
from sediman.browser.session import BrowserSession
from sediman.llm.provider import LLMProvider


@dataclass
class AgentContext:
    """Bundles everything a top-level agent needs to execute.

    Passed to AgentRunner instead of agents importing globals
    or receiving different constructor signatures.
    """

    llm: LLMProvider
    browser: BrowserSession | None = None
    tool_registry: ToolRegistry | None = None
    on_step: Callable[[Any], None] | None = None
    on_streaming_text: Callable[[str, str], None] | None = None
    interrupt: InterruptSignal | None = None
    memory: Any = None
    conversation: list[dict[str, str]] = field(default_factory=list)

    def __post_init__(self):
        if self.interrupt is None:
            self.interrupt = InterruptSignal.get()
