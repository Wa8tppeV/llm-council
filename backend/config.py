"""LLM Council: local Ollama only, no paid API keys."""
import os
from dotenv import load_dotenv
load_dotenv()
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/")
# Empty = automatically use up to two locally installed chat models.
COUNCIL_MODELS = [m.strip() for m in os.getenv("OLLAMA_MODELS", "").split(",") if m.strip()]
CHAIRMAN_MODEL = os.getenv("OLLAMA_CHAIRMAN_MODEL", "").strip()
OLLAMA_MAX_OUTPUT_TOKENS = int(os.getenv("OLLAMA_MAX_OUTPUT_TOKENS", "768"))
DATA_DIR = "data/conversations"
