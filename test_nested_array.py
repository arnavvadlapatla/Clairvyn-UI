import google.generativeai as genai, os
genai.configure(api_key=os.getenv("GOOGLE_API_KEY") or "AIzaSyCJxOtSHVlSulkYPtqhQ1NJCr4aSHVfvLs")
schema = {
    "type": "object",
    "properties": {
        "poly": {
            "type": "array",
            "items": {
                "type": "array",
                "items": {"type": "number"}
            }
        }
    }
}
model = genai.GenerativeModel("models/gemini-2.5-flash")
print("calling generate_content...")
res = model.generate_content("give me a polygon", generation_config={"response_mime_type": "application/json", "response_schema": schema})
print(res.text)