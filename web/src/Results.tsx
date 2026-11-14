import { useDeferredValue, useMemo, useState } from 'react';
import {
  buildStrategies, dayIndexToDate, daysLeft, loadCrops, replay, runTimeline, seasonLength, sowingWindow,
  type CellData, type Crop, type FieldPosition, type OddsResult, type Outcome, type SeasonData, type SoilTexture,
  type SowingWindow, type Strategy, type WhatIf,
} from './engine';
import { analogOdds, analogsSplit, findAnalogs, type Analog, type CurrentSeason } from './engine/analog';
import { DEFAULT_POSITION, DEFAULT_SOIL, DEFAULT_SOW, SOIL_TEXTURES } from './engine/constants';
import { formatDate, formatMonthDay, formatSeason, t, type Key, type Lang } from './i18n';
import { IconClose, IconHistory, IconLeaf, IconPin } from './icons';

const SOW_DATES = ['11-01', '11-15', '12-01', '12-15', '01-01', '01-15', '02-01'];
const ICON: Record<Outcome['kind'], string> = { good: '🌱', poor: '🍂', failed: '✖', nodata: '·' };
const KINDS: Outcome['kind'][] = ['good', 'poor', 'failed', 'nodata'];
const MIN_SEASONS_FOR_MEDIUM = 15;
const REAL: WhatIf = { rainFactor: 1, dT: 0 };

/** Live data for the season under way: still loading, failed, or loaded. */
export type CurrentState = 'loading' | 'error' | CurrentSeason;

type Tr = (key: Key, vars?: Record<string, string | number>) => string;

/** Colour of a card's odds: green when most seasons survived, amber for some, red for few. */
function tone(odds: OddsResult | null): 'good' | 'mid' | 'low' | 'none' {
  if (!odds || odds.total === 0) return 'none';
  const share = odds.good / odds.total;
  return share >= 0.6 ? 'good' : share >= 0.3 ? 'mid' : 'low';
}

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
    <section className="results" aria-labelledby="results-title">
      <div className="results-head">
        <h2 id="results-title">{T('field.title')}</h2>
        <span className="coord" title={`${T('results.chosen')} · ${T('field.cellNote')}`}>
          <IconPin /> {cell.lat.toFixed(2)}, {cell.lon.toFixed(2)}
        </span>
      </div>

      <Summary strategies={strategies} crops={crops} windows={windows} lang={lang} today={today} whatIfDesc={whatIfDesc} />
      <AnalogLine current={current} analogs={analogs} lang={lang} />

      <div className="card inputs">
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

      <div className="cards" aria-label={T('results.options')}>
        {strategies.map((s) => (
          <Card key={s.id} s={s} crops={crops} lang={lang} today={today}
            window={s.cropId ? windows[s.cropId] : undefined}
            analog={s.cropId && analogs.length ? analogOdds(timeline[s.cropId], cell.seasons, analogs) : null}
            whatIfDesc={whatIfDesc} />
        ))}
      </div>

      <section className="card timeline-card">
        <div className="card-heading">
          <div>
            <h3>{T('timeline.title')}</h3>
            <p>{T('timeline.hint')}</p>
          </div>
        </div>
        <ul className="legend" aria-label={T('legend')}>
          {KINDS.map((k) => (
            <li key={k}><span className={`swatch ${k}`}>{ICON[k]}</span>{T(`outcome.${k}`)}</li>
          ))}
          {analogs.length > 0 && <li><span className="swatch analog-swatch" />{T('timeline.analogKey')}</li>}
        </ul>
        <div className="timeline">
          <table>
            <thead>
              <tr>
                <th scope="col" className="corner" />
                {cell.seasons.map((s) => (
                  <th key={s.year} title={formatSeason(s.year, lang)}
                    className={analogs.some((a) => a.year === s.year) ? 'analog' : undefined}>
                    <span>{formatSeason(s.year, lang).slice(2, 4)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {crops.map((crop) => (
                <tr key={crop.id} data-testid="timeline-row">
                  <th scope="row">{name(crop)}</th>
                  {timeline[crop.id].map((o, i) => {
                    const isOpen = open?.crop.id === crop.id && open.season.year === cell.seasons[i].year;
                    return (
                      <td key={cell.seasons[i].year}>
                        <button className={`cell ${o.kind}${isOpen ? ' is-open' : ''}`}
                          onClick={() => setOpen({ crop, season: cell.seasons[i] })}
                          title={`${formatSeason(cell.seasons[i].year, lang)}: ${T(`outcome.${o.kind}`)}`}>
                          {ICON[o.kind]}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {open && (
        <Drawer cell={cell} crop={open.crop} season={open.season} sow={sow} soil={soil} position={position}
          whatIf={whatIf} lang={lang} onClose={() => setOpen(null)} />
      )}

      <WhatIfPanel value={whatIfNow} onChange={setWhatIf} lang={lang} />

      <footer className="sources" title={T('field.cellNote')}>
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
  if (current === 'loading') {
    return <p className="analog-line is-quiet"><span className="spinner" /> {t(lang, 'analog.loading')}</p>;
  }
  if (current === 'error' || !analogs.length) return <p className="analog-line is-quiet">{t(lang, 'analog.error')}</p>;
  const years = analogs.map((a) => (lang === 'th' ? a.year + 543 : a.year)).join(', ');
  const asOf = formatDate(new Date(`${current.asOf}T00:00:00Z`), lang);
  return (
    <p className="analog-line" data-testid="analog-line" title={t(lang, 'analog.how')}>
      <IconHistory />
      <span>{t(lang, 'analog.line', { date: asOf, years })}</span>
    </p>
  );
}

/** One-sentence answer: the best crop here, its odds and the date to plant by. */
function Summary({ strategies, crops, windows, lang, today, whatIfDesc }: {
  strategies: Strategy[]; crops: Crop[]; windows: Record<string, SowingWindow>; lang: Lang; today: Date;
  whatIfDesc: string | null;
}) {
  const T: Tr = (key, vars) => t(lang, key, vars);
  const share = (s: Strategy) => (s.odds && s.odds.total ? s.odds.good / s.odds.total : -1);
  const best = strategies.filter((s) => s.cropId && share(s) >= 0).sort((a, b) => share(b) - share(a))[0];
  if (!best || !best.odds) return null;
  const crop = crops.find((c) => c.id === best.cropId)!;
  const name = lang === 'th' ? crop.nameTh : crop.nameEn;
  const level = tone(best.odds);
  const vars = { crop: name, good: best.odds.good, total: best.odds.total };
  const w = windows[crop.id];
  const left = w?.latest ? daysLeft(w.latest, today) : null;
  return (
    <div className={`card summary tone-${level}`} data-testid="summary">
      <p className="summary-kicker">{T('summary.kicker')}</p>
      <p className="summary-main">{level === 'low' ? T('summary.risky', vars) : T('summary.best', vars)}</p>
      {level !== 'low' && w?.latest && (
        <p className="summary-plant">
          {T('card.window', { date: formatMonthDay(w.latest, lang) })}
          {left != null && <> · {left > 1 ? T('card.daysLeft', { n: left }) : left === 1 ? T('card.dayLeft') : left === 0 ? T('card.lastDay') : T('card.late')}</>}
        </p>
      )}
      {whatIfDesc && <p className="summary-note">{T('summary.whatIf')}</p>}
    </div>
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
  const pct = (n: number) => (s.odds && s.odds.total ? `${(n / s.odds.total) * 100}%` : '0%');
  return (
    <article className={`card option option-${s.id} tone-${tone(s.odds)}`} data-testid="card">
      <h3 className="option-top"><span className="option-tag">{s.id}</span>{T(`card.${s.id}`)}</h3>
      <p className="crop">{crop ? name(crop) : T('card.A.crop')}</p>
      {!s.odds && <p className="body">{T('card.A.body')}</p>}
      {s.odds && s.odds.total === 0 && <p className="odds">{T('card.noData')}</p>}
      {s.odds && s.odds.total > 0 && (
        <>
          <p className="odds">{T('card.odds', { good: s.odds.good, total: s.odds.total })}</p>
          <div className="meter" title={T('card.detail', { poor: s.odds.poor, failed: s.odds.failed })}>
            <span className="m-good" style={{ width: pct(s.odds.good) }} />
            <span className="m-poor" style={{ width: pct(s.odds.poor) }} />
            <span className="m-failed" style={{ width: pct(s.odds.failed) }} />
            <span className="sr-only">{T('card.detail', { poor: s.odds.poor, failed: s.odds.failed })}</span>
          </div>
          {analog && analog.total > 0 && (
            <p className="analog-odds" data-testid="analog-odds">{T('card.analog', { good: analog.good, total: analog.total })}</p>
          )}
          {whatIfDesc && <p className="whatif-note">{T('card.whatIf', { desc: whatIfDesc })}</p>}
        </>
      )}
      {s.odds && window && <WindowInfo w={window} lang={lang} today={today} />}
      {s.odds && <p className={`effect effect-${s.soilEffect}`}><IconLeaf />{T(`effect.${s.soilEffect}`)}</p>}
      {s.odds && (
        <details className="more">
          <summary>{T('card.more')}</summary>
          {s.odds.total > 0 && <p className="odds-detail">{T('card.detail', { poor: s.odds.poor, failed: s.odds.failed })}</p>}
          {window && <WindowChart w={window} lang={lang} />}
          {alt && <p className="alt">{T('card.alt', { name: name(alt) })}</p>}
          <p className={`pill badge-${level}`} title={T(`badge.why.${why}`)}>
            {T('card.confidence')}: {T(`badge.${level}`)}
          </p>
          <p className="badge-why">{T(`badge.why.${why}`)}</p>
          <p className="more-h">{T('card.blind')}</p>
          <ul>
            <li>{T('card.blind.1')}</li><li>{T('card.blind.2')}</li><li>{T('card.blind.3')}</li>
            {crop?.assumption && <li>{T('card.estimate')}</li>}
          </ul>
          <p>{T('card.ask')}</p>
        </details>
      )}
    </article>
  );
}

/** "Plant by …" and the days left in the season under way (blueprint §9.9). */
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
              {' · '}{left > 1 ? T('card.daysLeft', { n: left }) : left === 1 ? T('card.dayLeft') : left === 0 ? T('card.lastDay') : T('card.late')}
            </span>
          )}
        </p>
      ) : <p className="window-date late">{T('card.noWindow')}</p>}
    </div>
  );
}

/** Small bar chart of the odds for each sowing date. */
function WindowChart({ w, lang }: { w: SowingWindow; lang: Lang }) {
  const T: Tr = (key, vars) => t(lang, key, vars);
  return (
    <div className="window-chart">
      <div className="window-bars" role="img" aria-label={T('card.windowChart')}>
        {w.points.map((p) => (
          <span key={p.sowMonthDay} className={`bar${p.sowMonthDay === w.latest ? ' latest' : ''}`}
            title={`${formatMonthDay(p.sowMonthDay, lang)}: ${p.share == null ? '–' : `${p.odds.good}/${p.odds.total}`}`}
            style={{ height: `${Math.max(4, Math.round((p.share ?? 0) * 100))}%` }} />
        ))}
      </div>
      <p className="window-axis">
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
    <details className="card whatif" data-testid="whatif">
      <summary>{T('whatif.title')}</summary>
      <p className="muted">{T('whatif.note')}</p>
      <div className="sliders">
        <label>
          <span>{T('whatif.rain')}: <strong>{signed(rainPct)}%</strong></span>
          <input type="range" min={-30} max={10} step={5} value={rainPct} aria-label={T('whatif.rain')}
            onChange={(e) => onChange({ ...value, rainFactor: 1 + Number(e.target.value) / 100 })} />
        </label>
        <label>
          <span>{T('whatif.temp')}: <strong>{signed(value.dT)}°C</strong></span>
          <input type="range" min={0} max={3} step={0.5} value={value.dT} aria-label={T('whatif.temp')}
            onChange={(e) => onChange({ ...value, dT: Number(e.target.value) })} />
        </label>
        <button className="button secondary small" onClick={() => onChange(REAL)}
          disabled={value.rainFactor === 1 && value.dT === 0}>{T('whatif.reset')}</button>
      </div>
    </details>
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
    <aside className="card drawer" data-testid="drawer">
      <div className="drawer-head">
        <h3>
          {lang === 'th' ? crop.nameTh : crop.nameEn} · {T('drawer.season', { season: formatSeason(season.year, lang) })} ·{' '}
          {ICON[o.kind]} {T(`outcome.${o.kind}`)}
        </h3>
        <button className="close" onClick={p.onClose}><IconClose /> {T('drawer.close')}</button>
      </div>
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
          <rect key={d} x={x(d) - 1.5} y={0} width={3} height={(r / maxRain) * H * 0.4} rx={1.5} fill="var(--sky)" opacity={0.55} />
        ))}
        <line x1={0} x2={W} y1={y(taw - raw)} y2={y(taw - raw)} stroke="var(--sun)" strokeWidth={2} strokeDasharray="6 5" />
        <polyline points={line} fill="none" stroke="var(--leaf)" strokeWidth={3} strokeLinejoin="round" />
        {death != null && <line x1={x(death)} x2={x(death)} y1={0} y2={H} stroke="var(--clay)" strokeWidth={2} />}
      </svg>
      <figcaption className="muted">{caption} · 0–{Math.round(taw)} mm</figcaption>
    </figure>
  );
}
