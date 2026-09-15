export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.VERCEL || process.env.NEXT_PHASE === "phase-production-build") return;
  const { getFeedSnapshot } = await import("./app/lib/feed-store");
  const runtime = globalThis as typeof globalThis & { stormeyeDailyTimer?: ReturnType<typeof setInterval> };
  if (runtime.stormeyeDailyTimer) return;
  runtime.stormeyeDailyTimer = setInterval(() => {
    void getFeedSnapshot().catch((error) => console.warn("StormEye scheduled sync failed", error));
  }, 30_000);
  runtime.stormeyeDailyTimer.unref();
}
