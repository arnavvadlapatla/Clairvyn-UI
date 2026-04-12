"""Floor plan assembler: loads structure definition and component DXF files to create composite floor plan."""

import os
import json
import csv
import math
import logging
import ezdxf
import matplotlib

matplotlib.use("Agg")  # Non-GUI backend for server/thread safety
logging.getLogger("matplotlib.font_manager").setLevel(logging.ERROR)
import matplotlib.pyplot as plt
from ezdxf.addons.drawing import RenderContext, Frontend
from ezdxf.addons.drawing.matplotlib import MatplotlibBackend
from ezdxf.addons.drawing.properties import LayoutProperties
from ezdxf import bbox
from .asset_assembly import AssetAssembler
from .asset_assembly import AssetAssembler
from .asset_validation import build_door_swing
from .room import Room
# from ezdxf.addons.drawing import pymupdf


from collections import defaultdict
from shapely.geometry import Polygon, LineString, MultiLineString, Point
from shapely.ops import unary_union, linemerge

def polygon_bbox(vertices):
    """Compute bounding box (min_x, min_y, max_x, max_y) for a list of (x,y) vertices."""
    if not vertices:
        return (0, 0, 0, 0)
    valid = [v for v in vertices if hasattr(v, '__len__') and len(v) >= 2]
    if not valid:
        return (0, 0, 0, 0)
    xs = [v[0] for v in valid]
    ys = [v[1] for v in valid]
    return (min(xs), min(ys), max(xs), max(ys))


def get_polygon_edges(vertices):
    """Return list of edges [(start, end), ...] from vertices."""
    edges = []
    n = len(vertices)
    for i in range(n):
        edges.append((vertices[i], vertices[(i + 1) % n]))
    return edges


def is_vertical(edge):
    """Check if edge is vertical (x coordinates match)."""
    (x1, y1), (x2, y2) = edge
    return abs(x1 - x2) < 1e-6


def is_horizontal(edge):
    """Check if edge is horizontal (y coordinates match)."""
    (x1, y1), (x2, y2) = edge
    return abs(y1 - y2) < 1e-6


def get_overlap_range(min1, max1, min2, max2):
    """Return intersection [start, end] of two 1D ranges, or None."""
    start = max(min(min1, max1), min(min2, max2))
    end = min(max(min1, max1), max(min2, max2))
    if end > start + 1e-6:  # require minimal overlap
        return start, end
    return None


def interval_subtract(base, cuts): # returns list of remaining(start, end)
    cuts = sorted(cuts)
    result = []
    cur = base[0]
    for s, e in cuts:
        if e <= cur:
            continue
        if s > cur:
            result.append((cur, min(s, base[1])))
        cur = max(cur, e)
        if cur >= base[1]:
            break
    if cur < base[1]:
        result.append((cur, base[1]))

    return result

class FloorPlanAssembler:
    """Assembles a floor plan from component DXF files defined in structure.json and data.csv."""

    def __init__(self, csv_path, asset_dir):
        """Initialize assembler with paths to structure definition and component library.

        Args:
            structure_json_path: Path to structure.json defining rooms and connections
            csv_path: Path to data.csv with component metadata and DXF paths
            asset_dir: Directory containing component DXF files
        """
        self.csv_path = csv_path
        self.asset_dir = asset_dir
        self.structure = None
        self.components = {}  # name -> (dxf_path, metadata)
        self.doc = None
        self.msp = None
        self.door_swings = [] # List of shapely Geometries (Polygons) for door swings
        self.minx = None
        self.miny = None
        self.maxx = None
        self.maxy = None
        self.exterior = set()
        self.interior = set()
        self._label_pairs = []   # list of (name_entity, dim_entity) — built during labelling
        self._last_name_label = None

    def export_image(self, dxf_path: str, dpi: int = 300):
        png_path = os.path.splitext(dxf_path)[0] + ".png"
        doc = ezdxf.readfile(dxf_path)
        msp = doc.modelspace()
        msp._entities = list(msp)

        print("\n--- BLOCKS IN DOCUMENT ---")
        for block in doc.blocks:
            print(block.name)

        msp = doc.modelspace()

        # ---------------- DEBUG: ENTITY SUMMARY ----------------
        # print("\n--- ENTITY TYPES IN MODELSPACE ---")
        # entity_count = {}
        # for e in msp:
        #     entity_count[e.dxftype()] = entity_count.get(e.dxftype(), 0) + 1
        # for k, v in entity_count.items():
        #     print(f"{k}: {v}")
        # print("-----------------------------------\n")
        asset_count = 0
        for e in msp:
            if "ASSET_" in e.dxf.layer:
                asset_count += 1

        print("ASSET ENTITY COUNT:", asset_count)

        # ---------------- DEBUG: INSERT ENTITIES ----------------
        print("\n--- INSERT ENTITIES (BLOCK REFERENCES) ---")
        inserts = list(msp.query("INSERT"))
        if len(inserts) == 0:
            print("No INSERT entities found.")
        else:
            for e in inserts:
                print(
                    "Block name:", e.dxf.name,
                    "Layer:", e.dxf.layer,
                    "Color:", e.dxf.color
                )

        # ---------------- DEBUG: POLYLINES ----------------
        polylines = list(msp.query("LWPOLYLINE"))
        print(f"\nFound {len(polylines)} LWPOLYLINE entities.")

        for poly in polylines:
            try:
                poly.rgb = (0, 0, 0)
            except Exception:
                pass

        # ---------------- DEBUG: LAYERS ----------------
        print("\n--- LAYERS ---")
        for layer in doc.layers:
            print(
                f"{layer.dxf.name}: "
                f"on={layer.is_on()}, "
                f"frozen={layer.is_frozen()}, "
                f"locked={layer.is_locked()}, "
                f"color={layer.color}"
            )

        # ---------------- COMPUTE EXTENTS ----------------
        ext = bbox.extents(msp)

        if ext is None:
            print("\nNo extents found; ezdxf sees no plottable entities.")
        else:
            print("\nExtents:", ext.extmin, "->", ext.extmax)

        # ---------------- MATPLOTLIB FIGURE ----------------
        import warnings
        warnings.filterwarnings("ignore", message="findfont.*")

        fig = plt.figure(figsize=(8, 8), dpi=200)
        ax = fig.add_axes([0, 0, 1, 1])

        ctx = RenderContext(doc)
        ctx.set_current_layout(msp)

        ctx.linetype_scale = 1.0
        ctx.lineweight_scaling = 10

        msp_props = LayoutProperties.from_layout(msp)
        msp_props.set_colors(
            bg="#FFFFFFFF",
            fg="#000000FF"
        )

        backend = MatplotlibBackend(ax)

        # Force visible line thickness
        for spine in ax.spines.values():
            spine.set_linewidth(2)

        frontend = Frontend(ctx, backend)

        frontend.draw_layout(
            msp,
            layout_properties=msp_props,
            finalize=True
        )

        # ---------------- ZOOM TO EXTENTS ----------------
        if ext is not None:
            (xmin, ymin, _), (xmax, ymax, _) = ext.extmin, ext.extmax

            dx = xmax - xmin
            dy = ymax - ymin

            if dx == 0:
                dx = 1
            if dy == 0:
                dy = 1

            margin_x = 0.05 * dx
            margin_y = 0.05 * dy

            ax.set_xlim(xmin - margin_x, xmax + margin_x)
            ax.set_ylim(ymin - margin_y, ymax + margin_y)

            ax.set_aspect("equal", adjustable="box")

        ax.set_axis_off()

        # ---------------- SAVE IMAGE ----------------
        print("\n--- SAVING PNG ---")

        fig.savefig(
            png_path,
            dpi=dpi,
            facecolor="#FFFFFFFF",
            bbox_inches="tight",
            pad_inches=0.01
        )

        plt.close(fig)

        print("\nPNG exported to:", png_path)
    
    def toggle_asset_groups(self, group_names_to_show: list):
        """Toggle asset groups: show specified groups and hide all others.

        Args:
            group_names_to_show: List of group names to keep visible.
                                 All other asset groups will be hidden.

        Example:
            assembler.toggle_asset_groups(['ASSET_bed_123456', 'ASSET_sofa_789012'])
        """
        if not self.doc:
            print("[Warning] No document loaded. Call assemble_and_export first.")
            return

        groups = self.doc.groups

        for group in groups:
            group_name = group.dxf.name

            # Determine if this group should be visible
            should_show = group_name in group_names_to_show

            # Iterate through all entities in the group
            for entity_handle in group.handles:
                try:
                    entity = self.doc.entitydb.get(entity_handle)
                    if entity:
                        if should_show:
                            # Make visible: set color back to default (1) if it was hidden (color < 0)
                            if entity.dxf.color < 0:
                                entity.dxf.color = abs(entity.dxf.color)
                        else:
                            # Hide: negate the color value to hide the entity
                            if entity.dxf.color > 0:
                                entity.dxf.color = -entity.dxf.color
                except Exception as e:
                    print(
                        f"[Warning] Could not toggle entity in group {group_name}: {e}"
                    )

    def load_structure(self, json_obj):
        """Load and parse structure.json."""
        self.structure = json.loads(json_obj)

    def load_components_from_csv(self):
        """Load component metadata from CSV: name, type, dimensions, path, etc."""
        if not os.path.exists(self.csv_path):
            raise FileNotFoundError(f"CSV file not found: {self.csv_path}")

        with open(self.csv_path, "r", newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                if not row or not row.get("name"):
                    continue
                name = row.get("name", "").strip().lower()
                dxf_path = row.get("path", "").strip()
                # Normalize path to absolute if relative
                # The CSV may contain paths like "data/asset/bedroom_5x5.dxf"
                # We need to resolve relative to the project root
                if not os.path.isabs(dxf_path):
                    # Try absolute path first (project root relative)
                    full_path = os.path.abspath(dxf_path)
                    if not os.path.exists(full_path):
                        # Fall back to asset_dir relative
                        full_path = os.path.join(
                            self.asset_dir, os.path.basename(dxf_path)
                        )
                    dxf_path = full_path
                metadata = {
                    "id": row.get("id"),
                    "type": row.get("rtype", ""),
                    "dimensions": row.get("dimensions", ""),
                    "position": row.get("position", ""),
                }
                self.components[name] = (dxf_path, metadata)
        print(f"Loaded {len(self.components)} components from {self.csv_path}")

    def create_new_document(self):
        """Create a new DXF document for the floor plan."""
        self.doc = ezdxf.new("R2010")
        self.msp = self.doc.modelspace()
        for name, color in [("ASSETS", 4), ("DOORS", 6), ("TEXT", 7), ("WINDOWS", 5)]:
            self.doc.layers.new(name=name, dxfattribs={"color": color})
        print("Created new DXF document")

    def get_component_dxf(self, component_name):
        """Load a component DXF file by name.

        Args:
            component_name: Name of component (e.g., 'bedroom', 'bathroom')

        Returns:
            ezdxf.drawing.Drawing object or None if not found
        """
        key = component_name.lower()
        if key not in self.components:
            print(f"Warning: Component '{component_name}' not found in CSV")
            return None

        dxf_path, metadata = self.components[key]
        if not os.path.exists(dxf_path):
            print(f"Warning: DXF file not found: {dxf_path}")
            return None

        try:
            doc = ezdxf.readfile(dxf_path)
            return doc
        except Exception as e:
            print(f"Error loading DXF '{dxf_path}': {e}")
            return None

    def draw_polygon_room(self, msp, vertices, layer_name="0"):
        """
        Draws a polygon room directly when no DXF component exists.
        """
        for i in range(len(vertices)):
            x1, y1 = vertices[i]
            x2, y2 = vertices[(i + 1) % len(vertices)]
            msp.add_line((x1, y1), (x2, y2), dxfattribs={"layer": layer_name})

    def insert_scaled_component(
        self, component_name, target_bbox, polygon_vertices=None, room_id=None, room_type=None
    ):
        """
        Layer 0: Standard Component Inserter.
        - STRICT METERS ONLY.
        - NO AUTO-SCALING.
        - Centers component in target_bbox.
        """
        layer_name = f"ROOM_{room_id}_{room_type}" if room_id and room_type else "0"
        if layer_name != "0" and layer_name not in self.doc.layers:
            self.doc.layers.new(name=layer_name)

        target_min_x, target_min_y, target_max_x, target_max_y = target_bbox

        target_width = target_max_x - target_min_x
        target_height = target_max_y - target_min_y

        # Center of the target slot
        target_cx = (target_min_x + target_max_x) / 2
        target_cy = (target_min_y + target_max_y) / 2

        comp_doc = self.get_component_dxf(component_name)
        if comp_doc is None:
            if polygon_vertices:
                print(
                    f"Component '{component_name}' not found. Drawing polygon directly."
                )
                assert len(polygon_vertices) >= 3, "Invalid polygon room"
                self.draw_polygon_room(self.msp, polygon_vertices, layer_name)
                return
            else:
                raise RuntimeError(
                    f"Component '{component_name}' not found and no polygon provided."
                )

        comp_msp = comp_doc.modelspace()

        # Compute bounding box of component DXF by examining all entity points
        x_coords, y_coords = [], []
        for entity in comp_msp.entity_space:
            try:
                entity_type = entity.dxftype()
                if entity_type == "LWPOLYLINE":
                    if hasattr(entity, "get_points"):
                        for pt in entity.get_points():
                            x_coords.append(pt[0])
                            y_coords.append(pt[1])
            except Exception:
                pass

        if not x_coords or not y_coords:
            # Empty component - HARD FAIL
            raise RuntimeError(
                f"Component '{component_name}' is empty or invalid (no LWPOLYLINE points found)."
            )

        x_min, x_max = min(x_coords), max(x_coords)
        y_min, y_max = min(y_coords), max(y_coords)

        source_width = x_max - x_min
        source_height = y_max - y_min

        src_cx = (x_min + x_max) / 2
        src_cy = (y_min + y_max) / 2

        # Layer 0 Check: Units
        if source_width > 100 or source_height > 100:
             # Likely MM
             print(f"[Warning] Component '{component_name}' is huge ({source_width:.1f}x{source_height:.1f}). DXF likely in MM. Proceeding WITHOUT scaling (Visual error expected if not fixed).")
        
        print(f"Inserting '{component_name}' (Size: {source_width:.2f}x{source_height:.2f}) into slot ({target_width:.2f}x{target_height:.2f})")
        
        # STRICT RULE: NO SCALING. Only Translation.
        dx = target_cx - src_cx
        dy = target_cy - src_cy

        print(f"    Translating by ({dx:.2f}, {dy:.2f}) to center.")
    # received from backend pull
        _STANDARD_LT = {'bylayer', 'byblock', 'continuous'}
        for entity in comp_msp.entity_space:
            try:
                entity_type = entity.dxftype()
                if entity_type == 'LWPOLYLINE':
                    if hasattr(entity, 'get_points'):
                        points = list(entity.get_points())
                        # Translate only
                        translated_pts = [
                            (pt[0] + dx, pt[1] + dy, pt[2] if len(pt) > 2 else 0)
                            for pt in points
                        ]
                        
                        attrs = {}
                        try:
                            attrs = entity.dxf.all_existing_dxf_attributes()
                        except Exception:
                            pass
                        # Normalise linetype to 'Continuous' to prevent undefined LTYPE references in output DXF
                        if attrs.get('linetype', 'bylayer').lower() not in _STANDARD_LT:
                            attrs['linetype'] = 'Continuous'
                            
                        attrs['layer'] = layer_name

                        self.msp.add_lwpolyline(translated_pts, dxfattribs=attrs)

                elif entity_type == 'TEXT':
                    if hasattr(entity, 'dxf'):
                        insert = entity.dxf.insert
                        new_insert = (
                            insert[0] + dx,
                            insert[1] + dy,
                            insert[2] if len(insert) > 2 else 0
                        )
                        attrs = {}
                        try:
                            attrs = entity.dxf.all_existing_dxf_attributes()
                        except Exception:
                            pass
                        # Normalise linetype to 'Continuous' to prevent undefined LTYPE references in output DXF
                        if attrs.get('linetype', 'bylayer').lower() not in _STANDARD_LT:
                            attrs['linetype'] = 'Continuous'

                        attrs['insert'] = new_insert
                        attrs['layer'] = 'TEXT'
                        text_str = entity.dxf.text if hasattr(entity.dxf, 'text') else ''
                        self.msp.add_text(text_str, dxfattribs=attrs)
            except Exception as e:
                print(f"Warning copying {entity.dxftype()}: {e}")
    
    def label_room(self, polygon, room_name):
        """Place room name at polygon centroid so it stays away from shared walls."""
        xs = [p[0] for p in polygon]
        ys = [p[1] for p in polygon]
        xmin, ymin, xmax, ymax = min(xs), min(ys), max(xs), max(ys)
        self.minx = min(self.minx, xmin) if self.minx is not None else xmin
        self.miny = min(self.miny, ymin) if self.miny is not None else ymin
        self.maxx = max(self.maxx, xmax) if self.maxx is not None else xmax
        self.maxy = max(self.maxy, ymax) if self.maxy is not None else ymax
        # received from backend pull
        centroid = Polygon(polygon).centroid
        text_height = 0.2
        # Name sits at centroid y + half text height so name is above dimension
        insert_x = centroid.x - len(room_name) * text_height * 0.3
        insert_y = centroid.y + 0.25

        print(f"    Labeling room '{room_name}' at ({insert_x:.2f}, {insert_y:.2f})")
        name_ent = self.msp.add_text(
            room_name.upper(),
            dxfattribs={
                "insert": (insert_x, insert_y, 0.0),
                "height": text_height,
                "layer": "TEXT",
                "color": 7
            }
        )
        self._last_name_label = name_ent

    def label_dimensions(self, polygon, room_name=""):
        """Place dimension text at room centroid, just below the room name."""
        xs = [p[0] for p in polygon]
        ys = [p[1] for p in polygon]
        xmin, ymin, xmax, ymax = min(xs), min(ys), max(xs), max(ys)

        centroid = Polygon(polygon).centroid
        width = xmax - xmin
        height = ymax - ymin
        dim_text = f"{width:.1f}m x {height:.1f}m"
        text_height = 0.2
        insert_x = centroid.x - len(dim_text) * text_height * 0.3
        insert_y = centroid.y - 0.25  # just below room name

        print(f"    Labeling dimensions '{dim_text}' at ({insert_x:.2f}, {insert_y:.2f})")
        dim_ent = self.msp.add_text(
            dim_text,
            dxfattribs={
                "insert": (insert_x, insert_y, 0.0),
                "height": text_height,
                "layer": "TEXT",
                "color": 7
            }
        )
        if self._last_name_label is not None:
            self._label_pairs.append((self._last_name_label, dim_ent))
            self._last_name_label = None

    def label_apartment(self):
        """Label the entire apartment with total area, notes, direction etc."""
        # Recalculates from actual polygon areas
        rooms = self.structure.get('layout', {}).get('rooms', self.structure.get('rooms', []))
        measured_area = sum(
            Polygon(r['polygon']).area
            for r in rooms
            if 'polygon' in r
        )
        total_area = f"Total Area: {measured_area:.1f} sqm"
        insert_x = self.maxx + 1
        insert_y = (self.maxy+self.miny) / 2
        text_height = 0.2
        self.msp.add_text(
            total_area,
            dxfattribs={
                "insert": (insert_x, insert_y, 0.0),
                "height": text_height,
                "layer": "TEXT",
                "color": 7 # White/Black
            }
        )

    def assemble_from_structure(self):
        """Assemble floor plan by processing rooms and connections from structure.json."""
        if self.structure is None:
            raise RuntimeError("Structure not loaded. Call load_structure() first.")

        print("Assembling floor plan...")

        # Process rooms
        # Support both nested 'layout' and flat structure
        if "layout" in self.structure and "rooms" in self.structure["layout"]:
            rooms = self.structure["layout"]["rooms"]
        elif "rooms" in self.structure:
            rooms = self.structure["rooms"]
        else:
            print("Warning: No rooms found in structure.")
            rooms = []

        # Sort rooms by placement priority: primary rooms first, derived rooms last.
        # Bedrooms and all primary rooms are drawn before bathrooms/balconies so their
        # DXF layers and wall geometry take precedence.
        _ROOM_PRIORITY = {
            "living":    0,
            "bedroom":   1,
            "kitchen":   1,
            "dining":    1,
            "garage":    1,
            "parking":   1,
            "utility":   1,
            "corridor":  1,
            "pantry":    2,
            "storage":   2,
            "bathroom":  2,   # derived — drawn after primary rooms
            "balcony":   2,   # derived — drawn last
        }
        rooms = sorted(rooms, key=lambda r: _ROOM_PRIORITY.get(r.get("type", "").lower(), 1))
        print(f"Processing {len(rooms)} rooms (priority-sorted: primary rooms before bathrooms/balconies)...")
        for room in rooms:
            room_type = room.get("type", "").lower()
            room_id = room.get("id")

            if "polygon" in room:
                polygon = [v for v in room["polygon"] if hasattr(v, '__len__') and len(v) >= 2]
                if len(polygon) < 3:
                    print(f"[WARN] Skipping {room_type} (id={room_id}): polygon has < 3 valid vertices")
                    continue
                bbox = polygon_bbox(polygon)
                print(f"Adding {room_type} (id={room_id}): polygon bounds {bbox}")
                self.insert_scaled_component(room_type, bbox, polygon, room_id, room_type)
                self.label_room(polygon, room_type)
                self.label_dimensions(polygon, room_type)
            else:
                # Legacy fallback - Should we remove this too?
                # User said "Force wall-anchored placement", but this is Layer 1 (Room) assembly.
                # Let's keep it but ensure it doesn't mask errors.
                width = room.get("width", 100)
                height = room.get("height", 100)
                position = room.get("position", [0, 0])
                bbox = (
                    position[0],
                    position[1],
                    position[0] + width,
                    position[1] + height,
                )

                rect_poly = [
                    (position[0], position[1]),
                    (position[0] + width, position[1]),
                    (position[0] + width, position[1] + height),
                    (position[0], position[1] + height),
                ]

                print(
                    f"Adding {room_type} (id={room_id}): {width}x{height} at {position}"
                )
                self.insert_scaled_component(room_type, bbox, rect_poly, room_id, room_type)
        self.label_apartment()
        # Build rooms dict

        # Build rooms dict with Layer 1 Room objects
        rooms_dict = {}
        for r in rooms:
            rid = r.get("id")
            r_type = r.get("type", r.get("rtype", ""))
            shape = r.get("shape", "")
            if "polygon" in r:
                coords = r["polygon"]
                # Ensure closed polygon? Shapely handles it. ezdxf validation?
                rooms_dict[rid] = Room(rid, r_type, coords, shape)
            else:
                pos = r.get("position", [0, 0])
                w = r.get("width", 100)
                h = r.get("height", 100)
                coords = [
                    (pos[0], pos[1]),
                    (pos[0] + w, pos[1]),
                    (pos[0] + w, pos[1] + h),
                    (pos[0], pos[1] + h),
                ]
                rooms_dict[rid] = Room(rid, r_type, coords, shape)

        connections = self.structure.get("doors", [])
        print(connections)
        if connections:
            print(f"Processing {len(connections)} connections...")
            self.create_connections(self.msp, rooms_dict, connections)

        # --- Layer-2 Asset Assembly ---
        print("\n--- Starting Layer-2 Asset Assembly ---")
        # Extract window segments from already-drawn WINDOWS layer entities
        window_segments = []
        for entity in self.msp:
            if entity.dxftype() == "LWPOLYLINE" and entity.dxf.layer == "WINDOWS":
                try:
                    pts = list(entity.get_points())
                    xs = [p[0] for p in pts]
                    ys = [p[1] for p in pts]
                    window_segments.append((min(xs), min(ys), max(xs), max(ys)))
                except Exception:
                    pass
        print(f"[Layer2] Extracted {len(window_segments)} window segment(s) from MSP.")
        asset_assembler = AssetAssembler(self.components, self.asset_dir)
        asset_assembler.assemble_assets(self.msp, rooms_dict, self.door_swings, window_segments=window_segments)

    def detect_shared_wall(self, poly_a, poly_b, tol=1e-6):
        """
        Detects if two polygons share a wall (overlapping edges).
        Args:
            poly_a, poly_b: lists of [x,y] vertices
        Returns:
            (orientation, x, y) or None.
            x,y is the midpoint of the shared segment.
        """
        edges_a = get_polygon_edges(poly_a.polygon_coords)
        edges_b = get_polygon_edges(poly_b.polygon_coords)

        for ea in edges_a:
            for eb in edges_b:
                (ax1, ay1), (ax2, ay2) = ea
                (bx1, by1), (bx2, by2) = eb

                # Check Vertical
                if is_vertical(ea) and is_vertical(eb):
                    # Must be same X
                    if abs(ax1 - bx1) < tol:
                        # Check Y overlap
                        overlap = get_overlap_range(ay1, ay2, by1, by2)
                        if overlap:
                            y_start, y_end = overlap
                            # Midpoint of overlap
                            return ("vertical", ax1, y_start, y_end)
                # Check Horizontal
                if is_horizontal(ea) and is_horizontal(eb):
                    # Must be same Y
                    if abs(ay1 - by1) < tol:
                        # Check X overlap
                        overlap = get_overlap_range(ax1, ax2, bx1, bx2)
                        if overlap:
                            x_start, x_end = overlap
                            return ("horizontal", x_start, x_end, ay1)
        return None

    def detect_exterior_walls(self, rooms_dict, tol=1e-6):
        """Detect all exterior wall segments for all rooms.
        Returns set of (room_id, orientation, (x1, y1), (x2, y2))
        """

        def interval_subtract(base, cuts): # returns list of remaining(start, end)
            cuts = sorted(cuts)
            result = []
            cur = base[0]
            for s, e in cuts:
                if e <= cur:
                    continue
                if s > cur:
                    result.append((cur, min(s, base[1])))
                cur = max(cur, e)
                if cur >= base[1]:
                    break
            if cur < base[1]:
                result.append((cur, base[1]))

            return result

        def normalize_edge(edge):
            (x1, y1), (x2, y2) = edge
            if is_vertical(edge):
                return {"orientation": "vertical", "fixed": round(x1, 6), "span": (round(min(y1, y2), 6), round(max(y1, y2), 6)),}
            if is_horizontal(edge):
                return {"orientation": "horizontal", "fixed": round(y1, 6), "span": (round(min(x1, x2), 6), round(max(x1, x2), 6)),}
            return None

        wall_groups = defaultdict(list)
        for room in rooms_dict.values():
            coords = room.polygon_coords
            room_id = room.id
            for i in range(len(coords)):
                edge = (coords[i], coords[(i + 1) % len(coords)])
                norm = normalize_edge(edge)
                if not norm:
                    continue
                key = (norm["orientation"], norm["fixed"])
                wall_groups[key].append((room_id, norm["span"]))

        exterior_walls = set()
        interior_walls = set()

        for (orientation, fixed), segments in wall_groups.items():
            for room_id, base_span in segments:
                overlaps = []
                for other_room, other_span in segments:
                    if other_room == room_id:
                        continue
                    lo = max(base_span[0], other_span[0])
                    hi = min(base_span[1], other_span[1])
                    if hi - lo > tol:
                        overlaps.append((lo, hi))
                        # add interior segment
                        if orientation == "vertical":
                            p1 = (fixed, lo)
                            p2 = (fixed, hi)
                        else:
                            p1 = (lo, fixed)
                            p2 = (hi, fixed)

                        interior_walls.add((room_id, orientation, p1, p2))

                remaining = interval_subtract(base_span, overlaps)

                for s, e in remaining:
                    if e - s < tol:
                        continue
                    if orientation == "vertical":
                        p1 = (fixed, s)
                        p2 = (fixed, e)
                    else:
                        p1 = (s, fixed)
                        p2 = (e, fixed)
                    exterior_walls.add((room_id, orientation, p1, p2))

        return exterior_walls, interior_walls

    def _ensure_living_entrance(self, msp, rooms_dict, width, exterior):
        living = None
        for room in rooms_dict.values():
            if room.room_type.lower() == "living":
                living = room
                break
        if not living:
            return

        # Use already-computed exterior segments (exact unshared sub-segments)
        for item in exterior:
            if item[0] == living.id:
                living_exterior = [(item[1], item[2], item[3])]
                exterior.remove(item)
                break
        living_exterior = [(orientation, p1, p2) for room_id, orientation, p1, p2 in self.exterior if room_id == living.id]

        # use longest raw edge
        if not living_exterior:
            coords = living.polygon_coords
            best_len = -1
            best_wall = None
            for i in range(len(coords)):
                x1, y1 = coords[i]
                x2, y2 = coords[(i + 1) % len(coords)]
                length = ((x2 - x1) ** 2 + (y2 - y1) ** 2) ** 0.5
                if length > best_len:
                    best_len = length
                    if abs(x1 - x2) < 1e-6:
                        best_wall = ("vertical", (x1, min(y1, y2)), (x1, max(y1, y2)))
                    else:
                        best_wall = ("horizontal", (min(x1, x2), y1), (max(x1, x2), y1))
            if best_wall is None:
                return
            living_exterior = [best_wall]

        # Pick longest segment
        def seg_length(seg):
            _, p1, p2 = seg
            return ((p2[0] - p1[0]) ** 2 + (p2[1] - p1[1]) ** 2) ** 0.5

        chosen_seg = max(living_exterior, key=seg_length)
        orientation, p1, p2 = chosen_seg

        mx = (p1[0] + p2[0]) / 2
        my = (p1[1] + p2[1]) / 2

        self.draw_door(msp, orientation, mx, my, width, living, None, is_entrance=True)

        if not hasattr(self, "_door_positions"):
            self._door_positions = []
        self._door_positions.append((mx, my))


    def _ensure_parking_entrance(self, msp, rooms_dict, width, exterior):

        parking = None
        for room in rooms_dict.values():
            if room.room_type.lower() == "parking":
                parking = room
                break
        if not parking:
            return


        coords = parking.polygon_coords
        parking_walls = []

        for i in range(len(coords)):
            x1, y1 = coords[i]
            x2, y2 = coords[(i + 1) % len(coords)]

            if abs(x1 - x2) < 1e-6:
                orientation = "vertical"
                p1 = (x1, min(y1, y2))
                p2 = (x1, max(y1, y2))
            else:
                orientation = "horizontal"
                p1 = (min(x1, x2), y1)
                p2 = (max(x1, x2), y1)

            parking_walls.append((orientation, p1, p2))

        parking_exterior = []

        for orientation, p1, p2 in parking_walls:
            for room_id, ext_orient, ep1, ep2 in exterior:

                if orientation != ext_orient:
                    continue

                if orientation == "horizontal":
                    if abs(p1[1] - ep1[1]) < 1e-6:
                        if ep1[0] - p1[0] < 1e-6 and ep2[0] - p2[0] > -1e-6:
                            parking_exterior.append((orientation, p1, p2))
                            break

                else:  # vertical
                    if abs(p1[0] - ep1[0]) < 1e-6:
                        if ep1[1] - p1[1] < 1e-6 and ep2[1] - p2[1] > -1e-6:
                            parking_exterior.append((orientation, p1, p2))
                            break

        if not parking_exterior:
            coords = parking.polygon_coords
            best_len = -1
            best_wall = None
            for i in range(len(coords)):
                x1, y1 = coords[i]
                x2, y2 = coords[(i + 1) % len(coords)]
                length = ((x2 - x1) ** 2 + (y2 - y1) ** 2) ** 0.5
                if length > best_len:
                    best_len = length
                    if abs(x1 - x2) < 1e-6:
                        best_wall = ("vertical", (x1, min(y1, y2)), (x1, max(y1, y2)))
                    else:
                        best_wall = ("horizontal", (min(x1, x2), y1), (max(x1, x2), y1))
            if best_wall is None:
                return
            parking_exterior = [best_wall]

        # Pick segment not equal to 6m (if possible)
        def seg_length(seg):
            _, p1, p2 = seg
            return ((p2[0] - p1[0]) ** 2 + (p2[1] - p1[1]) ** 2) ** 0.5


        valid = [s for s in parking_exterior if abs(seg_length(s) - 6) > 1e-3]
        chosen_seg = min(valid if valid else parking_exterior, key=seg_length)
        # chosen_seg = min(parking_exterior, key=seg_length)
        orientation, p1, p2 = chosen_seg

        mx = (p1[0] + p2[0]) / 2
        my = (p1[1] + p2[1]) / 2

        self.draw_parking_door(msp, orientation, mx, my, width, parking, None)

        if not hasattr(self, "_door_positions"):
            self._door_positions = []
        self._door_positions.append((mx, my))


    def _choose_door_position_near_center(self, orientation, wall_data, room_a, room_b):
        """
        Place door near the end of shared wall closest to house center.
        If that position conflicts with an already-placed door (e.g. an attached
        bathroom door next to a bedroom door), fall back to the far end of the wall
        so the door opens towards the wall edge instead.
        """
        # Use house bounding box center as reference
        house_cx = (self.minx + self.maxx) / 2
        house_cy = (self.miny + self.maxy) / 2
        min_door_sep = 1.5  # minimum allowed distance between any two door centres

        if orientation == "vertical":
            wall_x, y_start, y_end = wall_data[1], wall_data[2], wall_data[3]

            dist_to_start = abs(y_start - house_cy)
            dist_to_end   = abs(y_end   - house_cy)

            offset = 0.6
            if dist_to_start < dist_to_end:
                primary_y, alt_y = y_start + offset, y_end - offset
            else:
                primary_y, alt_y = y_end - offset, y_start + offset

            # Fall back to far end if primary clashes with an existing door
            y = primary_y
            for dx, dy in getattr(self, '_door_positions', []):
                if math.hypot(wall_x - dx, primary_y - dy) < min_door_sep:
                    y = alt_y
                    break

            return wall_x, y

        else:  # horizontal
            x_start, x_end, wall_y = wall_data[1], wall_data[2], wall_data[3]

            dist_to_start = abs(x_start - house_cx)
            dist_to_end   = abs(x_end   - house_cx)

            offset = 0.6
            if dist_to_start < dist_to_end:
                primary_x, alt_x = x_start + offset, x_end - offset
            else:
                primary_x, alt_x = x_end - offset, x_start + offset

            # Fall back to far end if primary clashes with an existing door
            x = primary_x
            for dx, dy in getattr(self, '_door_positions', []):
                if math.hypot(primary_x - dx, wall_y - dy) < min_door_sep:
                    x = alt_x
                    break

            return x, wall_y

    def _determine_inward_swing(self, swing_room, door_x, door_y, orientation):
        """
        Determine swing direction AND hinge side based on:
        - Which wall the door is mounted on (perpendicular distance)
        - Which corner the door is nearest to (parallel distance)
        
        Hinge goes on the NEAR side so door opens toward the nearest edge/corner.
        """
        xs = [p[0] for p in swing_room.polygon_coords]
        ys = [p[1] for p in swing_room.polygon_coords]
        
        min_x, max_x = min(xs), max(xs)
        min_y, max_y = min(ys), max(ys)
        
        if orientation == "vertical":
            dist_left  = abs(door_x - min_x)
            dist_right = abs(door_x - max_x)
            swing_dir = "right" if dist_left < dist_right else "left"
            
            dist_bottom = abs(door_y - min_y)
            dist_top    = abs(door_y - max_y)
            hinge_side = "bottom" if dist_bottom < dist_top else "top"
        
        else:  # horizontal
            dist_bottom = abs(door_y - min_y)
            dist_top    = abs(door_y - max_y)
            swing_dir = "up" if dist_bottom < dist_top else "down"
            
            dist_left  = abs(door_x - min_x)
            dist_right = abs(door_x - max_x)
            hinge_side = "left" if dist_left < dist_right else "right"
        
        return swing_dir, hinge_side

    def _calculate_door_geometry(self, orientation, x, y, width, swing_dir, hinge_side):
        """
        Calculate hinge, leaf, and arc for a door that swings 90° into a room.
        
        Args:
            orientation: "vertical" or "horizontal"
            x, y: door center position on wall
            width: door width
            swing_dir: "left"/"right" for vertical, "up"/"down" for horizontal
            hinge_side: "bottom"/"top" for vertical, "left"/"right" for horizontal
        
        Returns:
            (hinge, leaf_end, start_angle, end_angle)
        """
        w = width
        hw = w / 2
        
        if orientation == "vertical":
            
            if swing_dir == "right":
                if hinge_side == "bottom":
                    hinge = (x, y - hw)
                    leaf_end = (x + w, y - hw)
                    start_angle = 0    # East
                    end_angle = 90     # North
                else:  # top
                    hinge = (x, y + hw)
                    leaf_end = (x + w, y + hw)
                    start_angle = 270  # South
                    end_angle = 360    # East
            
            else:  # left
                if hinge_side == "bottom":
                    hinge = (x, y - hw)
                    leaf_end = (x - w, y - hw)
                    start_angle = 90   # North
                    end_angle = 180    # West
                else:  # top
                    hinge = (x, y + hw)
                    leaf_end = (x - w, y + hw)
                    start_angle = 180  # West
                    end_angle = 270    # South
        
        else:  # horizontal
            
            if swing_dir == "up":
                if hinge_side == "left":
                    hinge = (x - hw, y)
                    leaf_end = (x - hw, y + w)
                    start_angle = 0    # East
                    end_angle = 90     # North
                else:  # right
                    hinge = (x + hw, y)
                    leaf_end = (x + hw, y + w)
                    start_angle = 90   # North
                    end_angle = 180    # West
            
            else:  # down
                if hinge_side == "left":
                    hinge = (x - hw, y)
                    leaf_end = (x - hw, y - w)
                    start_angle = 270  # South
                    end_angle = 360    # East
                else:  # right
                    hinge = (x + hw, y)
                    leaf_end = (x + hw, y - w)
                    start_angle = 180  # West
                    end_angle = 270    # South
        
        return hinge, leaf_end, start_angle, end_angle

    def draw_door(self, msp, orientation, x, y, width, room_a, room_b, is_entrance=False):
        """
        Draw realistic hinged door.
        - Internal doors swing into room_b (or non-living/smaller room).
        - Exterior doors (room_b=None) swing inward into room_a.
        """        
        # Decide swing target room
        if room_b is None:
            # Exterior → swing into living/room_a
            swing_room = room_a
        else:
            # Internal → swing into NON-living room (or smaller room)
            if room_a.room_type.lower() == "living":
                swing_room = room_b
            elif room_b.room_type.lower() == "living":
                swing_room = room_a
            else:
                area_a = Polygon(room_a.polygon_coords).area
                area_b = Polygon(room_b.polygon_coords).area
                swing_room = room_a if area_a < area_b else room_b
        
        # Use new helper to determine swing direction (INTO room, away from edges)
        swing_dir, hinge_side = self._determine_inward_swing(swing_room, x, y, orientation)

        hinge, leaf_end, start_angle, end_angle = self._calculate_door_geometry(
            orientation, x, y, width, swing_dir, hinge_side
        )

        dirs = ["N", "E", "S", "W"]
        steps = 0
        if room_a.room_type.lower() == "living" and room_b is None:
            if orientation == "horizontal" and swing_dir!="up":
                steps = 0
            elif orientation == "vertical" and swing_dir!="right":
                steps = 3
            elif orientation == "horizontal" and swing_dir=="up":
                steps = 2
            elif orientation == "vertical" and swing_dir=="right":
                steps = 1

            if self.structure.get("direction") in dirs:
                direction = self.structure.get("direction") 
                current_index = dirs.index(direction)
                new_index = (current_index + steps) % 4
                direction = dirs[new_index]
                self.direction = direction
            else:
                direction = "N"
                self.direction = direction

            # Draw a simple north arrow (triangle pointing up)
            arrow_x = self.maxx + 1.0
            arrow_y = self.maxy + 1.0
            size = 0.6
            msp.add_line((arrow_x - size / 2, arrow_y), (arrow_x + size / 2, arrow_y), dxfattribs={"layer": "TEXT", "color": 7})
            msp.add_line((arrow_x - size / 2, arrow_y), (arrow_x, arrow_y + size), dxfattribs={"layer": "TEXT", "color": 7})
            msp.add_line((arrow_x + size / 2, arrow_y), (arrow_x, arrow_y + size), dxfattribs={"layer": "TEXT", "color": 7})
            msp.add_text(direction, dxfattribs={"insert": (arrow_x - 0.1, arrow_y + size + 0.1, 0), "height": 0.4, "layer": "TEXT", "color": 7})

        
        # Draw door leaf
        msp.add_line(
            hinge,
            leaf_end,
            dxfattribs={"layer": "DOORS", "color": 6},
        )
        
        if end_angle < start_angle:
            end_angle += 360

        msp.add_arc(
            center=hinge,
            radius=width,
            start_angle=start_angle,
            end_angle=end_angle,
            dxfattribs={"layer": "DOORS", "color": 6},
        )
        
        # Register swing for collision system — real angles, hinge stored alongside poly
        swing_poly = build_door_swing(hinge, width, start_angle, end_angle)
        self.door_swings.append((swing_poly, hinge))
        if is_entrance:
            label_offset = 1
            if orientation == "vertical":
                xs = [p[0] for p in room_a.polygon_coords]
                lx = x - label_offset if abs(x - min(xs)) < 0.5 else x + label_offset
                ly = y + 0.15
            else:
                ys = [p[1] for p in room_a.polygon_coords]
                ly = y - label_offset if abs(y - min(ys)) < 0.5 else y + label_offset
                lx = x - 0.4
            msp.add_text(
                "ENTRANCE",
                dxfattribs={"insert": (lx, ly, 0.0), "height": 0.25, "layer": "TEXT", "color": 7}
            )


    def draw_parking_door(self, msp, orientation, x, y, width, room_a, room_b):
        """Draw garage door."""

        thickness = 0.35
        target_room = room_a if room_b is None else room_a
        coords = target_room.polygon_coords

        cx = sum(px for px, _ in coords) / len(coords)
        cy = sum(py for _, py in coords) / len(coords)
        vx = cx - x
        vy = cy - y

        half = width / 2

        if orientation == "vertical":
            nx = -1 if vx > 0 else 1
            points = [
                (x, y - half),
                (x, y + half),
                (x + nx * thickness, y + half),
                (x + nx * thickness, y - half),
            ]

        else:  # horizontal
            ny = -1 if vy > 0 else 1

            points = [
                (x - half, y),
                (x + half, y),
                (x + half, y + ny * thickness),
                (x - half, y + ny * thickness),
            ]

        msp.add_lwpolyline(points, dxfattribs={"layer": "DOORS", "color": 6, "closed": True})


    def draw_window(self, msp, rooms_dict, exterior):
        """Draw all windows"""
        windows = self.structure.get("windows", [])

        target_room_ids = {}
        for w in windows:
            if w["room_id"] not in target_room_ids:
                target_room_ids[w["room_id"]] = {"width": w["width"], "orientation": w["orientation"]}

        for room_id in target_room_ids:
            for r_id, orientation, p1, p2 in exterior:
                if r_id!=room_id:
                    continue
                elif r_id == room_id and \
                (orientation.lower() != target_room_ids[room_id]["orientation"].lower()):
                    target_room_ids[room_id]["orientation"] = orientation.lower() # Override with actual detected orientation
                
                orientation = target_room_ids[room_id]["orientation"]
                width = target_room_ids[room_id]["width"]
                room = rooms_dict[room_id]
                coords = room.polygon_coords

                cx = sum(x for x, _ in coords) / len(coords)
                cy = sum(y for _, y in coords) / len(coords)

                x1, y1 = p1
                x2, y2 = p2

                wall_len = ((x2 - x1) ** 2 + (y2 - y1) ** 2) ** 0.5

                if wall_len < width:
                    continue

                mx = (x1 + x2) / 2
                my = (y1 + y2) / 2
                half = min(width / 2, wall_len / 2 - 0.05)
                thickness = 0.3
                vx = cx - mx
                vy = cy - my

                if orientation == "vertical":
                    nx = -1 if vx > 0 else 1
                    ny = 0
                    win_start = my - half
                    win_end = my + half
                    points1 = [(mx, my - half), (mx, my + half), (mx + nx * thickness, my + half), (mx + nx * thickness, my - half)]
                    points2 = [(mx + nx * (thickness/3), my - half), (mx + nx * (thickness/3), my + half), (mx + nx * (2*thickness/3), my + half), (mx + nx * (2*thickness/3), my - half)]
                else: 
                    nx = 0
                    ny = -1 if vy > 0 else 1
                    win_start = mx - half
                    win_end = mx + half
                    points1 = [(mx - half, my), (mx + half, my), (mx + half, my + ny * thickness), (mx - half, my + ny * thickness)]
                    points2 = [(mx - half, my + ny * (thickness/3)), (mx + half, my + ny * (thickness/3)), (mx + half, my + ny * (2*thickness/3)), (mx - half, my + ny * (2*thickness/3))]

                overlap = False

                for door in getattr(self, "_door_positions", []):
                    if orientation == "vertical":
                        if abs(door[0] - mx) < 0.01:
                            if not (win_end < door[1] or win_start > door[1]):
                                overlap = True
                                break
                    else:
                        if abs(door[1] - my) < 0.01:
                            if not (win_end < door[0] or win_start > door[0]):
                                overlap = True
                                break
                if overlap:
                    continue
                msp.add_lwpolyline(points1, dxfattribs={"layer": "WINDOWS", "color": 5, "closed": True})
                msp.add_lwpolyline(points2, dxfattribs={"layer": "WINDOWS", "color": 5, "closed": True})
                print(f"Added windows to :{room_id} : {target_room_ids[room_id]}")
                break            

    def outer_offset(self, msp, exterior, offset_dist=0.3, tol=1e-6):
        """Join exterior wall segments and offset"""
        segments = []
        for _, _, p1, p2 in exterior:
            segments.append((p1, p2))
        used = set()
        polylines = []

        def points_equal(a, b):
            return abs(a[0] - b[0]) < tol and abs(a[1] - b[1]) < tol

        for i, seg in enumerate(segments):
            if i in used:
                continue

            used.add(i)
            line = [seg[0], seg[1]]

            extended = True
            while extended:
                extended = False
                for j, (a, b) in enumerate(segments):
                    if j in used:
                        continue
                    if points_equal(line[-1], a):
                        line.append(b)
                    elif points_equal(line[-1], b):
                        line.append(a)
                    elif points_equal(line[0], b):
                        line.insert(0, a)
                    elif points_equal(line[0], a):
                        line.insert(0, b)
                    else:
                        continue

                    used.add(j)
                    extended = True

            polylines.append(line)

        for pts in polylines:
            # lw = msp.add_lwpolyline(pts, close=True, dxfattribs={"layer": "0", "color": 7})
            poly = Polygon(pts)
            offset_poly = poly.buffer(offset_dist, join_style=2)
            # buffer() may return MultiPolygon if shape is disconnected — take the largest part
            if offset_poly.geom_type == "MultiPolygon":
                offset_poly = max(offset_poly.geoms, key=lambda g: g.area)
            offset_pts = list(offset_poly.exterior.coords)
            msp.add_lwpolyline(offset_pts, close=True, dxfattribs={"layer": "0", "color": 7})
            return poly

    def inner_offset(self, msp, interior, wall_thickness=0.2):

        lines = []

        for _, _, p1, p2 in interior:
            lines.append(LineString([p1, p2]))

        # merge interior network
        merged = unary_union(lines)

        # buffer = wall thickness
        walls = merged.buffer(wall_thickness/2, cap_style=2, join_style=2)

        if walls.geom_type == "Polygon":
            polys = [walls]
        else:
            polys = list(walls.geoms)

        for poly in polys:

            pts = list(poly.exterior.coords)

            msp.add_lwpolyline(
                pts,
                close=True,
                dxfattribs={"layer": "0", "color": 7}
            )

    def inner_offset_to_rooms(self, msp, rooms_dict, interior, wall_thickness=0.12):

        half = wall_thickness / 2
        offset_lines = []

        for room_id, orientation, p1, p2 in interior:

            line = LineString([p1, p2])
            room_center = rooms_dict[room_id].center

            midpoint = line.interpolate(0.5, normalized=True)
            center_point = Point(room_center)

            # determine side
            if line.distance(center_point) == 0:
                continue

            side = "left"
            if ((p2[0]-p1[0])*(room_center[1]-p1[1]) -
                (p2[1]-p1[1])*(room_center[0]-p1[0])) < 0:
                side = "right"

            offset_line = line.parallel_offset(
                half,
                side,
                join_style=2
            )

            offset_lines.append(offset_line)

        merged = unary_union(offset_lines)

        if merged.geom_type == "LineString":
            merged = [merged]
        else:
            merged = list(merged.geoms)

        for line in merged:
            pts = list(line.coords)
            msp.add_lwpolyline(pts, dxfattribs={"layer": "0", "color": 7})

    def build_walls_from_rooms(self, msp, rooms_dict, wall_thickness=0.12):

        room_polys = []

        for room in rooms_dict.values():
            pts = room.polygon   # ordered room boundary points
            poly = Polygon(pts)
            room_polys.append(poly)

        shrunk_rooms = []

        for poly in room_polys:
            shrunk = poly.buffer(-wall_thickness/2)
            if not shrunk.is_empty:
                shrunk_rooms.append(shrunk)

        # Bridge small gaps between rooms (imperfect LLM tiling) so the building
        # stays one connected shape — prevents separate wall frame per island.
        building = unary_union([p.buffer(0.02) for p in room_polys]).buffer(-0.02)
        if building.is_empty:
            building = unary_union(room_polys)
        interior_space = unary_union(shrunk_rooms)
        walls = building.difference(interior_space)
        if walls.geom_type == "Polygon":
            polys = [walls]
        else:
            polys = list(walls.geoms)

        for poly in polys:
            pts = list(poly.exterior.coords)
            msp.add_lwpolyline(pts,close=True, dxfattribs={"layer": "0", "color": 7})
            print(f"Added wall to {poly} with {len(pts)} points")

    def create_connections(self, msp, rooms_dict, connections):
        """
        Inserts door openings between rooms based on connection metadata.
        """
        # Reset door position tracking for this assembly
        self._door_positions = []
        living_width = 1.0
        parking_width = 3.5

        for conn in connections:
            print(conn)
            
            id_a = conn.get("from_room")
            id_b = conn.get("to_room")
            width = conn.get("width", 1.0)
            
            if id_b.lower() in ["outside","exterior", "external", "ext"]:
                r1 = rooms_dict[id_a]
                r2 = None
                if r1.room_type.lower() in ["living", "living_room"]:
                    living_width = width
            elif id_a.lower() in ["outside", "exterior", "external", "ext"]:
                r1 = rooms_dict[id_b]
                r2 = None
                if r1.room_type.lower() in ["living", "living_room"]:
                    living_width = width
            else:
                r1 = rooms_dict[id_a]
                r2 = rooms_dict[id_b]

            if r2 is not None and (r1.room_type.lower() == "balcony" or r2.room_type.lower() == "balcony" or\
                                r1.room_type.lower() == "parking" or r2.room_type.lower() == "parking"):
                width = min(width, 0.9)

            # Detect shared wall
            if r2 is not None:
                result = self.detect_shared_wall(r1, r2)
            else:
                result = None
                
            print(result)
            
            if result:
                orientation = result[0]
                
                # Use room centers to choose door position
                x, y = self._choose_door_position_near_center(orientation, result, r1, r2)
                
                self.draw_door(msp, orientation, x, y, width, r1, r2)
                self._door_positions.append((x, y))
        # Ensure living room entrance after all internal doors
        self.exterior, self.interior = self.detect_exterior_walls(rooms_dict)
        exterior_poly = self.outer_offset(msp, self.exterior)
        self.build_walls_from_rooms(msp, rooms_dict, wall_thickness=0.12)
        # self.build_inner_walls(msp, self.interior, exterior_poly, wall_thickness=0.12)
        # self.inner_offset(msp, self.interior)
        self._ensure_living_entrance(msp, rooms_dict, living_width, self.exterior)
        self._ensure_parking_entrance(msp, rooms_dict, parking_width, self.exterior)
        self.draw_window(msp, rooms_dict, self.exterior)

    def _resolve_label_overlaps(self, msp):
        """Iteratively move overlapping room labels toward their room centroids until minimum gap is satisfied."""
        MIN_GAP = 0.15          # metres — minimum clear gap between any two label bounding boxes
        STEP = 0.05             # metres moved per iteration toward own room centroid
        MAX_ITERS = 200
        CHAR_WIDTH_RATIO = 0.6  # estimated char width relative to text height

        rooms = []
        if self.structure:
            rooms = self.structure.get('layout', {}).get('rooms', self.structure.get('rooms', []))
        room_centroids = []
        for r in rooms:
            if 'polygon' in r:
                poly_pts = r['polygon']
                cx = sum(p[0] for p in poly_pts) / len(poly_pts)
                cy = sum(p[1] for p in poly_pts) / len(poly_pts)
                room_centroids.append((cx, cy))

        # Collect room-label and dimension TEXT entities (exclude compass/entrance/total)
        labels = []
        for e in msp:
            if e.dxftype() != 'TEXT':
                continue
            if e.dxf.layer != 'TEXT':
                continue
            text = e.dxf.text.strip()
            if not text:
                continue
            text_up = text.upper()
            if text_up == 'ENTRANCE':
                continue
            if len(text_up) == 1:       # single-char compass letters N/S/E/W
                continue
            if text_up.startswith('TOTAL'):
                continue
            labels.append(e)

        if len(labels) < 2:
            return

        def get_insert(e):
            ins = e.dxf.insert
            return float(ins[0]), float(ins[1])

        def set_insert(e, x, y):
            e.dxf.insert = (x, y, 0.0)

        def label_bbox(e):
            ix, iy = get_insert(e)
            h = float(e.dxf.height) if e.dxf.hasattr('height') else 0.2
            w = len(e.dxf.text) * h * CHAR_WIDTH_RATIO
            return (ix, iy, ix + w, iy + h)

        def find_centroid(e):
            ix, iy = get_insert(e)
            best_dist = float('inf')
            best_c = (ix, iy)
            for cx, cy in room_centroids:
                d = math.hypot(cx - ix, cy - iy)
                if d < best_dist:
                    best_dist = d
                    best_c = (cx, cy)
            return best_c

        # Pair each dimension label with its nearest room name label, then build units.
        # A unit is [name, dim] for a pair, or [single_label] for unpaired labels.
        # Units move as a rigid group so name/dim offset is always preserved.
        # Use pairs recorded at label-creation time — exact, no proximity guessing
        pairs = {}
        for name_ent, dim_ent in self._label_pairs:
            pairs[id(name_ent)] = dim_ent
            pairs[id(dim_ent)] = name_ent

        processed_ids = set()
        units = []
        for e in labels:
            if id(e) in processed_ids:
                continue
            processed_ids.add(id(e))
            partner = pairs.get(id(e))
            if partner is not None and id(partner) not in processed_ids:
                processed_ids.add(id(partner))
                # Store as [name, dim]
                if 'm x' in e.dxf.text.lower():
                    units.append([partner, e])
                else:
                    units.append([e, partner])
            else:
                units.append([e])

        def unit_bbox(unit):
            bboxes = [label_bbox(e) for e in unit]
            return (min(b[0] for b in bboxes), min(b[1] for b in bboxes),
                    max(b[2] for b in bboxes), max(b[3] for b in bboxes))

        def needs_separation(b1, b2):
            sep_x = max(0.0, max(b1[0], b2[0]) - min(b1[2], b2[2]))
            sep_y = max(0.0, max(b1[1], b2[1]) - min(b1[3], b2[3]))
            if sep_x == 0.0 and sep_y == 0.0:
                return True  # boxes intersect
            dist = math.hypot(sep_x, sep_y) if (sep_x > 0.0 and sep_y > 0.0) else (sep_x + sep_y)
            return dist < MIN_GAP

        resolved_in = MAX_ITERS
        for iteration in range(MAX_ITERS):
            any_overlap = False
            for i in range(len(units)):
                for j in range(i + 1, len(units)):
                    bi = unit_bbox(units[i])
                    bj = unit_bbox(units[j])
                    if not needs_separation(bi, bj):
                        continue
                    any_overlap = True
                    # Push the two units apart using pure repulsion (no centroid attraction).
                    # Repulsion avoids the convergence that centroid-pull causes for stacked pairs.
                    mi_x = (bi[0] + bi[2]) / 2
                    mi_y = (bi[1] + bi[3]) / 2
                    mj_x = (bj[0] + bj[2]) / 2
                    mj_y = (bj[1] + bj[3]) / 2
                    rdx, rdy = mi_x - mj_x, mi_y - mj_y
                    rdist = math.hypot(rdx, rdy)
                    if rdist > 1e-6:
                        step_x = STEP * rdx / rdist
                        step_y = STEP * rdy / rdist
                    else:
                        step_x, step_y = STEP, 0.0
                    for unit, sign in [(units[i], 1), (units[j], -1)]:
                        for e in unit:
                            ex, ey = get_insert(e)
                            set_insert(e, ex + sign * step_x, ey + sign * step_y)
            if not any_overlap:
                resolved_in = iteration
                break

        print(f"[label_overlap] Resolved in {resolved_in} iteration(s), {len(units)} unit(s) checked.")

    def export(self, output_path, export_image=True, image_dpi=150):
        """Export the assembled floor plan to a DXF file and optionally export a raster image.

        Args:
            output_path: Path where to save the final DXF file
            export_image: If True, attempt to also render and save a PNG image
            image_dpi: DPI to use when saving the image
        """
        if self.doc is None:
            raise RuntimeError("No document created. Call create_new_document() first.")

        directory = os.path.dirname(output_path)
        if directory:
            os.makedirs(directory, exist_ok=True)

        # Sanitize: normalise any non-standard linetype on every entity to 'Continuous'
        _STANDARD_LT = {'bylayer', 'byblock', 'continuous'}
        msp = self.doc.modelspace()
        for _e in msp:
            try:
                if _e.dxf.hasattr('linetype') and _e.dxf.linetype.lower() not in _STANDARD_LT:
                    _e.dxf.linetype = 'Continuous'
            except Exception:
                pass
        for _lt_name in [_lt.dxf.name for _lt in self.doc.linetypes if _lt.dxf.name.lower() not in _STANDARD_LT]:
            try:
                self.doc.linetypes.remove(_lt_name)
            except Exception:
                pass

        # Resolve overlapping room labels before saving
        self._resolve_label_overlaps(msp)

        self.doc.saveas(output_path)
        print(f"Exported floor plan to {output_path}")

        # Try to export an image (PNG) with the same basename as the DXF
        if export_image:
            try:
                self.export_image(output_path, dpi=image_dpi)
                print(f"Exported floor plan image to {os.path.splitext(output_path)[0] + '.png'}")
            except Exception as e:
                print(f"Warning: image export failed: {e}")

    def assemble_and_export(self,structure , output_path, export_image=True, image_dpi=150):
        """Run the complete assembly pipeline: load, assemble, export.

        Args:
            output_path: Path where to save the final DXF file
            export_image: If True, also attempt to export a PNG image with same basename
            image_dpi: DPI to use when saving the PNG image
        """
        self.load_structure(structure)
        self.load_components_from_csv()
        self.create_new_document()
        self.assemble_from_structure()
        self.export(output_path, export_image=export_image, image_dpi=image_dpi)
        self.export_image(output_path, dpi = image_dpi)


if __name__ == "__main__":
    import sys

    # Default paths
    structure_json = os.path.join("data", "samples", "test_structure.json")
    csv_file = os.path.join("data", "samples", "data.csv")
    asset_directory = os.path.join("data", "asset")
    output_dxf = os.path.join("data", "asset", "floorplan.dxf")

    # Override defaults if args provided
    if len(sys.argv) > 1:
        structure_json = sys.argv[1]
    if len(sys.argv) > 2:
        output_dxf = sys.argv[2]

    print(f"Using structure: {structure_json}")
    print(f"Output DXF: {output_dxf}")

    assembler = FloorPlanAssembler(csv_file, asset_directory)

    try:
        with open(structure_json, "r", encoding="utf-8") as f:
            structure_data = f.read()

        assembler.assemble_and_export(structure_data, output_dxf)
        print(f"\nFloor plan assembly complete!")
    except Exception as e:
        print(f"Error: {e}")
        import traceback

        traceback.print_exc()