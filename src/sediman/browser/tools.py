from __future__ import annotations

from typing import Any

import structlog

import re

from sediman.agent.tool_dispatch import ToolRegistry, ToolResult
from sediman.browser.controller import BrowserController, format_snapshot
from sediman.llm.provider import ToolDefinition

logger = structlog.get_logger()

_FAIL_RE = re.compile(r"\b(failed|not found|error|timed out)\b", re.IGNORECASE)


def _is_success(result: str) -> bool:
    return not _FAIL_RE.search(result)

_DEFAULT_CONTROLLER: BrowserController | None = None


def get_default_browser_controller() -> BrowserController | None:
    return _DEFAULT_CONTROLLER


def set_default_browser_controller(controller: BrowserController | None) -> None:
    global _DEFAULT_CONTROLLER
    _DEFAULT_CONTROLLER = controller


async def _handle_browser_navigate(url: str, **kwargs: Any) -> ToolResult:
    ctrl = get_default_browser_controller()
    if not ctrl:
        return ToolResult(success=False, output="Browser controller not initialized.")
    if not ctrl.is_started:
        await ctrl.start()
    result = await ctrl.navigate(url)
    return ToolResult(success=_is_success(result), output=result)


async def _handle_browser_click(ref_id: int, **kwargs: Any) -> ToolResult:
    ctrl = get_default_browser_controller()
    if not ctrl:
        return ToolResult(success=False, output="Browser controller not initialized.")
    if not ctrl.is_started:
        return ToolResult(success=False, output="Browser not started. Call browser_navigate first.")
    result = await ctrl.click(ref_id)
    return ToolResult(success=_is_success(result), output=result)


async def _handle_browser_type(ref_id: int, text: str, submit: bool = False, **kwargs: Any) -> ToolResult:
    ctrl = get_default_browser_controller()
    if not ctrl:
        return ToolResult(success=False, output="Browser controller not initialized.")
    if not ctrl.is_started:
        return ToolResult(success=False, output="Browser not started. Call browser_navigate first.")
    result = await ctrl.type_text(ref_id, text, submit=submit)
    return ToolResult(success=_is_success(result), output=result)


async def _handle_browser_scroll(direction: str = "down", amount: int = 300, **kwargs: Any) -> ToolResult:
    ctrl = get_default_browser_controller()
    if not ctrl:
        return ToolResult(success=False, output="Browser controller not initialized.")
    if not ctrl.is_started:
        return ToolResult(success=False, output="Browser not started.")
    result = await ctrl.scroll(direction, amount)
    return ToolResult(success=_is_success(result), output=result)


async def _handle_browser_press_key(key: str, **kwargs: Any) -> ToolResult:
    ctrl = get_default_browser_controller()
    if not ctrl:
        return ToolResult(success=False, output="Browser controller not initialized.")
    if not ctrl.is_started:
        return ToolResult(success=False, output="Browser not started.")
    result = await ctrl.press_key(key)
    return ToolResult(success=_is_success(result), output=result)


async def _handle_browser_go_back(**kwargs: Any) -> ToolResult:
    ctrl = get_default_browser_controller()
    if not ctrl:
        return ToolResult(success=False, output="Browser controller not initialized.")
    if not ctrl.is_started:
        return ToolResult(success=False, output="Browser not started.")
    result = await ctrl.go_back()
    return ToolResult(success=_is_success(result), output=result)


async def _handle_browser_go_forward(**kwargs: Any) -> ToolResult:
    ctrl = get_default_browser_controller()
    if not ctrl:
        return ToolResult(success=False, output="Browser controller not initialized.")
    if not ctrl.is_started:
        return ToolResult(success=False, output="Browser not started.")
    result = await ctrl.go_forward()
    return ToolResult(success=_is_success(result), output=result)


async def _handle_browser_screenshot(**kwargs: Any) -> ToolResult:
    ctrl = get_default_browser_controller()
    if not ctrl:
        return ToolResult(success=False, output="Browser controller not initialized.")
    if not ctrl.is_started:
        return ToolResult(success=False, output="Browser not started.")
    b64 = await ctrl.screenshot()
    if b64:
        return ToolResult(
            success=True,
            output=f"Screenshot captured ({len(b64)} chars base64).",
            data={"screenshot_base64": b64},
        )
    return ToolResult(success=False, output="Screenshot failed.")


async def _handle_browser_snapshot(**kwargs: Any) -> ToolResult:
    ctrl = get_default_browser_controller()
    if not ctrl:
        return ToolResult(success=False, output="Browser controller not initialized.")
    if not ctrl.is_started:
        return ToolResult(success=False, output="Browser not started. Call browser_navigate first.")
    snapshot = await ctrl.snapshot()
    formatted = format_snapshot(snapshot)
    return ToolResult(
        success=True,
        output=formatted,
        data={"url": snapshot.url, "title": snapshot.title, "element_count": len(snapshot.elements)},
    )


async def _handle_browser_extract(selector: str | None = None, **kwargs: Any) -> ToolResult:
    ctrl = get_default_browser_controller()
    if not ctrl:
        return ToolResult(success=False, output="Browser controller not initialized.")
    if not ctrl.is_started:
        return ToolResult(success=False, output="Browser not started.")
    if selector:
        text = await ctrl.extract_by_selector(selector)
    else:
        text = await ctrl.extract_text()
    return ToolResult(
        success=True,
        output=text[:5000] if text else "(no text found)",
        data={"length": len(text) if text else 0},
    )


async def _handle_browser_get_url(**kwargs: Any) -> ToolResult:
    ctrl = get_default_browser_controller()
    if not ctrl:
        return ToolResult(success=False, output="Browser controller not initialized.")
    if not ctrl.is_started:
        return ToolResult(success=False, output="Browser not started.")
    url = await ctrl.get_url()
    return ToolResult(success=True, output=url)


async def _handle_browser_refresh(**kwargs: Any) -> ToolResult:
    ctrl = get_default_browser_controller()
    if not ctrl:
        return ToolResult(success=False, output="Browser controller not initialized.")
    if not ctrl.is_started:
        return ToolResult(success=False, output="Browser not started.")
    result = await ctrl.refresh()
    return ToolResult(success=_is_success(result), output=result)


async def _handle_browser_wait_for_selector(selector: str, timeout: int = 5000, **kwargs: Any) -> ToolResult:
    ctrl = get_default_browser_controller()
    if not ctrl:
        return ToolResult(success=False, output="Browser controller not initialized.")
    if not ctrl.is_started:
        return ToolResult(success=False, output="Browser not started.")
    result = await ctrl.wait_for_selector(selector, timeout=timeout)
    return ToolResult(success=_is_success(result), output=result)


async def _handle_browser_hover(ref_id: int, **kwargs: Any) -> ToolResult:
    ctrl = get_default_browser_controller()
    if not ctrl:
        return ToolResult(success=False, output="Browser controller not initialized.")
    if not ctrl.is_started:
        return ToolResult(success=False, output="Browser not started. Call browser_navigate first.")
    result = await ctrl.hover(ref_id)
    return ToolResult(success="not found" not in result.lower() and "failed" not in result.lower(), output=result)


async def _handle_browser_select_option(ref_id: int, value: str, **kwargs: Any) -> ToolResult:
    ctrl = get_default_browser_controller()
    if not ctrl:
        return ToolResult(success=False, output="Browser controller not initialized.")
    if not ctrl.is_started:
        return ToolResult(success=False, output="Browser not started. Call browser_navigate first.")
    result = await ctrl.select_option(ref_id, value)
    return ToolResult(success="not found" not in result.lower() and "failed" not in result.lower(), output=result)


async def _handle_browser_switch_tab(index: int = -1, **kwargs: Any) -> ToolResult:
    ctrl = get_default_browser_controller()
    if not ctrl:
        return ToolResult(success=False, output="Browser controller not initialized.")
    if not ctrl.is_started:
        return ToolResult(success=False, output="Browser not started.")
    result = await ctrl.switch_tab(index)
    return ToolResult(success="failed" not in result.lower(), output=result)


async def _handle_browser_list_tabs(**kwargs: Any) -> ToolResult:
    ctrl = get_default_browser_controller()
    if not ctrl:
        return ToolResult(success=False, output="Browser controller not initialized.")
    if not ctrl.is_started:
        return ToolResult(success=False, output="Browser not started.")
    result = await ctrl.list_tabs()
    return ToolResult(success=True, output=result)


async def _handle_browser_console(**kwargs: Any) -> ToolResult:
    ctrl = get_default_browser_controller()
    if not ctrl:
        return ToolResult(success=False, output="Browser controller not initialized.")
    if not ctrl.is_started:
        return ToolResult(success=False, output="Browser not started. Call browser_navigate first.")
    try:
        logs = await ctrl._page.evaluate("() => { try { return window.__consoleLogs || []; } catch { return []; } }")
        if logs:
            lines = []
            for entry in logs[:50]:
                if isinstance(entry, dict):
                    lines.append(f"[{entry.get('level', 'log')}] {entry.get('text', '')[:200]}")
                else:
                    lines.append(str(entry)[:200])
            return ToolResult(success=True, output="\n".join(lines))
        js_errors = await ctrl._page.evaluate("() => { try { return window.__jsErrors || []; } catch { return []; } }")
        if js_errors:
            lines = [f"[error] {str(e)[:200]}" for e in js_errors[:20]]
            return ToolResult(success=True, output="\n".join(lines))
        return ToolResult(success=True, output="No console output captured yet.")
    except Exception as e:
        return ToolResult(success=False, output=f"Failed to get console output: {e}")


async def _handle_browser_get_images(**kwargs: Any) -> ToolResult:
    ctrl = get_default_browser_controller()
    if not ctrl:
        return ToolResult(success=False, output="Browser controller not initialized.")
    if not ctrl.is_started:
        return ToolResult(success=False, output="Browser not started. Call browser_navigate first.")
    try:
        images = await ctrl._page.evaluate("""() => {
            return Array.from(document.querySelectorAll('img')).map(img => ({
                src: img.src || '',
                alt: img.alt || '',
                width: img.naturalWidth || 0,
                height: img.naturalHeight || 0,
            })).filter(img => img.src);
        }""")
        if not images:
            return ToolResult(success=True, output="No images found on the page.")
        lines = []
        for i, img in enumerate(images[:30], 1):
            lines.append(f"  {i}. {img.get('src', '')[:120]}")
            if img.get('alt'):
                lines.append(f"     alt: {img['alt'][:60]}")
        return ToolResult(
            success=True,
            output=f"Found {len(images)} image(s):\n" + "\n".join(lines),
            data={"images": images[:30], "total": len(images)},
        )
    except Exception as e:
        return ToolResult(success=False, output=f"Failed to get images: {e}")


async def _handle_browser_vision(question: str = "Describe what you see on this page in detail. Focus on visual layout, charts, images, and any text that stands out.", **kwargs: Any) -> ToolResult:
    ctrl = get_default_browser_controller()
    if not ctrl:
        return ToolResult(success=False, output="Browser controller not initialized.")
    if not ctrl.is_started:
        return ToolResult(success=False, output="Browser not started. Call browser_navigate first.")
    try:
        b64 = await ctrl.screenshot()
        if not b64:
            return ToolResult(success=False, output="Screenshot failed.")
        from sediman.agent.tools.media import _handle_vision_analyze
        result = await _handle_vision_analyze(
            image_url=f"data:image/jpeg;base64,{b64}",
            question=question,
        )
        return result
    except Exception as e:
        return ToolResult(success=False, output=f"Browser vision failed: {e}")


async def _handle_browser_dialog(action: str = "accept", prompt_text: str = "", **kwargs: Any) -> ToolResult:
    ctrl = get_default_browser_controller()
    if not ctrl:
        return ToolResult(success=False, output="Browser controller not initialized.")
    if not ctrl.is_started:
        return ToolResult(success=False, output="Browser not started.")
    try:
        page = ctrl._page
        await page.evaluate(f"() => {{ window.__dialogAction = '{action}'; window.__dialogPromptText = '{prompt_text}'; }}")
        return ToolResult(success=True, output=f"Dialog handler set to '{action}'. Next dialog will be handled automatically.")
    except Exception as e:
        return ToolResult(success=False, output=f"Dialog handler setup failed: {e}")


def register_browser_tools(registry: ToolRegistry) -> None:
    """Register all browser tools into the given ToolRegistry."""

    registry.register(
        ToolDefinition(
            name="browser_navigate",
            description="Navigate the browser to a URL. Always call this first before interacting with a page.",
            parameters={
                "type": "object",
                "properties": {
                    "url": {"type": "string", "description": "The URL to navigate to (e.g. https://example.com)"},
                },
                "required": ["url"],
            },
        ),
        _handle_browser_navigate,
    )

    registry.register(
        ToolDefinition(
            name="browser_snapshot",
            description="Get a structured snapshot of the current page showing all interactive elements with ref IDs. Use this to understand what's on the page before clicking or typing.",
            parameters={"type": "object", "properties": {}},
        ),
        _handle_browser_snapshot,
    )

    registry.register(
        ToolDefinition(
            name="browser_click",
            description="Click an element by its ref_id (from browser_snapshot).",
            parameters={
                "type": "object",
                "properties": {
                    "ref_id": {"type": "integer", "description": "The ref_id of the element to click"},
                },
                "required": ["ref_id"],
            },
        ),
        _handle_browser_click,
    )

    registry.register(
        ToolDefinition(
            name="browser_type",
            description="Type text into an input/textarea element by its ref_id.",
            parameters={
                "type": "object",
                "properties": {
                    "ref_id": {"type": "integer", "description": "The ref_id of the input element"},
                    "text": {"type": "string", "description": "The text to type"},
                    "submit": {"type": "boolean", "description": "If true, press Enter after typing", "default": False},
                },
                "required": ["ref_id", "text"],
            },
        ),
        _handle_browser_type,
    )

    registry.register(
        ToolDefinition(
            name="browser_scroll",
            description="Scroll the page.",
            parameters={
                "type": "object",
                "properties": {
                    "direction": {"type": "string", "enum": ["down", "up", "bottom", "top"], "default": "down"},
                    "amount": {"type": "integer", "description": "Pixels to scroll (for down/up)", "default": 300},
                },
            },
        ),
        _handle_browser_scroll,
    )

    registry.register(
        ToolDefinition(
            name="browser_press_key",
            description="Press a keyboard key (e.g. Enter, Escape, Tab, ArrowDown).",
            parameters={
                "type": "object",
                "properties": {
                    "key": {"type": "string", "description": "The key to press"},
                },
                "required": ["key"],
            },
        ),
        _handle_browser_press_key,
    )

    registry.register(
        ToolDefinition(
            name="browser_go_back",
            description="Go back to the previous page in browser history.",
            parameters={"type": "object", "properties": {}},
        ),
        _handle_browser_go_back,
    )

    registry.register(
        ToolDefinition(
            name="browser_go_forward",
            description="Go forward in browser history.",
            parameters={"type": "object", "properties": {}},
        ),
        _handle_browser_go_forward,
    )

    registry.register(
        ToolDefinition(
            name="browser_screenshot",
            description="Take a screenshot of the current page. Returns base64 JPEG. Use sparingly — only when visual context is needed (e.g. to understand layout, read charts, or verify rendering).",
            parameters={"type": "object", "properties": {}},
        ),
        _handle_browser_screenshot,
    )

    registry.register(
        ToolDefinition(
            name="browser_extract",
            description="Extract text from the current page. Optionally pass a CSS selector to extract only matching elements.",
            parameters={
                "type": "object",
                "properties": {
                    "selector": {"type": "string", "description": "Optional CSS selector (e.g. 'article', '.price', 'h1')"},
                },
            },
        ),
        _handle_browser_extract,
    )

    registry.register(
        ToolDefinition(
            name="browser_get_url",
            description="Get the current page URL.",
            parameters={"type": "object", "properties": {}},
        ),
        _handle_browser_get_url,
    )

    registry.register(
        ToolDefinition(
            name="browser_refresh",
            description="Refresh the current page.",
            parameters={"type": "object", "properties": {}},
        ),
        _handle_browser_refresh,
    )

    registry.register(
        ToolDefinition(
            name="browser_wait_for_selector",
            description="Wait for an element matching a CSS selector to appear on the page.",
            parameters={
                "type": "object",
                "properties": {
                    "selector": {"type": "string", "description": "CSS selector to wait for"},
                    "timeout": {"type": "integer", "description": "Timeout in ms (default 5000)", "default": 5000},
                },
                "required": ["selector"],
            },
        ),
        _handle_browser_wait_for_selector,
    )

    registry.register(
        ToolDefinition(
            name="browser_hover",
            description="Hover over an element by its ref_id. Use for dropdown menus, tooltips, and hover-reveal UI elements.",
            parameters={
                "type": "object",
                "properties": {
                    "ref_id": {"type": "integer", "description": "The ref_id of the element to hover over"},
                },
                "required": ["ref_id"],
            },
        ),
        _handle_browser_hover,
    )

    registry.register(
        ToolDefinition(
            name="browser_select_option",
            description="Select an option in a <select> dropdown element by its ref_id and option value.",
            parameters={
                "type": "object",
                "properties": {
                    "ref_id": {"type": "integer", "description": "The ref_id of the <select> element"},
                    "value": {"type": "string", "description": "The value of the option to select"},
                },
                "required": ["ref_id", "value"],
            },
        ),
        _handle_browser_select_option,
    )

    registry.register(
        ToolDefinition(
            name="browser_switch_tab",
            description="Switch to a different browser tab by index. Use -1 for the last tab.",
            parameters={
                "type": "object",
                "properties": {
                    "index": {"type": "integer", "description": "Tab index (0-based, -1 for last)", "default": -1},
                },
            },
        ),
        _handle_browser_switch_tab,
    )

    registry.register(
        ToolDefinition(
            name="browser_list_tabs",
            description="List all open browser tabs with their URLs.",
            parameters={"type": "object", "properties": {}},
        ),
        _handle_browser_list_tabs,
    )

    registry.register(
        ToolDefinition(
            name="browser_console",
            description="Get browser console output and JavaScript errors from the current page. Returns console.log/warn/error/info messages and uncaught JS exceptions. Use this to detect silent JavaScript errors, failed API calls, and application warnings.",
            parameters={"type": "object", "properties": {}},
        ),
        _handle_browser_console,
    )

    registry.register(
        ToolDefinition(
            name="browser_get_images",
            description="Get a list of all images on the current page with their URLs, alt text, and dimensions. Useful for finding images to analyze with the vision tool or for scraping image URLs.",
            parameters={"type": "object", "properties": {}},
        ),
        _handle_browser_get_images,
    )

    registry.register(
        ToolDefinition(
            name="browser_vision",
            description="Take a screenshot of the current page and analyze it with vision AI. Use this when you need to visually understand what's on the page — especially useful for CAPTCHAs, visual verification challenges, complex layouts, charts, or when the text snapshot is insufficient.",
            parameters={
                "type": "object",
                "properties": {
                    "question": {
                        "type": "string",
                        "description": "What to look for or analyze in the screenshot (default: describe everything visible)",
                        "default": "Describe what you see on this page in detail.",
                    },
                },
            },
        ),
        _handle_browser_vision,
    )

    registry.register(
        ToolDefinition(
            name="browser_dialog",
            description="Handle native JavaScript dialogs (alert, confirm, prompt, beforeunload). Set action='accept' to accept the dialog, or 'dismiss' to cancel it. For prompt dialogs, provide prompt_text for the response.",
            parameters={
                "type": "object",
                "properties": {
                    "action": {
                        "type": "string",
                        "enum": ["accept", "dismiss"],
                        "description": "How to respond to the dialog (default: accept)",
                        "default": "accept",
                    },
                    "prompt_text": {
                        "type": "string",
                        "description": "Text to enter for prompt dialogs (only used with action='accept')",
                        "default": "",
                    },
                },
            },
        ),
        _handle_browser_dialog,
    )

    logger.info("browser_tools_registered", count=22)
