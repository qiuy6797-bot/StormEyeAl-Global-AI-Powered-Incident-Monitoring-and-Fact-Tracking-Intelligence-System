import { mkdir, writeFile } from "node:fs/promises";

const url = process.env.PAGES_SNAPSHOT_URL;

if (!url) {
  console.log("No previous Pages snapshot configured.");
  process.exit(0);
}

try {
  const response = await fetch(url, {
    headers: { "User-Agent": "StormEyeAI-GitHub-Pages-Build" },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data.events) || !data.events.length || !Array.isArray(data.sourceHealth) || !data.checkedAt) {
    throw new Error("Invalid snapshot format");
  }
  await mkdir(".stormeye", { recursive: true });
  await writeFile(".stormeye/feeds.json", JSON.stringify({ version: 1, data }), "utf8");
  console.log(`Restored ${data.events.length} events from the previous Pages snapshot.`);
} catch (error) {
  console.log(`Previous Pages snapshot unavailable: ${error instanceof Error ? error.message : "unknown error"}`);
}
