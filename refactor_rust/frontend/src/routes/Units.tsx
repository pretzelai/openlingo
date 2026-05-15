import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, del, postJson, putJson } from "@/api/client";
import { Button } from "@/components/ui/Button";
import type { Course, Unit } from "@/lib/types";

export function UnitsPage() {
  const { data: units = [] } = useQuery({ queryKey: ["units"], queryFn: () => api<Unit[]>("/api/units") });
  const { data: courses = [] } = useQuery({ queryKey: ["courses"], queryFn: () => api<Course[]>("/api/courses") });
  return <div className="mx-auto max-w-3xl"><Header title="Learn" actions={<><LinkBtn to="/chat?prompt=I%20want%20to%20create%20a%20new%20personalised%20unit">+ New Unit</LinkBtn><LinkBtn to="/units/browse">Browse</LinkBtn></>} />
    <Section title="My Units">{units.length ? <div className="grid gap-3">{units.map(u=><UnitCard key={u.id} unit={u}/>)}</div> : <Empty text="Ask the tutor to create your first unit." />}</Section>
    <Section title="Courses">{courses.length ? <div className="grid gap-3">{courses.map(c=><Link key={c.id} to={`/units/${c.id}`} className="rounded-2xl border-2 border-lingo-border bg-white p-4 hover:border-lingo-blue"><h3 className="font-black">{c.title}</h3><p className="text-sm text-lingo-text-light">{c.level} · {c.unitCount ?? 0} units · {c.lessonCount ?? 0} lessons</p></Link>)}</div> : <Empty text="No courses yet." />}</Section>
  </div>;
}

export function BrowseUnitsPage() {
  const qc = useQueryClient();
  const { data: units = [] } = useQuery({ queryKey: ["browse-units"], queryFn: () => api<Unit[]>("/api/units/browse") });
  const add = useMutation({ mutationFn: (id:string) => postJson(`/api/units/${id}/library`, {}), onSuccess:()=>{qc.invalidateQueries({queryKey:["browse-units"]});qc.invalidateQueries({queryKey:["units"]});} });
  return <div className="mx-auto max-w-3xl"><Header title="Browse Units"/><div className="grid gap-3">{units.map(u=><div key={u.id} className="rounded-2xl border-2 border-lingo-border bg-white p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-black">{u.icon} {u.title}</h3><p className="text-sm text-lingo-text-light">{u.description}</p></div><Button onClick={()=>add.mutate(u.id)} loading={add.isPending}>Add</Button></div></div>)}</div>{!units.length&&<Empty text="No public units to add."/>}</div>;
}

export function CoursePage() {
  const { courseId } = useParams();
  const { data } = useQuery({ queryKey: ["course", courseId], queryFn: () => api<{course:Course;units:Unit[]}>(`/api/courses/${courseId}`) });
  if (!data) return <Empty text="Loading course..." />;
  return <div className="mx-auto max-w-3xl"><Header title={data.course.title}/><div className="grid gap-3">{data.units.map(u=><UnitCard key={u.id} unit={u} courseId={courseId}/>)}</div></div>;
}

export function UnitPage({ publicMode=false }: { publicMode?: boolean }) {
  const { unitId } = useParams();
  const { data: unit } = useQuery({ queryKey: ["unit", unitId], queryFn: () => api<Unit>(`/api/units/${unitId}`) });
  if (!unit) return <Empty text="Loading unit..." />;
  return <div className="mx-auto max-w-2xl"><Header title={`${unit.icon} ${unit.title}`} actions={!publicMode && <LinkBtn to={`/units/edit/${unit.id}`}>Edit</LinkBtn>}/><p className="mb-5 text-lingo-text-light">{unit.description}</p><div className="grid gap-3">{unit.lessons.map((l,i)=><Link key={i} to={publicMode ? `/unit/${unit.id}/lesson/${i}` : `/lesson/${unit.courseId || "standalone"}/${unit.id}/${i}`} className="rounded-2xl border-2 border-lingo-border bg-white p-4 hover:border-lingo-green"><h3 className="font-black">{l.icon || "⭐"} {l.title}</h3><p className="text-sm text-lingo-text-light">{l.exercises.length} exercises</p></Link>)}</div></div>;
}

export function EditUnitPage() {
  const { unitId } = useParams(); const nav=useNavigate(); const qc=useQueryClient();
  const { data: unit } = useQuery({ queryKey:["unit",unitId], queryFn:()=>api<Unit>(`/api/units/${unitId}`)});
  const [markdown,setMarkdown]=useState("");
  if (unit && !markdown) setMarkdown(unit.markdown || "");
  const save=useMutation({mutationFn:()=>putJson(`/api/units/${unitId}/markdown`,{markdown}), onSuccess:()=>{qc.invalidateQueries({queryKey:["unit",unitId]}); nav(`/unit/${unitId}`)}});
  const remove=useMutation({mutationFn:()=>del(`/api/units/${unitId}`), onSuccess:()=>nav("/units")});
  return <div className="mx-auto max-w-4xl"><Header title={`Edit ${unit?.title || "Unit"}`}/><textarea value={markdown} onChange={e=>setMarkdown(e.target.value)} className="h-[60vh] w-full rounded-2xl border-2 border-lingo-border bg-white p-4 font-mono text-sm focus:border-lingo-blue focus:outline-none"/><div className="mt-3 flex gap-2"><Button onClick={()=>save.mutate()} loading={save.isPending}>Save</Button><Button variant="danger" onClick={()=>confirm("Delete unit?")&&remove.mutate()} loading={remove.isPending}>Delete</Button></div></div>;
}

function UnitCard({ unit, courseId }: { unit: Unit; courseId?: string }) { return <Link to={courseId ? `/units/${courseId}?unit=${unit.id}` : `/unit/${unit.id}`} className="rounded-2xl border-2 border-lingo-border bg-white p-4 hover:border-lingo-green"><h3 className="font-black">{unit.icon} {unit.title}</h3><p className="mt-1 text-sm text-lingo-text-light">{unit.description}</p><p className="mt-2 text-xs font-bold text-lingo-text-light">{unit.lessonCount} lessons · {unit.level || "custom"}</p></Link>; }
function Header({ title, actions }: { title: string; actions?: React.ReactNode }) { return <div className="mb-6 flex items-center justify-between gap-3"><h1 className="text-2xl font-black">{title}</h1><div className="flex gap-2">{actions}</div></div>; }
function Section({ title, children }: { title: string; children: React.ReactNode }) { return <section className="mb-8"><h2 className="mb-3 text-sm font-black uppercase tracking-wide text-lingo-text-light">{title}</h2>{children}</section>; }
function Empty({ text }: { text: string }) { return <div className="rounded-2xl border-2 border-dashed border-lingo-border p-8 text-center text-lingo-text-light">{text}</div>; }
function LinkBtn({ to, children }: { to: string; children: React.ReactNode }) { return <Link to={to} className="rounded-xl border-2 border-lingo-border bg-white px-4 py-2 text-sm font-black hover:border-lingo-blue">{children}</Link>; }
