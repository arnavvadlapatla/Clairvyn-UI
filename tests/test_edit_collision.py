"""
Tests for asset collision detection during edits (move/rotate).
"""

import os
import sys
import pytest
import ezdxf
from ezdxf import units

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.app.core.dxf_editor import (
    move_asset,
    rotate_asset,
)


def create_collision_test_dxf(path):
    """Create a test DXF with two assets close to each other."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    doc = ezdxf.new()
    doc.units = units.M
    msp = doc.modelspace()

    # Asset 1: Sofa at (2, 2) to (4, 3)
    sofa_layer = "ASSET_sofa_R1"
    doc.layers.add(sofa_layer)
    msp.add_lwpolyline(
        [(2, 2), (4, 2), (4, 3), (2, 3)], close=True, dxfattribs={"layer": sofa_layer}
    )

    # Asset 2: Bed at (6, 2) to (9, 5)
    bed_layer = "ASSET_bed_R1"
    doc.layers.add(bed_layer)
    msp.add_lwpolyline(
        [(6, 2), (9, 2), (9, 5), (6, 5)], close=True, dxfattribs={"layer": bed_layer}
    )

    doc.saveas(path)
    return path


@pytest.fixture
def collision_dxf(tmp_path):
    path = str(tmp_path / "collision_test.dxf")
    return create_collision_test_dxf(path)


class TestEditCollision:
    def test_move_collision(self, collision_dxf):
        # Sofa is (2,2)-(4,3). Bed is (6,2)-(9,5).
        # Move sofa 2.5m right -> (4.5,2)-(6.5,3).
        # Since bed starts at x=6, (4.5,2)-(6.5,3) overlaps (6,2)-(9,5)
        # on x range [6, 6.5] and y range [2, 3].

        result = move_asset(collision_dxf, "ASSET_sofa_R1", dx=2.5, dy=0.0)
        assert result["success"] is False
        assert "Collision" in result["error"]

    def test_move_no_collision(self, collision_dxf):
        # Move sofa 1m right -> (3,2)-(5,3). No overlap with bed (starts at 6).
        result = move_asset(collision_dxf, "ASSET_sofa_R1", dx=1.0, dy=0.0)
        assert result["success"] is True

    def test_rotate_collision(self, collision_dxf):
        # Add a small obstacle very close above the sofa for rotation test.
        doc = ezdxf.readfile(collision_dxf)
        msp = doc.modelspace()
        obs_layer = "ASSET_obs_R1"
        doc.layers.add(obs_layer)
        # Place obstacle at (2.5, 3.5) to (3.5, 4.5) — just above the sofa
        msp.add_lwpolyline(
            [(2.5, 3.5), (3.5, 3.5), (3.5, 4.5), (2.5, 4.5)],
            close=True,
            dxfattribs={"layer": obs_layer},
        )
        doc.saveas(collision_dxf)

        # Sofa center is (3, 2.5). Width 2, Height 1.
        # Rotating 90 deg: new bbox becomes (2.5, 1.5) to (3.5, 3.5).
        # Obstacle is at (2.5, 3.5) to (3.5, 4.5).
        # They TOUCH at y=3.5. With 0.05 clearance, it should fail.

        result = rotate_asset(collision_dxf, "ASSET_sofa_R1", angle=90.0)
        assert result["success"] is False
        assert "Collision" in result["error"]

    def test_rotate_no_collision(self, collision_dxf):
        # Rotate sofa 0 deg (no change) — should always succeed
        result = rotate_asset(collision_dxf, "ASSET_sofa_R1", angle=0.0)
        assert result["success"] is True


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
