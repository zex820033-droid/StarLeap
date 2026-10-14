// Keep decorative motion asleep outside the viewport and in background tabs.
const root = document.documentElement;
const fields = document.querySelectorAll<HTMLElement>('.ambient-field');
const toggle = document.querySelector<HTMLButtonElement>('.ambient-toggle');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let paused = false;

if (toggle && 'IntersectionObserver' in window) {
  const sync = () => {
    root.toggleAttribute('data-ambient-paused', paused || document.hidden || reduced.matches);
    toggle.hidden = reduced.matches;
    toggle.setAttribute('aria-pressed', String(paused));
    toggle.textContent = (paused ? toggle.dataset.resumeLabel : toggle.dataset.pauseLabel) ?? '';
  };
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => entry.target.toggleAttribute('data-visible', entry.isIntersecting));
  });
  fields.forEach(field => observer.observe(field));
  toggle.addEventListener('click', () => { paused = !paused; sync(); });
  reduced.addEventListener('change', sync);
  document.addEventListener('visibilitychange', sync);
  sync();
  root.setAttribute('data-ambient-ready', '');
}
