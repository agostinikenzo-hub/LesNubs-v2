// /components/lpTimelineModule.js
import { loadLpRows } from "../core/lpData.js";
import { mountUnlockableCard } from "./lockedFeatureCard.js";

/**
 * LP Timeline (Rank over time)
 * - Smooth lines
 * - Cohesive 7-color palette (stable per player)
 * - SOLO solid, FLEX dashed
 * - Minimal dots (focus: all snapshots | all-players: only latest dot)
 * - Player color chips legend
 * - Unlock gating (unlockInDays)
 * - Replay reliably re-triggers draw animation (JS-based)
 * - ✅ Weekly toggle: downsample to “last snapshot of each week” per player+queue
 *
 * Mount:
 *   await mountLpTimelineModule(mountEl, { csvUrl, rosterOrder, title, unlockInDays, defaultMode, defaultFocus, defaultWeekly })
 */

function el(tag, cls, html) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
}

function injectStylesOnce() {
  if (document.getElementById("lp-timeline-styles")) return;
  const style = document.createElement("style");
  style.id = "lp-timeline-styles";
  style.textContent = `
    .lpTL-shell {
      border: 1px solid rgba(148,163,184,0.30);
      border-radius: 1.5rem;
      background: rgba(255,255,255,0.68);
      backdrop-filter: blur(10px);
      box-shadow: 0 12px 30px rgba(15,23,42,0.05);
      padding: 1.0rem 1.0rem 1.1rem;
      overflow: hidden;
      position: relative;
    }

    .lpTL-head {
      display:flex;
      align-items:flex-start;
      justify-content:space-between;
      gap: 1rem;
      margin-bottom: 0.8rem;
    }

    .lpTL-title {
      font-size: 0.95rem;
      font-weight: 900;
      color: #0f172a;
      letter-spacing: -0.01em;
    }
    .lpTL-sub {
      font-size: 0.72rem;
      color: rgba(100,116,139,0.95);
      margin-top: 0.25rem;
      line-height: 1.25;
    }

    .lpTL-controls {
      display:flex;
      flex-direction:column;
      align-items:flex-end;
      gap: 0.45rem;
      min-width: 240px;
    }

    .lpTL-pillrow {
      display:flex;
      gap: 0.4rem;
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    .lpTL-pill {
      border: 1px solid rgba(148,163,184,0.32);
      background: rgba(255,255,255,0.68);
      color: rgba(15,23,42,0.80);
      border-radius: 999px;
      font-size: 0.68rem;
      font-weight: 900;
      padding: 0.3rem 0.7rem;
      cursor: pointer;
      user-select: none;
      transition: transform .12s ease, border-color .12s ease, background .12s ease;
      white-space: nowrap;
    }
    .lpTL-pill:hover { transform: translateY(-1px); border-color: rgba(231,175,178,0.55); }
    .lpTL-pill.is-on {
      border-color: rgba(231,175,178,0.70);
      background: rgba(231,175,178,0.14);
      color: #ff8000;
    }

    .lpTL-selectrow {
      display:flex;
      align-items:center;
      gap: 0.55rem;
      font-size: 0.72rem;
      color: rgba(100,116,139,0.95);
      font-weight: 800;
      white-space: nowrap;
    }
    .lpTL-selectrow select {
      border: 1px solid rgba(148,163,184,0.32);
      background: rgba(255,255,255,0.78);
      border-radius: 0.9rem;
      padding: 0.35rem 0.65rem;
      font-size: 0.72rem;
      font-weight: 800;
      color: rgba(15,23,42,0.85);
      outline: none;
      min-width: 190px;
    }

    .lpTL-legend {
      display:flex;
      gap: 0.5rem;
      flex-wrap: wrap;
      margin: 0.25rem 0 0.55rem;
    }

    .lpTL-chip {
      display:inline-flex;
      align-items:center;
      gap: 6px;
      padding: 0.22rem 0.6rem;
      border-radius: 999px;
      font-size: 0.65rem;
      font-weight: 900;
      border: 1px solid rgba(148,163,184,0.30);
      background: rgba(255,255,255,0.72);
      color: rgba(15,23,42,0.76);
      white-space: nowrap;
    }
    .lpTL-dot {
      display:inline-block;
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: rgba(15,23,42,0.20);
    }
    .lpTL-dot--solo { background: rgba(255,128,0,0.92); }
    .lpTL-dot--flex { background: rgba(59,130,246,0.92); }

    /* 👇 Player color chips legend */
    .lpTL-plLegend {
      display:flex;
      flex-wrap: wrap;
      gap: 0.35rem;
      margin: 0 0 0.85rem;
    }
    .lpTL-plChip {
      display:inline-flex;
      align-items:center;
      gap: 6px;
      padding: 0.16rem 0.52rem;
      border-radius: 999px;
      border: 1px solid rgba(148,163,184,0.26);
      background: rgba(255,255,255,0.68);
      color: rgba(15,23,42,0.78);
      font-size: 0.62rem;
      font-weight: 900;
      line-height: 1;
      max-width: 160px;
    }
    .lpTL-plSwatch {
      width: 10px;
      height: 10px;
      border-radius: 999px;
      box-shadow: 0 0 0 2px rgba(255,255,255,0.78);
      flex: 0 0 auto;
    }
    .lpTL-plName {
      overflow:hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .lpTL-svg {
      width: 100%;
      height: 320px;
      display:block;
    }

    .lpTL-grid { stroke: rgba(15,23,42,0.045); stroke-width: 1; }
    .lpTL-axis { stroke: rgba(15,23,42,0.09); stroke-width: 1; }
    .lpTL-label {
      fill: rgba(100,116,139,0.84);
      font-size: 10px;
      font-weight: 900;
    }

    .lpTL-baseline {
      stroke: rgba(15,23,42,0.14);
      stroke-dasharray: 4 7;
      stroke-width: 1;
    }
    .lpTL-baselineText {
      fill: rgba(100,116,139,0.68);
      font-size: 9px;
      font-weight: 900;
      letter-spacing: 0.02em;
      text-transform: uppercase;
    }

    /* Slicker paths */
    .lpTL-path {
      fill: none;
      stroke-width: 2.05;
      stroke-linecap: round;
      stroke-linejoin: round;
      opacity: 0.90;
      filter: drop-shadow(0 8px 12px rgba(15,23,42,0.05));
      transition: opacity .12s ease;
    }
    .lpTL-path.flex { opacity: 0.74; } /* dash applied via JS after draw */
    .lpTL-path.dim { opacity: 0.10; }

    /* Minimal dots */
    .lpTL-dotg { opacity: 0.92; transition: opacity .12s ease, transform .12s ease; transform-origin: center; }
    .lpTL-dotg.dim { opacity: 0.10; }
    .lpTL-point {
      stroke: rgba(255,255,255,0.85);
      stroke-width: 1.15;
      filter: none;
    }
    .lpTL-dotg:hover { transform: scale(1.06); }
  `;
  document.head.appendChild(style);
}

function safeName(riotId) {
  return String(riotId || "—").split("#")[0].trim() || String(riotId || "—");
}

function rankPts(rankIndex) {
  const x = Number(rankIndex);
  if (!Number.isFinite(x)) return null;
  if (x < 0) return 0; // UNRANKED baseline
  return Math.round(x * 100);
}

// 🎨 Updated cohesive 7-color palette (your picks)
const PLAYER_PALETTE = ["#A8F3D5", "#FD8E20", "#F3E112", "#CE221B", "#216496", "#D2F4FE", "#290519"];

function playerColorByIndex(i) {
  const idx = Number(i);
  if (!Number.isFinite(idx)) return PLAYER_PALETTE[0];
  return PLAYER_PALETTE[((idx % PLAYER_PALETTE.length) + PLAYER_PALETTE.length) % PLAYER_PALETTE.length];
}

function fmtDateShort(d) {
  if (!(d instanceof Date) || isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/** Smooth path using Catmull-Rom -> Bezier conversion */
function smoothPath(points) {
  if (!points || points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  const p = points;
  let d = `M ${p[0].x} ${p[0].y}`;

  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] || p[i];
    const p1 = p[i];
    const p2 = p[i + 1];
    const p3 = p[i + 2] || p2;

    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }

  return d;
}

function buildSeries(rows) {
  const map = new Map(); // riotId -> { SOLO: [], FLEX: [] }
  for (const r of rows) {
    if (!r.riotId) continue;
    if (!map.has(r.riotId)) map.set(r.riotId, { SOLO: [], FLEX: [] });
    if (r.queue === "SOLO") map.get(r.riotId).SOLO.push(r);
    if (r.queue === "FLEX") map.get(r.riotId).FLEX.push(r);
  }
  for (const [id, qs] of map.entries()) {
    qs.SOLO.sort((a, b) => (a.snapshotDate?.getTime?.() ?? 0) - (b.snapshotDate?.getTime?.() ?? 0));
    qs.FLEX.sort((a, b) => (a.snapshotDate?.getTime?.() ?? 0) - (b.snapshotDate?.getTime?.() ?? 0));
    map.set(id, qs);
  }
  return map;
}

/* ==========================
   ✅ Weekly downsample helpers
   - Week starts Monday (local time)
   - Keep the LAST snapshot in each week
   ========================== */

function weekKeyLocal(d) {
  if (!(d instanceof Date) || isNaN(d.getTime())) return null;
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  // Monday = 0 ... Sunday = 6
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  const yy = x.getFullYear();
  const mm = String(x.getMonth() + 1).padStart(2, "0");
  const dd = String(x.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`; // week start date
}

function downsampleWeekly(series = []) {
  if (!Array.isArray(series) || series.length <= 1) return series.slice();
  const out = [];

  let curKey = null;
  let last = null;

  for (const r of series) {
    const t = r?.snapshotDate;
    const k = weekKeyLocal(t);
    if (!k) continue;

    if (curKey == null) curKey = k;

    if (k !== curKey) {
      if (last) out.push(last);
      curKey = k;
      last = r;
    } else {
      last = r; // keep updating, so we end with last snapshot of the week
    }
  }

  if (last) out.push(last);
  return out;
}

function buildWeeklySeriesMap(seriesMap) {
  const out = new Map();
  for (const [id, qs] of seriesMap.entries()) {
    out.set(id, {
      SOLO: downsampleWeekly(qs?.SOLO || []),
      FLEX: downsampleWeekly(qs?.FLEX || []),
    });
  }
  return out;
}

function domainFrom(allPoints) {
  const xs = allPoints.map((p) => p.t).filter(Number.isFinite);
  const ys = allPoints.map((p) => p.v).filter(Number.isFinite);

  let t0 = xs.length ? Math.min(...xs) : Date.now() - 86400000;
  let t1 = xs.length ? Math.max(...xs) : Date.now();

  if (t0 === t1) {
    t0 -= 86400000;
    t1 += 86400000;
  } else {
    const pad = Math.round((t1 - t0) * 0.08);
    t0 -= pad;
    t1 += pad;
  }

  let v0 = ys.length ? Math.min(...ys, 0) : 0;
  let v1 = ys.length ? Math.max(...ys, 0) : 100;

  const span = Math.max(40, v1 - v0);
  const padV = Math.round(span * 0.18);
  v0 -= padV;
  v1 += padV;

  v0 = Math.max(-40, v0);
  return { t0, t1, v0, v1 };
}

function scaleX(t, t0, t1, x0, x1) {
  if (t1 === t0) return (x0 + x1) * 0.5;
  const u = (t - t0) / (t1 - t0);
  return x0 + u * (x1 - x0);
}

function scaleY(v, v0, v1, y0, y1) {
  if (v1 === v0) return (y0 + y1) * 0.5;
  const u = (v - v0) / (v1 - v0);
  return y1 - u * (y1 - y0);
}

function render(mountEl, state) {
  const { title, mode, focusRiotId, rosterOrder } = state;

  // ✅ choose raw vs weekly series map
  const seriesMap = state.weekly ? state.seriesMapWeekly : state.seriesMapRaw;

  const players = [...seriesMap.keys()];
  const order = rosterOrder.map((x) => String(x).trim());

  players.sort((a, b) => {
    const sa = safeName(a);
    const sb = safeName(b);
    const ia = order.indexOf(sa);
    const ib = order.indexOf(sb);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return sa.localeCompare(sb);
  });

  // Stable color mapping based on sorted players list
  const colorById = new Map();
  players.forEach((id, i) => colorById.set(id, playerColorByIndex(i)));

  const visiblePlayers = focusRiotId ? players.filter((p) => p === focusRiotId) : players;

  // collect points for domain
  const allPts = [];
  for (const riotId of visiblePlayers) {
    const qs = seriesMap.get(riotId);
    for (const q of ["SOLO", "FLEX"]) {
      if (mode !== "BOTH" && mode !== q) continue;
      const series = qs?.[q] || [];
      for (const r of series) {
        const t = r.snapshotDate?.getTime?.() ?? null;
        if (t == null) continue;
        allPts.push({ t, v: rankPts(r.rankIndex) });
      }
    }
  }

  const { t0, t1, v0, v1 } = domainFrom(allPts);

  const W = 1100;
  const H = 320;

  const pad = { l: 24, r: 18, t: 56, b: 40 };
  const x0 = pad.l;
  const x1 = W - pad.r;
  const y0 = pad.t;
  const y1 = H - pad.b;

  const baselineY = scaleY(0, v0, v1, y0, y1);

  // smoothing helper
  const spanT = Math.max(1, t1 - t0);
  const maxBackMs = Math.min(14 * 86400000, Math.max(1 * 86400000, Math.round(spanT * 0.12)));

  // ticks
  const grid = [];
  const xTicks = 5;
  for (let i = 0; i <= xTicks; i++) {
    const x = x0 + (i / xTicks) * (x1 - x0);
    grid.push(`<line class="lpTL-grid" x1="${x}" y1="${y0}" x2="${x}" y2="${y1}" />`);
  }
  const yTicks = 4;
  for (let i = 0; i <= yTicks; i++) {
    const y = y0 + (i / yTicks) * (y1 - y0);
    grid.push(`<line class="lpTL-grid" x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" />`);
  }

  const startDate = new Date(t0);
  const endDate = new Date(t1);

  const paths = [];
  const dots = [];

  const showAllDots = !!focusRiotId; // focus: all snapshots; all: only latest dot
  const dotR = showAllDots ? 2.35 : 2.85;

  for (const riotId of visiblePlayers) {
    const name = safeName(riotId);
    const col = colorById.get(riotId) || PLAYER_PALETTE[0];
    const qs = seriesMap.get(riotId) || { SOLO: [], FLEX: [] };

    for (const q of ["SOLO", "FLEX"]) {
      if (mode !== "BOTH" && mode !== q) continue;
      const series = qs[q] || [];
      if (!series.length) continue;

      const ptsActual = series
        .map((r) => {
          const t = r.snapshotDate?.getTime?.();
          if (!Number.isFinite(t)) return null;
          const v = rankPts(r.rankIndex);
          if (v == null) return null;
          return { x: scaleX(t, t0, t1, x0, x1), y: scaleY(v, v0, v1, y0, y1), t, v, r };
        })
        .filter(Boolean);

      if (ptsActual.length < 1) continue;

      const ptsLine = ptsActual.slice();

      // baseline smooth start (synthetic point, no dot)
      if (ptsLine[0].v > 0) {
        const firstT = ptsLine[0].t;
        let synthT = focusRiotId ? t0 : Math.max(t0, firstT - maxBackMs);
        if (synthT >= firstT) synthT = Math.max(t0, firstT - 1);

        ptsLine.unshift({ x: scaleX(synthT, t0, t1, x0, x1), y: baselineY, t: synthT, v: 0, r: null });
      }

      const d = smoothPath(ptsLine);
      const cls = q === "FLEX" ? "lpTL-path flex" : "lpTL-path";

      paths.push(`
        <path class="${cls}" data-riotid="${esc(riotId)}" data-queue="${q}" style="stroke:${col};" d="${d}">
          <title>${esc(name)} — ${q}</title>
        </path>
      `);

      const dotPoints = showAllDots ? ptsActual : [ptsActual[ptsActual.length - 1]];
      for (const p of dotPoints) {
        const dateStr = fmtDateShort(new Date(p.t));
        const rankLabel = p.r?.currentRank || (p.v === 0 ? "UNRANKED" : "");
        const lp = Number(p.r?.lp ?? 0);
        const tip = `${name} — ${q}\n${dateStr}\n${rankLabel}${p.v === 0 ? "" : ` · ${lp} LP`}`;

        dots.push(`
          <g class="lpTL-dotg" data-riotid="${esc(riotId)}" data-queue="${q}">
            <circle class="lpTL-point" cx="${p.x}" cy="${p.y}" r="${dotR}" fill="${col}">
              <title>${esc(tip)}</title>
            </circle>
          </g>
        `);
      }
    }
  }

  const focusName = focusRiotId ? safeName(focusRiotId) : "All players";

  mountEl.innerHTML = "";
  mountEl.classList.add("dashboard-card");

  const shell = el("div", "lpTL-shell");
  mountEl.appendChild(shell);

  const head = el("div", "lpTL-head");
  head.appendChild(
    el(
      "div",
      "",
      `
        <div class="lpTL-title">${esc(title || "LP Timeline (Rank over time)")}</div>
        <div class="lpTL-sub">
          Tip: hover a line to highlight it. In all-players view, dots only show the latest snapshot (cleaner).
          ${state.weekly ? `<span style="font-weight:900; color:#0f172a;"> Weekly smoothing is ON.</span>` : ""}
        </div>
      `
    )
  );

  const controls = el("div", "lpTL-controls");
  const pillRow = el("div", "lpTL-pillrow");

  const mkPill = (label, value) => {
    const b = el("button", "lpTL-pill" + (state.mode === value ? " is-on" : ""), label);
    b.addEventListener("click", () => {
      state.mode = value;
      render(mountEl, state);
      state._animateReplay?.();
    });
    return b;
  };

  // ✅ Weekly toggle pill (small chip)
  const weeklyPill = el("button", "lpTL-pill" + (state.weekly ? " is-on" : ""), "Weekly");
  weeklyPill.title = "Weekly smoothing (keeps the last snapshot of each week)";
  weeklyPill.addEventListener("click", () => {
    state.weekly = !state.weekly;
    render(mountEl, state);
    state._animateReplay?.();
  });

  pillRow.appendChild(mkPill("Both", "BOTH"));
  pillRow.appendChild(mkPill("Solo", "SOLO"));
  pillRow.appendChild(mkPill("Flex", "FLEX"));
  pillRow.appendChild(weeklyPill);

  const replayBtn = el("button", "lpTL-pill", "Replay");
  replayBtn.addEventListener("click", () => state._animateReplay?.());
  pillRow.appendChild(replayBtn);

  controls.appendChild(pillRow);

  const selectRow = el("div", "lpTL-selectrow");
  selectRow.appendChild(el("div", "", "Focus"));

  const sel = el("select", "");
  const optAll = el("option", "", "All players");
  optAll.value = "";
  sel.appendChild(optAll);

  for (const riotId of players) {
    const o = el("option", "", safeName(riotId));
    o.value = riotId;
    if (riotId === focusRiotId) o.selected = true;
    sel.appendChild(o);
  }

  sel.addEventListener("change", () => {
    state.focusRiotId = sel.value || "";
    render(mountEl, state);
    state._animateReplay?.();
  });

  selectRow.appendChild(sel);
  controls.appendChild(selectRow);

  head.appendChild(controls);
  shell.appendChild(head);

  const legend = el(
    "div",
    "lpTL-legend",
    `
      <span class="lpTL-chip"><span class="lpTL-dot lpTL-dot--solo"></span> SOLO = solid</span>
      <span class="lpTL-chip"><span class="lpTL-dot lpTL-dot--flex"></span> FLEX = dashed</span>
      <span class="lpTL-chip">UNRANKED pinned at baseline</span>
      <span class="lpTL-chip">Focus: <span style="font-weight:900; color:#0f172a;">${esc(focusName)}</span></span>
      <span class="lpTL-chip">Granularity: <span style="font-weight:900; color:#0f172a;">${state.weekly ? "Weekly (last snapshot)" : "All snapshots"}</span></span>
    `
  );
  shell.appendChild(legend);

  // ✅ Player color chips legend
  const idsForLegend = focusRiotId ? visiblePlayers : players;
  const playerLegend = el(
    "div",
    "lpTL-plLegend",
    idsForLegend
      .map((id) => {
        const n = safeName(id);
        const c = colorById.get(id) || PLAYER_PALETTE[0];
        return `
          <span class="lpTL-plChip" title="${esc(n)}">
            <span class="lpTL-plSwatch" style="background:${c};"></span>
            <span class="lpTL-plName">${esc(n)}</span>
          </span>
        `;
      })
      .join("")
  );
  shell.appendChild(playerLegend);

  const wrap = el("div", "");
  wrap.innerHTML = `
    <svg class="lpTL-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="LP timeline">
      ${grid.join("")}
      <line class="lpTL-axis" x1="${x0}" y1="${y1}" x2="${x1}" y2="${y1}"></line>
      <line class="lpTL-axis" x1="${x0}" y1="${y0}" x2="${x0}" y2="${y1}"></line>

      <line class="lpTL-baseline" x1="${x0}" y1="${baselineY}" x2="${x1}" y2="${baselineY}"></line>
      <text class="lpTL-baselineText" x="${x0}" y="${baselineY - 8}" text-anchor="start">UNRANKED BASELINE</text>

      <text class="lpTL-label" x="${x0}" y="${H - 14}" text-anchor="start">${esc(fmtDateShort(startDate))}</text>
      <text class="lpTL-label" x="${x1}" y="${H - 14}" text-anchor="end">${esc(fmtDateShort(endDate))}</text>

      ${paths.join("")}
      ${dots.join("")}
    </svg>
  `;
  shell.appendChild(wrap);

  const svg = wrap.querySelector("svg");
  const allPaths = [...svg.querySelectorAll(".lpTL-path")];
  const allDotGroups = [...svg.querySelectorAll(".lpTL-dotg")];

  // Hover highlight: dim others (paths + dots)
  function dimExcept(riotId) {
    allPaths.forEach((p) => {
      const id = p.getAttribute("data-riotid");
      if (!riotId) p.classList.remove("dim");
      else p.classList.toggle("dim", id !== riotId);
    });
    allDotGroups.forEach((g) => {
      const id = g.getAttribute("data-riotid");
      if (!riotId) g.classList.remove("dim");
      else g.classList.toggle("dim", id !== riotId);
    });
  }

  allPaths.forEach((p) => {
    p.addEventListener("mouseenter", () => dimExcept(p.getAttribute("data-riotid")));
    p.addEventListener("mouseleave", () => dimExcept(null));
  });
  allDotGroups.forEach((g) => {
    g.addEventListener("mouseenter", () => dimExcept(g.getAttribute("data-riotid")));
    g.addEventListener("mouseleave", () => dimExcept(null));
  });

  // ✅ Replay animation that always works (JS-based)
  state._animateReplay = () => {
    if (state._replayTimer) clearTimeout(state._replayTimer);

    for (const p of allPaths) {
      let len = Number(p.dataset.len);
      if (!Number.isFinite(len) || len <= 0) {
        try {
          len = p.getTotalLength();
        } catch {
          len = 900;
        }
        p.dataset.len = String(len);
      }

      p.style.transition = "none";
      p.style.strokeDasharray = `${len}`;
      p.style.strokeDashoffset = `${len}`;
    }

    void svg.getBoundingClientRect();

    for (const p of allPaths) {
      p.style.transition = "stroke-dashoffset 980ms ease-in-out";
      p.style.strokeDashoffset = "0";
    }

    state._replayTimer = setTimeout(() => {
      for (const p of allPaths) {
        if (p.classList.contains("flex")) {
          p.style.strokeDasharray = "6 6";
          p.style.strokeDashoffset = "0";
        }
      }
    }, 920);
  };

  state._animateReplay();
}

export async function mountLpTimelineModule(
  mountEl,
  {
    csvUrl,
    rosterOrder = [],
    title = "LP Timeline (Rank over time)",
    unlockInDays = 0,
    defaultMode = "BOTH",
    defaultFocus = "",
    defaultWeekly = false, // ✅ new
  } = {}
) {
  injectStylesOnce();
  if (!mountEl) return;

  mountEl.classList.add("dashboard-card");
  mountEl.innerHTML = `
    <div class="card-header">
      <div>
        <div class="card-title">${esc(title)}</div>
        <div class="card-subtitle">Loading…</div>
      </div>
    </div>
  `;

  if (unlockInDays > 0) {
    mountUnlockableCard(mountEl, {
      title: title || "LP Timeline (Rank over time)",
      unlockInDays,
      note: "(Set to 0 whenever you want it live.)",
      pill: "Locked Feature",
      theme: "timeline",
    });
    return;
  }

  let rows = [];
  try {
    rows = await loadLpRows({ csvUrl });
  } catch (e) {
    mountEl.innerHTML = `
      <div class="card-header">
        <div>
          <div class="card-title">LP Timeline</div>
          <div class="card-subtitle">Couldn’t load LP data</div>
        </div>
      </div>
      <div class="text-xs text-slate-500 mt-2">${esc(String(e?.message ?? e))}</div>
    `;
    return;
  }

  const seriesMapRaw = buildSeries(rows);
  const seriesMapWeekly = buildWeeklySeriesMap(seriesMapRaw);

  const state = {
    title,
    rosterOrder,
    seriesMapRaw,
    seriesMapWeekly,
    weekly: !!defaultWeekly, // ✅ new
    mode: defaultMode,
    focusRiotId: defaultFocus,
    _animateReplay: null,
    _replayTimer: null,
  };

  render(mountEl, state);
}
