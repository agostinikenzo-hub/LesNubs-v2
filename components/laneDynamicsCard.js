// /components/laneDynamicsCard.js
// Lane Dynamics & Playmakers — Season 26 (v3.1 modularized)
//
// Mount API:
//   mountLaneDynamicsCard(mountEl, seasonRows, timelineRows, { roster, unlockGames, initialPhase })
//
// Notes:
// - No fetching inside; pass timelineRows in.
// - Keeps local phase state per mount element.
// - Uses the Season 26 timeline headers as-is.

function ldGetAny(row, keys) {
  for (const k of keys) {
    if (row && k in row && row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== "") return row[k];
  }
  return "";
}

function ldNum(v) {
  if (v === null || v === undefined || v === "") return 0;
  const n = parseFloat(String(v).replace("%", "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function ldBool(v) {
  const s = String(v || "").trim().toUpperCase();
  return s === "1" || s === "TRUE" || s === "YES";
}

function ldEscapeHTML(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function ldGetMatchId(r) {
  return String(ldGetAny(r, ["Match ID", "MatchID", "Game ID", "Game #", "Date"])).trim();
}

function ldGetPlayer(r) {
  return String(ldGetAny(r, ["Player", "p.riotIdGameName", "p.summonerName", "Summoner"])).trim();
}

function normLaneRoleLD26(r) {
  const raw = String(ldGetAny(r, ["Role", "ROLE", "Team Position", "p.teamPosition", "p.individualPosition"]) || "")
    .toUpperCase()
    .trim();
  if (!raw) return "";
  if (raw.includes("TOP")) return "TOP";
  if (raw.includes("JUNG")) return "JUNGLE";
  if (raw.includes("MID") || raw.includes("MIDDLE")) return "MIDDLE";
  if (raw.includes("BOT") || raw.includes("BOTTOM") || raw.includes("ADC")) return "BOTTOM";
  if (raw.includes("SUP") || raw.includes("UTIL")) return "SUPPORT";
  return raw;
}

// Cheap "home lane" for roam detection
function laneHomeZoneLD26(role, teamId) {
  if (role === "TOP") return teamId === 100 ? "Top Lane" : "Bot Lane";
  if (role === "BOTTOM") return teamId === 100 ? "Bot Lane" : "Top Lane";
  if (role === "MIDDLE") return "Mid Lane";
  if (role === "SUPPORT") return "Bot Lane";
  if (role === "JUNGLE") return "Jungle";
  return "";
}

// Dynamic early/mid/late per match (based on total minutes)
function buildMatchLengthsLD26(rows) {
  const len = {};
  rows.forEach((r) => {
    const id = ldGetMatchId(r);
    if (!id) return;
    const m = ldNum(ldGetAny(r, ["Minute"]));
    if (!len[id] || m > len[id]) len[id] = m;
  });
  return len;
}

function getPhaseForMinuteLD26(matchId, minute, matchLengths) {
  const total = matchLengths[matchId] || 30;
  if (minute < 3) return null;

  const earlyEnd = Math.max(8, Math.min(14, Math.round(total * 0.25)));
  const midEnd = Math.max(earlyEnd + 5, Math.round(total * 0.6));

  if (minute <= earlyEnd) return "early";
  if (minute <= midEnd) return "mid";
  return "late";
}

// Analyst tags tooltips
function getProfileTooltipLD26(tag) {
  switch (tag) {
    case "Lane Rock":
      return "Consistently wins or holds lane with strong fundamentals in this phase.";
    case "Resource Carry":
      return "Performs best when given resources; converts help into reliable leads.";
    case "Playmaker":
      return "Moves first while stable; drives proactive plays and roams.";
    case "Pressure Sink":
      return "Often behind despite ally presence; beware of over-investing.";
    case "High-Risk Roamer":
      return "Roams aggressively from even/behind states; can swing games both ways.";
    case "Guest (Small Sample)":
      return "Very small sample in this phase; interpret trends cautiously.";
    case "Stable":
      return "Solid, unspectacular lane outcomes; rarely a liability.";
    case "Lane Rock Duo":
      return "Botlane duo with strong, repeatable lane control and reliability.";
    case "Playmaker Duo":
      return "Botlane duo that frequently creates plays and roams effectively.";
    case "Pressure Sink Duo":
      return "Botlane duo that struggles even with attention; monitor drafts.";
    case "Stable Duo":
      return "Botlane duo that is generally steady, average outcomes.";
    default:
      return "";
  }
}

function getInvestmentTagLD26(p, lanePhase) {
  const lc = p.laneControl;
  const rel = p.reliability;
  const self = p.selfLead || 0;
  const help = p.helpedLead || 0;
  const sink = p.pressureSink || 0;

  const hasLeadSignal = self + help > 0;

  if (lanePhase === "late") {
    if (help >= 35 && (lc <= 0 || rel <= 50 || sink >= 10)) return "Resource Trap";
    if (self >= 85 && rel >= 65 && lc >= 0 && sink < 8) return "Island Safe";
    return "";
  }

  if (help >= 35 && (lc <= 0 || rel <= 50 || sink >= 10)) return "Resource Trap";
  if (hasLeadSignal && help >= 40 && lc >= 5 && rel >= 55) return "Invest Pays Off";
  if (self >= 80 && rel >= 60 && lc >= 0 && sink < 8) return "Island Safe";
  if (self >= 65 && rel >= 55 && lc > -3 && sink < 10) return "Low-Maintenance";
  if (self >= 50 && self <= 80 && help >= 20 && help <= 40 && lc >= 0 && rel >= 55) return "Setup Lane";
  if (self >= 80 && rel < 55) return "Volatile Duelist";
  if (self >= 40 && self <= 65 && rel < 55 && help >= 20 && lc > -8) return "Needs Cover";

  return "";
}

function getInvestmentTooltipLD26(tag) {
  switch (tag) {
    case "Island Safe":
      return "Wins or holds lane mostly alone. You can path away without griefing them.";
    case "Low-Maintenance":
      return "Usually stable with minimal attention. Cover dives and resets; no need to force plays.";
    case "Invest Pays Off":
      return "When you play for this lane, it reliably converts pressure into leads.";
    case "Setup Lane":
      return "Strong for coordinated plays (2v2+1). Use for dives, prio, and planned setups.";
    case "Volatile Duelist":
      return "High-risk island. Can solo-win or solo-lose; draft and cover accordingly.";
    case "Needs Cover":
      return "Fully ignoring this lane is risky. Targeted visits help it stabilize.";
    case "Resource Trap":
      return "Heavy attention rarely sticks as a lead. Avoid defaulting to play through this lane.";
    default:
      return "";
  }
}

function ensureState(mountEl, opts) {
  if (!mountEl.__laneDynamics26State) {
    mountEl.__laneDynamics26State = {
      phase: opts?.initialPhase || "early",
      cachedSeasonRows: null,
      cachedTimelineRows: null,
      roster: Array.isArray(opts?.roster) ? opts.roster : [],
      unlockGames: Number.isFinite(opts?.unlockGames) ? opts.unlockGames : 0,
    };
  } else {
    if (opts?.initialPhase) mountEl.__laneDynamics26State.phase = opts.initialPhase;
    if (Array.isArray(opts?.roster)) mountEl.__laneDynamics26State.roster = opts.roster;
    if (Number.isFinite(opts?.unlockGames)) mountEl.__laneDynamics26State.unlockGames = opts.unlockGames;
  }
  return mountEl.__laneDynamics26State;
}

function phaseButtonsHTML(activePhase) {
  const btn = (key, label) => `
    <button
      class="px-3 py-1 rounded-full text-[0.7rem] font-medium transition
      ${activePhase === key ? "bg-sky-500 text-white shadow-sm" : "bg-transparent text-sky-700 hover:bg-white hover:text-sky-600"}"
      data-lane26-phase="${key}">
      ${label}
    </button>
  `;

  return `
    <div class="inline-flex gap-1 bg-sky-50 px-1 py-1 rounded-full">
      ${btn("early", "Early")}
      ${btn("mid", "Mid")}
      ${btn("late", "Late")}
    </div>
  `;
}

function bindPhaseButtons(mountEl) {
  const state = mountEl.__laneDynamics26State;
  if (!state) return;

  mountEl.querySelectorAll("[data-lane26-phase]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = btn.getAttribute("data-lane26-phase");
      if (!next || next === state.phase) return;
      state.phase = next;
      renderLaneDynamicsInner(mountEl, state.cachedSeasonRows, state.cachedTimelineRows, {
        roster: state.roster,
        unlockGames: state.unlockGames,
      });
    });
  });
}

function renderLaneDynamicsInner(mountEl, seasonRows, timelineRows, opts = {}) {
  const state = ensureState(mountEl, opts);

  const allTimeline = Array.isArray(timelineRows) ? timelineRows : [];
  if (!allTimeline.length) {
    mountEl.innerHTML = `
      <div class="card-header">
        <div>
          <div class="card-title">Lane Dynamics & Playmakers</div>
          <div class="card-subtitle">No timeline data loaded yet.</div>
        </div>
      </div>
    `;
    return;
  }

  // Cache for phase buttons rerender
  state.cachedSeasonRows = seasonRows || null;
  state.cachedTimelineRows = allTimeline;

  // Filter timeline to match IDs that exist in seasonRows (keeps “season scope”)
  let timelineScoped = allTimeline;
  if (Array.isArray(seasonRows) && seasonRows.length) {
    const seasonSet = new Set(seasonRows.map(ldGetMatchId).filter(Boolean));
    if (seasonSet.size) timelineScoped = allTimeline.filter((r) => seasonSet.has(ldGetMatchId(r)));
  }

  const gameSet = new Set(timelineScoped.map(ldGetMatchId).filter(Boolean));
  const gamesInScope = gameSet.size || 0;

  const need = state.unlockGames || 0;
  if (gamesInScope < need) {
    const remaining = Math.max(0, need - gamesInScope);
    mountEl.innerHTML = `
      <div class="card-header">
        <div>
          <div class="card-title">Lane Dynamics & Playmakers</div>
          <div class="card-subtitle">
            Minute-by-minute lane vs opponent analysis. Unlocks once enough games are collected.
          </div>
        </div>
        <div class="text-[0.7rem] text-slate-500 text-right">
          Games: <span class="font-semibold">${gamesInScope}</span> / ${need}<br/>
          ${remaining ? `Need <span class="font-semibold">${remaining}</span> more` : ""}
        </div>
      </div>

      <div class="mt-3 p-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50">
        <div class="text-sm font-semibold text-slate-800">🔒 Locked</div>
        <div class="text-[0.7rem] text-slate-600 mt-1">
          Progress: <span class="font-semibold">${gamesInScope}</span> / ${need} games
        </div>
      </div>
    `;
    return;
  }

  // Role minutes + games per player (window-wide)
  const roleMinutesByPlayer = {};
  const gamesByPlayer = {};

  timelineScoped.forEach((r) => {
    const player = ldGetPlayer(r);
    if (!player) return;

    const role = normLaneRoleLD26(r) || "UNKNOWN";
    const gameId = ldGetMatchId(r);

    if (!gamesByPlayer[player]) gamesByPlayer[player] = new Set();
    if (gameId) gamesByPlayer[player].add(gameId);

    if (!roleMinutesByPlayer[player]) roleMinutesByPlayer[player] = { total: 0, byRole: {} };
    roleMinutesByPlayer[player].total += 1;
    roleMinutesByPlayer[player].byRole[role] = (roleMinutesByPlayer[player].byRole[role] || 0) + 1;
  });

  // === compute metrics for selected phase ===
  const matchLengths = buildMatchLengthsLD26(timelineScoped);
  const allGameIds = new Set(timelineScoped.map(ldGetMatchId).filter(Boolean));
  const totalTimelineGames = allGameIds.size || 1;

  const perPlayerRole = {}; // player|role
  const perFrame = {};      // bot+sup duos frames
  const duoStats = {};
  const jungleStats = {};

  // Objective tracking
  const objectiveEvents = {};
  const objTrack = {};

  timelineScoped.forEach((r) => {
    const player = ldGetPlayer(r);
    const matchId = ldGetMatchId(r);
    if (!player || !matchId) return;

    const minute = ldNum(r["Minute"]);
    const role = normLaneRoleLD26(r) || "UNKNOWN";
    const teamId = ldNum(r["TeamId"]) || 0;

    // --- objective event detection ---
    const objKey = `${matchId}|${teamId}`;
    const prev = objTrack[objKey] || { drag: 0, herald: 0, baron: 0, grubs: 0, atak: 0, towers: 0, inhibs: 0 };
    const cur = {
      drag: ldNum(r["Team Dragons"]),
      herald: ldNum(r["Team Heralds"]),
      baron: ldNum(r["Team Barons"]),
      grubs: ldNum(r["Team Voidgrubs"]),
      atak: ldNum(r["Team Atakhans"]),
      towers: ldNum(r["Team Towers"]),
      inhibs: ldNum(r["Team Inhibitors"]),
    };
    const gotObj =
      cur.drag > prev.drag || cur.herald > prev.herald || cur.baron > prev.baron ||
      cur.grubs > prev.grubs || cur.atak > prev.atak || cur.towers > prev.towers || cur.inhibs > prev.inhibs;

    if (gotObj) objectiveEvents[`${matchId}|${teamId}|${minute}`] = true;
    objTrack[objKey] = cur;

    // --- phase gating ---
    const phase = getPhaseForMinuteLD26(matchId, minute, matchLengths);
    if (!phase || phase !== state.phase) return;

    const zone = String(r["Zone"] || "").trim();
    const laneZone = laneHomeZoneLD26(role, teamId);

    const goldDiff = ldNum(r["Gold Diff vs Opp"]);
    const xpDiff = ldNum(r["XP Diff vs Opp"]);
    const csDiff = ldNum(r["CS Diff vs Opp"]);

    const closeTeammates = ldNum(r["Close Teammates"]);
    const isGrouped = ldBool(r["Is Grouped"]);
    const inRiver = ldBool(r["In River"]);

    const prKey = `${player}|${role}`;
    if (!perPlayerRole[prKey]) {
      perPlayerRole[prKey] = {
        name: player,
        role,
        minutes: 0,
        laneControlSum: 0,
        goodMinutes: 0,
        hardLosingMinutes: 0,
        selfLeadMinutes: 0,
        helpLeadMinutes: 0,
        sinkMinutes: 0,
        roamPlayMinutes: 0,
        games: new Set(),
      };
    }
    const pr = perPlayerRole[prKey];
    pr.games.add(matchId);
    pr.minutes += 1;

    // Lane Control composite (normalized)
    const g = Math.max(-800, Math.min(800, goldDiff));
    const x = Math.max(-2, Math.min(2, xpDiff));
    const c = Math.max(-25, Math.min(25, csDiff));
    const control = (g / 800 + x / 2 + c / 25) / 3;
    pr.laneControlSum += control;

    const combinedBehind = goldDiff <= -300 || xpDiff <= -1 || csDiff <= -15;
    const combinedAhead  = goldDiff >= 150  || xpDiff >= 0.5 || csDiff >= 8;

    if (!combinedBehind) pr.goodMinutes += 1;
    if (combinedBehind) pr.hardLosingMinutes += 1;

    // Lead attribution (only when ahead)
    if (combinedAhead) {
      if (closeTeammates <= 1) pr.selfLeadMinutes += 1;
      else if (closeTeammates >= 2) pr.helpLeadMinutes += 1;
    }

    // Pressure sink (phase-aware, tightened mid/late)
    const teamGoldDiff = ldNum(r["Gold Diff (Team)"]);
    const teamAheadFlag = ldBool(r["Team Gold Ahead"]);
    const teamNotHardLosing = teamAheadFlag || teamGoldDiff >= -800;

    let pressureSinkMinute = false;
    if (combinedBehind && closeTeammates >= 2 && teamNotHardLosing) {
      if (phase === "early") pressureSinkMinute = true;
      else if (phase === "mid")
        pressureSinkMinute = (goldDiff <= -400 || xpDiff <= -1.5 || csDiff <= -20) && closeTeammates >= 2;
      else
        pressureSinkMinute = (goldDiff <= -600 || xpDiff <= -2) && closeTeammates >= 3;
    }
    if (pressureSinkMinute) pr.sinkMinutes += 1;

    // Playmaker: out of lane + stable
    const outOfLane =
      laneZone && zone && laneZone !== zone && (inRiver || isGrouped || closeTeammates >= 2);
    if (outOfLane && !combinedBehind) pr.roamPlayMinutes += 1;

    // Botlane duo frames
    const frameKey = `${matchId}|${teamId}|${minute}`;
    if (!perFrame[frameKey]) perFrame[frameKey] = [];
    perFrame[frameKey].push({
      player,
      role,
      goldDiff,
      xpDiff,
      csDiff,
      laneZone,
      zone,
      closeTeammates,
      isGrouped,
      inRiver,
      matchId,
    });

    // Jungle profile
    if (role === "JUNGLE") {
      if (!jungleStats[player]) {
        jungleStats[player] = {
          player,
          minutes: 0,
          objPresenceMinutes: 0,
          leadObjMinutes: 0,
          gankMinutes: 0,
          farmMinutes: 0,
          games: new Set(),
        };
      }
      const jg = jungleStats[player];
      jg.minutes += 1;
      jg.games.add(matchId);

      const evKey = `${matchId}|${teamId}|${minute}`;
      if (objectiveEvents[evKey]) {
        jg.objPresenceMinutes += 1;
        const teamAheadNow = ldBool(r["Team Gold Ahead"]) || ldNum(r["Gold Diff (Team)"]) > 0;
        const jgAheadNow = goldDiff > 0 || xpDiff > 0;
        if (teamAheadNow || jgAheadNow) jg.leadObjMinutes += 1;
      }

      const isFarm = zone === "Jungle" && !inRiver && closeTeammates <= 1;
      const isGank = !isFarm && (inRiver || closeTeammates >= 1 || zone !== "Jungle");
      if (isFarm) jg.farmMinutes += 1;
      if (isGank) jg.gankMinutes += 1;
    }
  });

  const playerRoleEntries = Object.values(perPlayerRole);
  if (!playerRoleEntries.length) {
    mountEl.innerHTML = `
      <div class="card-header">
        <div>
          <div class="card-title">Lane Dynamics & Playmakers</div>
          <div class="card-subtitle">No timeline data in scope for the selected phase.</div>
        </div>
      </div>
    `;
    return;
  }

  // ---------- Duos (BOTTOM + SUPPORT) ----------
  Object.values(perFrame).forEach((frames) => {
    const bot = frames.find((f) => f.role === "BOTTOM");
    const sup = frames.find((f) => f.role === "SUPPORT");
    if (!bot || !sup) return;

    const [p1, p2] = [bot.player, sup.player].sort();
    const key = `${p1} & ${p2}`;

    if (!duoStats[key]) {
      duoStats[key] = {
        name: key,
        p1,
        p2,
        minutes: 0,
        laneControlSum: 0,
        goodMinutes: 0,
        hardLosingMinutes: 0,
        playMinutes: 0,
        sinkMinutes: 0,
        games: new Set(),
      };
    }
    const d = duoStats[key];
    d.games.add(bot.matchId);
    d.minutes += 1;

    const avgGold = (bot.goldDiff + sup.goldDiff) / 2;
    const avgXp = (bot.xpDiff + sup.xpDiff) / 2;
    const avgCs = (bot.csDiff + sup.csDiff) / 2;

    const g = Math.max(-800, Math.min(800, avgGold));
    const x = Math.max(-2, Math.min(2, avgXp));
    const c = Math.max(-25, Math.min(25, avgCs));
    const control = (g / 800 + x / 2 + c / 25) / 3;
    d.laneControlSum += control;

    const combinedBehind = avgGold <= -300 || avgXp <= -1 || avgCs <= -15;

    if (!combinedBehind) d.goodMinutes += 1;
    if (combinedBehind) d.hardLosingMinutes += 1;

    const outOfLane =
      (bot.laneZone && bot.zone && bot.laneZone !== bot.zone) ||
      (sup.laneZone && sup.zone && sup.laneZone !== sup.zone);

    if (outOfLane && !combinedBehind) d.playMinutes += 1;

    if (combinedBehind && (bot.closeTeammates >= 2 || sup.closeTeammates >= 2)) d.sinkMinutes += 1;
  });

  const duoRows = Object.values(duoStats)
    .filter((d) => d.minutes >= 40 && d.games.size >= 3)
    .map((d) => {
      const mins = Math.max(1, d.minutes);
      const laneControl = (d.laneControlSum / mins) * 100;
      const reliability = (d.goodMinutes / mins) * 100;
      const playmaker = (d.playMinutes / mins) * 100;
      const pressureSink = (d.sinkMinutes / mins) * 100;
      const games = d.games.size || 1;

      let tag = "Stable Duo";
      if (laneControl >= 10 && reliability >= 65) tag = "Lane Rock Duo";
      else if (playmaker >= 10 && reliability >= 55) tag = "Playmaker Duo";
      else if (pressureSink >= 12) tag = "Pressure Sink Duo";

      return {
        name: d.name,
        games,
        laneControl,
        reliability,
        selfLead: null,
        helpedLead: null,
        pressureSink,
        playmaker,
        tag,
        roleMix: `${d.p1} + ${d.p2}`,
        isGuest: false,
        isDuo: true,
      };
    })
    .sort((a, b) => b.laneControl - a.laneControl);

  // ---------- Player rows ----------
  const tableRows = [];
  playerRoleEntries.forEach((pr) => {
    const rm = roleMinutesByPlayer?.[pr.name];
    if (!rm || rm.total === 0) return;

    const roleMinutes = rm.byRole?.[pr.role] || 0;
    const roleShare = (roleMinutes / rm.total) * 100;
    if (roleShare < 10) return;

    const mins = Math.max(1, pr.minutes || 0);
    if (mins < 5) return;

    const gamesInRole = pr.games.size || 1;
    const laneControl = (pr.laneControlSum / mins) * 100;
    const reliability = (pr.goodMinutes / mins) * 100;

    const leadDen = pr.selfLeadMinutes + pr.helpLeadMinutes;
    const selfLead = leadDen > 0 ? (pr.selfLeadMinutes / leadDen) * 100 : null;
    const helpedLead = leadDen > 0 ? (pr.helpLeadMinutes / leadDen) * 100 : null;

    const pressureSink = (pr.sinkMinutes / mins) * 100;
    const playmaker = (pr.roamPlayMinutes / mins) * 100;

    const gp = gamesByPlayer?.[pr.name];
    const gamesInWindow = gp ? gp.size || 1 : gamesInRole;

    // guest = <10% of games in scope
    const isGuest = gamesInWindow / totalTimelineGames < 0.1;

    // flex = >=2 roles >=10% share
    const flexRoles = Object.entries(rm.byRole)
      .filter(([, c]) => (c / rm.total) * 100 >= 10)
      .map(([r]) => r);
    const isFlex = flexRoles.length >= 2;

    const roleMix = Object.entries(rm.byRole)
      .map(([r, c]) => `${r} ${Math.round((c / rm.total) * 100)}%`)
      .join(" / ");

    let tag = "Stable";
    if (laneControl >= 15 && (selfLead ?? 0) >= 55 && reliability >= 70) tag = "Lane Rock";
    else if (laneControl >= 10 && (helpedLead ?? 0) >= 45) tag = "Resource Carry";
    else if (playmaker >= 10 && reliability >= 55) tag = "Playmaker";
    else if (pressureSink >= 12) tag = "Pressure Sink";
    else if (playmaker >= 12 && laneControl <= 0) tag = "High-Risk Roamer";
    if (isGuest) tag = "Guest (Small Sample)";

    const investmentTag = getInvestmentTagLD26(
      { laneControl, reliability, selfLead: selfLead ?? 0, helpedLead: helpedLead ?? 0, pressureSink, playmaker },
      state.phase
    );

    tableRows.push({
      name: pr.name,
      displayRole: pr.role,
      games: gamesInRole,
      laneControl,
      reliability,
      selfLead,
      helpedLead,
      pressureSink,
      playmaker,
      tag,
      investmentTag,
      roleMix,
      isFlex,
      isGuest,
      isDuo: false,
    });
  });

  const withPlayerMetrics = tableRows.filter((p) => !(p.isGuest && p.games <= 1));
  withPlayerMetrics.sort((a, b) => {
    if (a.isGuest !== b.isGuest) return a.isGuest ? 1 : -1;
    if (a.games !== b.games) return b.games - a.games;
    return b.laneControl - a.laneControl;
  });

  // Jungle mini cards
  const jungleProfiles = Object.values(jungleStats)
    .map((j) => {
      const mins = Math.max(1, j.minutes || 0);
      const games = j.games ? j.games.size || 0 : 0;

      const rm = roleMinutesByPlayer?.[j.player];
      const jungleMinutes = rm?.byRole?.["JUNGLE"] ?? mins;
      const jungleShare = rm && rm.total > 0 ? (jungleMinutes / rm.total) * 100 : 0;

      if (jungleShare < 10 || mins < 10 || games < 3) return null;

      const objPresence = (j.objPresenceMinutes / mins) * 100;
      const leadObj = j.objPresenceMinutes > 0 ? (j.leadObjMinutes / j.objPresenceMinutes) * 100 : 0;
      const gankShare = (j.gankMinutes / mins) * 100;
      const farmShare = (j.farmMinutes / mins) * 100;

      let style = "Balanced";
      if (farmShare >= 60 && gankShare <= 40) style = "Farm Heavy";
      else if (gankShare >= 45 && gankShare > farmShare) style = "Gank Heavy";
      else if (objPresence >= 30 && leadObj >= 60) style = "Objective Engine";

      return { player: j.player, mins, games, objPresence, leadObj, gankShare, farmShare, style };
    })
    .filter(Boolean)
    .sort((a, b) => b.games - a.games || b.objPresence - a.objPresence);

  // Mini cards
  const ldTopPlaymaker =
    [...withPlayerMetrics]
      .filter((p) => !p.isGuest && p.games >= 5)
      .sort((a, b) => b.playmaker - a.playmaker)[0] || null;

  const ldBestDuo = duoRows[0] || null;

  const bestDuoCard = ldBestDuo
    ? `<div class="p-3 rounded-2xl bg-sky-50 border border-sky-100">
         <div class="text-[0.65rem] font-semibold text-sky-600 uppercase mb-1">Most Reliable Botlane Duo</div>
         <div class="text-sm font-semibold text-gray-900">${ldEscapeHTML(ldBestDuo.name)}</div>
         <div class="text-[0.7rem] text-gray-700">
           Lane Control ${ldBestDuo.laneControl.toFixed(1)}%, Reliability ${ldBestDuo.reliability.toFixed(1)}% (${ldBestDuo.games} games)
         </div>
       </div>`
    : `<div class="p-3 rounded-2xl bg-sky-50 border border-dashed border-sky-100 text-[0.65rem] text-gray-500">
         Not enough repeated BOTTOM+SUPPORT duos yet.
       </div>`;

  const topPlaymakerCard = ldTopPlaymaker
    ? `<div class="p-3 rounded-2xl bg-emerald-50 border border-emerald-100">
         <div class="text-[0.65rem] font-semibold text-emerald-600 uppercase mb-1">Top Phase Playmaker</div>
         <div class="text-sm font-semibold text-gray-900">
           ${ldEscapeHTML(ldTopPlaymaker.name)}
           <span class="text-[0.6rem] text-gray-500 ml-1">(${ldEscapeHTML(ldTopPlaymaker.displayRole)})</span>
         </div>
         <div class="text-[0.7rem] text-gray-700">
           Roaming/Grouped while stable: ${ldTopPlaymaker.playmaker.toFixed(1)}% of phase minutes.
         </div>
       </div>`
    : `<div class="p-3 rounded-2xl bg-emerald-50/40 border border-dashed border-emerald-100 text-[0.6rem] text-gray-500">
         No clear standout playmaker in this phase.
       </div>`;

  // Table HTML
  const playerRowsHTML = withPlayerMetrics
    .map((p) => {
      const lcColor =
        p.laneControl >= 15 ? "text-emerald-600" :
        p.laneControl >= 5  ? "text-sky-600" :
        p.laneControl <= -10 ? "text-red-500" : "text-gray-700";

      const relColor =
        p.reliability >= 75 ? "text-emerald-600" :
        p.reliability <= 55 ? "text-red-500" : "text-gray-700";

      const playColor =
        p.playmaker >= 14 ? "text-emerald-600" :
        p.playmaker >= 8  ? "text-sky-600" : "text-gray-500";

      const sinkColor = p.pressureSink >= 12 ? "text-red-500" : "text-gray-500";

      const tagTone =
        p.tag.startsWith("Lane Rock") ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
        p.tag.startsWith("Playmaker") ? "bg-sky-50 text-sky-700 border-sky-100" :
        p.tag.startsWith("Resource Carry") ? "bg-amber-50 text-amber-800 border-amber-100" :
        p.tag.includes("Pressure Sink") ? "bg-red-50 text-red-700 border-red-100" :
        p.tag.startsWith("Guest") ? "bg-violet-50 text-violet-700 border-violet-100" :
        "bg-slate-50 text-slate-700 border-slate-100";

      const investmentTag = p.investmentTag || "";
      const invTooltip = investmentTag ? getInvestmentTooltipLD26(investmentTag) : "";
      const invTone =
        investmentTag === "Island Safe" ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
        investmentTag === "Low-Maintenance" ? "bg-emerald-50/60 text-emerald-700 border-emerald-100" :
        investmentTag === "Invest Pays Off" ? "bg-sky-50 text-sky-700 border-sky-100" :
        investmentTag === "Setup Lane" ? "bg-sky-50/70 text-sky-700 border-sky-100" :
        investmentTag === "Volatile Duelist" ? "bg-amber-50 text-amber-800 border-amber-100" :
        investmentTag === "Needs Cover" ? "bg-orange-50 text-orange-800 border-orange-100" :
        investmentTag === "Resource Trap" ? "bg-red-50 text-red-700 border-red-100" : "";

      const guestStar = p.isGuest
        ? `<span class="ml-1 text-[0.6rem] text-violet-500" title="Plays &lt;10% of games in this phase scope">⭐</span>`
        : "";

      const flexMark = p.isFlex ? `<span class="ml-1 text-[0.55rem] text-sky-500">flex</span>` : "";

      const profileTooltip = getProfileTooltipLD26(p.tag);

      const investmentPill = investmentTag
        ? `<span class="inline-flex items-center px-1.5 py-0.5 ml-1 rounded-full text-[0.55rem] border ${invTone}" title="${ldEscapeHTML(invTooltip)}">
             ${ldEscapeHTML(investmentTag)}
           </span>`
        : "";

      const selfTxt = typeof p.selfLead === "number" ? `${p.selfLead.toFixed(0)}%` : "—";
      const helpTxt = typeof p.helpedLead === "number" ? `${p.helpedLead.toFixed(0)}%` : "—";

      return `
        <tr class="hover:bg-orange-50/40 transition">
          <td class="py-1.5 px-2 font-semibold text-gray-800">
            ${ldEscapeHTML(p.name)}${guestStar}
            <span class="text-[0.6rem] text-gray-500 ml-1">(${ldEscapeHTML(p.displayRole)})</span>
            <div class="text-[0.55rem] text-gray-400">${ldEscapeHTML(p.roleMix)}${flexMark}</div>
          </td>
          <td class="py-1.5 px-2 text-right ${lcColor}">${p.laneControl.toFixed(1)}%</td>
          <td class="py-1.5 px-2 text-right ${relColor}">${p.reliability.toFixed(1)}%</td>
          <td class="py-1.5 px-2 text-right text-gray-700">${selfTxt}</td>
          <td class="py-1.5 px-2 text-right text-gray-700">${helpTxt}</td>
          <td class="py-1.5 px-2 text-right ${playColor}">${p.playmaker.toFixed(1)}%</td>
          <td class="py-1.5 px-2 text-right ${sinkColor}">${p.pressureSink.toFixed(1)}%</td>
          <td class="py-1.5 px-2 text-right text-gray-500">${p.games}</td>
          <td class="py-1.5 px-2">
            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[0.6rem] border ${tagTone}" title="${ldEscapeHTML(profileTooltip)}">
              ${ldEscapeHTML(p.tag)}
            </span>
            ${investmentPill}
          </td>
        </tr>
      `;
    })
    .join("");

  const duoHeaderRow = duoRows.length
    ? `<tr class="bg-slate-50/80">
         <td colspan="9" class="px-2 py-1.5 text-[0.65rem] font-semibold text-sky-700">
           Botlane Duos (BOTTOM + SUPPORT)
         </td>
       </tr>`
    : "";

  const duoRowsHTML = duoRows
    .map((d) => {
      const lcColor =
        d.laneControl >= 10 ? "text-emerald-600" :
        d.laneControl >= 3  ? "text-sky-600" :
        d.laneControl <= -8 ? "text-red-500" : "text-gray-700";

      const relColor =
        d.reliability >= 70 ? "text-emerald-600" :
        d.reliability <= 55 ? "text-red-500" : "text-gray-700";

      const playColor =
        d.playmaker >= 12 ? "text-emerald-600" :
        d.playmaker >= 6  ? "text-sky-600" : "text-gray-500";

      const sinkColor = d.pressureSink >= 12 ? "text-red-500" : "text-gray-500";

      const tagTone =
        d.tag.includes("Rock") ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
        d.tag.includes("Playmaker") ? "bg-sky-50 text-sky-700 border-sky-100" :
        d.tag.includes("Pressure Sink") ? "bg-red-50 text-red-700 border-red-100" :
        "bg-slate-50 text-slate-700 border-slate-100";

      const profileTooltip = getProfileTooltipLD26(d.tag);

      return `
        <tr class="hover:bg-orange-50/40 transition">
          <td class="py-1.5 px-2 font-semibold text-gray-800">
            ${ldEscapeHTML(d.name)}
            <div class="text-[0.55rem] text-gray-400">${ldEscapeHTML(d.roleMix)}</div>
          </td>
          <td class="py-1.5 px-2 text-right ${lcColor}">${d.laneControl.toFixed(1)}%</td>
          <td class="py-1.5 px-2 text-right ${relColor}">${d.reliability.toFixed(1)}%</td>
          <td class="py-1.5 px-2 text-right text-gray-400">—</td>
          <td class="py-1.5 px-2 text-right text-gray-400">—</td>
          <td class="py-1.5 px-2 text-right ${playColor}">${d.playmaker.toFixed(1)}%</td>
          <td class="py-1.5 px-2 text-right ${sinkColor}">${d.pressureSink.toFixed(1)}%</td>
          <td class="py-1.5 px-2 text-right text-gray-500">${d.games}</td>
          <td class="py-1.5 px-2">
            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[0.6rem] border ${tagTone}" title="${ldEscapeHTML(profileTooltip)}">
              ${ldEscapeHTML(d.tag)}
            </span>
          </td>
        </tr>
      `;
    })
    .join("");

  // Jungle cards HTML
  let jungleCards = "";
  if (jungleProfiles && jungleProfiles.length) {
    jungleCards = `
      <div class="mt-4">
        <div class="text-[0.65rem] font-semibold text-sky-600 uppercase mb-1">Jungle Profiles</div>
        <div class="flex gap-2 overflow-x-auto pb-1">
          ${jungleProfiles
            .map(
              (j) => `
            <div class="min-w-[160px] p-3 rounded-2xl bg-slate-50 border border-slate-100">
              <div class="text-[0.6rem] font-semibold text-sky-600 uppercase mb-0.5">Jungle Profile</div>
              <div class="text-sm font-semibold text-gray-900">
                ${ldEscapeHTML(j.player)}
                <span class="ml-1 text-[0.6rem] text-gray-500">${ldEscapeHTML(j.style)}</span>
              </div>
              <div class="text-[0.6rem] text-gray-700 mt-0.5 leading-snug">
                Obj presence: ${j.objPresence.toFixed(0)}%<br/>
                Lead → Obj: ${j.leadObj.toFixed(0)}%<br/>
                Gank vs Farm: ${j.gankShare.toFixed(0)}% / ${j.farmShare.toFixed(0)}%<br/>
                ${j.games} g, ${j.mins}m in phase
              </div>
            </div>
          `
            )
            .join("")}
        </div>
      </div>
    `;
  }

  // Render (match your dashboard-card styling)
  mountEl.innerHTML = `
    <div class="card-header">
      <div>
        <div class="card-title">Lane Dynamics & Playmakers</div>
        <div class="card-subtitle">
          Minute-by-minute lane vs opponent analysis. Jungle/Support interpreted via pressure, presence & roaming.
        </div>
      </div>

      <div class="text-right">
        ${phaseButtonsHTML(state.phase)}
        <div class="text-[0.65rem] text-slate-500 mt-2">
          Phase: <span class="font-semibold capitalize">${ldEscapeHTML(state.phase)}</span><br/>
          Timeline games: <span class="font-semibold">${totalTimelineGames}</span>
        </div>
      </div>
    </div>

    <div class="-mx-1 mt-3 overflow-x-auto">
      <table class="min-w-full text-[0.7rem] border-t border-slate-100">
        <thead class="text-slate-500 bg-slate-50/80">
          <tr>
            <th class="text-left py-2 px-2">Player / Duo</th>
            <th class="text-right py-2 px-2">Lane Control</th>
            <th class="text-right py-2 px-2">Reliability</th>
            <th class="text-right py-2 px-2">Self Lead</th>
            <th class="text-right py-2 px-2">Helped Lead</th>
            <th class="text-right py-2 px-2">Playmaker</th>
            <th class="text-right py-2 px-2">Pressure Sink</th>
            <th class="text-right py-2 px-2">Games</th>
            <th class="text-left py-2 px-2">Profile</th>
          </tr>
        </thead>
        <tbody>
          ${playerRowsHTML}
          ${duoHeaderRow}
          ${duoRowsHTML}
        </tbody>
      </table>
    </div>

    <div class="mt-4 grid md:grid-cols-2 gap-3">
      ${bestDuoCard}
      ${topPlaymakerCard}
    </div>

    ${jungleCards}

    <div class="mt-3 text-[0.65rem] text-slate-500 leading-snug">
      <p><strong>How to read:</strong></p>
      <p>
        <strong>Lane Control</strong>: composite of Gold/XP/CS diff vs opponent in this phase.
        <strong>Reliability</strong>: minutes not significantly behind.
        <strong>Self vs Helped Lead</strong>: share of “ahead” minutes alone vs with ally presence.
        <strong>Playmaker</strong>: roaming/grouped/river while stable.
        <strong>Pressure Sink</strong>: behind despite strong ally presence (tightened mid/late).
      </p>
    </div>
  `;

  bindPhaseButtons(mountEl);

  // Debug visibility without spamming:
  // console.log("🧭 Lane Dynamics v3.1", { phase: state.phase, players: withPlayerMetrics.length, duos: duoRows.length });
}

export function mountLaneDynamicsCard(mountEl, seasonRows, timelineRows, opts = {}) {
  if (!mountEl) throw new Error("mountLaneDynamicsCard: missing mount element");
  renderLaneDynamicsInner(mountEl, seasonRows, timelineRows, opts);
}
