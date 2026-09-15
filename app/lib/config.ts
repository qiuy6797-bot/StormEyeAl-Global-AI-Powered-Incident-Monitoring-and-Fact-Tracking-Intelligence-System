export const APP_NAME = "StormEye AI｜全球 AI 事件监测与事实追踪情报系统";
export const APP_SUBTITLE = "全球 AI 事件监测与事实追踪情报系统";
export const DAILY_SYNC_HOUR = 8;

const DAY_MS = 24 * 60 * 60 * 1000;
const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;

export function dailyBoundary(now = Date.now()): number {
  const shifted = new Date(now + BEIJING_OFFSET_MS);
  const today = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate(), DAILY_SYNC_HOUR) - BEIJING_OFFSET_MS;
  return today <= now ? today : today - DAY_MS;
}

export function nextDailySync(now = Date.now()): number {
  return dailyBoundary(now) + DAY_MS;
}
