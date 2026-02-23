(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const intro = $("#intro");
  const hub = $("#hub");
  const end = $("#end");

  const sections = [intro, hub, end].filter(Boolean);

  const footer = $("#siteFooter");

  const accordion = $("#accordion");
  const items = accordion ? $$(".accItem", accordion) : [];

  const btnCollapseAll = $("#btnCollapseAll");

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // 1 wheel = 1 sekce (designerský dojem)
  const LOCK_MS = prefersReduced ? 0 : 850;
  let lockUntil = 0;

  function now() { return Date.now(); }
  function locked() { return now() < lockUntil; }
  function lock() { lockUntil = now() + LOCK_MS; }

  function scrollToEl(el) {
    if (!el) return;
    el.scrollIntoView({ behavior: prefersReduced ? "auto" : "smooth", block: "start" });
    lock();

    // když míříme na konec, patička má "vyjet hned" (ne čekat na IO threshold)
    if (el === end) {
      setTimeout(() => footer?.classList.add("is-visible"), prefersReduced ? 0 : 120);
    }
  }

  function jumpTo(selector) {
    const el = $(selector);
    if (el) scrollToEl(el);
  }

  /* ---------------------------------
     Jump links
  --------------------------------- */
  function setupJumpLinks() {
    $$('[data-jump]').forEach((el) => {
      el.addEventListener('click', (e) => {
        const target = el.getAttribute('data-jump');
        if (!target) return;
        e.preventDefault();
        jumpTo(target);
      });

      el.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const target = el.getAttribute('data-jump');
        if (!target) return;
        e.preventDefault();
        jumpTo(target);
      });
    });
  }

  /* ---------------------------------
     Section detection
  --------------------------------- */
  function visibleRatio(el) {
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight || 1;
    const visible = Math.min(vh, r.bottom) - Math.max(0, r.top);
    return Math.max(0, visible) / Math.max(1, r.height);
  }

  function currentSectionIndex() {
    let best = 0;
    let bestScore = -1;
    for (let i = 0; i < sections.length; i++) {
      const s = sections[i];
      const score = visibleRatio(s);
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    }
    return best;
  }

  /* ---------------------------------
     Allow scroll INSIDE scrollable blocks
     (kdyby sis dal do accordionu dlouhý text)
  --------------------------------- */
  function findScrollable(startEl) {
    let el = startEl;
    while (el && el !== document.body) {
      const cs = window.getComputedStyle(el);
      const oy = cs.overflowY;
      const isScrollable = (oy === 'auto' || oy === 'scroll') && (el.scrollHeight > el.clientHeight + 2);
      if (isScrollable) return el;
      el = el.parentElement;
    }
    return null;
  }

  function shouldLetScrollInside(target, deltaY) {
    const sc = findScrollable(target);
    if (!sc) return false;
    if (deltaY > 0) return sc.scrollTop + sc.clientHeight < sc.scrollHeight - 2;
    if (deltaY < 0) return sc.scrollTop > 1;
    return false;
  }

  /* ---------------------------------
     Wheel snap assist (robust)
  --------------------------------- */
  function setupWheelSnap() {
    window.addEventListener('wheel', (e) => {
      const dy = e.deltaY;

      // ignoruj mikro-pohyb trackpadu
      if (Math.abs(dy) < 6) return;

      // když už probíhá animace, sežer wheel
      if (locked()) {
        e.preventDefault();
        return;
      }

      // když user scrolluje uvnitř scrollovatelného bloku (např. dlouhý detail), nech ho
      if (shouldLetScrollInside(e.target, dy)) return;

      const idx = currentSectionIndex();
      const next = sections[idx + 1] || null;
      const prev = sections[idx - 1] || null;

      // 1 scroll = 1 sekce
      if (dy > 0 && next) {
        e.preventDefault();
        scrollToEl(next);
        return;
      }
      if (dy < 0 && prev) {
        e.preventDefault();
        scrollToEl(prev);
        return;
      }
    }, { passive: false });
  }

  /* ---------------------------------
     Touch snap (mobil)
  --------------------------------- */
  function setupTouchSnap() {
    let startY = null;

    window.addEventListener('touchstart', (e) => {
      startY = e.touches?.[0]?.clientY ?? null;
    }, { passive: true });

    window.addEventListener('touchend', (e) => {
      if (startY == null) return;
      if (locked()) return;

      const endY = e.changedTouches?.[0]?.clientY ?? startY;
      const dy = startY - endY;
      startY = null;

      if (Math.abs(dy) < 22) return;

      const idx = currentSectionIndex();
      const next = sections[idx + 1] || null;
      const prev = sections[idx - 1] || null;

      if (dy > 0 && next) scrollToEl(next);
      if (dy < 0 && prev) scrollToEl(prev);
    }, { passive: true });
  }

  /* ---------------------------------
     Accordion (3 bloky pod sebou)
  --------------------------------- */
  function updateCollapseBtn() {
    if (!btnCollapseAll) return;
    const anyOpen = items.some(i => i.classList.contains('is-open'));
    btnCollapseAll.disabled = !anyOpen;
  }

  function fillContent(item) {
    const section = item.dataset.section;
    const slot = $('[data-slot="content"]', item);
    if (!slot || slot.dataset.filled === '1') return;

    const tpl = document.getElementById(`tpl-${section}`);
    if (tpl?.content) {
      slot.appendChild(tpl.content.cloneNode(true));
      slot.dataset.filled = '1';
    }
  }

  function openItem(item) {
    if (!item) return;

    // close others (accordion)
    items.forEach((it) => {
      if (it !== item) closeItem(it);
    });

    fillContent(item);

    const head = $('.accHead', item);
    const body = $('.accBody', item);
    if (!head || !body) return;

    item.classList.add('is-open');
    head.setAttribute('aria-expanded', 'true');
    body.setAttribute('aria-hidden', 'false');

    // max-height animace
    body.style.maxHeight = '0px';
    // force reflow
    body.offsetHeight;
    body.style.maxHeight = body.scrollHeight + 'px';

    // po rozbalení nastav maxHeight na 'none' (ať to není useknuté, když něco změníš)
    const onEnd = (ev) => {
      if (ev.propertyName !== 'max-height') return;
      if (!item.classList.contains('is-open')) return;
      body.style.maxHeight = 'none';
      body.removeEventListener('transitionend', onEnd);
    };
    body.addEventListener('transitionend', onEnd);

    updateCollapseBtn();
  }

  function closeItem(item) {
    if (!item || !item.classList.contains('is-open')) return;

    const head = $('.accHead', item);
    const body = $('.accBody', item);
    if (!head || !body) return;

    // když je maxHeight none, přepočítej na konkrétní px
    body.style.maxHeight = body.scrollHeight + 'px';
    body.offsetHeight;

    item.classList.remove('is-open');
    head.setAttribute('aria-expanded', 'false');
    body.setAttribute('aria-hidden', 'true');
    body.style.maxHeight = '0px';

    updateCollapseBtn();
  }

  function collapseAll() {
    items.forEach(closeItem);
    updateCollapseBtn();
  }

  function setupAccordion() {
    if (!accordion) return;

    items.forEach((item) => {
      const head = $('.accHead', item);
      if (!head) return;

      head.addEventListener('click', () => {
        const isOpen = item.classList.contains('is-open');
        if (isOpen) closeItem(item);
        else openItem(item);
      });
    });

    btnCollapseAll?.addEventListener('click', collapseAll);

    // hash deep link
    const h = (location.hash || '').replace('#', '');
    if ([ 'about', 'teaching', 'projects' ].includes(h)) {
      scrollToEl(hub);
      setTimeout(() => {
        const targetItem = items.find(i => i.dataset.section === h);
        if (targetItem) openItem(targetItem);
      }, prefersReduced ? 0 : 180);
    }

    // ESC sbalí
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') collapseAll();
    });

    updateCollapseBtn();
  }

  /* ---------------------------------
     Footer reveal (vyjede hned)
  --------------------------------- */
  function setupFooterReveal() {
    if (!footer) return;

    const show = () => footer.classList.add('is-visible');

    // hned při startu, pokud už je na obrazovce
    if (visibleRatio(end) > 0.05) show();

    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) show();
      });
    }, {
      threshold: 0.01,
      // trigger dřív než je footer "napůl"
      rootMargin: '0px 0px -30% 0px'
    });

    io.observe(footer);
  }

  /* init */
  setupJumpLinks();
  setupAccordion();
  setupWheelSnap();
  setupTouchSnap();
  setupFooterReveal();
})();