import app from './App.tsx?raw';
import html from '../index.html?raw';
import viteConfig from '../vite.config.ts?raw';
import { t } from './i18n';

test('the brand is CERES', () => {
  expect(t('en', 'about.credits.body')).toMatch(/^Team CERES,/);
  expect(t('th', 'about.credits.body')).toMatch(/^ทีม CERES /);
  expect(html).toContain('<title>CERES Field Time Machine</title>');
  expect(app).toContain('<strong>CERES</strong>');
});

// The first CERES rename also moved the base to /ceres-fieldshift/ and the live page went blank: Pages serves
// the site under the repo's name, which is still demeter-fieldshift.
test('the site still lives at the repo path, whatever the brand', () => {
  expect(viteConfig).toContain("base: '/demeter-fieldshift/'");
});
