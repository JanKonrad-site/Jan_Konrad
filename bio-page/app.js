    (() => {
      "use strict";

      const $ = (sel, root=document) => root.querySelector(sel);
      const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

      const intro = $("#intro");
      const hub = $("#hub");
      const hubLayout = $("#hubLayout");
      const cards = $$(".card", hubLayout);
      const btnClose = $("#btnClose");
      const btnBack = $("#btnBack");

      const detailTitle = $("#detailTitle");
      const detailSubtitle = $("#detailSubtitle");
      const detailContent = $("#detailContent");

      const footer = $("#siteFooter");

      let activeSection = null;
      let introAutoJumped = false;

      /* -------------------------
         Smooth jump helper
      ------------------------- */
      function jumpTo(selector){
        const el = $(selector);
        if (!el) return;
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }

      /* -------------------------
         INTRO: first scroll -> jump to HUB
      ------------------------- */
      function setupIntroAutoJump(){
        // Click cues
        $$("[data-jump]").forEach(el => {
          el.addEventListener("click", (e) => {
            const target = el.getAttribute("data-jump");
            if (target) jumpTo(target);
          });
          // Allow Enter key for the scrollCue div
          el.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
              const target = el.getAttribute("data-jump");
              if (target) jumpTo(target);
            }
          });
        });

        // Wheel / touch intent on intro => jump once
        function tryAutoJump(deltaY){
          if (introAutoJumped) return;
          if (deltaY <= 0) return;
          introAutoJumped = true;
          jumpTo("#hub");
        }

        intro.addEventListener("wheel", (e) => {
          // Only when intro is mostly visible
          const r = intro.getBoundingClientRect();
          const mostlyOnScreen = r.top >= -20 && r.top <= 20;
          if (!mostlyOnScreen) return;
          tryAutoJump(e.deltaY);
        }, { passive: true });

        // Touch swipe
        let touchY = null;
        intro.addEventListener("touchstart", (e) => {
          touchY = e.touches?.[0]?.clientY ?? null;
        }, { passive: true });
        intro.addEventListener("touchmove", (e) => {
          if (touchY == null) return;
          const y = e.touches?.[0]?.clientY ?? touchY;
          const dy = touchY - y;
          if (dy > 18) tryAutoJump(1);
        }, { passive: true });
      }

      /* -------------------------
         HUB: expand/collapse logic
      ------------------------- */
      function setMode(mode){
        hubLayout.setAttribute("data-mode", mode);
        const isDetail = mode === "detail";
        btnClose.setAttribute("aria-disabled", String(!isDetail));
        btnClose.disabled = !isDetail;
      }

      function clearActive(){
        cards.forEach(c => {
          c.classList.remove("is-active");
          const btn = $(".card__btn", c);
          if (btn) btn.setAttribute("aria-expanded", "false");
        });
        activeSection = null;
        detailTitle.textContent = "Detail";
        detailSubtitle.textContent = "Vyber sekci vlevo.";
        detailContent.innerHTML = "";
        setMode("grid");
        // clear hash if it matches our sections
        if (location.hash && ["#about","#teaching","#projects"].includes(location.hash)){
          history.replaceState(null, "", "#hub");
        }
      }

      function activate(section){
        const card = cards.find(c => c.dataset.section === section);
        if (!card) return;

        // Toggle: if same active -> close
        if (activeSection === section){
          clearActive();
          return;
        }

        activeSection = section;

        cards.forEach(c => {
          const isActive = c === card;
          c.classList.toggle("is-active", isActive);
          const btn = $(".card__btn", c);
          if (btn) btn.setAttribute("aria-expanded", String(isActive));
        });

        // Fill panel from template
        const tpl = $(`#tpl-${section}`);
        detailContent.innerHTML = "";
        if (tpl && tpl.content){
          detailContent.appendChild(tpl.content.cloneNode(true));
        }

        const titles = {
          about:   { t: "O mně",   s: "Profil, záběr a rychlé odkazy" },
          teaching:{ t: "Výuka",   s: "Metodika, témata, ukázky materiálů" },
          projects:{ t: "Projekty",s: "Výběr projektů + stack + přínos" }
        };
        detailTitle.textContent = titles[section]?.t ?? "Detail";
        detailSubtitle.textContent = titles[section]?.s ?? "";

        setMode("detail");

        // Optional: keep deep link
        history.replaceState(null, "", `#${section}`);
      }

      function setupHub(){
        cards.forEach(card => {
          const section = card.dataset.section;
          const btn = $(".card__btn", card);
          btn.addEventListener("click", () => activate(section));
        });

        btnBack.addEventListener("click", clearActive);
        btnClose.addEventListener("click", clearActive);

        // ESC closes
        window.addEventListener("keydown", (e) => {
          if (e.key === "Escape" && hubLayout.getAttribute("data-mode") === "detail"){
            clearActive();
          }
        });

        // Open via hash
        function openFromHash(){
          const h = (location.hash || "").replace("#", "");
          if (["about","teaching","projects"].includes(h)){
            // Ensure hub is visible then activate
            $("#hub").scrollIntoView({ behavior: "smooth", block: "start" });
            // small delay so it feels natural
            setTimeout(() => activate(h), 220);
          }
        }
        window.addEventListener("hashchange", openFromHash);
        openFromHash();
      }

      /* -------------------------
         Footer reveal animation
      ------------------------- */
      function setupFooterReveal(){
        const io = new IntersectionObserver((entries) => {
          entries.forEach(en => {
            if (en.isIntersecting){
              footer.classList.add("is-visible");
            }
          });
        }, { threshold: 0.25 });
        io.observe(footer);
      }

      /* init */
      setupIntroAutoJump();
      setupHub();
      setupFooterReveal();
    })();