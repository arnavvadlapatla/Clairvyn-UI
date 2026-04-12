from src.app.core.assemble import FloorPlanAssembler
import json
def run_assembly():
    obj={"layout": {"rooms": [{"id": "living_1", "type": "living", "polygon": [[0.0, 0.0], [3.1, 0.0], [3.1, 6.5], [0.0, 6.5]]}, {"id": "kitchen_1", "type": "kitchen", "polygon": [[3.1, 0.0], [7.1, 0.0], [7.1, 3.0], [3.1, 3.0]]}, {"id": "bedroom_1", "type": "bedroom", "polygon": [[3.1, 3.0], [7.1, 3.0], [7.1, 6.5], [3.1, 6.5]]}]}, "total_area": 46.0, "doors": [{"from_room": "living_1", "to_room": "outside", "width": 1.0, "type": "single", "swing": "into_from"}, {"from_room": "living_1", "to_room": "kitchen_1", "width": 1.2, "type": "single", "swing": "into_to"}, {"from_room": "living_1", "to_room": "bedroom_1", "width": 0.9, "type": "single", "swing": "into_to"}], "windows": [{"room_id": "living_1", "width": 3.0, "orientation": "south"}, {"room_id": "kitchen_1", "width": 1.5, "orientation": "east"}, {"room_id": "bedroom_1", "width": 2.0, "orientation": "east"}]}
    structure_json = obj   # your validated JSON
    csv_file = "data/samples/data.csv"
    asset_dir = "data/asset"
    output_dxf = "data/asset/generated_floorplan.dxf"

    assembler = FloorPlanAssembler(
        csv_path=csv_file,
        asset_dir=asset_dir
    )


    assembler.assemble_and_export(json.dumps(obj), output_dxf)
    print("✅ DXF generated successfully!")

if __name__ == "__main__":
    run_assembly()
