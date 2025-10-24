import os
import json
import gspread
import subprocess
from google.oauth2.service_account import Credentials

print("🔍 Checking Google Sheets connection...")

GOOGLE_CREDENTIALS = os.getenv("GOOGLE_CREDENTIALS")
SHEET_ID = os.getenv("SHEET_ID")

try:
    creds_info = json.loads(GOOGLE_CREDENTIALS)
    creds = Credentials.from_service_account_info(
        creds_info,
        scopes=["https://www.googleapis.com/auth/spreadsheets"]
    )
    gc = gspread.authorize(creds)
    sheet = gc.open_by_key(SHEET_ID)
    ws = sheet.sheet1
    print(f"✅ Connected to Google Sheet: {ws.title}")
except Exception as e:
    print("❌ Google Sheets connection failed:", e)
    exit(1)

print("🚀 Running OP.GG → Sheets sync...")
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
