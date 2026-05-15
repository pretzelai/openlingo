import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, del, postJson } from "@/api/client";
import { Button } from "@/components/ui/Button";
import type { SrsCard } from "@/lib/types";

export function WordsPage() {
  const qc=useQueryClient();
  const { data:prefs }=useQuery({queryKey:["preferences"],queryFn:()=>api<any>("/api/preferences")});
  const language=prefs?.targetLanguage||"de";
  const { data:cards=[] }=useQuery({queryKey:["srs-cards",language],queryFn:()=>api<SrsCard[]>(`/api/srs/cards?language=${language}`),enabled:!!language});
  const { data:stats }=useQuery({queryKey:["srs-stats",language],queryFn:()=>api<any>(`/api/srs/stats?language=${language}`),enabled:!!language});
  const [word,setWord]=useState(""); const [translation,setTranslation]=useState(""); const [filter,setFilter]=useState("all");
  const add=useMutation({mutationFn:()=>postJson(`/api/srs/words/${encodeURIComponent(word)}`,{language,translation}),onSuccess:()=>{setWord("");setTranslation("");qc.invalidateQueries({queryKey:["srs-cards",language]});qc.invalidateQueries({queryKey:["srs-stats",language]});}});
  const remove=useMutation({mutationFn:(w:string)=>del(`/api/srs/words/${encodeURIComponent(w)}?language=${language}`),onSuccess:()=>qc.invalidateQueries({queryKey:["srs-cards",language]})});
  const review=useMutation({mutationFn:({w,q}:{w:string;q:number})=>postJson("/api/srs/review",{word:w,language,quality:q}),onSuccess:()=>{qc.invalidateQueries({queryKey:["srs-cards",language]});qc.invalidateQueries({queryKey:["srs-stats",language]});}});
  const visible=useMemo(()=>cards.filter(c=>filter==="all"||c.status===filter||filter==="due"&&c.nextReviewAt&&new Date(c.nextReviewAt)<=new Date()),[cards,filter]);
  return <div className="mx-auto max-w-3xl"><h1 className="mb-2 text-2xl font-black">Words</h1><p className="mb-6 text-lingo-text-light">{stats?.total??0} total · {stats?.due??0} due · {stats?.new??0} new · {stats?.review??0} review</p>
    <div className="mb-6 rounded-2xl border-2 border-lingo-border bg-white p-4"><h2 className="mb-3 font-black">Add a word</h2><div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]"><input value={word} onChange={e=>setWord(e.target.value)} placeholder="word" className="rounded-xl border-2 border-lingo-border px-3 py-2"/><input value={translation} onChange={e=>setTranslation(e.target.value)} placeholder="translation" className="rounded-xl border-2 border-lingo-border px-3 py-2"/><Button disabled={!word.trim()} loading={add.isPending} onClick={()=>add.mutate()}>Add</Button></div></div>
    <div className="mb-4 flex flex-wrap gap-2">{["all","due","new","learning","review"].map(f=><button key={f} onClick={()=>setFilter(f)} className={`rounded-full border-2 px-4 py-1.5 text-sm font-black ${filter===f?"border-lingo-blue bg-lingo-blue text-white":"border-lingo-border bg-white"}`}>{f}</button>)}</div>
    <div className="space-y-2">{visible.map(c=><div key={c.word} className="rounded-2xl border-2 border-lingo-border bg-white p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-black">{c.word}</h3><p className="text-sm text-lingo-text-light">{c.translation || "No translation"}</p><span className="mt-2 inline-block rounded-full bg-lingo-gray px-2 py-0.5 text-xs font-bold">{c.status}</span></div><div className="flex gap-1"><Button variant="secondary" onClick={()=>review.mutate({w:c.word,q:1})}>Again</Button><Button onClick={()=>review.mutate({w:c.word,q:4})}>Good</Button><Button variant="danger" onClick={()=>remove.mutate(c.word)}>×</Button></div></div></div>)}</div>{!visible.length&&<div className="rounded-2xl border-2 border-dashed border-lingo-border p-8 text-center text-lingo-text-light">No cards in this view.</div>}
  </div>;
}
