import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";

type AuthMode = "sign-in" | "sign-up" | "forgot" | "reset";

export function AuthPage({ mode }: { mode: AuthMode }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setStatus("Working…");
    try {
      if (mode === "sign-up") {
        await api.signUp(email, password, name || email.split("@")[0]);
      } else if (mode === "sign-in") {
        await api.signIn(email, password);
      } else {
        setStatus("Password email/reset UI is preserved; backend endpoint wiring is next.");
        return;
      }
      navigate("/units");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Authentication failed.");
    }
  }

  const title = mode === "sign-up" ? "Create your account" : mode === "sign-in" ? "Welcome back" : mode === "forgot" ? "Reset password" : "Choose a new password";

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <Link to="/" className="brand centered">OpenLingo</Link>
        <h1>{title}</h1>
        {mode === "sign-up" && <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />}
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required />
        {mode !== "forgot" && <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required />}
        <button className="button primary large" type="submit">{mode === "sign-up" ? "Sign up" : mode === "sign-in" ? "Sign in" : "Continue"}</button>
        {status && <p className="status">{status}</p>}
        <p className="muted">
          {mode === "sign-in" ? <Link to="/sign-up">Need an account?</Link> : <Link to="/sign-in">Already have an account?</Link>}
        </p>
      </form>
    </div>
  );
}
