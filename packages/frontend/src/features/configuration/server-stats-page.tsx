import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface ServerStatsResponse {
  generatedAt: string;
  health: {
    api: "UP" | "DOWN";
    database: "UP" | "DOWN";
    uptimeSec: number;
    nodeVersion: string;
  };
  resources: {
    systemMemory: { usedMb: number; totalMb: number; percent: number };
    processMemory: { rssMb: number; heapUsedMb: number; heapTotalMb: number; heapPercent: number };
    cpu: { load1: number; cores: number; percent: number };
    runtime: { platform: string; arch: string; pid: number };
  };
  logins: {
    last24hSuccess: number;
    last24hFailed: number;
    last7dSuccess: number;
    uniqueUsers7d: number;
    loginByRole: Array<{ role: string; count: number }>;
    loginsByDay: Array<{ day: string; success: number; failed: number }>;
    recentSuccess: Array<{ at: string; userId: string; email: string; name: string; role: string }>;
  };
}

function Donut({
  value,
  label,
  color
}: {
  value: number;
  label: string;
  color: string;
}): JSX.Element {
  const safe = Math.max(0, Math.min(100, value));
  const bg = `conic-gradient(${color} 0deg ${safe * 3.6}deg, #E2E8F0 ${safe * 3.6}deg 360deg)`;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <div className="mt-2 flex items-center gap-3">
        <div className="relative h-20 w-20 rounded-full" style={{ background: bg }}>
          <div className="absolute inset-[24%] flex items-center justify-center rounded-full bg-white text-xs font-semibold text-slate-700">{safe.toFixed(1)}%</div>
        </div>
      </div>
    </div>
  );
}

export function ConfigurationServerStatsPage(): JSX.Element {
  const queryClient = useQueryClient();
  const [streamState, setStreamState] = useState<"connecting" | "live" | "reconnecting" | "offline">("connecting");

  const query = useQuery({
    queryKey: ["config-server-stats"],
    queryFn: async () => (await api.get<ServerStatsResponse>("/config/server-stats")).data,
    staleTime: Number.POSITIVE_INFINITY
  });

  useEffect(() => {
    const token = localStorage.getItem("plm_token");
    if (!token) {
      setStreamState("offline");
      return;
    }

    const baseUrl = String(api.defaults.baseURL ?? "http://localhost:4000/api").replace(/\/+$/, "");
    const streamUrl = `${baseUrl}/config/server-stats/stream?token=${encodeURIComponent(token)}`;
    const stream = new EventSource(streamUrl);

    stream.onopen = () => {
      setStreamState("live");
    };

    stream.addEventListener("stats", (event) => {
      try {
        const payload = JSON.parse(event.data) as ServerStatsResponse;
        queryClient.setQueryData(["config-server-stats"], payload);
      } catch {
        // Ignore malformed stream frames and wait for the next valid update.
      }
    });

    stream.onerror = () => {
      setStreamState("reconnecting");
    };

    return () => {
      stream.close();
      setStreamState("offline");
    };
  }, [queryClient]);

  const roleDonut = useMemo(() => {
    const rows = query.data?.logins.loginByRole ?? [];
    const total = rows.reduce((sum, row) => sum + row.count, 0);
    if (total === 0) {
      return { bg: "conic-gradient(#E2E8F0 0deg 360deg)", legend: [] as Array<{ role: string; count: number; pct: number; color: string }> };
    }
    const palette = ["#1B4F72", "#E67E22", "#27AE60", "#C0392B", "#8E44AD", "#16A085"];
    let cursor = 0;
    const stops: string[] = [];
    const legend = rows.map((row, index) => {
      const pct = (row.count / total) * 100;
      const slice = pct * 3.6;
      const color = palette[index % palette.length] ?? "#1B4F72";
      const from = cursor;
      cursor += slice;
      stops.push(`${color} ${from}deg ${cursor}deg`);
      return { role: row.role, count: row.count, pct, color };
    });
    return { bg: `conic-gradient(${stops.join(", ")})`, legend };
  }, [query.data?.logins.loginByRole]);

  if (query.isLoading) {
    return <div className="rounded-xl bg-white p-4">Loading server stats...</div>;
  }

  if (!query.data) {
    return <div className="rounded-xl bg-white p-4">Server stats are unavailable.</div>;
  }

  const stats = query.data;

  return (
    <div className="space-y-4 rounded-xl bg-white p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Configuration</p>
          <h2 className="font-heading text-xl">Server Stats Dashboard</h2>
          <p className="text-sm text-slate-500">Runtime resources, login telemetry, and system health.</p>
        </div>
        <p className="text-xs text-slate-500">Updated: {new Date(stats.generatedAt).toLocaleString()}</p>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <span
          className={`inline-block h-2.5 w-2.5 rounded-full ${
            streamState === "live"
              ? "bg-emerald-500"
              : streamState === "reconnecting"
              ? "bg-amber-500"
              : streamState === "connecting"
              ? "bg-blue-500"
              : "bg-slate-400"
          }`}
        />
        <span className="text-slate-500">
          Stream: {streamState === "live" ? "Live" : streamState === "reconnecting" ? "Reconnecting" : streamState === "connecting" ? "Connecting" : "Offline"}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs text-slate-500">API Health</p>
          <p className={`text-xl font-semibold ${stats.health.api === "UP" ? "text-emerald-700" : "text-danger"}`}>{stats.health.api}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs text-slate-500">DB Health</p>
          <p className={`text-xl font-semibold ${stats.health.database === "UP" ? "text-emerald-700" : "text-danger"}`}>{stats.health.database}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs text-slate-500">Uptime</p>
          <p className="text-xl font-semibold text-primary">{Math.floor(stats.health.uptimeSec / 3600)}h</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs text-slate-500">Node</p>
          <p className="text-xl font-semibold text-slate-700">{stats.health.nodeVersion}</p>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Donut value={stats.resources.systemMemory.percent} label={`System Memory (${stats.resources.systemMemory.usedMb}/${stats.resources.systemMemory.totalMb} MB)`} color="#1B4F72" />
        <Donut value={stats.resources.processMemory.heapPercent} label={`Process Heap (${stats.resources.processMemory.heapUsedMb}/${stats.resources.processMemory.heapTotalMb} MB)`} color="#E67E22" />
        <Donut value={stats.resources.cpu.percent} label={`CPU Load (1m ${stats.resources.cpu.load1} / ${stats.resources.cpu.cores} cores)`} color="#27AE60" />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <h3 className="font-heading text-base">User Login Information</h3>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            <div className="rounded border border-slate-200 bg-white p-2">
              <p className="text-xs text-slate-500">Success (24h)</p>
              <p className="text-lg font-semibold text-emerald-700">{stats.logins.last24hSuccess}</p>
            </div>
            <div className="rounded border border-slate-200 bg-white p-2">
              <p className="text-xs text-slate-500">Failed (24h)</p>
              <p className="text-lg font-semibold text-danger">{stats.logins.last24hFailed}</p>
            </div>
            <div className="rounded border border-slate-200 bg-white p-2">
              <p className="text-xs text-slate-500">Success (7d)</p>
              <p className="text-lg font-semibold text-primary">{stats.logins.last7dSuccess}</p>
            </div>
            <div className="rounded border border-slate-200 bg-white p-2">
              <p className="text-xs text-slate-500">Unique Users (7d)</p>
              <p className="text-lg font-semibold text-slate-700">{stats.logins.uniqueUsers7d}</p>
            </div>
          </div>
          <div className="mt-3">
            <p className="text-xs font-medium text-slate-600">Login Distribution by Role</p>
            <div className="mt-2 grid gap-3 md:grid-cols-[160px_1fr]">
              <div className="relative mx-auto h-36 w-36 rounded-full" style={{ background: roleDonut.bg }}>
                <div className="absolute inset-[24%] flex items-center justify-center rounded-full bg-white text-xs font-semibold text-slate-700">
                  {stats.logins.last7dSuccess}
                </div>
              </div>
              <div className="space-y-1">
                {roleDonut.legend.map((entry) => (
                  <div key={entry.role} className="flex items-center justify-between rounded border border-slate-200 bg-white px-2 py-1 text-xs">
                    <span className="inline-flex items-center gap-2">
                      <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: entry.color }} />
                      {entry.role}
                    </span>
                    <span className="text-slate-500">
                      {entry.count} ({entry.pct.toFixed(1)}%)
                    </span>
                  </div>
                ))}
                {roleDonut.legend.length === 0 ? <p className="text-xs text-slate-500">No login data.</p> : null}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <h3 className="font-heading text-base">Recent Successful Logins</h3>
          <div className="mt-2 overflow-hidden rounded border border-slate-200 bg-white">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-2 py-2">User</th>
                  <th className="px-2 py-2">Role</th>
                  <th className="px-2 py-2">When</th>
                </tr>
              </thead>
              <tbody>
                {stats.logins.recentSuccess.map((entry) => (
                  <tr key={`${entry.userId}-${entry.at}`} className="border-t border-slate-100">
                    <td className="px-2 py-2">
                      <p className="font-medium text-slate-700">{entry.name}</p>
                      <p className="text-slate-500">{entry.email}</p>
                    </td>
                    <td className="px-2 py-2">{entry.role}</td>
                    <td className="px-2 py-2">{new Date(entry.at).toLocaleString()}</td>
                  </tr>
                ))}
                {stats.logins.recentSuccess.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-2 py-3 text-slate-500">
                      No login events yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
