import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAsync } from "../lib/useAsync";

const navItems = [
  { href: "/chat", label: "Chat", icon: "💬" },
  { href: "/units", label: "Units", icon: "📚" },
  { href: "/read", label: "Read", icon: "📖" },
  { href: "/words", label: "Words", icon: "🔤" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

export function Shell() {
  const navigate = useNavigate();
  const { data } = useAsync(() => api.session(), []);

  async function signOut() {
    await api.signOut().catch(() => undefined);
    navigate("/");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <NavLink to="/units" className="brand">OpenLingo</NavLink>
        <nav className="nav-list">
          {navItems.map((item) => (
            <NavLink key={item.href} to={item.href} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
              <span>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="main-panel">
        <header className="topbar">
          <div>
            <strong>{data?.session?.user?.name || data?.session?.user?.email || "Guest learner"}</strong>
            <span className="muted"> Vite + Workers migration preview</span>
          </div>
          {data?.session ? (
            <button className="button ghost" onClick={signOut}>Sign out</button>
          ) : (
            <button className="button outline" onClick={() => navigate("/sign-in")}>Sign in</button>
          )}
        </header>
        <Outlet />
      </main>
      <nav className="mobile-nav">
        {navItems.map((item) => (
          <NavLink key={item.href} to={item.href} className={({ isActive }) => `mobile-nav-item ${isActive ? "active" : ""}`}>
            <span>{item.icon}</span>
            <small>{item.label}</small>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
