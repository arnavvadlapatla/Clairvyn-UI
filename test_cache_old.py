import requests
import json
import os

old_key = "AIzaSyDvV3HgeC5_qJoXB-D9zkYDXeuCMzvIR6w"
url = f"https://generativelanguage.googleapis.com/v1beta/cachedContents?key={old_key}"
headers = {"Content-Type": "application/json"}
payload = {
    "model": "models/gemini-2.5-flash",
    "contents": [{"role": "user", "parts": [{"text": "Hello world " * 10000}]}],
    "ttl": "3600s"
}

response = requests.post(url, headers=headers, json=payload)
print(f"Status: {response.status_code}")
print(response.text.strip())
