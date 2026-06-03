from __future__ import annotations

import logging
import structlog
from contextlib import contextmanager
from pathlib import Path

SUPPRESSED_LOGGERS = [
    "browser_use",
    "Agent",
    "tools",
    "BrowserSession",
    "service",
    "httpx",
    "httpcore",
    "openai._base_client",
    "asyncio",
    "browser_use.agent",
    "browser_use.browser",
    "browser_use.tools",
    "browser_use.controller",
    "bubus",
    "sediman.agent.loop",
    "sediman.browser.session",
    "sediman.memory.sessions",
    "sediman.skills.engine",
    "sediman.scheduler.cron",
]

_db_initialized = False
_logging_configured = False


def setup_logging(log_level: str = "INFO") -> None:
    """Configure file-based logging for RPC server."""
    global _logging_configured
    if _logging_configured:
        return

    log_dir = Path.home() / ".terminator" / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)

    log_file = log_dir / "sediman.log"

    # Check file size and truncate if > 10MB
    if log_file.exists() and log_file.stat().st_size > 10_000_000:
        log_file.unlink()

    # Configure Python logging
    logging.basicConfig(
        level=getattr(logging, log_level.upper(), logging.INFO),
        handlers=[
            logging.FileHandler(log_file)
        ],
        format="%(message)s",
        force=True,  # Override any existing configuration
    )

    # Configure structlog for JSON output
    structlog.configure(
        processors=[
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.stdlib.PositionalArgumentsFormatter(),
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.UnicodeDecoder(),
            structlog.processors.JSONRenderer()
        ],
        wrapper_class=structlog.stdlib.BoundLogger,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )

    _logging_configured = True


def suppress_noisy_loggers() -> None:
    for name in SUPPRESSED_LOGGERS:
        logger = logging.getLogger(name)
        logger.setLevel(logging.CRITICAL)
        logger.propagate = False


async def ensure_db() -> None:
    global _db_initialized
    if _db_initialized:
        return
    from sediman.store.db import init_db
    await init_db()
    _db_initialized = True


@contextmanager
def suppress_all_logging():
    old_level = logging.getLogger().level
    logging.getLogger().setLevel(logging.CRITICAL)
    try:
        yield
    finally:
        logging.getLogger().setLevel(old_level)
