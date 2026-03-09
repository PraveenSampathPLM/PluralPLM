import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { FloatingInput } from "@/components/floating-field";
const sequenceLabels = {
    ITEM: "Raw Material / Intermediate",
    ITEM_FINISHED_GOOD: "Finished Good",
    ITEM_PACKAGING: "Packaging",
    FORMULA: "Formula",
    BOM: "BOM",
    CHANGE_REQUEST: "Change Request",
    DOCUMENT: "Document"
};
export function ConfigurationNumberingPage() {
    const queryClient = useQueryClient();
    const configQuery = useQuery({
        queryKey: ["app-config-numbering"],
        queryFn: async () => (await api.get("/config")).data
    });
    const updateSequence = useMutation({
        mutationFn: async (input) => {
            await api.put(`/config/number-sequences/${input.entity}`, {
                prefix: input.prefix,
                padding: input.padding,
                next: input.next
            });
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["app-config-numbering"] });
        }
    });
    const config = configQuery.data;
    if (configQuery.isLoading) {
        return _jsx("div", { className: "rounded-xl bg-white p-4", children: "Loading numbering configuration..." });
    }
    if (!config) {
        return _jsx("div", { className: "rounded-xl bg-white p-4", children: "Configuration not available." });
    }
    return (_jsxs("div", { className: "space-y-4 rounded-xl bg-white p-4", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs uppercase text-slate-500", children: "Configuration" }), _jsx("h2", { className: "font-heading text-xl", children: "Smart Numbering" })] }), _jsx("div", { className: "grid gap-3 md:grid-cols-2", children: Object.keys(config?.numberSequences ?? {}).map((entity) => {
                    const sequence = config?.numberSequences[entity];
                    if (!sequence) {
                        return null;
                    }
                    return (_jsxs("div", { className: "rounded border border-slate-200 bg-slate-50 p-3", children: [_jsx("p", { className: "mb-1 text-sm font-medium text-slate-700", children: sequenceLabels[entity] }), _jsx("p", { className: "mb-2 text-xs text-slate-500", children: entity }), _jsxs("div", { className: "grid gap-2", children: [_jsx(FloatingInput, { label: "Prefix", defaultValue: sequence.prefix, onBlur: (event) => updateSequence.mutate({ entity, prefix: event.target.value, padding: sequence.padding, next: sequence.next }) }), _jsx(FloatingInput, { type: "number", label: "Padding", defaultValue: sequence.padding, onBlur: (event) => updateSequence.mutate({ entity, prefix: sequence.prefix, padding: Number(event.target.value), next: sequence.next }) }), _jsx(FloatingInput, { type: "number", label: "Next Number", defaultValue: sequence.next, onBlur: (event) => updateSequence.mutate({ entity, prefix: sequence.prefix, padding: sequence.padding, next: Number(event.target.value) }) }), _jsxs("p", { className: "text-xs text-slate-500", children: ["Next Preview: ", sequence.prefix, String(sequence.next).padStart(sequence.padding, "0")] })] })] }, entity));
                }) })] }));
}
//# sourceMappingURL=numbering-page.js.map