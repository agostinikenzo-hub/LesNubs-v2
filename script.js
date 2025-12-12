// ✅ Les Nübs Season 25 Google Sheet (published CSV link)
const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRbb898Zhxeml0wxUIeXQk33lY3eVDqIGepE7iEiHA0KQNMQKvQWedA4WMaKUXBuhKfrPjalVb-OvD9/pub?gid=331200910&single=true&output=csv";

const TIMELINE_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRbb898Zhxeml0wxUIeXQk33lY3eVDqIGepE7iEiHA0KQNMQKvQWedA4WMaKUXBuhKfrPjalVb-OvD9/pub?gid=1195101739&single=true&output=csv";


let trendWindow = 10; // Default trend window
let cachedRows = null; // Cached CSV data for faster re-renders
let cachedTimelineRows = null; // 🔹 add this: timeline cache

// --- Default Player Avatars ---
const basePlayers = [
  { name: "Betzhamo", svg: "assets/avatars/betzhamo.svg", color: "#f97316" },
  { name: "Jansen", svg: "assets/avatars/jansen.svg", color: "#3b82f6" },
  { name: "Sweeney", svg: "assets/avatars/sweeney.svg", color: "#22c55e" },
  { name: "denotes", svg: "assets/avatars/ota.svg", color: "#a855f7" },
  { name: "Burningelf", svg: "assets/avatars/achten.svg", color: "#f59e0b" },
  { name: "HH", svg: "assets/avatars/hh.svg", color: "#ef4444" },
  { name: "Emorek",    svg: "assets/avatars/emorek.svg",    color: "#0ea5e9" }, // NEW
];

let players = [...basePlayers];

// --- Generate a random pastel color ---
function randomPastelColor() {
  const hue = Math.floor(Math.random() * 360);
  return `hsl(${hue}, 70%, 75%)`;
}

// --- WIN DETECTION HELPER ---
function isWin(result) {
  return /^(yes|y|win|wins|won|w)$/i.test(String(result).trim());
}

// --- CHARACTER SELECTION ---
function renderCharacterSelect() {
  const container = document.getElementById("avatars");
  if (!container) return;

  container.innerHTML = players
    .map(
      (p) => `
      <div class="character cursor-pointer text-center avatar-fall" data-player="${p.name}" data-color="${p.color}">
        <div class="relative w-20 h-20 mx-auto rounded-full bg-white shadow border border-gray-200 flex items-center justify-center transition-transform hover:scale-105">
          <img src="${p.svg}" alt="${p.name}" class="w-12 h-12 object-contain" loading="lazy" onerror="this.src='assets/avatars/default.svg';" />
        </div>
        <p class="mt-2 text-sm font-semibold text-gray-700">${p.name}</p>
      </div>`
    )
    .join("");

  document.querySelectorAll(".character").forEach((el) => {
    el.addEventListener("click", () =>
      selectCharacter(el.dataset.player, el.dataset.color)
    );
  });
}

let selectedPlayer = null;
let selectedColor = null;

function selectCharacter(name, color) {
  selectedPlayer = name;
  selectedColor = color;

  document.querySelectorAll(".character").forEach((el) => {
    const ring = el.querySelector("div");
    ring.style.boxShadow = "none";
    el.querySelector("p").classList.remove("text-orange-500");
  });

  const el = document.querySelector(`.character[data-player="${name}"]`);
  if (el) {
    const ring = el.querySelector("div");
    ring.style.boxShadow = `0 0 10px 3px ${color}`;
    el.querySelector("p").classList.add("text-orange-500");
  }

  highlightPlayerStats(name, color);
}

function highlightPlayerStats(name, color) {
  document.querySelectorAll("[data-player-stat]").forEach((el) => {
    el.style.backgroundColor = "";
    el.style.boxShadow = "";
    el.classList.remove("ring-2", "ring-offset-1");
  });

  document.querySelectorAll(`[data-player-stat="${name}"]`).forEach((el) => {
    el.style.backgroundColor = `${color}10`;
    el.style.boxShadow = `0 0 10px ${color}55`;
    el.classList.add("ring-2", "ring-offset-1");
    el.style.setProperty("--tw-ring-color", color);
  });
}

// --- LOAD DATA ---
async function loadData() {
  const status = document.getElementById("status");

  try {
    if (cachedRows) {
      renderAllSections(cachedRows);
      return;
    }

    const res = await fetch(SHEET_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const csv = await res.text();
    const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });

    let rows = parsed.data.map((row) => {
      const clean = {};
      for (const key in row) {
        if (!key) continue;
        const normalized = key.trim().replace(/\s+/g, " ");
        clean[normalized] =
          typeof row[key] === "string" ? row[key].trim() : row[key];
      }
      return clean;
    });

    cachedRows = rows;

    status.textContent = `✅ Loaded ${rows.length} records`;
    status.className = "text-green-600 text-sm mb-4";
    console.log("✅ Parsed first 3 rows:", rows.slice(0, 3));

    renderAllSections(rows);
  } catch (err) {
    console.error("❌ loadData error:", err);
    status.textContent =
      "⚠️ Error loading data. Check Google Sheet access or format.";
    status.className = "text-red-600 text-sm mb-4";
  }
}

// --- LOAD TIMELINE DATA (lane-by-lane, per minute) ---
async function loadTimelineData() {
  if (cachedTimelineRows) return cachedTimelineRows;

  try {
    const res = await fetch(TIMELINE_SHEET_URL);
    if (!res.ok) throw new Error(`Timeline HTTP ${res.status}`);

    const csv = await res.text();
    const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });

    cachedTimelineRows = parsed.data.map((row) => {
      const clean = {};
      for (const key in row) {
        if (!key) continue;
        const normalized = key.trim().replace(/\s+/g, " ");
        clean[normalized] =
          typeof row[key] === "string" ? row[key].trim() : row[key];
      }
      return clean;
    });

    console.log("✅ Timeline loaded:", cachedTimelineRows.length, "rows");
    return cachedTimelineRows;
  } catch (err) {
    console.error("❌ loadTimelineData error:", err);
    return null;
  }
}


// --- HELPER: Render all dashboard parts (Safe + Debug Logging) ---
function renderAllSections(rows) {
  if (!rows || !rows.length) return;

  console.log("🟠 Rendering all dashboard sections...");

  // ✅ Detect guest players dynamically
  const sheetNames = [...new Set(rows.map((r) => r["Player"]?.trim()).filter(Boolean))];
  const knownNames = basePlayers.map((p) => p.name);
  const guestNames = sheetNames.filter((n) => !knownNames.includes(n));

  const guestPlayers = guestNames.map((name) => ({
    name,
    svg: "assets/avatars/default.svg",
    color: randomPastelColor(),
    guest: true,
  }));

  players = [...basePlayers, ...guestPlayers];

  const splits = { "Split 1": [], "Split 2": [], "Split 3": [], "Season 25": [] };
  rows.forEach((row) => {
    const split = (row["Split"] || "").trim();
    if (splits[split]) splits[split].push(row);
    splits["Season 25"].push(row);
  });

  // --- Safe render call helper ---
  const safeRender = (fnName, fn, args = []) => {
    try {
      if (typeof fn === "function") {
        fn(...args);
        console.log(`✅ ${fnName} rendered successfully`);
      } else {
        console.warn(`⚠️ ${fnName} not defined`);
      }
    } catch (err) {
      console.error(`❌ Error in ${fnName}:`, err);
    }
  };

  // --- Render all sections safely ---
  safeRender("renderSummary", renderSummary, [splits["Season 25"]]);

  // 🔹 FIXED: pass data via args array instead of using logsData
  safeRender("LastSessionCard", renderLastSessionCard, [splits["Season 25"]]);

  safeRender("renderObjectiveImpact", renderObjectiveImpact, [splits["Season 25"]]);
  safeRender(
    "renderTeamSynergy",
    typeof renderTeamSynergy !== "undefined" ? renderTeamSynergy : null,
    [splits["Season 25"]]
  );

  // --- Lane Dynamics (uses timeline sheet) ---
  if (typeof renderLaneDynamics !== "undefined") {
    if (cachedTimelineRows) {
      safeRender("renderLaneDynamics", renderLaneDynamics, [
        splits["Season 25"],
        cachedTimelineRows,
      ]);
    } else {
      loadTimelineData()
        .then((timeline) => {
          if (timeline && timeline.length) {
            safeRender("renderLaneDynamics", renderLaneDynamics, [
              splits["Season 25"],
              timeline,
            ]);
          }
        })
        .catch((err) => console.error("❌ Lane Dynamics render error:", err));
    }
  }

  // safeRender("renderPerformanceImpact", renderPerformanceImpact, [splits["Season 25"]]);
  safeRender(
    "renderOverview",
    typeof renderOverview !== "undefined" ? renderOverview : null,
    [splits["Season 25"]]
  );
  // safeRender("renderTrends", renderTrends, [splits["Season 25"]]);
  safeRender("renderSplits", renderSplits, [splits]);
  safeRender("renderCharacterSelect", renderCharacterSelect, []);

  // 🔹 NEW: Objectives — First-hit impact card (uses timeline)
  if (typeof renderObjectives !== "undefined") {
    const callObjectives = (timeline) => {
      safeRender("renderObjectives", renderObjectives, [
        splits["Season 25"],
        timeline || [],
      ]);
    };

    if (cachedTimelineRows && cachedTimelineRows.length) {
      // timeline already loaded
      callObjectives(cachedTimelineRows);
    } else {
      // load it, then render
      loadTimelineData()
        .then((timeline) => {
          if (timeline && timeline.length) {
            callObjectives(timeline);
          } else {
            // still render, but with empty timeline to avoid the "not wired" copy
            callObjectives([]);
          }
        })
        .catch((err) => {
          console.error("❌ Objectives timeline error:", err);
          callObjectives([]); // graceful fallback
        });
    }
  }
}



// --- CALCULATE PLAYER STATS ---
function calcStats(data) {
  const players = {};
  data.forEach((row) => {
    const name = row["Player"]?.trim();
    if (!name) return;

    const kills = parseFloat((row["Kills"] || "").replace(",", ".")) || 0;
    const deaths = parseFloat((row["Deaths"] || "").replace(",", ".")) || 0;
    const assists = parseFloat((row["Assists"] || "").replace(",", ".")) || 0;
    const opgg = parseFloat((row["OP.GG Score"] || "").replace(",", ".")) || null;
    const kp = parseFloat((row["Kill Part %"] || "").replace(",", ".")) || null;

    const result = (row["Result"] || "").trim();
    const win = isWin(result) ? 1 : 0;
    const mvp = (row["MVP"] || "").toLowerCase().trim();
    const ace = (row["ACE"] || "").toLowerCase().trim();

    if (!players[name])
      players[name] = {
        kills: 0,
        deaths: 0,
        assists: 0,
        wins: 0,
        games: 0,
        mvps: 0,
        aces: 0,
        kpSum: 0,
        kpCount: 0,
        opggSum: 0,
        opggCount: 0,
        gameHistory: [],
        kpHistory: [],
        opggHistory: [],
      };

    players[name].kills += kills;
    players[name].deaths += deaths;
    players[name].assists += assists;
    players[name].wins += win;
    players[name].games += 1;
    players[name].mvps += mvp === "yes" ? 1 : 0;
    players[name].aces += ace === "yes" ? 1 : 0;

    if (kp) {
      players[name].kpSum += kp;
      players[name].kpCount += 1;
      players[name].kpHistory.push(kp);
    }
    if (opgg) {
      players[name].opggSum += opgg;
      players[name].opggCount += 1;
      players[name].opggHistory.push(opgg);
    }

    const kda = deaths === 0 ? kills + assists : (kills + assists) / deaths;
    players[name].gameHistory.push(kda);
  });

  return players;
}

// ============================================================================
// 📊 SEASON 25 SUMMARY — v3.1.2
// - Correct Kill Participation scaling
// - Adds "Most Played Champions (Top 5)" mini card
// - Fixes Season button label
// - Restores side winrate logic to previous working version
// - NEW: Blue/Red side winrate values are colored (blue/red)
// Renders into #season-summary
// ============================================================================

let summaryTrendWindow = "season";
let staticLastUpdated = "—"; // set once per dataset

function renderSummary(data) {
  try {
    if (!data || !data.length) return;

    // ---------- Helpers ----------
    const normSeason = (v) => String(v ?? "").trim();
    const normSplitNum = (v) => {
      const s = String(v ?? "").trim();
      if (!s) return null;
      const n = parseInt(s, 10);
      return Number.isFinite(n) ? n : null;
    };
    const toNum = (v) => {
      if (v === undefined || v === null || v === "") return 0;
      const n = parseFloat(String(v).replace("%", "").replace(",", "."));
      return Number.isFinite(n) ? n : 0;
    };
    const isOurTeam = (r) =>
      String(r["Team"] || "").toLowerCase().includes("les n");

    const getGameId = (r) =>
      r["Match ID"] || r["Game #"] || r["Game ID"] || r["Date"];

    // ---------- Static last updated ----------
    if (staticLastUpdated === "—") {
      const parsedDates = data
        .map((r) => {
          const d = String(r["Date"] || "").trim();
          const parts = d.split(/[ .:]/).filter(Boolean);
          if (parts.length >= 5) {
            const [day, month, year, hour, minute] = parts;
            const fullYear =
              year.length === 2 ? parseInt(`20${year}`, 10) : parseInt(year, 10);
            return new Date(fullYear, month - 1, day, +hour, +minute);
          }
          return null;
        })
        .filter((d) => d instanceof Date && !isNaN(d.getTime()))
        .sort((a, b) => a - b);

      if (parsedDates.length) {
        const last = parsedDates[parsedDates.length - 1];
        staticLastUpdated = last.toLocaleString("en-GB", {
          day: "2-digit",
          month: "2-digit",
          year: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        });
      }
    }

    // ---------- Season & Split detection ----------
    const ourRowsAll = data.filter(isOurTeam);
    const seasonSource = ourRowsAll.length ? ourRowsAll : data;

    const seasons = [...new Set(
      seasonSource.map((r) => normSeason(r["Season"])).filter(Boolean)
    )];
    const currentSeason = seasons.length
      ? seasons[seasons.length - 1]
      : "2025";

    const splitSource = ourRowsAll.length ? ourRowsAll : data;
    const splitNums = splitSource
      .map((r) => normSplitNum(r["Split"]))
      .filter((n) => n !== null);
    const currentSplit = splitNums.length
      ? Math.max(...splitNums)
      : null;

    // ---------- Trend window filtering ----------
    const getRecentGames = (n) => {
      const allGames = data.map((r) => getGameId(r)).filter(Boolean);
      const uniqueGames = [...new Set(allGames)];
      const recentGames = uniqueGames.slice(-n);
      return data.filter((r) => recentGames.includes(getGameId(r)));
    };

    const filteredData = (() => {
      switch (summaryTrendWindow) {
        case "5":
          return getRecentGames(5);
        case "10":
          return getRecentGames(10);
        case "split":
          if (currentSplit === null) return data;
          return data.filter(
            (r) => normSplitNum(r["Split"]) === currentSplit
          );
        case "season":
          return data.filter(
            (r) => normSeason(r["Season"]) === currentSeason
          );
        default:
          return data;
      }
    })();

    if (!filteredData.length) return;

    // For all team-level stats, restrict to our team rows where available
    const filteredOur = filteredData.filter(isOurTeam);
    const rowsForStats = filteredOur.length ? filteredOur : filteredData;

    // ---------- Unique games ----------
    const games = [...new Set(
      rowsForStats.map((r) => getGameId(r) || r["Date"])
    )];
    const totalGames = games.length;

    // ---------- Winrate ----------
    const wins = new Set(
      rowsForStats
        .filter((r) => String(r["Result"]).toLowerCase() === "win")
        .map((r) => getGameId(r))
        .filter(Boolean)
    ).size;

    const winrate =
      totalGames > 0 ? ((wins / totalGames) * 100).toFixed(1) : "0.0";

    // ---------- Side Winrates (restored logic) ----------
    const matchMap = new Map();
    rowsForStats.forEach((r) => {
      const id = getGameId(r);
      if (!id || matchMap.has(id)) return;
      matchMap.set(id, r);
    });
    const uniqueMatches = Array.from(matchMap.values());

    const blueGames = uniqueMatches.filter((r) => {
      const side = String(r["Team Side"] || "").toLowerCase();
      const winningTeam = parseInt(r["Winning Team"]);
      return side.includes("blue") || winningTeam === 100;
    });

    const redGames = uniqueMatches.filter((r) => {
      const side = String(r["Team Side"] || "").toLowerCase();
      const winningTeam = parseInt(r["Winning Team"]);
      return side.includes("red") || winningTeam === 200;
    });

    const blueWins = blueGames.filter(
      (r) => String(r["Result"]).toLowerCase() === "win"
    ).length;
    const redWins = redGames.filter(
      (r) => String(r["Result"]).toLowerCase() === "win"
    ).length;

    const blueWinrate = blueGames.length
      ? ((blueWins / blueGames.length) * 100).toFixed(1)
      : "0.0";
    const redWinrate = redGames.length
      ? ((redWins / redGames.length) * 100).toFixed(1)
      : "0.0";

    // ---------- Basic team stats ----------
    const totalKills = rowsForStats.reduce(
      (s, r) => s + toNum(r["Kills"]),
      0
    );
    const totalDeaths = rowsForStats.reduce(
      (s, r) => s + toNum(r["Deaths"]),
      0
    );
    const totalAssists = rowsForStats.reduce(
      (s, r) => s + toNum(r["Assists"]),
      0
    );

    const avgKDA =
      totalDeaths > 0
        ? ((totalKills + totalAssists) / totalDeaths).toFixed(2)
        : totalKills + totalAssists > 0
        ? "∞"
        : "0.00";

    // ---------- Kill Participation (fixed scaling) ----------
    const matchGroups = {};
    rowsForStats.forEach((r) => {
      const id = getGameId(r);
      if (!id) return;

      let raw = toNum(r["Kill Part %"]);
      if (!raw) return;

      // If data is stored as 0.26, 0.70 etc; convert to 26, 70
      if (raw > 0 && raw <= 1.01) {
        raw = raw * 100;
      }

      if (!matchGroups[id]) matchGroups[id] = [];
      matchGroups[id].push(raw);
    });

    const avgKP = Object.keys(matchGroups).length
      ? (
          Object.values(matchGroups)
            .map((arr) => arr.reduce((a, b) => a + b, 0) / arr.length)
            .reduce((a, b) => a + b, 0) /
          Object.keys(matchGroups).length
        ).toFixed(1)
      : "0.0";

    // ---------- Avg game time (minutes) ----------
    const timeValues = rowsForStats
      .map((r) => {
        const t = String(r["TIME"] || r["Game Time"] || "").trim();
        if (!t) return NaN;
        if (t.includes(":")) {
          const [m, s] = t.split(":").map((v) => +v || 0);
          return m + s / 60;
        }
        const num = parseFloat(t.replace(/[^0-9.]/g, ""));
        return isNaN(num) ? NaN : num;
      })
      .filter((n) => !isNaN(n));

    const avgTime = timeValues.length
      ? (timeValues.reduce((a, b) => a + b, 0) / timeValues.length).toFixed(1)
      : "—";

    // ---------- Streaks ----------
    const sortedGames = [...games].sort();
    let bestWin = 0,
      bestLoss = 0,
      tempW = 0,
      tempL = 0;

    sortedGames.forEach((gid) => {
      const rows = rowsForStats.filter(
        (r) => getGameId(r) === gid
      );
      if (!rows.length) return;
      const won = rows.some(
        (r) => String(r["Result"]).toLowerCase() === "win"
      );

      if (won) {
        tempW++;
        tempL = 0;
        if (tempW > bestWin) bestWin = tempW;
      } else {
        tempL++;
        tempW = 0;
        if (tempL > bestLoss) bestLoss = tempL;
      }
    });

    let streakCount = 0;
    let streakType = null; // "Win" or "Loss"
    for (let i = sortedGames.length - 1; i >= 0; i--) {
      const gid = sortedGames[i];
      const rows = rowsForStats.filter(
        (r) => getGameId(r) === gid
      );
      if (!rows.length) continue;
      const res = rows.some(
        (r) => String(r["Result"]).toLowerCase() === "win"
      )
        ? "Win"
        : "Loss";

      if (streakType === null) {
        streakType = res;
        streakCount = 1;
      } else if (res === streakType) {
        streakCount++;
      } else {
        break;
      }
    }

    const streakLabel =
      streakType === "Win"
        ? "Les Nübs is currently on a Winning Streak"
        : streakType === "Loss"
        ? "Les Nübs is currently on a Losing Streak"
        : "Les Nübs current streak";

    // ---------- Kill breakdown minis ----------
    const killTypes = [
      { key: "Double Kills", label: "Double Kill" },
      { key: "Triple Kills", label: "Triple Kill" },
      { key: "Quadra Kills", label: "Quadra Kill" },
      { key: "Penta Kills", label: "Penta Kill" },
    ];

    const killData = killTypes.map(({ key, label }) => {
      let total = 0;
      const playerCounts = {};
      rowsForStats.forEach((r) => {
        const val = toNum(r[key]);
        if (!val) return;
        total += val;
        const name = r["Player"] || "Unknown";
        playerCounts[name] = (playerCounts[name] || 0) + val;
      });

      const top = Object.entries(playerCounts).sort(
        (a, b) => b[1] - a[1]
      )[0];

      const footer =
        total > 0 && top && top[1] > 0
          ? `<span class="text-xs text-gray-500 font-normal">Top: ${top[0]} (${top[1]})</span>`
          : `<span class="text-xs text-gray-400 font-normal">No top ${label.toLowerCase()} killer</span>`;

      return { label, total, footer };
    });

    // ---------- Fun Fact Minis ----------
    const funRows = rowsForStats;

    let mostPink = { value: 0, player: "—" };
    let highestVision = { value: 0, player: "—" };
    let highestDamage = { value: 0, player: "—" };

    funRows.forEach((r) => {
      const player = r["Player"] || "Unknown";

      const pink =
        toNum(r["PINK"]) ||
        toNum(r["Pink Wards"]) ||
        toNum(r["Control Wards Purchased"]);
      if (pink > mostPink.value) {
        mostPink = { value: pink, player };
      }

      const vs = toNum(r["Vision Score"]);
      if (vs > highestVision.value) {
        highestVision = { value: vs, player };
      }

      const dmg = toNum(r["Damage Dealt"]);
      if (dmg > highestDamage.value) {
        highestDamage = { value: dmg, player };
      }
    });

    // ---------- Most Played Champions (Top 5) ----------
    const champGameMap = {};

    funRows.forEach((r) => {
      const champ = String(r["Champion"] || r["Champ"] || "").trim();
      const gid = getGameId(r);
      if (!champ || !gid) return;
      if (!champGameMap[champ]) champGameMap[champ] = new Set();
      champGameMap[champ].add(gid);
    });

    const topChamps = Object.entries(champGameMap)
      .map(([champ, set]) => ({ champ, games: set.size }))
      .sort((a, b) => b.games - a.games || a.champ.localeCompare(b.champ))
      .slice(0, 5);

    const mostPlayedFooter =
      topChamps.length
        ? `<div class="space-y-0.5 text-xs text-gray-600">
             ${topChamps
               .map(
                 (c, i) =>
                   `<div>${i + 1}. ${c.champ} <span class="text-gray-400">(${c.games})</span></div>`
               )
               .join("")}
           </div>`
        : `<span class="text-xs text-gray-400">No champion data</span>`;

    // ---------- Header buttons ----------
  const trendButtons = `
  <div class="flex gap-1 text-xs font-medium">
    ${["5", "10", "split", "season"]
      .map((w) => {
        const label =
          w === "5" ? "5 Games" :
          w === "10" ? "10 Games" :
          w === "split" ? "Current Split" :
          `Season ${currentSeason}`; // <-- use template literal here

        return `
          <button
            class="px-2.5 py-1 rounded-md border transition
              ${
                summaryTrendWindow === w
                  ? "bg-orange-500 text-white border-orange-500"
                  : "bg-white text-gray-700 border-gray-200 hover:border-orange-300 hover:text-orange-500"
              }"
            data-summary-window="${w}">
            ${label}
          </button>`;
      })
      .join("")}
  </div>`;


    // ---------- Build HTML ----------
    document.getElementById("season-summary").innerHTML = `
      <section class="section-wrapper fade-in mb-10">
        <div class="dashboard-card text-center bg-white shadow-sm rounded-2xl border border-orange-50">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
            <h2 class="text-[1.1rem] font-semibold text-orange-500 tracking-tight">
              Season ${currentSeason} Summary
            </h2>
            ${trendButtons}
          </div>

          <!-- Core Team Stats -->
          <div class="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
            ${renderMiniCard("Games", totalGames)}
            ${renderMiniCard("Winrate", `${winrate}%`)}
            ${renderMiniCard("Team KDA", avgKDA)}
            ${renderMiniCard("Avg. Kill Participation", `${avgKP}%`)}
            ${renderMiniCard("Avg. Time", `${avgTime} min`)}
          </div>

          <!-- Side Winrates + Streak + Last Updated -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            ${renderMiniCard("Blue Side Winrate", `${blueWinrate}%`, "text-lg font-semibold text-sky-600")}
            ${renderMiniCard("Red Side Winrate", `${redWinrate}%`, "text-lg font-semibold text-rose-600")}
            ${renderMiniCard(streakLabel, `${streakCount || 0} Games`)}
            ${renderMiniCard("Last Updated", staticLastUpdated, "text-sm")}
          </div>

          <!-- Fun Facts + Most Played Champions -->
          <div class="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-6">
            ${renderMiniCard(
              "Most Pink Wards in a Game",
              mostPink.value ? mostPink.value : "—",
              "text-lg font-semibold",
              mostPink.value
                ? `<span class="text-xs text-gray-500">by ${mostPink.player}</span>`
                : `<span class="text-xs text-gray-400">No data</span>`
            )}
            ${renderMiniCard(
              "Highest Vision Score",
              highestVision.value ? highestVision.value : "—",
              "text-lg font-semibold",
              highestVision.value
                ? `<span class="text-xs text-gray-500">by ${highestVision.player}</span>`
                : `<span class="text-xs text-gray-400">No data</span>`
            )}
            ${renderMiniCard(
              "Highest Damage Dealt",
              highestDamage.value
                ? highestDamage.value.toLocaleString("en-US")
                : "—",
              "text-lg font-semibold",
              highestDamage.value
                ? `<span class="text-xs text-gray-500">by ${highestDamage.player}</span>`
                : `<span class="text-xs text-gray-400">No data</span>`
            )}
            ${renderMiniCard(
              "Most Played Champions (Top 5)",
              topChamps.length ? "Top picks" : "—",
              "text-xs font-semibold text-gray-600",
              mostPlayedFooter
            )}
          </div>

          <!-- Kill Breakdown -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            ${killData
              .map((k) =>
                renderMiniCard(
                  k.label,
                  k.total,
                  "text-lg font-semibold",
                  k.footer
                )
              )
              .join("")}
          </div>
        </div>
      </section>
    `;

    // ---------- Events ----------
    document
      .querySelectorAll("[data-summary-window]")
      .forEach((btn) => {
        btn.addEventListener("click", () => {
          summaryTrendWindow = btn.getAttribute("data-summary-window");
          renderSummary(data);
        });
      });
  } catch (err) {
    console.error("Error in renderSummary:", err);
  }
}

// ---------- Mini Card Helper ----------
function renderMiniCard(
  label,
  value,
  valueClass = "text-lg font-semibold",
  footer = ""
) {
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

/// ============================================================================
/// 🕒 LAST SESSION HIGHLIGHTS v1.4 (FIX: local-day session bucketing for December)
/// - Uses rows from "test_logs_newdashboard"
/// - Session = latest date (optionally + previous consecutive date)
/// - Counts **unique games** via Game/Match ID (fallback: rows/5)
/// - Only shows card if there are ≥4 games in the session
/// - Metrics:
///     • KDA, Vision Created, Pink Wards, Vision Score, Damage to Objectives
///       => **per-game averages**
///     • Dragon / Baron / Atakhan Participation
///       => **games with participation / games played** (e.g. 3/4 (75%))
///       => shows **ALL** session participants (including 0/x)
///     • Vision→Objective Ratio, Carry Impact, Team Contribution
///       => per-game averages
/// - Renders into #last-session
/// ============================================================================

function renderLastSessionCard(logsData) {
  const container = document.getElementById("last-session");
  if (!container || !logsData || !logsData.length) return;

  // --- Helpers ---------------------------------------------------------------
  const toNum = (v) => {
    if (v === undefined || v === null || v === "") return 0;
    const n = parseFloat(String(v).replace("%", "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  };

  const pickCol = (data, candidates) => {
    if (!data || !data.length) return null;
    const row = data[0];
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      if (Object.prototype.hasOwnProperty.call(row, c)) return c;
    }
    return null;
  };

  const playerKey = (r) =>
    r["Player"] || r["Summoner Name"] || r["Summoner"] || r["IGN"];

  const getRawDateValue = (r) =>
    r["Game Start Time"] ||
    r["Game Date"] ||
    r["Game Datetime"] ||
    r["DateTime"] ||
    r["Date"] ||
    r["Match Date"] ||
    r["Game Time"];

  // --- Date helpers (FIXED) --------------------------------------------------
  // Handles:
  // - "27.11.25 20:52" (your sheet format)
  // - dd.mm.yyyy [HH:MM]
  // - yyyy-mm-dd[ HH:MM[:SS]]
  // - Date objects
  // - Google Sheets / Excel serial numbers
  const parseDateTime = (val) => {
    if (val === undefined || val === null || val === "") return null;

    if (val instanceof Date) {
      return isNaN(val.getTime()) ? null : val;
    }

    // Sheets/Excel serial date number (days since 1899-12-30)
    if (typeof val === "number" && Number.isFinite(val)) {
      const ms = Date.UTC(1899, 11, 30) + val * 86400000;
      const d = new Date(ms);
      return isNaN(d.getTime()) ? null : d;
    }

    const s = String(val).trim();
    if (!s) return null;

    // dd.mm.yy(yy) [HH:MM]
    let m = s.match(
      /^(\d{1,2})\.(\d{1,2})\.(\d{2,4})(?:[ T](\d{1,2}):(\d{2}))?$/
    );
    if (m) {
      let [, dd, mm, yy, HH, MM] = m;
      const day = parseInt(dd, 10);
      const month = parseInt(mm, 10) - 1;
      let year = parseInt(yy, 10);
      if (year < 100) year += 2000;
      const hour = HH !== undefined ? parseInt(HH, 10) : 0;
      const min = MM !== undefined ? parseInt(MM, 10) : 0;
      const d = new Date(year, month, day, hour, min, 0);
      return isNaN(d.getTime()) ? null : d;
    }

    // yyyy-mm-dd[ HH:MM[:SS]]  (build as LOCAL, don't rely on Date.parse quirks)
    m = s.match(
      /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
    );
    if (m) {
      const [, yy, mm, dd, HH, MM, SS] = m;
      const year = parseInt(yy, 10);
      const month = parseInt(mm, 10) - 1;
      const day = parseInt(dd, 10);
      const hour = HH !== undefined ? parseInt(HH, 10) : 0;
      const min = MM !== undefined ? parseInt(MM, 10) : 0;
      const sec = SS !== undefined ? parseInt(SS, 10) : 0;
      const d = new Date(year, month, day, hour, min, sec);
      return isNaN(d.getTime()) ? null : d;
    }

    // Fallback: native parse (last resort)
    const native = new Date(s);
    return isNaN(native.getTime()) ? null : native;
  };

  const formatDateLabel = (dateObj) => {
    if (!dateObj) return "—";
    const d = dateObj.getDate().toString().padStart(2, "0");
    const m = (dateObj.getMonth() + 1).toString().padStart(2, "0");
    const y = dateObj.getFullYear().toString();
    return `${d}.${m}.${y}`;
  };

  // IMPORTANT FIX: bucket by LOCAL calendar day (not UTC)
  const dateKey = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  // Local calendar diff (DST-safe)
  const diffDays = (d1, d2) => {
    const t1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
    const t2 = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
    return Math.round((t1 - t2) / 86400000);
  };

  // --- 1) Build date map & determine "Last Session" -------------------------
  const datedRows = logsData
    .map((r) => {
      const raw = getRawDateValue(r);
      const d = parseDateTime(raw);
      return { row: r, dateObj: d, raw };
    })
    .filter((x) => x.dateObj);

  if (!datedRows.length) {
    container.innerHTML = `
      <section class="section-wrapper fade-in mb-4">
        <div class="dashboard-card bg-white shadow-sm rounded-2xl border border-gray-100 px-4 py-3">
          <h2 class="text-[1rem] font-semibold text-slate-700">Last Session</h2>
          <p class="text-[0.7rem] text-slate-500">
            No valid date/time values found in <span class="font-semibold">test_logs_newdashboard</span>.
            Once the log sheet has game timestamps, this card will highlight the latest session.
          </p>
        </div>
      </section>`;
    return;
  }

  const byDateKey = {};
  const keyToDate = {};

  datedRows.forEach(({ row, dateObj }) => {
    const key = dateKey(dateObj);
    if (!byDateKey[key]) {
      byDateKey[key] = [];
      keyToDate[key] = dateObj;
    }
    byDateKey[key].push(row);
  });

  // Sort by key "YYYY-MM-DD" (works lexicographically)
  const sortedKeys = Object.keys(byDateKey).sort((a, b) => (a < b ? -1 : 1));
  if (!sortedKeys.length) return;

  const latestKey = sortedKeys[sortedKeys.length - 1];
  const latestDateObj = keyToDate[latestKey];
  let sessionRows = [...byDateKey[latestKey]];
  let sessionLabel = formatDateLabel(latestDateObj);

  // Optionally extend session to previous consecutive day
  if (sortedKeys.length >= 2) {
    const prevKey = sortedKeys[sortedKeys.length - 2];
    const prevDateObj = keyToDate[prevKey];
    const dayDiff = diffDays(latestDateObj, prevDateObj);
    if (dayDiff === 1) {
      sessionRows = [...byDateKey[prevKey], ...sessionRows];
      sessionLabel = `${formatDateLabel(prevDateObj)} – ${formatDateLabel(
        latestDateObj
      )}`;
    }
  }

  // --- 1b) Count unique games instead of rows --------------------------------
  const gameIdCol = pickCol(sessionRows, [
    "Match ID",
    "MatchId",
    "Match ID (Riot)",
    "Game ID",
    "GameId",
    "GameID",
    "Game",
    "Match",
  ]);

  let totalGames = 0;
  if (gameIdCol) {
    const gameSet = new Set();
    sessionRows.forEach((r) => {
      const v = r[gameIdCol];
      if (v !== undefined && v !== null && String(v).trim() !== "") {
        gameSet.add(String(v).trim());
      }
    });
    totalGames = gameSet.size;
  }

  if (!totalGames) {
    const ROWS_PER_GAME_GUESS = 5;
    totalGames = Math.max(1, Math.round(sessionRows.length / ROWS_PER_GAME_GUESS));
  }

  // If session is too small, show info card (threshold = 4 games)
  if (totalGames < 1) {
    container.innerHTML = `
      <section class="section-wrapper fade-in mb-4">
        <div class="dashboard-card bg-white shadow-sm rounded-2xl border border-gray-100 px-4 py-3">
          <div class="flex items-center justify-between gap-2 mb-1">
            <h2 class="text-[1rem] font-semibold text-slate-700">Last Session</h2>
            <span class="text-[0.65rem] text-slate-500">Session: ${sessionLabel}</span>
          </div>
          <p class="text-[0.7rem] text-slate-500">
            Latest session only has <span class="font-semibold">${totalGames}</span> game${
              totalGames === 1 ? "" : "s"
            } (based on unique match IDs).
            This card activates once a session reaches at least <span class="font-semibold">4 games</span>.
          </p>
        </div>
      </section>`;
    return;
  }

  // --- 2) Metric setup -------------------------------------------------------
  const metricsConfig = [
    { key: "kda", label: "Best KDA", icon: "⚔️", statType: "avg", colCandidates: ["KDA", "KDA Ratio", "K/D/A"], format: (v) => v.toFixed(2) },
    { key: "visionCreated", label: "Most Vision Created (per game)", icon: "👁️", statType: "avg",
      colCandidates: ["Vision Created", "VisionCreated", "Vision Created Score"], format: (v) => v.toFixed(1) },
    { key: "pinkWards", label: "Control Wards (per game)", icon: "🏮", statType: "avg",
      colCandidates: ["Pink Wards", "Pink Wards Placed", "Control Wards Placed"], format: (v) => v.toFixed(1) },
    { key: "visionScore", label: "Best Vision Score (per game)", icon: "📡", statType: "avg",
      colCandidates: ["Vision Score", "VisionScore"], format: (v) => Math.round(v).toString() },
    { key: "dmgObj", label: "Damage to Objectives (per game)", icon: "🏹", statType: "avg",
      colCandidates: ["Damage to Objectives", "DamageToObjectives", "Dmg To Objectives"], format: (v) => Math.round(v).toLocaleString("en-US") },

    { key: "dragonPart", label: "Dragon Participation", icon: "🐉", statType: "participation", colCandidates: ["Dragon Participation", "Drake Participation"] },
    { key: "baronPart", label: "Baron Participation", icon: "🧬", statType: "participation", colCandidates: ["Baron Participation"] },
    { key: "atakhanPart", label: "Atakhan Participation", icon: "🔥", statType: "participation", colCandidates: ["Atakhan Participation"] },

    { key: "visionObjRatio", label: "Vision to Objective Ratio", icon: "🎯", statType: "avg",
      colCandidates: ["Vision to Objective Ratio", "Vision Obj Ratio"], format: (v) => v.toFixed(2) },
    { key: "carryImpact", label: "Carry Impact Score", icon: "💥", statType: "avg",
      colCandidates: ["Carry Impact Score"], format: (v) => v.toFixed(1) },
    { key: "teamContribution", label: "Team Contribution", icon: "🤝", statType: "avg",
      colCandidates: ["Team Contribution", "Team Contribution Score"], format: (v) => v.toFixed(1) },
  ];

  const activeMetrics = metricsConfig
    .map((m) => {
      const col = pickCol(sessionRows, m.colCandidates);
      return col ? { ...m, colName: col } : null;
    })
    .filter(Boolean);

  if (!activeMetrics.length) {
    container.innerHTML = `
      <section class="section-wrapper fade-in mb-4">
        <div class="dashboard-card bg-white shadow-sm rounded-2xl border border-gray-100 px-4 py-3">
          <div class="flex items-center justify-between gap-2 mb-1">
            <h2 class="text-[1rem] font-semibold text-slate-700">Last Session</h2>
            <span class="text-[0.65rem] text-slate-500">Session: ${sessionLabel}</span>
          </div>
          <p class="text-[0.7rem] text-slate-500">
            Found <span class="font-semibold">${totalGames}</span> games in the last session,
            but none of the expected metric columns are present in
            <span class="font-semibold">test_logs_newdashboard</span>.
          </p>
        </div>
      </section>`;
    return;
  }

  // --- 3) Aggregate per player (unique games per player; participation hits per game) ---
  const resolveMatchId = (row) => {
    const v =
      (gameIdCol ? row[gameIdCol] : null) ||
      row["Match ID"] ||
      row["MatchId"] ||
      row["Game ID"] ||
      row["GameId"] ||
      row["Game"] ||
      row["Match"];
    const s = String(v ?? "").trim();
    return s ? s : null;
  };

  const playerStats = {}; // name -> { player, gameIds:Set, rowGames:number, metrics:{} }

  sessionRows.forEach((row) => {
    const name = playerKey(row);
    if (!name) return;

    if (!playerStats[name]) {
      playerStats[name] = {
        player: name,
        gameIds: new Set(),
        rowGames: 0, // fallback if match id is missing
        metrics: {},
      };
    }

    const p = playerStats[name];

    const realId = resolveMatchId(row);
    const syntheticId = `ROW:${name}:${p.rowGames}`; // stable per-player
    const gameKey = realId || syntheticId;

    p.rowGames += 1;
    p.gameIds.add(gameKey);

    activeMetrics.forEach((m) => {
      const raw = row[m.colName];

      if (!p.metrics[m.key]) {
        p.metrics[m.key] = { sum: 0, count: 0 };
        if (m.statType === "participation") {
          p.metrics[m.key].hitGameIds = new Set();
        }
      }

      // Participation: keep them in list even if blank (blank = no hit)
      if (raw === undefined || raw === null || raw === "") return;

      let v;
      if (typeof raw === "string" && raw.trim().endsWith("%")) {
        const num = parseFloat(raw.replace("%", "").replace(",", "."));
        v = Number.isFinite(num) ? num / 100 : 0;
      } else {
        v = toNum(raw);
      }

      const stat = p.metrics[m.key];
      stat.sum += v;
      stat.count += 1;

      if (m.statType === "participation") {
        if (v > 0) stat.hitGameIds.add(gameKey);
      }
    });
  });

  // --- 4) Build per-metric lists (ALL players for ALL metrics) -----------------
  const allPlayers = Object.values(playerStats).filter((p) => p.gameIds.size > 0);

  const metricLists = activeMetrics
    .map((m) => {
      const entries = [];

      allPlayers.forEach((p) => {
        const gamesPlayed = p.gameIds.size;

        // Participation: hits/games for everyone (including 0/x)
        if (m.statType === "participation") {
          const stat = p.metrics[m.key];
          const hits = stat?.hitGameIds ? stat.hitGameIds.size : 0;

          entries.push({
            player: p.player,
            value: gamesPlayed ? hits / gamesPlayed : 0,
            games: gamesPlayed,
            metricHits: hits,
            metricGames: gamesPlayed,
          });
          return;
        }

        // Avg metrics: include everyone, even if blank -> treat as 0 (but only if they played)
        const stat = p.metrics[m.key];
        const value =
          stat && stat.count
            ? (m.statType === "sum" ? stat.sum : stat.sum / stat.count)
            : 0;

        entries.push({
          player: p.player,
          value,
          games: gamesPlayed,
          metricHits: null,
          metricGames: null,
          hasValue: !!(stat && stat.count),
        });
      });

      // Sort
      entries.sort((a, b) => {
        if (m.statType === "participation") {
          if (b.value !== a.value) return b.value - a.value;
          if ((b.metricHits || 0) !== (a.metricHits || 0))
            return (b.metricHits || 0) - (a.metricHits || 0);
          return a.player.localeCompare(b.player);
        }

        if (b.value !== a.value) return b.value - a.value;
        if ((b.hasValue ? 1 : 0) !== (a.hasValue ? 1 : 0))
          return (b.hasValue ? 1 : 0) - (a.hasValue ? 1 : 0);
        return a.player.localeCompare(b.player);
      });

      return { metric: m, list: entries };
    })
    .filter((x) => x.list.length > 0);

  // --- 5) Build HTML ---------------------------------------------------------
  const miniCardsHTML = metricLists
    .map(({ metric, list }) => {
      const rowsHTML = list
        .map((entry, idx) => {
          const rank = idx + 1;

          let labelValue;
          if (metric.statType === "participation") {
            const g = entry.metricGames || 0;
            const h = entry.metricHits || 0;
            const pct = g > 0 ? ((h / g) * 100).toFixed(0) : "0";
            labelValue = g > 0 ? `${h}/${g} (${pct}%)` : `0/0`;
          } else if (typeof metric.format === "function") {
            labelValue = metric.format(entry.value);
          } else {
            labelValue = entry.value.toFixed(2);
          }

          return `
            <div class="flex items-center justify-between gap-3">
              <span class="text-[0.65rem] text-slate-700 truncate">
                ${rank}. ${entry.player}
              </span>
              <span class="text-[0.65rem] font-semibold text-slate-900 whitespace-nowrap">
                ${labelValue}
              </span>
            </div>`;
        })
        .join("");

      const listClass =
        metric.statType === "participation"
          ? "space-y-0.5 max-h-32 overflow-auto pr-1"
          : "space-y-0.5";

      return `
        <div class="rounded-2xl border border-slate-100 bg-slate-50/70 px-3 py-2.5 flex flex-col">
          <div class="flex items-center justify-between mb-1">
            <div class="flex items-center gap-1.5 min-w-0">
              <span class="text-[0.9rem]">${metric.icon}</span>
              <span class="text-[0.7rem] font-semibold text-slate-800 truncate">
                ${metric.label}
              </span>
            </div>
            <span class="text-[0.6rem] text-slate-400">
              ${metric.statType === "participation" ? "Players" : "Le Top du Top"}
            </span>
          </div>
          <div class="${listClass}">
            ${rowsHTML}
          </div>
        </div>`;
    })
    .join("");

  container.innerHTML = `
    <section class="section-wrapper fade-in mb-4">
      <div class="dashboard-card bg-white shadow-sm rounded-2xl border border-gray-100 px-4 py-3">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
          <div>
            <h2 class="text-[1rem] font-semibold text-slate-800">Last Session</h2>
            <p class="text-[0.7rem] text-slate-500">
              Highlights from the most recent ${sessionLabel.includes("–") ? "session window" : "day"} —
              <span class="font-semibold">${totalGames}</span> game${totalGames === 1 ? "" : "s"} from
              <span class="font-semibold">${sessionLabel}</span>.
              Only these games are used for the cards below.
            </p>
          </div>
          <div class="text-[0.65rem] text-slate-500 text-right">
            Source: <span class="font-mono text-slate-600">test_logs_newdashboard</span>
          </div>
        </div>

        <div class="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          ${miniCardsHTML}
        </div>

        <p class="mt-2 text-[0.6rem] text-slate-400">
          Metrics are aggregated per player <span class="font-semibold">only across games in this session</span>.
          Most values are per-game averages; Dragon/Baron/Atakhan cards show
          how many of the session's games each player participated in (hits/games).
        </p>
      </div>
    </section>
  `;

  console.log("🕒 Last Session card rendered", {
    sessionLabel,
    totalGames,
    latestKey,
    activeMetrics: activeMetrics.map((m) => m.label),
    players: Object.keys(playerStats),
  });
}



// ============================================================================
// ⭐ TOTAL PLAYER IMPACT — v1.0 (UI Refined + Role Scores Patch)
// - Impact calculations & weighting unchanged
// - UI improvement:
//   • Role mix chips (%, games) sorted by share
//   • Flex label (UI only): "flex" if >=10% share in 2+ roles
//   • NEW: show "role-fit score" per role played (projection / UI only)
//     - This does NOT change the main Impact score
//     - Role-fit score = same composites, but forced into a single role profile
// - Clean table: show main role + up to 2 extra role chips, rest in "+N" tooltip
// Renders into #objective-impact
// ============================================================================

let objectiveTrendWindow = "season";
let previousTPI = {};
let previousObjSummary = {};

function renderObjectiveImpact(data) {
  if (!data || !data.length) return;

  // ---------- Helpers ----------
  const toNum = (v) => {
    if (v === undefined || v === null || v === "") return 0;
    const n = parseFloat(String(v).replace("%", "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  };

  const normSeason = (v) => String(v ?? "").trim();

  const normSplitNum = (v) => {
    const s = String(v ?? "").trim();
    if (!s) return null;
    const n = parseInt(s, 10);
    return Number.isFinite(n) ? n : null;
  };

  const isOurTeam = (r) =>
    String(r["Team"] || "").toLowerCase().includes("les n");

  const getGameId = (r) =>
    r["Match ID"] || r["Game #"] || r["Game ID"] || r["Date"];

  // ---------- Role UI rules (NO score changes) ----------
  const FLEX_ROLE_SHARE = 0.10; // >=10% share in 2+ roles => flex label
  const SHOW_ROLE_SHARE = 0.10; // show roles >=10% (and always show main role)
  const MAX_ROLE_CHIPS = 3; // main + two extras (rest goes into "+N")
  const roleShort = (r) => {
    const R = String(r || "").toUpperCase();
    if (R === "JUNGLE") return "JNG";
    if (R === "SUPPORT") return "SUP";
    return R || "MID";
  };

  // ---------- Detect current season & split from our games ----------
  const ourRowsAll = data.filter(isOurTeam);
  const seasonSource = ourRowsAll.length ? ourRowsAll : data;

  const seasons = [
    ...new Set(
      seasonSource
        .map((r) => normSeason(r["Season"]))
        .filter(Boolean)
    ),
  ];
  const currentSeason = seasons.length ? seasons[seasons.length - 1] : "2025";

  // Normalize for label (avoid "Season Season 25")
  const currentSeasonLabel = (() => {
    const s = String(currentSeason || "").trim();
    if (!s) return "Season";
    const lower = s.toLowerCase();
    if (lower.startsWith("season")) {
      const num = s.replace(/[^0-9]/g, "");
      return num ? `Season ${num}` : s;
    }
    return `Season ${s}`;
  })();

  const splitSource = ourRowsAll.length ? ourRowsAll : data;
  const splitNums = splitSource
    .map((r) => normSplitNum(r["Split"]))
    .filter((n) => n !== null);
  const currentSplit = splitNums.length > 0 ? Math.max(...splitNums) : null;

  // ---------- Filter by window ----------
  const getRecentGames = (n) => {
    const allGames = data.map((r) => getGameId(r)).filter(Boolean);
    const uniqueGames = [...new Set(allGames)];
    const recentGames = uniqueGames.slice(-n);
    return data.filter((r) => recentGames.includes(getGameId(r)));
  };

  const filteredData = (() => {
    switch (objectiveTrendWindow) {
      case "5":
        return getRecentGames(5);
      case "10":
        return getRecentGames(10);
      case "split":
        if (currentSplit === null) return data;
        return data.filter((r) => normSplitNum(r["Split"]) === currentSplit);
      case "season":
        return data.filter((r) => normSeason(r["Season"]) === currentSeason);
      default:
        return data;
    }
  })();

  if (!filteredData.length) return;

  // ---------- Game ID key ----------
  const gameIdKey =
    ["Match ID", "Game #", "Game ID", "MatchID", "Date"].find(
      (k) => k in (filteredData[0] || {})
    ) || "Game #";

  // ---------- One row per match for team-level view ----------
  const matchMap = new Map();
  filteredData.forEach((r) => {
    const id = getGameId(r);
    if (!id || matchMap.has(id)) return;
    matchMap.set(id, r);
  });
  const uniqueMatches = Array.from(matchMap.values());
  const totalGames = uniqueMatches.length || 1;

  // ---------- Winrates (kept for context; not rendered as mini-cards here) ----------
  const wins = uniqueMatches.filter(
    (r) => String(r["Result"]).toLowerCase() === "win"
  ).length;
  const overallWinrate = (wins / totalGames) * 100;

  const blueGames = uniqueMatches.filter(
    (r) =>
      (r["Team Side"] || "").toString().toLowerCase().includes("blue") ||
      parseInt(r["Winning Team"]) === 100
  );
  const redGames = uniqueMatches.filter(
    (r) =>
      (r["Team Side"] || "").toString().toLowerCase().includes("red") ||
      parseInt(r["Winning Team"]) === 200
  );

  const blueWins = blueGames.filter(
    (r) => String(r["Result"]).toLowerCase() === "win"
  ).length;
  const redWins = redGames.filter(
    (r) => String(r["Result"]).toLowerCase() === "win"
  ).length;

  const blueWinrate = blueGames.length ? (blueWins / blueGames.length) * 100 : 0;
  const redWinrate = redGames.length ? (redWins / redGames.length) * 100 : 0;

  // ---------- Objective summary (unchanged calculations; stored for trends) ----------
  const calcObjective = (killsKey, firstKey, emoji, label) => {
    const controlGames = uniqueMatches.filter(
      (r) =>
        String(r[firstKey]).toUpperCase() === "TRUE" || toNum(r[killsKey]) > 0
    );

    const controlPct = (controlGames.length / totalGames) * 100;

    const winrateWhenSecured = controlGames.length
      ? (controlGames.filter((r) => String(r["Result"]).toLowerCase() === "win")
          .length /
          controlGames.length) *
        100
      : 0;

    const prev = previousObjSummary[label] || {};
    const delta =
      typeof prev.winrate === "number" ? winrateWhenSecured - prev.winrate : 0;

    previousObjSummary[label] = {
      control: controlPct,
      winrate: winrateWhenSecured,
    };

    return { emoji, label, control: controlPct, winrate: winrateWhenSecured, delta };
  };

  const objectiveCards = [
    calcObjective("Dragon Kills", "First Dragon (Team)", "🐉", "Dragon"),
    calcObjective("Herald Kills", "First Herald (Team)", "🪄", "Herald"),
    calcObjective("Baron Kills", "First Baron (Team)", "👑", "Baron"),
    calcObjective("Tower Kills", "First Tower (Team)", "🏰", "Tower"),
    calcObjective("Atakhan Participation", "First Atakhan (Team)", "🔥", "Atakhan"),
    calcObjective("Void Grub Participation", "First Void Grub (Team)", "🪲", "Void Grub"),
  ];

  // ---------- Adaptive Objective Weights (unchanged) ----------
  const objectivesList = ["Dragon", "Herald", "Baron", "Tower", "Atakhan", "Void Grub"];

  const staticDefaults = {
    Dragon: 0.25,
    Herald: 0.1,
    Baron: 0.3,
    Tower: 0.15,
    Atakhan: 0.1,
    "Void Grub": 0.1,
  };

  const importance = {};
  const minGamesForReliability = 5;

  objectivesList.forEach((obj) => {
    const killsKey =
      obj === "Dragon"
        ? "Dragon Kills"
        : obj === "Herald"
        ? "Herald Kills"
        : obj === "Baron"
        ? "Baron Kills"
        : obj === "Tower"
        ? "Tower Kills"
        : obj === "Atakhan"
        ? "Atakhan Participation"
        : "Void Grub Participation";

    const firstKey = `First ${obj} (Team)`;

    const secured = uniqueMatches.filter(
      (r) => String(r[firstKey]).toUpperCase() === "TRUE" || toNum(r[killsKey]) > 0
    );
    const notSecured = uniqueMatches.filter((r) => !secured.includes(r));

    if (secured.length + notSecured.length < minGamesForReliability) {
      importance[obj] = null;
      return;
    }

    const winSecured =
      secured.filter((r) => String(r["Result"]).toLowerCase() === "win").length /
      Math.max(1, secured.length);

    const winNot =
      notSecured.filter((r) => String(r["Result"]).toLowerCase() === "win").length /
      Math.max(1, notSecured.length);

    importance[obj] = Math.max(0, winSecured - winNot);
  });

  const validImps = Object.values(importance).filter((v) => v && v > 0);
  const totalImp = validImps.reduce((a, b) => a + b, 0);

  const objWeights = {};
  objectivesList.forEach((obj) => {
    const adaptive =
      totalImp > 0 && importance[obj] ? importance[obj] / totalImp : staticDefaults[obj];
    objWeights[obj] = 0.7 * adaptive + 0.3 * staticDefaults[obj];
  });

  const totalW = Object.values(objWeights).reduce((a, b) => a + b, 0) || 1;
  Object.keys(objWeights).forEach((k) => (objWeights[k] = objWeights[k] / totalW));

  // ---------- Per-player aggregation (unchanged) ----------
  const playerStats = {};
  const roleFrequency = {};

  filteredData.forEach((r) => {
    const name = (r["Player"] || "").trim();
    if (!name) return;

    const role = (r["ROLE"] || "").trim().toUpperCase() || "MID";
    const matchId = r[gameIdKey];

    if (!playerStats[name]) {
      playerStats[name] = {
        role,
        gamesSet: new Set(),
        totals: {},
        objKills: 0,

        // raw / individual
        kills: 0,
        deaths: 0,
        assists: 0,
        kdaSum: 0,
        kpSum: 0,
        kpCount: 0,
        dmgShareSum: 0,
        dpmSum: 0,
        goldMinSum: 0,
        csMinSum: 0,
        soloKills: 0,
        plates: 0,
        mechSum: 0,
        tactSum: 0,
        carrySum: 0,
        perfRatingSum: 0,
      };
    }

    const s = playerStats[name];
    if (matchId) s.gamesSet.add(matchId);

    const metrics = [
      "Objective Control Balance",
      "Objective Conversion Rate",
      "Objectives per Teamfight",
      "Objective Kills",
      "Early Objective Ratio",
      "Dragon Participation",
      "Herald Participation",
      "Baron Participation",
      "Tower Participation",
      "Atakhan Participation",
      "Void Grub Participation",
      "Vision-Objective Sync",
      "Vision to Objective Ratio",
      "Vision Advantage",
      "Vision Denial Efficiency",
      "Vision Impact Factor",
      "Tempo Efficiency Index",
      "Tempo Leader Index",
      "Early Gold Share",
      "Gold Momentum Rate",
      "Macro Consistency",
      "Macro Strength Index",
      "Comeback Index",
      "Synergy Index",
      "Shared Participation Rate",
      "Team Coordination Efficiency",
      "Teamfight Efficiency",
      "Consistency Index",
      "Momentum Stability",
      "Baron Control %",
      "Tower Control %",
    ];

    metrics.forEach((m) => {
      s.totals[m] = (s.totals[m] || 0) + toNum(r[m]);
    });

    s.objKills += toNum(r["Objective Kills"]);

    // individual-layer metrics
    const kills = toNum(r["Kills"]);
    const deaths = toNum(r["Deaths"]);
    const assists = toNum(r["Assists"]);
    const kdaVal = toNum(r["KDA"]);
    const kp = toNum(r["Kill Part %"]);
    const dmgShare = toNum(r["Team Damage %"]);
    const dpm = toNum(r["Damage per Minute"]);
    const goldMin = toNum(r["Gold/min"]);
    const csMin = toNum(r["CS/min"]);
    const solo = toNum(r["Solo Kills"]);
    const plates = toNum(r["Turret Plates Taken"]);
    const mech = toNum(r["Mechanical Impact"]);
    const tact = toNum(r["Tactical Intelligence"]);
    const carry = toNum(r["Carry Impact Score"]);
    const pr = toNum(r["Performance Rating"]);

    s.kills += kills;
    s.deaths += deaths;
    s.assists += assists;
    s.kdaSum += kdaVal || (deaths > 0 ? (kills + assists) / deaths : kills + assists);

    if (kp > 0) {
      s.kpSum += kp;
      s.kpCount += 1;
    }
    s.dmgShareSum += dmgShare;
    s.dpmSum += dpm;
    s.goldMinSum += goldMin;
    s.csMinSum += csMin;
    s.soloKills += solo;
    s.plates += plates;
    s.mechSum += mech;
    s.tactSum += tact;
    s.carrySum += carry;
    s.perfRatingSum += pr;

    if (!roleFrequency[name]) roleFrequency[name] = {};
    if (role) roleFrequency[name][role] = (roleFrequency[name][role] || 0) + 1;
  });

  let playerStatsArr = Object.entries(playerStats).map(([name, s]) => {
    const games = s.gamesSet.size || 1;
    const avg = (key) => (s.totals[key] || 0) / games;

    const control =
      (avg("Objective Control Balance") + avg("Baron Control %") + avg("Tower Control %")) / 3;

    const conversion =
      (avg("Objective Conversion Rate") + avg("Objective Kills") + avg("Early Objective Ratio")) /
      3;

    const participation =
      avg("Dragon Participation") * (objWeights.Dragon || 0) +
      avg("Herald Participation") * (objWeights.Herald || 0) +
      avg("Baron Participation") * (objWeights.Baron || 0) +
      avg("Tower Participation") * (objWeights.Tower || 0) +
      avg("Atakhan Participation") * (objWeights.Atakhan || 0) +
      avg("Void Grub Participation") * (objWeights["Void Grub"] || 0);

    const vision =
      (avg("Vision Advantage") +
        avg("Vision-Objective Sync") +
        avg("Vision to Objective Ratio") +
        avg("Vision Denial Efficiency") +
        avg("Vision Impact Factor")) /
      5;

    const tempo =
      (avg("Tempo Efficiency Index") +
        avg("Tempo Leader Index") +
        avg("Early Gold Share") +
        avg("Gold Momentum Rate") +
        avg("Macro Consistency") +
        avg("Macro Strength Index") +
        avg("Comeback Index")) /
      7;

    const consistency =
      (avg("Synergy Index") +
        avg("Shared Participation Rate") +
        avg("Team Coordination Efficiency") +
        avg("Teamfight Efficiency") +
        avg("Consistency Index") +
        avg("Momentum Stability")) /
      6;

    const killsPg = s.kills / games;
    const deathsPg = s.deaths / games;
    const assistsPg = s.assists / games;
    const avgKDA = s.kdaSum / games;
    const avgKP = s.kpCount > 0 ? s.kpSum / s.kpCount : 0;
    const avgDmgShare = s.dmgShareSum / games;
    const avgDPM = s.dpmSum / games;
    const avgGoldMin = s.goldMinSum / games;
    const avgCSMin = s.csMinSum / games;
    const avgSolo = s.soloKills / games;
    const avgPlates = s.plates / games;
    const avgMech = s.mechSum / games;
    const avgTact = s.tactSum / games;
    const avgCarry = s.carrySum / games;
    const avgPerfRating = s.perfRatingSum / games;

    return {
      name,
      role: s.role,
      games,
      control,
      conversion,
      participation,
      vision,
      tempo,
      consistency,
      indiv: {
        avgKDA,
        avgKP,
        avgDmgShare,
        avgDPM,
        avgGoldMin,
        avgCSMin,
        avgSolo,
        avgPlates,
        deathsPg,
        avgMech,
        avgTact,
        avgCarry,
        avgPerfRating,
        killsPg,
        assistsPg,
      },
      impact: 0,
      delta: 0,
    };
  });

  if (!playerStatsArr.length) return;

  // ---------- Normalization helpers ----------
  const buildMinMax = (vals) => {
    const v = vals.filter((x) => typeof x === "number" && !isNaN(x));
    if (!v.length) return { min: 0, max: 1 };
    return { min: Math.min(...v), max: Math.max(...v) };
  };

  const norm = (v, mm, invert = false) => {
    const { min, max } = mm;
    if (!isFinite(min) || !isFinite(max) || max === min) return 0.5;
    let x = (v - min) / (max - min);
    x = Math.max(0, Math.min(1, x));
    return invert ? 1 - x : x;
  };

  const mmControl = buildMinMax(playerStatsArr.map((p) => p.control));
  const mmConversion = buildMinMax(playerStatsArr.map((p) => p.conversion));
  const mmPart = buildMinMax(playerStatsArr.map((p) => p.participation));
  const mmVision = buildMinMax(playerStatsArr.map((p) => p.vision));
  const mmTempo = buildMinMax(playerStatsArr.map((p) => p.tempo));
  const mmConsist = buildMinMax(playerStatsArr.map((p) => p.consistency));

  const mmKDA = buildMinMax(playerStatsArr.map((p) => p.indiv.avgKDA));
  const mmKP = buildMinMax(playerStatsArr.map((p) => p.indiv.avgKP));
  const mmDmgShare = buildMinMax(playerStatsArr.map((p) => p.indiv.avgDmgShare));
  const mmDPM = buildMinMax(playerStatsArr.map((p) => p.indiv.avgDPM));
  const mmGold = buildMinMax(playerStatsArr.map((p) => p.indiv.avgGoldMin));
  const mmCS = buildMinMax(playerStatsArr.map((p) => p.indiv.avgCSMin));
  const mmSolo = buildMinMax(playerStatsArr.map((p) => p.indiv.avgSolo));
  const mmPlates = buildMinMax(playerStatsArr.map((p) => p.indiv.avgPlates));
  const mmDeaths = buildMinMax(playerStatsArr.map((p) => p.indiv.deathsPg));
  const mmMech = buildMinMax(playerStatsArr.map((p) => p.indiv.avgMech));
  const mmTact = buildMinMax(playerStatsArr.map((p) => p.indiv.avgTact));
  const mmCarry = buildMinMax(playerStatsArr.map((p) => p.indiv.avgCarry));
  const mmPR = buildMinMax(playerStatsArr.map((p) => p.indiv.avgPerfRating));

  // ---------- Role-weighted composites (unchanged calculations; + role-fit score projection) ----------
  playerStatsArr = playerStatsArr.map((p) => {
    const freq = roleFrequency[p.name] || {};
    let roleFractions = Object.entries(freq); // [role, count]
    const totalGamesRole = roleFractions.reduce((a, [, c]) => a + c, 0);

    if (!totalGamesRole) {
      roleFractions = [[(p.role || "MID").toUpperCase(), 1]];
    } else {
      roleFractions = roleFractions.map(([r, c]) => [String(r || "MID").toUpperCase(), c / totalGamesRole]);
    }

    roleFractions.sort((a, b) => b[1] - a[1]);
    const [mainRole, mainShare] = roleFractions[0] || ["MID", 1];

    // ✅ Flex label (UI only): >=10% role share in 2+ roles
    const flex = roleFractions.filter(([, share]) => share >= FLEX_ROLE_SHARE).length >= 2;

    // roleBreakdown for chips (keep count via freq)
    const roleBreakdown = roleFractions.map(([r, share]) => ({
      role: r,
      share,
      count: freq[r] || 0,
    }));

    // --- role-mix amplification (unchanged) ---
    const ampMin = 0.05;
    const ampMax = 0.2;
    const amplification =
      mainShare <= 0.55 ? 0 : Math.min(ampMax, ampMin + (mainShare - 0.55) * 0.5);

    const adjustedFreq = {};
    roleFractions.forEach(([role, share]) => {
      adjustedFreq[role] = role === mainRole ? share * (1 + amplification) : share;
    });
    const sumAdj = Object.values(adjustedFreq).reduce((a, b) => a + b, 0) || 1;
    Object.keys(adjustedFreq).forEach((k) => (adjustedFreq[k] /= sumAdj));

    // --- role weight profiles (unchanged) ---
    const roleWeights = {
      JUNGLE: { control: 0.3, conversion: 0.2, participation: 0.2, vision: 0.1, tempo: 0.15, consistency: 0.05 },
      SUPPORT: { control: 0.15, conversion: 0.15, participation: 0.2, vision: 0.3, tempo: 0.1, consistency: 0.1 },
      TOP: { control: 0.25, conversion: 0.25, participation: 0.2, vision: 0.1, tempo: 0.1, consistency: 0.1 },
      MID: { control: 0.2, conversion: 0.25, participation: 0.2, vision: 0.15, tempo: 0.1, consistency: 0.1 },
      ADC: { control: 0.2, conversion: 0.25, participation: 0.25, vision: 0.1, tempo: 0.1, consistency: 0.1 },
    };

    // --- blend weights by real role mix (unchanged) ---
    const blended = { control: 0, conversion: 0, participation: 0, vision: 0, tempo: 0, consistency: 0 };
    Object.entries(adjustedFreq).forEach(([role, frac]) => {
      const base = roleWeights[role] || roleWeights.MID;
      Object.keys(blended).forEach((k) => (blended[k] += base[k] * frac));
    });

    // --- normalized dimensions ---
    const nControl = norm(p.control, mmControl);
    const nConv = norm(p.conversion, mmConversion);
    const nPart = norm(p.participation, mmPart);
    const nVis = norm(p.vision, mmVision);
    const nTempo = norm(p.tempo, mmTempo);
    const nCons = norm(p.consistency, mmConsist);

    const objComposite =
      blended.control * nControl +
      blended.conversion * nConv +
      blended.participation * nPart +
      blended.vision * nVis +
      blended.tempo * nTempo +
      blended.consistency * nCons;

    // --- individual composite (unchanged) ---
    const I = p.indiv;
    const nKDA = norm(I.avgKDA, mmKDA);
    const nKP = norm(I.avgKP, mmKP);
    const nDmgShare = norm(I.avgDmgShare, mmDmgShare);
    const nDPM = norm(I.avgDPM, mmDPM);
    const nGold = norm(I.avgGoldMin, mmGold);
    const nCS = norm(I.avgCSMin, mmCS);
    const nSolo = norm(I.avgSolo, mmSolo);
    const nPlates = norm(I.avgPlates, mmPlates);
    const nSafe = norm(I.deathsPg, mmDeaths, true);
    const nMech = norm(I.avgMech, mmMech);
    const nTact = norm(I.avgTact, mmTact);
    const nCarry = norm(I.avgCarry, mmCarry);
    const nPR = norm(I.avgPerfRating, mmPR);

    const indivComposite =
      0.18 * nKDA +
      0.14 * nKP +
      0.14 * nDmgShare +
      0.1 * nDPM +
      0.08 * nGold +
      0.06 * nCS +
      0.06 * nSolo +
      0.04 * nPlates +
      0.08 * nMech +
      0.06 * nTact +
      0.06 * nCarry +
      0.05 * nPR +
      0.05 * nSafe;

    const totalCompositeRaw = 0.55 * indivComposite + 0.45 * objComposite;

    // ✅ NEW (UI only): role-fit score projection for roles they played (>=10% or main)
    // (This does NOT affect impact; it's just "if evaluated as pure ROLE")
    const computeRoleObjComposite = (roleKey) => {
      const w = roleWeights[roleKey] || roleWeights.MID;
      return (
        w.control * nControl +
        w.conversion * nConv +
        w.participation * nPart +
        w.vision * nVis +
        w.tempo * nTempo +
        w.consistency * nCons
      );
    };

    const BASE = 40;
    const SCALE = 100 - BASE;

    const roleScores = {};
    roleBreakdown
      .filter((rb) => rb.role === mainRole || rb.share >= SHOW_ROLE_SHARE)
      .forEach((rb) => {
        const roleKey = String(rb.role || "MID").toUpperCase();
        const objR = computeRoleObjComposite(roleKey);
        const totalRawR = 0.55 * indivComposite + 0.45 * objR;
        const scoreR = BASE + totalRawR * SCALE;

        roleScores[roleKey] = {
          role: roleKey,
          score: scoreR,
          share: rb.share,
          count: rb.count || 0,
        };
      });

    return {
      ...p,
      mainRole,
      isFlex: flex,
      roleBreakdown,
      roleScores, // ✅ NEW
      roleMix: roleFractions
        .map(([r, s]) => `${roleShort(r)} ${(s * 100).toFixed(0)}%`)
        .join(" / "),
      _objComposite: objComposite,
      _indivComposite: indivComposite,
      _totalCompositeRaw: totalCompositeRaw,
    };
  });

  // ---------- Sample size + guest handling ----------
  const maxGames = Math.max(...playerStatsArr.map((p) => p.games || 1)) || 1;
  const teamMeanComposite =
    playerStatsArr.reduce((sum, p) => sum + (p._totalCompositeRaw || 0.5), 0) /
      (playerStatsArr.length || 1) || 0.5;

  const minGamesFull = Math.max(3, Math.round(0.3 * maxGames));

  playerStatsArr = playerStatsArr.map((p) => {
    const g = p.games || 0;
    const sampleFactor = Math.max(0, Math.min(1, g / minGamesFull));
    const blendedComposite =
      sampleFactor * (p._totalCompositeRaw || 0.5) + (1 - sampleFactor) * teamMeanComposite;

    const base = 40;
    const score = base + blendedComposite * (100 - base);

    const prev = previousTPI[p.name];
    const delta = typeof prev === "number" ? score - prev : 0;
    previousTPI[p.name] = score;

    const isGuest = g < minGamesFull;

    return { ...p, impact: score, delta, isGuest };
  });

  // ✅ NEW: build role chips (UI only) — now includes role-fit score
  playerStatsArr = playerStatsArr.map((p) => {
    const roles = (p.roleBreakdown || []).slice().sort((a, b) => (b.share || 0) - (a.share || 0));
    const visible = roles.filter((rb) => rb.role === p.mainRole || (rb.share || 0) >= SHOW_ROLE_SHARE);

    const shown = visible.slice(0, MAX_ROLE_CHIPS);
    const hidden = visible.slice(MAX_ROLE_CHIPS);

    const scoreForRole = (role) => {
      const key = String(role || "MID").toUpperCase();
      const rs = p.roleScores && p.roleScores[key];
      return rs && typeof rs.score === "number" ? rs.score : null;
    };

    const roleLine = (rb) => {
      const roleKey = String(rb.role || "MID").toUpperCase();
      const sharePct = Math.round((rb.share || 0) * 100);
      const g = rb.count || 0;
      const s = scoreForRole(roleKey);
      const scoreTxt = s === null ? "—" : `${Math.round(s)}`;

      return `${roleShort(roleKey)} ${scoreTxt} (${g}g, ${sharePct}%)`;
    };

    const baseChip = "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.65rem] border";
    const mainCls = "bg-orange-50 text-orange-700 border-orange-200";
    const altCls = "bg-white text-slate-600 border-slate-200";

    const chips = shown
      .map((rb) => {
        const roleKey = String(rb.role || "MID").toUpperCase();
        const isMain = roleKey === String(p.mainRole || "MID").toUpperCase();
        const sharePct = Math.round((rb.share || 0) * 100);
        const g = rb.count || 0;

        const s = scoreForRole(roleKey);
        const scoreTxt = s === null ? "—" : `${Math.round(s)}`;

        return `
          <span class="${baseChip} ${isMain ? mainCls : altCls}"
                title="Role-fit score (projection, UI only): ${roleLine(rb)}">
            <span class="font-semibold">${roleShort(roleKey)}</span>
            <span class="font-semibold">${scoreTxt}</span>
            <span class="opacity-50">·</span>
            <span class="opacity-80">${sharePct}%</span>
            <span class="opacity-50">·</span>
            <span class="opacity-80">${g}g</span>
          </span>
        `;
      })
      .join("");

    const moreChip = hidden.length
      ? (() => {
          const title = hidden.map(roleLine).join("\n");
          return `
            <span class="${baseChip} bg-slate-50 text-slate-600 border-slate-200"
                  title="${title}">
              +${hidden.length}
            </span>
          `;
        })()
      : "";

    const flexTag = p.isFlex
      ? `<span class="${baseChip} bg-slate-50 text-slate-600 border-slate-200">FLEX</span>`
      : "";

    const guestTag = p.isGuest
      ? `<span class="${baseChip} bg-yellow-50 text-yellow-700 border-yellow-200" title="Low sample size — treated as guest.">⭐ guest</span>`
      : "";

    return { ...p, _roleChipsHTML: chips + moreChip, _flexTagHTML: flexTag, _guestTagHTML: guestTag };
  });

  playerStatsArr.sort((a, b) => {
    if (a.isGuest !== b.isGuest) return a.isGuest ? 1 : -1;
    return b.impact - a.impact;
  });

  // ---------- UI: header + filters ----------
  const trendButtons = `
    <div class="flex gap-1 text-xs font-medium">
      ${["5", "10", "split", "season"]
        .map(
          (w) => `
        <button
          class="px-2.5 py-1 rounded-md border transition
            ${
              objectiveTrendWindow === w
                ? "bg-orange-500 text-white border-orange-500"
                : "bg-white text-gray-700 border-gray-200 hover:border-orange-300 hover:text-orange-500"
            }"
          data-window="${w}">
          ${
            w === "5"
              ? "5 Games"
              : w === "10"
              ? "10 Games"
              : w === "split"
              ? "Current Split"
              : currentSeasonLabel
          }
        </button>`
        )
        .join("")}
    </div>`;

  // ---------- UI: table (updated player cell) ----------
  const tableHTML = `
    <div class="mt-4 overflow-x-auto">
      <table class="w-full border-collapse text-sm">
        <thead>
          <tr class="bg-gray-50 text-gray-600">
            <th class="px-4 py-2 text-left font-semibold">Player</th>
            <th class="px-4 py-2 text-right font-semibold">Total Impact</th>
            <th class="px-4 py-2 text-right font-semibold">Δ</th>
            <th class="px-4 py-2 text-right font-semibold">Games</th>
          </tr>
        </thead>
        <tbody>
          ${playerStatsArr
            .map(
              (p) => `
            <tr data-player="${p.name}"
                data-player-stat="${p.name}"
                class="hover:bg-orange-50 transition cursor-pointer">
              <td class="px-4 py-2 align-middle">
                <div class="font-medium text-gray-900">${p.name}</div>
                <div class="mt-1 flex flex-wrap items-center gap-1.5">
                  ${p._roleChipsHTML || ""}
                  ${p._flexTagHTML || ""}
                  ${p._guestTagHTML || ""}
                </div>
              </td>
              <td class="px-4 py-2 text-right align-middle ${
                p.impact >= 75 ? "text-emerald-600" : p.impact >= 60 ? "text-yellow-600" : "text-red-600"
              } font-semibold">
                ${p.impact.toFixed(0)}
              </td>
              <td class="px-4 py-2 text-right align-middle text-xs ${
                p.delta > 0.8 ? "text-emerald-600" : p.delta < -0.8 ? "text-red-600" : "text-gray-400"
              }">
                ${
                  typeof p.delta !== "number"
                    ? "•"
                    : p.delta > 0.8
                    ? `▲${p.delta.toFixed(1)}`
                    : p.delta < -0.8
                    ? `▼${Math.abs(p.delta).toFixed(1)}`
                    : "•"
                }
              </td>
              <td class="px-4 py-2 text-right align-middle text-gray-600">
                ${p.games}
              </td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>
      <div class="mt-2 text-[0.65rem] text-slate-400 px-4">
        Role chips show: <span class="font-semibold">role-fit score</span> (projection, UI only) · share · games.
      </div>
    </div>`;

  // ---------- UI: quick player chips ----------
  const playerButtons = `
    <div class="mt-3 flex flex-wrap gap-2">
      ${playerStatsArr
        .map(
          (p) => `
        <button
          class="px-2.5 py-1 rounded-full text-xs border border-gray-200 hover:border-orange-400 hover:text-orange-500 transition player-select-btn"
          data-player="${p.name}">
          ${p.name}
        </button>`
        )
        .join("")}
    </div>`;

  const detailBox = `
    <div id="player-detail"
         class="mt-4 hidden opacity-0 translate-y-2 transition-all duration-300 ease-out"></div>`;

  const infoBox = `
    <div id="objective-info" class="mt-5 border-top border-t pt-3">
      <button
        id="toggleObjectiveInfo"
        class="flex items-center gap-1 text-sm font-semibold text-gray-700 hover:text-orange-600 transition">
        <span>ℹ️ How is Total Player Impact calculated?</span>
        <span id="infoArrow" class="transition-transform">▼</span>
      </button>
      <div id="objectiveInfoContent"
           class="hidden text-sm text-gray-600 mt-2 leading-relaxed">
        <p><strong>Total Player Impact</strong> (40–100) is a relative score inside Les Nübs. It blends:</p>
        <ul class="list-disc ml-5 mt-1 space-y-1">
          <li><strong>Individual performance</strong>: KDA, kill participation, damage share, DPM, resource use, plates, mechanical &amp; tactical scores, discipline.</li>
          <li><strong>Objective &amp; macro impact</strong>: control, conversion, weighted objective participation, vision around objectives, tempo, consistency.</li>
          <li><strong>Role context</strong>: expectations per role adjusted by real role mix.</li>
          <li><strong>Sample size</strong>: low-game players are shrunk toward team average and shown as ⭐ until enough games.</li>
        </ul>
        <p class="mt-2 text-xs text-gray-500">
          <strong>Role-fit scores</strong> shown in chips are a <em>projection</em> (UI only): "how this player's profile would rate if judged as that role."
        </p>
      </div>
    </div>`;

  // ---------- Detail panel builder ----------
  const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

  const ctx = {
    meanKDA: mean(playerStatsArr.map((p) => p.indiv.avgKDA || 0)),
    meanDmgShare: mean(playerStatsArr.map((p) => p.indiv.avgDmgShare || 0)),
    meanDPM: mean(playerStatsArr.map((p) => p.indiv.avgDPM || 0)),
    meanGold: mean(playerStatsArr.map((p) => p.indiv.avgGoldMin || 0)),
    meanCS: mean(playerStatsArr.map((p) => p.indiv.avgCSMin || 0)),
    meanSolo: mean(playerStatsArr.map((p) => p.indiv.avgSolo || 0)),
    meanPlates: mean(playerStatsArr.map((p) => p.indiv.avgPlates || 0)),
    meanDeaths: mean(playerStatsArr.map((p) => p.indiv.deathsPg || 0)),
    meanMech: mean(playerStatsArr.map((p) => p.indiv.avgMech || 0)),
    meanTact: mean(playerStatsArr.map((p) => p.indiv.avgTact || 0)),
    meanCarry: mean(playerStatsArr.map((p) => p.indiv.avgCarry || 0)),
    meanControl: mean(playerStatsArr.map((p) => p.control || 0)),
    meanConv: mean(playerStatsArr.map((p) => p.conversion || 0)),
    meanPart: mean(playerStatsArr.map((p) => p.participation || 0)),
    meanVision: mean(playerStatsArr.map((p) => p.vision || 0)),
    meanTempo: mean(playerStatsArr.map((p) => p.tempo || 0)),
    meanCons: mean(playerStatsArr.map((p) => p.consistency || 0)),
  };

  const buildPlayerDetail = (p) => {
    const S = [];
    const F = [];

    const ratio = (val, avg) => (avg > 0 ? val / avg : 1);
    const add = (cond, arr, text) => { if (cond) arr.push(text); };

    // Lane & economy
    add(ratio(p.indiv.avgCSMin, ctx.meanCS) > 1.15, S, "Strong CS/min & lane farming — reliably converting waves into gold.");
    add(ratio(p.indiv.avgCSMin, ctx.meanCS) < 0.85, F, "Work on CS/min & wave control to secure more stable resources.");

    add(ratio(p.indiv.avgGoldMin, ctx.meanGold) > 1.15, S, "High gold per minute — good tempo on farming & objectives.");
    add(ratio(p.indiv.avgGoldMin, ctx.meanGold) < 0.85, F, "Increase farming efficiency and join only high-value fights.");

    // Combat & carry
    add(ratio(p.indiv.avgKDA, ctx.meanKDA) > 1.15, S, "Efficient KDA — good fight selection & survival.");
    add(ratio(p.indiv.avgKDA, ctx.meanKDA) < 0.85, F, "Review death patterns; avoid low-value deaths & greedy plays.");

    add(ratio(p.indiv.avgDmgShare, ctx.meanDmgShare) > 1.15, S, "High damage share — strong carry presence in fights.");
    add(ratio(p.indiv.avgDmgShare, ctx.meanDmgShare) < 0.75, F, "Look for better DPS uptime and positioning to impact fights.");

    add(ratio(p.indiv.avgMech, ctx.meanMech) > 1.15, S, "Mechanical Impact above team baseline — confident execution.");
    add(ratio(p.indiv.avgMech, ctx.meanMech) < 0.85, F, "Focus on clean combos and reliability in key fights.");

    // Decision making
    add(ratio(p.indiv.avgTact, ctx.meanTact) > 1.15, S, "Good Tactical Intelligence — strong decision making around plays.");
    add(ratio(p.indiv.avgTact, ctx.meanTact) < 0.85, F, "Tighten decision making — when to contest, reset, or cross-map.");

    // Objectives & macro
    add(ratio(p.control, ctx.meanControl) > 1.15, S, "Drives objective control — presence correlates with secured objectives.");
    add(ratio(p.conversion, ctx.meanConv) > 1.15, S, "Converts advantages into objectives very well.");
    add(ratio(p.participation, ctx.meanPart) < 0.85, F, "Join more setups when team plays for Dragon/Herald/Baron/Towers.");

    add(ratio(p.vision, ctx.meanVision) > 1.15, S, "Impactful vision around objectives — enables safe, informed plays.");
    add(ratio(p.vision, ctx.meanVision) < 0.85, F, "Improve vision control/denial near key objectives.");

    add(ratio(p.tempo, ctx.meanTempo) > 1.15, S, "Good tempo & rotations — arrives early to important areas.");
    add(ratio(p.consistency, ctx.meanCons) > 1.15, S, "Consistent contribution game to game.");
    add(ratio(p.consistency, ctx.meanCons) < 0.85, F, "Reduce volatility — aim for a repeatable baseline performance.");

    // Discipline
    add(p.indiv.deathsPg > ctx.meanDeaths * 1.15, F, "High deaths per game — focus on safer pathing, resets, and info usage.");
    add(p.indiv.deathsPg < ctx.meanDeaths * 0.85, S, "Good death discipline — rarely gives unnecessary advantages.");

    const uniq = (arr) => [...new Set(arr)];
    const strengths = uniq(S).slice(0, 5);
    const focus = uniq(F).slice(0, 5);

    const badge =
      p.impact >= 75
        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
        : p.impact >= 60
        ? "bg-yellow-50 text-yellow-700 border-yellow-200"
        : "bg-red-50 text-red-700 border-red-200";

    const roleFitRows = (() => {
      const entries = Object.values(p.roleScores || {}).sort((a, b) => (b.share || 0) - (a.share || 0));
      if (!entries.length) return `<div class="text-gray-500 text-sm">No role-fit scores available.</div>`;
      return `
        <div class="mt-2">
          <div class="text-xs uppercase tracking-wide opacity-70 mb-1">Role-fit scores (projection)</div>
          <div class="flex flex-wrap gap-1.5">
            ${entries
              .map((r) => {
                const sharePct = Math.round((r.share || 0) * 100);
                return `
                  <span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.7rem] border bg-white text-slate-700 border-slate-200"
                        title="${roleShort(r.role)} — ${r.count} games (${sharePct}%)">
                    <span class="font-semibold">${roleShort(r.role)}</span>
                    <span class="font-semibold">${Math.round(r.score)}</span>
                    <span class="opacity-50">·</span>
                    <span class="opacity-70">${sharePct}%</span>
                    <span class="opacity-50">·</span>
                    <span class="opacity-70">${r.count}g</span>
                  </span>
                `;
              })
              .join("")}
          </div>
        </div>
      `;
    })();

    return `
      <div class="p-4 rounded-2xl border ${badge} shadow-sm">
        <div class="flex flex-wrap items-baseline justify-between gap-2 mb-2">
          <div>
            <div class="text-xs uppercase tracking-wide opacity-70">Total Player Impact</div>
            <div class="text-2xl font-semibold">
              ${p.impact.toFixed(0)}
              <span class="text-xs text-gray-500 font-normal ml-1">
                indiv: ${(p._indivComposite * 100).toFixed(0)} • obj: ${(p._objComposite * 100).toFixed(0)}
              </span>
            </div>
          </div>
          <div class="text-xs text-gray-600">
            ${p.name}${p.isGuest ? " · ⭐ low sample" : ""}${p.isFlex ? " · flex" : ""}
            <div class="text-[0.65rem] text-gray-400 mt-1">Games: ${p.games}</div>
            <div class="mt-2 flex flex-wrap gap-1.5">
              ${p._roleChipsHTML || ""}
              ${p._flexTagHTML || ""}
              ${p._guestTagHTML || ""}
            </div>
            ${roleFitRows}
          </div>
        </div>

        <div class="grid sm:grid-cols-2 gap-3 mt-2 text-sm">
          <div>
            <div class="font-semibold mb-1">🔥 Strengths</div>
            ${
              strengths.length
                ? strengths.map((t) => `<div class="mb-1">• ${t}</div>`).join("")
                : `<div class="text-gray-500">Solid, balanced profile so far.</div>`
            }
          </div>
          <div>
            <div class="font-semibold mb-1">🎯 Focus Points</div>
            ${
              focus.length
                ? focus.map((t) => `<div class="mb-1">• ${t}</div>`).join("")
                : `<div class="text-gray-500">No major red flags — push existing strengths.</div>`
            }
          </div>
        </div>
      </div>
    `;
  };

  // ---------- Render card ----------
  document.getElementById("objective-impact").innerHTML = `
    <section class="section-wrapper fade-in mb-10">
      <div class="dashboard-card bg-white shadow-sm rounded-2xl border border-gray-100">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-1">
          <div>
            <h2 class="text-[1.1rem] font-semibold text-orange-500 tracking-tight">
              Total Player Impact (Individual)
            </h2>
            <p class="text-[0.7rem] text-gray-600">
              Relative impact inside Les Nübs — blends individual performance with macro &amp; objective impact, role-adjusted.
            </p>
          </div>
          ${trendButtons}
        </div>

        ${tableHTML}
        ${playerButtons}
        ${detailBox}
        ${infoBox}
      </div>
    </section>
  `;

  // ---------- Interactions ----------
  // Trend buttons
  document.querySelectorAll("#objective-impact [data-window]").forEach((btn) => {
    btn.addEventListener("click", () => {
      objectiveTrendWindow = btn.getAttribute("data-window");
      renderObjectiveImpact(data);
    });
  });

  // Info toggle
  const infoBtn = document.getElementById("toggleObjectiveInfo");
  const infoContent = document.getElementById("objectiveInfoContent");
  const arrow = document.getElementById("infoArrow");
  if (infoBtn && infoContent && arrow) {
    infoBtn.addEventListener("click", () => {
      const hidden = infoContent.classList.contains("hidden");
      infoContent.classList.toggle("hidden");
      arrow.style.transform = hidden ? "rotate(180deg)" : "rotate(0deg)";
    });
  }

  const detailEl = document.getElementById("player-detail");

  const showPlayer = (name) => {
    if (!detailEl) return;
    const p = playerStatsArr.find((x) => x.name === name);
    if (!p) return;
    detailEl.innerHTML = buildPlayerDetail(p);
    detailEl.classList.remove("hidden", "opacity-0", "translate-y-2");
    requestAnimationFrame(() => {
      detailEl.classList.add("opacity-100");
    });
  };

  // Table rows
  document.querySelectorAll('#objective-impact table tbody tr[data-player]').forEach((row) => {
    row.addEventListener("click", () => {
      const name = row.getAttribute("data-player");
      showPlayer(name);
    });
  });

  // Player chips
  document.querySelectorAll("#objective-impact .player-select-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const name = btn.getAttribute("data-player");
      showPlayer(name);
    });
  });

  console.log("⭐ Total Player Impact", {
    window: objectiveTrendWindow,
    season: currentSeason,
    games: totalGames,
    players: playerStatsArr.map((p) => ({
      name: p.name,
      impact: p.impact.toFixed(1),
      games: p.games,
      guest: p.isGuest,
      flex: p.isFlex,
      roles: (p.roleBreakdown || []).map((r) => ({
        role: r.role,
        share: +(r.share * 100).toFixed(0),
        games: r.count,
        roleFit: p.roleScores && p.roleScores[String(r.role || "MID").toUpperCase()]
          ? +p.roleScores[String(r.role || "MID").toUpperCase()].score.toFixed(0)
          : null,
      })),
    })),
    overallWinrate: overallWinrate.toFixed(1),
    blueWinrate: blueWinrate.toFixed(1),
    redWinrate: redWinrate.toFixed(1),
    objectives: objectiveCards,
  });
}


// ============================================================================
// 🧩 TEAM SYNERGY & IDENTITY — v3.7
// - Signature picks per role (Top 1–3 each, with smart fallback)
// - Timeline-aware scoring: uses early lane timeline data (Gold/XP/CS diff, lane state)
// - Expanded Team Playstyle DNA
// - Highlight cards: Most Reliable Duo, Best Bot Lane Combo, Top Signature Pick
// - Core Identity Team Comp mini-card (under top 3 cards)
// - NEW: Top Team Comps (champ-based) using both match + timeline data
// - Tabs aligned with main dashboard (Last 5 / 10 / Current Split / Season)
// ============================================================================

let synergyTrendWindow = "season";

/**
 * @param {Array<Object>} data          - per game / player rows (main dataset)
 * @param {Array<Object>} [timelineData]- optional minute-by-minute timeline rows
 */
function renderTeamSynergy(data, timelineData) {
  const container = document.getElementById("team-synergy");
  if (!container || !data || !data.length) return;

  // --- Helpers ---
  const toNum = (v) => {
    if (v === undefined || v === null || v === "") return 0;
    const n = parseFloat(String(v).replace("%", "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  };

  const getGameId = (r) =>
    r["Match ID"] || r["Game #"] || r["Game ID"] || r["MatchID"] || r["Date"];

  const hasCol = (col) =>
    data[0] && Object.prototype.hasOwnProperty.call(data[0], col);

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

  const normSeason = (v) => String(v ?? "").trim();
  const normSplitNum = (v) => {
    const s = String(v ?? "").trim();
    if (!s) return null;
    const n = parseInt(s, 10);
    return Number.isFinite(n) ? n : null;
  };

  const isWin = (res) => String(res || "").toLowerCase() === "win";

  // Optional: timeline data (minute-by-minute)
  const timeline =
    Array.isArray(timelineData)
      ? timelineData
      : (typeof window !== "undefined" &&
         Array.isArray(window.lesNubsTimeline)
          ? window.lesNubsTimeline
          : []);

  // --- Detect current season & split (from dataset) ---
  const seasons = [
    ...new Set(
      data.map((r) => normSeason(r["Season"])).filter(Boolean)
    ),
  ];
  const currentSeason = seasons.length ? seasons[seasons.length - 1] : null;

  const splitCandidates = data
    .filter((r) =>
      currentSeason ? normSeason(r["Season"]) === currentSeason : true
    )
    .map((r) => normSplitNum(r["Split"]))
    .filter((n) => n !== null);

  const currentSplit =
    splitCandidates.length > 0 ? Math.max(...splitCandidates) : null;

  // --- Filter by synergy window (match-based) ---
  const getRecentGames = (n) => {
    const allGames = data.map(getGameId).filter(Boolean);
    const uniqueGames = [...new Set(allGames)];
    const recentGames = uniqueGames.slice(-n);
    return data.filter((r) => recentGames.includes(getGameId(r)));
  };

  const filteredData = (() => {
    switch (synergyTrendWindow) {
      case "5":
        return getRecentGames(5);
      case "10":
        return getRecentGames(10);
      case "split":
        if (currentSplit == null) return data;
        return data.filter((r) => normSplitNum(r["Split"]) === currentSplit);
      case "season":
      default: {
        if (!currentSeason) return data;
        return data.filter((r) => normSeason(r["Season"]) === currentSeason);
      }
    }
  })();

  if (!filteredData.length) return;

  // --- Per-game structure ---
  const games = {};
  filteredData.forEach((r) => {
    const id = getGameId(r);
    if (!id) return;
    if (!games[id]) {
      games[id] = {
        id,
        rows: [],
        result: isWin(r["Result"]) ? "Win" : "Loss",
      };
    }
    games[id].rows.push(r);
  });

  const gameList = Object.values(games);
  if (!gameList.length) return;

  gameList.forEach((g) => {
    g.players = g.rows
      .map((r) => ({
        name: (r["Player"] || "").trim(),
        role: canonRole(r["ROLE"]),
        champ: (r["Champion"] || "").trim(),
      }))
      .filter((p) => p.name);
  });

  const totalGames = gameList.length;
  const teamWins = gameList.filter((g) => g.result === "Win").length;
  const teamWR = totalGames ? (teamWins / totalGames) * 100 : 0;

  // ==========================================================================
  // 0) Player baselines (for signature pick comparison)
  // ==========================================================================
  const playerOverall = {};
  filteredData.forEach((r) => {
    const name = (r["Player"] || "").trim();
    if (!name) return;

    const k = toNum(r["Kills"]);
    const d = toNum(r["Deaths"]);
    const a = toNum(r["Assists"]);
    const kda = d > 0 ? (k + a) / d : k + a;

    if (!playerOverall[name]) {
      playerOverall[name] = {
        games: 0,
        wins: 0,
        kdaSum: 0,
        prSum: 0,
        mechSum: 0,
        tactSum: 0,
      };
    }
    const p = playerOverall[name];
    p.games += 1;
    if (isWin(r["Result"])) p.wins += 1;
    p.kdaSum += isNaN(kda) ? 0 : kda;
    p.prSum += toNum(r["Performance Rating"]);
    p.mechSum += toNum(r["Mechanical Impact"]);
    p.tactSum += toNum(r["Tactical Intelligence"]);
  });

  const getPlayerBaseline = (name) => {
    const p = playerOverall[name];
    if (!p || !p.games)
      return { wr: teamWR, kda: 2, pr: 50, mech: 50, tact: 50 };
    return {
      wr: (p.wins / p.games) * 100,
      kda: p.kdaSum / p.games || 2,
      pr: p.prSum / p.games || 50,
      mech: p.mechSum / p.games || 50,
      tact: p.tactSum / p.games || 50,
    };
  };

  // ==========================================================================
  // 1) Player duo synergy
  // ==========================================================================
  const duoStats = {};

  gameList.forEach((g) => {
    const rowByPlayer = {};
    g.rows.forEach((r) => {
      const n = (r["Player"] || "").trim();
      if (n && !rowByPlayer[n]) rowByPlayer[n] = r;
    });

    const { players, result } = g;
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        const a = players[i].name;
        const b = players[j].name;
        if (!a || !b || a === b) continue;
        const key = a < b ? `${a}|${b}` : `${b}|${a}`;

        if (!duoStats[key]) {
          duoStats[key] = {
            p1: a < b ? a : b,
            p2: a < b ? b : a,
            games: 0,
            wins: 0,
            synSum: 0,
            sharedSum: 0,
            coordSum: 0,
          };
        }

        const rowA = rowByPlayer[a] || {};
        const rowB = rowByPlayer[b] || {};

        const syn = hasCol("Synergy Index")
          ? (toNum(rowA["Synergy Index"]) + toNum(rowB["Synergy Index"])) / 2
          : 0;
        const shared = hasCol("Shared Participation Rate")
          ? (toNum(rowA["Shared Participation Rate"]) +
              toNum(rowB["Shared Participation Rate"])) /
            2
          : 0;
        const coord = hasCol("Team Coordination Efficiency")
          ? (toNum(rowA["Team Coordination Efficiency"]) +
              toNum(rowB["Team Coordination Efficiency"])) /
            2
          : 0;

        const d = duoStats[key];
        d.games += 1;
        if (result === "Win") d.wins += 1;
        d.synSum += syn;
        d.sharedSum += shared;
        d.coordSum += coord;
      }
    }
  });

  const duoArr = Object.values(duoStats)
    .filter((d) => d.games >= 3)
    .map((d) => {
      const wr = (d.wins / d.games) * 100;
      const lift = wr - teamWR;
      const syn = d.synSum / d.games || 0;
      const shared = d.sharedSum / d.games || 0;
      const coord = d.coordSum / d.games || 0;
      const synN = syn / 100;
      const sharedN = shared / 100;
      const coordN = coord / 100;
      const liftN = Math.max(-0.2, Math.min(0.2, lift / 25));
      const score =
        0.5 * (wr / 100) +
        0.25 * Math.max(0, liftN) +
        0.15 * synN +
        0.05 * sharedN +
        0.05 * coordN;
      return { ...d, winrate: wr, lift, syn, shared, coord, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  // ==========================================================================
  // 2) Bot lane champ synergy
  // ==========================================================================
  const botCombos = {};

  gameList.forEach((g) => {
    const adc = g.players.find((p) => p.role === "BOTTOM");
    const sup = g.players.find((p) => p.role === "SUPPORT");
    if (!adc || !sup || !adc.champ || !sup.champ) return;
    const key = `${adc.champ}|${sup.champ}`;
    if (!botCombos[key]) {
      botCombos[key] = { adc: adc.champ, sup: sup.champ, games: 0, wins: 0 };
    }
    botCombos[key].games += 1;
    if (g.result === "Win") botCombos[key].wins += 1;
  });

  const botArr = Object.values(botCombos)
    .filter((c) => c.games >= 2)
    .map((c) => {
      const wr = (c.wins / c.games) * 100;
      return { ...c, winrate: wr, lift: wr - teamWR };
    })
    .sort((a, b) => b.winrate - a.winrate)
    .slice(0, 4);

  // ==========================================================================
  // 3) Timeline-based early lane performance (optional)
  //    - aggregated per (role, champ, pilot)
  //    - early lane per game+role for team-combo scoring
  // ==========================================================================
  const timelinePickStats = {};
  const earlyByGameRole = {}; // key: gameId|role

  if (Array.isArray(timeline) && timeline.length) {
    timeline.forEach((r) => {
      const matchId = getGameId(r);
      if (!matchId || !games[matchId]) return; // respect filtered window

      const name = (r["Player"] || "").trim();
      const champ = (r["Champion"] || "").trim();
      const role = canonRole(r["Role"] || r["ROLE"]);
      if (!name || !champ || !role) return;

      const minuteRaw = r["Minute"] ?? r["Time"] ?? r["Timestamp"];
      const minute = Number(minuteRaw);
      // focus on early game lane phase
      if (!Number.isFinite(minute) || minute > 14) return;

      // per-pick (role, champ, pilot)
      const key = `${role}|${champ}|${name}`;
      if (!timelinePickStats[key]) {
        timelinePickStats[key] = {
          minutes: 0,
          goldDiffSum: 0,
          xpDiffSum: 0,
          csDiffSum: 0,
          laneGoldWins: 0,
          laneXpWins: 0,
          laneCsWins: 0,
        };
      }
      const t = timelinePickStats[key];
      t.minutes += 1;
      const gDiff = toNum(r["Gold Diff vs Opp"]);
      const xDiff = toNum(r["XP Diff vs Opp"]);
      const cDiff = toNum(r["CS Diff vs Opp"]);
      t.goldDiffSum += gDiff;
      t.xpDiffSum += xDiff;
      t.csDiffSum += cDiff;

      const lg = toNum(r["Lane Gold State"]);
      const lx = toNum(r["Lane XP State"]);
      const lc = toNum(r["Lane CS State"]);
      if (lg > 0) t.laneGoldWins += 1;
      if (lx > 0) t.laneXpWins += 1;
      if (lc > 0) t.laneCsWins += 1;

      // per-game, per-role early lane (for team-comp scoring)
      const gKey = `${matchId}|${role}`;
      if (!earlyByGameRole[gKey]) {
        earlyByGameRole[gKey] = {
          minutes: 0,
          goldDiffSum: 0,
          xpDiffSum: 0,
          csDiffSum: 0,
          laneAdvMinutes: 0,
        };
      }
      const eg = earlyByGameRole[gKey];
      eg.minutes += 1;
      eg.goldDiffSum += gDiff;
      eg.xpDiffSum += xDiff;
      eg.csDiffSum += cDiff;

      const laneAdv = (lg > 0 ? 1 : 0) + (lx > 0 ? 1 : 0) + (lc > 0 ? 1 : 0);
      if (laneAdv > 0) eg.laneAdvMinutes += 1;
    });
  }

  const getTimelineBoost = (role, champ, pilot) => {
    const key = `${role}|${champ}|${pilot}`;
    const t = timelinePickStats[key];
    if (!t || t.minutes < 10) {
      return { boost: 0, summary: null };
    }
    const goldAvg = t.goldDiffSum / t.minutes; // avg lane gold diff early
    const laneWinRate =
      (t.laneGoldWins + t.laneXpWins + t.laneCsWins) /
      (3 * t.minutes || 1);

    // Normalize & clamp: we only reward positive early lane performance
    const gNorm = Math.max(-300, Math.min(300, goldAvg)) / 300; // -1..1
    const lwNorm = Math.max(0, Math.min(1, laneWinRate)); // 0..1
    const rawBoost = 0.6 * gNorm + 0.8 * lwNorm;
    const boost = Math.max(0, rawBoost); // only positive contribution

    return {
      boost,
      summary: {
        minutes: t.minutes,
        goldAvg,
        laneWinRate,
      },
    };
  };

  // ==========================================================================
  // 4) Signature picks per role (timeline-informed)
  // ==========================================================================
  const roleChampStats = {}; // role -> champ -> aggregated

  filteredData.forEach((r) => {
    const name = (r["Player"] || "").trim();
    const role = canonRole(r["ROLE"]);
    const champ = (r["Champion"] || "").trim();
    if (!name || !role || !champ) return;

    const k = toNum(r["Kills"]);
    const d = toNum(r["Deaths"]);
    const a = toNum(r["Assists"]);
    const kda = d > 0 ? (k + a) / d : k + a;
    const win = isWin(r["Result"]) ? 1 : 0;
    const pr = toNum(r["Performance Rating"]);
    const mech = toNum(r["Mechanical Impact"]);
    const tact = toNum(r["Tactical Intelligence"]);
    const tc = toNum(r["Team Contribution"]);

    if (!roleChampStats[role]) roleChampStats[role] = {};
    if (!roleChampStats[role][champ]) {
      roleChampStats[role][champ] = {
        games: 0,
        wins: 0,
        kdaSum: 0,
        prSum: 0,
        mechSum: 0,
        tactSum: 0,
        tcSum: 0,
        byPlayer: {},
      };
    }

    const rc = roleChampStats[role][champ];
    rc.games += 1;
    rc.wins += win;
    rc.kdaSum += isNaN(kda) ? 0 : kda;
    rc.prSum += pr;
    rc.mechSum += mech;
    rc.tactSum += tact;
    rc.tcSum += tc;

    if (!rc.byPlayer[name]) {
      rc.byPlayer[name] = {
        games: 0,
        wins: 0,
        kdaSum: 0,
        prSum: 0,
        mechSum: 0,
        tactSum: 0,
        tcSum: 0,
      };
    }
    const bp = rc.byPlayer[name];
    bp.games += 1;
    bp.wins += win;
    bp.kdaSum += isNaN(kda) ? 0 : kda;
    bp.prSum += pr;
    bp.mechSum += mech;
    bp.tactSum += tact;
    bp.tcSum += tc;
  });

  const explainSignature = (s) => {
    const bits = [];
    if (s.wrLift > 3) bits.push(`wins +${s.wrLift.toFixed(1)}pp vs ${s.pilot}'s avg`);
    if (s.kdaLift > 0.4) bits.push(`KDA +${s.kdaLift.toFixed(1)}`);
    if (s.prLift > 4) bits.push(`impact rating spike`);
    if (s.mechLift > 3) bits.push(`mechanical edge`);
    if (s.tactLift > 3) bits.push(`smarter setups`);
    if (s.tc > 0) bits.push(`high team contribution`);
    if (s.laneSummary && s.laneSummary.minutes >= 12) {
      const { goldAvg, laneWinRate } = s.laneSummary;
      if (goldAvg > 150) bits.push(`early lane +${goldAvg.toFixed(0)}g`);
      if (laneWinRate > 0.55)
        bits.push(`${(laneWinRate * 100).toFixed(0)}% advantaged lane minutes`);
    }
    return bits.length
      ? bits.join(", ")
      : `reliable comfort pick for ${s.pilot}.`;
  };

  const rawSignatures = [];

  Object.entries(roleChampStats).forEach(([role, champs]) => {
    Object.entries(champs).forEach(([champ, s]) => {
      const [pilot, ps] =
        Object.entries(s.byPlayer).sort((a, b) => b[1].games - a[1].games)[0] ||
        [];
      if (!pilot || ps.games < 3) return;

      const champWr = (ps.wins / ps.games) * 100;
      const champKda = ps.kdaSum / ps.games || 0;
      const champPr = ps.prSum / ps.games || 0;
      const champMech = ps.mechSum / ps.games || 0;
      const champTact = ps.tactSum / ps.games || 0;
      const champTc = ps.tcSum / ps.games || 0;

      const base = getPlayerBaseline(pilot);
      const wrLift = champWr - base.wr;
      const kdaLift = champKda - base.kda;
      const prLift = champPr - base.pr;
      const mechLift = champMech - base.mech;
      const tactLift = champTact - base.tact;

      const { boost: laneBoost, summary: laneSummary } =
        getTimelineBoost(role, champ, pilot);

      const identityScore =
        (champWr / 100) * (1 + Math.log10(ps.games + 1)) +
        Math.max(0, wrLift / 20) +
        Math.max(0, kdaLift / 3) +
        Math.max(0, prLift / 30) +
        Math.max(0, (mechLift + tactLift) / 60) +
        Math.max(0, champTc / 100) +
        laneBoost; // add timeline-based boost

      rawSignatures.push({
        role,
        champ,
        pilot,
        games: ps.games,
        wr: champWr,
        kda: champKda,
        pr: champPr,
        mech: champMech,
        tact: champTact,
        tc: champTc,
        wrLift,
        kdaLift,
        prLift,
        mechLift,
        tactLift,
        identityScore,
        laneSummary,
      });
    });
  });

  const ROLE_ORDER = ["TOP", "JUNGLE", "MID", "BOTTOM", "SUPPORT"];
  const roleSignatures = {};

  ROLE_ORDER.forEach((role) => {
    let picks = rawSignatures
      .filter((s) => s.role === role)
      .sort((a, b) => b.identityScore - a.identityScore);

    if (!picks.length && roleChampStats[role]) {
      const fallback = Object.entries(roleChampStats[role])
        .map(([champ, s]) => {
          const [pilot, ps] =
            Object.entries(s.byPlayer).sort((a, b) => b[1].games - a[1].games)[0] ||
            [];
          if (!pilot || ps.games < 3) return null;
          const wr = (ps.wins / ps.games) * 100;
          const kda = ps.kdaSum / ps.games || 0;
          const base = getPlayerBaseline(pilot);
          return {
            role,
            champ,
            pilot,
            games: ps.games,
            wr,
            kda,
            wrLift: wr - base.wr,
            kdaLift: kda - base.kda,
            identityScore: wr / 100,
            fallback: true,
          };
        })
        .filter(Boolean)
        .sort((a, b) => b.identityScore - a.identityScore)
        .slice(0, 1);
      picks = fallback;
    }

    if (picks && picks.length) {
      roleSignatures[role] = picks.slice(0, 3);
    }
  });

  const allSigPicks = Object.values(roleSignatures).flat();

  // ==========================================================================
  // 5) NEW — Full Team Comp scoring (champ-based, uses timeline + team gold)
  // ==========================================================================
  const teamCompStats = {};

  gameList.forEach((g) => {
    // Find champ per role in this game
    const byRole = {};
    g.rows.forEach((r) => {
      const role = canonRole(r["ROLE"]);
      const champ = (r["Champion"] || "").trim();
      if (!role || !champ) return;
      if (!byRole[role]) byRole[role] = champ;
    });

    const rolesPresent = ROLE_ORDER.filter((r) => byRole[r]);
    // Require at least 4 roles to treat as a "real" comp
    if (rolesPresent.length < 4) return;

    const compKey = ROLE_ORDER.map((role) => byRole[role] || "—").join("|");

    if (!teamCompStats[compKey]) {
      teamCompStats[compKey] = {
        key: compKey,
        games: 0,
        wins: 0,
        roles: { ...byRole },
        earlyGoldSum: 0,
        earlyGoldSamples: 0,
        laneAdvSum: 0,
        laneAdvSamples: 0,
        gold10Sum: 0,
        gold15Sum: 0,
        goldSamples: 0,
      };
    }

    const s = teamCompStats[compKey];
    s.games += 1;
    if (g.result === "Win") s.wins += 1;

    // Team-level early gold diffs, if available
    const baseRow = g.rows[0] || {};
    const gold10Col = "Gold Diff @10 (Team)";
    const gold15Col = "Gold Diff @15 (Team)";
    let hasGoldMetric = false;

    if (hasCol(gold10Col)) {
      s.gold10Sum += toNum(baseRow[gold10Col]);
      hasGoldMetric = true;
    }
    if (hasCol(gold15Col)) {
      s.gold15Sum += toNum(baseRow[gold15Col]);
      hasGoldMetric = true;
    }
    if (hasGoldMetric) {
      s.goldSamples += 1;
    }

    // Lane early-game from timeline per role
    rolesPresent.forEach((role) => {
      const eg = earlyByGameRole[`${g.id}|${role}`];
      if (!eg || !eg.minutes) return;
      const avgGold = eg.goldDiffSum / eg.minutes;
      const advRate = eg.laneAdvMinutes / eg.minutes;

      s.earlyGoldSum += avgGold;
      s.earlyGoldSamples += 1;
      s.laneAdvSum += advRate;
      s.laneAdvSamples += 1;
    });
  });

  const teamCompArr = Object.values(teamCompStats)
    .filter((c) => c.games >= 2) // need at least 2 uses
    .map((s) => {
      const wr = (s.wins / s.games) * 100;
      const lift = wr - teamWR;
      const avgGold10 = s.goldSamples ? s.gold10Sum / s.goldSamples : 0;
      const avgGold15 = s.goldSamples ? s.gold15Sum / s.goldSamples : 0;
      const avgEarlyLane = s.earlyGoldSamples ? s.earlyGoldSum / s.earlyGoldSamples : 0;
      const avgLaneAdv = s.laneAdvSamples ? s.laneAdvSum / s.laneAdvSamples : 0;

      const wrScore = wr / 100; // 0–1
      const liftScore = Math.max(0, lift / 20); // up to ~+0.5 for big lift
      const laneScore = Math.max(0, avgEarlyLane / 200); // +1 around +200g avg lane
      const tempoScore = Math.max(0, avgGold10 / 600); // +1 around +600g @10

      const score =
        0.45 * wrScore +
        0.25 * liftScore +
        0.2 * laneScore +
        0.1 * tempoScore;

      return {
        ...s,
        wr,
        lift,
        avgGold10,
        avgGold15,
        avgEarlyLane,
        avgLaneAdv,
        score,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  // ==========================================================================
  // 6) Team Playstyle DNA (expanded)
  // ==========================================================================
  const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

  const winGames = gameList.filter((g) => g.result === "Win");
  const lossGames = gameList.filter((g) => g.result === "Loss");

  const gameMetric = (col) => ({
    win: avg(winGames.map((g) => toNum((g.rows[0] || {})[col]))),
    loss: avg(lossGames.map((g) => toNum((g.rows[0] || {})[col]))),
  });

  const gold10 = gameMetric("Gold Diff @10 (Team)");
  const gold15 = gameMetric("Gold Diff @15 (Team)");
  const macroStr = hasCol("Macro Strength Index")
    ? gameMetric("Macro Strength Index")
    : { win: 0, loss: 0 };
  const macroCons = hasCol("Macro Consistency")
    ? gameMetric("Macro Consistency")
    : { win: 0, loss: 0 };
  const tempoEff = hasCol("Tempo Efficiency Index")
    ? gameMetric("Tempo Efficiency Index")
    : { win: 0, loss: 0 };
  const visionImpact = hasCol("Vision Impact Factor")
    ? gameMetric("Vision Impact Factor")
    : { win: 0, loss: 0 };
  const visObjRatio = hasCol("Vision to Objective Ratio")
    ? gameMetric("Vision to Objective Ratio")
    : { win: 0, loss: 0 };
  const visKillRatio = hasCol("Vision to Kill Ratio")
    ? gameMetric("Vision to Kill Ratio")
    : { win: 0, loss: 0 };
  const scalingIdx = hasCol("Late Game Scaling Index")
    ? gameMetric("Late Game Scaling Index")
    : { win: 0, loss: 0 };
  const clutchIdx = hasCol("Clutch Index")
    ? gameMetric("Clutch Index")
    : { win: 0, loss: 0 };
  const goldXpSync = hasCol("Gold-XP Sync Index")
    ? gameMetric("Gold-XP Sync Index")
    : { win: 0, loss: 0 };

  const dna = [];
  if (gold10.win - gold10.loss > 600 || gold15.win - gold15.loss > 1000)
    dna.push(
      "Early tempo: when you secure early gold leads, winrate spikes — drafts with early prio & skirmish tools fit your identity."
    );
  if (tempoEff.win > tempoEff.loss + 5)
    dna.push(
      "Tempo efficiency: moving first on plays is a big separator; slow first rotations hurt your style."
    );
  if (macroStr.win - macroStr.loss > 5)
    dna.push(
      "Macro strength: disciplined objective trading is a core win condition; avoid coin-flip fights when trades are available."
    );
  if (macroCons.win > macroCons.loss + 5)
    dna.push(
      "Low-chaos preference: structured games with clear lanes & setups favor you heavily."
    );
  if (visionImpact.win > visionImpact.loss + 5)
    dna.push(
      "Vision identity: higher Vision Impact in wins — lean on support/jungle that can maintain deep, safe vision."
    );
  if (visObjRatio.win > visObjRatio.loss + 0.2)
    dna.push("You convert vision into objectives efficiently — keep running set plays off vision.");
  if (visKillRatio.win > visKillRatio.loss + 0.2)
    dna.push("Vision → picks: you reliably turn info into kills when playing your game.");
  if (scalingIdx.win > scalingIdx.loss + 0.2)
    dna.push(
      "Scaling comfort: your long-game execution is above average; scaling comps are viable when lanes are stable."
    );
  if (clutchIdx.win > clutchIdx.loss + 5)
    dna.push(
      "Clutch factor: in close games you frequently out-execute in the final minutes — don't panic in long games."
    );
  if (goldXpSync.win > goldXpSync.loss + 5)
    dna.push(
      "Resource sync: gold and XP advantages rise together in wins — coordinated map play over solo heroics."
    );
  if (!dna.length) {
    dna.push(
      "No single coinflip stat: wins come from stacking small edges — comfort picks, stable duos, clean vision and objective play."
    );
  }

  // ==========================================================================
  // 7) Highlight Cards (duo, bot combo, top & next signature)
  // ==========================================================================
  const describeSigCard = (s) => {
    const bits = [];
    const base = getPlayerBaseline(s.pilot);
    const liftWR = s.wr - base.wr;
    const liftPR = (s.pr || 0) - (base.pr || 0);
    const liftMech = (s.mech || 0) - (base.mech || 0);

    if (liftWR > 3) bits.push(`+${liftWR.toFixed(1)}pp WR vs ${s.pilot}'s avg`);
    if (liftPR > 3) bits.push(`impact spike`);
    if (liftMech > 3) bits.push(`mechanical spike`);
    if (s.laneSummary && s.laneSummary.minutes >= 12) {
      const { goldAvg, laneWinRate } = s.laneSummary;
      if (goldAvg > 150) bits.push(`early lane +${goldAvg.toFixed(0)}g`);
      if (laneWinRate > 0.55)
        bits.push(`${(laneWinRate * 100).toFixed(0)}% advantaged lane minutes`);
    }
    if (!bits.length) bits.push("reliable comfort pick profile");
    return bits.join(", ");
  };

  const bestDuo = duoArr[0];
  const mostReliableDuoHTML = bestDuo
    ? `
      <div class="p-3 rounded-2xl bg-sky-50 border border-sky-100 h-full flex flex-col justify-between">
        <div>
          <div class="text-[0.65rem] font-semibold text-sky-500 uppercase mb-1">Most Reliable Duo</div>
          <div class="text-sm font-semibold text-gray-900">${bestDuo.p1} + ${bestDuo.p2}</div>
          <div class="text-[0.7rem] text-gray-700">
            ${bestDuo.winrate.toFixed(1)}% WR (${bestDuo.games} g), +${(bestDuo.winrate - teamWR).toFixed(1)}pp vs team
          </div>
          <div class="text-[0.6rem] text-gray-500 mt-0.5">High shared wins across many games — stable synergy core for drafts.</div>
        </div>
      </div>`
    : `
      <div class="p-3 rounded-2xl bg-sky-50 border border-sky-100 h-full flex items-center">
        <div class="text-[0.7rem] text-gray-500">Not enough repeated lineups yet to lock in a most reliable duo.</div>
      </div>`;

  const bestBot = botArr[0];
  const bestBotLaneComboHTML = bestBot
    ? `
      <div class="p-3 rounded-2xl bg-emerald-50 border border-emerald-100 h-full flex flex-col justify-between">
        <div>
          <div class="text-[0.65rem] font-semibold text-emerald-500 uppercase mb-1">Best Bot Lane Combo</div>
          <div class="text-sm font-semibold text-gray-900">${bestBot.adc} + ${bestBot.sup}</div>
          <div class="text-[0.7rem] text-gray-700">
            ${bestBot.winrate.toFixed(1)}% WR (${bestBot.games} g), +${(bestBot.winrate - teamWR).toFixed(1)}pp vs team
          </div>
          <div class="text-[0.6rem] text-gray-500 mt-0.5">When drafted, this lane reliably outperforms baseline — clear identity lever.</div>
        </div>
      </div>`
    : `
      <div class="p-3 rounded-2xl bg-emerald-50 border border-emerald-100 h-full flex items-center">
        <div class="text-[0.7rem] text-gray-500">No recurring ADC+SUP combo with enough games to highlight yet.</div>
      </div>`;

  const minSigGames = Math.max(6, Math.round(totalGames * 0.18));
  const strongSigCandidates = allSigPicks.filter((s) => {
    if (!s || s.fallback) return false;
    if (s.games < minSigGames) return false;
    if (s.wr < teamWR + 5) return false;
    if ((s.identityScore || 1) < 1.2) return false;
    return true;
  });

  let bestSig = null;
  let nextBestSig = null;
  let bestSigIsSoft = false;

  if (strongSigCandidates.length) {
    strongSigCandidates.sort((a, b) => {
      if ((b.identityScore || 0) !== (a.identityScore || 0))
        return (b.identityScore || 0) - (a.identityScore || 0);
      if (b.games !== a.games) return b.games - a.games;
      return b.wr - a.wr;
    });
    [bestSig, nextBestSig] = strongSigCandidates;
  } else if (allSigPicks.length) {
    const sorted = allSigPicks
      .slice()
      .sort((a, b) => {
        if (b.games !== a.games) return b.games - a.games;
        return (b.identityScore || 0) - (a.identityScore || 0);
      });
    bestSig = sorted[0];
    nextBestSig = sorted[1] || null;
    bestSigIsSoft = true;
  }

  const sigHeader = bestSigIsSoft ? "Best Current Pick" : "Top Signature Pick";

  const sigCardHTML = `
    <div class="p-3 rounded-2xl bg-orange-50 border border-orange-100 h-full flex flex-col justify-between">
      <div>
        <div class="text-[0.65rem] font-semibold text-orange-500 uppercase mb-1">${sigHeader}</div>
        ${
          bestSig
            ? `
          <div class="text-sm font-semibold text-gray-900">${bestSig.champ} ${bestSig.role}</div>
          <div class="text-[0.7rem] text-gray-700">
            ${bestSig.pilot} · ${bestSig.wr.toFixed(1)}% WR, KDA ${bestSig.kda.toFixed(2)} (${bestSig.games} g)
          </div>
          <div class="text-[0.6rem] text-gray-500 mt-0.5">
            ${
              bestSigIsSoft
                ? "High-performing option so far — volume growing; treat as premium comfort, not yet season-defining."
                : describeSigCard(bestSig)
            }
          </div>`
            : `
          <div class="text-[0.7rem] text-gray-500">No champion yet combines volume + overperformance enough to be a true season signature.</div>`
        }
      </div>
      ${
        nextBestSig
          ? `
        <div class="mt-2 pt-2 border-t border-orange-100">
          <div class="text-[0.6rem] font-semibold text-orange-500 uppercase">Next Best Signature</div>
          <div class="text-[0.7rem] text-gray-800">${nextBestSig.champ} ${nextBestSig.role} · ${nextBestSig.pilot}</div>
          <div class="text-[0.6rem] text-gray-600">
            ${nextBestSig.wr.toFixed(1)}% WR, KDA ${nextBestSig.kda.toFixed(2)} (${nextBestSig.games} g)
          </div>
        </div>`
          : ""
      }
    </div>
  `;

  const highlightCards = `
    <div class="grid md:grid-cols-3 gap-3 mb-4">
      ${mostReliableDuoHTML}
      ${bestBotLaneComboHTML}
      ${sigCardHTML}
    </div>
  `;

  // ==========================================================================
  // 8) Core Identity Team Comp mini-card
  // ==========================================================================
  const roleLabel = {
    TOP: "TOP",
    JUNGLE: "JUNGLE",
    MID: "MID",
    BOTTOM: "BOTTOM",
    SUPPORT: "SUPPORT",
  };

  const coreCompSlots = ROLE_ORDER.map((role) => {
    const picks = roleSignatures[role] || [];
    return picks[0] || null;
  }).filter(Boolean);

  const coreCompHTML =
    coreCompSlots.length > 0
      ? `
      <div class="mb-3">
        <div class="p-3 rounded-2xl bg-indigo-50 border border-indigo-100">
          <div class="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 mb-2">
            <div class="text-[0.7rem] font-semibold text-indigo-500 uppercase">
              Core Identity Team Comp
            </div>
            <div class="text-[0.6rem] text-indigo-400">
              Built from your top signature picks — default comp when drafts allow.
            </div>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            ${ROLE_ORDER.map((role) => {
              const s = (roleSignatures[role] || [])[0];
              if (!s) {
                return `
                  <div class="rounded-xl border border-dashed border-indigo-100 bg-white/40 px-2 py-2 text-[0.65rem] text-gray-400 flex flex-col justify-center">
                    <div class="font-semibold text-indigo-300 uppercase">${roleLabel[role] || role}</div>
                    <div>No clear identity pick yet.</div>
                  </div>`;
              }
              const laneText =
                s.laneSummary && s.laneSummary.minutes >= 12
                  ? s.laneSummary.goldAvg > 150
                    ? `Early +${s.laneSummary.goldAvg.toFixed(0)}g, ${(s.laneSummary.laneWinRate * 100).toFixed(0)}% adv. minutes`
                    : `${(s.laneSummary.laneWinRate * 100).toFixed(0)}% advantaged minutes`
                  : "";
              return `
                <div class="rounded-xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06)] px-2 py-2 text-[0.65rem] flex flex-col justify-between">
                  <div>
                    <div class="font-semibold text-indigo-400 uppercase">${roleLabel[role] || role}</div>
                    <div class="text-[0.8rem] font-semibold text-gray-900">${s.champ}</div>
                    <div class="text-[0.65rem] text-gray-700">${s.pilot}</div>
                  </div>
                  <div class="mt-1 text-[0.6rem] text-gray-500">
                    ${s.wr.toFixed(1)}% WR · ${s.games} g
                    ${laneText ? `<br><span class="text-indigo-400">${laneText}</span>` : ""}
                  </div>
                </div>`;
            }).join("")}
          </div>
        </div>
      </div>
    `
      : "";

  // ==========================================================================
  // 9) NEW — Top Team Comps (champ-based mini-cards)
  // ==========================================================================
  const teamCompHTML =
    teamCompArr.length
      ? `
      <div class="mb-4">
        <div class="p-3 rounded-2xl bg-purple-50 border border-purple-100">
          <div class="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 mb-2">
            <div class="text-[0.7rem] font-semibold text-purple-500 uppercase">
              Top Team Comps (Champs)
            </div>
            <div class="text-[0.6rem] text-purple-400">
              Uses WR + early lane & team gold from timeline.
            </div>
          </div>
          <div class="grid gap-2 sm:grid-cols-3">
            ${teamCompArr
              .map((c, idx) => {
                const champsLine = ROLE_ORDER
                  .map((role) => c.roles[role])
                  .filter(Boolean)
                  .join(" · ");
                const earlyText =
                  c.avgEarlyLane
                    ? `${c.avgEarlyLane >= 0 ? "+" : ""}${c.avgEarlyLane.toFixed(0)}g lane diff`
                    : "";
                const tempoText =
                  c.avgGold10
                    ? `${c.avgGold10 >= 0 ? "+" : ""}${c.avgGold10.toFixed(
                        0
                      )}g @10`
                    : "";
                const smallLine =
                  earlyText || tempoText
                    ? [earlyText, tempoText].filter(Boolean).join(" · ")
                    : "";
                return `
                  <div class="rounded-xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06)] px-2 py-2 text-[0.65rem] flex flex-col justify-between">
                    <div>
                      <div class="flex items-baseline justify-between gap-1">
                        <div class="font-semibold text-purple-500">Comp #${idx + 1}</div>
                        <div class="text-[0.6rem] text-gray-500">${c.games} g</div>
                      </div>
                      <div class="mt-1 text-[0.7rem] text-gray-900 leading-tight">
                        ${champsLine}
                      </div>
                    </div>
                    <div class="mt-1 text-[0.6rem] text-gray-600">
                      <span class="font-semibold">${c.wr.toFixed(1)}% WR</span>
                      <span class="${c.lift >= 0 ? "text-emerald-600" : "text-red-500"}">
                        (${c.lift >= 0 ? "+" : ""}${c.lift.toFixed(1)}pp vs team)
                      </span>
                      ${
                        smallLine
                          ? `<br><span class="text-purple-500">${smallLine}</span>`
                          : ""
                      }
                    </div>
                  </div>`;
              })
              .join("")}
          </div>
        </div>
      </div>
    `
      : "";

  // ==========================================================================
  // 10) Detailed subsections
  // ==========================================================================
  const duoHTML =
    duoArr.length > 0
      ? `
      <div>
        <h3 class="text-xs font-semibold text-gray-800 mb-1">Core Duos (min 3 games)</h3>
        <table class="min-w-full text-[0.7rem]">
          <thead class="text-gray-500 border-b">
            <tr>
              <th class="text-left py-1">Duo</th>
              <th class="text-right py-1">G</th>
              <th class="text-right py-1">WR</th>
              <th class="text-right py-1">Lift</th>
              <th class="text-right py-1">Synergy</th>
            </tr>
          </thead>
          <tbody>
            ${duoArr
              .map(
                (d) => `
              <tr class="hover:bg-sky-50 transition">
                <td class="py-0.5">${d.p1} + ${d.p2}</td>
                <td class="py-0.5 text-right">${d.games}</td>
                <td class="py-0.5 text-right">${d.winrate.toFixed(1)}%</td>
                <td class="py-0.5 text-right ${d.lift >= 0 ? "text-emerald-600" : "text-red-500"}">
                  ${d.lift >= 0 ? "+" : ""}${d.lift.toFixed(1)}pp
                </td>
                <td class="py-0.5 text-right text-sky-600">${d.syn.toFixed(1)}</td>
              </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>`
      : `<div class="text-[0.7rem] text-gray-500">Need more data to identify stable high-synergy duos.</div>`;

  const botHTML =
    botArr.length > 0
      ? `
      <div class="mt-3">
        <h3 class="text-xs font-semibold text-gray-800 mb-1">Bot Lane Champion Synergy</h3>
        <div class="grid gap-1">
          ${botArr
            .map(
              (c) => `
            <div class="px-2 py-1 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-between text-[0.7rem]">
              <div>${c.adc} + ${c.sup}</div>
              <div class="text-right">
                <div class="font-semibold">${c.winrate.toFixed(1)}%</div>
                <div class="${c.lift >= 0 ? "text-emerald-600" : "text-red-500"}">
                  ${c.lift >= 0 ? "+" : ""}${c.lift.toFixed(1)}pp
                </div>
              </div>
            </div>`
            )
            .join("")}
        </div>
      </div>`
      : "";

  const signatureHTML = `
    <div>
      <h3 class="text-xs font-semibold text-gray-800 mb-1">Signature Picks by Role</h3>
      <div class="grid gap-2">
        ${ROLE_ORDER.map((role) => {
          const picks = roleSignatures[role] || [];
          if (!picks.length) {
            return `
              <div class="p-2 rounded-xl bg-gray-50 border border-dashed border-gray-200 text-[0.65rem] text-gray-400">
                No clear standout yet for ${roleLabel[role] || role}.
              </div>`;
          }
          return `
            <div class="p-2 rounded-2xl bg-orange-50/40 border border-orange-100 text-[0.7rem]">
              <div class="flex justify-between items-baseline mb-1">
                <div class="text-[0.65rem] font-semibold text-orange-500 uppercase">
                  ${roleLabel[role] || role}
                </div>
                <div class="text-[0.6rem] text-gray-500">Signature ${picks.length > 1 ? "Top 3" : "Pick"}</div>
              </div>
              <div class="grid gap-1">
                ${picks
                  .map(
                    (s) => `
                  <div class="flex justify-between gap-2">
                    <div class="font-semibold text-gray-800">${s.champ}</div>
                    <div class="text-right text-[0.65rem] text-gray-700">
                      ${s.pilot} · ${s.wr.toFixed(1)}% WR, KDA ${s.kda.toFixed(2)} (${s.games} g)
                      <div class="text-[0.6rem] text-gray-500">
                        ${s.fallback ? "best performing option so far" : explainSignature(s)}
                      </div>
                    </div>
                  </div>`
                  )
                  .join("")}
              </div>
            </div>`;
        }).join("")}
      </div>
    </div>
  `;

  const dnaHTML = `
    <div class="mt-3">
      <h3 class="text-xs font-semibold text-gray-800 mb-1">Team Playstyle DNA</h3>
      <div class="text-[0.65rem] text-gray-700 space-y-0.5">
        ${dna.map((t) => `<div>• ${t}</div>`).join("")}
      </div>
    </div>`;

  // ==========================================================================
  // 11) Tabs (aligned with main dashboard controls)
  // ==========================================================================
  const trendButtons = `
    <div class="flex items-center gap-1 bg-sky-50 px-1 py-1 rounded-full shadow-inner">
      ${[
        { key: "5", label: "Last 5" },
        { key: "10", label: "Last 10" },
        { key: "split", label: "Current Split" },
        { key: "season", label: "Season" },
      ]
        .map(
          ({ key, label }) => `
        <button
          class="px-3 py-1 rounded-full text-[0.7rem] font-medium transition
          ${
            synergyTrendWindow === key
              ? "bg-sky-500 text-white shadow-sm"
              : "bg-transparent text-sky-700 hover:bg-white hover:text-sky-600"
          }"
          data-synergy-window="${key}">
          ${label}
        </button>`
        )
        .join("")}
    </div>`;

  // ==========================================================================
  // 12) Render
  // ==========================================================================
  container.innerHTML = `
    <section class="section-wrapper fade-in mb-10">
      <div class="dashboard-card bg-white shadow-sm rounded-2xl border border-gray-100">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-1">
          <div>
            <h2 class="text-[1.1rem] font-semibold text-sky-500 tracking-tight">Team Synergy & Identity</h2>
            <p class="text-[0.7rem] text-gray-600">
              Uses synergy, objective, impact, and lane timeline metrics to reveal who works best together,
              which picks define your style, and which levers actually drive your wins.
            </p>
          </div>
          ${trendButtons}
        </div>

        ${highlightCards}
        ${coreCompHTML}
        ${teamCompHTML}

        <div class="grid md:grid-cols-2 gap-4 mt-1">
          <div class="fade-in delay-1">
            ${duoHTML}
            ${botHTML}
          </div>
          <div class="fade-in delay-2">
            ${signatureHTML}
            ${dnaHTML}
          </div>
        </div>
      </div>
    </section>
  `;

  // --- Bind window buttons ---
  container.querySelectorAll("[data-synergy-window]").forEach((btn) => {
    btn.addEventListener("click", () => {
      synergyTrendWindow = btn.getAttribute("data-synergy-window");
      renderTeamSynergy(data, timelineData);
    });
  });

  // --- Safe debug log ---
  console.log("🧩 Team Synergy v3.7", {
    currentSeason,
    currentSplit,
    games: totalGames,
    teamWR: teamWR.toFixed(1),
    duos: duoArr,
    botCombos: botArr,
    roleSignatures,
    teamComps: teamCompArr,
    timelinePickStats,
    earlyByGameRole,
    dna,
  });
}


/// ============================================================================
// 🎯 OBJECTIVES — First-Hit Impact v2.8
// UI: Presence mini-cards now wrap in a responsive grid (no horizontal scroll)
// UI: Presence cards are taller + cleaner stats layout (2x2)
// Math: infer our TeamId per match (no hard-coded 200), and dedupe objective moments per minute
// ============================================================================

let objectivesTrendWindow = "season";
let objectivesObjectiveGroup = "big"; // "small" | "big"

function renderObjectives(statsData, timelineData) {
  const container = document.getElementById("objectives");
  if (!container || !statsData || !statsData.length) return;

  // --- Helpers ---
  const toNum = (v) => {
    if (v === undefined || v === null || v === "") return 0;
    const n = parseFloat(String(v).replace("%", "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  };

  const normSeason = (v) => String(v ?? "").trim();
  const normSplitNum = (v) => {
    const s = String(v ?? "").trim();
    if (!s) return null;
    const n = parseInt(s, 10);
    return Number.isFinite(n) ? n : null;
  };

  const getGameId = (r) =>
    r["Match ID"] ||
    r["MatchID"] ||
    r["Game #"] ||
    r["Game ID"] ||
    r["GameId"] ||
    r["Game"] ||
    r["Date"];

  const isWin = (res) => String(res || "").toLowerCase() === "win";

  const hasCol = (col) =>
    statsData[0] && Object.prototype.hasOwnProperty.call(statsData[0], col);

  const boolTrue = (v) => String(v).toUpperCase() === "TRUE" || String(v) === "1";
  const boolFalse = (v) =>
    String(v).toUpperCase() === "FALSE" || String(v) === "0";

  const playerKey = (r) =>
    r["Player"] || r["Summoner Name"] || r["Summoner"] || r["IGN"];

  const getRoleRaw = (r) =>
    r["Role"] ||
    r["Position"] ||
    r["Lane"] ||
    r["ROLE"] ||
    r["POSITION"] ||
    "";

  const getRoleNorm = (r) => String(getRoleRaw(r) || "").toUpperCase().trim();

  const getTeamId = (r) => String(r["TeamId"] ?? r["teamId"] ?? "");

  const formatSigned = (v, unit = "") => {
    const val = Math.round(v || 0);
    if (val === 0) return `0${unit}`;
    const sign = val > 0 ? "+" : "";
    return `${sign}${val}${unit}`;
  };

  const ordinal = (n) =>
    n === 1
      ? "First"
      : n === 2
      ? "Second"
      : n === 3
      ? "Third"
      : n === 4
      ? "Fourth"
      : `${n}th`;

  // --- Detect current season & split from dataset ---
  const seasons = [
    ...new Set(
      statsData.map((r) => normSeason(r["Season"])).filter(Boolean)
    ),
  ];
  const currentSeason = seasons.length ? seasons[seasons.length - 1] : null;

  const splitCandidates = statsData
    .filter((r) =>
      currentSeason ? normSeason(r["Season"]) === currentSeason : true
    )
    .map((r) => normSplitNum(r["Split"]))
    .filter((n) => n !== null);

  const currentSplit =
    splitCandidates.length > 0 ? Math.max(...splitCandidates) : null;

  // --- Window filtering (match-based) on main stats sheet ---
  const getRecentGames = (n) => {
    const allGames = statsData.map((r) => getGameId(r)).filter(Boolean);
    const uniqueGames = [...new Set(allGames)];
    const recentGames = uniqueGames.slice(-n);
    return statsData.filter((r) => recentGames.includes(getGameId(r)));
  };

  const filteredData = (() => {
    switch (objectivesTrendWindow) {
      case "5":
        return getRecentGames(5);
      case "10":
        return getRecentGames(10);
      case "split":
        if (currentSplit == null) return statsData;
        return statsData.filter(
          (r) => normSplitNum(r["Split"]) === currentSplit
        );
      case "season":
      default: {
        if (!currentSeason) return statsData;
        return statsData.filter(
          (r) => normSeason(r["Season"]) === currentSeason
        );
      }
    }
  })();

  if (!filteredData.length) {
    container.innerHTML = `
      <section class="section-wrapper fade-in mb-10">
        <div class="dashboard-card bg-white shadow-sm rounded-2xl border border-gray-100">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
            <div>
              <h2 class="text-[1.1rem] font-semibold text-sky-500 tracking-tight">Objectives — First Hit Impact</h2>
              <p class="text-[0.7rem] text-gray-600">
                No games in this window yet — change the window to see first-objective impact.
              </p>
            </div>
          </div>
        </div>
      </section>`;
    return;
  }

  // --- Group by game (main stats) ---
  const games = {};
  filteredData.forEach((r) => {
    const id = getGameId(r);
    if (!id) return;
    if (!games[id]) {
      games[id] = {
        id,
        rows: [],
        result: isWin(r["Result"]) ? "Win" : "Loss",
      };
    }
    games[id].rows.push(r);
  });

  const gameList = Object.values(games);
  if (!gameList.length) return;

  const totalGames = gameList.length || 1;

  // ============================================================================
  // 🧩 Role Profiles (from stats dataset)
  // ============================================================================

  const roleProfileByPlayer = {};
  const seenPlayerGame = new Set();

  filteredData.forEach((r) => {
    const name = playerKey(r);
    if (!name) return;
    const role = getRoleNorm(r) || "UNKNOWN";
    const gid = getGameId(r) || "";
    const key = `${name}||${gid}`;
    if (!gid || seenPlayerGame.has(key)) return;
    seenPlayerGame.add(key);

    if (!roleProfileByPlayer[name]) {
      roleProfileByPlayer[name] = {
        player: name,
        games: 0,
        roles: {}, // ROLE -> count
      };
    }
    const p = roleProfileByPlayer[name];
    p.games += 1;
    if (!p.roles[role]) p.roles[role] = 0;
    p.roles[role] += 1;
  });

  const roleViews = {}; // player -> { primaryRole, primaryShare, flexRoles: [{role, share}] }

  Object.values(roleProfileByPlayer).forEach((p) => {
    if (!p.games) return;
    const entries = Object.entries(p.roles).sort((a, b) => b[1] - a[1]);
    const [primaryRole, primaryCount] = entries[0] || ["UNKNOWN", 0];
    const primaryShare = primaryCount / p.games;
    const flexRoles = entries
      .slice(1)
      .map(([role, count]) => ({
        role,
        share: count / p.games,
      }))
      .filter((fr) => fr.share >= 0.1);

    roleViews[p.player] = {
      primaryRole,
      primaryShare,
      flexRoles,
      games: p.games,
    };
  });

  // --- Helper: column picking & Atakhan/Void detection (from main stats) ---
  const pickCol = (candidates) => candidates.find((c) => hasCol(c)) || null;

  function detectSingleOwnerByParticipation(g, partCols = [], killCols = []) {
    const any = (cols, row) =>
      cols.some((c) => hasCol(c) && toNum(row[c]) > 0);

    // Only our team rows in dataset → if none show participation/kills, assume enemy took it.
    const weAny = g.rows.some((r) => any(partCols, r) || any(killCols, r));
    return { weFirst: weAny, theyFirst: !weAny };
  }

  // --- FIRST-only objective definitions (from main stats sheet) ---
  const firstOnlyDefs = [
    {
      key: "fb",
      label: "🩸 First Blood",
      group: "small",
      teamCols: [
        "First Blood (Team)",
        "FirstBlood (Team)",
        "FB (Team)",
        "First Blood",
        "First Blood Team",
      ],
      enemyCols: [
        "First Blood (Enemy)",
        "FirstBlood (Enemy)",
        "FB (Enemy)",
        "First Blood Enemy",
      ],
    },
    {
      key: "ftower",
      label: "🏛️ First Tower",
      group: "small",
      teamCols: [
        "First Tower (Team)",
        "First Turret (Team)",
        "First Tower",
        "First Turret",
      ],
      enemyCols: [
        "First Tower (Enemy)",
        "First Turret (Enemy)",
        "First Tower Enemy",
        "First Turret Enemy",
      ],
    },
    {
      key: "finhib",
      label: "🏚️ First Inhibitor",
      group: "small",
      teamCols: [
        "First Inhibitor (Team)",
        "First Inhib (Team)",
        "First Inhibitor",
      ],
      enemyCols: [
        "First Inhibitor (Enemy)",
        "First Inhib (Enemy)",
        "First Inhibitor Enemy",
      ],
    },
    {
      key: "dragon",
      label: "🐉 First Dragon",
      group: "big",
      teamCols: [
        "First Dragon (Team)",
        "FirstDrake (Team)",
        "First Drake (Team)",
      ],
      enemyCols: [
        "First Dragon (Enemy)",
        "FirstDrake (Enemy)",
        "First Drake (Enemy)",
      ],
    },
    {
      key: "soul",
      label: "💠 Dragon Soul",
      group: "big",
      teamCols: [
        "Dragon Soul (Team)",
        "Soul (Team)",
        "First Soul (Team)",
      ],
      enemyCols: [
        "Dragon Soul (Enemy)",
        "Soul (Enemy)",
        "First Soul (Enemy)",
      ],
    },
    {
      key: "elder",
      label: "🐲 Elder Dragon",
      group: "big",
      teamCols: [
        "Elder Dragon (Team)",
        "Elder (Team)",
      ],
      enemyCols: [
        "Elder Dragon (Enemy)",
        "Elder (Enemy)",
      ],
    },
    {
      key: "herald",
      label: "👁️ First Herald",
      group: "big",
      teamCols: [
        "First Herald (Team)",
        "First Rift Herald (Team)",
      ],
      enemyCols: [
        "First Herald (Enemy)",
        "First Rift Herald (Enemy)",
      ],
    },
    {
      key: "baron",
      label: "🧬 First Baron",
      group: "big",
      teamCols: [
        "First Baron (Team)",
        "First Nashor (Team)",
      ],
      enemyCols: [
        "First Baron (Enemy)",
        "First Nashor (Enemy)",
      ],
    },
    {
      key: "atakhan",
      label: "🔥 First Atakhan",
      group: "big",
      detect: (g) =>
        detectSingleOwnerByParticipation(
          g,
          ["Atakhan Participation"],
          ["Atakhan Kills"]
        ),
    },
    {
      key: "void",
      label: "🪲 First Void Grubs",
      group: "big",
      detect: (g) =>
        detectSingleOwnerByParticipation(
          g,
          ["Void Grub Participation", "Void Grubs Participation"],
          ["Void Grub Kills", "Void Grubs Kills"]
        ),
    },
  ];

  // --- Compute WR split for each first objective (main stats) ---
  const firstOnlyImpacts = firstOnlyDefs
    .map((def) => {
      const teamCol = def.teamCols ? pickCol(def.teamCols) : null;
      const enemyCol = def.enemyCols ? pickCol(def.enemyCols) : null;

      if (!def.detect && !teamCol && !enemyCol) return null;

      let weFirstGames = 0,
        weFirstWins = 0;
      let theyFirstGames = 0,
        theyFirstWins = 0;

      gameList.forEach((g) => {
        const row = g.rows[0] || {};
        let weFirst = false,
          theyFirst = false;

        if (def.detect) {
          const res = def.detect(g);
          weFirst = !!res.weFirst;
          theyFirst = !!res.theyFirst;
        } else {
          weFirst = teamCol ? boolTrue(row[teamCol]) : false;
          theyFirst = enemyCol ? boolTrue(row[enemyCol]) : false;

          // SPECIAL FALLBACK: only a team-only First Blood column
          if (!enemyCol && teamCol && def.key === "fb") {
            if (boolFalse(row[teamCol])) theyFirst = true;
          }
        }

        if (!weFirst && !theyFirst) return;

        if (weFirst) {
          weFirstGames++;
          if (g.result === "Win") weFirstWins++;
        } else if (theyFirst) {
          theyFirstGames++;
          if (g.result === "Win") theyFirstWins++;
        }
      });

      const totalConsidered = weFirstGames + theyFirstGames;
      if (!totalConsidered) return null;

      const wrWeFirst = weFirstGames
        ? (weFirstWins / weFirstGames) * 100
        : 0;
      const wrTheyFirst = theyFirstGames
        ? (theyFirstWins / theyFirstGames) * 100
        : 0;
      const delta = wrWeFirst - wrTheyFirst;

      return {
        key: def.key,
        label: def.label,
        group: def.group || "big",
        wrWeFirst,
        wrTheyFirst,
        weFirstGames,
        theyFirstGames,
        delta,
        total: totalConsidered,
      };
    })
    .filter(Boolean);

  const totalObjectivesGames = firstOnlyImpacts.reduce(
    (acc, o) => acc + o.total,
    0
  );

  // Active tab subset (small vs big)
  const impactsActiveRaw = firstOnlyImpacts.filter(
    (o) => o.group === objectivesObjectiveGroup
  );
  const impactsActive =
    impactsActiveRaw.length > 0 ? impactsActiveRaw : firstOnlyImpacts;
  const totalObjectivesGamesActive = impactsActive.reduce(
    (acc, o) => acc + o.total,
    0
  );

  // ============================================================================
  // ⏱️ Timeline integration — Presence + Cross-Pressure + Objective context
  // + Drake-by-Drake + Elder/Baron Play
  // ============================================================================

  let lateSummaryHTML = "";
  let objectiveAttendance = null;
  let objectiveContext = null;
  let drakeSectionHTML = "";
  let elderBaronSectionHTML = "";

  if (timelineData && timelineData.length) {
    // 1) Restrict timeline to games in current window
    const windowGameIds = new Set(gameList.map((g) => g.id));
    const tlRows = timelineData.filter((r) => {
      const mid =
        r["Match ID"] ||
        r["MatchID"] ||
        r["Game ID"] ||
        r["GameId"] ||
        r["Game"] ||
        r["Date"];
      if (!mid) return false;
      return windowGameIds.has(mid);
    });

    if (tlRows.length) {
      // 2) Group by game + minute
      const framesByGame = {};
      tlRows.forEach((r) => {
        const mid =
          r["Match ID"] ||
          r["MatchID"] ||
          r["Game ID"] ||
          r["GameId"] ||
          r["Game"] ||
          r["Date"];
        if (!mid) return;
        const minute = toNum(r["Minute"]);
        if (!framesByGame[mid]) framesByGame[mid] = {};
        if (!framesByGame[mid][minute]) framesByGame[mid][minute] = [];
        framesByGame[mid][minute].push(r);
      });

      // ✅ v2.8: infer OUR teamId per match from player overlap (more robust than hardcoding 200)
      const rosterSet = new Set(Object.keys(roleViews || {}));
      const ourTeamIdByMatch = {};
      Object.entries(framesByGame).forEach(([matchId, minuteFrames]) => {
        const mins = Object.keys(minuteFrames)
          .map((m) => toNum(m))
          .sort((a, b) => a - b);
        const sampleMinute = mins.length ? mins[0] : null;
        const frame = sampleMinute != null ? minuteFrames[sampleMinute] : null;
        if (!frame || !frame.length) {
          ourTeamIdByMatch[matchId] = "200";
          return;
        }

        const byTeam = {};
        frame.forEach((row) => {
          const tid = getTeamId(row);
          if (!tid) return;
          if (!byTeam[tid]) byTeam[tid] = new Set();
          const name = playerKey(row);
          if (name) byTeam[tid].add(name);
        });

        const ids = Object.keys(byTeam);
        if (!ids.length) {
          ourTeamIdByMatch[matchId] = "200";
          return;
        }
        if (ids.length === 1) {
          ourTeamIdByMatch[matchId] = ids[0];
          return;
        }

        const overlapScore = (tid) => {
          const set = byTeam[tid];
          if (!set || !set.size || !rosterSet.size) return 0;
          let c = 0;
          set.forEach((n) => {
            if (rosterSet.has(n)) c += 1;
          });
          return c;
        };

        let best = ids[0];
        let bestScore = -1;
        ids.forEach((tid) => {
          const sc = overlapScore(tid);
          if (sc > bestScore) {
            bestScore = sc;
            best = tid;
          }
        });

        ourTeamIdByMatch[matchId] = bestScore > 0 ? best : "200";
      });

      const objectiveEventMap = new Map(); // key: "matchId|minute" -> type
      const typePriority = { baron: 6, elder: 5, dragon: 4, herald: 3, atakhan: 2, void: 1 };
      const addObjectiveMoment = (matchId, minute, type) => {
        const key = `${matchId}|${minute}`;
        const prev = objectiveEventMap.get(key);
        if (!prev) {
          objectiveEventMap.set(key, type);
          return;
        }
        if ((typePriority[type] || 0) > (typePriority[prev] || 0)) {
          objectiveEventMap.set(key, type);
        }
      };

      const drakeEvents = [];     // { matchId, minute, ourIndex, enemyIndex, taker, globalIndex, isElder }
      const elderBuffEvents = []; // { matchId, minute, taker }
      const baronBuffEvents = []; // { matchId, minute, taker }

      // Helpers for minute lookups
      const getClosestMinuteLE = (frames, targetMinute) => {
        const keys = Object.keys(frames);
        let best = null;
        for (let i = 0; i < keys.length; i++) {
          const m = toNum(keys[i]);
          if (m <= targetMinute && (best === null || m > best)) {
            best = m;
          }
        }
        return best;
      };

      const getMinuteAtOrAfter = (frames, targetMinute) => {
        const nums = Object.keys(frames)
          .map((k) => toNum(k))
          .sort((a, b) => a - b);
        let candidate = null;
        for (let i = 0; i < nums.length; i++) {
          const m = nums[i];
          if (m >= targetMinute) {
            candidate = m;
            break;
          }
        }
        if (candidate === null && nums.length) {
          candidate = nums[nums.length - 1];
        }
        return candidate;
      };

      // 3) Detect objective moments per game
      Object.entries(framesByGame).forEach(([matchId, minuteFrames]) => {
        const minutes = Object.keys(minuteFrames)
          .map((m) => toNum(m))
          .sort((a, b) => a - b);

        let prevTeamDrag = 0,
          prevEnemyDrag = 0,
          prevHerald = 0,
          prevTeamBaron = 0,
          prevEnemyBaron = 0,
          prevVoid = 0,
          prevAtakhan = 0,
          globalDrakeCount = 0;

        const ourId = ourTeamIdByMatch[matchId] || "200";

        minutes.forEach((minute) => {
          const frame = minuteFrames[minute];
          if (!frame || !frame.length) return;

          // ✅ use our teamId for the "Team vs Enemy" counters
          const ourRow =
            frame.find((r) => getTeamId(r) === ourId) || frame[0] || null;
          if (!ourRow) return;

          const tDragTeam = toNum(ourRow["Team Dragons"]);
          const tDragEnemy = toNum(ourRow["Enemy Dragons"]);
          const tHerald = toNum(ourRow["Team Heralds"]);
          const tBaronTeam = toNum(ourRow["Team Barons"]);
          const tBaronEnemy = toNum(ourRow["Enemy Barons"]);
          const tVoid = toNum(ourRow["Team Voidgrubs"]);
          const tAtak = toNum(ourRow["Team Atakhans"]);

          // DRAGONS (our team takes) -> objective moments (dragon/elder)
          if (tDragTeam > prevTeamDrag) {
            for (let idx = prevTeamDrag + 1; idx <= tDragTeam; idx++) {
              globalDrakeCount += 1;
              const isElder = globalDrakeCount >= 5;
              drakeEvents.push({
                matchId,
                minute,
                ourIndex: idx,
                enemyIndex: null,
                taker: "us",
                globalIndex: globalDrakeCount,
                isElder,
              });

              addObjectiveMoment(matchId, minute, isElder ? "elder" : "dragon");

              if (isElder) {
                elderBuffEvents.push({ matchId, minute, taker: "us" });
              }
            }
          }

          // DRAGONS (enemy takes) (no presence moment; but buff event matters)
          if (tDragEnemy > prevEnemyDrag) {
            for (let idx = prevEnemyDrag + 1; idx <= tDragEnemy; idx++) {
              globalDrakeCount += 1;
              const isElder = globalDrakeCount >= 5;
              drakeEvents.push({
                matchId,
                minute,
                ourIndex: null,
                enemyIndex: idx,
                taker: "enemy",
                globalIndex: globalDrakeCount,
                isElder,
              });
              if (isElder) {
                elderBuffEvents.push({ matchId, minute, taker: "enemy" });
              }
            }
          }

          // HERALD (our side)
          if (tHerald > prevHerald) {
            addObjectiveMoment(matchId, minute, "herald");
          }

          // BARONS (both sides, + buff events)
          if (tBaronTeam > prevTeamBaron) {
            addObjectiveMoment(matchId, minute, "baron");
            baronBuffEvents.push({ matchId, minute, taker: "us" });
          }
          if (tBaronEnemy > prevEnemyBaron) {
            baronBuffEvents.push({ matchId, minute, taker: "enemy" });
          }

          // VOID / ATAKHAN (our side)
          if (tVoid > prevVoid) {
            addObjectiveMoment(matchId, minute, "void");
          }
          if (tAtak > prevAtakhan) {
            addObjectiveMoment(matchId, minute, "atakhan");
          }

          prevTeamDrag = tDragTeam;
          prevEnemyDrag = tDragEnemy;
          prevHerald = tHerald;
          prevTeamBaron = tBaronTeam;
          prevEnemyBaron = tBaronEnemy;
          prevVoid = tVoid;
          prevAtakhan = tAtak;
        });
      });

      // Build deduped objective moments list (1 per match+minute)
      const objectiveEvents = Array.from(objectiveEventMap.entries()).map(([k, type]) => {
        const parts = k.split("|");
        return { matchId: parts[0], minute: toNum(parts[1]), type };
      });

      // 3.5) Presence classifier (on-time vs cross-pressure vs late)
      // Returns: "onTime" | "crossPressure" | "late"
      const classifyObjectivePresence = (objType, row) => {
        const zone = String(row["Zone"] || "").toLowerCase();

        const inRiver = boolTrue(row["In River"]);
        const inTopSide = boolTrue(row["In Top Side"]);
        const inBotSide = boolTrue(row["In Bot Side"]);
        const inMidInner = boolTrue(row["In Mid/Inner"]);

        const inBase = zone.includes("base") || zone.includes("fountain");

        const closeMates = toNum(row["Close Teammates"]);
        const groupedFlag = boolTrue(row["Is Grouped"]);

        const HARD_GROUP_THRESHOLD = 2;
        const SOFT_GROUP_THRESHOLD = 1;

        const HARD_GROUPED = groupedFlag || closeMates >= HARD_GROUP_THRESHOLD;
        const SOFT_GROUPED = groupedFlag || closeMates >= SOFT_GROUP_THRESHOLD;

        const inBotLike = inBotSide || zone.includes("bot");
        const inTopLike = inTopSide || zone.includes("top");
        const inMidLike = inMidInner || zone.includes("mid");

        

        // region relative to the objective
        let region = "neutral";
        if (objType === "dragon" || objType === "void" || objType === "atakhan" || objType === "elder") {
          if (inBase) region = "base";
          else if (inBotLike || inRiver || inMidLike) region = "correct";
          else if (inTopLike) region = "opposite";
        } else if (objType === "herald" || objType === "baron") {
          if (inBase) region = "base";
          else if (inTopLike || inRiver || inMidLike) region = "correct";
          else if (inBotLike) region = "opposite";
        } else {
          if (inBase) region = "base";
        }

        if (region === "base") return "late";

        // 1) On-time: correct region + grouped
        if (region === "correct" && HARD_GROUPED) return "onTime";
        if (region === "correct" && SOFT_GROUPED && closeMates >= 1) return "onTime";

        // 2) Cross-pressure: opposite side + clearly winning lane + mostly alone
        if (region === "opposite") {
          const laneGoldState = toNum(row["Lane Gold State"]);
          const laneXPState = toNum(row["Lane XP State"]);
          const laneCSState = toNum(row["Lane CS State"]);

          const goldDiff = toNum(row["Gold Diff vs Opp"]);
          const xpDiff = toNum(row["XP Diff vs Opp"]);
          const level = toNum(row["Level"]);
          const oppLevel = toNum(row["Lane Opponent Level"]);
          const levelDiff = level - oppLevel;

          const CROSS_MIN_GOLD_DIFF = 800;
          const CROSS_MIN_XP_LEVEL_DIFF = 1;
          const CROSS_MIN_XP_RAW_DIFF = 400;

          const bigLead =
            goldDiff >= CROSS_MIN_GOLD_DIFF ||
            levelDiff >= CROSS_MIN_XP_LEVEL_DIFF ||
            xpDiff >= CROSS_MIN_XP_RAW_DIFF ||
            laneGoldState > 0 ||
            laneXPState > 0 ||
            laneCSState > 0;

          const mostlySolo = closeMates <= 1 && !groupedFlag;

          if (bigLead && mostlySolo) return "crossPressure";
        }

        return "late";
      };

      // 4) Attendance map: on-time vs cross-pressure vs late when WE take something
      const attendanceByPlayer = {};

      objectiveEvents.forEach((ev) => {
        const frames = framesByGame[ev.matchId];
        if (!frames) return;
        const frame = frames[ev.minute];
        if (!frame) return;

        const ourId = ourTeamIdByMatch[ev.matchId] || "200";
        const teamRows = frame.filter((r) => getTeamId(r) === ourId);
        if (!teamRows.length) return;

        teamRows.forEach((row) => {
          const name = playerKey(row);
          if (!name) return;

          if (!attendanceByPlayer[name]) {
            attendanceByPlayer[name] = {
              player: name,
              events: 0,
              onTime: 0,
              crossPressure: 0,
              late: 0,
            };
          }

          attendanceByPlayer[name].events += 1;

          const presence = classifyObjectivePresence(ev.type, row);
          if (presence === "onTime") attendanceByPlayer[name].onTime += 1;
          else if (presence === "crossPressure") attendanceByPlayer[name].crossPressure += 1;
          else attendanceByPlayer[name].late += 1;
        });
      });

      // Ensure every player with games in this window appears
      const allPlayersInWindow = Object.keys(roleViews);
      allPlayersInWindow.forEach((name) => {
        if (!attendanceByPlayer[name]) {
          attendanceByPlayer[name] = {
            player: name,
            events: 0,
            onTime: 0,
            crossPressure: 0,
            late: 0,
          };
        }
      });

      const attendanceList = Object.values(attendanceByPlayer).map((a) => {
        const profile = roleViews[a.player] || null;
        const primaryRole = profile ? profile.primaryRole : "—";
        const primaryShare = profile ? profile.primaryShare : null;
        const flexRoles = profile ? profile.flexRoles : [];
        const lateRate = a.events ? a.late / a.events : 0;
        const onTimeRate = a.events ? a.onTime / a.events : 0;
        const crossPressureRate = a.events ? a.crossPressure / a.events : 0;

        return {
          ...a,
          primaryRole,
          primaryShare,
          flexRoles,
          lateRate,
          onTimeRate,
          crossPressureRate,
          gamesInWindow: profile ? profile.games : null,
        };
      });

      // sort for presence cards
      attendanceList.sort((a, b) => {
        const aHas = a.events > 0;
        const bHas = b.events > 0;
        if (aHas !== bHas) return aHas ? -1 : 1;
        if (!aHas && !bHas) return a.player.localeCompare(b.player);
        if (b.onTimeRate !== a.onTimeRate) return b.onTimeRate - a.onTimeRate;
        return (b.events || 0) - (a.events || 0);
      });

      objectiveAttendance = attendanceList;

      // --- Objective context mini-stats (team-level, all objectives we take) ---
      const ctx = {
        events: 0,
        goldDiffSum: 0,
        xpDiffSum: 0,
        teamGroupedSum: 0,
        enemyGroupedSum: 0,
        teamWardsPlacedSum: 0,
        enemyWardsPlacedSum: 0,
        teamWardsKilledSum: 0,
        enemyWardsKilledSum: 0,
      };

      objectiveEvents.forEach((ev) => {
        const frames = framesByGame[ev.matchId];
        if (!frames) return;
        const frame = frames[ev.minute];
        if (!frame) return;

        const ourId = ourTeamIdByMatch[ev.matchId] || "200";
        const enemyId = ourId === "200" ? "100" : "200";

        const teamRows = frame.filter((r) => getTeamId(r) === ourId);
        const enemyRows = frame.filter((r) => getTeamId(r) === enemyId);

        if (!teamRows.length) return;

        const teamRow = teamRows[0];
        const enemyRow = enemyRows[0] || null;

        const teamGold = toNum(teamRow["Team Gold"]);
        const enemyGold = enemyRow ? toNum(enemyRow["Team Gold"]) : toNum(teamRow["Enemy Gold"]);
        const teamXP = toNum(teamRow["Team XP"]);
        const enemyXP = enemyRow ? toNum(enemyRow["Team XP"]) : toNum(teamRow["Enemy XP"]);

        const goldDiff = teamGold - enemyGold;
        const xpDiff = teamXP - enemyXP;

        let teamGrouped = 0;
        let enemyGrouped = 0;

        teamRows.forEach((r) => {
          const grouped = boolTrue(r["Is Grouped"]) || toNum(r["Close Teammates"]) >= 2;
          if (grouped) teamGrouped += 1;
        });

        enemyRows.forEach((r) => {
          const grouped = boolTrue(r["Is Grouped"]) || toNum(r["Close Teammates"]) >= 2;
          if (grouped) enemyGrouped += 1;
        });

        const teamWardsPlaced = toNum(teamRow["Team Wards Placed"]);
        const enemyWardsPlaced = enemyRow
          ? toNum(enemyRow["Team Wards Placed"])
          : toNum(teamRow["Enemy Wards Placed"]);
        const teamWardsKilled = toNum(teamRow["Team Wards Killed"]);
        const enemyWardsKilled = enemyRow
          ? toNum(enemyRow["Team Wards Killed"])
          : toNum(teamRow["Enemy Wards Killed"]);

        ctx.events += 1;
        ctx.goldDiffSum += goldDiff;
        ctx.xpDiffSum += xpDiff;
        ctx.teamGroupedSum += teamGrouped;
        ctx.enemyGroupedSum += enemyGrouped;
        ctx.teamWardsPlacedSum += teamWardsPlaced;
        ctx.enemyWardsPlacedSum += enemyWardsPlaced;
        ctx.teamWardsKilledSum += teamWardsKilled;
        ctx.enemyWardsKilledSum += enemyWardsKilled;
      });

      if (ctx.events > 0) {
        objectiveContext = {
          events: ctx.events,
          avgGoldDiff: ctx.goldDiffSum / ctx.events,
          avgXpDiff: ctx.xpDiffSum / ctx.events,
          avgTeamGrouped: ctx.teamGroupedSum / ctx.events,
          avgEnemyGrouped: ctx.enemyGroupedSum / ctx.events,
          avgTeamWardsPlaced: ctx.teamWardsPlacedSum / ctx.events,
          avgEnemyWardsPlaced: ctx.enemyWardsPlacedSum / ctx.events,
          avgTeamWardsKilled: ctx.teamWardsKilledSum / ctx.events,
          avgEnemyWardsKilled: ctx.enemyWardsKilledSum / ctx.events,
        };
      }

      // --- Drake-by-drake WR + state + show-up (our 1st–4th drake) ---
      if (drakeEvents.length) {
        const makeBucket = (index) => ({
          index,
          weGotGames: 0,
          weGotWins: 0,
          theyGotGames: 0,
          theyGotWins: 0,
          samples: 0,
          goldOurSum: 0,
          goldEnemySum: 0,
          xpOurSum: 0,
          xpEnemySum: 0,
          wardsOurSum: 0,
          wardsEnemySum: 0,
          clearsOurSum: 0,
          clearsEnemySum: 0,
          playerPresence: {}, // name -> { player, events, onTime, late }
        });

        const drakeBuckets = {
          1: makeBucket(1),
          2: makeBucket(2),
          3: makeBucket(3),
          4: makeBucket(4),
        };

        drakeEvents.forEach((ev) => {
          const idx = ev.taker === "us" ? ev.ourIndex : ev.enemyIndex;
          if (!idx || idx < 1 || idx > 4) return;

          const bucket = drakeBuckets[idx];
          const game = games[ev.matchId];
          if (!game) return;
          const win = game.result === "Win";

          if (ev.taker === "us") {
            bucket.weGotGames += 1;
            if (win) bucket.weGotWins += 1;
          } else {
            bucket.theyGotGames += 1;
            if (win) bucket.theyGotWins += 1;
          }

          // Only compute state/vision + show-up for OUR drakes
          if (ev.taker !== "us" || !ev.ourIndex || ev.ourIndex < 1 || ev.ourIndex > 4) return;

          const frames = framesByGame[ev.matchId];
          if (!frames) return;

          const ourId = ourTeamIdByMatch[ev.matchId] || "200";

          const beforeMinute = Math.max(0, ev.minute - 2);
          const minuteBefore = getClosestMinuteLE(frames, beforeMinute);
          const minuteAt = getClosestMinuteLE(frames, ev.minute);

          if (minuteBefore == null || minuteAt == null) return;

          const frameBefore = frames[minuteBefore];
          const frameAt = frames[minuteAt];

          const teamRowBefore =
            frameBefore.find((r) => getTeamId(r) === ourId) || frameBefore[0];
          const teamRowAt =
            frameAt.find((r) => getTeamId(r) === ourId) || frameAt[0];

          if (!teamRowBefore || !teamRowAt) return;

          const ourGold = toNum(teamRowBefore["Team Gold"]);
          const enemyGold = toNum(teamRowBefore["Enemy Gold"]);
          const ourXP = toNum(teamRowBefore["Team XP"]);
          const enemyXP = toNum(teamRowBefore["Enemy XP"]);

          const ourWardsBefore = toNum(teamRowBefore["Team Wards Placed"]);
          const enemyWardsBefore = toNum(teamRowBefore["Enemy Wards Placed"]);
          const ourClearsBefore = toNum(teamRowBefore["Team Wards Killed"]);
          const enemyClearsBefore = toNum(teamRowBefore["Enemy Wards Killed"]);

          const ourWardsAt = toNum(teamRowAt["Team Wards Placed"]);
          const enemyWardsAt = toNum(teamRowAt["Enemy Wards Placed"]);
          const ourClearsAt = toNum(teamRowAt["Team Wards Killed"]);
          const enemyClearsAt = toNum(teamRowAt["Enemy Wards Killed"]);

          const ourWards2m = Math.max(0, ourWardsAt - ourWardsBefore);
          const enemyWards2m = Math.max(0, enemyWardsAt - enemyWardsBefore);
          const ourClears2m = Math.max(0, ourClearsAt - ourClearsBefore);
          const enemyClears2m = Math.max(0, enemyClearsAt - enemyClearsBefore);

          bucket.samples += 1;
          bucket.goldOurSum += ourGold;
          bucket.goldEnemySum += enemyGold;
          bucket.xpOurSum += ourXP;
          bucket.xpEnemySum += enemyXP;
          bucket.wardsOurSum += ourWards2m;
          bucket.wardsEnemySum += enemyWards2m;
          bucket.clearsOurSum += ourClears2m;
          bucket.clearsEnemySum += enemyClears2m;

          const teamRowsAtDrake = frameAt.filter((r) => getTeamId(r) === ourId);

          teamRowsAtDrake.forEach((row) => {
            const name = playerKey(row);
            if (!name) return;

            const presence = classifyObjectivePresence("dragon", row);
            if (!bucket.playerPresence[name]) {
              bucket.playerPresence[name] = {
                player: name,
                events: 0,
                onTime: 0,
                late: 0,
              };
            }

            const p = bucket.playerPresence[name];
            p.events += 1;
            if (presence === "late") p.late += 1;
            else p.onTime += 1; // onTime + crossPressure = "present"
          });
        });

        const buildPresenceSummaryHTML = (bucket) => {
          const list = Object.values(bucket.playerPresence || {});
          if (!list.length) return "";

          const withRate = list.map((p) => ({
            ...p,
            onTimeRate: p.events ? p.onTime / p.events : 0,
          }));

          const eligible = withRate.filter((p) => p.events >= 2);
          if (!eligible.length) return "";

          const leaders = [...eligible]
            .sort((a, b) => b.onTimeRate - a.onTimeRate)
            .slice(0, 2);
          const laggards = [...eligible]
            .sort((a, b) => a.onTimeRate - b.onTimeRate)
            .slice(0, 2);

          const fmtList = (arr) =>
            arr
              .map(
                (p) =>
                  `${p.player} (${Math.round((p.onTimeRate || 0) * 100)}%)`
              )
              .join(", ");

          return `
            <div class="mt-2 text-[0.6rem] text-slate-600">
              <p class="mb-0.5">
                <span class="font-semibold text-emerald-700">Most often there:</span>
                ${leaders.length ? fmtList(leaders) : "—"}
              </p>
              <p>
                <span class="font-semibold text-rose-600">Needs better show-up:</span>
                ${laggards.length ? fmtList(laggards) : "—"}
              </p>
            </div>`;
        };

        const drakeCardsHTML = [1, 2, 3, 4]
          .map((idx) => drakeBuckets[idx])
          .filter(
            (b) => b && (b.weGotGames > 0 || b.theyGotGames > 0 || b.samples > 0)
          )
          .map((b) => {
            const totalOurTakes = b.weGotGames;
            const totalEnemyTakes = b.theyGotGames;

            const ourWRWhenWe = totalOurTakes
              ? (b.weGotWins / totalOurTakes) * 100
              : null;
            const ourWRWhenThey = totalEnemyTakes
              ? (b.theyGotWins / totalEnemyTakes) * 100
              : null;

            const avgOurGold = b.samples ? b.goldOurSum / b.samples : 0;
            const avgEnemyGold = b.samples ? b.goldEnemySum / b.samples : 0;
            const avgOurXP = b.samples ? b.xpOurSum / b.samples : 0;
            const avgEnemyXP = b.samples ? b.xpEnemySum / b.samples : 0;

            const deltaGold = avgOurGold - avgEnemyGold;
            const deltaXP = avgOurXP - avgEnemyXP;

            let stateLabel = "You’re usually around even";
            if (deltaGold > 600 || deltaXP > 600) stateLabel = "You’re usually ahead";
            else if (deltaGold < -600 || deltaXP < -600) stateLabel = "You’re usually behind";

            const avgOurWards = b.samples ? b.wardsOurSum / b.samples : 0;
            const avgEnemyWards = b.samples ? b.wardsEnemySum / b.samples : 0;
            const avgOurClears = b.samples ? b.clearsOurSum / b.samples : 0;
            const avgEnemyClears = b.samples ? b.clearsEnemySum / b.samples : 0;

            const stateDeltaText = `Δ ${formatSigned(deltaGold, "g")}, ${formatSigned(deltaXP, " XP")}`;

            const headerSampleText = `${totalOurTakes}× we drake${totalEnemyTakes ? `, ${totalEnemyTakes}× they drake` : ""}`;

            const presenceSummaryHTML = buildPresenceSummaryHTML(b);

            return `
              <div class="rounded-3xl border border-slate-100 bg-slate-50/70 px-3 py-3 flex flex-col justify-between">
                <div>
                  <div class="flex items-center justify-between gap-2 mb-1">
                    <h4 class="text-[0.8rem] font-semibold text-slate-800">
                      ${ordinal(b.index)} Drake
                    </h4>
                    <span class="text-[0.65rem] text-slate-500">${headerSampleText}</span>
                  </div>
                  <p class="text-[0.7rem] text-slate-700 mb-1">
                    ${stateLabel} <span class="text-slate-500">(${stateDeltaText})</span> before this drake.
                  </p>
                  <p class="text-[0.65rem] text-slate-600 mb-1.5">
                    Avg game state (our takes):
                    <span class="font-semibold">${Math.round(avgOurGold || 0)}g, ${Math.round(avgOurXP || 0)} XP</span>
                    vs enemy
                    <span class="font-semibold">${Math.round(avgEnemyGold || 0)}g, ${Math.round(avgEnemyXP || 0)} XP</span>.
                  </p>
                  <p class="text-[0.65rem] text-slate-600 mb-1.5">
                    Your vision (last 2m):
                    <span class="font-semibold">${avgOurWards.toFixed(1)} wards · ${avgOurClears.toFixed(1)} clears</span>.
                    Enemy vision (last 2m):
                    <span class="font-semibold">${avgEnemyWards.toFixed(1)} wards · ${avgEnemyClears.toFixed(1)} clears</span>.
                  </p>
                </div>

                <div class="mt-2 grid grid-cols-2 gap-2 text-[0.65rem]">
                  <div class="rounded-2xl border border-emerald-100 bg-emerald-50/80 px-2 py-1.5">
                    <div class="font-semibold text-emerald-700 mb-0.5">We got it</div>
                    ${
                      ourWRWhenWe != null
                        ? `<div class="text-slate-800">
                            WR ${ourWRWhenWe.toFixed(1)}%
                            <span class="text-slate-500">(${b.weGotWins}/${b.weGotGames})</span>
                           </div>`
                        : `<div class="text-slate-500">No samples yet.</div>`
                    }
                  </div>
                  <div class="rounded-2xl border border-rose-100 bg-rose-50/80 px-2 py-1.5">
                    <div class="font-semibold text-rose-700 mb-0.5">They got it</div>
                    ${
                      ourWRWhenThey != null
                        ? `<div class="text-slate-800">
                            Our WR ${ourWRWhenThey.toFixed(1)}%
                            <span class="text-slate-500">(${b.theyGotWins}/${b.theyGotGames})</span>
                           </div>`
                        : `<div class="text-slate-500">No samples yet.</div>`
                    }
                  </div>
                </div>

                ${presenceSummaryHTML}
              </div>`;
          })
          .join("");

        if (drakeCardsHTML) {
          drakeSectionHTML = `
            <div class="mt-6 pt-4 border-t border-slate-100">
              <h3 class="text-[0.8rem] font-semibold text-slate-800 mb-1">
                🐍 Drake-by-Drake Vision (our 1st–4th drake)
              </h3>
              <p class="text-[0.65rem] text-slate-600 mb-3 max-w-3xl">
                For each of <span class="font-semibold">our 1st–4th drakes</span>, we look at the
                <span class="font-semibold">2 minutes before the take</span> and compare gold / XP state and vision.
                Mini-cards show your winrate when <span class="font-semibold">you</span> get that drake vs when
                <span class="font-semibold">the enemy</span> gets their Nth drake, plus who most often shows up on time or tends to be missing.
              </p>
              <div class="grid md:grid-cols-2 xl:grid-cols-4 gap-3">
                ${drakeCardsHTML}
              </div>
            </div>`;
        }
      }

      // --- Elder & Baron Play: 3-minute gold swing after buff ---
      const buildBuffStats = (events, label, emoji) => {
        if (!events.length) return null;

        const stats = {
          us: { events: 0, wins: 0, diffGainSum: 0, ourGainSum: 0, enemyGainSum: 0 },
                    enemy: { events: 0, wins: 0, diffGainSum: 0, ourGainSum: 0, enemyGainSum: 0 },
        };

        events.forEach((ev) => {
          const frames = framesByGame[ev.matchId];
          if (!frames) return;

          const minuteStart = ev.minute;
          const minuteEnd = minuteStart + 3;

          const mStart = getMinuteAtOrAfter(frames, minuteStart);
          const mEnd = getMinuteAtOrAfter(frames, minuteEnd);
          if (mStart == null || mEnd == null) return;

          const frameStart = frames[mStart];
          const frameEnd = frames[mEnd];
          if (!frameStart || !frameEnd) return;

          const ourId = ourTeamIdByMatch[ev.matchId] || "200";

          // Use our team row (so Team Gold / Enemy Gold are consistent)
          const teamRowStart =
            frameStart.find((r) => getTeamId(r) === ourId) || frameStart[0];
          const teamRowEnd =
            frameEnd.find((r) => getTeamId(r) === ourId) || frameEnd[0];

          if (!teamRowStart || !teamRowEnd) return;

          const ourGoldStart = toNum(teamRowStart["Team Gold"]);
          const enemyGoldStart = toNum(teamRowStart["Enemy Gold"]);
          const ourGoldEnd = toNum(teamRowEnd["Team Gold"]);
          const enemyGoldEnd = toNum(teamRowEnd["Enemy Gold"]);

          const diffStart = ourGoldStart - enemyGoldStart;
          const diffEnd = ourGoldEnd - enemyGoldEnd;

          const diffGain = diffEnd - diffStart;
          const ourGain = ourGoldEnd - ourGoldStart;
          const enemyGain = enemyGoldEnd - enemyGoldStart;

          const bucket = ev.taker === "us" ? stats.us : stats.enemy;

          bucket.events += 1;
          bucket.diffGainSum += diffGain;
          bucket.ourGainSum += ourGain;
          bucket.enemyGainSum += enemyGain;

          const game = games[ev.matchId];
          if (game && game.result === "Win") {
            bucket.wins += 1;
          }
        });

        if (!stats.us.events && !stats.enemy.events) return null;

        const buildSideCard = (sideKey, title, colorCls, bgCls, borderCls) => {
          const s = stats[sideKey];
          if (!s.events) {
            return `
              <div class="rounded-2xl border ${borderCls} ${bgCls} px-3 py-2 text-[0.65rem]">
                <div class="font-semibold ${colorCls} mb-0.5">${title}</div>
                <div class="text-slate-500">No samples yet.</div>
              </div>`;
          }

          const wr = (s.wins / s.events) * 100;
          const avgDiffGain = s.diffGainSum / s.events;
          const avgOurGain = s.ourGainSum / s.events;
          const avgEnemyGain = s.enemyGainSum / s.events;

          return `
            <div class="rounded-2xl border ${borderCls} ${bgCls} px-3 py-2 text-[0.65rem]">
              <div class="flex items-center justify-between mb-0.5">
                <div class="font-semibold ${colorCls}">${title}</div>
                <span class="text-[0.6rem] text-slate-500">${s.events} plays</span>
              </div>
              <p class="mb-0.5 text-slate-800">
                WR <span class="font-semibold">${wr.toFixed(1)}%</span>
                <span class="text-slate-500"> (${s.wins}/${s.events})</span>
              </p>
              <p class="mb-0.5 text-slate-700">
                Gold diff swing (3m): <span class="font-semibold">${formatSigned(avgDiffGain, "g")}</span>
              </p>
              <p class="mb-0 text-slate-600">
                Our gain: <span class="font-semibold">${Math.round(avgOurGain)}g</span>
                · Enemy: <span class="font-semibold">${Math.round(avgEnemyGain)}g</span>
              </p>
            </div>`;
        };

        const usCard = buildSideCard(
          "us",
          `${emoji} We had ${label}`,
          "text-emerald-700",
          "bg-emerald-50/70",
          "border-emerald-100"
        );
        const enemyCard = buildSideCard(
          "enemy",
          `${emoji} They had ${label}`,
          "text-rose-700",
          "bg-rose-50/70",
          "border-rose-100"
        );

        return `
          <div class="grid md:grid-cols-2 gap-3">
            ${usCard}
            ${enemyCard}
          </div>`;
      };

      const elderHTML = elderBuffEvents.length
        ? buildBuffStats(elderBuffEvents, "Elder", "🐲")
        : null;
      const baronHTML = baronBuffEvents.length
        ? buildBuffStats(baronBuffEvents, "Baron", "🧬")
        : null;

      if (elderHTML || baronHTML) {
        elderBaronSectionHTML = `
          <div class="mt-6 pt-4 border-t border-slate-100">
            <h3 class="text-[0.8rem] font-semibold text-slate-800 mb-1">
              🧭 Elder & Baron Play — 3-minute Gold Swing
            </h3>
            <p class="text-[0.65rem] text-slate-600 mb-3 max-w-3xl">
              For each Elder/Baron secured, we measure how much the <span class="font-semibold">gold difference moves</span>
              over the next <span class="font-semibold">3 minutes</span>. This is a “conversion” check: do buffs turn into leads/wins?
            </p>
            <div class="space-y-3">
              ${elderHTML ? `<div>
                <h4 class="text-[0.75rem] font-semibold text-slate-700 mb-1">🐲 Elder</h4>
                ${elderHTML}
              </div>` : ""}
              ${baronHTML ? `<div>
                <h4 class="text-[0.75rem] font-semibold text-slate-700 mb-1">🧬 Baron</h4>
                ${baronHTML}
              </div>` : ""}
            </div>
          </div>`;
      }

      // --- Presence mini-cards + late summary ---
      if (attendanceList.length) {
        const playersWithData = attendanceList.filter((a) => a.events > 0);

        const avgPlayersOnTime =
          playersWithData.length > 0
            ? playersWithData.reduce((sum, a) => sum + (a.onTimeRate || 0), 0) /
              playersWithData.length
            : 0;

        const best = playersWithData.length
          ? [...playersWithData].sort(
              (a, b) =>
                b.onTimeRate - a.onTimeRate ||
                (b.events || 0) - (a.events || 0)
            )[0]
          : null;

        const worst = playersWithData.length
          ? [...playersWithData].sort(
              (a, b) =>
                a.onTimeRate - b.onTimeRate ||
                (b.events || 0) - (a.events || 0)
            )[0]
          : null;

        const avgPlayersOnTimePct = (avgPlayersOnTime * 100).toFixed(1);
        const worstLatePct = worst ? (worst.lateRate * 100).toFixed(1) : "—";
        const bestLatePct = best ? (best.lateRate * 100).toFixed(1) : "—";

        const makePresenceGrade = (onTimeRate, events) => {
          if (!events) {
            return {
              label: "No data yet",
              desc: "No detected objective moments in the timeline for this window.",
              cls: "bg-slate-50 border-slate-200 text-slate-700",
              pill: "bg-slate-100 text-slate-600",
            };
          }
          if (onTimeRate >= 0.7) {
            return {
              label: "Anchor",
              desc: "Usually grouped and on the right side when objectives are taken.",
              cls: "bg-emerald-50 border-emerald-200 text-emerald-900",
              pill: "bg-emerald-100 text-emerald-800",
            };
          }
          if (onTimeRate >= 0.45) {
            return {
              label: "Solid helper",
              desc: "Often there, with some drift or late arrivals.",
              cls: "bg-amber-50 border-amber-200 text-amber-900",
              pill: "bg-amber-100 text-amber-800",
            };
          }
          return {
            label: "Needs sync",
            desc: "More often late or missing when objectives are taken.",
            cls: "bg-rose-50 border-rose-200 text-rose-900",
            pill: "bg-rose-100 text-rose-800",
          };
        };

        // ✅ v2.8: taller cards + 2x2 stats layout (cleaner)
        const makePresenceCardCore = (a) => {
          const onTimePct = a.events ? (a.onTimeRate * 100).toFixed(1) : "—";
          const latePct = a.events ? (a.lateRate * 100).toFixed(1) : "—";
          const crossPct = a.events ? (a.crossPressureRate * 100).toFixed(1) : "—";

          const primaryRoleLabel = a.primaryRole || "—";
          const primaryShareLabel =
            a.primaryShare != null ? `${(a.primaryShare * 100).toFixed(0)}%` : "—";

          const grade = makePresenceGrade(a.onTimeRate, a.events);
          const lowSample = a.events > 0 && a.events < 3;

          return `
            <div class="rounded-2xl border ${grade.cls} px-3 py-2.5 text-[0.65rem] ${lowSample ? "opacity-80" : ""}">
              <div class="flex items-center justify-between gap-2 mb-1">
                <div class="font-semibold text-[0.72rem] truncate">${a.player}</div>
                <span class="px-2 py-0.5 rounded-full text-[0.6rem] font-semibold ${grade.pill}">
                  ${grade.label}
                </span>
              </div>

              <div class="flex items-center justify-between mb-2">
                <span class="uppercase tracking-wide text-[0.6rem] opacity-80">${primaryRoleLabel}</span>
                <span class="text-[0.6rem] opacity-80">% in role: <strong>${primaryShareLabel}</strong></span>
              </div>

              <div class="grid grid-cols-2 gap-2 mb-2">
                <div class="rounded-xl bg-white/60 border border-black/5 px-2 py-1.5">
                  <div class="text-[0.58rem] opacity-60">Obj. seen</div>
                  <div class="font-semibold text-[0.75rem]">${a.events}</div>
                </div>
                <div class="rounded-xl bg-white/60 border border-black/5 px-2 py-1.5">
                  <div class="text-[0.58rem] opacity-60">On time</div>
                  <div class="font-semibold text-[0.75rem]">${onTimePct}%</div>
                </div>
                <div class="rounded-xl bg-white/60 border border-black/5 px-2 py-1.5">
                  <div class="text-[0.58rem] opacity-60">X-pressure</div>
                  <div class="font-semibold text-[0.75rem]">${crossPct}%</div>
                </div>
                <div class="rounded-xl bg-white/60 border border-black/5 px-2 py-1.5">
                  <div class="text-[0.58rem] opacity-60">Late</div>
                  <div class="font-semibold text-[0.75rem]">${latePct}%</div>
                </div>
              </div>

              <p class="text-[0.6rem] leading-snug opacity-90">
                ${grade.desc}
                ${lowSample ? `<span class="ml-1 opacity-80">· low sample</span>` : ""}
              </p>
            </div>`;
        };

        const coreCardsHTML = attendanceList.map(makePresenceCardCore).join("");

        const flexRows = [];
        attendanceList.forEach((a) => {
          if (!a.flexRoles || !a.flexRoles.length) return;
          a.flexRoles.forEach((fr) => {
            flexRows.push({
              player: a.player,
              flexRole: fr.role,
              share: fr.share,
              onTimeRate: a.onTimeRate,
              crossPressureRate: a.crossPressureRate,
              lateRate: a.lateRate,
              events: a.events,
            });
          });
        });

        flexRows.sort((a, b) => {
          const aHas = a.events > 0;
          const bHas = b.events > 0;
          if (aHas !== bHas) return aHas ? -1 : 1;
          if (!aHas && !bHas) return a.player.localeCompare(b.player);
          if (b.onTimeRate !== a.onTimeRate) return b.onTimeRate - a.onTimeRate;
          return (b.events || 0) - (a.events || 0);
        });

        const flexCardsHTML =
          flexRows.length > 0
            ? flexRows
                .map((fr) => {
                  const onTimePct = fr.events ? (fr.onTimeRate * 100).toFixed(1) : "—";
                  const latePct = fr.events ? (fr.lateRate * 100).toFixed(1) : "—";
                  const crossPct = fr.events ? (fr.crossPressureRate * 100).toFixed(1) : "—";
                  const shareLabel = `${(fr.share * 100).toFixed(0)}%`;
                  const grade = makePresenceGrade(fr.onTimeRate, fr.events);
                  const lowSample = fr.events > 0 && fr.events < 3;

                  return `
                    <div class="rounded-2xl border ${grade.cls} px-3 py-2.5 text-[0.65rem] ${lowSample ? "opacity-80" : ""}">
                      <div class="flex items-center justify-between gap-2 mb-1">
                        <div class="font-semibold text-[0.72rem] truncate">${fr.player}</div>
                        <span class="px-2 py-0.5 rounded-full text-[0.6rem] font-semibold ${grade.pill}">
                          ${grade.label}
                        </span>
                      </div>

                      <div class="flex items-center justify-between mb-2">
                        <span class="uppercase tracking-wide text-[0.6rem] opacity-80">Flex: ${fr.flexRole}</span>
                        <span class="text-[0.6rem] opacity-80">Share: <strong>${shareLabel}</strong></span>
                      </div>

                      <div class="grid grid-cols-2 gap-2 mb-2">
                        <div class="rounded-xl bg-white/60 border border-black/5 px-2 py-1.5">
                          <div class="text-[0.58rem] opacity-60">Obj. seen</div>
                          <div class="font-semibold text-[0.75rem]">${fr.events}</div>
                        </div>
                        <div class="rounded-xl bg-white/60 border border-black/5 px-2 py-1.5">
                          <div class="text-[0.58rem] opacity-60">On time</div>
                          <div class="font-semibold text-[0.75rem]">${onTimePct}%</div>
                        </div>
                        <div class="rounded-xl bg-white/60 border border-black/5 px-2 py-1.5">
                          <div class="text-[0.58rem] opacity-60">X-pressure</div>
                          <div class="font-semibold text-[0.75rem]">${crossPct}%</div>
                        </div>
                        <div class="rounded-xl bg-white/60 border border-black/5 px-2 py-1.5">
                          <div class="text-[0.58rem] opacity-60">Late</div>
                          <div class="font-semibold text-[0.75rem]">${latePct}%</div>
                        </div>
                      </div>

                      <p class="text-[0.6rem] leading-snug opacity-90">
                        ${grade.desc}
                        ${lowSample ? `<span class="ml-1 opacity-80">· low sample</span>` : ""}
                      </p>
                    </div>`;
                })
                .join("")
            : `<div class="text-[0.65rem] text-slate-500 px-1 py-2">No flex roles with ≥10% games in this window.</div>`;

        // ✅ v2.8 UI: no horizontal scroll; responsive grid + right column has TWO mini cards stacked
        lateSummaryHTML = `
          <div class="mt-6 pt-4 border-t border-slate-100">
            <div class="flex items-center justify-between gap-2 mb-1.5">
              <h3 class="text-[0.8rem] font-semibold text-slate-700">
                🕒 Objective Presence — Core vs Flex Roles
              </h3>
              <div class="inline-flex items-center gap-1 bg-slate-100 rounded-full px-1 py-0.5">
                <button
                  class="px-2 py-0.5 rounded-full text-[0.65rem] font-medium bg-slate-800 text-white"
                  data-role-view="core"
                >
                  Core Roles
                </button>
                <button
                  class="px-2 py-0.5 rounded-full text-[0.65rem] font-medium text-slate-600 hover:text-slate-800"
                  data-role-view="flex"
                >
                  Flex Roles
                </button>
              </div>
            </div>

            <p class="text-[0.65rem] text-slate-600 mb-3 max-w-3xl">
              Timeline-based: we mark players <span class="font-semibold">on time</span> when they’re grouped on the correct side
              at the minute your team secures an objective. If they’re on the opposite side, mostly alone, and clearly winning
              lane (gold/xp/level), they count as <span class="font-semibold">cross-pressure</span> instead of late.
              We now dedupe to <span class="font-semibold">one objective moment per match+minute</span> and infer
              <span class="font-semibold">our TeamId per match</span> (no hard-coded 200).
            </p>

            <div class="grid lg:grid-cols-[1fr_320px] gap-4 items-start">
              <div>
                <div data-role-panel="core">
                  <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-2">
                    ${coreCardsHTML}
                  </div>
                </div>

                <div data-role-panel="flex" class="hidden">
                  <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-2">
                    ${flexCardsHTML}
                  </div>
                </div>
              </div>

              <div class="space-y-2">
                <div class="rounded-2xl bg-slate-50 border border-slate-200 px-3 py-2 text-[0.65rem] text-slate-700">
                  <p class="mb-1">
                    <span class="font-semibold text-slate-800">Big picture:</span>
                    average on-time rate is about <span class="font-semibold">${avgPlayersOnTimePct}%</span>.
                  </p>
                  ${
                    best && worst
                      ? `
                    <p class="mb-1">
                      <span class="font-semibold text-slate-800">Most often late:</span>
                      <span class="text-rose-600 font-semibold">${worst.player}</span>
                      (${worstLatePct}% late across ${worst.events} objectives).
                    </p>
                    <p class="mb-0">
                      <span class="font-semibold text-slate-800">Most reliable show-up:</span>
                      <span class="text-emerald-700 font-semibold">${best.player}</span>
                      (${bestLatePct}% late across ${best.events} objectives).
                    </p>`
                      : `<p class="mb-0">Not enough objective moments yet to call out best/worst reliably.</p>`
                  }
                </div>

                <div class="rounded-2xl bg-white border border-slate-200 px-3 py-2 text-[0.65rem] text-slate-700">
                  <div class="font-semibold text-slate-800 mb-1">How the scoring works</div>
                  <p class="mb-1 text-[0.62rem] text-slate-600 leading-snug">
                    <span class="font-semibold">On time</span> = correct side + grouped (close teammates / grouped flag).
                    <br/>
                    <span class="font-semibold">X-pressure</span> = opposite side + mostly solo + clearly winning lane.
                    <br/>
                    <span class="font-semibold">Late</span> = everything else (including base).
                  </p>
                  <p class="mb-0 text-[0.6rem] text-slate-500">
                    Colors: <span class="font-semibold text-emerald-700">green</span> anchor,
                    <span class="font-semibold text-amber-700">amber</span> mixed,
                    <span class="font-semibold text-rose-700">red</span> needs sync.
                  </p>
                </div>
              </div>
            </div>
          </div>`;
      } else {
        lateSummaryHTML = `
          <div class="mt-4 pt-3 border-t border-slate-100 text-[0.65rem] text-slate-500">
            Timeline data is available but no clear team objective moments were detected for this window.
            Once you secure more Dragons / Heralds / Barons / Grubs / Atakhans, this section will populate.
          </div>`;
      }
    } else {
      lateSummaryHTML = `
        <div class="mt-4 pt-3 border-t border-slate-100 text-[0.65rem] text-slate-500">
          No timeline rows match the games in this window. Check that your timeline sheet uses the same
          <span class="font-mono">Match ID</span> values as the main stats sheet.
        </div>`;
    }
  } else {
    lateSummaryHTML = `
      <div class="mt-4 pt-3 border-t border-slate-100 text-[0.65rem] text-slate-500">
        Timeline sheet not provided — once wired in, this section will show objective presence + cross-pressure.
      </div>`;
  }

  // --- Trend buttons (aligned with Synergy & TPI) ---
  const trendButtons = `
    <div class="flex items-center gap-1 bg-sky-50 px-1 py-1 rounded-full shadow-inner">
      ${[
        { key: "5", label: "Last 5" },
        { key: "10", label: "Last 10" },
        { key: "split", label: "Current Split" },
        { key: "season", label: "Season" },
      ]
        .map(
          ({ key, label }) => `
        <button
          class="px-3 py-1 rounded-full text-[0.7rem] font-medium transition
          ${
            objectivesTrendWindow === key
              ? "bg-sky-500 text-white shadow-sm"
              : "bg-transparent text-sky-700 hover:bg-white hover:text-sky-600"
          }"
          data-objectives-window="${key}">
          ${label}
        </button>`
        )
        .join("")}
    </div>`;

  // --- Objective type buttons (Small vs Big) ---
  const objectiveTypeButtons = `
    <div class="flex items-center gap-1 bg-slate-50 px-1 py-1 rounded-full">
      ${[
        { key: "small", label: "Small Firsts" },
        { key: "big", label: "Big Objectives" },
      ]
        .map(
          ({ key, label }) => `
        <button
          class="px-3 py-1 rounded-full text-[0.65rem] font-medium transition
          ${
            objectivesObjectiveGroup === key
              ? "bg-slate-900 text-white shadow-sm"
              : "bg-transparent text-slate-700 hover:bg-white hover:text-slate-900"
          }"
          data-objectives-type="${key}">
          ${label}
        </button>`
        )
        .join("")}
    </div>`;

  // --- Build First-Hit cards (main stats) ---
  const makeTone = (delta) => {
    if (delta > 8) return { cls: "text-emerald-600", badge: "Most decisive" };
    if (delta > 4) return { cls: "text-sky-600", badge: "Strong lever" };
    if (delta >= 0) return { cls: "text-gray-700", badge: "Positive edge" };
    return { cls: "text-red-600", badge: "Risk if lost" };
  };

  const cardsHTML =
    impactsActive.length > 0
      ? impactsActive
          .map((o) => {
            const tone = makeTone(o.delta);
            const lowSample =
              o.weFirstGames + o.theyFirstGames < 6 ? " (low sample)" : "";
            const sampleNote =
              o.weFirstGames && o.theyFirstGames
                ? `${o.weFirstGames}× we-first, ${o.theyFirstGames}× enemy-first`
                : `${o.total} games with a clear first owner`;

            return `
          <div class="p-3 rounded-2xl bg-white border border-gray-100 shadow-[0_1px_4px_rgba(15,23,42,0.04)] flex flex-col justify-between text-[0.7rem]">
            <div>
              <div class="flex items-baseline justify-between mb-1">
                <div class="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  ${tone.badge}
                </div>
                <div class="text-[0.6rem] text-gray-400">${sampleNote}</div>
              </div>
              <div class="text-sm font-semibold text-gray-900 mb-2">
                ${o.label}
              </div>

              <div class="grid grid-cols-2 gap-2">
                <div class="rounded-xl bg-emerald-50/80 border border-emerald-100 px-2 py-1.5">
                  <div class="font-semibold text-emerald-700 text-[0.7rem] mb-0.5">We got it first</div>
                  <div class="text-gray-800">
                    WR ${o.wrWeFirst.toFixed(1)}%
                    <span class="text-gray-500">(${o.weFirstGames} g)</span>
                  </div>
                  <div class="text-[0.6rem] text-gray-500">
                    Loss rate ${(100 - o.wrWeFirst).toFixed(1)}%
                  </div>
                </div>
                <div class="rounded-xl bg-rose-50/80 border border-rose-100 px-2 py-1.5">
                  <div class="font-semibold text-rose-700 text-[0.7rem] mb-0.5">They got it first</div>
                  <div class="text-gray-800">
                    Our WR ${o.wrTheyFirst.toFixed(1)}%
                    <span class="text-gray-500">(${o.theyFirstGames} g)</span>
                  </div>
                  <div class="text-[0.6rem] text-gray-500">
                    Loss rate ${(100 - o.wrTheyFirst).toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>

            <div class="mt-2">
              <span class="${tone.cls} text-[0.85rem] font-semibold">
                ${o.delta >= 0 ? "+" : ""}${o.delta.toFixed(1)}pp
              </span>
              <span class="text-[0.6rem] text-gray-500 ml-1">
                WR diff (we-first vs enemy-first)${lowSample}
              </span>
            </div>
          </div>`;
          })
          .join("")
      : `
        <div class="p-4 rounded-2xl bg-gray-50 border border-dashed border-gray-200 text-[0.7rem] text-gray-500">
          Not enough First Blood / First Dragon / Atakhan / Void Grub events in this window
          to build a reliable objective profile.
        </div>`;

  const summaryText =
    impactsActive.length > 0
      ? (() => {
          const sorted = [...impactsActive].sort((a, b) => (b.delta || 0) - (a.delta || 0));
          const top = sorted[0];
          const worst = sorted[sorted.length - 1];

          const topName = top ? top.label.replace(/^.+?\s/, "") : null;
          const worstName = worst ? worst.label.replace(/^.+?\s/, "") : null;

          return `
            <p class="text-[0.65rem] text-gray-600">
              In this window/tab, <span class="font-semibold">${topName || "—"}</span> is your strongest leverage first objective,
              while <span class="font-semibold">${worstName || "—"}</span> punishes hardest when lost.
            </p>`;
        })()
      : `<p class="text-[0.65rem] text-gray-500">Once more games are played, this card will show which first objectives actually move your winrate.</p>`;

  // --- Objective context mini-cards (risk / grouping / vision) ---
  let contextCardsHTML = "";
  if (objectiveContext && objectiveContext.events > 0) {
    const oc = objectiveContext;

    const riskLabel =
      oc.avgGoldDiff > 500
        ? "You usually fight from ahead."
        : oc.avgGoldDiff < -500
        ? "You flip a lot from behind."
        : "Many objectives are taken close to even.";

    const groupedLabel =
      oc.avgTeamGrouped >= 4
        ? "You group well before objectives."
        : oc.avgTeamGrouped <= 3
        ? "Often starting with only 2–3 grouped."
        : "Medium grouping discipline.";

    const visionLabel =
      oc.avgTeamWardsPlaced > oc.avgEnemyWardsPlaced &&
      oc.avgTeamWardsKilled >= oc.avgEnemyWardsKilled
        ? "You often have vision advantage."
        : oc.avgTeamWardsPlaced < oc.avgEnemyWardsPlaced
        ? "Enemy usually out-wards you."
        : "Vision battle is roughly even.";

    contextCardsHTML = `
      <div class="mt-4 grid md:grid-cols-3 gap-3">
        <div class="rounded-2xl border border-amber-100 bg-amber-50/60 px-3 py-2 text-[0.65rem] text-slate-800">
          <div class="flex items-center justify-between mb-1">
            <span class="font-semibold text-amber-800">Risk Profile at Objectives</span>
            <span class="text-[0.6rem] text-amber-700">Sample: ${oc.events}</span>
          </div>
          <p class="mb-0.5">Avg Gold Diff at take: <span class="font-semibold">${oc.avgGoldDiff.toFixed(0)}</span></p>
          <p class="mb-0.5">Avg XP Diff at take: <span class="font-semibold">${oc.avgXpDiff.toFixed(0)}</span></p>
          <p class="text-[0.62rem] text-amber-900 mt-1">${riskLabel}</p>
        </div>

        <div class="rounded-2xl border border-indigo-100 bg-indigo-50/60 px-3 py-2 text-[0.65rem] text-slate-800">
          <div class="flex items-center justify-between mb-1">
            <span class="font-semibold text-indigo-800">Grouping Discipline</span>
            <span class="text-[0.6rem] text-indigo-700">Team vs Enemy</span>
          </div>
          <p class="mb-0.5">Avg grouped (you): <span class="font-semibold">${oc.avgTeamGrouped.toFixed(1)}</span></p>
          <p class="mb-0.5">Avg grouped (enemy): <span class="font-semibold">${oc.avgEnemyGrouped.toFixed(1)}</span></p>
          <p class="text-[0.62rem] text-indigo-900 mt-1">${groupedLabel}</p>
        </div>

        <div class="rounded-2xl border border-emerald-100 bg-emerald-50/60 px-3 py-2 text-[0.65rem] text-slate-800">
          <div class="flex items-center justify-between mb-1">
            <span class="font-semibold text-emerald-800">Vision Around Objectives</span>
            <span class="text-[0.6rem] text-emerald-700">Per take</span>
          </div>
          <p class="mb-0.5">
            Your wards: <span class="font-semibold">${oc.avgTeamWardsPlaced.toFixed(1)}</span>
            · Enemy: <span class="font-semibold">${oc.avgEnemyWardsPlaced.toFixed(1)}</span>
          </p>
          <p class="mb-0.5">
            Your clears: <span class="font-semibold">${oc.avgTeamWardsKilled.toFixed(1)}</span>
            · Enemy: <span class="font-semibold">${oc.avgEnemyWardsKilled.toFixed(1)}</span>
          </p>
          <p class="text-[0.62rem] text-emerald-900 mt-1">${visionLabel}</p>
        </div>
      </div>`;
  }

  const howToReadBoxHTML = `
    <div class="mt-3">
      <details class="group rounded-2xl border border-slate-100 bg-slate-50/60 px-3 py-2 text-[0.6rem] text-gray-600">
        <summary class="flex items-center justify-between cursor-pointer">
          <div class="flex items-center gap-2">
            <span class="inline-flex items-center justify-center w-5 h-5 rounded-full border border-slate-300 text-[0.65rem] text-slate-600 group-open:bg-slate-800 group-open:text-white">?</span>
            <span class="font-semibold text-slate-700">How to read this card</span>
          </div>
          <span class="text-[0.6rem] text-slate-400 group-open:hidden">Show details</span>
          <span class="text-[0.6rem] text-slate-400 hidden group-open:inline">Hide details</span>
        </summary>
        <div class="mt-2 leading-snug space-y-1">
          <p><strong>Impact cards:</strong> winrate when you secure that objective first vs when the enemy does.</p>
          <p><strong>Drake row:</strong> breaks out our 1st–4th drake separately (state + vision + attendance).</p>
          <p><strong>Elder/Baron play:</strong> checks if buffs convert into a 3-minute gold diff swing.</p>
          <p><strong>Presence:</strong> on-time vs cross-pressure vs late at the minute we secure objectives.</p>
        </div>
      </details>
    </div>`;

  // --- Render card ---
  container.innerHTML = `
    <section class="section-wrapper fade-in mb-10">
      <div class="dashboard-card bg-white shadow-sm rounded-2xl border border-gray-100">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-1">
          <div>
            <h2 class="text-[1.1rem] font-semibold text-sky-500 tracking-tight">
              Objectives — First Hit Impact & Plays
            </h2>
            <p class="text-[0.7rem] text-gray-600 max-w-xl">
              Winrate impact for “first” objectives, plus timeline-based presence, drake order, and buff conversion.
            </p>
            <p class="text-[0.6rem] text-gray-500">
              Window:
              <span class="font-semibold">
                ${
                  objectivesTrendWindow === "season"
                    ? currentSeason ? `Season ${currentSeason}` : "Season"
                    : objectivesTrendWindow === "split"
                    ? currentSplit != null ? `Current Split (${currentSplit})` : "Current Split"
                    : "Last " + objectivesTrendWindow + " games"
                }
              </span>
              · Games: <span class="font-semibold text-gray-800">${totalGames}</span>
              · Objective games (tab): <span class="font-semibold text-gray-800">${totalObjectivesGamesActive}</span>
              · Objective games (all): <span class="font-semibold text-gray-800">${totalObjectivesGames}</span>
            </p>
          </div>
          <div class="flex flex-col items-end gap-2">
            ${trendButtons}
            ${objectiveTypeButtons}
          </div>
        </div>

        <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
          ${cardsHTML}
        </div>

        <div class="mt-3">${summaryText}</div>

        ${howToReadBoxHTML}
        ${contextCardsHTML}
        ${drakeSectionHTML}
        ${elderBaronSectionHTML}
        ${lateSummaryHTML}
      </div>
    </section>
  `;

  // --- Bind window buttons ---
  container.querySelectorAll("[data-objectives-window]").forEach((btn) => {
    btn.addEventListener("click", () => {
      objectivesTrendWindow = btn.getAttribute("data-objectives-window");
      renderObjectives(statsData, timelineData);
    });
  });

  // --- Bind objective type tabs ---
  container.querySelectorAll("[data-objectives-type]").forEach((btn) => {
    btn.addEventListener("click", () => {
      objectivesObjectiveGroup = btn.getAttribute("data-objectives-type");
      renderObjectives(statsData, timelineData);
    });
  });

  // --- Bind role view tabs (core vs flex) ---
  const roleButtons = container.querySelectorAll("[data-role-view]");
  if (roleButtons && roleButtons.length) {
    roleButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const view = btn.getAttribute("data-role-view");
        roleButtons.forEach((b) => {
          if (b === btn) {
            b.classList.add("bg-slate-800", "text-white");
            b.classList.remove("text-slate-600");
          } else {
            b.classList.remove("bg-slate-800", "text-white");
            b.classList.add("text-slate-600");
          }
        });

        container.querySelectorAll("[data-role-panel]").forEach((panel) => {
          const panelView = panel.getAttribute("data-role-panel");
          if (panelView === view) panel.classList.remove("hidden");
          else panel.classList.add("hidden");
        });
      });
    });
  }

  console.log("🎯 Objectives First-Hit Impact v2.8", {
    window: objectivesTrendWindow,
    currentSeason,
    currentSplit,
    totalGames,
    firstOnlyImpacts,
    activeGroup: objectivesObjectiveGroup,
    objectiveAttendance,
    objectiveContext,
  });
}

// =========================
// 
// 
// Lane Dynamics & Playmakers v2.1
//
// 
// =========================

let lanePhase = "early"; // "early" | "mid" | "late"
let laneWindow = "season"; // "5" | "10" | "split" | "season"

// ---------- Helpers ----------

function normLaneRoleLD(r) {
  const raw = String(r["Role"] || r["ROLE"] || "").toUpperCase();
  if (!raw) return "";
  if (raw.includes("TOP")) return "TOP";
  if (raw.includes("JUNG")) return "JUNGLE";
  if (raw.includes("MID")) return "MIDDLE";
  if (raw.includes("BOT") || raw.includes("BOTTOM") || raw.includes("ADC"))
    return "BOTTOM";
  if (raw.includes("SUP") || raw.includes("UTIL")) return "SUPPORT";
  return raw;
}

// Cheap "home lane" for roam detection
function laneHomeZoneLD(role, teamId) {
  if (role === "TOP") return teamId === 100 ? "Top Lane" : "Bot Lane";
  if (role === "BOTTOM") return teamId === 100 ? "Bot Lane" : "Top Lane";
  if (role === "MIDDLE") return "Mid Lane";
  if (role === "SUPPORT") return "Bot Lane";
  if (role === "JUNGLE") return "Jungle";
  return "";
}

function numLD(v) {
  if (v === null || v === undefined || v === "") return 0;
  const n = parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function boolLD(v) {
  const s = String(v || "").trim().toUpperCase();
  return s === "1" || s === "TRUE" || s === "YES";
}

function getGameIdLD(r) {
  return (
    r["Match ID"] ||
    r["Game #"] ||
    r["Game ID"] ||
    r["MatchID"] ||
    r["Date"] ||
    ""
  );
}

// --- Compute match sets for Last5/10/Split/Season based on season rows ---
function buildLaneWindowGameSets(seasonRows) {
  const res = { "5": null, "10": null, split: null, season: null };
  if (!seasonRows || !seasonRows.length) return res;

  const all = seasonRows.map((r) => getGameIdLD(r)).filter(Boolean);
  const unique = [...new Set(all)];
  if (!unique.length) return res;

  // assume seasonRows already chronological
  res["5"] = new Set(unique.slice(-5));
  res["10"] = new Set(unique.slice(-10));

  // current split = max Split for that season
  const splits = seasonRows
    .map((r) => parseInt(String(r["Split"] || "").trim(), 10))
    .filter((n) => Number.isFinite(n));
  if (splits.length) {
    const currentSplit = Math.max(...splits);
    const splitGames = seasonRows
      .filter(
        (r) => parseInt(String(r["Split"] || "").trim(), 10) === currentSplit
      )
      .map((r) => getGameIdLD(r))
      .filter(Boolean);
    res.split = new Set([...new Set(splitGames)]);
  }

  // Season = all known games
  res.season = new Set(unique);
  return res;
}

// --- Phase helper: dynamic early/mid/late per match ---
function buildMatchLengthsLD(rows) {
  const len = {};
  rows.forEach((r) => {
    const id = getGameIdLD(r);
    if (!id) return;
    const m = numLD(r["Minute"]);
    if (!len[id] || m > len[id]) len[id] = m;
  });
  return len;
}

function getPhaseForMinute(matchId, minute, matchLengths) {
  const total = matchLengths[matchId] || 30;
  if (minute < 3) return null;

  // dynamic boundaries
  const earlyEnd = Math.max(8, Math.min(14, Math.round(total * 0.25)));
  const midEnd = Math.max(earlyEnd + 5, Math.round(total * 0.6));

  if (minute <= earlyEnd) return "early";
  if (minute <= midEnd) return "mid";
  return "late";
}

// ---------- Profile & Investment tag helpers ----------

// Tooltip for classical performance tags
function getProfileTooltipLD(tag) {
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
      return "Very small sample in this window; interpret trends cautiously.";
    case "Stable":
      return "Solid, unspectacular lane outcomes; rarely a liability.";
    case "Lane Rock Duo":
      return "Botlane duo with strong, repeatable lane control and reliability.";
    case "Playmaker Duo":
      return "Botlane duo that frequently creates plays and roams effectively.";
    case "Pressure Sink Duo":
      return "Botlane duo that struggles even with attention; monitor drafts.";
    case "Stable Duo":
      return "Botlane duo with generally steady, average outcomes.";
    default:
      return "";
  }
}

// Decide lane investment tag (for jungler/coach) from existing metrics
function getInvestmentTagLD(p) {
  const lc = p.laneControl;
  const rel = p.reliability;
  const self = p.selfLead || 0;
  const help = p.helpedLead || 0;
  const sink = p.pressureSink || 0;

  // Don't bother if we have no lead split info
  const hasLeadSignal = self + help > 0;

  // Late game: only call out very clear extremes to avoid ARAM noise
  if (lanePhase === "late") {
    if (help >= 35 && (lc <= 0 || rel <= 50 || sink >= 10)) {
      return "Resource Trap";
    }
    if (self >= 85 && rel >= 65 && lc >= 0 && sink < 8) {
      return "Island Safe";
    }
    return "";
  }

  // Early/Mid rules (ordered by strength / clarity)

  // 1) Resource Trap: we invest but it doesn't pay
  if (help >= 35 && (lc <= 0 || rel <= 50 || sink >= 10)) {
    return "Resource Trap";
  }

  // 2) Invest Pays Off: high helped share, good results
  if (hasLeadSignal && help >= 40 && lc >= 5 && rel >= 55) {
    return "Invest Pays Off";
  }

  // 3) Island Safe: hard self-sufficient, good outcomes
  if (self >= 80 && rel >= 60 && lc >= 0 && sink < 8) {
    return "Island Safe";
  }

  // 4) Low-Maintenance: generally fine with light touch
  if (self >= 65 && rel >= 55 && lc > -3 && sink < 10) {
    return "Low-Maintenance";
  }

  // 5) Setup Lane: balanced self+help, good if we coordinate
  if (
    self >= 50 &&
    self <= 80 &&
    help >= 20 &&
    help <= 40 &&
    lc >= 0 &&
    rel >= 55
  ) {
    return "Setup Lane";
  }

  // 6) Volatile Duelist: big island player, but coinflippy
  if (self >= 80 && rel < 55) {
    return "Volatile Duelist";
  }

  // 7) Needs Cover: struggles alone; stabilizes with help
  if (
    self >= 40 &&
    self <= 65 &&
    rel < 55 &&
    help >= 20 &&
    lc > -8
  ) {
    return "Needs Cover";
  }

  return "";
}

// Tooltip for investment tags
function getInvestmentTooltipLD(tag) {
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

// ---------- MAIN API (called from renderAllSections) ----------

function renderLaneDynamics(seasonRows, timelineRows) {
  const allTimeline =
    (timelineRows && timelineRows.length)
      ? timelineRows
      : (typeof cachedTimelineRows !== "undefined"
          ? cachedTimelineRows
          : null);

  if (!allTimeline || !allTimeline.length) return;

  const baseSeason =
    (seasonRows && seasonRows.length)
      ? seasonRows
      : (typeof cachedRows !== "undefined" ? cachedRows : []);

  const windows = buildLaneWindowGameSets(baseSeason);
  const activeSet = windows[laneWindow];

  // All timeline rows inside active window (all phases; phase applied later)
  const timelineInWindow =
    activeSet && activeSet.size
      ? allTimeline.filter((r) => activeSet.has(getGameIdLD(r)))
      : allTimeline;

  if (!timelineInWindow.length) {
    renderLaneDynamicsCard([], {}, {});
    return;
  }

  // Window-wide role minutes & games (for major roles, flex, guests, jungle share)
  const roleMinutesByPlayer = {};
  const gamesByPlayer = {};

  timelineInWindow.forEach((r) => {
    const player = String(r["Player"] || "").trim();
    if (!player) return;
    const role = normLaneRoleLD(r) || "UNKNOWN";
    if (!role) return;

    const gameId = getGameIdLD(r);
    if (!gamesByPlayer[player]) gamesByPlayer[player] = new Set();
    if (gameId) gamesByPlayer[player].add(gameId);

    if (!roleMinutesByPlayer[player]) {
      roleMinutesByPlayer[player] = { total: 0, byRole: {} };
    }
    const rm = roleMinutesByPlayer[player];
    rm.total += 1;
    rm.byRole[role] = (rm.byRole[role] || 0) + 1;
  });

  renderLaneDynamicsCard(timelineInWindow, roleMinutesByPlayer, gamesByPlayer);
}

// ---------- Card (phase-specific metrics built here) ----------

function renderLaneDynamicsCard(windowTimelineRows, roleMinutesByPlayer, gamesByPlayer) {
  const container = document.getElementById("lane-dynamics");
  if (!container) return;

  if (!windowTimelineRows || !windowTimelineRows.length) {
    container.innerHTML = `
      <section class="section-wrapper fade-in mb-8">
        <div class="dashboard-card">
          <h2 class="text-[1.05rem] font-semibold text-sky-500 mb-1">Lane Dynamics & Playmakers</h2>
          <p class="text-sm text-gray-500">No timeline data in scope for this window/phase.</p>
        </div>
      </section>`;
    return;
  }

  const allGameIds = new Set(
    windowTimelineRows.map((r) => getGameIdLD(r)).filter(Boolean)
  );
  const totalTimelineGames = allGameIds.size || 1;

  const matchLengths = buildMatchLengthsLD(windowTimelineRows);

  const perPlayerRole = {}; // key: player|role
  const perFrame = {}; // for BOT+SUP duos
  const duoStats = {};
  const jungleStats = {};
  const objectiveEvents = {};
  const objTrack = {};

  // ---------- PASS 1: objectives, phase-filtered stats, duo frames, jungle ----------
  windowTimelineRows.forEach((r) => {
    const player = String(r["Player"] || "").trim();
    const matchId = getGameIdLD(r);
    if (!player || !matchId) return;

    const minute = numLD(r["Minute"]);
    const role = normLaneRoleLD(r) || "UNKNOWN";
    const teamId = numLD(r["TeamId"]);

    // --- objective tracking (all minutes) ---
    const objKey = `${matchId}|${teamId}`;
    const prev = objTrack[objKey] || {
      drag: 0,
      herald: 0,
      baron: 0,
      grubs: 0,
      atak: 0,
      towers: 0,
      inhibs: 0,
    };
    const cur = {
      drag: numLD(r["Team Dragons"]),
      herald: numLD(r["Team Heralds"]),
      baron: numLD(r["Team Barons"]),
      grubs: numLD(r["Team Voidgrubs"]),
      atak: numLD(r["Team Atakhans"]),
      towers: numLD(r["Team Towers"]),
      inhibs: numLD(r["Team Inhibitors"]),
    };
    const gotObj =
      cur.drag > prev.drag ||
      cur.herald > prev.herald ||
      cur.baron > prev.baron ||
      cur.grubs > prev.grubs ||
      cur.atak > prev.atak ||
      cur.towers > prev.towers ||
      cur.inhibs > prev.inhibs;

    if (gotObj) {
      objectiveEvents[`${matchId}|${teamId}|${minute}`] = true;
    }
    objTrack[objKey] = cur;

    // --- apply phase gating for lane/map behaviour ---
    const phase = getPhaseForMinute(matchId, minute, matchLengths);
    if (!phase || phase !== lanePhase) return;

    const laneZone = laneHomeZoneLD(role, teamId);
    const zone = String(r["Zone"] || "").trim();

    const goldDiff = numLD(r["Gold Diff vs Opp"]);
    const xpDiff = numLD(r["XP Diff vs Opp"]);
    const csDiff = numLD(r["CS Diff vs Opp"]);
    const closeTeammates = numLD(r["Close Teammates"]);
    const isGrouped = boolLD(r["Is Grouped"]);
    const inRiver = boolLD(r["In River"]);

    // --- per-player-per-role metrics ---
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

    // lane control snapshot (clamped)
    const g = Math.max(-800, Math.min(800, goldDiff));
    const x = Math.max(-2, Math.min(2, xpDiff));
    const c = Math.max(-25, Math.min(25, csDiff));
    const control = (g / 800 + x / 2 + c / 25) / 3;
    pr.laneControlSum += control;

    const combinedBehind =
      goldDiff <= -300 || xpDiff <= -1 || csDiff <= -15;
    const combinedAhead =
      goldDiff >= 150 || xpDiff >= 0.5 || csDiff >= 8;

    // Reliability: minutes not significantly behind
    if (!combinedBehind) pr.goodMinutes += 1;
    if (combinedBehind) pr.hardLosingMinutes += 1;

    // Self vs helped lead
    if (combinedAhead) {
      if (closeTeammates <= 1) pr.selfLeadMinutes += 1;
      else if (closeTeammates >= 2) pr.helpLeadMinutes += 1;
    }

    // --- Smarter, phase-aware Pressure Sink ---
    const teamGoldDiff = numLD(r["Gold Diff (Team)"]);
    const teamAheadFlag = boolLD(r["Team Gold Ahead"]);
    const teamNotHardLosing = teamAheadFlag || teamGoldDiff >= -800;

    let pressureSinkMinute = false;

    if (combinedBehind && closeTeammates >= 2 && teamNotHardLosing) {
      if (phase === "early") {
        pressureSinkMinute = true;
      } else if (phase === "mid") {
        pressureSinkMinute =
          (goldDiff <= -400 || xpDiff <= -1.5 || csDiff <= -20) &&
          closeTeammates >= 2;
      } else {
        // late: only extreme cases, and heavily protected
        pressureSinkMinute =
          (goldDiff <= -600 || xpDiff <= -2) && closeTeammates >= 3;
      }
    }

    if (pressureSinkMinute) {
      pr.sinkMinutes += 1;
    }

    // --- Playmaker: out of lane & grouped/river while not inting ---
    const outOfLane =
      laneZone &&
      zone &&
      laneZone !== zone &&
      (inRiver || isGrouped || closeTeammates >= 2);

    if (outOfLane && !combinedBehind) {
      pr.roamPlayMinutes += 1;
    }

    // --- frames for botlane duos (phase-specific) ---
    const frameKey = `${matchId}|${teamId}|${minute}`;
    if (!perFrame[frameKey]) perFrame[frameKey] = [];
    perFrame[frameKey].push({
      player,
      role,
      goldDiff,
      xpDiff,
      csDiff,
      laneZone,
      zone,
      closeTeammates,
      isGrouped,
      inRiver,
      matchId,
    });

    // --- jungle behaviour (role & phase aware) ---
    if (role === "JUNGLE") {
      if (!jungleStats[player]) {
        jungleStats[player] = {
          player,
          minutes: 0,
          objPresenceMinutes: 0,
          leadObjMinutes: 0,
          gankMinutes: 0,
          farmMinutes: 0,
          games: new Set(),
        };
      }
      const jg = jungleStats[player];
      jg.minutes += 1;
      jg.games.add(matchId);

      const evKey = `${matchId}|${teamId}|${minute}`;
      if (objectiveEvents[evKey]) {
        jg.objPresenceMinutes += 1;

        const teamAheadNow =
          boolLD(r["Team Gold Ahead"]) || numLD(r["Gold Diff (Team)"]) > 0;
        const jgAheadNow = goldDiff > 0 || xpDiff > 0;
        if (teamAheadNow || jgAheadNow) {
          jg.leadObjMinutes += 1;
        }
      }

      const isFarm =
        (zone === "Jungle" || (!zone && laneZone === "Jungle")) &&
        !inRiver &&
        closeTeammates <= 1;
      const isGank =
        !isFarm && (inRiver || closeTeammates >= 1 || zone !== "Jungle");

      if (isFarm) jg.farmMinutes += 1;
      if (isGank) jg.gankMinutes += 1;
    }
  });

  const playerRoleEntries = Object.values(perPlayerRole);
  if (!playerRoleEntries.length) {
    container.innerHTML = `
      <section class="section-wrapper fade-in mb-8">
        <div class="dashboard-card">
          <h2 class="text-[1.05rem] font-semibold text-sky-500 mb-1">Lane Dynamics & Playmakers</h2>
          <p class="text-sm text-gray-500">No timeline data in scope for this window/phase.</p>
        </div>
      </section>`;
    return;
  }

  // ---------- Botlane Duos (BOTTOM + SUPPORT) ----------
  Object.values(perFrame).forEach((frames) => {
    const bot = frames.find((f) => f.role === "BOTTOM");
    const sup = frames.find((f) => f.role === "SUPPORT");
    if (!bot || !sup) return;

    const [p1, p2] = [bot.player, sup.player].sort();
    const key = `${p1} & ${p2}`;

    if (!duoStats[key]) {
      duoStats[key] = {
        name: key,
        p1,
        p2,
        minutes: 0,
        laneControlSum: 0,
        goodMinutes: 0,
        hardLosingMinutes: 0,
        playMinutes: 0,
        sinkMinutes: 0,
        games: new Set(),
      };
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

    const combinedBehind =
      avgGold <= -300 || avgXp <= -1 || avgCs <= -15;
    const combinedAhead =
      avgGold >= 150 || avgXp >= 0.5 || avgCs >= 8;

    if (!combinedBehind) d.goodMinutes += 1;
    if (combinedBehind) d.hardLosingMinutes += 1;

    const outOfLane =
      (bot.laneZone && bot.zone && bot.laneZone !== bot.zone) ||
      (sup.laneZone && sup.zone && sup.laneZone !== sup.zone);

    if (outOfLane && !combinedBehind) d.playMinutes += 1;

    if (
      combinedBehind &&
      (bot.closeTeammates >= 2 || sup.closeTeammates >= 2)
    ) {
      d.sinkMinutes += 1;
    }
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

      return {
        name: d.name,
        games,
        laneControl,
        reliability,
        selfLead: null,
        helpedLead: null,
        pressureSink,
        playmaker,
        tag,
        mainRole: "BOTTOM+SUPPORT",
        roleMix: `${d.p1} + ${d.p2}`,
        isFlex: false,
        isGuest: false,
        isDuo: true,
      };
    });

  // ---------- Per-role player rows ----------
  const tableRows = [];

  playerRoleEntries.forEach((pr) => {
    const rm = roleMinutesByPlayer && roleMinutesByPlayer[pr.name];
    if (!rm || rm.total === 0) return;

    const roleMinutes = rm.byRole[pr.role] || 0;
    const roleShare = (roleMinutes / rm.total) * 100;

    // Only show roles with meaningful share in this window
    if (roleShare < 10) return;

    const mins = Math.max(1, pr.minutes || 0);
    if (mins < 5) return; // avoid ultra tiny phase samples

    const gamesInRole = pr.games.size || 1;

    const laneControl = (pr.laneControlSum / mins) * 100;
    const reliability = (pr.goodMinutes / mins) * 100;

    const leadDen = pr.selfLeadMinutes + pr.helpLeadMinutes;
    const selfLead = leadDen > 0 ? (pr.selfLeadMinutes / leadDen) * 100 : 0;
    const helpedLead = leadDen > 0 ? (pr.helpLeadMinutes / leadDen) * 100 : 0;

    const pressureSink = (pr.sinkMinutes / mins) * 100;
    const playmaker = (pr.roamPlayMinutes / mins) * 100;

    const gp = gamesByPlayer && gamesByPlayer[pr.name];
    const gamesInWindow = gp ? gp.size || 1 : gamesInRole;
    const isGuest = gamesInWindow / totalTimelineGames < 0.1;

    // Flex = ≥10% minutes in ≥2 roles (window-wide)
    const flexRoles = Object.entries(rm.byRole)
      .filter(([, c]) => (c / rm.total) * 100 >= 10)
      .map(([r]) => r);
    const isFlex = flexRoles.length >= 2;

    const roleMix = Object.entries(rm.byRole)
      .map(([r, c]) => `${r} ${Math.round((c / rm.total) * 100)}%`)
      .join(" / ");

    // Performance profile (unchanged math)
    let tag = "Stable";
    if (laneControl >= 15 && selfLead >= 55 && reliability >= 70) tag = "Lane Rock";
    else if (laneControl >= 10 && helpedLead >= 45) tag = "Resource Carry";
    else if (playmaker >= 10 && reliability >= 55) tag = "Playmaker";
    else if (pressureSink >= 12) tag = "Pressure Sink";
    else if (playmaker >= 12 && laneControl <= 0) tag = "High-Risk Roamer";

    if (isGuest) tag = "Guest (Small Sample)";

    // Investment tag for jungler/coach
    const investmentTag = getInvestmentTagLD({
      laneControl,
      reliability,
      selfLead,
      helpedLead,
      pressureSink,
      playmaker,
    });

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

  // Hide pure 1-game guests
  const withPlayerMetrics = tableRows.filter(
    (p) => !(p.isGuest && p.games <= 1)
  );

  // ---------- Sort ----------
  withPlayerMetrics.sort((a, b) => {
    if (a.isGuest !== b.isGuest) return a.isGuest ? 1 : -1;
    if (a.games !== b.games) return b.games - a.games;
    return b.laneControl - a.laneControl;
  });

  duoRows.sort((a, b) => b.laneControl - a.laneControl);

  const timelineGamesInScope = totalTimelineGames;

  // ---------- Highlights ----------

  const topPlaymaker = [...withPlayerMetrics]
    .filter((p) => !p.isGuest && p.games >= 5)
    .sort((a, b) => b.playmaker - a.playmaker)[0];

  const bestDuo = duoRows[0] || null;

  // Build flex candidates per player (not per row)
  const flexPlayersMap = {};
  withPlayerMetrics.forEach((row) => {
    if (!row.isFlex || row.isGuest || row.games < 5) return;
    const name = row.name;
    if (!flexPlayersMap[name]) {
      flexPlayersMap[name] = { name, rows: [] };
    }
    flexPlayersMap[name].rows.push(row);
  });

  // Convert to summary objects: primary + best secondary role
  const flexCandidatesList = Object.values(flexPlayersMap)
    .map((fp) => {
      const rm = roleMinutesByPlayer[fp.name];
      if (!rm) return null;

      const roles = Object.entries(rm.byRole)
        .map(([role, mins]) => ({
          role,
          share: (mins / rm.total) * 100,
        }))
        .sort((a, b) => b.share - a.share);

      if (roles.length < 2) return null;

      const primary = roles[0];
      const secondary = roles[1];
      if (secondary.share < 10) return null;

      const secondaryRow = fp.rows.find(
        (r) => r.displayRole === secondary.role
      );
      if (!secondaryRow) return null;

      return {
        name: fp.name,
        primaryRole: primary.role,
        secondaryRole: secondary.role,
        secondaryShare: secondary.share,
        laneControl: secondaryRow.laneControl,
        reliability: secondaryRow.reliability,
        games: secondaryRow.games,
      };
    })
    .filter(Boolean)
    .sort(
      (a, b) =>
        b.games - a.games ||
        b.laneControl - a.laneControl
    )
    .slice(0, 3);

  // ---------- Jungle profiles ----------
  const jungleProfiles = Object.values(jungleStats)
    .map((j) => {
      const mins = Math.max(1, j.minutes || 0);
      const games = j.games ? j.games.size || 0 : 0;

      const rm = roleMinutesByPlayer && roleMinutesByPlayer[j.player];
      const jungleMinutes =
        rm && rm.byRole && rm.byRole["JUNGLE"] ? rm.byRole["JUNGLE"] : mins;
      const jungleShare =
        rm && rm.total > 0 ? (jungleMinutes / rm.total) * 100 : 0;

      // Only legit junglers / serious off-role junglers
      if (jungleShare < 10 || mins < 10 || games < 3) return null;

      const objPresence = (j.objPresenceMinutes / mins) * 100;
      const leadObj =
        j.objPresenceMinutes > 0
          ? (j.leadObjMinutes / j.objPresenceMinutes) * 100
          : 0;
      const gankShare = (j.gankMinutes / mins) * 100;
      const farmShare = (j.farmMinutes / mins) * 100;

      let style = "Balanced";
      if (farmShare >= 60 && gankShare <= 40) style = "Farm Heavy";
      else if (gankShare >= 45 && gankShare > farmShare) style = "Gank Heavy";
      else if (objPresence >= 30 && leadObj >= 60) style = "Objective Engine";

      return {
        player: j.player,
        mins,
        games,
        objPresence,
        leadObj,
        gankShare,
        farmShare,
        style,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.games !== b.games) return b.games - a.games;
      return b.objPresence - a.objPresence;
    });

  // ---------- UI controls (phase + window) ----------

  const phaseButtons = `
    <div class="inline-flex gap-1 bg-sky-50 px-1 py-1 rounded-full">
      ${[
        ["early", "Early"],
        ["mid", "Mid"],
        ["late", "Late"],
      ]
        .map(
          ([key, label]) => `
        <button
          class="px-3 py-1 rounded-full text-[0.7rem] font-medium transition
          ${
            lanePhase === key
              ? "bg-sky-500 text-white shadow-sm"
              : "bg-transparent text-sky-700 hover:bg-white hover:text-sky-600"
          }"
          data-lane-phase="${key}">
          ${label}
        </button>`
        )
        .join("")}
    </div>`;

  const windowButtons = `
    <div class="flex gap-1 text-[0.7rem] font-medium">
      ${[
        ["5", "Last 5"],
        ["10", "Last 10"],
        ["split", "Current Split"],
        ["season", "Season"],
      ]
        .map(
          ([key, label]) => `
        <button
          class="px-2.5 py-1 rounded-md border transition
          ${
            laneWindow === key
              ? "bg-orange-500 text-white border-orange-500"
              : "bg-white text-gray-700 border-gray-200 hover:border-orange-300 hover:text-orange-500"
          }"
          data-lane-window="${key}">
          ${label}
        </button>`
        )
        .join("")}
    </div>`;

  // ---------- Table rows HTML ----------

  const playerRowsHTML = withPlayerMetrics
    .map((p) => {
      const lcColor =
        p.laneControl >= 15
          ? "text-emerald-600"
          : p.laneControl >= 5
          ? "text-sky-600"
          : p.laneControl <= -10
          ? "text-red-500"
          : "text-gray-700";

      const relColor =
        p.reliability >= 75
          ? "text-emerald-600"
          : p.reliability <= 55
          ? "text-red-500"
          : "text-gray-700";

      const playColor =
        p.playmaker >= 14
          ? "text-emerald-600"
          : p.playmaker >= 8
          ? "text-sky-600"
          : "text-gray-500";

      const sinkColor =
        p.pressureSink >= 12 ? "text-red-500" : "text-gray-500";

      const tagTone =
        p.tag.startsWith("Lane Rock")
          ? "bg-emerald-50 text-emerald-700 border-emerald-100"
          : p.tag.startsWith("Playmaker")
          ? "bg-sky-50 text-sky-700 border-sky-100"
          : p.tag.startsWith("Resource Carry")
          ? "bg-amber-50 text-amber-800 border-amber-100"
          : p.tag.includes("Pressure Sink")
          ? "bg-red-50 text-red-700 border-red-100"
          : p.tag.startsWith("Guest")
          ? "bg-violet-50 text-violet-700 border-violet-100"
          : "bg-slate-50 text-slate-700 border-slate-100";

      const investmentTag = p.investmentTag || "";
      const invTooltip = investmentTag
        ? getInvestmentTooltipLD(investmentTag)
        : "";
      const invTone =
        investmentTag === "Island Safe"
          ? "bg-emerald-50 text-emerald-700 border-emerald-100"
          : investmentTag === "Low-Maintenance"
          ? "bg-emerald-50/60 text-emerald-700 border-emerald-100"
          : investmentTag === "Invest Pays Off"
          ? "bg-sky-50 text-sky-700 border-sky-100"
          : investmentTag === "Setup Lane"
          ? "bg-sky-50/70 text-sky-700 border-sky-100"
          : investmentTag === "Volatile Duelist"
          ? "bg-amber-50 text-amber-800 border-amber-100"
          : investmentTag === "Needs Cover"
          ? "bg-orange-50 text-orange-800 border-orange-100"
          : investmentTag === "Resource Trap"
          ? "bg-red-50 text-red-700 border-red-100"
          : "";

      const guestStar = p.isGuest
        ? `<span class="ml-1 text-[0.6rem] text-violet-500" title="Plays &lt;10% of games in this window">⭐</span>`
        : "";

      const flexMark = p.isFlex
        ? `<span class="ml-1 text-[0.55rem] text-sky-500">flex</span>`
        : "";

      const profileTooltip = getProfileTooltipLD(p.tag);

      const investmentPill = investmentTag
        ? `<span class="inline-flex items-center px-1.5 py-0.5 ml-1 rounded-full text-[0.55rem] border ${invTone}" title="${invTooltip}">
             ${investmentTag}
           </span>`
        : "";

      return `
        <tr class="hover:bg-orange-50/40 transition">
          <td class="py-1.5 px-2 font-semibold text-gray-800">
            ${p.name}${guestStar}
            <span class="text-[0.6rem] text-gray-500 ml-1">(${p.displayRole})</span>
            <div class="text-[0.55rem] text-gray-400">${p.roleMix}${flexMark}</div>
          </td>
          <td class="py-1.5 px-2 text-right ${lcColor}">
            ${p.laneControl.toFixed(1)}%
          </td>
          <td class="py-1.5 px-2 text-right ${relColor}">
            ${p.reliability.toFixed(1)}%
          </td>
          <td class="py-1.5 px-2 text-right text-gray-700">
            ${p.selfLead ? p.selfLead.toFixed(0) + "%" : "—"}
          </td>
          <td class="py-1.5 px-2 text-right text-gray-700">
            ${p.helpedLead ? p.helpedLead.toFixed(0) + "%" : "—"}
          </td>
          <td class="py-1.5 px-2 text-right ${playColor}">
            ${p.playmaker.toFixed(1)}%
          </td>
          <td class="py-1.5 px-2 text-right ${sinkColor}">
            ${p.pressureSink.toFixed(1)}%
          </td>
          <td class="py-1.5 px-2 text-right text-gray-500">
            ${p.games}
          </td>
          <td class="py-1.5 px-2">
            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[0.6rem] border ${tagTone}" title="${profileTooltip}">
              ${p.tag}
            </span>
            ${investmentPill}
          </td>
        </tr>`;
    })
    .join("");

  const duoHeaderRow =
    duoRows.length > 0
      ? `
      <tr class="bg-slate-50/80">
        <td colspan="9" class="px-2 py-1.5 text-[0.65rem] font-semibold text-sky-700">
          Botlane Duos (BOTTOM + SUPPORT)
        </td>
      </tr>`
      : "";

  const duoRowsHTML = duoRows
    .map((d) => {
      const lcColor =
        d.laneControl >= 10
          ? "text-emerald-600"
          : d.laneControl >= 3
          ? "text-sky-600"
          : d.laneControl <= -8
          ? "text-red-500"
          : "text-gray-700";

      const relColor =
        d.reliability >= 70
          ? "text-emerald-600"
          : d.reliability <= 55
          ? "text-red-500"
          : "text-gray-700";

      const playColor =
        d.playmaker >= 12
          ? "text-emerald-600"
          : d.playmaker >= 6
          ? "text-sky-600"
          : "text-gray-500";

      const sinkColor =
        d.pressureSink >= 12 ? "text-red-500" : "text-gray-500";

      const tagTone =
        d.tag.includes("Rock")
          ? "bg-emerald-50 text-emerald-700 border-emerald-100"
          : d.tag.includes("Playmaker")
          ? "bg-sky-50 text-sky-700 border-sky-100"
          : d.tag.includes("Pressure Sink")
          ? "bg-red-50 text-red-700 border-red-100"
          : "bg-slate-50 text-slate-700 border-slate-100";

      const profileTooltip = getProfileTooltipLD(d.tag);

      return `
        <tr class="hover:bg-orange-50/40 transition">
          <td class="py-1.5 px-2 font-semibold text-gray-800">
            ${d.name}
            <div class="text-[0.55rem] text-gray-400">${d.roleMix}</div>
          </td>
          <td class="py-1.5 px-2 text-right ${lcColor}">
            ${d.laneControl.toFixed(1)}%
          </td>
          <td class="py-1.5 px-2 text-right ${relColor}">
            ${d.reliability.toFixed(1)}%
          </td>
          <td class="py-1.5 px-2 text-right text-gray-400">—</td>
          <td class="py-1.5 px-2 text-right text-gray-400">—</td>
          <td class="py-1.5 px-2 text-right ${playColor}">
            ${d.playmaker.toFixed(1)}%
          </td>
          <td class="py-1.5 px-2 text-right ${sinkColor}">
            ${d.pressureSink.toFixed(1)}%
          </td>
          <td class="py-1.5 px-2 text-right text-gray-500">
            ${d.games}
          </td>
          <td class="py-1.5 px-2">
            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[0.6rem] border ${tagTone}" title="${profileTooltip}">
              ${d.tag}
            </span>
          </td>
        </tr>`;
    })
    .join("");

  // ---------- Mini cards ----------

  const bestDuoCard = bestDuo
    ? `
      <div class="p-3 rounded-2xl bg-sky-50 border border-sky-100">
        <div class="text-[0.65rem] font-semibold text-sky-600 uppercase mb-1">Most Reliable Botlane Duo</div>
        <div class="text-sm font-semibold text-gray-900">${bestDuo.name}</div>
        <div class="text-[0.7rem] text-gray-700">
          Lane Control ${bestDuo.laneControl.toFixed(
            1
          )}%, Reliability ${bestDuo.reliability.toFixed(
      1
    )}% (${bestDuo.games} games)
        </div>
        <div class="text-[0.6rem] text-gray-500 mt-1">
          Use this lane when you want stable early game and consistent setups.
        </div>
      </div>`
    : `
      <div class="p-3 rounded-2xl bg-sky-50 border border-dashed border-sky-100 text-[0.65rem] text-gray-500">
        Not enough repeated BOTTOM+SUPPORT duos yet to highlight a reliable pairing.
      </div>`;

  const topPlaymakerCard = topPlaymaker
    ? `
      <div class="p-3 rounded-2xl bg-emerald-50 border border-emerald-100">
        <div class="text-[0.65rem] font-semibold text-emerald-600 uppercase mb-1">Top Phase Playmaker</div>
        <div class="text-sm font-semibold text-gray-900">
          ${topPlaymaker.name}
          <span class="text-[0.6rem] text-gray-500 ml-1">(${topPlaymaker.displayRole})</span>
        </div>
        <div class="text-[0.7rem] text-gray-700">
          Roaming/Grouped while stable: ${topPlaymaker.playmaker.toFixed(
            1
          )}% of phase minutes.
        </div>
        <div class="text-[0.6rem] text-gray-500 mt-1">
          Strong at moving first without bleeding lanes — draft tools that unlock this.
        </div>
      </div>`
    : `
      <div class="p-3 rounded-2xl bg-emerald-50/40 border border-dashed border-emerald-100 text-[0.6rem] text-gray-500">
        No clear standout playmaker in this window/phase.
      </div>`;

  const flexCard =
    flexCandidatesList.length > 0
      ? `
      <div class="p-3 rounded-2xl bg-amber-50 border border-amber-100">
        <div class="text-[0.65rem] font-semibold text-amber-600 uppercase mb-1">Flex Candidates</div>
        <div class="text-[0.7rem] text-gray-800">
          ${flexCandidatesList
            .map(
              (f) => `
              <div>
                ${f.name} — strong ${f.secondaryRole} option
                (${f.secondaryShare.toFixed(0)}% minutes,
                Lane Control ${f.laneControl.toFixed(1)}%,
                Rel ${f.reliability.toFixed(1)}%, ${f.games} games)
              </div>`
            )
            .join("")}
        </div>
        <div class="text-[0.6rem] text-gray-500 mt-1">
          Only players with meaningful secondary-role volume and solid impact are shown.
          Use them as your primary flex levers on draft.
        </div>
      </div>`
      : `
      <div class="p-3 rounded-2xl bg-amber-50/40 border border-dashed border-amber-100 text-[0.6rem] text-gray-500">
        No strong flex signals yet in this window/phase.
      </div>`;

  const jungleCards =
    jungleProfiles.length > 0
      ? `
      <div class="mt-4">
        <div class="text-[0.65rem] font-semibold text-sky-600 uppercase mb-1">Jungle Profiles</div>
        <div class="flex gap-2 overflow-x-auto pb-1">
          ${jungleProfiles
            .map(
              (j) => `
            <div class="min-w-[160px] p-3 rounded-2xl bg-slate-50 border border-slate-100">
              <div class="text-[0.6rem] font-semibold text-sky-600 uppercase mb-0.5">
                Jungle Profile
              </div>
              <div class="text-sm font-semibold text-gray-900">
                ${j.player}
                <span class="ml-1 text-[0.6rem] text-gray-500">${j.style}</span>
              </div>
              <div class="text-[0.6rem] text-gray-700 mt-0.5 leading-snug">
                Obj presence: ${j.objPresence.toFixed(0)}%<br/>
                Lead → Obj: ${j.leadObj.toFixed(0)}%<br/>
                Gank vs Farm: ${j.gankShare.toFixed(0)}% / ${j.farmShare.toFixed(
                  0
                )}%<br/>
                ${j.games} g, ${j.mins}m in phase
              </div>
            </div>`
            )
            .join("")}
        </div>
        <div class="text-[0.55rem] text-gray-500 mt-1">
          Includes players with meaningful JUNGLE usage (≥10% of window minutes with enough games/minutes), including off-roles.
        </div>
      </div>`
      : "";

  // ---------- Render ----------

  container.innerHTML = `
    <section class="section-wrapper fade-in mb-10">
      <div class="dashboard-card bg-white shadow-sm rounded-2xl border border-gray-100">
        <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
          <div>
            <h2 class="text-[1.05rem] font-semibold text-sky-500 tracking-tight">
              Lane Dynamics & Playmakers
            </h2>
            <p class="text-[0.7rem] text-gray-600 max-w-xl">
              Role-aware lane & map behaviour. Compares laners vs their direct opponents,
              and interprets Jungle/Support via pressure, presence, and roaming instead of classic lane diff.
            </p>
            <p class="text-[0.6rem] text-gray-500">
              Current phase:
              <span class="font-semibold capitalize">${lanePhase}</span>,
              Window:
              <span class="font-semibold">
                ${
                  laneWindow === "season"
                    ? "Season"
                    : laneWindow === "split"
                    ? "Current Split"
                    : "Last " + laneWindow + " games"
                }
              </span>.
            </p>
          </div>
          <div class="flex flex-col items-end gap-2">
            ${windowButtons}
            ${phaseButtons}
            <div class="text-right text-[0.6rem] text-gray-500">
              Timeline games in scope:
              <span class="font-semibold text-gray-800">${timelineGamesInScope}</span><br/>
              Includes core roster and guests (⭐ when &lt;10% of games in this window).
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

        <div class="mt-4 grid md:grid-cols-3 gap-3">
          ${bestDuoCard}
          ${topPlaymakerCard}
          ${flexCard}
        </div>

        ${jungleCards}

        <div class="mt-3 text-[0.6rem] text-gray-500 leading-snug">
          <p><strong>How to read:</strong></p>
          <p>
            <strong>Lane Control</strong>:
            composite of gold/xp/cs diff vs lane opponent in the chosen phase.
            <strong>Reliability</strong>:
            minutes not significantly behind.
            <strong>Self-Sufficient vs Helped Lead</strong>:
            whether advantages come alone/2v2 vs heavy presence.
            <strong>Playmaker</strong>:
            time roaming / grouped / river while stable (Jungle/Support naturally higher).
            <strong>Pressure Sink</strong>:
            behind despite strong ally presence (tightened in mid/late to avoid noise).
          </p>
          <p>
            <strong>Profiles</strong>:
            Lane Rock, Resource Carry, Playmaker, Pressure Sink, High-Risk Roamer,
            Guest (Small Sample), plus duo & jungle style tags.
            <br/>
            <strong>Investment tags</strong> (Island Safe, Invest Pays Off, Setup Lane, Needs Cover, Resource Trap, etc.)
            highlight how lanes respond to jungle attention in this phase/window.
            Built only from timeline behaviour; does <u>not</u> override Total Player Impact or Synergy scores.
          </p>
        </div>
      </div>
    </section>
  `;

  // ---------- Bind controls ----------

  container.querySelectorAll("[data-lane-phase]").forEach((btn) => {
    btn.addEventListener("click", () => {
      lanePhase = btn.getAttribute("data-lane-phase");
      if (
        typeof cachedRows !== "undefined" &&
        typeof cachedTimelineRows !== "undefined"
      ) {
        renderLaneDynamics(cachedRows, cachedTimelineRows);
      }
    });
  });

  container.querySelectorAll("[data-lane-window]").forEach((btn) => {
    btn.addEventListener("click", () => {
      laneWindow = btn.getAttribute("data-lane-window");
      if (
        typeof cachedRows !== "undefined" &&
        typeof cachedTimelineRows !== "undefined"
      ) {
        renderLaneDynamics(cachedRows, cachedTimelineRows);
      }
    });
  });

  console.log("🧭 Lane Dynamics v2.1", {
    phase: lanePhase,
    window: laneWindow,
    playerRows: withPlayerMetrics.length,
    duos: duoRows.length,
    jungleProfiles,
  });
}



// ============================================================================
// 📚 SPLIT SNAPSHOTS — v2.1
// - Three equal-sized cards: Split 1 / Split 2 / Split 3
// - Per-split: Games, Team WR, Team KDA, Avg KP
// - Player KDA ranking table (+ trend vs previous split)
// - Total team K/D/A, Most Improved, MVP & ACE leaders
// Renders into #splits
// ============================================================================

function renderSplits(splitsRaw) {
  const container = document.getElementById("splits");
  if (!container || !splitsRaw) return;

  const allData = splitsRaw["Season 25"] || splitsRaw["Season 2025"] || [];

  const splitOrder = ["Split 1", "Split 2", "Split 3"];
  const splitGroups = { "Split 1": [], "Split 2": [], "Split 3": [] };

  // --- Helpers ---
  const toNum = (v) => {
    if (v === undefined || v === null || v === "") return 0;
    const n = parseFloat(String(v).replace("%", "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  };

  const parseKP = (v) => {
    if (v === undefined || v === null || v === "") return null;
    const n = parseFloat(String(v).replace(",", "."));
    if (!Number.isFinite(n)) return null;
    return n <= 1 ? n * 100 : n;
  };

  const getGameId = (r) =>
    r["Match ID"] || r["Game #"] || r["Game ID"] || r["MatchID"] || r["Date"];

  const isWinSafe = (res) => String(res || "").toLowerCase() === "win";

  const kdaFromTotals = (s) => {
    if (!s) return null;
    const k = s.kills || 0;
    const d = s.deaths || 0;
    const a = s.assists || 0;
    if (!k && !d && !a) return null;
    return d > 0 ? (k + a) / d : (k + a);
  };

  const trendSymbol = (diff) => {
    if (diff > 0.1) return `<span class="text-emerald-500">▲</span>`;
    if (diff < -0.1) return `<span class="text-red-500">▼</span>`;
    return `<span class="text-gray-400">▶</span>`;
  };

  // --- Group rows by split ---
  allData.forEach((r) => {
    const val = String(r["Split"] || "").trim().toLowerCase();
    if (val === "1" || val === "split 1") splitGroups["Split 1"].push(r);
    else if (val === "2" || val === "split 2") splitGroups["Split 2"].push(r);
    else if (val === "3" || val === "split 3") splitGroups["Split 3"].push(r);
  });

  const anyData = splitOrder.some((s) => splitGroups[s].length);
  if (!anyData) {
    container.innerHTML = `
      <section class="section-wrapper fade-in">
        <div class="dashboard-card">
          <h2 class="text-[1.1rem] font-semibold text-orange-500 mb-1">Split Snapshots</h2>
          <p class="text-sm text-gray-500">No split data available yet.</p>
        </div>
      </section>`;
    return;
  }

  // --- Build calcStats cache per split for trends ---
  const splitStats = {};
  splitOrder.forEach((splitLabel) => {
    const rows = splitGroups[splitLabel];
    splitStats[splitLabel] = rows && rows.length ? calcStats(rows) : null;
  });

  const kdaDiffNumeric = (playerName, splitLabel) => {
    const idx = splitOrder.indexOf(splitLabel);
    if (idx <= 0) return 0;
    const prevLabel = splitOrder[idx - 1];
    const prevStats = splitStats[prevLabel];
    const currStats = splitStats[splitLabel];
    if (!prevStats || !currStats) return 0;

    const prev = prevStats[playerName];
    const curr = currStats[playerName];
    if (!prev || !curr) return 0;

    const prevKDA = kdaFromTotals(prev);
    const currKDA = kdaFromTotals(curr);
    if (prevKDA == null || currKDA == null) return 0;

    return currKDA - prevKDA;
  };

  const compareKDA = (playerName, splitLabel) =>
    trendSymbol(kdaDiffNumeric(playerName, splitLabel));

  // --- Build one split card ---
  function buildSplitCard(splitLabel) {
    const data = splitGroups[splitLabel];
    if (!data || !data.length) {
      return `
        <div class="bg-white rounded-3xl border border-dashed border-gray-200 shadow-sm p-5 flex flex-col justify-center items-center text-[0.7rem] text-gray-400">
          <div class="font-semibold mb-1">${splitLabel}</div>
          <div>No data for this split yet.</div>
        </div>`;
    }

    const gameIds = [
      ...new Set(
        data
          .map((r) => getGameId(r))
          .filter(Boolean)
      ),
    ];
    const totalGames = gameIds.length;

    const validRows = data.filter((r) => {
      const hasPlayer = (r["Player"] || "").trim();
      const hasKDAs =
        String(r["Kills"] || "").trim() ||
        String(r["Deaths"] || "").trim() ||
        String(r["Assists"] || "").trim();
      return hasPlayer && hasKDAs;
    });

    const stats = calcStats(validRows) || {};

    // Team wins by unique game
    const winningGames = new Set();
    data.forEach((r) => {
      if (isWinSafe(r["Result"])) {
        const gid = getGameId(r);
        if (gid) winningGames.add(gid);
      }
    });
    const teamWins = winningGames.size;
    const teamWinrate = totalGames ? (teamWins / totalGames) * 100 : 0;

    // Team totals
    const totalKills = validRows.reduce((s, r) => s + (+r["Kills"] || 0), 0);
    const totalDeaths = validRows.reduce((s, r) => s + (+r["Deaths"] || 0), 0);
    const totalAssists = validRows.reduce((s, r) => s + (+r["Assists"] || 0), 0);

    const avgTeamKDA =
      totalDeaths > 0
        ? ((totalKills + totalAssists) / totalDeaths).toFixed(2)
        : totalKills + totalAssists
        ? (totalKills + totalAssists).toFixed(2)
        : "—";

    // Team Avg KP
    const kpVals = validRows
      .map((r) => parseKP(r["Kill Part %"]))
      .filter((v) => v !== null);
    const avgKP =
      kpVals.length > 0
        ? `${(kpVals.reduce((a, b) => a + b, 0) / kpVals.length).toFixed(1)}%`
        : "—";

    // Per-player aggregates
    const playerGameCount = {};
    const playerWinCount = {};
    const playerKPSums = {};

    validRows.forEach((r) => {
      const name = (r["Player"] || "").trim();
      if (!name) return;
      const gid = getGameId(r);
      if (!gid) return;

      playerGameCount[name] = (playerGameCount[name] || 0) + 1;
      if (isWinSafe(r["Result"])) {
        playerWinCount[name] = (playerWinCount[name] || 0) + 1;
      }

      const kp = parseKP(r["Kill Part %"]);
      if (kp !== null) {
        if (!playerKPSums[name]) playerKPSums[name] = { sum: 0, count: 0 };
        playerKPSums[name].sum += kp;
        playerKPSums[name].count += 1;
      }
    });

    // Guest detection from global `players` if present
    let guestNames = [];
    try {
      if (Array.isArray(players)) {
        guestNames = players.filter((p) => p.guest).map((p) => p.name);
      }
    } catch (e) {
      guestNames = [];
    }

    let playerStats = Object.entries(stats)
      .map(([name, s]) => {
        if (!name || typeof s !== "object") return null;
        const games = playerGameCount[name] || 0;
        if (!games) return null;

        const wins = playerWinCount[name] || 0;
        const winrate = games ? ((wins / games) * 100).toFixed(1) : "—";

        const rawKDA = kdaFromTotals(s);
        const avgKDA = rawKDA != null ? rawKDA.toFixed(2) : "—";

        const kpAgg = playerKPSums[name];
        const avgKPPlayer =
          kpAgg && kpAgg.count
            ? `${(kpAgg.sum / kpAgg.count).toFixed(1)}%`
            : "—";

        const isGuest = guestNames.includes(name);
        const trend = compareKDA(name, splitLabel);

        return {
          name,
          games,
          wins,
          winrate,
          avgKDA,
          rawKDA: rawKDA || 0,
          avgKP: avgKPPlayer,
          mvps: s.mvps || 0,
          aces: s.aces || 0,
          isGuest,
          trend,
        };
      })
      .filter(Boolean);

    playerStats.sort((a, b) => b.rawKDA - a.rawKDA);
    const mainPlayers = playerStats.filter((p) => !p.isGuest);
    const guestPlayers = playerStats.filter((p) => p.isGuest);

    // Most Improved vs previous split
    const splitIdx = splitOrder.indexOf(splitLabel);
    let mostImproved = "—";
    if (splitIdx > 0 && mainPlayers.length) {
      let best = { name: "—", diff: 0 };
      mainPlayers.forEach((p) => {
        const diff = kdaDiffNumeric(p.name, splitLabel);
        if (diff > best.diff + 0.05) best = { name: p.name, diff };
      });
      if (best.name !== "—") {
        mostImproved = `${best.name} (+${best.diff.toFixed(2)} KDA vs prev split)`;
      }
    } else if (splitIdx === 0 && mainPlayers[0]) {
      mostImproved = `${mainPlayers[0].name} (early split anchor)`;
    }

    const topMVP = [...playerStats].sort((a, b) => b.mvps - a.mvps).slice(0, 3);
    const topACE = [...playerStats].sort((a, b) => b.aces - a.aces).slice(0, 3);

    return `
      <div class="bg-white rounded-3xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3">
        <!-- Header + metrics -->
        <div class="flex items-baseline justify-between gap-2">
          <div>
            <h3 class="text-[0.95rem] font-semibold text-orange-500">${splitLabel}</h3>
            <p class="text-[0.6rem] text-gray-500">
              Split snapshot · ${totalGames} game${totalGames === 1 ? "" : "s"}
            </p>
          </div>
          <div class="grid grid-cols-2 gap-1.5 text-center text-[0.55rem]">
            <div class="px-2 py-1.5 rounded-2xl bg-orange-50">
              <div class="text-sm font-semibold text-orange-600">${totalGames}</div>
              <div class="uppercase tracking-wide text-gray-600">Games</div>
            </div>
            <div class="px-2 py-1.5 rounded-2xl bg-emerald-50">
              <div class="text-sm font-semibold text-emerald-600">${teamWinrate.toFixed(
                1
              )}%</div>
              <div class="uppercase tracking-wide text-gray-600">Team WR</div>
            </div>
            <div class="px-2 py-1.5 rounded-2xl bg-indigo-50">
              <div class="text-sm font-semibold text-indigo-600">${avgTeamKDA}</div>
              <div class="uppercase tracking-wide text-gray-600">Team KDA</div>
            </div>
            <div class="px-2 py-1.5 rounded-2xl bg-sky-50">
              <div class="text-sm font-semibold text-sky-600">${avgKP}</div>
              <div class="uppercase tracking-wide text-gray-600">Avg KP</div>
            </div>
          </div>
        </div>

        <!-- Player table -->
        <div class="-mx-1 overflow-x-auto">
          <table class="w-full min-w-full text-[0.65rem] border-t border-gray-100">
            <thead class="text-gray-600 font-semibold border-b">
              <tr>
                <th class="text-left py-1 w-5">#</th>
                <th class="text-left py-1">Player</th>
                <th class="text-right py-1">KDA</th>
                <th class="text-right py-1">KP</th>
                <th class="text-right py-1">Trend</th>
                <th class="text-right py-1">W%</th>
                <th class="text-right py-1">G</th>
              </tr>
            </thead>
            <tbody>
              ${[...mainPlayers, ...guestPlayers]
                .map((p, i) => {
                  const rank = p.isGuest ? "–" : i + 1;
                  const nameCell = p.isGuest
                    ? `${p.name} <span class="text-gray-400" title="Guest player">⭐</span>`
                    : p.name;
                  return `
                    <tr data-player-stat="${p.name}"
                        class="${
                          i % 2 === 0 ? "bg-gray-50" : "bg-white"
                        } hover:bg-orange-50 transition cursor-pointer">
                      <td class="py-1 pl-1 text-[0.6rem] text-gray-500">${rank}</td>
                      <td class="py-1 text-[0.65rem] font-medium text-gray-800">${nameCell}</td>
                      <td class="py-1 pr-1 text-right text-gray-800">${p.avgKDA}</td>
                      <td class="py-1 pr-1 text-right text-gray-700">${p.avgKP}</td>
                      <td class="py-1 pr-1 text-right">${p.trend}</td>
                      <td class="py-1 pr-1 text-right text-gray-700">${p.winrate}</td>
                      <td class="py-1 pr-1 text-right text-gray-700">${p.games}</td>
                    </tr>`;
                })
                .join("")}
            </tbody>
          </table>
        </div>

        <!-- Footer: totals + awards -->
        <div class="pt-2 border-t border-gray-100 text-[0.65rem] text-gray-600 flex flex-col gap-1.5">
          <div class="flex flex-wrap justify-between items-center gap-2">
            <p>💥 <span class="font-semibold text-gray-700">Total K/D/A:</span>
               ${totalKills}/${totalDeaths}/${totalAssists}</p>
            <p>📈 <span class="font-semibold text-emerald-600">Most Improved:</span>
               ${mostImproved}</p>
          </div>
          <div class="flex flex-col gap-1.25">
            <div>
              <p class="font-semibold text-orange-500 mb-0.5">🏅 Top MVP Contributors</p>
              <ul class="list-none pl-0 space-y-0.25">
                ${
                  topMVP.length
                    ? topMVP
                        .map(
                          (p, i) => `
                    <li class="flex items-center justify-between">
                      <span class="flex items-center gap-1">
                        <span class="text-[0.6rem]">${["🥇","🥈","🥉"][i] || "•"}</span>
                        <span>${p.name}</span>
                      </span>
                      <span class="text-[0.6rem] text-gray-500">${p.mvps} MVP</span>
                    </li>`
                        )
                        .join("")
                    : `<li class="text-gray-400 text-[0.6rem]">No MVP data yet.</li>`
                }
              </ul>
            </div>
            <div>
              <p class="font-semibold text-indigo-500 mb-0.5">⚡ Top ACE Moments</p>
              <ul class="list-none pl-0 space-y-0.25">
                ${
                  topACE.length
                    ? topACE
                        .map(
                          (p, i) => `
                    <li class="flex items-center justify-between">
                      <span class="flex items-center gap-1">
                        <span class="text-[0.6rem]">${["🥇","🥈","🥉"][i] || "•"}</span>
                        <span>${p.name}</span>
                      </span>
                      <span class="text-[0.6rem] text-gray-500">${p.aces} ACE</span>
                    </li>`
                        )
                        .join("")
                    : `<li class="text-gray-400 text-[0.6rem]">No ACE data yet.</li>`
                }
              </ul>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // --- Outer wrapper with 3 equal cards ---
  container.innerHTML = `
    <section class="section-wrapper fade-in">
      <div class="dashboard-card">
        <div class="mb-3">
          <h2 class="text-[1.1rem] font-semibold text-orange-500 leading-tight">
            Split Snapshots
          </h2>
          <p class="text-[0.7rem] text-gray-600 max-w-xs">
            Per-split view of team form, player consistency, and improvement across the season.
          </p>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-1">
          ${splitOrder.map((s) => buildSplitCard(s)).join("")}
        </div>
      </div>
    </section>
  `;

  // --- Row click → highlight / select player globally ---
  container.querySelectorAll("[data-player-stat]").forEach((row) => {
    row.addEventListener("click", () => {
      const name = row.getAttribute("data-player-stat");
      let handled = false;
      try {
        if (typeof selectCharacter === "function" && Array.isArray(players)) {
          const p = players.find((pl) => pl.name === name);
          if (p) {
            selectCharacter(p.name, p.color);
            handled = true;
          }
        }
      } catch (e) {
        // ignore
      }
      if (!handled && typeof highlightPlayerStats === "function") {
        highlightPlayerStats(name, "#f97316");
      }
    });
  });
}



// --- MAIN CALL ---
loadData();
loadTimelineData(); // 🔹 add this line
