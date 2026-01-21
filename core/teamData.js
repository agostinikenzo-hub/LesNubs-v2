// /core/teamData.js
import { fetchCsvText, parseCsv, rowsToObjects } from "./csv.js";
import { parseLooseDate } from "./dates.js";
import { toBool, toNumber } from "./format.js";
import { ROSTER_SET } from "./roster.js";

function pick(obj, keys) {
  for (const k of keys) if (k in obj && obj[k] !== "") return obj[k];
  return "";
}

function normalizeRole(raw) {
  const r = String(raw ?? "").trim().toUpperCase();
  if (!r) return "—";
  if (r === "UTILITY" || r === "SUPPORT") return "SUP";
  if (r === "BOTTOM" || r === "ADC") return "BOT";
  if (r === "MIDDLE" || r === "MID") return "MID";
  if (r === "JUNGLE" || r === "JNG") return "JNG";
  if (r === "TOP") return "TOP";
  return r;
}

function computeKda(k, d, a) {
  return (k + a) / Math.max(1, d);
}

function bestDate(raw) {
  const dateVal = pick(raw, ["Date", "date", "DATE"]);
  const d = parseLooseDate(dateVal);
  if (d) return d;

  const maybeEpoch = pick(raw, ["gameCreation", "p.gameCreation", "Game Creation"]);
  const n = Number(String(maybeEpoch ?? "").trim());
  if (Number.isFinite(n) && (n >= 1_000_000_000 || n >= 10_000_000_000)) {
    const dt = parseLooseDate(n);
    if (dt) return dt;
  }

  return null;
}

function parseWin(raw) {
  const v = pick(raw, ["Result", "win", "p.win"]);
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "win") return true;
  if (s === "loss") return false;
  const b = toBool(v);
  return b ?? null;
}

function getPlayerNameRaw(r) {
  return String(pick(r, ["p.riotIdGameName", "Player", "p.summonerName", "summonerName"]) || "").trim();
}

function getMatchIdRaw(r) {
  return String(pick(r, ["Match ID", "matchId", "MatchId", "MatchID", "Game ID", "Game #", "Date"]) || "").trim();
}

/**
 * Load Team rows (5-stack).
 *
 * @param {Object} args
 * @param {string} args.csvUrl - Team tab CSV url (per-player rows expected).
 * @param {string[]} [args.roster] - Override roster list (defaults to /core/roster.js).
 * @param {number} [args.requiredRosterCount=5] - How many roster members must appear per match to keep it.
 * @returns {Promise<Array>} normalized rows, newest first, with `_raw`
 */
export async function loadTeamRows({ csvUrl, roster = null, requiredRosterCount = 5 } = {}) {
  if (!csvUrl) throw new Error("loadTeamRows: missing csvUrl");

  const rosterSet =
    Array.isArray(roster) && roster.length
      ? new Set(roster.map((x) => String(x).trim()).filter(Boolean))
      : ROSTER_SET;

  const text = await fetchCsvText(csvUrl);
  const rows = parseCsv(text);
  const objs = rowsToObjects(rows);

  const normalized = objs.map((r) => {
    const queueId = toNumber(pick(r, ["Queue ID", "queueId", "QueueId"])) ?? null;
    const queueType = String(pick(r, ["Queue Type", "queueType"]) || "").toLowerCase();

    const win = parseWin(r);

    const kills = toNumber(pick(r, ["Kills", "p.kills"])) ?? 0;
    const deaths = toNumber(pick(r, ["Deaths", "p.deaths"])) ?? 0;
    const assists = toNumber(pick(r, ["Assists", "p.assists"])) ?? 0;

    const champion = pick(r, ["Champion", "p.championName", "championName"]);
    const player = getPlayerNameRaw(r);
    const role = normalizeRole(
      pick(r, ["ROLE", "p.teamPosition", "p.individualPosition", "p.role", "lane", "role", "Team Position"])
    );

    const matchId = getMatchIdRaw(r);
    const date = bestDate(r);

    // extras used by mini-cards etc.
    const visionScore = toNumber(pick(r, ["Vision Score", "p.visionScore", "visionScore"])) ?? 0;
    const enemyMissingPings = toNumber(pick(r, ["p.enemyMissingPings", "enemyMissingPings"])) ?? 0;
    const largestMultiKill = toNumber(pick(r, ["p.largestMultiKill", "largestMultiKill"])) ?? 0;
    const firstBloodKill = toBool(pick(r, ["p.firstBloodKill", "firstBloodKill"])) ?? false;
    const firstBloodAssist = toBool(pick(r, ["p.firstBloodAssist", "firstBloodAssist"])) ?? false;
    const timeDeadSec = toNumber(pick(r, ["p.totalTimeSpentDead", "totalTimeSpentDead"])) ?? 0;

    return {
      matchId: String(matchId || ""),
      date,

      queueId,
      queueType,

      player: String(player || "—"),
      champion: String(champion || "—"),
      role,

      win,
      kills,
      deaths,
      assists,
      kda: computeKda(kills, deaths, assists),

      visionScore,
      enemyMissingPings,
      largestMultiKill,
      firstBloodKill,
      firstBloodAssist,
      timeDeadSec,

      _raw: r,
    };
  });

  // Filter out rows that don't even have a matchId
  const withMatch = normalized.filter((x) => x.matchId);

  // Group by matchId -> count roster members in that match
  const rosterCountByMatch = new Map(); // matchId -> Set(rosterPlayers)
  for (const row of withMatch) {
    const name = String(row.player || "").trim();
    if (!name) continue;

    if (!rosterCountByMatch.has(row.matchId)) rosterCountByMatch.set(row.matchId, new Set());
    const set = rosterCountByMatch.get(row.matchId);

    if (rosterSet.has(name)) set.add(name);
  }

  // Keep only "true 5-stack" matches (or whatever requiredRosterCount is)
  const keepMatchIds = new Set();
  for (const [matchId, set] of rosterCountByMatch.entries()) {
    if (set.size === requiredRosterCount) keepMatchIds.add(matchId);
  }

  const team = withMatch.filter((x) => keepMatchIds.has(x.matchId));

  // Sort newest first
  team.sort((a, b) => (b.date?.getTime?.() ?? 0) - (a.date?.getTime?.() ?? 0));

  return team;
}
