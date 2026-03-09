import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQueries, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useContainerStore } from "@/store/container.store";
import { Package as ItemIcon, Beaker as FormulaIcon, Layers as BomIcon, FileText as DocIcon, GitCompare as ChangeIcon, Rocket as ReleaseIcon } from "lucide-react";
import { EntityIcon } from "@/components/entity-icon";
const entityConfigs = [
    {
        key: "items",
        label: "Materials",
        icon: ItemIcon,
        endpoint: "/items",
        to: (row) => `/items/${row.id}`,
        map: (row) => ({
            id: row.id,
            code: row.itemCode,
            name: row.name,
            type: row.itemType,
            status: row.status
        })
    },
    {
        key: "formulas",
        label: "Formulations",
        icon: FormulaIcon,
        endpoint: "/formulas",
        to: (row) => `/formulas/${row.id}`,
        map: (row) => ({
            id: row.id,
            code: row.formulaCode,
            name: row.name,
            type: row.recipeType,
            status: row.status
        })
    },
    {
        key: "bom",
        label: "BOMs",
        icon: BomIcon,
        endpoint: "/bom",
        to: (row) => `/bom/${row.id}`,
        map: (row) => ({
            id: row.id,
            code: row.bomCode ?? row.code ?? "BOM",
            name: row.parentItem?.name ?? row.name ?? "",
            type: row.type,
            status: row.state ?? row.status
        })
    },
    {
        key: "documents",
        label: "Documents",
        icon: DocIcon,
        endpoint: "/documents",
        to: (row) => `/documents/${row.id}`,
        map: (row) => ({
            id: row.id,
            code: row.documentNumber,
            name: row.title ?? row.name,
            type: row.classification,
            status: row.status
        })
    },
    {
        key: "changes",
        label: "Change Requests",
        icon: ChangeIcon,
        endpoint: "/changes",
        to: (row) => `/changes/${row.id}`,
        map: (row) => ({
            id: row.id,
            code: row.crNumber,
            name: row.title,
            type: row.type,
            status: row.status
        })
    },
    {
        key: "releases",
        label: "Release Requests",
        icon: ReleaseIcon,
        endpoint: "/releases",
        to: (row) => `/releases/${row.id}`,
        map: (row) => ({
            id: row.id,
            code: row.rrNumber ?? row.releaseNumber ?? row.code,
            name: row.title ?? "Release",
            type: row.type,
            status: row.status
        })
    }
];
export function AdvancedSearchPage() {
    const { selectedContainerId } = useContainerStore();
    const [query, setQuery] = useState("");
    const [debounced, setDebounced] = useState("");
    const [active, setActive] = useState(entityConfigs.map((c) => c.key));
    const [attrRows, setAttrRows] = useState([]);
    const [attrBoolean, setAttrBoolean] = useState("AND");
    const config = useQuery({
        queryKey: ["search-attributes"],
        queryFn: async () => (await api.get("/config")).data
    });
    const attrOptions = config.data?.attributeDefinitions?.ITEM ?? [];
    useEffect(() => {
        const id = setTimeout(() => setDebounced(query.trim()), 350);
        return () => clearTimeout(id);
    }, [query]);
    const attributePayload = attrRows
        .filter((row) => row.key && row.value !== "")
        .map((row) => ({ key: row.key, op: row.op, value: row.value, type: row.type }));
    const queries = useQueries({
        queries: entityConfigs.map((config) => ({
            queryKey: ["search", config.key, debounced, selectedContainerId, attributePayload, attrBoolean],
            queryFn: async () => {
                const res = await api.get(config.endpoint, {
                    params: {
                        search: debounced,
                        pageSize: 15,
                        ...(selectedContainerId ? { containerId: selectedContainerId } : {}),
                        ...(config.key === "items" && attributePayload.length
                            ? {
                                attributeFilters: JSON.stringify(attributePayload),
                                attributeBoolean: attrBoolean
                            }
                            : {})
                    }
                });
                return res.data.data.map(config.map);
            },
            enabled: Boolean(debounced) && active.includes(config.key)
        }))
    });
    const isLoading = queries.some((q) => q.isLoading);
    const anyActive = active.length > 0;
    const results = useMemo(() => {
        const map = {
            items: [],
            formulas: [],
            bom: [],
            documents: [],
            changes: [],
            releases: []
        };
        queries.forEach((q, idx) => {
            const key = entityConfigs[idx].key;
            if (q.data) {
                map[key] = q.data;
            }
        });
        return map;
    }, [queries]);
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("header", { className: "rounded-2xl border border-slate-200 bg-white p-6 shadow-sm", children: [_jsx("p", { className: "text-xs uppercase tracking-[0.2em] text-slate-400", children: "Advanced Search" }), _jsx("h1", { className: "mt-2 font-heading text-2xl font-semibold text-slate-900", children: "Search across Plural PLM" }), _jsx("p", { className: "mt-2 text-sm text-slate-600", children: "Search materials, formulations, BOMs, documents, and lifecycle records with one query. Results are scoped to your selected container." }), _jsxs("div", { className: "mt-4 flex flex-col gap-3 md:flex-row md:items-center", children: [_jsx("input", { value: query, onChange: (e) => setQuery(e.target.value), placeholder: "Search by code, name, or description...", className: "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none" }), _jsx("div", { className: "flex flex-wrap gap-2", children: entityConfigs.map((config) => {
                                    const checked = active.includes(config.key);
                                    return (_jsx("button", { type: "button", onClick: () => setActive((prev) => checked ? prev.filter((k) => k !== config.key) : [...prev, config.key]), className: `rounded-full border px-3 py-1 text-xs ${checked ? "border-primary bg-primary/10 text-primary" : "border-slate-300 text-slate-600"}`, children: config.label }, config.key));
                                }) })] }), active.includes("items") ? (_jsxs("div", { className: "mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-[0.2em] text-slate-500", children: "Attribute Filters (Materials)" }), _jsxs("div", { className: "flex items-center gap-2 text-xs text-slate-600", children: [_jsx("span", { children: "Match" }), _jsxs("select", { value: attrBoolean, onChange: (e) => setAttrBoolean(e.target.value === "OR" ? "OR" : "AND"), className: "rounded border border-slate-300 bg-white px-2 py-1 text-xs", children: [_jsx("option", { value: "AND", children: "All (AND)" }), _jsx("option", { value: "OR", children: "Any (OR)" })] })] })] }), _jsx("div", { className: "space-y-2", children: attrRows.map((row, idx) => {
                                    const selected = attrOptions.find((opt) => opt.key === row.key);
                                    const type = selected?.type ?? row.type;
                                    return (_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsxs("select", { value: row.key, onChange: (e) => {
                                                    const key = e.target.value;
                                                    const def = attrOptions.find((opt) => opt.key === key);
                                                    setAttrRows((prev) => prev.map((r, i) => i === idx
                                                        ? { ...r, key, type: def?.type ?? r.type, op: def?.type === "number" ? "equals" : r.op, value: "" }
                                                        : r));
                                                }, className: "min-w-[160px] rounded border border-slate-300 bg-white px-2 py-1 text-xs", children: [_jsx("option", { value: "", children: "Attribute\u2026" }), attrOptions.map((opt) => (_jsx("option", { value: opt.key, children: opt.label }, opt.key)))] }), _jsx("select", { value: row.op, onChange: (e) => setAttrRows((prev) => prev.map((r, i) => (i === idx ? { ...r, op: e.target.value } : r))), className: "rounded border border-slate-300 bg-white px-2 py-1 text-xs", children: type === "text" ? (_jsxs(_Fragment, { children: [_jsx("option", { value: "contains", children: "contains" }), _jsx("option", { value: "equals", children: "equals" })] })) : type === "number" ? (_jsxs(_Fragment, { children: [_jsx("option", { value: "equals", children: "equals" }), _jsx("option", { value: "gt", children: ">" }), _jsx("option", { value: "gte", children: "\u2265" }), _jsx("option", { value: "lt", children: "<" }), _jsx("option", { value: "lte", children: "\u2264" })] })) : (_jsx("option", { value: "equals", children: "is" })) }), type === "boolean" ? (_jsxs("select", { value: row.value, onChange: (e) => setAttrRows((prev) => prev.map((r, i) => (i === idx ? { ...r, value: e.target.value } : r))), className: "rounded border border-slate-300 bg-white px-2 py-1 text-xs", children: [_jsx("option", { value: "", children: "Select" }), _jsx("option", { value: "true", children: "True" }), _jsx("option", { value: "false", children: "False" })] })) : (_jsx("input", { value: row.value, onChange: (e) => setAttrRows((prev) => prev.map((r, i) => (i === idx ? { ...r, value: e.target.value } : r))), placeholder: type === "number" ? "Value" : "Text", className: "min-w-[140px] rounded border border-slate-300 px-2 py-1 text-xs", type: type === "number" ? "number" : "text" })), _jsx("button", { type: "button", onClick: () => setAttrRows((prev) => prev.filter((_, i) => i !== idx)), className: "rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100", children: "\u2212" })] }, idx));
                                }) }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { type: "button", onClick: () => setAttrRows((prev) => [
                                            ...prev,
                                            { key: "", op: "contains", value: "", type: "text" }
                                        ]), className: "rounded border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 hover:bg-slate-100", children: "+ Add attribute filter" }), attributePayload.length ? (_jsxs("span", { className: "text-xs text-slate-500", children: [attributePayload.length, " applied"] })) : null] })] })) : null, !anyActive ? (_jsx("p", { className: "mt-2 text-xs text-red-600", children: "Select at least one entity to search." })) : null] }), debounced ? (_jsx("div", { className: "space-y-4", children: entityConfigs.map((config, idx) => {
                    if (!active.includes(config.key))
                        return null;
                    const queryResult = queries[idx];
                    const rows = results[config.key];
                    return (_jsxs("section", { className: "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs uppercase tracking-[0.2em] text-slate-400", children: config.label }), _jsxs("p", { className: "text-sm text-slate-600", children: [rows.length, " result(s)"] })] }), queryResult.isFetching ? _jsx("p", { className: "text-xs text-slate-500", children: "Loading\u2026" }) : null] }), isLoading && !rows.length ? (_jsx("div", { className: "mt-3 h-16 animate-pulse rounded-lg bg-slate-100" })) : rows.length ? (_jsx("div", { className: "mt-3 overflow-hidden rounded-lg border border-slate-200", children: _jsxs("table", { className: "min-w-full divide-y divide-slate-200 text-sm", children: [_jsx("thead", { className: "bg-slate-50 text-xs uppercase tracking-wide text-slate-500", children: _jsxs("tr", { children: [_jsx("th", { className: "w-10 px-3 py-2 text-left", children: "\u00A0" }), _jsx("th", { className: "px-3 py-2 text-left", children: "Code" }), _jsx("th", { className: "px-3 py-2 text-left", children: "Name" }), _jsx("th", { className: "px-3 py-2 text-left", children: "Type" }), _jsx("th", { className: "px-3 py-2 text-left", children: "Status" })] }) }), _jsx("tbody", { className: "divide-y divide-slate-100", children: rows.map((row) => (_jsxs("tr", { className: "hover:bg-slate-50", children: [_jsx("td", { className: "px-3 py-2 text-slate-500", children: config.key === "items" ? (_jsx(EntityIcon, { kind: "item", variant: row.type })) : (_jsx(config.icon, { size: 16, strokeWidth: 1.75 })) }), _jsx("td", { className: "px-3 py-2 font-mono text-xs text-primary", children: _jsx(Link, { to: config.to(row), children: row.code }) }), _jsx("td", { className: "px-3 py-2 text-slate-800", children: _jsx(Link, { to: config.to(row), className: "hover:underline", children: row.name }) }), _jsx("td", { className: "px-3 py-2 text-slate-600", children: row.type ?? "—" }), _jsx("td", { className: "px-3 py-2 text-slate-600", children: row.status ?? "—" })] }, row.id))) })] }) })) : (_jsx("p", { className: "mt-3 text-sm text-slate-500", children: "No results." }))] }, config.key));
                }) })) : (_jsx("div", { className: "rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500", children: "Enter a query to see results across all selected modules." }))] }));
}
//# sourceMappingURL=page.js.map