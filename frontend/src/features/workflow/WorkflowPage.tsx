import { useEffect, useState } from 'react';
import { useChatStore } from '../chat/chat.store';
import { getWorkflowRun, getWorkflowResults } from '../chat/chat.api';
import type { AgentName, WorkflowRun, WorkflowAgentRun } from '../chat/chat.api';
import { AGENT_ORDER, AGENT_LABELS } from '../chat/chat.types';
import { Badge } from '@/components/ui/badge';

// --- Types matching backend/src/workflow/state.ts ---

interface PlannerOutput {
  goals: string[];
  assumptions: string[];
  risks: string[];
  reasoning: string;
}

interface ResearchOutput {
  marketOverview: string;
  competitors: Array<{ name: string; strengths: string; weaknesses: string }>;
  opportunities: string[];
  reasoning: string;
}

interface ProductOutput {
  userPersona: string;
  painPoints: string[];
  positioning: string;
  features: Array<{ name: string; description: string; priority: 'HIGH' | 'MEDIUM' | 'LOW' }>;
  userFlows: string[];
  reasoning: string;
}

interface PrdOutput {
  title: string;
  background: string;
  userProfiles: string;
  functionalRequirements: string;
  pageDesign: string;
  acceptanceCriteria: string[];
  reasoning: string;
}

interface TaskOutput {
  tasks: Array<{
    title: string;
    description: string;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    estimateDays: number;
  }>;
  reasoning: string;
}

// ---

const AGENT_ICONS: Record<AgentName, string> = {
  planner: '🎯',
  research: '🔍',
  product: '💡',
  prd: '📝',
  task: '✅',
};

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-green-500 text-white',
  running: 'bg-blue-500 text-white',
  failed: 'bg-red-500 text-white',
  pending: 'bg-gray-200 text-gray-400',
};

const PRIORITY_VARIANTS: Record<string, 'destructive' | 'secondary' | 'default'> = {
  HIGH: 'destructive',
  MEDIUM: 'secondary',
  LOW: 'default',
};

export function WorkflowPage({ projectId }: { projectId: string }) {
  const workflowRunId = useChatStore((s) => s.workflowRunId);
  const [workflowRun, setWorkflowRun] = useState<WorkflowRun | null>(null);
  const [results, setResults] = useState<Record<string, unknown>>({});
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workflowRunId) return;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const [runData, resultsData] = await Promise.all([
          getWorkflowRun(workflowRunId),
          getWorkflowResults(workflowRunId),
        ]);
        if ('error' in runData) { setError(runData.error); return; }
        if ('error' in resultsData) { setError(resultsData.error); return; }
        setWorkflowRun(runData);
        setResults(resultsData);
        const completed = new Set<string>();
        runData.agentRuns?.forEach((r) => {
          if (r.status === 'completed') completed.add(r.agentName);
        });
        setExpandedNodes(completed);
      } catch (e) {
        setError(e instanceof Error ? e.message : '加载工作流结果失败');
      } finally {
        setLoading(false);
      }
    })();
  }, [workflowRunId]);

  function toggleNode(agentName: string) {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      next.has(agentName) ? next.delete(agentName) : next.add(agentName);
      return next;
    });
  }

  const status = workflowRun?.status ?? 'running';
  const agentRuns = workflowRun?.agentRuns ?? [];

  function getNodeStatus(agentName: string): string {
    return agentRuns.find((r) => r.agentName === agentName)?.status ?? 'pending';
  }

  return (
    <main className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f]">
      <header className="sticky top-0 z-10 border-b border-black/[0.06] bg-white/80 px-5 backdrop-blur-xl sm:px-8">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between">
          <div className="flex items-center gap-4">
            <a href={`/projects/${projectId}/chat`} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[#6e6e73] transition-colors hover:bg-[#f5f5f7] hover:text-[#1d1d1f]">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              返回聊天
            </a>
            <div className="h-6 w-px bg-black/[0.06]" />
            <span className="flex items-center gap-2.5 text-[15px] font-semibold tracking-[-0.02em]">
              <span className="grid h-7 w-7 place-items-center rounded-[9px] bg-[#0071e3] text-sm text-white">✦</span>
              工作流结果
            </span>
          </div>
          <div className="flex items-center gap-3">
            {status === 'completed' && (
              <span className="flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-600">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />工作流完成
              </span>
            )}
            {status === 'running' && (
              <span className="flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-600">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />运行中
              </span>
            )}
            {status === 'failed' && (
              <span className="flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-600">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500" />运行失败
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="border-b border-black/[0.06] bg-white px-5 py-6 sm:px-8">
        <div className="mx-auto flex max-w-3xl items-center justify-center gap-2 overflow-x-auto">
          {AGENT_ORDER.map((agent, i) => {
            const nodeStatus = getNodeStatus(agent);
            return (
              <div key={agent} className="flex items-center gap-2 shrink-0">
                {i > 0 && <div className={`h-px w-8 ${nodeStatus === 'completed' ? 'bg-green-400' : 'bg-gray-200'}`} />}
                <div className="flex flex-col items-center gap-1.5">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${STATUS_COLORS[nodeStatus]}`}>
                    {nodeStatus === 'completed' ? '✓' : nodeStatus === 'running' ? '…' : AGENT_ICONS[agent]}
                  </div>
                  <span className={`text-xs ${nodeStatus !== 'pending' ? 'font-medium text-gray-700' : 'text-gray-400'}`}>
                    {AGENT_LABELS[agent]}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <section className="mx-auto max-w-4xl px-5 py-8 sm:px-8 sm:py-12">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#0071e3] border-t-transparent" />
            <span className="ml-3 text-sm text-[#6e6e73]">加载工作流结果…</span>
          </div>
        )}
        {error && (
          <div className="rounded-xl border border-[#fecaca] bg-[#fff5f5] px-4 py-4 text-sm text-[#c62828]">{error}</div>
        )}
        {!loading && !error && agentRuns.length === 0 && (
          <div className="py-20 text-center"><p className="text-sm text-[#6e6e73]">暂无工作流记录</p></div>
        )}
        {!loading && !error && agentRuns.length > 0 && (
          <div className="space-y-4">
            {agentRuns.map((run) => (
              <AgentResultCard
                key={run.id}
                run={run}
                expanded={expandedNodes.has(run.agentName)}
                onToggle={() => toggleNode(run.agentName)}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function AgentResultCard({ run, expanded, onToggle }: { run: WorkflowAgentRun; expanded: boolean; onToggle: () => void }) {
  const agentName = run.agentName as AgentName;
  const status = run.status;
  const isCompleted = status === 'completed';

  return (
    <div className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-sm">
      <button className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-[#fafafa]" onClick={onToggle}>
        <div className="flex items-center gap-3">
          <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm ${STATUS_COLORS[status] ?? STATUS_COLORS.pending}`}>
            {status === 'completed' ? '✓' : status === 'running' ? '…' : AGENT_ICONS[agentName]}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#1d1d1f]">{AGENT_LABELS[agentName]}</h3>
            <p className="text-xs text-[#86868b]">{isCompleted ? `完成 · ${formatDuration(run.durationMs)}` : `状态: ${status}`}</p>
          </div>
        </div>
        <svg className={`h-4 w-4 text-[#86868b] transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && isCompleted && (
        <div className="border-t border-black/[0.06] px-5 py-5">
          <AgentOutput agentName={agentName} output={run.output} />
        </div>
      )}
    </div>
  );
}

function AgentOutput({ agentName, output }: { agentName: AgentName; output: unknown }) {
  if (!output) return <p className="text-sm text-[#86868b]">暂无输出内容</p>;
  switch (agentName) {
    case 'planner': return <PlannerView output={output as PlannerOutput} />;
    case 'research': return <ResearchView output={output as ResearchOutput} />;
    case 'product': return <ProductView output={output as ProductOutput} />;
    case 'prd': return <PrdView output={output as PrdOutput} />;
    case 'task': return <TaskView output={output as TaskOutput} />;
    default: return <pre className="overflow-x-auto rounded-xl bg-[#1d1d1f] p-4 text-xs text-[#f5f5f7]">{JSON.stringify(output, null, 2)}</pre>;
  }
}

function PlannerView({ output }: { output: PlannerOutput }) {
  return (
    <div className="space-y-6">
      <Section title="核心目标" icon="🎯">
        <ul className="space-y-2">{output.goals.map((g, i) => <ListItem key={i}>{g}</ListItem>)}</ul>
      </Section>
      <Section title="关键假设" icon="💡">
        <ul className="space-y-2">{output.assumptions.map((a, i) => <ListItem key={i}>{a}</ListItem>)}</ul>
      </Section>
      <Section title="潜在风险" icon="⚠️">
        <ul className="space-y-2">{output.risks.map((r, i) => <ListItem key={i}>{r}</ListItem>)}</ul>
      </Section>
      {output.reasoning && (
        <div className="rounded-xl bg-[#f5f5f7] p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#86868b]">分析逻辑</p>
          <p className="text-sm leading-relaxed text-[#424245]">{output.reasoning}</p>
        </div>
      )}
    </div>
  );
}

function ResearchView({ output }: { output: ResearchOutput }) {
  return (
    <div className="space-y-6">
      <Section title="市场概况" icon="📊">
        <p className="text-sm leading-relaxed text-[#424245]">{output.marketOverview}</p>
      </Section>
      <Section title="竞品分析" icon="🔍">
        <div className="space-y-3">
          {output.competitors.map((c, i) => (
            <div key={i} className="rounded-xl border border-black/[0.06] bg-[#f5f5f7] p-4">
              <p className="font-semibold text-[#1d1d1f]">{c.name}</p>
              <p className="mt-1 text-xs text-green-600">✓ {c.strengths}</p>
              <p className="mt-1 text-xs text-red-500">✗ {c.weaknesses}</p>
            </div>
          ))}
        </div>
      </Section>
      <Section title="市场机会" icon="🚀">
        <ul className="space-y-2">{output.opportunities.map((o, i) => <ListItem key={i}>{o}</ListItem>)}</ul>
      </Section>
      {output.reasoning && (
        <div className="rounded-xl bg-[#f5f5f7] p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#86868b]">分析逻辑</p>
          <p className="text-sm leading-relaxed text-[#424245]">{output.reasoning}</p>
        </div>
      )}
    </div>
  );
}

function ProductView({ output }: { output: ProductOutput }) {
  return (
    <div className="space-y-6">
      <Section title="用户画像" icon="👤">
        <p className="rounded-xl bg-[#f5f5f7] p-4 text-sm leading-relaxed text-[#424245]">{output.userPersona}</p>
      </Section>
      <Section title="用户痛点" icon="💢">
        <ul className="space-y-2">{output.painPoints.map((p, i) => <ListItem key={i}>{p}</ListItem>)}</ul>
      </Section>
      <Section title="产品定位" icon="🎯">
        <p className="rounded-xl bg-blue-50 p-4 text-sm leading-relaxed text-blue-700">{output.positioning}</p>
      </Section>
      <Section title="功能列表" icon="⚙️">
        <div className="space-y-2">
          {output.features.map((f, i) => (
            <div key={i} className="flex items-start gap-3 rounded-lg border border-black/[0.06] p-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0071e3]/10 text-xs font-medium text-[#0071e3]">{i + 1}</span>
              <div className="flex-1">
                <p className="text-sm font-medium text-[#1d1d1f]">{f.name}</p>
                <p className="mt-1 text-xs text-[#6e6e73]">{f.description}</p>
              </div>
              <Badge variant={PRIORITY_VARIANTS[f.priority]} className="shrink-0">{f.priority}</Badge>
            </div>
          ))}
        </div>
      </Section>
      <Section title="用户流程" icon="🔄">
        <ul className="space-y-2">{output.userFlows.map((f, i) => <ListItem key={i}>{f}</ListItem>)}</ul>
      </Section>
      {output.reasoning && (
        <div className="rounded-xl bg-[#f5f5f7] p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#86868b]">设计逻辑</p>
          <p className="text-sm leading-relaxed text-[#424245]">{output.reasoning}</p>
        </div>
      )}
    </div>
  );
}

function PrdView({ output }: { output: PrdOutput }) {
  return (
    <div className="space-y-6">
      {output.title && (
        <div className="rounded-xl border-2 border-[#0071e3]/20 bg-[#0071e3]/5 p-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[#0071e3]">产品名称</p>
          <p className="text-lg font-bold text-[#1d1d1f]">{output.title}</p>
        </div>
      )}
      {output.background && (
        <Section title="项目背景" icon="📋">
          <p className="text-sm leading-relaxed text-[#424245]">{output.background}</p>
        </Section>
      )}
      {output.userProfiles && (
        <Section title="用户画像" icon="👥">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#424245]">{output.userProfiles}</p>
        </Section>
      )}
      {output.functionalRequirements && (
        <Section title="功能需求" icon="⚙️">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#424245]">{output.functionalRequirements}</p>
        </Section>
      )}
      {output.pageDesign && (
        <Section title="页面设计" icon="🎨">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#424245]">{output.pageDesign}</p>
        </Section>
      )}
      {output.acceptanceCriteria?.length > 0 && (
        <Section title="验收标准" icon="✅">
          <ul className="space-y-2">{output.acceptanceCriteria.map((c, i) => <ListItem key={i}>{c}</ListItem>)}</ul>
        </Section>
      )}
      {output.reasoning && (
        <div className="rounded-xl bg-[#f5f5f7] p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#86868b]">撰写逻辑</p>
          <p className="text-sm leading-relaxed text-[#424245]">{output.reasoning}</p>
        </div>
      )}
    </div>
  );
}

function TaskView({ output }: { output: TaskOutput }) {
  return (
    <div className="space-y-4">
      {output.tasks.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-black/[0.06]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/[0.06] bg-[#f5f5f7]">
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#86868b]">任务</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#86868b]">优先级</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#86868b]">预估</th>
              </tr>
            </thead>
            <tbody>
              {output.tasks.map((task, i) => (
                <tr key={i} className="border-b border-black/[0.06] last:border-0">
                  <td className="px-4 py-4">
                    <p className="font-medium text-[#1d1d1f]">{task.title}</p>
                    <p className="mt-1 text-xs text-[#6e6e73]">{task.description}</p>
                  </td>
                  <td className="px-4 py-4">
                    <Badge variant={PRIORITY_VARIANTS[task.priority]}>{task.priority}</Badge>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-sm text-[#424245]">{task.estimateDays}天</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {output.reasoning && (
        <div className="rounded-xl bg-[#f5f5f7] p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#86868b]">拆解逻辑</p>
          <p className="text-sm leading-relaxed text-[#424245]">{output.reasoning}</p>
        </div>
      )}
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm">{icon}</span>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-[#86868b]">{title}</h4>
      </div>
      {children}
    </div>
  );
}

function ListItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-sm text-[#424245]">
      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#0071e3]" />
      <span>{children}</span>
    </li>
  );
}

function formatDuration(ms: number | null): string {
  if (!ms) return '-';
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}秒`;
  return `${Math.floor(s / 60)}分${s % 60}秒`;
}
