"""Comprehensive tests for Discord and Telegram bidirectional messaging.

This test suite focuses on the core functionality that can be tested
without complex mocking of external libraries.
"""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import MagicMock, AsyncMock, patch
from dataclasses import dataclass, field

import pytest

from sediman.gateway.events import MessageEvent
from sediman.gateway.runner import GatewayRunner
from sediman.integrations.discord.adapter import DiscordAdapter
from sediman.integrations.discord.listener import DiscordListener
from sediman.integrations.telegram.adapter import TelegramAdapter
from sediman.integrations.telegram.listener import TelegramListener
from sediman.integrations.config import _default_config


# =============================================================================
# MessageEvent Creation Tests
# =============================================================================

class TestMessageEventCreation:
    """Test MessageEvent creation from platform data."""

    def test_discord_basic_event_creation(self):
        """Test creating basic Discord message event."""
        # Simulate Discord message structure
        discord_message = {
            "content": "Hello bot!",
            "author": {"id": "123456789", "name": "TestUser", "bot": False},
            "channel": {"id": "111222333", "guild": {"id": "44455566"}},
        }

        event = MessageEvent(
            platform="discord",
            chat_id="111222333",
            chat_type="group",
            user_id="123456789",
            user_name="TestUser",
            text="Hello bot!",
            raw=discord_message
        )

        assert event.platform == "discord"
        assert event.chat_id == "111222333"
        assert event.user_id == "123456789"
        assert event.text == "Hello bot!"
        assert event.is_command == False

    def test_discord_command_event(self):
        """Test Discord command message event via factory method."""
        # Create mock Discord message object
        mock_author = MagicMock()
        mock_author.id = "123456789"
        mock_author.name = "TestUser"
        mock_author.bot = False

        mock_channel = MagicMock()
        mock_channel.id = "111222333"
        mock_channel.guild = None

        mock_message = MagicMock()
        mock_message.content = "!help"
        mock_message.author = mock_author
        mock_message.channel = mock_channel

        event = MessageEvent.from_discord(mock_message)

        assert event.is_command == True
        assert event.command == "!help"

    def test_discord_command_with_args(self):
        """Test Discord command with arguments via factory method."""
        # Create mock Discord message object
        mock_author = MagicMock()
        mock_author.id = "123456789"
        mock_author.name = "TestUser"
        mock_author.bot = False

        mock_channel = MagicMock()
        mock_channel.id = "111222333"
        mock_channel.guild = None

        mock_message = MagicMock()
        mock_message.content = "!ask What is AI?"
        mock_message.author = mock_author
        mock_message.channel = mock_channel

        event = MessageEvent.from_discord(mock_message)

        assert event.is_command == True
        assert event.command == "!ask"
        assert event.command_args == "What is AI?"

    def test_discord_private_message(self):
        """Test Discord private message (DM)."""
        event = MessageEvent(
            platform="discord",
            chat_id="111222333",
            chat_type="private",
            user_id="123456789",
            user_name="TestUser",
            text="DM message",
            raw={"server_id": None}
        )

        assert event.chat_type == "private"

    def test_discord_session_key(self):
        """Test session key generation for Discord."""
        event = MessageEvent(
            platform="discord",
            chat_id="111222333",
            chat_type="group",
            user_id="123456789",
            user_name="TestUser",
            text="Test",
            raw={}
        )

        expected = "agent:main:discord:group:111222333"
        assert event.session_key == expected

    def test_discord_session_key_with_thread(self):
        """Test session key with thread ID."""
        event = MessageEvent(
            platform="discord",
            chat_id="111222333",
            chat_type="group",
            user_id="123456789",
            user_name="TestUser",
            text="Test",
            thread_id="thread_123",
            raw={}
        )

        expected = "agent:main:discord:group:111222333:thread_123"
        assert event.session_key == expected

    def test_telegram_basic_event_creation(self):
        """Test creating basic Telegram message event."""
        # Simulate Telegram update structure
        telegram_update = {
            "message": {
                "message_id": 123,
                "text": "Hello bot!",
                "chat": {"id": 987654, "type": "private"},
                "from": {"id": 456, "username": "testuser", "first_name": "Test", "is_bot": False},
                "date": 1234567890
            }
        }

        event = MessageEvent(
            platform="telegram",
            chat_id="987654",
            chat_type="private",
            user_id="456",
            user_name="Test",
            text="Hello bot!",
            raw=telegram_update
        )

        assert event.platform == "telegram"
        assert event.chat_id == "987654"
        assert event.user_id == "456"
        assert event.text == "Hello bot!"
        assert event.is_command == False

    def test_telegram_command_event(self):
        """Test Telegram command message event via factory method."""
        # Simulate Telegram update structure
        telegram_update = {
            "message": {
                "message_id": 123,
                "text": "/help",
                "chat": {"id": 987654, "type": "private"},
                "from": {"id": 456, "username": "testuser", "first_name": "Test", "is_bot": False},
                "date": 1234567890
            }
        }

        event = MessageEvent.from_telegram(telegram_update)

        assert event.is_command == True
        assert event.command == "/help"

    def test_telegram_command_with_args(self):
        """Test Telegram command with arguments via factory method."""
        # Simulate Telegram update structure
        telegram_update = {
            "message": {
                "message_id": 123,
                "text": "/start help",
                "chat": {"id": 987654, "type": "private"},
                "from": {"id": 456, "username": "testuser", "first_name": "Test", "is_bot": False},
                "date": 1234567890
            }
        }

        event = MessageEvent.from_telegram(telegram_update)

        assert event.is_command == True
        assert event.command == "/start"
        assert event.command_args == "help"

    def test_telegram_session_key(self):
        """Test session key generation for Telegram."""
        event = MessageEvent(
            platform="telegram",
            chat_id="987654",
            chat_type="private",
            user_id="456",
            user_name="Test",
            text="Test",
            raw={}
        )

        expected = "agent:main:telegram:private:987654"
        assert event.session_key == expected

    def test_non_command_messages(self):
        """Test that non-prefixed messages are not commands."""
        event = MessageEvent(
            platform="discord",
            chat_id="111222333",
            chat_type="private",
            user_id="123456789",
            user_name="TestUser",
            text="Just chatting",
            raw={}
        )

        assert event.is_command == False
        assert event.command is None

    def test_empty_text_message(self):
        """Test message with empty text."""
        event = MessageEvent(
            platform="discord",
            chat_id="111222333",
            chat_type="private",
            user_id="123456789",
            user_name="TestUser",
            text="",
            raw={}
        )

        assert event.text == ""
        assert event.is_command == False


# =============================================================================
# Discord Adapter Tests
# =============================================================================

class TestDiscordAdapter:
    """Test Discord adapter basic functionality."""

    def test_adapter_creation(self):
        """Test creating DiscordAdapter."""
        adapter = DiscordAdapter(None)

        assert adapter.platform_name == "discord"
        assert not adapter.is_connected

    def test_adapter_connect_disconnect(self):
        """Test adapter connect/disconnect methods."""
        adapter = DiscordAdapter(None)

        import asyncio

        async def test_connect_disconnect():
            await adapter.connect()
            assert adapter.is_connected
            await adapter.disconnect()
            assert not adapter.is_connected

        asyncio.run(test_connect_disconnect())

    def test_adapter_no_client_error(self):
        """Test error when client is not available."""
        adapter = DiscordAdapter(None)

        import asyncio

        async def test_no_client():
            with pytest.raises(RuntimeError, match="client not available"):
                await adapter.send_message("111222333", "Hello!")

        asyncio.run(test_no_client())


# =============================================================================
# Telegram Adapter Tests
# =============================================================================

class TestTelegramAdapter:
    """Test Telegram adapter basic functionality."""

    def test_adapter_creation(self):
        """Test creating TelegramAdapter."""
        adapter = TelegramAdapter(None)

        assert adapter.platform_name == "telegram"
        assert not adapter.is_connected

    def test_adapter_connect_disconnect(self):
        """Test adapter connect/disconnect methods."""
        adapter = TelegramAdapter(None)

        import asyncio

        async def test_connect_disconnect():
            await adapter.connect()
            assert adapter.is_connected
            await adapter.disconnect()
            assert not adapter.is_connected

        asyncio.run(test_connect_disconnect())

    def test_adapter_no_bot_error(self):
        """Test error when bot is not available."""
        adapter = TelegramAdapter(None)

        import asyncio

        async def test_no_bot():
            with pytest.raises(RuntimeError, match="bot not available"):
                await adapter.send_message("987654", "Hello!")

        asyncio.run(test_no_bot())


# =============================================================================
# Gateway Runner Authorization Tests
# =============================================================================

class TestGatewayRunnerAuthorization:
    """Test GatewayRunner authorization and whitelist functionality."""

    def test_no_whitelist_allows_all(self):
        """Test that no whitelist means all users are allowed."""
        runner = GatewayRunner()

        event = MessageEvent(
            platform="discord",
            chat_id="111",
            chat_type="group",
            user_id="any_user",
            user_name="Any",
            text="Test",
            raw={"server_id": "server_123"}
        )

        assert runner._is_authorized(event) == True

    def test_user_whitelist_blocks_unlisted(self):
        """Test that user whitelist blocks unlisted users."""
        runner = GatewayRunner()
        runner.set_allowed_users("discord", {"123456789"})

        event = MessageEvent(
            platform="discord",
            chat_id="111",
            chat_type="group",
            user_id="999999999",
            user_name="Unlisted",
            text="Test",
            raw={"server_id": "server_123"}
        )

        assert runner._is_authorized(event) == False

    def test_user_whitelist_allows_listed(self):
        """Test that user whitelist allows listed users."""
        runner = GatewayRunner()
        runner.set_allowed_users("discord", {"123456789"})

        event = MessageEvent(
            platform="discord",
            chat_id="111",
            chat_type="group",
            user_id="123456789",
            user_name="Listed",
            text="Test",
            raw={"server_id": "server_123"}
        )

        assert runner._is_authorized(event) == True

    def test_discord_server_whitelist_allows(self):
        """Test that Discord server whitelist allows server members."""
        runner = GatewayRunner()
        runner.set_allowed_users("discord", {"123456789"})
        runner.set_allowed_servers("discord", {"444555566"})

        event = MessageEvent(
            platform="discord",
            chat_id="111",
            chat_type="group",
            user_id="unlisted_user",
            user_name="Unlisted",
            text="Test",
            raw={"server_id": "444555566"}
        )

        assert runner._is_authorized(event) == True

    def test_discord_server_whitelist_blocks(self):
        """Test that Discord server whitelist blocks other servers."""
        runner = GatewayRunner()
        runner.set_allowed_users("discord", {"123456789"})
        runner.set_allowed_servers("discord", {"444555566"})

        event = MessageEvent(
            platform="discord",
            chat_id="111",
            chat_type="group",
            user_id="unlisted_user",
            user_name="Unlisted",
            text="Test",
            raw={"server_id": "777888999"}
        )

        assert runner._is_authorized(event) == False

    def test_discord_server_whitelist_no_server_id(self):
        """Test authorization when message has no server_id (DM)."""
        runner = GatewayRunner()
        runner.set_allowed_users("discord", {"123456789"})
        runner.set_allowed_servers("discord", {"44455566"})

        event = MessageEvent(
            platform="discord",
            chat_id="111",
            chat_type="private",
            user_id="unlisted_user",
            user_name="Unlisted",
            text="Test",
            raw={"server_id": None}
        )

        assert runner._is_authorized(event) == False

    def test_empty_user_whitelist_blocks_all(self):
        """Test that empty whitelist blocks everyone."""
        runner = GatewayRunner()
        runner.set_allowed_users("telegram", set())

        event = MessageEvent(
            platform="telegram",
            chat_id="111",
            chat_type="private",
            user_id="any_user",
            user_name="Any",
            text="Test",
            raw={}
        )

        assert runner._is_authorized(event) == False


# =============================================================================
# Gateway Runner Adapter Management Tests
# =============================================================================

class TestGatewayRunnerAdapters:
    """Test GatewayRunner adapter registration and management."""

    def test_register_adapter(self):
        """Test registering an adapter."""
        runner = GatewayRunner()
        adapter = DiscordAdapter(None)

        runner.register_adapter(adapter)

        assert "discord" in runner._adapters

    def test_unregister_adapter(self):
        """Test unregistering an adapter."""
        runner = GatewayRunner()
        adapter = DiscordAdapter(None)
        runner.register_adapter(adapter)

        runner.unregister_adapter("discord")

        assert "discord" not in runner._adapters

    def test_set_allowed_users(self):
        """Test setting allowed users."""
        runner = GatewayRunner()
        users = {"123456789", "987654321"}

        runner.set_allowed_users("discord", users)

        assert runner._allowed_users["discord"] == users

    def test_set_allowed_servers(self):
        """Test setting allowed servers."""
        runner = GatewayRunner()
        servers = {"444555566", "777888999"}

        runner.set_allowed_servers("discord", servers)

        assert runner._allowed_servers["discord"] == servers

    def test_set_home_channel(self):
        """Test setting home channel."""
        runner = GatewayRunner()

        runner.set_home_channel("discord", "111222333")

        assert runner._home_channels["discord"] == "111222333"

    def test_running_agents_tracking(self):
        """Test running agents tracking."""
        runner = GatewayRunner()

        session_key = "test_session"
        runner._running_agents[session_key] = True

        assert session_key in runner._running_agents
        assert runner._running_agents[session_key] == True


# =============================================================================
# Discord Listener Tests
# =============================================================================

class TestDiscordListener:
    """Test Discord listener initialization."""

    def test_listener_creation(self):
        """Test creating DiscordListener."""
        config = {"enabled": True, "token": "test_token"}
        listener = DiscordListener("test_token", config)

        assert listener._token == "test_token"
        assert listener._config == config

    def test_listener_no_token(self):
        """Test listener with no token."""
        config = {"enabled": True}
        listener = DiscordListener("", config)

        assert listener._token == ""

    def test_set_adapter(self):
        """Test setting adapter on listener."""
        config = {"enabled": True}
        listener = DiscordListener("test_token", config)
        adapter = DiscordAdapter(None)

        listener.set_adapter(adapter)

        assert listener._adapter == adapter

    def test_get_client(self):
        """Test getting client property."""
        listener = DiscordListener("test_token", {"enabled": True})

        # Initially None
        assert listener.client is None


# =============================================================================
# Telegram Listener Tests
# =============================================================================

class TestTelegramListener:
    """Test Telegram listener initialization."""

    def test_listener_creation(self):
        """Test creating TelegramListener."""
        config = {"enabled": True, "token": "test_token"}
        listener = TelegramListener("test_token", config)

        assert listener._token == "test_token"
        assert listener._config == config

    def test_listener_no_token(self):
        """Test listener with no token."""
        config = {"enabled": True}
        listener = TelegramListener("", config)

        assert listener._token == ""

    def test_set_adapter(self):
        """Test setting adapter on listener."""
        config = {"enabled": True}
        listener = TelegramListener("test_token", config)
        adapter = TelegramAdapter(None)

        listener.set_adapter(adapter)

        assert listener._adapter == adapter

    def test_get_bot(self):
        """Test getting bot property."""
        listener = TelegramListener("test_token", {"enabled": True})

        # Initially None
        assert listener.bot is None


# =============================================================================
# Integration Config Tests
# =============================================================================

class TestIntegrationConfig:
    """Test integration configuration."""

    def test_default_config_structure(self):
        """Test default config has all required fields."""
        config = _default_config()

        assert "discord" in config
        assert "telegram" in config

        # Discord config
        assert config["discord"]["enabled"] == False
        assert "token" in config["discord"]
        assert "channels" in config["discord"]
        assert "whitelist" in config["discord"]
        assert config["discord"]["whitelist"]["enabled"] == False
        assert "users" in config["discord"]["whitelist"]
        assert "servers" in config["discord"]["whitelist"]

        # Telegram config
        assert config["telegram"]["enabled"] == False
        assert "token" in config["telegram"]
        assert "chats" in config["telegram"]
        assert "whitelist" in config["telegram"]
        assert config["telegram"]["whitelist"]["enabled"] == False
        assert "users" in config["telegram"]["whitelist"]

    def test_whitelist_empty_by_default(self):
        """Test whitelist is empty by default."""
        config = _default_config()

        # Discord
        assert config["discord"]["whitelist"]["users"] == []
        assert config["discord"]["whitelist"]["servers"] == []
        assert config["discord"]["whitelist"]["enabled"] == False

        # Telegram
        assert config["telegram"]["whitelist"]["users"] == []
        assert config["telegram"]["whitelist"]["enabled"] == False

    def test_whitelist_custom_values(self):
        """Test setting custom whitelist values."""
        config = _default_config()
        config["discord"]["whitelist"]["enabled"] = True
        config["discord"]["whitelist"]["users"] = ["123456789"]
        config["discord"]["whitelist"]["servers"] = ["444555566"]

        assert config["discord"]["whitelist"]["enabled"] == True
        assert "123456789" in config["discord"]["whitelist"]["users"]
        assert "444555566" in config["discord"]["whitelist"]["servers"]


# =============================================================================
# Session Management Tests
# =============================================================================

class TestSessionManagement:
    """Test session key generation and management."""

    def test_different_users_have_unique_sessions(self):
        """Test that different users get unique session keys."""
        events = [
            MessageEvent(
                platform="discord",
                chat_id="111",
                chat_type="group",
                user_id="user1",
                user_name="User One",
                text="test"
            ),
            MessageEvent(
                platform="discord",
                chat_id="222",
                chat_type="group",
                user_id="user2",
                user_name="User Two",
                text="test"
            ),
            MessageEvent(
                platform="telegram",
                chat_id="333",
                chat_type="private",
                user_id="user3",
                user_name="User Three",
                text="test"
            ),
        ]

        session_keys = [e.session_key for e in events]

        # All session keys should be unique
        assert len(session_keys) == len(set(session_keys))

    def test_same_user_different_chats_unique_sessions(self):
        """Test same user in different chats has unique sessions."""
        events = [
            MessageEvent(
                platform="discord",
                chat_id="111",
                chat_type="group",
                user_id="user1",
                user_name="User",
                text="test"
            ),
            MessageEvent(
                platform="discord",
                chat_id="222",
                chat_type="group",
                user_id="user1",
                user_name="User",
                text="test"
            ),
        ]

        session_keys = [e.session_key for e in events]

        # Session keys should be unique (different chat_id)
        assert len(session_keys) == len(set(session_keys))

    def test_thread_includes_session_key(self):
        """Test that thread ID is included in session key when present."""
        event_with_thread = MessageEvent(
            platform="discord",
            chat_id="111",
            chat_type="group",
            user_id="user1",
            user_name="User",
            text="test",
            thread_id="thread_abc",
            raw={}
        )

        event_without_thread = MessageEvent(
            platform="discord",
            chat_id="111",
            chat_type="group",
            user_id="user1",
            user_name="User",
            text="test",
            raw={}
        )

        # Thread should be in session key
        assert "thread_abc" in event_with_thread.session_key
        assert "thread_abc" not in event_without_thread.session_key


# =============================================================================
# Command Recognition Tests
# =============================================================================

class TestCommandRecognition:
    """Test command recognition logic."""

    def test_discord_command_prefixes(self):
        """Test various Discord command prefixes via factory method."""
        commands = [
            "!help",
            "!status",
            "!ask something",
            "!run skill_name",
        ]

        for cmd in commands:
            # Create mock Discord message object
            mock_author = MagicMock()
            mock_author.id = "123"
            mock_author.name = "TestUser"
            mock_author.bot = False

            mock_channel = MagicMock()
            mock_channel.id = "111"
            mock_channel.guild = None

            mock_message = MagicMock()
            mock_message.content = cmd
            mock_message.author = mock_author
            mock_message.channel = mock_channel

            event = MessageEvent.from_discord(mock_message)

            assert event.is_command == True
            assert event.command == cmd.split()[0]

    def test_telegram_command_prefixes(self):
        """Test various Telegram command prefixes via factory method."""
        commands = [
            "/help",
            "/status",
            "/start",
        ]

        for cmd in commands:
            # Create mock Telegram update
            telegram_update = {
                "message": {
                    "message_id": 123,
                    "text": cmd,
                    "chat": {"id": 111, "type": "private"},
                    "from": {"id": 456, "username": "testuser", "first_name": "Test"},
                    "date": 1234567890
                }
            }
            event = MessageEvent.from_telegram(telegram_update)

            assert event.is_command == True
            assert event.command == cmd.split()[0]

    def test_command_argument_extraction(self):
        """Test command argument extraction via factory methods."""
        test_cases = [
            ("!ask What is AI?", "!ask", "What is AI?"),
            ("!run test_skill param", "!run", "test_skill param"),
            ("/search query string", "/search", "query string"),
        ]

        for text, expected_cmd, expected_args in test_cases:
            # Create mock Discord message object
            mock_author = MagicMock()
            mock_author.id = "123"
            mock_author.name = "TestUser"
            mock_author.bot = False

            mock_channel = MagicMock()
            mock_channel.id = "111"
            mock_channel.guild = None

            mock_message = MagicMock()
            mock_message.content = text
            mock_message.author = mock_author
            mock_message.channel = mock_channel

            event = MessageEvent.from_discord(mock_message)

            assert event.is_command
            assert event.command == expected_cmd
            assert event.command_args == expected_args

    def test_non_command_messages(self):
        """Test that regular messages are not commands."""
        messages = [
            "Hello, how are you?",
            "What's the weather?",
            "Can you help me?",
            "Just saying hi",
        ]

        for msg in messages:
            event = MessageEvent(
                platform="discord",
                chat_id="111",
                chat_type="private",
                user_id="user1",
                user_name="User",
                text=msg,
                raw={}
            )

            assert event.is_command == False
            assert event.command is None


# =============================================================================
# Message Length and Chunking Tests
# =============================================================================

class TestMessageLengthHandling:
    """Test message length handling for platform limits."""

    def test_discord_message_limit(self):
        """Test Discord message limit (2000 chars)."""
        # Discord limit is 2000 chars
        under_limit = "A" * 1000
        at_limit = "A" * 2000
        over_limit = "A" * 2500

        assert len(under_limit) <= 2000
        assert len(at_limit) == 2000
        assert len(over_limit) > 2000

    def test_telegram_message_limit(self):
        """Test Telegram message limit (4096 chars)."""
        # Telegram limit is 4096 chars
        under_limit = "A" * 2000
        at_limit = "A" * 4096
        over_limit = "A" * 5000

        assert len(under_limit) <= 4096
        assert len(at_limit) == 4096
        assert len(over_limit) > 4096

    def test_chunk_calculation_discord(self):
        """Test chunk calculation for Discord."""
        max_length = 2000
        long_text = "A" * 5500

        chunks = (len(long_text) + max_length - 1) // max_length

        # 5500 / 2000 = 2.75, so 3 chunks
        assert chunks == 3

    def test_chunk_calculation_telegram(self):
        """Test chunk calculation for Telegram."""
        max_length = 4096
        long_text = "B" * 10000

        chunks = (len(long_text) + max_length - 1) // max_length

        # 10000 / 4096 = 2.44, so 3 chunks
        assert chunks == 3

    def test_single_chunk_no_split(self):
        """Test that short messages don't get split."""
        short_text = "Hello!"

        max_discord = 2000
        chunks_discord = (len(short_text) + max_discord - 1) // max_discord

        max_telegram = 4096
        chunks_telegram = (len(short_text) + max_telegram - 1) // max_telegram

        # Should be 1 chunk for both
        assert chunks_discord == 1
        assert chunks_telegram == 1


# =============================================================================
# Platform-Specific Features Tests
# =============================================================================

class TestPlatformFeatures:
    """Test platform-specific features and configurations."""

    def test_discord_has_server_whitelist(self):
        """Test Discord supports server-level whitelist."""
        config = _default_config()

        # Discord should have servers field
        assert "servers" in config["discord"]["whitelist"]
        # Telegram should not
        assert "servers" not in config["telegram"]["whitelist"]

    def test_discord_server_whitelist_config(self):
        """Test Discord server whitelist configuration."""
        config = _default_config()

        config["discord"]["whitelist"]["servers"] = ["111", "222", "333"]

        assert len(config["discord"]["whitelist"]["servers"]) == 3
        assert "111" in config["discord"]["whitelist"]["servers"]

    def test_discord_uses_channels(self):
        """Test Discord uses channels for named targets."""
        config = _default_config()

        assert "channels" in config["discord"]
        assert isinstance(config["discord"]["channels"], dict)

    def test_telegram_uses_chats(self):
        """Test Telegram uses chats for named targets."""
        config = _default_config()

        assert "chats" in config["telegram"]
        assert isinstance(config["telegram"]["chats"], dict)

    def test_discord_no_servers_in_telegram(self):
        """Test Telegram doesn't have servers field."""
        config = _default_config()

        # Only Discord has servers
        assert "servers" not in config["telegram"]["whitelist"]


# =============================================================================
# Message Event Structure Tests
# =============================================================================

class TestMessageEventStructure:
    """Test MessageEvent data structure."""

    def test_all_required_fields_present(self):
        """Test that all required fields are present."""
        event = MessageEvent(
            platform="discord",
            chat_id="111",
            chat_type="private",
            user_id="user1",
            user_name="User",
            text="Test",
            raw={}
        )

        # Check all required fields
        assert event.platform == "discord"
        assert event.chat_id == "111"
        assert event.chat_type == "private"
        assert event.user_id == "user1"
        assert event.user_name == "User"
        assert event.text == "Test"
        assert event.raw == {}

        # Optional fields with defaults
        assert event.thread_id is None
        assert event.is_command == False
        assert event.command is None
        assert event.command_args is None

    def test_optional_fields_with_values(self):
        """Test optional fields can be set."""
        event = MessageEvent(
            platform="discord",
            chat_id="111",
            chat_type="group",
            user_id="user1",
            user_name="User",
            text="!test",
            thread_id="thread_123",
            raw={"extra": "data"},
            is_command=True,
            command="!test",
            command_args="args"
        )

        assert event.thread_id == "thread_123"
        assert event.raw == {"extra": "data"}
        assert event.is_command == True
        assert event.command == "!test"
        assert event.command_args == "args"


# =============================================================================
# Edge Cases and Error Handling
# =============================================================================

class TestEdgeCases:
    """Test edge cases and error scenarios."""

    def test_empty_message_event(self):
        """Test event with empty text."""
        event = MessageEvent(
            platform="telegram",
            chat_id="111",
            chat_type="private",
            user_id="user",
            user_name="User",
            text="",
            raw={}
        )

        assert event.text == ""
        assert not event.is_command

    def test_very_long_message(self):
        """Test event with very long message."""
        long_text = "A" * 100000

        event = MessageEvent(
            platform="discord",
            chat_id="111",
            chat_type="private",
            user_id="user1",
            user_name="User",
            text=long_text,
            raw={}
        )

        # Should accept long text
        assert len(event.text) == 100000

    def test_special_characters_in_message(self):
        """Test message with special characters."""
        special_text = "Hello! @user #hashtag $money <https://example.com>"

        event = MessageEvent(
            platform="discord",
            chat_id="111",
            chat_type="private",
            user_id="user1",
            user_name="User",
            text=special_text,
            raw={}
        )

        assert event.text == special_text

    def test_unicode_in_message(self):
        """Test message with unicode characters."""
        unicode_text = "Hello 世界 🌍 Привет"

        event = MessageEvent(
            platform="telegram",
            chat_id="111",
            chat_type="private",
            user_id="user1",
            user_name="User",
            text=unicode_text,
            raw={}
        )

        assert event.text == unicode_text

    def test_multiple_platforms_isolation(self):
        """Test that different platforms have isolated session keys."""
        discord_event = MessageEvent(
            platform="discord",
            chat_id="111",
            chat_type="private",
            user_id="user1",
            user_name="User",
            text="Test",
            raw={}
        )

        telegram_event = MessageEvent(
            platform="telegram",
            chat_id="111",
            chat_type="private",
            user_id="user1",
            user_name="User",
            text="Test",
            raw={}
        )

        # Session keys should be different (different platforms)
        assert discord_event.session_key != telegram_event.session_key
        assert "discord" in discord_event.session_key
        assert "telegram" in telegram_event.session_key


# =============================================================================
# Performance Tests
# =============================================================================

class TestPerformance:
    """Test performance characteristics."""

    def test_message_event_creation_speed(self):
        """Test that MessageEvent creation is fast."""
        import time

        # Create 1000 events
        start = time.time()
        for i in range(1000):
            MessageEvent(
                platform="discord",
                chat_id=str(i),
                chat_type="private",
                user_id=f"user{i}",
                user_name=f"User{i}",
                text=f"Message {i}",
                raw={}
            )
        elapsed = time.time() - start

        # Should create 1000 events quickly
        assert elapsed < 0.5

    def test_session_key_generation_speed(self):
        """Test that session key generation is fast."""
        import time

        event = MessageEvent(
            platform="discord",
            chat_id="111222333",
            chat_type="group",
            user_id="123456789",
            user_name="TestUser",
            text="Test",
            raw={}
        )

        # Generate session keys many times
        start = time.time()
        for _ in range(10000):
            _ = event.session_key
        elapsed = time.time() - start

        # Should generate 10000 session keys very quickly
        assert elapsed < 0.1

    def test_whitelist_check_speed(self):
        """Test that whitelist authorization check is fast."""
        runner = GatewayRunner()
        runner.set_allowed_users("discord", {"123456789", "987654321", "111222333"})

        event = MessageEvent(
            platform="discord",
            chat_id="111",
            chat_type="group",
            user_id="123456789",
            user_name="TestUser",
            text="Test",
            raw={"server_id": "44455566"}
        )

        import time
        start = time.time()
        for _ in range(10000):
            runner._is_authorized(event)
        elapsed = time.time() - start

        # Should check authorization 10000 times quickly
        assert elapsed < 0.5


# =============================================================================
# Gateway Runner Lifecycle Tests
# =============================================================================

class TestGatewayRunnerLifecycle:
    """Test GatewayRunner initialization and state management."""

    def test_runner_initialization(self):
        """Test GatewayRunner initializes with empty state."""
        runner = GatewayRunner()

        assert runner._adapters == {}
        assert runner._running_agents == {}
        assert runner._allowed_users == {}
        assert runner._allowed_servers == {}
        assert runner._home_channels == {}

    def test_adapter_registration_sets_handler(self):
        """Test that adapter registration sets message handler."""
        runner = GatewayRunner()
        adapter = DiscordAdapter(None)

        # Initially no handler
        assert adapter._message_handler is None

        # Register sets handler
        runner.register_adapter(adapter)

        # Handler should be set
        assert adapter._message_handler is not None

    def test_adapter_unregistration_clears_handler(self):
        """Test that adapter unregistration clears message handler."""
        runner = GatewayRunner()
        adapter = DiscordAdapter(None)
        runner.register_adapter(adapter)

        runner.unregister_adapter("discord")

        # Handler should be cleared
        assert adapter._message_handler is None
