// /core/objectivesWinImpact.js
// Pure computation: group rows into matches, compute win-rate lifts by objective signals.

function pick(row, keys) {
  for (const k of keys) {
    if (row && k in row && row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== "") return row[k];
  }
  return "";
}

function toNum(v) {
  if (v === undefined || v === null || v === "") return 0;
  const n = parseFloat(String(v).replace("%", "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function toBool(v) {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "win") return true;
  if (s === "loss") return false;
  if (s === "true" || s === "1" || s === "yes" || s === "y") return true;
  if (s === "false" || s === "0" || s === "no" || s === "n") return false;
  return null;
}

function getMatchId(r) {
  return String(pick(r, ["Match ID", "MatchID", "matchId", "Game ID", "Game #", "Date"]) || "").trim();
}

function getTeamId(r) {
  const v = pick(r, ["teamId", "TeamId", "Team ID", "p.teamId"]);
  const n = toNum(v);
  return n ? n : null;
}

function getWin(r) {
  const v = pick(r, ["Result", "p.win", "win"]);
  const b = toBool(v);
  return b ?? false;
}

function getTimePlayedSec(r) {
  const v = pick(r, ["p.timePlayed", "timePlayed"]);
  const n = toNum(v);
  if (n > 0) return n;
  // fallback: TIME "mm:ss"
  const t = String(pick(r, ["TIME", "Game Time"]) || "").trim();
  if (t.includes(":")) {
    const [m, s] = t.split(":").map((x) => toNum(x));
    return Math.max(0, m * 60 + s);
  }
  return 0;
}

function getPlayerName(r) {
  return String(pick(r, ["p.riotIdGameName", "Player", "p.summonerName"]) || "").trim();
}

function median(arr) {
  const v = arr.filter((x) => Number.isFinite(x)).slice().sort((a, b) => a - b);
  if (!v.length) return 0;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

function winRate(items) {
  if (!items.length) return null;
  const w = items.reduce((s, x) => s + (x.win ? 1 : 0), 0);
  return (w / items.length) * 100;
}

function splitBy(items, predicate) {
  const yes = [];
  const no = [];
  for (const it of items) (predicate(it) ? yes : no).push(it);
  return { yes, no };
}

export function computeObjectiveWinImpact(rows, opts = {}) {
  const excludeRemakesUnderSec = opts.excludeRemakesUnderSec ?? 240;

  // 1) collapse rows to match-level records
  const byMatch = new Map();

  for (const r of rows || []) {
    const matchId = getMatchId(r);
    if (!matchId) continue;

    const tp = getTimePlayedSec(r);
    const earlySurrender = toBool(pick(r, ["p.gameEndedInEarlySurrender", "gameEndedInEarlySurrender"])) === true;
    const eligible = toBool(pick(r, ["p.eligibleForProgression", "eligibleForProgression"]));
    if (tp > 0 && tp < excludeRemakesUnderSec) continue;
    if (earlySurrender) continue;
    if (eligible === false) continue;

    let m = byMatch.get(matchId);
    if (!m) {
      m = {
        matchId,
        teamId: getTeamId(r),
        win: getWin(r),

        // team-ish counts (often duplicated per row) -> keep max
        teamDragons: 0,
        teamBarons: 0,
        teamHeralds: 0,
        teamTowers: 0,
        teamElders: 0,

        totalObjTeam: null,
        totalObjEnemy: null,

        baronCtrl: null,
        towerCtrl: null,

        // sums across our rows (good for team pages; solo will just be player value)
        plates: 0,
        turretDmg: 0,
        buildingDmg: 0,
        soloTurretsLate: 0,

        _seenPlayers: new Set(),
      };
      byMatch.set(matchId, m);
    }

    // win consistency: if any row says true, keep it true (should match anyway)
    m.win = m.win || getWin(r);

    // Prefer derived columns if present:
    m.teamDragons = Math.max(m.teamDragons, toNum(pick(r, ["Dragon Kills", "p.dragonKills", "dragonKills"])));
    m.teamBarons  = Math.max(m.teamBarons,  toNum(pick(r, ["Baron Kills", "p.challenges.teamBaronKills", "p.baronKills", "baronKills"])));
    m.teamHeralds = Math.max(m.teamHeralds, toNum(pick(r, ["Herald Kills", "p.challenges.teamRiftHeraldKills", "p.challenges.riftHeraldTakedowns"])));
    m.teamTowers  = Math.max(m.teamTowers,  toNum(pick(r, ["Tower Kills", "p.turretTakedowns", "p.challenges.turretTakedowns"])));
    m.teamElders  = Math.max(m.teamElders,  toNum(pick(r, ["p.challenges.teamElderDragonKills", "teamElderDragonKills"])));

    const totT = pick(r, ["Total Objectives (Team)"]);
    const totE = pick(r, ["Total Objectives (Enemy)"]);
    if (totT !== "") m.totalObjTeam = toNum(totT);
    if (totE !== "") m.totalObjEnemy = toNum(totE);

    const bCtrl = pick(r, ["Baron Control %"]);
    const tCtrl = pick(r, ["Tower Control %"]);
    if (bCtrl !== "") m.baronCtrl = toNum(bCtrl) <= 1.01 ? toNum(bCtrl) * 100 : toNum(bCtrl);
    if (tCtrl !== "") m.towerCtrl = toNum(tCtrl) <= 1.01 ? toNum(tCtrl) * 100 : toNum(tCtrl);

    // Additive / team-sum-ish metrics — sum once per player per match to avoid duplicates
    const player = getPlayerName(r) || "__row__";
    if (!m._seenPlayers.has(player)) {
      m._seenPlayers.add(player);

      m.plates += toNum(pick(r, ["p.challenges.turretPlatesTaken", "turretPlatesTaken"]));
      m.turretDmg += toNum(pick(r, ["p.damageDealtToTurrets", "damageDealtToTurrets"]));
      m.buildingDmg += toNum(pick(r, ["p.damageDealtToBuildings", "damageDealtToBuildings"]));
      m.soloTurretsLate += toNum(pick(r, ["p.challenges.soloTurretsLategame", "soloTurretsLategame"]));
    }
  }

  const matches = [...byMatch.values()].map((m) => {
    delete m._seenPlayers;
    return m;
  });

  // 2) derive thresholds
  const medPlates = median(matches.map((m) => m.plates));
  const medTurretDmg = median(matches.map((m) => m.turretDmg + m.buildingDmg + m.soloTurretsLate * 1500));

  // 3) compute objective splits
  const overall = { n: matches.length, winRate: winRate(matches) };

  const defs = [
    { key: "dragons3", label: "Dragons (≥ 3)", yes: (m) => m.teamDragons >= 3 },
    { key: "soul", label: "Dragon Soul (≥ 4 dragons)", yes: (m) => m.teamDragons >= 4 },
    { key: "elder", label: "Elder (≥ 1)", yes: (m) => m.teamElders >= 1 },
    { key: "baron", label: "Baron (≥ 1)", yes: (m) => m.teamBarons >= 1 },
    { key: "herald", label: "Herald (≥ 1)", yes: (m) => m.teamHeralds >= 1 },
    { key: "towersHigh", label: "Towers (high)", yes: (m) => m.teamTowers > 0 && m.teamTowers >= 6 },
    { key: "platesHigh", label: `Plates (≥ median ${Math.round(medPlates)})`, yes: (m) => m.plates >= medPlates && medPlates > 0 },
    { key: "baronCtrl", label: "Baron Control % (≥ 50%)", yes: (m) => typeof m.baronCtrl === "number" && m.baronCtrl >= 50 },
    { key: "towerCtrl", label: "Tower Control % (≥ 50%)", yes: (m) => typeof m.towerCtrl === "number" && m.towerCtrl >= 50 },
    {
      key: "objLead",
      label: "Total objectives lead",
      yes: (m) => typeof m.totalObjTeam === "number" && typeof m.totalObjEnemy === "number" && m.totalObjTeam > m.totalObjEnemy,
    },
    {
      key: "splitpushProxy",
      label: "Side Lane Pressure (high)",
      yes: (m) => (m.turretDmg + m.buildingDmg + m.soloTurretsLate * 1500) >= medTurretDmg && medTurretDmg > 0,
    },
  ];

  const splits = defs.map((d) => {
    const { yes, no } = splitBy(matches, d.yes);
    const wrYes = winRate(yes);
    const wrNo = winRate(no);
    const lift = typeof wrYes === "number" && typeof wrNo === "number" ? wrYes - wrNo : null;

    return {
      key: d.key,
      label: d.label,
      nYes: yes.length,
      nNo: no.length,
      wrYes,
      wrNo,
      lift,
    };
  });

  return { overall, splits, meta: { medPlates, medTurretPressure: medTurretDmg } };
}
