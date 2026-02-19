// /components/playerMiniCards.js
import { championSquareUrl } from "../core/ddragon.js";

// Build noise URLs (assets/noise/001.png ... 008.png)
const NOISE_URLS = Array.from({ length: 8 }, (_, i) => {
  const n = String(i + 1).padStart(3, "0");
  return new URL(`../assets/noise/${n}.png`, import.meta.url).href;
});

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function num(v) {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function boolish(v) {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "y";
}

function fmtInt(n) {
  return Math.round(Number(n) || 0).toLocaleString("en-US");
}

function normalizeRole(role) {
  const r = String(role ?? "").trim().toUpperCase();
  if (!r) return "UNKNOWN";
  if (r.includes("TOP")) return "TOP";
  if (r.includes("JUNG")) return "JNG";
  if (r.includes("MID")) return "MID";
  if (r.includes("BOT") || r.includes("BOTTOM") || r.includes("ADC")) return "ADC";
  if (r.includes("SUP") || r.includes("UTIL")) return "SUP";
  return r;
}

function noiseForPlayer(name) {
  if (!NOISE_URLS.length) return "";
  return NOISE_URLS[hashIndex(name, NOISE_URLS.length)];
}

// Deterministic "random" (stable) index from a string
function hashIndex(str, modulo) {
  let h = 2166136261;
  const s = String(str ?? "");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return modulo ? (h >>> 0) % modulo : 0;
}

function seedFromString(str) {
  const idx = hashIndex(str, 10000);
  return idx / 9999;
}

/** ISO week key (YYYY-W##) for stable weekly rotation */
function isoWeekKey(d) {
  const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  // Thursday in current week decides the year
  const day = dt.getUTCDay() || 7; // 1..7 (Mon..Sun)
  dt.setUTCDate(dt.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((dt - yearStart) / 86400000 + 1) / 7);
  return `${dt.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

/**
 * ✅ Loose date parser:
 * - accepts Date
 * - accepts "DD.MM.YY HH:MM"
 * - accepts ISO / epoch-ish strings (best-effort)
 */
function parseLooseDate(v) {
  if (!v) return null;
  if (v instanceof Date && Number.isFinite(v.getTime())) return v;

  const s = String(v).trim();
  if (!s) return null;

  // DD.MM.YY HH:MM
  const m = s.match(/^(\d{2})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2})$/);
  if (m) {
    const dd = Number(m[1]);
    const mm = Number(m[2]) - 1;
    const yy = Number(m[3]);
    const HH = Number(m[4]);
    const MM = Number(m[5]);
    const fullYear = 2000 + yy;
    // treat as UTC-ish so ordering is stable
    const d = new Date(Date.UTC(fullYear, mm, dd, HH, MM, 0));
    return Number.isFinite(d.getTime()) ? d : null;
  }

  // epoch seconds/ms
  const n = Number(s);
  if (Number.isFinite(n) && n > 0) {
    const isMs = n > 5e10;
    const d = new Date(isMs ? n : n * 1000);
    if (Number.isFinite(d.getTime())) return d;
  }

  // ISO parse
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d : null;
}

function injectMiniCardBitsOnce() {
  if (document.getElementById("s26-solo-mini-style")) return;

  const style = document.createElement("style");
  style.id = "s26-solo-mini-style";
  style.textContent = `
    body.s26 .s26-dot{
      width:14px;height:14px;border-radius:9999px;
      border:1px solid rgba(148,163,184,0.55);
      background:var(--dot-empty,#e2e8f0);
      box-shadow:inset 0 1px 0 rgba(255,255,255,0.65);
      flex:0 0 auto;
    }
    body.s26 .s26-dot.win{ background:var(--dot-win,#10b981); border-color:rgba(16,185,129,0.55); }
    body.s26 .s26-dot.loss{ background:var(--dot-loss,#fb7185); border-color:rgba(251,113,133,0.55); }
    body.s26 .s26-dot.latest{ outline:3px solid var(--dot-ring,#ff8000); outline-offset:2px; }

    /* Name clamp (fix long names) */
    body.s26 .s26-mini-name{
      display:-webkit-box;
      -webkit-line-clamp:2;
      -webkit-box-orient:vertical;
      overflow:hidden;
      line-height:1.1;
    }

    /* Badge on its own row */
    body.s26 .s26-mini-badge{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      padding:4px 12px;
      border-radius:9999px;
      font-size:0.65rem;
      font-weight:700;
      border:1px solid rgba(231,175,178,0.9);
      background: rgba(231,175,178,0.22);
      color:#ff8000;
      white-space:nowrap;
      max-width: 190px;
      overflow:hidden;
      text-overflow: ellipsis;
      cursor: help;
    }

    /* ✅ Stats row: first two slightly smaller, third wider */
    body.s26 .s26-stats{
      display:grid;
      grid-template-columns: 0.92fr 0.92fr 1.22fr;
      gap: 8px;
      margin-top: 10px;
    }

    body.s26 .s26-stat{
      padding: 6px 10px;
      border-radius: 16px;
      border: 1px solid rgba(226,232,240,0.95);
      background: rgba(255,255,255,0.78);
      line-height: 1.05;
      font-variant-numeric: tabular-nums;
    }

    body.s26 .s26-stat--mini{ padding: 6px 9px; }

    body.s26 .s26-stat-k{
      font-size: 0.55rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: rgba(100,116,139,0.70);
      font-weight: 700;
    }

    body.s26 .s26-stat-v{
      margin-top: 2px;
      font-size: 0.86rem;
      font-weight: 600;
      color: #0f172a;
      white-space: nowrap;
    }

    body.s26 .s26-stat--mini .s26-stat-v{ font-size: 0.84rem; font-weight: 600; }

    body.s26 .s26-stat--kda .s26-stat-v{
      font-size: 0.88rem;
      font-weight: 600;
      letter-spacing: -0.01em;
    }
    body.s26 .s26-stat--kda .s26-stat-v.sm{ font-size: 0.76rem; letter-spacing: -0.02em; }
    body.s26 .s26-stat--kda .s26-stat-v.xs{ font-size: 0.70rem; letter-spacing: -0.03em; }

    body.s26 .s26-chipwrap{ display:flex; flex-wrap:wrap; gap: 6px; }
    body.s26 .s26-chip{
      display:inline-flex;
      align-items:center;
      gap:6px;
      padding:6px 10px;
      border-radius:9999px;
      border:1px solid rgba(226,232,240,0.92);
      background:rgba(255,255,255,0.75);
      font-size:0.72rem;
      font-weight:600;
      color:#0f172a;
      line-height:1;
      max-width: 100%;
    }
    body.s26 .s26-chip .muted{
      color: rgba(100,116,139,0.95);
      font-weight: 600;
      white-space: nowrap;
    }

    body.s26 .s26-aux-stats{
      display:grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      margin-top: 10px;
    }

    body.s26 .s26-stat--aux{
      padding: 6px 8px;
      border-radius: 12px;
    }

    body.s26 .s26-stat--aux .s26-stat-k{
      font-size: 0.50rem;
      letter-spacing: 0.07em;
    }

    body.s26 .s26-stat--aux .s26-stat-v{
      margin-top: 2px;
      font-size: 0.8rem;
      font-weight: 600;
      white-space: nowrap;
    }

    body.s26 .mk-chip{
      display:inline-flex;align-items:center;gap:6px;
      padding:5px 9px;border-radius:9999px;
      border:1px solid rgba(226,232,240,0.9);
      background:rgba(255,255,255,0.75);
      font-size:0.72rem;font-weight:600;color:#0f172a;line-height:1;
      font-variant-numeric: tabular-nums;
    }
    body.s26 .mk-chip .k{
      font-size:0.62rem;font-weight:700;color:rgba(100,116,139,0.95);
      letter-spacing:0.06em;
    }
  `;
  document.head.appendChild(style);
}

function buildPlayers(rows, filters = {}) {
  const byPlayer = new Map();

  const wantQueueId = Number.isFinite(filters.queueId) ? Number(filters.queueId) : null;
  const minDate = filters.minDate ? parseLooseDate(filters.minDate) : null;
  const maxDate = filters.maxDate ? parseLooseDate(filters.maxDate) : null;

  for (const r of rows) {
    const raw = r?._raw ?? r;

    const name = String(r.player ?? raw["p.riotIdGameName"] ?? raw["Player"] ?? "").trim();
    if (!name) continue;

    // queueId: support normalized + raw
    const qid =
      Number(r.queueId ?? raw["Queue ID"] ?? raw["QueueId"] ?? raw["queueId"] ?? 0) || 0;

    // ✅ strict queue filter if requested
    if (wantQueueId) {
      if (!qid || qid !== wantQueueId) continue;
    }

    // date: support normalized + raw
    const date =
      r.date instanceof Date ? r.date : parseLooseDate(r.date ?? raw["Date"] ?? raw["date"] ?? null);

    // ✅ optional date window filter
    if (minDate) {
      if (!date) continue;
      if (date.getTime() < minDate.getTime()) continue;
    }
    if (maxDate) {
      if (!date) continue;
      if (date.getTime() > maxDate.getTime()) continue;
    }

    const matchId = String(r.matchId ?? raw["Match ID"] ?? raw["MatchID"] ?? raw["matchId"] ?? "").trim();
    const champ = String(r.champion ?? raw["Champion"] ?? raw["p.championName"] ?? "").trim();
    const role = normalizeRole(r.role ?? raw["ROLE"] ?? raw["p.teamPosition"] ?? raw["p.individualPosition"]);

    // ✅ Dedup key: matchId is king
    const key = matchId ? `${name}|${matchId}` : `${name}|${date?.toISOString?.() ?? ""}|${champ}|${role}|${qid}`;

    if (!byPlayer.has(name)) {
      byPlayer.set(name, { name, gameMap: new Map(), champs: new Map(), roles: new Map() });
    }
    const p = byPlayer.get(name);
    if (p.gameMap.has(key)) continue;

    const kills = num(r.kills ?? raw["Kills"] ?? raw["p.kills"]);
    const deaths = num(r.deaths ?? raw["Deaths"] ?? raw["p.deaths"]);
    const assists = num(r.assists ?? raw["Assists"] ?? raw["p.assists"]);
    const enemyMissingPings = num(r.enemyMissingPings ?? raw["p.enemyMissingPings"] ?? raw["enemyMissingPings"]);

    const winVal = r.win ?? raw["p.win"] ?? raw["Result"];
    const win =
      typeof winVal === "boolean"
        ? winVal
        : String(winVal ?? "").toLowerCase().trim() === "win"
        ? true
        : String(winVal ?? "").toLowerCase().trim() === "loss"
        ? false
        : boolish(winVal);

    const doubleKills = num(r.doubleKills ?? raw["p.doubleKills"] ?? raw["doubleKills"]);
    const tripleKills = num(r.tripleKills ?? raw["p.tripleKills"] ?? raw["tripleKills"]);
    const quadraKills = num(r.quadraKills ?? raw["p.quadraKills"] ?? raw["quadraKills"]);
    const pentaKills = num(r.pentaKills ?? raw["p.pentaKills"] ?? raw["pentaKills"]);
    const largestMultiKill = num(r.largestMultiKill ?? raw["p.largestMultiKill"] ?? raw["largestMultiKill"]);
    const goldEarned = num(r.goldEarned ?? raw["goldEarned"] ?? raw["p.goldEarned"] ?? raw["Gold Earned"]);
    const summonerLevel = num(r.summonerLevel ?? raw["summonerLevel"] ?? raw["p.summonerLevel"]);
    const pinkWardsBought = num(
      r.visionWardsBoughtInGame ??
      raw["visionWardsBoughtInGame"] ??
      raw["p.visionWardsBoughtInGame"] ??
      raw["PINK"] ??
      raw["detectorWardsPlaced"] ??
      raw["p.detectorWardsPlaced"]
    );

    p.gameMap.set(key, {
      date,
      win,
      champ,
      role,
      kills,
      deaths,
      assists,
      doubleKills,
      tripleKills,
      quadraKills,
      pentaKills,
      largestMultiKill,
      enemyMissingPings,
      goldEarned,
      summonerLevel,
      pinkWardsBought,
    });

    if (role && role !== "UNKNOWN") p.roles.set(role, (p.roles.get(role) || 0) + 1);
    if (champ) p.champs.set(champ, (p.champs.get(champ) || 0) + 1);
  }

  const out = [...byPlayer.values()].map((p) => {
    const gamesArr = [...p.gameMap.values()].sort((a, b) => {
      const ta = a.date ? a.date.getTime() : 0;
      const tb = b.date ? b.date.getTime() : 0;
      return ta - tb; // oldest -> newest
    });

    const games = gamesArr.length;
    const wins = gamesArr.filter((g) => g.win === true).length;
    const wr = games ? (wins / games) * 100 : 0;

    const kills = gamesArr.reduce((s, g) => s + num(g.kills), 0);
    const deaths = gamesArr.reduce((s, g) => s + num(g.deaths), 0);
    const assists = gamesArr.reduce((s, g) => s + num(g.assists), 0);
    const kda = (kills + assists) / Math.max(1, deaths);

    const killsPerGame = games ? kills / games : 0;
    const deathsPerGame = games ? deaths / games : 0;
    const assistsPerGame = games ? assists / games : 0;
    const perfectKdaGames = gamesArr.reduce((s, g) => s + (num(g.deaths) === 0 ? 1 : 0), 0);
    const goldEarnedTotal = gamesArr.reduce((s, g) => s + num(g.goldEarned), 0);
    const avgGoldPerGame = games ? goldEarnedTotal / games : 0;
    const summonerLevelMax = gamesArr.reduce((mx, g) => Math.max(mx, num(g.summonerLevel)), 0);
    const pinkWardsBoughtTotal = gamesArr.reduce((s, g) => s + num(g.pinkWardsBought), 0);
    const avgPinkWardsPerGame = games ? pinkWardsBoughtTotal / games : 0;

    const mk = { d: 0, t: 0, q: 0, p: 0 };
    for (const g of gamesArr) {
      const d = num(g.doubleKills);
      const t = num(g.tripleKills);
      const q = num(g.quadraKills);
      const pz = num(g.pentaKills);

      if (d || t || q || pz) {
        mk.d += d;
        mk.t += t;
        mk.q += q;
        mk.p += pz;
        continue;
      }

      const v = num(g.largestMultiKill);
      if (v === 2) mk.d += 1;
      else if (v === 3) mk.t += 1;
      else if (v === 4) mk.q += 1;
      else if (v >= 5) mk.p += 1;
    }

    const multiTotal = (mk.d || 0) + (mk.t || 0) + (mk.q || 0) + (mk.p || 0);

    const enemyMissingPings = gamesArr.reduce((s, g) => s + num(g.enemyMissingPings), 0);
    const pingPerGame = games ? enemyMissingPings / games : 0;

    const topChamps = [...p.champs.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([champ, count]) => ({ champ, count }));

    const topRoles = [...p.roles.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([role, count]) => ({ role, count, share: games ? (count / games) * 100 : 0 }));

    const uniqueChamps = p.champs.size;
    const uniqueRoles = p.roles.size;
    const topChampShare = games ? (topChamps?.[0]?.count || 0) / games : 0;
    const topRoleShare = games ? (topRoles?.[0]?.count || 0) / games : 0;

    const last10 = gamesArr.slice(-10);
    const last10Dots = last10.map((g) => (g.win === true ? "win" : g.win === false ? "loss" : "empty"));

    // current streaks from most recent backwards
    let winStreak = 0;
    let lossStreak = 0;
    for (let i = gamesArr.length - 1; i >= 0; i--) {
      if (gamesArr[i].win === true) winStreak++;
      else break;
    }
    for (let i = gamesArr.length - 1; i >= 0; i--) {
      if (gamesArr[i].win === false) lossStreak++;
      else break;
    }

    // bounceback: multiple loss->win flips in last10 and last game is a win
    let rebounds = 0;
    for (let i = 1; i < last10Dots.length; i++) {
      if (last10Dots[i - 1] === "loss" && last10Dots[i] === "win") rebounds++;
    }
    const bounceback = rebounds >= 2 && last10Dots[last10Dots.length - 1] === "win";

    return {
      name: p.name,
      games,
      wins,
      wr,
      kills,
      deaths,
      assists,
      kda,
      killsPerGame,
      deathsPerGame,
      assistsPerGame,
      perfectKdaGames,
      goldEarnedTotal,
      avgGoldPerGame,
      summonerLevelMax,
      pinkWardsBoughtTotal,
      avgPinkWardsPerGame,
      multikills: mk,
      multiTotal,
      enemyMissingPings,
      pingPerGame,
      topChamps,
      topRoles,
      uniqueChamps,
      uniqueRoles,
      topChampShare,
      topRoleShare,
      last10Dots,
      winStreak,
      lossStreak,
      bounceback,
      topChamp: topChamps[0]?.champ ?? "",
    };
  });

  out.sort((a, b) => b.games - a.games || b.kda - a.kda);
  return out;
}

function buildBadgeContext(players = []) {
  if (!players.length) return {};

  const byGames = [...players].sort((a, b) => (b.games || 0) - (a.games || 0));
  const topGames = byGames[0]?.games ?? 0;
  const secondGames = byGames[1]?.games ?? 0;
  const grindLeader = (topGames - secondGames) >= 20 ? byGames[0]?.name : null;

  const byKda = [...players].sort((a, b) => (b.kda || 0) - (a.kda || 0));
  const kdaLeader = byKda[0]?.name || null;

  const byKillsPg = [...players].sort((a, b) => (b.killsPerGame || 0) - (a.killsPerGame || 0));
  const killLeader = byKillsPg[0]?.name || null;

  const byPingPg = [...players].sort((a, b) => (b.pingPerGame || 0) - (a.pingPerGame || 0));
  const pingLeader = byPingPg[0]?.name || null;

  return { grindLeader, topGames, secondGames, kdaLeader, killLeader, pingLeader };
}

function pickFunnyBadge(p, ctx, fallbackLabel = "ON THE RIFT") {
  const g = p.games || 0;
  const candidates = [];

  const add = (label, priority, ok, tip) => {
    if (!ok) return;
    candidates.push({ label, priority, tip: tip || label });
  };

  add("STRIKE", 100, p.winStreak >= 10, `Strike: won ${p.winStreak} games in a row. 🔥`);
  add("HOT STREAK", 95, p.winStreak >= 5, `Hot streak: won ${p.winStreak} games in a row.`);

  add(
    "GRINDING IS LIFE",
    90,
    ctx?.grindLeader && ctx.grindLeader === p.name,
    `Grinding is life: ${p.games} games played — next is ${ctx.secondGames} (gap: ${p.games - ctx.secondGames}).`
  );

  add("KDA KING", 88, ctx?.kdaLeader === p.name && g >= 8, `KDA King: best KDA on the team (${p.kda.toFixed(2)}).`);

  add(
    "MAIN CHARACTER",
    86,
    ctx?.killLeader === p.name && g >= 8,
    `Main character: most kills per game (${p.killsPerGame.toFixed(1)}/game).`
  );

  add("PENTA PARTY", 85, (p.multikills?.p || 0) >= 1, `Penta Party: ${p.multikills.p} pentakill(s). 🎉`);
  add(
    "QUAD SQUAD",
    83,
    ((p.multikills?.q || 0) + (p.multikills?.p || 0)) >= 2,
    `Quad Squad: ${p.multikills.q} quadra(s) + ${p.multikills.p} penta(s).`
  );
  add("MULTIKILL MAGNET", 80, (p.multiTotal || 0) >= 5, `Multikill Magnet: ${p.multiTotal} multi-kills total.`);

  add(
    "ONE TRICKY PONY",
    82,
    g >= 10 && p.topChampShare >= 0.8,
    `One Tricky Pony: ${Math.round(p.topChampShare * 100)}% of games on ${p.topChamps?.[0]?.champ || "one champ"}.`
  );
  add("CHAMP BUFFET", 70, g >= 12 && p.uniqueChamps >= 10, `Champ Buffet: played ${p.uniqueChamps} different champs.`);

  add(
    "LANE LOYALIST",
    75,
    g >= 10 && p.topRoleShare >= 0.75,
    `Lane Loyalist: ${Math.round(p.topRoleShare * 100)}% of games in ${p.topRoles?.[0]?.role || "one role"}.`
  );
  add(
    "ROLE CHAMELEON",
    72,
    g >= 10 && p.uniqueRoles >= 3 && p.topRoleShare <= 0.45,
    `Role Chameleon: ${p.uniqueRoles} roles played — no single role above ${Math.round(p.topRoleShare * 100)}%.`
  );

  add("CLEAN HANDS", 68, g >= 10 && p.deathsPerGame <= 2.2, `Clean Hands: only ${p.deathsPerGame.toFixed(1)} deaths per game.`);
  add(
    "NOT DYING TODAY",
    67,
    g >= 10 && p.kda >= 4.5 && p.deathsPerGame <= 3.0,
    `Not Dying Today: KDA ${p.kda.toFixed(2)} with ${p.deathsPerGame.toFixed(1)} deaths/game.`
  );

  add("DAMAGE DELIVERY", 65, g >= 10 && p.killsPerGame >= 7.5, `Damage Delivery: ${p.killsPerGame.toFixed(1)} kills per game.`);
  add(
    "ASSIST MERCHANT",
    64,
    g >= 10 && (p.assistsPerGame >= 9 || p.assists > p.kills * 1.6),
    `Assist Merchant: ${p.assistsPerGame.toFixed(1)} assists/game.`
  );

  add(
    "NO CHAT ONLY PING",
    60,
    ctx?.pingLeader === p.name && p.pingPerGame >= 1.6,
    `No Chat Only Ping: highest missing pings per game (${p.pingPerGame.toFixed(1)}/game).`
  );
  add("ICE COLD", 58, g >= 10 && p.pingPerGame <= 0.4, `Ice Cold: barely pings missing (${p.pingPerGame.toFixed(1)}/game).`);

  add("BOUNCEBACK ARC", 56, g >= 10 && p.bounceback === true, `Bounceback Arc: multiple loss→win rebounds in last 10, ending on a win.`);
  add("UNLUCKY RUN", 40, p.lossStreak >= 10, `Unlucky Run: ${p.lossStreak} losses in a row. Next one flips. 😤`);

  if (!candidates.length) {
    return { label: fallbackLabel, tip: `Just vibing — not enough badge signal yet.` };
  }

  const bestP = Math.max(...candidates.map((c) => c.priority));
  const pool = candidates.filter((c) => c.priority === bestP);

  const week = isoWeekKey(new Date());
  const pick = pool[hashIndex(`${p.name}|${week}`, pool.length)] || pool[0];
  return { label: pick.label, tip: pick.tip || pick.label };
}

function renderCard(p, idx, ui, badgeCtx) {
  const wrTone = p.wr >= 60 ? "text-emerald-700" : p.wr <= 45 ? "text-rose-700" : "text-slate-900";

  const roleChip = (role, share) =>
    `<span class="s26-chip">${escapeHtml(role)} <span class="muted">${Number(share).toFixed(0)}%</span></span>`;

  const champChip = (champ, count) =>
    `<span class="s26-chip">${escapeHtml(champ)} <span class="muted">(${Number(count)})</span></span>`;

  const rolesChips = p.topRoles.length
    ? p.topRoles.slice(0, 2).map((r) => roleChip(r.role, r.share)).join("")
    : `<span class="text-[0.65rem] text-slate-400">—</span>`;

  const champChips = p.topChamps.length
    ? p.topChamps.slice(0, 3).map((c) => champChip(c.champ, c.count)).join("")
    : `<span class="text-[0.65rem] text-slate-400">—</span>`;

  const dots = [];
  for (let i = 0; i < 10; i++) dots.push(p.last10Dots[i] || "empty");
  const latestIdx = p.last10Dots.length ? p.last10Dots.length - 1 : -1;
  const dotsHTML = dots
    .map((state, i) => {
      const cls = state === "win" ? "win" : state === "loss" ? "loss" : "";
      const latest = i === latestIdx ? "latest" : "";
      return `<span class="s26-dot ${cls} ${latest}"></span>`;
    })
    .join("");

  const mk = p.multikills || { d: 0, t: 0, q: 0, p: 0 };
  const mkChip = (k, v) => `<span class="mk-chip"><span class="k">${k}</span>${v}</span>`;

  const tint = seedFromString(p.name);
  const glowA = (0.32 + tint * 0.18).toFixed(2);
  const glowB = (0.18 + (1 - tint) * 0.16).toFixed(2);

  const bg = noiseForPlayer(p.name);
  const imgId = `solo-mini-champ-${idx}`;

  const roleText = ui.hideRoleLine
    ? `${escapeHtml(ui.queueLabel)}`
    : `${escapeHtml(ui.queueLabel)} · ${escapeHtml(p.topRoles[0]?.role ?? "—")}`;
  const perfectKdaText = String(p.perfectKdaGames ?? 0);
  const avgGoldText = fmtInt(p.avgGoldPerGame);
  const summonerLevelText = p.summonerLevelMax > 0 ? fmtInt(p.summonerLevelMax) : "—";
  const avgPinkText = Number(p.avgPinkWardsPerGame || 0).toFixed(1);

  const kdaLine = `${p.kills}/${p.deaths}/${p.assists}`;
  let kdaSize = "";
  if (kdaLine.length >= 16) kdaSize = "xs";
  else if (kdaLine.length >= 13) kdaSize = "sm";

  const badge =
    ui.badgeMode === "fixed"
      ? { label: ui.badgeText ?? "Solo", tip: ui.badgeText ?? "Solo" }
      : pickFunnyBadge(p, badgeCtx, ui.badgeText || "ON THE RIFT");

  return `
    <div
      class="mini-card glass3d relative overflow-hidden rounded-[24px] border border-slate-200/80 shadow-md w-full max-w-[330px]"
      style="
        background-image: url('${bg}');
        background-size: cover;
        background-position: center;
        --dot-win:#10b981;
        --dot-loss:#fb7185;
        --dot-empty:#e2e8f0;
        --dot-ring:#ff8000;
      "
    >
      <div class="absolute inset-0" style="
        background: radial-gradient(140% 120% at 15% 15%,
          rgba(249,115,22,${glowA}),
          rgba(231,175,178,${glowB}) 45%,
          rgba(255,255,255,0.55) 100%);
      "></div>

      <div class="relative p-3">
        <div class="flex items-start gap-2.5">
          <div class="w-10 h-10 rounded-2xl border border-slate-200 bg-white overflow-hidden shrink-0">
            <img
              id="${imgId}"
              src=""
              alt=""
              class="w-full h-full object-cover object-center block"
              loading="lazy"
              referrerpolicy="no-referrer"
            />
          </div>

          <div class="min-w-0 flex-1">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <div class="text-[1.0rem] font-semibold text-slate-900 s26-mini-name">${escapeHtml(p.name)}</div>
              </div>

              <span class="shrink-0 text-[0.65rem] font-medium px-2 py-[2px] rounded-full border border-slate-200 bg-white/70 text-slate-700">
                ${p.games}g
              </span>
            </div>

            <div class="mt-1 flex items-center justify-between gap-2">
              <div class="text-[0.7rem] text-slate-600 leading-tight truncate">${roleText}</div>
              <span class="s26-mini-badge" title="${escapeHtml(badge.tip)}">${escapeHtml(badge.label)}</span>
            </div>
          </div>
        </div>

        <div class="s26-stats">
          <div class="s26-stat s26-stat--mini">
            <div class="s26-stat-k">KDA</div>
            <div class="s26-stat-v">${p.kda.toFixed(2)}</div>
          </div>

          <div class="s26-stat s26-stat--mini">
            <div class="s26-stat-k">WR</div>
            <div class="s26-stat-v ${wrTone}">${p.wr.toFixed(1)}%</div>
          </div>

          <div class="s26-stat s26-stat--kda">
            <div class="s26-stat-k">K / D / A</div>
            <div class="s26-stat-v ${kdaSize}">${escapeHtml(kdaLine)}</div>
          </div>
        </div>

        <div class="mt-2.5 flex items-center justify-between gap-2">
          <div class="text-[0.65rem] uppercase tracking-wide text-slate-500">Last 10</div>
          <div class="flex items-center gap-1.5">${dotsHTML}</div>
        </div>

        <div class="s26-aux-stats">
          <div class="s26-stat s26-stat--aux" title="Games with zero deaths.">
            <div class="s26-stat-k">Perfect KDA</div>
            <div class="s26-stat-v">${perfectKdaText}</div>
          </div>
          <div class="s26-stat s26-stat--aux" title="Average gold earned per game.">
            <div class="s26-stat-k">Avg Gold / G</div>
            <div class="s26-stat-v">${avgGoldText}</div>
          </div>
          <div class="s26-stat s26-stat--aux" title="Highest summoner level observed in this dataset.">
            <div class="s26-stat-k">Summoner Lvl</div>
            <div class="s26-stat-v">${summonerLevelText}</div>
          </div>
          <div class="s26-stat s26-stat--aux" title="Average pink/control wards bought per game.">
            <div class="s26-stat-k">Pink / G</div>
            <div class="s26-stat-v">${avgPinkText}</div>
          </div>
        </div>

        <div class="mt-2.5 grid grid-cols-2 gap-2">
          <div>
            <div class="text-[0.65rem] uppercase tracking-wide text-slate-500 mb-1">Roles</div>
            <div class="s26-chipwrap">${rolesChips}</div>
          </div>
          <div>
            <div class="text-[0.65rem] uppercase tracking-wide text-slate-500 mb-1">Champs</div>
            <div class="s26-chipwrap">${champChips}</div>
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
            <div class="text-[0.72rem] font-medium text-slate-700">Enemy Missing pings</div>
            <div class="text-[0.9rem] font-semibold text-slate-900">${p.enemyMissingPings}</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

export async function mountPlayerMiniCards(el, rows, opts = {}) {
  injectMiniCardBitsOnce();
  if (!el) return;

  const ui = {
    queueLabel: opts.queueLabel ?? "Solo/Duo",
    badgeText: opts.badgeText ?? "ON THE RIFT",
    badgeMode: opts.badgeMode ?? "fun", // "fun" | "fixed"
    hideRoleLine: opts.hideRoleLine ?? false,
  };

  if (!rows || !rows.length) {
    el.innerHTML = `<div class="text-sm text-slate-500">No data.</div>`;
    return;
  }

  // ✅ New: optional filtering for “season start”
  const filters = {
    queueId: opts.queueId ?? null,   // e.g. 420
    minDate: opts.minDate ?? null,   // e.g. "2026-01-08"
    maxDate: opts.maxDate ?? null,   // optional
  };

  const players = buildPlayers(rows, filters);
  if (!players.length) {
    el.innerHTML = `<div class="text-sm text-slate-500">No player rows found.</div>`;
    return;
  }

  const badgeCtx = buildBadgeContext(players);
  el.innerHTML = players.map((p, idx) => renderCard(p, idx, ui, badgeCtx)).join("");

  await Promise.all(
    players.map(async (p, idx) => {
      const img = document.getElementById(`solo-mini-champ-${idx}`);
      if (!img) return;

      try {
        const url = p.topChamp ? await championSquareUrl(p.topChamp) : "";
        if (url) {
          img.src = url;
          img.alt = `${p.topChamp} icon`;
        }
      } catch {}
    })
  );
}
