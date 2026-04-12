import os
import google.generativeai as genai
from google.generativeai import caching
import datetime

old_key = "AIzaSyDvV3HgeC5_qJoXB-D9zkYDXeuCMzvIR6w"
new_key = "AQ.Ab8RN6Ji0ZPQtRu401Lgi3c52T-KtsKl_NdjDn4XZ1ZYlj-fOA"

massive_content = "Word " * 35000

for label, key in [("OLD KEY", old_key), ("NEW KEY", new_key)]:
    print(f"\n--- Testing {label} ---")
    genai.configure(api_key=key)
    try:
        c = caching.CachedContent.create(
            model="models/gemini-2.5-flash",
            display_name="test_cache",
            contents=[{"role": "user", "parts": [{"text": massive_content}]}],
            ttl=datetime.timedelta(hours=1)
        )
        print("Success! Created:", c.name)
        c.delete()
    except Exception as e:
        print("Error:", repr(e))
