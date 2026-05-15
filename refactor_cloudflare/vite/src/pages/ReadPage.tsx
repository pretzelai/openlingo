export function ReadPage() {
  return (
    <section className="page-stack">
      <div className="page-heading"><h1>Read</h1><p>Article ingestion, translation, audio generation and timestamps will move from Next route handlers to Workers APIs plus background jobs.</p></div>
      <article className="reader-card">
        <h2>Der kleine Spaziergang</h2>
        <p><strong>German:</strong> Heute lerne ich mit OpenLingo. Ich lese einen kurzen Text und höre die Aussprache.</p>
        <p><strong>English:</strong> Today I am learning with OpenLingo. I read a short text and listen to the pronunciation.</p>
      </article>
    </section>
  );
}
