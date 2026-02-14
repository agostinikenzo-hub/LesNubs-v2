// /components/teamSummaryCard.js
// Team (5-stack) Summary — v2 ultra-clean styling
// Mount API:
//   mountTeamSummaryCard(mountEl, rawRows, { title, subtitle, tag, ddVersion })

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

function formatPct(x) {
  if (!Number.isFinite(x)) return "—";
  return `${x.toFixed(1)}%`;
}

function formatMin(sec) {
  if (!Number.isFinite(sec) || sec <= 0) return "—";
  return `${(sec / 60).toFixed(1)} min`;
}

function fmtInt(n) {
  if (!Number.isFinite(n)) return "—";
  return Math.round(n).toLocaleString("en-US");
}

function fmtFloat(n, d = 2) {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(d);
}

function plural(n, singular, pluralWord = `${singular}s`) {
  const x = Number(n) || 0;
  return x === 1 ? singular : pluralWord;
}

function parseLooseDate(v) {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  const s = String(v ?? "").trim();
  if (!s) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

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

function formatEUDate(d) {
  if (!(d instanceof Date) || isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yy}, ${hh}:${mi}`;
}

function getMatchId(r) {
  return String(pick(r, ["Match ID", "matchId", "MatchId", "MatchID", "Game ID", "Game #", "Date"]) || "").trim();
}

function getPlayer(r) {
  return String(pick(r, ["p.riotIdGameName", "Player", "p.summonerName", "summonerName"]) || "").trim();
}

function getChampion(r) {
  return String(pick(r, ["Champion", "p.championName", "championName"]) || "").trim();
}

function getWin(r) {
  const v = pick(r, ["Result", "p.win", "win"]);
  const b = toBool(v);
  return b ?? false;
}

function getTeamId(r) {
  const v = pick(r, ["teamId", "Team ID", "TeamId", "p.teamId"]);
  const n = toNum(v);
  return n ? n : null; // 100 blue, 200 red
}

function getTimePlayedSec(r) {
  const v = toNum(pick(r, ["p.timePlayed", "timePlayed"]));
  if (v > 0) return v;
  const t = String(pick(r, ["TIME", "Game Time"]) || "").trim(); // "mm:ss"
  if (t.includes(":")) {
    const [m, s] = t.split(":").map((x) => toNum(x));
    return Math.max(0, m * 60 + s);
  }
  return 0;
}

function getKPct(r) {
  const raw = toNum(pick(r, ["Kill Part %", "p.challenges.killParticipation", "killParticipation"]));
  if (!raw) return null;
  return raw <= 1.01 ? raw * 100 : raw;
}

function getPinkWards(r) {
  return toNum(
    pick(r, [
      "Control Wards Placed",
      "Pink Wards",
      "p.detectorWardsPlaced",
      "detectorWardsPlaced",
      "p.visionWardsBoughtInGame",
      "visionWardsBoughtInGame",
    ])
  );
}

function getVision(r) {
  return toNum(pick(r, ["Vision Score", "p.visionScore", "visionScore"]));
}

function getDamage(r) {
  return toNum(
    pick(r, [
      "Damage Dealt",
      "Damage to Champs",
      "Total Damage to Champs",
      "p.totalDamageDealtToChampions",
      "totalDamageDealtToChampions",
      "p.challenges.damageDealtToChampions",
      "damageDealtToChampions",
    ])
  );
}

function getGoldEarned(r) {
  return toNum(
    pick(r, [
      "Gold Earned",
      "Gold earned",
      "Total Gold",
      "Gold",
      "p.goldEarned",
      "goldEarned",
      "p.challenges.goldEarned",
      "goldEarnedInGame",
    ])
  );
}

function getKills(r) {
  return toNum(pick(r, ["Kills", "p.kills", "kills"]));
}
function getDeaths(r) {
  return toNum(pick(r, ["Deaths", "p.deaths", "deaths"]));
}
function getAssists(r) {
  return toNum(pick(r, ["Assists", "p.assists", "assists"]));
}

function getMultis(r) {
  const doubleKills = toNum(pick(r, ["Double Kills", "doubleKills", "p.doubleKills"]));
  const tripleKills = toNum(pick(r, ["Triple Kills", "tripleKills", "p.tripleKills"]));
  const quadraKills = toNum(pick(r, ["Quadra Kills", "quadraKills", "p.quadraKills"]));
  const pentaKills = toNum(pick(r, ["Penta Kills", "pentaKills", "p.pentaKills"]));
  return { doubleKills, tripleKills, quadraKills, pentaKills };
}

// --- DDragon champs ---
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

function champIconUrl(champ, ddVersion) {
  const key = champToDDragonKey(champ);
  if (!key) return "";
  return `https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/champion/${key}.png`;
}

// --- UI (ultra-clean) ---
function tile({ label, value, subHTML, valueClass = "text-slate-900", accent = false }) {
  return `
    <div class="rounded-2xl border border-slate-200/70 bg-white/60 px-4 py-3">
      <div class="text-[0.65rem] font-medium text-slate-500 tracking-wide">${esc(label)}</div>
      <div class="mt-1 text-[1.35rem] font-semibold tracking-tight ${valueClass}">
        ${value}
      </div>
      <div class="mt-1 text-[0.7rem] ${accent ? "text-slate-500" : "text-slate-400"} leading-snug">
        ${subHTML ?? "&nbsp;"}
      </div>
    </div>
  `;
}

function statCard({ title, value, linesHTML }) {
  return `
    <div class="rounded-2xl border border-slate-200/70 bg-white/60 px-4 py-3">
      <div class="text-[0.65rem] font-medium text-slate-500 tracking-wide">${esc(title)}</div>
      <div class="mt-1 text-[1.2rem] font-semibold tracking-tight text-slate-900">${value}</div>
      <div class="mt-2 space-y-1.5 text-[0.72rem] text-slate-600 leading-snug">
        ${linesHTML || `<div class="text-slate-400">—</div>`}
      </div>
    </div>
  `;
}

function topNLines(entries, n, formatter) {
  if (!entries || !entries.length) return "";
  return entries
    .slice(0, n)
    .map((e, i) => {
      const val = formatter(e.value);
      return `
        <div class="flex items-center justify-between gap-2">
          <div class="truncate">
            <span class="text-slate-400">${i + 1}.</span>
            <span class="ml-1 font-medium text-slate-700">${esc(e.player)}</span>
          </div>
          <div class="shrink-0 text-slate-500">(${esc(val)})</div>
        </div>
      `;
    })
    .join("");
}

function champListItem(champ, count, ddVersion) {
  const url = champIconUrl(champ, ddVersion);
  return `
    <div class="flex items-center gap-2">
      <span class="inline-flex items-center justify-center w-[26px] h-[26px] rounded-xl border border-slate-200/70 bg-slate-50 overflow-hidden">
        ${url ? `<img src="${url}" alt="${esc(champ)}" class="w-full h-full object-cover block" loading="lazy" />` : ""}
      </span>
      <div class="min-w-0">
        <div class="text-[0.75rem] font-medium text-slate-700 truncate">${esc(champ)}</div>
      </div>
      <div class="ml-auto text-[0.75rem] font-semibold text-slate-900">${fmtInt(count)}</div>
    </div>
  `;
}

export function mountTeamSummaryCard(mountEl, rawRows, opts = {}) {
  if (!mountEl) return;

  const rows = Array.isArray(rawRows) ? rawRows : [];
  if (!rows.length) {
    mountEl.innerHTML = `
      <div class="card-header">
        <div>
          <div class="card-title">Team Summary</div>
          <div class="card-subtitle">No data available.</div>
        </div>
      </div>
    `;
    return;
  }

  const ddVersion = opts.ddVersion || "16.1.1";
  const title = opts.title || "Season 26 — Team (5-stack) Summary";
  const subtitle = opts.subtitle || "Games where 5 Les Nübs queued together.";
  const tag = opts.tag || "5-stack";

  const matches = new Map();
  let lastUpdated = null;

  const pinkPlacements = [];
  const visionPlacements = [];
  const dmgPlacements = [];
  const killPlacements = [];

  const goldAggByPlayer = new Map(); // player -> { sum, cnt }

  const multiTotalsByPlayer = new Map();
  const champCounts = new Map();

  const seenMatchPlayer = new Set();

  for (const r of rows) {
    const id = getMatchId(r);
    if (!id) continue;

    const d = parseLooseDate(pick(r, ["Date", "DATE", "Game Date", "Timestamp", "matchDate", "Match Date"]));
    if (d && (!lastUpdated || d.getTime() > lastUpdated.getTime())) lastUpdated = d;

    const win = getWin(r);
    const teamId = getTeamId(r);
    const t = getTimePlayedSec(r);

    if (!matches.has(id)) {
      matches.set(id, {
        id,
        rows: [],
        win,
        teamId,
        timePlayedSec: 0,
        k: 0,
        d: 0,
        a: 0,
        kpSum: 0,
        kpCount: 0,
        date: d || null,
      });
    }

    const m = matches.get(id);
    m.rows.push(r);

    if (d && (!m.date || d.getTime() > m.date.getTime())) m.date = d;
    m.win = m.win || win;
    if (!m.teamId && teamId) m.teamId = teamId;
    if (t > m.timePlayedSec) m.timePlayedSec = t;

    const player = getPlayer(r);
    const champ = getChampion(r);

    const mpKey = player ? `${id}|${player}` : "";
    if (mpKey && seenMatchPlayer.has(mpKey)) continue;
    if (mpKey) seenMatchPlayer.add(mpKey);

    if (champ) champCounts.set(champ, (champCounts.get(champ) || 0) + 1);

    m.k += getKills(r);
    m.d += getDeaths(r);
    m.a += getAssists(r);

    const kp = getKPct(r);
    if (kp !== null) {
      m.kpSum += kp;
      m.kpCount += 1;
    }

    const pw = getPinkWards(r);
    if (player && pw > 0) pinkPlacements.push({ player, value: pw });

    const vs = getVision(r);
    if (player && vs > 0) visionPlacements.push({ player, value: vs });

    const dmg = getDamage(r);
    if (player && dmg > 0) dmgPlacements.push({ player, value: dmg });

    const k = getKills(r);
    if (player && k > 0) killPlacements.push({ player, value: k });

    const gold = getGoldEarned(r);
    if (player && gold > 0) {
      const cur = goldAggByPlayer.get(player) || { sum: 0, cnt: 0 };
      cur.sum += gold;
      cur.cnt += 1;
      goldAggByPlayer.set(player, cur);
    }

    if (player) {
      const cur = multiTotalsByPlayer.get(player) || { double: 0, triple: 0, quadra: 0, penta: 0 };
      const ms = getMultis(r);
      cur.double += ms.doubleKills || 0;
      cur.triple += ms.tripleKills || 0;
      cur.quadra += ms.quadraKills || 0;
      cur.penta += ms.pentaKills || 0;
      multiTotalsByPlayer.set(player, cur);
    }
  }

  const matchList = [...matches.values()].filter((m) => m.rows.length);
  const games = matchList.length;

  matchList.sort((a, b) => (a.date?.getTime() || 0) - (b.date?.getTime() || 0));

  const wins = matchList.reduce((acc, m) => acc + (m.win ? 1 : 0), 0);
  const winrate = games ? (wins / games) * 100 : 0;

  const teamKills = matchList.reduce((acc, m) => acc + m.k, 0);
  const teamDeaths = matchList.reduce((acc, m) => acc + m.d, 0);
  const teamAssists = matchList.reduce((acc, m) => acc + m.a, 0);
  const teamKda = (teamKills + teamAssists) / Math.max(1, teamDeaths);

  const avgKP = (() => {
    let sum = 0;
    let cnt = 0;
    for (const m of matchList) {
      if (m.kpCount > 0) {
        sum += m.kpSum / m.kpCount;
        cnt += 1;
      }
    }
    return cnt ? sum / cnt : NaN;
  })();

  const avgTime = (() => {
    const secs = matchList.map((m) => m.timePlayedSec).filter((x) => Number.isFinite(x) && x > 0);
    if (!secs.length) return NaN;
    return secs.reduce((a, b) => a + b, 0) / secs.length;
  })();

  let blueGames = 0,
    blueWins = 0,
    redGames = 0,
    redWins = 0;
  for (const m of matchList) {
    if (m.teamId === 100) {
      blueGames += 1;
      if (m.win) blueWins += 1;
    } else if (m.teamId === 200) {
      redGames += 1;
      if (m.win) redWins += 1;
    }
  }
  const blueWR = blueGames ? (blueWins / blueGames) * 100 : NaN;
  const redWR = redGames ? (redWins / redGames) * 100 : NaN;

  // streak
  let streakCount = 0;
  let streakIsWin = null;
  for (let i = matchList.length - 1; i >= 0; i--) {
    const w = !!matchList[i].win;
    if (streakIsWin === null) {
      streakIsWin = w;
      streakCount = 1;
    } else if (w === streakIsWin) {
      streakCount += 1;
    } else break;
  }

  const topPink = pinkPlacements.slice().sort((a, b) => b.value - a.value);
  const topVision = visionPlacements.slice().sort((a, b) => b.value - a.value);
  const topDmg = dmgPlacements.slice().sort((a, b) => b.value - a.value);
  const topKills = killPlacements.slice().sort((a, b) => b.value - a.value);

  const topChamps = [...champCounts.entries()]
    .map(([champ, count]) => ({ champ, count }))
    .sort((a, b) => b.count - a.count || a.champ.localeCompare(b.champ))
    .slice(0, 5);

  function sumMulti(field) {
    let total = 0;
    let topPlayer = null;
    let topVal = 0;
    for (const [p, v] of multiTotalsByPlayer.entries()) {
      const n = v[field] || 0;
      total += n;
      if (n > topVal) {
        topVal = n;
        topPlayer = p;
      }
    }
    return { total, topPlayer, topVal };
  }

  function topMultiEntries(field, n = 5) {
    return [...multiTotalsByPlayer.entries()]
      .map(([player, v]) => ({ player, value: v?.[field] || 0 }))
      .filter((e) => e.value > 0)
      .sort((a, b) => b.value - a.value || a.player.localeCompare(b.player))
      .slice(0, n);
  }

  const doubles = sumMulti("double");
  const triples = sumMulti("triple");
  const quadras = sumMulti("quadra");
  const pentas = sumMulti("penta");
  const topDoubles = topMultiEntries("double", 5);
  const topTriples = topMultiEntries("triple", 5);
  const topQuadras = topMultiEntries("quadra", 5);
  const topPentas = topMultiEntries("penta", 5);

  const avgGoldEntries = [...goldAggByPlayer.entries()]
    .map(([player, g]) => ({ player, value: g.cnt ? g.sum / g.cnt : 0 }))
    .filter((e) => e.value > 0)
    .sort((a, b) => b.value - a.value || a.player.localeCompare(b.player))
    .slice(0, 5);

  const streakUnit = plural(streakCount, "Game", "Games");
  const streakValue = `${fmtInt(streakCount)} ${streakUnit}`;

  mountEl.innerHTML = `
    <div class="rounded-[28px] border border-slate-200/70 bg-gradient-to-b from-white/70 to-white/40">
      <div class="p-4 sm:p-6">
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0">
            <div class="text-[1.05rem] sm:text-[1.12rem] font-semibold tracking-tight" style="color:#ff8000;">
              ${esc(title)}
            </div>
            <div class="mt-0.5 text-[0.72rem] text-slate-500">
              ${esc(subtitle)}
            </div>
          </div>

          <div class="shrink-0">
            <span class="inline-flex items-center px-3 py-1 rounded-full text-[0.62rem] font-semibold border"
                  style="border-color:#ffd2b1; background:rgba(255,210,177,0.25); color:#ff8000;">
              ${esc(tag)}
            </span>
          </div>
        </div>

        <div class="mt-5 grid grid-cols-2 sm:grid-cols-5 gap-3">
          ${tile({ label: "Games", value: fmtInt(games), subHTML: "Full 5 only", accent: true })}
          ${tile({ label: "Winrate", value: formatPct(winrate) })}
          ${tile({ label: "Team KDA", value: fmtFloat(teamKda, 2) })}
          ${tile({ label: "Avg. Kill Participation", value: Number.isFinite(avgKP) ? formatPct(avgKP) : "—" })}
          ${tile({ label: "Avg. Time", value: Number.isFinite(avgTime) ? formatMin(avgTime) : "—" })}
        </div>

        <div class="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
          ${tile({
            label: "Blue Side Winrate",
            value: Number.isFinite(blueWR) ? formatPct(blueWR) : "—",
            valueClass: "text-sky-600",
          })}
          ${tile({
            label: "Red Side Winrate",
            value: Number.isFinite(redWR) ? formatPct(redWR) : "—",
            valueClass: "text-rose-600",
          })}
          ${tile({
            label: streakIsWin ? "Currently on a Winning Streak" : "Currently on a Losing Streak",
            value: streakValue,
          })}
          ${tile({
            label: "Last Updated",
            value: lastUpdated ? formatEUDate(lastUpdated) : "—",
          })}
        </div>

        <!-- ✅ now ALL cards in this row show Top 5 (consistent) -->
        <div class="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          ${statCard({
            title: "Most Pink Wards in a Game",
            value: topPink.length ? fmtInt(topPink[0].value) : "—",
            linesHTML: topPink.length ? topNLines(topPink, 5, (v) => fmtInt(v)) : "",
          })}
          ${statCard({
            title: "Highest Vision Score",
            value: topVision.length ? fmtInt(topVision[0].value) : "—",
            linesHTML: topVision.length ? topNLines(topVision, 5, (v) => fmtInt(v)) : "",
          })}
          ${statCard({
            title: "Highest Damage Dealt",
            value: topDmg.length ? fmtInt(topDmg[0].value) : "—",
            linesHTML: topDmg.length ? topNLines(topDmg, 5, (v) => fmtInt(v)) : "",
          })}
          ${statCard({
            title: "Most Kills in a Game",
            value: topKills.length ? fmtInt(topKills[0].value) : "—",
            linesHTML: topKills.length ? topNLines(topKills, 5, (v) => fmtInt(v)) : "",
          })}
          ${statCard({
            title: "Avg Gold / Game",
            value: avgGoldEntries.length ? fmtInt(avgGoldEntries[0].value) : "—",
            linesHTML: avgGoldEntries.length ? topNLines(avgGoldEntries, 5, (v) => fmtInt(v)) : "",
          })}
        </div>

        <div class="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div class="rounded-2xl border border-slate-200/70 bg-white/60 px-4 py-3">
            <div class="flex items-baseline justify-between">
              <div class="text-[0.8rem] font-semibold text-slate-900">Most Played Champions</div>
              <div class="text-[0.65rem] text-slate-400">(Top 5)</div>
            </div>

            <div class="mt-3 space-y-2">
              ${
                topChamps.length
                  ? topChamps.map((x) => champListItem(x.champ, x.count, ddVersion)).join("")
                  : `<div class="text-[0.72rem] text-slate-400">No champ data yet.</div>`
              }
            </div>
          </div>

          ${tile({
            label: "Double Kill",
            value: fmtInt(doubles.total),
            subHTML: topDoubles.length
              ? `<div class="space-y-1.5">${topNLines(topDoubles, 5, (v) => fmtInt(v))}</div>`
              : `<div class="text-slate-400">—</div>`,
          })}
          ${tile({
            label: "Triple Kill",
            value: fmtInt(triples.total),
            subHTML: topTriples.length
              ? `<div class="space-y-1.5">${topNLines(topTriples, 5, (v) => fmtInt(v))}</div>`
              : `<div class="text-slate-400">—</div>`,
          })}
          ${tile({
            label: "Quadra Kill",
            value: fmtInt(quadras.total),
            subHTML: topQuadras.length
              ? `<div class="space-y-1.5">${topNLines(topQuadras, 5, (v) => fmtInt(v))}</div>`
              : `<div class="text-slate-400">—</div>`,
          })}
          ${tile({
            label: "Penta Kill",
            value: fmtInt(pentas.total),
            subHTML: topPentas.length
              ? `<div class="space-y-1.5">${topNLines(topPentas, 5, (v) => fmtInt(v))}</div>`
              : `<div class="text-slate-400">—</div>`,
          })}
        </div>
      </div>
    </div>
  `;
}
