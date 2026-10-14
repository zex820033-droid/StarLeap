import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { site } from '../src/content/site.ts';

const spec = await readFile('WEBSITE-SPEC.md', 'utf8');
const banned = spec.match(/^- \*\*禁用词\*\*.*?：(.+)$/m)?.[1].split(/[、；]/).map(word => word.trim());
assert(banned?.length, 'Cannot read the restricted copy list from WEBSITE-SPEC.md');
const files = [];
// Encoded image bytes are not visible copy or CSS and can coincidentally contain words.
const withoutImagePayloads = content => content.replace(/data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+/gi, 'data:image/embedded');
async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await collect(path);
    else if (/\.(html|js|css|svg|txt|xml|astro|mdx|ts)$/.test(entry.name)) files.push(path);
  }
}
await collect('dist');
await collect('src');
await collect('public');
for (const path of files) {
  const content = withoutImagePayloads(await readFile(path, 'utf8'));
  for (const word of banned) assert(!content.includes(word), `Restricted copy found in ${path}: ${word}`);
}
// Solid-surface invariant: check source and emitted styles/markup, including tokens.
const visualFiles = files.filter(path => /\.(css|astro|mdx|html|svg)$/.test(path));
for (const path of visualFiles) {
  const content = withoutImagePayloads(await readFile(path, 'utf8'));
  assert(!/(?:backdrop-filter|\bblur\s*\(|glass|frosted|translucent)/i.test(content), `Disallowed surface effect in ${path}`);
  if (path.endsWith('.css')) {
    assert(!/background(?:-color)?\s*:[^;}]*(?:transparent|rgba\(|\/\s*0?\.)/i.test(content), `Non-opaque background in ${path}`);
    for (const match of content.matchAll(/--color-[\w-]+\s*:\s*([^;]+)/g)) {
      assert(!/(?:rgba\(|\/\s*0?\.)/i.test(match[1]), `Non-opaque color token in ${path}`);
    }
  }
}
const html = await readFile('dist/index.html', 'utf8');
const headings = [...html.matchAll(/<section\b[^>]*aria-labelledby="([^"]+)"/g)].map(match => match[1]);
assert.deepEqual(headings, ['hero-heading', 'pain-heading', 'how-heading', 'demo-heading', 'general-heading', 'customer-heading', 'docs-heading', 'writeback-heading', 'privacy-heading', 'trust-heading', 'audience-heading', 'lead-heading']);
assert.equal(site.hero.headline, spec.match(/大标题：(.+)/)?.[1].trim());
assert.equal(site.hero.subtitle, spec.match(/副标题：(.+)/)?.[1].trim());
assert.equal(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)?.[1].replace(/<[^>]*>/g, '').trim(), site.hero.headline);
assert(html.includes(site.hero.subtitle));
assert(!html.includes('class="video-placeholder"'), 'Unfinished video placeholder must stay off the homepage');
// Canonical keeps the published origin; every other resource must stay local.
const withoutOriginMeta = html.replace(/<link rel="canonical"[^>]*>/g, '');
assert(!/\b(?:src|href)="https?:\/\//.test(withoutOriginMeta), 'Unexpected external page resource or link');
const schema = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1] ?? 'null');
assert.deepEqual(schema['@graph'].map(entity => entity['@type']), ['SoftwareApplication', 'FAQPage', 'Organization']);
assert.deepEqual(schema['@graph'][1].mainEntity.map(question => question.name), site.faq.items.map(item => item.question));
const robots = await readFile('dist/robots.txt', 'utf8');
for (const bot of ['GPTBot', 'ClaudeBot', 'PerplexityBot']) assert(robots.includes(`User-agent: ${bot}\nAllow: /`));
for (const file of ['sitemap-index.xml', 'sitemap-0.xml']) await readFile(`dist/${file}`);
console.log(`Static checks passed: ${banned.length} restricted phrases checked, 0 matches; section order, exact Hero copy, schema, local resources, robots and sitemaps verified.`);

console.log(`Solid-surface checks passed: ${visualFiles.length} source/built markup and stylesheet files; 0 disallowed effects or translucent backgrounds.`);
