// /components/summaryCard.js
import { championSquareUrl } from "../core/ddragon.js";

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function escapeAttr(s) {
  return escapeHtml(s).replaceAll("`", "&#096;");
}

function injectSummaryExtrasOnce() {
  if (document.getElementById("s26-summary-extras-style")) return;

  const style = document.createElement("style");
  style.id = "s26-summary-extras-style";
  style.textContent = `
    body.s26 .s26-summary-grid{
      display:grid;
      grid-template-columns: 1.05fr 0.95fr;
      gap: 0.9rem;
      margin-top: 1rem;
    }
    @media (max-width: 900px){
      body.s26 .s26-summary-grid{ grid-template-columns: 1fr; }
    }

    body.s26 .s26-panel{
      background: rgba(255,255,255,0.56);
      border: 1px solid rgba(229,231,235,0.75);
      border-radius: 1.15rem;
      padding: 0.95rem;
    }
    body.s26 .s26-panel-title{
      font-weight: 900;
      letter-spacing: -0.02em;
      color: var(--ln-ink);
      font-size: 0.95rem;
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap: .75rem;
      margin-bottom: .15rem;
    }
    body.s26 .s26-panel-sub{
      color: var(--ln-muted);
      font-size: 0.76rem;
      margin-bottom: .7rem;
      line-height: 1.2;
    }

    /* Role bar */
    body.s26 .s26-rolebar{
      height: 14px;
      border-radius: 999px;
      overflow: hidden;
      border: 1px solid rgba(226,232,240,0.9);
      background: rgba(226,232,240,0.55);
      display:flex;
    }
    body.s26 .s26-roleseg{
      height: 100%;
      position: relative;
    }
    body.s26 .s26-roleseg::after{
      content:"";
      position:absolute;
      top:0;bottom:0;right:0;
      width: 1px;
      background: rgba(255,255,255,0.55);
    }
    body.s26 .s26-roleseg:last-child::after{ display:none; }

    /* tasteful role colors */
    body.s26 .role-top { background: rgba(249,115,22,0.75); }
    body.s26 .role-jng { background: rgba(231,175,178,0.75); }
    body.s26 .role-mid { background: rgba(100,116,139,0.55); }
    body.s26 .role-bot { background: rgba(251,191,36,0.65); }
    body.s26 .role-sup { background: rgba(34,197,94,0.55); }

    body.s26 .s26-legend{
      margin-top: .7rem;
      display:grid;
      grid-template-columns: repeat(2, minmax(0,1fr));
      gap: .45rem .8rem;
    }
    @media (max-width: 520px){
      body.s26 .s26-legend{ grid-template-columns: 1fr; }
    }
    body.s26 .s26-legend-item{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap: .6rem;
      font-size: .78rem;
      color: #0f172a;
    }
    body.s26 .s26-legend-left{
      display:flex;align-items:center;gap:.5rem;min-width:0;
    }
    body.s26 .s26-dot-mini{
      width:10px;height:10px;border-radius:999px;
      border:1px solid rgba(148,163,184,0.45);
      flex:0 0 auto;
    }
    body.s26 .s26-legend-item .muted{
      color: var(--ln-muted);
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    body.s26 .s26-legend-item .name{
      font-weight: 900;
      letter-spacing: -0.01em;
    }

    /* Champs list */
    body.s26 .s26-champs{
      display:flex;
      flex-direction:column;
      gap: .6rem;
    }
    body.s26 .s26-champ-chip{
      display:flex;
      align-items:center;
      gap: .65rem;
      padding: .6rem .7rem;
      border-radius: 1rem;
      border: 1px solid rgba(226,232,240,0.9);
      background: rgba(255,255,255,0.62);
      transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease;
    }
    body.s26 .s26-champ-chip:hover{
      transform: translateY(-1px);
      border-color: rgba(249,115,22,0.22);
      box-shadow: 0 10px 26px rgba(15,23,42,0.06);
    }
    body.s26 .s26-champ-icon{
      width: 34px;height:34px;
      border-radius: .95rem;
      border: 1px solid rgba(226,232,240,0.95);
      background: rgba(255,255,255,0.8);
      object-fit: cover;
      flex: 0 0 auto;
    }
    body.s26 .s26-champ-meta{
      min-width:0;
      display:flex;
      align-items:baseline;
      justify-content:space-between;
      gap: .75rem;
      width: 100%;
    }
    body.s26 .s26-champ-name{
      font-weight: 900;
      letter-spacing: -0.02em;
      color: #0f172a;
      font-size: .9rem;
      overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
    }
    body.s26 .s26-champ-sub{
      color: var(--ln-muted);
      font-size: .78rem;
      font-weight: 800;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
  `;
  document.head.appendChild(style);
}

/* ---------- Robust field access (works for normalized rows + raw CSV rows) ---------- */
function readAny(row, keys) {
  for (const k of keys) {
    if (row && row[k] != null && String(row[k]).trim() !== "") return row[k];
  }
  const raw = row?._raw;
  for (const k of keys) {
    if (raw && raw[k] != null && String(raw[k]).trim() !== "") return raw[k];
  }
  return "";
}
function toNum(v) {
  const n = Number(String(v ?? "").replace(",", ".").trim());
  return Number.isFinite(n) ? n : 0;
}
function toInt(v) {
  const n = parseInt(String(v ?? "").trim(), 10);
  return Number.isFinite(n) ? n : 0;
}
function plural(n, one, many = one + "s") {
  return n === 1 ? one : many;
}

function getPlayerName(r) {
  return (
    String(readAny(r, ["player", "Player", "p.summonerName", "summonerName", "p.riotIdGameName", "riotIdGameName"]) || "—").trim() ||
    "—"
  );
}

function getMatchId(r) {
  const v = readAny(r, ["matchId", "match_id", "Match ID", "MatchId", "gameId", "Game ID", "p.matchId", "MatchID"]);
  const s = String(v ?? "").trim();
  return s || "";
}

function getWin(r) {
  // normalized
  if (r?.win === true) return true;
  if (r?.win === false) return false;

  // common raw
  const res = String(readAny(r, ["Result", "result", "p.win", "win"]) || "").trim().toLowerCase();
  if (!res) return null;
  if (res === "win" || res === "true" || res === "1") return true;
  if (res === "loss" || res === "lose" || res === "false" || res === "0") return false;
  return null;
}

function getKills(r) {
  return toInt(readAny(r, ["kills", "Kills", "p.kills", "p.challenges.kills", "p.kills"])) || 0;
}
function getDeaths(r) {
  return toInt(readAny(r, ["deaths", "Deaths", "p.deaths"])) || 0;
}
function getAssists(r) {
  return toInt(readAny(r, ["assists", "Assists", "p.assists"])) || 0;
}

function getRoleRaw(r) {
  return String(readAny(r, ["role", "ROLE", "Role", "p.role", "teamPosition", "p.teamPosition", "individualPosition", "p.individualPosition"]) || "").trim();
}
function roleKey(role) {
  const r = String(role ?? "").trim().toUpperCase();
  if (!r) return "UNK";
  if (r === "JNG" || r.includes("JUNG")) return "JNG";
  if (r === "SUP" || r.includes("SUP")) return "SUP";
  if (r === "BOT" || r === "ADC" || r.includes("BOT") || r.includes("BOTTOM")) return "BOT";
  if (r === "MID" || r.includes("MID") || r.includes("MIDDLE")) return "MID";
  if (r === "TOP") return "TOP";
  return r;
}

function getChampion(r) {
  return String(readAny(r, ["champion", "Champion", "p.championName", "championName"]) || "—").trim() || "—";
}

// Grey screen: Solo used timeDeadSec; Other Flex has p.totalTimeSpentDead (seconds)
function getTimeDeadSeconds(r) {
  const v = readAny(r, ["timeDeadSec", "p.totalTimeSpentDead", "totalTimeSpentDead", "Total Time Spent Dead", "p.totalTimeSpentDead"]);
  return toNum(v);
}

// Multi-kills: your sheet has p.doubleKills / p.tripleKills / p.quadraKills / p.pentaKills
const MULTI_KEYS = {
  d: ["p.doubleKills", "doubleKills", "Double Kills", "DOUBLE KILLS"],
  t: ["p.tripleKills", "tripleKills", "Triple Kills", "TRIPLE KILLS"],
  q: ["p.quadraKills", "quadraKills", "Quadra Kills", "QUADRA KILLS"],
  p: ["p.pentaKills", "pentaKills", "Penta Kills", "PENTA KILLS"],
};
function getMulti(r, kind) {
  return toInt(readAny(r, MULTI_KEYS[kind] || []));
}

function formatPct(x) {
  return `${Math.round(x)}%`;
}

function formatShortDate(d) {
  if (!(d instanceof Date) || isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = d.toLocaleString("en-GB", { month: "short" });
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd} ${mm} ${yy}`;
}

function formatDurationLong(totalSeconds) {
  const s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const mins = Math.floor((s % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

const champIconCache = new Map(); // champ -> Promise<string>
async function getChampIcon(champ) {
  const key = String(champ ?? "").trim();
  if (!key) return "";
  if (!champIconCache.has(key)) champIconCache.set(key, championSquareUrl(key).catch(() => ""));
  return champIconCache.get(key);
}
function hydrateSummaryChampIcons(root) {
  const imgs = root.querySelectorAll("img[data-champ]");
  imgs.forEach(async (img) => {
    const champ = img.getAttribute("data-champ") || "";
    const url = await getChampIcon(champ);
    if (url) img.src = url;
  });
}

/* ---------- Side (Blue/Red) winrate helpers ---------- */
function getSide(r) {
  // Try Team column first (often "Blue"/"Red")
  const teamStr = String(readAny(r, ["Team", "team", "Side", "side"]) || "").trim().toLowerCase();
  if (teamStr === "blue" || teamStr === "b") return "BLUE";
  if (teamStr === "red" || teamStr === "r") return "RED";

  // Try teamId 100/200
  const tid = toInt(readAny(r, ["teamId", "p.teamId", "TeamId", "Team ID"]));
  if (tid === 100) return "BLUE";
  if (tid === 200) return "RED";

  return "";
}

/* ---------- Public mount ---------- */
export function mountSummaryCard(el, rows, opts = {}) {
  injectSummaryExtrasOnce();
  if (!el) return;

  const title = opts.title || "Snapshot";

  if (!rows || !rows.length) {
    el.innerHTML = `
      <div class="card-header">
        <div>
          <div class="card-title">${escapeHtml(title)}</div>
          <div class="card-subtitle">No data.</div>
        </div>
      </div>
    `;
    return;
  }

  // Dates: if loader already made Date objects, use that; otherwise parse Date column if present
  const dates = rows
    .map((r) => {
      if (r.date instanceof Date && !isNaN(r.date.getTime())) return r.date;
      const raw = readAny(r, ["Date", "date"]);
      const s = String(raw ?? "").trim();
      const d = s ? new Date(s) : null;
      return d instanceof Date && !isNaN(d.getTime()) ? d : null;
    })
    .filter(Boolean);

  const minDate = dates.length ? new Date(Math.min(...dates.map((d) => d.getTime()))) : null;
  const maxDate = dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null;

  const games = rows.length;

  // Wins
  let wins = 0;
  let known = 0;
  for (const r of rows) {
    const w = getWin(r);
    if (w == null) continue;
    known++;
    if (w) wins++;
  }
  const winrate = known ? (wins / known) * 100 : 0;

  // Blue/Red sub winrates (minimal)
  let blueW = 0, blueG = 0, redW = 0, redG = 0;
  for (const r of rows) {
    const side = getSide(r);
    const w = getWin(r);
    if (!side || w == null) continue;
    if (side === "BLUE") {
      blueG++; if (w) blueW++;
    } else if (side === "RED") {
      redG++; if (w) redW++;
    }
  }
  const blueTxt = blueG ? `${formatPct((blueW / blueG) * 100)}` : "—";
  const redTxt = redG ? `${formatPct((redW / redG) * 100)}` : "—";

  // Avg KDA from totals
  let k = 0, d = 0, a = 0;
  for (const r of rows) {
    k += getKills(r);
    d += getDeaths(r);
    a += getAssists(r);
  }
  const avgKda = (k + a) / Math.max(1, d);

  // Grey screen total
  const totalDeadSec = rows.reduce((sum, r) => sum + (getTimeDeadSeconds(r) || 0), 0);
  const avgDeadSecPerGame = games ? totalDeadSec / games : 0;

  // Role counts
  const roleCounts = new Map([["TOP", 0], ["JNG", 0], ["MID", 0], ["BOT", 0], ["SUP", 0]]);
  for (const r of rows) {
    const rk = roleKey(getRoleRaw(r));
    if (roleCounts.has(rk)) roleCounts.set(rk, (roleCounts.get(rk) || 0) + 1);
  }
  const roleEntries = [...roleCounts.entries()].sort((aa, bb) => bb[1] - aa[1]);
  const mostRole = roleEntries[0]?.[0] || "—";

  // Champ counts
  const champCounts = new Map();
  for (const r of rows) {
    const c = getChampion(r);
    if (!c || c === "—") continue;
    champCounts.set(c, (champCounts.get(c) || 0) + 1);
  }
  const topChamps = [...champCounts.entries()]
    .sort((aa, bb) => bb[1] - aa[1])
    .slice(0, 5)
    .map(([champ, count]) => ({ champ, count, pct: games ? (count / games) * 100 : 0 }));
  const mostChamp = topChamps[0]?.champ || "—";

  // Match grouping => “Solo vs Duo+” (for flex, Duo+ = 2–4)
  const byMatch = new Map();
  for (const r of rows) {
    const mid = getMatchId(r);
    const key = mid || `u:${String(readAny(r, ["Date", "date"]) || "")}|${getPlayerName(r)}|${getChampion(r)}`;
    if (!byMatch.has(key)) byMatch.set(key, new Set());
    byMatch.get(key).add(getPlayerName(r));
  }
  const matchCounts = [...byMatch.values()].map((set) => set.size);
  const matchTotal = matchCounts.length || 0;
  const soloMatches = matchCounts.filter((n) => n === 1).length;
  const duoPlusMatches = matchCounts.filter((n) => n >= 2).length;
  const soloPct = matchTotal ? (soloMatches / matchTotal) * 100 : 0;

  // Multikills totals + top3 per type
  function multiSummary(kind) {
    let total = 0;
    const perPlayer = new Map();
    for (const r of rows) {
      const v = getMulti(r, kind);
      if (!v) continue;
      total += v;
      const name = getPlayerName(r);
      perPlayer.set(name, (perPlayer.get(name) || 0) + v);
    }
    const top3 = [...perPlayer.entries()]
      .sort((aa, bb) => bb[1] - aa[1] || String(aa[0]).localeCompare(String(bb[0])))
      .slice(0, 3);

    const topTxt = top3.length
      ? top3.map(([n, c]) => `${escapeHtml(n)} (${c})`).join(" · ")
      : "—";

    return { total, topTxt };
  }
  const mkD = multiSummary("d");
  const mkT = multiSummary("t");
  const mkQ = multiSummary("q");
  const mkP = multiSummary("p");

  const roleTotal = [...roleCounts.values()].reduce((s, v) => s + v, 0) || 1;
  const roleBar = (key, cls) => {
    const count = roleCounts.get(key) || 0;
    const pct = (count / roleTotal) * 100;
    const w = pct < 2 && count > 0 ? 2 : pct;
    return `<div class="s26-roleseg ${cls}" style="width:${w}%" title="${key} · ${count} (${formatPct(pct)})"></div>`;
  };

  el.innerHTML = `
    <div class="card-header">
      <div>
        <div class="card-title">${escapeHtml(title)}</div>
        <div class="card-subtitle">
          Games: ${games}
          ${minDate && maxDate ? ` · ${escapeHtml(formatShortDate(minDate))} → ${escapeHtml(formatShortDate(maxDate))}` : ""}
        </div>
      </div>
    </div>

    <!-- Stat grid (5 per row; adding 5 more auto-wraps into a second row) -->
    <div class="s26-stat-grid">
      <div class="s26-stat">
        <div class="s26-stat-label">Winrate</div>
        <div class="s26-stat-value">${Math.round(winrate)}%</div>
        <div class="s26-stat-hint">${wins}/${known || games}</div>
        <div class="s26-stat-hint" style="margin-top:.15rem;">Blue ${blueTxt} · Red ${redTxt}</div>
      </div>

      <div class="s26-stat">
        <div class="s26-stat-label">Avg KDA</div>
        <div class="s26-stat-value">${avgKda.toFixed(2)}</div>
        <div class="s26-stat-hint">((K+A)/D)</div>
      </div>

      <div class="s26-stat">
        <div class="s26-stat-label">Most played role</div>
        <div class="s26-stat-value">${escapeHtml(mostRole)}</div>
        <div class="s26-stat-hint">${roleCounts.get(mostRole) || 0} ${plural(roleCounts.get(mostRole) || 0, "game")}</div>
      </div>

      <div class="s26-stat">
        <div class="s26-stat-label">Most played champ</div>
        <div class="s26-stat-value">${escapeHtml(mostChamp)}</div>
        <div class="s26-stat-hint">${topChamps[0]?.count ?? 0} ${plural(topChamps[0]?.count ?? 0, "game")}</div>
      </div>

      <div class="s26-stat" title="${Math.round(totalDeadSec)} seconds total">
        <div class="s26-stat-label">Total grey screen</div>
        <div class="s26-stat-value">${formatDurationLong(totalDeadSec)}</div>
        <div class="s26-stat-hint">${Math.round(avgDeadSecPerGame)}s avg / game</div>
      </div>

      <!-- Row 2 -->
      <div class="s26-stat">
        <div class="s26-stat-label">Solo vs party</div>
        <div class="s26-stat-value">${Math.round(soloPct)}% Solo</div>
        <div class="s26-stat-hint">${soloMatches}/${matchTotal} solo · ${duoPlusMatches}/${matchTotal} duo+</div>
      </div>

      <div class="s26-stat">
        <div class="s26-stat-label">Double kills</div>
        <div class="s26-stat-value">${mkD.total}</div>
        <div class="s26-stat-hint">Top 3: ${mkD.topTxt}</div>
      </div>

      <div class="s26-stat">
        <div class="s26-stat-label">Triple kills</div>
        <div class="s26-stat-value">${mkT.total}</div>
        <div class="s26-stat-hint">Top 3: ${mkT.topTxt}</div>
      </div>

      <div class="s26-stat">
        <div class="s26-stat-label">Quadra kills</div>
        <div class="s26-stat-value">${mkQ.total}</div>
        <div class="s26-stat-hint">Top 3: ${mkQ.topTxt}</div>
      </div>

      <div class="s26-stat">
        <div class="s26-stat-label">Penta kills</div>
        <div class="s26-stat-value">${mkP.total}</div>
        <div class="s26-stat-hint">Top 3: ${mkP.topTxt}</div>
      </div>
    </div>

    <div class="s26-summary-grid">
      <!-- Role distribution -->
      <div class="s26-panel">
        <div class="s26-panel-title">
          <span>Role Distribution</span>
          <span class="pill" title="Counts based on visible rows">5 roles</span>
        </div>
        <div class="s26-panel-sub">Stacked split of TOP/JNG/MID/BOT/SUP.</div>

        <div class="s26-rolebar" aria-label="Role distribution">
          ${roleBar("TOP", "role-top")}
          ${roleBar("JNG", "role-jng")}
          ${roleBar("MID", "role-mid")}
          ${roleBar("BOT", "role-bot")}
          ${roleBar("SUP", "role-sup")}
        </div>

        <div class="s26-legend">
          ${(["TOP","JNG","MID","BOT","SUP"]).map((k2) => {
            const count = roleCounts.get(k2) || 0;
            const pct = (count / roleTotal) * 100;
            const dotCls =
              k2 === "TOP" ? "role-top" :
              k2 === "JNG" ? "role-jng" :
              k2 === "MID" ? "role-mid" :
              k2 === "BOT" ? "role-bot" : "role-sup";
            return `
              <div class="s26-legend-item">
                <div class="s26-legend-left">
                  <span class="s26-dot-mini ${dotCls}"></span>
                  <span class="name">${k2}</span>
                </div>
                <span class="muted">${count} · ${formatPct(pct)}</span>
              </div>
            `;
          }).join("")}
        </div>
      </div>

      <!-- Top champs -->
      <div class="s26-panel">
        <div class="s26-panel-title">
          <span>Most Played Champs</span>
          <span class="pill">Top 5</span>
        </div>
        <div class="s26-panel-sub">Champion icons via DDragon.</div>

        <div class="s26-champs">
          ${
            topChamps.length
              ? topChamps.map((c) => `
                <div class="s26-champ-chip" title="${escapeAttr(c.champ)} · ${c.count} ${plural(c.count, "game")}">
                  <img class="s26-champ-icon" data-champ="${escapeAttr(c.champ)}" alt="${escapeAttr(c.champ)} icon" />
                  <div class="s26-champ-meta">
                    <div class="s26-champ-name">${escapeHtml(c.champ)}</div>
                    <div class="s26-champ-sub">${c.count} · ${formatPct(c.pct)}</div>
                  </div>
                </div>
              `).join("")
              : `<div class="text-sm text-slate-500">No champions found.</div>`
          }
        </div>
      </div>
    </div>
  `;

  hydrateSummaryChampIcons(el);
}
