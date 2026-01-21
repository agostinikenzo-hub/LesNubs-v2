// /core/lpData.js
import { fetchCsvText, parseCsv, rowsToObjects } from "./csv.js";
import { parseLooseDate } from "./dates.js";
import { toNumber } from "./format.js";

function pick(obj, keys) {
  for (const k of keys) {
    if (k in obj && obj[k] !== "" && obj[k] != null) return obj[k];
  }
  return "";
}

function fmtISODate(d) {
  if (!d || !d.getTime || Number.isNaN(d.getTime())) return "";
  // always YYYY-MM-DD, no timezone string clutter
  return d.toISOString().slice(0, 10);
}

function fmtISOUTC(d) {
  if (!d || !d.getTime || Number.isNaN(d.getTime())) return "";
  // "YYYY-MM-DD HH:MM:SS" in UTC
  const iso = d.toISOString(); // YYYY-MM-DDTHH:MM:SS.sssZ
  return iso.replace("T", " ").slice(0, 19);
}

// Robust UTC parser for:
// - "YYYY-MM-DD HH:MM:SS"
// - "YYYY-MM-DDTHH:MM:SS.sssZ"
// - "YYYY-MM-DDTHH:MM:SS.ffffffZ" (microseconds from sheet keys)
function parseSnapshotUtcFlexible(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return null;

  // "YYYY-MM-DD HH:MM:SS" (treat as UTC)
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (m) {
    const yy = Number(m[1]);
    const mm = Number(m[2]) - 1;
    const dd = Number(m[3]);
    const hh = Number(m[4]);
    const mi = Number(m[5]);
    const ss = Number(m[6]);
    const d = new Date(Date.UTC(yy, mm, dd, hh, mi, ss));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // "YYYY-MM-DDTHH:MM:SS(.fraction)?Z"
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?Z$/);
  if (m) {
    const yy = Number(m[1]);
    const mm = Number(m[2]) - 1;
    const dd = Number(m[3]);
    const hh = Number(m[4]);
    const mi = Number(m[5]);
    const ss = Number(m[6]);

    const frac = String(m[7] ?? "");
    const ms = frac ? Number((frac + "000").slice(0, 3)) : 0;

    const d = new Date(Date.UTC(yy, mm, dd, hh, mi, ss, ms));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // Fallback to your shared loose parser (could be local-time)
  const d2 = parseLooseDate(s);
  return d2 || null;
}

function parseSnapshotDate(raw) {
  // Prefer Snapshot UTC if present: "YYYY-MM-DD HH:MM:SS" (UTC)
  const utc = pick(raw, ["Snapshot UTC", "snapshotUtc", "snapshot_utc"]);
  const d1 = parseSnapshotUtcFlexible(utc);
  if (d1) return d1;

  // Fallback: Snapshot Date: "YYYY-MM-DD"
  const date = pick(raw, ["Snapshot Date", "snapshotDate", "snapshot_date"]);
  const d2 = parseLooseDate(date);
  if (d2) return d2;

  // Fallback: generic Date if someone renamed it
  const d3 = parseLooseDate(pick(raw, ["Date", "date"]));
  if (d3) return d3;

  return null;
}

function normQueue(q) {
  const s = String(q ?? "").trim().toUpperCase();
  if (s === "RANKED_SOLO_5X5" || s === "SOLO" || s.includes("SOLO")) return "SOLO";
  if (s === "RANKED_FLEX_SR" || s === "FLEX" || s.includes("FLEX")) return "FLEX";
  return s || "—";
}

export async function loadLpRows({ csvUrl }) {
  const text = await fetchCsvText(csvUrl);
  const rows = parseCsv(text);
  const objs = rowsToObjects(rows);

  const normalized = objs.map((r) => {
    const riotId = String(
      pick(r, ["Riot ID", "riotId", "RiotID", "riot_id", "Summoner Name", "summonerName"]) || ""
    ).trim();

    const queue = normQueue(
      pick(r, ["Queue", "queue", "Queue Label", "queueLabel", "QueueType", "queueType"])
    );
    const queueType = String(pick(r, ["QueueType", "queueType", "Queue Type", "queue_type"]) || "").trim();

    const tier = String(pick(r, ["Tier", "tier"]) || "UNRANKED").trim().toUpperCase();
    const division = String(pick(r, ["Division", "division", "Rank", "rank"]) || "").trim().toUpperCase();

    const lp = toNumber(pick(r, ["LP", "leaguePoints", "League Points", "league_points"])) ?? 0;
    const wins = toNumber(pick(r, ["Wins", "wins"])) ?? 0;
    const losses = toNumber(pick(r, ["Losses", "losses"])) ?? 0;

    const winrate =
      toNumber(pick(r, ["Winrate", "winrate"])) ??
      (wins + losses > 0 ? Math.round((wins / (wins + losses)) * 1000) / 10 : 0);

    const rankIndex = toNumber(pick(r, ["Rank Index", "rankIndex", "rank_index"])) ?? -1;

    const currentRank = String(pick(r, ["Current Rank", "currentRank", "CurrentRank"]) || "").trim();

    // Parse timestamps (prefer Snapshot UTC)
    const snapshotDate = parseSnapshotDate(r);

    // ✅ Keep CSV-provided Snapshot Date if present, otherwise derive from snapshotDate
    const rawSnapDateStr = String(pick(r, ["Snapshot Date", "snapshotDate", "snapshot_date"]) || "").trim();
    const snapshotDateStr = rawSnapDateStr || fmtISODate(snapshotDate);

    // Prefer raw Snapshot UTC (sheet) but keep a clean fallback
    const rawUtcStr = String(pick(r, ["Snapshot UTC", "snapshotUtc", "snapshot_utc"]) || "").trim();
    const snapshotUtcStr = rawUtcStr || fmtISOUTC(snapshotDate);

    // ✅ Use Snapshot UTC ordering reliably (multi-snapshots per day)
    const snapshotTs = snapshotDate?.getTime?.() ?? 0;

    // Keys (newer script may have Snapshot Day Key / Sig)
    const snapshotKey = String(pick(r, ["Snapshot Key", "snapshotKey", "snapshot_key"]) || "").trim();
    const snapshotDayKey = String(pick(r, ["Snapshot Day Key", "snapshotDayKey"]) || "").trim();
    const snapshotSig = String(pick(r, ["Snapshot Sig", "snapshotSig"]) || "").trim();

    return {
      riotId,
      baseName: riotId.split("#")[0]?.trim() || riotId || "—",

      queue,
      queueType,

      tier,
      division,
      lp,
      wins,
      losses,
      winrate,
      rankIndex,
      currentRank,

      snapshotDate,
      snapshotDateStr,
      snapshotUtcStr,
      snapshotTs,
      snapshotKey,
      snapshotDayKey,
      snapshotSig,

      _raw: r,
    };
  });

  const cleaned = normalized.filter((x) => x.riotId && x.queue !== "—");

  // Sort oldest -> newest (by true timestamp)
  cleaned.sort((a, b) => (a.snapshotTs ?? 0) - (b.snapshotTs ?? 0));
  return cleaned;
}

export function buildLpIndex(rows) {
  const map = new Map();
  for (const r of rows) {
    const key = `${r.riotId}||${r.queue}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(r);
  }
  for (const [k, arr] of map.entries()) {
    arr.sort((a, b) => (a.snapshotTs ?? 0) - (b.snapshotTs ?? 0));
    map.set(k, arr);
  }
  return map;
}

export function latestByPlayer(rows) {
  const out = new Map();
  for (const r of rows) {
    if (!r.riotId) continue;
    if (!out.has(r.riotId)) out.set(r.riotId, { SOLO: null, FLEX: null });

    const slot = out.get(r.riotId);
    const prev = slot[r.queue];

    const tPrev = prev?.snapshotTs ?? (prev?.snapshotDate?.getTime?.() ?? -1);
    const tCur = r.snapshotTs ?? (r.snapshotDate?.getTime?.() ?? -1);

    if (!prev || tCur >= tPrev) slot[r.queue] = r;
  }
  return out;
}

export function getDelta(indexMap, riotId, queue) {
  const key = `${riotId}||${queue}`;
  const arr = indexMap.get(key) || [];
  if (arr.length < 2) return null;

  const last = arr[arr.length - 1];
  const prev = arr[arr.length - 2];

  const a = Number(last.rankIndex);
  const b = Number(prev.rankIndex);

  // ✅ Canonical delta: Rank Index encodes tier/div + LP (e.g. 10.67 => +67 LP in that bucket)
  // Works across promotions/demotions, which is exactly where `last.lp - prev.lp` breaks.
  if (Number.isFinite(a) && Number.isFinite(b) && a >= 0 && b >= 0) {
    const deltaLP = Math.round((a - b) * 100);
    return {
      deltaIndex: a - b,
      deltaLP: Number.isFinite(deltaLP) ? deltaLP : null,
      last,
      prev,
    };
  }

  // If unranked is involved (rankIndex -1), keep behavior conservative
  // (you can change this later if you want "UNRANKED -> ranked" to show a delta)
  return { deltaIndex: a - b, deltaLP: null, last, prev };
}
