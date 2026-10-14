const viewer = document.querySelector<HTMLDialogElement>('.image-viewer');
if (viewer && typeof viewer.showModal === 'function') {
  const image = viewer.querySelector<HTMLImageElement>('.viewer-image')!;
  const title = viewer.querySelector<HTMLElement>('#viewer-title')!;
  const zoom = viewer.querySelector<HTMLButtonElement>('[data-viewer-zoom]')!;
  const original = viewer.querySelector<HTMLAnchorElement>('[data-viewer-original]')!;
  const canvas = viewer.querySelector<HTMLElement>('.viewer-canvas')!;
  const status = viewer.querySelector<HTMLElement>('.viewer-status')!;
  let source: HTMLAnchorElement | null = null;
  function fit() {
    viewer!.removeAttribute('data-zoomed');
    zoom.setAttribute('aria-pressed', 'false');
    zoom.textContent = zoom.dataset.zoom!;
    canvas.scrollTo(0, 0);
  }
  document.addEventListener('click', event => {
    if (!(event.target instanceof Element) || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
    const link = event.target.closest<HTMLAnchorElement>('a[data-image-preview]');
    if (!link) return;
    event.preventDefault();
    source = link;
    const figure = link.closest('figure');
    const thumbnail = figure?.querySelector('img');
    title.textContent = link.dataset.imagePreview || figure?.querySelector('figcaption span, .art-caption')?.textContent || thumbnail?.alt || '';
    image.alt = thumbnail?.alt || title.textContent;
    original.href = link.href;
    status.textContent = status.dataset.loading!;
    image.onload = () => { status.textContent = ''; };
    image.onerror = () => { status.textContent = status.dataset.error!; image.removeAttribute('src'); };
    image.src = link.href;
    fit();
    viewer.showModal();
    document.documentElement.setAttribute('data-image-viewer-open', '');
  });
  zoom.addEventListener('click', () => {
    const expanded = viewer.toggleAttribute('data-zoomed');
    zoom.setAttribute('aria-pressed', String(expanded));
    zoom.textContent = expanded ? zoom.dataset.fit! : zoom.dataset.zoom!;
    canvas.scrollTo(0, 0);
  });
  viewer.querySelector('[data-viewer-close]')!.addEventListener('click', () => viewer.close());
  viewer.addEventListener('click', event => { if (event.target === viewer) viewer.close(); });
  viewer.addEventListener('close', () => {
    document.documentElement.removeAttribute('data-image-viewer-open');
    source?.focus({ preventScroll: true });
  });
}
