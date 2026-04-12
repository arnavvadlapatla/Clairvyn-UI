import time
import os
import json
import ezdxf
from pathlib import Path
from src.app.core.assemble import FloorPlanAssembler
import src.app.core.layer2_pipeline as layer2_pipeline
from src.app.extensions import db
from src.app.models import ChatSession, Message, PromptMetric, FloorPlan, Attachment
from src.app.s3_utils import upload_generated_png, upload_generated_dxf, is_s3_configured

# Paths
PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = PROJECT_ROOT / "data"
GENERATED_DIR = DATA_DIR / "generated"
SAMPLES_DIR = DATA_DIR / "samples"
ASSET_DIR = DATA_DIR / "asset"

csv_file = str(SAMPLES_DIR / "data.csv")
asset_directory = str(ASSET_DIR)

def _attach_artifacts(message_id, document_id, png_url, dxf_url, chat_id=None):
    """Create Attachment rows for the generated PNG and DXF files.

    chat_id must be the integer DB chat ID so that the fallback (non-S3) URL
    uses the auth-protected /api/chats/<id>/files/ endpoint — the only route
    the frontend calls. The legacy /files/ route is unprotected and not used.
    """
    if not message_id:
        return
    try:
        if chat_id:
            img_url = png_url or f"/api/chats/{chat_id}/files/{document_id}.png"
            dxf_dl  = dxf_url or f"/api/chats/{chat_id}/files/{document_id}.dxf"
        else:
            # chat_id missing — should not happen in normal flow, log it
            print(f"[Task] _attach_artifacts called without chat_id for document {document_id}")
            img_url = png_url or f"/api/chats/0/files/{document_id}.png"
            dxf_dl  = dxf_url or f"/api/chats/0/files/{document_id}.dxf"
        db.session.add(Attachment(message_id=message_id, url=img_url, type="image"))
        db.session.add(Attachment(message_id=message_id, url=dxf_dl, type="dxf"))
    except Exception as e:
        print(f"[Task] Failed to attach artifacts: {e}")


def generate_floorplan_task(prompt, chat_id, thread_id=None, previous_state=None, user_id=None):
    """
    Background task to generate a floorplan, assemble it, run layer2, and update the DB.
    Must be called within a Flask app context (the AsyncManager wrapper provides one).
    """
    from flask import current_app
    agent = current_app.model
    assembler = FloorPlanAssembler(csv_file, asset_directory)
    start_time = time.time()

    try:
        # 1. AI Generation
        # gen_thread_id is the key actually used in LangGraph — always written back to
        # metadata so subsequent turns call continue_with_modification on the right thread.
        if not thread_id:
            gen_thread_id = str(chat_id)
            user_prompt = f"create a floor plan with the following specifications: {prompt}"
            out = agent.start(user_prompt, thread_id=gen_thread_id)
            state = out.get("result", out)
        else:
            gen_thread_id = str(thread_id)
            state = agent.continue_with_modification(prompt, thread_id=gen_thread_id)

        user_prompts = state.get('user_prompts', [])
        num_prompts = max(len(user_prompts), 1) if isinstance(user_prompts, list) else 1
        document_id = f"{chat_id}_{num_prompts}"
        dxf_path = GENERATED_DIR / f"{document_id}.dxf"
        png_path = GENERATED_DIR / f"{document_id}.png"

        # 3. Assembly & Export
        layout = state.get("layout", {})
        spec = state.get("spec", {})

        structure_json_str = json.dumps({
            "layout": layout,
            "total_area": spec.get("total_area"),
            "doors": spec.get("doors", []),
            "windows": spec.get("windows", []),
            "direction": spec.get("direction", []),
        })
        assembler.assemble_and_export(structure_json_str, str(dxf_path))

        # 4. Layer 2 (Assets)
        layer2_pipeline.run_layer2_on_dxf(str(dxf_path), str(dxf_path))
        doc = ezdxf.readfile(dxf_path)
        doc.save()

        # 5. Export PNG
        try:
            assembler.doc = doc
            assembler.export_image(dxf_path, dpi=300)
        except Exception as e:
            print(f"[Celery Task] PNG export failed: {e}")

        # 6. S3 Upload (if configured)
        png_url = None
        dxf_url = None
        if is_s3_configured():
            try:
                png_url = upload_generated_png(str(png_path), document_id)
                dxf_url = upload_generated_dxf(str(dxf_path), document_id)
            except Exception as e:
                print(f"[Celery Task] S3 upload failed: {e}")

        latency_ms = int((time.time() - start_time) * 1000)

        # 7. Update Database
        # chat_id is always the integer DB primary key — chat_turn() guarantees this.
        # int() will raise ValueError immediately if anything else is passed, surfacing
        # a caller bug loudly instead of silently skipping message persistence.
        if chat_id:
            cid = int(chat_id)
            chat = db.session.get(ChatSession, cid)
            if chat:
                assistant_text = "Floor plan generated." if not thread_id else "Floor plan updated."
                assistant_msg = Message(
                    chat_id=chat.id,
                    sender_type="assistant",
                    user_id=None,
                    content=assistant_text,
                    image_url=png_url or f"/api/chats/{chat.id}/files/{document_id}.png",
                    extra_data={
                        "document_id": document_id,
                        "png_url": png_url,
                        "dxf_url": dxf_url,
                    },
                )
                db.session.add(assistant_msg)
                db.session.flush()

                _attach_artifacts(assistant_msg.id, document_id, png_url, dxf_url, chat_id=cid)

                meta = chat.chat_metadata or {}
                if not isinstance(meta, dict):
                    meta = {}
                meta["last_document_id"] = document_id
                meta["started"] = True
                # Always overwrite thread_id with the key actually used in LangGraph.
                # create_chat() seeds a random UUID that is never used — the real key
                # is gen_thread_id (str(chat_id) on first turn, str(thread_id) after).
                meta["thread_id"] = gen_thread_id
                chat.chat_metadata = dict(meta)

                from sqlalchemy.orm.attributes import flag_modified
                flag_modified(chat, "chat_metadata")

                db.session.commit()

                try:
                    db.session.add(PromptMetric(
                        user_id=user_id,
                        chat_session_id=chat.id,
                        prompt_type="chat_modification" if thread_id else "initial_form",
                        latency_ms=latency_ms,
                        success=True
                    ))
                    db.session.commit()
                except Exception:
                    db.session.rollback()

        return {
            "status": "success",
            "document_id": document_id,
            "latency_ms": latency_ms,
            "png_url": png_url,
            "dxf_url": dxf_url,
            "success": True
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        latency_ms = int((time.time() - start_time) * 1000)
        try:
            db.session.rollback()
            db.session.add(PromptMetric(
                user_id=user_id,
                chat_session_id=int(chat_id) if chat_id else None,
                prompt_type="chat_modification" if thread_id else "initial_form",
                latency_ms=latency_ms,
                success=False,
            ))
            db.session.commit()
        except Exception:
            db.session.rollback()
        return {
            "status": "error",
            "error": str(e),
            "success": False
        }
