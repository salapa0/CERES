import { EN, TH } from './i18n';
import { loadCrops } from './engine';

const keys = Object.keys(TH) as (keyof typeof TH)[];

// Strings whose numbers differ on purpose: the Thai text writes years in the Buddhist Era (CE + 543).
const BUDDHIST_ERA_KEYS = new Set<string>(['about.how.2', 'about.data.body', 'smap.how']);

// Names that stay in Latin letters in Thai text: data sets, products, people and the challenge name.
const LATIN_IN_THAI = new Set([
  'NASA', 'POWER', 'GLDAS', 'SMAP', 'IMERG', 'GPM', 'MERRA', 'FAO', 'PRECTOTCORR', 'GWETROOT', 'Allen', 'Sentinel', 'cloudless',
  'EOX', 'CC', 'BY', 'AI', 'Claude', 'Anthropic', 'DEMETER', 'Space', 'Apps', 'Challenge', 'Field', 'Shift', 'GPS', 'https',
]);

const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort();
const numbers = (text: string) => (text.replace(/\{\w+\}/g, '').match(/\d+(?:\.\d+)?/g) ?? []).sort();

test('English and Thai define exactly the same keys', () => {
  expect(Object.keys(EN).sort()).toEqual([...keys].sort());
});

test('no string is empty', () => {
  for (const k of keys) {
    expect(TH[k].trim(), `TH ${k}`).not.toBe('');
    expect(EN[k].trim(), `EN ${k}`).not.toBe('');
  }
});

test('both languages use the same {placeholders} in every string', () => {
  for (const k of keys) expect(placeholders(TH[k]), k).toEqual(placeholders(EN[k]));
});

test('both languages state the same numbers (Buddhist-Era years excepted)', () => {
  for (const k of keys) {
    if (BUDDHIST_ERA_KEYS.has(k)) continue;
    expect(numbers(TH[k]), k).toEqual(numbers(EN[k]));
  }
});

test('Buddhist-Era strings: every Thai year is the English year + 543', () => {
  for (const k of BUDDHIST_ERA_KEYS) {
    const en = (EN[k as keyof typeof EN].match(/\b(?:19|20)\d{2}\b/g) ?? []).map((y) => Number(y) + 543).sort();
    const th = (TH[k as keyof typeof TH].match(/\b25\d{2}\b/g) ?? []).map(Number).sort();
    // A season such as 2001/02 prints its second year as two digits, so compare the leading years only.
    expect(th.slice(0, en.length), k).toEqual(en.filter((y) => th.includes(y)).slice(0, th.length));
  }
});

test('English text has no Thai letters; Thai text has no stray English words', () => {
  for (const k of keys) {
    // The baht sign (U+0E3F) sits in the Thai block but is a currency symbol, so it is allowed in English text.
    expect(EN[k].replace(/฿/g, ''), `EN ${k}`).not.toMatch(/[฀-๿]/);
    const words = TH[k].replace(/\{\w+\}/g, '').match(/[A-Za-z]{2,}/g) ?? [];
    for (const w of words) expect(LATIN_IN_THAI.has(w), `TH ${k}: "${w}"`).toBe(true);
  }
});

test('every crop has both a Thai and an English name, with no mixed scripts', () => {
  for (const c of loadCrops()) {
    expect(c.nameTh, c.id).toMatch(/^[฀-๿]+$/);
    expect(c.nameEn, c.id).toMatch(/^[A-Za-z][A-Za-z -]+$/);
  }
});
