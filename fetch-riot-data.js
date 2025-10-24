// fetch-riot-data.js
import axios from "axios";
import { google } from "googleapis";

// --- ENV ---
const GOOGLE_CREDENTIALS = process.env.GOOGLE_CREDENTIALS;
const SHEET_ID = process.env.SHEET_ID;
const SHEET_NAME = "Game_logs";

// --- TEAM ---
const TEAM = [
  { name: "JANSEN", summoner: "Amazing Cholo" },
  { name: "SWEENEY", summoner: "YungSweeneyEUW" },
  { name: "BENZ", summoner: "BetzhamoEUW" },
  { name: "OTA", summoner: "denotesEUW" },
  { name: "ACHTEN", summoner: "BurningelfEUW" },
  { name: "HH", summoner: "UnbreakableHaideEUW" },
];

// --- GOOGLE SHEETS SETUP ---
async function getSheets() {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(GOOGLE_CREDENTIALS),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

// --- FETCH OP.GG DATA ---
async function fetchOpggMatches(summonerName) {
  const region = "euw";
  const infoUrl = `https://www.op.gg/api/v1.0/internal/bypass/summoner/name=${encodeURIComponent(
    summonerName
  )}?region=${region}`;
  const infoRes = await axios.get(infoUrl);
  const summoner = infoRes.data.data;
  if (!summoner?.summoner_id) return [];

  const matchesUrl = `https://www.op.gg/api/v1.0/internal/bypass/games/summoner/${summoner.summoner_id}?limit=2&region=${region}`;
  const matchesRes = await axios.get(matchesUrl);
  return matchesRes.data.data?.games || [];
}

// --- MAIN ---
async function main() {
  const sheets = await getSheets();

  // 1️⃣ Load existing rows and IDs
  const existingRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A2:A`,
  });
  const existingValues = existingRes.data.values || [];
  const existingIds = new Set(existingValues.flat());

  // Determine next Game #
  const lastGameNumber = existingValues.length > 0 ? parseInt(existingValues.at(-1)[0]) || 0 : 0;
  let nextGameNumber = lastGameNumber;

  // 2️⃣ Prepare constants
  const season = 25;
  const split = 3;
  let allRows = [];

  // Normalize helper
  const normalize = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, "");

  for (const player of TEAM) {
    const summonerName = player.summoner;
    const matches = await fetchOpggMatches(summonerName);

    for (const g of matches) {
      const game = g.data;
      if (!game) continue;

      // Only ranked flex
      if (game.queue_info?.queue_translate !== "Ranked Flex 5v5") continue;

      const participants = game.participants || [];
      const teamPlayers = participants.map((p) => normalize(p.summoner_name));

      // Find which of our players are in the match
      const matchedPlayers = TEAM.filter((t) =>
        teamPlayers.includes(normalize(t.summoner))
      ).map((t) => t.name);

      if (matchedPlayers.length < 5) {
        console.log(
          `⏭️ Skipping match ${game.game_id}: only ${matchedPlayers.length} LesNübs found (${matchedPlayers.join(", ")})`
        );
        continue;
      }

      const matchId = String(game.game_id);
      if (existingIds.has(matchId)) {
        console.log(`🔁 Skipping duplicate match ${matchId}`);
        continue;
      }

      // Increment game number once per match
      nextGameNumber++;
      console.log(
        `✅ Match ${matchId} → Game #${nextGameNumber}: ${matchedPlayers.length} LesNübs detected (${matchedPlayers.join(", ")})`
      );

      // Add one row per participant from our team
      for (const t of TEAM.filter((tm) => matchedPlayers.includes(tm.name))) {
        const participant = participants.find(
          (p) => normalize(p.summoner_name) === normalize(t.summoner)
        );
        if (!participant) continue;

        const date = new Date(game.created_at).toISOString();
        const win = game.is_win ? "Win" : "Loss";
        const k = participant.stats?.kill || 0;
        const d = participant.stats?.death || 0;
        const a = participant.stats?.assist || 0;
        const kp = participant.stats?.contribution_for_kill_rate
          ? Math.round(participant.stats.contribution_for_kill_rate * 100)
          : "";
        const score = participant.stats?.op_score || "";
        const kda = d === 0 ? (k + a).toFixed(2) : ((k + a) / d).toFixed(2);
        const duration = `${Math.floor(game.game_length / 60)}m ${game.game_length % 60}s`;
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

  // 🧮 Find first empty row
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

  console.log(`✅ Added ${allRows.length} new rows (Games #${nextGameNumber - 1}–${nextGameNumber}).`);
}

main().catch((e) => console.error("❌ Script failed:", e.message));
