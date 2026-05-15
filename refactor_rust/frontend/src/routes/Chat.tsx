import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, postJson, putJson, streamChat } from "@/api/client";
import { Button } from "@/components/ui/Button";

type Message = { role: "user" | "assistant"; content: string };
type Conversation = { id: string; title: string; language: string; messages: Message[] };

export function ChatPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: prefs } = useQuery({ queryKey: ["preferences"], queryFn: () => api<any>("/api/preferences") });
  const { data: conversations } = useQuery({ queryKey: ["conversations"], queryFn: () => api<Conversation[]>("/api/chat/conversations") });
  const { data: loaded } = useQuery({ queryKey: ["conversation", id], enabled: !!id, queryFn: () => api<Conversation>(`/api/chat/conversations/${id}`) });
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const language = prefs?.targetLanguage || "de";

  useEffect(() => { if (loaded?.messages) setMessages(loaded.messages); }, [loaded?.id]);
  useEffect(() => { const prompt = params.get("prompt"); if (prompt && messages.length === 0) void send(prompt); }, [params]);

  async function save(all: Message[]) {
    if (id) await putJson(`/api/chat/conversations/${id}`, { messages: all });
    else {
      const title = all.find(m=>m.role==="user")?.content.slice(0,50) || "New chat";
      const created = await postJson<{id:string}>("/api/chat/conversations", { language, title, messages: all });
      navigate(`/chat/${created.id}`, { replace: true });
    }
    await qc.invalidateQueries({ queryKey: ["conversations"] });
  }

  async function send(text = input.trim()) {
    if (!text || streaming) return;
    const next: Message[] = [...messages, { role: "user", content: text }, { role: "assistant", content: "" }];
    setMessages(next); setInput(""); setStreaming(true);
    let assistant = "";
    try {
      await streamChat({ messages: next.slice(0, -1), language }, (delta) => {
        assistant += delta;
        setMessages([...next.slice(0, -1), { role: "assistant", content: assistant }]);
      });
      const finalMessages = [...next.slice(0, -1), { role: "assistant" as const, content: assistant }];
      setMessages(finalMessages);
      await save(finalMessages);
    } finally { setStreaming(false); }
  }

  const suggested = useMemo(() => ["Let's practice!", "Create a beginner unit about travel", "How many words are due?", "I want to create a new translated article"], []);
  return <div className="mx-auto flex h-[calc(100dvh-7rem)] max-w-6xl gap-4">
    <aside className="hidden w-64 shrink-0 rounded-2xl border-2 border-lingo-border bg-white p-3 md:block"><Link to="/chat" className="mb-3 block rounded-xl bg-lingo-green px-4 py-2 text-center font-black text-white">+ New chat</Link><div className="space-y-1 overflow-auto">{conversations?.map(c=><Link key={c.id} to={`/chat/${c.id}`} className={`block truncate rounded-lg px-3 py-2 text-sm font-bold ${c.id===id?"bg-lingo-green/10 text-lingo-green":"text-lingo-text-light hover:bg-lingo-gray/40"}`}>{c.title}</Link>)}</div></aside>
    <section className="flex min-w-0 flex-1 flex-col rounded-2xl border-2 border-lingo-border bg-white">
      <div className="flex-1 overflow-auto p-4 md:p-6">{messages.length===0 ? <div className="flex h-full flex-col items-center justify-center text-center"><div className="text-4xl">💬</div><h1 className="mt-3 text-xl font-black">AI Tutor</h1><p className="mt-2 max-w-sm text-sm text-lingo-text-light">Practice vocabulary, create lessons, or translate articles.</p><div className="mt-5 flex flex-wrap justify-center gap-2">{suggested.map(s=><button key={s} onClick={()=>send(s)} className="rounded-full border-2 border-lingo-border px-4 py-2 text-xs font-bold hover:border-lingo-blue">{s}</button>)}</div></div> : <div className="space-y-4">{messages.map((m,i)=><div key={i} className={`flex ${m.role==="user"?"justify-end":"justify-start"}`}><div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm ${m.role==="user"?"bg-lingo-green text-white":"bg-lingo-bg text-lingo-text"}`}>{m.content || "…"}</div></div>)}</div>}</div>
      <form onSubmit={(e:FormEvent)=>{e.preventDefault(); void send();}} className="border-t-2 border-lingo-border p-3"><div className="flex gap-2"><textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();void send();}}} placeholder="Send a message..." className="min-h-11 flex-1 resize-none rounded-xl border-2 border-lingo-border p-3 focus:border-lingo-blue focus:outline-none"/><Button loading={streaming} disabled={!input.trim()}>Send</Button></div></form>
    </section>
  </div>;
}
