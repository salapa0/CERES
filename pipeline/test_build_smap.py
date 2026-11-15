import unittest

from build_smap import cell_means, index_range, mean_of, parse_rows

# Real NSIDC cloud OPeNDAP ASCII response (coordinates of a SPL4SMGP v8 granule, every 200th row).
COORDS = """Dataset: SMAP_L4_SM_gph_20261110T223000_Vv8013_001.h5
cell_lon[0], -179.953, -142.609, -105.265, -67.9201, -30.5757, 6.76867, 44.1131, 81.4575, 118.802, 156.146
cell_lat[0], 84.6564
cell_lat[1], 48.7383
cell_lat[2], 30.4342
"""


class SmapTest(unittest.TestCase):
    def test_parse_rows(self):
        self.assertEqual(parse_rows(COORDS, "cell_lat"), {0: [84.6564], 1: [48.7383], 2: [30.4342]})
        self.assertEqual(len(parse_rows(COORDS, "cell_lon")[0]), 10)
        text = "Dataset: x\nGeophysical_Data_sm_rootzone[0], 0.2, -9999\nGeophysical_Data_sm_rootzone[1], 0.3, 0.4\n"
        self.assertEqual(parse_rows(text, "sm_rootzone"), {0: [0.2, -9999.0], 1: [0.3, 0.4]})

    def test_index_range_on_descending_latitudes(self):
        lats = [20.0, 19.9, 19.8, 19.7, 19.6]
        self.assertEqual(index_range(lats, 19.65, 19.95), (1, 3))

    def test_cell_means_skip_fill_and_outside_pixels(self):
        lats, lons = [16.6, 16.4, 15.0], [102.4, 102.6]
        values = [[0.2, 0.3], [-9999.0, 0.4], [0.9, 0.9]]
        cells = [{"id": "a", "lat": 16.5, "lon": 102.5}, {"id": "b", "lat": 10.0, "lon": 102.5}]
        got = cell_means(values, lats, lons, cells, 0.25, 0.3125)
        self.assertAlmostEqual(got["a"], 0.3)
        self.assertIsNone(got["b"])

    def test_mean_of_granules(self):
        self.assertEqual(mean_of([{"a": 0.2, "b": None}, {"a": 0.4, "b": None}]), {"a": 0.30000000000000004, "b": None})


if __name__ == "__main__":
    unittest.main()
