"""
Gemini Client Wrapper for RepoAI Analyzer.
Handles LLM calls with google-genai SDK, structured JSON parsing, and error recovery.
"""
import os
import json
import re
import logging
from typing import Any
from google import genai
from google.genai import types

logger = logging.getLogger(__name__)

DEFAULT_MODEL = "gemini-2.5-flash"
FALLBACK_MODELS = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-1.5-pro"]


class GeminiClient:
    """Wrapper around Google Gemini client."""

    def __init__(self, api_key: str | None = None, model: str | None = None):
        # Read from passed key or environment variable
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        if not self.api_key:
            raise ValueError(
                "Gemini API Key is missing. Please provide it via header 'X-Gemini-Api-Key' or set GEMINI_API_KEY in backend/.env"
            )

        self.model = model or os.environ.get("GEMINI_MODEL", DEFAULT_MODEL)
        self.client = genai.Client(api_key=self.api_key)

    def generate_text(
        self,
        prompt: str,
        system_instruction: str | None = None,
        temperature: float = 0.2,
        max_output_tokens: int = 4096,
    ) -> str:
        """Generate textual response from Gemini."""
        config = types.GenerateContentConfig(
            temperature=temperature,
            max_output_tokens=max_output_tokens,
            system_instruction=system_instruction,
        )

        try:
            response = self.client.models.generate_content(
                model=self.model,
                contents=prompt,
                config=config,
            )
            return response.text or ""
        except Exception as exc:
            logger.warning(f"Generation failed with model {self.model}: {exc}")
            # Try fallback models if primary model had a quota or availability issue
            for fallback in FALLBACK_MODELS:
                if fallback == self.model:
                    continue
                try:
                    logger.info(f"Retrying with fallback model: {fallback}")
                    response = self.client.models.generate_content(
                        model=fallback,
                        contents=prompt,
                        config=config,
                    )
                    self.model = fallback
                    return response.text or ""
                except Exception:
                    continue
            raise exc

    def generate_json(
        self,
        prompt: str,
        system_instruction: str | None = None,
        temperature: float = 0.1,
    ) -> dict[str, Any]:
        """Generate structured JSON response from Gemini."""
        config = types.GenerateContentConfig(
            temperature=temperature,
            system_instruction=system_instruction,
            response_mime_type="application/json",
        )

        raw_text = ""
        try:
            response = self.client.models.generate_content(
                model=self.model,
                contents=prompt,
                config=config,
            )
            raw_text = response.text or "{}"
        except Exception as exc:
            logger.warning(f"JSON generation with response_mime_type failed ({exc}), falling back to text")
            raw_text = self.generate_text(
                prompt=prompt + "\n\nCRITICAL: Respond ONLY with valid JSON. No conversational text.",
                system_instruction=system_instruction,
                temperature=temperature,
            )

        # Parse JSON
        return self._extract_json(raw_text)

    def _extract_json(self, text: str) -> dict[str, Any]:
        """Robustly parse JSON, stripping markdown code fences if present."""
        cleaned = text.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
            cleaned = re.sub(r"\s*```$", "", cleaned)
            cleaned = cleaned.strip()

        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            # Try to match the first JSON object {}
            match = re.search(r"\{[\s\S]*\}", cleaned)
            if match:
                try:
                    return json.loads(match.group(0))
                except json.JSONDecodeError:
                    pass
            logger.error(f"Failed to parse JSON from response: {text[:300]}")
            return {
                "error": "Failed to parse JSON",
                "raw_text": text
            }
