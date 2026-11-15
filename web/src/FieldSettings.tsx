import { useId, useState } from 'react';
import type { FieldPosition, SoilTexture, WhatIf } from './engine';
import { IRRIGATION_MM, SOIL_TEXTURES } from './engine/constants';
import { formatMonthDay, t, type Key, type Lang } from './i18n';
import { SOW_DATES, WATERING_CHOICES, type Settings } from './share';

const POSITIONS: FieldPosition[] = ['lowland', 'upland'];
const RAIN_STEPS = [-30, -20, -10, 0, 10];
const HEAT_STEPS = [0, 1, 2, 3];
export const REAL: WhatIf = { rainFactor: 1, dT: 0 };

export const signed = (v: number) => (v > 0 ? `+${v}` : v < 0 ? `−${Math.abs(v)}` : '0');

/** "Rain −20%, Temperature +1°C"; null for the real record. */
export function describeWhatIf(w: WhatIf, lang: Lang): string | null {
  if (w.rainFactor === 1 && w.dT === 0) return null;
  const parts: string[] = [];
  if (w.rainFactor !== 1) parts.push(`${t(lang, 'whatif.rain')} ${signed(Math.round((w.rainFactor - 1) * 100))}%`);
  if (w.dT !== 0) parts.push(`${t(lang, 'whatif.temp')} ${signed(w.dT)}°C`);
  return parts.join(', ');
}

/**
 * Everything the answer depends on, weather included (pick → set → see): a one-line summary first,
 * tap choices on request (no dropdowns, no sliders, no typing).
 */
export function FieldSettings({ value, onChange, weather, onWeather, lang }: {
  value: Settings; onChange: (s: Settings) => void; weather: WhatIf; onWeather: (w: WhatIf) => void; lang: Lang;
}) {
  const [open, setOpen] = useState(false);
  const panel = useId();
  const T = (key: Key, vars?: Record<string, string | number>) => t(lang, key, vars);
  const set = (patch: Partial<Settings>) => onChange({ ...value, ...patch });
  const rainPct = Math.round((weather.rainFactor - 1) * 100);
  const summary = [
    T('settings.sow', { date: formatMonthDay(value.sow, lang) }),
    T(`soil.${value.soil}`),
    T(`position.${value.position}.short`),
    value.waterings ? T('settings.waterN', { n: value.waterings }) : T('settings.water0'),
    describeWhatIf(weather, lang) ?? T('settings.weatherReal'),
  ].join(' · ');

  return (
    <section className="settings" aria-label={T('settings.title')}>
      <div className="settings-bar">
        <p>
          <span className="settings-label">{T('settings.title')}</span>
          <span data-testid="settings-summary" className="settings-summary">{summary}</span>
        </p>
        <button className="button secondary small" aria-expanded={open} aria-controls={panel} onClick={() => setOpen(!open)}>
          {open ? T('settings.done') : T('settings.change')}
        </button>
      </div>
      {open && (
        <div id={panel} className="settings-panel">
          <Choices legend={T('input.soil')} hint={T('hint.soil')} name="soil" value={value.soil}
            options={(Object.keys(SOIL_TEXTURES) as SoilTexture[]).map((s) => ({ value: s, label: T(`soil.${s}`) }))}
            onPick={(soil) => set({ soil })} />
          <Choices legend={T('input.position')} hint={T('hint.position')} name="position" value={value.position}
            options={POSITIONS.map((p) => ({ value: p, label: T(`position.${p}.short`) }))}
            onPick={(position) => set({ position })} />
          <Choices legend={T('input.water')} hint={T('hint.water', { mm: IRRIGATION_MM })} name="water" value={String(value.waterings)}
            options={WATERING_CHOICES.map((n) => ({
              value: String(n), label: n === 0 ? T('water.none') : T('water.n', { n, mm: n * IRRIGATION_MM }),
            }))}
            onPick={(n) => set({ waterings: Number(n) })} />
          <Choices legend={T('input.sow')} hint={T('hint.sow')} name="sow" value={value.sow}
            options={SOW_DATES.map((d) => ({ value: d, label: formatMonthDay(d, lang) }))}
            onPick={(sow) => set({ sow })} />
          <div className="weather-set">
            <h3 className="weather-title">{T('whatif.title')}</h3>
            <p className="choices-hint">{T('whatif.note')}</p>
            <Choices legend={T('whatif.rain')} hint={T('whatif.rainHint')} name="rain" value={String(rainPct)}
              options={RAIN_STEPS.map((v) => ({ value: String(v), label: `${signed(v)}%` }))}
              onPick={(v) => onWeather({ ...weather, rainFactor: 1 + Number(v) / 100 })} />
            <Choices legend={T('whatif.temp')} hint={T('whatif.tempHint')} name="heat" value={String(weather.dT)}
              options={HEAT_STEPS.map((v) => ({ value: String(v), label: `${signed(v)}°C` }))}
              onPick={(v) => onWeather({ ...weather, dT: Number(v) })} />
            <button className="button secondary small" onClick={() => onWeather(REAL)}
              disabled={weather.rainFactor === 1 && weather.dT === 0}>{T('whatif.reset')}</button>
          </div>
        </div>
      )}
    </section>
  );
}

/** A radio group drawn as large tap chips; arrow keys move between them as in any radio group. */
export function Choices<V extends string>({ legend, hint, name, value, options, onPick }: {
  legend: string; hint: string; name: string; value: V; options: { value: V; label: string }[]; onPick: (v: V) => void;
}) {
  const id = useId();
  return (
    <fieldset className="choices" role="radiogroup" aria-describedby={`${id}-hint`}>
      <legend>{legend}</legend>
      <p id={`${id}-hint`} className="choices-hint">{hint}</p>
      <div className="chips">
        {options.map((o) => (
          <label key={o.value} className="chip">
            <input type="radio" name={`${id}-${name}`} value={o.value} checked={o.value === value} onChange={() => onPick(o.value)} />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
