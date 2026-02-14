// /pages/season26overview/index.js

import { getQueue } from "../../core/queues.js";
import { parseLooseDate } from "../../core/dates.js";
import { ROSTER, ROSTER_SET } from "../../core/roster.js";
import { loadSoloRows } from "../../core/soloData.js";
import { loadTeamRows } from "../../core/teamData.js";
import { loadOtherFlexData } from "../../core/otherFlexData.js";

import { mountPlayerMiniCards } from "../../components/playerMiniCards.js";
import { mountRecentGamesCard } from "../../components/recentGamesCard.js";
import { mountWinrateWebCard } from "../../components/winrateWebCard.js";

function byId(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing mount point #${id}`);
  return el;
}

function setStatus(text) {
  const el = document.getElementById("status");
  if (el) el.textContent = text;
}

function loadingCard(title) {
  return `
    <div class="dashboard-card">
      <div class="card-header">
        <div>
          <div class="card-title">${title}</div>
          <div class="card-subtitle">Loading…</div>
        </div>
      </div>
    </div>
  `;
}

function loading(el, title) {
  if (!el) return;
  el.innerHTML = `
    <div class="card-header">
      <div>
        <div class="card-title">${title}</div>
        <div class="card-subtitle">Loading…</div>
      </div>
    </div>
  `;
}

function error(el, err) {
  if (!el) return;
  el.innerHTML = `
    <div class="card-header">
      <div>
        <div class="card-title">Couldn’t load data</div>
        <div class="card-subtitle">${String(err?.message ?? err)}</div>
      </div>
    </div>
  `;
}

function toNum(v, fallback = 0) {
  const n = Number(String(v ?? "").replace(",", ".").trim());
  return Number.isFinite(n) ? n : fallback;
}

function pickAny(primary, raw, keys) {
  for (const k of keys) {
    const v1 = primary?.[k];
    if (v1 != null && String(v1).trim() !== "") return v1;

    const v2 = raw?.[k];
    if (v2 != null && String(v2).trim() !== "") return v2;
  }
  return "";
}

function normalizeRole(v) {
  const s = String(v ?? "").trim().toUpperCase();
  if (!s) return "—";
  if (s === "UTILITY" || s === "SUPPORT") return "SUP";
  if (s === "BOTTOM" || s === "ADC") return "BOT";
  if (s === "MIDDLE" || s === "MID") return "MID";
  if (s === "JUNGLE" || s === "JNG" || s === "JG") return "JNG";
  if (s.includes("SUP")) return "SUP";
  if (s.includes("BOT")) return "BOT";
  if (s.includes("MID")) return "MID";
  if (s.includes("JUNG")) return "JNG";
  if (s.includes("TOP")) return "TOP";
  return s;
}

function normalizeWin(primary, raw) {
  const direct = primary?.win;
  if (typeof direct === "boolean") return direct;

  const s = String(pickAny(primary, raw, ["Result", "result", "win", "p.win"]))
    .trim()
    .toLowerCase();

  if (s === "win" || s === "true" || s === "1" || s === "yes") return true;
  if (s === "loss" || s === "false" || s === "0" || s === "no") return false;
  return null;
}

function normalizeRow(input, fallbackQueueId) {
  const raw = input?._raw ?? input ?? {};

  const dateRaw = pickAny(input, raw, ["date", "Date", "DATE"]);
  const date = input?.date instanceof Date ? input.date : parseLooseDate(dateRaw);

  const queueIdRaw = pickAny(input, raw, ["queueId", "Queue ID", "QueueId", "p.queueId"]);
  const queueId = toNum(queueIdRaw, fallbackQueueId) || fallbackQueueId;

  const matchId = String(
    pickAny(input, raw, [
      "matchId",
      "match_id",
      "Match ID",
      "MatchId",
      "MatchID",
      "gameId",
      "game_id",
      "Game ID",
      "GameId",
      "id",
      "Date",
    ])
  ).trim();

  const player = String(
    pickAny(input, raw, ["player", "p.riotIdGameName", "Player", "p.summonerName", "summonerName"])
  ).trim();

  const champion = String(
    pickAny(input, raw, ["champion", "Champion", "p.championName", "championName"])
  ).trim();

  const role = normalizeRole(
    pickAny(input, raw, ["role", "ROLE", "Role", "p.teamPosition", "p.individualPosition", "teamPosition"])
  );

  const kills = toNum(pickAny(input, raw, ["kills", "Kills", "p.kills"]), 0);
  const deaths = toNum(pickAny(input, raw, ["deaths", "Deaths", "p.deaths"]), 0);
  const assists = toNum(pickAny(input, raw, ["assists", "Assists", "p.assists"]), 0);

  return {
    ...input,
    _raw: raw,
    date,
    queueId,
    matchId,
    player,
    champion,
    role,
    win: normalizeWin(input, raw),
    kills,
    deaths,
    assists,
  };
}

function isRosterPlayer(row) {
  const name = String(row?.player ?? "").trim();
  return !!name && ROSTER_SET.has(name);
}

function buildMatchMeta(rows) {
  const map = new Map();

  for (const r of rows) {
    const matchId = String(r?.matchId ?? "").trim();
    if (!matchId) continue;

    if (!map.has(matchId)) {
      map.set(matchId, { players: new Set(), nubNames: new Set() });
    }

    const m = map.get(matchId);
    const name = String(r?.player ?? "").trim();
    if (!name) continue;

    m.players.add(name);
    if (ROSTER_SET.has(name)) m.nubNames.add(name);
  }

  const out = new Map();
  for (const [matchId, m] of map.entries()) {
    const nubNames = [...m.nubNames].sort((a, b) => a.localeCompare(b));
    out.set(matchId, {
      nubCount: nubNames.length,
      nubNames,
      otherCount: Math.max(0, m.players.size - nubNames.length),
    });
  }

  return out;
}

async function safeAsyncMount(el, fn, label) {
  try {
    await fn();
  } catch (e) {
    console.error(label, e);
    error(el, e);
  }
}

async function main() {
  const miniCardsEl = byId("overview-player-mini-cards");
  const recentEl = byId("overview-recent-card");
  const winrateEl = byId("overview-winrate-card");

  setStatus("Loading overview (Solo + Flex) data…");

  miniCardsEl.innerHTML = `
    ${loadingCard("Player Mini Cards")}
    ${loadingCard("Player Mini Cards")}
    ${loadingCard("Player Mini Cards")}
  `;
  loading(recentEl, "Recent Games");
  loading(winrateEl, "Winrate Web");

  const solo = getQueue("solo");
  const team = getQueue("team");
  if (!solo?.csvUrl) throw new Error("Queue config missing: solo");
  if (!team?.csvUrl) throw new Error("Queue config missing: team");

  const [soloRowsRaw, teamRowsRaw, otherFlex] = await Promise.all([
    loadSoloRows({ csvUrl: solo.csvUrl }),
    loadTeamRows({ csvUrl: team.csvUrl, roster: ROSTER, requiredRosterCount: 5 }),
    loadOtherFlexData({ includeTimeline: false }),
  ]);

  const soloRows = (soloRowsRaw || []).map((r) => normalizeRow(r, 420));
  const teamRows = (teamRowsRaw || []).map((r) => normalizeRow(r, 440));
  const otherRowsAll = (otherFlex?.rows || []).map((r) => normalizeRow(r, 440));

  const overviewRows = [...soloRows, ...teamRows, ...otherRowsAll].filter(
    (r) => r.date instanceof Date && Number.isFinite(r.date.getTime()) && isRosterPlayer(r)
  );

  overviewRows.sort((a, b) => b.date.getTime() - a.date.getTime());

  const metaRows = [...soloRows, ...teamRows, ...otherRowsAll].filter(
    (r) => r.date instanceof Date && Number.isFinite(r.date.getTime())
  );
  const matchMeta = buildMatchMeta(metaRows);

  const matchCount = new Set(overviewRows.map((r) => String(r.matchId || "").trim()).filter(Boolean)).size;
  setStatus(`Loaded ${overviewRows.length} player rows from ${matchCount} matches (Solo + Flex).`);

  await Promise.all([
    safeAsyncMount(
      miniCardsEl,
      async () => {
        await mountPlayerMiniCards(miniCardsEl, overviewRows, {
          queueLabel: "Solo + Flex",
          badgeText: "ALL QUEUES",
          badgeMode: "fixed",
        });
      },
      "[Overview] mountPlayerMiniCards failed"
    ),
    safeAsyncMount(
      recentEl,
      async () => {
        await mountRecentGamesCard(recentEl, overviewRows, {
          limit: 20,
          groupSameMatch: true,
          queueId: "420/440",
          queueLabel: "All Queues",
          queueTitle: "Solo/Duo + Flex (Team + Other Flex)",
          matchMeta,
          roster: ROSTER,
          nubsOnly: true,
          showStack: true,
          showQueueColumn: true,
        });
      },
      "[Overview] mountRecentGamesCard failed"
    ),
    safeAsyncMount(
      winrateEl,
      async () => {
        await mountWinrateWebCard(winrateEl, overviewRows, {
          roster: ROSTER,
        });
      },
      "[Overview] mountWinrateWebCard failed"
    ),
  ]);

  setStatus("Overview loaded.");
}

main().catch((err) => {
  console.error(err);

  for (const id of ["overview-player-mini-cards", "overview-recent-card", "overview-winrate-card"]) {
    const el = document.getElementById(id);
    if (el) error(el, err);
  }

  setStatus(`Error: ${String(err?.message ?? err)}`);
});
