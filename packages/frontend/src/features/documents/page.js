import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useContainerStore } from "@/store/container.store";
import { EntityIcon } from "@/components/entity-icon";
export function DocumentsPage() {
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
    const [file, setFile] = useState(null);
    const [dragActive, setDragActive] = useState(false);
    const [selectedDocId, setSelectedDocId] = useState("");
    const [linkSearch, setLinkSearch] = useState("");
    const [selectedItemId, setSelectedItemId] = useState("");
    const nextNumber = useQuery({
        queryKey: ["next-document-number"],
        queryFn: async () => (await api.get(`/config/next-number/DOCUMENT`)).data
    });
    const documents = useQuery({
        queryKey: ["documents", search, page, selectedContainerId],
        queryFn: async () => (await api.get("/documents", {
            params: {
                search,
                page,
                pageSize: 10,
                ...(selectedContainerId ? { containerId: selectedContainerId } : {})
            }
        })).data
    });
    const itemOptions = useQuery({
        queryKey: ["document-item-search", linkSearch],
        queryFn: async () => (await api.get("/items", { params: { search: linkSearch, pageSize: 10 } })).data,
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
    return (_jsxs("div", { className: "space-y-4 rounded-xl bg-white p-4", children: [_jsxs("div", { className: "rounded-lg border border-slate-200 bg-slate-50 p-4", children: [_jsx("h3", { className: "mb-3 font-heading text-lg", children: "Upload Document" }), _jsxs("p", { className: "mb-2 text-xs text-slate-500", children: ["Auto-number preview: ", nextNumber.data?.value ?? "Loading..."] }), _jsxs("div", { className: "grid gap-3 md:grid-cols-5", children: [_jsx("input", { value: uploadForm.name, onChange: (event) => setUploadForm({ ...uploadForm, name: event.target.value }), placeholder: "Document Name", className: "rounded border border-slate-300 px-3 py-2 text-sm" }), _jsx("input", { value: uploadForm.description, onChange: (event) => setUploadForm({ ...uploadForm, description: event.target.value }), placeholder: "Description", className: "rounded border border-slate-300 px-3 py-2 text-sm" }), _jsxs("select", { value: uploadForm.status, onChange: (event) => setUploadForm({ ...uploadForm, status: event.target.value }), className: "rounded border border-slate-300 px-3 py-2 text-sm", children: [_jsx("option", { value: "DRAFT", children: "Draft" }), _jsx("option", { value: "RELEASED", children: "Released" }), _jsx("option", { value: "OBSOLETE", children: "Obsolete" })] }), _jsxs("select", { value: uploadForm.docType, onChange: (event) => setUploadForm({ ...uploadForm, docType: event.target.value }), className: "rounded border border-slate-300 px-3 py-2 text-sm", children: [_jsx("option", { value: "SDS", children: "SDS" }), _jsx("option", { value: "TDS", children: "TDS" }), _jsx("option", { value: "COA", children: "CoA" }), _jsx("option", { value: "SPECIFICATION", children: "Specification" }), _jsx("option", { value: "PROCESS", children: "Process" }), _jsx("option", { value: "QUALITY", children: "Quality" }), _jsx("option", { value: "REGULATORY", children: "Regulatory" }), _jsx("option", { value: "OTHER", children: "Other" })] }), _jsxs("div", { onDragEnter: (event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    setDragActive(true);
                                }, onDragOver: (event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                }, onDragLeave: (event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    setDragActive(false);
                                }, onDrop: (event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    setDragActive(false);
                                    const dropped = event.dataTransfer.files?.[0];
                                    if (dropped) {
                                        setFile(dropped);
                                        const baseName = dropped.name.replace(/\.[^/.]+$/, "");
                                        setUploadForm((prev) => ({ ...prev, name: prev.name || baseName }));
                                    }
                                }, className: `flex items-center justify-between rounded border px-3 py-2 text-sm ${dragActive ? "border-primary bg-blue-50" : "border-slate-300 bg-white"}`, children: [_jsx("span", { className: "text-slate-600", children: file ? file.name : "Drag & drop file" }), _jsxs("label", { className: "rounded border border-slate-300 bg-white px-2 py-1 text-xs", children: ["Browse", _jsx("input", { type: "file", className: "hidden", onChange: (event) => {
                                                    const picked = event.target.files?.[0] ?? null;
                                                    setFile(picked);
                                                    if (picked) {
                                                        const baseName = picked.name.replace(/\.[^/.]+$/, "");
                                                        setUploadForm((prev) => ({ ...prev, name: prev.name || baseName }));
                                                    }
                                                } })] })] })] }), _jsx("button", { type: "button", onClick: () => uploadDocument.mutate(), disabled: !file || uploadDocument.isPending, className: "mt-3 rounded bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60", children: uploadDocument.isPending ? "Uploading..." : "Upload Document" }), message ? _jsx("p", { className: "mt-2 text-sm text-slate-700", children: message }) : null] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h2", { className: "font-heading text-xl", children: "Documents" }), _jsx("input", { value: search, onChange: (event) => setSearch(event.target.value), placeholder: "Search documents", className: "w-64 rounded border border-slate-300 px-3 py-2 text-sm" })] }), documents.isLoading ? (_jsx("p", { children: "Loading documents..." })) : (_jsxs("table", { className: "w-full text-left text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-slate-200 text-slate-500", children: [_jsx("th", { className: "w-10 py-2", children: "\u00A0" }), _jsx("th", { className: "py-2", children: "Doc #" }), _jsx("th", { className: "py-2", children: "Name" }), _jsx("th", { className: "py-2", children: "Type" }), _jsx("th", { className: "py-2", children: "Status" }), _jsx("th", { className: "py-2", children: "File" }), _jsx("th", { className: "py-2", children: "Link" }), _jsx("th", { className: "py-2", children: "Download" })] }) }), _jsx("tbody", { children: sortedDocs.map((doc) => (_jsxs("tr", { className: "border-b border-slate-100", children: [_jsx("td", { className: "py-2 text-slate-500", children: _jsx(EntityIcon, { kind: "document" }) }), _jsx("td", { className: "py-2 font-mono", children: _jsx("a", { href: `/documents/${doc.id}`, className: "text-primary hover:underline", children: doc.docNumber }) }), _jsxs("td", { className: "py-2", children: [_jsx("p", { className: "font-medium text-slate-800", children: doc.name }), _jsx("p", { className: "text-xs text-slate-500", children: doc.description ?? "" })] }), _jsx("td", { className: "py-2", children: doc.docType }), _jsx("td", { className: "py-2", children: doc.status }), _jsx("td", { className: "py-2 text-xs text-slate-500", children: doc.fileName }), _jsx("td", { className: "py-2", children: _jsx("button", { type: "button", onClick: () => {
                                            setSelectedDocId(doc.id);
                                            setLinkSearch("");
                                            setSelectedItemId("");
                                        }, className: "rounded border border-slate-300 px-2 py-1 text-xs", children: "Link Item" }) }), _jsx("td", { className: "py-2", children: _jsx("a", { href: `/api/documents/${doc.id}/download`, className: "rounded border border-slate-300 px-2 py-1 text-xs", children: "Download" }) })] }, doc.id))) })] })), _jsxs("div", { className: "flex items-center justify-between text-sm text-slate-600", children: [_jsxs("p", { children: ["Documents: ", total, " records"] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { type: "button", disabled: page <= 1, onClick: () => setPage((p) => Math.max(1, p - 1)), className: "rounded border border-slate-300 px-2 py-1 disabled:opacity-60", children: "Prev" }), _jsxs("span", { children: ["Page ", page, " / ", pageCount] }), _jsx("button", { type: "button", disabled: page >= pageCount, onClick: () => setPage((p) => Math.min(pageCount, p + 1)), className: "rounded border border-slate-300 px-2 py-1 disabled:opacity-60", children: "Next" })] })] }), selectedDocId ? (_jsxs("div", { className: "fixed inset-0 z-40 flex", children: [_jsx("button", { type: "button", className: "h-full flex-1 bg-black/30", onClick: () => setSelectedDocId(""), "aria-label": "Close panel" }), _jsxs("div", { className: "h-full w-full max-w-xl overflow-y-auto border-l border-slate-200 bg-white p-4 shadow-xl", children: [_jsxs("div", { className: "mb-2 flex items-center justify-between", children: [_jsx("h3", { className: "font-heading text-lg", children: "Link Document to Item" }), _jsx("button", { type: "button", onClick: () => setSelectedDocId(""), className: "rounded border border-slate-300 bg-white px-2 py-1 text-xs", children: "Close" })] }), _jsx("input", { value: linkSearch, onChange: (event) => setLinkSearch(event.target.value), placeholder: "Search item code or name", className: "w-full rounded border border-slate-300 px-3 py-2 text-sm" }), linkSearch.trim().length > 1 ? (_jsxs("div", { className: "mt-2 max-h-60 overflow-y-auto rounded border border-slate-200 bg-white", children: [(itemOptions.data?.data ?? []).map((item) => (_jsxs("button", { type: "button", onClick: () => setSelectedItemId(item.id), className: `block w-full px-3 py-2 text-left text-xs hover:bg-slate-50 ${selectedItemId === item.id ? "bg-blue-50" : ""}`, children: [_jsx("span", { className: "font-mono", children: item.itemCode }), " - ", item.name] }, item.id))), (itemOptions.data?.data?.length ?? 0) === 0 ? _jsx("p", { className: "p-2 text-xs text-slate-500", children: "No items found." }) : null] })) : (_jsx("p", { className: "mt-2 text-xs text-slate-500", children: "Type at least 2 characters to search." })), _jsx("button", { type: "button", onClick: () => linkDocument.mutate(), disabled: !selectedItemId || linkDocument.isPending, className: "mt-3 rounded border border-slate-300 bg-white px-3 py-1 text-xs disabled:opacity-60", children: linkDocument.isPending ? "Linking..." : "Link Item" }), message ? _jsx("p", { className: "mt-2 text-xs text-slate-600", children: message }) : null] })] })) : null] }));
}
//# sourceMappingURL=page.js.map