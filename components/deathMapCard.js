// /components/deathMapCard.js
import { getLatestDDragonVersion } from "../core/ddragon.js";
import {
  buildCombatEvents,
  buildWardEvents,
  tagDeathsByVision,
  buildDamageSpikeEvents,
  summarizeDamageSpikeEvents,
  dbscan,
  summarizeEvents,
  summarizeWardEvents,
  generateTips,
  worldToCanvas,
} from "../core/deathMap.js";

/**
 * ✅ Patch: make deaths/kills resilient to pipeline header changes
 * - Normalizes Match ID + Minute (from Timestamp) + Position keys
 * - If core buildCombatEvents returns 0 deaths/kills, falls back to delta-based reconstruction
 */

function esc(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function pill(label, value) {
  return `
    <div class="rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-[0.7rem] text-slate-700">
      <span class="text-slate-400">${esc(label)}:</span>
      <span class="font-semibold ml-1">${esc(value)}</span>
    </div>
  `;
}

function barRow(label, count, total) {
  const pct = total ? Math.round((count / total) * 100) : 0;
  return `
    <div class="flex items-center gap-2">
      <div class="w-28 text-[0.72rem] text-slate-600 truncate" title="${esc(label)}">${esc(label)}</div>
      <div class="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
        <div class="h-2 rounded-full bg-orange-400" style="width:${pct}%;"></div>
      </div>
      <div class="w-14 text-right text-[0.7rem] text-slate-500">${count} <span class="text-slate-300">(${pct}%)</span></div>
    </div>
  `;
}

function selectOption(label, value, selected) {
  return `<option value="${esc(value)}" ${selected ? "selected" : ""}>${esc(label)}</option>`;
}

function uniq(arr) {
  return [...new Set(arr.filter(Boolean))];
}

/* -------------------------- timeline normalization -------------------------- */

function dmGetAny(row, keys) {
  for (const k of keys) {
    if (row && k in row && row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== "") return row[k];
  }
  return "";
}

function dmNum(v) {
  if (v === null || v === undefined || v === "") return 0;
  const n = parseFloat(String(v).replace("%", "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function dmBool(v) {
  const s = String(v || "").trim().toUpperCase();
  return s === "1" || s === "TRUE" || s === "YES";
}

function dmGetMatchId(r) {
  return String(
    dmGetAny(r, [
      "Match ID",
      "MatchID",
      "MatchId",
      "matchId",
      "match_id",
      "Game ID",
      "GameID",
      "GameId",
      "gameId",
      "p.matchId",
      "pf.matchId",
      "metadata.matchId",
      "info.gameId",
      "Game #",
      "Date",
    ])
  ).trim();
}

function dmGetTimestampMs(r) {
  const raw = dmGetAny(r, ["Timestamp", "timestamp", "Time", "time", "Game Time", "GameTime", "TimeMs", "Time (ms)"]);
  if (raw === "" || raw === null || raw === undefined) return 0;
  const n = parseFloat(String(raw).replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n < 2000 ? n * 1000 : n;
}

function dmGetMinute(r) {
  const rawMin = dmGetAny(r, ["Minute", "minute", "Min", "min"]);
  if (rawMin !== "" && rawMin !== null && rawMin !== undefined) {
    const m = parseFloat(String(rawMin).replace(",", "."));
    if (Number.isFinite(m) && m >= 0) return Math.floor(m);
  }
  const tsMs = dmGetTimestampMs(r);
  if (!tsMs) return 0;
  return Math.max(0, Math.floor(tsMs / 60000));
}

function dmGetPlayer(r) {
  return String(dmGetAny(r, ["Player", "p.riotIdGameName", "p.summonerName", "Summoner"])).trim();
}

function dmGetTeamId(r) {
  const n = dmNum(dmGetAny(r, ["TeamId", "Team ID", "teamId", "team_id"]));
  return n || 0;
}

function normalizeDeathMapTimelineRows(rows) {
  const arr = Array.isArray(rows) ? rows.slice() : [];
  if (!arr.length) return arr;

  // 1) ensure Minute
  for (const r of arr) {
    if (!r) continue;
    if (String(r["Minute"] ?? "").trim() === "") r["Minute"] = dmGetMinute(r);
  }

  // 2) normalize Match ID if present (propagate within contiguous segments)
  let foundAny = false;
  let currentMid = "";
  for (const r of arr) {
    if (!r) continue;
    const mid = dmGetMatchId(r);
    if (mid) {
      r["Match ID"] = mid;
      currentMid = mid;
      foundAny = true;
    } else if (currentMid) {
      r["Match ID"] = currentMid;
    }
  }

  // 3) if still no IDs anywhere -> infer synthetic by timestamp resets
  if (!foundAny) {
    let matchIdx = 0;
    let lastTs = -Infinity;
    let seenPast3Min = false;

    for (const r of arr) {
      if (!r) continue;
      const ts = dmGetTimestampMs(r);
      if (ts > 0) {
        if (seenPast3Min && ts < lastTs - 120000) {
          matchIdx += 1;
          seenPast3Min = false;
        }
        if (ts >= 180000) seenPast3Min = true;
        lastTs = ts;
      }
      if (String(r["Match ID"] ?? "").trim() === "") r["Match ID"] = `SYN_${matchIdx}`;
    }
  }

  // 4) normalize positions (support both PosX/PosY and pf.position.x/y)
  for (const r of arr) {
    if (!r) continue;

    const x = dmNum(dmGetAny(r, ["PosX", "posX", "X", "x", "pf.position.x", "pf.positionX", "Position X", "position.x"]));
    const y = dmNum(dmGetAny(r, ["PosY", "posY", "Y", "y", "pf.position.y", "pf.positionY", "Position Y", "position.y"]));

    if (!String(r["PosX"] ?? "").trim()) r["PosX"] = x || 0;
    if (!String(r["PosY"] ?? "").trim()) r["PosY"] = y || 0;

    // also provide dotted keys if core expects them
    if (!String(r["pf.position.x"] ?? "").trim()) r["pf.position.x"] = x || 0;
    if (!String(r["pf.position.y"] ?? "").trim()) r["pf.position.y"] = y || 0;

    // ensure TeamId key exists if pipeline renamed it
    if (String(r["TeamId"] ?? "").trim() === "") {
      const tid = dmGetTeamId(r);
      if (tid) r["TeamId"] = tid;
    }
  }

  return arr;
}

/* ---------------- fallback kills/deaths reconstruction ---------------- */

function phaseFromMinute(min) {
  if (min <= 14) return "Early";
  if (min <= 24) return "Mid";
  return "Late";
}

function modeOf(arr) {
  const m = new Map();
  for (const v of arr) {
    const k = String(v || "").trim();
    if (!k) continue;
    m.set(k, (m.get(k) || 0) + 1);
  }
  let best = "";
  let bestC = -1;
  for (const [k, c] of m.entries()) {
    if (c > bestC) {
      best = k;
      bestC = c;
    }
  }
  return best || "";
}

function objectiveFromDelta(prev, cur) {
  const dDrag = (cur.drag || 0) - (prev.drag || 0);
  const dHer = (cur.herald || 0) - (prev.herald || 0);
  const dBar = (cur.baron || 0) - (prev.baron || 0);

  if (dBar > 0) return "baron";
  if (dDrag > 0) return "dragon";
  if (dHer > 0) return "herald";
  return "None";
}

function getTeamKills(r) {
  return dmNum(
    dmGetAny(r, [
      "Team Kills",
      "TeamKills",
      "teamKills",
      "Kills (Team)",
      "Team Kills (Total)",
      "Team_Total_Kills",
    ])
  );
}

function getEnemyKills(r) {
  return dmNum(
    dmGetAny(r, [
      "Enemy Kills",
      "EnemyKills",
      "enemyKills",
      "Kills (Enemy)",
      "Enemy Kills (Total)",
      "Enemy_Total_Kills",
    ])
  );
}

function getMinuteTeamKills(r) {
  return dmNum(
    dmGetAny(r, [
      "Minute Kills (Team)",
      "MinuteKillsTeam",
      "Minute Kills Team",
      "m_kills_team",
    ])
  );
}

function getMinuteEnemyKills(r) {
  return dmNum(
    dmGetAny(r, [
      "Minute Kills (Enemy)",
      "MinuteKillsEnemy",
      "Minute Kills Enemy",
      "m_kills_enemy",
    ])
  );
}

function hasMinuteKillFields(r) {
  const a = dmGetAny(r, ["Minute Kills (Team)", "MinuteKillsTeam", "Minute Kills Team", "m_kills_team"]);
  const b = dmGetAny(r, ["Minute Kills (Enemy)", "MinuteKillsEnemy", "Minute Kills Enemy", "m_kills_enemy"]);
  return String(a ?? "").trim() !== "" || String(b ?? "").trim() !== "";
}

function getObjTotals(r) {
  return {
    drag: dmNum(dmGetAny(r, ["Team Dragons", "TeamDragons", "teamDragons"])),
    herald: dmNum(dmGetAny(r, ["Team Heralds", "TeamHeralds", "teamHeralds"])),
    baron: dmNum(dmGetAny(r, ["Team Barons", "TeamBarons", "teamBarons"])),
  };
}

const SR_MIN = 0;
const SR_MAX = 15000;

function clampSr(v) {
  return Math.max(SR_MIN, Math.min(SR_MAX, v));
}

function inferRiverFromPos(x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;

  const mainBand = Math.abs(x - y) <= 1700 && x >= 2500 && x <= 12500 && y >= 2500 && y <= 12500;
  const dragonArea = x >= 8200 && x <= 11250 && y >= 2600 && y <= 6100;
  const baronArea = x >= 3200 && x <= 6600 && y >= 8700 && y <= 11800;
  return mainBand || dragonArea || baronArea;
}

function inferZoneFromPos(x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return "Unknown";
  if (inferRiverFromPos(x, y)) return "River";
  if (x <= 2400 && y <= 2400) return "Base";
  if (x >= 12600 && y >= 12600) return "Base";

  const delta = x - y;
  if (delta >= 2600) return "Bot Side";
  if (delta <= -2600) return "Top Side";
  if (Math.abs(delta) <= 1200) return "Mid";
  return "Jungle";
}

function stableHash(s) {
  let h = 2166136261;
  const str = String(s || "");
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function jitterPoint(base, seed, idx, spread = 170) {
  const h = stableHash(`${seed}|${idx}`);
  const angle = ((h % 360) * Math.PI) / 180;
  const mag = 0.2 + (((h >>> 8) % 1000) / 1000) * 0.8;
  const r = spread * mag;

  return {
    x: clampSr(base.x + Math.cos(angle) * r),
    y: clampSr(base.y + Math.sin(angle) * r),
  };
}

function readPos(row, xKeys, yKeys) {
  const x = dmNum(dmGetAny(row, xKeys));
  const y = dmNum(dmGetAny(row, yKeys));
  if (x <= 0 || y <= 0) return null;
  return { x: clampSr(x), y: clampSr(y) };
}

function dedupeCandidates(cands) {
  const out = [];
  const seen = new Set();
  for (const c of cands || []) {
    if (!c || !Number.isFinite(c.x) || !Number.isFinite(c.y)) continue;
    const k = `${Math.round(c.x / 80)}|${Math.round(c.y / 80)}|${c.player || ""}|${c.champion || ""}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(c);
  }
  return out;
}

function buildTeamCandidates(teamRows) {
  const out = [];

  for (let i = 0; i < teamRows.length; i++) {
    const r = teamRows[i];
    const pos = readPos(r, ["PosX", "pf.position.x", "Position X", "position.x"], ["PosY", "pf.position.y", "Position Y", "position.y"]);
    if (!pos) continue;

    const zoneRaw = String(dmGetAny(r, ["Zone"])).trim();
    const inRiverRaw = dmGetAny(r, ["In River"]);
    const close = dmNum(dmGetAny(r, ["Close Teammates"]));
    const grouped = dmBool(dmGetAny(r, ["Is Grouped"]));

    out.push({
      id: `team|${i}|${dmGetPlayer(r)}`,
      x: pos.x,
      y: pos.y,
      player: dmGetPlayer(r),
      champion: String(dmGetAny(r, ["Champion"])).trim(),
      role: String(dmGetAny(r, ["Role", "ROLE"])).trim(),
      health: dmNum(dmGetAny(r, ["pf.championStats.health", "Champion Health", "Health"])),
      zone: zoneRaw || inferZoneFromPos(pos.x, pos.y),
      inRiver: String(inRiverRaw ?? "").trim() ? dmBool(inRiverRaw) : inferRiverFromPos(pos.x, pos.y),
      closeTeammates: close,
      grouped,
    });
  }

  return dedupeCandidates(out);
}

function buildEnemyCandidates(teamRows) {
  const out = [];

  for (let i = 0; i < teamRows.length; i++) {
    const r = teamRows[i];
    const pos = readPos(
      r,
      ["Lane Opponent PosX", "opp_pf.position.x", "Opponent PosX", "opp.position.x"],
      ["Lane Opponent PosY", "opp_pf.position.y", "Opponent PosY", "opp.position.y"]
    );
    if (!pos) continue;

    out.push({
      id: `enemy|${i}|${String(dmGetAny(r, ["Lane Opponent"])).trim()}`,
      x: pos.x,
      y: pos.y,
      player: String(dmGetAny(r, ["Lane Opponent"])).trim(),
      champion: String(dmGetAny(r, ["Lane Opponent Champion"])).trim(),
      role: String(dmGetAny(r, ["Lane Opponent Role"])).trim(),
      health: dmNum(dmGetAny(r, ["opp_pf.championStats.health", "Lane Opponent Health"])),
      zone: inferZoneFromPos(pos.x, pos.y),
      inRiver: inferRiverFromPos(pos.x, pos.y),
      closeTeammates: Number.NaN,
      grouped: null,
    });
  }

  return dedupeCandidates(out);
}

function pickEventAnchors(cands, count, { seed = "", preferIsolation = false, spread = 170 } = {}) {
  if (!Array.isArray(cands) || !cands.length || count <= 0) return [];

  const ranked = cands
    .slice()
    .sort((a, b) => {
      const ah = Number.isFinite(a.health) && a.health > 0 ? a.health : Number.POSITIVE_INFINITY;
      const bh = Number.isFinite(b.health) && b.health > 0 ? b.health : Number.POSITIVE_INFINITY;
      if (ah !== bh) return ah - bh;

      if (preferIsolation) {
        const ai = Number.isFinite(a.closeTeammates) ? a.closeTeammates : 99;
        const bi = Number.isFinite(b.closeTeammates) ? b.closeTeammates : 99;
        if (ai !== bi) return ai - bi;
      }

      return String(a.player || "").localeCompare(String(b.player || ""));
    });

  const poolSize = Math.max(1, Math.min(ranked.length, Math.max(count, 2)));
  const pool = ranked.slice(0, poolSize);
  const out = [];

  for (let i = 0; i < count; i++) {
    const base = pool[i % pool.length];
    const p = jitterPoint(base, `${seed}|${base.id || base.player || ""}`, i, pool.length === 1 ? spread * 1.8 : spread);
    out.push({
      ...base,
      x: p.x,
      y: p.y,
    });
  }

  return out;
}

function fallbackBuildCombatEvents(timelineRows, { roster } = {}) {
  const rows = Array.isArray(timelineRows) ? timelineRows : [];
  const rosterNames = Array.isArray(roster)
    ? roster
        .map((x) => {
          if (!x) return "";
          if (typeof x === "string") return x.trim();
          if (typeof x === "object") return String(x.name || x.player || x.summoner || "").trim();
          return "";
        })
        .filter(Boolean)
    : [];
  const rosterSet = new Set(rosterNames);

  // Determine roster team per match (to set matchSide consistently)
  const rosterTeamCounts = new Map(); // matchId -> Map(teamId->count)
  for (const r of rows) {
    if (!r) continue;
    const mid = dmGetMatchId(r);
    const tid = dmGetTeamId(r);
    const p = dmGetPlayer(r);
    if (!mid || !tid || !p) continue;
    if (!rosterSet.size || !rosterSet.has(p)) continue;

    if (!rosterTeamCounts.has(mid)) rosterTeamCounts.set(mid, new Map());
    const m = rosterTeamCounts.get(mid);
    m.set(tid, (m.get(tid) || 0) + 1);
  }

  const rosterTeamByMatch = new Map(); // matchId -> teamId
  for (const [mid, map] of rosterTeamCounts.entries()) {
    let bestTid = 0;
    let bestC = -1;
    for (const [tid, c] of map.entries()) {
      if (c > bestC) {
        bestC = c;
        bestTid = tid;
      }
    }
    if (bestTid) rosterTeamByMatch.set(mid, bestTid);
  }

  const matchSideByMatch = new Map(); // matchId -> "blue"/"red"/null
  for (const [mid, tid] of rosterTeamByMatch.entries()) {
    matchSideByMatch.set(mid, tid === 100 ? "blue" : tid === 200 ? "red" : null);
  }

  // Group frames by match|team|minute
  const framesByKey = new Map(); // key -> { matchId, teamId, minute, rows: [] }
  const keysByMatchTeam = new Map(); // match|team -> Map(minute->key)

  for (const r of rows) {
    if (!r) continue;
    const mid = dmGetMatchId(r);
    const tid = dmGetTeamId(r);
    const minute = dmGetMinute(r);
    if (!mid || !tid) continue;

    const key = `${mid}|${tid}|${minute}`;
    if (!framesByKey.has(key)) {
      framesByKey.set(key, { matchId: mid, teamId: tid, minute, rows: [] });
    }
    framesByKey.get(key).rows.push(r);

    const mt = `${mid}|${tid}`;
    if (!keysByMatchTeam.has(mt)) keysByMatchTeam.set(mt, new Map());
    keysByMatchTeam.get(mt).set(minute, key);
  }

  const deaths = [];
  const kills = [];

  for (const [, minuteMap] of keysByMatchTeam.entries()) {
    const minutes = [...minuteMap.keys()].sort((a, b) => a - b);

    let prevTeamKills = 0;
    let prevEnemyKills = 0;
    let prevObj = { drag: 0, herald: 0, baron: 0 };

    for (const minute of minutes) {
      const key = minuteMap.get(minute);
      const bucket = framesByKey.get(key);
      if (!bucket || !bucket.rows.length) continue;

      const sample = bucket.rows[0];

      const curTeamKills = getTeamKills(sample);
      const curEnemyKills = getEnemyKills(sample);

      let dK = 0;
      let dD = 0;
      if (hasMinuteKillFields(sample)) {
        dK = Math.max(0, Math.round(getMinuteTeamKills(sample)));
        dD = Math.max(0, Math.round(getMinuteEnemyKills(sample)));
      } else {
        dK = Math.max(0, Math.round(curTeamKills - prevTeamKills));
        dD = Math.max(0, Math.round(curEnemyKills - prevEnemyKills));
      }

      const curObj = getObjTotals(sample);
      const objective = objectiveFromDelta(prevObj, curObj);

      prevTeamKills = curTeamKills;
      prevEnemyKills = curEnemyKills;
      prevObj = curObj;

      if (!dK && !dD) continue;

      const teamRows = bucket.rows;
      const teamCandidates = buildTeamCandidates(teamRows);
      const enemyCandidates = buildEnemyCandidates(teamRows);

      const xs = teamCandidates.map((p) => p.x);
      const ys = teamCandidates.map((p) => p.y);
      const cx = xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : dmNum(sample["PosX"] ?? sample["pf.position.x"] ?? 0);
      const cy = ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : dmNum(sample["PosY"] ?? sample["pf.position.y"] ?? 0);

      const zones = teamRows.map((r) => String(r["Zone"] || "").trim()).filter(Boolean);
      const zone = modeOf(zones) || inferZoneFromPos(cx, cy);

      const rivers = teamRows.map((r) => dmBool(r["In River"]));
      const inRiver = rivers.length
        ? rivers.filter(Boolean).length >= Math.ceil(rivers.length * 0.5)
        : inferRiverFromPos(cx, cy);

      const groupedFlags = teamRows.map((r) => dmBool(r["Is Grouped"]));
      const grouped = groupedFlags.filter(Boolean).length >= Math.ceil(groupedFlags.length * 0.5);

      const closeAvg =
        teamRows.length
          ? teamRows.reduce((a, r) => a + dmNum(r["Close Teammates"]), 0) / teamRows.length
          : 0;

      const matchId = bucket.matchId;
      const teamId = bucket.teamId;

      const rosterTeam = rosterTeamByMatch.get(matchId) || null;
      const matchSide = matchSideByMatch.get(matchId) || null;

      const isRoster = rosterTeam ? teamId === rosterTeam : true; // if no roster known, treat as roster for visibility

      const tSec = minute * 60;
      const tMs = minute * 60000;
      const goldDiffTeam = dmNum(dmGetAny(sample, ["Gold Diff (Team)"]));
      const behind = Number.isFinite(goldDiffTeam) ? goldDiffTeam < 0 : null;

      const base = {
        matchId,
        teamId,
        minute,
        phase: phaseFromMinute(minute),
        objective: objective || "None",
        isRoster,
        matchSide, // this is "our side for that match"
        goldDiffTeam,
        behind,
        timestamp: tMs,
        // time aliases for compatibility with tagDeathsByVision / summarizers
        t: tSec,
        ts: tSec,
        timeSec: tSec,
        timestampSec: tSec,
      };

      const killAnchors = pickEventAnchors(
        enemyCandidates.length ? enemyCandidates : teamCandidates,
        dK,
        {
          seed: `${matchId}|${teamId}|${minute}|K`,
          preferIsolation: false,
          spread: grouped ? 145 : 190,
        }
      );

      const deathAnchors = pickEventAnchors(
        teamCandidates.length ? teamCandidates : enemyCandidates,
        dD,
        {
          seed: `${matchId}|${teamId}|${minute}|D`,
          preferIsolation: true,
          spread: grouped ? 145 : 205,
        }
      );

      for (let i = 0; i < dK; i++) {
        const a = killAnchors[i] || { x: cx, y: cy, zone, inRiver, grouped, closeTeammates: closeAvg };
        const zoneHere = a.zone || inferZoneFromPos(a.x, a.y) || zone;
        const inRiverHere = typeof a.inRiver === "boolean" ? a.inRiver : inferRiverFromPos(a.x, a.y);
        const groupedHere = typeof a.grouped === "boolean" ? a.grouped : grouped;
        const closeHere = Number.isFinite(a.closeTeammates) ? a.closeTeammates : closeAvg;
        const soloHere = !groupedHere && closeHere <= 1.3;

        kills.push({
          ...base,
          kind: "kill",
          x: a.x,
          y: a.y,
          zone: zoneHere,
          inRiver: inRiverHere,
          grouped: groupedHere,
          solo: soloHere,
          closeTeammates: closeHere,
          soloPick: soloHere,
          groupedFight: !!groupedHere || closeHere >= 2,
        });
      }
      for (let i = 0; i < dD; i++) {
        const a = deathAnchors[i] || { x: cx, y: cy, zone, inRiver, grouped, closeTeammates: closeAvg };
        const zoneHere = a.zone || inferZoneFromPos(a.x, a.y) || zone;
        const inRiverHere = typeof a.inRiver === "boolean" ? a.inRiver : inferRiverFromPos(a.x, a.y);
        const groupedHere = typeof a.grouped === "boolean" ? a.grouped : grouped;
        const closeHere = Number.isFinite(a.closeTeammates) ? a.closeTeammates : closeAvg;
        const soloHere = !groupedHere && closeHere <= 1.3;

        deaths.push({
          ...base,
          kind: "death",
          x: a.x,
          y: a.y,
          zone: zoneHere,
          inRiver: inRiverHere,
          grouped: groupedHere,
          solo: soloHere,
          closeTeammates: closeHere,
          soloPick: soloHere,
          groupedFight: !!groupedHere || closeHere >= 2,
        });
      }
    }
  }

  return { deaths, kills };
}

/* ----------------------------- minimap loader ----------------------------- */

async function loadMinimapImg() {
  const ver = await getLatestDDragonVersion();
  const src = `https://ddragon.leagueoflegends.com/cdn/${ver}/img/map/map11.png`;

  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = src;
  });
  return img;
}

/* --------------------------------- filters -------------------------------- */

function filterEvents(events, state) {
  return events.filter((e) => {
    if (state.scope === "roster" && !e.isRoster) return false;

    // match-side filter (our roster's side for that match)
    if (state.matchSide !== "all") {
      if (!e.matchSide) return false;
      if (e.matchSide !== state.matchSide) return false;
    }

    if (state.phase !== "all" && e.phase !== state.phase) return false;

    if (state.zone !== "all") {
      const z = e.zone || "Unknown";
      if (z !== state.zone) return false;
    }

    if (state.objective !== "all") {
      const o = e.objective || "None";
      if (o !== state.objective) return false;
    }

    return true;
  });
}

function computeClusters(points, enabled, modeKey) {
  if (!enabled) return [];
  const minCount = modeKey?.startsWith("wards") ? 35 : modeKey?.startsWith("dmg") ? 45 : 60;
  if (points.length < minCount) return [];

  // clustering is O(n^2) here; keep it sane
  const pts = points.length > 2500 ? points.slice(0, 2500) : points;
  return dbscan(pts, { eps: 950, minPts: 12 }).slice(0, 6);
}

function colorForMode(modeKey) {
  if (modeKey === "deaths") return "rgba(249,115,22,0.95)"; // orange
  if (modeKey === "kills") return "rgba(16,185,129,0.95)"; // emerald
  if (modeKey === "wardsPlaced") return "rgba(59,130,246,0.95)"; // blue
  if (modeKey === "wardsKilled") return "rgba(148,163,184,0.95)"; // slate

  // dmg modes
  if (modeKey === "dmgDealt") return "rgba(139,92,246,0.95)"; // violet
  if (modeKey === "dmgTaken") return "rgba(244,63,94,0.95)"; // rose
  return "rgba(234,179,8,0.95)"; // amber (trade loss)
}

function draw(canvas, img, events, clusters, modeKey) {
  const ctx = canvas.getContext("2d");
  const size = canvas.width;

  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(img, 0, 0, size, size);

  const baseColor = colorForMode(modeKey);

  // dmg modes: scale dot size/alpha by value
  const isDmg = modeKey?.startsWith("dmg");
  let maxVal = 1;
  if (isDmg) {
    for (const e of events) maxVal = Math.max(maxVal, Number(e.value) || 0);
  }

  // points
  ctx.globalAlpha = 0.8;
  for (const e of events) {
    const p = worldToCanvas({ x: e.x, y: e.y }, size);

    let r = 3.2;
    if (isDmg) {
      const v = Math.max(0, Number(e.value) || 0);
      const t = Math.min(1, v / maxVal);
      ctx.globalAlpha = 0.25 + 0.75 * t;
      r = 2.2 + 3.8 * t;
    } else {
      ctx.globalAlpha = 0.8;
    }

    ctx.fillStyle = baseColor;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();

    // tiny dark outline
    ctx.strokeStyle = "rgba(15,23,42,0.35)";
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // clusters overlay (rings)
  for (const c of clusters) {
    const p = worldToCanvas({ x: c.cx, y: c.cy }, size);
    const r = (c.radius / 15000) * size;

    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(10, r), 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "rgba(15,23,42,0.7)";
    ctx.font = "12px Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.fillText(String(c.count), p.x + 6, p.y - 6);
  }
}

/* ---------------------------------- mount --------------------------------- */

export async function mountDeathMapCard(mountEl, timelineRows, opts = {}) {
  if (!mountEl) throw new Error("mountDeathMapCard: missing mount element");

  const title = opts.title || "Combat Map (Deaths, Kills, Wards & DMG)";
  const subtitle =
    opts.subtitle ||
    "From Timeline minute events — filter by phase/zone/objective, show clusters, and get quick readouts.";

  const roster = opts.roster || null;

  if (!timelineRows || !timelineRows.length) {
    mountEl.innerHTML = `
      <div class="card-header">
        <div>
          <div class="card-title">${esc(title)}</div>
          <div class="card-subtitle">No timeline rows found.</div>
        </div>
      </div>
    `;
    return;
  }

  // ✅ Normalize once (Match ID, Minute, positions, TeamId aliases)
  const rowsNorm = normalizeDeathMapTimelineRows(timelineRows);

  // Build once (core)
  let combat = buildCombatEvents(rowsNorm, { roster });
  let deaths = combat?.deaths || [];
  let kills = combat?.kills || [];
  let usingCombatFallback = false;

  // ✅ Fallback if core combat events fail (common after pipeline header changes)
  if (!deaths.length && !kills.length) {
    usingCombatFallback = true;
    const fb = fallbackBuildCombatEvents(rowsNorm, { roster });
    deaths = fb.deaths || [];
    kills = fb.kills || [];
  }

  const { placed: wardsPlaced, killed: wardsKilled } = buildWardEvents(rowsNorm, { roster });

  const dmg = buildDamageSpikeEvents(rowsNorm, { roster });
  const dmgDealt = dmg.dealt || [];
  const dmgTaken = dmg.taken || [];
  const dmgTradeLoss = dmg.tradeLoss || [];
  const dmgThr = dmg.thresholds || { dealt: null, taken: null, tradeLoss: null };

  // UI state
  const state = {
    mode: "deaths", // deaths | kills | wardsPlaced | wardsKilled | dmgDealt | dmgTaken | dmgTradeLoss
    scope: roster ? "roster" : "all", // roster | all
    matchSide: "all", // all | blue | red
    phase: "all", // all | Early | Mid | Late
    zone: "all",
    objective: "all",
    clusters: true,
  };

  const zonesAll = uniq(
    [...deaths, ...kills, ...wardsPlaced, ...wardsKilled, ...dmgDealt, ...dmgTaken, ...dmgTradeLoss].map((e) => e.zone || "Unknown")
  ).sort((a, b) => a.localeCompare(b));

  const mountId = `dm_${Math.random().toString(36).slice(2)}`;

  const dataPill = [
    `${deaths.length} deaths`,
    `${kills.length} kills`,
    `${wardsPlaced.length} wards+`,
    `${wardsKilled.length} wards-`,
    `${dmgDealt.length} dmg▲`,
    `${dmgTaken.length} dmg▼`,
  ].join(" · ");

  const sourceLabel = usingCombatFallback
    ? "Timeline tab (reconstructed points)"
    : "Timeline tab (raw event points)";
  const sourceSubnote = usingCombatFallback
    ? `<div class="text-[0.68rem] text-amber-700/90 mt-1">Combat points are approximated from minute kill counters + frame positions.</div>`
    : "";

  mountEl.innerHTML = `
    <div class="card-header">
      <div class="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div class="card-title">${esc(title)}</div>
          <div class="card-subtitle">${esc(subtitle)}</div>
        </div>

        <div class="flex flex-wrap gap-2 items-center">
          ${pill("Data", dataPill)}
          ${pill("Source", sourceLabel)}
        </div>
      </div>
      ${sourceSubnote}
    </div>

    <div class="px-4 pb-4">
      <div class="mt-3 flex flex-wrap gap-2 items-center">
        <select id="${mountId}_mode" class="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white">
          ${selectOption("Deaths", "deaths", true)}
          ${selectOption("Kills", "kills", false)}
          ${selectOption("Wards Placed", "wardsPlaced", false)}
          ${selectOption("Wards Killed", "wardsKilled", false)}
          ${selectOption("DMG Spikes (Dealt)", "dmgDealt", false)}
          ${selectOption("DMG Spikes (Taken)", "dmgTaken", false)}
          ${selectOption("Trade Loss Spikes", "dmgTradeLoss", false)}
        </select>

        <select id="${mountId}_scope" class="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white">
          ${selectOption("Les Nübs only", "roster", state.scope === "roster")}
          ${selectOption("All participants", "all", state.scope !== "roster")}
        </select>

        <select id="${mountId}_matchSide" class="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white">
          ${selectOption("All sides", "all", true)}
          ${selectOption("When we were Blue", "blue", false)}
          ${selectOption("When we were Red", "red", false)}
        </select>

        <select id="${mountId}_phase" class="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white">
          ${selectOption("All phases", "all", true)}
          ${selectOption("Early (0–14)", "Early", false)}
          ${selectOption("Mid (15–24)", "Mid", false)}
          ${selectOption("Late (25+)", "Late", false)}
        </select>

        <select id="${mountId}_zone" class="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white">
          ${selectOption("All zones", "all", true)}
          ${zonesAll.map((z) => selectOption(z, z, false)).join("")}
        </select>

        <select id="${mountId}_obj" class="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white">
          ${selectOption("All objectives", "all", true)}
          ${selectOption("None", "None", false)}
          ${selectOption("Dragon", "dragon", false)}
          ${selectOption("Baron", "baron", false)}
          ${selectOption("Herald", "herald", false)}
        </select>

        <label class="ml-1 inline-flex items-center gap-2 text-xs text-slate-600">
          <input id="${mountId}_clusters" type="checkbox" class="rounded" checked />
          Clusters
        </label>
      </div>

      <div class="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div class="lg:col-span-2 rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div class="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
            <div class="text-xs font-semibold text-slate-700">
              Map
              <span id="${mountId}_map_hint" class="font-normal text-slate-400 ml-2"></span>
            </div>
            <div id="${mountId}_mini_stats" class="text-[0.72rem] text-slate-500"></div>
          </div>
          <div class="p-3">
            <canvas id="${mountId}_canvas" width="520" height="520" class="w-full h-auto rounded-xl border border-slate-100"></canvas>
          </div>
        </div>

        <div class="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div class="px-4 py-2 border-b border-slate-100">
            <div class="text-xs font-semibold text-slate-700">Breakdown</div>
            <div class="text-[0.7rem] text-slate-400">This is the “what does it mean” layer.</div>
          </div>

          <div class="p-4 space-y-3">
            <div id="${mountId}_breakdown" class="space-y-2"></div>

            <div class="pt-3 border-t border-slate-100">
              <div class="text-xs font-semibold text-slate-700 mb-1">Quick tips</div>
              <div id="${mountId}_tips" class="text-[0.78rem] text-slate-600 space-y-1"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  const elMode = mountEl.querySelector(`#${mountId}_mode`);
  const elScope = mountEl.querySelector(`#${mountId}_scope`);
  const elMatchSide = mountEl.querySelector(`#${mountId}_matchSide`);
  const elPhase = mountEl.querySelector(`#${mountId}_phase`);
  const elZone = mountEl.querySelector(`#${mountId}_zone`);
  const elObj = mountEl.querySelector(`#${mountId}_obj`);
  const elClusters = mountEl.querySelector(`#${mountId}_clusters`);

  const canvas = mountEl.querySelector(`#${mountId}_canvas`);
  const hint = mountEl.querySelector(`#${mountId}_map_hint`);
  const miniStats = mountEl.querySelector(`#${mountId}_mini_stats`);
  const breakdown = mountEl.querySelector(`#${mountId}_breakdown`);
  const tipsEl = mountEl.querySelector(`#${mountId}_tips`);

  if (!canvas) throw new Error("DeathMapCard: missing canvas");

  const minimapImg = await loadMinimapImg();

  const sideLabel = (s) => (s === "blue" ? "blue" : s === "red" ? "red" : "all sides");

  const modeLabelFromKey = (k) => {
    if (k === "deaths") return "deaths";
    if (k === "kills") return "kills";
    if (k === "wardsPlaced") return "wards placed";
    if (k === "wardsKilled") return "wards killed";
    if (k === "dmgDealt") return "DMG spikes (dealt)";
    if (k === "dmgTaken") return "DMG spikes (taken)";
    return "trade loss spikes";
  };

  const dmgThresholdForMode = (k) => {
    if (k === "dmgDealt") return dmgThr.dealt;
    if (k === "dmgTaken") return dmgThr.taken;
    if (k === "dmgTradeLoss") return dmgThr.tradeLoss;
    return null;
  };

  const rerender = () => {
    let base =
      state.mode === "deaths"
        ? deaths
        : state.mode === "kills"
        ? kills
        : state.mode === "wardsPlaced"
        ? wardsPlaced
        : state.mode === "wardsKilled"
        ? wardsKilled
        : state.mode === "dmgDealt"
        ? dmgDealt
        : state.mode === "dmgTaken"
        ? dmgTaken
        : dmgTradeLoss;

    let filtered = filterEvents(base, state);

    // optional vision tagging for deaths (using wardsPlaced)
    let visionRate = null;
    if (state.mode === "deaths" && wardsPlaced.length) {
      const tagged = tagDeathsByVision(filtered, wardsPlaced, { radius: 1200, lookbackSec: 90 });
      const inVision = tagged.filter((d) => d.inVision === true).length;
      visionRate = tagged.length ? inVision / tagged.length : null;
      filtered = tagged;
    }

    const clusters = computeClusters(filtered, state.clusters, state.mode);

    draw(canvas, minimapImg, filtered, clusters, state.mode);

    const modeLabel = modeLabelFromKey(state.mode);
    const parts = [];
    parts.push(modeLabel);
    if (state.scope === "roster") parts.push("roster");
    if (state.matchSide !== "all") parts.push(`when ${sideLabel(state.matchSide)}`);
    const approxNote =
      usingCombatFallback && (state.mode === "deaths" || state.mode === "kills")
        ? " · approx positions"
        : "";
    if (hint) hint.textContent = `(${parts.join(" · ")}${approxNote})`;

    if (miniStats) miniStats.textContent = `${filtered.length} shown`;

    // === DMG breakdown ===
    if (state.mode.startsWith("dmg")) {
      const sum = summarizeDamageSpikeEvents(filtered);
      const zones = sum.zones || [];
      const objMap = new Map(sum.objectives || []);
      const nearDragon = objMap.get("dragon") || 0;
      const nearBaron = objMap.get("baron") || 0;
      const nearHerald = objMap.get("herald") || 0;

      const riverPct = sum.total ? Math.round((sum.river / sum.total) * 100) : 0;
      const thr = dmgThresholdForMode(state.mode);

      breakdown.innerHTML = `
        <div class="space-y-2">
          ${barRow("River", sum.river, sum.total)}
          ${barRow("Near Dragon", nearDragon, sum.total)}
          ${barRow("Near Baron", nearBaron, sum.total)}
          ${barRow("Near Herald", nearHerald, sum.total)}
          ${sum.top25 != null ? barRow("Top 25% spikes", sum.top25, sum.total) : ""}
          ${sum.top10 != null ? barRow("Top 10% spikes", sum.top10, sum.total) : ""}
        </div>

        <div class="pt-3 border-t border-slate-100">
          <div class="text-[0.75rem] font-semibold text-slate-700 mb-2">Top zones</div>
          <div class="space-y-2">
            ${zones.slice(0, 5).map(([z, c]) => barRow(z, c, sum.total)).join("")}
          </div>
        </div>

        <div class="pt-3 border-t border-slate-100 text-[0.72rem] text-slate-500">
          Read: ${riverPct}% river ·
          ${thr != null ? `spike threshold ≈ ≥ ${thr} dmg/min ·` : ""}
          ${sum.avg != null ? `avg ${sum.avg}` : ""}
          ${sum.p75 != null ? ` · p75 ${sum.p75}` : ""}
          ${sum.p90 != null ? ` · p90 ${sum.p90}` : ""}.
        </div>
      `;

      // DMG tips (compact, mode-aware)
      const tips = [];
      const topZone = zones?.[0]?.[0];
      const objHot = (nearDragon + nearBaron + nearHerald) / (sum.total || 1);

      if (state.mode === "dmgDealt") {
        tips.push(`These are **high damage minutes** (no kill required). Use them to find “almost won” fights and whether you converted after.`);
        if (objHot < 0.18) tips.push(`A lot of spike damage isn’t near objectives. After a winning trade, try a default convert: *plates → vision line → reset on tempo.*`);
      } else if (state.mode === "dmgTaken") {
        tips.push(`These are **minutes where you got chunked hard**. Most “game-losing” sequences start here (forced reset → lost objective).`);
        if (objHot >= 0.3) tips.push(`Big taken-spikes cluster near objectives. That often means *late setup / walking into choke*. Aim: push → reset → sweep → arrive early.`);
      } else {
        tips.push(`Trade-loss spikes = **(damage taken − damage dealt)**. This is your “bad engage / bad facecheck / bad contest” detector.`);
        tips.push(`If this clusters in one zone, write one rule like: “we don’t enter this choke without 2 wards + buddy.”`);
      }

      if (riverPct >= 30) tips.push(`A lot of this happens in **river** (${riverPct}%). Pair this view with wards to see if you’re fighting in darkness.`);
      if (topZone) tips.push(`Top zone: **${topZone}**. Pull 3 clips from there and check the *first 5 seconds* (who sees who first?).`);

      tipsEl.innerHTML = tips.length
        ? tips.slice(0, 5).map((t) => `<div>• ${t}</div>`).join("")
        : `<div class="text-slate-500">Not enough signal yet — add more games.</div>`;

      return;
    }

    // === Wards breakdown ===
    if (state.mode === "wardsPlaced" || state.mode === "wardsKilled") {
      const sum = summarizeWardEvents(filtered);
      const zones = sum.zones || [];
      const objMap = new Map(sum.objectives || []);
      const typeList = sum.wardTypes || [];

      const nearDragon = objMap.get("dragon") || 0;
      const nearBaron = objMap.get("baron") || 0;
      const nearHerald = objMap.get("herald") || 0;

      const riverPct = sum.total ? Math.round((sum.river / sum.total) * 100) : 0;

      breakdown.innerHTML = `
        <div class="space-y-2">
          ${barRow("River", sum.river, sum.total)}
          ${barRow("Near Dragon", nearDragon, sum.total)}
          ${barRow("Near Baron", nearBaron, sum.total)}
          ${barRow("Near Herald", nearHerald, sum.total)}
        </div>

        <div class="pt-3 border-t border-slate-100">
          <div class="text-[0.75rem] font-semibold text-slate-700 mb-2">Top ward types</div>
          <div class="space-y-2">
            ${typeList.slice(0, 5).map(([t, c]) => barRow(t, c, sum.total)).join("")}
          </div>
        </div>

        <div class="pt-3 border-t border-slate-100">
          <div class="text-[0.75rem] font-semibold text-slate-700 mb-2">Top zones</div>
          <div class="space-y-2">
            ${zones.slice(0, 5).map(([z, c]) => barRow(z, c, sum.total)).join("")}
          </div>
        </div>

        <div class="pt-3 border-t border-slate-100 text-[0.72rem] text-slate-500">
          Read: ${riverPct}% river coverage · ${typeList[0] ? `most common: ${esc(typeList[0][0])}` : "add more games"}.
        </div>
      `;

      const tips = [];
      if (riverPct < 22) tips.push(`River ward coverage is **low** (${riverPct}%). Try: *reset → 2 wards into river line before objective timers.*`);
      if (nearDragon + nearBaron + nearHerald < Math.max(2, Math.round(sum.total * 0.15))) {
        tips.push(`Few wards land **near major objectives**. Consider: *one in pit area + one in approach choke.*`);
      }
      const topZone = zones?.[0]?.[0];
      if (topZone) tips.push(`Top ward zone: **${topZone}**. Check if that’s intended — or autopilot spots.`);

      tipsEl.innerHTML = tips.length
        ? tips.slice(0, 5).map((t) => `<div>• ${t}</div>`).join("")
        : `<div class="text-slate-500">Not enough signal yet — add more games.</div>`;

      return;
    }

    // === Deaths/Kills breakdown ===
    const sum = summarizeEvents(filtered);
    const zones = sum.zones || [];
    const objectives = sum.objectives || [];

    const soloPct = sum.total ? Math.round((sum.solo / sum.total) * 100) : 0;
    const groupedPct = sum.total ? Math.round((sum.grouped / sum.total) * 100) : 0;
    const riverPct = sum.total ? Math.round((sum.river / sum.total) * 100) : 0;

    const objMap = new Map(objectives);
    const nearDragon = objMap.get("dragon") || 0;
    const nearBaron = objMap.get("baron") || 0;
    const nearHerald = objMap.get("herald") || 0;

    const darkCount = state.mode === "deaths" ? filtered.filter((d) => d.inVision === false).length : 0;

    breakdown.innerHTML = `
      <div class="space-y-2">
        ${barRow("Solo pick", sum.solo, sum.total)}
        ${barRow("Grouped", sum.grouped, sum.total)}
        ${barRow("River", sum.river, sum.total)}
        ${barRow("Near Dragon", nearDragon, sum.total)}
        ${barRow("Near Baron", nearBaron, sum.total)}
        ${barRow("Near Herald", nearHerald, sum.total)}
        ${state.mode === "deaths" && visionRate != null ? barRow("No ward nearby (90s)", darkCount, sum.total) : ""}
      </div>

      <div class="pt-3 border-t border-slate-100">
        <div class="text-[0.75rem] font-semibold text-slate-700 mb-2">Top zones</div>
        <div class="space-y-2">
          ${zones.slice(0, 5).map(([z, c]) => barRow(z, c, sum.total)).join("")}
        </div>
      </div>

      <div class="pt-3 border-t border-slate-100 text-[0.72rem] text-slate-500">
        Read: ${soloPct}% solo picks · ${groupedPct}% grouped · ${riverPct}% river.
      </div>
    `;

    const tipList = generateTips({
      modeLabel,
      summary: sum,
      topClusters: clusters,
      extra: visionRate != null ? { vision: visionRate } : null,
    });

    tipsEl.innerHTML = tipList.length
      ? tipList.map((t) => `<div>• ${t}</div>`).join("")
      : `<div class="text-slate-500">Not enough signal yet — add more games.</div>`;
  };

  const bind = (el, cb) => el && el.addEventListener("change", cb);

  bind(elMode, () => {
    const v = elMode.value;
    state.mode =
      v === "kills"
        ? "kills"
        : v === "wardsPlaced"
        ? "wardsPlaced"
        : v === "wardsKilled"
        ? "wardsKilled"
        : v === "dmgDealt"
        ? "dmgDealt"
        : v === "dmgTaken"
        ? "dmgTaken"
        : v === "dmgTradeLoss"
        ? "dmgTradeLoss"
        : "deaths";
    rerender();
  });

  bind(elScope, () => {
    state.scope = elScope.value === "all" ? "all" : "roster";
    rerender();
  });
  bind(elMatchSide, () => {
    state.matchSide = elMatchSide.value || "all";
    rerender();
  });
  bind(elPhase, () => {
    state.phase = elPhase.value || "all";
    rerender();
  });
  bind(elZone, () => {
    state.zone = elZone.value || "all";
    rerender();
  });
  bind(elObj, () => {
    state.objective = elObj.value || "all";
    rerender();
  });
  bind(elClusters, () => {
    state.clusters = !!elClusters.checked;
    rerender();
  });

  rerender();
}
