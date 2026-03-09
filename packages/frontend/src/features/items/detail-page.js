import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ObjectActionsMenu } from "@/components/object-actions-menu";
import { useContainerStore } from "@/store/container.store";
import { FloatingInput, FloatingSelect } from "@/components/floating-field";
import { STANDARD_UOMS } from "@/lib/uom";
import { EntityIcon } from "@/components/entity-icon";
export function ItemDetailPage() {
    const params = useParams();
    const itemId = String(params.id ?? "");
    const [activeTab, setActiveTab] = useState("details");
    const [message, setMessage] = useState("");
    const { selectedContainerId } = useContainerStore();
    const queryClient = useQueryClient();
    const [docSearch, setDocSearch] = useState("");
    const [isEditingItem, setIsEditingItem] = useState(false);
    const [isEditingSpecs, setIsEditingSpecs] = useState(false);
    const [specRows, setSpecRows] = useState([]);
    const [itemDraft, setItemDraft] = useState({
        name: "",
        description: "",
        uom: "kg",
        density: "",
        viscosity: "",
        pH: "",
        flashPoint: "",
        casNumber: "",
        reachRegistration: "",
        ghsClassification: "",
        boilingPoint: "",
        customAttributes: {}
    });
    const item = useQuery({
        queryKey: ["item-detail", itemId],
        queryFn: async () => (await api.get(`/items/${itemId}`)).data,
        enabled: Boolean(itemId)
    });
    const links = useQuery({
        queryKey: ["item-links-detail", itemId],
        queryFn: async () => (await api.get(`/items/${itemId}/links`)).data,
        enabled: Boolean(itemId)
    });
    const history = useQuery({
        queryKey: ["item-history", itemId],
        queryFn: async () => (await api.get(`/items/${itemId}/history`)).data,
        enabled: Boolean(itemId)
    });
    const config = useQuery({
        queryKey: ["item-config"],
        queryFn: async () => (await api.get("/config")).data,
        retry: false
    });
    const uomsQuery = useQuery({
        queryKey: ["config-uoms"],
        queryFn: async () => (await api.get("/config/uoms")).data,
        retry: false
    });
    const specTemplates = useQuery({
        queryKey: ["spec-templates", item.data?.industryType ?? "CHEMICAL"],
        queryFn: async () => (await api.get(`/specifications/templates/${item.data?.industryType ?? "CHEMICAL"}`)).data
    });
    const documents = useQuery({
        queryKey: ["item-documents", itemId],
        queryFn: async () => (await api.get("/documents", {
            params: { entityType: "ITEM", entityId: itemId, page: 1, pageSize: 20 }
        })).data,
        enabled: Boolean(itemId)
    });
    const documentSearch = useQuery({
        queryKey: ["document-search", docSearch, selectedContainerId],
        queryFn: async () => (await api.get("/documents", {
            params: {
                search: docSearch,
                page: 1,
                pageSize: 6,
                ...(selectedContainerId ? { containerId: selectedContainerId } : {})
            }
        })).data,
        enabled: docSearch.trim().length > 1
    });
    const linkDocument = useMutation({
        mutationFn: async (documentId) => {
            await api.post(`/documents/${documentId}/link`, {
                entityType: "ITEM",
                entityId: itemId
            });
        },
        onSuccess: async () => {
            setMessage("Document linked to item.");
            setDocSearch("");
            await queryClient.invalidateQueries({ queryKey: ["item-documents", itemId] });
        },
        onError: (error) => setMessage(error instanceof Error ? error.message : "Failed to link document.")
    });
    const updateItem = useMutation({
        mutationFn: async () => {
            const payload = {
                name: itemDraft.name.trim(),
                description: itemDraft.description.trim() || null,
                uom: itemDraft.uom
            };
            if (itemDraft.density)
                payload.density = Number(itemDraft.density);
            if (itemDraft.viscosity)
                payload.viscosity = Number(itemDraft.viscosity);
            if (itemDraft.pH)
                payload.pH = Number(itemDraft.pH);
            if (itemDraft.flashPoint)
                payload.flashPoint = Number(itemDraft.flashPoint);
            payload.casNumber = itemDraft.casNumber.trim();
            payload.reachRegistration = itemDraft.reachRegistration.trim();
            payload.ghsClassification = itemDraft.ghsClassification.trim();
            if (itemDraft.boilingPoint)
                payload.boilingPoint = Number(itemDraft.boilingPoint);
            payload.customAttributes = itemDraft.customAttributes;
            await api.put(`/items/${itemId}`, payload);
        },
        onSuccess: async () => {
            setIsEditingItem(false);
            setMessage("Item updated.");
            await queryClient.invalidateQueries({ queryKey: ["item-detail", itemId] });
        },
        onError: (error) => setMessage(error instanceof Error ? error.message : "Failed to update item.")
    });
    const saveSpecs = useMutation({
        mutationFn: async () => {
            await api.post("/specifications/bulk-upsert", {
                targetType: "item",
                targetId: itemId,
                replaceExisting: true,
                specs: specRows.map((row) => ({
                    id: row.id,
                    specType: row.specType,
                    attribute: row.attribute,
                    value: row.value?.trim() || undefined,
                    minValue: row.minValue ? Number(row.minValue) : undefined,
                    maxValue: row.maxValue ? Number(row.maxValue) : undefined,
                    uom: row.uom?.trim() || undefined,
                    testMethod: row.testMethod?.trim() || undefined
                }))
            });
        },
        onSuccess: async () => {
            setIsEditingSpecs(false);
            setMessage("Specifications saved.");
            await queryClient.invalidateQueries({ queryKey: ["item-links-detail", itemId] });
        },
        onError: (error) => setMessage(error instanceof Error ? error.message : "Failed to save specifications.")
    });
    const latestId = useMemo(() => history.data?.history?.[0]?.id, [history.data?.history]);
    const isOldVersion = Boolean(latestId && latestId !== itemId);
    const attributes = item.data?.attributes && typeof item.data.attributes === "object" && !Array.isArray(item.data.attributes)
        ? item.data.attributes
        : {};
    const customAttributes = attributes.customAttributes && typeof attributes.customAttributes === "object" && !Array.isArray(attributes.customAttributes)
        ? attributes.customAttributes
        : {};
    const attributeDefinitions = config.data?.attributeDefinitions?.ITEM ?? [];
    const regulatoryFlags = item.data?.regulatoryFlags && typeof item.data.regulatoryFlags === "object" && !Array.isArray(item.data.regulatoryFlags)
        ? item.data.regulatoryFlags
        : {};
    const activeRegulatoryFlags = Object.entries(regulatoryFlags)
        .filter(([, value]) => Boolean(value))
        .map(([key]) => key);
    const formatAttributeValue = (value) => {
        if (value === null || value === undefined || value === "") {
            return "—";
        }
        if (typeof value === "boolean") {
            return value ? "Yes" : "No";
        }
        return String(value);
    };
    const densityUnit = "g/cm3";
    const viscosityUnit = "cP";
    const phUnit = "pH";
    const flashPointUnit = "C";
    const canCheckout = item.data?.status === "DRAFT";
    const canEdit = item.data?.status === "UNDER_CHANGE";
    useEffect(() => {
        if (!item.data || isEditingItem) {
            return;
        }
        setItemDraft({
            name: item.data.name ?? "",
            description: item.data.description ?? "",
            uom: item.data.uom ?? "kg",
            density: item.data.density ? String(item.data.density) : "",
            viscosity: item.data.viscosity ? String(item.data.viscosity) : "",
            pH: item.data.pH ? String(item.data.pH) : "",
            flashPoint: item.data.flashPoint ? String(item.data.flashPoint) : "",
            casNumber: formatAttributeValue(attributes.casNumber) === "—" ? "" : String(attributes.casNumber ?? ""),
            reachRegistration: formatAttributeValue(attributes.reachRegistration) === "—" ? "" : String(attributes.reachRegistration ?? ""),
            ghsClassification: formatAttributeValue(attributes.ghsClassification) === "—" ? "" : String(attributes.ghsClassification ?? ""),
            boilingPoint: attributes.boilingPoint ? String(attributes.boilingPoint) : "",
            customAttributes: Object.fromEntries(attributeDefinitions.map((definition) => [definition.key, String(customAttributes[definition.key] ?? "")]))
        });
    }, [item.data, isEditingItem, attributes, attributeDefinitions, customAttributes]);
    if (item.isLoading || links.isLoading) {
        return _jsx("div", { className: "rounded-lg bg-white p-4", children: "Loading item details..." });
    }
    const itemActions = [
        { key: "create_release", label: "Create Release" },
        { key: "create_change", label: "Create Change" },
        { key: "checkout", label: "Check Out", disabled: !canCheckout },
        { key: "checkin", label: "Check In", disabled: !canEdit },
        { key: "revise", label: "Revise" },
        { key: "copy", label: "Copy" },
        { key: "delete", label: "Delete", danger: true }
    ];
    async function runItemAction(action) {
        const current = item.data;
        if (!current) {
            return;
        }
        try {
            if (action === "create_release") {
                await api.post("/releases", {
                    title: `Release ${current.itemCode}`,
                    description: `Release request created from ${current.itemCode} - ${current.name}.`,
                    containerId: selectedContainerId || undefined,
                    targetItems: [current.id],
                    targetBoms: [],
                    targetFormulas: [],
                    status: "NEW"
                });
                setMessage(`Release request created for ${current.itemCode}.`);
            }
            else if (action === "create_change") {
                await api.post("/changes", {
                    title: `Change for ${current.itemCode}`,
                    description: `Change request created from ${current.itemCode} - ${current.name}.`,
                    containerId: selectedContainerId || undefined,
                    type: "ECR",
                    priority: "MEDIUM",
                    status: "NEW",
                    affectedItems: [current.itemCode],
                    affectedFormulas: []
                });
                setMessage(`Change request created for ${current.itemCode}.`);
            }
            else if (action === "checkout") {
                await api.post(`/items/${current.id}/check-out`);
                setMessage(`Item ${current.itemCode} checked out.`);
                await queryClient.invalidateQueries({ queryKey: ["item-detail", itemId] });
            }
            else if (action === "checkin") {
                await api.post(`/items/${current.id}/check-in`);
                setMessage(`Item ${current.itemCode} checked in.`);
                await queryClient.invalidateQueries({ queryKey: ["item-detail", itemId] });
            }
            else if (action === "copy") {
                await api.post(`/items/${current.id}/copy`);
                setMessage(`Copy created for ${current.itemCode}.`);
            }
            else if (action === "revise") {
                await api.post(`/items/${current.id}/revise`);
                setMessage(`Revision created for ${current.itemCode}.`);
            }
            else if (action === "delete") {
                if (!window.confirm(`Delete item ${current.itemCode}?`)) {
                    return;
                }
                await api.delete(`/items/${current.id}`);
                setMessage(`Item ${current.itemCode} deleted.`);
            }
        }
        catch (error) {
            setMessage(error instanceof Error ? error.message : "Action failed");
        }
    }
    return (_jsxs("div", { className: "space-y-4 rounded-xl bg-white p-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "rounded-full bg-slate-100 p-2", children: item.data ? _jsx(EntityIcon, { kind: "item", variant: item.data.itemType, size: 20 }) : null }), _jsxs("div", { children: [_jsx("p", { className: "font-mono text-sm text-slate-500", children: item.data?.itemCode }), _jsx("h2", { className: "font-heading text-xl", children: item.data?.name }), _jsxs("p", { className: "text-sm text-slate-500", children: [item.data?.itemType, " | ", item.data?.uom, " | ", item.data?.status] })] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(ObjectActionsMenu, { onAction: (action) => void runItemAction(action), actions: itemActions }), _jsx(Link, { to: "/items", className: "rounded border border-slate-300 bg-white px-3 py-1 text-sm", children: "Back to Items" })] })] }), message ? _jsx("p", { className: "rounded border border-slate-200 bg-slate-50 p-2 text-sm text-slate-700", children: message }) : null, _jsxs("div", { className: "flex items-center gap-2 border-b border-slate-200 text-sm", children: [_jsx("button", { type: "button", onClick: () => setActiveTab("details"), className: `px-3 py-2 ${activeTab === "details" ? "border-b-2 border-primary font-medium text-primary" : "text-slate-500"}`, children: "Details" }), _jsx("button", { type: "button", onClick: () => setActiveTab("specs"), className: `px-3 py-2 ${activeTab === "specs" ? "border-b-2 border-primary font-medium text-primary" : "text-slate-500"}`, children: "Specifications" }), _jsx("button", { type: "button", onClick: () => setActiveTab("workflow"), className: `px-3 py-2 ${activeTab === "workflow" ? "border-b-2 border-primary font-medium text-primary" : "text-slate-500"}`, children: "Workflow" }), _jsx("button", { type: "button", onClick: () => setActiveTab("history"), className: `px-3 py-2 ${activeTab === "history" ? "border-b-2 border-primary font-medium text-primary" : "text-slate-500"}`, children: "History" })] }), isOldVersion ? (_jsx("div", { className: "rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700", children: "You are viewing an old version of this item. Use the History tab to navigate to the latest version." })) : null, activeTab === "details" ? (_jsxs("div", { className: "space-y-3", children: [isEditingItem ? (_jsxs("div", { className: "rounded border border-slate-200 bg-slate-50 p-3 text-sm", children: [_jsxs("div", { className: "mb-3 flex items-center justify-between", children: [_jsx("p", { className: "font-medium", children: "Edit Attributes" }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { type: "button", onClick: () => updateItem.mutate(), disabled: updateItem.isPending, className: "rounded bg-primary px-3 py-1 text-xs font-medium text-white disabled:opacity-60", children: updateItem.isPending ? "Saving..." : "Save" }), _jsx("button", { type: "button", onClick: () => setIsEditingItem(false), className: "rounded border border-slate-300 px-3 py-1 text-xs", children: "Cancel" })] })] }), _jsxs("div", { className: "grid gap-3 md:grid-cols-2", children: [_jsx(FloatingInput, { label: "Name", value: itemDraft.name, onChange: (event) => setItemDraft({ ...itemDraft, name: event.target.value }) }), _jsx(FloatingInput, { label: "Description", value: itemDraft.description, onChange: (event) => setItemDraft({ ...itemDraft, description: event.target.value }) }), _jsx(FloatingSelect, { label: "UOM", value: itemDraft.uom, onChange: (event) => setItemDraft({ ...itemDraft, uom: event.target.value }), children: (uomsQuery.data?.data ?? STANDARD_UOMS).map((uom) => (_jsx("option", { value: uom.value, children: uom.label }, uom.value))) }), _jsx(FloatingInput, { label: "Density (g/cm3)", value: itemDraft.density, onChange: (event) => setItemDraft({ ...itemDraft, density: event.target.value }) }), _jsx(FloatingInput, { label: "Viscosity (cP)", value: itemDraft.viscosity, onChange: (event) => setItemDraft({ ...itemDraft, viscosity: event.target.value }) }), _jsx(FloatingInput, { label: "pH", value: itemDraft.pH, onChange: (event) => setItemDraft({ ...itemDraft, pH: event.target.value }) }), _jsx(FloatingInput, { label: "Flash Point (C)", value: itemDraft.flashPoint, onChange: (event) => setItemDraft({ ...itemDraft, flashPoint: event.target.value }) }), _jsx(FloatingInput, { label: "CAS Number", value: itemDraft.casNumber, onChange: (event) => setItemDraft({ ...itemDraft, casNumber: event.target.value }) }), _jsx(FloatingInput, { label: "REACH Registration", value: itemDraft.reachRegistration, onChange: (event) => setItemDraft({ ...itemDraft, reachRegistration: event.target.value }) }), _jsx(FloatingInput, { label: "GHS Classification", value: itemDraft.ghsClassification, onChange: (event) => setItemDraft({ ...itemDraft, ghsClassification: event.target.value }) }), _jsx(FloatingInput, { label: "Boiling Point (C)", value: itemDraft.boilingPoint, onChange: (event) => setItemDraft({ ...itemDraft, boilingPoint: event.target.value }) })] }), attributeDefinitions.length ? (_jsxs("div", { className: "mt-4", children: [_jsx("p", { className: "mb-2 text-xs font-medium uppercase text-slate-500", children: "Custom Attributes" }), _jsx("div", { className: "grid gap-3 md:grid-cols-2", children: attributeDefinitions.map((definition) => (_jsx(FloatingInput, { label: definition.label, value: itemDraft.customAttributes[definition.key] ?? "", onChange: (event) => setItemDraft({
                                                ...itemDraft,
                                                customAttributes: { ...itemDraft.customAttributes, [definition.key]: event.target.value }
                                            }) }, definition.key))) })] })) : null] })) : (_jsxs("div", { className: "rounded border border-slate-200 bg-slate-50 p-3 text-sm", children: [_jsxs("div", { className: "mb-2 flex items-center justify-between", children: [_jsx("p", { className: "font-medium", children: "Attributes" }), _jsx("button", { type: "button", onClick: () => setIsEditingItem(true), disabled: !canEdit, className: "rounded border border-slate-300 bg-white px-3 py-1 text-xs disabled:opacity-60", children: "Edit Details" })] }), _jsxs("div", { className: "grid gap-2 md:grid-cols-2", children: [_jsxs("div", { className: "rounded bg-white px-2 py-1", children: [_jsx("span", { className: "text-xs text-slate-500", children: "Description" }), _jsx("p", { className: "text-sm text-slate-700", children: formatAttributeValue(item.data?.description) })] }), _jsxs("div", { className: "rounded bg-white px-2 py-1", children: [_jsx("span", { className: "text-xs text-slate-500", children: "Regulatory Flags" }), _jsx("p", { className: "text-sm text-slate-700", children: activeRegulatoryFlags.length ? activeRegulatoryFlags.join(", ") : "None" })] }), _jsxs("div", { className: "rounded bg-white px-2 py-1", children: [_jsx("span", { className: "text-xs text-slate-500", children: "Density" }), _jsxs("p", { className: "text-sm text-slate-700", children: [formatAttributeValue(item.data?.density), " ", item.data?.density ? densityUnit : ""] })] }), _jsxs("div", { className: "rounded bg-white px-2 py-1", children: [_jsx("span", { className: "text-xs text-slate-500", children: "Viscosity" }), _jsxs("p", { className: "text-sm text-slate-700", children: [formatAttributeValue(item.data?.viscosity), " ", item.data?.viscosity ? viscosityUnit : ""] })] }), _jsxs("div", { className: "rounded bg-white px-2 py-1", children: [_jsx("span", { className: "text-xs text-slate-500", children: "pH" }), _jsxs("p", { className: "text-sm text-slate-700", children: [formatAttributeValue(item.data?.pH), " ", item.data?.pH ? phUnit : ""] })] }), _jsxs("div", { className: "rounded bg-white px-2 py-1", children: [_jsx("span", { className: "text-xs text-slate-500", children: "Flash Point" }), _jsxs("p", { className: "text-sm text-slate-700", children: [formatAttributeValue(item.data?.flashPoint), " ", item.data?.flashPoint ? flashPointUnit : ""] })] }), _jsxs("div", { className: "rounded bg-white px-2 py-1", children: [_jsx("span", { className: "text-xs text-slate-500", children: "CAS Number" }), _jsx("p", { className: "text-sm text-slate-700", children: formatAttributeValue(attributes.casNumber) })] }), _jsxs("div", { className: "rounded bg-white px-2 py-1", children: [_jsx("span", { className: "text-xs text-slate-500", children: "REACH Registration" }), _jsx("p", { className: "text-sm text-slate-700", children: formatAttributeValue(attributes.reachRegistration) })] }), _jsxs("div", { className: "rounded bg-white px-2 py-1", children: [_jsx("span", { className: "text-xs text-slate-500", children: "GHS Classification" }), _jsx("p", { className: "text-sm text-slate-700", children: formatAttributeValue(attributes.ghsClassification) })] }), _jsxs("div", { className: "rounded bg-white px-2 py-1", children: [_jsx("span", { className: "text-xs text-slate-500", children: "Boiling Point" }), _jsx("p", { className: "text-sm text-slate-700", children: formatAttributeValue(attributes.boilingPoint) })] })] }), attributeDefinitions.length || Object.keys(customAttributes).length ? (_jsxs("div", { className: "mt-3", children: [_jsx("p", { className: "mb-2 text-xs font-medium uppercase text-slate-500", children: "Custom Attributes" }), _jsx("div", { className: "grid gap-2 md:grid-cols-2", children: (attributeDefinitions.length ? attributeDefinitions : Object.keys(customAttributes).map((key) => ({ key, label: key, type: "text", required: false }))).map((definition) => (_jsxs("div", { className: "rounded bg-white px-2 py-1", children: [_jsx("span", { className: "text-xs text-slate-500", children: definition.label }), _jsx("p", { className: "text-sm text-slate-700", children: formatAttributeValue(customAttributes[definition.key]) })] }, definition.key))) })] })) : null] })), _jsxs("div", { className: "grid gap-3 md:grid-cols-2", children: [_jsxs("div", { className: "rounded border border-slate-200 bg-slate-50 p-3 text-sm", children: [_jsx("p", { className: "mb-1 font-medium", children: "Used In Formulas" }), links.data?.formulaUsages.map((usage) => (_jsxs(Link, { to: `/formulas/${usage.formula.id}`, className: "block text-primary hover:underline", children: [usage.formula.formulaCode, " v", usage.formula.version, " - ", usage.formula.name] }, usage.id)))] }), _jsxs("div", { className: "rounded border border-slate-200 bg-slate-50 p-3 text-sm", children: [_jsx("p", { className: "mb-1 font-medium", children: "Used In BOMs" }), links.data?.bomUsages.map((usage) => (_jsxs(Link, { to: `/bom/${usage.bom.id}`, className: "block text-primary hover:underline", children: [usage.bom.bomCode, " v", usage.bom.version, " (", usage.bom.type, ")"] }, usage.id)))] })] }), _jsxs("div", { className: "rounded border border-slate-200 bg-slate-50 p-3 text-sm", children: [_jsxs("div", { className: "mb-2 flex items-center justify-between", children: [_jsx("p", { className: "font-medium", children: "Related Documents" }), _jsx(Link, { to: "/documents", className: "text-xs text-primary hover:underline", children: "Manage documents" })] }), _jsxs("div", { className: "mb-3 rounded border border-slate-200 bg-white p-2", children: [_jsx("label", { className: "text-[11px] font-medium uppercase text-slate-500", children: "Link Document" }), _jsx("input", { value: docSearch, onChange: (event) => setDocSearch(event.target.value), placeholder: "Search documents by name or number", className: "mt-1 w-full rounded border border-slate-200 px-2 py-1 text-sm" }), docSearch.trim().length > 1 ? (_jsx("div", { className: "mt-2 space-y-1", children: documentSearch.isLoading ? (_jsx("p", { className: "text-xs text-slate-500", children: "Searching documents..." })) : documentSearch.data?.data?.length ? (documentSearch.data.data.map((doc) => (_jsxs("button", { type: "button", onClick: () => linkDocument.mutate(doc.id), className: "flex w-full items-center justify-between rounded border border-slate-200 px-2 py-1 text-left text-xs hover:border-primary", children: [_jsxs("span", { children: [_jsx("span", { className: "font-mono", children: doc.docNumber }), " ", doc.name] }), _jsxs("span", { className: "text-[10px] uppercase text-slate-500", children: [doc.docType, " \u2022 ", doc.status] })] }, doc.id)))) : (_jsx("p", { className: "text-xs text-slate-500", children: "No documents found." })) })) : (_jsx("p", { className: "mt-1 text-xs text-slate-500", children: "Type at least 2 characters to search." }))] }), documents.isLoading ? (_jsx("p", { className: "text-slate-500", children: "Loading documents..." })) : documents.data?.data?.length ? (_jsx("div", { className: "overflow-hidden rounded border border-slate-200 bg-white", children: _jsxs("table", { className: "w-full text-left text-xs", children: [_jsx("thead", { className: "bg-slate-100 text-[11px] uppercase text-slate-500", children: _jsxs("tr", { children: [_jsx("th", { className: "px-3 py-2", children: "Document" }), _jsx("th", { className: "px-3 py-2", children: "Type" }), _jsx("th", { className: "px-3 py-2", children: "Status" }), _jsx("th", { className: "px-3 py-2", children: "File" }), _jsx("th", { className: "px-3 py-2", children: "Created" })] }) }), _jsx("tbody", { children: documents.data.data.map((doc) => (_jsxs("tr", { className: "border-t border-slate-100", children: [_jsxs("td", { className: "px-3 py-2", children: [_jsx(Link, { to: `/documents/${doc.id}`, className: "text-primary hover:underline", children: doc.docNumber }), _jsx("div", { className: "text-[11px] text-slate-500", children: doc.name })] }), _jsx("td", { className: "px-3 py-2", children: doc.docType }), _jsx("td", { className: "px-3 py-2", children: doc.status }), _jsx("td", { className: "px-3 py-2", children: _jsx("a", { href: `/api/documents/${doc.id}/download`, className: "text-primary hover:underline", children: doc.fileName }) }), _jsx("td", { className: "px-3 py-2", children: new Date(doc.createdAt).toLocaleDateString() })] }, doc.id))) })] }) })) : (_jsx("p", { className: "text-slate-500", children: "No documents linked to this item." }))] })] })) : activeTab === "specs" ? (_jsxs("div", { className: "rounded border border-slate-200 bg-slate-50 p-3 text-sm", children: [_jsxs("div", { className: "mb-2 flex items-center justify-between", children: [_jsx("p", { className: "font-medium", children: "Specifications" }), !isEditingSpecs ? (_jsx("button", { type: "button", onClick: () => {
                                    const existing = links.data?.specifications ?? [];
                                    setSpecRows(existing.map((spec) => ({
                                        clientId: spec.id,
                                        id: spec.id,
                                        specType: spec.specType,
                                        attribute: spec.attribute,
                                        value: spec.value ?? "",
                                        minValue: spec.minValue !== null && spec.minValue !== undefined ? String(spec.minValue) : "",
                                        maxValue: spec.maxValue !== null && spec.maxValue !== undefined ? String(spec.maxValue) : "",
                                        uom: spec.uom ?? "",
                                        testMethod: spec.testMethod ?? ""
                                    })));
                                    setIsEditingSpecs(true);
                                }, disabled: !canEdit, className: "rounded border border-slate-300 bg-white px-3 py-1 text-xs disabled:opacity-60", children: "Edit Specs" })) : (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { type: "button", onClick: () => saveSpecs.mutate(), disabled: saveSpecs.isPending, className: "rounded bg-primary px-3 py-1 text-xs font-medium text-white disabled:opacity-60", children: saveSpecs.isPending ? "Saving..." : "Save" }), _jsx("button", { type: "button", onClick: () => setIsEditingSpecs(false), className: "rounded border border-slate-300 px-3 py-1 text-xs", children: "Cancel" })] }))] }), isEditingSpecs ? (_jsxs("div", { className: "space-y-3", children: [_jsx("div", { className: "overflow-x-auto rounded border border-slate-200 bg-white", children: _jsxs("table", { className: "w-full min-w-[860px] text-left text-xs", children: [_jsx("thead", { className: "bg-slate-100 text-[11px] uppercase text-slate-500", children: _jsxs("tr", { children: [_jsx("th", { className: "px-2 py-2", children: "Type" }), _jsx("th", { className: "px-2 py-2", children: "Attribute" }), _jsx("th", { className: "px-2 py-2", children: "Value" }), _jsx("th", { className: "px-2 py-2", children: "Min" }), _jsx("th", { className: "px-2 py-2", children: "Max" }), _jsx("th", { className: "px-2 py-2", children: "UOM" }), _jsx("th", { className: "px-2 py-2", children: "Test Method" }), _jsx("th", { className: "px-2 py-2", children: "Action" })] }) }), _jsx("tbody", { children: specRows.map((row) => {
                                                const template = (specTemplates.data?.data ?? []).find((entry) => entry.specType === row.specType);
                                                const attributes = template?.attributes ?? [];
                                                return (_jsxs("tr", { className: "border-t border-slate-100", children: [_jsx("td", { className: "px-2 py-2", children: _jsx("select", { value: row.specType, onChange: (event) => {
                                                                    const nextSpecType = event.target.value;
                                                                    const nextTemplate = (specTemplates.data?.data ?? []).find((entry) => entry.specType === nextSpecType);
                                                                    const nextAttribute = nextTemplate?.attributes[0];
                                                                    setSpecRows((prev) => prev.map((line) => line.clientId === row.clientId
                                                                        ? {
                                                                            ...line,
                                                                            specType: nextSpecType,
                                                                            attribute: nextAttribute?.key ?? "",
                                                                            uom: nextAttribute?.defaultUom ?? line.uom,
                                                                            testMethod: nextAttribute?.defaultTestMethod ?? line.testMethod
                                                                        }
                                                                        : line));
                                                                }, className: "w-full rounded border border-slate-300 px-2 py-1 text-xs", children: (specTemplates.data?.data ?? []).map((option) => (_jsx("option", { value: option.specType, children: option.specType }, option.specType))) }) }), _jsx("td", { className: "px-2 py-2", children: _jsx("select", { value: row.attribute, onChange: (event) => {
                                                                    const attr = attributes.find((entry) => entry.key === event.target.value);
                                                                    setSpecRows((prev) => prev.map((line) => line.clientId === row.clientId
                                                                        ? {
                                                                            ...line,
                                                                            attribute: event.target.value,
                                                                            uom: attr?.defaultUom ?? line.uom,
                                                                            testMethod: attr?.defaultTestMethod ?? line.testMethod
                                                                        }
                                                                        : line));
                                                                }, className: "w-full rounded border border-slate-300 px-2 py-1 text-xs", children: attributes.map((attribute) => (_jsx("option", { value: attribute.key, children: attribute.key }, `${row.clientId}-${attribute.key}`))) }) }), _jsx("td", { className: "px-2 py-2", children: _jsx("input", { value: row.value, onChange: (event) => setSpecRows((prev) => prev.map((line) => (line.clientId === row.clientId ? { ...line, value: event.target.value } : line))), className: "w-full rounded border border-slate-300 px-2 py-1 text-xs" }) }), _jsx("td", { className: "px-2 py-2", children: _jsx("input", { value: row.minValue, onChange: (event) => setSpecRows((prev) => prev.map((line) => (line.clientId === row.clientId ? { ...line, minValue: event.target.value } : line))), className: "w-full rounded border border-slate-300 px-2 py-1 text-xs" }) }), _jsx("td", { className: "px-2 py-2", children: _jsx("input", { value: row.maxValue, onChange: (event) => setSpecRows((prev) => prev.map((line) => (line.clientId === row.clientId ? { ...line, maxValue: event.target.value } : line))), className: "w-full rounded border border-slate-300 px-2 py-1 text-xs" }) }), _jsx("td", { className: "px-2 py-2", children: _jsx("select", { value: row.uom, onChange: (event) => setSpecRows((prev) => prev.map((line) => (line.clientId === row.clientId ? { ...line, uom: event.target.value } : line))), className: "w-full rounded border border-slate-300 px-2 py-1 text-xs", children: (uomsQuery.data?.data ?? STANDARD_UOMS).map((uom) => (_jsx("option", { value: uom.value, children: uom.value }, uom.value))) }) }), _jsx("td", { className: "px-2 py-2", children: _jsx("input", { value: row.testMethod, onChange: (event) => setSpecRows((prev) => prev.map((line) => (line.clientId === row.clientId ? { ...line, testMethod: event.target.value } : line))), className: "w-full rounded border border-slate-300 px-2 py-1 text-xs" }) }), _jsx("td", { className: "px-2 py-2", children: _jsx("button", { type: "button", onClick: () => setSpecRows((prev) => prev.filter((line) => line.clientId !== row.clientId)), className: "rounded border border-slate-300 px-2 py-1 text-[11px]", children: "Remove" }) })] }, row.clientId));
                                            }) })] }) }), _jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx("button", { type: "button", onClick: () => {
                                            const template = specTemplates.data?.data?.[0];
                                            const attribute = template?.attributes?.[0];
                                            setSpecRows((prev) => [
                                                ...prev,
                                                {
                                                    clientId: `spec-${Date.now()}`,
                                                    specType: template?.specType ?? "PHYSICAL",
                                                    attribute: attribute?.key ?? "",
                                                    value: "",
                                                    minValue: "",
                                                    maxValue: "",
                                                    uom: attribute?.defaultUom ?? "",
                                                    testMethod: attribute?.defaultTestMethod ?? ""
                                                }
                                            ]);
                                        }, className: "rounded border border-slate-300 bg-white px-3 py-1 text-xs", children: "Add Spec Line" }), item.data?.industryType === "FOOD_BEVERAGE" ? (_jsx("button", { type: "button", onClick: () => {
                                            const nutrition = (specTemplates.data?.data ?? []).find((template) => template.specType === "NUTRITION");
                                            if (!nutrition) {
                                                return;
                                            }
                                            setSpecRows((prev) => [
                                                ...prev,
                                                ...nutrition.attributes.map((attr) => ({
                                                    clientId: `spec-${Date.now()}-${attr.key}`,
                                                    specType: nutrition.specType,
                                                    attribute: attr.key,
                                                    value: "",
                                                    minValue: "",
                                                    maxValue: "",
                                                    uom: attr.defaultUom ?? "",
                                                    testMethod: attr.defaultTestMethod ?? ""
                                                }))
                                            ]);
                                        }, className: "rounded border border-slate-300 bg-white px-3 py-1 text-xs", children: "Add Nutrition Panel" })) : null] })] })) : links.data?.specifications?.length ? (_jsx("div", { className: "overflow-hidden rounded border border-slate-200 bg-white", children: _jsxs("table", { className: "w-full text-left text-xs", children: [_jsx("thead", { className: "bg-slate-100 text-[11px] uppercase text-slate-500", children: _jsxs("tr", { children: [_jsx("th", { className: "px-3 py-2", children: "Type" }), _jsx("th", { className: "px-3 py-2", children: "Attribute" }), _jsx("th", { className: "px-3 py-2", children: "Value" }), _jsx("th", { className: "px-3 py-2", children: "Min" }), _jsx("th", { className: "px-3 py-2", children: "Max" }), _jsx("th", { className: "px-3 py-2", children: "UOM" })] }) }), _jsx("tbody", { children: links.data.specifications.map((spec) => (_jsxs("tr", { className: "border-t border-slate-100", children: [_jsx("td", { className: "px-3 py-2", children: spec.specType }), _jsx("td", { className: "px-3 py-2", children: spec.attribute }), _jsx("td", { className: "px-3 py-2", children: spec.value ?? "—" }), _jsx("td", { className: "px-3 py-2", children: spec.minValue ?? "—" }), _jsx("td", { className: "px-3 py-2", children: spec.maxValue ?? "—" }), _jsx("td", { className: "px-3 py-2", children: spec.uom ?? "—" })] }, spec.id))) })] }) })) : (_jsx("p", { className: "text-slate-500", children: "No specifications defined." }))] })) : activeTab === "workflow" ? (_jsxs("div", { className: "grid gap-3 md:grid-cols-2", children: [_jsxs("div", { className: "rounded border border-slate-200 bg-slate-50 p-3 text-sm", children: [_jsx("p", { className: "mb-1 font-medium", children: "Change Requests" }), links.data?.relatedChanges.length ? (links.data.relatedChanges.map((change) => (_jsxs(Link, { to: `/changes/${change.id}`, className: "block text-primary hover:underline", children: [change.crNumber, ": ", change.title, " (", change.status, ")"] }, change.id)))) : (_jsx("p", { className: "text-slate-500", children: "No change requests linked." }))] }), _jsxs("div", { className: "rounded border border-slate-200 bg-slate-50 p-3 text-sm", children: [_jsx("p", { className: "mb-1 font-medium", children: "Workflow Status" }), links.data?.workflows.length ? (links.data.workflows.map((wf) => (_jsxs("p", { className: "text-slate-600", children: ["Workflow: ", wf.currentState] }, wf.id)))) : (_jsx("p", { className: "text-slate-500", children: "No active workflow." }))] })] })) : (_jsxs("div", { className: "rounded border border-slate-200 bg-slate-50 p-3 text-sm", children: [_jsx("p", { className: "mb-2 font-medium", children: "Item Version History" }), history.data?.history?.length ? (_jsx("div", { className: "space-y-2", children: history.data.history.map((entry) => (_jsxs(Link, { to: `/items/${entry.id}`, className: `block rounded border px-3 py-2 ${entry.id === itemId ? "border-primary bg-white" : "border-slate-200 bg-white hover:border-primary"}`, children: [_jsxs("div", { className: "flex items-center justify-between text-sm", children: [_jsx("span", { className: "font-mono", children: entry.itemCode }), _jsx("span", { className: "text-slate-500", children: entry.revisionLabel })] }), _jsxs("div", { className: "text-xs text-slate-500", children: ["Status: ", entry.status] })] }, entry.id))) })) : (_jsx("p", { className: "text-slate-500", children: "No previous versions." }))] }))] }));
}
//# sourceMappingURL=detail-page.js.map