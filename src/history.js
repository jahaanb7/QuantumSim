import { media } from './media.js';

// Native anchors keep the timeline usable without the optional motion library.
export function mountHistory(lessons, preference) {
  const nav = document.querySelector('#timeline-nav');
  const root = document.querySelector('#history-stories');
  nav.innerHTML = lessons.map((lesson, i) => `<a href="#history-${i}" ${i === 0 ? 'aria-current="step"' : ''}>${lesson.date}</a>`).join('');
  root.innerHTML = lessons.map((lesson, i) => {
    const portrait = media[i];
    const experiment = i === 1 ? `<figure class="history-experiment"><img src="assets/history/8.jpg" width="1712" height="1220" loading="lazy" alt="Comparison of single-slit diffraction and double-slit interference patterns"><figcaption>A modern demonstration of single- and double-slit patterns, not Young’s original apparatus. Patrick Edwin Moran (2007). <a href="${media[8].source}" target="_blank" rel="noopener">Original image</a> · <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noopener">CC BY-SA 3.0</a>. Unmodified.</figcaption></figure>` : '';
    return `<article class="history-entry" id="history-${i}" aria-labelledby="history-title-${i}"><p class="history-year">${lesson.date}</p><div class="history-entry-grid"><div class="history-copy"><h3 id="history-title-${i}">${lesson.title}</h3><h4>${lesson.who}</h4><p>${lesson.body}</p><p class="history-evidence">${lesson.evidence}</p><p>${lesson.connection}</p></div><figure class="history-portrait"><img src="assets/history/${i}.jpg" width="${portrait.width}" height="${portrait.height}" loading="lazy" alt="${portrait.person}"><figcaption>${portrait.person}<br>${portrait.credit}. <a href="${portrait.source}" target="_blank" rel="noopener">Source & public-domain details</a></figcaption></figure></div>${experiment}</article>`;
  }).join('');
  const entries = [...root.querySelectorAll('.history-entry')];
  let frame = 0;
  let lastCurrent = -1;
  function update() {
    frame = 0;
    const anchor = innerHeight * .36;
    let current = 0;
    entries.forEach((entry, i) => { if (entry.getBoundingClientRect().top <= anchor) current = i; });
    if (current !== lastCurrent && nav.scrollWidth > nav.clientWidth) {
      const link = nav.children[current];
      nav.scrollTo({ left: link.offsetLeft - nav.offsetLeft - (nav.clientWidth - link.offsetWidth) / 2, behavior: preference.matches ? 'instant' : 'smooth' });
    }
    lastCurrent = current;
    entries.forEach((entry, i) => {
      entry.classList.toggle('is-current', i === current);
      if (i === current) nav.children[i].setAttribute('aria-current', 'step');
      else nav.children[i].removeAttribute('aria-current');
    });
  }
  const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  update();
  if (/^#history-[0-7]$/.test(location.hash)) requestAnimationFrame(() => document.querySelector(location.hash)?.scrollIntoView({ behavior: 'instant', block: 'start' }));
  const cleanups = [];
  if (!preference.matches && window.Motion?.inView) {
    cleanups.push(window.Motion.inView(entries, element => {
      const animation = window.Motion.animate(element, { opacity: [0.65, 1], transform: ['translateY(24px)', 'translateY(0px)'] }, { duration: .65, ease: [0.22, 1, 0.36, 1] });
      cleanups.push(() => animation.stop());
    }, { margin: '0px 0px -5% 0px' }));
  }
  const stopMotion = () => { if (preference.matches) { cleanups.splice(0).forEach(stop => stop()); entries.forEach(entry => { entry.style.opacity = '1'; entry.style.transform = 'none'; }); } };
  preference.addEventListener('change', stopMotion);
  return () => { cleanups.forEach(stop => stop()); preference.removeEventListener('change', stopMotion); window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); cancelAnimationFrame(frame); };
}
