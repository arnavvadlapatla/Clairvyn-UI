import requests
import json
import os

api_key = os.getenv("GOOGLE_API_KEY", "AQ.Ab8RN6Ji0ZPQtRu401Lgi3c52T-KtsKl_NdjDn4XZ1ZYlj-fOA")

for version in ["v1alpha", "v1beta", "v1"]:
    url = f"https://generativelanguage.googleapis.com/{version}/cachedContents?key={api_key}"
    headers = {"Content-Type": "application/json"}
    payload = {
        "model": "models/gemini-2.5-flash",
        "contents": [{"role": "user", "parts": [{"text": "Hello world " * 10000}]}],
        "ttl": "3600s"
    }

    response = requests.post(url, headers=headers, json=payload)
    print(f"--- Testing {version} ---")
    print(f"Status: {response.status_code}")
    print(response.text.strip())
