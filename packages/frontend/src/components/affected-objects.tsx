import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Link } from "react-router-dom";
import { toast } from "sonner";

interface AffectedItem {
  id: string;
  itemCode: string;
  name: string;
  status: string;
  itemType: string;
}

interface AffectedFormula {
  id: string;
  formulaCode: string;
  name: string;
  status: string;
}

interface AffectedDocument {
  id: string;
  docNumber: string;
  name: string;
  status: string;
  docType: string;
  revisionLabel: string;
}

interface AffectedObjectsData {
  items: AffectedItem[];
  formulas: AffectedFormula[];
  documents: AffectedDocument[];
}

interface AffectedObjectsProps {
  entityId: string;
  entityType: "CHANGE_REQUEST" | "RELEASE_REQUEST";
  canEdit?: boolean;
}

const STATUS_COLOR: Record<string, string> = {
  IN_WORK: "bg-blue-50 text-blue-700",
  UNDER_REVIEW: "bg-orange-50 text-orange-700",
  RELEASED: "bg-green-50 text-green-700",
  DRAFT: "bg-slate-100 text-slate-600",
  OBSOLETE: "bg-red-50 text-red-600"
};

export function AffectedObjects({ entityId, entityType, canEdit = false }: AffectedObjectsProps): JSX.Element {
  const queryClient = useQueryClient();
  const [addType, setAddType] = useState<"ITEM" | "FORMULA" | "DOCUMENT">("ITEM");
  const [addCode, setAddCode] = useState("");
  const [addError, setAddError] = useState("");

  const basePath = entityType === "CHANGE_REQUEST" ? "/changes" : "/releases";

  const { data, isLoading } = useQuery({
    queryKey: ["affected-objects", entityType, entityId],
    queryFn: async () =>
      (await api.get<AffectedObjectsData>(`${basePath}/${entityId}/affected-objects`)).data,
    enabled: Boolean(entityId)
  });

  const addMutation = useMutation({
    mutationFn: async ({ type, code }: { type: string; code: string }) => {
      await api.post(`${basePath}/${entityId}/affected-objects`, { type, code });
    },
    onSuccess: () => {
      const label = addType === "ITEM" ? "Item" : addType === "FORMULA" ? "Formula" : "Document";
      toast.success(`${label} linked.`);
      setAddCode("");
      setAddError("");
      queryClient.invalidateQueries({ queryKey: ["affected-objects", entityType, entityId] });
    },
    onError: (e) => {
      const msg = (e as Error).message || "Failed to add";
      toast.error(msg);
      setAddError(msg);
    }
  });

  const removeMutation = useMutation({
    mutationFn: async ({ type, code }: { type: string; code: string }) => {
      await api.delete(`${basePath}/${entityId}/affected-objects/${type}/${code}`);
    },
    onSuccess: () => {
      toast.success("Object removed.");
      queryClient.invalidateQueries({ queryKey: ["affected-objects", entityType, entityId] });
    }
  });

  if (isLoading) {
    return <p className="text-sm text-slate-500">Loading affected objects...</p>;
  }

  const items = data?.items ?? [];
  const formulas = data?.formulas ?? [];
  const documents = data?.documents ?? [];

  const codePlaceholder =
    addType === "ITEM" ? "Enter item code (e.g. RM-001)" :
    addType === "FORMULA" ? "Enter formula code (e.g. FML-001)" :
    "Enter document number (e.g. DOC-001)";

  return (
    <div className="space-y-5">
      {canEdit ? (
        <div className="rounded border border-slate-200 bg-slate-50 p-3">
          <p className="mb-2 text-xs font-medium text-slate-600">Add Affected Object</p>
          <div className="flex gap-2">
            <select
              value={addType}
              onChange={(e) => { setAddType(e.target.value as "ITEM" | "FORMULA" | "DOCUMENT"); setAddError(""); }}
              className="rounded border border-slate-300 px-2 py-1.5 text-sm"
            >
              <option value="ITEM">Item</option>
              <option value="FORMULA">Formula</option>
              <option value="DOCUMENT">Document</option>
            </select>
            <input
              value={addCode}
              onChange={(e) => { setAddCode(e.target.value); setAddError(""); }}
              placeholder={codePlaceholder}
              className="flex-1 rounded border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              onKeyDown={(e) => {
                if (e.key === "Enter" && addCode.trim()) {
                  addMutation.mutate({ type: addType, code: addCode.trim() });
                }
              }}
            />
            <button
              type="button"
              disabled={!addCode.trim() || addMutation.isPending}
              onClick={() => addMutation.mutate({ type: addType, code: addCode.trim() })}
              className="rounded bg-primary px-3 py-1.5 text-sm text-white disabled:opacity-60"
            >
              {addMutation.isPending ? "Adding..." : "Add"}
            </button>
          </div>
          {addError ? <p className="mt-1 text-xs text-red-600">{addError}</p> : null}
        </div>
      ) : null}

      {/* Items */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Items <span className="ml-1 rounded-full bg-slate-200 px-1.5 py-0.5 text-slate-600">{items.length}</span>
        </p>
        {items.length === 0 ? (
          <p className="text-sm text-slate-400 italic">No items linked.</p>
        ) : (
          <div className="overflow-hidden rounded border border-slate-200">
            {items.map((item, idx) => (
              <div
                key={item.id}
                className={`flex items-center justify-between px-3 py-2 text-sm ${idx !== items.length - 1 ? "border-b border-slate-100" : ""}`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="shrink-0 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-600 uppercase">ITM</span>
                  <Link
                    to={`/items/${item.id}`}
                    className="font-mono text-xs font-medium text-slate-700 hover:text-primary hover:underline"
                  >
                    {item.itemCode}
                  </Link>
                  <span className="truncate text-slate-700">{item.name}</span>
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_COLOR[item.status] ?? "bg-slate-100 text-slate-600"}`}>
                    {item.status.replace(/_/g, " ")}
                  </span>
                  <span className="shrink-0 text-xs text-slate-400">{item.itemType.replace(/_/g, " ")}</span>
                </div>
                {canEdit ? (
                  <button
                    type="button"
                    onClick={() => removeMutation.mutate({ type: "ITEM", code: item.itemCode })}
                    className="ml-3 shrink-0 text-xs text-slate-400 hover:text-red-600"
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Formulas */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Formulas <span className="ml-1 rounded-full bg-slate-200 px-1.5 py-0.5 text-slate-600">{formulas.length}</span>
        </p>
        {formulas.length === 0 ? (
          <p className="text-sm text-slate-400 italic">No formulas linked.</p>
        ) : (
          <div className="overflow-hidden rounded border border-slate-200">
            {formulas.map((formula, idx) => (
              <div
                key={formula.id}
                className={`flex items-center justify-between px-3 py-2 text-sm ${idx !== formulas.length - 1 ? "border-b border-slate-100" : ""}`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="shrink-0 rounded bg-purple-50 px-1.5 py-0.5 text-[10px] font-bold text-purple-600 uppercase">FML</span>
                  <Link
                    to={`/formulas/${formula.id}`}
                    className="font-mono text-xs font-medium text-slate-700 hover:text-primary hover:underline"
                  >
                    {formula.formulaCode}
                  </Link>
                  <span className="truncate text-slate-700">{formula.name}</span>
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_COLOR[formula.status] ?? "bg-slate-100 text-slate-600"}`}>
                    {formula.status.replace(/_/g, " ")}
                  </span>
                </div>
                {canEdit ? (
                  <button
                    type="button"
                    onClick={() => removeMutation.mutate({ type: "FORMULA", code: formula.formulaCode })}
                    className="ml-3 shrink-0 text-xs text-slate-400 hover:text-red-600"
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Documents */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Documents <span className="ml-1 rounded-full bg-slate-200 px-1.5 py-0.5 text-slate-600">{documents.length}</span>
        </p>
        {documents.length === 0 ? (
          <p className="text-sm text-slate-400 italic">No documents linked.</p>
        ) : (
          <div className="overflow-hidden rounded border border-slate-200">
            {documents.map((doc, idx) => (
              <div
                key={doc.id}
                className={`flex items-center justify-between px-3 py-2 text-sm ${idx !== documents.length - 1 ? "border-b border-slate-100" : ""}`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="shrink-0 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 uppercase">DOC</span>
                  <Link
                    to={`/documents/${doc.id}`}
                    className="font-mono text-xs font-medium text-slate-700 hover:text-primary hover:underline"
                  >
                    {doc.docNumber}
                  </Link>
                  <span className="text-[10px] text-slate-400">rev {doc.revisionLabel}</span>
                  <span className="truncate text-slate-700">{doc.name}</span>
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_COLOR[doc.status] ?? "bg-slate-100 text-slate-600"}`}>
                    {doc.status.replace(/_/g, " ")}
                  </span>
                  <span className="shrink-0 text-xs text-slate-400">{doc.docType.replace(/_/g, " ")}</span>
                </div>
                {canEdit ? (
                  <button
                    type="button"
                    onClick={() => removeMutation.mutate({ type: "DOCUMENT", code: doc.docNumber })}
                    className="ml-3 shrink-0 text-xs text-slate-400 hover:text-red-600"
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
