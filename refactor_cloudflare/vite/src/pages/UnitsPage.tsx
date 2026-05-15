import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAsync } from "../lib/useAsync";

export function UnitsPage() {
  const courses = useAsync(() => api.courses(), []);
  const units = useAsync(() => api.units(), []);

  return (
    <section className="page-stack">
      <div className="page-heading">
        <h1>Units</h1>
        <p>Course browsing and standalone unit library, backed by Workers API routes.</p>
      </div>
      <div className="grid two">
        <div className="panel">
          <h2>Courses</h2>
          {courses.loading && <p className="muted">Loading courses…</p>}
          {courses.error && <p className="error">{courses.error}</p>}
          <div className="card-list">
            {courses.data?.courses.map((course) => (
              <article className="item-card" key={course.id}>
                <h3>{course.title}</h3>
                <p>{course.sourceLanguage} → {course.targetLanguage} · {course.level}</p>
                <span>{course.unitCount} units · {course.lessonCount} lessons</span>
              </article>
            ))}
          </div>
        </div>
        <div className="panel">
          <h2>Standalone units</h2>
          {units.loading && <p className="muted">Loading units…</p>}
          {units.error && <p className="error">{units.error}</p>}
          <div className="card-list">
            {units.data?.units.map((unit) => (
              <article className="item-card" key={unit.id}>
                <h3>{unit.icon ?? "📘"} {unit.title}</h3>
                <p>{unit.description || "Practice lessons generated from markdown content."}</p>
                <span>{unit.lessonCount ?? 0} lessons {unit.visibility === "public" ? "· public" : ""}</span>
              </article>
            ))}
          </div>
        </div>
      </div>
      <p className="muted">Deep links such as <Link to="/chat">Chat</Link>, lesson runner and unit editor should be incrementally migrated onto this route shell.</p>
    </section>
  );
}
