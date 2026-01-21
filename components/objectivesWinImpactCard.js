// /components/objectivesWinImpactCard.js
import { computeObjectiveWinImpact } from "../core/objectivesWinImpact.js";

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function fmtPct(x) {
  return typeof x === "number" ? `${x.toFixed(1)}%` : "—";
}

function badgeLift(lift) {
  if (typeof lift !== "number") return "text-slate-400";
  if (lift >= 8) return "text-emerald-600";
  if (lift <= -8) return "text-rose-600";
  return "text-slate-500";
}

export function mountObjectivesWinImpactCard(mountEl, rows, opts = {}) {
  if (!mountEl) throw new Error("mountObjectivesWinImpactCard: missing mount element");
  if (!rows || !rows.length) {
    mountEl.innerHTML = `
      <div class="card-header">
        <div>
          <div class="card-title">Objective Win Impact</div>
          <div class="card-subtitle">No data available.</div>
        </div>
      </div>
    `;
    return;
  }

  const title = opts.title ?? "Objective Win Impact";
  const subtitle =
    opts.subtitle ??
    "How dragons/soul/elder, baron, herald, towers & plates move our win rate (dataset-relative).";

  const res = computeObjectiveWinImpact(rows, { excludeRemakesUnderSec: 240 });

  const rowsHtml = res.splits
    .filter((x) => (x.nYes + x.nNo) > 0)
    .map((x) => {
      const liftTxt = typeof x.lift === "number" ? `${x.lift >= 0 ? "+" : ""}${x.lift.toFixed(1)}%` : "—";
      return `
        <tr class="border-t border-slate-100">
          <td class="py-2 pr-3 text-slate-800">${esc(x.label)}</td>
          <td class="py-2 text-right tabular-nums">${fmtPct(x.wrYes)} <span class="text-slate-400 text-[0.7rem]">(${x.nYes})</span></td>
          <td class="py-2 text-right tabular-nums">${fmtPct(x.wrNo)} <span class="text-slate-400 text-[0.7rem]">(${x.nNo})</span></td>
          <td class="py-2 text-right tabular-nums font-semibold ${badgeLift(x.lift)}">${esc(liftTxt)}</td>
        </tr>
      `;
    })
    .join("");

  mountEl.innerHTML = `
    <div class="card-header">
      <div>
        <div class="card-title">${esc(title)}</div>
        <div class="card-subtitle">${esc(subtitle)}</div>
      </div>
      <div class="text-[0.7rem] text-slate-500 text-right">
        Matches: <span class="font-semibold">${res.overall.n}</span><br/>
        Win rate: <span class="font-semibold">${fmtPct(res.overall.winRate)}</span>
      </div>
    </div>

    <div class="mt-3 overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="text-slate-500 text-[0.75rem]">
          <tr>
            <th class="text-left font-semibold py-2 pr-3">Objective signal</th>
            <th class="text-right font-semibold py-2">Win% when YES</th>
            <th class="text-right font-semibold py-2">Win% when NO</th>
            <th class="text-right font-semibold py-2">Lift</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>

    <div class="mt-3 text-[0.7rem] text-slate-500 leading-relaxed">
      Notes:
      <ul class="list-disc ml-5 mt-1 space-y-1">
        <li><strong>Soul</strong> is inferred as <code>Team Dragon Kills ≥ 4</code>.</li>
        <li><strong>Side Lane Pressure</strong> is a proxy using turret/building damage + solo late turrets.</li>
        <li>These are dataset-relative signals (good for “what moves our win rate”).</li>
      </ul>
    </div>
  `;
}
