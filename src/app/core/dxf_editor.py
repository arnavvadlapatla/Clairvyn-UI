"""
DXF Editor: Stateless utility for manipulating individual assets in a DXF floorplan.

Assets are identified by their DXF layer name (e.g., ASSET_sofa_R2).
All operations are non-destructive to non-target layers.
"""

import os
import ezdxf
import math
from typing import Optional, List
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from ezdxf import bbox
from ezdxf.math import Matrix44
from ezdxf.addons.drawing import RenderContext, Frontend
from ezdxf.addons.drawing.matplotlib import MatplotlibBackend
from ezdxf.addons.drawing.properties import LayoutProperties
from ezdxf.math import BoundingBox
from ezdxf.addons import Importer
import re
from typing import List

ASSET_LAYER_PREFIX = "ASSET_"

import datetime


def log_debug(msg):
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {msg}")




ASSET_LAYER_PREFIX = "ASSET_"


def list_assets(dxf_path: str) -> List[dict]:

    doc = ezdxf.readfile(dxf_path)
    msp = doc.modelspace()

    asset_layers = {}
    # for e in msp:
    #     print(e.dxftype(), e.dxf.layer)
    # -------- Collect entities by asset layer --------
    for entity in msp:
        layer = entity.dxf.layer

        if layer.startswith(ASSET_LAYER_PREFIX):
            asset_layers.setdefault(layer, []).append(entity)

    assets = []

    for layer_name, entities in asset_layers.items():
        # -------- Parse asset_name and room_id --------
        name = layer_name[len(ASSET_LAYER_PREFIX) :]
        parts = name.split("_")

        asset_name = "unknown"
        room_id = "unknown"

        if len(parts) >= 2:
            # If last part numeric -> duplicate index
            if parts[-1].isdigit():
                room_id = parts[-2]
                asset_name = "_".join(parts[:-2])

            else:
                room_id = parts[-1]
                asset_name = "_".join(parts[:-1])

        # -------- Bounding box calculation --------
        bbox_dict = None

        try:
            insert_entity = next((e for e in entities if e.dxftype() == "INSERT"), None)
            if insert_entity:
                bb_tuple = get_insert_bbox(insert_entity)
                if bb_tuple:
                    bbox_dict = {
                        "min_x": float(bb_tuple[0]),
                        "min_y": float(bb_tuple[1]),
                        "max_x": float(bb_tuple[2]),
                        "max_y": float(bb_tuple[3]),
                    }
            
            if not bbox_dict:
                bb = bbox.extents(entities)
                if bb.has_data:
                    bbox_dict = {
                        "min_x": float(bb.extmin.x),
                        "min_y": float(bb.extmin.y),
                        "max_x": float(bb.extmax.x),
                        "max_y": float(bb.extmax.y),
                    }

        except Exception:
            bbox_dict = None

        assets.append(
            {
                "layer_name": layer_name,
                "asset_name": asset_name,
                "room_id": room_id,
                "bbox": bbox_dict,
            }
        )

    return assets


def move_asset(dxf_path: str, layer_name: str, dx: float, dy: float) -> dict:
    """
    Move all entities on a given layer by (dx, dy).
    Handles INSERT blocks and regular entities safely.
    """

    try:
        doc = ezdxf.readfile(dxf_path)
        msp = doc.modelspace()
    except Exception as e:
        return {"success": False, "error": f"Failed to read DXF: {e}"}

    entities = [e for e in msp if e.dxf.layer == layer_name]

    if not entities:
        return {"success": False, "error": f"No entities found on layer '{layer_name}'"}

    moved_count = 0
    translation_matrix = Matrix44.translate(dx, dy, 0)

    for e in entities:
        try:
            if e.dxftype() == "INSERT":
                # Move block reference by updating insert point
                x, y, z = e.dxf.insert
                e.dxf.insert = (x + dx, y + dy, z)
            else:
                # Regular geometry
                e.transform(translation_matrix)

            moved_count += 1

        except Exception as err:
            log_debug(f"[move_asset] Failed to move entity ({e.dxftype()}): {err}")

    doc.saveas(dxf_path)
    _render_png(dxf_path)

    # Compute updated bounding box
    updated_entities = [e for e in msp if e.dxf.layer == layer_name]
    bb = bbox.extents(updated_entities)

    new_bbox = None
    if bb.has_data:
        new_bbox = {
            "min_x": bb.extmin.x,
            "min_y": bb.extmin.y,
            "max_x": bb.extmax.x,
            "max_y": bb.extmax.y,
        }

    return {
        "success": True,
        "moved_count": moved_count,
        "displacement": {"dx": dx, "dy": dy},
        "new_bbox": new_bbox,
    }


def rotate_asset(
    dxf_path: str, layer_name: str, angle: float, center: tuple = None
) -> dict:
    """Rotate all entities on a layer around `center` by `angle` degrees CCW."""
    try:
        doc = ezdxf.readfile(dxf_path)
        msp = doc.modelspace()
    except Exception as e:
        return {"success": False, "error": f"Failed to read DXF: {e}"}

    entities = [e for e in msp if e.dxf.layer == layer_name]
    if not entities:
        return {"success": False, "error": f"No entities found on layer '{layer_name}'"}

    # Determine center
    if center is None:
        bb = bbox.extents(entities)
        if bb.has_data:
            center = ((bb.extmin.x + bb.extmax.x) / 2, (bb.extmin.y + bb.extmax.y) / 2)
        else:
            # fallback: compute centroid of all points
            points = []
            for e in entities:
                try:
                    if hasattr(e, "vertices"):
                        points.extend([v for v in e.vertices()])
                except Exception:
                    continue
            if points:
                xs, ys = zip(*[(p[0], p[1]) for p in points])
                center = (sum(xs) / len(xs), sum(ys) / len(ys))
            else:
                return {"success": False, "error": "Cannot determine asset center"}

    cx, cy = center
    m = (
        Matrix44.translate(-cx, -cy, 0)
        @ Matrix44.z_rotate(math.radians(angle))
        @ Matrix44.translate(cx, cy, 0)
    )

    rotated_count = 0
    for e in entities:
        try:
            e.transform(m)
            rotated_count += 1
        except Exception as e:
            log_debug(f"Failed to rotate entity: {e}")

    doc.saveas(dxf_path)
    _render_png(dxf_path)

    return {
        "success": True,
        "rotated_count": rotated_count,
        "angle": angle,
        "center": list(center),
    }


def remove_asset(dxf_path: str, layer_name: str):
    """
    Removes an asset from the DXF using its specific layer name.

    Example:
        remove_asset("plan.dxf", "ASSET_sofa_living_1")
    """

    log_debug(f"Removing asset layer '{layer_name}'")

    try:
        doc = ezdxf.readfile(dxf_path)
        msp = doc.modelspace()
    except Exception as e:
        return {"success": False, "error": f"DXF load failed: {e}"}

    # -------------------------------------------------
    # Remove entities
    # -------------------------------------------------
    removed_count = 0

    for entity in list(msp):
        if entity.dxf.layer == layer_name:
            try:
                entity.destroy()
                removed_count += 1
            except Exception as e:
                log_debug(f"Entity delete failed: {e}")

    log_debug(f"Removed {removed_count} entities")

    # Optionally remove the layer from doc.layers if it exists
    try:
        if layer_name in doc.layers:
            doc.layers.remove(layer_name)
    except Exception as e:
        log_debug(f"Layer delete failed: {e}")

    # -------------------------------------------------
    # Save DXF
    # -------------------------------------------------
    try:
        doc.saveas(dxf_path)
    except Exception as e:
        return {"success": False, "error": f"DXF save failed: {e}"}

    # -------------------------------------------------
    # Regenerate PNG
    # -------------------------------------------------
    try:
        _render_png(dxf_path)
    except Exception as e:
        log_debug(f"PNG render failed: {e}")

    return {
        "success": True,
        "removed_entities": removed_count,
        "layers_affected": [layer_name],
    }


ASSET_FOLDER = os.path.join("data", "assets")

def extract_room_from_layer(layer_name: str):
    parts = layer_name.split("_")
    if len(parts) < 3:
        return None
    return "_".join(parts[-2:])  # e.g., bedroom_1             

                
def get_insert_bbox(e):
    """Get accurate bbox for INSERT using virtual entities."""
    try:
        virtual_entities = list(e.virtual_entities())
        bb = bbox.extents(virtual_entities)
        if bb and bb.has_data:
            return (bb.extmin.x, bb.extmin.y, bb.extmax.x, bb.extmax.y)
    except Exception as ex:
        print(f"[WARN] Failed bbox for {e.dxf.layer}: {ex}")
    return None


def get_existing_asset_boxes(msp, room_id):
    boxes = []
    print("-------------Debug: get_existing_asset_boxes function----------------")

    for e in msp.query("INSERT"):
        if not e.dxf.layer.startswith(ASSET_LAYER_PREFIX):
            continue

        bb = get_insert_bbox(e)
        if bb:
            boxes.append(bb)
            print(f"Found asset box: {bb} on layer {e.dxf.layer}")

    print(f"Total existing boxes found: {len(boxes)}")
    return boxes


def boxes_overlap(a, b):

    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b

    return not (ax2 < bx1 or ax1 > bx2 or ay2 < by1 or ay1 > by2)


def get_asset_scale(asset_name: str) -> float:
    block_name = asset_name.lower()
    asset_file = os.path.join(ASSET_FOLDER, f"{block_name}.dxf")
    if not os.path.exists(asset_file): return 0.001
    try:
        asset_doc = ezdxf.readfile(asset_file)
        bb = bbox.extents(list(asset_doc.modelspace()))
        if bb and bb.has_data:
            max_dim = max(bb.extmax.x - bb.extmin.x, bb.extmax.y - bb.extmin.y)
            if max_dim > 150: return 0.001
            elif max_dim >= 15: return 0.0254
            elif max_dim > 5: return 0.3048
            else: return 1.0
    except: pass
    return 0.001

def get_asset_size(asset_name: str):
    block_name = asset_name.lower()
    asset_file = os.path.join(ASSET_FOLDER, f"{block_name}.dxf")

    if not os.path.exists(asset_file):
        return (0, 0)

    try:
        asset_doc = ezdxf.readfile(asset_file)
        entities = list(asset_doc.modelspace())
        bb = bbox.extents(entities)

        if bb and bb.has_data:
            width = bb.extmax.x - bb.extmin.x
            height = bb.extmax.y - bb.extmin.y

            scale = get_asset_scale(asset_name)
            width *= scale
            height *= scale

            MARGIN = 0.1  # 10 cm buffer
            width += MARGIN
            height += MARGIN

            return (width, height)

    except Exception as e:
        print(f"[ERROR] get_asset_size: {e}")

    return (0, 0)


def find_free_position(room_ext, asset_size, existing_boxes, step=0.2, wall_only=False, preferred_position=None):
    """
    step = 0.2 → 20 cm grid
    """

    minx, miny = room_ext.extmin.x, room_ext.extmin.y
    maxx, maxy = room_ext.extmax.x, room_ext.extmax.y

    w, h = asset_size

    print("-------------Debug: find_free_position function----------------")
    print("Room extents:", minx, miny, maxx, maxy)
    print("Asset size:", w, h)

    valid_positions = []
    x = minx
    while x + w < maxx:
        y = miny
        while y + h < maxy:
            if wall_only:
                margin = 0.3
                is_near_wall = (x - minx <= margin) or (maxx - (x + w) <= margin) or \
                               (y - miny <= margin) or (maxy - (y + h) <= margin)
                if not is_near_wall:
                    y += step
                    continue

            candidate = (x, y, x + w, y + h)

            collision = any(boxes_overlap(candidate, b) for b in existing_boxes)

            if not collision:
                center = (x + w / 2, y + h / 2)
                valid_positions.append(center)

            y += step
        x += step

    if not valid_positions:
        print("No free position found")
        return []

    # Sort valid_positions
    rx = (minx + maxx) / 2
    ry = (miny + maxy) / 2
    
    if preferred_position == "left":
        valid_positions.sort(key=lambda p: p[0])
    elif preferred_position == "right":
        valid_positions.sort(key=lambda p: -p[0])
    elif preferred_position == "bottom":
        valid_positions.sort(key=lambda p: p[1])
    elif preferred_position == "top":
        valid_positions.sort(key=lambda p: -p[1])
    elif preferred_position == "center":
        valid_positions.sort(key=lambda p: (p[0] - rx)**2 + (p[1] - ry)**2)

    print(f"Found {len(valid_positions)} free positions. Top match at {valid_positions[0]}")
    return valid_positions


def add_asset(
    dxf_path: str,
    asset_name: str,
    insert_point: tuple,
    room_id: str = "R1",
) -> dict:
    """
    Loads an external DXF asset from data/assets/
    and inserts it as a block reference.
    """

    try:
        doc = ezdxf.readfile(dxf_path)
        msp = doc.modelspace()
    except Exception as e:
        return {"success": False, "error": f"Failed to read DXF: {e}"}

    block_name = asset_name.lower()
    asset_file = os.path.join(ASSET_FOLDER, f"{block_name}.dxf")

    # --------------------------------------------------
    # Check asset file exists
    # --------------------------------------------------
    if not os.path.exists(asset_file):
        return {
            "success": False,
            "error": f"Asset file not found: {asset_file}",
        }

    # --------------------------------------------------
    # Load asset DXF
    # --------------------------------------------------
    try:
        asset_doc = ezdxf.readfile(asset_file)
    except Exception as e:
        return {"success": False, "error": f"Failed to read asset DXF: {e}"}

    # --------------------------------------------------
    # Recreate block definition
    # --------------------------------------------------
    if block_name in doc.blocks:
        try:
            doc.blocks.delete_block(block_name, safe=False)
        except Exception:
            pass

    block = doc.blocks.new(name=block_name)

    importer = Importer(asset_doc, doc)
    importer.import_modelspace(block)
    importer.finalize()

    # Normalize block to origin (0,0)
    block_entities = list(block)

    bb = bbox.extents(block_entities)

    if bb and bb.has_data:
        cx = (bb.extmin.x + bb.extmax.x) / 2
        cy = (bb.extmin.y + bb.extmax.y) / 2

        translation = Matrix44.translate(-cx, -cy, 0)

        for e in block_entities:
            try:
                e.transform(translation)
            except:
                pass
    room_entities = list(msp)
    room_bb = bbox.extents(room_entities)
    print("Room bbox:", room_bb.extmin, room_bb.extmax)

    print("Asset bbox:", bb.extmin, bb.extmax)
    # Validate insert point
    if not insert_point or len(insert_point) != 2:
        return {"success": False, "error": "Invalid insert point."}

    # Create unique ASSET layer
    base_layer = f"{ASSET_LAYER_PREFIX}{block_name}_{room_id}"
    layer_name = base_layer
    counter = 1

    while layer_name in doc.layers:
        layer_name = f"{base_layer}_{counter}"
        counter += 1

    doc.layers.new(name=layer_name)

    # Insert block reference
    try:
        scale = get_asset_scale(asset_name)
        msp.add_blockref(
            block_name,
            insert_point,
            dxfattribs={"layer": layer_name},
        ).set_scale(scale)
    except Exception as e:
        return {"success": False, "error": f"Failed to insert block: {e}"}

    # Save + Render
    doc.saveas(dxf_path)
    _render_png(dxf_path)

    return {
        "success": True,
        "layer": layer_name,
        "asset_name": block_name,
        "room_id": room_id,
        "insert_point": insert_point,
    }


def _render_png(dxf_path: str, dpi: int = 300):
    """Re-render the DXF to a PNG image."""
    try:
        from src.app.core.assemble import FloorPlanAssembler

        temp_assembler = FloorPlanAssembler(None, None)
        temp_assembler.export_image(dxf_path, dpi=dpi)
    except Exception as e:
        print(f"[Warning] Failed to render PNG: {e}")


def find_asset_layer(
    dxf_path: str, asset_name: str, room_id: str = None
) -> Optional[str]:
    """
    Find the layer name for an asset by its human-readable name.

    Args:
        dxf_path: Path to the DXF file
        asset_name: Asset name (e.g. "sofa", "bed", "side_table")
        room_id: Optional room ID to disambiguate (e.g. "R1", "R2")

    Returns:
        Layer name string or None if not found
    """
    assets = list_assets(dxf_path)
    candidates = [a for a in assets if a["asset_name"] == asset_name]

    # Fallback: Fuzzy match (e.g. "sofa" matches "sofa_room")
    if not candidates:
        candidates = [a for a in assets if asset_name in a["asset_name"]]

    if not candidates:
        return None

    if room_id:
        filtered = [a for a in candidates if a["room_id"] == room_id]
        if filtered:
            return filtered[0]["layer_name"]

    # Return first match if no room_id specified
    return candidates[0]["layer_name"]


def check_asset_collision(dxf_path: str, target_layer: str) -> bool:
    """
    Check if the asset on target_layer collides with other assets in the same room.
    Also checks if the asset is within the room boundary.
    """
    try:
        doc = ezdxf.readfile(dxf_path)
        msp = doc.modelspace()
    except Exception as e:
        log_debug(f"Collision check failed to read DXF: {e}")
        return False

    assets = list_assets(dxf_path)
    target_asset = next((a for a in assets if a["layer_name"] == target_layer), None)

    if not target_asset or not target_asset.get("bbox"):
        return False

    target_bbox = (
        target_asset["bbox"]["min_x"],
        target_asset["bbox"]["min_y"],
        target_asset["bbox"]["max_x"],
        target_asset["bbox"]["max_y"],
    )
    room_id = target_asset["room_id"]

    # 1. Check collisions with other assets anywhere
    for asset in assets:
        if asset["layer_name"] == target_layer:
            continue
        if not asset.get("bbox"):
            continue

        other_bbox = (
            asset["bbox"]["min_x"],
            asset["bbox"]["min_y"],
            asset["bbox"]["max_x"],
            asset["bbox"]["max_y"],
        )

        if boxes_overlap(target_bbox, other_bbox):
            log_debug(
                f"Collision detected between {target_layer} and {asset['layer_name']}"
            )
            return True

    # 2. Check collision with room boundary (if room entities found)
    # Assets are prefixed with ASSET_, rooms are usually LAYER_R1 etc.
    room_entities = [
        e
        for e in msp
        if room_id in e.dxf.layer and not e.dxf.layer.startswith(ASSET_LAYER_PREFIX)
    ]

    if room_entities:
        try:
            rb = bbox.extents(room_entities)
            if rb.has_data:
                # Target must be fully inside room boundary
                inside = (
                    target_bbox[0] >= rb.extmin.x
                    and target_bbox[1] >= rb.extmin.y
                    and target_bbox[2] <= rb.extmax.x
                    and target_bbox[3] <= rb.extmax.y
                )
                if not inside:
                    log_debug(
                        f"Collision detected: {target_layer} is outside room {room_id}"
                    )
                    return True
        except Exception as e:
            log_debug(f"Boundary check failed: {e}")

    return False