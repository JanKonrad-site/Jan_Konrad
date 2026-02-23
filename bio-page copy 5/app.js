(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const accordion = $("#accordion");
  const accItems = accordion ? $$(".accItem", accordion) : [];
  const btnCollapseAll = $("#btnCollapseAll");

  // ---------------------------
  // Jump links (buttons)
  // ---------------------------
  function jumpTo(selector){
    const el = $(selector);
    if (!el) return;
    el.scrollIntoView({ behavior: prefersReduced ? "auto" : "smooth", block: "start" });
  }

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
  // Reveal
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
  // Align accordion item into view
  // ---------------------------
  function alignItem(item){
    if (!item) return;
    const offset = 18; // lehký odsazení od horní hrany
    const top = item.getBoundingClientRect().top;
    const y = window.scrollY + top - offset;

    window.scrollTo({
      top: Math.max(0, y),
      behavior: prefersReduced ? "auto" : "smooth"
    });
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

    // nejdřív zarovnej (aby to “sedlo” v sekci)
    alignItem(item);

    body.style.maxHeight = "0px";
    body.offsetHeight;
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

  function closeItem(item){
    if (!item || !item.classList.contains("is-open")) return;

    const head = $(".accHead", item);
    const body = $(".accBody", item);
    if (!head || !body) return;

    // zarovnej i při zavření, ať to nepůsobí “rozhozeně”
    alignItem(item);

    body.style.maxHeight = body.scrollHeight + "px";
    body.offsetHeight;

    item.classList.remove("is-open");
    head.setAttribute("aria-expanded", "false");
    body.setAttribute("aria-hidden", "true");
    body.style.maxHeight = "0px";

    updateCollapseBtn();
  }

  function collapseAll(){
    accItems.forEach((it) => {
      if (it.classList.contains("is-open")) closeItem(it);
    });
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

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") collapseAll();
    });

    updateCollapseBtn();
  }

  setupJumpLinks();
  setupReveal();
  setupAccordion();
})();