import { FormEvent, useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAsync } from "../lib/useAsync";

export function SettingsPage() {
  const profile = useAsync(() => api.profile(), []);
  const preferences = useAsync(() => api.preferences(), []);
  const memory = useAsync(() => api.memory(), []);
  const srs = useAsync(() => api.srsStats(preferences.data?.targetLanguage ?? undefined), [preferences.data?.targetLanguage]);
  const [nativeLanguage, setNativeLanguage] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("");
  const [memoryValue, setMemoryValue] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (preferences.data) {
      setNativeLanguage(preferences.data.nativeLanguage ?? "");
      setTargetLanguage(preferences.data.targetLanguage ?? "");
    }
  }, [preferences.data]);

  useEffect(() => {
    if (memory.data) setMemoryValue(memory.data.value);
  }, [memory.data]);

  async function savePreferences(event: FormEvent) {
    event.preventDefault();
    setStatus("Saving preferences…");
    try {
      await api.updatePreferences({ nativeLanguage, targetLanguage });
      setStatus("Preferences saved.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to save preferences.");
    }
  }

  async function saveMemory(event: FormEvent) {
    event.preventDefault();
    setStatus("Saving memory…");
    try {
      await api.updateMemory(memoryValue);
      setStatus("Memory saved.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to save memory.");
    }
  }

  return (
    <section className="page-stack">
      <div className="page-heading"><h1>Settings</h1><p>Preferences, profile, memory and SRS stats now call explicit Workers APIs.</p></div>
      {status && <p className="status">{status}</p>}
      <div className="grid two">
        <div className="panel">
          <h2>Profile</h2>
          {profile.loading && <p className="muted">Loading profile…</p>}
          {profile.error && <p className="error">{profile.error}</p>}
          {profile.data && (
            <>
              <p><strong>{profile.data.user.name || profile.data.user.email}</strong></p>
              <p className="muted">Current streak: {profile.data.stats.currentStreak ?? 0}</p>
              <p className="muted">Lessons completed: {profile.data.stats.totalLessonsCompleted ?? 0}</p>
            </>
          )}
        </div>
        <form className="panel form-stack" onSubmit={savePreferences}>
          <h2>Learning preferences</h2>
          <label>Native language<input value={nativeLanguage} onChange={(e) => setNativeLanguage(e.target.value)} placeholder="en" /></label>
          <label>Target language<input value={targetLanguage} onChange={(e) => setTargetLanguage(e.target.value)} placeholder="de" /></label>
          <p className="muted">Preferred model: {preferences.data?.preferredModel ?? "—"}</p>
          <button className="button primary">Save preferences</button>
        </form>
        <form className="panel form-stack" onSubmit={saveMemory}>
          <h2>AI memory</h2>
          <textarea value={memoryValue} onChange={(e) => setMemoryValue(e.target.value)} rows={7} placeholder="Tell OpenLingo how to personalize your practice…" />
          <button className="button primary">Save memory</button>
        </form>
        <div className="panel">
          <h2>SRS stats</h2>
          {srs.loading && <p className="muted">Loading SRS stats…</p>}
          {srs.error && <p className="error">{srs.error}</p>}
          {srs.data && (
            <div className="stat-grid">
              <span>Total <strong>{srs.data.stats.total}</strong></span>
              <span>Due <strong>{srs.data.stats.due}</strong></span>
              <span>New <strong>{srs.data.stats.new}</strong></span>
              <span>Learning <strong>{srs.data.stats.learning}</strong></span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
