// fetch-riot-data.js
import axios from "axios";
import { google } from "googleapis";

// --- ENV ---
const GOOGLE_CREDENTIALS = process.env.GOOGLE_CREDENTIALS;
const SHEET_ID = process.env.SHEET_ID;
const SHEET_NAME = "Game_logs"; // make sure this matches your actual sheet/tab name

// --- TEAM ---
const TEAM = [
  { name: "JANSEN", summoner: "AmazingCholoEUW" },
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

  // 1️⃣ Load existing match IDs to avoid duplicates
  const existingIdsRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A2:A`,
  });
  const existingIds = new Set(existingIdsRes.data.values?.flat() || []);

  // 2️⃣ Get last used Game # from sheet
  const lastGameNumber = existingIds.size;

  let allRows = [];
  const region = "euw";
  const season = 25;
  const split = 3;

  for (const player of TEAM) {
    const summonerName = player.summoner.replace("EUW", "");
    const matches = await fetchOpggMatches(summonerName);

    for (const g of matches) {
      const game = g.data;
      if (!game) continue;

      // Only ranked flex (queueId 440)
      if (game.queue_info?.queue_translate !== "Ranked Flex 5v5") continue;

      // Collect players in match
      const teamPlayers = game.participants.map((p) => p.summoner_name.toLowerCase());
      const teamCount = TEAM.filter((t) =>
        teamPlayers.includes(t.summoner.toLowerCase().replace("euw", ""))
      ).length;

      if (teamCount < 5) continue; // skip if fewer than 5 team members

      const matchId = String(game.game_id);
      if (existingIds.has(matchId)) continue; // skip duplicates

      const participant = game.participants.find(
        (p) => p.summoner_name.toLowerCase() === summonerName.toLowerCase()
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
        matchId, // Game #
        date, // Date
        "LesNübs", // Team
        season,
        split,
        player.name,
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
      existingIds.add(matchId);
    }
  }

  if (allRows.length === 0) {
    console.log("✅ No new qualifying matches found.");
    return;
  }

  // 3️⃣ Append rows to the bottom (preserve existing data)
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A1`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: allRows },
  });

  console.log(`✅ Added ${allRows.length} new matches to Google Sheets.`);
}

main().catch((e) => console.error("❌ Script failed:", e.message));
