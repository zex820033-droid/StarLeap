import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { site } from '../src/content/site.ts';

// Reuse an existing Playwright installation and browser; never download one here.
// Set PLAYWRIGHT_MODULE and CHROMIUM_PATH if they are not installed in this project.
const review = resolve('review');
await mkdir(resolve(review, 'browser-tmp'), { recursive: true });
process.env.TMPDIR = resolve(review, 'browser-tmp');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.REVIEW_ORIGIN || 'http://127.0.0.1:4321';
const externalRequests = [];
const pageErrors = [];
const failedResponses = [];
const context = await chromium.launchPersistentContext(resolve(review, 'browser-profile'), {
  executablePath: process.env.CHROMIUM_PATH,
  headless: true,
  viewport: { width: 1440, height: 900 },
  locale: site.locale,
  reducedMotion: 'reduce',
  serviceWorkers: 'block',
  args: ['--disable-background-networking', '--disable-component-update', '--disable-domain-reliability', '--disable-crash-reporter', '--disable-breakpad'],
});
const browserVersion = context.browser()?.version();
await context.route('**/*', async route => {
  const url = route.request().url();
  if (url.startsWith(`${origin}/`)) await route.continue();
  else {
    externalRequests.push(url);
    await route.abort();
  }
});
const page = await context.newPage();
page.on('pageerror', error => pageErrors.push(error.message));
page.on('response', response => { if (response.status() >= 400) failedResponses.push({ url: response.url(), status: response.status() }); });
const layout = [];
let result;
try {
  await page.goto(origin, { waitUntil: 'networkidle' });
  await page.locator('button[type="submit"]').waitFor({ state: 'visible' });
  assert.equal(await page.locator('h1').textContent(), site.hero.headline);
  assert.equal(await page.locator('.hero-subtitle').textContent(), site.hero.subtitle);
  assert.equal(await page.locator('h1').count(), 1);
  assert.equal(await page.locator('main section[aria-labelledby]').count(), 10);
  assert.equal(await page.locator('.diff-preview').count(), 1, 'MDX preview must render its styled HTML');
  assert(await page.locator('.video-placeholder').textContent().then(text => text.includes(site.demo.videoTitle)));

  for (const image of await page.locator('img').all()) {
    await image.scrollIntoViewIfNeeded();
    await image.evaluate(element => element.decode());
  }
  await page.evaluate(() => scrollTo(0, 0));
  const imagesLoaded = await page.locator('img').evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0));
  assert(imagesLoaded, 'Product images should load');
  for (const width of [1440, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    const metrics = await page.evaluate(() => ({
      viewport: innerWidth, document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
      sticky: getComputedStyle(document.querySelector('header')).position,
      reducedMotion: getComputedStyle(document.documentElement).scrollBehavior,
    }));
    assert(metrics.document <= width && metrics.body <= width, `Horizontal overflow at ${width}px`);
    assert.equal(metrics.sticky, 'sticky');
    assert.equal(metrics.reducedMotion, 'auto');
    layout.push(metrics);
    if ([1440, 1024, 390].includes(width)) {
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: resolve(review, `${width === 1440 ? 'desktop' : width === 1024 ? 'tablet' : 'mobile'}-${width}.png`), fullPage: true });
      await page.screenshot({ path: resolve(review, `hero-${width}.png`) });
    }
    const targets = await page.locator('.nav-links a, .brand, .button, input, select, summary, .citation, .footer-contact a, .text-link, .hero-evidence a').evaluateAll(elements =>
      elements.filter(element => element.getClientRects().length).map(element => ({
        text: element.textContent.trim(), height: element.getBoundingClientRect().height, width: element.getBoundingClientRect().width,
      })));
    for (const target of targets) assert(target.height >= 44 && target.width >= 44, `${width}px tap target ${target.text} is ${target.width}×${target.height}px`);
  }

  // Exercise native keyboard interactions, citation reveal, and form edge states.
  await page.locator('.citation').focus();
  await page.keyboard.press('Enter');
  assert(await page.locator('#citation-source').getAttribute('open') !== null);
  assert.equal(await page.evaluate(() => document.activeElement?.tagName), 'SUMMARY');
  const firstFaq = page.locator('.faq-list summary').first();
  await firstFaq.focus();
  await page.keyboard.press('Enter');
  assert(await page.locator('.faq-list details').first().getAttribute('open') !== null);
  await page.locator('.form-submit').click();
  assert.equal(await page.locator('#email').getAttribute('aria-invalid'), 'true');
  assert.equal(await page.locator('#email-error').textContent(), site.lead.email.invalid);
  await page.screenshot({ path: resolve(review, 'form-error-390.png') });
  await page.locator('#email').fill('invalid');
  await page.locator('.form-submit').click();
  assert.equal(await page.locator('#email').getAttribute('aria-invalid'), 'true');
  await page.locator('#email').fill('review@example.com');
  await page.locator('#occupation').fill('销售顾问');
  await page.locator('#team').selectOption('2-10');
  const submissionRequests = [];
  const panelHeight = await page.locator('.lead-panel').evaluate(element => element.getBoundingClientRect().height);
  const listener = request => submissionRequests.push({ method: request.method(), url: request.url() });
  page.on('request', listener);
  await page.locator('.form-submit').click();
  await page.locator('#lead-success').waitFor({ state: 'visible' });
  assert((await page.locator('#lead-success').textContent()).includes(site.lead.successTitle));
  assert((await page.locator('#lead-success').textContent()).includes(site.lead.successBody));
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'lead-success');
  const successHeight = await page.locator('.lead-panel').evaluate(element => element.getBoundingClientRect().height);
  assert(Math.abs(successHeight - panelHeight) < 1, 'Success must preserve the form panel height');
  await page.screenshot({ path: resolve(review, 'form-success-390.png') });
  assert.equal(submissionRequests.length, 0, 'The form must not make requests');
  page.off('request', listener);
  assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
  await page.locator('#lead-reset').click();
  assert.equal(await page.locator('#email').inputValue(), '');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'email');
  const focus = await page.locator('#email').evaluate(element => {
    const css = getComputedStyle(element);
    return { width: css.outlineWidth, style: css.outlineStyle };
  });
  assert.notEqual(focus.width, '0px');
  assert.equal(focus.style, 'solid');
  await page.screenshot({ path: resolve(review, 'form-focus-390.png') });

  // Disabled and hover states also retain readable text; no request is made.
  await page.locator('.form-submit').evaluate(button => { button.disabled = true; });
  await page.screenshot({ path: resolve(review, 'form-disabled-390.png') });
  await page.locator('.form-submit').evaluate(button => { button.disabled = false; });

  // Calculate actual browser-rendered color contrast, including OKLCH conversion.
  const contrast = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const rgb = color => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1); return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3); };
    const luminance = color => rgb(color).map(v => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }).reduce((sum, c, index) => sum + c * [0.2126, 0.7152, 0.0722][index], 0);
    const ratio = (foreground, background) => { const a = luminance(foreground), b = luminance(background); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
    const pairs = [
      ['body', 'body'], ['.hero-subtitle', '.hero'], ['.button-primary', '.button-primary'],
      ['.hero-product figcaption', '.hero-product'], ['.demo-label', '.conversation'],
      ['.formats .ocr-format', '.formats .ocr-format'], ['.diff-added', '.diff-added'],
      ['.privacy-node p', '.dark-band'], ['.stage-notice', '.stage-notice'],
      ['.field-hint', '.lead-panel'], ['.footer-bottom', 'body'],
    ];
    const values = pairs.map(([foreground, background]) => ({
      selector: foreground,
      ratio: Number(ratio(getComputedStyle(document.querySelector(foreground)).color, getComputedStyle(document.querySelector(background)).backgroundColor).toFixed(2)),
    }));
    const input = document.querySelector('#email');
    values.push({ selector: 'input::placeholder', ratio: Number(ratio(getComputedStyle(input, '::placeholder').color, getComputedStyle(input).backgroundColor).toFixed(2)) });
    return values;
  });
  for (const pair of contrast) assert(pair.ratio >= 4.5, `${pair.selector} contrast ${pair.ratio} is below AA`);
  assert.equal(externalRequests.length, 0);
  assert.equal(pageErrors.length, 0);
  assert.equal(failedResponses.length, 0);

  // Measure the initial layout shift with motion enabled, and exercise reveal.
  const motionPage = await context.newPage();
  await motionPage.emulateMedia({ reducedMotion: 'no-preference' });
  await motionPage.addInitScript(() => {
    window.__xiaoguanCLS = 0;
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__xiaoguanCLS += entry.value;
    }).observe({ type: 'layout-shift', buffered: true });
  });
  await motionPage.goto(origin, { waitUntil: 'networkidle' });
  await motionPage.evaluate(() => document.fonts.ready);
  const cls = await motionPage.evaluate(() => window.__xiaoguanCLS);
  assert(cls < 0.1, `Initial CLS ${cls} must stay below 0.1`);
  const surfaces = await motionPage.locator('.site-header, .hero, .trust-strip, .conversation, .docs-illustration, .platform-grid article, .lead-panel').evaluateAll(elements => elements.map(element => {
    const css = getComputedStyle(element);
    return { selector: element.className, background: css.backgroundColor, opacity: css.opacity, backdrop: css.backdropFilter, animation: css.animationName };
  }));
  for (const surface of surfaces) {
    assert.equal(surface.opacity, '1');
    assert.equal(surface.backdrop, 'none');
    assert.equal(surface.animation, 'none');
    assert(!surface.background.includes(' / ') && !surface.background.startsWith('rgba'), `${surface.selector} must be opaque`);
  }
  await motionPage.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await motionPage.locator('html').evaluate(element => getComputedStyle(element).scrollBehavior), 'auto');
  await motionPage.close();

  // Without JavaScript, there is no accidental native form submission.
  const noJs = await context.browser().newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const noJsPage = await noJs.newPage();
  await noJsPage.goto(origin);
  assert(await noJsPage.locator('.form-submit').isDisabled());
  assert((await noJsPage.locator('noscript').textContent()).includes(site.lead.noScript));
  await noJs.close();

  result = {
    status: 'passed', origin, browserVersion, layout, contrast, cls,
    externalRequests, pageErrors, failedResponses, submissionRequests,
    checks: ['exact Hero copy', 'section order/count', 'MDX rendering', 'real screenshots load', 'no horizontal overflow', 'sticky navigation', 'reduced motion and preference changes', 'initial CLS < 0.1', 'opaque surfaces and no continuous animation', 'keyboard citation and FAQ', 'required/invalid/valid email', 'honest success and reset', 'no submission requests or browser storage', 'visible focus', 'sampled WCAG AA text contrast', 'JavaScript-disabled form guard'],
    screenshots: ['desktop-1440.png', 'tablet-1024.png', 'mobile-390.png', 'hero-1440.png', 'hero-1024.png', 'hero-390.png', 'form-error-390.png', 'form-success-390.png', 'form-focus-390.png', 'form-disabled-390.png'],
  };
  await writeFile(resolve(review, 'verification.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally {
  await context.close();
}
