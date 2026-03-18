import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Link, useParams } from "react-router-dom";
import { useState } from "react";
import { toast } from "sonner";
import { EntityIcon } from "@/components/entity-icon";
import { DetailHeaderCard } from "@/components/detail-header-card";
import { StatusBadge } from "@/components/status-badge";
import { CheckoutBar } from "@/components/checkout-bar";

interface DocumentDetail {
  id: string;
  docNumber: string;
  name: string;
  description?: string | null;
  fileName: string;
  fileSize: number;
  mimeType: string;
  status: string;
  docType: string;
  revisionLabel: string;
  checkedOutById?: string | null;
  checkedOutBy?: { id: string; name: string } | null;
  checkedOutAt?: string | null;
}

interface DocumentLinkRecord {
  id: string;
  entityType: string;
  entityId: string;
  item?: { id: string; itemCode: string; name: string } | null;
}

interface DocumentLinksResponse {
  data: DocumentLinkRecord[];
}

interface ItemOption {
  id: string;
  itemCode: string;
  name: string;
}

const DOC_TYPES = ["SDS", "TDS", "COA", "SPECIFICATION", "PROCESS", "QUALITY", "REGULATORY", "OTHER"] as const;
const DOC_STATUSES = ["DRAFT", "RELEASED", "OBSOLETE"] as const;

export function DocumentDetailPage(): JSX.Element {
  const params = useParams();
  const documentId = String(params.id ?? "");
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState({ name: "", description: "", status: "", docType: "" });

  const currentUserId = (JSON.parse(localStorage.getItem("plm_user") || "{}") as { id?: string }).id ?? "";
  const currentUserRole = (JSON.parse(localStorage.getItem("plm_user") || "{}") as { role?: string }).role ?? "";
  const isAdmin = ["System Admin", "PLM Admin", "Container Admin"].includes(currentUserRole);

  const document = useQuery({
    queryKey: ["document-detail", documentId],
    queryFn: async () => (await api.get<DocumentDetail>(`/documents/${documentId}`)).data,
    enabled: Boolean(documentId)
  });

  const links = useQuery({
    queryKey: ["document-links", documentId],
    queryFn: async () => (await api.get<DocumentLinksResponse>(`/documents/${documentId}/links`)).data,
    enabled: Boolean(documentId)
  });

  const itemOptions = useQuery({
    queryKey: ["document-item-search", search],
    queryFn: async () =>
      (await api.get<{ data: ItemOption[] }>("/items", { params: { search, pageSize: 10 } })).data,
    enabled: search.trim().length > 1
  });

  const updateDocument = useMutation({
    mutationFn: async () => {
      await api.put(`/documents/${documentId}`, {
        name: draft.name || undefined,
        description: draft.description || null,
        status: draft.status || undefined,
        docType: draft.docType || undefined
      });
    },
    onSuccess: async () => {
      toast.success("Document updated.");
      setIsEditing(false);
      await queryClient.invalidateQueries({ queryKey: ["document-detail", documentId] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Update failed")
  });

  const linkItem = useMutation({
    mutationFn: async () => {
      if (!selectedItemId) throw new Error("Select an item to link");
      await api.post(`/documents/${documentId}/link`, {
        entityType: "ITEM",
        entityId: selectedItemId
      });
    },
    onSuccess: async () => {
      toast.success("Item linked.");
      setSelectedItemId("");
      setSearch("");
      await queryClient.invalidateQueries({ queryKey: ["document-links", documentId] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Link failed")
  });

  const unlinkItem = useMutation({
    mutationFn: async (linkId: string) => {
      await api.delete(`/documents/${documentId}/links/${linkId}`);
    },
    onSuccess: async () => {
      toast.success("Link removed.");
      await queryClient.invalidateQueries({ queryKey: ["document-links", documentId] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Remove failed")
  });

  function startEditing() {
    if (!document.data) return;
    setDraft({
      name: document.data.name,
      description: document.data.description ?? "",
      status: document.data.status,
      docType: document.data.docType
    });
    setIsEditing(true);
  }

  if (document.isLoading) {
    return <div className="rounded-lg bg-white p-4">Loading document...</div>;
  }

  if (!document.data) {
    return <div className="rounded-lg bg-white p-4">Document not found.</div>;
  }

  const doc = document.data;
  const isCheckedOut = Boolean(doc.checkedOutById);
  const isMyCheckout = doc.checkedOutById === currentUserId;
  const canEdit = !isCheckedOut || isMyCheckout || isAdmin;

  return (
    <div className="space-y-4 rounded-xl bg-white p-4">
      <DetailHeaderCard
        icon={<EntityIcon kind="document" size={20} />}
        code={doc.docNumber}
        title={isEditing ? (
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            className="w-full rounded border border-slate-300 px-2 py-1 text-base font-semibold"
          />
        ) : doc.name}
        meta={
          <span className="inline-flex items-center gap-2">
            <StatusBadge status={doc.status} />
            <span className="text-xs text-slate-500">{doc.docType} · Rev {doc.revisionLabel}</span>
          </span>
        }
        backTo="/documents"
        backLabel="Back to Documents"
        actions={
          isEditing ? (
            <>
              <button
                type="button"
                onClick={() => updateDocument.mutate()}
                disabled={updateDocument.isPending}
                className="rounded bg-primary px-3 py-1 text-sm text-white disabled:opacity-60"
              >
                {updateDocument.isPending ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="rounded border border-slate-300 bg-white px-3 py-1 text-sm"
              >
                Cancel
              </button>
            </>
          ) : canEdit ? (
            <button
              type="button"
              onClick={startEditing}
              className="rounded border border-slate-300 bg-white px-3 py-1 text-sm"
            >
              Edit
            </button>
          ) : null
        }
      />

      <CheckoutBar
        entityType="documents"
        entityId={documentId}
        info={{
          checkedOutById: doc.checkedOutById,
          checkedOutBy: doc.checkedOutBy,
          checkedOutAt: doc.checkedOutAt,
          status: doc.status
        }}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
        queryKey={["document-detail", documentId]}
      />

      {/* Metadata card */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
        <p className="mb-3 font-medium text-slate-700">Document Details</p>
        {isEditing ? (
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Description</label>
              <input
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                placeholder="Optional description"
                className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Status</label>
              <select
                value={draft.status}
                onChange={(e) => setDraft({ ...draft, status: e.target.value })}
                className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
              >
                {DOC_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Document Type</label>
              <select
                value={draft.docType}
                onChange={(e) => setDraft({ ...draft, docType: e.target.value })}
                className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
              >
                {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 text-sm md:grid-cols-3">
            <div>
              <p className="text-xs text-slate-400">Description</p>
              <p className="text-slate-700">{doc.description || <span className="italic text-slate-400">None</span>}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Status</p>
              <StatusBadge status={doc.status} />
            </div>
            <div>
              <p className="text-xs text-slate-400">Document Type</p>
              <p className="text-slate-700">{doc.docType}</p>
            </div>
          </div>
        )}
      </div>

      {/* File card */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
        <p className="mb-2 font-medium text-slate-700">File</p>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-xs text-slate-600">{doc.fileName}</p>
            <p className="text-xs text-slate-400">{(doc.fileSize / 1024).toFixed(1)} KB · {doc.mimeType}</p>
          </div>
          <a
            href={`/api/documents/${documentId}/download`}
            className="rounded border border-slate-300 bg-white px-3 py-1 text-xs hover:bg-slate-50"
          >
            ↓ Download
          </a>
        </div>
      </div>

      {/* Link to item */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
        <h3 className="mb-3 font-medium text-slate-700">Link to Item</h3>
        <div className="flex gap-2">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search item code or name"
            className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        {search.trim().length > 1 ? (
          <div className="mt-2 max-h-40 overflow-y-auto rounded border border-slate-200 bg-white">
            {(itemOptions.data?.data ?? []).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedItemId(item.id)}
                className={`block w-full px-3 py-2 text-left text-xs hover:bg-slate-50 ${selectedItemId === item.id ? "bg-blue-50" : ""}`}
              >
                <span className="font-mono">{item.itemCode}</span> — {item.name}
              </button>
            ))}
            {(itemOptions.data?.data?.length ?? 0) === 0 ? (
              <p className="p-2 text-xs text-slate-500">No items found.</p>
            ) : null}
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => linkItem.mutate()}
          disabled={!selectedItemId || linkItem.isPending}
          className="mt-2 rounded border border-slate-300 bg-white px-3 py-1 text-xs disabled:opacity-60"
        >
          {linkItem.isPending ? "Linking..." : "Link Item"}
        </button>
      </div>

      {/* Linked items */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
        <h3 className="mb-2 font-medium text-slate-700">
          Linked Items ({links.data?.data?.filter((l) => l.entityType === "ITEM").length ?? 0})
        </h3>
        {links.data?.data?.filter((l) => l.entityType === "ITEM").length ? (
          <div className="space-y-1">
            {links.data.data
              .filter((link) => link.entityType === "ITEM")
              .map((link) => (
                <div key={link.id} className="flex items-center justify-between py-0.5">
                  <Link to={`/items/${link.entityId}`} className="text-primary hover:underline text-sm">
                    {link.item?.itemCode ?? link.entityId} — {link.item?.name ?? ""}
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm("Remove this link?")) {
                        unlinkItem.mutate(link.id);
                      }
                    }}
                    className="ml-2 rounded border border-red-200 bg-red-50 px-2 py-0.5 text-xs text-red-600 hover:bg-red-100"
                  >
                    Unlink
                  </button>
                </div>
              ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500">No items linked.</p>
        )}
      </div>
    </div>
  );
}
