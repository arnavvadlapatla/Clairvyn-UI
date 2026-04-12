import os
import google.generativeai as genai
import time

api_key = os.getenv("GOOGLE_API_KEY", "AQ.Ab8RN6Ji0ZPQtRu401Lgi3c52T-KtsKl_NdjDn4XZ1ZYlj-fOA")
print(f"Testing basic text generation with API key: {api_key[:10]}...")
genai.configure(api_key=api_key)

try:
    model = genai.GenerativeModel("gemini-2.5-flash")
    response = model.generate_content("Say 'hello world'")
    print("Success. Response:", response.text)
except Exception as e:
    print("Error:", repr(e))
