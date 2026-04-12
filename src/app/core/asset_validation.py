import logging
from shapely.geometry import Polygon, box, LineString, Point
from shapely.validation import make_valid
from shapely.affinity import rotate, translate
import ezdxf
from ezdxf import bbox
from src.app.core.dxf_editor import list_assets, ASSET_LAYER_PREFIX
import re 

# Configure logger
logger = logging.getLogger(__name__)

def asset_to_polygon(x, y, width, height, rotation):
    """
    Creates a polygon representing an asset at (x, y) with dimensions (width, height)
    rotated by `rotation` degrees around its center before translation.
    """
    # Create unrotated box at (0,0) to (width, height)
    poly = box(0, 0, width, height)

    # 1. Rotate around CENTER (width/2, height/2)
    if rotation != 0:
        poly = rotate(poly, rotation, origin='center', use_radians=False)

    # 2. Translate to final position (x corresponds to top-left of unrotated box?)
    # The original function treated (x,y) as the translation offset.
    # If the user intent is placing the asset such that its origin is at (x,y),
    # we just translate.
    # However, standard convention usually implies (x,y) is the centroid or top-left.
    # The previous code did: rotate around (0,0) then translate by (x,y).
    # If we want to rotate around center, we should do that, but what about the position?
    # Let's stick to the requested fix: "rotate around center".
    # But wait, if we rotate around center, the relative position of vertices changes.
    # The user request specifically said: "Rotate assets around their CENTER, not (0,0)"
    
    poly = translate(poly, xoff=x, yoff=y)
    return poly

def create_polygon_from_bbox(bbox):
    """
    Creates a Shapely Polygon from a bounding box tuple (min_x, min_y, max_x, max_y).
    """
    min_x, min_y, max_x, max_y = bbox
    return box(min_x, min_y, max_x, max_y)

def validate_asset_collision(new_asset_poly, existing_assets, clearance=0.02):
    """
    Checks if new_asset_poly overlaps with any in existing_assets.
    """
    # Buffer the new asset for clearance check
    check_poly = new_asset_poly
    if clearance > 0:
        check_poly = new_asset_poly.buffer(clearance)

    for existing in existing_assets:
        if check_poly.intersects(existing):
            return False, "Asset overlaps existing asset"

    return True, None

def validate_wall_clearance(asset_poly, room_poly, allowed_wall=None, clearance=0.02):
    """
    Checks if asset maintains clearance from room walls, ignoring 'allowed_wall'.
    """
    room_boundary = room_poly.boundary
    
    if allowed_wall is not None:
        # allowed_wall should be a geometry (LineString) to subtract
        # simpler: if we know the allowed wall geometry, we explicitly ignore it?
        # shapely difference on Linestrings can be tricky.
        # Let's assume allowed_wall is a geometry to be removed from the boundary check.
        try:
             room_boundary = room_boundary.difference(allowed_wall)
        except Exception:
             # Fallback if boolean op fails, potentially strict checks
             pass

    distance = asset_poly.distance(room_boundary)
    
    # distance() returns min distance.
    if distance < clearance:
        return False, "Asset too close to wall"

    return True, None

def validate_asset_inside_room(asset_poly, room_poly, margin=0.02):
    """
    Checks if asset is strictly inside the room with a margin.
    Allows assets to TOUCH walls but not cross them (using covers).
    """
    # Create inner buffer (negative buffer)
    inner_room = room_poly.buffer(-margin)
    
    # First try strict containment
    if inner_room.contains(asset_poly):
        return True, None

    # Fallback: allow touching walls
    if room_poly.covers(asset_poly):
        return True, None

    return False, "Asset crosses room boundary"

def build_door_swing(hinge_point, radius, start_angle, end_angle):
    """
    Creates a door swing geometry (sector of a circle/buffer).
    However, prompt suggested: Point(hinge).buffer(radius) which is a full circle.
    That is 'conservative full swing envelope'. 
    Let's stick to the prompt's suggestion for simplicity unless direction is easy.
    Prompt: "arc = Point(hinge).buffer(radius, resolution=16)"
    """
    # Use full circular buffer as requested for conservative check
    return Point(hinge_point).buffer(radius, resolution=16)

def validate_door_clearance(asset_poly, door_swings):
    """
    Checks if asset intersects any door swing zones.
    """
    for swing in door_swings:
        if asset_poly.intersects(swing):
            return False, "Asset blocks door swing"
            
    return True, None

def validate_placement(room_polygon_coords, asset_poly_coords, placed_asset_polys, clearance=0.05):
    """
    Legacy validation - keeping for compatibility but logic is now largely redundant 
    if the pipeline is engaged manually. 
    """
    # ... (simplified or delegating)
    # Re-implement using new helpers if possible, or leave as is but 
    # warn it's partial.
    
    # 1. Create geometries
    try:
        room_poly = Polygon(room_polygon_coords)
        if not room_poly.is_valid:
            room_poly = make_valid(room_poly)
            
        asset_poly = Polygon(asset_poly_coords)
        if not asset_poly.is_valid:
            asset_poly = make_valid(asset_poly)

    except Exception as e:
        return False, f"Invalid geometry data: {e}"

    # Use integration of new checks?
    # For now, let's keep the basic check it had, minus the explicit collision code which is now modular.
    # Actually, let's just use validate_asset_inside_room (0 margin default) and collision.
    
    # 2. Check Containment
    valid_inside, reason = validate_asset_inside_room(asset_poly, room_poly, margin=0.0) # 0 for basic
    if not valid_inside:
         # Fallback to covers check if contains failed strictness
         if not room_poly.covers(asset_poly):
              return False, reason
    
    # 3. Check Overlaps using new helper
    is_valid_collision, reason = validate_asset_collision(asset_poly, placed_asset_polys, clearance)
    if not is_valid_collision:
        return False, reason

    return True, "Valid"
def normalize(text):
    return re.findall(r"[a-z0-9]+", text.lower())

def is_wall_attached_asset(target_name, candidates):
    tokens = normalize(target_name)

    for candidate in candidates:
        # direct match
        if candidate in tokens:
            return True

        # partial match (handles "washbasin" vs "wash basin")
        if any(candidate in t or t in candidate for t in tokens):
            return True

    return False 

def validate_edit_rules(dxf_path: str, target_layer: str, room_id: str):
    """
    Checks the layout rules after an asset is modified (moved/rotated).
    Returns a list of warning messages if issues are found.
    """
    issues = []
    
    try:
        doc = ezdxf.readfile(dxf_path)
        msp = doc.modelspace()
    except Exception as e:
        return [f"Could not read DXF for validation: {e}"]

    # 1. Get Room Bounding Box
    room_entities = [
        e
        for e in msp
        if room_id in e.dxf.layer and not e.dxf.layer.startswith(ASSET_LAYER_PREFIX)
    ]
    if room_entities:
        room_ext = bbox.extents(room_entities)
    else:
        # fallback
        room_ext = bbox.extents(msp)
        
    if not room_ext.has_data:
         return ["Could not determine room boundaries."]

    room_min_x, room_min_y = room_ext.extmin.x, room_ext.extmin.y
    room_max_x, room_max_y = room_ext.extmax.x, room_ext.extmax.y
    room_poly = box(room_min_x, room_min_y, room_max_x, room_max_y)

    # 2. Get all assets
    assets = list_assets(dxf_path)
    
    target_asset = next((a for a in assets if a["layer_name"] == target_layer), None)
    if not target_asset or not target_asset.get("bbox"):
        return issues
        
    t_bbox = target_asset["bbox"]
    target_poly = box(t_bbox["min_x"], t_bbox["min_y"], t_bbox["max_x"], t_bbox["max_y"])
    
    # Check 1: Leaving the room definition
    if not room_poly.covers(target_poly):
        issues.append(f"Beyond Room Boundaries: {target_asset['asset_name'].capitalize()} is partially or completely outside the room.")
        
    # Check 2: Colliding with other assets
    for a in assets:
        if a["layer_name"] == target_layer: continue
        if not a.get("bbox"): continue
        
        o_bbox = a["bbox"]
        other_poly = box(o_bbox["min_x"], o_bbox["min_y"], o_bbox["max_x"], o_bbox["max_y"])
        
        # Check intersection
        intersection = target_poly.intersection(other_poly)
        if intersection.area > 0.02: # overlap tolerance of 200 sq cm
            issues.append(f"Collision: {target_asset['asset_name'].capitalize()} overlaps with {a['asset_name'].capitalize()}.")

    # Check 3: Wall attachment for specific items
    wall_attached_assets = ["tv", "toilet", "washbasin", "stove", "sink", "oven", "dishwasher", "fridge", "dresser"]
    if target_asset["asset_name"] in wall_attached_assets:
        dist_to_wall = target_poly.distance(room_poly.exterior)
        if dist_to_wall > 0.25: # > 25cm from wall is not acceptable
            issues.append(f"Guidelines Issue: {target_asset['asset_name']} should remain attached to a wall, but it is placed {dist_to_wall:.2f}m away.")

   
        # Check 3: Wall Clearance (if asset is wall-attached)
        wall_attached_assets = ["tv", "toilet", "washbasin", "stove","sink", "oven", "dishwasher", "fridge", "dresser"
        ]
        if is_wall_attached_asset(target_asset["asset_name"], wall_attached_assets):
            dist_to_wall = target_poly.distance(room_poly.exterior)
            if dist_to_wall > 0.25:
                issues.append(
                    f"Guidelines Issue: {target_asset['asset_name']} should remain attached to a wall, "
                    f"but it is placed {dist_to_wall:.2f}m away."
                )
    return issues
