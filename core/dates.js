// /core/dates.js
export function parseLooseDate(v) {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : coercePastDate(v);

  const now = new Date();

  // numeric (epoch ms / epoch sec / Sheets serial)
  const num = typeof v === "number" ? v : Number(String(v).trim());
  if (Number.isFinite(num)) {
    // epoch ms
    if (num >= 10_000_000_000) return coercePastDate(new Date(num), now);
    // epoch seconds
    if (num >= 1_000_000_000 && num < 10_000_000_000) return coercePastDate(new Date(num * 1000), now);
    // Google Sheets / Excel serial day number
    if (num >= 20_000 && num <= 80_000) {
      const base = Date.UTC(1899, 11, 30);
      return coercePastDate(new Date(base + num * 86400000), now);
    }
  }

  const s = String(v).trim();
  if (!s) return null;

  // ISO yyyy-mm-dd...
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : coercePastDate(d, now);
  }

  // EU dd.mm.yy [hh:mm]
  const m = s.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (m) {
    const dd = parseInt(m[1], 10);
    const mm = parseInt(m[2], 10) - 1;
    let yy = parseInt(m[3], 10);
    const hh = m[4] ? parseInt(m[4], 10) : 0;
    const min = m[5] ? parseInt(m[5], 10) : 0;
    if (yy < 100) yy += 2000;

    const d = new Date(yy, mm, dd, hh, min, 0);
    return isNaN(d.getTime()) ? null : coercePastDate(d, now);
  }

  // fallback
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : coercePastDate(d, now);
}

// If the parsed date is "in the future", roll it back by a year.
// This fixes your “01.12.26” style strings when they’re actually Dec last year.
function coercePastDate(d, now = new Date()) {
  if (!d || isNaN(d.getTime())) return null;

  const maxFuture = now.getTime() + 7 * 86400000; // allow 7 days of drift
  let out = d;
  let guard = 0;

  while (out.getTime() > maxFuture && guard < 5) {
    out = new Date(out.getFullYear() - 1, out.getMonth(), out.getDate(), out.getHours(), out.getMinutes(), out.getSeconds());
    guard++;
  }
  return out;
}

export function formatDDMonYY(d) {
  if (!d) return "—";
  const day = String(d.getDate()).padStart(2, "0");
  const mon = d.toLocaleString(undefined, { month: "short" });
  const yy = String(d.getFullYear()).slice(-2);
  return `${day} ${mon} ${yy}`;
}
// /core/dates.js (add this export)
export function formatShortDate(d) {
  return formatDDMonYY(d);
}
