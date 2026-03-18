import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ObjectActionsMenu, type ObjectActionKey } from "@/components/object-actions-menu";
import { useContainerStore } from "@/store/container.store";

interface WorkflowInstance {
  id: string;
  entityType: string;
  entityId: string;
  currentState: string;
}

interface WorkflowResponse {
  data: WorkflowInstance[];
  total: number;
  page: number;
  pageSize: number;
}

interface WorkflowDefinitionRecord {
  id: string;
  name: string;
  entityType: string;
  industry?: string;
  states: string[] | unknown;
  transitions: Array<{ from: string; to: string; action: string }> | unknown;
  actions?: unknown;
}

type Transition = { from: string; to: string; action: string; label?: string; style?: string };

type AssignmentInput = {
  roles: string[];
  slaHours?: number;
  entryRule?: string;
  description?: string;
};

function normalizeAssignment(entry: Partial<AssignmentInput> | undefined): AssignmentInput {
  const next: AssignmentInput = { roles: Array.isArray(entry?.roles) ? entry.roles : [] };
  if (typeof entry?.slaHours === "number") {
    next.slaHours = entry.slaHours;
  }
  if (typeof entry?.entryRule === "string") {
    next.entryRule = entry.entryRule;
  }
  if (typeof entry?.description === "string") {
    next.description = entry.description;
  }
  return next;
}

interface ContainerRoleRecord {
  id: string;
  name: string;
}

type WorkflowMeta = {
  status: "DRAFT" | "PUBLISHED";
  archived?: boolean;
};

const changeTemplate = {
  name: "Change Management",
  entityType: "CHANGE_REQUEST" as const,
  states: ["IN_WORK", "UNDER_REVIEW", "RELEASED"],
  transitions: [
    { from: "IN_WORK", to: "UNDER_REVIEW", action: "SUBMIT" },
    { from: "UNDER_REVIEW", to: "IN_WORK", action: "REQUEST_CHANGES" },
    { from: "UNDER_REVIEW", to: "RELEASED", action: "APPROVE" }
  ],
  assignments: {
    IN_WORK: { roles: [] },
    UNDER_REVIEW: { roles: ["QA Manager"] },
    RELEASED: { roles: ["PLM Admin"] }
  } as Record<string, AssignmentInput>
};

const releaseTemplate = {
  name: "Release Management",
  entityType: "RELEASE_REQUEST" as const,
  states: ["IN_WORK", "UNDER_REVIEW", "RELEASED"],
  transitions: [
    { from: "IN_WORK", to: "UNDER_REVIEW", action: "SUBMIT" },
    { from: "UNDER_REVIEW", to: "IN_WORK", action: "REQUEST_CHANGES" },
    { from: "UNDER_REVIEW", to: "RELEASED", action: "RELEASE" }
  ],
  assignments: {
    IN_WORK: { roles: [] },
    UNDER_REVIEW: { roles: ["Regulatory Affairs"] },
    RELEASED: { roles: ["PLM Admin"] }
  } as Record<string, AssignmentInput>
};

function extractMeta(definition: WorkflowDefinitionRecord): WorkflowMeta {
  const actions = definition.actions as any;
  const meta = actions?.meta ?? {};
  return {
    status: meta.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT",
    archived: Boolean(meta.archived)
  };
}

function extractAssignments(definition: WorkflowDefinitionRecord, states: string[]): Record<string, AssignmentInput> {
  const actions = definition.actions as any;
  const rawAssignments = actions?.stateAssignments ?? {};
  const assignments: Record<string, AssignmentInput> = {};
  for (const state of states) {
    assignments[state] = normalizeAssignment(rawAssignments[state]);
  }
  return assignments;
}

export function WorkflowsPage(): JSX.Element {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const { selectedContainerId } = useContainerStore();
  const containers = useQuery({
    queryKey: ["containers"],
    queryFn: async () => (await api.get<{ data: Array<{ id: string; industry: string; name: string }> }>("/containers")).data
  });
  const activeIndustry =
    containers.data?.data.find((container) => container.id === selectedContainerId)?.industry ?? "CHEMICAL";

  const [selectedDefinitionId, setSelectedDefinitionId] = useState("");
  const [definitionName, setDefinitionName] = useState(changeTemplate.name);
  const [definitionEntity, setDefinitionEntity] = useState<"CHANGE_REQUEST" | "RELEASE_REQUEST">("CHANGE_REQUEST");
  const [visualStates, setVisualStates] = useState<string[]>([...changeTemplate.states]);
  const [visualTransitions, setVisualTransitions] = useState<Transition[]>([...changeTemplate.transitions]);
  const [stateAssignments, setStateAssignments] = useState<Record<string, AssignmentInput>>({
    ...changeTemplate.assignments
  });
  const [workflowMeta, setWorkflowMeta] = useState<WorkflowMeta>({ status: "DRAFT" });

  const [newState, setNewState] = useState("");
  const [newTransition, setNewTransition] = useState<Transition>({ from: "", to: "", action: "", label: "", style: "default" });
  const [entityFilter, setEntityFilter] = useState<"ALL" | "CHANGE_REQUEST" | "RELEASE_REQUEST">("ALL");
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const definitions = useQuery({
    queryKey: ["workflowDefinitions", activeIndustry],
    queryFn: async () =>
      (await api.get<{ data: WorkflowDefinitionRecord[] }>("/workflows/definitions", { params: { industry: activeIndustry } })).data
  });

  const roles = useQuery({
    queryKey: ["workflow-container-roles", selectedContainerId],
    queryFn: async () => (await api.get<{ data: ContainerRoleRecord[] }>(`/containers/${selectedContainerId}/roles`)).data,
    enabled: Boolean(selectedContainerId)
  });

  const { data, isLoading } = useQuery({
    queryKey: ["workflowInstances"],
    queryFn: async () => (await api.get<WorkflowResponse>("/workflows/instances")).data
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
      const invalidTransitions = transitions.filter(
        (transition) => !stateSet.has(transition.from) || !stateSet.has(transition.to)
      );
      if (invalidTransitions.length) {
        throw new Error("Transitions reference states that do not exist. Fix states or transitions before saving.");
      }

      const assignments: Record<string, AssignmentInput> = {};
      for (const state of states) {
        assignments[state] = normalizeAssignment(stateAssignments[state]);
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
        const response = await api.put<WorkflowDefinitionRecord>(`/workflows/definitions/${selectedDefinitionId}`, payload);
        return response.data;
      }
      const response = await api.post<WorkflowDefinitionRecord>("/workflows/definitions", payload);
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
    mutationFn: async (definition: WorkflowDefinitionRecord) => {
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
      const response = await api.post<WorkflowDefinitionRecord>("/workflows/definitions", payload);
      return response.data;
    },
    onSuccess: async (definition) => {
      setMessage("Workflow definition duplicated.");
      setSelectedDefinitionId(definition.id);
      await queryClient.invalidateQueries({ queryKey: ["workflowDefinitions"] });
    }
  });

  const archiveDefinition = useMutation({
    mutationFn: async (definition: WorkflowDefinitionRecord) => {
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

  function loadTemplate(template: typeof changeTemplate | typeof releaseTemplate): void {
    setSelectedDefinitionId("");
    setDefinitionName(template.name);
    setDefinitionEntity(template.entityType);
    setVisualStates([...template.states]);
    setVisualTransitions([...template.transitions]);
    setStateAssignments({ ...template.assignments });
    setWorkflowMeta({ status: "DRAFT" });
  }

  function loadDefinition(definition: WorkflowDefinitionRecord): void {
    const meta = extractMeta(definition);
    const states = Array.isArray(definition.states) ? definition.states : [];
    const transitions = Array.isArray(definition.transitions) ? definition.transitions : [];
    setSelectedDefinitionId(definition.id);
    setDefinitionName(definition.name);
    setDefinitionEntity(definition.entityType as "CHANGE_REQUEST" | "RELEASE_REQUEST");
    setVisualStates(states);
    setVisualTransitions((transitions as Transition[]).map((t) => ({ from: t.from, to: t.to, action: t.action, label: t.label ?? "", style: t.style ?? "default" })));
    setStateAssignments(extractAssignments(definition, states));
    setWorkflowMeta(meta);
  }

  function runWorkflowAction(instance: WorkflowInstance, action: ObjectActionKey): void {
    if (action === "checkout" || action === "checkin") {
      setMessage(`Use workflow transition action for ${instance.entityType}/${instance.entityId}; generic ${action} is disabled.`);
      return;
    }
    setMessage(`Action '${action}' is not configured for workflow instances yet.`);
  }

  return (
    <div className="space-y-4 rounded-xl bg-white p-4">
      <div className="grid gap-4 lg:grid-cols-[320px,1fr]">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <h3 className="mb-3 font-heading text-lg">Workflow Library</h3>
          <div className="space-y-2">
            <select
              value={entityFilter}
              onChange={(event) => setEntityFilter(event.target.value as "ALL" | "CHANGE_REQUEST" | "RELEASE_REQUEST")}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="ALL">All Types</option>
              <option value="CHANGE_REQUEST">Change Workflows</option>
              <option value="RELEASE_REQUEST">Release Workflows</option>
            </select>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search workflows"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} />
              Show archived
            </label>
          </div>

          <div className="mt-3 space-y-2">
            <button
              type="button"
              onClick={() => loadTemplate(changeTemplate)}
              className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              New Change Workflow
            </button>
            <button
              type="button"
              onClick={() => loadTemplate(releaseTemplate)}
              className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              New Release Workflow
            </button>
          </div>

          <div className="mt-4 space-y-2">
            {(filteredDefinitions.length ? filteredDefinitions : []).map((definition) => {
              const meta = extractMeta(definition);
              return (
                <div
                  key={definition.id}
                  className={`rounded border px-3 py-2 text-sm ${
                    selectedDefinitionId === definition.id ? "border-primary bg-blue-50" : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <button type="button" onClick={() => loadDefinition(definition)} className="text-left">
                      <p className="font-medium text-slate-800">{definition.name}</p>
                      <p className="text-xs text-slate-500">{definition.entityType} · {meta.status}</p>
                    </button>
                    <ObjectActionsMenu
                      onAction={(action) => {
                        if (action === "copy") {
                          duplicateDefinition.mutate(definition);
                        } else if (action === "delete") {
                          archiveDefinition.mutate(definition);
                        }
                      }}
                      actions={[
                        { key: "copy", label: "Duplicate" },
                        { key: "delete", label: "Archive", danger: true }
                      ]}
                    />
                  </div>
                </div>
              );
            })}
            {filteredDefinitions.length === 0 ? (
              <p className="text-xs text-slate-500">No workflows found.</p>
            ) : null}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-heading text-lg">Workflow Editor</h3>
            <div className="text-xs text-slate-500">
              {selectedDefinitionId ? `Editing ${selectedDefinitionId}` : "New Definition"}
            </div>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <input
              value={definitionName}
              onChange={(event) => setDefinitionName(event.target.value)}
              placeholder="Definition Name"
              className="rounded border border-slate-300 px-3 py-2 text-sm"
            />
            <select
              value={definitionEntity}
              onChange={(event) => setDefinitionEntity(event.target.value as "CHANGE_REQUEST" | "RELEASE_REQUEST")}
              className="rounded border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="CHANGE_REQUEST">Change Request</option>
              <option value="RELEASE_REQUEST">Release Request</option>
            </select>
            <select
              value={workflowMeta.status}
              onChange={(event) => setWorkflowMeta((prev) => ({ ...prev, status: event.target.value as WorkflowMeta["status"] }))}
              className="rounded border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
            </select>
          </div>

          {errorMessage ? (
            <p className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{errorMessage}</p>
          ) : null}

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded border border-slate-200 bg-white p-3">
              <p className="mb-2 text-xs font-medium text-slate-600">States</p>
              <div className="mb-2 flex gap-2">
                <input value={newState} onChange={(event) => setNewState(event.target.value)} placeholder="Add state" className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm" />
                <button
                  type="button"
                  onClick={() => {
                    const value = newState.trim();
                    if (!value || visualStates.includes(value)) {
                      return;
                    }
                    setVisualStates((prev) => [...prev, value]);
                    setStateAssignments((prev) => ({ ...prev, [value]: { roles: [] } }));
                    setNewState("");
                  }}
                  className="rounded border border-slate-300 bg-white px-3 py-2 text-xs"
                >
                  Add
                </button>
              </div>
              <div className="space-y-2">
                {visualStates.map((state) => (
                  <div key={state} className="rounded border border-slate-200 bg-white px-2 py-2 text-xs text-slate-700">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{state}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setVisualStates((prev) => prev.filter((s) => s !== state));
                          setStateAssignments((prev) => {
                            const next = { ...prev };
                            delete next[state];
                            return next;
                          });
                        }}
                        className="rounded border border-slate-200 px-2 py-0.5 text-[10px]"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="mt-2 grid gap-2">
                      <div>
                        <p className="text-[11px] text-slate-500">Assign Roles</p>
                        <div className="mt-1 max-h-24 space-y-1 overflow-y-auto rounded border border-slate-200 bg-white p-2">
                          {(roles.data?.data ?? []).map((role) => {
                            const selected = stateAssignments[state]?.roles?.includes(role.name);
                            return (
                              <label key={role.id} className="flex items-center gap-2 text-xs text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={Boolean(selected)}
                                  onChange={(event) => {
                                    setStateAssignments((prev) => {
                                      const current = prev[state] ?? { roles: [] };
                                      const nextRoles = event.target.checked
                                        ? [...current.roles, role.name]
                                        : current.roles.filter((r) => r !== role.name);
                                      return { ...prev, [state]: { ...current, roles: nextRoles } };
                                    });
                                  }}
                                />
                                {role.name}
                              </label>
                            );
                          })}
                          {(roles.data?.data?.length ?? 0) === 0 ? (
                            <p className="text-xs text-slate-400">No roles in container.</p>
                          ) : null}
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <input
                          value={stateAssignments[state]?.slaHours ?? ""}
                          onChange={(event) => {
                            const parsed = Number(event.target.value);
                            setStateAssignments((prev) => ({
                              ...prev,
                              [state]:
                                Number.isFinite(parsed)
                                  ? { ...normalizeAssignment(prev[state]), slaHours: parsed }
                                  : normalizeAssignment(prev[state])
                            }));
                          }}
                          placeholder="SLA Hours (optional)"
                          className="rounded border border-slate-300 px-2 py-1 text-xs"
                        />
                        <input
                          value={stateAssignments[state]?.entryRule ?? ""}
                          onChange={(event) =>
                            setStateAssignments((prev) => ({
                              ...prev,
                              [state]: { ...normalizeAssignment(prev[state]), entryRule: event.target.value }
                            }))
                          }
                          placeholder="Entry Rule (optional)"
                          className="rounded border border-slate-300 px-2 py-1 text-xs"
                        />
                        <input
                          value={stateAssignments[state]?.description ?? ""}
                          onChange={(event) =>
                            setStateAssignments((prev) => ({
                              ...prev,
                              [state]: { ...normalizeAssignment(prev[state]), description: event.target.value }
                            }))
                          }
                          placeholder="Task Description (optional)"
                          className="rounded border border-slate-300 px-2 py-1 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded border border-slate-200 bg-white p-3">
              <p className="mb-2 text-xs font-medium text-slate-600">Transitions</p>
              <div className="grid gap-2 md:grid-cols-3">
                <select
                  value={newTransition.from}
                  onChange={(event) => setNewTransition({ ...newTransition, from: event.target.value })}
                  className="rounded border border-slate-300 px-2 py-1 text-sm"
                >
                  <option value="">From</option>
                  {visualStates.map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                </select>
                <select
                  value={newTransition.to}
                  onChange={(event) => setNewTransition({ ...newTransition, to: event.target.value })}
                  className="rounded border border-slate-300 px-2 py-1 text-sm"
                >
                  <option value="">To</option>
                  {visualStates.map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                </select>
                <input
                  value={newTransition.action}
                  onChange={(event) => setNewTransition({ ...newTransition, action: event.target.value })}
                  placeholder="Action (internal key)"
                  className="rounded border border-slate-300 px-2 py-1 text-sm"
                />
              </div>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                <input
                  value={newTransition.label ?? ""}
                  onChange={(event) => setNewTransition({ ...newTransition, label: event.target.value })}
                  placeholder="Button Label (e.g. Approve)"
                  className="rounded border border-slate-300 px-2 py-1 text-sm"
                />
                <select
                  value={newTransition.style ?? "default"}
                  onChange={(event) => setNewTransition({ ...newTransition, style: event.target.value })}
                  className="rounded border border-slate-300 px-2 py-1 text-sm"
                >
                  <option value="default">Default (Blue)</option>
                  <option value="success">Success (Green)</option>
                  <option value="warning">Warning (Orange)</option>
                  <option value="danger">Danger (Red)</option>
                </select>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!newTransition.from || !newTransition.to || !newTransition.action) {
                    return;
                  }
                  setVisualTransitions((prev) => [...prev, { ...newTransition }]);
                  setNewTransition({ from: "", to: "", action: "", label: "", style: "default" });
                }}
                className="mt-2 rounded border border-slate-300 bg-white px-3 py-1 text-xs"
              >
                Add Transition
              </button>
              <div className="mt-2 space-y-1 text-xs text-slate-600">
                {visualTransitions.map((transition, index) => (
                  <button
                    key={`${transition.from}-${transition.to}-${transition.action}-${index}`}
                    type="button"
                    onClick={() => setVisualTransitions((prev) => prev.filter((_, idx) => idx !== index))}
                    className="block w-full rounded border border-slate-200 bg-slate-50 px-2 py-1 text-left"
                  >
                    {transition.from} {"->"} {transition.to} · <strong>{transition.label || transition.action}</strong> [{transition.style ?? "default"}] ×
                  </button>
                ))}
                {visualTransitions.length === 0 ? <p className="text-xs text-slate-400">No transitions defined.</p> : null}
              </div>

              <div className="mt-4 rounded border border-slate-200 bg-white p-3">
                <p className="mb-2 text-xs font-medium text-slate-600">Preview</p>
                <div className="overflow-x-auto">
                  <svg width={Math.max(600, visualStates.length * 140)} height="140">
                    {visualStates.map((state, index) => {
                      const x = 70 + index * 140;
                      return (
                        <g key={state}>
                          <circle cx={x} cy={60} r={32} fill="#F8FAFC" stroke="#CBD5F5" strokeWidth="2" />
                          <text x={x} y={65} textAnchor="middle" fontSize="10" fill="#1F2937">
                            {state}
                          </text>
                        </g>
                      );
                    })}
                    {visualTransitions.map((transition, index) => {
                      const fromIndex = visualStates.indexOf(transition.from);
                      const toIndex = visualStates.indexOf(transition.to);
                      if (fromIndex < 0 || toIndex < 0) {
                        return null;
                      }
                      const x1 = 70 + fromIndex * 140 + 32;
                      const x2 = 70 + toIndex * 140 - 32;
                      return (
                        <g key={`${transition.from}-${transition.to}-${index}`}>
                          <line x1={x1} y1={60} x2={x2} y2={60} stroke="#94A3B8" strokeWidth="2" />
                          <text x={(x1 + x2) / 2} y={40} textAnchor="middle" fontSize="9" fill="#64748B">
                            {transition.action}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => saveDefinition.mutate()}
            disabled={saveDefinition.isPending || visualStates.length === 0 || !selectedContainerId || !definitionName.trim()}
            className="mt-3 rounded bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {saveDefinition.isPending ? "Saving..." : selectedDefinitionId ? "Update Workflow Definition" : "Save Workflow Definition"}
          </button>
          {!selectedContainerId ? <p className="mt-2 text-xs text-slate-500">Select a container to assign roles.</p> : null}
        </div>
      </div>

      <h2 className="mb-4 font-heading text-xl">Workflow Inbox</h2>
      {message ? <p className="text-sm text-slate-700">{message}</p> : null}
      {isLoading ? (
        <p>Loading workflow instances...</p>
      ) : (
        <div className="space-y-3">
          {data?.data.map((wf) => (
            <div key={wf.id} className="rounded-lg border border-slate-200 p-3">
              <p className="text-sm text-slate-500">{wf.entityType} / {wf.entityId}</p>
              <p className="font-medium">Current State: {wf.currentState}</p>
              <div className="mt-2">
                <ObjectActionsMenu
                  onAction={(action) => runWorkflowAction(wf, action)}
                  actions={[
                    { key: "checkout", label: "Check Out", disabled: true },
                    { key: "checkin", label: "Check In", disabled: true },
                    { key: "revise", label: "Revise", disabled: true },
                    { key: "copy", label: "Copy", disabled: true },
                    { key: "delete", label: "Delete", danger: true, disabled: true }
                  ]}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
