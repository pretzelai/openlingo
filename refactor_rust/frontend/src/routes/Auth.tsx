import { FormEvent, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, postJson } from "@/api/client";
import { Button } from "@/components/ui/Button";
import { languages } from "@/lib/types";

function AuthCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="w-full max-w-sm rounded-2xl border-2 border-lingo-border bg-white p-6 shadow-sm"><Link to="/" className="mb-6 block text-center text-2xl font-black text-lingo-green">OpenLingo</Link><h1 className="mb-5 text-center text-xl font-black">{title}</h1>{children}</div>;
}

export function SignIn() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [email, setEmail] = useState("testing@openlingo.dev");
  const [password, setPassword] = useState("0P3NL1NG0");
  const m = useMutation({ mutationFn: () => postJson("/api/auth/sign-in", { email, password }), onSuccess: async () => { await qc.invalidateQueries({queryKey:["session"]}); navigate(params.get("redirect") || "/chat"); } });
  return <AuthCard title="Welcome back"><form onSubmit={(e)=>{e.preventDefault(); m.mutate();}} className="space-y-3"><Input label="Email" value={email} onChange={setEmail}/><Input label="Password" type="password" value={password} onChange={setPassword}/>{m.error && <p className="text-sm text-lingo-red">{m.error.message}</p>}<Button className="w-full" loading={m.isPending}>Sign in</Button></form><p className="mt-4 text-center text-sm text-lingo-text-light"><Link className="font-bold text-lingo-blue" to="/forgot-password">Forgot password?</Link> · <Link className="font-bold text-lingo-blue" to="/sign-up">Sign up</Link></p></AuthCard>;
}

export function SignUp() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [name,setName] = useState("Testing User"); const [email,setEmail]=useState(`testing-${Date.now()}@openlingo.dev`); const [password,setPassword]=useState("0P3NL1NG0");
  const m = useMutation({ mutationFn: () => postJson("/api/auth/sign-up", { name, email, password }), onSuccess: async () => { await qc.invalidateQueries({queryKey:["session"]}); navigate(params.get("redirect") || "/onboarding"); } });
  return <AuthCard title="Create account"><form onSubmit={(e)=>{e.preventDefault(); m.mutate();}} className="space-y-3"><Input label="Name" value={name} onChange={setName}/><Input label="Email" value={email} onChange={setEmail}/><Input label="Password" type="password" value={password} onChange={setPassword}/>{m.error && <p className="text-sm text-lingo-red">{m.error.message}</p>}<Button className="w-full" loading={m.isPending}>Sign up</Button></form><p className="mt-4 text-center text-sm text-lingo-text-light">Already have an account? <Link className="font-bold text-lingo-blue" to="/sign-in">Sign in</Link></p></AuthCard>;
}

export function ForgotPassword() {
  const [email,setEmail]=useState(""); const m=useMutation({mutationFn:()=>postJson("/api/auth/password-reset/request",{email})});
  return <AuthCard title="Reset password"><form onSubmit={(e)=>{e.preventDefault();m.mutate();}} className="space-y-3"><Input label="Email" value={email} onChange={setEmail}/><Button className="w-full" loading={m.isPending}>Send reset link</Button>{m.isSuccess && <p className="text-sm text-lingo-green-dark">If the email exists, a reset link was sent.</p>}</form></AuthCard>;
}

export function ResetPassword() { return <AuthCard title="Reset password"><p className="text-sm text-lingo-text-light">Password reset tokens are issued by the backend. Confirmation is intentionally disabled until production hash compatibility is verified.</p><Link className="mt-4 block text-center font-bold text-lingo-blue" to="/sign-in">Back to sign in</Link></AuthCard>; }

export function Onboarding() {
  const navigate = useNavigate(); const [native,setNative]=useState("en"); const [target,setTarget]=useState("de");
  const m=useMutation({mutationFn:()=>api("/api/preferences",{method:"PUT",body:JSON.stringify({nativeLanguage:native,targetLanguage:target})}),onSuccess:()=>navigate("/chat")});
  return <div className="mx-auto max-w-lg rounded-2xl border-2 border-lingo-border bg-white p-6"><h1 className="mb-2 text-2xl font-black">Choose your languages</h1><p className="mb-6 text-sm text-lingo-text-light">This sets up your tutor, lessons, and dictionary.</p><Select label="I know" value={native} onChange={setNative}/><Select label="I want to learn" value={target} onChange={setTarget}/><Button className="mt-5 w-full" loading={m.isPending} onClick={()=>m.mutate()}>Start learning</Button></div>;
}

function Input({label,value,onChange,type="text"}:{label:string;value:string;onChange:(v:string)=>void;type?:string}){return <label className="block text-sm font-bold text-lingo-text-light">{label}<input type={type} value={value} onChange={e=>onChange(e.target.value)} className="mt-1 w-full rounded-xl border-2 border-lingo-border px-3 py-2 text-lingo-text focus:border-lingo-blue focus:outline-none"/></label>}
function Select({label,value,onChange}:{label:string;value:string;onChange:(v:string)=>void}){return <label className="mb-3 block text-sm font-bold text-lingo-text-light">{label}<select value={value} onChange={e=>onChange(e.target.value)} className="mt-1 w-full rounded-xl border-2 border-lingo-border bg-white px-3 py-2 text-lingo-text focus:border-lingo-blue focus:outline-none">{Object.entries(languages).map(([code,name])=><option key={code} value={code}>{name}</option>)}</select></label>}
