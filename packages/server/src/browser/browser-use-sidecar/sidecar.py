#!/usr/bin/env python3
"""Thin sidecar wrapping browser_use for the TypeScript backend.

Communicates via stdin/stdout NDJSON protocol.
"""

import asyncio
import json
import sys
import os
import traceback

_initialized = False
_browser = None
_llm = None


async def handle_init(payload):
    global _browser, _llm, _initialized
    from browser_use import Browser
    from browser_use.llm.openai.chat import ChatOpenAI

    model = payload.get("model", "gpt-4o")
    api_key = payload.get("api_key") or os.environ.get("OPENAI_API_KEY")
    base_url = payload.get("base_url")
    headless = payload.get("headless", True)

    _llm = ChatOpenAI(model=model, api_key=api_key, base_url=base_url)

    kwargs = {
        "headless": headless,
        "highlight_elements": True,
        "keep_alive": True,
    }
    _browser = Browser(**kwargs)
    _initialized = True


async def handle_run_task(payload):
    from browser_use import Agent

    task = payload["task"]
    max_steps = payload.get("max_steps", 50)
    flash_mode = payload.get("flash_mode", True)
    system_prompt = payload.get("system_prompt")
    use_vision = payload.get("use_vision", True)

    agent_kwargs = {
        "task": task,
        "llm": _llm,
        "browser": _browser,
        "use_vision": use_vision,
        "max_failures": max_steps,
        "max_actions_per_step": 5,
        "flash_mode": flash_mode,
        "step_timeout": 120,
        "llm_timeout": 60,
    }

    if system_prompt:
        agent_kwargs["override_system_message"] = system_prompt

    agent = Agent(**agent_kwargs)
    raw_result = await agent.run()

    result_text = ""
    try:
        fr = raw_result.final_result
        if callable(fr):
            fr = fr()
        if fr:
            result_text = str(fr)
    except Exception:
        pass

    if not result_text:
        parts = []
        if hasattr(raw_result, "all_results"):
            for r in raw_result.all_results:
                if hasattr(r, "extracted_content") and r.extracted_content:
                    parts.append(r.extracted_content)
        result_text = "\n".join(parts) if parts else "No result"

    actions = []
    if hasattr(raw_result, "all_model_outputs") and raw_result.all_model_outputs:
        for output in raw_result.all_model_outputs:
            if isinstance(output, dict):
                actions.append(output)

    return {"result": result_text, "actions": actions}


async def handle_screenshot(payload):
    if _browser is None:
        return None
    try:
        pages = _browser.context.pages if hasattr(_browser, "context") else []
        if not pages:
            return None
        page = pages[-1]
        cdp = await page.context.new_cdp_session(page)
        result = await cdp.send("Page.captureScreenshot", {"format": "png"})
        return result.get("data")
    except Exception:
        return None


async def handle_stop(payload):
    global _browser, _initialized
    if _browser:
        await _browser.close()
        _browser = None
    _initialized = False


HANDLERS = {
    "init": handle_init,
    "run_task": handle_run_task,
    "screenshot": handle_screenshot,
    "stop": handle_stop,
}


async def main():
    loop = asyncio.get_event_loop()

    try:
        while True:
            line = await loop.run_in_executor(None, sys.stdin.readline)
            if not line:
                break
            line = line.strip()
            if not line:
                continue

            try:
                msg = json.loads(line)
            except json.JSONDecodeError:
                continue

            msg_id = msg.get("id", "")
            msg_type = msg.get("type", "")
            payload = msg.get("payload", {})

            handler = HANDLERS.get(msg_type)
            if not handler:
                response = {"id": msg_id, "success": False, "error": f"Unknown type: {msg_type}"}
            else:
                try:
                    result = await handler(payload)
                    response = {"id": msg_id, "success": True, "result": result}
                except Exception as e:
                    response = {"id": msg_id, "success": False, "error": str(e)}

            sys.stdout.write(json.dumps(response) + "\n")
            sys.stdout.flush()
    except (KeyboardInterrupt, EOFError):
        pass
    finally:
        if _initialized:
            await handle_stop({})


if __name__ == "__main__":
    asyncio.run(main())
