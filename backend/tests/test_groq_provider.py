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


def test_fallback_does_not_quote_rice_passage_for_cotton():
    from types import SimpleNamespace
    from app.domain.advisory.generator import _about_crop

    rice = SimpleNamespace(crop=None, chunk_text="Late planting paddy varieties: Samba Masoori, Cotton Dora Sannalu. Rice blast: spray tricyclazole.")
    cotton = SimpleNamespace(crop=None, chunk_text="Cotton at square formation: apply 25 kg N/acre; cotton needs potash.")
    tagged = SimpleNamespace(crop="Cotton", chunk_text="Apply potash in split doses.")
    assert not _about_crop(rice, "Cotton")
    assert _about_crop(cotton, "Cotton") and _about_crop(tagged, "Cotton")


def test_groq_discovers_live_model_when_configured_ones_are_retired(monkeypatch):
    import app.core.gemini as g
    s = get_settings()
    monkeypatch.setattr(s, "GROQ_API_KEY", "")
    monkeypatch.setattr(s, "GROQ_API_KEYS", "k1")
    monkeypatch.setattr(s, "GROQ_MODELS", "old-model")
    monkeypatch.setattr(g, "_groq_discovered", {})
    monkeypatch.setattr(g, "groq_available_models", lambda key: ["whisper-large-v3", "llama-9-70b-versatile", "llama-guard-4"])

    class Client:
        def __init__(self, *a, **k): pass
        def __enter__(self): return self
        def __exit__(self, *a): pass
        def post(self, url, json, headers):
            return _Resp(200, "ok") if json["model"] == "llama-9-70b-versatile" else _Resp(404, "model_not_found")

    monkeypatch.setattr(httpx, "Client", Client)
    assert g._groq_generate("hi", None, 0.2, 50, None, 5.0, None, "image/jpeg") == ("ok", "groq/llama-9-70b-versatile")
