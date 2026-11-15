import unittest
from build_imerg import cell_means, parse_ascii, pixel_index

SAMPLE = """Dataset: 3B-DAY-L.MS.MRG.3IMERG.20261101-S000000-E235959.V07C.nc4
precipitation.lat, 15.55, 15.65, 15.75
precipitation.precipitation[precipitation.time=17101][precipitation.lon=97.05], 25.39, 31.63, 7.3
precipitation.precipitation[precipitation.time=17101][precipitation.lon=97.15], 3.97, 15.325, 10.33
precipitation.precipitation[precipitation.time=17101][precipitation.lon=97.25], 0.955, 5.6, -9999.9
lon, 97.05, 97.15, 97.25
lat, 15.55, 15.65, 15.75
"""


class ParseTest(unittest.TestCase):
    def test_reads_rain_by_lon_and_lat_and_drops_fill_values(self):
        rain = parse_ascii(SAMPLE)
        self.assertEqual(rain[(97.05, 15.55)], 25.39)
        self.assertEqual(rain[(97.15, 15.75)], 10.33)
        self.assertNotIn((97.25, 15.75), rain)
        self.assertEqual(len(rain), 8)

    def test_pixel_index_matches_the_grid_ges_disc_served(self):
        self.assertEqual(pixel_index(97.05, 15.55), (2770, 1055))

    def test_cell_mean_averages_pixels_inside_the_cell(self):
        rain = parse_ascii(SAMPLE)
        cells = [{"id": "a", "lat": 15.6, "lon": 97.1}, {"id": "far", "lat": 10.0, "lon": 100.0}]
        means = cell_means(rain, cells, half_lat=0.25, half_lon=0.3125)
        self.assertAlmostEqual(means["a"], sum(rain.values()) / 8, places=3)
        self.assertIsNone(means["far"])


if __name__ == "__main__":
    unittest.main()
