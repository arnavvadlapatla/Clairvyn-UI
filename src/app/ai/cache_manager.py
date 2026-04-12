from google import genai
from google.genai import types
from typing import Optional, Any
import os


class CacheManager:
    """Manages Gemini explicit context caching using the google-genai SDK (AI Studio)."""

    def __init__(
        self,
        content: str,
        model: str,
        api_key: str = None,
        ttl_hours: int = 1,
        display_name: str = "clairvyn_guide_cache",
        disable_thinking: bool = False,
    ):
        api_key = api_key or os.getenv("GOOGLE_API_KEY")
        self.client = genai.Client(api_key=api_key)
        self.model_name = f"models/{model}" if not model.startswith("models/") else model
        self.content = content
        self.ttl = f"{ttl_hours * 3600}s"
        self.display_name = display_name
        self.disable_thinking = disable_thinking  # True for Flash, False for Pro
        self._cache = None
        self._init_cache()

    def _init_cache(self):
        try:
            for c in self.client.caches.list():
                if getattr(c, "display_name", None) == self.display_name:
                    cached_model = getattr(c, "model", "")
                    # Normalize both sides: strip "models/" prefix for comparison
                    norm_cached = cached_model.removeprefix("models/")
                    norm_target = self.model_name.removeprefix("models/")
                    if norm_cached == norm_target:
                        self._cache = c
                        print(f"[CacheManager] Reusing existing cache: {c.name}")
                        return
                    else:
                        print(f"[CacheManager] Skipping stale cache {c.name} — model mismatch ({cached_model} vs {self.model_name}), will create new")
        except Exception as e:
            print(f"[CacheManager] Could not list caches: {e}")

        self._create_cache()

    def _create_cache(self):
        print(f"[CacheManager] Creating new cache (TTL={self.ttl})...")
        self._cache = self.client.caches.create(
            model=self.model_name,
            config=types.CreateCachedContentConfig(
                contents=[
                    types.Content(
                        role="user",
                        parts=[types.Part(text=self.content)],
                    )
                ],
                ttl=self.ttl,
                display_name=self.display_name,
            ),
        )
        print(f"[CacheManager] Cache created: {self._cache.name}")

    def generate(self, prompt: str, schema: Optional[Any] = None, temperature: float = 0.0, thinking_budget: int = 0) -> str:
        config_kwargs = dict(
            cached_content=self._cache.name,
            temperature=temperature,
            response_mime_type="application/json" if schema is not None else None,
            response_schema=schema if schema is not None else None,
        )
        if self.disable_thinking:
            # Flash: explicitly disable thinking (budget=0 is valid for Flash)
            config_kwargs["thinking_config"] = types.ThinkingConfig(thinking_budget=0)
        elif thinking_budget > 0:
            # Pro or Flash with explicit budget requested
            config_kwargs["thinking_config"] = types.ThinkingConfig(thinking_budget=thinking_budget)
        # else: Pro with no budget specified → uses its default thinking (required)
        config = types.GenerateContentConfig(**config_kwargs)
        response = self.client.models.generate_content(
            model=self.model_name,
            contents=prompt,
            config=config,
        )
        meta = response.usage_metadata
        prompt_tok  = meta.prompt_token_count or 0
        cached_tok  = meta.cached_content_token_count or 0
        output_tok  = meta.candidates_token_count or 0
        total_tok   = meta.total_token_count or 0
        print(
            f"[TokenMeter][Cached] "
            f"prompt={prompt_tok} | "
            f"cached={cached_tok} | "
            f"output={output_tok} | "
            f"total={total_tok}"
        )
        return response.text, {"prompt": prompt_tok, "cached": cached_tok, "output": output_tok, "total": total_tok}

    @property
    def cache_name(self) -> Optional[str]:
        return self._cache.name if self._cache else None

    def refresh(self):
        if self._cache:
            try:
                self.client.caches.delete(self._cache.name)
                print(f"[CacheManager] Deleted cache: {self._cache.name}")
            except Exception as e:
                print(f"[CacheManager] Delete failed: {e}")
            self._cache = None
        self._create_cache()