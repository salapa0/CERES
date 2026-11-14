import { useDeferredValue, useMemo, useState } from 'react';
import {
  buildStrategies, dayIndexToDate, daysLeft, loadCrops, replay, runTimeline, seasonLength, sowingWindow,
  type CellData, type Crop, type FieldPosition, type OddsResult, type Outcome, type SeasonData, type SoilTexture,
  type SowingWindow, type Strategy, type WhatIf,
} from './engine';
import { analogOdds, analogsSplit, findAnalogs, type Analog, type CurrentSeason } from './engine/analog';
import { DEFAULT_POSITION, DEFAULT_SOIL, DEFAULT_SOW, SOIL_TEXTURES } from './engine/constants';
import { formatDate, formatMonthDay, formatSeason, t, type Key, type Lang } from './i18n';

const SOW_DATES = ['11-01', '11-15', '12-01', '12-15', '01-01', '01-15', '02-01'];
const ICON: Record<Outcome['kind'], string> = { good: '🌱', poor: '🍂', failed: '✖', nodata: '·' };
const MIN_SEASONS_FOR_MEDIUM = 15;
const REAL: WhatIf = { rainFactor: 1, dT: 0 };

/** Live data for the season under way: still loading, failed, or loaded. */
export type CurrentState = 'loading' | 'error' | CurrentSeason;

type Tr = (key: Key, vars?: Record<string, string | number>) => string;

export function Results({ cell, lang, current, today = new Date() }: {
  cell: CellData; lang: Lang; current?: CurrentState; today?: Date;
}) {
  const crops = useMemo(loadCrops, []);
  const [sow, setSow] = useState(DEFAULT_SOW);
  const [soil, setSoil] = useState<SoilTexture>(DEFAULT_SOIL);
  const [position, setPosition] = useState<FieldPosition>(DEFAULT_POSITION);
  const [whatIfNow, setWhatIf] = useState<WhatIf>(REAL);
  const whatIf = useDeferredValue(whatIfNow); // keeps the sliders smooth while the replays catch up
  const [open, setOpen] = useState<{ crop: Crop; season: SeasonData } | null>(null);

  const timeline = useMemo(
    () => runTimeline(cell, crops, sow, soil, position, whatIf), [cell, crops, sow, soil, position, whatIf]);
  const strategies = useMemo(() => buildStrategies(timeline, crops), [timeline, crops]);
  const windows = useMemo(() => Object.fromEntries(crops
    .filter((c) => strategies.some((s) => s.cropId === c.id))
    .map((c) => [c.id, sowingWindow(cell, c, soil, position, whatIf)])), [cell, crops, strategies, soil, position, whatIf]);
  const analogs = useMemo(
    () => (current && typeof current === 'object' ? findAnalogs(cell.seasons, current) : []), [cell, current]);
  const name = (c: Crop) => (lang === 'th' ? c.nameTh : c.nameEn);
  const T: Tr = (key, vars) => t(lang, key, vars);
  const whatIfDesc = describeWhatIf(whatIf, lang);

  return (
    <section className="results">
      <h2>{T('field.title')} · {cell.lat.toFixed(2)}, {cell.lon.toFixed(2)}</h2>
      <p className="muted">{T('field.cellNote')}</p>

      <div className="inputs">
        <label>{T('input.sow')}
          <select value={sow} onChange={(e) => setSow(e.target.value)}>
            {SOW_DATES.map((d) => <option key={d} value={d}>{formatMonthDay(d, lang)}</option>)}
          </select>
        </label>
        <label>{T('input.soil')}
          <select value={soil} onChange={(e) => setSoil(e.target.value as SoilTexture)}>
            {(Object.keys(SOIL_TEXTURES) as SoilTexture[]).map((s) => <option key={s} value={s}>{T(`soil.${s}`)}</option>)}
          </select>
        </label>
        <label>{T('input.position')}
          <select value={position} onChange={(e) => setPosition(e.target.value as FieldPosition)}>
            <option value="lowland">{T('position.lowland')}</option>
            <option value="upland">{T('position.upland')}</option>
          </select>
        </label>
      </div>

      <AnalogLine current={current} analogs={analogs} lang={lang} />

      <div className="cards">
        {strategies.map((s) => (
          <Card key={s.id} s={s} crops={crops} lang={lang} today={today}
            window={s.cropId ? windows[s.cropId] : undefined}
            analog={s.cropId && analogs.length ? analogOdds(timeline[s.cropId], cell.seasons, analogs) : null}
            whatIfDesc={whatIfDesc} />
        ))}
      </div>

      <h3>{T('timeline.title')}</h3>
      <p className="muted">{T('timeline.hint')} · {T('legend')}</p>
      <div className="timeline">
        <table>
          <thead>
            <tr>
              <th scope="col" className="corner" />
              {cell.seasons.map((s) => (
                <th key={s.year} title={formatSeason(s.year, lang)}
                  className={analogs.some((a) => a.year === s.year) ? 'analog' : undefined}>
                  {formatSeason(s.year, lang).slice(2, 4)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {crops.map((crop) => (
              <tr key={crop.id} data-testid="timeline-row">
                <th scope="row">{name(crop)}</th>
                {timeline[crop.id].map((o, i) => (
                  <td key={cell.seasons[i].year}>
                    <button className={`cell ${o.kind}`} onClick={() => setOpen({ crop, season: cell.seasons[i] })}
                      title={`${formatSeason(cell.seasons[i].year, lang)}: ${T(`outcome.${o.kind}`)}`}>
                      {ICON[o.kind]}
                    </button>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <Drawer cell={cell} crop={open.crop} season={open.season} sow={sow} soil={soil} position={position}
          whatIf={whatIf} lang={lang} onClose={() => setOpen(null)} />
      )}

      <WhatIfPanel value={whatIfNow} onChange={setWhatIf} lang={lang} />

      <footer className="sources">
        <strong>{T('sources.title')}:</strong> {Object.values(cell.sources).join(' · ')}
        {current && typeof current === 'object' && <> · {T('sources.current')}</>}
        <br />{T('sources.method')}
      </footer>
    </section>
  );
}

function describeWhatIf(w: WhatIf, lang: Lang): string | null {
  if (w.rainFactor === 1 && w.dT === 0) return null;
  const parts: string[] = [];
  if (w.rainFactor !== 1) parts.push(`${t(lang, 'whatif.rain')} ${signed(Math.round((w.rainFactor - 1) * 100))}%`);
  if (w.dT !== 0) parts.push(`${t(lang, 'whatif.temp')} ${signed(w.dT)}°C`);
  return parts.join(', ');
}
const signed = (v: number) => (v > 0 ? `+${v}` : v < 0 ? `−${Math.abs(v)}` : '0');

function AnalogLine({ current, analogs, lang }: { current?: CurrentState; analogs: Analog[]; lang: Lang }) {
  if (!current) return null;
  if (current === 'loading') return <p className="analog-line muted">{t(lang, 'analog.loading')}</p>;
  if (current === 'error' || !analogs.length) return <p className="analog-line muted">{t(lang, 'analog.error')}</p>;
  const years = analogs.map((a) => (lang === 'th' ? a.year + 543 : a.year)).join(', ');
  const asOf = formatDate(new Date(`${current.asOf}T00:00:00Z`), lang);
  return (
    <p className="analog-line" data-testid="analog-line">
      {t(lang, 'analog.line', { date: asOf, years })} <span className="muted">({t(lang, 'analog.how')})</span>
    </p>
  );
}

function Card({ s, crops, lang, today, window, analog, whatIfDesc }: {
  s: Strategy; crops: Crop[]; lang: Lang; today: Date; window?: SowingWindow; analog: OddsResult | null;
  whatIfDesc: string | null;
}) {
  const T: Tr = (key, vars) => t(lang, key, vars);
  const crop = crops.find((c) => c.id === s.cropId);
  const alt = crops.find((c) => c.id === s.altCropId);
  const name = (c: Crop) => (lang === 'th' ? c.nameTh : c.nameEn);
  const split = analog != null && analogsSplit(analog);
  const level = !s.odds || s.odds.total < MIN_SEASONS_FOR_MEDIUM || split ? 'low' : 'medium';
  const why = s.odds && s.odds.total < MIN_SEASONS_FOR_MEDIUM ? 'low' : split ? 'split' : 'medium';
  return (
    <article className={`card card-${s.id}`} data-testid="card">
      <h3>{s.id} · {T(`card.${s.id}`)}</h3>
      <p className="crop">{crop ? name(crop) : T('card.A.crop')}</p>
      {!s.odds && <p>{T('card.A.body')}</p>}
      {s.odds && s.odds.total === 0 && <p className="odds">{T('card.noData')}</p>}
      {s.odds && s.odds.total > 0 && (
        <>
          <p className="odds">{T('card.odds', { good: s.odds.good, total: s.odds.total })}</p>
          <p className="muted">{T('card.detail', { poor: s.odds.poor, failed: s.odds.failed })}</p>
          {analog && analog.total > 0 && (
            <p className="analog-odds" data-testid="analog-odds">{T('card.analog', { good: analog.good, total: analog.total })}</p>
          )}
          {whatIfDesc && <p className="whatif-note">{T('card.whatIf', { desc: whatIfDesc })}</p>}
        </>
      )}
      <p className="effect">{T(`effect.${s.soilEffect}`)}</p>
      {s.odds && window && <WindowInfo w={window} lang={lang} today={today} />}
      {s.odds && (
        <>
          {alt && <p className="muted">{T('card.alt', { name: name(alt) })}</p>}
          <p className={`badge badge-${level}`} title={T(`badge.why.${why}`)}>
            {T('card.confidence')}: {T(`badge.${level}`)} <span className="muted">({T(`badge.why.${why}`)})</span>
          </p>
          <details>
            <summary>{T('card.blind')}</summary>
            <ul>
              <li>{T('card.blind.1')}</li><li>{T('card.blind.2')}</li><li>{T('card.blind.3')}</li>
              {crop?.assumption && <li>{T('card.estimate')}</li>}
            </ul>
            <p>{T('card.ask')}</p>
          </details>
        </>
      )}
    </article>
  );
}

/** "Plant by …", days left, and a small bar chart of the odds for each sowing date (blueprint §9.9). */
function WindowInfo({ w, lang, today }: { w: SowingWindow; lang: Lang; today: Date }) {
  const T: Tr = (key, vars) => t(lang, key, vars);
  const left = w.latest ? daysLeft(w.latest, today) : null;
  return (
    <div className="window" data-testid="window">
      {w.latest ? (
        <p className="window-date">
          {T('card.window', { date: formatMonthDay(w.latest, lang) })}
          {left != null && (
            <span className={left < 0 ? 'late' : 'left'}>
              {' · '}{left > 0 ? T('card.daysLeft', { n: left }) : left === 0 ? T('card.lastDay') : T('card.late')}
            </span>
          )}
        </p>
      ) : <p className="window-date late">{T('card.noWindow')}</p>}
      <div className="window-bars" role="img" aria-label={T('card.windowChart')}>
        {w.points.map((p) => (
          <span key={p.sowMonthDay} className={`bar${p.sowMonthDay === w.latest ? ' latest' : ''}`}
            title={`${formatMonthDay(p.sowMonthDay, lang)}: ${p.share == null ? '–' : `${p.odds.good}/${p.odds.total}`}`}
            style={{ height: `${Math.max(2, Math.round((p.share ?? 0) * 100))}%` }} />
        ))}
      </div>
      <p className="window-axis muted">
        <span>{formatMonthDay(w.points[0].sowMonthDay, lang)}</span>
        <span>{T('card.windowChart')}</span>
        <span>{formatMonthDay(w.points[w.points.length - 1].sowMonthDay, lang)}</span>
      </p>
    </div>
  );
}

function WhatIfPanel({ value, onChange, lang }: { value: WhatIf; onChange: (w: WhatIf) => void; lang: Lang }) {
  const T: Tr = (key, vars) => t(lang, key, vars);
  const rainPct = Math.round((value.rainFactor - 1) * 100);
  return (
    <section className="whatif" data-testid="whatif">
      <h3>{T('whatif.title')}</h3>
      <div className="sliders">
        <label>
          {T('whatif.rain')}: <strong>{signed(rainPct)}%</strong>
          <input type="range" min={-30} max={10} step={5} value={rainPct} aria-label={T('whatif.rain')}
            onChange={(e) => onChange({ ...value, rainFactor: 1 + Number(e.target.value) / 100 })} />
        </label>
        <label>
          {T('whatif.temp')}: <strong>{signed(value.dT)}°C</strong>
          <input type="range" min={0} max={3} step={0.5} value={value.dT} aria-label={T('whatif.temp')}
            onChange={(e) => onChange({ ...value, dT: Number(e.target.value) })} />
        </label>
        <button onClick={() => onChange(REAL)} disabled={value.rainFactor === 1 && value.dT === 0}>{T('whatif.reset')}</button>
      </div>
      <p className="muted">{T('whatif.note')}</p>
    </section>
  );
}

function Drawer(p: {
  cell: CellData; crop: Crop; season: SeasonData; sow: string; soil: SoilTexture; position: FieldPosition;
  whatIf: WhatIf; lang: Lang; onClose: () => void;
}) {
  const { lang, season, crop } = p;
  const T: Tr = (key, vars) => t(lang, key, vars);
  const o = replay({
    cell: p.cell, season, crop, sowMonthDay: p.sow, soil: p.soil, position: p.position, whatIf: p.whatIf, withDaily: true,
  });
  return (
    <aside className="drawer" data-testid="drawer">
      <button className="close" onClick={p.onClose}>{T('drawer.close')} ✕</button>
      <h3>
        {lang === 'th' ? crop.nameTh : crop.nameEn} · {T('drawer.season', { season: formatSeason(season.year, lang) })} ·{' '}
        {ICON[o.kind]} {T(`outcome.${o.kind}`)}
      </h3>
      {o.kind !== 'nodata' && <p>{T('drawer.sown', { date: formatDate(dayIndexToDate(season, o.sowIndex), lang) })}</p>}
      {o.kind === 'failed' && (
        <p className="died">
          {o.deathDay != null
            ? T('drawer.died', { date: formatDate(dayIndexToDate(season, o.deathDay), lang), reason: T(`reason.${o.reason ?? 'drought'}`) })
            : T('drawer.failedNoDay')}
        </p>
      )}
      {o.ret != null && <p>{T('drawer.ret', { pct: Math.round(o.ret * 100) })}</p>}
      {o.daily && <SoilWaterChart o={o} length={seasonLength(crop)} caption={T('drawer.chart')} />}
    </aside>
  );
}

/** Plant-available water through the crop season, with the stress line, rain bars and death day. */
function SoilWaterChart({ o, length, caption }: { o: Outcome; length: number; caption: string }) {
  const { dr, taw, raw, rain } = o.daily!;
  const W = 600, H = 180, x = (d: number) => (d / Math.max(1, length - 1)) * W;
  const y = (mm: number) => H - (mm / taw) * H;
  const maxRain = Math.max(10, ...rain);
  const line = dr.map((v, d) => `${x(d).toFixed(1)},${y(taw - v).toFixed(1)}`).join(' ');
  const death = o.deathDay != null ? o.deathDay - o.sowIndex : null;
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={caption}>
        {rain.map((r, d) => r > 0 && (
          <rect key={d} x={x(d) - 1.5} y={0} width={3} height={(r / maxRain) * H * 0.4} fill="var(--sky)" opacity={0.6} />
        ))}
        <line x1={0} x2={W} y1={y(taw - raw)} y2={y(taw - raw)} stroke="var(--sun)" strokeDasharray="6 4" />
        <polyline points={line} fill="none" stroke="var(--leaf)" strokeWidth={3} />
        {death != null && <line x1={x(death)} x2={x(death)} y1={0} y2={H} stroke="var(--clay)" strokeWidth={2} />}
      </svg>
      <figcaption className="muted">{caption} · 0–{Math.round(taw)} mm</figcaption>
    </figure>
  );
}
