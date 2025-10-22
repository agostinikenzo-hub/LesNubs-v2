// ✅ Les Nübs Season 25 Google Sheet
const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/15d-e7-S8A5p_uhAcHMaU2dCZc-csmZ7GJK9sd0iay8U/gviz/tq?tqx=out:csv";

let trendWindow = 10; // Default trend window

// --- Character Select Data ---
const players = [
  { name: "Betzhamo", svg: "assets/avatars/betzhamo.svg", color: "#f97316" },
  { name: "Jansen", svg: "assets/avatars/jansen.svg", color: "#3b82f6" },
  { name: "Sweeney", svg: "assets/avatars/sweeney.svg", color: "#22c55e" },
  { name: "Ota", svg: "assets/avatars/ota.svg", color: "#a855f7" },
  { name: "Achten", svg: "assets/avatars/achten.svg", color: "#f59e0b" },
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

function selectCharacter(name, color) {
  selectedPlayer = name;
  document.querySelectorAll(".character").forEach((el) => {
    const ring = el.querySelector("div");
    if (el.dataset.player === name) {
      ring.style.boxShadow = `0 0 10px 3px ${color}`;
      el.querySelector("p").classList.add("text-orange-500");
    } else {
      ring.style.boxShadow = "none";
      el.querySelector("p").classList.remove("text-orange-500");
    }
  });

  // Update highlights across the dashboard
  highlightPlayerStats(name);
}

// --- HIGHLIGHT SELECTED PLAYER ---
function highlightPlayerStats(name) {
  document.querySelectorAll("[data-player-stat]").forEach((el) => {
    const matches = el.dataset.playerStat === name;
    el.classList.toggle("bg-orange-50", matches);
    el.classList.toggle("ring-2", matches);
    el.classList.toggle("ring-orange-400", matches);
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
  } catch (err) {
    console.error(err);
    status.textContent =
      "⚠️ Error loading data. Check Google Sheet access or format.";
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
    if (opgg) {
      players[name].opggSum += opgg;
      players[name].opggCount += 1;
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

  const allGames = [...new Set(data.map((r) => r["Game #"]))];
  const totalGames = allGames.length;

  const winningGames = new Set();
  data.forEach((r) => {
    if (String(r["Result"]).toLowerCase() === "yes") winningGames.add(r["Game #"]);
  });
  const wins = winningGames.size;

  const winrate = totalGames > 0 ? ((wins / totalGames) * 100).toFixed(1) : "—";
  const avgKDA =
    totalDeaths > 0
      ? ((totalKills + totalAssists) / totalDeaths).toFixed(2)
      : "∞";

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

// --- OVERVIEW (TOP 3 + NEXT 3 PLAYERS) ---
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
  const rest = sorted.slice(3, 6);

  document.getElementById("season-overview").innerHTML = `
    <div class="bg-white shadow-lg rounded-2xl p-6 text-center mb-6">
      <h2 class="text-2xl font-bold text-orange-600 mb-4">🏆 Season 25 Overview</h2>
      <p class="text-gray-700 mb-4">Top Players by Season-wide KDA</p>
      
      <!-- Top 3 -->
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

      <!-- Next 3 smaller cards -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        ${rest
          .map(
            (p) => `
          <div data-player-stat="${p.name}" class="rounded-lg p-3 bg-neutral-50 shadow-sm transition hover:shadow-md">
            <h3 class="font-semibold">${p.name}</h3>
            <p class="text-gray-800 text-sm">${p.avgKDA} KDA</p>
            <p class="text-gray-600 text-xs">${p.winrate}% winrate</p>
          </div>`
          )
          .join("")}
      </div>
    </div>`;
}

// --- RENDER SPLITS + TRENDS ---
function renderTrends(data) {
  // (You can paste your latest working renderTrends() + renderSplits() functions here)
  // unchanged logic from previous version
}

loadData();
