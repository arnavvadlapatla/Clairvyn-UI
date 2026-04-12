import ezdxf
from shapely.geometry import Polygon
from src.app.core.asset_assembly import AssetAssembler
import os

def create_dummy_asset(filename="dummy_bed.dxf"):
    doc = ezdxf.new()
    msp = doc.modelspace()
    
    # 1. Rectangle (Bed Frame) - LWPOLYLINE
    msp.add_lwpolyline([(0, 0), (2000, 0), (2000, 2000), (0, 2000), (0, 0)])
    
    # 2. Circle (Pillow 1) - CIRCLE
    msp.add_circle((500, 1800), 200)
    
    # 3. Arc (Pillow 2) - ARC
    msp.add_arc((1500, 1800), 200, 0, 180)
    
    # 4. Line (Decoration) - LINE
    msp.add_line((100, 100), (1900, 100))
    
    path = f"data/assets/{filename}"
    os.makedirs("data/assets", exist_ok=True)
    doc.saveas(path)
    print(f"Created dummy asset at {path}")
    return filename

def verify_fix():
    print("--- Starting Verification ---")
    
    # 1. Create Dummy Asset
    asset_file = create_dummy_asset()
    
    # 2. Mock Assembler
    # We need to mock the library to point 'bed' to our dummy file
    assembler = AssetAssembler({}, "data/assets")
    assembler.asset_library['bed'] = asset_file
    assembler.door_swings = [] # Initialize manually as we skip assemble_assets
    
    # 3. Create Output DXF
    out_doc = ezdxf.new()
    msp = out_doc.modelspace()
    
    # 4. Define a Dummy Room
    room_ctx = {
        'id': 'test_room',
        'min_x': 0, 'min_y': 0,
        'max_x': 5, 'max_y': 5, # 5x5 meters
        'width': 5, 'height': 5,
        'polygon': [(0,0), (5,0), (5,5), (0,5)]
    }
    
    print("--- Running Assembly ---")
    # This calls _insert_asset internally
    assembler._assemble_bedroom(msp, room_ctx)
    
    print("--- Assembly Complete ---")
    
    # 5. Check Output Entities
    entity_counts = {}
    for e in msp:
        t = e.dxftype()
        entity_counts[t] = entity_counts.get(t, 0) + 1
        
    print(f"Output Entities: {entity_counts}")
    
    # We expect:
    # 1 LWPOLYLINE (Bed Frame)
    # 1 CIRCLE (Pillow)
    # 1 ARC (Pillow)
    # 1 LINE (Decoration)
    # Plus maybe some others if _assemble_bedroom adds extra stuff (side tables etc)
    
    # Check for specific types we added to dummy asset
    if 'CIRCLE' in entity_counts and 'ARC' in entity_counts and 'LINE' in entity_counts:
        print("PASS: Found CIRCLE, ARC, and LINE in output.")
    else:
        print("FAIL: Missing expected entity types.")

if __name__ == "__main__":
    verify_fix()
