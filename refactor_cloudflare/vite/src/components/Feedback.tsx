import { FormEvent, useState } from "react";
import { api } from "../lib/api";

export function Feedback() {
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setStatus("Sending…");
    try {
      await api.feedback(message, email || undefined);
      setMessage("");
      setStatus("Thanks — feedback sent.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Feedback failed.");
    }
  }

  return (
    <form className="feedback-card" onSubmit={submit}>
      <h3>Share feedback</h3>
      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (if signed out)" />
      <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="What should we improve?" rows={3} />
      <button className="button primary" disabled={!message.trim()}>Send</button>
      {status && <p className="muted">{status}</p>}
    </form>
  );
}
