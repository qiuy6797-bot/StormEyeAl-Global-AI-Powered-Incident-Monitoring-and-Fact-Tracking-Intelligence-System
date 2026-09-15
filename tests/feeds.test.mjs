import assert from "node:assert/strict";
import { after, test } from "node:test";
import { registerHooks } from "node:module";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

registerHooks({
  resolve(specifier, context, next) {
    try { return next(specifier, context); }
    catch (error) {
      if (error.code === "ERR_MODULE_NOT_FOUND" && specifier.startsWith(".") && !path.extname(specifier)) {
        return next(`${specifier}.ts`, context);
      }
      throw error;
    }
  },
});

const temp = await mkdtemp(path.join(os.tmpdir(), "stormeye-test-"));
process.env.STORMEYE_DATA_DIR = temp;
delete process.env.STORMEYE_TRANSLATE_URL;
delete process.env.STORMEYE_TRANSLATE_KEY;
delete process.env.STORMEYE_TRANSLATE_EMAIL;
const { sourceCatalog, initialSourceHealth } = await import("../app/lib/sources.ts");
const { parseRss, parseArticle, isAiRelated, deduplicateEvents } = await import("../app/lib/feeds.ts");
const { needsChineseTranslation } = await import("../app/lib/language.ts");
const { splitTranslationText, translateEvents } = await import("../app/lib/translate.ts");
const official = sourceCatalog.find((source) => source.id === "openai");
const media = sourceCatalog.find((source) => source.id === "ithome");
const now = new Date(Date.now() - 60000).toISOString();
const rss = (content) => `<rss version="2.0"><channel>${content}</channel></rss>`;
const item = (date = now, url = "https://example.com/ai") =>
  `<item><title>New AI research</title><link>${url}</link><pubDate>${date}</pubDate><description><![CDATA[<p>Machine learning &amp; AI</p>]]></description></item>`;

after(async () => {
  assert.equal(path.dirname(path.resolve(temp)), path.resolve(os.tmpdir()));
  assert.ok(path.basename(temp).startsWith("stormeye-test-"));
  await rm(temp, { recursive: true, force: true });
});

test("catalog has 30 unique, configured sources across both regions", () => {
  assert.equal(sourceCatalog.length, 30);
  assert.equal(new Set(sourceCatalog.map((source) => source.id)).size, 30);
  assert.equal(new Set(sourceCatalog.map((source) => source.endpoint)).size, 30);
  assert.equal(sourceCatalog.filter((source) => source.region === "国内").length, 12);
  assert.equal(sourceCatalog.filter((source) => source.region === "海外").length, 18);
  assert.ok(sourceCatalog.every((source) => source.endpoint.startsWith("https://")));
  assert.ok(initialSourceHealth().every((source) => source.status === "待连接" && source.eventCount === 0));
});

test("RSS keeps original text, cleans markup, and distinguishes media from official evidence", () => {
  const [event] = parseRss(rss(item()), official);
  assert.equal(event.title, "New AI research");
  assert.equal(event.summary, "Machine learning & AI");
  assert.equal(event.confidence, "官方原文");
  assert.equal(parseRss(rss(item()), media)[0].confidence, "待核验");
});

test("RSS rejects HTML error pages, missing dates, stale and future articles", () => {
  assert.throws(() => parseRss("<html><body>Access denied</body></html>", official));
  assert.throws(() => parseRss("<rss><bad></rss>", official));
  assert.deepEqual(parseRss(rss(item("")), official), []);
  assert.deepEqual(parseRss(rss(item("2001-01-01")), official), []);
  assert.deepEqual(parseRss(rss(item(new Date(Date.now() + 86400000).toISOString())), official), []);
  assert.deepEqual(parseRss(rss(item(now, "javascript:alert(1)")), official), []);
});

test("Atom selects the alternate article link and accepts single entry", () => {
  const xml = `<feed><entry><title>New AI model</title><link rel="self" href="https://example.com/feed"/><link rel="alternate" href="https://example.com/article"/><updated>${now}</updated><summary>Research</summary></entry></feed>`;
  assert.equal(parseRss(xml, official)[0].sourceUrl, "https://example.com/article");
});

test("RDF date and URL deduplication work", () => {
  const xml = `<rdf:RDF xmlns:rdf="urn:rdf" xmlns:dc="urn:dc"><item><title>AI research</title><link>https://example.com/article</link><dc:date>${now}</dc:date></item></rdf:RDF>`;
  const events = parseRss(xml, official);
  assert.equal(events.length, 1);
  assert.equal(deduplicateEvents([...events, ...events]).length, 1);
});

test("HTML supports publisher JSON-LD and configured publication date", () => {
  const html = `<script type="application/ld+json">${JSON.stringify({ title: "AI research news", pubDate: now })}</script>`;
  assert.equal(parseArticle(html, "https://example.com/article", official).length, 1);
  const anthropic = sourceCatalog.find((source) => source.id === "anthropic");
  assert.equal(parseArticle(`<main><h1>New AI model</h1><div class="agate">${now}</div></main>`, "https://www.anthropic.com/news/model", anthropic).length, 1);
  assert.deepEqual(parseArticle("<h1>New AI model</h1>", "https://example.com/article", official), []);
});

test("AI filtering avoids substring matches and language detection preserves Chinese", () => {
  assert.equal(isAiRelated("A fragile garden", ""), false);
  assert.equal(isAiRelated("New AI research", ""), true);
  assert.equal(needsChineseTranslation("A new model for research"), true);
  assert.equal(needsChineseTranslation("OpenAI 发布新的大模型"), false);
  assert.equal(needsChineseTranslation("GPT-5"), false);
  const value = "International AI research with unicode characters. ".repeat(40);
  const chunks = splitTranslationText(value);
  assert.ok(chunks.every((chunk) => Buffer.byteLength(chunk) <= 480));
  assert.equal(chunks.join(" "), value.trim());
});

test("translation returns Chinese below preserved originals and caches requests", async (t) => {
  let requests = 0;
  t.mock.method(globalThis, "fetch", async () => {
    requests++;
    return Response.json({ responseStatus: 200, responseData: { translatedText: "新的人工智能研究" }, quotaFinished: false });
  });
  const event = parseRss(rss(item()), official)[0];
  const [translated] = await translateEvents([event]);
  assert.equal(translated.title, event.title);
  assert.equal(translated.titleZh, "新的人工智能研究");
  assert.equal(translated.translationStatus, "ready");
  await translateEvents([event]);
  assert.equal(requests, 2);
});

test("translation deduplicates in-flight work and limits concurrency", async (t) => {
  let active = 0;
  let maximum = 0;
  let requests = 0;
  t.mock.method(globalThis, "fetch", async () => {
    active++;
    maximum = Math.max(active, maximum);
    requests++;
    await new Promise((resolve) => setTimeout(resolve, 10));
    active--;
    return Response.json({ responseStatus: 200, responseData: { translatedText: "科研工具更新" } });
  });
  const base = parseRss(rss(item()), official)[0];
  const events = Array.from({ length: 4 }, (_, index) => ({ ...base, id: `${index}`, title: `Unique research title ${index}`, summary: `Unique research summary ${index}` }));
  await Promise.all([translateEvents(events), translateEvents(events)]);
  assert.equal(requests, 8);
  assert.ok(maximum <= 4);
});

test("translation failures never masquerade as Chinese text", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ responseStatus: 200, responseData: { translatedText: "SERVICE UNAVAILABLE" } }));
  const base = parseRss(rss(item()), official)[0];
  const [event] = await translateEvents([{ ...base, title: "Failed translation title", summary: "Failed translation summary" }]);
  assert.equal(event.translationStatus, "unavailable");
  assert.equal(event.titleZh, undefined);
  assert.equal(event.summaryZh, undefined);
});
