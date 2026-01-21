// /pages/season26solo/index.js

import { getQueue } from "../../core/queues.js";
import { loadSoloRows } from "../../core/soloData.js";

import { mountSummaryCard } from "../../components/summaryCard.js";
import { mountRecentGamesCard } from "../../components/recentGamesCard.js";
import { mountPlayerMiniCards } from "../../components/playerMiniCards.js";
import { mountAvgGameTimeCard } from "../../components/avgGameTimeCard.js";
import { mountTpiCard } from "../../components/tpiCard.js";
import { mountObjectivesWinImpactCard } from "../../components/objectivesWinImpactCard.js";

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

async function main() {
  // ===== Mount points (must exist in HTML) =====
  const miniCardsEl = byId("solo-player-mini-cards");

  const tpiEl = byId("solo-tpi-card");
  const objEl = byId("solo-objectives-card");
  const summaryEl = byId("solo-summary-card");
  const recentEl = byId("solo-recent-card");
  const gameTimeEl = byId("solo-gametime-card");

  setStatus("Loading Solo/Duo data…");

  // ===== Skeletons =====
  loading(tpiEl, "Total Player Impact");
  loading(objEl, "Objective Win Impact");
  loading(summaryEl, "Solo/Duo Snapshot");
  loading(recentEl, "Recent Games");
  loading(gameTimeEl, "Average Game Time");

  // mini-card skeletons
  miniCardsEl.innerHTML = `
    ${loadingCard("Player Mini Cards")}
    ${loadingCard("Player Mini Cards")}
    ${loadingCard("Player Mini Cards")}
  `;

  // ===== Load Solo/Duo rows =====
  const solo = getQueue("solo");
  if (!solo) throw new Error("Queue config missing: solo");

  const rows = await loadSoloRows({ csvUrl: solo.csvUrl });
  setStatus(`Loaded ${rows.length} Solo/Duo games.`);

  // TPI + Objectives expect raw-ish rows; normalized rows keep original in _raw
  const rawRows = rows.map((r) => r?._raw ?? r);

  // ===== Player mini cards (async) =====
  await safeAsyncMount(
    miniCardsEl,
    async () => {
      await mountPlayerMiniCards(miniCardsEl, rows);
    },
    "[Solo] mountPlayerMiniCards failed"
  );

  // ===== TPI (sync) =====
  await safeSyncMount(
    tpiEl,
    () => {
      mountTpiCard(tpiEl, rawRows, { title: "Total Player Impact (Solo/Duo)" });
    },
    "[Solo] mountTpiCard failed"
  );

  // ===== Objective Win Impact (sync) =====
  await safeSyncMount(
    objEl,
    () => {
      mountObjectivesWinImpactCard(objEl, rawRows, {
        title: "Objective Win Impact (Solo/Duo)",
      });
    },
    "[Solo] mountObjectivesWinImpactCard failed"
  );

  // ===== Summary (sync) =====
  await safeSyncMount(
    summaryEl,
    () => {
      mountSummaryCard(summaryEl, rows);
    },
    "[Solo] mountSummaryCard failed"
  );

  // ===== Avg game time (sync) =====
  await safeSyncMount(
    gameTimeEl,
    () => {
      mountAvgGameTimeCard(gameTimeEl, rows);
    },
    "[Solo] mountAvgGameTimeCard failed"
  );

  // ===== Recent games (async) =====
  await safeAsyncMount(
    recentEl,
    async () => {
      await mountRecentGamesCard(recentEl, rows, { limit: 10 });
    },
    "[Solo] mountRecentGamesCard failed"
  );
}

main().catch((err) => {
  console.error(err);

  // Fail-soft: show error in every card that exists
  const ids = [
    "solo-tpi-card",
    "solo-objectives-card",
    "solo-summary-card",
    "solo-recent-card",
    "solo-gametime-card",
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
