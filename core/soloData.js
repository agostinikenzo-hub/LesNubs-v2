// /core/soloData.js
import { fetchCsvText, parseCsv, rowsToObjects } from "./csv.js";
import { parseLooseDate } from "./dates.js";
import { toBool, toNumber } from "./format.js";

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
  // ✅ Reliable field is "Date" like: 08.01.26 15:10
  const dateVal = pick(raw, ["Date", "date"]);
  const d = parseLooseDate(dateVal);
  if (d) return d;

  // Optional epoch fallback (only if it looks like epoch seconds/ms)
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

export async function loadSoloRows({ csvUrl }) {
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
    const player = pick(r, ["p.riotIdGameName", "Player", "p.summonerName", "summonerName"]);
    const role = normalizeRole(
      pick(r, ["ROLE", "p.teamPosition", "p.individualPosition", "p.role", "lane", "role"])
    );

    const matchId = pick(r, ["Match ID", "matchId", "MatchId"]);
    const date = bestDate(r);

    // ✅ Extra fields needed for mini cards / other components
    const visionScore = toNumber(pick(r, ["Vision Score", "p.visionScore", "visionScore"])) ?? 0;
    const enemyMissingPings = toNumber(pick(r, ["p.enemyMissingPings", "enemyMissingPings"])) ?? 0;

    // ✅ Drive multikills from this per-match field
    const largestMultiKill = toNumber(pick(r, ["p.largestMultiKill", "largestMultiKill"])) ?? 0;

    const firstBloodKill = toBool(pick(r, ["p.firstBloodKill", "firstBloodKill"])) ?? false;
    const firstBloodAssist = toBool(pick(r, ["p.firstBloodAssist", "firstBloodAssist"])) ?? false;

    // ✅ Fun stat: total time spent dead (seconds)
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

      // extras
      visionScore,
      enemyMissingPings,
      largestMultiKill,
      firstBloodKill,
      firstBloodAssist,
      timeDeadSec,

      _raw: r,
    };
  });

  // Filter strictly for Solo/Duo where possible
  const solo = normalized.filter((x) => {
    if (x.queueId === 420) return true;
    if (!x.queueId && x.queueType.includes("solo")) return true;
    return false;
  });

  // Sort newest first
  solo.sort((a, b) => (b.date?.getTime?.() ?? 0) - (a.date?.getTime?.() ?? 0));
  return solo;
}
