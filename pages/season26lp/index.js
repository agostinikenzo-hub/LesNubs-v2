// /pages/season26lp/index.js
import { mountLpMiniModule } from "../../components/lpMiniModule.js";
import { mountLpProgressModule } from "../../components/lpProgressModule.js";
import { mountLpTimelineModule } from "../../components/lpTimelineModule.js";

// 🆕 Prize race (TPI-based) + unlock shell
import { mountUnlockableCard } from "../../components/lockedFeatureCard.js";
import { mountPrizeRaceCard } from "../../components/prizeRaceCard.js";

const LP26_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSbxcPDjBBWSe4jIwXuQe-_o5C1RGg067CxU4g_j1yqG8D3DAj8BFqvwKuLopePRuUWv7qE5bmEPuLZ/pub?gid=572329607&single=true&output=csv";

// ✅ You already gave this one (Other Flex 1–4 tab)
const OTHERFLEX26_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSbxcPDjBBWSe4jIwXuQe-_o5C1RGg067CxU4g_j1yqG8D3DAj8BFqvwKuLopePRuUWv7qE5bmEPuLZ/pub?gid=1960192079&single=true&output=csv";

// ⚠️ Fill these with your real public CSV URLs (Team 5-stack + Solo/Duo 420)
// If left blank, the Prize Race card will gracefully show partial scoring or “No data”.
const TEAM26_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSbxcPDjBBWSe4jIwXuQe-_o5C1RGg067CxU4g_j1yqG8D3DAj8BFqvwKuLopePRuUWv7qE5bmEPuLZ/pub?gid=0&single=true&output=csv"; // e.g. "...output=csv"
const SOLO26_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSbxcPDjBBWSe4jIwXuQe-_o5C1RGg067CxU4g_j1yqG8D3DAj8BFqvwKuLopePRuUWv7qE5bmEPuLZ/pub?gid=2079220094&single=true&output=csv"; // e.g. "...output=csv"

const ROSTER_ORDER = [
  "BurningElf",
  "Yung Sweeney",
  "Betzhamo",
  "Emorek",
  "UnbreakableHaide",
  "denotes",
  "Amazing Cholo",
  "Amazing Braakuss",
];

// 🔒 set to >0 to show locked shell; 0 = live
const PRIZE_RACE_UNLOCK_IN_DAYS = 0;

function setStatus(text) {
  const el = document.getElementById("status");
  if (el) el.textContent = text;
}

function byId(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing mount point #${id}`);
  return el;
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
        <div class="card-title">Couldn’t load</div>
        <div class="card-subtitle">${String(err?.message ?? err)}</div>
      </div>
    </div>
  `;
}

async function safeAsync(el, fn, label) {
  try {
    await fn();
  } catch (e) {
    console.error(label, e);
    error(el, e);
  }
}

// ----------------------------
// Minimal CSV loader (no deps)
// ----------------------------
function parseCsv(text) {
  const s = String(text ?? "").replace(/^\uFEFF/, ""); // remove BOM
  const rows = [];
  let row = [];
  let cur = "";
  let i = 0;
  let inQuotes = false;

  while (i < s.length) {
    const ch = s[i];

    if (inQuotes) {
      if (ch === '"') {
        // escaped quote
        if (s[i + 1] === '"') {
          cur += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      cur += ch;
      i += 1;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }

    if (ch === ",") {
      row.push(cur);
      cur = "";
      i += 1;
      continue;
    }

    if (ch === "\n") {
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
      i += 1;
      continue;
    }

    if (ch === "\r") {
      // handle CRLF
      if (s[i + 1] === "\n") i += 2;
      else i += 1;
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
      continue;
    }

    cur += ch;
    i += 1;
  }

  // last cell
  row.push(cur);
  // avoid pushing a totally empty trailing row
  if (row.length > 1 || (row.length === 1 && row[0].trim() !== "")) rows.push(row);

  return rows;
}

async function loadCsvObjects(url) {
  const u = String(url || "").trim();
  if (!u) return [];

  const res = await fetch(u, { cache: "no-store" });
  if (!res.ok) throw new Error(`CSV fetch failed (${res.status})`);
  const text = await res.text();

  const grid = parseCsv(text);
  if (!grid.length) return [];

  const headers = (grid[0] || []).map((h) => String(h ?? "").trim());
  const out = [];

  for (let r = 1; r < grid.length; r++) {
    const line = grid[r] || [];
    // skip empty lines
    if (!line.some((x) => String(x ?? "").trim() !== "")) continue;

    const obj = {};
    for (let c = 0; c < headers.length; c++) {
      const key = headers[c] || `col_${c}`;
      obj[key] = line[c] ?? "";
    }
    out.push(obj);
  }

  return out;
}

async function main() {
  // ✅ HTML must have these mount points:
  // <div id="lp-snapshot-card" class="dashboard-card"></div>
  // <div id="lp-progress-card" class="dashboard-card"></div>
  // <div id="lp-timeline" class="dashboard-card"></div>
  //
  // 🆕 Optional:
  // <div id="lp-prize-race-card" class="dashboard-card"></div>
  const snapEl = byId("lp-snapshot-card");
  const progEl = byId("lp-progress-card");

  // optional mount points (don’t hard crash page if not present)
  const timelineEl = document.getElementById("lp-timeline") || null;
  const prizeEl = document.getElementById("lp-prize-race-card") || null;

  setStatus("Loading LP view…");

  loading(snapEl, "LP Snapshot");
  loading(progEl, "LP Progression");
  if (timelineEl) loading(timelineEl, "LP Timeline");

  // ✅ Snapshot mini-cards (SOLO/FLEX latest + deltas)
  await safeAsync(
    snapEl,
    async () => {
      await mountLpMiniModule({
        mountId: "lp-snapshot-card",
        csvUrl: LP26_CSV_URL,
        rosterOrder: ROSTER_ORDER,
        showQueues: ["SOLO", "FLEX"],
      });
    },
    "[LP] mountLpMiniModule failed"
  );

  // ✅ Progress module (highlight stats + rank map)
  await safeAsync(
    progEl,
    async () => {
      await mountLpProgressModule(progEl, {
        csvUrl: LP26_CSV_URL,
        rosterOrder: ROSTER_ORDER,
        unlockInDays: 0, // 🔒 set to 30 later if you want
        title: "LP Progression (SOLO + FLEX)",
      });
    },
    "[LP] mountLpProgressModule failed"
  );

  // ✅ Timeline module (animated rank over time)
  if (timelineEl) {
    await safeAsync(
      timelineEl,
      async () => {
        await mountLpTimelineModule(timelineEl, {
          csvUrl: LP26_CSV_URL,
          rosterOrder: ROSTER_ORDER,
          title: "LP Timeline (Rank over time)",
          unlockInDays: 0, // 🔒 set to e.g. 14 later if you want it gated
          defaultMode: "BOTH", // BOTH | SOLO | FLEX
          defaultFocus: "", // "" = all players
        });
      },
      "[LP] mountLpTimelineModule failed"
    );
  }

  // 🆕 Prize race (Top 3) — unlockable card shell
  if (prizeEl) {
    await safeAsync(
      prizeEl,
      async () => {
        // If locked, don’t fetch anything; just render the shell
        if (PRIZE_RACE_UNLOCK_IN_DAYS > 0) {
          mountUnlockableCard(prizeEl, {
            title: "Prize Pool — Race",
            unlockInDays: PRIZE_RACE_UNLOCK_IN_DAYS,
            note: "Juicy Prizes only for the best, presented by BRAWNDO - Brawndo has what Nübs crave! 4500 RP Prize Pool to be won.!!! TOP 3 split 60/20/20! Every Queue counts: Team, Solo/Duo, Other Flex (1–4)! Donate today and make Les Nübs great again!!!",
            pill: "Locked Feature",
          });
          return;
        }

        loading(prizeEl, "Prize Pool — Race");

        const [teamRows, soloRows, flexRows] = await Promise.all([
          loadCsvObjects(TEAM26_CSV_URL),
          loadCsvObjects(SOLO26_CSV_URL),
          loadCsvObjects(OTHERFLEX26_CSV_URL),
        ]);

        // Wrap in the same unlock shell (0 = unlocked)
        mountUnlockableCard(prizeEl, {
          title: "Prize Pool — Race",
          unlockInDays: PRIZE_RACE_UNLOCK_IN_DAYS, // 0
          note: "Juicy Prizes only for the best, presented by BRAWANDO - Brawndo has what plants crave!",
          pill: "Locked Feature",
         renderUnlocked: (mount) => {
  mountPrizeRaceCard(
    mount,
    { teamRows, soloRows, flexRows },
    {
      roster: ROSTER_ORDER,
      config: {
        TEAM_MIN_GAMES: 10,                 // (optional) for now, while low sample
        WEIGHTS: { TEAM: 0.7, SOLO: 0.2, FLEX: 0.1 },
        IGNORE_MISSING_QUEUES: true,

        // ✅ Prize settings
        PRIZE_POOL_RP: 4500,
        PAYOUT_SPLIT: [0.6, 0.2, 0.2], // top 4
      },
    }
  );
},

        });
      },
      "[LP] prize race mount failed"
    );
  }

  setStatus("LP view loaded.");
}

main().catch((err) => {
  console.error(err);
  setStatus(`Error: ${String(err?.message ?? err)}`);
});
