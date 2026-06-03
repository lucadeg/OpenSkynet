"""WeChat integration using Tencent's iLink Bot API.

Adapted from Hermes Agent WeChat implementation for personal WeChat accounts.
"""
from __future__ import annotations

import base64
import hashlib
import json
import secrets
import struct
import time
from typing import Any

import aiohttp

from sediman.gateway.base import BaseAdapter
from sediman.gateway.events import MessageEvent

# iLink API constants
ILINK_BASE_URL = "https://ilinkai.weixin.qq.com"
WEIXIN_CDN_BASE_URL = "https://novac2c.cdn.weixin.qq.com/c2c"
ILINK_APP_ID = "bot"
CHANNEL_VERSION = "2.2.0"
ILINK_APP_CLIENT_VERSION = (2 << 16) | (2 << 8) | 0

# API endpoints
EP_GET_UPDATES = "ilink/bot/getupdates"
EP_SEND_MESSAGE = "ilink/bot/sendmessage"

# Timeout settings
LONG_POLL_TIMEOUT_MS = 35_000
API_TIMEOUT_MS = 15_000

# Message constants
MSG_TYPE_USER = 1
MSG_TYPE_BOT = 2
MSG_STATE_FINISH = 2
ITEM_TEXT = 1


def _random_wechat_uin() -> str:
    """Generate a random WeChat UIN header value."""
    value = struct.unpack(">I", secrets.token_bytes(4))[0]
    return base64.b64encode(str(value).encode("utf-8")).decode("ascii")


def _json_dumps(payload: dict[str, Any]) -> str:
    """Serialize JSON with minimal whitespace."""
    return json.dumps(payload, ensure_ascii=False, separators=(",", ":"))


def _base_info() -> dict[str, Any]:
    """Return base info required for all iLink API requests."""
    return {"channel_version": CHANNEL_VERSION}


def _headers(token: str, body: str) -> dict[str, str]:
    """Generate HTTP headers for iLink API requests."""
    return {
        "Content-Type": "application/json",
        "AuthorizationType": "ilink_bot_token",
        "Content-Length": str(len(body.encode("utf-8"))),
        "X-WECHAT-UIN": _random_wechat_uin(),
        "iLink-App-Id": ILINK_APP_ID,
        "iLink-App-ClientVersion": str(ILINK_APP_CLIENT_VERSION),
        "Authorization": f"Bearer {token}",
    }


class WeChatAdapter(BaseAdapter):
    """Adapter for WeChat platform to Gateway system using iLink Bot API."""

    def __init__(self) -> None:
        super().__init__("wechat")
        self._http_session: aiohttp.ClientSession | None = None
        self._account_id: str = ""
        self._token: str = ""
        self._base_url: str = ILINK_BASE_URL
        self._cdn_base_url: str = WEIXIN_CDN_BASE_URL
        self._sync_buf: str = ""
        self._context_tokens: dict[str, str] = {}

    async def connect(self) -> None:
        """Connect the adapter."""
        self._http_session = aiohttp.ClientSession()
        self._connected = True

    async def disconnect(self) -> None:
        """Disconnect the adapter."""
        if self._http_session and not self._http_session.closed:
            await self._http_session.close()
        self._connected = False

    async def send_message(self, chat_id: str, text: str, **kwargs: Any) -> str:
        """Send a message to a WeChat user.

        Args:
            chat_id: WeChat user ID
            text: Message text
            **kwargs: Additional arguments

        Returns:
            Success message

        Raises:
            RuntimeError: If client is not available
        """
        if not self._http_session or not self._token:
            raise RuntimeError("WeChat client not available")

        # WeChat message limit is approximately 2000 characters
        max_length = 2000
        if len(text) > max_length:
            chunks = [text[i:i+max_length] for i in range(0, len(text), max_length)]
            for chunk in chunks:
                await self._send_message_chunk(chat_id, chunk)
            return f"Sent {len(chunks)} messages"

        await self._send_message_chunk(chat_id, text)
        return "Message sent"

    async def _send_message_chunk(self, to_user_id: str, text: str) -> None:
        """Send a single text message via iLink API."""
        context_token = self._context_tokens.get(to_user_id, "")
        client_id = f"openskynet-wechat-{secrets.token_hex(8)}"

        payload = {
            "msg": {
                "from_user_id": "",
                "to_user_id": to_user_id,
                "client_id": client_id,
                "message_type": MSG_TYPE_BOT,
                "message_state": MSG_STATE_FINISH,
                "item_list": [{"type": ITEM_TEXT, "text_item": {"text": text}}],
            },
            "base_info": _base_info(),
        }

        if context_token:
            payload["msg"]["context_token"] = context_token

        body = _json_dumps(payload)
        url = f"{self._base_url}/{EP_SEND_MESSAGE}"

        async with self._http_session.post(url, data=body, headers=_headers(self._token, body)) as response:
            raw = await response.text()
            if not response.ok:
                raise RuntimeError(f"iLink sendmessage error HTTP {response.status}: {raw[:200]}")
            result = json.loads(raw)
            ret = result.get("ret", 0)
            if ret != 0:
                raise RuntimeError(f"iLink sendmessage error ret={ret}: {result.get('errmsg', '')}")

    def set_credentials(self, account_id: str, token: str, base_url: str = "") -> None:
        """Set WeChat credentials.

        Args:
            account_id: WeChat account ID
            token: iLink bot token
            base_url: Optional custom base URL
        """
        self._account_id = account_id
        self._token = token
        if base_url:
            self._base_url = base_url.rstrip("/")

    def set_sync_buf(self, sync_buf: str) -> None:
        """Set the sync buffer for long polling.

        Args:
            sync_buf: Sync buffer token
        """
        self._sync_buf = sync_buf

    def get_sync_buf(self) -> str:
        """Get the current sync buffer."""
        return self._sync_buf

    def set_context_token(self, user_id: str, token: str) -> None:
        """Store a context token for a user.

        Args:
            user_id: WeChat user ID
            token: Context token from incoming message
        """
        self._context_tokens[user_id] = token

    def get_context_token(self, user_id: str) -> str | None:
        """Get the context token for a user.

        Args:
            user_id: WeChat user ID

        Returns:
            Context token if available
        """
        return self._context_tokens.get(user_id)
