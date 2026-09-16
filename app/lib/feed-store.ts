import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { dailyBoundary } from "./config";
import { deduplicateEvents, liveEvents, relativeTime } from "./feeds";
import { seedSourceHealth } from "./seed";
import { initialSourceHealth, sourceCatalogVersion } from "./sources";
import { cachedTranslations, initializeTranslations } from "./translate";
import type { FeedResponse } from "./types";

type StoreState = {
  snapshot?: FeedResponse;
  initialized?: Promise<void>;
  pending?: Promise<FeedResponse>;
};

const globalStore = globalThis as typeof globalThis & { stormeyeFeedStore?: StoreState };
const state = globalStore.stormeyeFeedStore ??= {};
const dataDirectory = process.env.STORMEYE_DATA_DIR ?? path.join(process.env.VERCEL ? os.tmpdir() : process.cwd(), ".stormeye");
const cachePath = path.join(dataDirectory, "feeds.json");
const bundledSnapshotPath = path.join(process.cwd(), "data", "feeds.snapshot.json");

function isValidSnapshot(value: unknown): value is { version: 1; data: FeedResponse } {
  if (!value || typeof value !== "object") return false;
  const saved = value as { version?: unknown; data?: Partial<FeedResponse> };
  return saved.version === 1
    && Array.isArray(saved.data?.events)
    && Array.isArray(saved.data?.sourceHealth)
    && typeof saved.data?.checkedAt === "string"
    && Boolean(saved.data.checkedAt);
}

async function loadSnapshot(filePath: string): Promise<FeedResponse | undefined> {
  try {
    const saved = JSON.parse(await readFile(filePath, "utf8"));
    return isValidSnapshot(saved) ? saved.data : undefined;
  } catch {
    return undefined;
  }
}

async function initialize() {
  state.initialized ??= (async () => {
    state.snapshot = await loadSnapshot(cachePath) ?? await loadSnapshot(bundledSnapshotPath);
  })();
  await state.initialized;
}

async function persist(snapshot: FeedResponse) {
  try {
    await mkdir(dataDirectory, { recursive: true });
    const temporary = `${cachePath}.${process.pid}.tmp`;
    await writeFile(temporary, JSON.stringify({ version: 1, data: snapshot }), "utf8");
    await rename(temporary, cachePath);
  } catch (error) {
    console.warn("StormEye snapshot persistence failed", error);
  }
}

function preserveTranslations(events: FeedResponse["events"], previous: FeedResponse["events"]): FeedResponse["events"] {
  const byId = new Map(previous.map((event) => [event.id, event]));
  const byUrl = new Map(previous.map((event) => [event.sourceUrl, event]));
  return events.map((event) => {
    const prior = byId.get(event.id) ?? byUrl.get(event.sourceUrl);
    if (!prior || prior.title !== event.title || prior.summary !== event.summary) return event;
    return {
      ...event,
      titleZh: event.titleZh ?? prior.titleZh,
      summaryZh: event.summaryZh ?? prior.summaryZh,
      translationStatus: event.translationStatus ?? prior.translationStatus,
      translationProvider: event.translationProvider ?? prior.translationProvider,
    };
  });
}

async function refresh(): Promise<FeedResponse> {
  const checkedAt = new Date().toISOString();
  const result = await liveEvents().catch(() => ({
    events: [],
    health: seedSourceHealth.map((source) => ({ ...source, status: "受限" as const, freshness: "同步失败" })),
  }));
  const failedSources = new Set(result.health.filter((source) => source.status !== "在线").map((source) => source.name));
  const retained = (state.snapshot?.events ?? []).filter((event) =>
    failedSources.has(event.source) && Date.now() - Date.parse(event.publishedAt) < 30 * 86400_000,
  );
  const previousEvents = state.snapshot?.events ?? [];
  const events = preserveTranslations(deduplicateEvents([...result.events, ...retained]), previousEvents);
  const hasFreshData = result.events.length > 0;
  state.snapshot = {
    catalogVersion: sourceCatalogVersion,
    events,
    sourceHealth: result.health,
    generatedAt: hasFreshData ? checkedAt : (state.snapshot?.generatedAt ?? ""),
    checkedAt,
    live: hasFreshData,
    stale: failedSources.size > 0 || !hasFreshData,
    ...(failedSources.size > 0 ? { message: `${failedSources.size} 个信源本次连接受限，历史条目在有效期内保留，详见信源状态。` } : {}),
  };
  await persist(state.snapshot);
  return state.snapshot;
}

export async function getFeedSnapshot(force = false): Promise<FeedResponse> {
  await initialize();
  await initializeTranslations();
  const present = (snapshot: FeedResponse): FeedResponse => ({
    ...snapshot,
    events: snapshot.events.map((event) => cachedTranslations({ ...event, relativeTime: relativeTime(event.publishedAt) })),
    sourceHealth: snapshot.catalogVersion === sourceCatalogVersion ? snapshot.sourceHealth : initialSourceHealth(),
  });
  if (state.pending) return present(await state.pending);
  const now = Date.now();
  const current = state.snapshot;
  const catalogChanged = current?.catalogVersion !== sourceCatalogVersion;
  const due = !current || catalogChanged || Date.parse(current.generatedAt) < dailyBoundary(now) || !current.generatedAt || current.stale;
  const retryAfter = current?.stale ? 5 * 60_000 : 60_000;
  const recentlyChecked = current && now - Date.parse(current.checkedAt) < (force ? 60_000 : retryAfter);
  if (current && !catalogChanged && ((!force && !due) || recentlyChecked)) return present(current);
  state.pending = refresh().finally(() => { state.pending = undefined; });
  return present(await state.pending);
}

export async function currentFeedEvents(): Promise<FeedResponse["events"]> {
  await initialize();
  return state.snapshot?.events ?? [];
}
