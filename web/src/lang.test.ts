import { pickLang } from './lang';

test('a language in the share link wins over everything', () => {
  expect(pickLang({ link: 'en', saved: 'th', browser: ['th-TH'] })).toBe('en');
});

test('a saved choice wins over the browser', () => {
  expect(pickLang({ saved: 'en', browser: ['th-TH'] })).toBe('en');
});

test('a Thai phone opens in Thai, anything else in English', () => {
  expect(pickLang({ browser: ['th-TH', 'en-US'] })).toBe('th');
  expect(pickLang({ browser: ['en-GB', 'th'] })).toBe('th');
  expect(pickLang({ browser: ['en-US'] })).toBe('en');
  expect(pickLang({ browser: [] })).toBe('en');
});

test('junk in storage is ignored', () => {
  expect(pickLang({ saved: 'fr', browser: ['th'] })).toBe('th');
});
