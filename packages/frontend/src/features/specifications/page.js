import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { FloatingInput, FloatingSelect } from "@/components/floating-field";
export function SpecificationsPage() {
    const queryClient = useQueryClient();
    const [industry, setIndustry] = useState("CHEMICAL");
    const templates = useQuery({
        queryKey: ["spec-templates", industry],
        queryFn: async () => (await api.get(`/specifications/templates/${industry}`)).data
    });
    const [templateDrafts, setTemplateDrafts] = useState([]);
    const [newAttribute, setNewAttribute] = useState({
        specType: "",
        key: "",
        defaultUom: "",
        defaultTestMethod: "",
        valueKind: "RANGE"
    });
    useEffect(() => {
        if (templates.data?.data?.length) {
            setTemplateDrafts(templates.data.data);
            if (!newAttribute.specType) {
                setNewAttribute((prev) => ({ ...prev, specType: templates.data?.data?.[0]?.specType ?? "" }));
            }
        }
    }, [templates.data?.data]);
    const saveTemplates = useMutation({
        mutationFn: async (nextTemplates) => {
            await api.put(`/specifications/templates/${industry}`, nextTemplates);
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["spec-templates", industry] });
        }
    });
    if (templates.isLoading) {
        return _jsx("div", { className: "rounded-xl bg-white p-4", children: "Loading specification templates..." });
    }
    return (_jsxs("div", { className: "space-y-4 rounded-xl bg-white p-4", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs uppercase text-slate-500", children: "Configuration" }), _jsx("h2", { className: "font-heading text-xl", children: "Specification Templates" }), _jsx("p", { className: "text-sm text-slate-500", children: "Add fields here; create specifications from material and formula pages." })] }), _jsxs("div", { className: "rounded-lg border border-slate-200 bg-slate-50 p-3", children: [_jsx("label", { className: "text-xs font-medium uppercase text-slate-500", children: "Industry" }), _jsxs("select", { value: industry, onChange: (event) => setIndustry(event.target.value), className: "mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm md:w-64", children: [_jsx("option", { value: "FOOD_BEVERAGE", children: "Food & Beverage" }), _jsx("option", { value: "CHEMICAL", children: "Chemical" }), _jsx("option", { value: "CPG", children: "CPG" }), _jsx("option", { value: "PAINT", children: "Paints & Coatings" }), _jsx("option", { value: "TYRE", children: "Tyre & Rubber" })] })] }), _jsxs("div", { className: "rounded-lg border border-slate-200 bg-slate-50 p-4", children: [_jsx("h3", { className: "mb-3 font-heading text-lg", children: "Add Specification Field" }), _jsxs("div", { className: "grid gap-3 md:grid-cols-5", children: [_jsx(FloatingSelect, { label: "Spec Type", value: newAttribute.specType, onChange: (event) => setNewAttribute({ ...newAttribute, specType: event.target.value }), children: templateDrafts.map((template) => (_jsx("option", { value: template.specType, children: template.specType }, template.specType))) }), _jsx(FloatingInput, { label: "Attribute", value: newAttribute.key, onChange: (event) => setNewAttribute({ ...newAttribute, key: event.target.value }) }), _jsx(FloatingInput, { label: "Default UOM", value: newAttribute.defaultUom, onChange: (event) => setNewAttribute({ ...newAttribute, defaultUom: event.target.value }) }), _jsx(FloatingInput, { label: "Default Test Method", value: newAttribute.defaultTestMethod, onChange: (event) => setNewAttribute({ ...newAttribute, defaultTestMethod: event.target.value }) }), _jsxs(FloatingSelect, { label: "Value Kind", value: newAttribute.valueKind, onChange: (event) => setNewAttribute({ ...newAttribute, valueKind: event.target.value }), children: [_jsx("option", { value: "RANGE", children: "Range" }), _jsx("option", { value: "TEXT", children: "Text" })] })] }), _jsx("button", { type: "button", className: "mt-3 rounded bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60", disabled: !newAttribute.specType || !newAttribute.key || saveTemplates.isPending, onClick: () => {
                            const nextTemplates = templateDrafts.map((template) => template.specType === newAttribute.specType
                                ? {
                                    ...template,
                                    attributes: [
                                        ...template.attributes.filter((attr) => attr.key !== newAttribute.key),
                                        {
                                            key: newAttribute.key,
                                            defaultUom: newAttribute.defaultUom || undefined,
                                            defaultTestMethod: newAttribute.defaultTestMethod || undefined,
                                            valueKind: newAttribute.valueKind
                                        }
                                    ]
                                }
                                : template);
                            setTemplateDrafts(nextTemplates);
                            saveTemplates.mutate(nextTemplates);
                            setNewAttribute({ ...newAttribute, key: "", defaultUom: "", defaultTestMethod: "" });
                        }, children: saveTemplates.isPending ? "Saving..." : "Add Field" })] }), _jsx("div", { className: "space-y-3", children: templateDrafts.map((template) => (_jsxs("div", { className: "rounded border border-slate-200 bg-slate-50 p-3", children: [_jsxs("div", { className: "mb-2", children: [_jsx("p", { className: "text-sm font-medium text-slate-800", children: template.specType }), _jsx("p", { className: "text-xs text-slate-500", children: template.label })] }), _jsx("div", { className: "overflow-hidden rounded border border-slate-200 bg-white", children: _jsxs("table", { className: "w-full text-left text-xs", children: [_jsx("thead", { className: "bg-slate-100 text-[11px] uppercase text-slate-500", children: _jsxs("tr", { children: [_jsx("th", { className: "px-3 py-2", children: "Attribute" }), _jsx("th", { className: "px-3 py-2", children: "Default UOM" }), _jsx("th", { className: "px-3 py-2", children: "Default Test Method" }), _jsx("th", { className: "px-3 py-2", children: "Value Kind" }), _jsx("th", { className: "px-3 py-2", children: "Action" })] }) }), _jsx("tbody", { children: template.attributes.map((attribute) => (_jsxs("tr", { className: "border-t border-slate-100", children: [_jsx("td", { className: "px-3 py-2", children: attribute.key }), _jsx("td", { className: "px-3 py-2", children: attribute.defaultUom ?? "—" }), _jsx("td", { className: "px-3 py-2", children: attribute.defaultTestMethod ?? "—" }), _jsx("td", { className: "px-3 py-2", children: attribute.valueKind ?? "RANGE" }), _jsx("td", { className: "px-3 py-2", children: _jsx("button", { type: "button", className: "text-xs text-danger", onClick: () => {
                                                            const nextTemplates = templateDrafts.map((entry) => entry.specType === template.specType
                                                                ? { ...entry, attributes: entry.attributes.filter((attr) => attr.key !== attribute.key) }
                                                                : entry);
                                                            setTemplateDrafts(nextTemplates);
                                                            saveTemplates.mutate(nextTemplates);
                                                        }, children: "Remove" }) })] }, `${template.specType}-${attribute.key}`))) })] }) })] }, template.specType))) })] }));
}
//# sourceMappingURL=page.js.map