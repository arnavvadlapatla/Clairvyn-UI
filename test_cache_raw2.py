import requests
import json
import os
import datetime

api_key = os.getenv("GOOGLE_API_KEY", "AQ.Ab8RN6Ji0ZPQtRu401Lgi3c52T-KtsKl_NdjDn4XZ1ZYlj-fOA")
url = f"https://generativelanguage.googleapis.com/v1beta/cachedContents?key={api_key}"

headers = {"Content-Type": "application/json"}
expire_time = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=1)).isoformat()

payload = {
    "model": "models/gemini-2.5-flash",
    "contents": [{"role": "user", "parts": [{"text": "Word " * 35000}]}],
    "expireTime": expire_time
}

print("Sending request to:", url.split("key=")[0] + "key=********")
response = requests.post(url, headers=headers, json=payload)

print(f"Status Code: {response.status_code}")
try:
    print("Response:", json.dumps(response.json(), indent=2))
except Exception:
    print("Response text:", response.text)
