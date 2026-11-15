import { useEffect, useRef, useState } from 'react';
import { About } from './About';
import { cellForPoint, fetchCurrentSeason, loadCell, loadGrid, loadImerg, loadSmap, type ImergCell, type SmapCell } from './data';
import { loadCrops, type CellData, type Grid } from './engine';
import { t, type Key, type Lang } from './i18n';
import { GeoError, locate, ROUGH_ACCURACY_M, type Fix, type GeoFailure } from './geo';
import { BrandMark, FieldsArt, IconLocate } from './icons';
import { MapView, type MapPoint } from './MapView';
import { Results, type CurrentState } from './Results';
import { decodeShare, encodeShare, type Settings } from './share';

type Status = 'idle' | 'loading' | 'loadingLive' | 'outside' | 'error';
type Locate = { state: 'idle' } | { state: 'busy' } | { state: 'failed'; reason: GeoFailure } | { state: 'done'; fix: Fix };

const CROP_COUNT = loadCrops().length;

const FAILURE_KEY: Record<GeoFailure, Key> = {
  unsupported: 'map.locateFailed',
  insecure: 'map.locateInsecure',
  denied: 'map.locateDenied',
  unavailable: 'map.locateUnavailable',
  timeout: 'map.locateTimeout',
};

export default function App() {
  const [lang, setLang] = useState<Lang>('en');
  const [page, setPage] = useState<'field' | 'about'>('field');
  const [grid, setGrid] = useState<Grid | null>(null);
  const [point, setPoint] = useState<MapPoint | null>(null);
  const [cell, setCell] = useState<CellData | null>(null);
  const [current, setCurrent] = useState<CurrentState | undefined>();
  const [status, setStatus] = useState<Status>('idle');
  const [imerg, setImerg] = useState<ImergCell | null>(null);
  const [smap, setSmap] = useState<SmapCell | null>(null);
  const [located, setLocated] = useState<Locate>({ state: 'idle' });
  // Kept here, not in Results, so settings survive picking another field and can go into the link.
  const [settings, setSettings] = useState<Partial<Settings>>({});
  const request = useRef(0); // only the latest tap may update the page
  const resultsRef = useRef<HTMLDivElement>(null);
  const T = (key: Key) => t(lang, key);

  useEffect(() => {
    loadGrid().then(setGrid).catch(() => setStatus('error'));
  }, []);

  // A shared link opens straight on its field, settings and language.
  const opened = useRef(false);
  useEffect(() => {
    if (!grid || opened.current) return;
    opened.current = true;
    const shared = decodeShare(window.location.hash);
    if (!shared) return;
    if (shared.lang) setLang(shared.lang);
    setSettings(shared.settings);
    onPick(shared.lat, shared.lon, true);
  }, [grid]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the address bar in step, so copying it (or the Copy link button) shares this exact view.
  useEffect(() => {
    if (!point) return;
    window.history.replaceState(null, '', encodeShare({ lat: point.lat, lon: point.lon, lang, settings }));
  }, [point, lang, settings]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  // When a field's results arrive below the fold (phones), bring their heading into view once.
  useEffect(() => {
    const el = resultsRef.current;
    if (!cell || !el) return;
    const top = el.getBoundingClientRect().top;
    if (top > window.innerHeight * 0.75) el.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }, [cell]);

  async function onPick(lat: number, lon: number, fly = false, accuracy?: number) {
    if (!grid) return;
    const id = ++request.current;
    const latest = () => id === request.current;
    if (accuracy === undefined) setLocated((l) => (l.state === 'done' ? { state: 'idle' } : l)); // a tap replaces the GPS fix
    setPoint({ lat, lon, fly, accuracy });
    const target = cellForPoint(grid, lat, lon);
    setCell(null);
    setCurrent(undefined);
    if (!target) return setStatus('outside');
    setStatus('loading');
    setCurrent('loading');
    setImerg(null);
    loadImerg(target.id).then((m) => latest() && setImerg(m));
    setSmap(null);
    loadSmap(target.id).then((m) => latest() && setSmap(m));
    fetchCurrentSeason(target)
      .then((s) => latest() && setCurrent(s))
      .catch(() => latest() && setCurrent('error'));
    try {
      const data = await loadCell(target, () => latest() && setStatus('loadingLive'));
      if (!latest()) return;
      setCell(data);
      setStatus('idle');
    } catch {
      if (latest()) setStatus('error');
    }
  }

  async function locateMe() {
    setLocated({ state: 'busy' });
    try {
      const fix = await locate();
      setLocated({ state: 'done', fix });
      onPick(fix.lat, fix.lon, true, fix.accuracy); // the pin goes exactly where the device says it is
    } catch (e) {
      setLocated({ state: 'failed', reason: e instanceof GeoError ? e.reason : 'unavailable' });
    }
  }

  const busy = status === 'loading' || status === 'loadingLive';

  return (
    <>
      <header className="topbar">
        <button className="brand" onClick={() => setPage('field')} aria-label={`DEMETER · ${T('app.subtitle')}`}>
          <BrandMark />
          <span>
            <strong>DEMETER</strong>
            <small>{T('app.subtitle')}</small>
          </span>
        </button>
        <nav className="topnav">
          <button className="nav-link" onClick={() => setPage(page === 'about' ? 'field' : 'about')} aria-pressed={page === 'about'}>
            {T('app.about')}
          </button>
          <div className="lang-switch" role="group" aria-label="Language / ภาษา">
            <button aria-pressed={lang === 'en'} onClick={() => setLang('en')} lang="en">EN</button>
            <button aria-pressed={lang === 'th'} onClick={() => setLang('th')} lang="th">ไทย</button>
          </div>
        </nav>
      </header>

      <main>
        {page === 'about' && <About lang={lang} onBack={() => setPage('field')} />}

        {/* Hidden rather than unmounted, so the map and the chosen field survive a visit to About. */}
        <div hidden={page === 'about'} style={{ display: 'contents' }}>
          <section className="sky-band">
            <FieldsArt />
            <div className="sky-copy">
              <h1>{T('hero.title')}</h1>
              <p className="lead">{t(lang, 'hero.short', { n: CROP_COUNT })}</p>
            </div>
            <button className="button primary" onClick={locateMe} disabled={!grid || located.state === 'busy'}>
              {located.state === 'busy' ? <span className="spinner" /> : <IconLocate />}
              {located.state === 'busy' ? T('map.locating') : T('map.locate')}
            </button>
          </section>
          {located.state === 'failed' && (
            <p className="notice notice-error" role="alert"><span className="dot" />{T(FAILURE_KEY[located.reason])}</p>
          )}
          {located.state === 'done' && (
            <p className={`notice ${located.fix.accuracy > ROUGH_ACCURACY_M ? 'notice-outside' : 'notice-info'}`} role="status" data-testid="located">
              <span className="dot" />
              {located.fix.accuracy > ROUGH_ACCURACY_M
                ? t(lang, 'map.locatedRough', { km: (located.fix.accuracy / 1000).toFixed(1) })
                : t(lang, 'map.located', { m: Math.max(1, Math.round(located.fix.accuracy)) })}
            </p>
          )}

          <section className="card map-card" aria-label={T('map.title')}>
            <MapView point={point} onPick={onPick} lang={lang} hint={T('map.hint')} />
          </section>

          {status !== 'idle' && (
            <p className={`notice notice-${status}`} role="status">
              {busy ? <span className="spinner" /> : <span className="dot" />}
              {T(`app.${status}` as Key)}
            </p>
          )}
          <div ref={resultsRef} className="results-anchor">
            {cell && <Results cell={cell} point={point} lang={lang} current={current} initial={settings} onSettings={setSettings} imerg={imerg} smap={smap} />}
          </div>
        </div>
      </main>
      <footer className="page-foot">{T('app.disclaimer')}</footer>
    </>
  );
}
