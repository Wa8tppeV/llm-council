"""Gemini security, consent and billing-protection tests; never call Google."""
import os
import tempfile
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient

from backend import gemini
from backend.council import choose_models
from backend.main import app


class GeminiSettingsTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.e = patch.object(gemini, "ENV_PATH", __import__("pathlib").Path(self.temp.name) / ".env")
        self.u = patch.object(gemini, "USAGE_PATH", __import__("pathlib").Path(self.temp.name) / "usage.json")
        self.e.start()
        self.u.start()
        self.addCleanup(self.e.stop)
        self.addCleanup(self.u.stop)
        self.original_env = {name: os.environ.get(name) for name in (
            "GEMINI_API_KEY", "GEMINI_ENABLED", "GEMINI_FREE_TIER_CONFIRMED",
        )}
        for name in self.original_env:
            os.environ.pop(name, None)
        self.addCleanup(self._restore_environment)
        self.client = TestClient(app)

    def _restore_environment(self):
        for name, original in self.original_env.items():
            if original is None:
                os.environ.pop(name, None)
            else:
                os.environ[name] = original

    def test_default_disabled_and_no_secret_in_status(self):
        state = gemini.status()
        self.assertFalse(state["configured"])
        self.assertNotIn("api_key", state)
        self.assertEqual(state["remaining_today"], 12)

    def test_requires_explicit_free_tier_confirmation(self):
        with self.assertRaises(ValueError):
            gemini.configure("example_" + "x" * 25, False)
        self.assertFalse(gemini.enabled())

    def test_origin_and_persistent_key_settings(self):
        address = "/api/gemini/configure"
        payload = {"api_key": "example_" + "x" * 25, "free_tier_confirmed": True}
        self.assertEqual(self.client.post(address, json=payload).status_code, 403)
        x = self.client.post(address, json=payload,
                             headers={"Origin": "http://127.0.0.1:5173"})
        self.assertEqual(x.status_code, 200, x.text)
        self.assertTrue(x.json()["configured"])
        self.assertNotIn(payload["api_key"], x.text)
        self.assertIn(payload["api_key"], gemini.ENV_PATH.read_text())
        self.assertEqual(
            self.client.post("/api/gemini/disconnect",
                             headers={"Origin": "http://127.0.0.1:5173"}).status_code, 200
        )
        self.assertFalse(gemini.enabled())

    def test_daily_cap_does_not_exceed_twelve(self):
        for index in range(12):
            self.assertTrue(gemini._consume_request_budget(), index)
        self.assertFalse(gemini._consume_request_budget())
        self.assertEqual(gemini.status()["used_today"], 12)


class GeminiClientTests(unittest.IsolatedAsyncioTestCase):
    async def test_never_call_nonallowlisted_model(self):
        with patch.object(gemini, "enabled", return_value=True):
            with patch.object(gemini, "_consume_request_budget") as budget:
                self.assertIsNone(await gemini.query_gemini("gemini/gemini-4-argon", [{"content": "x"}]))
                budget.assert_not_called()

    async def test_cloud_response_and_no_retry(self):
        fake = MagicMock()
        fake.json.return_value = {"candidates": [
            {"content": {"parts": [{"text": "Beton C30, kalıp 125 m²."}]}}
        ]}
        fake.raise_for_status.return_value = None
        with patch.object(gemini, "enabled", return_value=True), \
             patch.object(gemini, "_consume_request_budget", return_value=True), \
             patch.dict(os.environ, {"GEMINI_API_KEY": "fake-secret-for-test"}), \
             patch("backend.gemini.httpx.AsyncClient") as factory:
            factory.return_value.__aenter__.return_value.post = AsyncMock(return_value=fake)
            reply = await gemini.query_gemini(gemini.MODEL_ID, [
                {"role": "system", "content": "Turkce"},
                {"role": "user", "content": "C30 nedir?"},
            ])
            self.assertIn("C30", reply["content"])
            self.assertEqual(factory.return_value.__aenter__.return_value.post.await_count, 1)

    async def test_hybrid_optin(self):
        installed = {
            "connected": True, "selected_models": ["qwen3:8b"],
            "installed_models": ["qwen3:8b", "gemma3:4b"]
        }
        with patch("backend.council.ollama_status", new_callable=AsyncMock) as status, \
             patch("backend.gemini.enabled", return_value=True):
            status.return_value = installed
            self.assertEqual(await choose_models(False, False), ["qwen3:8b"])
            self.assertEqual(await choose_models(False, True),
                             ["qwen3:8b", gemini.MODEL_ID])
            self.assertEqual(await choose_models(True, True),
                             ["qwen3:8b", "gemma3:4b", gemini.MODEL_ID])


if __name__ == "__main__":
    unittest.main()
