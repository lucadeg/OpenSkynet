from __future__ import annotations

from typing import Any

from slack_sdk.socket_mode import SocketModeClient
from slack_sdk.socket_mode.requests import SocketModeRequest
from slack_sdk.socket_mode.response import SocketModeResponse

from sediman.gateway.events import MessageEvent


class SlackListener:
    """Listener for Slack events via Socket Mode."""

    def __init__(self, bot_token: str, app_level_token: str, adapter: Any) -> None:
        """Initialize the Slack listener.

        Args:
            bot_token: Slack bot user OAuth token (xoxb-)
            app_level_token: Slack app-level token for Socket Mode (xapp-)
            adapter: SlackAdapter instance for message handling
        """
        self._bot_token = bot_token
        self._app_level_token = app_level_token
        self._adapter = adapter
        self._client: SocketModeClient | None = None

    async def listen(self) -> None:
        """Start listening for Slack events via Socket Mode.

        This method blocks indefinitely.
        """
        from slack_sdk.web.async_client import AsyncWebClient

        self._client = SocketModeClient(
            app_level_token=self._app_level_token,
            web_client=AsyncWebClient(token=self._bot_token),
        )
        self._client.socket_mode_request_handler = self._handle_event

        # Set web client on adapter
        if hasattr(self._adapter, "set_web_client"):
            self._adapter.set_web_client(self._client.web_client)

        await self._client.connect()
        # Keep running - this blocks indefinitely

    async def _handle_event(self, request: SocketModeRequest) -> None:
        """Handle incoming Slack event.

        Args:
            request: Socket mode request
        """
        if request.type == "events_api" and request.payload.get("event"):
            event = request.payload["event"]
            # Only handle text messages from users (not bots)
            if (
                event.get("type") == "message"
                and not event.get("bot_id")
                and event.get("text")
            ):
                # Create MessageEvent
                message_event = MessageEvent.from_slack(event)
                # Forward to adapter
                await self._adapter.on_message(message_event)

        # Acknowledge receipt
        if self._client:
            await self._client.send_socket_mode_response(
                SocketModeResponse(envelope_id=request.envelope_id)
            )

    async def close(self) -> None:
        """Close the Slack listener."""
        if self._client:
            await self._client.close()

    def set_adapter(self, adapter: Any) -> None:
        """Set the adapter.

        Args:
            adapter: SlackAdapter instance
        """
        self._adapter = adapter

    @property
    def client(self) -> SocketModeClient | None:
        """Get the Socket Mode client."""
        return self._client
