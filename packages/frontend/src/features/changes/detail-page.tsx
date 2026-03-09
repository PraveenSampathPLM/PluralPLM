import { Link, useParams } from "react-router-dom";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { EntityIcon } from "@/components/entity-icon";

interface ChangeDetail {
  id: string;
  crNumber: string;
  title: string;
  description?: string | null;
  type: string;
  priority: string;
  status: string;
  impactAssessment?: string | null;
  containerId?: string | null;
}

interface WorkflowInstance {
  id: string;
  currentState: string;
  definition?: { name: string };
}

export function ChangeDetailPage(): JSX.Element {
  const params = useParams();
  const changeId = String(params.id ?? "");
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState<"details" | "workflow">("details");

  const change = useQuery({
    queryKey: ["change-detail", changeId],
    queryFn: async () => (await api.get<ChangeDetail>(`/changes/${changeId}`)).data,
    enabled: Boolean(changeId)
  });

  const workflow = useQuery({
    queryKey: ["change-workflow", changeId],
    queryFn: async () =>
      (
        await api.get<{ data: WorkflowInstance[] }>("/workflows/instances", {
          params: { entityType: "CHANGE_REQUEST", entityId: changeId }
        })
      ).data,
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
    mutationFn: async (payload: Partial<ChangeDetail>) => {
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
    return <div className="rounded-lg bg-white p-4">Loading change request...</div>;
  }

  const data = change.data;
  if (!data) {
    return <div className="rounded-lg bg-white p-4">Change request not found.</div>;
  }

  const canEdit = data.status === "NEW";

  return (
    <div className="space-y-4 rounded-xl bg-white p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-slate-100 p-2">
            <EntityIcon kind="change" size={20} />
          </div>
          <div>
            <p className="font-mono text-sm text-slate-500">{data.crNumber}</p>
            <h2 className="font-heading text-xl">{data.title}</h2>
            <p className="text-sm text-slate-500">{data.type} | {data.priority} | {data.status}</p>
          </div>
        </div>
        <Link to="/changes" className="rounded border border-slate-300 bg-white px-3 py-1 text-sm">
          Back to Changes
        </Link>
      </div>

      {message ? <p className="rounded border border-slate-200 bg-slate-50 p-2 text-sm text-slate-700">{message}</p> : null}

      <div className="flex items-center gap-2 border-b border-slate-200 text-sm">
        <button
          type="button"
          onClick={() => setActiveTab("details")}
          className={`px-3 py-2 ${activeTab === "details" ? "border-b-2 border-primary font-medium text-primary" : "text-slate-500"}`}
        >
          Details
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("workflow")}
          className={`px-3 py-2 ${activeTab === "workflow" ? "border-b-2 border-primary font-medium text-primary" : "text-slate-500"}`}
        >
          Workflow
        </button>
      </div>

      {activeTab === "details" ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <h3 className="mb-3 font-heading text-lg">Edit Change Request</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={form.title || data.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              placeholder="Title"
              className="rounded border border-slate-300 px-3 py-2 text-sm"
              disabled={!canEdit}
            />
            <input
              value={form.description || data.description || ""}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              placeholder="Description"
              className="rounded border border-slate-300 px-3 py-2 text-sm"
              disabled={!canEdit}
            />
            <select
              value={form.type || data.type}
              onChange={(event) => setForm({ ...form, type: event.target.value })}
              className="rounded border border-slate-300 px-3 py-2 text-sm"
              disabled={!canEdit}
            >
              <option value="ECR">ECR</option>
              <option value="ECO">ECO</option>
              <option value="ECN">ECN</option>
              <option value="DCO">DCO</option>
            </select>
            <select
              value={form.priority || data.priority}
              onChange={(event) => setForm({ ...form, priority: event.target.value })}
              className="rounded border border-slate-300 px-3 py-2 text-sm"
              disabled={!canEdit}
            >
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
              <option value="CRITICAL">CRITICAL</option>
            </select>
            <input
              value={form.impactAssessment || data.impactAssessment || ""}
              onChange={(event) => setForm({ ...form, impactAssessment: event.target.value })}
              placeholder="Impact Assessment"
              className="rounded border border-slate-300 px-3 py-2 text-sm md:col-span-2"
              disabled={!canEdit}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                updateChange.mutate({
                  title: form.title || data.title,
                  description: form.description || data.description,
                  type: form.type || data.type,
                  priority: form.priority || data.priority,
                  impactAssessment: form.impactAssessment || data.impactAssessment
                })
              }
              disabled={!canEdit || updateChange.isPending}
              className="rounded bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {updateChange.isPending ? "Saving..." : "Save Changes"}
            </button>
            <button
              type="button"
              onClick={() => updateChange.mutate({ status: "SUBMITTED" })}
              disabled={!canEdit || updateChange.isPending}
              className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-60"
            >
              Submit for Workflow
            </button>
          </div>
          {!canEdit ? <p className="mt-2 text-xs text-slate-500">Editing is locked once submitted.</p> : null}
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
          <h3 className="mb-3 font-heading text-lg">Workflow Status</h3>
          {workflow.data?.data?.length ? (
            (() => {
              const wf = workflow.data?.data?.[0];
              const assignments = (wf?.definition as any)?.actions?.stateAssignments?.[wf.currentState] ?? {};
              const roles = assignments.roles ?? [];
              const slaHours = typeof assignments.slaHours === "number" ? assignments.slaHours : null;
              const entryRule = typeof assignments.entryRule === "string" ? assignments.entryRule : "";
              const description = typeof assignments.description === "string" ? assignments.description : "";
              return (
                <div className="space-y-2">
                  <p className="text-slate-700">
                    {wf?.definition?.name ?? "Workflow"}:{" "}
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-700">{wf?.currentState}</span>
                  </p>
                  <p className="text-xs text-slate-600">Assigned Roles: {roles.length ? roles.join(", ") : "Unassigned"}</p>
                  {slaHours !== null ? <p className="text-xs text-slate-600">SLA: {slaHours} hours</p> : null}
                  {entryRule ? <p className="text-xs text-slate-600">Entry Rule: {entryRule}</p> : null}
                  {description ? <p className="text-xs text-slate-600">Task: {description}</p> : null}
                </div>
              );
            })()
          ) : (
            <div className="space-y-2">
              <p className="text-slate-500">Not started yet.</p>
              {data.status === "SUBMITTED" ? (
                <button
                  type="button"
                  onClick={() => updateChange.mutate({ status: "SUBMITTED" })}
                  className="rounded border border-slate-300 bg-white px-3 py-1 text-xs"
                >
                  Start Workflow
                </button>
              ) : (
                <p className="text-xs text-slate-500">Submit the change to start workflow.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
