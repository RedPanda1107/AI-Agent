# 下次工作计划

**创建日期：** 2026-08-03（更新版 v2）
**前置状态：** Phase 2 ✅ Phase 3 ✅ Phase 4 🔶 进行中

---

## 背景

本次会话（2026-08-03 afternoon）完成了 Phase 3 Multi-Agent Workflow 完整闭环的实现，并成功初始化了 shadcn/ui（v3）。

**Phase 3 完成验收记录：**
- ✅ 所有 5 个 Agent Node 实现了真实的 LLM 调用（通过 LangGraph `configurable` 参数注入 LLMProvider）
- ✅ `WorkflowController` SSE 与 `WorkflowService` 通过内存 Map（`subscribers`）连接
- ✅ 前端 `ChatPage` 集成了工作流触发（自动识别产品想法）和 Workflow SSE 事件接收
- ✅ 每个 `AgentRun` 记录持久化到 PostgreSQL（input, output, status）
- ✅ `WorkflowRun` 状态正确更新为 COMPLETED / FAILED
- ✅ E2E 测试通过：5 个 Agent 在 ~57 秒内完成，输出结果符合预期

**shadcn/ui 初始化：**
- ✅ `components.json` 已创建（style: new-york, iconLibrary: lucide）
- ✅ `@/lib/utils` 已创建（clsx + tailwind-merge）
- ✅ `tailwind.config.ts` 已更新（shadcn CSS variables）
- ✅ `src/styles.css` 已更新（shadcn CSS variables）
- ✅ 组件已安装：Button, Badge, Card, Dialog, DropdownMenu, Separator, ScrollArea, Skeleton
- ✅ `@radix-ui/*` 依赖已安装

---

## 下次工作计划

### Step 1：Phase 4 — 工作流可视化与结果展示

#### Step 1.1：实现前端 `/projects/:id/workflow` 路由

1. 在 `App.tsx` 中添加新路由
2. 创建 `WorkflowPage.tsx` 组件，展示：
   - 5 个节点的进度状态（pending / running / completed / failed）
   - 每个节点的输入/输出 JSON 可折叠展示
   - AgentRun 详情（耗时、状态）

#### Step 1.2：在 ChatPage 中添加结果查看入口

1. 工作流完成后，显示"查看完整方案"按钮
2. 点击跳转到 `/projects/:id/workflow`

#### Step 1.3：前端 Agent 结果展示

1. 在 `ChatPage` 中，`node.completed` 事件触发时：
   - 在消息区域添加一个格式化卡片，显示节点输出
   - 使用 ReactMarkdown 或自定义渲染展示结构化结果
2. 定义各 Agent 结果的渲染模板（Planner → 目标列表，Research → 竞品分析，Product → 功能列表，PRD → 文档，Task → 任务列表）

---

### Step 2（可选）：PRD 持久化与编辑

1. 工作流完成后，将 PRD Agent 的输出保存为 `Document` 记录（`DocumentType.PRD`）
2. 将 Task Agent 的输出导入为 `Task` 记录
3. 添加 `/projects/:id/documents/:docId` 编辑页面（Monaco Editor 集成）

---

### Step 3（可选）：React Flow 工作流图

使用 `@xyflow/react` 实现节点状态可视化：
- 5 个节点横向排列
- 节点颜色根据状态变化（pending → running → completed / failed）
- 节点完成后可点击查看输入输出详情

---

## 验收标准

Phase 4 完成的验收标准：
- [ ] `/projects/:id/workflow` 页面可访问
- [ ] 工作流节点状态实时更新
- [ ] 各 Agent 输出结果可查看
- [ ] PRD 和 Task 结果保存到数据库

---

## 依赖资源

- 后端运行：`npm run start:dev`（http://localhost:3000）
- 前端运行：`npm run dev`（http://localhost:5173）
- PostgreSQL：Docker 容器（localhost:5432）
- DeepSeek API：已配置在 `backend/.env`
- 代码参考：
  - `frontend/src/features/chat/ChatPage.tsx` — 已有工作流 SSE 接收逻辑
  - `frontend/src/components/ui/*` — shadcn 组件
  - `backend/src/workflow/` — 工作流后端代码
