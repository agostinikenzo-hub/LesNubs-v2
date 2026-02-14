/* season26team.js
   Season 26 (Team / 5-stack) — Summary + Team TPI + Team Synergy + Match List

   Notes:
   - Loads Team (5-stack) tab CSV (gid=0)
   - Keeps only roster players (Nübs) + only matches that are full 5-stack (exactly 5 unique roster players)
   - Renders:
     1) Team Summary      -> #team-summary
     2) Team TPI (lite)   -> #objective-impact   (placeholder-friendly, uses Performance Rating + trend)
     3) Team Synergy      -> #team-synergy       (lite, uses team-level metrics if present)
     4) Match List (10)   -> #team-matchlist
*/

const SEASON26TEAM_CSV =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSbxcPDjBBWSe4jIwXuQe-_o5C1RGg067CxU4g_j1yqG8D3DAj8BFqvwKuLopePRuUWv7qE5bmEPuLZ/pub?gid=0&single=true&output=csv";


const SEASON26_TIMELINE_CSV =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vSbxcPDjBBWSe4jIwXuQe-_o5C1RGg067CxU4g_j1yqG8D3DAj8BFqvwKuLopePRuUWv7qE5bmEPuLZ/pub?gid=1060990396&single=true&output=csv";


// Keep the same start date convention you used in Other Flex
const START_DATE = new Date(2026, 0, 8); // 08 Jan 2026

// Mount IDs (Team page)
// ===== TEAM mini-cards mount =====
const TEAM_CARDS_CONTAINER_ID = "player-mini-cards";
const TEAM_SUMMARY_ID = "team-summary";
const TEAM_TPI_ID = "objective-impact";   // reusing your existing anchor/id
const TEAM_SYNERGY_ID = "team-synergy";   // reusing your existing anchor/id
const TEAM_MATCHLIST_ID = "team-matchlist";
const TEAM_OBJECTIVES_ID = "objective-win-impact";

// Your roster (same as Other Flex)
const ROSTER = [
  "BurningElf",
  "Yung Sweeney",
  "Betzhamo",
  "Emorek",
  "UnbreakableHaide",
  "denotes",
  "Amazing Cholo",
  "Amazing Braakuss",
];

// Dot colors (same vibe)
const DOT_COLORS = {
  win: "#10b981",
  loss: "#fb7185",
  empty: "#e2e8f0",
  ring: "#ff8000",
};

// Noise backgrounds (assets/noise/001.png ... 008.png)
const NOISE_BASE_PATHS = ["assets/noise", "./assets/noise", "../assets/noise"];
const NOISE_FILES = Array.from({ length: 8 }, (_, i) => `${String(i + 1).padStart(3, "0")}.png`);
let RESOLVED_NOISE_URLS = [];

// DDragon version for champ icons
const DD_VERSION = "16.1.1";

document.addEventListener("DOMContentLoaded", init);

async function init() {
  injectMiniCardStyles();

  const statusEl = document.getElementById("status");
  try {
    if (statusEl) statusEl.textContent = "Loading Season 26 Team (5-stack) CSV…";

    await resolveNoiseBackgrounds();

    const csvText = await fetchTextWithDebug(SEASON26TEAM_CSV);
    const { rows, headers } = parseCSVToObjects(csvText);

    console.log("TEAM CSV loaded:", {
      rowCount: rows.length,
      headers: headers.slice(0, 35),
      sampleRow: rows[0] || null,
    });

    // 1) base filters: date scope + roster-only rows
    const rosterScoped = rows
      .filter((r) => isOnOrAfterStart(r))
      .filter((r) => isRosterRow(r));

    // 2) full 5-stack only (exactly 5 unique roster players per match)
    const fullStackMatchIds = getFullFiveMatchIds(rosterScoped);
    const filtered = rosterScoped.filter((r) => fullStackMatchIds.has(getMatchIdAny(r)));

    console.log("TEAM filtered:", {
      rosterScopedRows: rosterScoped.length,
      full5Matches: fullStackMatchIds.size,
      filteredRows: filtered.length,
    });

    // Render blocks
renderTeamMiniCards(filtered);
renderTeamSummary26(filtered);
renderTeamTPI26(filtered);
renderTeamSynergy26(filtered);
renderTeamMatchList26(filtered);
//renderObjectiveWinImpact26(filtered, { roster: ROSTER, ddVersion: DD_VERSION });


// ---- Lane Dynamics needs timeline rows ----
const timelineText = await fetchTextWithDebug(SEASON26_TIMELINE_CSV);
const { rows: timelineRows } = parseCSVToObjects(timelineText);

renderLaneDynamics26(filtered, timelineRows, { roster: ROSTER });

window.renderLaneDynamics26 = renderLaneDynamics26;



    if (statusEl) {
      statusEl.innerHTML = `Loaded <span class="font-semibold">${filtered.length}</span> rows · <span class="font-semibold">${fullStackMatchIds.size}</span> full 5-stack matches`;
    }
  } catch (err) {
    console.error(err);
    if (statusEl) statusEl.textContent = `Error loading data: ${err.message || err}`;
    safeMount(TEAM_SUMMARY_ID, fallbackCard("Season 26 — Team Summary", "Failed to load Team CSV."));
    safeMount(TEAM_TPI_ID, fallbackCard("Total Player Impact", "Failed to load Team CSV."));
    safeMount(TEAM_SYNERGY_ID, fallbackCard("Team Synergy & Identity", "Failed to load Team CSV."));
    safeMount(TEAM_MATCHLIST_ID, fallbackCard("Match List (Last 10)", "Failed to load Team CSV."));
    safeMount(TEAM_CARDS_CONTAINER_ID, fallbackCard("Player Mini Cards", "Failed to render (check console)."));
  }
}

// ============================================================================
// Styles (dots + small chips)
// ============================================================================
function injectMiniCardStyles() {
  if (document.getElementById("s26team-style")) return;

  const style = document.createElement("style");
  style.id = "s26team-style";
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

    .s26-chip{
      display:inline-flex;align-items:center;gap:6px;
      padding:6px 10px;border-radius:9999px;
      border:1px solid rgba(226,232,240,0.9);
      background:rgba(255,255,255,0.75);
      font-size:0.72rem;font-weight:800;color:#0f172a;line-height:1;
    }
    .s26-chip .k{
      font-size:0.62rem;font-weight:900;color:rgba(100,116,139,0.95);
      letter-spacing:0.06em;
    }
  `;
  document.head.appendChild(style);
}

// ============================================================================
// Fetch + noise
// ============================================================================
async function fetchTextWithDebug(url) {
  const res = await fetch(url, { cache: "no-store" });

  console.log("Fetch debug:", {
    ok: res.ok,
    status: res.status,
    type: res.type,
    contentType: res.headers.get("content-type") || "",
    finalUrl: res.url,
  });

  if (!res.ok) throw new Error(`Fetch failed: HTTP ${res.status}`);

  const text = await res.text();
  console.log("CSV debug:", { length: text.length, head: text.slice(0, 120) });

  if (!text || text.length < 5) throw new Error("CSV response is empty. Check publish/gid.");
  return text;
}

async function resolveNoiseBackgrounds() {
  for (const base of NOISE_BASE_PATHS) {
    const urls = NOISE_FILES.map((f) => `${base}/${f}`);
    const existing = [];

    for (const u of urls) {
      const ok = await urlExists(u);
      if (ok) existing.push(u);
    }

    if (existing.length) {
      RESOLVED_NOISE_URLS = existing;
      console.log("✅ Noise backgrounds resolved:", { base, count: existing.length });
      return;
    }
  }

  console.warn("⚠️ No noise backgrounds found. Ensure assets/noise/001.png..008.png exist");
  RESOLVED_NOISE_URLS = [];
}

async function urlExists(url) {
  try {
    const r = await fetch(url, { method: "HEAD", cache: "no-store" });
    if (r.ok) return true;
  } catch {}
  try {
    const r2 = await fetch(url, { method: "GET", cache: "no-store" });
    return r2.ok;
  } catch {
    return false;
  }
}

function noiseForKey(key) {
  if (!RESOLVED_NOISE_URLS.length) return "";
  const idx = hashStr(String(key)) % RESOLVED_NOISE_URLS.length;
  return RESOLVED_NOISE_URLS[idx];
}

function hashStr(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

// ============================================================================
// Filters
// ============================================================================
function isOnOrAfterStart(row) {
  const d = parseDateEU(getAny(row, ["Date", "DATE"]));
  if (!d) return true;
  return d >= START_DATE;
}

function isRosterRow(row) {
  // Prefer explicit flag if it exists, otherwise roster membership
  const nub = boolish(row["Is Nub"]);
  if (nub) return true;
  const name = getPlayerNameAny(row);
  return ROSTER.includes(name);
}

// full 5-stack = match has exactly 5 unique roster players
function getFullFiveMatchIds(rosterRows) {
  const map = new Map(); // matchId -> Set(players)
  for (const r of rosterRows) {
    const id = getMatchIdAny(r);
    const name = getPlayerNameAny(r);
    if (!id || !name) continue;
    if (!map.has(id)) map.set(id, new Set());
    map.get(id).add(name);
  }

  const out = new Set();
  for (const [id, set] of map.entries()) {
    if (set.size === 5) out.add(id);
  }
  return out;
}

// ============================================================================
// 🧩 TEAM MINI CARDS — copy of Other Flex mini-cards, adapted for 5-stack
// Mount: <div id="player-mini-cards"></div>
// ============================================================================

function injectTeamMiniCardStyles() {
  if (document.getElementById("s26team-mini-style")) return;

  const style = document.createElement("style");
  style.id = "s26team-mini-style";
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

    .mk-chip{
      display:inline-flex;align-items:center;gap:6px;
      padding:5px 9px;border-radius:9999px;
      border:1px solid rgba(226,232,240,0.9);
      background:rgba(255,255,255,0.75);
      font-size:0.72rem;font-weight:800;color:#0f172a;line-height:1;
    }
    .mk-chip .k{
      font-size:0.62rem;font-weight:900;color:rgba(100,116,139,0.95);
      letter-spacing:0.06em;
    }
  `;
  document.head.appendChild(style);
}

function renderTeamMiniCards(rows) {
  injectTeamMiniCardStyles();

  const mount = document.getElementById(TEAM_CARDS_CONTAINER_ID);
  if (!mount) {
    console.warn(`[Team Mini Cards] Missing mount #${TEAM_CARDS_CONTAINER_ID}`);
    return;
  }

  if (!rows || !rows.length) {
    mount.innerHTML = teamFallbackCard("Season 26 — Team Player Cards", "No data rows provided.");
    return;
  }

  // Build + render
  const players = buildTeamPlayerMiniCards(rows);

  if (!players.length) {
    mount.innerHTML = teamFallbackCard("Season 26 — Team Player Cards", "No roster players found in this dataset.");
    return;
  }

  mount.innerHTML = players.map(renderTeamPlayerCard).join("");
}

function buildTeamPlayerMiniCards(rows) {
  // Uses same roster + avatar map as your existing scripts:
  // ROSTER, AVATAR_MAP, RESOLVED_NOISE_URLS, DOT_COLORS should exist in team script too.
  const byPlayer = new Map();

  rows.forEach((r) => {
    const name = getTeamPlayerName(r);
    if (!name) return;
    if (Array.isArray(ROSTER) && !ROSTER.includes(name)) return;

    const matchId = getTeamMatchId(r);
    const dateObj = parseTeamDateEU(r["Date"]);
    const champ = getTeamChampion(r);
    const role = getTeamRole(r);
    const win = isTeamWin(r);

    if (!byPlayer.has(name)) {
      byPlayer.set(name, {
        name,
        gameMap: new Map(),
        kills: 0,
        deaths: 0,
        assists: 0,
        champs: new Map(),
        roles: new Map(),
        doubleKills: 0,
        tripleKills: 0,
        quadraKills: 0,
        pentaKills: 0,
        enemyMissingPings: 0,
      });
    }

    const p = byPlayer.get(name);

    const key = matchId || `${name}|${String(r["Date"] || "")}|${champ}|${role}`;

    if (!p.gameMap.has(key)) {
      const vision = teamNum(r["Vision Score"] ?? r["p.visionScore"]);
      const fbk = teamBoolish(r["p.firstBloodKill"]);
      const fba = teamBoolish(r["p.firstBloodAssist"]);

      p.gameMap.set(key, { win, date: dateObj, role, champ, vision, fbk, fba });

      if (role && role !== "UNKNOWN") p.roles.set(role, (p.roles.get(role) || 0) + 1);
      if (champ) p.champs.set(champ, (p.champs.get(champ) || 0) + 1);
    }

    p.kills += teamNum(r["Kills"]);
    p.deaths += teamNum(r["Deaths"]);
    p.assists += teamNum(r["Assists"]);

    p.doubleKills += teamNum(r["p.doubleKills"] ?? r["doubleKills"]);
    p.tripleKills += teamNum(r["p.tripleKills"] ?? r["tripleKills"]);
    p.quadraKills += teamNum(r["p.quadraKills"] ?? r["quadraKills"]);
    p.pentaKills += teamNum(r["p.pentaKills"] ?? r["pentaKills"]);

    p.enemyMissingPings += teamNum(r["p.enemyMissingPings"] ?? r["enemyMissingPings"]);
  });

  const out = [...byPlayer.values()].map((p) => {
    const gamesArr = [...p.gameMap.values()].sort((a, b) => {
      const ta = a.date ? a.date.getTime() : 0;
      const tb = b.date ? b.date.getTime() : 0;
      return ta - tb;
    });

    const games = gamesArr.length;
    const wins = gamesArr.filter((g) => g.win).length;
    const wr = games ? (wins / games) * 100 : 0;
    const kda = (p.kills + p.assists) / Math.max(1, p.deaths);

    const topChamps = [...p.champs.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([champ, count]) => ({ champ, count }));

    const topRoles = [...p.roles.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([role, count]) => ({ role, count, share: games ? (count / games) * 100 : 0 }));

    const last10 = gamesArr.slice(-10);
    const last10Dots = last10.map((g) => (g.win ? "win" : "loss"));

    const visionTotal = gamesArr.reduce((s, g) => s + teamNum(g.vision), 0);
    const visionAvg = games ? visionTotal / games : 0;

    const fbKill = gamesArr.reduce((s, g) => s + (g.fbk ? 1 : 0), 0);
    const fbAssist = gamesArr.reduce((s, g) => s + (g.fba ? 1 : 0), 0);

    return {
      name: p.name,
      games,
      wins,
      wr,
      kills: p.kills,
      deaths: p.deaths,
      assists: p.assists,
      kda,
      topChamps,
      topRoles,
      last10Dots,
      visionAvg,
      firstBlood: { kill: fbKill, assist: fbAssist },
      multikills: { d: p.doubleKills, t: p.tripleKills, q: p.quadraKills, p: p.pentaKills },
      enemyMissingPings: p.enemyMissingPings,
    };
  });

  out.sort((a, b) => b.games - a.games || b.kda - a.kda);
  return out;
}

function renderTeamPlayerCard(p) {
  const wrTone = p.wr >= 60 ? "text-emerald-600" : p.wr <= 45 ? "text-rose-500" : "text-slate-900";

  const chip = (label, value, valueClass = "text-slate-900") => `
    <div class="px-2.5 py-1.5 rounded-2xl border border-slate-200 bg-white/75 leading-tight">
      <div class="text-[0.55rem] uppercase tracking-wide text-slate-400">${label}</div>
      <div class="text-[0.95rem] font-semibold ${valueClass}">${value}</div>
    </div>
  `;

  const smallChip = (text) => `
    <span class="px-2 py-1 rounded-full border border-slate-200 bg-white/70 text-[0.65rem] text-slate-800">
      ${text}
    </span>
  `;

  const rolesChips = p.topRoles.length
    ? p.topRoles.map((r) => smallChip(`${teamEscape(r.role)} <span class="text-slate-500">${r.share.toFixed(0)}%</span>`)).join("")
    : `<span class="text-[0.65rem] text-slate-400">—</span>`;

  const champChips = p.topChamps.length
    ? p.topChamps.map((c) => smallChip(`${teamEscape(c.champ)} <span class="text-slate-500">(${c.count})</span>`)).join("")
    : `<span class="text-[0.65rem] text-slate-400">—</span>`;

  const dots = [];
  for (let i = 0; i < 10; i++) dots.push(p.last10Dots[i] || "empty");
  const latestIdx = p.last10Dots.length ? p.last10Dots.length - 1 : -1;
  const dotsHTML = dots.map((state, idx) => {
    const cls = state === "win" ? "win" : state === "loss" ? "loss" : "";
    const latest = idx === latestIdx ? "latest" : "";
    return `<span class="s26-dot ${cls} ${latest}"></span>`;
  }).join("");

  const bgUrl = teamNoiseForPlayer(p.name);
  const overlayAlpha = 0.38;

  const mk = p.multikills || { d: 0, t: 0, q: 0, p: 0 };
  const mkChip = (k, v) => `<span class="mk-chip"><span class="k">${k}</span>${v}</span>`;
  const fb = p.firstBlood || { kill: 0, assist: 0 };

  return `
    <div
      class="mini-card glass3d relative overflow-hidden rounded-[24px] border border-slate-200/80 shadow-md w-full max-w-[330px]"
      style="
        background-image:${bgUrl ? `url('${bgUrl}')` : "none"};
        background-size: cover;
        background-position: center;
        --dot-win:${(DOT_COLORS && DOT_COLORS.win) || "#10b981"};
        --dot-loss:${(DOT_COLORS && DOT_COLORS.loss) || "#fb7185"};
        --dot-empty:${(DOT_COLORS && DOT_COLORS.empty) || "#e2e8f0"};
        --dot-ring:${(DOT_COLORS && DOT_COLORS.ring) || "#ff8000"};
      "
    >
      <div class="absolute inset-0" style="background: rgba(255,255,255,${overlayAlpha});"></div>

      <div class="relative p-3">
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2.5 min-w-0">
            <div class="w-10 h-10 rounded-2xl border border-slate-200 bg-white overflow-hidden shrink-0">
              <img
                src="${teamPlayerAvatarUrl(p)}"
                alt="${teamEscape(p.name)} avatar"
                class="w-full h-full object-cover object-center block"
                loading="lazy"
                referrerpolicy="no-referrer"
                onerror="this.onerror=null; this.src='${champIconUrl("Malzahar")}';"
                />

            </div>

            <div class="min-w-0">
              <div class="flex items-center gap-2 min-w-0">
                <div class="text-[1.0rem] font-semibold text-slate-900 truncate">${teamEscape(p.name)}</div>
                <span class="shrink-0 text-[0.65rem] font-semibold px-2 py-[2px] rounded-full border border-slate-200 bg-white/70 text-slate-700">
                  ${p.games}g
                </span>
              </div>
              <div class="text-[0.7rem] text-slate-600 leading-tight">Team (5-stack)</div>
            </div>
          </div>

          <span class="shrink-0 text-[0.65rem] font-extrabold px-2.5 py-[4px] rounded-full"
            style="border:1px solid rgba(231,175,178,0.9); background: rgba(231,175,178,0.22); color:#ff8000;">
            Team
          </span>
        </div>

        <div class="mt-2.5 grid grid-cols-3 gap-2">
          ${chip("KDA", p.kda.toFixed(2))}
          ${chip("WR", `${p.wr.toFixed(1)}%`, wrTone)}
          ${chip("K/D/A", `${p.kills}/${p.deaths}/${p.assists}`)}
        </div>

        <div class="mt-2 grid grid-cols-2 gap-2">
          ${chip("Vision avg", p.visionAvg.toFixed(1))}
          ${chip("First Blood", `${fb.kill}K ${fb.assist}A`)}
        </div>

        <div class="mt-2.5 flex items-center justify-between gap-2">
          <div class="text-[0.65rem] uppercase tracking-wide text-slate-500">Last 10</div>
          <div class="flex items-center gap-1.5">${dotsHTML}</div>
        </div>

        <div class="mt-2.5 grid grid-cols-2 gap-2">
          <div>
            <div class="text-[0.65rem] uppercase tracking-wide text-slate-500 mb-1">Roles</div>
            <div class="flex flex-wrap gap-1.5">${rolesChips}</div>
          </div>
          <div>
            <div class="text-[0.65rem] uppercase tracking-wide text-slate-500 mb-1">Champs</div>
            <div class="flex flex-wrap gap-1.5">${champChips}</div>
          </div>
        </div>

        <div class="mt-3 rounded-2xl border border-slate-200 bg-white/75 px-2.5 py-2">
          <div class="flex items-center justify-between gap-2">
            <div class="text-[0.65rem] uppercase tracking-wide text-slate-500">Multikills</div>
            <div class="flex items-center gap-1">
              ${mkChip("D", mk.d)}${mkChip("T", mk.t)}${mkChip("Q", mk.q)}${mkChip("P", mk.p)}
            </div>
          </div>

          <div class="mt-2 flex items-center justify-between">
            <div class="text-[0.72rem] font-semibold text-slate-700">Enemy Missing pings</div>
            <div class="text-[0.9rem] font-semibold text-slate-900">${p.enemyMissingPings}</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ---- Team mini-card helpers (local, so you can paste without conflicts) ----
function teamNum(v) {
  if (v === null || v === undefined || v === "") return 0;
  const n = parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}
function teamBoolish(v) {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "y";
}
function parseTeamDateEU(s) {
  const str = String(s || "").trim();
  if (!str) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const d = new Date(str);
    return isFinite(d) ? d : null;
  }
  const m = str.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (!m) return null;
  const dd = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10) - 1;
  let yy = parseInt(m[3], 10);
  const hh = m[4] ? parseInt(m[4], 10) : 0;
  const min = m[5] ? parseInt(m[5], 10) : 0;
  if (yy < 100) yy += 2000;
  const d = new Date(yy, mm, dd, hh, min, 0);
  return isFinite(d) ? d : null;
}
function teamEscape(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function getTeamPlayerName(r) {
  return String(r["p.riotIdGameName"] || r["Player"] || r["p.summonerName"] || "").trim();
}
function getTeamMatchId(r) {
  return String(r["Match ID"] || r["MatchID"] || r["Game ID"] || r["Date"] || "").trim();
}
function getTeamChampion(r) {
  return String(r["Champion"] || r["p.championName"] || "").trim();
}
function getTeamRole(r) {
  const raw = String(r["ROLE"] || r["p.teamPosition"] || r["p.individualPosition"] || r["p.role"] || "").trim().toUpperCase();
  if (!raw) return "UNKNOWN";
  if (raw.includes("TOP")) return "TOP";
  if (raw.includes("JUNG")) return "JUNGLE";
  if (raw.includes("MID")) return "MID";
  if (raw.includes("BOT") || raw.includes("BOTTOM") || raw.includes("ADC")) return "ADC";
  if (raw.includes("SUP") || raw.includes("UTIL")) return "SUPPORT";
  return raw;
}
function isTeamWin(r) {
  const v = String(r["Result"] || r["p.win"] || "").trim().toLowerCase();
  if (v === "win") return true;
  if (v === "loss") return false;
  return teamBoolish(r["p.win"]);
}
function teamAvatarFor(name) {
  const map = (typeof AVATAR_MAP !== "undefined" && AVATAR_MAP) ? AVATAR_MAP : {};
  const file = map[name] || "default.svg";
  return `assets/avatars/${file}`;

}
function teamNoiseForPlayer(name) {
  if (!Array.isArray(RESOLVED_NOISE_URLS) || !RESOLVED_NOISE_URLS.length) return "";
  let h = 0;
  const str = String(name || "");
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return RESOLVED_NOISE_URLS[h % RESOLVED_NOISE_URLS.length];
}
function teamFallbackCard(title, msg) {
  return `
    <div class="glass3d mini-card p-4 max-w-[420px]">
      <div class="text-sm font-semibold text-orange-500">${title}</div>
      <div class="text-xs text-slate-500 mt-1">${msg}</div>
    </div>
  `;
}


// ============================================================================
// ✅ TEAM SUMMARY (Season Overview style, no tabs)
// + Blue/Red side winrate (colored like S25)
// + Top 3 lists for: Pink / Vision / Damage / Kills (single-game peaks)
// Mount: #team-summary (TEAM_SUMMARY_ID)
// ============================================================================

function renderTeamSummary26(rows) {
  const mount = document.getElementById(TEAM_SUMMARY_ID);
  if (!mount) return;

  if (!rows || !rows.length) {
    mount.innerHTML = fallbackSection("Season 26 — Team (5-stack) Summary", "No full 5-stack games found yet.");
    return;
  }

  // Group rows by match
  const matchMap = new Map(); // id -> {id, date, win, timeMin, side, rows:[]}
  for (const r of rows) {
    const id = getMatchIdAny(r);
    if (!id) continue;

    const d = parseDateEU(getAny(r, ["Date", "DATE"]));
    const w = isWinAny(r);
    const side = getTeamSideAny(r);

    if (!matchMap.has(id)) {
      matchMap.set(id, {
        id,
        date: d,
        win: w,
        timeMin: parseTimeMin(r),
        side,
        rows: [],
      });
    }

    const m = matchMap.get(id);
    m.rows.push(r);

    // keep latest date if present
    if (!m.date && d) m.date = d;
    if (m.date && d && d.getTime() > m.date.getTime()) m.date = d;

    // win: safe OR
    m.win = m.win || w;

    // time (first finite)
    if (!Number.isFinite(m.timeMin)) {
      const tm = parseTimeMin(r);
      if (Number.isFinite(tm)) m.timeMin = tm;
    }

    // side (first known)
    if (!m.side && side) m.side = side;
  }

  const matches = [...matchMap.values()].sort((a, b) => {
    const ta = a.date ? a.date.getTime() : 0;
    const tb = b.date ? b.date.getTime() : 0;
    return ta - tb;
  });

  const totalGames = matches.length;
  const wins = matches.filter((m) => m.win).length;
  const winrate = totalGames ? ((wins / totalGames) * 100).toFixed(1) : "0.0";

  // Team totals (rows already = roster-only + 5-stack)
  const totalKills = rows.reduce((s, r) => s + toNum(getAny(r, ["Kills", "p.kills", "kills"])), 0);
  const totalDeaths = rows.reduce((s, r) => s + toNum(getAny(r, ["Deaths", "p.deaths", "deaths"])), 0);
  const totalAssists = rows.reduce((s, r) => s + toNum(getAny(r, ["Assists", "p.assists", "assists"])), 0);

  const teamKDA =
    totalDeaths > 0 ? ((totalKills + totalAssists) / totalDeaths).toFixed(2) : (totalKills + totalAssists) > 0 ? "∞" : "0.00";

  // Avg time
  const timeVals = matches.map((m) => m.timeMin).filter((x) => Number.isFinite(x));
  const avgTime = timeVals.length ? (timeVals.reduce((a, b) => a + b, 0) / timeVals.length).toFixed(1) : "—";

  // Avg Kill Participation (per match avg across the 5 players, then average across matches)
  const kpPerMatch = [];
  for (const m of matches) {
    const vals = m.rows
      .map((r) => toPercentMaybeTeam(getAny(r, ["Kill Part %", "Kill Participation", "p.challenges.killParticipation"])))
      .filter((x) => Number.isFinite(x) && x > 0);
    if (vals.length) kpPerMatch.push(vals.reduce((a, b) => a + b, 0) / vals.length);
  }
  const avgKP = kpPerMatch.length ? (kpPerMatch.reduce((a, b) => a + b, 0) / kpPerMatch.length).toFixed(1) : "0.0";

  // Blue / Red side winrate (match-level)
  const blueMatches = matches.filter((m) => m.side === "Blue");
  const redMatches = matches.filter((m) => m.side === "Red");
  const blueWR = blueMatches.length ? ((blueMatches.filter((m) => m.win).length / blueMatches.length) * 100).toFixed(1) : "—";
  const redWR = redMatches.length ? ((redMatches.filter((m) => m.win).length / redMatches.length) * 100).toFixed(1) : "—";

  // Current streak
  let streakType = null; // true=win false=loss
  let streakCount = 0;
  for (let i = matches.length - 1; i >= 0; i--) {
    const cur = !!matches[i].win;
    if (streakType === null) {
      streakType = cur;
      streakCount = 1;
    } else if (cur === streakType) {
      streakCount++;
    } else break;
  }
  const streakLabel = streakType === true ? "Currently on a Winning Streak" : "Currently on a Losing Streak";
  const streakValue = `${streakCount || 0} Games`;

  // Last updated (latest match date)
  const lastDate = matches[matches.length - 1]?.date || null;
  const lastUpdated = lastDate
    ? lastDate.toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "—";

  // Most played champs (Top 5) — count unique matches per champ
  const champGameMap = new Map(); // champ -> Set(matchId)
  rows.forEach((r) => {
    const champ = getChampionAny(r);
    const gid = getMatchIdAny(r);
    if (!champ || !gid) return;
    if (!champGameMap.has(champ)) champGameMap.set(champ, new Set());
    champGameMap.get(champ).add(gid);
  });

  const topChamps = [...champGameMap.entries()]
    .map(([champ, set]) => ({ champ, games: set.size }))
    .sort((a, b) => b.games - a.games || a.champ.localeCompare(b.champ))
    .slice(0, 5);

  const topChampsFooter = topChamps.length
    ? `<div class="space-y-0.5 text-xs text-gray-600">
        ${topChamps.map((c, i) => `<div>${i + 1}. ${escapeHTML(c.champ)} <span class="text-gray-400">(${c.games})</span></div>`).join("")}
      </div>`
    : `<span class="text-xs text-gray-400">No champion data</span>`;

  // Top 3 (single-game peaks): Pink / Vision / Damage / Kills
  const topPink3 = teamTopNByValue(rows, (r) =>
    toNum(getAny(r, ["PINK", "p.detectorWardsPlaced", "p.challenges.controlWardsPlaced", "p.visionWardsBoughtInGame"]))
  );
  const topVision3 = teamTopNByValue(rows, (r) => toNum(getAny(r, ["Vision Score", "p.visionScore"])));
  const topDamage3 = teamTopNByValue(rows, (r) => toNum(getAny(r, ["Damage Dealt", "p.totalDamageDealtToChampions"])));
  const topKills3 = teamTopNByValue(rows, (r) => toNum(getAny(r, ["Kills", "p.kills", "kills"])));

  const mostPink = topPink3[0] || { value: 0, player: "—" };
  const highestVision = topVision3[0] || { value: 0, player: "—" };
  const highestDamage = topDamage3[0] || { value: 0, player: "—" };
  const highestKills = topKills3[0] || { value: 0, player: "—" };

  // Multikill totals + top killer per type
  const killTypes = [
    { key: "p.doubleKills", label: "Double Kill" },
    { key: "p.tripleKills", label: "Triple Kill" },
    { key: "p.quadraKills", label: "Quadra Kill" },
    { key: "p.pentaKills", label: "Penta Kill" },
  ];

  const killData = killTypes.map((kt) => {
    let total = 0;
    const playerCounts = new Map();

    rows.forEach((r) => {
      const v = toNum(r[kt.key] ?? r[kt.key.replace("p.", "")] ?? r[`${kt.label}s`] ?? r[kt.label]);
      if (!v) return;
      total += v;
      const name = getPlayerNameAny(r) || r["Player"] || "Unknown";
      playerCounts.set(name, (playerCounts.get(name) || 0) + v);
    });

    const top = [...playerCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    const footer =
      total > 0 && top
        ? `<span class="text-xs text-gray-500 font-normal">Top: ${escapeHTML(top[0])} (${top[1]})</span>`
        : `<span class="text-xs text-gray-400 font-normal">No top ${kt.label.toLowerCase()} killer</span>`;

    return { label: kt.label, total, footer };
  });

  // colored value classes for side WR
  const blueValueClass = blueWR === "—" ? "text-lg font-semibold" : "text-lg font-semibold text-blue-600";
  const redValueClass = redWR === "—" ? "text-lg font-semibold" : "text-lg font-semibold text-rose-600";

  mount.innerHTML = `
    <section class="section-wrapper fade-in mb-8">
      <div class="dashboard-card bg-white shadow-sm rounded-2xl border border-orange-50 p-4">
        <div class="flex items-center justify-between mb-4 gap-3">
          <div>
            <h2 class="text-[1.1rem] font-semibold text-orange-500 tracking-tight">
              Season 26 — Team (5-stack) Summary
            </h2>
            <div class="text-xs text-gray-500">
              Games where <span class="font-semibold">5 Les Nübs</span> queued together.
            </div>
          </div>

          <span class="text-[0.7rem] font-extrabold px-3 py-1 rounded-full"
            style="border:1px solid rgba(231,175,178,0.9); background: rgba(231,175,178,0.22); color:#ff8000;">
            5-stack
          </span>
        </div>

        <!-- Core row -->
        <div class="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          ${renderTeamSummaryMiniCard26("Games", totalGames, "text-lg font-semibold", `<div class="text-xs text-gray-500 mt-1">Full 5 only</div>`)}
          ${renderTeamSummaryMiniCard26("Winrate", `${winrate}%`)}
          ${renderTeamSummaryMiniCard26("Team KDA", teamKDA)}
          ${renderTeamSummaryMiniCard26("Avg. Kill Participation", `${avgKP}%`)}
          ${renderTeamSummaryMiniCard26("Avg. Time", `${avgTime} min`)}
        </div>

        <!-- Side winrates + streak + last updated -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          ${renderTeamSummaryMiniCard26("Blue Side Winrate", blueWR === "—" ? "—" : `${blueWR}%`, blueValueClass)}
          ${renderTeamSummaryMiniCard26("Red Side Winrate", redWR === "—" ? "—" : `${redWR}%`, redValueClass)}
          ${renderTeamSummaryMiniCard26(streakLabel, streakValue)}
          ${renderTeamSummaryMiniCard26("Last Updated", lastUpdated, "text-sm")}
        </div>

        <!-- Peaks + Top champs -->
        <div class="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-6">
          ${renderTeamSummaryMiniCard26(
            "Most Pink Wards in a Game",
            mostPink.value ? mostPink.value : "—",
            "text-lg font-semibold",
            teamTopListHTML(topPink3, (v) => String(v))
          )}
          ${renderTeamSummaryMiniCard26(
            "Highest Vision Score",
            highestVision.value ? highestVision.value : "—",
            "text-lg font-semibold",
            teamTopListHTML(topVision3, (v) => String(v))
          )}
          ${renderTeamSummaryMiniCard26(
            "Highest Damage Dealt",
            highestDamage.value ? highestDamage.value.toLocaleString("en-US") : "—",
            "text-lg font-semibold",
            teamTopListHTML(topDamage3, (v) => v.toLocaleString("en-US"))
          )}
          ${renderTeamSummaryMiniCard26(
            "Most Kills in a Game",
            highestKills.value ? highestKills.value : "—",
            "text-lg font-semibold",
            teamTopListHTML(topKills3, (v) => String(v))
          )}
        </div>

        <!-- Champs + Multikills -->
        <div class="grid grid-cols-1 sm:grid-cols-5 gap-3 mt-4">
          ${renderTeamSummaryMiniCard26(
            "Most Played Champions (Top 5)",
            topChamps.length ? "Top picks" : "—",
            "text-xs font-semibold text-gray-600",
            topChampsFooter
          )}
          ${killData.map((k) => renderTeamSummaryMiniCard26(k.label, k.total, "text-lg font-semibold", k.footer)).join("")}
        </div>
      </div>
    </section>
  `;
}

// ✅ Team-only mini card renderer (avoid name collisions)
function renderTeamSummaryMiniCard26(label, value, valueClass = "text-lg font-semibold", footer = "") {
  return `
    <div class="p-4 rounded-2xl bg-white shadow-sm border border-gray-100 text-left flex flex-col justify-between">
      <div>
        <div class="text-gray-500 text-xs mb-1">${label}</div>
        <div class="${valueClass} text-gray-800">${value}</div>
      </div>
      <div class="mt-1">${footer}</div>
    </div>
  `;
}

// Top-N helper: single-game peaks (dedupe by match+player)
function teamTopNByValue(rows, valueFn, n = 3) {
  const seen = new Set();
  const entries = [];

  for (const r of rows) {
    const player = getPlayerNameAny(r) || r["Player"] || "Unknown";
    const matchId = getMatchIdAny(r) || "";
    const key = `${matchId}|${player}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const value = valueFn(r);
    if (!Number.isFinite(value) || value <= 0) continue;

    entries.push({ player, value });
  }

  entries.sort((a, b) => b.value - a.value);
  return entries.slice(0, n);
}

function teamTopListHTML(topArr, formatter = (v) => v.toLocaleString("en-US")) {
  if (!topArr || !topArr.length) return `<span class="text-xs text-gray-400">No data</span>`;
  return `
    <div class="space-y-0.5 text-xs text-gray-600">
      ${topArr
        .map((t, i) => `<div>${i + 1}. ${escapeHTML(t.player)} <span class="text-gray-400">(${formatter(t.value)})</span></div>`)
        .join("")}
    </div>
  `;
}

// % helper that handles "37.9%" OR "0.379" OR "37.9"
function toPercentMaybeTeam(v) {
  const s = String(v ?? "").trim();
  if (!s) return NaN;
  const n = parseFloat(s.replace("%", "").replace(",", "."));
  if (!Number.isFinite(n)) return NaN;
  return n <= 1 ? n * 100 : n;
}

// Side helper (works with Team CSV: Team / p.teamId / etc.)
function getTeamSideAny(r) {
  const raw = String(getAny(r, ["Team", "Side", "TEAM", "team"]) || "").trim().toLowerCase();
  if (raw.includes("blue") || raw === "b") return "Blue";
  if (raw.includes("red") || raw === "r") return "Red";

  const teamId = toNum(getAny(r, ["p.teamId", "teamId"]));
  if (teamId === 100) return "Blue";
  if (teamId === 200) return "Red";

  // sometimes Team is literally "100"/"200"
  if (raw === "100") return "Blue";
  if (raw === "200") return "Red";

  return "";
}

// ============================================================================
// ⭐ TEAM TOTAL PLAYER IMPACT (Season 26 — 5-stack) — v2.1 (namespaced)
// Trend (Δ) = Last Match score (single game) vs Baseline (season excluding last match)
//
// - Main TPI shown = season score on ALL team games in scope (incl. last match)
// - Trend shown = last match score (no shrink) minus baseline score (shrink) excluding last match
// - Last match picked by max(Date) per Match ID (fallback: lexicographic ID)
// - Namespaced to avoid collisions with Other Flex script
// ============================================================================

// ---------- TPI Config (TEAM) ----------
const TPI26_TEAM = {
  BASE: 40,
  WINSOR_P: 0.05,

  // TEAM datasets are small early season — keep shrink, but don’t ⭐ everyone forever
  MIN_GAMES_FLOOR: 3,
  SHRINK_FRACTION_OF_MAX: 0.35,

  OBJ_PART_WEIGHTS: {
    Dragon: 0.25,
    Herald: 0.10,
    Baron: 0.25,
    Tower: 0.20,
    Atakhan: 0.10,
    VoidGrub: 0.10,
  },

  ROLE_PILLAR_WEIGHTS: {
    SUPPORT: { indiv: 0.22, obj: 0.18, vision: 0.35, reli: 0.25 },
    JUNGLE:  { indiv: 0.30, obj: 0.30, vision: 0.18, reli: 0.22 },
    TOP:     { indiv: 0.33, obj: 0.25, vision: 0.12, reli: 0.30 },
    MID:     { indiv: 0.38, obj: 0.25, vision: 0.12, reli: 0.25 },
    ADC:     { indiv: 0.42, obj: 0.25, vision: 0.10, reli: 0.23 },
    UNKNOWN: { indiv: 0.35, obj: 0.25, vision: 0.15, reli: 0.25 },
  },

  METRIC_WEIGHTS: {
    indiv: { kda: 0.18, kp: 0.18, dmgShare: 0.18, dpm: 0.14, goldMin: 0.14, csMin: 0.10, firstBlood: 0.08 },
    obj:   { objKills: 0.38, objPart: 0.30, plates: 0.16, objDmg: 0.16 },
    vision:{ vsMin: 0.30, wardsMin: 0.16, wardsKilledMin: 0.20, denial: 0.18, enemyJunglePct: 0.10, pinkEff: 0.06 },
    reli:  { consistency: 0.22, momentum: 0.18, macroCons: 0.18, perfRating: 0.18, timeDeadRateSafe: 0.14, deathDistSafe: 0.10 },
  },

  TREND_UP: 1.0,
  TREND_DOWN: -1.0,
};

// ============================================================================
// ✅ Public entry (keeps your existing function name + mount ID)
// ============================================================================
function renderTeamTPI26(rows) {
  teamTpi26Render(rows, { mountId: TEAM_TPI_ID, roster: ROSTER });
}

// ============================================================================
// Render wrapper
// ============================================================================
function teamTpi26Render(rows, opts = {}) {
  const mountId = opts.mountId || "objective-impact";
  const mount = document.getElementById(mountId);
  if (!mount) {
    console.warn(`[TEAM TPI26] Mount #${mountId} not found.`);
    return;
  }

  if (!rows || !rows.length) {
    mount.innerHTML = teamTpi26Fallback("Total Player Impact (Team)", "No data yet.");
    return;
  }

  const roster = Array.isArray(opts.roster) ? opts.roster : null;
  const scoped = roster ? rows.filter((r) => roster.includes(teamTpi26GetPlayerNameAny(r))) : rows.slice();
  if (!scoped.length) {
    mount.innerHTML = teamTpi26Fallback("Total Player Impact (Team)", "No players found in scope.");
    return;
  }

  // ---- determine last match ----
  const lastMatchId = teamTpi26GetLatestMatchId(scoped);
  const baselineRows = lastMatchId ? scoped.filter((r) => teamTpi26GetMatchIdAny(r) !== lastMatchId) : scoped.slice();
  const lastRows = lastMatchId ? scoped.filter((r) => teamTpi26GetMatchIdAny(r) === lastMatchId) : [];

  // ---- season score (ALL games) ----
  const seasonRaw = teamTpi26BuildPlayersRaw(scoped);
  const seasonRes = teamTpi26ScorePlayers(seasonRaw, { applyShrink: true });
  const seasonPlayers = seasonRes.players;

  // ---- baseline score (excluding last match) ----
  let baselineImpactMap = new Map();
  let normCtxForLast = seasonRes.normCtx;

  if (baselineRows.length) {
    const baseRaw = teamTpi26BuildPlayersRaw(baselineRows);
    const baseRes = teamTpi26ScorePlayers(baseRaw, { applyShrink: true });
    baselineImpactMap = new Map(baseRes.players.map((p) => [p.name, p.impact]));
    normCtxForLast = baseRes.normCtx; // normalize last game vs baseline bounds
  }

  // ---- last match score (single game, no shrink) ----
  const lastImpactMap = new Map();
  if (lastRows.length) {
    const lastRaw = teamTpi26BuildPlayersSingleMatch(lastRows);
    const lastRes = teamTpi26ScorePlayers(lastRaw, { applyShrink: false, normCtx: normCtxForLast });
    lastRes.players.forEach((p) => lastImpactMap.set(p.name, p.impact));
  }

  // ---- inject TREND into season players ----
  seasonPlayers.forEach((p) => {
    const last = lastImpactMap.get(p.name);
    const base = baselineImpactMap.get(p.name);

    if (typeof last === "number" && typeof base === "number") {
      p.delta = last - base;
      p.playedLast = true;
      p.trendOk = true;
    } else if (typeof last === "number") {
      p.delta = null;
      p.playedLast = true;
      p.trendOk = false;
    } else {
      p.delta = null;
      p.playedLast = false;
      p.trendOk = false;
    }
  });

  teamTpi26RenderCard(mount, seasonPlayers, { lastMatchId });
}

// ============================================================================
// 1) Build per-player aggregates (season aggregates)
// ============================================================================
function teamTpi26BuildPlayersRaw(rows) {
  const byPlayer = new Map();

  rows.forEach((r) => {
    const name = teamTpi26GetPlayerNameAny(r);
    const matchId = teamTpi26GetMatchIdAny(r);
    if (!name || !matchId) return;

    const role = teamTpi26NormRole(teamTpi26GetRoleAny(r));
    const won = teamTpi26IsWinAny(r);

    if (!byPlayer.has(name)) {
      byPlayer.set(name, {
        name,
        gamesSet: new Set(),
        roleFreq: new Map(),
        wins: 0,

        kills: 0, deaths: 0, assists: 0,
        kpSum: 0, kpCount: 0,

        dmgShareSum: 0,
        dpmSum: 0,
        goldMinSum: 0,
        csMinSum: 0,

        firstBloodInvolv: 0,
        fbGamesSet: new Set(),

        objKillsSum: 0,
        objPartDragon: 0, objPartHerald: 0, objPartBaron: 0, objPartTower: 0, objPartAtakhan: 0, objPartVoid: 0,
        platesSum: 0,
        objDmgSum: 0,

        visionScoreSum: 0,
        timePlayedSum: 0,
        wardsPlacedSum: 0,
        wardsKilledSum: 0,
        denialSum: 0,
        enemyJunglePctSum: 0,
        pinkEffSum: 0,

        consistencySum: 0,
        momentumSum: 0,
        macroConsSum: 0,
        perfRatingSum: 0,
        timeDeadSum: 0,
        deathDistSum: 0,
      });
    }

    const p = byPlayer.get(name);
    if (p.gamesSet.has(matchId)) return;
    p.gamesSet.add(matchId);

    p.roleFreq.set(role, (p.roleFreq.get(role) || 0) + 1);
    if (won) p.wins += 1;

    const kills = teamTpi26ToNum(teamTpi26GetAny(r, ["Kills", "p.kills", "kills"]));
    const deaths = teamTpi26ToNum(teamTpi26GetAny(r, ["Deaths", "p.deaths", "deaths"]));
    const assists = teamTpi26ToNum(teamTpi26GetAny(r, ["Assists", "p.assists", "assists"]));
    p.kills += kills; p.deaths += deaths; p.assists += assists;

    const kpRaw = teamTpi26ToNum(teamTpi26GetAny(r, ["Kill Part %", "p.challenges.killParticipation", "killParticipation"]));
    if (kpRaw > 0) {
      const kpPct = kpRaw <= 1.01 ? kpRaw * 100 : kpRaw;
      p.kpSum += kpPct;
      p.kpCount += 1;
    }

    const dmgShareRaw = teamTpi26ToNum(teamTpi26GetAny(r, ["Team Damage %", "Damage Share %", "p.challenges.teamDamagePercentage", "teamDamagePercentage"]));
    const dmgSharePct = dmgShareRaw <= 1.01 && dmgShareRaw > 0 ? dmgShareRaw * 100 : dmgShareRaw;
    p.dmgShareSum += dmgSharePct;

    p.dpmSum += teamTpi26ToNum(teamTpi26GetAny(r, ["Damage per Minute", "p.challenges.damagePerMinute", "damagePerMinute"]));
    p.goldMinSum += teamTpi26ToNum(teamTpi26GetAny(r, ["Gold/min", "p.challenges.goldPerMinute", "goldPerMinute"]));

    // CS/min: direct, else compute
    const csMinDirect = teamTpi26ToNum(teamTpi26GetAny(r, ["CS/min", "csPerMinute"]));
    if (csMinDirect > 0) {
      p.csMinSum += csMinDirect;
    } else {
      const cs = teamTpi26ToNum(teamTpi26GetAny(r, ["CS", "p.totalMinionsKilled", "totalMinionsKilled"]));
      const tpSec = teamTpi26ToNum(teamTpi26GetAny(r, ["p.timePlayed", "timePlayed"]));
      const tMin = tpSec > 0 ? tpSec / 60 : Math.max(1, teamTpi26ToNum(teamTpi26GetAny(r, ["TIME"])));
      p.csMinSum += tMin > 0 ? (cs / tMin) : 0;
    }

    const fbKill = teamTpi26Boolish(teamTpi26GetAny(r, ["p.firstBloodKill", "firstBloodKill"]));
    const fbAssist = teamTpi26Boolish(teamTpi26GetAny(r, ["p.firstBloodAssist", "firstBloodAssist"]));
    if ((fbKill || fbAssist) && !p.fbGamesSet.has(matchId)) {
      p.fbGamesSet.add(matchId);
      p.firstBloodInvolv += 1;
    }

    p.objKillsSum += teamTpi26ToNum(teamTpi26GetAny(r, ["Objective Kills", "p.challenges.objectiveKills", "objectiveKills"]));
    p.objPartDragon += teamTpi26ToNum(teamTpi26GetAny(r, ["Dragon Participation"]));
    p.objPartHerald += teamTpi26ToNum(teamTpi26GetAny(r, ["Herald Participation"]));
    p.objPartBaron += teamTpi26ToNum(teamTpi26GetAny(r, ["Baron Participation"]));
    p.objPartTower += teamTpi26ToNum(teamTpi26GetAny(r, ["Tower Participation"]));
    p.objPartAtakhan += teamTpi26ToNum(teamTpi26GetAny(r, ["Atakhan Participation"]));
    p.objPartVoid += teamTpi26ToNum(teamTpi26GetAny(r, ["Void Grub Participation"]));

    p.platesSum += teamTpi26ToNum(teamTpi26GetAny(r, ["Turret Plates Taken", "p.challenges.turretPlatesTaken", "turretPlatesTaken"]));
    p.objDmgSum += teamTpi26ToNum(teamTpi26GetAny(r, ["p.damageDealtToObjectives", "damageDealtToObjectives"]));

    p.visionScoreSum += teamTpi26ToNum(teamTpi26GetAny(r, ["Vision Score", "p.visionScore", "visionScore"]));
    const tp = teamTpi26ToNum(teamTpi26GetAny(r, ["p.timePlayed", "timePlayed"]));
    p.timePlayedSum += tp > 0 ? tp : 0;

    p.wardsPlacedSum += teamTpi26ToNum(teamTpi26GetAny(r, ["WARDS", "Wards", "p.wardsPlaced", "wardsPlaced"]));
    p.wardsKilledSum += teamTpi26ToNum(teamTpi26GetAny(r, ["WARDS KILLED", "p.wardsKilled", "wardsKilled"]));
    p.denialSum += teamTpi26ToNum(teamTpi26GetAny(r, ["Vision Denial Efficiency"]));
    p.enemyJunglePctSum += teamTpi26ToNum(teamTpi26GetAny(r, ["Wards in Enemy Jungle %"]));
    p.pinkEffSum += teamTpi26ToNum(teamTpi26GetAny(r, ["Pink Efficiency"]));

    p.consistencySum += teamTpi26ToNum(teamTpi26GetAny(r, ["Consistency Index"]));
    p.momentumSum += teamTpi26ToNum(teamTpi26GetAny(r, ["Momentum Stability"]));
    p.macroConsSum += teamTpi26ToNum(teamTpi26GetAny(r, ["Macro Consistency"]));
    p.perfRatingSum += teamTpi26ToNum(teamTpi26GetAny(r, ["Performance Rating", "p.challenges.performanceRating", "performanceRating"]));

    p.timeDeadSum += teamTpi26ToNum(teamTpi26GetAny(r, ["p.totalTimeSpentDead", "totalTimeSpentDead"]));
    p.deathDistSum += teamTpi26ToNum(teamTpi26GetAny(r, ["Average Death Distance"]));
  });

  return [...byPlayer.values()].map((p) => {
    const games = p.gamesSet.size || 1;
    const winrate = (p.wins / games) * 100;

    const kda = (p.kills + p.assists) / Math.max(1, p.deaths);
    const kp = p.kpCount > 0 ? p.kpSum / p.kpCount : 0;

    const dmgShare = p.dmgShareSum / games;
    const dpm = p.dpmSum / games;
    const goldMin = p.goldMinSum / games;
    const csMin = p.csMinSum / games;

    const firstBloodRate = (p.firstBloodInvolv / games) * 100;

    const objPart =
      TPI26_TEAM.OBJ_PART_WEIGHTS.Dragon  * (p.objPartDragon / games) +
      TPI26_TEAM.OBJ_PART_WEIGHTS.Herald  * (p.objPartHerald / games) +
      TPI26_TEAM.OBJ_PART_WEIGHTS.Baron   * (p.objPartBaron / games) +
      TPI26_TEAM.OBJ_PART_WEIGHTS.Tower   * (p.objPartTower / games) +
      TPI26_TEAM.OBJ_PART_WEIGHTS.Atakhan * (p.objPartAtakhan / games) +
      TPI26_TEAM.OBJ_PART_WEIGHTS.VoidGrub* (p.objPartVoid / games);

    const objKills = p.objKillsSum / games;
    const plates = p.platesSum / games;
    const objDmg = p.objDmgSum / games;

    const timeMin = Math.max(1, (p.timePlayedSum / games) / 60);
    const vsMin = (p.visionScoreSum / games) / timeMin;
    const wardsMin = (p.wardsPlacedSum / games) / timeMin;
    const wardsKilledMin = (p.wardsKilledSum / games) / timeMin;

    const denial = p.denialSum / games;
    const enemyJunglePct = p.enemyJunglePctSum / games;
    const pinkEff = p.pinkEffSum / games;

    const consistency = p.consistencySum / games;
    const momentum = p.momentumSum / games;
    const macroCons = p.macroConsSum / games;
    const perfRating = p.perfRatingSum / games;

    const timeDeadRate = (p.timeDeadSum / games) / Math.max(1, (p.timePlayedSum / games));
    const deathDist = p.deathDistSum / games;

    const roleBreakdown = teamTpi26BuildRoleBreakdown(p.roleFreq);

    return {
      name: p.name,
      games,
      wins: p.wins,
      winrate,
      roleBreakdown,

      raw: {
        kda, kp, dmgShare, dpm, goldMin, csMin, firstBloodRate,
        objPart, objKills, plates, objDmg,
        vsMin, wardsMin, wardsKilledMin, denial, enemyJunglePct, pinkEff,
        consistency, momentum, macroCons, perfRating, timeDeadRate, deathDist,
      },

      pillar: { indiv: 0, obj: 0, vision: 0, reli: 0 },
      totalRaw: 0,
      totalShrunk: 0,
      impact: 0,
      delta: null,
      playedLast: false,
      trendOk: false,
      isGuest: false,
    };
  });
}

// ============================================================================
// 1b) Build player vectors for a SINGLE MATCH (last game only)
// ============================================================================
function teamTpi26BuildPlayersSingleMatch(matchRows) {
  const byPlayer = new Map();

  matchRows.forEach((r) => {
    const name = teamTpi26GetPlayerNameAny(r);
    if (!name) return;

    const role = teamTpi26NormRole(teamTpi26GetRoleAny(r));
    const won = teamTpi26IsWinAny(r);

    const kills = teamTpi26ToNum(teamTpi26GetAny(r, ["Kills", "p.kills", "kills"]));
    const deaths = teamTpi26ToNum(teamTpi26GetAny(r, ["Deaths", "p.deaths", "deaths"]));
    const assists = teamTpi26ToNum(teamTpi26GetAny(r, ["Assists", "p.assists", "assists"]));

    const kda = (kills + assists) / Math.max(1, deaths);

    const kpRaw = teamTpi26ToNum(teamTpi26GetAny(r, ["Kill Part %", "p.challenges.killParticipation", "killParticipation"]));
    const kp = kpRaw > 0 ? (kpRaw <= 1.01 ? kpRaw * 100 : kpRaw) : 0;

    const dmgShareRaw = teamTpi26ToNum(teamTpi26GetAny(r, ["Team Damage %", "Damage Share %", "p.challenges.teamDamagePercentage", "teamDamagePercentage"]));
    const dmgShare = dmgShareRaw > 0 ? (dmgShareRaw <= 1.01 ? dmgShareRaw * 100 : dmgShareRaw) : 0;

    const dpm = teamTpi26ToNum(teamTpi26GetAny(r, ["Damage per Minute", "p.challenges.damagePerMinute", "damagePerMinute"]));
    const goldMin = teamTpi26ToNum(teamTpi26GetAny(r, ["Gold/min", "p.challenges.goldPerMinute", "goldPerMinute"]));

    let csMin = teamTpi26ToNum(teamTpi26GetAny(r, ["CS/min", "csPerMinute"]));
    if (!(csMin > 0)) {
      const cs = teamTpi26ToNum(teamTpi26GetAny(r, ["CS", "p.totalMinionsKilled", "totalMinionsKilled"]));
      const tpSec = teamTpi26ToNum(teamTpi26GetAny(r, ["p.timePlayed", "timePlayed"]));
      const tMin = tpSec > 0 ? tpSec / 60 : Math.max(1, teamTpi26ToNum(teamTpi26GetAny(r, ["TIME"])));
      csMin = tMin > 0 ? (cs / tMin) : 0;
    }

    const fbKill = teamTpi26Boolish(teamTpi26GetAny(r, ["p.firstBloodKill", "firstBloodKill"]));
    const fbAssist = teamTpi26Boolish(teamTpi26GetAny(r, ["p.firstBloodAssist", "firstBloodAssist"]));
    const firstBloodRate = (fbKill || fbAssist) ? 100 : 0;

    const objPart =
      TPI26_TEAM.OBJ_PART_WEIGHTS.Dragon  * teamTpi26ToNum(teamTpi26GetAny(r, ["Dragon Participation"])) +
      TPI26_TEAM.OBJ_PART_WEIGHTS.Herald  * teamTpi26ToNum(teamTpi26GetAny(r, ["Herald Participation"])) +
      TPI26_TEAM.OBJ_PART_WEIGHTS.Baron   * teamTpi26ToNum(teamTpi26GetAny(r, ["Baron Participation"])) +
      TPI26_TEAM.OBJ_PART_WEIGHTS.Tower   * teamTpi26ToNum(teamTpi26GetAny(r, ["Tower Participation"])) +
      TPI26_TEAM.OBJ_PART_WEIGHTS.Atakhan * teamTpi26ToNum(teamTpi26GetAny(r, ["Atakhan Participation"])) +
      TPI26_TEAM.OBJ_PART_WEIGHTS.VoidGrub* teamTpi26ToNum(teamTpi26GetAny(r, ["Void Grub Participation"]));

    const objKills = teamTpi26ToNum(teamTpi26GetAny(r, ["Objective Kills", "p.challenges.objectiveKills", "objectiveKills"]));
    const plates = teamTpi26ToNum(teamTpi26GetAny(r, ["Turret Plates Taken", "p.challenges.turretPlatesTaken", "turretPlatesTaken"]));
    const objDmg = teamTpi26ToNum(teamTpi26GetAny(r, ["p.damageDealtToObjectives", "damageDealtToObjectives"]));

    const visionScore = teamTpi26ToNum(teamTpi26GetAny(r, ["Vision Score", "p.visionScore", "visionScore"]));
    const tpSec = teamTpi26ToNum(teamTpi26GetAny(r, ["p.timePlayed", "timePlayed"]));
    const timeMin = Math.max(1, (tpSec > 0 ? tpSec / 60 : Math.max(1, teamTpi26ToNum(teamTpi26GetAny(r, ["TIME"])))));

    const vsMin = visionScore / timeMin;
    const wardsMin = teamTpi26ToNum(teamTpi26GetAny(r, ["WARDS", "Wards", "p.wardsPlaced", "wardsPlaced"])) / timeMin;
    const wardsKilledMin = teamTpi26ToNum(teamTpi26GetAny(r, ["WARDS KILLED", "p.wardsKilled", "wardsKilled"])) / timeMin;

    const denial = teamTpi26ToNum(teamTpi26GetAny(r, ["Vision Denial Efficiency"]));
    const enemyJunglePct = teamTpi26ToNum(teamTpi26GetAny(r, ["Wards in Enemy Jungle %"]));
    const pinkEff = teamTpi26ToNum(teamTpi26GetAny(r, ["Pink Efficiency"]));

    const consistency = teamTpi26ToNum(teamTpi26GetAny(r, ["Consistency Index"]));
    const momentum = teamTpi26ToNum(teamTpi26GetAny(r, ["Momentum Stability"]));
    const macroCons = teamTpi26ToNum(teamTpi26GetAny(r, ["Macro Consistency"]));
    const perfRating = teamTpi26ToNum(teamTpi26GetAny(r, ["Performance Rating", "p.challenges.performanceRating", "performanceRating"]));

    const timeDead = teamTpi26ToNum(teamTpi26GetAny(r, ["p.totalTimeSpentDead", "totalTimeSpentDead"]));
    const timeDeadRate = (tpSec > 0) ? (timeDead / tpSec) : 0;

    const deathDist = teamTpi26ToNum(teamTpi26GetAny(r, ["Average Death Distance"]));

    byPlayer.set(name, {
      name,
      games: 1,
      wins: won ? 1 : 0,
      winrate: won ? 100 : 0,
      roleBreakdown: [{ role, count: 1, share: 1 }],

      raw: {
        kda, kp, dmgShare, dpm, goldMin, csMin, firstBloodRate,
        objPart, objKills, plates, objDmg,
        vsMin, wardsMin, wardsKilledMin, denial, enemyJunglePct, pinkEff,
        consistency, momentum, macroCons, perfRating, timeDeadRate, deathDist,
      },

      pillar: { indiv: 0, obj: 0, vision: 0, reli: 0 },
      totalRaw: 0,
      totalShrunk: 0,
      impact: 0,
      delta: null,
      playedLast: true,
      trendOk: false,
      isGuest: false,
    });
  });

  return [...byPlayer.values()];
}

// ============================================================================
// 2) Scoring (supports external normalization context)
// ============================================================================
function teamTpi26ScorePlayers(players, opts = {}) {
  if (!players.length) return { players: [], normCtx: null, minGamesFull: 0 };

  const applyShrink = opts.applyShrink !== false;
  const normCtx = opts.normCtx || teamTpi26BuildNormCtx(players);

  const normMetric = (k, v, invert = false) => {
    const b = normCtx.bounds[k] || { lo: 0, hi: 1 };
    const mm = normCtx.minmax[k] || { min: 0, max: 1 };

    const w = teamTpi26Clamp(teamTpi26Winsorize(v, b.lo, b.hi), b.lo, b.hi);
    const x = mm.max === mm.min ? 0.5 : (w - mm.min) / (mm.max - mm.min);
    const clamped = teamTpi26Clamp(x, 0, 1);
    return invert ? 1 - clamped : clamped;
  };

  players.forEach((p) => {
    const R = p.raw;

    const nKDA = normMetric("kda", R.kda);
    const nKP = normMetric("kp", R.kp);
    const nDmg = normMetric("dmgShare", R.dmgShare);
    const nDPM = normMetric("dpm", R.dpm);
    const nGold = normMetric("goldMin", R.goldMin);
    const nCS = normMetric("csMin", R.csMin);
    const nFB = normMetric("firstBloodRate", R.firstBloodRate);

    p.pillar.indiv =
      TPI26_TEAM.METRIC_WEIGHTS.indiv.kda * nKDA +
      TPI26_TEAM.METRIC_WEIGHTS.indiv.kp * nKP +
      TPI26_TEAM.METRIC_WEIGHTS.indiv.dmgShare * nDmg +
      TPI26_TEAM.METRIC_WEIGHTS.indiv.dpm * nDPM +
      TPI26_TEAM.METRIC_WEIGHTS.indiv.goldMin * nGold +
      TPI26_TEAM.METRIC_WEIGHTS.indiv.csMin * nCS +
      TPI26_TEAM.METRIC_WEIGHTS.indiv.firstBlood * nFB;

    const nObjKills = normMetric("objKills", R.objKills);
    const nObjPart = normMetric("objPart", R.objPart);
    const nPlates = normMetric("plates", R.plates);
    const nObjDmg = normMetric("objDmg", R.objDmg);

    p.pillar.obj =
      TPI26_TEAM.METRIC_WEIGHTS.obj.objKills * nObjKills +
      TPI26_TEAM.METRIC_WEIGHTS.obj.objPart * nObjPart +
      TPI26_TEAM.METRIC_WEIGHTS.obj.plates * nPlates +
      TPI26_TEAM.METRIC_WEIGHTS.obj.objDmg * nObjDmg;

    const nVsMin = normMetric("vsMin", R.vsMin);
    const nWMin = normMetric("wardsMin", R.wardsMin);
    const nWKMin = normMetric("wardsKilledMin", R.wardsKilledMin);
    const nDenial = normMetric("denial", R.denial);
    const nEJ = normMetric("enemyJunglePct", R.enemyJunglePct);
    const nPinkEff = normMetric("pinkEff", R.pinkEff);

    p.pillar.vision =
      TPI26_TEAM.METRIC_WEIGHTS.vision.vsMin * nVsMin +
      TPI26_TEAM.METRIC_WEIGHTS.vision.wardsMin * nWMin +
      TPI26_TEAM.METRIC_WEIGHTS.vision.wardsKilledMin * nWKMin +
      TPI26_TEAM.METRIC_WEIGHTS.vision.denial * nDenial +
      TPI26_TEAM.METRIC_WEIGHTS.vision.enemyJunglePct * nEJ +
      TPI26_TEAM.METRIC_WEIGHTS.vision.pinkEff * nPinkEff;

    const nCons = normMetric("consistency", R.consistency);
    const nMom = normMetric("momentum", R.momentum);
    const nMacro = normMetric("macroCons", R.macroCons);
    const nPR = normMetric("perfRating", R.perfRating);
    const nTimeDeadSafe = normMetric("timeDeadRate", R.timeDeadRate, true);
    const nDeathDistSafe = normMetric("deathDist", R.deathDist, true);

    p.pillar.reli =
      TPI26_TEAM.METRIC_WEIGHTS.reli.consistency * nCons +
      TPI26_TEAM.METRIC_WEIGHTS.reli.momentum * nMom +
      TPI26_TEAM.METRIC_WEIGHTS.reli.macroCons * nMacro +
      TPI26_TEAM.METRIC_WEIGHTS.reli.perfRating * nPR +
      TPI26_TEAM.METRIC_WEIGHTS.reli.timeDeadRateSafe * nTimeDeadSafe +
      TPI26_TEAM.METRIC_WEIGHTS.reli.deathDistSafe * nDeathDistSafe;

    const w = teamTpi26BlendRolePillarWeights(p.roleBreakdown);
    p.totalRaw = w.indiv * p.pillar.indiv + w.obj * p.pillar.obj + w.vision * p.pillar.vision + w.reli * p.pillar.reli;
  });

  let minGamesFull = 0;
  if (applyShrink) {
    const maxGames = Math.max(...players.map((p) => p.games || 1)) || 1;
    minGamesFull = Math.max(TPI26_TEAM.MIN_GAMES_FLOOR, Math.round(maxGames * TPI26_TEAM.SHRINK_FRACTION_OF_MAX));

    const teamMean = players.reduce((s, p) => s + (p.totalRaw || 0.5), 0) / Math.max(1, players.length);

    players.forEach((p) => {
      const g = p.games || 0;
      const sampleFactor = teamTpi26Clamp(g / minGamesFull, 0, 1);
      p.totalShrunk = sampleFactor * p.totalRaw + (1 - sampleFactor) * teamMean;
      p.impact = TPI26_TEAM.BASE + p.totalShrunk * (100 - TPI26_TEAM.BASE);
      p.isGuest = g < minGamesFull;
    });
  } else {
    players.forEach((p) => {
      p.totalShrunk = p.totalRaw;
      p.impact = TPI26_TEAM.BASE + p.totalRaw * (100 - TPI26_TEAM.BASE);
      p.isGuest = false;
    });
  }

  players.sort((a, b) => {
    if ((a.isGuest || false) !== (b.isGuest || false)) return a.isGuest ? 1 : -1;
    return b.impact - a.impact;
  });

  return { players, normCtx, minGamesFull };
}

function teamTpi26BuildNormCtx(players) {
  const metricKeys = Object.keys(players[0].raw || {});
  const metricSeries = {};
  metricKeys.forEach((k) => (metricSeries[k] = players.map((p) => p.raw[k])));

  const bounds = {};
  const minmax = {};
  metricKeys.forEach((k) => {
    bounds[k] = teamTpi26WinsorBounds(metricSeries[k], TPI26_TEAM.WINSOR_P);
    minmax[k] = teamTpi26MinmaxOfSeries(metricSeries[k], bounds[k]);
  });

  return { bounds, minmax };
}

// ============================================================================
// 3) UI — compact table + detail panel + explanation accordion
// ============================================================================
function teamTpi26RenderCard(mount, players, meta = {}) {
  const badge = (score) => (score >= 75 ? "text-emerald-600" : score >= 60 ? "text-yellow-600" : "text-rose-600");

  const trendCell = (p) => {
    if (!p.playedLast) return `<span class="text-slate-300" title="Did not play most recent match.">•</span>`;
    if (!p.trendOk || typeof p.delta !== "number")
      return `<span class="text-slate-400" title="Not enough prior games to compare (no baseline excluding last match).">•</span>`;

    const d = p.delta;
    const up = d >= TPI26_TEAM.TREND_UP;
    const down = d <= TPI26_TEAM.TREND_DOWN;

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
    return `<span class="${base} ${cls}" title="${teamTpi26EscapeHTML(rb.role)} — ${g} games (${pct}%)">
      <span class="font-semibold">${teamTpi26RoleShort(rb.role)}</span>
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
             title="Low sample size — season score shrunk toward team mean.">⭐ low sample</span>`
        : "";

      return `
        <tr data-team-tpi26-player="${teamTpi26EscapeHTML(p.name)}" class="hover:bg-orange-50/40 transition cursor-pointer">
          <td class="px-4 py-2 align-middle">
            <div class="min-w-0">
              <div class="font-medium text-slate-900 truncate">${teamTpi26EscapeHTML(p.name)}</div>
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
            class="px-2.5 py-1 rounded-full text-xs border border-gray-200 hover:border-orange-400 hover:text-orange-500 transition team-tpi26-player-btn"
            data-team-tpi26-player="${teamTpi26EscapeHTML(p.name)}">
            ${teamTpi26EscapeHTML(p.name)}
          </button>
        `
        )
        .join("")}
    </div>
  `;

  const detailBox = `
    <div id="team-tpi26-player-detail"
         class="mt-4 px-4 pb-4 hidden opacity-0 translate-y-2 transition-all duration-300 ease-out"></div>
  `;

  const infoBox = `
    <div class="mt-3 px-4 pb-4 border-t pt-3">
      <button
        id="team-tpi26-toggle-info"
        class="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-orange-600 transition">
        <span>ℹ️ How is Total Player Impact calculated?</span>
        <span id="team-tpi26-info-arrow" class="transition-transform">▼</span>
      </button>

      <div id="team-tpi26-info-content" class="hidden text-sm text-gray-600 mt-2 leading-relaxed">
        <p><strong>Total Player Impact</strong> (40–100) is a relative score <em>inside this dataset</em>. It blends 4 pillars:</p>
        <ul class="list-disc ml-5 mt-1 space-y-1">
          <li><strong>Individual</strong>: KDA, KP, damage share, DPM, gold/min, CS/min, first-blood involvement.</li>
          <li><strong>Objectives</strong>: objective kills, weighted objective participation, plates, objective damage.</li>
          <li><strong>Vision</strong>: vision score/min, wards/min, wards killed/min, denial, enemy-jungle warding, pink efficiency.</li>
          <li><strong>Reliability</strong>: consistency + stability + macro consistency + performance rating, with safer death patterns rewarded.</li>
        </ul>
        <p class="mt-2 text-xs text-gray-500">
          Metrics are winsorized (5–95%), normalized inside the dataset, and low-sample players are shrunk toward the team mean.
          <br/>
          <strong>Trend (Δ)</strong> compares the most recent match to the baseline (excluding that last match).
        </p>
      </div>
    </div>
  `;

  const lastTag = meta.lastMatchId
    ? `<div class="px-4 pt-2 text-[0.7rem] text-slate-500">Trend reference: <span class="font-semibold">${teamTpi26EscapeHTML(meta.lastMatchId)}</span></div>`
    : "";

  mount.innerHTML = `
    <section class="section-wrapper fade-in mb-10">
      <div class="dashboard-card bg-white shadow-sm rounded-2xl border border-gray-100">
        <div class="px-4 pt-4">
          <h2 class="text-[1.1rem] font-semibold text-orange-500 tracking-tight">
            Total Player Impact (Team)
          </h2>
          <p class="text-[0.72rem] text-gray-600 leading-snug">
            4-pillar impact score (Individual · Objectives · Vision · Reliability), role-aware and sample-size stabilized.
          </p>
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
      </div>
    </section>
  `;

  const ctx = teamTpi26BuildContext(players);
  teamTpi26BindInteractions(mount, players, ctx);
}

// ============================================================================
// Detail coaching + interactions
// ============================================================================
function teamTpi26BuildContext(players) {
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

function teamTpi26BuildPlayerDetail(p, ctx) {
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

  add(ratio(p.raw.kp, ctx.meanKP) > 1.12, strengths, "High KP — good syncing with team plays.");
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

function teamTpi26BindInteractions(mount, players, ctx) {
  const detailEl = mount.querySelector("#team-tpi26-player-detail");

  const showPlayer = (name) => {
    if (!detailEl) return;
    const p = players.find((x) => x.name === name);
    if (!p) return;

    detailEl.innerHTML = teamTpi26BuildPlayerDetail(p, ctx);
    detailEl.classList.remove("hidden", "opacity-0", "translate-y-2");
    requestAnimationFrame(() => detailEl.classList.add("opacity-100"));
  };

  mount.querySelectorAll("tr[data-team-tpi26-player]").forEach((row) => {
    row.addEventListener("click", () => showPlayer(row.getAttribute("data-team-tpi26-player")));
  });

  mount.querySelectorAll(".team-tpi26-player-btn").forEach((btn) => {
    btn.addEventListener("click", () => showPlayer(btn.getAttribute("data-team-tpi26-player")));
  });

  const infoBtn = mount.querySelector("#team-tpi26-toggle-info");
  const infoContent = mount.querySelector("#team-tpi26-info-content");
  const arrow = mount.querySelector("#team-tpi26-info-arrow");
  if (infoBtn && infoContent && arrow) {
    infoBtn.addEventListener("click", () => {
      const hidden = infoContent.classList.contains("hidden");
      infoContent.classList.toggle("hidden");
      arrow.style.transform = hidden ? "rotate(180deg)" : "rotate(0deg)";
    });
  }
}

// ============================================================================
// Last match detection (max Date per match)
// ============================================================================
function teamTpi26GetLatestMatchId(rows) {
  const matchMeta = new Map(); // id -> maxDateMs

  rows.forEach((r) => {
    const id = teamTpi26GetMatchIdAny(r);
    if (!id) return;

    const d = teamTpi26ParseDateEUAny(teamTpi26GetAny(r, ["Date", "DATE"]));
    const ms = d ? d.getTime() : 0;

    const prev = matchMeta.get(id);
    if (prev === undefined || ms > prev) matchMeta.set(id, ms);
  });

  if (!matchMeta.size) return "";
  return [...matchMeta.entries()].sort((a, b) => (b[1] - a[1]) || String(b[0]).localeCompare(String(a[0])))[0][0];
}

function teamTpi26ParseDateEUAny(s) {
  const str = String(s || "").trim();
  if (!str) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const d = new Date(str);
    return isFinite(d) ? d : null;
  }

  const m = str.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (!m) return null;

  const dd = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10) - 1;
  let yy = parseInt(m[3], 10);
  const hh = m[4] ? parseInt(m[4], 10) : 0;
  const min = m[5] ? parseInt(m[5], 10) : 0;
  if (yy < 100) yy += 2000;

  const d = new Date(yy, mm, dd, hh, min, 0);
  return isFinite(d) ? d : null;
}

// ============================================================================
// Helpers (namespaced to avoid collisions)
// ============================================================================
function teamTpi26GetAny(row, keys) {
  for (const k of keys) {
    if (k in row && row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== "") return row[k];
  }
  return "";
}

function teamTpi26ToNum(v) {
  if (v === undefined || v === null || v === "") return 0;
  const n = parseFloat(String(v).replace("%", "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function teamTpi26Boolish(v) {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "y";
}

function teamTpi26Clamp(x, a, b) {
  return Math.max(a, Math.min(b, x));
}

function teamTpi26EscapeHTML(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// --- getters matching your CSV conventions ---
function teamTpi26GetPlayerNameAny(r) {
  return String(r["p.riotIdGameName"] || r["Player"] || r["p.summonerName"] || "").trim();
}
function teamTpi26GetMatchIdAny(r) {
  return String(r["Match ID"] || r["MatchID"] || r["Game ID"] || r["Game #"] || r["Date"] || "").trim();
}
function teamTpi26IsWinAny(r) {
  const v = String(r["Result"] || r["p.win"] || "").trim().toLowerCase();
  if (v === "win") return true;
  if (v === "loss") return false;
  return teamTpi26Boolish(r["p.win"]);
}
function teamTpi26GetRoleAny(r) {
  return String(r["ROLE"] || r["Team Position"] || r["p.teamPosition"] || r["p.individualPosition"] || r["p.role"] || "").trim();
}

function teamTpi26NormRole(role) {
  const R = String(role || "").toUpperCase();
  if (R.includes("JUNG")) return "JUNGLE";
  if (R.includes("SUP")) return "SUPPORT";
  if (R.includes("BOT") || R.includes("ADC")) return "ADC";
  if (R.includes("MID")) return "MID";
  if (R.includes("TOP")) return "TOP";
  return "UNKNOWN";
}
function teamTpi26RoleShort(r) {
  const R = String(r || "UNKNOWN").toUpperCase();
  if (R === "JUNGLE") return "JNG";
  if (R === "SUPPORT") return "SUP";
  return R === "UNKNOWN" ? "UNK" : R;
}

function teamTpi26BuildRoleBreakdown(roleFreqMap) {
  const entries = [...(roleFreqMap?.entries?.() || [])]
    .map(([role, count]) => ({ role: String(role || "UNKNOWN"), count: count || 0 }))
    .filter((x) => x.count > 0);

  if (!entries.length) return [{ role: "UNKNOWN", count: 1, share: 1 }];

  const total = entries.reduce((s, x) => s + x.count, 0) || 1;
  entries.sort((a, b) => b.count - a.count);
  return entries.map((x) => ({ ...x, share: x.count / total }));
}

function teamTpi26BlendRolePillarWeights(roleBreakdown) {
  const out = { indiv: 0, obj: 0, vision: 0, reli: 0 };
  const rbs = Array.isArray(roleBreakdown) && roleBreakdown.length ? roleBreakdown : [{ role: "UNKNOWN", share: 1 }];

  rbs.forEach((rb) => {
    const role = teamTpi26NormRole(rb.role);
    const w = TPI26_TEAM.ROLE_PILLAR_WEIGHTS[role] || TPI26_TEAM.ROLE_PILLAR_WEIGHTS.UNKNOWN;
    const s = typeof rb.share === "number" ? rb.share : 0;
    out.indiv += w.indiv * s;
    out.obj += w.obj * s;
    out.vision += w.vision * s;
    out.reli += w.reli * s;
  });

  const sum = out.indiv + out.obj + out.vision + out.reli || 1;
  out.indiv /= sum; out.obj /= sum; out.vision /= sum; out.reli /= sum;
  return out;
}

// --- Winsorization + minmax helpers ---
function teamTpi26Quantile(sortedArr, q) {
  if (!sortedArr.length) return 0;
  const pos = (sortedArr.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sortedArr[base + 1] === undefined) return sortedArr[base];
  return sortedArr[base] + rest * (sortedArr[base + 1] - sortedArr[base]);
}

function teamTpi26WinsorBounds(arr, p) {
  const v = arr.filter((x) => typeof x === "number" && isFinite(x)).slice().sort((a, b) => a - b);
  if (!v.length) return { lo: 0, hi: 1 };
  return { lo: teamTpi26Quantile(v, p), hi: teamTpi26Quantile(v, 1 - p) };
}

function teamTpi26Winsorize(x, lo, hi) {
  if (!isFinite(x)) return lo;
  return teamTpi26Clamp(x, lo, hi);
}

function teamTpi26MinmaxOfSeries(arr, b) {
  const v = arr
    .map((x) => teamTpi26Winsorize(x, b.lo, b.hi))
    .filter((x) => typeof x === "number" && isFinite(x));
  if (!v.length) return { min: 0, max: 1 };
  return { min: Math.min(...v), max: Math.max(...v) };
}

function teamTpi26Fallback(title, msg) {
  return `
    <div class="glass3d mini-card p-4 max-w-[520px]">
      <div class="text-sm font-semibold text-orange-500">${teamTpi26EscapeHTML(title)}</div>
      <div class="text-xs text-slate-500 mt-1">${teamTpi26EscapeHTML(msg)}</div>
    </div>
  `;
}

// ============================================================================
// Champ icons (DDragon)
// ============================================================================
function champToDDragonKey(name) {
  const raw = String(name || "").trim();
  if (!raw) return "";
  const map = {
    "Cho'Gath": "Chogath",
    "Dr. Mundo": "DrMundo",
    "Kha'Zix": "Khazix",
    "Kai'Sa": "Kaisa",
    "LeBlanc": "Leblanc",
    "Vel'Koz": "Velkoz",
    "Wukong": "MonkeyKing",
    "Nunu & Willump": "Nunu",
    "Renata Glasc": "Renata",
    "Bel'Veth": "Belveth",
    "Kog'Maw": "KogMaw",
    "Rek'Sai": "RekSai",
    "Jarvan IV": "JarvanIV",
    "Lee Sin": "LeeSin",
    "Master Yi": "MasterYi",
    "Miss Fortune": "MissFortune",
    "Twisted Fate": "TwistedFate",
    "Xin Zhao": "XinZhao",
  };
  if (map[raw]) return map[raw];
  return raw
    .replaceAll("&", "and")
    .replaceAll("'", "")
    .replaceAll(".", "")
    .replaceAll(" ", "")
    .replaceAll("-", "");
}

function champIconUrl(champ) {
  const key = champToDDragonKey(champ);
  if (!key) return "";
  return `https://ddragon.leagueoflegends.com/cdn/${DD_VERSION}/img/champion/${key}.png`;
}
function mostPlayedChampFromTop(p) {
  // uses buildTeamPlayerMiniCards() output: topChamps = [{champ,count}, ...]
  if (p?.topChamps?.length) return p.topChamps[0].champ;
  return "";
}

function teamPlayerAvatarUrl(p) {
  const champ = mostPlayedChampFromTop(p) || "Malzahar";
  return champIconUrl(champ) || champIconUrl("Malzahar");
}

function champPill(champ, tone = "slate") {
  const url = champIconUrl(champ);
  if (!url) return "";
  const toneMap = {
    orange: "bg-orange-50 border-orange-200",
    slate: "bg-slate-50 border-slate-200",
  };
  return `
    <span class="inline-flex items-center justify-center w-[22px] h-[22px] rounded-lg border ${toneMap[tone] || toneMap.slate} overflow-hidden"
          title="${escapeHTML(champ)}">
      <img src="${url}" alt="${escapeHTML(champ)}" class="w-full h-full object-cover block" loading="lazy" />
    </span>
  `;
}

// ============================================================================
// Parsing helpers + misc utilities
// ============================================================================
function parseDateEU(s) {
  const str = String(s || "").trim();
  if (!str) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const d = new Date(str);
    return isFinite(d) ? d : null;
  }

  const m = str.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (!m) return null;

  const dd = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10) - 1;
  let yy = parseInt(m[3], 10);
  const hh = m[4] ? parseInt(m[4], 10) : 0;
  const min = m[5] ? parseInt(m[5], 10) : 0;

  if (yy < 100) yy += 2000;
  const d = new Date(yy, mm, dd, hh, min, 0);
  return isFinite(d) ? d : null;
}

function parseTimeMin(row) {
  const t = String(row["TIME"] || row["Game Time"] || "").trim();
  if (!t) return NaN;
  if (t.includes(":")) {
    const [m, s] = t.split(":").map((z) => +z || 0);
    return m + s / 60;
  }
  const n = parseFloat(t.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

function getAny(row, keys) {
  for (const k of keys) {
    if (k in row && row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== "") return row[k];
  }
  return "";
}

function toNum(v) {
  if (v === undefined || v === null || v === "") return 0;
  const n = parseFloat(String(v).replace("%", "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function boolish(v) {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "y";
}

function isFiniteNum(x) {
  return typeof x === "number" && isFinite(x);
}

function avg(arr) {
  if (!arr || !arr.length) return NaN;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function escapeHTML(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeMount(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

function fallbackCard(title, msg) {
  return `
    <div class="glass3d mini-card p-4 max-w-[520px]">
      <div class="text-sm font-semibold text-orange-500">${escapeHTML(title)}</div>
      <div class="text-xs text-slate-500 mt-1">${escapeHTML(msg)}</div>
    </div>
  `;
}

function fallbackSection(title, msg) {
  return `
    <section class="section-wrapper fade-in mb-10">
      <div class="dashboard-card bg-white shadow-sm rounded-2xl border border-gray-100 p-4">
        <div class="text-sm font-semibold text-orange-500">${escapeHTML(title)}</div>
        <div class="text-xs text-slate-500 mt-1">${escapeHTML(msg)}</div>
      </div>
    </section>
  `;
}

// ============================================================================
// Column getters (Team CSV)
/// ============================================================================
function getPlayerNameAny(r) {
  return String(r["p.riotIdGameName"] || r["Player"] || r["p.summonerName"] || "").trim();
}

function getChampionAny(r) {
  return String(r["Champion"] || r["p.championName"] || "").trim();
}

function getMatchIdAny(r) {
  return String(r["Match ID"] || r["MatchID"] || r["Game ID"] || r["Game #"] || r["Date"] || "").trim();
}

function isWinAny(r) {
  const v = String(r["Result"] || r["p.win"] || "").trim().toLowerCase();
  if (v === "win") return true;
  if (v === "loss") return false;
  return boolish(r["p.win"]);
}

function getRoleAny(r) {
  return String(r["ROLE"] || r["Team Position"] || r["p.teamPosition"] || r["p.individualPosition"] || r["p.role"] || "").trim();
}

function normRole(role) {
  const R = String(role || "").toUpperCase();
  if (R.includes("JUNG")) return "JUNGLE";
  if (R.includes("SUP")) return "SUPPORT";
  if (R.includes("BOT") || R.includes("ADC")) return "ADC";
  if (R.includes("MID")) return "MID";
  if (R.includes("TOP")) return "TOP";
  return "UNKNOWN";
}

// ============================================================================
// 🧩 TEAM SYNERGY & IDENTITY — Season 26 (Team / 5-stack) — v1.1
// - Uses FULL 5-stack filtered rows you already computed in init()
// - NO TABS (always Season view)
// - Top 3 mini cards use noise 003.png
// - Bottom boxes use pseudo-random noise tiles (stable hashing)
// - Core Identity slots: HIDE champ until pilot has >= 25 role games
//
// Public entry for your Team page render call:
//   renderTeamSynergyLite26(filtered);
// ============================================================================
function renderTeamSynergyLite26(rows) {
  // rows is already: date scoped + roster-only + full 5-stack matches
  renderTeamSynergy26(rows, null, {
    mountId: TEAM_SYNERGY_ID,
    ddVersion: DD_VERSION,
    unlockRoleGames: 25,
  });
}

// ============================================================================
// Base renderer (adapted from your provided code)
// ============================================================================
function renderTeamSynergy26(data, timelineData, opts = {}) {
  const mountId = opts.mountId || "team-synergy";
  const container = document.getElementById(mountId);
  if (!container) return;

  if (!Array.isArray(data) || !data.length) {
    container.innerHTML = fallbackSection("Team Synergy & Identity", "No full 5-stack games found yet.");
    return;
  }

  const DD_VERSION_LOCAL = opts.ddVersion || "16.1.1";
  const UNLOCK_ROLE_GAMES = Number.isFinite(opts.unlockRoleGames) ? opts.unlockRoleGames : 25;

  // -----------------------------
  // Helpers (local)
  // -----------------------------
  const getAnyLocal = (row, keys) => {
    for (const k of keys) {
      if (k in row && row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== "") return row[k];
    }
    return "";
  };

  const toNumLocal = (v) => {
    if (v === undefined || v === null || v === "") return 0;
    const n = parseFloat(String(v).replace("%", "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  };

  const escapeHTMLLocal = (s) =>
    String(s || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  const canonRole = (raw) => {
    const r = String(raw || "").trim().toUpperCase();
    if (!r) return "";
    if (["TOP", "TOPLANE"].includes(r)) return "TOP";
    if (["JUNGLE", "JG"].includes(r)) return "JUNGLE";
    if (["MIDDLE", "MID"].includes(r)) return "MID";
    if (["BOTTOM", "BOT", "ADC"].includes(r)) return "BOTTOM";
    if (["SUPPORT", "SUP", "UTILITY"].includes(r)) return "SUPPORT";
    return r;
  };

  const roleShort = (r) => {
    const R = canonRole(r);
    if (R === "BOTTOM") return "BOT";
    if (R === "JUNGLE") return "JNG";
    return R || "UNK";
  };

  const isWin = (res) => String(res || "").trim().toLowerCase() === "win";

  const getPlayer = (r) => String(getAnyLocal(r, ["Player", "p.riotIdGameName", "p.summonerName"])).trim();
  const getChampion = (r) => String(getAnyLocal(r, ["Champion", "CHAMPION", "p.championName"])).trim();
  const getRole = (r) => canonRole(getAnyLocal(r, ["ROLE", "Role", "Team Position", "p.teamPosition", "p.individualPosition"]));
  const getGameId = (r) => String(getAnyLocal(r, ["Match ID", "MatchID", "Game ID", "Game #", "Date"])).trim();

  const normSeason = (v) => String(v ?? "").trim();

  const chip = (text, tone = "slate") => {
    const base = "inline-flex items-center px-2 py-0.5 rounded-full text-[0.65rem] border";
    const toneMap = {
      slate: "bg-white/70 text-slate-700 border-slate-200",
      sky: "bg-sky-50 text-sky-700 border-sky-200",
      emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
      orange: "bg-orange-50 text-orange-700 border-orange-200",
      purple: "bg-purple-50 text-purple-700 border-purple-200",
      rose: "bg-rose-50 text-rose-700 border-rose-200",
      yellow: "bg-yellow-50 text-yellow-800 border-yellow-200",
      indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
    };
    return `<span class="${base} ${toneMap[tone] || toneMap.slate}">${escapeHTMLLocal(text)}</span>`;
  };

  const liftChip = (lift) => {
    const v = Number(lift) || 0;
    const txt = `${v >= 0 ? "+" : ""}${v.toFixed(1)}pp`;
    return chip(txt, v >= 0 ? "emerald" : "rose");
  };

  // ---- noise helpers (uses RESOLVED_NOISE_URLS from your Team script) ----
  const hashStrLocal = (str) => {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    return h;
  };

  const pickNoiseByFile = (fileName) => {
    if (!Array.isArray(RESOLVED_NOISE_URLS) || !RESOLVED_NOISE_URLS.length) return "";
    const hit = RESOLVED_NOISE_URLS.find((u) => String(u).endsWith(`/${fileName}`) || String(u).endsWith(fileName));
    return hit || RESOLVED_NOISE_URLS[0] || "";
  };

  const pickNoiseForKey = (key) => {
    if (!Array.isArray(RESOLVED_NOISE_URLS) || !RESOLVED_NOISE_URLS.length) return "";
    const idx = hashStrLocal(String(key)) % RESOLVED_NOISE_URLS.length;
    return RESOLVED_NOISE_URLS[idx];
  };

  const noiseLayer = (url, opacity = 0.16) => {
    if (!url) return "";
    return `
      <div class="absolute inset-0" style="
        background-image:url('${url}');
        background-size:cover;
        background-position:center;
        opacity:${opacity};
        pointer-events:none;
      "></div>
    `;
  };

  // ---- DDragon icons ----
  const champToDDragonKey = (name) => {
    const raw = String(name || "").trim();
    if (!raw) return "";
    const map = {
      "Cho'Gath": "Chogath",
      "Dr. Mundo": "DrMundo",
      "Kha'Zix": "Khazix",
      "Kai'Sa": "Kaisa",
      "LeBlanc": "Leblanc",
      "Vel'Koz": "Velkoz",
      "Wukong": "MonkeyKing",
      "Nunu & Willump": "Nunu",
      "Renata Glasc": "Renata",
      "Bel'Veth": "Belveth",
      "Kog'Maw": "KogMaw",
      "Rek'Sai": "RekSai",
      "Jarvan IV": "JarvanIV",
      "Lee Sin": "LeeSin",
      "Master Yi": "MasterYi",
      "Miss Fortune": "MissFortune",
      "Twisted Fate": "TwistedFate",
      "Xin Zhao": "XinZhao",
    };
    if (map[raw]) return map[raw];
    return raw
      .replaceAll("&", "and")
      .replaceAll("'", "")
      .replaceAll(".", "")
      .replaceAll(" ", "")
      .replaceAll("-", "");
  };

  const champIconUrl = (champ) => {
    const key = champToDDragonKey(champ);
    if (!key) return "";
    return `https://ddragon.leagueoflegends.com/cdn/${DD_VERSION_LOCAL}/img/champion/${key}.png`;
  };

  const champIcon = (champ, size = 24, extra = "") => {
    const url = champIconUrl(champ);
    if (!url) return "";
    return `
      <img
        src="${url}"
        alt="${escapeHTMLLocal(champ)}"
        width="${size}" height="${size}"
        class="rounded-lg border border-white shadow-sm ${extra}"
        style="object-fit:cover"
        loading="lazy"
      />
    `;
  };

  // -----------------------------
  // Always season view (no tabs)
  // -----------------------------
  const seasons = [...new Set(data.map((r) => normSeason(r["Season"])).filter(Boolean))];
  const currentSeason = seasons.length ? seasons[seasons.length - 1] : null;

  const filteredData = currentSeason ? data.filter((r) => normSeason(r["Season"]) === currentSeason) : data.slice();
  if (!filteredData.length) {
    container.innerHTML = fallbackSection("Team Synergy & Identity", "No rows in current season scope.");
    return;
  }

  // -----------------------------
  // Build games map (match-level)
  // -----------------------------
  const games = {};
  filteredData.forEach((r) => {
    const id = getGameId(r);
    if (!id) return;
    if (!games[id]) {
      games[id] = { id, rows: [], result: isWin(r["Result"]) ? "Win" : "Loss" };
    }
    games[id].rows.push(r);
  });

  const gameList = Object.values(games);
  if (!gameList.length) {
    container.innerHTML = fallbackSection("Team Synergy & Identity", "No matches found.");
    return;
  }

  gameList.forEach((g) => {
    g.players = g.rows
      .map((r) => ({ name: getPlayer(r), role: getRole(r), champ: getChampion(r) }))
      .filter((p) => p.name);
  });

  const totalGames = gameList.length;
  const teamWins = gameList.filter((g) => g.result === "Win").length;
  const teamWR = totalGames ? (teamWins / totalGames) * 100 : 0;

  // -----------------------------
  // Pilot baseline (WR) for lift
  // -----------------------------
  const pilotOverall = {};
  filteredData.forEach((r) => {
    const name = getPlayer(r);
    if (!name) return;
    if (!pilotOverall[name]) pilotOverall[name] = { games: 0, wins: 0 };
    pilotOverall[name].games += 1;
    pilotOverall[name].wins += isWin(r["Result"]) ? 1 : 0;
  });

  const getPilotBaseline = (name) => {
    const p = pilotOverall[name];
    if (!p || !p.games) return { wr: teamWR };
    return { wr: (p.wins / p.games) * 100 };
  };

  // -----------------------------
  // Role games count per pilot (unlock)
  // -----------------------------
  const pilotRoleGames = {};
  filteredData.forEach((r) => {
    const name = getPlayer(r);
    const role = getRole(r);
    if (!name || !role) return;
    pilotRoleGames[name] ??= {};
    pilotRoleGames[name][role] = (pilotRoleGames[name][role] || 0) + 1;
  });

  // -----------------------------
  // 1) Most reliable duo
  // -----------------------------
  const duoStats = {};
  gameList.forEach((g) => {
    const names = g.players.map((p) => p.name).filter(Boolean);
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const a = names[i];
        const b = names[j];
        const key = a < b ? `${a}|${b}` : `${b}|${a}`;
        if (!duoStats[key]) duoStats[key] = { p1: a < b ? a : b, p2: a < b ? b : a, games: 0, wins: 0 };
        duoStats[key].games += 1;
        if (g.result === "Win") duoStats[key].wins += 1;
      }
    }
  });

  const duoArr = Object.values(duoStats)
    .filter((d) => d.games >= 3)
    .map((d) => {
      const wr = (d.wins / d.games) * 100;
      const lift = wr - teamWR;
      const sizeBoost = Math.log10(d.games + 1);
      const score = (wr / 100) * 0.6 + Math.max(0, lift / 30) * 0.25 + sizeBoost * 0.15;
      return { ...d, wr, lift, score };
    })
    .sort((a, b) => b.score - a.score);

  const bestDuo = duoArr[0] || null;

  // -----------------------------
  // 2) Best bot lane champ combo
  // -----------------------------
  const botCombos = {};
  gameList.forEach((g) => {
    const adc = g.players.find((p) => p.role === "BOTTOM");
    const sup = g.players.find((p) => p.role === "SUPPORT");
    if (!adc || !sup || !adc.champ || !sup.champ) return;
    const key = `${adc.champ}|${sup.champ}`;
    if (!botCombos[key]) botCombos[key] = { adc: adc.champ, sup: sup.champ, games: 0, wins: 0 };
    botCombos[key].games += 1;
    if (g.result === "Win") botCombos[key].wins += 1;
  });

  const botArr = Object.values(botCombos)
    .filter((c) => c.games >= 2)
    .map((c) => {
      const wr = (c.wins / c.games) * 100;
      return { ...c, wr, lift: wr - teamWR };
    })
    .sort((a, b) => b.wr - a.wr || b.games - a.games);

  const bestBot = botArr[0] || null;

  // -----------------------------
  // 3) Signature picks per role (Top 5) + Top 3 overall
  // -----------------------------
  const ROLE_ORDER = ["TOP", "JUNGLE", "MID", "BOTTOM", "SUPPORT"];
  const roleLabel = { TOP: "TOP", JUNGLE: "JUNGLE", MID: "MID", BOTTOM: "BOTTOM", SUPPORT: "SUPPORT" };

  const pickStats = {};
  filteredData.forEach((r) => {
    const pilot = getPlayer(r);
    const role = getRole(r);
    const champ = getChampion(r);
    if (!pilot || !role || !champ) return;

    const key = `${role}|${champ}|${pilot}`;
    if (!pickStats[key]) pickStats[key] = { role, champ, pilot, games: 0, wins: 0 };
    pickStats[key].games += 1;
    pickStats[key].wins += isWin(r["Result"]) ? 1 : 0;
  });

  const rawPicks = Object.values(pickStats).map((p) => {
    const wr = p.games ? (p.wins / p.games) * 100 : 0;
    const base = getPilotBaseline(p.pilot);
    const wrLift = wr - base.wr;
    const vol = Math.log10(p.games + 1);
    const score = (wr / 100) * (1 + vol) + Math.max(0, wrLift / 25);
    return { ...p, wr, wrLift, score };
  });

  const roleTop5 = {};
  ROLE_ORDER.forEach((role) => {
    roleTop5[role] = rawPicks
      .filter((p) => p.role === role)
      .sort((a, b) => b.score - a.score || b.games - a.games || b.wr - a.wr)
      .slice(0, 5);
  });

  const top3Overall = rawPicks
    .slice()
    .sort((a, b) => b.score - a.score || b.games - a.games || b.wr - a.wr)
    .slice(0, 3);

  // -----------------------------
  // 4) Core Identity Team Comp (HIDE champ until unlocked)
  // -----------------------------
  const coreSlots = ROLE_ORDER.map((role) => {
    const candidate = (roleTop5[role] || [])[0] || null;
    if (!candidate) return { role, unlocked: false, roleGames: 0, candidate: null };

    const roleGames = (pilotRoleGames?.[candidate.pilot]?.[role] || 0);
    const unlocked = roleGames >= UNLOCK_ROLE_GAMES;

    return { role, unlocked, roleGames, candidate };
  });

  // -----------------------------
  // UI pieces
  // -----------------------------
  const topNoiseUrl = pickNoiseByFile("003.png");

  const miniCard = ({ tone = "sky", title, main, sub, chipsHTML, iconHTML }) => {
    const toneMap = {
      sky: { bg: "bg-sky-50", border: "border-sky-100", title: "text-sky-600" },
      emerald: { bg: "bg-emerald-50", border: "border-emerald-100", title: "text-emerald-600" },
      orange: { bg: "bg-orange-50", border: "border-orange-100", title: "text-orange-600" },
    };
    const t = toneMap[tone] || toneMap.sky;

    return `
      <div class="relative p-4 rounded-2xl ${t.bg} border ${t.border} overflow-hidden">
        ${noiseLayer(topNoiseUrl, 0.16)}
        <div class="absolute inset-0" style="background:rgba(255,255,255,0.35); pointer-events:none;"></div>
        ${iconHTML || ""}
        <div class="relative">
          <div class="text-[0.65rem] font-semibold uppercase ${t.title} tracking-wide">${escapeHTMLLocal(title)}</div>
          <div class="mt-1 text-sm font-semibold text-slate-900">${main || ""}</div>
          ${sub ? `<div class="text-[0.7rem] text-slate-600 mt-1">${sub}</div>` : ""}
          ${chipsHTML ? `<div class="mt-3 flex flex-wrap gap-1.5">${chipsHTML}</div>` : ""}
        </div>
      </div>
    `;
  };

  // Blue
  const blueCard = (() => {
    if (!bestDuo) {
      return miniCard({
        tone: "sky",
        title: "Most Reliable Members",
        main: "Not enough repeated duos yet",
        sub: "Play a few more games together — then this will lock onto your core.",
        chipsHTML: chip(`${teamWR.toFixed(1)}% team WR`, "sky"),
      });
    }

    const chipsHTML =
      chip(`${bestDuo.wr.toFixed(1)}% WR`, "sky") +
      chip(`${bestDuo.games} games`, "slate") +
      liftChip(bestDuo.lift) +
      chip(`Team: ${teamWR.toFixed(1)}%`, "slate");

    return miniCard({
      tone: "sky",
      title: "Most Reliable Members",
      main: `${escapeHTMLLocal(bestDuo.p1)} + ${escapeHTMLLocal(bestDuo.p2)}`,
      sub: "When these two queue together, does the winrate spike vs the rest?",
      chipsHTML,
    });
  })();

  // Green
  const greenCard = (() => {
    if (!bestBot) {
      return miniCard({
        tone: "emerald",
        title: "Best Bot Lane Combo",
        main: "No recurring ADC+SUP combo yet",
        sub: "Needs at least 2 games on the same champ pair.",
        chipsHTML: chip(`${teamWR.toFixed(1)}% team WR`, "emerald"),
      });
    }

    const iconHTML = `
      <div class="absolute right-3 top-3 flex -space-x-2">
        ${champIcon(bestBot.adc, 28, "ring-2 ring-white")}
        ${champIcon(bestBot.sup, 28, "ring-2 ring-white")}
      </div>
    `;

    const chipsHTML =
      chip(`${bestBot.wr.toFixed(1)}% WR`, "emerald") +
      chip(`${bestBot.games} games`, "slate") +
      liftChip(bestBot.lift);

    return miniCard({
      tone: "emerald",
      title: "Best Bot Lane Combo",
      main: `${escapeHTMLLocal(bestBot.adc)} + ${escapeHTMLLocal(bestBot.sup)}`,
      sub: "Highest winrate bot lane pair in this season.",
      chipsHTML,
      iconHTML,
    });
  })();

  // Orange
  const orangeCard = (() => {
    if (!top3Overall.length) {
      return miniCard({
        tone: "orange",
        title: "Top Signature Picks",
        main: "No signatures yet",
        sub: "Once picks have enough volume + WR lift, they show up here.",
        chipsHTML: chip(`${teamWR.toFixed(1)}% team WR`, "orange"),
      });
    }

    const icons = top3Overall.map((s) => champIcon(s.champ, 26, "ring-2 ring-white")).join("");
    const iconHTML = `<div class="absolute right-3 top-3 flex -space-x-2">${icons}</div>`;

    const lines = top3Overall
      .map((s) => {
        const base = getPilotBaseline(s.pilot);
        const lift = s.wr - base.wr;
        return `
          <div class="flex items-center justify-between gap-2 text-[0.7rem] mt-1">
            <div class="flex items-center gap-2 min-w-0">
              ${champIcon(s.champ, 18)}
              <div class="truncate">
                <span class="font-semibold text-slate-900">${escapeHTMLLocal(s.champ)}</span>
                <span class="text-slate-500"> ${roleShort(s.role)}</span>
                <span class="text-slate-400"> · ${escapeHTMLLocal(s.pilot)}</span>
              </div>
            </div>
            <div class="shrink-0 flex items-center gap-1.5">
              ${chip(`${s.wr.toFixed(0)}%`, "orange")}
              ${chip(`${s.games}g`, "slate")}
              ${liftChip(lift)}
            </div>
          </div>
        `;
      })
      .join("");

    return `
      <div class="relative p-4 rounded-2xl bg-orange-50 border border-orange-100 overflow-hidden">
        ${noiseLayer(topNoiseUrl, 0.16)}
        <div class="absolute inset-0" style="background:rgba(255,255,255,0.35); pointer-events:none;"></div>
        ${iconHTML}
        <div class="relative">
          <div class="text-[0.65rem] font-semibold uppercase text-orange-600 tracking-wide">Top Signature Picks</div>
          <div class="mt-1 text-sm font-semibold text-slate-900">Best 3 picks this season</div>
          <div class="mt-2">${lines}</div>
          <div class="mt-3 flex flex-wrap gap-1.5">
            ${chip(`${teamWR.toFixed(1)}% team WR`, "slate")}
            ${chip(`${totalGames} games`, "slate")}
          </div>
        </div>
      </div>
    `;
  })();

  // Core identity comp (bottom noise: random per slot)
  const coreCompHTML = `
    <div class="relative mt-4 p-4 rounded-2xl bg-indigo-50 border border-indigo-100 overflow-hidden">
      ${noiseLayer(pickNoiseForKey("core-comp-wrapper"), 0.14)}
      <div class="absolute inset-0" style="background:rgba(255,255,255,0.35); pointer-events:none;"></div>

      <div class="relative">
        <div class="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
          <div class="text-[0.7rem] font-semibold text-indigo-600 uppercase tracking-wide">Core Identity Team Comp</div>
          <div class="text-[0.65rem] text-indigo-400">Slots unlock at ${UNLOCK_ROLE_GAMES}+ role games for the pilot</div>
        </div>

        <div class="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          ${coreSlots
            .map((slot) => {
              const role = slot.role;
              const noise = pickNoiseForKey(`core-slot|${role}`);

              if (!slot.candidate) {
                return `
                  <div class="relative rounded-xl border border-dashed border-indigo-200 bg-white/50 p-3 overflow-hidden">
                    ${noiseLayer(noise, 0.14)}
                    <div class="absolute inset-0" style="background:rgba(255,255,255,0.45); pointer-events:none;"></div>
                    <div class="relative">
                      <div class="text-[0.65rem] font-semibold text-indigo-400 uppercase">${roleLabel[role] || role}</div>
                      <div class="text-[0.7rem] text-slate-400 mt-1">No data yet.</div>
                    </div>
                  </div>
                `;
              }

              if (!slot.unlocked) {
                const remaining = Math.max(0, UNLOCK_ROLE_GAMES - (slot.roleGames || 0));
                return `
                  <div class="relative rounded-xl border border-dashed border-indigo-200 bg-white/50 p-3 overflow-hidden">
                    ${noiseLayer(noise, 0.14)}
                    <div class="absolute inset-0" style="background:rgba(255,255,255,0.45); pointer-events:none;"></div>
                    <div class="relative">
                      <div class="text-[0.65rem] font-semibold text-indigo-400 uppercase">${roleLabel[role] || role}</div>
                      <div class="mt-2 text-[0.8rem] font-semibold text-slate-700">🔒 Locked</div>
                      <div class="mt-1 text-[0.65rem] text-slate-500">
                        Play <span class="font-semibold">${remaining}</span> more ${roleLabel[role]} games to unlock.
                      </div>
                      <div class="mt-2 text-[0.65rem] text-slate-400">
                        Progress: ${slot.roleGames || 0}/${UNLOCK_ROLE_GAMES}
                      </div>
                    </div>
                  </div>
                `;
              }

              const s = slot.candidate;
              const base = getPilotBaseline(s.pilot);
              const lift = s.wr - base.wr;

              return `
                <div class="relative rounded-xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06)] p-3 border border-white/60 overflow-hidden">
                  ${noiseLayer(noise, 0.14)}
                  <div class="absolute inset-0" style="background:rgba(255,255,255,0.35); pointer-events:none;"></div>
                  <div class="relative">
                    <div class="text-[0.65rem] font-semibold text-indigo-500 uppercase">${roleLabel[role] || role}</div>
                    <div class="mt-2 flex items-center gap-2">
                      ${champIcon(s.champ, 26)}
                      <div class="min-w-0">
                        <div class="text-[0.8rem] font-semibold text-slate-900 truncate">${escapeHTMLLocal(s.champ)}</div>
                        <div class="text-[0.65rem] text-slate-600 truncate">${escapeHTMLLocal(s.pilot)}</div>
                      </div>
                    </div>
                    <div class="mt-2 flex flex-wrap gap-1.5">
                      ${chip(`${s.wr.toFixed(1)}% WR`, "purple")}
                      ${chip(`${s.games}g on champ`, "slate")}
                      ${liftChip(lift)}
                    </div>
                  </div>
                </div>
              `;
            })
            .join("")}
        </div>
      </div>
    </div>
  `;

  // Signature picks by role (bottom noise: random per role card)
  const signaturesHTML = `
    <div class="mt-4">
      <div class="flex items-baseline justify-between gap-2">
        <div class="text-sm font-semibold text-slate-900">Signature Picks by Role</div>
        <div class="text-[0.7rem] text-slate-500">Top 5 champs per lane · with pilot + WR lift</div>
      </div>

      <div class="mt-3 grid gap-3 lg:grid-cols-2">
        ${ROLE_ORDER.map((role) => {
          const picks = roleTop5[role] || [];
          const noise = pickNoiseForKey(`sig-role|${role}`);

          const tone =
            role === "TOP" ? "bg-orange-50/50 border-orange-100" :
            role === "JUNGLE" ? "bg-emerald-50/50 border-emerald-100" :
            role === "MID" ? "bg-sky-50/50 border-sky-100" :
            role === "BOTTOM" ? "bg-indigo-50/50 border-indigo-100" :
            "bg-purple-50/50 border-purple-100";

          if (!picks.length) {
            return `
              <div class="relative p-4 rounded-2xl border ${tone} overflow-hidden">
                ${noiseLayer(noise, 0.14)}
                <div class="absolute inset-0" style="background:rgba(255,255,255,0.40); pointer-events:none;"></div>
                <div class="relative">
                  <div class="text-[0.7rem] font-semibold text-slate-800">${roleLabel[role] || role}</div>
                  <div class="mt-2 text-[0.7rem] text-slate-500">No signature candidates yet for this role.</div>
                </div>
              </div>
            `;
          }

          const rowsHTML = picks
            .map((s, idx) => {
              const base = getPilotBaseline(s.pilot);
              const lift = s.wr - base.wr;
              return `
                <div class="flex items-center justify-between gap-3 py-2 ${idx ? "border-t border-slate-200/60" : ""}">
                  <div class="flex items-center gap-2 min-w-0">
                    ${champIcon(s.champ, 22)}
                    <div class="min-w-0">
                      <div class="text-[0.8rem] font-semibold text-slate-900 truncate">${escapeHTMLLocal(s.champ)}</div>
                      <div class="text-[0.65rem] text-slate-500 truncate">${escapeHTMLLocal(s.pilot)}</div>
                    </div>
                  </div>
                  <div class="shrink-0 flex items-center gap-1.5">
                    ${chip(`${s.wr.toFixed(0)}%`, "slate")}
                    ${chip(`${s.games}g`, "slate")}
                    ${liftChip(lift)}
                  </div>
                </div>
              `;
            })
            .join("");

          return `
            <div class="relative p-4 rounded-2xl border ${tone} overflow-hidden">
              ${noiseLayer(noise, 0.14)}
              <div class="absolute inset-0" style="background:rgba(255,255,255,0.40); pointer-events:none;"></div>
              <div class="relative">
                <div class="flex items-baseline justify-between">
                  <div class="text-[0.7rem] font-semibold text-slate-800">${roleLabel[role] || role}</div>
                  <div class="text-[0.65rem] text-slate-500">Top 5</div>
                </div>
                <div class="mt-2">${rowsHTML}</div>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;

  // Render
  container.innerHTML = `
    <section class="section-wrapper fade-in mb-10">
      <div class="dashboard-card bg-white shadow-sm rounded-2xl border border-gray-100">
        <div class="mb-1">
          <h2 class="text-[1.1rem] font-semibold text-sky-500 tracking-tight">Team Synergy & Identity</h2>
          <p class="text-[0.7rem] text-gray-600">
            Finds your most reliable core, bot lane best pair, and signature picks per role.
          </p>
        </div>

        <div class="grid md:grid-cols-3 gap-3 mt-3">
          ${blueCard}
          ${greenCard}
          ${orangeCard}
        </div>

        ${coreCompHTML}
        ${signaturesHTML}
      </div>
    </section>
  `;

  console.log("🧩 Team Synergy S26 v1.1 (Team/5-stack)", {
    season: currentSeason,
    totalGames,
    teamWR: teamWR.toFixed(1),
    bestDuo,
    bestBot,
    top3Overall,
    coreSlots,
  });
}

// ============================================================================
// 🧾 MATCH LIST (Last 10) — Team / 5-stack
// + Muted roster names subline
// + Champ icon strip (DDragon) — 5 champs (role-ordered)
// + Split Mini Cards (Split 1–3)
// + Split fallback: blank split -> Split 1
// ============================================================================
function renderTeamMatchList26(rows, opts = {}) {
  const roster = Array.isArray(opts.roster) ? opts.roster : (typeof ROSTER !== "undefined" ? ROSTER : []);
  const mount =
    document.getElementById(opts.mountId || TEAM_MATCHLIST_ID) ||
    document.getElementById("match-list") ||
    document.getElementById("matchlist") ||
    document.getElementById("team-matchlist") ||
    null;

  if (!mount) {
    console.warn(`[TeamMatchList26] No mount found. Add <div id="${TEAM_MATCHLIST_ID}"></div>.`);
    return;
  }

  if (!rows || !rows.length) {
    mount.innerHTML = fallbackSection("Match List (Last 10)", "No matches yet.");
    return;
  }

  // --- local safe getter (don’t depend on global getAny) ---
  const getAnyLocal = (row, keys) => {
    for (const k of keys) {
      if (k in row && row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== "") return row[k];
    }
    return "";
  };

  const DDV = opts.ddVersion || (typeof DD_VERSION !== "undefined" ? DD_VERSION : "16.1.1");

  // --- DDragon champ icons ---
  const champToDDragonKey = (name) => {
    const raw = String(name || "").trim();
    if (!raw) return "";

    const map = {
      "Cho'Gath": "Chogath",
      "Dr. Mundo": "DrMundo",
      "Kha'Zix": "Khazix",
      "Kai'Sa": "Kaisa",
      "LeBlanc": "Leblanc",
      "Vel'Koz": "Velkoz",
      "Wukong": "MonkeyKing",
      "Nunu & Willump": "Nunu",
      "Renata Glasc": "Renata",
      "Bel'Veth": "Belveth",
      "Kog'Maw": "KogMaw",
      "Rek'Sai": "RekSai",
      "Jarvan IV": "JarvanIV",
      "Lee Sin": "LeeSin",
      "Master Yi": "MasterYi",
      "Miss Fortune": "MissFortune",
      "Twisted Fate": "TwistedFate",
      "Xin Zhao": "XinZhao",
    };
    if (map[raw]) return map[raw];

    return raw
      .replaceAll("&", "and")
      .replaceAll("'", "")
      .replaceAll(".", "")
      .replaceAll(" ", "")
      .replaceAll("-", "");
  };

  const champIconUrl = (champ) => {
    const key = champToDDragonKey(champ);
    if (!key) return "";
    return `https://ddragon.leagueoflegends.com/cdn/${DDV}/img/champion/${key}.png`;
  };

  const champPill = (champ, tone = "orange") => {
    const url = champIconUrl(champ);
    if (!url) return "";
    const cls =
      tone === "orange"
        ? "bg-orange-50 border-orange-200"
        : tone === "slate"
        ? "bg-slate-50 border-slate-200"
        : "bg-slate-50 border-slate-200";
    return `
      <span class="inline-flex items-center justify-center w-[22px] h-[22px] rounded-lg border ${cls} overflow-hidden"
            title="${escapeHTML(champ)}">
        <img src="${url}" alt="${escapeHTML(champ)}" class="w-full h-full object-cover block" loading="lazy" />
      </span>
    `;
  };

  const toInt26Team = (v) => {
    const n = parseInt(String(v ?? "").trim(), 10);
    return Number.isFinite(n) ? n : null;
  };

  const getSideAny = (r) => {
    // teamId: 100 = Blue, 200 = Red (common Riot export)
    const tid = Number(toNum(getAnyLocal(r, ["p.teamId", "teamId", "TeamId", "TEAM_ID"])));
    if (tid === 100) return "BLUE";
    if (tid === 200) return "RED";

    const s = String(getAnyLocal(r, ["Side", "TEAM", "Team", "TEAM_SIDE"])).trim().toLowerCase();
    if (s.includes("blue")) return "BLUE";
    if (s.includes("red")) return "RED";
    return "";
  };

  const winChip = (match) => {
    const base = "inline-flex items-center px-2 py-0.5 rounded-full text-[0.65rem] border";
    if (match.win && match.side === "BLUE") return `<span class="${base} bg-sky-50 text-sky-700 border-sky-200">WIN</span>`;
    if (match.win && match.side === "RED") return `<span class="${base} bg-rose-50 text-rose-700 border-rose-200">WIN</span>`;
    if (match.win) return `<span class="${base} bg-emerald-50 text-emerald-700 border-emerald-200">WIN</span>`;
    return `<span class="${base} bg-rose-50 text-rose-700 border-rose-200">LOSS</span>`;
  };

  const stackChip5 = () => {
    return `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[0.65rem] border bg-orange-50 text-orange-700 border-orange-200">5-stack · 5</span>`;
  };

  // ---- group rows into matches (already 5-stack filtered, but we stay defensive) ----
  const matchMap = new Map(); // id -> match aggregate

  for (const r of rows) {
    const id = getMatchIdAny(r);
    if (!id) continue;

    const d = parseDateEU(getAnyLocal(r, ["Date", "DATE"]));
    const w = isWinAny(r);
    const tMin = parseTimeMin(r);
    const player = String(getPlayerNameAny(r) || "").trim();
    const champ = String(getChampionAny(r) || "").trim();
    const role = normRole(getRoleAny(r));
    const side = getSideAny(r);

    if (!matchMap.has(id)) {
      matchMap.set(id, {
        id,
        date: d,
        win: w,
        side: side || "",
        timeMin: Number.isFinite(tMin) ? tMin : NaN,
        // sums across the 5 roster players
        k: 0,
        d: 0,
        a: 0,
        // roster list + champs (role-ordered)
        playerSet: new Set(),
        champSet: new Set(),
        players: [], // {name, champ, role}
        // split fallback
        split: toInt26Team(getAnyLocal(r, ["Split"])) ?? 1,
      });
    }

    const m = matchMap.get(id);

    // date: keep latest
    if (!m.date && d) m.date = d;
    if (m.date && d && d.getTime() > m.date.getTime()) m.date = d;

    // win OR
    m.win = m.win || w;

    // side: take first known
    if (!m.side && side) m.side = side;

    // time
    if (!Number.isFinite(m.timeMin) && Number.isFinite(tMin)) m.timeMin = tMin;

    // split fallback
    const s = toInt26Team(getAnyLocal(r, ["Split"]));
    if (s) m.split = s;

    if (player) {
      if (!m.playerSet.has(player)) m.playerSet.add(player);
      if (champ) m.champSet.add(champ);

      // store player line with role for ordering
      m.players.push({ name: player, champ, role });

      // combat totals
      m.k += toNum(getAnyLocal(r, ["Kills", "p.kills", "kills"]));
      m.d += toNum(getAnyLocal(r, ["Deaths", "p.deaths", "deaths"]));
      m.a += toNum(getAnyLocal(r, ["Assists", "p.assists", "assists"]));
    }
  }

  // sort comp by role order (use your existing roleOrder if present)
  const roleOrderLocal = (r) => {
    if (typeof roleOrder === "function") return roleOrder(r);
    const R = String(r || "").toUpperCase();
    if (R.includes("TOP")) return 1;
    if (R.includes("JUNG")) return 2;
    if (R.includes("MID")) return 3;
    if (R.includes("ADC") || R.includes("BOT") || R.includes("BOTTOM")) return 4;
    if (R.includes("SUP")) return 5;
    return 9;
  };

  const allMatches = [...matchMap.values()]
    .filter((m) => m.playerSet.size > 0)
    .sort((a, b) => {
      const ta = a.date ? a.date.getTime() : 0;
      const tb = b.date ? b.date.getTime() : 0;
      return ta - tb;
    });

  const last10Chrono = allMatches.slice(-10);         // oldest -> newest
  const last10Table = last10Chrono.slice().reverse(); // newest -> oldest

  // dots (chrono order)
  const dots = [];
  for (let i = 0; i < 10; i++) {
    const m = last10Chrono[i];
    if (!m) dots.push("empty");
    else dots.push(m.win ? "win" : "loss");
  }
  const latestIdx = last10Chrono.length ? last10Chrono.length - 1 : -1;

  const dotsHTML = dots
    .map((state, idx) => {
      const cls = state === "win" ? "win" : state === "loss" ? "loss" : "";
      const latest = idx === latestIdx ? "latest" : "";
      return `<span class="s26-dot ${cls} ${latest}"></span>`;
    })
    .join("");

  // ---- split mini cards (1–3) ----
  const splitCardsHTML = renderTeamSplitMiniCards26(rows, roster);

  // ---- table rows ----
  const rowHTML = last10Table
    .map((m) => {
      const minutes = Number.isFinite(m.timeMin) ? `${m.timeMin.toFixed(1)}m` : "—";
      const kda = (m.k + m.a) / Math.max(1, m.d);
      const kdaText = Number.isFinite(kda) ? kda.toFixed(2) : "—";

      const dateText = m.date
        ? m.date.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit" })
        : "—";

      // muted names (always roster players, but keep compact)
      const names = [...m.playerSet].slice(0, 5);
      const namesLine = names.join(" · ");

      // champ strip (role-ordered if we can)
      const champsOrdered = m.players
        .slice()
        .sort((a, b) => roleOrderLocal(a.role) - roleOrderLocal(b.role))
        .map((p) => p.champ)
        .filter(Boolean)
        .slice(0, 5);

      const champStrip = champsOrdered.length
        ? champsOrdered.map((c) => champPill(c, "orange")).join("")
        : `<span class="text-[0.7rem] text-slate-400">No champ data</span>`;

      const champStripHTML = `<div class="mt-1 flex items-center gap-1.5">${champStrip}</div>`;

      return `
        <tr class="border-t border-slate-100 hover:bg-orange-50/30 transition">
          <td class="px-4 py-2 align-top">
            <div class="text-sm text-slate-800 whitespace-nowrap">${dateText}</div>
            <div class="text-[0.7rem] text-slate-400 mt-0.5">${escapeHTML(namesLine)}</div>
          </td>

          <td class="px-4 py-2 align-top">
            ${stackChip5()}
            ${champStripHTML}
          </td>

          <td class="px-4 py-2 align-top">${winChip(m)}</td>
          <td class="px-4 py-2 text-right align-top text-slate-700 text-sm whitespace-nowrap">${minutes}</td>
          <td class="px-4 py-2 text-right align-top text-slate-900 font-semibold text-sm whitespace-nowrap">${kdaText}</td>
        </tr>
      `;
    })
    .join("");

  const last10Count = last10Chrono.length;

  mount.innerHTML = `
    <section class="section-wrapper fade-in mb-10">
      <div class="dashboard-card bg-white shadow-sm rounded-2xl border border-gray-100 overflow-hidden"
           style="--dot-win:${DOT_COLORS?.win || "#22c55e"}; --dot-loss:${DOT_COLORS?.loss || "#fb7185"}; --dot-empty:${DOT_COLORS?.empty || "#cbd5e1"}; --dot-ring:${DOT_COLORS?.ring || "#f97316"};">
        <div class="px-4 pt-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h2 class="text-[1.1rem] font-semibold text-orange-500 tracking-tight">Match List (Last 10)</h2>
              <p class="text-[0.72rem] text-gray-600 leading-snug">
                Latest ${last10Count}/10 full 5-stack games
              </p>
            </div>

            <div class="flex items-center gap-1.5 mt-1" title="Last 10 results (ring = most recent)">
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

        <div class="px-4 pb-4">
          <div class="text-sm font-semibold text-slate-900 mb-2">Split Mini</div>
          ${splitCardsHTML}
        </div>
      </div>
    </section>
  `;
}

// --- Split Mini Cards (Split 1–3) ---
// Shows: (A) unique match count per split, (B) per-roster games in that split
function renderTeamSplitMiniCards26(rows, roster) {
  const splits = [1, 2, 3];

  const bySplit = {};
  splits.forEach((s) => {
    bySplit[s] = { matchSet: new Set(), playerMap: new Map() };
  });

  const toInt26Team = (v) => {
    const n = parseInt(String(v ?? "").trim(), 10);
    return Number.isFinite(n) ? n : null;
  };

  const getAnyLocal = (row, keys) => {
    for (const k of keys) {
      if (k in row && row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== "") return row[k];
    }
    return "";
  };

  rows.forEach((r) => {
    const player = String(getPlayerNameAny(r) || "").trim();
    if (!player || (roster.length && !roster.includes(player))) return;

    const id = getMatchIdAny(r);
    if (!id) return;

    const s = toInt26Team(getAnyLocal(r, ["Split"])) ?? 1; // default Split 1
    if (!bySplit[s]) return;

    bySplit[s].matchSet.add(id);

    if (!bySplit[s].playerMap.has(player)) bySplit[s].playerMap.set(player, new Set());
    bySplit[s].playerMap.get(player).add(id);
  });

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
                <div class="text-[0.75rem] text-slate-800 truncate">${escapeHTML(x.player)}</div>
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

(() => {

// ============================================================================
// 🧭 LANE DYNAMICS & PLAYMAKERS — Season 26 (v3.1)
// - Season window ONLY
// - Early/Mid/Late phase buttons
// - Uses Season 26 timeline headers exactly
// - Card unlock gating (set to 25 later; keep 0 for now)
// ============================================================================

let lanePhase26 = "early"; // "early" | "mid" | "late"

// 🔒 Unlock gating (set to 25 when live)
const LANE_DYNAMICS_UNLOCK_GAMES = 0; // <-- change to 25 later

// Timeline tab (gid=1060990396) — CSV export
const SEASON26_TIMELINE_CSV =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vSbxcPDjBBWSe4jIwXuQe-_o5C1RGg067CxU4g_j1yqG8D3DAj8BFqvwKuLopePRuUWv7qE5bmEPuLZ/pub?gid=1060990396&single=true&output=csv";

const LANE_DYNAMICS_CONTAINER_ID = "lane-dynamics";

// Optional caches so phase buttons rerender without refetch
let cachedLaneSeasonRows26 = null;
let cachedLaneTimelineRows26 = null;

// ---------- helpers ----------
function ldGetAny(row, keys) {
  for (const k of keys) {
    if (k in row && row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== "") return row[k];
  }
  return "";
}
function ldNum(v) {
  if (v === null || v === undefined || v === "") return 0;
  const n = parseFloat(String(v).replace("%", "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}
function ldBool(v) {
  const s = String(v || "").trim().toUpperCase();
  return s === "1" || s === "TRUE" || s === "YES";
}
function ldEscapeHTML(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function ldGetMatchId(r) {
  return String(ldGetAny(r, ["Match ID", "MatchID", "Game ID", "Game #", "Date"])).trim();
}
function ldGetPlayer(r) {
  return String(ldGetAny(r, ["Player", "p.riotIdGameName", "p.summonerName", "Summoner"])).trim();
}

function normLaneRoleLD26(r) {
  const raw = String(ldGetAny(r, ["Role", "ROLE", "Team Position", "p.teamPosition", "p.individualPosition"]) || "")
    .toUpperCase()
    .trim();
  if (!raw) return "";
  if (raw.includes("TOP")) return "TOP";
  if (raw.includes("JUNG")) return "JUNGLE";
  if (raw.includes("MID") || raw.includes("MIDDLE")) return "MIDDLE";
  if (raw.includes("BOT") || raw.includes("BOTTOM") || raw.includes("ADC")) return "BOTTOM";
  if (raw.includes("SUP") || raw.includes("UTIL")) return "SUPPORT";
  return raw;
}

// Cheap "home lane" for roam detection
function laneHomeZoneLD26(role, teamId) {
  if (role === "TOP") return teamId === 100 ? "Top Lane" : "Bot Lane";
  if (role === "BOTTOM") return teamId === 100 ? "Bot Lane" : "Top Lane";
  if (role === "MIDDLE") return "Mid Lane";
  if (role === "SUPPORT") return "Bot Lane";
  if (role === "JUNGLE") return "Jungle";
  return "";
}

// --- Phase helper: dynamic early/mid/late per match ---
function buildMatchLengthsLD26(rows) {
  const len = {};
  rows.forEach((r) => {
    const id = ldGetMatchId(r);
    if (!id) return;
    const m = ldNum(ldGetAny(r, ["Minute"]));
    if (!len[id] || m > len[id]) len[id] = m;
  });
  return len;
}

function getPhaseForMinuteLD26(matchId, minute, matchLengths) {
  const total = matchLengths[matchId] || 30;
  if (minute < 3) return null;

  const earlyEnd = Math.max(8, Math.min(14, Math.round(total * 0.25)));
  const midEnd = Math.max(earlyEnd + 5, Math.round(total * 0.6));

  if (minute <= earlyEnd) return "early";
  if (minute <= midEnd) return "mid";
  return "late";
}

// ---------- Analyst tags ----------
function getProfileTooltipLD26(tag) {
  switch (tag) {
    case "Lane Rock":
      return "Consistently wins or holds lane with strong fundamentals in this phase.";
    case "Resource Carry":
      return "Performs best when given resources; converts help into reliable leads.";
    case "Playmaker":
      return "Moves first while stable; drives proactive plays and roams.";
    case "Pressure Sink":
      return "Often behind despite ally presence; beware of over-investing.";
    case "High-Risk Roamer":
      return "Roams aggressively from even/behind states; can swing games both ways.";
    case "Guest (Small Sample)":
      return "Very small sample in this phase; interpret trends cautiously.";
    case "Stable":
      return "Solid, unspectacular lane outcomes; rarely a liability.";
    case "Lane Rock Duo":
      return "Botlane duo with strong, repeatable lane control and reliability.";
    case "Playmaker Duo":
      return "Botlane duo that frequently creates plays and roams effectively.";
    case "Pressure Sink Duo":
      return "Botlane duo that struggles even with attention; monitor drafts.";
    case "Stable Duo":
      return "Botlane duo that is generally steady, average outcomes.";
    default:
      return "";
  }
}

function getInvestmentTagLD26(p) {
  const lc = p.laneControl;
  const rel = p.reliability;
  const self = p.selfLead || 0;
  const help = p.helpedLead || 0;
  const sink = p.pressureSink || 0;

  const hasLeadSignal = self + help > 0;

  if (lanePhase26 === "late") {
    if (help >= 35 && (lc <= 0 || rel <= 50 || sink >= 10)) return "Resource Trap";
    if (self >= 85 && rel >= 65 && lc >= 0 && sink < 8) return "Island Safe";
    return "";
  }

  if (help >= 35 && (lc <= 0 || rel <= 50 || sink >= 10)) return "Resource Trap";
  if (hasLeadSignal && help >= 40 && lc >= 5 && rel >= 55) return "Invest Pays Off";
  if (self >= 80 && rel >= 60 && lc >= 0 && sink < 8) return "Island Safe";
  if (self >= 65 && rel >= 55 && lc > -3 && sink < 10) return "Low-Maintenance";
  if (self >= 50 && self <= 80 && help >= 20 && help <= 40 && lc >= 0 && rel >= 55) return "Setup Lane";
  if (self >= 80 && rel < 55) return "Volatile Duelist";
  if (self >= 40 && self <= 65 && rel < 55 && help >= 20 && lc > -8) return "Needs Cover";

  return "";
}

function getInvestmentTooltipLD26(tag) {
  switch (tag) {
    case "Island Safe":
      return "Wins or holds lane mostly alone. You can path away without griefing them.";
    case "Low-Maintenance":
      return "Usually stable with minimal attention. Cover dives and resets; no need to force plays.";
    case "Invest Pays Off":
      return "When you play for this lane, it reliably converts pressure into leads.";
    case "Setup Lane":
      return "Strong for coordinated plays (2v2+1). Use for dives, prio, and planned setups.";
    case "Volatile Duelist":
      return "High-risk island. Can solo-win or solo-lose; draft and cover accordingly.";
    case "Needs Cover":
      return "Fully ignoring this lane is risky. Targeted visits help it stabilize.";
    case "Resource Trap":
      return "Heavy attention rarely sticks as a lead. Avoid defaulting to play through this lane.";
    default:
      return "";
  }
}

// ============================================================================
// MAIN API
// - seasonRows: your season table rows (optional; used to filter match IDs to season set)
// - timelineRows: minute-by-minute rows from gid=1060990396
// ============================================================================








function renderLaneDynamics26(seasonRows, timelineRows, opts = {}) {
  const mountId = opts.mountId || LANE_DYNAMICS_CONTAINER_ID;
  const container = document.getElementById(mountId);
  if (!container) return;

  const roster = Array.isArray(opts.roster) ? opts.roster : (typeof ROSTER !== "undefined" ? ROSTER : []);
  const allTimeline = Array.isArray(timelineRows) ? timelineRows : [];

  if (!allTimeline.length) {
    container.innerHTML = `
      <section class="section-wrapper fade-in mb-10">
        <div class="dashboard-card bg-white shadow-sm rounded-2xl border border-gray-100 p-4">
          <h2 class="text-[1.05rem] font-semibold text-sky-500 mb-1">Lane Dynamics & Playmakers</h2>
          <p class="text-sm text-gray-500">No timeline data loaded yet.</p>
        </div>
      </section>`;
    return;
  }

  // Cache for phase buttons
  cachedLaneSeasonRows26 = seasonRows || null;
  cachedLaneTimelineRows26 = allTimeline;

  // Optional: filter timeline to match IDs that exist in seasonRows (keeps scope “season-correct”)
  let timelineScoped = allTimeline;
  if (Array.isArray(seasonRows) && seasonRows.length) {
    const seasonSet = new Set(seasonRows.map(ldGetMatchId).filter(Boolean));
    if (seasonSet.size) {
      timelineScoped = allTimeline.filter((r) => seasonSet.has(ldGetMatchId(r)));
    }
  }

  // How many games exist in scope?
  const gameSet = new Set(timelineScoped.map(ldGetMatchId).filter(Boolean));
  const gamesInScope = gameSet.size || 0;

  // 🔒 Unlock gating
  if (gamesInScope < (LANE_DYNAMICS_UNLOCK_GAMES || 0)) {
    const need = (LANE_DYNAMICS_UNLOCK_GAMES || 0);
    const remaining = Math.max(0, need - gamesInScope);

    container.innerHTML = `
      <section class="section-wrapper fade-in mb-10">
        <div class="dashboard-card bg-white shadow-sm rounded-2xl border border-gray-100 p-4">
          <h2 class="text-[1.05rem] font-semibold text-sky-500 tracking-tight">Lane Dynamics & Playmakers</h2>
          <p class="text-[0.7rem] text-gray-600 mt-1">
            Minute-by-minute lane vs opponent analysis. Unlocks once enough games are collected.
          </p>
          <div class="mt-3 p-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50">
            <div class="text-sm font-semibold text-slate-800">🔒 Locked</div>
            <div class="text-[0.7rem] text-slate-600 mt-1">
              Progress: <span class="font-semibold">${gamesInScope}</span> / ${need} games
              ${remaining ? `(need ${remaining} more)` : ""}
            </div>
          </div>
        </div>
      </section>`;
    return;
  }

  // Role minutes + games per player (window-wide)
  const roleMinutesByPlayer = {};
  const gamesByPlayer = {};

  timelineScoped.forEach((r) => {
    const player = ldGetPlayer(r);
    if (!player) return;

    const role = normLaneRoleLD26(r) || "UNKNOWN";
    const gameId = ldGetMatchId(r);

    if (!gamesByPlayer[player]) gamesByPlayer[player] = new Set();
    if (gameId) gamesByPlayer[player].add(gameId);

    if (!roleMinutesByPlayer[player]) roleMinutesByPlayer[player] = { total: 0, byRole: {} };
    roleMinutesByPlayer[player].total += 1;
    roleMinutesByPlayer[player].byRole[role] = (roleMinutesByPlayer[player].byRole[role] || 0) + 1;
  });

  renderLaneDynamicsCard26(container, timelineScoped, roleMinutesByPlayer, gamesByPlayer, { roster });
}

function renderLaneDynamicsCard26(container, windowTimelineRows, roleMinutesByPlayer, gamesByPlayer, opts = {}) {
  const matchLengths = buildMatchLengthsLD26(windowTimelineRows);

  const allGameIds = new Set(windowTimelineRows.map(ldGetMatchId).filter(Boolean));
  const totalTimelineGames = allGameIds.size || 1;

  const perPlayerRole = {}; // player|role
  const perFrame = {};      // bot+sup duos frames
  const duoStats = {};
  const jungleStats = {};

  // Objective tracking (works because these columns exist in your headers)
  const objectiveEvents = {};
  const objTrack = {};

  windowTimelineRows.forEach((r) => {
    const player = ldGetPlayer(r);
    const matchId = ldGetMatchId(r);
    if (!player || !matchId) return;

    const minute = ldNum(r["Minute"]);
    const role = normLaneRoleLD26(r) || "UNKNOWN";
    const teamId = ldNum(r["TeamId"]) || 0;

    // --- objective tracking (all minutes) ---
    const objKey = `${matchId}|${teamId}`;
    const prev = objTrack[objKey] || { drag: 0, herald: 0, baron: 0, grubs: 0, atak: 0, towers: 0, inhibs: 0 };
    const cur = {
      drag: ldNum(r["Team Dragons"]),
      herald: ldNum(r["Team Heralds"]),
      baron: ldNum(r["Team Barons"]),
      grubs: ldNum(r["Team Voidgrubs"]),
      atak: ldNum(r["Team Atakhans"]),
      towers: ldNum(r["Team Towers"]),
      inhibs: ldNum(r["Team Inhibitors"]),
    };
    const gotObj =
      cur.drag > prev.drag || cur.herald > prev.herald || cur.baron > prev.baron ||
      cur.grubs > prev.grubs || cur.atak > prev.atak || cur.towers > prev.towers || cur.inhibs > prev.inhibs;

    if (gotObj) objectiveEvents[`${matchId}|${teamId}|${minute}`] = true;
    objTrack[objKey] = cur;

    // --- phase gating ---
    const phase = getPhaseForMinuteLD26(matchId, minute, matchLengths);
    if (!phase || phase !== lanePhase26) return;

    const zone = String(r["Zone"] || "").trim();
    const laneZone = laneHomeZoneLD26(role, teamId);

    const goldDiff = ldNum(r["Gold Diff vs Opp"]);
    const xpDiff = ldNum(r["XP Diff vs Opp"]);
    const csDiff = ldNum(r["CS Diff vs Opp"]);

    const closeTeammates = ldNum(r["Close Teammates"]);
    const isGrouped = ldBool(r["Is Grouped"]);
    const inRiver = ldBool(r["In River"]);

    const prKey = `${player}|${role}`;
    if (!perPlayerRole[prKey]) {
      perPlayerRole[prKey] = {
        name: player,
        role,
        minutes: 0,
        laneControlSum: 0,
        goodMinutes: 0,
        hardLosingMinutes: 0,
        selfLeadMinutes: 0,
        helpLeadMinutes: 0,
        sinkMinutes: 0,
        roamPlayMinutes: 0,
        games: new Set(),
      };
    }
    const pr = perPlayerRole[prKey];
    pr.games.add(matchId);
    pr.minutes += 1;

    // lane control composite (same as old, but fed by new headers)
    const g = Math.max(-800, Math.min(800, goldDiff));
    const x = Math.max(-2, Math.min(2, xpDiff));
    const c = Math.max(-25, Math.min(25, csDiff));
    const control = (g / 800 + x / 2 + c / 25) / 3;
    pr.laneControlSum += control;

    const combinedBehind = goldDiff <= -300 || xpDiff <= -1 || csDiff <= -15;
    const combinedAhead  = goldDiff >= 150  || xpDiff >= 0.5 || csDiff >= 8;

    if (!combinedBehind) pr.goodMinutes += 1;
    if (combinedBehind) pr.hardLosingMinutes += 1;

    if (combinedAhead) {
      if (closeTeammates <= 1) pr.selfLeadMinutes += 1;
      else if (closeTeammates >= 2) pr.helpLeadMinutes += 1;
    }

    // pressure sink (phase-aware)
    const teamGoldDiff = ldNum(r["Gold Diff (Team)"]);
    const teamAheadFlag = ldBool(r["Team Gold Ahead"]);
    const teamNotHardLosing = teamAheadFlag || teamGoldDiff >= -800;

    let pressureSinkMinute = false;
    if (combinedBehind && closeTeammates >= 2 && teamNotHardLosing) {
      if (phase === "early") pressureSinkMinute = true;
      else if (phase === "mid") pressureSinkMinute = (goldDiff <= -400 || xpDiff <= -1.5 || csDiff <= -20) && closeTeammates >= 2;
      else pressureSinkMinute = (goldDiff <= -600 || xpDiff <= -2) && closeTeammates >= 3;
    }
    if (pressureSinkMinute) pr.sinkMinutes += 1;

    // playmaker roam/group while stable
    const outOfLane =
      laneZone && zone && laneZone !== zone && (inRiver || isGrouped || closeTeammates >= 2);
    if (outOfLane && !combinedBehind) pr.roamPlayMinutes += 1;

    // botlane duo frames
    const frameKey = `${matchId}|${teamId}|${minute}`;
    if (!perFrame[frameKey]) perFrame[frameKey] = [];
    perFrame[frameKey].push({ player, role, goldDiff, xpDiff, csDiff, laneZone, zone, closeTeammates, isGrouped, inRiver, matchId });

    // jungle profiles
    if (role === "JUNGLE") {
      if (!jungleStats[player]) {
        jungleStats[player] = { player, minutes: 0, objPresenceMinutes: 0, leadObjMinutes: 0, gankMinutes: 0, farmMinutes: 0, games: new Set() };
      }
      const jg = jungleStats[player];
      jg.minutes += 1;
      jg.games.add(matchId);

      const evKey = `${matchId}|${teamId}|${minute}`;
      if (objectiveEvents[evKey]) {
        jg.objPresenceMinutes += 1;
        const teamAheadNow = ldBool(r["Team Gold Ahead"]) || ldNum(r["Gold Diff (Team)"]) > 0;
        const jgAheadNow = goldDiff > 0 || xpDiff > 0;
        if (teamAheadNow || jgAheadNow) jg.leadObjMinutes += 1;
      }

      const isFarm = zone === "Jungle" && !inRiver && closeTeammates <= 1;
      const isGank = !isFarm && (inRiver || closeTeammates >= 1 || zone !== "Jungle");
      if (isFarm) jg.farmMinutes += 1;
      if (isGank) jg.gankMinutes += 1;
    }
  });

  const playerRoleEntries = Object.values(perPlayerRole);
  if (!playerRoleEntries.length) {
    container.innerHTML = `
      <section class="section-wrapper fade-in mb-10">
        <div class="dashboard-card bg-white shadow-sm rounded-2xl border border-gray-100 p-4">
          <h2 class="text-[1.05rem] font-semibold text-sky-500 mb-1">Lane Dynamics & Playmakers</h2>
          <p class="text-sm text-gray-500">No timeline data in scope for the selected phase.</p>
        </div>
      </section>`;
    return;
  }

  // ---------- Duos (BOTTOM + SUPPORT) ----------
  Object.values(perFrame).forEach((frames) => {
    const bot = frames.find((f) => f.role === "BOTTOM");
    const sup = frames.find((f) => f.role === "SUPPORT");
    if (!bot || !sup) return;

    const [p1, p2] = [bot.player, sup.player].sort();
    const key = `${p1} & ${p2}`;

    if (!duoStats[key]) {
      duoStats[key] = { name: key, p1, p2, minutes: 0, laneControlSum: 0, goodMinutes: 0, hardLosingMinutes: 0, playMinutes: 0, sinkMinutes: 0, games: new Set() };
    }
    const d = duoStats[key];
    d.games.add(bot.matchId);
    d.minutes += 1;

    const avgGold = (bot.goldDiff + sup.goldDiff) / 2;
    const avgXp = (bot.xpDiff + sup.xpDiff) / 2;
    const avgCs = (bot.csDiff + sup.csDiff) / 2;

    const g = Math.max(-800, Math.min(800, avgGold));
    const x = Math.max(-2, Math.min(2, avgXp));
    const c = Math.max(-25, Math.min(25, avgCs));
    const control = (g / 800 + x / 2 + c / 25) / 3;
    d.laneControlSum += control;

    const combinedBehind = avgGold <= -300 || avgXp <= -1 || avgCs <= -15;

    if (!combinedBehind) d.goodMinutes += 1;
    if (combinedBehind) d.hardLosingMinutes += 1;

    const outOfLane =
      (bot.laneZone && bot.zone && bot.laneZone !== bot.zone) ||
      (sup.laneZone && sup.zone && sup.laneZone !== sup.zone);

    if (outOfLane && !combinedBehind) d.playMinutes += 1;

    if (combinedBehind && (bot.closeTeammates >= 2 || sup.closeTeammates >= 2)) d.sinkMinutes += 1;
  });

  const duoRows = Object.values(duoStats)
    .filter((d) => d.minutes >= 40 && d.games.size >= 3)
    .map((d) => {
      const mins = Math.max(1, d.minutes);
      const laneControl = (d.laneControlSum / mins) * 100;
      const reliability = (d.goodMinutes / mins) * 100;
      const playmaker = (d.playMinutes / mins) * 100;
      const pressureSink = (d.sinkMinutes / mins) * 100;
      const games = d.games.size || 1;

      let tag = "Stable Duo";
      if (laneControl >= 10 && reliability >= 65) tag = "Lane Rock Duo";
      else if (playmaker >= 10 && reliability >= 55) tag = "Playmaker Duo";
      else if (pressureSink >= 12) tag = "Pressure Sink Duo";

      return { name: d.name, games, laneControl, reliability, selfLead: null, helpedLead: null, pressureSink, playmaker, tag, roleMix: `${d.p1} + ${d.p2}`, isGuest: false, isDuo: true };
    });

  // ---------- Player rows ----------
  const tableRows = [];
  playerRoleEntries.forEach((pr) => {
    const rm = roleMinutesByPlayer?.[pr.name];
    if (!rm || rm.total === 0) return;

    const roleMinutes = rm.byRole?.[pr.role] || 0;
    const roleShare = (roleMinutes / rm.total) * 100;
    if (roleShare < 10) return;

    const mins = Math.max(1, pr.minutes || 0);
    if (mins < 5) return;

    const gamesInRole = pr.games.size || 1;
    const laneControl = (pr.laneControlSum / mins) * 100;
    const reliability = (pr.goodMinutes / mins) * 100;

    const leadDen = pr.selfLeadMinutes + pr.helpLeadMinutes;
    const selfLead = leadDen > 0 ? (pr.selfLeadMinutes / leadDen) * 100 : 0;
    const helpedLead = leadDen > 0 ? (pr.helpLeadMinutes / leadDen) * 100 : 0;

    const pressureSink = (pr.sinkMinutes / mins) * 100;
    const playmaker = (pr.roamPlayMinutes / mins) * 100;

    const gp = gamesByPlayer?.[pr.name];
    const gamesInWindow = gp ? gp.size || 1 : gamesInRole;

    // guest = <10% of games in scope
    const isGuest = gamesInWindow / totalTimelineGames < 0.1;

    // flex = >=2 roles >=10% share
    const flexRoles = Object.entries(rm.byRole)
      .filter(([, c]) => (c / rm.total) * 100 >= 10)
      .map(([r]) => r);
    const isFlex = flexRoles.length >= 2;

    const roleMix = Object.entries(rm.byRole)
      .map(([r, c]) => `${r} ${Math.round((c / rm.total) * 100)}%`)
      .join(" / ");

    let tag = "Stable";
    if (laneControl >= 15 && selfLead >= 55 && reliability >= 70) tag = "Lane Rock";
    else if (laneControl >= 10 && helpedLead >= 45) tag = "Resource Carry";
    else if (playmaker >= 10 && reliability >= 55) tag = "Playmaker";
    else if (pressureSink >= 12) tag = "Pressure Sink";
    else if (playmaker >= 12 && laneControl <= 0) tag = "High-Risk Roamer";
    if (isGuest) tag = "Guest (Small Sample)";

    const investmentTag = getInvestmentTagLD26({ laneControl, reliability, selfLead, helpedLead, pressureSink, playmaker });

    tableRows.push({
      name: pr.name,
      displayRole: pr.role,
      games: gamesInRole,
      laneControl,
      reliability,
      selfLead,
      helpedLead,
      pressureSink,
      playmaker,
      tag,
      investmentTag,
      roleMix,
      isFlex,
      isGuest,
      isDuo: false,
    });
  });

  const withPlayerMetrics = tableRows.filter((p) => !(p.isGuest && p.games <= 1));
  withPlayerMetrics.sort((a, b) => {
    if (a.isGuest !== b.isGuest) return a.isGuest ? 1 : -1;
    if (a.games !== b.games) return b.games - a.games;
    return b.laneControl - a.laneControl;
  });
  duoRows.sort((a, b) => b.laneControl - a.laneControl);

  const ldtopPlaymaker = [...withPlayerMetrics]
    .filter((p) => !p.isGuest && p.games >= 5)
    .sort((a, b) => b.playmaker - a.playmaker)[0] || null;

  const ldbestDuo = duoRows[0] || null;

  const jungleProfiles = Object.values(jungleStats)
    .map((j) => {
      const mins = Math.max(1, j.minutes || 0);
      const games = j.games ? j.games.size || 0 : 0;

      const rm = roleMinutesByPlayer?.[j.player];
      const jungleMinutes = rm?.byRole?.["JUNGLE"] ?? mins;
      const jungleShare = rm && rm.total > 0 ? (jungleMinutes / rm.total) * 100 : 0;

      if (jungleShare < 10 || mins < 10 || games < 3) return null;

      const objPresence = (j.objPresenceMinutes / mins) * 100;
      const leadObj = j.objPresenceMinutes > 0 ? (j.leadObjMinutes / j.objPresenceMinutes) * 100 : 0;
      const gankShare = (j.gankMinutes / mins) * 100;
      const farmShare = (j.farmMinutes / mins) * 100;

      let style = "Balanced";
      if (farmShare >= 60 && gankShare <= 40) style = "Farm Heavy";
      else if (gankShare >= 45 && gankShare > farmShare) style = "Gank Heavy";
      else if (objPresence >= 30 && leadObj >= 60) style = "Objective Engine";

      return { player: j.player, mins, games, objPresence, leadObj, gankShare, farmShare, style };
    })
    .filter(Boolean)
    .sort((a, b) => (b.games - a.games) || (b.objPresence - a.objPresence));

  // ---------- UI controls (phase only) ----------
  const phaseButtons = `
    <div class="inline-flex gap-1 bg-sky-50 px-1 py-1 rounded-full">
      ${[
        ["early", "Early"],
        ["mid", "Mid"],
        ["late", "Late"],
      ].map(([key, label]) => `
        <button
          class="px-3 py-1 rounded-full text-[0.7rem] font-medium transition
          ${lanePhase26 === key ? "bg-sky-500 text-white shadow-sm" : "bg-transparent text-sky-700 hover:bg-white hover:text-sky-600"}"
          data-lane26-phase="${key}">
          ${label}
        </button>`).join("")}
    </div>`;

  // ---------- Table rows ----------
  const playerRowsHTML = withPlayerMetrics.map((p) => {
    const lcColor =
      p.laneControl >= 15 ? "text-emerald-600" :
      p.laneControl >= 5  ? "text-sky-600" :
      p.laneControl <= -10 ? "text-red-500" : "text-gray-700";

    const relColor =
      p.reliability >= 75 ? "text-emerald-600" :
      p.reliability <= 55 ? "text-red-500" : "text-gray-700";

    const playColor =
      p.playmaker >= 14 ? "text-emerald-600" :
      p.playmaker >= 8  ? "text-sky-600" : "text-gray-500";

    const sinkColor = p.pressureSink >= 12 ? "text-red-500" : "text-gray-500";

    const tagTone =
      p.tag.startsWith("Lane Rock") ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
      p.tag.startsWith("Playmaker") ? "bg-sky-50 text-sky-700 border-sky-100" :
      p.tag.startsWith("Resource Carry") ? "bg-amber-50 text-amber-800 border-amber-100" :
      p.tag.includes("Pressure Sink") ? "bg-red-50 text-red-700 border-red-100" :
      p.tag.startsWith("Guest") ? "bg-violet-50 text-violet-700 border-violet-100" :
      "bg-slate-50 text-slate-700 border-slate-100";

    const investmentTag = p.investmentTag || "";
    const invTooltip = investmentTag ? getInvestmentTooltipLD26(investmentTag) : "";
    const invTone =
      investmentTag === "Island Safe" ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
      investmentTag === "Low-Maintenance" ? "bg-emerald-50/60 text-emerald-700 border-emerald-100" :
      investmentTag === "Invest Pays Off" ? "bg-sky-50 text-sky-700 border-sky-100" :
      investmentTag === "Setup Lane" ? "bg-sky-50/70 text-sky-700 border-sky-100" :
      investmentTag === "Volatile Duelist" ? "bg-amber-50 text-amber-800 border-amber-100" :
      investmentTag === "Needs Cover" ? "bg-orange-50 text-orange-800 border-orange-100" :
      investmentTag === "Resource Trap" ? "bg-red-50 text-red-700 border-red-100" : "";

    const guestStar = p.isGuest
      ? `<span class="ml-1 text-[0.6rem] text-violet-500" title="Plays &lt;10% of games in this phase scope">⭐</span>`
      : "";

    const flexMark = p.isFlex
      ? `<span class="ml-1 text-[0.55rem] text-sky-500">flex</span>`
      : "";

    const profileTooltip = getProfileTooltipLD26(p.tag);

    const investmentPill = investmentTag
      ? `<span class="inline-flex items-center px-1.5 py-0.5 ml-1 rounded-full text-[0.55rem] border ${invTone}" title="${ldEscapeHTML(invTooltip)}">
           ${ldEscapeHTML(investmentTag)}
         </span>`
      : "";

    return `
      <tr class="hover:bg-orange-50/40 transition">
        <td class="py-1.5 px-2 font-semibold text-gray-800">
          ${ldEscapeHTML(p.name)}${guestStar}
          <span class="text-[0.6rem] text-gray-500 ml-1">(${ldEscapeHTML(p.displayRole)})</span>
          <div class="text-[0.55rem] text-gray-400">${ldEscapeHTML(p.roleMix)}${flexMark}</div>
        </td>
        <td class="py-1.5 px-2 text-right ${lcColor}">${p.laneControl.toFixed(1)}%</td>
        <td class="py-1.5 px-2 text-right ${relColor}">${p.reliability.toFixed(1)}%</td>
        <td class="py-1.5 px-2 text-right text-gray-700">${p.selfLead ? p.selfLead.toFixed(0) + "%" : "—"}</td>
        <td class="py-1.5 px-2 text-right text-gray-700">${p.helpedLead ? p.helpedLead.toFixed(0) + "%" : "—"}</td>
        <td class="py-1.5 px-2 text-right ${playColor}">${p.playmaker.toFixed(1)}%</td>
        <td class="py-1.5 px-2 text-right ${sinkColor}">${p.pressureSink.toFixed(1)}%</td>
        <td class="py-1.5 px-2 text-right text-gray-500">${p.games}</td>
        <td class="py-1.5 px-2">
          <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[0.6rem] border ${tagTone}" title="${ldEscapeHTML(profileTooltip)}">
            ${ldEscapeHTML(p.tag)}
          </span>
          ${investmentPill}
        </td>
      </tr>`;
  }).join("");

  const duoHeaderRow = duoRows.length
    ? `<tr class="bg-slate-50/80">
         <td colspan="9" class="px-2 py-1.5 text-[0.65rem] font-semibold text-sky-700">
           Botlane Duos (BOTTOM + SUPPORT)
         </td>
       </tr>`
    : "";

  const duoRowsHTML = duoRows.map((d) => {
    const lcColor =
      d.laneControl >= 10 ? "text-emerald-600" :
      d.laneControl >= 3  ? "text-sky-600" :
      d.laneControl <= -8 ? "text-red-500" : "text-gray-700";

    const relColor =
      d.reliability >= 70 ? "text-emerald-600" :
      d.reliability <= 55 ? "text-red-500" : "text-gray-700";

    const playColor =
      d.playmaker >= 12 ? "text-emerald-600" :
      d.playmaker >= 6  ? "text-sky-600" : "text-gray-500";

    const sinkColor = d.pressureSink >= 12 ? "text-red-500" : "text-gray-500";

    const tagTone =
      d.tag.includes("Rock") ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
      d.tag.includes("Playmaker") ? "bg-sky-50 text-sky-700 border-sky-100" :
      d.tag.includes("Pressure Sink") ? "bg-red-50 text-red-700 border-red-100" :
      "bg-slate-50 text-slate-700 border-slate-100";

    const profileTooltip = getProfileTooltipLD26(d.tag);

    return `
      <tr class="hover:bg-orange-50/40 transition">
        <td class="py-1.5 px-2 font-semibold text-gray-800">
          ${ldEscapeHTML(d.name)}
          <div class="text-[0.55rem] text-gray-400">${ldEscapeHTML(d.roleMix)}</div>
        </td>
        <td class="py-1.5 px-2 text-right ${lcColor}">${d.laneControl.toFixed(1)}%</td>
        <td class="py-1.5 px-2 text-right ${relColor}">${d.reliability.toFixed(1)}%</td>
        <td class="py-1.5 px-2 text-right text-gray-400">—</td>
        <td class="py-1.5 px-2 text-right text-gray-400">—</td>
        <td class="py-1.5 px-2 text-right ${playColor}">${d.playmaker.toFixed(1)}%</td>
        <td class="py-1.5 px-2 text-right ${sinkColor}">${d.pressureSink.toFixed(1)}%</td>
        <td class="py-1.5 px-2 text-right text-gray-500">${d.games}</td>
        <td class="py-1.5 px-2">
          <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[0.6rem] border ${tagTone}" title="${ldEscapeHTML(profileTooltip)}">
            ${ldEscapeHTML(d.tag)}
          </span>
        </td>
      </tr>`;
  }).join("");

 // ---------- Mini cards (SAFE) ----------
const ldTopPlaymaker = [...withPlayerMetrics]
  .filter((p) => !p.isGuest && p.games >= 5)
  .sort((a, b) => b.playmaker - a.playmaker)[0] || null;

const ldBestDuo = duoRows[0] || null;

const bestDuoCard = ldBestDuo
  ? `<div class="p-3 rounded-2xl bg-sky-50 border border-sky-100">
       <div class="text-[0.65rem] font-semibold text-sky-600 uppercase mb-1">Most Reliable Botlane Duo</div>
       <div class="text-sm font-semibold text-gray-900">${ldEscapeHTML(ldBestDuo.name)}</div>
       <div class="text-[0.7rem] text-gray-700">
         Lane Control ${ldBestDuo.laneControl.toFixed(1)}%, Reliability ${ldBestDuo.reliability.toFixed(1)}% (${ldBestDuo.games} games)
       </div>
     </div>`
  : `<div class="p-3 rounded-2xl bg-sky-50 border border-dashed border-sky-100 text-[0.65rem] text-gray-500">
       Not enough repeated BOTTOM+SUPPORT duos yet.
     </div>`;

const topPlaymakerCard = ldTopPlaymaker
  ? `<div class="p-3 rounded-2xl bg-emerald-50 border border-emerald-100">
       <div class="text-[0.65rem] font-semibold text-emerald-600 uppercase mb-1">Top Phase Playmaker</div>
       <div class="text-sm font-semibold text-gray-900">
         ${ldEscapeHTML(ldTopPlaymaker.name)}
         <span class="text-[0.6rem] text-gray-500 ml-1">(${ldEscapeHTML(ldTopPlaymaker.displayRole)})</span>
       </div>
       <div class="text-[0.7rem] text-gray-700">
         Roaming/Grouped while stable: ${ldTopPlaymaker.playmaker.toFixed(1)}% of phase minutes.
       </div>
     </div>`
  : `<div class="p-3 rounded-2xl bg-emerald-50/40 border border-dashed border-emerald-100 text-[0.6rem] text-gray-500">
       No clear standout playmaker in this phase.
     </div>`;

// Build jungle cards HTML (must exist BEFORE container.innerHTML)
let jungleCards = "";

if (jungleProfiles && jungleProfiles.length) {
  jungleCards = `
    <div class="mt-4">
      <div class="text-[0.65rem] font-semibold text-sky-600 uppercase mb-1">Jungle Profiles</div>
      <div class="flex gap-2 overflow-x-auto pb-1">
        ${jungleProfiles.map((j) => `
          <div class="min-w-[160px] p-3 rounded-2xl bg-slate-50 border border-slate-100">
            <div class="text-[0.6rem] font-semibold text-sky-600 uppercase mb-0.5">Jungle Profile</div>
            <div class="text-sm font-semibold text-gray-900">
              ${ldEscapeHTML(j.player)}
              <span class="ml-1 text-[0.6rem] text-gray-500">${ldEscapeHTML(j.style)}</span>
            </div>
            <div class="text-[0.6rem] text-gray-700 mt-0.5 leading-snug">
              Obj presence: ${j.objPresence.toFixed(0)}%<br/>
              Lead → Obj: ${j.leadObj.toFixed(0)}%<br/>
              Gank vs Farm: ${j.gankShare.toFixed(0)}% / ${j.farmShare.toFixed(0)}%<br/>
              ${j.games} g, ${j.mins}m in phase
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

  // Render
  container.innerHTML = `
    <section class="section-wrapper fade-in mb-10">
      <div class="dashboard-card bg-white shadow-sm rounded-2xl border border-gray-100">
        <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
          <div>
            <h2 class="text-[1.05rem] font-semibold text-sky-500 tracking-tight">Lane Dynamics & Playmakers</h2>
            <p class="text-[0.7rem] text-gray-600 max-w-xl">
              Minute-by-minute lane vs opponent analysis. Jungle/Support interpreted via pressure, presence & roaming.
            </p>
            <p class="text-[0.6rem] text-gray-500">
              Current phase: <span class="font-semibold capitalize">${lanePhase26}</span> · Window: <span class="font-semibold">Season</span>
            </p>
          </div>
          <div class="flex flex-col items-end gap-2">
            ${phaseButtons}
            <div class="text-right text-[0.6rem] text-gray-500">
              Timeline games in scope:
              <span class="font-semibold text-gray-800">${totalTimelineGames}</span><br/>
              Includes roster + guests (⭐ when &lt;10% of games).
            </div>
          </div>
        </div>

        <div class="-mx-1 overflow-x-auto">
          <table class="min-w-full text-[0.7rem] border-t border-gray-100">
            <thead class="text-gray-500 bg-slate-50/80">
              <tr>
                <th class="text-left py-2 px-2">Player / Duo</th>
                <th class="text-right py-2 px-2">Lane Control</th>
                <th class="text-right py-2 px-2">Reliability</th>
                <th class="text-right py-2 px-2">Self-Sufficient Lead</th>
                <th class="text-right py-2 px-2">Helped Lead</th>
                <th class="text-right py-2 px-2">Playmaker</th>
                <th class="text-right py-2 px-2">Pressure Sink</th>
                <th class="text-right py-2 px-2">Games</th>
                <th class="text-left py-2 px-2">Profile</th>
              </tr>
            </thead>
            <tbody>
              ${playerRowsHTML}
              ${duoHeaderRow}
              ${duoRowsHTML}
            </tbody>
          </table>
        </div>

        <div class="mt-4 grid md:grid-cols-2 gap-3">
          ${bestDuoCard}
          ${topPlaymakerCard}
        </div>

        ${jungleCards}

        <div class="mt-3 text-[0.6rem] text-gray-500 leading-snug">
          <p><strong>How to read:</strong></p>
          <p>
            <strong>Lane Control</strong>: composite of Gold/XP/CS diff vs opponent in this phase.
            <strong>Reliability</strong>: minutes not significantly behind.
            <strong>Self vs Helped Lead</strong>: ahead alone vs with ally presence.
            <strong>Playmaker</strong>: roaming/grouped/river while stable.
            <strong>Pressure Sink</strong>: behind despite strong ally presence (tightened mid/late).
          </p>
        </div>
      </div>
    </section>
  `;

  // Bind phase buttons
  container.querySelectorAll("[data-lane26-phase]").forEach((btn) => {
    btn.addEventListener("click", () => {
      lanePhase26 = btn.getAttribute("data-lane26-phase");
      renderLaneDynamics26(cachedLaneSeasonRows26, cachedLaneTimelineRows26, { mountId: LANE_DYNAMICS_CONTAINER_ID });
    });
  });

  console.log("🧭 Lane Dynamics S26 v3.1", {
    phase: lanePhase26,
    playerRows: withPlayerMetrics.length,
    duos: duoRows.length,
    jungleProfiles,
  });
}

// ============================================================================
// 🧭 OBJECTIVE WIN IMPACT (Season-only)
// A) Objective "uplift" (WR with vs without: First Dragon/Herald/Tower/Baron/Inhib)
// B) Conversion quality (Objective Conversion Rate, Objectives per Teamfight)
// C) Top contributors (Objective dmg, Participation, Steals)
// + uses DDragon icons: champ icons for players + Smite/Control Ward icons for steal section
// - Atakhan intentionally excluded
// ============================================================================

function renderObjectiveWinImpact26(rows, opts = {}) {
  const roster = Array.isArray(opts.roster) ? opts.roster : (typeof ROSTER !== "undefined" ? ROSTER : []);
  const DDV = opts.ddVersion || "16.1.1";

  const mount =
    document.getElementById(opts.mountId || TEAM_OBJECTIVES_ID) ||
    document.getElementById("objective-win-impact");

  if (!mount) {
    console.warn(`[ObjectiveWinImpact] Missing mount: #${TEAM_OBJECTIVES_ID}`);
    return;
  }

  if (!rows || !rows.length) {
    mount.innerHTML = fallbackObjCard("Objective Win Impact", "No season rows available yet.");
    return;
  }

  // ---------- tiny helpers ----------
  const esc = (s) =>
    String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  const n = (v) => {
    const x = parseFloat(String(v ?? "").replace(",", "."));
    return Number.isFinite(x) ? x : 0;
  };

  const isBool = (v) => {
    const s = String(v ?? "").trim().toLowerCase();
    if (!s) return false;
    return s === "true" || s === "1" || s === "yes" || s === "win" || s === "w";
  };

  const parseWin = (r) => {
    // supports: Result = Win/Loss, p.win = true/false
    const res = String(r["Result"] ?? r["RESULT"] ?? "").trim().toLowerCase();
    if (res === "win") return true;
    if (res === "loss") return false;
    if ("p.win" in r) return isBool(r["p.win"]);
    return isBool(r["Win"]) || isBool(r["WIN"]);
  };

  const getMatchId = (r) =>
    String(r["Match ID"] ?? r["MATCH ID"] ?? r["MatchId"] ?? r["matchId"] ?? "").trim();

  const getPlayer = (r) => String(r["Player"] ?? r["Summoner"] ?? r["p.riotIdGameName"] ?? "").trim();

  const getChampion = (r) => String(r["Champion"] ?? r["p.championName"] ?? r["championName"] ?? "").trim();

  // DDragon champ key normalizer (covers common edge cases)
  const champToDDragonKey = (name) => {
    const raw = String(name || "").trim();
    if (!raw) return "";

    const map = {
      "Cho'Gath": "Chogath",
      "Dr. Mundo": "DrMundo",
      "Kha'Zix": "Khazix",
      "Kai'Sa": "Kaisa",
      "LeBlanc": "Leblanc",
      "Vel'Koz": "Velkoz",
      "Wukong": "MonkeyKing",
      "Nunu & Willump": "Nunu",
      "Renata Glasc": "Renata",
      "Bel'Veth": "Belveth",
      "Kog'Maw": "KogMaw",
      "Rek'Sai": "RekSai",
      "Jarvan IV": "JarvanIV",
      "Lee Sin": "LeeSin",
      "Master Yi": "MasterYi",
      "Miss Fortune": "MissFortune",
      "Twisted Fate": "TwistedFate",
      "Xin Zhao": "XinZhao",
    };
    if (map[raw]) return map[raw];

    return raw
      .replaceAll("&", "and")
      .replaceAll("'", "")
      .replaceAll(".", "")
      .replaceAll(" ", "")
      .replaceAll("-", "");
  };

  const ddChampIcon = (champ) => {
    const key = champToDDragonKey(champ);
    return key ? `https://ddragon.leagueoflegends.com/cdn/${DDV}/img/champion/${key}.png` : "";
  };

  const ddItemIcon = (itemId) => `https://ddragon.leagueoflegends.com/cdn/${DDV}/img/item/${itemId}.png`;
  const ddSpellIcon = (spellKey) => `https://ddragon.leagueoflegends.com/cdn/${DDV}/img/spell/${spellKey}.png`;

  const pct = (v) => {
    // accepts 0..1 or 0..100
    const x = n(v);
    if (!Number.isFinite(x)) return 0;
    return x <= 1.0 ? x * 100 : x;
  };

  const avg = (arr) => (arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : 0);

  // ---------- group rows into matches ----------
  const matches = new Map(); // matchId -> aggregate
  const champCountByPlayer = new Map(); // player -> Map(champ -> count)

  for (const r of rows) {
    const mid = getMatchId(r);
    if (!mid) continue;

    const player = getPlayer(r);
    const champ = getChampion(r);
    const win = parseWin(r);

    if (!matches.has(mid)) {
      matches.set(mid, {
        matchId: mid,
        win: !!win,

        // First objective booleans (TEAM side)
        firstDragon: false,
        firstHerald: false,
        firstTower: false,
        firstBaron: false,
        firstInhib: false,

        // control / conversion
        totalObjTeam: 0,
        totalObjEnemy: 0,
        objConv: null,
        objPerTf: null,
        tfWinRate: null,

        // steal signals (team totals)
        stolen: 0,
        stolenA: 0,
        epicSteals: 0,
        epicNoSmite: 0,

        anySteal: false,
      });
    }

    const m = matches.get(mid);

    // win: if any row indicates win, keep as win (safe)
    m.win = m.win || !!win;

    // first objectives
    m.firstDragon = m.firstDragon || isBool(r["First Dragon (Team)"]);
    m.firstHerald = m.firstHerald || isBool(r["First Herald (Team)"]);
    m.firstTower = m.firstTower || isBool(r["First Tower (Team)"]);
    m.firstBaron = m.firstBaron || isBool(r["First Baron (Team)"]);
    m.firstInhib = m.firstInhib || isBool(r["First Inhibitor (Team)"]);

    // totals (team-wide)
    m.totalObjTeam = Math.max(m.totalObjTeam, n(r["Total Objectives (Team)"]));
    m.totalObjEnemy = Math.max(m.totalObjEnemy, n(r["Total Objectives (Enemy)"]));

    // conversion metrics (team-wide, same on each row typically)
    const oc = r["Objective Conversion Rate"];
    if (oc !== undefined && oc !== "" && m.objConv == null) m.objConv = pct(oc);

    const optf = r["Objectives per Teamfight"];
    if (optf !== undefined && optf !== "" && m.objPerTf == null) m.objPerTf = n(optf);

    const tfwr = r["Teamfight Win Rate"];
    if (tfwr !== undefined && tfwr !== "" && m.tfWinRate == null) m.tfWinRate = pct(tfwr);

    // steal metrics (player rows → team totals)
    const s1 = n(r["p.objectivesStolen"]);
    const s2 = n(r["p.objectivesStolenAssists"]);
    const s3 = n(r["p.challenges.epicMonsterSteals"]);
    const s4 = n(r["p.challenges.epicMonsterStolenWithoutSmite"]);

    m.stolen += s1;
    m.stolenA += s2;
    m.epicSteals += s3;
    m.epicNoSmite += s4;

    if (s1 > 0 || s2 > 0 || s3 > 0 || s4 > 0) m.anySteal = true;

    // champ counts for roster players (for nice icons in leaderboards)
    if (player && champ && roster.includes(player)) {
      if (!champCountByPlayer.has(player)) champCountByPlayer.set(player, new Map());
      const mp = champCountByPlayer.get(player);
      mp.set(champ, (mp.get(champ) || 0) + 1);
    }
  }

  const matchList = [...matches.values()];
  const gamesTotal = matchList.length;

  if (!gamesTotal) {
    mount.innerHTML = fallbackObjCard("Objective Win Impact", "No matches found (missing Match ID?).");
    return;
  }

  const winsTotal = matchList.filter((m) => m.win).length;
  const teamWR = (winsTotal / gamesTotal) * 100;

  // ---------- uplift helpers ----------
  const upliftFor = (label, key) => {
    const withArr = matchList.filter((m) => !!m[key]);
    const withoutArr = matchList.filter((m) => !m[key]);

    const withG = withArr.length;
    const withoutG = withoutArr.length;

    const withWR = withG ? (withArr.filter((m) => m.win).length / withG) * 100 : 0;
    const withoutWR = withoutG ? (withoutArr.filter((m) => m.win).length / withoutG) * 100 : 0;

    return {
      label,
      key,
      withG,
      withoutG,
      withWR,
      withoutWR,
      uplift: withWR - withoutWR,
    };
  };

  const firstUplifts = [
    upliftFor("First Dragon", "firstDragon"),
    upliftFor("First Herald", "firstHerald"),
    upliftFor("First Tower", "firstTower"),
    upliftFor("First Baron", "firstBaron"),
    upliftFor("First Inhib", "firstInhib"),
  ];

  // Objective Control threshold analysis
  const controlRatio = (m) => {
    const den = Math.max(1, (m.totalObjTeam || 0) + (m.totalObjEnemy || 0));
    return den ? (m.totalObjTeam || 0) / den : 0;
  };
  const ctrlVals = matchList.map(controlRatio);
  const ctrlAvg = avg(ctrlVals) * 100;

  const CTRL_TH = 0.55;
  const ctrlHigh = matchList.filter((m) => controlRatio(m) >= CTRL_TH);
  const ctrlLow = matchList.filter((m) => controlRatio(m) < CTRL_TH);

  const ctrlHighWR = ctrlHigh.length ? (ctrlHigh.filter((m) => m.win).length / ctrlHigh.length) * 100 : 0;
  const ctrlLowWR = ctrlLow.length ? (ctrlLow.filter((m) => m.win).length / ctrlLow.length) * 100 : 0;
  const ctrlUplift = ctrlHighWR - ctrlLowWR;

  // Steal impact (not always “good” — but interesting)
  const stealYes = matchList.filter((m) => m.anySteal);
  const stealNo = matchList.filter((m) => !m.anySteal);
  const stealYesWR = stealYes.length ? (stealYes.filter((m) => m.win).length / stealYes.length) * 100 : 0;
  const stealNoWR = stealNo.length ? (stealNo.filter((m) => m.win).length / stealNo.length) * 100 : 0;
  const stealUplift = stealYesWR - stealNoWR;

  const totalStolen = matchList.reduce((s, m) => s + (m.stolen || 0), 0);
  const totalStolenA = matchList.reduce((s, m) => s + (m.stolenA || 0), 0);
  const totalEpicSteals = matchList.reduce((s, m) => s + (m.epicSteals || 0), 0);
  const totalNoSmite = matchList.reduce((s, m) => s + (m.epicNoSmite || 0), 0);

  // ---------- conversion quality (wins vs losses) ----------
  const wins = matchList.filter((m) => m.win);
  const losses = matchList.filter((m) => !m.win);

  const convW = avg(wins.map((m) => (m.objConv == null ? NaN : m.objConv)).filter(Number.isFinite));
  const convL = avg(losses.map((m) => (m.objConv == null ? NaN : m.objConv)).filter(Number.isFinite));

  const optfW = avg(wins.map((m) => (m.objPerTf == null ? NaN : m.objPerTf)).filter(Number.isFinite));
  const optfL = avg(losses.map((m) => (m.objPerTf == null ? NaN : m.objPerTf)).filter(Number.isFinite));

  const tfwrW = avg(wins.map((m) => (m.tfWinRate == null ? NaN : m.tfWinRate)).filter(Number.isFinite));
  const tfwrL = avg(losses.map((m) => (m.tfWinRate == null ? NaN : m.tfWinRate)).filter(Number.isFinite));

  // ---------- player contribution (C) ----------
  const playerAgg = new Map(); // player -> stats
  const perPlayerMatchSeen = new Set(); // (player|matchId) dedupe

  for (const r of rows) {
    const player = getPlayer(r);
    const mid = getMatchId(r);
    if (!player || !mid) continue;
    if (!roster.includes(player)) continue;

    const dedupeKey = `${player}|${mid}`;
    if (perPlayerMatchSeen.has(dedupeKey)) continue;
    perPlayerMatchSeen.add(dedupeKey);

    if (!playerAgg.has(player)) {
      playerAgg.set(player, {
        player,
        games: 0,
        objDmg: 0,
        epicDmg: 0,
        partScoreSum: 0,
        partCount: 0,
        stolen: 0,
        stolenA: 0,
        epicSteals: 0,
        noSmite: 0,
      });
    }
    const p = playerAgg.get(player);
    p.games += 1;

    p.objDmg += n(r["p.damageDealtToObjectives"]);
    p.epicDmg += n(r["p.damageDealtToEpicMonsters"]);

    // Participation metrics (0..1 or 0..100)
    const parts = [
      r["Dragon Participation"],
      r["Herald Participation"],
      r["Baron Participation"],
      r["Tower Participation"],
      r["Void Grub Participation"],
    ].map(pct);

    // Simple, easy-to-read participation score: average of the available ones
    const partsValid = parts.filter((x) => Number.isFinite(x) && x > 0);
    if (partsValid.length) {
      p.partScoreSum += avg(partsValid);
      p.partCount += 1;
    }

    p.stolen += n(r["p.objectivesStolen"]);
    p.stolenA += n(r["p.objectivesStolenAssists"]);
    p.epicSteals += n(r["p.challenges.epicMonsterSteals"]);
    p.noSmite += n(r["p.challenges.epicMonsterStolenWithoutSmite"]);
  }

  const players = [...playerAgg.values()].map((p) => {
    const partAvg = p.partCount ? p.partScoreSum / p.partCount : 0;
    return { ...p, partAvg };
  });

  const topBy = (arr, key, k = 3) =>
    arr
      .slice()
      .sort((a, b) => (b[key] - a[key]) || (b.games - a.games) || a.player.localeCompare(b.player))
      .slice(0, k);

  const topObjDmg = topBy(players, "objDmg", 3);
  const topPart = topBy(players, "partAvg", 3);
  const topSteals = topBy(players, "epicSteals", 3);

  const mostPlayedChampFor = (player) => {
    const mp = champCountByPlayer.get(player);
    if (!mp) return "";
    let best = "";
    let bestC = 0;
    for (const [c, ct] of mp.entries()) {
      if (ct > bestC) {
        bestC = ct;
        best = c;
      }
    }
    return best || "";
  };

  // ---------- UI helpers ----------
  const toneForUplift = (u) => {
    if (u >= 12) return "bg-emerald-50 text-emerald-700 border-emerald-200";
    if (u >= 5) return "bg-sky-50 text-sky-700 border-sky-200";
    if (u <= -5) return "bg-rose-50 text-rose-700 border-rose-200";
    return "bg-slate-50 text-slate-700 border-slate-200";
  };

  const chip = (iconHTML, title, sub, upliftVal) => {
    const tone = toneForUplift(upliftVal);
    const sign = upliftVal > 0 ? "+" : "";
    return `
      <div class="inline-flex items-center gap-2 px-3 py-2 rounded-2xl border ${tone}">
        <div class="w-6 h-6 rounded-xl bg-white/70 border border-slate-200 flex items-center justify-center overflow-hidden">
          ${iconHTML}
        </div>
        <div class="leading-tight">
          <div class="text-[0.7rem] font-semibold">${esc(title)}</div>
          <div class="text-[0.65rem] opacity-80">${esc(sub)} · <span class="font-semibold">${sign}${upliftVal.toFixed(1)}%</span></div>
        </div>
      </div>
    `;
  };

  const objIcon = (k) => {
    // no Atakhan
    const map = {
      dragon: "🐉",
      herald: "🦀",
      tower: "🗼",
      baron: "👾",
      inhib: "💥",
    };
    return `<span class="text-[0.9rem]">${map[k] || "🎯"}</span>`;
  };

  const upliftChipsHTML = (() => {
    const m = {
      firstDragon: { k: "dragon" },
      firstHerald: { k: "herald" },
      firstTower: { k: "tower" },
      firstBaron: { k: "baron" },
      firstInhib: { k: "inhib" },
    };

    return firstUplifts
      .map((u) => {
        const key = m[u.key]?.k || "objective";
        const sub = `WR ${u.withWR.toFixed(0)}% vs ${u.withoutWR.toFixed(0)}% (${u.withG}/${u.withoutG} games)`;
        return chip(objIcon(key), u.label, sub, u.uplift);
      })
      .join("");
  })();

  const ctrlChip = chip(
    `<span class="text-[0.85rem]">🧭</span>`,
    `Objective Control ≥ ${Math.round(CTRL_TH * 100)}%`,
    `WR ${ctrlHighWR.toFixed(0)}% vs ${ctrlLowWR.toFixed(0)}% (${ctrlHigh.length}/${ctrlLow.length})`,
    ctrlUplift
  );

  const stealChip = chip(
    `<img src="${ddSpellIcon("SummonerSmite")}" class="w-full h-full object-cover" alt="Smite" loading="lazy" />`,
    `Games with a Steal`,
    `WR ${stealYesWR.toFixed(0)}% vs ${stealNoWR.toFixed(0)}% (${stealYes.length}/${stealNo.length})`,
    stealUplift
  );

  const fmtK = (x) => {
    if (!Number.isFinite(x)) return "—";
    if (x >= 1_000_000) return (x / 1_000_000).toFixed(2) + "M";
    if (x >= 1_000) return (x / 1_000).toFixed(1) + "k";
    return Math.round(x).toString();
  };

  const lbRow = (p, rightText, extraSub = "") => {
    const champ = mostPlayedChampFor(p.player);
    const iconUrl = ddChampIcon(champ);
    const icon = iconUrl
      ? `<img src="${iconUrl}" alt="${esc(champ)}" class="w-8 h-8 rounded-xl border border-slate-200 object-cover" loading="lazy" />`
      : `<div class="w-8 h-8 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center text-[0.7rem]">🎮</div>`;

    return `
      <div class="flex items-center justify-between gap-3 py-2 border-t border-slate-100">
        <div class="flex items-center gap-2 min-w-0">
          ${icon}
          <div class="min-w-0">
            <div class="text-[0.75rem] font-semibold text-slate-900 truncate">${esc(p.player)}</div>
            <div class="text-[0.65rem] text-slate-500 truncate">
              ${champ ? `${esc(champ)} · ` : ""}${p.games} games${extraSub ? ` · ${esc(extraSub)}` : ""}
            </div>
          </div>
        </div>
        <div class="text-[0.75rem] font-semibold text-slate-900 whitespace-nowrap">${esc(rightText)}</div>
      </div>
    `;
  };

  const objDmgBox = `
    <div class="p-3 rounded-2xl border border-slate-200 bg-white/70">
      <div class="text-[0.65rem] font-semibold text-slate-900">Top Objective Damage</div>
      <div class="text-[0.6rem] text-slate-500 mt-0.5">Who actually hits objectives (towers/dragons/herald/baron)</div>
      <div class="mt-2">
        ${topObjDmg.map((p) => lbRow(p, fmtK(p.objDmg), `+ ${fmtK(p.epicDmg)} epic dmg`)).join("") || `<div class="text-[0.7rem] text-slate-400 mt-2">No data yet.</div>`}
      </div>
    </div>
  `;

  const partBox = `
    <div class="p-3 rounded-2xl border border-slate-200 bg-white/70">
      <div class="text-[0.65rem] font-semibold text-slate-900">Top Objective Participation</div>
      <div class="text-[0.6rem] text-slate-500 mt-0.5">Average of Dragon/Herald/Baron/Tower/Grubs participation</div>
      <div class="mt-2">
        ${topPart.map((p) => lbRow(p, `${p.partAvg.toFixed(0)}%`)).join("") || `<div class="text-[0.7rem] text-slate-400 mt-2">No data yet.</div>`}
      </div>
    </div>
  `;

  const stealsBox = `
    <div class="p-3 rounded-2xl border border-slate-200 bg-white/70">
      <div class="flex items-center justify-between">
        <div>
          <div class="text-[0.65rem] font-semibold text-slate-900">Steals & Clutch</div>
          <div class="text-[0.6rem] text-slate-500 mt-0.5">High-swing moments (not always “good”, but very impactful)</div>
        </div>
        <div class="flex items-center gap-1">
          <img src="${ddSpellIcon("SummonerSmite")}" class="w-6 h-6 rounded-lg border border-slate-200 bg-white" alt="Smite" loading="lazy" />
          <img src="${ddItemIcon(2055)}" class="w-6 h-6 rounded-lg border border-slate-200 bg-white" alt="Control Ward" loading="lazy" />
        </div>
      </div>

      <div class="mt-2 grid grid-cols-2 gap-2">
        <div class="p-2 rounded-2xl border border-slate-200 bg-slate-50">
          <div class="text-[0.6rem] text-slate-500">Epic Monster Steals</div>
          <div class="text-[0.95rem] font-semibold text-slate-900">${Math.round(totalEpicSteals)}</div>
        </div>
        <div class="p-2 rounded-2xl border border-slate-200 bg-slate-50">
          <div class="text-[0.6rem] text-slate-500">Steals w/o Smite</div>
          <div class="text-[0.95rem] font-semibold text-slate-900">${Math.round(totalNoSmite)}</div>
        </div>
        <div class="p-2 rounded-2xl border border-slate-200 bg-slate-50">
          <div class="text-[0.6rem] text-slate-500">Objectives Stolen</div>
          <div class="text-[0.95rem] font-semibold text-slate-900">${Math.round(totalStolen)}</div>
        </div>
        <div class="p-2 rounded-2xl border border-slate-200 bg-slate-50">
          <div class="text-[0.6rem] text-slate-500">Steal Assists</div>
          <div class="text-[0.95rem] font-semibold text-slate-900">${Math.round(totalStolenA)}</div>
        </div>
      </div>

      <div class="mt-2">
        <div class="text-[0.65rem] font-semibold text-slate-900">Top Stealers</div>
        ${topSteals.map((p) => lbRow(p, `${Math.round(p.epicSteals)} steals`, `${Math.round(p.noSmite)} no-smite`)).join("") || ""}
      </div>
    </div>
  `;

  // ---------- render ----------
  mount.innerHTML = `
    <section class="section-wrapper fade-in mb-10">
      <div class="dashboard-card bg-white shadow-sm rounded-2xl border border-gray-100 overflow-hidden">
        <div class="px-4 pt-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h2 class="text-[1.1rem] font-semibold text-orange-500 tracking-tight">Objective Win Impact</h2>
              <p class="text-[0.72rem] text-gray-600 leading-snug">
                Season-only. Shows which objectives correlate most with wins + whether we convert fights into objectives.
              </p>
            </div>
            <div class="text-right">
              <div class="text-[0.65rem] text-slate-500">Games</div>
              <div class="text-[1.0rem] font-semibold text-slate-900">${gamesTotal}</div>
              <div class="text-[0.65rem] text-slate-500 mt-1">Team WR</div>
              <div class="text-[0.9rem] font-semibold text-slate-900">${teamWR.toFixed(0)}%</div>
            </div>
          </div>
        </div>

        <!-- A) Win levers -->
        <div class="px-4 mt-4">
          <div class="text-[0.75rem] font-semibold text-slate-900">A) What objectives matter most for wins?</div>
          <div class="text-[0.65rem] text-slate-500 mt-0.5">
            “Uplift” = win rate with the condition minus win rate without it.
          </div>
          <div class="mt-3 flex flex-wrap gap-2">
            ${upliftChipsHTML}
            ${ctrlChip}
            ${stealChip}
          </div>

          <div class="mt-3 text-[0.65rem] text-slate-500">
            Objective Control avg: <span class="font-semibold text-slate-800">${ctrlAvg.toFixed(0)}%</span>
            <span class="text-slate-300">·</span>
            Threshold check: ≥${Math.round(CTRL_TH * 100)}% control is <span class="font-semibold">${ctrlUplift >= 0 ? "+" : ""}${ctrlUplift.toFixed(1)}%</span> WR uplift.
          </div>
        </div>

        <!-- B) Conversion quality -->
        <div class="px-4 mt-6">
          <div class="text-[0.75rem] font-semibold text-slate-900">B) Do we convert teamfights into objectives?</div>
          <div class="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
            ${miniCompare("Objective Conversion Rate", convW, convL, "%")}
            ${miniCompare("Objectives per Teamfight", optfW, optfL, "")}
            ${miniCompare("Teamfight Win Rate", tfwrW, tfwrL, "%")}
          </div>
        </div>

        <!-- C) Contributors -->
        <div class="px-4 mt-6 pb-4">
          <div class="text-[0.75rem] font-semibold text-slate-900">C) Who helps us secure objectives?</div>
          <div class="mt-3 grid grid-cols-1 lg:grid-cols-3 gap-3">
            ${objDmgBox}
            ${partBox}
            ${stealsBox}
          </div>

          <div class="mt-3 text-[0.6rem] text-slate-500 leading-snug">
            <strong>How to read:</strong>
            <span class="text-slate-500">
              Uplift chips show which “firsts” align with wins. Conversion shows whether post-fight macro is clean.
              Participation highlights who consistently shows up. Objective damage highlights who finishes the job.
              Steals are volatile — great in clutch, but often appear when you’re behind.
            </span>
          </div>
        </div>
      </div>
    </section>
  `;

  // Local helper: mini compare tiles (wins vs losses)
  function miniCompare(label, w, l, suffix) {
    const d = (w || 0) - (l || 0);
    const tone =
      d >= 8 ? "border-emerald-200 bg-emerald-50/60" :
      d >= 3 ? "border-sky-200 bg-sky-50/60" :
      d <= -3 ? "border-rose-200 bg-rose-50/60" :
      "border-slate-200 bg-slate-50";

    const sign = d > 0 ? "+" : "";
    const fmt = (x) => (Number.isFinite(x) ? (suffix === "%" ? x.toFixed(0) : x.toFixed(2)) : "—");

    return `
      <div class="p-3 rounded-2xl border ${tone}">
        <div class="text-[0.65rem] font-semibold text-slate-900">${esc(label)}</div>
        <div class="mt-2 flex items-end justify-between">
          <div>
            <div class="text-[0.6rem] text-slate-500">Wins avg</div>
            <div class="text-[1.0rem] font-semibold text-slate-900">${fmt(w)}${suffix}</div>
          </div>
          <div class="text-right">
            <div class="text-[0.6rem] text-slate-500">Loss avg</div>
            <div class="text-[0.9rem] font-semibold text-slate-700">${fmt(l)}${suffix}</div>
          </div>
        </div>
        <div class="mt-2 text-[0.65rem] text-slate-600">
          Δ <span class="font-semibold">${sign}${suffix === "%" ? d.toFixed(0) : d.toFixed(2)}${suffix}</span>
        </div>
      </div>
    `;
  }

  function fallbackObjCard(title, msg) {
    return `
      <section class="section-wrapper fade-in mb-10">
        <div class="dashboard-card bg-white shadow-sm rounded-2xl border border-gray-100 p-4">
          <div class="text-sm font-semibold text-orange-500">${esc(title)}</div>
          <div class="text-xs text-slate-500 mt-1">${esc(msg)}</div>
        </div>
      </section>
    `;
  }
}



// ============================================================================
// OPTIONAL INIT — loads timeline CSV and renders
// Requires: fetchTextWithDebug() + parseCSVToObjects() already in your project
// ============================================================================
async function initLaneDynamics26(seasonRows, opts = {}) {
  const csvText = await fetchTextWithDebug(SEASON26_TIMELINE_CSV);
  const { rows: timelineRows } = parseCSVToObjects(csvText);
  renderLaneDynamics26(seasonRows, timelineRows, { mountId: opts.mountId || LANE_DYNAMICS_CONTAINER_ID });
}

window.renderLaneDynamics26 = renderLaneDynamics26;


})();





// ============================================================================
// CSV parser
// ============================================================================
function parseCSVToObjects(text) {
  const rows = [];
  const headers = [];

  const raw = parseCSV(text);
  if (!raw.length) return { rows: [], headers: [] };

  raw[0].forEach((h) => headers.push(String(h || "").trim()));

  for (let i = 1; i < raw.length; i++) {
    const arr = raw[i];
    if (!arr || !arr.length) continue;

    const obj = {};
    for (let c = 0; c < headers.length; c++) obj[headers[c]] = arr[c] ?? "";

    const hasAny = Object.values(obj).some((v) => String(v).trim() !== "");
    if (hasAny) rows.push(obj);
  }

  return { rows, headers };
}

function parseCSV(text) {
  const out = [];
  let row = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && (ch === "," || ch === "\n" || ch === "\r")) {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cur);
      cur = "";

      if (ch === "\n" || ch === "\r") {
        if (row.length > 1 || (row[0] && row[0].trim() !== "")) out.push(row);
        row = [];
      }
      continue;
    }

    cur += ch;
  }

  row.push(cur);
  if (row.length > 1 || (row[0] && row[0].trim() !== "")) out.push(row);

  return out;
}
