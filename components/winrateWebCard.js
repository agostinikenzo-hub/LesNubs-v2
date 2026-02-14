// /components/winrateWebCard.js

function escHtml(v) {
  return String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function num(v, fallback = 0) {
  const n = Number(String(v ?? "").replace(",", ".").trim());
  return Number.isFinite(n) ? n : fallback;
}

function initials(name) {
  const s = String(name ?? "").trim();
  if (!s) return "??";
  const parts = s.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] || "?";
  const b = (parts[1]?.[0] || parts[0]?.[1] || "").toUpperCase();
  return (a + b).toUpperCase().slice(0, 2);
}

function comboToken(names) {
  const letters = names
    .map((n) => String(n || "").trim()[0] || "?")
    .join("")
    .toUpperCase();
  return letters.slice(0, 3);
}

function comboSizeFromMode(mode) {
  if (mode === "duos") return 2;
  if (mode === "trios") return 3;
  if (mode === "quads") return 4;
  if (mode === "fives") return 5;
  return null;
}

function queueKeyFromRow(r) {
  const qid = num(r?.queueId ?? r?._raw?.["Queue ID"] ?? r?._raw?.queueId, NaN);
  if (qid === 420) return "solo";
  if (qid === 440) return "flex";
  return "other";
}

function winFromRow(r) {
  if (typeof r?.win === "boolean") return r.win;
  const raw = String(r?.Result ?? r?._raw?.Result ?? r?._raw?.win ?? r?._raw?.["p.win"] ?? "")
    .trim()
    .toLowerCase();
  if (raw === "win" || raw === "true" || raw === "1" || raw === "yes") return true;
  if (raw === "loss" || raw === "false" || raw === "0" || raw === "no") return false;
  return null;
}

function matchKey(r) {
  const direct = String(r?.matchId ?? "").trim();
  if (direct) return `m:${direct}`;

  const raw = r?._raw || {};
  const fallback = String(
    raw["matchId"] ||
      raw["match_id"] ||
      raw["Match ID"] ||
      raw["MatchId"] ||
      raw["MatchID"] ||
      raw["gameId"] ||
      raw["Game ID"] ||
      ""
  ).trim();
  if (fallback) return `m:${fallback}`;

  const dt = r?.date instanceof Date ? r.date.getTime() : 0;
  return `u:${dt}`;
}

function playerNameFromRow(r) {
  return String(r?.player ?? r?._raw?.["p.riotIdGameName"] ?? r?._raw?.Player ?? "").trim();
}

function combinations(items, k) {
  const out = [];
  const arr = [...items];
  if (k <= 0 || k > arr.length) return out;

  const path = [];
  const dfs = (start) => {
    if (path.length === k) {
      out.push([...path]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      path.push(arr[i]);
      dfs(i + 1);
      path.pop();
    }
  };

  dfs(0);
  return out;
}

function pct(v) {
  if (!Number.isFinite(v)) return "0.0%";
  return `${v.toFixed(1)}%`;
}

function wrColor(wr) {
  if (wr >= 60) return { fill: "#16a34a", ring: "rgba(22,163,74,0.45)" };
  if (wr >= 52) return { fill: "#f97316", ring: "rgba(249,115,22,0.45)" };
  return { fill: "#e11d48", ring: "rgba(225,29,72,0.42)" };
}

function injectStylesOnce() {
  if (document.getElementById("winrate-web-styles")) return;

  const style = document.createElement("style");
  style.id = "winrate-web-styles";
  style.textContent = `
    @keyframes wrNodeIn {
      0%   { opacity: 0; transform: scale(0.74); }
      70%  { opacity: 1; transform: scale(1.02); }
      100% { opacity: 1; transform: scale(1); }
    }

    @keyframes wrFloat {
      0%, 100% { transform: scale(1); }
      50%      { transform: scale(1.02); }
    }

    @keyframes wrPulse {
      0%, 100% { opacity: 0.12; transform: scale(1); }
      50%      { opacity: 0.24; transform: scale(1.08); }
    }

    body.s26 .wr-shell {
      border: 1px solid rgba(148,163,184,0.30);
      border-radius: 1.1rem;
      background: rgba(255,255,255,0.62);
      backdrop-filter: blur(10px);
      padding: 0.8rem;
      box-shadow: 0 10px 24px rgba(15,23,42,0.06);
      overflow: hidden;
    }

    body.s26 .wr-layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(260px, 320px);
      gap: 0.85rem;
      align-items: stretch;
    }

    @media (max-width: 980px) {
      body.s26 .wr-layout {
        grid-template-columns: 1fr;
      }
    }

    body.s26 .wr-svg {
      width: 100%;
      height: 340px;
      display: block;
      overflow: hidden;
      border-radius: 0.85rem;
      background:
        radial-gradient(circle at 20% 0%, rgba(59,130,246,0.07), transparent 38%),
        radial-gradient(circle at 85% 12%, rgba(249,115,22,0.08), transparent 40%),
        linear-gradient(180deg, rgba(248,250,252,0.9), rgba(241,245,249,0.68));
      border: 1px solid rgba(148,163,184,0.20);
    }

    body.s26 .wr-ring {
      fill: none;
      stroke: rgba(15,23,42,0.08);
      stroke-width: 1;
    }

    body.s26 .wr-axis {
      stroke: rgba(15,23,42,0.11);
      stroke-width: 1;
      stroke-dasharray: 2 5;
    }

    body.s26 .wr-percent {
      fill: rgba(71,85,105,0.7);
      font-size: 9px;
      font-weight: 800;
      text-anchor: middle;
    }

    body.s26 .wr-path {
      fill: rgba(249,115,22,0.12);
      stroke: rgba(249,115,22,0.65);
      stroke-width: 1.5;
      stroke-linejoin: round;
      stroke-linecap: round;
      stroke-dasharray: 8 8;
      animation: wrPathDash 3.8s linear infinite;
    }

    @keyframes wrPathDash {
      to { stroke-dashoffset: -32; }
    }

    body.s26 .wr-node {
      animation: wrNodeIn 430ms cubic-bezier(.2,.9,.2,1) both;
      animation-delay: var(--delay, 0ms);
      transform-origin: center center;
      transform-box: fill-box;
    }

    body.s26 .wr-node .wr-dot {
      animation: wrFloat 2.35s ease-in-out infinite;
      animation-delay: var(--float-delay, 0ms);
      transform-origin: center;
    }

    body.s26 .wr-node text {
      pointer-events: none;
      user-select: none;
    }

    body.s26 .wr-aura {
      fill: rgba(249,115,22,0.2);
      filter: blur(1.8px);
      animation: wrPulse 2.5s ease-in-out infinite;
      transform-origin: center;
    }

    body.s26 .wr-dot-main {
      stroke-width: 1.6;
    }

    body.s26 .wr-dot-token {
      font-size: 8px;
      font-weight: 900;
      fill: rgba(255,255,255,0.96);
      dominant-baseline: middle;
      text-anchor: middle;
      letter-spacing: 0.01em;
    }

    body.s26 .wr-label {
      fill: rgba(15,23,42,0.74);
      font-size: 9px;
      font-weight: 800;
      text-anchor: middle;
    }

    body.s26 .wr-side {
      border: 1px solid rgba(148,163,184,0.28);
      border-radius: 1rem;
      padding: 0.72rem;
      background: rgba(255,255,255,0.72);
      display: flex;
      flex-direction: column;
      gap: 0.55rem;
    }

    body.s26 .wr-side-title {
      font-size: 0.8rem;
      font-weight: 900;
      color: #0f172a;
      letter-spacing: -0.01em;
    }

    body.s26 .wr-list {
      display: grid;
      gap: 0.42rem;
      max-height: 264px;
      overflow: auto;
      padding-right: 2px;
    }

    body.s26 .wr-item {
      border: 1px solid rgba(148,163,184,0.22);
      border-radius: 0.8rem;
      padding: 0.42rem 0.52rem;
      background: rgba(255,255,255,0.82);
      display: grid;
      gap: 0.2rem;
    }

    body.s26 .wr-item-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      font-size: 0.72rem;
      font-weight: 800;
      color: #0f172a;
    }

    body.s26 .wr-item-sub {
      font-size: 0.66rem;
      color: rgba(71,85,105,0.92);
      line-height: 1.2;
    }

    body.s26 .wr-badge {
      display: inline-flex;
      align-items: center;
      padding: 2px 8px;
      border-radius: 999px;
      border: 1px solid rgba(148,163,184,0.33);
      background: rgba(255,255,255,0.86);
      font-size: 0.63rem;
      font-weight: 900;
      white-space: nowrap;
    }

    body.s26 .wr-controls {
      display: grid;
      gap: 0.34rem;
      margin: 0.52rem 0 0.72rem;
    }

    body.s26 .wr-control-row {
      display: flex;
      align-items: center;
      gap: 0.38rem;
      flex-wrap: wrap;
    }

    body.s26 .wr-pill {
      appearance: none;
      border: 1px solid rgba(148,163,184,0.35);
      background: rgba(255,255,255,0.72);
      color: rgba(15,23,42,0.82);
      border-radius: 999px;
      padding: 3px 10px;
      font-size: 0.64rem;
      font-weight: 900;
      line-height: 1.1;
      letter-spacing: 0.01em;
      cursor: pointer;
      transition: transform 120ms ease, border-color 120ms ease, background 120ms ease, color 120ms ease;
    }

    body.s26 .wr-pill:hover {
      transform: translateY(-1px);
      border-color: rgba(100,116,139,0.45);
      background: rgba(255,255,255,0.92);
    }

    body.s26 .wr-pill.is-active {
      border-color: rgba(249,115,22,0.42);
      background: rgba(249,115,22,0.14);
      color: #c2410c;
      box-shadow: 0 4px 10px rgba(249,115,22,0.12);
    }

    body.s26 .wr-foot {
      margin-top: 0.55rem;
      display: flex;
      flex-wrap: wrap;
      gap: 0.45rem;
      align-items: center;
      justify-content: space-between;
      font-size: 0.67rem;
      color: rgba(71,85,105,0.95);
    }

    body.s26 .wr-empty {
      font-size: 0.82rem;
      color: rgba(71,85,105,0.9);
      border: 1px dashed rgba(148,163,184,0.42);
      border-radius: 0.9rem;
      padding: 0.8rem;
      background: rgba(248,250,252,0.65);
      text-align: center;
    }
  `;

  document.head.appendChild(style);
}

function buildMatches(rows, queueFilter, rosterSet) {
  const map = new Map();

  for (const r of rows || []) {
    const name = playerNameFromRow(r);
    if (!name || (rosterSet && !rosterSet.has(name))) continue;

    const qk = queueKeyFromRow(r);
    if (queueFilter !== "all" && qk !== queueFilter) continue;

    const key = `${queueFilter === "all" ? qk : "x"}:${matchKey(r)}`;
    if (!map.has(key)) {
      map.set(key, {
        key,
        queue: qk,
        players: new Map(),
        win: null,
        date: r?.date instanceof Date ? r.date : null,
      });
    }

    const m = map.get(key);
    if (!m.players.has(name)) m.players.set(name, r);

    const w = winFromRow(r);
    if (typeof w === "boolean") m.win = w;

    if (r?.date instanceof Date) {
      if (!m.date || r.date.getTime() > m.date.getTime()) m.date = r.date;
    }
  }

  return [...map.values()]
    .map((m) => ({
      ...m,
      playersArr: [...m.players.keys()].sort((a, b) => a.localeCompare(b)),
    }))
    .filter((m) => m.playersArr.length > 0 && typeof m.win === "boolean");
}

function buildEntityStats(matches, mode, rosterList, minGames) {
  const out = new Map();

  if (mode === "players") {
    for (const name of rosterList) {
      out.set(`p:${name}`, {
        key: `p:${name}`,
        label: name,
        token: initials(name),
        games: 0,
        wins: 0,
        type: "player",
      });
    }

    for (const m of matches) {
      for (const name of m.playersArr) {
        const k = `p:${name}`;
        if (!out.has(k)) {
          out.set(k, { key: k, label: name, token: initials(name), games: 0, wins: 0, type: "player" });
        }
        const e = out.get(k);
        e.games += 1;
        e.wins += m.win ? 1 : 0;
      }
    }
  } else {
    const size = comboSizeFromMode(mode) || 2;
    const typeBySize = {
      2: "duo",
      3: "trio",
      4: "quad",
      5: "five",
    };

    for (const m of matches) {
      if (m.playersArr.length < size) continue;
      const combos = combinations(m.playersArr, size);
      for (const names of combos) {
        const id = names.join(" + ");
        const key = `${size}:${id}`;
        if (!out.has(key)) {
          out.set(key, {
            key,
            label: id,
            token: comboToken(names),
            names,
            games: 0,
            wins: 0,
            type: typeBySize[size] || "combo",
          });
        }
        const e = out.get(key);
        e.games += 1;
        e.wins += m.win ? 1 : 0;
      }
    }
  }

  const arr = [...out.values()]
    .map((e) => ({
      ...e,
      wr: e.games > 0 ? (100 * e.wins) / e.games : 0,
    }))
    .filter((e) => (mode === "players" ? e.games > 0 : e.games >= minGames));

  arr.sort((a, b) => {
    if (b.wr !== a.wr) return b.wr - a.wr;
    if (b.games !== a.games) return b.games - a.games;
    return a.label.localeCompare(b.label);
  });
  return arr;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function computeSvgModel(entities, width, height) {
  const cx = width / 2;
  const cy = height / 2;
  const ringFractions = [0.2, 0.4, 0.6, 0.8, 1.0];

  const n = Math.max(entities.length, 1);
  const nodeMargin = 44;
  const maxR = Math.max(52, Math.min(width / 2 - nodeMargin, height / 2 - nodeMargin));
  const angleStep = (Math.PI * 2) / n;
  const labelR = maxR + (n > 12 ? 6 : 10);
  const dotOuterPadding = 14;
  const dotMaxR = Math.max(36, maxR - dotOuterPadding);

  const nodes = entities.map((e, i) => {
    const a = -Math.PI / 2 + i * angleStep;
    const axisX = cx + Math.cos(a) * maxR;
    const axisY = cy + Math.sin(a) * maxR;

    const valueR = dotMaxR * Math.max(0, Math.min(1, e.wr / 100));
    const x = cx + Math.cos(a) * valueR;
    const y = cy + Math.sin(a) * valueR;

    const lxRaw = cx + Math.cos(a) * labelR;
    const lyRaw = cy + Math.sin(a) * labelR;
    const lx = clamp(lxRaw, 10, width - 10);
    const ly = clamp(lyRaw, 12, height - 8);

    return {
      ...e,
      i,
      a,
      x,
      y,
      lx,
      ly,
      axisX,
      axisY,
    };
  });

  const pathPoints = nodes.map((p) => `${p.x},${p.y}`).join(" ");

  return {
    cx,
    cy,
    maxR,
    ringFractions,
    nodes,
    pathPoints,
  };
}

function topCombosText(entities, mode) {
  if (mode === "players") return "Best player winrates";
  if (mode === "trios") return "Best trio winrates";
  if (mode === "quads") return "Best 4-stack winrates";
  if (mode === "fives") return "Best 5-stack winrates";
  return "Best duo winrates";
}

function rowPills(kind, stateVal) {
  const rows = {
    queue: [
      { value: "all", label: "All Queues" },
      { value: "solo", label: "Solo" },
      { value: "flex", label: "Flex" },
    ],
    mode: [
      { value: "players", label: "Players" },
      { value: "duos", label: "Duos" },
      { value: "trios", label: "Trios" },
      { value: "quads", label: "4-Stack" },
      { value: "fives", label: "5-Stack" },
    ],
    min: [
      { value: "2", label: "Min 2" },
      { value: "4", label: "Min 4" },
      { value: "6", label: "Min 6" },
    ],
  };

  return (rows[kind] || [])
    .map(
      (it) =>
        `<button class="wr-pill ${String(stateVal) === it.value ? "is-active" : ""}" data-${kind}="${it.value}">${escHtml(
          it.label
        )}</button>`
    )
    .join("");
}

export async function mountWinrateWebCard(el, rows, opts = {}) {
  injectStylesOnce();
  if (!el) return;

  const roster = Array.isArray(opts.roster) && opts.roster.length ? opts.roster : [];
  const rosterSet = new Set(roster);

  if (!rows || !rows.length) {
    el.innerHTML = `
      <div class="card-header">
        <div>
          <div class="card-title">Winrate Web</div>
          <div class="card-subtitle">Players + queue-together combos</div>
        </div>
      </div>
      <div class="wr-empty">No data available.</div>
    `;
    return;
  }

  const state = {
    queue: "all",
    mode: "players",
    minGames: 4,
  };

  function render() {
    const matches = buildMatches(rows, state.queue, rosterSet);
    const entitiesAll = buildEntityStats(matches, state.mode, roster, state.minGames);
    const limit = state.mode === "players" ? Math.max(roster.length, 8) : 12;
    const entities = entitiesAll.slice(0, limit);

    const width = 620;
    const height = 340;
    const model = computeSvgModel(entities, width, height);

    const queueLabel = state.queue === "solo" ? "Solo queue" : state.queue === "flex" ? "Flex queue" : "All queues";
    const modeLabel =
      state.mode === "players"
        ? "Players"
        : state.mode === "trios"
        ? "Trios"
        : state.mode === "quads"
        ? "4-Stack"
        : state.mode === "fives"
        ? "5-Stack"
        : "Duos";

    const rings = model.ringFractions
      .map((f) => {
        const r = model.maxR * f;
        const p = Math.round(f * 100);
        return `
          <circle class="wr-ring" cx="${model.cx}" cy="${model.cy}" r="${r.toFixed(2)}"></circle>
          <text class="wr-percent" x="${model.cx}" y="${(model.cy - r - 4).toFixed(2)}">${p}%</text>
        `;
      })
      .join("");

    const axes = model.nodes
      .map(
        (p) =>
          `<line class="wr-axis" x1="${model.cx}" y1="${model.cy}" x2="${p.axisX.toFixed(2)}" y2="${p.axisY.toFixed(2)}"></line>`
      )
      .join("");

    const labels = model.nodes
      .map(
        (p) => `<text class="wr-label" x="${p.lx.toFixed(2)}" y="${p.ly.toFixed(2)}">${escHtml(p.token)}</text>`
      )
      .join("");

    const nodes = model.nodes
      .map((p, idx) => {
        const c = wrColor(p.wr);
        return `
          <g transform="translate(${p.x.toFixed(2)} ${p.y.toFixed(2)})">
            <g class="wr-node" style="--delay:${idx * 36}ms; --float-delay:${idx * 70}ms;">
              <g class="wr-dot">
                <title>${escHtml(`${p.label} · ${pct(p.wr)} (${p.wins}/${p.games})`)}</title>
                <circle class="wr-aura" r="8.5"></circle>
                <circle class="wr-dot-main" r="7.2" fill="${c.fill}" stroke="${c.ring}"></circle>
                <text class="wr-dot-token" x="0" y="0.4">${escHtml(p.token)}</text>
              </g>
            </g>
          </g>
        `;
      })
      .join("");

    const topList = entitiesAll.slice(0, 8);
    const listHtml = topList.length
      ? topList
          .map((e) => {
            const c = wrColor(e.wr);
            return `
              <div class="wr-item">
                <div class="wr-item-top">
                  <span>${escHtml(e.label)}</span>
                  <span class="wr-badge" style="border-color:${c.ring}; color:${c.fill};">${escHtml(pct(e.wr))}</span>
                </div>
                <div class="wr-item-sub">${escHtml(`${e.wins}W / ${e.games}G`)}</div>
              </div>
            `;
          })
          .join("")
      : `<div class="wr-empty">No ${escHtml(modeLabel.toLowerCase())} reached the minimum game filter yet.</div>`;

    const comboHint =
      state.mode === "players"
        ? "Players use all games in the selected queue scope."
        : `Combos are ${comboSizeFromMode(state.mode) || 2}-player groups from the same match.`;

    el.innerHTML = `
      <div class="card-header">
        <div>
          <div class="card-title">Winrate Web</div>
          <div class="card-subtitle">Animated view of player winrates and queue-together combos</div>
        </div>
        <div class="pill" title="Current filter scope">
          <span style="color: var(--ln-orange); font-weight: 900;">WR</span>
          ${escHtml(queueLabel)} · ${escHtml(modeLabel)}
        </div>
      </div>

      <div class="wr-controls">
        <div class="wr-control-row">${rowPills("queue", state.queue)}</div>
        <div class="wr-control-row">${rowPills("mode", state.mode)}</div>
        ${
          state.mode === "players"
            ? ""
            : `<div class="wr-control-row">${rowPills("min", String(state.minGames))}</div>`
        }
      </div>

      <div class="wr-layout">
        <div class="wr-shell">
          ${
            entities.length
              ? `
            <svg class="wr-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Winrate radar chart">
              ${rings}
              ${axes}
              <polygon class="wr-path" points="${model.pathPoints}"></polygon>
              ${nodes}
              ${labels}
            </svg>
          `
              : `<div class="wr-empty">No data in current filter scope.</div>`
          }
        </div>

        <div class="wr-side">
          <div class="wr-side-title">${escHtml(topCombosText(entitiesAll, state.mode))}</div>
          <div class="wr-list">${listHtml}</div>
        </div>
      </div>

      <div class="wr-foot">
        <span>${escHtml(`${matches.length} matches in scope · ${entitiesAll.length} entries`)}</span>
        <span>${escHtml(comboHint)}</span>
      </div>
    `;

    el.querySelectorAll("[data-queue]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.queue = btn.getAttribute("data-queue") || "all";
        render();
      });
    });

    el.querySelectorAll("[data-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.mode = btn.getAttribute("data-mode") || "players";
        render();
      });
    });

    el.querySelectorAll("[data-min]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.minGames = Math.max(1, Number(btn.getAttribute("data-min") || 4));
        render();
      });
    });
  }

  render();
}
