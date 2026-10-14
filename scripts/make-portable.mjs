// Rewrites every root-relative asset URL in the built site into a relative URL,
// so `dist/` can be served from any path (GitHub Pages project site, a subfolder,
// or even file://) without hard-coding an origin or folder name.
//
// Runs after `astro build`, before `verify-static.mjs`.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';

const DIST = 'dist';
const BASE = (process.env.BASE_PATH ?? '').replace(/\/+$/, ''); // e.g. "/my-repo"

const toPosix = value => value.split(sep).join('/');

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

// Strips the configured `base` (when publishing under a repo subpath) and makes
// the remaining path relative to the file being rewritten.
function makeRelative(url, prefix, base) {
  if (!url.startsWith('/')) return url;
  let path = url;
  if (base && (path === base || path.startsWith(`${base}/`))) {
    path = path.slice(base.length) || '/';
  }
  return `${prefix}${path.slice(1)}`;
}

function rewriteHtml(html, prefix) {
  const attribute = /(\b(?:src|href|poster)=")(\/[^"]*)"/g;
  const srcset = /\bsrcset="([^"]*)"/g;
  const cssUrl = /url\((['"]?)(\/[^)'"]*)\1\)/g;
  return html
    .replace(attribute, (_match, lead, url) => `${lead}${makeRelative(url, prefix, BASE)}"`)
    .replace(srcset, (_match, value) => {
      const fixed = value
        .split(',')
        .map(candidate => {
          const [url, ...rest] = candidate.trim().split(/\s+/);
          return [makeRelative(url, prefix, BASE), ...rest].join(' ');
        })
        .join(', ');
      return `srcset="${fixed}"`;
    })
    .replace(cssUrl, (_match, quote, url) => `url(${quote}${makeRelative(url, prefix, BASE)}${quote})`);
}

function rewriteCss(css, prefix) {
  return css.replace(/url\((['"]?)(\/[^)'"]*)\1\)/g, (_match, quote, url) => `url(${quote}${makeRelative(url, prefix, BASE)}${quote})`);
}

let changed = 0;
let scanned = 0;
for await (const file of walk(DIST)) {
  if (!/\.(html|css)$/.test(file)) continue;
  scanned += 1;
  const depth = toPosix(relative(dirname(file), DIST));
  const prefix = depth ? `${depth}/` : '';
  const before = await readFile(file, 'utf8');
  const after = file.endsWith('.css') ? rewriteCss(before, prefix) : rewriteHtml(before, prefix);
  if (after !== before) {
    await writeFile(file, after);
    changed += 1;
  }
}

console.log(`make-portable: ${changed}/${scanned} html/css file(s) rewritten to relative asset URLs (base "${BASE || '/'}").`);
