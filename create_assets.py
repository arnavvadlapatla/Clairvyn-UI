import ezdxf

assets = [
    "bed", "sofa", "table", "counter", "sink", "side_table"
]

for asset in assets:
    doc = ezdxf.new()
    msp = doc.modelspace()
    # Create a 1x1 rectangle as generic placeholder
    msp.add_lwpolyline([(0,0), (100,0), (100,100), (0,100), (0,0)]) 
    doc.saveas(f"data/assets/{asset}.dxf")
    print(f"Created data/assets/{asset}.dxf")
