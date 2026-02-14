// /pages/season26team/index.js

import { getQueue } from "../../core/queues.js";
import { ROSTER } from "../../core/roster.js";
import { loadTeamRows } from "../../core/teamData.js";

import { mountTeamSummaryCard } from "../../components/teamSummaryCard.js";
import { mountTeamMatchListCard } from "../../components/teamMatchListCard.js";
import { mountPlayerMiniCards } from "../../components/playerMiniCards.js";
import { mountTpiCard } from "../../components/tpiCard.js";
import { mountObjectivesWinImpactCard } from "../../components/objectivesWinImpactCard.js";
import { mountTeamSynergyCard } from "../../components/teamSynergyCard.js";
import { mountLaneDynamicsCard } from "../../components/laneDynamicsCard.js";

// ✅ Death map
import { mountDeathMapCard } from "../../components/deathMapCard.js";

import { loadTimelineRows, SEASON26_TIMELINE_CSV } from "../../core/timelineData.js";

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

async function safeSyncMount(el, fn, label) {
  try {
    fn();
  } catch (e) {
    console.error(label, e);
    error(el, e);
  }
}

async function safeAsyncMount(el, fn, label) {
  try {
    await fn();
  } catch (e) {
    console.error(label, e);
    error(el, e);
  }
}

function reorderIfSameParent(elsInOrder) {
  const els = elsInOrder.filter(Boolean);
  if (!els.length) return;

  const parent = els[0].parentElement;
  if (!parent) return;

  const allSame = els.every((el) => el.parentElement === parent);
  if (!allSame) {
    console.warn("[Team] Sections not reordered (different parents). Reorder the HTML mount points instead.");
    return;
  }

  els.forEach((el) => parent.appendChild(el));
}

async function main() {
  // ===== Mount points =====
  const miniCardsEl = byId("player-mini-cards");

  const matchlistEl = byId("team-matchlist");
  const summaryEl = byId("team-summary");
  const tpiEl = byId("objective-impact");

  // ✅ New death map mount point
  const deathMapEl = byId("death-map");

  const teamSynergyEl = byId("team-synergy");
  const objEl = byId("objective-win-impact");
  const laneDynEl = byId("lane-dynamics");

  // ===== Ensure visual order on page (if same parent) =====
  reorderIfSameParent([
    miniCardsEl,
    matchlistEl,
    summaryEl,
    tpiEl,
    deathMapEl,     // ✅ place it right after TPI
    teamSynergyEl,
    objEl,
    laneDynEl,
  ]);

  setStatus("Loading Team (5-stack) data…");

  // ===== Skeletons =====
  miniCardsEl.innerHTML = `
    ${loadingCard("Player Mini Cards")}
    ${loadingCard("Player Mini Cards")}
    ${loadingCard("Player Mini Cards")}
  `;

  loading(matchlistEl, "Match List");
  loading(summaryEl, "Team Snapshot");
  loading(tpiEl, "Total Player Impact");
  loading(deathMapEl, "Death Map"); // ✅
  loading(teamSynergyEl, "Team Synergy & Identity");
  loading(objEl, "Objective Win Impact");
  loading(laneDynEl, "Lane Dynamics & Playmakers");

  // ===== Load Team rows =====
  const team = getQueue("team");
  if (!team) throw new Error("Queue config missing: team");

  const timelinePromise = loadTimelineRows({ csvUrl: SEASON26_TIMELINE_CSV }).catch((e) => {
    console.warn("[Team] timeline load failed (ok for now)", e);
    return [];
  });

  const rows = await loadTeamRows({
    csvUrl: team.csvUrl,
    roster: ROSTER,
    requiredRosterCount: 5,
  });

  setStatus(`Loaded ${rows.length} Team (5-stack) player rows.`);

  // Raw-ish rows for compute engines
  const rawRows = rows.map((r) => r?._raw ?? r);

  const timelineRows = await timelinePromise;

  await Promise.all([
    safeAsyncMount(
      miniCardsEl,
      async () => {
        await mountPlayerMiniCards(miniCardsEl, rows);
      },
      "[Team] mountPlayerMiniCards failed"
    ),
    safeAsyncMount(
      matchlistEl,
      async () => {
        await mountTeamMatchListCard(matchlistEl, rows, {
          title: "Match List (Last 10)",
          roster: ROSTER,
        });
      },
      "[Team] mountTeamMatchListCard failed"
    ),
    safeSyncMount(
      summaryEl,
      () => {
        mountTeamSummaryCard(summaryEl, rawRows, { tag: "5-stack" });
      },
      "[Team] mountTeamSummaryCard failed"
    ),
    safeSyncMount(
      tpiEl,
      () => {
        mountTpiCard(tpiEl, rawRows, {
          title: "Total Player Impact (Team / 5-stack)",
          roster: ROSTER,
        });
      },
      "[Team] mountTpiCard failed"
    ),
    safeAsyncMount(
      deathMapEl,
      async () => {
        await mountDeathMapCard(deathMapEl, timelineRows, {
          title: "Death Map (Team / 5-stack)",
          subtitle: "Heatmap of where deaths happen (timeline CHAMPION_KILL positions).",
          roster: ROSTER,
        });
      },
      "[Team] mountDeathMapCard failed"
    ),
    safeAsyncMount(
      teamSynergyEl,
      async () => {
        await mountTeamSynergyCard(teamSynergyEl, rawRows, {
          unlockRoleGames: 0,
          timelineRows, // ready for phase 2
          debug: false,
        });
      },
      "[Team] mountTeamSynergyCard failed"
    ),
    safeSyncMount(
      objEl,
      () => {
        mountObjectivesWinImpactCard(objEl, rawRows, {
          title: "Objective Win Impact (Team / 5-stack)",
        });
      },
      "[Team] mountObjectivesWinImpactCard failed"
    ),
    safeSyncMount(
      laneDynEl,
      () => {
        mountLaneDynamicsCard(laneDynEl, rawRows, timelineRows, {
          roster: ROSTER,
          unlockGames: 0, // set to 25 when you want gating live
          initialPhase: "early",
        });
      },
      "[Team] mountLaneDynamicsCard failed"
    ),
  ]);

  setStatus("Team (5-stack) modular view loaded.");
}

main().catch((err) => {
  console.error(err);

  const ids = [
    "player-mini-cards",
    "team-matchlist",
    "team-summary",
    "objective-impact",
    "death-map",          // ✅
    "team-synergy",
    "objective-win-impact",
    "lane-dynamics",
  ];

  for (const id of ids) {
    try {
      const el = document.getElementById(id);
      if (el) error(el, err);
    } catch {}
  }

  try {
    setStatus(`Error: ${String(err?.message ?? err)}`);
  } catch {}
});
