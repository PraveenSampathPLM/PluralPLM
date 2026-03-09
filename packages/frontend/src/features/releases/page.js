import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ObjectActionsMenu } from "@/components/object-actions-menu";
import { useContainerStore } from "@/store/container.store";
import { Link } from "react-router-dom";
import { FloatingInput } from "@/components/floating-field";
import { EntityIcon } from "@/components/entity-icon";
export function ReleasesPage() {
    const { selectedContainerId } = useContainerStore();
    const queryClient = useQueryClient();
    const [message, setMessage] = useState("");
    const [form, setForm] = useState({
        rrNumber: "",
        title: "",
        description: ""
    });
    const [selectedFormulas, setSelectedFormulas] = useState([]);
    const [selectedBoms, setSelectedBoms] = useState([]);
    const { data, isLoading } = useQuery({
        queryKey: ["releases", selectedContainerId],
        queryFn: async () => (await api.get("/releases", {
            params: { ...(selectedContainerId ? { containerId: selectedContainerId } : {}) }
        })).data
    });
    const workflowInstances = useQuery({
        queryKey: ["release-workflows", data?.data.map((release) => release.id).join(","), selectedContainerId],
        queryFn: async () => {
            const ids = data?.data.map((release) => release.id).join(",");
            if (!ids) {
                return { data: [] };
            }
            return (await api.get("/workflows/instances", { params: { entityType: "RELEASE_REQUEST", entityId: ids } })).data;
        },
        enabled: Boolean(data?.data?.length)
    });
    const workflowByEntity = new Map((workflowInstances.data?.data ?? []).map((instance) => [instance.entityId, instance.currentState]));
    const formulas = useQuery({
        queryKey: ["release-formula-options"],
        queryFn: async () => (await api.get("/formulas", { params: { pageSize: 200 } })).data
    });
    const boms = useQuery({
        queryKey: ["release-bom-options"],
        queryFn: async () => (await api.get("/bom", { params: { pageSize: 200 } })).data
    });
    const createRelease = useMutation({
        mutationFn: async () => {
            await api.post("/releases", {
                rrNumber: form.rrNumber || undefined,
                title: form.title,
                description: form.description || undefined,
                containerId: selectedContainerId || undefined,
                targetFormulas: selectedFormulas,
                targetBoms: selectedBoms,
                status: "NEW"
            });
        },
        onSuccess: async () => {
            setMessage("Release request created. Linked objects were auto-collected.");
            setForm({ rrNumber: "", title: "", description: "" });
            setSelectedFormulas([]);
            setSelectedBoms([]);
            await queryClient.invalidateQueries({ queryKey: ["releases"] });
        },
        onError: (error) => {
            setMessage(error instanceof Error ? error.message : "Create failed");
        }
    });
    async function runReleaseAction(release, action) {
        try {
            if (action === "checkout") {
                await api.put(`/releases/${release.id}`, { status: "UNDER_REVIEW" });
                setMessage(`${release.rrNumber} moved to UNDER_REVIEW.`);
            }
            else if (action === "checkin") {
                await api.put(`/releases/${release.id}`, { status: "RELEASED" });
                setMessage(`${release.rrNumber} marked RELEASED.`);
            }
            else if (action === "revise") {
                await api.put(`/releases/${release.id}`, { status: "SUBMITTED" });
                setMessage(`${release.rrNumber} submitted.`);
            }
            else if (action === "copy") {
                await api.post("/releases", {
                    title: `${release.title} Copy`,
                    status: "NEW",
                    targetFormulas: [],
                    targetBoms: []
                });
                setMessage(`Copy created for ${release.rrNumber}.`);
            }
            else if (action === "delete") {
                if (!window.confirm(`Delete release request ${release.rrNumber}?`)) {
                    return;
                }
                await api.delete(`/releases/${release.id}`);
                setMessage(`${release.rrNumber} deleted.`);
            }
            await queryClient.invalidateQueries({ queryKey: ["releases"] });
        }
        catch (error) {
            setMessage(error instanceof Error ? error.message : "Action failed");
        }
    }
    return (_jsxs("div", { className: "space-y-4 rounded-xl bg-white p-4", children: [_jsxs("div", { className: "rounded-lg border border-slate-200 bg-slate-50 p-4", children: [_jsx("h3", { className: "mb-3 font-heading text-lg", children: "Create Release Request" }), _jsxs("p", { className: "mb-2 text-xs text-slate-500", children: ["Active container: ", selectedContainerId || "All Accessible"] }), _jsxs("div", { className: "grid gap-3 md:grid-cols-5", children: [_jsx(FloatingInput, { label: "RR Number", value: form.rrNumber, onChange: (event) => setForm({ ...form, rrNumber: event.target.value }) }), _jsx(FloatingInput, { label: "Title", value: form.title, onChange: (event) => setForm({ ...form, title: event.target.value }) }), _jsx(FloatingInput, { label: "Description", value: form.description, onChange: (event) => setForm({ ...form, description: event.target.value }) })] }), _jsxs("div", { className: "mt-3 grid gap-3 md:grid-cols-2", children: [_jsxs("div", { children: [_jsx("p", { className: "mb-2 text-xs font-medium text-slate-600", children: "Select Formulas" }), _jsx("div", { className: "max-h-40 overflow-y-auto rounded border border-slate-200 bg-white p-2 text-sm", children: formulas.data?.data.map((formula) => (_jsxs("label", { className: "flex items-center gap-2 py-1", children: [_jsx("input", { type: "checkbox", checked: selectedFormulas.includes(formula.id), onChange: (event) => setSelectedFormulas((prev) => event.target.checked ? [...prev, formula.id] : prev.filter((id) => id !== formula.id)) }), _jsxs("span", { className: "font-mono text-xs", children: [formula.formulaCode, " v", formula.version] }), _jsx("span", { className: "text-slate-600", children: formula.name })] }, formula.id))) })] }), _jsxs("div", { children: [_jsx("p", { className: "mb-2 text-xs font-medium text-slate-600", children: "Select BOMs" }), _jsx("div", { className: "max-h-40 overflow-y-auto rounded border border-slate-200 bg-white p-2 text-sm", children: boms.data?.data.map((bom) => (_jsxs("label", { className: "flex items-center gap-2 py-1", children: [_jsx("input", { type: "checkbox", checked: selectedBoms.includes(bom.id), onChange: (event) => setSelectedBoms((prev) => (event.target.checked ? [...prev, bom.id] : prev.filter((id) => id !== bom.id))) }), _jsxs("span", { className: "font-mono text-xs", children: [bom.bomCode, " v", bom.version] }), _jsx("span", { className: "text-slate-600", children: bom.bomType === "FG_BOM" ? "FG BOM" : "FML BOM" })] }, bom.id))) })] })] }), _jsx("button", { type: "button", onClick: () => createRelease.mutate(), disabled: !form.title || createRelease.isPending, className: "mt-3 rounded bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60", children: createRelease.isPending ? "Creating..." : "Create Release Request" }), message ? _jsx("p", { className: "mt-2 text-sm text-slate-700", children: message }) : null] }), _jsx("h2", { className: "mb-4 font-heading text-xl", children: "Release Requests" }), isLoading ? (_jsx("p", { children: "Loading release requests..." })) : (_jsxs("table", { className: "w-full text-left text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-slate-200 text-slate-500", children: [_jsx("th", { className: "w-10 py-2", children: "\u00A0" }), _jsx("th", { className: "py-2", children: "RR#" }), _jsx("th", { className: "py-2", children: "Title" }), _jsx("th", { className: "py-2", children: "Status" }), _jsx("th", { className: "py-2", children: "Workflow" }), _jsx("th", { className: "py-2", children: "Open" }), _jsx("th", { className: "py-2", children: "Actions" })] }) }), _jsx("tbody", { children: data?.data.map((release) => (_jsxs("tr", { className: "border-b border-slate-100", children: [_jsx("td", { className: "py-2 text-slate-500", children: _jsx(EntityIcon, { kind: "release" }) }), _jsx("td", { className: "py-2 font-mono", children: release.rrNumber }), _jsx("td", { className: "py-2", children: release.title }), _jsx("td", { className: "py-2", children: release.status }), _jsx("td", { className: "py-2", children: workflowByEntity.get(release.id) ? (_jsx("span", { className: "rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700", children: workflowByEntity.get(release.id) })) : (_jsx("span", { className: "text-xs text-slate-400", children: "Not started" })) }), _jsx("td", { className: "py-2", children: _jsx(Link, { to: `/releases/${release.id}`, className: "rounded border border-slate-300 px-2 py-1 text-xs", children: "Open" }) }), _jsx("td", { className: "py-2", children: _jsx(ObjectActionsMenu, { onAction: (action) => void runReleaseAction(release, action) }) })] }, release.id))) })] }))] }));
}
//# sourceMappingURL=page.js.map