import json
import os
import matplotlib

matplotlib.use("Agg")  # Non-GUI backend for server/thread safety
import matplotlib.pyplot as plt
import ezdxf
from ezdxf import bbox
from ezdxf.addons.drawing import RenderContext, Frontend
from ezdxf.addons.drawing.matplotlib import MatplotlibBackend
from ezdxf.addons.drawing.properties import LayoutProperties
from src.app.core.assemble import FloorPlanAssembler
from src.app.core.asset_assembly import AssetAssembler
from src.app.core.asset_validation import build_door_swing
from src.app.core.room import Room


def clear_existing_assets(doc):
    msp = doc.modelspace()

    asset_layers = [
        layer.dxf.name for layer in doc.layers if layer.dxf.name.startswith("ASSET_")
    ]

    for layer_name in asset_layers:
        # delete all entities in modelspace
        for e in list(msp):
            if e.dxf.layer == layer_name:
                msp.delete_entity(e)

        # also clean blocks (important!)
        for block in doc.blocks:
            for e in list(block):
                if e.dxf.layer == layer_name:
                    block.delete_entity(e)

        try:
            doc.layers.remove(layer_name)
        except Exception:
            pass


def run_layer2_on_dxf(
    input_dxf_path: str,
    output_dxf_path: str,
    dpi: int = 300,
):
    # 1. Load DXF (no modifications)
    doc = ezdxf.readfile(input_dxf_path)

    # 2. Save as-is (optional copy)
    doc.saveas(output_dxf_path)

    # 3. Export PNG from a fresh read (important)
    try:
        render_doc = ezdxf.readfile(output_dxf_path)
        temp_assembler = FloorPlanAssembler(None, None)
        temp_assembler.doc = render_doc
        temp_assembler.export_image(output_dxf_path, dpi=dpi)
    except Exception as e:
        print(f"[Warning] Failed to generate PNG: {e}")

    return output_dxf_path
