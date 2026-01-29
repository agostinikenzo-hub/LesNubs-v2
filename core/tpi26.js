// core/tpi26.js
// Season 26 — Total Player Impact (shared core)
// Pure calculations + trend logic (no DOM)

export const TPI26_DEFAULT = {
  BASE: 40,
  WINSOR_P: 0.05,

  MIN_GAMES_FLOOR: 3,
  SHRINK_FRACTION_OF_MAX: 0.35,

  OBJ_PART_WEIGHTS: {
    Dragon: 0.25,
    Herald: 0.10,
    Baron: 0.30,
    Tower: 0.20,
    //Atakhan: 0.00,
    VoidGrub: 0.15,
  },

  ROLE_PILLAR_WEIGHTS: {
    SUPPORT: { indiv: 0.22, obj: 0.18, vision: 0.35, reli: 0.25 },
    JUNGLE:  { indiv: 0.30, obj: 0.30, vision: 0.18, reli: 0.22 },
    TOP:     { indiv: 0.33, obj: 0.25, vision: 0.12, reli: 0.30 },
    MID:     { indiv: 0.38, obj: 0.25, vision: 0.12, reli: 0.25 },
    ADC:     { indiv: 0.42, obj: 0.25, vision: 0.10, reli: 0.23 },
    UNKNOWN: { indiv: 0.35, obj: 0.25, vision: 0.15, reli: 0.25 },
  },

  METRIC_WEIGHTS: {
    indiv: { kda: 0.18, kp: 0.18, dmgShare: 0.18, dpm: 0.14, goldMin: 0.14, csMin: 0.10, firstBlood: 0.08 },
    obj:   { objKills: 0.38, objPart: 0.30, plates: 0.16, objDmg: 0.16 },
    vision:{ vsMin: 0.30, wardsMin: 0.16, wardsKilledMin: 0.20, denial: 0.18, enemyJunglePct: 0.10, pinkEff: 0.06 },
    reli:  { consistency: 0.22, momentum: 0.18, macroCons: 0.18, perfRating: 0.18, timeDeadRateSafe: 0.14, deathDistSafe: 0.10 },
  },

  TREND_UP: 1.0,
  TREND_DOWN: -1.0,
};

// ------------------------
// Public entry
// ------------------------
export function computeTpi26(rows, opts = {}) {
  const cfg = opts.config || TPI26_DEFAULT;

  const roster = Array.isArray(opts.roster) ? opts.roster : null;
  const scoped = roster ? rows.filter((r) => roster.includes(getPlayerNameAny(r))) : rows.slice();
  if (!scoped.length) return { players: [], meta: { lastMatchId: "", minGamesFull: 0 } };

  const lastMatchId = getLatestMatchId(scoped);

  const baselineRows = lastMatchId ? scoped.filter((r) => getMatchIdAny(r) !== lastMatchId) : scoped.slice();
  const lastRows = lastMatchId ? scoped.filter((r) => getMatchIdAny(r) === lastMatchId) : [];

  // Season (all)
  const seasonRaw = buildPlayersRaw(scoped, cfg);
  const seasonRes = scorePlayers(seasonRaw, cfg, { applyShrink: true });
  const seasonPlayers = seasonRes.players;

  // Baseline (exclude last)
  let baselineImpactMap = new Map();
  let normCtxForLast = seasonRes.normCtx;

  if (baselineRows.length) {
    const baseRaw = buildPlayersRaw(baselineRows, cfg);
    const baseRes = scorePlayers(baseRaw, cfg, { applyShrink: true });
    baselineImpactMap = new Map(baseRes.players.map((p) => [p.name, p.impact]));
    normCtxForLast = baseRes.normCtx;
  }

  // Last game (no shrink)
  const lastImpactMap = new Map();
  if (lastRows.length) {
    const lastRaw = buildPlayersSingleMatch(lastRows, cfg);
    const lastRes = scorePlayers(lastRaw, cfg, { applyShrink: false, normCtx: normCtxForLast });
    lastRes.players.forEach((p) => lastImpactMap.set(p.name, p.impact));
  }

  // inject trend into season players
  seasonPlayers.forEach((p) => {
    const last = lastImpactMap.get(p.name);
    const base = baselineImpactMap.get(p.name);

    if (typeof last === "number" && typeof base === "number") {
      p.delta = last - base;
      p.playedLast = true;
      p.trendOk = true;
    } else if (typeof last === "number") {
      p.delta = null;
      p.playedLast = true;
      p.trendOk = false;
    } else {
      p.delta = null;
      p.playedLast = false;
      p.trendOk = false;
    }
  });

  return {
    players: seasonPlayers,
    meta: { lastMatchId, minGamesFull: seasonRes.minGamesFull },
  };
}

// ------------------------
// 1) season aggregates
// ------------------------
function buildPlayersRaw(rows, cfg) {
  const byPlayer = new Map();

  rows.forEach((r) => {
    const name = getPlayerNameAny(r);
    const matchId = getMatchIdAny(r);
    if (!name || !matchId) return;

    const role = normRole(getRoleAny(r));
    const won = isWinAny(r);

    if (!byPlayer.has(name)) {
      byPlayer.set(name, {
        name,
        gamesSet: new Set(),
        roleFreq: new Map(),
        wins: 0,

        kills: 0, deaths: 0, assists: 0,
        kpSum: 0, kpCount: 0,

        dmgShareSum: 0,
        dpmSum: 0,
        goldMinSum: 0,
        csMinSum: 0,

        firstBloodInvolv: 0,
        fbGamesSet: new Set(),

        objKillsSum: 0,
        objPartDragon: 0, objPartHerald: 0, objPartBaron: 0, objPartTower: 0, objPartAtakhan: 0, objPartVoid: 0,
        platesSum: 0,
        objDmgSum: 0,

        visionScoreSum: 0,
        timePlayedSum: 0,
        wardsPlacedSum: 0,
        wardsKilledSum: 0,
        denialSum: 0,
        enemyJunglePctSum: 0,
        pinkEffSum: 0,

        consistencySum: 0,
        momentumSum: 0,
        macroConsSum: 0,
        perfRatingSum: 0,
        timeDeadSum: 0,
        deathDistSum: 0,
      });
    }

    const p = byPlayer.get(name);
    if (p.gamesSet.has(matchId)) return;
    p.gamesSet.add(matchId);

    p.roleFreq.set(role, (p.roleFreq.get(role) || 0) + 1);
    if (won) p.wins += 1;

    const kills = toNum(getAny(r, ["Kills", "p.kills", "kills"]));
    const deaths = toNum(getAny(r, ["Deaths", "p.deaths", "deaths"]));
    const assists = toNum(getAny(r, ["Assists", "p.assists", "assists"]));
    p.kills += kills; p.deaths += deaths; p.assists += assists;

    const kpRaw = toNum(getAny(r, ["Kill Part %", "p.challenges.killParticipation", "killParticipation"]));
    if (kpRaw > 0) {
      const kpPct = kpRaw <= 1.01 ? kpRaw * 100 : kpRaw;
      p.kpSum += kpPct;
      p.kpCount += 1;
    }

    const dmgShareRaw = toNum(getAny(r, ["Team Damage %", "Damage Share %", "p.challenges.teamDamagePercentage", "teamDamagePercentage"]));
    const dmgSharePct = dmgShareRaw <= 1.01 && dmgShareRaw > 0 ? dmgShareRaw * 100 : dmgShareRaw;
    p.dmgShareSum += dmgSharePct;

    p.dpmSum += toNum(getAny(r, ["Damage per Minute", "p.challenges.damagePerMinute", "damagePerMinute"]));
    p.goldMinSum += toNum(getAny(r, ["Gold/min", "p.challenges.goldPerMinute", "goldPerMinute"]));

    // CS/min: direct else compute
    const csMinDirect = toNum(getAny(r, ["CS/min", "csPerMinute"]));
    if (csMinDirect > 0) {
      p.csMinSum += csMinDirect;
    } else {
      const cs = toNum(getAny(r, ["CS", "p.totalMinionsKilled", "totalMinionsKilled"]));
      const tpSec = toNum(getAny(r, ["p.timePlayed", "timePlayed"]));
      const tMin = tpSec > 0 ? tpSec / 60 : Math.max(1, toNum(getAny(r, ["TIME"])));
      p.csMinSum += tMin > 0 ? (cs / tMin) : 0;
    }

    const fbKill = boolish(getAny(r, ["p.firstBloodKill", "firstBloodKill"]));
    const fbAssist = boolish(getAny(r, ["p.firstBloodAssist", "firstBloodAssist"]));
    if ((fbKill || fbAssist) && !p.fbGamesSet.has(matchId)) {
      p.fbGamesSet.add(matchId);
      p.firstBloodInvolv += 1;
    }

    p.objKillsSum += toNum(getAny(r, ["Objective Kills", "p.challenges.objectiveKills", "objectiveKills"]));
    p.objPartDragon += toNum(getAny(r, ["Dragon Participation"]));
    p.objPartHerald += toNum(getAny(r, ["Herald Participation"]));
    p.objPartBaron += toNum(getAny(r, ["Baron Participation"]));
    p.objPartTower += toNum(getAny(r, ["Tower Participation"]));
    p.objPartAtakhan += toNum(getAny(r, ["Atakhan Participation"]));
    p.objPartVoid += toNum(getAny(r, ["Void Grub Participation"]));

    p.platesSum += toNum(getAny(r, ["Turret Plates Taken", "p.challenges.turretPlatesTaken", "turretPlatesTaken"]));
    p.objDmgSum += toNum(getAny(r, ["p.damageDealtToObjectives", "damageDealtToObjectives"]));

    p.visionScoreSum += toNum(getAny(r, ["Vision Score", "p.visionScore", "visionScore"]));
    const tp = toNum(getAny(r, ["p.timePlayed", "timePlayed"]));
    p.timePlayedSum += tp > 0 ? tp : 0;

    p.wardsPlacedSum += toNum(getAny(r, ["WARDS", "Wards", "p.wardsPlaced", "wardsPlaced"]));
    p.wardsKilledSum += toNum(getAny(r, ["WARDS KILLED", "p.wardsKilled", "wardsKilled"]));
    p.denialSum += toNum(getAny(r, ["Vision Denial Efficiency"]));
    p.enemyJunglePctSum += toNum(getAny(r, ["Wards in Enemy Jungle %"]));
    p.pinkEffSum += toNum(getAny(r, ["Pink Efficiency"]));

    p.consistencySum += toNum(getAny(r, ["Consistency Index"]));
    p.momentumSum += toNum(getAny(r, ["Momentum Stability"]));
    p.macroConsSum += toNum(getAny(r, ["Macro Consistency"]));
    p.perfRatingSum += toNum(getAny(r, ["Performance Rating", "p.challenges.performanceRating", "performanceRating"]));

    p.timeDeadSum += toNum(getAny(r, ["p.totalTimeSpentDead", "totalTimeSpentDead"]));
    p.deathDistSum += toNum(getAny(r, ["Average Death Distance"]));
  });

  return [...byPlayer.values()].map((p) => {
    const games = p.gamesSet.size || 1;
    const winrate = (p.wins / games) * 100;

    const kda = (p.kills + p.assists) / Math.max(1, p.deaths);
    const kp = p.kpCount > 0 ? p.kpSum / p.kpCount : 0;

    const dmgShare = p.dmgShareSum / games;
    const dpm = p.dpmSum / games;
    const goldMin = p.goldMinSum / games;
    const csMin = p.csMinSum / games;

    const firstBloodRate = (p.firstBloodInvolv / games) * 100;

    const objPart =
      cfg.OBJ_PART_WEIGHTS.Dragon  * (p.objPartDragon / games) +
      cfg.OBJ_PART_WEIGHTS.Herald  * (p.objPartHerald / games) +
      cfg.OBJ_PART_WEIGHTS.Baron   * (p.objPartBaron / games) +
      cfg.OBJ_PART_WEIGHTS.Tower   * (p.objPartTower / games) +
      cfg.OBJ_PART_WEIGHTS.Atakhan * (p.objPartAtakhan / games) +
      cfg.OBJ_PART_WEIGHTS.VoidGrub* (p.objPartVoid / games);

    const objKills = p.objKillsSum / games;
    const plates = p.platesSum / games;
    const objDmg = p.objDmgSum / games;

    const timeMin = Math.max(1, (p.timePlayedSum / games) / 60);
    const vsMin = (p.visionScoreSum / games) / timeMin;
    const wardsMin = (p.wardsPlacedSum / games) / timeMin;
    const wardsKilledMin = (p.wardsKilledSum / games) / timeMin;

    const denial = p.denialSum / games;
    const enemyJunglePct = p.enemyJunglePctSum / games;
    const pinkEff = p.pinkEffSum / games;

    const consistency = p.consistencySum / games;
    const momentum = p.momentumSum / games;
    const macroCons = p.macroConsSum / games;
    const perfRating = p.perfRatingSum / games;

    const timeDeadRate = (p.timeDeadSum / games) / Math.max(1, (p.timePlayedSum / games));
    const deathDist = p.deathDistSum / games;

    const roleBreakdown = buildRoleBreakdown(p.roleFreq);

    return {
      name: p.name,
      games,
      wins: p.wins,
      winrate,
      roleBreakdown,

      raw: {
        kda, kp, dmgShare, dpm, goldMin, csMin, firstBloodRate,
        objPart, objKills, plates, objDmg,
        vsMin, wardsMin, wardsKilledMin, denial, enemyJunglePct, pinkEff,
        consistency, momentum, macroCons, perfRating, timeDeadRate, deathDist,
      },

      pillar: { indiv: 0, obj: 0, vision: 0, reli: 0 },
      totalRaw: 0,
      totalShrunk: 0,
      impact: 0,
      delta: null,
      playedLast: false,
      trendOk: false,
      isGuest: false,
    };
  });
}

// ------------------------
// 1b) single-match vectors
// ------------------------
function buildPlayersSingleMatch(matchRows, cfg) {
  const byPlayer = new Map();

  matchRows.forEach((r) => {
    const name = getPlayerNameAny(r);
    if (!name) return;

    const role = normRole(getRoleAny(r));
    const won = isWinAny(r);

    const kills = toNum(getAny(r, ["Kills", "p.kills", "kills"]));
    const deaths = toNum(getAny(r, ["Deaths", "p.deaths", "deaths"]));
    const assists = toNum(getAny(r, ["Assists", "p.assists", "assists"]));
    const kda = (kills + assists) / Math.max(1, deaths);

    const kpRaw = toNum(getAny(r, ["Kill Part %", "p.challenges.killParticipation", "killParticipation"]));
    const kp = kpRaw > 0 ? (kpRaw <= 1.01 ? kpRaw * 100 : kpRaw) : 0;

    const dmgShareRaw = toNum(getAny(r, ["Team Damage %", "Damage Share %", "p.challenges.teamDamagePercentage", "teamDamagePercentage"]));
    const dmgShare = dmgShareRaw > 0 ? (dmgShareRaw <= 1.01 ? dmgShareRaw * 100 : dmgShareRaw) : 0;

    const dpm = toNum(getAny(r, ["Damage per Minute", "p.challenges.damagePerMinute", "damagePerMinute"]));
    const goldMin = toNum(getAny(r, ["Gold/min", "p.challenges.goldPerMinute", "goldPerMinute"]));

    let csMin = toNum(getAny(r, ["CS/min", "csPerMinute"]));
    if (!(csMin > 0)) {
      const cs = toNum(getAny(r, ["CS", "p.totalMinionsKilled", "totalMinionsKilled"]));
      const tpSec = toNum(getAny(r, ["p.timePlayed", "timePlayed"]));
      const tMin = tpSec > 0 ? tpSec / 60 : Math.max(1, toNum(getAny(r, ["TIME"])));
      csMin = tMin > 0 ? (cs / tMin) : 0;
    }

    const fbKill = boolish(getAny(r, ["p.firstBloodKill", "firstBloodKill"]));
    const fbAssist = boolish(getAny(r, ["p.firstBloodAssist", "firstBloodAssist"]));
    const firstBloodRate = (fbKill || fbAssist) ? 100 : 0;

    const objPart =
      cfg.OBJ_PART_WEIGHTS.Dragon  * toNum(getAny(r, ["Dragon Participation"])) +
      cfg.OBJ_PART_WEIGHTS.Herald  * toNum(getAny(r, ["Herald Participation"])) +
      cfg.OBJ_PART_WEIGHTS.Baron   * toNum(getAny(r, ["Baron Participation"])) +
      cfg.OBJ_PART_WEIGHTS.Tower   * toNum(getAny(r, ["Tower Participation"])) +
      cfg.OBJ_PART_WEIGHTS.Atakhan * toNum(getAny(r, ["Atakhan Participation"])) +
      cfg.OBJ_PART_WEIGHTS.VoidGrub* toNum(getAny(r, ["Void Grub Participation"]));

    const objKills = toNum(getAny(r, ["Objective Kills", "p.challenges.objectiveKills", "objectiveKills"]));
    const plates = toNum(getAny(r, ["Turret Plates Taken", "p.challenges.turretPlatesTaken", "turretPlatesTaken"]));
    const objDmg = toNum(getAny(r, ["p.damageDealtToObjectives", "damageDealtToObjectives"]));

    const visionScore = toNum(getAny(r, ["Vision Score", "p.visionScore", "visionScore"]));
    const tpSec = toNum(getAny(r, ["p.timePlayed", "timePlayed"]));
    const timeMin = Math.max(1, (tpSec > 0 ? tpSec / 60 : Math.max(1, toNum(getAny(r, ["TIME"])))));
    const vsMin = visionScore / timeMin;

    const wardsMin = toNum(getAny(r, ["WARDS", "Wards", "p.wardsPlaced", "wardsPlaced"])) / timeMin;
    const wardsKilledMin = toNum(getAny(r, ["WARDS KILLED", "p.wardsKilled", "wardsKilled"])) / timeMin;

    const denial = toNum(getAny(r, ["Vision Denial Efficiency"]));
    const enemyJunglePct = toNum(getAny(r, ["Wards in Enemy Jungle %"]));
    const pinkEff = toNum(getAny(r, ["Pink Efficiency"]));

    const consistency = toNum(getAny(r, ["Consistency Index"]));
    const momentum = toNum(getAny(r, ["Momentum Stability"]));
    const macroCons = toNum(getAny(r, ["Macro Consistency"]));
    const perfRating = toNum(getAny(r, ["Performance Rating", "p.challenges.performanceRating", "performanceRating"]));

    const timeDead = toNum(getAny(r, ["p.totalTimeSpentDead", "totalTimeSpentDead"]));
    const timeDeadRate = (tpSec > 0) ? (timeDead / tpSec) : 0;

    const deathDist = toNum(getAny(r, ["Average Death Distance"]));

    byPlayer.set(name, {
      name,
      games: 1,
      wins: won ? 1 : 0,
      winrate: won ? 100 : 0,
      roleBreakdown: [{ role, count: 1, share: 1 }],

      raw: {
        kda, kp, dmgShare, dpm, goldMin, csMin, firstBloodRate,
        objPart, objKills, plates, objDmg,
        vsMin, wardsMin, wardsKilledMin, denial, enemyJunglePct, pinkEff,
        consistency, momentum, macroCons, perfRating, timeDeadRate, deathDist,
      },

      pillar: { indiv: 0, obj: 0, vision: 0, reli: 0 },
      totalRaw: 0,
      totalShrunk: 0,
      impact: 0,
      delta: null,
      playedLast: true,
      trendOk: false,
      isGuest: false,
    });
  });

  return [...byPlayer.values()];
}

// ------------------------
// 2) scoring
// ------------------------
function scorePlayers(players, cfg, opts = {}) {
  if (!players.length) return { players: [], normCtx: null, minGamesFull: 0 };

  const applyShrink = opts.applyShrink !== false;
  const normCtx = opts.normCtx || buildNormCtx(players, cfg);

  const normMetric = (k, v, invert = false) => {
    const b = normCtx.bounds[k] || { lo: 0, hi: 1 };
    const mm = normCtx.minmax[k] || { min: 0, max: 1 };

    const w = clamp(winsorize(v, b.lo, b.hi), b.lo, b.hi);
    const x = mm.max === mm.min ? 0.5 : (w - mm.min) / (mm.max - mm.min);
    const clamped = clamp(x, 0, 1);
    return invert ? 1 - clamped : clamped;
  };

  players.forEach((p) => {
    const R = p.raw;

    const nKDA = normMetric("kda", R.kda);
    const nKP = normMetric("kp", R.kp);
    const nDmg = normMetric("dmgShare", R.dmgShare);
    const nDPM = normMetric("dpm", R.dpm);
    const nGold = normMetric("goldMin", R.goldMin);
    const nCS = normMetric("csMin", R.csMin);
    const nFB = normMetric("firstBloodRate", R.firstBloodRate);

    p.pillar.indiv =
      cfg.METRIC_WEIGHTS.indiv.kda * nKDA +
      cfg.METRIC_WEIGHTS.indiv.kp * nKP +
      cfg.METRIC_WEIGHTS.indiv.dmgShare * nDmg +
      cfg.METRIC_WEIGHTS.indiv.dpm * nDPM +
      cfg.METRIC_WEIGHTS.indiv.goldMin * nGold +
      cfg.METRIC_WEIGHTS.indiv.csMin * nCS +
      cfg.METRIC_WEIGHTS.indiv.firstBlood * nFB;

    const nObjKills = normMetric("objKills", R.objKills);
    const nObjPart = normMetric("objPart", R.objPart);
    const nPlates = normMetric("plates", R.plates);
    const nObjDmg = normMetric("objDmg", R.objDmg);

    p.pillar.obj =
      cfg.METRIC_WEIGHTS.obj.objKills * nObjKills +
      cfg.METRIC_WEIGHTS.obj.objPart * nObjPart +
      cfg.METRIC_WEIGHTS.obj.plates * nPlates +
      cfg.METRIC_WEIGHTS.obj.objDmg * nObjDmg;

    const nVsMin = normMetric("vsMin", R.vsMin);
    const nWMin = normMetric("wardsMin", R.wardsMin);
    const nWKMin = normMetric("wardsKilledMin", R.wardsKilledMin);
    const nDenial = normMetric("denial", R.denial);
    const nEJ = normMetric("enemyJunglePct", R.enemyJunglePct);
    const nPinkEff = normMetric("pinkEff", R.pinkEff);

    p.pillar.vision =
      cfg.METRIC_WEIGHTS.vision.vsMin * nVsMin +
      cfg.METRIC_WEIGHTS.vision.wardsMin * nWMin +
      cfg.METRIC_WEIGHTS.vision.wardsKilledMin * nWKMin +
      cfg.METRIC_WEIGHTS.vision.denial * nDenial +
      cfg.METRIC_WEIGHTS.vision.enemyJunglePct * nEJ +
      cfg.METRIC_WEIGHTS.vision.pinkEff * nPinkEff;

    const nCons = normMetric("consistency", R.consistency);
    const nMom = normMetric("momentum", R.momentum);
    const nMacro = normMetric("macroCons", R.macroCons);
    const nPR = normMetric("perfRating", R.perfRating);
    const nTimeDeadSafe = normMetric("timeDeadRate", R.timeDeadRate, true);
    const nDeathDistSafe = normMetric("deathDist", R.deathDist, true);

    p.pillar.reli =
      cfg.METRIC_WEIGHTS.reli.consistency * nCons +
      cfg.METRIC_WEIGHTS.reli.momentum * nMom +
      cfg.METRIC_WEIGHTS.reli.macroCons * nMacro +
      cfg.METRIC_WEIGHTS.reli.perfRating * nPR +
      cfg.METRIC_WEIGHTS.reli.timeDeadRateSafe * nTimeDeadSafe +
      cfg.METRIC_WEIGHTS.reli.deathDistSafe * nDeathDistSafe;

    const w = blendRolePillarWeights(p.roleBreakdown, cfg);
    p.totalRaw = w.indiv * p.pillar.indiv + w.obj * p.pillar.obj + w.vision * p.pillar.vision + w.reli * p.pillar.reli;
  });

  let minGamesFull = 0;
  if (applyShrink) {
    const maxGames = Math.max(...players.map((p) => p.games || 1)) || 1;
    minGamesFull = Math.max(cfg.MIN_GAMES_FLOOR, Math.round(maxGames * cfg.SHRINK_FRACTION_OF_MAX));
    const mean = players.reduce((s, p) => s + (p.totalRaw || 0.5), 0) / Math.max(1, players.length);

    players.forEach((p) => {
      const g = p.games || 0;
      const sampleFactor = clamp(g / minGamesFull, 0, 1);
      p.totalShrunk = sampleFactor * p.totalRaw + (1 - sampleFactor) * mean;
      p.impact = cfg.BASE + p.totalShrunk * (100 - cfg.BASE);
      p.isGuest = g < minGamesFull;
    });
  } else {
    players.forEach((p) => {
      p.totalShrunk = p.totalRaw;
      p.impact = cfg.BASE + p.totalRaw * (100 - cfg.BASE);
      p.isGuest = false;
    });
  }

  players.sort((a, b) => {
    if ((a.isGuest || false) !== (b.isGuest || false)) return a.isGuest ? 1 : -1;
    return b.impact - a.impact;
  });

  return { players, normCtx, minGamesFull };
}

function buildNormCtx(players, cfg) {
  const metricKeys = Object.keys(players[0].raw || {});
  const metricSeries = {};
  metricKeys.forEach((k) => (metricSeries[k] = players.map((p) => p.raw[k])));

  const bounds = {};
  const minmax = {};
  metricKeys.forEach((k) => {
    bounds[k] = winsorBounds(metricSeries[k], cfg.WINSOR_P);
    minmax[k] = minmaxOfSeries(metricSeries[k], bounds[k]);
  });

  return { bounds, minmax };
}

// ------------------------
// last match detection
// ------------------------
function getLatestMatchId(rows) {
  const matchMeta = new Map(); // id -> maxDateMs
  rows.forEach((r) => {
    const id = getMatchIdAny(r);
    if (!id) return;
    const d = parseDateEU(getAny(r, ["Date", "DATE"]));
    const ms = d ? d.getTime() : 0;
    const prev = matchMeta.get(id);
    if (prev === undefined || ms > prev) matchMeta.set(id, ms);
  });

  if (!matchMeta.size) return "";
  return [...matchMeta.entries()].sort((a, b) => (b[1] - a[1]) || String(b[0]).localeCompare(String(a[0])))[0][0];
}

// ------------------------
// role helpers
// ------------------------
function buildRoleBreakdown(roleFreqMap) {
  const entries = [...(roleFreqMap?.entries?.() || [])]
    .map(([role, count]) => ({ role: String(role || "UNKNOWN"), count: count || 0 }))
    .filter((x) => x.count > 0);

  if (!entries.length) return [{ role: "UNKNOWN", count: 1, share: 1 }];

  const total = entries.reduce((s, x) => s + x.count, 0) || 1;
  entries.sort((a, b) => b.count - a.count);
  return entries.map((x) => ({ ...x, share: x.count / total }));
}

function blendRolePillarWeights(roleBreakdown, cfg) {
  const out = { indiv: 0, obj: 0, vision: 0, reli: 0 };
  const rbs = Array.isArray(roleBreakdown) && roleBreakdown.length ? roleBreakdown : [{ role: "UNKNOWN", share: 1 }];

  rbs.forEach((rb) => {
    const role = normRole(rb.role);
    const w = cfg.ROLE_PILLAR_WEIGHTS[role] || cfg.ROLE_PILLAR_WEIGHTS.UNKNOWN;
    const s = typeof rb.share === "number" ? rb.share : 0;
    out.indiv += w.indiv * s;
    out.obj += w.obj * s;
    out.vision += w.vision * s;
    out.reli += w.reli * s;
  });

  const sum = out.indiv + out.obj + out.vision + out.reli || 1;
  out.indiv /= sum; out.obj /= sum; out.vision /= sum; out.reli /= sum;
  return out;
}

// ------------------------
// getters (flexible)
 // ------------------------
function getAny(row, keys) {
  for (const k of keys) {
    if (k in row && row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== "") return row[k];
  }
  return "";
}

function getPlayerNameAny(r) {
  return String(r["p.riotIdGameName"] || r["Player"] || r["p.summonerName"] || "").trim();
}
function getMatchIdAny(r) {
  return String(r["Match ID"] || r["MatchID"] || r["Game ID"] || r["Game #"] || r["Date"] || "").trim();
}
function isWinAny(r) {
  const v = String(r["Result"] || r["p.win"] || "").trim().toLowerCase();
  if (v === "win") return true;
  if (v === "loss") return false;
  return boolish(r["p.win"]);
}
function getRoleAny(r) {
  return String(r["ROLE"] || r["Team Position"] || r["p.teamPosition"] || r["p.individualPosition"] || r["p.role"] || "").trim();
}

function normRole(role) {
  const R = String(role || "").toUpperCase();
  if (R.includes("JUNG")) return "JUNGLE";
  if (R.includes("SUP")) return "SUPPORT";
  if (R.includes("BOT") || R.includes("ADC")) return "ADC";
  if (R.includes("MID")) return "MID";
  if (R.includes("TOP")) return "TOP";
  return "UNKNOWN";
}

// ------------------------
// stats helpers
// ------------------------
function toNum(v) {
  if (v === undefined || v === null || v === "") return 0;
  const n = parseFloat(String(v).replace("%", "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}
function boolish(v) {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "y";
}
function clamp(x, a, b) {
  return Math.max(a, Math.min(b, x));
}

function quantile(sortedArr, q) {
  if (!sortedArr.length) return 0;
  const pos = (sortedArr.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sortedArr[base + 1] === undefined) return sortedArr[base];
  return sortedArr[base] + rest * (sortedArr[base + 1] - sortedArr[base]);
}

function winsorBounds(arr, p) {
  const v = arr.filter((x) => typeof x === "number" && isFinite(x)).slice().sort((a, b) => a - b);
  if (!v.length) return { lo: 0, hi: 1 };
  return { lo: quantile(v, p), hi: quantile(v, 1 - p) };
}

function winsorize(x, lo, hi) {
  if (!isFinite(x)) return lo;
  return clamp(x, lo, hi);
}

function minmaxOfSeries(arr, b) {
  const v = arr
    .map((x) => winsorize(x, b.lo, b.hi))
    .filter((x) => typeof x === "number" && isFinite(x));
  if (!v.length) return { min: 0, max: 1 };
  return { min: Math.min(...v), max: Math.max(...v) };
}

function parseDateEU(s) {
  const str = String(s || "").trim();
  if (!str) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const d = new Date(str);
    return isFinite(d) ? d : null;
  }

  const m = str.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (!m) return null;

  const dd = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10) - 1;
  let yy = parseInt(m[3], 10);
  const hh = m[4] ? parseInt(m[4], 10) : 0;
  const min = m[5] ? parseInt(m[5], 10) : 0;
  if (yy < 100) yy += 2000;

  const d = new Date(yy, mm, dd, hh, min, 0);
  return isFinite(d) ? d : null;
}
