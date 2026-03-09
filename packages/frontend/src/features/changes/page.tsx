import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ObjectActionsMenu, type ObjectActionKey } from "@/components/object-actions-menu";
import { useContainerStore } from "@/store/container.store";
import { Link } from "react-router-dom";
import { FloatingInput, FloatingSelect } from "@/components/floating-field";
import { EntityIcon } from "@/components/entity-icon";

interface ChangeRecord {
  id: string;
  crNumber: string;
  title: string;
  type: string;
  priority: string;
  status: string;
}

interface ChangeListResponse {
  data: ChangeRecord[];
  total: number;
  page: number;
  pageSize: number;
}

interface WorkflowInstance {
  id: string;
  entityId: string;
  currentState: string;
}

export function ChangesPage(): JSX.Element {
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
    queryFn: async () =>
      (
        await api.get<ChangeListResponse>("/changes", {
          params: { ...(selectedContainerId ? { containerId: selectedContainerId } : {}) }
        })
      ).data
  });

  const workflowInstances = useQuery({
    queryKey: ["change-workflows", data?.data.map((change) => change.id).join(","), selectedContainerId],
    queryFn: async () => {
      const ids = data?.data.map((change) => change.id).join(",");
      if (!ids) {
        return { data: [] as WorkflowInstance[] };
      }
      return (await api.get<{ data: WorkflowInstance[] }>("/workflows/instances", { params: { entityType: "CHANGE_REQUEST", entityId: ids } })).data;
    },
    enabled: Boolean(data?.data?.length)
  });

  const workflowByEntity = new Map(
    (workflowInstances.data?.data ?? []).map((instance) => [instance.entityId, instance.currentState])
  );

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

  async function runChangeAction(change: ChangeRecord, action: ObjectActionKey): Promise<void> {
    try {
      if (action === "checkout") {
        await api.put(`/changes/${change.id}`, { status: "UNDER_REVIEW" });
        setMessage(`${change.crNumber} checked out.`);
      } else if (action === "checkin") {
        await api.put(`/changes/${change.id}`, { status: "IMPLEMENTED" });
        setMessage(`${change.crNumber} checked in.`);
      } else if (action === "revise") {
        await api.put(`/changes/${change.id}`, { status: "SUBMITTED" });
        setMessage(`${change.crNumber} revised to SUBMITTED.`);
      } else if (action === "copy") {
        await api.post("/changes", {
          title: `${change.title} Copy`,
          type: change.type,
          priority: change.priority,
          status: "NEW",
          affectedItems: [],
          affectedFormulas: []
        });
        setMessage(`Copy created for ${change.crNumber}.`);
      } else if (action === "delete") {
        if (!window.confirm(`Delete change request ${change.crNumber}?`)) {
          return;
        }
        await api.delete(`/changes/${change.id}`);
        setMessage(`${change.crNumber} deleted.`);
      }
      await queryClient.invalidateQueries({ queryKey: ["changes"] });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed");
    }
  }

  return (
    <div className="space-y-4 rounded-xl bg-white p-4">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h3 className="mb-3 font-heading text-lg">Create Change Request</h3>
        <p className="mb-2 text-xs text-slate-500">Active container: {selectedContainerId || "All Accessible"}</p>
        <div className="grid gap-3 md:grid-cols-5">
          <FloatingInput label="CR Number" value={form.crNumber} onChange={(event) => setForm({ ...form, crNumber: event.target.value })} />
          <FloatingInput label="Title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          <FloatingSelect label="Type" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
            <option value="ECR">ECR</option>
            <option value="ECO">ECO</option>
            <option value="ECN">ECN</option>
            <option value="DCO">DCO</option>
          </FloatingSelect>
          <FloatingSelect label="Priority" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}>
            <option value="LOW">LOW</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HIGH">HIGH</option>
            <option value="CRITICAL">CRITICAL</option>
          </FloatingSelect>
          <FloatingInput label="Impact Assessment" value={form.impactAssessment} onChange={(event) => setForm({ ...form, impactAssessment: event.target.value })} />
        </div>
        <button type="button" onClick={() => createChange.mutate()} disabled={!form.title || createChange.isPending} className="mt-3 rounded bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
          {createChange.isPending ? "Creating..." : "Create Change"}
        </button>
        {message ? <p className="mt-2 text-sm text-slate-700">{message}</p> : null}
      </div>
      <h2 className="mb-4 font-heading text-xl">Change Management</h2>
      {isLoading ? (
        <p>Loading change requests...</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="w-10 py-2"> </th>
              <th className="py-2">CR#</th>
              <th className="py-2">Title</th>
              <th className="py-2">Type</th>
              <th className="py-2">Priority</th>
              <th className="py-2">Status</th>
              <th className="py-2">Workflow</th>
              <th className="py-2">Open</th>
              <th className="py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data?.data.map((change) => (
              <tr key={change.id} className="border-b border-slate-100">
                <td className="py-2 text-slate-500">
                  <EntityIcon kind="change" />
                </td>
                <td className="py-2 font-mono">
                  <Link to={`/changes/${change.id}`} className="text-primary hover:underline">
                    {change.crNumber}
                  </Link>
                </td>
                <td className="py-2">{change.title}</td>
                <td className="py-2">{change.type}</td>
                <td className="py-2">{change.priority}</td>
                <td className="py-2">{change.status}</td>
                <td className="py-2">
                  {workflowByEntity.get(change.id) ? (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{workflowByEntity.get(change.id)}</span>
                  ) : (
                    <span className="text-xs text-slate-400">Not started</span>
                  )}
                </td>
                <td className="py-2">
                  <Link to={`/changes/${change.id}`} className="rounded border border-slate-300 px-2 py-1 text-xs">
                    Open
                  </Link>
                </td>
                <td className="py-2">
                  <ObjectActionsMenu onAction={(action) => void runChangeAction(change, action)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
