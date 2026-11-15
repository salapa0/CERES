import { fireEvent, render, screen, within } from '@testing-library/react';
import { vi } from 'vitest';
import { loadCrops, type CellData, type Num, type SeasonData } from './engine';
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

test('a choice per crop plus "leave it bare", and a year row per crop with Buddhist-era years', () => {
  render(<Results cell={cell([season(2015, 5, 0.8), season(2016, 5, 0.8)])} lang="th" />);
  const picker = screen.getByRole('radiogroup', { name: 'คุณจะปลูกอะไร' });
  expect(within(picker).getAllByRole('radio')).toHaveLength(loadCrops().length + 1);
  expect(screen.getAllByTestId('timeline-row')).toHaveLength(loadCrops().length);
  expect(screen.getByTitle('2558/59')).toBeInTheDocument();
  expect(screen.getByText(/NASA POWER PRECTOTCORR/)).toBeInTheDocument();
});

test('English mode uses English titles and CE seasons', () => {
  render(<Results cell={cell([season(2015, 5, 0.8)])} lang="en" />);
  expect(screen.getByRole('radio', { name: /Leave the field bare/ })).toBeInTheDocument();
  expect(screen.getByTitle('2015/16')).toBeInTheDocument();
});

test('tapping a failed season opens a drawer with a real calendar death date', () => {
  render(<Results cell={cell([season(2015, 0, 0.3)])} lang="th" />);
  fireEvent.click(screen.getAllByRole('button', { name: /ไม่รอด/ })[0]);
  // Sown mid-November 2015, so the crop dies in late 2015 or early 2016 (BE 2558/2559).
  expect(screen.getByTestId('drawer')).toHaveTextContent(/\d{1,2} (พ\.ย\.|ธ\.ค\.|ม\.ค\.|ก\.พ\.) 255[89]/);
});

test('a cell with no usable seasons says so and never shows 0 of 0', () => {
  render(<Results cell={cell([season(2015, 5, null)])} lang="th" />);
  expect(screen.getAllByText(/ข้อมูลไม่พอ/).length).toBeGreaterThan(0);
  expect(screen.queryByText(/จาก 0/)).toBeNull();
});

test('the picked crop shows the latest safe sowing date and the days left in the season under way', () => {
  render(<Results cell={cell([season(2015, 5, 0.8), season(2016, 5, 0.8)])} lang="th" today={new Date(2026, 10, 14)} />);
  const w = within(screen.getByTestId('detail')).getByTestId('window');
  // Rain every day: every date in the sweep is safe, so the latest one (31 Jan) is the deadline.
  expect(w).toHaveTextContent('ปลูกภายใน 31 ม.ค.');
  expect(w).toHaveTextContent('เหลืออีก 78 วัน');
});

test('the weather to test is one of the settings, shown in the summary line, and can be reset', () => {
  render(<Results cell={cell([season(2015, 5, 0.8)])} lang="en" />);
  const summary = screen.getByTestId('settings-summary');
  expect(summary).toHaveTextContent(/· Real weather$/);
  expect(screen.queryByTestId('whatif')).toBeNull();
  expect(screen.queryByText(/What-if result/)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Change' }));
  expect(screen.getByText(/Not a forecast/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('radio', { name: '−30%' }));
  expect(summary).toHaveTextContent(/Rain −30%$/);
  expect(screen.getAllByText(/What-if result: Rain −30%/).length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole('button', { name: 'Back to real data' }));
  expect(screen.queryByText(/What-if result/)).toBeNull();
});

test('a loaded current season names its look-alike years and adds "years like this" odds', () => {
  const past = [season(2014, 2, 0.5), season(2015, 5, 0.8), season(2016, 0, 0.3), season(2017, 3, 0.6)];
  const now = { ...past[1], year: 2026, start: '2026-08-01', asOf: '2026-11-11' };
  render(<Results cell={cell(past)} lang="th" current={now} />);
  expect(screen.getByTestId('analog-line')).toHaveTextContent(/คล้ายปี 2558/);
  expect(screen.getAllByTestId('analog-odds')).toHaveLength(1); // the picked crop's detail
});

test('the summary names the best-earning safe crop with its income and years, and says when none is safe', () => {
  const { rerender } = render(<Results cell={cell([season(2015, 5, 0.8), season(2016, 5, 0.8)])} lang="en" />);
  expect(screen.getByTestId('summary'))
    .toHaveTextContent(/earns the most of the safe crops: about ฿[\d,]+ per rai, and it survived 2 of 2 past years/);
  expect(screen.getByTestId('summary')).toHaveTextContent('Safe = survived at least 4 years in 5');
  rerender(<Results cell={cell([season(2015, 0, 0.3), season(2016, 0, 0.3)])} lang="en" />);
  // Nothing to sell ever survived: say that, rather than "the best one survived 0 of 2".
  expect(screen.getByTestId('summary')).toHaveTextContent(/Without water, no crop to sell survived in any of the past 2 years/);
  expect(screen.getByTestId('summary')).not.toHaveTextContent(/0 of 2/);
});

test('a failed live fetch says so instead of showing look-alike years', () => {
  render(<Results cell={cell([season(2015, 5, 0.8)])} lang="en" current="error" />);
  expect(screen.getByText(/Could not fetch this season/)).toBeInTheDocument();
});

test('choosing waterings improves a dry field and the picked crop says how much water it needs', () => {
  render(<Results cell={cell([season(2015, 0, 0.45), season(2016, 0, 0.45)])} lang="en" />);
  expect(screen.getAllByTestId('water-need')).toHaveLength(1);
  expect(screen.getByTestId('summary-water')).toHaveTextContent(/If you can water about \d times/);
  const failedBefore = screen.getAllByRole('button', { name: /Failed/ }).length;
  fireEvent.click(screen.getByRole('button', { name: 'Change' }));
  fireEvent.click(screen.getByRole('radio', { name: /^8 times/ }));
  expect(screen.queryAllByRole('button', { name: /Failed/ }).length).toBeLessThan(failedBefore);
  expect(screen.getAllByText(/Counting your 8 waterings/).length).toBeGreaterThan(0);
});

it('starts from settings in a shared link and reports each change so the link can follow', () => {
  const seen: unknown[] = [];
  render(<Results cell={cell([season(2015, 5, 0.8)])} lang="en"
    initial={{ sow: '12-01', soil: 'sandyLoam', position: 'upland', waterings: 2 }} onSettings={(s) => seen.push(s)} />);
  expect(screen.getByTestId('settings-summary')).toHaveTextContent('Sow 1 Dec · Sandy loam · Upland · Water 2 times');
  fireEvent.click(screen.getByRole('button', { name: 'Change' }));
  expect(screen.getByRole('radio', { name: 'Sandy loam' })).toBeChecked();
  expect(screen.getByRole('radio', { name: /^2 times/ })).toBeChecked();
  fireEvent.click(screen.getByRole('radio', { name: /^4 times/ }));
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

it('every crop choice shows its income or plainly says it has none, and the detail leads with income', () => {
  render(<Results cell={cell([season(2015, 5, 0.8), season(2016, 5, 0.8)])} lang="en" />);
  expect(screen.getByRole('radio', { name: /Sunn hemp.*No income/ })).toBeInTheDocument();
  expect(screen.getByRole('radio', { name: /Peanut.*≈ ฿[\d,]+\/rai/ })).toBeInTheDocument();
  const detail = screen.getByTestId('detail');
  expect(detail.querySelector('h3 + p')).toBe(screen.getByTestId('income'));
  expect(screen.getByTestId('income')).toHaveTextContent(/Estimated income ≈ ฿[\d,]+ per rai on average/);
  fireEvent.click(screen.getByRole('radio', { name: /Sunn hemp/ }));
  expect(screen.getByTestId('income')).toHaveTextContent(/No cash income/);
});

test('the recommended crop is picked first; another pick shows its detail and stays when settings change', () => {
  render(<Results cell={cell([season(2015, 5, 0.8), season(2016, 5, 0.8)])} lang="en" />);
  expect(screen.getByRole('radio', { checked: true }).closest('label')).toHaveTextContent('Recommended');
  fireEvent.click(screen.getByRole('radio', { name: /Mung bean/ }));
  expect(screen.getByTestId('detail')).toHaveTextContent(/^Mung bean/);
  const picked = screen.getAllByTestId('timeline-row').filter((r) => r.classList.contains('is-picked'));
  expect(picked).toHaveLength(1);
  expect(picked[0]).toHaveTextContent(/^Mung bean/);
  fireEvent.click(screen.getByRole('button', { name: 'Change' }));
  fireEvent.click(screen.getByRole('radio', { name: 'Upland' }));
  expect(screen.getByRole('radio', { name: /Mung bean/ })).toBeChecked();
});

test('on a phone the year chart can hide crops that are neither picked nor recommended', () => {
  render(<Results cell={cell([season(2015, 5, 0.8), season(2016, 5, 0.8)])} lang="en" />);
  const rows = screen.getAllByTestId('timeline-row');
  expect(rows.filter((r) => r.classList.contains('minor'))).toHaveLength(rows.length - 1); // picked = recommended
  const toggle = screen.getByRole('button', { name: 'Show all crops' });
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  expect(toggle.closest('section')).toHaveClass('show-all');
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
  expect(screen.getByTestId('selfcheck-line')).toHaveTextContent(/GLDAS.*16 of 16 years/);
  expect(screen.getAllByText('Confidence: High')).toHaveLength(1);
});

test('without GLDAS data there is no self-check line and the badge stays at Medium', () => {
  const past = Array.from({ length: 16 }, (_, k) => season(2001 + k, 5, 0.8));
  render(<Results cell={cell(past)} lang="en" />);
  expect(screen.queryByTestId('selfcheck-line')).toBeNull();
  expect(screen.getAllByText('Confidence: Medium')).toHaveLength(1);
  expect(screen.getAllByText('Not yet checked against satellite data').length).toBeGreaterThan(0);
});

test('soil now from SMAP, compared with the same date in past years', () => {
  const smap = {
    date: '2026-11-12', now: 0.284,
    past: [{ year: 2020, value: 0.2 }, { year: 2021, value: 0.25 }, { year: 2022, value: 0.3 }, { year: 2023, value: 0.1 }],
  };
  const { unmount } = render(<Results cell={cell([season(2015, 5, 0.8)])} lang="en" smap={smap} />);
  expect(screen.getByTestId('smap-line')).toHaveTextContent(/Soil now.*SMAP.*12 Nov 2026.*28%.*wetter than 3 of 4 past years/);
  unmount();
  render(<Results cell={cell([season(2015, 5, 0.8)])} lang="en" smap={{ ...smap, now: 0.15 }} />);
  expect(screen.getByTestId('smap-line')).toHaveTextContent(/drier than 3 of 4 past years/);
});

test('no soil-now line without SMAP data', () => {
  render(<Results cell={cell([season(2015, 5, 0.8)])} lang="en" />);
  expect(screen.queryByTestId('smap-line')).toBeNull();
});

test('no satellite line without IMERG data', () => {
  render(<Results cell={cell([season(2015, 5, 0.8)])} lang="en" />);
  expect(screen.queryByTestId('imerg-line')).toBeNull();
});

test('the settings the answer depends on come before the answer, as a summary that opens into tap choices', () => {
  render(<Results cell={cell([season(2015, 5, 0.8)])} lang="th" />);
  const summary = screen.getByTestId('settings-summary');
  expect(summary).toHaveTextContent('ปลูก 15 พ.ย. · ดินทรายปนร่วน · นาลุ่ม · ไม่รดน้ำ');
  expect(summary.compareDocumentPosition(screen.getByTestId('summary')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  const change = screen.getByRole('button', { name: 'เปลี่ยน' });
  expect(change).toHaveAttribute('aria-expanded', 'false');
  const settings = screen.getByRole('region', { name: 'คิดจากนาแบบนี้' });
  expect(within(settings).queryByRole('radio')).toBeNull();
  fireEvent.click(change);
  expect(change).toHaveAttribute('aria-expanded', 'true');
  expect(within(settings).getAllByRole('radiogroup')).toHaveLength(6); // soil, position, water, sow, rain, heat
  expect(summary).toHaveTextContent('ไม่รดน้ำ · อากาศตามจริง');
  fireEvent.click(screen.getByRole('radio', { name: 'นาดอน' }));
  expect(summary).toHaveTextContent('นาดอน');
});

test('a field that is risky without water does not also say to leave it bare when water would fix it', () => {
  render(<Results cell={cell([season(2015, 0, 0.45), season(2016, 0, 0.45)])} lang="en" />);
  const verdict = screen.getByTestId('summary');
  expect(verdict).toHaveTextContent(/Without water, no crop to sell (is safe here|survived)/);
  expect(verdict).toHaveTextContent(/If you can water about \d times/);
  expect(verdict).not.toHaveTextContent(/bare/);
});

test('the picked crop shows one countable mark per past year, survived first', () => {
  render(<Results cell={cell([season(2015, 5, 0.8), season(2016, 5, 0.8), season(2017, 0, 0.3)])} lang="en" />);
  const marks = screen.getAllByTestId('marks');
  expect(marks).toHaveLength(1);
  const kinds = [...marks[0].children].map((m) => m.className.replace('mark ', ''));
  expect(kinds).toHaveLength(3);
  expect(kinds).toEqual([...kinds].sort((a, b) => ['good', 'poor', 'failed'].indexOf(a) - ['good', 'poor', 'failed'].indexOf(b)));
  expect(marks[0]).toHaveAttribute('role', 'img');
  expect(marks[0].getAttribute('aria-label')).toMatch(/Survived \d · Poor \d · Failed \d/);
});

test('the headings use the audit wording and odds count years, not seasons', () => {
  render(<Results cell={cell([season(2015, 5, 0.8), season(2016, 5, 0.8)])} lang="th" onChangeField={() => {}} />);
  expect(screen.getByRole('heading', { name: 'พิกัด' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'เลือกพิกัดใหม่' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'ข้อมูลอ้างอิง' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'ย้อนดูปีก่อน ๆ ว่ารอดไหม' })).toBeInTheDocument();
  expect(screen.getAllByText(/รอด 2 จาก 2 ปี/).length).toBeGreaterThan(0);
  expect(screen.queryByText(/จาก 2 ฤดู/)).toBeNull();
});

test('the NASA checks sit together under one plain heading, after the options', () => {
  const smap = { date: '2026-11-12', now: 0.284, past: [{ year: 2020, value: 0.2 }] };
  render(<Results cell={cell([season(2015, 5, 0.8)])} lang="en" smap={smap} current="error" />);
  const check = screen.getByRole('region', { name: 'Reference data' });
  expect(check).toContainElement(screen.getByTestId('smap-line'));
  expect(check).toHaveTextContent(/Could not fetch this season/);
  expect(screen.getByTestId('detail').compareDocumentPosition(check) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

test('timeline years are buttons named by season and outcome, drawn with the same marks as the cards', () => {
  render(<Results cell={cell([season(2015, 0, 0.3)])} lang="en" />);
  const year = screen.getAllByRole('button', { name: '2015/16: Failed' })[0];
  expect(year.querySelector('.mark.failed')).not.toBeNull();
  expect(screen.queryByText('✖')).toBeNull();
});
