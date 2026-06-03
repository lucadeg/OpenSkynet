from __future__ import annotations

from typing import Any

from sediman.gateway.base import BaseAdapter
from sediman.gateway.events import MessageEvent


class SlackAdapter(BaseAdapter):
    """Adapter for Slack platform to Gateway system."""

    def __init__(self) -> None:
        super().__init__("slack")
        self._web_client: Any = None

    async def connect(self) -> None:
        """Connect the adapter."""
        self._connected = True

    async def disconnect(self) -> None:
        """Disconnect the adapter."""
        self._connected = False

    async def send_message(self, chat_id: str, text: str, **kwargs: Any) -> str:
        """Send a message to a Slack channel.

        Args:
            chat_id: Slack channel ID
            text: Message text
            **kwargs: Additional arguments

        Returns:
            Message timestamp if successful

        Raises:
            RuntimeError: If web client is not available
        """
        if not self._web_client:
            raise RuntimeError("Slack client not available")

        # Handle message length - Slack supports 40,000 chars
        max_length = 40000
        if len(text) > max_length:
            chunks = [text[i:i+max_length] for i in range(0, len(text), max_length)]
            for chunk in chunks:
                await self._web_client.chat_postMessage(channel=chat_id, text=chunk)
            return f"Sent {len(chunks)} messages"

        await self._web_client.chat_postMessage(channel=chat_id, text=text)
        return "Message sent"

    def set_web_client(self, client: Any) -> None:
        """Set the Slack web client.

        Args:
            client: Slack WebClient instance
        """
        self._web_client = client
