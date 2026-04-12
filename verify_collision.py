import os
import sys
from src.app.core.dxf_editor import check_asset_collision, move_asset, list_assets


def verify():
    # Use a sample DXF if available, otherwise this will fail gracefully
    dxf_dir = "data/generated"
    if not os.path.exists(dxf_dir):
        print(f"Directory {dxf_dir} not found. Skipping verification.")
        return

    dxf_files = [f for f in os.listdir(dxf_dir) if f.endswith(".dxf")]
    if not dxf_files:
        print("No DXF files found in data/generated. Skipping verification.")
        return

    dxf_path = os.path.join(dxf_dir, dxf_files[0])
    print(f"Testing with {dxf_path}...")

    assets = list_assets(dxf_path)
    if len(assets) < 1:
        print("Not enough assets to test collision.")
        return

    target_layer = assets[0]["layer_name"]
    print(f"Target asset: {target_layer}")

    # Initial check
    collision = check_asset_collision(dxf_path, target_layer)
    print(f"Initial collision state: {collision}")

    # Try moving it significantly to force a boundary collision or asset collision
    # (This is just a sniff test, real validation happens in the app)
    move_asset(dxf_path, target_layer, 50.0, 50.0)
    collision = check_asset_collision(dxf_path, target_layer)
    print(f"Collision state after large move: {collision}")

    # Move it back
    move_asset(dxf_path, target_layer, -50.0, -50.0)
    collision = check_asset_collision(dxf_path, target_layer)
    print(f"Collision state after moving back: {collision}")


if __name__ == "__main__":
    verify()