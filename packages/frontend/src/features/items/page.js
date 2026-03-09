import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from "react";
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Link } from "react-router-dom";
import { ObjectActionsMenu } from "@/components/object-actions-menu";
import { useContainerStore } from "@/store/container.store";
import { FloatingInput, FloatingSelect } from "@/components/floating-field";
import { STANDARD_UOMS } from "@/lib/uom";
import { EntityIcon } from "@/components/entity-icon";
export function ItemsPage() {
    const { selectedContainerId } = useContainerStore();
    const [search, setSearch] = useState("");
    const [activeTab, setActiveTab] = useState("FG");
    const [page, setPage] = useState(1);
    const [selectedItemId, setSelectedItemId] = useState("");
    const queryClient = useQueryClient();
    const [message, setMessage] = useState("");
    const [form, setForm] = useState({
        itemCode: "",
        name: "",
        itemType: "RAW_MATERIAL",
        uom: "kg",
        casNumber: "",
        reachRegistration: "",
        ghsClassification: "",
        flashPoint: "",
        containerId: selectedContainerId,
        customAttributes: {}
    });
    const containers = useQuery({
        queryKey: ["item-container-options"],
        queryFn: async () => (await api.get("/containers")).data
    });
    const config = useQuery({
        queryKey: ["item-config"],
        queryFn: async () => (await api.get("/config")).data
    });
    const uomsQuery = useQuery({
        queryKey: ["config-uoms"],
        queryFn: async () => (await api.get("/config/uoms")).data,
        retry: false
    });
    const itemNumberEntity = form.itemType === "FINISHED_GOOD" ? "ITEM_FINISHED_GOOD" : form.itemType === "PACKAGING" ? "ITEM_PACKAGING" : "ITEM";
    const nextNumber = useQuery({
        queryKey: ["next-item-number", itemNumberEntity],
        queryFn: async () => (await api.get(`/config/next-number/${itemNumberEntity}`)).data
    });
    const itemTypeForTab = activeTab === "FG" ? "FINISHED_GOOD" : activeTab === "PKG" ? "PACKAGING" : activeTab === "RM" ? "RAW_MATERIAL" : "";
    const itemsQuery = useQuery({
        queryKey: ["items", activeTab, search, page, selectedContainerId],
        queryFn: async () => (await api.get("/items", {
            params: {
                search,
                page,
                pageSize: 10,
                ...(itemTypeForTab ? { itemType: itemTypeForTab } : {}),
                ...(selectedContainerId ? { containerId: selectedContainerId } : {})
            }
        })).data
    });
    const formulasQuery = useQuery({
        queryKey: ["recipes", search, page, selectedContainerId],
        queryFn: async () => (await api.get("/formulas", {
            params: { page, pageSize: 10, ...(selectedContainerId ? { containerId: selectedContainerId } : {}) }
        })).data,
        enabled: activeTab === "FORMULA"
    });
    const itemLinks = useQuery({
        queryKey: ["item-links", selectedItemId],
        queryFn: async () => (await api.get(`/items/${selectedItemId}/links`)).data,
        enabled: Boolean(selectedItemId)
    });
    const createItem = useMutation({
        mutationFn: async () => {
            if (!selectedContainerId) {
                throw new Error("Select a container before creating items.");
            }
            const definitions = config.data?.attributeDefinitions.ITEM ?? [];
            const customAttributes = {};
            for (const definition of definitions) {
                const raw = form.customAttributes[definition.key];
                if (definition.type === "boolean") {
                    customAttributes[definition.key] = Boolean(raw);
                    continue;
                }
                const text = String(raw ?? "").trim();
                if (!text) {
                    if (definition.required) {
                        throw new Error(`${definition.label} is required`);
                    }
                    continue;
                }
                if (definition.type === "number") {
                    const parsed = Number(text);
                    if (!Number.isFinite(parsed)) {
                        throw new Error(`${definition.label} must be a valid number`);
                    }
                    customAttributes[definition.key] = parsed;
                }
                else {
                    customAttributes[definition.key] = text;
                }
            }
            await api.post("/items", {
                itemCode: form.itemCode || undefined,
                name: form.name,
                itemType: form.itemType,
                uom: form.uom,
                casNumber: form.casNumber || undefined,
                reachRegistration: form.reachRegistration || undefined,
                ghsClassification: form.ghsClassification || undefined,
                flashPoint: form.flashPoint ? Number(form.flashPoint) : undefined,
                containerId: selectedContainerId,
                customAttributes
            });
        },
        onSuccess: async () => {
            setMessage("Item created successfully.");
            setForm({
                itemCode: "",
                name: "",
                itemType: "RAW_MATERIAL",
                uom: "kg",
                casNumber: "",
                reachRegistration: "",
                ghsClassification: "",
                flashPoint: "",
                containerId: selectedContainerId,
                customAttributes: {}
            });
            await queryClient.invalidateQueries({ queryKey: ["items"] });
            await queryClient.invalidateQueries({ queryKey: ["next-item-number"] });
        },
        onError: (error) => {
            const text = error instanceof Error ? error.message : "Create failed";
            setMessage(text);
        }
    });
    async function runItemAction(item, action) {
        try {
            if (action === "create_release") {
                await api.post("/releases", {
                    title: `Release ${item.itemCode}`,
                    description: `Release request created from ${item.itemCode} - ${item.name}.`,
                    containerId: selectedContainerId || undefined,
                    targetItems: [item.id],
                    targetBoms: [],
                    targetFormulas: [],
                    status: "NEW"
                });
                setMessage(`Release request created for ${item.itemCode}.`);
            }
            else if (action === "create_change") {
                await api.post("/changes", {
                    title: `Change for ${item.itemCode}`,
                    description: `Change request created from ${item.itemCode} - ${item.name}.`,
                    containerId: selectedContainerId || undefined,
                    type: "ECR",
                    priority: "MEDIUM",
                    status: "NEW",
                    affectedItems: [item.itemCode],
                    affectedFormulas: []
                });
                setMessage(`Change request created for ${item.itemCode}.`);
            }
            else if (action === "checkout") {
                await api.post(`/items/${item.id}/check-out`);
                setMessage(`Item ${item.itemCode} checked out.`);
            }
            else if (action === "checkin") {
                await api.post(`/items/${item.id}/check-in`);
                setMessage(`Item ${item.itemCode} checked in.`);
            }
            else if (action === "copy") {
                await api.post(`/items/${item.id}/copy`);
                setMessage(`Copy created for ${item.itemCode}.`);
            }
            else if (action === "revise") {
                await api.post(`/items/${item.id}/revise`);
                setMessage(`Revision created for ${item.itemCode}.`);
            }
            else if (action === "delete") {
                if (!window.confirm(`Delete item ${item.itemCode}?`)) {
                    return;
                }
                await api.delete(`/items/${item.id}`);
                if (selectedItemId === item.id) {
                    setSelectedItemId("");
                }
                setMessage(`Item ${item.itemCode} deleted.`);
            }
            await queryClient.invalidateQueries({ queryKey: ["items"] });
            await queryClient.invalidateQueries({ queryKey: ["next-item-number"] });
        }
        catch (error) {
            setMessage(error instanceof Error ? error.message : "Action failed");
        }
    }
    const itemActions = [
        { key: "create_release", label: "Create Release" },
        { key: "create_change", label: "Create Change" },
        { key: "checkout", label: "Check Out" },
        { key: "checkin", label: "Check In" },
        { key: "revise", label: "Revise" },
        { key: "copy", label: "Copy" },
        { key: "delete", label: "Delete", danger: true }
    ];
    const itemColumnDefs = {
        itemCode: { label: "Code", render: (item) => item.itemCode },
        revisionLabel: { label: "Revision", render: (item) => item.revisionLabel ?? "1.1" },
        name: { label: "Name", render: (item) => item.name },
        itemType: { label: "Type", render: (item) => item.itemType },
        uom: { label: "UOM", render: (item) => item.uom },
        status: { label: "Status", render: (item) => item.status },
        updatedAt: { label: "Updated", render: (item) => new Date(item.updatedAt).toLocaleDateString() }
    };
    const configuredColumns = (config.data?.listColumns?.ITEM ?? ["itemCode", "revisionLabel", "name", "status"]).filter((key) => Boolean(itemColumnDefs[key]));
    const listTitle = activeTab === "FG"
        ? "Finished Goods"
        : activeTab === "PKG"
            ? "Packaging"
            : activeTab === "RM"
                ? "Raw Materials"
                : "Formulations";
    const pagedData = activeTab === "FORMULA" ? formulasQuery.data?.data ?? [] : itemsQuery.data?.data ?? [];
    const total = activeTab === "FORMULA" ? formulasQuery.data?.total ?? 0 : itemsQuery.data?.total ?? 0;
    const pageSize = activeTab === "FORMULA" ? formulasQuery.data?.pageSize ?? 10 : itemsQuery.data?.pageSize ?? 10;
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    useEffect(() => {
        setPage(1);
    }, [activeTab, search, selectedContainerId]);
    return (_jsxs("div", { className: "space-y-4 rounded-xl bg-white p-4", children: [_jsxs("div", { className: "rounded-lg border border-slate-200 bg-slate-50 p-4", children: [_jsx("h3", { className: "mb-1 font-heading text-lg", children: "Create Material" }), _jsxs("p", { className: "mb-3 text-xs text-slate-500", children: ["If Item Code is blank, auto-numbering will use: ", nextNumber.data?.value ?? "Loading..."] }), _jsxs("div", { className: "grid gap-3 md:grid-cols-4", children: [_jsx(FloatingInput, { label: "Item Code", value: form.itemCode, onChange: (event) => setForm({ ...form, itemCode: event.target.value }) }), _jsx(FloatingInput, { label: "Name", value: form.name, onChange: (event) => setForm({ ...form, name: event.target.value }) }), _jsxs(FloatingSelect, { label: "Item Type", value: form.itemType, onChange: (event) => setForm({ ...form, itemType: event.target.value }), children: [_jsx("option", { value: "RAW_MATERIAL", children: "Raw Material" }), _jsx("option", { value: "INTERMEDIATE", children: "Intermediate" }), _jsx("option", { value: "FINISHED_GOOD", children: "Finished Good" }), _jsx("option", { value: "PACKAGING", children: "Packaging" })] }), _jsx(FloatingSelect, { label: "UOM", value: form.uom, onChange: (event) => setForm({ ...form, uom: event.target.value }), children: Array.from(new Set((uomsQuery.data?.data ?? STANDARD_UOMS).map((uom) => uom.category))).map((category) => (_jsx("optgroup", { label: category, children: (uomsQuery.data?.data ?? STANDARD_UOMS).filter((uom) => uom.category === category).map((uom) => (_jsx("option", { value: uom.value, children: uom.label }, uom.value))) }, category))) }), _jsx(FloatingInput, { label: "CAS Number", value: form.casNumber, onChange: (event) => setForm({ ...form, casNumber: event.target.value }) }), _jsx(FloatingInput, { label: "REACH Registration", value: form.reachRegistration, onChange: (event) => setForm({ ...form, reachRegistration: event.target.value }) }), _jsx(FloatingInput, { label: "GHS Classification", value: form.ghsClassification, onChange: (event) => setForm({ ...form, ghsClassification: event.target.value }) }), _jsx(FloatingInput, { label: "Flash Point", value: form.flashPoint, onChange: (event) => setForm({ ...form, flashPoint: event.target.value }) }), _jsxs("div", { className: "rounded border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600", children: ["Active Container: ", containers.data?.data.find((c) => c.id === selectedContainerId)?.code ?? "All Accessible"] }), config.data?.attributeDefinitions.ITEM.map((attribute) => (_jsx("div", { children: attribute.type === "boolean" ? (_jsxs("label", { className: "flex h-full items-center gap-2 rounded border border-slate-300 px-3 py-2 text-sm", children: [_jsx("input", { type: "checkbox", checked: Boolean(form.customAttributes[attribute.key]), onChange: (event) => setForm({
                                                ...form,
                                                customAttributes: { ...form.customAttributes, [attribute.key]: event.target.checked }
                                            }) }), attribute.label] })) : (_jsx(FloatingInput, { label: `${attribute.label}${attribute.required ? " *" : ""}`, value: String(form.customAttributes[attribute.key] ?? ""), onChange: (event) => setForm({
                                        ...form,
                                        customAttributes: {
                                            ...form.customAttributes,
                                            [attribute.key]: event.target.value
                                        }
                                    }) })) }, attribute.key)))] }), _jsx("button", { type: "button", onClick: () => createItem.mutate(), disabled: !form.name || createItem.isPending, className: "mt-3 rounded bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60", children: createItem.isPending ? "Creating..." : "Create Item" }), message ? _jsx("p", { className: "mt-2 text-sm text-slate-700", children: message }) : null] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h2", { className: "font-heading text-xl", children: "Materials & Recipes" }), _jsx("input", { value: search, onChange: (event) => setSearch(event.target.value), placeholder: "Search code or name", className: "w-72 rounded-md border border-slate-300 px-3 py-2 text-sm" })] }), _jsx("div", { className: "flex gap-2", children: [
                    ["FG", "Finished Goods"],
                    ["FORMULA", "Formulations"],
                    ["RM", "Raw Materials"],
                    ["PKG", "Packaging"]
                ].map(([key, label]) => (_jsx("button", { type: "button", onClick: () => setActiveTab(key), className: `rounded px-3 py-2 text-sm ${activeTab === key ? "bg-primary text-white" : "border border-slate-300 bg-white text-slate-700"}`, children: label }, key))) }), (activeTab === "FORMULA" ? formulasQuery.isLoading : itemsQuery.isLoading) ? (_jsxs("p", { children: ["Loading ", listTitle.toLowerCase(), "..."] })) : (_jsxs("table", { className: "w-full text-left text-sm", children: [_jsx("thead", { children: _jsx("tr", { className: "border-b border-slate-200 text-slate-500", children: activeTab === "FORMULA" ? (_jsxs(_Fragment, { children: [_jsx("th", { className: "w-10 py-2", children: "\u00A0" }), _jsx("th", { className: "py-2", children: "Code" }), _jsx("th", { className: "py-2", children: "Name" }), _jsx("th", { className: "py-2", children: "Type" }), _jsx("th", { className: "py-2", children: "Output" }), _jsx("th", { className: "py-2", children: "Status" }), _jsx("th", { className: "py-2", children: "Actions" })] })) : (_jsxs(_Fragment, { children: [_jsx("th", { className: "w-10 py-2", children: "\u00A0" }), configuredColumns.map((columnKey) => (_jsx("th", { className: "py-2", children: itemColumnDefs[columnKey]?.label ?? columnKey }, columnKey))), _jsx("th", { className: "py-2", children: "Actions" })] })) }) }), _jsx("tbody", { children: activeTab === "FORMULA"
                            ? pagedData.map((formula) => (_jsxs("tr", { className: "border-b border-slate-100", children: [_jsx("td", { className: "py-2 text-slate-500", children: _jsx(EntityIcon, { kind: "formula" }) }), _jsx("td", { className: "py-2 font-mono", children: formula.formulaCode }), _jsx("td", { className: "py-2", children: formula.name }), _jsx("td", { className: "py-2", children: formula.recipeType === "FINISHED_GOOD_RECIPE" ? "Finished Good" : "Formula" }), _jsx("td", { className: "py-2", children: formula.recipeType === "FINISHED_GOOD_RECIPE"
                                            ? `${formula.outputItem?.itemCode ?? "N/A"}`
                                            : "Formula" }), _jsx("td", { className: "py-2", children: formula.status }), _jsx("td", { className: "py-2", children: _jsx(Link, { to: `/formulas/${formula.id}`, className: "rounded border border-slate-300 px-2 py-1 text-xs", children: "Open" }) })] }, formula.id)))
                            : pagedData.map((item) => (_jsxs("tr", { className: "border-b border-slate-100", children: [_jsx("td", { className: "py-2 text-slate-500", children: _jsx(EntityIcon, { kind: "item", variant: item.itemType }) }), configuredColumns.map((columnKey) => (_jsx("td", { className: `py-2 ${columnKey === "itemCode" ? "font-mono" : ""}`, children: itemColumnDefs[columnKey]?.render(item) ?? "" }, `${item.id}-${columnKey}`))), _jsxs("td", { className: "py-2", children: [_jsx(Link, { to: `/items/${item.id}`, className: "rounded border border-slate-300 px-2 py-1 text-xs", children: "Open" }), _jsx("button", { type: "button", onClick: () => setSelectedItemId(item.id), className: "ml-2 rounded border border-slate-300 px-2 py-1 text-xs", children: "Links" }), _jsx("span", { className: "ml-2", children: _jsx(ObjectActionsMenu, { onAction: (action) => void runItemAction(item, action), actions: itemActions }) })] })] }, item.id))) })] })), _jsxs("div", { className: "flex items-center justify-between text-sm text-slate-600", children: [_jsxs("p", { children: [listTitle, ": ", total, " records"] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { type: "button", disabled: page <= 1, onClick: () => setPage((p) => Math.max(1, p - 1)), className: "rounded border border-slate-300 px-2 py-1 disabled:opacity-60", children: "Prev" }), _jsxs("span", { children: ["Page ", page, " / ", pageCount] }), _jsx("button", { type: "button", disabled: page >= pageCount, onClick: () => setPage((p) => Math.min(pageCount, p + 1)), className: "rounded border border-slate-300 px-2 py-1 disabled:opacity-60", children: "Next" })] })] }), selectedItemId ? (_jsxs("div", { className: "fixed inset-0 z-40 flex", children: [_jsx("button", { type: "button", className: "h-full flex-1 bg-black/30", onClick: () => setSelectedItemId(""), "aria-label": "Close panel" }), _jsxs("div", { className: "h-full w-full max-w-xl overflow-y-auto border-l border-slate-200 bg-white p-4 shadow-xl", children: [_jsxs("div", { className: "mb-2 flex items-center justify-between", children: [_jsx("h3", { className: "font-heading text-lg", children: "Item Linkage" }), _jsx("button", { type: "button", onClick: () => setSelectedItemId(""), className: "rounded border border-slate-300 bg-white px-2 py-1 text-xs", children: "Close" })] }), itemLinks.isLoading ? (_jsx("p", { className: "text-sm text-slate-500", children: "Loading linkage..." })) : (_jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "rounded border border-slate-200 bg-slate-50 p-3 text-sm", children: [_jsxs("p", { className: "mb-2 font-medium", children: ["Used In Formulations (", itemLinks.data?.formulaUsages.length ?? 0, ")"] }), _jsx("div", { className: "space-y-1 text-slate-600", children: itemLinks.data?.formulaUsages.map((usage) => (_jsxs(Link, { to: `/formulas/${usage.formula.id}`, className: "block text-primary hover:underline", children: [usage.formula.formulaCode, " v", usage.formula.version, " - ", usage.formula.name, " (", usage.quantity, " ", usage.uom, ")"] }, usage.id))) })] }), _jsxs("div", { className: "rounded border border-slate-200 bg-slate-50 p-3 text-sm", children: [_jsxs("p", { className: "mb-2 font-medium", children: ["Used In BOMs (", itemLinks.data?.bomUsages.length ?? 0, ")"] }), _jsx("div", { className: "space-y-1 text-slate-600", children: itemLinks.data?.bomUsages.map((usage) => (_jsxs(Link, { to: `/bom/${usage.bom.id}`, className: "block text-primary hover:underline", children: [usage.bom.bomCode, " v", usage.bom.version, " (", usage.bom.type, ") - ", usage.quantity, " ", usage.uom] }, usage.id))) })] }), _jsxs("div", { className: "rounded border border-slate-200 bg-slate-50 p-3 text-sm", children: [_jsxs("p", { className: "mb-2 font-medium", children: ["Specifications (", itemLinks.data?.specifications.length ?? 0, ")"] }), _jsx("div", { className: "space-y-1 text-slate-600", children: itemLinks.data?.specifications.map((spec) => (_jsxs("p", { children: [spec.specType, ": ", spec.attribute, " [", spec.minValue ?? spec.value ?? "N/A", " - ", spec.maxValue ?? "N/A", " ", spec.uom ?? "", "]"] }, spec.id))) })] }), _jsxs("div", { className: "rounded border border-slate-200 bg-slate-50 p-3 text-sm", children: [_jsx("p", { className: "mb-2 font-medium", children: "Changes / Workflows" }), _jsxs("div", { className: "space-y-1 text-slate-600", children: [itemLinks.data?.relatedChanges.map((change) => (_jsxs(Link, { to: `/changes/${change.id}`, className: "block text-primary hover:underline", children: [change.crNumber, ": ", change.title, " (", change.status, ")"] }, change.id))), itemLinks.data?.workflows.map((workflow) => (_jsxs("p", { children: ["Workflow State: ", workflow.currentState] }, workflow.id)))] })] })] }))] })] })) : null] }));
}
//# sourceMappingURL=page.js.map