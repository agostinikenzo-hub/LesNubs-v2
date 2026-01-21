/* thedot.js — The CAL (Season 26 + Year Toggle)
   + Flex/Team vs Solo coloring
   + Bins grouped by meaning (Mixed / Flex only / Solo only / No game)
*/

(() => {
  // ===== Year sheet configs =====
  const SHEET_2026_PUB =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vSbxcPDjBBWSe4jIwXuQe-_o5C1RGg067CxU4g_j1yqG8D3DAj8BFqvwKuLopePRuUWv7qE5bmEPuLZ/pub";
  const SHEET_2025_PUB =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vRbb898Zhxeml0wxUIeXQk33lY3eVDqIGepE7iEiHA0KQNMQKvQWedA4WMaKUXBuhKfrPjalVb-OvD9/pub";

  // ✅ Solo tab gid (Season 26) — from your QUEUES.solo.csvUrl
  const GID_SOLO_2026 = 2079220094;

  const YEAR_PRESETS = {
    2026: {
      seasonYear: 2026,
      seasonStartDate: new Date(2026, 0, 1),
      unlockAfterDays: 0,
      unlockAfterDate: null,
      sources: [
        { name: "Team", kind: "flex", url: `${SHEET_2026_PUB}?gid=0&single=true&output=csv` },
        { name: "OtherFlex", kind: "flex", url: `${SHEET_2026_PUB}?gid=1960192079&single=true&output=csv` },
        { name: "Solo", kind: "solo", url: `${SHEET_2026_PUB}?gid=${GID_SOLO_2026}&single=true&output=csv` },
      ],
    },
    2025: {
      seasonYear: 2025,
      seasonStartDate: new Date(2025, 0, 1),
      unlockAfterDays: 0,
      unlockAfterDate: null,
      sources: [
        { name: "Team", kind: "flex", url: `${SHEET_2025_PUB}?output=csv` },
        { name: "OtherFlex", kind: "flex", url: `${SHEET_2025_PUB}?gid=1960192079&single=true&output=csv` },
        // If you have Solo in 2025, add it here with the right gid.
      ],
    },
  };

  const CAL_CONFIG = {
    seasonYear: 2026,
    startMonth0: 0,
    monthsToShow: 12,

    seasonStartDate: YEAR_PRESETS[2026].seasonStartDate,
    unlockAfterDays: YEAR_PRESETS[2026].unlockAfterDays,
    unlockAfterDate: YEAR_PRESETS[2026].unlockAfterDate,
    sources: YEAR_PRESETS[2026].sources,

    roster: [
      "BurningElf",
      "Yung Sweeney",
      "Betzhamo",
      "Emorek",
      "UnbreakableHaide",
      "denotes",
      "Amazing Cholo",
      "Amazing Braakuss",
    ],

    multiMatchRingAt: 2,
  };

  let STATE = {
    matchesPerDay: null, // { total: Map, flex: Map, solo: Map }
    isSplit: false,
    isLoading: false,
  };

  window.S26CAL = { CAL_CONFIG, mount: mountCAL, loadPlayedDaysFromSources };

  document.addEventListener("DOMContentLoaded", () => mountCAL());

  async function mountCAL() {
    const statusEl = document.getElementById("cal-status");
    const lockedWrap = document.getElementById("cal-locked");
    const lockedText = document.getElementById("cal-locked-text");

    const calendarWrap = document.getElementById("cal-calendar");
    const splitWrap = document.getElementById("cal-split");
    const btnView = document.getElementById("btn-view");
    const btnViewLabel = document.getElementById("btn-view-label");

    if (!statusEl || !calendarWrap || !splitWrap || !btnView || !btnViewLabel) return;

    // Guard: prevent multiple mounts double-binding the button
    if (btnView.dataset.bound === "1") return;
    btnView.dataset.bound = "1";

    // Year buttons
    const yearBtn2026 = document.getElementById("cal-year-2026");
    const yearBtn2025 = document.getElementById("cal-year-2025");

    if (yearBtn2026 && yearBtn2026.dataset.bound !== "1") {
      yearBtn2026.dataset.bound = "1";
      yearBtn2026.addEventListener("click", async () => {
        if (STATE.isLoading) return;
        await setActiveYear(2026);
      });
    }
    if (yearBtn2025 && yearBtn2025.dataset.bound !== "1") {
      yearBtn2025.dataset.bound = "1";
      yearBtn2025.addEventListener("click", async () => {
        if (STATE.isLoading) return;
        await setActiveYear(2025);
      });
    }

    // Toggle view button
    btnViewLabel.textContent = "Bins";
    btnView.setAttribute("aria-pressed", "false");
    STATE.isSplit = false;

    btnView.addEventListener("click", () => {
      if (btnView.disabled) return;
      if (STATE.isLoading) return;

      try {
        if (!STATE.isSplit) {
          animateToSplitView();
          STATE.isSplit = true;
          btnView.setAttribute("aria-pressed", "true");
          btnViewLabel.textContent = "CAL";
        } else {
          animateToCalendarView();
          STATE.isSplit = false;
          btnView.setAttribute("aria-pressed", "false");
          btnViewLabel.textContent = "Bins";
        }
      } catch (e) {
        console.error("CAL toggle error:", e);
      }
    });

    function setToggleEnabled(enabled) {
      btnView.disabled = !enabled;
      btnView.setAttribute("aria-disabled", enabled ? "false" : "true");
    }

    // Initial load
    await setActiveYear(CAL_CONFIG.seasonYear);

    async function setActiveYear(year) {
      const preset = YEAR_PRESETS[year];
      if (!preset) return;

      // If currently split, restore first
      if (STATE.isSplit) {
        try { animateToCalendarView(); } catch {}
        STATE.isSplit = false;
        btnView.setAttribute("aria-pressed", "false");
        btnViewLabel.textContent = "Bins";
      }

      applyYearPreset(preset);

      // Update year toggle UI
      if (yearBtn2026 && yearBtn2025) {
        yearBtn2026.classList.toggle("is-active", CAL_CONFIG.seasonYear === 2026);
        yearBtn2025.classList.toggle("is-active", CAL_CONFIG.seasonYear === 2025);
      }

      // Unlock gate
      const gate = calUnlockStatus();
      if (!gate.unlocked) {
        lockedWrap?.classList.remove("hidden");
        if (lockedText) {
          lockedText.textContent =
            `Unlocks in ${gate.remainingDays} day(s). ` +
            `Progress: ${gate.daysSinceStart} / ${gate.needDays} day(s) since season start.`;
        }

        calendarWrap.classList.add("hidden");
        splitWrap.classList.add("hidden");
        statusEl.textContent = "Locked — collecting enough days first.";
        setToggleEnabled(false);
        return;
      }

      lockedWrap?.classList.add("hidden");
      calendarWrap.classList.remove("hidden");

      setToggleEnabled(true);
      statusEl.textContent = `Loading match days… (${year})`;
      STATE.isLoading = true;

      try {
        STATE.matchesPerDay = await loadPlayedDaysFromSources(CAL_CONFIG.sources);
      } catch (err) {
        console.error(err);
        statusEl.textContent =
          "Couldn’t load CSV sources. Check published CSV links + sheet visibility.";
        setToggleEnabled(false);
        STATE.isLoading = false;
        return;
      }

      renderCalendarGrid(STATE.matchesPerDay);

      const today = startOfDay(new Date());
      const { activeStart, activeEnd, totalActiveDays } = getActiveWindow(today);

      const stats = countDayTypesInWindow(STATE.matchesPerDay, activeStart, activeEnd);

      statusEl.textContent =
        `Loaded: ${stats.played} played (Flex-only ${stats.flexOnly} · Solo-only ${stats.soloOnly} · Both ${stats.mixed}) · ` +
        `${stats.empty} no-game · Window: ${toISODateKey(activeStart)} → ${toISODateKey(activeEnd)}.`;

      // Bin subtitles (new layout)
      setText("bin-mixed-sub", `${stats.mixed} day(s)`);
      setText("bin-flex-sub", `${stats.flexOnly} day(s)`);
      setText("bin-solo-sub", `${stats.soloOnly} day(s)`);
      setText("bin-empty-sub", `${stats.empty} day(s)`);

      // Backward compat if old ids still exist somewhere
      setText("bin-played-sub", `${stats.played} day(s)`);

      // Ensure split panel hidden on reload
      splitWrap.classList.add("hidden");
      STATE.isLoading = false;
    }

    function setText(id, text) {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    }
  }

  function applyYearPreset(preset) {
    CAL_CONFIG.seasonYear = preset.seasonYear;
    CAL_CONFIG.seasonStartDate = preset.seasonStartDate;
    CAL_CONFIG.unlockAfterDays = preset.unlockAfterDays;
    CAL_CONFIG.unlockAfterDate = preset.unlockAfterDate;
    CAL_CONFIG.sources = preset.sources;
  }

  /* =========================
     Data loading
  ========================= */

  async function loadPlayedDaysFromSources(sources) {
    const total = new Map();
    const flex = new Map();
    const solo = new Map();

    const seenMatches = new Set();
    let loadedAny = false;

    for (const src of sources) {
      const url = normalizeGoogleCsvUrl(src.url);

      let csvText = "";
      try {
        csvText = await fetchText(url);
      } catch (e) {
        console.warn(`[CAL] Source failed, skipping: ${src.name}`, e);
        continue;
      }

      const { rows } = parseCSVToObjects(csvText);
      if (!rows.length) continue;
      loadedAny = true;

      const matchIdCols = ["Match ID", "matchId", "MatchID", "Game ID", "GameID"];
      const dateCols = ["Date", "DATE", "Timestamp", "TIME"];
      const playerCols = ["Player", "p.riotIdGameName", "p.summonerName", "Summoner"];

      for (const r of rows) {
        const player = String(getAny(r, playerCols) || "").trim();
        if (CAL_CONFIG.roster?.length && !CAL_CONFIG.roster.includes(player)) continue;

        const matchId = String(getAny(r, matchIdCols) || "").trim();
        const dt = parseMaybeEUDateTime(getAny(r, dateCols));
        if (!dt) continue;
        if (dt.getFullYear() !== CAL_CONFIG.seasonYear) continue;

        const dateKey = toISODateKey(dt);
        const dedupeKey = matchId ? `${src.name}|${matchId}` : `${src.name}|${dateKey}|${player}`;
        if (seenMatches.has(dedupeKey)) continue;
        seenMatches.add(dedupeKey);

        const isSolo = (src.kind || "").toLowerCase() === "solo";
        const target = isSolo ? solo : flex;

        target.set(dateKey, (target.get(dateKey) || 0) + 1);
        total.set(dateKey, (total.get(dateKey) || 0) + 1);
      }
    }

    if (!loadedAny) {
      throw new Error("No sources could be loaded (all fetches failed or returned empty).");
    }

    return { total, flex, solo };
  }

  async function fetchText(url) {
    const res = await fetch(url, { mode: "cors", cache: "no-store" });
    if (!res.ok) throw new Error(`Fetch failed (${res.status}) for ${url}`);
    return await res.text();
  }

  function normalizeGoogleCsvUrl(url) {
    const u = String(url || "").trim();
    if (!u) return u;
    if (u.includes("output=csv") || u.includes("tqx=out:csv") || u.includes("export?format=csv")) return u;

    const m = u.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (m) {
      const sheetId = m[1];
      const gid = (u.match(/[?&#]gid=(\d+)/) || [])[1] || "0";
      return `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${gid}`;
    }
    return u;
  }

  /* =========================
     Render calendar
  ========================= */

  function renderCalendarGrid(data) {
    const grid = document.getElementById("cal-grid");
    if (!grid) return;
    grid.innerHTML = "";

    const today = startOfDay(new Date());
    const { activeStart, activeEnd } = getActiveWindow(today);

    for (let i = 0; i < CAL_CONFIG.monthsToShow; i++) {
      const month = (CAL_CONFIG.startMonth0 + i) % 12;

      const monthCell = document.createElement("div");
      monthCell.className = "cal-month";

      const title = document.createElement("div");
      title.className = "cal-month-title";
      title.textContent = monthName(month);

      const dots = document.createElement("div");
      dots.className = "dots-grid";
      dots.dataset.month = String(month);

      const daysIn = daysInMonth(CAL_CONFIG.seasonYear, month);
      const first = new Date(CAL_CONFIG.seasonYear, month, 1);
      const lead = mondayIndex(first);

      let placed = 0;

      for (let k = 0; k < lead; k++) {
        const spacer = document.createElement("span");
        spacer.className = "dot-spacer";
        dots.appendChild(spacer);
        placed++;
      }

      for (let day = 1; day <= daysIn; day++) {
        const dt = new Date(CAL_CONFIG.seasonYear, month, day);
        const key = toISODateKey(dt);

        const soloCount = data.solo.get(key) || 0;
        const flexCount = data.flex.get(key) || 0;
        const totalCount = soloCount + flexCount;

        const dot = document.createElement("span");

        let cls = "day-dot";
        if (!totalCount) cls += " day-dot--empty";
        else if (soloCount && flexCount) cls += " day-dot--mixed";
        else if (soloCount) cls += " day-dot--solo";
        else cls += " day-dot--played";

        dot.className = cls;

        dot.dataset.date = key;
        dot.dataset.count = String(totalCount); // used by bin logic
        dot.dataset.countSolo = String(soloCount);
        dot.dataset.countFlex = String(flexCount);

        const d0 = startOfDay(dt);
        const isFuture = d0.getTime() > today.getTime();
        const isInactive = d0.getTime() < activeStart.getTime();
        const isBinable = d0.getTime() >= activeStart.getTime() && d0.getTime() <= activeEnd.getTime();

        if (isInactive) dot.classList.add("day-dot--inactive");
        if (isFuture) dot.classList.add("day-dot--future");
        dot.dataset.binable = isBinable ? "1" : "0";

        dot.title = totalCount
          ? `${key} · Flex ${flexCount} · Solo ${soloCount}`
          : `${key} · no games`;

        if (totalCount >= CAL_CONFIG.multiMatchRingAt) dot.classList.add("day-dot--multi");

        dot.__homeParent = dots;
        dot.__placeholder = null;

        dots.appendChild(dot);
        placed++;
      }

      while (placed < 42) {
        const spacer = document.createElement("span");
        spacer.className = "dot-spacer";
        dots.appendChild(spacer);
        placed++;
      }

      monthCell.appendChild(title);
      monthCell.appendChild(dots);
      grid.appendChild(monthCell);
    }
  }

  /* =========================
     Split animation (FLIP) — grouped bins
  ========================= */

  function animateToSplitView() {
    const calendarWrap = document.getElementById("cal-calendar");
    const splitWrap = document.getElementById("cal-split");

    const binMixed = document.getElementById("bin-mixed");
    const binFlex = document.getElementById("bin-flex");
    const binSolo = document.getElementById("bin-solo");
    const binEmpty = document.getElementById("bin-empty");

    // Fallback (if someone still has old HTML)
    const oldPlayed = document.getElementById("bin-played");

    if (!calendarWrap || !splitWrap || !binEmpty) return;

    const movable = [...document.querySelectorAll('.day-dot[data-binable="1"]')];
    const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

    const first = new Map(movable.map(d => [d.dataset.date, d.getBoundingClientRect()]));

    if (binMixed) binMixed.innerHTML = "";
    if (binFlex) binFlex.innerHTML = "";
    if (binSolo) binSolo.innerHTML = "";
    if (binEmpty) binEmpty.innerHTML = "";
    if (oldPlayed) oldPlayed.innerHTML = "";

    const sorted = movable.slice().sort((a, b) => (a.dataset.date || "").localeCompare(b.dataset.date || ""));

    sorted.forEach(dot => {
      if (!dot.__homeParent) return;

      const ph = document.createElement("span");
      ph.className = "dot-spacer";
      ph.dataset.phFor = dot.dataset.date || "";

      dot.__placeholder = ph;
      dot.__homeParent.replaceChild(ph, dot);

      const total = Number(dot.dataset.count || 0);
      const solo = Number(dot.dataset.countSolo || 0);
      const flex = Number(dot.dataset.countFlex || 0);

      if (!total) {
        binEmpty.appendChild(dot);
        return;
      }

      // New grouped bins if present
      if (binMixed && binFlex && binSolo) {
        if (solo && flex) binMixed.appendChild(dot);
        else if (solo) binSolo.appendChild(dot);
        else binFlex.appendChild(dot);
        return;
      }

      // Old fallback: played vs empty
      if (oldPlayed) oldPlayed.appendChild(dot);
      else binEmpty.appendChild(dot);
    });

    splitWrap.classList.remove("hidden");
    calendarWrap.classList.add("hidden");

    if (prefersReduced) return;

    requestAnimationFrame(() => {
      const last = new Map(sorted.map(d => [d.dataset.date, d.getBoundingClientRect()]));
      sorted.forEach(dot => {
        const a = first.get(dot.dataset.date);
        const b = last.get(dot.dataset.date);
        if (!a || !b) return;

        dot.animate(
          [{ transform: `translate(${a.left - b.left}px, ${a.top - b.top}px)` }, { transform: "translate(0,0)" }],
          { duration: 520, easing: "cubic-bezier(.2,.9,.2,1)" }
        );
      });
    });
  }

  function animateToCalendarView() {
    const calendarWrap = document.getElementById("cal-calendar");
    const splitWrap = document.getElementById("cal-split");
    if (!calendarWrap || !splitWrap) return;

    const buckets = [
      document.getElementById("bin-mixed"),
      document.getElementById("bin-flex"),
      document.getElementById("bin-solo"),
      document.getElementById("bin-empty"),
      document.getElementById("bin-played"), // fallback
    ].filter(Boolean);

    const moved = buckets.flatMap(b => [...b.querySelectorAll(".day-dot")]);
    const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

    const first = new Map(moved.map(d => [d.dataset.date, d.getBoundingClientRect()]));

    moved.forEach(dot => {
      const parent = dot.__homeParent;
      const ph = dot.__placeholder;
      if (!parent || !ph) return;

      if (ph.parentNode === parent) parent.replaceChild(dot, ph);
      else parent.appendChild(dot);

      dot.__placeholder = null;
    });

    calendarWrap.classList.remove("hidden");
    splitWrap.classList.add("hidden");

    if (prefersReduced) return;

    requestAnimationFrame(() => {
      const last = new Map(moved.map(d => [d.dataset.date, d.getBoundingClientRect()]));
      moved.forEach(dot => {
        const a = first.get(dot.dataset.date);
        const b = last.get(dot.dataset.date);
        if (!a || !b) return;

        dot.animate(
          [{ transform: `translate(${a.left - b.left}px, ${a.top - b.top}px)` }, { transform: "translate(0,0)" }],
          { duration: 520, easing: "cubic-bezier(.2,.9,.2,1)" }
        );
      });
    });
  }

  /* =========================
     Unlock + window helpers
  ========================= */

  function calUnlockStatus() {
    const today = startOfDay(new Date());

    if (CAL_CONFIG.unlockAfterDate instanceof Date) {
      const unlock = startOfDay(CAL_CONFIG.unlockAfterDate);
      const unlocked = today >= unlock;
      return {
        unlocked,
        daysSinceStart: dayDiff(today, CAL_CONFIG.seasonStartDate),
        needDays: 0,
        remainingDays: unlocked ? 0 : dayDiff(unlock, today),
      };
    }

    const need = Math.max(0, Number(CAL_CONFIG.unlockAfterDays || 0));
    const since = dayDiff(today, CAL_CONFIG.seasonStartDate);
    return {
      unlocked: since >= need,
      daysSinceStart: since,
      needDays: need,
      remainingDays: since >= need ? 0 : Math.max(0, need - since),
    };
  }

  function getActiveWindow(today) {
    const yearStart = startOfDay(new Date(CAL_CONFIG.seasonYear, 0, 1));
    const yearEnd = startOfDay(new Date(CAL_CONFIG.seasonYear, 11, 31));

    const activeStart = startOfDay(CAL_CONFIG.seasonStartDate);
    const start = activeStart.getTime() < yearStart.getTime() ? yearStart : activeStart;
    const end = today.getTime() > yearEnd.getTime() ? yearEnd : today;

    return { activeStart: start, activeEnd: end, totalActiveDays: Math.max(0, dayDiff(end, start) + 1) };
  }

  function countDayTypesInWindow(data, start, end) {
    const s = startOfDay(start);
    const e = startOfDay(end);

    let mixed = 0, soloOnly = 0, flexOnly = 0, empty = 0, played = 0;

    for (let d = new Date(s); d.getTime() <= e.getTime(); d.setDate(d.getDate() + 1)) {
      const key = toISODateKey(d);
      const sc = data.solo.get(key) || 0;
      const fc = data.flex.get(key) || 0;

      if (!sc && !fc) { empty++; continue; }
      played++;

      if (sc && fc) mixed++;
      else if (sc) soloOnly++;
      else flexOnly++;
    }

    return { mixed, soloOnly, flexOnly, empty, played };
  }

  /* =========================
     CSV + misc helpers
  ========================= */

  function parseCSVToObjects(csvText) {
    const raw = String(csvText || "").replace(/\r/g, "");
    const lines = raw.split("\n").filter(l => l.length);
    if (!lines.length) return { rows: [], headers: [] };
    lines[0] = lines[0].replace(/^\uFEFF/, "");

    const headers = splitCSVLine(lines[0]);
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = splitCSVLine(lines[i]);
      if (!cols.length) continue;
      const obj = {};
      headers.forEach((h, idx) => (obj[h] = cols[idx] ?? ""));
      rows.push(obj);
    }
    return { rows, headers };
  }

  function splitCSVLine(line) {
    const out = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; continue; }
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === "," && !inQuotes) { out.push(cur); cur = ""; }
      else { cur += ch; }
    }
    out.push(cur);
    return out;
  }

  function getAny(row, keys) {
    for (const k of keys) {
      if (row && Object.prototype.hasOwnProperty.call(row, k)) return row[k];
    }
    return "";
  }

  function parseMaybeEUDateTime(v) {
    const s = String(v || "").trim();
    if (!s) return null;

    const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?/);
    if (m) {
      const dd = Number(m[1]);
      const mm = Number(m[2]) - 1;
      let yy = Number(m[3]);
      if (yy < 100) yy = 2000 + yy;
      const hh = m[4] ? Number(m[4]) : 0;
      const mi = m[5] ? Number(m[5]) : 0;
      const d = new Date(yy, mm, dd, hh, mi);
      return isNaN(d.getTime()) ? null : d;
    }

    const d2 = new Date(s);
    return isNaN(d2.getTime()) ? null : d2;
  }

  function toISODateKey(d) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function startOfDay(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  function daysInMonth(year, month0) {
    return new Date(year, month0 + 1, 0).getDate();
  }

  function monthName(m) {
    return ["January","February","March","April","May","June","July","August","September","October","November","December"][m];
  }

  function mondayIndex(dateObj) {
    return (dateObj.getDay() + 6) % 7;
  }

  function dayDiff(a, b) {
    return Math.floor((startOfDay(a).getTime() - startOfDay(b).getTime()) / 86400000);
  }
})();
