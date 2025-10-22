// ✅ Les Nübs Season 25 Google Sheet
const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/15d-e7-S8A5p_uhAcHMaU2dCZc-csmZ7GJK9sd0iay8U/gviz/tq?tqx=out:csv";

let trendWindow = 10; // Default trend window (10 games)

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
    renderKDATrends(splits["Season 25"]);
    renderSplits(splits);
  } catch (err) {
    console.error(err);
    status.textContent = "⚠️ Error loading data. Check Google Sheet access.";
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
    const result = (row["Result"] || "").toLowerCase().trim();
    const mvp = (row["MVP"] || "").toLowerCase().trim();
    const ace = (row["ACE"] || "").toLowerCase().trim();
    const kp = parseFloat((row["Kill Part %"] || "").replace(",", ".")) || null;

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
        gameHistory: [],
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
    }
    players[name].gameHistory.push(kda);
  });

  return players;
}

// --- SEASON SUMMARY ---
function renderSummary(data) {
  const stats = calcStats(data);
  const all = Object.values(stats);
  const totalKills = all.reduce((s, p) => s + p.kills, 0);
  const totalDeaths = all.reduce((s, p) => s + p.deaths, 0);
  const totalAssists = all.reduce((s, p) => s + p.assists, 0);

  const games = new Set(data.map((r) => r["Game #"])).size;
  const wins = data.filter((r) => (r["Result"] || "").toLowerCase() === "yes").length / 5; // per game

  const winrate = games > 0 ? ((wins / games) * 100).toFixed(1) : "—";
  const avgKDA = totalDeaths > 0 ? ((totalKills + totalAssists) / totalDeaths).toFixed(2) : "∞";

  document.getElementById("season-summary").innerHTML = `
    <div class="bg-white shadow-lg rounded-2xl p-6 text-center mb-6">
      <h2 class="text-2xl font-bold text-orange-600 mb-2">📅 Season 25 Summary</h2>
      <div class="flex flex-wrap justify-center gap-6 text-gray-700">
        <div><span class="font-semibold">${games}</span> games</div>
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
            <p class="text-gray-500 text-xs italic">(season-wide ratio)</p>
            <p class="text-gray-700 mt-1">Winrate: ${p.winrate}%</p>
            <p class="text-gray-600 text-sm">${p.kills} / ${p.deaths} / ${p.assists} total</p>
            <p class="text-gray-500 text-xs">${p.games} games | ${p.mvps} MVP | ${p.aces} ACE</p>
          </div>`
          )
          .join("")}
      </div>
    </div>`;
}

// --- INTERACTIVE KDA TREND CARD ---
function renderKDATrends(data) {
  const stats = calcStats(data);
  const container = document.getElementById("kda-trends");

  const players = Object.entries(stats).map(([name, s]) => {
    const history = s.gameHistory;
    if (history.length < 10)
      return { name, trend: "⚪ insufficient data", color: "text-gray-400" };

    const recent = history.slice(-trendWindow);
    const previous = history.slice(0, -trendWindow);
    const avgRecent = recent.reduce((a, b) => a + b, 0) / recent.length;
    const avgPrev = previous.reduce((a, b) => a + b, 0) / (previous.length || 1);
    const diff = avgRecent - avgPrev;

    let trend, color;
    if (diff > 0.1) (trend = "📈 improving"), (color = "text-green-600");
    else if (diff < -0.1) (trend = "📉 declining"), (color = "text-red-600");
    else (trend = "➖ stable"), (color = "text-gray-600");

    return { name, trend, color, avgRecent: avgRecent.toFixed(2) };
  });

  container.innerHTML = `
    <div class="bg-white shadow-lg rounded-2xl p-6 text-center mb-6 transition-opacity duration-300">
      <h2 class="text-2xl font-bold text-orange-600 mb-4">📊 Player KDA Trends</h2>
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
            <p class="${p.color}">${p.trend}</p>
            ${
              p.avgRecent
                ? `<p class="text-gray-600 text-sm">Last ${trendWindow} avg KDA: ${p.avgRecent}</p>`
                : ""
            }
          </div>`
          )
          .join("")}
      </div>
    </div>`;
}

// toggle
function setTrendWindow(n) {
  trendWindow = n;
  loadData();
}

function renderSplits(splitsRaw) {
  const container = document.getElementById("splits");
  const allData = splitsRaw["Season 25"] || [];

  // --- Group data by Split ---
  const splitGroups = { "Split 1": [], "Split 2": [], "Split 3": [] };
  allData.forEach((row) => {
    const val = String(row["Split"] || "").trim().toLowerCase();
    if (val === "1" || val === "split 1") splitGroups["Split 1"].push(row);
    else if (val === "2" || val === "split 2") splitGroups["Split 2"].push(row);
    else if (val === "3" || val === "split 3") splitGroups["Split 3"].push(row);
  });

  // --- Compute stats per split ---
  const splitStats = {};
  for (const [split, data] of Object.entries(splitGroups)) {
    splitStats[split] = calcStats(data);
  }

  // --- Helper: compare KDA for trend ---
  function getTrend(player, splitIndex) {
    if (splitIndex === 0) return "→";
    const prevSplit = `Split ${splitIndex}`;
    const currSplit = `Split ${splitIndex + 1}`;
    const prevStats = splitStats[prevSplit]?.[player];
    const currStats = splitStats[currSplit]?.[player];
    if (!prevStats || !currStats) return "→";
    const prevKDA =
      prevStats.deaths > 0
        ? (prevStats.kills + prevStats.assists) / prevStats.deaths
        : 0;
    const currKDA =
      currStats.deaths > 0
        ? (currStats.kills + currStats.assists) / currStats.deaths
        : 0;
    if (currKDA > prevKDA + 0.1) return "▲";
    if (currKDA < prevKDA - 0.1) return "▼";
    return "▶";
  }

  // --- Render all splits ---
  container.innerHTML = Object.entries(splitGroups)
    .map(([split, data], idx) => {
      if (data.length === 0)
        return `<div class="bg-white rounded-2xl shadow-md p-6 flex items-center justify-center text-gray-400 italic">${split} — No data yet</div>`;

      const stats = calcStats(data);
      const sorted = Object.entries(stats)
        .map(([name, s]) => {
          const kda =
            s.deaths > 0
              ? ((s.kills + s.assists) / s.deaths).toFixed(2)
              : (s.kills + s.assists).toFixed(2);
          const avgOPGG =
            s.opggCount > 0 ? (s.opggSum / s.opggCount).toFixed(1) : "—";
          return {
            name,
            kills: s.kills,
            deaths: s.deaths,
            assists: s.assists,
            avgKDA: kda,
            games: s.games,
            winrate: s.games > 0 ? ((s.wins / s.games) * 100).toFixed(1) : "—",
            mvps: s.mvps,
            aces: s.aces,
            kp: s.kpCount > 0 ? (s.kpSum / s.kpCount).toFixed(1) + "%" : "—",
            trend: getTrend(name, idx),
            opgg: avgOPGG,
          };
        })
        .sort((a, b) => b.avgKDA - a.avgKDA);

      // --- Split summary mini cards ---
      const totalGames = [...new Set(data.map((r) => r["Game #"]))].length;
      const wins = data.filter(
        (r) => String(r["Result"]).toLowerCase() === "yes"
      ).length;
      const totalKills = data.reduce(
        (sum, r) => sum + (parseInt(r["Kills"]) || 0),
        0
      );
      const totalDeaths = data.reduce(
        (sum, r) => sum + (parseInt(r["Deaths"]) || 0),
        0
      );
      const totalAssists = data.reduce(
        (sum, r) => sum + (parseInt(r["Assists"]) || 0),
        0
      );
      const avgTeamKDA =
        totalDeaths > 0
          ? ((totalKills + totalAssists) / totalDeaths).toFixed(2)
          : "—";
      const winrate =
        totalGames > 0 ? ((wins / totalGames) * 100).toFixed(1) : "—";

      return `
        <div class="bg-white rounded-2xl shadow-lg p-5 flex flex-col space-y-4">
          <h3 class="text-2xl font-bold text-orange-500 mb-1">${split}</h3>

          <!-- Mini Summary Cards -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div class="bg-orange-100 rounded-lg p-3 text-center text-orange-700 font-medium">
              🎮 <div class="text-lg font-bold">${totalGames}</div>
              <div class="text-sm">Games Played</div>
            </div>
            <div class="bg-green-100 rounded-lg p-3 text-center text-green-700 font-medium">
              ⚔️ <div class="text-lg font-bold">${totalKills} / ${totalDeaths} / ${totalAssists}</div>
              <div class="text-sm">Total K / D / A</div>
            </div>
            <div class="bg-indigo-100 rounded-lg p-3 text-center text-indigo-700 font-medium">
              📊 <div class="text-lg font-bold">${avgTeamKDA}</div>
              <div class="text-sm">${winrate}% Winrate</div>
            </div>
          </div>

          <!-- Player Table -->
          <div class="overflow-x-auto mt-3">
            <table class="min-w-full text-sm text-left">
              <thead class="text-gray-700 border-b font-semibold">
                <tr>
                  <th>#</th>
                  <th>Player</th>
                  <th class="text-right">KDA</th>
                  <th class="text-right">Trend</th>
                  <th class="text-right">W%</th>
                  <th class="text-right">Games</th>
                  <th class="text-right">K</th>
                  <th class="text-right">D</th>
                  <th class="text-right">A</th>
                  <th class="text-right">KP</th>
                  <th class="text-right">MVP</th>
                  <th class="text-right">ACE</th>
                  <th class="text-right">OP.GG</th>
                </tr>
              </thead>
              <tbody>
                ${sorted
                  .map((p, i) => {
                    let trendColor =
                      p.trend === "▲"
                        ? "text-green-600"
                        : p.trend === "▼"
                        ? "text-red-500"
                        : "text-gray-400";
                    return `
                    <tr class="${i % 2 === 0 ? "bg-gray-50" : "bg-white"}">
                      <td>${i + 1}</td>
                      <td class="font-medium">${p.name}</td>
                      <td class="text-right">${p.avgKDA}</td>
                      <td class="text-right ${trendColor}">${p.trend}</td>
                      <td class="text-right">${p.winrate}%</td>
                      <td class="text-right">${p.games}</td>
                      <td class="text-right">${p.kills}</td>
                      <td class="text-right">${p.deaths}</td>
                      <td class="text-right">${p.assists}</td>
                      <td class="text-right">${p.kp}</td>
                      <td class="text-right">${p.mvps}</td>
                      <td class="text-right">${p.aces}</td>
                      <td class="text-right">${p.opgg}</td>
                    </tr>`;
                  })
                  .join("")}
              </tbody>
            </table>
          </div>
        </div>`;
    })
    .join("");
}
loadData();
