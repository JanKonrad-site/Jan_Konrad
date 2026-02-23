(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const intro = $("#intro");
  const hub = $("#hub");
  const end = $("#end");
  const sections = [intro, hub, end].filter(Boolean);

  const accordion = $("#accordion");
  const items = accordion ? $$(".accItem", accordion) : [];
  const btnCollapseAll = $("#btnCollapseAll");

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // lock to avoid rapid snapping
  const LOCK_MS = prefersReduced ? 0 : 760;
  let lockUntil = 0;
  const now = () => Date.now();
  const locked = () => now() < lockUntil;
  const lock = () => (lockUntil = now() + LOCK_MS);

  function scrollToEl(el) {
    if (!el) return;
    el.scrollIntoView({ behavior: prefersReduced ? "auto" : "smooth", block: "start" });
    lock();
    // ensure reveal class attaches quickly on snap
    setTimeout(() => el.classList.add("is-shown"), prefersReduced ? 0 : 120);
  }

  function jumpTo(selector) {
    const el = $(selector);
    if (el) scrollToEl(el);
  }

  /* -------------------------
     Jump links
  ------------------------- */
  function setupJumpLinks() {
    $$("[data-jump]").forEach((el) => {
      const go = (e) => {
        const target = el.getAttribute("data-jump");
        if (!target) return;
        e.preventDefault();
        jumpTo(target);
      };
      el.addEventListener("click", go);
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") go(e);
      });
    });
  }

  /* -------------------------
     Section reveal (delayed)
  ------------------------- */
  function setupSectionReveal() {
    // show intro immediately
    intro?.classList.add("is-shown");

    const io = new IntersectionObserver((entries) => {
      for (const en of entries) {
        if (en.isIntersecting) {
          en.target.classList.add("is-shown");
        }
      }
    }, {
      threshold: 0.55,
      rootMargin: "0px 0px -10% 0px"
    });

    sections.forEach((s) => io.observe(s));
  }

  /* -------------------------
     Accordion
  ------------------------- */
  function updateCollapseBtn() {
    if (!btnCollapseAll) return;
    const anyOpen = items.some((i) => i.classList.contains("is-open"));
    btnCollapseAll.disabled = !anyOpen;
  }

  function fillContent(item) {
    const section = item.dataset.section;
    const slot = $('[data-slot="content"]', item);
    if (!slot || slot.dataset.filled === "1") return;

    const tpl = document.getElementById(`tpl-${section}`);
    if (tpl?.content) {
      slot.appendChild(tpl.content.cloneNode(true));
      slot.dataset.filled = "1";
    }
  }

  function openItem(item) {
    if (!item) return;

    // close others (true accordion)
    items.forEach((it) => {
      if (it !== item) closeItem(it);
    });

    fillContent(item);

    const head = $(".accHead", item);
    const body = $(".accBody", item);
    if (!head || !body) return;

    item.classList.add("is-open");
    head.setAttribute("aria-expanded", "true");
    body.setAttribute("aria-hidden", "false");

    // animate max-height to scrollHeight
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

    updateCollapseBtn();
  }

  function closeItem(item) {
    if (!item || !item.classList.contains("is-open")) return;

    const head = $(".accHead", item);
    const body = $(".accBody", item);
    if (!head || !body) return;

    // if maxHeight is none, set it to current height before collapsing
    body.style.maxHeight = body.scrollHeight + "px";
    body.offsetHeight;

    item.classList.remove("is-open");
    head.setAttribute("aria-expanded", "false");
    body.setAttribute("aria-hidden", "true");
    body.style.maxHeight = "0px";

    updateCollapseBtn();
  }

  function collapseAll() {
    items.forEach(closeItem);
    updateCollapseBtn();
  }

  function setupAccordion() {
    if (!accordion) return;

    items.forEach((item) => {
      const head = $(".accHead", item);
      if (!head) return;

      head.addEventListener("click", () => {
        const isOpen = item.classList.contains("is-open");
        if (isOpen) closeItem(item);
        else openItem(item);
      });
    });

    btnCollapseAll?.addEventListener("click", collapseAll);

    // ESC collapses
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") collapseAll();
    });

    // hash deep link
    const h = (location.hash || "").replace("#", "");
    if (["about", "teaching", "projects"].includes(h)) {
      scrollToEl(hub);
      setTimeout(() => {
        const target = items.find((i) => i.dataset.section === h);
        if (target) openItem(target);
      }, prefersReduced ? 0 : 180);
    }

    updateCollapseBtn();
  }

  /* -------------------------
     Wheel snap: only force between sections.
     - Intro -> Hub (always on first wheel down)
     - Hub: allow normal scrolling; snap to End only when user is near bottom of Hub.
     - End -> Hub when wheel up at top of End.
  ------------------------- */
  function sectionRect(el) { return el.getBoundingClientRect(); }
  function atTop(el, px = 10) { return sectionRect(el).top >= -px; }
  function atBottom(el, px = 10) { return sectionRect(el).bottom <= (window.innerHeight + px); }

  function setupWheelSnap() {
    window.addEventListener("wheel", (e) => {
      const dy = e.deltaY;
      if (Math.abs(dy) < 6) return;

      if (locked()) {
        e.preventDefault();
        return;
      }

      // 1) Intro -> Hub
      if (dy > 0 && intro && atTop(intro, 30)) {
        e.preventDefault();
        scrollToEl(hub);
        return;
      }

      // 2) Hub -> End only when at bottom of hub (so you can read accordion content)
      if (dy > 0 && hub && atBottom(hub, 30)) {
        e.preventDefault();
        scrollToEl(end);
        return;
      }

      // 3) Hub -> Intro when at top and wheel up
      if (dy < 0 && hub && atTop(hub, 30)) {
        e.preventDefault();
        scrollToEl(intro);
        return;
      }

      // 4) End -> Hub when wheel up at top of end
      if (dy < 0 && end && atTop(end, 30)) {
        e.preventDefault();
        scrollToEl(hub);
        return;
      }
    }, { passive: false });
  }

  /* -------------------------
     Touch snap (mobile)
  ------------------------- */
  function setupTouchSnap() {
    let startY = null;

    window.addEventListener("touchstart", (e) => {
      startY = e.touches?.[0]?.clientY ?? null;
    }, { passive: true });

    window.addEventListener("touchend", (e) => {
      if (startY == null) return;
      if (locked()) return;

      const endY = e.changedTouches?.[0]?.clientY ?? startY;
      const dy = startY - endY;
      startY = null;

      if (Math.abs(dy) < 26) return;

      if (dy > 0) {
        // swipe up
        if (intro && atTop(intro, 30)) scrollToEl(hub);
        else if (hub && atBottom(hub, 30)) scrollToEl(end);
      } else {
        // swipe down
        if (end && atTop(end, 30)) scrollToEl(hub);
        else if (hub && atTop(hub, 30)) scrollToEl(intro);
      }
    }, { passive: true });
  }

  /* init */
  setupJumpLinks();
  setupSectionReveal();
  setupAccordion();
  setupWheelSnap();
  setupTouchSnap();
})();
