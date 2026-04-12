import vertexai
from vertexai.preview import caching
from vertexai.generative_models import Part
import datetime

print("Initializing Vertex AI...")
try:
    vertexai.init(project="clairvyn-new-491609", location="us-central1")
except Exception as e:
    print(f"Failed to initialize Vertex AI: {e}")
    exit(1)

models_to_test = ["gemini-1.5-flash-001", "gemini-1.5-flash", "gemini-1.5-pro-001", "gemini-2.5-flash"]
massive_text = "Word " * 35000

for m in models_to_test:
    print(f"\n--- Testing caching for {m} ---")
    try:
        cache = caching.CachedContent.create(
            model_name=m,
            system_instruction="You are a helpful assistant.",
            contents=[Part.from_text(massive_text)],
            ttl=datetime.timedelta(hours=1),
        )
        print("Success! Created cache:", cache.name)
        cache.delete()
        print("Deleted cache.")
    except Exception as e:
        print(f"Error: {repr(e)}")
