import { FormEvent, useState } from "react";

export function ChatPage() {
  const [messages, setMessages] = useState([{ role: "assistant", text: "Hi! The Vite shell is ready. Streaming chat will call the Workers /api/chat endpoint next." }]);
  const [input, setInput] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!input.trim()) return;
    setMessages((items) => [...items, { role: "user", text: input }, { role: "assistant", text: "This migration preview keeps the chat UX while backend streaming is being wired to Workers." }]);
    setInput("");
  }

  return (
    <section className="chat-page">
      <div className="messages">
        {messages.map((message, index) => <div key={index} className={`bubble ${message.role}`}>{message.text}</div>)}
      </div>
      <form className="composer" onSubmit={submit}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Practice a phrase…" />
        <button className="button primary">Send</button>
      </form>
    </section>
  );
}
