import { config } from "dotenv";

config({ path: ".env.local" });

const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const CRON_SECRET = process.env.CRON_SECRET;

if (!CRON_SECRET) {
  console.error("Missing CRON_SECRET in .env.local");
  process.exit(1);
}

const dryRun = process.argv.includes("--dry-run");
const url = `${BASE_URL}/api/cron/event-reminders${dryRun ? "?dryRun=true" : ""}`;

const response = await fetch(url, {
  headers: { Authorization: `Bearer ${CRON_SECRET}` },
});

const body = await response.text();
let parsed;
try {
  parsed = JSON.parse(body);
} catch {
  parsed = body;
}

console.log(JSON.stringify(parsed, null, 2));

if (!response.ok) {
  process.exit(1);
}
