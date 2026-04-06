import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuthStore } from "../lib/store";

export function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [email, setEmail] = useState("owner@acme.ai");
  const [password, setPassword] = useState("supersecret");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await api.post("/auth/login", { email, password });
      setAuth({ token: response.data.token, workspaceId: response.data.user.workspaceId ?? "workspace", email: response.data.user.email });
      navigate("/");
    } catch (err) {
      setError("Unable to sign in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <form className="w-full max-w-md rounded-[2rem] border border-white/60 bg-white/80 p-8 shadow-panel backdrop-blur" onSubmit={submit}>
        <div className="font-mono text-xs uppercase tracking-[0.35em] text-ember">Welcome back</div>
        <h1 className="mt-3 font-display text-4xl text-ink">See where every token goes.</h1>
        <p className="mt-3 text-sm text-slate-600">Log in to view spend by feature, user, and model.</p>
        <div className="mt-8 space-y-4">
          <input className="w-full rounded-2xl border border-slate-200 px-4 py-3" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} />
          <input className="w-full rounded-2xl border border-slate-200 px-4 py-3" placeholder="Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </div>
        {error && <div className="mt-4 text-sm text-red-600">{error}</div>}
        <button className="mt-6 w-full rounded-full bg-ocean px-5 py-3 font-medium text-white transition hover:bg-ink disabled:opacity-60" disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
        </button>
        <div className="mt-4 text-sm text-slate-600">
          Need a workspace? <Link className="text-ocean" to="/register">Create one</Link>
        </div>
      </form>
    </div>
  );
}