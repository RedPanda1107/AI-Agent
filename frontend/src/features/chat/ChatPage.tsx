import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { createMessage, getMessages, openStream } from './chat.api';
import { useChatStore } from './chat.store';
import type { ChatMessage } from './chat.types';

export function ChatPage({ projectId }: { projectId: string }) {
  const [input, setInput] = useState('');
  const eventSource = useRef<EventSource | null>(null);
  const { messages, isStreaming, error, setProject, setMessages, addMessage, startStream, appendDelta, completeStream, failStream } = useChatStore();

  useEffect(() => {
    setProject(projectId);
    void getMessages(projectId).then(setMessages).catch((caught: unknown) => failStream(caught instanceof Error ? caught.message : '无法加载消息'));
    return () => eventSource.current?.close();
  }, [projectId, setProject, setMessages, failStream]);

  function subscribe(streamId: string): void {
    const source = openStream(projectId, streamId); eventSource.current = source;
    source.addEventListener('message.delta', (event) => { const data = JSON.parse(event.data) as { streamId: string; delta: string }; appendDelta(data.streamId, data.delta); });
    source.addEventListener('message.complete', (event) => { const data = JSON.parse(event.data) as { streamId: string; message: ChatMessage }; completeStream(data.streamId, data.message); source.close(); });
    source.addEventListener('message.error', (event) => { const data = JSON.parse(event.data) as { message: string }; failStream(data.message); source.close(); });
    source.onerror = () => { failStream('流式连接已中断，请重试。'); source.close(); };
  }

  async function send(): Promise<void> {
    const content = input.trim(); if (!content || isStreaming) return;
    setInput('');
    try { const { userMessage, streamId } = await createMessage(projectId, content); addMessage(userMessage); startStream(streamId); subscribe(streamId); }
    catch (caught) { failStream(caught instanceof Error ? caught.message : '发送失败'); }
  }

  return <main className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f]">
    <header className="sticky top-0 z-10 border-b border-black/[0.06] bg-white/80 px-5 backdrop-blur-xl sm:px-8">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between"><a href="/" className="flex items-center gap-2.5 rounded-lg text-[15px] font-semibold tracking-[-0.02em]"><span className="grid h-7 w-7 place-items-center rounded-[9px] bg-[#0071e3] text-sm text-white">✦</span>Product Agent</a><span className="max-w-[160px] truncate rounded-full bg-[#f5f5f7] px-2.5 py-1 text-xs text-[#86868b] sm:max-w-xs">项目 · {projectId}</span></div>
    </header>
    <section className="mx-auto flex min-h-[calc(100vh-64px)] max-w-3xl flex-col px-5 sm:px-8">
      <div className="flex-1 py-9 sm:py-12">
        {messages.length === 0 && <EmptyState />}
        <div className="space-y-7">{messages.map((message) => <MessageBubble key={message.id} message={message} streaming={isStreaming && message.id === useChatStore.getState().streamId} />)}</div>
      </div>
      <div className="sticky bottom-0 bg-gradient-to-t from-[#f5f5f7] via-[#f5f5f7] to-transparent pb-6 pt-8">
        {error && <p className="mb-3 rounded-xl border border-[#fecaca] bg-[#fff5f5] px-3 py-2 text-sm text-[#c62828]">{error}</p>}
        <div className="rounded-[22px] border border-black/[0.09] bg-white p-2 shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition focus-within:border-[#0071e3]/50 focus-within:ring-4 focus-within:ring-[#0071e3]/10">
          <textarea className="block min-h-[76px] w-full resize-none border-0 bg-transparent px-3 pt-2 text-[15px] leading-6 outline-none placeholder:text-[#86868b] disabled:opacity-60" placeholder="描述你的产品想法，或继续讨论下一步…" value={input} disabled={isStreaming} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send(); } }} />
          <div className="flex items-center justify-between px-1 pb-1"><span className="pl-2 text-xs text-[#86868b]">Enter 发送 · Shift + Enter 换行</span><button aria-label="发送消息" className="grid h-9 w-9 place-items-center rounded-full bg-[#0071e3] text-lg text-white transition hover:bg-[#0077ed] active:scale-95 disabled:bg-[#d2d2d7]" disabled={isStreaming || !input.trim()} onClick={() => void send()}>{isStreaming ? <span className="h-3 w-3 animate-pulse rounded-full bg-white" /> : '↑'}</button></div>
        </div>
      </div>
    </section>
  </main>;
}

function EmptyState() { return <div className="mx-auto max-w-xl py-16 text-center sm:py-24"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-black/[0.04] bg-white text-lg text-[#0071e3] shadow-sm">✦</span><h1 className="mt-6 text-3xl font-bold tracking-[-0.04em] sm:text-4xl">从一个想法开始。</h1><p className="mx-auto mt-4 max-w-md text-[15px] leading-7 text-[#6e6e73]">告诉我你想解决的问题。我会和你一起梳理用户、场景与产品方向。</p><div className="mt-8 flex flex-wrap justify-center gap-2"><span className="rounded-full border border-black/[0.05] bg-white px-3 py-1.5 text-xs text-[#6e6e73] shadow-sm">定义产品目标</span><span className="rounded-full border border-black/[0.05] bg-white px-3 py-1.5 text-xs text-[#6e6e73] shadow-sm">梳理用户需求</span><span className="rounded-full border border-black/[0.05] bg-white px-3 py-1.5 text-xs text-[#6e6e73] shadow-sm">生成 PRD 草案</span></div></div>; }

function MessageBubble({ message, streaming }: { message: ChatMessage; streaming: boolean }) {
  const isUser = message.role === 'user';
  return <article className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[88%] rounded-[20px] px-4 py-3.5 text-[15px] leading-7 sm:max-w-[80%] ${isUser ? 'bg-[#0071e3] text-white shadow-sm' : 'border border-black/[0.06] bg-white text-[#1d1d1f] shadow-sm'}`}><p className={`mb-1 text-[11px] font-semibold tracking-wide ${isUser ? 'text-white/65' : 'text-[#86868b]'}`}>{isUser ? '你' : 'PRODUCT AGENT'}</p><div className="markdown-content"><ReactMarkdown>{message.content || (streaming ? '正在思考…' : '')}</ReactMarkdown>{streaming && message.content && <span className="ml-1 inline-block h-4 w-1 animate-pulse bg-[#0071e3] align-middle" />}</div></div></article>;
}
