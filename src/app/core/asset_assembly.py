from annotated_types import doc
import ezdxf
from ezdxf import bbox
from ezdxf.math import Matrix44
import math
import json
from pathlib import Path
from shapely.geometry import Polygon, box, LineString, Point
from shapely.affinity import translate, rotate

from src.app.core import room
from src.app.core import room
from .asset_validation import validate_asset_collision
import logging

class AssetAssembler:
    """
    Handles Layer-2 CAD Asset Assembly.
    Standardizes all input DXFs from mm to meters and anchors them to room logic.
    """
    ASSET_MM = ["balcony_seats", "bed_sgl", "bed_dbl", "bed_king", "bed_queen",
                "bedroom_couch", "coffee_table", "cooktop", "cupboard", "dining_table_s", "dining_table_m", 
                "dining_table_l", "garage_sgl", "garage_dbl", "lamp", "office_desk", "pantry","plant", "shower", 
                "sink_s", "sink", "sofa_s", "sofa_m", "sofa_lshape", "stove", "washer", "washer_unit","iron", 
                "clothesline", "treadmill", "bench1", "stationary_bike", "bench2", "elliptical_trainer", 
                "shoulder_press", "dressing_table", "screen", "theater_couch", "hangers"]
    
    ASSET_IN = ["bathtub", "dishwasher", "dresser", "oven", 
                "fridge", "toilet", "tv", "washbasin"]

    def __init__(self, components, asset_dir):
        self.components = components
        self.asset_dir = asset_dir
        self.placed_assets = []
        self.asset_library = {}
        lib_path = Path("data/assets/asset_library.json")
        if lib_path.exists():
            with open(lib_path) as f:
                self.asset_library = json.load(f)
        else:
            print(f"[Warning] Asset library not found at {lib_path}")


    def _ensure_layer(self, doc, layer_name, color):
        if layer_name not in doc.layers:
            doc.layers.add(layer_name, color=color)


    def assemble_assets(self, msp, rooms_dict, door_swings=None, window_segments=None):
        print(f"\n{'='*70}")
        print(f"STARTING ASSET ASSEMBLY (Mode: Force mm to Meters)")
        print(f"{'='*70}")
        self.door_swings = []
        for item in (door_swings or []):
            if isinstance(item, tuple) and len(item) == 2:
                poly, hinge = item
                self.door_swings.append((poly, hinge))
            else:
                self.door_swings.append(
                    (item, (item.centroid.x, item.centroid.y)))
        self.placed_assets = [] 
        self.window_segments = window_segments or []

        for room_id, room in rooms_dict.items():
            rtype = room.room_type.lower()

            print(f"\n[Processing Room: {room_id} | Type: {rtype}]")

            if 'bedroom' in rtype or 'bed' in rtype:
                self._assemble_bedroom(msp, room)
            elif 'living' in rtype and 'dining' not in rtype:
                self._assemble_living_room(msp, room, dining=True)
            elif 'living' in rtype and 'dining' in rtype:
                self._assemble_living_room(msp, room, dining=False)            
            elif 'kitchen' in rtype:
                self._assemble_kitchen(msp, room)
            elif 'bathroom' in rtype:
                self._assemble_bathroom(msp, room)
            elif 'study' in rtype:
                self._assemble_study(msp, room)
            elif 'balcony' in rtype:
                self._assemble_balcony(msp, room)
            elif 'parking' in rtype:
                self._assemble_parking(msp, room)
            elif 'dining' in rtype:
                self._assemble_dining(msp, room)
            elif 'utility' in rtype:
                self._assemble_utility(msp, room)
            elif 'storage' in rtype:
                self._assemble_storage(msp, room)
            elif 'pantry' in rtype:
                self._assemble_pantry(msp, room)
            elif 'home theater' in rtype:
                self._assemble_home_theater(msp, room)
            elif 'gym' in rtype:
                self._assemble_gym(msp, room)
            elif 'walk in closet' in rtype:
                self._assemble_walk_in_closet(msp, room)
            elif 'library' in rtype:
                self._assemble_library(msp, room)
            elif 'servant room' in rtype:
                self._assemble_servant_room(msp, room)
            elif 'prayer room' in rtype:
                self._assemble_prayer_room(msp, room)
            

    def get_asset_dimensions(self, asset_name):
        doc = self.load_asset(asset_name)
        if not doc:
            return 0.5, 0.5
        cache = bbox.Cache()
        bb = bbox.extents(doc.modelspace(), cache=cache)
        if not bb.has_data:
            print(f"  [!] Warning: Asset {asset_name} has no geometry data.")
            return 0.5, 0.5

        raw_w = bb.extmax.x - bb.extmin.x
        raw_h = bb.extmax.y - bb.extmin.y

        if asset_name in self.ASSET_IN:
            final_w = abs(raw_w * 0.0254)
            final_h = abs(raw_h * 0.0254)
            print(f"  [Unit Log] '{asset_name}': Raw {raw_w:.1f}x{raw_h:.1f}in -> Converted {final_w:.2f}x{final_h:.2f}m")
        elif asset_name in self.ASSET_MM:
            final_w = abs(raw_w * 0.001)
            final_h = abs(raw_h * 0.001)
            print(f"  [Unit Log] '{asset_name}': Raw {raw_w:.1f}x{raw_h:.1f}mm -> Converted {final_w:.2f}x{final_h:.2f}m")
        return final_w, final_h
        

    def load_asset(self, asset_name):
        if asset_name not in self.asset_library:
            return None
        asset_path = Path("data/assets") / self.asset_library[asset_name]
        try:
            return ezdxf.readfile(asset_path)
        except Exception as e:
            print(f"  [Error] Failed to read {asset_name}: {e}")
            return None


    def _assemble_bedroom(self, msp, room):
        """Assets: bed, lamp, bedroom couch, dresser"""

        primary, secondary, tertiary, door_wall = self.resolve_walls(room)

        # Bed
        bed_walls = [w for w in [secondary, tertiary, primary] if w]
        bed_types = ['bed_queen', 'bed_king', 'bed_dbl', 'bed_sgl']
        room_area = (room.width * room.height)
        for bed in bed_types:
            bw, bh = self.get_asset_dimensions(bed)
            asset_area = bw * bh
            if asset_area > room_area * 0.25: 
                print(f"  [Skip] {bed} (size {bw:.2f}x{bh:.2f}m) is too large for room area {room_area:.2f}m²")
                continue
            success, bed_poly = self._try_walls(msp, room, bed, bed_walls, flip=True)
            if success and bed_poly:
                break

        if not success or bed_poly is None:
            print("[WARN] Bed could not be placed")
            return

        if bed_poly:
            lw, lh = self.get_asset_dimensions('lamp')
            minx, miny, maxx, maxy = bed_poly.bounds
            bx = (bed_poly.bounds[0] + bed_poly.bounds[2]) / 2
            by = (bed_poly.bounds[1] + bed_poly.bounds[3]) / 2
            sb_w = bed_poly.bounds[2] - bed_poly.bounds[0]
            sb_h = bed_poly.bounds[3] - bed_poly.bounds[1]
            margin = 0.10

            bed_wall_used = self._actual_wall_of_poly(bed_poly, bed_walls)
            (wx1, wy1), (wx2, wy2) = bed_wall_used
            if abs(wy1 - wy2) < 0.01 and room.center[1] < wy1:  # bed vertical → head at top
                bed_rot = 0 
                hy = maxy - lh/2 - margin
            elif abs(wy1 - wy2) < 0.01 and room.center[1] > wy1:  # bed vertical → head at bottom
                bed_rot = 180
                hy = miny + lh/2 + margin
            elif abs(wx1 - wx2) < 0.01 and room.center[0] < wx1:  # bed horizontal → head on right
                bed_rot = 90
                hx = maxx - lw/2 - margin
            elif abs(wx1 - wx2) < 0.01 and room.center[0] > wx1:  # bed horizontal → head on left
                bed_rot = 270
                hx = minx + lw/2 + margin

            if bed_rot in (0, 180):  # bed up/down → sides are left/right
                lamp_positions = [
                    (bx + sb_w/2 + lw/2 + margin, hy),   # right side
                    (bx - sb_w/2 - lw/2 - margin, hy)    # left side
                ]
            elif bed_rot in (90, 270):  # bed left/right → sides are top/bottom
                lamp_positions = [
                    (hx, by + sb_h/2 + lh/2 + margin),   # top side
                    (hx, by - sb_h/2 - lh/2 - margin)    # bottom side
                ]
            for lx, ly in lamp_positions:
                lamp_poly = box(lx - lw/2, ly - lh/2, lx + lw/2, ly + lh/2)
                if not room.polygon.covers(lamp_poly):
                    continue
                if any(lamp_poly.distance(s) < 0.10 for s, _ in self.door_swings):
                    continue
                ok, _ = validate_asset_collision(lamp_poly, self.placed_assets, clearance=0.05)
                if ok:
                    layer_name = f"ASSET_{'lamp'}_{room.id}"
                    self._write_to_cad(msp, 'lamp', layer_name, lx, ly, 0, lw, lh)
                    self.placed_assets.append(lamp_poly)
                    print(f"  [OK] lamp at ({lx:.2f},{ly:.2f})")

        # Dresser 
        bed_wall_used = self._actual_wall_of_poly(bed_poly, bed_walls)
        dresser_walls = [w for w in room.walls if w]
        self._try_walls(msp, room, 'dresser', dresser_walls)

        # Bedroom couch (if space allows)
        cw, ch = self.get_asset_dimensions('bedroom_couch')
        half_len = cw / 2
        margin = 0.10
        corners = [
            (room.min_x, room.min_y),
            (room.min_x, room.max_y),
            (room.max_x, room.min_y),
            (room.max_x, room.max_y)]

        for cx, cy in corners:        
            if cx == room.min_x:
                x = cx + half_len + margin
            else:
                x = cx - half_len - margin
            if cy == room.min_y:
                y = cy + ch/2 + margin
                rot = 0
            else:
                y = cy - ch/2 - margin
                rot = 180
            couch_poly = box(x - cw/2, y - ch/2, x + cw/2, y + ch/2)

            if not room.polygon.covers(couch_poly):
                continue
            if any(couch_poly.distance(s) < 0.10 for s, _ in self.door_swings):
                continue
            ok, _ = validate_asset_collision(couch_poly, self.placed_assets, clearance=0.15)
            if ok:
                layer_name = f"ASSET_{'bedroom_couch'}_{room.id}"
                self._write_to_cad(msp, 'bedroom_couch', layer_name, x, y, rot, cw, ch)
                self.placed_assets.append(couch_poly)
                print(f"[OK] couch at ({x:.2f},{y:.2f})")
                break


    def _assemble_living_room(self, msp, room, dining=True):
        """Assets: Tv, sofa, lamp, coffee table, dining"""

        primary, secondary, tertiary, door_wall = self.resolve_walls(room)
        rcx, rcy = room.center

        # TV
        all_non_door = sorted(
            [w for w in room.walls if w and w != door_wall],
            key=lambda w: math.hypot(w[1][0]-w[0][0], w[1][1]-w[0][1]),
            reverse=True)
        tv_wall = None
        for w in all_non_door:
            if not self._wall_has_window(w):
                tv_wall = w
                break
        if tv_wall is None:
            tv_wall = all_non_door[0] if all_non_door else primary
        _, tv_poly = self._place_on_wall(msp, room, 'tv', tv_wall)

        # Sofa
        shape = room.room_shape
        sofa_types = ['sofa_lshape', 'sofa_m', 'sofa_s']
        sofa_poly = None

        for sofa_type in sofa_types:
            sw, sh = self.get_asset_dimensions(sofa_type)

            (wx1, wy1), (wx2, wy2) = tv_wall if tv_wall else primary
            is_tv_vertical = abs(wx1 - wx2) < 0.01

            tv_cx = (tv_poly.bounds[0] + tv_poly.bounds[2]) / 2 if tv_poly else (wx1 + wx2) / 2
            tv_cy = (tv_poly.bounds[1] + tv_poly.bounds[3]) / 2 if tv_poly else (wy1 + wy2) / 2

            if is_tv_vertical:
                sofa_rot = 90 if wx1 < rcx else 270
                sofa_cy = tv_cy
                base_x = rcx
                sofa_cx = base_x
            else:
                sofa_rot = 0 if wy1 < rcy else 180
                sofa_cx = tv_cx
                base_y = rcy
                sofa_cy = base_y

            offsets = [0, 0.3, -0.3, 0.6, -0.6, 0.9, -0.9, 1.2, -1.2]  

            for off in offsets:

                if is_tv_vertical:
                    sofa_cx =  base_x + off
                else:
                    sofa_cy = base_y + off

                candidate = box(sofa_cx - sw/2, sofa_cy - sh/2, sofa_cx + sw/2, sofa_cy + sh/2)
                candidate = rotate(candidate, sofa_rot, origin=(sofa_cx, sofa_cy))
                if not room.polygon.covers(candidate):
                    continue
                if any(candidate.distance(s) < 0.10 for s, _ in self.door_swings):
                    continue
                ok, _ = validate_asset_collision(candidate, self.placed_assets, clearance=0.10)
                if ok:
                    layer_name = f"ASSET_{'sofa'}_{room.id}"
                    self._write_to_cad(msp, sofa_type, layer_name, sofa_cx, sofa_cy, sofa_rot, sw, sh)
                    self.placed_assets.append(candidate)
                    sofa_poly = candidate
                    print(f"  [OK] {sofa_type} at ({sofa_cx:.2f},{sofa_cy:.2f}) rot={sofa_rot}")
                    break
            if sofa_poly:
                break

        if sofa_poly is None:
            print("[WARN] Sofa could not be placed")

        # Lamp beside sofa and coffee table
        if sofa_poly:
            lw, lh = self.get_asset_dimensions('lamp')
            cw, ch = self.get_asset_dimensions('coffee_table')
            scx = (sofa_poly.bounds[0] + sofa_poly.bounds[2]) / 2
            scy = (sofa_poly.bounds[1] + sofa_poly.bounds[3]) / 2
            sb_w = sofa_poly.bounds[2] - sofa_poly.bounds[0]
            sb_h = sofa_poly.bounds[3] - sofa_poly.bounds[1]
            margin = 0.10
            gap = 0.20

            if sofa_rot in (0, 180):  # sofa facing up/down → sides are left/right
                lamp_positions = [
                    (scx + sb_w/2 + lw/2 + margin, scy),  
                    (scx - sb_w/2 - lw/2 - margin, scy)    
                ]
                ct_cx = scx
                if sofa_rot == 0:
                    ct_cy = scy - sb_h/2 - ch/2 - gap # sofa facing down → coffee table below
                else:
                    ct_cy = scy + sb_h/2 + ch/2 + gap  # sofa facing up → coffee table above
            elif sofa_rot in (90, 270):  # sofa facing left/right → sides are top/bottom
                lamp_positions = [
                    (scx, scy + sb_h/2 + lh/2 + margin),   
                    (scx, scy - sb_h/2 - lh/2 - margin)   
                ]
                ct_cy = scy
                if sofa_rot == 90:
                    ct_cx = scx - sb_w/2 - cw/2 - gap  # sofa facing left → coffee table on left
                else:
                    ct_cx = scx + sb_w/2 + cw/2 + gap # sofa facing right → coffee table on right

            for lx, ly in lamp_positions:
                lamp_poly = box(lx - lw/2, ly - lh/2, lx + lw/2, ly + lh/2)
                if not room.polygon.covers(lamp_poly):
                    continue
                if any(lamp_poly.distance(s) < 0.10 for s, _ in self.door_swings):
                    continue
                ok, _ = validate_asset_collision(lamp_poly, self.placed_assets, clearance=0.05)
                if ok:
                    layer_name = f"ASSET_{'lamp'}_{room.id}"
                    self._write_to_cad(msp, 'lamp', layer_name, lx, ly, 0, lw, lh)
                    self.placed_assets.append(lamp_poly)
                    print(f"  [OK] lamp at ({lx:.2f},{ly:.2f})")
                    break

            ct_poly = box(ct_cx - cw/2, ct_cy - ch/2, ct_cx + cw/2, ct_cy + ch/2)
            if room.polygon.covers(ct_poly) and not any(ct_poly.distance(s) < 0.15 for s, _ in self.door_swings):
                ok, _ = validate_asset_collision(ct_poly, self.placed_assets, clearance=0.05)
                if ok:
                    layer_name = f"ASSET_{'coffee_table'}_{room.id}"
                    self._write_to_cad(msp, 'coffee_table', layer_name, ct_cx, ct_cy, 0, cw, ch)
                    self.placed_assets.append(ct_poly)
                    print(f"  [OK] coffee_table at ({ct_cx:.2f},{ct_cy:.2f})")

        # Dining table
        if dining:
            dw, dh = self.get_asset_dimensions('dining_table_s')
            dining_walls = [w for w in [tertiary, secondary, primary, door_wall] if w]
            dining_table_poly = None
            for dwall in dining_walls:

                    (dwx1, dwy1), (dwx2, dwy2) = dwall
                    is_vertical = abs(dwx1 - dwx2) < 0.01
                    inward = dh/2 + 0.10

                    if is_vertical:
                        d_cx = dwx1 + (inward if dwx1 < rcx else -inward)
                        d_cy = (dwy1 + dwy2) / 2
                        dt_rot = 90
                    else:
                        d_cx = (dwx1 + dwx2) / 2
                        d_cy = dwy1 + (inward if dwy1 < rcy else -inward)
                        dt_rot = 0

                    dt_poly = box(
                        d_cx - dw/2,
                        d_cy - dh/2,
                        d_cx + dw/2,
                        d_cy + dh/2
                    )

                    if not room.polygon.covers(dt_poly):
                        continue
                    if any(dt_poly.distance(s) < 0.10 for s, _ in self.door_swings):
                        continue
                    ok, _ = validate_asset_collision(dt_poly, self.placed_assets, clearance=0.10)
                    if ok:
                        layer_name = f"ASSET_dining_table_{room.id}"
                        self._write_to_cad(msp, dining, layer_name, d_cx, d_cy, dt_rot, dw, dh)
                        self.placed_assets.append(dt_poly)
                        dining_table_poly = dt_poly
                        print(f"  [OK] dining_table at ({d_cx:.2f},{d_cy:.2f})")
                        break
                    if dining_table_poly:
                        break

            if not dining_table_poly:
                print("[WARN] Dining table could not be placed")                 


    def _assemble_kitchen(self, msp, room):
        """Assets: Sink, stove, oven, dishwasher, fridge"""

        primary, secondary, tertiary, door_wall = self.resolve_walls(room)

        non_door_walls = sorted(
            [w for w in room.walls if w != door_wall and w is not None],
            key=lambda w: math.hypot(w[1][0]-w[0][0], w[1][1]-w[0][1]),
            reverse=True
        )
        
        back_wall = self._get_opposite_wall(room, door_wall) or non_door_walls[0] # Back wall = opposite door, for sink+stove+oven
        side_walls = [w for w in non_door_walls if w != back_wall] # Side walls for dishwasher and fridge

        # Sink, stove, oven sequentially on back wall 
        (wx1, wy1), (wx2, wy2) = back_wall
        is_vertical = abs(wx1 - wx2) < 0.01
        next_pos = (min(wy1, wy2) if is_vertical else min(wx1, wx2)) + 0.4

        for asset in ['sink', 'stove', 'oven']:
            ok, poly = self._place_on_wall(msp, room, asset, back_wall, preferred_along=next_pos)
            if ok and poly:
                b = poly.bounds
                next_pos = (b[3] if is_vertical else b[2]) + 0.1
            else:
                print(f"  [WARN] {asset} could not fit on back wall")

        # Dishwasher on a side wall 
        if side_walls:
            ok, _ = self._try_walls(msp, room, 'dishwasher', side_walls)
            if not ok:
                self._place_on_wall(msp, room, 'dishwasher', back_wall, preferred_along=next_pos)
        else:
            self._place_on_wall(msp, room, 'dishwasher', back_wall, preferred_along=next_pos)

        # Fridge on side wall near door (end closest to door wall)
        if side_walls:
            fridge_wall = side_walls[0]
            (fx1, fy1), (fx2, fy2) = fridge_wall
            is_fv = abs(fx1 - fx2) < 0.01
            # Place fridge at the end of the side wall nearest the door wall
            if door_wall:
                (dx1, dy1), (dx2, dy2) = door_wall
                door_coord = (dy1 + dy2) / 2 if is_fv else (dx1 + dx2) / 2
                wall_start = min(fy1, fy2) if is_fv else min(fx1, fx2)
                wall_end = max(fy1, fy2) if is_fv else max(fx1, fx2)
                fridge_pos = wall_start + 0.5 if abs(door_coord - wall_start) < abs(door_coord - wall_end) else wall_end - 0.5
            else:
                fridge_pos = None
            ok, _ = self._place_on_wall(msp, room, 'fridge', fridge_wall, preferred_along=fridge_pos)
            if not ok:
                self._try_walls(msp, room, 'fridge', non_door_walls, flip=True)
        else:
            self._try_walls(msp, room, 'fridge', non_door_walls)


    def _assemble_bathroom(self, msp, room):
        """Assets: Washbasin, toilet, shower, bathtub(optional)"""

        primary, secondary, tertiary, door_wall = self.resolve_walls(room)

        all_non_door = sorted(
            [w for w in room.walls if w != door_wall and w is not None],
            key=lambda w: math.hypot(w[1][0]-w[0][0], w[1][1]-w[0][1]),
            reverse=True
        )
        if not all_non_door:
            return

        room_w = room.max_x - room.min_x
        room_h = room.max_y - room.min_y
        long_wall = all_non_door[0]

        (wx1, wy1), (wx2, wy2) = long_wall
        is_vertical = abs(wx1 - wx2) < 0.01

        start_pos = (min(wy1, wy2) if is_vertical else min(wx1, wx2)) + 0.1
        end_pos   = (max(wy1, wy2) if is_vertical else max(wx1, wx2)) - 0.1
        next_pos = start_pos

        # Washbasin
        ok, poly = self._place_on_wall(msp, room, 'washbasin', long_wall, preferred_along=next_pos, flip=True)
        if ok and poly:
            b = poly.bounds
            next_pos = (max(b[1], b[3]) if is_vertical else max(b[0], b[2])) + 0.10
        else:
            print("[WARN] Washbasin could not be placed")

        # Toilet
        ok, poly = self._place_on_wall(msp, room, 'toilet', long_wall, preferred_along=next_pos, flip=True)
        if ok and poly:
            b = poly.bounds
            next_pos = (max(b[1], b[3]) if is_vertical else max(b[0], b[2])) + 0.10
        else:
            if len(all_non_door) > 1:
                ok, _ = self._place_on_wall(msp, room, 'toilet', all_non_door[1], preferred_along=None, flip=True)
            if not ok:
                print("[WARN] Toilet could not be placed")

        # Shower (ensure 350mm clearance on both sides of center)
        shower_half_zone = 0.35
        left_limit = next_pos + shower_half_zone
        right_limit = end_pos - shower_half_zone

        if left_limit <= right_limit:
            shower_center = right_limit   # push it toward corner but still valid
            ok, poly = self._place_on_wall(msp, room, 'shower', long_wall, preferred_along=shower_center)
            if not ok:
                print("[WARN] Shower could not be placed on long wall")
        else:
            print("[WARN] Not enough space for shower zone")

        # Bathtub — only if room is wide enough (bathtub is 0.762m deep)
        if min(room_w, room_h) >= 0.95:
            # Try secondary wall first (On different wall than toilet/washbasin)
            tub_walls = (all_non_door[1:] if len(all_non_door) > 1 else []) + [all_non_door[0]]
            ok, _ = self._try_walls(msp, room, 'bathtub', tub_walls)
            if not ok:
                print("[WARN] Bathtub could not be placed")
        else:
            print(f"[SKIP] Bathtub — room {room_w:.1f}x{room_h:.1f}m too narrow")


    def _assemble_study(self, msp, room):
        """Assets: Office desk, cupboard, lamp, bedroom couch"""

        primary, secondary, tertiary, door_wall = self.resolve_walls(room)

        # Office desk
        bed_walls = [w for w in [secondary, tertiary, primary] if w]
        success, bed_poly = self._try_walls(msp, room, 'office_desk', bed_walls, flip=True)

        if not success or bed_poly is None:
            print("[WARN] Office desk could not be placed")
            return

        if bed_poly:
            lw, lh = self.get_asset_dimensions('lamp')
            minx, miny, maxx, maxy = bed_poly.bounds
            bx = (bed_poly.bounds[0] + bed_poly.bounds[2]) / 2
            by = (bed_poly.bounds[1] + bed_poly.bounds[3]) / 2
            sb_w = bed_poly.bounds[2] - bed_poly.bounds[0]
            sb_h = bed_poly.bounds[3] - bed_poly.bounds[1]
            margin = 0.10

            bed_wall_used = self._actual_wall_of_poly(bed_poly, bed_walls)
            (wx1, wy1), (wx2, wy2) = bed_wall_used
            if abs(wy1 - wy2) < 0.01 and room.center[1] < wy1:  # bed vertical → head at top
                bed_rot = 180
                hy = maxy - lh/2 - margin
            elif abs(wy1 - wy2) < 0.01 and room.center[1] >= wy1:  # bed vertical → head at bottom
                bed_rot = 0
                hy = miny + lh/2 + margin
            elif abs(wx1 - wx2) < 0.01 and room.center[0] < wx1:  # bed horizontal → head on right
                bed_rot = 270
                hx = maxx - lw/2 - margin
            elif abs(wx1 - wx2) < 0.01 and room.center[0] >= wx1:  # bed horizontal → head on left
                bed_rot = 90
                hx = minx + lw/2 + margin

            if bed_rot in (0, 180):  # bed up/down → sides are left/right
                lamp_positions = [
                    (bx + sb_w/2 + lw/2 + margin, hy),   # right side
                    (bx - sb_w/2 - lw/2 - margin, hy)    # left side
                ]
            elif bed_rot in (90, 270):  # bed left/right → sides are top/bottom
                lamp_positions = [
                    (hx, by + sb_h/2 + lh/2 + margin),   # top side
                    (hx, by - sb_h/2 - lh/2 - margin)    # bottom side
                ]
            for lx, ly in lamp_positions:
                lamp_poly = box(lx - lw/2, ly - lh/2, lx + lw/2, ly + lh/2)
                if not room.polygon.covers(lamp_poly):
                    continue
                if any(lamp_poly.distance(s) < 0.10 for s, _ in self.door_swings):
                    continue
                ok, _ = validate_asset_collision(lamp_poly, self.placed_assets, clearance=0.05)
                if ok:
                    layer_name = f"ASSET_{'lamp'}_{room.id}"
                    self._write_to_cad(msp, 'lamp', layer_name, lx, ly, 0, lw, lh)
                    self.placed_assets.append(lamp_poly)
                    print(f"  [OK] lamp at ({lx:.2f},{ly:.2f})")

        # Cupboard
        cupboard_walls = [w for w in room.walls if w]
        self._try_walls(msp, room, 'cupboard', cupboard_walls)

        # Bedroom couch (if space allows)
        cw, ch = self.get_asset_dimensions('bedroom_couch')
        half_len = cw / 2
        margin = 0.10
        corners = [
            (room.min_x, room.min_y),
            (room.min_x, room.max_y),
            (room.max_x, room.min_y),
            (room.max_x, room.max_y)]

        for cx, cy in corners:        
            if cx == room.min_x:
                x = cx + half_len + margin
            else:
                x = cx - half_len - margin
            if cy == room.min_y:
                y = cy + ch/2 + margin
                rot = 0
            else:
                y = cy - ch/2 - margin
                rot = 180
            couch_poly = box(x - cw/2, y - ch/2, x + cw/2, y + ch/2)

            if not room.polygon.covers(couch_poly):
                continue
            if any(couch_poly.distance(s) < 0.10 for s, _ in self.door_swings):
                continue
            ok, _ = validate_asset_collision(couch_poly, self.placed_assets, clearance=0.15)
            if ok:
                layer_name = f"ASSET_{'bedroom_couch'}_{room.id}"
                self._write_to_cad(msp, 'bedroom_couch', layer_name, x, y, rot, cw, ch)
                self.placed_assets.append(couch_poly)
                print(f"[OK] couch at ({x:.2f},{y:.2f})")
                break


    def _assemble_balcony(self, msp, room):
        primary, secondary, tertiary, door_wall = self.resolve_walls(room)
        if door_wall is None:
            ext_wall = primary or secondary
        else:
            ext_wall = self._get_opposite_wall(room, door_wall)
            if ext_wall is None:
                ext_wall = primary or secondary
        if ext_wall is None:
            print("[WARN] Balcony: no usable outer wall found, skipping asset placement")
            return
        
        # balcony plants
        pw, ph = self.get_asset_dimensions('plant')
        gap = 0.10

        (wx1, wy1), (wx2, wy2) = ext_wall
        is_vertical = abs(wx1 - wx2) < 0.01
        next_pos = (min(wy1, wy2) if is_vertical else min(wx1, wx2)) + 0.2

        l = ['plant'] * 10
        for asset in l:
            ok, poly = self._place_on_wall(msp, room, asset, ext_wall, preferred_along=next_pos)
            if ok and poly:
                b = poly.bounds
                next_pos = (b[3] if is_vertical else b[2]) + 0.10
            else:
                print(f"  [WARN] {asset} could not fit on exterior wall")

        # balcony chairs
        rcx, rcy = room.center
        sw, sh = self.get_asset_dimensions('balcony_seats')
        seat_poly = box(rcx - sw/2, rcy - sh/2, rcx + sw/2, rcy + sh/2)
        if room.polygon.covers(seat_poly) and not any(seat_poly.distance(s) < 0.15 for s, _ in self.door_swings):
            ok, _ = validate_asset_collision(seat_poly, self.placed_assets, clearance=0.05)
            if ok:
                layer_name = f"ASSET_{'balcony_seats'}_{room.id}"
                self._write_to_cad(msp, 'balcony_seats', layer_name, rcx, rcy, 0, sw, sh)
                self.placed_assets.append(seat_poly)
                print(f"  [OK] balcony_seats at ({rcx:.2f},{rcy:.2f})")
            else:
                print("[WARN] Balcony seats placement collides with existing asset")
        else:
            print("[WARN] Balcony seats do not fit within balcony")


    def _assemble_parking(self, msp, room):
        """Assets: Garage (double or single based on space)"""

        primary, secondary, tertiary, door_wall = self.resolve_walls(room)
        rcx, rcy = room.center
        garage_types = ['garage_dbl', 'garage_sgl']
        parking_poly = None

        # garage
        for garage in garage_types:
            sw, sh = self.get_asset_dimensions(garage)   
            for w, h, angle in [(sw, sh, 0), (sh, sw, 90)]:         
                garage_poly = box(rcx - w/2, rcy - h/2, rcx + w/2, rcy + h/2)
                if room.polygon.covers(garage_poly) and not any(garage_poly.distance(s) < 0.15 for s, _ in self.door_swings):
                    ok, _ = validate_asset_collision(garage_poly, self.placed_assets, clearance=0.05)
                    if ok:
                        layer_name = f"ASSET_{'garage'}_{room.id}"
                        self._write_to_cad(msp, garage, layer_name, rcx, rcy, angle, w, h)
                        self.placed_assets.append(garage_poly)
                        parking_poly = garage_poly
                        print(f"  [OK] garage at ({rcx:.2f},{rcy:.2f})")
                        break
                if parking_poly:
                    break
        if not parking_poly:
            print("[WARN] Garage could not be placed")


    def _assemble_dining(self, msp, room):
        """Assets: Dining table"""
        rcx, rcy = room.center
        primary, secondary, tertiary, door_wall = self.resolve_walls(room)
        dining_types = ['dining_table_l', 'dining_table_m', 'dining_table_s']
        dining_table_poly = None

        for dining in dining_types:
            dw, dh = self.get_asset_dimensions(dining)
            dining_walls = [w for w in [tertiary, secondary, primary, door_wall] if w]

            for dwall in dining_walls:
                (dwx1, dwy1), (dwx2, dwy2) = dwall
                is_vertical = abs(dwx1 - dwx2) < 0.01
                inward = dh/2 + 0.10

                if is_vertical:
                    d_cx = dwx1 + (inward if dwx1 < rcx else -inward)
                    d_cy = (dwy1 + dwy2) / 2
                    dt_rot = 90
                else:
                    d_cx = (dwx1 + dwx2) / 2
                    d_cy = dwy1 + (inward if dwy1 < rcy else -inward)
                    dt_rot = 0

                dt_poly = box(
                    d_cx - dw/2,
                    d_cy - dh/2,
                    d_cx + dw/2,
                    d_cy + dh/2
                )

                if not room.polygon.covers(dt_poly):
                    continue
                if any(dt_poly.distance(s) < 0.10 for s, _ in self.door_swings):
                    continue
                ok, _ = validate_asset_collision(dt_poly, self.placed_assets, clearance=0.10)
                if ok:
                    layer_name = f"ASSET_dining_table_{room.id}"
                    self._write_to_cad(msp, dining, layer_name, d_cx, d_cy, dt_rot, dw, dh)
                    self.placed_assets.append(dt_poly)
                    dining_table_poly = dt_poly
                    print(f"  [OK] dining_table at ({d_cx:.2f},{d_cy:.2f})")
                    break
            if dining_table_poly:
                break

        if not dining_table_poly:
            print("[WARN] Dining table could not be placed")             
    

    def _assemble_utility(self, msp, room):
        """Assets: Sink, washer, cupboard, cooktop"""

        primary, secondary, tertiary, door_wall = self.resolve_walls(room)

        non_door_walls = sorted(
            [w for w in room.walls if w != door_wall and w is not None],
            key=lambda w: math.hypot(w[1][0]-w[0][0], w[1][1]-w[0][1]),
            reverse=True
        )
        
        back_wall = self._get_opposite_wall(room, door_wall) or non_door_walls[0]
        side_walls = [w for w in non_door_walls if w != back_wall]

        (wx1, wy1), (wx2, wy2) = back_wall
        is_vertical = abs(wx1 - wx2) < 0.01
        next_pos = (min(wy1, wy2) if is_vertical else min(wx1, wx2)) + 0.3

        # washer
        ok, poly = self._place_on_wall(msp, room, 'washer', back_wall, preferred_along=next_pos)
        if ok and poly:
            next_pos = (poly.bounds[3] if is_vertical else poly.bounds[2]) + 0.2
        else:
            print(f"  [WARN] Washer could not fit on back wall")
      
        # ironing board, clothesline, cupboard on walls 
        for asset in ['iron', 'clothesline']:
            ok, poly = self._try_walls(msp, room, asset, side_walls)
            if not ok:
                success, poly = self._place_on_wall(msp, room, asset, back_wall, preferred_along=next_pos)
                if success and poly:
                    next_pos += (poly.bounds[3] if is_vertical else poly.bounds[2]) + 0.2
        else:
            print(f"  [WARN] {asset} could not be placed on utility room walls")


    def _assemble_storage(self, msp, room):
        """Assets: Pantry, cupboard, cooktop, dresser"""

        primary, secondary, tertiary, door_wall = self.resolve_walls(room)

        non_door_walls = sorted(
            [w for w in room.walls if w != door_wall and w is not None],
            key=lambda w: math.hypot(w[1][0]-w[0][0], w[1][1]-w[0][1]),
            reverse=True
        )
        
        back_wall = self._get_opposite_wall(room, door_wall) or non_door_walls[0]
        side_walls = [w for w in non_door_walls if w != back_wall]

        (wx1, wy1), (wx2, wy2) = back_wall
        is_vertical = abs(wx1 - wx2) < 0.01
        next_pos = (min(wy1, wy2) if is_vertical else min(wx1, wx2)) + 0.4

        for asset in ['pantry', 'cupboard', 'cooktop', 'dresser']:
            ok, poly = self._place_on_wall(msp, room, asset, back_wall, preferred_along=next_pos)
            if ok and poly:
                b = poly.bounds
                next_pos = (b[3] if is_vertical else b[2]) + 0.1
            else:
                print(f"  [WARN] {asset} could not fit on back wall")
    

    def _assemble_pantry(self, msp, room):
        """Assets: Pantry, cupboard, cooktop, dresser"""

        primary, secondary, tertiary, door_wall = self.resolve_walls(room)

        non_door_walls = sorted(
            [w for w in room.walls if w != door_wall and w is not None],
            key=lambda w: math.hypot(w[1][0]-w[0][0], w[1][1]-w[0][1]),
            reverse=True
        )
        
        back_wall = self._get_opposite_wall(room, door_wall) or non_door_walls[0]
        side_walls = [w for w in non_door_walls if w != back_wall]

        (wx1, wy1), (wx2, wy2) = back_wall
        is_vertical = abs(wx1 - wx2) < 0.01
        next_pos = (min(wy1, wy2) if is_vertical else min(wx1, wx2)) + 0.4

        for asset in ['pantry', 'cupboard', 'pantry']:
            ok, poly = self._place_on_wall(msp, room, asset, back_wall, preferred_along=next_pos)
            if ok and poly:
                b = poly.bounds
                next_pos = (b[3] if is_vertical else b[2]) + 0.1
            else:
                print(f"  [WARN] {asset} could not fit on back wall")
    

    def _assemble_home_theater(self, msp, room):

        primary, secondary, tertiary, door_wall = self.resolve_walls(room)

        # screen 
        all_non_door = sorted(
            [w for w in room.walls if w and w != door_wall],
            key=lambda w: math.hypot(w[1][0]-w[0][0], w[1][1]-w[0][1]),
            reverse=True)

        _, screen_poly = self._try_walls(msp, room, 'screen', all_non_door)

        if screen_poly:
            screen_wall = self._actual_wall_of_poly(screen_poly, all_non_door)

        # theater couch
        rcx, rcy = room.center
        sw, sh = self.get_asset_dimensions('theater_couch')

        if screen_poly:
            (wx1, wy1), (wx2, wy2) = screen_wall 
            is_vertical = abs(wx1 - wx2) < 0.01

            screen_cx = (screen_poly.bounds[0] + screen_poly.bounds[2]) / 2
            screen_cy = (screen_poly.bounds[1] + screen_poly.bounds[3]) / 2

            if is_vertical:
                sofa_rot = 90 if wx1 < rcx else 270
                depth_dir = 1 if wx1 < rcx else -1
                seat_axis = "y"
            else:
                sofa_rot = 0 if wy1 < rcy else 180
                depth_dir = 1 if wy1 < rcy else -1
                seat_axis = "x"

            seat_gap = 0.06
            row_gap = sh + 0.30
            back_clearance = 0.40

            row = 0

            while True:
                if is_vertical:
                    cx = screen_cx + depth_dir * (row + 1) * row_gap
                    cy = screen_cy
                else:
                    cx = screen_cx
                    cy = screen_cy + depth_dir * (row + 1) * row_gap
                base = box(cx - sw/2, cy - sh/2, cx + sw/2, cy + sh/2)
                if not room.polygon.buffer(-back_clearance).covers(base):
                    break

                seat = 0
                while True:
                    offset = seat * (sw + seat_gap)
                    directions = [0] if seat == 0 else [1, -1]
                    placed_any = False

                    for d in directions:
                        if seat_axis == "y":
                            sx = cx
                            sy = cy + d * offset
                        else:
                            sx = cx + d * offset
                            sy = cy
                        candidate = box(sx - sw/2, sy - sh/2, sx + sw/2, sy + sh/2)
                        candidate = rotate(candidate, sofa_rot, origin=(sx, sy))
                        if not room.polygon.covers(candidate):
                            continue
                        if any(candidate.distance(s) < 0.10 for s, _ in self.door_swings):
                            continue
                        ok, _ = validate_asset_collision(candidate, self.placed_assets, clearance=0.10)

                        if ok:
                            layer = f"ASSET_theater_couch_{room.id}"
                            self._write_to_cad(msp,'theater_couch', layer, sx, sy, sofa_rot, sw, sh)
                            self.placed_assets.append(candidate)
                            placed_any = True

                    if not placed_any and seat > 0:
                        print(f"  [WARN] Could not place any theater_couch in {room.id}")
                        break
                    seat += 1
                row += 1


    def _assemble_gym(self, msp, room):
        primary, secondary, tertiary, door_wall = self.resolve_walls(room)

        clearance = 0.2

        non_door_walls = sorted(
            [w for w in room.walls if w != door_wall and w is not None],
            key=lambda w: math.hypot(w[1][0]-w[0][0], w[1][1]-w[0][1]),
            reverse=True
        )

        for asset in ['treadmill', 'bench1', 'stationary_bike', 'bench2', 'elliptical_trainer', 'shoulder_press']:
            ok, poly = self._try_walls(msp, room, asset, non_door_walls)
            if ok:
                room.occupied.append(poly.buffer(clearance))
            else:
                print(f"  [WARN] {asset} could not be placed on utility room walls")
    

    def _assemble_walk_in_closet(self, msp, room):
        """Assets: Full closet"""

        depth = 0.6        
        door_clear = 1.0
        hanger_spacing = 0.2

        primary, secondary, tertiary, door_wall = self.resolve_walls(room)

        if not room.polygon_coords:
            return
        room_poly = Polygon(room.polygon_coords)
        if not room_poly.is_valid:
            return
        
        inner = room_poly.buffer(-depth, join_style=2)
        clothesline = room_poly.buffer(-depth/2, join_style=2)
        if inner.is_empty or clothesline.is_empty:
            return
        if inner.geom_type == "MultiPolygon":
            inner = max(inner.geoms, key=lambda g: g.area)
        if clothesline.geom_type == "MultiPolygon":
            clothesline = max(clothesline.geoms, key=lambda g: g.area)       

        closet_strip = room_poly.difference(inner)
        if closet_strip.is_empty:
            return
        rail_line = clothesline.exterior
        if door_wall:
            (x1, y1), (x2, y2) = door_wall
            door_line = LineString([(x1, y1), (x2, y2)])
            door_zone = door_line.buffer(door_clear, cap_style=2)
            closet_strip = closet_strip.difference(door_zone)
            rail_line = rail_line.difference(door_zone)
            if closet_strip.is_empty:
                return

        if closet_strip.geom_type == "MultiPolygon":
            closet_strip = max(closet_strip.geoms, key=lambda g: g.area)
        if rail_line.geom_type == "MultiLineString":
            lines = rail_line.geoms
        else:
            lines = [rail_line]

        pts = list(closet_strip.exterior.coords)
        msp.add_lwpolyline(pts, close=True, dxfattribs={"layer": f"ASSET_closet_{room.id}", "color": 4})
        for ln in lines:
            msp.add_lwpolyline(list(ln.coords), dxfattribs={"layer": f"ASSET_closet_{room.id}", "color": 4})

        positions = []
        for ln in lines:
            length = ln.length
            d = 0
            while d < length:
                pt = ln.interpolate(d)
                x = pt.x
                y = pt.y
                p2 = ln.interpolate(min(d+0.05, length))
                angle = math.degrees(math.atan2(p2.y - pt.y, p2.x - pt.x))
                positions.append((x, y, angle))
                d += hanger_spacing
                
        hw, hh = self.get_asset_dimensions('hangers')
        for x, y, angle in positions:
            poly = box(x - hw/2, y - hh/2, x + hw/2, y + hh/2)
            if not room.polygon.covers(poly):
                continue
            if not closet_strip.covers(poly):
                continue
            if not clothesline.covers(poly):
                continue
            if any(poly.distance(s) < 0.10 for s, _ in self.door_swings):
                continue
            ok, _ = validate_asset_collision(poly, self.placed_assets, clearance=0.05)
            if ok:
                layer_name = f"ASSET_{'closet'}_{room.id}"
                self._write_to_cad(msp, 'hangers', layer_name, x, y, angle, hw, hh)
                self.placed_assets.append(poly)
                print(f"  [OK] hangers at ({x:.2f},{y:.2f})")

        print(f"[OK] walk-in closet in {room.id}")


    def _assemble_library(self, msp, room):
        return


    def _assemble_servant_room(self, msp, room):
        """Assets: bed, lamp, cupboard"""

        primary, secondary, tertiary, door_wall = self.resolve_walls(room)

        # Bed
        bed_walls = [w for w in [secondary, tertiary, primary] if w]
        success, bed_poly = self._try_walls(msp, room, 'bed_sgl', bed_walls, flip=True)
        if not success or bed_poly is None:
            print("[WARN] Bed could not be placed")
            return

        # lamp
        if bed_poly:
            lw, lh = self.get_asset_dimensions('lamp')
            minx, miny, maxx, maxy = bed_poly.bounds
            bx = (bed_poly.bounds[0] + bed_poly.bounds[2]) / 2
            by = (bed_poly.bounds[1] + bed_poly.bounds[3]) / 2
            sb_w = bed_poly.bounds[2] - bed_poly.bounds[0]
            sb_h = bed_poly.bounds[3] - bed_poly.bounds[1]
            margin = 0.10

            bed_wall_used = self._actual_wall_of_poly(bed_poly, bed_walls)
            (wx1, wy1), (wx2, wy2) = bed_wall_used
            if abs(wy1 - wy2) < 0.01 and room.center[1] < wy1:  # bed vertical → head at top
                bed_rot = 0 
                hy = maxy - lh/2 - margin
            elif abs(wy1 - wy2) < 0.01 and room.center[1] > wy1:  # bed vertical → head at bottom
                bed_rot = 180
                hy = miny + lh/2 + margin
            elif abs(wx1 - wx2) < 0.01 and room.center[0] < wx1:  # bed horizontal → head on right
                bed_rot = 90
                hx = maxx - lw/2 - margin
            elif abs(wx1 - wx2) < 0.01 and room.center[0] > wx1:  # bed horizontal → head on left
                bed_rot = 270
                hx = minx + lw/2 + margin

            if bed_rot in (0, 180):  # bed up/down → sides are left/right
                lamp_positions = [
                    (bx + sb_w/2 + lw/2 + margin, hy),   # right side
                    (bx - sb_w/2 - lw/2 - margin, hy)    # left side
                ]
            elif bed_rot in (90, 270):  # bed left/right → sides are top/bottom
                lamp_positions = [
                    (hx, by + sb_h/2 + lh/2 + margin),   # top side
                    (hx, by - sb_h/2 - lh/2 - margin)    # bottom side
                ]
            for lx, ly in lamp_positions:
                lamp_poly = box(lx - lw/2, ly - lh/2, lx + lw/2, ly + lh/2)
                if not room.polygon.covers(lamp_poly):
                    continue
                if any(lamp_poly.distance(s) < 0.10 for s, _ in self.door_swings):
                    continue
                ok, _ = validate_asset_collision(lamp_poly, self.placed_assets, clearance=0.05)
                if ok:
                    layer_name = f"ASSET_{'lamp'}_{room.id}"
                    self._write_to_cad(msp, 'lamp', layer_name, lx, ly, 0, lw, lh)
                    self.placed_assets.append(lamp_poly)
                    print(f"  [OK] lamp at ({lx:.2f},{ly:.2f})")

        # cupboard
        bed_wall_used = self._actual_wall_of_poly(bed_poly, bed_walls)
        dresser_walls = [w for w in room.walls if w]
        self._try_walls(msp, room, 'cupboard', dresser_walls)


    def _assemble_prayer_room(self, msp, room):
        return
    

    def _find_door_wall(self, room):
        """Return the wall containing door"""

        if not self.door_swings:
            return None
        from shapely.geometry import LineString, Point
        best_wall = None
        best_dist = float('inf')
        for _swing_poly, hinge in self.door_swings:
            hinge_pt = Point(hinge)
            if not room.polygon.buffer(0.05).covers(hinge_pt):
                continue
            for wall in room.walls:
                wall_line = LineString([wall[0], wall[1]])
                d = wall_line.distance(hinge_pt)
                if d < best_dist:
                    best_dist = d
                    best_wall = wall
        return best_wall if best_dist < 0.20 else None


    def _get_opposite_wall(self, room, wall):
        """Return the wall roughly opposite to the given wall (same orientation, other side of room center)."""

        if wall is None:
            return None
        (x1, y1), (x2, y2) = wall
        is_horiz = abs(y1 - y2) < 0.01
        cx, cy = room.center
        wmid_x, wmid_y = (x1 + x2) / 2, (y1 + y2) / 2
        best, best_len = None, -1
        for w in room.walls:
            if w == wall:
                continue
            (wx1, wy1), (wx2, wy2) = w
            if is_horiz != (abs(wy1 - wy2) < 0.01):
                continue  #must be same orientation
            wm_x, wm_y = (wx1 + wx2) / 2, (wy1 + wy2) / 2
            #must be on the opposite side of room center from the door wall
            dot = (wm_x - cx) * (wmid_x - cx) + (wm_y - cy) * (wmid_y - cy)
            if dot >= 0:
                continue
            length = math.hypot(wx2 - wx1, wy2 - wy1)
            if length > best_len:
                best_len = length
                best = w
        return best

    def resolve_walls(self, room):
        """Return primary, secondary, tertiary and door walls of a room"""

        door_wall = self._find_door_wall(room)
        walls = list(room.walls)
        if door_wall in walls:
            walls.remove(door_wall)
        if not walls:
            return None, None, None, door_wall

        walls = sorted(walls,key=lambda w: math.hypot(w[1][0]-w[0][0], w[1][1]-w[0][1]), reverse=True) #sort by length descending
        primary = walls[0]
        secondary = self._get_opposite_wall(room, primary)
        remaining = [w for w in walls if w not in (primary, secondary)]
        tertiary = remaining[0] if remaining else None

        return primary, secondary, tertiary, door_wall
    
    def _actual_wall_of_poly(self, poly, wall_list):
        """Return which wall in wall_list the placed poly is actually snapped to."""

        cx = (poly.bounds[0] + poly.bounds[2]) / 2
        cy = (poly.bounds[1] + poly.bounds[3]) / 2
        best_wall, best_d = None, float('inf')
        for w in wall_list:
            if w is None:
                continue
            d = LineString([w[0], w[1]]).distance(poly)
            if d < best_d:
                best_d = d
                best_wall = w
        return best_wall
    
    def _wall_has_window(self, wall):
        """Return True if any window segment overlaps this wall."""

        from shapely.geometry import LineString, box as sbox
        (wx1, wy1), (wx2, wy2) = wall
        wall_line = LineString([(wx1, wy1), (wx2, wy2)])
        for (mnx, mny, mxx, mxy) in self.window_segments:
            win_box = sbox(mnx - 0.05, mny - 0.05, mxx + 0.05, mxy + 0.05)
            if wall_line.intersects(win_box):
                return True
        return False

    def _poly_overlaps_window(self, poly):
        """Return True if the asset footprint overlaps any window opening."""

        from shapely.geometry import box as sbox
        for (mnx, mny, mxx, mxy) in self.window_segments:
            win_box = sbox(mnx - 0.05, mny - 0.05, mxx + 0.05, mxy + 0.05)
            if poly.intersects(win_box):
                return True
        return False

    def try_placement(self, msp, room, asset, size, rotation, walls, center):
        """Try placement of asset considering door swings, asset collision and room limits"""

        for w in walls:
            if not w:
                continue
            success, poly = self._insert_asset(
                msp, room, asset, center, size, rotation,
                allowed_wall_edge=w
            )
            if success and poly:
                if any(poly.intersects(s) for s, _ in self.door_swings):
                    print(f"  [DOOR] {asset} obstructs door swing, trying next wall.")
                    self.placed_assets.remove(poly)
                    continue
                return poly
        return None
    
    def _place_on_wall(self, msp, room, asset_name, wall, preferred_along=None, flip=False):
        """Try placement of asset on wall considering door swings, asset collision and room limits"""

        DOOR_CLEARANCE = 0.10
        SLIDE_STEP = 0.05
        WALL_MARGIN = 0.02

        asset_w, asset_h = self.get_asset_dimensions(asset_name)

        (wx1, wy1), (wx2, wy2) = wall
        rcx, rcy = room.center
        is_vertical = abs(wx1 - wx2) < 0.01

        if is_vertical:
            final_rot = ((90 if wx1 < rcx else 270) + (180 if flip else 0)) % 360
            thickness = asset_h
            direction = 1 if wx1 < rcx else -1
            snap_perp = wx1 + direction * (thickness / 2 + WALL_MARGIN)
            fp_w, fp_h = asset_h, asset_w
            wlo, whi = min(wy1, wy2), max(wy1, wy2)
            axis = 'y'
        else:
            final_rot = ((0 if wy1 < rcy else 180) + (180 if flip else 0)) % 360
            thickness = asset_h
            direction = 1 if wy1 < rcy else -1
            snap_perp = wy1 + direction * (thickness / 2 + WALL_MARGIN)
            fp_w, fp_h = asset_w, asset_h
            wlo, whi = min(wx1, wx2), max(wx1, wx2)
            axis = 'x'

        half_extent = (fp_h if axis == 'y' else fp_w) / 2
        lo = wlo + half_extent + WALL_MARGIN
        hi = whi - half_extent - WALL_MARGIN

        if lo > hi:
            print(f"  [FAIL] {asset_name}: wall too short")
            return False, None

        start = max(lo, min(hi, preferred_along)) if preferred_along is not None else (lo + hi) / 2

        candidates = [start]
        offset = SLIDE_STEP
        if preferred_along is not None:
            # Sequential mode: only search forward from preferred position
            while start + offset <= hi + 1e-9:
                candidates.append(start + offset)
                offset += SLIDE_STEP
        else:
            # Free mode: fan both directions from midpoint
            while True:
                added = False
                if start - offset >= lo - 1e-9:
                    candidates.append(start - offset)
                    added = True
                if start + offset <= hi + 1e-9:
                    candidates.append(start + offset)
                    added = True
                if not added:
                    break
                offset += SLIDE_STEP

        for along in candidates:
            cx, cy = (snap_perp, along) if axis == 'y' else (along, snap_perp)
            poly = box(cx - fp_w / 2, cy - fp_h / 2, cx + fp_w / 2, cy + fp_h / 2)

            if not room.polygon.covers(poly):
                continue
            is_valid, _ = validate_asset_collision(poly, self.placed_assets, clearance=0.10)
            if not is_valid:
                continue
            if any(poly.distance(s) < DOOR_CLEARANCE for s, _ in self.door_swings):
                continue
            
            layer_name = f"ASSET_{asset_name}_{room.id}"

            self._write_to_cad(msp, asset_name, layer_name, cx, cy, final_rot, asset_w, asset_h)
            self.placed_assets.append(poly)
            print(f"  [OK] {asset_name} placed at ({cx:.2f},{cy:.2f}) rot={final_rot}")
            return True, poly

        print(f"  [FAIL] {asset_name}: no clear position on wall {wall}")
        return False, None
    
    def _try_walls(self, msp, room, asset_name, wall_priority, preferred_along=None, flip=False):
        """Check wals availabe fr asset and place asset"""

        for wall in wall_priority:
            if wall is None:
                continue
            success, poly = self._place_on_wall(msp, room, asset_name, wall, preferred_along=preferred_along, flip=flip)
            if success:
                return True, poly
        return False, None

    def _ensure_layer(self, doc, layer_name, color=7):
        """Create layer if missing; keep stable color if provided."""
        try:
            if layer_name in doc.layers:
                if color is not None:
                    doc.layers.get(layer_name).dxf.color = color
                return
            attribs = {"color": color} if color is not None else {}
            doc.layers.add(layer_name, dxfattribs=attribs)
        except Exception:
            # Layer creation should not fail generation flow.
            pass
    
    def _write_to_cad(self, msp, asset_name, layer_name, cx, cy, final_rot, asset_w, asset_h):
        """Make the asset shape"""

        if layer_name not in msp.doc.layers:
            msp.doc.layers.new(name=layer_name, dxfattribs={"color": 4})

        asset_doc = self.load_asset(asset_name)
        if not asset_doc:
            return

        cache = bbox.Cache()
        bb = bbox.extents(asset_doc.modelspace(), cache=cache)
        if not bb.has_data:
            return
        
        if asset_name in self.ASSET_MM:
            scale_val = 0.001
        else:
            scale_val = 0.0254
        
        raw_cx = (bb.extmin.x + bb.extmax.x) / 2
        raw_cy = (bb.extmin.y + bb.extmax.y) / 2

        m  = Matrix44.translate(-raw_cx, -raw_cy, 0)
        m @= Matrix44.scale(scale_val, scale_val, 1)
        m @= Matrix44.z_rotate(math.radians(-final_rot))
        m @= Matrix44.translate(cx, cy, 0)

        valid_types = {'LINE', 'LWPOLYLINE', 'POLYLINE', 'CIRCLE', 'ARC', 'ELLIPSE', 'SPLINE'}

        for e in asset_doc.modelspace():

            if e.dxftype() not in valid_types:
                continue
            # ---- FILTER OUT HUGE CONSTRUCTION GEOMETRY ----
            if e.dxftype() == "CIRCLE":
                if e.dxf.radius * scale_val > 3:  # bigger than 3 meters → ignore since it is mostly construction geometry, not part of asset footprint
                    continue

            # if e.dxftype() == "ARC":
            #     if e.dxf.radius * scale_val > 6:
            #         continue

            new_e = e.copy()

            try:
                new_e.transform(m)
                new_e.dxf.layer = layer_name
                new_e.dxf.color = 256
                new_e.dxf.linetype = "Continuous"
                msp.add_entity(new_e)
            except Exception:
                pass

    def _insert_asset(self, msp, room, asset_name, target_center, target_size, rotation, allowed_wall_edge=None, margin=0.01):
        """Insert asset at specified position"""

        if asset_name in self.ASSET_in:
            scale_val = 0.0254
        else:
            scale_val = 0.001

        asset_doc = self.load_asset(asset_name)
        if not asset_doc: 
            return False, None
        
        if "ASSETS" not in asset_doc.layers:
            asset_doc.layers.new(name="ASSETS", dxfattribs={"color": 4})

        cache = bbox.Cache()
        bb = bbox.extents(asset_doc.modelspace(), cache=cache)
        if not bb.has_data: 
            return False, None
        
        # Raw coordinates from DXF (mm)
        raw_w, raw_h = bb.size.x, bb.size.y
        raw_cx, raw_cy = (
            (bb.extmin.x + bb.extmax.x) / 2,
            (bb.extmin.y + bb.extmax.y) / 2,
        )
        
        # Strict scale factor
        src_w, src_h = raw_w * scale_val, raw_h * scale_val
        final_x, final_y = target_center
        final_rot = rotation

        # Layer 2: Wall Snap Logic
        if allowed_wall_edge:
            (wx1, wy1), (wx2, wy2) = allowed_wall_edge
            rcx, rcy = room.center
            
            if abs(wx1 - wx2) < 0.01: # Vertical Wall
                if wx1 < rcx:
                    final_rot += 90
                else:
                    final_rot += 270
                thickness = src_h  # After 90°/270° rotation, X-extent becomes original height
                direction = 1 if wx1 < rcx else -1
                final_x = wx1 + (direction * (thickness / 2 + margin))
                final_y = target_center[1]
                print(f"  [Snap] Vertical Wall at X={wx1:.2f}. Pushing asset to X={final_x:.2f}")
            else: # Horizontal Wall
                if wy1 < rcy:
                    final_rot += 0 
                else: 
                    final_rot += 180
                thickness = src_h
                direction = 1 if wy1 < rcy else -1
                final_y = wy1 + (direction * (thickness / 2 + margin))
                final_x = target_center[0]
                print(f"[Snap] Horizontal Wall at Y={wy1:.2f}. Pushing asset to Y={final_y:.2f}")

        # Transform Validation Polygon
        base_poly = box(-src_w / 2, -src_h / 2, src_w / 2, src_h / 2)
        poly_transformed = rotate(base_poly, final_rot, origin=(0, 0))
        poly_transformed = translate(poly_transformed, final_x, final_y)

        # Strict Room Bounds Check — asset must be fully inside the room
        if not room.polygon.covers(poly_transformed):
             print(f"[FAIL] {asset_name} is outside room boundaries.")
             return False, None
        
        is_valid, reason = validate_asset_collision(poly_transformed, self.placed_assets, clearance=0.10)
        if not is_valid: 
            print(f"  [FAIL] {asset_name} collision: {reason}")
            return False, None

        # --- Asset Layer Tagging ---
        layer_name = f"ASSET_{asset_name}_{room.id}"
        # Handle duplicate asset names in same room (e.g. two side_tables)
        doc = msp.doc
        layer_name = f"ASSET_{asset_name}_{room.id}"

        if layer_name not in doc.layers:
            doc.layers.add(layer_name)

        print(f"  [Layer] Assigning to layer: {layer_name}")

        # CAD Matrix Application: Zero out raw DXF center -> 2. Scale mm to m -> 3. Rotate -> 4. Move to Room Coords
        m = Matrix44.translate(-raw_cx, -raw_cy, 0)
        m @= Matrix44.scale(scale_val, scale_val, 1)
        m @= Matrix44.z_rotate(math.radians(final_rot))
        m @= Matrix44.translate(final_x, final_y, 0)

        print(f"  [Matrix Log] Placing {asset_name}: Trans({final_x:.2f}, {final_y:.2f}) Rot({final_rot}) Scale({scale_val})")

        valid_types = {'LINE', 'LWPOLYLINE', 'POLYLINE', 'CIRCLE', 'ARC', 'ELLIPSE', 'SPLINE'} 

        for e in asset_doc.modelspace():
            if e.dxf.layer != "ASSETS":
                e.dxf.layer = "ASSETS"
                e.dxf.color = 256  # ByLayer

        for block in asset_doc.blocks:
            if block.name.startswith("*"):
                continue  # skip anonymous/system blocks
            for e in block:
                if e.dxf.layer != "ASSETS":
                    e.dxf.layer = "ASSETS"
                    e.dxf.color = 256

        for e in asset_doc.modelspace():
            if e.dxftype() not in valid_types:
                continue

            new_e = e.copy()
            try:
                new_e.transform(m)
                new_e.dxf.layer = layer_name
                new_e.dxf.color = 256
                new_e.dxf.linetype = "Continuous"
                msp.add_entity(new_e)
            except Exception:
                pass
            
        self.placed_assets.append(poly_transformed)

        # Track asset metadata for later manipulation
        if not hasattr(self, "asset_metadata"):
            self.asset_metadata = {}
        self.asset_metadata[layer_name] = {
            "asset_name": asset_name,
            "room_id": room.id,
            "position": [final_x, final_y],
            "rotation": final_rot,
            "size": [src_w, src_h],
        }

        return True, poly_transformed