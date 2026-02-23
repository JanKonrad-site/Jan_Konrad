(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Sections
  const intro = $("#intro");
  const hub = $("#hub");
  const end = $("#end");
  const endSentinel = $("#endSentinel");
  const footer = $("#siteFooter");

  // Accordion
  const accordion = $("#accordion");
  const accItems = accordion ? $$(".accItem", accordion) : [];
  const btnCollapseAll = $("#btnCollapseAll");

  // Locks for auto-scroll
  const LOCK_MS = prefersReduced ? 0 : 850;
  let lockUntil = 0;

  function now(){ return Date.now(); }
  function locked(){ return now() < lockUntil; }
  function lock(){ lockUntil = now() + LOCK_MS; }

  function scrollToEl(el){
    if (!el) return;
    el.scrollIntoView({ behavior: prefersReduced ? "auto" : "smooth", block: "start" });
    lock();
    if (el === end) {
      // footer vyjede hned
      setTimeout(() => footer?.classList.add("is-visible"), prefersReduced ? 0 : 120);
    }
  }

  function jumpTo(selector){
    const el = $(selector);
    if (el) scrollToEl(el);
  }

  // ---------------------------
  // Jump links
  // ---------------------------
  function setupJumpLinks(){
    $$("[data-jump]").forEach((el) => {
      el.addEventListener("click", (e) => {
        const t = el.getAttribute("data-jump");
        if (!t) return;
        e.preventDefault();
        jumpTo(t);
      });
      el.addEventListener("keydown", (e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        const t = el.getAttribute("data-jump");
        if (!t) return;
        e.preventDefault();
        jumpTo(t);
      });
    });
  }

  // ---------------------------
  // Reveal (section enters view)
  // ---------------------------
  function setupReveal(){
    const io = new IntersectionObserver((entries) => {
      for (const en of entries){
        if (en.isIntersecting) en.target.classList.add("is-shown");
      }
    }, { threshold: 0.25 });

    $$(".section").forEach(sec => io.observe(sec));
  }

  // ---------------------------
  // Auto transitions (Intro->Hub, Hub->End)
  // ---------------------------
  function isMostlyOnScreen(el, ratio = 0.75){
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight || 1;
    const visible = Math.min(vh, r.bottom) - Math.max(0, r.top);
    const rr = Math.max(0, visible) / Math.max(1, r.height);
    return rr >= ratio;
  }

  function isNearViewport(el, at = 0.85){
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight || 1;
    return r.top <= vh * at;
  }

  function setupAutoScroll(){
    window.addEventListener("wheel", (e) => {
      // nepřekážej pásmu (má vlastní wheel handler)
      if (e.target && e.target.closest && e.target.closest(".bandTrack")) return;

      if (locked()) return;

      const dy = e.deltaY;

      // Intro -> Hub
      if (dy > 0 && isMostlyOnScreen(intro, 0.78)){
        e.preventDefault();
        scrollToEl(hub);
        return;
      }

      // Hub -> End (až když jsi fakt dole u sentinel)
      if (dy > 0 && isMostlyOnScreen(hub, 0.30) && isNearViewport(endSentinel, 0.85)){
        e.preventDefault();
        scrollToEl(end);
        return;
      }
    }, { passive: false });

    // Touch (mobil)
    let startY = null;
    window.addEventListener("touchstart", (e) => {
      startY = e.touches?.[0]?.clientY ?? null;
    }, { passive: true });

    window.addEventListener("touchend", (e) => {
      if (startY == null || locked()) return;
      const endY = e.changedTouches?.[0]?.clientY ?? startY;
      const dy = startY - endY;
      startY = null;

      if (Math.abs(dy) < 22) return;

      if (dy > 0 && isMostlyOnScreen(intro, 0.78)) scrollToEl(hub);
      if (dy > 0 && isMostlyOnScreen(hub, 0.30) && isNearViewport(endSentinel, 0.85)) scrollToEl(end);
    }, { passive: true });
  }

  // ---------------------------
  // Accordion
  // ---------------------------
  function updateCollapseBtn(){
    if (!btnCollapseAll) return;
    const anyOpen = accItems.some(i => i.classList.contains("is-open"));
    btnCollapseAll.disabled = !anyOpen;
  }

  function fillContent(item){
    const slot = $('[data-slot="content"]', item);
    if (!slot || slot.dataset.filled === "1") return;

    const section = item.dataset.section;
    const tpl = document.getElementById(`tpl-${section}`);
    if (tpl?.content){
      slot.appendChild(tpl.content.cloneNode(true));
      slot.dataset.filled = "1";
    }
  }

  function openItem(item){
    if (!item) return;

    // close others
    accItems.forEach(it => { if (it !== item) closeItem(it); });

    fillContent(item);

    const head = $(".accHead", item);
    const body = $(".accBody", item);
    if (!head || !body) return;

    item.classList.add("is-open");
    head.setAttribute("aria-expanded", "true");
    body.setAttribute("aria-hidden", "false");

    // animate height
    body.style.maxHeight = "0px";
    body.offsetHeight; // reflow
    body.style.maxHeight = body.scrollHeight + "px";

    const onEnd = (ev) => {
      if (ev.propertyName !== "max-height") return;
      if (!item.classList.contains("is-open")) return;
      body.style.maxHeight = "none";
      body.removeEventListener("transitionend", onEnd);
    };
    body.addEventListener("transitionend", onEnd);

    // init band if exists in this item
    item.querySelectorAll(".bandTrack").forEach(setupBandTrack);

    updateCollapseBtn();
  }

  function closeItem(item){
    if (!item || !item.classList.contains("is-open")) return;

    const head = $(".accHead", item);
    const body = $(".accBody", item);
    if (!head || !body) return;

    // from none -> px
    body.style.maxHeight = body.scrollHeight + "px";
    body.offsetHeight;

    item.classList.remove("is-open");
    head.setAttribute("aria-expanded", "false");
    body.setAttribute("aria-hidden", "true");
    body.style.maxHeight = "0px";

    updateCollapseBtn();
  }

  function collapseAll(){
    accItems.forEach(closeItem);
    updateCollapseBtn();
  }

  function setupAccordion(){
    if (!accordion) return;

    accItems.forEach((item) => {
      const head = $(".accHead", item);
      if (!head) return;

      head.addEventListener("click", () => {
        const isOpen = item.classList.contains("is-open");
        if (isOpen) closeItem(item);
        else openItem(item);
      });
    });

    btnCollapseAll?.addEventListener("click", collapseAll);

    // hash deep link
    const h = (location.hash || "").replace("#", "");
    if (["about","teaching","projects"].includes(h)){
      scrollToEl(hub);
      setTimeout(() => {
        const item = accItems.find(i => i.dataset.section === h);
        if (item) openItem(item);
      }, prefersReduced ? 0 : 180);
    }

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") collapseAll();
    });

    updateCollapseBtn();
  }

  // ---------------------------
  // About band (wheel->horizontal, reveal, dots, parallax)
  // ---------------------------
  const bandInited = new WeakSet();

  function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

  function setupBandTrack(track){
    if (!track || bandInited.has(track)) return;
    bandInited.add(track);

    const cards = Array.from(track.querySelectorAll(".bandCard"));
    const dotsWrap = track.closest(".aboutBand")?.querySelector(".bandDots") || null;

    // dots
    if (dotsWrap && dotsWrap.childElementCount === 0){
      cards.forEach(() => {
        const d = document.createElement("span");
        d.className = "dot";
        dotsWrap.appendChild(d);
      });
    }
    const dots = dotsWrap ? Array.from(dotsWrap.querySelectorAll(".dot")) : [];

    // wheel -> horizontal scroll
    track.addEventListener("wheel", (e) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)){
        e.preventDefault();
        track.scrollLeft += e.deltaY;
      }
    }, { passive: false });

    // reveal per card (root = track)
    const io = new IntersectionObserver((entries) => {
      for (const en of entries){
        en.target.classList.toggle("is-inview", en.isIntersecting);
      }
    }, { root: track, threshold: 0.55 });
    cards.forEach(c => io.observe(c));

    function updateActive(){
      const tr = track.getBoundingClientRect();
      const center = tr.left + tr.width/2;

      let best = null;
      let bestDist = Infinity;

      for (const c of cards){
        const r = c.getBoundingClientRect();
        const cCenter = r.left + r.width/2;
        const dist = Math.abs(center - cCenter);
        if (dist < bestDist){ bestDist = dist; best = c; }
      }

      cards.forEach((c, i) => {
        const on = (c === best);
        c.classList.toggle("is-active", on);
        if (dots[i]) dots[i].classList.toggle("is-on", on);
      });
    }

    // parallax
    let raf = 0;
    function onScroll(){
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;

        const tr = track.getBoundingClientRect();
        const tCenter = tr.left + tr.width/2;

        for (const c of cards){
          const img = c.querySelector("img");
          if (!img) continue;

          const r = c.getBoundingClientRect();
          const cCenter = r.left + r.width/2;
          const norm = (cCenter - tCenter) / tr.width; // ~ -0.5..0.5
          const px = clamp(norm * 26, -14, 14);

          img.style.setProperty("--px", prefersReduced ? "0px" : `${px}px`);
        }

        updateActive();
      });
    }

    track.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    onScroll();
  }

  function initExistingBands(){
    document.querySelectorAll(".bandTrack").forEach(setupBandTrack);
  }

  // Footer reveal on view
  function setupFooterReveal(){
    if (!footer) return;
    const io = new IntersectionObserver((entries) => {
      for (const en of entries){
        if (en.isIntersecting) footer.classList.add("is-visible");
      }
    }, { threshold: 0.08, rootMargin: "0px 0px -30% 0px" });
    io.observe(footer);
  }

  // init
  setupJumpLinks();
  setupReveal();
  setupAutoScroll();
  setupAccordion();
  initExistingBands();
  setupFooterReveal();
})();