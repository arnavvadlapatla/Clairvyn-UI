import os
import google.generativeai as genai
from google.generativeai import caching
import datetime

new_key = "AQ.Ab8RN6Ji0ZPQtRu401Lgi3c52T-KtsKl_NdjDn4XZ1ZYlj-fOA"

massive_content = "Word " * 35000

genai.configure(api_key=new_key)
print("\n--- Testing expire_time with gemini-2.5-flash ---")
try:
    c = caching.CachedContent.create(
        model="models/gemini-2.5-flash",
        display_name="test_cache",
        contents=[{"role": "user", "parts": [{"text": massive_content}]}],
        expire_time=datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=1)
    )
    print("Success! Created:", c.name)
    c.delete()
except Exception as e:
    print("Error:", repr(e))

print("\n--- Testing expire_time with gemini-1.5-flash ---")
try:
    c = caching.CachedContent.create(
        model="models/gemini-1.5-flash",
        display_name="test_cache",
        contents=[{"role": "user", "parts": [{"text": massive_content}]}],
        expire_time=datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=1)
    )
    print("Success! Created:", c.name)
    c.delete()
except Exception as e:
    print("Error:", repr(e))
