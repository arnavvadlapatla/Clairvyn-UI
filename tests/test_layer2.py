import ezdxf
import os
import json
import sys
import shutil
from ezdxf import units

TEST_DIR = "tests/layer2_test"
OFFSET_DIR = "tests/temp_core"
ASSET_DIR = os.path.join(TEST_DIR, "assets")
OUTPUT_DIR = os.path.join(TEST_DIR, "output")

def setup_isolated_modules():
    """Copy core modules to a temp dir to avoid src.app dependency hell."""
    if os.path.exists(OFFSET_DIR):
        shutil.rmtree(OFFSET_DIR)
    os.makedirs(OFFSET_DIR)
    
    # Copy files
    src_core = "src/app/core"
    files = ["assemble.py", "asset_assembly.py", "asset_validation.py"]
    for f in files:
        shutil.copy(os.path.join(src_core, f), os.path.join(OFFSET_DIR, f))
        
    # Create init
    with open(os.path.join(OFFSET_DIR, "__init__.py"), "w") as f:
        f.write("")
        
    # Add tests dir to path (parent of temp_core)
    sys.path.append(os.path.abspath("tests"))

def create_rect_dxf(filename, width, height, color=7):
    doc = ezdxf.new()
    doc.units = units.M
    msp = doc.modelspace()
    msp.add_lwpolyline([
        (0, 0), (width, 0), (width, height), (0, height)
    ], close=True, dxfattribs={'color': color})
    msp.add_text("UP", dxfattribs={'height': 0.1}).set_placement((width/2, height*0.9))
    os.makedirs(os.path.dirname(filename), exist_ok=True)
    doc.saveas(filename)

def generate_assets():
    os.makedirs(ASSET_DIR, exist_ok=True)
    create_rect_dxf(os.path.join(ASSET_DIR, "bed.dxf"), 1.8, 2.0, color=1)
    create_rect_dxf(os.path.join(ASSET_DIR, "sidetable.dxf"), 0.5, 0.5, color=2)
    create_rect_dxf(os.path.join(ASSET_DIR, "sofa.dxf"), 2.0, 0.8, color=3)
    create_rect_dxf(os.path.join(ASSET_DIR, "table.dxf"), 1.0, 1.0, color=4)
    create_rect_dxf(os.path.join(ASSET_DIR, "counter.dxf"), 1.0, 0.6, color=5)
    create_rect_dxf(os.path.join(ASSET_DIR, "sink.dxf"), 0.6, 0.4, color=6)
    create_rect_dxf(os.path.join(ASSET_DIR, "bedroom_comp.dxf"), 10, 10, color=250)
    create_rect_dxf(os.path.join(ASSET_DIR, "living_comp.dxf"), 10, 10, color=251)
    create_rect_dxf(os.path.join(ASSET_DIR, "kitchen_comp.dxf"), 10, 10, color=252)

def generate_csv(csv_path):
    # Note: Using absolute paths for assets to avoid resolution issues in isolated mode
    abs_asset = os.path.abspath(ASSET_DIR)
    content = f"""id,name,type,dimensions,position,path
1,Bedroom,Room,10x10,0,{abs_asset}/bedroom_comp.dxf
2,LivingRoom,Room,10x10,0,{abs_asset}/living_comp.dxf
3,Kitchen,Room,10x10,0,{abs_asset}/kitchen_comp.dxf
10,bed,Furniture,1.8x2,0,{abs_asset}/bed.dxf
11,sidetable,Furniture,0.5x0.5,0,{abs_asset}/sidetable.dxf
12,sofa,Furniture,2x0.8,0,{abs_asset}/sofa.dxf
13,table,Furniture,1x1,0,{abs_asset}/table.dxf
14,counter,Furniture,1x0.6,0,{abs_asset}/counter.dxf
15,sink,Furniture,0.6x0.4,0,{abs_asset}/sink.dxf
"""
    with open(csv_path, "w") as f:
        f.write(content)

def generate_structure(json_path):
    structure = {
        "layout": {
            "rooms": [
                {
                    "id": "R1",
                    "rtype": "Bedroom",
                    "polygon": [[0,0], [5,0], [5,6], [0,6]] 
                },
                {
                    "id": "R2",
                    "rtype": "LivingRoom",
                    "polygon": [[5,0], [10,0], [10,5], [5,5]] 
                },
                {
                    "id": "R3",
                    "rtype": "Kitchen",
                    "polygon": [[0,6], [5,6], [5,10], [0,10]] 
                }
            ],
            "connections": []
        }
    }
    with open(json_path, "w") as f:
        json.dump(structure, f, indent=2)

def run_test():
    setup_isolated_modules()
    
    # Import from isolated env
    from temp_core.assemble import FloorPlanAssembler
    
    generate_assets()
    csv_path = os.path.join(TEST_DIR, "data.csv")
    generate_csv(csv_path)
    json_path = os.path.join(TEST_DIR, "structure.json")
    generate_structure(json_path)
    dxf_output = os.path.join(OUTPUT_DIR, "test_output.dxf")
    
    assembler = FloorPlanAssembler(csv_path, ASSET_DIR)
    
    with open(json_path, "r") as f:
        structure_str = f.read()
        
    print("\nRunning Assembly...")
    try:
        assembler.assemble_and_export(structure_str, dxf_output)
        print(f"\nAssembly complete: {dxf_output}")
        if os.path.exists(dxf_output):
            print("PASS: DXF created.")
        else:
            print("FAIL: DXF not created.")
    except Exception as e:
        print(f"Assembly FAILED: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    run_test()
