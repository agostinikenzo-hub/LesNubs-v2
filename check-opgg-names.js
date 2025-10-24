// check-opgg-names.js
import axios from "axios";

const TEAM = [
  "Amazing Cholo",
  "YungSweeneyEUW",
  "BetzhamoEUW",
  "denotesEUW",
  "BurningelfEUW",
  "UnbreakableHaideEUW"
];

async function main() {
  const region = "euw";
  for (const name of TEAM) {
    const url = `https://www.op.gg/api/v1.0/internal/bypass/summoner/name=${encodeURIComponent(name)}?region=${region}`;
    try {
      const res = await axios.get(url);
      const data = res.data.data;
      console.log(`${name} → ${data?.summoner_name || "NOT FOUND"}`);
    } catch (e) {
      console.log(`${name} → ERROR: ${e.message}`);
    }
  }
}

main();
