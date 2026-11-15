import datetime as dt
import unittest

from build_gldas import cell_daily, parse_series, pixel_centres, season_array

# Real Giovanni response for GLDAS RootMoist at (16.375, 102.625), shortened.
SAMPLE = """prod_name,GLDAS_NOAH025_3H.2.1
doi,10.5067/E7TYRXPJKWOQ
param_short_name,RootMoist_inst
param_name,Root zone soil moisture
unit,kg m-2
undef,-9999
begin_time,2024-11-01 00:00:00
end_time,2024-11-03 00:00:00
lat,16.375
lon,102.625
lat_resolution,0.25
lon_resolution,0.25
mean,2.3860e+02
Request_time,2026-11-15 04:43:28
Timestamp (UTC),Data
2024-11-01 00:00,242.282
2024-11-01 03:00,241.922
2024-11-01 06:00,240.668
2024-11-01 09:00,239.613
2024-11-01 12:00,239.467
2024-11-01 15:00,239.499
2024-11-01 18:00,239.532
2024-11-01 21:00,239.671
2024-11-02 00:00,-9999
2024-11-02 03:00,239.129
"""


class GldasTest(unittest.TestCase):
    def test_pixel_centres_inside_the_cell(self):
        # Cell 16.5, 102.5 spans 16.25–16.75 and 102.1875–102.8125.
        self.assertEqual(pixel_centres(16.5, 102.5, 0.25, 0.3125),
                         [(16.375, 102.375), (16.375, 102.625), (16.625, 102.375), (16.625, 102.625)])
        # Cell 16.5, 103.125 spans 102.8125–103.4375: three columns.
        self.assertEqual(len(pixel_centres(16.5, 103.125, 0.25, 0.3125)), 6)

    def test_parse_series_daily_means_without_fill(self):
        days = parse_series(SAMPLE)
        self.assertAlmostEqual(days[dt.date(2024, 11, 1)], 240.332, places=3)
        self.assertAlmostEqual(days[dt.date(2024, 11, 2)], 239.129, places=3)  # the -9999 is dropped

    def test_cell_mean_and_season_alignment(self):
        a = {dt.date(2024, 8, 1): 100.0, dt.date(2024, 8, 2): 110.0}
        b = {dt.date(2024, 8, 1): 120.0}
        daily = cell_daily([a, b])
        self.assertEqual(season_array(daily, dt.date(2024, 8, 1), 3), [110.0, 110.0, None])


if __name__ == "__main__":
    unittest.main()
