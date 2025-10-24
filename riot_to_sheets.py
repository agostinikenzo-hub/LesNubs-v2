import os
import json
import requests
import gspread
import subprocess
from google.oauth2.service_account import Credentials

print("🔍 Checking connections...")

# --- Load Environment Variables ---
RIOT_API_KEY = os.getenv("RIOT_API_KEY")
SHEET_ID = os.getenv("SHEET_ID")
GOOGLE_CREDENTIALS = os.getenv("GOOGLE_CREDENTIALS")

# --- Environment Diagnostics ---
print("🌐 Environment check:")
print("  RIOT_API_KEY present:", bool(RIOT_API_KEY))
print("  SHEET_ID present:", bool(SHEET_ID))
print("  GOOGLE_CREDENTIALS present:", bool(GOOGLE_CREDENTIALS))

# Warn if something is missing
if not RIOT_API_KEY:
    print("❌ Missing RIOT_API_KEY. Check your GitHub Secrets.")
if not SHEET_ID:
    print("❌ Missing SHEET_ID. Check your GitHub Secrets.")
if not GOOGLE_CREDENTIALS:
    print("❌ Missing GOOGLE_CREDENTIALS. Check your GitHub Secrets.")

# --- 1️⃣ Test Riot API Connection ---
def test_riot_api():
    if not RIOT_API_KEY:
        print("⚠️ Skipping Riot API test: no API key found.")
        return False

    try:
        region = "euw1"
        summoner_name = "Betzhamo"
        url = f"https://{region}.api.riotgames.com/lol/summoner/v4/summoners/by-name/{summoner_name}"
        headers = {"X-Riot-Token": RIOT_API_KEY}

        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code == 200:
            summoner = response.json()["name"]
            print(f"✅ Riot API connected! Summoner found: {summoner}")
            return True
        else:
            print(f"⚠️ Riot API connection failed: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print("❌ Riot API test failed:", e)
        return False

# --- 2️⃣ Test Google Sheets Connection ---
def test_google_sheets():
    if not GOOGLE_CREDENTIALS or not SHEET_ID:
        print("⚠️ Skipping Google Sheets test: credentials or sheet ID missing.")
        return False

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
        ws.update(values=[["✅ Test Connection Successful!"]], range_name="A1:A1")
        print("🟢 Test value written to A1")
        return True
    except Exception as e:
        print("❌ Google Sheets test failed:", e)
        return False

# --- 3️⃣ Run Node Script to Fetch Riot Data ---
def run_node_script():
    print("🚀 Running fetch-riot-data.js...")
    env = os.environ.copy()
    result = subprocess.run(
        ["node", "fetch-riot-data.js"],
        capture_output=True,
        text=True,
        env=env
    )

    if result.returncode != 0:
        print("❌ Node script failed:")
        print(result.stderr)
    else:
        print("✅ Node script executed successfully.")
        print(result.stdout)

# --- MAIN EXECUTION ---
if __name__ == "__main__":
    riot_ok = test_riot_api()
    sheets_ok = test_google_sheets()

    if riot_ok and sheets_ok:
        run_node_script()
    else:
        print("⚠️ Skipping data fetch due to failed connection(s).")
