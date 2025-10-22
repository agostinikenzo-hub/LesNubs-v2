// ✅ Your published Google Sheet (Season 25)
const SHEET_URL = "https://docs.google.com/spreadsheets/d/15d-e7-S8A5p_uhAcHMaU2dCZc-csmZ7GJK9sd0iay8U/gviz/tq?tqx=out:csv";

async function loadData() {
  const status = document.getElementById("status");
  try {
    const res = await fetch(SHEET_URL);
    const csv = await res.text();
    const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });
    const rows = parsed.data;

    status.textContent = `Loaded ${rows.length} records ✔`;

    const splits = { "Split 1": [], "Split 2": [], "Split 3": [], "Season 25": [] };
    rows.forEach(row => {
      const split = row.Split?.trim() || "Unknown";
      if (splits[split]) splits[split].push(row);
      splits["Season 25"].push(row);
    });

    renderOverview(splits["Season 25"]);
    renderSplits(splits);
  } catch (err) {
    console.error(err);
    status.textContent = "⚠️ Error loading data. Check the sheet link or permissions.";
  }
}

function calcStats(data) {
  const players = {};
  data.forEach(row => {
    const name = row.Player?.trim();
    if (!name) return;

    const kills = parseFloat(row.Kills?.replace(",", ".")) || 0;
    const deaths = parseFloat(row.Deaths?.replace(",", ".")) || 0;
    const assists = parseFloat(row.Assists?.replace(",", ".")) || 0;
    const kda = deaths === 0 ? kills + assists : (kills + assists) / deaths;

    if (!players[name]) players[name] = { kills: 0, deaths: 0, assists: 0, games: 0, kdaSum: 0 };
    players[name].kills += kills;
    players[name].deaths += deaths;
    players[name].assists += assists;
    players[name].kdaSum += kda;
    players[name].games += 1;
  });
  return players;
}

function renderOverview(seasonData) {
  const stats = calcStats(seasonData);
  const sorted = Object.entries(stats)
    .map(([name, s]) => ({
      name,
      avgKDA: (s.kdaSum / s.games).toFixed(2),
      games: s.games
    }))
    .sort((a, b) => b.avgKDA - a.avgKDA);

  const top = sorted.slice(0, 3);
  const container = document.getElementById("season-overview");
  container.innerHTML = `
    <div class="bg-white shadow-lg rounded-2xl p-6 text-center">
      <h2 class="text-2xl font-bold text-orange-600 mb-4">🏆 Season 25 Overview</h2>
      <p class="text-gray-700 mb-4">Top 3 Players by Average KDA</p>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        ${top.map((p, i) => `
          <div class="bg-orange-${400 + i * 100} text-white rounded-xl p-4">
            <h3 class="text-xl font-semibold">${p.name}</h3>
            <p>${p.avgKDA} KDA over ${p.games} games</p>
          </div>
        `).join("")}
      </div>
    </div>`;
}

function renderSplits(splits) {
  const container = document.getElementById("splits");
  const keys = ["Split 1", "Split 2", "Split 3"];
  container.innerHTML = keys
    .map(split => {
      const stats = calcStats(splits[split]);
      const sorted = Object.entries(stats)
        .map(([name, s]) => ({
          name,
          avgKDA: (s.kdaSum / s.games).toFixed(2),
          games: s.games
        }))
        .sort((a, b) => b.avgKDA - a.avgKDA);
      const top = sorted.slice(0, 3);

      return `
        <div class="bg-white rounded-2xl shadow-md p-4">
          <h3 class="text-xl font-bold text-orange-500 mb-2">${split}</h3>
          ${top.length > 0
            ? `<ul class="text-sm text-gray-700 space-y-1">
                ${top.map(p => `<li><strong>${p.name}</strong> — ${p.avgKDA} KDA (${p.games} games)</li>`).join("")}
              </ul>`
            : `<p class="text-gray-400 italic">No data yet</p>`}
        </div>`;
    })
    .join("");
}

loadData();

