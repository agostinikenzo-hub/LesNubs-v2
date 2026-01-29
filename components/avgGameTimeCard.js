// /components/avgGameTimeCard.js

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function num(v) {
  if (v === null || v === undefined || v === "") return NaN;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function fmtMMSS(seconds) {
  if (!Number.isFinite(seconds)) return "—";
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${pad2(r)}`;
}

function fmtShortDate(d) {
  if (!(d instanceof Date) || isNaN(d.getTime())) return "—";
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}`;
}

function pick(obj, keys) {
  for (const k of keys) if (k in obj && obj[k] !== "") return obj[k];
  return "";
}

// Parses "mm:ss" or "hh:mm:ss" to seconds
function parseClockToSeconds(v) {
  const s = String(v ?? "").trim();
  if (!s.includes(":")) return NaN;

  const parts = s.split(":").map((x) => x.trim());
  if (parts.some((p) => p === "" || isNaN(Number(p)))) return NaN;

  if (parts.length === 2) {
    const mm = Number(parts[0]);
    const ss = Number(parts[1]);
    if (!Number.isFinite(mm) || !Number.isFinite(ss)) return NaN;
    return mm * 60 + ss;
  }

  if (parts.length === 3) {
    const hh = Number(parts[0]);
    const mm = Number(parts[1]);
    const ss = Number(parts[2]);
    if (![hh, mm, ss].every(Number.isFinite)) return NaN;
    return hh * 3600 + mm * 60 + ss;
  }

  return NaN;
}

function getWin(row) {
  const raw = row?._raw ?? row ?? {};
  const v = row?.win ?? raw.win ?? raw["p.win"] ?? raw.Result;
  if (typeof v === "boolean") return v;
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "win") return true;
  if (s === "loss") return false;
  return s === "1" || s === "true" || s === "yes";
}

function getPlayer(row) {
  const raw = row?._raw ?? row ?? {};
  return String(
    row?.player ??
      raw["p.riotIdGameName"] ??
      raw.Player ??
      raw["p.summonerName"] ??
      "—"
  ).trim();
}

function getTimeSec(row) {
  // Prefer normalized if present (future-proof)
  if (Number.isFinite(row?.timePlayedSec)) return row.timePlayedSec;

  const raw = row?._raw ?? row ?? {};

  // 1) Best: Riot official seconds
  const v1 = pick(raw, ["p.timePlayed", "timePlayed"]);
  const clock1 = parseClockToSeconds(v1);
  if (Number.isFinite(clock1)) return clock1;
  const n1 = num(v1);
  if (Number.isFinite(n1) && n1 > 0) return n1;

  // 2) Next best: gameLength (often seconds float)
  const v2 = pick(raw, ["p.challenges.gameLength", "challenges.gameLength"]);
  const clock2 = parseClockToSeconds(v2);
  if (Number.isFinite(clock2)) return clock2;
  const n2 = num(v2);
  if (Number.isFinite(n2) && n2 > 0) return n2;

  // 3) LAST resort: TIME (could be minutes depending on sheet)
  const v3 = pick(raw, ["TIME"]);
  const clock3 = parseClockToSeconds(v3);
  if (Number.isFinite(clock3)) return clock3;

  const n3 = num(v3);
  if (Number.isFinite(n3) && n3 > 0) {
    // If TIME looks like minutes, convert cautiously
    if (n3 >= 10 && n3 <= 70) return n3 * 60;
    return n3;
  }

  return NaN;
}

function mean(arr) {
  if (!arr.length) return NaN;
  return arr.reduce((s, x) => s + x, 0) / arr.length;
}

export function mountAvgGameTimeCard(el, rows, opts = {}) {
  if (!el) return;

  const minSeconds = Number.isFinite(opts.minSeconds) ? opts.minSeconds : 240; // remakes < 4:00
  const maxSeconds = Number.isFinite(opts.maxSeconds) ? opts.maxSeconds : 70 * 60; // outliers > 70:00

  const rosterOrder = Array.isArray(opts.rosterOrder)
    ? opts.rosterOrder.map((s) => String(s ?? "").trim()).filter(Boolean)
    : [];

  // ✅ module-scoped CSS to fix alignment & header layout deterministically
  if (!document.getElementById("s26-avgtime-style")) {
    const st = document.createElement("style");
    st.id = "s26-avgtime-style";
    st.textContent = `
      body.s26 .avgtime-head{
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap: 1rem;
        flex-wrap:wrap;
      }

      body.s26 .avgtime-chips{
        display:flex;
        flex-direction:column;
        align-items:flex-end;
        gap: .45rem;
      }
      body.s26 .avgtime-chips-row{
        display:flex;
        gap:.5rem;
        flex-wrap:wrap;
        justify-content:flex-end;
      }

      body.s26 .avgtime-chip{
        display:inline-flex; align-items:center; gap:.4rem;
        padding:.26rem .58rem;
        border-radius:999px;
        border:1px solid rgba(148,163,184,.45);
        background:rgba(255,255,255,.65);
        color:#334155;
        font-size:.72rem;
        font-weight:800;
        letter-spacing:-0.01em;
        white-space:nowrap;
      }
      body.s26 .avgtime-chip strong{ font-weight:900; color:#0f172a; }

      /* ✅ force numeric alignment even if global table styles override */
      body.s26 .s26-table th.avgtime-num,
      body.s26 .s26-table td.avgtime-num{
        text-align:right !important;
        font-variant-numeric: tabular-nums;
      }

      body.s26 .avgtime-row-fast td{ background: rgba(16,185,129,0.06); }
      body.s26 .avgtime-row-slow td{ background: rgba(249,115,22,0.07); }
      body.s26 .avgtime-muted{ color: rgba(100,116,139,0.85); }
    `;
    document.head.appendChild(st);
  }

  if (!rows || !rows.length) {
    el.innerHTML = `
      <div class="card-header">
        <div>
          <div class="card-title">Average Game Time</div>
          <div class="card-subtitle">No data.</div>
        </div>
      </div>
    `;
    return;
  }

  // Parse rows once
  const parsed = (rows || []).map((r) => ({
    row: r,
    player: getPlayer(r),
    win: getWin(r),
    timeSec: getTimeSec(r),
    date: r?.date instanceof Date && !isNaN(r.date.getTime()) ? r.date : null,
  }));

  const withPlayer = parsed.filter((x) => x.player && x.player !== "—");
  const ignoredNoTime = withPlayer.filter((x) => !Number.isFinite(x.timeSec) || x.timeSec <= 0).length;

  // Only rows with valid time are eligible for filtering
  const validTime = withPlayer.filter((x) => Number.isFinite(x.timeSec) && x.timeSec > 0);

  const removedRemakes = validTime.filter((x) => x.timeSec < minSeconds).length;
  const removedOutliers = validTime.filter((x) => x.timeSec > maxSeconds).length;

  const filtered = validTime.filter((x) => x.timeSec >= minSeconds && x.timeSec <= maxSeconds);

  if (!filtered.length) {
    el.innerHTML = `
      <div class="card-header">
        <div>
          <div class="card-title">Average Game Time</div>
          <div class="card-subtitle">No games after filtering remakes/outliers.</div>
        </div>
      </div>
    `;
    return;
  }

  // Overall stats (FILTERED)
  const filteredMatches = filtered.length;
  const wins = filtered.filter((x) => x.win === true);
  const losses = filtered.filter((x) => x.win === false);

  const avgAll = mean(filtered.map((x) => x.timeSec));
  const avgW = mean(wins.map((x) => x.timeSec));
  const avgL = mean(losses.map((x) => x.timeSec));

  let shortest = filtered[0];
  let longest = filtered[0];
  for (const x of filtered) {
    if (x.timeSec < shortest.timeSec) shortest = x;
    if (x.timeSec > longest.timeSec) longest = x;
  }

  // Per-player aggregation (FILTERED)
  const byPlayer = new Map();
  for (const x of filtered) {
    if (!byPlayer.has(x.player)) {
      byPlayer.set(x.player, {
        player: x.player,
        games: 0,
        times: [],
        wTimes: [],
        lTimes: [],
        min: null,
        max: null,
      });
    }
    const p = byPlayer.get(x.player);
    p.games += 1;
    p.times.push(x.timeSec);
    if (x.win === true) p.wTimes.push(x.timeSec);
    if (x.win === false) p.lTimes.push(x.timeSec);

    if (!p.min || x.timeSec < p.min.timeSec) p.min = x;
    if (!p.max || x.timeSec > p.max.timeSec) p.max = x;
  }

  // Build player rows
  let players = [...byPlayer.values()].map((p) => ({
    player: p.player,
    games: p.games,
    avg: mean(p.times),
    avgW: p.wTimes.length ? mean(p.wTimes) : NaN,
    avgL: p.lTimes.length ? mean(p.lTimes) : NaN,
    min: p.min,
    max: p.max,
  }));

  // Optional: include roster players with 0 games (so “Per player” can match roster)
  if (rosterOrder.length) {
    const present = new Set(players.map((p) => p.player));
    for (const name of rosterOrder) {
      if (!present.has(name)) {
        players.push({
          player: name,
          games: 0,
          avg: NaN,
          avgW: NaN,
          avgL: NaN,
          min: null,
          max: null,
        });
      }
    }
  }

  // Sort fastest → slowest, but keep 0-game players at bottom
  players.sort((a, b) => {
    const ag = a.games > 0;
    const bg = b.games > 0;
    if (ag !== bg) return ag ? -1 : 1;

    const aa = a.games > 0 && Number.isFinite(a.avg) ? a.avg : Infinity;
    const bb = b.games > 0 && Number.isFinite(b.avg) ? b.avg : Infinity;
    if (aa !== bb) return aa - bb;

    return String(a.player).localeCompare(String(b.player));
  });

  // Fastest/slowest among players with games>0 only
  const played = players.filter((p) => p.games > 0 && Number.isFinite(p.avg));
  const fastestName = played.length ? played[0].player : "";
  const slowestName = played.length ? played[played.length - 1].player : "";

  // Header chips: split into two stable rows
  const chips = `
    <div class="avgtime-chips">
      <div class="avgtime-chips-row">
        <span class="avgtime-chip">Raw (valid time): <strong>${validTime.length}</strong></span>
        <span class="avgtime-chip">Matches (filtered): <strong>${filteredMatches}</strong></span>
        <span class="avgtime-chip">Remakes: <strong>${removedRemakes}</strong></span>
        <span class="avgtime-chip">Outliers: <strong>${removedOutliers}</strong></span>
        ${ignoredNoTime ? `<span class="avgtime-chip">Ignored (no time): <strong>${ignoredNoTime}</strong></span>` : ``}
      </div>
      <div class="avgtime-chips-row">
        <span class="avgtime-chip">Shortest: <strong>${escapeHtml(shortest.player)}</strong> ${fmtMMSS(shortest.timeSec)}</span>
        <span class="avgtime-chip">Longest: <strong>${escapeHtml(longest.player)}</strong> ${fmtMMSS(longest.timeSec)}</span>
      </div>
    </div>
  `;

  const stat = (label, value, hint) => `
    <div class="s26-stat">
      <div class="s26-stat-label">${label}</div>
      <div class="s26-stat-value">${value}</div>
      ${hint ? `<div class="s26-stat-hint">${hint}</div>` : ``}
    </div>
  `;

  const tableRows = players
    .map((p) => {
      if (p.games <= 0) {
        return `
          <tr>
            <td class="font-semibold text-slate-900">${escapeHtml(p.player)}</td>
            <td class="avgtime-num avgtime-muted">0</td>
            <td class="avgtime-num avgtime-muted">—</td>
            <td class="avgtime-num avgtime-muted">—</td>
            <td class="avgtime-num avgtime-muted">—</td>
            <td class="avgtime-num avgtime-muted">—</td>
            <td class="avgtime-num avgtime-muted">—</td>
          </tr>
        `;
      }

      const minTxt = p.min ? fmtMMSS(p.min.timeSec) : "—";
      const maxTxt = p.max ? fmtMMSS(p.max.timeSec) : "—";
      const wTxt = Number.isFinite(p.avgW) ? fmtMMSS(p.avgW) : "—";
      const lTxt = Number.isFinite(p.avgL) ? fmtMMSS(p.avgL) : "—";

      const rowClass =
        p.player === fastestName ? "avgtime-row-fast" :
        p.player === slowestName ? "avgtime-row-slow" : "";

      return `
        <tr class="${rowClass}">
          <td class="font-semibold text-slate-900">${escapeHtml(p.player)}</td>
          <td class="avgtime-num">${p.games}</td>
          <td class="avgtime-num font-semibold text-slate-900">${fmtMMSS(p.avg)}</td>
          <td class="avgtime-num">${wTxt}</td>
          <td class="avgtime-num">${lTxt}</td>
          <td class="avgtime-num">${minTxt}</td>
          <td class="avgtime-num">${maxTxt}</td>
        </tr>
      `;
    })
    .join("");

  el.innerHTML = `
    <div class="avgtime-head">
      <div>
        <div class="card-title">Average Game Time</div>
        <div class="card-subtitle">
          Per player · Win vs Loss splits · remakes (&lt; ${fmtMMSS(minSeconds)}) excluded · outliers (&gt; ${fmtMMSS(maxSeconds)}) excluded
        </div>
      </div>
      ${chips}
    </div>

    <div class="s26-stat-grid">
      ${stat("Overall Avg", fmtMMSS(avgAll), "Mean (filtered matches)")}
      ${stat("Win Avg", wins.length ? fmtMMSS(avgW) : "—", `${wins.length} win matches`)}
      ${stat("Loss Avg", losses.length ? fmtMMSS(avgL) : "—", `${losses.length} loss matches`)}
      ${stat("Shortest", fmtMMSS(shortest.timeSec), `${escapeHtml(shortest.player)} · ${fmtShortDate(shortest.date)}`)}
      ${stat("Longest", fmtMMSS(longest.timeSec), `${escapeHtml(longest.player)} · ${fmtShortDate(longest.date)}`)}
    </div>

    <div class="mt-4 rounded-2xl border border-slate-200 bg-white/60 overflow-hidden">
      <table class="s26-table">
        <thead>
          <tr>
            <th>Player</th>
            <th class="avgtime-num">Games</th>
            <th class="avgtime-num">Avg</th>
            <th class="avgtime-num">Avg (W)</th>
            <th class="avgtime-num">Avg (L)</th>
            <th class="avgtime-num">Shortest</th>
            <th class="avgtime-num">Longest</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    </div>
  `;
}
