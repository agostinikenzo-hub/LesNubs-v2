// fetch-riot-data.js
import axios from "axios";
import { google } from "googleapis";

// --- ENV ---
const GOOGLE_CREDENTIALS = process.env.GOOGLE_CREDENTIALS;
const SHEET_ID = process.env.SHEET_ID;
const SHEET_NAME = "Game_logs";

// --- TEAM (update if needed based on diagnostic results) ---
const TEAM = [
  { name: "JANSEN", summoner: "Amazing Cholo" },
  { name: "SWEENEY", summoner: "YungSweeney" },
  { name: "BENZ", summoner: "Betzhamo" },
  { name: "OTA", summoner: "denotes" },
  { name: "ACHTEN", summoner: "BurningElf" },
  { name: "HH", summoner: "Unbreakable Haide" },
];

// --- GOOGLE SHEETS SETUP ---
async function getSheets() {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(GOOGLE_CREDENTIALS),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

// --- FETCH OP.GG MATCHES (new API path) ---
async function fetchOpggMatches(summonerName) {
  const region = "euw";

  try {
    // Get summoner info (new public API)
    const infoUrl = `https://www.op.gg/api/v1.0/summoners/${region}/${encodeURIComponent(
      summonerName
    )}`;
    const infoRes = await axios.get(infoUrl);
    const summoner = infoRes.data.data || infoRes.data;

    if (!summoner?.summoner_id && !summoner?.id) {
      console.warn(`⚠️ Could not find summoner ID for ${summonerName}`);
      return [];
    }

    const summonerId = summoner.summoner_id || summoner.id;

    // Get matches (2 most recent)
    const matchesUrl = `https://www.op.gg/api/v1.0/games/${region}/summoners/${summonerId}?limit=2`;
    const matchesRes = await axios.get(matchesUrl);

    return matchesRes.data?.data?.games || [];
  } catch (err) {
    console.error(`❌ Error fetching matches for ${summonerName}:`, err.message);
    return [];
  }
}

// --- MAIN FUNCTION ---
async function main() {
  const sheets = await getSheets();

  // 1️⃣ Load existing IDs to avoid duplicates
  const existingRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A2:A`,
  });
  const existingValues = existingRes.data.values || [];
  const existingIds = new Set(existingValues.flat());

  // Determine last Game #
  const lastGameNumber =
    existingValues.length > 0 ? parseInt(existingValues.at(-1)[0]) || 0 : 0;
  let nextGameNumber = lastGameNumber;

  const season = 25;
  const split = 3;
  const normalize = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, "");
  let allRows = [];

  for (const player of TEAM) {
    const summonerName = player.summoner;
    const matches = await fetchOpggMatches(summonerName);

    for (const g of matches) {
      const game = g.data || g;
      if (!game) continue;

      // Only ranked flex
      if (game.queue_info?.queue_translate !== "Ranked Flex 5v5") continue;

      const participants = game.participants || [];
      const teamPlayers = participants.map((p) => normalize(p.summoner_name));

      // Detect team members in match
      const matchedPlayers = TEAM.filter((t) =>
        teamPlayers.includes(normalize(t.summoner))
      ).map((t) => t.name);

      if (matchedPlayers.length < 5) {
        console.log(
          `⏭️ Skipping match ${game.id || game.game_id}: only ${matchedPlayers.length} LesNübs found (${matchedPlayers.join(
            ", "
          )})`
        );
        continue;
      }

      const matchId = String(game.id || game.game_id);
      if (existingIds.has(matchId)) {
        console.log(`🔁 Skipping duplicate match ${matchId}`);
        continue;
      }

      // New match found
      nextGameNumber++;
      console.log(
        `✅ Match ${matchId} → Game #${nextGameNumber}: ${matchedPlayers.length} LesNübs detected (${matchedPlayers.join(
          ", "
        )})`
      );

      // Add a row per LesNübs participant
      for (const t of TEAM.filter((tm) => matchedPlayers.includes(tm.name))) {
        const participant = participants.find(
          (p) => normalize(p.summoner_name) === normalize(t.summoner)
        );
        if (!participant) continue;

        const date = new Date(game.created_at).toISOString();
        const win = participant.stats?.result === "WIN" || participant.is_win ? "Win" : "Loss";
        const k = participant.stats?.kill || 0;
        const d = participant.stats?.death || 0;
        const a = participant.stats?.assist || 0;
        const kp = participant.stats?.contribution_for_kill_rate
          ? Math.round(participant.stats.contribution_for_kill_rate * 100)
          : "";
        const score = participant.stats?.op_score || "";
        const kda = d === 0 ? (k + a).toFixed(2) : ((k + a) / d).toFixed(2);
        const duration = `${Math.floor(game.game_length / 60)}m ${
          game.game_length % 60
        }s`;
        const role = participant.position_info?.position || "";
        const champ = participant.champion_info?.name || "";
        const cs = participant.stats?.cs || "";

        const row = [
          nextGameNumber, // Game #
          date,
          "LesNübs",
          season,
          split,
          t.name,
          win,
          k,
          d,
          a,
          "", // MVP manual
          "", // ACE manual
          kp,
          score,
          kda,
          duration,
          participant.stats?.vision_ward_buy || "",
          participant.stats?.ward_placed || "",
          participant.stats?.ward_kill || "",
          role,
          champ,
          cs,
        ];

        allRows.push(row);
      }

      existingIds.add(matchId);
    }
  }

  if (allRows.length === 0) {
    console.log("✅ No new qualifying matches found.");
    return;
  }

  // 🧮 Find next free row (below header)
  const currentData = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A:A`,
  });
  const lastRow = (currentData.data.values?.length || 0) + 1;
  const targetRange = `${SHEET_NAME}!A${lastRow}`;

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: targetRange,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: allRows },
  });

  console.log(
    `✅ Added ${allRows.length} new rows (Games #${nextGameNumber - (allRows.length / 5) + 1}–${nextGameNumber}).`
  );
}

main().catch((e) => console.error("❌ Script failed:", e.message));
