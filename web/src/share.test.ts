import { describe, expect, it } from 'vitest';
import { decodeShare, encodeShare } from './share';

describe('share link', () => {
  it('round-trips a field, its settings and the language', () => {
    const hash = encodeShare({
      lat: 16.4321, lon: 102.8345, lang: 'th',
      settings: { sow: '12-01', soil: 'sandyLoam', position: 'upland', waterings: 2 },
    });
    expect(hash.startsWith('#')).toBe(true);
    expect(decodeShare(hash)).toEqual({
      lat: 16.432, lon: 102.835, lang: 'th',
      settings: { sow: '12-01', soil: 'sandyLoam', position: 'upland', waterings: 2 },
    });
  });

  it('returns null without a usable location', () => {
    expect(decodeShare('')).toBeNull();
    expect(decodeShare('#lat=abc&lon=100')).toBeNull();
    expect(decodeShare('#lat=95&lon=100')).toBeNull();
    expect(decodeShare('#lon=100')).toBeNull();
  });

  it('drops settings that are not one of the choices on screen', () => {
    const got = decodeShare('#lat=16&lon=103&sow=13-40&soil=clay&pos=hill&water=5&lang=fr');
    expect(got).toEqual({ lat: 16, lon: 103, lang: undefined, settings: {} });
  });

  it('keeps the link short by leaving out default settings', () => {
    const hash = encodeShare({
      lat: 16, lon: 103, lang: 'en',
      settings: { sow: '11-15', soil: 'loamySand', position: 'lowland', waterings: 0 },
    });
    expect(hash).toBe('#lat=16&lon=103');
  });
});
