// /components/lockedFeatureCard.js
// Shared unlock/locked shell — matches lpProgressModule look & feel
// - Locked: glass card + animated background drift + animated badge aura
// - Unlocked: calls renderUnlocked(mountEl) directly (no extra wrapper)

function injectStylesOnce() {
  if (document.getElementById("ln-locked-feature-styles")) return;

  const style = document.createElement("style");
  style.id = "ln-locked-feature-styles";
  style.textContent = `
    @keyframes lnLockGlow {
      0%   { box-shadow: 0 0 0 0 rgba(15,23,42,0.00), 0 12px 30px rgba(15,23,42,0.08); }
      50%  { box-shadow: 0 0 0 10px rgba(15,23,42,0.06), 0 12px 34px rgba(15,23,42,0.10); }
      100% { box-shadow: 0 0 0 0 rgba(15,23,42,0.00), 0 12px 30px rgba(15,23,42,0.08); }
    }

    @keyframes lnAuraPulse {
      0%   { opacity: 0.18; filter: blur(8px); transform: scale(0.98); }
      50%  { opacity: 0.32; filter: blur(10px); transform: scale(1.02); }
      100% { opacity: 0.18; filter: blur(8px); transform: scale(0.98); }
    }

    @keyframes lnBgDrift {
      0%   { transform: rotate(8deg) translate3d(0,0,0) scale(1.0); }
      50%  { transform: rotate(10deg) translate3d(8px,-6px,0) scale(1.02); }
      100% { transform: rotate(8deg) translate3d(0,0,0) scale(1.0); }
    }

    @keyframes lnBadgeDrift {
      0%   { transform: translate3d(-6px, 4px, 0) scale(1.00); }
      50%  { transform: translate3d(8px, -6px, 0) scale(1.03); }
      100% { transform: translate3d(-6px, 4px, 0) scale(1.00); }
    }

    /* Lock shell */
    .lp-lock {
      border: 1px solid rgba(148,163,184,0.35);
      background: rgba(255,255,255,0.60);
      backdrop-filter: blur(10px);
      border-radius: 1.25rem;
      padding: 1.0rem;
      position: relative;
      overflow: hidden;
      isolation: isolate;
    }

    .lp-lock::before {
      content: "";
      position: absolute;
      inset: -40%;
      background:
        radial-gradient(circle at 30% 30%, var(--lnLockA, rgba(255,128,0,0.10)), transparent 55%),
        radial-gradient(circle at 70% 60%, var(--lnLockB, rgba(59,130,246,0.10)), transparent 60%);
      pointer-events: none;
      animation: lnBgDrift 8.5s ease-in-out infinite;
      opacity: 1;
      z-index: 0;
    }

    .lp-lock-inner {
      position: relative;
      z-index: 1;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
    }

    /* Typography (don’t depend on Tailwind) */
    .lp-lock-title {
      font-size: 0.95rem;
      font-weight: 900;
      letter-spacing: -0.02em;
      color: #0f172a;
    }
    .lp-lock-sub {
      font-size: 0.82rem;
      color: rgba(100,116,139,0.95);
      margin-top: 0.35rem;
      line-height: 1.2;
    }
    .lp-lock-days {
      font-weight: 900;
      color: rgba(15,23,42,0.90);
    }
    .lp-lock-note {
      font-size: 0.72rem;
      color: rgba(100,116,139,0.65);
      margin-top: 0.35rem;
    }

    /* Badge with moving aura */
    .lp-lock-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;
      border-radius: 999px;
      border: 1px solid rgba(148,163,184,0.40);
      background: rgba(255,255,255,0.55);
      font-size: 0.72rem;
      font-weight: 900;
      color: #0f172a;
      position: relative;
      overflow: hidden;
      animation: lnLockGlow 3.0s ease-in-out infinite;
    }

    .lp-lock-badge::before {
      content: "";
      position: absolute;
      inset: -120%;
      background:
        radial-gradient(circle at 30% 30%, var(--lnBadgeA, rgba(255,128,0,0.22)), transparent 55%),
        radial-gradient(circle at 70% 60%, var(--lnBadgeB, rgba(59,130,246,0.20)), transparent 60%);
      pointer-events: none;
      animation: lnAuraPulse 2.6s ease-in-out infinite, lnBadgeDrift 6.2s ease-in-out infinite;
      z-index: 0;
    }

    .lp-lock-badge > span {
      position: relative;
      z-index: 1;
    }
  `;
  document.head.appendChild(style);
}

const THEMES = {
  // closest match to your Progression lock
  progress: {
    lockA: "rgba(255,128,0,0.10)",
    lockB: "rgba(59,130,246,0.10)",
    badgeA: "rgba(255,128,0,0.22)",
    badgeB: "rgba(59,130,246,0.20)",
  },
  // more “blue-forward”, slightly calmer
  timeline: {
    lockA: "rgba(59,130,246,0.12)",
    lockB: "rgba(15,23,42,0.06)",
    badgeA: "rgba(59,130,246,0.24)",
    badgeB: "rgba(147,197,253,0.18)",
  },
  // warmer “prize” vibe (orange + rose)
  prize: {
    lockA: "rgba(255,128,0,0.12)",
    lockB: "rgba(244,63,94,0.08)",
    badgeA: "rgba(255,128,0,0.26)",
    badgeB: "rgba(244,63,94,0.18)",
  },
};

function renderLocked(mountEl, { title, unlockInDays, note, pill, theme }) {
  const t = THEMES[theme] || THEMES.progress;

  mountEl.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "lp-lock";
  wrap.style.setProperty("--lnLockA", t.lockA);
  wrap.style.setProperty("--lnLockB", t.lockB);
  wrap.style.setProperty("--lnBadgeA", t.badgeA);
  wrap.style.setProperty("--lnBadgeB", t.badgeB);

  wrap.innerHTML = `
    <div class="lp-lock-inner">
      <div>
        <div class="lp-lock-title">${escapeHTML(title || "Locked Feature")}</div>
        <div class="lp-lock-sub">
          Unlocks in <span class="lp-lock-days">${Number(unlockInDays) || 0}</span> day(s).
        </div>
        ${note ? `<div class="lp-lock-note">${escapeHTML(note)}</div>` : ""}
      </div>

      <div class="lp-lock-badge">
        <span>🔒 ${escapeHTML(pill || "Locked Feature")}</span>
      </div>
    </div>
  `;

  mountEl.appendChild(wrap);
}

function escapeHTML(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/**
 * mountUnlockableCard(mountEl, opts)
 * - If unlockInDays > 0 => renders the locked shell
 * - Else => calls renderUnlocked(mountEl) (or does nothing if missing)
 */
export function mountUnlockableCard(
  mountEl,
  {
    title = "Locked Feature",
    unlockInDays = 0,
    note = "(Set to 0 whenever you want it live.)",
    pill = "Locked Feature",
    theme = "progress", // progress | timeline | prize
    renderUnlocked = null,
  } = {}
) {
  injectStylesOnce();
  if (!mountEl) return;

  if (unlockInDays > 0) {
    renderLocked(mountEl, { title, unlockInDays, note, pill, theme });
    return;
  }

  if (typeof renderUnlocked === "function") {
    renderUnlocked(mountEl);
  }
}
