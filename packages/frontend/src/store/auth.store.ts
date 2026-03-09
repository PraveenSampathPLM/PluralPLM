import { create } from "zustand";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem("plm_token"),
  user: null,
  setAuth: (token, user) => {
    localStorage.setItem("plm_token", token);
    set({ token, user });
  },
  clearAuth: () => {
    localStorage.removeItem("plm_token");
    set({ token: null, user: null });
  }
}));
