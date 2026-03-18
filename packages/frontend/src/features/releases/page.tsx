import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ObjectActionsMenu, type ObjectActionKey } from "@/components/object-actions-menu";
import { useContainerStore } from "@/store/container.store";
import { Link, useSearchParams } from "react-router-dom";
import { FloatingInput } from "@/components/floating-field";
import { EntityIcon } from "@/components/entity-icon";
import { StatusBadge } from "@/components/status-badge";
import { toast } from "sonner";
import {
  AffectedObjectsPicker,
  isPickerValid,
  type AffectedObject
} from "@/components/affected-objects-picker";

interface ReleaseRecord {
  id: string;
  rrNumber: string;
  title: string;
  status: string;
}

interface ReleaseListResponse {
  data: ReleaseRecord[];
  total: number;
  page: number;
  pageSize: number;
}

interface WorkflowInstance {
  id: string;
  entityId: string;
  currentState: string;
}

export function ReleasesPage(): JSX.Element {
  const { selectedContainerId } = useContainerStore();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const fromItemId = searchParams.get("fromItemId") ?? "";
  const fromItemCode = searchParams.get("fromItemCode") ?? "";
  const fromItemName = searchParams.get("fromItemName") ?? "";
  const fromItemStatus = searchParams.get("fromItemStatus") ?? "";

  const [createOpen, setCreateOpen] = useState(false);
  const createButtonRef = useRef<HTMLButtonElement | null>(null);
  const createPanelRef = useRef<HTMLDivElement | null>(null);
  const [form, setForm] = useState({
    title: fromItemName ? `Release ${fromItemName}` : "",
    description: fromItemCode ? `Release request for ${fromItemCode}${fromItemName ? ` — ${fromItemName}` : ""}` : ""
  });
  const [affectedObjects, setAffectedObjects] = useState<AffectedObject[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Pre-seed when arriving from item detail
  useEffect(() => {
    if (fromItemId && fromItemCode && fromItemName) {
      setCreateOpen(true);
      setForm((prev) => ({
        ...prev,
        title: prev.title || `Release ${fromItemName}`,
        description: prev.description || (fromItemCode ? `Release request for ${fromItemCode} — ${fromItemName}` : "")
      }));
      if (fromItemStatus) {
        setAffectedObjects([
          {
            type: "ITEM",
            id: fromItemId,
            code: fromItemCode,
            name: fromItemName,
            status: fromItemStatus
          }
        ]);
      }
    }
  }, [fromItemId, fromItemCode, fromItemName, fromItemStatus]);

  const { data, isLoading } = useQuery({
    queryKey: ["releases", search, page, selectedContainerId],
    queryFn: async () =>
      (
        await api.get<ReleaseListResponse>("/releases", {
          params: { search, page, pageSize: 10, ...(selectedContainerId ? { containerId: selectedContainerId } : {}) }
        })
      ).data
  });

  const workflowInstances = useQuery({
    queryKey: ["release-workflows", data?.data.map((r) => r.id).join(","), selectedContainerId],
    queryFn: async () => {
      const ids = data?.data.map((r) => r.id).join(",");
      if (!ids) return { data: [] as WorkflowInstance[] };
      return (await api.get<{ data: WorkflowInstance[] }>("/workflows/instances", { params: { entityType: "RELEASE_REQUEST", entityId: ids } })).data;
    },
    enabled: Boolean(data?.data?.length)
  });

  const workflowByEntity = new Map(
    (workflowInstances.data?.data ?? []).map((i) => [i.entityId, i.currentState])
  );

  const createRelease = useMutation({
    mutationFn: async () => {
      const itemIds = affectedObjects.filter((o) => o.type === "ITEM").map((o) => o.id);
      const formulaIds = affectedObjects.filter((o) => o.type === "FORMULA").map((o) => o.id);
      const docIds = affectedObjects.filter((o) => o.type === "DOCUMENT").map((o) => o.id);
      await api.post("/releases", {
        title: form.title,
        description: form.description || undefined,
        containerId: selectedContainerId || undefined,
        targetItems: itemIds,
        targetFormulas: formulaIds,
        targetDocuments: docIds,
        status: "NEW"
      });
    },
    onSuccess: async () => {
      const collectedMsg = affectedObjects.length > 0
        ? " Linked items and formulas were auto-collected."
        : "";
      toast.success(`Release request created.${collectedMsg}`);
      setForm({ title: "", description: "" });
      setAffectedObjects([]);
      setCreateOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["releases"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Create failed");
    }
  });

  function handleSubmit(): void {
    if (!isPickerValid(affectedObjects, "IN_WORK")) {
      toast.error("All affected objects must be In Work before raising a Release Request.");
      return;
    }
    createRelease.mutate();
  }

  async function runReleaseAction(release: ReleaseRecord, action: ObjectActionKey): Promise<void> {
    try {
      if (action === "checkout") {
        await api.put(`/releases/${release.id}`, { status: "UNDER_REVIEW" });
        toast.success(`${release.rrNumber} moved to UNDER_REVIEW.`);
      } else if (action === "checkin") {
        await api.put(`/releases/${release.id}`, { status: "RELEASED" });
        toast.success(`${release.rrNumber} marked RELEASED.`);
      } else if (action === "revise") {
        await api.put(`/releases/${release.id}`, { status: "SUBMITTED" });
        toast.success(`${release.rrNumber} submitted.`);
      } else if (action === "copy") {
        await api.post("/releases", {
          title: `${release.title} Copy`,
          status: "NEW",
          targetFormulas: [],
          targetItems: []
        });
        toast.success(`Copy created for ${release.rrNumber}.`);
      } else if (action === "delete") {
        if (!window.confirm(`Delete release request ${release.rrNumber}?`)) return;
        await api.delete(`/releases/${release.id}`);
        toast.success(`${release.rrNumber} deleted.`);
      }
      await queryClient.invalidateQueries({ queryKey: ["releases"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed");
    }
  }

  useEffect(() => {
    if (!createOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (createPanelRef.current?.contains(target)) return;
      if (createButtonRef.current?.contains(target)) return;
      setCreateOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setCreateOpen(false);
        if (!fromItemId) { setForm({ title: "", description: "" }); setAffectedObjects([]); }
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, [createOpen, fromItemId]);

  function handleSort(key: string): void {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function SortHeader({ label, colKey }: { label: string; colKey: string }) {
    const active = sortKey === colKey;
    return (
      <button type="button" onClick={() => handleSort(colKey)} className="flex items-center gap-1 text-left font-medium hover:text-primary">
        {label}
        <span className="text-[10px] text-slate-400">{active ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}</span>
      </button>
    );
  }

  const sortedReleases = [...(data?.data ?? [])].sort((a, b) => {
    if (!sortKey) return 0;
    const aVal = String(a[sortKey as keyof typeof a] ?? "").toLowerCase();
    const bVal = String(b[sortKey as keyof typeof b] ?? "").toLowerCase();
    return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
  });

  function exportCsv(): void {
    const rows = sortedReleases;
    if (!rows.length) return;
    const headers = ["rrNumber", "title", "status"];
    const csv = [
      headers.join(","),
      ...rows.map((row) =>
        headers
          .map((h) => {
            const val = String(row[h as keyof typeof row] ?? "").replace(/"/g, '""');
            return val.includes(",") || val.includes('"') ? `"${val}"` : val;
          })
          .join(",")
      )
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "releases-export.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const pickerValid = isPickerValid(affectedObjects, "IN_WORK");

  return (
    <div className="space-y-4 rounded-xl bg-white p-4">
      {/* Create button */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
        <button
          ref={createButtonRef}
          type="button"
          onClick={() => setCreateOpen((prev) => !prev)}
          className="w-full rounded-lg border border-primary bg-primary px-4 py-3 text-left text-sm font-semibold text-white shadow-sm transition hover:bg-[#174766]"
        >
          + Create Release Request
        </button>
      </div>

      {/* Create panel */}
      {createOpen ? (
        <div ref={createPanelRef} className="rounded-lg border border-slate-200 bg-slate-50 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-heading text-lg font-semibold">Create Release Request</h3>
            <button type="button" onClick={() => setCreateOpen(false)} className="text-slate-400 hover:text-slate-600 text-lg leading-none">×</button>
          </div>

          {/* Business rule hint */}
          <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
            <span className="mt-0.5 flex-shrink-0">ℹ</span>
            <span>
              <strong>Rule:</strong> Release Requests can only be raised on <strong>In Work</strong> objects.
              To revise a Released object, raise a Change Request first — it will automatically create a new draft version to include here.
            </span>
          </div>

          {fromItemId && fromItemCode ? (
            <div className="flex items-center gap-2 rounded border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
              <span>🔗</span>
              <span>Raised from item <strong>{fromItemCode}</strong>{fromItemName ? ` — ${fromItemName}` : ""}</span>
            </div>
          ) : null}

          <p className="text-xs text-slate-500">Active container: {selectedContainerId || "All Accessible"}</p>

          {/* Form fields */}
          <div className="grid gap-3 md:grid-cols-2">
            <FloatingInput
              label="Title *"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <FloatingInput
              label="Description (optional)"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          {/* Affected objects wizard */}
          <div>
            <p className="mb-1.5 text-xs font-semibold text-slate-600">
              Affected Objects
              <span className="ml-1 font-normal text-slate-400">(must all be In Work)</span>
            </p>
            <AffectedObjectsPicker
              value={affectedObjects}
              onChange={setAffectedObjects}
              requiredStatus="IN_WORK"
            />
          </div>

          {/* Submit */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!form.title.trim() || !pickerValid || createRelease.isPending}
              title={
                !pickerValid
                  ? "Remove Released or Obsolete objects — Release Requests require In Work objects"
                  : !form.title.trim()
                  ? "Title is required"
                  : undefined
              }
              className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#174766] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createRelease.isPending ? "Creating…" : "Create Release Request"}
            </button>
            <button
              type="button"
              onClick={() => { setCreateOpen(false); setForm({ title: "", description: "" }); setAffectedObjects([]); }}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            {affectedObjects.length > 0 && pickerValid && (
              <p className="text-xs text-emerald-600">
                ✓ {affectedObjects.length} object{affectedObjects.length !== 1 ? "s" : ""} selected — dependencies will be auto-collected
              </p>
            )}
          </div>
        </div>
      ) : null}

      {/* List header */}
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-xl">Release Requests</h2>
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search releases"
          className="w-64 rounded border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      {isLoading ? (
        <p>Loading release requests…</p>
      ) : (
        <>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="w-10 py-2"> </th>
                <th className="py-2"><SortHeader label="RR#" colKey="rrNumber" /></th>
                <th className="py-2"><SortHeader label="Title" colKey="title" /></th>
                <th className="py-2"><SortHeader label="Status" colKey="status" /></th>
                <th className="py-2">Workflow</th>
                <th className="py-2">Open</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedReleases.map((release) => (
                <tr key={release.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-2 text-slate-500"><EntityIcon kind="release" /></td>
                  <td className="py-2 font-mono">
                    <Link to={`/releases/${release.id}`} className="text-primary hover:underline">{release.rrNumber}</Link>
                  </td>
                  <td className="py-2">{release.title}</td>
                  <td className="py-2"><StatusBadge status={release.status} /></td>
                  <td className="py-2">
                    {workflowByEntity.get(release.id) ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{workflowByEntity.get(release.id)}</span>
                    ) : (
                      <span className="text-xs text-slate-400">Not started</span>
                    )}
                  </td>
                  <td className="py-2">
                    <Link to={`/releases/${release.id}`} className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50">Open</Link>
                  </td>
                  <td className="py-2">
                    <ObjectActionsMenu onAction={(action) => void runReleaseAction(release, action)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {sortedReleases.length === 0 && !isLoading ? (
            <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
              <p className="font-medium">No release requests found</p>
              <p className="mt-1 text-xs">{search ? "Try a different search term" : 'Click "+ Create Release Request" above to get started'}</p>
            </div>
          ) : null}
          {(data?.total ?? 0) > 0 ? (
            <div className="flex items-center justify-between text-sm text-slate-600">
              <div className="flex items-center gap-3">
                <p>Total: {data?.total ?? 0} records</p>
                <button
                  type="button"
                  onClick={exportCsv}
                  disabled={sortedReleases.length === 0}
                  title="Export current page to CSV"
                  className="rounded border border-slate-300 bg-white px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-60"
                >
                  ↓ Export CSV
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded border border-slate-300 px-2 py-1 disabled:opacity-60">Prev</button>
                <span>Page {page} / {Math.max(1, Math.ceil((data?.total ?? 0) / (data?.pageSize ?? 10)))}</span>
                <button type="button" disabled={page >= Math.max(1, Math.ceil((data?.total ?? 0) / (data?.pageSize ?? 10)))} onClick={() => setPage((p) => p + 1)} className="rounded border border-slate-300 px-2 py-1 disabled:opacity-60">Next</button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
