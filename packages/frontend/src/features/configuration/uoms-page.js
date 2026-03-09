import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { FloatingInput } from "@/components/floating-field";
import { STANDARD_UOMS } from "@/lib/uom";
export function ConfigurationUomsPage() {
    const queryClient = useQueryClient();
    const uomsQuery = useQuery({
        queryKey: ["config-uoms"],
        queryFn: async () => (await api.get("/config/uoms")).data
    });
    const [form, setForm] = useState({ value: "", label: "", category: "" });
    const uoms = useMemo(() => uomsQuery.data?.data ?? STANDARD_UOMS, [uomsQuery.data?.data]);
    const updateUoms = useMutation({
        mutationFn: async (nextUoms) => {
            await api.put("/config/uoms", nextUoms);
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["config-uoms"] });
            setForm({ value: "", label: "", category: "" });
        }
    });
    if (uomsQuery.isLoading) {
        return _jsx("div", { className: "rounded-xl bg-white p-4", children: "Loading units of measure..." });
    }
    return (_jsxs("div", { className: "space-y-4 rounded-xl bg-white p-4", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs uppercase text-slate-500", children: "Configuration" }), _jsx("h2", { className: "font-heading text-xl", children: "Units of Measure" }), _jsx("p", { className: "text-sm text-slate-500", children: "Standardize UOMs available across items, formulas, and BOMs." })] }), _jsxs("div", { className: "rounded-lg border border-slate-200 bg-slate-50 p-4", children: [_jsx("h3", { className: "mb-3 font-heading text-lg", children: "Add UOM" }), _jsxs("div", { className: "grid gap-3 md:grid-cols-3", children: [_jsx(FloatingInput, { label: "Value", value: form.value, onChange: (event) => setForm({ ...form, value: event.target.value }) }), _jsx(FloatingInput, { label: "Label", value: form.label, onChange: (event) => setForm({ ...form, label: event.target.value }) }), _jsx(FloatingInput, { label: "Category", value: form.category, onChange: (event) => setForm({ ...form, category: event.target.value }) })] }), _jsx("button", { type: "button", onClick: () => updateUoms.mutate([...uoms, form].filter((entry) => entry.value && entry.label && entry.category)), disabled: !form.value || !form.label || !form.category || updateUoms.isPending, className: "mt-3 rounded bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60", children: updateUoms.isPending ? "Saving..." : "Add UOM" })] }), _jsxs("div", { className: "rounded-lg border border-slate-200 bg-slate-50 p-4", children: [_jsx("h3", { className: "mb-3 font-heading text-lg", children: "Configured UOMs" }), _jsx("div", { className: "grid gap-2 md:grid-cols-2", children: uoms.map((uom) => (_jsxs("div", { className: "flex items-center justify-between rounded border border-slate-200 bg-white px-3 py-2 text-sm", children: [_jsxs("div", { children: [_jsx("p", { className: "font-medium text-slate-700", children: uom.label }), _jsxs("p", { className: "text-xs text-slate-500", children: [uom.value, " \u00B7 ", uom.category] })] }), _jsx("button", { type: "button", onClick: () => updateUoms.mutate(uoms.filter((entry) => entry.value !== uom.value)), className: "text-xs text-danger", children: "Remove" })] }, uom.value))) })] })] }));
}
//# sourceMappingURL=uoms-page.js.map