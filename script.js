// ✅ Les Nübs Season 25 Google Sheet (use the published CSV link!)
const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/e/15d-e7-S8A5p_uhAcHMaU2dCZc-csmZ7GJK9sd0iay8U/pub?output=csv";

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

// --- The rest of your rendering functions remain unchanged ---
/* renderSummary(), renderOverview(), renderTrends(), renderSplits(), setTrendWindow() — all same as before */

loadData();
