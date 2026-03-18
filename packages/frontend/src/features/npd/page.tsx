import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { useContainerStore } from "@/store/container.store";
import { FloatingInput } from "@/components/floating-field";
import { toast } from "sonner";

const STAGES = [
  { key: "DISCOVERY", label: "Discovery", color: "bg-slate-100 text-slate-700 border-slate-300" },
  { key: "FEASIBILITY", label: "Feasibility", color: "bg-blue-50 text-blue-700 border-blue-300" },
  { key: "DEVELOPMENT", label: "Development", color: "bg-amber-50 text-amber-700 border-amber-300" },
  { key: "VALIDATION", label: "Validation", color: "bg-purple-50 text-purple-700 border-purple-300" },
  { key: "LAUNCH", label: "Launch", color: "bg-green-50 text-green-700 border-green-300" }
] as const;

type Stage = typeof STAGES[number]["key"];

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-700",
  ON_HOLD: "bg-amber-100 text-amber-700",
  KILLED: "bg-red-100 text-red-700",
  COMPLETED: "bg-blue-100 text-blue-700"
};

interface NpdProject {
  id: string;
  projectCode: string;
  name: string;
  description?: string | undefined;
  stage: Stage;
  status: string;
  targetLaunchDate?: string | undefined;
  actualLaunchDate?: string | undefined;
  projectLead?: { id: string; name: string; email: string } | null | undefined;
  container?: { id: string; code: string; name: string } | null | undefined;
  fgItem?: { id: string; itemCode: string; name: string } | null | undefined;
  gateReviews: Array<{ id: string; gate: string; decision: string | null }>;
  createdAt: string;
  updatedAt: string;
}

interface ListResponse {
  data: NpdProject[];
  total: number;
  page: number;
  pageSize: number;
}

function StageBadge({ stage }: { stage: Stage }): JSX.Element {
  const found = STAGES.find((s) => s.key === stage);
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${found?.color ?? "bg-slate-100 text-slate-700 border-slate-200"}`}>
      {found?.label ?? stage}
    </span>
  );
}

function StatusChip({ status }: { status: string }): JSX.Element {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[status] ?? "bg-slate-100 text-slate-600"}`}>
      {status.replace("_", " ")}
    </span>
  );
}

function GateProgressBar({ gateReviews }: { gateReviews: Array<{ gate: string; decision: string | null }> }): JSX.Element {
  const passed = gateReviews.filter((g) => g.decision === "GO").length;
  return (
    <div className="flex items-center gap-1">
      {STAGES.map((s, idx) => {
        const review = gateReviews.find((g) => g.gate === s.key);
        const isDone = review?.decision === "GO";
        const isKilled = review?.decision === "KILL" || review?.decision === "HOLD";
        return (
          <div
            key={s.key}
            title={`Gate ${idx + 1}: ${s.label} — ${review?.decision ?? "Pending"}`}
            className={`h-1.5 flex-1 rounded-full ${isDone ? "bg-emerald-500" : isKilled ? "bg-red-400" : "bg-slate-200"}`}
          />
        );
      })}
      <span className="ml-1 text-xs text-slate-400">{passed}/5</span>
    </div>
  );
}

export function NpdPage(): JSX.Element {
  const { selectedContainerId } = useContainerStore();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const createPanelRef = useRef<HTMLDivElement | null>(null);

  const fromItemId = searchParams.get("fromItemId") ?? "";
  const fromItemCode = searchParams.get("fromItemCode") ?? "";
  const fromItemName = searchParams.get("fromItemName") ?? "";

  const [form, setForm] = useState({
    name: "",
    description: "",
    targetLaunchDate: "",
    projectLeadId: "",
    fgItemCode: fromItemCode
  });

  useEffect(() => {
    if (fromItemName) {
      setCreateOpen(true);
      setForm((prev) => ({ ...prev, name: prev.name || `NPD — ${fromItemName}`, fgItemCode: fromItemCode }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromItemName]);

  const projects = useQuery({
    queryKey: ["npd-projects", selectedContainerId, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedContainerId) params.set("containerId", selectedContainerId);
      if (search) params.set("search", search);
      params.set("pageSize", "200");
      return (await api.get<ListResponse>(`/npd/projects?${params.toString()}`)).data;
    }
  });

  const createMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) =>
      (await api.post<NpdProject>("/npd/projects", body)).data,
    onSuccess: () => {
      toast.success("NPD project created");
      void queryClient.invalidateQueries({ queryKey: ["npd-projects"] });
      setCreateOpen(false);
      setForm({ name: "", description: "", targetLaunchDate: "", projectLeadId: "", fgItemCode: "" });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to create project";
      toast.error(msg);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/npd/projects/${id}`),
    onSuccess: () => {
      toast.success("Project deleted");
      void queryClient.invalidateQueries({ queryKey: ["npd-projects"] });
    }
  });

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault();
    if (!form.name.trim()) return;
    const body: Record<string, unknown> = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      containerId: selectedContainerId || undefined,
      targetLaunchDate: form.targetLaunchDate || undefined,
      projectLeadId: form.projectLeadId || undefined
    };
    createMutation.mutate(body);
  }

  const allProjects = projects.data?.data ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">NPD Projects</h1>
          <p className="mt-1 text-sm text-slate-500">Stage Gate Management — Discovery through Launch</p>
        </div>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex overflow-hidden rounded-lg border border-slate-200 bg-white">
            {(["kanban", "list"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`px-3 py-1.5 text-xs font-medium transition ${view === v ? "bg-primary text-white" : "text-slate-600 hover:bg-slate-50"}`}
              >
                {v === "kanban" ? "⬛ Kanban" : "☰ List"}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary/90"
          >
            + New Project
          </button>
        </div>
      </div>

      {/* Search (list view only) */}
      {view === "list" && (
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-72 rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      )}

      {/* Loading */}
      {projects.isLoading && (
        <div className="flex h-40 items-center justify-center text-sm text-slate-400">Loading projects...</div>
      )}

      {/* Kanban */}
      {!projects.isLoading && view === "kanban" && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STAGES.map((stage) => {
            const cols = allProjects.filter((p) => p.stage === stage.key);
            return (
              <div key={stage.key} className="flex w-72 flex-none flex-col gap-3">
                <div className={`flex items-center justify-between rounded-lg border px-3 py-2 ${stage.color}`}>
                  <span className="text-sm font-semibold">{stage.label}</span>
                  <span className="rounded-full bg-white/60 px-2 py-0.5 text-xs font-bold">{cols.length}</span>
                </div>
                <div className="flex flex-col gap-2 min-h-[200px]">
                  {cols.map((project) => (
                    <Link
                      key={project.id}
                      to={`/npd/${project.id}`}
                      className="block rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-primary/40 hover:shadow-md"
                    >
                      <div className="flex items-center justify-between">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">{project.projectCode}</span>
                        <StatusChip status={project.status} />
                      </div>
                      <p className="mt-2 text-sm font-semibold text-slate-800 line-clamp-2">{project.name}</p>
                      {project.fgItem && (
                        <p className="mt-1 text-xs text-slate-500">
                          FG: <span className="font-medium">{project.fgItem.itemCode}</span> — {project.fgItem.name}
                        </p>
                      )}
                      {project.targetLaunchDate && (
                        <p className="mt-1 text-xs text-slate-400">
                          Target: {new Date(project.targetLaunchDate).toLocaleDateString()}
                        </p>
                      )}
                      <div className="mt-2">
                        <GateProgressBar gateReviews={project.gateReviews} />
                      </div>
                    </Link>
                  ))}
                  {cols.length === 0 && (
                    <div className="flex h-20 items-center justify-center rounded-lg border border-dashed border-slate-200 text-xs text-slate-400">
                      No projects
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List view */}
      {!projects.isLoading && view === "list" && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                {["Code", "Name", "Stage", "Status", "FG Item", "Lead", "Target Launch", "Gates", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {allProjects.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm text-slate-400">No NPD projects found. Create your first one.</td>
                </tr>
              )}
              {allProjects.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{p.projectCode}</td>
                  <td className="px-4 py-3">
                    <Link to={`/npd/${p.id}`} className="font-medium text-slate-900 hover:text-primary">{p.name}</Link>
                  </td>
                  <td className="px-4 py-3"><StageBadge stage={p.stage} /></td>
                  <td className="px-4 py-3"><StatusChip status={p.status} /></td>
                  <td className="px-4 py-3 text-xs text-slate-600">{p.fgItem ? `${p.fgItem.itemCode} — ${p.fgItem.name}` : "—"}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">{p.projectLead?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {p.targetLaunchDate ? new Date(p.targetLaunchDate).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <GateProgressBar gateReviews={p.gateReviews} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Link to={`/npd/${p.id}`} className="text-xs text-primary hover:underline">Open</Link>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Delete ${p.projectCode}?`)) deleteMutation.mutate(p.id);
                        }}
                        className="text-xs text-red-500 hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create panel */}
      {createOpen && (
        <div className="fixed inset-0 z-40 overflow-hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setCreateOpen(false)} />
          <div
            ref={createPanelRef}
            className="absolute right-0 top-0 flex h-full w-[480px] flex-col bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-base font-semibold text-slate-900">New NPD Project</h2>
              <button type="button" onClick={() => setCreateOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {/* Info banner */}
              <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Create an NPD project to manage your new product through the stage gate process — from Discovery through to commercial Launch.
              </div>
              <form id="npd-create-form" onSubmit={handleSubmit} className="space-y-4">
                <FloatingInput
                  label="Project Name *"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  required
                />
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    placeholder="Brief description of the new product concept..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Target Launch Date</label>
                  <input
                    type="date"
                    value={form.targetLaunchDate}
                    onChange={(e) => setForm((prev) => ({ ...prev, targetLaunchDate: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <FloatingInput
                  label="Project Lead (User ID)"
                  value={form.projectLeadId}
                  onChange={(e) => setForm((prev) => ({ ...prev, projectLeadId: e.target.value }))}
                />
                <p className="text-xs text-slate-400 -mt-2">Link an FG item and formula from the project detail page after creation.</p>
              </form>
            </div>
            <div className="border-t border-slate-200 p-6">
              <button
                type="submit"
                form="npd-create-form"
                disabled={!form.name.trim() || createMutation.isPending}
                className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
              >
                {createMutation.isPending ? "Creating..." : "Create NPD Project"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
