import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://127.0.0.1:4000/api"
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("plm_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      localStorage.removeItem("plm_token");
      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        window.location.assign("/login");
      }
    }

    const message =
      error?.response?.data?.message ??
      (Array.isArray(error?.response?.data?.issues) ? error.response.data.issues[0]?.message : undefined) ??
      error?.message ??
      "Request failed";
    return Promise.reject(new Error(message));
  }
);
