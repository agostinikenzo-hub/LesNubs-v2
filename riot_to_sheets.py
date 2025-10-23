import os
import json
import requests
import gspread
from google.oauth2.service_account import Credentials

# --- Load Environment Variables ---
RIOT_API_KEY = os.getenv("RIOT_API_KEY")
SHEET_ID = os.getenv("SHEET_ID")
GOOGLE_CREDENTIALS = os.getenv("GOOGLE_CREDENTIALS")

print("🔍 Checking connections...")

# --- 1️⃣ Riot API Test ---
try:
    region = "euw1"  # or your region
    summoner_name = "Betzhamo"
    url = f"https://{region}.api.riotgames.com/lol/summoner/v4/summoners/by-name/{summoner_name}"
    headers = {"X-Riot-Token": RIOT_API_KEY}

    response = requests.get(url, headers=headers)
    if response.status_code == 200:
        print(f"✅ Riot API connected! Summoner found: {response.json()['name']}")
    else:
        print(f"⚠️ Riot API connection failed: {response.status_code} - {response.text}")
except Exception as e:
    print("❌ Riot API test failed:", e)

# --- 2️⃣ Google Sheets Test ---
try:
    creds_info = json.loads(GOOGLE_CREDENTIALS)
    creds = Credentials.from_service_account_info(
        creds_info,
        scopes=["https://www.googleapis.com/auth/spreadsheets"]
    )

    gc = gspread.authorize(creds)
    sheet = gc.open_by_key(SHEET_ID)
    ws = sheet.sheet1

    print(f"✅ Google Sheets connected! Sheet title: {ws.title}")
    ws.update("A1:A1", [["✅ Test Connection Successful!"]])
    print("🟢 Test value written to A1")

except Exception as e:
    print("❌ Google Sheets test failed:", e)
