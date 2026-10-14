// CSS owns motion. Observers select the story beat and enhance older engines.
// No visibility gate, animation library, scroll interception, or page storage.
const preference = matchMedia('(prefers-reduced-motion: reduce)');
const desktop = matchMedia('(min-width: 801px) and (min-height: 720px)');
const tokens = getComputedStyle(document.documentElement);
const number = (name: string) => parseFloat(tokens.getPropertyValue(name));
let dispose = () => {};

function setup() {
  dispose();
  if (preference.matches || !('IntersectionObserver' in window)) return;
  const observers: IntersectionObserver[] = [];
  const animations = new Set<Animation>();
  const cleanups: (() => void)[] = [];
  const play = (element: HTMLElement, index = 0) => {
    if (!element.animate) return;
    const animation = element.animate([
      { opacity: 0.35, transform: `translateY(${number('--motion-rise')}px)` },
      { opacity: 1, transform: 'none' },
    ], { duration: number('--duration-enter'), delay: Math.min(index, 3) * number('--stagger-step'), easing: tokens.getPropertyValue('--ease-out').trim() });
    animations.add(animation);
    animation.onfinish = () => animations.delete(animation);
  };

  const walkthrough = document.querySelector<HTMLElement>('[data-walkthrough]');
  const visual = walkthrough?.querySelector<HTMLElement>('.walkthrough-visual');
  if (walkthrough && visual && desktop.matches) {
    const beats = [...walkthrough.querySelectorAll<HTMLElement>('[data-beat]')];
    const visible = new Set<HTMLElement>();
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const beat = entry.target as HTMLElement;
        if (entry.isIntersecting) visible.add(beat);
        else visible.delete(beat);
      }
      const current = [...visible].sort((a, b) => {
        const center = (node: HTMLElement) => {
          const rect = node.getBoundingClientRect();
          return Math.abs(rect.top + rect.height / 2 - innerHeight / 2);
        };
        return center(a) - center(b);
      })[0];
      if (current) visual.dataset.phase = current.dataset.beat;
    }, { rootMargin: '-42% 0px -42% 0px', threshold: 0 });
    beats.forEach(beat => observer.observe(beat));
    observers.push(observer);
    // CSS has already reserved the long scroll layout; this adds no geometry.
    walkthrough.setAttribute('data-walkthrough-enhanced', '');
    cleanups.push(() => {
      walkthrough.removeAttribute('data-walkthrough-enhanced');
      visual.dataset.phase = '0';
    });
  }

  // Animate only the three key statements; the rest of the page stays still.
  const emphasis = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) {
      play(entry.target as HTMLElement);
      emphasis.unobserve(entry.target);
    }
  }, { threshold: 0.25 });
  document.querySelectorAll<HTMLElement>('[data-emphasis]').forEach(element => emphasis.observe(element));
  observers.push(emphasis);
  const focus = () => { animations.forEach(animation => animation.cancel()); animations.clear(); };
  document.addEventListener('focusin', focus);
  cleanups.push(() => document.removeEventListener('focusin', focus));
  dispose = () => {
    observers.forEach(observer => observer.disconnect());
    animations.forEach(animation => animation.cancel());
    cleanups.forEach(cleanup => cleanup());
    dispose = () => {};
  };
}

setup();
preference.addEventListener('change', setup);
desktop.addEventListener('change', setup);
