import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Link } from "react-router-dom";
import { ObjectActionsMenu } from "@/components/object-actions-menu";
import { useContainerStore } from "@/store/container.store";
import { STANDARD_UOMS } from "@/lib/uom";
import { EntityIcon } from "@/components/entity-icon";
export function FormulasPage() {
    const { selectedContainerId } = useContainerStore();
    const queryClient = useQueryClient();
    const [message, setMessage] = useState("");
    const [selectedFormulaId, setSelectedFormulaId] = useState("");
    const [form, setForm] = useState({
        formulaCode: "",
        version: "1",
        recipeType: "FORMULA_RECIPE",
        outputItemId: "",
        name: "",
        batchSize: "100",
        batchUom: "kg",
        containerId: selectedContainerId
    });
    const [ingredients, setIngredients] = useState([
        { sourceType: "ITEM", sourceId: "", quantity: "", uom: "kg", percentage: "", additionSequence: "1" }
    ]);
    const items = useQuery({
        queryKey: ["formula-item-options"],
        queryFn: async () => (await api.get("/items", { params: { pageSize: 500 } })).data
    });
    const containers = useQuery({
        queryKey: ["formula-container-options"],
        queryFn: async () => (await api.get("/containers")).data
    });
    const nextFormula = useQuery({
        queryKey: ["next-formula-number"],
        queryFn: async () => (await api.get("/config/next-number/FORMULA")).data
    });
    const { data, isLoading } = useQuery({
        queryKey: ["formulas", selectedContainerId],
        queryFn: async () => (await api.get("/formulas", {
            params: { ...(selectedContainerId ? { containerId: selectedContainerId } : {}) }
        })).data
    });
    const config = useQuery({
        queryKey: ["formula-config"],
        queryFn: async () => (await api.get("/config")).data
    });
    const uomsQuery = useQuery({
        queryKey: ["config-uoms"],
        queryFn: async () => (await api.get("/config/uoms")).data,
        retry: false
    });
    const formulaInputs = useMemo(() => (data?.data ?? []).filter((recipe) => recipe.recipeType === "FORMULA_RECIPE"), [data]);
    const finishedGoods = useMemo(() => (items.data?.data ?? []).filter((item) => item.itemType === "FINISHED_GOOD"), [items.data?.data]);
    const inputItemOptions = useMemo(() => {
        const base = items.data?.data ?? [];
        if (form.recipeType === "FORMULA_RECIPE") {
            return base.filter((item) => item.itemType === "RAW_MATERIAL" || item.itemType === "INTERMEDIATE");
        }
        return base.filter((item) => item.itemType === "PACKAGING");
    }, [items.data?.data, form.recipeType]);
    const selectedFormula = useQuery({
        queryKey: ["formula-details", selectedFormulaId],
        queryFn: async () => (await api.get(`/formulas/${selectedFormulaId}`)).data,
        enabled: Boolean(selectedFormulaId)
    });
    const formulaLinks = useQuery({
        queryKey: ["formula-links", selectedFormulaId],
        queryFn: async () => (await api.get(`/formulas/${selectedFormulaId}/links`)).data,
        enabled: Boolean(selectedFormulaId)
    });
    const createFormula = useMutation({
        mutationFn: async () => {
            if (!selectedContainerId) {
                throw new Error("Select a container before creating formulations.");
            }
            const ingredientData = ingredients
                .filter((row) => row.sourceId && row.quantity)
                .map((row, index) => ({
                ...(row.sourceType === "ITEM" ? { itemId: row.sourceId } : { inputFormulaId: row.sourceId }),
                quantity: Number(row.quantity),
                uom: row.uom || "kg",
                ...(row.percentage ? { percentage: Number(row.percentage) } : {}),
                additionSequence: row.additionSequence ? Number(row.additionSequence) : index + 1
            }));
            if (ingredientData.length === 0) {
                throw new Error("Add at least one input row with source and quantity");
            }
            if (form.recipeType === "FINISHED_GOOD_RECIPE" && !form.outputItemId) {
                throw new Error("Finished Good requires an output finished good item");
            }
            await api.post("/formulas", {
                formulaCode: form.formulaCode || undefined,
                version: Number(form.version),
                recipeType: form.recipeType,
                outputItemId: form.recipeType === "FINISHED_GOOD_RECIPE" ? form.outputItemId : undefined,
                name: form.name,
                batchSize: Number(form.batchSize),
                batchUom: form.batchUom,
                containerId: selectedContainerId,
                status: "DRAFT",
                ingredients: ingredientData
            });
        },
        onSuccess: async () => {
            setMessage("Formulation structure created successfully.");
            setForm({
                formulaCode: "",
                version: "1",
                recipeType: "FORMULA_RECIPE",
                outputItemId: "",
                name: "",
                batchSize: "100",
                batchUom: "kg",
                containerId: selectedContainerId
            });
            setIngredients([{ sourceType: "ITEM", sourceId: "", quantity: "", uom: "kg", percentage: "", additionSequence: "1" }]);
            await queryClient.invalidateQueries({ queryKey: ["formulas"] });
            await queryClient.invalidateQueries({ queryKey: ["next-formula-number"] });
        },
        onError: (error) => {
            setMessage(error instanceof Error ? error.message : "Create failed");
        }
    });
    async function runFormulaAction(formula, action) {
        try {
            if (action === "checkout") {
                await api.post(`/formulas/${formula.id}/check-out`);
                setMessage(`Formulation ${formula.formulaCode} checked out.`);
            }
            else if (action === "checkin") {
                await api.post(`/formulas/${formula.id}/check-in`);
                setMessage(`Formulation ${formula.formulaCode} checked in.`);
            }
            else if (action === "copy") {
                await api.post(`/formulas/${formula.id}/copy`);
                setMessage(`Copy created for ${formula.formulaCode}.`);
            }
            else if (action === "revise") {
                await api.post(`/formulas/${formula.id}/revise`);
                setMessage(`Revision created for ${formula.formulaCode}.`);
            }
            else if (action === "delete") {
                if (!window.confirm(`Delete recipe ${formula.formulaCode} v${formula.version}?`)) {
                    return;
                }
                await api.delete(`/formulas/${formula.id}`);
                if (selectedFormulaId === formula.id) {
                    setSelectedFormulaId("");
                }
                setMessage(`Formulation ${formula.formulaCode} deleted.`);
            }
            await queryClient.invalidateQueries({ queryKey: ["formulas"] });
            await queryClient.invalidateQueries({ queryKey: ["next-formula-number"] });
        }
        catch (error) {
            setMessage(error instanceof Error ? error.message : "Action failed");
        }
    }
    const formulaColumnDefs = {
        formulaCode: { label: "Formulation Code", render: (formula) => formula.formulaCode },
        revisionLabel: { label: "Revision", render: (formula) => formula.revisionLabel ?? "1.1" },
        name: { label: "Name", render: (formula) => formula.name },
        recipeType: {
            label: "Formulation Type",
            render: (formula) => (formula.recipeType === "FORMULA_RECIPE" ? "Formula" : "Finished Good")
        },
        output: {
            label: "Output",
            render: (formula) => formula.recipeType === "FINISHED_GOOD_RECIPE"
                ? `${formula.outputItem?.itemCode ?? "N/A"} - ${formula.outputItem?.name ?? "Unassigned"}`
                : "Formula"
        },
        version: { label: "Version", render: (formula) => String(formula.version) },
        status: { label: "Status", render: (formula) => formula.status },
        updatedAt: { label: "Updated", render: (formula) => new Date(formula.updatedAt).toLocaleDateString() }
    };
    const configuredColumns = (config.data?.listColumns?.FORMULA ?? ["formulaCode", "revisionLabel", "name", "recipeType", "status"]).filter((key) => Boolean(formulaColumnDefs[key]));
    function updateIngredient(index, patch) {
        setIngredients((previous) => previous.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
    }
    function addIngredientRow() {
        setIngredients((previous) => [
            ...previous,
            { sourceType: "ITEM", sourceId: "", quantity: "", uom: "kg", percentage: "", additionSequence: String(previous.length + 1) }
        ]);
    }
    function removeIngredientRow(index) {
        setIngredients((previous) => (previous.length === 1 ? previous : previous.filter((_, rowIndex) => rowIndex !== index)));
    }
    return (_jsxs("div", { className: "space-y-4 rounded-xl bg-white p-4", children: [_jsxs("div", { className: "rounded-lg border border-slate-200 bg-slate-50 p-4", children: [_jsx("h3", { className: "mb-1 font-heading text-lg", children: "Create Formulation" }), _jsxs("p", { className: "mb-3 text-xs text-slate-500", children: ["Leave Formulation Code blank for auto-number: ", nextFormula.data?.value ?? "Loading..."] }), _jsxs("div", { className: "grid gap-3 md:grid-cols-6", children: [_jsx("input", { value: form.formulaCode, onChange: (event) => setForm({ ...form, formulaCode: event.target.value }), placeholder: "Formulation Code (optional)", className: "rounded border border-slate-300 px-3 py-2 text-sm" }), _jsx("input", { value: form.version, onChange: (event) => setForm({ ...form, version: event.target.value }), placeholder: "Version", className: "rounded border border-slate-300 px-3 py-2 text-sm" }), _jsxs("select", { value: form.recipeType, onChange: (event) => setForm({
                                    ...form,
                                    recipeType: event.target.value,
                                    outputItemId: event.target.value === "FINISHED_GOOD_RECIPE" ? form.outputItemId : ""
                                }), className: "rounded border border-slate-300 px-3 py-2 text-sm", children: [_jsx("option", { value: "FORMULA_RECIPE", children: "Formula" }), _jsx("option", { value: "FINISHED_GOOD_RECIPE", children: "Finished Good" })] }), _jsx("input", { value: form.name, onChange: (event) => setForm({ ...form, name: event.target.value }), placeholder: "Formulation Name", className: "rounded border border-slate-300 px-3 py-2 text-sm md:col-span-2" }), _jsx("input", { value: form.batchSize, onChange: (event) => setForm({ ...form, batchSize: event.target.value }), placeholder: "Batch Size", className: "rounded border border-slate-300 px-3 py-2 text-sm" }), _jsx("select", { value: form.batchUom, onChange: (event) => setForm({ ...form, batchUom: event.target.value }), className: "rounded border border-slate-300 px-3 py-2 text-sm", children: (uomsQuery.data?.data ?? STANDARD_UOMS).map((uom) => (_jsx("option", { value: uom.value, children: uom.label }, uom.value))) }), _jsxs("select", { value: form.outputItemId, onChange: (event) => setForm({ ...form, outputItemId: event.target.value }), disabled: form.recipeType !== "FINISHED_GOOD_RECIPE", className: "rounded border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100", children: [_jsx("option", { value: "", children: "Output Finished Good" }), finishedGoods.map((item) => (_jsxs("option", { value: item.id, children: [item.itemCode, " - ", item.name] }, item.id)))] }), _jsxs("div", { className: "rounded border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 md:col-span-2", children: ["Active Container: ", containers.data?.data.find((c) => c.id === selectedContainerId)?.code ?? "All Accessible"] })] }), _jsx("div", { className: "mt-4 overflow-x-auto rounded border border-slate-200 bg-white", children: _jsxs("table", { className: "w-full min-w-[980px] text-left text-sm", children: [_jsx("thead", { className: "border-b border-slate-200 bg-slate-50 text-slate-600", children: _jsxs("tr", { children: [_jsx("th", { className: "px-2 py-2", children: "Source Type" }), _jsx("th", { className: "px-2 py-2", children: "Input Source" }), _jsx("th", { className: "px-2 py-2", children: "Quantity" }), _jsx("th", { className: "px-2 py-2", children: "UOM" }), _jsx("th", { className: "px-2 py-2", children: "%" }), _jsx("th", { className: "px-2 py-2", children: "Addition Seq" }), _jsx("th", { className: "px-2 py-2", children: "Action" })] }) }), _jsx("tbody", { children: ingredients.map((row, index) => (_jsxs("tr", { className: "border-b border-slate-100", children: [_jsx("td", { className: "px-2 py-2", children: _jsxs("select", { value: row.sourceType, onChange: (event) => updateIngredient(index, {
                                                        sourceType: event.target.value,
                                                        sourceId: ""
                                                    }), className: "w-full rounded border border-slate-300 px-2 py-1 text-sm", children: [_jsx("option", { value: "ITEM", children: "Item" }), _jsx("option", { value: "FORMULA", children: "Formula" })] }) }), _jsx("td", { className: "px-2 py-2", children: _jsxs("select", { value: row.sourceId, onChange: (event) => updateIngredient(index, { sourceId: event.target.value }), className: "w-full rounded border border-slate-300 px-2 py-1 text-sm", children: [_jsxs("option", { value: "", children: ["Select ", row.sourceType === "ITEM" ? "Item" : "Formula"] }), row.sourceType === "ITEM"
                                                            ? inputItemOptions.map((item) => (_jsxs("option", { value: item.id, children: [item.itemCode, " - ", item.name] }, item.id)))
                                                            : formulaInputs.map((recipe) => (_jsxs("option", { value: recipe.id, children: [recipe.formulaCode, " v", recipe.version, " - ", recipe.name] }, recipe.id)))] }) }), _jsx("td", { className: "px-2 py-2", children: _jsx("input", { value: row.quantity, onChange: (event) => updateIngredient(index, { quantity: event.target.value }), className: "w-full rounded border border-slate-300 px-2 py-1 text-sm" }) }), _jsx("td", { className: "px-2 py-2", children: _jsx("select", { value: row.uom, onChange: (event) => updateIngredient(index, { uom: event.target.value }), className: "w-full rounded border border-slate-300 px-2 py-1 text-sm", children: (uomsQuery.data?.data ?? STANDARD_UOMS).map((uom) => (_jsx("option", { value: uom.value, children: uom.value }, uom.value))) }) }), _jsx("td", { className: "px-2 py-2", children: _jsx("input", { value: row.percentage, onChange: (event) => updateIngredient(index, { percentage: event.target.value }), className: "w-full rounded border border-slate-300 px-2 py-1 text-sm" }) }), _jsx("td", { className: "px-2 py-2", children: _jsx("input", { value: row.additionSequence, onChange: (event) => updateIngredient(index, { additionSequence: event.target.value }), className: "w-full rounded border border-slate-300 px-2 py-1 text-sm" }) }), _jsx("td", { className: "px-2 py-2", children: _jsx("button", { type: "button", onClick: () => removeIngredientRow(index), className: "rounded border border-slate-300 px-2 py-1 text-xs", children: "Remove" }) })] }, `ing-${index}`))) })] }) }), _jsxs("div", { className: "mt-3 flex items-center gap-3", children: [_jsx("button", { type: "button", onClick: addIngredientRow, className: "rounded border border-slate-300 bg-white px-3 py-2 text-sm", children: "Add Input Row" }), _jsx("button", { type: "button", onClick: () => createFormula.mutate(), disabled: !form.name || createFormula.isPending, className: "rounded bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60", children: createFormula.isPending ? "Creating..." : "Create Formulation" })] }), message ? _jsx("p", { className: "mt-2 text-sm text-slate-700", children: message }) : null] }), _jsx("h2", { className: "mb-4 font-heading text-xl", children: "Formulation Management" }), isLoading ? (_jsx("p", { children: "Loading formulations..." })) : (_jsxs("table", { className: "w-full text-left text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-slate-200 text-slate-500", children: [_jsx("th", { className: "w-10 py-2", children: "\u00A0" }), configuredColumns.map((columnKey) => (_jsx("th", { className: "py-2", children: formulaColumnDefs[columnKey]?.label ?? columnKey }, columnKey))), _jsx("th", { className: "py-2", children: "Inputs" }), _jsx("th", { className: "py-2", children: "Actions" })] }) }), _jsx("tbody", { children: data?.data.map((formula) => (_jsxs("tr", { className: "border-b border-slate-100", children: [_jsx("td", { className: "py-2 text-slate-500", children: _jsx(EntityIcon, { kind: "formula" }) }), configuredColumns.map((columnKey) => (_jsx("td", { className: `py-2 ${columnKey === "formulaCode" ? "font-mono" : ""}`, children: formulaColumnDefs[columnKey]?.render(formula) ?? "" }, `${formula.id}-${columnKey}`))), _jsx("td", { className: "py-2", children: formula.ingredients?.length ?? 0 }), _jsxs("td", { className: "py-2", children: [_jsx("button", { type: "button", onClick: () => setSelectedFormulaId(formula.id), className: "rounded border border-slate-300 px-2 py-1 text-xs", children: "Open Structure" }), _jsx(Link, { to: `/formulas/${formula.id}`, className: "ml-2 rounded border border-slate-300 px-2 py-1 text-xs", children: "Open" }), _jsx("span", { className: "ml-2 inline-block", children: _jsx(ObjectActionsMenu, { onAction: (action) => void runFormulaAction(formula, action) }) })] })] }, formula.id))) })] })), selectedFormulaId ? (_jsxs("div", { className: "fixed inset-0 z-40 flex", children: [_jsx("button", { type: "button", className: "h-full flex-1 bg-black/30", onClick: () => setSelectedFormulaId(""), "aria-label": "Close panel" }), _jsxs("div", { className: "h-full w-full max-w-2xl overflow-y-auto border-l border-slate-200 bg-white p-4 shadow-xl", children: [_jsxs("div", { className: "mb-3 flex items-center justify-between", children: [_jsx("h3", { className: "font-heading text-lg", children: "Formulation Panel" }), _jsx("button", { type: "button", onClick: () => setSelectedFormulaId(""), className: "rounded border border-slate-300 bg-white px-2 py-1 text-xs", children: "Close" })] }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "rounded border border-slate-200 bg-slate-50 p-3", children: [_jsx("h4", { className: "mb-2 font-medium", children: "Structure" }), selectedFormula.isLoading ? (_jsx("p", { children: "Loading structure..." })) : (_jsxs("div", { children: [_jsxs("p", { className: "text-sm text-slate-600", children: [selectedFormula.data?.formulaCode, " v", selectedFormula.data?.version, " - ", selectedFormula.data?.name] }), _jsxs("div", { className: "mt-2 text-xs text-slate-500", children: ["Type: ", selectedFormula.data?.recipeType === "FORMULA_RECIPE" ? "Formula" : "Finished Good", selectedFormula.data?.outputItem ? ` | Output: ${selectedFormula.data.outputItem.itemCode} - ${selectedFormula.data.outputItem.name}` : ""] }), _jsx("div", { className: "mt-3 overflow-x-auto rounded border border-slate-200 bg-white", children: _jsxs("table", { className: "w-full text-left text-sm", children: [_jsx("thead", { className: "border-b border-slate-200 bg-slate-50 text-slate-600", children: _jsxs("tr", { children: [_jsx("th", { className: "px-2 py-2", children: "Input" }), _jsx("th", { className: "px-2 py-2", children: "Qty" }), _jsx("th", { className: "px-2 py-2", children: "UOM" }), _jsx("th", { className: "px-2 py-2", children: "%" }), _jsx("th", { className: "px-2 py-2", children: "Seq" })] }) }), _jsx("tbody", { children: selectedFormula.data?.ingredients?.map((ingredient, index) => (_jsxs("tr", { className: "border-b border-slate-100", children: [_jsx("td", { className: "px-2 py-2", children: ingredient.item
                                                                                    ? `${ingredient.item.itemCode} - ${ingredient.item.name}`
                                                                                    : ingredient.inputFormula
                                                                                        ? `${ingredient.inputFormula.formulaCode} v${ingredient.inputFormula.version} - ${ingredient.inputFormula.name}`
                                                                                        : "Unknown" }), _jsx("td", { className: "px-2 py-2", children: ingredient.quantity }), _jsx("td", { className: "px-2 py-2", children: ingredient.uom }), _jsx("td", { className: "px-2 py-2", children: ingredient.percentage ?? "N/A" }), _jsx("td", { className: "px-2 py-2", children: ingredient.additionSequence ?? index + 1 })] }, `${ingredient.itemId ?? ingredient.inputFormulaId ?? index}`))) })] }) })] }))] }), _jsxs("div", { className: "rounded border border-slate-200 bg-slate-50 p-3", children: [_jsx("h4", { className: "mb-2 font-medium", children: "Linkage" }), formulaLinks.isLoading ? (_jsx("p", { children: "Loading linkage..." })) : (_jsxs("div", { className: "grid gap-3 md:grid-cols-2", children: [_jsxs("div", { className: "rounded border border-slate-200 bg-white p-3 text-sm", children: [_jsxs("p", { className: "mb-1 font-medium", children: ["Linked BOMs (", formulaLinks.data?.boms.length ?? 0, ")"] }), formulaLinks.data?.boms.map((bom) => (_jsxs(Link, { to: `/bom/${bom.id}`, className: "block text-primary hover:underline", children: [bom.bomCode, " v", bom.version, " (", bom.type, ") - Lines: ", bom.lines.length] }, bom.id)))] }), _jsxs("div", { className: "rounded border border-slate-200 bg-white p-3 text-sm", children: [_jsxs("p", { className: "mb-1 font-medium", children: ["Specifications (", formulaLinks.data?.specifications.length ?? 0, ")"] }), formulaLinks.data?.specifications.map((spec) => (_jsxs("p", { className: "text-slate-600", children: [spec.specType, ": ", spec.attribute, " [", spec.minValue ?? spec.value ?? "N/A", " - ", spec.maxValue ?? "N/A", " ", spec.uom ?? "", "]"] }, spec.id)))] }), _jsxs("div", { className: "rounded border border-slate-200 bg-white p-3 text-sm", children: [_jsxs("p", { className: "mb-1 font-medium", children: ["Change Requests (", formulaLinks.data?.relatedChanges.length ?? 0, ")"] }), formulaLinks.data?.relatedChanges.map((change) => (_jsxs("p", { className: "text-slate-600", children: [change.crNumber, ": ", change.title, " (", change.status, ")"] }, change.id)))] }), _jsxs("div", { className: "rounded border border-slate-200 bg-white p-3 text-sm", children: [_jsxs("p", { className: "mb-1 font-medium", children: ["Workflows (", formulaLinks.data?.workflows.length ?? 0, ")"] }), formulaLinks.data?.workflows.map((workflow) => (_jsx("p", { className: "text-slate-600", children: workflow.currentState }, workflow.id)))] })] }))] })] })] })] })) : null] }));
}
//# sourceMappingURL=page.js.map