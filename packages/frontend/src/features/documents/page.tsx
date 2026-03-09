import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useContainerStore } from "@/store/container.store";
import { EntityIcon } from "@/components/entity-icon";

interface DocumentRecord {
  id: string;
  docNumber: string;
  name: string;
  description?: string | null;
  fileName: string;
  fileSize: number;
  docType: string;
  status: string;
  createdAt: string;
}

interface DocumentListResponse {
  data: DocumentRecord[];
  total: number;
  page: number;
  pageSize: number;
}

interface ItemOption {
  id: string;
  itemCode: string;
  name: string;
}

export function DocumentsPage(): JSX.Element {
  const { selectedContainerId } = useContainerStore();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [message, setMessage] = useState("");
  const [uploadForm, setUploadForm] = useState({
    name: "",
    description: "",
    status: "DRAFT",
    docType: "OTHER"
  });
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState("");
  const [linkSearch, setLinkSearch] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");

  const nextNumber = useQuery({
    queryKey: ["next-document-number"],
    queryFn: async () => (await api.get<{ value: string }>(`/config/next-number/DOCUMENT`)).data
  });

  const documents = useQuery({
    queryKey: ["documents", search, page, selectedContainerId],
    queryFn: async () =>
      (
        await api.get<DocumentListResponse>("/documents", {
          params: {
            search,
            page,
            pageSize: 10,
            ...(selectedContainerId ? { containerId: selectedContainerId } : {})
          }
        })
      ).data
  });

  const itemOptions = useQuery({
    queryKey: ["document-item-search", linkSearch],
    queryFn: async () =>
      (await api.get<{ data: ItemOption[] }>("/items", { params: { search: linkSearch, pageSize: 10 } })).data,
    enabled: linkSearch.trim().length > 1
  });

  const uploadDocument = useMutation({
    mutationFn: async () => {
      if (!file) {
        throw new Error("Select a file to upload");
      }
      const formData = new FormData();
      formData.append("file", file);
      const fileNameOnly = file.name.replace(/\.[^/.]+$/, "");
      const docName = uploadForm.name.trim() || fileNameOnly;
      formData.append("name", docName);
      if (uploadForm.description) {
        formData.append("description", uploadForm.description);
      }
      formData.append("docType", uploadForm.docType);
      formData.append("status", uploadForm.status);
      if (selectedContainerId) {
        formData.append("containerId", selectedContainerId);
      }
      await api.post("/documents", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
    },
    onSuccess: async () => {
      setMessage("Document uploaded.");
      setUploadForm({ name: "", description: "", status: "DRAFT", docType: "OTHER" });
      setFile(null);
      await queryClient.invalidateQueries({ queryKey: ["next-document-number"] });
      await queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : "Upload failed")
  });

  const linkDocument = useMutation({
    mutationFn: async () => {
      if (!selectedDocId || !selectedItemId) {
        throw new Error("Select an item to link.");
      }
      await api.post(`/documents/${selectedDocId}/link`, {
        entityType: "ITEM",
        entityId: selectedItemId
      });
    },
    onSuccess: async () => {
      setMessage("Document linked to item.");
      setSelectedItemId("");
      setLinkSearch("");
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : "Link failed")
  });

  const total = documents.data?.total ?? 0;
  const pageSize = documents.data?.pageSize ?? 10;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const sortedDocs = useMemo(() => documents.data?.data ?? [], [documents.data?.data]);

  return (
    <div className="space-y-4 rounded-xl bg-white p-4">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h3 className="mb-3 font-heading text-lg">Upload Document</h3>
        <p className="mb-2 text-xs text-slate-500">Auto-number preview: {nextNumber.data?.value ?? "Loading..."}</p>
        <div className="grid gap-3 md:grid-cols-5">
          <input
            value={uploadForm.name}
            onChange={(event) => setUploadForm({ ...uploadForm, name: event.target.value })}
            placeholder="Document Name"
            className="rounded border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            value={uploadForm.description}
            onChange={(event) => setUploadForm({ ...uploadForm, description: event.target.value })}
            placeholder="Description"
            className="rounded border border-slate-300 px-3 py-2 text-sm"
          />
          <select
            value={uploadForm.status}
            onChange={(event) => setUploadForm({ ...uploadForm, status: event.target.value })}
            className="rounded border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="DRAFT">Draft</option>
            <option value="RELEASED">Released</option>
            <option value="OBSOLETE">Obsolete</option>
          </select>
          <select
            value={uploadForm.docType}
            onChange={(event) => setUploadForm({ ...uploadForm, docType: event.target.value })}
            className="rounded border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="SDS">SDS</option>
            <option value="TDS">TDS</option>
            <option value="COA">CoA</option>
            <option value="SPECIFICATION">Specification</option>
            <option value="PROCESS">Process</option>
            <option value="QUALITY">Quality</option>
            <option value="REGULATORY">Regulatory</option>
            <option value="OTHER">Other</option>
          </select>
          <div
            onDragEnter={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setDragActive(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setDragActive(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setDragActive(false);
              const dropped = event.dataTransfer.files?.[0];
              if (dropped) {
                setFile(dropped);
                const baseName = dropped.name.replace(/\.[^/.]+$/, "");
                setUploadForm((prev) => ({ ...prev, name: prev.name || baseName }));
              }
            }}
            className={`flex items-center justify-between rounded border px-3 py-2 text-sm ${
              dragActive ? "border-primary bg-blue-50" : "border-slate-300 bg-white"
            }`}
          >
            <span className="text-slate-600">{file ? file.name : "Drag & drop file"}</span>
            <label className="rounded border border-slate-300 bg-white px-2 py-1 text-xs">
              Browse
              <input
                type="file"
                className="hidden"
                onChange={(event) => {
                  const picked = event.target.files?.[0] ?? null;
                  setFile(picked);
                  if (picked) {
                    const baseName = picked.name.replace(/\.[^/.]+$/, "");
                    setUploadForm((prev) => ({ ...prev, name: prev.name || baseName }));
                  }
                }}
              />
            </label>
          </div>
        </div>
        <button
          type="button"
          onClick={() => uploadDocument.mutate()}
          disabled={!file || uploadDocument.isPending}
          className="mt-3 rounded bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {uploadDocument.isPending ? "Uploading..." : "Upload Document"}
        </button>
        {message ? <p className="mt-2 text-sm text-slate-700">{message}</p> : null}
      </div>

      <div className="flex items-center justify-between">
        <h2 className="font-heading text-xl">Documents</h2>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search documents"
          className="w-64 rounded border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      {documents.isLoading ? (
        <p>Loading documents...</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="w-10 py-2"> </th>
              <th className="py-2">Doc #</th>
              <th className="py-2">Name</th>
              <th className="py-2">Type</th>
              <th className="py-2">Status</th>
              <th className="py-2">File</th>
              <th className="py-2">Link</th>
              <th className="py-2">Download</th>
            </tr>
          </thead>
          <tbody>
            {sortedDocs.map((doc) => (
              <tr key={doc.id} className="border-b border-slate-100">
                <td className="py-2 text-slate-500">
                  <EntityIcon kind="document" />
                </td>
                <td className="py-2 font-mono">
                  <a href={`/documents/${doc.id}`} className="text-primary hover:underline">{doc.docNumber}</a>
                </td>
                <td className="py-2">
                  <p className="font-medium text-slate-800">{doc.name}</p>
                  <p className="text-xs text-slate-500">{doc.description ?? ""}</p>
                </td>
                <td className="py-2">{doc.docType}</td>
                <td className="py-2">{doc.status}</td>
                <td className="py-2 text-xs text-slate-500">{doc.fileName}</td>
                <td className="py-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDocId(doc.id);
                      setLinkSearch("");
                      setSelectedItemId("");
                    }}
                    className="rounded border border-slate-300 px-2 py-1 text-xs"
                  >
                    Link Item
                  </button>
                </td>
                <td className="py-2">
                  <a href={`/api/documents/${doc.id}/download`} className="rounded border border-slate-300 px-2 py-1 text-xs">
                    Download
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="flex items-center justify-between text-sm text-slate-600">
        <p>Documents: {total} records</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded border border-slate-300 px-2 py-1 disabled:opacity-60"
          >
            Prev
          </button>
          <span>
            Page {page} / {pageCount}
          </span>
          <button
            type="button"
            disabled={page >= pageCount}
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            className="rounded border border-slate-300 px-2 py-1 disabled:opacity-60"
          >
            Next
          </button>
        </div>
      </div>

      {selectedDocId ? (
        <div className="fixed inset-0 z-40 flex">
          <button type="button" className="h-full flex-1 bg-black/30" onClick={() => setSelectedDocId("")} aria-label="Close panel" />
          <div className="h-full w-full max-w-xl overflow-y-auto border-l border-slate-200 bg-white p-4 shadow-xl">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-heading text-lg">Link Document to Item</h3>
              <button type="button" onClick={() => setSelectedDocId("")} className="rounded border border-slate-300 bg-white px-2 py-1 text-xs">
                Close
              </button>
            </div>
            <input
              value={linkSearch}
              onChange={(event) => setLinkSearch(event.target.value)}
              placeholder="Search item code or name"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
            {linkSearch.trim().length > 1 ? (
              <div className="mt-2 max-h-60 overflow-y-auto rounded border border-slate-200 bg-white">
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
            ) : (
              <p className="mt-2 text-xs text-slate-500">Type at least 2 characters to search.</p>
            )}
            <button
              type="button"
              onClick={() => linkDocument.mutate()}
              disabled={!selectedItemId || linkDocument.isPending}
              className="mt-3 rounded border border-slate-300 bg-white px-3 py-1 text-xs disabled:opacity-60"
            >
              {linkDocument.isPending ? "Linking..." : "Link Item"}
            </button>
            {message ? <p className="mt-2 text-xs text-slate-600">{message}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
