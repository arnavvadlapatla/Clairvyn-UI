import os
from typing import Optional, Any
import csv
import json
import time
import datetime as _dt
import uuid

# Unique ID generated fresh every server start — client uses this to detect restarts
SERVER_INSTANCE_ID = str(uuid.uuid4())
from datetime import datetime
from flask import Flask, Blueprint, render_template, jsonify, request, send_file, current_app, g, session, make_response
import ezdxf
from src.app.ai.asset_edit_agent import AssetEditAgent
from src.app.core.assemble import FloorPlanAssembler
from src.app.core.dxf_editor import list_assets as dxf_list_assets
import src.app.core.layer2_pipeline as layer2_pipeline
from auth import firebase_required
from sqlalchemy.exc import IntegrityError
from src.app.extensions import db
from src.app.models import ChatSession, Message, FloorPlan, PromptMetric, UserProfile, Attachment, ChatFeedback, WaitlistEntry, Task
from langgraph.types import Command
from pathlib import Path
from src.app.s3_utils import upload_generated_png, upload_generated_dxf, delete_generated_files, is_s3_configured
from src.app.tasks import generate_floorplan_task
from src.app.async_manager import async_manager

# ---- PROJECT ROOT ----
PROJECT_ROOT = Path(__file__).resolve().parents[3]
base_dir = PROJECT_ROOT
# (adjust to parents[2] if needed — see note below)

DATA_DIR = PROJECT_ROOT / "data"
GENERATED_DIR = DATA_DIR / "generated"
SAMPLES_DIR = DATA_DIR / "samples"
ASSET_DIR = DATA_DIR / "asset"

# Ensure generated folder exists
GENERATED_DIR.mkdir(parents=True, exist_ok=True)

FREE_GENERATION_LIMIT = 3
FOUNDER_EMAILS = {"ronakmm2005@gmail.com", "yaswantmodi@gmail.com"}


def _get_user_generation_count(user_id: int) -> int:
    """Count floor plan generations by counting assistant messages with a document_id."""
    count = db.session.execute(
        db.text(
            "SELECT COUNT(*) FROM messages m "
            "JOIN chat_sessions cs ON cs.id = m.chat_id "
            "WHERE cs.user_id = :uid AND m.sender_type = 'assistant' "
            "AND m.extra_data IS NOT NULL AND m.extra_data::text LIKE :pat"
        ),
        {"uid": user_id, "pat": '%"document_id"%'},
    ).scalar()
    return count or 0


def _user_can_generate(user_obj) -> bool:
    if getattr(user_obj, "has_paid", False):
        return True
    email = (getattr(user_obj, "email", "") or "").lower()
    if email in FOUNDER_EMAILS:
        return True
    return _get_user_generation_count(user_obj.id) < FREE_GENERATION_LIMIT

LATENCY_LOG = GENERATED_DIR / "latency_log.csv"
LATENCY_HEADERS = [
    "timestamp", "session_id", "turn", "prompt_type",
    "spec_s",
    "polygon_node_calls", "polygon_llm_s_total", "polygon_llm_s_per_iter",
    "polygon_assemble_s_total", "polygon_assemble_s_per_iter",
    "validate_s_total", "validate_s_per_iter",
    "validate_outcomes", "validate_error_counts",
    "fix_llm_s_total", "fix_llm_s_per_iter",
    "fix_assemble_s_total", "fix_assemble_s_per_iter",
    "fix_iterations",
    "iterations_detail",
    "total_graph_s", "layer2_s", "total_request_s",
    "dxfs_generated",
]

def _write_latency_log(row: dict):
    write_header = not LATENCY_LOG.exists()
    with open(LATENCY_LOG, "a", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=LATENCY_HEADERS, extrasaction="ignore")
        if write_header:
            writer.writeheader()
        writer.writerow(row)


def _safe_usage_metrics(model_obj, usage_key: str):
    if not model_obj or not hasattr(model_obj, "get_last_usage"):
        return {"tokens_input": None, "tokens_output": None, "retry_count": 0}
    try:
        usage = model_obj.get_last_usage(usage_key) or {}
        return {
            "tokens_input": usage.get("tokens_input"),
            "tokens_output": usage.get("tokens_output"),
            "retry_count": usage.get("retry_count", 0),
        }
    except Exception:
        return {"tokens_input": None, "tokens_output": None, "retry_count": 0}


def _coerce_to_dict(value):
    if isinstance(value, dict):
        return value
    if hasattr(value, "model_dump"):
        try:
            return value.model_dump()
        except Exception:
            return {}
    if hasattr(value, "dict"):
        try:
            return value.dict()
        except Exception:
            return {}
    return {}


def _coerce_rooms(layout_value):
    layout = _coerce_to_dict(layout_value)
    rooms = layout.get("rooms", [])
    if isinstance(rooms, list):
        normalized = []
        for room in rooms:
            if isinstance(room, dict):
                normalized.append(room)
            elif hasattr(room, "model_dump"):
                try:
                    normalized.append(room.model_dump())
                except Exception:
                    pass
            elif hasattr(room, "dict"):
                try:
                    normalized.append(room.dict())
                except Exception:
                    pass
        return normalized
    return []


def _metric_success_from_state(state) -> bool:
    state_dict = _coerce_to_dict(state)
    if not state_dict:
        return False
    validation_report = _coerce_to_dict(state_dict.get("validation_report"))
    if validation_report:
        return bool(validation_report.get("valid"))
    return bool(_coerce_rooms(state_dict.get("layout")))


def _has_floor_plan_payload(state) -> bool:
    state_dict = _coerce_to_dict(state)
    if not state_dict:
        return False
    if _coerce_rooms(state_dict.get("layout")):
        return True
    spec = _coerce_to_dict(state_dict.get("spec"))
    if spec:
        return True
    validation_report = _coerce_to_dict(state_dict.get("validation_report"))
    return bool(validation_report)


def _insert_prompt_metric(
    *,
    message_id,
    user_id,
    chat_session_id,
    prompt_type: str,
    tokens_input,
    tokens_output,
    latency_ms: Optional[int],
    success: bool,
):
    try:
        db.session.add(
            PromptMetric(
                message_id=message_id,
                user_id=user_id,
                chat_session_id=chat_session_id,
                prompt_type=prompt_type,
                tokens_input=tokens_input,
                tokens_output=tokens_output,
                latency_ms=latency_ms,
                success=success,
            )
        )
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        print(f"[PromptMetric] Failed to persist prompt metric: {e}")


def _insert_floor_plan_metric(
    *,
    chat_session_id,
    user_id,
    state,
    node_timings,
):
    try:
        state_dict = _coerce_to_dict(state)
        layout = _coerce_to_dict(state_dict.get("layout"))
        rooms = _coerce_rooms(layout)
        room_types = sorted(
            {r.get("type") for r in rooms if isinstance(r, dict) and r.get("type")}
        )
        validation_report = _coerce_to_dict(state_dict.get("validation_report"))
        validation_passed = (
            bool(validation_report.get("valid")) if validation_report else None
        )
        fix_iterations = len((node_timings or {}).get("fix_llm_s_list", []) or [])
        spec = _coerce_to_dict(state_dict.get("spec"))

        db.session.add(
            FloorPlan(
                chat_session_id=chat_session_id,
                user_id=user_id,
                total_area_sqm=spec.get("total_area"),
                room_count=len(rooms),
                room_types=room_types,
                assets_used=[],
                validation_passed=validation_passed,
                fix_iterations=fix_iterations,
            )
        )
        db.session.commit()
        return True
    except Exception as e:
        db.session.rollback()
        print(f"[FloorPlan] Failed to persist floor plan metric: {e}")
        return False


def _insert_message_attachments(message_id, attachments):
    if not message_id or not isinstance(attachments, list) or not attachments:
        return
    try:
        for item in attachments:
            if not isinstance(item, dict):
                continue
            url = item.get("url")
            if not url:
                continue
            db.session.add(
                Attachment(
                    message_id=message_id,
                    url=str(url),
                    type=item.get("type"),
                    attachment_metadata=item.get("metadata"),
                )
            )
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        print(f"[Attachment] Failed to persist message attachments: {e}")


main_bp = Blueprint('main', __name__)


csv_file = str(SAMPLES_DIR / "data.csv")
asset_directory = str(ASSET_DIR)

assembler = FloorPlanAssembler(csv_file, asset_directory)


@main_bp.route("/")
def index():
    return render_template('index.html')


def _get_prompt_from_request():
    """Accept prompt from either JSON body (Next/other frontends) or form (Flask template)."""
    if request.is_json:
        data = request.get_json(silent=True) or {}
        return data.get("prompt") or data.get("content") or ""
    return request.form.get("prompt", "")


@main_bp.route('/chat', methods=['POST'])
def chat():
    prompt = _get_prompt_from_request()
    if not (prompt and prompt.strip()):
        return jsonify({"error": "prompt is required"}), 400
    prompt = prompt.strip()
    print(f"Received prompt: {prompt}")

    # Handle old sessions that have chat_id but no flow_started flag
    if "chat_id" in session and "flow_started" not in session:
        session.clear()

    # --- Asset Edit Detection ---
    # If a floor plan already exists, check if this is an asset-edit prompt
    if session.get("flow_started") and session.get("last_document_id"):
        intent_class = current_app.model.classify_prompt_intent(prompt)
        is_asset_edit = (intent_class == "ASSET_EDIT")

        if is_asset_edit:
            document_id = session["last_document_id"]
            dxf_base = os.path.abspath(
                os.path.join(os.path.dirname(__file__), "..", "..", "..")
            )
            dxf_path = os.path.join(dxf_base, "data", "generated", f"{document_id}.dxf")

            if os.path.exists(dxf_path):
                try:
                    agent = _get_asset_edit_agent()
                    result = agent.execute(dxf_path, prompt)

                    if result.get("success"):
                        _ensure_png_fresh(dxf_path)

                        op = result.get("operation", {})
                        action = op.get("action", "modify")
                        asset_name = op.get("asset_name", "asset")

                        if action == "move":
                            dx = op.get("dx") or 0.0
                            dy = op.get("dy") or 0.0

                            dirs = []

                            if dx > 0:
                                dirs.append(f"{dx}m to the right")
                            elif dx < 0:
                                dirs.append(f"{abs(dx)}m to the left")

                            if dy > 0:
                                dirs.append(f"{dy}m up")
                            elif dy < 0:
                                dirs.append(f"{abs(dy)}m down")

                            direction = " and ".join(dirs) if dirs else "in place"
                            response_text = f"Moved the {asset_name} {direction}."

                        elif action in ("remove", "delete"):
                            response_text = (
                                f"Removed the {asset_name} from the floor plan."
                            )

                        elif action == "rotate":
                            angle = op.get("angle", 0)
                            response_text = f"Rotated the {asset_name} by {angle}°."

                        elif action == "add":
                            room_id = op.get("room_id", "")
                            response_text = f"Added a {asset_name} to room {room_id}."

                        else:
                            response_text = f"Modified the {asset_name}."

                        if result.get("collision"):
                            issues = result.get("issues", [])
                            if action == "add":
                                response_text = f"Added the {asset_name}, but it collides with existing furniture."
                            if issues:
                                response_text = ""
                                response_text += "\n" + "\n".join(issues)

                            response_text = f"Problem with {asset_name} detected! {response_text}"

                        return jsonify(
                            {
                                "response": response_text,
                                "document_id": document_id,
                                "success": True,
                                "assets": result.get("assets", []),
                                "thoughts": [f"Identified intent: {action} {asset_name}", "Calculated layout constraints", "Updated floor plan model"]
                            }
                        )

                    else:
                        return jsonify(
                            {
                                "response": result.get(
                                    "error", "Could not modify asset."
                                ),
                                "document_id": document_id,
                                "success": False,
                            }
                        )

                except Exception:
                    import traceback

                    traceback.print_exc()
                    return jsonify(
                        {
                            "response": "Asset edit failed.",
                            "document_id": document_id,
                            "success": False,
                        }
                    )
    # --- Normal Floor Plan Generation (Asynchronous) ---
    _t_request = time.time()
    ai_call_start = time.time()

    if not session.get("flow_started", False):
        session["chat_id"] = str(uuid.uuid4())[:8]
        session["flow_started"] = True
        start_res = current_app.model.start(prompt, thread_id=session["chat_id"])
        result = start_res["result"]
        prompt_type = "initial_form"
    else:
        try:
            result = current_app.model.continue_with_modification(prompt)
            prompt_type = "chat_modification"
        except RuntimeError:
            session.clear()
            session["chat_id"] = str(uuid.uuid4())[:8]
            start_res = current_app.model.start(prompt, thread_id=session["chat_id"])
            result = start_res["result"]
            session["flow_started"] = True
            prompt_type = "initial_form"
    image_path = (
        GENERATED_DIR / f"{session['chat_id']}_{len(result['user_prompts'])}.png"
    )
    dxf_path = image_path.with_suffix(".dxf")

    _t_asm = time.time()
    structure_json_str = json.dumps({
        "layout": result["layout"],
        "total_area": result["spec"]["total_area"],
        "doors": result["spec"].get("doors", []),
        "windows": result["spec"].get("windows", []),
        "direction": result["spec"].get("direction", []),
    })
    assembler.assemble_and_export(structure_json_str, str(dxf_path))
    current_app.model._node_timings.setdefault("polygon_assemble_s_list", []).append(round(time.time() - _t_asm, 1))

    # place furniture/assets
    _t_layer2 = time.time()
    layer2_pipeline.run_layer2_on_dxf(
        str(dxf_path), str(dxf_path)
    )
    layer2_s = round(time.time() - _t_layer2, 1)
    # FORCE SAVE AFTER ASSET INSERTION
    doc = ezdxf.readfile(dxf_path)
    doc.save()
    print(image_path)
    spec = result.get("spec", {})
    area = spec.get("total_area", "unknown")
    rooms = result.get("layout", {}).get("rooms", [])
    counts = {}
    for r in rooms:
        t = r.get("type", "other")
        counts[t] = counts.get(t, 0) + 1
    order = ["bedroom", "bathroom", "living", "kitchen", "balcony", "corridor", "utility", "other"]
    labels = {"bedroom": "bedroom", "bathroom": "bathroom", "living": "living room",
              "kitchen": "kitchen", "balcony": "balcony", "corridor": "corridor",
              "utility": "utility room", "other": "other room"}
    parts = []
    for t in order:
        if t in counts:
            n = counts[t]
            parts.append(f"{n} {labels[t]}{'s' if n > 1 else ''}")
    room_summary = ", ".join(parts) if parts else "rooms"
    response_text = f"House with {room_summary} covering {area} sq meters."

    unsupported = result.get("unsupported_requests", [])
    if unsupported:
        label = ", ".join(unsupported)
        response_text += (
            f"\n\nNote: We don't currently support {label} in floor plans, so "
            f"{'it was' if len(unsupported) == 1 else 'they were'} excluded. "
            "The rest of your floor plan has been generated as requested."
        )

    document_id = f"{session['chat_id']}_{len(result['user_prompts'])}"
    session["last_document_id"] = document_id
    session["flow_started"] = True

    # --- Latency logging ---
    nt             = current_app.model._node_timings
    polygon_llm_list  = nt.get("polygon_llm_s_list", [])
    polygon_asm_list  = nt.get("polygon_assemble_s_list", [])
    validate_list  = nt.get("validate_s_list", [])
    fix_llm_list   = nt.get("fix_llm_s_list", [])
    fix_asm_list   = nt.get("fix_assemble_s_list", [])
    outcomes       = nt.get("validate_outcomes", [])
    err_counts     = nt.get("validate_error_counts", [])
    total_request_s = round(time.time() - _t_request, 1)
    _write_latency_log({
        "timestamp":                  datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "session_id":                 session.get("chat_id", ""),
        "turn":                       len(result.get("user_prompts", [])),
        "prompt_type":                prompt_type,
        "spec_s":                     nt.get("spec_s", ""),
        "polygon_node_calls":         nt.get("polygon_node_calls", 1),
        "polygon_llm_s_total":        round(sum(polygon_llm_list), 1) if polygon_llm_list else "",
        "polygon_llm_s_per_iter":     "|".join(str(v) for v in polygon_llm_list),
        "polygon_assemble_s_total":   round(sum(polygon_asm_list), 1) if polygon_asm_list else "",
        "polygon_assemble_s_per_iter":"|".join(str(v) for v in polygon_asm_list),
        "validate_s_total":           round(sum(validate_list), 1) if validate_list else "",
        "validate_s_per_iter":        "|".join(str(v) for v in validate_list),
        "validate_outcomes":          "|".join(outcomes),
        "validate_error_counts":      "|".join(str(e) for e in err_counts),
        "fix_llm_s_total":            round(sum(fix_llm_list), 1) if fix_llm_list else "",
        "fix_llm_s_per_iter":         "|".join(str(v) for v in fix_llm_list),
        "fix_assemble_s_total":       round(sum(fix_asm_list), 1) if fix_asm_list else "",
        "fix_assemble_s_per_iter":    "|".join(str(v) for v in fix_asm_list),
        "fix_iterations":             len(fix_llm_list),
        "iterations_detail":          json.dumps(nt.get("iterations_detail", [])),
        "total_graph_s":              nt.get("total_graph_s", ""),
        "layer2_s":                   layer2_s,
        "total_request_s":            total_request_s,
        "dxfs_generated":             "|".join(nt.get("dxfs_generated", [])),
    })
    print(
        f"\n[LATENCY] total={total_request_s}s | "
        f"spec={nt.get('spec_s', '?')}s | "
        f"poly_llm={round(sum(polygon_llm_list), 1)}s(x{len(polygon_llm_list)}) | "
        f"poly_asm={round(sum(polygon_asm_list), 1)}s(x{len(polygon_asm_list)}) | "
        f"validate={round(sum(validate_list), 1)}s(x{len(validate_list)}) | "
        f"fix_llm={round(sum(fix_llm_list), 1)}s(x{len(fix_llm_list)}) | "
        f"fix_asm={round(sum(fix_asm_list), 1)}s(x{len(fix_asm_list)}) | "
        f"layer2={layer2_s}s | outcomes={outcomes}"
    )
    current_app.model.print_token_summary()

    usage = _safe_usage_metrics(current_app.model, "spec")
    prompt_success = _metric_success_from_state(result)
    _insert_prompt_metric(
        message_id=None,
        user_id=None,
        chat_session_id=None,
        prompt_type=prompt_type,
        tokens_input=usage["tokens_input"],
        tokens_output=usage["tokens_output"],
        latency_ms=int((time.time() - ai_call_start) * 1000),
        success=prompt_success,
    )
    if _has_floor_plan_payload(result):
        _insert_floor_plan_metric(
            chat_session_id=None,
            user_id=None,
            state=result,
            node_timings=nt,
        )

    return jsonify({"response": response_text, "document_id": document_id})


@main_bp.route("/first_chat", methods=["POST"])
def first_chat():
    """Legacy/alternate frontend: accepts JSON or form, returns JSON with document_id and image_url."""
    if request.is_json:
        form_data = request.get_json(silent=True) or {}
    else:
        form_data = request.form.to_dict()
    print(f"Received form data: {form_data}")
    user_prompt = "create a floor plan with the following specifications:"
    user_prompt += str(form_data)
    thread_id = str(uuid.uuid4())[:8]
    session["chat_id"] = thread_id

    # Best-effort: extract user from auth header if present
    uid = None
    try:
        header = request.headers.get("Authorization", "")
        if header.startswith("Bearer "):
            from firebase_admin import auth as _fb_auth
            from auth import _upsert_user_from_firebase
            decoded = _fb_auth.verify_id_token(header.split(" ", 1)[1].strip())
            user_obj = _upsert_user_from_firebase(decoded)
            uid = user_obj.id
    except Exception:
        pass

    if uid is None:
        return jsonify({"error": "Authentication required"}), 401

    chat = ChatSession(
        user_id=uid,
        title=(str(form_data)[:80]).strip() or "New chat",
        chat_metadata={"thread_id": thread_id, "started": False},
    )
    db.session.add(chat)
    db.session.commit()

    user_msg = Message(
        chat_id=chat.id,
        sender_type="user",
        user_id=uid,
        content=user_prompt,
    )
    db.session.add(user_msg)
    db.session.commit()

    task_id = async_manager.submit_task(
        generate_floorplan_task,
        _db_chat_id=chat.id,
        prompt=user_prompt,
        chat_id=chat.id,
        thread_id=None,
        previous_state=None,
        user_id=uid,
    )

    return jsonify({
        "success": True,
        "task_id": task_id,
        "chat_id": chat.id,
        "message": "First chat generation started in the background."
    })


@main_bp.route('/files/<path:filename>', methods=['GET'])
def serve_generated_file(filename: str):
    """Serve generated PNG/DXF by document_id (e.g. abc12_0.png). Used by Flask template and first_chat response."""
    if not filename.endswith(".png") and not filename.endswith(".dxf"):
        return jsonify({"error": "Unsupported file type"}), 400
    file_path = os.path.join(base_dir, "data", "generated", filename)
    if not os.path.exists(file_path):
        return jsonify({"error": "File not found"}), 404
    mimetype = "image/png" if filename.endswith(".png") else "application/dxf"
    return send_file(file_path, as_attachment=False, mimetype=mimetype)


def log_debug(msg):
    log_path = GENERATED_DIR / "debug.log"
    with open(log_path, "a") as f:
        f.write(f"[{datetime.now()}] {msg}\n")


@main_bp.route("/get_dxf/<document_id>", methods=["GET"])
def get_dxf(document_id):
    """Serve DXF file content for browser visualization."""
    file_path = GENERATED_DIR / f"{document_id}.dxf"

    log_debug(f"get_dxf: {document_id}")
    log_debug(f"Serving path: {file_path}")

    if not file_path.exists():
        log_debug(f"File NOT found: {file_path}")
        return jsonify({"error": f"File not found: {document_id}"}), 404

    log_debug(f"File exists. Size: {os.path.getsize(file_path)}")

    response = make_response(send_file(str(file_path), mimetype="application/dxf"))
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response


@main_bp.route("/get_image/<document_id>", methods=["GET"])
def get_image(document_id):
    """Serve the rendered PNG image for a floorplan document."""
    file_path = GENERATED_DIR / f"{document_id}.png"

    if not os.path.exists(file_path):
        return jsonify({"error": f"Image not found: {document_id}"}), 404

    response = make_response(send_file(file_path, mimetype="image/png"))
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response


@main_bp.route("/download_file", methods=["POST"])
def download_file():
    data = request.get_json(silent=True) or {}
    doc_id = data.get("document_id")
    if not doc_id:
        return jsonify({"error": "document_id is required"}), 400
    file_path = os.path.join(base_dir, "data", "generated", f"{doc_id}.dxf")
    if not os.path.exists(file_path):
        return jsonify({"error": f"File not found for document_id {doc_id}"}), 404
    return send_file(
        file_path,
        as_attachment=True,
        download_name=f"{doc_id}.dxf",
        mimetype="application/dxf",
    )


@main_bp.route("/toggle_assets", methods=["POST"])
def toggle_assets():
    """Toggle visibility of asset groups in the DXF document and return the updated image.

    Expected JSON payload:
    {
        "dxf_path": "path/to/file.dxf",
        "group_names": ["ASSET_bed_123456", "ASSET_sofa_789012"]
    }
    """
    data = request.json
    dxf_path = data.get("dxf_path")
    group_names = data.get("group_names", [])

    if not dxf_path:
        return jsonify({"error": "dxf_path is required"}), 400

    if not os.path.exists(dxf_path):
        return jsonify({"error": f"DXF file not found: {dxf_path}"}), 404

    try:
        # Load the document
        doc = ezdxf.readfile(dxf_path)

        # Create a temporary assembler instance and load the doc
        temp_assembler = FloorPlanAssembler(csv_file, asset_directory)
        temp_assembler.doc = doc

        # Toggle the asset groups
        temp_assembler.toggle_asset_groups(group_names)

        # Save the modified document back
        doc.saveas(dxf_path)

        # Generate the image from the updated DXF
        temp_assembler.export_image(dxf_path, dpi=300)

        # Return the PNG image
        image_path = os.path.splitext(dxf_path)[0] + ".png"
        return send_file(image_path, mimetype="image/png", as_attachment=False)

    except Exception as e:
        return jsonify({"error": f"Failed to toggle assets: {str(e)}"}), 500


# Lazy-init the asset edit agent (shares the same API key as the main model)
_asset_edit_agent = None


def _get_asset_edit_agent():
    global _asset_edit_agent
    if _asset_edit_agent is None:
        _asset_edit_agent = AssetEditAgent()
    return _asset_edit_agent


def _ensure_png_fresh(dxf_path: str):
    """Re-render the PNG from the DXF as a safety net."""
    png_path = os.path.splitext(dxf_path)[0] + ".png"
    dxf_mtime = os.path.getmtime(dxf_path)
    png_mtime = os.path.getmtime(png_path) if os.path.exists(png_path) else 0
    if dxf_mtime > png_mtime:
        # PNG is stale or missing — re-render
        print(f"[routes] PNG stale, re-rendering: {png_path}")
        try:
            temp_assembler = FloorPlanAssembler(csv_file, asset_directory)
            temp_assembler.doc = ezdxf.readfile(dxf_path)
            temp_assembler.export_image(dxf_path, dpi=300)
        except Exception as e:
            print(f"[Warning] _ensure_png_fresh failed: {e}")


def _pick_existing_document_id(thread_id: str, idx: int, node_timings: Optional[dict] = None) -> str:
    """Choose the best document id that actually exists on disk."""
    node_timings = node_timings or {}
    generated_dir = os.path.join(base_dir, "data", "generated")

    candidates = [f"{thread_id}_{idx}"]
    if idx > 0:
        candidates.append(f"{thread_id}_{idx - 1}")

    for name in reversed(node_timings.get("dxfs_generated", []) or []):
        stem, ext = os.path.splitext(str(name))
        if ext.lower() == ".dxf" and stem.startswith(f"{thread_id}_"):
            candidates.insert(0, stem)
            break

    seen = set()
    for candidate in candidates:
        if candidate in seen:
            continue
        seen.add(candidate)
        dxf_path = os.path.join(generated_dir, f"{candidate}.dxf")
        png_path = os.path.join(generated_dir, f"{candidate}.png")
        if os.path.exists(dxf_path) or os.path.exists(png_path):
            return candidate
    return f"{thread_id}_{idx}"


@main_bp.route("/modify_asset", methods=["POST"])
def modify_asset():
    """
    Modify a DXF asset via natural language prompt.

    Expected JSON payload:
    {
        "document_id": "abc123_0",
        "prompt": "move the sofa 2m to the right"
    }

    Returns:
    {
        "success": true/false,
        "response": "human-readable message",
        "document_id": "abc123_0",
        "operation": { ... },
        "assets": [ ... ]
    }
    """
    data = request.json
    if not data:
        return jsonify({"success": False, "error": "JSON body required"}), 400

    document_id = data.get("document_id")
    prompt = data.get("prompt")

    log_debug(f"modify_asset request: {document_id}, prompt: {prompt}")

    if not document_id:
        return jsonify({"success": False, "error": "document_id is required"}), 400
    if not prompt:
        return jsonify({"success": False, "error": "prompt is required"}), 400

    # Resolve DXF path
    base = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
    dxf_path = os.path.join(base, "data", "generated", f"{document_id}.dxf")

    if not os.path.exists(dxf_path):
        return jsonify(
            {"success": False, "error": f"DXF file not found: {document_id}"}
        ), 404

    try:
        agent = _get_asset_edit_agent()
        result = agent.execute(dxf_path, prompt)

        if result.get("success"):
            # Safety-net: re-render PNG in case dxf_editor's _render_png failed
            _ensure_png_fresh(dxf_path)

            op = result.get("operation", {})
            action = op.get("action", "modify")
            asset = op.get("asset_name", "asset")

            if action == "move":
                dx = op.get("dx", 0)
                dy = op.get("dy", 0)
                dirs = []
                if dx > 0:
                    dirs.append(f"{dx}m to the right")
                elif dx < 0:
                    dirs.append(f"{abs(dx)}m to the left")
                if dy > 0:
                    dirs.append(f"{dy}m up")
                elif dy < 0:
                    dirs.append(f"{abs(dy)}m down")
                direction = " and ".join(dirs) if dirs else "in place"
                response_text = f"Moved the {asset} {direction}."
            elif action == "remove":
                response_text = f"Removed the {asset} from the floor plan."
            elif action == "rotate":
                angle = op.get("angle", 0)
                response_text = f"Rotated the {asset} by {angle}°."
            else:
                response_text = f"Modified the {asset}."

            issues = result.get("issues", [])
            if issues:
                response_text += "\n\n" + "\n".join(issues)
        else:
            response_text = result.get("error", "Failed to modify asset.")

        return jsonify(
            {
                "success": result.get("success", False),
                "response": response_text,
                "document_id": document_id,
                "operation": result.get("operation"),
                "assets": result.get("assets", []),
            }
        )

    except Exception as e:
        print(f"[Error] modify_asset failed: {e}")
        import traceback

        traceback.print_exc()
        return jsonify({"success": False, "error": f"Internal error: {str(e)}"}), 500


@main_bp.route("/list_assets/<document_id>", methods=["GET"])
def list_assets_route(document_id):
    """List all modifiable assets in a DXF file."""
    dxf_path = GENERATED_DIR / f"{document_id}.dxf"

    if not os.path.exists(dxf_path):
        return jsonify({"error": f"DXF file not found: {document_id}"}), 404

    assets = dxf_list_assets(dxf_path)
    return jsonify({"document_id": document_id, "assets": assets})


@main_bp.route("/session_state", methods=["GET"])
def session_state():
    chat_id = session.get("chat_id")
    flow_started = session.get("flow_started", False)

    # If server restarted, MemorySaver is empty — LangGraph has no state
    # even though Flask cookie still says flow_started=True
    if flow_started and chat_id:
        try:
            state = current_app.model.graph.get_state({"configurable": {"thread_id": chat_id}})
            if not state or not state.values:
                flow_started = False
        except Exception:
            flow_started = False

    return jsonify({
        "chat_id": chat_id,
        "last_document_id": session.get("last_document_id"),
        "flow_started": flow_started,
        "server_instance_id": SERVER_INSTANCE_ID,
    })


@main_bp.route("/api/waitlist", methods=["POST"])
def waitlist_join():
    data = request.get_json(silent=True) or {}
    if not isinstance(data, dict):
        return jsonify({"error": "JSON object body required"}), 400
    raw = data.get("email")
    if raw is None or not isinstance(raw, str):
        return jsonify({"error": "email is required"}), 400
    email = raw.strip().lower()
    if not email or "@" not in email or len(email) > 320:
        return jsonify({"error": "invalid email"}), 400

    entry = WaitlistEntry(email=email)
    db.session.add(entry)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"ok": True, "already_registered": True}), 200
    return jsonify({"ok": True}), 201


@main_bp.route("/api/me", methods=["GET"])
@firebase_required
def me():
    profile_row = UserProfile.query.filter_by(user_id=g.current_user.id).one_or_none()
    if profile_row is None:
        profile_payload = {"university": None, "city": None, "country": None}
    else:
        profile_payload = {
            "university": profile_row.university,
            "city": profile_row.city,
            "country": profile_row.country,
        }
    gen_count = _get_user_generation_count(g.current_user.id)
    return jsonify(
        {
            "id": g.current_user.id,
            "firebase_uid": g.current_user.firebase_uid,
            "email": g.current_user.email,
            "display_name": g.current_user.display_name,
            "photo_url": g.current_user.photo_url,
            "has_paid": getattr(g.current_user, "has_paid", False),
            "generation_count": gen_count,
            "generation_limit": FREE_GENERATION_LIMIT,
            "profile": profile_payload,
        }
    )


@main_bp.route("/api/me/profile", methods=["PATCH"])
@firebase_required
def update_my_profile():
    data = request.get_json(silent=True) or {}
    if not isinstance(data, dict):
        return jsonify({"error": "JSON object body required"}), 400

    def _norm(value):
        if value is None:
            return None
        text = str(value).strip()
        return text or None

    profile_keys = ("university", "city", "country")
    if not any(k in data for k in profile_keys):
        return jsonify(
            {"error": "at least one of university, city, country must be present in the body"}
        ), 400

    profile = UserProfile.query.filter_by(user_id=g.current_user.id).one_or_none()
    if profile is None:
        profile = UserProfile(user_id=g.current_user.id)

    if "university" in data:
        profile.university = _norm(data.get("university"))
    if "city" in data:
        profile.city = _norm(data.get("city"))
    if "country" in data:
        profile.country = _norm(data.get("country"))

    if not profile.university and not profile.city and not profile.country:
        return jsonify({"error": "at least one of university, city, country is required"}), 400

    db.session.add(profile)
    db.session.commit()
    return jsonify(
        {
            "user_id": profile.user_id,
            "university": profile.university,
            "city": profile.city,
            "country": profile.country,
        }
    )


@main_bp.route("/api/chats", methods=["GET"])
@firebase_required
def list_chats():
    chats = (
        ChatSession.query.filter_by(user_id=g.current_user.id)
        .order_by(ChatSession.created_at.desc())
        .all()
    )

    return jsonify(
        [
            {
                "id": chat.id,
                "title": chat.title,
                "metadata": chat.chat_metadata,
                "created_at": chat.created_at.isoformat() if chat.created_at else None,
                "updated_at": chat.updated_at.isoformat() if chat.updated_at else None,
            }
            for chat in chats
        ]
    )


@main_bp.route("/api/chats", methods=["POST"])
@firebase_required
def create_chat():
    data = request.get_json(silent=True) or {}
    print(f"Received data for new chat: {data}")
    title = data.get("title")
    if title is not None and not isinstance(title, str):
        title = None
    metadata = data.get("metadata") or {}
    if not isinstance(metadata, dict):
        return jsonify({"error": "metadata must be an object"}), 400

    metadata.setdefault("thread_id", str(uuid.uuid4())[:8])
    metadata.setdefault("started", False)

    # Never store null title: use "New chat" until first message sets it
    chat = ChatSession(
        user_id=g.current_user.id,
        title=(title or "New chat").strip() or "New chat",
        chat_metadata=metadata,
    )
    db.session.add(chat)
    db.session.commit()

    return (
        jsonify(
            {
                "id": chat.id,
                "title": chat.title,
                "metadata": chat.chat_metadata,
                "created_at": chat.created_at.isoformat() if chat.created_at else None,
                "updated_at": chat.updated_at.isoformat() if chat.updated_at else None,
            }
        ),
        201,
    )


@main_bp.route("/api/chats/<int:chat_id>/turn", methods=["POST"])
@firebase_required
def chat_turn(chat_id: int):
    """
    Frontend-friendly endpoint: creates a user message, runs the AI, stores an assistant message,
    and returns a structured JSON payload including artifact URLs (png/dxf) when available.

    Pass chat_id=0 to auto-create a new chat in the same request (avoids phantom chats).
    """
    if chat_id == 0:
        metadata = {"thread_id": str(uuid.uuid4())[:8], "started": False}
        chat = ChatSession(
            user_id=g.current_user.id,
            title="New chat",
            chat_metadata=metadata,
        )
        db.session.add(chat)
        db.session.commit()
        chat_id = chat.id
    else:
        chat = ChatSession.query.filter_by(id=chat_id, user_id=g.current_user.id).one_or_none()
        if chat is None:
            return jsonify({"error": "Chat not found"}), 404

    data = request.get_json(silent=True) or {}
    content = data.get("content")
    image_url = data.get("image_url")

    if not content and not image_url:
        return jsonify({"error": "content or image_url is required"}), 400

    if not _user_can_generate(g.current_user):
        gen_count = _get_user_generation_count(g.current_user.id)
        return jsonify({
            "error": "generation_limit_reached",
            "message": f"You have used all {FREE_GENERATION_LIMIT} free generations. Join our waitlist for updates!",
            "generation_count": gen_count,
            "generation_limit": FREE_GENERATION_LIMIT,
        }), 403

    meta = chat.chat_metadata or {}
    if not isinstance(meta, dict):
        meta = {}

    thread_id = meta.get("thread_id") or str(uuid.uuid4())[:8]
    started = bool(meta.get("started"))

    # Store user message
    user_msg = Message(
        chat_id=chat.id,
        sender_type="user",
        user_id=g.current_user.id,
        content=content,
        image_url=image_url,
    )
    db.session.add(user_msg)
    db.session.commit()
    if image_url:
        _insert_message_attachments(
            user_msg.id,
            [{"url": image_url, "type": "image"}],
        )

    # Set chat title from first user message (for history sidebar)
    existing_count = Message.query.filter_by(chat_id=chat.id).count()
    if existing_count == 1:
        try:
            raw = (content or "").strip() if isinstance(content, str) else ""
            chat.title = (raw[:80]).strip() if raw else "New chat"
        except Exception:
            chat.title = "New chat"
        db.session.add(chat)
        db.session.commit()

    _turn_error_assistant_text = "I'm sorry, I encountered an error. Please try again."
    assistant_msg = None

    try:
        asset_edit_keywords = ["move", "remove", "delete", "rotate", "shift", "slide", "add", "place", "put", "insert", "adjust", "nudge", "swap", "replace", "reposition", "turn"]
        prompt_lower = (content or "").lower()
        is_asset_edit = started and any(kw in prompt_lower for kw in asset_edit_keywords)

        if is_asset_edit:
            doc_id = meta.get("last_document_id")
            if not doc_id:
                try:
                    raw_state = current_app.model.graph.get_state({"configurable": {"thread_id": thread_id}})
                    st_vals = getattr(raw_state, "values", raw_state)
                    user_prompts = st_vals.get("user_prompts", []) if isinstance(st_vals, dict) else []
                    idx = len(user_prompts) if isinstance(user_prompts, list) else 0
                    doc_id = f"{thread_id}_{idx}"
                except Exception:
                    doc_id = f"{thread_id}_1"
            
            dxf_path = os.path.join(base_dir, "data", "generated", f"{doc_id}.dxf")
            
            if os.path.exists(dxf_path):
                agent = _get_asset_edit_agent()
                result = agent.execute(dxf_path, content)
                
                if result.get("success"):
                    _ensure_png_fresh(dxf_path)
                    op = result.get("operation", {})
                    action = op.get("action", "modify")
                    asset_name = op.get("asset_name", "asset")
                    
                    if action == "move":
                        dx = op.get("dx") or 0.0
                        dy = op.get("dy") or 0.0
                        dirs: list[str] = []
                        if dx > 0: dirs.append(f"{dx}m to the right")
                        elif dx < 0: dirs.append(f"{abs(dx)}m to the left")
                        if dy > 0: dirs.append(f"{dy}m up")
                        elif dy < 0: dirs.append(f"{abs(dy)}m down")
                        direction = " and ".join(dirs) if dirs else "in place"
                        assistant_text = f"Moved the {asset_name} {direction}."
                    elif action in ("remove", "delete"):
                        assistant_text = f"Removed the {asset_name} from the floor plan."
                    elif action == "rotate":
                        angle = op.get("angle", 0)
                        assistant_text = f"Rotated the {asset_name} by {angle}°."
                    elif action == "add":
                        room_id = op.get("room_id", "")
                        assistant_text = f"Added a {asset_name} to room {room_id}."
                    else:
                        assistant_text = f"Modified the {asset_name}."

                    if result.get("collision"):
                        assistant_text = f"Collision detected! {assistant_text}"
                else:
                    assistant_text = result.get("error", "Could not modify asset.")
            else:
                assistant_text = "Floor plan DXF not found for editing."
            
            document_id = doc_id
            meta["last_document_id"] = document_id
            chat.chat_metadata = dict(meta)

            from sqlalchemy.orm.attributes import flag_modified
            flag_modified(chat, "chat_metadata")

            png_local = f"/api/chats/{chat.id}/files/{document_id}.png"
            dxf_local = f"/api/chats/{chat.id}/files/{document_id}.dxf"
            assistant_msg = Message(
                chat_id=chat.id,
                sender_type="assistant",
                user_id=None,
                content=assistant_text,
                image_url=png_local,
                extra_data={
                    "document_id": document_id,
                    "png_url": png_local,
                    "dxf_url": dxf_local,
                },
            )
            db.session.add(assistant_msg)
            db.session.flush()
            _insert_message_attachments(
                assistant_msg.id,
                [
                    {"url": png_local, "type": "image"},
                    {"url": dxf_local, "type": "dxf"},
                ],
            )
            db.session.commit()

        else:
            # Run AI (Asynchronous)
            task_id = async_manager.submit_task(
                generate_floorplan_task,
                _db_chat_id=chat.id,
                prompt=content or "",
                chat_id=chat.id,
                thread_id=thread_id if started else None,
                previous_state=None,
                user_id=g.current_user.id
            )
            
            queue_pos = async_manager.get_queue_position(task_id)
            return jsonify({
                "success": True,
                "task_id": task_id,
                "chat_id": chat.id,
                "queue_position": queue_pos,
                "queue_depth": async_manager.queue_depth,
                "message": "Floor plan generation started in the background."
            })
    except Exception as e:
        db.session.rollback()
        current_app.logger.exception("chat_turn: model or post-processing failed")
        return jsonify({"error": "Chat turn failed. Please try again."}), 500

    # Best-effort profile enrichment from authenticated onboarding payload.
    if request.is_json:
        payload = request.get_json(silent=True) or {}
        onboarding = payload.get("onboarding") if isinstance(payload, dict) else None
        profile_payload = onboarding if isinstance(onboarding, dict) else payload
        if isinstance(profile_payload, dict):
            city = profile_payload.get("city")
            country = profile_payload.get("country")
            university = profile_payload.get("university")
            if any(v for v in (city, country, university)):
                try:
                    profile = UserProfile.query.filter_by(user_id=g.current_user.id).one_or_none()
                    if profile is None:
                        profile = UserProfile(user_id=g.current_user.id)
                    if city and not profile.city:
                        profile.city = str(city).strip()
                    if country and not profile.country:
                        profile.country = str(country).strip()
                    if university and not profile.university:
                        profile.university = str(university).strip()
                    db.session.add(profile)
                    db.session.commit()
                except Exception:
                    db.session.rollback()

    # fetch full history after inserting new messages
    messages = (
        Message.query.filter_by(chat_id=chat.id)
        .order_by(Message.created_at.asc())
        .all()
    )

    message_ids = [m.id for m in messages if getattr(m, "id", None) is not None]
    feedback_rows = (
        ChatFeedback.query.filter(
            ChatFeedback.user_id == g.current_user.id,
            ChatFeedback.message_id.in_(message_ids),
        ).all()
        if message_ids
        else []
    )
    feedback_message_ids = {row.message_id for row in feedback_rows}

    def _serialize_message(m):
        return {
            "id": m.id,
            "chat_id": m.chat_id,
            "sender_type": m.sender_type.value if hasattr(m.sender_type, "value") else m.sender_type,
            "user_id": m.user_id,
            "content": m.content,
            "image_url": m.image_url,
            "extra_data": m.extra_data,
            "feedback_submitted": m.id in feedback_message_ids,
            "attachments": [
                {
                    "id": a.id,
                    "url": a.url,
                    "type": a.type,
                    "metadata": a.attachment_metadata,
                }
                for a in (m.attachments or [])
            ],
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }

    history = [_serialize_message(m) for m in messages]

    return jsonify(
        {
            "chat_id": chat.id,
            "thread_id": thread_id,
            "user_message": {
                "id": user_msg.id,
                "content": user_msg.content,
                "image_url": user_msg.image_url,
                "created_at": user_msg.created_at.isoformat() if user_msg.created_at else None,
            },
            "assistant_message": {
                "id": assistant_msg.id,
                "content": assistant_msg.content,
                "image_url": assistant_msg.image_url,
                "extra_data": assistant_msg.extra_data,
                "created_at": assistant_msg.created_at.isoformat() if assistant_msg.created_at else None,
            },
            "history": history,
        }
    )


@main_bp.route("/api/chats/<int:chat_id>/tasks/<task_id>", methods=["GET"])
@firebase_required
def get_task_status(chat_id: int, task_id: str):
    """Poll the status of an async floor-plan generation task."""
    # Verify the chat belongs to the current user (prevents cross-user data leaks)
    chat_owner = ChatSession.query.filter_by(id=chat_id, user_id=g.current_user.id).one_or_none()
    if chat_owner is None:
        return jsonify({"error": "Chat not found"}), 404

    task = Task.query.filter_by(task_id=task_id).first()
    if task is None:
        return jsonify({"error": "Task not found"}), 404

    if task.chat_id is not None and task.chat_id != chat_id:
        return jsonify({"error": "Task not found"}), 404

    queue_pos = async_manager.get_queue_position(task_id)
    if task.status != "SUCCESS":
        return jsonify({
            "status": task.status,
            "result": task.result,
            "queue_position": queue_pos,
            "queue_depth": async_manager.queue_depth,
        })

    # Task finished — return full chat history so the frontend can render messages
    messages = (
        Message.query.filter_by(chat_id=chat_id)
        .order_by(Message.created_at.asc())
        .all()
    )
    message_ids = [m.id for m in messages if getattr(m, "id", None) is not None]
    feedback_message_ids = set()
    if message_ids:
        feedback_rows = ChatFeedback.query.filter(
            ChatFeedback.user_id == g.current_user.id,
            ChatFeedback.message_id.in_(message_ids),
        ).all()
        feedback_message_ids = {row.message_id for row in feedback_rows}

    history = [
        {
            "id": m.id,
            "chat_id": m.chat_id,
            "sender_type": m.sender_type.value if hasattr(m.sender_type, "value") else m.sender_type,
            "user_id": m.user_id,
            "content": m.content,
            "image_url": m.image_url,
            "extra_data": m.extra_data,
            "feedback_submitted": m.id in feedback_message_ids,
            "attachments": [
                {
                    "id": a.id,
                    "url": a.url,
                    "type": a.type,
                    "metadata": a.attachment_metadata,
                }
                for a in (m.attachments or [])
            ],
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
        for m in messages
    ]

    return jsonify({
        "status": task.status,
        "result": task.result,
        "history": history,
        "chat_id": chat_id,
    })


@main_bp.route("/api/chats/<int:chat_id>/files/<path:filename>", methods=["GET"])
@firebase_required
def get_chat_file(chat_id: int, filename: str):
    """
    Auth-protected access to generated artifacts. Frontend should fetch() with Authorization header.
    """
    chat = ChatSession.query.filter_by(id=chat_id, user_id=g.current_user.id).one_or_none()
    if chat is None:
        return jsonify({"error": "Chat not found"}), 404

    if not (filename.endswith(".png") or filename.endswith(".dxf")):
        return jsonify({"error": "Unsupported file type"}), 400

    doc_id = filename.rsplit(".", 1)[0]

    # Verify this document belongs to this chat via message extra_data or metadata
    meta = chat.chat_metadata or {}
    last_doc = meta.get("last_document_id") if isinstance(meta, dict) else None
    allowed = False
    if last_doc and doc_id.startswith(str(chat_id) + "_"):
        allowed = True
    if not allowed:
        has_msg = Message.query.filter(
            Message.chat_id == chat_id,
            Message.extra_data.isnot(None),
        ).first()
        if has_msg:
            allowed = True

    if not allowed:
        return jsonify({"error": "File not found"}), 404

    file_path = os.path.join(base_dir, "data", "generated", filename)
    if not os.path.exists(file_path):
        return jsonify({"error": "File not found"}), 404

    mimetype = "image/png" if filename.endswith(".png") else "application/dxf"
    return send_file(file_path, as_attachment=False, mimetype=mimetype)


@main_bp.route("/api/chats/<int:chat_id>/feedback", methods=["POST"])
@firebase_required
def submit_chat_feedback(chat_id: int):
    chat = ChatSession.query.filter_by(id=chat_id, user_id=g.current_user.id).one_or_none()
    if chat is None:
        return jsonify({"error": "Chat not found"}), 404

    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return jsonify({"error": "Invalid payload"}), 400

    message_id = payload.get("message_id")
    feedback_type = payload.get("feedback_type")
    category = payload.get("category")
    severity = payload.get("severity")
    comment = payload.get("comment")
    metadata = payload.get("metadata")

    try:
        message_id_int = int(message_id)
    except (TypeError, ValueError):
        return jsonify({"error": "message_id must be a valid integer"}), 400

    if feedback_type not in ("positive", "negative"):
        return jsonify({"error": "feedback_type must be 'positive' or 'negative'"}), 400

    if not isinstance(category, str) or not category.strip():
        return jsonify({"error": "category is required"}), 400

    if feedback_type == "negative":
        if severity not in ("slight_issue", "usable_with_edits", "completely_unusable"):
            return jsonify({"error": "severity is required for negative feedback"}), 400
    else:
        severity = None

    message = Message.query.filter_by(id=message_id_int, chat_id=chat.id).one_or_none()
    if message is None:
        return jsonify({"error": "Message not found for this chat"}), 404
    sender_type = message.sender_type.value if hasattr(message.sender_type, "value") else message.sender_type
    if sender_type != "assistant":
        return jsonify({"error": "Feedback is only allowed for assistant messages"}), 400

    feedback_metadata = metadata if isinstance(metadata, dict) else {}
    feedback_metadata["category"] = category.strip()
    feedback_metadata["severity"] = severity

    existing_feedback = ChatFeedback.query.filter_by(
        message_id=message.id,
        user_id=g.current_user.id,
    ).one_or_none()
    if existing_feedback is not None:
        return jsonify(
            {
                "error": "Feedback already submitted for this response",
                "feedback_id": str(existing_feedback.id),
            }
        ), 409

    feedback = ChatFeedback(
        chat_id=chat.id,
        message_id=message.id,
        user_id=g.current_user.id,
    )

    feedback.feedback_type = feedback_type
    feedback.comment = (str(comment).strip() if comment is not None and str(comment).strip() else None)
    feedback.feedback_metadata = feedback_metadata

    db.session.add(feedback)
    db.session.commit()

    return jsonify(
        {
            "id": str(feedback.id),
            "chat_id": feedback.chat_id,
            "message_id": feedback.message_id,
            "user_id": feedback.user_id,
            "feedback_type": feedback.feedback_type,
            "comment": feedback.comment,
            "metadata": feedback.feedback_metadata,
            "created_at": feedback.created_at.isoformat() if feedback.created_at else None,
            "updated_at": feedback.updated_at.isoformat() if feedback.updated_at else None,
        }
    ), 200


@main_bp.route("/api/chats/<int:chat_id>/messages", methods=["GET"])
@firebase_required
def list_messages(chat_id: int):
    chat = ChatSession.query.filter_by(id=chat_id, user_id=g.current_user.id).one_or_none()
    if chat is None:
        return jsonify({"error": "Chat not found"}), 404

    messages = (
        Message.query.filter_by(chat_id=chat.id)
        .order_by(Message.created_at.asc())
        .all()
    )

    message_ids = [m.id for m in messages if getattr(m, "id", None) is not None]
    feedback_rows = (
        ChatFeedback.query.filter(
            ChatFeedback.user_id == g.current_user.id,
            ChatFeedback.message_id.in_(message_ids),
        ).all()
        if message_ids
        else []
    )
    feedback_message_ids = {row.message_id for row in feedback_rows}

    return jsonify(
        [
            {
                "id": m.id,
                "chat_id": m.chat_id,
                "sender_type": m.sender_type.value if hasattr(m.sender_type, "value") else m.sender_type,
                "user_id": m.user_id,
                "content": m.content,
                "image_url": m.image_url,
                "extra_data": m.extra_data,
                "feedback_submitted": m.id in feedback_message_ids,
                "attachments": [
                    {
                        "id": a.id,
                        "url": a.url,
                        "type": a.type,
                        "metadata": a.attachment_metadata,
                    }
                    for a in (m.attachments or [])
                ],
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in messages
        ]
    )


@main_bp.route("/api/chats/<int:chat_id>/messages", methods=["POST"])
@firebase_required
def create_message(chat_id: int):
    chat = ChatSession.query.filter_by(id=chat_id, user_id=g.current_user.id).one_or_none()
    if chat is None:
        return jsonify({"error": "Chat not found"}), 404

    data = request.get_json(silent=True) or {}
    content = data.get("content")
    image_url = data.get("image_url")
    extra_data = data.get("extra_data")

    if not content and not image_url:
        return jsonify({"error": "content or image_url is required"}), 400

    message = Message(
        chat_id=chat.id,
        sender_type="user",
        user_id=g.current_user.id,
        content=content,
        image_url=image_url,
        extra_data=extra_data,
    )
    db.session.add(message)
    db.session.commit()
    if image_url:
        _insert_message_attachments(
            message.id,
            [{"url": image_url, "type": "image"}],
        )

    return (
        jsonify(
            {
                "id": message.id,
                "chat_id": message.chat_id,
                "sender_type": message.sender_type.value
                if hasattr(message.sender_type, "value")
                else message.sender_type,
                "user_id": message.user_id,
                "content": message.content,
                "image_url": message.image_url,
                "attachments": [
                    {
                        "id": a.id,
                        "url": a.url,
                        "type": a.type,
                        "metadata": a.attachment_metadata,
                    }
                    for a in (message.attachments or [])
                ],
                "created_at": message.created_at.isoformat() if message.created_at else None,
            }
        ),
        201,
    )


@main_bp.route("/api/chats/<int:chat_id>", methods=["DELETE"])
@firebase_required
def delete_chat(chat_id: int):
    chat = ChatSession.query.filter_by(id=chat_id, user_id=g.current_user.id).one_or_none()
    if chat is None:
        return jsonify({"error": "Chat not found"}), 404

    if is_s3_configured():
        messages = Message.query.filter_by(chat_id=chat.id).all()
        for msg in messages:
            extra = msg.extra_data if isinstance(msg.extra_data, dict) else {}
            doc_id = extra.get("document_id")
            if doc_id:
                try:
                    delete_generated_files(doc_id)
                except Exception as e:
                    print(f"[Warning] Failed to delete S3 files for {doc_id}: {e}")

    db.session.delete(chat)
    db.session.commit()
    return jsonify({"success": True}), 200


# simple endpoint the client should hit right after sign‑out
# it updates the logout timestamp on the server side for auditing
@main_bp.route("/api/logout", methods=["POST"])
@firebase_required
def logout():
    user = g.current_user
    user.last_logout_at = datetime.utcnow()
    db.session.add(user)
    db.session.commit()
    return jsonify({"success": True})

@main_bp.route("/api/me/profile-photo", methods=["POST"])
@firebase_required
def upload_profile_photo():
    data = request.get_json(silent=True) or {}
    photo_data = data.get("photoData")
    if not photo_data or not isinstance(photo_data, str):
        return jsonify({"error": "photoData is required"}), 400

    user = g.current_user
    user.photo_url = photo_data
    db.session.add(user)
    db.session.commit()
    return jsonify({"ok": True, "photo_url": user.photo_url})


@main_bp.route("/api/feedback", methods=["POST"])
def general_feedback():
    data = request.get_json(silent=True) or {}
    if not isinstance(data, dict):
        return jsonify({"error": "JSON object body required"}), 400
    feedback_type = data.get("type")
    message = data.get("message")
    if not feedback_type or not message:
        return jsonify({"error": "type and message are required"}), 400
    current_app.logger.info("[Feedback] type=%s message=%s", feedback_type, message)
    return jsonify({"ok": True}), 201


@main_bp.route("/api/payments/phonepe/create", methods=["POST"])
@firebase_required
def phonepe_create():
    return jsonify({"error": "Payment integration not configured"}), 501


@main_bp.route("/api/payments/phonepe/confirm", methods=["POST"])
@firebase_required
def phonepe_confirm():
    return jsonify({"error": "Payment integration not configured"}), 501
