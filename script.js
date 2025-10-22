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
    const splits = { "Split 1": [], "Split 2": [], "Split 3": [], "Season 25": [] };
    rows.forEach((row) => {
      const split = (row["Split"] || "").trim();
      if (splits[split]) splits[split].push(row);
      splits["Season 25"].push(row);
    });

    renderSummary(splits["Season 25"]);
    renderOverview(splits["Season 25"]);
    renderSplits(splits);
  } catch (err) {
    console.error(err);
    status.textContent = "⚠️ Error loading data. Check sheet permissions or structure.";
  }
}

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
      };

    players[name].kills += kills;
    players[name].deaths += deaths;
    players[name].assists += assists;
    players[name].wins += win;
    players[name].games += 1;
    players[name].kdaSum += kda;
    if (mvp === "yes") players[name].mvps += 1;
    if (ace === "yes") players[name].aces += 1;
  });

  return players;
}

// 🆕 Global team summary (top card)
function renderSummary(data) {
  const stats = calcStats(data);
  const all = Object.values(stats);

  const totalKills = all.reduce((s, p) => s + p.kills, 0);
  const totalDeaths = all.reduce((s, p) => s + p.deaths, 0);
  const totalAssists = all.reduce((s, p) => s + p.assists, 0);
  const totalGames = all.reduce((s, p) => s + p.games, 0) / 6; // 6 players per game
  const totalWins = all.reduce((s, p) => s + p.wins, 0) / 6;
  const winrate = totalGames > 0 ? ((totalWins / totalGames) * 100).toFixed(1) : "—";
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

function renderOverview(data) {
  const stats = calcStats(data);
  const sorted = Object.entries(stats)
    .map(([name, s]) => ({
      name,
      kills: s.kills,
      deaths: s.deaths,
      assists: s.assists,
      avgKDA: (s.kdaSum / s.games).toFixed(2),
      games: s.games,
      winrate: s.games > 0 ? ((s.wins / s.games) * 100).toFixed(1) : "—",
      mvps: s.mvps,
      aces: s.aces,
    }))
    .sort((a, b) => b.avgKDA - a.avgKDA);

  const top = sorted.slice(0, 3);
  const container = document.getElementById("season-overview");

  container.innerHTML = `
    <div class="bg-white shadow-lg rounded-2xl p-6 text-center">
      <h2 class="text-2xl font-bold text-orange-600 mb-4">🏆 Season 25 Overview</h2>
      <p class="text-gray-700 mb-4">Top 3 Players by Average KDA</p>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        ${top
          .map(
            (p, i) => `
          <div class="rounded-xl p-4 shadow-md bg-neutral-50">
            <h3 class="text-xl font-semibold">${["🥇", "🥈", "🥉"][i]} ${p.name}</h3>
            <p class="text-gray-800 font-medium">${p.avgKDA} KDA</p>
            <p class="text-gray-700">Winrate: ${p.winrate}%</p>
            <p class="text-gray-600 text-sm">${p.kills} / ${p.deaths} / ${p.assists} total</p>
            <p class="text-gray-500 text-xs">${p.games} games | ${p.mvps} MVP | ${p.aces} ACE</p>
          </div>`
          )
          .join("")}
      </div>
    </div>`;
}

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
          avgKDA: (s.kdaSum / s.games).toFixed(2),
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
