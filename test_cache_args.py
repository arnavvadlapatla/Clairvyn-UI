import os
import google.generativeai as genai
from google.generativeai import caching
import datetime

api_key = os.getenv("GOOGLE_API_KEY", "AQ.Ab8RN6Ji0ZPQtRu401Lgi3c52T-KtsKl_NdjDn4XZ1ZYlj-fOA")
genai.configure(api_key=api_key)

ttl = datetime.timedelta(hours=1)
print(f"Trying ttl={ttl}")
try:
    c = caching.CachedContent.create(
        model="models/gemini-1.5-flash",
        system_instruction="You are a helpful assistant.",
        contents="Hello world",
        ttl=ttl,
    )
    print("Success. Cache name:", c.name)
    c.delete()
except Exception as e:
    print("Failed with timedelta:", repr(e))

print("---")
print("Trying ttl='3600s'")
try:
    c = caching.CachedContent.create(
        model="models/gemini-1.5-flash",
        system_instruction="You are a helpful assistant.",
        contents="Hello world",
        ttl="3600s",
    )
    print("Success. Cache name:", c.name)
    c.delete()
except Exception as e:
    print("Failed with string:", repr(e))
