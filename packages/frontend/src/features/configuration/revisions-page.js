import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { FloatingSelect, FloatingInput } from "@/components/floating-field";
export function ConfigurationRevisionsPage() {
    const queryClient = useQueryClient();
    const configQuery = useQuery({
        queryKey: ["app-config-revisions"],
        queryFn: async () => (await api.get("/config")).data
    });
    const updateRevision = useMutation({
        mutationFn: async (input) => {
            await api.put(`/config/revision-schemes/${input.entity}`, {
                style: input.style,
                delimiter: input.delimiter
            });
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["app-config-revisions"] });
        }
    });
    const config = configQuery.data;
    if (configQuery.isLoading) {
        return _jsx("div", { className: "rounded-xl bg-white p-4", children: "Loading revision schemes..." });
    }
    if (!config) {
        return _jsx("div", { className: "rounded-xl bg-white p-4", children: "Configuration not available." });
    }
    return (_jsxs("div", { className: "space-y-4 rounded-xl bg-white p-4", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs uppercase text-slate-500", children: "Configuration" }), _jsx("h2", { className: "font-heading text-xl", children: "Revision Schemes" })] }), _jsx("div", { className: "grid gap-3 md:grid-cols-3", children: Object.keys(config?.revisionSchemes ?? {}).map((entity) => {
                    const scheme = config?.revisionSchemes[entity];
                    if (!scheme) {
                        return null;
                    }
                    return (_jsxs("div", { className: "rounded border border-slate-200 bg-slate-50 p-3", children: [_jsx("p", { className: "mb-2 text-sm font-medium text-slate-700", children: entity }), _jsxs(FloatingSelect, { label: "Revision Style", defaultValue: scheme.style, onChange: (event) => updateRevision.mutate({ entity, style: event.target.value, delimiter: scheme.delimiter }), children: [_jsx("option", { value: "NUMERIC", children: "Numeric (1.1)" }), _jsx("option", { value: "ALPHA_NUMERIC", children: "Alpha Numeric (A.1)" })] }), _jsxs("div", { className: "mt-2", children: [_jsx(FloatingInput, { label: "Delimiter", defaultValue: scheme.delimiter, onBlur: (event) => updateRevision.mutate({ entity, style: scheme.style, delimiter: event.target.value || "." }) }), _jsxs("p", { className: "mt-2 text-xs text-slate-500", children: ["Example: ", scheme.style === "ALPHA_NUMERIC" ? `A${scheme.delimiter}1` : `1${scheme.delimiter}1`] })] })] }, entity));
                }) })] }));
}
//# sourceMappingURL=revisions-page.js.map