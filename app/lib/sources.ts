import type { FeedEvent, SourceHealth } from "./types";

export type SourceDefinition = {
  id: string;
  name: string;
  region: "国内" | "海外";
  sourceType: FeedEvent["sourceType"];
  home: string;
  endpoint: string;
  adapter: "rss" | "html" | "hn" | "github";
  aiOnly?: boolean;
  articlePath?: string;
  dateSelector?: string;
};

export const sourceCatalog: SourceDefinition[] = [
  { id: "openai", name: "OpenAI News", region: "海外", sourceType: "官方", home: "https://openai.com/news/", endpoint: "https://openai.com/news/rss.xml", adapter: "rss", aiOnly: true },
  { id: "anthropic", name: "Anthropic", region: "海外", sourceType: "官方", home: "https://www.anthropic.com/news", endpoint: "https://www.anthropic.com/news", adapter: "html", articlePath: "^/news/[^/]+/?$", dateSelector: "main h1 + .agate", aiOnly: true },
  { id: "google", name: "Google AI", region: "海外", sourceType: "官方", home: "https://blog.google/technology/ai/", endpoint: "https://blog.google/technology/ai/rss/", adapter: "rss", aiOnly: true },
  { id: "deepmind", name: "Google DeepMind", region: "海外", sourceType: "官方", home: "https://deepmind.google/blog/", endpoint: "https://deepmind.google/blog/rss.xml", adapter: "rss", aiOnly: true },
  { id: "microsoft", name: "Microsoft Blog", region: "海外", sourceType: "官方", home: "https://blogs.microsoft.com/", endpoint: "https://blogs.microsoft.com/feed/", adapter: "rss" },
  { id: "ms-research", name: "Microsoft Research", region: "海外", sourceType: "官方", home: "https://www.microsoft.com/en-us/research/blog/", endpoint: "https://www.microsoft.com/en-us/research/feed/", adapter: "rss" },
  { id: "nvidia", name: "NVIDIA Developer", region: "海外", sourceType: "官方", home: "https://developer.nvidia.com/blog/", endpoint: "https://developer.nvidia.com/blog/feed/", adapter: "rss" },
  { id: "aws", name: "AWS Machine Learning", region: "海外", sourceType: "官方", home: "https://aws.amazon.com/blogs/machine-learning/", endpoint: "https://aws.amazon.com/blogs/machine-learning/feed/", adapter: "rss", aiOnly: true },
  { id: "huggingface", name: "Hugging Face", region: "海外", sourceType: "社区", home: "https://huggingface.co/blog", endpoint: "https://huggingface.co/blog/feed.xml", adapter: "rss", aiOnly: true },
  { id: "mistral", name: "Mistral AI", region: "海外", sourceType: "官方", home: "https://mistral.ai/news/", endpoint: "https://mistral.ai/news/rss", adapter: "rss", aiOnly: true },
  { id: "techcrunch", name: "TechCrunch AI", region: "海外", sourceType: "媒体", home: "https://techcrunch.com/category/artificial-intelligence/", endpoint: "https://techcrunch.com/category/artificial-intelligence/feed/", adapter: "rss", aiOnly: true },
  { id: "mit-review", name: "MIT Technology Review", region: "海外", sourceType: "媒体", home: "https://www.technologyreview.com/topic/artificial-intelligence/", endpoint: "https://www.technologyreview.com/topic/artificial-intelligence/feed/", adapter: "rss", aiOnly: true },
  { id: "verge", name: "The Verge", region: "海外", sourceType: "媒体", home: "https://www.theverge.com/ai-artificial-intelligence", endpoint: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml", adapter: "rss", aiOnly: true },
  { id: "wired", name: "WIRED", region: "海外", sourceType: "媒体", home: "https://www.wired.com/tag/artificial-intelligence/", endpoint: "https://www.wired.com/feed/tag/ai/latest/rss", adapter: "rss" },
  { id: "nature", name: "Nature", region: "海外", sourceType: "论文", home: "https://www.nature.com/subjects/machine-learning", endpoint: "https://www.nature.com/subjects/machine-learning.rss", adapter: "rss", aiOnly: true },
  { id: "arxiv", name: "arXiv", region: "海外", sourceType: "论文", home: "https://arxiv.org/list/cs.AI/recent", endpoint: "https://export.arxiv.org/rss/cs.AI", adapter: "rss", aiOnly: true },
  { id: "hn", name: "Hacker News", region: "海外", sourceType: "社区", home: "https://news.ycombinator.com/", endpoint: "https://hn.algolia.com/api/v1/search_by_date?query=AI&tags=story&hitsPerPage=30", adapter: "hn" },
  { id: "github", name: "GitHub Search", region: "海外", sourceType: "代码", home: "https://github.com/", endpoint: "https://api.github.com/search/repositories", adapter: "github", aiOnly: true },
  { id: "qbit", name: "量子位", region: "国内", sourceType: "媒体", home: "https://www.qbitai.com/", endpoint: "https://www.qbitai.com/feed", adapter: "rss", aiOnly: true },
  { id: "leiphone", name: "雷峰网", region: "国内", sourceType: "媒体", home: "https://www.leiphone.com/", endpoint: "https://www.leiphone.com/feed", adapter: "rss" },
  { id: "tmtpost", name: "钛媒体", region: "国内", sourceType: "媒体", home: "https://www.tmtpost.com/", endpoint: "https://www.tmtpost.com/feed", adapter: "rss" },
  { id: "infoq-cn", name: "InfoQ 中国", region: "国内", sourceType: "媒体", home: "https://www.infoq.cn/", endpoint: "https://www.infoq.cn/feed", adapter: "rss" },
  { id: "ithome", name: "IT之家", region: "国内", sourceType: "媒体", home: "https://www.ithome.com/", endpoint: "https://www.ithome.com/rss/", adapter: "rss" },
  { id: "oschina", name: "开源中国", region: "国内", sourceType: "社区", home: "https://www.oschina.net/", endpoint: "https://www.oschina.net/news/rss", adapter: "rss" },
  { id: "solidot", name: "Solidot", region: "国内", sourceType: "媒体", home: "https://www.solidot.org/", endpoint: "https://www.solidot.org/index.rss", adapter: "rss" },
  { id: "ifanr", name: "爱范儿", region: "国内", sourceType: "媒体", home: "https://www.ifanr.com/", endpoint: "https://www.ifanr.com/feed", adapter: "rss" },
  { id: "geekpark", name: "极客公园", region: "国内", sourceType: "媒体", home: "https://www.geekpark.net/", endpoint: "https://www.geekpark.net/rss", adapter: "rss" },
  { id: "sspai", name: "少数派", region: "国内", sourceType: "媒体", home: "https://sspai.com/", endpoint: "https://sspai.com/feed", adapter: "rss" },
  { id: "36kr", name: "36氪", region: "国内", sourceType: "媒体", home: "https://www.36kr.com/", endpoint: "https://www.36kr.com/feed", adapter: "rss" },
  { id: "pingwest", name: "品玩", region: "国内", sourceType: "媒体", home: "https://www.pingwest.com/", endpoint: "https://www.pingwest.com/", adapter: "html", articlePath: "^/a/\\d+/?$", dateSelector: ".time, .date, [class*=time]" },
];

export const sourceCatalogVersion = "30-v2";

export function initialSourceHealth(): SourceHealth[] {
  return sourceCatalog.map((source) => ({
    id: source.id,
    name: source.name,
    home: source.home,
    region: source.region,
    type: `${source.sourceType} · ${source.adapter === "rss" ? "RSS" : source.adapter === "html" ? "网站" : "API"}`,
    status: "待连接",
    latency: "-",
    freshness: "待同步",
    eventCount: 0,
  }));
}
