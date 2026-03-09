import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link, useParams } from "react-router-dom";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { EntityIcon } from "@/components/entity-icon";
export function ChangeDetailPage() {
    const params = useParams();
    const changeId = String(params.id ?? "");
    const queryClient = useQueryClient();
    const [message, setMessage] = useState("");
    const [activeTab, setActiveTab] = useState("details");
    const change = useQuery({
        queryKey: ["change-detail", changeId],
        queryFn: async () => (await api.get(`/changes/${changeId}`)).data,
        enabled: Boolean(changeId)
    });
    const workflow = useQuery({
        queryKey: ["change-workflow", changeId],
        queryFn: async () => (await api.get("/workflows/instances", {
            params: { entityType: "CHANGE_REQUEST", entityId: changeId }
        })).data,
        enabled: Boolean(changeId)
    });
    const [form, setForm] = useState({
        title: "",
        description: "",
        type: "ECR",
        priority: "MEDIUM",
        impactAssessment: ""
    });
    const updateChange = useMutation({
        mutationFn: async (payload) => {
            await api.put(`/changes/${changeId}`, payload);
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["change-detail", changeId] });
            await queryClient.invalidateQueries({ queryKey: ["changes"] });
            setMessage("Change request updated.");
        },
        onError: (error) => setMessage(error instanceof Error ? error.message : "Update failed")
    });
    if (change.isLoading) {
        return _jsx("div", { className: "rounded-lg bg-white p-4", children: "Loading change request..." });
    }
    const data = change.data;
    if (!data) {
        return _jsx("div", { className: "rounded-lg bg-white p-4", children: "Change request not found." });
    }
    const canEdit = data.status === "NEW";
    return (_jsxs("div", { className: "space-y-4 rounded-xl bg-white p-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "rounded-full bg-slate-100 p-2", children: _jsx(EntityIcon, { kind: "change", size: 20 }) }), _jsxs("div", { children: [_jsx("p", { className: "font-mono text-sm text-slate-500", children: data.crNumber }), _jsx("h2", { className: "font-heading text-xl", children: data.title }), _jsxs("p", { className: "text-sm text-slate-500", children: [data.type, " | ", data.priority, " | ", data.status] })] })] }), _jsx(Link, { to: "/changes", className: "rounded border border-slate-300 bg-white px-3 py-1 text-sm", children: "Back to Changes" })] }), message ? _jsx("p", { className: "rounded border border-slate-200 bg-slate-50 p-2 text-sm text-slate-700", children: message }) : null, _jsxs("div", { className: "flex items-center gap-2 border-b border-slate-200 text-sm", children: [_jsx("button", { type: "button", onClick: () => setActiveTab("details"), className: `px-3 py-2 ${activeTab === "details" ? "border-b-2 border-primary font-medium text-primary" : "text-slate-500"}`, children: "Details" }), _jsx("button", { type: "button", onClick: () => setActiveTab("workflow"), className: `px-3 py-2 ${activeTab === "workflow" ? "border-b-2 border-primary font-medium text-primary" : "text-slate-500"}`, children: "Workflow" })] }), activeTab === "details" ? (_jsxs("div", { className: "rounded-lg border border-slate-200 bg-slate-50 p-4", children: [_jsx("h3", { className: "mb-3 font-heading text-lg", children: "Edit Change Request" }), _jsxs("div", { className: "grid gap-3 md:grid-cols-2", children: [_jsx("input", { value: form.title || data.title, onChange: (event) => setForm({ ...form, title: event.target.value }), placeholder: "Title", className: "rounded border border-slate-300 px-3 py-2 text-sm", disabled: !canEdit }), _jsx("input", { value: form.description || data.description || "", onChange: (event) => setForm({ ...form, description: event.target.value }), placeholder: "Description", className: "rounded border border-slate-300 px-3 py-2 text-sm", disabled: !canEdit }), _jsxs("select", { value: form.type || data.type, onChange: (event) => setForm({ ...form, type: event.target.value }), className: "rounded border border-slate-300 px-3 py-2 text-sm", disabled: !canEdit, children: [_jsx("option", { value: "ECR", children: "ECR" }), _jsx("option", { value: "ECO", children: "ECO" }), _jsx("option", { value: "ECN", children: "ECN" }), _jsx("option", { value: "DCO", children: "DCO" })] }), _jsxs("select", { value: form.priority || data.priority, onChange: (event) => setForm({ ...form, priority: event.target.value }), className: "rounded border border-slate-300 px-3 py-2 text-sm", disabled: !canEdit, children: [_jsx("option", { value: "LOW", children: "LOW" }), _jsx("option", { value: "MEDIUM", children: "MEDIUM" }), _jsx("option", { value: "HIGH", children: "HIGH" }), _jsx("option", { value: "CRITICAL", children: "CRITICAL" })] }), _jsx("input", { value: form.impactAssessment || data.impactAssessment || "", onChange: (event) => setForm({ ...form, impactAssessment: event.target.value }), placeholder: "Impact Assessment", className: "rounded border border-slate-300 px-3 py-2 text-sm md:col-span-2", disabled: !canEdit })] }), _jsxs("div", { className: "mt-3 flex flex-wrap gap-2", children: [_jsx("button", { type: "button", onClick: () => updateChange.mutate({
                                    title: form.title || data.title,
                                    description: form.description || data.description,
                                    type: form.type || data.type,
                                    priority: form.priority || data.priority,
                                    impactAssessment: form.impactAssessment || data.impactAssessment
                                }), disabled: !canEdit || updateChange.isPending, className: "rounded bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60", children: updateChange.isPending ? "Saving..." : "Save Changes" }), _jsx("button", { type: "button", onClick: () => updateChange.mutate({ status: "SUBMITTED" }), disabled: !canEdit || updateChange.isPending, className: "rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-60", children: "Submit for Workflow" })] }), !canEdit ? _jsx("p", { className: "mt-2 text-xs text-slate-500", children: "Editing is locked once submitted." }) : null] })) : (_jsxs("div", { className: "rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm", children: [_jsx("h3", { className: "mb-3 font-heading text-lg", children: "Workflow Status" }), workflow.data?.data?.length ? ((() => {
                        const wf = workflow.data?.data?.[0];
                        const assignments = wf?.definition?.actions?.stateAssignments?.[wf.currentState] ?? {};
                        const roles = assignments.roles ?? [];
                        const slaHours = typeof assignments.slaHours === "number" ? assignments.slaHours : null;
                        const entryRule = typeof assignments.entryRule === "string" ? assignments.entryRule : "";
                        const description = typeof assignments.description === "string" ? assignments.description : "";
                        return (_jsxs("div", { className: "space-y-2", children: [_jsxs("p", { className: "text-slate-700", children: [wf?.definition?.name ?? "Workflow", ":", " ", _jsx("span", { className: "rounded-full bg-white px-2 py-0.5 text-xs text-slate-700", children: wf?.currentState })] }), _jsxs("p", { className: "text-xs text-slate-600", children: ["Assigned Roles: ", roles.length ? roles.join(", ") : "Unassigned"] }), slaHours !== null ? _jsxs("p", { className: "text-xs text-slate-600", children: ["SLA: ", slaHours, " hours"] }) : null, entryRule ? _jsxs("p", { className: "text-xs text-slate-600", children: ["Entry Rule: ", entryRule] }) : null, description ? _jsxs("p", { className: "text-xs text-slate-600", children: ["Task: ", description] }) : null] }));
                    })()) : (_jsxs("div", { className: "space-y-2", children: [_jsx("p", { className: "text-slate-500", children: "Not started yet." }), data.status === "SUBMITTED" ? (_jsx("button", { type: "button", onClick: () => updateChange.mutate({ status: "SUBMITTED" }), className: "rounded border border-slate-300 bg-white px-3 py-1 text-xs", children: "Start Workflow" })) : (_jsx("p", { className: "text-xs text-slate-500", children: "Submit the change to start workflow." }))] }))] }))] }));
}
//# sourceMappingURL=detail-page.js.map