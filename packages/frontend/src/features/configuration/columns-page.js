import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
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
export function ConfigurationColumnsPage() {
    const queryClient = useQueryClient();
    const configQuery = useQuery({
        queryKey: ["app-config-columns"],
        queryFn: async () => (await api.get("/config")).data
    });
    const [columnDrafts, setColumnDrafts] = useState({});
    const updateListColumns = useMutation({
        mutationFn: async (input) => {
            await api.put(`/config/list-columns/${input.entity}`, { columns: input.columns });
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["app-config-columns"] });
        }
    });
    const config = configQuery.data;
    if (configQuery.isLoading) {
        return _jsx("div", { className: "rounded-xl bg-white p-4", children: "Loading list column settings..." });
    }
    if (!config) {
        return _jsx("div", { className: "rounded-xl bg-white p-4", children: "Configuration not available." });
    }
    return (_jsxs("div", { className: "space-y-4 rounded-xl bg-white p-4", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs uppercase text-slate-500", children: "Configuration" }), _jsx("h2", { className: "font-heading text-xl", children: "List Columns" })] }), _jsx("div", { className: "space-y-3", children: Object.keys(config?.listColumns ?? {}).map((entity) => {
                    const selected = columnDrafts[entity] ?? config?.listColumns[entity] ?? [];
                    return (_jsxs("div", { className: "rounded border border-slate-200 bg-slate-50 p-3", children: [_jsx("p", { className: "mb-2 text-sm font-medium text-slate-700", children: entity }), _jsx("div", { className: "grid gap-2 md:grid-cols-3", children: (columnOptions[entity] ?? []).map((option) => {
                                    const isChecked = selected.includes(option.key);
                                    return (_jsxs("label", { className: "flex items-center gap-2 rounded border border-slate-200 px-2 py-1 text-xs", children: [_jsx("input", { type: "checkbox", checked: isChecked, onChange: (event) => {
                                                    setColumnDrafts((previous) => {
                                                        const base = previous[entity] ?? config?.listColumns[entity] ?? [];
                                                        const next = event.target.checked ? [...base, option.key] : base.filter((entry) => entry !== option.key);
                                                        return { ...previous, [entity]: next };
                                                    });
                                                } }), option.label] }, option.key));
                                }) }), _jsx("button", { type: "button", onClick: () => updateListColumns.mutate({ entity, columns: selected.length ? selected : config?.listColumns[entity] ?? [] }), className: "mt-2 rounded border border-slate-300 bg-white px-3 py-1 text-xs", children: "Save Columns" })] }, entity));
                }) })] }));
}
//# sourceMappingURL=columns-page.js.map