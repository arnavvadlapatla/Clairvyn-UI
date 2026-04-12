import ezdxf
from shapely.geometry import Polygon, box
from src.app.core.asset_assembly import AssetAssembler
from unittest.mock import MagicMock
import math

# Mock Assembler to bypass file loading during constraint check
class MockAssembler(AssetAssembler):
    def load_asset(self, asset_name):
        # Return a dummy Ezdxf doc
        doc = ezdxf.new()
        msp = doc.modelspace()
        # Add a dummy rect
        msp.add_lwpolyline([(0,0), (1000,0), (1000,2000), (0,2000), (0,0)])
        return doc

def verify_constraints():
    print("--- Verifying Advanced Constraints ---")
    
    # 1. Setup Room (4m X 6m Vertical)
    room_poly = [(0,0), (4,0), (4,6), (0,6)]
    room_ctx = {
        'id': 'room1',
        'min_x': 0, 'min_y': 0, 
        'max_x': 4, 'max_y': 6,
        'width': 4, 'height': 6,
        'polygon': room_poly
    }
    
    assembler = MockAssembler({}, "data/assets")
    assembler.door_swings = []
    msp = MagicMock()
    
    print("\n[Test 1] Auto-Wall Snapping & Orientation")
    assembler._assemble_bedroom(msp, room_ctx)
    
    # Check placed assets
    if len(assembler.placed_assets) >= 1:
        bed_poly = assembler.placed_assets[0]
        bounds = bed_poly.bounds
        center_x = (bounds[0] + bounds[2])/2
        center_y = (bounds[1] + bounds[3])/2
        print(f"Bed Center: ({center_x:.2f}, {center_y:.2f})")
        
        b_w = bounds[2] - bounds[0]
        b_h = bounds[3] - bounds[1]
        print(f"Bed Bounds Size: {b_w:.2f} x {b_h:.2f}")
        
        # target_w=1.6 (40% width), target_h=3.6 (60% height)
        # Rot 90 -> X span = 3.6, Y span = 1.6
        
        if abs(b_w - 3.6) < 0.1 and abs(b_h - 1.6) < 0.1:
            print("PASS: Bed rotated 90 degrees (Vertical Alignment).")
        else:
            print(f"FAIL: Bed rotation incorrect. Got {b_w}x{b_h}")

    else:
        print("FAIL: Bed not placed.")
        
    print("\n[Test 2] Collision Rejection")
    # Reset and pre-fill obstacle where bed goes
    assembler.placed_assets = []
    obstacle = box(0.5, 2, 3.5, 4) # Box in middle
    assembler.placed_assets.append(obstacle)
    
    print("Attempting to place bed on top of obstacle...")
    assembler._assemble_bedroom(msp, room_ctx)
    
    # Verify no new assets added (count should remain 1)
    if len(assembler.placed_assets) == 1:
        print("PASS: No new assets placed (Collision Rejected).")
    else:
        print(f"FAIL: Assets placed despite collision. Count: {len(assembler.placed_assets)}")

if __name__ == "__main__":
    verify_constraints()
