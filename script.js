// ✅ Les Nübs Season 25 Sheet
const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/15d-e7-S8A5p_uhAcHMaU2dCZc-csmZ7GJK9sd0iay8U/gviz/tq?tqx=out:csv";

async function loadData() {
  const status = document.getElementById("status");
  try {
    const res = await fetch(SHEET_URL);
    const csv = await res.text();
    const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });
    const rows = parsed.data;

    status.textContent = `Loaded ${rows.length} records ✔`;

    // Group data by split
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
    renderKDATrends(splits["Season 25"]);
    renderSplits(splits);
  } catch (err) {
    console.error(err);
    status.textContent =
      "⚠️ Error loading data. Check sheet permissions or structure.";
  }
}

// 🧮 Calculate stats per player
function calcStats(data) {
  const players = {};

  data.forEach((row) => {
    const name = row["Player"]?.trim();
    if (!name) return;

    const kills = parseFloat((row["Kills"] || "").replace(",", ".")) || 0;
    const deaths = parseFloat((row["Deaths"] || "").replace(",", ".")) || 0;
    const assists = parseFloat((row["Assists"] || "").replace(",", ".")) || 0;
    const result = (row["Result"] || "").trim().toLowerCase();
    const mvp = (row["MVP"] || "").trim().toLowerCase();
    const ace = (row["ACE"] || "").trim().toLowerCase();

    const played = kills + deaths + assists > 0;
    if (!played) return;

    const win = result === "yes" ? 1 : 0;
    const kda = deaths === 0 ? kills + assists : (kills + assists) / deaths;

    if (!players[name])
      players[name] = {
        kills: 0,
        deaths: 0,
        assists: 0,
        games: 0,
        wins: 0,
        kdaSum: 0,
        mvps: 0,
        aces: 0,
        gameHistory: [],
      };

    players[name].kills += kills;
    players[name].deaths += deaths;
    players[name].assists += assists;
    players[name].wins += win;
    players[name].games += 1;
    players[name].kdaSum += kda;
    players[name].gameHistory.push(kda);
    if (mvp === "yes") players[name].mvps += 1;
    if (ace === "yes") players[name].aces += 1;
  });

  return players;
}

// 🆕 Season summary card
function renderSummary(data) {
  const stats = calcStats(data);
  const all = Object.values(stats);

  const totalKills = all.reduce((s, p) => s + p.kills, 0);
  const totalDeaths = all.reduce((s, p) => s + p.deaths, 0);
  const totalAssists = all.reduce((s, p) => s + p.assists, 0);

  // ✅ Unique games
  const uniqueGames = new Set(
    data.map((r) => (r["Game #"] || "").trim()).filter((g) => g && !isNaN(g))
  );
  const totalGames = uniqueGames.size;

  // ✅ Wins
  const winGames = new Set(
    data
      .filter((r) => (r["Result"] || "").toLowerCase() === "yes")
      .map((r) => (r["Game #"] || "").trim())
      .filter((g) => g && !isNaN(g))
  );

  const winrate =
    totalGames > 0 ? ((winGames.size / totalGames) * 100).toFixed(1) : "—";

  const avgTeamKDA =
    totalDeaths > 0 ? ((totalKills + totalAssists) / totalDeaths).toFixed(2) : "∞";

  const container = document.getElementById("season-summary");
  container.innerHTML = `
    <div class="bg-white shadow-lg rounded-2xl p-6 text-center mb-6">
      <h2 class="text-2xl font-bold text-orange-600 mb-2">📅 Season 25 Summary</h2>
      <div class="flex flex-wrap justify-center gap-6 text-gray-700">
        <div><span class="font-semibold">${totalGames}</span> games played</div>
        <div><span class="font-semibold">${winrate}%</span> winrate</div>
        <div><span class="font-semibold">${totalKills}</span> kills</div>
        <div><span class="font-semibold">${totalDeaths}</span> deaths</div>
        <div><span class="font-semibold">${totalAssists}</span> assists</div>
        <div><span class="font-semibold">${avgTeamKDA}</span> avg team KDA</div>
      </div>
    </div>`;
}

// 🏆 Top 3 Overview (using season-wide KDA)
function renderOverview(data) {
  const stats = calcStats(data);
  const sorted = Object.entries(stats)
    .map(([name, s]) => ({
      name,
      kills: s.kills,
      deaths: s.deaths,
      assists: s.assists,
      avgKDA:
        s.deaths > 0
          ? ((s.kills + s.assists) / s.deaths).toFixed(2)
          : (s.kills + s.assists).toFixed(2),
      games: s.games,
      winrate: s.games > 0 ? ((s.wins / s.games) * 100).toFixed(1) : "—",
      mvps: s.mvps,
      aces: s.aces,
    }))
    .sort((a, b) => b.avgKDA - a.avgKDA);

  const top = sorted.slice(0, 3);
  const container = document.getElementById("season-overview");

  container.innerHTML = `
    <div class="bg-white shadow-lg rounded-2xl p-6 text-center mb-6">
      <h2 class="text-2xl font-bold text-orange-600 mb-4">🏆 Season 25 Overview</h2>
      <p class="text-gray-700 mb-4">Top 3 Players by Season-wide KDA</p>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        ${top
          .map(
            (p, i) => `
          <div class="rounded-xl p-4 shadow-md bg-neutral-50">
            <h3 class="text-xl font-semibold">${["🥇", "🥈", "🥉"][i]} ${
              p.name
            }</h3>
            <p class="text-gray-800 font-medium">${p.avgKDA} KDA</p>
            <p class="text-gray-500 text-xs italic">(season-wide ratio)</p>
            <p class="text-gray-700 mt-1">Winrate: ${p.winrate}%</p>
            <p class="text-gray-600 text-sm">${p.kills} / ${p.deaths} / ${
              p.assists
            } total</p>
            <p class="text-gray-500 text-xs">${p.games} games | ${p.mvps} MVP | ${
              p.aces
            } ACE</p>
          </div>`
          )
          .join("")}
      </div>
    </div>`;
}

// 📈 New KDA Trend Card
function renderKDATrends(data) {
  const stats = calcStats(data);
  const container = document.getElementById("kda-trends");

  const players = Object.entries(stats).map(([name, s]) => {
    const history = s.gameHistory;
    if (history.length < 10)
      return { name, trend: "⚪ insufficient data", color: "text-gray-400" };

    const recent = history.slice(-10);
    const previous = history.slice(0, -10);

    const avgRecent =
      recent.reduce((a, b) => a + b, 0) / (recent.length || 1);
    const avgPrevious =
      previous.reduce((a, b) => a + b, 0) / (previous.length || 1);

    const diff = avgRecent - avgPrevious;
    let trend, color;

    if (diff > 0.1) {
      trend = "📈 improving";
      color = "text-green-600";
    } else if (diff < -0.1) {
      trend = "📉 declining";
      color = "text-red-600";
    } else {
      trend = "➖ stable";
      color = "text-gray-600";
    }

    return { name, trend, color, avgRecent: avgRecent.toFixed(2) };
  });

  container.innerHTML = `
    <div class="bg-white shadow-lg rounded-2xl p-6 text-center mb-6">
      <h2 class="text-2xl font-bold text-orange-600 mb-4">📊 Player KDA Trends</h2>
      <p class="text-gray-700 mb-4">Last 10 games vs previous games</p>
      <div class="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
        ${players
          .map(
            (p) => `
          <div class="rounded-xl p-3 bg-neutral-50 shadow-md">
            <h3 class="font-semibold text-lg">${p.name}</h3>
            <p class="${p.color}">${p.trend}</p>
            ${
              p.avgRecent
                ? `<p class="text-gray-600 text-sm">Last 10 avg KDA: ${p.avgRecent}</p>`
                : ""
            }
          </div>`
          )
          .join("")}
      </div>
    </div>`;
}

// 📊 Split tables
function renderSplits(splits) {
  const container = document.getElementById("splits");
  const keys = ["Split 1", "Split 2", "Split 3"];

  container.innerHTML = keys
    .map((split) => {
      const stats = calcStats(splits[split]);
      const sorted = Object.entries(stats)
        .map(([name, s]) => ({
          name,
          kills: s.kills,
          deaths: s.deaths,
          assists: s.assists,
          avgKDA:
            s.deaths > 0
              ? ((s.kills + s.assists) / s.deaths).toFixed(2)
              : (s.kills + s.assists).toFixed(2),
          games: s.games,
          winrate: s.games > 0 ? ((s.wins / s.games) * 100).toFixed(1) : "—",
          mvps: s.mvps,
          aces: s.aces,
        }))
        .sort((a, b) => b.avgKDA - a.avgKDA);

      return `
        <div class="bg-white rounded-2xl shadow-md p-4">
          <h3 class="text-xl font-bold text-orange-500 mb-2">${split}</h3>
          ${
            sorted.length > 0
              ? `<table class="min-w-full text-sm text-left">
                  <thead class="text-gray-700 border-b">
                    <tr>
                      <th class="pb-1">Player</th>
                      <th class="pb-1 text-right">KDA</th>
                      <th class="pb-1 text-right">W%</th>
                      <th class="pb-1 text-right">Kills</th>
                      <th class="pb-1 text-right">Deaths</th>
                      <th class="pb-1 text-right">Assists</th>
                      <th class="pb-1 text-right">MVP</th>
                      <th class="pb-1 text-right">ACE</th>
                      <th class="pb-1 text-right">Games</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${sorted
                      .map(
                        (p) => `
                      <tr class="border-b last:border-0">
                        <td class="py-1 font-medium">${p.name}</td>
                        <td class="py-1 text-right">${p.avgKDA}</td>
                        <td class="py-1 text-right">${p.winrate}%</td>
                        <td class="py-1 text-right">${p.kills}</td>
                        <td class="py-1 text-right">${p.deaths}</td>
                        <td class="py-1 text-right">${p.assists}</td>
                        <td class="py-1 text-right">${p.mvps}</td>
                        <td class="py-1 text-right">${p.aces}</td>
                        <td class="py-1 text-right">${p.games}</td>
                      </tr>`
                      )
                      .join("")}
                  </tbody>
                </table>`
              : `<p class="text-gray-400 italic">No data yet</p>`
          }
        </div>`;
    })
    .join("");
}

loadData();
