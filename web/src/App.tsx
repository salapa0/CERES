import { useEffect, useState } from 'react';
import { cellForPoint, loadCell, loadGrid } from './data';
import type { CellData, Grid } from './engine';
import { t, type Key, type Lang } from './i18n';
import { MapView } from './MapView';
import { Results } from './Results';

type Status = 'idle' | 'loading' | 'loadingLive' | 'outside' | 'error';

export default function App() {
  const [lang, setLang] = useState<Lang>('th');
  const [grid, setGrid] = useState<Grid | null>(null);
  const [cell, setCell] = useState<CellData | null>(null);
  const [status, setStatus] = useState<Status>('idle');

  useEffect(() => {
    loadGrid().then(setGrid).catch(() => setStatus('error'));
  }, []);

  async function onPick(lat: number, lon: number) {
    if (!grid) return;
    const target = cellForPoint(grid, lat, lon);
    setCell(null);
    if (!target) return setStatus('outside');
    setStatus('loading');
    try {
      setCell(await loadCell(target, () => setStatus('loadingLive')));
      setStatus('idle');
    } catch {
      setStatus('error');
    }
  }

  return (
    <main>
      <header>
        <div>
          <h1>DEMETER</h1>
          <p className="subtitle">{t(lang, 'app.subtitle')}</p>
        </div>
        <button className="lang" onClick={() => setLang(lang === 'th' ? 'en' : 'th')}>{lang === 'th' ? 'EN' : 'ไทย'}</button>
      </header>
      <p>{t(lang, 'app.tagline')}</p>
      <MapView onPick={onPick} />
      {status !== 'idle' && <p className={`status status-${status}`}>{t(lang, `app.${status}` as Key)}</p>}
      {cell && <Results cell={cell} lang={lang} />}
      <p className="muted disclaimer">{t(lang, 'app.disclaimer')}</p>
    </main>
  );
}
