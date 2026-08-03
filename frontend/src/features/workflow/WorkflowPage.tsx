import { useEffect, useState, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  useNodesState,
  useEdgesState,
  Position,
  Handle,
  NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useChatStore } from '../chat/chat.store';
import { getWorkflowRun, getWorkflowResults, getProjectWorkflowRuns } from '../chat/chat.api';
import type { AgentName, WorkflowRun, WorkflowAgentRun } from '../chat/chat.api';
import { AGENT_ORDER, AGENT_LABELS } from '../chat/chat.types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

// --- Agent output types matching backend schema ---

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
  tasks: Array<{ title: string; description: string; priority: 'HIGH' | 'MEDIUM' | 'LOW'; estimateDays: number }>;
  reasoning: string;
}

const AGENT_ICONS: Record<AgentName, string> = {
  planner: '🎯', research: '🔍', product: '💡', prd: '📝', task: '✅',
};

const AGENT_COLORS: Record<AgentName, string> = {
  planner: '#0071e3',
  research: '#7c3aed',
  product: '#d97706',
  prd: '#059669',
  task: '#dc2626',
};

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-green-500 text-white',
  running: 'bg-blue-500 text-white',
  failed: 'bg-red-500 text-white',
  pending: 'bg-gray-200 text-gray-400',
};

const PRIORITY_VARIANTS: Record<string, 'destructive' | 'secondary' | 'default'> = {
  HIGH: 'destructive', MEDIUM: 'secondary', LOW: 'default',
};

// --- React Flow custom node ---

interface FlowNodeData {
  agentName: AgentName;
  status: string;
  label: string;
  icon: string;
  color: string;
  onClick: () => void;
  isSelected: boolean;
}

function AgentFlowNode({ data }: NodeProps<Node<FlowNodeData>>) {
  const { status, label, icon, color, onClick: _onClick, isSelected } = data;
  const colorClass = STATUS_COLORS[status] ?? STATUS_COLORS.pending;
  const isDone = status === 'completed';
  const isFailed = status === 'failed';

  return (
    <div
      className={`
        relative min-w-[140px] rounded-2xl border-2 px-4 py-3 text-center shadow-sm transition-all
        ${isSelected ? 'border-[#0071e3] shadow-lg ring-2 ring-[#0071e3]/30' : 'border-black/[0.08]'}
        ${isDone ? 'bg-green-50 border-green-200' : isFailed ? 'bg-red-50 border-red-200' : 'bg-white'}
      `}
      style={{ backgroundColor: isDone ? '#f0fdf4' : isFailed ? '#fef2f2' : '#ffffff' }}
    >
      <Handle type="target" position={Position.Left} className="!bg-gray-400 !w-2 !h-2" />
      <div
        className={`mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${colorClass}`}
        style={status === 'pending' ? { backgroundColor: '#e5e7eb', color: '#9ca3af' } : {}}
      >
        {isDone ? '✓' : isFailed ? '✗' : icon}
      </div>
      <p className="text-xs font-semibold text-[#1d1d1f]">{label}</p>
      <p className="mt-0.5 text-[10px] text-[#86868b]">
        {isDone ? '已完成' : isFailed ? '失败' : status === 'running' ? '运行中…' : '等待中'}
      </p>
      <Handle type="source" position={Position.Right} className="!bg-gray-400 !w-2 !h-2" />
    </div>
  );
}

const nodeTypes = { agentNode: AgentFlowNode };

// --- Initial flow graph ---

function buildFlowNodesAndEdges(agentRuns: WorkflowAgentRun[], selectedRunId: string | null): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = AGENT_ORDER.map((agentName, i) => {
    const run = agentRuns.find((r) => r.agentName === agentName);
    const status = run?.status === 'SUCCESS' ? 'completed' : run?.status === 'FAILED' ? 'failed' : run?.status === 'RUNNING' ? 'running' : 'pending';
    return {
      id: agentName,
      type: 'agentNode',
      position: { x: i * 220, y: 0 },
      data: {
        agentName,
        status,
        label: AGENT_LABELS[agentName],
        icon: AGENT_ICONS[agentName],
        color: AGENT_COLORS[agentName],
        onClick: () => {},
        isSelected: selectedRunId === agentName,
      } satisfies FlowNodeData,
    };
  });

  const edges: Edge[] = AGENT_ORDER.slice(0, -1).map((_, i) => ({
    id: `e${i}`,
    source: AGENT_ORDER[i],
    target: AGENT_ORDER[i + 1],
    type: 'smoothstep',
    animated: true,
    style: { stroke: '#9ca3af', strokeWidth: 2 },
  }));

  return { nodes, edges };
}

// --- Main page ---

export function WorkflowPage({ projectId }: { projectId: string }) {
  const workflowRunId = useChatStore((s) => s.workflowRunId);

  const [allRuns, setAllRuns] = useState<WorkflowRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(workflowRunId);
  const [workflowRun, setWorkflowRun] = useState<WorkflowRun | null>(null);
  const [results, setResults] = useState<Record<string, unknown>>({});
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Load runs list for this project
  useEffect(() => {
    void (async () => {
      try {
        const runs = await getProjectWorkflowRuns(projectId);
        setAllRuns(runs);
        // Auto-select: prefer store runId, otherwise latest run
        if (workflowRunId) {
          setSelectedRunId(workflowRunId);
        } else if (runs.length > 0) {
          setSelectedRunId(runs[0].id);
        }
      } catch (e) {
        // non-critical, don't block UI
      }
    })();
  }, [projectId, workflowRunId]);

  // Load run details and results whenever selectedRunId changes
  const loadRun = useCallback(async (runId: string) => {
    setLoading(true);
    setError(null);
    try {
      const [runData, resultsData] = await Promise.all([
        getWorkflowRun(runId),
        getWorkflowResults(runId),
      ]);
      if ('error' in runData) { setError(runData.error); return; }
      if ('error' in resultsData) { setError(resultsData.error); return; }
      setWorkflowRun(runData);
      setResults(resultsData);

      // Auto-expand completed agent cards
      const completed = new Set<string>();
      runData.agentRuns?.forEach((r) => {
        if (r.status === 'SUCCESS') completed.add(r.agentName);
      });
      setExpandedNodes(completed);

      // Update React Flow nodes
      const { nodes: flowNodes, edges: flowEdges } = buildFlowNodesAndEdges(
        runData.agentRuns ?? [],
        null,
      );
      setNodes(flowNodes);
      setEdges(flowEdges);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载工作流结果失败');
    } finally {
      setLoading(false);
    }
  }, [setNodes, setEdges]);

  useEffect(() => {
    if (selectedRunId) void loadRun(selectedRunId);
  }, [selectedRunId, loadRun]);

  function toggleNode(agentName: string) {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      next.has(agentName) ? next.delete(agentName) : next.add(agentName);
      return next;
    });
  }

  const status = workflowRun?.status ?? 'running';
  const agentRuns = workflowRun?.agentRuns ?? [];
  const completedCount = agentRuns.filter((r) => r.status === 'SUCCESS').length;

  return (
    <main className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f]">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-black/[0.06] bg-white/80 px-5 backdrop-blur-xl sm:px-8">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between">
          <div className="flex items-center gap-4">
            <a
              href={`/projects/${projectId}/chat`}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[#6e6e73] transition-colors hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
            >
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
            {allRuns.length > 1 && (
              <select
                className="rounded-lg border border-black/[0.08] bg-white px-3 py-1.5 text-xs text-[#424245] shadow-sm focus:border-[#0071e3] focus:outline-none"
                value={selectedRunId ?? ''}
                onChange={(e) => setSelectedRunId(e.target.value)}
              >
                {allRuns.map((r) => (
                  <option key={r.id} value={r.id}>
                    {new Date(r.createdAt).toLocaleString('zh-CN')} — {r.status === 'COMPLETED' ? '完成' : r.status === 'RUNNING' ? '运行中' : r.status === 'FAILED' ? '失败' : '待处理'}
                  </option>
                ))}
              </select>
            )}
            {status === 'COMPLETED' && (
              <span className="flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-600">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />工作流完成
              </span>
            )}
            {status === 'RUNNING' && (
              <span className="flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-600">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />运行中
              </span>
            )}
            {status === 'FAILED' && (
              <span className="flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-600">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500" />运行失败
              </span>
            )}
          </div>
        </div>
      </header>

      {/* React Flow diagram */}
      <div className="border-b border-black/[0.06] bg-white px-5 py-4 sm:px-8">
        <div className="mx-auto max-w-4xl">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Skeleton className="h-[100px] w-full rounded-xl" />
            </div>
          ) : agentRuns.length > 0 ? (
            <div className="relative" style={{ height: 130 }}>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodeTypes={nodeTypes}
                fitView
                panEnabled
                zoomEnabled={false}
                className="!bg-transparent"
                proOptions={{ hideAttribution: true }}
              >
                <Background color="#e5e7eb" gap={20} size={1} />
              </ReactFlow>
              {/* Progress overlay */}
              <div className="absolute right-0 top-1/2 -translate-y-1/2 text-right">
                <p className="text-xs text-[#86868b]">{completedCount}/{AGENT_ORDER.length} 节点已完成</p>
              </div>
            </div>
          ) : (
            <div className="flex h-[100px] items-center justify-center">
              <p className="text-sm text-[#86868b]">暂无节点数据</p>
            </div>
          )}
        </div>
      </div>

      {/* Agent result cards */}
      <section className="mx-auto max-w-4xl px-5 py-8 sm:px-8 sm:py-12">
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-2xl" />
            ))}
          </div>
        )}
        {error && (
          <div className="rounded-xl border border-[#fecaca] bg-[#fff5f5] px-4 py-4 text-sm text-[#c62828]">{error}</div>
        )}
        {!loading && !error && agentRuns.length === 0 && (
          <div className="py-20 text-center">
            <p className="text-sm text-[#86868b]">暂无工作流记录</p>
            <a
              href={`/projects/${projectId}/chat`}
              className="mt-3 inline-block text-xs text-[#0071e3] hover:underline"
            >
              去聊天发起工作流 →
            </a>
          </div>
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

// --- Sub-components ---

function AgentResultCard({ run, expanded, onToggle }: { run: WorkflowAgentRun; expanded: boolean; onToggle: () => void }) {
  const agentName = run.agentName as AgentName;
  const status = run.status;
  const isCompleted = status === 'SUCCESS';

  return (
    <Card className="overflow-hidden">
      <button
        className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-accent/50"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${STATUS_COLORS[isCompleted ? 'completed' : status === 'RUNNING' ? 'running' : status === 'FAILED' ? 'failed' : 'pending']}`}
          >
            {isCompleted ? '✓' : status === 'RUNNING' ? '…' : status === 'FAILED' ? '✗' : AGENT_ICONS[agentName]}
          </div>
          <div>
            <h3 className="text-sm font-semibold">{AGENT_LABELS[agentName]}</h3>
            <p className="text-xs text-muted-foreground">
              {isCompleted
                ? `完成 · ${formatDuration(run.durationMs)}`
                : status === 'RUNNING'
                  ? '运行中…'
                  : status === 'FAILED'
                    ? '执行失败'
                    : `状态: ${status}`}
            </p>
          </div>
        </div>
        <svg
          className={`h-4 w-4 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && (
        <CardContent className="border-t border-border px-5 py-5">
          <AgentOutput agentName={agentName} output={run.output} />
        </CardContent>
      )}
    </Card>
  );
}

function AgentOutput({ agentName, output }: { agentName: AgentName; output: unknown }) {
  if (!output) return <p className="text-sm text-muted-foreground">暂无输出内容</p>;
  switch (agentName) {
    case 'planner': return <PlannerView output={output as PlannerOutput} />;
    case 'research': return <ResearchView output={output as ResearchOutput} />;
    case 'product': return <ProductView output={output as ProductOutput} />;
    case 'prd': return <PrdView output={output as PrdOutput} />;
    case 'task': return <TaskView output={output as TaskOutput} />;
    default: return (
      <pre className="overflow-x-auto rounded-xl bg-[#1d1d1f] p-4 text-xs text-[#f5f5f7]">
        {JSON.stringify(output, null, 2)}
      </pre>
    );
  }
}

function PlannerView({ output }: { output: PlannerOutput }) {
  return (
    <div className="space-y-6">
      {output.goals?.length > 0 && <Section title="核心目标" icon="🎯"><List items={output.goals} /></Section>}
      {output.assumptions?.length > 0 && <Section title="关键假设" icon="💡"><List items={output.assumptions} /></Section>}
      {output.risks?.length > 0 && <Section title="潜在风险" icon="⚠️"><List items={output.risks} /></Section>}
      {output.reasoning && <ReasoningBox text={output.reasoning} label="分析逻辑" />}
    </div>
  );
}

function ResearchView({ output }: { output: ResearchOutput }) {
  return (
    <div className="space-y-6">
      {output.marketOverview && <Section title="市场概况" icon="📊"><p className="text-sm leading-relaxed text-[#424245]">{output.marketOverview}</p></Section>}
      {output.competitors?.length > 0 && (
        <Section title="竞品分析" icon="🔍">
          <div className="space-y-3">
            {output.competitors.map((c, i) => (
              <div key={i} className="rounded-xl border border-border bg-muted/50 p-4">
                <p className="font-semibold text-foreground">{c.name}</p>
                <p className="mt-1 text-xs text-green-600">✓ {c.strengths}</p>
                <p className="mt-1 text-xs text-red-500">✗ {c.weaknesses}</p>
              </div>
            ))}
          </div>
        </Section>
      )}
      {output.opportunities?.length > 0 && <Section title="市场机会" icon="🚀"><List items={output.opportunities} /></Section>}
      {output.reasoning && <ReasoningBox text={output.reasoning} label="分析逻辑" />}
    </div>
  );
}

function ProductView({ output }: { output: ProductOutput }) {
  return (
    <div className="space-y-6">
      {output.userPersona && (
        <Section title="用户画像" icon="👤">
          <p className="rounded-xl bg-muted/50 p-4 text-sm leading-relaxed text-[#424245]">{output.userPersona}</p>
        </Section>
      )}
      {output.painPoints?.length > 0 && <Section title="用户痛点" icon="💢"><List items={output.painPoints} /></Section>}
      {output.positioning && (
        <Section title="产品定位" icon="🎯">
          <p className="rounded-xl bg-blue-50 p-4 text-sm leading-relaxed text-blue-700">{output.positioning}</p>
        </Section>
      )}
      {output.features?.length > 0 && (
        <Section title="功能列表" icon="⚙️">
          <div className="space-y-2">
            {output.features.map((f, i) => (
              <div key={i} className="flex items-start gap-3 rounded-lg border border-border p-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0071e3]/10 text-xs font-medium text-[#0071e3]">{i + 1}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium">{f.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{f.description}</p>
                </div>
                <Badge variant={PRIORITY_VARIANTS[f.priority]} className="shrink-0">{f.priority}</Badge>
              </div>
            ))}
          </div>
        </Section>
      )}
      {output.userFlows?.length > 0 && <Section title="用户流程" icon="🔄"><List items={output.userFlows} /></Section>}
      {output.reasoning && <ReasoningBox text={output.reasoning} label="设计逻辑" />}
    </div>
  );
}

function PrdView({ output }: { output: PrdOutput }) {
  return (
    <div className="space-y-6">
      {output.title && (
        <div className="rounded-xl border-2 border-[#0071e3]/20 bg-[#0071e3]/5 p-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[#0071e3]">产品名称</p>
          <p className="text-lg font-bold">{output.title}</p>
        </div>
      )}
      {output.background && <Section title="项目背景" icon="📋"><p className="whitespace-pre-wrap text-sm leading-relaxed text-[#424245]">{output.background}</p></Section>}
      {output.userProfiles && <Section title="用户画像" icon="👥"><p className="whitespace-pre-wrap text-sm leading-relaxed text-[#424245]">{output.userProfiles}</p></Section>}
      {output.functionalRequirements && <Section title="功能需求" icon="⚙️"><p className="whitespace-pre-wrap text-sm leading-relaxed text-[#424245]">{output.functionalRequirements}</p></Section>}
      {output.pageDesign && <Section title="页面设计" icon="🎨"><p className="whitespace-pre-wrap text-sm leading-relaxed text-[#424245]">{output.pageDesign}</p></Section>}
      {output.acceptanceCriteria?.length > 0 && <Section title="验收标准" icon="✅"><List items={output.acceptanceCriteria} /></Section>}
      {output.reasoning && <ReasoningBox text={output.reasoning} label="撰写逻辑" />}
    </div>
  );
}

function TaskView({ output }: { output: TaskOutput }) {
  return (
    <div className="space-y-4">
      {output.tasks?.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">任务</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">优先级</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">预估</th>
              </tr>
            </thead>
            <tbody>
              {output.tasks.map((task, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="px-4 py-4">
                    <p className="font-medium">{task.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{task.description}</p>
                  </td>
                  <td className="px-4 py-4"><Badge variant={PRIORITY_VARIANTS[task.priority]}>{task.priority}</Badge></td>
                  <td className="px-4 py-4"><span className="text-sm text-[#424245]">{task.estimateDays}天</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {output.reasoning && <ReasoningBox text={output.reasoning} label="拆解逻辑" />}
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm">{icon}</span>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h4>
      </div>
      {children}
    </div>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-3 text-sm text-[#424245]">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#0071e3]" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function ReasoningBox({ text, label }: { text: string; label: string }) {
  return (
    <div className="rounded-xl bg-muted/50 p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm leading-relaxed text-[#424245]">{text}</p>
    </div>
  );
}

function formatDuration(ms: number | null): string {
  if (!ms) return '-';
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}秒`;
  return `${Math.floor(s / 60)}分${s % 60}秒`;
}
