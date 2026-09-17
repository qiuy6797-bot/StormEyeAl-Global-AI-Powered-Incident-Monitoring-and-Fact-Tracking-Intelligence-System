"use client";

import {
  Activity,
  ArrowUpRight,
  Bell,
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  CircleHelp,
  Clock3,
  Command,
  Eye,
  ExternalLink,
  Filter,
  Globe2,
  Layers3,
  ListFilter,
  Maximize2,
  Menu,
  Minimize2,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  Target,
  Type,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { APP_NAME, DAILY_SYNC_HOUR } from "../lib/config";
import { seedSourceHealth } from "../lib/seed";
import { needsChineseTranslation } from "../lib/language";
import { feedSnapshotPath } from "../lib/site";
import type { Confidence, EventKind, FeedEvent, FeedResponse, Industry, SourceHealth } from "../lib/types";

const kindFilters: Array<{ key: "全部" | EventKind; label: string }> = [
  { key: "全部", label: "全部事件" },
  { key: "重大", label: "重大信号" },
  { key: "产品", label: "产品发布" },
  { key: "研究", label: "研究论文" },
  { key: "开源", label: "开源项目" },
  { key: "政策", label: "政策观察" },
];

const industryFilters: Array<{ key: "全部" | Industry; label: string }> = [
  { key: "全部", label: "全行业" },
  { key: "基础模型", label: "基础模型" },
  { key: "智能体与办公", label: "智能体 / 办公" },
  { key: "机器人与自动驾驶", label: "机器人 / 自动驾驶" },
  { key: "能源与工业", label: "能源 / 工业" },
  { key: "金融", label: "金融" },
  { key: "医疗与生命科学", label: "医疗 / 生命科学" },
  { key: "安全与政策", label: "安全 / 政策" },
  { key: "开发者基础设施", label: "开发者基础设施" },
];

const navItems = [
  { label: "今日总览", icon: Activity },
  { label: "事件流", icon: Layers3 },
  { label: "趋势雷达", icon: Target },
  { label: "信源图谱", icon: Globe2 },
];

const regions = [
  { name: "北美", code: "NA", value: 42, delta: "+8.4%", tone: "cyan" },
  { name: "亚洲", code: "AP", value: 27, delta: "+5.1%", tone: "lime" },
  { name: "欧洲", code: "EU", value: 21, delta: "+2.8%", tone: "amber" },
  { name: "其他", code: "OT", value: 10, delta: "-1.2%", tone: "violet" },
];

const topicHeat = [
  { label: "Agent", score: 92, color: "cyan" },
  { label: "推理基础设施", score: 84, color: "lime" },
  { label: "AI 安全", score: 76, color: "amber" },
  { label: "开源模型", score: 69, color: "violet" },
  { label: "具身智能", score: 58, color: "coral" },
];

function savePreference(key: string, value: string) {
  try { window.localStorage.setItem(key, value); } catch { /* Storage may be disabled in private contexts. */ }
}

function formatSyncTime(value?: string) {
  if (!value) return "待同步";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "待同步";
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function formatDateTime(value?: string) {
  if (!value) return "待同步";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "待同步";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function formatNextSync(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now).reduce<Record<string, string>>((result, part) => {
    result[part.type] = part.value;
    return result;
  }, {});
  const next = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), DAILY_SYNC_HOUR) - 8 * 3600_000);
  if (next.getTime() <= now.getTime()) next.setTime(next.getTime() + 24 * 3600_000);
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(next);
}

function confidenceMeta(confidence: Confidence) {
  if (confidence === "官方原文") return { label: "官方原文", className: "verified", icon: Check };
  if (confidence === "待核验") return { label: "待核验", className: "triangulate", icon: ShieldCheck };
  return { label: "社区信号", className: "community", icon: Activity };
}

function kindClass(kind: EventKind) {
  return {
    重大: "kind-critical",
    产品: "kind-product",
    研究: "kind-research",
    开源: "kind-open",
    政策: "kind-policy",
  }[kind];
}

function Sparkline() {
  const points = "0,44 14,40 28,42 42,28 56,34 70,24 84,27 98,12 112,18 126,9 140,15 154,4";
  return (
    <svg className="sparkline" viewBox="0 0 154 48" role="img" aria-label="趋势折线">
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6ee7ff" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#6ee7ff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`M ${points.replaceAll(" ", " L ")}`} fill="none" stroke="#77e6ff" strokeWidth="2.2" strokeLinecap="round" />
      <path d={`M 0,48 L ${points.replaceAll(" ", " L ")} L 154,48 Z`} fill="url(#spark-fill)" />
    </svg>
  );
}

function TranslationLine({ value, provider, title = false }: {
  value?: string;
  provider?: string;
  title?: boolean;
}) {
  if (!value) return null;
  return (
    <div className={`translation-line ${title ? "translation-title" : ""}`} lang="zh-CN">
      <span className="translation-label" title={provider ? `机器翻译 · ${provider} · 以原文为准` : "机器翻译"}>中文 · 机器翻译</span>
      <p>{value}</p>
    </div>
  );
}

function EventContent({ event, detail = false }: { event: FeedEvent; detail?: boolean }) {
  const Heading = detail ? "h2" : "h3";
  const titleNeedsTranslation = event.sourceType !== "代码" && needsChineseTranslation(event.title);
  const summaryNeedsTranslation = needsChineseTranslation(event.summary);
  return (
    <div className="bilingual-content">
      <Heading lang={titleNeedsTranslation ? "en" : undefined}>{event.title}</Heading>
      {titleNeedsTranslation && <TranslationLine value={event.titleZh} provider={event.translationProvider} title />}
      <p className={detail ? "modal-summary original-summary" : "original-summary"} lang={summaryNeedsTranslation ? "en" : undefined}>{event.summary}</p>
      {summaryNeedsTranslation && <TranslationLine value={event.summaryZh} provider={event.translationProvider} />}
    </div>
  );
}

function EventCard({ event, saved, onOpen, onSave }: {
  event: FeedEvent;
  saved: boolean;
  onOpen: () => void;
  onSave: () => void;
}) {
  const confidence = confidenceMeta(event.confidence);
  const ConfidenceIcon = confidence.icon;
  return (
    <article className={`event-card ${event.impact === "高" ? "high-impact" : ""}`} onClick={onOpen}>
      <div className="event-card-topline">
        <div className="event-breadcrumb">
          <span className={`kind-dot ${kindClass(event.kind)}`} />
          <span className={`kind-label ${kindClass(event.kind)}`}>{event.kind}</span>
          <span className="dot-divider">·</span>
          <span>{event.source}</span>
        </div>
        <div className="event-actions">
          {event.impact === "高" && <span className="impact-pill">高影响</span>}
          <button
            className={`icon-button small ${saved ? "saved" : ""}`}
            aria-label={saved ? "取消收藏" : "收藏事件"}
            title={saved ? "取消收藏" : "收藏事件"}
            onClick={(e) => { e.stopPropagation(); onSave(); }}
          >
            <Bookmark size={14} fill={saved ? "currentColor" : "none"} />
          </button>
        </div>
      </div>
      <EventContent event={event} />
      <div className="event-card-footer">
        <div className="event-tags">
          <span className="event-tag industry-tag">{event.industry}</span>
          {event.tags.map((tag) => <span key={tag} className="event-tag">{tag}</span>)}
        </div>
        <div className="event-meta">
          <span className={`confidence ${confidence.className}`}><ConfidenceIcon size={12} />{confidence.label}</span>
          <span className="event-time"><Clock3 size={12} />{event.relativeTime}</span>
        </div>
      </div>
    </article>
  );
}

function SourceRow({ source }: { source: SourceHealth }) {
  const statusClass = source.status === "在线" ? "online" : source.status === "受限" ? "limited" : "pending";
  const resultText = source.status === "在线"
    ? `${source.eventCount} 条 · ${source.latency}`
    : source.detail || source.freshness || "待同步";
  return (
    <div className="source-row" title={source.detail || resultText}>
      <span className={`source-status ${statusClass}`} aria-label={source.status} />
      <div className="source-name"><a href={source.home} target="_blank" rel="noreferrer"><strong>{source.name}</strong><ExternalLink size={12} /></a><span>{source.region} · {source.type}</span></div>
      <div className="source-result"><strong className={`source-result-${statusClass}`}>{source.status}</strong><span title={resultText}>{resultText}</span></div>
    </div>
  );
}

function SourcePanel({ sources }: { sources: SourceHealth[] }) {
  const [region, setRegion] = useState<"全部" | "国内" | "海外">("全部");
  const [search, setSearch] = useState("");
  const online = sources.filter((source) => source.status === "在线").length;
  const filtered = sources.filter((source) => (region === "全部" || source.region === region)
    && source.name.toLowerCase().includes(search.trim().toLowerCase()));
  return (
    <section className="intel-panel source-panel" id="source-health">
      <div className="panel-heading"><div><div className="section-kicker">SOURCE NETWORK</div><h2>全球信源</h2></div><span className="source-health-score">{sources.length} 个</span></div>
      <div className="source-connection-summary"><span><i className="source-status online" />{online} 在线</span><span>{sources.filter((source) => source.status === "受限").length} 受限</span></div>
      <div className="source-region-tabs" role="tablist" aria-label="信源地区">
        {(["全部", "国内", "海外"] as const).map((item) => <button key={item} role="tab" aria-selected={region === item} className={region === item ? "selected" : ""} onClick={() => setRegion(item)}>{item}<span>{item === "全部" ? sources.length : sources.filter((source) => source.region === item).length}</span></button>)}
      </div>
      <label className="search-box source-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="查找信源" aria-label="查找信源" /></label>
      <div className="source-table-head"><span>信源 / 采集方式</span><span>本次采集</span></div>
      <div className="source-list" tabIndex={0} aria-label="信源列表">
        {filtered.map((source) => <SourceRow key={source.id} source={source} />)}
        {!filtered.length && <p className="source-empty">没有匹配的信源</p>}
      </div>
    </section>
  );
}

export default function StormEyeDashboard() {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [sourceHealth, setSourceHealth] = useState<SourceHealth[]>(seedSourceHealth);
  const [generatedAt, setGeneratedAt] = useState("");
  const [checkedAt, setCheckedAt] = useState("");
  const [live, setLive] = useState(false);
  const [stale, setStale] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<"全部" | EventKind>("全部");
  const [activeIndustry, setActiveIndustry] = useState<"全部" | Industry>("全部");
  const [activeNav, setActiveNav] = useState("今日总览");
  const [query, setQuery] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<FeedEvent | null>(null);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [watching, setWatching] = useState(true);
  const [alertRulesOpen, setAlertRulesOpen] = useState(false);
  const [alertRules, setAlertRules] = useState({ highImpact: true, official: true, industry: false });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [briefOpen, setBriefOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [radarExpanded, setRadarExpanded] = useState(false);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [sortMode, setSortMode] = useState<"最新" | "影响" | "可信">("最新");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [fontScale, setFontScale] = useState<"standard" | "large">("large");
  const [autoSync, setAutoSync] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [clock, setClock] = useState(new Date());
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [page, setPage] = useState(1);
  const loadFeeds = async (force = false) => {
    setLoading(true);
    try {
      const response = await fetch(feedSnapshotPath, { cache: force ? "reload" : "no-store" });
      if (!response.ok) throw new Error("feed request failed");
      const data = (await response.json()) as FeedResponse;
      setEvents(data.events);
      setSourceHealth(data.sourceHealth);
      setGeneratedAt(data.generatedAt);
      setCheckedAt(data.checkedAt);
      setLive(data.live);
      setStale(data.stale);
      setMessage(data.message ?? "");
    } catch {
      setLive(false);
      setStale(true);
      setMessage("静态情报快照暂时无法读取，请刷新页面重试。");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const read = (key: string) => {
      try { return window.localStorage.getItem(key); } catch { return null; }
    };
    const storedTheme = read("stormeye-theme");
    const storedFont = read("stormeye-font-scale");
    const storedAuto = read("stormeye-auto-sync");
    const storedSaved = read("stormeye-saved");
    const storedRules = read("stormeye-alert-rules");
    if (storedTheme === "dark" || storedTheme === "light") setTheme(storedTheme);
    if (storedFont === "standard" || storedFont === "large") setFontScale(storedFont);
    if (storedAuto === "false" || storedAuto === "true") setAutoSync(storedAuto === "true");
    if (storedSaved) try { setSavedIds(JSON.parse(storedSaved)); } catch { /* ignore */ }
    if (storedRules) try { setAlertRules(JSON.parse(storedRules)); } catch { /* ignore */ }
    setPreferencesLoaded(true);
    void loadFeeds();
  }, []);

  useEffect(() => {
    if (!preferencesLoaded) return;
    document.documentElement.dataset.theme = theme;
    savePreference("stormeye-theme", theme);
  }, [theme, preferencesLoaded]);
  useEffect(() => { if (preferencesLoaded) savePreference("stormeye-font-scale", fontScale); }, [fontScale, preferencesLoaded]);
  useEffect(() => { if (preferencesLoaded) savePreference("stormeye-auto-sync", String(autoSync)); }, [autoSync, preferencesLoaded]);
  useEffect(() => { if (preferencesLoaded) savePreference("stormeye-saved", JSON.stringify(savedIds)); }, [savedIds, preferencesLoaded]);
  useEffect(() => { if (preferencesLoaded) savePreference("stormeye-alert-rules", JSON.stringify(alertRules)); }, [alertRules, preferencesLoaded]);
  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (autoSync) void loadFeeds();
    }, 5 * 60_000);
    return () => window.clearInterval(timer);
  }, [autoSync]);
  useEffect(() => {
    const syncFullscreen = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", syncFullscreen);
    syncFullscreen();
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  const filteredEvents = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return [...events]
      .filter((event) => {
        const haystack = `${event.title} ${event.titleZh ?? ""} ${event.summary} ${event.summaryZh ?? ""} ${event.source} ${event.industry} ${event.tags.join(" ")}`.toLowerCase();
        return (activeFilter === "全部" || event.kind === activeFilter)
          && (activeIndustry === "全部" || event.industry === activeIndustry)
          && (!showSavedOnly || savedIds.includes(event.id))
          && (!normalized || haystack.includes(normalized));
      })
      .sort((a, b) => {
        if (sortMode === "影响") return ({ 高: 3, 中: 2, 低: 1 }[b.impact] - { 高: 3, 中: 2, 低: 1 }[a.impact]) || Date.parse(b.publishedAt) - Date.parse(a.publishedAt);
        if (sortMode === "可信") return ({ "官方原文": 3, 待核验: 2, 社区信号: 1 }[b.confidence] - { "官方原文": 3, 待核验: 2, 社区信号: 1 }[a.confidence]) || Date.parse(b.publishedAt) - Date.parse(a.publishedAt);
        return Date.parse(b.publishedAt) - Date.parse(a.publishedAt);
      });
  }, [activeFilter, activeIndustry, events, query, savedIds, showSavedOnly, sortMode]);

  const pageCount = Math.max(1, Math.ceil(filteredEvents.length / 10));
  const currentPage = Math.min(page, pageCount);
  const visibleEvents = filteredEvents.slice((currentPage - 1) * 10, currentPage * 10);
  useEffect(() => { setPage(1); }, [activeFilter, activeIndustry, query, showSavedOnly, sortMode]);

  const stats = useMemo(() => ({
    tracked: events.length,
    highImpact: events.filter((event) => event.impact === "高").length,
    needsReview: events.filter((event) => event.confidence !== "官方原文").length,
    verified: events.filter((event) => event.confidence === "官方原文").length,
  }), [events]);

  const industrySnapshot = useMemo(() => {
    const counts = new Map<Industry, number>();
    events.forEach((event) => counts.set(event.industry, (counts.get(event.industry) ?? 0) + 1));
    return industryFilters.filter((item) => item.key !== "全部")
      .map((item) => ({ industry: item.key as Industry, label: item.label, count: counts.get(item.key as Industry) ?? 0 }))
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [events]);

  const onlineSources = sourceHealth.filter((source) => source.status === "在线").length;
  const activateNav = (label: string) => {
    setActiveNav(label);
    setShowSavedOnly(false);
    setMobileNavOpen(false);
    const target = label === "事件流" ? "event-stream" : label === "趋势雷达" ? "signal-radar" : label === "信源图谱" ? "source-health" : "";
    if (target) document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
    else window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const openSaved = () => {
    setActiveNav("我的收藏");
    setShowSavedOnly(true);
    setActiveFilter("全部");
    setActiveIndustry("全部");
    document.getElementById("event-stream")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const clearView = () => {
    setShowSavedOnly(false);
    setActiveIndustry("全部");
    setActiveFilter("全部");
    setSortMode("最新");
    setQuery("");
  };
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      setMessage("当前浏览器未允许进入全屏模式。");
    }
  };

  return (
    <main className={`app-shell font-${fontScale}`}>
      <aside className={`sidebar ${sidebarCollapsed ? "collapsed" : ""} ${mobileNavOpen ? "mobile-open" : ""}`}>
        <div className="sidebar-inner">
          <div className="brand-row">
            <div className="brand-mark"><Eye size={19} /></div>
            {!sidebarCollapsed && <div className="brand-copy"><strong>StormEye AI</strong><span>全球 AI 情报工作台</span></div>}
            <button className="icon-button sidebar-toggle" onClick={() => setSidebarCollapsed((value) => !value)} aria-label={sidebarCollapsed ? "展开侧栏" : "收起侧栏"} title={sidebarCollapsed ? "展开侧栏" : "收起侧栏"}>
              {sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            </button>
          </div>
          <div className="live-pulse"><span className="live-dot" />{!sidebarCollapsed && <span>{live ? "静态快照" : "等待快照"}</span>}{!sidebarCollapsed && <span className="live-counter">{events.length}</span>}</div>
          <nav className="primary-nav" aria-label="主导航">
            <span className="nav-label">{!sidebarCollapsed && "工作台"}</span>
            {navItems.map(({ label, icon: Icon }) => <button key={label} className={`nav-item ${activeNav === label ? "active" : ""}`} title={label} onClick={() => activateNav(label)}><Icon size={17} />{!sidebarCollapsed && <span>{label}</span>}{!sidebarCollapsed && activeNav === label && <span className="nav-active-dot" />}</button>)}
          </nav>
          <div className="sidebar-rule" />
          <nav className="secondary-nav" aria-label="辅助导航">
            <span className="nav-label">{!sidebarCollapsed && "关注清单"}</span>
            <button className={`nav-item ${activeNav === "我的收藏" ? "active" : ""}`} onClick={openSaved}><Bookmark size={17} />{!sidebarCollapsed && <span>我的收藏</span>}{!sidebarCollapsed && <span className="nav-count">{savedIds.length}</span>}</button>
            <button className={`nav-item ${alertRulesOpen ? "active" : ""}`} onClick={() => { setAlertRulesOpen(true); setSettingsOpen(false); }}><Bell size={17} />{!sidebarCollapsed && <span>告警规则</span>}{!sidebarCollapsed && <span className="nav-count">{Object.values(alertRules).filter(Boolean).length}</span>}</button>
          </nav>
          <div className="sidebar-bottom">
            <button className="operator-card" onClick={() => { setSettingsOpen(true); setHelpOpen(false); }}><div className="operator-avatar">LH</div>{!sidebarCollapsed && <div className="operator-copy"><strong>情报观察员</strong><span>个人工作台</span></div>}{!sidebarCollapsed && <ChevronDown size={14} className="operator-chevron" />}</button>
            {!sidebarCollapsed && <div className="system-note"><span className="system-note-dot" /><span>静态发布 {stale ? "需关注" : "运行正常"}</span><span className="system-version">v0.2</span></div>}
          </div>
        </div>
      </aside>

      <section className={`main-panel ${sidebarCollapsed ? "sidebar-is-collapsed" : ""}`}>
        <header className="topbar">
          <div className="topbar-left"><button className="icon-button mobile-menu-button" onClick={() => setMobileNavOpen((value) => !value)} aria-label="打开导航" title="打开导航"><Menu size={19} /></button><div><div className="eyebrow"><span className="eyebrow-line" />GLOBAL AI INTELLIGENCE</div><h1>全球 AI 事件监测与事实追踪情报系统</h1></div></div>
          <div className="topbar-actions">
            <div className="quick-appearance-control" role="group" aria-label="外观主题">
              <span className="appearance-control-label">外观</span>
              <button className={`appearance-theme-button ${theme === "light" ? "selected" : ""}`} onClick={() => setTheme("light")} aria-pressed={theme === "light"} title="切换为浅色模式"><Sun size={15} /><span className="appearance-theme-label">浅色</span></button>
              <button className={`appearance-theme-button ${theme === "dark" ? "selected" : ""}`} onClick={() => setTheme("dark")} aria-pressed={theme === "dark"} title="切换为深色模式"><Moon size={15} /><span className="appearance-theme-label">深色</span></button>
            </div>
            <button className={`icon-button ${isFullscreen ? "active-icon" : ""}`} aria-label={isFullscreen ? "退出全屏" : "进入全屏"} title={isFullscreen ? "退出全屏" : "进入全屏"} onClick={() => void toggleFullscreen()}>{isFullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}</button>
            <div className="keyboard-hint"><Command size={13} /><span>K</span></div>
            <button className={`icon-button ${helpOpen ? "active-icon" : ""}`} aria-label="打开使用帮助" title="使用帮助" onClick={() => { setHelpOpen(true); setSettingsOpen(false); }}><CircleHelp size={17} /></button>
            <button className={`icon-button ${settingsOpen ? "active-icon" : ""}`} aria-label="打开设置" title="设置" onClick={() => { setSettingsOpen(true); setHelpOpen(false); }}><Settings size={17} /></button>
            <button className={`icon-button alert-button ${watching ? "watching" : ""}`} aria-label={watching ? "关闭告警监听" : "开启告警监听"} title={watching ? "关闭告警监听" : "开启告警监听"} onClick={() => setWatching((value) => !value)}><Bell size={17} fill={watching ? "currentColor" : "none"} />{watching && <span className="notification-dot" />}</button>
            <div className="topbar-avatar">LH</div>
          </div>
        </header>

        <div className="content">
          <div className="status-strip">
            <div className="status-primary"><span className={`status-dot ${stale ? "warning" : ""}`} /><strong>{live ? "静态快照已载入" : "等待快照"}</strong><span className="status-separator">/</span><span>最近发布 {formatSyncTime(generatedAt)}</span></div>
            <div className="status-secondary"><span><Zap size={13} />{onlineSources} 个信源在线</span><span className="status-separator">·</span><span>{autoSync ? "页面自动检查已开启" : "页面自动检查已暂停"}</span><span className="status-separator">·</span><span>下次发布约 {formatNextSync(clock)}</span></div>
          </div>
          {message && <div className={`notice-strip ${stale ? "warning" : ""}`}><ShieldCheck size={14} /><span>{message}</span><button onClick={() => setMessage("")} aria-label="关闭提示"><X size={13} /></button></div>}

          <section className="overview-grid">
            <div className="pulse-card primary"><div className="pulse-card-heading"><div><span className="section-kicker">AI PULSE</span><h2>本次快照</h2></div><span className="delta-chip positive"><ArrowUpRight size={14} />公开信源</span></div><div className="pulse-number-row"><strong>{stats.tracked.toLocaleString()}</strong><span>条可追踪信号</span></div><Sparkline /><div className="pulse-footnote"><span>采集时间 {formatDateTime(checkedAt)}</span><span className="mini-legend"><i className="legend-dot cyan" />{stats.verified} 条官方原文</span></div></div>
            <button className="pulse-card metric-card-button" onClick={() => { setActiveFilter("重大"); setActiveIndustry("全部"); setShowSavedOnly(false); document.getElementById("event-stream")?.scrollIntoView({ behavior: "smooth" }); }} title="查看高影响事件"><div className="metric-label"><span className="metric-icon orange"><Zap size={15} /></span>高影响事件</div><div className="metric-number">{stats.highImpact}</div><div className="metric-bottom"><span className="delta-text positive">优先查看</span><span className="metric-muted">公开信号</span></div><div className="metric-progress"><span style={{ width: `${Math.min(100, stats.highImpact * 8)}%` }} /></div></button>
            <button className="pulse-card metric-card-button" onClick={() => { setSortMode("可信"); setActiveFilter("全部"); setActiveIndustry("全部"); setShowSavedOnly(false); document.getElementById("event-stream")?.scrollIntoView({ behavior: "smooth" }); }} title="按可信度查看信号"><div className="metric-label"><span className="metric-icon violet"><ShieldCheck size={15} /></span>待核验信号</div><div className="metric-number">{stats.needsReview}</div><div className="metric-bottom"><span className="delta-text neutral">可信优先</span><span className="metric-muted">需要交叉验证</span></div><div className="metric-progress violet-progress"><span style={{ width: `${Math.min(100, stats.needsReview * 6)}%` }} /></div></button>
          </section>

          <section className="workspace-grid">
            <div className="feed-column">
              <div className="section-heading-row" id="event-stream"><div><div className="section-kicker">EVENT STREAM</div><div className="heading-with-count"><h2>事件流</h2><span className="heading-count">{filteredEvents.length.toString().padStart(2, "0")}</span></div></div><div className="heading-actions"><button className={`ghost-button ${timelineOpen ? "active-control" : ""}`} onClick={() => setTimelineOpen((value) => !value)} aria-expanded={timelineOpen}><ListFilter size={14} /><span>{sortMode}</span><ChevronDown size={13} /></button>{timelineOpen && <div className="control-popover timeline-popover"><span className="popover-title">事件排序</span>{(["最新", "影响", "可信"] as const).map((mode) => <button key={mode} className={`popover-option ${sortMode === mode ? "selected" : ""}`} onClick={() => { setSortMode(mode); setTimelineOpen(false); }}><span>{mode === "最新" ? "最新发生" : mode === "影响" ? "影响优先" : "可信优先"}</span>{sortMode === mode && <Check size={14} />}</button>)}</div>}<button className="refresh-button" onClick={() => void loadFeeds(true)} disabled={loading}><RefreshCw size={14} className={loading ? "spin" : ""} /><span>{loading ? "读取中" : "刷新快照"}</span></button></div></div>
              <div className="feed-toolbar"><div className="filter-tabs" role="tablist" aria-label="事件类型">{kindFilters.map((filter) => <button key={filter.key} role="tab" aria-selected={activeFilter === filter.key} className={`filter-tab ${activeFilter === filter.key ? "active" : ""}`} onClick={() => setActiveFilter(filter.key)}>{filter.label}</button>)}</div><label className="search-box"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索事件、信源或标签" aria-label="搜索事件、信源或标签" />{query && <button className="search-clear" onClick={() => setQuery("")} aria-label="清除搜索"><X size={14} /></button>}</label></div>
              <div className="industry-toolbar"><div className="industry-toolbar-title"><Layers3 size={13} /><span>按行业观察</span></div><div className="industry-tabs" role="tablist" aria-label="行业分类">{industryFilters.map((filter) => <button key={filter.key} role="tab" aria-selected={activeIndustry === filter.key} className={`industry-tab ${activeIndustry === filter.key ? "active" : ""}`} onClick={() => { setActiveIndustry(filter.key); setShowSavedOnly(false); }}>{filter.label}</button>)}</div></div>
              <div className="industry-snapshot"><span className="industry-snapshot-label">行业脉搏</span>{industrySnapshot.slice(0, 6).map((item) => <button key={item.industry} className={`industry-snapshot-chip ${activeIndustry === item.industry ? "active" : ""}`} onClick={() => { setActiveIndustry(item.industry); setShowSavedOnly(false); }} title={`查看${item.industry}事件`}><span>{item.label}</span><b>{item.count}</b></button>)}</div>
              {(showSavedOnly || activeIndustry !== "全部" || activeFilter !== "全部" || sortMode !== "最新" || query) && <div className="active-filter-summary"><span>当前视图：{showSavedOnly ? " 我的收藏" : activeIndustry !== "全部" ? ` ${activeIndustry}` : activeFilter !== "全部" ? ` ${activeFilter}` : " 全部事件"}{sortMode !== "最新" ? ` · ${sortMode}优先` : ""}{query ? ` · 搜索“${query}”` : ""}</span><button onClick={clearView}>清除视图<X size={12} /></button></div>}
              <div className="event-list">{visibleEvents.length ? visibleEvents.map((event) => <EventCard key={event.id} event={event} saved={savedIds.includes(event.id)} onOpen={() => setSelectedEvent(event)} onSave={() => setSavedIds((current) => current.includes(event.id) ? current.filter((item) => item !== event.id) : [...current, event.id])} />) : <div className="empty-state"><Search size={18} /><strong>{events.length ? "没有匹配的事件" : "等待静态快照"}</strong><span>{events.length ? "换个关键词，或者清除当前筛选。" : "点击刷新快照读取最新发布内容。"}</span>{events.length === 0 && <button className="refresh-button" onClick={() => void loadFeeds(true)} disabled={loading}><RefreshCw size={14} className={loading ? "spin" : ""} />读取快照</button>}</div>}</div>
              {filteredEvents.length > 10 && <nav className="event-pagination" aria-label="事件分页"><span>共 {filteredEvents.length} 条事件</span><div><button className="icon-button" aria-label="上一页" title="上一页" disabled={currentPage === 1} onClick={() => { setPage(currentPage - 1); document.getElementById("event-stream")?.scrollIntoView({ behavior: "smooth" }); }}><ChevronLeft size={18} /></button><span>{currentPage} / {pageCount}</span><button className="icon-button" aria-label="下一页" title="下一页" disabled={currentPage === pageCount} onClick={() => { setPage(currentPage + 1); document.getElementById("event-stream")?.scrollIntoView({ behavior: "smooth" }); }}><ChevronRight size={18} /></button></div></nav>}
            </div>

            <aside className="intel-column">
              <section className={`intel-panel signal-panel ${radarExpanded ? "expanded-panel" : ""}`} id="signal-radar"><div className="panel-heading"><div><div className="section-kicker">SIGNAL RADAR</div><h2>热度雷达</h2></div><button className={`icon-button small ${radarExpanded ? "active-icon" : ""}`} aria-label="切换热度排序" title="切换热度排序" onClick={() => setRadarExpanded((value) => !value)}><Filter size={14} /></button></div><div className="heat-list">{(radarExpanded ? [...topicHeat].sort((a, b) => b.score - a.score) : topicHeat).map((topic, index) => <div className="heat-row" key={topic.label}><span className="heat-index">0{index + 1}</span><span className="heat-label">{topic.label}</span><div className="heat-track"><span className={`heat-fill ${topic.color}`} style={{ width: `${topic.score}%` }} /></div><span className="heat-score">{topic.score}</span></div>)}</div><div className="panel-footnote"><span>{radarExpanded ? "已按热度降序排列 · 再点一次恢复" : "讨论量、来源质量、传播速度综合指数"}</span><ArrowUpRight size={13} /></div></section>
              <section className="intel-panel region-panel"><div className="panel-heading"><div><div className="section-kicker">GEO DISTRIBUTION</div><h2>热点来源地</h2></div><Globe2 size={16} className="panel-heading-icon" /></div><div className="region-visual"><div className="world-grid" aria-hidden="true">{Array.from({ length: 48 }).map((_, index) => <span key={index} className={index % 7 === 0 || index % 11 === 0 ? "lit" : ""} />)}</div><div className="world-annotation"><span className="annotation-pulse" /><strong>全球</strong><span>实时信号分布</span></div></div><div className="region-list">{regions.map((region) => <div className="region-row" key={region.code}><span className={`region-code ${region.tone}`}>{region.code}</span><span className="region-name">{region.name}</span><div className="region-bar"><span className={region.tone} style={{ width: `${region.value * 2}%` }} /></div><span className="region-value">{region.value}%</span><span className={`region-delta ${region.delta.startsWith("+") ? "positive" : "negative"}`}>{region.delta}</span></div>)}</div></section>
              <SourcePanel sources={sourceHealth} />
              <section className="brief-card"><div className="brief-orbit"><Sparkles size={18} /></div><div><div className="section-kicker">DAILY BRIEF</div><h3>今天的风向</h3><p>Agent 正在从“会回答”走向“能交付”。别只盯模型参数，看看谁把失败处理做好了。</p></div><button className="brief-arrow" aria-label="打开今日简报" title="打开今日简报" onClick={() => setBriefOpen(true)}><ArrowUpRight size={16} /></button></section>
            </aside>
          </section>
          <footer className="app-footer"><span>{APP_NAME} · 情报不是越多越好，是越可验证越好。</span><span className="footer-right"><span>数据策略：公开信源优先</span><span className="footer-dot">·</span><span>更新时间 {formatSyncTime(generatedAt)}</span></span></footer>
        </div>
      </section>

      {selectedEvent && <div className="modal-backdrop" onClick={() => setSelectedEvent(null)}><div className="event-modal" role="dialog" aria-modal="true" aria-label="事件详情" onClick={(event) => event.stopPropagation()}><div className="modal-accent" /><div className="modal-header"><div className="event-breadcrumb"><span className={`kind-dot ${kindClass(selectedEvent.kind)}`} /><span className={`kind-label ${kindClass(selectedEvent.kind)}`}>{selectedEvent.kind}</span><span className="dot-divider">·</span><span>{selectedEvent.source}</span></div><button className="icon-button" onClick={() => setSelectedEvent(null)} aria-label="关闭详情" title="关闭详情"><X size={17} /></button></div><EventContent event={events.find((event) => event.id === selectedEvent.id) ?? selectedEvent} detail /><div className="modal-facts"><div><span>事实状态</span><strong>{selectedEvent.confidence}</strong></div><div><span>影响等级</span><strong>{selectedEvent.impact}影响</strong></div><div><span>行业分类</span><strong>{selectedEvent.industry}</strong></div><div><span>发布时间</span><strong>{formatDateTime(selectedEvent.publishedAt)}</strong></div></div><div className="modal-tags">{selectedEvent.tags.map((tag) => <span key={tag} className="event-tag">{tag}</span>)}</div><div className="modal-footer"><span className="modal-note"><ShieldCheck size={14} />机器译文仅供参考，事实以原始信源为准</span><a href={selectedEvent.sourceUrl} target="_blank" rel="noreferrer" className="source-link">查看原始信源<ExternalLink size={14} /></a></div></div></div>}

      {helpOpen && <div className="modal-backdrop" onClick={() => setHelpOpen(false)}><div className="utility-modal help-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}><div className="modal-accent" /><div className="utility-modal-header"><div><div className="section-kicker">QUICK GUIDE</div><h2>怎么用 StormEye</h2></div><button className="icon-button" onClick={() => setHelpOpen(false)} aria-label="关闭帮助" title="关闭帮助"><X size={17} /></button></div><div className="guide-list"><div><strong>1</strong><span>点事件卡片查看摘要、事实状态和原始信源。</span></div><div><strong>2</strong><span>用行业筛选观察基础模型、机器人、金融、能源等赛道。</span></div><div><strong>3</strong><span>收藏重要事件，左侧“我的收藏”只保留你的关注项。</span></div><div><strong>4</strong><span>顶部可直接切换外观，设置中可调整字号和快照检查。</span></div></div><div className="utility-modal-footer"><ShieldCheck size={14} /><span>事实状态是公开信源的交叉结果，不替代人工判断。</span></div></div></div>}

      {briefOpen && <div className="modal-backdrop" onClick={() => setBriefOpen(false)}><div className="utility-modal brief-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}><div className="modal-accent" /><div className="utility-modal-header"><div><div className="section-kicker">DAILY BRIEF · {formatSyncTime(generatedAt)}</div><h2>今天的风向</h2></div><button className="icon-button" onClick={() => setBriefOpen(false)} aria-label="关闭简报" title="关闭简报"><X size={17} /></button></div><p className="brief-modal-lead">Agent 正在从“会回答”走向“能交付”。今天值得追踪的，不只是模型发布，而是谁把上下文、工具权限和失败恢复真正做成了产品。</p><div className="brief-highlights">{[["01", "Agent 工程化", "运行时、评测和可观测性正在成为落地差异。"], ["02", "推理成本", "每一个 token 都开始进入产品经理和财务的视野。"], ["03", "可信信息", "多源交叉与原始信源，比转发速度更值得下注。"]].map(([index, title, copy]) => <div key={index}><span>{index}</span><strong>{title}</strong><p>{copy}</p></div>)}</div></div></div>}

      {settingsOpen && <div className="modal-backdrop" onClick={() => setSettingsOpen(false)}><div className="utility-modal settings-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}><div className="modal-accent" /><div className="utility-modal-header"><div><div className="section-kicker">WORKSPACE SETTINGS</div><h2>工作台设置</h2></div><button className="icon-button" onClick={() => setSettingsOpen(false)} aria-label="关闭设置" title="关闭设置"><X size={17} /></button></div><div className="settings-section"><div className="settings-label"><span className="settings-label-icon"><Type size={15} /></span><div><strong>阅读字号</strong><span>适合长时间浏览事件流</span></div></div><div className="segmented-control"><button className={fontScale === "standard" ? "selected" : ""} onClick={() => setFontScale("standard")}>标准</button><button className={fontScale === "large" ? "selected" : ""} onClick={() => setFontScale("large")}>舒适</button></div></div><div className="settings-section sync-setting"><div className="settings-label"><span className="settings-label-icon"><RefreshCw size={15} /></span><div><strong>快照自动检查</strong><span>页面打开时定时读取已发布内容</span></div></div><label className="switch-row"><span>{autoSync ? "已开启" : "已暂停"}</span><button className={`switch ${autoSync ? "on" : ""}`} onClick={() => setAutoSync((value) => !value)} role="switch" aria-checked={autoSync} aria-label="切换快照自动检查"><span /></button></label><div className="next-sync-note"><Clock3 size={13} />页面每 5 分钟检查 · GitHub 约每天 08:00 发布</div></div><div className="utility-modal-footer"><Settings size={14} /><span>设置会保存在本机浏览器中，刷新页面后仍然有效。</span></div></div></div>}

      {alertRulesOpen && <div className="modal-backdrop" onClick={() => setAlertRulesOpen(false)}><div className="utility-modal alert-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}><div className="modal-accent" /><div className="utility-modal-header"><div><div className="section-kicker">ALERT RULES</div><h2>告警规则</h2></div><button className="icon-button" onClick={() => setAlertRulesOpen(false)} aria-label="关闭告警规则" title="关闭告警规则"><X size={17} /></button></div><p className="alert-lead">只在值得打断你的时候提醒。规则保存在本机，默认不发送外部通知。</p><div className="alert-rule-list">{[["highImpact", "高影响事件", "影响等级为高时提醒"], ["official", "官方信源更新", "OpenAI、NVIDIA 等官方源出现新条目"], ["industry", "行业热点跃迁", "某行业热度指数单日明显上升"]].map(([key, title, description]) => <div className="alert-rule-row" key={key}><div><strong>{title}</strong><span>{description}</span></div><button className={`switch ${alertRules[key as keyof typeof alertRules] ? "on" : ""}`} onClick={() => setAlertRules((current) => ({ ...current, [key]: !current[key as keyof typeof current] }))} role="switch" aria-checked={alertRules[key as keyof typeof alertRules]} aria-label={`切换${title}`}><span /></button></div>)}</div><div className="utility-modal-footer"><Bell size={14} /><span>当前启用 {Object.values(alertRules).filter(Boolean).length} 条规则 · 仅在页面打开时提示</span></div></div></div>}
    </main>
  );
}
