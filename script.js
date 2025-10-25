// ✅ Les Nübs Season 25 Google Sheet (published CSV link)
const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRbb898Zhxeml0wxUIeXQk33lY3eVDqIGepE7iEiHA0KQNMQKvQWedA4WMaKUXBuhKfrPjalVb-OvD9/pub?output=csv";

let trendWindow = 10; // Default trend window

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

// --- CHARACTER SELECTION ---
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
    const res = await fetch(SHEET_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const csv = await res.text();
    const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });
    const rows = parsed.data;

    status.textContent = `✅ Loaded ${rows.length} records`;
    status.className = "text-green-600 text-sm mb-4";

    // detect new names not in basePlayers
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

// --- SEASON SUMMARY (full original visual) ---
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


// --- OVERVIEW ---
function renderOverview(data) {
  const stats = calcStats(data);

  // Limit to main team players only
  const mainTeamNames = basePlayers.map((p) => p.name);
  const filteredStats = Object.fromEntries(
    Object.entries(stats).filter(([name]) => mainTeamNames.includes(name))
  );

  // Count games and wins only if player actually has K/D/A values
  const gamesByPlayer = {};
  const winsByPlayer = {};

  data.forEach((r) => {
    const name = r["Player"]?.trim();
    if (!name || !mainTeamNames.includes(name)) return;

    const hasParticipation =
      r["Kills"]?.trim() !== "" ||
      r["Deaths"]?.trim() !== "" ||
      r["Assists"]?.trim() !== "";

    if (!hasParticipation) return;

    gamesByPlayer[name] = (gamesByPlayer[name] || 0) + 1;
    const isWin = String(r["Result"]).toLowerCase().trim() === "yes";
    if (isWin) winsByPlayer[name] = (winsByPlayer[name] || 0) + 1;
  });

  const sorted = Object.entries(filteredStats)
    .map(([name, s]) => {
      const games = gamesByPlayer[name] || 0;
      const wins = winsByPlayer[name] || 0;
      const winrate = games > 0 ? Math.min((wins / games) * 100, 100).toFixed(1) : "—";

      return {
        name,
        kills: s.kills,
        deaths: s.deaths,
        assists: s.assists,
        avgKDA:
          s.deaths > 0
            ? ((s.kills + s.assists) / s.deaths).toFixed(2)
            : (s.kills + s.assists).toFixed(2),
        games,
        winrate,
        mvps: s.mvps,
        aces: s.aces,
      };
    })
    .sort((a, b) => b.avgKDA - a.avgKDA);

  const top = sorted.slice(0, 3);
  const rest = sorted.slice(3, 6);

  document.getElementById("season-overview").innerHTML = `
    <div class="bg-white shadow-lg rounded-2xl p-6 text-center mb-6">
      <h2 class="text-2xl font-bold text-orange-600 mb-4">🏆 Season 25 Overview</h2>
      <p class="text-gray-700 mb-4">Top Players by Season-wide KDA (Main Team)</p>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        ${top
          .map(
            (p, i) => `
          <div data-player-stat="${p.name}" class="rounded-xl p-4 shadow-md bg-neutral-50 transition hover:shadow-lg">
            <h3 class="text-xl font-semibold">${["🥇", "🥈", "🥉"][i]} ${p.name}</h3>
            <p class="text-gray-800 font-medium">${p.avgKDA} KDA</p>
            <p class="text-gray-700 mt-1">Winrate: ${p.winrate}%</p>
            <p class="text-gray-600 text-sm">${p.kills} / ${p.deaths} / ${p.assists}</p>
            <p class="text-gray-500 text-xs">${p.games} games | ${p.mvps} MVP | ${p.aces} ACE</p>
          </div>`
          )
          .join("")}
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        ${rest
          .map(
            (p) => `
          <div data-player-stat="${p.name}" class="rounded-lg p-3 bg-neutral-50 shadow-sm transition hover:shadow-md">
            <h3 class="font-semibold">${p.name}</h3>
            <p class="text-gray-800 text-sm">${p.avgKDA} KDA</p>
            <p class="text-gray-600 text-xs">${p.winrate}% winrate</p>
            <p class="text-gray-500 text-xs">${p.games} games | ${p.mvps} MVP | ${p.aces} ACE</p>
          </div>`
          )
          .join("")}
      </div>
    </div>`;
}

// --- TRENDS ---
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
  loadData();
}

// --- SPLITS ---
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

  const splitStats = {};
  for (const [split, data] of Object.entries(splitGroups)) {
    splitStats[split] = calcStats(data);
  }

  const trendSymbol = (diff) => {
    if (diff > 0.1) return `<span class="text-green-500">▲</span>`;
    if (diff < -0.1) return `<span class="text-red-500">▼</span>`;
    return `<span class="text-gray-400">▶</span>`;
  };

  const compareKDA = (name, idx) => {
    if (idx === 0) return "▶";
    const prev = splitStats[`Split ${idx}`]?.[name];
    const curr = splitStats[`Split ${idx + 1}`]?.[name];
    if (!prev || !curr) return "▶";
    const prevKDA = prev.deaths > 0 ? (prev.kills + prev.assists) / prev.deaths : 0;
    const currKDA = curr.deaths > 0 ? (curr.kills + curr.assists) / curr.deaths : 0;
    return trendSymbol(currKDA - prevKDA);
  };

  container.innerHTML = Object.entries(splitGroups)
    .map(([split, data], idx) => {
      if (!data.length)
        return `<div class="bg-white p-6 rounded-2xl shadow-md text-gray-400 text-center italic">${split} — No data yet</div>`;

      const validRows = data.filter(
        (r) =>
          r["Player"]?.trim() &&
          (r["Kills"]?.trim() || r["Deaths"]?.trim() || r["Assists"]?.trim())
      );

      const stats = calcStats(validRows);

      // --- Team winrate ---
      const allGames = [...new Set(data.map((r) => r["Game #"]))];
      const totalGames = allGames.length;
      const winningGames = new Set();
      data.forEach((r) => {
        if (String(r["Result"]).toLowerCase() === "yes") winningGames.add(r["Game #"]);
      });
      const teamWins = winningGames.size;
      const teamWinrate = totalGames > 0 ? ((teamWins / totalGames) * 100).toFixed(1) : "—";

      // --- Individual winrate / participation ---
      const playerGameCount = {};
      const playerWinCount = {};
      validRows.forEach((r) => {
        const name = r["Player"]?.trim();
        if (!name) return;
        const result = String(r["Result"]).toLowerCase().trim();
        const isWin = result === "yes";
        playerGameCount[name] = (playerGameCount[name] || 0) + 1;
        if (isWin) playerWinCount[name] = (playerWinCount[name] || 0) + 1;
      });

      const guestNames = players.filter((p) => p.guest).map((p) => p.name);

      // --- Build player stats ---
      let playerStats = Object.entries(stats)
        .map(([name, s]) => {
          const games = playerGameCount[name] || 0;
          const wins = playerWinCount[name] || 0;
          const winrate = games > 0 ? ((wins / games) * 100).toFixed(1) : "—";
          const avgKDA =
            s.deaths > 0
              ? ((s.kills + s.assists) / s.deaths).toFixed(2)
              : (s.kills + s.assists).toFixed(2);
          const avgKP = s.kpCount ? (s.kpSum / s.kpCount).toFixed(1) : "—";
          const trend = compareKDA(name, idx);

          return {
            name,
            games,
            winrate,
            avgKDA,
            kills: s.kills,
            deaths: s.deaths,
            assists: s.assists,
            mvps: s.mvps,
            aces: s.aces,
            kp: avgKP,
            trend,
            isGuest: guestNames.includes(name),
          };
        })
        .sort((a, b) => b.avgKDA - a.avgKDA);

      // Split main team and guests
      const mainPlayers = playerStats.filter((p) => !p.isGuest);
      const guestPlayers = playerStats.filter((p) => p.isGuest);

      const totalKills = validRows.reduce((s, r) => s + (+r["Kills"] || 0), 0);
      const totalDeaths = validRows.reduce((s, r) => s + (+r["Deaths"] || 0), 0);
      const totalAssists = validRows.reduce((s, r) => s + (+r["Assists"] || 0), 0);
      const avgTeamKDA = totalDeaths
        ? ((totalKills + totalAssists) / totalDeaths).toFixed(2)
        : "—";

      const avgKP =
        validRows.filter((r) => r["Kill Part %"]).reduce(
          (a, r) => a + (parseFloat(r["Kill Part %"]) || 0),
          0
        ) / (validRows.filter((r) => r["Kill Part %"]).length || 1);

      const mvps = validRows.filter((r) => String(r["MVP"]).toLowerCase() === "yes").length;
      const aces = validRows.filter((r) => String(r["ACE"]).toLowerCase() === "yes").length;
      const totalEntries = validRows.length;
      const mvpRate = totalEntries ? ((mvps / totalEntries) * 100).toFixed(1) : "—";
      const aceRate = totalEntries ? ((aces / totalEntries) * 100).toFixed(1) : "—";

      const mostImproved = mainPlayers[0]?.name || "—";

      return `
        <div class="bg-white rounded-3xl shadow-xl p-6 flex flex-col space-y-4 border border-slate-100 hover:shadow-2xl transition">
          <div class="flex flex-wrap justify-between items-center mb-2">
            <h3 class="text-2xl font-bold text-orange-500">${split}</h3>
            <p class="text-sm text-gray-500">Team Summary</p>
          </div>

          <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-center mb-2">
            <div class="bg-orange-50 p-3 rounded-lg">
              <p class="text-orange-600 font-semibold text-lg">${totalGames}</p>
              <p class="text-xs text-gray-600 uppercase">Games</p>
            </div>
            <div class="bg-green-50 p-3 rounded-lg">
              <p class="text-green-600 font-semibold text-lg">${teamWinrate}%</p>
              <p class="text-xs text-gray-600 uppercase">Team Winrate</p>
            </div>
            <div class="bg-indigo-50 p-3 rounded-lg">
              <p class="text-indigo-600 font-semibold text-lg">${avgTeamKDA}</p>
              <p class="text-xs text-gray-600 uppercase">Team KDA</p>
            </div>
            <div class="bg-sky-50 p-3 rounded-lg">
              <p class="text-sky-600 font-semibold text-lg">${avgKP.toFixed(1)}%</p>
              <p class="text-xs text-gray-600 uppercase">Avg KP</p>
            </div>
          </div>

          <div class="mt-2">
            <table class="min-w-full text-sm border-t border-gray-100">
              <thead class="text-gray-700 font-semibold border-b">
                <tr>
                  <th class="text-left py-1 w-8">#</th>
                  <th class="text-left py-1">Player</th>
                  <th class="text-right py-1">KDA</th>
                  <th class="text-right py-1">Trend</th>
                  <th class="text-right py-1">W%</th>
                  <th class="text-right py-1">Games</th>
                </tr>
              </thead>
              <tbody>
                ${[...mainPlayers, ...guestPlayers]
                  .map((p, i) => {
                    const rank = p.isGuest ? "–" : i + 1;
                    const nameCell = p.isGuest
                      ? `${p.name} <span class="text-gray-400">⭐</span>`
                      : p.name;
                    return `
                      <tr data-player-stat="${p.name}" class="${
                        i % 2 === 0 ? "bg-gray-50" : "bg-white"
                      } hover:bg-orange-50 transition">
                        <td class="py-1 text-gray-700">${rank}</td>
                        <td class="py-1 font-medium">${nameCell}</td>
                        <td class="py-1 text-right">${p.avgKDA}</td>
                        <td class="py-1 text-right">${p.trend}</td>
                        <td class="py-1 text-right">${p.winrate}%</td>
                        <td class="py-1 text-right">${p.games}</td>
                      </tr>`;
                  })
                  .join("")}
              </tbody>
            </table>
          </div>

          <!-- Bottom Info Row -->
<div class="border-t border-gray-200 pt-3 text-sm text-gray-600 flex flex-col gap-1 mt-3">

  <div class="flex flex-wrap justify-between items-center">
    <p>💥 <span class="font-semibold">Total K/D/A:</span> ${totalKills}/${totalDeaths}/${totalAssists}</p>
    <p>📈 <span class="font-semibold text-green-600">Most Improved:</span> ${mostImproved}</p>
  </div>

  <!-- MVPs & ACEs Top 3 -->
  <div class="flex flex-col sm:flex-row justify-between mt-1 gap-2">
    <div>
      <p class="font-semibold text-orange-600 mb-1">🏅 Top 3 MVPs</p>
      <ul class="text-gray-700 list-none pl-0">
        ${playerStats
          .sort((a, b) => b.mvps - a.mvps)
          .slice(0, 3)
          .map(
            (p, i) => `
            <li>
              <span class="mr-1 text-sm">${["🥇", "🥈", "🥉"][i] || "•"}</span>
              ${p.name} <span class="text-gray-500">(${p.mvps})</span>
            </li>`
          )
          .join("")}
      </ul>
    </div>

    <div>
      <p class="font-semibold text-indigo-600 mb-1">⚡ Top 3 ACEs</p>
      <ul class="text-gray-700 list-none pl-0">
        ${playerStats
          .sort((a, b) => b.aces - a.aces)
          .slice(0, 3)
          .map(
            (p, i) => `
            <li>
              <span class="mr-1 text-sm">${["🥇", "🥈", "🥉"][i] || "•"}</span>
              ${p.name} <span class="text-gray-500">(${p.aces})</span>
            </li>`
          )
          .join("")}
      </ul>
    </div>
  </div>
</div>

        </div>`;
    })
    .join("");
}
// ✅ Les Nübs Season 25 Google Sheet (Published CSV link)
const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRbb898Zhxeml0wxUIeXQk33lY3eVDqIGepE7iEiHA0KQNMQKvQWedA4WMaKUXBuhKfrPjalVb-OvD9/pub?output=csv";

let trendWindow = 10;

// --- Character Select Data ---
const players = [
  { name: "Betzhamo", svg: "assets/avatars/betzhamo.svg", color: "#f97316" },
  { name: "Jansen", svg: "assets/avatars/jansen.svg", color: "#3b82f6" },
  { name: "Sweeney", svg: "assets/avatars/sweeney.svg", color: "#22c55e" },
  { name: "denotes", svg: "assets/avatars/ota.svg", color: "#a855f7" },
  { name: "Burningelf", svg: "assets/avatars/achten.svg", color: "#f59e0b" },
  { name: "HH", svg: "assets/avatars/hh.svg", color: "#ef4444" },
];

// --- RENDER CHARACTER SELECTION ---
function renderCharacterSelect() {
  const container = document.getElementById("avatars");
  if (!container) return;

  container.innerHTML = players
    .map(
      (p) => `
      <div class="character cursor-pointer text-center" data-player="${p.name}" data-color="${p.color}">
        <div class="relative w-20 h-20 mx-auto rounded-full bg-white shadow border border-gray-200 flex items-center justify-center transition-transform hover:scale-105">
          <img src="${p.svg}" alt="${p.name}" class="w-12 h-12 object-contain" loading="lazy" />
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
    const res = await fetch(SHEET_URL);
    const csv = await res.text();
    const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });
    const rows = parsed.data;

    status.textContent = `Loaded ${rows.length} records ✔`;

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
    renderAnalyticsDesk(splits["Season 25"]);
  } catch (err) {
    console.error(err);
    status.textContent = "⚠️ Error loading data. Check Google Sheet access or format.";
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

// --- (Existing renderSummary, renderOverview, renderTrends, renderSplits) ---
// Keep your original functions here — unchanged from your current working version.

// 🧠 --- THE ANALYTICS DESK ---
function renderAnalyticsDesk(data) {
  const container = document.createElement("div");
  container.className =
    "bg-white rounded-3xl shadow-xl p-6 mt-6 border border-slate-100 hover:shadow-2xl transition";
  container.id = "analytics-desk";

  container.innerHTML = `
    <h2 class="text-2xl font-bold text-orange-600 mb-2">🧠 The Analytics Desk</h2>
    <p class="text-gray-600 mb-4 text-sm">Explore deeper insights into performance and vision.</p>

    <div class="flex flex-wrap justify-center gap-2 mb-4">
      <button id="btn-vision-impact" class="px-3 py-1 text-sm rounded-md bg-orange-500 text-white font-medium">🎯 Vision Impact</button>
      <button id="btn-top-vision" class="px-3 py-1 text-sm rounded-md bg-gray-100 text-gray-700 font-medium hover:bg-gray-200">👁️ Top Vision Players</button>
      <button id="btn-role" class="px-3 py-1 text-sm rounded-md bg-gray-100 text-gray-700 font-medium hover:bg-gray-200">🗺️ Role Contribution</button>
    </div>

    <div id="analytics-content" class="text-center text-gray-700 text-sm"></div>
  `;

  document.getElementById("sheet-container").appendChild(container);
  const contentEl = container.querySelector("#analytics-content");

  const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

  // --- VISION IMPACT ---
  function showVisionImpact() {
    const wins = data.filter((r) => String(r["Result"]).toLowerCase() === "yes");
    const losses = data.filter((r) => String(r["Result"]).toLowerCase() === "no");
    const parse = (r) => ({
      pink: +r["Pink"] || 0,
      wards: +r["Wards"] || 0,
      killed: +r["Wards Killed"] || 0,
    });

    const winStats = wins.map(parse);
    const lossStats = losses.map(parse);

    const winAvg = {
      pink: avg(winStats.map((x) => x.pink)),
      wards: avg(winStats.map((x) => x.wards)),
      killed: avg(winStats.map((x) => x.killed)),
    };
    const lossAvg = {
      pink: avg(lossStats.map((x) => x.pink)),
      wards: avg(lossStats.map((x) => x.wards)),
      killed: avg(lossStats.map((x) => x.killed)),
    };

    contentEl.innerHTML = `
      <h3 class="text-lg font-semibold text-orange-500 mb-2">🎯 Vision Impact (Wins vs Losses)</h3>
      <div class="grid grid-cols-3 gap-2 text-center">
        <div><p class="font-semibold text-green-600">${winAvg.pink.toFixed(1)}</p><p class="text-xs text-gray-500">Pink Wards (Wins)</p></div>
        <div><p class="font-semibold text-green-600">${winAvg.wards.toFixed(1)}</p><p class="text-xs text-gray-500">Wards Placed (Wins)</p></div>
        <div><p class="font-semibold text-green-600">${winAvg.killed.toFixed(1)}</p><p class="text-xs text-gray-500">Wards Killed (Wins)</p></div>
      </div>
      <div class="grid grid-cols-3 gap-2 text-center mt-2">
        <div><p class="font-semibold text-red-600">${lossAvg.pink.toFixed(1)}</p><p class="text-xs text-gray-500">Pink Wards (Losses)</p></div>
        <div><p class="font-semibold text-red-600">${lossAvg.wards.toFixed(1)}</p><p class="text-xs text-gray-500">Wards Placed (Losses)</p></div>
        <div><p class="font-semibold text-red-600">${lossAvg.killed.toFixed(1)}</p><p class="text-xs text-gray-500">Wards Killed (Losses)</p></div>
      </div>
      <p class="mt-3 text-gray-600 italic">In wins, the team averages ${(avg(Object.values(winAvg)) / (avg(Object.values(lossAvg)) || 1) * 100 - 100).toFixed(1)}% more vision activity overall.</p>
    `;
  }

  // --- TOP VISION PLAYERS ---
  function showTopVision() {
    const players = {};
    data.forEach((r) => {
      const name = r["Player"]?.trim();
      if (!name) return;
      const pink = +r["Pink"] || 0;
      const wards = +r["Wards"] || 0;
      const killed = +r["Wards Killed"] || 0;
      if (!players[name]) players[name] = { pink: 0, wards: 0, killed: 0, games: 0 };
      players[name].pink += pink;
      players[name].wards += wards;
      players[name].killed += killed;
      players[name].games++;
    });
    const sorted = Object.entries(players)
      .map(([n, v]) => ({ name: n, score: (v.pink + v.wards + v.killed) / v.games }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    contentEl.innerHTML = `
      <h3 class="text-lg font-semibold text-orange-500 mb-2">👁️ Top Vision Players</h3>
      <ul class="list-none text-center">
        ${sorted
          .map(
            (p, i) =>
              `<li class="py-1">${["🥇", "🥈", "🥉"][i]} ${p.name} — <span class="font-semibold text-gray-800">${p.score.toFixed(
                1
              )}</span></li>`
          )
          .join("")}
      </ul>
    `;
  }

  // --- ROLE CONTRIBUTION ---
  function showRole() {
    const roles = {};
    const normalizeRole = (raw) => {
      const r = (raw || "").trim().toLowerCase();
      if (["supp", "support", "sup"].includes(r)) return "Support";
      if (["jgl", "jungle"].includes(r)) return "Jungle";
      if (["mid", "middle"].includes(r)) return "Mid";
      if (["adc", "bot", "carry"].includes(r)) return "ADC";
      if (["top", "topp"].includes(r)) return "Top";
      return "Unknown";
    };

    data.forEach((r) => {
      const role = normalizeRole(r["Role"]);
      if (role === "Unknown") return;

      const pink = +r["Pink"] || 0;
      const wards = +r["Wards"] || 0;
      const killed = +r["Wards Killed"] || 0;
      if (!roles[role]) roles[role] = { pink: 0, wards: 0, killed: 0, games: 0 };
      roles[role].pink += pink;
      roles[role].wards += wards;
      roles[role].killed += killed;
      roles[role].games++;
    });

    const arr = Object.entries(roles)
      .map(([role, v]) => ({
        role,
        avg: (v.pink + v.wards + v.killed) / v.games,
      }))
      .sort((a, b) => b.avg - a.avg);

    const total = arr.reduce((s, r) => s + r.avg, 0);

    contentEl.innerHTML = `
      <h3 class="text-lg font-semibold text-orange-500 mb-2">🗺️ Role Contribution</h3>
      <table class="min-w-full text-sm mx-auto">
        <thead class="border-b font-semibold text-gray-600">
          <tr>
            <th class="text-left py-1 px-2">Role</th>
            <th class="text-right py-1 px-2">Avg Vision</th>
            <th class="text-right py-1 px-2">% of Total</th>
          </tr>
        </thead>
        <tbody>
          ${arr
            .map(
              (r) => `
            <tr class="border-b">
              <td class="py-1 px-2">${r.role}</td>
              <td class="py-1 px-2 text-right">${r.avg.toFixed(1)}</td>
              <td class="py-1 px-2 text-right">${(
                (r.avg / total) *
                100
              ).toFixed(1)}%</td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>
    `;
  }

  // --- Button Logic ---
  const buttons = {
    "btn-vision-impact": showVisionImpact,
    "btn-top-vision": showTopVision,
    "btn-role": showRole,
  };

  Object.entries(buttons).forEach(([id, fn]) => {
    document.getElementById(id).addEventListener("click", (e) => {
      container.querySelectorAll("button").forEach((b) => {
        b.classList.remove("bg-orange-500", "text-white");
        b.classList.add("bg-gray-100", "text-gray-700");
      });
      e.target.classList.remove("bg-gray-100", "text-gray-700");
      e.target.classList.add("bg-orange-500", "text-white");
      fn();
    });
  });

  showVisionImpact(); // default view
}

// --- Initialize everything ---
loadData();

