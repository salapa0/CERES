import type { Lang } from './i18n';

const KEY = 'ceres.lang';
const isLang = (x: unknown): x is Lang => x === 'th' || x === 'en';

/** Which language to open in: the share link's, then the visitor's last choice, then the phone's own language. */
export function pickLang({ link, saved, browser }: { link?: Lang; saved?: string | null; browser: readonly string[] }): Lang {
  if (link) return link;
  if (isLang(saved)) return saved;
  return browser.some((l) => l.toLowerCase().startsWith('th')) ? 'th' : 'en';
}

// Storage can be missing or throw (private windows, LINE's in-app browser); the page works without it.
export function savedLang(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function saveLang(lang: Lang): void {
  try {
    window.localStorage.setItem(KEY, lang);
  } catch {
    /* not saved; the next visit falls back to the phone's language */
  }
}

export function browserLangs(): readonly string[] {
  return typeof navigator === 'undefined' ? [] : navigator.languages?.length ? navigator.languages : [navigator.language ?? ''];
}
