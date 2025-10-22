// --- SPLIT VISUAL + ANALYTICS REWORK (with winrate fix) ---
function renderSplits(splitsRaw) {
  const container = document.getElementById("splits");
  const allData = splitsRaw["Season 25"] || [];

  // --- Group data by Split ---
  const splitGroups = { "Split 1": [], "Split 2": [], "Split 3": [] };
  allData.forEach((r) => {
    const val = String(r["Split"] || "").trim().toLowerCase();
    if (val === "1" || val === "split 1") splitGroups["Split 1"].push(r);
    else if (val === "2" || val === "split 2") splitGroups["Split 2"].push(r);
    else if (val === "3" || val === "split 3") splitGroups["Split 3"].push(r);
  });

  // --- Compute stats per split ---
  const splitStats = {};
  for (const [split, data] of Object.entries(splitGroups)) {
    splitStats[split] = calcStats(data);
  }

  // --- Trend helper ---
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

  // --- Render all splits ---
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

      // Only count a game once as a win if any player had "yes"
      const winningGames = new Set();
      data.forEach((r) => {
        if (String(r["Result"]).toLowerCase() === "yes") {
          winningGames.add(r["Game #"]);
        }
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

      // --- SPLIT CARD TEMPLATE ---
      return `
        <div class="bg-white rounded-3xl shadow-xl p-6 flex flex-col space-y-4 border border-slate-100 hover:shadow-2xl transition">
          <h3 class="text-2xl font-bold text-orange-500">${split}</h3>

          <!-- Split Insights -->
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

          <!-- MVP & ACE Rates -->
          <div class="flex justify-center gap-4 text-sm text-gray-600">
            <span>🏅 MVP Rate: <span class="text-orange-600 font-semibold">${mvpRate}%</span></span>
            <span>⚡ ACE Rate: <span class="text-indigo-600 font-semibold">${aceRate}%</span></span>
          </div>

          <!-- Player Table -->
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
