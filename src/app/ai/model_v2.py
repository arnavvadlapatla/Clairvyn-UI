from src.app.core.validation import PolygonValidator
from langgraph.graph import StateGraph
from langgraph.checkpoint.sqlite import SqliteSaver
from langgraph.checkpoint.memory import MemorySaver
from langgraph.types import interrupt, Command
from shapely.geometry import Polygon
from typing import TypedDict, List, Optional, Literal, Any
import os
import re
import ast
import math
from pydantic import BaseModel, Field
from langchain_core.output_parsers import PydanticOutputParser, BaseOutputParser
from langchain_core.prompts import PromptTemplate
import json
import time
from src.app.core.assemble import FloorPlanAssembler
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from src.app.ai.cache_manager import CacheManager
from src.app.extensions import db
from src.app.models import AINodeMetric

load_dotenv()


class FloorPlanState(TypedDict):
    user_message: str
    previous_spec: Optional[dict]
    spec: dict
    layout: dict
    violations: List[str]
    critique: str
    fix_iteration: int
    validation_report: dict
    user_prompts: List[str]
    is_first: bool
    intent: str  # "NEW_CREATION" | "LAYOUT_FIX" | "SPEC_CHANGE"
    unsupported_requests: List[str]  # items user asked for that we can't build


class RoomSpec(BaseModel):
    id: str
    type: Literal[
        "living", "dining", "kitchen", "bedroom", "balcony", "bathroom", 
        "corridor", "parking", "study", "utility", "storage", "pantry", 
        "home theater", "gym", "walk in closet", "library", "servant room", 
        "prayer room", "hallway", "foyer"]
    target_area: float = Field(..., description="Desired area in square meters")
    exact_width: Optional[float] = Field(None, description="Exact room width in meters if user explicitly specified (e.g. '3x4m' → 3.0)")
    exact_height: Optional[float] = Field(None, description="Exact room height in meters if user explicitly specified (e.g. '3x4m' → 4.0)")
    shape: Literal["rectangular", "L-shaped", "T-shaped", "irregular"] = "rectangular"
    adjacencies: List[str] = Field(
        default_factory=list, description="IDs of rooms that should be adjacent"
    )


class DoorSpec(BaseModel):
    from_room: str
    to_room: str
    width: float = Field(..., description="Width of the door in meters")
    type: Literal["single", "double", "sliding"] = "single"
    swing: Literal["into_from", "into_to", "sliding"] = "into_from"


class WindowSpec(BaseModel):
    room_id: str
    width: float = Field(..., description="Width of the window in meters")
    orientation: Literal["horizontal", "vertical"]
    direction: str = Field(..., description="E.g. 'north', 'east', etc.")


class SpecSchema(BaseModel):
    total_area: float = Field(..., description="Total usable area in sq meters")
    plot_width: Optional[float] = Field(None, description="Plot/land width in meters if user specified (e.g. '10x12 plot' → 10.0)")
    plot_height: Optional[float] = Field(None, description="Plot/land height/depth in meters if user specified (e.g. '10x12 plot' → 12.0)")
    rooms: List[RoomSpec]
    doors: List[DoorSpec] = Field(default_factory=list)
    windows: List[WindowSpec] = Field(default_factory=list)
    direction: Optional[Literal["N", "S", "E", "W"]] = Field(
        default="None", description="Direction the apartment is facing, if known"
    )
    unsupported_requests: List[str] = Field(
        default_factory=list,
        description="List of things the user asked for that cannot be represented as a room (e.g. 'swimming pool', 'helipad'). Do NOT map these to other room types."
    )


class RoomPloygon(BaseModel):
    id: str
    type: Literal[
        "living", "dining", "kitchen", "bedroom", "balcony", "bathroom", 
        "corridor", "parking", "study", "utility", "storage", "pantry", 
        "home theater", "gym", "walk in closet", "library", "servant room", 
        "prayer room", "hallway", "foyer"]
    polygon: List[List[float]]  # List of [x, y] coordinates
    shape: Literal["rectangular", "L-shaped", "T-shaped", "irregular"] = "rectangular"


class LayoutSchema(BaseModel):
    rooms: List[RoomPloygon]


class RoomCritique(BaseModel):
    room_id: str
    operations: List[str]


class CritiqueSchema(BaseModel):
    fixes: List[RoomCritique]


with open("src/document/llm_floorplan_context_clean.md", "r", encoding="utf-8") as f:
    guide_context_doc = f.read()

with open("src/document/llm_spec_context.md", "r", encoding="utf-8") as f:
    spec_context_doc = f.read()


class RobustPydanticParser(BaseOutputParser):
    inner: Any

    class Config:
        arbitrary_types_allowed = True

    def __init__(self, pydantic_object):
        inner = PydanticOutputParser(pydantic_object=pydantic_object)
        super().__init__(inner=inner)

    def get_format_instructions(self):
        return self.inner.get_format_instructions()

    def parse(self, text: str):
        try:
            return self.inner.parse(text)
        except Exception:
            pass
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            raw = match.group(0)
            try:
                obj = ast.literal_eval(raw)
                return self.inner.parse(json.dumps(obj))
            except Exception:
                pass
            try:
                return self.inner.parse(raw.replace("'", '"'))
            except Exception:
                pass
        raise ValueError(f"Could not parse LLM output: {text[:200]}")


spec_parser = RobustPydanticParser(SpecSchema)
layout_parser = RobustPydanticParser(LayoutSchema)
critique_parser = RobustPydanticParser(CritiqueSchema)


class FloorPlanAgent:
    def __init__(self, api_key: Optional[str] = None, checkpointer=None, assemble_intermediate: bool = True):
        print("[FloorPlanAgent] Initializing...")
        api_key = (
            api_key
            or os.getenv("GOOGLE_API_KEY")
            or "AIzaSyDbHfWvooVwHctwxMKeLYq68rgHMshHlCc"
        )
        print(f"[FloorPlanAgent] API key found: {api_key[:10]}...")
        # Flash 3.1 — spec + polygon nodes (fast, thinking disabled for spec)
        self.model = ChatGoogleGenerativeAI(
            model="gemini-3.1-flash-lite-preview",
            google_api_key=api_key,
            temperature=0.0,
            model_kwargs={"thinking": {"thinking_budget": 0}},
        )
        self.polygon_model = self.model  # polygon reuses flash model

        # Pro 3.1 — fix node (strong spatial correction, limited thinking)
        self.fix_model = ChatGoogleGenerativeAI(
            model="gemini-3.1-pro-preview",
            google_api_key=api_key,
            temperature=0.0,
        )

        # Cache for Flash 3.1 (spec + polygon nodes)
        try:
            self._cache_manager = CacheManager(
                content=guide_context_doc,
                model="gemini-3.1-flash-lite-preview",
                api_key=api_key,
                ttl_hours=1,
                display_name="clairvyn_guide_flash_31",
                disable_thinking=True,
            )
            print(f"[FloorPlanAgent] Flash-3.1 cache active: {self._cache_manager.cache_name}")
        except Exception as e:
            print(f"[FloorPlanAgent] Flash-3.1 cache unavailable: {e}")
            self._cache_manager = None

        self._cache_manager_flash = self._cache_manager  # flash cache alias for polygon node

        # Cache for Pro 3.1 (fix node)
        try:
            self._cache_manager_pro = CacheManager(
                content=guide_context_doc,
                model="gemini-3.1-pro-preview",
                api_key=api_key,
                ttl_hours=1,
                display_name="clairvyn_guide_pro_31",
            )
            print(f"[FloorPlanAgent] Pro-3.1 cache active: {self._cache_manager_pro.cache_name}")
        except Exception as e:
            print(f"[FloorPlanAgent] Pro-3.1 cache unavailable: {e}")
            self._cache_manager_pro = None

        # parsers
        self.spec_parser = spec_parser
        self.layout_parser = layout_parser
        self.critique_parser = critique_parser

        # build graph
        self.builder = StateGraph(FloorPlanState)
        self.builder.add_node("router", self.router_node)
        self.builder.add_node("spec", self.spec_node)
        self.builder.add_node("polygons", self.polygon_node)
        self.builder.add_node("validate", self.validate_node)
        self.builder.add_node("fix", self.fix_node)
        self.builder.add_node("user_modification", self.user_modification_node)

        self.builder.set_entry_point("router")
        self.builder.add_conditional_edges(
            "router", self.router_decision,
            {"spec": "spec", "fix": "fix"}
        )
        self.builder.add_edge("spec", "polygons")
        self.builder.add_edge("polygons", "validate")
        self.builder.add_conditional_edges(
            "validate", self.validate_decision,
            {"CRITIQUE": "fix", "SUCCESS": "user_modification"}
        )
        self.builder.add_edge("fix", "validate")
        self.builder.add_edge("user_modification", "router")

        self.assemble_intermediate = assemble_intermediate
        
        # Use SqliteSaver for persistent checkpoints (allows Celery workers to share state)
        if checkpointer is None:
            # Get root project directory (up 3 levels from src/app/ai/)
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            db_path = os.path.join(base_dir, "..", "data", "checkpoints.db")
            os.makedirs(os.path.dirname(db_path), exist_ok=True)
            self._saver_cm = SqliteSaver.from_conn_string(db_path)
            self.checkpointer = self._saver_cm.__enter__()
        else:
            self.checkpointer = checkpointer
            
        self.graph = self.builder.compile(checkpointer=self.checkpointer)
        self._last_config = None
        self.current_config = None
        self._node_timings = {}
        self._last_usage = {}
        self._last_retry_count = {}
        print("[model_v2] FloorPlanAgent initialized and workflow compiled.")

    def _extract_usage_counts(self, usage: Any) -> dict:
        if usage is None:
            return {"tokens_input": None, "tokens_output": None}

        tokens_input = getattr(usage, "prompt_token_count", None)
        tokens_output = getattr(usage, "candidates_token_count", None)

        if isinstance(usage, dict):
            tokens_input = usage.get("input_tokens", usage.get("prompt_token_count", tokens_input))
            tokens_output = usage.get("output_tokens", usage.get("candidates_token_count", tokens_output))

        return {"tokens_input": tokens_input, "tokens_output": tokens_output}

    def _set_last_usage(self, key: str, usage: Any, retry_count: int = 0):
        self._last_usage[key] = usage
        self._last_retry_count[key] = retry_count

    def get_last_usage(self, key: str) -> dict:
        usage = self._last_usage.get(key)
        counts = self._extract_usage_counts(usage)
        counts["retry_count"] = self._last_retry_count.get(key, 0)
        return counts

    def _record_ai_node_metric(self, node_name: str, latency_s: float, usage_key: str):
        try:
            if not isinstance(getattr(self, "current_config", None), dict):
                return
            chat_session_id = self.current_config.get("chat_session_id")
            usage = self.get_last_usage(usage_key)
            db.session.add(
                AINodeMetric(
                    chat_session_id=chat_session_id,
                    node_name=node_name,
                    tokens_input=usage.get("tokens_input"),
                    tokens_output=usage.get("tokens_output"),
                    latency_ms=int((latency_s or 0) * 1000),
                    retry_count=usage.get("retry_count") or 0,
                )
            )
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            print(f"[AINodeMetric] Failed to persist node metric for {node_name}: {e}")

    def _invoke_with_retries(
        self,
        chain,
        input_data,
        attempts: int = 3,
        backoff: float = 0.5,
        name: str = "chain",
    ):
        """Invoke a chain and retry on parsing/validation errors.

        Retries when errors look like parsing/validation issues (pydantic ValidationError or messages containing
        'parse' or 'validation'). Uses exponential-ish backoff (linear multiplier) between attempts.
        """
        
        last_exc = None
        for attempt in range(1, attempts + 1):
            try:
                return chain.invoke(input_data)
            except Exception as e:
                last_exc = e
                is_parse_error = False
                try:
                    from pydantic import ValidationError

                    if isinstance(e, ValidationError):
                        is_parse_error = True
                except Exception:
                    pass

                msg = str(e).lower()
                if (
                    "parse" in msg or "validation" in msg or is_parse_error
                ) and attempt < attempts:
                    print(
                        f"Parsing error in {name} (attempt {attempt}/{attempts}): {e}; retrying..."
                    )
                    time.sleep(backoff * attempt)
                    continue

                # Not a parse error or we've exhausted retries
                print(f"Error invoking {name} (attempt {attempt}/{attempts}): {e}")
                raise

        # If we exit loop without returning, reraise last exception
        raise last_exc
    
    def get_spec_diff(self, old_spec: dict, new_spec: dict) -> str:
        """Calculate a human-readable diff between two floor plan specs."""
        
        diff_lines = []
        if old_spec.get("total_area") != new_spec.get("total_area"):
            diff_lines.append(
                f"- Total area changed from {old_spec.get('total_area')} to {new_spec.get('total_area')} m2"
            )

        old_rooms = {r["id"]: r for r in old_spec.get("rooms", [])}
        new_rooms = {r["id"]: r for r in new_spec.get("rooms", [])}

        for r_id in set(old_rooms) | set(new_rooms):
            if r_id not in old_rooms:
                diff_lines.append(
                    f"- Added room {r_id} ({new_rooms[r_id]['type']}, area: {new_rooms[r_id]['target_area']} m2)"
                )
            elif r_id not in new_rooms:
                diff_lines.append(f"- Removed room {r_id}")
            else:
                o, n = old_rooms[r_id], new_rooms[r_id]
                room_diffs = []
                if o.get("target_area") != n.get("target_area"):
                    room_diffs.append(
                        f"area: {o['target_area']} -> {n['target_area']} m2"
                    )
                if o.get("type") != n.get("type"):
                    room_diffs.append(f"type: {o['type']} -> {n['type']}")
                if room_diffs:
                    diff_lines.append(f"- Room {r_id} changed: {', '.join(room_diffs)}")

        return "\n".join(diff_lines) if diff_lines else "No changes in spec."
    

    def _invoke_cached(
        self,
        prompt: str,
        parser: Any,
        name: str = "Agent",
        attempts: int = 3,
        backoff: float = 0.5,
        use_schema: bool = True,
        use_json_mode: bool = True,
        cache=None,
        llm=None,
        thinking_budget: int = 0,
    ):
        """Invoke Gemini with context caching + JSON schema output.
        cache: CacheManager instance to use (defaults to self._cache_manager / Flash).
        llm:   LangChain model for fallback when cache is unavailable (defaults to self.model).
        """
        cache_mgr     = cache if cache is not None else self._cache_manager
        fallback_model = llm or self.model
        last_exc = None
        for attempt in range(1, attempts + 1):
            try:
                # Build schema for structured output
                schema = None
                if use_json_mode and use_schema:
                    pydantic_obj = (
                        parser.inner.pydantic_object
                        if hasattr(parser, "inner")
                        else parser.pydantic_object
                    )
                    schema = self._clean_schema(pydantic_obj.model_json_schema())

                if cache_mgr:
                    text, tok = cache_mgr.generate(prompt, schema=schema, thinking_budget=thinking_budget)
                    source = "Cached"
                    self._node_timings.setdefault("tokens", []).append({"node": name, **tok})
                else:
                    # Fallback: inject guide inline
                    fallback_prompt = (
                        f"ARCHITECTURAL GUIDE (use as your design reference):\n"
                        f"{guide_context_doc}\n\n"
                        f"{prompt}"
                    )
                    chain = fallback_model | parser
                    result = self._invoke_with_retries(chain, fallback_prompt, attempts=1, name=name)
                    print(f"[Fallback][{name}] OK")
                    return result

                print(f"[{source}][{name}] OK")
                self._set_last_usage(name, tok, retry_count=attempt - 1)
                return parser.parse(text)

            except Exception as e:
                last_exc = e
                # Refresh cache on expiry / permission errors
                if cache_mgr and any(
                    kw in str(e).lower() for kw in ("403", "not found", "expired", "permissiondenied")
                ):
                    print(f"[{name}] Cache error — refreshing: {e}")
                    try:
                        cache_mgr.refresh()
                        continue
                    except Exception as refresh_err:
                        print(f"[{name}] Cache refresh failed: {refresh_err}")
                        cache_mgr = None  # fall through to LangChain fallback next attempt

                from pydantic import ValidationError

                is_parse = isinstance(e, ValidationError) or any(
                    kw in str(e).lower() for kw in ("parse", "validation")
                )
                if is_parse and attempt < attempts:
                    print(f"[{name}] Parse error attempt {attempt}: {e}; retrying...")
                    time.sleep(backoff * attempt)
                    continue
                print(f"[{name}] Error attempt {attempt}: {e}")
                raise
        raise last_exc
    

    # --- Node implementations ---

    @staticmethod
    def _enforce_exact_dimensions(layout, spec: dict):
        """
        After polygon generation, force-resize any room whose spec has non-null
        exact_width or exact_height. Keeps the polygon's bottom-left anchor and
        rebuilds it as a rectangle with the required dimensions.
        Only applied to rectangular rooms (4-corner polygons).
        """
        spec_map = {r["id"]: r for r in spec.get("rooms", [])}
        rooms = layout.model_dump().get("rooms", [])
        changed = False

        for room in rooms:
            rid = room["id"]
            spec_room = spec_map.get(rid, {})
            exact_w = spec_room.get("exact_width")
            exact_h = spec_room.get("exact_height")
            if not exact_w and not exact_h:
                continue

            poly = room.get("polygon", [])
            if len(poly) != 4:
                continue  # only enforce on rectangles

            xs = [v[0] for v in poly]
            ys = [v[1] for v in poly]
            min_x, min_y = min(xs), min(ys)
            cur_w = max(xs) - min_x
            cur_h = max(ys) - min_y

            new_w = exact_w if exact_w else cur_w
            new_h = exact_h if exact_h else cur_h

            if abs(new_w - cur_w) > 0.01 or abs(new_h - cur_h) > 0.01:
                room["polygon"] = [
                    [min_x, min_y],
                    [min_x + new_w, min_y],
                    [min_x + new_w, min_y + new_h],
                    [min_x, min_y + new_h],
                ]
                print(f"[ExactDims] {rid}: resized from {cur_w:.2f}x{cur_h:.2f} to {new_w}x{new_h}")
                changed = True

        if not changed:
            return layout

        # Rebuild the pydantic object from the modified dict
        try:
            return LayoutSchema(**{"rooms": rooms})
        except Exception:
            return layout

    def _clean_schema(self, schema: Any, root_defs: Optional[dict] = None) -> Any:
        """Recursively resolve $ref pointers and remove problematic keys for Gemini compatibility."""
        if root_defs is None and isinstance(schema, dict):
            root_defs = schema.get("$defs", {})

        if isinstance(schema, dict):
            # Resolve $ref if present
            if "$ref" in schema:
                ref_path = schema["$ref"].split("/")[-1]
                if root_defs and ref_path in root_defs:
                    return self._clean_schema(root_defs[ref_path], root_defs)
                return schema  # Fallback if ref not found

            # Flatten anyOf/allOf/oneOf (Gemini doesn't support them well)
            for key in ("anyOf", "allOf", "oneOf"):
                if key in schema:
                    # Pick the first non-null option
                    options = schema[key]
                    if isinstance(options, list) and options:
                        non_null = [
                            opt
                            for opt in options
                            if isinstance(opt, dict) and opt.get("type") != "null"
                        ]
                        if non_null:
                            return self._clean_schema(non_null[0], root_defs)
                        return self._clean_schema(options[0], root_defs)

            # Clean all keys
            return {
                k: self._clean_schema(v, root_defs)
                for k, v in schema.items()
                if k
                not in (
                    "$defs",
                    "$ref",
                    "default",
                    "additionalProperties",
                    "title",
                    "description",
                    "examples",
                    "const",
                )
            }
        if isinstance(schema, list):
            return [self._clean_schema(i, root_defs) for i in schema]
        return schema


    # --- Node implementations (converted from original functions) ---

    def classify_prompt_intent(self, user_message: str) -> str:
        """
        Pre-route classification called from routes.py before deciding
        whether to treat the prompt as an asset edit or a floor plan change.
        Returns: 'ASSET_EDIT' | 'FLOOR_PLAN_CHANGE'
        """
        classification_prompt = f"""You are classifying a user's request for a floor plan application.

User request: "{user_message}"

Definitions:
- ASSET_EDIT: the user wants to move, rotate, add, remove, or reposition a specific piece of FURNITURE or FIXTURE inside an already-generated floor plan (e.g. "move the sofa left", "rotate the bed", "add a dining table", "remove the wardrobe").
- FLOOR_PLAN_CHANGE: the user wants to change, add, or remove ROOMS, change the number of bedrooms/bathrooms, change the overall layout or house shape, add a new room type, change BHK count, or generate a new floor plan (e.g. "add a utility room", "make it 3BHK", "add a balcony", "new 4bhk house", "change the kitchen size").

Key rule: if the thing being added/removed/changed is a ROOM (bedroom, bathroom, kitchen, utility, balcony, hall, garage, etc.) — it is ALWAYS FLOOR_PLAN_CHANGE, never ASSET_EDIT.

Reply with exactly one word: ASSET_EDIT or FLOOR_PLAN_CHANGE"""

        try:
            response = self.fix_model.invoke(classification_prompt)
            content = response.content if hasattr(response, "content") else response
            if isinstance(content, list):
                content = " ".join(p.get("text", "") if isinstance(p, dict) else str(p) for p in content)
            result = str(content).strip().upper()
            intent = "ASSET_EDIT" if "ASSET_EDIT" in result else "FLOOR_PLAN_CHANGE"
        except Exception as e:
            print(f"[PreRouter] Classification failed ({e}), defaulting to FLOOR_PLAN_CHANGE")
            intent = "FLOOR_PLAN_CHANGE"
        print(f"[PreRouter] {intent} — '{user_message[:80]}'")
        return intent

    def router_node(self, state: FloorPlanState) -> dict:
        """Classify user intent and route accordingly.
        NEW_CREATION → spec → polygon (full pipeline)
        SPEC_CHANGE   → spec → polygon (with preservation)
        LAYOUT_FIX    → fix directly (skip spec + polygon)
        """
        if state.get("is_first", True):
            print("[Router] NEW_CREATION (first message)")
            return {"intent": "NEW_CREATION"}

        user_msg = state.get("user_message", "").strip()
        room_ids = [r.get('id') for r in state.get('layout', {}).get('rooms', [])]

        classification_prompt = f"""You are classifying a user's floor plan modification request.

Current layout rooms: {room_ids}

User request: "{user_msg}"

Definitions:
- SPEC_CHANGE: user wants to add/remove rooms, change the number of bedrooms/bathrooms, generate a completely new apartment type (e.g. "make it 2BHK", "generate a 2bhk", "I want 4 bedrooms", "add a study", "remove parking"). ANY request for a different BHK count is ALWAYS SPEC_CHANGE.
- LAYOUT_FIX: user wants to adjust/move/fix something that already exists without changing the room count (fix entrance, move bathroom, widen a room, fix building shape, change balcony position, fix a door).

If in doubt, prefer SPEC_CHANGE.

Reply with exactly one word: LAYOUT_FIX or SPEC_CHANGE"""

        _t = time.time()
        try:
            response = self.fix_model.invoke(classification_prompt)
            content = response.content if hasattr(response, 'content') else response
            # Pro model may return content as a list of parts
            if isinstance(content, list):
                content = " ".join(p.get("text", "") if isinstance(p, dict) else str(p) for p in content)
            result_text = str(content).strip().upper()
            intent = "SPEC_CHANGE" if "SPEC_CHANGE" in result_text else "LAYOUT_FIX"
            # Track tokens from LangChain response_metadata
            meta = getattr(response, "response_metadata", {}) or {}
            usage = meta.get("usage_metadata") or meta.get("tokenMetadata") or {}
            prompt_tok = usage.get("prompt_token_count") or usage.get("input_tokens") or 0
            output_tok = usage.get("candidates_token_count") or usage.get("output_tokens") or 0
            total_tok  = usage.get("total_token_count") or usage.get("total_tokens") or (prompt_tok + output_tok)
            if total_tok:
                self._node_timings.setdefault("tokens", []).append({
                    "node": "Router", "prompt": prompt_tok, "cached": 0,
                    "output": output_tok, "total": total_tok,
                })
        except Exception as e:
            print(f"[Router] Classification failed ({e}), defaulting to LAYOUT_FIX")
            intent = "LAYOUT_FIX"
        print(f"[Router] {intent} (classified in {round(time.time()-_t,1)}s) — '{user_msg[:60]}'")
        
        if not hasattr(self, "_current_thoughts"): self._current_thoughts = []
        self._current_thoughts.append(f"Classified intent as {intent}")

        return {
            "intent": intent,
            "fix_iteration": 0,
            "validation_report": {},
        }

    def router_decision(self, state: FloorPlanState) -> str:
        intent = state.get("intent", "NEW_CREATION")
        if intent == "LAYOUT_FIX":
            return "fix"
        return "spec"  # NEW_CREATION and SPEC_CHANGE both go through spec

    def spec_node(self, state: FloorPlanState) -> dict:

        print("*" * 20)
        print("Spec Agent Invoked")
        _t = time.time()

        if not state.get("is_first"):
            prompt_text = (
                "You are an expert floor plan designer. The user wants to modify or replace the existing floor plan.\n"
                f"Previous user requests: {state.get('user_prompts', [])}\n"
                f"Current Spec (JSON): {json.dumps(state.get('spec', {}))}\n"
                f"New user request: {state.get('user_message', '')}\n\n"
                "CRITICAL RULES:\n"
                "  • If the user requests a DIFFERENT number of bedrooms (e.g. was 3BHK, now says 2BHK),\n"
                "    generate a COMPLETELY NEW spec matching the new request — do NOT keep old rooms.\n"
                "  • Only PRESERVE rooms that the user has NOT changed.\n"
                "  • EXACT DIMENSIONS — CRITICAL RULE:\n"
                "    - exact_width and exact_height MUST be null for ALL rooms by default.\n"
                "    - ONLY set them when the user explicitly named THAT SPECIFIC ROOM's size (e.g. '3x4m bedroom').\n"
                "    - Plot/land/site dimensions describe the OUTER BOUNDARY only — NEVER use as room exact_width/exact_height.\n"
                "  • Do NOT add extra rooms beyond what the user described.\n"
                "  • OPTIONAL ROOMS — NEVER generate these unless the user explicitly mentioned them by name:\n"
                "    corridor, parking, dining, utility, storage, pantry, study, gym, walk in closet,\n"
                "    home theater, library, servant room, prayer room, hallway, foyer.\n"
                "  • Use square meters. Keep total_area consistent with sum of room areas.\n"
                "ROOM NAME SYNONYMS — always map these to the correct type:\n"
                "  living: hall, drawing room, lounge, sitting room, family room, great room, living room\n"
                "  prayer room: pooja room, puja room, mandir, temple, mosque, masjid, chapel, holy room, worship room, prayer area\n"
                "  bedroom: master bedroom, kids room, guest room, children room\n"
                "  bathroom: toilet, washroom, restroom, WC, lavatory, powder room\n"
                "  kitchen: cook room\n"
                "  study: office room, work room, reading room\n"
                "  walk in closet: wardrobe room, dressing room\n"
                "UNSUPPORTED REQUESTS — if user asks for something that cannot be a room in a floor plan\n"
                "(e.g. swimming pool, jacuzzi, tennis court, helipad, basement, bowling alley),\n"
                "do NOT map it to any other room type (e.g. NEVER map 'swimming pool' to 'gym').\n"
                "Instead, add its name to the 'unsupported_requests' list and skip it entirely.\n"
                "BATHROOM DOORS — STRICT RULE:\n"
                "  A bathroom door may ONLY connect to a bedroom or a living room.\n"
                "  NEVER add a door from bathroom to: utility, kitchen, corridor, balcony, dining, or any other room type.\n"
                "ENTRANCE DOOR — MANDATORY:\n"
                "  The house must have exactly ONE entrance door from the street.\n"
                "  It MUST be written as: {\"from_room\": \"outside\", \"to_room\": \"<living_room_id>\", \"width\": 1.2, \"type\": \"single\"}\n"
                "  'outside' is a special reserved value meaning the street/exterior — it is NOT a room.\n"
                "  NEVER write the entrance as a door between two rooms (e.g. LIV01->KIT01 is WRONG for entrance).\n"
                "  All other doors connect room-to-room. Only the entrance uses 'outside'.\n"
                f"Architectural reference:\n{spec_context_doc}\n"
                f"Output format: {self.spec_parser.get_format_instructions()}\n"
                "DO NOT explain. Output ONLY the JSON object."
            )
        else:
            prompt_text = (
                "You are an expert floor plan designer. Generate a floor plan specification in JSON.\n"
                f"User Request: {state.get('user_message', '')}\n\n"
                "Output only what the user described — do not add extra rooms or details.\n"
                "OPTIONAL ROOMS — NEVER generate these unless the user explicitly mentioned them by name:\n"
                "  corridor, parking, dining, utility, storage, pantry, study, gym, walk in closet,\n"
                "  home theater, library, servant room, prayer room, hallway, foyer.\n"
                "ROOM NAME SYNONYMS — always map these to the correct type:\n"
                "  living: hall, drawing room, lounge, sitting room, family room, great room, living room\n"
                "  prayer room: pooja room, puja room, mandir, temple, mosque, masjid, chapel, holy room, worship room, prayer area\n"
                "  bedroom: master bedroom, kids room, guest room, children room\n"
                "  bathroom: toilet, washroom, restroom, WC, lavatory, powder room\n"
                "  kitchen: cook room\n"
                "  study: office room, work room, reading room\n"
                "  walk in closet: wardrobe room, dressing room\n"
                "UNSUPPORTED REQUESTS — if user asks for something that cannot be a room in a floor plan\n"
                "(e.g. swimming pool, jacuzzi, tennis court, helipad, basement, bowling alley),\n"
                "do NOT map it to any other room type (e.g. NEVER map 'swimming pool' to 'gym').\n"
                "Instead, add its name to the 'unsupported_requests' list and skip it entirely.\n"
                "BATHROOM DOORS — STRICT RULE:\n"
                "  A bathroom door may ONLY connect to a bedroom or a living room.\n"
                "  NEVER add a door from bathroom to: utility, kitchen, corridor, balcony, dining, or any other room type.\n"
                "Add doors so all rooms are accessible. Add windows per standard practice.\n"
                "Use square meters. Keep total_area consistent with sum of room areas.\n"
                "EXACT DIMENSIONS — CRITICAL RULE:\n"
                "  • exact_width and exact_height MUST be null for ALL rooms by default.\n"
                "  • ONLY set them when the user explicitly named THAT SPECIFIC ROOM's size (e.g. '3x4m bedroom' → bedroom exact_width=3, exact_height=4).\n"
                "  • Plot/land/site dimensions (e.g. '10x12 plot', '10x12m land') describe the OUTER BOUNDARY only — NEVER use them as room exact_width/exact_height.\n"
                "  • shape must remain 'rectangular' unless user explicitly said 'L-shaped' or 'T-shaped'.\n"
                "ENTRANCE DOOR — MANDATORY:\n"
                "  The house must have exactly ONE entrance door from the street.\n"
                "  It MUST be written as: {\"from_room\": \"outside\", \"to_room\": \"<living_room_id>\", \"width\": 1.2, \"type\": \"single\"}\n"
                "  'outside' is a special reserved value meaning the street/exterior — it is NOT a room.\n"
                "  NEVER write the entrance as a door between two rooms (e.g. LIV01->KIT01 is WRONG for entrance).\n"
                "  All other doors connect room-to-room. Only the entrance uses 'outside'.\n"
                f"Architectural reference:\n{spec_context_doc}\n"
                f"Output format: {self.spec_parser.get_format_instructions()}\n"
                "DO NOT explain. Output ONLY the JSON object."
            )

        spec = self._invoke_cached(
            prompt_text, self.spec_parser, name="spec", use_schema=True, use_json_mode=True
        )
        self._node_timings["spec_s"] = round(time.time() - _t, 1)
        self._record_ai_node_metric("spec", self._node_timings["spec_s"], "spec")

        # Collect unsupported requests (e.g. swimming pool, helipad) — continue building without them
        unsupported = list(spec.unsupported_requests) if hasattr(spec, "unsupported_requests") and spec.unsupported_requests else []
        if unsupported:
            print(f"[SpecNode] Unsupported requests noted (will inform user): {unsupported}")
        if not hasattr(self, "_current_thoughts"): self._current_thoughts = []
        self._current_thoughts.append("Generated room specifications and area requirements")

        # Hard-enforce: entrance door must always be from_room="outside" to living room.
        # Two-step safenet:
        #   Step 1 (prompt): explicit instruction prevents wrong output most of the time.
        #   Step 2 (here): normalize "outside" casing, strip ghost-room fake entrances, add missing entrance.
        spec_dict = spec.model_dump()
        doors = spec_dict.get("doors", [])
        rooms = spec_dict.get("rooms", [])
        all_room_ids = {r["id"] for r in rooms}
        living_ids = {r["id"] for r in rooms if r.get("type", "").lower() == "living"}

        # Normalize "outside" regardless of casing (LLM sometimes writes "Outside" or "OUTSIDE")
        for d in doors:
            if d.get("from_room", "").lower() == "outside":
                d["from_room"] = "outside"
            if d.get("to_room", "").lower() == "outside":
                d["to_room"] = "outside"

        # Remove any door that looks like a wrong "entrance": one endpoint is not a known room
        # and not "outside" (e.g. LLM used "ENTRANCE", "EXTERIOR", "STREET" as a fake room).
        # Only strip if it connects to a living room (i.e. was intended as the entrance).
        def _is_fake_entrance(d):
            from_r = d.get("from_room", "")
            to_r = d.get("to_room", "")
            from_ghost = from_r not in all_room_ids and from_r != "outside"
            to_ghost = to_r not in all_room_ids and to_r != "outside"
            touches_living = to_r in living_ids or from_r in living_ids
            return (from_ghost or to_ghost) and touches_living

        removed = [d for d in doors if _is_fake_entrance(d)]
        if removed:
            print(f"[SpecFix] Removed fake entrance door(s): {removed}")
        doors = [d for d in doors if not _is_fake_entrance(d)]

        has_entrance = any(
            d.get("from_room") == "outside" or d.get("to_room") == "outside"
            for d in doors
        )
        if not has_entrance and living_ids:
            # Add entrance door from outside to first living room
            living_id = next(iter(living_ids))
            doors.append({
                "from_room": "outside",
                "to_room": living_id,
                "width": 1.2,
                "type": "single",
                "swing": "into_to"
            })
            print(f"[SpecFix] Added missing entrance door: outside -> {living_id}")
        spec_dict["doors"] = doors

        print("Spec Generated:", spec_dict)
        return {"spec": spec_dict, "previous_spec": state.get("spec", {}), "unsupported_requests": unsupported}


    def polygon_node(self, state: FloorPlanState) -> dict:
        time.sleep(0.5)
        print("Polygon Agent Invoked")

        # Build plot-bounding-box constraint if the spec carries plot dimensions
        spec = state.get("spec", {})
        plot_w = spec.get("plot_width")
        plot_h = spec.get("plot_height")
        if plot_w and plot_h:
            plot_constraint = (
                f"\n        PLOT BOUNDING BOX — HARD CONSTRAINT:\n"
                f"        - The land is a rectangle {plot_w}m wide × {plot_h}m deep.\n"
                f"        - All room polygon coordinates must stay within (0,0) to ({plot_w},{plot_h}).\n"
                f"        - The building does NOT need to fill the entire plot — you have design freedom inside it.\n"
                f"        - To achieve good proportions, prefer a building footprint that is roughly {plot_w:.1f}m × {plot_h:.1f}m "
                f"(or a well-shaped subset). Do NOT squeeze all rooms into a narrow strip.\n"
            )
        else:
            # Derive suggested footprint from total_area — prefer near-square
            total = spec.get("total_area", 80)
            side = math.sqrt(total)
            suggested_w = round(side * 1.1, 1)   # slightly wider than square
            suggested_h = round(total / suggested_w, 1)
            plot_constraint = (
                f"\n        FOOTPRINT GUIDANCE:\n"
                f"        - Total area is {total}m². A good starting footprint is roughly {suggested_w}m × {suggested_h}m.\n"
                f"        - Do NOT produce a narrow, tall layout. Prefer width ≥ height or close to square.\n"
                f"        - If rooms don't fit well, widen the footprint — do not elongate individual rooms.\n"
            )

        # Build per-room dimension constraint table from spec
        spec_rooms = spec.get("rooms", [])
        exact_rows = []
        flexible_rows = []
        for r in spec_rooms:
            rid = r["id"]
            rtype = r.get("type", "")
            ew = r.get("exact_width")
            eh = r.get("exact_height")
            area = r.get("target_area", "?")
            if ew and eh:
                exact_rows.append(f"        - {rid} ({rtype}): width={ew}m × height={eh}m = {ew*eh:.1f}m²  ← EXACT, use these coordinates, non-negotiable")
            elif ew:
                exact_rows.append(f"        - {rid} ({rtype}): width={ew}m (exact), height=flexible, area≈{area}m²")
            elif eh:
                exact_rows.append(f"        - {rid} ({rtype}): height={eh}m (exact), width=flexible, area≈{area}m²")
            else:
                flexible_rows.append(f"        - {rid} ({rtype}): target_area={area}m² (flexible dims)")

        if exact_rows:
            dim_table = (
                f"\n        PRE-COMPUTED ROOM DIMENSIONS (read before placing any coordinates):\n"
                f"        FIXED — use exactly these polygon dimensions, do NOT round or approximate:\n"
                + "\n".join(exact_rows) + "\n"
                + (("        FLEXIBLE — use target_area + standard minimums:\n" + "\n".join(flexible_rows) + "\n") if flexible_rows else "")
            )
        else:
            dim_table = ""
        plot_constraint = dim_table + plot_constraint

        # Carry proportion violations from a previous failed regeneration attempt
        prev_report = state.get("validation_report", {})
        regen_errors = []
        if prev_report:
            regen_errors += [i.get("issue", "") for i in prev_report.get("room_dimensions", []) if isinstance(i, dict)]
            regen_errors += [i.get("issue", "") for i in prev_report.get("room_shapes", []) if isinstance(i, dict)]
        regen_hint = ""
        if regen_errors:
            regen_hint = (
                "\n        PREVIOUS ATTEMPT FAILED — fix these specific violations:\n"
                + "\n".join(f"        - {e}" for e in regen_errors if e)
                + "\n"
            )

        if state.get("is_first"):
            prompt = """
        You are a floor-plan layout engine.
        Given a high-level specification (rooms, target areas, adjacencies, doors, windows),
        generate a coherent 2D layout as polygons in a shared coordinate system.
        Input spec (JSON):
        {spec_json}
        User prompt:
        {user_message}

        EXACT DIMENSIONS (a pre-computed constraint table is appended below — read it before Step 0):
        - Any room listed as FIXED in the constraint table MUST have its polygon match those dimensions exactly.
          exact_width = the room's x-span (max_x - min_x). exact_height = the room's y-span (max_y - min_y).
          No rounding, no approximation. Plan the entire layout around fixed rooms first, then fill flexible rooms.
        - Rooms listed as FLEXIBLE: use target_area + standard minimum dimension constraints.

        Output format -- a JSON object following LayoutSchema:
        {{"rooms": [{{"id": "<id>", "type": "<type>", "polygon": [[x,y],...], "shape": "<shape>"}},...] }}
        Polygons must be non-overlapping, respect target areas (+-10%), honor adjacencies.

        ══════════════════════════════════════════════════════════════
        OVERALL HOUSE SHAPE — DEFAULT RULE (read before placing any room)
        ══════════════════════════════════════════════════════════════
        Unless the user explicitly requested a specific house shape (e.g. "L-shaped house", "U-shaped plan"):
          • The combined footprint of ALL rooms MUST form a single compact RECTANGLE or SQUARE.
          • This means: when you look at the bounding box of all rooms together, the rooms must fill it
            completely with no large gaps or notches — like a solid rectangular block.
          • Do NOT produce L-shaped, T-shaped, U-shaped, or irregular building outlines by default.
          • Every room is a rectangle. Arrange them so they tile together into one clean rectangle.
          • The PLOT BOUNDING BOX (if given) constrains coordinates — the house footprint is free to be
            any well-proportioned rectangle WITHIN that plot (does not need to fill the whole plot).
        If the user DID specify a shape (e.g. "L-shaped"), honour it exactly.

        ══════════════════════════════════════════════════════════════
        STEP 0 — CIRCULATION FIRST (mandatory before any coordinates)
        ══════════════════════════════════════════════════════════════
        Every room MUST have a door. All rooms MUST be accessible from the living room through a series of doors.
        
        Read every door pair from the spec. Build adjacency list:
            e.g. LIV01<->KIT01 | LIV01<->BR01 | BR01<->BATH01 | BR01<->BAL01

        For EVERY pair (A<->B): A and B MUST share >=1.0m continuous wall.
        No shared wall = no door = REJECTED.

        BEDROOM-TO-LIVING MANDATORY: Every bedroom (BRxx) MUST have a door to the living room.
          If the spec omits a LIV<->BRxx pair for any bedroom, add it to the adjacency list.
          Then ensure that bedroom and living share >=1.2m continuous wall.
          A bedroom with no path to living = HARD REJECTION (violates circulation).

        Sketch a 2D adjacency grid BEFORE placing any coordinates.
        LIVING IS THE HUB: place LIV first. Every room with a door to LIV must physically border it.
        ONLY after the grid satisfies all door pairs -> assign coordinates.

        VALID PATTERN (3-BHK):
            [BR01][BATH01] | [LIV] | [BR02][BATH02]
            [BAL01       ] | [KIT] | [BAL02       ]
            LIV shares wall with BR01 (left), KIT (below), BR02 (right). All doors satisfied.

        REJECTED PATTERN:
            [BR01] isolated top-left, [LIV] at bottom-right -- zero shared wall.
            Door LIV<->BR01 has no wall to be placed on = HARD REJECTION.

        ══════════════════════════════════════════════════════════════
        STEP 1 — ZONING AND PLACEMENT PRIORITY
        ══════════════════════════════════════════════════════════════
        Divide into: PUBLIC zone (living, kitchen, dining) and PRIVATE zone (bedrooms, bathrooms).
        They occupy separate parts of the house and share one wall. Do NOT mix zones.
        Never stack all bedrooms in one column. Never stack all bathrooms in one column.
        Prefer bedroom short side >=3.5m (enables carved bathroom + full-width balcony).

        PLACEMENT PRIORITY ORDER (assign polygons in this sequence):
          1. LIVING ROOM — anchor first, near the plot centroid.
          2. BEDROOMS — place directly bordering living, filling the private zone near the centroid.
             Bedrooms are PRIMARY rooms: their polygon dimensions are fixed first.
          3. KITCHEN / DINING — attach to living in the public zone.
          4. BATHROOMS — DERIVED from bedrooms: carved into a back corner of the already-placed bedroom.
             A bathroom has no independent position; it exists inside the bedroom's bounding box.
          5. BALCONIES — DERIVED from bedrooms: attached to the bedroom's remaining exterior wall.
             A balcony has no independent position; it projects from the bedroom's outer edge.
          6. PARKING / CORRIDOR — attach to living room
          7. OTHER (e.g. utility, storage, pantry) — place in remaining gaps, but only after all primary rooms are placed.

        BEDROOM PROXIMITY RULE: Every bedroom polygon must be as close to the plot centroid as possible.
          Do NOT push bedrooms to the extreme edges of the plot to "make room" for bathrooms or balconies.
          Bathrooms and balconies are smaller and derive their position FROM the bedroom — never the reverse.
          If there is a conflict between bedroom size and balcony depth, shrink the balcony (min 1.0m depth),
          never shrink the bedroom below minimum dimensions.

        ══════════════════════════════════════════════════════════════
        STEP 2 — ROOM PLACEMENT RULES
        ══════════════════════════════════════════════════════════════

        LIVING:
        - Must share >=1.2m wall with EVERY bedroom (all BRxx) — required for bedroom doors.
          Not just 2 bedrooms: in a 3-BHK, all 3 bedrooms must physically border the living room.
        - Must have >=1.5m free exterior wall (not shared with any other room) for the house entrance.
        - May be enclosed on up to 3 sides; at least 1 side (>=1.5m) must face outside.

        KITCHEN:
        - Must share a wall edge with the living room -- not separated by another room.

        UTILITY:
        - Must have a door connecting it to an adjacent room (kitchen, bedroom, balcony or living preferred — NEVER bathroom).
        - The door must appear in the doors list with to_room = utility room id.
        - NEVER leave a utility room with no door — it must be reachable from the house interior.

        BATHROOMS:
        Option A (SEPARATE rectangle): shares one wall with bedroom, inside building footprint.
          ONLY ALLOWED when there are 1-2 bedrooms AND the bathroom is on the side/far wall of the
          bedroom that is AWAY from the living room. In all other cases Option A is FORBIDDEN.
        Option B (CARVED -- MANDATORY for 3+ bedrooms): carved as rectangle into one corner of
          bedroom, making the bedroom L-shaped (6 corners). Entry corridor >=1.2m. Sleeping area >=2.5mx2.5m.
          The carved corner MUST be on the bedroom's far or side wall (away from living room).
          For 3+ bedroom layouts: Option B is REQUIRED for ALL bathrooms -- no exceptions.

        BATHROOM BOUNDING-BOX RULE (critical): The bathroom polygon MUST lie entirely within the
          bedroom's original rectangular bounding box. NEVER push a bathroom outside the bedroom's
          north/south/east/west walls. A bathroom that appears beyond the bedroom's outer edge is wrong.
          WRONG: bedroom north wall at y=10, balcony at y=10..11.2, bathroom placed at y=11.2..14.2
                 (bathroom north of balcony = outside building = HARD REJECTION).
          CORRECT: bedroom spans y=7..10 (north wall at y=10). Bathroom carved into NW corner at
                   x=0..2, y=8..10. Balcony attaches to remaining north wall x=2..6, y=10..11.2.
                   Bedroom L-shape occupies the rest: x=0..6, y=7..10 minus the 2x2 bath corner.

        BEDROOM WITH BALCONY + BATHROOM (most common 3-BHK case):
          Step 1: Decide bedroom bounding box (e.g. x=2..6, y=7..10 = 4m wide, 3m deep).
          Step 2: Carve bathroom into one back corner (e.g. NE: x=4..6, y=8..10 = 2x2m).
          Step 3: Bedroom becomes L-shaped (6 corners), remaining sleeping area >=2.5x2.5m.
          Step 4: Balcony attaches to the back exterior wall of the L -- the portion NOT occupied
                  by bathroom (e.g. x=2..4, y=10..11.2 = 2m wide strip, 1.2m deep).
          The balcony shares the bedroom's back wall. Both stay within the building + balcony projection.

        COMB-SHAPE RULE: NEVER place all bathrooms as separate polygons in a row between the bedroom
          zone and the living room. This creates a comb/C-shape and blocks ALL bedroom doors = HARD REJECTION.

        BATHROOM-BLOCKING RULE (enforce with coordinates, not just words):
          Step 1 — Identify the bedroom's LIVING-FACING WALL: the wall edge that is shared with or
                   directly adjacent to the living room. Call its coordinate the "living side".
          Step 2 — The bathroom polygon MUST NOT touch the living-facing wall AT ALL.
                   No vertex of the bathroom may lie on, or beyond, the living-facing wall coordinate.
          Step 3 — Verify: shared boundary between bathroom and living room == 0m (no shared edge).
                   If bath.boundary intersects living.boundary > 0 -> HARD REJECTION.

          Example — bedroom south wall at y=4 borders living (y=0..4):
            FORBIDDEN: bath has any vertex with y <= 4 (touches or crosses the living-facing wall).
            REQUIRED:  bath entirely above y=4+epsilon. E.g. bath carved at y=6..8 (back/north of bedroom).

          CORRECT: BR01 y=4..8 (south wall at y=4 borders LIV) -> BATH01 carved at y=6..8 (north corner).
          WRONG:   BR01 y=4..8 -> BATH01 at y=4..6 (south half of bedroom, touching living wall).

        HARD-REJECTED PATTERNS (do not output these under any circumstance):
          REJECTED: Bathroom placed beyond a balcony (north of bedroom's north wall) -- outside building.
          REJECTED: [BR01][BATH01] row / [BR02][BATH02] row / [BR03][BATH03] row all between bedrooms
                    and living -- produces [BATH][BATH][BATH] strip that blocks every bedroom door.
          REJECTED: Any configuration where a bathroom shares wall with the living room
                    (means bathroom is sandwiched between its bedroom and living).
          CORRECT:  Bedrooms form a row bordering living directly. Each bedroom is L-shaped with its
                    bathroom carved into the back corner (away from living). Balcony on remaining back wall:
                    [BR01: L-shape, bath@back-corner, balcony@back-wall] [BR02: same] [BR03: same]
                                        [          LIVING ROOM (full width)          ]

        GARAGE / PARKING:
        - PARKING DETERMINES ENTRANCE DIRECTION (not the other way around):
          Step 1 — Decide which exterior wall the parking polygon faces (the wall at the plot boundary).
          Step 2 — The house entrance MUST be on that SAME exterior wall.
          Step 3 — Among all candidate segments on that wall, place the entrance on the segment with
                   the MOST free exterior length (the longest unshared portion of that wall on living).
          This ensures entrance and parking are co-located on the same facade.
        - If parking bottom edge is at y=0 (south) -> entrance must also be on south wall (y=0).
        - If parking top edge is at y=plot_height (north) -> entrance must also be on north wall.
          CORRECT: parking south face at y=0, entrance on south wall of living at y=0.
          WRONG:   parking south face at y=0, entrance on east or west wall.
        - Garage must also share a wall with the living room (per spec adjacency).

        BALCONIES:
        - Attach to bedrooms on an EXTERIOR wall -- never sandwiched between interior rooms.
        - LONG SIDE (width) = full exterior wall of parent bedroom (or the remaining exterior wall after
          bathroom is carved from one corner). This is the shared wall (>=60% of long dim).
        - If bedroom is L-shaped (bathroom in back corner): balcony attaches to the remaining portion
          of the back wall ONLY -- not beyond the bathroom, not past the bedroom's side walls.
        - DEPTH (short side, perpendicular) = 1.0-1.5m projecting outward. NEVER exceed 1.5m.
        - Ratio width/depth >=2.5 (strip, not square).  CORRECT: 4mx1.2m.  WRONG: 2mx2m.
        - ALIGNMENT: balcony inner edge coords must EXACTLY match parent room outer wall coords.
        - NOT on entrance side: if entrance faces south, balconies attach to north/east/west only.

        ROOM SIZING -- EXPAND DON'T SKIP:
        - BEDROOM-TO-LIVING (mandatory for ALL bedrooms): Every BRxx needs >=1.2m shared wall with living.
          If ANY bedroom shares <1.0m with living: expand that bedroom's width or living's width until >=1.2m.
          Expansion priority: widen the bedroom first (add 0.5–1.0m); if plot width exhausted, widen living.
          Never skip this — a bedroom inaccessible from living is a hard rejection.
        - If living has <1.5m free exterior (entrance can't fit): expand living outward.
        - Never accept a layout where a required door has no physical wall to be placed on.

        EXACT DIMENSIONS:
        - If a room has exact_width/exact_height in spec: polygon MUST use those exact dimensions. No approximation.

        ══════════════════════════════════════════════════════════════
        STEP 3 — SHAPE & DIMENSION HARD LIMITS
        ══════════════════════════════════════════════════════════════
        Room shapes:
          bathroom / kitchen / balcony / corridor / utility = exactly 4 corners (rectangle).
          bedroom / living = 4 corners (rectangle) OR 6 corners (L-shape only).
          No diagonal walls. No room with >6 corners. No trapezoidal rooms.

        Minimum dimensions -- validator rejects ANY violation:
          Bathroom : short>=1.8m  area>=4.0m2   ratio<=1.6
          Bedroom  : short>=3.0m  area>=10.0m2  ratio<=1.5
          Kitchen  : short>=2.8m  area>=8.0m2   ratio<=1.8
          Living   : short>=4.0m  area>=14.0m2  ratio<=1.8
          Balcony  : short>=1.0m  area>=3.5m2   ratio>=2.5 (must be a strip, not square)

        ══════════════════════════════════════════════════════════════
        STEP 4 — TILING (no gaps, no overlaps)
        ══════════════════════════════════════════════════════════════
        - Coordinates in meters, origin (0,0) bottom-left corner.
        - ZERO GAPS: if room A ends at x=4.0, next room starts at EXACTLY x=4.0.
        - Every square meter inside the outer boundary belongs to exactly one room.
        - VERTEX FORMAT: every vertex = [x, y] (two numbers, never one).
          Valid rectangle: [[0,0],[4,0],[4,3],[0,3]]. NEVER output a vertex like [10.5].
        - Tiling self-verify before outputting:
            (a) Sum all room areas = enclosed boundary area (+-3%). If not -> internal void -> fix.
            (b) convex_hull_area - building_area <= 1m2. If more -> enclosed outdoor void -> redesign.

        ══════════════════════════════════════════════════════════════
        STEP 5 — BUILDING SHAPE (boundary constraint)
        ══════════════════════════════════════════════════════════════
        Outer boundary: <=12 corners. At most 1 concave corner. Convex hull fill >=0.65.
        Footprint ratio <=2.5:1 in both directions.
          VALID: Rectangle (0 concave corners), L-shape (1 concave corner).
          REJECTED: U-shape, C-shape, cross/plus (>=2 concave corners).

        ══════════════════════════════════════════════════════════════
        STEP 6 — VALIDATOR CHECKLIST (auto-rejects on failure)
        ══════════════════════════════════════════════════════════════
        (1)  No room overlap (intersection < 1e-6 m2)
        (2)  All rooms reachable via door-graph BFS
        (3)  Every room shares >=0.05m wall with a neighbor (no floating rooms)
        (4)  Every bathroom shares >=0.1m wall with >=1 bedroom (not just a corner)
        (5)  No bathroom shares >=0.1m wall with kitchen
        (6)  Living has >=1.5m free exterior wall
        (7)  Living area >=18% of total_area (>=20m2 if total>=100m2)
        (8)  Living shares >=1.2m wall with ALL bedrooms (every BRxx must border living)
        (9)  Footprint ratio <=2.5:1
        (10) Boundary <=12 corners, convex hull fill >=0.65, no diagonal walls
        (11) Room shapes: 4 corners (or 6 for bedroom/living L-shape only)
        (12) All dimension thresholds met (Step 3)
        (13) No bathroom placed between its bedroom and the living room
        (14) Garage opening faces same exterior direction as house entrance

        PRE-OUTPUT SELF-CHECK -- tick every box or redo from STEP 0:
        [] (0) Every door pair (A,B) shares >=1.0m continuous wall -- verify each pair
        [] (1) No polygon overlap > 1e-6 m2
        [] (2) All rooms reachable and have a door
        [] (3) All rooms wall-connected (>=0.05m)
        [] (4) Every bathroom touches its bedroom (>=0.1m, not corner only)
        [] (5) No bathroom touches kitchen
        [] (6) Living >=1.5m free exterior wall
        [] (7) Living area >=18% of total
        [] (8) Living shares >=1.2m wall with EVERY bedroom (all BRxx, not just 2)
        [] (9) Footprint ratio <=2.5:1
        [] (10) Boundary <=12 corners, no enclosed void
        [] (11) All room shapes correct (4 or 6 corners only)
        [] (12) All dimensions valid (Step 3 table)
        [] (13) Sum of room areas ~= enclosed boundary area (+-3%)
        [] (14) Every balcony long side is shared wall with bedroom (not short end)
        [] (15) Entrance door on living exterior wall (not bedroom)
        [] (16) No bathroom sits between its bedroom and the living room
        [] (17) Garage or balconyopening faces same wall direction as house entrance
        [] (18) House entrance MUST be on free exterior wall of living room (not shared with any other room like balcony, parking etc). 

        Note: coordinates must NOT go outside the plot/footprint boundary.
        Any door that connects to outside -- must use "outside" as the to_room value.
"""
            prompt = prompt.format(spec_json=json.dumps(state.get("spec", {})), user_message=state.get("user_message", ""))
            
             ### Receieved from backend pull
            prompt += plot_constraint + regen_hint
        else:
            prompt = """
        You are a floor-plan layout engine.
        Given a high-level specification (rooms, target areas, adjacencies, doors, windows),
        generate a coherent 2D layout as polygons in a shared coordinate system.
        Previous Spec (JSON):
        {previous_spec_json}
        Current Spec (JSON):
        {spec_json}
        Previous layout (JSON):
        {previous_layout_json}
        Previous user prompt:
        {previous_user_message}
        Current user prompt:
        {user_message}

        EXACT DIMENSIONS (a pre-computed constraint table is appended below — read it before Step 0):
        - Any room listed as FIXED in the constraint table MUST have its polygon match those dimensions exactly.
          exact_width = the room's x-span (max_x - min_x). exact_height = the room's y-span (max_y - min_y).
          No rounding, no approximation. Plan the entire layout around fixed rooms first, then fill flexible rooms.
        - Rooms listed as FLEXIBLE: use target_area + standard minimum dimension constraints.

        Output format -- a JSON object following LayoutSchema:
        {{"rooms": [{{"id": "<id>", "type": "<type>", "polygon": [[x,y],...], "shape": "<shape>"}},...] }}
        Polygons must be non-overlapping, respect target areas (+-10%), honor adjacencies.

        ══════════════════════════════════════════════════════════════
        OVERALL HOUSE SHAPE — DEFAULT RULE (read before placing any room)
        ══════════════════════════════════════════════════════════════
        Unless the user explicitly requested a specific house shape (e.g. "L-shaped house", "U-shaped plan"):
          • The combined footprint of ALL rooms MUST form a single compact RECTANGLE or SQUARE.
          • This means: when you look at the bounding box of all rooms together, the rooms must fill it
            completely with no large gaps or notches — like a solid rectangular block.
          • Do NOT produce L-shaped, T-shaped, U-shaped, or irregular building outlines by default.
          • Every room is a rectangle. Arrange them so they tile together into one clean rectangle.
          • The PLOT BOUNDING BOX (if given) constrains coordinates — the house footprint is free to be
            any well-proportioned rectangle WITHIN that plot (does not need to fill the whole plot).
        If the user DID specify a shape (e.g. "L-shaped"), honour it exactly.

        ══════════════════════════════════════════════════════════════
        STEP 0 — CIRCULATION FIRST (mandatory before any coordinates)
        ══════════════════════════════════════════════════════════════
        Read every door pair from the spec. Build adjacency list:
            e.g. LIV01<->KIT01 | LIV01<->BR01 | BR01<->BATH01 | BR01<->BAL01

        For EVERY pair (A<->B): A and B MUST share >=1.0m continuous wall.
        No shared wall = no door = REJECTED.

        BEDROOM-TO-LIVING MANDATORY: Every bedroom (BRxx) MUST have a door to the living room.
          If the spec omits a LIV<->BRxx pair for any bedroom, add it to the adjacency list.
          Then ensure that bedroom and living share >=1.2m continuous wall.
          A bedroom with no path to living = HARD REJECTION (violates circulation).

        Sketch a 2D adjacency grid BEFORE placing any coordinates.
        LIVING IS THE HUB: place LIV first. Every room with a door to LIV must physically border it.
        ONLY after the grid satisfies all door pairs -> assign coordinates.

        VALID PATTERN (3-BHK):
            [BR01][BATH01] | [LIV] | [BR02][BATH02]
            [BAL01       ] | [KIT] | [BAL02       ]
            LIV shares wall with BR01 (left), KIT (below), BR02 (right). All doors satisfied.

        REJECTED PATTERN:
            [BR01] isolated top-left, [LIV] at bottom-right -- zero shared wall.
            Door LIV<->BR01 has no wall to be placed on = HARD REJECTION.

        ══════════════════════════════════════════════════════════════
        STEP 1 — ZONING AND PLACEMENT PRIORITY
        ══════════════════════════════════════════════════════════════
        Divide into: PUBLIC zone (living, kitchen, dining) and PRIVATE zone (bedrooms, bathrooms).
        They occupy separate parts of the house and share one wall. Do NOT mix zones.
        Never stack all bedrooms in one column. Never stack all bathrooms in one column.
        Prefer bedroom short side >=3.5m (enables carved bathroom + full-width balcony).

        PLACEMENT PRIORITY ORDER (assign polygons in this sequence):
          1. LIVING ROOM — anchor first, near the plot centroid.
          2. BEDROOMS — place directly bordering living, filling the private zone near the centroid.
             Bedrooms are PRIMARY rooms: their polygon dimensions are fixed first.
          3. KITCHEN / DINING — attach to living in the public zone.
          4. BATHROOMS — DERIVED from bedrooms: carved into a back corner of the already-placed bedroom.
             A bathroom has no independent position; it exists inside the bedroom's bounding box.
          5. BALCONIES — DERIVED from bedrooms: attached to the bedroom's remaining exterior wall.
             A balcony has no independent position; it projects from the bedroom's outer edge.
          6. PARKING / UTILITY / CORRIDOR — fill remaining space.

        BEDROOM PROXIMITY RULE: Every bedroom polygon must be as close to the plot centroid as possible.
          Do NOT push bedrooms to the extreme edges of the plot to "make room" for bathrooms or balconies.
          Bathrooms and balconies are smaller and derive their position FROM the bedroom — never the reverse.
          If there is a conflict between bedroom size and balcony depth, shrink the balcony (min 1.0m depth),
          never shrink the bedroom below minimum dimensions.

        ══════════════════════════════════════════════════════════════
        STEP 2 — ROOM PLACEMENT RULES
        ══════════════════════════════════════════════════════════════

        LIVING:
        - Must share >=1.2m wall with EVERY bedroom (all BRxx) — required for bedroom doors.
          Not just 2 bedrooms: in a 3-BHK, all 3 bedrooms must physically border the living room.
        - Must have >=1.5m free exterior wall (not shared with any other room) for the house entrance.
        - May be enclosed on up to 3 sides; at least 1 side (>=1.5m) must face outside.

        KITCHEN:
        - Must share a wall edge with the living room -- not separated by another room.

        UTILITY:
        - Must have a door connecting it to an adjacent room (kitchen or living preferred).
        - The door must appear in the doors list with to_room = utility room id.
        - NEVER leave a utility room with no door — it must be reachable from the house interior.

        BATHROOMS:
        Option A (SEPARATE rectangle): shares one wall with bedroom, inside building footprint.
          ONLY ALLOWED when there are 1-2 bedrooms AND the bathroom is on the side/far wall of the
          bedroom that is AWAY from the living room. In all other cases Option A is FORBIDDEN.
        Option B (CARVED -- MANDATORY for 3+ bedrooms): carved as rectangle into one corner of
          bedroom, making the bedroom L-shaped (6 corners). Entry corridor >=1.2m. Sleeping area >=2.5mx2.5m.
          The carved corner MUST be on the bedroom's far or side wall (away from living room).
          For 3+ bedroom layouts: Option B is REQUIRED for ALL bathrooms -- no exceptions.

        BATHROOM BOUNDING-BOX RULE (critical): The bathroom polygon MUST lie entirely within the
          bedroom's original rectangular bounding box. NEVER push a bathroom outside the bedroom's
          north/south/east/west walls. A bathroom that appears beyond the bedroom's outer edge is wrong.
          WRONG: bedroom north wall at y=10, balcony at y=10..11.2, bathroom placed at y=11.2..14.2
                 (bathroom north of balcony = outside building = HARD REJECTION).
          CORRECT: bedroom spans y=7..10 (north wall at y=10). Bathroom carved into NW corner at
                   x=0..2, y=8..10. Balcony attaches to remaining north wall x=2..6, y=10..11.2.
                   Bedroom L-shape occupies the rest: x=0..6, y=7..10 minus the 2x2 bath corner.

        BEDROOM WITH BALCONY + BATHROOM (most common 3-BHK case):
          Step 1: Decide bedroom bounding box (e.g. x=2..6, y=7..10 = 4m wide, 3m deep).
          Step 2: Carve bathroom into one back corner (e.g. NE: x=4..6, y=8..10 = 2x2m).
          Step 3: Bedroom becomes L-shaped (6 corners), remaining sleeping area >=2.5x2.5m.
          Step 4: Balcony attaches to the back exterior wall of the L -- the portion NOT occupied
                  by bathroom (e.g. x=2..4, y=10..11.2 = 2m wide strip, 1.2m deep).
          The balcony shares the bedroom's back wall. Both stay within the building + balcony projection.

        COMB-SHAPE RULE: NEVER place all bathrooms as separate polygons in a row between the bedroom
          zone and the living room. This creates a comb/C-shape and blocks ALL bedroom doors = HARD REJECTION.

        BATHROOM-BLOCKING RULE (enforce with coordinates, not just words):
          Step 1 — Identify the bedroom's LIVING-FACING WALL: the wall edge that is shared with or
                   directly adjacent to the living room. Call its coordinate the "living side".
          Step 2 — The bathroom polygon MUST NOT touch the living-facing wall AT ALL.
                   No vertex of the bathroom may lie on, or beyond, the living-facing wall coordinate.
          Step 3 — Verify: shared boundary between bathroom and living room == 0m (no shared edge).
                   If bath.boundary intersects living.boundary > 0 -> HARD REJECTION.

          Example — bedroom south wall at y=4 borders living (y=0..4):
            FORBIDDEN: bath has any vertex with y <= 4 (touches or crosses the living-facing wall).
            REQUIRED:  bath entirely above y=4+epsilon. E.g. bath carved at y=6..8 (back/north of bedroom).

          CORRECT: BR01 y=4..8 (south wall at y=4 borders LIV) -> BATH01 carved at y=6..8 (north corner).
          WRONG:   BR01 y=4..8 -> BATH01 at y=4..6 (south half of bedroom, touching living wall).

        HARD-REJECTED PATTERNS (do not output these under any circumstance):
          REJECTED: Bathroom placed beyond a balcony (north of bedroom's north wall) -- outside building.
          REJECTED: [BR01][BATH01] row / [BR02][BATH02] row / [BR03][BATH03] row all between bedrooms
                    and living -- produces [BATH][BATH][BATH] strip that blocks every bedroom door.
          REJECTED: Any configuration where a bathroom shares wall with the living room
                    (means bathroom is sandwiched between its bedroom and living).
          CORRECT:  Bedrooms form a row bordering living directly. Each bedroom is L-shaped with its
                    bathroom carved into the back corner (away from living). Balcony on remaining back wall:
                    [BR01: L-shape, bath@back-corner, balcony@back-wall] [BR02: same] [BR03: same]
                                        [          LIVING ROOM (full width)          ]

        GARAGE / PARKING:
        - PARKING DETERMINES ENTRANCE DIRECTION (not the other way around):
          Step 1 — Decide which exterior wall the parking polygon faces (the wall at the plot boundary).
          Step 2 — The house entrance MUST be on that SAME exterior wall.
          Step 3 — Among all candidate segments on that wall, place the entrance on the segment with
                   the MOST free exterior length (the longest unshared portion of that wall on living).
          This ensures entrance and parking are co-located on the same facade.
        - If parking bottom edge is at y=0 (south) -> entrance must also be on south wall (y=0).
        - If parking top edge is at y=plot_height (north) -> entrance must also be on north wall.
          CORRECT: parking south face at y=0, entrance on south wall of living at y=0.
          WRONG:   parking south face at y=0, entrance on east or west wall.
        - Garage must also share a wall with the living room (per spec adjacency).

        BALCONIES:
        - Attach to bedrooms on an EXTERIOR wall -- never sandwiched between interior rooms.
        - LONG SIDE (width) = full exterior wall of parent bedroom (or the remaining exterior wall after
          bathroom is carved from one corner). This is the shared wall (>=60% of long dim).
        - If bedroom is L-shaped (bathroom in back corner): balcony attaches to the remaining portion
          of the back wall ONLY -- not beyond the bathroom, not past the bedroom's side walls.
        - DEPTH (short side, perpendicular) = 1.0-1.5m projecting outward. NEVER exceed 1.5m.
        - Ratio width/depth >=2.5 (strip, not square).  CORRECT: 4mx1.2m.  WRONG: 2mx2m.
        - ALIGNMENT: balcony inner edge coords must EXACTLY match parent room outer wall coords.
        - NOT on entrance side: if entrance faces south, balconies attach to north/east/west only.

        ROOM SIZING -- EXPAND DON'T SKIP:
        - BEDROOM-TO-LIVING (mandatory for ALL bedrooms): Every BRxx needs >=1.2m shared wall with living.
          If ANY bedroom shares <1.0m with living: expand that bedroom's width or living's width until >=1.2m.
          Expansion priority: widen the bedroom first (add 0.5–1.0m); if plot width exhausted, widen living.
          Never skip this — a bedroom inaccessible from living is a hard rejection.
        - If living has <1.5m free exterior (entrance can't fit): expand living outward.
        - Never accept a layout where a required door has no physical wall to be placed on.

        EXACT DIMENSIONS:
        - If a room has exact_width/exact_height in spec: polygon MUST use those exact dimensions. No approximation.

        ══════════════════════════════════════════════════════════════
        STEP 3 — SHAPE & DIMENSION HARD LIMITS
        ══════════════════════════════════════════════════════════════
        Room shapes:
          bathroom / kitchen / balcony / corridor / utility = exactly 4 corners (rectangle).
          bedroom / living = 4 corners (rectangle) OR 6 corners (L-shape only).
          No diagonal walls. No room with >6 corners. No trapezoidal rooms.

        Minimum dimensions -- validator rejects ANY violation:
          Bathroom : short>=1.8m  area>=4.0m2   ratio<=1.6
          Bedroom  : short>=3.0m  area>=10.0m2  ratio<=1.5
          Kitchen  : short>=2.8m  area>=8.0m2   ratio<=1.8
          Living   : short>=4.0m  area>=14.0m2  ratio<=1.8
          Balcony  : short>=1.0m  area>=3.5m2   ratio>=2.5 (must be a strip, not square)

        ══════════════════════════════════════════════════════════════
        STEP 4 — TILING (no gaps, no overlaps)
        ══════════════════════════════════════════════════════════════
        - Coordinates in meters, origin (0,0) bottom-left corner.
        - ZERO GAPS: if room A ends at x=4.0, next room starts at EXACTLY x=4.0.
        - Every square meter inside the outer boundary belongs to exactly one room.
        - VERTEX FORMAT: every vertex = [x, y] (two numbers, never one).
          Valid rectangle: [[0,0],[4,0],[4,3],[0,3]]. NEVER output a vertex like [10.5].
        - Tiling self-verify before outputting:
            (a) Sum all room areas = enclosed boundary area (+-3%). If not -> internal void -> fix.
            (b) convex_hull_area - building_area <= 1m2. If more -> enclosed outdoor void -> redesign.

        ══════════════════════════════════════════════════════════════
        STEP 5 — BUILDING SHAPE (boundary constraint)
        ══════════════════════════════════════════════════════════════
        Outer boundary: <=12 corners. At most 1 concave corner. Convex hull fill >=0.65.
        Footprint ratio <=2.5:1 in both directions.
          VALID: Rectangle (0 concave corners), L-shape (1 concave corner).
          REJECTED: U-shape, C-shape, cross/plus (>=2 concave corners).

        ══════════════════════════════════════════════════════════════
        STEP 6 — VALIDATOR CHECKLIST (auto-rejects on failure)
        ══════════════════════════════════════════════════════════════
        (1)  No room overlap (intersection < 1e-6 m2)
        (2)  All rooms reachable via door-graph BFS
        (3)  Every room shares >=0.05m wall with a neighbor (no floating rooms)
        (4)  Every bathroom shares >=0.1m wall with >=1 bedroom (not just a corner)
        (5)  No bathroom shares >=0.1m wall with kitchen
        (6)  Living has >=1.5m free exterior wall
        (7)  Living area >=18% of total_area (>=20m2 if total>=100m2)
        (8)  Living shares >=1.2m wall with ALL bedrooms (every BRxx must border living)
        (9)  Footprint ratio <=2.5:1
        (10) Boundary <=12 corners, convex hull fill >=0.65, no diagonal walls
        (11) Room shapes: 4 corners (or 6 for bedroom/living L-shape only)
        (12) All dimension thresholds met (Step 3)
        (13) No bathroom placed between its bedroom and the living room
        (14) Garage opening faces same exterior direction as house entrance

        PRE-OUTPUT SELF-CHECK -- tick every box or redo from STEP 0:
        [] (0) Every door pair (A,B) shares >=1.0m continuous wall -- verify each pair
        [] (1) No polygon overlap > 1e-6 m2
        [] (2) All rooms reachable and have a door
        [] (3) All rooms wall-connected (>=0.05m)
        [] (4) Every bathroom touches its bedroom (>=0.1m, not corner only)
        [] (5) No bathroom touches kitchen
        [] (6) Living >=1.5m free exterior wall
        [] (7) Living area >=18% of total
        [] (8) Living shares >=1.2m wall with EVERY bedroom (all BRxx, not just 2)
        [] (9) Footprint ratio <=2.5:1
        [] (10) Boundary <=12 corners, no enclosed void
        [] (11) All room shapes correct (4 or 6 corners only)
        [] (12) All dimensions valid (Step 3 table)
        [] (13) Sum of room areas ~= enclosed boundary area (+-3%)
        [] (14) Every balcony long side is shared wall with bedroom (not short end)
        [] (15) Entrance door on living exterior wall (not bedroom)
        [] (16) No bathroom sits between its bedroom and the living room
        [] (17) Garage or balconyopening faces same wall direction as house entrance
        [] (18) House entrance MUST be on free exterior wall of living room (not shared with any other room like balcony, parking etc). 

        Note: coordinates must NOT go outside the plot/footprint boundary.
        Any door that connects to outside -- use "outside" as the to_room value.
"""
            prompt = prompt.format(
                spec_json=json.dumps(state.get("spec", {})),
                user_message=state.get("user_message", ""),
                previous_spec_json=json.dumps(state.get("previous_spec", {})),
                previous_layout_json=json.dumps(state.get("layout", {})),
                previous_user_message=state.get("user_prompts", []),
            )
            prompt += plot_constraint + regen_hint

        _t = time.time()
        layout = self._invoke_cached(
            prompt, self.layout_parser, name="Polygon Agent", use_schema=True, use_json_mode=True,
            cache=self._cache_manager_flash, llm=self.polygon_model, thinking_budget=8000,
        )
        self._node_timings.setdefault("polygon_llm_s_list", []).append(round(time.time() - _t, 1))
        self._node_timings["polygon_node_calls"] = self._node_timings.get("polygon_node_calls", 0) + 1

        if not hasattr(self, "_current_thoughts"): self._current_thoughts = []
        self._current_thoughts.append(f"Synthesized 2D layout polygons (Attempt {state.get('fix_iteration', 0) + 1})")

        # Hard-enforce exact_width / exact_height from spec
        layout = self._enforce_exact_dimensions(layout, state.get("spec", {}))
        print("Layout Generated:", layout)

        if self.assemble_intermediate:
            csv_file = os.path.join("data", "samples", "data.csv")
            asset_directory = os.path.join("data", "asset")

            generated_dir = os.path.join(
                os.path.dirname(__file__), "..", "..", "..", "data", "generated"
            )
            os.makedirs(generated_dir, exist_ok=True)
            assembler = FloorPlanAssembler(csv_file, asset_directory)
            doc_path = os.path.join(generated_dir, f"{self.current_config['thread_id']}_{len(state.get('user_prompts', []))}.dxf")
            structure_json = json.dumps({"layout": layout.model_dump(), "total_area": state["spec"]["total_area"], "doors": state["spec"].get("doors", []), "windows": state["spec"].get("windows", []), "direction": state["spec"].get("direction", [])})
            print(structure_json)
            _t = time.time()
            assembler.assemble_and_export(structure_json, doc_path)
            self._node_timings.setdefault("polygon_assemble_s_list", []).append(round(time.time() - _t, 1))
            self._node_timings.setdefault("dxfs_generated", []).append(os.path.basename(doc_path))
            print("Exporting to DXF at:", doc_path)
        return {
            "layout": layout.model_dump(),
            "fix_iteration": state.get("fix_iteration", 0) + 1,
        }
    
    # Helper method to get edges of a polygon (used in validation)
    def _edges(self, poly):
            return [(poly[i], poly[(i + 1) % len(poly)]) for i in range(len(poly))]
    
    def validate_node(self, state: FloorPlanState) -> dict:
        print(
            "=========================== in validate node ==========================="
        )
        _t = time.time()
        import copy
        layout_copy = copy.deepcopy(state.get("layout", {}))
        doors_copy = copy.deepcopy(state.get("spec", {}).get("doors", []))
        windows_copy = copy.deepcopy(state.get("spec", {}).get("windows", []))
        validator = PolygonValidator(
        structure={
            "layout": layout_copy,
            "total_area": state.get("spec", {}).get("total_area"),
            "doors": doors_copy,
            "windows": windows_copy,
        }
    )

        report = validator.validate()

        layout = layout_copy
        rooms = layout.get("rooms", [])
        user_message = state.get("user_message", "")

        # -------------------------
        # STRUCTURAL RULE 1:
        # Living must have at least one exterior wall
        # -------------------------
        living = None
        for r in rooms:
            # find the living room
            if r["type"].lower() == "living":
                living = r
                break

        if living:
                living_poly = living["polygon"]
                living_edges = self._edges(living_poly)
                # check if all living room edges are shared with other rooms (no exterior wall)
                shared_edges = set()

                for i, (a1, a2) in enumerate(living_edges):
                    for other in rooms:
                        if other == living:
                            continue
                        if other["type"].lower() in ("balcony", "utility"):
                            continue

                        for b1, b2 in self._edges(other["polygon"]):

                            # vertical edge
                            if abs(a1[0] - a2[0]) < 1e-6 and abs(b1[0] - b2[0]) < 1e-6:
                                if abs(a1[0] - b1[0]) < 1e-6:
                                    y_overlap = min(max(a1[1], a2[1]), max(b1[1], b2[1])) - \
                                                max(min(a1[1], a2[1]), min(b1[1], b2[1]))
                                    if y_overlap > 1e-6:
                                        shared_edges.add(i)

                            # horizontal edge
                            if abs(a1[1] - a2[1]) < 1e-6 and abs(b1[1] - b2[1]) < 1e-6:
                                if abs(a1[1] - b1[1]) < 1e-6:
                                    x_overlap = min(max(a1[0], a2[0]), max(b1[0], b2[0])) - \
                                                max(min(a1[0], a2[0]), min(b1[0], b2[0]))
                                    if x_overlap > 1e-6:
                                        shared_edges.add(i)

                if len(shared_edges) == len(living_edges):
                    report["valid"] = False
                    report.setdefault("structural_errors", []).append(
                        "Living room must have at least one exterior wall."
                    )

        # -------------------------
        # STRUCTURAL RULE 2:
        # Prevent strip-like layouts
        # -------------------------
        if rooms:
            all_pts = []
            for r in rooms:
                all_pts.extend(r["polygon"])

            xs = [p[0] for p in all_pts]
            ys = [p[1] for p in all_pts]

            width = max(xs) - min(xs)
            height = max(ys) - min(ys)

            if min(width, height) > 0:
                ratio = max(width, height) / min(width, height)

                if ratio > 2.5:
                    report["valid"] = False
                    report.setdefault("structural_errors", []).append(
                        "Layout too elongated. Avoid strip-like houses."
                    )

        # -------------------------
        # STRUCTURAL RULE 3:
        # No corridor or parking unless requested
        # -------------------------
        extra_rooms = ["corridor", "parking", "dining","utility", "storage", 
                       "pantry", "study", "gym", "walk in closet", "home theater",
                       "library", "servant room", "prayer room", "hallway", "foyer"]
        for room in extra_rooms:
            if room not in user_message.lower():
                for r in rooms:
                    if r["type"].lower() == room:
                        report["valid"] = False
                        report.setdefault("structural_errors", []).append(
                            f"{room.capitalize()} not allowed unless explicitly requested. "
                            "Enlarge the living room and reposition bedrooms to share walls with it directly."
                        )
                        break

        # -------------------------
        # STRUCTURAL RULE 4:
        # Every bathroom must share a wall with at least one bedroom
        # -------------------------
        bathroom_rooms = [r for r in rooms if r.get("type", "").lower() == "bathroom"]
        bedroom_rooms  = [r for r in rooms if r.get("type", "").lower() == "bedroom"]

        if bathroom_rooms and bedroom_rooms:
            for bath in bathroom_rooms:
                bath_poly = Polygon(bath["polygon"])
                shares_wall = False
                for bed in bedroom_rooms:
                    bed_poly = Polygon(bed["polygon"])
                    shared = bath_poly.boundary.intersection(bed_poly.boundary)
                    if shared.length > 0.1:
                        shares_wall = True
                        break
                if not shares_wall:
                    report["valid"] = False
                    report.setdefault("structural_errors", []).append(
                        f"Bathroom '{bath['id']}' does not share a wall with any bedroom. "
                        "Move this bathroom so it is physically adjacent to a bedroom — "
                        "it must share a wall edge (not just a corner) with at least one bedroom."
                    )

        # -------------------------
        # STRUCTURAL RULE 5:
        # Living room must be large enough to act as circulation hub
        # -------------------------
        total_area = state.get("spec", {}).get("total_area", 0)
        living_rooms = [r for r in rooms if r.get("type", "").lower() == "living"]

        if living_rooms and total_area > 0:
            living_area = sum(Polygon(r["polygon"]).area for r in living_rooms)
            min_living_pct = 0.18
            min_living_abs = 20.0 if total_area >= 100 else 15.0

            required = max(total_area * min_living_pct, min_living_abs)
            if living_area < required:
                report["valid"] = False
                report.setdefault("structural_errors", []).append(
                    f"Living room area ({living_area:.1f}m²) is too small. "
                    f"It must be at least {required:.1f}m² ({min_living_pct*100:.0f}% of "
                    f"{total_area}m² total area) to serve as the primary circulation hub "
                    "without needing a corridor. Enlarge it — merge dining area if needed, "
                    "or give it an irregular (L-shaped) polygon to reach more rooms."
                )

            # Check living room shares wall with at least 2 bedrooms
            if bedroom_rooms:
                living_wall_count = 0
                for bed in bedroom_rooms:
                    bed_poly = Polygon(bed["polygon"])
                    for liv in living_rooms:
                        liv_poly = Polygon(liv["polygon"])
                        shared = liv_poly.boundary.intersection(bed_poly.boundary)
                        if shared.length > 0.1:
                            living_wall_count += 1
                            break

                required_walls = min(2, len(bedroom_rooms))
                if living_wall_count < required_walls:
                    report["valid"] = False
                    report.setdefault("structural_errors", []).append(
                        f"Living room only shares a wall with {living_wall_count} bedroom(s) "
                        f"but must share walls with at least {required_walls}. "
                        "Reposition bedrooms to cluster around the living room so direct "
                        "door access is possible — no corridor should be needed."
                    )

        # -------------------------
        # STRUCTURAL RULE 6:
        # All rooms must be reachable via door-graph BFS
        # -------------------------
        doors = state.get("spec", {}).get("doors", [])
        for r in rooms:
            if r["id"] not in [d["from_room"] for d in doors] and r["id"] not in [d["to_room"] for d in doors]:
                report["valid"] = False
                report.setdefault("structural_errors", []).append(
                    f"Room '{r['id']}' has no doors connecting it to any other room. "
                    "Every room must be reachable from the living room via a path of doors. "
                    "Add doors to connect this room to its neighbors, ensuring it is part of the circulation network."
                )

        entrance = False
        for d in doors:
            if d["to_room"] in ["outside", "exterior", "ext", "external"] and r["id"] == d["from_room"]:
                entrance = True
                break
            if d["from_room"] in ["outside", "exterior", "ext", "external"] and r["id"] == d["to_room"]:
                entrance = True
                break
        
        if not entrance:
            report["valid"] = False
            report.setdefault("structural_errors", []).append(
                "No entrance door connecting to the outside detected. "
                "Add a door with 'to_room' set to 'outside' that connects the living room to the exterior.")
        

        windows = state.get("spec", {}).get("windows", [])
        window_rooms = ["bedroom", "kitchen", "bathroom", "study"]
        for r in rooms:
            if r["id"] not in [w["room_id"] for w in windows] and r["type"].lower() in window_rooms:
                report["valid"] = False
                report.setdefault("structural_errors", []).append( 
                    f"Room '{r['id']}' has no windows for ventilation. "
                    "Add windows to the exterior walls of this room to make it habitable, if possible. " \
                    "If the room cannot have windows (e.g. interior bathroom), reposition the room"
                )

        print("Validation Report:", report)
        state["validation_report"] = report
        elapsed = round(time.time() - _t, 1)
        self._node_timings.setdefault("validate_s_list", []).append(elapsed)
        # Count total errors across all error keys for this iteration
        error_count = sum(
            len(report.get(k, [])) for k in ("overlaps", "doors", "windows",
            "structural_errors", "errors", "room_shapes", "boundary_regularity",
            "room_dimensions", "blocking_issues", "entrance_placement", "living_exterior")
        )
        self._node_timings.setdefault("validate_error_counts", []).append(error_count)

        if not hasattr(self, "_current_thoughts"): self._current_thoughts = []
        if error_count > 0:
            self._current_thoughts.append(f"Validation identified {error_count} spatial issues")
        else:
            self._current_thoughts.append("Layout successfully passed all validation checks")

        return state
    
    def _share_wall_simple(self, poly_a, poly_b, tol=1e-6):
        """
        Simple wall-sharing check for axis-aligned polygons.
        Returns True if they share a wall.
        """

        def edges(poly):
            return [
                (poly[i], poly[(i + 1) % len(poly)])
                for i in range(len(poly))
            ]

        for (a1, a2) in edges(poly_a):
            for (b1, b2) in edges(poly_b):

                # vertical
                if abs(a1[0] - a2[0]) < tol and abs(b1[0] - b2[0]) < tol:
                    if abs(a1[0] - b1[0]) < tol:
                        y_overlap = min(max(a1[1], a2[1]), max(b1[1], b2[1])) - \
                                    max(min(a1[1], a2[1]), min(b1[1], b2[1]))
                        if y_overlap > tol:
                            return True

                # horizontal
                if abs(a1[1] - a2[1]) < tol and abs(b1[1] - b2[1]) < tol:
                    if abs(a1[1] - b1[1]) < tol:
                        x_overlap = min(max(a1[0], a2[0]), max(b1[0], b2[0])) - \
                                    max(min(a1[0], a2[0]), min(b1[0], b2[0]))
                        if x_overlap > tol:
                            return True

        return False



    def critique_node(self, state: FloorPlanState) -> dict:
        time.sleep(0.5)
        print("=========================== in critique agent ==========================="
              )
        prompt = """
You are a geometric error analyst for floor-plan polygons.
Your task is to analyze a validation report and the current layout, then describe
EXACT coordinate-level fixes needed to correct all issues.

Validation report (JSON):
{validation_report}

Current layout (JSON):
{layout_json}

Output format:
{fix}

Constraints:
- Focus ONLY on geometric fixes. Do not change room IDs or add/remove rooms.
- Be as minimal as possible: the smallest changes that make the layout valid.
- Output ONLY the JSON object, no explanation or comments.
- Give precise coordinate adjustments for each room. like what to change and by how much.
like move the room by x units to left or right or up or down.
or resize the room to these dimensions.
"""
        prompt = prompt.format(
            validation_report=json.dumps(state.get("validation_report", {})),
            layout_json=json.dumps(state.get("layout", {})),
            fix=self.critique_parser.get_format_instructions(),
        )
        print(prompt)
        _t = time.time()
        critique_chain = self.model | self.critique_parser
        critique = self._invoke_with_retries(
            critique_chain, prompt, attempts=3, name="Critique Agent"
        )
        self._node_timings.setdefault("critique_s_list", []).append(round(time.time() - _t, 1))
        print("Critique Generated:", critique)
        return {"critique": critique.model_dump()}

    def fix_node(self, state: FloorPlanState) -> dict:
        time.sleep(0.5)
        print("=========================== in fix agent ===========================")

        all_rooms = state.get('layout', {}).get('rooms', [])
        validation_report = state.get('validation_report', {})
        def _extract_issues(items):
            """Accept list of strings or dicts with 'issue' key."""
            out = []
            for i in items:
                if isinstance(i, str):
                    out.append(i)
                elif isinstance(i, dict):
                    out.append(i.get('issue', str(i)))
            return out

        errors = (
            _extract_issues(validation_report.get('structural_errors', []))
            + _extract_issues(validation_report.get('errors', []))
            + _extract_issues(validation_report.get('room_shapes', []))
            + _extract_issues(validation_report.get('boundary_regularity', []))
            + _extract_issues(validation_report.get('room_dimensions', []))
            + _extract_issues(validation_report.get('exact_dimensions', []))
            + _extract_issues(validation_report.get('door_wall_space', []))
            + _extract_issues(validation_report.get('entrance_placement', []))
            + _extract_issues(validation_report.get('living_exterior', []))
            + _extract_issues(validation_report.get('balcony_orientation', []))
        )

        # Extract room IDs explicitly mentioned in error messages
        violating_ids = set()
        for err in errors:
            if isinstance(err, str):
                for match in re.findall(r"'([^']+)'", err):
                    if any(r['id'] == match for r in all_rooms):
                        violating_ids.add(match)

        # If no specific IDs found, default to all living/bathroom rooms
        if not violating_ids:
            violating_ids = {r['id'] for r in all_rooms if r['type'] in ('living', 'bathroom')}

        # Expand to include wall-sharing neighbors of violating rooms
        target_ids = set(violating_ids)
        for r in all_rooms:
            if r['id'] in violating_ids:
                for other in all_rooms:
                    if other['id'] != r['id'] and self._share_wall_simple(r['polygon'], other['polygon']):
                        target_ids.add(other['id'])

        target_rooms = [r for r in all_rooms if r['id'] in target_ids]
        frozen_rooms = [r for r in all_rooms if r['id'] not in target_ids]
        print(f"[Fix] Targeting: {[r['id'] for r in target_rooms]}")
        print(f"[Fix] Frozen:    {[r['id'] for r in frozen_rooms]}")

        has_overlaps = bool(validation_report.get('overlaps'))
        overlap_instruction = ""
        if has_overlaps:
            overlap_pairs = [(o['a_id'], o['b_id']) for o in validation_report.get('overlaps', [])]
            overlap_instruction = f"""
    OVERLAP FIXES REQUIRED for pairs: {overlap_pairs}
    - Rooms must NOT share any floor area. Each pair above must be fixed by resizing/repositioning so they are ADJACENT (share a wall edge) instead of overlapping.
    - To fix an overlap: shrink the larger room to exclude the area occupied by the smaller room, then ensure the smaller room sits flush against the wall of the resized larger room.
    - NEVER move one room on top of another or place a bathroom inside a bedroom's polygon.
    - Room gap must be either zero or must more than 1.5m 
    - Think of it as a tiling puzzle: each room gets its own non-overlapping rectangle.
"""

        intent = state.get("intent", "")
        user_message = state.get("user_message", "")

        # Build exact dims constraint table from spec for fix prompts
        fix_spec = state.get("spec", {})
        fix_exact_rows = []
        for r in fix_spec.get("rooms", []):
            ew = r.get("exact_width")
            eh = r.get("exact_height")
            if ew or eh:
                w_str = f"width={ew}m" if ew else "width=flexible"
                h_str = f"height={eh}m" if eh else "height=flexible"
                fix_exact_rows.append(f"    - {r['id']} ({r.get('type','')}): {w_str}, {h_str}  ← EXACT, non-negotiable")
        fix_exact_dims_block = ""
        if fix_exact_rows:
            fix_exact_dims_block = (
                "\n    EXACT ROOM DIMENSIONS — preserve these in your output (user-specified, non-negotiable):\n"
                + "\n".join(fix_exact_rows) + "\n"
            )

        if intent == "LAYOUT_FIX":
            # User explicitly asked for a layout adjustment — treat user_message as primary instruction
            print(f"[Fix] LAYOUT_FIX mode — applying user instruction: '{user_message[:80]}'")
            prompt = f"""
    You are an expert architectural floor plan modification agent.
    (Architectural guide is provided as context — apply it as your design reference.)

    USER INSTRUCTION (apply this exactly): "{user_message}"

    Current layout (ALL rooms): {json.dumps(all_rooms)}
    Spec: {json.dumps(state.get('spec', {}))}

    Apply the user's requested modification to the layout. Output the COMPLETE updated layout
    with ALL rooms (modified and unmodified). Preserve room IDs exactly.
    {fix_exact_dims_block}
    HARD RULES (must not be violated after modification):
    - No overlaps: room polygons must not share floor area.
    - Rooms tile together — no gaps between adjacent rooms.
    - SHAPE RULE: rectangles only (4 corners) except bedroom/living (up to 6 corners L-shape). No diagonal walls.
    - BUILDING SHAPE: outer boundary max 1 concave corner. No U/C/cross shapes.
    - Bathroom must share ≥0.1m wall with ≥1 bedroom; must NOT share wall with kitchen.
    - Living room must have ≥1.5m of free exterior wall (not shared with any other room) for the house entrance. It may be enclosed on up to 3 sides by other rooms.
    - Entrance door must open into living room or corridor — never a bedroom/bathroom.
    - BALCONY ORIENTATION: Balcony LONG SIDE must be the shared wall with the bedroom. Short side (1.0–1.5m depth) projects outward. Shared wall ≥ 60% of balcony long dimension.
    - Minimum dims — bathroom: short≥1.8m, area≥4m²; bedroom: short≥3m, area≥10m²; kitchen: short≥2.8m, area≥8m²; living: short≥4m, area≥14m²; balcony: short≥1m, area≥3.5m².
    {self.layout_parser.get_format_instructions()}
    Output ONLY the JSON object. No explanation.
    """
        else:
            # Validation-driven fix
            prompt = f"""
    You are an expert architectural floor plan correction agent.
    (Architectural guide is provided as context — apply it as your design reference.)

    Full layout for context (ALL rooms): {json.dumps(all_rooms)}
    Spec: {state.get('spec')}
    Issues detected: {json.dumps(errors)}
    {overlap_instruction}
    FROZEN rooms — do NOT move or resize these: {json.dumps([r['id'] for r in frozen_rooms])}
    TARGET rooms — output corrected polygons ONLY for these: {json.dumps(target_rooms)}

    {fix_exact_dims_block}
    Correct the TARGET rooms so the layout passes ALL of these validator checks:
    - No overlaps: room polygons must not share floor area (intersection area must be < 1e-6 m²).
    - Rooms tile together — shrink a room to make space; never nest or stack them.
    - Wall-sharing: rooms that must be adjacent must share a boundary of at least 0.1m.
    - Bathroom must share ≥0.1m boundary with ≥1 bedroom; must NOT share ≥0.1m with any kitchen.
    - Living room must share ≥0.1m boundary with ≥2 bedrooms AND have ≥1.5m of free exterior wall (not shared with any room) for the house entrance. It may be enclosed on up to 3 sides.
    - All rooms connected via shared walls (boundary overlap ≥0.05m) — no floating rooms.
    - SHAPE RULE: rectangles only (4 corners) except bedroom/living which may be L-shaped (6 corners). No diagonal walls.
    - BUILDING SHAPE RULE: the combined outer boundary must have AT MOST 1 concave corner. L-shape (1 concave corner) is OK; U-shape or C-shape is NOT. If the issue lists rooms forming a concave pocket, move those rooms flush against the main mass so the pocket is closed.
    - BALCONY ORIENTATION: Balcony LONG SIDE must be the shared wall with the bedroom. Short side (1.0–1.5m depth) projects outward. Shared wall ≥ 60% of balcony long dimension.
    - DOOR WALL MINIMUM: For every door connecting two rooms, those rooms must share ≥ 1.0m of continuous wall. If fixing a room creates a shared wall < 1.0m with a door-connected room, widen the overlap.
    - TILING WITH FROZEN ROOMS: Your output rooms must tile perfectly against the frozen rooms. The edge of each target room that touches a frozen room must use EXACTLY the same coordinates as that frozen room's edge. No gaps allowed between target and frozen rooms.
    - Minimum dimensions per type — bathroom: short≥1.8m, area≥4m², ratio≤1.6; bedroom: short≥3m, area≥10m², ratio≤1.5; kitchen: short≥2.8m, area≥8m², ratio≤1.8; living: short≥4m, area≥14m², ratio≤1.8; balcony: short≥1m, area≥3.5m².
    - Output a LayoutSchema containing ONLY the target rooms.
    {self.layout_parser.get_format_instructions()}
    DO NOT explain. Output ONLY the JSON object.
    """
        print(prompt)
        _t = time.time()
        fixed = self._invoke_cached(prompt, self.layout_parser, name="fix", use_schema=True, use_json_mode=True, cache=self._cache_manager_pro, llm=self.fix_model, thinking_budget=1500)
        fix_llm_s = round(time.time() - _t, 1)
        self._node_timings.setdefault("fix_llm_s_list", []).append(fix_llm_s)
        self._record_ai_node_metric("fix", fix_llm_s, "fix")

        if not hasattr(self, "_current_thoughts"): self._current_thoughts = []
        self._current_thoughts.append("Resolved layout violations")

        # Hard-enforce exact_width/exact_height after fix output
        fixed = self._enforce_exact_dimensions(fixed, fix_spec)
        fixed_map = {r['id']: r for r in fixed.model_dump().get('rooms', [])}

        if intent == "LAYOUT_FIX":
            # LAYOUT_FIX: model outputs all rooms — use them directly, fallback to original if missing
            merged_rooms = [fixed_map.get(r['id'], r) for r in all_rooms]
        else:
            # Validation fix: model outputs only target rooms — merge with frozen originals
            merged_rooms = [fixed_map.get(r['id'], r) for r in all_rooms]
        new_layout = {'rooms': merged_rooms}
        print("Layout Fixed:", new_layout)

        if self.assemble_intermediate:
            csv_file = os.path.join("data", "samples", "data.csv")
            asset_directory = os.path.join("data", "asset")

            generated_dir = os.path.join(
                os.path.dirname(__file__), "..", "..", "..", "data", "generated"
            )
            os.makedirs(generated_dir, exist_ok=True)
            assembler = FloorPlanAssembler(csv_file, asset_directory)
            thread_id = (self.current_config or {}).get("thread_id", "unknown")
            idx = len(state.get("user_prompts", []))
            doc_path = os.path.join(generated_dir, f'{thread_id}_{idx}.dxf')
            structure_json = json.dumps({"layout": new_layout, "total_area": state["spec"]["total_area"], "doors": state["spec"].get("doors", []), "windows": state["spec"].get("windows", []), "direction": state["spec"].get("direction", [])})
            _t = time.time()
            assembler.assemble_and_export(structure_json, doc_path)
            fix_asm_s = round(time.time() - _t, 1)
            self._node_timings.setdefault("fix_assemble_s_list", []).append(fix_asm_s)
            self._node_timings.setdefault("dxfs_generated", []).append(os.path.basename(doc_path))
            fix_llm_list = self._node_timings.get("fix_llm_s_list", [])
            self._node_timings.setdefault("iterations_detail", []).append({
                "fix_llm_s": fix_llm_list[-1] if fix_llm_list else 0,
                "fix_assemble_s": fix_asm_s,
                "polytest_dxf": os.path.basename(doc_path),
            })
        result = {
            "layout": new_layout,
            "fix_iteration": state.get("fix_iteration", 0) + 1,
        }
        # After the first LAYOUT_FIX pass, clear intent so subsequent fix loops
        # (triggered by validate finding issues) use the validation-driven prompt
        # instead of blindly re-applying the user instruction.
        if intent == "LAYOUT_FIX":
            result["intent"] = ""
        return result

    def user_modification_node(self, state: FloorPlanState) -> dict:
        """
        Uses interrupt() to halt and wait for external resume input.
        On resume, interrupt() returns the resume payload (the user modification string).
        """
        user_input = interrupt(
            "Enter your modifications to the layout (or press Enter to skip): "
        )
        print("user input received:", user_input)
        if not user_input:
            return {}
        return {
            "user_message": user_input,
            "fix_iteration": 0,
            "user_prompts": state.get("user_prompts", []) + [user_input],
            "is_first": False,
        }

    MAX_FIX_ITERATIONS = 3

    def validate_decision(self, state: FloorPlanState) -> str:
        fix_iter = state.get("fix_iteration", 0)
        report = state.get("validation_report")

        if not report:
            return "CRITIQUE"

        if bool(report.get("valid")):
            return "SUCCESS"

        if fix_iter >= self.MAX_FIX_ITERATIONS:
            print(f"[validate_decision] Hit iteration cap ({self.MAX_FIX_ITERATIONS}), forcing SUCCESS.")
            return "SUCCESS"

        return "CRITIQUE"

    # --- Runtime methods ---
    def start(
        self,
        initial_user_message: str,
        thread_id: str = "invoke_floorplan",
        chat_session_id: Optional[int] = None,
    ) -> dict:
        initial_state = FloorPlanState(
            user_message=initial_user_message,
            previous_spec={},
            spec={},
            layout={},
            violations=[],
            critique="",
            fix_iteration=0,
            validation_report={},
            user_prompts=[],
            is_first=True,
            intent="NEW_CREATION",
            unsupported_requests=[],
        )
        config = {"thread_id": thread_id, "chat_session_id": chat_session_id}
        self.current_config = config
        self._node_timings = {}
        self._current_thoughts = []
        result = self.graph.invoke(initial_state, config)
        self._last_config = config
        return {"config": config, "result": result}

    def continue_with_modification(self, modification: str, thread_id: Optional[str] = None):
        config = self._last_config
        if not config:
            if thread_id:
                config = {"configurable": {"thread_id": thread_id}}
            else:
                raise RuntimeError("Flow was not started AND no thread_id provided; call start() first or provide thread_id.")
        
        self._node_timings = {}
        self._current_thoughts = []
        return self.graph.invoke(Command(resume=modification), config)

    def get_node_timings(self) -> dict:
        return self._node_timings

    def print_token_summary(self):
        token_log = self._node_timings.get("tokens", [])
        if not token_log:
            print("[TokenSummary] No token data (cache unavailable — fallback used)")
            return
        total_prompt = sum(t["prompt"] for t in token_log)
        total_cached = sum(t["cached"] for t in token_log)
        total_output = sum(t["output"] for t in token_log)
        total_total  = sum(t["total"]  for t in token_log)
        print("\n" + "="*60)
        print("TOKEN SUMMARY")
        print("="*60)
        print(f"{'Node':<25} {'Prompt':>8} {'Cached':>8} {'Output':>8} {'Total':>8}")
        print("-"*60)
        for t in token_log:
            print(f"  {t['node']:<23} {t['prompt']:>8} {t['cached']:>8} {t['output']:>8} {t['total']:>8}")
        print("-"*60)
        print(f"  {'TOTAL':<23} {total_prompt:>8} {total_cached:>8} {total_output:>8} {total_total:>8}")
        new_tokens = total_prompt - total_cached
        thinking_tokens = sum(max(0, t["total"] - t["prompt"] - t["output"]) for t in token_log)
        print(f"  New (non-cached) input:  {new_tokens}")
        print(f"  Cached input:            {total_cached}  (billed at ~25%)")
        if thinking_tokens > 0:
            print(f"  Thinking tokens:         {thinking_tokens}  (internal reasoning)")
        print("="*60 + "\n")

    def get_saved_state(self):
        if not self._last_config:
            return None
        return self.graph.get_state(self._last_config).values


# convenience agent
if __name__ == "__main__":
    agent = FloorPlanAgent()