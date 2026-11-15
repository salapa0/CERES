import { useEffect, useRef, useState } from 'react';
import { About } from './About';
import { cellForPoint, fetchCurrentSeason, loadCell, loadGrid, loadImerg, loadSmap, type ImergCell, type SmapCell } from './data';
import type { CellData, Grid } from './engine';
import { t, type Key, type Lang } from './i18n';
import { BrandMark, FieldsArt, IconLocate } from './icons';
import { MapView, type MapPoint } from './MapView';
import { Results, type CurrentState } from './Results';
import { decodeShare, encodeShare, type Settings } from './share';

type Status = 'idle' | 'loading' | 'loadingLive' | 'outside' | 'error';
type Locate = 'idle' | 'busy' | 'failed';

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
  const [locate, setLocate] = useState<Locate>('idle');
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

  async function onPick(lat: number, lon: number, fly = false) {
    if (!grid) return;
    const id = ++request.current;
    const latest = () => id === request.current;
    setPoint({ lat, lon, fly });
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

  function locateMe() {
    if (!navigator.geolocation) return setLocate('failed');
    setLocate('busy');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocate('idle');
        onPick(p.coords.latitude, p.coords.longitude, true);
      },
      () => setLocate('failed'),
      { timeout: 15000, maximumAge: 600000 },
    );
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
              <p className="lead">{T('hero.short')}</p>
            </div>
            <button className="button primary" onClick={locateMe} disabled={!grid || locate === 'busy'}>
              {locate === 'busy' ? <span className="spinner" /> : <IconLocate />}
              {locate === 'busy' ? T('map.locating') : T('map.locate')}
            </button>
          </section>
          {locate === 'failed' && <p className="notice notice-error"><span className="dot" />{T('map.locateFailed')}</p>}

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
            {cell && <Results cell={cell} lang={lang} current={current} initial={settings} onSettings={setSettings} imerg={imerg} smap={smap} />}
          </div>
        </div>
      </main>
      <footer className="page-foot">{T('app.disclaimer')}</footer>
    </>
  );
}
