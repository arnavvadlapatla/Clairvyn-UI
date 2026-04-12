import os
from google import genai
from google.genai import types

api_key = os.getenv("GOOGLE_API_KEY", "AQ.Ab8RN6Ji0ZPQtRu401Lgi3c52T-KtsKl_NdjDn4XZ1ZYlj-fOA")
client = genai.Client(api_key=api_key)

massive_text = "Word " * 35000

print("Testing caching with google-genai SDK...")
try:
    cache = client.caches.create(
        model='gemini-2.5-flash',
        config=types.CreateCachedContentConfig(
            contents=[types.Content(role="user", parts=[types.Part.from_text(text=massive_text)])],
            ttl="3600s",
        )
    )
    print("Success! Created cache:", cache.name)
    client.caches.delete(name=cache.name)
    print("Deleted cache")
except Exception as e:
    print("Error:", repr(e))
