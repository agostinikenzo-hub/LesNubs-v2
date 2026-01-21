// /core/nav.js
(function initS26Nav() {
  // ✅ Prevent double init if script accidentally included twice
  if (window.__S26_NAV_INIT__) return;
  window.__S26_NAV_INIT__ = true;

  function boot() {
    const header = document.querySelector("header");
    const getHeaderOffset = () => {
      const h = header?.getBoundingClientRect?.().height;
      return Number.isFinite(h) && h > 0 ? Math.ceil(h) : 72;
    };

    const navToggle = document.getElementById("nav-toggle");
    const navMenu = document.getElementById("nav-menu");
    const navToggleIcon = document.getElementById("nav-toggle-icon");

    const seasonWrap = document.getElementById("season-menu-wrapper");
    const seasonBtn = document.getElementById("season-menu-btn");
    const seasonPanel = document.getElementById("season-menu-panel");

    const moreWrap = document.getElementById("more-menu-wrapper");
    const moreBtn = document.getElementById("more-menu-btn");
    const morePanel = document.getElementById("more-menu-panel");

    const isHidden = (el) => !el || el.classList.contains("hidden");

    function setMobileMenu(open) {
      if (!navMenu || !navToggleIcon) return;
      if (open) {
        navMenu.classList.remove("hidden");
        navToggleIcon.textContent = "✕";
      } else {
        navMenu.classList.add("hidden");
        navToggleIcon.textContent = "☰";
      }
    }

    function closeSeason() {
      if (!seasonPanel) return;
      seasonPanel.classList.add("hidden");
      seasonBtn?.setAttribute("aria-expanded", "false");
    }

    function closeMore() {
      if (!morePanel) return;
      morePanel.classList.add("hidden");
      moreBtn?.setAttribute("aria-expanded", "false");
    }

    function closeAllDropdowns() {
      closeSeason();
      closeMore();
    }

    // ===== Mobile nav toggle =====
    if (navToggle && navMenu && navToggleIcon) {
      navToggle.addEventListener("click", (e) => {
        e.stopPropagation();
        const open = isHidden(navMenu);
        if (open) closeAllDropdowns();
        setMobileMenu(open);
      });
    }

    // ===== Smooth scroll for in-page nav =====
    document.querySelectorAll("[data-scroll]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = btn.getAttribute("data-scroll");
        if (!target) return;

        const el = document.querySelector(target);
        if (!el) return;

        const headerOffset = getHeaderOffset();
        const rect = el.getBoundingClientRect();
        const offsetTop = window.scrollY + rect.top - headerOffset;

        window.scrollTo({ top: offsetTop, behavior: "smooth" });

        setMobileMenu(false);
        closeAllDropdowns();
      });
    });

    // ===== Season dropdown (desktop) =====
    if (seasonWrap && seasonBtn && seasonPanel) {
      seasonBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const willOpen = isHidden(seasonPanel);
        closeMore();
        setMobileMenu(false);
        if (willOpen) {
          seasonPanel.classList.remove("hidden");
          seasonBtn.setAttribute("aria-expanded", "true");
        } else {
          closeSeason();
        }
      });
    }

    // ===== More dropdown (desktop) =====
    if (moreWrap && moreBtn && morePanel) {
      moreBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const willOpen = isHidden(morePanel);
        closeSeason();
        setMobileMenu(false);
        if (willOpen) {
          morePanel.classList.remove("hidden");
          moreBtn.setAttribute("aria-expanded", "true");
        } else {
          closeMore();
        }
      });
    }

    // ===== Click outside closes dropdowns + mobile =====
    document.addEventListener("click", (e) => {
      const t = e.target;
      const clickedSeason = seasonWrap && seasonWrap.contains(t);
      const clickedMore = moreWrap && moreWrap.contains(t);
      const clickedMobileToggle = navToggle && navToggle.contains(t);
      const clickedMobileMenu = navMenu && navMenu.contains(t);

      if (!clickedSeason && !clickedMore) closeAllDropdowns();
      if (!clickedMobileToggle && !clickedMobileMenu) setMobileMenu(false);
    });

    // ===== Escape closes everything =====
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      closeAllDropdowns();
      setMobileMenu(false);
    });

    // ===== If we resize to desktop, close mobile menu =====
    window.addEventListener("resize", () => {
      if (window.innerWidth >= 768) setMobileMenu(false);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
