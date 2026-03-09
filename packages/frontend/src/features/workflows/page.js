import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ObjectActionsMenu } from "@/components/object-actions-menu";
import { useContainerStore } from "@/store/container.store";
const changeTemplate = {
    name: "Change Management",
    entityType: "CHANGE_REQUEST",
    states: ["NEW", "ASSESSMENT", "REVIEW", "APPROVAL", "IMPLEMENTATION"],
    transitions: [
        { from: "NEW", to: "ASSESSMENT", action: "SUBMIT" },
        { from: "ASSESSMENT", to: "REVIEW", action: "FORWARD" },
        { from: "REVIEW", to: "APPROVAL", action: "RECOMMEND" },
        { from: "APPROVAL", to: "IMPLEMENTATION", action: "APPROVE" }
    ],
    assignments: {
        NEW: { roles: [] },
        ASSESSMENT: { roles: ["QA Manager"] },
        REVIEW: { roles: ["Regulatory Affairs"] },
        APPROVAL: { roles: ["PLM Admin"] },
        IMPLEMENTATION: { roles: ["Production Manager"] }
    }
};
const releaseTemplate = {
    name: "Release Management",
    entityType: "RELEASE_REQUEST",
    states: ["NEW", "REVIEW", "APPROVAL", "RELEASED"],
    transitions: [
        { from: "NEW", to: "REVIEW", action: "SUBMIT" },
        { from: "REVIEW", to: "APPROVAL", action: "APPROVE" },
        { from: "APPROVAL", to: "RELEASED", action: "RELEASE" }
    ],
    assignments: {
        NEW: { roles: [] },
        REVIEW: { roles: ["QA Manager"] },
        APPROVAL: { roles: ["Regulatory Affairs"] },
        RELEASED: { roles: ["PLM Admin"] }
    }
};
function extractMeta(definition) {
    const actions = definition.actions;
    const meta = actions?.meta ?? {};
    return {
        status: meta.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT",
        archived: Boolean(meta.archived)
    };
}
function extractAssignments(definition, states) {
    const actions = definition.actions;
    const rawAssignments = actions?.stateAssignments ?? {};
    const assignments = {};
    for (const state of states) {
        const entry = rawAssignments[state] ?? {};
        assignments[state] = {
            roles: Array.isArray(entry.roles) ? entry.roles : [],
            slaHours: typeof entry.slaHours === "number" ? entry.slaHours : undefined,
            entryRule: typeof entry.entryRule === "string" ? entry.entryRule : "",
            description: typeof entry.description === "string" ? entry.description : ""
        };
    }
    return assignments;
}
export function WorkflowsPage() {
    const queryClient = useQueryClient();
    const [message, setMessage] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const { selectedContainerId } = useContainerStore();
    const containers = useQuery({
        queryKey: ["containers"],
        queryFn: async () => (await api.get("/containers")).data
    });
    const activeIndustry = containers.data?.data.find((container) => container.id === selectedContainerId)?.industry ?? "CHEMICAL";
    const [selectedDefinitionId, setSelectedDefinitionId] = useState("");
    const [definitionName, setDefinitionName] = useState(changeTemplate.name);
    const [definitionEntity, setDefinitionEntity] = useState("CHANGE_REQUEST");
    const [visualStates, setVisualStates] = useState([...changeTemplate.states]);
    const [visualTransitions, setVisualTransitions] = useState([...changeTemplate.transitions]);
    const [stateAssignments, setStateAssignments] = useState({
        ...changeTemplate.assignments
    });
    const [workflowMeta, setWorkflowMeta] = useState({ status: "DRAFT" });
    const [newState, setNewState] = useState("");
    const [newTransition, setNewTransition] = useState({ from: "", to: "", action: "" });
    const [entityFilter, setEntityFilter] = useState("ALL");
    const [search, setSearch] = useState("");
    const [showArchived, setShowArchived] = useState(false);
    const definitions = useQuery({
        queryKey: ["workflowDefinitions", activeIndustry],
        queryFn: async () => (await api.get("/workflows/definitions", { params: { industry: activeIndustry } })).data
    });
    const roles = useQuery({
        queryKey: ["workflow-container-roles", selectedContainerId],
        queryFn: async () => (await api.get(`/containers/${selectedContainerId}/roles`)).data,
        enabled: Boolean(selectedContainerId)
    });
    const { data, isLoading } = useQuery({
        queryKey: ["workflowInstances"],
        queryFn: async () => (await api.get("/workflows/instances")).data
    });
    const filteredDefinitions = useMemo(() => {
        const list = definitions.data?.data ?? [];
        return list.filter((definition) => {
            const meta = extractMeta(definition);
            if (!showArchived && meta.archived) {
                return false;
            }
            if (entityFilter !== "ALL" && definition.entityType !== entityFilter) {
                return false;
            }
            if (search.trim()) {
                const haystack = `${definition.name} ${definition.entityType}`.toLowerCase();
                if (!haystack.includes(search.trim().toLowerCase())) {
                    return false;
                }
            }
            return true;
        });
    }, [definitions.data?.data, entityFilter, search, showArchived]);
    const saveDefinition = useMutation({
        mutationFn: async () => {
            setErrorMessage("");
            if (!definitionName.trim()) {
                throw new Error("Definition name is required.");
            }
            const states = visualStates.map((state) => state.trim()).filter(Boolean);
            if (!states.length) {
                throw new Error("At least one state is required.");
            }
            const stateSet = new Set(states);
            if (stateSet.size !== states.length) {
                throw new Error("State names must be unique.");
            }
            const transitions = visualTransitions.filter((transition) => transition.from && transition.to && transition.action);
            const invalidTransitions = transitions.filter((transition) => !stateSet.has(transition.from) || !stateSet.has(transition.to));
            if (invalidTransitions.length) {
                throw new Error("Transitions reference states that do not exist. Fix states or transitions before saving.");
            }
            const assignments = {};
            for (const state of states) {
                const entry = stateAssignments[state] ?? { roles: [] };
                assignments[state] = {
                    roles: entry.roles ?? [],
                    slaHours: entry.slaHours,
                    entryRule: entry.entryRule,
                    description: entry.description
                };
            }
            const payload = {
                name: definitionName,
                entityType: definitionEntity,
                states,
                transitions,
                actions: {
                    stateAssignments: assignments,
                    meta: { ...workflowMeta, archived: workflowMeta.archived ?? false }
                },
                industry: activeIndustry
            };
            if (selectedDefinitionId) {
                const response = await api.put(`/workflows/definitions/${selectedDefinitionId}`, payload);
                return response.data;
            }
            const response = await api.post("/workflows/definitions", payload);
            return response.data;
        },
        onSuccess: async (definition) => {
            setMessage(selectedDefinitionId ? "Workflow definition updated." : "Workflow definition created.");
            setSelectedDefinitionId(definition.id);
            await queryClient.invalidateQueries({ queryKey: ["workflowDefinitions"] });
        },
        onError: (error) => {
            setErrorMessage(error instanceof Error ? error.message : "Save failed");
        }
    });
    const duplicateDefinition = useMutation({
        mutationFn: async (definition) => {
            const states = Array.isArray(definition.states) ? definition.states : [];
            const transitions = Array.isArray(definition.transitions) ? definition.transitions : [];
            const meta = extractMeta(definition);
            const payload = {
                name: `${definition.name} Copy`,
                entityType: definition.entityType,
                states,
                transitions,
                actions: {
                    ...(definition.actions ?? {}),
                    meta: { ...meta, status: "DRAFT", archived: false }
                }
            };
            const response = await api.post("/workflows/definitions", payload);
            return response.data;
        },
        onSuccess: async (definition) => {
            setMessage("Workflow definition duplicated.");
            setSelectedDefinitionId(definition.id);
            await queryClient.invalidateQueries({ queryKey: ["workflowDefinitions"] });
        }
    });
    const archiveDefinition = useMutation({
        mutationFn: async (definition) => {
            const meta = extractMeta(definition);
            const payload = {
                actions: {
                    ...(definition.actions ?? {}),
                    meta: { ...meta, archived: true }
                }
            };
            await api.put(`/workflows/definitions/${definition.id}`, payload);
        },
        onSuccess: async () => {
            setMessage("Workflow definition archived.");
            await queryClient.invalidateQueries({ queryKey: ["workflowDefinitions"] });
        }
    });
    function loadTemplate(template) {
        setSelectedDefinitionId("");
        setDefinitionName(template.name);
        setDefinitionEntity(template.entityType);
        setVisualStates([...template.states]);
        setVisualTransitions([...template.transitions]);
        setStateAssignments({ ...template.assignments });
        setWorkflowMeta({ status: "DRAFT" });
    }
    function loadDefinition(definition) {
        const meta = extractMeta(definition);
        const states = Array.isArray(definition.states) ? definition.states : [];
        const transitions = Array.isArray(definition.transitions) ? definition.transitions : [];
        setSelectedDefinitionId(definition.id);
        setDefinitionName(definition.name);
        setDefinitionEntity(definition.entityType);
        setVisualStates(states);
        setVisualTransitions(transitions);
        setStateAssignments(extractAssignments(definition, states));
        setWorkflowMeta(meta);
    }
    function runWorkflowAction(instance, action) {
        if (action === "checkout" || action === "checkin") {
            setMessage(`Use workflow transition action for ${instance.entityType}/${instance.entityId}; generic ${action} is disabled.`);
            return;
        }
        setMessage(`Action '${action}' is not configured for workflow instances yet.`);
    }
    return (_jsxs("div", { className: "space-y-4 rounded-xl bg-white p-4", children: [_jsxs("div", { className: "grid gap-4 lg:grid-cols-[320px,1fr]", children: [_jsxs("div", { className: "rounded-lg border border-slate-200 bg-slate-50 p-4", children: [_jsx("h3", { className: "mb-3 font-heading text-lg", children: "Workflow Library" }), _jsxs("div", { className: "space-y-2", children: [_jsxs("select", { value: entityFilter, onChange: (event) => setEntityFilter(event.target.value), className: "w-full rounded border border-slate-300 px-3 py-2 text-sm", children: [_jsx("option", { value: "ALL", children: "All Types" }), _jsx("option", { value: "CHANGE_REQUEST", children: "Change Workflows" }), _jsx("option", { value: "RELEASE_REQUEST", children: "Release Workflows" })] }), _jsx("input", { value: search, onChange: (event) => setSearch(event.target.value), placeholder: "Search workflows", className: "w-full rounded border border-slate-300 px-3 py-2 text-sm" }), _jsxs("label", { className: "flex items-center gap-2 text-xs text-slate-600", children: [_jsx("input", { type: "checkbox", checked: showArchived, onChange: (event) => setShowArchived(event.target.checked) }), "Show archived"] })] }), _jsxs("div", { className: "mt-3 space-y-2", children: [_jsx("button", { type: "button", onClick: () => loadTemplate(changeTemplate), className: "w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm", children: "New Change Workflow" }), _jsx("button", { type: "button", onClick: () => loadTemplate(releaseTemplate), className: "w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm", children: "New Release Workflow" })] }), _jsxs("div", { className: "mt-4 space-y-2", children: [(filteredDefinitions.length ? filteredDefinitions : []).map((definition) => {
                                        const meta = extractMeta(definition);
                                        return (_jsx("div", { className: `rounded border px-3 py-2 text-sm ${selectedDefinitionId === definition.id ? "border-primary bg-blue-50" : "border-slate-200 bg-white"}`, children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("button", { type: "button", onClick: () => loadDefinition(definition), className: "text-left", children: [_jsx("p", { className: "font-medium text-slate-800", children: definition.name }), _jsxs("p", { className: "text-xs text-slate-500", children: [definition.entityType, " \u00B7 ", meta.status] })] }), _jsx(ObjectActionsMenu, { onAction: (action) => {
                                                            if (action === "copy") {
                                                                duplicateDefinition.mutate(definition);
                                                            }
                                                            else if (action === "delete") {
                                                                archiveDefinition.mutate(definition);
                                                            }
                                                        }, actions: [
                                                            { key: "copy", label: "Duplicate" },
                                                            { key: "delete", label: "Archive", danger: true }
                                                        ] })] }) }, definition.id));
                                    }), filteredDefinitions.length === 0 ? (_jsx("p", { className: "text-xs text-slate-500", children: "No workflows found." })) : null] })] }), _jsxs("div", { className: "rounded-lg border border-slate-200 bg-slate-50 p-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h3", { className: "font-heading text-lg", children: "Workflow Editor" }), _jsx("div", { className: "text-xs text-slate-500", children: selectedDefinitionId ? `Editing ${selectedDefinitionId}` : "New Definition" })] }), _jsxs("div", { className: "mt-3 grid gap-3 md:grid-cols-3", children: [_jsx("input", { value: definitionName, onChange: (event) => setDefinitionName(event.target.value), placeholder: "Definition Name", className: "rounded border border-slate-300 px-3 py-2 text-sm" }), _jsxs("select", { value: definitionEntity, onChange: (event) => setDefinitionEntity(event.target.value), className: "rounded border border-slate-300 px-3 py-2 text-sm", children: [_jsx("option", { value: "CHANGE_REQUEST", children: "Change Request" }), _jsx("option", { value: "RELEASE_REQUEST", children: "Release Request" })] }), _jsxs("select", { value: workflowMeta.status, onChange: (event) => setWorkflowMeta((prev) => ({ ...prev, status: event.target.value })), className: "rounded border border-slate-300 px-3 py-2 text-sm", children: [_jsx("option", { value: "DRAFT", children: "Draft" }), _jsx("option", { value: "PUBLISHED", children: "Published" })] })] }), errorMessage ? (_jsx("p", { className: "mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700", children: errorMessage })) : null, _jsxs("div", { className: "mt-4 grid gap-3 md:grid-cols-2", children: [_jsxs("div", { className: "rounded border border-slate-200 bg-white p-3", children: [_jsx("p", { className: "mb-2 text-xs font-medium text-slate-600", children: "States" }), _jsxs("div", { className: "mb-2 flex gap-2", children: [_jsx("input", { value: newState, onChange: (event) => setNewState(event.target.value), placeholder: "Add state", className: "flex-1 rounded border border-slate-300 px-3 py-2 text-sm" }), _jsx("button", { type: "button", onClick: () => {
                                                            const value = newState.trim();
                                                            if (!value || visualStates.includes(value)) {
                                                                return;
                                                            }
                                                            setVisualStates((prev) => [...prev, value]);
                                                            setStateAssignments((prev) => ({ ...prev, [value]: { roles: [] } }));
                                                            setNewState("");
                                                        }, className: "rounded border border-slate-300 bg-white px-3 py-2 text-xs", children: "Add" })] }), _jsx("div", { className: "space-y-2", children: visualStates.map((state) => (_jsxs("div", { className: "rounded border border-slate-200 bg-white px-2 py-2 text-xs text-slate-700", children: [_jsxs("div", { className: "flex items-center justify-between gap-2", children: [_jsx("span", { className: "font-medium", children: state }), _jsx("button", { type: "button", onClick: () => {
                                                                        setVisualStates((prev) => prev.filter((s) => s !== state));
                                                                        setStateAssignments((prev) => {
                                                                            const next = { ...prev };
                                                                            delete next[state];
                                                                            return next;
                                                                        });
                                                                    }, className: "rounded border border-slate-200 px-2 py-0.5 text-[10px]", children: "Remove" })] }), _jsxs("div", { className: "mt-2 grid gap-2", children: [_jsxs("div", { children: [_jsx("p", { className: "text-[11px] text-slate-500", children: "Assign Roles" }), _jsxs("div", { className: "mt-1 max-h-24 space-y-1 overflow-y-auto rounded border border-slate-200 bg-white p-2", children: [(roles.data?.data ?? []).map((role) => {
                                                                                    const selected = stateAssignments[state]?.roles?.includes(role.name);
                                                                                    return (_jsxs("label", { className: "flex items-center gap-2 text-xs text-slate-700", children: [_jsx("input", { type: "checkbox", checked: Boolean(selected), onChange: (event) => {
                                                                                                    setStateAssignments((prev) => {
                                                                                                        const current = prev[state] ?? { roles: [] };
                                                                                                        const nextRoles = event.target.checked
                                                                                                            ? [...current.roles, role.name]
                                                                                                            : current.roles.filter((r) => r !== role.name);
                                                                                                        return { ...prev, [state]: { ...current, roles: nextRoles } };
                                                                                                    });
                                                                                                } }), role.name] }, role.id));
                                                                                }), (roles.data?.data?.length ?? 0) === 0 ? (_jsx("p", { className: "text-xs text-slate-400", children: "No roles in container." })) : null] })] }), _jsxs("div", { className: "grid gap-2", children: [_jsx("input", { value: stateAssignments[state]?.slaHours ?? "", onChange: (event) => {
                                                                                const parsed = Number(event.target.value);
                                                                                setStateAssignments((prev) => ({
                                                                                    ...prev,
                                                                                    [state]: { ...prev[state], slaHours: Number.isFinite(parsed) ? parsed : undefined }
                                                                                }));
                                                                            }, placeholder: "SLA Hours (optional)", className: "rounded border border-slate-300 px-2 py-1 text-xs" }), _jsx("input", { value: stateAssignments[state]?.entryRule ?? "", onChange: (event) => setStateAssignments((prev) => ({
                                                                                ...prev,
                                                                                [state]: { ...prev[state], entryRule: event.target.value }
                                                                            })), placeholder: "Entry Rule (optional)", className: "rounded border border-slate-300 px-2 py-1 text-xs" }), _jsx("input", { value: stateAssignments[state]?.description ?? "", onChange: (event) => setStateAssignments((prev) => ({
                                                                                ...prev,
                                                                                [state]: { ...prev[state], description: event.target.value }
                                                                            })), placeholder: "Task Description (optional)", className: "rounded border border-slate-300 px-2 py-1 text-xs" })] })] })] }, state))) })] }), _jsxs("div", { className: "rounded border border-slate-200 bg-white p-3", children: [_jsx("p", { className: "mb-2 text-xs font-medium text-slate-600", children: "Transitions" }), _jsxs("div", { className: "grid gap-2 md:grid-cols-3", children: [_jsxs("select", { value: newTransition.from, onChange: (event) => setNewTransition({ ...newTransition, from: event.target.value }), className: "rounded border border-slate-300 px-2 py-1 text-sm", children: [_jsx("option", { value: "", children: "From" }), visualStates.map((state) => (_jsx("option", { value: state, children: state }, state)))] }), _jsxs("select", { value: newTransition.to, onChange: (event) => setNewTransition({ ...newTransition, to: event.target.value }), className: "rounded border border-slate-300 px-2 py-1 text-sm", children: [_jsx("option", { value: "", children: "To" }), visualStates.map((state) => (_jsx("option", { value: state, children: state }, state)))] }), _jsx("input", { value: newTransition.action, onChange: (event) => setNewTransition({ ...newTransition, action: event.target.value }), placeholder: "Action", className: "rounded border border-slate-300 px-2 py-1 text-sm" })] }), _jsx("button", { type: "button", onClick: () => {
                                                    if (!newTransition.from || !newTransition.to || !newTransition.action) {
                                                        return;
                                                    }
                                                    setVisualTransitions((prev) => [...prev, { ...newTransition }]);
                                                    setNewTransition({ from: "", to: "", action: "" });
                                                }, className: "mt-2 rounded border border-slate-300 bg-white px-3 py-1 text-xs", children: "Add Transition" }), _jsxs("div", { className: "mt-2 space-y-1 text-xs text-slate-600", children: [visualTransitions.map((transition, index) => (_jsxs("button", { type: "button", onClick: () => setVisualTransitions((prev) => prev.filter((_, idx) => idx !== index)), className: "block w-full rounded border border-slate-200 bg-slate-50 px-2 py-1 text-left", children: [transition.from, " ", "->", " ", transition.to, " (", transition.action, ") x"] }, `${transition.from}-${transition.to}-${transition.action}-${index}`))), visualTransitions.length === 0 ? _jsx("p", { className: "text-xs text-slate-400", children: "No transitions defined." }) : null] }), _jsxs("div", { className: "mt-4 rounded border border-slate-200 bg-white p-3", children: [_jsx("p", { className: "mb-2 text-xs font-medium text-slate-600", children: "Preview" }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("svg", { width: Math.max(600, visualStates.length * 140), height: "140", children: [visualStates.map((state, index) => {
                                                                    const x = 70 + index * 140;
                                                                    return (_jsxs("g", { children: [_jsx("circle", { cx: x, cy: 60, r: 32, fill: "#F8FAFC", stroke: "#CBD5F5", strokeWidth: "2" }), _jsx("text", { x: x, y: 65, textAnchor: "middle", fontSize: "10", fill: "#1F2937", children: state })] }, state));
                                                                }), visualTransitions.map((transition, index) => {
                                                                    const fromIndex = visualStates.indexOf(transition.from);
                                                                    const toIndex = visualStates.indexOf(transition.to);
                                                                    if (fromIndex < 0 || toIndex < 0) {
                                                                        return null;
                                                                    }
                                                                    const x1 = 70 + fromIndex * 140 + 32;
                                                                    const x2 = 70 + toIndex * 140 - 32;
                                                                    return (_jsxs("g", { children: [_jsx("line", { x1: x1, y1: 60, x2: x2, y2: 60, stroke: "#94A3B8", strokeWidth: "2" }), _jsx("text", { x: (x1 + x2) / 2, y: 40, textAnchor: "middle", fontSize: "9", fill: "#64748B", children: transition.action })] }, `${transition.from}-${transition.to}-${index}`));
                                                                })] }) })] })] })] }), _jsx("button", { type: "button", onClick: () => saveDefinition.mutate(), disabled: saveDefinition.isPending || visualStates.length === 0 || !selectedContainerId || !definitionName.trim(), className: "mt-3 rounded bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60", children: saveDefinition.isPending ? "Saving..." : selectedDefinitionId ? "Update Workflow Definition" : "Save Workflow Definition" }), !selectedContainerId ? _jsx("p", { className: "mt-2 text-xs text-slate-500", children: "Select a container to assign roles." }) : null] })] }), _jsx("h2", { className: "mb-4 font-heading text-xl", children: "Workflow Inbox" }), message ? _jsx("p", { className: "text-sm text-slate-700", children: message }) : null, isLoading ? (_jsx("p", { children: "Loading workflow instances..." })) : (_jsx("div", { className: "space-y-3", children: data?.data.map((wf) => (_jsxs("div", { className: "rounded-lg border border-slate-200 p-3", children: [_jsxs("p", { className: "text-sm text-slate-500", children: [wf.entityType, " / ", wf.entityId] }), _jsxs("p", { className: "font-medium", children: ["Current State: ", wf.currentState] }), _jsx("div", { className: "mt-2", children: _jsx(ObjectActionsMenu, { onAction: (action) => runWorkflowAction(wf, action), actions: [
                                    { key: "checkout", label: "Check Out", disabled: true },
                                    { key: "checkin", label: "Check In", disabled: true },
                                    { key: "revise", label: "Revise", disabled: true },
                                    { key: "copy", label: "Copy", disabled: true },
                                    { key: "delete", label: "Delete", danger: true, disabled: true }
                                ] }) })] }, wf.id))) }))] }));
}
//# sourceMappingURL=page.js.map