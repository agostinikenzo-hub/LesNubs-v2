// /components/teamSynergyCard.js
// Team Synergy & Identity — Season 26 (Team / 5-stack)
// Modular, no globals, mounts into a provided element.
// - Always Season view (auto-detect latest Season value if present)
// - Top 3 mini cards use noise 003.png
// - Bottom boxes use deterministic noise tiles (stable hashing)
// - Core Identity slots: HIDE champ until pilot has >= unlockRoleGames role games
// - Champion icons hydrate async via championSquareUrl()

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

// -----------------------------
// Roster / Nub filtering
// -----------------------------
function normName(x) {
  return String(x || "").trim().toLowerCase();
}

function getIsNubFlag(r) {
  // supports common variants
  return pick(r, ["Is Nub", "IsNub", "isNub", "is_nub", "Nub", "nub"]);
}

function isNubRow(r) {
  const v = getIsNubFlag(r);
  if (String(v ?? "").trim() === "") return null; // unknown
  const b = toBool(v);
  return b === true;
}

function filterRowsToRoster(rows, roster = []) {
  const list = Array.isArray(roster) ? roster : [];
  const set = new Set(list.map(normName).filter(Boolean));
  const hasRoster = set.size > 0;

  return (rows || []).filter((r) => {
    const player = getPlayer(r);
    if (!player) return false;

    // If sheet provides Is Nub, trust it (best signal)
    const nub = isNubRow(r);
    if (nub !== null) return nub === true;

    // Otherwise: if roster provided, keep only roster
    if (hasRoster) return set.has(normName(player));

    // Else: no roster + no Is Nub -> keep all
    return true;
  });
}

function sortSeasons(vals) {
  const arr = (vals || []).map((x) => String(x ?? "").trim()).filter(Boolean);
  if (!arr.length) return [];

  const allNumeric = arr.every((x) => /^-?\d+(\.\d+)?$/.test(x));
  if (allNumeric) return arr.sort((a, b) => Number(a) - Number(b));

  // natural-ish sort for strings like "S26", "Season 26", etc.
  return arr.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
}

// -----------------------------
// Noise tiles (assets/noise/001.png ... 008.png)
// -----------------------------
const NOISE_URLS = Array.from({ length: 8 }, (_, i) => {
  const n = String(i + 1).padStart(3, "0");
  return new URL(`../assets/noise/${n}.png`, import.meta.url).href;
});

function hashStr(str) {
  let h = 0;
  const s = String(str ?? "");
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h >>> 0;
}

function pickNoiseByFile(fileName) {
  if (!NOISE_URLS.length) return "";
  const hit = NOISE_URLS.find((u) => String(u).endsWith(`/${fileName}`) || String(u).endsWith(fileName));
  return hit || NOISE_URLS[0] || "";
}

function pickNoiseForKey(key) {
  if (!NOISE_URLS.length) return "";
  const idx = hashStr(String(key)) % NOISE_URLS.length;
  return NOISE_URLS[idx];
}

function noiseLayer(url, opacity = 0.16) {
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
}

// -----------------------------
// Role helpers
// -----------------------------
function canonRole(raw) {
  const r = String(raw || "").trim().toUpperCase();
  if (!r) return "";
  if (["TOP", "TOPLANE"].includes(r)) return "TOP";
  if (["JUNGLE", "JG", "JNG"].includes(r)) return "JUNGLE";
  if (["MIDDLE", "MID"].includes(r)) return "MID";
  if (["BOTTOM", "BOT", "ADC"].includes(r)) return "BOTTOM";
  if (["SUPPORT", "SUP", "UTILITY"].includes(r)) return "SUPPORT";
  return r;
}

function roleShort(r) {
  const R = canonRole(r);
  if (R === "BOTTOM") return "BOT";
  if (R === "JUNGLE") return "JNG";
  return R || "UNK";
}

// -----------------------------
// Row getters (raw-ish rows from sheet)
// -----------------------------
function getPlayer(r) {
  return String(pick(r, ["Player", "p.riotIdGameName", "p.summonerName", "summonerName"])).trim();
}
function getChampion(r) {
  return String(pick(r, ["Champion", "CHAMPION", "p.championName", "championName"])).trim();
}
function getRole(r) {
  return canonRole(pick(r, ["ROLE", "Role", "Team Position", "p.teamPosition", "p.individualPosition", "p.role"]));
}
function getGameId(r) {
  return String(pick(r, ["Match ID", "MatchID", "matchId", "Game ID", "Game #", "Date"])).trim();
}
function isWinRow(r) {
  const v = pick(r, ["Result", "p.win", "win"]);
  const b = toBool(v);
  if (b !== null) return b;
  return String(v || "").trim().toLowerCase() === "win";
}

function normSeason(v) {
  return String(v ?? "").trim();
}

// -----------------------------
// Chips
// -----------------------------
function chip(text, tone = "slate") {
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
  return `<span class="${base} ${toneMap[tone] || toneMap.slate}">${esc(text)}</span>`;
}

function liftChip(lift) {
  const v = Number(lift) || 0;
  const txt = `${v >= 0 ? "+" : ""}${v.toFixed(1)}pp`;
  return chip(txt, v >= 0 ? "emerald" : "rose");
}

// -----------------------------
// Champ icon hydration
// -----------------------------
function champImg(champ, size = 24, extra = "") {
  if (!champ) return "";
  return `
    <img
      data-ln-champ="${esc(champ)}"
      src=""
      alt=""
      width="${size}" height="${size}"
      class="rounded-lg border border-white shadow-sm ${extra}"
      style="object-fit:cover"
      loading="lazy"
      referrerpolicy="no-referrer"
    />
  `;
}

async function hydrateChampionIcons(scopeEl) {
  const imgs = scopeEl.querySelectorAll("img[data-ln-champ]");
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
      } catch {
        // keep blank
      }
    })
  );
}

// -----------------------------
// Utils
// -----------------------------
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

function winRate(items) {
  if (!items.length) return 0;
  const w = items.reduce((s, x) => s + (x.win ? 1 : 0), 0);
  return (w / items.length) * 100;
}

// ============================================================================
// Public mount
// ============================================================================
export async function mountTeamSynergyCard(mountEl, rows, opts = {}) {
  if (!mountEl) throw new Error("mountTeamSynergyCard: missing mount element");
  if (!mountEl.classList.contains("dashboard-card")) mountEl.classList.add("dashboard-card");

  if (!Array.isArray(rows) || !rows.length) {
    fallback(mountEl, "Team Synergy & Identity", "No full 5-stack games found yet.");
    return;
  }

  const UNLOCK_ROLE_GAMES = Number.isFinite(opts.unlockRoleGames) ? opts.unlockRoleGames : 25;

  // ✅ NEW: roster filtering (recommended)
  // pass opts.roster: ROSTER_ORDER
  const roster = Array.isArray(opts.roster) ? opts.roster : [];
  const rosterFiltered = filterRowsToRoster(rows, roster);

  if (!rosterFiltered.length) {
    const hint = roster?.length
      ? "No rows matched your roster filter. Check name spelling vs roster."
      : "No roster filter provided and no Is Nub flag found/true.";
    fallback(mountEl, "Team Synergy & Identity", hint);
    if (opts.debug) console.log("🧩 Team Synergy: rosterFiltered empty", { roster, sampleRow: rows?.[0] });
    return;
  }

  // -----------------------------
  // Always season view (auto-pick latest Season if present)
  // -----------------------------
  const seasonsRaw = [...new Set(rosterFiltered.map((r) => normSeason(r["Season"])).filter(Boolean))];
  const seasons = sortSeasons(seasonsRaw);
  const currentSeason = seasons.length ? seasons[seasons.length - 1] : null;

  const filteredData = currentSeason
    ? rosterFiltered.filter((r) => normSeason(r["Season"]) === currentSeason)
    : rosterFiltered.slice();

  if (!filteredData.length) {
    fallback(mountEl, "Team Synergy & Identity", "No rows in current season scope.");
    return;
  }

  // -----------------------------
  // Build match-level games
  // -----------------------------
  const byGame = new Map(); // matchId -> {id, rows, win, players:[]}

  for (const r of filteredData) {
    const id = getGameId(r);
    if (!id) continue;

    let g = byGame.get(id);
    if (!g) {
      g = { id, rows: [], win: false, players: [] };
      byGame.set(id, g);
    }

    g.rows.push(r);
    if (isWinRow(r)) g.win = true;
  }

  const gameList = Array.from(byGame.values());
  if (!gameList.length) {
    fallback(mountEl, "Team Synergy & Identity", "No matches found.");
    return;
  }

  gameList.forEach((g) => {
    g.players = g.rows
      .map((r) => ({ name: getPlayer(r), role: getRole(r), champ: getChampion(r) }))
      .filter((p) => p.name);
  });

  const totalGames = gameList.length;
  const teamWR = winRate(gameList);

  // -----------------------------
  // Pilot baseline WR (within filteredData)
  // -----------------------------
  const pilotOverall = {};
  filteredData.forEach((r) => {
    const name = getPlayer(r);
    if (!name) return;
    pilotOverall[name] ??= { games: 0, wins: 0 };
    pilotOverall[name].games += 1;
    pilotOverall[name].wins += isWinRow(r) ? 1 : 0;
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
    const names = [...new Set(g.players.map((p) => p.name).filter(Boolean))];
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const a = names[i];
        const b = names[j];
        const key = a < b ? `${a}|${b}` : `${b}|${a}`;
        if (!duoStats[key]) duoStats[key] = { p1: a < b ? a : b, p2: a < b ? b : a, games: 0, wins: 0 };
        duoStats[key].games += 1;
        if (g.win) duoStats[key].wins += 1;
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
  // 2) Best botlane champ combo
  // -----------------------------
  const botCombos = {};
  gameList.forEach((g) => {
    const adc = g.players.find((p) => p.role === "BOTTOM");
    const sup = g.players.find((p) => p.role === "SUPPORT");
    if (!adc || !sup || !adc.champ || !sup.champ) return;

    const key = `${adc.champ}|${sup.champ}`;
    if (!botCombos[key]) botCombos[key] = { adc: adc.champ, sup: sup.champ, games: 0, wins: 0 };
    botCombos[key].games += 1;
    if (g.win) botCombos[key].wins += 1;
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
    pickStats[key].wins += isWinRow(r) ? 1 : 0;
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
  // 4) Core Identity Team Comp (hide champ until unlocked)
  // -----------------------------
  const coreSlots = ROLE_ORDER.map((role) => {
    const candidate = (roleTop5[role] || [])[0] || null;
    if (!candidate) return { role, unlocked: false, roleGames: 0, candidate: null };

    const roleGames = (pilotRoleGames?.[candidate.pilot]?.[role] || 0);
    const unlocked = roleGames >= UNLOCK_ROLE_GAMES;

    return { role, unlocked, roleGames, candidate };
  });

  // -----------------------------
  // UI
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
          <div class="text-[0.65rem] font-semibold uppercase ${t.title} tracking-wide">${esc(title)}</div>
          <div class="mt-1 text-sm font-semibold text-slate-900">${main || ""}</div>
          ${sub ? `<div class="text-[0.7rem] text-slate-600 mt-1">${sub}</div>` : ""}
          ${chipsHTML ? `<div class="mt-3 flex flex-wrap gap-1.5">${chipsHTML}</div>` : ""}
        </div>
      </div>
    `;
  };

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
      main: `${esc(bestDuo.p1)} + ${esc(bestDuo.p2)}`,
      sub: "When these two queue together, does the winrate spike vs the rest?",
      chipsHTML,
    });
  })();

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
        ${champImg(bestBot.adc, 28, "ring-2 ring-white")}
        ${champImg(bestBot.sup, 28, "ring-2 ring-white")}
      </div>
    `;

    const chipsHTML =
      chip(`${bestBot.wr.toFixed(1)}% WR`, "emerald") +
      chip(`${bestBot.games} games`, "slate") +
      liftChip(bestBot.lift);

    return miniCard({
      tone: "emerald",
      title: "Best Bot Lane Combo",
      main: `${esc(bestBot.adc)} + ${esc(bestBot.sup)}`,
      sub: "Highest winrate bot lane pair in this season.",
      chipsHTML,
      iconHTML,
    });
  })();

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

    const icons = top3Overall.map((s) => champImg(s.champ, 26, "ring-2 ring-white")).join("");
    const iconHTML = `<div class="absolute right-3 top-3 flex -space-x-2">${icons}</div>`;

    const lines = top3Overall
      .map((s) => {
        const base = getPilotBaseline(s.pilot);
        const lift = s.wr - base.wr;
        return `
          <div class="flex items-center justify-between gap-2 text-[0.7rem] mt-1">
            <div class="flex items-center gap-2 min-w-0">
              ${champImg(s.champ, 18)}
              <div class="truncate">
                <span class="font-semibold text-slate-900">${esc(s.champ)}</span>
                <span class="text-slate-500"> ${roleShort(s.role)}</span>
                <span class="text-slate-400"> · ${esc(s.pilot)}</span>
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
          ${["TOP", "JUNGLE", "MID", "BOTTOM", "SUPPORT"]
            .map((role) => {
              const slot = coreSlots.find((s) => s.role === role);
              const noise = pickNoiseForKey(`core-slot|${role}`);

              if (!slot || !slot.candidate) {
                return `
                  <div class="relative rounded-xl border border-dashed border-indigo-200 bg-white/50 p-3 overflow-hidden">
                    ${noiseLayer(noise, 0.14)}
                    <div class="absolute inset-0" style="background:rgba(255,255,255,0.45); pointer-events:none;"></div>
                    <div class="relative">
                      <div class="text-[0.65rem] font-semibold text-indigo-400 uppercase">${esc(role)}</div>
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
                      <div class="text-[0.65rem] font-semibold text-indigo-400 uppercase">${esc(role)}</div>
                      <div class="mt-2 text-[0.8rem] font-semibold text-slate-700">🔒 Locked</div>
                      <div class="mt-1 text-[0.65rem] text-slate-500">
                        Play <span class="font-semibold">${remaining}</span> more ${esc(role)} games to unlock.
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
                    <div class="text-[0.65rem] font-semibold text-indigo-500 uppercase">${esc(role)}</div>
                    <div class="mt-2 flex items-center gap-2">
                      ${champImg(s.champ, 26)}
                      <div class="min-w-0">
                        <div class="text-[0.8rem] font-semibold text-slate-900 truncate">${esc(s.champ)}</div>
                        <div class="text-[0.65rem] text-slate-600 truncate">${esc(s.pilot)}</div>
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

  const signaturesHTML = `
    <div class="mt-4">
      <div class="flex items-baseline justify-between gap-2">
        <div class="text-sm font-semibold text-slate-900">Signature Picks by Role</div>
        <div class="text-[0.7rem] text-slate-500">Top 5 champs per lane · with pilot + WR lift</div>
      </div>

      <div class="mt-3 grid gap-3 lg:grid-cols-2">
        ${["TOP", "JUNGLE", "MID", "BOTTOM", "SUPPORT"]
          .map((role) => {
            const picks = roleTop5[role] || [];
            const noise = pickNoiseForKey(`sig-role|${role}`);

            const tone =
              role === "TOP"
                ? "bg-orange-50/50 border-orange-100"
                : role === "JUNGLE"
                ? "bg-emerald-50/50 border-emerald-100"
                : role === "MID"
                ? "bg-sky-50/50 border-sky-100"
                : role === "BOTTOM"
                ? "bg-indigo-50/50 border-indigo-100"
                : "bg-purple-50/50 border-purple-100";

            if (!picks.length) {
              return `
                <div class="relative p-4 rounded-2xl border ${tone} overflow-hidden">
                  ${noiseLayer(noise, 0.14)}
                  <div class="absolute inset-0" style="background:rgba(255,255,255,0.40); pointer-events:none;"></div>
                  <div class="relative">
                    <div class="text-[0.7rem] font-semibold text-slate-800">${esc(role)}</div>
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
                      ${champImg(s.champ, 22)}
                      <div class="min-w-0">
                        <div class="text-[0.8rem] font-semibold text-slate-900 truncate">${esc(s.champ)}</div>
                        <div class="text-[0.65rem] text-slate-500 truncate">${esc(s.pilot)}</div>
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
                    <div class="text-[0.7rem] font-semibold text-slate-800">${esc(role)}</div>
                    <div class="text-[0.65rem] text-slate-500">Top 5</div>
                  </div>
                  <div class="mt-2">${rowsHTML}</div>
                </div>
              </div>
            `;
          })
          .join("")}
      </div>
    </div>
  `;

  mountEl.innerHTML = `
    <div class="card-header">
      <div>
        <div class="card-title">Team Synergy &amp; Identity</div>
        <div class="card-subtitle">
          Finds your most reliable core, bot lane best pair, and signature picks per role.
          ${currentSeason ? ` <span class="text-slate-400">(Season: ${esc(currentSeason)})</span>` : ""}
        </div>
      </div>
    </div>

    <div class="grid md:grid-cols-3 gap-3 mt-3">
      ${blueCard}
      ${greenCard}
      ${orangeCard}
    </div>

    ${coreCompHTML}
    ${signaturesHTML}
  `;

  await hydrateChampionIcons(mountEl);

  if (opts.debug) {
    console.log("🧩 Team Synergy S26", {
      season: currentSeason,
      totalGames,
      teamWR: teamWR.toFixed(1),
      bestDuo,
      bestBot,
      top3Overall,
      coreSlots,
      rosterPassed: roster,
      rowsIn: rows.length,
      rowsAfterFilter: rosterFiltered.length,
      rowsAfterSeason: filteredData.length,
    });
  }
}
