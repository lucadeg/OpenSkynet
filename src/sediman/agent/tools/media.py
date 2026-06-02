from __future__ import annotations

import os
from typing import Any

import structlog

from sediman.agent.tool_dispatch import ToolResult

logger = structlog.get_logger()


async def _handle_vision_analyze(image_path: str | None = None, image_url: str | None = None, question: str = "Describe this image in detail.", **kwargs: Any) -> ToolResult:
    from sediman.llm.provider import create_provider
    import base64

    messages = []

    content_parts = [{"type": "text", "text": question}]

    if image_path:
        p = os.path.expanduser(image_path)
        if not os.path.exists(p):
            return ToolResult(success=False, output=f"Image file not found: {image_path}")
        with open(p, "rb") as f:
            b64 = base64.b64encode(f.read()).decode()
        content_parts.append({
            "type": "image_url",
            "image_url": {"url": f"data:image/jpeg;base64,{b64}"}
        })
    elif image_url:
        content_parts.append({
            "type": "image_url",
            "image_url": {"url": image_url}
        })
    else:
        return ToolResult(success=False, output="Provide either image_path or image_url.")

    messages.append({"role": "user", "content": content_parts})

    try:
        from sediman.llm.provider import create_provider, _llm_config
        provider = create_provider(
            provider=_llm_config.get("provider", "openai"),
            model=_llm_config.get("model"),
            base_url=_llm_config.get("base_url"),
        )
        response = await provider.chat(messages=messages, tools=[])
        return ToolResult(success=True, output=response.text or "(no description)")
    except Exception as e:
        return ToolResult(success=False, output=f"Vision analysis failed: {e}")


async def _handle_image_generate(prompt: str, **kwargs: Any) -> ToolResult:
    fal_key = os.environ.get("FAL_KEY") or os.environ.get("FAL_API_KEY")
    if not fal_key:
        return ToolResult(success=False, output="Image generation requires FAL_KEY or FAL_API_KEY environment variable. Set it to enable this tool.")

    try:
        import httpx
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                "https://queue.fal.run/fal-ai/flux/schnell",
                headers={"Authorization": f"Key {fal_key}"},
                json={"prompt": prompt, "image_size": "landscape_16_9"},
            )
            if resp.status_code == 200:
                data = resp.json()
                images = data.get("images", [])
                if images:
                    url = images[0].get("url", "")
                    return ToolResult(success=True, output=f"Image generated: {url}", data={"url": url})
                return ToolResult(success=False, output="No image returned from API.")
            return ToolResult(success=False, output=f"Image generation API error: {resp.status_code} {resp.text[:500]}")
    except ImportError:
        return ToolResult(success=False, output="httpx is required for image generation. Install it with: pip install httpx")
    except Exception as e:
        return ToolResult(success=False, output=f"Image generation failed: {e}")


async def _handle_text_to_speech(text: str, voice: str | None = None, **kwargs: Any) -> ToolResult:
    from sediman.config import DATA_DIR

    openai_key = os.environ.get("OPENAI_API_KEY")
    if not openai_key:
        return ToolResult(success=False, output="Text-to-speech requires OPENAI_API_KEY.")

    try:
        import httpx
        import hashlib
        import time

        voice = voice or "alloy"
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "https://api.openai.com/v1/audio/speech",
                headers={"Authorization": f"Bearer {openai_key}"},
                json={"model": "tts-1", "input": text, "voice": voice},
            )
            if resp.status_code == 200:
                audio_dir = DATA_DIR / "voice-memos"
                audio_dir.mkdir(parents=True, exist_ok=True)
                filename = f"tts_{hashlib.md5(text.encode()).hexdigest()[:8]}_{int(time.time())}.mp3"
                audio_path = audio_dir / filename
                audio_path.write_bytes(resp.content)
                return ToolResult(
                    success=True,
                    output=f"Audio saved: {audio_path}",
                    data={"path": str(audio_path), "filename": filename},
                )
            return ToolResult(success=False, output=f"TTS API error: {resp.status_code}")
    except ImportError:
        return ToolResult(success=False, output="httpx required for TTS.")
    except Exception as e:
        return ToolResult(success=False, output=f"TTS failed: {e}")
