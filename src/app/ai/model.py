import os
from getpass import getpass

# HUGGINGFACE_TOKEN = getpass("Enter your HuggingFace API Token: ")
HUGGINGFACE_TOKEN = "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"


os.environ["HUGGINGFACEHUB_API_TOKEN"] = HUGGINGFACE_TOKEN
print("✅ API Token set successfully!")

import os
from getpass import getpass

from langchain_huggingface import ChatHuggingFace, HuggingFaceEndpoint
from langgraph.graph import StateGraph, START, END
from typing import TypedDict, List, Dict
from langchain.tools import tool
# For structured output
from pydantic import BaseModel, Field
from langchain_core.output_parsers import PydanticOutputParser
from langchain_core.prompts import PromptTemplate

import json

print("📦 Libraries imported successfully!")

print("🤖 Initializing model...")

llm = HuggingFaceEndpoint(
    repo_id="openai/gpt-oss-20b",  # Using an open-source model
    task="text-generation",
    max_new_tokens=2048,
    temperature=0.3,
)

model = ChatHuggingFace(llm=llm)

print("✅ Model initialized!")

@tool
def cal_area(width: int, height: int) -> int:
    """
    Calculate the area of a room.

    Args:
        width: Width of the room in inches
        height: Height/length of the room in inches

    Returns:
        Area of the room in square inches
    """
    return width * height

@tool
def sum_numbers(numbers: list[float]) -> float:
    """
    Calculate the total area by summing individual room areas.

    Use this tool when you need to find the total area of multiple rooms.
    First calculate each room's area separately, then pass all the areas
    as a list to get the total combined area.

    Args:
        numbers: A list of individual room areas in square inches

    Returns:
        Total combined area of all rooms in square inches
    """
    return sum(numbers)

tools = [cal_area, sum_numbers]


def _unwrap_tool_callable(tool_obj):
    """Return a python callable from a tool object created by `@tool`.

    Some langchain versions return a StructuredTool object which wraps the original
    python function. The validation machinery expects a plain function with a
    `__name__` attribute. This helper extracts the underlying callable when present,
    otherwise returns the object unchanged.
    """
    # Common attribute names where the wrapped function may live
    for attr in ("func", "python_function", "_func", "callable"):
        if hasattr(tool_obj, attr):
            return getattr(tool_obj, attr)
    # If the object provides a `run` method, return a small wrapper exposing __name__
    if hasattr(tool_obj, "run"):
        fn = getattr(tool_obj, "run")
        if not hasattr(fn, "__name__"):
            try:
                fn.__name__ = getattr(tool_obj, "name", "tool_run")
            except Exception:
                pass
        return fn
    return tool_obj


tools_unwrapped = [_unwrap_tool_callable(t) for t in tools]
model_with_tools = model.bind_tools(tools_unwrapped)
# ==================================================================================
# SCHEMA DEFINITIONS
# ==================================================================================

class Room(BaseModel):
    rtype: str = Field(description="Type of room (bedroom, kitchen, bathroom, living_room, hall, etc.)")
    id: int = Field(description="Unique identifier for the room, starting from 1")
    width: int = Field(description="Width of the room in inches")
    height: int = Field(description="Height/length of the room in inches")
    position: List[int] = Field(description="Position [x, y] coordinates of the room")
    windows: int = Field(description="Number of windows in the room")
    doors: int = Field(description="Number of doors in the room")

class Connection(BaseModel):
    from_room: int = Field(alias="from", description="id of the source room")
    to_room: int = Field(alias="to", description="id of the destination room")
    rtype: str = Field(description="Type of connection: 'door' or 'window'")

class FloorPlanSchema(BaseModel):
    rooms: List[Room] = Field(description="List of all rooms in the floor plan")
    connections: List[Connection] = Field(description="List of connections between rooms")
    total_area: int = Field(description="Total area of the floor plan in square inches")

# Parser for structured output
parser = PydanticOutputParser(pydantic_object=FloorPlanSchema)
instructions = parser.get_format_instructions()

# ==================================================================================

class room_scheme(BaseModel):
    rtype: str = Field(description="Type of room (bedroom, kitchen, bathroom, living_room, hall, etc.)")
    id: int = Field(description="Unique identifier for the room, starting from 1")
    width: int = Field(description="Width of the room in inches")
    height: int = Field(description="Height/length of the room in inches")
    windows: int = Field(default=0, description="Number of windows in the room")
    doors: int = Field(default=1, description="Number of doors in the room")


class getrooms(BaseModel):
    rooms: List[room_scheme] = Field(description="List of all rooms in the floor plan")

parser_r = PydanticOutputParser(pydantic_object=getrooms)
instructions_r = parser_r.get_format_instructions()

# ==================================================================================

class getconnections(BaseModel):
    connections: List[Connection] = Field(description="List of all Connections connecting different rooms in the floor plan")

parser_c = PydanticOutputParser(pydantic_object=getconnections)
instructions_c = parser_c.get_format_instructions()

# ==================================================================================

class PositionedRooms(BaseModel):
    rooms: List[Room] = Field(description="List of rooms with assigned [x, y] positions")

parser_p = PydanticOutputParser(pydantic_object=PositionedRooms)
instructions_p = parser_p.get_format_instructions()

# ==================================================================================



# ==================================================================================
room_extraction_prompt = PromptTemplate(
    input_variables=["user_input"],
    template="""You are an expert floor plan analyzer. Extract all room information from the user's description.

User Input: {user_input}

Output Instructions: {instructions_r}

YOUR RESPONSE MUST CONTAIN ONLY THE JSON OBJECT AND NOTHING ELSE. DO NOT INCLUDE ANY CONVERSATIONAL TEXT OR EXPLANATIONS. Output the JSON object wrapped in markdown code delimiters, e.g., ```json{{"rooms":[...]}}```.

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

class PositionedRooms(BaseModel):
    rooms: List[Room] = Field(description="List of rooms with assigned [x, y] positions")

parser_p = PydanticOutputParser(pydantic_object=PositionedRooms)
instructions_p = parser_p.get_format_instructions()

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


# ==================================================================================
# STATE DEFINITION
# ==================================================================================

class FloorPlanState(TypedDict):
    user_input: str
    extracted_rooms: List[Dict]
    extracted_connections: List[Dict]
    positioned_rooms: List[Dict]
    final_output: Dict

# ==================================================================================
# NODE FUNCTIONS
# ==================================================================================
 # 1 - Room Extraction

def extract_rooms(state: FloorPlanState) -> Dict:
    """Extract room details from natural language input"""
    print("Extracting rooms...")
    chain = room_extraction_prompt | model | parser_r
    print("Chain is Ready (raw output mode)")
    llm_response = chain.invoke({"user_input": state["user_input"]})
    print("Response Invoked")

    # The llm_response is already a Pydantic object (getrooms) due to parser_r in the chain.
    # Directly access the 'rooms' attribute of the getrooms object.
    content = [room.model_dump() for room in llm_response.rooms]

    state["extracted_rooms"] = content if content else []

    if state["extracted_rooms"]:
        print(f"✅ Rooms extracted successfully! Found {len(state['extracted_rooms'])} rooms")
    else:
        print("❌ No rooms found!")

    return state


 # 2 - Connection Extraction

def extract_connections(state: FloorPlanState) -> Dict:
    """Extract connections between rooms"""
    print("🔗 Extracting connections...")
    chain = connection_extraction_prompt | model | parser_c
    response = chain.invoke(
        {
            "user_input": state["user_input"],
            "rooms": json.dumps(state["extracted_rooms"])
        }
    )

    # Converting Pydantic objects to dicts
    content = [conn.model_dump(by_alias=True) for conn in response.connections]
    state["extracted_connections"] = content if content else []

    if state["extracted_connections"]:
        print(f"✅ Connections extracted successfully! Found {len(state['extracted_connections'])} connections")
    else:
        print("❌ No connections found!")

    return state


    # 3 - Room Positioning

def position_rooms(state: FloorPlanState) -> Dict:
    """Generate positions for the extracted rooms"""
    print("Positioning rooms...")
    chain = positioning_prompt | model | parser_p
    response = chain.invoke(
        {
            "extracted_rooms": json.dumps(state["extracted_rooms"]),
            "extracted_connections": json.dumps(state["extracted_connections"])
        }
    )


    state["positioned_rooms"] = [room.model_dump() for room in response.rooms]

    if state["positioned_rooms"]:
        print(f"✅ Rooms positioned successfully! Positioned {len(state['positioned_rooms'])} rooms")
    else:
        print("❌ No rooms positioned!")

    return state

# 4 - Final Output Formatting

def format_final_output(state: FloorPlanState) -> Dict:
    """Formats the extracted and positioned data into the final FloorPlanSchema."""
    print("Formatting final output...")

    # ===================
    Areas = []
    for room in state["positioned_rooms"]:
        area = room["width"] * room["height"]
        Areas.append(area)

    Total_Area = sum(Areas)



    formatted_rooms = [Room(**room_data) for room_data in state["positioned_rooms"]]


    formatted_connections = [Connection(**conn) for conn in state["extracted_connections"]]

    final_floor_plan = FloorPlanSchema(
        rooms=formatted_rooms,
        connections=formatted_connections,
        total_area=Total_Area

    )

    state["final_output"] = final_floor_plan.model_dump(by_alias=True)
    print("✅ Final output formatted successfully!")
    return state

# ==================================================================================
# WORKFLOW DEFINITION
# ==================================================================================

workflow = StateGraph(FloorPlanState)

workflow.add_node("extract_rooms", extract_rooms)
workflow.add_node("extract_connections", extract_connections)
workflow.add_node("position_rooms", position_rooms)
workflow.add_node("format_final_output", format_final_output)

workflow.set_entry_point("extract_rooms")

workflow.add_edge("extract_rooms", "extract_connections")
workflow.add_edge("extract_connections", "position_rooms")
workflow.add_edge("position_rooms", "format_final_output")
workflow.set_finish_point("format_final_output")

app = workflow.compile()

if __name__ == "__main__":
    user_input = "I need a floor plan with a master bedroom (180x144 inches) with two windows, a kitchen (120x120 inches) that connects to a living room (216x180 inches), and a small bathroom (96x72 inches) adjacent to the bedroom. The living room also has one window."


    print("🚀 Starting floor plan generation...")
    result = app.invoke({"user_input": user_input})

    print("\n✨ Final Output:\n")
    print(json.dumps(result["final_output"], indent=2))
    print("\n✅ Workflow execution complete!")
