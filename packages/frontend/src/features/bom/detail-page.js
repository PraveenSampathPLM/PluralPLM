import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Link, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { STANDARD_UOMS } from "@/lib/uom";
import { EntityIcon } from "@/components/entity-icon";
export function BomDetailPage() {
    const params = useParams();
    const bomId = String(params.id ?? "");
    const queryClient = useQueryClient();
    const [message, setMessage] = useState("");
    const [isEditing, setIsEditing] = useState(false);
    const [draftLines, setDraftLines] = useState([]);
    const [activeTab, setActiveTab] = useState("details");
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
    const bom = useQuery({
        queryKey: ["bom-detail-page", bomId],
        queryFn: async () => (await api.get(`/bom/${bomId}`)).data,
        enabled: Boolean(bomId)
    });
    const links = useQuery({
        queryKey: ["bom-links-page", bomId],
        queryFn: async () => (await api.get(`/bom/${bomId}/links`)).data,
        enabled: Boolean(bomId)
    });
    const history = useQuery({
        queryKey: ["bom-history", bomId],
        queryFn: async () => (await api.get(`/bom/${bomId}/history`)).data,
        enabled: Boolean(bomId)
    });
    const uomsQuery = useQuery({
        queryKey: ["config-uoms"],
        queryFn: async () => (await api.get("/config/uoms")).data,
        retry: false
    });
    const latestId = useMemo(() => history.data?.history?.[0]?.id, [history.data?.history]);
    const isOldVersion = Boolean(latestId && latestId !== bomId);
    const items = useQuery({
        queryKey: ["bom-detail-items"],
        queryFn: async () => (await api.get("/items", { params: { pageSize: 500 } })).data
    });
    const formulas = useQuery({
        queryKey: ["bom-detail-formulas"],
        queryFn: async () => (await api.get("/formulas", { params: { pageSize: 500 } })).data
    });
    const updateStructure = useMutation({
        mutationFn: async () => {
            const mapped = draftLines
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
            if (mapped.length === 0) {
                throw new Error("Add at least one BOM line.");
            }
            await api.put(`/bom/${bomId}/structure`, { lines: mapped });
        },
        onSuccess: async () => {
            setMessage("BOM updated.");
            setIsEditing(false);
            await queryClient.invalidateQueries({ queryKey: ["bom-detail-page", bomId] });
            await queryClient.invalidateQueries({ queryKey: ["bom-links-page", bomId] });
            await queryClient.invalidateQueries({ queryKey: ["bom"] });
        },
        onError: (error) => {
            setMessage(error instanceof Error ? error.message : "Update failed");
        }
    });
    useEffect(() => {
        if (!bom.data) {
            return;
        }
        const rows = bom.data.lines?.map((line, index) => ({
            lineNumber: String(line.lineNumber ?? index + 1),
            sourceType: line.inputFormula?.id ? "FORMULA" : "ITEM",
            sourceId: line.inputFormula?.id ?? line.item?.id ?? "",
            quantity: String(line.quantity ?? ""),
            uom: line.uom ?? "kg",
            scrapFactor: line.scrapFactor ? String(line.scrapFactor) : "",
            phaseStep: line.phaseStep ?? "",
            operationStep: line.operationStep ?? "",
            referenceDesignator: line.referenceDesignator ?? ""
        })) ?? [];
        setDraftLines(rows.length
            ? rows
            : [
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
    }, [bom.data?.id, isEditing]);
    function renumberLines(rows) {
        return rows.map((row, index) => ({ ...row, lineNumber: String((index + 1) * 10) }));
    }
    function moveLine(index, direction) {
        setDraftLines((prev) => {
            const target = index + direction;
            if (target < 0 || target >= prev.length) {
                return prev;
            }
            const next = [...prev];
            [next[index], next[target]] = [next[target], next[index]];
            return renumberLines(next);
        });
    }
    const itemOptions = useMemo(() => {
        const base = items.data?.data ?? [];
        if (bom.data?.bomType === "FG_BOM") {
            return base.filter((item) => item.itemType === "PACKAGING");
        }
        return base.filter((item) => item.itemType === "RAW_MATERIAL" || item.itemType === "INTERMEDIATE");
    }, [items.data?.data, bom.data?.bomType]);
    const inputFormulaOptions = useMemo(() => {
        const base = formulas.data?.data ?? [];
        return base.filter((row) => row.recipeType === "FORMULA_RECIPE");
    }, [formulas.data?.data]);
    const validationWarnings = useMemo(() => {
        if (!isEditing) {
            return [];
        }
        const warnings = [];
        const itemById = new Map((items.data?.data ?? []).map((item) => [item.id, item]));
        const formulaById = new Map((formulas.data?.data ?? []).map((row) => [row.id, row]));
        const activeLines = draftLines.filter((line) => line.sourceId);
        if (bom.data?.bomType === "FG_BOM") {
            if (!activeLines.some((line) => line.sourceType === "FORMULA")) {
                warnings.push("FG BOM requires at least one formula line.");
            }
            for (const [index, line] of activeLines.entries()) {
                if (line.sourceType === "ITEM") {
                    const item = itemById.get(line.sourceId);
                    if (item && item.itemType !== "PACKAGING") {
                        warnings.push(`Line ${index + 1}: FG BOM item inputs must be Packaging.`);
                    }
                }
                if (line.sourceType === "FORMULA") {
                    const formulaRow = formulaById.get(line.sourceId);
                    if (formulaRow && formulaRow.recipeType !== "FORMULA_RECIPE") {
                        warnings.push(`Line ${index + 1}: input formula must be a Formula recipe.`);
                    }
                }
            }
        }
        else {
            for (const [index, line] of activeLines.entries()) {
                if (line.sourceType === "ITEM") {
                    const item = itemById.get(line.sourceId);
                    if (item && !["RAW_MATERIAL", "INTERMEDIATE"].includes(item.itemType)) {
                        warnings.push(`Line ${index + 1}: FML BOM item inputs must be Raw Material or Intermediate.`);
                    }
                }
                if (line.sourceType === "FORMULA") {
                    const formulaRow = formulaById.get(line.sourceId);
                    if (formulaRow && formulaRow.recipeType !== "FORMULA_RECIPE") {
                        warnings.push(`Line ${index + 1}: input formula must be a Formula recipe.`);
                    }
                }
            }
        }
        return warnings;
    }, [isEditing, draftLines, bom.data?.bomType, items.data?.data, formulas.data?.data]);
    if (bom.isLoading || links.isLoading) {
        return _jsx("div", { className: "rounded-lg bg-white p-4", children: "Loading BOM details..." });
    }
    return (_jsxs("div", { className: "space-y-4 rounded-xl bg-white p-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "rounded-full bg-slate-100 p-2", children: _jsx(EntityIcon, { kind: "bom", size: 20 }) }), _jsxs("div", { children: [_jsxs("p", { className: "font-mono text-sm text-slate-500", children: [bom.data?.bomCode, " v", bom.data?.version, " (", bom.data?.revisionLabel ?? "1.1", ")"] }), _jsxs("h2", { className: "font-heading text-xl", children: ["BOM ", bom.data?.bomType === "FG_BOM" ? "FG" : "FML"] }), _jsxs("div", { className: "mt-1 flex items-center gap-2 text-sm text-slate-500", children: [_jsx("span", { children: "Status" }), renderStatusBadge(bom.data?.status)] })] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [bom.data?.status === "DRAFT" ? (isEditing ? (_jsxs(_Fragment, { children: [_jsx("button", { onClick: () => updateStructure.mutate(), className: "rounded bg-primary px-3 py-1 text-sm text-white", type: "button", children: "Save" }), _jsx("button", { onClick: () => setIsEditing(false), className: "rounded border border-slate-300 bg-white px-3 py-1 text-sm", type: "button", children: "Cancel" })] })) : (_jsx("button", { onClick: () => setIsEditing(true), className: "rounded border border-slate-300 bg-white px-3 py-1 text-sm", type: "button", children: "Edit Structure" }))) : null, _jsx(Link, { to: "/bom", className: "rounded border border-slate-300 bg-white px-3 py-1 text-sm", children: "Back to BOM" })] })] }), bom.data?.status === "DRAFT" && !isEditing ? (_jsx("div", { className: "rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800", children: _jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2", children: [_jsx("span", { children: "This BOM is in Draft and can be edited." }), _jsx("button", { onClick: () => setIsEditing(true), className: "rounded bg-primary px-3 py-1 text-sm text-white", type: "button", children: "Edit Structure" })] }) })) : null, message ? _jsx("p", { className: "text-sm text-slate-600", children: message }) : null, _jsxs("div", { className: "flex items-center gap-2 border-b border-slate-200 text-sm", children: [_jsx("button", { type: "button", onClick: () => setActiveTab("details"), className: `px-3 py-2 ${activeTab === "details" ? "border-b-2 border-primary font-medium text-primary" : "text-slate-500"}`, children: "Details" }), _jsx("button", { type: "button", onClick: () => setActiveTab("history"), className: `px-3 py-2 ${activeTab === "history" ? "border-b-2 border-primary font-medium text-primary" : "text-slate-500"}`, children: "History" })] }), isOldVersion ? (_jsx("div", { className: "rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700", children: "You are viewing an old version of this BOM. Use the History tab to navigate to the latest version." })) : null, activeTab === "details" ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "rounded border border-slate-200 bg-slate-50 p-3 text-sm", children: [_jsx("p", { className: "mb-1 font-medium", children: "Parent" }), bom.data?.bomType === "FG_BOM" ? (bom.data?.parentItem ? (_jsxs(Link, { to: `/items/${bom.data.parentItem.id}`, className: "text-primary hover:underline", children: [bom.data.parentItem.itemCode, " - ", bom.data.parentItem.name] })) : (_jsx("p", { className: "text-slate-500", children: "Unassigned FG" }))) : bom.data?.formula ? (_jsxs(Link, { to: `/formulas/${bom.data.formula.id}`, className: "text-primary hover:underline", children: [bom.data.formula.formulaCode, " v", bom.data.formula.version, " - ", bom.data.formula.name] })) : (_jsx("p", { className: "text-slate-500", children: "Unassigned Formula" }))] }), _jsxs("div", { className: "rounded border border-slate-200 bg-slate-50 p-3 text-sm", children: [_jsxs("div", { className: "mb-2 flex items-center justify-between", children: [_jsx("p", { className: "font-medium", children: "BOM Line Items" }), isEditing ? (_jsx("button", { type: "button", className: "rounded border border-slate-300 bg-white px-2 py-1 text-xs", onClick: () => setDraftLines((prev) => renumberLines([
                                            ...prev,
                                            {
                                                lineNumber: String((prev.length + 1) * 10),
                                                sourceType: "ITEM",
                                                sourceId: "",
                                                quantity: "",
                                                uom: "kg",
                                                scrapFactor: "",
                                                phaseStep: "",
                                                operationStep: "",
                                                referenceDesignator: ""
                                            }
                                        ])), children: "Add Line" })) : null] }), isEditing && validationWarnings.length ? (_jsx("div", { className: "mb-2 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-700", children: validationWarnings.map((warning, index) => (_jsx("p", { children: warning }, `${warning}-${index}`))) })) : null, _jsx("div", { className: "overflow-x-auto rounded border border-slate-200 bg-white", children: _jsxs("table", { className: "w-full text-left text-sm", children: [_jsx("thead", { className: "border-b border-slate-200 bg-slate-50 text-slate-600", children: _jsxs("tr", { children: [_jsx("th", { className: "px-2 py-2", children: "Line #" }), _jsx("th", { className: "px-2 py-2", children: "Input" }), _jsx("th", { className: "px-2 py-2", children: "Quantity" }), _jsx("th", { className: "px-2 py-2", children: "UOM" }), _jsx("th", { className: "px-2 py-2", children: "Scrap %" }), _jsx("th", { className: "px-2 py-2", children: "Phase Step" }), _jsx("th", { className: "px-2 py-2", children: "Operation Step" }), _jsx("th", { className: "px-2 py-2", children: "Ref Designator" }), isEditing ? _jsx("th", { className: "px-2 py-2 text-right", children: "Actions" }) : null] }) }), _jsx("tbody", { children: isEditing
                                                ? draftLines.map((line, index) => (_jsxs("tr", { className: "border-b border-slate-100", children: [_jsx("td", { className: "px-2 py-2", children: _jsx("input", { className: "w-16 rounded border border-slate-300 bg-slate-50 px-2 py-1", value: line.lineNumber, readOnly: true }) }), _jsx("td", { className: "px-2 py-2", children: _jsxs("div", { className: "flex gap-2", children: [_jsxs("select", { className: "rounded border border-slate-300 bg-white px-2 py-1", value: line.sourceType, onChange: (event) => setDraftLines((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, sourceType: event.target.value, sourceId: "" } : row)), children: [_jsx("option", { value: "ITEM", children: "Item" }), _jsx("option", { value: "FORMULA", children: "Formula" })] }), _jsxs("select", { className: "min-w-[200px] rounded border border-slate-300 bg-white px-2 py-1", value: line.sourceId, onChange: (event) => setDraftLines((prev) => prev.map((row, rowIndex) => (rowIndex === index ? { ...row, sourceId: event.target.value } : row))), children: [_jsx("option", { value: "", children: "Select" }), line.sourceType === "ITEM"
                                                                                ? itemOptions.map((item) => (_jsxs("option", { value: item.id, children: [item.itemCode, " - ", item.name] }, item.id)))
                                                                                : inputFormulaOptions.map((formulaOption) => (_jsxs("option", { value: formulaOption.id, children: [formulaOption.formulaCode, " v", formulaOption.version, " - ", formulaOption.name] }, formulaOption.id)))] })] }) }), _jsx("td", { className: "px-2 py-2", children: _jsx("input", { className: "w-24 rounded border border-slate-300 px-2 py-1", value: line.quantity, onChange: (event) => setDraftLines((prev) => prev.map((row, rowIndex) => (rowIndex === index ? { ...row, quantity: event.target.value } : row))) }) }), _jsx("td", { className: "px-2 py-2", children: _jsx("select", { className: "w-24 rounded border border-slate-300 bg-white px-2 py-1", value: line.uom, onChange: (event) => setDraftLines((prev) => prev.map((row, rowIndex) => (rowIndex === index ? { ...row, uom: event.target.value } : row))), children: (uomsQuery.data?.data ?? STANDARD_UOMS).map((uom) => (_jsx("option", { value: uom.value, children: uom.value }, uom.value))) }) }), _jsx("td", { className: "px-2 py-2", children: _jsx("input", { className: "w-20 rounded border border-slate-300 px-2 py-1", value: line.scrapFactor, onChange: (event) => setDraftLines((prev) => prev.map((row, rowIndex) => (rowIndex === index ? { ...row, scrapFactor: event.target.value } : row))) }) }), _jsx("td", { className: "px-2 py-2", children: _jsx("input", { className: "w-28 rounded border border-slate-300 px-2 py-1", value: line.phaseStep, onChange: (event) => setDraftLines((prev) => prev.map((row, rowIndex) => (rowIndex === index ? { ...row, phaseStep: event.target.value } : row))) }) }), _jsx("td", { className: "px-2 py-2", children: _jsx("input", { className: "w-28 rounded border border-slate-300 px-2 py-1", value: line.operationStep, onChange: (event) => setDraftLines((prev) => prev.map((row, rowIndex) => (rowIndex === index ? { ...row, operationStep: event.target.value } : row))) }) }), _jsx("td", { className: "px-2 py-2", children: _jsx("input", { className: "w-28 rounded border border-slate-300 px-2 py-1", value: line.referenceDesignator, onChange: (event) => setDraftLines((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, referenceDesignator: event.target.value } : row)) }) }), _jsx("td", { className: "px-2 py-2 text-right", children: _jsxs("div", { className: "flex items-center justify-end gap-2", children: [_jsx("button", { type: "button", className: "text-xs text-slate-600 hover:underline", onClick: () => moveLine(index, -1), children: "Up" }), _jsx("button", { type: "button", className: "text-xs text-slate-600 hover:underline", onClick: () => moveLine(index, 1), children: "Down" }), _jsx("button", { type: "button", className: "text-xs text-red-600 hover:underline", onClick: () => setDraftLines((prev) => renumberLines(prev.filter((_, rowIndex) => rowIndex !== index))), children: "Remove" })] }) })] }, `${line.sourceId}-${index}`)))
                                                : bom.data?.lines?.map((line, index) => (_jsxs("tr", { className: "border-b border-slate-100", children: [_jsx("td", { className: "px-2 py-2", children: line.lineNumber ?? index + 1 }), _jsx("td", { className: "px-2 py-2", children: line.inputFormula?.id ? (_jsxs(Link, { to: `/formulas/${line.inputFormula.id}`, className: "text-primary hover:underline", children: [line.inputFormula.formulaCode, " v", line.inputFormula.version, " - ", line.inputFormula.name] })) : line.item?.id ? (_jsxs(Link, { to: `/items/${line.item.id}`, className: "text-primary hover:underline", children: [line.item.itemCode, " - ", line.item.name] })) : (_jsx("span", { children: line.item?.itemCode ?? "Unknown Item" })) }), _jsx("td", { className: "px-2 py-2", children: line.quantity }), _jsx("td", { className: "px-2 py-2", children: line.uom }), _jsx("td", { className: "px-2 py-2", children: line.scrapFactor ?? "N/A" }), _jsx("td", { className: "px-2 py-2", children: line.phaseStep ?? "N/A" }), _jsx("td", { className: "px-2 py-2", children: line.operationStep ?? "N/A" }), _jsx("td", { className: "px-2 py-2", children: line.referenceDesignator ?? "N/A" })] }, line.id))) })] }) })] }), _jsxs("div", { className: "grid gap-3 md:grid-cols-2", children: [_jsxs("div", { className: "rounded border border-slate-200 bg-slate-50 p-3 text-sm", children: [_jsx("p", { className: "mb-1 font-medium", children: "Formula Specs" }), links.data?.formulaSpecifications.map((spec) => (_jsxs("p", { className: "text-slate-600", children: [spec.specType, ": ", spec.attribute, " [", spec.minValue ?? spec.value ?? "N/A", " - ", spec.maxValue ?? "N/A", " ", spec.uom ?? "", "]"] }, spec.id)))] }), _jsxs("div", { className: "rounded border border-slate-200 bg-slate-50 p-3 text-sm", children: [_jsx("p", { className: "mb-1 font-medium", children: "Line Item Specs" }), links.data?.lineItemSpecifications.map((spec) => (_jsxs("p", { className: "text-slate-600", children: [spec.specType, ": ", spec.attribute, " [", spec.minValue ?? spec.value ?? "N/A", " - ", spec.maxValue ?? "N/A", " ", spec.uom ?? "", "]"] }, spec.id)))] })] })] })) : (_jsxs("div", { className: "rounded border border-slate-200 bg-slate-50 p-3 text-sm", children: [_jsx("p", { className: "mb-2 font-medium", children: "BOM Version History" }), history.data?.history?.length ? (_jsx("div", { className: "space-y-2", children: history.data.history.map((entry) => (_jsxs(Link, { to: `/bom/${entry.id}`, className: `block rounded border px-3 py-2 ${entry.id === bomId ? "border-primary bg-white" : "border-slate-200 bg-white hover:border-primary"}`, children: [_jsxs("div", { className: "flex items-center justify-between text-sm", children: [_jsxs("span", { className: "font-mono", children: [entry.bomCode, " v", entry.version] }), _jsx("span", { className: "text-slate-500", children: entry.revisionLabel })] }), _jsxs("div", { className: "text-xs text-slate-500", children: ["Status: ", entry.status] })] }, entry.id))) })) : (_jsx("p", { className: "text-slate-500", children: "No previous versions." }))] }))] }));
}
//# sourceMappingURL=detail-page.js.map