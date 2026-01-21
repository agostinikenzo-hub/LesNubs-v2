// /pages/season26other/index.js
import { mountRecentGamesCard } from "../../components/recentGamesCard.js";

import * as SummaryMod from "../../components/summaryCard.js";
import * as MiniCardsMod from "../../components/playerMiniCards.js";
import * as TpiMod from "../../components/tpiCard.js";
import * as SynergyMod from "../../components/teamSynergyCard.js";
import * as ObjWinMod from "../../components/objectivesWinImpactCard.js";

const SEASON26OTHER_CSV =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSbxcPDjBBWSe4jIwXuQe-_o5C1RGg067CxU4g_j1yqG8D3DAj8BFqvwKuLopePRuUWv7qE5bmEPuLZ/pub?gid=1960192079&single=true&output=csv";

const START_DATE = new Date(2026, 0, 8); // 08 Jan 2026

const ROSTER = [
  "BurningElf",
  "Yung Sweeney",
  "Betzhamo",
  "Emorek",
  "UnbreakableHaide",
  "denotes",
  "Amazing Cholo",
  "Amazing Braakuss",
];

function pick(obj, keys) {
  for (const k of keys) {
    if (obj && obj[k] != null && String(obj[k]).trim() !== "") return obj[k];
  }
  return "";
}

function toNum(v) {
  const n = parseFloat(String(v ?? "").replace("%", "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function boolish(v) {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "y";
}

function parseDateEU(s) {
  const str = String(s || "").trim();
  if (!str) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const d = new Date(str);
    return isFinite(d) ? d : null;
  }

  const m = str.match(
    /^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?/
  );
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

// ---------- CSV parser ----------
function parseCSV(text) {
  const out = [];
  let row = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && (ch === "," || ch === "\n" || ch === "\r")) {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cur);
      cur = "";

      if (ch === "\n" || ch === "\r") {
        if (row.length > 1 || (row[0] && row[0].trim() !== "")) out.push(row);
        row = [];
      }
      continue;
    }

    cur += ch;
  }

  row.push(cur);
  if (row.length > 1 || (row[0] && row[0].trim() !== "")) out.push(row);
  return out;
}

function parseCSVToObjects(text) {
  const raw = parseCSV(text);
  if (!raw.length) return [];

  const headers = raw[0].map((h) => String(h || "").trim());
  const rows = [];

  for (let i = 1; i < raw.length; i++) {
    const arr = raw[i];
    if (!arr || !arr.length) continue;

    const obj = {};
    for (let c = 0; c < headers.length; c++) obj[headers[c]] = arr[c] ?? "";

    const hasAny = Object.values(obj).some((v) => String(v).trim() !== "");
    if (hasAny) rows.push(obj);
  }

  return rows;
}

async function fetchText(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Fetch failed: HTTP ${res.status}`);
  return await res.text();
}

// ✅ IMPORTANT: keep all original columns, just ADD normalized fields
function decorateRows(rawRows) {
  return rawRows
    .map((raw) => {
      const date = parseDateEU(pick(raw, ["Date", "DATE", "date"]));

      const player = String(
        pick(raw, ["p.riotIdGameName", "Player", "p.summonerName", "Summoner", "Name"])
      ).trim();

      const champion = String(
        pick(raw, ["Champion", "CHAMPION", "p.championName", "champion"])
      ).trim();

      const role = String(
        pick(raw, ["ROLE", "Role", "Team Position", "p.teamPosition", "p.individualPosition"])
      ).trim();

      const matchId = String(
        pick(raw, [
          "matchId",
          "match_id",
          "Match ID",
          "MatchId",
          "MatchID",
          "gameId",
          "game_id",
          "Game ID",
          "GameId",
          "Game #",
          "id",
        ])
      ).trim();

      const winStr = String(pick(raw, ["Result"])).trim().toLowerCase();
      const win =
        winStr === "win"
          ? true
          : winStr === "loss"
          ? false
          : boolish(pick(raw, ["p.win", "win"]));

      const kills = toNum(pick(raw, ["Kills", "p.kills", "kills"]));
      const deaths = toNum(pick(raw, ["Deaths", "p.deaths", "deaths"]));
      const assists = toNum(pick(raw, ["Assists", "p.assists", "assists"]));

      const queueIdFromData = toNum(pick(raw, ["queueId", "Queue Id", "QueueID", "p.queueId"]));
      const queueId = queueIdFromData || 440;

      const isNub = player && ROSTER.includes(player);

      // decorate original object (do not remove any headers)
      return {
        ...raw,
        _raw: raw, // some modules look for _raw; harmless if unused
        date,
        player,
        champion,
        role,
        matchId,
        _matchId: matchId,
        gameId: matchId,
        win,
        kills,
        deaths,
        assists,
        queueId,
        queue: queueId,
        isNub,
      };
    })
    .filter((r) => r.date instanceof Date && !isNaN(r.date.getTime()))
    .filter((r) => r.date >= START_DATE);
}

function buildMatchMeta(rowsAll) {
  const map = new Map();

  for (const r of rowsAll) {
    const id = String(r.matchId || "").trim();
    if (!id) continue;

    if (!map.has(id)) map.set(id, { players: new Set(), nubNames: new Set() });

    const m = map.get(id);
    if (r.player) m.players.add(r.player);
    if (r.isNub && r.player) m.nubNames.add(r.player);
  }

  const out = new Map();
  for (const [id, m] of map.entries()) {
    const nubNamesArr = [...m.nubNames];
    out.set(id, {
      nubCount: nubNamesArr.length,
      nubNames: nubNamesArr,
      otherCount: Math.max(0, m.players.size - nubNamesArr.length),
    });
  }
  return out;
}

function pickMountFn(mod, candidates) {
  for (const name of candidates) {
    if (typeof mod?.[name] === "function") return mod[name];
  }
  if (typeof mod?.default === "function") return mod.default;
  return null;
}

async function init() {
  const statusEl = document.getElementById("status");

  const miniCardsEl = document.getElementById("flex-cards");
  const summaryEl = document.getElementById("otherflex-summary");
  const tpiEl = document.getElementById("objective-impact");
  const synergyEl = document.getElementById("team-synergy");
  const objWinEl = document.getElementById("objectives-win-impact");
  const recentEl = document.getElementById("otherflex-matchlist");

  try {
    if (statusEl) statusEl.textContent = "Loading Other Flex (1–4) CSV…";

    const csvText = await fetchText(SEASON26OTHER_CSV);
    const rawRows = parseCSVToObjects(csvText);

    const rowsAll = decorateRows(rawRows);
    const rowsRoster = rowsAll.filter((r) => r.isNub);

    const matchMeta = buildMatchMeta(rowsAll);

    console.log("[S26 OtherFlex] rowsAll:", rowsAll.length, "rowsRoster:", rowsRoster.length);
    console.log("[S26 OtherFlex] sample decorated row:", rowsAll[0]);

    // ✅ Player Mini Cards
    const mountMiniCards = pickMountFn(MiniCardsMod, [
      "mountPlayerMiniCards",
      "mountMiniCards",
      "renderPlayerMiniCards",
      "renderMiniCards",
    ]);
    if (mountMiniCards && miniCardsEl) {
      await mountMiniCards(miniCardsEl, rowsRoster, {
        queueId: 440,
        queueLabel: "Flex (1–4)",
        roster: ROSTER,
      });
    } else {
      console.warn("[S26 OtherFlex] playerMiniCards mount not found.");
    }

    // ✅ Summary
    const mountSummary = pickMountFn(SummaryMod, [
      "mountSummaryCard",
      "mountSeasonSummaryCard",
      "renderSummaryCard",
    ]);
    if (mountSummary && summaryEl) {
      await mountSummary(summaryEl, rowsRoster, {
        queueId: 440,
        queueLabel: "Other Flex (1–4)",
        roster: ROSTER,
      });
    } else {
      console.warn("[S26 OtherFlex] summaryCard mount not found.");
    }

    // ✅ Total Player Impact
    const mountTpi = pickMountFn(TpiMod, [
      "mountTpiCard",
      "mountTPICard",
      "renderTpiCard",
      "mountTotalPlayerImpactCard",
    ]);
    if (mountTpi && tpiEl) {
      await mountTpi(tpiEl, rowsRoster, {
        queueId: 440,
        queueLabel: "Flex (1–4)",
        roster: ROSTER,
      });
    } else {
      console.warn("[S26 OtherFlex] tpiCard mount not found.");
    }

    // ✅ Team Synergy & Identity
    // (Pass rowsAll so the module can still group games properly even if roster filter is different internally)
    const mountSynergy = pickMountFn(SynergyMod, [
      "mountTeamSynergyCard",
      "renderTeamSynergyCard",
      "mountSynergyCard",
    ]);
    if (mountSynergy && synergyEl) {
      await mountSynergy(synergyEl, rowsAll, {
        queueId: 440,
        queueLabel: "Flex (1–4)",
        roster: ROSTER,
      });
    } else {
      console.warn("[S26 OtherFlex] teamSynergyCard mount not found.");
    }

    // ✅ Objective Win Impact (Team / 5-stack style card)
    const mountObjWin = pickMountFn(ObjWinMod, [
      "mountObjectivesWinImpactCard",
      "mountObjectiveWinImpactCard",
      "renderObjectivesWinImpactCard",
    ]);
    if (mountObjWin && objWinEl) {
      await mountObjWin(objWinEl, rowsAll, {
        queueId: 440,
        queueLabel: "Flex (1–4)",
        roster: ROSTER,
      });
    } else if (objWinEl) {
      console.warn("[S26 OtherFlex] objectivesWinImpactCard mount not found.");
    }

    // ✅ Recent Games / Match List
    if (recentEl) {
      await mountRecentGamesCard(recentEl, rowsAll, {
        limit: 10,
        groupSameMatch: true,
        queueId: 440,
        queueLabel: "Flex",
        matchMeta,
        roster: ROSTER,
        nubsOnly: true,
      });
    }

    if (statusEl) {
      statusEl.textContent = `Loaded ${rowsRoster.length} roster rows · ${rowsAll.length} total rows (since ${START_DATE.toLocaleDateString(
        "en-GB"
      )}).`;
    }
  } catch (err) {
    console.error(err);
    if (statusEl) statusEl.textContent = `Error loading data: ${err?.message || err}`;
  }
}

init();
