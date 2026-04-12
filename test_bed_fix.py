import logging
import sys
from shapely.geometry import Polygon
# Add src to path
import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), 'src')))

from src.app.core.asset_validation import asset_to_polygon, validate_asset_inside_room

def test_bed_placement_fix():
    print("Testing Bed Placement Fix...")
    
    # 1. Setup Room (4x3 meters)
    room = Polygon([(0,0), (4,0), (4,3), (0,3)])
    
    # 2. Setup Bed against wall (width 2, height 1.8) at (2, 0) - bottom wall center
    # Note: asset_to_polygon now rotates around center.
    # If we put it at (2, 0.9) it should be fully inside.
    # If we put it at (2, 0) and the anchor was bottom-center, it would be inside.
    # But asset_to_polygon takes (x,y) as translation. 
    # If we want the bed CENTERED at (2, 0.9), we need to correct the input logic or just use known coords.
    
    # Let's test the specific failure mode: Touching the wall.
    # Create a bed polygon that explicitly touches the boundary.
    # Bed centered at x=2, y=0.9 (half height). 
    # Bounds: x(1, 3), y(0, 1.8).
    # Touches y=0 wall.
    
    bed_width = 2.0
    bed_height = 1.8
    # Center position
    cx, cy = 2.0, 0.9
    
    # Manually constructed touching polygon
    bed = Polygon([
        (cx - bed_width/2, cy - bed_height/2), # 1, 0
        (cx + bed_width/2, cy - bed_height/2), # 3, 0
        (cx + bed_width/2, cy + bed_height/2), # 3, 1.8
        (cx - bed_width/2, cy + bed_height/2)  # 1, 1.8
    ])
    
    print(f"Room bounds: {room.bounds}")
    print(f"Bed bounds: {bed.bounds}")
    
    # Check 1: validate_asset_inside_room
    # This was failing because of buffer(-margin).contains()
    valid, reason = validate_asset_inside_room(bed, room, margin=0.05)
    
    if valid:
        print("✅ validate_asset_inside_room: PASSED (Touching wall allowed)")
    else:
        print(f"❌ validate_asset_inside_room: FAILED - {reason}")

    # Check 2: asset_to_polygon rotation fix
    # Rotate 90 degrees around center.
    # Center (2, 0.9). Width 2, Height 1.8.
    # Rotated: Width 1.8, Height 2.
    # Bounds should be approx x(2-0.9, 2+0.9) -> (1.1, 2.9)
    # y(0.9-1, 0.9+1) -> (-0.1, 1.9)
    # Wait, the rotation logic in asset_to_polygon applies translation AFTER rotation?
    # Or does it rotate the box 'at origin' then translate?
    # Let's check the code:
    # poly = box(0, 0, width, height)
    # rotate(origin='center') -> rotates around (w/2, h/2)
    # translate(x, y)
    
    # So if we call asset_to_polygon(x=2, y=0.9, w=2, h=1.8, rot=90)
    # 1. Box(0,0, 2, 1.8). Center(1, 0.9).
    # 2. Rotate 90 around (1, 0.9).
    #    New Center is still (1, 0.9).
    #    New orientation: vertical.
    # 3. Translate(2, 0.9).
    #    Final Center: (1+2, 0.9+0.9) = (3, 1.8).
    
    # This implies (x,y) is a translation vector, not the new center position?
    # If the user provides (x,y) as the target top-left or centroid, the usage depends on the caller.
    # But the FIX was to ensure it rotates around its own center, preventing it from swinging wild.
    
    poly = asset_to_polygon(2, 0, 2, 1.8, 90)
    # Box(0,0, 2, 1.8). Center(1, 0.9).
    # Rot 90 around (1, 0.9).
    # Trans(2, 0).
    # Final Center (3, 0.9).
    # Valid?
    print(f"Rotated asset center: {poly.centroid.coords[0]}")
    
    # Just ensuring it doesn't crash and produces a polygon
    if poly.area > 0:
        print("✅ asset_to_polygon: PASSED (Geometry created)")

if __name__ == "__main__":
    test_bed_placement_fix()
