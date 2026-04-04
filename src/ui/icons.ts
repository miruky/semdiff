// 画面で使うSVGアイコン。すべてviewBox付き・currentColor追従で、寸法はCSSで与える。
// 装飾要素はaria-hidden、意味を持つものは呼び出し側でaria-labelを補う。

export const logoMark = `
<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.2"
     stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M11 5q-4 0-4 4.5 0 3-3 3.5 3 .5 3 3.5Q7 21 11 21"/>
  <path d="M21 5q4 0 4 4.5 0 3 3 3.5-3 .5-3 3.5Q25 21 21 21"/>
  <circle cx="13" cy="13" r="1.4" fill="currentColor" stroke="none"/>
  <circle cx="19" cy="13" r="1.4" fill="currentColor" stroke="none"/>
  <path d="M11 26h10"/>
</svg>`;

export const caret = `
<svg class="branch__caret" viewBox="0 0 16 16" fill="none" stroke="currentColor"
     stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M6 4l4 4-4 4"/>
</svg>`;

export const sun = `
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
     stroke-linecap="round" aria-hidden="true">
  <circle cx="12" cy="12" r="4.2"/>
  <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5 5l1.4 1.4M17.6 17.6L19 19M19 5l-1.4 1.4M6.4 17.6L5 19"/>
</svg>`;

export const moon = `
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
     stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M20 14.5A8 8 0 1 1 9.5 4a6.3 6.3 0 0 0 10.5 10.5z"/>
</svg>`;

export const monitor = `
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
     stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <rect x="3" y="4.5" width="18" height="12" rx="1.6"/>
  <path d="M9 20h6M12 16.5V20"/>
</svg>`;
