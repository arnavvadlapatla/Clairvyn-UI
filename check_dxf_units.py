import ezdxf
from pathlib import Path

# CHANGE THIS PATH TO YOUR DXF FILE
DXF_PATH = r"C:\Users\pentyala\tapaswini\Downloads\BED_M(1).dxf"

doc = ezdxf.readfile(DXF_PATH)
header = doc.header

units_code = header.get("$INSUNITS", 0)

units_map = {
    0: "Unitless / Unknown",
    1: "Inches",
    2: "Feet",
    3: "Miles",
    4: "Millimeters",
    5: "Centimeters",
    6: "Meters",
    7: "Kilometers"
}

print("DXF INSUNITS value:", units_code)
print("Detected Units:", units_map.get(units_code, "Unknown"))

# Extra safety: check actual geometry size
msp = doc.modelspace()
xs, ys = [], []

for e in msp:
    if hasattr(e, "bbox"):
        try:
            box = e.bbox()
            if box:
                xs.extend([box.extmin.x, box.extmax.x])
                ys.extend([box.extmin.y, box.extmax.y])
        except:
            pass

if xs and ys:
    width = max(xs) - min(xs)
    height = max(ys) - min(ys)
    print(f"Approx DXF size: {width:.2f} x {height:.2f}")
else:
    print("Could not compute DXF bounding box")
