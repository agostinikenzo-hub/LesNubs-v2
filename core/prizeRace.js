// /core/prizeRace.js
import { computeTpi26 } from "./tpi26.js";

export const PRIZE_RACE_DEFAULT = {
  WEIGHTS: { TEAM: 0.7, SOLO: 0.1, FLEX: 0.2 },

  // min games per queue to “count” that queue in scoring
  TEAM_MIN_GAMES: 10,
  SOLO_MIN_GAMES: 5,
  FLEX_MIN_GAMES: 5,

  // if true, missing/insufficient queues get weight redistributed to the remaining eligible queues
  IGNORE_MISSING_QUEUES: true,

  // if true, show roster players even if they have 0 eligible games anywhere
  INCLUDE_ROSTER_WITH_ZERO: true,

  // bonus tuning
  PENTA_Z_COEFF: 0.10, // bonus = coeff * z(pentaRate) * 10
};

function toNum(v) {
  if (v === undefined || v === null || v === "") return 0;
  const n = parseFloat(String(v).replace("%", "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function nameOf(r) {
  return String(r?.["p.riotIdGameName"] || r?.["Player"] || r?.["p.summonerName"] || "").trim();
}

function matchIdOf(r) {
  return String(r?.["Match ID"] || r?.["MatchID"] || r?.["Game ID"] || r?.["GameId"] || r?.["Date"] || "").trim();
}

function sumPentakills(rows, roster) {
  const set = new Set(Array.isArray(roster) ? roster : []);
  const by = new Map(); // name -> { games:Set, pentaSum }

  for (const r of rows || []) {
    const n = nameOf(r);
    if (!n) continue;
    if (set.size && !set.has(n)) continue;

    const mid = matchIdOf(r);
    if (!mid) continue;

    if (!by.has(n)) by.set(n, { games: new Set(), pentaSum: 0 });
    const p = by.get(n);

    if (p.games.has(mid)) continue;
    p.games.add(mid);

    p.pentaSum += toNum(r?.["p.pentaKills"] || r?.["Penta Kills"] || 0);
  }

  const out = new Map();
  for (const [n, p] of by.entries()) out.set(n, { games: p.games.size || 0, penta: p.pentaSum || 0 });
  return out;
}

function zScoreMap(valuesByName) {
  const arr = [...valuesByName.entries()].map(([name, v]) => ({ name, v }));
  const vals = arr.map((x) => x.v);
  const mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  const varr = vals.length ? vals.reduce((s, x) => s + (x - mean) ** 2, 0) / vals.length : 0;
  const sd = Math.sqrt(varr) || 1;

  const out = new Map();
  arr.forEach((x) => out.set(x.name, (x.v - mean) / sd));
  return out;
}

function renormalizeWeights(base, have) {
  const w = { ...base };
  const sum = (have.TEAM ? w.TEAM : 0) + (have.SOLO ? w.SOLO : 0) + (have.FLEX ? w.FLEX : 0);

  if (sum <= 0) return { TEAM: 0, SOLO: 0, FLEX: 0 };

  return {
    TEAM: have.TEAM ? w.TEAM / sum : 0,
    SOLO: have.SOLO ? w.SOLO / sum : 0,
    FLEX: have.FLEX ? w.FLEX / sum : 0,
  };
}

/**
 * computePrizeRace
 * @param {Object} data - { teamRows, soloRows, flexRows }
 * @param {Object} opts - { roster, config }
 * @returns {Object} { entries, cfg }
 */
export function computePrizeRace({ teamRows = [], soloRows = [], flexRows = [] } = {}, opts = {}) {
  const cfg = { ...PRIZE_RACE_DEFAULT, ...(opts.config || {}) };
  const roster = Array.isArray(opts.roster) ? opts.roster : null;

  // TPI per queue (roster-scoped inside computeTpi26)
  const team = teamRows.length ? computeTpi26(teamRows, { roster }) : { players: [] };
  const solo = soloRows.length ? computeTpi26(soloRows, { roster }) : { players: [] };
  const flex = flexRows.length ? computeTpi26(flexRows, { roster }) : { players: [] };

  const teamMap = new Map(team.players.map((p) => [p.name, p]));
  const soloMap = new Map(solo.players.map((p) => [p.name, p]));
  const flexMap = new Map(flex.players.map((p) => [p.name, p]));

  // penta bonus (rate = pentas per game)
  const pTeam = sumPentakills(teamRows, roster);
  const pSolo = sumPentakills(soloRows, roster);
  const pFlex = sumPentakills(flexRows, roster);

  // Collect all names (and seed roster if desired)
  const names = new Set([
    ...teamMap.keys(),
    ...soloMap.keys(),
    ...flexMap.keys(),
    ...pTeam.keys(),
    ...pSolo.keys(),
    ...pFlex.keys(),
  ]);

  if (cfg.INCLUDE_ROSTER_WITH_ZERO && Array.isArray(roster)) {
    roster.forEach((n) => names.add(String(n || "").trim()));
  }

  // penta-rate across all queues combined
  const pentaRate = new Map();
  for (const n of names) {
    const a = pTeam.get(n) || { games: 0, penta: 0 };
    const b = pSolo.get(n) || { games: 0, penta: 0 };
    const c = pFlex.get(n) || { games: 0, penta: 0 };

    const g = (a.games || 0) + (b.games || 0) + (c.games || 0);
    const p = (a.penta || 0) + (b.penta || 0) + (c.penta || 0);

    pentaRate.set(n, g > 0 ? p / g : 0);
  }
  const pentaZ = zScoreMap(pentaRate);

  const entries = [];

  for (const n of names) {
    const t = teamMap.get(n);
    const s = soloMap.get(n);
    const f = flexMap.get(n);

    const teamGames = t?.games || 0;
    const soloGames = s?.games || 0;
    const flexGames = f?.games || 0;

    // queue is “eligible” only if it exists AND meets min games
    const haveTeam = !!t && teamGames >= cfg.TEAM_MIN_GAMES;
    const haveSolo = !!s && soloGames >= cfg.SOLO_MIN_GAMES;
    const haveFlex = !!f && flexGames >= cfg.FLEX_MIN_GAMES;

    // If no eligible queues, skip unless we want roster zeros
    if (!haveTeam && !haveSolo && !haveFlex) {
      if (!cfg.INCLUDE_ROSTER_WITH_ZERO) continue;

      // show a zero entry (but don’t apply penta-only bonus)
      entries.push({
        name: n,
        rank: 0,
        prizeScore: 0,
        weights: { TEAM: 0, SOLO: 0, FLEX: 0 },
        games: { team: teamGames, solo: soloGames, flex: flexGames },
        tpi: { team: t?.impact ?? null, solo: s?.impact ?? null, flex: f?.impact ?? null },
        pentas: {
          team: pTeam.get(n)?.penta || 0,
          solo: pSolo.get(n)?.penta || 0,
          flex: pFlex.get(n)?.penta || 0,
        },
        pentaRate: pentaRate.get(n) || 0,
      });
      continue;
    }

    // weights
    let weights = { ...cfg.WEIGHTS };
    if (cfg.IGNORE_MISSING_QUEUES) {
      weights = renormalizeWeights(weights, { TEAM: haveTeam, SOLO: haveSolo, FLEX: haveFlex });
    }

    // base TPI weighted score
    const base =
      (haveTeam ? weights.TEAM * (t?.impact || 0) : 0) +
      (haveSolo ? weights.SOLO * (s?.impact || 0) : 0) +
      (haveFlex ? weights.FLEX * (f?.impact || 0) : 0);

    // penta bonus (only if at least one eligible queue exists)
    const bonus = cfg.PENTA_Z_COEFF * (pentaZ.get(n) || 0) * 10;

    const prizeScore = base + bonus;

    entries.push({
      name: n,
      rank: 0,
      prizeScore,
      weights,
      games: { team: teamGames, solo: soloGames, flex: flexGames },
      tpi: { team: t?.impact ?? null, solo: s?.impact ?? null, flex: f?.impact ?? null },
      pentas: {
        team: pTeam.get(n)?.penta || 0,
        solo: pSolo.get(n)?.penta || 0,
        flex: pFlex.get(n)?.penta || 0,
      },
      pentaRate: pentaRate.get(n) || 0,
    });
  }

  entries.sort((a, b) => (b.prizeScore || 0) - (a.prizeScore || 0));

  // assign rank
  entries.forEach((e, i) => (e.rank = i + 1));

  return { entries, cfg };
}
