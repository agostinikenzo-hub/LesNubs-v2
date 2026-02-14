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

    /* tasteful role colors */
    body.s26 .role-top { background: rgba(249,115,22,0.75); }
    body.s26 .role-jng { background: rgba(231,175,178,0.75); }
    body.s26 .role-mid { background: rgba(100,116,139,0.55); }
    body.s26 .role-bot { background: rgba(251,191,36,0.65); }
    body.s26 .role-sup { background: rgba(34,197,94,0.55); }

    /* ✅ Top 3 rows in multikill stat cards */
    body.s26 .s26-top3-wrap{
      margin-top: .18rem;
      display:flex;
      flex-direction:column;
      gap: .12rem;
    }
    body.s26 .s26-top3-row{
      line-height: 1.15;
      font-variant-numeric: tabular-nums;
    }
    body.s26 .s26-top3-row .count{
      opacity: .85;
      font-weight: 800;
    }

    /* ✅ NEW: Stack winrate mini rows (fits inside one stat card) */
    body.s26 .s26-stackrows{
      margin-top: .18rem;
      display:flex;
      flex-direction:column;
      gap:.14rem;
    }
    body.s26 .s26-stackrow{
      display:flex;
      align-items:baseline;
      justify-content:space-between;
      gap:.5rem;
      font-size: .74rem;
      font-weight: 900;
      color: rgba(51,65,85,0.95);
      font-variant-numeric: tabular-nums;
      line-height: 1.1;
    }
    body.s26 .s26-stackrow .muted{
      color: rgba(100,116,139,0.92);
      font-weight: 900;
      white-space: nowrap;
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

    /* ---------- Role Dots (scatter-ish) ---------- */
    body.s26 .s26-roleplot-top{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:.75rem;
      margin-top: .2rem;
      margin-bottom: .45rem;
    }
    body.s26 .s26-roleplot-top .left{
      font-weight: 900;
      color: #334155;
      letter-spacing: -0.01em;
      display:flex;
      align-items:baseline;
      gap:.5rem;
      min-width:0;
    }
    body.s26 .s26-roleplot-meta{
      color: rgba(100,116,139,0.92);
      font-size: .78rem;
      font-weight: 800;
      white-space: nowrap;
    }

    body.s26 .s26-togglechip{
      display:inline-flex;
      align-items:center;
      gap:.45rem;
      padding: .34rem .58rem;
      border-radius: 999px;
      border: 1px solid rgba(148,163,184,.45);
      background: rgba(255,255,255,.72);
      color:#334155;
      font-size:.78rem;
      font-weight: 900;
      cursor:pointer;
      user-select:none;
      transition: transform .15s ease, border-color .15s ease, box-shadow .15s ease;
      white-space: nowrap;
    }
    body.s26 .s26-togglechip:hover{
      transform: translateY(-1px);
      border-color: rgba(249,115,22,0.28);
      box-shadow: 0 10px 22px rgba(15,23,42,0.06);
    }
    body.s26 .s26-togglechip .dot{
      width:10px;height:10px;border-radius:999px;
      border:1px solid rgba(148,163,184,0.45);
      background: rgba(148,163,184,0.25);
      flex:0 0 auto;
    }

    /* ✅ One clean "canvas" for the SVG (no nested mini-cards) */
    body.s26 .s26-roleplot-canvas{
      border: 1px solid rgba(226,232,240,0.95);
      background: rgba(255,255,255,0.62);
      border-radius: 1.05rem;
      padding: .55rem .6rem;
      overflow:hidden;
    }

    body.s26 .s26-roleplot-svg{
      width: 100%;
      height: 275px;
      display:block;
    }
    @media (max-width: 520px){
      body.s26 .s26-roleplot-svg{ height: 300px; }
    }

    /* ✅ Player chips: minimal, readable, no "pill inside pill", flow naturally */
    body.s26 .s26-playerchips{
      margin-top: .55rem;
      display:flex;
      flex-wrap: wrap;
      gap:.42rem;
      align-items:center;
    }
    body.s26 .s26-plchip{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      gap:.40rem;
      padding: .28rem .46rem;
      border-radius: 999px;
      border: 1px solid rgba(148,163,184,.45);
      background: rgba(255,255,255,.74);
      color:#0f172a;
      font-size:.76rem;
      font-weight: 950;
      letter-spacing: -0.01em;
      cursor:pointer;
      user-select:none;
      white-space: nowrap;
      transition: transform .15s ease, border-color .15s ease, box-shadow .15s ease, background .15s ease;
      width:auto;
      min-width:0;
    }
    body.s26 .s26-plchip:hover{
      transform: translateY(-1px);
      box-shadow: 0 10px 18px rgba(15,23,42,0.05);
      border-color: rgba(249,115,22,0.22);
    }
    body.s26 .s26-plchip .p-dot{
      width:10px;height:10px;border-radius:999px;
      border: 1px solid rgba(15,23,42,0.15);
      flex:0 0 auto;
    }
    body.s26 .s26-plchip.is-active{
      border-color: rgba(249,115,22,0.40);
      background: rgba(249,115,22,0.10);
      color:#f97316;
      box-shadow: 0 10px 18px rgba(15,23,42,0.05);
    }

    /* ✅ Role chips: compact + ONE ROW */
    body.s26 .s26-rolelegendchips{
      margin-top: .55rem;
      display:flex;
      gap:.55rem;
      flex-wrap: nowrap;          /* keep on one row */
      overflow-x: auto;           /* if super narrow, scroll instead of wrapping */
      padding-bottom: 2px;
      -webkit-overflow-scrolling: touch;
    }
    body.s26 .s26-rolelegendchips::-webkit-scrollbar{ height: 6px; }
    body.s26 .s26-rolelegendchips::-webkit-scrollbar-thumb{
      background: rgba(148,163,184,0.25);
      border-radius: 999px;
    }

    body.s26 .s26-rolepill{
      display:inline-flex;
      align-items:center;
      gap:.45rem;
      padding: .28rem .52rem;
      border-radius: 999px;
      border: 1px solid rgba(148,163,184,.45);
      background: rgba(255,255,255,.70);
      color:#0f172a;
      font-size:.78rem;
      font-weight: 950;
      white-space: nowrap;
    }
    body.s26 .s26-rolepill .r-dot{
      width:10px;height:10px;border-radius:999px;
      border:1px solid rgba(15,23,42,0.14);
      flex:0 0 auto;
    }
    body.s26 .s26-rolepill .muted{
      color: rgba(100,116,139,0.92);
      font-weight: 900;
      font-variant-numeric: tabular-nums;
    }
  `;
  document.head.appendChild(style);
}

/* ---------- Robust field access ---------- */
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
    String(
      readAny(r, [
        "player",
        "Player",
        "p.summonerName",
        "summonerName",
        "p.riotIdGameName",
        "riotIdGameName",
      ]) || "—"
    ).trim() || "—"
  );
}

function getMatchId(r) {
  const v = readAny(r, [
    "matchId",
    "match_id",
    "p.matchId",
    "gameId",
    "p.gameId",
    "Game ID",
    "GameID",
    "Match ID",
    "MatchId",
    "MatchID",
  ]);
  const s = String(v ?? "").trim();
  return s || "";
}

/**
 * ✅ Stable match key for de-duping winrate / side / party.
 * Prefer matchId/gameId. Fallback tries timestamps. LAST fallback uses date+duration+queue (best-effort).
 */
function getMatchKey(r) {
  const mid = getMatchId(r);
  if (mid) return `mid:${mid}`;

  const ts = readAny(r, [
    "gameCreation",
    "p.gameCreation",
    "gameStartTimestamp",
    "p.gameStartTimestamp",
    "gameStartTime",
    "p.gameStartTime",
    "p.gameStartTimestampMs",
  ]);
  const tsNum = Number(String(ts ?? "").trim());
  if (Number.isFinite(tsNum) && tsNum > 0) return `ts:${tsNum}`;

  const date = String(readAny(r, ["Date", "date"]) || "").trim();
  const dur = String(
    readAny(r, [
      "p.timePlayed",
      "timePlayed",
      "TIME",
      "p.challenges.gameLength",
      "challenges.gameLength",
    ]) || ""
  ).trim();
  const queue = String(readAny(r, ["queue", "Queue", "p.queueId", "queueId"]) || "").trim();
  return `fb:${date}|${dur}|${queue}`;
}

function getWin(r) {
  if (r?.win === true) return true;
  if (r?.win === false) return false;

  const res = String(readAny(r, ["Result", "result", "p.win", "win"]) || "")
    .trim()
    .toLowerCase();
  if (!res) return null;
  if (res === "win" || res === "true" || res === "1") return true;
  if (res === "loss" || res === "lose" || res === "false" || res === "0") return false;
  return null;
}

function getKills(r) {
  return toInt(readAny(r, ["kills", "Kills", "p.kills", "p.challenges.kills"])) || 0;
}
function getDeaths(r) {
  return toInt(readAny(r, ["deaths", "Deaths", "p.deaths"])) || 0;
}
function getAssists(r) {
  return toInt(readAny(r, ["assists", "Assists", "p.assists"])) || 0;
}

function getRoleRaw(r) {
  return String(
    readAny(r, [
      "role",
      "ROLE",
      "Role",
      "p.role",
      "teamPosition",
      "p.teamPosition",
      "individualPosition",
      "p.individualPosition",
    ]) || ""
  ).trim();
}
function roleKey(role) {
  const rr = String(role ?? "").trim().toUpperCase();
  if (!rr) return "UNK";
  if (rr === "JNG" || rr.includes("JUNG")) return "JNG";
  if (rr === "SUP" || rr.includes("SUP")) return "SUP";
  if (rr === "BOT" || rr === "ADC" || rr.includes("BOT") || rr.includes("BOTTOM")) return "BOT";
  if (rr === "MID" || rr.includes("MID") || rr.includes("MIDDLE")) return "MID";
  if (rr === "TOP") return "TOP";
  return rr;
}

function getChampion(r) {
  return String(readAny(r, ["champion", "Champion", "p.championName", "championName"]) || "—")
    .trim() || "—";
}

function getTimeDeadSeconds(r) {
  const v = readAny(r, ["timeDeadSec", "p.totalTimeSpentDead", "totalTimeSpentDead", "Total Time Spent Dead"]);
  return toNum(v);
}

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

function getSortTimeMs(r) {
  if (r?.date instanceof Date && !isNaN(r.date.getTime())) return r.date.getTime();
  const ts = readAny(r, ["gameCreation", "p.gameCreation", "gameStartTimestamp", "p.gameStartTimestamp"]);
  const n = Number(String(ts ?? "").trim());
  if (Number.isFinite(n) && n > 0) return n;
  const raw = readAny(r, ["Date", "date"]);
  const s = String(raw ?? "").trim();
  const d = s ? new Date(s) : null;
  if (d instanceof Date && !isNaN(d.getTime())) return d.getTime();
  return 0;
}

/* ✅ initials helper (2 letters, readable) */
function initials2(name) {
  const cleaned = String(name ?? "")
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .trim();
  if (!cleaned) return "??";
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  const s = parts[0] || cleaned;
  return s.slice(0, 2).toUpperCase();
}

const champIconCache = new Map();
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

/* ---------- Side (Blue/Red) helpers ---------- */
function getSide(r) {
  const teamStr = String(readAny(r, ["Team", "team", "Side", "side"]) || "").trim().toLowerCase();
  if (teamStr === "blue" || teamStr === "b") return "BLUE";
  if (teamStr === "red" || teamStr === "r") return "RED";

  const tid = toInt(readAny(r, ["teamId", "p.teamId", "TeamId", "Team ID"]));
  if (tid === 100) return "BLUE";
  if (tid === 200) return "RED";

  return "";
}

/* ---------- Role dots renderer (SVG) ---------- */
const PLAYER_PALETTE = ["#A8F3D5", "#FD8E20", "#F3E112", "#CE221B", "#216496", "#D2F4FE", "#290519"];
const ROLE_ORDER = ["TOP", "JNG", "MID", "BOT", "SUP"];
const ROLE_COLOR = {
  TOP: "rgba(249,115,22,0.90)",
  JNG: "rgba(231,175,178,0.90)",
  MID: "rgba(100,116,139,0.80)",
  BOT: "rgba(251,191,36,0.85)",
  SUP: "rgba(34,197,94,0.80)",
};

function setupRoleDots(root, dotsAll, players, matchCount) {
  const svg = root.querySelector("#s26-roleplot-svg");
  const chipsWrap = root.querySelector("#s26-roleplot-chips");
  const metaEl = root.querySelector("#s26-roleplot-meta");
  const toggleBtn = root.querySelector("#s26-roleplot-toggle");
  const dotsPill = root.querySelector("#s26-roleplot-dotpill");

  if (!svg || !chipsWrap || !toggleBtn || !metaEl || !dotsPill) return;

  // stable player color map
  const playerColor = new Map();
  players.forEach((p, i) => {
    playerColor.set(p, PLAYER_PALETTE[i % PLAYER_PALETTE.length]);
  });

  // chips: dot + 2-letter initials ONLY
  const chipHTML = [
    `<button type="button" class="s26-plchip is-active" data-player="">
      <span class="p-dot" style="background: rgba(249,115,22,0.55);"></span>
      ALL
    </button>`,
    ...players.map((p) => {
      const c = playerColor.get(p) || "rgba(148,163,184,0.35)";
      return `<button type="button" class="s26-plchip" data-player="${escapeAttr(p)}" title="${escapeAttr(p)}">
        <span class="p-dot" style="background:${escapeAttr(c)};"></span>
        ${escapeHtml(initials2(p))}
      </button>`;
    }),
  ].join("");
  chipsWrap.innerHTML = chipHTML;

  let activePlayer = ""; // "" = all
  let outcome = "ALL"; // ALL | WIN | LOSS

  function outcomeLabel() {
    if (outcome === "WIN") return "Wins";
    if (outcome === "LOSS") return "Losses";
    return "All games";
  }

  function outcomeDotColor() {
    if (outcome === "WIN") return "rgba(16,185,129,0.55)";
    if (outcome === "LOSS") return "rgba(251,113,133,0.55)";
    return "rgba(148,163,184,0.25)";
  }

  function filteredDots() {
    if (outcome === "WIN") return dotsAll.filter((d) => d.win === true);
    if (outcome === "LOSS") return dotsAll.filter((d) => d.win === false);
    return dotsAll;
  }

  function setActiveChip() {
    chipsWrap.querySelectorAll(".s26-plchip").forEach((b) => {
      const p = b.getAttribute("data-player") || "";
      b.classList.toggle("is-active", p === activePlayer);
    });
  }

  function updateToggleText() {
    toggleBtn.innerHTML = `<span class="dot" style="background:${outcomeDotColor()};"></span>${outcomeLabel()}`;
  }

  function render() {
    const dots = filteredDots();

    // header meta + dot count pill
    const dotsCount = dots.length;
    metaEl.textContent = `${players.length} players · ${matchCount} matches (deduped)`;
    dotsPill.textContent = `${dotsCount} dots`;

    // layout (packed grid per role column)
    const W = 760;
    const marginX = 26;
    const labelH = 28;
    const topPad = 10;
    const bottomPad = 14;

    const dot = 8.2;     // slightly bigger, still tight
    const gap = 1.1;     // “slightly touching”
    const step = dot + gap;

    const colW = (W - marginX * 2) / ROLE_ORDER.length;
    const innerW = colW - 10;
    const maxCols = Math.max(3, Math.floor(innerW / step));

    // prepare per role
    const byRole = new Map(ROLE_ORDER.map((r) => [r, []]));
    for (const d of dots) {
      if (!byRole.has(d.role)) continue;
      byRole.get(d.role).push(d);
    }

    // sort to keep adjacency stable (player clustered, then time)
    const playerIdx = new Map(players.map((p, i) => [p, i]));
    for (const role of ROLE_ORDER) {
      byRole.get(role).sort((a, b) => {
        const ia = playerIdx.get(a.player) ?? 999;
        const ib = playerIdx.get(b.player) ?? 999;
        if (ia !== ib) return ia - ib;
        return (a.t ?? 0) - (b.t ?? 0);
      });
    }

    // compute required height
    let maxRows = 1;
    for (const role of ROLE_ORDER) {
      const n = byRole.get(role).length;
      const rows = Math.max(1, Math.ceil(n / maxCols));
      maxRows = Math.max(maxRows, rows);
    }
    const H = labelH + topPad + maxRows * step + bottomPad;

    const lines = [];
    const labels = [];
    const circles = [];

    // subtle column separators + role labels
    for (let i = 0; i < ROLE_ORDER.length; i++) {
      const x0 = marginX + i * colW;
      const xMid = x0 + colW / 2;

      if (i > 0) {
        lines.push(
          `<line x1="${x0}" y1="${labelH}" x2="${x0}" y2="${H}" stroke="rgba(148,163,184,0.16)" stroke-width="1" />`
        );
      }

      labels.push(
        `<text x="${xMid}" y="19" text-anchor="middle" font-size="12.5" font-weight="950" fill="rgba(100,116,139,0.95)">${ROLE_ORDER[i]}</text>`
      );
    }

    // a few horizontal guides
    const guideCount = Math.min(4, Math.max(2, Math.floor(maxRows / 2)));
    for (let g = 1; g <= guideCount; g++) {
      const y = labelH + topPad + (g * (maxRows * step)) / (guideCount + 1);
      lines.push(
        `<line x1="${marginX}" y1="${y.toFixed(2)}" x2="${(W - marginX).toFixed(2)}" y2="${y.toFixed(2)}" stroke="rgba(148,163,184,0.10)" stroke-width="1" />`
      );
    }

    // circles packed
    for (let ri = 0; ri < ROLE_ORDER.length; ri++) {
      const role = ROLE_ORDER[ri];
      const arr = byRole.get(role);
      const xLeft = marginX + ri * colW + 6;
      const yTop = labelH + topPad + 4;

      const cols = maxCols;

      for (let i = 0; i < arr.length; i++) {
        const d = arr[i];
        const cx = xLeft + (i % cols) * step + dot / 2;
        const cy = yTop + Math.floor(i / cols) * step + dot / 2;

        const isFocus = !!activePlayer && d.player === activePlayer;
        const isDim = !!activePlayer && d.player !== activePlayer;

        let alpha = 0.70;
        if (outcome === "ALL") {
          if (d.win === true) alpha = 0.70;
          else if (d.win === false) alpha = 0.32;
          else alpha = 0.45;
        } else {
          alpha = 0.72;
        }

        let fill = ROLE_COLOR[role] || "rgba(148,163,184,0.40)";
        let stroke = "rgba(15,23,42,0.10)";
        let strokeW = 0.6;

        if (isDim) {
          fill = "rgba(148,163,184,0.22)";
          alpha = 0.20;
          stroke = "rgba(148,163,184,0.14)";
          strokeW = 0.5;
        }
        if (isFocus) {
          alpha = 0.92;
          stroke = "rgba(15,23,42,0.18)";
          strokeW = 0.9;
        }

        const title = `${d.player} · ${role} · ${d.win === true ? "Win" : d.win === false ? "Loss" : "—"}`;

        circles.push(
          `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${(dot / 2).toFixed(2)}" fill="${fill}" fill-opacity="${alpha.toFixed(2)}" stroke="${stroke}" stroke-width="${strokeW}">
            <title>${escapeHtml(title)}</title>
          </circle>`
        );
      }
    }

    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.innerHTML = `
      <rect x="0" y="0" width="${W}" height="${H}" fill="transparent"></rect>
      ${lines.join("")}
      ${labels.join("")}
      ${circles.join("")}
    `;
  }

  chipsWrap.addEventListener("click", (e) => {
    const btn = e.target?.closest?.(".s26-plchip");
    if (!btn) return;
    activePlayer = btn.getAttribute("data-player") || "";
    setActiveChip();
    render();
  });

  toggleBtn.addEventListener("click", () => {
    outcome = outcome === "ALL" ? "WIN" : outcome === "WIN" ? "LOSS" : "ALL";
    updateToggleText();
    render();
  });

  updateToggleText();
  render();
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

  // Dates
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

  // ✅ Build match map once (dedupe for winrate/side/party)
  const matchMap = new Map(); // key -> { win:null|bool, side:"", players:Set }
  for (const r of rows) {
    const key = getMatchKey(r);
    if (!matchMap.has(key)) matchMap.set(key, { win: null, side: "", players: new Set() });
    const m = matchMap.get(key);

    const w = getWin(r);
    if (m.win == null && w != null) m.win = w;

    const s = getSide(r);
    if (!m.side && s) m.side = s;

    m.players.add(getPlayerName(r));
  }

  const matchTotal = matchMap.size;

  // ✅ Winrate per MATCH (not per row)
  let matchWins = 0;
  let matchKnown = 0;
  let blueW = 0,
    blueG = 0,
    redW = 0,
    redG = 0;

  for (const m of matchMap.values()) {
    if (m.win == null) continue;
    matchKnown++;
    if (m.win) matchWins++;

    if (m.side === "BLUE") {
      blueG++;
      if (m.win) blueW++;
    } else if (m.side === "RED") {
      redG++;
      if (m.win) redW++;
    }
  }

  const winrate = matchKnown ? (matchWins / matchKnown) * 100 : 0;
  const blueTxt = blueG ? `${formatPct((blueW / blueG) * 100)}` : "—";
  const redTxt = redG ? `${formatPct((redW / redG) * 100)}` : "—";

  // Avg KDA from totals (row-weighted = roster performance)
  let k = 0,
    d = 0,
    a = 0;
  for (const r of rows) {
    k += getKills(r);
    d += getDeaths(r);
    a += getAssists(r);
  }
  const avgKda = (k + a) / Math.max(1, d);

  // Grey screen total (row-weighted)
  const totalDeadSec = rows.reduce((sum, r) => sum + (getTimeDeadSeconds(r) || 0), 0);
  const avgDeadSecPerRow = rows.length ? totalDeadSec / rows.length : 0;

  // Role counts (row-weighted)
  const roleCounts = new Map([
    ["TOP", 0],
    ["JNG", 0],
    ["MID", 0],
    ["BOT", 0],
    ["SUP", 0],
  ]);
  for (const r of rows) {
    const rk = roleKey(getRoleRaw(r));
    if (roleCounts.has(rk)) roleCounts.set(rk, (roleCounts.get(rk) || 0) + 1);
  }
  const roleEntries = [...roleCounts.entries()].sort((aa, bb) => bb[1] - aa[1]);
  const mostRole = roleEntries[0]?.[0] || "—";

  // Champ counts (row-weighted)
  const champCounts = new Map();
  for (const r of rows) {
    const c = getChampion(r);
    if (!c || c === "—") continue;
    champCounts.set(c, (champCounts.get(c) || 0) + 1);
  }
  const topChamps = [...champCounts.entries()]
    .sort((aa, bb) => bb[1] - aa[1])
    .slice(0, 5)
    .map(([champ, count]) => ({ champ, count, pct: rows.length ? (count / rows.length) * 100 : 0 }));
  const mostChamp = topChamps[0]?.champ || "—";

  // ✅ Solo vs party (per match)
  const matchCounts = [...matchMap.values()].map((m) => m.players.size);
  const soloMatches = matchCounts.filter((n) => n === 1).length;
  const duoPlusMatches = matchCounts.filter((n) => n >= 2).length;
  const soloPct = matchTotal ? (soloMatches / matchTotal) * 100 : 0;

  // ✅ NEW: Winrate by stack size (per match)
  const STACK_LABEL = {
    1: "Solo",
    2: "Duo",
    3: "Trio",
    4: "4-stack",
  };
  const stackAgg = new Map([
    [1, { total: 0, known: 0, wins: 0 }],
    [2, { total: 0, known: 0, wins: 0 }],
    [3, { total: 0, known: 0, wins: 0 }],
    [4, { total: 0, known: 0, wins: 0 }],
  ]);

  for (const m of matchMap.values()) {
    const sizeRaw = Number(m.players?.size || 0);
    if (!Number.isFinite(sizeRaw) || sizeRaw <= 0) continue;
    const size = Math.max(1, Math.min(4, sizeRaw)); // clamp to 1..4
    const a0 = stackAgg.get(size);
    if (!a0) continue;
    a0.total++;

    if (m.win != null) {
      a0.known++;
      if (m.win === true) a0.wins++;
    }
  }

  const stackRows = [1, 2, 3, 4]
    .map((n) => {
      const s = stackAgg.get(n);
      const total = s?.total || 0;
      const known = s?.known || 0;
      const wins = s?.wins || 0;
      const wr = known ? (wins / known) * 100 : null;
      return { n, label: STACK_LABEL[n], total, known, wins, wr };
    })
    .filter((x) => x.total > 0); // show only sizes that exist in this dataset

  let bestStack = null;
  for (const r of stackRows) {
    if (!r.known || r.wr == null) continue;
    if (!bestStack || r.wr > bestStack.wr) bestStack = r;
  }

  const bestStackText = bestStack ? `${bestStack.label} ${Math.round(bestStack.wr)}%` : "—";
  const stackRowsHtml = stackRows.length
    ? `<div class="s26-stackrows">
        ${stackRows
          .map((r) => {
            const wrTxt = r.known ? `${Math.round(r.wr)}%` : "—";
            const detail = r.known ? `${r.wins}/${r.known}` : `0/0`;
            return `
              <div class="s26-stackrow" title="${escapeAttr(`${r.label}: ${detail} (matches: ${r.total})`)}">
                <span>${escapeHtml(r.label)}</span>
                <span class="muted">${escapeHtml(wrTxt)} · ${escapeHtml(detail)}</span>
              </div>
            `;
          })
          .join("")}
      </div>`
    : `<div class="s26-stat-hint">—</div>`;

  // Multikills totals + top3 per type (row-weighted)
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

    const rowsHtml = top3.length
      ? top3
          .map(
            ([n, c]) =>
              `<div class="s26-stat-hint s26-top3-row">${escapeHtml(n)} <span class="count">(${c})</span></div>`
          )
          .join("")
      : `<div class="s26-stat-hint s26-top3-row">—</div>`;

    return { total, topRowsHtml: `<div class="s26-top3-wrap">${rowsHtml}</div>` };
  }
  const mkD = multiSummary("d");
  const mkT = multiSummary("t");
  const mkQ = multiSummary("q");
  const mkP = multiSummary("p");

  // Role dots data (dedupe per player+match)
  const dotKeySet = new Set();
  const roleDots = [];
  const playerCounts = new Map();

  for (const r of rows) {
    const player = getPlayerName(r);
    const role = roleKey(getRoleRaw(r));
    if (!ROLE_ORDER.includes(role)) continue;

    const mk = getMatchKey(r);
    const key = `${mk}|${player}`;
    if (dotKeySet.has(key)) continue;
    dotKeySet.add(key);

    const w = getWin(r);
    const t = getSortTimeMs(r);

    roleDots.push({ player, role, win: w, t });
    playerCounts.set(player, (playerCounts.get(player) || 0) + 1);
  }

  const players = [...playerCounts.entries()]
    .sort((a1, b1) => b1[1] - a1[1] || String(a1[0]).localeCompare(String(b1[0])))
    .map(([p]) => p);

  const roleTotal = [...roleCounts.values()].reduce((s, v) => s + v, 0) || 1;

  // ✅ compact role chips (one line)
  const rolePill = (k2) => {
    const count = roleCounts.get(k2) || 0;
    const pct = (count / roleTotal) * 100;
    const dotCls =
      k2 === "TOP" ? "role-top" :
      k2 === "JNG" ? "role-jng" :
      k2 === "MID" ? "role-mid" :
      k2 === "BOT" ? "role-bot" : "role-sup";
    return `
      <span class="s26-rolepill" title="${k2} · ${count} (${formatPct(pct)})">
        <span class="r-dot ${dotCls}"></span>
        ${k2}
        <span class="muted">${count} · ${formatPct(pct)}</span>
      </span>
    `;
  };

  el.innerHTML = `
    <div class="card-header">
      <div>
        <div class="card-title">${escapeHtml(title)}</div>
        <div class="card-subtitle">
          Matches: ${matchTotal}
          ${minDate && maxDate ? ` · ${escapeHtml(formatShortDate(minDate))} → ${escapeHtml(formatShortDate(maxDate))}` : ""}
        </div>
      </div>
    </div>

    <div class="s26-stat-grid">
      <div class="s26-stat">
        <div class="s26-stat-label">Winrate</div>
        <div class="s26-stat-value">${Math.round(winrate)}%</div>
        <div class="s26-stat-hint">${matchWins}/${matchKnown || matchTotal}</div>
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
        <div class="s26-stat-hint">${Math.round(avgDeadSecPerRow)}s avg / row</div>
      </div>

      <div class="s26-stat">
        <div class="s26-stat-label">Solo vs party</div>
        <div class="s26-stat-value">${Math.round(soloPct)}% Solo</div>
        <div class="s26-stat-hint">${soloMatches}/${matchTotal} solo · ${duoPlusMatches}/${matchTotal} duo+</div>
      </div>

      <!-- ✅ NEW mini card: Stack Winrate -->
      <div class="s26-stat">
        <div class="s26-stat-label">Stack winrate</div>
        <div class="s26-stat-value">${escapeHtml(bestStackText)}</div>
        <div class="s26-stat-hint">Which stack wins more</div>
        ${stackRowsHtml}
      </div>

      <div class="s26-stat">
        <div class="s26-stat-label">Double kills</div>
        <div class="s26-stat-value">${mkD.total}</div>
        <div class="s26-stat-hint">Top 3</div>
        ${mkD.topRowsHtml}
      </div>

      <div class="s26-stat">
        <div class="s26-stat-label">Triple kills</div>
        <div class="s26-stat-value">${mkT.total}</div>
        <div class="s26-stat-hint">Top 3</div>
        ${mkT.topRowsHtml}
      </div>

      <div class="s26-stat">
        <div class="s26-stat-label">Quadra kills</div>
        <div class="s26-stat-value">${mkQ.total}</div>
        <div class="s26-stat-hint">Top 3</div>
        ${mkQ.topRowsHtml}
      </div>

      <div class="s26-stat">
        <div class="s26-stat-label">Penta kills</div>
        <div class="s26-stat-value">${mkP.total}</div>
        <div class="s26-stat-hint">Top 3</div>
        ${mkP.topRowsHtml}
      </div>
    </div>

    <div class="s26-summary-grid">
      <!-- Role distribution (DOTS) -->
      <div class="s26-panel">
        <div class="s26-panel-title">
          <span>Role Distribution</span>
          <span class="pill" id="s26-roleplot-dotpill">${roleDots.length} dots</span>
        </div>
        <div class="s26-panel-sub">Five role columns · Click a player chip to focus · Use the chip to cycle All → Wins → Losses.</div>

        <div class="s26-roleplot-top">
          <div class="left">Role dots <span class="s26-roleplot-meta" id="s26-roleplot-meta"></span></div>
          <button type="button" class="s26-togglechip" id="s26-roleplot-toggle">
            <span class="dot"></span>All games
          </button>
        </div>

        <div class="s26-roleplot-canvas">
          <svg class="s26-roleplot-svg" id="s26-roleplot-svg" role="img" aria-label="Role dots distribution"></svg>
        </div>

        <div class="s26-playerchips" id="s26-roleplot-chips"></div>

        <div class="s26-rolelegendchips">
          ${ROLE_ORDER.map(rolePill).join("")}
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
              ? topChamps
                  .map(
                    (c) => `
                <div class="s26-champ-chip" title="${escapeAttr(c.champ)} · ${c.count} ${plural(c.count, "game")}">
                  <img class="s26-champ-icon" data-champ="${escapeAttr(c.champ)}" alt="${escapeAttr(c.champ)} icon" />
                  <div class="s26-champ-meta">
                    <div class="s26-champ-name">${escapeHtml(c.champ)}</div>
                    <div class="s26-champ-sub">${c.count} · ${formatPct(c.pct)}</div>
                  </div>
                </div>
              `
                  )
                  .join("")
              : `<div class="text-sm text-slate-500">No champions found.</div>`
          }
        </div>
      </div>
    </div>
  `;

  hydrateSummaryChampIcons(el);

  // Mount role dots interactions
  setupRoleDots(el, roleDots, players, matchTotal);
}
