import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  createMessage,
  getMessages,
  openStream,
  startWorkflow,
  openWorkflowStream,
} from './chat.api';
import { useChatStore } from './chat.store';
import type { ChatMessage, WorkflowEvent, AgentName } from './chat.types';

const AGENT_ORDER: AgentName[] = ['planner', 'research', 'product', 'prd', 'task'];
const AGENT_LABELS: Record<AgentName, string> = {
  planner: '🎯 Planner',
  research: '🔍 Research',
  product: '💡 Product',
  prd: '📝 PRD',
  task: '✅ Task',
};

const WORKFLOW_TRIGGERS = ['开始工作流', 'start workflow', '启动', '生成方案', '开始规划'];

function looksLikeWorkflowIdea(content: string): boolean {
  return (
    content.trim().length > 10 &&
    (WORKFLOW_TRIGGERS.some((t) => content.includes(t)) ||
      /[\u4e00-\u9fa5]/.test(content) ||
      content.length > 30)
  );
}

// --- Agent output types (must match backend schema) ---

interface PlannerOutput {
  goals: string[];
  assumptions: string[];
  risks: string[];
  reasoning?: string;
}
interface ResearchOutput {
  marketOverview?: string;
  competitors?: Array<{ name: string; strengths: string; weaknesses: string }>;
  opportunities?: string[];
  reasoning?: string;
}
interface ProductOutput {
  userPersona?: string;
  painPoints?: string[];
  positioning?: string;
  features?: Array<{ name: string; description: string; priority: 'HIGH' | 'MEDIUM' | 'LOW' }>;
  userFlows?: string[];
  reasoning?: string;
}
interface PrdOutput {
  title?: string;
  background?: string;
  userProfiles?: string;
  functionalRequirements?: string;
  pageDesign?: string;
  acceptanceCriteria?: string[];
  reasoning?: string;
}
interface TaskOutput {
  tasks?: Array<{ title: string; description?: string; priority: 'HIGH' | 'MEDIUM' | 'LOW'; estimateDays?: number }>;
  reasoning?: string;
}

type AgentOutput = PlannerOutput | ResearchOutput | ProductOutput | PrdOutput | TaskOutput;

const AGENT_OUTPUT_ICONS: Record<AgentName, string> = {
  planner: '🎯', research: '🔍', product: '💡', prd: '📝', task: '✅',
};

const PRIORITY_COLORS: Record<string, string> = {
  HIGH: 'bg-red-50 text-red-600 border-red-200',
  MEDIUM: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  LOW: 'bg-gray-50 text-gray-500 border-gray-200',
};

export function ChatPage({ projectId }: { projectId: string }) {
  const [input, setInput] = useState('');
  const chatEs = useRef<EventSource | null>(null);
  const workflowEs = useRef<EventSource | null>(null);
  const [completedNodeCards, setCompletedNodeCards] = useState<
    Array<{ node: AgentName; output: AgentOutput; ts: number }>
  >([]);

  const {
    messages,
    isStreaming,
    error,
    workflowStatus,
    nodeStates,
    workflowError,
    setProject,
    setMessages,
    addMessage,
    startStream,
    appendDelta,
    completeStream,
    failStream,
    startWorkflow: startWf,
    handleWorkflowEvent,
    resetWorkflow,
  } = useChatStore();

  useEffect(() => {
    setProject(projectId);
    resetWorkflow();
    setCompletedNodeCards([]);
    void getMessages(projectId)
      .then(setMessages)
      .catch((e: unknown) => failStream(e instanceof Error ? e.message : '无法加载消息'));

    return () => {
      chatEs.current?.close();
      workflowEs.current?.close();
    };
  }, [projectId, setProject, setMessages, failStream, resetWorkflow]);

  function subscribeChatStream(streamId: string): void {
    chatEs.current?.close();
    const source = openStream(projectId, streamId);
    chatEs.current = source;

    source.addEventListener('message.delta', (e) => {
      const data = JSON.parse(e.data) as { streamId: string; delta: string };
      appendDelta(data.streamId, data.delta);
    });
    source.addEventListener('message.complete', (e) => {
      const data = JSON.parse(e.data) as { streamId: string; message: ChatMessage };
      completeStream(data.streamId, data.message);
      source.close();
    });
    source.addEventListener('message.error', (e) => {
      const data = JSON.parse(e.data) as { message: string };
      failStream(data.message);
      source.close();
    });
    source.onerror = () => {
      failStream('流式连接已中断，请重试。');
      source.close();
    };
  }

  function subscribeWorkflowStream(runId: string): void {
    workflowEs.current?.close();
    const source = openWorkflowStream(runId);
    workflowEs.current = source;

    source.addEventListener('connected', () => {
      console.log('[Workflow] SSE connected:', runId);
    });

    source.addEventListener('run.started', (e) => {
      setCompletedNodeCards([]);
      handleWorkflowEvent(JSON.parse(e.data) as WorkflowEvent);
    });
    source.addEventListener('node.started', (e) => {
      handleWorkflowEvent(JSON.parse(e.data) as WorkflowEvent);
    });
    source.addEventListener('node.delta', (e) => {
      handleWorkflowEvent(JSON.parse(e.data) as WorkflowEvent);
    });
    source.addEventListener('node.completed', (e) => {
      const event = JSON.parse(e.data) as WorkflowEvent;
      handleWorkflowEvent(event);
      if (event.node && event.data) {
        setCompletedNodeCards((prev) => [
          ...prev,
          { node: event.node as AgentName, output: event.data as AgentOutput, ts: Date.now() },
        ]);
      }
    });
    source.addEventListener('node.failed', (e) => {
      handleWorkflowEvent(JSON.parse(e.data) as WorkflowEvent);
    });
    source.addEventListener('run.completed', (e) => {
      handleWorkflowEvent(JSON.parse(e.data) as WorkflowEvent);
      source.close();
    });
    source.onerror = () => {
      console.warn('[Workflow] SSE connection error');
      source.close();
    };
  }

  async function send(): Promise<void> {
    const content = input.trim();
    if (!content || isStreaming) return;

    setInput('');

    if (looksLikeWorkflowIdea(content)) {
      setCompletedNodeCards([]);
      try {
        const { runId } = await startWorkflow({ projectId, idea: content });
        startWf(runId);
        subscribeWorkflowStream(runId);
      } catch (e) {
        failStream(e instanceof Error ? e.message : '启动工作流失败');
      }
    } else {
      try {
        const { userMessage, streamId } = await createMessage(projectId, content);
        addMessage(userMessage);
        startStream(streamId);
        subscribeChatStream(streamId);
      } catch (e) {
        failStream(e instanceof Error ? e.message : '发送失败');
      }
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f]">
      <header className="sticky top-0 z-10 border-b border-black/[0.06] bg-white/80 px-5 backdrop-blur-xl sm:px-8">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between">
          <a
            href="/"
            className="flex items-center gap-2.5 rounded-lg text-[15px] font-semibold tracking-[-0.02em]"
          >
            <span className="grid h-7 w-7 place-items-center rounded-[9px] bg-[#0071e3] text-sm text-white">
              ✦
            </span>
            Product Agent
          </a>
          <div className="flex items-center gap-3">
            {workflowStatus === 'running' && (
              <span className="flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-600">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
                AI 工作流进行中
              </span>
            )}
            {workflowStatus === 'completed' && (
              <>
                <span className="flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-600">
                  ✓ 工作流完成
                </span>
                <a
                  href={`/projects/${projectId}/workflow`}
                  className="flex items-center gap-1.5 rounded-full bg-[#0071e3] px-3 py-1 text-xs font-medium text-white transition hover:bg-[#0077ed]"
                >
                  查看完整方案
                </a>
              </>
            )}
            {workflowStatus === 'failed' && (
              <span className="flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-600">
                ✗ 工作流失败
              </span>
            )}
            <span className="max-w-[120px] truncate rounded-full bg-[#f5f5f7] px-2.5 py-1 text-xs text-[#86868b] sm:max-w-xs">
              项目 · {projectId.slice(0, 8)}
            </span>
          </div>
        </div>
      </header>

      {/* Workflow progress bar */}
      {workflowStatus !== 'idle' && (
        <div className="border-b border-black/[0.06] bg-white px-5 py-3 sm:px-8">
          <div className="mx-auto flex max-w-3xl items-center gap-3 overflow-x-auto">
            {AGENT_ORDER.map((agent, i) => {
              const state = nodeStates[agent];
              return (
                <div key={agent} className="flex items-center gap-2 shrink-0">
                  {i > 0 && (
                    <div
                      className={`h-px w-6 ${
                        state.status === 'completed' ? 'bg-green-400' : 'bg-gray-200'
                      }`}
                    />
                  )}
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                        state.status === 'completed'
                          ? 'bg-green-500 text-white'
                          : state.status === 'running'
                            ? 'bg-blue-500 text-white'
                            : state.status === 'failed'
                              ? 'bg-red-500 text-white'
                              : 'bg-gray-200 text-gray-400'
                      }`}
                    >
                      {state.status === 'completed' ? '✓' : state.status === 'running' ? '…' : i + 1}
                    </div>
                    <span
                      className={`text-[10px] ${
                        state.status !== 'pending' ? 'font-medium text-gray-700' : 'text-gray-400'
                      }`}
                    >
                      {AGENT_LABELS[agent]}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          {workflowError && (
            <p className="mx-auto mt-2 max-w-3xl text-xs text-red-500">{workflowError}</p>
          )}
        </div>
      )}

      <section className="mx-auto flex min-h-[calc(100vh-64px)] max-w-3xl flex-col px-5 sm:px-8">
        <div className="flex-1 py-9 sm:py-12">
          {messages.length === 0 && workflowStatus === 'idle' && completedNodeCards.length === 0 && <EmptyState />}
          <div className="space-y-7">
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                streaming={isStreaming && message.id === useChatStore.getState().streamId}
              />
            ))}

            {/* Live agent result cards */}
            {completedNodeCards.map((card) => (
              <AgentCard key={`${card.node}-${card.ts}`} agentName={card.node} output={card.output} />
            ))}
          </div>
        </div>

        <div className="sticky bottom-0 bg-gradient-to-t from-[#f5f5f7] via-[#f5f5f7] to-transparent pb-6 pt-8">
          {error && (
            <p className="mb-3 rounded-xl border border-[#fecaca] bg-[#fff5f5] px-3 py-2 text-sm text-[#c62828]">
              {error}
            </p>
          )}
          <div className="rounded-[22px] border border-black/[0.09] bg-white p-2 shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition focus-within:border-[#0071e3]/50 focus-within:ring-4 focus-within:ring-[#0071e3]/10">
            <textarea
              className="block min-h-[76px] w-full resize-none border-0 bg-transparent px-3 pt-2 text-[15px] leading-6 outline-none placeholder:text-[#86868b] disabled:opacity-60"
              placeholder="描述你的产品想法，或继续讨论下一步…"
              value={input}
              disabled={isStreaming}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <div className="flex items-center justify-between px-1 pb-1">
              <span className="pl-2 text-xs text-[#86868b]">
                Enter 发送 · Shift + Enter 换行
              </span>
              <button
                aria-label="发送消息"
                className="grid h-9 w-9 place-items-center rounded-full bg-[#0071e3] text-lg text-white transition hover:bg-[#0077ed] active:scale-95 disabled:bg-[#d2d2d7]"
                disabled={isStreaming || !input.trim()}
                onClick={() => void send()}
              >
                {isStreaming ? (
                  <span className="h-3 w-3 animate-pulse rounded-full bg-white" />
                ) : (
                  '↑'
                )}
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

// --- Agent live result card ---

function AgentCard({ agentName, output }: { agentName: AgentName; output: AgentOutput }) {
  const icon = AGENT_OUTPUT_ICONS[agentName];
  const labels: Record<AgentName, string> = {
    planner: '🎯 Planner 规划完成',
    research: '🔍 Research 调研完成',
    product: '💡 Product 产品设计完成',
    prd: '📝 PRD 文档完成',
    task: '✅ Task 任务拆解完成',
  };

  return (
    <article className="overflow-hidden rounded-[20px] border border-black/[0.06] bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-black/[0.04] bg-gradient-to-r from-[#fafafa] to-white px-4 py-3">
        <span className="text-base">{icon}</span>
        <span className="text-sm font-semibold text-[#1d1d1f]">{labels[agentName]}</span>
        <span className="ml-auto text-[10px] text-[#86868b]">刚刚</span>
      </div>
      <div className="px-4 py-4">
        <AgentCardContent agentName={agentName} output={output} />
      </div>
    </article>
  );
}

function AgentCardContent({ agentName, output }: { agentName: AgentName; output: AgentOutput }) {
  switch (agentName) {
    case 'planner': {
      const o = output as PlannerOutput;
      return (
        <div className="space-y-4">
          {o.goals?.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold text-[#86868b]">核心目标</p>
              <ul className="space-y-1.5">
                {o.goals.map((g, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-[#424245]">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#0071e3]" />
                    {g}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {o.risks?.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold text-[#86868b]">潜在风险</p>
              <ul className="space-y-1">
                {o.risks.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-[#424245]">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
    }
    case 'research': {
      const o = output as ResearchOutput;
      return (
        <div className="space-y-4">
          {o.marketOverview && (
            <div>
              <p className="mb-2 text-xs font-semibold text-[#86868b]">市场概况</p>
              <p className="text-sm leading-relaxed text-[#424245]">{o.marketOverview.slice(0, 200)}{o.marketOverview.length > 200 ? '…' : ''}</p>
            </div>
          )}
          {o.competitors?.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold text-[#86868b]">竞品分析</p>
              <div className="flex flex-wrap gap-2">
                {o.competitors.map((c, i) => (
                  <div key={i} className="rounded-lg border border-black/[0.06] bg-[#f5f5f7] px-3 py-2">
                    <p className="text-xs font-semibold text-[#1d1d1f]">{c.name}</p>
                    <p className="mt-1 text-[11px] text-green-600">✓ {c.strengths}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }
    case 'product': {
      const o = output as ProductOutput;
      return (
        <div className="space-y-4">
          {o.userPersona && (
            <div>
              <p className="mb-2 text-xs font-semibold text-[#86868b]">用户画像</p>
              <p className="rounded-lg bg-[#f5f5f7] p-3 text-sm leading-relaxed text-[#424245]">{o.userPersona.slice(0, 150)}{o.userPersona.length > 150 ? '…' : ''}</p>
            </div>
          )}
          {o.positioning && (
            <div>
              <p className="mb-2 text-xs font-semibold text-[#86868b]">产品定位</p>
              <p className="rounded-lg bg-blue-50 p-3 text-sm leading-relaxed text-blue-700">{o.positioning}</p>
            </div>
          )}
          {o.features?.length > 0 && (
            <div>
              <p className="mb-3 text-xs font-semibold text-[#86868b]">功能列表（{o.features.length} 项）</p>
              <div className="space-y-2">
                {o.features.slice(0, 4).map((f, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-lg border border-black/[0.04] bg-[#f5f5f7] p-2.5">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0071e3]/10 text-[10px] font-medium text-[#0071e3]">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#1d1d1f] truncate">{f.name}</p>
                      <p className="mt-0.5 text-xs text-[#86868b] line-clamp-1">{f.description}</p>
                    </div>
                    <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium ${PRIORITY_COLORS[f.priority] ?? ''}`}>
                      {f.priority}
                    </span>
                  </div>
                ))}
                {o.features.length > 4 && (
                  <p className="text-xs text-[#86868b]">+ 还有 {o.features.length - 4} 项功能</p>
                )}
              </div>
            </div>
          )}
        </div>
      );
    }
    case 'prd': {
      const o = output as PrdOutput;
      return (
        <div className="space-y-4">
          {o.title && (
            <div className="rounded-lg border-2 border-[#0071e3]/20 bg-[#0071e3]/5 p-3">
              <p className="text-xs font-semibold text-[#0071e3]">产品名称</p>
              <p className="text-base font-bold text-[#1d1d1f]">{o.title}</p>
            </div>
          )}
          {o.background && (
            <div>
              <p className="mb-2 text-xs font-semibold text-[#86868b]">项目背景</p>
              <p className="text-sm leading-relaxed text-[#424245]">{o.background.slice(0, 300)}{o.background.length > 300 ? '…' : ''}</p>
            </div>
          )}
          {o.acceptanceCriteria?.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold text-[#86868b]">验收标准</p>
              <ul className="space-y-1">
                {o.acceptanceCriteria.slice(0, 5).map((c, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-[#424245]">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-green-500" />
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
    }
    case 'task': {
      const o = output as TaskOutput;
      return (
        <div className="space-y-4">
          {o.tasks?.length > 0 && (
            <div>
              <p className="mb-3 text-xs font-semibold text-[#86868b]">任务拆解（{o.tasks.length} 项）</p>
              <div className="space-y-2">
                {o.tasks.slice(0, 6).map((task, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-lg border border-black/[0.04] bg-[#f5f5f7] p-2.5">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0071e3]/10 text-[11px] font-bold text-[#0071e3]">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#1d1d1f] truncate">{task.title}</p>
                      {task.estimateDays && (
                        <p className="text-xs text-[#86868b]">预计 {task.estimateDays} 天</p>
                      )}
                    </div>
                    <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium ${PRIORITY_COLORS[task.priority] ?? ''}`}>
                      {task.priority}
                    </span>
                  </div>
                ))}
                {o.tasks.length > 6 && (
                  <p className="text-xs text-[#86868b]">+ 还有 {o.tasks.length - 6} 项任务</p>
                )}
              </div>
            </div>
          )}
        </div>
      );
    }
    default:
      return (
        <pre className="overflow-x-auto rounded-lg bg-[#1d1d1f] p-3 text-xs text-[#f5f5f7]">
          {JSON.stringify(output, null, 2)}
        </pre>
      );
  }
}

// --- Existing components ---

function EmptyState() {
  return (
    <div className="mx-auto max-w-xl py-16 text-center sm:py-24">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-black/[0.04] bg-white text-lg text-[#0071e3] shadow-sm">
        ✦
      </span>
      <h1 className="mt-6 text-3xl font-bold tracking-[-0.04em] sm:text-4xl">从一个想法开始。</h1>
      <p className="mx-auto mt-4 max-w-md text-[15px] leading-7 text-[#6e6e73]">
        告诉我你想解决的问题。我会和你一起梳理用户、场景与产品方向。
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-2">
        <span className="rounded-full border border-black/[0.05] bg-white px-3 py-1.5 text-xs text-[#6e6e73] shadow-sm">
          定义产品目标
        </span>
        <span className="rounded-full border border-black/[0.05] bg-white px-3 py-1.5 text-xs text-[#6e6e73] shadow-sm">
          梳理用户需求
        </span>
        <span className="rounded-full border border-black/[0.05] bg-white px-3 py-1.5 text-xs text-[#6e6e73] shadow-sm">
          生成 PRD 草案
        </span>
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  streaming,
}: {
  message: ChatMessage;
  streaming: boolean;
}) {
  const isUser = message.role === 'user';
  return (
    <article className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[88%] rounded-[20px] px-4 py-3.5 text-[15px] leading-7 sm:max-w-[80%] ${
          isUser
            ? 'bg-[#0071e3] text-white shadow-sm'
            : 'border border-black/[0.06] bg-white text-[#1d1d1f] shadow-sm'
        }`}
      >
        <p
          className={`mb-1 text-[11px] font-semibold tracking-wide ${
            isUser ? 'text-white/65' : 'text-[#86868b]'
          }`}
        >
          {isUser ? '你' : 'PRODUCT AGENT'}
        </p>
        <div className="markdown-content">
          <ReactMarkdown>
            {message.content || (streaming ? '正在思考…' : '')}
          </ReactMarkdown>
          {streaming && message.content && (
            <span className="ml-1 inline-block h-4 w-1 animate-pulse bg-[#0071e3] align-middle" />
          )}
        </div>
      </div>
    </article>
  );
}
