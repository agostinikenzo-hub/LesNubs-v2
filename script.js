// ✅ Les Nübs Season 25 Google Sheet
const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/15d-e7-S8A5p_uhAcHMaU2dCZc-csmZ7GJK9sd0iay8U/gviz/tq?tqx=out:csv";

let trendWindow = 10; // Default trend window

// --- Character Select Data ---
const players = [
  { name: "Betzhamo", svg: "assets/avatars/betzhamo.svg" },
  { name: "Jansen", svg: "assets/avatars/jansen.svg" },
  { name: "Sweeney", svg: "assets/avatars/sweeney.svg" },
  { name: "Ota", svg: "assets/avatars/ota.svg" },
  { name: "Achten", svg: "assets/avatars/achten.svg" },
  { name: "HH", svg: "assets/avatars/hh.svg" },
];

function renderCharacterSelect() {
  const container = document.getElementById("avatars");
  if (!container) return;

  container.innerHTML = players
    .map(
      (p) => `
      <div class="character relative cursor-pointer transition-transform duration-300 hover:scale-105" data-player="${p.name}">
        <div class="relative w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-md border border-gray-200">
          <img src="${p.svg}" alt="${p.name}" class="w-16 h-16 object-contain" loading="lazy"/>
          <div class="select-ring absolute inset-0 border-4 border-orange-400 rounded-full opacity-0 transition-opacity duration-200 pointer-events-none"></div>
        </div>
        <p class="mt-2 text-sm font-semibold text-gray-700">${p.name}</p>
      </div>`
    )
    .join("");

  document.querySelectorAll(".character").forEach((el) => {
    el.addEventListener("click", () => selectCharacter(el.dataset.player));
  });
}

let selectedPlayer = null;

function selectCharacter(name) {
  selectedPlayer = name;

  // Visual highlight
  document.querySelectorAll(".character").forEach((el) => el.classList.remove("selected"));
  const el = document.querySelector(`.character[data-player="${name}"]`);
  if (el) el.classList.add("selected");

  // Filter tables for selected player
  highlightPlayerStats(name);
}

function highlightPlayerStats(name) {
  const tables = document.querySelectorAll("tbody tr");
  tables.forEach((row) => {
    if (row.textContent.toLowerCase().includes(name.toLowerCase())) {
      row.classList.add("bg-orange-50");
      row.style.opacity = "1";
    } else {
      row.classList.remove("bg-orange-50");
      row.style.opacity = "0.4";
    }
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
  } catch (err) {
    console.error(err);
    status.textContent = "⚠️ Error loading data. Check Google Sheet access.";
  }
  renderCharacterSelect();
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

// --- SEASON SUMMARY (fixed winrate) ---
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

  document.getElementById("season-summary").innerHTML = `
    <div class="bg-white shadow-lg rounded-2xl p-6 text-center mb-6">
      <h2 class="text-2xl font-bold text-orange-600 mb-2">📅 Season 25 Summary</h2>
      <div class="flex flex-wrap justify-center gap-6 text-gray-700">
        <div><span class="font-semibold">${totalGames}</span> games</div>
        <div><span class="font-semibold">${winrate}%</span> winrate</div>
        <div><span class="font-semibold">${totalKills}</span> kills</div>
        <div><span class="font-semibold">${totalDeaths}</span> deaths</div>
        <div><span class="font-semibold">${totalAssists}</span> assists</div>
        <div><span class="font-semibold">${avgKDA}</span> team KDA</div>
      </div>
    </div>`;
}

// --- TOP 3 OVERVIEW ---
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
  document.getElementById("season-overview").innerHTML = `
    <div class="bg-white shadow-lg rounded-2xl p-6 text-center mb-6">
      <h2 class="text-2xl font-bold text-orange-600 mb-4">🏆 Season 25 Overview</h2>
      <p class="text-gray-700 mb-4">Top 3 Players by Season-wide KDA</p>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        ${top
          .map(
            (p, i) => `
          <div class="rounded-xl p-4 shadow-md bg-neutral-50">
            <h3 class="text-xl font-semibold">${["🥇", "🥈", "🥉"][i]} ${p.name}</h3>
            <p class="text-gray-800 font-medium">${p.avgKDA} KDA</p>
            <p class="text-gray-700 mt-1">Winrate: ${p.winrate}%</p>
            <p class="text-gray-600 text-sm">${p.kills} / ${p.deaths} / ${p.assists} total</p>
            <p class="text-gray-500 text-xs">${p.games} games | ${p.mvps} MVP | ${p.aces} ACE</p>
          </div>`
          )
          .join("")}
      </div>
    </div>`;
}

// --- TREND SECTION (KDA + OP.GG + KP) ---
function renderTrends(data) {
  const stats = calcStats(data);
  const container = document.getElementById("kda-trends");

  const players = Object.entries(stats).map(([name, s]) => {
    const getTrend = (history) => {
      if (history.length < 10) return { trend: "▶", diff: 0 };
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
          <div class="rounded-xl p-3 bg-neutral-50 shadow-md">
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

// --- SPLITS (with fixed winrate + layout) ---
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

      const stats = calcStats(data);
      const sorted = Object.entries(stats)
        .map(([name, s]) => {
          const avgKDA = s.deaths > 0 ? ((s.kills + s.assists) / s.deaths).toFixed(2) : (s.kills + s.assists).toFixed(2);
          const winrate = s.games ? ((s.wins / s.games) * 100).toFixed(1) : "—";
          const avgKP = s.kpCount ? (s.kpSum / s.kpCount).toFixed(1) : "—";
          return {
            name,
            avgKDA,
            kills: s.kills,
            deaths: s.deaths,
            assists: s.assists,
            winrate,
            games: s.games,
            mvps: s.mvps,
            aces: s.aces,
            kp: avgKP,
            trend: compareKDA(name, idx),
          };
        })
        .sort((a, b) => b.avgKDA - a.avgKDA);

      // --- WINRATE FIX ---
      const allGames = [...new Set(data.map((r) => r["Game #"]))];
      const totalGames = allGames.length;
      const winningGames = new Set();
      data.forEach((r) => {
        if (String(r["Result"]).toLowerCase() === "yes") winningGames.add(r["Game #"]);
      });
      const wins = winningGames.size;

      const totalKills = data.reduce((s, r) => s + (+r["Kills"] || 0), 0);
      const totalDeaths = data.reduce((s, r) => s + (+r["Deaths"] || 0), 0);
      const totalAssists = data.reduce((s, r) => s + (+r["Assists"] || 0), 0);
      const avgTeamKDA = totalDeaths ? ((totalKills + totalAssists) / totalDeaths).toFixed(2) : "—";
      const winrate = totalGames ? ((wins / totalGames) * 100).toFixed(1) : "—";

      const avgKP =
        data.filter((r) => r["Kill Part %"]).reduce((a, r) => a + parseFloat(r["Kill Part %"]) || 0, 0) /
        (data.filter((r) => r["Kill Part %"]).length || 1);

      const totalEntries = data.length;
      const mvps = data.filter((r) => String(r["MVP"]).toLowerCase() === "yes").length;
      const aces = data.filter((r) => String(r["ACE"]).toLowerCase() === "yes").length;
      const mvpRate = ((mvps / totalEntries) * 100).toFixed(1);
      const aceRate = ((aces / totalEntries) * 100).toFixed(1);

      return `
        <div class="bg-white rounded-3xl shadow-xl p-6 flex flex-col space-y-4 border border-slate-100 hover:shadow-2xl transition">
          <h3 class="text-2xl font-bold text-orange-500">${split}</h3>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
            <div class="bg-orange-50 p-3 rounded-lg">
              <p class="text-orange-600 font-semibold text-lg">${totalGames}</p>
              <p class="text-xs text-gray-600 uppercase tracking-wide">Games</p>
            </div>
            <div class="bg-green-50 p-3 rounded-lg">
              <p class="text-green-600 font-semibold text-lg">${winrate}%</p>
              <p class="text-xs text-gray-600 uppercase tracking-wide">Winrate</p>
            </div>
            <div class="bg-indigo-50 p-3 rounded-lg">
              <p class="text-indigo-600 font-semibold text-lg">${avgTeamKDA}</p>
              <p class="text-xs text-gray-600 uppercase tracking-wide">Team KDA</p>
            </div>
            <div class="bg-sky-50 p-3 rounded-lg">
              <p class="text-sky-600 font-semibold text-lg">${avgKP.toFixed(1)}%</p>
              <p class="text-xs text-gray-600 uppercase tracking-wide">Avg KP</p>
            </div>
          </div>
          <div class="flex justify-center gap-4 text-sm text-gray-600">
            <span>🏅 MVP Rate: <span class="text-orange-600 font-semibold">${mvpRate}%</span></span>
            <span>⚡ ACE Rate: <span class="text-indigo-600 font-semibold">${aceRate}%</span></span>
          </div>
          <div class="overflow-x-auto">
            <table class="min-w-full text-sm mt-2 border-t border-gray-100">
              <thead class="text-gray-700 font-semibold border-b">
                <tr>
                  <th class="text-left py-1">#</th>
                  <th class="text-left py-1">Player</th>
                  <th class="text-right py-1">KDA</th>
                  <th class="text-right py-1">Trend</th>
                  <th class="text-right py-1">W%</th>
                  <th class="text-right py-1">Games</th>
                  <th class="text-right py-1">K</th>
                  <th class="text-right py-1">D</th>
                  <th class="text-right py-1">A</th>
                  <th class="text-right py-1">KP%</th>
                  <th class="text-right py-1">MVP</th>
                  <th class="text-right py-1">ACE</th>
                </tr>
              </thead>
              <tbody>
                ${sorted
                  .map(
                    (p, i) => `
                    <tr class="${i % 2 === 0 ? "bg-gray-50" : "bg-white"} hover:bg-orange-50 transition">
                      <td class="py-1">${i + 1}</td>
                      <td class="py-1 font-medium">${p.name}</td>
                      <td class="py-1 text-right">${p.avgKDA}</td>
                      <td class="py-1 text-right">${p.trend}</td>
                      <td class="py-1 text-right">${p.winrate}%</td>
                      <td class="py-1 text-right">${p.games}</td>
                      <td class="py-1 text-right">${p.kills}</td>
                      <td class="py-1 text-right">${p.deaths}</td>
                      <td class="py-1 text-right">${p.assists}</td>
                      <td class="py-1 text-right">${p.kp}</td>
                      <td class="py-1 text-right">${p.mvps}</td>
                      <td class="py-1 text-right">${p.aces}</td>
                    </tr>`
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
        </div>`;
    })
    .join("");
}

loadData();
