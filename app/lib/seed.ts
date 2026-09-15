import type { FeedEvent, SourceHealth } from "./types";
import { initialSourceHealth } from "./sources";

export const seedEvents: FeedEvent[] = [];

export const seedSourceHealth: SourceHealth[] = initialSourceHealth();
