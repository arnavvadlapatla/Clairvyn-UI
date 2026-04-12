import unittest
from shapely.geometry import Polygon
from src.app.core.asset_validation import asset_to_polygon, validate_asset_collision, create_polygon_from_bbox

class TestAssetCollision(unittest.TestCase):
    def test_asset_to_polygon(self):
        # 0,0, 10,10, rot 0 -> Box at 0,0 to 10,10
        poly = asset_to_polygon(0, 0, 10, 10, 0)
        self.assertEqual(poly.area, 100)
        self.assertEqual(poly.bounds, (0, 0, 10, 10))

        # Translate
        poly = asset_to_polygon(20, 20, 10, 10, 0)
        self.assertEqual(poly.bounds, (20, 20, 30, 30))

    def test_collision_overlap(self):
        poly1 = asset_to_polygon(0, 0, 10, 10, 0)
        poly2 = asset_to_polygon(5, 5, 10, 10, 0) # Overlaps
        
        valid, reason = validate_asset_collision(poly2, [poly1], clearance=0)
        self.assertFalse(valid)
        self.assertIn("Asset overlaps", reason)

    def test_collision_clearance(self):
        poly1 = asset_to_polygon(0, 0, 10, 10, 0)
        poly2 = asset_to_polygon(10.01, 0, 10, 10, 0) # Very close, 0.01 gap
        
        # With 0.05 clearance, should fail
        valid, reason = validate_asset_collision(poly2, [poly1], clearance=0.05)
        self.assertFalse(valid)
        
        # With 0 clearance, should pass
        valid, reason = validate_asset_collision(poly2, [poly1], clearance=0.0)
        self.assertTrue(valid)

    def test_valid_placement(self):
        poly1 = asset_to_polygon(0, 0, 10, 10, 0)
        poly2 = asset_to_polygon(20, 0, 10, 10, 0) # Far away
        
        valid, reason = validate_asset_collision(poly2, [poly1])
        self.assertTrue(valid)

if __name__ == '__main__':
    unittest.main()
