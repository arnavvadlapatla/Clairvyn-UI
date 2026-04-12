# PROMPT DEFINITIONS
from langchain_core.prompts import PromptTemplate

# 1 - Room Extraction

room_extraction_prompt = PromptTemplate(
    input_variables=["user_input"],
    template="""You are an expert floor plan analyzer. Extract all room information from the user's description.

User Input: {user_input}

Output Instructions: {instructions_r}

YOUR RESPONSE MUST CONTAIN ONLY THE JSON OBJECT AND NOTHING ELSE. DO NOT INCLUDE ANY CONVERSATIONAL TEXT OR EXPLANATIONS. Output the JSON object wrapped in markdown code delimiters, e.g., ```json{{\"rooms\":[...]}}```.

Extract the following for EACH room mentioned:
- Room type (bedroom, kitchen, bathroom, living_room, hall, etc.)
- Dimensions (width and height in inches)
- Number of windows (default: 1 if not specified)
- Number of doors (default: 1 if not specified)

Default dimensions if not specified:
- Bedroom: 180x144
- Kitchen: 120x120
- Bathroom: 96x72
- Living room: 200x180
- Hall: 96x60

Output ONLY with this structure (a JSON object with a 'rooms' key containing a list of rooms, wrapped in ```json tags):
```json
{{
  "rooms": [
    {{
      "rtype": "bedroom",
      "id": 1,
      "width": 180,
      "height": 144,
      "windows": 2,
      "doors": 1
    }},
    {{
      "rtype": "kitchen",
      "id": 2,
      "width": 120,
      "height": 120,
      "windows": 1,
      "doors": 1
    }},
    {{
      "rtype": "bathroom",
      "id": 3,
      "width": 96,
      "height": 72,
      "windows": 1,
      "doors": 1
    }}
  ]
}}
```
Output:```json
""",
    partial_variables={"instructions_r": instructions_r}
)

# 2 - Connection Extraction

connection_extraction_prompt = PromptTemplate(
    input_variables=["user_input", "rooms"],
    template="""You are an expert floor plan analyzer. Extract all connections between rooms.

User Input: {user_input}

Available Rooms: {rooms}



Identify all relationships:
- "Room A connects to Room B" → door connection
- "Room A is adjacent to Room B" → door connection
- "Room A has a window facing Room B" → window connection
- "Room A has windows" → window connection to outside (from: room_id, to: room_id - same ID)

Output Instructions: {instructions_c}

Output:""",
    partial_variables={"instructions_c": instructions_c}
)

# 3 - Positioning Rooms

positioning_prompt = PromptTemplate(
    input_variables=["extracted_rooms", "extracted_connections"],
    template="""You are an expert floor plan designer. Assign [x, y] coordinates to each room in the floor plan.
Consider the dimensions of each room and the connections between them to place them logically adjacent to each other.
Assume the origin [0,0] is the bottom-left corner of the overall floor plan.
Ensure rooms connected by a 'door' are adjacent. Windows can face outside, so they don't necessarily imply adjacency.

Extracted Rooms: {extracted_rooms}
Extracted Connections: {extracted_connections}

Output Instructions: {instructions_p}

""",
    partial_variables={"instructions_p": instructions_p}
)


