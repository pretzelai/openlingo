import { FormEvent, useState } from "react";
import { api, WordLookupResult } from "../lib/api";

export function WordsPage() {
  const [word, setWord] = useState("lernen");
  const [language, setLanguage] = useState("de");
  const [result, setResult] = useState<WordLookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      setResult(await api.lookupWord(word, language));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lookup failed");
    }
  }

  return (
    <section className="page-stack">
      <div className="page-heading"><h1>Words</h1><p>Dictionary + AI fallback lookup through the Workers backend.</p></div>
      <form className="lookup-form" onSubmit={submit}>
        <input value={word} onChange={(e) => setWord(e.target.value)} placeholder="Word" />
        <input value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="Language code" />
        <button className="button primary">Look up</button>
      </form>
      {error && <p className="error">{error}</p>}
      {result && <div className="panel"><h2>{result.word}</h2><p>{result.translation || (result.found ? "Found" : "Not found")}</p><p className="muted">{result.pos} {result.cefrLevel}</p><p>{result.exampleNative}</p><p>{result.exampleEnglish}</p></div>}
    </section>
  );
}
