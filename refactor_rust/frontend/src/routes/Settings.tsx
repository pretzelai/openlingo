import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, putJson } from "@/api/client";
import { Button } from "@/components/ui/Button";
import { languages } from "@/lib/types";

type Prompt = { id:string; displayName:string; description:string; defaultTemplate:string; customTemplate?:string|null };

export function SettingsPage() {
  const qc=useQueryClient(); const {data:prefs}=useQuery({queryKey:["preferences"],queryFn:()=>api<any>("/api/preferences")}); const {data:prompts=[]}=useQuery({queryKey:["prompts"],queryFn:()=>api<Prompt[]>("/api/prompts")}); const {data:memory}=useQuery({queryKey:["memory"],queryFn:()=>api<{value:string}>("/api/memory")});
  const [native,setNative]=useState(""); const [target,setTarget]=useState(""); const [mem,setMem]=useState("");
  useEffect(()=>{ if(prefs){ setNative(prefs.nativeLanguage||"en"); setTarget(prefs.targetLanguage||"de"); } },[prefs?.nativeLanguage,prefs?.targetLanguage]);
  useEffect(()=>{ if(memory){ setMem(memory.value||""); } },[memory?.value]);
  const savePrefs=useMutation({mutationFn:()=>api("/api/preferences",{method:"PUT",body:JSON.stringify({nativeLanguage:native,targetLanguage:target})}),onSuccess:()=>qc.invalidateQueries({queryKey:["preferences"]})});
  const saveMem=useMutation({mutationFn:()=>putJson("/api/memory",{value:mem}),onSuccess:()=>qc.invalidateQueries({queryKey:["memory"]})});
  return <div className="mx-auto max-w-3xl"><h1 className="mb-6 text-2xl font-black">Settings</h1><section className="mb-6 rounded-2xl border-2 border-lingo-border bg-white p-4"><h2 className="mb-3 font-black">Languages</h2><div className="grid gap-3 md:grid-cols-2"><Select label="Native language" value={native} onChange={setNative}/><Select label="Target language" value={target} onChange={setTarget}/></div><Button className="mt-3" loading={savePrefs.isPending} onClick={()=>savePrefs.mutate()}>Save languages</Button></section><section className="mb-6 rounded-2xl border-2 border-lingo-border bg-white p-4"><h2 className="mb-3 font-black">AI Memory</h2><textarea value={mem} onChange={e=>setMem(e.target.value)} className="min-h-40 w-full rounded-xl border-2 border-lingo-border p-3"/><Button className="mt-3" loading={saveMem.isPending} onClick={()=>saveMem.mutate()}>Save memory</Button></section><section className="space-y-3">{prompts.map(p=><PromptEditor key={p.id} prompt={p}/>)}</section></div>;
}

function PromptEditor({prompt}:{prompt:Prompt}){const qc=useQueryClient(); const [open,setOpen]=useState(false); const [value,setValue]=useState(prompt.customTemplate||prompt.defaultTemplate); const save=useMutation({mutationFn:()=>putJson(`/api/prompts/${prompt.id}`,{value}),onSuccess:()=>qc.invalidateQueries({queryKey:["prompts"]})}); return <div className="rounded-2xl border-2 border-lingo-border bg-white p-4"><button onClick={()=>setOpen(!open)} className="flex w-full items-center justify-between text-left"><span><b>{prompt.displayName}</b><br/><span className="text-sm text-lingo-text-light">{prompt.description}</span></span><span>{open?"−":"+"}</span></button>{open&&<div className="mt-3"><textarea value={value} onChange={e=>setValue(e.target.value)} className="min-h-44 w-full rounded-xl border-2 border-lingo-border p-3 font-mono text-sm"/><Button className="mt-2" loading={save.isPending} onClick={()=>save.mutate()}>Save prompt</Button></div>}</div>}
function Select({label,value,onChange}:{label:string;value:string;onChange:(v:string)=>void}){return <label className="block text-sm font-bold text-lingo-text-light">{label}<select value={value} onChange={e=>onChange(e.target.value)} className="mt-1 w-full rounded-xl border-2 border-lingo-border bg-white px-3 py-2 text-lingo-text">{Object.entries(languages).map(([code,name])=><option key={code} value={code}>{name}</option>)}</select></label>}
