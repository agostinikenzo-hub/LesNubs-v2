// /core/deathMap.js
// Extracts CHAMPION_KILL + WARD events from timeline rows, enriches them with per-frame context,
// and provides clustering + summaries for a minimap module.

const MAX_COORD = 15000; // SR coords are roughly 0..15000

export const SR_OBJECTIVES = [
  { key: "dragon", label: "Dragon", x: 9850, y: 4400, r: 1800 },
  { key: "baron", label: "Baron", x: 5000, y: 10400, r: 1800 },
  { key: "herald", label: "Herald", x: 5000, y: 10400, r: 1800 },
];

function toNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function safeJson(v, fallback) {
  if (v == null) return fallback;
  if (typeof v === "object") return v; // already parsed
  const s = String(v).trim();
  if (!s) return fallback;
  try {
    return JSON.parse(s);
  } catch {
    return fallback;
  }
}

function key3(matchId, minute, pid) {
  return `${matchId}|${minute}|${pid}`;
}

function key2(matchId, minute) {
  return `${matchId}|${minute}`;
}

function dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function getEventPos(ev) {
  // Riot timeline usually provides ev.position.{x,y}
  if (ev?.position && Number.isFinite(ev.position.x) && Number.isFinite(ev.position.y)) {
    return { x: Number(ev.position.x), y: Number(ev.position.y) };
  }
  // sometimes it is ev.x / ev.y
  if (Number.isFinite(ev?.x) && Number.isFinite(ev?.y)) {
    return { x: Number(ev.x), y: Number(ev.y) };
  }
  return null;
}

function phaseFromMinute(min) {
  if (min <= 14) return "Early";
  if (min <= 24) return "Mid";
  return "Late";
}

function objectiveNear(pos) {
  if (!pos) return null;
  let best = null;
  for (const o of SR_OBJECTIVES) {
    const d = dist(pos, o);
    if (d <= o.r) {
      // pick the closest objective if multiple match
      if (!best || d < best.d) best = { key: o.key, label: o.label, d };
    }
  }
  return best ? best.key : null;
}

function sideFromTeamId(teamId) {
  if (teamId === 100) return "blue";
  if (teamId === 200) return "red";
  return null;
}

/**
 * Match-level: what side was our roster on in each match?
 * Returns Map(matchId -> { teamId, side })
 */
export function buildMatchRosterSideIndex(timelineRows = [], roster = null) {
  const out = new Map();
  const set = roster?.length ? new Set(roster) : null;
  if (!set) return out;

  for (const r of timelineRows) {
    const matchId = String(r["Match ID"] || "").trim();
    if (!matchId || out.has(matchId)) continue;

    const player = String(r["Player"] || "").trim();
    if (!player || !set.has(player)) continue;

    const teamId = toNum(r["TeamId"], NaN);
    const side = sideFromTeamId(teamId);
    if (!side) continue;

    out.set(matchId, { teamId, side });
  }

  return out;
}

/**
 * Map: matchId -> Map(participantId -> { player, role, champion, teamId })
 * Exported because it can be useful elsewhere.
 */
export function buildParticipantIndex(timelineRows = []) {
  const byMatch = new Map();

  for (const r of timelineRows) {
    const matchId = String(r["Match ID"] || "").trim();
    const pid = toNum(r["pf.participantId"], NaN);
    if (!matchId || !Number.isFinite(pid)) continue;

    if (!byMatch.has(matchId)) byMatch.set(matchId, new Map());
    const m = byMatch.get(matchId);

    if (!m.has(pid)) {
      m.set(pid, {
        player: String(r["Player"] || "").trim() || null,
        role: String(r["Role"] || r["ROLE"] || "").trim() || null,
        champion: String(r["Champion"] || "").trim() || null,
        teamId: toNum(r["TeamId"], NaN),
      });
    }
  }

  return byMatch;
}

/**
 * Map: `${matchId}|${minute}|${pid}` -> context row fields we care about
 * Includes position x/y so WARD_PLACED can fall back when event has no position.
 * Includes cumulative damage stats so we can compute "damage spikes" via deltas.
 */
export function buildFrameIndex(timelineRows = []) {
  const idx = new Map();

  for (const r of timelineRows) {
    const matchId = String(r["Match ID"] || "").trim();
    const minute = toNum(r["Minute"], NaN);
    const pid = toNum(r["pf.participantId"], NaN);
    if (!matchId || !Number.isFinite(minute) || !Number.isFinite(pid)) continue;

    // ✅ positions: support both pf.position.* and PosX/PosY columns
    const x = toNum(r["pf.position.x"] ?? r["PosX"], NaN);
    const y = toNum(r["pf.position.y"] ?? r["PosY"], NaN);

    // ✅ cumulative damage stats (used for per-minute deltas)
    const dmgDoneToChamps = toNum(
      r["pf.damageStats.totalDamageDoneToChampions"] ??
        r["pf.damageStats.totalDamageDoneToChampions".toString()],
      NaN
    );
    const dmgTaken = toNum(r["pf.damageStats.totalDamageTaken"], NaN);

    idx.set(key3(matchId, minute, pid), {
      matchId,
      minute,
      pid,

      player: String(r["Player"] || "").trim() || null,
      role: String(r["Role"] || "").trim() || null,
      champion: String(r["Champion"] || "").trim() || null,
      teamId: toNum(r["TeamId"], NaN), // ✅ for side logic

      // ✅ for ward fallback / dmg spike map points
      x: Number.isFinite(x) ? x : null,
      y: Number.isFinite(y) ? y : null,

      // ✅ damage stats (cumulative)
      dmgDoneToChamps: Number.isFinite(dmgDoneToChamps) ? dmgDoneToChamps : null,
      dmgTaken: Number.isFinite(dmgTaken) ? dmgTaken : null,

      zone: String(r["Zone"] || "").trim() || null,
      inRiver: toNum(r["In River"], 0) === 1,
      inTop: toNum(r["In Top Side"], 0) === 1,
      inBot: toNum(r["In Bot Side"], 0) === 1,
      inMidInner: toNum(r["In Mid/Inner"], 0) === 1,

      closeTeammates: toNum(r["Close Teammates"], 0),
      isGrouped: toNum(r["Is Grouped"], 0) === 1,

      goldDiffTeam: toNum(r["Gold Diff (Team)"], 0),
      xpDiffTeam: toNum(r["XP Diff (Team)"], 0),
    });
  }

  return idx;
}

/**
 * Dedupe minute events (they're repeated in each player row).
 * Returns: array of { matchId, minute, events: [] }
 */
export function extractMinuteEvents(timelineRows = []) {
  const seen = new Set();
  const out = [];

  for (const r of timelineRows) {
    const matchId = String(r["Match ID"] || "").trim();
    const minute = toNum(r["Minute"], NaN);
    if (!matchId || !Number.isFinite(minute)) continue;

    const k = key2(matchId, minute);
    if (seen.has(k)) continue;
    seen.add(k);

    const events = safeJson(r["Minute Events Raw JSON"], []);
    out.push({ matchId, minute, events: Array.isArray(events) ? events : [] });
  }

  return out;
}

/**
 * Extract CHAMPION_KILL events
 * Returns: array of { matchId, minute, ev }
 */
export function extractChampionKillEvents(timelineRows = []) {
  const mins = extractMinuteEvents(timelineRows);
  const out = [];

  for (const m of mins) {
    for (const ev of m.events) {
      if (!ev || ev.type !== "CHAMPION_KILL") continue;
      out.push({ matchId: m.matchId, minute: m.minute, ev });
    }
  }

  return out;
}

/**
 * Build enriched combat events (deaths + kills).
 * - deaths: one per victim
 * - kills: one per killer
 */
export function buildCombatEvents(timelineRows = [], { roster = null } = {}) {
  const pIndex = buildParticipantIndex(timelineRows);
  const fIndex = buildFrameIndex(timelineRows);

  // ✅ match-side index (our roster's side per match)
  const rosterSideByMatch = buildMatchRosterSideIndex(timelineRows, roster);

  const killEvents = extractChampionKillEvents(timelineRows);

  const deaths = [];
  const kills = [];

  for (const k of killEvents) {
    const { matchId, minute, ev } = k;

    const pos = getEventPos(ev);
    if (!pos) continue;

    const ts = toNum(ev.timestamp, minute * 60000);
    const phase = phaseFromMinute(minute);
    const objNear = objectiveNear(pos);

    const victimId = toNum(ev.victimId, NaN);
    const killerId = toNum(ev.killerId, NaN);
    const assists = Array.isArray(ev.assistingParticipantIds) ? ev.assistingParticipantIds.map(Number) : [];

    const matchPidMap = pIndex.get(matchId) || new Map();
    const victimMeta = Number.isFinite(victimId) ? matchPidMap.get(victimId) : null;
    const killerMeta = Number.isFinite(killerId) ? matchPidMap.get(killerId) : null;

    const victimFrame = Number.isFinite(victimId) ? fIndex.get(key3(matchId, minute, victimId)) : null;
    const killerFrame = Number.isFinite(killerId) ? fIndex.get(key3(matchId, minute, killerId)) : null;

    const victimName = victimFrame?.player || victimMeta?.player || null;
    const killerName = killerFrame?.player || killerMeta?.player || null;

    const victimIsRoster = roster && victimName ? roster.includes(victimName) : false;
    const killerIsRoster = roster && killerName ? roster.includes(killerName) : false;

    // ✅ match side (when our roster was blue/red in this match)
    const matchSide = rosterSideByMatch.get(matchId)?.side || null;

    // teamId + side for victim/killer
    const victimTeamId = toNum(victimFrame?.teamId ?? victimMeta?.teamId, NaN);
    const killerTeamId = toNum(killerFrame?.teamId ?? killerMeta?.teamId, NaN);
    const victimSide = sideFromTeamId(victimTeamId);
    const killerSide = sideFromTeamId(killerTeamId);

    // Solo pick heuristic
    const soloPick =
      victimFrame
        ? !victimFrame.isGrouped && (victimFrame.closeTeammates || 0) <= 0
        : assists.length === 0; // fallback

    const groupedFight =
      victimFrame
        ? victimFrame.isGrouped || (victimFrame.closeTeammates || 0) >= 2
        : assists.length >= 2;

    const behind = victimFrame ? victimFrame.goldDiffTeam < 0 : null;

    deaths.push({
      kind: "death",
      matchId,
      minute,
      timestamp: ts,
      phase,
      x: pos.x,
      y: pos.y,
      objective: objNear,

      // ✅ side labels
      matchSide,
      teamId: Number.isFinite(victimTeamId) ? victimTeamId : null,
      teamSide: victimSide,

      victimId,
      killerId,
      assists,

      player: victimName,
      role: victimFrame?.role || victimMeta?.role || null,
      champion: victimFrame?.champion || victimMeta?.champion || null,
      isRoster: victimIsRoster,

      zone: victimFrame?.zone || null,
      inRiver: victimFrame?.inRiver ?? null,
      closeTeammates: victimFrame?.closeTeammates ?? null,
      isGrouped: victimFrame?.isGrouped ?? null,
      goldDiffTeam: victimFrame?.goldDiffTeam ?? null,
      xpDiffTeam: victimFrame?.xpDiffTeam ?? null,

      soloPick,
      groupedFight,
      behind,
    });

    // kills: attribute to killer (if killer exists)
    if (Number.isFinite(killerId)) {
      const killerSolo =
        killerFrame
          ? !killerFrame.isGrouped && (killerFrame.closeTeammates || 0) <= 0
          : assists.length === 0;

      kills.push({
        kind: "kill",
        matchId,
        minute,
        timestamp: ts,
        phase,
        x: pos.x,
        y: pos.y,
        objective: objNear,

        // ✅ side labels
        matchSide,
        teamId: Number.isFinite(killerTeamId) ? killerTeamId : null,
        teamSide: killerSide,

        killerId,
        victimId,
        assists,

        player: killerName,
        role: killerFrame?.role || killerMeta?.role || null,
        champion: killerFrame?.champion || killerMeta?.champion || null,
        isRoster: killerIsRoster,

        zone: killerFrame?.zone || null,
        inRiver: killerFrame?.inRiver ?? null,
        closeTeammates: killerFrame?.closeTeammates ?? null,
        isGrouped: killerFrame?.isGrouped ?? null,
        goldDiffTeam: killerFrame?.goldDiffTeam ?? null,
        xpDiffTeam: killerFrame?.xpDiffTeam ?? null,

        soloPick: killerSolo,
        groupedFight: assists.length >= 2 || (killerFrame?.isGrouped ?? false),
      });
    }
  }

  return { deaths, kills };
}

/**
 * Build ward events from minute events.
 * - placed: WARD_PLACED (creatorId)
 * - killed: WARD_KILL (killerId)
 *
 * NOTE: WARD_PLACED often has no position; we fall back to the creator's frame position (x/y).
 */
export function buildWardEvents(timelineRows = [], { roster = null } = {}) {
  const pIndex = buildParticipantIndex(timelineRows);
  const fIndex = buildFrameIndex(timelineRows);
  const mins = extractMinuteEvents(timelineRows);

  const rosterSideByMatch = buildMatchRosterSideIndex(timelineRows, roster);

  const placed = [];
  const killed = [];

  for (const m of mins) {
    const matchId = m.matchId;
    const minute = m.minute;
    const matchSide = rosterSideByMatch.get(matchId)?.side || null;

    for (const ev of m.events) {
      if (!ev) continue;

      const isPlace = ev.type === "WARD_PLACED";
      const isKill = ev.type === "WARD_KILL";
      if (!isPlace && !isKill) continue;

      const pid = toNum(isPlace ? ev.creatorId : ev.killerId, NaN);
      if (!Number.isFinite(pid)) continue;

      const frame = fIndex.get(key3(matchId, minute, pid));
      const meta = (pIndex.get(matchId) || new Map()).get(pid);

      // position: event position if present, else fallback to frame position
      const pos =
        getEventPos(ev) ||
        (frame?.x != null && frame?.y != null ? { x: frame.x, y: frame.y } : null);

      if (!pos) continue;

      const player = frame?.player || meta?.player || null;
      const isRoster = roster && player ? roster.includes(player) : false;

      const teamId = toNum(frame?.teamId ?? meta?.teamId, NaN);
      const teamSide = sideFromTeamId(teamId);

      const base = {
        kind: isPlace ? "ward_place" : "ward_kill",
        matchId,
        minute,
        timestamp: toNum(ev.timestamp, minute * 60000),
        phase: phaseFromMinute(minute),

        x: pos.x,
        y: pos.y,
        objective: objectiveNear(pos),

        // side labels
        matchSide,
        teamId: Number.isFinite(teamId) ? teamId : null,
        teamSide,

        player,
        role: frame?.role || meta?.role || null,
        champion: frame?.champion || meta?.champion || null,
        isRoster,

        zone: frame?.zone || null,
        inRiver: frame?.inRiver ?? null,
        closeTeammates: frame?.closeTeammates ?? null,
        isGrouped: frame?.isGrouped ?? null,

        wardType: String(ev.wardType || "Unknown"),
      };

      if (isPlace) placed.push(base);
      else killed.push(base);
    }
  }

  return { placed, killed };
}

/**
 * Tag deaths with a simple "in allied vision" heuristic:
 * if an allied ward was placed within radius during the last lookbackSec seconds.
 */
export function tagDeathsByVision(
  deaths = [],
  wardsPlaced = [],
  { radius = 1200, lookbackSec = 90 } = {}
) {
  const r2 = radius * radius;

  const byMatch = new Map();
  for (const w of wardsPlaced) {
    if (!w?.matchId || w?.timestamp == null || w?.x == null || w?.y == null) continue;
    if (!byMatch.has(w.matchId)) byMatch.set(w.matchId, []);
    byMatch.get(w.matchId).push(w);
  }
  for (const arr of byMatch.values()) arr.sort((a, b) => a.timestamp - b.timestamp);

  const lookbackMs = lookbackSec * 1000;

  return deaths.map((d) => {
    const wards = byMatch.get(d.matchId) || [];
    const t0 = d.timestamp - lookbackMs;
    const t1 = d.timestamp;

    let hasWard = false;

    for (const w of wards) {
      if (w.timestamp < t0) continue;
      if (w.timestamp > t1) break;

      // allied only, if we know team ids
      if (d.teamId != null && w.teamId != null && d.teamId !== w.teamId) continue;

      const dx = d.x - w.x;
      const dy = d.y - w.y;
      if (dx * dx + dy * dy <= r2) {
        hasWard = true;
        break;
      }
    }

    return { ...d, inVision: hasWard };
  });
}

/* ===========================
   DMG SPIKES (per-minute deltas)
   =========================== */

function quantile(values, p) {
  const arr = (values || []).filter(Number.isFinite).slice().sort((a, b) => a - b);
  if (!arr.length) return null;
  const idx = (arr.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return arr[lo];
  const w = idx - lo;
  return arr[lo] * (1 - w) + arr[hi] * w;
}

function mean(values) {
  const arr = (values || []).filter(Number.isFinite);
  if (!arr.length) return null;
  let s = 0;
  for (const v of arr) s += v;
  return s / arr.length;
}

function computeSpikeThreshold(values, { min = 200 } = {}) {
  const n = values.length;
  if (!n) return min;
  // adaptive: smaller sample => higher percentile, large sample => ~top 15%
  const p = n < 25 ? 0.9 : n < 60 ? 0.85 : 0.85;
  const q = quantile(values, p);
  return Math.max(min, Math.round(q || min));
}

/**
 * Build "damage spike" events from cumulative per-frame stats.
 *
 * We use deltas of:
 * - dmgDoneToChamps: pf.damageStats.totalDamageDoneToChampions
 * - dmgTaken: pf.damageStats.totalDamageTaken
 *
 * Spikes are minutes where per-minute delta >= adaptive threshold (≈ top 15%).
 *
 * Returns:
 * {
 *   dealt: [...],        // big dmg dealt to champs per minute
 *   taken: [...],        // big dmg taken per minute
 *   tradeLoss: [...],    // (taken - dealt) per minute spikes
 *   thresholds: { dealt, taken, tradeLoss }
 * }
 */
export function buildDamageSpikeEvents(timelineRows = [], { roster = null } = {}) {
  const pIndex = buildParticipantIndex(timelineRows);
  const fIndex = buildFrameIndex(timelineRows);
  const rosterSideByMatch = buildMatchRosterSideIndex(timelineRows, roster);

  const rosterSet = roster?.length ? new Set(roster) : null;

  // group frames by match|pid
  const byMP = new Map();
  for (const fr of fIndex.values()) {
    if (!fr?.matchId || !Number.isFinite(fr.minute) || !Number.isFinite(fr.pid)) continue;
    const k = `${fr.matchId}|${fr.pid}`;
    if (!byMP.has(k)) byMP.set(k, []);
    byMP.get(k).push(fr);
  }

  // First pass: gather per-minute deltas (candidates)
  const cand = [];
  const dealtVals = [];
  const takenVals = [];
  const tradeVals = [];

  for (const frames of byMP.values()) {
    frames.sort((a, b) => a.minute - b.minute);
    for (let i = 1; i < frames.length; i++) {
      const prev = frames[i - 1];
      const cur = frames[i];
      const gap = cur.minute - prev.minute;
      if (!Number.isFinite(gap) || gap <= 0) continue;

      const dealt0 = prev.dmgDoneToChamps;
      const dealt1 = cur.dmgDoneToChamps;
      const taken0 = prev.dmgTaken;
      const taken1 = cur.dmgTaken;

      const hasDealt = Number.isFinite(dealt0) && Number.isFinite(dealt1);
      const hasTaken = Number.isFinite(taken0) && Number.isFinite(taken1);

      const dDealt = hasDealt ? dealt1 - dealt0 : null;
      const dTaken = hasTaken ? taken1 - taken0 : null;

      // ignore bad cumulative resets / noise
      const perMinDealt = dDealt != null && dDealt > 0 ? dDealt / gap : null;
      const perMinTaken = dTaken != null && dTaken > 0 ? dTaken / gap : null;

      // If neither is present, nothing to do
      if (perMinDealt == null && perMinTaken == null) continue;

      const tradeLoss = perMinTaken != null && perMinDealt != null ? perMinTaken - perMinDealt : null;

      if (Number.isFinite(perMinDealt)) dealtVals.push(perMinDealt);
      if (Number.isFinite(perMinTaken)) takenVals.push(perMinTaken);
      if (Number.isFinite(tradeLoss)) tradeVals.push(tradeLoss);

      cand.push({
        matchId: cur.matchId,
        minute: cur.minute,
        pid: cur.pid,
        frame: cur,
        metaPrev: prev,
        perMinDealt,
        perMinTaken,
        tradeLoss,
      });
    }
  }

  const thrDealt = computeSpikeThreshold(dealtVals, { min: 220 });
  const thrTaken = computeSpikeThreshold(takenVals, { min: 220 });
  const thrTrade = computeSpikeThreshold(tradeVals.filter((v) => v > 0), { min: 160 });

  const dealt = [];
  const taken = [];
  const tradeLossSpikes = [];

  for (const c of cand) {
    const fr = c.frame;
    if (fr?.x == null || fr?.y == null) continue;

    const matchSide = rosterSideByMatch.get(c.matchId)?.side || null;
    const teamId = toNum(fr.teamId, NaN);
    const teamSide = sideFromTeamId(teamId);

    const meta = (pIndex.get(c.matchId) || new Map()).get(c.pid);
    const player = fr.player || meta?.player || null;
    const isRoster = rosterSet && player ? rosterSet.has(player) : false;

    const base = {
      matchId: c.matchId,
      minute: c.minute,
      timestamp: c.minute * 60000,
      phase: phaseFromMinute(c.minute),

      x: fr.x,
      y: fr.y,
      objective: objectiveNear({ x: fr.x, y: fr.y }),

      matchSide,
      teamId: Number.isFinite(teamId) ? teamId : null,
      teamSide,

      player,
      role: fr.role || meta?.role || null,
      champion: fr.champion || meta?.champion || null,
      isRoster,

      zone: fr.zone || null,
      inRiver: fr.inRiver ?? null,
      closeTeammates: fr.closeTeammates ?? null,
      isGrouped: fr.isGrouped ?? null,

      goldDiffTeam: fr.goldDiffTeam ?? null,
      xpDiffTeam: fr.xpDiffTeam ?? null,
    };

    if (Number.isFinite(c.perMinDealt) && c.perMinDealt >= thrDealt) {
      dealt.push({
        ...base,
        kind: "dmg_dealt_spike",
        value: Math.round(c.perMinDealt),
      });
    }

    if (Number.isFinite(c.perMinTaken) && c.perMinTaken >= thrTaken) {
      taken.push({
        ...base,
        kind: "dmg_taken_spike",
        value: Math.round(c.perMinTaken),
      });
    }

    if (Number.isFinite(c.tradeLoss) && c.tradeLoss >= thrTrade) {
      tradeLossSpikes.push({
        ...base,
        kind: "dmg_trade_loss_spike",
        value: Math.round(c.tradeLoss),
      });
    }
  }

  // gentle cap for performance sanity (clustering is O(n^2))
  const cap = (arr, max = 2500) =>
    arr.length > max ? arr.slice().sort((a, b) => (b.value || 0) - (a.value || 0)).slice(0, max) : arr;

  return {
    dealt: cap(dealt, 2500),
    taken: cap(taken, 2500),
    tradeLoss: cap(tradeLossSpikes, 2500),
    thresholds: { dealt: thrDealt, taken: thrTaken, tradeLoss: thrTrade },
  };
}

export function summarizeDamageSpikeEvents(events = []) {
  const total = events.length || 1;

  const zones = topN(countBy(events, (e) => e.zone || "Unknown"), 6);
  const phases = topN(countBy(events, (e) => e.phase || "Unknown"), 3);
  const objectives = topN(countBy(events, (e) => e.objective || "None"), 4);

  const river = events.filter((e) => e.inRiver === true || e.zone === "River").length;

  const vals = events.map((e) => Number(e.value)).filter(Number.isFinite);
  const avg = mean(vals);
  const p75 = quantile(vals, 0.75);
  const p90 = quantile(vals, 0.9);

  const top25 = p75 != null ? events.filter((e) => (e.value || 0) >= p75).length : null;
  const top10 = p90 != null ? events.filter((e) => (e.value || 0) >= p90).length : null;

  return {
    total,
    zones,
    phases,
    objectives,
    river,
    avg: avg != null ? Math.round(avg) : null,
    p75: p75 != null ? Math.round(p75) : null,
    p90: p90 != null ? Math.round(p90) : null,
    top25,
    top10,
  };
}

/**
 * Simple DBSCAN for 2D points.
 * points: [{x,y, ...}]
 * returns: clusters [{ id, count, cx, cy, radius, indices }]
 */
export function dbscan(points = [], { eps = 950, minPts = 12 } = {}) {
  const n = points.length;
  if (!n) return [];

  const visited = new Array(n).fill(false);
  const assigned = new Array(n).fill(false);
  const clusters = [];

  const regionQuery = (i) => {
    const out = [];
    const pi = points[i];
    for (let j = 0; j < n; j++) {
      const pj = points[j];
      const dx = pi.x - pj.x;
      const dy = pi.y - pj.y;
      if (dx * dx + dy * dy <= eps * eps) out.push(j);
    }
    return out;
  };

  const expandCluster = (seedIdx, neighbors, clusterIdx) => {
    const indices = [];
    const queue = neighbors.slice();

    assigned[seedIdx] = true;
    indices.push(seedIdx);

    while (queue.length) {
      const j = queue.shift();
      if (!visited[j]) {
        visited[j] = true;
        const n2 = regionQuery(j);
        if (n2.length >= minPts) queue.push(...n2);
      }
      if (!assigned[j]) {
        assigned[j] = true;
        indices.push(j);
      }
    }

    // centroid + radius
    let sx = 0,
      sy = 0;
    for (const idx of indices) {
      sx += points[idx].x;
      sy += points[idx].y;
    }
    const cx = sx / indices.length;
    const cy = sy / indices.length;

    let r = 0;
    for (const idx of indices) {
      const dx = points[idx].x - cx;
      const dy = points[idx].y - cy;
      r = Math.max(r, Math.sqrt(dx * dx + dy * dy));
    }

    clusters.push({
      id: clusterIdx,
      count: indices.length,
      cx,
      cy,
      radius: r,
      indices,
    });
  };

  let clusterIdx = 0;

  for (let i = 0; i < n; i++) {
    if (visited[i]) continue;
    visited[i] = true;

    const neighbors = regionQuery(i);
    if (neighbors.length < minPts) continue; // noise
    expandCluster(i, neighbors, clusterIdx++);
  }

  clusters.sort((a, b) => b.count - a.count);
  return clusters;
}

function countBy(arr, keyFn) {
  const m = new Map();
  for (const x of arr) {
    const k = keyFn(x);
    if (!k) continue;
    m.set(k, (m.get(k) || 0) + 1);
  }
  return m;
}

function topN(map, n = 5) {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

export function summarizeEvents(events = []) {
  const total = events.length || 1;

  const zones = topN(countBy(events, (e) => e.zone || "Unknown"), 6);
  const phases = topN(countBy(events, (e) => e.phase || "Unknown"), 3);
  const objectives = topN(countBy(events, (e) => e.objective || "None"), 4);

  const solo = events.filter((e) => e.soloPick).length;
  const grouped = events.filter((e) => e.groupedFight).length;
  const river = events.filter((e) => e.inRiver === true || e.zone === "River").length;

  const behindKnown = events.filter((e) => typeof e.behind === "boolean");
  const behind = behindKnown.filter((e) => e.behind).length;

  return {
    total,
    zones,
    phases,
    objectives,
    solo,
    grouped,
    river,
    behind: behindKnown.length ? behind : null,
    behindDenom: behindKnown.length || null,
  };
}

export function summarizeWardEvents(events = []) {
  const total = events.length || 1;

  const zones = topN(countBy(events, (e) => e.zone || "Unknown"), 6);
  const phases = topN(countBy(events, (e) => e.phase || "Unknown"), 3);
  const objectives = topN(countBy(events, (e) => e.objective || "None"), 4);
  const wardTypes = topN(countBy(events, (e) => e.wardType || "Unknown"), 6);

  const river = events.filter((e) => e.inRiver === true || e.zone === "River").length;

  return { total, zones, phases, objectives, wardTypes, river };
}

export function generateTips({ modeLabel, summary, topClusters = [], extra = null }) {
  const tips = [];
  const total = summary.total || 1;

  // Optional extra hook (e.g., vision/darkness rates)
  if (extra?.vision != null) {
    const pct = Math.round(extra.vision * 100);
    tips.push(`Vision check: **${pct}%** of these happened with an allied ward nearby (last 90s, ~1200u).`);
  }

  const soloPct = Math.round((summary.solo / total) * 100);
  const groupedPct = Math.round((summary.grouped / total) * 100);
  const riverPct = Math.round((summary.river / total) * 100);

  if (Number.isFinite(soloPct) && soloPct >= 35) {
    tips.push(
      `A lot of your ${modeLabel} look like **solo picks** (${soloPct}%). Tighten "alone time": no river/vision facecheck without a buddy, especially on reset windows.`
    );
  }
  if (Number.isFinite(riverPct) && riverPct >= 30) {
    tips.push(
      `High concentration in **river** (${riverPct}%). Add a rule: *river entry = ward + sweep + buddy*. If you can't do all three, don't walk in.`
    );
  }
  if (summary.behindDenom && summary.behind != null) {
    const behindPct = Math.round((summary.behind / summary.behindDenom) * 100);
    if (behindPct >= 60) {
      tips.push(
        `Most of these happen **while behind** (${behindPct}%). Prioritize "stop the bleeding": trade waves, give the objective if setup is late, and defend vision lines instead of contesting blind.`
      );
    }
  }

  const topZone = summary.zones?.[0]?.[0];
  const topZoneCount = summary.zones?.[0]?.[1] || 0;
  if (topZone && topZoneCount) {
    const zPct = Math.round((topZoneCount / total) * 100);
    tips.push(
      `Top zone: **${topZone}** (${zPct}%). Watch 3–5 clips from that zone and write a single rule (e.g. "don’t cross this choke without mid prio").`
    );
  }

  const c0 = topClusters?.[0];
  if (c0 && c0.count >= 25) {
    const nearObj = objectiveNear({ x: c0.cx, y: c0.cy });
    if (nearObj === "dragon")
      tips.push(
        `Biggest hotspot is **near Dragon**. That usually means late setup / no river control. Aim for: push → reset → sweep → arrive 45–60s early.`
      );
    else if (nearObj === "baron" || nearObj === "herald")
      tips.push(
        `Biggest hotspot is **near Baron/Herald**. Add a discipline rule: never show on side + walk into top river alone when Nash is up.`
      );
    else
      tips.push(
        `Biggest hotspot is not objective-pit — likely a repeatable choke/rotation mistake. Put a ward line *one screen earlier* and track who is arriving late.`
      );
  }

  return tips.slice(0, 5);
}

export function worldToCanvas(pos, size) {
  // origin in Riot coords is bottom-left, canvas is top-left
  const x = (pos.x / MAX_COORD) * size;
  const y = size - (pos.y / MAX_COORD) * size;
  return { x, y };
}
