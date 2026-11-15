import app from './App.tsx?raw';
import html from '../index.html?raw';
import lang from './lang.ts?raw';
import viteConfig from '../vite.config.ts?raw';
import { t } from './i18n';

test('the brand is CERES', () => {
  expect(t('en', 'about.credits.body')).toMatch(/^Team CERES,/);
  expect(t('th', 'about.credits.body')).toMatch(/^ทีม CERES /);
  expect(html).toContain('<title>CERES Field Time Machine</title>');
  expect(app).toContain('<strong>CERES</strong>');
  expect(lang).toContain("'ceres.lang'");
});

// Pages serves the site under the repo's name, so the base must match it: when the two differed, the page went blank.
test('the site lives at the repo path /ceres/', () => {
  expect(viteConfig).toContain("base: '/ceres/'");
});
