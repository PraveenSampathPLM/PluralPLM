import { Link, useParams } from "react-router-dom";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { EntityIcon } from "@/components/entity-icon";

interface ReleaseDetail {
  id: string;
  rrNumber: string;
  title: string;
  description?: string | null;
  status: string;
  containerId?: string | null;
}

interface WorkflowInstance {
  id: string;
  currentState: string;
  definition?: { name: string };
}

export function ReleaseDetailPage(): JSX.Element {
  const params = useParams();
  const releaseId = String(params.id ?? "");
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState<"details" | "workflow">("details");

  const release = useQuery({
    queryKey: ["release-detail", releaseId],
    queryFn: async () => (await api.get<ReleaseDetail>(`/releases/${releaseId}`)).data,
    enabled: Boolean(releaseId)
  });

  const workflow = useQuery({
    queryKey: ["release-workflow", releaseId],
    queryFn: async () =>
      (
        await api.get<{ data: WorkflowInstance[] }>("/workflows/instances", {
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
      setMessage("Release request updated.");
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : "Update failed")
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-slate-100 p-2">
            <EntityIcon kind="release" size={20} />
          </div>
          <div>
            <p className="font-mono text-sm text-slate-500">{data.rrNumber}</p>
            <h2 className="font-heading text-xl">{data.title}</h2>
            <p className="text-sm text-slate-500">{data.status}</p>
          </div>
        </div>
        <Link to="/releases" className="rounded border border-slate-300 bg-white px-3 py-1 text-sm">
          Back to Releases
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
                  description: form.description || data.description
                })
              }
              disabled={!canEdit || updateRelease.isPending}
              className="rounded bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {updateRelease.isPending ? "Saving..." : "Save Changes"}
            </button>
            <button
              type="button"
              onClick={() => updateRelease.mutate({ status: "SUBMITTED" })}
              disabled={!canEdit || updateRelease.isPending}
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
                  onClick={() => updateRelease.mutate({ status: "SUBMITTED" })}
                  className="rounded border border-slate-300 bg-white px-3 py-1 text-xs"
                >
                  Start Workflow
                </button>
              ) : (
                <p className="text-xs text-slate-500">Submit the release to start workflow.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
