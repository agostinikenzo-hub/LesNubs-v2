// /core/queues.js

export const QUEUES = {
  solo: {
    id: 420,
    key: "solo",
    label: "Solo/Duo",
    csvUrl:
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vSbxcPDjBBWSe4jIwXuQe-_o5C1RGg067CxU4g_j1yqG8D3DAj8BFqvwKuLopePRuUWv7qE5bmEPuLZ/pub?gid=2079220094&single=true&output=csv",
  },

  // Team (5-stack) — tab gid=0 (you pasted this)
  // NOTE: If later you need a second tab (e.g. match-level), add csvUrl2 here.
  team: {
    id: 440, // informational; may not be present in sheet rows
    key: "team",
    label: "Team (5-stack)",
    csvUrl:
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vSbxcPDjBBWSe4jIwXuQe-_o5C1RGg067CxU4g_j1yqG8D3DAj8BFqvwKuLopePRuUWv7qE5bmEPuLZ/pub?gid=0&single=true&output=csv",
  },

  // later:
  // otherflex: { id: 440, key: "otherflex", label: "Other Flex (1–4)", csvUrl: "..." },
};

export function getQueue(key) {
  return QUEUES[key] ?? null;
}
