// /components/recentGamesCard.js
import { formatDDMonYY } from "../core/dates.js";
import { championSquareUrl } from "../core/ddragon.js";

function injectRecentGamesDuoStylesOnce() {
  if (document.getElementById("recent-games-duo-line-styles")) return;

  const style = document.createElement("style");
  style.id = "recent-games-duo-line-styles";
  style.textContent = `
    /* Duo connector line (subtle) */
    body.s26 .rg-players { position: relative; }

    /* Only when exactly 2 players are displayed */
    body.s26 .rg-players.rg-duo::before{
      content:"";
      position:absolute;
      left: 12px;            /* center of the 24px initials badge */
      top: 12px;
      bottom: 12px;
      width: 3px;            /* thickness */
      border-radius: 999px;
      pointer-events:none;
      z-index: 0;

      /* Tapered minimal orange line */
      background: linear-gradient(
        to bottom,
        rgba(255,128,0,0.00) 0%,
        rgba(255,128,0,0.22) 58%,
        rgba(255,128,0,0.22) 82%,
        rgba(255,128,0,0.00) 100%
      );
    }

    /* Keep initials badge above the line */
    body.s26 .rg-badge { position: relative; z-index: 1; }
  `;
  document.head.appendChild(style);
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function num(v) {
  if (v === null || v === undefined || v === "") return NaN;
  const n = Number(String(v).replace(",", ".").trim());
  return Number.isFinite(n) ? n : NaN;
}

function pickAny(r, keys) {
  if (!r) return "";
  for (const k of keys) {
    const v = r?.[k];
    if (v != null && String(v).trim() !== "") return v;
  }
  const raw = r?._raw;
  if (raw) {
    for (const k of keys) {
      const v = raw?.[k];
      if (v != null && String(v).trim() !== "") return v;
    }
  }
  return "";
}

/**
 * Return duration in minutes if we can infer it from any common field.
 * Supports:
 * - TIME (your curated minutes)
 * - duration_min / duration_s
 * - gameDuration (Riot seconds) / gameDuration ms
 * - any generic duration value (heuristic: >100 => seconds, >100000 => ms)
 */
function durationMinutes(r) {
  // strongest/known fields first
  const vTimeMin = pickAny(r, ["duration_min", "durationMin", "TIME", "Time", "time_min", "timeMin"]);
  const nTimeMin = num(vTimeMin);
  if (Number.isFinite(nTimeMin) && nTimeMin > 0) return nTimeMin;

  // seconds-ish fields
  const vSec = pickAny(r, [
    "duration_s",
    "durationS",
    "durationSeconds",
    "gameDuration",
    "game_duration",
    "p.gameDuration",
    "Game Duration",
    "Duration",
  ]);
  const nSecRaw = num(vSec);
  if (Number.isFinite(nSecRaw) && nSecRaw > 0) {
    // heuristic:
    // - huge => ms
    // - >100 => seconds (because minutes almost never >100 in LoL; also catches 240s remakes)
    // - otherwise => minutes
    if (nSecRaw > 100000) return nSecRaw / 60000; // ms -> min
    if (nSecRaw > 100) return nSecRaw / 60;       // sec -> min
    return nSecRaw;                                // already minutes
  }

  return null;
}

function isRemake(r) {
  const dm = durationMinutes(r);
  return dm != null && dm > 0 && dm < 5; // < 5 minutes
}

function kdaText(r) {
  const k = Number(r.kills || 0);
  const d = Number(r.deaths || 0);
  const a = Number(r.assists || 0);
  return `${k}/${d}/${a}`;
}

function resultText(r) {
  // ✅ Remake overrides win/loss
  if (isRemake(r)) return "Remake";
  if (r.win === true) return "Win";
  if (r.win === false) return "Loss";
  return "—";
}

function matchKey(r) {
  const candidates = [
    "matchId",
    "match_id",
    "Match ID",
    "MatchId",
    "gameId",
    "game_id",
    "Game ID",
    "GameId",
    "id",
    "_matchId",
    "_gameId",
  ];
  for (const k of candidates) {
    const v = r?.[k];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  const raw = r?._raw;
  if (raw) {
    for (const k of candidates) {
      const v = raw?.[k];
      if (v != null && String(v).trim() !== "") return String(v).trim();
    }
  }
  return null;
}

function initials(name) {
  const s = String(name ?? "").trim();
  if (!s) return "??";
  const parts = s.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] || "?";
  const b = (parts[1]?.[0] || parts[0]?.[1] || "").toUpperCase();
  return (a + b).toUpperCase().slice(0, 2);
}

function stackInfoFromCount(n) {
  const c = Number(n || 0);
  if (c <= 1) return { label: "Solo", count: 1, cls: "bg-sky-50 text-sky-700 border-sky-200" };
  if (c === 2) return { label: "Duo", count: 2, cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  if (c === 3) return { label: "Trio", count: 3, cls: "bg-orange-50 text-orange-700 border-orange-200" };
  return { label: `${c}-stack`, count: c, cls: "bg-purple-50 text-purple-700 border-purple-200" };
}

function stackPill(nubCount) {
  const s = stackInfoFromCount(nubCount);
  return `
    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.65rem] font-semibold border ${s.cls}">
      ${escapeHtml(s.label)} · ${s.count}
    </span>
  `;
}

function queuePill(opts = {}) {
  const id = opts.queueId ?? 420;
  const label = opts.queueLabel ?? "Solo/Duo";
  const title = opts.queueTitle ?? (id === 440 ? "Ranked Flex queue" : "Solo/Duo queue");
  return `
    <div class="pill" title="${escapeHtml(title)}">
      <span style="color: var(--ln-orange); font-weight: 900;">${escapeHtml(id)}</span>
      ${escapeHtml(label)}
    </div>
  `;
}

function queueInfoFromRow(row, opts = {}) {
  if (typeof opts.queueLabelForRow === "function") {
    const custom = opts.queueLabelForRow(row);
    if (custom && typeof custom === "object") {
      return {
        id: custom.id ?? null,
        label: String(custom.label ?? "—"),
        cls: String(custom.cls ?? "bg-slate-50 text-slate-700 border-slate-200"),
      };
    }
    if (custom != null && String(custom).trim() !== "") {
      return {
        id: null,
        label: String(custom).trim(),
        cls: "bg-slate-50 text-slate-700 border-slate-200",
      };
    }
  }

  const qid = num(pickAny(row, ["queueId", "queue", "Queue ID", "QueueId", "p.queueId"]));
  if (qid === 420) {
    return { id: 420, label: "Solo", cls: "bg-sky-50 text-sky-700 border-sky-200" };
  }
  if (qid === 440) {
    return { id: 440, label: "Flex", cls: "bg-orange-50 text-orange-700 border-orange-200" };
  }
  if (Number.isFinite(qid) && qid > 0) {
    return {
      id: qid,
      label: `Q${qid}`,
      cls: "bg-slate-50 text-slate-700 border-slate-200",
    };
  }

  const queueType = String(pickAny(row, ["queueType", "Queue Type", "queue_type"]))
    .trim()
    .toLowerCase();
  if (queueType.includes("solo")) {
    return { id: 420, label: "Solo", cls: "bg-sky-50 text-sky-700 border-sky-200" };
  }
  if (queueType.includes("flex")) {
    return { id: 440, label: "Flex", cls: "bg-orange-50 text-orange-700 border-orange-200" };
  }

  return { id: null, label: "—", cls: "bg-slate-50 text-slate-700 border-slate-200" };
}

function rowQueuePill(row, opts = {}) {
  const q = queueInfoFromRow(row, opts);
  return `
    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.65rem] font-semibold border ${q.cls}">
      ${
        q.id != null
          ? `<span class="font-extrabold">${escapeHtml(q.id)}</span><span>${escapeHtml(q.label)}</span>`
          : escapeHtml(q.label)
      }
    </span>
  `;
}

function hydrateRecentGameIcons(scopeEl, iconFor) {
  const imgs = Array.from(scopeEl.querySelectorAll("img[data-rg-champ]"));
  if (!imgs.length) return;

  void Promise.all(
    imgs.map(async (img) => {
      const champ = String(img.getAttribute("data-rg-champ") || "").trim();
      if (!champ) return;
      const url = await iconFor(champ);
      if (url) img.src = url;
    })
  );
}

export async function mountRecentGamesCard(el, rows, opts = {}) {
  injectRecentGamesDuoStylesOnce();

  const limit = Number(opts.limit ?? 10);
  const groupSameMatch = opts.groupSameMatch !== false; // default true
  const showQueueColumn = opts.showQueueColumn === true;

  // other-flex helpers
  const matchMeta = opts.matchMeta; // Map(matchId -> { nubCount, nubNames, otherCount })
  const roster = Array.isArray(opts.roster) ? opts.roster : null;
  const isNubRow =
    typeof opts.isNub === "function"
      ? opts.isNub
      : (r) => r?.isNub === true || (roster ? roster.includes(String(r?.player ?? "").trim()) : false);

  const nubsOnly = opts.nubsOnly === true; // show only nub participants inside each match row
  const showStack = opts.showStack !== false; // default true when matchMeta exists

  if (!el) return;

  if (!rows || !rows.length) {
    el.innerHTML = `
      <div class="card-header">
        <div>
          <div class="card-title">Recent Games</div>
          <div class="card-subtitle">Last ${limit}</div>
        </div>
      </div>
      <div class="text-sm text-slate-500">No data.</div>
    `;
    return;
  }

  const valid = [...rows].filter((r) => r.date instanceof Date && !isNaN(r.date.getTime()));
  if (!valid.length) {
    el.innerHTML = `
      <div class="card-header">
        <div>
          <div class="card-title">Recent Games</div>
          <div class="card-subtitle">Last ${limit}</div>
        </div>
      </div>
      <div class="text-sm text-slate-500">No valid dated games.</div>
    `;
    return;
  }

  // ===== Group by match =====
  let matches = [];

  if (groupSameMatch) {
    const map = new Map();

    for (const r of valid) {
      const key = matchKey(r);
      const k = key
        ? `m:${key}`
        : `u:${r.date.getTime()}|${String(r.player ?? "")}|${String(r.champion ?? "")}`;

      if (!map.has(k)) {
        map.set(k, {
          key: k,
          matchId: key || "",
          date: r.date,
          participants: [],
          rep: r,
        });
      }

      const g = map.get(k);
      g.participants.push(r);
      if (r.date.getTime() > g.date.getTime()) g.date = r.date;
    }

    matches = [...map.values()]
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, limit);
  } else {
    const items = valid.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, limit);
    matches = items.map((r) => ({
      key: `u:${r.date.getTime()}|${String(r.player ?? "")}|${String(r.champion ?? "")}`,
      matchId: matchKey(r) || "",
      date: r.date,
      participants: [r],
      rep: r,
    }));
  }

  // icon cache
  const iconCache = new Map();
  async function iconFor(champ) {
    const c = String(champ ?? "").trim();
    if (!c) return "";
    if (!iconCache.has(c)) {
      iconCache.set(
        c,
        championSquareUrl(c)
          .then((url) => url || "")
          .catch(() => "")
      );
    }
    return iconCache.get(c);
  }

  const subtitle = matches.length
    ? `Last ${matches.length} · newest ${formatDDMonYY(matches[0].date)}`
    : `Last ${limit}`;

  const rowsHtml = matches
    .map((m) => {
      const rep = m.rep;

      const res = resultText(rep);

      // ✅ violet tone for remakes
      const resClass =
        res === "Win"
          ? "text-emerald-700"
          : res === "Loss"
          ? "text-rose-700"
          : res === "Remake"
          ? "text-violet-700"
          : "text-slate-700";

      // stable order
      const psAll = [...m.participants].sort((a, b) =>
        String(a.player ?? "").localeCompare(String(b.player ?? ""))
      );

      const meta = m.matchId && matchMeta?.get ? matchMeta.get(m.matchId) : null;

      // choose which participants to display
      const psNubs = psAll.filter((p) => isNubRow(p));
      const ps = nubsOnly && psNubs.length ? psNubs : psAll;

      // compute stack info
      const nubCount =
        meta?.nubCount ??
        (psNubs.length ? psNubs.length : ps.length); // fallback
      const stackPillHtml = showStack && (meta || nubsOnly) ? stackPill(nubCount) : "";
      const stackLine = !showQueueColumn && stackPillHtml
        ? `<div class="flex items-center gap-2 mb-1">${stackPillHtml}</div>`
        : "";

      const isDuoVisible = ps.length === 2;

      const playersHtml = ps
        .map((p) => {
          const name = String(p.player ?? "—");
          return `
            <div class="flex items-center gap-2">
              <span class="rg-badge inline-flex items-center justify-center w-6 h-6 rounded-lg border border-slate-200 bg-white text-[0.6rem] font-extrabold text-slate-700">
                ${escapeHtml(initials(name))}
              </span>
              <span class="font-medium text-slate-900">${escapeHtml(name)}</span>
            </div>
          `;
        })
        .join("");

      const champsHtml = ps
        .map((p) => {
          const champ = String(p.champion ?? "—");
          const hasChamp = champ && champ !== "—";
          return `
            <div class="flex items-center gap-2">
              ${
                hasChamp
                  ? `<img data-rg-champ="${escapeHtml(champ)}" src="" alt="" class="w-5 h-5 rounded-md border border-slate-200 bg-white" loading="lazy" referrerpolicy="no-referrer" />`
                  : `<span class="inline-block w-5 h-5 rounded-md border border-slate-200 bg-white"></span>`
              }
              <span class="text-slate-700">${escapeHtml(champ)}</span>
            </div>
          `;
        })
        .join("");

      const rolesHtml = ps.map((p) => `<div class="text-slate-700">${escapeHtml(p.role || "—")}</div>`).join("");
      const kdaHtml = ps
        .map((p) => `<div class="text-slate-700"><span class="font-semibold">${escapeHtml(kdaText(p))}</span></div>`)
        .join("");
      const queueCell = showQueueColumn
        ? `<td>
             <div class="flex flex-col items-start gap-1">
               ${rowQueuePill(rep, opts)}
               ${stackPillHtml}
             </div>
           </td>`
        : "";

      const matchIdHint = m.matchId ? ` title="Match: ${escapeHtml(m.matchId)}"` : "";

      return `
        <tr>
          <td${matchIdHint}>${escapeHtml(formatDDMonYY(m.date))}</td>
          ${queueCell}
          <td>
            ${stackLine}
            <div class="rg-players ${isDuoVisible ? "rg-duo" : ""} flex flex-col gap-1">${playersHtml}</div>
          </td>
          <td><div class="flex flex-col gap-1">${champsHtml}</div></td>
          <td><div class="flex flex-col gap-1">${rolesHtml}</div></td>
          <td><div class="flex flex-col gap-1">${kdaHtml}</div></td>
          <td class="${resClass} font-semibold" style="text-align:right;">${escapeHtml(res)}</td>
        </tr>
      `;
    })
    .join("");

  el.innerHTML = `
    <div class="card-header">
      <div>
        <div class="card-title">Recent Games</div>
        <div class="card-subtitle">${escapeHtml(subtitle)}${groupSameMatch ? " · grouped by match" : ""}</div>
      </div>
      ${queuePill(opts)}
    </div>

    <div class="overflow-x-auto">
      <table class="s26-table">
        <thead>
          <tr>
            <th style="width: 120px;">Date</th>
            ${showQueueColumn ? '<th style="width: 120px;">Queue</th>' : ""}
            <th>Players</th>
            <th>Champs</th>
            <th style="width: 110px;">Role</th>
            <th style="width: 120px;">K/D/A</th>
            <th style="width: 90px; text-align:right;">Result</th>
          </tr>
        </thead>
        <tbody>
          ${
            rowsHtml ||
            `<tr><td colspan="${showQueueColumn ? 7 : 6}" class="text-slate-500">No valid games.</td></tr>`
          }
        </tbody>
      </table>
    </div>
  `;

  hydrateRecentGameIcons(el, iconFor);
}
