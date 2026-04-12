import os
import ezdxf
from ezdxf import bbox

# Mock/Import only what's needed
ASSET_LAYER_PREFIX = "ASSET_"


def boxes_overlap(a, b):
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    return not (ax2 < bx1 or ax1 > bx2 or ay2 < by1 or ay1 > by2)


def list_assets_mock(dxf_path):
    doc = ezdxf.readfile(dxf_path)
    msp = doc.modelspace()
    asset_layers = {}
    for entity in msp:
        layer = entity.dxf.layer
        if layer.startswith(ASSET_LAYER_PREFIX):
            asset_layers.setdefault(layer, []).append(entity)
    assets = []
    for layer_name, entities in asset_layers.items():
        name = layer_name[len(ASSET_LAYER_PREFIX) :]
        parts = name.split("_")
        asset_name = "_".join(parts[:-1]) if len(parts) >= 2 else "unknown"
        room_id = parts[-1] if len(parts) >= 2 else "unknown"
        bbox_dict = None
        try:
            bb = bbox.extents(entities)
            if bb.has_data:
                bbox_dict = {
                    "min_x": float(bb.extmin.x),
                    "min_y": float(bb.extmin.y),
                    "max_x": float(bb.extmax.x),
                    "max_y": float(bb.extmax.y),
                }
        except:
            pass
        assets.append(
            {
                "layer_name": layer_name,
                "asset_name": asset_name,
                "room_id": room_id,
                "bbox": bbox_dict,
            }
        )
    return assets


def check_asset_collision_logic(dxf_path, target_layer):
    doc = ezdxf.readfile(dxf_path)
    msp = doc.modelspace()
    assets = list_assets_mock(dxf_path)
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
    for asset in assets:
        if asset["layer_name"] == target_layer:
            continue
        if asset["room_id"] != room_id:
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
            return True
    return False


def verify():
    dxf_dir = "data/generated"
    if not os.path.exists(dxf_dir):
        return
    dxf_files = [f for f in os.listdir(dxf_dir) if f.endswith(".dxf")]
    if not dxf_files:
        return
    dxf_path = os.path.join(dxf_dir, dxf_files[0])
    assets = list_assets_mock(dxf_path)
    if not assets:
        return
    print(f"Testing {dxf_path} with asset {assets[0]['layer_name']}")
    res = check_asset_collision_logic(dxf_path, assets[0]["layer_name"])
    print(f"Collision result: {res}")


if __name__ == "__main__":
    verify()