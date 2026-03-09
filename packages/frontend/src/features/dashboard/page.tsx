import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Link } from "react-router-dom";
import { useContainerStore } from "@/store/container.store";

interface DashboardResponse {
  kpis: {
    activeFormulas: number;
    pendingChanges: number;
    itemsUnderReview: number;
    upcomingExpiries: number;
  };
  recent: {
    items: Array<{
      id: string;
      itemCode: string;
      name: string;
      status: string;
      createdAt: string;
    }>;
    formulas: Array<{
      id: string;
      formulaCode: string;
      version: number;
      name: string;
      status: string;
      createdAt: string;
    }>;
    boms: Array<{
      id: string;
      bomCode: string;
      version: number;
      type: string;
      createdAt: string;
    }>;
  };
  changeDashboard: {
    byStatus: Array<{ status: string; count: number }>;
    monthlyTrend: Array<{ month: string; created: number; implemented: number }>;
  };
  recentActivity: {
    items: Array<{ day: string; count: number }>;
    formulas: Array<{ day: string; count: number }>;
    boms: Array<{ day: string; count: number }>;
  };
}

interface TaskRecord {
  instanceId: string;
  entityType: string;
  entityId: string;
  currentState: string;
  definitionName: string;
}

function toTitle(input: string): string {
  return input
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (character) => character.toUpperCase())
    .trim();
}

function statusColor(status: string): string {
  if (status === "IMPLEMENTED" || status === "APPROVED" || status === "RELEASED") {
    return "bg-green-100 text-green-700";
  }
  if (status === "UNDER_REVIEW" || status === "IN_REVIEW" || status === "SUBMITTED") {
    return "bg-amber-100 text-amber-700";
  }
  return "bg-slate-100 text-slate-700";
}

export function DashboardPage(): JSX.Element {
  const { selectedContainerId } = useContainerStore();
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", selectedContainerId],
    queryFn: async () =>
      (
        await api.get<DashboardResponse>("/dashboard", {
          params: { ...(selectedContainerId ? { containerId: selectedContainerId } : {}) }
        })
      ).data
  });
  const tasksQuery = useQuery({
    queryKey: ["workflow-tasks"],
    queryFn: async () => (await api.get<{ data: TaskRecord[] }>("/workflows/tasks")).data
  });

  if (isLoading) {
    return <div className="rounded-lg bg-white p-6">Loading dashboard...</div>;
  }

  const kpis = data?.kpis ?? {
    activeFormulas: 0,
    pendingChanges: 0,
    itemsUnderReview: 0,
    upcomingExpiries: 0
  };
  const recent = data?.recent ?? { items: [], formulas: [], boms: [] };
  const change = data?.changeDashboard ?? { byStatus: [], monthlyTrend: [] };
  const activity = data?.recentActivity ?? { items: [], formulas: [], boms: [] };
  const tasks = tasksQuery.data?.data ?? [];
  const maxStatus = Math.max(...change.byStatus.map((entry) => entry.count), 1);
  const maxTrend = Math.max(...change.monthlyTrend.flatMap((entry) => [entry.created, entry.implemented]), 1);
  const maxActivity = Math.max(
    ...[...activity.items, ...activity.formulas, ...activity.boms].map((entry) => entry.count),
    1
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Object.entries(kpis).map(([key, value]) => (
          <div key={key} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">{toTitle(key)}</p>
            <p className="mt-2 text-3xl font-semibold text-primary">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-1">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-heading text-lg">My Workflow Tasks</h3>
            <Link to="/tasks" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          <div className="space-y-2">
            {tasks.length === 0 ? <p className="text-sm text-slate-500">No tasks assigned.</p> : null}
            {tasks.slice(0, 5).map((task) => (
              <div key={task.instanceId} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-xs text-slate-500">{task.definitionName}</p>
                <p className="text-sm font-medium text-slate-800">{task.entityType} · {task.currentState}</p>
                <Link
                  to={
                    task.entityType === "CHANGE_REQUEST"
                      ? `/changes/${task.entityId}`
                      : task.entityType === "RELEASE_REQUEST"
                        ? `/releases/${task.entityId}`
                        : task.entityType === "FORMULA"
                          ? `/formulas/${task.entityId}`
                          : task.entityType === "BOM"
                            ? `/bom/${task.entityId}`
                            : task.entityType === "ITEM"
                              ? `/items/${task.entityId}`
                              : "#"
                  }
                  className="text-xs text-primary hover:underline"
                >
                  Open
                </Link>
              </div>
            ))}
          </div>
        </div>
        {[
          { title: "Item Activity (7 days)", data: activity.items },
          { title: "Formulation Activity (7 days)", data: activity.formulas },
          { title: "BOM Activity (7 days)", data: activity.boms }
        ].map((card) => (
          <div key={card.title} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-1">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-heading text-lg">{card.title}</h3>
              <span className="text-xs text-slate-500">Last 7 days</span>
            </div>
            <div className="grid grid-cols-7 items-end gap-2">
              {card.data.map((entry) => (
                <div key={entry.day} className="flex flex-col items-center gap-1 text-xs text-slate-500">
                  <div className="h-16 w-full rounded bg-slate-100">
                    <div
                      className="h-full w-full rounded bg-primary"
                      style={{ transform: `scaleY(${entry.count / maxActivity})`, transformOrigin: "bottom" }}
                    />
                  </div>
                  <span>{entry.day.slice(8)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 font-heading text-lg">Change Requests by Status</h3>
          <div className="space-y-3">
            {change.byStatus.length === 0 ? <p className="text-sm text-slate-500">No change requests found.</p> : null}
            {change.byStatus.map((entry) => (
              <div key={entry.status}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className={`rounded-full px-2 py-0.5 ${statusColor(entry.status)}`}>{entry.status}</span>
                  <span className="text-slate-500">{entry.count}</span>
                </div>
                <div className="h-2 rounded bg-slate-100">
                  <div className="h-2 rounded bg-primary" style={{ width: `${(entry.count / maxStatus) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 font-heading text-lg">Change Trend (Created vs Implemented)</h3>
          <div className="space-y-3">
            {change.monthlyTrend.map((entry) => (
              <div key={entry.month}>
                <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
                  <span>{entry.month}</span>
                  <span>
                    Created {entry.created} · Implemented {entry.implemented}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="h-2 rounded bg-slate-100">
                    <div className="h-2 rounded bg-accent" style={{ width: `${(entry.created / maxTrend) * 100}%` }} />
                  </div>
                  <div className="h-2 rounded bg-slate-100">
                    <div className="h-2 rounded bg-success" style={{ width: `${(entry.implemented / maxTrend) * 100}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-heading text-lg">Recently Created Items</h3>
            <Link to="/items" className="text-xs text-primary hover:underline">View all</Link>
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
            <h3 className="font-heading text-lg">Recently Created Formulas</h3>
            <Link to="/formulas" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          <div className="space-y-2">
            {recent.formulas.length === 0 ? <p className="text-sm text-slate-500">No formulas found.</p> : null}
            {recent.formulas.map((formula) => (
              <Link key={formula.id} to={`/formulas/${formula.id}`} className="block rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 hover:bg-slate-100">
                <p className="font-mono text-xs text-slate-500">{formula.formulaCode} v{formula.version}</p>
                <p className="text-sm font-medium text-slate-800">{formula.name}</p>
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-heading text-lg">Recently Created BOMs</h3>
            <Link to="/bom" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          <div className="space-y-2">
            {recent.boms.length === 0 ? <p className="text-sm text-slate-500">No BOMs found.</p> : null}
            {recent.boms.map((bom) => (
              <Link key={bom.id} to={`/bom/${bom.id}`} className="block rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 hover:bg-slate-100">
                <p className="font-mono text-xs text-slate-500">{bom.bomCode} v{bom.version}</p>
                <p className="text-sm font-medium text-slate-800">{bom.type}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
