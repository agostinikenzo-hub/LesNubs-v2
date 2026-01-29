/* thedot.js — The CAL (Season 26 + Year Toggle)
   + Flex/Team vs Solo coloring
   + Bins grouped by meaning (Mixed / Flex only / Solo only / No game)

   UI upgrades:
   - Remove weekday header row "M T W T F S S" (redundant)
   - Add compact legend row explaining dot meaning (Flex / Solo / Both)

   NEW:
   - Longest streak of consecutive DAYS with ≥1 game
   - Longest streak of consecutive WEEKS (Mon-start) where ≥1 game in the week
   - Subtle aura/glow on dots belonging to the LONGEST streaks (works even if ongoing)
   - Compact streak pills in legend row

   NOTE: Your palette: BLUE = Solo, ORANGE = Flex, BOTH = split dot
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

  /* =========================
     UI helpers (legend + hide weekday header)
  ========================= */

  function injectCalUiStylesOnce() {
    if (document.getElementById("s26-cal-ui-style")) return;

    const style = document.createElement("style");
    style.id = "s26-cal-ui-style";
    style.textContent = `
      /* Compact legend row above the calendar grid */
      #cal-dot-legend{
        display:flex;
        align-items:center;
        gap:.55rem;
        margin: .2rem 0 .65rem 0;
        flex-wrap: wrap;
        color: rgba(100,116,139,0.92);
        font-size: .78rem;
        font-weight: 800;
      }
      #cal-dot-legend .cal-legend-item{
        display:inline-flex;
        align-items:center;
        gap:.45rem;
        padding: .26rem .52rem;
        border-radius: 999px;
        border: 1px solid rgba(226,232,240,0.95);
        background: rgba(255,255,255,0.55);
        line-height: 1;
        white-space: nowrap;
      }
      #cal-dot-legend .cal-legend-dot{
        width: 10px;
        height: 10px;
        border-radius: 999px;
        display:inline-block;
        border: 1px solid rgba(15,23,42,0.14);
        box-shadow: 0 1px 0 rgba(15,23,42,0.03);
        flex: 0 0 auto;
      }

      /* ✅ Your palette mapping: BLUE = Solo, ORANGE = Flex */
      #cal-dot-legend .cal-legend-dot.solo { background: rgba(59,130,246,0.92); }  /* Solo (blue) */
      #cal-dot-legend .cal-legend-dot.flex { background: rgba(249,115,22,0.92); }  /* Flex / Team (orange) */
      #cal-dot-legend .cal-legend-dot.mixed{
        background: linear-gradient(135deg, rgba(249,115,22,0.92) 0 50%, rgba(59,130,246,0.92) 50% 100%);
      }

      /* Streak pills */
      #cal-dot-legend .cal-legend-item.is-streak{
        border-color: rgba(249,115,22,0.18);
        background: rgba(249,115,22,0.06);
        color: rgba(15,23,42,0.86);
      }
      #cal-dot-legend .cal-legend-item.is-streak .muted{
        color: rgba(100,116,139,0.92);
        font-weight: 900;
      }

      /* Aura/glow on streak dots (won't change layout) */
      .day-dot{ position: relative; }
      .day-dot--streak-day::before{
        content:"";
        position:absolute;
        inset:-3px;
        border-radius: 999px;
        pointer-events:none;
        background: radial-gradient(circle at 50% 50%,
          rgba(249,115,22,0.28) 0%,
          rgba(249,115,22,0.18) 45%,
          rgba(249,115,22,0.00) 70%
        );
      }
      .day-dot--streak-week::after{
        content:"";
        position:absolute;
        inset:-2px;
        border-radius: 999px;
        pointer-events:none;
        background: radial-gradient(circle at 50% 50%,
          rgba(59,130,246,0.20) 0%,
          rgba(59,130,246,0.10) 45%,
          rgba(59,130,246,0.00) 72%
        );
      }
    `;
    document.head.appendChild(style);
  }

  function ensureDotLegendRow() {
    const calendarWrap = document.getElementById("cal-calendar");
    const grid = document.getElementById("cal-grid");
    if (!calendarWrap || !grid) return;

    injectCalUiStylesOnce();

    let legend = document.getElementById("cal-dot-legend");
    if (!legend) {
      legend = document.createElement("div");
      legend.id = "cal-dot-legend";
      legend.setAttribute("aria-label", "Calendar dot legend");

      legend.innerHTML = `
        <span class="cal-legend-item" title="Days with Flex/Team games only">
          <span class="cal-legend-dot flex"></span>
          Flex / Team
        </span>
        <span class="cal-legend-item" title="Days with Solo games only">
          <span class="cal-legend-dot solo"></span>
          Solo
        </span>
        <span class="cal-legend-item" title="Days with both Flex/Team and Solo games">
          <span class="cal-legend-dot mixed"></span>
          Both
        </span>

        <span class="cal-legend-item is-streak" id="cal-streak-days" title="Longest streak of consecutive days with ≥1 game">
          🔥 <span class="muted">—</span>
        </span>
        <span class="cal-legend-item is-streak" id="cal-streak-weeks" title="Longest streak of consecutive weeks (Mon-start) with ≥1 game in the week">
          ✦ <span class="muted">—</span>
        </span>
      `;

      // Insert right above the grid
      grid.parentNode.insertBefore(legend, grid);
    }
  }

  function updateStreakLegend(bestDayLen, bestWeekLen) {
    const dEl = document.getElementById("cal-streak-days");
    const wEl = document.getElementById("cal-streak-weeks");
    if (dEl) dEl.innerHTML = `🔥 <span class="muted">${bestDayLen ? `${bestDayLen} day${bestDayLen === 1 ? "" : "s"}` : "0 days"}</span>`;
    if (wEl) wEl.innerHTML = `✦ <span class="muted">${bestWeekLen ? `${bestWeekLen} week${bestWeekLen === 1 ? "" : "s"}` : "0 weeks"}</span>`;
  }

  // Stronger weekday header removal: catches containers that render as "MTWTFSS" OR "M T W T F S S"
  function hideWeekdayHeaderRow() {
    const normalizeLetters = (t) =>
      String(t || "")
        .toUpperCase()
        .replace(/[^A-Z]/g, ""); // keep letters only

    const patterns = new Set([
      "MTWTFSS", // classic
      "MDMDFSS", // DE-ish if someone used M D M D F S S
      "LMMJVSD", // FR-ish (Lu Ma Me Je Ve Sa Di) just in case
    ]);

    // common selectors (best case)
    const quick = [
      "#cal-weekdays",
      ".cal-weekdays",
      ".weekday-row",
      ".dow-row",
      ".calendar-weekdays",
      "[data-cal-weekdays='1']",
    ];
    for (const sel of quick) {
      const el = document.querySelector(sel);
      if (el && el.dataset?.hiddenWeekdays !== "1") {
        el.style.display = "none";
        el.dataset.hiddenWeekdays = "1";
      }
    }

    // scan: hide elements whose letter-only text matches a weekday strip
    const all = document.querySelectorAll("body *");
    for (const el of all) {
      if (!el || el.dataset?.hiddenWeekdays === "1") continue;

      // don't hide big containers that include dots
      if (el.querySelector && (el.querySelector(".dots-grid") || el.querySelector(".day-dot") || el.querySelector("#cal-grid"))) {
        continue;
      }

      const letters = normalizeLetters(el.textContent);
      if (!letters) continue;

      // exact weekday row in one element
      if (patterns.has(letters)) {
        el.style.display = "none";
        if (el.dataset) el.dataset.hiddenWeekdays = "1";
        continue;
      }

      // sometimes it's "MON TUE..." etc, ignore
      // sometimes each day is its own element; hide parent if it looks like a 7-item weekday strip
      if (letters.length === 7 && patterns.has(letters)) {
        el.style.display = "none";
        if (el.dataset) el.dataset.hiddenWeekdays = "1";
      }
    }
  }

  function startWeekdayHeaderGuard() {
    if (window.__S26_CAL_WEEKDAY_GUARD__) return;
    window.__S26_CAL_WEEKDAY_GUARD__ = true;

    hideWeekdayHeaderRow();
    setTimeout(hideWeekdayHeaderRow, 50);
    setTimeout(hideWeekdayHeaderRow, 250);

    const obs = new MutationObserver(() => {
      hideWeekdayHeaderRow();
    });

    obs.observe(document.body, { subtree: true, childList: true, characterData: true });
  }

  /* =========================
     Streak logic (days + weeks)
  ========================= */

  function isPlayedDay(data, dateKey) {
    const t = (data?.total?.get?.(dateKey) || 0) + 0;
    return t > 0;
  }

  function mondayStart(d) {
    const x = startOfDay(d);
    const idx = mondayIndex(x); // 0..6 (Mon..Sun)
    x.setDate(x.getDate() - idx);
    return x;
  }

  function weekKeyFromDateKey(dateKey) {
    // dateKey: YYYY-MM-DD
    const d = new Date(dateKey + "T00:00:00");
    return toISODateKey(mondayStart(d));
  }

  function computeBestDayStreak(data, start, end) {
    const s = startOfDay(start);
    const e = startOfDay(end);

    let bestLen = 0;
    let bestStartKey = "";
    let bestEndKey = "";

    let runLen = 0;
    let runStartKey = "";

    let curLen = 0;
    let curStartKey = "";

    for (let d = new Date(s); d.getTime() <= e.getTime(); d.setDate(d.getDate() + 1)) {
      const key = toISODateKey(d);
      const played = isPlayedDay(data, key);

      // current (ongoing-to-end) tracking
      if (played) {
        if (curLen === 0) curStartKey = key;
        curLen += 1;
      } else {
        curLen = 0;
        curStartKey = "";
      }

      // best run tracking
      if (played) {
        if (runLen === 0) runStartKey = key;
        runLen += 1;
      } else {
        if (runLen > bestLen) {
          bestLen = runLen;
          bestStartKey = runStartKey;
          bestEndKey = toISODateKey(new Date(d.getTime() - 86400000));
        }
        runLen = 0;
        runStartKey = "";
      }
    }

    // finalize
    if (runLen > bestLen) {
      bestLen = runLen;
      bestStartKey = runStartKey;
      bestEndKey = toISODateKey(end);
    }

    return {
      best: { len: bestLen, startKey: bestStartKey, endKey: bestEndKey },
      current: { len: curLen, startKey: curStartKey, endKey: curLen ? toISODateKey(end) : "" },
    };
  }

  function computeBestWeekStreak(data, start, end) {
    const s = startOfDay(start);
    const e = startOfDay(end);

    // weekStartKey -> played?
    const weekPlayed = new Map();

    for (let d = new Date(s); d.getTime() <= e.getTime(); d.setDate(d.getDate() + 1)) {
      const key = toISODateKey(d);
      if (!isPlayedDay(data, key)) continue;
      const wk = toISODateKey(mondayStart(d));
      weekPlayed.set(wk, true);
    }

    const ws = mondayStart(s);
    const we = mondayStart(e);

    let bestLen = 0;
    let bestStartWk = "";
    let bestEndWk = "";

    let runLen = 0;
    let runStartWk = "";

    let curLen = 0;
    let curStartWk = "";

    for (let w = new Date(ws); w.getTime() <= we.getTime(); w.setDate(w.getDate() + 7)) {
      const wk = toISODateKey(w);
      const played = weekPlayed.get(wk) === true;

      // current tracking (ending at last week)
      if (played) {
        if (curLen === 0) curStartWk = wk;
        curLen += 1;
      } else {
        curLen = 0;
        curStartWk = "";
      }

      // best tracking
      if (played) {
        if (runLen === 0) runStartWk = wk;
        runLen += 1;
      } else {
        if (runLen > bestLen) {
          bestLen = runLen;
          bestStartWk = runStartWk;
          bestEndWk = toISODateKey(new Date(w.getTime() - 7 * 86400000));
        }
        runLen = 0;
        runStartWk = "";
      }
    }

    if (runLen > bestLen) {
      bestLen = runLen;
      bestStartWk = runStartWk;
      bestEndWk = toISODateKey(we);
    }

    return {
      best: { len: bestLen, startWk: bestStartWk, endWk: bestEndWk },
      current: { len: curLen, startWk: curStartWk, endWk: curLen ? toISODateKey(we) : "" },
      weekPlayed,
    };
  }

  function buildDateKeySet(startKey, endKey) {
    const out = new Set();
    if (!startKey || !endKey) return out;
    const s = new Date(startKey + "T00:00:00");
    const e = new Date(endKey + "T00:00:00");
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return out;
    for (let d = new Date(s); d.getTime() <= e.getTime(); d.setDate(d.getDate() + 1)) {
      out.add(toISODateKey(d));
    }
    return out;
  }

  function buildWeekKeySet(startWk, endWk) {
    const out = new Set();
    if (!startWk || !endWk) return out;
    const s = new Date(startWk + "T00:00:00");
    const e = new Date(endWk + "T00:00:00");
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return out;
    for (let w = new Date(s); w.getTime() <= e.getTime(); w.setDate(w.getDate() + 7)) {
      out.add(toISODateKey(w));
    }
    return out;
  }

  function applyStreakDecorations(data) {
    const today = startOfDay(new Date());
    const { activeStart, activeEnd } = getActiveWindow(today);

    const dayStreak = computeBestDayStreak(data, activeStart, activeEnd);
    const weekStreak = computeBestWeekStreak(data, activeStart, activeEnd);

    updateStreakLegend(dayStreak.best.len, weekStreak.best.len);

    const bestDayKeys = buildDateKeySet(dayStreak.best.startKey, dayStreak.best.endKey);
    const bestWeekKeys = buildWeekKeySet(weekStreak.best.startWk, weekStreak.best.endWk);

    // Apply glow classes to dots
    const dots = document.querySelectorAll(".day-dot[data-date]");
    dots.forEach((dot) => {
      const key = dot.dataset.date || "";
      if (!key) return;

      // day streak glow (only if played)
      const played = (Number(dot.dataset.count || 0) || 0) > 0;
      dot.classList.toggle("day-dot--streak-day", played && bestDayKeys.has(key));

      // week streak glow (only if played)
      const wk = weekKeyFromDateKey(key);
      dot.classList.toggle("day-dot--streak-week", played && bestWeekKeys.has(wk));
    });
  }

  /* =========================
     Mount
  ========================= */

  async function mountCAL() {
    const statusEl = document.getElementById("cal-status");
    const lockedWrap = document.getElementById("cal-locked");
    const lockedText = document.getElementById("cal-locked-text");

    const calendarWrap = document.getElementById("cal-calendar");
    const splitWrap = document.getElementById("cal-split");
    const btnView = document.getElementById("btn-view");
    const btnViewLabel = document.getElementById("btn-view-label");

    if (!statusEl || !calendarWrap || !splitWrap || !btnView || !btnViewLabel) return;

    // UI upgrades (static)
    ensureDotLegendRow();
    startWeekdayHeaderGuard();

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

      ensureDotLegendRow();
      hideWeekdayHeaderRow();

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

      // Apply streak UI + aura
      applyStreakDecorations(STATE.matchesPerDay);

      hideWeekdayHeaderRow();
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

    ensureDotLegendRow();
    hideWeekdayHeaderRow();

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

    hideWeekdayHeaderRow();

    // After rendering dots, apply aura based on longest streaks
    applyStreakDecorations(data);
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

    ensureDotLegendRow();
    hideWeekdayHeaderRow();

    // re-apply streak aura (dots moved back)
    if (STATE.matchesPerDay) applyStreakDecorations(STATE.matchesPerDay);

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
