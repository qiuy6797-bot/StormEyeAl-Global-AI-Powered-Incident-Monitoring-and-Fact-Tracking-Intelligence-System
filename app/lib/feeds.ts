import { XMLParser, XMLValidator } from "fast-xml-parser";
import { load } from "cheerio";
import { createHash } from "node:crypto";
import { inferIndustry } from "./classify";
import { initialSourceHealth, sourceCatalog, type SourceDefinition } from "./sources";
import type { FeedEvent, SourceHealth } from "./types";

type RecordValue = Record<string, unknown>;
type Article = { title: string; summary: string; url: string; date: string; id?: string };
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", textNodeName: "#text" });
const MAX_AGE = 30 * 86400_000;

function text(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (value && typeof value === "object") return text((value as RecordValue)["#text"]);
  return "";
}

function records(value: unknown): RecordValue[] {
  return (Array.isArray(value) ? value : value ? [value] : [])
    .filter((entry) => entry && typeof entry === "object") as RecordValue[];
}

export function plainText(value: string): string {
  const $ = load(value, null, false);
  $("script, style").remove();
  $("p, br, div, li").prepend(" ");
  return $.text().replace(/\s+/g, " ").trim();
}

function inferKind(value: string): FeedEvent["kind"] {
  if (/policy|regulat|law|safety|audit|监管|法规|安全/i.test(value)) return "政策";
  if (/launch|release|product|introducing|announcing|发布|推出|上线/i.test(value)) return "产品";
  if (/github|open.source|repository|开源/i.test(value)) return "开源";
  if (/paper|arxiv|research|benchmark|study|研究|论文/i.test(value)) return "研究";
  return "重大";
}

export function isAiRelated(title: string, summary = ""): boolean {
  const signal = /\b(ai|llms?|gpt|rag|agents?|copilot|chatgpt|claude|gemini|deepseek|qwen|mistral)\b|artificial intelligence|language model|foundation model|generative|deep learning|machine learning|neural|inference|embedding|diffusion|robotics|computer vision|人工智能|大模型|智能体|生成式|机器学习|深度学习|推理|具身|机器人|自动驾驶|通义|文心|豆包|智谱/i;
  return signal.test(title) || signal.test(summary);
}

export function relativeTime(value: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 60000));
  if (!Number.isFinite(minutes)) return "日期未知";
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} 小时前`;
  return `${Math.floor(minutes / 1440)} 天前`;
}

function safeUrl(value: string, base: string): string {
  try {
    const url = new URL(value, base);
    if (!/^https?:$/.test(url.protocol) || url.username || url.password) return "";
    url.hash = "";
    return url.href;
  } catch { return ""; }
}

function makeEvent(article: Article, source: SourceDefinition): FeedEvent[] {
  const title = plainText(article.title);
  const summary = plainText(article.summary).slice(0, 420);
  const date = Date.parse(article.date);
  const url = safeUrl(article.url, source.home);
  if (!title || !url || !Number.isFinite(date) || date > Date.now() + 300_000 || Date.now() - date > MAX_AGE) return [];
  if (!source.aiOnly && !isAiRelated(title, summary)) return [];
  const kind = source.sourceType === "论文" ? "研究" : source.sourceType === "代码" ? "开源" : inferKind(`${title} ${summary}`);
  return [{
    id: article.id ?? (source.adapter === "rss"
      ? `rss-${createHash("sha256").update(`${source.name}:${url}`).digest("hex").slice(0, 20)}`
      : `${source.id}-${createHash("sha256").update(url).digest("hex").slice(0, 20)}`),
    title,
    summary: summary || "信源未提供摘要，请查看原文。",
    source: source.name,
    sourceType: source.sourceType,
    sourceUrl: url,
    publishedAt: new Date(date).toISOString(),
    relativeTime: relativeTime(article.date),
    kind,
    industry: inferIndustry(`${title} ${summary}`),
    tags: [source.sourceType === "媒体" ? "媒体报道" : source.sourceType === "社区" ? "社区讨论" : source.sourceType],
    confidence: source.sourceType === "官方" ? "官方原文" : source.sourceType === "社区" ? "社区信号" : "待核验",
    impact: /launch|release|introducing|announc|发布|推出/i.test(title) ? "高" : "中",
    region: source.region === "国内" ? "CN" : "GLOBAL",
    signal: 0,
  }];
}

export function parseRss(xml: string, source: SourceDefinition): FeedEvent[] {
  if (XMLValidator.validate(xml) !== true) throw new Error("订阅格式无效");
  const parsed = parser.parse(xml) as RecordValue;
  const channel = (parsed.rss as RecordValue | undefined)?.channel ?? parsed.feed ?? parsed["rdf:RDF"];
  if (!channel || typeof channel !== "object") throw new Error("返回内容不是 RSS/Atom");
  const body = channel as RecordValue;
  return records(body.item ?? body.entry).slice(0, 100).flatMap((record) => {
    const alternatives = records(record.link);
    const link = alternatives.find((entry) => entry["@_rel"] === "alternate")
      ?? alternatives.find((entry) => !entry["@_rel"]);
    const url = text(record.link) || text(link?.["@_href"]) || text(record.guid);
    if (!url) return [];
    return makeEvent({
      title: text(record.title),
      summary: text(record.description) || text(record.summary) || text(record.content) || text(record["content:encoded"]),
      url,
      date: text(record.pubDate) || text(record.published) || text(record.updated) || text(record["dc:date"]),
    }, source);
  });
}

async function fetchText(url: string, signal: AbortSignal): Promise<string> {
  const response = await fetch(url, {
    headers: { "User-Agent": "StormEyeAI/0.2 (public news reader)", Accept: "application/rss+xml, application/atom+xml, application/json, text/html;q=0.8, */*;q=0.5" },
    signal,
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  // Bound upstream payloads as well as connection time.
  const reader = response.body?.getReader();
  if (!reader) throw new Error("空响应");
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 6 * 1024 * 1024) {
      await reader.cancel();
      throw new Error("响应超过大小限制");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function articleMetadata(value: unknown, depth = 0): RecordValue | undefined {
  if (!value || typeof value !== "object" || depth > 8) return undefined;
  if (Array.isArray(value)) return value.map((item) => articleMetadata(item, depth + 1)).find(Boolean);
  const record = value as RecordValue;
  if ((record.datePublished || record.pubDate) && (record.headline || record.name || record.title)) return record;
  return Object.values(record).map((item) => articleMetadata(item, depth + 1)).find(Boolean);
}

export function parseArticle(html: string, url: string, source: SourceDefinition): FeedEvent[] {
  const $ = load(html);
  let data: RecordValue | undefined;
  $('script[type="application/ld+json"]').each((_, node) => {
    try { data ??= articleMetadata(JSON.parse($(node).text())); } catch { /* Some publishers emit invalid JSON-LD. */ }
  });
  const dateText = source.dateSelector ? $(source.dateSelector).first().text() : "";
  const date = text(data?.datePublished) || text(data?.pubDate)
    || $('meta[property="article:published_time"], meta[name="pubdate"], meta[itemprop="datePublished"]').first().attr("content")
    || $("time[datetime]").first().attr("datetime")
    || $("time").first().text()
    || (Number.isFinite(Date.parse(dateText.trim())) ? dateText.trim() : "")
    || "";
  if (!date) return [];
  const normalized = source.region === "国内" && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(date)
    ? `${date.replace(" ", "T")}+08:00` : date;
  return makeEvent({
    title: text(data?.headline) || text(data?.title) || $("h1").first().text() || $('meta[property="og:title"]').attr("content") || "",
    summary: text(data?.description) || $('meta[property="og:description"], meta[name="description"]').first().attr("content") || "",
    date: normalized,
    url,
  }, source);
}

async function htmlEvents(source: SourceDefinition, signal: AbortSignal): Promise<FeedEvent[]> {
  const $ = load(await fetchText(source.endpoint, signal));
  const matcher = new RegExp(source.articlePath!);
  const home = new URL(source.home);
  const urls = new Set<string>();
  $("a[href]").each((_, node) => {
    const url = safeUrl($(node).attr("href") ?? "", source.home);
    if (url && new URL(url).origin === home.origin && matcher.test(new URL(url).pathname)) urls.add(url);
  });
  if (!urls.size) throw new Error("未找到可解析文章");
  const result = await Promise.allSettled([...urls].slice(0, 5).map(async (url) =>
    parseArticle(await fetchText(url, signal), url, source),
  ));
  const events = result.flatMap((item) => item.status === "fulfilled" ? item.value : []);
  if (!events.length) throw new Error("未能核对近期文章与日期");
  return events;
}

async function apiEvents(source: SourceDefinition, signal: AbortSignal): Promise<FeedEvent[]> {
  if (source.adapter === "hn") {
    const data = JSON.parse(await fetchText(source.endpoint, signal));
    if (!Array.isArray(data.hits)) throw new Error("API 格式无效");
    return data.hits.flatMap((hit: RecordValue) => makeEvent({
      id: `hn-${text(hit.objectID)}`,
      title: text(hit.title) || text(hit.story_title),
      summary: text(hit.story_text) || "开发者社区信号，需结合原文和评论上下文判断。",
      url: text(hit.url) || `https://news.ycombinator.com/item?id=${text(hit.objectID)}`,
      date: text(hit.created_at),
    }, source));
  }
  const url = new URL(source.endpoint);
  url.searchParams.set("q", `topic:artificial-intelligence stars:>=100 archived:false pushed:>=${new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10)}`);
  url.searchParams.set("sort", "updated");
  url.searchParams.set("order", "desc");
  url.searchParams.set("per_page", "10");
  const data = JSON.parse(await fetchText(url.href, signal));
  if (!Array.isArray(data.items)) throw new Error("API 格式无效");
  return data.items.flatMap((item: RecordValue) => makeEvent({
    id: `github-${text(item.full_name)}`,
    title: text(item.full_name),
    summary: text(item.description),
    url: text(item.html_url),
    date: text(item.pushed_at) || text(item.updated_at),
  }, source));
}

export function deduplicateEvents(events: FeedEvent[]): FeedEvent[] {
  const seen = new Set<string>();
  return [...events].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)).filter((event) => {
    const key = event.sourceUrl.replace(/\/$/, "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function liveEvents(): Promise<{ events: FeedEvent[]; health: SourceHealth[] }> {
  const health = initialSourceHealth();
  const events: FeedEvent[] = [];
  let cursor = 0;
  const deadline = AbortSignal.timeout(45000);
  await Promise.all(Array.from({ length: 10 }, async () => {
    while (cursor < sourceCatalog.length) {
      const index = cursor++;
      const source = sourceCatalog[index];
      const row = health[index];
      const start = Date.now();
      const signal = AbortSignal.any([deadline, AbortSignal.timeout(source.adapter === "html" ? 18000 : 15000)]);
      try {
        const found = source.adapter === "rss" ? parseRss(await fetchText(source.endpoint, signal), source)
          : source.adapter === "html" ? await htmlEvents(source, signal) : await apiEvents(source, signal);
        const recent = deduplicateEvents(found).slice(0, 8);
        events.push(...recent);
        row.status = "在线";
        row.eventCount = recent.length;
        row.latestAt = recent[0]?.publishedAt;
        row.freshness = recent[0]?.relativeTime ?? "暂无新条目";
        row.detail = recent.length ? `本次采集 ${recent.length} 条 AI 相关事件` : "连接成功，订阅中暂无近 30 天的 AI 相关条目";
      } catch (error) {
        row.status = "受限";
        row.freshness = "同步失败";
        row.detail = signal.aborted ? "连接超时" : error instanceof Error ? error.message : "请求失败";
      }
      row.latency = `${((Date.now() - start) / 1000).toFixed(1)}s`;
    }
  }));
  return { events: deduplicateEvents(events), health };
}
