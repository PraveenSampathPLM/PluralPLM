import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ObjectActionsMenu, type ObjectActionKey } from "@/components/object-actions-menu";
import { useContainerStore } from "@/store/container.store";
import { Link } from "react-router-dom";
import { FloatingInput, FloatingSelect } from "@/components/floating-field";
import { EntityIcon } from "@/components/entity-icon";

interface ReleaseRecord {
  id: string;
  rrNumber: string;
  title: string;
  status: string;
}

interface ReleaseListResponse {
  data: ReleaseRecord[];
  total: number;
  page: number;
  pageSize: number;
}

interface WorkflowInstance {
  id: string;
  entityId: string;
  currentState: string;
}

interface FormulaOption {
  id: string;
  formulaCode: string;
  version: number;
  name: string;
}

interface BomOption {
  id: string;
  bomCode: string;
  version: number;
  bomType?: "FG_BOM" | "FML_BOM";
}

export function ReleasesPage(): JSX.Element {
  const { selectedContainerId } = useContainerStore();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    rrNumber: "",
    title: "",
    description: ""
  });
  const [selectedFormulas, setSelectedFormulas] = useState<string[]>([]);
  const [selectedBoms, setSelectedBoms] = useState<string[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ["releases", selectedContainerId],
    queryFn: async () =>
      (
        await api.get<ReleaseListResponse>("/releases", {
          params: { ...(selectedContainerId ? { containerId: selectedContainerId } : {}) }
        })
      ).data
  });

  const workflowInstances = useQuery({
    queryKey: ["release-workflows", data?.data.map((release) => release.id).join(","), selectedContainerId],
    queryFn: async () => {
      const ids = data?.data.map((release) => release.id).join(",");
      if (!ids) {
        return { data: [] as WorkflowInstance[] };
      }
      return (await api.get<{ data: WorkflowInstance[] }>("/workflows/instances", { params: { entityType: "RELEASE_REQUEST", entityId: ids } })).data;
    },
    enabled: Boolean(data?.data?.length)
  });

  const workflowByEntity = new Map(
    (workflowInstances.data?.data ?? []).map((instance) => [instance.entityId, instance.currentState])
  );

  const formulas = useQuery({
    queryKey: ["release-formula-options"],
    queryFn: async () =>
      (await api.get<{ data: FormulaOption[] }>("/formulas", { params: { pageSize: 200 } })).data
  });

  const boms = useQuery({
    queryKey: ["release-bom-options"],
    queryFn: async () => (await api.get<{ data: BomOption[] }>("/bom", { params: { pageSize: 200 } })).data
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

  async function runReleaseAction(release: ReleaseRecord, action: ObjectActionKey): Promise<void> {
    try {
      if (action === "checkout") {
        await api.put(`/releases/${release.id}`, { status: "UNDER_REVIEW" });
        setMessage(`${release.rrNumber} moved to UNDER_REVIEW.`);
      } else if (action === "checkin") {
        await api.put(`/releases/${release.id}`, { status: "RELEASED" });
        setMessage(`${release.rrNumber} marked RELEASED.`);
      } else if (action === "revise") {
        await api.put(`/releases/${release.id}`, { status: "SUBMITTED" });
        setMessage(`${release.rrNumber} submitted.`);
      } else if (action === "copy") {
        await api.post("/releases", {
          title: `${release.title} Copy`,
          status: "NEW",
          targetFormulas: [],
          targetBoms: []
        });
        setMessage(`Copy created for ${release.rrNumber}.`);
      } else if (action === "delete") {
        if (!window.confirm(`Delete release request ${release.rrNumber}?`)) {
          return;
        }
        await api.delete(`/releases/${release.id}`);
        setMessage(`${release.rrNumber} deleted.`);
      }
      await queryClient.invalidateQueries({ queryKey: ["releases"] });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed");
    }
  }

  return (
    <div className="space-y-4 rounded-xl bg-white p-4">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h3 className="mb-3 font-heading text-lg">Create Release Request</h3>
        <p className="mb-2 text-xs text-slate-500">Active container: {selectedContainerId || "All Accessible"}</p>
        <div className="grid gap-3 md:grid-cols-5">
          <FloatingInput label="RR Number" value={form.rrNumber} onChange={(event) => setForm({ ...form, rrNumber: event.target.value })} />
          <FloatingInput label="Title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          <FloatingInput label="Description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-medium text-slate-600">Select Formulas</p>
            <div className="max-h-40 overflow-y-auto rounded border border-slate-200 bg-white p-2 text-sm">
              {formulas.data?.data.map((formula) => (
                <label key={formula.id} className="flex items-center gap-2 py-1">
                  <input
                    type="checkbox"
                    checked={selectedFormulas.includes(formula.id)}
                    onChange={(event) =>
                      setSelectedFormulas((prev) =>
                        event.target.checked ? [...prev, formula.id] : prev.filter((id) => id !== formula.id)
                      )
                    }
                  />
                  <span className="font-mono text-xs">{formula.formulaCode} v{formula.version}</span>
                  <span className="text-slate-600">{formula.name}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-slate-600">Select BOMs</p>
            <div className="max-h-40 overflow-y-auto rounded border border-slate-200 bg-white p-2 text-sm">
              {boms.data?.data.map((bom) => (
                <label key={bom.id} className="flex items-center gap-2 py-1">
                  <input
                    type="checkbox"
                    checked={selectedBoms.includes(bom.id)}
                    onChange={(event) =>
                      setSelectedBoms((prev) => (event.target.checked ? [...prev, bom.id] : prev.filter((id) => id !== bom.id)))
                    }
                  />
                  <span className="font-mono text-xs">{bom.bomCode} v{bom.version}</span>
                  <span className="text-slate-600">{bom.bomType === "FG_BOM" ? "FG BOM" : "FML BOM"}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => createRelease.mutate()}
          disabled={!form.title || createRelease.isPending}
          className="mt-3 rounded bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {createRelease.isPending ? "Creating..." : "Create Release Request"}
        </button>
        {message ? <p className="mt-2 text-sm text-slate-700">{message}</p> : null}
      </div>

      <h2 className="mb-4 font-heading text-xl">Release Requests</h2>
      {isLoading ? (
        <p>Loading release requests...</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="w-10 py-2"> </th>
              <th className="py-2">RR#</th>
              <th className="py-2">Title</th>
              <th className="py-2">Status</th>
              <th className="py-2">Workflow</th>
              <th className="py-2">Open</th>
              <th className="py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data?.data.map((release) => (
              <tr key={release.id} className="border-b border-slate-100">
                <td className="py-2 text-slate-500">
                  <EntityIcon kind="release" />
                </td>
                <td className="py-2 font-mono">
                  <Link to={`/releases/${release.id}`} className="text-primary hover:underline">
                    {release.rrNumber}
                  </Link>
                </td>
                <td className="py-2">{release.title}</td>
                <td className="py-2">{release.status}</td>
                <td className="py-2">
                  {workflowByEntity.get(release.id) ? (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{workflowByEntity.get(release.id)}</span>
                  ) : (
                    <span className="text-xs text-slate-400">Not started</span>
                  )}
                </td>
                <td className="py-2">
                  <Link to={`/releases/${release.id}`} className="rounded border border-slate-300 px-2 py-1 text-xs">
                    Open
                  </Link>
                </td>
                <td className="py-2">
                  <ObjectActionsMenu onAction={(action) => void runReleaseAction(release, action)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
