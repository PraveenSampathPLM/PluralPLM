import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { FloatingInput, FloatingSelect } from "@/components/floating-field";
export function ConfigurationAttributesPage() {
    const queryClient = useQueryClient();
    const configQuery = useQuery({
        queryKey: ["app-config-attributes"],
        queryFn: async () => (await api.get("/config")).data
    });
    const [attributeForm, setAttributeForm] = useState({
        entity: "ITEM",
        key: "",
        label: "",
        type: "text",
        required: false
    });
    const addAttribute = useMutation({
        mutationFn: async () => {
            await api.post("/config/attributes", attributeForm);
        },
        onSuccess: async () => {
            setAttributeForm({ entity: "ITEM", key: "", label: "", type: "text", required: false });
            await queryClient.invalidateQueries({ queryKey: ["app-config-attributes"] });
        }
    });
    const removeAttribute = useMutation({
        mutationFn: async (input) => {
            await api.delete(`/config/attributes/${input.entity}/${input.key}`);
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["app-config-attributes"] });
        }
    });
    const config = configQuery.data;
    if (configQuery.isLoading) {
        return _jsx("div", { className: "rounded-xl bg-white p-4", children: "Loading attribute definitions..." });
    }
    if (!config) {
        return _jsx("div", { className: "rounded-xl bg-white p-4", children: "Configuration not available." });
    }
    return (_jsxs("div", { className: "space-y-4 rounded-xl bg-white p-4", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs uppercase text-slate-500", children: "Configuration" }), _jsx("h2", { className: "font-heading text-xl", children: "Custom Attributes" })] }), _jsxs("div", { className: "rounded-lg border border-slate-200 bg-slate-50 p-4", children: [_jsx("h3", { className: "mb-3 font-heading text-lg", children: "Add Attribute" }), _jsxs("div", { className: "grid gap-3 md:grid-cols-5", children: [_jsx(FloatingInput, { label: "Entity", value: "ITEM", readOnly: true }), _jsx(FloatingInput, { label: "Key", value: attributeForm.key, onChange: (event) => setAttributeForm({ ...attributeForm, key: event.target.value }) }), _jsx(FloatingInput, { label: "Label", value: attributeForm.label, onChange: (event) => setAttributeForm({ ...attributeForm, label: event.target.value }) }), _jsxs(FloatingSelect, { label: "Type", value: attributeForm.type, onChange: (event) => setAttributeForm({ ...attributeForm, type: event.target.value }), children: [_jsx("option", { value: "text", children: "text" }), _jsx("option", { value: "number", children: "number" }), _jsx("option", { value: "boolean", children: "boolean" })] }), _jsxs("label", { className: "flex items-center gap-2 rounded border border-slate-300 px-3 py-2 text-sm", children: [_jsx("input", { type: "checkbox", checked: attributeForm.required, onChange: (event) => setAttributeForm({ ...attributeForm, required: event.target.checked }) }), "Required"] })] }), _jsx("button", { type: "button", onClick: () => addAttribute.mutate(), disabled: !attributeForm.key || !attributeForm.label || addAttribute.isPending, className: "mt-3 rounded bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60", children: addAttribute.isPending ? "Adding..." : "Add Attribute" })] }), _jsxs("div", { className: "rounded-lg border border-slate-200 bg-slate-50 p-4", children: [_jsx("h3", { className: "mb-3 font-heading text-lg", children: "Defined Attributes" }), _jsx("div", { className: "space-y-2", children: (config?.attributeDefinitions?.ITEM ?? []).map((attribute) => (_jsxs("div", { className: "flex items-center justify-between rounded border border-slate-100 bg-white px-3 py-2 text-sm", children: [_jsxs("span", { children: [attribute.label, " (", attribute.key, ") [", attribute.type, "] ", attribute.required ? "*" : ""] }), _jsx("button", { type: "button", onClick: () => removeAttribute.mutate({ entity: "ITEM", key: attribute.key }), className: "text-xs text-danger", children: "Remove" })] }, attribute.key))) })] })] }));
}
//# sourceMappingURL=attributes-page.js.map