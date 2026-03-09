import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Link, useParams } from "react-router-dom";
import { useState } from "react";
import { EntityIcon } from "@/components/entity-icon";

interface DocumentDetail {
  id: string;
  docNumber: string;
  name: string;
  description?: string | null;
  fileName: string;
  status: string;
  docType: string;
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

export function DocumentDetailPage(): JSX.Element {
  const params = useParams();
  const documentId = String(params.id ?? "");
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [message, setMessage] = useState("");

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

  const linkItem = useMutation({
    mutationFn: async () => {
      if (!selectedItemId) {
        throw new Error("Select an item to link");
      }
      await api.post(`/documents/${documentId}/link`, {
        entityType: "ITEM",
        entityId: selectedItemId
      });
    },
    onSuccess: async () => {
      setMessage("Item linked.");
      setSelectedItemId("");
      setSearch("");
      await queryClient.invalidateQueries({ queryKey: ["document-links", documentId] });
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : "Link failed")
  });

  if (document.isLoading) {
    return <div className="rounded-lg bg-white p-4">Loading document...</div>;
  }

  if (!document.data) {
    return <div className="rounded-lg bg-white p-4">Document not found.</div>;
  }

  return (
    <div className="space-y-4 rounded-xl bg-white p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-slate-100 p-2">
            <EntityIcon kind="document" size={20} />
          </div>
          <div>
            <p className="font-mono text-sm text-slate-500">{document.data.docNumber}</p>
            <h2 className="font-heading text-xl">{document.data.name}</h2>
            <p className="text-sm text-slate-500">{document.data.docType} · {document.data.status}</p>
          </div>
        </div>
        <Link to="/documents" className="rounded border border-slate-300 bg-white px-3 py-1 text-sm">
          Back to Documents
        </Link>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
        <p className="mb-2 font-medium">File</p>
        <p className="text-slate-700">{document.data.fileName}</p>
        <a href={`/api/documents/${documentId}/download`} className="mt-2 inline-block rounded border border-slate-300 px-3 py-1 text-xs">
          Download
        </a>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
        <h3 className="mb-2 font-medium">Link to Item</h3>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search item code or name"
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
        />
        {search.trim().length > 1 ? (
          <div className="mt-2 max-h-40 overflow-y-auto rounded border border-slate-200 bg-white">
            {(itemOptions.data?.data ?? []).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedItemId(item.id)}
                className={`block w-full px-3 py-2 text-left text-xs hover:bg-slate-50 ${selectedItemId === item.id ? "bg-blue-50" : ""}`}
              >
                <span className="font-mono">{item.itemCode}</span> - {item.name}
              </button>
            ))}
            {(itemOptions.data?.data?.length ?? 0) === 0 ? <p className="p-2 text-xs text-slate-500">No items found.</p> : null}
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
        {message ? <p className="mt-2 text-xs text-slate-600">{message}</p> : null}
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
        <h3 className="mb-2 font-medium">Linked Items</h3>
        {links.data?.data?.length ? (
          <div className="space-y-2">
            {links.data.data
              .filter((link) => link.entityType === "ITEM")
              .map((link) => (
                <Link key={link.id} to={`/items/${link.entityId}`} className="block text-primary hover:underline">
                  {link.item?.itemCode ?? link.entityId} - {link.item?.name ?? ""}
                </Link>
              ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500">No items linked.</p>
        )}
      </div>
    </div>
  );
}
