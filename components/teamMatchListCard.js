// /components/teamMatchListCard.js
// Match List (Last N) — Team / 5-stack
// - One row per match (subtle roster names line)
// - 5 champion icons (role-ordered when possible)
// - Win/Loss chip, duration, squad KDA
// - Split mini cards (Split 1–3), Split fallback => 1
//
// Uses championSquareUrl() for champ icons (no DD version globals).

import { championSquareUrl } from "../core/ddragon.js";

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function pick(row, keys) {
  for (const k of keys) {
    if (row && k in row && row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== "") return row[k];
  }
  return "";
}

function toNum(v) {
  if (v === undefined || v === null || v === "") return 0;
  const n = parseFloat(String(v).replace("%", "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function toBool(v) {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "win") return true;
  if (s === "loss") return false;
  if (["true", "1", "yes", "y"].includes(s)) return true;
  if (["false", "0", "no", "n"].includes(s)) return false;
  return null;
}

function parseLooseDate(v) {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  const s = String(v ?? "").trim();
  if (!s) return null;

  // "08.01.26 15:10"
  const m = s.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (m) {
    const dd = parseInt(m[1], 10);
    const mm = parseInt(m[2], 10) - 1;
    let yy = parseInt(m[3], 10);
    const hh = m[4] ? parseInt(m[4], 10) : 0;
    const mi = m[5] ? parseInt(m[5], 10) : 0;
    if (yy < 100) yy += 2000;
    const d = new Date(yy, mm, dd, hh, mi, 0);
    return isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function formatDDMM(d) {
  if (!(d instanceof Date) || isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}`;
}

function roleOrder(role) {
  const R = String(role ?? "").toUpperCase();
  if (R.includes("TOP")) return 1;
  if (R.includes("JUNG")) return 2;
  if (R.includes("MID")) return 3;
  if (R.includes("ADC") || R.includes("BOT") || R.includes("BOTTOM")) return 4;
  if (R.includes("SUP") || R.includes("UTIL")) return 5;
  return 9;
}

function normalizeRole(raw) {
  const r = String(raw ?? "").trim().toUpperCase();
  if (!r) return "";
  if (r === "UTILITY" || r === "SUPPORT") return "SUPPORT";
  if (r === "BOTTOM" || r === "ADC") return "BOTTOM";
  if (r === "MIDDLE" || r === "MID") return "MID";
  if (r === "JUNGLE" || r === "JNG" || r === "JG") return "JUNGLE";
  if (r === "TOP") return "TOP";
  return r;
}

// ---- dot styles (so the match list doesn’t depend on mini-cards running first)
function injectDotsOnce() {
  if (document.getElementById("ln-dot-style")) return;
  const style = document.createElement("style");
  style.id = "ln-dot-style";
  style.textContent = `
    .s26-dot{
      width:14px;height:14px;border-radius:9999px;
      border:1px solid rgba(148,163,184,0.55);
      background:var(--dot-empty,#e2e8f0);
      box-shadow:inset 0 1px 0 rgba(255,255,255,0.65);
      flex:0 0 auto;
    }
    .s26-dot.win{ background:var(--dot-win,#10b981); border-color:rgba(16,185,129,0.55); }
    .s26-dot.loss{ background:var(--dot-loss,#fb7185); border-color:rgba(251,113,133,0.55); }
    .s26-dot.latest{ outline:3px solid var(--dot-ring,#ff8000); outline-offset:2px; }
  `;
  document.head.appendChild(style);
}

function winChip(win) {
  const base = "inline-flex items-center px-2 py-0.5 rounded-full text-[0.65rem] border";
  return win
    ? `<span class="${base} bg-emerald-50 text-emerald-700 border-emerald-200">WIN</span>`
    : `<span class="${base} bg-rose-50 text-rose-700 border-rose-200">LOSS</span>`;
}

function stackChip5() {
  return `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[0.65rem] border bg-orange-50 text-orange-700 border-orange-200">5-stack · 5</span>`;
}

function fallback(mountEl, title, subtitle) {
  mountEl.innerHTML = `
    <div class="card-header">
      <div>
        <div class="card-title">${esc(title)}</div>
        <div class="card-subtitle">${esc(subtitle)}</div>
      </div>
    </div>
  `;
}

function getMatchId(r) {
  return String(pick(r, ["Match ID", "MatchID", "matchId", "Game ID", "Game #", "Date"]) || "").trim();
}

function getPlayer(r) {
  return String(pick(r, ["p.riotIdGameName", "Player", "p.summonerName", "summonerName"]) || "").trim();
}

function getChampion(r) {
  return String(pick(r, ["Champion", "p.championName", "championName"]) || "").trim();
}

function getRole(r) {
  return normalizeRole(pick(r, ["ROLE", "Role", "Team Position", "p.teamPosition", "p.individualPosition", "p.role"]));
}

function getWin(r) {
  const v = pick(r, ["Result", "p.win", "win"]);
  const b = toBool(v);
  return b ?? String(v ?? "").trim().toLowerCase() === "win";
}

function getTimePlayedMin(r) {
  // Prefer seconds fields
  const sec = toNum(pick(r, ["p.timePlayed", "timePlayed"]));
  if (sec > 0) return sec / 60;

  // Fallback to TIME "mm:ss"
  const t = String(pick(r, ["TIME", "Game Time"]) || "").trim();
  if (t.includes(":")) {
    const [m, s] = t.split(":").map((x) => toNum(x));
    const total = Math.max(0, m * 60 + s);
    return total ? total / 60 : NaN;
  }
  return NaN;
}

function getSplit(r) {
  const s = parseInt(String(pick(r, ["Split"]) ?? "").trim(), 10);
  return Number.isFinite(s) && s > 0 ? s : 1; // fallback => Split 1
}

function sortNamesForLine(names, roster) {
  const arr = names.slice();
  if (Array.isArray(roster) && roster.length) {
    const pos = new Map(roster.map((n, i) => [String(n), i]));
    arr.sort((a, b) => {
      const pa = pos.has(a) ? pos.get(a) : 999;
      const pb = pos.has(b) ? pos.get(b) : 999;
      return pa - pb || a.localeCompare(b);
    });
    return arr;
  }
  return arr.sort((a, b) => a.localeCompare(b));
}

async function hydrateChampIcons(mountEl) {
  const imgs = mountEl.querySelectorAll("img[data-ln-champ]");
  await Promise.all(
    Array.from(imgs).map(async (img) => {
      const champ = img.getAttribute("data-ln-champ") || "";
      if (!champ) return;
      try {
        const url = await championSquareUrl(champ);
        if (url) {
          img.src = url;
          img.alt = `${champ} icon`;
        }
      } catch {}
    })
  );
}

function champPillPlaceholder(champ) {
  if (!champ) return "";
  return `
    <span class="inline-flex items-center justify-center w-[22px] h-[22px] rounded-lg border bg-orange-50 border-orange-200 overflow-hidden"
          title="${esc(champ)}">
      <img data-ln-champ="${esc(champ)}" src="" alt="" class="w-full h-full object-cover block" loading="lazy" referrerpolicy="no-referrer"/>
    </span>
  `;
}

// --- Split Mini Cards (Split 1–3) ---
function renderSplitMini(rows, roster) {
  const splits = [1, 2, 3];
  const bySplit = {};
  splits.forEach((s) => (bySplit[s] = { matchSet: new Set(), playerMap: new Map() }));

  for (const r0 of rows || []) {
    const r = r0?._raw ?? r0;

    const player = getPlayer(r);
    if (!player) continue;
    if (Array.isArray(roster) && roster.length && !roster.includes(player)) continue;

    const id = getMatchId(r);
    if (!id) continue;

    const s = getSplit(r);
    if (!bySplit[s]) continue;

    bySplit[s].matchSet.add(id);

    if (!bySplit[s].playerMap.has(player)) bySplit[s].playerMap.set(player, new Set());
    bySplit[s].playerMap.get(player).add(id);
  }

  const splitCard = (s) => {
    const info = bySplit[s];
    const games = info.matchSet.size;
    const hasData = info.playerMap.size > 0;

    const rowsHTML = hasData
      ? [...info.playerMap.entries()]
          .map(([player, set]) => ({ player, games: set.size }))
          .sort((a, b) => b.games - a.games || a.player.localeCompare(b.player))
          .map(
            (x, idx) => `
              <div class="flex items-center justify-between py-1 ${idx ? "border-t border-slate-100" : ""}">
                <div class="text-[0.75rem] text-slate-800 truncate">${esc(x.player)}</div>
                <div class="text-[0.75rem] font-semibold text-slate-900">${x.games}</div>
              </div>
            `
          )
          .join("")
      : `<div class="text-[0.75rem] text-slate-400 mt-2">No data yet.</div>`;

    return `
      <div class="p-3 rounded-2xl border border-slate-200 bg-white/70">
        <div class="flex items-baseline justify-between">
          <div class="text-[0.75rem] font-semibold text-slate-900">Split ${s}</div>
          <div class="text-[0.65rem] text-slate-500">${games ? `${games} games` : "—"}</div>
        </div>
        <div class="mt-2">
          ${rowsHTML}
        </div>
      </div>
    `;
  };

  return `
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
      ${splitCard(1)}
      ${splitCard(2)}
      ${splitCard(3)}
    </div>
  `;
}

// ============================================================================
// Public mount
// ============================================================================
export async function mountTeamMatchListCard(mountEl, rows, opts = {}) {
  if (!mountEl) throw new Error("mountTeamMatchListCard: missing mount element");
  if (!mountEl.classList.contains("dashboard-card")) mountEl.classList.add("dashboard-card");

  injectDotsOnce();

  const roster = Array.isArray(opts.roster) ? opts.roster : [];
  const limit = Number.isFinite(opts.limit) ? opts.limit : 10;

  if (!rows || !rows.length) {
    fallback(mountEl, "Match List (Last 10)", "No matches yet.");
    return;
  }

  // ---- group rows into matches (defensive) ----
  const matchMap = new Map(); // id -> match aggregate

  for (const r0 of rows) {
    const r = r0?._raw ?? r0;

    const id = getMatchId(r);
    if (!id) continue;

    const d = parseLooseDate(pick(r, ["Date", "DATE"]));
    const win = getWin(r);
    const timeMin = getTimePlayedMin(r);
    const player = getPlayer(r);
    const champ = getChampion(r);
    const role = getRole(r);
    const split = getSplit(r);

    if (!matchMap.has(id)) {
      matchMap.set(id, {
        id,
        date: d,
        win,
        timeMin: Number.isFinite(timeMin) ? timeMin : NaN,
        k: 0,
        d: 0,
        a: 0,
        split,
        playerSet: new Set(),
        players: [], // {name, champ, role}
      });
    }

    const m = matchMap.get(id);

    // keep latest date
    if (!m.date && d) m.date = d;
    if (m.date && d && d.getTime() > m.date.getTime()) m.date = d;

    // win OR
    m.win = m.win || win;

    // time
    if (!Number.isFinite(m.timeMin) && Number.isFinite(timeMin)) m.timeMin = timeMin;

    // split fallback
    if (split) m.split = split;

    // only count each player once (avoids double-sums if dataset duplicates rows)
    if (player && !m.playerSet.has(player)) {
      m.playerSet.add(player);
      m.players.push({ name: player, champ, role });

      m.k += toNum(pick(r, ["Kills", "p.kills", "kills"]));
      m.d += toNum(pick(r, ["Deaths", "p.deaths", "deaths"]));
      m.a += toNum(pick(r, ["Assists", "p.assists", "assists"]));
    }
  }

  const allMatches = [...matchMap.values()]
    .filter((m) => m.playerSet.size > 0)
    .sort((a, b) => {
      const ta = a.date ? a.date.getTime() : 0;
      const tb = b.date ? b.date.getTime() : 0;
      return ta - tb;
    });

  const lastChrono = allMatches.slice(-limit); // oldest -> newest
  const lastTable = lastChrono.slice().reverse(); // newest -> oldest

  // dots
  const dots = [];
  for (let i = 0; i < limit; i++) {
    const m = lastChrono[i];
    if (!m) dots.push("empty");
    else dots.push(m.win ? "win" : "loss");
  }
  const latestIdx = lastChrono.length ? lastChrono.length - 1 : -1;

  const dotsHTML = dots
    .map((state, idx) => {
      const cls = state === "win" ? "win" : state === "loss" ? "loss" : "";
      const latest = idx === latestIdx ? "latest" : "";
      return `<span class="s26-dot ${cls} ${latest}"></span>`;
    })
    .join("");

  const rowHTML = lastTable
    .map((m) => {
      const minutes = Number.isFinite(m.timeMin) ? `${m.timeMin.toFixed(1)}m` : "—";
      const kda = (m.k + m.a) / Math.max(1, m.d);
      const kdaText = Number.isFinite(kda) ? kda.toFixed(2) : "—";
      const dateText = m.date ? formatDDMM(m.date) : "—";

      const names = sortNamesForLine([...m.playerSet].slice(0, 5), roster);
      const namesLine = names.join(" · ");

      const champsOrdered = m.players
        .slice()
        .sort((a, b) => roleOrder(a.role) - roleOrder(b.role))
        .map((p) => p.champ)
        .filter(Boolean)
        .slice(0, 5);

      const champStrip = champsOrdered.length
        ? champsOrdered.map((c) => champPillPlaceholder(c)).join("")
        : `<span class="text-[0.7rem] text-slate-400">No champ data</span>`;

      return `
        <tr class="border-t border-slate-100 hover:bg-orange-50/30 transition">
          <td class="px-4 py-2 align-top">
            <div class="text-sm text-slate-800 whitespace-nowrap">${dateText}</div>
            <div class="text-[0.7rem] text-slate-400 mt-0.5">${esc(namesLine)}</div>
          </td>

          <td class="px-4 py-2 align-top">
            ${stackChip5()}
            <div class="mt-1 flex items-center gap-1.5">${champStrip}</div>
          </td>

          <td class="px-4 py-2 align-top">${winChip(m.win)}</td>
          <td class="px-4 py-2 text-right align-top text-slate-700 text-sm whitespace-nowrap">${minutes}</td>
          <td class="px-4 py-2 text-right align-top text-slate-900 font-semibold text-sm whitespace-nowrap">${kdaText}</td>
        </tr>
      `;
    })
    .join("");

  const splitCardsHTML = opts.showSplitMini === false ? "" : renderSplitMini(rows, roster);

  const count = lastChrono.length;

  mountEl.innerHTML = `
    <div class="card-header">
      <div class="flex items-start justify-between gap-3 w-full">
        <div>
          <div class="card-title">Match List (Last ${limit})</div>
          <div class="card-subtitle">Latest ${count}/${limit} full 5-stack games</div>
        </div>

        <div class="flex items-center gap-1.5 mt-1" title="Last ${limit} results (ring = most recent)"
             style="--dot-win:#22c55e; --dot-loss:#fb7185; --dot-empty:#cbd5e1; --dot-ring:#f97316;">
          ${dotsHTML}
        </div>
      </div>
    </div>

    <div class="mt-3 overflow-x-auto">
      <table class="w-full border-collapse">
        <thead>
          <tr class="bg-slate-50 text-slate-600 text-[0.7rem] uppercase tracking-wide">
            <th class="px-4 py-2 text-left font-semibold">Date</th>
            <th class="px-4 py-2 text-left font-semibold">Squad</th>
            <th class="px-4 py-2 text-left font-semibold">Result</th>
            <th class="px-4 py-2 text-right font-semibold">Duration</th>
            <th class="px-4 py-2 text-right font-semibold">Squad KDA</th>
          </tr>
        </thead>
        <tbody>
          ${rowHTML || `<tr><td class="px-4 py-4 text-sm text-slate-500" colspan="5">No matches yet.</td></tr>`}
        </tbody>
      </table>
    </div>

    <div class="px-4 py-3 text-[0.65rem] text-slate-400">
      Squad KDA = (Kills + Assists) / Deaths, summed across the 5 roster players in the match.
    </div>

    ${
      opts.showSplitMini === false
        ? ""
        : `
          <div class="px-4 pb-4">
            <div class="text-sm font-semibold text-slate-900 mb-2">Split Mini</div>
            ${splitCardsHTML}
          </div>
        `
    }
  `;

  // hydrate champ images
  await hydrateChampIcons(mountEl);
}
