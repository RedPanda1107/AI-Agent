# AI Product Manager Agent

一个以 Multi-Agent 工作流驱动的智能产品经理系统。MVP 聚焦可演示闭环：用户输入产品创意后，Planner、Research、Product、PRD 与 Task 五个独立 Agent 依次生成产品方案、PRD 和研发任务，并通过 SSE 与工作流图实时呈现过程。

## 文档导航

- [架构设计](docs/architecture.md)
- [开发计划与任务清单](docs/development-plan.md)
- [项目执行计划与进度](docs/project-plan.md)

## 目标技术栈

| 层级 | 技术 |
| --- | --- |
| Web 前端 | React、TypeScript、Vite、Tailwind CSS、shadcn/ui、React Flow、Zustand、React Markdown、Monaco Editor |
| API / 编排 | Node.js、NestJS、TypeScript、LangChain.js、LangGraph.js |
| 数据 | PostgreSQL、Prisma、Redis |
| 模型 | OpenAI API、Claude API（通过统一模型适配层接入） |

MVP 模型接入使用 Kimi（Moonshot），但 Agent 仅依赖 `LLMProvider` 接口，后续可以无业务代码改动地新增其他供应商。

## 目录（目标）

```text
ai-product-manager-agent/
├─ frontend/
├─ backend/
├─ docs/
├─ docker-compose.yml
└─ README.md
```

## 当前阶段：Phase 1 & Phase 2 工程就绪

本阶段已完成 React / NestJS / Prisma / PostgreSQL / Redis 工程底座和 Chat 闭环代码。完整范围、里程碑和任务见开发计划。

## 启动方式

### 本地开发（推荐）

1. 启动 Docker 容器（数据库和 Redis）：

```bash
docker compose up -d postgres redis
```

2. 填写 Kimi 配置：`backend/.env` 中的 `KIMI_API_KEY` 和 `KIMI_MODEL`。
3. 执行数据库迁移：

```bash
cd backend && npx prisma migrate deploy
```

4. 启动后端和前端：

```bash
# 终端 1
cd backend && npm run start:dev

# 终端 2
cd frontend && npm run dev
```

5. 打开 http://localhost:5173，后端健康检查为 http://localhost:3000/health。

### Docker 方式

```bash
docker compose up --build
```

首次启动后，在 backend 容器中执行 `npx prisma migrate deploy` 创建表结构。
