// ✅ Les Nübs Season 25 Google Sheet (published CSV link)
const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRbb898Zhxeml0wxUIeXQk33lY3eVDqIGepE7iEiHA0KQNMQKvQWedA4WMaKUXBuhKfrPjalVb-OvD9/pub?gid=331200910&single=true&output=csv";

let trendWindow = 10; // Default trend window
let cachedRows = null; // Cached CSV data for faster re-renders

// --- Default Player Avatars ---
const basePlayers = [
  { name: "Betzhamo", svg: "assets/avatars/betzhamo.svg", color: "#f97316" },
  { name: "Jansen", svg: "assets/avatars/jansen.svg", color: "#3b82f6" },
  { name: "Sweeney", svg: "assets/avatars/sweeney.svg", color: "#22c55e" },
  { name: "denotes", svg: "assets/avatars/ota.svg", color: "#a855f7" },
  { name: "Burningelf", svg: "assets/avatars/achten.svg", color: "#f59e0b" },
  { name: "HH", svg: "assets/avatars/hh.svg", color: "#ef4444" },
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
  const safeRender = (fnName, fn, args) => {
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
// --- Render all sections safely ---
safeRender("renderSummary", renderSummary, [splits["Season 25"]]);
safeRender("renderObjectiveImpact", renderObjectiveImpact, [splits["Season 25"]]);
safeRender("renderTeamSynergy", typeof renderTeamSynergy !== "undefined" ? renderTeamSynergy : null, [splits["Season 25"]]);
// safeRender("renderPerformanceImpact", renderPerformanceImpact, [splits["Season 25"]]);
safeRender("renderOverview", typeof renderOverview !== "undefined" ? renderOverview : null, [splits["Season 25"]]);
//safeRender("renderTrends", renderTrends, [splits["Season 25"]]);
safeRender("renderSplits", renderSplits, [splits]);
safeRender("renderCharacterSelect", renderCharacterSelect, []);



  console.log("✅ All available sections rendered");
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
// 📊 SEASON 25 SUMMARY — v3.0
// - Uses unified game ID detection
// - Correct "Current Split" via max(Split) for Les Nübs
// - Blue/Red/Overall Winrate inside this card
// - Fun facts minis: Pink wards, Vision, Damage
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

    // ---------- Season & Split detection (from our team rows if possible) ----------
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
      const allGames = data
        .map((r) => getGameId(r))
        .filter(Boolean);
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
    const games = [...new Set(rowsForStats.map((r) => getGameId(r) || r["Date"]))];
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

    // ---------- Side Winrates (same philosophy as TPI card, but from our rows) ----------
    const matchMap = new Map();
    rowsForStats.forEach((r) => {
      const id = getGameId(r);
      if (!id || matchMap.has(id)) return;
      matchMap.set(id, r);
    });
    const uniqueMatches = Array.from(matchMap.values());
    const sideGamesTotal = uniqueMatches.length || 1;

    const blueGames = uniqueMatches.filter((r) => {
      const side = String(r["Team Side"] || "").toLowerCase();
      const winningTeam = parseInt(r["Winning Team"]);
      // our side is blue if Team Side says so OR if our team is 100 in data convention
      return side.includes("blue") || winningTeam === 100;
    });

    const redGames = uniqueMatches.filter((r) => {
      const side = String(r["Team Side"] || "").toLowerCase();
      const winningTeam = parseInt(r["Winning Team"]);
      // our side is red if Team Side says so OR if our team is 200 in data convention
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

    const overallSideWinrate =
      sideGamesTotal > 0
        ? (
            (blueWins + redWins) /
            sideGamesTotal *
            100
          ).toFixed(1)
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

    // Kill participation: average per game across our players
    const matchGroups = {};
    rowsForStats.forEach((r) => {
      const id = getGameId(r);
      if (!id) return;
      const raw = toNum(r["Kill Part %"]) || 0;
      if (!matchGroups[id]) matchGroups[id] = [];
      if (raw > 0) matchGroups[id].push(raw);
    });

    const avgKP = Object.values(matchGroups).length
      ? (
          Object.values(matchGroups)
            .map((arr) =>
              arr.reduce((a, b) => a + b, 0) / arr.length
            )
            .reduce((a, b) => a + b, 0) /
          Object.values(matchGroups).length
        ).toFixed(1)
      : "0.0";

    // Avg game time (minutes)
    const timeValues = rowsForStats
      .map((r) => {
        const t = String(r["TIME"] || "").trim();
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

    // ---------- Streaks (by match) ----------
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

    // ---------- Fun Fact Minis (our team only) ----------
    const funRows = rowsForStats; // already our team if available

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

    // ---------- Header buttons ----------
    const trendButtons = `
      <div class="flex gap-1 text-xs font-medium">
        ${["5", "10", "split", "season"]
          .map(
            (w) => `
          <button
            class="px-2.5 py-1 rounded-md border transition
              ${
                summaryTrendWindow === w
                  ? "bg-orange-500 text-white border-orange-500"
                  : "bg-white text-gray-700 border-gray-200 hover:border-orange-300 hover:text-orange-500"
              }"
            data-summary-window="${w}">
            ${
              w === "5"
                ? "5 Games"
                : w === "10"
                ? "10 Games"
                : w === "split"
               ? "Current Split"
              : "Season " + currentSeason

            }
          </button>`
          )
          .join("")}
      </div>`;

    // ---------- Build HTML ----------
    document.getElementById("season-summary").innerHTML = `
      <section class="section-wrapper fade-in mb-10">
        <div class="dashboard-card text-center">
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
            ${renderMiniCard("Blue Side Winrate", `${blueWinrate}%`)}
            ${renderMiniCard("Red Side Winrate", `${redWinrate}%`)}
            ${renderMiniCard(streakLabel, `${streakCount || 0} Games`)}
            ${renderMiniCard("Last Updated", staticLastUpdated, "text-sm")}
          </div>

          <!-- Fun Fact Minis -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
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
          summaryTrendWindow = btn.getAttribute(
            "data-summary-window"
          );
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
        <div class="text-gray-500 text-sm mb-1">${label}</div>
        <div class="${valueClass} text-gray-800">${value}</div>
      </div>
      <div class="mt-1">${footer}</div>
    </div>
  `;
}






// ============================================================================
// ⭐ TOTAL PLAYER IMPACT — v1.0
// One unified individual score:
// - 55% Individual performance (lane, damage, carry, discipline)
// - 45% Objective & macro impact (vision, tempo, conversion, participation)
// - Role-scaled, sample-size adjusted, guest handling
// - Per-player strengths & focus tips with player selection
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
  const currentSeason = seasons.length
    ? seasons[seasons.length - 1]
    : "2025";

  const splitSource = ourRowsAll.length ? ourRowsAll : data;
  const splitNums = splitSource
    .map((r) => normSplitNum(r["Split"]))
    .filter((n) => n !== null);
  const currentSplit =
    splitNums.length > 0 ? Math.max(...splitNums) : null;

  // ---------- Filter by window ----------
  const getRecentGames = (n) => {
    const allGames = data
      .map((r) => getGameId(r))
      .filter(Boolean);
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

  // ---------- Game ID key ----------
  const gameIdKey =
    ["Match ID", "Game #", "Game ID", "MatchID", "Date"].find(
      (k) => k in (filteredData[0] || {})
    ) || "Game #";

  // ---------- One row per match for team-level objective view ----------
  const matchMap = new Map();
  filteredData.forEach((r) => {
    const id = getGameId(r);
    if (!id || matchMap.has(id)) return;
    matchMap.set(id, r);
  });
  const uniqueMatches = Array.from(matchMap.values());
  const totalGames = uniqueMatches.length || 1;

  // ---------- Winrate overview ----------
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

  const blueWinrate = blueGames.length
    ? (blueWins / blueGames.length) * 100
    : 0;
  const redWinrate = redGames.length
    ? (redWins / redGames.length) * 100
    : 0;

  // ---------- Objective mini cards ----------
  const calcObjective = (killsKey, firstKey, emoji, label) => {
    const controlGames = uniqueMatches.filter(
      (r) =>
        String(r[firstKey]).toUpperCase() === "TRUE" ||
        toNum(r[killsKey]) > 0
    );

    const controlPct = (controlGames.length / totalGames) * 100;

    const winrateWhenSecured = controlGames.length
      ? (controlGames.filter(
          (r) => String(r["Result"]).toLowerCase() === "win"
        ).length /
          controlGames.length) *
        100
      : 0;

    const prev = previousObjSummary[label] || {};
    const delta =
      typeof prev.winrate === "number"
        ? winrateWhenSecured - prev.winrate
        : 0;

    previousObjSummary[label] = {
      control: controlPct,
      winrate: winrateWhenSecured,
    };

    return {
      emoji,
      label,
      control: controlPct,
      winrate: winrateWhenSecured,
      delta,
    };
  };

  const objectiveCards = [
    calcObjective("Dragon Kills", "First Dragon (Team)", "🐉", "Dragon"),
    calcObjective("Herald Kills", "First Herald (Team)", "🪄", "Herald"),
    calcObjective("Baron Kills", "First Baron (Team)", "👑", "Baron"),
    calcObjective("Tower Kills", "First Tower (Team)", "🏰", "Tower"),
    calcObjective(
      "Atakhan Participation",
      "First Atakhan (Team)",
      "🔥",
      "Atakhan"
    ),
    calcObjective(
      "Void Grub Participation",
      "First Void Grub (Team)",
      "🪲",
      "Void Grub"
    ),
  ];

  const objectiveHTML = `
    <div class="grid grid-cols-2 md:grid-cols-3 gap-4 mt-6 fade-in delay-1">
      ${objectiveCards
        .map(
          (o) => `
        <div class="dashboard-card p-4 text-sm text-gray-700">
          <div class="flex justify-between items-center mb-1">
            <span class="font-semibold text-gray-800">${o.emoji} ${o.label}</span>
            <span class="${
              o.delta > 0
                ? "text-emerald-600"
                : o.delta < 0
                ? "text-red-600"
                : "text-gray-400"
            } text-xs">
              ${
                o.delta === 0
                  ? "•"
                  : (o.delta > 0 ? "▲" : "▼") +
                    Math.abs(o.delta).toFixed(1)
              }
            </span>
          </div>
          <p class="text-xs text-gray-500">Control: ${o.control.toFixed(
            1
          )}%</p>
          <p class="text-xs text-gray-500">Winrate: ${o.winrate.toFixed(
            1
          )}%</p>
        </div>
      `
        )
        .join("")}
    </div>`;

  // ---------- Adaptive Objective Weights (AOW) ----------
  const objectivesList = [
    "Dragon",
    "Herald",
    "Baron",
    "Tower",
    "Atakhan",
    "Void Grub",
  ];

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
      (r) =>
        String(r[firstKey]).toUpperCase() === "TRUE" ||
        toNum(r[killsKey]) > 0
    );
    const notSecured = uniqueMatches.filter((r) => !secured.includes(r));

    if (secured.length + notSecured.length < minGamesForReliability) {
      importance[obj] = null;
      return;
    }

    const winSecured =
      secured.filter(
        (r) => String(r["Result"]).toLowerCase() === "win"
      ).length / Math.max(1, secured.length);

    const winNot =
      notSecured.filter(
        (r) => String(r["Result"]).toLowerCase() === "win"
      ).length / Math.max(1, notSecured.length);

    importance[obj] = Math.max(0, winSecured - winNot);
  });

  const validImps = Object.values(importance).filter((v) => v && v > 0);
  const totalImp = validImps.reduce((a, b) => a + b, 0);

  const objWeights = {};
  objectivesList.forEach((obj) => {
    const adaptive =
      totalImp > 0 && importance[obj]
        ? importance[obj] / totalImp
        : staticDefaults[obj];
    objWeights[obj] = 0.7 * adaptive + 0.3 * staticDefaults[obj];
  });

  const totalW =
    Object.values(objWeights).reduce((a, b) => a + b, 0) || 1;
  Object.keys(objWeights).forEach(
    (k) => (objWeights[k] = objWeights[k] / totalW)
  );

  // ---------- Per-player aggregation ----------
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

    // macro/objective metrics bucket
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

    // role frequency
    if (!roleFrequency[name]) roleFrequency[name] = {};
    if (role) {
      roleFrequency[name][role] =
        (roleFrequency[name][role] || 0) + 1;
    }
  });

  // ---------- Build per-player metrics ----------
  let playerStatsArr = Object.entries(playerStats).map(
    ([name, s]) => {
      const games = s.gamesSet.size || 1;
      const avg = (key) =>
        (s.totals[key] || 0) / games;

      // Macro / objective groups
      const control =
        (avg("Objective Control Balance") +
          avg("Baron Control %") +
          avg("Tower Control %")) /
        3;

      const conversion =
        (avg("Objective Conversion Rate") +
          avg("Objective Kills") +
          avg("Early Objective Ratio")) /
        3;

      // AOW-weighted participation
      const participation =
        avg("Dragon Participation") * (objWeights.Dragon || 0) +
        avg("Herald Participation") * (objWeights.Herald || 0) +
        avg("Baron Participation") * (objWeights.Baron || 0) +
        avg("Tower Participation") * (objWeights.Tower || 0) +
        avg("Atakhan Participation") *
          (objWeights.Atakhan || 0) +
        avg("Void Grub Participation") *
          (objWeights["Void Grub"] || 0);

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

      // Individual metrics (per game averages)
      const killsPg = s.kills / games;
      const deathsPg = s.deaths / games;
      const assistsPg = s.assists / games;
      const avgKDA = s.kdaSum / games;
      const avgKP =
        s.kpCount > 0 ? s.kpSum / s.kpCount : 0;
      const avgDmgShare =
        s.dmgShareSum / games;
      const avgDPM = s.dpmSum / games;
      const avgGoldMin =
        s.goldMinSum / games;
      const avgCSMin =
        s.csMinSum / games;
      const avgSolo =
        s.soloKills / games;
      const avgPlates =
        s.plates / games;
      const avgMech =
        s.mechSum / games;
      const avgTact =
        s.tactSum / games;
      const avgCarry =
        s.carrySum / games;
      const avgPerfRating =
        s.perfRatingSum / games;

      return {
        name,
        role: s.role,
        games,

        // macro groups
        control,
        conversion,
        participation,
        vision,
        tempo,
        consistency,

        // indiv summary
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
    }
  );

  if (!playerStatsArr.length) return;

  // ---------- Normalization helpers ----------
  const buildMinMax = (vals) => {
    const v = vals.filter(
      (x) => typeof x === "number" && !isNaN(x)
    );
    if (!v.length) return { min: 0, max: 1 };
    return {
      min: Math.min(...v),
      max: Math.max(...v),
    };
  };

  const norm = (v, mm, invert = false) => {
    const { min, max } = mm;
    if (!isFinite(min) || !isFinite(max) || max === min)
      return 0.5;
    let x = (v - min) / (max - min);
    x = Math.max(0, Math.min(1, x));
    return invert ? 1 - x : x;
  };

  // macro groups
  const mmControl = buildMinMax(
    playerStatsArr.map((p) => p.control)
  );
  const mmConversion = buildMinMax(
    playerStatsArr.map((p) => p.conversion)
  );
  const mmPart = buildMinMax(
    playerStatsArr.map((p) => p.participation)
  );
  const mmVision = buildMinMax(
    playerStatsArr.map((p) => p.vision)
  );
  const mmTempo = buildMinMax(
    playerStatsArr.map((p) => p.tempo)
  );
  const mmConsist = buildMinMax(
    playerStatsArr.map((p) => p.consistency)
  );

  // indiv metrics
  const mmKDA = buildMinMax(
    playerStatsArr.map((p) => p.indiv.avgKDA)
  );
  const mmKP = buildMinMax(
    playerStatsArr.map((p) => p.indiv.avgKP)
  );
  const mmDmgShare = buildMinMax(
    playerStatsArr.map((p) => p.indiv.avgDmgShare)
  );
  const mmDPM = buildMinMax(
    playerStatsArr.map((p) => p.indiv.avgDPM)
  );
  const mmGold = buildMinMax(
    playerStatsArr.map((p) => p.indiv.avgGoldMin)
  );
  const mmCS = buildMinMax(
    playerStatsArr.map((p) => p.indiv.avgCSMin)
  );
  const mmSolo = buildMinMax(
    playerStatsArr.map((p) => p.indiv.avgSolo)
  );
  const mmPlates = buildMinMax(
    playerStatsArr.map((p) => p.indiv.avgPlates)
  );
  const mmDeaths = buildMinMax(
    playerStatsArr.map((p) => p.indiv.deathsPg)
  );
  const mmMech = buildMinMax(
    playerStatsArr.map((p) => p.indiv.avgMech)
  );
  const mmTact = buildMinMax(
    playerStatsArr.map((p) => p.indiv.avgTact)
  );
  const mmCarry = buildMinMax(
    playerStatsArr.map((p) => p.indiv.avgCarry)
  );
  const mmPR = buildMinMax(
    playerStatsArr.map((p) => p.indiv.avgPerfRating)
  );

  // ---------- Role-weighted composites (macro + indiv) ----------
  playerStatsArr = playerStatsArr.map((p) => {
    // role mix
    const freq = roleFrequency[p.name] || {};
    let roleFractions = Object.entries(freq);
    const totalGamesRole = roleFractions.reduce(
      (a, [, c]) => a + c,
      0
    );

    if (!totalGamesRole) {
      roleFractions = [[(p.role || "MID").toUpperCase(), 1]];
    } else {
      roleFractions = roleFractions.map(([r, c]) => [
        r,
        c / totalGamesRole,
      ]);
    }

    roleFractions.sort((a, b) => b[1] - a[1]);
    const [mainRole, mainShare] =
      roleFractions[0] || ["MID", 1];
    const flex =
      roleFractions.length >= 2 &&
      roleFractions.filter(([, share]) => share >= 0.2)
        .length >= 2;

    // stable main role gets slight boost
    const ampMin = 0.05;
    const ampMax = 0.2;
    const amplification =
      mainShare <= 0.55
        ? 0
        : Math.min(
            ampMax,
            ampMin + (mainShare - 0.55) * 0.5
          );

    const adjustedFreq = {};
    roleFractions.forEach(([role, share]) => {
      adjustedFreq[role] =
        role === mainRole
          ? share * (1 + amplification)
          : share;
    });
    const sumAdj =
      Object.values(adjustedFreq).reduce(
        (a, b) => a + b,
        0
      ) || 1;
    Object.keys(adjustedFreq).forEach(
      (k) => (adjustedFreq[k] /= sumAdj)
    );

    const roleWeights = {
      JUNGLE: {
        control: 0.3,
        conversion: 0.2,
        participation: 0.2,
        vision: 0.1,
        tempo: 0.15,
        consistency: 0.05,
      },
      SUPPORT: {
        control: 0.15,
        conversion: 0.15,
        participation: 0.2,
        vision: 0.3,
        tempo: 0.1,
        consistency: 0.1,
      },
      TOP: {
        control: 0.25,
        conversion: 0.25,
        participation: 0.2,
        vision: 0.1,
        tempo: 0.1,
        consistency: 0.1,
      },
      MID: {
        control: 0.2,
        conversion: 0.25,
        participation: 0.2,
        vision: 0.15,
        tempo: 0.1,
        consistency: 0.1,
      },
      ADC: {
        control: 0.2,
        conversion: 0.25,
        participation: 0.25,
        vision: 0.1,
        tempo: 0.1,
        consistency: 0.1,
      },
    };

    const blended = {
      control: 0,
      conversion: 0,
      participation: 0,
      vision: 0,
      tempo: 0,
      consistency: 0,
    };

    Object.entries(adjustedFreq).forEach(
      ([role, frac]) => {
        const base =
          roleWeights[role] || roleWeights.MID;
        Object.keys(blended).forEach((k) => {
          blended[k] += base[k] * frac;
        });
      }
    );

    // normalized macro groups
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

    // normalized individual metrics
    const I = p.indiv;
    const nKDA = norm(I.avgKDA, mmKDA);
    const nKP = norm(I.avgKP, mmKP);
    const nDmgShare = norm(
      I.avgDmgShare,
      mmDmgShare
    );
    const nDPM = norm(I.avgDPM, mmDPM);
    const nGold = norm(
      I.avgGoldMin,
      mmGold
    );
    const nCS = norm(I.avgCSMin, mmCS);
    const nSolo = norm(I.avgSolo, mmSolo);
    const nPlates = norm(
      I.avgPlates,
      mmPlates
    );
    const nSafe = norm(
      I.deathsPg,
      mmDeaths,
      true
    ); // lower deaths = better
    const nMech = norm(
      I.avgMech,
      mmMech
    );
    const nTact = norm(
      I.avgTact,
      mmTact
    );
    const nCarry = norm(
      I.avgCarry,
      mmCarry
    );
    const nPR = norm(
      I.avgPerfRating,
      mmPR
    );

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

    const totalCompositeRaw =
      0.55 * indivComposite +
      0.45 * objComposite;

    return {
      ...p,
      mainRole,
      isFlex: flex,
      roleMix: roleFractions
        .map(
          ([r, s]) => `${r} ${(s * 100).toFixed(
            0
          )}%`
        )
        .join(" / "),
      _objComposite: objComposite,
      _indivComposite: indivComposite,
      _totalCompositeRaw: totalCompositeRaw,
    };
  });

  // ---------- Sample size + guest handling ----------
  const maxGames =
    Math.max(
      ...playerStatsArr.map((p) => p.games || 1)
    ) || 1;
  const teamMeanComposite =
    playerStatsArr.reduce(
      (sum, p) => sum + (p._totalCompositeRaw || 0.5),
      0
    ) / (playerStatsArr.length || 1) || 0.5;

  const minGamesFull = Math.max(
    3,
    Math.round(0.3 * maxGames)
  );

  playerStatsArr = playerStatsArr.map((p) => {
    const g = p.games || 0;
    const sampleFactor = Math.max(
      0,
      Math.min(1, g / minGamesFull)
    );
    const blendedComposite =
      sampleFactor *
        (p._totalCompositeRaw || 0.5) +
      (1 - sampleFactor) * teamMeanComposite;

    const base = 40;
    const score = base + blendedComposite * (100 - base);

    const prev = previousTPI[p.name];
    const delta =
      typeof prev === "number"
        ? score - prev
        : 0;

    previousTPI[p.name] = score;

    const isGuest =
      g < minGamesFull;

    return {
      ...p,
      impact: score,
      delta,
      isGuest,
    };
  });

  // sort: real samples first, guests after
  playerStatsArr.sort((a, b) => {
    if (a.isGuest !== b.isGuest)
      return a.isGuest ? 1 : -1;
    return b.impact - a.impact;
  });

  // ---------- UI pieces ----------
  const trendButtons = `
    <div class="flex gap-2 text-sm">
      ${["5","10","split","season"]
        .map(
          (w) => `
        <button
          class="px-3 py-1 rounded-lg border ${
            objectiveTrendWindow === w
              ? "bg-orange-500 text-white border-orange-500"
              : "bg-white text-gray-700 border-gray-300 hover:bg-orange-50"
          } transition"
          data-window="${w}">
          ${
            w === "5"
              ? "5 Games"
              : w === "10"
              ? "10 Games"
              : w === "split"
              ? "Current Split"
              : "Season ${currentSeason}"
          }
        </button>`
        )
        .join("")}
    </div>`;

  const sideHTML = `
    <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mt-5 fade-in delay-1">
      <div class="dashboard-card p-4 text-center">
        <p class="text-xs text-gray-500 font-medium mb-1">Blue Side Winrate</p>
        <p class="text-xl font-bold text-blue-600">${blueWinrate.toFixed(
          1
        )}%</p>
      </div>
      <div class="dashboard-card p-4 text-center">
        <p class="text-xs text-gray-500 font-medium mb-1">Red Side Winrate</p>
        <p class="text-xl font-bold text-red-600">${redWinrate.toFixed(
          1
        )}%</p>
      </div>
      <div class="dashboard-card p-4 text-center">
        <p class="text-xs text-gray-500 font-medium mb-1">Overall Winrate</p>
        <p class="text-xl font-bold text-gray-800">${overallWinrate.toFixed(
          1
        )}%</p>
      </div>
    </div>`;

  const tableHTML = `
    <table class="table-clean mt-6 fade-in delay-2">
      <thead>
        <tr>
          <th>Player</th>
          <th class="text-right">Total Impact</th>
          <th class="text-right">Δ</th>
          <th class="text-right">Games</th>
        </tr>
      </thead>
      <tbody>
        ${playerStatsArr
          .map(
            (p) => `
          <tr data-player="${p.name}" data-player-stat="${p.name}" class="cursor-pointer hover:bg-orange-50 transition">
            <td class="tooltip">
              ${p.name}
              <span class="text-xs text-gray-500">
                (${p.mainRole}${
              p.isFlex ? ", flex" : ""
            }${p.isGuest ? ", guest" : ""})
              </span>
              ${
                p.isFlex
                  ? `<span class="tooltip-text">Role mix: ${p.roleMix}</span>`
                  : ""
              }
              ${
                p.isGuest
                  ? `<span class="ml-1 text-yellow-500" title="Low sample size — treated as guest.">⭐</span>`
                  : ""
              }
            </td>
            <td class="text-right ${
              p.impact >= 75
                ? "text-emerald-600"
                : p.impact >= 60
                ? "text-yellow-600"
                : "text-red-600"
            } font-medium">
              ${p.impact.toFixed(0)}
            </td>
            <td class="text-right text-xs ${
              p.delta > 0.8
                ? "text-emerald-600"
                : p.delta < -0.8
                ? "text-red-600"
                : "text-gray-400"
            }">
              ${
                !previousTPI[p.name]
                  ? "•"
                  : p.delta > 0.8
                  ? `▲${p.delta.toFixed(1)}`
                  : p.delta < -0.8
                  ? `▼${Math.abs(p.delta).toFixed(1)}`
                  : "•"
              }
            </td>
            <td class="text-right text-gray-500">${p.games}</td>
          </tr>`
          )
          .join("")}
      </tbody>
    </table>`;

  const playerButtons = `
    <div class="mt-4 flex flex-wrap gap-2 fade-in delay-3">
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
    <div id="objective-info" class="mt-6 border-t pt-3 fade-in delay-4">
      <button
        id="toggleObjectiveInfo"
        class="flex items-center gap-1 text-sm font-semibold text-gray-700 hover:text-orange-600 transition">
        <span>ℹ️ What does this score mean?</span>
        <span id="infoArrow" class="transition-transform">▼</span>
      </button>
      <div id="objectiveInfoContent"
           class="hidden text-sm text-gray-600 mt-2 leading-relaxed">
        <p><strong>Total Player Impact</strong> (40–100) is a relative score inside your team. It blends:</p>
        <ul class="list-disc ml-5 mt-1 space-y-1">
          <li><strong>Individual performance</strong>: KDA, kill participation, damage share, DPM, resource usage, solo pressure, plates, mechanical &amp; tactical scores, discipline.</li>
          <li><strong>Objective &amp; macro impact</strong>: control, conversion, weighted objective participation, vision around objectives, tempo, macro &amp; teamfight contribution.</li>
          <li><strong>Role context</strong>: expectations for Jungle / Support / Solo lanes / ADC and your actual role mix.</li>
          <li><strong>Sample size</strong>: low-game players are shrunk toward team average and shown as ⭐ guests until they have enough data.</li>
        </ul>
        <p class="mt-1 text-xs text-gray-500">
          Use the table + name buttons to inspect each player. Strengths &amp; focus notes are relative to team context, not soloqueue judgment.
        </p>
      </div>
    </div>`;

  document.getElementById("objective-impact").innerHTML = `
    <section class="fade-bg section-wrapper fade-in">
      <div class="dashboard-card">
        <div class="trend-header mb-2 flex items-center justify-between gap-3">
          <h2>⭐ Total Player Impact (Individual)</h2>
          ${trendButtons}
        </div>
        ${sideHTML}
        ${objectiveHTML}
        ${tableHTML}
        ${playerButtons}
        ${detailBox}
        ${infoBox}
      </div>
    </section>`;

  // ---------- Interactions ----------

  // Trend window buttons
  document
    .querySelectorAll("[data-window]")
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        objectiveTrendWindow =
          btn.getAttribute("data-window");
        renderObjectiveImpact(data);
      });
    });

  // Info toggle
  const infoBtn = document.getElementById(
    "toggleObjectiveInfo"
  );
  const infoContent =
    document.getElementById(
      "objectiveInfoContent"
    );
  const arrow =
    document.getElementById("infoArrow");
  if (infoBtn && infoContent && arrow) {
    infoBtn.addEventListener("click", () => {
      const hidden =
        infoContent.classList.contains(
          "hidden"
        );
      infoContent.classList.toggle("hidden");
      arrow.style.transform = hidden
        ? "rotate(180deg)"
        : "rotate(0deg)";
    });
  }

  // Build context for insights
  const mean = (arr) =>
    arr.length
      ? arr.reduce((a, b) => a + b, 0) /
        arr.length
      : 0;

  const ctx = {
    meanKDA: mean(
      playerStatsArr.map(
        (p) => p.indiv.avgKDA || 0
      )
    ),
    meanDmgShare: mean(
      playerStatsArr.map(
        (p) => p.indiv.avgDmgShare || 0
      )
    ),
    meanDPM: mean(
      playerStatsArr.map(
        (p) => p.indiv.avgDPM || 0
      )
    ),
    meanGold: mean(
      playerStatsArr.map(
        (p) => p.indiv.avgGoldMin || 0
      )
    ),
    meanCS: mean(
      playerStatsArr.map(
        (p) => p.indiv.avgCSMin || 0
      )
    ),
    meanSolo: mean(
      playerStatsArr.map(
        (p) => p.indiv.avgSolo || 0
      )
    ),
    meanPlates: mean(
      playerStatsArr.map(
        (p) => p.indiv.avgPlates || 0
      )
    ),
    meanDeaths: mean(
      playerStatsArr.map(
        (p) => p.indiv.deathsPg || 0
      )
    ),
    meanMech: mean(
      playerStatsArr.map(
        (p) => p.indiv.avgMech || 0
      )
    ),
    meanTact: mean(
      playerStatsArr.map(
        (p) => p.indiv.avgTact || 0
      )
    ),
    meanCarry: mean(
      playerStatsArr.map(
        (p) => p.indiv.avgCarry || 0
      )
    ),
    meanControl: mean(
      playerStatsArr.map(
        (p) => p.control || 0
      )
    ),
    meanConv: mean(
      playerStatsArr.map(
        (p) => p.conversion || 0
      )
    ),
    meanPart: mean(
      playerStatsArr.map(
        (p) => p.participation || 0
      )
    ),
    meanVision: mean(
      playerStatsArr.map(
        (p) => p.vision || 0
      )
    ),
    meanTempo: mean(
      playerStatsArr.map(
        (p) => p.tempo || 0
      )
    ),
    meanCons: mean(
      playerStatsArr.map(
        (p) => p.consistency || 0
      )
    ),
  };

  const detailEl =
    document.getElementById(
      "player-detail"
    );

  const buildPlayerDetail = (p) => {
    const S = [];
    const F = [];

    const ratio = (val, avg) =>
      avg > 0 ? val / avg : 1;

    const add = (cond, arr, text) => {
      if (cond) arr.push(text);
    };

    // Lane & economy
    add(
      ratio(p.indiv.avgCSMin, ctx.meanCS) >
        1.15,
      S,
      "Strong CS/min & lane farming — reliably converting waves into gold."
    );
    add(
      ratio(p.indiv.avgCSMin, ctx.meanCS) <
        0.85,
      F,
      "Work on CS/min & wave control to secure more stable resources."
    );

    add(
      ratio(
        p.indiv.avgGoldMin,
        ctx.meanGold
      ) > 1.15,
      S,
      "High gold per minute — good tempo on farming & objectives."
    );
    add(
      ratio(
        p.indiv.avgGoldMin,
        ctx.meanGold
      ) < 0.85,
      F,
      "Increase farming efficiency and join only high-value fights."
    );

    // Combat & carry
    add(
      ratio(p.indiv.avgKDA, ctx.meanKDA) >
        1.15,
      S,
      "Efficient KDA — good fight selection & survival."
    );
    add(
      ratio(p.indiv.avgKDA, ctx.meanKDA) <
        0.85,
      F,
      "Review death patterns; avoid low-value deaths & greedy plays."
    );

    add(
      ratio(
        p.indiv.avgDmgShare,
        ctx.meanDmgShare
      ) > 1.15,
      S,
      "High damage share — strong carry presence in fights."
    );
    add(
      ratio(
        p.indiv.avgDmgShare,
        ctx.meanDmgShare
      ) < 0.75,
      F,
      "Look for better DPS uptime and positioning to impact fights."
    );

    add(
      ratio(p.indiv.avgMech, ctx.meanMech) >
        1.15,
      S,
      "Mechanical Impact above team baseline — confident execution."
    );
    add(
      ratio(p.indiv.avgMech, ctx.meanMech) <
        0.85,
      F,
      "Focus on clean combos and reliability in key fights."
    );

    // Decision making
    add(
      ratio(
        p.indiv.avgTact,
        ctx.meanTact
      ) > 1.15,
      S,
      "Good Tactical Intelligence — strong decision making around plays."
    );
    add(
      ratio(
        p.indiv.avgTact,
        ctx.meanTact
      ) < 0.85,
      F,
      "Tighten decision making — when to contest, reset, or cross-map."
    );

    // Objectives & macro
    add(
      ratio(
        p.control,
        ctx.meanControl
      ) > 1.15,
      S,
      "Drives objective control — presence correlates with secured objectives."
    );
    add(
      ratio(
        p.conversion,
        ctx.meanConv
      ) > 1.15,
      S,
      "Converts advantages into objectives very well."
    );
    add(
      ratio(
        p.participation,
        ctx.meanPart
      ) < 0.85,
      F,
      "Join more setups when team plays for Dragon/Herald/Baron/Towers."
    );

    add(
      ratio(p.vision, ctx.meanVision) >
        1.15,
      S,
      "Impactful vision around objectives — enables safe, informed plays."
    );
    add(
      ratio(p.vision, ctx.meanVision) <
        0.85,
      F,
      "Improve vision control/denial near key objectives."
    );

    add(
      ratio(p.tempo, ctx.meanTempo) >
        1.15,
      S,
      "Good tempo & rotations — arrives early to important areas."
    );
    add(
      ratio(p.consistency, ctx.meanCons) >
        1.15,
      S,
      "Consistent contribution game to game."
    );
    add(
      ratio(p.consistency, ctx.meanCons) <
        0.85,
      F,
      "Reduce volatility — aim for a repeatable baseline performance."
    );

    // Discipline (deaths)
    add(
      p.indiv.deathsPg >
        ctx.meanDeaths * 1.15,
      F,
      "High deaths per game — focus on safer pathing, resets, and info usage."
    );
    add(
      p.indiv.deathsPg <
        ctx.meanDeaths * 0.85,
      S,
      "Good death discipline — rarely gives unnecessary advantages."
    );

    const uniq = (arr) => [
      ...new Set(arr),
    ];

    const strengths = uniq(S).slice(
      0,
      5
    );
    const focus = uniq(F).slice(
      0,
      5
    );

    const badge =
      p.impact >= 75
        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
        : p.impact >= 60
        ? "bg-yellow-50 text-yellow-700 border-yellow-200"
        : "bg-red-50 text-red-700 border-red-200";

    return `
      <div class="p-4 rounded-2xl border ${badge} shadow-sm">
        <div class="flex flex-wrap items-baseline justify-between gap-2 mb-2">
          <div>
            <div class="text-xs uppercase tracking-wide opacity-70">Total Player Impact</div>
            <div class="text-2xl font-semibold">
              ${p.impact.toFixed(
                0
              )}
              <span class="text-xs text-gray-500 font-normal ml-1">
                indiv: ${(p._indivComposite * 100).toFixed(
                  0
                )} • obj: ${(p._objComposite * 100).toFixed(
      0
    )}
              </span>
            </div>
          </div>
          <div class="text-xs text-gray-600">
            ${p.name} · ${p.mainRole}${
      p.isFlex
        ? " (flex)"
        : ""
    }${p.isGuest ? " · ⭐ low sample" : ""}
            <div class="text-[0.65rem] text-gray-400">
              Games: ${p.games} • Roles: ${p.roleMix}
            </div>
          </div>
        </div>

        <div class="grid sm:grid-cols-2 gap-3 mt-2 text-sm">
          <div>
            <div class="font-semibold mb-1">🔥 Strengths</div>
            ${
              strengths.length
                ? strengths
                    .map(
                      (t) =>
                        `<div class="mb-1">• ${t}</div>`
                    )
                    .join("")
                : `<div class="text-gray-500">Solid, balanced profile so far.</div>`
            }
          </div>
          <div>
            <div class="font-semibold mb-1">🎯 Focus Points</div>
            ${
              focus.length
                ? focus
                    .map(
                      (t) =>
                        `<div class="mb-1">• ${t}</div>`
                    )
                    .join("")
                : `<div class="text-gray-500">No major red flags — push existing strengths.</div>`
            }
          </div>
        </div>
      </div>
    `;
  };

  const showPlayer = (name) => {
    if (!detailEl) return;
    const p = playerStatsArr.find(
      (x) => x.name === name
    );
    if (!p) return;

    detailEl.innerHTML =
      buildPlayerDetail(p);
    detailEl.classList.remove(
      "hidden",
      "opacity-0",
      "translate-y-2"
    );
    requestAnimationFrame(() => {
      detailEl.classList.add(
        "opacity-100"
      );
    });
  };

  // row click
  document
    .querySelectorAll(
      '#objective-impact table tbody tr[data-player]'
    )
    .forEach((row) => {
      row.addEventListener("click", () => {
        const name =
          row.getAttribute(
            "data-player"
          );
        showPlayer(name);
      });
    });

  // button click
  document
    .querySelectorAll(
      ".player-select-btn"
    )
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        const name =
          btn.getAttribute(
            "data-player"
          );
        showPlayer(name);
      });
    });

  console.log(
    "⭐ Total Player Impact",
    playerStatsArr.map((p) => ({
      name: p.name,
      impact: p.impact.toFixed(1),
      games: p.games,
      guest: p.isGuest,
    }))
  );
}


// ============================================================================
// 🧩 TEAM SYNERGY & IDENTITY — v3.4
// - Signature picks per role (Top 1–3 each, with smart fallback)
// - Expanded Team Playstyle DNA
// - Objective Impact Priorities (Dragon / Herald / Baron / Tower / Atakhan / Void Grubs)
// - Tabs aligned with main dashboard (Last 5 / 10 / Current Split / Season)
// ============================================================================

let synergyTrendWindow = "season";

function renderTeamSynergy(data) {
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
    if (["SUPPORT", "SUP"].includes(r)) return "SUPPORT";
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
  const boolTrue = (v) => String(v).toUpperCase() === "TRUE";

  // --- Detect current season & split (from dataset) ---
  const seasons = [
    ...new Set(
      data.map((r) => normSeason(r["Season"])).filter(Boolean)
    ),
  ];
  const currentSeason = seasons.length
    ? seasons[seasons.length - 1]
    : null;

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
        return data.filter(
          (r) => normSplitNum(r["Split"]) === currentSplit
        );
      case "season":
      default: {
        if (!currentSeason) return data;
        return data.filter(
          (r) => normSeason(r["Season"]) === currentSeason
        );
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
      return {
        wr: teamWR,
        kda: 2,
        pr: 50,
        mech: 50,
        tact: 50,
      };
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
  // 3) Signature picks per role
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
    return bits.length ? bits.join(", ") : `reliable comfort pick for ${s.pilot}.`;
  };

  const rawSignatures = [];

  Object.entries(roleChampStats).forEach(([role, champs]) => {
    Object.entries(champs).forEach(([champ, s]) => {
      const [pilot, ps] =
        Object.entries(s.byPlayer).sort((a, b) => b[1].games - a[1].games)[0] || [];
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

      const identityScore =
        (champWr / 100) * (1 + Math.log10(ps.games + 1)) +
        Math.max(0, wrLift / 20) +
        Math.max(0, kdaLift / 3) +
        Math.max(0, prLift / 30) +
        Math.max(0, (mechLift + tactLift) / 60) +
        Math.max(0, champTc / 100);

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
      // fallback: best champ for role (min 3 games)
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
  // 4) Team Playstyle DNA (expanded)
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

  const firstFlag = (col) => ({
    win:
      winGames.length > 0
        ? (winGames.filter(
            (g) => boolTrue((g.rows[0] || {})[col])
          ).length /
            winGames.length) *
          100
        : 0,
    loss:
      lossGames.length > 0
        ? (lossGames.filter(
            (g) => boolTrue((g.rows[0] || {})[col])
          ).length /
            lossGames.length) *
          100
        : 0,
  });

  const firstDrake = hasCol("First Dragon (Team)")
    ? firstFlag("First Dragon (Team)")
    : { win: 0, loss: 0 };
  const firstHerald = hasCol("First Herald (Team)")
    ? firstFlag("First Herald (Team)")
    : { win: 0, loss: 0 };
  const firstBaron = hasCol("First Baron (Team)")
    ? firstFlag("First Baron (Team)")
    : { win: 0, loss: 0 };

  const dna = [];

  // Early game / tempo
  if (gold10.win - gold10.loss > 600 || gold15.win - gold15.loss > 1000)
    dna.push(
      "Early tempo: when you secure early gold leads, winrate spikes — drafts with early prio & skirmish tools fit your identity."
    );
  if (tempoEff.win > tempoEff.loss + 5)
    dna.push(
      "Tempo efficiency: moving first on plays is a big separator; slow first rotations hurt your style."
    );

  // Objectives & macro
  if (macroStr.win - macroStr.loss > 5)
    dna.push(
      "Macro strength: disciplined objective trading is a core win condition; avoid coin-flip fights when trades are available."
    );
  if (macroCons.win > macroCons.loss + 5)
    dna.push(
      "Low-chaos preference: structured games with clear lanes & setups favor you heavily."
    );
  if (firstDrake.win - firstDrake.loss > 25)
    dna.push(
      "Dragon control: taking first drake dramatically improves outcomes; path & lanes should respect this."
    );
  if (firstHerald.win - firstHerald.loss > 25)
    dna.push(
      "Herald leverage: when you snowball plates with Herald, your midgame becomes much easier."
    );
  if (firstBaron.win - firstBaron.loss > 25)
    dna.push(
      "Baron setups: clean vision + discipline on first Baron is a major closer — this is a defining strength when executed."
    );

  // Vision & information game
  if (visionImpact.win > visionImpact.loss + 5)
    dna.push(
      "Vision identity: higher Vision Impact in wins — lean on support/jungle that can maintain deep, safe vision."
    );
  if (visObjRatio.win > visObjRatio.loss + 0.2)
    dna.push("You convert vision into objectives efficiently — keep running set plays off vision.");
  if (visKillRatio.win > visKillRatio.loss + 0.2)
    dna.push("Vision → picks: you reliably turn info into kills when playing your game.");

  // Scaling / clutch / sync
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
  // 5) Objective Impact Priorities (Dragon / Herald / Baron / Tower / Atakhan / Void)
  // ==========================================================================

  const objectiveDefs = [
    {
      key: "dragon",
      label: "🐉 Dragon",
      first: "First Dragon (Team)",
      count: ["Dragon Kills"],
    },
    {
      key: "herald",
      label: "🪄 Herald",
      first: "First Herald (Team)",
      count: ["Herald Kills"],
    },
    {
      key: "baron",
      label: "👑 Baron",
      first: "First Baron (Team)",
      count: ["Baron Kills"],
    },
    {
      key: "tower",
      label: "🏰 Tower",
      first: "First Tower (Team)",
      count: ["Tower Kills"],
    },
    {
      key: "atakhan",
      label: "🔥 Atakhan",
      first: "First Atakhan (Team)",
      count: ["Atakhan Participation", "Atakhan Kills"],
    },
    {
      key: "void",
      label: "🪲 Void Grubs",
      first: "First Void Grub (Team)",
      count: ["Void Grub Participation", "Void Grub Kills"],
    },
  ];

  const objectiveImpacts = objectiveDefs
    .map((def) => {
      let gamesWith = 0,
        winsWith = 0,
        gamesWithout = 0,
        winsWithout = 0;

      gameList.forEach((g) => {
        const row = g.rows[0] || {};
        let has = false;

        if (def.first && hasCol(def.first) && boolTrue(row[def.first])) {
          has = true;
        }

        if (!has && def.count && def.count.length) {
          has = def.count.some(
            (col) => hasCol(col) && toNum(row[col]) > 0
          );
        }

        // if we can't detect presence, skip this game
        if (!def.first && (!def.count || !def.count.some((c) => hasCol(c)))) {
          return;
        }

        if (has) {
          gamesWith++;
          if (g.result === "Win") winsWith++;
        } else {
          gamesWithout++;
          if (g.result === "Win") winsWithout++;
        }
      });

      const total = gamesWith + gamesWithout;
      if (!total || gamesWith < 2) return null;

      const wrWith = gamesWith ? (winsWith / gamesWith) * 100 : 0;
      const wrWithout = gamesWithout ? (winsWithout / gamesWithout) * 100 : 0;
      const impact = wrWith - wrWithout;
      const control = (gamesWith / total) * 100;

      return {
        ...def,
        wrWith,
        wrWithout,
        impact,
        control,
        total,
      };
    })
    .filter(Boolean)
    .sort((a, b) => (b.impact || 0) - (a.impact || 0));

  const objectiveHTML =
    objectiveImpacts.length > 0
      ? `
      <div class="mt-3">
        <h3 class="text-xs font-semibold text-gray-800 mb-1">
          Objective Impact Priorities
        </h3>
        <div class="grid gap-1">
          ${objectiveImpacts
            .map((o, idx) => {
              const tone =
                o.impact > 8
                  ? "text-emerald-600"
                  : o.impact > 4
                  ? "text-sky-600"
                  : o.impact > 0
                  ? "text-gray-700"
                  : "text-gray-500";
              const badge =
                idx === 0
                  ? "text-[0.55rem] text-emerald-600 font-semibold"
                  : "text-[0.55rem] text-gray-400";
              return `
              <div class="px-2 py-1.5 rounded-xl bg-white border border-gray-100 flex items-center justify-between text-[0.7rem] shadow-[0_1px_4px_rgba(15,23,42,0.04)]">
                <div>
                  <div class="${badge}">
                    ${idx === 0 ? "Most impactful" : "Key factor"}
                  </div>
                  <div class="font-medium text-gray-900">
                    ${o.label}
                  </div>
                  <div class="text-[0.6rem] text-gray-500">
                    Control ${o.control.toFixed(1)}% · WR with ${
                      isNaN(o.wrWith) ? "-" : o.wrWith.toFixed(1) + "%"
                    }
                  </div>
                </div>
                <div class="text-right">
                  <div class="${tone} text-[0.7rem] font-semibold">
                    ${o.impact >= 0 ? "+" : ""}${o.impact.toFixed(1)}pp
                  </div>
                  <div class="text-[0.55rem] text-gray-500">
                    vs games without
                  </div>
                </div>
              </div>`;
            })
            .join("")}
        </div>
      </div>`
      : "";

  // ==========================================================================
  // 6) Highlight Cards (duo, bot combo, top & next signature)
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
    if (!bits.length) bits.push("reliable comfort pick profile");
    return bits.join(", ");
  };

  const bestDuo = duoArr[0];
  const mostReliableDuoHTML = bestDuo
    ? `
      <div class="p-3 rounded-2xl bg-sky-50 border border-sky-100 h-full flex flex-col justify-between">
        <div>
          <div class="text-[0.65rem] font-semibold text-sky-500 uppercase mb-1">
            Most Reliable Duo
          </div>
          <div class="text-sm font-semibold text-gray-900">
            ${bestDuo.p1} + ${bestDuo.p2}
          </div>
          <div class="text-[0.7rem] text-gray-700">
            ${bestDuo.winrate.toFixed(1)}% WR (${bestDuo.games} g),
            +${(bestDuo.winrate - teamWR).toFixed(1)}pp vs team
          </div>
          <div class="text-[0.6rem] text-gray-500 mt-0.5">
            High shared wins across many games — stable synergy core for drafts.
          </div>
        </div>
      </div>`
    : `
      <div class="p-3 rounded-2xl bg-sky-50 border border-sky-100 h-full flex items-center">
        <div class="text-[0.7rem] text-gray-500">
          Not enough repeated lineups yet to lock in a most reliable duo.
        </div>
      </div>`;

  const bestBot = botArr[0];
  const bestBotLaneComboHTML = bestBot
    ? `
      <div class="p-3 rounded-2xl bg-emerald-50 border border-emerald-100 h-full flex flex-col justify-between">
        <div>
          <div class="text-[0.65rem] font-semibold text-emerald-500 uppercase mb-1">
            Best Bot Lane Combo
          </div>
          <div class="text-sm font-semibold text-gray-900">
            ${bestBot.adc} + ${bestBot.sup}
          </div>
          <div class="text-[0.7rem] text-gray-700">
            ${bestBot.winrate.toFixed(1)}% WR (${bestBot.games} g),
            +${(bestBot.winrate - teamWR).toFixed(1)}pp vs team
          </div>
          <div class="text-[0.6rem] text-gray-500 mt-0.5">
            When drafted, this lane reliably outperforms baseline — clear identity lever.
          </div>
        </div>
      </div>`
    : `
      <div class="p-3 rounded-2xl bg-emerald-50 border border-emerald-100 h-full flex items-center">
        <div class="text-[0.7rem] text-gray-500">
          No recurring ADC+SUP combo with enough games to highlight yet.
        </div>
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
        <div class="text-[0.65rem] font-semibold text-orange-500 uppercase mb-1">
          ${sigHeader}
        </div>
        ${
          bestSig
            ? `
          <div class="text-sm font-semibold text-gray-900">
            ${bestSig.champ} ${bestSig.role}
          </div>
          <div class="text-[0.7rem] text-gray-700">
            ${bestSig.pilot} · ${bestSig.wr.toFixed(1)}% WR,
            KDA ${bestSig.kda.toFixed(2)} (${bestSig.games} g)
          </div>
          <div class="text-[0.6rem] text-gray-500 mt-0.5">
            ${
              bestSigIsSoft
                ? "High-performing option so far — volume growing; treat as premium comfort, not yet season-defining."
                : describeSigCard(bestSig)
            }
          </div>`
            : `
          <div class="text-[0.7rem] text-gray-500">
            No champion yet combines volume + overperformance enough to be a true season signature.
          </div>`
        }
      </div>
      ${
        nextBestSig
          ? `
        <div class="mt-2 pt-2 border-top border-orange-100">
          <div class="text-[0.6rem] font-semibold text-orange-500 uppercase">
            Next Best Signature
          </div>
          <div class="text-[0.7rem] text-gray-800">
            ${nextBestSig.champ} ${nextBestSig.role} · ${nextBestSig.pilot}
          </div>
          <div class="text-[0.6rem] text-gray-600">
            ${nextBestSig.wr.toFixed(1)}% WR,
            KDA ${nextBestSig.kda.toFixed(2)} (${nextBestSig.games} g)
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
  // 7) Detailed subsections
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
                <td class="py-0.5 text-right ${
                  d.lift >= 0 ? "text-emerald-600" : "text-red-500"
                }">
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
                <div class="${
                  c.lift >= 0 ? "text-emerald-600" : "text-red-500"
                }">${c.lift >= 0 ? "+" : ""}${c.lift.toFixed(1)}pp</div>
              </div>
            </div>`
            )
            .join("")}
        </div>
      </div>`
      : "";

  const roleLabel = {
    TOP: "TOP",
    JUNGLE: "JUNGLE",
    MID: "MID",
    BOTTOM: "BOTTOM",
    SUPPORT: "SUPPORT",
  };

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
                <div class="text-[0.6rem] text-gray-500">
                  Signature ${picks.length > 1 ? "Top 3" : "Pick"}
                </div>
              </div>
              <div class="grid gap-1">
                ${picks
                  .map(
                    (s) => `
                  <div class="flex justify-between gap-2">
                    <div class="font-semibold text-gray-800">${s.champ}</div>
                    <div class="text-right text-[0.65rem] text-gray-700">
                      ${s.pilot} · ${s.wr.toFixed(1)}% WR, KDA ${s.kda.toFixed(
                      2
                    )} (${s.games} g)
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
  // 8) Tabs (aligned with main dashboard controls)
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
  // Render
  // ==========================================================================

  container.innerHTML = `
    <section class="section-wrapper fade-in mb-10">
      <div class="dashboard-card bg-white shadow-sm rounded-2xl border border-gray-100">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-1">
          <div>
            <h2 class="text-[1.1rem] font-semibold text-sky-500 tracking-tight">
              Team Synergy & Identity
            </h2>
            <p class="text-[0.7rem] text-gray-600">
              Uses synergy, objective, and impact metrics to reveal who works best together,
              which picks define your style, and which levers actually drive your wins.
            </p>
          </div>
          ${trendButtons}
        </div>

        ${highlightCards}

        <div class="grid md:grid-cols-2 gap-4 mt-1">
          <div class="fade-in delay-1">
            ${duoHTML}
            ${botHTML}
            ${objectiveHTML}
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
      renderTeamSynergy(data);
    });
  });

  console.log("🧩 Team Synergy v3.4", {
    currentSeason,
    currentSplit,
    games: totalGames,
    teamWR: teamWR.toFixed(1),
    duos: duoArr,
    botCombos: botArr,
    roleSignatures,
    objectiveImpacts,
    dna,
  });
}






// --- PERFORMANCE IMPACT v4.1.0 ---
// Unified visual style with fade-in, orange-accent buttons, and no emoji titles.
// Calculations, data logic, and trend system remain 100% identical.

function renderPerformanceImpact(data) {
  if (!data || data.length === 0) return;

  const toNum = (v) => {
    if (v === undefined || v === null) return 0;
    const n = parseFloat(String(v).replace("%", "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  };

  // --- Detect active season & split dynamically ---
  const allSeasons = [...new Set(data.map((r) => r["Season"]))].filter(Boolean);
  const currentSeason = allSeasons[allSeasons.length - 1];
  const splitsInSeason = [...new Set(data.filter((r) => r["Season"] === currentSeason).map((r) => r["Split"]))];
  const currentSplit = splitsInSeason[splitsInSeason.length - 1];

  // --- Load selected view mode ---
  let trendWindow = localStorage.getItem("trendWindowPerfImpact") || "10";
  const valid = ["5", "10", "currentSplit", "season"];
  if (!valid.includes(trendWindow)) trendWindow = "10";

  // --- Filter data by window type ---
  let filtered = data.filter((r) => r["Season"] === currentSeason);
  if (trendWindow !== "season") filtered = filtered.filter((r) => r["Split"] === currentSplit);

  if (trendWindow === "5" || trendWindow === "10") {
    const nums = [...new Set(filtered.map((r) => toNum(r["Game #"])))].filter((n) => n > 0).sort((a, b) => a - b);
    const max = Math.max(...nums);
    const min = Math.max(1, max - parseInt(trendWindow) + 1);
    filtered = filtered.filter((r) => toNum(r["Game #"]) >= min && toNum(r["Game #"]) <= max);
  }

  // --- Aggregate player data ---
  const playerScores = {};
  const playerRoles = {};

  filtered.forEach((r) => {
    const name = r["Player"]?.trim();
    const role = (r["ROLE"] || "").trim().toUpperCase();
    if (!name) return;

    if (!playerScores[name])
      playerScores[name] = {
        games: new Set(),
        count: 0,
        kda: 0, teamDmg: 0, mvpAce: 0,
        objImpact: 0, objControl: 0, objConvert: 0,
        vision: 0, visAdv: 0, visDeny: 0,
        tempo: 0, macro: 0, goldMom: 0,
        synergy: 0, shared: 0, teamCoord: 0,
        mech: 0, tactical: 0
      };

    const s = playerScores[name];
    s.kda += toNum(r["KDA"]);
    s.teamDmg += toNum(r["Team Damage %"]);
    s.mvpAce += (String(r["MVP"]).toLowerCase() === "yes" ? 1 : 0) + (String(r["ACE"]).toLowerCase() === "yes" ? 1 : 0);
    s.objImpact += toNum(r["Impact"]);
    s.objControl += toNum(r["Objective Control Balance"]);
    s.objConvert += toNum(r["Objective Conversion Rate"]);
    s.vision += toNum(r["Vision Score"]);
    s.visAdv += toNum(r["Vision Advantage"]);
    s.visDeny += toNum(r["Vision Denial Efficiency"]);
    s.tempo += toNum(r["Tempo Efficiency Index"]);
    s.macro += toNum(r["Macro Consistency"]);
    s.goldMom += toNum(r["Gold Momentum Rate"]);
    s.synergy += toNum(r["Synergy Index"]);
    s.shared += toNum(r["Shared Participation Rate"]);
    s.teamCoord += toNum(r["Team Coordination Efficiency"]);
    s.mech += toNum(r["Mechanical Impact"]);
    s.tactical += toNum(r["Tactical Intelligence"]);

    s.count++;
    s.games.add(r["Game #"]);

    if (!playerRoles[name]) playerRoles[name] = {};
    if (role) playerRoles[name][role] = (playerRoles[name][role] || 0) + 1;
  });

  // --- Normalize helpers ---
  const normalize = (v, arr) => {
    const valid = arr.filter((n) => n > 0);
    if (!valid.length) return v;
    const avg = valid.reduce((a, b) => a + b, 0) / valid.length;
    return avg > 0 ? v / avg : v;
  };

  const metrics = [
    "kda","teamDmg","mvpAce","objImpact","objControl","objConvert",
    "vision","visAdv","visDeny","tempo","macro","goldMom",
    "synergy","shared","teamCoord","mech","tactical"
  ];
  const allVals = {};
  metrics.forEach((m) => { allVals[m] = Object.values(playerScores).map((p) => p[m] / (p.count || 1)); });

  // --- Determine primary role ---
  const primaryRoles = {};
  for (const [n, roles] of Object.entries(playerRoles)) {
    const sorted = Object.entries(roles).sort((a, b) => b[1] - a[1]);
    const main = sorted[0]?.[0] || "FLEX";
    primaryRoles[n] = sorted.length > 1 && sorted[1][1] / sorted[0][1] >= 0.3 ? "FLEX" : main;
  }

  // --- Compute scores ---
  const players = Object.entries(playerScores).map(([n, s]) => {
    const avg = {}; metrics.forEach((m) => (avg[m] = s[m] / (s.count || 1)));
    const weighted =
      0.3 * (normalize(avg.kda, allVals.kda) + normalize(avg.teamDmg, allVals.teamDmg) + normalize(avg.mvpAce, allVals.mvpAce)) +
      0.2 * (normalize(avg.objImpact, allVals.objImpact) + normalize(avg.objControl, allVals.objControl) + normalize(avg.objConvert, allVals.objConvert)) +
      0.15 * (normalize(avg.vision, allVals.vision) + normalize(avg.visAdv, allVals.visAdv) + normalize(avg.visDeny, allVals.visDeny)) +
      0.15 * (normalize(avg.tempo, allVals.tempo) + normalize(avg.macro, allVals.macro) + normalize(avg.goldMom, allVals.goldMom)) +
      0.1 * (normalize(avg.synergy, allVals.synergy) + normalize(avg.shared, allVals.shared) + normalize(avg.teamCoord, allVals.teamCoord)) +
      0.1 * (normalize(avg.mech, allVals.mech) + normalize(avg.tactical, allVals.tactical));
    return { name: n, avg: (weighted / 11) * 100, games: s.games.size, role: primaryRoles[n] || "FLEX", metrics: avg };
  });

  const totalGames = [...new Set(filtered.map((r) => r["Game #"]))].length || 1;
  const lastHistory = JSON.parse(localStorage.getItem("performanceImpactHistory") || "{}") || {};

  const ranked = players.map((p) => {
    const isGuest = p.games / totalGames < 0.1;
    const prev = lastHistory[p.name]?.avg ?? null;
    const delta = prev !== null ? p.avg - prev : null;
    return { ...p, isGuest, delta };
  }).sort((a, b) => {
    if (a.isGuest !== b.isGuest) return a.isGuest ? 1 : -1;
    return b.avg - a.avg;
  });

  // Save snapshot
  const snap = {}; ranked.forEach((p) => (snap[p.name] = { avg: p.avg }));
  localStorage.setItem("performanceImpactHistory", JSON.stringify(snap));

  // --- Focus & Strength analyzer ---
  const findAreas = (p, allVals, prevSnap = {}) => {
    const m = p.metrics;
    const tips = { macro: [], vision: [], synergy: [], mechanics: [] };
    const strengths = { macro: [], vision: [], synergy: [], mechanics: [] };
    let severity = 0;

    const ratio = (field) => {
      const val = m[field] ?? 0;
      const avg = allVals[field]?.reduce((a, b) => a + b, 0) / (allVals[field]?.length || 1);
      return { ratio: avg ? val / avg : 1, val, avg };
    };
    const assess = (f, cat, weak, strong, label) => {
      const { ratio: r, val, avg } = ratio(f);
      const t = `${label}: ${val.toFixed(1)} vs ${avg.toFixed(1)} avg (${(r * 100).toFixed(0)}%)`;
      if (r < 0.75) { severity += 2; tips[cat].push(`<span title="${t}">${weak}</span>`); }
      else if (r < 0.9) { severity += 1; tips[cat].push(`<span title="${t}">${weak}</span>`); }
      else if (r > 1.15) strengths[cat].push(`<span title="${t}">${strong}</span>`);
    };

    assess("objConvert","macro","Improve converting fights into objectives.","Great objective conversion.","Objective Conversion Rate");
    assess("objControl","macro","Refine control over major objectives.","Excellent objective awareness.","Objective Control Balance");
    assess("tempo","macro","Slow tempo — capitalize faster.","Efficient tempo control.","Tempo Efficiency Index");
    assess("macro","macro","Macro play inconsistent — refine rotations.","Strong macro consistency.","Macro Consistency");
    assess("visAdv","vision","Enhance ward control — vision gap detected.","Strong vision control.","Vision Advantage");
    assess("visDeny","vision","Improve vision denial — clear more wards.","Efficient vision denial.","Vision Denial Efficiency");
    assess("synergy","synergy","Low synergy — improve team coordination.","Excellent teamwork and synergy.","Synergy Index");
    assess("shared","synergy","Increase shared participation rate.","High team participation.","Shared Participation Rate");
    assess("mech","mechanics","Refine execution under pressure.","High mechanical skill.","Mechanical Impact");
    assess("tactical","mechanics","Improve tactical decision-making.","Smart tactical decisions.","Tactical Intelligence");

    let emoji="🟢", color="bg-green-50 text-green-700";
    if(severity>=4&&severity<7){emoji="🟡";color="bg-yellow-50 text-yellow-700";}
    else if(severity>=7){emoji="🔴";color="bg-red-50 text-red-700";}

    const tipsHTML=Object.entries(tips).filter(([_,a])=>a.length)
      .map(([c,a])=>`<p><strong>${c[0].toUpperCase()+c.slice(1)}:</strong> ${a.join(" ")}</p>`).join("")||"<p>Balanced overall performance.</p>";
    const strengthsHTML=Object.entries(strengths).filter(([_,a])=>a.length)
      .map(([c,a])=>`<p><strong>${c[0].toUpperCase()+c.slice(1)}:</strong> ${a.join(" ")}</p>`).join("")||"<p>—</p>";

    const prev=prevSnap[p.name]?.avg??null;
    let trend="→ stable"; if(prev!==null){if(p.avg-prev>0.8)trend="↑ improving";else if(p.avg-prev<-0.8)trend="↓ declining";}
    return {emoji,color,tipsHTML,strengthsHTML,severity,trend};
  };

  const sortedRanked=[...ranked].sort((a,b)=>findAreas(b,allVals,lastHistory).severity-findAreas(a,allVals,lastHistory).severity);

  const focusHTML=sortedRanked.map(p=>{
    const f=findAreas(p,allVals,lastHistory);
    const low=p.isGuest||p.games<3;
    const warn=low?`<span title="⚠️ Limited data — trends may be inaccurate." class="ml-1 text-orange-500">⚠️</span>`:"";
    return `<div class="${f.color} p-3 rounded-lg transition hover:shadow-sm ${low?"opacity-80":""}">
      <p class="font-semibold">${f.emoji} ${p.name}<span class="text-xs text-gray-500">
        (${p.role}${p.isGuest?", ⭐ Guest":""}, ${f.trend})</span>${warn}</p>
      <div class="text-sm mt-1 leading-snug">${f.tipsHTML}</div></div>`;
  }).join("");

  const strengthHTML=ranked.map(p=>{
    const f=findAreas(p,allVals,lastHistory);
    const low=p.isGuest||p.games<3;
    const warn=low?`<span title="⚠️ Limited data — trends may be inaccurate." class="ml-1 text-orange-500">⚠️</span>`:"";
    return `<div class="bg-emerald-50 text-emerald-700 p-3 rounded-lg transition hover:shadow-sm ${low?"opacity-80":""}">
      <p class="font-semibold">🟢 ${p.name}<span class="text-xs text-gray-500">
        (${p.role}${p.isGuest?", ⭐ Guest":""}, ${f.trend})</span>${warn}</p>
      <div class="text-sm mt-1 leading-snug">${f.strengthsHTML}</div></div>`;
  }).join("");

  // --- HTML Template (Updated Style) ---
  const html = `
    <section class="section-wrapper fade-in mb-10">
      <div class="dashboard-card bg-white shadow-sm rounded-2xl border border-gray-100 text-center">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between px-5 pt-5 mb-3">
          <h2 class="text-[1.1rem] font-semibold text-orange-500 tracking-tight">Performance Impact</h2>
          <div class="flex gap-1 text-xs font-medium">
            <button id="setWindow5" class="px-2.5 py-1 rounded-md border transition 
              ${trendWindow==="5" ? "bg-orange-500 text-white border-orange-500" : "bg-white text-gray-700 border-gray-200 hover:border-orange-300 hover:text-orange-500"}">
              5 Games
            </button>
            <button id="setWindow10" class="px-2.5 py-1 rounded-md border transition 
              ${trendWindow==="10" ? "bg-orange-500 text-white border-orange-500" : "bg-white text-gray-700 border-gray-200 hover:border-orange-300 hover:text-orange-500"}">
              10 Games
            </button>
            <button id="setCurrentSplit" class="px-2.5 py-1 rounded-md border transition 
              ${trendWindow==="currentSplit" ? "bg-orange-500 text-white border-orange-500" : "bg-white text-gray-700 border-gray-200 hover:border-orange-300 hover:text-orange-500"}">
              Current Split (${currentSplit})
            </button>
            <button id="setSeason" class="px-2.5 py-1 rounded-md border transition 
              ${trendWindow==="season" ? "bg-orange-500 text-white border-orange-500" : "bg-white text-gray-700 border-gray-200 hover:border-orange-300 hover:text-orange-500"}">
              Season ${currentSeason}
            </button>
          </div>
        </div>

        <div id="performance-content" class="p-6 text-center fade-section">
          <p class="text-sm text-gray-600 mb-4">
            Games analyzed: ${totalGames} (${trendWindow==="season"?"Season "+currentSeason:trendWindow==="currentSplit"?"Current Split ("+currentSplit+")":"Last "+trendWindow+" Games"})
          </p>

          <table class="min-w-full text-sm border-t border-gray-200 mb-6">
            <thead class="text-gray-700 font-semibold border-b">
              <tr>
                <th class="text-left py-1 w-8">#</th>
                <th class="text-left py-1">Player</th>
                <th class="text-right py-1">Score</th>
                <th class="text-right py-1">Games</th>
              </tr>
            </thead>
            <tbody>
              ${ranked.map((p,i)=>{
                const g=p.isGuest?'<span title="Guest Player" class="ml-1 text-yellow-500">⭐</span>':'';
                const d=p.delta===null?"":p.delta>0.5?`<span class="text-green-600 text-xs ml-1">▲ +${p.delta.toFixed(1)}</span>`:
                  p.delta<-0.5?`<span class="text-red-600 text-xs ml-1">▼ ${p.delta.toFixed(1)}</span>`:`<span class="text-gray-400 text-xs ml-1">•</span>`;
                return `<tr class="${p.isGuest?"opacity-75":""} ${i%2===0?"bg-gray-50":"bg-white"} hover:bg-orange-50">
                  <td class="py-1">${p.isGuest?"—":i+1}</td>
                  <td class="py-1 font-medium">${p.name}<span class="text-xs text-gray-500">(${p.role})</span>${g}</td>
                  <td class="py-1 text-right">${p.avg.toFixed(1)}${d}</td>
                  <td class="py-1 text-right">${p.games}</td></tr>`;}).join("")}
            </tbody>
          </table>

          <button id="tips-header" class="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-orange-500 transition">
            Focus Areas <span id="tips-icon" class="transition-transform">▼</span>
          </button>
          <div id="tips-box" class="grid sm:grid-cols-2 gap-3 mt-3 text-left">${focusHTML}</div>

          <button id="strengths-header" class="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-emerald-600 mt-6 transition">
            Strength Highlights <span id="strengths-icon" class="transition-transform">▼</span>
          </button>
          <div id="strengths-box" class="grid sm:grid-cols-2 gap-3 mt-3 text-left">${strengthHTML}</div>
        </div>
      </div>
    </section>`;

  document.getElementById("performance-impact").innerHTML = html;

  // --- Buttons ---
  document.getElementById("setWindow5").onclick = () => { localStorage.setItem("trendWindowPerfImpact", "5"); renderPerformanceImpact(data); };
  document.getElementById("setWindow10").onclick = () => { localStorage.setItem("trendWindowPerfImpact", "10"); renderPerformanceImpact(data); };
  document.getElementById("setCurrentSplit").onclick = () => { localStorage.setItem("trendWindowPerfImpact", "currentSplit"); renderPerformanceImpact(data); };
  document.getElementById("setSeason").onclick = () => { localStorage.setItem("trendWindowPerfImpact", "season"); renderPerformanceImpact(data); };

  // --- Collapsibles ---
  const setup = (hid, bid, iid) => {
    const h = document.getElementById(hid), b = document.getElementById(bid), ic = document.getElementById(iid);
    if (!h || !b || !ic) return;
    let o = true; b.style.overflow = "hidden";
    b.style.transition = "max-height 0.35s ease,padding 0.3s ease,opacity 0.3s ease";
    b.style.maxHeight = b.scrollHeight + "px"; b.style.opacity = "1";
    h.onclick = () => {
      if (o) { b.style.maxHeight = "0"; b.style.opacity = "0"; ic.style.transform = "rotate(-90deg)"; }
      else { b.style.maxHeight = b.scrollHeight + "px"; b.style.opacity = "1"; ic.style.transform = "rotate(0deg)"; }
      o = !o;
    };
  };
  setup("tips-header", "tips-box", "tips-icon");
  setup("strengths-header", "strengths-box", "strengths-icon");
}

// --- PLAYER TRENDS ---
function renderTrends(data) {
  const stats = calcStats(data);
  const container = document.getElementById("kda-trends");

  const players = Object.entries(stats).map(([name, s]) => {
    const getTrend = (history) => {
      if (history.length < 10) return { trend: "▶", diff: 0, avgRecent: 0 };
      const recent = history.slice(-trendWindow);
      const previous = history.slice(0, -trendWindow);
      const avgRecent = recent.reduce((a, b) => a + b, 0) / recent.length;
      const avgPrev = previous.reduce((a, b) => a + b, 0) / (previous.length || 1);
      const diff = avgRecent - avgPrev;
      return { trend: diff > 0.1 ? "▲" : diff < -0.1 ? "▼" : "▶", avgRecent };
    };

    const kdaT = getTrend(s.gameHistory);
    const kpT = s.kpHistory.length ? getTrend(s.kpHistory) : null;
    const opggT = s.opggHistory.length ? getTrend(s.opggHistory) : null;

    return { name, kdaT, kpT, opggT };
  });

  container.innerHTML = `
    <div class="bg-white shadow-lg rounded-2xl p-6 text-center mb-6">
      <h2 class="text-2xl font-bold text-orange-600 mb-4">📈 Trend</h2>
      <div class="flex justify-center mb-4 gap-3">
        <button onclick="setTrendWindow(5)" class="px-3 py-1 rounded-md text-sm font-medium ${
          trendWindow === 5 ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-700"
        }">Last 5 games</button>
        <button onclick="setTrendWindow(10)" class="px-3 py-1 rounded-md text-sm font-medium ${
          trendWindow === 10 ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-700"
        }">Last 10 games</button>
      </div>
      <div class="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
        ${players
          .map(
            (p) => `
          <div data-player-stat="${p.name}" class="rounded-xl p-3 bg-neutral-50 shadow-md">
            <h3 class="font-semibold text-lg">${p.name}</h3>
            <p class="text-sm text-gray-600">KDA: <span class="${
              p.kdaT.trend === "▲"
                ? "text-green-600"
                : p.kdaT.trend === "▼"
                ? "text-red-600"
                : "text-gray-400"
            }">${p.kdaT.trend}</span> (${p.kdaT.avgRecent?.toFixed(2) || "—"})</p>
            ${
              p.opggT
                ? `<p class="text-sm text-gray-600">OP.GG: <span class="${
                    p.opggT.trend === "▲"
                      ? "text-green-600"
                      : p.opggT.trend === "▼"
                      ? "text-red-600"
                      : "text-gray-400"
                  }">${p.opggT.trend}</span> (${p.opggT.avgRecent?.toFixed(1)})</p>`
                : ""
            }
            ${
              p.kpT
                ? `<p class="text-sm text-gray-600">KP: <span class="${
                    p.kpT.trend === "▲"
                      ? "text-green-600"
                      : p.kpT.trend === "▼"
                      ? "text-red-600"
                      : "text-gray-400"
                  }">${p.kpT.trend}</span> (${p.kpT.avgRecent?.toFixed(1)}%)</p>`
                : ""
            }
          </div>`
          )
          .join("")}
      </div>
    </div>`;
}

function setTrendWindow(n) {
  trendWindow = n;
  if (cachedRows) {
    renderTrends(cachedRows);
  } else {
    loadData();
  }
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
                <th class="text-right py-1">W%</</th>
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
