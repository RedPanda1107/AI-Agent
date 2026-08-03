# 下次工作计划

**创建日期：** 2026-08-03（更新版 v3）
**前置状态：** Phase 2 ✅ Phase 3 ✅ Phase 4 ✅ 已完成

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

#### ✅ 已完成

1. **前端 `/projects/:id/workflow` 路由**
   - 支持 URL 直接访问，自动加载该项目的最新工作流
   - 支持多版本运行记录切换（select 下拉）

2. **ChatPage 中"查看完整方案"按钮**
   - 工作流完成后 Header 显示绿色"查看完整方案"链接

3. **前端 Agent 结果实时展示**
   - `node.completed` 事件触发时，ChatPage 消息区显示格式化卡片
   - Planner → 目标列表、Research → 竞品分析、Product → 功能列表（带优先级标签）
   - PRD → 文档摘要、Task → 任务表格（带优先级和预估时间）

4. **React Flow 工作流图**
   - 5 个节点横向排列，节点颜色根据状态变化（pending → running → completed/failed）
   - 集成 `@xyflow/react`，动画连接线

5. **PRD 持久化与 Task 持久化**
   - `workflow.service.ts` 的 `persistResults()` 自动保存：
     - PRD Agent 输出 → `Document` 记录（type: PRD）
     - Task Agent 输出.tasks → `Task` 记录

---

### 下一步：Phase 5 — 用户身份与项目列表

1. 添加用户认证（JWT / NextAuth）
2. 实现 `/projects` 项目列表页面
3. 实现 `/projects/:id` 项目详情页面
4. 添加 Monaco Editor 集成用于 PRD 编辑
5. 集成 pgvector 实现语义检索

---

## 验收标准

Phase 4 完成的验收标准：
- [x] `/projects/:id/workflow` 页面可访问
- [x] 工作流节点状态实时更新
- [x] 各 Agent 输出结果可查看
- [x] PRD 和 Task 结果保存到数据库

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
