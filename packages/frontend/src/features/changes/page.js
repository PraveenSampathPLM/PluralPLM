import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ObjectActionsMenu } from "@/components/object-actions-menu";
import { useContainerStore } from "@/store/container.store";
import { Link } from "react-router-dom";
import { FloatingInput, FloatingSelect } from "@/components/floating-field";
import { EntityIcon } from "@/components/entity-icon";
export function ChangesPage() {
    const { selectedContainerId } = useContainerStore();
    const queryClient = useQueryClient();
    const [message, setMessage] = useState("");
    const [form, setForm] = useState({
        crNumber: "",
        title: "",
        type: "ECR",
        priority: "MEDIUM",
        impactAssessment: ""
    });
    const { data, isLoading } = useQuery({
        queryKey: ["changes", selectedContainerId],
        queryFn: async () => (await api.get("/changes", {
            params: { ...(selectedContainerId ? { containerId: selectedContainerId } : {}) }
        })).data
    });
    const workflowInstances = useQuery({
        queryKey: ["change-workflows", data?.data.map((change) => change.id).join(","), selectedContainerId],
        queryFn: async () => {
            const ids = data?.data.map((change) => change.id).join(",");
            if (!ids) {
                return { data: [] };
            }
            return (await api.get("/workflows/instances", { params: { entityType: "CHANGE_REQUEST", entityId: ids } })).data;
        },
        enabled: Boolean(data?.data?.length)
    });
    const workflowByEntity = new Map((workflowInstances.data?.data ?? []).map((instance) => [instance.entityId, instance.currentState]));
    const createChange = useMutation({
        mutationFn: async () => {
            await api.post("/changes", {
                crNumber: form.crNumber || undefined,
                title: form.title,
                type: form.type,
                priority: form.priority,
                containerId: selectedContainerId || undefined,
                impactAssessment: form.impactAssessment,
                status: "NEW",
                affectedItems: [],
                affectedFormulas: []
            });
        },
        onSuccess: async () => {
            setMessage("Change request created successfully.");
            setForm({ crNumber: "", title: "", type: "ECR", priority: "MEDIUM", impactAssessment: "" });
            await queryClient.invalidateQueries({ queryKey: ["changes"] });
        },
        onError: (error) => {
            setMessage(error instanceof Error ? error.message : "Create failed");
        }
    });
    async function runChangeAction(change, action) {
        try {
            if (action === "checkout") {
                await api.put(`/changes/${change.id}`, { status: "UNDER_REVIEW" });
                setMessage(`${change.crNumber} checked out.`);
            }
            else if (action === "checkin") {
                await api.put(`/changes/${change.id}`, { status: "IMPLEMENTED" });
                setMessage(`${change.crNumber} checked in.`);
            }
            else if (action === "revise") {
                await api.put(`/changes/${change.id}`, { status: "SUBMITTED" });
                setMessage(`${change.crNumber} revised to SUBMITTED.`);
            }
            else if (action === "copy") {
                await api.post("/changes", {
                    title: `${change.title} Copy`,
                    type: change.type,
                    priority: change.priority,
                    status: "NEW",
                    affectedItems: [],
                    affectedFormulas: []
                });
                setMessage(`Copy created for ${change.crNumber}.`);
            }
            else if (action === "delete") {
                if (!window.confirm(`Delete change request ${change.crNumber}?`)) {
                    return;
                }
                await api.delete(`/changes/${change.id}`);
                setMessage(`${change.crNumber} deleted.`);
            }
            await queryClient.invalidateQueries({ queryKey: ["changes"] });
        }
        catch (error) {
            setMessage(error instanceof Error ? error.message : "Action failed");
        }
    }
    return (_jsxs("div", { className: "space-y-4 rounded-xl bg-white p-4", children: [_jsxs("div", { className: "rounded-lg border border-slate-200 bg-slate-50 p-4", children: [_jsx("h3", { className: "mb-3 font-heading text-lg", children: "Create Change Request" }), _jsxs("p", { className: "mb-2 text-xs text-slate-500", children: ["Active container: ", selectedContainerId || "All Accessible"] }), _jsxs("div", { className: "grid gap-3 md:grid-cols-5", children: [_jsx(FloatingInput, { label: "CR Number", value: form.crNumber, onChange: (event) => setForm({ ...form, crNumber: event.target.value }) }), _jsx(FloatingInput, { label: "Title", value: form.title, onChange: (event) => setForm({ ...form, title: event.target.value }) }), _jsxs(FloatingSelect, { label: "Type", value: form.type, onChange: (event) => setForm({ ...form, type: event.target.value }), children: [_jsx("option", { value: "ECR", children: "ECR" }), _jsx("option", { value: "ECO", children: "ECO" }), _jsx("option", { value: "ECN", children: "ECN" }), _jsx("option", { value: "DCO", children: "DCO" })] }), _jsxs(FloatingSelect, { label: "Priority", value: form.priority, onChange: (event) => setForm({ ...form, priority: event.target.value }), children: [_jsx("option", { value: "LOW", children: "LOW" }), _jsx("option", { value: "MEDIUM", children: "MEDIUM" }), _jsx("option", { value: "HIGH", children: "HIGH" }), _jsx("option", { value: "CRITICAL", children: "CRITICAL" })] }), _jsx(FloatingInput, { label: "Impact Assessment", value: form.impactAssessment, onChange: (event) => setForm({ ...form, impactAssessment: event.target.value }) })] }), _jsx("button", { type: "button", onClick: () => createChange.mutate(), disabled: !form.title || createChange.isPending, className: "mt-3 rounded bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60", children: createChange.isPending ? "Creating..." : "Create Change" }), message ? _jsx("p", { className: "mt-2 text-sm text-slate-700", children: message }) : null] }), _jsx("h2", { className: "mb-4 font-heading text-xl", children: "Change Management" }), isLoading ? (_jsx("p", { children: "Loading change requests..." })) : (_jsxs("table", { className: "w-full text-left text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-slate-200 text-slate-500", children: [_jsx("th", { className: "w-10 py-2", children: "\u00A0" }), _jsx("th", { className: "py-2", children: "CR#" }), _jsx("th", { className: "py-2", children: "Title" }), _jsx("th", { className: "py-2", children: "Type" }), _jsx("th", { className: "py-2", children: "Priority" }), _jsx("th", { className: "py-2", children: "Status" }), _jsx("th", { className: "py-2", children: "Workflow" }), _jsx("th", { className: "py-2", children: "Open" }), _jsx("th", { className: "py-2", children: "Actions" })] }) }), _jsx("tbody", { children: data?.data.map((change) => (_jsxs("tr", { className: "border-b border-slate-100", children: [_jsx("td", { className: "py-2 text-slate-500", children: _jsx(EntityIcon, { kind: "change" }) }), _jsx("td", { className: "py-2 font-mono", children: change.crNumber }), _jsx("td", { className: "py-2", children: change.title }), _jsx("td", { className: "py-2", children: change.type }), _jsx("td", { className: "py-2", children: change.priority }), _jsx("td", { className: "py-2", children: change.status }), _jsx("td", { className: "py-2", children: workflowByEntity.get(change.id) ? (_jsx("span", { className: "rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700", children: workflowByEntity.get(change.id) })) : (_jsx("span", { className: "text-xs text-slate-400", children: "Not started" })) }), _jsx("td", { className: "py-2", children: _jsx(Link, { to: `/changes/${change.id}`, className: "rounded border border-slate-300 px-2 py-1 text-xs", children: "Open" }) }), _jsx("td", { className: "py-2", children: _jsx(ObjectActionsMenu, { onAction: (action) => void runChangeAction(change, action) }) })] }, change.id))) })] }))] }));
}
//# sourceMappingURL=page.js.map