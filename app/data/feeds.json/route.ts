import { getFeedSnapshot } from "../../lib/feed-store";
import { needsChineseTranslation } from "../../lib/language";
import { translateEvents } from "../../lib/translate";

export const dynamic = "force-static";
export const revalidate = false;
export const runtime = "nodejs";

export async function GET() {
  const snapshot = await getFeedSnapshot(true);
  const head = await translateEvents(snapshot.events.slice(0, 10));
  const translatedIds = new Set(head.map((event) => event.id));
  const tail = snapshot.events.filter((event) => !translatedIds.has(event.id)).map((event) => {
    const needsTitle = event.sourceType !== "代码" && needsChineseTranslation(event.title) && !event.titleZh;
    const needsSummary = needsChineseTranslation(event.summary) && !event.summaryZh;
    return needsTitle || needsSummary ? { ...event, translationStatus: "unavailable" as const } : event;
  });
  const events = [...head, ...tail];
  return Response.json({ ...snapshot, events }, { headers: { "Cache-Control": "no-store" } });
}
