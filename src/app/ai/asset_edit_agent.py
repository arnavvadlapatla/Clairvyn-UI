"""
Asset Edit Agent: LLM-powered intent parser for DXF asset manipulation.

Converts natural language prompts like "move the sofa 2m to the right"
into structured AssetOperation objects, which are then executed by dxf_editor.

Anti-hallucination: The LLM is given the exact list of assets from the DXF,
so it can only reference assets that actually exist.
"""

import os
import re            
from typing import Optional, Literal, List
import ezdxf
from ezdxf import bbox
from pydantic import BaseModel, Field
from langchain_core.output_parsers import PydanticOutputParser
from langchain_google_genai import ChatGoogleGenerativeAI
from dotenv import load_dotenv
from src.app.core.dxf_editor import (
    add_asset,
    list_assets,
    move_asset,
    remove_asset,
    rotate_asset,
    find_asset_layer,
    find_free_position,
    get_asset_size,
    get_existing_asset_boxes,
    check_asset_collision,
)
from src.app.core.asset_validation import validate_edit_rules
from src.app.core.asset_validation import validate_edit_rules

load_dotenv()


class AssetOperation(BaseModel):
    """Structured representation of an asset manipulation operation."""

    action: Literal["move", "remove", "rotate", "add"] = Field(
        description="The type of operation to perform on the asset"
    )
    asset_name: str = Field(
        description="Name of the asset to manipulate (e.g. 'sofa', 'bed', 'table', 'side_table', 'counter')"
    )
    room_id: Optional[str] = Field(
        default=None,
        description="Room ID to disambiguate if the same asset exists in multiple rooms (e.g. 'R1', 'R2')",
    )
    dx: Optional[float] = Field(
        default=None,
        description="Horizontal displacement in meters. Positive = right, Negative = left. Only for 'move' action.",
    )
    dy: Optional[float] = Field(
        default=None,
        description="Vertical displacement in meters. Positive = up, Negative = down. Only for 'move' action.",
    )
    add_position: Optional[Literal["top", "bottom", "left", "right", "center"]] = Field(
        default=None,
        description="Desired placement location within the room, only used for 'add' action if specified."
    )
    angle: Optional[float] = Field(
        default=None,
        description="Rotation angle in degrees (counter-clockwise positive). Only for 'rotate' action.",
    )


class AssetEditAgent:
    """
    Lightweight LLM agent that parses user prompts into structured asset operations.

    The LLM never generates DXF code. It only produces a structured JSON operation
    that maps to a deterministic dxf_editor function.
    """

    def __init__(self, api_key: Optional[str] = None):
        api_key = (
            api_key
            or os.getenv("GOOGLE_API_KEY")
            or "AQ.Ab8RN6Ji0ZPQtRu401Lgi3c52T-KtsKl_NdjDn4XZ1ZYlj-fOA"
        )
        self.model = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash",
            google_api_key=api_key,
            temperature=0.0,  # Deterministic for structured output
        )
        self.parser = PydanticOutputParser(pydantic_object=AssetOperation)

    def parse_intent(
        self, user_prompt: str, available_assets: List[dict], available_rooms: List[dict] = None
    ) -> AssetOperation:
        """
        Parse a user prompt into a structured AssetOperation.
        """

        # Build asset context for the LLM
        asset_descriptions = []
        for a in available_assets:
            bbox_str = ""
            if a.get("bbox"):
                b = a["bbox"]
                bbox_str = (
                    f" (position: x={b['min_x']:.2f}-{b['max_x']:.2f}, "
                    f"y={b['min_y']:.2f}-{b['max_y']:.2f})"
                )
            asset_descriptions.append(
                f"  - {a['asset_name']} in room {a['room_id']} "
                f"(layer: {a['layer_name']}){bbox_str}"
            )

        asset_list_str = (
            "\n".join(asset_descriptions)
            if asset_descriptions
            else "  (no assets found)"
        )

        room_list_str = ""
        if available_rooms:
            room_lines = [f"  - {r['room_id']}: {r['room_type']}" for r in available_rooms]
            room_list_str = "\n    AVAILABLE ROOMS in this floor plan:\n" + "\n".join(room_lines) + "\n"

        prompt = f"""You are a floor plan asset editor. Parse the user's request into a structured operation.
{room_list_str}
    AVAILABLE ASSETS in this floor plan:
    {asset_list_str}

    RULES:

    1. Supported actions: "move", "remove", "rotate", "add".

    2. For "move", "remove", and "rotate":
    - You can ONLY reference assets listed above.
    - If the user mentions an asset not listed above, set asset_name to "INVALID".

    3. For "add":
    - The asset_name is the block name to insert.
    - The asset does NOT need to already exist in AVAILABLE ASSETS.
    - NEVER set asset_name to "INVALID" for add.
    - room_id is REQUIRED. If user specifies a room by name (e.g., "living room"), look at AVAILABLE ROOMS and use its matching room_id (e.g., "R2"). If not specified in the prompt, set room_id to null.
    - If the user explicitly specifies a location like 'top', 'left', 'bottom', 'right', 'center', set add_position accordingly.

    4. For "move":
    - "right" = positive dx, "left" = negative dx
    - "up" = positive dy, "down" = negative dy
    - Convert all distances to meters.

    5. For "rotate":
    - Specify angle in degrees (counter-clockwise positive).

    6. If multiple assets share the same name, use room_id to disambiguate.
    If not specified, pick the first match.

    User prompt: "{user_prompt}"

    {self.parser.get_format_instructions()}

    Output ONLY the JSON. No explanation, no markdown."""

        chain = self.model | self.parser
        operation = chain.invoke(prompt)

        # Validation
        if operation.action != "add":
            if operation.asset_name == "INVALID":
                raise ValueError(
                    f"The asset mentioned in your prompt does not exist in this floorplan. "
                    f"Available assets: {[a['asset_name'] for a in available_assets]}"
                )

            matching = [
                a for a in available_assets if a["asset_name"] == operation.asset_name
            ]

            if not matching and available_assets:
                # -------------------------
                # Token-based Fuzzy Match for different asset naming (e.g. "sofa" vs "sofa_1")
                # -------------------------

                def score_match(asset):
                    score = 0
                    layer_str = asset["layer_name"].lower()
                    op_asset = operation.asset_name.lower()
                    op_room = operation.room_id.lower() if operation.room_id else ""

                    # Tokenize
                    op_tokens = set(re.findall(r"[a-z0-9]+", op_asset + " " + op_room))
                    target_tokens = set(re.findall(r"[a-z0-9]+", layer_str))

                    for token in op_tokens:
                        if token in target_tokens:
                            score += 2
                        elif any(token in t or t in token for t in target_tokens):
                            score += 1
                    return score

                scored_assets = [(a, score_match(a)) for a in available_assets]
                scored_assets.sort(key=lambda x: x[1], reverse=True)

                # If we have a reasonable positive score, we override the intent
                if scored_assets and scored_assets[0][1] > 0:
                    best_match = scored_assets[0][0]
                    operation.asset_name = best_match["asset_name"]
                    operation.room_id = best_match["room_id"]
                    matching = [best_match]

            if not matching:
                raise ValueError(
                    f"Asset '{operation.asset_name}' not found. "
                    f"Available: {[a['asset_name'] for a in available_assets]}"
                )
        else:
            # -------------------------
            # Token-based Fuzzy Match for add action against available library assets
            # -------------------------
            
            asset_folder = os.path.join("data", "assets")
            if os.path.exists(asset_folder):
                library_assets = [
                    f.replace(".dxf", "") 
                    for f in os.listdir(asset_folder) 
                    if f.endswith(".dxf")
                ]
                
                if operation.asset_name not in library_assets:
                    def score_match_add(lib_asset):
                        score = 0
                        lib_str = lib_asset.lower()
                        op_asset = operation.asset_name.lower()
                        
                        op_tokens = set(re.findall(r"[a-z0-9]+", op_asset))
                        target_tokens = set(re.findall(r"[a-z0-9]+", lib_str))
                        
                        for token in op_tokens:
                            if token in target_tokens:
                                score += 2
                            elif any(token in t or t in token for t in target_tokens):
                                score += 1
                        return score
                        
                    scored_library = [(lib, score_match_add(lib)) for lib in library_assets]
                    scored_library.sort(key=lambda x: x[1], reverse=True)
                    
                    if scored_library and scored_library[0][1] > 0:
                        operation.asset_name = scored_library[0][0]

        return operation

    def execute(self, dxf_path: str, user_prompt: str) -> dict:
        """
        End-to-end: parse user intent and execute the DXF operation.
        """
        import shutil
        import os

        # Backup files before modifying
        dxf_backup_path = dxf_path + ".bak"
        png_path = dxf_path.replace(".dxf", ".png")
        png_backup_path = png_path + ".bak"

        try:
            if os.path.exists(dxf_path):
                shutil.copy2(dxf_path, dxf_backup_path)
            if os.path.exists(png_path):
                shutil.copy2(png_path, png_backup_path)
        except Exception as e:
            print(f"[AssetEditAgent] Warning: Failed to create backup: {e}")

        def _revert_changes():
            try:
                if os.path.exists(dxf_backup_path):
                    shutil.copy2(dxf_backup_path, dxf_path)
                if os.path.exists(png_backup_path):
                    shutil.copy2(png_backup_path, png_path)
                print("[AssetEditAgent] Reverted changes due to collision/issues.")
            except Exception as e:
                print(f"[AssetEditAgent] Error reverting files: {e}")

        # --------------------------------------------------
        # Step 1: Parse user intent
        # --------------------------------------------------
        try:
            available_assets = list_assets(dxf_path)  # may be empty

            available_rooms = []
            try:
                if os.path.exists(dxf_path):
                    doc_temp = ezdxf.readfile(dxf_path)
                    for layer in doc_temp.layers:
                        name = layer.dxf.name
                        if name.startswith("ROOM_"):
                            parts = name.split("_")
                            if len(parts) >= 3:
                                available_rooms.append({"room_id": parts[1], "room_type": "_".join(parts[2:])})
            except Exception as e:
                print(f"[AssetEditAgent] Failed to extract rooms: {e}")

            operation = self.parse_intent(user_prompt, available_assets, available_rooms)
           #print(f"Available assets: {[a['asset_name'] for a in available_assets]}")
            print(f"Operation: {operation}")
        except ValueError as e:
            return {"success": False, "error": str(e)}
        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to parse your request: {str(e)}",
            }

        print(f"[AssetEditAgent] Operation details: {operation.model_dump()}")


        if operation.action == "add":
            room_id = operation.room_id or "R1"
            operation.room_id = room_id

            doc = ezdxf.readfile(dxf_path)
            msp = doc.modelspace()

            # print("----- LAYERS IN DXF -----")
            # for layer in doc.layers:
            #     print(layer.dxf.name)
            # print("-------------------------")

            # -------------------------
            # Get room bounding box
            # -------------------------
            room_entities = [
                e
                for e in msp
                if room_id in e.dxf.layer and not e.dxf.layer.startswith("ASSET_")
            ]
            if room_entities:
                room_ext = bbox.extents(room_entities)
            else:
                room_ext = bbox.extents(msp)

            # room_ext = bbox.extents(room_entities)

            if not room_ext or not room_ext.has_data:
                return {
                    "success": False,
                    "message": f"Room {room_id} not found.",
                    "operation": operation.model_dump(),
                }

            # -------------------------
            # Get asset size
            # -------------------------
            asset_size = get_asset_size(operation.asset_name)

            # -------------------------
            # Existing assets
            # -------------------------
            existing_boxes = get_existing_asset_boxes(msp, room_id)

            # -------------------------
            # Find space
            # -------------------------
            print("Room bbox:", room_ext.extmin, room_ext.extmax)
            print("Asset size:", asset_size)
            print("Existing boxes:", existing_boxes)
            
            wall_only = (operation.asset_name.lower() == "tv")
            valid_points = find_free_position(room_ext, asset_size, existing_boxes, wall_only=wall_only, preferred_position=operation.add_position)

            if not valid_points:
                return {
                    "success": False,
                    "error": f"No space available in room {room_id} to place {operation.asset_name}.",
                    "operation": operation.model_dump(),
                }
            
            # Retry mechanism for placements that fail validation rules organically
            max_retries = 20
            points_to_try = valid_points[::max(1, len(valid_points)//max_retries)][:max_retries]

            for pt in points_to_try:
                result = add_asset(
                    dxf_path=dxf_path,
                    asset_name=operation.asset_name,
                    insert_point=pt,
                    room_id=room_id,
                )

                if result.get("success"):
                    layer = result.get("layer")
                    issues = validate_edit_rules(dxf_path, layer, room_id) if layer else []
                    collision = check_asset_collision(dxf_path, layer) if layer else False

                    if not collision and not issues:
                        result["assets"] = list_assets(dxf_path)
                        result["issues"] = []
                        result["collision"] = False
                        result["operation"] = operation.model_dump()
                        return result
                    else:
                        _revert_changes()
                        
            return {
                "success": False, 
                "error": f"No more space available to validly place {operation.asset_name} without collisions.",
                "operation": operation.model_dump()
            }

        # --------------------------------------------------
        # NON-ADD OPERATIONS REQUIRE EXISTING ASSETS
        # --------------------------------------------------
        if not available_assets:
            return {
                "success": False,
                "error": "No modifiable assets found in this floorplan.",
            }

        # Find correct asset layer
        layer_name = find_asset_layer(
            dxf_path,
            operation.asset_name,
            operation.room_id,
        )
        if not layer_name:
            return {
                "success": False,
                "error": f"Could not find asset '{operation.asset_name}' in the DXF file.",
            }

        actual_room_id = operation.room_id
        if not actual_room_id:
            for a in available_assets:
                if a["layer_name"] == layer_name:
                    actual_room_id = a.get("room_id")
                    break
        if not actual_room_id:
            actual_room_id = "unknown"

        print(f"[AssetEditAgent] Executing: {operation.action} on {layer_name}")

        # --------------------------------------------------
        # Execute operation
        # --------------------------------------------------
        if operation.action == "move":
            dx = operation.dx or 0.0
            dy = operation.dy or 0.0
            result = move_asset(dxf_path, layer_name, dx, dy)

        elif operation.action == "remove":
            result = remove_asset(dxf_path, layer_name)

        elif operation.action == "rotate":
            angle = operation.angle or 0.0
            result = rotate_asset(dxf_path, layer_name, angle)

        else:
            return {
                "success": False,
                "error": f"Unknown action: {operation.action}",
            }

        # --------------------------------------------------
        # Attach metadata
        # --------------------------------------------------
        if result.get("success"):
            result["assets"] = list_assets(dxf_path)
            # Run layout validation
            result["issues"] = validate_edit_rules(dxf_path, layer_name, actual_room_id)

            # Perform collision check for move/rotate
            if operation.action in ("move", "rotate"):
                collision = check_asset_collision(dxf_path, layer_name)
                result["collision"] = collision
            
            if result.get("collision") or result.get("issues"):
                _revert_changes()

        result["operation"] = operation.model_dump()
        result["layer_name"] = layer_name

        return result