// /components/lpMiniModule.js
import { loadLpRows } from "../core/lpData.js";

function el(tag, cls, html) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
}

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function clamp01(x) {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function toNum(v) {
  if (v == null || v === "") return null;
  const n = parseFloat(String(v).replace("%", "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function safeName(riotId) {
  return String(riotId || "—").split("#")[0].trim() || String(riotId || "—");
}

function clampLp(lp) {
  const n = Number(lp);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(99, Math.round(n)));
}

function badge(queue) {
  if (queue === "SOLO")
    return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.65rem] font-bold"
      style="background: rgba(255,128,0,0.12); color:#ff8000; border:1px solid rgba(255,128,0,0.25);">
      <span class="inline-block w-2 h-2 rounded-full" style="background:#ff8000;"></span> SOLO
    </span>`;

  if (queue === "FLEX")
    return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.65rem] font-bold"
      style="background: rgba(59,130,246,0.10); color:#2563eb; border:1px solid rgba(59,130,246,0.22);">
      <span class="inline-block w-2 h-2 rounded-full" style="background:#2563eb;"></span> FLEX
    </span>`;

  return `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[0.65rem] font-bold border border-slate-200 text-slate-600 bg-white">${esc(
    queue
  )}</span>`;
}

function deltaClass(deltaPts) {
  if (deltaPts == null || !Number.isFinite(deltaPts) || deltaPts === 0) return "text-slate-400";
  return deltaPts > 0 ? "text-emerald-600" : "text-rose-600";
}

function fmtDeltaPts(deltaPts) {
  if (deltaPts == null || !Number.isFinite(deltaPts) || deltaPts === 0) return "—";
  const sign = deltaPts > 0 ? "+" : "−";
  return `${sign}${Math.round(Math.abs(deltaPts))} LP`;
}

function fmtDeltaWR(deltaWR) {
  if (deltaWR == null || !Number.isFinite(deltaWR) || deltaWR === 0) return "—";
  const sign = deltaWR > 0 ? "+" : "−";
  return `${sign}${Math.abs(deltaWR).toFixed(1)}%`;
}

function injectStylesOnce() {
  if (document.getElementById("lp-mini-styles")) return;
  const style = document.createElement("style");
  style.id = "lp-mini-styles";
  style.textContent = `
    @keyframes lpAuraSolo {
      0%   { box-shadow: 0 0 0 0 rgba(255,128,0,0.00), 0 12px 30px rgba(15,23,42,0.08); }
      50%  { box-shadow: 0 0 0 9px rgba(255,128,0,0.09), 0 12px 30px rgba(15,23,42,0.10); }
      100% { box-shadow: 0 0 0 0 rgba(255,128,0,0.00), 0 12px 30px rgba(15,23,42,0.08); }
    }
    @keyframes lpAuraFlex {
      0%   { box-shadow: 0 0 0 0 rgba(59,130,246,0.00), 0 12px 30px rgba(15,23,42,0.08); }
      50%  { box-shadow: 0 0 0 9px rgba(59,130,246,0.10), 0 12px 30px rgba(15,23,42,0.10); }
      100% { box-shadow: 0 0 0 0 rgba(59,130,246,0.00), 0 12px 30px rgba(15,23,42,0.08); }
    }
    .lp-aura-solo { position: relative; animation: lpAuraSolo 2.8s ease-in-out infinite; }
    .lp-aura-flex { position: relative; animation: lpAuraFlex 2.8s ease-in-out infinite; }

    .lp-chip {
      display:inline-flex;
      align-items:center;
      gap:6px;
      padding: 2px 10px;
      border-radius: 999px;
      font-size: 0.65rem;
      font-weight: 900;
      white-space: nowrap;
    }
    .lp-chip--solo {
      border: 1px solid rgba(255,128,0,0.28);
      background: rgba(255,128,0,0.12);
      color: #c2410c;
    }
    .lp-chip--flex {
      border: 1px solid rgba(59,130,246,0.26);
      background: rgba(59,130,246,0.10);
      color: #1d4ed8;
    }

    .lp-chip--promo{
      border: 1px solid rgba(16,185,129,0.28);
      background: rgba(16,185,129,0.10);
      color: #047857;
    }
    .lp-chip--placed{
      border: 1px solid rgba(124,58,237,0.24);
      background: rgba(124,58,237,0.10);
      color: #6d28d9;
    }

    .lp-delta-line{
      font-size: 0.65rem;
      font-weight: 900;
      color: rgba(100,116,139,0.90);
      margin-top: 0.35rem;
    }
  `;
  document.head.appendChild(style);
}

/** Build per-player ordered series */
function buildSeries(rows) {
  const map = new Map(); // riotId -> {SOLO:[], FLEX:[]}
  const ts = (r) =>
    Number.isFinite(r?.snapshotTs)
      ? r.snapshotTs
      : r?.snapshotDate?.getTime?.() ?? 0;

  for (const r of rows || []) {
    const riotId = String(r?.riotId || "").trim();
    const q = String(r?.queue || "").trim().toUpperCase();
    if (!riotId || (q !== "SOLO" && q !== "FLEX")) continue;

    if (!map.has(riotId)) map.set(riotId, { SOLO: [], FLEX: [] });
    map.get(riotId)[q].push(r);
  }

  for (const [riotId, qs] of map.entries()) {
    qs.SOLO.sort((a, b) => ts(a) - ts(b));
    qs.FLEX.sort((a, b) => ts(a) - ts(b));
    map.set(riotId, qs);
  }
  return map;
}

/**
 * Rank parsing (use currentRank, NOT rankIndex)
 * Accepts:
 * - "SILVER IV"
 * - "SILVER IV · 17 LP"
 * - "GOLD I | 55 LP"
 * - "PLATINUM II · 33 LP"
 * - "MASTER"
 * - "UNRANKED"
 */
const TIER_ALIASES = {
  IRON: "IRON",
  BRONZE: "BRONZE",
  SILVER: "SILVER",
  GOLD: "GOLD",
  PLAT: "PLAT",
  PLATINUM: "PLAT",
  EMER: "EMER",
  EMERALD: "EMER",
  DIAM: "DIAM",
  DIAMOND: "DIAM",
  MASTER: "MASTER",
  GRANDMASTER: "GRANDMASTER",
  CHALLENGER: "CHALLENGER",
};

const TIER_ORDER = ["IRON", "BRONZE", "SILVER", "GOLD", "PLAT", "EMER", "DIAM", "MASTER", "GRANDMASTER", "CHALLENGER"];
const DIV_ORDER = { IV: 0, III: 1, II: 2, I: 3 };

// ✅ strip any "· 15 LP" / "15 LP" noise so we never double-print LP
function cleanRankText(label) {
  const up = String(label || "").trim().toUpperCase();
  if (!up) return "";
  if (up.includes("UNRANKED")) return "UNRANKED";
  return up
    .replace(/[·|]/g, " ")
    .replace(/\b\d+\s*LP\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseRankLabel(label) {
  const s = cleanRankText(label);
  if (!s || s === "UNRANKED") return null;

  const parts = s.split(/\s+/).filter(Boolean);
  if (!parts.length) return null;

  const tierRaw = parts[0];
  const tierKey = TIER_ALIASES[tierRaw] || null;
  if (!tierKey) return null;

  const tierIdx = TIER_ORDER.indexOf(tierKey);
  if (tierIdx < 0) return null;

  // Division may be absent for MASTER+
  const divRaw = parts[1] || null;
  const divIdx = divRaw && DIV_ORDER[divRaw] != null ? DIV_ORDER[divRaw] : 4;

  const absIdx = tierIdx * 4 + Math.min(divIdx, 4);
  return { tierKey, tierIdx, divIdx, absIdx, divRaw };
}

function isRankedRow(row) {
  const parsed = parseRankLabel(row?.currentRank);
  return !!parsed;
}

/**
 * Promotion-safe points:
 * absIdx (tier+division) * 100 + LP
 */
function rankPts(row) {
  const p = parseRankLabel(row?.currentRank);
  if (!p) return null;
  return Math.round(p.absIdx * 100 + clampLp(row?.lp));
}

function tierFromRow(row) {
  const p = parseRankLabel(row?.currentRank);
  return p ? p.tierIdx : null;
}

/** Count point-change snapshots after a given index */
function countPointChangesAfter(series, startIdx) {
  if (!Array.isArray(series) || series.length < 2) return 0;
  let c = 0;
  for (let i = Math.max(1, startIdx + 1); i < series.length; i++) {
    const a = rankPts(series[i - 1]);
    const b = rankPts(series[i]);
    if (a == null || b == null) continue;
    if (b !== a) c++;
  }
  return c;
}

/** Promo/Placed chip that persists until 3 later point-change snapshots */
function persistentMilestoneChip(series) {
  if (!Array.isArray(series) || series.length < 2) return "";

  for (let i = series.length - 1; i >= 1; i--) {
    const prev = series[i - 1];
    const cur = series[i];

    const prevRanked = isRankedRow(prev);
    const curRanked = isRankedRow(cur);

    // PLACED
    if (!prevRanked && curRanked) {
      const later = countPointChangesAfter(series, i);
      if (later < 3) return `<span class="lp-chip lp-chip--placed">✨ Placed</span>`;
      return "";
    }

    // PROMO (tier increase)
    const aTier = tierFromRow(prev);
    const bTier = tierFromRow(cur);
    if (aTier != null && bTier != null && bTier > aTier) {
      const later = countPointChangesAfter(series, i);
      if (later < 3) {
        const from = TIER_ORDER[aTier] || "—";
        const to = TIER_ORDER[bTier] || "—";
        return `<span class="lp-chip lp-chip--promo">⬆️ ${esc(from)} → ${esc(to)}</span>`;
      }
      return "";
    }
  }

  return "";
}

/**
 * Find last LP-point-change event (or placed).
 * We use this to anchor “sticky” LP delta.
 */
function lastPointsEvent(series) {
  if (!Array.isArray(series) || series.length < 2) return null;

  for (let i = series.length - 1; i >= 1; i--) {
    const prev = series[i - 1];
    const cur = series[i];

    const prevRanked = isRankedRow(prev);
    const curRanked = isRankedRow(cur);

    // placed -> treat as event, but no numeric delta
    if (!prevRanked && curRanked) {
      return { type: "PLACED", idx: i, prevRow: prev, curRow: cur, deltaPts: null };
    }

    const a = rankPts(prev);
    const b = rankPts(cur);
    if (a == null || b == null) continue;
    if (a === b) continue;

    return { type: "POINTS", idx: i, prevRow: prev, curRow: cur, deltaPts: b - a };
  }

  return null;
}

/**
 * ✅ Sticky "Last change" date:
 * If rank/LP hasn't changed, keep showing the date of the last rank/LP change.
 * (W/L changes do NOT affect this.)
 */
function stickyLastChangeDate(series) {
  if (!Array.isArray(series) || series.length === 0) return "";

  // Find last index where rankPts changed OR placed happened
  for (let i = series.length - 1; i >= 1; i--) {
    const prev = series[i - 1];
    const cur = series[i];

    const prevRanked = isRankedRow(prev);
    const curRanked = isRankedRow(cur);

    if (!prevRanked && curRanked) {
      return cur?.snapshotDateStr || "";
    }

    const a = rankPts(prev);
    const b = rankPts(cur);

    if (a != null && b != null && a !== b) {
      return cur?.snapshotDateStr || "";
    }

    // Optional: if one side is ranked and the other isn't (other than placed), treat as change too
    if (prevRanked !== curRanked) {
      return cur?.snapshotDateStr || "";
    }
  }

  // No rank/LP change ever -> just show latest snapshot date
  return series[series.length - 1]?.snapshotDateStr || "";
}

/**
 * Sticky W/L/WR delta:
 * - If LP has NOT changed recently but W/L changed, show the latest W/L change since last LP-change.
 * - If nothing changed since last LP-change, fall back to that LP-change interval.
 */
function stickyWLDelta(series, pointsEvent) {
  if (!Array.isArray(series) || series.length < 2) return null;
  if (!pointsEvent) return null;
  if (pointsEvent.type === "PLACED") return null;

  const startIdx = pointsEvent.idx;

  for (let i = series.length - 1; i >= Math.max(1, startIdx + 1); i--) {
    const a = series[i - 1];
    const b = series[i];

    const wA = Number(a?.wins);
    const wB = Number(b?.wins);
    const lA = Number(a?.losses);
    const lB = Number(b?.losses);

    const dW = Number.isFinite(wA) && Number.isFinite(wB) ? wB - wA : null;
    const dL = Number.isFinite(lA) && Number.isFinite(lB) ? lB - lA : null;

    const wrA = toNum(a?.winrate);
    const wrB = toNum(b?.winrate);
    const dWR = wrA != null && wrB != null ? wrB - wrA : null;

    const changed =
      (dW != null && dW !== 0) || (dL != null && dL !== 0) || (dWR != null && dWR !== 0);

    if (changed) return { dW, dL, dWR };
  }

  const a = pointsEvent.prevRow;
  const b = pointsEvent.curRow;

  const wA = Number(a?.wins);
  const wB = Number(b?.wins);
  const lA = Number(a?.losses);
  const lB = Number(b?.losses);

  const dW = Number.isFinite(wA) && Number.isFinite(wB) ? wB - wA : null;
  const dL = Number.isFinite(lA) && Number.isFinite(lB) ? lB - lA : null;

  const wrA = toNum(a?.winrate);
  const wrB = toNum(b?.winrate);
  const dWR = wrA != null && wrB != null ? wrB - wrA : null;

  return { dW, dL, dWR };
}

// ✅ Base rank label without LP in it (prevents "…15 LP · 15 LP")
function rankBaseLabel(row) {
  if (!row) return "—";
  const s = cleanRankText(row?.currentRank);
  if (!s || s === "UNRANKED") return "UNRANKED";

  const parts = s.split(/\s+/).filter(Boolean);
  const tierRaw = parts[0] || "—";
  const divRaw = parts[1] || null;
  if (divRaw && DIV_ORDER[divRaw] != null) return `${tierRaw} ${divRaw}`;
  return tierRaw; // MASTER+ etc
}

function rankLabel(row) {
  if (!row) return "—";
  if (!isRankedRow(row)) return "UNRANKED";
  const base = rankBaseLabel(row);
  const lp = clampLp(row?.lp);
  return `${esc(base)} · ${lp} LP`;
}

function rankLineHTML(row, pointsEvent, wlDelta) {
  const deltaPts = pointsEvent?.type === "POINTS" ? pointsEvent.deltaPts : null;
  const dTxt = fmtDeltaPts(deltaPts);

  const wr = row ? `${toNum(row.winrate) ?? 0}%` : "—";
  const wl = row ? `${Number(row.wins ?? 0)}-${Number(row.losses ?? 0)}` : "—";

  const showTiny =
    wlDelta &&
    ((wlDelta.dWR != null && Number.isFinite(wlDelta.dWR) && wlDelta.dWR !== 0) ||
      (wlDelta.dW != null && Number.isFinite(wlDelta.dW) && wlDelta.dW !== 0) ||
      (wlDelta.dL != null && Number.isFinite(wlDelta.dL) && wlDelta.dL !== 0));

  const tiny = showTiny
    ? `<div class="lp-delta-line">
        ΔWR ${esc(fmtDeltaWR(wlDelta.dWR))}
        <span style="opacity:.75;">·</span>
        Δ ${(wlDelta.dW ?? 0) >= 0 ? "+" : "−"}${Math.abs(wlDelta.dW ?? 0)}W
        ${(wlDelta.dL ?? 0) >= 0 ? "+" : "−"}${Math.abs(wlDelta.dL ?? 0)}L
      </div>`
    : "";

  return `
    <div class="flex items-center gap-2">
      <div class="text-xs font-semibold text-slate-800 truncate">${rankLabel(row)}</div>
      <span class="ml-auto text-[0.65rem] font-bold ${deltaClass(deltaPts)}">${esc(dTxt)}</span>
    </div>
    <div class="flex items-center justify-between text-[0.7rem] text-slate-500 mt-0.5">
      <span>${esc(wl)}</span>
      <span>WR ${esc(wr)}</span>
    </div>
    ${tiny}
  `;
}

export async function mountLpMiniModule({
  mountId = "lp-mini-card",
  csvUrl,
  rosterOrder = [],
  showQueues = ["SOLO", "FLEX"],
} = {}) {
  injectStylesOnce();

  const root = document.getElementById(mountId);
  if (!root) return;

  root.innerHTML = "";
  root.classList.add("dashboard-card");

  const header = el("div", "flex items-start justify-between gap-3 mb-3");
  header.appendChild(
    el(
      "div",
      "",
      `
      <div class="text-sm font-bold text-slate-900">LP Snapshot</div>
      <div class="text-[0.72rem] text-slate-500">Latest ranks (SOLO/FLEX) from LP26.</div>
    `
    )
  );

  const legend = el(
    "div",
    "flex flex-col gap-1 items-end text-[0.7rem]",
    `
      <div class="flex gap-2">${badge("SOLO")}${badge("FLEX")}</div>
      <div class="text-slate-400">LP Δ is promo-safe. WR/WL Δ sticks until next LP change.</div>
    `
  );
  header.appendChild(legend);
  root.appendChild(header);

  const loading = el("div", "text-xs text-slate-500", "Loading LP data…");
  root.appendChild(loading);

  let rows = [];
  try {
    rows = await loadLpRows({ csvUrl });
  } catch (e) {
    root.innerHTML = `<div class="text-sm font-bold text-rose-600">LP load failed</div>
      <div class="text-xs text-slate-500 mt-1">Check your published LP26 CSV URL.</div>`;
    console.error(e);
    return;
  }

  const seriesMap = buildSeries(rows);

  const latestMap = new Map();
  for (const [riotId, qs] of seriesMap.entries()) {
    latestMap.set(riotId, {
      SOLO: qs.SOLO.length ? qs.SOLO[qs.SOLO.length - 1] : null,
      FLEX: qs.FLEX.length ? qs.FLEX[qs.FLEX.length - 1] : null,
    });
  }

  const allPlayers = [...latestMap.keys()].map((riotId) => ({
    riotId,
    base: safeName(riotId),
  }));

  function soloPtsFor(riotId) {
    const latest = latestMap.get(riotId) || { SOLO: null };
    const p = rankPts(latest.SOLO);
    return p == null ? -1 : p;
  }

  // Determine Top SOLO + Top FLEX
  let topSolo = null;
  let topSoloPts = -Infinity;

  let topFlex = null;
  let topFlexPts = -Infinity;

  const soloPtsArr = [];

  for (const p of allPlayers) {
    const latest = latestMap.get(p.riotId) || { SOLO: null, FLEX: null };
    const sPts = rankPts(latest.SOLO);
    const fPts = rankPts(latest.FLEX);

    if (sPts != null) soloPtsArr.push(sPts);

    if ((sPts ?? -1) > topSoloPts) {
      topSoloPts = sPts ?? -1;
      topSolo = p.riotId;
    }
    if ((fPts ?? -1) > topFlexPts) {
      topFlexPts = fPts ?? -1;
      topFlex = p.riotId;
    }
  }

  const minSolo = soloPtsArr.length ? Math.min(...soloPtsArr) : 0;
  const maxSolo = soloPtsArr.length ? Math.max(...soloPtsArr) : 1;
  const denomSolo = Math.max(1e-9, maxSolo - minSolo);

  const order = rosterOrder.length ? rosterOrder.map((n) => String(n).trim()) : [];

  allPlayers.sort((a, b) => {
    const sa = soloPtsFor(a.riotId);
    const sb = soloPtsFor(b.riotId);

    const aRanked = sa >= 0;
    const bRanked = sb >= 0;
    if (aRanked !== bRanked) return aRanked ? -1 : 1;

    if (sa !== sb) return sb - sa;

    const ia = order.indexOf(a.base);
    const ib = order.indexOf(b.base);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;

    return a.base.localeCompare(b.base);
  });

  root.removeChild(loading);

  const grid = el("div", "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3");
  root.appendChild(grid);

  for (const p of allPlayers) {
    const latest = latestMap.get(p.riotId) || { SOLO: null, FLEX: null };

    const soloPts = rankPts(latest.SOLO);
    const heat = soloPts != null ? clamp01((soloPts - minSolo) / denomSolo) : 0;

    const fillA = 0.04 + heat * 0.10;
    const fillB = 0.02 + heat * 0.07;

    const card = el("div", "rounded-2xl border border-slate-200 bg-white/60 backdrop-blur px-3 py-3 shadow-sm");
    card.style.background = `linear-gradient(135deg, rgba(255,128,0,${fillA}), rgba(231,175,178,${fillB}))`;

    if (p.riotId === topSolo && topSoloPts >= 0) card.classList.add("lp-aura-solo");
    if (p.riotId === topFlex && topFlexPts >= 0) card.classList.add("lp-aura-flex");

    const titleRow = el("div", "flex items-start gap-2");

    const avatar = el(
      "div",
      "w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-black shrink-0",
      esc(p.base.slice(0, 2).toUpperCase())
    );
    avatar.style.background = "linear-gradient(135deg, #ff8000, #e7afb2)";
    titleRow.appendChild(avatar);

    const chips = [];
    if (p.riotId === topSolo && topSoloPts >= 0) chips.push(`<span class="lp-chip lp-chip--solo">👑 Top Solo</span>`);
    if (p.riotId === topFlex && topFlexPts >= 0) chips.push(`<span class="lp-chip lp-chip--flex">💠 Top Flex</span>`);

    const titleCol = el(
      "div",
      "min-w-0 flex-1",
      `
        <div class="flex items-center gap-2 flex-wrap">
          <div class="text-sm font-bold text-slate-900 truncate">${esc(p.base)}</div>
          ${chips.join("")}
        </div>
        <div class="text-[0.7rem] text-slate-500 truncate">${esc(p.riotId)}</div>
      `
    );
    titleRow.appendChild(titleCol);

    card.appendChild(titleRow);

    const body = el("div", "mt-3 flex flex-col gap-2");

    for (const q of showQueues) {
      const series = seriesMap.get(p.riotId)?.[q] || [];
      const row = series.length ? series[series.length - 1] : null;

      const milestoneChip = persistentMilestoneChip(series);
      const pointsEvent = lastPointsEvent(series);
      const wlDelta = stickyWLDelta(series, pointsEvent);

      // ✅ sticky date (last rank/LP change)
      const dateLabel = stickyLastChangeDate(series);

      const block = el("div", "rounded-xl border border-slate-200 bg-white px-2.5 py-2");

      const chipRow = milestoneChip ? `<div class="mt-1 flex flex-wrap gap-1.5">${milestoneChip}</div>` : "";

      block.innerHTML = `
        <div class="flex items-center gap-2 mb-1">
          ${badge(q)}
          <span class="text-[0.65rem] text-slate-400 ml-auto">${esc(dateLabel)}</span>
        </div>
        ${rankLineHTML(row, pointsEvent, wlDelta)}
        ${chipRow}
      `;
      body.appendChild(block);
    }

    card.appendChild(body);
    grid.appendChild(card);
  }

  const footer = el(
    "div",
    "mt-3 text-[0.7rem] text-slate-400",
    `Sort/heat = SOLO only (promo-safe points from rank label + LP). Promo/Placed chips stay until 3 later point-change snapshots.`
  );
  root.appendChild(footer);
}
