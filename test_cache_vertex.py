import vertexai
from vertexai.preview import caching
from vertexai.generative_models import Part
import datetime

print("Initializing Vertex AI...")
try:
    vertexai.init(project="clairvyn-new-491609", location="us-central1")
    print("Success: Vertex AI initialized.")
except Exception as e:
    print(f"Failed to initialize Vertex AI: {e}")
    exit(1)

print("Testing caching...")
try:
    massive_text = "Word " * 35000
    cache = caching.CachedContent.create(
        model_name="gemini-1.5-flash-002",
        system_instruction="You are a helpful assistant.",
        contents=[Part.from_text(massive_text)],
        ttl=datetime.timedelta(hours=1),
    )
    print("Success! Created cache:", cache.name)
    cache.delete()
    print("Deleted cache.")
except Exception as e:
    print(f"Error creating cache: {repr(e)}")
