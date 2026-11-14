import { useEffect, useRef, useState } from 'react';
import { About } from './About';
import { cellForPoint, fetchCurrentSeason, loadCell, loadGrid } from './data';
import type { CellData, Grid } from './engine';
import { t, type Key, type Lang } from './i18n';
import { MapView, type MapPoint } from './MapView';
import { Results, type CurrentState } from './Results';

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
  const [locate, setLocate] = useState<Locate>('idle');
  const request = useRef(0); // only the latest tap may update the page

  useEffect(() => {
    loadGrid().then(setGrid).catch(() => setStatus('error'));
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

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

  return (
    <main>
      <header>
        <div>
          <h1>DEMETER</h1>
          <p className="subtitle">{t(lang, 'app.subtitle')}</p>
        </div>
        <nav>
          <button onClick={() => setPage(page === 'about' ? 'field' : 'about')} aria-pressed={page === 'about'}>
            {t(lang, 'app.about')}
          </button>
          <button className="lang" onClick={() => setLang(lang === 'th' ? 'en' : 'th')}>{lang === 'th' ? 'EN' : 'ไทย'}</button>
        </nav>
      </header>

      {page === 'about' && <About lang={lang} onBack={() => setPage('field')} />}

      {/* Hidden rather than unmounted, so the map and the chosen field survive a visit to About. */}
      <div hidden={page === 'about'}>
        <p>{t(lang, 'app.tagline')}</p>
        <MapView point={point} onPick={onPick} lang={lang} />
        <div className="locate">
          <button onClick={locateMe} disabled={!grid || locate === 'busy'}>
            {locate === 'busy' ? t(lang, 'map.locating') : t(lang, 'map.locate')}
          </button>
          {locate === 'failed' && <span className="muted">{t(lang, 'map.locateFailed')}</span>}
        </div>
        {status !== 'idle' && <p className={`status status-${status}`}>{t(lang, `app.${status}` as Key)}</p>}
        {cell && <Results cell={cell} lang={lang} current={current} />}
      </div>
      <p className="muted disclaimer">{t(lang, 'app.disclaimer')}</p>
    </main>
  );
}
