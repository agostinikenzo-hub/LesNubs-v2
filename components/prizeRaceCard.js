// /components/prizeRaceCard.js
import { computePrizeRace, PRIZE_RACE_DEFAULT } from "../core/prizeRace.js";

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function injectPrizeRaceStylesOnce() {
  if (document.getElementById("ln-prize-race-style")) return;

  const style = document.createElement("style");
  style.id = "ln-prize-race-style";
  style.textContent = `
    body.s26 .ln-prize-top3{
      display:grid;
      grid-template-columns: repeat(3, minmax(0,1fr));
      gap: .75rem;
      margin-top: .85rem;
    }
    @media (max-width: 800px){
      body.s26 .ln-prize-top3{ grid-template-columns: 1fr; }
    }

    body.s26 .ln-prize-slot{
      border-radius: 1.2rem;
      border: 1px solid rgba(226,232,240,0.95);
      background: rgba(255,255,255,0.65);
      padding: .85rem .9rem;
      box-shadow: 0 12px 34px rgba(15,23,42,0.06);
    }
    body.s26 .ln-prize-rank{
      font-weight: 900;
      letter-spacing: -0.02em;
      font-size: .85rem;
      color: rgba(15,23,42,0.65);
    }
    body.s26 .ln-prize-name{
      font-weight: 900;
      letter-spacing: -0.02em;
      font-size: 1.05rem;
      color: #0f172a;
      margin-top: .25rem;
    }
    body.s26 .ln-prize-score{
      margin-top: .15rem;
      font-variant-numeric: tabular-nums;
      font-weight: 900;
      color: var(--ln-orange, #ff8000);
    }

    body.s26 .ln-prize-meta{
      margin-top: .55rem;
      display:flex;
      flex-wrap: wrap;
      gap: .35rem .5rem;
      font-size: .75rem;
      color: rgba(100,116,139,0.9);
    }
    body.s26 .ln-prize-chip{
      border-radius: 999px;
      padding: .18rem .55rem;
      border: 1px solid rgba(226,232,240,0.95);
      background: rgba(255,255,255,0.75);
      font-weight: 800;
      font-variant-numeric: tabular-nums;
    }
    body.s26 .ln-prize-chip--rp{
      border-color: rgba(255,128,0,0.22);
      background: rgba(255,128,0,0.10);
      color: #c2410c;
    }

    body.s26 .ln-prize-controls{
      margin-top: .75rem;
      display:flex;
      flex-wrap: wrap;
      gap: .5rem;
      align-items:center;
      justify-content: space-between;
    }
    body.s26 .ln-prize-toggle{
      display:inline-flex;
      align-items:center;
      gap: .5rem;
      padding: .45rem .7rem;
      border-radius: 999px;
      border: 1px solid rgba(226,232,240,0.95);
      background: rgba(255,255,255,0.8);
      font-size: .78rem;
      font-weight: 900;
      color: rgba(15,23,42,0.78);
      transition: border-color .2s ease, transform .2s ease;
      cursor:pointer;
    }
    body.s26 .ln-prize-toggle:hover{
      transform: translateY(-1px);
      border-color: rgba(249,115,22,0.22);
    }

    body.s26 .ln-prize-prizebox{
      display:flex;
      align-items:center;
      gap: .45rem;
      padding: .45rem .7rem;
      border-radius: 999px;
      border: 1px solid rgba(226,232,240,0.95);
      background: rgba(255,255,255,0.80);
      font-size: .78rem;
      font-weight: 900;
      color: rgba(15,23,42,0.78);
      white-space: nowrap;
    }
    body.s26 .ln-prize-prizebox input{
      width: 92px;
      border: 1px solid rgba(226,232,240,0.95);
      background: rgba(255,255,255,0.85);
      border-radius: 999px;
      padding: .25rem .55rem;
      font-size: .78rem;
      font-weight: 900;
      color: rgba(15,23,42,0.85);
      outline: none;
    }

    body.s26 .ln-prize-table{
      width:100%;
      border-collapse: collapse;
      margin-top: .85rem;
      font-size: .85rem;
    }
    body.s26 .ln-prize-table th{
      text-align:left;
      padding: .55rem .75rem;
      color: rgba(100,116,139,0.9);
      font-size: .75rem;
      font-weight: 900;
      background: rgba(248,250,252,0.9);
      border-bottom: 1px solid rgba(226,232,240,0.95);
    }
    body.s26 .ln-prize-table td{
      padding: .55rem .75rem;
      border-bottom: 1px solid rgba(226,232,240,0.75);
      vertical-align: middle;
    }
    body.s26 .ln-prize-row:hover{
      background: rgba(249,115,22,0.06);
    }
    body.s26 .ln-prize-score-small{
      font-weight: 900;
      color: rgba(15,23,42,0.8);
      font-variant-numeric: tabular-nums;
      text-align:right;
    }
    body.s26 .ln-prize-sub{
      color: rgba(100,116,139,0.8);
      font-size: .72rem;
      margin-top: .1rem;
    }
  `;
  document.head.appendChild(style);
}

function pct(x) {
  return `${Math.round((Number(x) || 0) * 100)}%`;
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// normalize computePrizeRace return into a plain array
function normalizeEntries(input) {
  let entries = input?.entries ?? input?.rows ?? input;

  if (entries instanceof Map) entries = [...entries.values()];

  if (entries && !Array.isArray(entries) && typeof entries[Symbol.iterator] === "function") {
    entries = Array.from(entries);
  }

  if (
    Array.isArray(entries) &&
    Array.isArray(entries[0]) &&
    entries[0].length === 2 &&
    typeof entries[0][1] === "object"
  ) {
    entries = entries.map((pair) => pair[1]);
  }

  return Array.isArray(entries) ? entries : [];
}

/**
 * Compute payout for rank 1..3 from a prize pool (RP) and split (fractions).
 * Example split: [0.5, 0.3, 0.2]
 */
function payoutAmount(prizePoolRp, rank, split = [0.5, 0.3, 0.2]) {
  const pool = Math.max(0, Math.floor(num(prizePoolRp)));
  const r = num(rank);

  if (!pool || r < 1 || r > 3) return 0;

  const s = Array.isArray(split) ? split.slice(0, 3).map(num) : [0.5, 0.3, 0.2];
  const sum = s.reduce((a, b) => a + b, 0) || 1;
  const norm = s.map((x) => (x > 0 ? x / sum : 0));

  const amt = Math.round(pool * (norm[r - 1] || 0));
  return Math.max(0, amt);
}

/**
 * If your core doesn’t return per-player weights, we can reconstruct “effective weights”
 * (renormalize if a queue is missing and IGNORE_MISSING_QUEUES is on).
 */
function effectiveWeightsForPlayer(baseWeights, cfg, haveTeam, haveSolo, haveFlex) {
  let w = { ...baseWeights };

  if (cfg.IGNORE_MISSING_QUEUES) {
    const sum =
      (haveTeam ? w.TEAM : 0) +
      (haveSolo ? w.SOLO : 0) +
      (haveFlex ? w.FLEX : 0);

    if (sum > 0) {
      w.TEAM = haveTeam ? w.TEAM / sum : 0;
      w.SOLO = haveSolo ? w.SOLO / sum : 0;
      w.FLEX = haveFlex ? w.FLEX / sum : 0;
    }
  }

  return w;
}

export function mountPrizeRaceCard(el, data, opts = {}) {
  injectPrizeRaceStylesOnce();
  if (!el) return;
  if (!el.classList.contains("dashboard-card")) el.classList.add("dashboard-card");

  // local defaults for payout UI
  const cfg = {
    PRIZE_POOL_RP: 0,
    PAYOUT_SPLIT: [0.5, 0.3, 0.2],
    ...PRIZE_RACE_DEFAULT,
    ...(opts.config || {}),
  };

  const teamRows = data?.teamRows || [];
  const soloRows = data?.soloRows || [];
  const flexRows = data?.flexRows || [];
  const roster = opts.roster || cfg.roster || null;

  if (!teamRows.length && !soloRows.length && !flexRows.length) {
    el.innerHTML = `
      <div class="card-header">
        <div>
          <div class="card-title">Prize Pool — Race</div>
          <div class="card-subtitle">No data loaded yet.</div>
        </div>
      </div>
      <div class="text-sm text-slate-500">Provide teamRows/soloRows/flexRows.</div>
    `;
    return;
  }

  const state = {
    includeSoloFlex: true,
    prizePoolRp: num(cfg.PRIZE_POOL_RP),
  };

  const render = () => {
    const baseWeights = state.includeSoloFlex
      ? cfg.WEIGHTS
      : { TEAM: 1.0, SOLO: 0.0, FLEX: 0.0 };

    // ✅ current core signature
    const computed = computePrizeRace(
      { teamRows, soloRows, flexRows },
      { roster, config: { ...cfg, WEIGHTS: baseWeights } }
    );

    // Normalize to array
    const rawEntries = normalizeEntries(computed);

    // Normalize entry fields (score/prizeScore/rank)
    const entries = rawEntries
      .map((p, idx) => {
        const prizeScore = num(p?.prizeScore ?? p?.score ?? p?.total ?? 0);
        const rank = num(p?.rank) || (idx + 1);

        const haveTeam = p?.breakdown?.teamTpi != null || p?.teamTpi != null || p?.games?.team > 0;
        const haveSolo = p?.breakdown?.soloTpi != null || p?.soloTpi != null || p?.games?.solo > 0;
        const haveFlex = p?.breakdown?.flexTpi != null || p?.flexTpi != null || p?.games?.flex > 0;

        const w = p?.weights || effectiveWeightsForPlayer(baseWeights, cfg, haveTeam, haveSolo, haveFlex);

        // pentas count if available; otherwise show penta rate if core provides it
        const pentas =
          (p?.pentas?.team || 0) + (p?.pentas?.solo || 0) + (p?.pentas?.flex || 0);

        const pentaRate = num(p?.breakdown?.pentaRate ?? p?.pentaRate ?? 0);

        const games = p?.games || { team: 0, solo: 0, flex: 0 };

        return {
          name: p?.name ?? "—",
          prizeScore,
          rank,
          weights: w,
          games,
          pentas,
          pentaRate,
          breakdown: p?.breakdown || {},
        };
      })
      .sort((a, b) => b.prizeScore - a.prizeScore)
      .map((p, i) => ({ ...p, rank: i + 1 }));

    const top3 = entries.slice(0, 3);
    const list = entries.slice(0, 12);

    const payoutSplit = Array.isArray(cfg.PAYOUT_SPLIT) ? cfg.PAYOUT_SPLIT : [0.5, 0.3, 0.2];

    const top3Html = top3
      .map((p) => {
        const w = p.weights || { TEAM: 0, SOLO: 0, FLEX: 0 };
        const rp = payoutAmount(state.prizePoolRp, p.rank, payoutSplit);

        const pentaChip =
          p.pentas > 0
            ? `<span class="ln-prize-chip">Pentas ${p.pentas}</span>`
            : `<span class="ln-prize-chip">Penta rate ${(p.pentaRate || 0).toFixed(2)}/g</span>`;

        return `
          <div class="ln-prize-slot">
            <div class="ln-prize-rank">#${p.rank}</div>
            <div class="ln-prize-name">${esc(p.name)}</div>
            <div class="ln-prize-score">${p.prizeScore.toFixed(2)}</div>

            <div class="ln-prize-meta">
              <span class="ln-prize-chip">5-stack ${pct(w.TEAM)}</span>
              <span class="ln-prize-chip">Solo ${pct(w.SOLO)}</span>
              <span class="ln-prize-chip">Flex ${pct(w.FLEX)}</span>
              ${pentaChip}
              ${
                state.prizePoolRp > 0
                  ? `<span class="ln-prize-chip ln-prize-chip--rp">Potential: ${rp} RP</span>`
                  : ``
              }
            </div>

            <div class="ln-prize-sub">
              Games — 5: ${p.games?.team || 0} · Solo: ${p.games?.solo || 0} · Flex: ${p.games?.flex || 0}
            </div>
          </div>
        `;
      })
      .join("");

    const rowsHtml = list
      .map((p) => {
        const rp = payoutAmount(state.prizePoolRp, p.rank, payoutSplit);

        return `
          <tr class="ln-prize-row">
            <td style="width:56px; font-weight:900; color: rgba(15,23,42,0.65);">#${p.rank}</td>
            <td style="font-weight:900; color:#0f172a;">${esc(p.name)}</td>
            <td class="ln-prize-score-small">${p.prizeScore.toFixed(2)}</td>
            <td style="text-align:right; color: rgba(100,116,139,0.9); font-variant-numeric: tabular-nums;">
              ${p.games?.team || 0}
            </td>
            <td style="text-align:right; color: rgba(100,116,139,0.9); font-variant-numeric: tabular-nums;">
              ${p.games?.solo || 0}
            </td>
            <td style="text-align:right; color: rgba(100,116,139,0.9); font-variant-numeric: tabular-nums;">
              ${p.games?.flex || 0}
            </td>
            <td style="text-align:right; color: rgba(100,116,139,0.9); font-variant-numeric: tabular-nums;">
              ${p.pentas || 0}
            </td>
            ${
              state.prizePoolRp > 0
                ? `<td style="text-align:right; color:#c2410c; font-weight:900; font-variant-numeric: tabular-nums;">
                     ${p.rank <= 3 ? `${rp} RP` : "—"}
                   </td>`
                : ""
            }
          </tr>
        `;
      })
      .join("");

    const showRpCol = state.prizePoolRp > 0;

    el.innerHTML = `
      <div class="card-header">
        <div>
          <div class="card-title">Prize Pool — Race</div>
          <div class="card-subtitle">
            Built from TPI (role-aware), with 5-stack priority + small penta bonus.
          </div>
        </div>
        <div class="pill" title="Live leaderboard">
          <span style="color: var(--ln-orange); font-weight: 900;">🏆</span>
          Live
        </div>
      </div>

      <div class="ln-prize-controls px-4">
        <button class="ln-prize-toggle" data-ln-prize-toggle>
          ${state.includeSoloFlex ? "Including Solo/Flex bonuses" : "5-stack only"}
        </button>

        <div class="ln-prize-prizebox">
          Prize Pool (RP)
          <input
            data-ln-prize-pool
            type="number"
            min="0"
            step="50"
            value="${Math.max(0, Math.floor(state.prizePoolRp))}"
            title="Set the total Riot Points prize pool"
          />
          <span style="opacity:.65;">· Split ${Math.round((payoutSplit[0]||0)*100)}/${Math.round((payoutSplit[1]||0)*100)}/${Math.round((payoutSplit[2]||0)*100)}</span>
        </div>

        <div class="text-[0.72rem] text-slate-500">
          Weights: ${Math.round(baseWeights.TEAM * 100)} / ${Math.round(baseWeights.SOLO * 100)} / ${Math.round(baseWeights.FLEX * 100)}
          · Team min games: ${cfg.TEAM_MIN_GAMES}
        </div>
      </div>

      <div class="px-4">
        <div class="ln-prize-top3">${top3Html || ""}</div>

        <div class="mt-4 overflow-x-auto">
          <table class="ln-prize-table">
            <thead>
              <tr>
                <th style="width:56px;">Rank</th>
                <th>Player</th>
                <th style="text-align:right;">Score</th>
                <th style="text-align:right;">5</th>
                <th style="text-align:right;">Solo</th>
                <th style="text-align:right;">Flex</th>
                <th style="text-align:right;">Pentas</th>
                ${showRpCol ? `<th style="text-align:right;">Prize</th>` : ""}
              </tr>
            </thead>
            <tbody>
              ${
                rowsHtml ||
                `<tr><td colspan="${showRpCol ? 8 : 7}" class="text-slate-500">No eligible players yet.</td></tr>`
              }
            </tbody>
          </table>
        </div>

        <div class="mt-2 text-[0.65rem] text-slate-400 pb-4">
          Note: pentas are a small z-score bonus. If Prize Pool is set, Top 3 show potential RP payout.
        </div>
      </div>
    `;

    const toggle = el.querySelector("[data-ln-prize-toggle]");
    if (toggle) {
      toggle.addEventListener("click", () => {
        state.includeSoloFlex = !state.includeSoloFlex;
        render();
      });
    }

    const inp = el.querySelector("[data-ln-prize-pool]");
    if (inp) {
      inp.addEventListener("input", () => {
        state.prizePoolRp = clamp(num(inp.value), 0, 1_000_000);
        render();
      });
    }
  };

  render();
}
