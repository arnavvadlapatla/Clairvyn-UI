##### NOT A STANDALONE SCRIPT. ONLY FOR TESTING PURPOSES. #####

import os 
import ezdxf
import matplotlib.pyplot as plt
from ezdxf.addons.drawing import RenderContext, Frontend
import ezdxf.bbox as bbox
import ezdxf.layouts as Layouts
from pydoc import doc
import matplotlib.pyplot as plt

def export_image(self,dxf_path: str, dpi: int = 300):
        png_path = os.path.splitext(dxf_path)[0] + ".png"
        doc=self.doc
        msp = self.doc.modelspace()
        print("\n--- ENTITY TYPES IN MODELSPACE ---")
        for e in msp:
            print(e.dxftype())
        print("-----------------------------------\n")
        # Find all LWPOLYLINE in modelspace
        polylines = msp.query("LWPOLYLINE")

        print(f"Found {len(polylines)} LWPOLYLINE entities.")

        for poly in polylines:
            poly.rgb = (0, 0, 0) 
            # --- basic debug info ---
            print("Total entities in modelspace:", len(msp))
            print("Layers:")
        for layer in doc.layers:  # LayerTable is iterable [web:53][web:57]
            print(
                f"  {layer.dxf.name}: on={layer.is_on()}, "
                f"frozen={layer.is_frozen()}, locked={layer.is_locked()}, "
                f"color={layer.color}"
            )

        # --- compute bounding box of all entities ---
        ext = bbox.extents(msp)  # None if no plottable entities [web:38]
        if ext is None:
            print("No extents found; ezdxf sees no plottable entities in modelspace.")
        else:
            print("Extents:", ext.extmin, "->", ext.extmax)

        # --- figure / axes ---
        fig = plt.figure(figsize=(8, 8), dpi=dpi)
        ax = fig.add_axes([0, 0, 1, 1])

        ctx = RenderContext(doc)
        msp_props = LayoutProperties.from_layout(msp)
        msp_props.set_colors(bg="#FFFFFFFF", fg="#000000FF")  # white bg, black fg
        backend = MatplotlibBackend(ax)
        frontend = Frontend(ctx, backend)
        frontend.draw_layout(msp, layout_properties=msp_props, finalize=True)

        # If we have extents, zoom to them
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


        fig.savefig(
            png_path,
            dpi=dpi,
            facecolor="#FFFFFFFF",
            bbox_inches="tight",
            pad_inches=0.01,
        )
        plt.close(fig)


def insert_scaled_component(self, component_name, target_bbox, polygon_vertices=None):
        """
        Layer 0: Standard Component Inserter.
        - STRICT METERS ONLY.
        - NO AUTO-SCALING.
        - Centers component in target_bbox.
        """
        target_min_x, target_min_y, target_max_x, target_max_y = target_bbox
        
        target_width = target_max_x - target_min_x
        target_height = target_max_y - target_min_y
        
        # Center of the target slot
        target_cx = (target_min_x + target_max_x) / 2
        target_cy = (target_min_y + target_max_y) / 2
        
        comp_doc = self.get_component_dxf(component_name)
        if comp_doc is None:
            if polygon_vertices:
                print(f"Component '{component_name}' not found. Drawing polygon directly.")
                assert len(polygon_vertices) >= 3, "Invalid polygon room"
                self.draw_polygon_room(self.msp, polygon_vertices)
                return
            else:
                raise RuntimeError(f"Component '{component_name}' not found and no polygon provided.")

        comp_msp = comp_doc.modelspace()
        
        # Compute bounding box of component DXF by examining all entity points
        x_coords, y_coords = [], []
        for entity in comp_msp.entity_space:
            try:
                entity_type = entity.dxftype()
                if entity_type == 'LWPOLYLINE':
                    if hasattr(entity, 'get_points'):
                        for pt in entity.get_points():
                            x_coords.append(pt[0])
                            y_coords.append(pt[1])
            except Exception:
                pass
        
        if not x_coords or not y_coords:
            # Empty component - HARD FAIL
            raise RuntimeError(f"Component '{component_name}' is empty or invalid (no LWPOLYLINE points found).")
        
        x_min, x_max = min(x_coords), max(x_coords)
        y_min, y_max = min(y_coords), max(y_coords)
        
        source_width = (x_max - x_min)
        source_height = (y_max - y_min)
        
        src_cx = (x_min + x_max) / 2
        src_cy = (y_min + y_max) / 2
        
        # Layer 0 Check: Units
        if source_width > 100 or source_height > 100:
             # Likely MM
             print(f"[Warning] Component '{component_name}' is huge ({source_width:.1f}x{source_height:.1f}). DXF likely in MM. Proceeding WITHOUT scaling (Visual error expected if not fixed).")
        
        print(f"  Inserting '{component_name}' (Size: {source_width:.2f}x{source_height:.2f}) into slot ({target_width:.2f}x{target_height:.2f})")
        
        # STRICT RULE: NO SCALING. Only Translation.
        dx = target_cx - src_cx
        dy = target_cy - src_cy
        
        print(f"    Translating by ({dx:.2f}, {dy:.2f}) to center.")

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
                        
                        attrs['insert'] = new_insert
                        text_str = entity.dxf.text if hasattr(entity.dxf, 'text') else ''
                        self.msp.add_text(text_str, dxfattribs=attrs)
            except Exception as e:
                print(f"Warning: Failed to copy entity {entity_type}: {e}")


def dxf_to_png(input_path, output_path):
    doc = ezdxf.readfile(input_path)
    msp = doc.modelspace()
    for layer in doc.layers:
        print(layer.dxf.name, "is_on:", layer.is_on(), "is_frozen:", layer.is_frozen())
    

    plt.imsave(output_path, plt.imread(input_path))
    

import ezdxf
import matplotlib.pyplot as plt
from ezdxf.addons.drawing import RenderContext, Frontend
from ezdxf.addons.drawing.matplotlib import MatplotlibBackend
from ezdxf.bbox import extents
from ezdxf.addons.drawing import matplotlib
import matplotlib.pyplot as plt

doc = ezdxf.readfile(r"C:\Users\sprih\OneDrive\Desktop\clairvyn2\V-1.0\data\generated\2ea7b858_0.dxf")
msp = doc.modelspace()
dxf_to_png(r"C:\Users\sprih\OneDrive\Desktop\clairvyn2\V-1.0\data\generated\2ea7b858_0.dxf", r"C:\Users\sprih\OneDrive\Desktop\clairvyn2\V-1.0\data\generated\2ea7b858_0.png")
# Large figure so tiny coordinates are visible
fig = plt.figure(figsize=(10, 8), dpi=300)

plt.gca().set_aspect("equal", adjustable="box")
plt.gca().axis("off")

plt.savefig("output.png", dpi=300, facecolor="white")
plt.close(fig)

print("Saved PNG")