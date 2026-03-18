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

interface ReleaseDetail {
  id: string;
  rrNumber: string;
  title: string;
  description?: string | null;
  status: string;
  containerId?: string | null;
}

export function ReleaseDetailPage(): JSX.Element {
  const params = useParams();
  const releaseId = String(params.id ?? "");
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"details" | "affected" | "workflow" | "signoff">("details");

  const release = useQuery({
    queryKey: ["release-detail", releaseId],
    queryFn: async () => (await api.get<ReleaseDetail>(`/releases/${releaseId}`)).data,
    enabled: Boolean(releaseId)
  });

  const workflow = useQuery({
    queryKey: ["release-workflow", releaseId],
    queryFn: async () =>
      (
        await api.get<{ data: WorkflowInstanceFull[] }>("/workflows/instances", {
          params: { entityType: "RELEASE_REQUEST", entityId: releaseId }
        })
      ).data,
    enabled: Boolean(releaseId)
  });

  const [form, setForm] = useState({
    title: "",
    description: ""
  });

  const updateRelease = useMutation({
    mutationFn: async (payload: Partial<ReleaseDetail>) => {
      await api.put(`/releases/${releaseId}`, payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["release-detail", releaseId] });
      await queryClient.invalidateQueries({ queryKey: ["releases"] });
      toast.success("Release request saved.");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Update failed")
  });

  if (release.isLoading) {
    return <div className="rounded-lg bg-white p-4">Loading release request...</div>;
  }

  const data = release.data;
  if (!data) {
    return <div className="rounded-lg bg-white p-4">Release request not found.</div>;
  }

  const canEdit = data.status === "NEW";

  return (
    <div className="space-y-4 rounded-xl bg-white p-4">
      <DetailHeaderCard
        icon={<EntityIcon kind="release" size={20} />}
        code={data.rrNumber}
        title={data.title}
        meta="Release Request"
        backTo="/releases"
        backLabel="Back to Releases"
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
          <h3 className="mb-3 font-heading text-lg">Edit Release Request</h3>
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
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                updateRelease.mutate({
                  title: form.title || data.title,
                  description: form.description ?? data.description ?? null
                })
              }
              disabled={!canEdit || updateRelease.isPending}
              title={!canEdit ? "This release is locked once submitted" : undefined}
              className="rounded bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {updateRelease.isPending ? "Saving..." : "Save Changes"}
            </button>
            <button
              type="button"
              onClick={() => updateRelease.mutate({ status: "SUBMITTED" })}
              disabled={!canEdit || updateRelease.isPending}
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
          <p className="mb-4 text-sm text-slate-500">Items and formulas included in this release package.</p>
          <AffectedObjects entityId={releaseId} entityType="RELEASE_REQUEST" canEdit={canEdit} />
        </div>
      ) : activeTab === "workflow" ? (
        <div className="space-y-1">
          <WorkflowVisualizer
            instance={workflow.data?.data?.[0]}
            loading={workflow.isLoading}
            entityStatus={data.status}
            entityLabel="release request"
          />
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <h3 className="mb-3 font-heading text-lg">Signoff History</h3>
          <p className="mb-4 text-sm text-slate-500">Complete audit trail of workflow tasks — who was assigned, what action was taken, and the signoff comment.</p>
          <SignoffHistory entityId={releaseId} entityType="RELEASE_REQUEST" />
        </div>
      )}
    </div>
  );
}
