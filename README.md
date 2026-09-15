# StormEye AI｜全球 AI 事件监测与事实追踪情报系统

StormEye AI 是一个面向研究、产品和投资观察的全球 AI 事件情报工作台。它聚合国内外公开信源，按行业和事件类型整理 AI 动态，并保留原始链接、发布时间、信源类型与事实状态，方便继续核验。

## 当前能力

- 30 个国内外公开信源，覆盖官方博客、科技媒体、论文、开发者社区和代码平台
- 事件按基础模型、智能体与办公、机器人与自动驾驶、能源与工业、金融、医疗与生命科学、安全与政策、开发者基础设施分类
- 事件类型包含重大信号、产品发布、研究论文、开源项目和政策观察
- 原文优先展示；英文标题和摘要在页面下方提供中文机器翻译
- 信源健康状态、连接延迟、采集数量和最近更新时间可查看
- 收藏、搜索、排序、行业筛选、深色模式和舒适字号设置保存在浏览器本机
- GitHub Pages 静态快照约在北京时间每天 08:00 自动重建，也可手动运行工作流

## 技术栈

- Next.js 16 App Router
- React 19 + TypeScript
- `fast-xml-parser` 解析 RSS/Atom
- `cheerio` 解析网页文章和 JSON-LD
- `lucide-react` 图标
- GitHub Actions + GitHub Pages（静态发布与日更构建）

## 本地运行

环境要求：Node.js 20.9+。

```bash
npm install
npm run dev
```

打开 `http://localhost:3000`。

## 常用命令

```bash
npm test       # RSS、网页解析、AI 过滤、翻译缓存等测试
npm run lint   # TypeScript 类型检查
npm run build  # 生成 out/ 静态站点和数据快照
```

## 环境变量

复制 `.env.example` 为 `.env.local`，按需配置翻译服务：

| 变量 | 用途 |
| --- | --- |
| `STORMEYE_TRANSLATE_URL` | 兼容 LibreTranslate 的自定义翻译接口 |
| `STORMEYE_TRANSLATE_KEY` | 自定义翻译接口密钥 |
| `STORMEYE_TRANSLATE_EMAIL` | MyMemory 的可选联系邮箱 |
| `STORMEYE_DATA_DIR` | 服务端快照和翻译缓存目录；默认使用项目 `.stormeye/` |

`.env.local`、缓存目录和构建产物已加入 `.gitignore`，不要把真实密钥提交到仓库。

## GitHub Pages 发布

本仓库已包含 `.github/workflows/deploy-pages.yml`。推送到 `main` 后，GitHub Actions 会执行静态构建，在构建阶段采集公开信源并生成 `/data/feeds.json`，随后把 `out/` 发布到 GitHub Pages。工作流也会约在每天北京时间 08:00（UTC 00:00）运行一次。

首次启用时，在仓库的 **Settings → Pages → Build and deployment** 中把 Source 设置为 **GitHub Actions**。发布成功后的公开地址为：

```text
https://qiuy6797-bot.github.io/StormEyeAl-Global-AI-Powered-Incident-Monitoring-and-Fact-Tracking-Intelligence-System/
```

GitHub Pages 是静态托管。页面中的“刷新快照”只会重新读取最近一次发布的数据，不会在浏览器中现场抓取信源。

仓库内的 `data/feeds.snapshot.json` 是首次发布或信源暂时受限时使用的可核验快照；后续构建会优先恢复最近一次 Pages 发布的数据。

## 数据更新与可信边界

每次静态构建都会调用 `/data/feeds.json` 的构建期 Route Handler，采集信源并生成快照。GitHub Actions 的 `0 0 * * *` 计划为 UTC 00:00，即北京时间 08:00；推送代码和手动运行工作流也会触发构建。构建前会尝试恢复上一次已发布的快照，以便部分信源短暂不可用时保留有效期内的数据。

采集器只保留近 30 天、日期有效且通过 AI 相关性过滤的条目。官方原文、媒体报道、社区讨论等信号会分别标注，机器翻译仅用于阅读，事实判断应回到事件卡片中的原始信源。

字段定义、枚举和扩展约定见 [`docs/data-contract.md`](docs/data-contract.md)。新增或替换信源时，请同步更新 `app/lib/sources.ts` 中的唯一 `id`、主页、端点、地区、适配器和信源类型。

## 项目结构

```text
app/
  components/       # StormEye 主界面
  data/             # 构建期生成静态 feeds.json
  lib/
    classify.ts     # 行业分类
    config.ts       # 产品名称与日更边界
    feed-store.ts   # 快照缓存与刷新策略
    feeds.ts        # RSS、网页、API 采集和规范化
    language.ts     # 语言判断
    sources.ts      # 30 个信源目录
    translate.ts    # 翻译缓存与并发控制
    types.ts        # 事件和信源类型
tests/              # Node 测试
.github/workflows/  # GitHub Pages 构建与发布
```

## 部署

GitHub Pages 工作流使用 Node.js 20、`npm ci` 和 `npm run build`。公开信源存在访问限制、延迟或临时不可用的可能，页面会显示每个信源最近一次构建时的状态。需要即时服务端刷新时，应部署到支持 Node.js 的平台。

## 许可

当前仓库未附加开源许可证。若要对外分发或接受贡献，请先补充适合项目的许可证和贡献规范。
