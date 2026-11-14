import { fireEvent, render, screen } from '@testing-library/react';
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
