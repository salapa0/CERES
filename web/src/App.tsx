import { useEffect, useRef, useState } from 'react';
import { About } from './About';
import { cellForPoint, fetchCurrentSeason, loadCell, loadGrid, loadImerg, loadSmap, type ImergCell, type SmapCell } from './data';
import type { CellData, Grid } from './engine';
import { t, type Key, type Lang } from './i18n';
import { BrandMark, FieldsArt, IconLocate } from './icons';
import { MapView, type MapPoint } from './MapView';
import { Results, type CurrentState } from './Results';
import { browserLangs, pickLang, saveLang, savedLang } from './lang';
import { decodeShare, encodeShare, type Settings } from './share';

type Status = 'idle' | 'loading' | 'loadingLive' | 'outside' | 'error';
type Locate = 'idle' | 'busy' | 'failed';

export default function App() {
  const [lang, setLangState] = useState<Lang>(() => pickLang({ saved: savedLang(), browser: browserLangs() }));
  const setLang = (l: Lang) => { setLangState(l); saveLang(l); }; // only a tap on ไทย/EN is remembered
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
  const mapRef = useRef<HTMLElement>(null);
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
    if (shared.lang) setLangState(shared.lang);
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

  // When a field's results arrive, move focus to their heading so screen readers announce it.
  useEffect(() => {
    const el = resultsRef.current;
    if (!cell || !el) return;
    el.querySelector<HTMLElement>('#results-title')?.focus({ preventScroll: true });
    // Below 1024 px the results sit under the map; bring the answer up rather than leave it below the fold.
    const top = el.getBoundingClientRect().top;
    if (window.innerWidth < 1024 && top > 80) el.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }, [cell]);

  const toMap = () => mapRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });

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
      <a className="skip-link" href="#results-area">{T('app.skip')}</a>
      <header className="topbar">
        <button className="brand" onClick={() => setPage('field')} aria-label={`CERES · ${T('app.subtitle')}`}>
          <BrandMark />
          <span>
            <strong>CERES</strong>
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

      <main id="main" className={point ? 'has-field' : undefined}>
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
          {locate === 'failed' && <p className="notice notice-error" role="alert"><span className="dot" />{T('map.locateFailed')}</p>}

          <div className={`workspace${point ? ' has-field' : ''}`}>
            <div className="map-col">
              <section ref={mapRef} className="card map-card" aria-label={T('map.title')}>
                <MapView point={point} onPick={onPick} lang={lang} hint={T('map.hint')} />
              </section>
              <p className={`notice notice-${status}`} role="status" hidden={status === 'idle'}>
                {busy ? <span className="spinner" /> : <span className="dot" />}
                {status !== 'idle' && T(`app.${status}` as Key)}
              </p>
            </div>
            <div ref={resultsRef} id="results-area" className="results-col" tabIndex={-1}>
              {cell
                ? <Results cell={cell} lang={lang} current={current} initial={settings} onSettings={setSettings} imerg={imerg} smap={smap}
                    onChangeField={toMap} />
                : !busy && <EmptyState lang={lang} />}
            </div>
          </div>
        </div>
      </main>
      <footer className="page-foot">{T('app.disclaimer')}</footer>
    </>
  );
}

/** Before a field is picked: what will happen, in three steps, so the empty side is an invitation, not a gap. */
function EmptyState({ lang }: { lang: Lang }) {
  return (
    <section className="empty" aria-labelledby="empty-title">
      <h2 id="empty-title">{t(lang, 'empty.title')}</h2>
      <ol>
        <li>{t(lang, 'empty.1')}</li>
        <li>{t(lang, 'empty.2')}</li>
        <li>{t(lang, 'empty.3')}</li>
      </ol>
    </section>
  );
}
