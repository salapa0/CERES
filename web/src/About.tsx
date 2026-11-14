import { t, type Key, type Lang } from './i18n';

/** About page (blueprint §11.5): how it works, data, limits, soil effects, AI use, credits. */
export function About({ lang, onBack }: { lang: Lang; onBack: () => void }) {
  const T = (key: Key) => t(lang, key);
  return (
    <article className="about" data-testid="about">
      <button onClick={onBack}>← {T('app.back')}</button>
      <h2>{T('about.title')}</h2>

      <h3>{T('about.how.h')}</h3>
      <ol>
        <li>{T('about.how.1')}</li>
        <li>{T('about.how.2')}</li>
        <li>{T('about.how.3')}</li>
        <li>{T('about.how.4')}</li>
      </ol>

      <h3>{T('about.data.h')}</h3>
      <p>{T('about.data.body')}</p>
      <p className="muted">
        <a href="https://power.larc.nasa.gov/" target="_blank" rel="noopener">NASA POWER</a> ·{' '}
        <a href="https://www.fao.org/4/x0490e/x0490e00.htm" target="_blank" rel="noopener">FAO-56</a> ·{' '}
        <a href="https://s2maps.eu" target="_blank" rel="noopener">Sentinel-2 cloudless</a>
      </p>

      <h3>{T('about.limits.h')}</h3>
      <ul>
        <li>{T('about.limits.1')}</li>
        <li>{T('about.limits.2')}</li>
        <li>{T('about.limits.3')}</li>
        <li>{T('about.limits.4')}</li>
        <li>{T('about.limits.5')}</li>
      </ul>

      <h3>{T('about.soil.h')}</h3>
      <dl>
        <dt>{T('effect.nitrogen')}</dt><dd>{T('about.soil.nitrogen')}</dd>
        <dt>{T('effect.organic')}</dt>
        <dd>
          {T('about.soil.organic')}{' '}
          (<a href="https://www.ldd.go.th/" target="_blank" rel="noopener">{lang === 'th' ? 'กรมพัฒนาที่ดิน' : 'Land Development Department'}</a>)
        </dd>
        <dt>{T('effect.uses')}</dt><dd>{T('about.soil.uses')}</dd>
        <dt>{T('effect.bare')}</dt><dd>{T('about.soil.bare')}</dd>
      </dl>

      <h3>{T('about.ai.h')}</h3>
      <p>{T('about.ai.body')}</p>

      <h3>{T('about.credits.h')}</h3>
      <p>{T('about.credits.body')}</p>
    </article>
  );
}
