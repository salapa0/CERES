import { useId, useState } from 'react';
import type { FieldPosition, SoilTexture } from './engine';
import { IRRIGATION_MM, SOIL_TEXTURES } from './engine/constants';
import { formatMonthDay, t, type Key, type Lang } from './i18n';
import { SOW_DATES, WATERING_CHOICES, type Settings } from './share';

const POSITIONS: FieldPosition[] = ['lowland', 'upland'];

/** The four things the answer depends on: a one-line summary first, tap choices on request (no dropdowns, no typing). */
export function FieldSettings({ value, onChange, lang }: { value: Settings; onChange: (s: Settings) => void; lang: Lang }) {
  const [open, setOpen] = useState(false);
  const panel = useId();
  const T = (key: Key, vars?: Record<string, string | number>) => t(lang, key, vars);
  const set = (patch: Partial<Settings>) => onChange({ ...value, ...patch });
  const summary = [
    T('settings.sow', { date: formatMonthDay(value.sow, lang) }),
    T(`soil.${value.soil}`),
    T(`position.${value.position}.short`),
    value.waterings ? T('settings.waterN', { n: value.waterings }) : T('settings.water0'),
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
