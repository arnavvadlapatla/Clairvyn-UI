from src.app.core.validation import PolygonValidator
import json

# Path to AI-generated JSON
json_path = "data/samples/ai_output.json"

# Load structure JSON
with open(json_path, "r") as f:
    structure = json.load(f)

# Initialize validator
validator = PolygonValidator(structure=structure)

# Run FULL validation (no toggles)
report = validator.validate()

# Print full validation report
print(json.dumps(report, indent=2))
