from langchain_huggingface import ChatHuggingFace, HuggingFaceEndpoint
from langgraph.graph import StateGraph, START, END
from typing import TypedDict, List, Dict
from dotenv import load_dotenv

# For structured output
from pydantic import BaseModel, Field
from langchain_core.output_parsers import PydanticOutputParser


# Importing promts from promt.py
from prompt import room_extraction_prompt, connection_extraction_prompt, positioning_prompt

import json

load_dotenv()

llm = HuggingFaceEndpoint(
    repo_id="openai/gpt-oss-20b",  # Using a reliable open-source model
    task="text-generation",
    max_new_tokens=2048,
    temperature=0.3,
)

model = ChatHuggingFace(llm=llm)

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
    chain = room_extraction_prompt | model
    llm_response = chain.invoke({"user_input": state["user_input"]})

    response_text = llm_response.content.strip()
    json_str = None

    markdown_start = response_text.find('```json')
    markdown_end = response_text.rfind('```')

    if markdown_start != -1 and markdown_end != -1 and markdown_end > markdown_start:
        json_str = response_text[markdown_start + len('```json'):markdown_end].strip()
    else:
        json_start = response_text.find('{')
        json_end = response_text.rfind('}')
        if json_start != -1 and json_end != -1 and json_end > json_start:
            json_str = response_text[json_start : json_end + 1]

    content = []
    if json_str:
        try:
            parsed_json_dict = json.loads(json_str)

            if 'Rooms' in parsed_json_dict:
                parsed_json_dict['rooms'] = parsed_json_dict.pop('Rooms')

            pydantic_response = parser_r.parse(json.dumps(parsed_json_dict))
            content = [room.model_dump() for room in pydantic_response.rooms]
        except (json.JSONDecodeError, Exception) as e:
            print(f"❌ Failed to parse JSON from LLM response: {e}")
            print(f"Raw LLM response (attempted JSON): {json_str}")
    else:
        print("❌ No valid JSON object found in LLM response.")
        print(f"Raw LLM response: {response_text}")

    state["extracted_rooms"] = content if content else []
    return state


 # 2 - Connection Extraction

def extract_connections(state: FloorPlanState) -> Dict:
    """Extract connections between rooms"""
    print("🔗 Extracting connections...")
    chain = connection_extraction_prompt | model | parser_c
    response = chain.invoke({
        "user_input": state["user_input"],
        "rooms": json.dumps(state["extracted_rooms"])
    })

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
    response = chain.invoke({
        "extracted_rooms": json.dumps(state["extracted_rooms"]),
        "extracted_connections": json.dumps(state["extracted_connections"])
    })

    
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

    
    formatted_rooms = [Room(**room_data) for room_data in state["positioned_rooms"]]

    
    formatted_connections = [Connection(**conn) for conn in state["extracted_connections"]]

    final_floor_plan = FloorPlanSchema(
        rooms=formatted_rooms,
        connections=formatted_connections
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

# ==================================================================================
# =================================================================================


def main():
    user_input = input("Enter floor plan description: ")
    
    initial_state = {
        "user_input": user_input,
        "extracted_rooms": [],
        "extracted_connections": [],
        "positioned_rooms": [],
        "final_output": {}
    }
    
    result = app.invoke(initial_state)
    output = result["final_output"]
    
    print("\nOutput:")
    print(output)
    
    return output


if __name__ == "__main__":
    main()