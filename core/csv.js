export async function fetchCsvText(url, { signal } = {}) {
  const res = await fetch(url, { cache: "no-store", signal });
  if (!res.ok) throw new Error(`CSV fetch failed (${res.status})`);
  return await res.text();
}

export function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // BOM

  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        const next = text[i + 1];
        if (next === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') { inQuotes = true; continue; }
    if (c === ",") { row.push(field); field = ""; continue; }
    if (c === "\n") { row.push(field); field = ""; rows.push(row); row = []; continue; }
    if (c === "\r") continue;

    field += c;
  }

  row.push(field);
  rows.push(row);

  while (rows.length && rows[rows.length - 1].every((x) => (x ?? "").trim() === "")) rows.pop();
  return rows;
}

export function rowsToObjects(rows) {
  if (!rows.length) return [];
  const headers = rows[0].map((h) => (h ?? "").trim());
  const out = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const obj = {};
    for (let j = 0; j < headers.length; j++) obj[headers[j]] = r[j] ?? "";
    out.push(obj);
  }
  return out;
}
