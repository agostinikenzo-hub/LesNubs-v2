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

# --- 1️⃣ Test Riot API Connection ---
def test_riot_api():
    try:
        region = "euw1"  # change if using another platform
        summoner_name = "Betzhamo"
        url = f"https://{region}.api.riotgames.com/lol/summoner/v4/summoners/by-name/{summoner_name}"
        headers = {"X-Riot-Token": RIOT_API_KEY}

        response = requests.get(url, headers=headers)
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
    env = os.environ.copy()  # ensures all secrets are passed to
