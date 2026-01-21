// /core/timelineData.js
import { fetchCsvText, parseCsv, rowsToObjects } from "./csv.js";

// Timeline tab (gid=1060990396) — CSV export
export const SEASON26_TIMELINE_CSV =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSbxcPDjBBWSe4jIwXuQe-_o5C1RGg067CxU4g_j1yqG8D3DAj8BFqvwKuLopePRuUWv7qE5bmEPuLZ/pub?gid=1060990396&single=true&output=csv";

/**
 * Loads minute-by-minute timeline rows.
 * Returns raw objects keyed by the timeline headers (exactly as in the sheet).
 */
export async function loadTimelineRows({ csvUrl = SEASON26_TIMELINE_CSV } = {}) {
  const text = await fetchCsvText(csvUrl);
  const rows = parseCsv(text);
  const objs = rowsToObjects(rows);

  // Defensive: remove completely empty rows
  return (objs || []).filter((r) => {
    if (!r) return false;
    // keep if any cell has content
    return Object.values(r).some((v) => String(v ?? "").trim() !== "");
  });
}
