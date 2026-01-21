/* season26other.js
   Season 26 (Other Flex 1–4) — Summary + Mini Cards

   Adds:
   - "Other Flex Summary" block (like S25 Summary style, no tabs)
   - Top 5 champs (unique games per champ)
   - Multikill totals + top killer per type
   - Nübs per game (avg + distribution)
   - Streak + last updated
*/

const SEASON26OTHER_CSV =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSbxcPDjBBWSe4jIwXuQe-_o5C1RGg067CxU4g_j1yqG8D3DAj8BFqvwKuLopePRuUWv7qE5bmEPuLZ/pub?gid=1960192079&single=true&output=csv";

const START_DATE = new Date(2026, 0, 8); // 08 Jan 2026

// Summary mount id (add <div id="otherflex-summary"></div> in HTML)
const SUMMARY_CONTAINER_ID = "otherflex-summary";

// Your roster (real Riot names)
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

// Avatar overrides
const AVATAR_MAP = {
  BurningElf: "burningelf.svg",
  "Yung Sweeney": "sweeney.svg",
  Betzhamo: "betzhamo.svg",
  Emorek: "emorek.svg",
  denotes: "denotes.svg",
  UnbreakableHaide: "hh.svg",
  "Amazing Cholo": "jansen.svg",
};

// Dot colors
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

document.addEventListener("DOMContentLoaded", init);

async function init() {
  injectMiniCardStyles();

  const statusEl = document.getElementById("status");
  const cardsEl = document.getElementById("flex-cards");
  if (!cardsEl) return;

  try {
    if (statusEl) statusEl.textContent = "Loading Season26other CSV…";

    await resolveNoiseBackgrounds();

    const csvText = await fetchTextWithDebug(SEASON26OTHER_CSV);
    const { rows, headers } = parseCSVToObjects(csvText);

    console.log("CSV loaded:", {
      rowCount: rows.length,
      headers: headers.slice(0, 25),
      sampleRow: rows[0] || null,
    });

    const filtered = rows
      .filter((r) => isOnOrAfterStart(r))
      .filter((r) => isNubRow(r)); // keep nubs only

    // ✅ TPI (Season 26)
    renderTotalPlayerImpact26(filtered);

    // ✅ Team Synergy & Identity (Season 26) — timeline optional
    // Make sure your HTML has: <div id="team-synergy"></div>
    renderTeamSynergy26(filtered, []); // pass [] for now (no timeline)

    // ✅ Summary block
    renderOtherFlexSummary(filtered);

    // ✅ Mini cards
    const players = buildPlayerMiniCards(filtered);
    renderMiniCards(cardsEl, players);

    // ✅ NEW: match list card
    renderOtherFlexMatchList(filtered);

    if (statusEl) {
      statusEl.innerHTML = `Loaded <span class="font-semibold">${filtered.length}</span> rows · <span class="font-semibold">${players.length}</span> players`;
    }

    console.log("mini-cards ready", { rows: filtered.length, players });
  } catch (err) {
    console.error(err);
    if (statusEl) statusEl.textContent = `Error loading data: ${err.message || err}`;
    cardsEl.innerHTML = fallbackCard("Season 26 — Player Cards", "Failed to load CSV. Check console/network.");
  }
}
// renders


    

// ---------- Styles injection ----------
function injectMiniCardStyles() {
  if (document.getElementById("s26other-mini-style")) return;

  const style = document.createElement("style");
  style.id = "s26other-mini-style";
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

// ---------- Fetch ----------
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

// ---------- Noise backgrounds ----------
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

// ---------- Filters ----------
function isOnOrAfterStart(row) {
  const d = parseDateEU(row["Date"] || row["DATE"]);
  if (!d) return true;
  return d >= START_DATE;
}

function isNubRow(row) {
  const nub = boolish(row["Is Nub"]);
  if (nub) return true;
  const name = getPlayerName(row);
  return ROSTER.includes(name);
}

// ---------- Parsing helpers ----------
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

function boolish(v) {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "y";
}

function num(v) {
  if (v === null || v === undefined || v === "") return 0;
  const n = parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function toPercentMaybe(v) {
  let x = num(v);
  if (x > 0 && x <= 1.01) x *= 100;
  return x;
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

// ---------- Columns ----------
function getPlayerName(row) {
  return String(row["p.riotIdGameName"] || row["Player"] || "").trim();
}

function getChampion(row) {
  return String(row["Champion"] || row["p.championName"] || "").trim();
}

function getRole(row) {
  const raw =
    row["ROLE"] ??
    row["Role"] ??
    row["p.teamPosition"] ??
    row["p.individualPosition"] ??
    row["teamPosition"] ??
    "";
  return normRole(String(raw || ""));
}

function normRole(r) {
  const raw = String(r || "").trim().toUpperCase();
  if (!raw) return "UNKNOWN";
  if (raw.includes("TOP")) return "TOP";
  if (raw.includes("JUNG")) return "JUNGLE";
  if (raw.includes("MID")) return "MIDDLE";
  if (raw.includes("BOT") || raw.includes("BOTTOM") || raw.includes("ADC")) return "BOTTOM";
  if (raw.includes("SUP") || raw.includes("UTIL")) return "SUPPORT";
  return raw;
}

function getMatchId(row) {
  return String(
    row["Match ID"] ||
      row["MatchID"] ||
      row["Game ID"] ||
      row["Game #"] ||
      row["Date"] ||
      ""
  ).trim();
}

function isWin(row) {
  return String(row["Result"] || "").trim().toLowerCase() === "win";
}

function avatarFor(name) {
  const file = AVATAR_MAP[name] || "default.svg";
  return `assets/avatars/${file}`;
}

function noiseForPlayer(name) {
  if (!RESOLVED_NOISE_URLS.length) return "";
  const idx = hashStr(name) % RESOLVED_NOISE_URLS.length;
  return RESOLVED_NOISE_URLS[idx];
}

function hashStr(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

function escapeHTML(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ============================================================================
// ✅ OTHER FLEX SUMMARY (no tabs)
// ============================================================================

function renderOtherFlexSummary(rows) {
  const mount = document.getElementById(SUMMARY_CONTAINER_ID);
  if (!mount) return;

  if (!rows.length) {
    mount.innerHTML = "";
    return;
  }

  // Group rows by match
  const matchMap = new Map(); // id -> {id, date, win, timeMin, nubSet:Set, rows:[]}
  for (const r of rows) {
    const id = getMatchId(r);
    if (!id) continue;

    const d = parseDateEU(r["Date"]);
    const w = isWin(r);

    if (!matchMap.has(id)) {
      matchMap.set(id, {
        id,
        date: d,
        win: w,
        timeMin: parseTimeMin(r),
        nubSet: new Set(),
        rows: [],
      });
    }

    const m = matchMap.get(id);
    m.rows.push(r);
    m.win = m.win || w;
    if (!m.date && d) m.date = d;
    if (!Number.isFinite(m.timeMin)) {
      const tm = parseTimeMin(r);
      if (Number.isFinite(tm)) m.timeMin = tm;
    }
    const name = getPlayerName(r);
    if (name) m.nubSet.add(name);
  }

  const matches = [...matchMap.values()].sort((a, b) => {
    const ta = a.date ? a.date.getTime() : 0;
    const tb = b.date ? b.date.getTime() : 0;
    return ta - tb;
  });

  const totalGames = matches.length;
  const wins = matches.filter((m) => m.win).length;
  const winrate = totalGames ? ((wins / totalGames) * 100).toFixed(1) : "0.0";

  const totalKills = rows.reduce((s, r) => s + num(r["Kills"]), 0);
  const totalDeaths = rows.reduce((s, r) => s + num(r["Deaths"]), 0);
  const totalAssists = rows.reduce((s, r) => s + num(r["Assists"]), 0);

  const teamKDA =
    totalDeaths > 0 ? ((totalKills + totalAssists) / totalDeaths).toFixed(2) : totalKills + totalAssists > 0 ? "∞" : "0.00";

  // Avg time
  const timeVals = matches.map((m) => m.timeMin).filter((x) => Number.isFinite(x));
  const avgTime = timeVals.length ? (timeVals.reduce((a, b) => a + b, 0) / timeVals.length).toFixed(1) : "—";

  // Avg KP (per match avg of nub KPs)
  const kpPerMatch = [];
  for (const m of matches) {
    const vals = m.rows
      .map((r) => toPercentMaybe(r["Kill Part %"]))
      .filter((x) => Number.isFinite(x) && x > 0);
    if (vals.length) kpPerMatch.push(vals.reduce((a, b) => a + b, 0) / vals.length);
  }
  const avgKP = kpPerMatch.length ? (kpPerMatch.reduce((a, b) => a + b, 0) / kpPerMatch.length).toFixed(1) : "0.0";

  // Nübs per game + distribution
  const nubCounts = matches.map((m) => m.nubSet.size);
  const avgNubs = nubCounts.length ? (nubCounts.reduce((a, b) => a + b, 0) / nubCounts.length).toFixed(2) : "0.00";
  const dist = { 1: 0, 2: 0, 3: 0, 4: 0 };
  nubCounts.forEach((c) => {
    if (c >= 1 && c <= 4) dist[c]++;
  });

  const topSquadSize = (() => {
    const entries = Object.entries(dist).sort((a, b) => b[1] - a[1]);
    return entries.length ? `${entries[0][0]} Nübs` : "—";
  })();

  // Current streak
  let streakType = null; // true=win false=loss
  let streakCount = 0;
  for (let i = matches.length - 1; i >= 0; i--) {
    const cur = matches[i].win;
    if (streakType === null) {
      streakType = cur;
      streakCount = 1;
    } else if (cur === streakType) {
      streakCount++;
    } else {
      break;
    }
  }
  const streakLabel = streakType === true ? "Currently on a Winning Streak" : "Currently on a Losing Streak";
  const streakValue = `${streakCount || 0} Games`;

  // Last updated
  const lastDate = rows
    .map((r) => parseDateEU(r["Date"]))
    .filter((d) => d instanceof Date && !isNaN(d.getTime()))
    .sort((a, b) => a - b)
    .pop();

  const lastUpdated = lastDate
    ? lastDate.toLocaleString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  // Fun facts
  let mostPink = { value: 0, player: "—" };
  let highestVision = { value: 0, player: "—" };
  let highestDamage = { value: 0, player: "—" };

  rows.forEach((r) => {
    const player = getPlayerName(r) || r["Player"] || "Unknown";
    const pink = num(r["PINK"]) || num(r["p.detectorWardsPlaced"]) || num(r["Control Wards Purchased"]);
    if (pink > mostPink.value) mostPink = { value: pink, player };

    const vs = num(r["Vision Score"]) || num(r["p.visionScore"]);
    if (vs > highestVision.value) highestVision = { value: vs, player };

    const dmg = num(r["Damage Dealt"]) || num(r["p.totalDamageDealtToChampions"]);
    if (dmg > highestDamage.value) highestDamage = { value: dmg, player };
  });

  // Most played champs (Top 5) — count unique games
  const champGameMap = new Map(); // champ -> Set(matchId)
  rows.forEach((r) => {
    const champ = getChampion(r);
    const gid = getMatchId(r);
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
        ${topChamps
          .map((c, i) => `<div>${i + 1}. ${escapeHTML(c.champ)} <span class="text-gray-400">(${c.games})</span></div>`)
          .join("")}
      </div>`
    : `<span class="text-xs text-gray-400">No champion data</span>`;

  // Multikill totals + top killer per type
  const killTypes = [
    { key: "p.doubleKills", label: "Double Kill", short: "D" },
    { key: "p.tripleKills", label: "Triple Kill", short: "T" },
    { key: "p.quadraKills", label: "Quadra Kill", short: "Q" },
    { key: "p.pentaKills", label: "Penta Kill", short: "P" },
  ];

  const killData = killTypes.map((kt) => {
    let total = 0;
    const playerCounts = new Map();

    rows.forEach((r) => {
      const v = num(r[kt.key] ?? r[kt.key.replace("p.", "")] ?? r[`${kt.label}s`] ?? r[kt.label]);
      if (!v) return;
      total += v;
      const name = getPlayerName(r) || r["Player"] || "Unknown";
      playerCounts.set(name, (playerCounts.get(name) || 0) + v);
    });

    const top = [...playerCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    const footer =
      total > 0 && top
        ? `<span class="text-xs text-gray-500 font-normal">Top: ${escapeHTML(top[0])} (${top[1]})</span>`
        : `<span class="text-xs text-gray-400 font-normal">No top ${kt.label.toLowerCase()} killer</span>`;

    return { label: kt.label, total, footer };
  });

  // Build HTML
  mount.innerHTML = `
    <section class="section-wrapper fade-in mb-8">
      <div class="dashboard-card bg-white shadow-sm rounded-2xl border border-orange-50 p-4">
        <div class="flex items-center justify-between mb-4 gap-3">
          <div>
            <h2 class="text-[1.1rem] font-semibold text-orange-500 tracking-tight">
              Season 26 — Other Flex Summary
            </h2>
            <div class="text-xs text-gray-500">
              Ranked Flex games with <span class="font-semibold">1–4 Nübs</span> (not full 5-stack)
            </div>
          </div>

          <span class="text-[0.7rem] font-extrabold px-3 py-1 rounded-full"
            style="border:1px solid rgba(231,175,178,0.9); background: rgba(231,175,178,0.22); color:#ff8000;">
            Flex
          </span>
        </div>

        <!-- Core -->
        <div class="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          ${renderSummaryMiniCard(
            "Games",
            totalGames,
            "text-lg font-semibold",
            `<div class="text-xs text-gray-500 mt-1">1: ${dist[1]} · 2: ${dist[2]} · 3: ${dist[3]} · 4: ${dist[4]}</div>`
          )}
          ${renderSummaryMiniCard("Winrate", `${winrate}%`)}
          ${renderSummaryMiniCard("Avg. Nübs / Game", avgNubs)}
          ${renderSummaryMiniCard("Nübs KDA", teamKDA)}
          ${renderSummaryMiniCard("Avg. Time", `${avgTime} min`)}
        </div>

        <!-- Second row -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          ${renderSummaryMiniCard("Avg. Kill Participation", `${avgKP}%`)}
          ${renderSummaryMiniCard(streakLabel, streakValue)}
          ${renderSummaryMiniCard("Top Squad Size", topSquadSize)}
          ${renderSummaryMiniCard("Last Updated", lastUpdated, "text-sm")}
        </div>

        <!-- Fun facts + Top 5 champs -->
        <div class="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-6">
          ${renderSummaryMiniCard(
            "Most Pink Wards in a Game",
            mostPink.value ? mostPink.value : "—",
            "text-lg font-semibold",
            mostPink.value ? `<span class="text-xs text-gray-500">by ${escapeHTML(mostPink.player)}</span>` : `<span class="text-xs text-gray-400">No data</span>`
          )}
          ${renderSummaryMiniCard(
            "Highest Vision Score",
            highestVision.value ? highestVision.value : "—",
            "text-lg font-semibold",
            highestVision.value ? `<span class="text-xs text-gray-500">by ${escapeHTML(highestVision.player)}</span>` : `<span class="text-xs text-gray-400">No data</span>`
          )}
          ${renderSummaryMiniCard(
            "Highest Damage Dealt",
            highestDamage.value ? highestDamage.value.toLocaleString("en-US") : "—",
            "text-lg font-semibold",
            highestDamage.value ? `<span class="text-xs text-gray-500">by ${escapeHTML(highestDamage.player)}</span>` : `<span class="text-xs text-gray-400">No data</span>`
          )}
          ${renderSummaryMiniCard(
            "Most Played Champions (Top 5)",
            topChamps.length ? "Top picks" : "—",
            "text-xs font-semibold text-gray-600",
            topChampsFooter
          )}
        </div>

        <!-- Multikills -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          ${killData
            .map((k) => renderSummaryMiniCard(k.label, k.total, "text-lg font-semibold", k.footer))
            .join("")}
        </div>
      </div>
    </section>
  `;
}

function renderSummaryMiniCard(label, value, valueClass = "text-lg font-semibold", footer = "") {
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

// ============================================================================
// 🧩 MINI CARDS — Player Aggregates + Rendering (compact / chip-first)
// - buildPlayerMiniCards(): aggregates per roster member (from match rows)
// - renderMiniCards(): renders the grid
// - renderPlayerCard(): generates ONE compact card HTML
// ============================================================================

function getVisionScore(row) {
  // Match sheet usually has "Vision Score" (derived) and also "p.visionScore" (raw)
  return num(row["Vision Score"] ?? row["p.visionScore"] ?? row["visionScore"]);
}

function getFirstBloodFlags(row) {
  // Riot participant fields are booleans; sheets often store as True/False strings
  const fbk = boolish(row["p.firstBloodKill"] ?? row["firstBloodKill"] ?? row["First Blood Kill"]);
  const fba = boolish(row["p.firstBloodAssist"] ?? row["firstBloodAssist"] ?? row["First Blood Assist"]);
  return { fbk, fba };
}

function buildPlayerMiniCards(rows) {
  const byPlayer = new Map();

  rows.forEach((r) => {
    const name = getPlayerName(r);
    if (!name) return;
    if (!ROSTER.includes(name)) return;

    const matchId = getMatchId(r);
    const dateObj = parseDateEU(r["Date"]);
    const champ = getChampion(r);
    const role = getRole(r);
    const win = isWin(r);

    if (!byPlayer.has(name)) {
      byPlayer.set(name, {
        name,
        gameMap: new Map(), // unique games keyed by matchId (fallback safe)
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

    // ---- unique game key (fallback-safe) ----
    const key = matchId || `${name}|${String(r["Date"] || "")}|${champ}|${role}`;

    // Only count “per game” stats once (roles/champs/vision/first blood/last10)
    if (!p.gameMap.has(key)) {
      const vision = getVisionScore(r);
      const { fbk, fba } = getFirstBloodFlags(r);

      p.gameMap.set(key, {
        win,
        date: dateObj,
        role,
        champ,
        vision,
        fbk,
        fba,
      });

      if (role && role !== "UNKNOWN") p.roles.set(role, (p.roles.get(role) || 0) + 1);
      if (champ) p.champs.set(champ, (p.champs.get(champ) || 0) + 1);
    }

    // ---- combat totals (these are already per-game rows, so summing is fine) ----
    p.kills += num(r["Kills"]);
    p.deaths += num(r["Deaths"]);
    p.assists += num(r["Assists"]);

    // ---- multikills ----
    p.doubleKills += num(r["p.doubleKills"] ?? r["doubleKills"] ?? r["Double Kills"]);
    p.tripleKills += num(r["p.tripleKills"] ?? r["tripleKills"] ?? r["Triple Kills"]);
    p.quadraKills += num(r["p.quadraKills"] ?? r["quadraKills"] ?? r["Quadra Kills"]);
    p.pentaKills += num(r["p.pentaKills"] ?? r["pentaKills"] ?? r["Penta Kills"]);

    // ---- pings ----
    p.enemyMissingPings += num(r["p.enemyMissingPings"] ?? r["enemyMissingPings"]);
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
      .map(([role, count]) => ({
        role,
        count,
        share: games ? (count / games) * 100 : 0,
      }));

    // ---- last 10 ----
    const last10 = gamesArr.slice(-10);
    const last10Dots = last10.map((g) => (g.win ? "win" : "loss"));

    // ---- vision avg (per game) ----
    const visionTotal = gamesArr.reduce((s, g) => s + num(g.vision), 0);
    const visionAvg = games ? visionTotal / games : 0;

    // ---- first blood (games with FB kill / FB assist) ----
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
      multikills: {
        d: p.doubleKills,
        t: p.tripleKills,
        q: p.quadraKills,
        p: p.pentaKills,
      },
      enemyMissingPings: p.enemyMissingPings,
    };
  });

  out.sort((a, b) => b.games - a.games || b.kda - a.kda);
  return out;
}

function renderMiniCards(container, players) {
  container.classList.add("justify-items-center");

  if (!players.length) {
    container.innerHTML = fallbackCard("Season 26 — Player Cards", "No player data found in scope.");
    return;
  }

  container.innerHTML = players.map(renderPlayerCard).join("");
}

// ============================================================================
// 🎨 MINI CARD UI (compact layout)
// + NEW: Vision avg + First Blood chips row
// ============================================================================
function renderPlayerCard(p) {
  const wrTone =
    p.wr >= 60 ? "text-emerald-600" : p.wr <= 45 ? "text-rose-500" : "text-slate-900";

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
    ? p.topRoles
        .map((r) => smallChip(`${escapeHTML(r.role)} <span class="text-slate-500">${r.share.toFixed(0)}%</span>`))
        .join("")
    : `<span class="text-[0.65rem] text-slate-400">—</span>`;

  const champChips = p.topChamps.length
    ? p.topChamps
        .map((c) => smallChip(`${escapeHTML(c.champ)} <span class="text-slate-500">(${c.count})</span>`))
        .join("")
    : `<span class="text-[0.65rem] text-slate-400">—</span>`;

  // last 10 dots
  const dots = [];
  for (let i = 0; i < 10; i++) dots.push(p.last10Dots[i] || "empty");
  const latestIdx = p.last10Dots.length ? p.last10Dots.length - 1 : -1;

  const dotsHTML = dots
    .map((state, idx) => {
      const cls = state === "win" ? "win" : state === "loss" ? "loss" : "";
      const latest = idx === latestIdx ? "latest" : "";
      return `<span class="s26-dot ${cls} ${latest}"></span>`;
    })
    .join("");

  const bgUrl = noiseForPlayer(p.name);
  const overlayAlpha = 0.38;

  const mk = p.multikills || { d: 0, t: 0, q: 0, p: 0 };
  const mkChip = (k, v) => `
    <span class="mk-chip" title="${k} kills">
      <span class="k">${k}</span>${v}
    </span>
  `;

  const fb = p.firstBlood || { kill: 0, assist: 0 };

  return `
    <div
      class="mini-card glass3d relative overflow-hidden rounded-[24px] border border-slate-200/80 shadow-md w-full max-w-[330px]"
      style="
        background-image:${bgUrl ? `url('${bgUrl}')` : "none"};
        background-size: cover;
        background-position: center;
        --dot-win:${DOT_COLORS.win};
        --dot-loss:${DOT_COLORS.loss};
        --dot-empty:${DOT_COLORS.empty};
        --dot-ring:#ff8000;
      "
    >
      <div class="absolute inset-0" style="background: rgba(255,255,255,${overlayAlpha});"></div>

      <div class="relative p-3">
        <!-- Header -->
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2.5 min-w-0">
            <div class="w-10 h-10 rounded-2xl border border-slate-200 bg-white overflow-hidden shrink-0">
              <img
                src="${avatarFor(p.name)}"
                alt="${escapeHTML(p.name)} avatar"
                class="w-full h-full object-contain object-center block"
                onerror="this.onerror=null; this.src='assets/avatars/default.svg';"
              />
            </div>

            <div class="min-w-0">
              <div class="flex items-center gap-2 min-w-0">
                <div class="text-[1.0rem] font-semibold text-slate-900 truncate">
                  ${escapeHTML(p.name)}
                </div>
                <span class="shrink-0 text-[0.65rem] font-semibold px-2 py-[2px] rounded-full border border-slate-200 bg-white/70 text-slate-700">
                  ${p.games}g
                </span>
              </div>

              <div class="text-[0.7rem] text-slate-600 leading-tight">
                Other Flex (1–4)
              </div>
            </div>
          </div>

          <span class="shrink-0 text-[0.65rem] font-extrabold px-2.5 py-[4px] rounded-full"
            style="border:1px solid rgba(231,175,178,0.9); background: rgba(231,175,178,0.22); color:#ff8000;">
            Flex
          </span>
        </div>

        <!-- Stat chips -->
        <div class="mt-2.5 grid grid-cols-3 gap-2">
          ${chip("KDA", p.kda.toFixed(2))}
          ${chip("WR", `${p.wr.toFixed(1)}%`, wrTone)}
          ${chip("K/D/A", `${p.kills}/${p.deaths}/${p.assists}`, "text-slate-900")}
        </div>

        <!-- NEW: Vision + First Blood -->
        <div class="mt-2 grid grid-cols-2 gap-2">
          ${chip("Vision avg", p.visionAvg.toFixed(1))}
          ${chip("First Blood", `${fb.kill}K ${fb.assist}A`, "text-slate-900")}
        </div>

        <!-- Last 10 -->
        <div class="mt-2.5 flex items-center justify-between gap-2">
          <div class="text-[0.65rem] uppercase tracking-wide text-slate-500">Last 10</div>
          <div class="flex items-center gap-1.5">${dotsHTML}</div>
        </div>

        <!-- Roles + Champs -->
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

        <!-- Footer -->
        <div class="mt-3 rounded-2xl border border-slate-200 bg-white/75 px-2.5 py-2">
          <div class="flex items-center justify-between gap-2">
            <div class="text-[0.65rem] uppercase tracking-wide text-slate-500">Multikills</div>
            <div class="flex items-center gap-1">
              ${mkChip("D", mk.d)}
              ${mkChip("T", mk.t)}
              ${mkChip("Q", mk.q)}
              ${mkChip("P", mk.p)}
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

function fallbackCard(title, msg) {
  return `
    <div class="glass3d mini-card p-4 max-w-[420px]">
      <div class="text-sm font-semibold text-sky-600">${title}</div>
      <div class="text-xs text-slate-500 mt-1">${msg}</div>
    </div>
  `;
}

// ============================================================================
// ⭐ TOTAL PLAYER IMPACT (Season 26) — v2.1
// Trend (Δ) = Last Match score (single game) vs Season Baseline (season excluding last match)
//
// - Main TPI shown = season score on ALL season games in scope (incl. last match)
// - Trend shown = last match score (no shrink) minus baseline score (shrink) excluding last match
// - Last match picked by max(Date) per Match ID (fallback: Match ID string)
// ============================================================================

// ---------- TPI Config (edit here, not inside logic) ----------
const TPI26 = {
  BASE: 40,
  WINSOR_P: 0.05,
  MIN_GAMES_FLOOR: 5,
  SHRINK_FRACTION_OF_MAX: 0.30,

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
    indiv: {
      kda: 0.18, kp: 0.18, dmgShare: 0.18, dpm: 0.14, goldMin: 0.14, csMin: 0.10, firstBlood: 0.08,
    },
    obj: {
      objKills: 0.38, objPart: 0.30, plates: 0.16, objDmg: 0.16,
    },
    vision: {
      vsMin: 0.30, wardsMin: 0.16, wardsKilledMin: 0.20, denial: 0.18, enemyJunglePct: 0.10, pinkEff: 0.06,
    },
    reli: {
      consistency: 0.22, momentum: 0.18, macroCons: 0.18, perfRating: 0.18, timeDeadRateSafe: 0.14, deathDistSafe: 0.10,
    },
  },

  // Trend thresholds (feel free to tweak)
  TREND_UP: 1.0,
  TREND_DOWN: -1.0,
};

// ---------- Public render ----------
function renderTotalPlayerImpact26(rows, opts = {}) {
  const mountId = opts.mountId || "objective-impact";
  const mount = document.getElementById(mountId);
  if (!mount) {
    console.warn(`[TPI26] Mount #${mountId} not found. Add <div id="${mountId}"></div> to HTML.`);
    return;
  }
  if (!rows || !rows.length) {
    mount.innerHTML = tpiFallback("Total Player Impact", "No data rows provided.");
    return;
  }

  const roster = Array.isArray(opts.roster) ? opts.roster : null;
  const scoped = roster ? rows.filter((r) => roster.includes(getPlayerNameAny(r))) : rows.slice();

  if (!scoped.length) {
    mount.innerHTML = tpiFallback("Total Player Impact", "No players found in scope.");
    return;
  }

  // ---- determine last match ----
  const lastMatchId = getLatestMatchId26(scoped);
  const baselineRows = lastMatchId ? scoped.filter((r) => getMatchIdAny(r) !== lastMatchId) : scoped.slice();
  const lastRows = lastMatchId ? scoped.filter((r) => getMatchIdAny(r) === lastMatchId) : [];

  // ---- season score (ALL games) ----
  const seasonRaw = buildTPIPlayers26Raw(scoped);
  const seasonRes = scoreTPIPlayers26(seasonRaw, { applyShrink: true });
  const seasonPlayers = seasonRes.players;

  // ---- baseline score (season excluding last match) ----
  let baselineImpactMap = new Map();
  let normCtxForLast = seasonRes.normCtx;

  if (baselineRows.length) {
    const baseRaw = buildTPIPlayers26Raw(baselineRows);
    const baseRes = scoreTPIPlayers26(baseRaw, { applyShrink: true });
    baselineImpactMap = new Map(baseRes.players.map((p) => [p.name, p.impact]));
    normCtxForLast = baseRes.normCtx; // IMPORTANT: normalize last game vs "other games" bounds
  }

  // ---- last match score (single game, no shrink) ----
  const lastImpactMap = new Map();
  if (lastRows.length) {
    const lastRaw = buildTPIPlayers26SingleMatch(lastRows);
    const lastRes = scoreTPIPlayers26(lastRaw, { applyShrink: false, normCtx: normCtxForLast });
    lastRes.players.forEach((p) => lastImpactMap.set(p.name, p.impact));
  }

  // ---- attach TREND to season players ----
  seasonPlayers.forEach((p) => {
    const last = lastImpactMap.get(p.name);
    const base = baselineImpactMap.get(p.name);

    // show trend only if:
    // - player played last match
    // - and we have a baseline excluding last match for them
    if (typeof last === "number" && typeof base === "number") {
      p.delta = last - base;
      p.playedLast = true;
      p.trendOk = true;
    } else if (typeof last === "number") {
      p.delta = null;      // no baseline yet
      p.playedLast = true; // did play last match
      p.trendOk = false;
    } else {
      p.delta = null;      // didn’t play last match
      p.playedLast = false;
      p.trendOk = false;
    }
  });

  // Render
  renderTPICard26(mount, seasonPlayers, { lastMatchId });
}

// ============================================================================
// 1) Build per-player aggregates (season aggregates)
// ============================================================================
function buildTPIPlayers26Raw(rows) {
  const byPlayer = new Map();

  rows.forEach((r) => {
    const name = getPlayerNameAny(r);
    if (!name) return;

    const matchId = getMatchIdAny(r);
    if (!matchId) return;

    const role = normRole(getRoleAny(r));
    const won = isWinAny(r);

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

    const kills = toNum(getAny(r, ["Kills", "p.kills", "kills"]));
    const deaths = toNum(getAny(r, ["Deaths", "p.deaths", "deaths"]));
    const assists = toNum(getAny(r, ["Assists", "p.assists", "assists"]));
    p.kills += kills; p.deaths += deaths; p.assists += assists;

    const kpRaw = toNum(getAny(r, ["Kill Part %", "p.challenges.killParticipation", "killParticipation"]));
    if (kpRaw > 0) {
      const kpPct = kpRaw <= 1.01 ? kpRaw * 100 : kpRaw;
      p.kpSum += kpPct;
      p.kpCount += 1;
    }

    const dmgShareRaw = toNum(getAny(r, ["Team Damage %", "Damage Share %", "p.challenges.teamDamagePercentage", "teamDamagePercentage"]));
    const dmgSharePct = dmgShareRaw <= 1.01 && dmgShareRaw > 0 ? dmgShareRaw * 100 : dmgShareRaw;
    p.dmgShareSum += dmgSharePct;

    p.dpmSum += toNum(getAny(r, ["Damage per Minute", "p.challenges.damagePerMinute", "damagePerMinute"]));
    p.goldMinSum += toNum(getAny(r, ["Gold/min", "p.challenges.goldPerMinute", "goldPerMinute"]));

    // CS/min: try direct, else compute from CS & time
    const csMinDirect = toNum(getAny(r, ["CS/min", "csPerMinute"]));
    if (csMinDirect > 0) {
      p.csMinSum += csMinDirect;
    } else {
      const cs = toNum(getAny(r, ["CS", "p.totalMinionsKilled", "totalMinionsKilled"]));
      const tpSec = toNum(getAny(r, ["p.timePlayed", "timePlayed"]));
      const tMin = tpSec > 0 ? tpSec / 60 : Math.max(1, toNum(getAny(r, ["TIME"])));
      p.csMinSum += tMin > 0 ? (cs / tMin) : 0;
    }

    const fbKill = boolish(getAny(r, ["p.firstBloodKill", "firstBloodKill"]));
    const fbAssist = boolish(getAny(r, ["p.firstBloodAssist", "firstBloodAssist"]));
    if ((fbKill || fbAssist) && !p.fbGamesSet.has(matchId)) {
      p.fbGamesSet.add(matchId);
      p.firstBloodInvolv += 1;
    }

    p.objKillsSum += toNum(getAny(r, ["Objective Kills", "p.challenges.objectiveKills", "objectiveKills"]));
    p.objPartDragon += toNum(getAny(r, ["Dragon Participation"]));
    p.objPartHerald += toNum(getAny(r, ["Herald Participation"]));
    p.objPartBaron += toNum(getAny(r, ["Baron Participation"]));
    p.objPartTower += toNum(getAny(r, ["Tower Participation"]));
    p.objPartAtakhan += toNum(getAny(r, ["Atakhan Participation"]));
    p.objPartVoid += toNum(getAny(r, ["Void Grub Participation"]));

    p.platesSum += toNum(getAny(r, ["Turret Plates Taken", "p.challenges.turretPlatesTaken", "turretPlatesTaken"]));
    p.objDmgSum += toNum(getAny(r, ["p.damageDealtToObjectives", "damageDealtToObjectives"]));

    p.visionScoreSum += toNum(getAny(r, ["Vision Score", "p.visionScore", "visionScore"]));
    const tp = toNum(getAny(r, ["p.timePlayed", "timePlayed"]));
    p.timePlayedSum += tp > 0 ? tp : 0;

    p.wardsPlacedSum += toNum(getAny(r, ["WARDS", "Wards", "p.wardsPlaced", "wardsPlaced"]));
    p.wardsKilledSum += toNum(getAny(r, ["WARDS KILLED", "p.wardsKilled", "wardsKilled"]));
    p.denialSum += toNum(getAny(r, ["Vision Denial Efficiency"]));
    p.enemyJunglePctSum += toNum(getAny(r, ["Wards in Enemy Jungle %"]));
    p.pinkEffSum += toNum(getAny(r, ["Pink Efficiency"]));

    p.consistencySum += toNum(getAny(r, ["Consistency Index"]));
    p.momentumSum += toNum(getAny(r, ["Momentum Stability"]));
    p.macroConsSum += toNum(getAny(r, ["Macro Consistency"]));
    p.perfRatingSum += toNum(getAny(r, ["Performance Rating", "p.challenges.performanceRating", "performanceRating"]));

    p.timeDeadSum += toNum(getAny(r, ["p.totalTimeSpentDead", "totalTimeSpentDead"]));
    p.deathDistSum += toNum(getAny(r, ["Average Death Distance"]));
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
      TPI26.OBJ_PART_WEIGHTS.Dragon  * (p.objPartDragon / games) +
      TPI26.OBJ_PART_WEIGHTS.Herald  * (p.objPartHerald / games) +
      TPI26.OBJ_PART_WEIGHTS.Baron   * (p.objPartBaron / games) +
      TPI26.OBJ_PART_WEIGHTS.Tower   * (p.objPartTower / games) +
      TPI26.OBJ_PART_WEIGHTS.Atakhan * (p.objPartAtakhan / games) +
      TPI26.OBJ_PART_WEIGHTS.VoidGrub* (p.objPartVoid / games);

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

    const roleBreakdown = buildRoleBreakdown(p.roleFreq);

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
      delta: null,       // TREND gets injected later
      playedLast: false, // injected later
      trendOk: false,    // injected later
      isGuest: false,
    };
  });
}

// ============================================================================
// 1b) Build player vectors for a SINGLE MATCH (last game only)
// ============================================================================
function buildTPIPlayers26SingleMatch(matchRows) {
  const byPlayer = new Map();

  matchRows.forEach((r) => {
    const name = getPlayerNameAny(r);
    if (!name) return;

    const role = normRole(getRoleAny(r));
    const won = isWinAny(r);

    const kills = toNum(getAny(r, ["Kills", "p.kills", "kills"]));
    const deaths = toNum(getAny(r, ["Deaths", "p.deaths", "deaths"]));
    const assists = toNum(getAny(r, ["Assists", "p.assists", "assists"]));

    const kda = (kills + assists) / Math.max(1, deaths);

    const kpRaw = toNum(getAny(r, ["Kill Part %", "p.challenges.killParticipation", "killParticipation"]));
    const kp = kpRaw > 0 ? (kpRaw <= 1.01 ? kpRaw * 100 : kpRaw) : 0;

    const dmgShareRaw = toNum(getAny(r, ["Team Damage %", "Damage Share %", "p.challenges.teamDamagePercentage", "teamDamagePercentage"]));
    const dmgShare = dmgShareRaw > 0 ? (dmgShareRaw <= 1.01 ? dmgShareRaw * 100 : dmgShareRaw) : 0;

    const dpm = toNum(getAny(r, ["Damage per Minute", "p.challenges.damagePerMinute", "damagePerMinute"]));
    const goldMin = toNum(getAny(r, ["Gold/min", "p.challenges.goldPerMinute", "goldPerMinute"]));

    // CS/min: direct or compute
    let csMin = toNum(getAny(r, ["CS/min", "csPerMinute"]));
    if (!(csMin > 0)) {
      const cs = toNum(getAny(r, ["CS", "p.totalMinionsKilled", "totalMinionsKilled"]));
      const tpSec = toNum(getAny(r, ["p.timePlayed", "timePlayed"]));
      const tMin = tpSec > 0 ? tpSec / 60 : Math.max(1, toNum(getAny(r, ["TIME"])));
      csMin = tMin > 0 ? (cs / tMin) : 0;
    }

    const fbKill = boolish(getAny(r, ["p.firstBloodKill", "firstBloodKill"]));
    const fbAssist = boolish(getAny(r, ["p.firstBloodAssist", "firstBloodAssist"]));
    const firstBloodRate = (fbKill || fbAssist) ? 100 : 0;

    const objPart =
      TPI26.OBJ_PART_WEIGHTS.Dragon  * toNum(getAny(r, ["Dragon Participation"])) +
      TPI26.OBJ_PART_WEIGHTS.Herald  * toNum(getAny(r, ["Herald Participation"])) +
      TPI26.OBJ_PART_WEIGHTS.Baron   * toNum(getAny(r, ["Baron Participation"])) +
      TPI26.OBJ_PART_WEIGHTS.Tower   * toNum(getAny(r, ["Tower Participation"])) +
      TPI26.OBJ_PART_WEIGHTS.Atakhan * toNum(getAny(r, ["Atakhan Participation"])) +
      TPI26.OBJ_PART_WEIGHTS.VoidGrub* toNum(getAny(r, ["Void Grub Participation"]));

    const objKills = toNum(getAny(r, ["Objective Kills", "p.challenges.objectiveKills", "objectiveKills"]));
    const plates = toNum(getAny(r, ["Turret Plates Taken", "p.challenges.turretPlatesTaken", "turretPlatesTaken"]));
    const objDmg = toNum(getAny(r, ["p.damageDealtToObjectives", "damageDealtToObjectives"]));

    const visionScore = toNum(getAny(r, ["Vision Score", "p.visionScore", "visionScore"]));
    const tpSec = toNum(getAny(r, ["p.timePlayed", "timePlayed"]));
    const timeMin = Math.max(1, (tpSec > 0 ? tpSec / 60 : Math.max(1, toNum(getAny(r, ["TIME"])))));

    const vsMin = visionScore / timeMin;
    const wardsMin = toNum(getAny(r, ["WARDS", "Wards", "p.wardsPlaced", "wardsPlaced"])) / timeMin;
    const wardsKilledMin = toNum(getAny(r, ["WARDS KILLED", "p.wardsKilled", "wardsKilled"])) / timeMin;

    const denial = toNum(getAny(r, ["Vision Denial Efficiency"]));
    const enemyJunglePct = toNum(getAny(r, ["Wards in Enemy Jungle %"]));
    const pinkEff = toNum(getAny(r, ["Pink Efficiency"]));

    const consistency = toNum(getAny(r, ["Consistency Index"]));
    const momentum = toNum(getAny(r, ["Momentum Stability"]));
    const macroCons = toNum(getAny(r, ["Macro Consistency"]));
    const perfRating = toNum(getAny(r, ["Performance Rating", "p.challenges.performanceRating", "performanceRating"]));

    const timeDead = toNum(getAny(r, ["p.totalTimeSpentDead", "totalTimeSpentDead"]));
    const timeDeadRate = (tpSec > 0) ? (timeDead / tpSec) : 0;

    const deathDist = toNum(getAny(r, ["Average Death Distance"]));

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
      isGuest: false,
    });
  });

  return [...byPlayer.values()];
}

// ============================================================================
// 2) Scoring (supports external normalization context)
// ============================================================================
function scoreTPIPlayers26(players, opts = {}) {
  if (!players.length) return { players: [], normCtx: null, minGamesFull: 0 };

  const applyShrink = opts.applyShrink !== false;
  const normCtx = opts.normCtx || buildTPI26NormCtx(players);

  const normMetric = (k, v, invert = false) => {
    const b = normCtx.bounds[k] || { lo: 0, hi: 1 };
    const mm = normCtx.minmax[k] || { min: 0, max: 1 };

    const w = clamp(winsorize(v, b.lo, b.hi), b.lo, b.hi);
    const x = mm.max === mm.min ? 0.5 : (w - mm.min) / (mm.max - mm.min);
    const clamped = clamp(x, 0, 1);
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
      TPI26.METRIC_WEIGHTS.indiv.kda * nKDA +
      TPI26.METRIC_WEIGHTS.indiv.kp * nKP +
      TPI26.METRIC_WEIGHTS.indiv.dmgShare * nDmg +
      TPI26.METRIC_WEIGHTS.indiv.dpm * nDPM +
      TPI26.METRIC_WEIGHTS.indiv.goldMin * nGold +
      TPI26.METRIC_WEIGHTS.indiv.csMin * nCS +
      TPI26.METRIC_WEIGHTS.indiv.firstBlood * nFB;

    const nObjKills = normMetric("objKills", R.objKills);
    const nObjPart = normMetric("objPart", R.objPart);
    const nPlates = normMetric("plates", R.plates);
    const nObjDmg = normMetric("objDmg", R.objDmg);

    p.pillar.obj =
      TPI26.METRIC_WEIGHTS.obj.objKills * nObjKills +
      TPI26.METRIC_WEIGHTS.obj.objPart * nObjPart +
      TPI26.METRIC_WEIGHTS.obj.plates * nPlates +
      TPI26.METRIC_WEIGHTS.obj.objDmg * nObjDmg;

    const nVsMin = normMetric("vsMin", R.vsMin);
    const nWMin = normMetric("wardsMin", R.wardsMin);
    const nWKMin = normMetric("wardsKilledMin", R.wardsKilledMin);
    const nDenial = normMetric("denial", R.denial);
    const nEJ = normMetric("enemyJunglePct", R.enemyJunglePct);
    const nPinkEff = normMetric("pinkEff", R.pinkEff);

    p.pillar.vision =
      TPI26.METRIC_WEIGHTS.vision.vsMin * nVsMin +
      TPI26.METRIC_WEIGHTS.vision.wardsMin * nWMin +
      TPI26.METRIC_WEIGHTS.vision.wardsKilledMin * nWKMin +
      TPI26.METRIC_WEIGHTS.vision.denial * nDenial +
      TPI26.METRIC_WEIGHTS.vision.enemyJunglePct * nEJ +
      TPI26.METRIC_WEIGHTS.vision.pinkEff * nPinkEff;

    const nCons = normMetric("consistency", R.consistency);
    const nMom = normMetric("momentum", R.momentum);
    const nMacro = normMetric("macroCons", R.macroCons);
    const nPR = normMetric("perfRating", R.perfRating);
    const nTimeDeadSafe = normMetric("timeDeadRate", R.timeDeadRate, true);
    const nDeathDistSafe = normMetric("deathDist", R.deathDist, true);

    p.pillar.reli =
      TPI26.METRIC_WEIGHTS.reli.consistency * nCons +
      TPI26.METRIC_WEIGHTS.reli.momentum * nMom +
      TPI26.METRIC_WEIGHTS.reli.macroCons * nMacro +
      TPI26.METRIC_WEIGHTS.reli.perfRating * nPR +
      TPI26.METRIC_WEIGHTS.reli.timeDeadRateSafe * nTimeDeadSafe +
      TPI26.METRIC_WEIGHTS.reli.deathDistSafe * nDeathDistSafe;

    const w = blendRolePillarWeights(p.roleBreakdown);
    p.totalRaw = w.indiv * p.pillar.indiv + w.obj * p.pillar.obj + w.vision * p.pillar.vision + w.reli * p.pillar.reli;
  });

  let minGamesFull = 0;
  if (applyShrink) {
    const maxGames = Math.max(...players.map((p) => p.games || 1)) || 1;
    minGamesFull = Math.max(TPI26.MIN_GAMES_FLOOR, Math.round(maxGames * TPI26.SHRINK_FRACTION_OF_MAX));

    const teamMean = players.reduce((s, p) => s + (p.totalRaw || 0.5), 0) / Math.max(1, players.length);

    players.forEach((p) => {
      const g = p.games || 0;
      const sampleFactor = clamp(g / minGamesFull, 0, 1);
      p.totalShrunk = sampleFactor * p.totalRaw + (1 - sampleFactor) * teamMean;
      p.impact = TPI26.BASE + p.totalShrunk * (100 - TPI26.BASE);
      p.isGuest = g < minGamesFull;
    });
  } else {
    players.forEach((p) => {
      p.totalShrunk = p.totalRaw;
      p.impact = TPI26.BASE + p.totalRaw * (100 - TPI26.BASE);
      p.isGuest = false;
    });
  }

  players.sort((a, b) => {
    if ((a.isGuest || false) !== (b.isGuest || false)) return a.isGuest ? 1 : -1;
    return b.impact - a.impact;
  });

  return { players, normCtx, minGamesFull };
}

function buildTPI26NormCtx(players) {
  const metricKeys = Object.keys(players[0].raw || {});
  const metricSeries = {};
  metricKeys.forEach((k) => (metricSeries[k] = players.map((p) => p.raw[k])));

  const bounds = {};
  const minmax = {};
  metricKeys.forEach((k) => {
    bounds[k] = winsorBounds(metricSeries[k], TPI26.WINSOR_P);
    minmax[k] = minmaxOfSeries(metricSeries[k], bounds[k]);
  });

  return { bounds, minmax };
}

// ============================================================================
// 3) UI (compact) — WITH detail panel + explanation accordion (like S25)
// ============================================================================
function renderTPICard26(mount, players, meta = {}) {
  const badge = (score) =>
    score >= 75 ? "text-emerald-600" : score >= 60 ? "text-yellow-600" : "text-rose-600";

  const trendCell = (p) => {
    if (!p.playedLast) {
      return `<span class="text-slate-300" title="Player did not play the most recent match.">•</span>`;
    }
    if (!p.trendOk || typeof p.delta !== "number") {
      return `<span class="text-slate-400" title="Not enough prior games to compare (no baseline excluding last match).">•</span>`;
    }

    const d = p.delta;
    const up = d >= TPI26.TREND_UP;
    const down = d <= TPI26.TREND_DOWN;

    const cls = up ? "text-emerald-600" : down ? "text-rose-600" : "text-slate-400";
    const symbol = up ? "▲" : down ? "▼" : "•";
    const txt = up ? `${symbol}${d.toFixed(1)}` : down ? `${symbol}${Math.abs(d).toFixed(1)}` : "•";

    return `<span class="${cls}" title="Trend = last match impact minus season baseline (excluding last match).">${txt}</span>`;
  };

  const roleChip = (rb, isMain) => {
    const pct = Math.round((rb.share || 0) * 100);
    const g = rb.count || 0;
    const base = "inline-flex items-center px-2 py-0.5 rounded-full text-[0.65rem] border";
    const cls = isMain
      ? "bg-orange-50 text-orange-700 border-orange-200"
      : "bg-white/70 text-slate-700 border-slate-200";
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
             title="Low sample size — season score shrunk toward team mean.">⭐ low sample</span>`
        : "";

      return `
        <tr data-player="${escapeHTML(p.name)}" class="hover:bg-orange-50/40 transition cursor-pointer">
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
            class="px-2.5 py-1 rounded-full text-xs border border-gray-200 hover:border-orange-400 hover:text-orange-500 transition tpi26-player-btn"
            data-player="${escapeHTML(p.name)}">
            ${escapeHTML(p.name)}
          </button>
        `
        )
        .join("")}
    </div>
  `;

  const detailBox = `
    <div id="tpi26-player-detail"
         class="mt-4 px-4 pb-4 hidden opacity-0 translate-y-2 transition-all duration-300 ease-out"></div>
  `;

  const infoBox = `
    <div class="mt-3 px-4 pb-4 border-t pt-3">
      <button
        id="tpi26-toggle-info"
        class="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-orange-600 transition">
        <span>ℹ️ How is Total Player Impact calculated?</span>
        <span id="tpi26-info-arrow" class="transition-transform">▼</span>
      </button>

      <div id="tpi26-info-content" class="hidden text-sm text-gray-600 mt-2 leading-relaxed">
        <p><strong>Total Player Impact</strong> (40–100) is a relative score <em>inside this dataset</em>. It blends 4 pillars:</p>
        <ul class="list-disc ml-5 mt-1 space-y-1">
          <li><strong>Individual</strong>: KDA, KP, damage share, DPM, gold/min, CS/min, first-blood involvement.</li>
          <li><strong>Objectives</strong>: objective kills, weighted objective participation, plates, objective damage.</li>
          <li><strong>Vision</strong>: vision score/min, wards/min, wards killed/min, denial, enemy-jungle warding, pink efficiency.</li>
          <li><strong>Reliability</strong>: consistency + stability + macro consistency + performance rating, with safer death patterns rewarded.</li>
        </ul>
        <p class="mt-2 text-xs text-gray-500">
          Metrics are winsorized (5–95%), normalized inside the dataset, and low-sample season players are shrunk toward the team mean.
          <br/>
          <strong>Trend (Δ)</strong> compares the most recent match to the season baseline (excluding that last match).
        </p>
      </div>
    </div>
  `;

  const lastTag = meta.lastMatchId
    ? `<div class="px-4 pt-2 text-[0.7rem] text-slate-500">Trend reference: <span class="font-semibold">${escapeHTML(meta.lastMatchId)}</span></div>`
    : "";

  mount.innerHTML = `
    <section class="section-wrapper fade-in mb-10">
      <div class="dashboard-card bg-white shadow-sm rounded-2xl border border-gray-100">
        <div class="px-4 pt-4">
          <h2 class="text-[1.1rem] font-semibold text-orange-500 tracking-tight">
            Total Player Impact (Season 26)
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
            Δ is last match vs season baseline (excluding last match). Players not in last match show •.
          </div>
        </div>

        ${playerButtons}
        ${detailBox}
        ${infoBox}
      </div>
    </section>
  `;

  const ctx = buildTPI26Context(players);
  bindTPI26Interactions(mount, players, ctx);
}

// ---------------------------
// Trend: find latest match id
// ---------------------------
function getLatestMatchId26(rows) {
  const matchMeta = new Map(); // id -> maxDateMs

  rows.forEach((r) => {
    const id = getMatchIdAny(r);
    if (!id) return;

    const d = parseDateEUAny26(getAny(r, ["Date", "DATE"]));
    const ms = d ? d.getTime() : 0;

    const prev = matchMeta.get(id);
    if (prev === undefined || ms > prev) matchMeta.set(id, ms);
  });

  if (!matchMeta.size) return "";
  // pick max date; if tie, pick lexicographically largest id (stable)
  return [...matchMeta.entries()]
    .sort((a, b) => (b[1] - a[1]) || String(b[0]).localeCompare(String(a[0])))
    [0][0];
}

function parseDateEUAny26(s) {
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
// TPI26 helpers (REQUIRED) — detail coaching + interactions (your existing ones)
// ============================================================================
// (Keep exactly as you had them; pasted here unchanged)

function buildTPI26Context(players) {
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

function buildTPI26PlayerDetail(p, ctx) {
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

function bindTPI26Interactions(mount, players, ctx) {
  const detailEl = mount.querySelector("#tpi26-player-detail");
  const showPlayer = (name) => {
    if (!detailEl) return;
    const p = players.find((x) => x.name === name);
    if (!p) return;

    detailEl.innerHTML = buildTPI26PlayerDetail(p, ctx);
    detailEl.classList.remove("hidden", "opacity-0", "translate-y-2");
    requestAnimationFrame(() => detailEl.classList.add("opacity-100"));
  };

  mount.querySelectorAll("tr[data-player]").forEach((row) => {
    row.addEventListener("click", () => showPlayer(row.getAttribute("data-player")));
  });

  mount.querySelectorAll(".tpi26-player-btn").forEach((btn) => {
    btn.addEventListener("click", () => showPlayer(btn.getAttribute("data-player")));
  });

  const infoBtn = mount.querySelector("#tpi26-toggle-info");
  const infoContent = mount.querySelector("#tpi26-info-content");
  const arrow = mount.querySelector("#tpi26-info-arrow");
  if (infoBtn && infoContent && arrow) {
    infoBtn.addEventListener("click", () => {
      const hidden = infoContent.classList.contains("hidden");
      infoContent.classList.toggle("hidden");
      arrow.style.transform = hidden ? "rotate(180deg)" : "rotate(0deg)";
    });
  }
}

// ============================================================================
// 4) Helpers (self-contained)
// ============================================================================
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

function clamp(x, a, b) {
  return Math.max(a, Math.min(b, x));
}

function escapeHTML(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getPlayerNameAny(r) {
  return String(r["p.riotIdGameName"] || r["Player"] || r["p.summonerName"] || "").trim();
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

function roleShort(r) {
  const R = String(r || "UNKNOWN").toUpperCase();
  if (R === "JUNGLE") return "JNG";
  if (R === "SUPPORT") return "SUP";
  return R === "UNKNOWN" ? "UNK" : R;
}

function buildRoleBreakdown(roleFreqMap) {
  const entries = [...(roleFreqMap?.entries?.() || [])]
    .map(([role, count]) => ({ role: String(role || "UNKNOWN"), count: count || 0 }))
    .filter((x) => x.count > 0);

  if (!entries.length) return [{ role: "UNKNOWN", count: 1, share: 1 }];

  const total = entries.reduce((s, x) => s + x.count, 0) || 1;
  entries.sort((a, b) => b.count - a.count);
  return entries.map((x) => ({ ...x, share: x.count / total }));
}

function blendRolePillarWeights(roleBreakdown) {
  const out = { indiv: 0, obj: 0, vision: 0, reli: 0 };
  const rbs = Array.isArray(roleBreakdown) && roleBreakdown.length ? roleBreakdown : [{ role: "UNKNOWN", share: 1 }];

  rbs.forEach((rb) => {
    const role = normRole(rb.role);
    const w = TPI26.ROLE_PILLAR_WEIGHTS[role] || TPI26.ROLE_PILLAR_WEIGHTS.UNKNOWN;
    const s = typeof rb.share === "number" ? rb.share : 0;
    out.indiv += w.indiv * s;
    out.obj += w.obj * s;
    out.vision += w.vision * s;
    out.reli += w.reli * s;
  });

  const sum = out.indiv + out.obj + out.vision + out.reli || 1;
  out.indiv /= sum;
  out.obj /= sum;
  out.vision /= sum;
  out.reli /= sum;
  return out;
}

// --- Winsorization + minmax helpers ---
function quantile(sortedArr, q) {
  if (!sortedArr.length) return 0;
  const pos = (sortedArr.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sortedArr[base + 1] === undefined) return sortedArr[base];
  return sortedArr[base] + rest * (sortedArr[base + 1] - sortedArr[base]);
}

function winsorBounds(arr, p) {
  const v = arr.filter((x) => typeof x === "number" && isFinite(x)).slice().sort((a, b) => a - b);
  if (!v.length) return { lo: 0, hi: 1 };
  return { lo: quantile(v, p), hi: quantile(v, 1 - p) };
}

function winsorize(x, lo, hi) {
  if (!isFinite(x)) return lo;
  return clamp(x, lo, hi);
}

function minmaxOfSeries(arr, b) {
  const v = arr
    .map((x) => winsorize(x, b.lo, b.hi))
    .filter((x) => typeof x === "number" && isFinite(x));
  if (!v.length) return { min: 0, max: 1 };
  return { min: Math.min(...v), max: Math.max(...v) };
}

function tpiFallback(title, msg) {
  return `
    <div class="glass3d mini-card p-4 max-w-[520px]">
      <div class="text-sm font-semibold text-orange-500">${title}</div>
      <div class="text-xs text-slate-500 mt-1">${msg}</div>
    </div>
  `;
}

// ============================================================================
// 🧩 TEAM SYNERGY & IDENTITY — Season 26 (v1.1)
// - NO TABS (always Season view)
// - Top 3 mini cards use noise 003.png
// - Bottom boxes use pseudo-random noise tiles (stable hashing)
// - Core Identity slots: HIDE champ until pilot has >= 25 role games
// ============================================================================

function renderTeamSynergy26(data, timelineData, opts = {}) {
  const mountId = opts.mountId || "team-synergy";
  const container = document.getElementById(mountId);
  if (!container || !Array.isArray(data) || !data.length) return;

  const DD_VERSION = opts.ddVersion || "16.1.1";
  const UNLOCK_ROLE_GAMES = Number.isFinite(opts.unlockRoleGames) ? opts.unlockRoleGames : 25;

  // -----------------------------
  // Helpers
  // -----------------------------
  const getAny = (row, keys) => {
    for (const k of keys) {
      if (k in row && row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== "") return row[k];
    }
    return "";
  };

  const toNum = (v) => {
    if (v === undefined || v === null || v === "") return 0;
    const n = parseFloat(String(v).replace("%", "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  };

  const escapeHTML = (s) =>
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

  const getPlayer = (r) => String(getAny(r, ["Player", "p.riotIdGameName", "p.summonerName"])).trim();
  const getChampion = (r) => String(getAny(r, ["Champion", "CHAMPION", "p.championName"])).trim();
  const getRole = (r) => canonRole(getAny(r, ["ROLE", "Role", "Team Position", "p.teamPosition", "p.individualPosition"]));
  const getGameId = (r) => String(getAny(r, ["Match ID", "MatchID", "Game ID", "Game #", "Date"])).trim();

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
    return `<span class="${base} ${toneMap[tone] || toneMap.slate}">${escapeHTML(text)}</span>`;
  };

  const liftChip = (lift) => {
    const v = Number(lift) || 0;
    const txt = `${v >= 0 ? "+" : ""}${v.toFixed(1)}pp`;
    return chip(txt, v >= 0 ? "emerald" : "rose");
  };

  // ---- noise helpers (reuses RESOLVED_NOISE_URLS from your file) ----
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
    return `https://ddragon.leagueoflegends.com/cdn/${DD_VERSION}/img/champion/${key}.png`;
  };

  const champIcon = (champ, size = 24, extra = "") => {
    const url = champIconUrl(champ);
    if (!url) return "";
    return `
      <img
        src="${url}"
        alt="${escapeHTML(champ)}"
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
  if (!filteredData.length) return;

  // -----------------------------
  // Build games map
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
  if (!gameList.length) return;

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
          <div class="text-[0.65rem] font-semibold uppercase ${t.title} tracking-wide">${escapeHTML(title)}</div>
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
      main: `${escapeHTML(bestDuo.p1)} + ${escapeHTML(bestDuo.p2)}`,
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
      main: `${escapeHTML(bestBot.adc)} + ${escapeHTML(bestBot.sup)}`,
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
                <span class="font-semibold text-slate-900">${escapeHTML(s.champ)}</span>
                <span class="text-slate-500"> ${roleShort(s.role)}</span>
                <span class="text-slate-400"> · ${escapeHTML(s.pilot)}</span>
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
                        <div class="text-[0.8rem] font-semibold text-slate-900 truncate">${escapeHTML(s.champ)}</div>
                        <div class="text-[0.65rem] text-slate-600 truncate">${escapeHTML(s.pilot)}</div>
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

          const rows = picks
            .map((s, idx) => {
              const base = getPilotBaseline(s.pilot);
              const lift = s.wr - base.wr;
              return `
                <div class="flex items-center justify-between gap-3 py-2 ${idx ? "border-t border-slate-200/60" : ""}">
                  <div class="flex items-center gap-2 min-w-0">
                    ${champIcon(s.champ, 22)}
                    <div class="min-w-0">
                      <div class="text-[0.8rem] font-semibold text-slate-900 truncate">${escapeHTML(s.champ)}</div>
                      <div class="text-[0.65rem] text-slate-500 truncate">${escapeHTML(s.pilot)}</div>
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
                <div class="mt-2">${rows}</div>
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

  console.log("🧩 Team Synergy S26 v1.1", {
    season: currentSeason,
    totalGames,
    teamWR: teamWR.toFixed(1),
    bestDuo,
    bestBot,
    top3Overall,
    coreSlots,
    roleTop5,
  });
}


// ============================================================================
// 🧾 MATCH LIST CARD — Last 10 Games + Split Mini Cards (1–3)
// + Muted names subline
// + Champ icon strip: Nübs highlighted (same tone as squad chip), others grey & separated
// + Split fallback: blank split -> Split 1 (so you see games immediately)
// ============================================================================

const MATCHLIST_CONTAINER_ID = "otherflex-matchlist";

function renderOtherFlexMatchList(rows, opts = {}) {
  const roster = Array.isArray(opts.roster) ? opts.roster : ROSTER;

  const mount =
    document.getElementById(opts.mountId || MATCHLIST_CONTAINER_ID) ||
    document.getElementById("match-list") ||
    document.getElementById("matchlist") ||
    document.getElementById("flex-match-list") ||
    null;

  if (!mount) {
    console.warn(
      `[MatchList] No mount found. Add <div id="${MATCHLIST_CONTAINER_ID}"></div> (or reuse an existing match list container).`
    );
    return;
  }

  if (!rows || !rows.length) {
    mount.innerHTML = `
      <section class="section-wrapper fade-in mb-10">
        <div class="dashboard-card bg-white shadow-sm rounded-2xl border border-gray-100 p-4">
          <div class="text-sm font-semibold text-orange-500">Match List (Last 10)</div>
          <div class="text-xs text-slate-500 mt-1">No match data yet.</div>
        </div>
      </section>
    `;
    return;
  }

  // --- DDragon champ icons (tiny strip) ---
  const DD_VERSION = opts.ddVersion || "16.1.1";
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
    return `https://ddragon.leagueoflegends.com/cdn/${DD_VERSION}/img/champion/${key}.png`;
  };

  const toneForCount = (nubs) => {
    if (nubs <= 1) return "sky";
    if (nubs === 2) return "emerald";
    if (nubs === 3) return "orange";
    return "purple";
  };

  const tonePillClasses = (tone) => {
    const m = {
      sky: "bg-sky-50 border-sky-200",
      emerald: "bg-emerald-50 border-emerald-200",
      orange: "bg-orange-50 border-orange-200",
      purple: "bg-purple-50 border-purple-200",
      slate: "bg-slate-50 border-slate-200",
    };
    return m[tone] || m.slate;
  };

  const champPill = (champ, tone = "slate") => {
    const url = champIconUrl(champ);
    if (!url) return "";
    return `
      <span class="inline-flex items-center justify-center w-[22px] h-[22px] rounded-lg border ${tonePillClasses(tone)} overflow-hidden"
            title="${escapeHTML(champ)}">
        <img src="${url}" alt="${escapeHTML(champ)}" class="w-full h-full object-cover block" loading="lazy" />
      </span>
    `;
  };

  // ---- group ALL rows into matches, but keep only matches that include Nübs ----
  const matchMap = new Map(); // id -> aggregate
  for (const r of rows) {
    const id = getMatchId(r);
    if (!id) continue;

    const d = parseDateEU(r["Date"] || r["DATE"]);
    const w = isWin(r);
    const tMin = parseTimeMin(r);
    const player = String(getPlayerName(r) || "").trim();
    const champ = String(getChampion(r) || "").trim();

    if (!matchMap.has(id)) {
      matchMap.set(id, {
        id,
        date: d,
        win: w,
        timeMin: Number.isFinite(tMin) ? tMin : NaN,

        nubSet: new Set(),
        otherSet: new Set(),

        nubChamps: new Set(),
        otherChamps: new Set(),

        // KDA summed across Nübs only
        k: 0,
        d: 0,
        a: 0,

        split: toInt(r["Split"]) ?? 1, // ✅ default Split 1
      });
    }

    const m = matchMap.get(id);

    // date: keep latest
    if (!m.date && d) m.date = d;
    if (m.date && d && d.getTime() > m.date.getTime()) m.date = d;

    // win: if any row is win, match is win (safe)
    m.win = m.win || w;

    // time
    if (!Number.isFinite(m.timeMin) && Number.isFinite(tMin)) m.timeMin = tMin;

    // split fallback
    const s = toInt(r["Split"]);
    if (s) m.split = s;

    // bucket player/champs
    if (player) {
      const isNub = roster.includes(player);
      if (isNub) {
        m.nubSet.add(player);
        if (champ) m.nubChamps.add(champ);

        m.k += num(r["Kills"]);
        m.d += num(r["Deaths"]);
        m.a += num(r["Assists"]);
      } else {
        m.otherSet.add(player);
        if (champ) m.otherChamps.add(champ);
      }
    }
  }

  // keep only matches that include >=1 nub
  const allMatches = [...matchMap.values()]
    .filter((m) => m.nubSet.size > 0)
    .sort((a, b) => {
      const ta = a.date ? a.date.getTime() : 0;
      const tb = b.date ? b.date.getTime() : 0;
      return ta - tb;
    });

  const last10Chrono = allMatches.slice(-10);         // oldest -> newest
  const last10Table = last10Chrono.slice().reverse(); // newest -> oldest

  // dots
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

  // ---- split mini cards ----
  const splitCardsHTML = renderSplitMiniCards(rows, roster);

  // ---- table rows ----
  const rowHTML = last10Table
    .map((m) => {
      const nubs = m.nubSet.size || 0;
      const tone = toneForCount(nubs);

      const stackInfo = stackChip(nubs);
      const resChip = m.win
        ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[0.65rem] border bg-emerald-50 text-emerald-700 border-emerald-200">WIN</span>`
        : `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[0.65rem] border bg-rose-50 text-rose-700 border-rose-200">LOSS</span>`;

      const minutes = Number.isFinite(m.timeMin) ? `${m.timeMin.toFixed(1)}m` : "—";
      const kda = (m.k + m.a) / Math.max(1, m.d);
      const kdaText = Number.isFinite(kda) ? kda.toFixed(2) : "—";

      const dateText = m.date
        ? m.date.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit" })
        : "—";

      // Muted names (keep compact)
      const nubNames = [...m.nubSet].slice(0, 4);
      const extraNubs = m.nubSet.size - nubNames.length;
      const nubLine = nubNames.join(" · ") + (extraNubs > 0 ? ` · +${extraNubs}` : "");
      const othersCount = m.otherSet.size || 0;

      // Champ strips (limit for cleanliness)
      const nubChamps = [...m.nubChamps].slice(0, 4);
      const otherChamps = [...m.otherChamps].slice(0, 4);

      const nubStrip =
        nubChamps.length
          ? nubChamps.map((c) => champPill(c, tone)).join("")
          : "";

      const otherStrip =
        otherChamps.length
          ? otherChamps.map((c) => champPill(c, "slate")).join("")
          : "";

      const champStripHTML = `
        <div class="mt-1 flex items-center gap-2">
          ${
            nubStrip
              ? `<div class="flex items-center gap-1" title="Les Nübs champs">${nubStrip}</div>`
              : `<div class="text-[0.7rem] text-slate-400">No champ data</div>`
          }

          ${
            otherStrip
              ? `<div class="w-px h-4 bg-slate-200"></div>
                 <div class="flex items-center gap-1 opacity-80" title="Other teammates champs">${otherStrip}</div>`
              : ""
          }
        </div>
      `;

      return `
        <tr class="border-t border-slate-100 hover:bg-orange-50/30 transition">
          <td class="px-4 py-2 align-top">
            <div class="text-sm text-slate-800 whitespace-nowrap">${dateText}</div>
            <div class="text-[0.7rem] text-slate-400 mt-0.5">
              ${escapeHTML(nubLine)}${othersCount ? ` <span class="text-slate-300">·</span> <span class="text-slate-400">+${othersCount} others</span>` : ""}
            </div>
          </td>

          <td class="px-4 py-2 align-top">
            ${stackInfo}
            ${champStripHTML}
          </td>

          <td class="px-4 py-2 align-top">${resChip}</td>
          <td class="px-4 py-2 text-right align-top text-slate-700 text-sm whitespace-nowrap">${minutes}</td>
          <td class="px-4 py-2 text-right align-top text-slate-900 font-semibold text-sm whitespace-nowrap">${kdaText}</td>
        </tr>
      `;
    })
    .join("");

  const last10Count = last10Chrono.length;

  mount.innerHTML = `
    <section class="section-wrapper fade-in mb-10">
      <div class="dashboard-card bg-white shadow-sm rounded-2xl border border-gray-100 overflow-hidden">
        <div class="px-4 pt-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h2 class="text-[1.1rem] font-semibold text-orange-500 tracking-tight">Match List (Last 10)</h2>
              <p class="text-[0.72rem] text-gray-600 leading-snug">
                Latest ${last10Count}/10 games · Squad size = number of Nübs in the match
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
              ${rowHTML || `
                <tr><td class="px-4 py-4 text-sm text-slate-500" colspan="5">No matches yet.</td></tr>
              `}
            </tbody>
          </table>
        </div>

        <div class="px-4 py-3 text-[0.65rem] text-slate-400">
          Squad KDA = (Kills + Assists) / Deaths, summed across <span class="font-semibold">Les Nübs</span> in the match.
        </div>

        <div class="px-4 pb-4">
          <div class="text-sm font-semibold text-slate-900 mb-2">Split Mini</div>
          ${splitCardsHTML}
        </div>
      </div>
    </section>
  `;
}

// --- chips ---
function stackChip(nubs) {
  const base = "inline-flex items-center px-2 py-0.5 rounded-full text-[0.65rem] border";
  if (nubs <= 1) return `<span class="${base} bg-sky-50 text-sky-700 border-sky-200">Solo · 1</span>`;
  if (nubs === 2) return `<span class="${base} bg-emerald-50 text-emerald-700 border-emerald-200">Duo · 2</span>`;
  if (nubs === 3) return `<span class="${base} bg-orange-50 text-orange-700 border-orange-200">Trio · 3</span>`;
  return `<span class="${base} bg-purple-50 text-purple-700 border-purple-200">4-stack · 4</span>`;
}

function toInt(v) {
  const n = parseInt(String(v ?? "").trim(), 10);
  return Number.isFinite(n) ? n : null;
}

// --- split mini cards ---
// Shows: (A) unique match count per split, (B) per-nub games in that split
function renderSplitMiniCards(rows, roster) {
  const splits = [1, 2, 3];

  // split -> { matchSet:Set, playerMap: Map(player -> Set(matchId)) }
  const bySplit = {};
  splits.forEach((s) => {
    bySplit[s] = { matchSet: new Set(), playerMap: new Map() };
  });

  rows.forEach((r) => {
    const player = String(getPlayerName(r) || "").trim();
    if (!player || !roster.includes(player)) return; // only show Les Nübs here

    const id = getMatchId(r);
    if (!id) return;

    const s = toInt(r["Split"]) ?? 1; // ✅ default Split 1
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
            (x) => `
              <div class="flex items-center justify-between py-1 border-t border-slate-100">
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



// ---------- CSV parser ----------
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
