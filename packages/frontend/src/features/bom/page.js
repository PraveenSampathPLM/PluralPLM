import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Link } from "react-router-dom";
import { ObjectActionsMenu } from "@/components/object-actions-menu";
import { useContainerStore } from "@/store/container.store";
import { STANDARD_UOMS } from "@/lib/uom";
import { EntityIcon } from "@/components/entity-icon";
export function BomPage() {
    const { selectedContainerId } = useContainerStore();
    const queryClient = useQueryClient();
    const [message, setMessage] = useState("");
    const [selectedBomId, setSelectedBomId] = useState("");
    const [form, setForm] = useState({
        version: "1",
        bomType: "FML_BOM",
        parentItemId: "",
        formulaId: "",
        containerId: selectedContainerId,
        type: "PRODUCTION",
        effectiveDate: ""
    });
    const [lines, setLines] = useState([
        {
            lineNumber: "10",
            sourceType: "ITEM",
            sourceId: "",
            quantity: "",
            uom: "kg",
            scrapFactor: "",
            phaseStep: "",
            operationStep: "",
            referenceDesignator: ""
        }
    ]);
    const formulas = useQuery({
        queryKey: ["bom-formula-options"],
        queryFn: async () => (await api.get("/formulas", { params: { pageSize: 200 } })).data
    });
    const containers = useQuery({
        queryKey: ["bom-container-options"],
        queryFn: async () => (await api.get("/containers")).data
    });
    const items = useQuery({
        queryKey: ["bom-item-options"],
        queryFn: async () => (await api.get("/items", { params: { pageSize: 200 } })).data
    });
    const { data, isLoading } = useQuery({
        queryKey: ["bom", selectedContainerId],
        queryFn: async () => (await api.get("/bom", {
            params: { ...(selectedContainerId ? { containerId: selectedContainerId } : {}) }
        })).data
    });
    const config = useQuery({
        queryKey: ["bom-config"],
        queryFn: async () => (await api.get("/config")).data
    });
    const uomsQuery = useQuery({
        queryKey: ["config-uoms"],
        queryFn: async () => (await api.get("/config/uoms")).data,
        retry: false
    });
    const filteredItemOptions = form.bomType === "FG_BOM"
        ? items.data?.data.filter((item) => item.itemType === "PACKAGING") ?? []
        : items.data?.data.filter((item) => item.itemType === "RAW_MATERIAL" || item.itemType === "INTERMEDIATE") ?? [];
    const filteredFormulaOptions = formulas.data?.data.filter((formula) => formula.recipeType === "FORMULA_RECIPE") ?? [];
    const selectedBom = useQuery({
        queryKey: ["bom-details", selectedBomId],
        queryFn: async () => (await api.get(`/bom/${selectedBomId}`)).data,
        enabled: Boolean(selectedBomId)
    });
    const bomLinks = useQuery({
        queryKey: ["bom-links", selectedBomId],
        queryFn: async () => (await api.get(`/bom/${selectedBomId}/links`)).data,
        enabled: Boolean(selectedBomId)
    });
    const createBom = useMutation({
        mutationFn: async () => {
            const mappedLines = lines
                .filter((row) => row.sourceId && row.quantity)
                .map((row) => ({
                ...(row.lineNumber ? { lineNumber: Number(row.lineNumber) } : {}),
                ...(row.sourceType === "ITEM" ? { itemId: row.sourceId } : { inputFormulaId: row.sourceId }),
                quantity: Number(row.quantity),
                uom: row.uom || "kg",
                ...(row.scrapFactor ? { scrapFactor: Number(row.scrapFactor) } : {}),
                ...(row.phaseStep ? { phaseStep: row.phaseStep } : {}),
                ...(row.operationStep ? { operationStep: row.operationStep } : {}),
                ...(row.referenceDesignator ? { referenceDesignator: row.referenceDesignator } : {})
            }));
            if (mappedLines.length === 0) {
                throw new Error("Add at least one BOM line with item and quantity");
            }
            await api.post("/bom", {
                version: Number(form.version),
                bomType: form.bomType,
                parentItemId: form.bomType === "FG_BOM" ? form.parentItemId || undefined : undefined,
                formulaId: form.bomType === "FML_BOM" ? form.formulaId || undefined : undefined,
                containerId: selectedContainerId || form.containerId || undefined,
                type: form.type,
                effectiveDate: form.effectiveDate || undefined,
                lines: mappedLines
            });
        },
        onSuccess: async () => {
            setMessage("BOM structure created successfully.");
            setForm({ version: "1", bomType: "FML_BOM", parentItemId: "", formulaId: "", containerId: selectedContainerId, type: "PRODUCTION", effectiveDate: "" });
            setLines([
                {
                    lineNumber: "10",
                    sourceType: "ITEM",
                    sourceId: "",
                    quantity: "",
                    uom: "kg",
                    scrapFactor: "",
                    phaseStep: "",
                    operationStep: "",
                    referenceDesignator: ""
                }
            ]);
            await queryClient.invalidateQueries({ queryKey: ["bom"] });
        },
        onError: (error) => {
            setMessage(error instanceof Error ? error.message : "Create failed");
        }
    });
    async function runBomAction(bom, action) {
        try {
            if (action === "checkout") {
                await api.post(`/bom/${bom.id}/check-out`);
                setMessage(`BOM ${bom.bomCode} checked out.`);
            }
            else if (action === "checkin") {
                await api.post(`/bom/${bom.id}/check-in`);
                setMessage(`BOM ${bom.bomCode} checked in.`);
            }
            else if (action === "copy") {
                await api.post(`/bom/${bom.id}/copy`);
                setMessage(`Copy created for ${bom.bomCode}.`);
            }
            else if (action === "revise") {
                await api.post(`/bom/${bom.id}/revise`);
                setMessage(`Revision created for ${bom.bomCode}.`);
            }
            else if (action === "delete") {
                if (!window.confirm(`Delete BOM ${bom.bomCode} v${bom.version}?`)) {
                    return;
                }
                await api.delete(`/bom/${bom.id}`);
                if (selectedBomId === bom.id) {
                    setSelectedBomId("");
                }
                setMessage(`BOM ${bom.bomCode} deleted.`);
            }
            await queryClient.invalidateQueries({ queryKey: ["bom"] });
        }
        catch (error) {
            setMessage(error instanceof Error ? error.message : "Action failed");
        }
    }
    function renderStatusBadge(status) {
        const normalized = status ?? "DRAFT";
        const color = normalized === "DRAFT"
            ? "bg-slate-100 text-slate-700"
            : normalized === "IN_REVIEW"
                ? "bg-amber-100 text-amber-700"
                : normalized === "APPROVED"
                    ? "bg-emerald-100 text-emerald-700"
                    : normalized === "RELEASED"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-rose-100 text-rose-700";
        return _jsx("span", { className: `inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${color}`, children: normalized });
    }
    const bomColumnDefs = {
        bomCode: { label: "BOM Code", render: (bom) => bom.bomCode },
        revisionLabel: { label: "Revision", render: (bom) => bom.revisionLabel ?? "1.1" },
        type: { label: "Type", render: (bom) => (bom.bomType === "FG_BOM" ? "FG BOM" : "FML BOM") },
        parent: {
            label: "Parent",
            render: (bom) => (bom.bomType === "FG_BOM" ? `${bom.parentItem?.itemCode ?? "N/A"}` : bom.bomCode)
        },
        version: { label: "Version", render: (bom) => String(bom.version) },
        status: { label: "Status", render: (bom) => renderStatusBadge(bom.status) },
        effectiveDate: {
            label: "Effective Date",
            render: (bom) => (bom.effectiveDate ? new Date(bom.effectiveDate).toLocaleDateString() : "N/A")
        },
        updatedAt: { label: "Updated", render: (bom) => new Date(bom.updatedAt).toLocaleDateString() }
    };
    const configuredColumns = (config.data?.listColumns?.BOM ?? ["bomCode", "parent", "type", "status", "effectiveDate"]).filter((key) => Boolean(bomColumnDefs[key]));
    function updateLine(index, patch) {
        setLines((previous) => previous.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
    }
    function addLineRow() {
        setLines((previous) => [
            ...previous,
            {
                lineNumber: String((previous.length + 1) * 10),
                sourceType: "ITEM",
                sourceId: "",
                quantity: "",
                uom: "kg",
                scrapFactor: "",
                phaseStep: "",
                operationStep: "",
                referenceDesignator: ""
            }
        ]);
    }
    function removeLineRow(index) {
        setLines((previous) => (previous.length === 1 ? previous : previous.filter((_, rowIndex) => rowIndex !== index)));
    }
    return (_jsxs("div", { className: "space-y-4 rounded-xl bg-white p-4", children: [_jsxs("div", { className: "rounded-lg border border-slate-200 bg-slate-50 p-4", children: [_jsx("h3", { className: "mb-1 font-heading text-lg", children: "Create BOM Structure" }), _jsxs("div", { className: "grid gap-3 md:grid-cols-6", children: [_jsx("input", { value: form.version, onChange: (event) => setForm({ ...form, version: event.target.value }), placeholder: "Version", className: "rounded border border-slate-300 px-3 py-2 text-sm" }), _jsxs("select", { value: form.bomType, onChange: (event) => setForm({ ...form, bomType: event.target.value, parentItemId: "", formulaId: "" }), className: "rounded border border-slate-300 px-3 py-2 text-sm", children: [_jsx("option", { value: "FG_BOM", children: "FG BOM" }), _jsx("option", { value: "FML_BOM", children: "FML BOM" })] }), form.bomType === "FG_BOM" ? (_jsxs("select", { value: form.parentItemId, onChange: (event) => setForm({ ...form, parentItemId: event.target.value }), className: "rounded border border-slate-300 px-3 py-2 text-sm", children: [_jsx("option", { value: "", children: "Select Finished Good" }), items.data?.data
                                        .filter((item) => item.itemType === "FINISHED_GOOD")
                                        .map((item) => (_jsxs("option", { value: item.id, children: [item.itemCode, " - ", item.name] }, item.id)))] })) : (_jsxs("select", { value: form.formulaId, onChange: (event) => setForm({ ...form, formulaId: event.target.value }), className: "rounded border border-slate-300 px-3 py-2 text-sm", children: [_jsx("option", { value: "", children: "Select Formula" }), formulas.data?.data.map((formula) => (_jsxs("option", { value: formula.id, children: [formula.formulaCode, " v", formula.version] }, formula.id)))] })), _jsxs("select", { value: form.type, onChange: (event) => setForm({ ...form, type: event.target.value }), className: "rounded border border-slate-300 px-3 py-2 text-sm", children: [_jsx("option", { value: "PRODUCTION", children: "Production" }), _jsx("option", { value: "COSTING", children: "Costing" }), _jsx("option", { value: "PLANNING", children: "Planning" })] }), _jsx("input", { type: "date", value: form.effectiveDate, onChange: (event) => setForm({ ...form, effectiveDate: event.target.value }), className: "rounded border border-slate-300 px-3 py-2 text-sm" }), _jsxs("div", { className: "rounded border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 md:col-span-2", children: ["Active Container: ", containers.data?.data.find((c) => c.id === selectedContainerId)?.code ?? "All Accessible"] })] }), _jsx("div", { className: "mt-4 overflow-x-auto rounded border border-slate-200 bg-white", children: _jsxs("table", { className: "w-full min-w-[1000px] text-left text-sm", children: [_jsx("thead", { className: "border-b border-slate-200 bg-slate-50 text-slate-600", children: _jsxs("tr", { children: [_jsx("th", { className: "px-2 py-2", children: "Line #" }), _jsx("th", { className: "px-2 py-2", children: "Source Type" }), _jsx("th", { className: "px-2 py-2", children: "Source" }), _jsx("th", { className: "px-2 py-2", children: "Quantity" }), _jsx("th", { className: "px-2 py-2", children: "UOM" }), _jsx("th", { className: "px-2 py-2", children: "Scrap %" }), _jsx("th", { className: "px-2 py-2", children: "Phase Step" }), _jsx("th", { className: "px-2 py-2", children: "Operation Step" }), _jsx("th", { className: "px-2 py-2", children: "Ref Designator" }), _jsx("th", { className: "px-2 py-2", children: "Action" })] }) }), _jsx("tbody", { children: lines.map((row, index) => (_jsxs("tr", { className: "border-b border-slate-100", children: [_jsx("td", { className: "px-2 py-2", children: _jsx("input", { value: row.lineNumber, onChange: (event) => updateLine(index, { lineNumber: event.target.value }), className: "w-full rounded border border-slate-300 px-2 py-1 text-sm" }) }), _jsx("td", { className: "px-2 py-2", children: _jsxs("select", { value: row.sourceType, onChange: (event) => updateLine(index, { sourceType: event.target.value, sourceId: "" }), className: "w-full rounded border border-slate-300 px-2 py-1 text-sm", children: [_jsx("option", { value: "ITEM", children: "Item" }), _jsx("option", { value: "FORMULA", children: "Formula" })] }) }), _jsx("td", { className: "px-2 py-2", children: _jsxs("select", { value: row.sourceId, onChange: (event) => updateLine(index, { sourceId: event.target.value }), className: "w-full rounded border border-slate-300 px-2 py-1 text-sm", children: [_jsxs("option", { value: "", children: ["Select ", row.sourceType === "ITEM" ? "Item" : "Formula"] }), row.sourceType === "ITEM"
                                                            ? filteredItemOptions.map((item) => (_jsxs("option", { value: item.id, children: [item.itemCode, " - ", item.name] }, item.id)))
                                                            : filteredFormulaOptions.map((formula) => (_jsxs("option", { value: formula.id, children: [formula.formulaCode, " v", formula.version] }, formula.id)))] }) }), _jsx("td", { className: "px-2 py-2", children: _jsx("input", { value: row.quantity, onChange: (event) => updateLine(index, { quantity: event.target.value }), className: "w-full rounded border border-slate-300 px-2 py-1 text-sm" }) }), _jsx("td", { className: "px-2 py-2", children: _jsx("select", { value: row.uom, onChange: (event) => updateLine(index, { uom: event.target.value }), className: "w-full rounded border border-slate-300 px-2 py-1 text-sm", children: (uomsQuery.data?.data ?? STANDARD_UOMS).map((uom) => (_jsx("option", { value: uom.value, children: uom.value }, uom.value))) }) }), _jsx("td", { className: "px-2 py-2", children: _jsx("input", { value: row.scrapFactor, onChange: (event) => updateLine(index, { scrapFactor: event.target.value }), className: "w-full rounded border border-slate-300 px-2 py-1 text-sm" }) }), _jsx("td", { className: "px-2 py-2", children: _jsx("input", { value: row.phaseStep, onChange: (event) => updateLine(index, { phaseStep: event.target.value }), className: "w-full rounded border border-slate-300 px-2 py-1 text-sm" }) }), _jsx("td", { className: "px-2 py-2", children: _jsx("input", { value: row.operationStep, onChange: (event) => updateLine(index, { operationStep: event.target.value }), className: "w-full rounded border border-slate-300 px-2 py-1 text-sm" }) }), _jsx("td", { className: "px-2 py-2", children: _jsx("input", { value: row.referenceDesignator, onChange: (event) => updateLine(index, { referenceDesignator: event.target.value }), className: "w-full rounded border border-slate-300 px-2 py-1 text-sm" }) }), _jsx("td", { className: "px-2 py-2", children: _jsx("button", { type: "button", onClick: () => removeLineRow(index), className: "rounded border border-slate-300 px-2 py-1 text-xs", children: "Remove" }) })] }, `line-${index}`))) })] }) }), _jsxs("div", { className: "mt-3 flex items-center gap-3", children: [_jsx("button", { type: "button", onClick: addLineRow, className: "rounded border border-slate-300 bg-white px-3 py-2 text-sm", children: "Add BOM Line" }), _jsx("button", { type: "button", onClick: () => createBom.mutate(), disabled: createBom.isPending, className: "rounded bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60", children: createBom.isPending ? "Creating..." : "Create BOM Structure" })] }), message ? _jsx("p", { className: "mt-2 text-sm text-slate-700", children: message }) : null] }), _jsx("h2", { className: "mb-4 font-heading text-xl", children: "BOM Management" }), isLoading ? (_jsx("p", { children: "Loading BOMs..." })) : (_jsxs("table", { className: "w-full text-left text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-slate-200 text-slate-500", children: [_jsx("th", { className: "w-10 py-2", children: "\u00A0" }), configuredColumns.map((columnKey) => (_jsx("th", { className: "py-2", children: bomColumnDefs[columnKey]?.label ?? columnKey }, columnKey))), _jsx("th", { className: "py-2", children: "Lines" }), _jsx("th", { className: "py-2", children: "Actions" })] }) }), _jsx("tbody", { children: data?.data.map((bom) => (_jsxs("tr", { className: "border-b border-slate-100", children: [_jsx("td", { className: "py-2 text-slate-500", children: _jsx(EntityIcon, { kind: "bom" }) }), configuredColumns.map((columnKey) => (_jsx("td", { className: `py-2 ${columnKey === "bomCode" ? "font-mono" : ""}`, children: bomColumnDefs[columnKey]?.render(bom) ?? "" }, `${bom.id}-${columnKey}`))), _jsx("td", { className: "py-2", children: bom.lines?.length ?? 0 }), _jsxs("td", { className: "py-2", children: [_jsx("button", { type: "button", onClick: () => setSelectedBomId(bom.id), className: "rounded border border-slate-300 px-2 py-1 text-xs", children: "Open Structure" }), _jsx(Link, { to: `/bom/${bom.id}`, className: "ml-2 rounded border border-slate-300 px-2 py-1 text-xs", children: "Open" }), _jsx("span", { className: "ml-2 inline-block", children: _jsx(ObjectActionsMenu, { onAction: (action) => void runBomAction(bom, action), actions: [
                                                    { key: "checkout", label: "Check Out", disabled: bom.status !== "DRAFT" },
                                                    { key: "checkin", label: "Check In", disabled: bom.status !== "IN_REVIEW" },
                                                    { key: "revise", label: "Revise" },
                                                    { key: "copy", label: "Copy" },
                                                    { key: "delete", label: "Delete", danger: true }
                                                ] }) })] })] }, bom.id))) })] })), selectedBomId ? (_jsxs("div", { className: "fixed inset-0 z-40 flex", children: [_jsx("button", { type: "button", className: "h-full flex-1 bg-black/30", onClick: () => setSelectedBomId(""), "aria-label": "Close panel" }), _jsxs("div", { className: "h-full w-full max-w-2xl overflow-y-auto border-l border-slate-200 bg-white p-4 shadow-xl", children: [_jsxs("div", { className: "mb-3 flex items-center justify-between", children: [_jsx("h3", { className: "font-heading text-lg", children: "BOM Panel" }), _jsx("button", { type: "button", onClick: () => setSelectedBomId(""), className: "rounded border border-slate-300 bg-white px-2 py-1 text-xs", children: "Close" })] }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "rounded border border-slate-200 bg-slate-50 p-3", children: [_jsx("h4", { className: "mb-2 font-medium", children: "Structure" }), selectedBom.isLoading ? (_jsx("p", { children: "Loading structure..." })) : (_jsxs("div", { children: [_jsxs("p", { className: "text-sm text-slate-600", children: [selectedBom.data?.bomCode, " v", selectedBom.data?.version, " - ", selectedBom.data?.type] }), _jsx("div", { className: "mt-3 overflow-x-auto rounded border border-slate-200 bg-white", children: _jsxs("table", { className: "w-full text-left text-sm", children: [_jsx("thead", { className: "border-b border-slate-200 bg-slate-50 text-slate-600", children: _jsxs("tr", { children: [_jsx("th", { className: "px-2 py-2", children: "Line #" }), _jsx("th", { className: "px-2 py-2", children: "Input" }), _jsx("th", { className: "px-2 py-2", children: "Qty" }), _jsx("th", { className: "px-2 py-2", children: "UOM" }), _jsx("th", { className: "px-2 py-2", children: "Scrap" }), _jsx("th", { className: "px-2 py-2", children: "Phase" }), _jsx("th", { className: "px-2 py-2", children: "Operation" }), _jsx("th", { className: "px-2 py-2", children: "Ref" })] }) }), _jsx("tbody", { children: selectedBom.data?.lines?.map((line, index) => (_jsxs("tr", { className: "border-b border-slate-100", children: [_jsx("td", { className: "px-2 py-2", children: line.lineNumber ?? index + 1 }), _jsx("td", { className: "px-2 py-2", children: line.inputFormula
                                                                                    ? `${line.inputFormula.formulaCode} v${line.inputFormula.version} - ${line.inputFormula.name}`
                                                                                    : `${line.item?.itemCode ?? "N/A"} - ${line.item?.name ?? ""}` }), _jsx("td", { className: "px-2 py-2", children: line.quantity }), _jsx("td", { className: "px-2 py-2", children: line.uom }), _jsx("td", { className: "px-2 py-2", children: line.scrapFactor ?? "N/A" }), _jsx("td", { className: "px-2 py-2", children: line.phaseStep ?? "N/A" }), _jsx("td", { className: "px-2 py-2", children: line.operationStep ?? "N/A" }), _jsx("td", { className: "px-2 py-2", children: line.referenceDesignator ?? "N/A" })] }, `${line.itemId ?? line.inputFormulaId ?? index}`))) })] }) })] }))] }), _jsxs("div", { className: "rounded border border-slate-200 bg-slate-50 p-3", children: [_jsx("h4", { className: "mb-2 font-medium", children: "Linkage" }), bomLinks.isLoading ? (_jsx("p", { children: "Loading linkage..." })) : (_jsxs("div", { className: "grid gap-3 md:grid-cols-2", children: [_jsxs("div", { className: "rounded border border-slate-200 bg-white p-3 text-sm", children: [_jsx("p", { className: "mb-1 font-medium", children: "Parent" }), bomLinks.data?.bom.bomType === "FG_BOM" ? (bomLinks.data?.bom.parentItem ? (_jsxs(Link, { to: `/items/${bomLinks.data.bom.parentItem.id}`, className: "text-primary hover:underline", children: [bomLinks.data.bom.parentItem.itemCode, " - ", bomLinks.data.bom.parentItem.name] })) : (_jsx("p", { className: "text-slate-500", children: "Unassigned FG" }))) : bomLinks.data?.bom.formula ? (_jsxs(Link, { to: `/formulas/${bomLinks.data.bom.formula.id}`, className: "text-primary hover:underline", children: [bomLinks.data.bom.formula.formulaCode, " v", bomLinks.data.bom.formula.version, " - ", bomLinks.data.bom.formula.name] })) : (_jsx("p", { className: "text-slate-500", children: "Unassigned Formula" }))] }), _jsxs("div", { className: "rounded border border-slate-200 bg-white p-3 text-sm", children: [_jsxs("p", { className: "mb-1 font-medium", children: ["Change Requests (", bomLinks.data?.relatedChanges.length ?? 0, ")"] }), bomLinks.data?.relatedChanges.map((change) => (_jsxs("p", { className: "text-slate-600", children: [change.crNumber, ": ", change.title, " (", change.status, ")"] }, change.id)))] }), _jsxs("div", { className: "rounded border border-slate-200 bg-white p-3 text-sm", children: [_jsxs("p", { className: "mb-1 font-medium", children: ["Formula Specs (", bomLinks.data?.formulaSpecifications.length ?? 0, ")"] }), bomLinks.data?.formulaSpecifications.map((spec) => (_jsxs("p", { className: "text-slate-600", children: [spec.specType, ": ", spec.attribute, " [", spec.minValue ?? spec.value ?? "N/A", " - ", spec.maxValue ?? "N/A", " ", spec.uom ?? "", "]"] }, spec.id)))] }), _jsxs("div", { className: "rounded border border-slate-200 bg-white p-3 text-sm", children: [_jsxs("p", { className: "mb-1 font-medium", children: ["Line Item Specs (", bomLinks.data?.lineItemSpecifications.length ?? 0, ")"] }), bomLinks.data?.lineItemSpecifications.map((spec) => (_jsxs("p", { className: "text-slate-600", children: [spec.specType, ": ", spec.attribute, " [", spec.minValue ?? spec.value ?? "N/A", " - ", spec.maxValue ?? "N/A", " ", spec.uom ?? "", "]"] }, spec.id))), bomLinks.data?.workflows.map((workflow) => (_jsxs("p", { className: "mt-2 text-slate-700", children: ["Workflow: ", workflow.currentState] }, workflow.id)))] })] }))] })] })] })] })) : null] }));
}
//# sourceMappingURL=page.js.map