from __future__ import annotations

import asyncio
from abc import ABC, abstractmethod
from typing import Any, Callable, Awaitable

import structlog

from sediman.gateway.events import MessageEvent

logger = structlog.get_logger()

MessageHandler = Callable[[MessageEvent], Awaitable[str | None]]


class BaseAdapter(ABC):
    def __init__(self, platform_name: str):
        self.platform_name = platform_name
        self._message_handler: MessageHandler | None = None
        self._active_sessions: dict[str, bool] = {}
        self._pending_messages: dict[str, list[MessageEvent]] = {}
        self._interrupt_events: dict[str, asyncio.Event] = {}
        self._connected = False
        self._circuit_open = False
        self._failure_count = 0
        self._max_failures = 5

    @property
    def is_connected(self) -> bool:
        return self._connected

    @property
    def is_circuit_open(self) -> bool:
        return self._circuit_open

    def set_message_handler(self, handler: MessageHandler) -> None:
        self._message_handler = handler

    @abstractmethod
    async def connect(self) -> None:
        ...

    @abstractmethod
    async def disconnect(self) -> None:
        ...

    @abstractmethod
    async def send_message(self, chat_id: str, text: str, **kwargs: Any) -> str:
        ...

    async def on_message(self, event: MessageEvent) -> str | None:
        if self._circuit_open:
            logger.warning("adapter_circuit_open", platform=self.platform_name)
            return None

        if event.session_key in self._active_sessions:
            if event.is_command and event.command in ("/stop", "/new", "/approve", "/deny"):
                return await self._dispatch_message(event)
            if event.session_key not in self._pending_messages:
                self._pending_messages[event.session_key] = []
            self._pending_messages[event.session_key].append(event)
            interrupt_evt = self._interrupt_events.get(event.session_key)
            if interrupt_evt:
                interrupt_evt.set()
            return None

        return await self._dispatch_message(event)

    async def _dispatch_message(self, event: MessageEvent) -> str | None:
        if not self._message_handler:
            return None
        try:
            result = await self._message_handler(event)
            self._failure_count = 0
            return result
        except Exception as e:
            self._failure_count += 1
            logger.warning("adapter_dispatch_failed", platform=self.platform_name, error=str(e))
            if self._failure_count >= self._max_failures:
                self._circuit_open = True
                logger.error("adapter_circuit_tripped", platform=self.platform_name)
            return None

    def mark_session_active(self, session_key: str) -> None:
        self._active_sessions[session_key] = True

    def mark_session_inactive(self, session_key: str) -> None:
        self._active_sessions.pop(session_key, None)

    def get_pending_messages(self, session_key: str) -> list[MessageEvent]:
        return self._pending_messages.pop(session_key, [])

    def get_interrupt_event(self, session_key: str) -> asyncio.Event:
        if session_key not in self._interrupt_events:
            self._interrupt_events[session_key] = asyncio.Event()
        return self._interrupt_events[session_key]

    def reset_circuit(self) -> None:
        self._circuit_open = False
        self._failure_count = 0
