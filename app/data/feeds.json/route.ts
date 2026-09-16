import { getFeedSnapshot } from "../../lib/feed-store";
import { translateEvents } from "../../lib/translate";

export const dynamic = "force-static";
export const revalidate = false;
export const runtime = "nodejs";

export async function GET() {
  const snapshot = await getFeedSnapshot(true);
  const events = await translateEvents(snapshot.events);
  return Response.json({ ...snapshot, events }, { headers: { "Cache-Control": "no-store" } });
}
