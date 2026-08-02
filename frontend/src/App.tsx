import { useState } from 'react';
import { ChatPage } from './features/chat/ChatPage';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

export function App() {
  const match = window.location.pathname.match(/^\/projects\/([^/]+)\/chat$/);
  if (match) return <ChatPage projectId={match[1]} />;
  return <ProjectLauncher />;
}

function ProjectLauncher() {
  const [name, setName] = useState('AI 学习助手');
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function createProject(): Promise<void> {
    if (!name.trim() || creating) return;
    setCreating(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/projects`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim() }),
      });
      if (!response.ok) throw new Error('项目创建失败，请确认后端和数据库已启动。');
      const project: { id: string } = await response.json();
      window.location.assign(`/projects/${project.id}/chat`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '项目创建失败');
    } finally { setCreating(false); }
  }

  return (
    <main className="min-h-screen bg-[#f5f5f7] px-5 py-5 sm:px-8">
      <header className="mx-auto flex max-w-5xl items-center justify-between py-3">
        <div className="flex items-center gap-2.5 text-[15px] font-semibold tracking-[-0.02em] text-[#1d1d1f]">
          <span className="grid h-7 w-7 place-items-center rounded-[9px] bg-[#0071e3] text-sm text-white">✦</span>
          Product Agent
        </div>
        <span className="rounded-full border border-black/[0.06] bg-white/80 px-3 py-1 text-xs font-medium text-[#6e6e73] shadow-sm">AI 工作台</span>
      </header>
      <section className="mx-auto flex min-h-[calc(100vh-112px)] max-w-5xl items-center">
        <div className="w-full overflow-hidden rounded-[28px] border border-black/[0.06] bg-white shadow-[0_20px_60px_rgba(0,0,0,0.08)] md:grid md:grid-cols-[1.05fr_0.95fr]">
          <div className="p-8 sm:p-12">
            <p className="text-sm font-semibold text-[#0071e3]">开始一个新项目</p>
            <h1 className="mt-4 max-w-md text-4xl font-bold tracking-[-0.045em] text-[#1d1d1f] sm:text-5xl">把产品想法，变成清晰的下一步。</h1>
            <p className="mt-5 max-w-md text-[15px] leading-7 text-[#6e6e73]">与 AI 产品经理一起梳理需求、明确用户价值，并逐步构建可执行的产品方案。</p>
            <label className="mt-10 block text-sm font-semibold text-[#1d1d1f]" htmlFor="project-name">项目名称</label>
            <input id="project-name" className="mt-3 w-full rounded-2xl border border-black/[0.1] bg-[#fbfbfd] px-4 py-3.5 text-[15px] text-[#1d1d1f] outline-none transition placeholder:text-[#86868b] focus:border-[#0071e3] focus:ring-4 focus:ring-[#0071e3]/15" placeholder="例如：AI 学习助手" autoFocus value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && void createProject()} />
            {error && <p className="mt-3 rounded-xl bg-[#fff2f2] px-3 py-2 text-sm text-[#c62828]">{error}</p>}
            <button className="mt-6 rounded-full bg-[#0071e3] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0077ed] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50" disabled={creating || !name.trim()} onClick={() => void createProject()}>{creating ? '正在创建…' : '进入工作台  →'}</button>
          </div>
          <aside className="hidden bg-[#f5f5f7] p-8 md:flex md:flex-col md:justify-between">
            <div className="overflow-hidden rounded-3xl border border-black/[0.04] bg-white/70 shadow-sm">
              <div className="flex items-center justify-between px-5 pb-4 pt-5"><span className="text-xs font-semibold text-[#6e6e73]">项目启动清单</span><span className="rounded-full bg-[#e8f2ff] px-2 py-0.5 text-[11px] font-medium text-[#0071e3]">第 1 步</span></div>
              <div className="border-t border-black/[0.05] text-sm"><p className="flex items-center gap-3 px-5 py-4 text-[#424245]"><span className="grid h-5 w-5 place-items-center rounded-full bg-[#0071e3] text-[10px] text-white">✓</span>描述你的产品设想</p><p className="flex items-center gap-3 border-t border-black/[0.05] px-5 py-4 text-[#86868b]"><span className="h-5 w-5 rounded-full border border-[#d2d2d7]" />明确目标用户与场景</p><p className="flex items-center gap-3 border-t border-black/[0.05] px-5 py-4 text-[#86868b]"><span className="h-5 w-5 rounded-full border border-[#d2d2d7]" />生成产品需求草案</p></div>
            </div>
            <p className="mt-10 text-sm leading-6 text-[#86868b]">简洁的对话，专注的决策。<br />让每个产品选择都有迹可循。</p>
          </aside>
        </div>
      </section>
    </main>
  );
}
