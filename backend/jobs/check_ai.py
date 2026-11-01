"""
Check that the advisor's AI providers work, from the same .env the backend uses:

    PYTHONPATH=backend backend/.venv/bin/python -m jobs.check_ai
"""

from __future__ import annotations

import logging
import sys

from app.core.config import get_settings
from app.core.gemini import generate_text, groq_available_models


def main() -> int:
    logging.basicConfig(level=logging.WARNING, format="  log: %(message)s")
    s = get_settings()
    keys = s.groq_api_keys
    print(f"Groq keys found in .env: {len(keys)}")
    if not keys:
        print("  -> Add GROQ_API_KEYS=gsk_...,gsk_... to the .env in the project root, then restart the backend.")
    for k in keys:
        try:
            ids = groq_available_models(k)
            print(f"  key ...{k[-6:]}: OK, {len(ids)} models")
        except Exception as exc:
            print(f"  key ...{k[-6:]}: FAILED ({exc})")
    if keys:
        try:
            ids = groq_available_models(keys[0])
            print("  models on this account: " + ", ".join(sorted(ids)))
            for want in [m.strip() for m in (s.GROQ_MODELS + "," + s.GROQ_VISION_MODELS).split(",") if m.strip()]:
                print(f"  configured model {want}: {'available' if want in ids else 'NOT available (will auto-pick another)'}")
        except Exception:
            pass
    print(f"Gemini keys found: {len(s.gemini_api_keys)}")
    text, model = generate_text("Reply with exactly: advisor online", max_output_tokens=20, timeout=30.0)
    if text:
        print(f"\nAI answer test: OK via {model}: {text.strip()[:80]}")
        # 8x8 green PNG: can the configured vision model read an image at all?
        import base64, io
        from PIL import Image
        buf = io.BytesIO(); Image.new("RGB", (64, 64), (40, 160, 40)).save(buf, "PNG")
        vt, vm = generate_text("What colour is this image? One word.", max_output_tokens=20, timeout=30.0,
                               image_b64=base64.b64encode(buf.getvalue()).decode(), image_mime="image/png")
        print(f"Photo (vision) test: {'OK via ' + vm + ': ' + vt.strip()[:40] if vt else 'FAILED - no model here can read images; leaf photos will get the AI fallback answer'}")
        return 0
    print("\nAI answer test: FAILED - no provider answered. See the log lines above for the reason.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
