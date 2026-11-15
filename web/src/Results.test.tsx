import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import type { CellData, Num, SeasonData } from './engine';
import { Results } from './Results';

function season(year: number, rain: number, wetness: Num): SeasonData {
  const n = new Date(Date.UTC(year + 1, 1, 29)).getUTCMonth() === 1 ? 366 : 365;
  const fill = <T,>(v: T) => Array.from({ length: n }, () => v);
  return { year, start: `${year}-08-01`, rain: fill(rain), tmax: fill(33), tmin: fill(22), wetness: fill(wetness) };
}
const cell = (seasons: SeasonData[]): CellData => ({
  id: '16.50_102.500', lat: 16.5, lon: 102.5, sources: { rain: 'NASA POWER PRECTOTCORR (0.5°×0.625°)' },
  wetnessScale: { p05: 0.3, p95: 0.8 }, seasons,
});

test('shows three strategy cards and four crop rows with Buddhist-era seasons', () => {
  render(<Results cell={cell([season(2015, 5, 0.8), season(2016, 5, 0.8)])} lang="th" />);
  expect(screen.getAllByTestId('card')).toHaveLength(3);
  expect(screen.getAllByTestId('timeline-row')).toHaveLength(4);
  expect(screen.getByTitle('2558/59')).toBeInTheDocument();
  expect(screen.getByText(/NASA POWER PRECTOTCORR/)).toBeInTheDocument();
});

test('English mode uses English titles and CE seasons', () => {
  render(<Results cell={cell([season(2015, 5, 0.8)])} lang="en" />);
  expect(screen.getByText(/Keep as today/)).toBeInTheDocument();
  expect(screen.getByTitle('2015/16')).toBeInTheDocument();
});

test('tapping a failed season opens a drawer with a real calendar death date', () => {
  render(<Results cell={cell([season(2015, 0, 0.3)])} lang="th" />);
  fireEvent.click(screen.getAllByRole('button', { name: /✖/ })[0]);
  // Sown mid-November 2015, so the crop dies in late 2015 or early 2016 (BE 2558/2559).
  expect(screen.getByTestId('drawer')).toHaveTextContent(/\d{1,2} (พ\.ย\.|ธ\.ค\.|ม\.ค\.|ก\.พ\.) 255[89]/);
});

test('a cell with no usable seasons says so and never shows 0 of 0', () => {
  render(<Results cell={cell([season(2015, 5, null)])} lang="th" />);
  expect(screen.getAllByText('ข้อมูลไม่พอ').length).toBeGreaterThan(0);
  expect(screen.queryByText(/จาก 0/)).toBeNull();
});

test('cards show the latest safe sowing date and the days left in the season under way', () => {
  render(<Results cell={cell([season(2015, 5, 0.8), season(2016, 5, 0.8)])} lang="th" today={new Date(2026, 10, 14)} />);
  const windows = screen.getAllByTestId('window');
  expect(windows).toHaveLength(2); // cards B and C only
  // Rain every day: every date in the sweep is safe, so the latest one (31 Jan) is the deadline.
  expect(windows[0]).toHaveTextContent('ปลูกภายใน 31 ม.ค.');
  expect(windows[0]).toHaveTextContent('เหลืออีก 78 วัน');
});

test('the what-if sliders mark the cards as a what-if result and can be reset', () => {
  render(<Results cell={cell([season(2015, 5, 0.8)])} lang="en" />);
  expect(screen.queryByText(/What-if result/)).toBeNull();
  fireEvent.change(screen.getByLabelText('Rain'), { target: { value: '-30' } });
  expect(screen.getAllByText(/What-if result: Rain −30%/)).toHaveLength(2);
  fireEvent.click(screen.getByText('Back to real data'));
  expect(screen.queryByText(/What-if result/)).toBeNull();
});

test('a loaded current season names its look-alike years and adds "years like this" odds', () => {
  const past = [season(2014, 2, 0.5), season(2015, 5, 0.8), season(2016, 0, 0.3), season(2017, 3, 0.6)];
  const now = { ...past[1], year: 2026, start: '2026-08-01', asOf: '2026-11-11' };
  render(<Results cell={cell(past)} lang="th" current={now} />);
  expect(screen.getByTestId('analog-line')).toHaveTextContent(/คล้ายปี 2558/);
  expect(screen.getAllByTestId('analog-odds')).toHaveLength(2);
});

test('the summary names the best crop and its odds, and calls a dry place risky', () => {
  const { rerender } = render(<Results cell={cell([season(2015, 5, 0.8), season(2016, 5, 0.8)])} lang="en" />);
  expect(screen.getByTestId('summary')).toHaveTextContent(/is the best bet here: it survived 2 of 2/);
  rerender(<Results cell={cell([season(2015, 0, 0.3), season(2016, 0, 0.3)])} lang="en" />);
  expect(screen.getByTestId('summary')).toHaveTextContent(/Risky here/);
});

test('a failed live fetch says so instead of showing look-alike years', () => {
  render(<Results cell={cell([season(2015, 5, 0.8)])} lang="en" current="error" />);
  expect(screen.getByText(/Could not fetch this season/)).toBeInTheDocument();
});

test('choosing waterings improves a dry field and each crop card says how much water it needs', () => {
  render(<Results cell={cell([season(2015, 0, 0.45), season(2016, 0, 0.45)])} lang="en" />);
  expect(screen.getAllByTestId('water-need')).toHaveLength(2);
  expect(screen.getByTestId('summary-water')).toHaveTextContent(/If you can water about \d times/);
  const failedBefore = screen.getAllByRole('button', { name: /✖/ }).length;
  fireEvent.change(screen.getByTestId('waterings'), { target: { value: '8' } });
  expect(screen.queryAllByRole('button', { name: /✖/ }).length).toBeLessThan(failedBefore);
  expect(screen.getAllByText(/Counting your 8 waterings/).length).toBeGreaterThan(0);
});

it('starts from settings in a shared link and reports each change so the link can follow', () => {
  const seen: unknown[] = [];
  render(<Results cell={cell([season(2015, 5, 0.8)])} lang="en"
    initial={{ sow: '12-01', soil: 'sandyLoam', position: 'upland', waterings: 2 }} onSettings={(s) => seen.push(s)} />);
  expect(screen.getByTestId('waterings')).toHaveValue('2');
  expect(screen.getByLabelText(/soil/i)).toHaveValue('sandyLoam');
  fireEvent.change(screen.getByTestId('waterings'), { target: { value: '4' } });
  expect(seen[seen.length - 1]).toEqual({ sow: '12-01', soil: 'sandyLoam', position: 'upland', waterings: 4 });
});

it('copies the page link when the share button is pressed', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });
  render(<Results cell={cell([season(2015, 5, 0.8)])} lang="en" />);
  fireEvent.click(screen.getByRole('button', { name: /Copy link/ }));
  expect(writeText).toHaveBeenCalledWith(window.location.href);
  expect(await screen.findByText(/Link copied/)).toBeInTheDocument();
});

it('falls back to the older copy command where the clipboard is blocked', async () => {
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('blocked')) } });
  const exec = vi.fn().mockReturnValue(true);
  Object.assign(document, { execCommand: exec });
  render(<Results cell={cell([season(2015, 5, 0.8)])} lang="en" />);
  fireEvent.click(screen.getByRole('button', { name: /Copy link/ }));
  expect(await screen.findByText(/Link copied/)).toBeInTheDocument();
  expect(exec).toHaveBeenCalledWith('copy');
});

it('shows an estimated income per rai on cash-crop cards and no cash for sunn hemp', () => {
  render(<Results cell={cell([season(2015, 5, 0.8), season(2016, 5, 0.8)])} lang="en" />);
  const lines = screen.getAllByTestId('income').map((e) => e.textContent ?? '');
  expect(lines).toHaveLength(2);
  expect(lines.some((l) => /Estimated income ≈ ฿[\d,]+ per rai on average/.test(l) || /No cash income/.test(l))).toBe(true);
});

test('satellite rain from IMERG is shown next to the model rain over the same days', () => {
  const past = [season(2014, 2, 0.5), season(2015, 5, 0.8), season(2016, 0, 0.3)];
  const now = { ...past[1], year: 2026, start: '2026-08-01', asOf: '2026-08-03', rain: [1, 2, 3, 4, 5] };
  const imerg = { start: '2026-08-01', asOf: '2026-08-04', rain: [10, null, 20, 5] };
  render(<Results cell={cell(past)} lang="en" current={now} imerg={imerg} />);
  // Same days for both: 1–3 Aug (POWER stops there). IMERG 10 + 20 = 30 (one day missing), POWER 1 + 2 + 3 = 6.
  expect(screen.getByTestId('imerg-line')).toHaveTextContent(/satellite.*30 mm.*6 mm/i);
});

/** GLDAS at the top of its range until April, long after the mung bean harvest, then dry. */
const withRootzone = (s: SeasonData): SeasonData => ({ ...s, rootzone: s.rain.map((_, i) => (i < 250 ? 400 : 100)) });

test('the GLDAS self-check line and a High badge when the model agrees and look-alike years agree', () => {
  const past = Array.from({ length: 16 }, (_, k) => withRootzone(season(2001 + k, 5, 0.8)));
  const days = 112; // 1 Aug to 20 Nov
  const now = {
    year: 2026, start: '2026-08-01', asOf: '2026-11-20',
    rain: past[3].rain.slice(0, days), tmax: past[3].tmax.slice(0, days), tmin: past[3].tmin.slice(0, days),
    wetness: past[3].wetness.slice(0, days),
  };
  render(<Results cell={cell(past)} lang="en" current={now} />);
  // Rain every day: neither the model nor GLDAS dries during the crop, so every season agrees.
  expect(screen.getByTestId('selfcheck-line')).toHaveTextContent(/GLDAS.*16 of 16 seasons/);
  expect(screen.getAllByText('Confidence: High')).toHaveLength(2);
});

test('without GLDAS data there is no self-check line and the badge stays at Medium', () => {
  const past = Array.from({ length: 16 }, (_, k) => season(2001 + k, 5, 0.8));
  render(<Results cell={cell(past)} lang="en" />);
  expect(screen.queryByTestId('selfcheck-line')).toBeNull();
  expect(screen.getAllByText('Confidence: Medium')).toHaveLength(2);
  expect(screen.getAllByText('Not yet checked against satellite data').length).toBeGreaterThan(0);
});

test('no satellite line without IMERG data', () => {
  render(<Results cell={cell([season(2015, 5, 0.8)])} lang="en" />);
  expect(screen.queryByTestId('imerg-line')).toBeNull();
});
