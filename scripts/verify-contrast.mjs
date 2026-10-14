import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';

// Check token pairs directly when a browser is unavailable. This does not claim
// to replace layout inspection, browser accessibility testing, or a full audit.
const css = await readFile('src/styles/tokens.css', 'utf8');
const tokens = Object.fromEntries([...css.matchAll(/--(color-[\w-]+): oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)/g)].map(match => [match[1], match.slice(2).map(Number)]));
function linearRGB(name) {
  const [lightness, chroma, hue] = tokens[name];
  const a = chroma * Math.cos(hue * Math.PI / 180), b = chroma * Math.sin(hue * Math.PI / 180);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  const rgb = [4.0767416621*l - 3.3077115913*m + 0.2309699292*s, -1.2684380046*l + 2.6097574011*m - 0.3413193965*s, -0.0041960863*l - 0.7034186147*m + 1.7076147010*s].map(value => Math.max(0, Math.min(1, value)));
  return rgb;
}
function rgbLuminance(rgb) { return rgb[0]*0.2126 + rgb[1]*0.7152 + rgb[2]*0.0722; }
function luminance(name) { return rgbLuminance(linearRGB(name)); }
const pairs = [
  ['color-on-dark', 'color-hero'], ['color-on-dark-muted', 'color-hero'],
  ['color-gold', 'color-hero'], ['color-dark', 'color-gold'],
  ['color-gold', 'color-dark'], ['color-gold', 'color-dark-surface'],
  ['color-ink', 'color-bg'], ['color-ink', 'color-surface'], ['color-ink', 'color-soft'],
  ['color-muted', 'color-bg'], ['color-muted', 'color-surface'],
  ['color-muted', 'color-soft'], ['color-bg', 'color-primary'], ['color-bg', 'color-primary-hover'],
  ['color-primary', 'color-bg'], ['color-primary', 'color-primary-soft'],
  ['color-primary', 'color-surface'], ['color-primary', 'color-soft'],
  ['color-primary-hover', 'color-bg'], ['color-primary-hover', 'color-surface'],
  ['color-primary-hover', 'color-soft'], ['color-primary-hover', 'color-primary-soft'],
  ['color-on-dark', 'color-dark'], ['color-on-dark-muted', 'color-dark'],
  ['color-on-dark', 'color-dark-surface'], ['color-on-dark-muted', 'color-dark-surface'],
  ['color-accent', 'color-dark-surface'],
  ['color-success', 'color-success-surface'], ['color-error', 'color-bg'], ['color-error', 'color-surface'],
];
const result = pairs.map(([foreground, background]) => {
  const a = luminance(foreground), b = luminance(background);
  const ratio = (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);
  assert(ratio >= 4.5, `${foreground} on ${background}: ${ratio} is below WCAG AA`);
  return { foreground, background, ratio: Number(ratio.toFixed(2)) };
});
const uiPairs = [
  ['color-input-border', 'color-bg'], ['color-input-border', 'color-surface'],
  ['color-dark-border', 'color-dark'], ['color-dark-border', 'color-dark-surface'], ['color-primary', 'color-bg'],
  ['color-error', 'color-bg'], ['color-accent', 'color-dark'],
].map(([foreground, background]) => {
  const a = luminance(foreground), b = luminance(background);
  const ratio = (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);
  assert(ratio >= 3, `${foreground} UI boundary on ${background}: ${ratio} is below 3:1`);
  return { foreground, background, ratio: Number(ratio.toFixed(2)) };
});
await writeFile('review/contrast.json', JSON.stringify({ status: 'passed', method: 'OKLCH tokens converted to linear sRGB; WCAG relative luminance. All declared text/state pairings plus essential UI boundaries; no browser/layout audit.', pairs: result, uiPairs }, null, 2));
console.log(`Contrast checks passed: ${result.length} text token pairs meet 4.5:1; minimum ${Math.min(...result.map(pair => pair.ratio))}:1.`);
console.log(`UI contrast checks passed: ${uiPairs.length} boundaries/focus indicators meet 3:1; minimum ${Math.min(...uiPairs.map(pair => pair.ratio))}:1.`);
