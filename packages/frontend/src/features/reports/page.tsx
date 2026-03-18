import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useContainerStore } from "@/store/container.store";
import { StatusBadge } from "@/components/status-badge";

// ─── Types ────────────────────────────────────────────────────────────────────

interface KpiData {
  totalItems: number;
  releasedItems: number;
  openChanges: number;
  openReleases: number;
  activeNpdProjects: number;
  overdueNpdProjects: number;
  formulasDraft: number;
  artworksPendingReview: number;
}

interface ChangeAgingRow {
  id: string;
  changeCode: string;
  title: string;
  priority: string;
  status: string;
  createdAt: string;
  daysOpen: number;
  affectedItemCount: number;
}

interface ReleaseReadinessRow {
  id: string;
  releaseCode: string;
  title: string;
  status: string;
  affectedObjectCount: number;
  itemsReleased: number;
  itemsPending: number;
  readinessPct: number;
}

interface NpdStatusRow {
  id: string;
  projectCode: string;
  name: string;
  stage: string;
  status: string;
  targetLaunchDate: string | null;
  daysUntilLaunch: number | null;
  gatesPassed: number;
  completedGates: Array<{ gate: string; decision: string | null }>;
  linkedFgItem: { code: string; name: string } | null;
}

interface FgMissingFormulaRow {
  id: string;
  fgCode: string;
  fgName: string;
  version: string;
  status: string;
  createdAt: string;
}

interface ItemsByStatusData {
  byStatus: Array<{ status: string; count: number }>;
  byItemType: Array<{ itemType: string; status: string; count: number }>;
}

// ─── Report list ──────────────────────────────────────────────────────────────

type ReportId =
  | "kpi-overview"
  | "change-aging"
  | "release-readiness"
  | "npd-status"
  | "fg-missing-formula"
  | "items-by-status";

interface ReportMeta {
  id: ReportId;
  label: string;
  icon: string;
  category: string;
  exportable: boolean;
}

const REPORTS: ReportMeta[] = [
  { id: "kpi-overview", label: "KPI Overview", icon: "📊", category: "Overview", exportable: false },
  { id: "change-aging", label: "Change Aging", icon: "🔄", category: "Change Management", exportable: true },
  { id: "release-readiness", label: "Release Readiness", icon: "🚀", category: "Release Management", exportable: true },
  { id: "npd-status", label: "NPD Status", icon: "🧪", category: "NPD", exportable: true },
  { id: "fg-missing-formula", label: "FG Missing Formula", icon: "⚠️", category: "Formulation", exportable: true },
  { id: "items-by-status", label: "Items by Status", icon: "📦", category: "Inventory", exportable: true },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysOpenColor(days: number): string {
  if (days < 7) return "text-emerald-700 font-semibold";
  if (days <= 30) return "text-amber-700 font-semibold";
  return "text-rose-700 font-semibold";
}

function daysOpenBg(days: number): string {
  if (days < 7) return "bg-emerald-100 text-emerald-700";
  if (days <= 30) return "bg-amber-100 text-amber-700";
  return "bg-rose-100 text-rose-700";
}

function stageBadgeClass(stage: string): string {
  const map: Record<string, string> = {
    DISCOVERY: "bg-violet-100 text-violet-700",
    FEASIBILITY: "bg-blue-100 text-blue-700",
    DEVELOPMENT: "bg-cyan-100 text-cyan-700",
    VALIDATION: "bg-amber-100 text-amber-700",
    LAUNCH: "bg-emerald-100 text-emerald-700",
  };
  return map[stage] ?? "bg-slate-100 text-slate-700";
}

function priorityBadgeClass(priority: string): string {
  const map: Record<string, string> = {
    CRITICAL: "bg-rose-100 text-rose-700 ring-1 ring-rose-200",
    HIGH: "bg-orange-100 text-orange-700 ring-1 ring-orange-200",
    MEDIUM: "bg-amber-100 text-amber-700 ring-1 ring-amber-200",
    LOW: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
  };
  return map[priority] ?? "bg-slate-100 text-slate-600";
}

function triggerCsvDownload(url: string, filename: string): void {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ─── Skeleton row ─────────────────────────────────────────────────────────────

function SkeletonRows({ cols, rows = 5 }: { cols: number; rows?: number }): JSX.Element {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="border-t border-slate-100 animate-pulse">
          {Array.from({ length: cols }).map((__, j) => (
            <td key={j} className="px-4 py-3">
              <div className="h-4 rounded bg-slate-200" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <span className="text-4xl">📭</span>
      <p className="mt-3 text-sm text-slate-500">{message}</p>
    </div>
  );
}

// ─── Record count badge ───────────────────────────────────────────────────────

function RecordCount({ count }: { count: number }): JSX.Element {
  return (
    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
      {count.toLocaleString()} {count === 1 ? "record" : "records"}
    </span>
  );
}

// ─── Export button ────────────────────────────────────────────────────────────

function ExportButton({
  reportType,
  containerId,
  extraParams,
}: {
  reportType: string;
  containerId: string;
  extraParams?: Record<string, string>;
}): JSX.Element {
  const handleExport = (): void => {
    const baseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";
    const params = new URLSearchParams();
    if (containerId) params.set("containerId", containerId);
    if (extraParams) {
      for (const [k, v] of Object.entries(extraParams)) {
        if (v) params.set(k, v);
      }
    }
    const token = localStorage.getItem("plm_token") ?? "";
    // Build URL; auth header can't be set on <a> download so we pass via query
    // The server uses the Authorization header — we fetch then trigger download
    const url = `${baseUrl}/reports/export/${reportType}?${params.toString()}`;
    fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.blob())
      .then((blob) => {
        const objUrl = URL.createObjectURL(blob);
        const today = new Date().toISOString().slice(0, 10);
        triggerCsvDownload(objUrl, `${reportType}-${today}.csv`);
        URL.revokeObjectURL(objUrl);
      })
      .catch(() => {
        // Fallback: direct link
        triggerCsvDownload(url, `${reportType}.csv`);
      });
  };

  return (
    <button
      type="button"
      onClick={handleExport}
      className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
    >
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 2v8m0 0-3-3m3 3 3-3M2 12v2h12v-2" />
      </svg>
      Export CSV
    </button>
  );
}

// ─── KPI Overview ─────────────────────────────────────────────────────────────

interface KpiCardConfig {
  key: keyof KpiData;
  label: string;
  icon: string;
  threshold: (v: number) => "green" | "amber" | "red";
  description: string;
}

const KPI_CARDS: KpiCardConfig[] = [
  {
    key: "totalItems",
    label: "Total Items",
    icon: "📦",
    threshold: () => "green",
    description: "All items in the system",
  },
  {
    key: "releasedItems",
    label: "Released Items",
    icon: "✅",
    threshold: () => "green",
    description: "Items in RELEASED status",
  },
  {
    key: "openChanges",
    label: "Open Changes",
    icon: "🔄",
    threshold: (v) => (v === 0 ? "green" : v < 10 ? "amber" : "red"),
    description: "Change requests not yet implemented",
  },
  {
    key: "openReleases",
    label: "Open Releases",
    icon: "🚀",
    threshold: (v) => (v === 0 ? "green" : v < 5 ? "amber" : "red"),
    description: "Release requests not yet completed",
  },
  {
    key: "activeNpdProjects",
    label: "Active NPD Projects",
    icon: "🧪",
    threshold: () => "green",
    description: "NPD projects currently in ACTIVE status",
  },
  {
    key: "overdueNpdProjects",
    label: "Overdue NPD Projects",
    icon: "⚠️",
    threshold: (v) => (v === 0 ? "green" : v < 3 ? "amber" : "red"),
    description: "Active projects past target launch date",
  },
  {
    key: "formulasDraft",
    label: "Formulas In Work",
    icon: "🧬",
    threshold: (v) => (v === 0 ? "green" : v < 5 ? "amber" : "red"),
    description: "Formulas currently in IN_WORK status",
  },
  {
    key: "artworksPendingReview",
    label: "Artworks Pending Review",
    icon: "🎨",
    threshold: (v) => (v === 0 ? "green" : v < 5 ? "amber" : "red"),
    description: "Artworks awaiting review/approval",
  },
];

const kpiColorMap = {
  green: "border-l-emerald-500 bg-emerald-50",
  amber: "border-l-amber-500 bg-amber-50",
  red: "border-l-rose-500 bg-rose-50",
};

const kpiValueColorMap = {
  green: "text-emerald-700",
  amber: "text-amber-700",
  red: "text-rose-700",
};

function KpiOverview({ containerId }: { containerId: string }): JSX.Element {
  const query = useQuery<KpiData>({
    queryKey: ["report-kpis", containerId],
    queryFn: async () => {
      const params = containerId ? { containerId } : {};
      const r = await api.get<KpiData>("/reports/kpis", { params });
      return r.data;
    },
  });

  if (query.isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-xl border border-slate-200 bg-slate-100 p-5 h-28" />
        ))}
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        Failed to load KPI data.
      </div>
    );
  }

  const data = query.data;

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {KPI_CARDS.map((card) => {
        const value = data[card.key];
        const tone = card.threshold(value);
        return (
          <div
            key={card.key}
            className={`rounded-xl border border-l-4 border-slate-200 p-5 shadow-sm ${kpiColorMap[tone]}`}
            title={card.description}
          >
            <div className="flex items-center justify-between">
              <span className="text-xl">{card.icon}</span>
              <span className={`text-3xl font-bold tabular-nums ${kpiValueColorMap[tone]}`}>
                {value.toLocaleString()}
              </span>
            </div>
            <p className="mt-3 text-xs font-medium text-slate-600">{card.label}</p>
            <p className="mt-0.5 text-xs text-slate-400">{card.description}</p>
          </div>
        );
      })}
    </div>
  );
}

// ─── Change Aging ─────────────────────────────────────────────────────────────

function ChangeAgingReport({
  containerId,
}: {
  containerId: string;
}): JSX.Element {
  const [priority, setPriority] = useState("");
  const [status, setStatus] = useState("");

  const query = useQuery<ChangeAgingRow[]>({
    queryKey: ["report-change-aging", containerId, priority, status],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (containerId) params.containerId = containerId;
      if (priority) params.priority = priority;
      if (status) params.status = status;
      const r = await api.get<ChangeAgingRow[]>("/reports/change-aging", { params });
      return r.data;
    },
  });

  const rows = query.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm"
        >
          <option value="">All Priorities</option>
          {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm"
        >
          <option value="">All Statuses</option>
          {["NEW", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED", "IMPLEMENTED"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <div className="ml-auto flex items-center gap-3">
          {!query.isLoading && <RecordCount count={rows.length} />}
          <ExportButton
            reportType="change-aging"
            containerId={containerId}
            extraParams={{ priority, status }}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Days Open</th>
              <th className="px-4 py-3 text-right">Items Affected</th>
            </tr>
          </thead>
          <tbody>
            {query.isLoading ? (
              <SkeletonRows cols={6} />
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <EmptyState message="No change requests match the current filters." />
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs font-medium text-slate-800">
                    {row.changeCode}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{row.title}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${priorityBadgeClass(row.priority)}`}>
                      {row.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${daysOpenBg(row.daysOpen)}`}>
                      {row.daysOpen}d
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700">
                    {row.affectedItemCount}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!query.isLoading && rows.length > 0 && (
        <div className="flex gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /> &lt;7 days
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> 7–30 days
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400" /> &gt;30 days
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Release Readiness ────────────────────────────────────────────────────────

function ReleaseReadinessReport({ containerId }: { containerId: string }): JSX.Element {
  const query = useQuery<ReleaseReadinessRow[]>({
    queryKey: ["report-release-readiness", containerId],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (containerId) params.containerId = containerId;
      const r = await api.get<ReleaseReadinessRow[]>("/reports/release-readiness", { params });
      return r.data;
    },
  });

  const rows = query.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-3">
        {!query.isLoading && <RecordCount count={rows.length} />}
        <ExportButton reportType="release-readiness" containerId={containerId} />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 w-48">Readiness</th>
              <th className="px-4 py-3 text-right">Pending</th>
            </tr>
          </thead>
          <tbody>
            {query.isLoading ? (
              <SkeletonRows cols={5} />
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <EmptyState message="No release requests found." />
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs font-medium text-slate-800">
                    {row.releaseCode}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{row.title}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className={`h-full rounded-full transition-all ${
                            row.readinessPct >= 80
                              ? "bg-emerald-500"
                              : row.readinessPct >= 50
                              ? "bg-amber-500"
                              : "bg-rose-500"
                          }`}
                          style={{ width: `${row.readinessPct}%` }}
                        />
                      </div>
                      <span className="w-10 text-right text-xs font-medium text-slate-600">
                        {row.readinessPct}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`text-xs font-medium ${row.itemsPending > 0 ? "text-rose-700" : "text-emerald-700"}`}>
                      {row.itemsPending}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── NPD Status ───────────────────────────────────────────────────────────────

function NpdStatusReport({ containerId }: { containerId: string }): JSX.Element {
  const query = useQuery<NpdStatusRow[]>({
    queryKey: ["report-npd-status", containerId],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (containerId) params.containerId = containerId;
      const r = await api.get<NpdStatusRow[]>("/reports/npd-status", { params });
      return r.data;
    },
  });

  const rows = query.data ?? [];
  const MAX_GATES = 5;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-3">
        {!query.isLoading && <RecordCount count={rows.length} />}
        <ExportButton reportType="npd-status" containerId={containerId} />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Stage</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Target Launch</th>
              <th className="px-4 py-3 text-right">Days Until Launch</th>
              <th className="px-4 py-3">Gates Passed</th>
            </tr>
          </thead>
          <tbody>
            {query.isLoading ? (
              <SkeletonRows cols={7} />
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <EmptyState message="No NPD projects found." />
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const isOverdue =
                  row.daysUntilLaunch !== null && row.daysUntilLaunch < 0;
                const daysLabel =
                  row.daysUntilLaunch === null
                    ? "—"
                    : row.daysUntilLaunch < 0
                    ? `${Math.abs(row.daysUntilLaunch)}d overdue`
                    : `${row.daysUntilLaunch}d`;

                return (
                  <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-medium text-slate-800">
                      {row.projectCode}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <div>{row.name}</div>
                      {row.linkedFgItem && (
                        <div className="mt-0.5 text-xs text-slate-400">
                          FG: {row.linkedFgItem.code} – {row.linkedFgItem.name}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${stageBadgeClass(row.stage)}`}>
                        {row.stage}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {row.targetLaunchDate
                        ? new Date(row.targetLaunchDate).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`text-xs font-medium ${
                          isOverdue
                            ? "text-rose-700"
                            : row.daysUntilLaunch !== null && row.daysUntilLaunch <= 30
                            ? "text-amber-700"
                            : "text-slate-600"
                        }`}
                      >
                        {daysLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-0.5">
                          {Array.from({ length: MAX_GATES }).map((_, i) => (
                            <span
                              key={i}
                              className={`h-2.5 w-2.5 rounded-full ${
                                i < row.gatesPassed ? "bg-emerald-500" : "bg-slate-200"
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-xs text-slate-500">
                          {row.gatesPassed}/{MAX_GATES}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── FG Missing Formula ───────────────────────────────────────────────────────

function FgMissingFormulaReport({ containerId }: { containerId: string }): JSX.Element {
  const query = useQuery<FgMissingFormulaRow[]>({
    queryKey: ["report-fg-missing-formula", containerId],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (containerId) params.containerId = containerId;
      const r = await api.get<FgMissingFormulaRow[]>("/reports/fg-missing-formula", { params });
      return r.data;
    },
  });

  const rows = query.data ?? [];

  return (
    <div className="space-y-4">
      {!query.isLoading && rows.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="text-lg">⚠️</span>
          <span>
            <strong>{rows.length}</strong> finished goods have no linked FG structure. Action is
            required to associate a formula.
          </span>
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        {!query.isLoading && <RecordCount count={rows.length} />}
        <ExportButton reportType="fg-missing-formula" containerId={containerId} />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">FG Code</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Version</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Created</th>
            </tr>
          </thead>
          <tbody>
            {query.isLoading ? (
              <SkeletonRows cols={5} />
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <EmptyState message="All finished goods have linked FG structures." />
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs font-medium text-slate-800">
                    {row.fgCode}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{row.fgName}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">{row.version}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-slate-500">
                    {new Date(row.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Items by Status ──────────────────────────────────────────────────────────

function ItemsByStatusReport({ containerId }: { containerId: string }): JSX.Element {
  const query = useQuery<ItemsByStatusData>({
    queryKey: ["report-items-by-status", containerId],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (containerId) params.containerId = containerId;
      const r = await api.get<ItemsByStatusData>("/reports/items-by-status", { params });
      return r.data;
    },
  });

  const data = query.data;
  const byStatus = data?.byStatus ?? [];
  const byItemType = data?.byItemType ?? [];

  const maxCount = Math.max(1, ...byStatus.map((r) => r.count));

  const statusBarColor: Record<string, string> = {
    IN_WORK: "bg-slate-400",
    UNDER_REVIEW: "bg-amber-400",
    RELEASED: "bg-emerald-500",
    OBSOLETE: "bg-red-400",
  };

  // Group byItemType for the breakdown table
  const itemTypes = Array.from(new Set(byItemType.map((r) => r.itemType)));
  const statuses = Array.from(new Set(byItemType.map((r) => r.status)));

  const typeLookup = (type: string, status: string): number => {
    return byItemType.find((r) => r.itemType === type && r.status === status)?.count ?? 0;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <ExportButton reportType="items-by-status" containerId={containerId} />
      </div>

      {/* Visual bar chart */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-slate-700">Items by Lifecycle Status</h3>
        {query.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="animate-pulse h-8 rounded bg-slate-200" />
            ))}
          </div>
        ) : byStatus.length === 0 ? (
          <EmptyState message="No items found." />
        ) : (
          <div className="space-y-3">
            {byStatus.map((row) => (
              <div key={row.status} className="flex items-center gap-3">
                <span className="w-28 flex-shrink-0 text-xs font-medium text-slate-600">
                  {row.status}
                </span>
                <div className="flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-6 rounded-full transition-all ${statusBarColor[row.status] ?? "bg-blue-400"}`}
                    style={{ width: `${Math.max(2, (row.count / maxCount) * 100)}%` }}
                  />
                </div>
                <span className="w-12 text-right text-xs font-bold tabular-nums text-slate-700">
                  {row.count.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Breakdown by item type */}
      {!query.isLoading && itemTypes.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Breakdown by Item Type
            </h3>
          </div>
          <div className="overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Item Type</th>
                  {statuses.map((s) => (
                    <th key={s} className="px-4 py-3 text-right">
                      {s}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {itemTypes.map((type) => (
                  <tr key={type} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-700">{type}</td>
                    {statuses.map((s) => (
                      <td key={s} className="px-4 py-3 text-right text-slate-600">
                        {typeLookup(type, s).toLocaleString()}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function ReportsPage(): JSX.Element {
  const { selectedContainerId } = useContainerStore();
  const [activeReport, setActiveReport] = useState<ReportId>("kpi-overview");

  const current = REPORTS.find((r) => r.id === activeReport)!;

  const renderReport = (): JSX.Element => {
    switch (activeReport) {
      case "kpi-overview":
        return <KpiOverview containerId={selectedContainerId} />;
      case "change-aging":
        return <ChangeAgingReport containerId={selectedContainerId} />;
      case "release-readiness":
        return <ReleaseReadinessReport containerId={selectedContainerId} />;
      case "npd-status":
        return <NpdStatusReport containerId={selectedContainerId} />;
      case "fg-missing-formula":
        return <FgMissingFormulaReport containerId={selectedContainerId} />;
      case "items-by-status":
        return <ItemsByStatusReport containerId={selectedContainerId} />;
    }
  };

  return (
    <div className="flex h-full min-h-0 rounded-xl bg-white">
      {/* Sidebar */}
      <aside className="w-52 flex-shrink-0 border-r border-slate-200 bg-slate-50 py-4">
        <div className="px-4 pb-3">
          <p className="text-xs uppercase tracking-[0.15em] text-slate-400">Reports</p>
        </div>

        {/* Group by category */}
        {(["Overview", "Change Management", "Release Management", "NPD", "Formulation", "Inventory"] as const).map(
          (cat) => {
            const catReports = REPORTS.filter((r) => r.category === cat);
            if (catReports.length === 0) return null;
            return (
              <div key={cat} className="mb-2">
                <p className="px-4 py-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                  {cat}
                </p>
                {catReports.map((report) => (
                  <button
                    key={report.id}
                    type="button"
                    onClick={() => setActiveReport(report.id)}
                    className={`flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm transition-colors ${
                      activeReport === report.id
                        ? "bg-blue-50 font-semibold text-blue-700 border-r-2 border-blue-500"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <span className="text-base">{report.icon}</span>
                    <span className="leading-snug">{report.label}</span>
                  </button>
                ))}
              </div>
            );
          }
        )}
      </aside>

      {/* Main content */}
      <div className="flex-1 overflow-auto px-6 py-5">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">{current.icon}</span>
              <h2 className="font-heading text-xl font-semibold text-slate-900">
                {current.label}
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Scope:{" "}
              <span className="font-medium text-slate-700">
                {selectedContainerId ? "Active Container" : "All Accessible Containers"}
              </span>
            </p>
          </div>
        </div>

        {renderReport()}
      </div>
    </div>
  );
}
