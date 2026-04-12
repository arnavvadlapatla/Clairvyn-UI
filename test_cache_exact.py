import os
import google.generativeai as genai
from google.generativeai import caching
import datetime

api_key = os.getenv("GOOGLE_API_KEY", "AQ.Ab8RN6Ji0ZPQtRu401Lgi3c52T-KtsKl_NdjDn4XZ1ZYlj-fOA")
genai.configure(api_key=api_key)  # NO REST TRANSPORT

try:
    print("Testing create with exact app payload...")
    c = caching.CachedContent.create(
        model="models/gemini-2.5-flash",
        display_name="test_cache",
        contents=[{"role": "user", "parts": [{"text": "Hello world"}]}],
        ttl=datetime.timedelta(hours=1)
    )
    print("Created:", c.name)
    print("Testing get...")
    c2 = caching.CachedContent.get(c.name)
    print("Got:", c2.name)
    print("Testing delete...")
    c.delete()
    print("Deleted")
except Exception as e:
    print("Error:", repr(e))
