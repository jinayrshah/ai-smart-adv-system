"""Groq is tried before Gemini; a bad key or retired model falls through to the next one."""
import httpx

import app.core.gemini as gem
from app.core.config import get_settings


class _Resp:
    def __init__(self, code, text=""):
        self.status_code, self._text = code, text
        self.text = text

    def json(self):
        return {"choices": [{"message": {"content": self._text}}]}


def test_groq_rotates_keys_and_models(monkeypatch):
    s = get_settings()
    monkeypatch.setattr(s, "GROQ_API_KEY", "")
    monkeypatch.setattr(s, "GROQ_API_KEYS", "bad,good")
    monkeypatch.setattr(s, "GROQ_MODELS", "retired-model,live-model")
    calls = []

    class Client:
        def __init__(self, *a, **k): pass
        def __enter__(self): return self
        def __exit__(self, *a): pass
        def post(self, url, json, headers):
            key = headers["Authorization"].split()[-1]
            calls.append((json["model"], key))
            if json["model"] == "retired-model":
                return _Resp(404, "model_decommissioned")
            return _Resp(401) if key == "bad" else _Resp(200, "Irrigate 25 mm.")

    monkeypatch.setattr(httpx, "Client", Client)
    text, model = gem.generate_text("water?", system_instruction="be brief")
    assert (text, model) == ("Irrigate 25 mm.", "groq/live-model")
    assert ("live-model", "bad") in calls or ("live-model", "good") in calls


def test_no_groq_keys_skips_groq(monkeypatch):
    s = get_settings()
    monkeypatch.setattr(s, "GROQ_API_KEY", "")
    monkeypatch.setattr(s, "GROQ_API_KEYS", "")
    assert gem._groq_generate("x", None, 0.2, 100, None, 5.0, None, "image/jpeg") == ("", None)
