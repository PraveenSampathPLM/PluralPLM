import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { DetailHeaderCard } from "@/components/detail-header-card";
import { StatusBadge } from "@/components/status-badge";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SpecItem {
  id: string;
  itemCode: string;
  name: string;
  status: string;
}

interface SpecFormula {
  id: string;
  formulaCode: string;
  name: string;
  status: string;
}

interface SpecificationDetail {
  id: string;
  specType: string;
  attribute: string;
  value?: string | null;
  uom?: string | null;
  minValue?: number | null;
  maxValue?: number | null;
  testMethod?: string | null;
  containerId?: string | null;
  itemId?: string | null;
  formulaId?: string | null;
  item?: SpecItem | null;
  formula?: SpecFormula | null;
  createdAt: string;
  updatedAt: string;
}

interface AuditEntry {
  id: string;
  action: string;
  actorId?: string | null;
  payload?: unknown;
  createdAt: string;
}

interface HistoryResponse {
  data: AuditEntry[];
  total: number;
  page: number;
  pageSize: number;
}

type Tab = "overview" | "values" | "history" | "linked";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function specTitle(spec: SpecificationDetail): string {
  const entity = spec.item
    ? `${spec.item.itemCode} — ${spec.item.name}`
    : spec.formula
      ? `${spec.formula.formulaCode} — ${spec.formula.name}`
      : "Unlinked";
  return `${spec.specType} / ${spec.attribute} · ${entity}`;
}

// ─── Edit Modal (slide-in panel) ─────────────────────────────────────────────

const SPEC_TYPES = [
  "PHYSICAL", "CHEMICAL", "APPEARANCE", "SAFETY", "PERFORMANCE",
  "REGULATORY", "PACKAGING", "NUTRITION", "MICROBIO", "ALLERGEN", "SENSORY"
] as const;

interface EditPanelProps {
  spec: SpecificationDetail;
  onClose: () => void;
  onSaved: () => void;
}

function EditPanel({ spec, onClose, onSaved }: EditPanelProps): JSX.Element {
  const [draft, setDraft] = useState({
    specType: spec.specType,
    attribute: spec.attribute,
    value: spec.value ?? "",
    uom: spec.uom ?? "",
    minValue: spec.minValue !== null && spec.minValue !== undefined ? String(spec.minValue) : "",
    maxValue: spec.maxValue !== null && spec.maxValue !== undefined ? String(spec.maxValue) : "",
    testMethod: spec.testMethod ?? ""
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        specType: draft.specType,
        attribute: draft.attribute,
        ...(draft.value.trim() ? { value: draft.value.trim() } : {}),
        ...(draft.uom.trim() ? { uom: draft.uom.trim() } : {}),
        ...(draft.minValue !== "" ? { minValue: parseFloat(draft.minValue) } : {}),
        ...(draft.maxValue !== "" ? { maxValue: parseFloat(draft.maxValue) } : {}),
        ...(draft.testMethod.trim() ? { testMethod: draft.testMethod.trim() } : {}),
        ...(spec.itemId ? { itemId: spec.itemId } : {}),
        ...(spec.formulaId ? { formulaId: spec.formulaId } : {})
      };
      await api.put(`/specifications/${spec.id}`, payload);
    },
    onSuccess: () => {
      toast.success("Specification updated.");
      onSaved();
      onClose();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Update failed")
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-heading text-lg">Edit Specification</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none">&times;</button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Spec Type</label>
            <select
              value={draft.specType}
              onChange={(e) => setDraft({ ...draft, specType: e.target.value })}
              className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              {SPEC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Attribute / Parameter Name</label>
            <input
              value={draft.attribute}
              onChange={(e) => setDraft({ ...draft, attribute: e.target.value })}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Target Value</label>
              <input
                value={draft.value}
                onChange={(e) => setDraft({ ...draft, value: e.target.value })}
                placeholder="e.g. Clear"
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Min</label>
              <input
                type="number"
                value={draft.minValue}
                onChange={(e) => setDraft({ ...draft, minValue: e.target.value })}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Max</label>
              <input
                type="number"
                value={draft.maxValue}
                onChange={(e) => setDraft({ ...draft, maxValue: e.target.value })}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Unit (UOM)</label>
              <input
                value={draft.uom}
                onChange={(e) => setDraft({ ...draft, uom: e.target.value })}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Test Method</label>
              <input
                value={draft.testMethod}
                onChange={(e) => setDraft({ ...draft, testMethod: e.target.value })}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-300 bg-white px-4 py-2 text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="rounded bg-primary px-4 py-2 text-sm text-white disabled:opacity-60"
          >
            {save.isPending ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Detail Page ─────────────────────────────────────────────────────────

export function SpecificationDetailPage(): JSX.Element {
  const params = useParams();
  const specId = String(params["id"] ?? "");
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [isEditing, setIsEditing] = useState(false);

  const specQuery = useQuery({
    queryKey: ["specification-detail", specId],
    queryFn: async () => (await api.get<SpecificationDetail>(`/specifications/${specId}`)).data,
    enabled: Boolean(specId)
  });

  const historyQuery = useQuery({
    queryKey: ["specification-history", specId],
    queryFn: async () => (await api.get<HistoryResponse>(`/specifications/${specId}/history`)).data,
    enabled: activeTab === "history" && Boolean(specId)
  });

  function handleSaved(): void {
    void queryClient.invalidateQueries({ queryKey: ["specification-detail", specId] });
  }

  if (specQuery.isLoading) {
    return <div className="rounded-lg bg-white p-6">Loading specification...</div>;
  }

  if (!specQuery.data) {
    return <div className="rounded-lg bg-white p-6 text-slate-500">Specification not found.</div>;
  }

  const spec = specQuery.data;
  const linkedEntity = spec.item ?? spec.formula ?? null;
  const linkedEntityPath = spec.item
    ? `/items/${spec.item.id}`
    : spec.formula
      ? `/formulas/${spec.formula.id}`
      : null;
  const linkedEntityLabel = spec.item
    ? `${spec.item.itemCode} — ${spec.item.name}`
    : spec.formula
      ? `${spec.formula.formulaCode} — ${spec.formula.name}`
      : null;

  const TABS: Array<{ id: Tab; label: string }> = [
    { id: "overview", label: "Overview" },
    { id: "values", label: "Values" },
    { id: "history", label: "History" },
    { id: "linked", label: "Linked Entities" }
  ];

  return (
    <div className="space-y-4">
      <DetailHeaderCard
        code={spec.id.slice(0, 8).toUpperCase()}
        title={specTitle(spec)}
        meta={
          <span className="inline-flex items-center gap-2">
            <StatusBadge status={spec.specType} />
            <span className="text-xs text-slate-500">
              {spec.item ? "Item Spec" : spec.formula ? "Formula Spec" : "Unlinked"}
            </span>
          </span>
        }
        backTo="/specifications"
        backLabel="Back to Specifications"
        actions={
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="rounded border border-slate-300 bg-white px-3 py-1 text-sm hover:bg-slate-50"
          >
            Edit
          </button>
        }
      />

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex gap-6 px-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`border-b-2 pb-2 text-sm font-medium transition ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Overview ── */}
      {activeTab === "overview" ? (
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h3 className="mb-4 font-medium text-slate-700">Metadata</h3>
          <div className="grid gap-4 text-sm md:grid-cols-3">
            <div>
              <p className="text-xs text-slate-400">Spec Type</p>
              <p className="font-medium text-slate-700">{spec.specType}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Attribute / Parameter</p>
              <p className="font-medium text-slate-700">{spec.attribute}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Linked To</p>
              {linkedEntityPath ? (
                <Link to={linkedEntityPath} className="text-primary hover:underline">
                  {linkedEntityLabel}
                </Link>
              ) : (
                <span className="italic text-slate-400">None</span>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-400">Target Value</p>
              <p className="text-slate-700">{spec.value ?? <span className="italic text-slate-400">—</span>}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Min / Max</p>
              <p className="text-slate-700">
                {spec.minValue !== null && spec.minValue !== undefined ? spec.minValue : "—"}
                {" / "}
                {spec.maxValue !== null && spec.maxValue !== undefined ? spec.maxValue : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Unit (UOM)</p>
              <p className="text-slate-700">{spec.uom ?? <span className="italic text-slate-400">—</span>}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Test Method</p>
              <p className="text-slate-700">{spec.testMethod ?? <span className="italic text-slate-400">—</span>}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Created</p>
              <p className="text-slate-700">{formatDate(spec.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Last Updated</p>
              <p className="text-slate-700">{formatDate(spec.updatedAt)}</p>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Values ── */}
      {activeTab === "values" ? (
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-medium text-slate-700">Specification Values / Criteria</h3>
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="rounded border border-slate-300 bg-white px-3 py-1 text-xs hover:bg-slate-50"
            >
              Edit
            </button>
          </div>

          {/* Check if any value/range is set */}
          {!spec.value && spec.minValue === null && spec.minValue === undefined &&
           spec.maxValue === null && spec.maxValue === undefined ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
              <p className="mt-2 text-sm">No parameter values defined.</p>
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="mt-3 rounded bg-primary px-4 py-1.5 text-sm text-white"
              >
                Add parameters
              </button>
            </div>
          ) : (
            <div className="overflow-hidden rounded border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-100 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-2">Parameter</th>
                    <th className="px-4 py-2">Target Value</th>
                    <th className="px-4 py-2">Min</th>
                    <th className="px-4 py-2">Max</th>
                    <th className="px-4 py-2">Unit</th>
                    <th className="px-4 py-2">Test Method</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-slate-100">
                    <td className="px-4 py-2 font-medium text-slate-700">{spec.attribute}</td>
                    <td className="px-4 py-2 text-slate-600">{spec.value ?? "—"}</td>
                    <td className="px-4 py-2 text-slate-600">
                      {spec.minValue !== null && spec.minValue !== undefined ? spec.minValue : "—"}
                    </td>
                    <td className="px-4 py-2 text-slate-600">
                      {spec.maxValue !== null && spec.maxValue !== undefined ? spec.maxValue : "—"}
                    </td>
                    <td className="px-4 py-2 text-slate-600">{spec.uom ?? "—"}</td>
                    <td className="px-4 py-2 text-slate-600">{spec.testMethod ?? "—"}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {/* ── History ── */}
      {activeTab === "history" ? (
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h3 className="mb-4 font-medium text-slate-700">Version History</h3>
          {historyQuery.isLoading ? (
            <p className="text-sm text-slate-500">Loading history...</p>
          ) : (historyQuery.data?.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-slate-400 italic">No history recorded yet.</p>
          ) : (
            <ol className="relative border-l-2 border-slate-200 pl-4 space-y-4">
              {historyQuery.data?.data.map((entry) => (
                <li key={entry.id} className="relative">
                  <span className="absolute -left-[11px] top-1 h-3 w-3 rounded-full border-2 border-primary bg-white" />
                  <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">
                        {entry.action}
                      </span>
                      <span className="text-xs text-slate-400">{formatDate(entry.createdAt)}</span>
                    </div>
                    {entry.actorId ? (
                      <p className="mt-1 text-xs text-slate-500">Actor: {entry.actorId}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      ) : null}

      {/* ── Linked Entities ── */}
      {activeTab === "linked" ? (
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h3 className="mb-4 font-medium text-slate-700">Linked Entities</h3>
          <div className="space-y-3">
            {spec.item ? (
              <div className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600">I</div>
                <div className="flex-1">
                  <p className="text-xs text-slate-400">Item</p>
                  <Link to={`/items/${spec.item.id}`} className="text-sm font-medium text-primary hover:underline">
                    {spec.item.itemCode} — {spec.item.name}
                  </Link>
                </div>
                <StatusBadge status={spec.item.status} />
              </div>
            ) : null}
            {spec.formula ? (
              <div className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 text-xs font-bold text-purple-600">F</div>
                <div className="flex-1">
                  <p className="text-xs text-slate-400">Formula</p>
                  <Link to={`/formulas/${spec.formula.id}`} className="text-sm font-medium text-primary hover:underline">
                    {spec.formula.formulaCode} — {spec.formula.name}
                  </Link>
                </div>
                <StatusBadge status={spec.formula.status} />
              </div>
            ) : null}
            {!spec.item && !spec.formula ? (
              <p className="text-sm italic text-slate-400">No entities linked to this specification.</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Edit slide-in panel */}
      {isEditing ? (
        <EditPanel
          spec={spec}
          onClose={() => setIsEditing(false)}
          onSaved={handleSaved}
        />
      ) : null}
    </div>
  );
}
