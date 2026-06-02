from __future__ import annotations

from typing import Any

import structlog

from sediman.agent.tool_dispatch import ToolResult

logger = structlog.get_logger()


async def _handle_send_message(action: str = "send", target: str | None = None, content: str | None = None, **kwargs: Any) -> ToolResult:
    from sediman.integrations import get_integration, get_config

    if action == "list":
        config = get_config()
        targets = []
        for name, cfg in config.items():
            if not cfg.get("enabled"):
                continue
            channels = cfg.get("channels", {})
            chats = cfg.get("chats", {})
            for key, cid in {**channels, **chats}.items():
                targets.append(f"{name}:{key}")
        if not targets:
            return ToolResult(success=True, output="No messaging targets configured. Use 'sediman integration configure' to set up Discord or Telegram.")
        return ToolResult(success=True, output="Available targets:\n" + "\n".join(f"  {t}" for t in targets))

    if action == "send":
        if not target or not content:
            return ToolResult(success=False, output="target and content are required for send action. Use action='list' to see available targets.")

        if ":" not in target:
            return ToolResult(success=False, output="Target format: 'platform:channel_key' (e.g., 'discord:alerts', 'telegram:admin'). Use action='list' to see available targets.")

        integration_name, channel_key = target.split(":", 1)
        inst = get_integration(integration_name)
        if not inst:
            return ToolResult(success=False, output=f"Integration '{integration_name}' not found or not enabled.")

        try:
            result = await inst.send(channel_key, content)
            return ToolResult(success=True, output=f"Message sent to {target}: {result}")
        except Exception as e:
            return ToolResult(success=False, output=f"Failed to send message: {e}")

    return ToolResult(success=False, output=f"Unknown action: {action}. Use 'list' or 'send'.")
