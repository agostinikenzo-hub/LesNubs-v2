// /core/ddragon.js
let versionPromise = null;
let champMapPromise = null;

function norm(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: "force-cache" });
  if (!res.ok) throw new Error(`Fetch failed: ${url} (${res.status})`);
  return res.json();
}

export async function getLatestDDragonVersion() {
  if (versionPromise) return versionPromise;

  versionPromise = (async () => {
    const key = "s26_ddragon_ver";
    const cached = localStorage.getItem(key);
    if (cached) return cached;

    const versions = await fetchJson("https://ddragon.leagueoflegends.com/api/versions.json");
    const latest = versions?.[0];
    if (latest) localStorage.setItem(key, latest);
    return latest || "latest";
  })();

  return versionPromise;
}

export async function getChampionIdMap() {
  if (champMapPromise) return champMapPromise;

  champMapPromise = (async () => {
    const ver = await getLatestDDragonVersion();
    const json = await fetchJson(`https://ddragon.leagueoflegends.com/cdn/${ver}/data/en_US/champion.json`);
    const data = json?.data || {};
    const map = new Map();

    for (const key of Object.keys(data)) {
      const champ = data[key];
      // champ.id is the filename key (e.g., "ChoGath" is actually "Chogath" in DDragon — this handles it)
      map.set(norm(champ.name), champ.id);
      map.set(norm(champ.id), champ.id);
    }

    return { ver, map };
  })();

  return champMapPromise;
}

export async function championSquareUrl(champName) {
  const { ver, map } = await getChampionIdMap();
  const key = map.get(norm(champName)) || String(champName || "").replace(/\s+/g, "");
  return `https://ddragon.leagueoflegends.com/cdn/${ver}/img/champion/${key}.png`;
}
