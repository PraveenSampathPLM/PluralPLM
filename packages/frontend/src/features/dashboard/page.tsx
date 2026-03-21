import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useContainerStore } from "@/store/container.store";
import { StatusBadge } from "@/components/status-badge";

interface DashboardResponse {
  recent: {
    items: Array<{ id: string; itemCode: string; name: string; status: string }>;
    formulas: Array<{ id: string; formulaCode: string; version: number; name: string; status: string }>;
    boms: Array<{ id: string; bomCode: string; version: number; type: string }>;
  };
}

interface TaskRecord {
  instanceId: string;
  entityType: string;
  entityId: string;
  currentState: string;
  definitionName: string;
}

interface StatusCount {
  status: string;
  count: number;
}

interface ChangeRow {
  id: string;
  status: string;
  createdAt?: string;
}

interface ReleaseRow {
  id: string;
  status: string;
  createdAt?: string;
}

interface FormulaRow {
  id: string;
  status: string;
  createdAt?: string;
}

interface FgRow {
  id: string;
  status: string;
  createdAt?: string;
}

interface ArtworkRow {
  id: string;
  status: string;
  createdAt?: string;
}

interface ListResponse<T> {
  data: T[];
  total: number;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function toStatusCounts(rows: Array<{ status: string }>): StatusCount[] {
  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(row.status, (map.get(row.status) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);
}

function weeksBackLabels(weeks: number): Array<{ start: Date; label: string }> {
  const now = new Date();
  const current = new Date(now);
  const day = current.getDay();
  const diff = day === 0 ? 6 : day - 1;
  current.setDate(current.getDate() - diff);
  current.setHours(0, 0, 0, 0);
  const labels: Array<{ start: Date; label: string }> = [];
  for (let i = weeks - 1; i >= 0; i -= 1) {
    const start = new Date(current);
    start.setDate(current.getDate() - i * 7);
    labels.push({
      start,
      label: `${start.toLocaleString("en-US", { month: "short" })} ${start.getDate()}`
    });
  }
  return labels;
}

function bucketWeeklyTrend(changes: ChangeRow[], releases: ReleaseRow[], artworks: ArtworkRow[]) {
  const buckets = weeksBackLabels(8);
  return buckets.map((bucket, index) => {
    const end = index < buckets.length - 1 ? buckets[index + 1]?.start : new Date(bucket.start.getTime() + 7 * 24 * 60 * 60 * 1000);
    const inRange = (value?: string): boolean => {
      if (!value || !end) {
        return false;
      }
      const ts = new Date(value);
      return ts >= bucket.start && ts < end;
    };
    return {
      label: bucket.label,
      changes: changes.filter((row) => inRange(row.createdAt)).length,
      releases: releases.filter((row) => inRange(row.createdAt)).length,
      artworks: artworks.filter((row) => inRange(row.createdAt)).length
    };
  });
}

function PieChartCard({ title, rows }: { title: string; rows: StatusCount[] }): JSX.Element {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const palette = ["#C0392B", "#E67E22", "#1B4F72", "#27AE60", "#8E44AD", "#16A085", "#2C3E50", "#F39C12"];
  let cursor = 0;
  const stops = rows.map((row, index) => {
    const from = cursor;
    const slice = total > 0 ? (row.count / total) * 360 : 0;
    cursor += slice;
    return `${palette[index % palette.length]} ${from}deg ${cursor}deg`;
  });
  const background = total > 0 ? `conic-gradient(${stops.join(", ")})` : "conic-gradient(#E2E8F0 0deg 360deg)";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="font-heading text-base text-slate-900">{title}</h3>
      <div className="mt-3 grid gap-3 md:grid-cols-[160px_1fr]">
        <div className="flex items-center justify-center">
          <div className="relative h-36 w-36 rounded-full" style={{ background }}>
            <div className="absolute inset-[22%] flex items-center justify-center rounded-full bg-white text-center">
              <div>
                <p className="text-[10px] uppercase tracking-[0.15em] text-slate-400">Total</p>
                <p className="text-lg font-semibold text-slate-800">{total}</p>
              </div>
            </div>
          </div>
        </div>
        <div className="space-y-2">
          {rows.length === 0 ? <p className="text-xs text-slate-500">No data available.</p> : null}
          {rows.map((row, index) => {
            const pct = total > 0 ? Math.round((row.count / total) * 100) : 0;
            return (
              <div key={row.status} className="flex items-center justify-between rounded border border-slate-100 bg-slate-50 px-2 py-1">
                <span className="inline-flex items-center gap-2 text-xs text-slate-700">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: palette[index % palette.length] }} />
                  <StatusBadge status={row.status} />
                </span>
                <span className="text-xs text-slate-500">
                  {row.count} ({pct}%)
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function NpdProjectsWidget({ containerId }: { containerId: string }): JSX.Element {
  const STAGE_COLORS: Record<string, string> = {
    DISCOVERY: "bg-slate-100 text-slate-700",
    FEASIBILITY: "bg-blue-100 text-blue-700",
    DEVELOPMENT: "bg-amber-100 text-amber-700",
    VALIDATION: "bg-purple-100 text-purple-700",
    LAUNCH: "bg-green-100 text-green-700"
  };

  const projects = useQuery({
    queryKey: ["dashboard-npd", containerId],
    queryFn: async () => {
      const params = new URLSearchParams({ pageSize: "5" });
      if (containerId) params.set("containerId", containerId);
      return (await api.get<{ data: Array<{ id: string; projectCode: string; name: string; stage: string; status: string; targetLaunchDate?: string | undefined; gateReviews: Array<{ decision: string | null }> }> }>(`/npd/projects?${params.toString()}`)).data;
    }
  });

  // Stage counts
  const stageCounts: Record<string, number> = { DISCOVERY: 0, FEASIBILITY: 0, DEVELOPMENT: 0, VALIDATION: 0, LAUNCH: 0 };
  (projects.data?.data ?? []).filter((p) => p.status === "ACTIVE").forEach((p) => {
    stageCounts[p.stage] = (stageCounts[p.stage] ?? 0) + 1;
  });

  const activeProjects = (projects.data?.data ?? []).filter((p) => p.status === "ACTIVE").slice(0, 3);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">NPD Projects</h3>
        <Link to="/npd" className="text-xs text-primary hover:underline">View all →</Link>
      </div>

      {/* Stage breakdown */}
      <div className="mb-4 flex flex-wrap gap-2">
        {Object.entries(stageCounts).map(([stage, count]) => (
          <span key={stage} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${STAGE_COLORS[stage] ?? "bg-slate-100 text-slate-600"}`}>
            {stage.charAt(0) + stage.slice(1).toLowerCase()}
            <span className="font-bold">{count}</span>
          </span>
        ))}
      </div>

      {/* Active projects list */}
      {projects.isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      )}
      {!projects.isLoading && activeProjects.length === 0 && (
        <p className="py-4 text-center text-xs text-slate-400">No active NPD projects. Start your first one.</p>
      )}
      {!projects.isLoading && activeProjects.map((p) => (
        <Link
          key={p.id}
          to={`/npd/${p.id}`}
          className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm hover:bg-slate-50 mb-2"
        >
          <div>
            <span className="font-mono text-xs text-slate-500">{p.projectCode}</span>
            <p className="font-medium text-slate-800 text-xs truncate max-w-[200px]">{p.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STAGE_COLORS[p.stage] ?? "bg-slate-100 text-slate-600"}`}>
              {p.stage.charAt(0) + p.stage.slice(1).toLowerCase()}
            </span>
            {p.targetLaunchDate && (
              <span className="text-[10px] text-slate-400">{new Date(p.targetLaunchDate).toLocaleDateString()}</span>
            )}
          </div>
        </Link>
      ))}

      <div className="mt-3 border-t border-slate-100 pt-3">
        <Link
          to="/npd"
          className="block w-full rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-center text-xs font-medium text-primary hover:bg-primary/10"
        >
          + New NPD Project
        </Link>
      </div>
    </div>
  );
}

export function DashboardPage(): JSX.Element {
  const { selectedContainerId } = useContainerStore();

  const dashboard = useQuery({
    queryKey: ["dashboard-home", selectedContainerId],
    queryFn: async () =>
      (
        await api.get<DashboardResponse>("/dashboard", {
          params: { ...(selectedContainerId ? { containerId: selectedContainerId } : {}) }
        })
      ).data
  });

  const tasksQuery = useQuery({
    queryKey: ["workflow-tasks-home"],
    queryFn: async () => (await api.get<{ data: TaskRecord[] }>("/workflows/tasks")).data
  });

  const analyticsQuery = useQuery({
    queryKey: ["dashboard-analytics", selectedContainerId],
    queryFn: async () => {
      const params = selectedContainerId ? { containerId: selectedContainerId } : undefined;
      const [changes, releases, formulas, fg, artworks] = await Promise.all([
        api.get<ListResponse<ChangeRow>>("/changes", { params: { pageSize: 300, ...(params ?? {}) } }),
        api.get<ListResponse<ReleaseRow>>("/releases", { params: { pageSize: 300, ...(params ?? {}) } }),
        api.get<ListResponse<FormulaRow>>("/formulas", { params: { pageSize: 300, ...(params ?? {}) } }),
        api.get<ListResponse<FgRow>>("/fg", { params }),
        api.get<ListResponse<ArtworkRow>>("/artworks", { params: { pageSize: 300, ...(params ?? {}) } })
      ]);
      return {
        changes: changes.data.data ?? [],
        releases: releases.data.data ?? [],
        formulas: formulas.data.data ?? [],
        fg: fg.data.data ?? [],
        artworks: artworks.data.data ?? []
      };
    }
  });

  const model = useMemo(() => {
    const source = analyticsQuery.data;
    if (!source) {
      return null;
    }
    const trend = bucketWeeklyTrend(source.changes, source.releases, source.artworks);
    const trendMax = Math.max(1, ...trend.flatMap((row) => [row.changes, row.releases, row.artworks]));
    return {
      changeStatus: toStatusCounts(source.changes),
      releaseStatus: toStatusCounts(source.releases),
      formulaStatus: toStatusCounts(source.formulas),
      artworkStatus: toStatusCounts(source.artworks),
      trend,
      trendMax,
      kpis: {
        openChanges: source.changes.filter((row) => !["IMPLEMENTED", "CLOSED", "REJECTED"].includes(row.status)).length,
        activeReleases: source.releases.filter((row) => !["RELEASED", "REJECTED"].includes(row.status)).length,
        activeFormulas: source.formulas.filter((row) => row.status !== "RELEASED").length,
        draftStructures: source.fg.filter((row) => row.status === "IN_WORK").length,
        artworkReview: source.artworks.filter((row) => row.status === "REVIEW").length
      }
    };
  }, [analyticsQuery.data]);

  const tasks = tasksQuery.data?.data ?? [];
  const recent = {
    items: asArray<DashboardResponse["recent"]["items"][number]>(dashboard.data?.recent?.items),
    formulas: asArray<DashboardResponse["recent"]["formulas"][number]>(dashboard.data?.recent?.formulas),
    boms: asArray<DashboardResponse["recent"]["boms"][number]>(dashboard.data?.recent?.boms)
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Home</p>
          <h2 className="font-heading text-2xl text-slate-900">Process PLM Control Tower</h2>
          <p className="text-sm text-slate-500">Analytics, workflow, and object access in one view.</p>
        </div>
        <Link to="/reports" className="rounded border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 hover:bg-slate-50">
          Open Report Catalog
        </Link>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs text-slate-500">Open Changes</p>
          <p className="text-2xl font-semibold text-rose-700">{model?.kpis.openChanges ?? 0}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs text-slate-500">Active Releases</p>
          <p className="text-2xl font-semibold text-amber-700">{model?.kpis.activeReleases ?? 0}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs text-slate-500">Active Formulas</p>
          <p className="text-2xl font-semibold text-primary">{model?.kpis.activeFormulas ?? 0}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs text-slate-500">Draft FG Structures</p>
          <p className="text-2xl font-semibold text-slate-700">{model?.kpis.draftStructures ?? 0}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs text-slate-500">Artwork In Review</p>
          <p className="text-2xl font-semibold text-indigo-700">{model?.kpis.artworkReview ?? 0}</p>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <PieChartCard title="Change Requests by Status" rows={model?.changeStatus ?? []} />
        <PieChartCard title="Formula Lifecycle" rows={model?.formulaStatus ?? []} />
        <PieChartCard title="Release Requests by Status" rows={model?.releaseStatus ?? []} />
        <PieChartCard title="Artwork Workflow by Status" rows={model?.artworkStatus ?? []} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="font-heading text-base text-slate-900">Change/Release/Artwork Trend (Last 8 Weeks)</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-8">
          {(model?.trend ?? []).map((row) => (
            <div key={row.label} className="rounded-lg border border-slate-100 bg-slate-50 p-2">
              <div className="flex h-28 items-end gap-1">
                <div className="w-2 rounded bg-rose-500" style={{ height: `${(row.changes / (model?.trendMax ?? 1)) * 100}%` }} />
                <div className="w-2 rounded bg-amber-500" style={{ height: `${(row.releases / (model?.trendMax ?? 1)) * 100}%` }} />
                <div className="w-2 rounded bg-indigo-500" style={{ height: `${(row.artworks / (model?.trendMax ?? 1)) * 100}%` }} />
              </div>
              <p className="mt-2 text-[11px] text-slate-600">{row.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-1">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-heading text-lg">My Tasks</h3>
            <Link to="/tasks" className="text-xs text-primary hover:underline">
              View all
            </Link>
          </div>
          <div className="space-y-2">
            {tasks.length === 0 ? <p className="text-sm text-slate-500">No tasks assigned.</p> : null}
            {tasks.slice(0, 6).map((task) => (
              <div key={task.instanceId} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-xs text-slate-500">{task.definitionName}</p>
                <p className="text-sm font-medium text-slate-800">
                  {task.entityType} · {task.currentState}
                </p>
                <Link
                  to={
                    task.entityType === "CHANGE_REQUEST"
                      ? `/changes/${task.entityId}`
                      : task.entityType === "RELEASE_REQUEST"
                        ? `/releases/${task.entityId}`
                        : task.entityType === "FORMULA"
                          ? `/formulas/${task.entityId}`
                          : task.entityType === "ITEM"
                            ? `/items/${task.entityId}`
                            : task.entityType === "FG_STRUCTURE"
                              ? `/fg/${task.entityId}`
                              : "/tasks"
                  }
                  className="text-xs text-primary hover:underline"
                >
                  Open
                </Link>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-heading text-lg">Recently Accessed Items</h3>
            <Link to="/items" className="text-xs text-primary hover:underline">
              View all
            </Link>
          </div>
          <div className="space-y-2">
            {recent.items.length === 0 ? <p className="text-sm text-slate-500">No items found.</p> : null}
            {recent.items.map((item) => (
              <Link key={item.id} to={`/items/${item.id}`} className="block rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 hover:bg-slate-100">
                <p className="font-mono text-xs text-slate-500">{item.itemCode}</p>
                <p className="text-sm font-medium text-slate-800">{item.name}</p>
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-heading text-lg">Recently Accessed Formulas</h3>
            <Link to="/formulas" className="text-xs text-primary hover:underline">
              View all
            </Link>
          </div>
          <div className="space-y-2">
            {recent.formulas.length === 0 ? <p className="text-sm text-slate-500">No formulas found.</p> : null}
            {recent.formulas.map((formula) => (
              <Link key={formula.id} to={`/formulas/${formula.id}`} className="block rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 hover:bg-slate-100">
                <p className="font-mono text-xs text-slate-500">
                  {formula.formulaCode} v{formula.version}
                </p>
                <p className="text-sm font-medium text-slate-800">{formula.name}</p>
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-heading text-lg">Recently Accessed FG Structures</h3>
            <Link to="/fg" className="text-xs text-primary hover:underline">
              View all
            </Link>
          </div>
          <div className="space-y-2">
            {recent.boms.length === 0 ? <p className="text-sm text-slate-500">No structures found.</p> : null}
            {recent.boms.map((fg) => (
              <Link key={fg.id} to={`/fg/${fg.id}`} className="block rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 hover:bg-slate-100">
                <p className="font-mono text-xs text-slate-500">
                  {fg.bomCode} v{fg.version}
                </p>
                <p className="text-sm font-medium text-slate-800">{fg.type}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <NpdProjectsWidget containerId={selectedContainerId} />

      {analyticsQuery.isLoading || dashboard.isLoading ? <p className="text-sm text-slate-500">Loading dashboard...</p> : null}
    </div>
  );
}
