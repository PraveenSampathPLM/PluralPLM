import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Link, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { STANDARD_UOMS } from "@/lib/uom";
import { EntityIcon } from "@/components/entity-icon";
export function FormulaDetailPage() {
    const params = useParams();
    const formulaId = String(params.id ?? "");
    const queryClient = useQueryClient();
    const [message, setMessage] = useState("");
    const [isEditing, setIsEditing] = useState(false);
    const [isEditingSpecs, setIsEditingSpecs] = useState(false);
    const [draftOutputItemId, setDraftOutputItemId] = useState("");
    const [draftLines, setDraftLines] = useState([]);
    const [specRows, setSpecRows] = useState([]);
    const [activeTab, setActiveTab] = useState("details");
    function renumberLines(rows) {
        return rows.map((row, index) => ({ ...row, additionSequence: String(index + 1) }));
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
    const formula = useQuery({
        queryKey: ["formula-detail-page", formulaId],
        queryFn: async () => (await api.get(`/formulas/${formulaId}`)).data,
        enabled: Boolean(formulaId)
    });
    const links = useQuery({
        queryKey: ["formula-links-page", formulaId],
        queryFn: async () => (await api.get(`/formulas/${formulaId}/links`)).data,
        enabled: Boolean(formulaId)
    });
    const history = useQuery({
        queryKey: ["formula-history", formulaId],
        queryFn: async () => (await api.get(`/formulas/${formulaId}/history`)).data,
        enabled: Boolean(formulaId)
    });
    const uomsQuery = useQuery({
        queryKey: ["config-uoms"],
        queryFn: async () => (await api.get("/config/uoms")).data,
        retry: false
    });
    const specTemplates = useQuery({
        queryKey: ["spec-templates", formula.data?.industryType ?? "CHEMICAL"],
        queryFn: async () => (await api.get(`/specifications/templates/${formula.data?.industryType ?? "CHEMICAL"}`)).data
    });
    const labelPreview = useQuery({
        queryKey: ["label-preview", formulaId],
        queryFn: async () => (await api.get(`/labels/formulas/${formulaId}`)).data,
        enabled: Boolean(formulaId && formula.data?.industryType === "FOOD_BEVERAGE")
    });
    const latestId = useMemo(() => history.data?.history?.[0]?.id, [history.data?.history]);
    const isOldVersion = Boolean(latestId && latestId !== formulaId);
    const items = useQuery({
        queryKey: ["formula-detail-items"],
        queryFn: async () => (await api.get("/items", { params: { pageSize: 500 } })).data
    });
    const formulas = useQuery({
        queryKey: ["formula-detail-formulas"],
        queryFn: async () => (await api.get("/formulas", { params: { pageSize: 500 } })).data
    });
    const updateStructure = useMutation({
        mutationFn: async () => {
            const mapped = draftLines
                .filter((row) => row.sourceId && row.quantity)
                .map((row, index) => ({
                ...(row.sourceType === "ITEM" ? { itemId: row.sourceId } : { inputFormulaId: row.sourceId }),
                quantity: Number(row.quantity),
                uom: row.uom || "kg",
                ...(row.percentage ? { percentage: Number(row.percentage) } : {}),
                additionSequence: row.additionSequence ? Number(row.additionSequence) : index + 1
            }));
            if (mapped.length === 0) {
                throw new Error("Add at least one ingredient line.");
            }
            if (formula.data?.recipeType === "FINISHED_GOOD_RECIPE" && !draftOutputItemId) {
                throw new Error("Finished Good Recipe requires an output finished good item.");
            }
            await api.put(`/formulas/${formulaId}/structure`, {
                outputItemId: formula.data?.recipeType === "FINISHED_GOOD_RECIPE" ? draftOutputItemId : null,
                ingredients: mapped
            });
        },
        onSuccess: async () => {
            setMessage("Formulation updated.");
            setIsEditing(false);
            await queryClient.invalidateQueries({ queryKey: ["formula-detail-page", formulaId] });
            await queryClient.invalidateQueries({ queryKey: ["formula-links-page", formulaId] });
            await queryClient.invalidateQueries({ queryKey: ["formulas"] });
        },
        onError: (error) => {
            setMessage(error instanceof Error ? error.message : "Update failed");
        }
    });
    async function downloadMsds() {
        if (!formulaId) {
            return;
        }
        try {
            const response = await api.get(`/formulas/${formulaId}/msds-pdf`, { responseType: "blob" });
            const blob = new Blob([response.data], { type: "application/pdf" });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            const code = formula.data?.formulaCode ?? "MSDS";
            link.href = url;
            link.download = `${code}-MSDS.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        }
        catch (error) {
            setMessage(error instanceof Error ? error.message : "Failed to download MSDS.");
        }
    }
    const saveSpecs = useMutation({
        mutationFn: async () => {
            await api.post("/specifications/bulk-upsert", {
                targetType: "formula",
                targetId: formulaId,
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
            await queryClient.invalidateQueries({ queryKey: ["formula-links-page", formulaId] });
        },
        onError: (error) => {
            setMessage(error instanceof Error ? error.message : "Failed to save specifications.");
        }
    });
    useEffect(() => {
        if (!formula.data) {
            return;
        }
        setDraftOutputItemId(formula.data.outputItem?.id ?? "");
        const rows = formula.data.ingredients?.map((ingredient) => ({
            sourceType: ingredient.item?.id ? "ITEM" : "FORMULA",
            sourceId: ingredient.item?.id ?? ingredient.inputFormula?.id ?? "",
            quantity: String(ingredient.quantity ?? ""),
            uom: ingredient.uom ?? "kg",
            percentage: ingredient.percentage ? String(ingredient.percentage) : "",
            additionSequence: ingredient.additionSequence ? String(ingredient.additionSequence) : ""
        })) ?? [];
        setDraftLines(rows.length
            ? rows
            : [{ sourceType: "ITEM", sourceId: "", quantity: "", uom: "kg", percentage: "", additionSequence: "1" }]);
    }, [formula.data?.id, isEditing]);
    const itemOptions = useMemo(() => {
        const base = items.data?.data ?? [];
        if (formula.data?.recipeType === "FORMULA_RECIPE") {
            return base.filter((item) => item.itemType === "RAW_MATERIAL" || item.itemType === "INTERMEDIATE");
        }
        return base.filter((item) => item.itemType === "PACKAGING");
    }, [items.data?.data, formula.data?.recipeType]);
    const finishedGoods = useMemo(() => (items.data?.data ?? []).filter((item) => item.itemType === "FINISHED_GOOD"), [items.data?.data]);
    const inputFormulaOptions = useMemo(() => {
        const base = formulas.data?.data ?? [];
        return base.filter((row) => row.recipeType === "FORMULA_RECIPE" && row.id !== formulaId);
    }, [formulas.data?.data, formulaId]);
    const validationWarnings = useMemo(() => {
        if (!isEditing) {
            return [];
        }
        const warnings = [];
        const itemById = new Map((items.data?.data ?? []).map((item) => [item.id, item]));
        const formulaById = new Map((formulas.data?.data ?? []).map((row) => [row.id, row]));
        const activeLines = draftLines.filter((line) => line.sourceId);
        if (formula.data?.recipeType === "FINISHED_GOOD_RECIPE") {
            if (!draftOutputItemId) {
                warnings.push("Finished Good Recipe requires an output finished good item.");
            }
            if (!activeLines.some((line) => line.sourceType === "FORMULA")) {
                warnings.push("Finished Good Recipe requires at least one formula input.");
            }
            for (const [index, line] of activeLines.entries()) {
                if (line.sourceType === "ITEM") {
                    const item = itemById.get(line.sourceId);
                    if (item && item.itemType !== "PACKAGING") {
                        warnings.push(`Line ${index + 1}: Finished Good Recipe item inputs must be Packaging.`);
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
            if (draftOutputItemId) {
                warnings.push("Formula Recipe output is the formula itself. Do not set output item.");
            }
            for (const [index, line] of activeLines.entries()) {
                if (line.sourceType === "ITEM") {
                    const item = itemById.get(line.sourceId);
                    if (item && !["RAW_MATERIAL", "INTERMEDIATE"].includes(item.itemType)) {
                        warnings.push(`Line ${index + 1}: Formula Recipe item inputs must be Raw Material or Intermediate.`);
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
    }, [isEditing, draftLines, formula.data?.recipeType, draftOutputItemId, items.data?.data, formulas.data?.data]);
    if (formula.isLoading || links.isLoading) {
        return _jsx("div", { className: "rounded-lg bg-white p-4", children: "Loading formulation details..." });
    }
    return (_jsxs("div", { className: "space-y-4 rounded-xl bg-white p-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "rounded-full bg-slate-100 p-2", children: _jsx(EntityIcon, { kind: "formula", size: 20 }) }), _jsxs("div", { children: [_jsxs("p", { className: "font-mono text-sm text-slate-500", children: [formula.data?.formulaCode, " v", formula.data?.version] }), _jsx("h2", { className: "font-heading text-xl", children: formula.data?.name }), _jsxs("p", { className: "text-sm text-slate-500", children: ["Type: ", formula.data?.recipeType === "FORMULA_RECIPE" ? "Formula" : "Finished Good", " | Status: ", formula.data?.status] })] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { type: "button", onClick: () => void downloadMsds(), className: "rounded border border-slate-300 bg-white px-3 py-1 text-sm", children: "Download MSDS" }), formula.data?.status === "DRAFT" ? (isEditing ? (_jsxs(_Fragment, { children: [_jsx("button", { onClick: () => updateStructure.mutate(), className: "rounded bg-primary px-3 py-1 text-sm text-white", type: "button", children: "Save" }), _jsx("button", { onClick: () => setIsEditing(false), className: "rounded border border-slate-300 bg-white px-3 py-1 text-sm", type: "button", children: "Cancel" })] })) : (_jsx("button", { onClick: () => setIsEditing(true), className: "rounded border border-slate-300 bg-white px-3 py-1 text-sm", type: "button", children: "Edit Structure" }))) : null, _jsx(Link, { to: "/formulas", className: "rounded border border-slate-300 bg-white px-3 py-1 text-sm", children: "Back to Formulation" })] })] }), message ? _jsx("p", { className: "text-sm text-slate-600", children: message }) : null, _jsxs("div", { className: "flex items-center gap-2 border-b border-slate-200 text-sm", children: [_jsx("button", { type: "button", onClick: () => setActiveTab("details"), className: `px-3 py-2 ${activeTab === "details" ? "border-b-2 border-primary font-medium text-primary" : "text-slate-500"}`, children: "Details" }), _jsx("button", { type: "button", onClick: () => setActiveTab("history"), className: `px-3 py-2 ${activeTab === "history" ? "border-b-2 border-primary font-medium text-primary" : "text-slate-500"}`, children: "History" }), formula.data?.industryType === "FOOD_BEVERAGE" ? (_jsx("button", { type: "button", onClick: () => setActiveTab("labeling"), className: `px-3 py-2 ${activeTab === "labeling" ? "border-b-2 border-primary font-medium text-primary" : "text-slate-500"}`, children: "Labeling" })) : null] }), isOldVersion ? (_jsx("div", { className: "rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700", children: "You are viewing an old version of this formulation. Use the History tab to navigate to the latest version." })) : null, activeTab === "details" ? (_jsxs(_Fragment, { children: [formula.data?.recipeType === "FINISHED_GOOD_RECIPE" ? (isEditing ? (_jsxs("div", { className: "rounded border border-slate-200 bg-slate-50 p-3 text-sm", children: [_jsx("p", { className: "mb-1 font-medium", children: "Output Finished Good" }), _jsxs("select", { className: "w-full rounded border border-slate-300 bg-white px-2 py-1", value: draftOutputItemId, onChange: (event) => setDraftOutputItemId(event.target.value), children: [_jsx("option", { value: "", children: "Select Finished Good" }), finishedGoods.map((item) => (_jsxs("option", { value: item.id, children: [item.itemCode, " - ", item.name] }, item.id)))] })] })) : formula.data?.outputItem ? (_jsxs("div", { className: "rounded border border-slate-200 bg-slate-50 p-3 text-sm", children: [_jsx("p", { className: "mb-1 font-medium", children: "Output" }), _jsxs(Link, { to: `/items/${formula.data.outputItem.id}`, className: "text-primary hover:underline", children: [formula.data.outputItem.itemCode, " - ", formula.data.outputItem.name] })] })) : null) : formula.data?.outputItem ? (_jsxs("div", { className: "rounded border border-slate-200 bg-slate-50 p-3 text-sm", children: [_jsx("p", { className: "mb-1 font-medium", children: "Output" }), _jsxs(Link, { to: `/items/${formula.data.outputItem.id}`, className: "text-primary hover:underline", children: [formula.data.outputItem.itemCode, " - ", formula.data.outputItem.name] })] })) : null, _jsxs("div", { className: "rounded border border-slate-200 bg-slate-50 p-3 text-sm", children: [_jsxs("div", { className: "mb-2 flex items-center justify-between", children: [_jsx("p", { className: "font-medium", children: "Input Structure" }), isEditing ? (_jsx("button", { type: "button", className: "rounded border border-slate-300 bg-white px-2 py-1 text-xs", onClick: () => setDraftLines((prev) => renumberLines([
                                            ...prev,
                                            { sourceType: "ITEM", sourceId: "", quantity: "", uom: "kg", percentage: "", additionSequence: String(prev.length + 1) }
                                        ])), children: "Add Line" })) : null] }), isEditing && validationWarnings.length ? (_jsx("div", { className: "mb-2 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-700", children: validationWarnings.map((warning, index) => (_jsx("p", { children: warning }, `${warning}-${index}`))) })) : null, _jsx("div", { className: "overflow-x-auto rounded border border-slate-200 bg-white", children: _jsxs("table", { className: "w-full text-left text-sm", children: [_jsx("thead", { className: "border-b border-slate-200 bg-slate-50 text-slate-600", children: _jsxs("tr", { children: [_jsx("th", { className: "px-2 py-2", children: "Line" }), _jsx("th", { className: "px-2 py-2", children: "Source" }), _jsx("th", { className: "px-2 py-2", children: "Quantity" }), _jsx("th", { className: "px-2 py-2", children: "UOM" }), _jsx("th", { className: "px-2 py-2", children: "%" }), _jsx("th", { className: "px-2 py-2", children: "Seq" }), isEditing ? _jsx("th", { className: "px-2 py-2 text-right", children: "Actions" }) : null] }) }), _jsx("tbody", { children: isEditing
                                                ? draftLines.map((row, index) => (_jsxs("tr", { className: "border-b border-slate-100", children: [_jsx("td", { className: "px-2 py-2", children: index + 1 }), _jsx("td", { className: "px-2 py-2", children: _jsxs("div", { className: "flex gap-2", children: [_jsxs("select", { className: "rounded border border-slate-300 bg-white px-2 py-1", value: row.sourceType, onChange: (event) => setDraftLines((prev) => prev.map((line, lineIndex) => lineIndex === index ? { ...line, sourceType: event.target.value, sourceId: "" } : line)), children: [_jsx("option", { value: "ITEM", children: "Item" }), _jsx("option", { value: "FORMULA", children: "Formula" })] }), _jsxs("select", { className: "min-w-[200px] rounded border border-slate-300 bg-white px-2 py-1", value: row.sourceId, onChange: (event) => setDraftLines((prev) => prev.map((line, lineIndex) => (lineIndex === index ? { ...line, sourceId: event.target.value } : line))), children: [_jsx("option", { value: "", children: "Select" }), row.sourceType === "ITEM"
                                                                                ? itemOptions.map((item) => (_jsxs("option", { value: item.id, children: [item.itemCode, " - ", item.name] }, item.id)))
                                                                                : inputFormulaOptions.map((formulaOption) => (_jsxs("option", { value: formulaOption.id, children: [formulaOption.formulaCode, " v", formulaOption.version, " - ", formulaOption.name] }, formulaOption.id)))] })] }) }), _jsx("td", { className: "px-2 py-2", children: _jsx("input", { className: "w-24 rounded border border-slate-300 px-2 py-1", value: row.quantity, onChange: (event) => setDraftLines((prev) => prev.map((line, lineIndex) => (lineIndex === index ? { ...line, quantity: event.target.value } : line))) }) }), _jsx("td", { className: "px-2 py-2", children: _jsx("select", { className: "w-24 rounded border border-slate-300 bg-white px-2 py-1", value: row.uom, onChange: (event) => setDraftLines((prev) => prev.map((line, lineIndex) => (lineIndex === index ? { ...line, uom: event.target.value } : line))), children: (uomsQuery.data?.data ?? STANDARD_UOMS).map((uom) => (_jsx("option", { value: uom.value, children: uom.value }, uom.value))) }) }), _jsx("td", { className: "px-2 py-2", children: _jsx("input", { className: "w-20 rounded border border-slate-300 px-2 py-1", value: row.percentage, onChange: (event) => setDraftLines((prev) => prev.map((line, lineIndex) => (lineIndex === index ? { ...line, percentage: event.target.value } : line))) }) }), _jsx("td", { className: "px-2 py-2", children: _jsx("input", { className: "w-16 rounded border border-slate-300 px-2 py-1", value: row.additionSequence, readOnly: true }) }), _jsx("td", { className: "px-2 py-2 text-right", children: _jsxs("div", { className: "flex items-center justify-end gap-2", children: [_jsx("button", { type: "button", className: "text-xs text-slate-600 hover:underline", onClick: () => moveLine(index, -1), children: "Up" }), _jsx("button", { type: "button", className: "text-xs text-slate-600 hover:underline", onClick: () => moveLine(index, 1), children: "Down" }), _jsx("button", { type: "button", className: "text-xs text-red-600 hover:underline", onClick: () => setDraftLines((prev) => renumberLines(prev.filter((_, lineIndex) => lineIndex !== index))), children: "Remove" })] }) })] }, `${row.sourceId}-${index}`)))
                                                : formula.data?.ingredients?.map((ingredient, index) => (_jsxs("tr", { className: "border-b border-slate-100", children: [_jsx("td", { className: "px-2 py-2", children: index + 1 }), _jsx("td", { className: "px-2 py-2", children: ingredient.item?.id ? (_jsxs(Link, { to: `/items/${ingredient.item.id}`, className: "text-primary hover:underline", children: [ingredient.item.itemCode, " - ", ingredient.item.name] })) : ingredient.inputFormula?.id ? (_jsxs(Link, { to: `/formulas/${ingredient.inputFormula.id}`, className: "text-primary hover:underline", children: [ingredient.inputFormula.formulaCode, " v", ingredient.inputFormula.version, " - ", ingredient.inputFormula.name] })) : (_jsx("span", { children: "Unknown" })) }), _jsx("td", { className: "px-2 py-2", children: ingredient.quantity }), _jsx("td", { className: "px-2 py-2", children: ingredient.uom }), _jsx("td", { className: "px-2 py-2", children: ingredient.percentage ?? "N/A" }), _jsx("td", { className: "px-2 py-2", children: ingredient.additionSequence ?? "N/A" })] }, ingredient.id))) })] }) })] }), _jsxs("div", { className: "grid gap-3 md:grid-cols-2", children: [_jsxs("div", { className: "rounded border border-slate-200 bg-slate-50 p-3 text-sm", children: [_jsx("p", { className: "mb-1 font-medium", children: "Linked BOMs" }), links.data?.boms.map((bom) => (_jsxs(Link, { to: `/bom/${bom.id}`, className: "block text-primary hover:underline", children: [bom.bomCode, " v", bom.version, " (", bom.type, ")"] }, bom.id)))] }), _jsxs("div", { className: "rounded border border-slate-200 bg-slate-50 p-3 text-sm", children: [_jsxs("div", { className: "mb-2 flex items-center justify-between", children: [_jsx("p", { className: "font-medium", children: "Specifications" }), !isEditingSpecs ? (_jsx("button", { type: "button", onClick: () => {
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
                                                }, disabled: formula.data?.status !== "DRAFT", className: "rounded border border-slate-300 bg-white px-3 py-1 text-xs disabled:opacity-60", children: "Edit Specs" })) : (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { type: "button", onClick: () => saveSpecs.mutate(), disabled: saveSpecs.isPending, className: "rounded bg-primary px-3 py-1 text-xs font-medium text-white disabled:opacity-60", children: saveSpecs.isPending ? "Saving..." : "Save" }), _jsx("button", { type: "button", onClick: () => setIsEditingSpecs(false), className: "rounded border border-slate-300 px-3 py-1 text-xs", children: "Cancel" })] }))] }), isEditingSpecs ? (_jsxs("div", { className: "space-y-3", children: [_jsx("div", { className: "overflow-x-auto rounded border border-slate-200 bg-white", children: _jsxs("table", { className: "w-full min-w-[860px] text-left text-xs", children: [_jsx("thead", { className: "bg-slate-100 text-[11px] uppercase text-slate-500", children: _jsxs("tr", { children: [_jsx("th", { className: "px-2 py-2", children: "Type" }), _jsx("th", { className: "px-2 py-2", children: "Attribute" }), _jsx("th", { className: "px-2 py-2", children: "Value" }), _jsx("th", { className: "px-2 py-2", children: "Min" }), _jsx("th", { className: "px-2 py-2", children: "Max" }), _jsx("th", { className: "px-2 py-2", children: "UOM" }), _jsx("th", { className: "px-2 py-2", children: "Test Method" }), _jsx("th", { className: "px-2 py-2", children: "Action" })] }) }), _jsx("tbody", { children: specRows.map((row) => {
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
                                                        }, className: "rounded border border-slate-300 bg-white px-3 py-1 text-xs", children: "Add Spec Line" }), formula.data?.industryType === "FOOD_BEVERAGE" ? (_jsx("button", { type: "button", onClick: () => {
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
                                                        }, className: "rounded border border-slate-300 bg-white px-3 py-1 text-xs", children: "Add Nutrition Panel" })) : null] })] })) : links.data?.specifications.length ? (_jsx("div", { className: "overflow-hidden rounded border border-slate-200 bg-white", children: _jsxs("table", { className: "w-full text-left text-xs", children: [_jsx("thead", { className: "bg-slate-100 text-[11px] uppercase text-slate-500", children: _jsxs("tr", { children: [_jsx("th", { className: "px-3 py-2", children: "Type" }), _jsx("th", { className: "px-3 py-2", children: "Attribute" }), _jsx("th", { className: "px-3 py-2", children: "Value" }), _jsx("th", { className: "px-3 py-2", children: "Min" }), _jsx("th", { className: "px-3 py-2", children: "Max" }), _jsx("th", { className: "px-3 py-2", children: "UOM" })] }) }), _jsx("tbody", { children: links.data?.specifications.map((spec) => (_jsxs("tr", { className: "border-t border-slate-100", children: [_jsx("td", { className: "px-3 py-2", children: spec.specType }), _jsx("td", { className: "px-3 py-2", children: spec.attribute }), _jsx("td", { className: "px-3 py-2", children: spec.value ?? "—" }), _jsx("td", { className: "px-3 py-2", children: spec.minValue ?? "—" }), _jsx("td", { className: "px-3 py-2", children: spec.maxValue ?? "—" }), _jsx("td", { className: "px-3 py-2", children: spec.uom ?? "—" })] }, spec.id))) })] }) })) : (_jsx("p", { className: "text-slate-500", children: "No specifications defined." }))] })] })] })) : activeTab === "labeling" ? (_jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("div", { className: "rounded border border-slate-200 bg-white p-4 text-sm", children: [_jsx("h3", { className: "mb-2 font-medium text-slate-700", children: "Ingredient Declaration" }), labelPreview.isLoading ? (_jsx("p", { className: "text-slate-500", children: "Loading label preview..." })) : labelPreview.data?.declaration?.length ? (_jsx("ol", { className: "list-decimal space-y-1 pl-5 text-slate-700", children: labelPreview.data.declaration.map((line, index) => (_jsx("li", { children: line }, `${line}-${index}`))) })) : (_jsx("p", { className: "text-slate-500", children: "No declaration available for this formula." }))] }), _jsxs("div", { className: "rounded border border-slate-200 bg-white p-4 text-sm", children: [_jsx("h3", { className: "mb-2 font-medium text-slate-700", children: "Allergen Summary" }), labelPreview.data?.allergens?.length ? (_jsx("div", { className: "flex flex-wrap gap-2", children: labelPreview.data.allergens.map((allergen) => (_jsx("span", { className: "rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-800", children: allergen }, allergen))) })) : (_jsx("p", { className: "text-slate-500", children: "No allergens detected in linked ingredients." }))] }), _jsxs("div", { className: "md:col-span-2 rounded border border-slate-200 bg-white p-4 text-sm", children: [_jsx("h3", { className: "mb-3 font-medium text-slate-700", children: "Composition" }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-left text-sm", children: [_jsx("thead", { className: "bg-slate-50 text-slate-600", children: _jsxs("tr", { children: [_jsx("th", { className: "px-3 py-2", children: "Code" }), _jsx("th", { className: "px-3 py-2", children: "Ingredient" }), _jsx("th", { className: "px-3 py-2 text-right", children: "%" })] }) }), _jsxs("tbody", { children: [(labelPreview.data?.composition ?? []).map((row, index) => (_jsxs("tr", { className: "border-b border-slate-100", children: [_jsx("td", { className: "px-3 py-2 font-mono text-xs text-slate-600", children: row.code || "—" }), _jsx("td", { className: "px-3 py-2", children: row.name }), _jsx("td", { className: "px-3 py-2 text-right", children: typeof row.percentage === "number" ? row.percentage.toFixed(2) : "—" })] }, `${row.code}-${index}`))), labelPreview.data?.composition?.length ? null : (_jsx("tr", { children: _jsx("td", { colSpan: 3, className: "px-3 py-3 text-center text-slate-500", children: "No composition data available." }) }))] })] }) })] }), _jsxs("div", { className: "md:col-span-2 rounded border border-slate-200 bg-white p-4 text-sm", children: [_jsx("h3", { className: "mb-3 font-medium text-slate-700", children: "Nutrition Panel" }), labelPreview.data?.nutrition?.length ? (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-left text-sm", children: [_jsx("thead", { className: "bg-slate-50 text-slate-600", children: _jsxs("tr", { children: [_jsx("th", { className: "px-3 py-2", children: "Nutrient" }), _jsx("th", { className: "px-3 py-2", children: "Value" }), _jsx("th", { className: "px-3 py-2", children: "Min" }), _jsx("th", { className: "px-3 py-2", children: "Max" }), _jsx("th", { className: "px-3 py-2", children: "UOM" })] }) }), _jsx("tbody", { children: labelPreview.data.nutrition.map((row) => (_jsxs("tr", { className: "border-b border-slate-100", children: [_jsx("td", { className: "px-3 py-2 font-medium text-slate-700", children: row.attribute }), _jsx("td", { className: "px-3 py-2", children: row.value ?? "—" }), _jsx("td", { className: "px-3 py-2", children: row.minValue ?? "—" }), _jsx("td", { className: "px-3 py-2", children: row.maxValue ?? "—" }), _jsx("td", { className: "px-3 py-2", children: row.uom ?? "—" })] }, row.attribute))) })] }) })) : (_jsx("p", { className: "text-slate-500", children: "No nutrition specs configured for this formula." }))] })] })) : (_jsxs("div", { className: "rounded border border-slate-200 bg-slate-50 p-3 text-sm", children: [_jsx("p", { className: "mb-2 font-medium", children: "Formulation Version History" }), history.data?.history?.length ? (_jsx("div", { className: "space-y-2", children: history.data.history.map((entry) => (_jsxs(Link, { to: `/formulas/${entry.id}`, className: `block rounded border px-3 py-2 ${entry.id === formulaId ? "border-primary bg-white" : "border-slate-200 bg-white hover:border-primary"}`, children: [_jsxs("div", { className: "flex items-center justify-between text-sm", children: [_jsxs("span", { className: "font-mono", children: [entry.formulaCode, " v", entry.version] }), _jsx("span", { className: "text-slate-500", children: entry.revisionLabel })] }), _jsxs("div", { className: "text-xs text-slate-500", children: ["Status: ", entry.status] })] }, entry.id))) })) : (_jsx("p", { className: "text-slate-500", children: "No previous versions." }))] }))] }));
}
//# sourceMappingURL=detail-page.js.map