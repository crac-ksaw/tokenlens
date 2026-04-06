import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuthStore } from "../lib/store";

export function RegisterPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [workspaceName, setWorkspaceName] = useState("Acme AI");
  const [workspaceSlug, setWorkspaceSlug] = useState("acme-ai");
  const [email, setEmail] = useState("owner@acme.ai");
  const [password, setPassword] = useState("supersecret");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const response = await api.post("/auth/register", { workspaceName, workspaceSlug, email, password });
    setAuth({ token: response.data.token, workspaceId: response.data.workspace.id, email: response.data.user.email });
    navigate("/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <form className="w-full max-w-lg rounded-[2rem] border border-white/60 bg-white/80 p-8 shadow-panel backdrop-blur" onSubmit={submit}>
        <div className="font-mono text-xs uppercase tracking-[0.35em] text-ember">Create workspace</div>
        <h1 className="mt-3 font-display text-4xl text-ink">Stand up TokenLens in minutes.</h1>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <input className="rounded-2xl border border-slate-200 px-4 py-3" placeholder="Workspace name" value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} />
          <input className="rounded-2xl border border-slate-200 px-4 py-3" placeholder="Workspace slug" value={workspaceSlug} onChange={(event) => setWorkspaceSlug(event.target.value)} />
          <input className="rounded-2xl border border-slate-200 px-4 py-3 md:col-span-2" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} />
          <input className="rounded-2xl border border-slate-200 px-4 py-3 md:col-span-2" placeholder="Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </div>
        <button className="mt-6 w-full rounded-full bg-ocean px-5 py-3 font-medium text-white transition hover:bg-ink">Create workspace</button>
        <div className="mt-4 text-sm text-slate-600">
          Already provisioned? <Link className="text-ocean" to="/login">Sign in</Link>
        </div>
      </form>
    </div>
  );
}