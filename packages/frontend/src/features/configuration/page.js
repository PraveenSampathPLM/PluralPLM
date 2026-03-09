import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { FloatingInput, FloatingSelect } from "@/components/floating-field";
const sequenceLabels = {
    ITEM: "Raw Material / Intermediate",
    ITEM_FINISHED_GOOD: "Finished Good",
    ITEM_PACKAGING: "Packaging",
    FORMULA: "Formula",
    BOM: "BOM",
    CHANGE_REQUEST: "Change Request",
    DOCUMENT: "Document"
};
const columnOptions = {
    ITEM: [
        { key: "itemCode", label: "Item Code" },
        { key: "revisionLabel", label: "Revision" },
        { key: "name", label: "Name" },
        { key: "itemType", label: "Type" },
        { key: "uom", label: "UOM" },
        { key: "status", label: "Status" },
        { key: "updatedAt", label: "Updated" }
    ],
    FORMULA: [
        { key: "formulaCode", label: "Formula Code" },
        { key: "revisionLabel", label: "Revision" },
        { key: "name", label: "Name" },
        { key: "version", label: "Version" },
        { key: "status", label: "Status" },
        { key: "updatedAt", label: "Updated" }
    ],
    BOM: [
        { key: "bomCode", label: "BOM Code" },
        { key: "revisionLabel", label: "Revision" },
        { key: "type", label: "Type" },
        { key: "version", label: "Version" },
        { key: "effectiveDate", label: "Effective Date" },
        { key: "updatedAt", label: "Updated" }
    ],
    CHANGE_REQUEST: [
        { key: "crNumber", label: "CR Number" },
        { key: "title", label: "Title" },
        { key: "type", label: "Type" },
        { key: "priority", label: "Priority" },
        { key: "status", label: "Status" }
    ],
    SPECIFICATION: [
        { key: "specType", label: "Spec Type" },
        { key: "attribute", label: "Attribute" },
        { key: "value", label: "Value" },
        { key: "minValue", label: "Min" },
        { key: "maxValue", label: "Max" },
        { key: "uom", label: "UOM" },
        { key: "testMethod", label: "Test Method" }
    ]
};
export function ConfigurationPage() {
    const queryClient = useQueryClient();
    const configQuery = useQuery({
        queryKey: ["app-config"],
        queryFn: async () => (await api.get("/config")).data
    });
    const [attributeForm, setAttributeForm] = useState({
        entity: "ITEM",
        key: "",
        label: "",
        type: "text",
        required: false
    });
    const [columnDrafts, setColumnDrafts] = useState({});
    const updateSequence = useMutation({
        mutationFn: async (input) => {
            await api.put(`/config/number-sequences/${input.entity}`, {
                prefix: input.prefix,
                padding: input.padding,
                next: input.next
            });
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["app-config"] });
        }
    });
    const updateRevision = useMutation({
        mutationFn: async (input) => {
            await api.put(`/config/revision-schemes/${input.entity}`, {
                style: input.style,
                delimiter: input.delimiter
            });
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["app-config"] });
        }
    });
    const updateListColumns = useMutation({
        mutationFn: async (input) => {
            await api.put(`/config/list-columns/${input.entity}`, { columns: input.columns });
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["app-config"] });
        }
    });
    const addAttribute = useMutation({
        mutationFn: async () => {
            await api.post("/config/attributes", attributeForm);
        },
        onSuccess: async () => {
            setAttributeForm({ entity: "ITEM", key: "", label: "", type: "text", required: false });
            await queryClient.invalidateQueries({ queryKey: ["app-config"] });
        }
    });
    const removeAttribute = useMutation({
        mutationFn: async (input) => {
            await api.delete(`/config/attributes/${input.entity}/${input.key}`);
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["app-config"] });
        }
    });
    const config = configQuery.data;
    if (configQuery.isLoading) {
        return _jsx("div", { className: "rounded-xl bg-white p-4", children: "Loading configuration..." });
    }
    if (!config) {
        return _jsx("div", { className: "rounded-xl bg-white p-4", children: "Configuration not available." });
    }
    return (_jsxs("div", { className: "space-y-6 rounded-xl bg-white p-4", children: [_jsx("h2", { className: "font-heading text-xl", children: "Configuration" }), _jsxs("div", { className: "rounded-lg border border-slate-200 bg-slate-50 p-4", children: [_jsx("h3", { className: "mb-3 font-heading text-lg", children: "Smart Numbering" }), _jsx("div", { className: "grid gap-3 md:grid-cols-2", children: Object.keys(config?.numberSequences ?? {}).map((entity) => {
                            const sequence = config?.numberSequences[entity];
                            if (!sequence) {
                                return null;
                            }
                            return (_jsxs("div", { className: "rounded border border-slate-200 bg-white p-3", children: [_jsx("p", { className: "mb-1 text-sm font-medium text-slate-700", children: sequenceLabels[entity] }), _jsx("p", { className: "mb-2 text-xs text-slate-500", children: entity }), _jsxs("div", { className: "grid gap-2", children: [_jsx(FloatingInput, { label: "Prefix", defaultValue: sequence.prefix, onBlur: (event) => updateSequence.mutate({ entity, prefix: event.target.value, padding: sequence.padding, next: sequence.next }) }), _jsx(FloatingInput, { type: "number", label: "Padding", defaultValue: sequence.padding, onBlur: (event) => updateSequence.mutate({ entity, prefix: sequence.prefix, padding: Number(event.target.value), next: sequence.next }) }), _jsx(FloatingInput, { type: "number", label: "Next Number", defaultValue: sequence.next, onBlur: (event) => updateSequence.mutate({ entity, prefix: sequence.prefix, padding: sequence.padding, next: Number(event.target.value) }) }), _jsxs("p", { className: "text-xs text-slate-500", children: ["Next Preview: ", sequence.prefix, String(sequence.next).padStart(sequence.padding, "0")] })] })] }, entity));
                        }) })] }), _jsxs("div", { className: "rounded-lg border border-slate-200 bg-slate-50 p-4", children: [_jsx("h3", { className: "mb-3 font-heading text-lg", children: "Revision Scheme" }), _jsx("div", { className: "grid gap-3 md:grid-cols-3", children: Object.keys(config?.revisionSchemes ?? {}).map((entity) => {
                            const scheme = config?.revisionSchemes[entity];
                            if (!scheme) {
                                return null;
                            }
                            return (_jsxs("div", { className: "rounded border border-slate-200 bg-white p-3", children: [_jsx("p", { className: "mb-2 text-sm font-medium text-slate-700", children: entity }), _jsxs(FloatingSelect, { label: "Revision Style", value: scheme.style, onChange: (event) => updateRevision.mutate({
                                            entity,
                                            style: event.target.value,
                                            delimiter: scheme.delimiter
                                        }), children: [_jsx("option", { value: "NUMERIC", children: "Numeric (1.1, 2.1)" }), _jsx("option", { value: "ALPHA_NUMERIC", children: "Alpha Numeric (A.1, B.1)" })] }), _jsx(FloatingInput, { label: "Delimiter", defaultValue: scheme.delimiter, onBlur: (event) => updateRevision.mutate({
                                            entity,
                                            style: scheme.style,
                                            delimiter: event.target.value || "."
                                        }) }), _jsxs("p", { className: "mt-2 text-xs text-slate-500", children: ["Example: ", scheme.style === "ALPHA_NUMERIC" ? `A${scheme.delimiter}1` : `1${scheme.delimiter}1`] })] }, entity));
                        }) })] }), _jsxs("div", { className: "rounded-lg border border-slate-200 bg-slate-50 p-4", children: [_jsx("h3", { className: "mb-3 font-heading text-lg", children: "List Columns" }), _jsx("div", { className: "space-y-3", children: Object.keys(config?.listColumns ?? {}).map((entity) => {
                            const selected = columnDrafts[entity] ?? config?.listColumns[entity] ?? [];
                            return (_jsxs("div", { className: "rounded border border-slate-200 bg-white p-3", children: [_jsx("p", { className: "mb-2 text-sm font-medium text-slate-700", children: entity }), _jsx("div", { className: "grid gap-2 md:grid-cols-3", children: (columnOptions[entity] ?? []).map((option) => {
                                            const isChecked = selected.includes(option.key);
                                            return (_jsxs("label", { className: "flex items-center gap-2 rounded border border-slate-200 px-2 py-1 text-xs", children: [_jsx("input", { type: "checkbox", checked: isChecked, onChange: (event) => {
                                                            setColumnDrafts((previous) => {
                                                                const base = previous[entity] ?? config?.listColumns[entity] ?? [];
                                                                const next = event.target.checked
                                                                    ? [...base, option.key]
                                                                    : base.filter((entry) => entry !== option.key);
                                                                return { ...previous, [entity]: next };
                                                            });
                                                        } }), option.label] }, option.key));
                                        }) }), _jsx("button", { type: "button", onClick: () => updateListColumns.mutate({ entity, columns: selected.length ? selected : config?.listColumns[entity] ?? [] }), className: "mt-2 rounded border border-slate-300 bg-white px-3 py-1 text-xs", children: "Save Columns" })] }, entity));
                        }) })] }), _jsxs("div", { className: "rounded-lg border border-slate-200 bg-slate-50 p-4", children: [_jsx("h3", { className: "mb-3 font-heading text-lg", children: "Custom Attributes" }), _jsxs("div", { className: "grid gap-3 md:grid-cols-5", children: [_jsx(FloatingInput, { label: "Entity", value: "ITEM", readOnly: true }), _jsx(FloatingInput, { label: "Key", value: attributeForm.key, onChange: (event) => setAttributeForm({ ...attributeForm, key: event.target.value }) }), _jsx(FloatingInput, { label: "Label", value: attributeForm.label, onChange: (event) => setAttributeForm({ ...attributeForm, label: event.target.value }) }), _jsxs(FloatingSelect, { label: "Type", value: attributeForm.type, onChange: (event) => setAttributeForm({ ...attributeForm, type: event.target.value }), children: [_jsx("option", { value: "text", children: "text" }), _jsx("option", { value: "number", children: "number" }), _jsx("option", { value: "boolean", children: "boolean" })] }), _jsxs("label", { className: "flex items-center gap-2 rounded border border-slate-300 px-3 py-2 text-sm", children: [_jsx("input", { type: "checkbox", checked: attributeForm.required, onChange: (event) => setAttributeForm({ ...attributeForm, required: event.target.checked }) }), "Required"] })] }), _jsx("button", { type: "button", onClick: () => addAttribute.mutate(), disabled: !attributeForm.key || !attributeForm.label || addAttribute.isPending, className: "mt-3 rounded bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60", children: addAttribute.isPending ? "Adding..." : "Add Attribute" }), _jsxs("div", { className: "mt-4 rounded border border-slate-200 bg-white p-3", children: [_jsx("p", { className: "mb-2 text-sm font-medium", children: "ITEM" }), _jsx("div", { className: "space-y-2", children: (config?.attributeDefinitions?.ITEM ?? []).map((attribute) => (_jsxs("div", { className: "flex items-center justify-between rounded border border-slate-100 px-2 py-1 text-sm", children: [_jsxs("span", { children: [attribute.label, " (", attribute.key, ") [", attribute.type, "] ", attribute.required ? "*" : ""] }), _jsx("button", { type: "button", onClick: () => removeAttribute.mutate({ entity: "ITEM", key: attribute.key }), className: "text-xs text-danger", children: "Remove" })] }, attribute.key))) })] })] })] }));
}
//# sourceMappingURL=page.js.map