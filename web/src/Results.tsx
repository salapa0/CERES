import { useMemo, useState } from 'react';
import {
  buildStrategies, dayIndexToDate, loadCrops, replay, runTimeline, seasonLength,
  type CellData, type Crop, type FieldPosition, type Outcome, type SeasonData, type SoilTexture, type Strategy,
} from './engine';
import { DEFAULT_POSITION, DEFAULT_SOIL, DEFAULT_SOW, SOIL_TEXTURES } from './engine/constants';
import { formatDate, formatMonthDay, formatSeason, t, type Key, type Lang } from './i18n';

const SOW_DATES = ['11-01', '11-15', '12-01', '12-15', '01-01', '01-15', '02-01'];
const ICON: Record<Outcome['kind'], string> = { good: '🌱', poor: '🍂', failed: '✖', nodata: '·' };
const MIN_SEASONS_FOR_MEDIUM = 15;

export function Results({ cell, lang }: { cell: CellData; lang: Lang }) {
  const crops = useMemo(loadCrops, []);
  const [sow, setSow] = useState(DEFAULT_SOW);
  const [soil, setSoil] = useState<SoilTexture>(DEFAULT_SOIL);
  const [position, setPosition] = useState<FieldPosition>(DEFAULT_POSITION);
  const [open, setOpen] = useState<{ crop: Crop; season: SeasonData } | null>(null);

  const timeline = useMemo(() => runTimeline(cell, crops, sow, soil, position), [cell, crops, sow, soil, position]);
  const strategies = useMemo(() => buildStrategies(timeline, crops), [timeline, crops]);
  const name = (c: Crop) => (lang === 'th' ? c.nameTh : c.nameEn);
  const T = (key: Key, vars?: Record<string, string | number>) => t(lang, key, vars);

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

      <div className="cards">
        {strategies.map((s) => <Card key={s.id} s={s} crops={crops} lang={lang} />)}
      </div>

      <h3>{T('timeline.title')}</h3>
      <p className="muted">{T('timeline.hint')} · {T('legend')}</p>
      <div className="timeline">
        <table>
          <thead>
            <tr>
              <th />
              {cell.seasons.map((s) => (
                <th key={s.year} title={formatSeason(s.year, lang)}>{formatSeason(s.year, lang).slice(2, 4)}</th>
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
          lang={lang} onClose={() => setOpen(null)} />
      )}

      <footer className="sources">
        <strong>{T('sources.title')}:</strong> {Object.values(cell.sources).join(' · ')}
        <br />{T('sources.method')}
      </footer>
    </section>
  );
}

function Card({ s, crops, lang }: { s: Strategy; crops: Crop[]; lang: Lang }) {
  const T = (key: Key, vars?: Record<string, string | number>) => t(lang, key, vars);
  const crop = crops.find((c) => c.id === s.cropId);
  const alt = crops.find((c) => c.id === s.altCropId);
  const name = (c: Crop) => (lang === 'th' ? c.nameTh : c.nameEn);
  const level = s.odds && s.odds.total >= MIN_SEASONS_FOR_MEDIUM ? 'medium' : 'low';
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
        </>
      )}
      <p className="effect">{T(`effect.${s.soilEffect}`)}</p>
      {s.odds && (
        <>
          {alt && <p className="muted">{T('card.alt', { name: name(alt) })}</p>}
          <p className={`badge badge-${level}`} title={T(`badge.why.${level}`)}>
            {T('card.confidence')}: {T(`badge.${level}`)} <span className="muted">({T(`badge.why.${level}`)})</span>
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

function Drawer(p: {
  cell: CellData; crop: Crop; season: SeasonData; sow: string; soil: SoilTexture; position: FieldPosition;
  lang: Lang; onClose: () => void;
}) {
  const { lang, season, crop } = p;
  const T = (key: Key, vars?: Record<string, string | number>) => t(lang, key, vars);
  const o = replay({ cell: p.cell, season, crop, sowMonthDay: p.sow, soil: p.soil, position: p.position, withDaily: true });
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
