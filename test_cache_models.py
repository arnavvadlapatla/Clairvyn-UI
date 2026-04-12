import requests
import json
import os
import datetime

api_key = os.getenv("GOOGLE_API_KEY", "AQ.Ab8RN6Ji0ZPQtRu401Lgi3c52T-KtsKl_NdjDn4XZ1ZYlj-fOA")
url = f"https://generativelanguage.googleapis.com/v1beta/cachedContents?key={api_key}"
headers = {"Content-Type": "application/json"}
expire_time = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=1)).isoformat()

models_to_test = [
    "models/gemini-1.5-pro-002",
    "models/gemini-1.5-flash-002",
    "models/gemini-1.5-pro-001",
    "models/gemini-1.5-flash-001"
]

for m in models_to_test:
    print(f"\n--- Testing {m} ---")
    payload = {
        "model": m,
        "contents": [{"role": "user", "parts": [{"text": "Hello world " * 10000}]}],
        "ttl": "3600s"
    }
    response = requests.post(url, headers=headers, json=payload)
    print(f"Status: {response.status_code}")
    print(response.text)
