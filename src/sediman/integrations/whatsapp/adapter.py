from __future__ import annotations

from typing import Any

from sediman.gateway.base import BaseAdapter
from sediman.gateway.events import MessageEvent


class WhatsAppAdapter(BaseAdapter):
    """Adapter for WhatsApp platform to Gateway system."""

    def __init__(self) -> None:
        super().__init__("whatsapp")
        self._client: Any = None

    async def connect(self) -> None:
        """Connect the adapter."""
        self._connected = True

    async def disconnect(self) -> None:
        """Disconnect the adapter."""
        self._connected = False

    async def send_message(self, chat_id: str, text: str, **kwargs: Any) -> str:
        """Send a message to a WhatsApp user.

        Args:
            chat_id: WhatsApp phone number
            text: Message text
            **kwargs: Additional arguments

        Returns:
            Success message

        Raises:
            RuntimeError: If client is not available
        """
        if not self._client:
            raise RuntimeError("WhatsApp client not available")

        # Handle message length - WhatsApp limit is 4096 chars
        max_length = 4096
        if len(text) > max_length:
            chunks = [text[i:i+max_length] for i in range(0, len(text), max_length)]
            for chunk in chunks:
                await self._client.send_message(
                    to=chat_id,
                    text=chunk,
                )
            return f"Sent {len(chunks)} messages"

        await self._client.send_message(
            to=chat_id,
            text=text,
        )
        return "Message sent"

    def set_client(self, client: Any) -> None:
        """Set the WhatsApp client.

        Args:
            client: pywa WhatsApp client instance
        """
        self._client = client
