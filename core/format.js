export function toNumber(v) {
  if (v === null || v === undefined) return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function toBool(v) {
  if (typeof v === "boolean") return v;
  const s = String(v ?? "").trim().toLowerCase();
  if (["true", "1", "yes", "win"].includes(s)) return true;
  if (["false", "0", "no", "loss", "lose"].includes(s)) return false;
  return null;
}

export function formatPct01(x) {
  if (!Number.isFinite(x)) return "—";
  return `${Math.round(x * 100)}%`;
}

export function formatKda(x) {
  if (!Number.isFinite(x)) return "—";
  return x.toFixed(2);
}

export function safeText(v) {
  return String(v ?? "—");
}
