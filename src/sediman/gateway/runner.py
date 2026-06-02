from __future__ import annotations

import asyncio
from typing import Any

import structlog

from sediman.gateway.base import BaseAdapter
from sediman.gateway.events import MessageEvent

logger = structlog.get_logger()


class GatewayRunner:
    def __init__(self) -> None:
        self._adapters: dict[str, BaseAdapter] = {}
        self._running_agents: dict[str, Any] = {}
        self._allowed_users: dict[str, set[str]] = {}
        self._home_channels: dict[str, str] = {}

    def register_adapter(self, adapter: BaseAdapter) -> None:
        self._adapters[adapter.platform_name] = adapter
        adapter.set_message_handler(self._handle_message)
        logger.info("gateway_adapter_registered", platform=adapter.platform_name)

    def unregister_adapter(self, platform_name: str) -> None:
        adapter = self._adapters.pop(platform_name, None)
        if adapter:
            adapter.set_message_handler(None)
            logger.info("gateway_adapter_unregistered", platform=platform_name)

    async def start(self) -> None:
        for name, adapter in self._adapters.items():
            try:
                await adapter.connect()
                logger.info("gateway_adapter_connected", platform=name)
            except Exception as e:
                logger.error("gateway_adapter_connect_failed", platform=name, error=str(e))
        logger.info("gateway_started", adapters=list(self._adapters.keys()))

    async def stop(self) -> None:
        for name, adapter in self._adapters.items():
            try:
                await adapter.disconnect()
                logger.info("gateway_adapter_disconnected", platform=name)
            except Exception as e:
                logger.warning("gateway_adapter_disconnect_failed", platform=name, error=str(e))
        self._adapters.clear()
        logger.info("gateway_stopped")

    async def _handle_message(self, event: MessageEvent) -> str | None:
        session_key = event.session_key

        if not self._is_authorized(event):
            logger.warning("gateway_unauthorized", platform=event.platform, user_id=event.user_id)
            adapter = self._adapters.get(event.platform)
            if adapter:
                await adapter.send_message(event.chat_id, "You are not authorized to use this bot.")
            return None

        if event.is_command:
            return await self._handle_command(event)

        if session_key in self._running_agents:
            return await self._handle_queued_message(event)

        return await self._run_agent(event)

    def _is_authorized(self, event: MessageEvent) -> bool:
        platform_users = self._allowed_users.get(event.platform)
        if platform_users is None:
            return True
        return event.user_id in platform_users

    async def _handle_command(self, event: MessageEvent) -> str | None:
        command = event.command
        if not command:
            return None

        adapter = self._adapters.get(event.platform)
        if not adapter:
            return None

        if command == "/new" or command == "/reset":
            return "Session reset."
        elif command == "/stop":
            return "Agent stopped."
        elif command == "/help":
            help_text = (
                "**Commands:**\n"
                "/new — Start fresh conversation\n"
                "/stop — Stop current task\n"
                "/model — Switch model\n"
                "/skills — Browse skills\n"
                "/status — Check status\n"
                "/help — Show this help"
            )
            await adapter.send_message(event.chat_id, help_text)
            return None
        elif command == "/status":
            status_parts = [f"Adapters: {', '.join(self._adapters.keys())}"]
            status_parts.append(f"Active agents: {len(self._running_agents)}")
            await adapter.send_message(event.chat_id, "\n".join(status_parts))
            return None

        return None

    async def _handle_queued_message(self, event: MessageEvent) -> str | None:
        adapter = self._adapters.get(event.platform)
        if adapter:
            await adapter.send_message(event.chat_id, "Agent is busy. Your message has been queued.")
        return None

    async def _run_agent(self, event: MessageEvent) -> str | None:
        session_key = event.session_key
        adapter = self._adapters.get(event.platform)
        if not adapter:
            return None

        adapter.mark_session_active(session_key)
        self._running_agents[session_key] = True

        try:
            await adapter.send_message(event.chat_id, f"Processing: {event.text[:100]}...")

            result = f"Task completed: {event.text}"

            try:
                pending = adapter.get_pending_messages(session_key)
            except Exception:
                pending = []

            if result and adapter:
                await adapter.send_message(event.chat_id, result[:4000])

            return result
        except Exception as e:
            logger.error("gateway_agent_failed", session_key=session_key, error=str(e))
            if adapter:
                await adapter.send_message(event.chat_id, f"Error: {str(e)[:500]}")
            return None
        finally:
            adapter.mark_session_inactive(session_key)
            self._running_agents.pop(session_key, None)

    def set_allowed_users(self, platform: str, user_ids: set[str]) -> None:
        self._allowed_users[platform] = user_ids

    def set_home_channel(self, platform: str, channel: str) -> None:
        self._home_channels[platform] = channel

    async def deliver_to_home(self, platform: str, message: str) -> bool:
        channel = self._home_channels.get(platform)
        adapter = self._adapters.get(platform)
        if not channel or not adapter:
            return False
        try:
            await adapter.send_message(channel, message[:4000])
            return True
        except Exception as e:
            logger.error("gateway_delivery_failed", platform=platform, error=str(e))
            return False
