import { NavLink, Outlet } from "react-router-dom";
import { useAuthStore } from "../lib/store";

const links = [
  ["/", "Overview"],
  ["/anomalies", "Anomalies"],
  ["/budgets", "Budgets"],
  ["/recommendations", "Optimizer"],
] as const;

export function AppShell() {
  const { email, logout } = useAuthStore();

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-7xl gap-6 rounded-[2rem] border border-white/60 bg-white/40 p-4 shadow-panel backdrop-blur md:grid-cols-[260px_1fr] md:p-6">
        <aside className="card-grid rounded-[1.75rem] bg-ocean px-5 py-6 text-white">
          <div className="mb-10">
            <div className="font-mono text-xs uppercase tracking-[0.35em] text-slate-300">TokenLens</div>
            <h1 className="mt-3 font-display text-3xl leading-tight">Cost intelligence for every LLM feature.</h1>
            <p className="mt-3 text-sm text-slate-200">Trace spend, spot anomalies, and ship routing decisions with evidence.</p>
          </div>

          <nav className="space-y-2">
            {links.map(([to, label]) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) => `block rounded-2xl px-4 py-3 text-sm transition ${isActive ? "bg-white text-ocean" : "bg-white/5 text-white hover:bg-white/10"}`}
              >
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
            <div className="font-mono text-xs uppercase tracking-[0.3em] text-slate-300">Session</div>
            <div className="mt-2 font-medium text-white">{email}</div>
            <button
              className="mt-4 rounded-full border border-white/30 px-4 py-2 text-xs uppercase tracking-[0.25em] text-white transition hover:bg-white hover:text-ocean"
              onClick={logout}
            >
              Log out
            </button>
          </div>
        </aside>

        <main className="rounded-[1.75rem] bg-white/70 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}