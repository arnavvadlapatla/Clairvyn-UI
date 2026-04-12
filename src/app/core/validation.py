from __future__ import annotations
import json
import math
from typing import Dict, Any, Optional, List
from shapely.geometry import Polygon
from shapely.ops import unary_union
from collections import defaultdict, deque


class PolygonValidator:

    def __init__(self, structure_path: Optional[str] = None, structure: Optional[Dict] = None):
        if structure is None and structure_path is None:
            raise ValueError("Provide structure dict or structure_path")
        self.structure_path = structure_path
        self.structure = structure
        if self.structure is None:
            self._load()

    def _load(self):
        with open(self.structure_path, "r") as f:
            self.structure = json.load(f)

    # =========================
    # Polygon builder
    # =========================
    @staticmethod
    def _clean_coords(coords):
        """
        Fix LLM-output artifacts before passing to Shapely:
        1. De-duplicate consecutive identical vertices.
        2. Detect a mid-sequence closing point (first vertex repeated before the end)
           which means the LLM concatenated two polygon rings -- truncate at that point.
        3. Strip the explicit closing vertex if the last point == first point (Shapely
           closes automatically).
        """
        if not coords or len(coords) < 3:
            return coords

        verts = [tuple(v) for v in coords]

        # Remove consecutive duplicates
        deduped = [verts[0]]
        for v in verts[1:]:
            if v != deduped[-1]:
                deduped.append(v)

        # Detect mid-sequence closing: first vertex appears again before the last position
        first = deduped[0]
        for i in range(1, len(deduped) - 1):
            if deduped[i] == first:
                deduped = deduped[:i]
                break

        # Strip explicit closing vertex (Shapely adds it automatically)
        if len(deduped) > 1 and deduped[-1] == deduped[0]:
            deduped = deduped[:-1]

        return deduped

    def _build_polygons(self):
        rooms = self.structure.get("layout", {}).get("rooms", [])
        polygons = {}

        for room in rooms:
            rid = room.get("id")
            raw_coords = room.get("polygon", [])
            coords = self._clean_coords(raw_coords)
            poly = Polygon(coords)
            if not poly.is_valid:
                poly = poly.buffer(0)
            polygons[rid] = poly

        return polygons

    # =========================
    # Overlap check (non-blocking for now)
    # =========================
    def _validate_overlaps(self, polygons):
        overlaps = []
        ids = list(polygons.keys())
        for i in range(len(ids)):
            for j in range(i + 1, len(ids)):
                a, b = polygons[ids[i]], polygons[ids[j]]
                if a.intersection(b).area > 1e-6:
                    overlaps.append({
                        "a_id": ids[i],
                        "b_id": ids[j]
                    })
        return overlaps

    # =========================
    # Door validation (INTENT only)
    # =========================
    def _validate_doors(self, polygons):
        issues = []
        doors = self.structure.get("doors", [])

        for d in doors:
            frm = d.get("from_room")
            to = d.get("to_room")

            if frm not in polygons:
                issues.append({"door": d, "issue": "from_room missing"})
            if to not in polygons:
                issues.append({"door": d, "issue": "to_room missing"})

        return issues

    # =========================
    # Window validation (INTENT only)
    # =========================
    def _validate_windows(self, polygons):
        issues = []
        windows = self.structure.get("windows", [])

        for w in windows:
            if w.get("room_id") not in polygons:
                issues.append({"window": w, "issue": "room_id missing"})

        return issues

    # =========================
    # REACHABILITY (USING DOORS)
    # =========================
    def _validate_reachability(self, polygons):
        doors = self.structure.get("doors", [])

        graph = defaultdict(list)
        for d in doors:
            a = d.get("from_room")
            b = d.get("to_room")
            if a in polygons and b in polygons:
                graph[a].append(b)
                graph[b].append(a)

        if not polygons:
            return {"reachable_rooms": [], "unreachable_rooms": []}

        start = list(polygons.keys())[0]  # start anywhere
        visited = set()
        queue = deque([start])
        visited.add(start)

        while queue:
            node = queue.popleft()
            for nbr in graph[node]:
                if nbr not in visited:
                    visited.add(nbr)
                    queue.append(nbr)

        unreachable = [r for r in polygons if r not in visited]

        return {
            "reachable_rooms": sorted(list(visited)),
            "unreachable_rooms": unreachable
        }

    # =========================
    # BATHROOM ADJACENCY CHECK
    # Bathrooms must share a wall with at least one bedroom
    # =========================
    def _validate_bathroom_adjacency(self, polygons):
        """
        For each bathroom, verify it shares at least one wall segment
        with at least one bedroom. Uses polygon boundary intersection
        (shared edge length > tolerance).
        """
        rooms = self.structure.get("layout", {}).get("rooms", [])

        bathroom_ids = [r["id"] for r in rooms if r.get("type", "").lower() == "bathroom"]
        bedroom_ids  = [r["id"] for r in rooms if r.get("type", "").lower() == "bedroom"]

        issues = []

        for bath_id in bathroom_ids:
            if bath_id not in polygons:
                continue

            bath_poly = polygons[bath_id]
            shares_wall = False

            for bed_id in bedroom_ids:
                if bed_id not in polygons:
                    continue
                # Shared boundary length > 0.1m counts as a shared wall
                shared = bath_poly.boundary.intersection(polygons[bed_id].boundary)
                if shared.length > 0.1:
                    shares_wall = True
                    break

            if not shares_wall:
                issues.append({
                    "bathroom_id": bath_id,
                    "issue": "Bathroom does not share a wall with any bedroom. "
                             "Reposition bathroom to be adjacent to bedroom cluster."
                })

        return issues

    # =========================
    # BATHROOM ↔ KITCHEN SEPARATION
    # Bathrooms must NOT share a wall with any kitchen
    # =========================
    def _validate_bathroom_kitchen_separation(self, polygons):
        """
        For each bathroom, verify it does NOT share a wall with any kitchen.
        Shared wall = boundary intersection length > 0.1m.
        """
        rooms = self.structure.get("layout", {}).get("rooms", [])

        bathroom_ids = [r["id"] for r in rooms if r.get("type", "").lower() == "bathroom"]
        kitchen_ids  = [r["id"] for r in rooms if r.get("type", "").lower() == "kitchen"]

        issues = []

        for bath_id in bathroom_ids:
            if bath_id not in polygons:
                continue
            bath_poly = polygons[bath_id]
            for kit_id in kitchen_ids:
                if kit_id not in polygons:
                    continue
                shared = bath_poly.boundary.intersection(polygons[kit_id].boundary)
                if shared.length > 0.1:
                    issues.append({
                        "bathroom_id": bath_id,
                        "kitchen_id": kit_id,
                        "issue": "Bathroom shares a wall with kitchen — plumbing and hygiene conflict. "
                                 "Reposition bathroom away from kitchen into the bedroom cluster."
                    })

        return issues

    # =========================
    # WALL CONNECTIVITY CHECK
    # All rooms must form a single connected graph via shared walls
    # =========================
    def _validate_wall_connectivity(self, polygons):
        if len(polygons) <= 1:
            return []

        graph = defaultdict(set)
        ids = list(polygons.keys())
        for i in range(len(ids)):
            for j in range(i + 1, len(ids)):
                shared = polygons[ids[i]].boundary.intersection(polygons[ids[j]].boundary)
                if shared.length > 0.05:
                    graph[ids[i]].add(ids[j])
                    graph[ids[j]].add(ids[i])

        start = ids[0]
        visited = {start}
        queue = deque([start])
        while queue:
            node = queue.popleft()
            for neighbor in graph[node]:
                if neighbor not in visited:
                    visited.add(neighbor)
                    queue.append(neighbor)

        disconnected = [rid for rid in ids if rid not in visited]
        return disconnected

    # =========================
    # OUTER BOUNDARY REGULARITY
    # Hull fill ratio, vertex count, axis-alignment
    # =========================
    def _validate_boundary_regularity(self, polygons):
        if not polygons:
            return []

        issues = []
        union = unary_union(list(polygons.values()))
        if union.is_empty:
            return []

        # 1. Convex hull fill ratio — penalises deep notches and protrusions
        hull = union.convex_hull
        if hull.area > 0:
            ratio = union.area / hull.area
            if ratio < 0.65:
                issues.append(
                    f"Outer boundary is too irregular (fill ratio {ratio:.2f}, minimum 0.65). "
                    "Reshape the layout to be closer to a rectangle or simple L-shape."
                )

        # 2. Vertex count — too many corners means a jagged footprint
        if hasattr(union, 'exterior'):
            coords = list(union.exterior.coords)
            n_verts = len(coords) - 1  # first == last, so subtract 1
            if n_verts > 12:
                issues.append(
                    f"Outer boundary has {n_verts} corners (maximum 12). "
                    "Simplify the house shape — aim for rectangle (4), L-shape (6), or T-shape (8)."
                )

            # 3. All boundary edges must be axis-aligned (no diagonal walls)
            diagonal_count = 0
            for k in range(len(coords) - 1):
                dx = abs(coords[k + 1][0] - coords[k][0])
                dy = abs(coords[k + 1][1] - coords[k][1])
                if dx > 0.01 and dy > 0.01:
                    diagonal_count += 1
            if diagonal_count > 0:
                issues.append(
                    f"Outer boundary has {diagonal_count} diagonal edge(s). "
                    "All walls must be axis-aligned (horizontal or vertical only)."
                )

            # 4. Concave vertex count — U/C shapes enclose outdoor space on 3+ sides
            pts = list(union.exterior.coords)[:-1]
            n_pts = len(pts)
            concave_count = 0
            concave_pts = []
            for k in range(n_pts):
                p0 = pts[(k - 1) % n_pts]
                p1 = pts[k]
                p2 = pts[(k + 1) % n_pts]
                cross = (p1[0] - p0[0]) * (p2[1] - p1[1]) - (p1[1] - p0[1]) * (p2[0] - p1[0])
                if cross < -1e-6:
                    concave_count += 1
                    concave_pts.append(p1)
            if concave_count > 1:
                # Find which rooms have vertices at the concave corners
                culprit_ids = set()
                for pt in concave_pts:
                    for rid, poly in polygons.items():
                        for pp in list(poly.exterior.coords)[:-1]:
                            if abs(pp[0] - pt[0]) < 0.05 and abs(pp[1] - pt[1]) < 0.05:
                                culprit_ids.add(rid)
                                break
                culprit_str = (
                    f" Rooms forming the concave pocket: {sorted(culprit_ids)}."
                    if culprit_ids else ""
                )
                issues.append(
                    f"Outer boundary has {concave_count} concave corners (maximum 1 allowed).{culprit_str} "
                    "Move those rooms flush against the main building mass to close the pocket. "
                    "L-shape (1 concave corner) is OK; U-shape or C-shape is NOT."
                )

        return issues

    # =========================
    # PER-ROOM DIMENSION CHECKS
    # Minimum side length, area, and aspect ratio per room type
    # =========================
    def _validate_room_dimensions(self, polygons):
        MIN_DIMS = {
            'bathroom': {'min_short': 1.8, 'min_area': 4.0,  'max_ratio': 1.6},
            'bedroom':  {'min_short': 3.0, 'min_area': 10.0, 'max_ratio': 1.5},
            'kitchen':  {'min_short': 2.8, 'min_area': 8.0,  'max_ratio': 1.8},
            'living':   {'min_short': 4.0, 'min_area': 14.0, 'max_ratio': 1.8},
            'balcony':  {'min_short': 1.0, 'min_area': 3.5,  'max_ratio': None, 'min_ratio': 2.5},
        }

        rooms = self.structure.get("layout", {}).get("rooms", [])
        issues = []

        for room in rooms:
            rid = room['id']
            rtype = room.get('type', '').lower()
            if rid not in polygons or rtype not in MIN_DIMS:
                continue

            poly = polygons[rid]
            area = poly.area
            minx, miny, maxx, maxy = poly.bounds
            w = maxx - minx
            h = maxy - miny
            short_side = min(w, h)
            long_side  = max(w, h)
            ratio = long_side / short_side if short_side > 0 else float('inf')
            dims = MIN_DIMS[rtype]

            if area < dims['min_area']:
                issues.append({
                    'room_id': rid,
                    'issue': (f"{rtype.capitalize()} '{rid}' area is {area:.1f}m² "
                              f"(minimum {dims['min_area']}m²). Enlarge it.")
                })
            if short_side < dims['min_short']:
                issues.append({
                    'room_id': rid,
                    'issue': (f"{rtype.capitalize()} '{rid}' shortest side is {short_side:.2f}m "
                              f"(minimum {dims['min_short']}m). Widen it.")
                })
            if dims['max_ratio'] and ratio > dims['max_ratio']:
                issues.append({
                    'room_id': rid,
                    'issue': (f"{rtype.capitalize()} '{rid}' aspect ratio is {ratio:.1f}:1 "
                              f"(maximum {dims['max_ratio']}:1). Make it less elongated.")
                })
            if dims.get('min_ratio') and ratio < dims['min_ratio']:
                issues.append({
                    'room_id': rid,
                    'issue': (f"{rtype.capitalize()} '{rid}' ratio is {ratio:.1f}:1 which is too square "
                              f"(minimum {dims['min_ratio']}:1 required — must be a strip, e.g. 3.3m×1.2m not 1.2m×1.2m). Make it longer and narrower.")
                })

        return issues

    # =========================
    # EXACT DIMENSIONS CHECK
    # Rooms with exact_width/exact_height in spec must match those dimensions exactly
    # =========================
    def _validate_exact_dimensions(self, polygons):
        """
        For any room whose spec entry has non-null exact_width or exact_height,
        verify the polygon matches those dimensions within 0.1m tolerance.
        """
        spec_rooms = self.structure.get("spec", {}).get("rooms", [])
        if not spec_rooms:
            # Try layout rooms if spec not present in structure
            spec_rooms = self.structure.get("layout", {}).get("rooms", [])
        issues = []
        TOL = 0.15  # 15cm tolerance

        for r in spec_rooms:
            rid = r.get("id")
            exact_w = r.get("exact_width")
            exact_h = r.get("exact_height")
            if not exact_w and not exact_h:
                continue
            if rid not in polygons:
                continue
            poly = polygons[rid]
            minx, miny, maxx, maxy = poly.bounds
            actual_w = round(maxx - minx, 3)
            actual_h = round(maxy - miny, 3)

            if exact_w and abs(actual_w - exact_w) > TOL:
                issues.append({
                    "room_id": rid,
                    "issue": (
                        f"Room '{rid}' has width {actual_w:.2f}m but user specified exact width {exact_w}m. "
                        f"Resize so x-span = {exact_w}m exactly (tolerance ±{TOL}m)."
                    )
                })
            if exact_h and abs(actual_h - exact_h) > TOL:
                issues.append({
                    "room_id": rid,
                    "issue": (
                        f"Room '{rid}' has height {actual_h:.2f}m but user specified exact height {exact_h}m. "
                        f"Resize so y-span = {exact_h}m exactly (tolerance ±{TOL}m)."
                    )
                })
        return issues

    # =========================
    # PER-ROOM SHAPE CHECK
    # Rooms must be rectangles; only bedroom/living may be L-shaped (6 corners)
    # =========================
    def _validate_room_shapes(self, polygons):
        """Each room polygon must be a simple rectangle (4 corners).
        Bedrooms and living rooms may have up to 6 corners (L-shape).
        Any other shape is rejected as irregular.
        """
        rooms = self.structure.get("layout", {}).get("rooms", [])
        issues = []
        for room in rooms:
            rid = room['id']
            rtype = room.get('type', '').lower()
            if rid not in polygons:
                continue
            poly = polygons[rid]
            if not hasattr(poly, 'exterior'):
                continue
            # Vertex count (closing coord repeated, so subtract 1)
            n = len(list(poly.exterior.coords)) - 1
            # Allow up to 6 corners for bedroom (L-shaped with bathroom) and living
            max_corners = 6 if rtype in ('bedroom', 'living') else 4
            if n > max_corners:
                issues.append({
                    'room_id': rid,
                    'issue': (
                        f"{rtype.capitalize()} '{rid}' has {n} corners (maximum {max_corners}). "
                        "Use a rectangle (4 corners). Only bedroom/living may be L-shaped (6 corners)."
                    )
                })
        return issues

    # =========================
    # DOOR WALL MINIMUM CHECK
    # Every door pair must share ≥ 0.8m of wall to physically fit a door
    # =========================
    def _validate_door_wall_space(self, polygons):
        doors = self.structure.get("doors", [])
        issues = []
        for d in doors:
            frm = d.get("from_room")
            to = d.get("to_room")
            if to == "outside" or frm not in polygons or to not in polygons:
                continue
            shared = polygons[frm].boundary.intersection(polygons[to].boundary)
            if shared.length < 0.8:
                issues.append({
                    "from_room": frm,
                    "to_room": to,
                    "shared_wall_m": round(shared.length, 2),
                    "issue": (
                        f"Rooms '{frm}' and '{to}' share only {shared.length:.2f}m of wall "
                        f"but need ≥ 0.8m to fit a door. Move them to share more wall."
                    )
                })
        return issues

    # =========================
    # ENTRANCE PLACEMENT CHECK
    # Main entrance must open into a public room (living/kitchen/dining/corridor)
    # =========================
    def _validate_entrance_placement(self, polygons):
        """
        Find doors that connect to 'outside'. The room on the inside must be a
        public-zone room type (living, kitchen, dining, corridor, other).
        Entering directly into a bedroom, bathroom, or balcony is rejected.
        """
        PRIVATE_TYPES = {"bedroom", "bathroom", "balcony"}
        doors = self.structure.get("doors", [])
        rooms = self.structure.get("layout", {}).get("rooms", [])
        room_type_map = {r["id"]: r.get("type", "").lower() for r in rooms}
        issues = []

        for d in doors:
            frm = d.get("from_room", "")
            to = d.get("to_room", "")
            if to == "outside":
                inside_room = frm
            elif frm == "outside":
                inside_room = to
            else:
                continue

            rtype = room_type_map.get(inside_room, "")
            if rtype in PRIVATE_TYPES:
                issues.append({
                    "room_id": inside_room,
                    "issue": (
                        f"Entrance door opens directly into '{inside_room}' (type: {rtype}). "
                        "The main entrance must be into the living room, kitchen, or corridor — "
                        "NEVER a bedroom, bathroom, or balcony. Relocate the entrance."
                    )
                })

        return issues

    # =========================
    # BALCONY ORIENTATION
    # The balcony's LONG SIDE must be the shared wall with its adjacent room.
    # Attaching at the short end (strip end) is invalid.
    # =========================
    def _validate_balcony_orientation(self, polygons):
        rooms = self.structure.get("layout", {}).get("rooms", [])
        issues = []

        for room in rooms:
            rid = room["id"]
            if room.get("type", "").lower() != "balcony":
                continue
            if rid not in polygons:
                continue

            bal_poly = polygons[rid]
            minx, miny, maxx, maxy = bal_poly.bounds
            bw = maxx - minx
            bh = maxy - miny
            long_side = max(bw, bh)
            short_side = min(bw, bh)

            # Only meaningful for strip-shaped balconies (ratio >= 2.0)
            if short_side <= 0 or (long_side / short_side) < 2.0:
                continue

            # Find max shared-wall length with any neighbour
            max_shared = 0.0
            for other_id, other_poly in polygons.items():
                if other_id == rid:
                    continue
                try:
                    shared = bal_poly.boundary.intersection(other_poly.boundary)
                    max_shared = max(max_shared, shared.length)
                except Exception:
                    pass

            # The wide face must be the shared wall — shared length must be ≥ 60% of long side
            if max_shared < long_side * 0.6:
                issues.append({
                    "room_id": rid,
                    "issue": (
                        f"Balcony '{rid}' is attached at its short end (shared wall {max_shared:.2f}m) "
                        f"but its long side is {long_side:.2f}m. "
                        "The balcony's WIDE side must face the bedroom — rotate or reposition it so "
                        "the full-width wall is shared with the adjacent room."
                    )
                })

        return issues

    # =========================
    # BEDROOM-TO-LIVING ADJACENCY
    # Every bedroom must share >=1.0m continuous wall with the living room (door must fit).
    # =========================
    def _validate_living_bedroom_adjacency(self, polygons):
        """
        Every bedroom must physically share at least 1.0m of wall with the living room.
        A shared wall < 1.0m means the bedroom door to living cannot be placed.
        """
        rooms = self.structure.get("layout", {}).get("rooms", [])
        living_ids = [r["id"] for r in rooms if r.get("type", "").lower() == "living"]
        bedroom_ids = [r["id"] for r in rooms if r.get("type", "").lower() == "bedroom"]
        issues = []

        if not living_ids or not bedroom_ids:
            return issues

        for bed_id in bedroom_ids:
            if bed_id not in polygons:
                continue
            bed_poly = polygons[bed_id]
            max_shared = 0.0
            for liv_id in living_ids:
                if liv_id not in polygons:
                    continue
                shared = bed_poly.boundary.intersection(polygons[liv_id].boundary)
                if not shared.is_empty:
                    max_shared = max(max_shared, shared.length)

            if max_shared < 1.0:
                issues.append({
                    "bedroom_id": bed_id,
                    "shared_wall_m": round(max_shared, 2),
                    "issue": (
                        f"Bedroom '{bed_id}' shares only {round(max_shared, 2):.2f}m wall with living "
                        f"(minimum 1.0m needed for door). Expand bedroom or living until >=1.2m shared."
                    ),
                })

        return issues

    # =========================
    # BATHROOM BLOCKING LIVING
    # A bathroom must NOT share any wall with the living room.
    # If it does, it is sandwiched between its bedroom and living, blocking the bedroom door.
    # =========================
    def _validate_bathroom_not_touching_living(self, polygons):
        rooms = self.structure.get("layout", {}).get("rooms", [])
        living_ids  = {r["id"] for r in rooms if r.get("type", "").lower() == "living"}
        bathroom_ids = {r["id"] for r in rooms if r.get("type", "").lower() == "bathroom"}
        issues = []

        for bath_id in bathroom_ids:
            if bath_id not in polygons:
                continue
            bath_poly = polygons[bath_id]
            for liv_id in living_ids:
                if liv_id not in polygons:
                    continue
                shared = bath_poly.boundary.intersection(polygons[liv_id].boundary)
                if not shared.is_empty and shared.length > 0.05:
                    issues.append({
                        "bathroom_id": bath_id,
                        "living_id": liv_id,
                        "shared_m": round(shared.length, 2),
                        "issue": (
                            f"Bathroom '{bath_id}' shares {round(shared.length, 2):.2f}m wall with "
                            f"living room '{liv_id}'. This means the bathroom is sandwiched between "
                            f"its bedroom and the living room, blocking the bedroom door. "
                            f"Move the bathroom to the far/back wall of the bedroom (away from living)."
                        ),
                    })

        return issues

    # =========================
    # LIVING ROOM EXTERIOR WALL
    # Living room must have ≥1.5m of free exterior wall for the house entrance.
    # It may be enclosed on up to 3 sides by other rooms.
    # =========================
    def _validate_living_exterior(self, polygons):
        rooms = self.structure.get("layout", {}).get("rooms", [])
        living_ids = [r["id"] for r in rooms if r.get("type", "").lower() == "living"]
        issues = []

        if not living_ids:
            return issues

        other_union = unary_union([p for rid, p in polygons.items() if rid not in living_ids])

        for liv_id in living_ids:
            if liv_id not in polygons:
                continue
            liv_poly = polygons[liv_id]
            exterior_edge = liv_poly.boundary.difference(other_union.boundary)
            free_length = 0.0 if (exterior_edge.is_empty) else exterior_edge.length
            # Need ≥1.5m of free exterior wall for the house entrance door
            if free_length < 1.5:
                issues.append({
                    "room_id": liv_id,
                    "issue": (
                        f"Living room '{liv_id}' has only {free_length:.2f}m of free exterior wall "
                        "(minimum 1.5m required for the house entrance door). "
                        "Move the living room to the building perimeter so at least 1.5m of its "
                        "boundary is not shared with another room — this wall hosts the front door."
                    )
                })

        return issues

    # =========================
    # MAIN VALIDATE (NO TOGGLES)
    # =========================
    def validate(self) -> Dict[str, Any]:
        polygons = self._build_polygons()

        report = {
            "overlaps":                    self._validate_overlaps(polygons),
            "doors":                       self._validate_doors(polygons),
            "windows":                     self._validate_windows(polygons),
            "reachability":                self._validate_reachability(polygons),
            "bathroom_adjacency":          self._validate_bathroom_adjacency(polygons),
            "bathroom_kitchen_separation": self._validate_bathroom_kitchen_separation(polygons),
            "wall_connectivity":           self._validate_wall_connectivity(polygons),
            "boundary_regularity":         self._validate_boundary_regularity(polygons),
            "room_dimensions":             self._validate_room_dimensions(polygons),
            "exact_dimensions":            self._validate_exact_dimensions(polygons),
            "room_shapes":                 self._validate_room_shapes(polygons),
            "door_wall_space":             self._validate_door_wall_space(polygons),
            "entrance_placement":          self._validate_entrance_placement(polygons),
            "bathroom_touching_living":     self._validate_bathroom_not_touching_living(polygons),
            "living_exterior":             self._validate_living_exterior(polygons),
            "living_bedroom_adjacency":    self._validate_living_bedroom_adjacency(polygons),
            "balcony_orientation":         self._validate_balcony_orientation(polygons),
        }

        blocking = []
        if report["overlaps"]:
            blocking.append("room_overlaps")
        if report["reachability"]["unreachable_rooms"]:
            blocking.append("unreachable_rooms")
        if report["bathroom_adjacency"]:
            blocking.append("bathroom_not_adjacent_to_bedroom")
        if report["bathroom_kitchen_separation"]:
            blocking.append("bathroom_adjacent_to_kitchen")
        if report["wall_connectivity"]:
            blocking.append("disconnected_rooms")
        if report["boundary_regularity"]:
            blocking.append("irregular_boundary")
        if report["room_shapes"]:
            blocking.append("irregular_room_shapes")
        if report["room_dimensions"]:
            blocking.append("bad_room_proportions")
        if report["exact_dimensions"]:
            blocking.append("exact_dimensions_violated")
        if report["door_wall_space"]:
            blocking.append("insufficient_door_wall_space")
        if report["entrance_placement"]:
            blocking.append("bad_entrance_placement")
        if report["bathroom_touching_living"]:
            blocking.append("bathroom_blocking_bedroom_door")
        if report["living_exterior"]:
            blocking.append("living_room_no_exterior_wall")
        if report["living_bedroom_adjacency"]:
            blocking.append("bedroom_not_adjacent_to_living")
        if report["balcony_orientation"]:
            blocking.append("bad_balcony_orientation")

        report["blocking_issues"] = blocking
        report["valid"] = len(blocking) == 0

        return report