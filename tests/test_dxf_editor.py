"""
Tests for dxf_editor module: list, move, remove, rotate assets in DXF files.
"""

import os
import sys
import pytest
import ezdxf
from ezdxf import units

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.app.core.dxf_editor import (
    list_assets,
    move_asset,
    remove_asset,
    rotate_asset,
    find_asset_layer,
)

TEST_OUTPUT_DIR = os.path.join("tests", "dxf_editor_test_output")


def create_test_dxf(path):
    """Create a test DXF with two tagged asset layers."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    doc = ezdxf.new()
    doc.units = units.M
    msp = doc.modelspace()

    # Draw room outline (on default layer "0")
    msp.add_lwpolyline(
        [(0, 0), (10, 0), (10, 10), (0, 10)], close=True, dxfattribs={"color": 7}
    )

    # Add a "sofa" asset on layer ASSET_sofa_R1
    sofa_layer = "ASSET_sofa_R1"
    doc.layers.add(sofa_layer)
    msp.add_lwpolyline(
        [(2, 2), (4, 2), (4, 3), (2, 3)],
        close=True,
        dxfattribs={"layer": sofa_layer, "color": 1},
    )
    msp.add_line((2.5, 2), (3.5, 3), dxfattribs={"layer": sofa_layer, "color": 1})

    # Add a "bed" asset on layer ASSET_bed_R2
    bed_layer = "ASSET_bed_R2"
    doc.layers.add(bed_layer)
    msp.add_lwpolyline(
        [(6, 6), (9, 6), (9, 9), (6, 9)],
        close=True,
        dxfattribs={"layer": bed_layer, "color": 2},
    )

    # Add a "table" asset on layer ASSET_table_R1
    table_layer = "ASSET_table_R1"
    doc.layers.add(table_layer)
    msp.add_lwpolyline(
        [(4, 4), (5, 4), (5, 5), (4, 5)],
        close=True,
        dxfattribs={"layer": table_layer, "color": 3},
    )

    doc.saveas(path)
    return path


@pytest.fixture
def test_dxf(tmp_path):
    """Create a fresh test DXF for each test."""
    path = str(tmp_path / "test_floorplan.dxf")
    return create_test_dxf(path)


class TestListAssets:
    def test_lists_all_assets(self, test_dxf):
        assets = list_assets(test_dxf)
        assert len(assets) == 3
        names = {a["asset_name"] for a in assets}
        assert names == {"sofa", "bed", "table"}

    def test_returns_layer_names(self, test_dxf):
        assets = list_assets(test_dxf)
        layers = {a["layer_name"] for a in assets}
        assert "ASSET_sofa_R1" in layers
        assert "ASSET_bed_R2" in layers
        assert "ASSET_table_R1" in layers

    def test_returns_bboxes(self, test_dxf):
        assets = list_assets(test_dxf)
        sofa = next(a for a in assets if a["asset_name"] == "sofa")
        assert sofa["bbox"] is not None
        assert sofa["bbox"]["min_x"] == pytest.approx(2.0, abs=0.1)
        assert sofa["bbox"]["min_y"] == pytest.approx(2.0, abs=0.1)

    def test_returns_room_ids(self, test_dxf):
        assets = list_assets(test_dxf)
        sofa = next(a for a in assets if a["asset_name"] == "sofa")
        assert sofa["room_id"] == "R1"
        bed = next(a for a in assets if a["asset_name"] == "bed")
        assert bed["room_id"] == "R2"


class TestMoveAsset:
    def test_move_right(self, test_dxf):
        result = move_asset(test_dxf, "ASSET_sofa_R1", dx=2.0, dy=0.0)
        assert result["success"] is True
        assert result["moved_count"] == 2  # polyline + line
        # Verify the sofa moved 2m right
        assert result["new_bbox"]["min_x"] == pytest.approx(4.0, abs=0.1)
        assert result["new_bbox"]["min_y"] == pytest.approx(2.0, abs=0.1)

    def test_move_up_collision(self, test_dxf):
        # Sofa (2,2)-(4,3) moved 3m up -> (2,5)-(4,6) collides with table (4,4)-(5,5)
        # within 0.05m clearance buffer
        result = move_asset(test_dxf, "ASSET_sofa_R1", dx=0.0, dy=3.0)
        assert result["success"] is False
        assert "Collision" in result["error"]

    def test_move_up_safe(self, test_dxf):
        # Sofa (2,2)-(4,3) moved 1m up -> (2,3)-(4,4) — still clear of table at (4,4)-(5,5)
        result = move_asset(test_dxf, "ASSET_sofa_R1", dx=0.0, dy=0.5)
        assert result["success"] is True
        assert result["new_bbox"]["min_y"] == pytest.approx(2.5, abs=0.1)

    def test_move_preserves_others(self, test_dxf):
        # Move the sofa
        move_asset(test_dxf, "ASSET_sofa_R1", dx=2.0, dy=0.0)
        # Check that bed is unchanged
        assets = list_assets(test_dxf)
        bed = next(a for a in assets if a["asset_name"] == "bed")
        assert bed["bbox"]["min_x"] == pytest.approx(6.0, abs=0.1)
        assert bed["bbox"]["min_y"] == pytest.approx(6.0, abs=0.1)

    def test_move_nonexistent_layer(self, test_dxf):
        result = move_asset(test_dxf, "ASSET_piano_R1", dx=1.0, dy=0.0)
        assert result["success"] is False
        assert "No entities found" in result["error"]


class TestRemoveAsset:
    def test_remove_asset(self, test_dxf):
        result = remove_asset(test_dxf, "ASSET_bed_R2")
        assert result["success"] is True
        assert result["removed_count"] == 1  # just the polyline
        # Verify bed is gone
        assets = list_assets(test_dxf)
        names = {a["asset_name"] for a in assets}
        assert "bed" not in names
        assert "sofa" in names
        assert "table" in names

    def test_remove_preserves_room_outline(self, test_dxf):
        remove_asset(test_dxf, "ASSET_bed_R2")
        # Room outline should still exist (on layer "0")
        doc = ezdxf.readfile(test_dxf)
        msp = doc.modelspace()
        layer0_entities = [e for e in msp if e.dxf.layer == "0"]
        assert len(layer0_entities) > 0

    def test_remove_nonexistent(self, test_dxf):
        result = remove_asset(test_dxf, "ASSET_piano_R1")
        assert result["success"] is False


class TestRotateAsset:
    def test_rotate_90(self, test_dxf):
        result = rotate_asset(test_dxf, "ASSET_table_R1", angle=90.0)
        assert result["success"] is True
        assert result["rotated_count"] == 1

    def test_rotate_preserves_others(self, test_dxf):
        rotate_asset(test_dxf, "ASSET_table_R1", angle=45.0)
        assets = list_assets(test_dxf)
        sofa = next(a for a in assets if a["asset_name"] == "sofa")
        assert sofa["bbox"]["min_x"] == pytest.approx(2.0, abs=0.1)


class TestFindAssetLayer:
    def test_find_by_name(self, test_dxf):
        layer = find_asset_layer(test_dxf, "sofa")
        assert layer == "ASSET_sofa_R1"

    def test_find_by_name_and_room(self, test_dxf):
        layer = find_asset_layer(test_dxf, "bed", room_id="R2")
        assert layer == "ASSET_bed_R2"

    def test_find_nonexistent(self, test_dxf):
        layer = find_asset_layer(test_dxf, "piano")
        assert layer is None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
