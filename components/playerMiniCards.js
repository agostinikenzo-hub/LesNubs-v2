// /components/playerMiniCards.js
import { championSquareUrl } from "../core/ddragon.js";

// Build noise URLs (assets/noise/001.png ... 008.png)
const NOISE_URLS = Array.from({ length: 8 }, (_, i) => {
  const n = String(i + 1).padStart(3, "0");
  return new URL(`../assets/noise/${n}.png`, import.meta.url).href;
});

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function num(v) {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function boolish(v) {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "y";
}

function normalizeRole(role) {
  const r = String(role ?? "").trim().toUpperCase();
  if (!r) return "UNKNOWN";
  if (r.includes("TOP")) return "TOP";
  if (r.includes("JUNG")) return "JNG";
  if (r.includes("MID")) return "MID";
  if (r.includes("BOT") || r.includes("BOTTOM") || r.includes("ADC")) return "ADC";
  if (r.includes("SUP") || r.includes("UTIL")) return "SUP";
  return r;
}

// Deterministic "random" (stable) index from a string
function hashIndex(str, modulo) {
  let h = 2166136261;
  const s = String(str ?? "");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return modulo ? (h >>> 0) % modulo : 0;
}

function seedFromString(str) {
  // 0..1 float (for tint variation)
  const idx = hashIndex(str, 10000);
  return idx / 9999;
}

function noiseForPlayer(name) {
  if (!NOISE_URLS.length) return "";
  return NOISE_URLS[hashIndex(name, NOISE_URLS.length)];
}

function injectMiniCardBitsOnce() {
  if (document.getElementById("s26-solo-mini-style")) return;

  const style = document.createElement("style");
  style.id = "s26-solo-mini-style";
  style.textContent = `
    body.s26 .s26-dot{
      width:14px;height:14px;border-radius:9999px;
      border:1px solid rgba(148,163,184,0.55);
      background:var(--dot-empty,#e2e8f0);
      box-shadow:inset 0 1px 0 rgba(255,255,255,0.65);
      flex:0 0 auto;
    }
    body.s26 .s26-dot.win{ background:var(--dot-win,#10b981); border-color:rgba(16,185,129,0.55); }
    body.s26 .s26-dot.loss{ background:var(--dot-loss,#fb7185); border-color:rgba(251,113,133,0.55); }
    body.s26 .s26-dot.latest{ outline:3px solid var(--dot-ring,#ff8000); outline-offset:2px; }

    body.s26 .mk-chip{
      display:inline-flex;align-items:center;gap:6px;
      padding:5px 9px;border-radius:9999px;
      border:1px solid rgba(226,232,240,0.9);
      background:rgba(255,255,255,0.75);
      font-size:0.72rem;font-weight:800;color:#0f172a;line-height:1;
    }
    body.s26 .mk-chip .k{
      font-size:0.62rem;font-weight:900;color:rgba(100,116,139,0.95);
      letter-spacing:0.06em;
    }
  `;
  document.head.appendChild(style);
}

function buildPlayers(rows) {
  const byPlayer = new Map();

  for (const r of rows) {
    const raw = r?._raw ?? r;

    const name = String(r.player ?? raw["p.riotIdGameName"] ?? raw["Player"] ?? "").trim();
    if (!name) continue;

    const matchId = String(r.matchId ?? raw["Match ID"] ?? raw["MatchID"] ?? "").trim();
    const champ = String(r.champion ?? raw["Champion"] ?? raw["p.championName"] ?? "").trim();
    const role = normalizeRole(r.role ?? raw["ROLE"] ?? raw["p.teamPosition"] ?? raw["p.individualPosition"]);

    // IMPORTANT: stable per-game key (prevents double counting)
    const key = matchId || `${name}|${String(r.date ?? raw["Date"] ?? "")}|${champ}|${role}`;

    if (!byPlayer.has(name)) {
      byPlayer.set(name, {
        name,
        gameMap: new Map(), // key -> per-game stats
        champs: new Map(),
        roles: new Map(),
      });
    }

    const p = byPlayer.get(name);

    // Only count a match once per player
    if (p.gameMap.has(key)) continue;

    const kills = num(r.kills ?? raw["Kills"] ?? raw["p.kills"]);
    const deaths = num(r.deaths ?? raw["Deaths"] ?? raw["p.deaths"]);
    const assists = num(r.assists ?? raw["Assists"] ?? raw["p.assists"]);
    const vision = num(r.visionScore ?? raw["Vision Score"] ?? raw["p.visionScore"] ?? raw["p.visionScorePerMinute"]);
    const enemyMissingPings = num(r.enemyMissingPings ?? raw["p.enemyMissingPings"] ?? raw["enemyMissingPings"]);

    const winVal = r.win ?? raw["p.win"] ?? raw["Result"];
    const win =
      typeof winVal === "boolean"
        ? winVal
        : String(winVal ?? "").toLowerCase().trim() === "win"
          ? true
          : String(winVal ?? "").toLowerCase().trim() === "loss"
            ? false
            : boolish(winVal);

    const fbk = boolish(r.firstBloodKill ?? raw["p.firstBloodKill"]);
    const fba = boolish(r.firstBloodAssist ?? raw["p.firstBloodAssist"]);

    // ✅ Prefer explicit kill counts (best), fallback to largestMultiKill (coarse)
    const doubleKills = num(r.doubleKills ?? raw["p.doubleKills"] ?? raw["doubleKills"]);
    const tripleKills = num(r.tripleKills ?? raw["p.tripleKills"] ?? raw["tripleKills"]);
    const quadraKills = num(r.quadraKills ?? raw["p.quadraKills"] ?? raw["quadraKills"]);
    const pentaKills  = num(r.pentaKills  ?? raw["p.pentaKills"]  ?? raw["pentaKills"]);

    const largestMultiKill = num(
      r.largestMultiKill ??
      raw["p.largestMultiKill"] ??
      raw["largestMultiKill"]
    );

    p.gameMap.set(key, {
      date: r.date instanceof Date ? r.date : null,
      win,
      champ,
      role,
      kills,
      deaths,
      assists,
      vision,
      fbk,
      fba,
      // multi kill sources
      doubleKills,
      tripleKills,
      quadraKills,
      pentaKills,
      largestMultiKill,
      enemyMissingPings,
    });

    if (role && role !== "UNKNOWN") p.roles.set(role, (p.roles.get(role) || 0) + 1);
    if (champ) p.champs.set(champ, (p.champs.get(champ) || 0) + 1);
  }

  const out = [...byPlayer.values()].map((p) => {
    const gamesArr = [...p.gameMap.values()].sort((a, b) => {
      const ta = a.date ? a.date.getTime() : 0;
      const tb = b.date ? b.date.getTime() : 0;
      return ta - tb;
    });

    const games = gamesArr.length;
    const wins = gamesArr.filter((g) => g.win === true).length;
    const wr = games ? (wins / games) * 100 : 0;

    // totals (from per-game entries)
    const kills = gamesArr.reduce((s, g) => s + num(g.kills), 0);
    const deaths = gamesArr.reduce((s, g) => s + num(g.deaths), 0);
    const assists = gamesArr.reduce((s, g) => s + num(g.assists), 0);
    const kda = (kills + assists) / Math.max(1, deaths);

    // multikills (best-effort)
    const mk = { d: 0, t: 0, q: 0, p: 0 };
    for (const g of gamesArr) {
      const d = num(g.doubleKills);
      const t = num(g.tripleKills);
      const q = num(g.quadraKills);
      const pz = num(g.pentaKills);

      // Prefer real counts if any exist in that match
      if (d || t || q || pz) {
        mk.d += d;
        mk.t += t;
        mk.q += q;
        mk.p += pz;
        continue;
      }

      // Fallback: classify by largestMultiKill (only 0/1 per match)
      const v = num(g.largestMultiKill);
      if (v === 2) mk.d += 1;
      else if (v === 3) mk.t += 1;
      else if (v === 4) mk.q += 1;
      else if (v >= 5) mk.p += 1;
    }

    const enemyMissingPings = gamesArr.reduce((s, g) => s + num(g.enemyMissingPings), 0);

    const topChamps = [...p.champs.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([champ, count]) => ({ champ, count }));

    const topRoles = [...p.roles.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([role, count]) => ({ role, count, share: games ? (count / games) * 100 : 0 }));

    const last10 = gamesArr.slice(-10);
    const last10Dots = last10.map((g) => (g.win === true ? "win" : g.win === false ? "loss" : "empty"));

    return {
      name: p.name,
      games,
      wins,
      wr,
      kills,
      deaths,
      assists,
      kda,
      multikills: mk,
      enemyMissingPings,
      topChamps,
      topRoles,
      last10Dots,
      topChamp: topChamps[0]?.champ ?? "",
    };
  });

  out.sort((a, b) => b.games - a.games || b.kda - a.kda);
  return out;
}

function renderCard(p, idx, ui) {
  const wrTone =
    p.wr >= 60 ? "text-emerald-700" : p.wr <= 45 ? "text-rose-700" : "text-slate-900";

  const smallChip = (text) => `
    <span class="px-2 py-1 rounded-full border border-slate-200 bg-white/70 text-[0.65rem] text-slate-800">
      ${text}
    </span>
  `;

  const rolesChips = p.topRoles.length
    ? p.topRoles
        .slice(0, 2)
        .map((r) => smallChip(`${escapeHtml(r.role)} <span class="text-slate-500">${r.share.toFixed(0)}%</span>`))
        .join("")
    : `<span class="text-[0.65rem] text-slate-400">—</span>`;

  const champChips = p.topChamps.length
    ? p.topChamps
        .slice(0, 3)
        .map((c) => smallChip(`${escapeHtml(c.champ)} <span class="text-slate-500">(${c.count})</span>`))
        .join("")
    : `<span class="text-[0.65rem] text-slate-400">—</span>`;

  const dots = [];
  for (let i = 0; i < 10; i++) dots.push(p.last10Dots[i] || "empty");
  const latestIdx = p.last10Dots.length ? p.last10Dots.length - 1 : -1;
  const dotsHTML = dots
    .map((state, i) => {
      const cls = state === "win" ? "win" : state === "loss" ? "loss" : "";
      const latest = i === latestIdx ? "latest" : "";
      return `<span class="s26-dot ${cls} ${latest}"></span>`;
    })
    .join("");

  const mk = p.multikills || { d: 0, t: 0, q: 0, p: 0 };
  const mkChip = (k, v) => `<span class="mk-chip"><span class="k">${k}</span>${v}</span>`;

  const tint = seedFromString(p.name);
  const glowA = (0.32 + tint * 0.18).toFixed(2);
  const glowB = (0.18 + (1 - tint) * 0.16).toFixed(2);

  const bg = noiseForPlayer(p.name);
  const imgId = `solo-mini-champ-${idx}`;

  const roleLine = ui.hideRoleLine
    ? `<div class="text-[0.7rem] text-slate-600 leading-tight">${escapeHtml(ui.queueLabel)}</div>`
    : `<div class="text-[0.7rem] text-slate-600 leading-tight">${escapeHtml(ui.queueLabel)} · ${escapeHtml(p.topRoles[0]?.role ?? "—")}</div>`;

  return `
    <div
      class="mini-card glass3d relative overflow-hidden rounded-[24px] border border-slate-200/80 shadow-md w-full max-w-[330px]"
      style="
        background-image: url('${bg}');
        background-size: cover;
        background-position: center;
        --dot-win:#10b981;
        --dot-loss:#fb7185;
        --dot-empty:#e2e8f0;
        --dot-ring:#ff8000;
      "
    >
      <div class="absolute inset-0" style="
        background: radial-gradient(140% 120% at 15% 15%,
          rgba(249,115,22,${glowA}),
          rgba(231,175,178,${glowB}) 45%,
          rgba(255,255,255,0.55) 100%);
      "></div>

      <div class="relative p-3">
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2.5 min-w-0">
            <div class="w-10 h-10 rounded-2xl border border-slate-200 bg-white overflow-hidden shrink-0">
              <img
                id="${imgId}"
                src=""
                alt=""
                class="w-full h-full object-cover object-center block"
                loading="lazy"
                referrerpolicy="no-referrer"
              />
            </div>

            <div class="min-w-0">
              <div class="flex items-center gap-2 min-w-0">
                <div class="text-[1.0rem] font-semibold text-slate-900 truncate">${escapeHtml(p.name)}</div>
                <span class="shrink-0 text-[0.65rem] font-semibold px-2 py-[2px] rounded-full border border-slate-200 bg-white/70 text-slate-700">
                  ${p.games}g
                </span>
              </div>
              ${roleLine}
            </div>
          </div>

          <span class="shrink-0 text-[0.65rem] font-extrabold px-2.5 py-[4px] rounded-full"
            style="border:1px solid rgba(231,175,178,0.9); background: rgba(231,175,178,0.22); color:#ff8000;">
            ${escapeHtml(ui.badgeText)}
          </span>
        </div>

        <div class="mt-2.5 grid grid-cols-3 gap-2">
          <div class="px-2.5 py-1.5 rounded-2xl border border-slate-200 bg-white/75 leading-tight">
            <div class="text-[0.55rem] uppercase tracking-wide text-slate-400">KDA</div>
            <div class="text-[0.90rem] font-semibold text-slate-900 leading-tight">${p.kda.toFixed(2)}</div>
          </div>

          <div class="px-2.5 py-1.5 rounded-2xl border border-slate-200 bg-white/75 leading-tight">
            <div class="text-[0.55rem] uppercase tracking-wide text-slate-400">WR</div>
            <div class="text-[0.90rem] font-semibold ${wrTone} leading-tight">${p.wr.toFixed(1)}%</div>
          </div>

          <div class="px-2.5 py-1.5 rounded-2xl border border-slate-200 bg-white/75 leading-tight">
            <div class="text-[0.55rem] uppercase tracking-wide text-slate-400">K/D/A</div>
            <div class="text-[0.85rem] font-semibold text-slate-900 leading-tight whitespace-nowrap">
              ${p.kills}/${p.deaths}/${p.assists}
            </div>
          </div>
        </div>

        <div class="mt-2.5 flex items-center justify-between gap-2">
          <div class="text-[0.65rem] uppercase tracking-wide text-slate-500">Last 10</div>
          <div class="flex items-center gap-1.5">${dotsHTML}</div>
        </div>

        <div class="mt-2.5 grid grid-cols-2 gap-2">
          <div>
            <div class="text-[0.65rem] uppercase tracking-wide text-slate-500 mb-1">Roles</div>
            <div class="flex flex-wrap gap-1.5">${rolesChips}</div>
          </div>
          <div>
            <div class="text-[0.65rem] uppercase tracking-wide text-slate-500 mb-1">Champs</div>
            <div class="flex flex-wrap gap-1.5">${champChips}</div>
          </div>
        </div>

        <div class="mt-3 rounded-2xl border border-slate-200 bg-white/75 px-2.5 py-2">
          <div class="flex items-center justify-between gap-2">
            <div class="text-[0.65rem] uppercase tracking-wide text-slate-500">Multikills</div>
            <div class="flex items-center gap-1">
              ${mkChip("D", mk.d)}${mkChip("T", mk.t)}${mkChip("Q", mk.q)}${mkChip("P", mk.p)}
            </div>
          </div>

          <div class="mt-2 flex items-center justify-between">
            <div class="text-[0.72rem] font-semibold text-slate-700">Enemy Missing pings</div>
            <div class="text-[0.9rem] font-semibold text-slate-900">${p.enemyMissingPings}</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

export async function mountPlayerMiniCards(el, rows, opts = {}) {
  injectMiniCardBitsOnce();
  if (!el) return;

  const ui = {
    queueLabel: opts.queueLabel ?? "Solo/Duo",
    badgeText: opts.badgeText ?? "Solo",
    hideRoleLine: opts.hideRoleLine ?? false,
  };

  if (!rows || !rows.length) {
    el.innerHTML = `<div class="text-sm text-slate-500">No data.</div>`;
    return;
  }

  const players = buildPlayers(rows);
  if (!players.length) {
    el.innerHTML = `<div class="text-sm text-slate-500">No player rows found.</div>`;
    return;
  }

  el.innerHTML = players.map((p, idx) => renderCard(p, idx, ui)).join("");

  await Promise.all(
    players.map(async (p, idx) => {
      const img = document.getElementById(`solo-mini-champ-${idx}`);
      if (!img) return;

      try {
        const url = p.topChamp ? await championSquareUrl(p.topChamp) : "";
        if (url) {
          img.src = url;
          img.alt = `${p.topChamp} icon`;
        }
      } catch {}
    })
  );
}
