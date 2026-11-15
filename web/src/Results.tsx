import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  dayIndexToDate, daysLeft, loadCrops, odds, replay, runTimeline, seasonLength, sowingWindow, waterNeeded,
  type CellData, type Crop, type CropGroup, type FieldPosition, type OddsResult, type Outcome, type SeasonData, type SoilTexture,
  type SowingWindow, type WhatIf,
} from './engine';
import type { ImergCell, SmapCell } from './data';
import { incomeEstimate, type IncomeEstimate } from './engine/income';
import { analogOdds, findAnalogs, type Analog, type CurrentSeason } from './engine/analog';
import { DEFAULT_POSITION, DEFAULT_SOIL, DEFAULT_SOW, IRRIGATION_MM, WATERINGS_SEARCH_MAX } from './engine/constants';
import { dangerMonth, monthOdds, recommend, type DangerMonth, type MonthOdds, type Recommendation } from './engine/recommend';
import { describeWhatIf, FieldSettings, REAL } from './FieldSettings';
import { badge, selfCheck, type SelfCheck } from './engine/selfcheck';
import { formatDate, formatMonthDay, formatSeason, monthName, t, type Key, type Lang } from './i18n';
import { IconClose, IconHistory, IconLeaf, IconPin } from './icons';
import type { Settings } from './share';

const KINDS: Outcome['kind'][] = ['good', 'poor', 'failed', 'nodata'];
const GROUPS: CropGroup[] = ['legume', 'cash', 'veg', 'manure'];
/** The "leave it bare" choice: not a crop, so it has no row in the year chart. */
const FALLOW = 'fallow';

/** Live data for the season under way: still loading, failed, or loaded. */
export type CurrentState = 'loading' | 'error' | CurrentSeason;

type Tr = (key: Key, vars?: Record<string, string | number>) => string;

/** Colour of a crop's odds: green when most years survived, amber for some, red for few. */
function tone(odds: OddsResult | null): 'good' | 'mid' | 'low' | 'none' {
  if (!odds || odds.total === 0) return 'none';
  const share = odds.good / odds.total;
  return share >= 0.6 ? 'good' : share >= 0.3 ? 'mid' : 'low';
}

export function Results({ cell, lang, current, today = new Date(), initial = {}, onSettings, imerg, smap, onChangeField }: {
  cell: CellData; lang: Lang; current?: CurrentState; today?: Date; imerg?: ImergCell | null; smap?: SmapCell | null;
  initial?: Partial<Settings>; onSettings?: (s: Settings) => void; onChangeField?: () => void;
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
  const whatIf = useDeferredValue(whatIfNow); // keeps the choices responsive while the replays catch up
  const [open, setOpen] = useState<{ crop: Crop; season: SeasonData } | null>(null);
  // The farmer's own pick; until they make one, the choice follows the recommendation as settings change.
  const [picked, setPicked] = useState<string | null>(null);

  const timeline = useMemo(
    () => runTimeline(cell, crops, sow, soil, position, whatIf, waterings),
    [cell, crops, sow, soil, position, whatIf, waterings]);
  const rec = useMemo(() => recommend(timeline, crops), [timeline, crops]);
  const shown = picked ?? rec.cropId ?? rec.closest ?? FALLOW;
  const shownCrop = crops.find((c) => c.id === shown) ?? null;
  const oddsOf = useMemo(
    () => Object.fromEntries(crops.map((c) => [c.id, odds(timeline[c.id] ?? [])])) as Record<string, OddsResult>,
    [timeline, crops]);
  const incomes = useMemo(
    () => Object.fromEntries(crops.map((c) => [c.id, incomeEstimate(timeline[c.id] ?? [], c.market)])) as Record<string, IncomeEstimate | null>,
    [timeline, crops]);
  // The sowing sweep is costly (a replay per date per year), so only for the crops on screen.
  const windows = useMemo(() => Object.fromEntries([...new Set([shownCrop?.id, rec.cropId])]
    .filter((id): id is string => !!id)
    .map((id) => [id, sowingWindow(cell, crops.find((c) => c.id === id)!, soil, position, whatIf, waterings)])) as Record<string, SowingWindow>,
  [cell, crops, shownCrop, rec.cropId, soil, position, whatIf, waterings]);
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
  const T: Tr = (key, vars) => t(lang, key, vars);
  const whatIfDesc = describeWhatIf(whatIf, lang);

  return (
    <section className="results" aria-labelledby="results-title">
      <div className="results-head">
        <h2 id="results-title" tabIndex={-1}>{T('field.title')}</h2>
        <span className="coord" title={`${T('results.chosen')} · ${T('field.cellNote')}`}>
          <IconPin /> {cell.lat.toFixed(2)}, {cell.lon.toFixed(2)}
        </span>
        <div className="results-actions">
          {onChangeField && <button className="button secondary small change-field" onClick={onChangeField}>{T('field.change')}</button>}
          <ShareButton lang={lang} />
        </div>
      </div>

      <FieldSettings value={{ sow, soil, position, waterings }} lang={lang} weather={whatIfNow} onWeather={setWhatIf}
        onChange={(s) => { setSow(s.sow); setSoil(s.soil); setPosition(s.position); setWaterings(s.waterings); }} />
      <Summary rec={rec} crops={crops} oddsOf={oddsOf} incomes={incomes} window={rec.cropId ? windows[rec.cropId] : undefined}
        lang={lang} today={today} whatIfDesc={whatIfDesc} needs={needs} waterings={waterings} />

      <CropPicker crops={crops} shown={shown} rec={rec} oddsOf={oddsOf} incomes={incomes} lang={lang} onPick={setPicked} />
      <CropDetail crop={shownCrop} o={shownCrop ? oddsOf[shownCrop.id] : null} isRec={shown === rec.cropId}
        income={shownCrop ? incomes[shownCrop.id] : null} window={shownCrop ? windows[shownCrop.id] : undefined}
        analog={shownCrop && analogs.length ? analogOdds(timeline[shownCrop.id], cell.seasons, analogs) : null}
        need={shownCrop ? needs[shownCrop.id] : undefined} waterings={waterings} hitRate={hitRate}
        months={shownCrop && windows[shownCrop.id] ? monthOdds(windows[shownCrop.id]) : null}
        danger={shownCrop ? dangerMonth(timeline[shownCrop.id] ?? [], cell.seasons) : null}
        whatIfDesc={whatIfDesc} lang={lang} today={today} />

      <YearChart cell={cell} crops={crops} timeline={timeline} analogs={analogs} shown={shown} recId={rec.cropId}
        open={open} onOpen={setOpen} lang={lang} />

      {open && (
        <Drawer cell={cell} crop={open.crop} season={open.season} sow={sow} soil={soil} position={position}
          whatIf={whatIf} waterings={waterings} lang={lang} onClose={() => setOpen(null)} />
      )}

      <CheckCard current={current} analogs={analogs} imerg={imerg} smap={smap} check={check} lang={lang} />

      <footer className="sources" title={T('field.cellNote')}>
        <strong>{T('sources.title')}:</strong> {Object.values(cell.sources).join(' · ')}
        {current && typeof current === 'object' && <> · {T('sources.current')}</>}
        <br />{T('sources.method')}
      </footer>
    </section>
  );
}

/**
 * Every crop in every past year. A top-level component on purpose: declared inside Results, React saw a new
 * component on each render and rebuilt it, losing "show all" and the focused year button.
 */
function YearChart({ cell, crops, timeline, analogs, shown, recId, open, onOpen, lang }: {
  cell: CellData; crops: Crop[]; timeline: Record<string, Outcome[]>; analogs: Analog[]; shown: string; recId: string | null;
  open: { crop: Crop; season: SeasonData } | null; onOpen: (o: { crop: Crop; season: SeasonData }) => void; lang: Lang;
}) {
  const T: Tr = (key, vars) => t(lang, key, vars);
  const name = (c: Crop) => cropName(c, lang);
  const [all, setAll] = useState(false);
  const minor = (c: Crop) => c.id !== shown && c.id !== recId;
  return (
    <section className={`card timeline-card${all ? ' show-all' : ''}`} aria-labelledby="timeline-title">
      <div className="card-heading">
        <div>
          <h3 id="timeline-title">{T('timeline.title')}</h3>
          <p>{T('timeline.hint')}</p>
        </div>
      </div>
      <ul className="legend" aria-label={T('legend')}>
        {KINDS.map((k) => (
          <li key={k}><span className={`mark ${k}`} aria-hidden="true" />{T(`outcome.${k}`)}</li>
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
              <tr key={crop.id} data-testid="timeline-row"
                className={crop.id === shown ? 'is-picked' : minor(crop) ? 'minor' : undefined}>
                <th scope="row">{name(crop)}</th>
                {timeline[crop.id].map((o, i) => {
                  const isOpen = open?.crop.id === crop.id && open.season.year === cell.seasons[i].year;
                  return (
                    <td key={cell.seasons[i].year}>
                      <button className={`cell${isOpen ? ' is-open' : ''}`} aria-pressed={isOpen}
                        onClick={() => onOpen({ crop, season: cell.seasons[i] })}
                        aria-label={`${formatSeason(cell.seasons[i].year, lang)}: ${T(`outcome.${o.kind}`)}`}
                        title={`${formatSeason(cell.seasons[i].year, lang)}: ${T(`outcome.${o.kind}`)}`}>
                        <span className={`mark ${o.kind}`} aria-hidden="true" />
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* On a phone ten rows bury the answer; show the picked and recommended crop first. CSS hides this on wide screens. */}
      <button className="button secondary small show-all-toggle" aria-expanded={all} onClick={() => setAll(!all)}>
        {all ? T('timeline.fewer') : T('timeline.all')}
      </button>
    </section>
  );
}

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

// Thai has no spaces, and a browser may break a crop name it does not know ("ปอเทือ|ง"); keep the name whole.
const SLOT = '\u0000';
const keepWhole = (text: string, name: string) =>
  text.split(SLOT).flatMap((part, i) => (i ? [<span key={i} className="nobr">{name}</span>, part] : [part]));

const cropName = (c: Crop, lang: Lang) => (lang === 'th' ? c.nameTh : c.nameEn);

/** One-sentence answer: the best-earning safe crop, or plainly that no crop to sell is safe. */
function Summary({ rec, crops, oddsOf, incomes, window: w, lang, today, whatIfDesc, needs, waterings }: {
  rec: Recommendation; crops: Crop[]; oddsOf: Record<string, OddsResult>; incomes: Record<string, IncomeEstimate | null>;
  window?: SowingWindow; lang: Lang; today: Date; whatIfDesc: string | null; needs: Record<string, number | null>; waterings: number;
}) {
  const T: Tr = (key, vars) => t(lang, key, vars);
  if (rec.reason === 'noData') return null;
  const note = whatIfDesc && <p className="summary-note">{T('summary.whatIf')}</p>;
  if (rec.reason === 'safeIncome' && rec.cropId) {
    const crop = crops.find((c) => c.id === rec.cropId)!;
    const o = oddsOf[crop.id];
    const left = w?.latest ? daysLeft(w.latest, today) : null;
    return (
      <div className="card summary tone-good" data-testid="summary">
        <p className="summary-kicker">{T('summary.kicker')}</p>
        <p className="summary-main">
          {keepWhole(T('summary.best', { crop: SLOT, avg: baht(incomes[crop.id]?.average ?? 0, lang), good: o.good, total: o.total }), cropName(crop, lang))}
        </p>
        {w?.latest && (
          <p className="summary-plant">
            {T('card.window', { date: formatMonthDay(w.latest, lang) })}
            {left != null && <> · {daysText(left, T)}</>}
          </p>
        )}
        <p className="summary-safe">{T('summary.safeMeans')}</p>
        {note}
      </div>
    );
  }
  // No crop to sell is safe: name the closest and, before any watering is set, the cheapest fix with water.
  const closest = crops.find((c) => c.id === rec.closest);
  const o = closest ? oddsOf[closest.id] : null;
  const thirsty = crops
    .filter((c) => c.market)
    .map((c) => ({ c, n: needs[c.id] }))
    .filter((x): x is { c: Crop; n: number } => x.n != null && x.n > 0)
    .sort((a, b) => a.n - b.n)[0];
  return (
    <div className={`card summary tone-${o && tone(o) === 'mid' ? 'mid' : 'low'}`} data-testid="summary">
      <p className="summary-kicker">{T('summary.kicker')}</p>
      <p className="summary-main">
        {closest && o && o.good > 0
          ? keepWhole(T(waterings ? 'summary.noneSafeWatered' : 'summary.noneSafe', { crop: SLOT, good: o.good, total: o.total }), cropName(closest, lang))
          : o ? T(waterings ? 'summary.noneSurvivedWatered' : 'summary.noneSurvived', { total: o.total })
          : T('summary.noPriced')}
      </p>
      {waterings === 0 && thirsty && (
        <p className="summary-plant" data-testid="summary-water">
          {keepWhole(T('summary.water', { crop: SLOT, n: thirsty.n, mm: thirsty.n * IRRIGATION_MM }), cropName(thirsty.c, lang))}
        </p>
      )}
      <p className="summary-safe">{T('summary.safeMeans')}</p>
      {note}
    </div>
  );
}

const daysText = (left: number, T: Tr) =>
  left > 1 ? T('card.daysLeft', { n: left }) : left === 1 ? T('card.dayLeft') : left === 0 ? T('card.lastDay') : T('card.late');

/** What the farmer will plant: every crop, grouped, each with its income and years survived; the pick drives the detail. */
function CropPicker({ crops, shown, rec, oddsOf, incomes, lang, onPick }: {
  crops: Crop[]; shown: string; rec: Recommendation; oddsOf: Record<string, OddsResult>;
  incomes: Record<string, IncomeEstimate | null>; lang: Lang; onPick: (id: string) => void;
}) {
  const T: Tr = (key, vars) => t(lang, key, vars);
  const id = useId();
  const money = (c: Crop) => {
    if (c.group === 'manure') return T('pick.noIncome');
    if (!c.market) return T('pick.noPrice');
    const inc = incomes[c.id];
    return inc ? T('pick.income', { avg: baht(inc.average, lang) }) : T('card.noData');
  };
  const years = (c: Crop) => {
    const o = oddsOf[c.id];
    return o && o.total ? T('pick.odds', { good: o.good, total: o.total }) : T('card.noData');
  };
  const chip = (value: string, label: string, meta: string, isRec = false, cls = '') => (
    <label key={value} className={`chip crop-chip${isRec ? ' is-rec' : ''}${cls}`}>
      <input type="radio" name={`${id}-crop`} value={value} checked={shown === value} onChange={() => onPick(value)} />
      <span>
        <strong className="nobr">{label}</strong>
        {isRec && <em className="rec-tag">{T('pick.rec')}</em>}
        <small className="chip-meta">{meta}</small>
      </span>
    </label>
  );
  return (
    <fieldset className="card picker" role="radiogroup" aria-labelledby={`${id}-title`}>
      <legend id={`${id}-title`} className="picker-title">{T('pick.title')}</legend>
      <p className="choices-hint">{T('pick.hint')}</p>
      {GROUPS.map((g) => {
        const items = crops.filter((c) => c.group === g);
        if (!items.length && g !== 'manure') return null;
        return (
          <div key={g} className="pick-group">
            <p className="pick-group-title">{T(`group.${g}`)}</p>
            <div className="chips">
              {items.map((c) => {
                const tn = tone(oddsOf[c.id] ?? null);
                return chip(c.id, cropName(c, lang), `${money(c)} · ${years(c)}`, c.id === rec.cropId, ` tone-${tn}`);
              })}
              {g === 'manure' && chip(FALLOW, T('fallow.name'), `${T('pick.noIncome')} · ${T('pick.noRisk')}`)}
            </div>
          </div>
        );
      })}
    </fieldset>
  );
}

/** Everything about the picked crop, income first; `crop` null is "leave the field bare". */
function CropDetail({ crop, o, isRec, income, window, analog, need, waterings, hitRate, months, danger, whatIfDesc, lang, today }: {
  crop: Crop | null; o: OddsResult | null; isRec: boolean; income: IncomeEstimate | null; window?: SowingWindow;
  analog: OddsResult | null; need?: number | null; waterings: number; hitRate: number | null;
  months?: MonthOdds[] | null; danger?: DangerMonth | null; whatIfDesc: string | null; lang: Lang; today: Date;
}) {
  const T: Tr = (key, vars) => t(lang, key, vars);
  if (!crop) {
    return (
      <article className="card detail tone-none" data-testid="detail" aria-labelledby="detail-title">
        <h3 id="detail-title" className="detail-name">{T('fallow.name')}</h3>
        <p className="income-main is-none">{T('pick.noIncome')}</p>
        <p className="body">{T('fallow.body')}</p>
        <p className="effect effect-bare"><IconLeaf />{T('effect.bare')}</p>
      </article>
    );
  }
  const has = !!o && o.total > 0;
  const { level, why } = badge({ seasons: o?.total ?? 0, analog, hitRate });
  const whyText = why.map((w) => T(`badge.why.${w}`));
  return (
    <article className={`card detail tone-${tone(o)}`} data-testid="detail" aria-labelledby="detail-title">
      <h3 id="detail-title" className="detail-name">
        <span className="nobr">{cropName(crop, lang)}</span>
        {isRec && <em className="rec-tag">{T('pick.rec')}</em>}
      </h3>
      <p className={`income-main${income && crop.market ? '' : ' is-none'}`} data-testid="income">
        {crop.group === 'manure' ? T('income.none')
          : !crop.market ? T('income.noPrice')
          : income ? <>{T('income.est', { avg: baht(income.average, lang), good: baht(income.goodYear, lang) })}
              <small> · {T('income.src', { date: monthYear(crop.market.asOf, lang) })}</small></>
          : T('card.noData')}
      </p>
      {!has && <p className="odds">{T('card.noData')}</p>}
      {has && (
        <>
          <p className="odds">{T('card.odds', { good: o!.good, total: o!.total })}</p>
          <SeasonMarks odds={o!} lang={lang} />
          {analog && analog.total > 0 && (
            <p className="analog-odds" data-testid="analog-odds">{T('card.analog', { good: analog.good, total: analog.total })}</p>
          )}
          {whatIfDesc && <p className="whatif-note">{T('card.whatIf', { desc: whatIfDesc })}</p>}
        </>
      )}
      {has && need !== undefined && (
        <p className="water-need" data-testid="water-need">
          {waterings > 0 && <>{T('card.withWater', { n: waterings })} · </>}
          {need === null ? T('card.needMany', { n: WATERINGS_SEARCH_MAX })
            : need === 0 ? T('card.needNone')
            : T('card.need', { n: need, mm: need * IRRIGATION_MM })}
        </p>
      )}
      {window && <WindowInfo w={window} lang={lang} today={today} />}
      {months && months.length > 0 && (
        <p className="month-odds" data-testid="month-odds">
          <span className="month-label">{T('month.title')}:</span>{' '}
          {months.map((m) => `${monthName(m.month, lang)} ${m.total ? `${m.good}/${m.total}` : '–'}`).join(' · ')}
        </p>
      )}
      {danger && (
        <p className="danger-month" data-testid="danger-month">
          {T('month.danger', { month: monthName(danger.month, lang), count: danger.count, failed: danger.failed })}
        </p>
      )}
      <p className={`effect effect-${crop.soilEffect}`}><IconLeaf />{T(`effect.${crop.soilEffect}`)}</p>
      <details className="more">
        <summary>{T('card.more')}</summary>
        {has && <p className="odds-detail">{T('card.detail', { poor: o!.poor, failed: o!.failed })}</p>}
        {window && <WindowChart w={window} lang={lang} />}
        <p className={`pill badge-${level}`} title={whyText.join('\n')}>
          {T('card.confidence')}: {T(`badge.${level}`)}
        </p>
        {whyText.map((w) => <p key={w} className="badge-why">{w}</p>)}
        <p className="more-h">{T('card.blind')}</p>
        <ul>
          <li>{T('card.blind.1')}</li><li>{T('card.blind.2')}</li><li>{T('card.blind.3')}</li><li>{T('card.blind.4')}</li>
          {crop.assumption && <li>{T('card.estimate')}</li>}
        </ul>
        <p>{T('card.ask')}</p>
      </details>
    </article>
  );
}

/** One mark per past year, survived first, so "7 of 25" can be counted by eye (an icon array). */
function SeasonMarks({ odds, lang }: { odds: OddsResult; lang: Lang }) {
  const marks = [
    ...Array<Outcome['kind']>(odds.good).fill('good'),
    ...Array<Outcome['kind']>(odds.poor).fill('poor'),
    ...Array<Outcome['kind']>(odds.failed).fill('failed'),
  ];
  const label = [`${t(lang, 'outcome.good')} ${odds.good}`, `${t(lang, 'outcome.poor')} ${odds.poor}`,
    `${t(lang, 'outcome.failed')} ${odds.failed}`].join(' · ');
  return (
    <div className="marks" role="img" aria-label={label} title={label} data-testid="marks">
      {marks.map((k, i) => <span key={i} className={`mark ${k}`} />)}
    </div>
  );
}

/** The NASA checks in one place, each with a plain headline: the data behind the answer. */
function CheckCard({ current, analogs, imerg, smap, check, lang }: {
  current?: CurrentState; analogs: Analog[]; imerg?: ImergCell | null; smap?: SmapCell | null; check: SelfCheck | null; lang: Lang;
}) {
  return (
    <section className="card check" aria-labelledby="check-title">
      <h3 id="check-title">{t(lang, 'check.title')}</h3>
      <p className="muted">{t(lang, 'check.lead')}</p>
      <div className="check-list">
        <AnalogLine current={current} analogs={analogs} lang={lang} />
        <SelfCheckLine check={check} lang={lang} />
        <SatelliteRain current={current} imerg={imerg} lang={lang} />
        <SoilNow smap={smap} lang={lang} />
      </div>
    </section>
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
          {left != null && <span className={left < 0 ? 'late' : 'left'}>{' · '}{daysText(left, T)}</span>}
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
          <span className={`mark ${o.kind}`} aria-hidden="true" /> {T(`outcome.${o.kind}`)}
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
