import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { needsChineseTranslation } from "./language";
import type { FeedEvent } from "./types";

type Translation = { text: string; provider: string; at: number };
type TranslationState = {
  cache: Map<string, Translation>;
  pending: Map<string, Promise<Translation | undefined>>;
  failed: Map<string, number>;
  active: number;
  waiters: Array<() => void>;
  blockedUntil: number;
  initialized?: Promise<void>;
  saving?: Promise<void>;
};
const globals = globalThis as typeof globalThis & { stormeyeTranslations?: TranslationState };
const state: TranslationState = globals.stormeyeTranslations ??= {
  cache: new Map(), pending: new Map(), failed: new Map(), active: 0, waiters: [], blockedUntil: 0,
};
const directory = process.env.STORMEYE_DATA_DIR ?? path.join(process.env.VERCEL ? os.tmpdir() : process.cwd(), ".stormeye");
const cachePath = path.join(directory, "translations.json");
const keyFor = (value: string) => createHash("sha256").update(`zh-CN:v1:${value}`).digest("hex");

export async function initializeTranslations() {
  state.initialized ??= (async () => {
    try {
      const saved = JSON.parse(await readFile(cachePath, "utf8"));
      for (const [key, item] of Object.entries(saved) as [string, Translation][]) {
        if (typeof item.text === "string" && /[\u3400-\u9fff]/.test(item.text) && Date.now() - item.at < 30 * 86400_000) {
          state.cache.set(key, item);
        }
      }
    } catch { /* Cache is optional on the first run. */ }
  })();
  await state.initialized;
}

async function persistTranslations() {
  state.saving = (state.saving ?? Promise.resolve()).then(async () => {
    const entries = [...state.cache.entries()].sort((a, b) => b[1].at - a[1].at).slice(0, 5000);
    await mkdir(directory, { recursive: true });
    const temporary = `${cachePath}.${process.pid}.tmp`;
    await writeFile(temporary, JSON.stringify(Object.fromEntries(entries)), "utf8");
    await rename(temporary, cachePath);
  }).catch(() => { /* A read-only filesystem does not prevent in-memory caching. */ });
  await state.saving;
}

export function splitTranslationText(value: string): string[] {
  const chunks: string[] = [];
  let current = "";
  for (const word of value.match(/\S+\s*/gu) ?? []) {
    if (Buffer.byteLength(current + word) <= 480) { current += word; continue; }
    if (current) chunks.push(current.trim());
    current = "";
    for (const char of word) {
      if (Buffer.byteLength(current + char) > 480) { chunks.push(current.trim()); current = ""; }
      current += char;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

async function requestTranslation(value: string): Promise<Translation> {
  if (state.blockedUntil > Date.now()) throw new Error("Translation quota reached");
  const customEndpoint = process.env.STORMEYE_TRANSLATE_URL;
  const translations: string[] = [];
  for (const chunk of splitTranslationText(value)) {
    if (state.blockedUntil > Date.now()) throw new Error("Translation quota reached");
    let translated = "";
    if (customEndpoint) {
      const response = await fetch(customEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: chunk, source: "en", target: "zh", format: "text", ...(process.env.STORMEYE_TRANSLATE_KEY ? { api_key: process.env.STORMEYE_TRANSLATE_KEY } : {}) }),
        signal: AbortSignal.timeout(10000),
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Translation unavailable");
      const data = await response.json();
      translated = data.translatedText;
    } else {
      const url = new URL("https://api.mymemory.translated.net/get");
      url.searchParams.set("q", chunk);
      url.searchParams.set("langpair", "en|zh-CN");
      if (process.env.STORMEYE_TRANSLATE_EMAIL) url.searchParams.set("de", process.env.STORMEYE_TRANSLATE_EMAIL);
      const response = await fetch(url, { signal: AbortSignal.timeout(10000), cache: "no-store" });
      if (response.status === 429) {
        state.blockedUntil = Date.now() + 3600_000;
        throw new Error("Translation quota reached");
      }
      if (!response.ok) throw new Error("Translation unavailable");
      const data = await response.json();
      if (data.quotaFinished || Number(data.responseStatus) === 429) {
        state.blockedUntil = Date.now() + 24 * 3600_000;
        throw new Error("Translation quota reached");
      }
      if (Number(data.responseStatus) !== 200) throw new Error("Translation unavailable");
      translated = data.responseData?.translatedText;
    }
    if (typeof translated !== "string" || !translated.trim() || translated.length > 5000) throw new Error("Invalid translation");
    translations.push(translated.trim());
  }
  const result = translations.join(" ");
  if (!/[\u3400-\u9fff]/.test(result) || result === value) throw new Error("No Chinese translation");
  return { text: result, provider: customEndpoint ? "LibreTranslate" : "MyMemory", at: Date.now() };
}

async function translateText(value: string): Promise<Translation | undefined> {
  if (!needsChineseTranslation(value)) return undefined;
  const key = keyFor(value);
  const cached = state.cache.get(key);
  if (cached) return cached;
  if ((state.failed.get(key) ?? 0) > Date.now()) return undefined;
  const pending = state.pending.get(key);
  if (pending) return pending;
  const task = (async () => {
    if (state.active >= 4) await new Promise<void>((resolve) => state.waiters.push(resolve));
    else state.active += 1;
    try {
      const translated = await requestTranslation(value);
      state.cache.set(key, translated);
      return translated;
    } catch {
      state.failed.set(key, Date.now() + 5 * 60_000);
      return undefined;
    } finally {
      const next = state.waiters.shift();
      if (next) next(); else state.active -= 1;
    }
  })();
  state.pending.set(key, task);
  try { return await task; } finally { state.pending.delete(key); }
}

export function cachedTranslations(event: FeedEvent): FeedEvent {
  const title = event.sourceType !== "代码" ? state.cache.get(keyFor(event.title)) : undefined;
  const summary = state.cache.get(keyFor(event.summary));
  return {
    ...event,
    titleZh: title?.text ?? event.titleZh,
    summaryZh: summary?.text ?? event.summaryZh,
    translationProvider: title?.provider ?? summary?.provider ?? event.translationProvider,
  };
}

export async function translateEvents(events: FeedEvent[]): Promise<FeedEvent[]> {
  await initializeTranslations();
  const results = await Promise.all(events.map(async (event) => {
    const titleNeeded = event.sourceType !== "代码" && needsChineseTranslation(event.title);
    const summaryNeeded = needsChineseTranslation(event.summary);
    const [title, summary] = await Promise.all([
      titleNeeded ? translateText(event.title) : undefined,
      summaryNeeded ? translateText(event.summary) : undefined,
    ]);
    const complete = (!titleNeeded || title) && (!summaryNeeded || summary);
    return {
      ...event,
      titleZh: title?.text,
      summaryZh: summary?.text,
      translationProvider: title?.provider ?? summary?.provider,
      translationStatus: complete ? "ready" as const : title || summary ? "partial" as const : "unavailable" as const,
    };
  }));
  await persistTranslations();
  return results;
}
