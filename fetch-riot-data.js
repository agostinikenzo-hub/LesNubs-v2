// fetch-riot-data.js
import axios from "axios";
import { google } from "googleapis";

// 🔑 ENVIRONMENT VARIABLES (set in GitHub Secrets)
const RIOT_API_KEY = process.env.RIOT_API_KEY;
const GOOGLE_CREDENTIALS = process.env.GOOGLE_CREDENTIALS;

// 📊 Google Sheet Info
const SHEET_ID = "15d-e7-S8A5p_uhAcHMaU2dCZc-csmZ7GJK9sd0iay8U";
const SHEET_NAME = "Game_logs";

// 👥 Team Setup
const TEAM = [
  { name: "JANSEN", summoner: "AmazingCholoEUW" },
  { name: "SWEENEY", summoner: "YungSweeneyEUW" },
  { name: "BENZ", summoner: "BetzhamoEUW" },
  { name: "OTA", summoner: "denotesEUW" },
  { name: "ACHTEN", summoner: "BurningelfEUW" },
  { name: "HH", summoner: "UnbreakableHaideEUW" }
];

// 🌍 Riot API Config
const REGION_ROUTING = "europe";  // for match-v5
const PLATFORM_ROUTING = "euw1";  // for summoner-v4
const SEASON = 25;
const SPLIT = "3"; // manually set or computed later

// --- Authenticate Google Sheets ---
async function getSheets() {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(GOOGLE_CREDENTIALS),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });
  return google.sheets({ version: "v4", auth });
}

// --- Helper: Avoid duplicates ---
async function getLoggedMatchIds(sheets) {
  const range = `${SHEET_NAME}!P2:P`; // assuming column P = matchId
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range
    });
    return new Set(res.data.values?.flat() || []);
  } catch (err) {
    console.warn("No existing match IDs found.");
    return new Set();
  }
}

// --- Get Riot data ---
async function fetchMatchDataForPlayer(puuid) {
  const matchIdsUrl = `https://${REGION_ROUTING}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=10&api_key=${RIOT_API_KEY}`;
  const ids = (await axios.get(matchIdsUrl)).data;
  const matchData = [];

  for (const matchId of ids) {
    const url = `https://${REGION_ROUTING}.api.riotgames.com/lol/match/v5/matches/${matchId}?api_key=${RIOT_API_KEY}`;
    try {
      const res = await axios.get(url);
      matchData.push(res.data);
    } catch (err) {
      console.error(`❌ Error fetching match ${matchId}:`, err.message);
    }
  }
  return matchData;
}

// --- Main Function ---
async function main() {
  const sheets = await getSheets();
  const loggedMatches = await getLoggedMatchIds(sheets);
  const allNewRows = [];

  for (const player of TEAM) {
    try {
      const summonerRes = await axios.get(
        `https://${PLATFORM_ROUTING}.api.riotgames.com/lol/summoner/v4/summoners/by-name/${encodeURIComponent(player.summoner)}?api_key=${RIOT_API_KEY}`
      );
      const puuid = summonerRes.data.puuid;

      const matches = await fetchMatchDataForPlayer(puuid);
      for (const match of matches) {
        const matchId = match.metadata.matchId;
        if (loggedMatches.has(matchId)) continue;
        if (match.info.queueId !== 440) continue; // only ranked flex

        const gameTime = `${Math.floor(match.info.gameDuration / 60)}m ${match.info.gameDuration % 60}s`;
        const date = new Date(match.info.gameStartTimestamp);
        const participant = match.info.participants.find(p => p.puuid === puuid);

        if (!participant) continue;

        // check if ≥5 LesNübs played in the same game
        const teamPlayers = match.info.participants.filter(p =>
          TEAM.some(t => t.summoner.toLowerCase() === p.summonerName.toLowerCase())
        );
        if (teamPlayers.length < 5) continue;

        const row = [
          matchId,
          date.toISOString(),
          "LesNübs",
          SEASON,
          SPLIT,
          player.name,
          participant.win ? "yes" : "no",
          participant.kills,
          participant.deaths,
          participant.assists,
          "", // MVP manual
          "", // ACE manual
          participant.challenges?.killParticipation
            ? Math.round(participant.challenges.killParticipation * 100)
            : "",
          participant.challenges?.kdaScore || "",
          participant.deaths === 0
            ? (participant.kills + participant.assists).toFixed(2)
            : ((participant.kills + participant.assists) / participant.deaths).toFixed(2),
          gameTime
        ];

        allNewRows.push(row);
      }
    } catch (err) {
      console.error(`⚠️ Error fetching data for ${player.summoner}: ${err.message}`);
    }
  }

  if (allNewRows.length === 0) {
    console.log("✅ No new matches found.");
    return;
  }

  // Append to Google Sheet
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: allNewRows
    }
  });

  console.log(`✅ Added ${allNewRows.length} new rows to Google Sheets.`);
}

main().catch(err => console.error("❌ Script failed:", err));
