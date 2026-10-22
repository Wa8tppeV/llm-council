"""Chat with locally installed Ollama models; never call paid APIs."""
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse
import httpx
from .config import OLLAMA_BASE_URL, COUNCIL_MODELS, OLLAMA_MAX_OUTPUT_TOKENS

def _loopback_only():
    if urlparse(OLLAMA_BASE_URL).hostname not in ("localhost", "127.0.0.1", "::1"):
        raise RuntimeError("OLLAMA_BASE_URL must be a localhost address, not a cloud or remote API.")

def _is_local_chat_model(entry: Dict[str, Any]) -> bool:
    name = str(entry.get("name") or entry.get("model") or "").lower()
    details = entry.get("details") or {}
    family = str(details.get("family") or "").lower()
    excluded = ("cloud", "embed", "embedding", "rerank", "nomic", "bge", "minilm")
    return bool(name) and not any(word in name or word in family for word in excluded)

async def ollama_status() -> Dict[str, Any]:
    """Discover installed chat models, without downloading any."""
    _loopback_only()
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
            response.raise_for_status()
            data = response.json()
        installed = [entry.get("name") or entry.get("model")
                     for entry in data.get("models", [])
                     if _is_local_chat_model(entry)]
        installed = list(dict.fromkeys(installed))
        selected = ([m for m in COUNCIL_MODELS if m in installed]
                    if COUNCIL_MODELS else installed[:2])
        return {"provider": "local_ollama", "connected": True,
                "installed_models": installed, "selected_models": selected}
    except (httpx.HTTPError, ValueError) as exc:
        return {"provider": "local_ollama", "connected": False,
                "installed_models": [], "selected_models": [],
                "error": str(exc)}

async def get_council_models() -> List[str]:
    return (await ollama_status())["selected_models"]

async def query_model(model: str, messages: List[Dict[str, str]], timeout: float = 600.0
                      ) -> Optional[Dict[str, Any]]:
    """Non-streaming chat request to local Ollama only."""
    _loopback_only()
    if not model:
        selected = await get_council_models()
        if not selected:
            print("No installed Ollama chat models or local Ollama is offline.")
            return None
        model = selected[0]
    if "cloud" in model.lower():
        print(f"Blocked non-local model: {model}")
        return None
    payload = {"model": model, "messages": messages, "stream": False,
               "think": False, "options": {"num_predict": OLLAMA_MAX_OUTPUT_TOKENS}}
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(timeout, connect=10.0)) as client:
            response = await client.post(f"{OLLAMA_BASE_URL}/api/chat", json=payload)
            response.raise_for_status()
            content = (response.json().get("message") or {}).get("content") or ""
        if not content.strip():
            print(f"Model {model} returned empty output.")
            return None
        return {"content": content, "reasoning_details": None}
    except (httpx.HTTPError, ValueError, KeyError) as exc:
        print(f"Local Ollama error ({model}): {exc}")
        return None

async def query_models_parallel(models: List[str], messages: List[Dict[str, str]]
                                ) -> Dict[str, Optional[Dict[str, Any]]]:
    """Preserve the original interface, but run sequentially to conserve VRAM."""
    if not models:
        models = await get_council_models()
    results = {}
    for model in models:
        results[model] = await query_model(model, messages)
    return results
