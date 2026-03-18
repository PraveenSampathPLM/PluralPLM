import { Link, useParams } from "react-router-dom";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { EntityIcon } from "@/components/entity-icon";
import { DetailHeaderCard } from "@/components/detail-header-card";
import { StatusBadge } from "@/components/status-badge";
import { SignoffHistory } from "@/components/signoff-history";
import { AffectedObjects } from "@/components/affected-objects";
import { WorkflowVisualizer, type WorkflowInstanceFull } from "@/components/workflow-visualizer";
import { toast } from "sonner";

interface ChangeDetail {
  id: string;
  crNumber: string;
  title: string;
  description?: string | null;
  type: string;
  priority: string;
  status: string;
  targetAction: "RELEASE" | "OBSOLETE";
  impactAssessment?: string | null;
  containerId?: string | null;
}

export function ChangeDetailPage(): JSX.Element {
  const params = useParams();
  const changeId = String(params.id ?? "");
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"details" | "affected" | "workflow" | "signoff">("details");

  const change = useQuery({
    queryKey: ["change-detail", changeId],
    queryFn: async () => (await api.get<ChangeDetail>(`/changes/${changeId}`)).data,
    enabled: Boolean(changeId)
  });

  const workflow = useQuery({
    queryKey: ["change-workflow", changeId],
    queryFn: async () =>
      (
        await api.get<{ data: WorkflowInstanceFull[] }>("/workflows/instances", {
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
    targetAction: "" as "" | "RELEASE" | "OBSOLETE",
    impactAssessment: ""
  });

  const updateChange = useMutation({
    mutationFn: async (payload: Partial<ChangeDetail>) => {
      await api.put(`/changes/${changeId}`, payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["change-detail", changeId] });
      await queryClient.invalidateQueries({ queryKey: ["changes"] });
      toast.success("Change request saved.");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Update failed")
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
      <DetailHeaderCard
        icon={<EntityIcon kind="change" size={20} />}
        code={data.crNumber}
        title={data.title}
        meta={`${data.type} | ${data.priority} | Target: ${data.targetAction ?? "RELEASE"}`}
        backTo="/changes"
        backLabel="Back to Changes"
      />
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <span>Status</span>
        <StatusBadge status={data.status} />
      </div>

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
          onClick={() => setActiveTab("affected")}
          className={`px-3 py-2 ${activeTab === "affected" ? "border-b-2 border-primary font-medium text-primary" : "text-slate-500"}`}
        >
          Affected Objects
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("workflow")}
          className={`px-3 py-2 ${activeTab === "workflow" ? "border-b-2 border-primary font-medium text-primary" : "text-slate-500"}`}
        >
          Workflow
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("signoff")}
          className={`px-3 py-2 ${activeTab === "signoff" ? "border-b-2 border-primary font-medium text-primary" : "text-slate-500"}`}
        >
          Signoff History
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
            <div className="md:col-span-2">
              <p className="mb-1.5 text-xs font-medium text-slate-600">Target Action</p>
              <div className="flex gap-4">
                {(["RELEASE", "OBSOLETE"] as const).map((action) => {
                  const active = (form.targetAction || data.targetAction) === action;
                  return (
                    <label
                      key={action}
                      className={`flex cursor-pointer items-start gap-2 rounded border px-3 py-2 text-sm transition-colors ${
                        active
                          ? action === "RELEASE"
                            ? "border-green-500 bg-green-50 text-green-800"
                            : "border-orange-400 bg-orange-50 text-orange-800"
                          : "border-slate-200 bg-white text-slate-600"
                      } ${!canEdit ? "cursor-not-allowed opacity-60" : ""}`}
                    >
                      <input
                        type="radio"
                        name="targetAction"
                        value={action}
                        checked={active}
                        disabled={!canEdit}
                        onChange={() => setForm({ ...form, targetAction: action })}
                        className="mt-0.5"
                      />
                      <div>
                        <p className="font-medium">{action === "RELEASE" ? "Release" : "Obsolete"}</p>
                        <p className="text-xs opacity-75">
                          {action === "RELEASE"
                            ? "Affected objects will be promoted to RELEASED when approved"
                            : "Affected objects will be marked OBSOLETE when approved"}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
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
                  description: form.description ?? data.description ?? null,
                  type: form.type || data.type,
                  priority: form.priority || data.priority,
                  targetAction: form.targetAction || data.targetAction,
                  impactAssessment: form.impactAssessment ?? data.impactAssessment ?? null
                })
              }
              disabled={!canEdit || updateChange.isPending}
              title={!canEdit ? "This change is locked once submitted — create a new ECR to make further changes" : undefined}
              className="rounded bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {updateChange.isPending ? "Saving..." : "Save Changes"}
            </button>
            <button
              type="button"
              onClick={() => updateChange.mutate({ status: "SUBMITTED" })}
              disabled={!canEdit || updateChange.isPending}
              title={!canEdit ? "Already submitted — cannot resubmit" : undefined}
              className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-60"
            >
              Submit for Workflow
            </button>
          </div>
          {!canEdit ? <p className="mt-2 text-xs text-slate-500">Editing is locked once submitted.</p> : null}
        </div>
      ) : activeTab === "affected" ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <h3 className="mb-1 font-heading text-lg">Affected Objects</h3>
          <p className="mb-4 text-sm text-slate-500">Items and formulas undergoing this change.</p>
          <AffectedObjects entityId={changeId} entityType="CHANGE_REQUEST" canEdit={canEdit} />
        </div>
      ) : activeTab === "workflow" ? (
        <div className="space-y-1">
          <WorkflowVisualizer
            instance={workflow.data?.data?.[0]}
            loading={workflow.isLoading}
            entityStatus={data.status}
            entityLabel="change request"
          />
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <h3 className="mb-3 font-heading text-lg">Signoff History</h3>
          <p className="mb-4 text-sm text-slate-500">Complete audit trail of workflow tasks — who was assigned, what action was taken, and the signoff comment.</p>
          <SignoffHistory entityId={changeId} entityType="CHANGE_REQUEST" />
        </div>
      )}
    </div>
  );
}
