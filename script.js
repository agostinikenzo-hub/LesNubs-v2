// ✅ Les Nübs Season 25 Google Sheet (published CSV link)
const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRbb898Zhxeml0wxUIeXQk33lY3eVDqIGepE7iEiHA0KQNMQKvQWedA4WMaKUXBuhKfrPjalVb-OvD9/pub?output=csv";

let trendWindow = 10; // Default trend window

// --- Character Select Data ---
const basePlayers = [
  { name: "Betzhamo", svg: "assets/avatars/betzhamo.svg", color: "#f97316" },
  { name: "Jansen", svg: "assets/avatars/jansen.svg", color: "#3b82f6" },
  { name: "Sweeney", svg: "assets/avatars/sweeney.svg", color: "#22c55e" },
  { name: "denotes", svg: "assets/avatars/ota.svg", color: "#a855f7" },
  { name: "Burningelf", svg: "assets/avatars/achten.svg", color: "#f59e0b" },
  { name: "HH", svg: "assets/avatars/hh.svg", color: "#ef4444" },
];

let players = [...basePlayers]; // full roster including guests

// --- Helper: generate a random soft color ---
function randomPastelColor() {
  const hue = Math.floor(Math.random() * 360);
  return `hsl(${hue}, 70%, 75%)`;
}

// --- RENDER CHARACTER SELECTION ---
function renderCharacterSelect() {
  const container = document.getElementById("avatars");
  if (!container) return;

  container.innerHTML = players
    .map(
      (p) => `
      <div class="character cursor-pointer text-center" data-player="${p.name}" data-color="${p.color}">
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

  // Reset all avatars
  document.querySelectorAll(".character").forEach((el) => {
    const ring = el.querySelector("div");
    ring.style.boxShadow = "none";
    el.querySelector("p").classList.remove("text-orange-500");
  });

  // Highlight selected avatar
  const el = document.querySelector(`.character[data-player="${name}"]`);
  if (el) {
    const ring = el.querySelector("div");
    ring.style.boxShadow = `0 0 10px 3px ${color}`;
    el.querySelector("p").classList.add("text-orange-500");
  }

  // Apply consistent highlight across the dashboard
  highlightPlayerStats(name, color);
}

function highlightPlayerStats(name, color) {
  // Reset all highlights first
  document.querySelectorAll("[data-player-stat]").forEach((el) => {
    el.style.backgroundColor = "";
    el.style.boxShadow = "";
    el.style.color = "";
    el.classList.remove("ring-2", "ring-offset-1");
  });

  // Apply highlight to all matching player elements
  document.querySelectorAll(`[data-player-stat="${name}"]`).forEach((el) => {
    el.style.backgroundColor = `${color}10`; // light background tint
    el.style.boxShadow = `0 0 10px ${color}55`;
    el.classList.add("ring-2", "ring-offset-1");
    el.style.setProperty("--tw-ring-color", color);
  });
}

// --- LOAD DATA ---
async function loadData() {
  const status = document.getElementById("status");
  try {
    const res = await fetch(SHEET_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const csv = await res.text();
    const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });
    const rows = parsed.data;

    status.textContent = `✅ Loaded ${rows.length} records`;
    status.className = "text-green-600 text-sm mb-4";

    // Detect guest players
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

    const splits = {
      "Split 1": [],
      "Split 2": [],
      "Split 3": [],
      "Season 25": [],
    };
    rows.forEach((row) => {
      const split = (row["Split"] || "").trim();
      if (splits[split]) splits[split].push(row);
      splits["Season 25"].push(row);
    });

    renderSummary(splits["Season 25"]);
    renderOverview(splits["Season 25"]);
    renderTrends(splits["Season 25"]);
    renderSplits(splits);
    renderCharacterSelect();
  } catch (err) {
    console.error(err);
    status.textContent = "⚠️ Error loading data. Check Google Sheet access or format.";
    status.className = "text-red-600 text-sm mb-4";
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

    const result = (row["Result"] || "").toLowerCase().trim();
    const mvp = (row["MVP"] || "").toLowerCase().trim();
    const ace = (row["ACE"] || "").toLowerCase().trim();

    const played = kills + deaths + assists > 0;
    if (!played) return;

    const win = result === "yes" ? 1 : 0;
    const kda = deaths === 0 ? kills + assists : (kills + assists) / deaths;

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
    players[name].gameHistory.push(kda);
  });

  return players;
}

// --- RENDER SUMMARY ---
function renderSummary(data) {
  const stats = calcStats(data);
  const all = Object.values(stats);
  const totalKills = all.reduce((s, p) => s + p.kills, 0);
  const totalDeaths = all.reduce((s, p) => s + p.deaths, 0);
  const totalAssists = all.reduce((s, p) => s + p.assists, 0);
  const allGames = [...new Set(data.map((r) => r["Game #"]))];
  const totalGames = allGames.length;
  const winningGames = new Set();
  data.forEach((r) => {
    if (String(r["Result"]).toLowerCase() === "yes") winningGames.add(r["Game #"]);
  });
  const wins = winningGames.size;
  const winrate = totalGames > 0 ? ((wins / totalGames) * 100).toFixed(1) : "—";
  const avgKDA = totalDeaths > 0 ? ((totalKills + totalAssists) / totalDeaths).toFixed(2) : "∞";
  const kpValues = data
    .map((r) => parseFloat((r["Kill Part %"] || "").replace(",", ".")))
    .filter((n) => !isNaN(n));
  const avgKP = kpValues.length > 0 ? (kpValues.reduce((a, b) => a + b, 0) / kpValues.length).toFixed(1) : "0.0";
  const timeEntries = [];
  const seenGames = new Set();
  data.forEach((r) => {
    const gameNum = r["Game #"];
    const timeStr = (r["TIME"] || "").trim();
    if (!timeStr || seenGames.has(gameNum)) return;
    seenGames.add(gameNum);
    const match = timeStr.match(/(\d+)m\s*(\d+)?s?/);
    if (match) {
      const minutes = parseInt(match[1]) || 0;
      const seconds = parseInt(match[2]) || 0;
      const totalSeconds = minutes * 60 + seconds;
      timeEntries.push(totalSeconds);
    }
  });
  const validGames = timeEntries.length;
  const avgTimeSeconds = validGames > 0 ? Math.round(timeEntries.reduce((a, b) => a + b, 0) / validGames) : 0;
  const avgMinutes = Math.floor(avgTimeSeconds / 60);
  const avgSeconds = avgTimeSeconds % 60;
  const avgTimeFormatted = validGames > 0 ? `${avgMinutes}m ${avgSeconds}s` : "—";
  document.getElementById("season-summary").innerHTML = `
    <div class="bg-white shadow-lg rounded-2xl p-6 text-center mb-6">
      <h2 class="text-2xl font-bold text-orange-600 mb-4">📅 Season 25 Summary</h2>
      <div class="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        <div class="bg-orange-50 p-3 rounded-lg"><p class="text-orange-600 font-semibold text-lg">${totalGames}</p><p class="text-xs text-gray-600 uppercase tracking-wide">Games</p></div>
        <div class="bg-green-50 p-3 rounded-lg"><p class="text-green-600 font-semibold text-lg">${winrate}%</p><p class="text-xs text-gray-600 uppercase tracking-wide">Winrate</p></div>
        <div class="bg-indigo-50 p-3 rounded-lg"><p class="text-indigo-600 font-semibold text-lg">${avgKDA}</p><p class="text-xs text-gray-600 uppercase tracking-wide">Team KDA</p></div>
        <div class="bg-sky-50 p-3 rounded-lg"><p class="text-sky-600 font-semibold text-lg">${avgKP}%</p><p class="text-xs text-gray-600 uppercase tracking-wide">Avg KP</p></div>
        <div class="bg-amber-50 p-3 rounded-lg"><p class="text-amber-600 font-semibold text-lg">${avgTimeFormatted}</p><p class="text-xs text-gray-600 uppercase tracking-wide">Avg Game Time (${validGames})</p></div>
      </div>
    </div>`;
}

// --- RENDER OVERVIEW / TRENDS / SPLITS / TREND WINDOW ---
function renderOverview(data) {
  const stats = calcStats(data);
  const sorted = Object.entries(stats)
    .map(([name, s]) => ({
      name,
      kills: s.kills,
      deaths: s.deaths,
      assists: s.assists,
      avgKDA: s.deaths > 0 ? ((s.kills + s.assists) / s.deaths).toFixed(2) : (s.kills + s.assists).toFixed(2),
      games: s.games,
      winrate: s.games > 0 ? ((s.wins / s.games) * 100).toFixed(1) : "—",
      mvps: s.mvps,
      aces: s.aces,
    }))
    .sort((a, b) => b.avgKDA - a.avgKDA);
  const top = sorted.slice(0, 3);
  const rest = sorted.slice(3, 6);
  document.getElementById("season-overview").innerHTML = `
    <div class="bg-white shadow-lg rounded-2xl p-6 text-center mb-6">
      <h2 class="text-2xl font-bold text-orange-600 mb-4">🏆 Season 25 Overview</h2>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        ${top.map((p, i) => `
          <div data-player-stat="${p.name}" class="rounded-xl p-4 shadow-md bg-neutral-50 transition hover:shadow-lg">
            <h3 class="text-xl font-semibold">${["🥇","🥈","🥉"][i]} ${p.name}</h3>
            <p class="text-gray-800 font-medium">${p.avgKDA} KDA</p>
            <p class="text-gray-700 mt-1">Winrate: ${p.winrate}%</p>
          </div>`).join("")}
      </div>
    </div>`;
}

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
        ${players.map((p) => `
          <div data-player-stat="${p.name}" class="rounded-xl p-3 bg-neutral-50 shadow-md">
            <h3 class="font-semibold text-lg">${p.name}</h3>
            <p class="text-sm text-gray-600">KDA: <span class="${
              p.kdaT.trend === "▲"
                ? "text-green-600"
                : p.kdaT.trend === "▼"
                ? "text-red-600"
                : "text-gray-400"
            }">${p.kdaT.trend}</span> (${p.kdaT.avgRecent?.toFixed(2) || "—"})</p>
          </div>`).join("")}
      </div>
    </div>`;
}

function setTrendWindow(n) {
  trendWindow = n;
  loadData();
}

function renderSplits(splitsRaw) {
  const container = document.getElementById("splits");
  const allData = splitsRaw["Season 25"] || [];
  const splitGroups = { "Split 1": [], "Split 2": [], "Split 3": [] };
  allData.forEach((r) => {
    const val = String(r["Split"] || "").trim().toLowerCase();
    if (val === "1" || val === "split 1") splitGroups["Split 1"].push(r);
    else if (val === "2" || val === "split 2") splitGroups["Split 2"].push(r);
    else if (val === "3" || val === "split 3") splitGroups["Split 3"].push(r);
  });
  container.innerHTML = Object.entries(splitGroups)
    .map(([split, data]) => {
      if (!data.length)
        return `<div class="bg-white p-6 rounded-2xl shadow-md text-gray-400 text-center italic">${split} — No data yet</div>`;
      const stats = calcStats(data);
      const sorted = Object.entries(stats)
        .map(([name, s]) => ({
          name,
          avgKDA: s.deaths > 0 ? ((s.kills + s.assists) / s.deaths).toFixed(2) : (s.kills + s.assists).toFixed(2),
          games: s.games,
        }))
        .sort((a, b) => b.avgKDA - a.avgKDA);
      return `
        <div class="bg-white rounded-3xl shadow-xl p-6">
          <h3 class="text-2xl font-bold text-orange-500 mb-3">${split}</h3>
          <table class="min-w-full text-sm">
            <thead><tr><th class="text-left">Player</th><th class="text-right">KDA</th><th class="text-right">Games</th></tr></thead>
            <tbody>
              ${sorted.map((p) => `
                <tr data-player-stat="${p.name}" class="hover:bg-orange-50">
                  <td>${p.name}</td><td class="text-right">${p.avgKDA}</td><td class="text-right">${p.games}</td>
                </tr>`).join("")}
            </tbody>
          </table>
        </div>`;
    })
    .join("");
}

// --- Run everything ---
loadData();
