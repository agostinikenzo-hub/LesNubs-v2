// /components/deathMapCard.js
import { getLatestDDragonVersion } from "../core/ddragon.js";
import {
  buildCombatEvents,
  buildWardEvents,
  tagDeathsByVision,
  buildDamageSpikeEvents,
  summarizeDamageSpikeEvents,
  dbscan,
  summarizeEvents,
  summarizeWardEvents,
  generateTips,
  worldToCanvas,
} from "../core/deathMap.js";

function esc(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function pill(label, value) {
  return `
    <div class="rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-[0.7rem] text-slate-700">
      <span class="text-slate-400">${esc(label)}:</span>
      <span class="font-semibold ml-1">${esc(value)}</span>
    </div>
  `;
}

function barRow(label, count, total) {
  const pct = total ? Math.round((count / total) * 100) : 0;
  return `
    <div class="flex items-center gap-2">
      <div class="w-28 text-[0.72rem] text-slate-600 truncate" title="${esc(label)}">${esc(label)}</div>
      <div class="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
        <div class="h-2 rounded-full bg-orange-400" style="width:${pct}%;"></div>
      </div>
      <div class="w-14 text-right text-[0.7rem] text-slate-500">${count} <span class="text-slate-300">(${pct}%)</span></div>
    </div>
  `;
}

function selectOption(label, value, selected) {
  return `<option value="${esc(value)}" ${selected ? "selected" : ""}>${esc(label)}</option>`;
}

function uniq(arr) {
  return [...new Set(arr.filter(Boolean))];
}

async function loadMinimapImg() {
  const ver = await getLatestDDragonVersion();
  const src = `https://ddragon.leagueoflegends.com/cdn/${ver}/img/map/map11.png`;

  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = src;
  });
  return img;
}

function filterEvents(events, state) {
  return events.filter((e) => {
    if (state.scope === "roster" && !e.isRoster) return false;

    // match-side filter (our roster's side for that match)
    if (state.matchSide !== "all") {
      if (!e.matchSide) return false;
      if (e.matchSide !== state.matchSide) return false;
    }

    if (state.phase !== "all" && e.phase !== state.phase) return false;

    if (state.zone !== "all") {
      const z = e.zone || "Unknown";
      if (z !== state.zone) return false;
    }

    if (state.objective !== "all") {
      const o = e.objective || "None";
      if (o !== state.objective) return false;
    }

    return true;
  });
}

function computeClusters(points, enabled, modeKey) {
  if (!enabled) return [];
  const minCount =
    modeKey?.startsWith("wards") ? 35 :
    modeKey?.startsWith("dmg") ? 45 :
    60;

  if (points.length < minCount) return [];

  // clustering is O(n^2) here; keep it sane
  const pts = points.length > 2500 ? points.slice(0, 2500) : points;
  return dbscan(pts, { eps: 950, minPts: 12 }).slice(0, 6);
}

function colorForMode(modeKey) {
  if (modeKey === "deaths") return "rgba(249,115,22,0.95)";       // orange
  if (modeKey === "kills") return "rgba(16,185,129,0.95)";        // emerald
  if (modeKey === "wardsPlaced") return "rgba(59,130,246,0.95)";  // blue
  if (modeKey === "wardsKilled") return "rgba(148,163,184,0.95)"; // slate

  // dmg modes
  if (modeKey === "dmgDealt") return "rgba(139,92,246,0.95)";     // violet
  if (modeKey === "dmgTaken") return "rgba(244,63,94,0.95)";      // rose
  return "rgba(234,179,8,0.95)";                                  // amber (trade loss)
}

function draw(canvas, img, events, clusters, modeKey) {
  const ctx = canvas.getContext("2d");
  const size = canvas.width;

  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(img, 0, 0, size, size);

  const baseColor = colorForMode(modeKey);

  // dmg modes: scale dot size/alpha by value
  const isDmg = modeKey?.startsWith("dmg");
  let maxVal = 1;
  if (isDmg) {
    for (const e of events) maxVal = Math.max(maxVal, Number(e.value) || 0);
  }

  // points
  ctx.globalAlpha = 0.8;
  for (const e of events) {
    const p = worldToCanvas({ x: e.x, y: e.y }, size);

    let r = 3.2;
    if (isDmg) {
      const v = Math.max(0, Number(e.value) || 0);
      const t = Math.min(1, v / maxVal);
      ctx.globalAlpha = 0.25 + 0.75 * t;
      r = 2.2 + 3.8 * t;
    } else {
      ctx.globalAlpha = 0.8;
    }

    ctx.fillStyle = baseColor;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();

    // tiny dark outline
    ctx.strokeStyle = "rgba(15,23,42,0.35)";
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // clusters overlay (rings)
  for (const c of clusters) {
    const p = worldToCanvas({ x: c.cx, y: c.cy }, size);
    const r = (c.radius / 15000) * size;

    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(10, r), 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "rgba(15,23,42,0.7)";
    ctx.font = "12px Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.fillText(String(c.count), p.x + 6, p.y - 6);
  }
}

export async function mountDeathMapCard(mountEl, timelineRows, opts = {}) {
  if (!mountEl) throw new Error("mountDeathMapCard: missing mount element");

  const title = opts.title || "Combat Map (Deaths, Kills, Wards & DMG)";
  const subtitle =
    opts.subtitle ||
    "From Timeline minute events — filter by phase/zone/objective, show clusters, and get quick readouts.";

  const roster = opts.roster || null;

  if (!timelineRows || !timelineRows.length) {
    mountEl.innerHTML = `
      <div class="card-header">
        <div>
          <div class="card-title">${esc(title)}</div>
          <div class="card-subtitle">No timeline rows found.</div>
        </div>
      </div>
    `;
    return;
  }

  // Build once
  const { deaths, kills } = buildCombatEvents(timelineRows, { roster });
  const { placed: wardsPlaced, killed: wardsKilled } = buildWardEvents(timelineRows, { roster });

  const dmg = buildDamageSpikeEvents(timelineRows, { roster });
  const dmgDealt = dmg.dealt || [];
  const dmgTaken = dmg.taken || [];
  const dmgTradeLoss = dmg.tradeLoss || [];
  const dmgThr = dmg.thresholds || { dealt: null, taken: null, tradeLoss: null };

  // UI state
  const state = {
    mode: "deaths", // deaths | kills | wardsPlaced | wardsKilled | dmgDealt | dmgTaken | dmgTradeLoss
    scope: "roster", // roster | all
    matchSide: "all", // all | blue | red
    phase: "all", // all | Early | Mid | Late
    zone: "all",
    objective: "all",
    clusters: true,
  };

  const zonesAll = uniq(
    [...deaths, ...kills, ...wardsPlaced, ...wardsKilled, ...dmgDealt, ...dmgTaken, ...dmgTradeLoss].map(
      (e) => e.zone || "Unknown"
    )
  ).sort((a, b) => a.localeCompare(b));

  const mountId = `dm_${Math.random().toString(36).slice(2)}`;

  const dataPill = [
    `${deaths.length} deaths`,
    `${kills.length} kills`,
    `${wardsPlaced.length} wards+`,
    `${wardsKilled.length} wards-`,
    `${dmgDealt.length} dmg▲`,
    `${dmgTaken.length} dmg▼`,
  ].join(" · ");

  mountEl.innerHTML = `
    <div class="card-header">
      <div class="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div class="card-title">${esc(title)}</div>
          <div class="card-subtitle">${esc(subtitle)}</div>
        </div>

        <div class="flex flex-wrap gap-2 items-center">
          ${pill("Data", dataPill)}
          ${pill("Source", "Timeline tab")}
        </div>
      </div>
    </div>

    <div class="px-4 pb-4">
      <div class="mt-3 flex flex-wrap gap-2 items-center">
        <select id="${mountId}_mode" class="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white">
          ${selectOption("Deaths", "deaths", true)}
          ${selectOption("Kills", "kills", false)}
          ${selectOption("Wards Placed", "wardsPlaced", false)}
          ${selectOption("Wards Killed", "wardsKilled", false)}
          ${selectOption("DMG Spikes (Dealt)", "dmgDealt", false)}
          ${selectOption("DMG Spikes (Taken)", "dmgTaken", false)}
          ${selectOption("Trade Loss Spikes", "dmgTradeLoss", false)}
        </select>

        <select id="${mountId}_scope" class="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white">
          ${selectOption("Les Nübs only", "roster", true)}
          ${selectOption("All participants", "all", false)}
        </select>

        <select id="${mountId}_matchSide" class="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white">
          ${selectOption("All sides", "all", true)}
          ${selectOption("When we were Blue", "blue", false)}
          ${selectOption("When we were Red", "red", false)}
        </select>

        <select id="${mountId}_phase" class="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white">
          ${selectOption("All phases", "all", true)}
          ${selectOption("Early (0–14)", "Early", false)}
          ${selectOption("Mid (15–24)", "Mid", false)}
          ${selectOption("Late (25+)", "Late", false)}
        </select>

        <select id="${mountId}_zone" class="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white">
          ${selectOption("All zones", "all", true)}
          ${zonesAll.map((z) => selectOption(z, z, false)).join("")}
        </select>

        <select id="${mountId}_obj" class="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white">
          ${selectOption("All objectives", "all", true)}
          ${selectOption("None", "None", false)}
          ${selectOption("Dragon", "dragon", false)}
          ${selectOption("Baron", "baron", false)}
          ${selectOption("Herald", "herald", false)}
        </select>

        <label class="ml-1 inline-flex items-center gap-2 text-xs text-slate-600">
          <input id="${mountId}_clusters" type="checkbox" class="rounded" checked />
          Clusters
        </label>
      </div>

      <div class="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div class="lg:col-span-2 rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div class="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
            <div class="text-xs font-semibold text-slate-700">
              Map
              <span id="${mountId}_map_hint" class="font-normal text-slate-400 ml-2"></span>
            </div>
            <div id="${mountId}_mini_stats" class="text-[0.72rem] text-slate-500"></div>
          </div>
          <div class="p-3">
            <canvas id="${mountId}_canvas" width="520" height="520" class="w-full h-auto rounded-xl border border-slate-100"></canvas>
          </div>
        </div>

        <div class="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div class="px-4 py-2 border-b border-slate-100">
            <div class="text-xs font-semibold text-slate-700">Breakdown</div>
            <div class="text-[0.7rem] text-slate-400">This is the “what does it mean” layer.</div>
          </div>

          <div class="p-4 space-y-3">
            <div id="${mountId}_breakdown" class="space-y-2"></div>

            <div class="pt-3 border-t border-slate-100">
              <div class="text-xs font-semibold text-slate-700 mb-1">Quick tips</div>
              <div id="${mountId}_tips" class="text-[0.78rem] text-slate-600 space-y-1"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  const elMode = mountEl.querySelector(`#${mountId}_mode`);
  const elScope = mountEl.querySelector(`#${mountId}_scope`);
  const elMatchSide = mountEl.querySelector(`#${mountId}_matchSide`);
  const elPhase = mountEl.querySelector(`#${mountId}_phase`);
  const elZone = mountEl.querySelector(`#${mountId}_zone`);
  const elObj = mountEl.querySelector(`#${mountId}_obj`);
  const elClusters = mountEl.querySelector(`#${mountId}_clusters`);

  const canvas = mountEl.querySelector(`#${mountId}_canvas`);
  const hint = mountEl.querySelector(`#${mountId}_map_hint`);
  const miniStats = mountEl.querySelector(`#${mountId}_mini_stats`);
  const breakdown = mountEl.querySelector(`#${mountId}_breakdown`);
  const tipsEl = mountEl.querySelector(`#${mountId}_tips`);

  if (!canvas) throw new Error("DeathMapCard: missing canvas");

  const minimapImg = await loadMinimapImg();

  const sideLabel = (s) => (s === "blue" ? "blue" : s === "red" ? "red" : "all sides");

  const modeLabelFromKey = (k) => {
    if (k === "deaths") return "deaths";
    if (k === "kills") return "kills";
    if (k === "wardsPlaced") return "wards placed";
    if (k === "wardsKilled") return "wards killed";
    if (k === "dmgDealt") return "DMG spikes (dealt)";
    if (k === "dmgTaken") return "DMG spikes (taken)";
    return "trade loss spikes";
  };

  const dmgThresholdForMode = (k) => {
    if (k === "dmgDealt") return dmgThr.dealt;
    if (k === "dmgTaken") return dmgThr.taken;
    if (k === "dmgTradeLoss") return dmgThr.tradeLoss;
    return null;
  };

  const rerender = () => {
    let base =
      state.mode === "deaths"
        ? deaths
        : state.mode === "kills"
        ? kills
        : state.mode === "wardsPlaced"
        ? wardsPlaced
        : state.mode === "wardsKilled"
        ? wardsKilled
        : state.mode === "dmgDealt"
        ? dmgDealt
        : state.mode === "dmgTaken"
        ? dmgTaken
        : dmgTradeLoss;

    let filtered = filterEvents(base, state);

    // optional vision tagging for deaths (using wardsPlaced)
    let visionRate = null;
    if (state.mode === "deaths" && wardsPlaced.length) {
      const tagged = tagDeathsByVision(filtered, wardsPlaced, { radius: 1200, lookbackSec: 90 });
      const inVision = tagged.filter((d) => d.inVision === true).length;
      visionRate = tagged.length ? inVision / tagged.length : null;
      filtered = tagged;
    }

    const clusters = computeClusters(filtered, state.clusters, state.mode);

    draw(canvas, minimapImg, filtered, clusters, state.mode);

    const modeLabel = modeLabelFromKey(state.mode);
    const parts = [];
    parts.push(modeLabel);
    if (state.scope === "roster") parts.push("roster");
    if (state.matchSide !== "all") parts.push(`when ${sideLabel(state.matchSide)}`);
    if (hint) hint.textContent = `(${parts.join(" · ")})`;

    if (miniStats) miniStats.textContent = `${filtered.length} shown`;

    // === DMG breakdown ===
    if (state.mode.startsWith("dmg")) {
      const sum = summarizeDamageSpikeEvents(filtered);
      const zones = sum.zones || [];
      const objMap = new Map(sum.objectives || []);
      const nearDragon = objMap.get("dragon") || 0;
      const nearBaron = objMap.get("baron") || 0;
      const nearHerald = objMap.get("herald") || 0;

      const riverPct = sum.total ? Math.round((sum.river / sum.total) * 100) : 0;
      const thr = dmgThresholdForMode(state.mode);

      breakdown.innerHTML = `
        <div class="space-y-2">
          ${barRow("River", sum.river, sum.total)}
          ${barRow("Near Dragon", nearDragon, sum.total)}
          ${barRow("Near Baron", nearBaron, sum.total)}
          ${barRow("Near Herald", nearHerald, sum.total)}
          ${sum.top25 != null ? barRow("Top 25% spikes", sum.top25, sum.total) : ""}
          ${sum.top10 != null ? barRow("Top 10% spikes", sum.top10, sum.total) : ""}
        </div>

        <div class="pt-3 border-t border-slate-100">
          <div class="text-[0.75rem] font-semibold text-slate-700 mb-2">Top zones</div>
          <div class="space-y-2">
            ${zones.slice(0, 5).map(([z, c]) => barRow(z, c, sum.total)).join("")}
          </div>
        </div>

        <div class="pt-3 border-t border-slate-100 text-[0.72rem] text-slate-500">
          Read: ${riverPct}% river ·
          ${thr != null ? `spike threshold ≈ ≥ ${thr} dmg/min ·` : ""}
          ${sum.avg != null ? `avg ${sum.avg}` : ""}
          ${sum.p75 != null ? ` · p75 ${sum.p75}` : ""}
          ${sum.p90 != null ? ` · p90 ${sum.p90}` : ""}.
        </div>
      `;

      // DMG tips (compact, mode-aware)
      const tips = [];
      const topZone = zones?.[0]?.[0];
      const objHot = (nearDragon + nearBaron + nearHerald) / (sum.total || 1);

      if (state.mode === "dmgDealt") {
        tips.push(`These are **high damage minutes** (no kill required). Use them to find “almost won” fights and whether you converted after.`);
        if (objHot < 0.18) tips.push(`A lot of spike damage isn’t near objectives. After a winning trade, try a default convert: *plates → vision line → reset on tempo.*`);
      } else if (state.mode === "dmgTaken") {
        tips.push(`These are **minutes where you got chunked hard**. Most “game-losing” sequences start here (forced reset → lost objective).`);
        if (objHot >= 0.3) tips.push(`Big taken-spikes cluster near objectives. That often means *late setup / walking into choke*. Aim: push → reset → sweep → arrive early.`);
      } else {
        tips.push(`Trade-loss spikes = **(damage taken − damage dealt)**. This is your “bad engage / bad facecheck / bad contest” detector.`);
        tips.push(`If this clusters in one zone, write one rule like: “we don’t enter this choke without 2 wards + buddy.”`);
      }

      if (riverPct >= 30) tips.push(`A lot of this happens in **river** (${riverPct}%). Pair this view with wards to see if you’re fighting in darkness.`);
      if (topZone) tips.push(`Top zone: **${topZone}**. Pull 3 clips from there and check the *first 5 seconds* (who sees who first?).`);

      tipsEl.innerHTML = tips.length
        ? tips.slice(0, 5).map((t) => `<div>• ${t}</div>`).join("")
        : `<div class="text-slate-500">Not enough signal yet — add more games.</div>`;

      return;
    }

    // === Wards breakdown ===
    if (state.mode === "wardsPlaced" || state.mode === "wardsKilled") {
      const sum = summarizeWardEvents(filtered);
      const zones = sum.zones || [];
      const objMap = new Map(sum.objectives || []);
      const typeList = sum.wardTypes || [];

      const nearDragon = objMap.get("dragon") || 0;
      const nearBaron = objMap.get("baron") || 0;
      const nearHerald = objMap.get("herald") || 0;

      const riverPct = sum.total ? Math.round((sum.river / sum.total) * 100) : 0;

      breakdown.innerHTML = `
        <div class="space-y-2">
          ${barRow("River", sum.river, sum.total)}
          ${barRow("Near Dragon", nearDragon, sum.total)}
          ${barRow("Near Baron", nearBaron, sum.total)}
          ${barRow("Near Herald", nearHerald, sum.total)}
        </div>

        <div class="pt-3 border-t border-slate-100">
          <div class="text-[0.75rem] font-semibold text-slate-700 mb-2">Top ward types</div>
          <div class="space-y-2">
            ${typeList.slice(0, 5).map(([t, c]) => barRow(t, c, sum.total)).join("")}
          </div>
        </div>

        <div class="pt-3 border-t border-slate-100">
          <div class="text-[0.75rem] font-semibold text-slate-700 mb-2">Top zones</div>
          <div class="space-y-2">
            ${zones.slice(0, 5).map(([z, c]) => barRow(z, c, sum.total)).join("")}
          </div>
        </div>

        <div class="pt-3 border-t border-slate-100 text-[0.72rem] text-slate-500">
          Read: ${riverPct}% river coverage · ${typeList[0] ? `most common: ${esc(typeList[0][0])}` : "add more games"}.
        </div>
      `;

      const tips = [];
      if (riverPct < 22) tips.push(`River ward coverage is **low** (${riverPct}%). Try: *reset → 2 wards into river line before objective timers.*`);
      if (nearDragon + nearBaron + nearHerald < Math.max(2, Math.round(sum.total * 0.15))) {
        tips.push(`Few wards land **near major objectives**. Consider: *one in pit area + one in approach choke.*`);
      }
      const topZone = zones?.[0]?.[0];
      if (topZone) tips.push(`Top ward zone: **${topZone}**. Check if that’s intended — or autopilot spots.`);

      tipsEl.innerHTML = tips.length
        ? tips.slice(0, 5).map((t) => `<div>• ${t}</div>`).join("")
        : `<div class="text-slate-500">Not enough signal yet — add more games.</div>`;

      return;
    }

    // === Deaths/Kills breakdown (existing) ===
    const sum = summarizeEvents(filtered);
    const zones = sum.zones || [];
    const objectives = sum.objectives || [];

    const soloPct = sum.total ? Math.round((sum.solo / sum.total) * 100) : 0;
    const groupedPct = sum.total ? Math.round((sum.grouped / sum.total) * 100) : 0;
    const riverPct = sum.total ? Math.round((sum.river / sum.total) * 100) : 0;

    const objMap = new Map(objectives);
    const nearDragon = objMap.get("dragon") || 0;
    const nearBaron = objMap.get("baron") || 0;
    const nearHerald = objMap.get("herald") || 0;

    const darkCount = state.mode === "deaths" ? filtered.filter((d) => d.inVision === false).length : 0;

    breakdown.innerHTML = `
      <div class="space-y-2">
        ${barRow("Solo pick", sum.solo, sum.total)}
        ${barRow("Grouped", sum.grouped, sum.total)}
        ${barRow("River", sum.river, sum.total)}
        ${barRow("Near Dragon", nearDragon, sum.total)}
        ${barRow("Near Baron", nearBaron, sum.total)}
        ${barRow("Near Herald", nearHerald, sum.total)}
        ${state.mode === "deaths" && visionRate != null ? barRow("No ward nearby (90s)", darkCount, sum.total) : ""}
      </div>

      <div class="pt-3 border-t border-slate-100">
        <div class="text-[0.75rem] font-semibold text-slate-700 mb-2">Top zones</div>
        <div class="space-y-2">
          ${zones.slice(0, 5).map(([z, c]) => barRow(z, c, sum.total)).join("")}
        </div>
      </div>

      <div class="pt-3 border-t border-slate-100 text-[0.72rem] text-slate-500">
        Read: ${soloPct}% solo picks · ${groupedPct}% grouped · ${riverPct}% river.
      </div>
    `;

    const tipList = generateTips({
      modeLabel,
      summary: sum,
      topClusters: clusters,
      extra: visionRate != null ? { vision: visionRate } : null,
    });

    tipsEl.innerHTML = tipList.length
      ? tipList.map((t) => `<div>• ${t}</div>`).join("")
      : `<div class="text-slate-500">Not enough signal yet — add more games.</div>`;
  };

  const bind = (el, cb) => el && el.addEventListener("change", cb);

  bind(elMode, () => {
    const v = elMode.value;
    state.mode =
      v === "kills"
        ? "kills"
        : v === "wardsPlaced"
        ? "wardsPlaced"
        : v === "wardsKilled"
        ? "wardsKilled"
        : v === "dmgDealt"
        ? "dmgDealt"
        : v === "dmgTaken"
        ? "dmgTaken"
        : v === "dmgTradeLoss"
        ? "dmgTradeLoss"
        : "deaths";
    rerender();
  });

  bind(elScope, () => {
    state.scope = elScope.value === "all" ? "all" : "roster";
    rerender();
  });
  bind(elMatchSide, () => {
    state.matchSide = elMatchSide.value || "all";
    rerender();
  });
  bind(elPhase, () => {
    state.phase = elPhase.value || "all";
    rerender();
  });
  bind(elZone, () => {
    state.zone = elZone.value || "all";
    rerender();
  });
  bind(elObj, () => {
    state.objective = elObj.value || "all";
    rerender();
  });
  bind(elClusters, () => {
    state.clusters = !!elClusters.checked;
    rerender();
  });

  rerender();
}
