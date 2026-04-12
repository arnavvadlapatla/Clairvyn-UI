from shapely.geometry import Polygon, LineString, Point
import math

class Room:
    """
    Layer 1: Room Semantic Model.
    Wraps geometry with architectural meaning.
    """
    def __init__(self, room_id, room_type, polygon_coords, shape):
        self.id = room_id
        self.room_type = room_type.lower()
        self.room_shape = shape
        # Clean coords: filter malformed vertices from LLM output (e.g. [10.5] with only 1 element)
        self.polygon_coords = [
            (float(v[0]), float(v[1]))
            for v in polygon_coords
            if isinstance(v, (list, tuple)) and len(v) >= 2
        ]
        if len(self.polygon_coords) < 3:
            raise ValueError(
                f"Room {room_id} has < 3 valid vertices after cleaning: {polygon_coords}"
            )
        self.polygon = Polygon(self.polygon_coords)
        
        # Geometry Cache
        self.min_x, self.min_y, self.max_x, self.max_y = self.polygon.bounds
        self.width = self.max_x - self.min_x
        self.height = self.max_y - self.min_y
        self.center = (self.min_x + self.width/2, self.min_y + self.height/2)
        
        # Walls
        self.walls = self._extract_walls()
        self.entry_wall = None # To be set by assembler based on door connections?
        self.occupied = []  # Tracks placed asset polygons (used by asset assembler)
        
    def _extract_walls(self):
        """Returns list of ((x1,y1), (x2,y2)) tuples."""
        walls = []
        pts = self.polygon_coords
        n = len(pts)
        for i in range(n):
            p1 = pts[i]
            p2 = pts[(i + 1) % n]
            walls.append((p1, p2))
        return walls

    def get_longest_wall(self):
        """Returns the longest wall segment."""
        return max(self.walls, key=lambda w: math.hypot(w[1][0]-w[0][0], w[1][1]-w[0][1]))

    def get_primary_wall(self):
        """
        Returns the architecturally 'primary' wall for this room type.
        E.g. Bedroom -> Longest wall (usually) or wall opposite entry.
        Kitchen -> Longest wall or wall with specific adjacency.
        """
        # For now, default to longest wall, but filter out Entry Wall if set
        candidates = list(self.walls)
        if self.entry_wall:
            # Filter out entry wall (approx match)
            candidates = [w for w in candidates if w != self.entry_wall]
            
        if not candidates: return self.get_longest_wall()
        
        return max(candidates, key=lambda w: math.hypot(w[1][0]-w[0][0], w[1][1]-w[0][1]))
    
    def get_wall_opposite(self, wall):
        """Finds wall roughly parallel and opposite to given wall."""
        # Simple heuristic for rectangles
        (x1, y1), (x2, y2) = wall
        cx, cy = (x1+x2)/2, (y1+y2)/2
        dx = cy - self.center[1] 
        dy = -(cx - self.center[0]) # Perpendicular vector
        # Cast ray? Or just find wall with normal facing opposite?
        # For now, return None (Placeholder)
        return None

    def __repr__(self):
        return f"Room(id={self.id}, type={self.room_type}, bounds={self.width:.2f}x{self.height:.2f})"
