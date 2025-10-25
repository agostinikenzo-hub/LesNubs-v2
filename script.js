// ✅ Les Nübs Season 25 Google Sheet (published CSV link)
const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRbb898Zhxeml0wxUIeXQk33lY3eVDqIGepE7iEiHA0KQNMQKvQWedA4WMaKUXBuhKfrPjalVb-OvD9/pub?output=csv";

let trendWindow = 10;

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

// --- Generate random pastel color ---
function randomPastelColor() {
  const hue = Math.floor(Math.random() * 360);
  return `hsl(${hue}, 70%, 75%)`;
}

// --- Character Select ---
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
    el.querySelector("div").style.boxShadow = "none";
    el.querySelector("p").classList.remove("text-orange-500");
  });

  const el = document.querySelector(`.character[data-player="${name}"]`);
  if (el) {
    el.querySelector("div").style.boxShadow = `0 0 10px 3px ${color}`;
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
      players[name].kpCount++;
      players[name].kpHistory.push(kp);
    }
    if (opgg) {
      players[name].opggSum += opgg;
      players[name].opggCount++;
      players[name].opggHistory.push(opgg);
    }
    players[name].gameHistory.push(kda);
  });
  return players;
}

// --- Render Summary (as before) ---
function renderSummary(data) {
  const stats = calcStats(data);
  const all = Object.values(stats);
  const totalKills = all.reduce((s, p) => s + p.kills, 0);
  const totalDeaths = all.reduce((s, p) => s + p.deaths, 0);
  const totalAssists = all.reduce((s, p) => s + p.assists, 0);
  const allGames = [...new Set(data.map((r) => r["Game #"]))];
  const totalGames = allGames.length;
  const wins = new Set(data.filter((r) => String(r["Result"]).toLowerCase() === "yes").map((r) => r["Game #"])).size;
  const winrate = totalGames ? ((wins / totalGames) * 100).toFixed(1) : "—";
  const avgKDA = totalDeaths ? ((totalKills + totalAssists) / totalDeaths).toFixed(2) : "∞";
  const kpValues = data.map((r) => parseFloat((r["Kill Part %"] || "").replace(",", "."))).filter((n) => !isNaN(n));
  const avgKP = kpValues.length ? (kpValues.reduce((a, b) => a + b, 0) / kpValues.length).toFixed(1) : "0.0";
  const avgTime = (() => {
    const seen = new Set();
    const times = [];
    data.forEach((r) => {
      const g = r["Game #"];
      if (seen.has(g)) return;
      seen.add(g);
      const t = (r["TIME"] || "").match(/(\d+)m\s*(\d+)?s?/);
      if (t) {
        const min = parseInt(t[1]) || 0;
        const sec = parseInt(t[2]) || 0;
        times.push(min * 60 + sec);
      }
    });
    if (!times.length) return "—";
    const avg = times.reduce((a, b) => a + b) / times.length;
    return `${Math.floor(avg / 60)}m ${Math.round(avg % 60)}s`;
  })();

  document.getElementById("season-summary").innerHTML = `
    <div class="bg-white shadow-lg rounded-2xl p-6 text-center mb-6">
      <h2 class="text-2xl font-bold text-orange-600 mb-4">📅 Season 25 Summary</h2>
      <div class="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        <div class="bg-orange-50 p-3 rounded-lg"><p class="text-orange-600 font-semibold text-lg">${totalGames}</p><p class="text-xs text-gray-600 uppercase tracking-wide">Games</p></div>
        <div class="bg-green-50 p-3 rounded-lg"><p class="text-green-600 font-semibold text-lg">${winrate}%</p><p class="text-xs text-gray-600 uppercase tracking-wide">Winrate</p></div>
        <div class="bg-indigo-50 p-3 rounded-lg"><p class="text-indigo-600 font-semibold text-lg">${avgKDA}</p><p class="text-xs text-gray-600 uppercase tracking-wide">Team KDA</p></div>
        <div class="bg-sky-50 p-3 rounded-lg"><p class="text-sky-600 font-semibold text-lg">${avgKP}%</p><p class="text-xs text-gray-600 uppercase tracking-wide">Avg KP</p></div>
        <div class="bg-amber-50 p-3 rounded-lg"><p class="text-amber-600 font-semibold text-lg">${avgTime}</p><p class="text-xs text-gray-600 uppercase tracking-wide">Avg Game Time</p></div>
      </div>
    </div>`;
}
// --- RENDER OVERVIEW ---
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
      winrate: s.games ? ((s.wins / s.games) * 100).toFixed(1) : "—",
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

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        ${top
          .map(
            (p, i) => `
          <div data-player-stat="${p.name}" class="rounded-xl p-4 shadow-md bg-neutral-50 transition hover:shadow-lg">
            <h3 class="text-xl font-semibold">${["🥇","🥈","🥉"][i]} ${p.name}</h3>
            <p class="text-gray-800 font-medium">${p.avgKDA} KDA</p>
            <p class="text-gray-700 mt-1">Winrate: ${p.winrate}%</p>
            <p class="text-gray-600 text-sm">${p.kills}/${p.deaths}/${p.assists}</p>
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

// --- RENDER TRENDS ---
function renderTrends(data) {
  const stats = calcStats(data);
  const container = document.getElementById("kda-trends");

  const players = Object.entries(stats).map(([name, s]) => {
    const getTrend = (arr) => {
      if (arr.length < 10)
        return { trend: "▶", diff: 0, avgRecent: 0 };
      const recent = arr.slice(-trendWindow);
      const prev = arr.slice(0, -trendWindow);
      const avgRecent = recent.reduce((a,b)=>a+b,0)/recent.length;
      const avgPrev = prev.reduce((a,b)=>a+b,0)/(prev.length||1);
      const diff = avgRecent - avgPrev;
      return { trend: diff>0.1?"▲":diff<-0.1?"▼":"▶", avgRecent };
    };
    return {
      name,
      kdaT: getTrend(s.gameHistory),
      kpT: s.kpHistory.length ? getTrend(s.kpHistory) : null,
      opggT: s.opggHistory.length ? getTrend(s.opggHistory) : null,
    };
  });

  container.innerHTML = `
    <div class="bg-white shadow-lg rounded-2xl p-6 text-center mb-6">
      <h2 class="text-2xl font-bold text-orange-600 mb-4">📈 Trend</h2>
      <div class="flex justify-center mb-4 gap-3">
        <button onclick="setTrendWindow(5)" class="px-3 py-1 rounded-md text-sm font-medium ${
          trendWindow===5?"bg-orange-500 text-white":"bg-gray-100 text-gray-700"
        }">Last 5 games</button>
        <button onclick="setTrendWindow(10)" class="px-3 py-1 rounded-md text-sm font-medium ${
          trendWindow===10?"bg-orange-500 text-white":"bg-gray-100 text-gray-700"
        }">Last 10 games</button>
      </div>
      <div class="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
        ${players.map(p=>`
          <div data-player-stat="${p.name}" class="rounded-xl p-3 bg-neutral-50 shadow-md">
            <h3 class="font-semibold text-lg">${p.name}</h3>
            <p class="text-sm text-gray-600">
              KDA:
              <span class="${
                p.kdaT.trend==="▲"?"text-green-600":p.kdaT.trend==="▼"?"text-red-600":"text-gray-400"
              }">${p.kdaT.trend}</span>
              (${p.kdaT.avgRecent?.toFixed(2)||"—"})
            </p>
            ${
              p.opggT
                ? `<p class="text-sm text-gray-600">OP.GG:
                    <span class="${
                      p.opggT.trend==="▲"?"text-green-600":p.opggT.trend==="▼"?"text-red-600":"text-gray-400"
                    }">${p.opggT.trend}</span>
                    (${p.opggT.avgRecent?.toFixed(1)})</p>`
                : ""
            }
            ${
              p.kpT
                ? `<p class="text-sm text-gray-600">KP:
                    <span class="${
                      p.kpT.trend==="▲"?"text-green-600":p.kpT.trend==="▼"?"text-red-600":"text-gray-400"
                    }">${p.kpT.trend}</span>
                    (${p.kpT.avgRecent?.toFixed(1)}%)</p>`
                : ""
            }
          </div>`).join("")}
      </div>
    </div>`;
}

// --- RENDER SPLITS ---
function renderSplits(splitsRaw) {
  const container = document.getElementById("splits");
  const allData = splitsRaw["Season 25"] || [];
  const splitGroups = { "Split 1": [], "Split 2": [], "Split 3": [] };
  allData.forEach((r) => {
    const v = String(r["Split"]||"").trim().toLowerCase();
    if (v==="1"||v==="split 1") splitGroups["Split 1"].push(r);
    else if (v==="2"||v==="split 2") splitGroups["Split 2"].push(r);
    else if (v==="3"||v==="split 3") splitGroups["Split 3"].push(r);
  });

  container.innerHTML = Object.entries(splitGroups).map(([split,data])=>{
    if(!data.length)
      return `<div class="bg-white p-6 rounded-2xl shadow-md text-gray-400 text-center italic">${split} — No data yet</div>`;
    const stats = calcStats(data);
    const sorted = Object.entries(stats).map(([n,s])=>({
      name:n,
      avgKDA:s.deaths?((s.kills+s.assists)/s.deaths).toFixed(2):(s.kills+s.assists).toFixed(2),
      games:s.games,
      winrate:s.games?((s.wins/s.games)*100).toFixed(1):"—"
    })).sort((a,b)=>b.avgKDA-a.avgKDA);
    return `
      <div class="bg-white rounded-3xl shadow-xl p-6 border border-slate-100 hover:shadow-2xl transition">
        <h3 class="text-2xl font-bold text-orange-500 mb-3">${split}</h3>
        <table class="min-w-full text-sm border-t border-gray-100">
          <thead class="text-gray-700 font-semibold border-b">
            <tr><th class="text-left py-1 w-8">#</th><th class="text-left py-1">Player</th><th class="text-right py-1">KDA</th><th class="text-right py-1">Win%</th><th class="text-right py-1">Games</th></tr>
          </thead>
          <tbody>
            ${sorted.map((p,i)=>`
              <tr data-player-stat="${p.name}" class="${i%2===0?"bg-gray-50":"bg-white"} hover:bg-orange-50 transition">
                <td class="py-1">${i+1}</td>
                <td class="py-1 font-medium">${p.name}</td>
                <td class="py-1 text-right">${p.avgKDA}</td>
                <td class="py-1 text-right">${p.winrate}%</td>
                <td class="py-1 text-right">${p.games}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>`;
  }).join("");
}

// --- TREND WINDOW CONTROL ---
function setTrendWindow(n){ trendWindow=n; loadData(); }

// --- INITIALIZE ---
loadData();
