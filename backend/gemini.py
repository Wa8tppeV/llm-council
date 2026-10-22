"""Optional Gemini 2.5 Flash Free Tier integration.

Disabled until a user confirms a Google AI Studio Free Tier project, saves
their API key locally, and explicitly opts into Gemini for each message.
No retries, no paid model fallback, no automatic tier switching.
"""
import json
import os
import threading
from datetime import datetime, timezone
from pathlib import Path

import httpx
from dotenv import set_key

MODEL = "gemini-2.5-flash"
MODEL_ID = "gemini/" + MODEL
URL = "https://generativelanguage.googleapis.com/v1beta/models/" + MODEL + ":generateContent"
ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
USAGE_PATH = Path("data") / "gemini-requests.json"
DAILY_CAP = 12
_LOCK = threading.Lock()


def enabled() -> bool:
    return (
        bool(os.getenv("GEMINI_API_KEY", "").strip())
        and os.getenv("GEMINI_FREE_TIER_CONFIRMED") == "1"
        and os.getenv("GEMINI_ENABLED") == "1"
    )


def _today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _read_usage() -> dict:
    try:
        data = json.loads(USAGE_PATH.read_text(encoding="utf-8"))
        if data.get("date") == _today():
            return {"date": _today(), "calls": max(0, int(data.get("calls", 0)))}
    except (FileNotFoundError, ValueError, OSError, TypeError):
        pass
    return {"date": _today(), "calls": 0}


def status() -> dict:
    with _LOCK:
        used = _read_usage()["calls"]
    return {
        "configured": enabled(),
        "key_present": bool(os.getenv("GEMINI_API_KEY", "").strip()),
        "model": MODEL_ID,
        "daily_cap": DAILY_CAP,
        "used_today": used,
        "remaining_today": max(0, DAILY_CAP - used),
        "privacy_warning": "Gemini seçilirse sorununuz ve ekli belgelerden seçilen metin Google'a gönderilir.",
    }


def configure(api_key: str, free_tier_confirmed: bool) -> dict:
    api_key = api_key.strip()
    if not free_tier_confirmed:
        raise ValueError("Once Google AI Studio projenizde Free Tier ve faturalandirma kapali oldugunu onaylayin.")
    if len(api_key) < 20 or len(api_key) > 300 or any(c.isspace() for c in api_key):
        raise ValueError("Gecerli bir Google AI Studio API anahtari girin.")
    ENV_PATH.touch(exist_ok=True)
    set_key(str(ENV_PATH), "GEMINI_API_KEY", api_key)
    set_key(str(ENV_PATH), "GEMINI_FREE_TIER_CONFIRMED", "1")
    set_key(str(ENV_PATH), "GEMINI_ENABLED", "1")
    os.environ.update({
        "GEMINI_API_KEY": api_key,
        "GEMINI_FREE_TIER_CONFIRMED": "1",
        "GEMINI_ENABLED": "1",
    })
    return status()


def disconnect() -> dict:
    ENV_PATH.touch(exist_ok=True)
    set_key(str(ENV_PATH), "GEMINI_API_KEY", "")
    set_key(str(ENV_PATH), "GEMINI_FREE_TIER_CONFIRMED", "0")
    set_key(str(ENV_PATH), "GEMINI_ENABLED", "0")
    for name in ("GEMINI_API_KEY", "GEMINI_FREE_TIER_CONFIRMED", "GEMINI_ENABLED"):
        os.environ.pop(name, None)
    return status()


def _consume_request_budget() -> bool:
    with _LOCK:
        current = _read_usage()
        if current["calls"] >= DAILY_CAP:
            return False
        current["calls"] += 1
        USAGE_PATH.parent.mkdir(parents=True, exist_ok=True)
        tmp = USAGE_PATH.with_suffix(".tmp")
        tmp.write_text(json.dumps(current), encoding="utf-8")
        tmp.replace(USAGE_PATH)
        return True


async def query_gemini(model: str, messages: list[dict]) -> dict | None:
    # Reject arbitrary model IDs, including paid or retired identifiers.
    if model != MODEL_ID or not enabled():
        return None
    if not _consume_request_budget():
        print("Gemini: local daily request limit reached. Ollama models remain available.")
        return None
    system = "\n".join(str(m.get("content") or "") for m in messages if m.get("role") == "system")
    prompt = "\n\n".join(str(m.get("content") or "") for m in messages if m.get("role") != "system")
    # Never send entire very large documents to a cloud provider by accident.
    if len(prompt) > 14000:
        prompt = prompt[:13800] + "\n[NOT: Gemini'ye gonderilen metin boyut siniri nedeniyle kisaltildi.]"
    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {"maxOutputTokens": 768, "thinkingConfig": {"thinkingBudget": 0}},
    }
    if system:
        payload["systemInstruction"] = {"parts": [{"text": system[:3000]}]}
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(80.0, connect=10.0)) as client:
            response = await client.post(
                URL, json=payload,
                headers={
                    "x-goog-api-key": os.environ["GEMINI_API_KEY"],
                    "Content-Type": "application/json",
                },
            )
            response.raise_for_status()
            data = response.json()
        parts = (data.get("candidates") or [{}])[0].get("content", {}).get("parts", [])
        answer = "\n".join(part.get("text", "") for part in parts if "text" in part).strip()
        if answer:
            return {"content": answer, "reasoning_details": None}
        print("Gemini returned no answer; retaining local model results.")
    except (httpx.HTTPError, ValueError, KeyError, IndexError) as exc:
        # Never print the request headers (API key), prompt or document content.
        print(f"Gemini request failed: {type(exc).__name__} (no retry, no paid fallback)")
    return None
