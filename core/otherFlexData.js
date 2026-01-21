// /core/otherFlexData.js
import { ROSTER } from "./roster.js";
import { normRole } from "./queues.js"; // or wherever your canonical role normalizer lives
import { fetchCsv } from "./csv.js";     // swap name to match your csv.js helper

export const SEASON26_OTHER_CSV =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSbxcPDjBBWSe4jIwXuQe-_o5C1RGg067CxU4g_j1yqG8D3DAj8BFqvwKuLopePRuUWv7qE5bmEPuLZ/pub?gid=1960192079&single=true&output=csv";

export const SEASON26_OTHER_TIMELINE_CSV =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSbxcPDjBBWSe4jIwXuQe-_o5C1RGg067CxU4g_j1yqG8D3DAj8BFqvwKuLopePRuUWv7qE5bmEPuLZ/pub?gid=2082786293&single=true&output=csv";

export const OTHER_START_DATE = new Date(2026, 0, 8); // 08 Jan 2026

function parseDateEU(s) {
  const str = String(s || "").trim();
  if (!str) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const d = new Date(str);
    return isFinite(d) ? d : null;
  }
  const m = str.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (!m) return null;
  const dd = +m[1], mm = +m[2] - 1, yy0 = +m[3];
  const yy = yy0 < 100 ? yy0 + 2000 : yy0;
  const hh = m[4] ? +m[4] : 0;
  const min = m[5] ? +m[5] : 0;
  const d = new Date(yy, mm, dd, hh, min, 0);
  return isFinite(d) ? d : null;
}

function boolish(v) {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "y";
}

function num(v) {
  if (v === null || v === undefined || v === "") return 0;
  const n = parseFloat(String(v).replace(",", ".").replace("%", ""));
  return Number.isFinite(n) ? n : 0;
}

function isWinRow(r) {
  const res = String(r["Result"] ?? "").trim().toLowerCase();
  if (res === "win") return true;
  if (res === "loss") return false;
  // fallback: riot boolean field
  return boolish(r["p.win"]);
}

function getMatchId(r) {
  return String(r["Match ID"] || r["MatchID"] || r["Game ID"] || r["Game #"] || r["Date"] || "").trim();
}

function getPlayer(r) {
  return String(r["p.riotIdGameName"] || r["Player"] || r["p.summonerName"] || "").trim();
}

function getRole(r) {
  const raw =
    r["ROLE"] ??
    r["Role"] ??
    r["p.teamPosition"] ??
    r["p.individualPosition"] ??
    r["teamPosition"] ??
    "";
  return normRole(String(raw || ""));
}

function getChampion(r) {
  return String(r["Champion"] || r["p.championName"] || "").trim();
}

export async function loadOtherFlexData({ includeTimeline = true } = {}) {
  const rawRows = await fetchCsv(SEASON26_OTHER_CSV);

  const rows = rawRows
    .map((r) => {
      const date = parseDateEU(r["Date"] || r["DATE"]);
      const player = getPlayer(r);
      const matchId = getMatchId(r);

      const isNub = ROSTER.includes(player) || boolish(r["Is Nub"]);
      return {
        ...r,

        // normalized fields used everywhere
        date,
        matchId,
        player,
        isNub,
        win: isWinRow(r),

        role: getRole(r),
        champion: getChampion(r),

        kills: num(r["Kills"] ?? r["p.kills"]),
        deaths: num(r["Deaths"] ?? r["p.deaths"]),
        assists: num(r["Assists"] ?? r["p.assists"]),

        split: Number.parseInt(String(r["Split"] || "").trim(), 10) || 1,
        queueId: Number.parseInt(String(r["Queue ID"] || "").trim(), 10) || null,
      };
    })
    .filter((r) => !r.date || r.date >= OTHER_START_DATE);

  // IMPORTANT:
  // Keep ALL rows (nubs + non-nubs) so match list can show “+ others” and champs strip.
  // Modules that need “only nubs” can filter with r.isNub.

  let timeline = [];
  if (includeTimeline) {
    try {
      timeline = await fetchCsv(SEASON26_OTHER_TIMELINE_CSV);
    } catch {
      timeline = [];
    }
  }

  return { rows, timeline };
}
