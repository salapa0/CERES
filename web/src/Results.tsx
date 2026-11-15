import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildStrategies, dayIndexToDate, daysLeft, loadCrops, replay, runTimeline, seasonLength, sowingWindow, waterNeeded,
  type CellData, type Crop, type FieldPosition, type OddsResult, type Outcome, type SeasonData, type SoilTexture,
  type SowingWindow, type Strategy, type WhatIf,
} from './engine';
import type { ImergCell, SmapCell } from './data';
import { incomeEstimate, type IncomeEstimate } from './engine/income';
import { analogOdds, findAnalogs, type Analog, type CurrentSeason } from './engine/analog';
import { DEFAULT_POSITION, DEFAULT_SOIL, DEFAULT_SOW, IRRIGATION_MM, SOIL_TEXTURES, WATERINGS_SEARCH_MAX } from './engine/constants';
import { badge, selfCheck, type SelfCheck } from './engine/selfcheck';
import { formatDate, formatMonthDay, formatSeason, t, type Key, type Lang } from './i18n';
import { IconClose, IconHistory, IconLeaf, IconPin } from './icons';
import { SOW_DATES, WATERING_CHOICES, type Settings } from './share';

const ICON: Record<Outcome['kind'], string> = { good: '🌱', poor: '🍂', failed: '✖', nodata: '·' };
const KINDS: Outcome['kind'][] = ['good', 'poor', 'failed', 'nodata'];
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

export function Results({ cell, point, lang, current, today = new Date(), initial = {}, onSettings, imerg, smap }: {
  cell: CellData; point?: { lat: number; lon: number } | null; lang: Lang; current?: CurrentState; today?: Date;
  imerg?: ImergCell | null; smap?: SmapCell | null;
  initial?: Partial<Settings>; onSettings?: (s: Settings) => void;
}) {
  const crops = useMemo(loadCrops, []);
  const [sow, setSow] = useState(initial.sow ?? DEFAULT_SOW);
  const [soil, setSoil] = useState<SoilTexture>(initial.soil ?? DEFAULT_SOIL);
  const [position, setPosition] = useState<FieldPosition>(initial.position ?? DEFAULT_POSITION);
  const [waterings, setWaterings] = useState(initial.waterings ?? 0);
  const report = useRef(onSettings);
  report.current = onSettings;
  useEffect(() => { report.current?.({ sow, soil, position, waterings }); }, [sow, soil, position, waterings]);
  const [whatIfNow, setWhatIf] = useState<WhatIf>(REAL);
  const whatIf = useDeferredValue(whatIfNow); // keeps the sliders smooth while the replays catch up
  const [open, setOpen] = useState<{ crop: Crop; season: SeasonData } | null>(null);

  const timeline = useMemo(
    () => runTimeline(cell, crops, sow, soil, position, whatIf, waterings),
    [cell, crops, sow, soil, position, whatIf, waterings]);
  const strategies = useMemo(() => buildStrategies(timeline, crops), [timeline, crops]);
  const windows = useMemo(() => Object.fromEntries(crops
    .filter((c) => strategies.some((s) => s.cropId === c.id))
    .map((c) => [c.id, sowingWindow(cell, c, soil, position, whatIf, waterings)])),
    [cell, crops, strategies, soil, position, whatIf, waterings]);
  // How many waterings each crop would need to be safe, whatever the farmer has chosen above.
  const needs = useMemo(() => Object.fromEntries(
    crops.map((c) => [c.id, waterNeeded(cell, c, sow, soil, position, whatIf)])), [cell, crops, sow, soil, position, whatIf]);
  const analogs = useMemo(
    () => (current && typeof current === 'object' ? findAnalogs(cell.seasons, current) : []), [cell, current]);
  // The self-check uses mung bean at the default sowing date on the farmer's soil (blueprint §9.8).
  const check = useMemo(() => {
    const mung = crops.find((c) => c.id === 'mungbean');
    return mung ? selfCheck(cell, mung, soil, position) : null;
  }, [cell, crops, soil, position]);
  const hitRate = check && check.total > 0 ? check.agree / check.total : null;
  const name = (c: Crop) => (lang === 'th' ? c.nameTh : c.nameEn);
  const T: Tr = (key, vars) => t(lang, key, vars);
  const whatIfDesc = describeWhatIf(whatIf, lang);

  return (
    <section className="results" aria-labelledby="results-title">
      <div className="results-head">
        <h2 id="results-title">{T('field.title')}</h2>
        {/* The point the farmer picked or the device reported, not the centre of the 55 km data cell behind it. */}
        <span className="coord" data-testid="coord"
          title={`${T('results.chosen')} · ${T('field.cellNote')} · ${T('field.cellCentre', { lat: cell.lat.toFixed(2), lon: cell.lon.toFixed(2) })}`}>
          <IconPin /> {(point ?? cell).lat.toFixed(4)}, {(point ?? cell).lon.toFixed(4)}
        </span>
        <ShareButton lang={lang} />
      </div>

      <Summary strategies={strategies} crops={crops} windows={windows} lang={lang} today={today} whatIfDesc={whatIfDesc}
        needs={needs} waterings={waterings} />
      <AnalogLine current={current} analogs={analogs} lang={lang} />
      <SatelliteRain current={current} imerg={imerg} lang={lang} />
      <SoilNow smap={smap} lang={lang} />

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
        <label>{T('input.water')}
          <select value={waterings} onChange={(e) => setWaterings(Number(e.target.value))} data-testid="waterings">
            {WATERING_CHOICES.map((n) => (
              <option key={n} value={n}>{n === 0 ? T('water.none') : T('water.n', { n, mm: n * IRRIGATION_MM })}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="cards" aria-label={T('results.options')}>
        {strategies.map((s) => (
          <Card key={s.id} s={s} crops={crops} lang={lang} today={today}
            window={s.cropId ? windows[s.cropId] : undefined}
            analog={s.cropId && analogs.length ? analogOdds(timeline[s.cropId], cell.seasons, analogs) : null}
            need={s.cropId ? needs[s.cropId] : undefined} waterings={waterings}
            income={s.cropId ? incomeEstimate(timeline[s.cropId] ?? [], crops.find((c) => c.id === s.cropId)?.market) : null}
            hitRate={hitRate} whatIfDesc={whatIfDesc} />
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
        <SelfCheckLine check={check} lang={lang} />
      </section>

      {open && (
        <Drawer cell={cell} crop={open.crop} season={open.season} sow={sow} soil={soil} position={position}
          whatIf={whatIf} waterings={waterings} lang={lang} onClose={() => setOpen(null)} />
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

/** "Soil now": SMAP root-zone moisture on its latest day, and how it ranks against the same date in past years. */
function SoilNow({ smap, lang }: { smap?: SmapCell | null; lang: Lang }) {
  if (!smap) return null;
  const T: Tr = (key, vars) => t(lang, key, vars);
  const wetter = smap.past.filter((p) => p.value < smap.now).length;
  const drier = smap.past.filter((p) => p.value > smap.now).length;
  const m = smap.past.length;
  return (
    <p className="analog-line is-quiet" data-testid="smap-line" title={T('smap.how')}>
      {T('smap.line', { date: formatDate(new Date(`${smap.date}T00:00:00Z`), lang), pct: Math.round(smap.now * 100) })}
      {m > 0 && <> · {wetter >= drier ? T('smap.wetter', { n: wetter, m }) : T('smap.drier', { n: drier, m })}</>}
    </p>
  );
}

/** How often the model's dry-down day matched GLDAS satellite-informed soil moisture (blueprint §9.8). */
function SelfCheckLine({ check, lang }: { check: SelfCheck | null; lang: Lang }) {
  if (!check || check.total === 0) return null;
  return (
    <p className="selfcheck" data-testid="selfcheck-line" title={t(lang, 'selfcheck.how')}>
      {t(lang, 'selfcheck.line', { agree: check.agree, total: check.total })}
    </p>
  );
}

/** IMERG satellite rain beside the model's (POWER) rain over the same days: an independent check on the input. */
function SatelliteRain({ current, imerg, lang }: { current?: CurrentState; imerg?: ImergCell | null; lang: Lang }) {
  if (!imerg || !current || typeof current !== 'object' || current.start !== imerg.start) return null;
  const dayOf = (iso: string) => Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${imerg.start}T00:00:00Z`)) / 86400000);
  const end = Math.min(dayOf(current.asOf), dayOf(imerg.asOf), current.rain.length - 1, imerg.rain.length - 1);
  if (end < 0) return null;
  const total = (xs: (number | null)[]) => Math.round(xs.slice(0, end + 1).reduce<number>((a, x) => a + (x ?? 0), 0));
  const to = formatDate(new Date(Date.parse(`${imerg.start}T00:00:00Z`) + end * 86400000), lang);
  return (
    <p className="analog-line is-quiet" data-testid="imerg-line" title={t(lang, 'imerg.how')}>
      {t(lang, 'imerg.line', { sat: total(imerg.rain), model: total(current.rain), date: to })}
    </p>
  );
}

/** One-sentence answer: the best crop here, its odds and the date to plant by. */
function Summary({ strategies, crops, windows, lang, today, whatIfDesc, needs, waterings }: {
  strategies: Strategy[]; crops: Crop[]; windows: Record<string, SowingWindow>; lang: Lang; today: Date;
  whatIfDesc: string | null; needs: Record<string, number | null>; waterings: number;
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
  // When nothing is safe on leftover moisture alone, say what the cheapest fix with water would be.
  const thirsty = crops
    .map((c) => ({ c, n: needs[c.id] }))
    .filter((x): x is { c: Crop; n: number } => x.n != null && x.n > 0)
    .sort((a, b) => a.n - b.n)[0];
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
      {level !== 'good' && waterings === 0 && thirsty && (
        <p className="summary-plant" data-testid="summary-water">
          {T('summary.water', { crop: lang === 'th' ? thirsty.c.nameTh : thirsty.c.nameEn, n: thirsty.n, mm: thirsty.n * IRRIGATION_MM })}
        </p>
      )}
      {whatIfDesc && <p className="summary-note">{T('summary.whatIf')}</p>}
    </div>
  );
}

function Card({ s, crops, lang, today, window, analog, whatIfDesc, need, waterings, income, hitRate }: {
  s: Strategy; crops: Crop[]; lang: Lang; today: Date; window?: SowingWindow; analog: OddsResult | null;
  whatIfDesc: string | null; need?: number | null; waterings: number; income?: IncomeEstimate | null;
  hitRate: number | null;
}) {
  const T: Tr = (key, vars) => t(lang, key, vars);
  const crop = crops.find((c) => c.id === s.cropId);
  const alt = crops.find((c) => c.id === s.altCropId);
  const name = (c: Crop) => (lang === 'th' ? c.nameTh : c.nameEn);
  const { level, why } = badge({ seasons: s.odds?.total ?? 0, analog, hitRate });
  const whyText = why.map((w) => T(`badge.why.${w}`));
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
      {s.odds && s.odds.total > 0 && need !== undefined && (
        <p className="water-need" data-testid="water-need">
          {waterings > 0 && <>{T('card.withWater', { n: waterings })} · </>}
          {need === null ? T('card.needMany', { n: WATERINGS_SEARCH_MAX })
            : need === 0 ? T('card.needNone')
            : T('card.need', { n: need, mm: need * IRRIGATION_MM })}
        </p>
      )}
      {s.odds && s.odds.total > 0 && crop && (
        <p className="income" data-testid="income">
          {income && crop.market
            ? <>{T('income.est', { avg: baht(income.average, lang), good: baht(income.goodYear, lang) })}
                <small> · {T('income.src', { date: monthYear(crop.market.asOf, lang) })}</small></>
            : crop.greenManure ? T('income.none') : T('income.noPrice')}
        </p>
      )}
      {s.odds && window && <WindowInfo w={window} lang={lang} today={today} />}
      {s.odds && <p className={`effect effect-${s.soilEffect}`}><IconLeaf />{T(`effect.${s.soilEffect}`)}</p>}
      {s.odds && (
        <details className="more">
          <summary>{T('card.more')}</summary>
          {s.odds.total > 0 && <p className="odds-detail">{T('card.detail', { poor: s.odds.poor, failed: s.odds.failed })}</p>}
          {window && <WindowChart w={window} lang={lang} />}
          {alt && <p className="alt">{T('card.alt', { name: name(alt) })}</p>}
          <p className={`pill badge-${level}`} title={whyText.join('\n')}>
            {T('card.confidence')}: {T(`badge.${level}`)}
          </p>
          {whyText.map((w) => <p key={w} className="badge-why">{w}</p>)}
          <p className="more-h">{T('card.blind')}</p>
          <ul>
            <li>{T('card.blind.1')}</li><li>{T('card.blind.2')}</li><li>{T('card.blind.3')}</li><li>{T('card.blind.4')}</li>
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

// In-app browsers (LINE, Facebook) and embedded panes often block the clipboard API; the old command still works there.
function copyBySelection(text: string): boolean {
  const box = document.createElement('textarea');
  box.value = text;
  box.setAttribute('readonly', '');
  box.style.position = 'fixed';
  box.style.opacity = '0';
  document.body.appendChild(box);
  box.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    box.remove();
  }
}

/** Copies the page address, which App keeps in step with the chosen field and settings. */
function ShareButton({ lang }: { lang: Lang }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  async function copy() {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setState('copied');
    } catch {
      setState(copyBySelection(url) ? 'copied' : 'failed');
    }
  }
  return (
    <span className="share">
      <button className="button secondary small" onClick={copy}>{t(lang, 'share.copy')}</button>
      {state !== 'idle' && <span role="status" className="share-note">{t(lang, `share.${state}`)}</span>}
    </span>
  );
}

// Rounded to 10 baht: the inputs are far rougher than that.
const baht = (n: number, lang: Lang) => (Math.round(n / 10) * 10).toLocaleString(lang === 'th' ? 'th-TH' : 'en-US');
const monthYear = (ym: string, lang: Lang) => new Date(`${ym}-15T00:00:00Z`)
  .toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });

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
  whatIf: WhatIf; waterings: number; lang: Lang; onClose: () => void;
}) {
  const { lang, season, crop } = p;
  const T: Tr = (key, vars) => t(lang, key, vars);
  const o = replay({
    cell: p.cell, season, crop, sowMonthDay: p.sow, soil: p.soil, position: p.position, whatIf: p.whatIf, waterings: p.waterings,
    withDaily: true,
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
