// components/tpiCard.js
import { computeTpi26, TPI26_DEFAULT } from "../core/tpi26.js";

function escapeHTML(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function fallbackInner(title, msg) {
  return `
    <div class="card-header">
      <div>
        <div class="card-title">${escapeHTML(title)}</div>
        <div class="card-subtitle">${escapeHTML(msg)}</div>
      </div>
    </div>
  `;
}

function badge(score) {
  return score >= 75 ? "text-emerald-600" : score >= 60 ? "text-yellow-600" : "text-rose-600";
}

function roleShort(r) {
  const R = String(r || "UNKNOWN").toUpperCase();
  if (R === "JUNGLE") return "JNG";
  if (R === "SUPPORT") return "SUP";
  return R === "UNKNOWN" ? "UNK" : R;
}

function buildContext(players) {
  const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
  return {
    meanIndiv: mean(players.map((p) => p.pillar.indiv || 0)),
    meanObj: mean(players.map((p) => p.pillar.obj || 0)),
    meanVision: mean(players.map((p) => p.pillar.vision || 0)),
    meanReli: mean(players.map((p) => p.pillar.reli || 0)),
    meanKDA: mean(players.map((p) => p.raw.kda || 0)),
    meanKP: mean(players.map((p) => p.raw.kp || 0)),
    meanDPM: mean(players.map((p) => p.raw.dpm || 0)),
    meanDmgShare: mean(players.map((p) => p.raw.dmgShare || 0)),
    meanObjPart: mean(players.map((p) => p.raw.objPart || 0)),
    meanVsMin: mean(players.map((p) => p.raw.vsMin || 0)),
    meanTimeDeadRate: mean(players.map((p) => p.raw.timeDeadRate || 0)),
  };
}

function buildPlayerDetail(p, ctx) {
  const strengths = [];
  const focus = [];

  const add = (cond, arr, text) => cond && arr.push(text);
  const ratio = (v, m) => (m > 0 ? v / m : 1);

  add(p.pillar.indiv > ctx.meanIndiv + 0.08, strengths, "Individual pillar stands out — strong output & fight value.");
  add(p.pillar.obj > ctx.meanObj + 0.08, strengths, "Objective pillar strong — converting presence into map gains.");
  add(p.pillar.vision > ctx.meanVision + 0.08, strengths, "Vision pillar strong — information control enables cleaner setups.");
  add(p.pillar.reli > ctx.meanReli + 0.08, strengths, "Reliable profile — stability and repeatable performance.");

  add(p.pillar.indiv < ctx.meanIndiv - 0.08, focus, "Increase individual fight value (damage uptime, KP, efficiency).");
  add(p.pillar.obj < ctx.meanObj - 0.08, focus, "Be earlier to objective setups & raise objective contribution.");
  add(p.pillar.vision < ctx.meanVision - 0.08, focus, "Invest more in vision + denial around objectives and lanes.");
  add(p.pillar.reli < ctx.meanReli - 0.08, focus, "Reduce volatility — aim for a consistent baseline game.");

  add(ratio(p.raw.kda, ctx.meanKDA) > 1.15, strengths, "Efficient KDA — good fight selection & survival.");
  add(ratio(p.raw.kda, ctx.meanKDA) < 0.85, focus, "Review deaths: avoid low-value deaths and overstays.");

  add(ratio(p.raw.kp, ctx.meanKP) > 1.12, strengths, "High KP — good syncing with plays.");
  add(ratio(p.raw.kp, ctx.meanKP) < 0.88, focus, "Join more high-value fights & rotations (KP below baseline).");

  add(ratio(p.raw.dpm, ctx.meanDPM) > 1.12, strengths, "Strong DPM — consistent damage contribution.");
  add(ratio(p.raw.dpm, ctx.meanDPM) < 0.88, focus, "Improve DPS uptime/positioning to impact fights more.");

  add(ratio(p.raw.dmgShare, ctx.meanDmgShare) > 1.12, strengths, "High damage share — strong carry presence.");
  add(ratio(p.raw.dmgShare, ctx.meanDmgShare) < 0.88, focus, "Find better windows to contribute damage safely.");

  add(ratio(p.raw.objPart, ctx.meanObjPart) > 1.12, strengths, "Above-average objective presence.");
  add(ratio(p.raw.objPart, ctx.meanObjPart) < 0.88, focus, "Be present for more objectives (setup + execution).");

  add(ratio(p.raw.vsMin, ctx.meanVsMin) > 1.12, strengths, "Strong vision/min — good info generation.");
  add(ratio(p.raw.vsMin, ctx.meanVsMin) < 0.88, focus, "Increase vision/min (wards + sweeping timings).");

  add(p.raw.timeDeadRate < ctx.meanTimeDeadRate * 0.85, strengths, "Good death discipline — low time spent dead.");
  add(p.raw.timeDeadRate > ctx.meanTimeDeadRate * 1.15, focus, "Too much time dead — tighten resets and risk management.");

  const uniq = (arr) => [...new Set(arr)].slice(0, 5);

  const pill = (label, v) => `
    <div class="rounded-xl border border-slate-200 bg-white/70 px-3 py-2">
      <div class="text-[0.6rem] uppercase tracking-wide text-slate-400">${label}</div>
      <div class="text-[0.95rem] font-semibold text-slate-900">${Math.round(v * 100)}</div>
    </div>
  `;

  return `
    <div class="p-4 rounded-2xl border border-emerald-100 bg-emerald-50/40">
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div class="text-xs uppercase tracking-wide text-slate-500">Total Player Impact</div>
          <div class="text-2xl font-semibold text-slate-900">
            ${p.impact.toFixed(0)}
            <span class="text-xs text-slate-500 font-normal ml-2">Games: ${p.games}${p.isGuest ? " · ⭐ low sample" : ""}</span>
          </div>
        </div>

        <div class="grid grid-cols-4 gap-2 w-full sm:w-auto">
          ${pill("Indiv", p.pillar.indiv)}
          ${pill("Obj", p.pillar.obj)}
          ${pill("Vision", p.pillar.vision)}
          ${pill("Reli", p.pillar.reli)}
        </div>
      </div>

      <div class="grid sm:grid-cols-2 gap-3 mt-3 text-sm">
        <div>
          <div class="font-semibold mb-1">🔥 Strengths</div>
          ${
            uniq(strengths).length
              ? uniq(strengths).map((t) => `<div class="mb-1">• ${t}</div>`).join("")
              : `<div class="text-slate-600">Solid, balanced profile so far.</div>`
          }
        </div>

        <div>
          <div class="font-semibold mb-1">🎯 Focus Points</div>
          ${
            uniq(focus).length
              ? uniq(focus).map((t) => `<div class="mb-1">• ${t}</div>`).join("")
              : `<div class="text-slate-600">No major red flags — push existing strengths.</div>`
          }
        </div>
      </div>
    </div>
  `;
}

function renderCardInner(mount, players, meta, opts) {
  const title = opts.title || "Total Player Impact";
  const subtitle =
    opts.subtitle ||
    "4-pillar impact score (Individual · Objectives · Vision · Reliability), role-aware and sample-size stabilized.";
  const cfg = opts.config || TPI26_DEFAULT;

  const trendCell = (p) => {
    if (!p.playedLast) return `<span class="text-slate-300" title="Did not play most recent match.">•</span>`;
    if (!p.trendOk || typeof p.delta !== "number")
      return `<span class="text-slate-400" title="Not enough prior games to compare (no baseline excluding last match).">•</span>`;

    const d = p.delta;
    const up = d >= cfg.TREND_UP;
    const down = d <= cfg.TREND_DOWN;

    const cls = up ? "text-emerald-600" : down ? "text-rose-600" : "text-slate-400";
    const symbol = up ? "▲" : down ? "▼" : "•";
    const txt = up ? `${symbol}${d.toFixed(1)}` : down ? `${symbol}${Math.abs(d).toFixed(1)}` : "•";
    return `<span class="${cls}" title="Trend = last match impact minus baseline (excluding last match).">${txt}</span>`;
  };

  const roleChip = (rb, isMain) => {
    const pct = Math.round((rb.share || 0) * 100);
    const g = rb.count || 0;
    const base = "inline-flex items-center px-2 py-0.5 rounded-full text-[0.65rem] border";
    const cls = isMain ? "bg-orange-50 text-orange-700 border-orange-200" : "bg-white/70 text-slate-700 border-slate-200";
    return `<span class="${base} ${cls}" title="${escapeHTML(rb.role)} — ${g} games (${pct}%)">
      <span class="font-semibold">${roleShort(rb.role)}</span>
      <span class="opacity-60">·</span>
      <span class="opacity-80">${pct}%</span>
      <span class="opacity-60">·</span>
      <span class="opacity-80">${g}g</span>
    </span>`;
  };

  const rowsHTML = players
    .map((p) => {
      const rb = p.roleBreakdown || [];
      const chips = rb.slice(0, 3).map((x, i) => roleChip(x, i === 0)).join("");

      const guestTag = p.isGuest
        ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[0.65rem] border bg-yellow-50 text-yellow-700 border-yellow-200"
             title="Low sample size — season score shrunk toward dataset mean.">⭐ low sample</span>`
        : "";

      return `
        <tr data-ln-tpi-player="${escapeHTML(p.name)}" class="hover:bg-orange-50/40 transition cursor-pointer">
          <td class="px-4 py-2 align-middle">
            <div class="min-w-0">
              <div class="font-medium text-slate-900 truncate">${escapeHTML(p.name)}</div>
              <div class="mt-1 flex flex-wrap gap-1.5 items-center">
                ${chips}
                ${guestTag}
              </div>
            </div>
          </td>

          <td class="px-4 py-2 text-right align-middle font-semibold ${badge(p.impact)}">
            ${p.impact.toFixed(0)}
          </td>

          <td class="px-4 py-2 text-right align-middle text-[0.75rem]">
            ${trendCell(p)}
          </td>

          <td class="px-4 py-2 text-right align-middle text-slate-600">
            ${p.games}
          </td>
        </tr>
      `;
    })
    .join("");

  const playerButtons = `
    <div class="mt-3 flex flex-wrap gap-2 px-4">
      ${players
        .map(
          (p) => `
          <button
            class="px-2.5 py-1 rounded-full text-xs border border-gray-200 hover:border-orange-400 hover:text-orange-500 transition ln-tpi-player-btn"
            data-ln-tpi-player="${escapeHTML(p.name)}">
            ${escapeHTML(p.name)}
          </button>
        `
        )
        .join("")}
    </div>
  `;

  const detailBox = `
    <div id="ln-tpi-player-detail"
         class="mt-4 px-4 pb-4 hidden opacity-0 translate-y-2 transition-all duration-300 ease-out"></div>
  `;

  const infoBox = `
    <div class="mt-3 px-4 pb-4 border-t pt-3">
      <button
        data-ln-tpi-toggle-info
        class="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-orange-600 transition">
        <span>ℹ️ How is Total Player Impact calculated?</span>
        <span data-ln-tpi-info-arrow class="transition-transform">▼</span>
      </button>

      <div data-ln-tpi-info-content class="hidden text-sm text-gray-600 mt-2 leading-relaxed">
        <p><strong>Total Player Impact</strong> (40–100) is a relative score <em>inside this dataset</em>. It blends 4 pillars:</p>
        <ul class="list-disc ml-5 mt-1 space-y-1">
          <li><strong>Individual</strong>: KDA, KP, damage share, DPM, gold/min, CS/min, first-blood involvement.</li>
          <li><strong>Objectives</strong>: objective kills, weighted objective participation, plates, objective damage.</li>
          <li><strong>Vision</strong>: vision score/min, wards/min, wards killed/min, denial, enemy-jungle warding, pink efficiency.</li>
          <li><strong>Reliability</strong>: consistency + stability + macro consistency + performance rating, with safer death patterns rewarded.</li>
        </ul>
        <p class="mt-2 text-xs text-gray-500">
          Metrics are winsorized (5–95%), normalized inside the dataset, and low-sample players are shrunk toward the mean.
          <br/>
          <strong>Trend (Δ)</strong> compares the most recent match to the baseline (excluding last match).
        </p>
      </div>
    </div>
  `;

  const lastTag = meta?.lastMatchId
    ? `<div class="px-4 pt-2 text-[0.7rem] text-slate-500">Trend reference: <span class="font-semibold">${escapeHTML(meta.lastMatchId)}</span></div>`
    : "";

  mount.innerHTML = `
    <div class="card-header">
      <div>
        <div class="card-title">${escapeHTML(title)}</div>
        <div class="card-subtitle">${escapeHTML(subtitle)}</div>
      </div>
    </div>

    ${lastTag}

    <div class="mt-3 overflow-x-auto">
      <table class="w-full border-collapse text-sm">
        <thead>
          <tr class="bg-gray-50 text-gray-600">
            <th class="px-4 py-2 text-left font-semibold">Player</th>
            <th class="px-4 py-2 text-right font-semibold">TPI</th>
            <th class="px-4 py-2 text-right font-semibold">Δ</th>
            <th class="px-4 py-2 text-right font-semibold">Games</th>
          </tr>
        </thead>
        <tbody>${rowsHTML}</tbody>
      </table>

      <div class="mt-2 px-4 text-[0.65rem] text-slate-400">
        Δ is last match vs baseline (excluding last match). Players not in last match show •.
      </div>
    </div>

    ${playerButtons}
    ${detailBox}
    ${infoBox}
  `;
}

function bindInteractions(mount, players) {
  const ctx = buildContext(players);
  const detailEl = mount.querySelector("#ln-tpi-player-detail");

  const showPlayer = (name) => {
    if (!detailEl) return;
    const p = players.find((x) => x.name === name);
    if (!p) return;

    detailEl.innerHTML = buildPlayerDetail(p, ctx);
    detailEl.classList.remove("hidden", "opacity-0", "translate-y-2");
    requestAnimationFrame(() => detailEl.classList.add("opacity-100"));
  };

  mount.querySelectorAll("tr[data-ln-tpi-player]").forEach((row) => {
    row.addEventListener("click", () => showPlayer(row.getAttribute("data-ln-tpi-player")));
  });

  mount.querySelectorAll(".ln-tpi-player-btn").forEach((btn) => {
    btn.addEventListener("click", () => showPlayer(btn.getAttribute("data-ln-tpi-player")));
  });

  const infoBtn = mount.querySelector("[data-ln-tpi-toggle-info]");
  const infoContent = mount.querySelector("[data-ln-tpi-info-content]");
  const arrow = mount.querySelector("[data-ln-tpi-info-arrow]");
  if (infoBtn && infoContent && arrow) {
    infoBtn.addEventListener("click", () => {
      const hidden = infoContent.classList.contains("hidden");
      infoContent.classList.toggle("hidden");
      arrow.style.transform = hidden ? "rotate(180deg)" : "rotate(0deg)";
    });
  }
}

export function mountTpiCard(mountEl, rows, opts = {}) {
  if (!mountEl) throw new Error("mountTpiCard: missing mount element");

  // ensure it matches your other cards
  if (!mountEl.classList.contains("dashboard-card")) mountEl.classList.add("dashboard-card");

  if (!rows || !rows.length) {
    mountEl.innerHTML = fallbackInner(opts.title || "Total Player Impact", "No data yet.");
    return;
  }

  const config = opts.config || TPI26_DEFAULT;
  const { players, meta } = computeTpi26(rows, { config, roster: opts.roster || null });

  if (!players.length) {
    mountEl.innerHTML = fallbackInner(opts.title || "Total Player Impact", "No players found in scope.");
    return;
  }

  renderCardInner(mountEl, players, meta, { ...opts, config });
  bindInteractions(mountEl, players);
}
