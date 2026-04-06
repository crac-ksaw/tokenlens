import { create } from "zustand";
import { setApiToken } from "./api";

interface AuthState {
  token: string | null;
  workspaceId: string | null;
  email: string | null;
  setAuth(payload: { token: string; workspaceId: string; email: string }): void;
  logout(): void;
}

const storedToken = localStorage.getItem("tokenlens.token");
const storedWorkspaceId = localStorage.getItem("tokenlens.workspaceId");
const storedEmail = localStorage.getItem("tokenlens.email");
if (storedToken) {
  setApiToken(storedToken);
}

export const useAuthStore = create<AuthState>((set) => ({
  token: storedToken,
  workspaceId: storedWorkspaceId,
  email: storedEmail,
  setAuth({ token, workspaceId, email }) {
    localStorage.setItem("tokenlens.token", token);
    localStorage.setItem("tokenlens.workspaceId", workspaceId);
    localStorage.setItem("tokenlens.email", email);
    setApiToken(token);
    set({ token, workspaceId, email });
  },
  logout() {
    localStorage.removeItem("tokenlens.token");
    localStorage.removeItem("tokenlens.workspaceId");
    localStorage.removeItem("tokenlens.email");
    setApiToken(null);
    set({ token: null, workspaceId: null, email: null });
  },
}));