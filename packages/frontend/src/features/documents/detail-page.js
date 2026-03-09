import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Link, useParams } from "react-router-dom";
import { useState } from "react";
import { EntityIcon } from "@/components/entity-icon";
export function DocumentDetailPage() {
    const params = useParams();
    const documentId = String(params.id ?? "");
    const queryClient = useQueryClient();
    const [search, setSearch] = useState("");
    const [selectedItemId, setSelectedItemId] = useState("");
    const [message, setMessage] = useState("");
    const document = useQuery({
        queryKey: ["document-detail", documentId],
        queryFn: async () => (await api.get(`/documents/${documentId}`)).data,
        enabled: Boolean(documentId)
    });
    const links = useQuery({
        queryKey: ["document-links", documentId],
        queryFn: async () => (await api.get(`/documents/${documentId}/links`)).data,
        enabled: Boolean(documentId)
    });
    const itemOptions = useQuery({
        queryKey: ["document-item-search", search],
        queryFn: async () => (await api.get("/items", { params: { search, pageSize: 10 } })).data,
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
        return _jsx("div", { className: "rounded-lg bg-white p-4", children: "Loading document..." });
    }
    if (!document.data) {
        return _jsx("div", { className: "rounded-lg bg-white p-4", children: "Document not found." });
    }
    return (_jsxs("div", { className: "space-y-4 rounded-xl bg-white p-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "rounded-full bg-slate-100 p-2", children: _jsx(EntityIcon, { kind: "document", size: 20 }) }), _jsxs("div", { children: [_jsx("p", { className: "font-mono text-sm text-slate-500", children: document.data.docNumber }), _jsx("h2", { className: "font-heading text-xl", children: document.data.name }), _jsxs("p", { className: "text-sm text-slate-500", children: [document.data.docType, " \u00B7 ", document.data.status] })] })] }), _jsx(Link, { to: "/documents", className: "rounded border border-slate-300 bg-white px-3 py-1 text-sm", children: "Back to Documents" })] }), _jsxs("div", { className: "rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm", children: [_jsx("p", { className: "mb-2 font-medium", children: "File" }), _jsx("p", { className: "text-slate-700", children: document.data.fileName }), _jsx("a", { href: `/api/documents/${documentId}/download`, className: "mt-2 inline-block rounded border border-slate-300 px-3 py-1 text-xs", children: "Download" })] }), _jsxs("div", { className: "rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm", children: [_jsx("h3", { className: "mb-2 font-medium", children: "Link to Item" }), _jsx("input", { value: search, onChange: (event) => setSearch(event.target.value), placeholder: "Search item code or name", className: "w-full rounded border border-slate-300 px-3 py-2 text-sm" }), search.trim().length > 1 ? (_jsxs("div", { className: "mt-2 max-h-40 overflow-y-auto rounded border border-slate-200 bg-white", children: [(itemOptions.data?.data ?? []).map((item) => (_jsxs("button", { type: "button", onClick: () => setSelectedItemId(item.id), className: `block w-full px-3 py-2 text-left text-xs hover:bg-slate-50 ${selectedItemId === item.id ? "bg-blue-50" : ""}`, children: [_jsx("span", { className: "font-mono", children: item.itemCode }), " - ", item.name] }, item.id))), (itemOptions.data?.data?.length ?? 0) === 0 ? _jsx("p", { className: "p-2 text-xs text-slate-500", children: "No items found." }) : null] })) : null, _jsx("button", { type: "button", onClick: () => linkItem.mutate(), disabled: !selectedItemId || linkItem.isPending, className: "mt-2 rounded border border-slate-300 bg-white px-3 py-1 text-xs disabled:opacity-60", children: linkItem.isPending ? "Linking..." : "Link Item" }), message ? _jsx("p", { className: "mt-2 text-xs text-slate-600", children: message }) : null] }), _jsxs("div", { className: "rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm", children: [_jsx("h3", { className: "mb-2 font-medium", children: "Linked Items" }), links.data?.data?.length ? (_jsx("div", { className: "space-y-2", children: links.data.data
                            .filter((link) => link.entityType === "ITEM")
                            .map((link) => (_jsxs(Link, { to: `/items/${link.entityId}`, className: "block text-primary hover:underline", children: [link.item?.itemCode ?? link.entityId, " - ", link.item?.name ?? ""] }, link.id))) })) : (_jsx("p", { className: "text-xs text-slate-500", children: "No items linked." }))] })] }));
}
//# sourceMappingURL=detail-page.js.map