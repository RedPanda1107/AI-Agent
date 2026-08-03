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

export function ChatPage({ projectId }: { projectId: string }) {
  const [input, setInput] = useState('');
  const chatEs = useRef<EventSource | null>(null);
  const workflowEs = useRef<EventSource | null>(null);

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
      handleWorkflowEvent(JSON.parse(e.data) as WorkflowEvent);
    });
    source.addEventListener('node.started', (e) => {
      const event = JSON.parse(e.data) as WorkflowEvent;
      handleWorkflowEvent(event);
    });
    source.addEventListener('node.delta', (e) => {
      const event = JSON.parse(e.data) as WorkflowEvent;
      handleWorkflowEvent(event);
    });
    source.addEventListener('node.completed', (e) => {
      const event = JSON.parse(e.data) as WorkflowEvent;
      handleWorkflowEvent(event);
    });
    source.addEventListener('node.failed', (e) => {
      const event = JSON.parse(e.data) as WorkflowEvent;
      handleWorkflowEvent(event);
    });
    source.addEventListener('run.completed', (e) => {
      const event = JSON.parse(e.data) as WorkflowEvent;
      handleWorkflowEvent(event);
      source.close();
    });
    source.onerror = () => {
      console.warn('[Workflow] SSE connection error, will retry...');
      source.close();
    };
  }

  async function send(): Promise<void> {
    const content = input.trim();
    if (!content || isStreaming) return;

    setInput('');

    if (looksLikeWorkflowIdea(content)) {
      // Trigger multi-agent workflow
      try {
        const { runId } = await startWorkflow({ projectId, idea: content });
        startWf(runId);
        subscribeWorkflowStream(runId);
      } catch (e) {
        failStream(e instanceof Error ? e.message : '启动工作流失败');
      }
    } else {
      // Normal chat message
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
              <span className="flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-600">
                ✓ 工作流完成
              </span>
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
          {messages.length === 0 && workflowStatus === 'idle' && <EmptyState />}
          <div className="space-y-7">
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                streaming={isStreaming && message.id === useChatStore.getState().streamId}
              />
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
