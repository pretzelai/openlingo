import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, postJson } from "@/api/client";
import { Button } from "@/components/ui/Button";
import type { Exercise, Unit } from "@/lib/types";

export function LessonPage({ publicMode=false }: { publicMode?: boolean }) {
  const { unitId, lessonIndex = "0", courseId } = useParams(); const nav=useNavigate();
  const { data: unit } = useQuery({ queryKey:["unit",unitId], queryFn:()=>api<Unit>(`/api/units/${unitId}`)});
  const idx = Number(lessonIndex); const lesson = unit?.lessons[idx];
  const [current,setCurrent]=useState(0); const [results,setResults]=useState<any[]>([]); const [complete,setComplete]=useState(false);
  const submit=useMutation({mutationFn:()=>postJson<{perfectScore:boolean}>("/api/lesson/complete",{unitId,lessonIndex:idx,results,mistakeCount:results.filter(r=>!r.correct).length}),onSuccess:()=>setComplete(true)});
  if (!unit || !lesson) return <div className="mx-auto max-w-lg"><p>Loading lesson...</p></div>;
  const exercises = lesson.exercises;
  const exercise = exercises[current] ?? exercises[0];
  function answer(correct:boolean, userAnswer:string){ const next=[...results,{exerciseIndex:current,exerciseType:exercise.type,correct,userAnswer}]; setResults(next); if(current+1>=exercises.length){ setResults(next); if(publicMode) setComplete(true); else submit.mutate(); } else setCurrent(current+1); }
  if (complete) return <div className="mx-auto max-w-lg rounded-2xl border-2 border-lingo-border bg-white p-8 text-center"><div className="text-5xl">🎉</div><h1 className="mt-4 text-2xl font-black">Lesson complete!</h1><p className="mt-2 text-lingo-text-light">{results.filter(r=>!r.correct).length===0 ? "Perfect score." : `${results.filter(r=>!r.correct).length} mistakes.`}</p><Button className="mt-6" onClick={()=>nav(publicMode?`/unit/${unit.id}`: courseId && courseId!=="standalone"?`/units/${courseId}`:`/unit/${unit.id}`)}>Continue</Button></div>;
  return <div className="mx-auto max-w-lg"><div className="mb-5 flex items-center gap-3"><Link to={publicMode?`/unit/${unit.id}`: courseId&&courseId!=="standalone"?`/units/${courseId}`:`/unit/${unit.id}`} className="text-lingo-text-light">✕</Link><div className="h-3 flex-1 overflow-hidden rounded-full bg-lingo-gray"><div className="h-full bg-lingo-green transition-all" style={{width:`${(current/exercises.length)*100}%`}} /></div></div><p className="text-sm text-lingo-text-light">{unit.title}</p><h1 className="mb-6 text-xl font-black">{lesson.title}</h1><ExerciseView exercise={exercise} onAnswer={answer} language={unit.targetLanguage}/></div>;
}

function ExerciseView({ exercise, onAnswer, language }: { exercise: Exercise; onAnswer: (correct:boolean, answer:string)=>void; language:string }) {
  const [selected,setSelected]=useState<string|number|null>(null); const [text,setText]=useState(""); const [show,setShow]=useState(false);
  const choices = useMemo(()=> exercise.choices || exercise.words || [], [exercise]);
  if (!exercise) return null;
  if (["multiple-choice","listening"].includes(exercise.type)) return <Card><Question>{exercise.text}</Question><div className="grid gap-2">{choices.map((c:string,i:number)=><button key={i} onClick={()=>setSelected(i)} className={`rounded-xl border-2 p-3 text-left font-bold ${selected===i?"border-lingo-blue bg-lingo-blue/5":"border-lingo-border bg-white"}`}>{c}</button>)}</div><Bottom><Button disabled={selected===null} onClick={()=>onAnswer(selected===exercise.correctIndex, String(choices[selected as number] || ""))}>Check</Button></Bottom></Card>;
  if (exercise.type==="translation" || exercise.type==="fill-in-the-blank" || exercise.type==="speaking" || exercise.type==="free-text") { const answer = exercise.answer || exercise.blank || exercise.sentence || ""; const correct = normalize(text)===normalize(answer) || (exercise.acceptAlso||[]).some((a:string)=>normalize(a)===normalize(text)); return <Card><Question>{exercise.text || exercise.sentence}</Question>{show ? <div className="rounded-xl border-2 border-lingo-border bg-lingo-bg p-4"><p className="font-bold">Answer: {answer}</p><p className="mt-2 text-sm text-lingo-text-light">Your answer: {text}</p></div> : <textarea value={text} onChange={e=>setText(e.target.value)} className="min-h-28 w-full rounded-xl border-2 border-lingo-border p-3 focus:border-lingo-blue focus:outline-none" placeholder="Type your answer..."/>}<Bottom>{show ? <Button onClick={()=>onAnswer(correct,text)}>{correct?"Continue":"Got it"}</Button> : <Button disabled={!text.trim()} onClick={()=>setShow(true)}>Check</Button>}</Bottom></Card>; }
  if (exercise.type==="matching-pairs") return <Card><Question>Match the pairs</Question><div className="space-y-2">{(exercise.pairs||[]).map((p:any,i:number)=><div key={i} className="flex gap-2"><div className="flex-1 rounded-xl bg-lingo-bg p-3 font-bold">{p.left}</div><div className="flex-1 rounded-xl bg-lingo-bg p-3">{p.right}</div></div>)}</div><Bottom><Button onClick={()=>onAnswer(true,"matched")}>Continue</Button></Bottom></Card>;
  if (exercise.type==="word-bank") return <Card><Question>{exercise.text}</Question><div className="mb-3 flex flex-wrap gap-2">{(exercise.words||[]).map((w:string)=><button key={w} onClick={()=>setText(`${text} ${w}`.trim())} className="rounded-full border-2 border-lingo-border px-3 py-1 text-sm font-bold">{w}</button>)}</div><input value={text} onChange={e=>setText(e.target.value)} className="w-full rounded-xl border-2 border-lingo-border p-3"/><Bottom><Button onClick={()=>onAnswer(normalize(text)===normalize((exercise.answer||[]).join(" ")),text)}>Check</Button></Bottom></Card>;
  if (exercise.type==="flashcard-review") return <Card><Question>{show ? exercise.back : exercise.front}</Question><Bottom>{show ? <><Button variant="danger" onClick={()=>onAnswer(false,"again")}>Again</Button><Button onClick={()=>onAnswer(true,"remembered")}>Remembered</Button></> : <Button onClick={()=>setShow(true)}>Show answer</Button>}</Bottom></Card>;
  return <Card><Question>Unsupported exercise: {exercise.type}</Question><Button onClick={()=>onAnswer(true,"skipped")}>Skip</Button></Card>;
}

function Card({children}:{children:React.ReactNode}){return <div className="rounded-2xl border-2 border-lingo-border bg-white p-5">{children}</div>}
function Question({children}:{children:React.ReactNode}){return <h2 className="mb-5 text-xl font-black">{children}</h2>}
function Bottom({children}:{children:React.ReactNode}){return <div className="mt-6 flex justify-end gap-2">{children}</div>}
function normalize(s:string){return s.toLowerCase().trim().replace(/[.!?¿¡,]/g,"").replace(/\s+/g," ")}
