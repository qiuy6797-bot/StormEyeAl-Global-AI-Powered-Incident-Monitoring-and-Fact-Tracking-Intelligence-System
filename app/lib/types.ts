export type EventKind = "重大" | "产品" | "研究" | "开源" | "政策";
export type Confidence = "官方原文" | "待核验" | "社区信号";
export type Industry =
  | "基础模型"
  | "智能体与办公"
  | "机器人与自动驾驶"
  | "能源与工业"
  | "金融"
  | "医疗与生命科学"
  | "安全与政策"
  | "开发者基础设施";

export type FeedEvent = {
  id: string;
  title: string;
  titleZh?: string;
  summary: string;
  summaryZh?: string;
  translationStatus?: "ready" | "partial" | "unavailable";
  translationProvider?: string;
  source: string;
  sourceType: "官方" | "媒体" | "社区" | "论文" | "代码";
  sourceUrl: string;
  publishedAt: string;
  relativeTime: string;
  kind: EventKind;
  industry: Industry;
  tags: string[];
  confidence: Confidence;
  impact: "高" | "中" | "低";
  region: string;
  signal: number;
};

export type SourceHealth = {
  id: string;
  name: string;
  home: string;
  region: "国内" | "海外";
  type: string;
  status: "在线" | "受限" | "待连接";
  latency: string;
  freshness: string;
  latestAt?: string;
  eventCount: number;
  detail?: string;
};

export type FeedResponse = {
  catalogVersion?: string;
  events: FeedEvent[];
  sourceHealth: SourceHealth[];
  generatedAt: string;
  live: boolean;
  checkedAt: string;
  stale: boolean;
  message?: string;
};
