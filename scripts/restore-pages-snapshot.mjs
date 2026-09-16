import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const url = process.env.PAGES_SNAPSHOT_URL;
const bundledPath = "data/feeds.snapshot.json";

function readSnapshot(value) {
  try {
    const saved = typeof value === "string" ? JSON.parse(value) : value;
    if (!saved || typeof saved !== "object") return undefined;
    const data = saved.version === 1 ? saved.data : saved;
    if (!data || !Array.isArray(data.events) || !data.events.length || !Array.isArray(data.sourceHealth) || !data.checkedAt) return undefined;
    return data;
  } catch {
    return undefined;
  }
}

function translationEntries(data) {
  const entries = {};
  for (const event of data?.events ?? []) {
    for (const [original, translated] of [[event.title, event.titleZh], [event.summary, event.summaryZh]]) {
      if (typeof original !== "string" || typeof translated !== "string" || !translated.trim()) continue;
      const key = createHash("sha256").update(`zh-CN:v1:${original}`).digest("hex");
      entries[key] = { text: translated, provider: event.translationProvider ?? "snapshot", at: Date.now() };
    }
  }
  return entries;
}

const bundled = readSnapshot(await readFile(bundledPath, "utf8").catch(() => ""));
let restored = bundled;

if (url) {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "StormEyeAI-GitHub-Pages-Build" },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = readSnapshot(await response.json());
    if (!data) throw new Error("Invalid snapshot format");
    restored = data;
    await mkdir(".stormeye", { recursive: true });
    await writeFile(".stormeye/feeds.json", JSON.stringify({ version: 1, data }), "utf8");
    console.log(`Restored ${data.events.length} events from the previous Pages snapshot.`);
  } catch (error) {
    console.log(`Previous Pages snapshot unavailable: ${error instanceof Error ? error.message : "unknown error"}`);
  }
} else {
  console.log("No previous Pages snapshot configured; using the bundled snapshot when available.");
}

const existing = JSON.parse(await readFile(".stormeye/translations.json", "utf8").catch(() => "{}"));
const cache = { ...existing, ...translationEntries(bundled), ...translationEntries(restored) };
if (Object.keys(cache).length) {
  await mkdir(".stormeye", { recursive: true });
  await writeFile(".stormeye/translations.json", JSON.stringify(cache), "utf8");
  console.log(`Restored ${Object.keys(cache).length} cached translations from available snapshots.`);
}
