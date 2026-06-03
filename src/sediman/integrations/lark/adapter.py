from __future__ import annotations

from typing import Any

from sediman.gateway.base import BaseAdapter
from sediman.gateway.events import MessageEvent


class LarkAdapter(BaseAdapter):
    """Adapter for Lark platform to Gateway system."""

    def __init__(self) -> None:
        super().__init__("lark")
        self._http_client: Any = None
        self._app_id: str = ""
        self._app_secret: str = ""

    async def connect(self) -> None:
        """Connect the adapter."""
        self._connected = True

    async def disconnect(self) -> None:
        """Disconnect the adapter."""
        self._connected = False

    async def send_message(self, chat_id: str, text: str, **kwargs: Any) -> str:
        """Send a message to a Lark chat.

        Args:
            chat_id: Lark chat ID
            text: Message text
            **kwargs: Additional arguments

        Returns:
            Success message

        Raises:
            RuntimeError: If credentials are not configured
        """
        if not self._http_client:
            raise RuntimeError("Lark client not available")

        # Handle message length - Lark limit is approximately 4096 chars
        max_length = 4096
        if len(text) > max_length:
            chunks = [text[i:i+max_length] for i in range(0, len(text), max_length)]
            for chunk in chunks:
                await self._send_lark_message(chat_id, chunk)
            return f"Sent {len(chunks)} messages"

        await self._send_lark_message(chat_id, text)
        return "Message sent"

    async def _send_lark_message(self, chat_id: str, text: str) -> None:
        """Send a message via Lark API.

        Args:
            chat_id: Lark chat ID
            text: Message text
        """
        import httpx

        # Get tenant access token
        token = await self._get_tenant_access_token()

        response = await self._http_client.post(
            "https://open.larksuite.com/open-apis/im/v1/messages",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            json={
                "msg_type": "text",
                "content": '{"text":"%s"}' % text,
                "receive_id": chat_id,
            },
        )
        response.raise_for_status()

    async def _get_tenant_access_token(self) -> str:
        """Get tenant access token for API requests.

        Returns:
            Tenant access token
        """
        import httpx

        response = await self._http_client.post(
            "https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal",
            json={
                "app_id": self._app_id,
                "app_secret": self._app_secret,
            },
        )
        response.raise_for_status()
        data = response.json()
        return data.get("tenant_access_token", "")

    def set_credentials(self, http_client: Any, app_id: str, app_secret: str) -> None:
        """Set the Lark credentials.

        Args:
            http_client: HTTP client for API requests
            app_id: Lark application ID
            app_secret: Lark application secret
        """
        self._http_client = http_client
        self._app_id = app_id
        self._app_secret = app_secret
