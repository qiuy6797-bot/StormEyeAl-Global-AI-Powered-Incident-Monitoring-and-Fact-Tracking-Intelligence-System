import { currentFeedEvents } from "../../lib/feed-store";
import { translateEvents } from "../../lib/translate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ error: "Origin not allowed" }, { status: 403 });
  }
  let ids: string[];
  try {
    const body = await request.text();
    if (body.length > 4096) return Response.json({ error: "Request too large" }, { status: 413 });
    const data = JSON.parse(body);
    if (!Array.isArray(data.ids) || data.ids.length > 4 || !data.ids.every((id: unknown) => typeof id === "string" && id.length <= 100)) {
      return Response.json({ error: "Invalid event ids" }, { status: 400 });
    }
    ids = [...new Set<string>(data.ids)];
  } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  const events = await currentFeedEvents();
  const selected = ids.flatMap((id) => {
    const event = events.find((entry) => entry.id === id);
    return event ? [event] : [];
  });
  const translations = await translateEvents(selected);
  return Response.json({ translations: translations.map(({ id, titleZh, summaryZh, translationStatus, translationProvider }) =>
    ({ id, titleZh, summaryZh, translationStatus, translationProvider })) }, { headers: { "Cache-Control": "no-store" } });
}
