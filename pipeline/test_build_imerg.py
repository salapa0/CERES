import datetime as dt
import unittest
from build_imerg import PRODUCT, cell_means, parse_ascii, pixel_index, plan_fetch, previous_by_day

START = dt.date(2026, 8, 1)


def day(n):
    return START + dt.timedelta(n)


def previous(days=5, cells=("a", "b"), start="2026-08-01", product=PRODUCT, nulls=()):
    """A file as the last deploy wrote it: day n of the season holds n + 1 mm in every cell, or null."""
    return {"product": product, "start": start, "asOf": day(days - 1).isoformat(),
            "cells": {c: [None if n in nulls else float(n + 1) for n in range(days)] for c in cells}}

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


class ReuseTest(unittest.TestCase):
    def test_reads_the_previous_file_back_by_day(self):
        known = previous_by_day(previous(), START, ["a", "b"])
        self.assertEqual(sorted(known), [day(n) for n in range(5)])
        self.assertEqual(known[day(2)], {"a": 3.0, "b": 3.0})

    def test_a_day_with_no_data_is_not_known_so_it_is_fetched_again(self):
        self.assertNotIn(day(2), previous_by_day(previous(nulls=(2,)), START, ["a", "b"]))

    def test_ignores_a_file_from_another_season_product_or_grid(self):
        for bad in (previous(start="2025-08-01"), previous(product="something else"), previous(cells=("a",)),
                    None, {}, {"product": PRODUCT, "start": "2026-08-01", "cells": 3}):
            self.assertEqual(previous_by_day(bad, START, ["a", "b"]), {}, bad)


class PlanTest(unittest.TestCase):
    have = [day(n) for n in range(10)]

    def test_with_nothing_known_fetches_every_day(self):
        self.assertEqual(plan_fetch(self.have, {}), self.have)

    def test_fetches_only_new_days_and_the_last_three_known_again(self):
        known = {day(n): {"a": 1.0} for n in range(6)}  # days 0–5 known; NASA may still correct the latest
        self.assertEqual(plan_fetch(self.have, known), [day(n) for n in range(3, 10)])

    def test_fetches_a_missing_day_in_the_middle(self):
        known = {day(n): {"a": 1.0} for n in range(10) if n != 1}
        self.assertEqual(plan_fetch(self.have, known), [day(1), day(7), day(8), day(9)])

    def test_nothing_new_still_refreshes_the_last_three(self):
        known = {d: {"a": 1.0} for d in self.have}
        self.assertEqual(plan_fetch(self.have, known), [day(7), day(8), day(9)])


if __name__ == "__main__":
    unittest.main()
