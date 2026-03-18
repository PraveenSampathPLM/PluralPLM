import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ObjectActionsMenu, type ObjectActionKey } from "@/components/object-actions-menu";
import { useContainerStore } from "@/store/container.store";
import { Link, useSearchParams } from "react-router-dom";
import { FloatingInput, FloatingSelect } from "@/components/floating-field";
import { EntityIcon } from "@/components/entity-icon";
import { StatusBadge } from "@/components/status-badge";
import { toast } from "sonner";
import {
  AffectedObjectsPicker,
  isPickerValid,
  type AffectedObject
} from "@/components/affected-objects-picker";

interface ChangeRecord {
  id: string;
  crNumber: string;
  title: string;
  type: string;
  priority: string;
  status: string;
}

interface ChangeListResponse {
  data: ChangeRecord[];
  total: number;
  page: number;
  pageSize: number;
}

interface WorkflowInstance {
  id: string;
  entityId: string;
  currentState: string;
}

export function ChangesPage(): JSX.Element {
  const { selectedContainerId } = useContainerStore();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const fromItemId = searchParams.get("fromItemId") ?? "";
  const fromItemCode = searchParams.get("fromItemCode") ?? "";
  const fromItemName = searchParams.get("fromItemName") ?? "";
  const fromItemStatus = searchParams.get("fromItemStatus") ?? "";

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [createOpen, setCreateOpen] = useState(false);
  const createButtonRef = useRef<HTMLButtonElement | null>(null);
  const createPanelRef = useRef<HTMLDivElement | null>(null);

  const [form, setForm] = useState({
    title: fromItemName ? `Change for ${fromItemName}` : "",
    type: "ECR",
    priority: "MEDIUM",
    impactAssessment: ""
  });
  const [affectedObjects, setAffectedObjects] = useState<AffectedObject[]>([]);

  // Pre-seed affected objects when arriving from an item
  useEffect(() => {
    if (fromItemId && fromItemCode && fromItemName) {
      setCreateOpen(true);
      setForm((prev) => ({ ...prev, title: prev.title || `Change for ${fromItemName}` }));
      if (fromItemStatus && fromItemCode) {
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
    queryKey: ["changes", search, page, selectedContainerId],
    queryFn: async () =>
      (
        await api.get<ChangeListResponse>("/changes", {
          params: { search, page, pageSize: 10, ...(selectedContainerId ? { containerId: selectedContainerId } : {}) }
        })
      ).data
  });

  const workflowInstances = useQuery({
    queryKey: ["change-workflows", data?.data.map((c) => c.id).join(","), selectedContainerId],
    queryFn: async () => {
      const ids = data?.data.map((c) => c.id).join(",");
      if (!ids) return { data: [] as WorkflowInstance[] };
      return (await api.get<{ data: WorkflowInstance[] }>("/workflows/instances", { params: { entityType: "CHANGE_REQUEST", entityId: ids } })).data;
    },
    enabled: Boolean(data?.data?.length)
  });

  const workflowByEntity = new Map(
    (workflowInstances.data?.data ?? []).map((i) => [i.entityId, i.currentState])
  );

  const createChange = useMutation({
    mutationFn: async () => {
      const itemCodes = affectedObjects.filter((o) => o.type === "ITEM").map((o) => o.code);
      const formulaCodes = affectedObjects.filter((o) => o.type === "FORMULA").map((o) => o.code);
      const docCodes = affectedObjects.filter((o) => o.type === "DOCUMENT").map((o) => o.code);
      await api.post("/changes", {
        title: form.title,
        type: form.type,
        priority: form.priority,
        containerId: selectedContainerId || undefined,
        impactAssessment: form.impactAssessment || undefined,
        status: "NEW",
        affectedItems: itemCodes,
        affectedFormulas: formulaCodes,
        affectedDocuments: docCodes
      });
    },
    onSuccess: async (_, __, ctx) => {
      void ctx;
      const linkedMsg = affectedObjects.length > 0
        ? ` Affected objects were auto-revised to new draft versions.`
        : "";
      toast.success(`Change request created.${linkedMsg}`);
      setForm({ title: "", type: "ECR", priority: "MEDIUM", impactAssessment: "" });
      setAffectedObjects([]);
      setCreateOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["changes"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Create failed");
    }
  });

  function handleSubmit(): void {
    if (!isPickerValid(affectedObjects, "RELEASED")) {
      toast.error("All affected objects must be in Released status before raising a Change Request.");
      return;
    }
    createChange.mutate();
  }

  async function runChangeAction(change: ChangeRecord, action: ObjectActionKey): Promise<void> {
    try {
      if (action === "checkout") {
        await api.put(`/changes/${change.id}`, { status: "UNDER_REVIEW" });
        toast.success(`${change.crNumber} checked out.`);
      } else if (action === "checkin") {
        await api.put(`/changes/${change.id}`, { status: "IMPLEMENTED" });
        toast.success(`${change.crNumber} checked in.`);
      } else if (action === "revise") {
        await api.put(`/changes/${change.id}`, { status: "SUBMITTED" });
        toast.success(`${change.crNumber} revised to SUBMITTED.`);
      } else if (action === "copy") {
        await api.post("/changes", {
          title: `${change.title} Copy`,
          type: change.type,
          priority: change.priority,
          status: "NEW",
          affectedItems: [],
          affectedFormulas: []
        });
        toast.success(`Copy created for ${change.crNumber}.`);
      } else if (action === "delete") {
        if (!window.confirm(`Delete change request ${change.crNumber}?`)) return;
        await api.delete(`/changes/${change.id}`);
        toast.success(`${change.crNumber} deleted.`);
      }
      await queryClient.invalidateQueries({ queryKey: ["changes"] });
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
        if (!fromItemId) {
          setForm({ title: "", type: "ECR", priority: "MEDIUM", impactAssessment: "" });
          setAffectedObjects([]);
        }
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

  const sortedChanges = [...(data?.data ?? [])].sort((a, b) => {
    if (!sortKey) return 0;
    const aVal = String(a[sortKey as keyof typeof a] ?? "").toLowerCase();
    const bVal = String(b[sortKey as keyof typeof b] ?? "").toLowerCase();
    return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
  });

  function exportCsv(): void {
    const rows = sortedChanges;
    if (!rows.length) return;
    const headers = ["crNumber", "title", "type", "priority", "status"];
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
    a.download = "changes-export.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const pickerValid = isPickerValid(affectedObjects, "RELEASED");

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
          + Create Change Request
        </button>
      </div>

      {/* Create panel */}
      {createOpen ? (
        <div ref={createPanelRef} className="rounded-lg border border-slate-200 bg-slate-50 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-heading text-lg font-semibold">Create Change Request</h3>
            <button type="button" onClick={() => setCreateOpen(false)} className="text-slate-400 hover:text-slate-600 text-lg leading-none">×</button>
          </div>

          {/* Business rule hint */}
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <span className="mt-0.5 flex-shrink-0">ℹ</span>
            <span>
              <strong>Rule:</strong> Change Requests can only be raised on <strong>Released</strong> objects.
              On creation, all affected objects will be automatically revised to a new In Work draft version,
              which will be released as part of this change.
            </span>
          </div>

          {fromItemId && fromItemCode ? (
            <div className="flex items-center gap-2 rounded border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
              <span>🔗</span>
              <span>Raised from item <strong>{fromItemCode}</strong>{fromItemName ? ` — ${fromItemName}` : ""}</span>
            </div>
          ) : null}

          <p className="text-xs text-slate-500">Active container: {selectedContainerId || "All Accessible"}</p>

          {/* Form fields row */}
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div className="lg:col-span-2">
              <FloatingInput
                label="Title *"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <FloatingSelect
              label="Type"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              <option value="ECR">ECR — Engineering Change Request</option>
              <option value="ECO">ECO — Engineering Change Order</option>
              <option value="ECN">ECN — Engineering Change Notice</option>
              <option value="DCO">DCO — Document Change Order</option>
            </FloatingSelect>
            <FloatingSelect
              label="Priority"
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </FloatingSelect>
          </div>

          <FloatingInput
            label="Impact Assessment (optional)"
            value={form.impactAssessment}
            onChange={(e) => setForm({ ...form, impactAssessment: e.target.value })}
          />

          {/* Affected objects wizard */}
          <div>
            <p className="mb-1.5 text-xs font-semibold text-slate-600">
              Affected Objects
              <span className="ml-1 font-normal text-slate-400">(must all be Released)</span>
            </p>
            <AffectedObjectsPicker
              value={affectedObjects}
              onChange={setAffectedObjects}
              requiredStatus="RELEASED"
            />
          </div>

          {/* Submit */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!form.title.trim() || !pickerValid || createChange.isPending}
              title={
                !pickerValid
                  ? "Remove non-Released objects before creating the Change Request"
                  : !form.title.trim()
                  ? "Title is required"
                  : undefined
              }
              className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#174766] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createChange.isPending ? "Creating & Revising…" : "Create Change Request"}
            </button>
            <button
              type="button"
              onClick={() => { setCreateOpen(false); setForm({ title: "", type: "ECR", priority: "MEDIUM", impactAssessment: "" }); setAffectedObjects([]); }}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            {affectedObjects.length > 0 && pickerValid && (
              <p className="text-xs text-emerald-600">
                ✓ {affectedObjects.length} object{affectedObjects.length !== 1 ? "s" : ""} will be auto-revised on create
              </p>
            )}
          </div>
        </div>
      ) : null}

      {/* List header */}
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-xl">Change Management</h2>
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search changes"
          className="w-64 rounded border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      {isLoading ? (
        <p>Loading change requests…</p>
      ) : (
        <>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="w-10 py-2"> </th>
                <th className="py-2"><SortHeader label="CR#" colKey="crNumber" /></th>
                <th className="py-2"><SortHeader label="Title" colKey="title" /></th>
                <th className="py-2"><SortHeader label="Type" colKey="type" /></th>
                <th className="py-2"><SortHeader label="Priority" colKey="priority" /></th>
                <th className="py-2"><SortHeader label="Status" colKey="status" /></th>
                <th className="py-2">Workflow</th>
                <th className="py-2">Open</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedChanges.map((change) => (
                <tr key={change.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-2 text-slate-500"><EntityIcon kind="change" /></td>
                  <td className="py-2 font-mono">
                    <Link to={`/changes/${change.id}`} className="text-primary hover:underline">{change.crNumber}</Link>
                  </td>
                  <td className="py-2">{change.title}</td>
                  <td className="py-2">
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{change.type}</span>
                  </td>
                  <td className="py-2">
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                      change.priority === "CRITICAL" ? "bg-red-100 text-red-700" :
                      change.priority === "HIGH" ? "bg-orange-100 text-orange-700" :
                      change.priority === "MEDIUM" ? "bg-amber-100 text-amber-700" :
                      "bg-slate-100 text-slate-600"
                    }`}>{change.priority}</span>
                  </td>
                  <td className="py-2"><StatusBadge status={change.status} /></td>
                  <td className="py-2">
                    {workflowByEntity.get(change.id) ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{workflowByEntity.get(change.id)}</span>
                    ) : (
                      <span className="text-xs text-slate-400">Not started</span>
                    )}
                  </td>
                  <td className="py-2">
                    <Link to={`/changes/${change.id}`} className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50">Open</Link>
                  </td>
                  <td className="py-2">
                    <ObjectActionsMenu onAction={(action) => void runChangeAction(change, action)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {sortedChanges.length === 0 && !isLoading ? (
            <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
              <p className="font-medium">No change requests found</p>
              <p className="mt-1 text-xs">{search ? "Try a different search term" : 'Click "+ Create Change Request" above to get started'}</p>
            </div>
          ) : null}
          {(data?.total ?? 0) > 0 ? (
            <div className="flex items-center justify-between text-sm text-slate-600">
              <div className="flex items-center gap-3">
                <p>Total: {data?.total ?? 0} records</p>
                <button
                  type="button"
                  onClick={exportCsv}
                  disabled={sortedChanges.length === 0}
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
