// /core/timelineData.js
import { fetchCsvText, parseCsv, rowsToObjects } from "./csv.js";

// Timeline tab (gid=1060990396) — CSV export
export const SEASON26_TIMELINE_CSV =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSbxcPDjBBWSe4jIwXuQe-_o5C1RGg067CxU4g_j1yqG8D3DAj8BFqvwKuLopePRuUWv7qE5bmEPuLZ/pub?gid=1060990396&single=true&output=csv";

/* ==========================
   Normalization helpers
   - Restore "Match ID" + "Minute" fields for downstream modules
   ========================== */

const MATCH_ID_KEYS = [
  "Match ID",
  "MatchID",
  "MatchId",
  "matchId",
  "match_id",
  "Game ID",
  "GameID",
  "GameId",
  "gameId",
  "metadata.matchId",
  "info.gameId",
  "p.matchId",
  "pf.matchId",
];

const MINUTE_KEYS = ["Minute", "minute", "Min", "min"];
const TS_KEYS = ["Timestamp", "timestamp", "Time", "time", "Game Time", "GameTime", "TimeMs", "Time (ms)", "TimeMS"];

function pickAny(row, keys) {
  for (const k of keys) {
    if (row && k in row && row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== "") return row[k];
  }
  return "";
}

function toNum(v) {
  if (v === undefined || v === null || v === "") return NaN;
  const n = parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

// Riot match ids often look like "EUW1_1234567890"
function guessMatchIdFromValues(row) {
  const re = /[A-Z]{2,5}\d?_\d{6,}/;
  for (const v of Object.values(row || {})) {
    const s = String(v ?? "");
    const m = s.match(re);
    if (m) return m[0];
  }
  return "";
}

function timestampMs(row) {
  let ts = toNum(pickAny(row, TS_KEYS));
  if (!Number.isFinite(ts)) return NaN;

  // Heuristic: if it's small, it might be seconds; otherwise ms
  // Example from your sample: 60028 ≈ 1 minute in ms
  if (ts > 0 && ts < 2000) ts = ts * 1000;
  return ts;
}

function minuteFromRow(row) {
  const m = toNum(pickAny(row, MINUTE_KEYS));
  if (Number.isFinite(m)) return Math.max(0, Math.round(m));

  const ts = timestampMs(row);
  if (!Number.isFinite(ts)) return 0;

  return Math.max(0, Math.round(ts / 60000));
}

function matchIdFromRow(row) {
  const direct = String(pickAny(row, MATCH_ID_KEYS)).trim();
  if (direct) return direct;

  const guessed = guessMatchIdFromValues(row);
  if (guessed) return guessed;

  return "";
}

function normalizeTimelineRows(objs = []) {
  // 1) Add Minute everywhere (from Minute or Timestamp)
  for (const r of objs) {
    if (!r) continue;
    if (String(r["Minute"] ?? "").trim() === "") {
      r["Minute"] = minuteFromRow(r);
    }
  }

  // 2) Try to fill Match ID from known keys / value scan
  let hasExplicitMatchId = false;
  for (const r of objs) {
    if (!r) continue;
    if (String(r["Match ID"] ?? "").trim() !== "") {
      hasExplicitMatchId = true;
      continue;
    }

    const mid = matchIdFromRow(r);
    if (mid) {
      r["Match ID"] = mid;
      hasExplicitMatchId = true;
    }
  }

  // 3) If still no match id at all, infer synthetic match ids by Timestamp resets
  if (!hasExplicitMatchId) {
    let matchIdx = 0;
    let lastTs = -Infinity;
    let seenPast3Min = false;

    for (const r of objs) {
      if (!r) continue;

      const ts = timestampMs(r);

      if (Number.isFinite(ts)) {
        // Once we are past ~3 minutes, a large drop typically means "new match"
        if (seenPast3Min && ts < lastTs - 120000) {
          matchIdx += 1;
          seenPast3Min = false;
        }
        if (ts >= 180000) seenPast3Min = true;
        lastTs = ts;
      }

      if (String(r["Match ID"] ?? "").trim() === "") {
        r["Match ID"] = `SYN_${matchIdx}`;
      }
    }
  }

  return objs;
}

/**
 * Loads minute-by-minute timeline rows.
 * Returns raw objects keyed by the timeline headers (exactly as in the sheet),
 * plus adds/repairs:
 *   - "Minute" (if missing, derived from Timestamp)
 *   - "Match ID" (if missing/renamed, derived or inferred)
 */
export async function loadTimelineRows({ csvUrl = SEASON26_TIMELINE_CSV } = {}) {
  const text = await fetchCsvText(csvUrl);
  const rows = parseCsv(text);
  const objs = rowsToObjects(rows);

  // Defensive: remove completely empty rows
  const cleaned = (objs || []).filter((r) => {
    if (!r) return false;
    return Object.values(r).some((v) => String(v ?? "").trim() !== "");
  });

  return normalizeTimelineRows(cleaned);
}

// Optional export (handy if other loaders want it)
export { normalizeTimelineRows };
