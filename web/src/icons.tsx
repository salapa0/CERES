/** Small line icons (24 px grid, currentColor), drawn for CERES in the same style as Cloof's. */
type P = { size?: number };
const svg = (size: number) => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2,
  strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true,
});

/** CERES mark: a sprout over two furrows, white on ink, like Cloof's app icon. */
export function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 40 40" aria-hidden="true">
      <rect width="40" height="40" rx="11" fill="#24407A" />
      <path d="M20 29V18" stroke="#F8FAF5" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M20 19c0-4.5-3.2-7.4-8-7.4 0 4.6 3.2 7.4 8 7.4Z" fill="#7FD3A4" />
      <path d="M20 22c0-4.6 3.3-7.6 8.2-7.6 0 4.7-3.3 7.6-8.2 7.6Z" fill="#F8FAF5" />
      <path d="M10 31.5h20M13 35h14" stroke="#F8FAF5" strokeWidth="2" strokeLinecap="round" opacity=".45" />
    </svg>
  );
}

export const IconLocate = ({ size = 18 }: P) => (
  <svg {...svg(size)}><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2.5" fill="currentColor" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></svg>
);
export const IconPin = ({ size = 16 }: P) => (
  <svg {...svg(size)}><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.5" /></svg>
);
export const IconLeaf = ({ size = 16 }: P) => (
  <svg {...svg(size)}><path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15" /><path d="M5 19c3-4 6-7 10-9" /></svg>
);
export const IconHistory = ({ size = 18 }: P) => (
  <svg {...svg(size)}><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v4h4" /><path d="M12 7.5V12l3 2" /></svg>
);
export const IconClose = ({ size = 16 }: P) => (
  <svg {...svg(size)}><path d="M6 6l12 12M18 6 6 18" /></svg>
);
export const IconBack = ({ size = 18 }: P) => (
  <svg {...svg(size)}><path d="M15 6l-6 6 6 6" /></svg>
);

/** Rice stubble after the harvest, with a green row of the next crop. Decorative only. */
export function FieldsArt() {
  return (
    <svg className="sky-art" viewBox="0 0 1000 120" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 78C180 58 330 70 520 60s320-24 480-10v72H0Z" fill="#E6D7A8" opacity=".8" />
      <path d="M0 96c210-20 420-14 620-24s260-8 380-2v50H0Z" fill="#D6BF7E" opacity=".85" />
      <path d="M0 108c240-10 520-8 1000-14v26H0Z" fill="#9CC48A" />
    </svg>
  );
}
