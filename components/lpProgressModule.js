// /components/lpProgressModule.js
import { loadLpRows } from "../core/lpData.js";

function el(tag, cls, html) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
}

function escHtml(v) {
  return String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function injectStylesOnce() {
  if (document.getElementById("lp-progress-styles")) return;
  const style = document.createElement("style");
  style.id = "lp-progress-styles";
  style.textContent = `
    @keyframes lpProgGlow {
      0%   { box-shadow: 0 0 0 0 rgba(15,23,42,0.00), 0 12px 30px rgba(15,23,42,0.08); }
      50%  { box-shadow: 0 0 0 10px rgba(15,23,42,0.06), 0 12px 34px rgba(15,23,42,0.10); }
      100% { box-shadow: 0 0 0 0 rgba(15,23,42,0.00), 0 12px 30px rgba(15,23,42,0.08); }
    }

    @keyframes lpBounce {
      0%, 100% { transform: translateY(0); }
      50%      { transform: translateY(-5px); }
    }

    @keyframes auraPulse {
      0%   { opacity: 0.18; filter: blur(8px); transform: scale(0.98); }
      50%  { opacity: 0.30; filter: blur(10px); transform: scale(1.02); }
      100% { opacity: 0.18; filter: blur(8px); transform: scale(0.98); }
    }

    .lp-lock {
      border: 1px solid rgba(148,163,184,0.35);
      background: rgba(255,255,255,0.60);
      backdrop-filter: blur(10px);
      border-radius: 1.25rem;
      padding: 1.0rem;
      position: relative;
      overflow: hidden;
    }
    .lp-lock::before {
      content: "";
      position: absolute;
      inset: -40%;
      background: radial-gradient(circle at 30% 30%, rgba(255,128,0,0.10), transparent 55%),
                  radial-gradient(circle at 70% 60%, rgba(59,130,246,0.10), transparent 60%);
      transform: rotate(8deg);
      pointer-events: none;
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
      animation: lpProgGlow 3.0s ease-in-out infinite;
    }

    .lp-stat-card {
      border: 1px solid rgba(148,163,184,0.35);
      border-radius: 1.25rem;
      background: rgba(255,255,255,0.60);
      backdrop-filter: blur(10px);
      padding: 0.85rem 0.9rem;
      box-shadow: 0 10px 24px rgba(15,23,42,0.06);
    }

    .lp-stat-kicker {
      font-size: 0.68rem;
      font-weight: 900;
      letter-spacing: 0.02em;
      color: rgba(100,116,139,0.95);
      text-transform: uppercase;
    }

    .lp-stat-value {
      font-size: 1.05rem;
      font-weight: 900;
      color: #0f172a;
      margin-top: 0.25rem;
      letter-spacing: -0.02em;
    }

    .lp-stat-sub {
      font-size: 0.72rem;
      color: rgba(100,116,139,0.95);
      margin-top: 0.25rem;
      line-height: 1.25;
    }

    .lp-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 2px 10px;
      border-radius: 999px;
      font-size: 0.65rem;
      font-weight: 900;
      white-space: nowrap;
      border: 1px solid rgba(148,163,184,0.35);
      background: rgba(255,255,255,0.65);
      color: rgba(15,23,42,0.85);
    }
    .lp-pill--solo {
      border-color: rgba(255,128,0,0.25);
      background: rgba(255,128,0,0.10);
      color: #c2410c;
    }
    .lp-pill--flex {
      border-color: rgba(59,130,246,0.22);
      background: rgba(59,130,246,0.10);
      color: #1d4ed8;
    }

    .lp-map-shell {
      border: 1px solid rgba(148,163,184,0.35);
      border-radius: 1.25rem;
      background: rgba(255,255,255,0.60);
      backdrop-filter: blur(10px);
      padding: 0.9rem;
      box-shadow: 0 10px 24px rgba(15,23,42,0.06);
      overflow: hidden;
    }

    .lp-svg {
      width: 100%;
      height: 230px;
      display: block;
    }

    .lp-axis {
      stroke: rgba(15,23,42,0.10);
      stroke-width: 1;
    }

    .lp-grid {
      stroke: rgba(15,23,42,0.06);
      stroke-width: 1;
    }

    /* subtle division/tier guides */
    .lp-divline {
      stroke: rgba(15,23,42,0.05);
      stroke-width: 1;
      stroke-dasharray: 2 4;
    }
    .lp-divlabel {
      fill: rgba(15,23,42,0.38);
      font-size: 9px;
      font-weight: 900;
      letter-spacing: 0.02em;
      text-transform: uppercase;
    }
    .lp-divlabel--sub {
      fill: rgba(15,23,42,0.28);
      font-size: 8px;
      font-weight: 800;
    }

    .lp-label {
      fill: rgba(15,23,42,0.55);
      font-size: 10px;
      font-weight: 800;
    }

    .lp-dotg {
      transform-origin: center;
      animation: lpBounce 2.2s ease-in-out infinite;
    }

    .lp-dotg--solo circle.main { fill: rgba(255,128,0,0.95); }
    .lp-dotg--flex circle.main { fill: rgba(59,130,246,0.95); }
    .lp-dotg--unranked circle.main { fill: rgba(148,163,184,0.45); }

    .lp-dotg circle.ring {
      fill: none;
      stroke-width: 1.5;
    }

    .lp-dotg text.initials {
      font-size: 9px;
      font-weight: 900;
      fill: rgba(255,255,255,0.95);
      dominant-baseline: middle;
      text-anchor: middle;
      pointer-events: none;
    }

    .lp-aura {
      animation: auraPulse 2.8s ease-in-out infinite;
    }

    .lp-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 2px 10px;
      border-radius: 999px;
      font-size: 0.65rem;
      font-weight: 900;
      white-space: nowrap;
      border: 1px solid rgba(148,163,184,0.35);
      background: rgba(255,255,255,0.65);
      color: rgba(15,23,42,0.85);
    }
    .lp-chip--solo { border-color: rgba(255,128,0,0.25); background: rgba(255,128,0,0.10); color: #c2410c; }
    .lp-chip--flex { border-color: rgba(59,130,246,0.22); background: rgba(59,130,246,0.10); color: #1d4ed8; }

    .lp-filter-row {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      flex-wrap: wrap;
    }

    .lp-filter-pill {
      appearance: none;
      border: 1px solid rgba(148,163,184,0.35);
      background: rgba(255,255,255,0.72);
      color: rgba(15,23,42,0.82);
      border-radius: 999px;
      padding: 3px 10px;
      font-size: 0.64rem;
      font-weight: 900;
      line-height: 1.1;
      letter-spacing: 0.01em;
      cursor: pointer;
      transition: transform 120ms ease, border-color 120ms ease, background 120ms ease, color 120ms ease;
    }

    .lp-filter-pill:hover {
      transform: translateY(-1px);
      border-color: rgba(100,116,139,0.45);
      background: rgba(255,255,255,0.92);
    }

    .lp-filter-pill--solo {
      border-color: rgba(255,128,0,0.22);
      background: rgba(255,128,0,0.07);
      color: #c2410c;
    }

    .lp-filter-pill--flex {
      border-color: rgba(59,130,246,0.22);
      background: rgba(59,130,246,0.07);
      color: #1d4ed8;
    }

    .lp-filter-pill--active {
      color: #0f172a;
      border-color: rgba(15,23,42,0.35);
      background: rgba(15,23,42,0.08);
      box-shadow: 0 4px 10px rgba(15,23,42,0.08);
    }

    .lp-filter-pill--active.lp-filter-pill--solo {
      color: #c2410c;
      border-color: rgba(255,128,0,0.35);
      background: rgba(255,128,0,0.14);
    }

    .lp-filter-pill--active.lp-filter-pill--flex {
      color: #1d4ed8;
      border-color: rgba(59,130,246,0.33);
      background: rgba(59,130,246,0.14);
    }

    @keyframes lpMilestoneEnter {
      0%   { opacity: 0; transform: translate(-50%, 10px) scale(0.96); }
      55%  { opacity: 1; }
      100% { opacity: 1; transform: translate(-50%, 0) scale(1); }
    }

    @keyframes lpMilestoneGlow {
      0%, 100% { box-shadow: 0 6px 14px rgba(15,23,42,0.06); }
      50%      { box-shadow: 0 10px 22px rgba(15,23,42,0.10); }
    }

    @keyframes lpTrackSweep {
      0%   { transform: translateX(-28%); opacity: 0.00; }
      35%  { opacity: 0.22; }
      100% { transform: translateX(128%); opacity: 0.00; }
    }

    .lp-miles-shell {
      border: 1px solid rgba(148,163,184,0.35);
      border-radius: 1.25rem;
      background: rgba(255,255,255,0.60);
      backdrop-filter: blur(10px);
      padding: 0.9rem;
      box-shadow: 0 10px 24px rgba(15,23,42,0.06);
      overflow: hidden;
    }

    .lp-miles-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      flex-wrap: wrap;
      margin-bottom: 0.45rem;
    }

    .lp-miles-title {
      font-size: 0.9rem;
      font-weight: 900;
      color: #0f172a;
    }

    .lp-miles-sub {
      font-size: 0.72rem;
      color: rgba(100,116,139,0.95);
      margin-top: 0.1rem;
    }

    .lp-miles-filters {
      margin-top: 0.35rem;
      margin-bottom: 0.55rem;
      display: grid;
      gap: 0.35rem;
    }

    .lp-miles-scroll {
      overflow-x: auto;
      overflow-y: hidden;
      padding-bottom: 0.2rem;
    }

    .lp-miles-board {
      min-width: 860px;
      height: 246px;
      position: relative;
      border-radius: 0.95rem;
      background:
        radial-gradient(circle at 16% 10%, rgba(255,128,0,0.10), transparent 36%),
        radial-gradient(circle at 86% 0%, rgba(59,130,246,0.10), transparent 40%),
        linear-gradient(180deg, rgba(248,250,252,0.82), rgba(241,245,249,0.58));
      border: 1px solid rgba(148,163,184,0.28);
      overflow: hidden;
      padding: 0;
    }

    .lp-miles-track {
      position: absolute;
      left: 18px;
      right: 18px;
      top: 42px;
      height: 6px;
      border-radius: 999px;
      border: 1px solid rgba(148,163,184,0.24);
      background: linear-gradient(90deg, rgba(255,128,0,0.28), rgba(59,130,246,0.24));
      overflow: hidden;
    }

    .lp-miles-track::after {
      content: "";
      position: absolute;
      top: -6px;
      width: 140px;
      height: 18px;
      background: linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.55), rgba(255,255,255,0));
      animation: lpTrackSweep 5.6s linear infinite;
      pointer-events: none;
    }

    .lp-miles-month {
      position: absolute;
      top: 14px;
      transform: translateX(-50%);
      font-size: 0.62rem;
      font-weight: 900;
      color: rgba(51,65,85,0.56);
      letter-spacing: 0.02em;
      text-transform: uppercase;
      user-select: none;
      pointer-events: none;
    }

    .lp-miles-tick {
      position: absolute;
      top: 37px;
      width: 1px;
      height: 15px;
      background: rgba(15,23,42,0.16);
      transform: translateX(-50%);
      user-select: none;
      pointer-events: none;
    }

    .lp-miles-today {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 1px;
      background: linear-gradient(180deg, rgba(239,68,68,0.0), rgba(239,68,68,0.55), rgba(239,68,68,0.0));
      transform: translateX(-50%);
      pointer-events: none;
    }

    .lp-miles-event {
      position: absolute;
      width: 104px;
      transform: translateX(-50%);
      text-align: center;
      animation: lpMilestoneEnter 0.45s ease both;
      will-change: transform, opacity;
    }

    .lp-miles-dot-wrap {
      width: 24px;
      margin: 0 auto;
    }

    .lp-miles-dot {
      width: 24px;
      height: 24px;
      display: block;
      filter: drop-shadow(0 6px 10px rgba(15,23,42,0.16));
      animation: lpBounce 2.2s ease-in-out infinite, lpMilestoneGlow 3.4s ease-in-out infinite;
    }

    .lp-miles-dot circle.ring {
      fill: none;
      stroke-width: 1.5;
    }

    .lp-miles-dot.lp-dotg--solo circle.ring {
      stroke: rgba(255,128,0,0.45);
    }
    .lp-miles-dot.lp-dotg--flex circle.ring {
      stroke: rgba(59,130,246,0.40);
    }
    .lp-miles-dot.lp-dotg--unranked circle.ring {
      stroke: rgba(148,163,184,0.35);
    }

    .lp-miles-kind {
      margin-top: 0.18rem;
      font-size: 0.58rem;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      color: rgba(71,85,105,0.85);
    }

    .lp-miles-event--tier .lp-miles-kind {
      color: #b45309;
    }
    .lp-miles-event--division .lp-miles-kind {
      color: #c2410c;
    }
    .lp-miles-event--placement .lp-miles-kind {
      color: #475569;
    }

    .lp-miles-rank {
      margin-top: 0.08rem;
      font-size: 0.64rem;
      font-weight: 900;
      color: #0f172a;
      line-height: 1.15;
    }

    .lp-miles-date {
      margin-top: 0.06rem;
      font-size: 0.57rem;
      color: rgba(100,116,139,0.88);
      line-height: 1.1;
    }

    .lp-miles-foot {
      margin-top: 0.42rem;
      font-size: 0.67rem;
      color: rgba(100,116,139,0.92);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.6rem;
      flex-wrap: wrap;
    }

    .lp-miles-counts {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      flex-wrap: wrap;
    }

    .lp-miles-chip {
      display: inline-flex;
      align-items: center;
      padding: 2px 8px;
      border-radius: 999px;
      border: 1px solid rgba(148,163,184,0.33);
      background: rgba(255,255,255,0.72);
      font-size: 0.62rem;
      font-weight: 900;
      color: rgba(15,23,42,0.82);
    }
  `;
  document.head.appendChild(style);
}

function rankPts(rankIndex) {
  const x = Number(rankIndex);
  if (!Number.isFinite(x) || x < 0) return null;
  return Math.round(x * 100);
}

function fmtPts(n) {
  if (n == null) return "—";
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}${Math.abs(n)}`;
}

function safeName(riotId) {
  return String(riotId || "—").split("#")[0].trim() || String(riotId || "—");
}

function initials(name) {
  const s = String(name || "").trim();
  if (!s) return "??";
  const parts = s.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] || "?";
  const b = (parts[1]?.[0] || parts[0]?.[1] || "").toUpperCase();
  return (a + b).toUpperCase().slice(0, 2);
}

function groupSeries(rows) {
  const out = new Map();
  for (const r of rows) {
    if (!r.riotId) continue;
    if (!out.has(r.riotId)) out.set(r.riotId, { SOLO: [], FLEX: [] });
    if (r.queue === "SOLO") out.get(r.riotId).SOLO.push(r);
    if (r.queue === "FLEX") out.get(r.riotId).FLEX.push(r);
  }
  for (const [id, q] of out.entries()) {
const ts = (x) => (Number.isFinite(x?.snapshotTs) ? x.snapshotTs : (x?.snapshotDate?.getTime?.() ?? 0));

q.SOLO.sort((a, b) => ts(a) - ts(b));
q.FLEX.sort((a, b) => ts(a) - ts(b));

    out.set(id, q);
  }
  return out;
}

function computeBestRunUntilDrop(series) {
  let best = { gain: 0, start: null, end: null };
  let curGain = 0;
  let curStart = null;

  for (let i = 1; i < series.length; i++) {
    const a = rankPts(series[i - 1].rankIndex);
    const b = rankPts(series[i].rankIndex);
    if (a == null || b == null) continue;
    const d = b - a;

    if (d > 0) {
      if (curStart == null) curStart = series[i - 1];
      curGain += d;
      if (curGain > best.gain) best = { gain: curGain, start: curStart, end: series[i] };
    } else if (d < 0) {
      curGain = 0;
      curStart = null;
    }
  }
  return best;
}

function computeLongestUpStreak(series) {
  let best = { len: 0, start: null, end: null, gain: 0 };
  let curLen = 0;
  let curStart = null;
  let curGain = 0;

  for (let i = 1; i < series.length; i++) {
    const a = rankPts(series[i - 1].rankIndex);
    const b = rankPts(series[i].rankIndex);
    if (a == null || b == null) continue;
    const d = b - a;

    if (d > 0) {
      if (curStart == null) curStart = series[i - 1];
      curLen += 1;
      curGain += d;
      if (curLen > best.len) best = { len: curLen, start: curStart, end: series[i], gain: curGain };
    } else {
      curLen = 0;
      curGain = 0;
      curStart = null;
    }
  }
  return best;
}

function computeBiggestDrop(series) {
  let best = { drop: 0, from: null, to: null };
  for (let i = 1; i < series.length; i++) {
    const a = rankPts(series[i - 1].rankIndex);
    const b = rankPts(series[i].rankIndex);
    if (a == null || b == null) continue;
    const d = b - a;
    if (d < best.drop) best = { drop: d, from: series[i - 1], to: series[i] };
  }
  return best;
}

function computeHighlights(seriesMap) {
  let bestRun = null;
  let bestStreak = null;
  let bestDrop = null;

  for (const [riotId, qs] of seriesMap.entries()) {
    for (const queue of ["SOLO", "FLEX"]) {
      const series = qs[queue] || [];
      if (series.length < 2) continue;

      const run = computeBestRunUntilDrop(series);
      if (run.gain > 0 && (!bestRun || run.gain > bestRun.gain)) bestRun = { riotId, queue, ...run };

      const st = computeLongestUpStreak(series);
      if (st.len > 0 && (!bestStreak || st.len > bestStreak.len)) bestStreak = { riotId, queue, ...st };

      const drop = computeBiggestDrop(series);
      if (drop.drop < 0 && (!bestDrop || drop.drop < bestDrop.drop)) bestDrop = { riotId, queue, ...drop };
    }
  }

  return { bestRun, bestStreak, bestDrop };
}

function renderLocked(root, unlockInDays) {
  root.innerHTML = "";
  const wrap = el("div", "lp-lock");
  const inner = el(
    "div",
    "lp-lock-inner",
    `
      <div>
        <div class="text-sm font-black text-slate-900">LP Progression</div>
        <div class="text-[0.8rem] text-slate-500 mt-1">
          Unlocks in <span class="font-black text-slate-800">${unlockInDays}</span> day(s).
        </div>
        <div class="text-[0.7rem] text-slate-400 mt-1">
          (Set to 0 whenever you want it live.)
        </div>
      </div>
      <div class="lp-lock-badge">🔒 Locked Feature</div>
    `
  );
  wrap.appendChild(inner);
  root.appendChild(wrap);
}

function dotGroup({ x, y, queue, label, isTop, delay = 0, tip = "" }) {
  const cls =
    queue === "SOLO"
      ? "lp-dotg lp-dotg--solo"
      : queue === "FLEX"
      ? "lp-dotg lp-dotg--flex"
      : "lp-dotg lp-dotg--unranked";

  const ring =
    queue === "SOLO"
      ? "rgba(255,128,0,0.45)"
      : queue === "FLEX"
      ? "rgba(59,130,246,0.40)"
      : "rgba(148,163,184,0.35)";

  const aura = isTop
    ? `<circle class="lp-aura" cx="${x}" cy="${y}" r="20" fill="${
        queue === "SOLO" ? "rgba(255,128,0,0.18)" : "rgba(59,130,246,0.16)"
      }"></circle>`
    : "";

  return `
    <g class="${cls}" style="animation-delay:${delay}s">
      <title>${tip || label}</title>
      ${aura}
      <circle class="ring" cx="${x}" cy="${y}" r="11" stroke="${ring}"></circle>
      <circle class="main" cx="${x}" cy="${y}" r="9"></circle>
      <text class="initials" x="${x}" y="${y}">${initials(label)}</text>
    </g>
  `;
}

// Build subtle tier/division guides using rankIndex structure:
// tiers are blocks of 4 divisions, each division ~ +1 in rankIndex.
// We’ll generate guides for the visible range.
function buildDivisionGuides({ lo, hi, xPos, yTop, yBot, yLabel }) {
  const TIERS = ["IRON", "BRONZE", "SILVER", "GOLD", "PLAT", "EMER", "DIAM"];
  // we treat PLAT=PLATINUM, EMER=EMERALD just for short labels

  // Translate "rank pts" space back into approx rankIndex space:
  const loIdx = lo / 100;
  const hiIdx = hi / 100;

  // Determine tier indices to show
  const tMin = Math.max(0, Math.floor(loIdx / 4));
  const tMax = Math.min(TIERS.length - 1, Math.floor(hiIdx / 4));

  const lines = [];
  for (let t = tMin; t <= tMax; t++) {
    // Tier boundary at t*4
    const tierStartPts = Math.round(t * 4 * 100);
    const tierEndPts = Math.round((t * 4 + 4) * 100);

    // Tier label position: center of tier band
    const midPts = Math.round((tierStartPts + tierEndPts) / 2);

    // Tier boundary line
    const xTier = xPos(tierStartPts);
    lines.push(`<line class="lp-divline" x1="${xTier}" y1="${yTop}" x2="${xTier}" y2="${yBot}" />`);

    // Division sub-lines within tier (IV/III/II/I) at +0,+1,+2,+3
    const divs = ["IV", "III", "II", "I"];
    for (let d = 0; d < 4; d++) {
      const divPts = Math.round((t * 4 + d) * 100);
      if (divPts < lo || divPts > hi) continue;
      const xd = xPos(divPts);
      // even subtler than tier line
      lines.push(`<line class="lp-divline" style="stroke:rgba(15,23,42,0.035)" x1="${xd}" y1="${yTop + 6}" x2="${xd}" y2="${yBot - 6}" />`);
      // small division text every other division only (keeps clean)
      if (d === 1 || d === 3) {
        lines.push(
          `<text class="lp-divlabel--sub" x="${xd}" y="${yLabel}" text-anchor="middle">${divs[d]}</text>`
        );
      }
    }

    // Tier label (only if tier midpoint is inside visible range)
    if (midPts >= lo && midPts <= hi) {
      lines.push(
        `<text class="lp-divlabel" x="${xPos(midPts)}" y="${yLabel - 10}" text-anchor="middle">${TIERS[t]}</text>`
      );
    }
  }

  // Add the last tier boundary at (tMax+1)*4
  const lastBoundary = Math.round((tMax + 1) * 4 * 100);
  if (lastBoundary >= lo && lastBoundary <= hi) {
    lines.push(`<line class="lp-divline" x1="${xPos(lastBoundary)}" y1="${yTop}" x2="${xPos(lastBoundary)}" y2="${yBot}" />`);
  }

  return lines.join("");
}

function buildRankMapSvg(seriesMap, rosterOrder = []) {
  const players = [...seriesMap.keys()];

  const order = rosterOrder.map((x) => String(x).trim());
  players.sort((a, b) => {
    const ba = safeName(a);
    const bb = safeName(b);
    const ia = order.indexOf(ba);
    const ib = order.indexOf(bb);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return ba.localeCompare(bb);
  });

  const latest = [];
  for (const riotId of players) {
    const qs = seriesMap.get(riotId);
    const soloLast = qs?.SOLO?.[qs.SOLO.length - 1] || null;
    const flexLast = qs?.FLEX?.[qs.FLEX.length - 1] || null;

    const soloPts = soloLast ? rankPts(soloLast.rankIndex) : null;
    const flexPts = flexLast ? rankPts(flexLast.rankIndex) : null;

    latest.push({
      riotId,
      name: safeName(riotId),
      soloPts,
      flexPts,
      soloRank: soloLast?.currentRank || (soloPts == null ? "UNRANKED" : ""),
      flexRank: flexLast?.currentRank || (flexPts == null ? "UNRANKED" : ""),
    });
  }

  const rankedPts = latest.flatMap((p) => [p.soloPts, p.flexPts]).filter((x) => x != null);
  const hasRanked = rankedPts.length > 0;
  const minPts = hasRanked ? Math.min(...rankedPts) : 0;
  const maxPts = hasRanked ? Math.max(...rankedPts) : 1;

  const W = 1000;
  const H = 230;
  const pad = { l: 18, r: 18, t: 24, b: 34 };
  const lineY = 128;

  const span = Math.max(50, maxPts - minPts);
  const padSpan = Math.round(span * 0.15);
  const lo = minPts - padSpan;
  const hi = maxPts + padSpan;

  const xPos = (pts) => {
    if (pts == null) return pad.l + 18;
    if (hi === lo) return pad.l + (W - pad.l - pad.r) * 0.5;
    const t = (pts - lo) / (hi - lo);
    return pad.l + t * (W - pad.l - pad.r);
  };

  // small general grid (still useful)
  const gridLines = [];
  const ticks = 4;
  for (let i = 0; i <= ticks; i++) {
    const tx = pad.l + (i / ticks) * (W - pad.l - pad.r);
    gridLines.push(`<line class="lp-grid" x1="${tx}" y1="${lineY - 24}" x2="${tx}" y2="${lineY + 24}" />`);
  }

  // NEW: subtle tier/div guides
  const divGuides = buildDivisionGuides({
    lo,
    hi,
    xPos,
    yTop: lineY - 30,
    yBot: lineY + 30,
    yLabel: pad.t + 10,
  });

  const topSolo = latest.filter((p) => p.soloPts != null).sort((a, b) => b.soloPts - a.soloPts)[0];
  const topFlex = latest.filter((p) => p.flexPts != null).sort((a, b) => b.flexPts - a.flexPts)[0];

  const dots = [];
  let delay = 0;

  const yForIdx = (baseY, idx) => baseY + ((idx % 3) - 1) * 16;

  let soloIdx = 0;
  let flexIdx = 0;
  let unIdx = 0;

  for (const p of latest) {
    if (p.soloPts != null) {
      const x = xPos(p.soloPts);
      const y = yForIdx(lineY - 26, soloIdx++);
      const isTop = topSolo && topSolo.riotId === p.riotId;
      const tip = `${p.name} — SOLO: ${p.soloRank} (${p.soloPts} pts)`;
      dots.push(dotGroup({ x, y, queue: "SOLO", label: p.name, isTop, delay, tip }));
      delay += 0.05;
    }
    if (p.flexPts != null) {
      const x = xPos(p.flexPts);
      const y = yForIdx(lineY + 26, flexIdx++);
      const isTop = topFlex && topFlex.riotId === p.riotId;
      const tip = `${p.name} — FLEX: ${p.flexRank} (${p.flexPts} pts)`;
      dots.push(dotGroup({ x, y, queue: "FLEX", label: p.name, isTop, delay, tip }));
      delay += 0.05;
    }
    if (p.soloPts == null && p.flexPts == null) {
      const x = pad.l + 18 + (unIdx % 6) * 18;
      const y = lineY + 52 + Math.floor(unIdx / 6) * 18;
      const tip = `${p.name} — UNRANKED`;
      dots.push(dotGroup({ x, y, queue: "UNRANKED", label: p.name, isTop: false, delay, tip }));
      delay += 0.03;
      unIdx++;
    }
  }

  const topChips = `
    <div class="mt-2 flex flex-wrap gap-2">
      ${
        topSolo
          ? `<span class="lp-chip lp-chip--solo">👑 Top SOLO: ${safeName(topSolo.riotId)}</span>`
          : `<span class="lp-chip lp-chip--solo">SOLO: —</span>`
      }
      ${
        topFlex
          ? `<span class="lp-chip lp-chip--flex">👑 Top FLEX: ${safeName(topFlex.riotId)}</span>`
          : `<span class="lp-chip lp-chip--flex">FLEX: —</span>`
      }
      <span class="lp-chip">Hover a dot for details</span>
    </div>
  `;

  const svg = `
    <div class="lp-map-shell">
      <div class="text-sm font-black text-slate-900">Rank Map</div>
      <div class="text-[0.72rem] text-slate-500 mt-0.5">
        Ranked players spread across the scale. Unranked grouped left (grey).
      </div>
      ${topChips}

      <svg class="lp-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Rank map">
        ${gridLines.join("")}
        ${divGuides}
        <line class="lp-axis" x1="${pad.l}" y1="${lineY}" x2="${W - pad.r}" y2="${lineY}"></line>

        <text class="lp-label" x="${pad.l}" y="${pad.t}" text-anchor="start"></text>
        <text class="lp-label" x="${W - pad.r}" y="${pad.t}" text-anchor="end"></text>

        ${dots.join("")}
      </svg>
    </div>
  `;

  return { svg };
}

const MILESTONE_TIERS = [
  "IRON",
  "BRONZE",
  "SILVER",
  "GOLD",
  "PLATINUM",
  "EMERALD",
  "DIAMOND",
  "MASTER",
  "GRANDMASTER",
  "CHALLENGER",
];

const MILESTONE_DIVS = ["IV", "III", "II", "I"];

function queueClass(queue) {
  return queue === "SOLO" ? "solo" : queue === "FLEX" ? "flex" : "other";
}

function cleanRankLabel(label) {
  const s = String(label || "").trim();
  if (!s) return "";
  return s.split("·")[0].trim();
}

function rankLabelFromFloor(floor) {
  if (!Number.isFinite(floor) || floor < 0) return "UNRANKED";
  const tierIdx = Math.floor(floor / 4);
  const divIdx = floor % 4;
  const tier = MILESTONE_TIERS[tierIdx] || `TIER ${tierIdx + 1}`;
  if (tierIdx >= 7) return tier;
  return `${tier} ${MILESTONE_DIVS[Math.max(0, Math.min(3, divIdx))]}`;
}

function rankLabelWithFallback(row, floor) {
  const clean = cleanRankLabel(row?.currentRank);
  if (clean) return clean;
  return rankLabelFromFloor(floor);
}

function playerIdsOrdered(seriesMap, rosterOrder = []) {
  const ids = [...seriesMap.keys()];
  const order = rosterOrder.map((x) => String(x || "").trim()).filter(Boolean);

  ids.sort((a, b) => {
    const na = safeName(a);
    const nb = safeName(b);
    const ia = order.indexOf(na);
    const ib = order.indexOf(nb);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return na.localeCompare(nb);
  });
  return ids;
}

function seasonWindowFromRows(rows) {
  const validTs = (rows || [])
    .map((r) => (Number.isFinite(r?.snapshotTs) ? r.snapshotTs : r?.snapshotDate?.getTime?.() ?? NaN))
    .filter((x) => Number.isFinite(x) && x > 0);

  const anchor = validTs.length ? new Date(Math.min(...validTs)) : new Date();
  const year = anchor.getUTCFullYear();
  const startTs = Date.UTC(year, 0, 1, 0, 0, 0, 0);
  const endTs = Date.UTC(year, 11, 31, 23, 59, 59, 999);
  return { year, startTs, endTs };
}

function pctOnSeason(ts, startTs, endTs) {
  if (!Number.isFinite(ts) || !Number.isFinite(startTs) || !Number.isFinite(endTs) || endTs <= startTs) return 0;
  const p = ((ts - startTs) / (endTs - startTs)) * 100;
  return Math.max(0, Math.min(100, p));
}

function collectMilestoneEvents(seriesMap, rosterOrder = []) {
  const events = [];
  const ids = playerIdsOrdered(seriesMap, rosterOrder);
  const dayFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

  for (const riotId of ids) {
    const name = safeName(riotId);
    const qs = seriesMap.get(riotId) || {};

    for (const queue of ["SOLO", "FLEX"]) {
      const series = (qs[queue] || []).slice().sort((a, b) => (a.snapshotTs || 0) - (b.snapshotTs || 0));
      if (!series.length) continue;

      const first = series[0];
      const firstIdx = Number(first?.rankIndex);
      if (Number.isFinite(firstIdx) && firstIdx >= 0) {
        const firstFloor = Math.floor(firstIdx);
        const firstTs = Number.isFinite(first?.snapshotTs) ? first.snapshotTs : first?.snapshotDate?.getTime?.() ?? 0;
        const firstDate = first?.snapshotDate ? dayFmt.format(first.snapshotDate) : (first?.snapshotDateStr || "—");
        events.push({
          riotId,
          name,
          queue,
          ts: firstTs,
          rankFloor: firstFloor,
          rankLabel: rankLabelWithFallback(first, firstFloor),
          kind: "placement",
          kindLabel: "Placed",
          dateLabel: firstDate,
        });
      }

      for (let i = 1; i < series.length; i++) {
        const prev = series[i - 1];
        const cur = series[i];

        const prevIdx = Number(prev?.rankIndex);
        const curIdx = Number(cur?.rankIndex);
        if (!Number.isFinite(curIdx) || curIdx < 0) continue;

        const prevFloor = Number.isFinite(prevIdx) && prevIdx >= 0 ? Math.floor(prevIdx) : -1;
        const curFloor = Math.floor(curIdx);
        if (curFloor <= prevFloor) continue;

        const ts = Number.isFinite(cur?.snapshotTs) ? cur.snapshotTs : cur?.snapshotDate?.getTime?.() ?? 0;
        const dateStr = cur?.snapshotDate ? dayFmt.format(cur.snapshotDate) : (cur?.snapshotDateStr || "—");

        // First ranked appearance in this queue: capture one placement event.
        if (prevFloor < 0) {
          events.push({
            riotId,
            name,
            queue,
            ts,
            rankFloor: curFloor,
            rankLabel: rankLabelWithFallback(cur, curFloor),
            kind: "placement",
            kindLabel: "Placed",
            dateLabel: dateStr,
          });
          continue;
        }

        for (let floor = prevFloor + 1; floor <= curFloor; floor++) {
          const fromTier = Math.floor((floor - 1) / 4);
          const toTier = Math.floor(floor / 4);
          const isTierUp = toTier > fromTier;
          const atTop = floor === curFloor;

          events.push({
            riotId,
            name,
            queue,
            ts,
            rankFloor: floor,
            rankLabel: atTop ? rankLabelWithFallback(cur, floor) : rankLabelFromFloor(floor),
            kind: isTierUp ? "tier" : "division",
            kindLabel: isTierUp ? "Tier Up" : "Division Up",
            dateLabel: dateStr,
          });
        }
      }
    }
  }

  events.sort((a, b) => (a.ts || 0) - (b.ts || 0));
  return events;
}

function normalizeMilestoneFilters(filters = {}) {
  const queue = filters.queue === "SOLO" || filters.queue === "FLEX" ? filters.queue : "all";
  const kind =
    filters.kind === "tier" || filters.kind === "division" || filters.kind === "placement"
      ? filters.kind
      : "all";
  const player = filters.player && filters.player !== "all" ? String(filters.player) : "all";
  return { queue, kind, player };
}

function applyMilestoneFilters(events, filters) {
  const f = normalizeMilestoneFilters(filters);
  return (events || []).filter((e) => {
    if (f.queue !== "all" && e.queue !== f.queue) return false;
    if (f.kind !== "all" && e.kind !== f.kind) return false;
    if (f.player !== "all" && e.riotId !== f.player) return false;
    return true;
  });
}

function filterSummaryText(filters, playerNameById) {
  const f = normalizeMilestoneFilters(filters);
  const q = f.queue === "all" ? "all queues" : f.queue;
  const k =
    f.kind === "all"
      ? "all milestone types"
      : f.kind === "tier"
      ? "tier-ups"
      : f.kind === "division"
      ? "division-ups"
      : "placements";
  const p = f.player === "all" ? "all players" : (playerNameById.get(f.player) || safeName(f.player));
  return `${q} · ${k} · ${p}`;
}

function milestonePill(attr, value, label, { active = false, flavor = "" } = {}) {
  const cls = [
    "lp-filter-pill",
    flavor ? `lp-filter-pill--${flavor}` : "",
    active ? "lp-filter-pill--active" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return `<button type="button" class="${cls}" ${attr}="${escHtml(value)}" aria-pressed="${active ? "true" : "false"}">${escHtml(label)}</button>`;
}

function buildMilestoneFiltersHtml(orderedPlayers, filters) {
  const f = normalizeMilestoneFilters(filters);
  return `
    <div class="lp-miles-filters">
      <div class="lp-filter-row">
        ${milestonePill("data-mq", "all", "All queues", { active: f.queue === "all" })}
        ${milestonePill("data-mq", "SOLO", "SOLO", { active: f.queue === "SOLO", flavor: "solo" })}
        ${milestonePill("data-mq", "FLEX", "FLEX", { active: f.queue === "FLEX", flavor: "flex" })}
      </div>
      <div class="lp-filter-row">
        ${milestonePill("data-mk", "all", "All milestones", { active: f.kind === "all" })}
        ${milestonePill("data-mk", "tier", "Tier Ups", { active: f.kind === "tier" })}
        ${milestonePill("data-mk", "division", "Division Ups", { active: f.kind === "division" })}
        ${milestonePill("data-mk", "placement", "Placements", { active: f.kind === "placement" })}
      </div>
      <div class="lp-filter-row">
        ${milestonePill("data-mp", "all", "All players", { active: f.player === "all" })}
        ${orderedPlayers
          .map((id) =>
            milestonePill("data-mp", id, safeName(id), {
              active: f.player === id,
            })
          )
          .join("")}
      </div>
    </div>
  `;
}

function buildMilestonesTimeline(seriesMap, rows, rosterOrder = [], filters = {}) {
  const { year, startTs, endTs } = seasonWindowFromRows(rows);
  const allEvents = collectMilestoneEvents(seriesMap, rosterOrder);
  const f = normalizeMilestoneFilters(filters);
  const events = applyMilestoneFilters(allEvents, f);
  const orderedPlayers = playerIdsOrdered(seriesMap, rosterOrder);
  const playerNameById = new Map(orderedPlayers.map((id) => [id, safeName(id)]));
  const filterSummary = filterSummaryText(f, playerNameById);
  const filtersHtml = buildMilestoneFiltersHtml(orderedPlayers, f);

  if (!allEvents.length) {
    return `
      <div class="lp-miles-shell">
        <div class="lp-miles-head">
          <div>
            <div class="lp-miles-title">Season ${year} Milestones</div>
            <div class="lp-miles-sub">Jan to Dec timeline for rank/division progression.</div>
          </div>
          <div class="lp-miles-counts">
            <span class="lp-miles-chip">No milestone events yet</span>
          </div>
        </div>
        ${filtersHtml}
      </div>
    `;
  }

  if (!events.length) {
    return `
      <div class="lp-miles-shell">
        <div class="lp-miles-head">
          <div>
            <div class="lp-miles-title">Season ${year} Milestones</div>
            <div class="lp-miles-sub">Every division and tier-up plotted from January through December.</div>
          </div>
          <div class="lp-miles-counts">
            <span class="lp-miles-chip">0 shown</span>
            <span class="lp-miles-chip">${allEvents.length} total</span>
          </div>
        </div>
        ${filtersHtml}
        <div class="text-[0.72rem] text-slate-500 py-2 px-1">
          No events match the current filters: <span class="font-semibold text-slate-700">${escHtml(filterSummary)}</span>
        </div>
      </div>
    `;
  }

  const monthFmt = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });
  const months = [];
  for (let m = 0; m < 12; m++) {
    const ts = Date.UTC(year, m, 1, 0, 0, 0, 0);
    months.push({
      label: monthFmt.format(new Date(ts)),
      pct: pctOnSeason(ts, startTs, endTs),
    });
  }

  const laneCount = Math.min(8, Math.max(4, Math.ceil(events.length / 9)));
  const boardHeight = 128 + laneCount * 56;
  const boardWidth = Math.max(860, 860 + Math.max(0, events.length - 14) * 16);
  const minGapPct = Math.max(3.6, 8.3 - laneCount * 0.48);
  const laneLastPct = new Array(laneCount).fill(-1000);
  const laidOut = [];

  for (const ev of events) {
    const pct = pctOnSeason(ev.ts, startTs, endTs);
    let lane = 0;
    let picked = false;
    for (let l = 0; l < laneCount; l++) {
      if (pct - laneLastPct[l] >= minGapPct) {
        lane = l;
        picked = true;
        break;
      }
    }
    if (!picked) {
      lane = laneLastPct.indexOf(Math.min(...laneLastPct));
    }
    laneLastPct[lane] = pct;
    laidOut.push({ ...ev, pct, lane, top: 78 + lane * 56 });
  }

  const tierCount = events.filter((x) => x.kind === "tier").length;
  const divCount = events.filter((x) => x.kind === "division").length;
  const placeCount = events.filter((x) => x.kind === "placement").length;
  const todayPct = pctOnSeason(Date.now(), startTs, endTs);

  const monthHtml = months
    .map((m) => `<div class="lp-miles-month" style="left:${m.pct}%">${m.label}</div><div class="lp-miles-tick" style="left:${m.pct}%"></div>`)
    .join("");

  const eventsHtml = laidOut
    .map((ev, idx) => {
      const queueCls = queueClass(ev.queue);
      const dotQueueClass =
        ev.queue === "SOLO"
          ? "lp-dotg--solo"
          : ev.queue === "FLEX"
          ? "lp-dotg--flex"
          : "lp-dotg--unranked";
      const kindCls =
        ev.kind === "tier"
          ? "lp-miles-event--tier"
          : ev.kind === "division"
          ? "lp-miles-event--division"
          : "lp-miles-event--placement";
      const delay = `${Math.min(1.2, idx * 0.04).toFixed(2)}s`;

      return `
        <article class="lp-miles-event lp-miles-event--${queueCls} ${kindCls}" style="left:${ev.pct.toFixed(3)}%; top:${ev.top}px; animation-delay:${delay};">
          <div class="lp-miles-dot-wrap">
            <svg class="lp-miles-dot lp-dotg ${dotQueueClass}" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" aria-hidden="true" style="animation-delay:${delay};">
              <circle class="ring" cx="12" cy="12" r="11"></circle>
              <circle class="main" cx="12" cy="12" r="9"></circle>
              <text class="initials" x="12" y="12">${escHtml(initials(ev.name))}</text>
            </svg>
          </div>
          <div class="lp-miles-rank">${escHtml(ev.rankLabel)}</div>
          <div class="lp-miles-date">${escHtml(ev.dateLabel)}</div>
        </article>
      `;
    })
    .join("");

  return `
    <div class="lp-miles-shell">
      <div class="lp-miles-head">
        <div>
          <div class="lp-miles-title">Season ${year} Milestones</div>
          <div class="lp-miles-sub">Every division and tier-up plotted from January through December.</div>
        </div>
        <div class="lp-miles-counts">
          <span class="lp-miles-chip">${events.length} shown</span>
          <span class="lp-miles-chip">${allEvents.length} total</span>
          <span class="lp-miles-chip">${tierCount} tier-ups</span>
          <span class="lp-miles-chip">${divCount} division-ups</span>
          <span class="lp-miles-chip">${placeCount} placements</span>
        </div>
      </div>
      ${filtersHtml}

      <div class="lp-miles-scroll">
        <div class="lp-miles-board" style="min-width:${boardWidth}px; height:${boardHeight}px;">
          ${monthHtml}
          <div class="lp-miles-track"></div>
          <div class="lp-miles-today" style="left:${todayPct.toFixed(3)}%"></div>
          ${eventsHtml}
        </div>
      </div>

      <div class="lp-miles-foot">
        <div>Milestones use rank-index division crossings (upward only).</div>
        <div>${escHtml(filterSummary)}</div>
        <div>Track spans Jan 1, ${year} to Dec 31, ${year}.</div>
      </div>
    </div>
  `;
}

export async function mountLpProgressModule(
  mountEl,
  { csvUrl, rosterOrder = [], unlockInDays = 0, title = "LP Progression (SOLO + FLEX)" } = {}
) {
  injectStylesOnce();
  if (!mountEl) return;

  mountEl.classList.add("dashboard-card");
  mountEl.innerHTML = `
    <div class="card-header">
      <div>
        <div class="card-title">${title}</div>
        <div class="card-subtitle">Highlights, rank map, and season milestones.</div>
      </div>
    </div>
    <div class="text-xs text-slate-500 mt-2">Loading…</div>
  `;

  if (unlockInDays > 0) {
    renderLocked(mountEl, unlockInDays);
    return;
  }

  let rows = [];
  try {
    rows = await loadLpRows({ csvUrl });
  } catch (e) {
    mountEl.innerHTML = `
      <div class="card-header">
        <div>
          <div class="card-title">LP Progression</div>
          <div class="card-subtitle">Couldn’t load LP data</div>
        </div>
      </div>
      <div class="text-xs text-slate-500 mt-2">${String(e?.message ?? e)}</div>
    `;
    return;
  }

  const seriesMap = groupSeries(rows);
  const { bestRun, bestStreak, bestDrop } = computeHighlights(seriesMap);
  const { svg } = buildRankMapSvg(seriesMap, rosterOrder);

  mountEl.innerHTML = "";

  mountEl.appendChild(
    el(
      "div",
      "mb-3",
      `
      <div class="text-sm font-bold text-slate-900">${title}</div>
      <div class="text-[0.72rem] text-slate-500">Top cards, a rank map, and milestone timeline through December.</div>
      <div class="mt-2 flex flex-wrap gap-2">
        <span class="lp-pill lp-pill--solo">SOLO</span>
        <span class="lp-pill lp-pill--flex">FLEX</span>
        <span class="lp-pill">RankPts = rankIndex × 100</span>
      </div>
      `
    )
  );

  const grid = el("div", "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3");
  mountEl.appendChild(grid);

  const mkCard = (kicker, value, subHtml) => {
    const c = el("div", "lp-stat-card");
    c.appendChild(el("div", "lp-stat-kicker", kicker));
    c.appendChild(el("div", "lp-stat-value", value));
    c.appendChild(el("div", "lp-stat-sub", subHtml));
    return c;
  };

  if (bestRun) {
    grid.appendChild(
      mkCard(
        "Most points won before a drop",
        `+${bestRun.gain}`,
        `<span class="lp-pill ${bestRun.queue === "SOLO" ? "lp-pill--solo" : "lp-pill--flex"}">${bestRun.queue}</span>
         <span class="ml-2 font-bold text-slate-700">${safeName(bestRun.riotId)}</span>
         <div class="mt-1 text-slate-500">From ${bestRun.start?.snapshotDateStr || "—"} to ${bestRun.end?.snapshotDateStr || "—"}</div>`
      )
    );
  } else {
    grid.appendChild(mkCard("Most points won before a drop", "—", "Need at least 2 ranked snapshots."));
  }

  if (bestStreak) {
    grid.appendChild(
      mkCard(
        "Longest “up” streak",
        `${bestStreak.len} step(s)`,
        `<span class="lp-pill ${bestStreak.queue === "SOLO" ? "lp-pill--solo" : "lp-pill--flex"}">${bestStreak.queue}</span>
         <span class="ml-2 font-bold text-slate-700">${safeName(bestStreak.riotId)}</span>
         <div class="mt-1 text-slate-500">Net +${bestStreak.gain} from ${bestStreak.start?.snapshotDateStr || "—"} → ${bestStreak.end?.snapshotDateStr || "—"}</div>`
      )
    );
  } else {
    grid.appendChild(mkCard("Longest “up” streak", "—", "Need at least 2 ranked snapshots."));
  }

  if (bestDrop) {
    const fromRank = bestDrop.from?.currentRank || "—";
    const toRank = bestDrop.to?.currentRank || "—";
    grid.appendChild(
      mkCard(
        "Biggest fall",
        `${fmtPts(bestDrop.drop)} pts`,
        `<span class="lp-pill ${bestDrop.queue === "SOLO" ? "lp-pill--solo" : "lp-pill--flex"}">${bestDrop.queue}</span>
         <span class="ml-2 font-bold text-slate-700">${safeName(bestDrop.riotId)}</span>
         <div class="mt-1 text-slate-500">${fromRank} → ${toRank}</div>`
      )
    );
  } else {
    grid.appendChild(mkCard("Biggest fall", "—", "Need at least 2 ranked snapshots."));
  }

  const mapWrap = el("div", "mt-3");
  mapWrap.innerHTML = svg;
  mountEl.appendChild(mapWrap);

  const milestonesWrap = el("div", "mt-3");
  mountEl.appendChild(milestonesWrap);

  const filters = { queue: "all", kind: "tier", player: "all" };

  const rerenderMilestones = () => {
    milestonesWrap.innerHTML = buildMilestonesTimeline(seriesMap, rows, rosterOrder, filters);
  };

  milestonesWrap.addEventListener("click", (ev) => {
    const qBtn = ev.target?.closest?.("button[data-mq]");
    if (qBtn && milestonesWrap.contains(qBtn)) {
      const v = qBtn.getAttribute("data-mq") || "all";
      filters.queue = v === "SOLO" || v === "FLEX" ? v : "all";
      rerenderMilestones();
      return;
    }

    const kBtn = ev.target?.closest?.("button[data-mk]");
    if (kBtn && milestonesWrap.contains(kBtn)) {
      const v = kBtn.getAttribute("data-mk") || "all";
      filters.kind = v === "tier" || v === "division" || v === "placement" ? v : "all";
      rerenderMilestones();
      return;
    }

    const pBtn = ev.target?.closest?.("button[data-mp]");
    if (pBtn && milestonesWrap.contains(pBtn)) {
      const v = pBtn.getAttribute("data-mp") || "all";
      filters.player = v && v !== "all" ? v : "all";
      rerenderMilestones();
    }
  });

  rerenderMilestones();
}
