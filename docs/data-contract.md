# StormEye 数据契约

本文档描述服务端接口和前端组件共享的核心数据结构。实现以 `app/lib/types.ts` 为准；修改字段时应同时更新类型、接口调用方和测试。

## FeedEvent

事件对象表示一条经过规范化的公开信源条目。

| 字段 | 类型 | 约束 |
| --- | --- | --- |
| `id` | `string` | 稳定唯一标识；由信源和 URL 哈希生成，API/组件之间不可变 |
| `title` | `string` | 清理 HTML 后的原文标题 |
| `titleZh` | `string?` | 英文标题的机器翻译；不覆盖 `title` |
| `summary` | `string` | 清理 HTML 后的原文摘要，最多 420 字符 |
| `summaryZh` | `string?` | 英文摘要的机器翻译；不覆盖 `summary` |
| `translationStatus` | `ready \| partial \| unavailable?` | 翻译状态 |
| `translationProvider` | `string?` | 翻译服务名称 |
| `source` | `string` | 对应 `SourceDefinition.name` |
| `sourceType` | `官方 \| 媒体 \| 社区 \| 论文 \| 代码` | 信号来源类型 |
| `sourceUrl` | `string` | 经过协议、凭据和锚点清理的 HTTP(S) 原文链接 |
| `publishedAt` | `string` | ISO 8601 时间；只接受过去 30 天内的条目 |
| `relativeTime` | `string` | 根据当前时间生成的中文相对时间 |
| `kind` | `重大 \| 产品 \| 研究 \| 开源 \| 政策` | 事件类型 |
| `industry` | `Industry` | 由标题和摘要推断的行业分类 |
| `tags` | `string[]` | 信源类型和业务标签 |
| `confidence` | `官方原文 \| 待核验 \| 社区信号` | 事实状态，不代表内容绝对正确 |
| `impact` | `高 \| 中 \| 低` | 规则化影响等级 |
| `region` | `CN \| GLOBAL` | 事件所属信源区域 |
| `signal` | `number` | 预留的综合信号分；当前采集结果默认为 0 |

## SourceDefinition

信源目录位于 `app/lib/sources.ts`。每条定义必须包含唯一 `id`、展示名、地区、信源类型、主页、采集端点和适配器。

支持的适配器：

- `rss`：解析 RSS/Atom，并读取标准发布时间和链接
- `html`：从列表页识别文章，再读取文章 JSON-LD、meta 或 `time`
- `hn`：读取 Hacker News Algolia API
- `github`：读取 GitHub 仓库搜索 API

`aiOnly` 表示是否跳过通用信源中的非 AI 条目；`articlePath` 和 `dateSelector` 仅用于 HTML 信源。

## SourceHealth

信源健康对象用于展示一次采集的可观测结果：

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `id` / `name` / `home` | `string` | 信源身份和主页 |
| `region` | `国内 \| 海外` | 信源地区 |
| `type` | `string` | 信源类型与采集方式 |
| `status` | `在线 \| 受限 \| 待连接` | 本次连接结果 |
| `latency` | `string` | 本次请求耗时 |
| `freshness` | `string` | 最新条目的相对时间或失败说明 |
| `latestAt` | `string?` | 本次最新条目的 ISO 时间 |
| `eventCount` | `number` | 本次采集并保留的事件数量 |
| `detail` | `string?` | 面向用户的状态说明 |

## FeedResponse

`GET /api/feeds` 和 `POST /api/feeds` 返回：

```ts
type FeedResponse = {
  catalogVersion?: string;
  events: FeedEvent[];
  sourceHealth: SourceHealth[];
  generatedAt: string;
  live: boolean;
  checkedAt: string;
  stale: boolean;
  message?: string;
};
```

`GET` 遵循快照和北京时间日更边界；`POST` 用于手动刷新，但服务端仍会限制短时间重复刷新。`stale: true` 时，页面应明确显示数据可能包含历史快照。

## 修改约定

1. 新增字段先更新 `app/lib/types.ts`，再更新生产者和消费者。
2. 新增枚举值时同步更新筛选器、样式映射和测试。
3. 信源 URL 必须为 HTTPS，且不得包含账号、密码或私有 token。
4. 任何会影响去重、时间窗口、可信状态的修改，都要补充 `tests/feeds.test.mjs`。
