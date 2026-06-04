"""Think tag parser for separating model thinking from response.

Handles extended thinking formats like <think_tags>...</think_tags>
that some models embed in their responses.

Provides two modes:
- ThinkTagParser: full-text batch parsing (for post-processing complete responses)
- StreamingThinkParser: real-time token-by-token parsing (for live LLM streaming)
"""

from __future__ import annotations

from typing import Callable

# Think tag patterns - models may use various formats
THINK_TAG_START_PATTERNS = [
    "<think>",
    "<｜end▁of▁thinking｜>",
]

THINK_TAG_END_PATTERNS = [
    "</think>",
    "",
]

MAX_TAG_LEN = max(len(p) for p in THINK_TAG_START_PATTERNS + THINK_TAG_END_PATTERNS)


class StreamingThinkParser:
    """Real-time streaming parser for think tags.

    Maintains state across individual tokens as they arrive from the LLM.
    Each call to feed_token() produces zero or more (phase, text) tuples.
    The parser is stateful per instance - create a new instance per task.

    Usage:
        parser = StreamingThinkParser(on_streaming_text=callback)
        for token in llm_stream:
            parser.feed_token(token, phase="responding")
        parser.flush()  # emit any remaining buffered content
    """

    def __init__(self, on_streaming_text: Callable[[str, str], None] | None = None):
        self.on_streaming_text = on_streaming_text
        self.state = 'NORMAL'  # NORMAL | EXPECT_TAG_START | IN_THINK_CONTENT | EXPECT_TAG_END
        self.buffer = ''  # characters being accumulated for tag matching
        self.response_buffer: list[str] = []  # accumulated response chars for chunked emit
        self.think_buffer: list[str] = []  # accumulated think chars for chunked emit
        self.default_phase = 'responding'

    def reset(self) -> None:
        self.state = 'NORMAL'
        self.buffer = ''
        self.response_buffer.clear()
        self.think_buffer.clear()

    def _check_pattern_match(self, buf: str, patterns: list[str]) -> tuple[bool, str]:
        for pattern in patterns:
            if buf.startswith(pattern[:len(buf)]):
                if buf == pattern:
                    return True, pattern
                return True, ""
        return False, ""

    def _flush_response_buffer(self, phase: str) -> None:
        if self.response_buffer and self.on_streaming_text:
            text = ''.join(self.response_buffer)
            self.response_buffer.clear()
            try:
                self.on_streaming_text(text, phase)
            except Exception:
                pass

    def _flush_think_buffer(self) -> None:
        if self.think_buffer and self.on_streaming_text:
            text = ''.join(self.think_buffer)
            self.think_buffer.clear()
            try:
                self.on_streaming_text(text, "thinking")
            except Exception:
                pass

    def _emit_char(self, char: str, phase: str) -> None:
        if phase == "thinking":
            self.think_buffer.append(char)
            if len(self.think_buffer) >= 3:
                self._flush_think_buffer()
        else:
            self.response_buffer.append(char)
            if len(self.response_buffer) >= 3:
                self._flush_response_buffer(phase)

    def feed_token(self, token: str, phase: str = "responding") -> None:
        """Feed an individual token (chunk) from the LLM stream.

        Args:
            token: The text chunk from the LLM
            phase: The default phase for non-think content
        """
        if not self.on_streaming_text or not token:
            return

        self.default_phase = phase

        for char in token:
            if self.state == 'NORMAL':
                if char == '<':
                    self.state = 'EXPECT_TAG_START'
                    self.buffer = char
                else:
                    self._emit_char(char, phase)

            elif self.state == 'EXPECT_TAG_START':
                self.buffer += char
                is_match, matched = self._check_pattern_match(self.buffer, THINK_TAG_START_PATTERNS)

                if is_match and matched:
                    self._flush_response_buffer(phase)
                    self.state = 'IN_THINK_CONTENT'
                    self.buffer = ''
                elif not is_match and len(self.buffer) > MAX_TAG_LEN:
                    flushed = self.buffer
                    self.buffer = ''
                    for c in flushed:
                        self._emit_char(c, phase)
                    self.state = 'NORMAL'

            elif self.state == 'IN_THINK_CONTENT':
                if char == '<':
                    self.state = 'EXPECT_TAG_END'
                    self.buffer = char
                else:
                    self._emit_char(char, "thinking")

            elif self.state == 'EXPECT_TAG_END':
                self.buffer += char
                is_match, matched = self._check_pattern_match(self.buffer, THINK_TAG_END_PATTERNS)

                if is_match and matched:
                    self._flush_think_buffer()
                    self.state = 'NORMAL'
                    self.buffer = ''
                elif not is_match and len(self.buffer) > MAX_TAG_LEN:
                    flushed = self.buffer
                    self.buffer = ''
                    for c in flushed:
                        self._emit_char(c, "thinking")
                    self.state = 'IN_THINK_CONTENT'

    def flush(self) -> None:
        """Flush any remaining buffered content. Call after all tokens have been fed."""
        self._flush_response_buffer(self.default_phase)

        if self.state in ('EXPECT_TAG_START',):
            for c in self.buffer:
                self._emit_char(c, self.default_phase)
        elif self.state in ('IN_THINK_CONTENT', 'EXPECT_TAG_END'):
            for c in self.buffer:
                self._emit_char(c, "thinking")

        self._flush_response_buffer(self.default_phase)
        self._flush_think_buffer()
        self.reset()


class ThinkTagParser:
    """Batch parser for extracting think tags from complete text.

    Suitable for post-processing full responses that may contain
    <think>...</think> or response... tags.

    For real-time streaming, use StreamingThinkParser instead.
    """

    def __init__(self, on_streaming_text: Callable[[str, str], None] | None = None):
        self.on_streaming_text = on_streaming_text

    async def parse_and_stream(self, text: str, phase: str = "responding") -> None:
        """Parse complete text for think tags and stream content to appropriate phases.

        Uses the real-time parser internally for consistency.
        """
        if not self.on_streaming_text or not text:
            return

        parser = StreamingThinkParser(on_streaming_text=self.on_streaming_text)

        import asyncio
        chunk_size = 3
        chunks_sent = 0

        for i in range(0, len(text), chunk_size):
            chunk = text[i:i + chunk_size]
            parser.feed_token(chunk, phase)
            chunks_sent += 1
            if chunks_sent % 6 == 0:
                await asyncio.sleep(0)

        parser.flush()
